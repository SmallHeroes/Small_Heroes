/**
 * ONE approved new-book engine experiment (Guy, 2026-10-12): a brand-new fictional book from scratch through the current experimental CLI,
 * in stages that each stop on their own gate:
 *   text  - Opus author + fresh Opus editor (Claude Max), blind Sol readers, Astra storyboard + Sol review (moments + landmark-kind contracts)
 *   child - the fictional child reference from its written design (no photo), pixel-judged; one targeted repair only for an evidenced defect
 *   grant - the audition grant for the remaining API allowance, with an early continuity sample (no provider)
 *   audition - the reviewed-audition runner on this book, guarded by the claim and source pin before every paid call: the sheets, the
 *     sample and, only if the sample is qa_supported, the rest of the book. Started once; --resume continues the same ledger.
 *   storyboard-continuation - Guy's one approved continuation after the storyboard call timed out: the paid story is replayed from its
 *     bound receipts (no new writer, editor or reader call) and only the storyboard and its review are called again, under a recorded
 *     amendment of the same claim, with the timed-out call's unknown cost carried as an unresolved reservation in the same $7.
 * Dry by default; nothing is retried; every paid call is journaled before dispatch.
 *   node --require ./scripts/shims/register-server-only.cjs --import tsx scripts/personal-new-book-experiment.ts \
 *     --config <abs config.json> <plan|text|storyboard-continuation|child|grant|audition> [--execute [--resume]]
 * Not production, customer, wizard or release authority. Every artifact is runtime-ineligible; acceptance is Guy's.
 */
import path from 'node:path';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { z } from 'zod';
import { gitAt } from './personal-source-git';
import { exclusiveJson, exclusiveText, fencedText, realDirectory } from './personal-causal-trial-journal';
import { CAUSAL_MODELS, createAstraCausalTransport, createOpusCausalTransport, prepareCausalWire, wireReservation, type CausalWire, type TransportReply,
  type WirePolicy } from './personal-causal-trial-adapters';
import type { CausalDispatch } from '../lib/personal-wizard/story-causal-experiment-runner';
import { safeUsage } from './personal-story-trial-guard';
import { longCallFetch, providerFailureCause, type LongCallObserver } from './personal-long-call-fetch';
import { simpleWizardVisualPayload } from './personal-simple-wizard-worker';
import { createSimpleBookPixelJudge } from './personal-simple-book-illustrator';
import { AuditionMeter, auditionAdapters, keyReader, loadReviewedBook, loadReviewedStoryboard, reviewedChildDesign, reviewedBookLayoutSchema,
  readReviewedBookLayout, runReviewedAudition, type AuditionGrant, type ReviewedBookLayout } from './personal-simple-book-reviewed-audition';
import { resolvePersonalWizardOptions } from '../lib/personal-wizard/options';
import { prepareSimpleStory } from '../lib/personal-wizard/simple-story-engine';
import { runSimpleWizardBook } from '../lib/personal-wizard/simple-book-flow';
import { SimpleBookBudget } from '../lib/personal-wizard/simple-book-budget';
import { decodePersonalBookProviderOutput } from '../lib/personal-wizard/book-openai';
import type { SimpleStoryboardDiagnosticCall } from '../lib/personal-wizard/simple-storyboard-diagnostic';
import { generationTimeoutMs } from '../lib/personal-wizard/story-config';
import { simpleChildReferencePrompt, simpleReferenceDesignContext, REFERENCE_REPAIR_EDIT_INSTRUCTION, type AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';
import { qualityDisposition } from '../lib/local-preview-quality';
import { previewSha } from '../lib/local-story-preview';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import type { PersonalStoryboard } from '../lib/personal-wizard/storyboard';
import { AUDITION_WORST_CASE_CALLS } from '../lib/personal-wizard/simple-book-reviewed-audition';

export class NewBookExperimentError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new NewBookExperimentError(code); };
const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const read = (file: string) => JSON.parse(fencedText(file, 32000000));

/**
 * The one approved experiment. A new book needs a new reviewed decision and code change, not a renamed configuration or folder.
 * The API cap is cumulative over every stage of THIS book; Claude Max (the Opus author/editor) is journaled and reported separately.
 */
export const NEW_BOOK_EXPERIMENT = Object.freeze({
  slot: 'new-book-20261012',
  apiCapMicroUsd: 7_000_000,
  approval: 'Guy 2026-10-12, AskUserQuestion on Decision Gate DECISION-GATE-NEW-BOOK-EXPERIMENT-20261012: Experimental CLI path; $7 API cap, staged, effective only after Codex QA of the offline build; continue automatically when the 2 sample pages pass the gates; Claude picks a new fictional child and a companion other than Dini. Claude Max is reported separately.',
  contracts: Object.freeze({ actorOwnedAppearance: true as const, momentContract: true as const, landmarkKindContract: true as const }),
  claudeMax: 'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger' as const,
  /** Guy: "a companion other than Dini". */
  excludedCompanions: Object.freeze(['dragon_dini']),
});
/**
 * Guy's one approved continuation of THIS book (2026-10-13): the storyboard call timed out (Node's default 300 s header wait, below the
 * call's own deadline). The story already paid for is reused exactly; only the storyboard and its review are called again; the timed-out
 * call's cost stays unknown and is carried in full as an unresolved reservation inside the same $7 cap. Once only.
 */
export const NEW_BOOK_CONTINUATION = Object.freeze({
  id: 'storyboard-continuation-1',
  outDir: 'text-continuation-1',
  approval: 'Guy 2026-10-13, AskUserQuestion after the storyboard timeout: "Approve fix + one retry" (offline transport fix, Codex QA, then one storyboard attempt and its review, then onward through the book within the same $7) and "Count the full $2.27" (the timed-out storyboard stays an unresolved reservation under the cap, not known spend).',
});
const SOL = 'gpt-6.1-sol' as const;
const RATES = { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 10, outputMicroUsdPerToken: 50 },
  sol: { inputMicroUsdPerToken: 2, outputMicroUsdPerToken: 10 } };
/** Paid API calls per stage: two readers + storyboard + review; child render + judge, repair render + judge. */
const TEXT_API_CALLS = 4, CHILD_API_CALLS = 4;
/** The continuation calls the storyboard and its review only. */
const CONTINUATION_API_CALLS = 2;

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const newBookConfigSchema = z.object({ version: z.literal('new-book-experiment-config/v1'), experiment: z.literal(NEW_BOOK_EXPERIMENT.slot),
  workspace: z.string().min(1), parent: z.string().min(1), sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  executable: z.string().min(1), executableSha256: hash, keyEnvFile: z.string().min(1),
  seed: z.string().min(1).max(120), childDesign: z.string().trim().min(20).max(1500), request: z.unknown() }).strict();
export type NewBookConfig = z.infer<typeof newBookConfigSchema>;

export function newBookConfig(file: string): NewBookConfig {
  if (!path.isAbsolute(file)) fail('new_book_config');
  const config = newBookConfigSchema.parse(JSON.parse(fencedText(file, 64000)));
  for (const p of [config.workspace, config.parent, config.executable, config.keyEnvFile]) if (!path.isAbsolute(p)) fail('new_book_config');
  realDirectory(config.workspace); realDirectory(config.parent);
  // The experiment never writes inside the source tree or its git metadata.
  const common = gitAt(config.workspace, ['rev-parse', '--path-format=absolute', '--git-common-dir']).toString().trim();
  for (const protectedRoot of [config.workspace, common]) {
    const relative = path.relative(protectedRoot, config.parent);
    if (!relative || !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) fail('new_book_inside_source');
  }
  return config;
}
export const experimentDir = (config: NewBookConfig) => path.join(config.parent, NEW_BOOK_EXPERIMENT.slot);
/** The committed, clean source the approval was reviewed at; checked before every stage. */
export function assertExperimentSource(config: NewBookConfig, head = config.sourceHead) {
  if (path.resolve(config.workspace).toLowerCase() !== path.resolve(process.cwd()).toLowerCase() ||
      gitAt(config.workspace, ['rev-parse', 'HEAD']).toString().trim() !== head ||
      gitAt(config.workspace, ['status', '--porcelain']).toString().trim()) fail('new_book_source_changed');
}
/** Routing for the reviewed-audition loader; every binding is recomputed from the saved files. */
export const experimentLayout = (config: NewBookConfig, childImage = 'reference_child.png', storyboardDir = 'text'): ReviewedBookLayout =>
  reviewedBookLayoutSchema.parse({ version: 'reviewed-book-layout/v1', seed: config.seed, childDesign: config.childDesign,
    storyboardDir, childDir: 'child', childImage, savedCompanion: null });
export function prepareExperimentRequest(config: NewBookConfig) {
  const options = resolvePersonalWizardOptions(config.workspace), prepared = prepareSimpleStory(config.request, options, config.seed);
  if (prepared.book.pages !== 8 || prepared.accepted.containsFixtureData || prepared.accepted.canonical.appearance.photo !== 'none') fail('new_book_request');
  if (NEW_BOOK_EXPERIMENT.excludedCompanions.includes(prepared.accepted.canonical.companion.id)) fail('new_book_companion_scope');
  return { options, prepared };
}

// ---------------------------------------------------------------------------------------------------------------
// The approval's durable claim: one record per approved slot in the repository's git common dir, outside every configurable path.
// It binds the experiment folder, the whole configuration and the source HEAD the first paid stage ran at. Every later stage and every
// paid call re-checks it, so another parent folder, an edited configuration or a moved HEAD cannot reopen or redirect the allowance.
// ---------------------------------------------------------------------------------------------------------------
export function experimentClaimFile(config: NewBookConfig) {
  const common = gitAt(config.workspace, ['rev-parse', '--path-format=absolute', '--git-common-dir']).toString().trim();
  realDirectory(common);
  return path.join(common, 'claude-new-book-experiments', `${NEW_BOOK_EXPERIMENT.slot}.claim.json`);
}
const claimSchema = z.object({ version: z.literal('new-book-experiment-claim/v1'), slot: z.literal(NEW_BOOK_EXPERIMENT.slot),
  approval: z.literal(NEW_BOOK_EXPERIMENT.approval), experimentDir: z.string().min(1), configSha256: hash, sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  requestId: hash }).strict();
const sameDir = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
/** Consumes the one approval before the first paid call. A claim that exists for any folder or configuration refuses. */
function claimExperiment(config: NewBookConfig, requestId: string) {
  const file = experimentClaimFile(config);
  if (existsSync(file)) fail('new_book_slot_used');
  if (!existsSync(path.dirname(file))) { try { mkdirSync(path.dirname(file)); } catch { if (!existsSync(path.dirname(file))) fail('new_book_claim'); } }
  try { exclusiveJson(file, claimSchema.parse({ version: 'new-book-experiment-claim/v1', slot: NEW_BOOK_EXPERIMENT.slot, approval: NEW_BOOK_EXPERIMENT.approval,
    experimentDir: path.resolve(experimentDir(config)), configSha256: sha(canonicalJson(config)), sourceHead: config.sourceHead, requestId })); }
  catch { fail('new_book_slot_used'); }
}
/** The original claim this configuration made, unchanged (no source check). */
function verifiedClaim(config: NewBookConfig) {
  const file = experimentClaimFile(config);
  if (!existsSync(file)) return fail('new_book_claim');
  const bytes = readFileSync(file), parsed = claimSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success || !sameDir(parsed.data.experimentDir, experimentDir(config)) || parsed.data.configSha256 !== sha(canonicalJson(config)) ||
      parsed.data.sourceHead !== config.sourceHead) return fail('new_book_claim');
  return { claim: parsed.data, claimSha256: sha(bytes) };
}
/**
 * The claim this configuration made, unchanged, and the source still at the pinned HEAD with a clean tree: the claim's own HEAD, or, after
 * the one recorded continuation amendment, the reviewed HEAD that amendment names (never an edited config). Checked before every paid call.
 */
export function assertExperimentClaim(config: NewBookConfig) {
  const { claim, claimSha256 } = verifiedClaim(config);
  const continuation = readContinuation(config, claimSha256);
  assertExperimentSource(config, continuation ? continuation.sourceHead : config.sourceHead);
  return { claim, claimSha256, continuation };
}

// ---------------------------------------------------------------------------------------------------------------
// The one continuation amendment: written once, beside the claim, binding the original claim and config, every original story/reader/
// storyboard record by hash, the unknown cost carried forward and the reviewed source the continuation runs at.
// ---------------------------------------------------------------------------------------------------------------
export const experimentContinuationFile = (config: NewBookConfig) =>
  path.join(path.dirname(experimentClaimFile(config)), `${NEW_BOOK_EXPERIMENT.slot}.continuation-1.json`);
const relativeFile = z.string().regex(/^(?:request\.json|text\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?)$/);
const continuationSchema = z.object({ version: z.literal('new-book-continuation/v1'), id: z.literal(NEW_BOOK_CONTINUATION.id),
  slot: z.literal(NEW_BOOK_EXPERIMENT.slot), approval: z.literal(NEW_BOOK_CONTINUATION.approval), claimSha256: hash, configSha256: hash,
  originalSourceHead: z.string().regex(/^[a-f0-9]{40}$/), sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  failedStep: z.literal('storyboard'), priorKnownApiMicroUsd: z.number().int().nonnegative(), carriedUnresolvedMicroUsd: z.number().int().positive(),
  evidence: z.array(z.object({ file: relativeFile, sha256: hash }).strict()).min(4).max(64) }).strict();
export type NewBookContinuation = z.infer<typeof continuationSchema>;
/** Every original text-stage record (and the request), by path relative to the slot: the continuation's evidence. */
function originalTextEvidence(dir: string) {
  const files = ['request.json'];
  const walk = (rel: string) => { for (const name of readdirSync(path.join(dir, rel)).sort()) {
    const r = `${rel}/${name}`, st = lstatSync(path.join(dir, r));
    if (st.isSymbolicLink()) fail('new_book_continuation_evidence');
    if (st.isDirectory()) walk(r); else files.push(r);
  } };
  walk('text');
  return files.map(file => ({ file, sha256: sha(readFileSync(path.join(dir, ...file.split('/')))) }));
}
function readContinuation(config: NewBookConfig, claimSha256: string): NewBookContinuation | null {
  const file = experimentContinuationFile(config);
  if (!existsSync(file)) return null;
  const parsed = continuationSchema.safeParse(read(file));
  if (!parsed.success || parsed.data.claimSha256 !== claimSha256 || parsed.data.configSha256 !== sha(canonicalJson(config)) ||
      parsed.data.originalSourceHead !== config.sourceHead) return fail('new_book_continuation');
  // The original records are exactly those the amendment bound (nothing rewritten, added or removed since).
  if (canonicalJson(originalTextEvidence(experimentDir(config))) !== canonicalJson(parsed.data.evidence)) fail('new_book_continuation_evidence');
  return parsed.data;
}
/**
 * The storyboard call timed out (the only failure Guy's continuation covers): this transport's own record, or the record the first run
 * wrote before the transport fix (the SDK's generic failure with its timeout message and no provider answer).
 */
const timedOutStoryboard = (failure: { code?: unknown; message?: unknown; receipt?: unknown }) => failure.code === 'new_book_provider_timeout' ||
  failure.code === 'audition_stage_failed' && failure.message === 'Request timed out.' && failure.receipt === null;
/** The original text stage's ledger as it ended: every call settled except the storyboard, which timed out and whose cost is unknown (its claimed maximum). */
function failedStoryboardLedger(textDir: string) {
  const root = path.join(textDir, 'paid-stages');
  const snapshot = new AuditionMeter(root, NEW_BOOK_EXPERIMENT.apiCapMicroUsd, TEXT_API_CALLS).snapshot();
  const spend = path.join(textDir, 'spend.json');
  if (!existsSync(spend) || canonicalJson(read(spend)) !== canonicalJson(snapshot)) fail('new_book_ledger_record');
  const claims = readdirSync(root).filter(n => n.endsWith('.claim.json')).map(n => n.slice(0, -'.claim.json'.length)).sort();
  if (canonicalJson(claims) !== canonicalJson(['comparison', 'final_review', 'storyboard']) || !existsSync(path.join(root, 'storyboard.failure.json'))) fail('new_book_continuation_scope');
  const storyboard = read(path.join(root, 'storyboard.claim.json')), result = read(path.join(root, 'storyboard.result.json'));
  if (snapshot.unknownOutcome || snapshot.unknownCost !== 1 || result.completed !== false || result.estimatedMicroUsd !== null || snapshot.reservedUnsettledMicroUsd !== storyboard.maximumMicroUsd ||
      !timedOutStoryboard(read(path.join(root, 'storyboard.failure.json')))) fail('new_book_continuation_scope');
  return { knownMicroUsd: snapshot.newKnownApiMicroUsd, carriedUnresolvedMicroUsd: storyboard.maximumMicroUsd as number };
}
/** Records the one continuation (exclusive). Refuses unless the original text stage failed exactly at an unanswered storyboard call. */
function amendForContinuation(config: NewBookConfig) {
  const { claimSha256 } = verifiedClaim(config);
  const file = experimentContinuationFile(config), dir = experimentDir(config), textDir = path.join(dir, 'text');
  if (existsSync(file)) return readContinuation(config, claimSha256)!;
  const head = gitAt(config.workspace, ['rev-parse', 'HEAD']).toString().trim();
  assertExperimentSource(config, head);
  if (sealedStatus(textDir) !== 'failed' || existsSync(path.join(dir, NEW_BOOK_CONTINUATION.outDir))) fail('new_book_continuation_scope');
  for (const stage of ['author', 'editor']) {
    const result = read(path.join(textDir, 'claude-max-stages', `${stage}.result.json`));
    if (result.completed !== true) fail('new_book_continuation_scope');
  }
  const ledger = failedStoryboardLedger(textDir);
  const amendment = continuationSchema.parse({ version: 'new-book-continuation/v1', id: NEW_BOOK_CONTINUATION.id, slot: NEW_BOOK_EXPERIMENT.slot,
    approval: NEW_BOOK_CONTINUATION.approval, claimSha256, configSha256: sha(canonicalJson(config)), originalSourceHead: config.sourceHead, sourceHead: head,
    failedStep: 'storyboard', priorKnownApiMicroUsd: ledger.knownMicroUsd, carriedUnresolvedMicroUsd: ledger.carriedUnresolvedMicroUsd,
    evidence: originalTextEvidence(dir) });
  try { exclusiveJson(file, amendment); } catch { fail('new_book_continuation_used'); }
  return amendment;
}
/** Where this book's reviewed text lives now, and its verified API ledger (known spend and any carried unresolved reservation). */
export function textStage(config: NewBookConfig, continuation: NewBookContinuation | null) {
  const dir = experimentDir(config);
  if (!continuation) {
    const ledger = stageLedger(path.join(dir, 'text'), TEXT_API_CALLS);
    return { folder: 'text', path: path.join(dir, 'text'), knownMicroUsd: ledger.knownMicroUsd, carriedUnresolvedMicroUsd: 0, evidence: [{ file: ledger.file, sha256: ledger.sha256 }] };
  }
  const original = failedStoryboardLedger(path.join(dir, 'text'));
  if (original.knownMicroUsd !== continuation.priorKnownApiMicroUsd || original.carriedUnresolvedMicroUsd !== continuation.carriedUnresolvedMicroUsd) fail('new_book_continuation_ledger');
  const out = path.join(dir, NEW_BOOK_CONTINUATION.outDir);
  const ledger = stageLedger(out, CONTINUATION_API_CALLS, continuation.priorKnownApiMicroUsd, continuation.carriedUnresolvedMicroUsd);
  const amendment = experimentContinuationFile(config);
  return { folder: NEW_BOOK_CONTINUATION.outDir, path: out, knownMicroUsd: continuation.priorKnownApiMicroUsd + ledger.knownMicroUsd,
    carriedUnresolvedMicroUsd: continuation.carriedUnresolvedMicroUsd,
    evidence: [{ file: path.join(dir, 'text', 'spend.json'), sha256: sha(readFileSync(path.join(dir, 'text', 'spend.json'))) },
      { file: amendment, sha256: sha(readFileSync(amendment)) }, { file: ledger.file, sha256: ledger.sha256 }] };
}
/** The verified API spend of one finished stage (after the earlier stages' `prior`): no unknown cost or outcome, and it equals the stage's saved spend record. */
export function stageLedger(stageDir: string, maxCalls: number, prior = 0, carried = 0) {
  const snapshot = new AuditionMeter(path.join(stageDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, maxCalls, prior, carried).snapshot();
  if (snapshot.unknownCost || snapshot.unknownOutcome) fail('new_book_ledger_unknown');
  const file = path.join(stageDir, 'spend.json');
  if (!existsSync(file) || canonicalJson(read(file)) !== canonicalJson(snapshot)) fail('new_book_ledger_record');
  return { knownMicroUsd: snapshot.newKnownApiMicroUsd, file, sha256: sha(readFileSync(file)) };
}
const codeOf = (error: unknown, fallback: string) =>
  error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[a-z0-9_]+$/.test(error.code) ? error.code : fallback;
const sealedStatus = (stageDir: string) => existsSync(path.join(stageDir, 'sealed.json')) ? read(path.join(stageDir, 'sealed.json')).status : null;

// ---------------------------------------------------------------------------------------------------------------
// Stage 1: story and storyboard.
// ---------------------------------------------------------------------------------------------------------------
type OpusTransport = (wire: CausalWire, call: CausalDispatch, signal: AbortSignal) => Promise<TransportReply>;
type Responses = (payload: ReturnType<typeof simpleWizardVisualPayload>, signal: AbortSignal, timeout: number, observe?: LongCallObserver) =>
  Promise<OpenAI.Responses.Response>;
export type TextTransports = { opus?: OpusTransport; reader?: OpusTransport; responses?: Responses };
/** A transport backstop above every text-stage deadline (the SDK's own per-call timeout governs; this only bounds a stalled body). */
const TEXT_BACKSTOP_MS = generationTimeoutMs(55_000) + 60_000;
/** Saved, bound replies of the original story calls: a replay re-derives each call exactly and returns its paid reply (no new call). */
type TextReplay = { opus: (call: CausalDispatch, wire: CausalWire) => TransportReply; reader: (call: CausalDispatch, wire: CausalWire) => unknown };

function textReplay(textDir: string): TextReplay {
  const saved = (folder: string, stage: string, digest: string) => {
    const at = (k: string) => path.join(textDir, folder, `${stage}.${k}.json`);
    if (!['wire', 'claim', 'result', 'receipt'].every(k => existsSync(at(k)))) fail('new_book_continuation_replay');
    const claim = read(at('claim')), result = read(at('result'));
    if (claim.wireDigest !== digest || result.wireDigest !== digest || result.completed !== true || !Number.isSafeInteger(result.estimatedMicroUsd)) fail('new_book_continuation_replay');
    const receipt = read(at('receipt'));
    if (receipt?.estimatedMicroUsd !== result.estimatedMicroUsd) fail('new_book_continuation_replay');
    return receipt;
  };
  return {
    // Opus: the same instructions file, the same wire (journaled as {...wire, payload}), then the saved reply.
    opus: (call, wire) => {
      if (fencedText(String(wire.payload.instructionFile), 104_000) !== call.instructions) fail('new_book_continuation_replay');
      return saved('claude-max-stages', call.stage, sha(canonicalJson({ ...wire, payload: wire.payload }))) as TransportReply;
    },
    reader: (call, wire) => (saved('paid-stages', call.stage, previewSha(canonicalJson(wire))) as TransportReply).output,
  };
}

/** The story calls' wire policy (the first run's own; a replay rebuilds the identical wires from it). */
const textPolicy = (config: NewBookConfig): WirePolicy => ({ executable: config.executable, executableSha256: config.executableSha256,
  workspace: path.join(experimentDir(config), 'text', 'cli-workspace'), maxWireBytes: 104000, rates: { opus: RATES.opus, astra: RATES.sol }, openAIReviewModel: SOL });
const storyDispatch = <T extends { stage: string }>(call: T, role: 'opus' | 'astra', requestId: string) =>
  ({ ...call, role, conversationKey: `new-book:${requestId}:${call.stage}` });

/** The story and storyboard flow, shared by the first run and its one continuation (which replays the paid story calls). */
async function textCore(args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void;
  contracts: { actorOwnedAppearance?: true; momentContract?: true; landmarkKindContract?: true }; transports?: TextTransports;
  prepared: ReturnType<typeof prepareExperimentRequest>['prepared']; options: ReturnType<typeof prepareExperimentRequest>['options'];
  outDir: string; api: AuditionMeter; claudeMax: SimpleBookBudget | null; replay: TextReplay | null }) {
  const { config, signal, prepared, outDir, api, claudeMax, replay } = args;
  const textDir = path.join(experimentDir(config), 'text');
  const request = prepared.accepted.canonical;
  const key = keyReader(config.keyEnvFile);
  const policy = textPolicy(config);
  const opus = args.transports?.opus ?? createOpusCausalTransport(policy);
  // Long provider calls go through the long-call transport: no 300 s header wait below their own deadline.
  const reader = args.transports?.reader ?? createAstraCausalTransport({ key, rates: RATES.sol, model: SOL, fetch: longCallFetch(TEXT_BACKSTOP_MS) });
  const responses: Responses = args.transports?.responses ?? (async (payload, s, timeout, observe) =>
    new OpenAI({ apiKey: key(), baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off', fetch: longCallFetch(timeout + 60_000, observe) })
      .responses.create(payload, { signal: s, timeout }));
  const check = () => { if (signal.aborted) fail('new_book_cancelled'); assertExperimentClaim(config); };
  let storyboardDraft: unknown = null;
  // The first failed paid call's own code is the stage's cause (the story/storyboard layers re-wrap callback errors).
  let failedStageCode: string | null = null;
  const recordFailure = (error: unknown): never => { failedStageCode ??= codeOf(error, 'new_book_provider_transport'); throw error; };
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    exclusiveJson(path.join(outDir, 'spend.json'), api.snapshot());
    if (claudeMax) exclusiveJson(path.join(outDir, 'claude-max-spend.json'), { ...claudeMax.snapshot(), note: NEW_BOOK_EXPERIMENT.claudeMax });
    exclusiveJson(path.join(outDir, 'sealed.json'), { status, ...extra, ...(replay ? { continuation: NEW_BOOK_CONTINUATION.id } : {}), runtimeEligible: false });
  };
  try {
    const result = await runSimpleWizardBook({ request, options: args.options, seed: config.seed, signal, reservedWritingUsd: 4, ...args.contracts,
      publish: view => args.log(`phase ${view.phase}`),
      opus: async (call, s) => {
        check();
        const dispatch = storyDispatch(call, 'opus', prepared.accepted.requestId);
        const instructionFile = path.join(textDir, `${call.stage}-instructions.txt`);
        if (replay) { try { return replay.opus(dispatch, prepareCausalWire(dispatch, policy, 2000000, instructionFile)); } catch (error) { return recordFailure(error); } }
        exclusiveText(instructionFile, call.instructions);
        const wire = prepareCausalWire(dispatch, policy, 2000000, instructionFile);
        // The CLI's own --max-budget-usd 2 bounds each session; journaled as Claude Max, never against the API cap.
        return claudeMax!.run(call.stage, { ...wire, payload: wire.payload }, 2000000, async () => {
          const reply = await opus(wire, dispatch, s);
          return { value: reply, estimatedMicroUsd: reply.estimatedMicroUsd, receipt: reply };
        }).catch(recordFailure);
      },
      reader: async (call, s) => {
        check();
        const dispatch = storyDispatch(call, 'astra', prepared.accepted.requestId);
        const wire = prepareCausalWire(dispatch, policy, 2000000);
        if (replay) { try { return replay.reader(dispatch, wire); } catch (error) { return recordFailure(error); } }
        return api.run(call.stage, wire, wire.reservedMicroUsd, async () => {
          const reply = await reader(wire, dispatch, s);
          return { value: reply.output, estimatedMicroUsd: reply.estimatedMicroUsd, receipt: reply };
        }).catch(recordFailure);
      },
      visual: async (call: SimpleStoryboardDiagnosticCall, s: AbortSignal) => {
        check();
        const payload = simpleWizardVisualPayload(call, SOL);
        const wireBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8'); if (wireBytes > 128000) fail('new_book_wire_limit');
        const rate = call.stage === 'review' ? RATES.sol : RATES.astra, step = call.stage === 'review' ? 'storyboard_review' : 'storyboard';
        return api.run(step, payload, wireReservation(wireBytes, call.maxOutputTokens, rate), async () => {
          const observed: unknown[] = [];
          let response: OpenAI.Responses.Response;
          // A failed call keeps its low-level cause (the SDK drops a timeout's cause; the transport reported it as it happened).
          try { response = await responses(payload, s, generationTimeoutMs(call.maxOutputTokens), failure => observed.push(failure)); }
          catch (error) {
            const cause = providerFailureCause(error);
            throw Object.assign(new NewBookExperimentError(cause.sdkError === 'APIConnectionTimeoutError' ? 'new_book_provider_timeout' : 'new_book_provider_transport'),
              { receipt: { estimatedMicroUsd: null, failure: cause, observed } });
          }
          const usage = safeUsage(response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null);
          const estimatedMicroUsd = usage && response.model === payload.model && response.service_tier === 'default'
            ? Math.ceil(usage.inputTokens * rate.inputMicroUsdPerToken + usage.outputTokens * rate.outputMicroUsdPerToken) : null;
          const receipt = { raw: response, usage, estimatedMicroUsd, model: response.model, stage: step };
          if (s.aborted || response.model !== payload.model || response.service_tier !== 'default' || response.status !== 'completed' ||
              !response.output_text || !usage || usage.outputTokens > call.maxOutputTokens) throw Object.assign(new NewBookExperimentError('new_book_provider_invalid'), { receipt });
          let output: unknown;
          try { output = decodePersonalBookProviderOutput(call, JSON.parse(response.output_text)); }
          catch { throw Object.assign(new NewBookExperimentError('new_book_provider_schema'), { receipt }); }
          if (call.stage === 'storyboard') storyboardDraft = output;
          return { value: output, estimatedMicroUsd, receipt };
        }).catch(recordFailure);
      } });
    check();
    exclusiveJson(path.join(outDir, 'simple-book-result.json'), result);
    exclusiveText(path.join(outDir, 'story.md'), `# ${result.source.manuscript.title}\n\n` +
      result.source.manuscript.pages.map(p => `## עמוד ${p.pageNumber}\n\n${p.text}`).join('\n\n') + '\n');
    if (result.storyboard) {
      // The reviewed-audition loader's inputs: the whole result and the planner's own draft, both recompiled and bound there.
      exclusiveJson(path.join(outDir, 'visual_simple_book_result.json'), result);
      exclusiveJson(path.join(outDir, 'owned_storyboard_draft.json'), storyboardDraft ?? fail('new_book_draft_missing'));
    }
    seal(result.status);
    return { status: result.status, api: api.snapshot(), claudeMax: claudeMax?.snapshot() ?? null };
  } catch (error) {
    if (!existsSync(path.join(outDir, 'sealed.json'))) seal('failed', { code: failedStageCode ?? codeOf(error, 'new_book_text_failed') });
    throw error;
  }
}

export async function runNewBookText(args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void;
  contracts: { actorOwnedAppearance?: true; momentContract?: true; landmarkKindContract?: true }; transports?: TextTransports }) {
  const { config } = args;
  assertExperimentSource(config);
  if (!args.transports?.opus && sha(readFileSync(config.executable)) !== config.executableSha256) fail('new_book_executable_changed');
  const { options, prepared } = prepareExperimentRequest(config);
  const dir = experimentDir(config), textDir = path.join(dir, 'text');
  // Single use: the approval is claimed once (any folder), then the slot folder is created exactly once. A folder that already exists
  // is refused before the claim, so it never consumes the approval.
  if (existsSync(dir)) fail('new_book_slot_used');
  claimExperiment(config, prepared.accepted.requestId);
  try { mkdirSync(dir); } catch { fail('new_book_slot_used'); }
  mkdirSync(textDir); mkdirSync(path.join(textDir, 'cli-workspace'));
  exclusiveJson(path.join(dir, 'request.json'), { version: 'local-simple-wizard-request/v1', requestId: prepared.accepted.requestId,
    optionsFingerprint: prepared.accepted.optionsFingerprint, consent: 'fictional_profile_new_book_experiment', experiment: NEW_BOOK_EXPERIMENT.slot,
    request: prepared.accepted.canonical });
  return textCore({ ...args, prepared, options, outDir: textDir, api: new AuditionMeter(path.join(textDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, TEXT_API_CALLS),
    claudeMax: new SimpleBookBudget(path.join(textDir, 'claude-max-stages'), 0), replay: null });
}

/**
 * Read-only preview of the continuation (no amendment, no folder, no provider call, no key): it must be admissible, the paid story must
 * replay exactly from its bound receipts, and the storyboard request it then builds must be exactly the one that timed out (the digest
 * its claim recorded before that call was sent). The continuation runs this first, so a mismatch never uses the one attempt.
 */
export async function previewStoryboardContinuation(config: NewBookConfig) {
  const { claimSha256 } = verifiedClaim(config);
  const head = gitAt(config.workspace, ['rev-parse', 'HEAD']).toString().trim();
  assertExperimentSource(config, readContinuation(config, claimSha256)?.sourceHead ?? head);
  const dir = experimentDir(config), textDir = path.join(dir, 'text');
  if (sealedStatus(textDir) !== 'failed') fail('new_book_continuation_scope');
  const ledger = failedStoryboardLedger(textDir), { options, prepared } = prepareExperimentRequest(config);
  const policy = textPolicy(config), replay = textReplay(textDir);
  let reachedStoryboard = false, sameRequest = false, refusal: unknown = null;
  const timedOut = read(path.join(textDir, 'paid-stages', 'storyboard.claim.json'));
  const replayed = <T>(f: () => T) => { try { return f(); } catch (error) { refusal ??= error; throw error; } };
  const result = await runSimpleWizardBook({ request: prepared.accepted.canonical, options, seed: config.seed, signal: new AbortController().signal,
    reservedWritingUsd: 4, ...NEW_BOOK_EXPERIMENT.contracts, publish: () => {},
    opus: async call => { const d = storyDispatch(call, 'opus', prepared.accepted.requestId);
      return replayed(() => replay.opus(d, prepareCausalWire(d, policy, 2000000, path.join(textDir, `${call.stage}-instructions.txt`)))); },
    reader: async call => { const d = storyDispatch(call, 'astra', prepared.accepted.requestId);
      return replayed(() => replay.reader(d, prepareCausalWire(d, policy, 2000000))); },
    visual: async (call: SimpleStoryboardDiagnosticCall) => {
      reachedStoryboard = true;
      sameRequest = call.stage === 'storyboard' && previewSha(canonicalJson(simpleWizardVisualPayload(call, SOL))) === timedOut.wireDigest;
      throw new NewBookExperimentError('new_book_continuation_preview_stop');
    } })
    .catch(error => { if (!reachedStoryboard) throw refusal ?? error; return null; });
  if (!reachedStoryboard) return fail(result?.status === 'story_held' ? 'new_book_continuation_story_held' : 'new_book_continuation_scope');
  if (!sameRequest) fail('new_book_continuation_request');
  return { admissible: true, amended: !!readContinuation(config, claimSha256), outDirExists: existsSync(path.join(dir, NEW_BOOK_CONTINUATION.outDir)),
    storyReplayed: true, sameStoryboardRequest: true, priorKnownApiMicroUsd: ledger.knownMicroUsd, carriedUnresolvedMicroUsd: ledger.carriedUnresolvedMicroUsd,
    remainingUnderCapMicroUsd: NEW_BOOK_EXPERIMENT.apiCapMicroUsd - ledger.knownMicroUsd - ledger.carriedUnresolvedMicroUsd,
    providerCalls: 0, keyRead: false };
}

/**
 * Guy's one continuation: recorded once as an amendment of the same claim, it replays the paid story calls from their bound receipts and
 * calls only the storyboard and its review again, in a new folder whose meter carries the earlier known spend and the timed-out call's
 * full unknown reservation. The original failed records stay untouched.
 */
export async function runNewBookStoryboardContinuation(args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void;
  contracts: { actorOwnedAppearance?: true; momentContract?: true; landmarkKindContract?: true }; transports?: TextTransports }) {
  const { config } = args;
  await previewStoryboardContinuation(config);
  amendForContinuation(config);
  const { continuation } = assertExperimentClaim(config);
  if (!continuation) return fail('new_book_continuation');
  const dir = experimentDir(config), outDir = path.join(dir, NEW_BOOK_CONTINUATION.outDir);
  const { options, prepared } = prepareExperimentRequest(config);
  if (canonicalJson(read(path.join(dir, 'request.json')).request) !== canonicalJson(prepared.accepted.canonical)) fail('new_book_continuation_scope');
  try { mkdirSync(outDir); } catch { fail('new_book_continuation_used'); }
  return textCore({ ...args, prepared, options, outDir,
    api: new AuditionMeter(path.join(outDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, CONTINUATION_API_CALLS,
      continuation.priorKnownApiMicroUsd, continuation.carriedUnresolvedMicroUsd),
    claudeMax: null, replay: textReplay(path.join(dir, 'text')) });
}

// ---------------------------------------------------------------------------------------------------------------
// Stage 2: the fictional child reference.
// ---------------------------------------------------------------------------------------------------------------
type Render = (step: string, prompt: string, refs: AuditionImage[], mode: 'identity') => Promise<AuditionImage>;
type Judge = (step: string, candidate: AuditionImage, context: unknown, contextSha: string, refs: AuditionImage[], predecessor: AuditionImage | null) => Promise<unknown>;
export type ChildAdapters = { render?: Render; judge?: Judge };

export async function runNewBookChild(args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void; adapters?: ChildAdapters }) {
  const { config, signal } = args;
  const { continuation } = assertExperimentClaim(config);
  const dir = experimentDir(config), childDir = path.join(dir, 'child'), images = path.join(childDir, 'illustrations');
  realDirectory(dir);
  // The reviewed text is the continuation's when the one approved continuation ran.
  if (sealedStatus(path.join(dir, continuation ? NEW_BOOK_CONTINUATION.outDir : 'text')) !== 'review_supported') fail('new_book_text_not_supported');
  const prior = textStage(config, continuation);
  const layoutFor = (childImage?: string) => experimentLayout(config, childImage, prior.folder);
  const loaded = loadReviewedStoryboard(dir, config.workspace, layoutFor());
  try { mkdirSync(childDir); } catch { fail('new_book_child_used'); }
  mkdirSync(images);
  const meter = new AuditionMeter(path.join(childDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, CHILD_API_CALLS, prior.knownMicroUsd,
    prior.carriedUnresolvedMicroUsd);
  const save = (name: string, value: unknown) => exclusiveJson(path.join(childDir, `${name}.json`), value);
  const check = () => { if (signal.aborted) fail('new_book_cancelled'); assertExperimentClaim(config); };
  const key = keyReader(config.keyEnvFile);
  // The claim and source pin guard every render claim too (including the one repair edit after a judgment).
  const io = args.adapters?.render ? null : auditionAdapters({ directory: images, meter, key, signal, guard: () => { assertExperimentClaim(config); } });
  const render: Render = args.adapters?.render ?? ((step, prompt, refs, mode) => io!.render(step, prompt, refs, mode));
  const judge: Judge = args.adapters?.judge ?? createSimpleBookPixelJudge({ config: { reviewModel: SOL }, directory: images, budget: meter, key,
    assertCurrent: check, signal, save });
  const context = simpleReferenceDesignContext(reviewedChildDesign(loaded.prepared, loaded.book, layoutFor()));
  const contextSha = previewSha(JSON.stringify(context));
  const prompt = simpleChildReferencePrompt(loaded.prepared.brief.child.age, loaded.prepared.brief.child.address, config.childDesign, loaded.book.plan.wardrobe);
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    save('spend', meter.snapshot()); save('sealed', { status, ...extra, priorTextApiMicroUsd: prior.knownMicroUsd,
      ...(prior.carriedUnresolvedMicroUsd ? { carriedUnresolvedMicroUsd: prior.carriedUnresolvedMicroUsd } : {}), runtimeEligible: false });
  };
  try {
    check();
    let candidate = await render('reference_child', prompt, [], 'identity'); check();
    let review = qualityDisposition(await judge('reference_child_qa', candidate, context, contextSha, [], null), candidate.imageSha, contextSha);
    save('reference_child_review', review); args.log(`child reference: ${review.disposition}`);
    // One targeted edit, only for an evidenced defect; an uncertain judgment is held, never redrawn.
    if (review.disposition === 'repair') {
      const corrections = review.review.checks.filter(c => c.verdict === 'defect').map(c => `${c.category}: ${c.correction}`).join('\n');
      const rejected = candidate;
      candidate = await render('reference_child_repair', `${prompt}\n${REFERENCE_REPAIR_EDIT_INSTRUCTION}\nTARGETED CORRECTIONS:\n${corrections}`, [rejected], 'identity');
      check(); if (candidate.imageSha === rejected.imageSha) fail('new_book_child_repair_unchanged');
      review = qualityDisposition(await judge('reference_child_repair_qa', candidate, context, contextSha, [], null), candidate.imageSha, contextSha);
      save('reference_child_repair_review', review); args.log(`child reference repair: ${review.disposition}`);
    }
    if (review.disposition !== 'passed') { seal('child_reference_held', { disposition: review.disposition }); return { status: 'child_reference_held' as const }; }
    save('reference_child_adoption', { name: 'child', context, review: review.review, candidate, authority: 'new_book_experiment_reviewed_passed' });
    exclusiveJson(path.join(dir, 'book-layout.json'), layoutFor(candidate.imageName));
    seal('child_reference_passed', { candidate });
    return { status: 'child_reference_passed' as const, candidate };
  } catch (error) {
    if (!existsSync(path.join(childDir, 'sealed.json'))) seal('failed', { code: codeOf(error, 'new_book_child_failed') });
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Stage 3: the audition grant (no provider).
// ---------------------------------------------------------------------------------------------------------------
/** The earliest two narrative pages in one scene (the second compares with the first); a book without one samples pages 1-2. */
export function earliestSameScenePair(book: Pick<PersonalStoryboard, 'narrativeSpreads' | 'sequence'>): [number, number] {
  const seq = book.sequence.pages;
  for (let page = 1; page < book.narrativeSpreads; page++) if (seq[page].sceneId === seq[page - 1].sceneId) return [page, page + 1];
  return [1, 2];
}

export function writeNewBookGrant(config: NewBookConfig) {
  const { claimSha256, continuation } = assertExperimentClaim(config);
  const dir = experimentDir(config), childDir = path.join(dir, 'child'), textFolder = continuation ? NEW_BOOK_CONTINUATION.outDir : 'text';
  if (sealedStatus(path.join(dir, textFolder)) !== 'review_supported' || sealedStatus(childDir) !== 'child_reference_passed') fail('new_book_stage_not_passed');
  const layout = readReviewedBookLayout(path.join(dir, 'book-layout.json'));
  if (canonicalJson(layout) !== canonicalJson(experimentLayout(config, layout.childImage, textFolder))) fail('new_book_layout');
  const loaded = loadReviewedBook(dir, config.workspace, undefined, layout);
  const text = textStage(config, continuation);
  const child = stageLedger(childDir, CHILD_API_CALLS, text.knownMicroUsd, text.carriedUnresolvedMicroUsd);
  const prior = text.knownMicroUsd + child.knownMicroUsd, carried = text.carriedUnresolvedMicroUsd;
  if (prior + carried >= NEW_BOOK_EXPERIMENT.apiCapMicroUsd) fail('new_book_budget_exhausted');
  const grant: AuditionGrant = { version: 'audition-spend-grant/v1', approvalReference: NEW_BOOK_EXPERIMENT.approval,
    book: { requestId: loaded.queued.requestId, storyboardDigest: loaded.book.storyboardDigest },
    ledger: { priorKnownApiMicroUsd: prior, ...(carried ? { carriedUnresolvedMicroUsd: carried } : {}),
      evidence: [...text.evidence, { file: child.file, sha256: child.sha256 }],
      note: carried
        ? `New-book experiment ledger under the one $7 API cap: known spend of the text stage, its continuation and the child reference, plus the timed-out storyboard call's cost, still unknown, carried in full as an unresolved reservation (never known spend). The Goni book's ledger is separate and unchanged.`
        : `New-book experiment ledger: starts at $0 for this book under the one $7 API cap; text stage and child reference recorded above. The Goni book's ledger is separate and unchanged.` },
    capMicroUsd: NEW_BOOK_EXPERIMENT.apiCapMicroUsd, maxCalls: AUDITION_WORST_CASE_CALLS,
    scope: { mode: 'render', pages: [0, 1, 2, 3, 4, 5, 6, 7, 8], sample: earliestSameScenePair(loaded.book) },
    claudeMax: NEW_BOOK_EXPERIMENT.claudeMax,
    // Usable only through this experiment's guarded audition stage (never a bare runner with another output folder).
    experiment: { slot: NEW_BOOK_EXPERIMENT.slot, claimSha256 } };
  exclusiveJson(path.join(dir, 'audition.grant.json'), grant);
  return grant;
}

// ---------------------------------------------------------------------------------------------------------------
// Stage 4: the reviewed audition through the guarded runner. One fresh start (recorded beside the claim); a resume continues the SAME
// output folder and meter, so every settled or reserved cost carries forward. The output folder is fixed inside the claimed slot.
// ---------------------------------------------------------------------------------------------------------------
export const experimentAuditionStart = (config: NewBookConfig) =>
  path.join(path.dirname(experimentClaimFile(config)), `${NEW_BOOK_EXPERIMENT.slot}.audition.json`);
export async function runNewBookAudition(args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void; resume?: true }) {
  const { config } = args;
  const { claimSha256, continuation } = assertExperimentClaim(config);
  const dir = experimentDir(config), grantFile = path.join(dir, 'audition.grant.json'), out = path.join(dir, 'audition');
  if (sealedStatus(path.join(dir, continuation ? NEW_BOOK_CONTINUATION.outDir : 'text')) !== 'review_supported' ||
      sealedStatus(path.join(dir, 'child')) !== 'child_reference_passed' ||
      !existsSync(grantFile)) fail('new_book_stage_not_passed');
  const grant = read(grantFile), grantSha256 = sha(readFileSync(grantFile));
  if (grant.experiment?.slot !== NEW_BOOK_EXPERIMENT.slot || grant.experiment?.claimSha256 !== claimSha256) fail('new_book_grant_binding');
  const start = experimentAuditionStart(config), record = { version: 'new-book-audition-start/v1', out: path.resolve(out), grantSha256, claimSha256 };
  if (args.resume) {
    if (!existsSync(start) || canonicalJson(read(start)) !== canonicalJson(record) || !existsSync(out)) fail('new_book_audition_binding');
  } else {
    if (existsSync(start) || existsSync(out)) fail('new_book_audition_used');
    exclusiveJson(start, record);
  }
  process.env.GPT_IMAGE_EDIT_MAX_REFERENCES ??= '4';
  return runReviewedAudition({ bookDir: dir, out, keyFile: config.keyEnvFile, grantFile, signal: args.signal, log: args.log,
    layout: readReviewedBookLayout(path.join(dir, 'book-layout.json')), ...(args.resume ? { resume: true as const } : {}),
    experiment: { slot: NEW_BOOK_EXPERIMENT.slot, claimSha256, guard: () => { assertExperimentClaim(config); } } });
}

// ---------------------------------------------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------------------------------------------
export function planNewBook(config: NewBookConfig) {
  const { prepared } = prepareExperimentRequest(config), dir = experimentDir(config);
  return { experiment: NEW_BOOK_EXPERIMENT.slot, directory: dir, requestId: prepared.accepted.requestId, pages: prepared.book.pages,
    child: { age: prepared.brief.child.age, address: prepared.brief.child.address }, companion: (config.request as { companion?: { id?: string } }).companion?.id ?? null,
    contracts: NEW_BOOK_EXPERIMENT.contracts, apiCapMicroUsd: NEW_BOOK_EXPERIMENT.apiCapMicroUsd,
    claimed: existsSync(experimentClaimFile(config)), continuation: existsSync(experimentContinuationFile(config)),
    stages: { text: sealedStatus(path.join(dir, 'text')), continuation: sealedStatus(path.join(dir, NEW_BOOK_CONTINUATION.outDir)),
      child: sealedStatus(path.join(dir, 'child')), grant: existsSync(path.join(dir, 'audition.grant.json')),
      audition: existsSync(experimentAuditionStart(config)) },
    providerCalls: 0, keyRead: false, runtimeEligible: false };
}

export async function newBookExperimentCLI(argv: string[], deps: { text?: TextTransports; child?: ChildAdapters; log?: (line: string) => void } = {}) {
  const flags = argv.slice(3);
  if (argv.length < 3 || argv.length > 5 || argv[0] !== '--config' || !['plan', 'text', 'storyboard-continuation', 'child', 'grant', 'audition'].includes(argv[2]) ||
      flags.some(f => f !== '--execute' && f !== '--resume') || new Set(flags).size !== flags.length ||
      flags.includes('--resume') && (argv[2] !== 'audition' || !flags.includes('--execute'))) fail('new_book_arguments');
  const config = newBookConfig(argv[1]), stage = argv[2], execute = flags.includes('--execute'), log = deps.log ?? (line => console.log(line));
  if (stage === 'storyboard-continuation' && !execute) return { mode: 'plan' as const, plan: planNewBook(config),
    continuation: await previewStoryboardContinuation(config) };
  if (stage === 'plan' || !execute) return { mode: 'plan' as const, plan: planNewBook(config) };
  const controller = new AbortController(), interrupt = () => controller.abort(); process.on('SIGINT', interrupt);
  try {
    if (stage === 'text') return { mode: 'text' as const, ...await runNewBookText({ config, signal: controller.signal, log, contracts: NEW_BOOK_EXPERIMENT.contracts,
      ...(deps.text ? { transports: deps.text } : {}) }) };
    if (stage === 'storyboard-continuation') return { mode: 'storyboard-continuation' as const, ...await runNewBookStoryboardContinuation({ config,
      signal: controller.signal, log, contracts: NEW_BOOK_EXPERIMENT.contracts, ...(deps.text ? { transports: deps.text } : {}) }) };
    if (stage === 'child') return { mode: 'child' as const, ...await runNewBookChild({ config, signal: controller.signal, log, ...(deps.child ? { adapters: deps.child } : {}) }) };
    if (stage === 'audition') return { mode: 'audition' as const, result: await runNewBookAudition({ config, signal: controller.signal, log,
      ...(flags.includes('--resume') ? { resume: true as const } : {}) }) };
    return { mode: 'grant' as const, grant: writeNewBookGrant(config) };
  } finally { process.off('SIGINT', interrupt); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  newBookExperimentCLI(process.argv.slice(2))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error('FAILED', error?.code ?? error?.message ?? error); process.exitCode = 1; });
}
