import 'server-only';

import {
  ID_PATTERNS,
  LIMITS,
  PERSONAL_INTAKE_EXTRACTION_VERSION,
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
  extractionUpperBoundUsd,
  transcriptionUpperBoundUsd,
  type LiveIntakeConfig,
} from './intake-config';
import {
  EXTRACTION_INSTRUCTIONS,
  ExtractionMalformedError,
  buildExtractionUserText,
  extractionJsonSchema,
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
  transcribe(input: { audio: Buffer; container: ProviderAudioContainer; signal: AbortSignal }): Promise<{ text: string }>;
  extract(input: {
    instructions: string;
    userText: string;
    schema: object;
    maxOutputTokens: number;
    signal: AbortSignal;
  }): Promise<{ status: string; outputText: string }>;
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
  | 'timeline_invalid'
  | 'timeline_mismatch'
  | LedgerRefusal
  | 'provider_failed'
  | 'provider_timeout'
  | 'extraction_malformed'
  | 'client_aborted';

export type IntakeOutcome =
  | { ok: true; result: IntakeResult; reservedUsd: number }
  | { ok: false; status: number; code: IntakeFailureCode };

const PROVIDER_AUDIO_TYPES: ReadonlySet<string> = new Set(['audio/webm', 'audio/mp4']);
const MIN_AUDIO_BYTES = 512;
/** Container rounding tolerance above the 90 s recording ceiling. */
const DURATION_TOLERANCE_MS = 1500;
/** Fewer meaningful characters than this cannot hold a detail; extraction is not called. */
const MIN_UNDERSTANDABLE_CHARS = 6;

const MEASUREMENT_REFUSAL: Record<Exclude<AudioMeasurement, { ok: true }>['reason'], { status: number; code: IntakeFailureCode }> = {
  unreadable: { status: 422, code: 'duration_unreadable' },
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

function notUnderstood(): IntakeExtraction {
  return {
    version: PERSONAL_INTAKE_EXTRACTION_VERSION,
    understood: false,
    facts: [],
    storyPlace: null,
    mentionedName: null,
    mentionedAge: null,
    explicitTopicId: null,
  };
}

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
  topics: IntakeServiceDeps['topics'],
  transcript: string,
  signal: AbortSignal,
): Promise<IntakeExtraction> {
  const topicIds = topics.map((topic) => topic.id);
  const answer = await provider.extract({
    instructions: EXTRACTION_INSTRUCTIONS,
    userText: buildExtractionUserText(transcript, topics),
    schema: extractionJsonSchema(topicIds),
    maxOutputTokens: INTAKE_HARD_LIMITS.extractMaxOutputTokens,
    signal,
  });
  if (answer.status !== 'completed') throw new ExtractionMalformedError();
  let json: unknown;
  try {
    json = JSON.parse(answer.outputText);
  } catch {
    throw new ExtractionMalformedError();
  }
  return sanitizeExtraction(json, new Set(topicIds));
}

function failureFor(error: unknown, guard: { timedOut: () => boolean }, parent?: AbortSignal): IntakeOutcome {
  if (error instanceof ExtractionMalformedError) return fail(502, 'extraction_malformed');
  if (guard.timedOut()) return fail(504, 'provider_timeout');
  if (parent?.aborted) return fail(499, 'client_aborted');
  return fail(502, 'provider_failed');
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
  try {
    const provider = deps.createProvider();
    const transcription = await provider.transcribe({ audio: input.bytes, container, signal: guard.signal });
    const transcript = normalizeText(String(transcription.text ?? '')).slice(0, LIMITS.transcriptMax).trim();
    const extraction =
      comparableText(transcript).length < MIN_UNDERSTANDABLE_CHARS
        ? notUnderstood()
        : await extract(provider, deps.topics, transcript, guard.signal);
    const result = intakeResultSchema.parse({
      jobId: input.jobId,
      source: 'transcript',
      transcript: transcript || null,
      extraction,
    });
    deps.ledger.finish(input.userId, input.jobId, 'done');
    return { ok: true, result, reservedUsd };
  } catch (error) {
    deps.ledger.finish(input.userId, input.jobId, 'failed');
    return failureFor(error, guard, input.signal);
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
  try {
    const extraction =
      comparableText(text).length < MIN_UNDERSTANDABLE_CHARS
        ? notUnderstood()
        : await extract(deps.createProvider(), deps.topics, text, guard.signal);
    const result = intakeResultSchema.parse({ jobId: input.jobId, source: 'transcript', transcript: text, extraction });
    deps.ledger.finish(input.userId, input.jobId, 'done');
    return { ok: true, result, reservedUsd };
  } catch (error) {
    deps.ledger.finish(input.userId, input.jobId, 'failed');
    return failureFor(error, guard, input.signal);
  } finally {
    guard.dispose();
  }
}
