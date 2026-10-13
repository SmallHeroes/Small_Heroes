/**
 * ONE approved new-book engine experiment (Guy, 2026-10-12): a brand-new fictional book from scratch through the current experimental CLI,
 * in stages that each stop on their own gate:
 *   text  - Opus author + fresh Opus editor (Claude Max), blind Sol readers, Astra storyboard + Sol review (moments + landmark-kind contracts)
 *   child - the fictional child reference from its written design (no photo), pixel-judged; one targeted repair only for an evidenced defect
 *   grant - the audition grant for the remaining API allowance, with an early continuity sample (no provider)
 *   audition - the reviewed-audition runner on this book, guarded by the claim and source pin before every paid call: the sheets, the
 *     sample and, only if the sample is qa_supported, the rest of the book. Started once; --resume continues the same ledger.
 * Dry by default; nothing is retried; every paid call is journaled before dispatch.
 *   node --require ./scripts/shims/register-server-only.cjs --import tsx scripts/personal-new-book-experiment.ts \
 *     --config <abs config.json> <plan|text|child|grant|audition> [--execute [--resume]]
 * Not production, customer, wizard or release authority. Every artifact is runtime-ineligible; acceptance is Guy's.
 */
import path from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { z } from 'zod';
import { gitAt } from './personal-source-git';
import { exclusiveJson, exclusiveText, fencedText, realDirectory } from './personal-causal-trial-journal';
import { CAUSAL_MODELS, createAstraCausalTransport, createOpusCausalTransport, prepareCausalWire, wireReservation, type CausalWire, type TransportReply,
  type WirePolicy } from './personal-causal-trial-adapters';
import type { CausalDispatch } from '../lib/personal-wizard/story-causal-experiment-runner';
import { safeUsage } from './personal-story-trial-guard';
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
const SOL = 'gpt-6.1-sol' as const;
const RATES = { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 10, outputMicroUsdPerToken: 50 },
  sol: { inputMicroUsdPerToken: 2, outputMicroUsdPerToken: 10 } };
/** Paid API calls per stage: two readers + storyboard + review; child render + judge, repair render + judge. */
const TEXT_API_CALLS = 4, CHILD_API_CALLS = 4;

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
export function assertExperimentSource(config: NewBookConfig) {
  if (path.resolve(config.workspace).toLowerCase() !== path.resolve(process.cwd()).toLowerCase() ||
      gitAt(config.workspace, ['rev-parse', 'HEAD']).toString().trim() !== config.sourceHead ||
      gitAt(config.workspace, ['status', '--porcelain']).toString().trim()) fail('new_book_source_changed');
}
/** Routing for the reviewed-audition loader; every binding is recomputed from the saved files. */
export const experimentLayout = (config: NewBookConfig, childImage = 'reference_child.png'): ReviewedBookLayout =>
  reviewedBookLayoutSchema.parse({ version: 'reviewed-book-layout/v1', seed: config.seed, childDesign: config.childDesign,
    storyboardDir: 'text', childDir: 'child', childImage, savedCompanion: null });
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
/** The claim this configuration made, unchanged, and the source still at the claimed HEAD with a clean tree. Checked before every paid call. */
export function assertExperimentClaim(config: NewBookConfig) {
  const file = experimentClaimFile(config);
  if (!existsSync(file)) return fail('new_book_claim');
  const bytes = readFileSync(file), parsed = claimSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success || !sameDir(parsed.data.experimentDir, experimentDir(config)) || parsed.data.configSha256 !== sha(canonicalJson(config)) ||
      parsed.data.sourceHead !== config.sourceHead) return fail('new_book_claim');
  assertExperimentSource(config);
  return { claim: parsed.data, claimSha256: sha(bytes) };
}
/** The verified API spend of one finished stage (after the earlier stages' `prior`): no unknown cost or outcome, and it equals the stage's saved spend record. */
export function stageLedger(stageDir: string, maxCalls: number, prior = 0) {
  const snapshot = new AuditionMeter(path.join(stageDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, maxCalls, prior).snapshot();
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
type Responses = (payload: ReturnType<typeof simpleWizardVisualPayload>, signal: AbortSignal, timeout: number) => Promise<OpenAI.Responses.Response>;
export type TextTransports = { opus?: OpusTransport; reader?: OpusTransport; responses?: Responses };

export async function runNewBookText(args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void;
  contracts: { actorOwnedAppearance?: true; momentContract?: true; landmarkKindContract?: true }; transports?: TextTransports }) {
  const { config, signal } = args;
  assertExperimentSource(config);
  if (!args.transports?.opus && sha(readFileSync(config.executable)) !== config.executableSha256) fail('new_book_executable_changed');
  const { options, prepared } = prepareExperimentRequest(config);
  const dir = experimentDir(config), textDir = path.join(dir, 'text'), cliWorkspace = path.join(textDir, 'cli-workspace');
  // Single use: the approval is claimed once (any folder), then the slot folder is created exactly once. A folder that already exists
  // is refused before the claim, so it never consumes the approval.
  if (existsSync(dir)) fail('new_book_slot_used');
  claimExperiment(config, prepared.accepted.requestId);
  try { mkdirSync(dir); } catch { fail('new_book_slot_used'); }
  mkdirSync(textDir); mkdirSync(cliWorkspace);
  const request = prepared.accepted.canonical;
  exclusiveJson(path.join(dir, 'request.json'), { version: 'local-simple-wizard-request/v1', requestId: prepared.accepted.requestId,
    optionsFingerprint: prepared.accepted.optionsFingerprint, consent: 'fictional_profile_new_book_experiment', experiment: NEW_BOOK_EXPERIMENT.slot, request });
  const api = new AuditionMeter(path.join(textDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, TEXT_API_CALLS);
  const claudeMax = new SimpleBookBudget(path.join(textDir, 'claude-max-stages'), 0);
  const key = keyReader(config.keyEnvFile);
  const policy: WirePolicy = { executable: config.executable, executableSha256: config.executableSha256, workspace: cliWorkspace, maxWireBytes: 104000,
    rates: { opus: RATES.opus, astra: RATES.sol }, openAIReviewModel: SOL };
  const opus = args.transports?.opus ?? createOpusCausalTransport(policy);
  const reader = args.transports?.reader ?? createAstraCausalTransport({ key, rates: RATES.sol, model: SOL });
  const responses: Responses = args.transports?.responses ?? (async (payload, s, timeout) =>
    new OpenAI({ apiKey: key(), baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off' }).responses.create(payload, { signal: s, timeout }));
  const check = () => { if (signal.aborted) fail('new_book_cancelled'); assertExperimentClaim(config); };
  const conversation = (stage: string) => `new-book:${prepared.accepted.requestId}:${stage}`;
  let storyboardDraft: unknown = null;
  // The first failed paid call's own code is the stage's cause (the story/storyboard layers re-wrap callback errors).
  let failedStageCode: string | null = null;
  const recordFailure = (error: unknown): never => { failedStageCode ??= codeOf(error, 'new_book_provider_transport'); throw error; };
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    exclusiveJson(path.join(textDir, 'spend.json'), api.snapshot());
    exclusiveJson(path.join(textDir, 'claude-max-spend.json'), { ...claudeMax.snapshot(), note: NEW_BOOK_EXPERIMENT.claudeMax });
    exclusiveJson(path.join(textDir, 'sealed.json'), { status, ...extra, runtimeEligible: false });
  };
  try {
    const result = await runSimpleWizardBook({ request, options, seed: config.seed, signal, reservedWritingUsd: 4, ...args.contracts,
      publish: view => args.log(`phase ${view.phase}`),
      opus: async (call, s) => {
        check();
        const instructionFile = path.join(textDir, `${call.stage}-instructions.txt`); exclusiveText(instructionFile, call.instructions);
        const dispatch = { ...call, role: 'opus' as const, conversationKey: conversation(call.stage) };
        const wire = prepareCausalWire(dispatch, policy, 2000000, instructionFile);
        // The CLI's own --max-budget-usd 2 bounds each session; journaled as Claude Max, never against the API cap.
        return claudeMax.run(call.stage, { ...wire, payload: wire.payload }, 2000000, async () => {
          const reply = await opus(wire, dispatch, s);
          return { value: reply, estimatedMicroUsd: reply.estimatedMicroUsd, receipt: reply };
        }).catch(recordFailure);
      },
      reader: async (call, s) => {
        check();
        const dispatch = { ...call, role: 'astra' as const, conversationKey: conversation(call.stage) };
        const wire = prepareCausalWire(dispatch, policy, 2000000);
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
          const response = await responses(payload, s, generationTimeoutMs(call.maxOutputTokens));
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
    exclusiveJson(path.join(textDir, 'simple-book-result.json'), result);
    exclusiveText(path.join(textDir, 'story.md'), `# ${result.source.manuscript.title}\n\n` +
      result.source.manuscript.pages.map(p => `## עמוד ${p.pageNumber}\n\n${p.text}`).join('\n\n') + '\n');
    if (result.storyboard) {
      // The reviewed-audition loader's inputs: the whole result and the planner's own draft, both recompiled and bound there.
      exclusiveJson(path.join(textDir, 'visual_simple_book_result.json'), result);
      exclusiveJson(path.join(textDir, 'owned_storyboard_draft.json'), storyboardDraft ?? fail('new_book_draft_missing'));
    }
    seal(result.status);
    return { status: result.status, api: api.snapshot(), claudeMax: claudeMax.snapshot() };
  } catch (error) {
    if (!existsSync(path.join(textDir, 'sealed.json'))) seal('failed', { code: failedStageCode ?? codeOf(error, 'new_book_text_failed') });
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Stage 2: the fictional child reference.
// ---------------------------------------------------------------------------------------------------------------
type Render = (step: string, prompt: string, refs: AuditionImage[], mode: 'identity') => Promise<AuditionImage>;
type Judge = (step: string, candidate: AuditionImage, context: unknown, contextSha: string, refs: AuditionImage[], predecessor: AuditionImage | null) => Promise<unknown>;
export type ChildAdapters = { render?: Render; judge?: Judge };

export async function runNewBookChild(args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void; adapters?: ChildAdapters }) {
  const { config, signal } = args;
  assertExperimentClaim(config);
  const dir = experimentDir(config), textDir = path.join(dir, 'text'), childDir = path.join(dir, 'child'), images = path.join(childDir, 'illustrations');
  realDirectory(dir);
  if (sealedStatus(textDir) !== 'review_supported') fail('new_book_text_not_supported');
  const prior = stageLedger(textDir, TEXT_API_CALLS);
  const loaded = loadReviewedStoryboard(dir, config.workspace, experimentLayout(config));
  try { mkdirSync(childDir); } catch { fail('new_book_child_used'); }
  mkdirSync(images);
  const meter = new AuditionMeter(path.join(childDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, CHILD_API_CALLS, prior.knownMicroUsd);
  const save = (name: string, value: unknown) => exclusiveJson(path.join(childDir, `${name}.json`), value);
  const check = () => { if (signal.aborted) fail('new_book_cancelled'); assertExperimentClaim(config); };
  const key = keyReader(config.keyEnvFile);
  // The claim and source pin guard every render claim too (including the one repair edit after a judgment).
  const io = args.adapters?.render ? null : auditionAdapters({ directory: images, meter, key, signal, guard: () => { assertExperimentClaim(config); } });
  const render: Render = args.adapters?.render ?? ((step, prompt, refs, mode) => io!.render(step, prompt, refs, mode));
  const judge: Judge = args.adapters?.judge ?? createSimpleBookPixelJudge({ config: { reviewModel: SOL }, directory: images, budget: meter, key,
    assertCurrent: check, signal, save });
  const context = simpleReferenceDesignContext(reviewedChildDesign(loaded.prepared, loaded.book, experimentLayout(config)));
  const contextSha = previewSha(JSON.stringify(context));
  const prompt = simpleChildReferencePrompt(loaded.prepared.brief.child.age, loaded.prepared.brief.child.address, config.childDesign, loaded.book.plan.wardrobe);
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    save('spend', meter.snapshot()); save('sealed', { status, ...extra, priorTextApiMicroUsd: prior.knownMicroUsd, runtimeEligible: false });
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
    exclusiveJson(path.join(dir, 'book-layout.json'), experimentLayout(config, candidate.imageName));
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
  const { claimSha256 } = assertExperimentClaim(config);
  const dir = experimentDir(config), textDir = path.join(dir, 'text'), childDir = path.join(dir, 'child');
  if (sealedStatus(textDir) !== 'review_supported' || sealedStatus(childDir) !== 'child_reference_passed') fail('new_book_stage_not_passed');
  const layout = readReviewedBookLayout(path.join(dir, 'book-layout.json'));
  if (canonicalJson(layout) !== canonicalJson(experimentLayout(config, layout.childImage))) fail('new_book_layout');
  const loaded = loadReviewedBook(dir, config.workspace, undefined, layout);
  const text = stageLedger(textDir, TEXT_API_CALLS), child = stageLedger(childDir, CHILD_API_CALLS, text.knownMicroUsd);
  const prior = text.knownMicroUsd + child.knownMicroUsd;
  if (prior >= NEW_BOOK_EXPERIMENT.apiCapMicroUsd) fail('new_book_budget_exhausted');
  const grant: AuditionGrant = { version: 'audition-spend-grant/v1', approvalReference: NEW_BOOK_EXPERIMENT.approval,
    book: { requestId: loaded.queued.requestId, storyboardDigest: loaded.book.storyboardDigest },
    ledger: { priorKnownApiMicroUsd: prior, evidence: [{ file: text.file, sha256: text.sha256 }, { file: child.file, sha256: child.sha256 }],
      note: `New-book experiment ledger: starts at $0 for this book under the one $7 API cap; text stage and child reference recorded above. The Goni book's ledger is separate and unchanged.` },
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
  const { claimSha256 } = assertExperimentClaim(config);
  const dir = experimentDir(config), grantFile = path.join(dir, 'audition.grant.json'), out = path.join(dir, 'audition');
  if (sealedStatus(path.join(dir, 'text')) !== 'review_supported' || sealedStatus(path.join(dir, 'child')) !== 'child_reference_passed' ||
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
    claimed: existsSync(experimentClaimFile(config)),
    stages: { text: sealedStatus(path.join(dir, 'text')), child: sealedStatus(path.join(dir, 'child')), grant: existsSync(path.join(dir, 'audition.grant.json')),
      audition: existsSync(experimentAuditionStart(config)) },
    providerCalls: 0, keyRead: false, runtimeEligible: false };
}

export async function newBookExperimentCLI(argv: string[], deps: { text?: TextTransports; child?: ChildAdapters; log?: (line: string) => void } = {}) {
  const flags = argv.slice(3);
  if (argv.length < 3 || argv.length > 5 || argv[0] !== '--config' || !['plan', 'text', 'child', 'grant', 'audition'].includes(argv[2]) ||
      flags.some(f => f !== '--execute' && f !== '--resume') || new Set(flags).size !== flags.length ||
      flags.includes('--resume') && (argv[2] !== 'audition' || !flags.includes('--execute'))) fail('new_book_arguments');
  const config = newBookConfig(argv[1]), stage = argv[2], execute = flags.includes('--execute'), log = deps.log ?? (line => console.log(line));
  if (stage === 'plan' || !execute) return { mode: 'plan' as const, plan: planNewBook(config) };
  const controller = new AbortController(), interrupt = () => controller.abort(); process.on('SIGINT', interrupt);
  try {
    if (stage === 'text') return { mode: 'text' as const, ...await runNewBookText({ config, signal: controller.signal, log, contracts: NEW_BOOK_EXPERIMENT.contracts,
      ...(deps.text ? { transports: deps.text } : {}) }) };
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
