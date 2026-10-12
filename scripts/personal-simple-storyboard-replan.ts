/**
 * Kind-enabled RE-PLAN of the ONE reviewed simple book: exactly two provider calls (the storyboard, then its review) from the unchanged
 * saved source, written into a NEW immutable folder bound to the reviewed parent. Dry run by default: no key, no client, no provider.
 *   node --require ./scripts/shims/register-server-only.cjs --import tsx scripts/personal-simple-storyboard-replan.ts \
 *     --book-dir <one-approved-book-20261008> [--grant <grant.json>] [--execute --key-env-file <file>]
 * A paid run needs a `storyboard-replan-grant/v1` (never an audition grant): an explicit approval that binds the parent, the saved source,
 * the inherited ledger, the cache-aware pricing policy, the executable and payload pins, the cap and this exact two-stage scope.
 * No retry, no story writing, no image, no downstream render. Not production, customer or release authority.
 */
import path from 'node:path';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import OpenAI from 'openai';
import { z } from 'zod';
import { previewSha } from '../lib/local-story-preview';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import type { PersonalWizardOptions } from '../lib/personal-wizard/options';
import { prepareCurrentPersonalStoryboard, storyboardInstructions, storyboardDraftSchema, storyboardReviewDisposition, personalStoryboardReviewSchema,
  type PersonalStoryboard } from '../lib/personal-wizard/storyboard';
import { runSimpleStoryboardDiagnostic, SIMPLE_STORYBOARD_INPUT_LIMIT, type SimpleStoryboardDiagnosticCall } from '../lib/personal-wizard/simple-storyboard-diagnostic';
import { decodePersonalBookProviderOutput } from '../lib/personal-wizard/book-openai';
import { PERSONAL_BOOK_REVIEW_INSTRUCTION } from '../lib/personal-wizard/book-runner';
import { BOOK_LIMITS, personalBookOutputLimits } from '../lib/personal-wizard/book-config';
import { generationTimeoutMs } from '../lib/personal-wizard/story-config';
import { LANDMARK_KIND_CONTRACT_VERSION, KIND_REVIEW_ADDENDUM } from '../lib/personal-wizard/storyboard-landmark-kind';
import { STORYBOARD_PRESERVATION_VERSION, storyboardPreservationDiff, type StoryboardPreservation } from '../lib/personal-wizard/storyboard-preservation';
import { simpleWizardVisualPayload } from './personal-simple-wizard-worker';
import { AuditionMeter, keyReader, loadReviewedBook, replanFiles, PARENT_STORYBOARD_DIR, REPLAN_INDEX_FILE, REPLAN_INDEX_VERSION,
  REPLAN_RESULT_VERSION } from './personal-simple-book-reviewed-audition';
import { CACHE_AWARE_PRICING_VERSION, CACHE_AWARE_RATES, CACHE_POLICY, RESERVATION_BUFFER_PERCENT, cacheAwareCostMicroUsd,
  cacheAwareReservationMicroUsd, cacheAwareUsage } from './personal-cache-aware-pricing';
import { exclusiveJson, exclusiveText, fencedText, realDirectory } from './personal-causal-trial-journal';

export class StoryboardReplanError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new StoryboardReplanError(code); };
const read = (file: string) => JSON.parse(fencedText(file, 32000000));
const sha = (value: string | Buffer) => previewSha(value);
const errorCode = (error: unknown) => error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' &&
  /^[a-z0-9_]+$/.test(error.code) ? error.code : error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'replan_failed';

export const REPLAN_GRANT_VERSION = 'storyboard-replan-grant/v1' as const;
export const REPLAN_STAGES = ['storyboard', 'review'] as const;
export const REPLAN_PLANNER_MODEL = 'gpt-6-astra' as const;
export const REPLAN_REVIEW_MODEL = 'gpt-6.1-sol' as const;
/** The compared images are page 4 attempts; only that page's camera is render authority for them. */
export const REPLAN_PAIR_PAGES = [4] as const;
export const REPLAN_CLAUDE_MAX = 'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger' as const;
/** Every file whose behaviour decides the two paid calls or their admission (repo-relative). */
export const REPLAN_EXECUTABLE_FILES = ['scripts/personal-simple-storyboard-replan.ts', 'scripts/personal-cache-aware-pricing.ts',
  'scripts/personal-simple-book-reviewed-audition.ts', 'scripts/personal-simple-wizard-worker.ts', 'lib/personal-wizard/storyboard.ts',
  'lib/personal-wizard/storyboard-preservation.ts', 'lib/personal-wizard/storyboard-landmark-kind.ts', 'lib/personal-wizard/simple-storyboard-diagnostic.ts',
  'lib/personal-wizard/book-openai.ts'] as const;

// ---------------------------------------------------------------------------------------------------------------
// Parent: the reviewed book, its saved source and its approved draft, loaded through the existing binding checks.
// ---------------------------------------------------------------------------------------------------------------
export type ReplanParent = { bookDir: string; requestId: string; request: unknown; options: PersonalWizardOptions; source: unknown;
  book: PersonalStoryboard; rawReview: unknown; draft: unknown; files: { result: { file: string; sha256: string }; draft: { file: string; sha256: string } } };

export function loadReplanParent(bookDir: string, workspace = process.cwd()): ReplanParent {
  const loaded = loadReviewedBook(bookDir, workspace);
  // Only a plain approved parent can be re-planned to ADD the kinds.
  if (loaded.book.landmarkKind !== undefined || loaded.book.moments !== undefined || loaded.book.requestId !== loaded.queued.requestId) fail('replan_parent_contract');
  const dir = path.join(bookDir, PARENT_STORYBOARD_DIR), file = (name: string) => path.join(dir, name);
  const fileSha = (name: string) => ({ file: file(name), sha256: sha(readFileSync(file(name))) });
  return { bookDir, requestId: loaded.queued.requestId, request: loaded.queued.request, options: loaded.options, source: loaded.result.source,
    book: loaded.book, rawReview: loaded.rawReview, draft: read(file('owned_storyboard_draft.json')),
    files: { result: fileSha('visual_simple_book_result.json'), draft: fileSha('owned_storyboard_draft.json') } };
}

export const replanPreservation = (parent: Pick<ReplanParent, 'book' | 'draft'>): StoryboardPreservation =>
  ({ parentStoryboardDigest: parent.book.storyboardDigest, draft: parent.draft });

/** Provider-free: the exact storyboard payload and the review's input-independent pins, timeouts and worst-case reservations. */
export function replanPayloadPlan(parent: ReplanParent) {
  const source = prepareCurrentPersonalStoryboard(parent.request, parent.source, parent.options, true, undefined, true, replanPreservation(parent));
  const caps = personalBookOutputLimits(source.story.pages.length);
  const storyboardCall = { stage: 'storyboard' as const, instructions: storyboardInstructions(source), input: canonicalJson(source.planningInput),
    schema: storyboardDraftSchema(source), maxOutputTokens: caps.storyboardOutputTokens,
    context: { narrativeSpreads: source.story.pages.length, sourceDigest: source.sourceDigest, actorOwnedAppearance: true as const, landmarkKindContract: true as const } };
  let storyboard: ReturnType<typeof simpleWizardVisualPayload>;
  // Over the provider payload limit: refused here, before any grant, claim or key.
  try { storyboard = simpleWizardVisualPayload(storyboardCall, REPLAN_REVIEW_MODEL); }
  catch (error) { return fail(errorCode(error) === 'book_provider_input_limit' ? 'replan_provider_input_limit' : 'replan_payload_policy'); }
  // Review instruction and schema do not depend on the (future) draft; its input is bounded by the payload limit instead.
  const reviewShape = simpleWizardVisualPayload({ stage: 'review', instructions: PERSONAL_BOOK_REVIEW_INSTRUCTION + '\n' + KIND_REVIEW_ADDENDUM, input: '{}',
    schema: personalStoryboardReviewSchema, maxOutputTokens: caps.reviewOutputTokens,
    context: { narrativeSpreads: source.story.pages.length, sourceDigest: source.sourceDigest, storyboardDigest: '0'.repeat(64),
      actorOwnedAppearance: true, landmarkKindContract: true } }, REPLAN_REVIEW_MODEL);
  const payloadBytes = Buffer.byteLength(JSON.stringify(storyboard), 'utf8');
  const pins = (p: typeof storyboard) => ({ model: p.model, instructionSha256: sha(p.instructions), schemaName: p.text.format.name,
    schemaSha256: sha(JSON.stringify(p.text.format.schema)), maxOutputTokens: p.max_output_tokens, timeoutMs: generationTimeoutMs(p.max_output_tokens) });
  return {
    sourceDigest: source.sourceDigest,
    storyboard: { ...pins(storyboard), inputSha256: sha(storyboard.input), payloadBytes,
      contentBytes: Buffer.byteLength(storyboardCall.instructions, 'utf8') + Buffer.byteLength(storyboardCall.input, 'utf8') },
    review: { ...pins(reviewShape), maxPayloadBytes: BOOK_LIMITS.inputBytesPerCall },
    reservations: { storyboard: cacheAwareReservationMicroUsd(storyboard.model, payloadBytes, storyboard.max_output_tokens),
      review: cacheAwareReservationMicroUsd(reviewShape.model, BOOK_LIMITS.inputBytesPerCall, reviewShape.max_output_tokens) },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Grant: who approved what, the parent, the inherited ledger, pricing, pins, a cumulative cap and this exact scope.
// ---------------------------------------------------------------------------------------------------------------
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const absolute = z.string().min(3).max(500).refine(p => path.isAbsolute(p), 'absolute path');
const count = z.number().int().positive();
const callPins = { model: z.string(), instructionSha256: hash, schemaName: z.string(), schemaSha256: hash, maxOutputTokens: count, timeoutMs: count };
const rates = z.object({ ordinary: count, cacheRead: count, cacheWrite: count, output: count }).strict();
export const replanGrantSchema = z.object({
  version: z.literal(REPLAN_GRANT_VERSION),
  approvalReference: z.string().trim().min(30).max(2000),
  parent: z.object({ bookDir: absolute, storyboardDir: z.literal(PARENT_STORYBOARD_DIR), requestId: hash, sourceDigest: hash, storyboardDigest: hash,
    reviewDigest: hash, resultSha256: hash, draftSha256: hash, savedSourceSha256: hash }).strict(),
  replan: z.object({ sourceDigest: hash, actorOwnedAppearance: z.literal(true), landmarkKindContract: z.literal(LANDMARK_KIND_CONTRACT_VERSION),
    preservation: z.literal(STORYBOARD_PRESERVATION_VERSION), moments: z.literal('not_enabled'), pairPages: z.tuple([z.literal(4)]) }).strict(),
  payloads: z.object({
    storyboard: z.object({ ...callPins, inputSha256: hash, payloadBytes: count, contentBytes: count }).strict(),
    review: z.object({ ...callPins, maxPayloadBytes: count }).strict() }).strict(),
  executable: z.object({ files: z.array(z.object({ path: z.string(), sha256: hash }).strict()).length(REPLAN_EXECUTABLE_FILES.length) }).strict(),
  pricing: z.object({ version: z.literal(CACHE_AWARE_PRICING_VERSION), policy: z.literal(CACHE_POLICY),
    ratesTenthMicroUsdPerToken: z.object({ [REPLAN_PLANNER_MODEL]: rates, [REPLAN_REVIEW_MODEL]: rates }).strict(),
    bufferPercent: z.literal(RESERVATION_BUFFER_PERCENT), reservations: z.object({ storyboard: count, review: count }).strict() }).strict(),
  ledger: z.object({ priorKnownApiMicroUsd: z.number().int().nonnegative(),
    evidence: z.array(z.object({ file: absolute, sha256: hash }).strict()).min(1).max(16), note: z.string().min(10).max(1500) }).strict(),
  capMicroUsd: count, maxCalls: z.literal(2),
  scope: z.object({ stages: z.tuple([z.literal('storyboard'), z.literal('review')]), retries: z.literal(0), downstream: z.literal('none') }).strict(),
  out: absolute,
  deadlineMs: z.number().int().min(60000).max(3300000),
  claudeMax: z.literal(REPLAN_CLAUDE_MAX),
}).strict();
export type ReplanGrant = z.infer<typeof replanGrantSchema>;

const inside = (child: string, root: string) => {
  const c = path.resolve(child).toLowerCase(), r = path.resolve(root).toLowerCase();
  return c === r || c.startsWith(r.endsWith(path.sep) ? r : r + path.sep);
};

/** Offline only: reads the grant, the parent's files, the ledger evidence and the pinned executables. Never a key, client or provider. */
export function readReplanGrant(file: string, parent: ReplanParent, workspace: string, options: { allowDraft?: true } = {}) {
  const text = fencedText(file, 200000), raw = JSON.parse(text) as { version?: unknown };
  const draft = typeof raw?.version === 'string' && raw.version === `${REPLAN_GRANT_VERSION}-DRAFT`;
  if (draft && !options.allowDraft) fail('replan_grant_draft');
  const parsed = replanGrantSchema.safeParse(draft ? { ...raw, version: REPLAN_GRANT_VERSION } : raw);
  if (!parsed.success) return fail('replan_grant_invalid');
  const grant = parsed.data;
  const review = storyboardReviewDisposition(parent.book, parent.rawReview);
  if (path.resolve(grant.parent.bookDir).toLowerCase() !== path.resolve(parent.bookDir).toLowerCase() || grant.parent.requestId !== parent.requestId ||
      grant.parent.sourceDigest !== parent.book.sourceDigest || grant.parent.storyboardDigest !== parent.book.storyboardDigest ||
      review.disposition !== 'review_supported' || grant.parent.reviewDigest !== review.reviewDigest ||
      grant.parent.resultSha256 !== parent.files.result.sha256 || grant.parent.draftSha256 !== parent.files.draft.sha256 ||
      grant.parent.savedSourceSha256 !== sha(canonicalJson(parent.source))) fail('replan_grant_parent');
  const plan = replanPayloadPlan(parent);
  if (grant.replan.sourceDigest !== plan.sourceDigest || canonicalJson(grant.payloads.storyboard) !== canonicalJson(plan.storyboard) ||
      canonicalJson(grant.payloads.review) !== canonicalJson(plan.review)) fail('replan_grant_payload');
  if (canonicalJson(grant.executable.files.map(f => f.path)) !== canonicalJson(REPLAN_EXECUTABLE_FILES) ||
      grant.executable.files.some(f => sha(readFileSync(path.join(workspace, f.path))) !== f.sha256)) fail('replan_grant_executable');
  if (canonicalJson(grant.pricing.ratesTenthMicroUsdPerToken) !== canonicalJson({ [REPLAN_PLANNER_MODEL]: CACHE_AWARE_RATES[REPLAN_PLANNER_MODEL],
      [REPLAN_REVIEW_MODEL]: CACHE_AWARE_RATES[REPLAN_REVIEW_MODEL] }) || canonicalJson(grant.pricing.reservations) !== canonicalJson(plan.reservations))
    fail('replan_grant_pricing');
  for (const e of grant.ledger.evidence) if (!existsSync(e.file) || sha(readFileSync(e.file)) !== e.sha256) fail('replan_grant_evidence');
  // A grant extends only the ledger it names, by at most USD 8, and must cover both worst-case reservations.
  const prior = grant.ledger.priorKnownApiMicroUsd;
  if (grant.capMicroUsd <= prior || grant.capMicroUsd - prior > 8000000) fail('replan_grant_cap');
  if (grant.capMicroUsd < prior + plan.reservations.storyboard + plan.reservations.review) fail('replan_cap_too_low');
  // The new folder: never inside the protected parent book or this repository, and never an existing folder.
  if (inside(grant.out, parent.bookDir) || inside(grant.out, workspace) || !existsSync(path.dirname(grant.out))) fail('replan_out_fence');
  return { grant, sha256: sha(text), text, plan, draft };
}

// ---------------------------------------------------------------------------------------------------------------
// Runner: one storyboard call, one review call, journaled before dispatch; a new immutable folder.
// ---------------------------------------------------------------------------------------------------------------
export async function runStoryboardReplan(args: { parent: ReplanParent; grantFile: string; workspace: string; signal: AbortSignal;
  readKey: () => string; log: (line: string) => void; /** May only SHORTEN the granted deadline. */ deadlineMs?: number;
  /** May only LOWER the driver's per-call content limit (104,000 bytes). */ inputByteLimit?: number }) {
  const { grant, sha256: grantSha256, text: grantText, plan } = readReplanGrant(args.grantFile, args.parent, args.workspace);
  const deadlineMs = args.deadlineMs ?? grant.deadlineMs;
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > grant.deadlineMs) fail('replan_deadline_policy');
  if (args.inputByteLimit !== undefined && (!Number.isSafeInteger(args.inputByteLimit) || args.inputByteLimit < 1 ||
      args.inputByteLimit > SIMPLE_STORYBOARD_INPUT_LIMIT)) fail('replan_input_limit_policy');
  if (args.signal.aborted) fail('replan_cancelled');
  if (existsSync(grant.out)) fail('replan_out_exists');
  // Second fence on RESOLVED paths (junctions/aliases), before anything is created.
  const realOut = path.join(realpathSync.native(path.dirname(grant.out)), path.basename(grant.out));
  if (inside(realOut, realpathSync.native(args.parent.bookDir)) || inside(realOut, realpathSync.native(args.workspace))) fail('replan_out_fence');
  mkdirSync(grant.out); realDirectory(grant.out);
  const out = grant.out, save = (name: string, value: unknown) => exclusiveJson(path.join(out, name), value);
  exclusiveText(path.join(out, 'grant.json'), grantText);
  save('admission.json', { version: 'storyboard-replan-admission/v1', grantSha256, parent: grant.parent, replan: grant.replan, plan,
    pricing: grant.pricing, scope: grant.scope, deadlineMs, startedAt: new Date().toISOString() });
  const meter = new AuditionMeter(path.join(out, 'paid-stages'), grant.capMicroUsd, grant.maxCalls, grant.ledger.priorKnownApiMicroUsd);
  const controller = new AbortController(), cancel = () => controller.abort();
  args.signal.addEventListener('abort', cancel);
  let deadlineReached = false;
  const timer = setTimeout(() => { deadlineReached = true; controller.abort(); }, deadlineMs);
  const done: string[] = [];
  let stageCode: string | null = null, draft: unknown = null;
  // The driver reports a callback failure generically: keep the stage's own code (pre-claim refusals included).
  const generate = (call: SimpleStoryboardDiagnosticCall, signal: AbortSignal) =>
    stage(call, signal).catch(error => { stageCode ??= errorCode(error); throw error; });
  const stage = async (call: SimpleStoryboardDiagnosticCall, signal: AbortSignal) => {
    if (signal !== controller.signal) fail('replan_signal_binding');
    if (call.stage !== REPLAN_STAGES[done.length]) fail('replan_scope');
    const pins = grant.payloads[call.stage];
    let payload: ReturnType<typeof simpleWizardVisualPayload>;
    try { payload = simpleWizardVisualPayload(call, REPLAN_REVIEW_MODEL); }
    catch (error) { return fail(errorCode(error) === 'book_provider_input_limit' ? 'replan_provider_input_limit' : 'replan_payload_policy'); }
    const wireBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    if (payload.model !== pins.model || sha(payload.instructions) !== pins.instructionSha256 || payload.text.format.name !== pins.schemaName ||
        sha(JSON.stringify(payload.text.format.schema)) !== pins.schemaSha256 || payload.max_output_tokens !== pins.maxOutputTokens ||
        generationTimeoutMs(call.maxOutputTokens) !== pins.timeoutMs) fail('replan_payload_pins');
    if (call.stage === 'storyboard' && (sha(payload.input) !== grant.payloads.storyboard.inputSha256 || wireBytes !== grant.payloads.storyboard.payloadBytes))
      fail('replan_payload_pins');
    if (call.stage === 'review' && wireBytes > grant.payloads.review.maxPayloadBytes) fail('replan_provider_input_limit');
    const maximumMicroUsd = grant.pricing.reservations[call.stage];
    const value = await meter.run(call.stage, payload, maximumMicroUsd, async () => {
      // Claim and wire are durable before the credential read or client construction.
      const client = new OpenAI({ apiKey: args.readKey(), baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off' });
      let response: Awaited<ReturnType<typeof client.responses.create>>;
      // A transport/HTTP failure may still have been billed: its cost is unknown, which stops every later call.
      try { response = await client.responses.create(payload, { signal, timeout: pins.timeoutMs }); }
      catch (error) { throw Object.assign(new StoryboardReplanError('replan_provider_transport'), { cause: error, receipt: { raw: null, estimatedMicroUsd: null, stage: call.stage } }); }
      const usage = cacheAwareUsage(response.usage);
      const known = !!usage && response.model === payload.model && response.service_tier === 'default' && usage.inputTokens <= wireBytes;
      const estimatedMicroUsd = known ? cacheAwareCostMicroUsd(payload.model, usage) : null;
      const receipt = { raw: response, usage, estimatedMicroUsd, maximumMicroUsd, wireBytes, stage: call.stage,
        pricing: { version: CACHE_AWARE_PRICING_VERSION, policy: CACHE_POLICY } };
      const reject = (code: string): never => { throw Object.assign(new StoryboardReplanError(code), { receipt }); };
      if (estimatedMicroUsd !== null && estimatedMicroUsd > maximumMicroUsd) reject('replan_reservation_breach');
      if (estimatedMicroUsd === null) reject('replan_unknown_cost');
      if (response.status !== 'completed' || response.incomplete_details || response.error || !response.output_text ||
          usage!.outputTokens > call.maxOutputTokens) reject('replan_provider_incomplete');
      let raw: unknown;
      try { raw = JSON.parse(response.output_text); } catch { reject('replan_provider_json'); }
      try { return { value: decodePersonalBookProviderOutput(call, raw), estimatedMicroUsd, receipt }; }
      catch { return reject('replan_provider_schema'); }
    });
    done.push(call.stage);
    if (call.stage === 'storyboard') {
      // Kept and compared even if the draft later fails to compile or its review fails: paid evidence is never discarded.
      draft = value; save('owned_storyboard_draft.json', value);
      save('comparability.json', storyboardPreservationDiff(args.parent.draft, value, grant.replan.pairPages));
    }
    return value;
  };
  const seal = (status: string, extra: Record<string, unknown>) => {
    save('spend.json', meter.snapshot());
    const files = replanFiles(out).map(rel => {
      const bytes = readFileSync(path.join(out, ...rel.split('/')));
      return { path: rel, sha256: sha(bytes), bytes: bytes.length };
    });
    save(REPLAN_INDEX_FILE, { version: REPLAN_INDEX_VERSION, files });
    args.log(`${status}${Object.keys(extra).length ? ' ' + JSON.stringify(extra) : ''} · new API ≈ $${(meter.snapshot().newKnownApiMicroUsd / 1e6).toFixed(6)}`);
  };
  try {
    const result = await runSimpleStoryboardDiagnostic({ request: args.parent.request, writerResult: args.parent.source, options: args.parent.options,
      signal: controller.signal, generate, actorOwnedAppearance: true, landmarkKindContract: true, preservation: replanPreservation(args.parent),
      ...(args.inputByteLimit !== undefined ? { inputByteLimit: args.inputByteLimit } : {}) });
    if (done.length !== 2) fail('replan_scope');
    const { writerResult: _writer, ...storyboard } = result;
    save('visual_simple_book_result.json', { version: REPLAN_RESULT_VERSION, status: result.status, runtimeEligible: false,
      parent: { requestId: args.parent.book.requestId, sourceDigest: args.parent.book.sourceDigest, storyboardDigest: args.parent.book.storyboardDigest },
      replan: { preservation: STORYBOARD_PRESERVATION_VERSION, landmarkKind: LANDMARK_KIND_CONTRACT_VERSION, actorOwnedAppearance: true,
        pairPages: grant.replan.pairPages, grantSha256 }, source: args.parent.source, storyboard });
    seal(result.status, { storyboardDigest: result.storyboardDigest });
    return { status: result.status, storyboardDigest: result.storyboardDigest, comparability: read(path.join(out, 'comparability.json')), spend: meter.snapshot(), out };
  } catch (error) {
    const code = deadlineReached ? 'replan_deadline' : args.signal.aborted ? 'replan_cancelled' : stageCode ?? errorCode(error);
    save('failure.json', { status: 'incomplete', code, stageCode, driverCode: errorCode(error), completedStages: [...done], storyboardSaved: draft !== null,
      at: new Date().toISOString() });
    seal('incomplete', { code });
    throw Object.assign(new StoryboardReplanError(code), { cause: error });
  } finally {
    clearTimeout(timer); args.signal.removeEventListener('abort', cancel);
  }
}

/** Zero-provider admission and measurement: no grant needed; a supplied grant (draft allowed) is validated against the same pins. */
export function replanDryRun(bookDir: string, workspace = process.cwd(), grantFile?: string) {
  const parent = loadReplanParent(bookDir, workspace), plan = replanPayloadPlan(parent);
  const review = storyboardReviewDisposition(parent.book, parent.rawReview);
  const checked = grantFile ? readReplanGrant(grantFile, parent, workspace, { allowDraft: true }) : null;
  return { providerCalls: 0, keyRead: false, parent: { requestId: parent.requestId, sourceDigest: parent.book.sourceDigest,
    storyboardDigest: parent.book.storyboardDigest, reviewDigest: review.reviewDigest, resultSha256: parent.files.result.sha256,
    draftSha256: parent.files.draft.sha256, savedSourceSha256: sha(canonicalJson(parent.source)) }, plan,
    reservationsTotalMicroUsd: plan.reservations.storyboard + plan.reservations.review,
    executable: REPLAN_EXECUTABLE_FILES.map(p => ({ path: p, sha256: sha(readFileSync(path.join(workspace, p))) })),
    ...(checked ? { grant: { valid: true, draft: checked.draft, sha256: checked.sha256, capMicroUsd: checked.grant.capMicroUsd, out: checked.grant.out } } : {}) };
}

function argValue(name: string) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; }
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const bookDir = argValue('--book-dir') ?? fail('replan_args'), grantFile = argValue('--grant');
  if (!path.isAbsolute(bookDir!) || (grantFile !== undefined && !path.isAbsolute(grantFile))) fail('replan_args');
  if (!process.argv.includes('--execute')) console.log(JSON.stringify(replanDryRun(bookDir!, process.cwd(), grantFile), null, 2));
  else {
    const keyFile = argValue('--key-env-file') ?? fail('replan_args');
    if (!grantFile || !path.isAbsolute(keyFile!)) fail('replan_grant_required');
    const controller = new AbortController(); process.once('SIGINT', () => controller.abort());
    const started = Date.now();
    runStoryboardReplan({ parent: loadReplanParent(bookDir!), grantFile: grantFile!, workspace: process.cwd(), signal: controller.signal,
      readKey: keyReader(keyFile!), log: line => console.log(`[${((Date.now() - started) / 60000).toFixed(1)}m] ${line}`) })
      .then(result => console.log(JSON.stringify({ status: result.status, storyboardDigest: result.storyboardDigest,
        comparability: result.comparability.verdict, spend: result.spend, out: result.out }, null, 2)))
      .catch(error => { console.error('FAILED', error?.code ?? error?.message ?? error); process.exitCode = 1; });
  }
}

