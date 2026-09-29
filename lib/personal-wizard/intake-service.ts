import 'server-only';

import {
  ID_PATTERNS,
  LIMITS,
  comparableText,
  intakeResultSchema,
  normalizeText,
  type IntakeExtraction,
  type IntakeResult,
} from './contract';
import { sniffAudioContainer, type AudioMeasurement, type ProviderAudioContainer } from './audio-probe';
import {
  INTAKE_HARD_LIMITS,
  MAX_TRANSCRIPT_BYTES,
  extractionEstimateUsd,
  extractionUpperBoundUsd,
  transcriptionEstimateUsd,
  transcriptionUpperBoundUsd,
  type LiveIntakeConfig,
  type ProviderUsage,
} from './intake-config';
import {
  EXTRACTION_INSTRUCTIONS,
  ExtractionMalformedError,
  buildExtractionUserText,
  extractionJsonSchema,
  notUnderstoodExtraction,
  sanitizeExtraction,
} from './intake-extraction';
import type { IntakeLedger, LedgerRefusal } from './intake-ledger';
import { MIN_CLIP_MS, baseMimeType } from './recorder';

/**
 * Live intake core, independent of HTTP and of any provider SDK (the provider is injected).
 *
 * Order of operations for audio: ids -> declared type -> byte bounds -> container sniffed from the
 * bytes must equal the declared type -> duration measured from a validated timeline AND decoded
 * audio (they must agree; the larger is used) -> conservative cost reserved in the ledger
 * (idempotency, one job per user, budget, job count) -> transcribe -> extract -> sanitize ->
 * contract-validated result. No step retries a provider call.
 */
export type IntakeProvider = {
  transcribe(input: {
    audio: Buffer;
    container: ProviderAudioContainer;
    signal: AbortSignal;
  }): Promise<{ text: string; usage?: ProviderUsage | null }>;
  extract(input: {
    instructions: string;
    userText: string;
    schema: object;
    maxOutputTokens: number;
    signal: AbortSignal;
  }): Promise<{ status: string; outputText: string; usage?: ProviderUsage | null }>;
};

/**
 * One provider call of a job, for honest accounting (live trial F4): which calls were made, how
 * long they took and what the provider reported, never content. `sent` is false when the job was
 * already aborted as the call started, so the request could not have left.
 */
export type ProviderCallRecord = {
  kind: 'transcribe' | 'extract';
  model: string;
  sent: boolean;
  outcome: 'ok' | 'failed';
  ms: number;
  usage: ProviderUsage | null;
  estimatedUsd: number | null;
};

export type IntakeServiceDeps = {
  /** Called only after validation and the ledger reservation succeeded; never for a refused request. */
  createProvider: () => IntakeProvider;
  ledger: IntakeLedger;
  config: Pick<LiveIntakeConfig, 'transcribeModel' | 'extractModel' | 'budgetUsd' | 'maxJobs'>;
  /** Must refuse anything that decodes to more than `maxDurationMs`; see audio-probe.ts. */
  measureAudio: (bytes: Buffer, container: ProviderAudioContainer, maxDurationMs: number) => Promise<AudioMeasurement>;
  topics: ReadonlyArray<{ id: string; label: string }>;
  timeoutMs?: number;
};

export type IntakeFailureCode =
  | 'bad_request'
  | 'unsupported_format'
  | 'format_mismatch'
  | 'too_large'
  | 'too_short'
  | 'too_long'
  | 'duration_unreadable'
  | 'unexpected_streams'
  | 'timeline_invalid'
  | 'timeline_mismatch'
  | LedgerRefusal
  | 'provider_failed'
  | 'provider_timeout'
  | 'extraction_malformed'
  | 'client_aborted';

/**
 * `reservedUsd` is the conservative ledger reservation; `estimatedUsd` the usage-based estimate
 * (null when a call reported no usage). Neither is a bill.
 */
export type IntakeOutcome =
  | { ok: true; result: IntakeResult; reservedUsd: number; estimatedUsd: number | null; calls: ProviderCallRecord[] }
  | { ok: false; status: number; code: IntakeFailureCode; calls?: ProviderCallRecord[] };

const PROVIDER_AUDIO_TYPES: ReadonlySet<string> = new Set(['audio/webm', 'audio/mp4']);
const MIN_AUDIO_BYTES = 512;
/** Container rounding tolerance above the 90 s recording ceiling. */
const DURATION_TOLERANCE_MS = 1500;
/** Fewer meaningful characters than this cannot hold a detail; extraction is not called. */
const MIN_UNDERSTANDABLE_CHARS = 6;

const MEASUREMENT_REFUSAL: Record<Exclude<AudioMeasurement, { ok: true }>['reason'], { status: number; code: IntakeFailureCode }> = {
  unreadable: { status: 422, code: 'duration_unreadable' },
  unexpected_streams: { status: 422, code: 'unexpected_streams' },
  timeline_invalid: { status: 422, code: 'timeline_invalid' },
  timeline_mismatch: { status: 422, code: 'timeline_mismatch' },
  too_long: { status: 413, code: 'too_long' },
};

const LEDGER_STATUS: Record<LedgerRefusal, number> = {
  duplicate_job: 409,
  user_busy: 409,
  job_limit: 429,
  budget_exhausted: 402,
};

const fail = (status: number, code: IntakeFailureCode): IntakeOutcome => ({ ok: false, status, code });

function guardSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  parent?.addEventListener('abort', onAbort);
  if (parent?.aborted) controller.abort();
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onAbort);
    },
  };
}

/** Times and records one provider call, including a call that fails or is aborted. */
async function tracked<T extends { usage?: ProviderUsage | null }>(
  calls: ProviderCallRecord[],
  call: { kind: ProviderCallRecord['kind']; model: string; signal: AbortSignal; estimate: (result: T) => number | null },
  run: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  const sent = !call.signal.aborted;
  try {
    const result = await run();
    const usage = result.usage ?? null;
    calls.push({ kind: call.kind, model: call.model, sent, outcome: 'ok', ms: Date.now() - started, usage, estimatedUsd: call.estimate(result) });
    return result;
  } catch (error) {
    calls.push({ kind: call.kind, model: call.model, sent, outcome: 'failed', ms: Date.now() - started, usage: null, estimatedUsd: null });
    throw error;
  }
}

/** The job's estimate: the sum when every call that ran reported enough to estimate it. */
function totalEstimate(calls: readonly ProviderCallRecord[]): number | null {
  if (calls.length === 0) return 0;
  return calls.every((call) => call.estimatedUsd !== null)
    ? calls.reduce((sum, call) => sum + (call.estimatedUsd ?? 0), 0)
    : null;
}

function extractionReserveUsd(deps: IntakeServiceDeps): number {
  const topicIds = deps.topics.map((topic) => topic.id);
  const fixedBytes =
    Buffer.byteLength(EXTRACTION_INSTRUCTIONS) +
    Buffer.byteLength(JSON.stringify(extractionJsonSchema(topicIds))) +
    Buffer.byteLength(buildExtractionUserText('', deps.topics));
  return extractionUpperBoundUsd(deps.config.extractModel, fixedBytes + MAX_TRANSCRIPT_BYTES);
}

async function extract(
  provider: IntakeProvider,
  deps: Pick<IntakeServiceDeps, 'topics' | 'config'>,
  transcript: string,
  signal: AbortSignal,
  calls: ProviderCallRecord[],
): Promise<IntakeExtraction> {
  const { topics } = deps;
  const topicIds = topics.map((topic) => topic.id);
  const model = deps.config.extractModel;
  const answer = await tracked(calls, { kind: 'extract', model, signal, estimate: (result) => extractionEstimateUsd(model, result.usage ?? null) }, () =>
    provider.extract({
      instructions: EXTRACTION_INSTRUCTIONS,
      userText: buildExtractionUserText(transcript, topics),
      schema: extractionJsonSchema(topicIds),
      maxOutputTokens: INTAKE_HARD_LIMITS.extractMaxOutputTokens,
      signal,
    }),
  );
  if (answer.status !== 'completed') throw new ExtractionMalformedError();
  let json: unknown;
  try {
    json = JSON.parse(answer.outputText);
  } catch {
    throw new ExtractionMalformedError();
  }
  return sanitizeExtraction(json, new Set(topicIds));
}

function failureFor(
  error: unknown,
  guard: { timedOut: () => boolean },
  parent: AbortSignal | undefined,
  calls: ProviderCallRecord[],
): IntakeOutcome {
  const withCalls = (outcome: IntakeOutcome): IntakeOutcome => (outcome.ok ? outcome : { ...outcome, calls });
  if (error instanceof ExtractionMalformedError) return withCalls(fail(502, 'extraction_malformed'));
  if (guard.timedOut()) return withCalls(fail(504, 'provider_timeout'));
  if (parent?.aborted) return withCalls(fail(499, 'client_aborted'));
  return withCalls(fail(502, 'provider_failed'));
}

export async function runAudioIntake(
  deps: IntakeServiceDeps,
  input: { userId: string; jobId: string; draftId: string; declaredType: string; bytes: Buffer; signal?: AbortSignal },
): Promise<IntakeOutcome> {
  if (!ID_PATTERNS.job.test(input.jobId) || !ID_PATTERNS.draft.test(input.draftId)) return fail(400, 'bad_request');
  const declared = baseMimeType(input.declaredType);
  if (!PROVIDER_AUDIO_TYPES.has(declared)) return fail(415, 'unsupported_format');
  if (input.bytes.length > LIMITS.recordingMaxBytes) return fail(413, 'too_large');
  if (input.bytes.length < MIN_AUDIO_BYTES) return fail(422, 'too_short');
  const sniffed = sniffAudioContainer(input.bytes);
  if (sniffed !== declared) return fail(415, 'format_mismatch');
  const container = sniffed as ProviderAudioContainer;
  const measurement = await deps.measureAudio(input.bytes, container, LIMITS.recordingMaxMs + DURATION_TOLERANCE_MS);
  if (!measurement.ok) {
    const refusal = MEASUREMENT_REFUSAL[measurement.reason];
    return fail(refusal.status, refusal.code);
  }
  const { durationMs } = measurement;
  if (durationMs < MIN_CLIP_MS) return fail(422, 'too_short');
  if (durationMs > LIMITS.recordingMaxMs + DURATION_TOLERANCE_MS) return fail(413, 'too_long');

  const reservedUsd = transcriptionUpperBoundUsd(deps.config.transcribeModel, durationMs) + extractionReserveUsd(deps);
  const begin = deps.ledger.begin(input.userId, input.jobId, reservedUsd, deps.config);
  if (!begin.ok) return fail(LEDGER_STATUS[begin.code], begin.code);

  const guard = guardSignal(input.signal, deps.timeoutMs ?? INTAKE_HARD_LIMITS.providerTimeoutMs);
  const calls: ProviderCallRecord[] = [];
  try {
    const provider = deps.createProvider();
    const model = deps.config.transcribeModel;
    const transcription = await tracked(
      calls,
      { kind: 'transcribe', model, signal: guard.signal, estimate: () => transcriptionEstimateUsd(model, durationMs) },
      () => provider.transcribe({ audio: input.bytes, container, signal: guard.signal }),
    );
    const transcript = normalizeText(String(transcription.text ?? '')).slice(0, LIMITS.transcriptMax).trim();
    const extraction =
      comparableText(transcript).length < MIN_UNDERSTANDABLE_CHARS
        ? notUnderstoodExtraction()
        : await extract(provider, deps, transcript, guard.signal, calls);
    const result = intakeResultSchema.parse({
      jobId: input.jobId,
      source: 'transcript',
      transcript: transcript || null,
      extraction,
    });
    deps.ledger.finish(input.userId, input.jobId, 'done');
    return { ok: true, result, reservedUsd, estimatedUsd: totalEstimate(calls), calls };
  } catch (error) {
    deps.ledger.finish(input.userId, input.jobId, 'failed');
    return failureFor(error, guard, input.signal, calls);
  } finally {
    guard.dispose();
  }
}

/** Explicit re-organisation of a parent-corrected transcript: extraction only, no audio. */
export async function runTextIntake(
  deps: IntakeServiceDeps,
  input: { userId: string; jobId: string; draftId: string; text: unknown; signal?: AbortSignal },
): Promise<IntakeOutcome> {
  if (!ID_PATTERNS.job.test(input.jobId) || !ID_PATTERNS.draft.test(input.draftId)) return fail(400, 'bad_request');
  if (typeof input.text !== 'string') return fail(400, 'bad_request');
  const text = normalizeText(input.text);
  if (!text) return fail(422, 'too_short');
  if (text.length > LIMITS.transcriptMax) return fail(413, 'too_long');

  const reservedUsd = extractionReserveUsd(deps);
  const begin = deps.ledger.begin(input.userId, input.jobId, reservedUsd, deps.config);
  if (!begin.ok) return fail(LEDGER_STATUS[begin.code], begin.code);

  const guard = guardSignal(input.signal, deps.timeoutMs ?? INTAKE_HARD_LIMITS.providerTimeoutMs);
  const calls: ProviderCallRecord[] = [];
  try {
    const extraction =
      comparableText(text).length < MIN_UNDERSTANDABLE_CHARS
        ? notUnderstoodExtraction()
        : await extract(deps.createProvider(), deps, text, guard.signal, calls);
    const result = intakeResultSchema.parse({ jobId: input.jobId, source: 'transcript', transcript: text, extraction });
    deps.ledger.finish(input.userId, input.jobId, 'done');
    return { ok: true, result, reservedUsd, estimatedUsd: totalEstimate(calls), calls };
  } catch (error) {
    deps.ledger.finish(input.userId, input.jobId, 'failed');
    return failureFor(error, guard, input.signal, calls);
  } finally {
    guard.dispose();
  }
}
