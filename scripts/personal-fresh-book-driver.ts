/**
 * The fresh-book stage driver (Guy 2026-10-18 closure amendment): ONE new LOW experimental book under FRESH_BOOK_CYCLE, from a frozen
 * fictional profile, through the reviewed native primitives. Not the new-book-20261012 CLI: its slot, claim, carry and defaults are untouched.
 *   text  - admission from the settled re-review (never a flag), the fixed cycle claim, then Opus 5.5 author + editor (Claude Max), Sol 6.1
 *           readers, the Opus 5.5 storyboard planner (Claude Max; never the Astra route) and the Sol 6.1 storyboard review
 *   child - the child anchor under child-anchor-inspection/v1 (render, style review, design + age review; one correction only for a known defect)
 *   book  - the audition grant derived from the verified ledgers, then the reviewed audition: sheets, the two sample pages first, the rest of
 *           the book and the cover only when both samples pass (max 3 attempts/page, LOW). Started once; --resume continues the same ledger.
 * Every stage re-derives the cumulative ledger (diagnostic subcap and every book stage, from records) and guards EVERY paid call synchronously:
 * grant bytes, profile, claim, clean head/branch and pinned source, configuration, the re-review lineage and every earlier stage folder.
 * Dry by default (plan + grant draft; no key, no provider, no write):
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/personal-fresh-book-driver.ts --config <abs json> plan
 *   ... --config <abs json> <text|child|book> --execute --grant <abs grant.json> --grant-sha <sha256> [--resume]   (only after Codex PASS)
 */
import path from 'node:path';
import { existsSync, mkdirSync, readdirSync, readFileSync, lstatSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import OpenAI from 'openai';
import { z } from 'zod';
import { previewSha } from '../lib/local-story-preview';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { resolvePersonalWizardOptions } from '../lib/personal-wizard/options';
import { prepareSimpleStory } from '../lib/personal-wizard/simple-story-engine';
import { runSimpleWizardBook } from '../lib/personal-wizard/simple-book-flow';
import { SimpleBookBudget } from '../lib/personal-wizard/simple-book-budget';
import { decodePersonalBookProviderOutput } from '../lib/personal-wizard/book-openai';
import type { SimpleStoryboardDiagnosticCall } from '../lib/personal-wizard/simple-storyboard-diagnostic';
import { generationTimeoutMs } from '../lib/personal-wizard/story-config';
import type { AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';
import type { BookDesignReferenceRole } from '../lib/generate-image';
import { AUDITION_WORST_CASE_CALLS } from '../lib/personal-wizard/simple-book-reviewed-audition';
import { CHILD_ANCHOR_INSPECTION_VERSION, CHILD_ANCHOR_MATERIALITY_VERSION, CHILD_ANCHOR_MATERIALITY_AMENDMENT, CHILD_ANCHOR_CORRECTION_ROLES, resolveChildAnchorTechnique, childAnchorDescriptionRequest, childAnchorCorrectionPrompt,
  assertChildAnchorRenderPlan, childAnchorAttemptRecipe, childAnchorRecipeSha, childAnchorStyleDisposition, childAnchorDisposition,
  childAnchorInspectionContext, childAnchorInspectionContextSha, childAnchorInspectedDesignDisposition, childAnchorInspectedAdoptionRecord,
  assertChildAnchorInspectedAccepted, type ChildAnchorChild, type ChildAnchorInspectionContext, type ChildAnchorRecipe } from '../lib/personal-wizard/child-anchor-style';
import { AuditionMeter, auditionAdapters, auditionMeterRules, keyReader, loadReviewedStoryboard, loadReviewedBook, reviewedBookLayoutSchema, readReviewedBookLayout,
  runReviewedAudition, auditionGrantSchema, verifyMeterRecords, type AuditionGrant, type ReviewedBookLayout, type MeterRules } from './personal-simple-book-reviewed-audition';
import { readAuditionImage } from './personal-simple-book-illustrator';
import { childAnchorJudges, inspectedDesignWire, inspectedStyleWire, type ChildAnchorInspectedDesignJudge, type ChildAnchorInspectedStyleJudge } from './personal-child-anchor-judges';
import { CAUSAL_MODELS, createAstraCausalTransport, createOpusCausalTransport, prepareCausalWire, type CausalWire, type TransportReply, type WirePolicy } from './personal-causal-trial-adapters';
import type { CausalDispatch } from '../lib/personal-wizard/story-causal-experiment-runner';
import { longCallFetch, providerFailureCause, type LongCallObserver } from './personal-long-call-fetch';
import { simpleWizardVisualPayload } from './personal-simple-wizard-worker';
import { OPUS_PLANNER, createOpusStoryboardTransport, plannerRequest, prepareOpusStoryboardWire, type PlannerWire } from './personal-opus-storyboard-transport';
import { NEW_BOOK_STORYBOARD_REPAIR_2, earliestSameScenePair, replaySettlement, stageRules } from './personal-new-book-experiment';
import { exclusiveJson, exclusiveText, realDirectory } from './personal-causal-trial-journal';
import { REREVIEW_AMENDMENT, rereviewConfig, rereviewOutput, folderBaseline, type RereviewConfig } from './personal-child-anchor-rereview';
import { FRESH_BOOK_CYCLE, FreshBookError, freshBookProfileSchema, freshBookProfileSha, freshBookGrantSchema, assertFreshBookAdmission, freshBookDiagnosticSpend,
  freshBookCycleLedger, claimFreshBook, assertFreshBookPaid, freshBookReadingOrder, type FreshBookEnv, type FreshBookProfile, type FreshBookGrant, type FreshBookStage,
  type PageGate } from './personal-fresh-book-authority';

export const FRESH_BOOK_DRIVER_VERSION = 'fresh-book-driver/v1' as const;
const fail = (code: string): never => { throw new FreshBookError(code); };
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const abs = z.string().refine(p => path.isAbsolute(p));
const SOL = 'gpt-6.1-sol' as const;
const RATES = replaySettlement.rates;
const workspace = () => path.resolve(__dirname, '..');
const fileBytes = (file: string) => { const s = lstatSync(file); if (!s.isFile() || s.isSymbolicLink() || s.size > 32000000) fail('fresh_book_file'); return readFileSync(file); };
const json = (file: string) => JSON.parse(fileBytes(file).toString('utf8'));
/**
 * The pinned native executable: a binary, not a bounded data artifact (no data-size cap), hashed whole as the native transports hash it at
 * spawn; never a link, a directory or a missing path. The dry plan reports it and the text stage refuses on it before the claim.
 */
export function assertFreshBookExecutable(config: Pick<FreshBookConfig, 'executable' | 'executableSha256'>) {
  const s = lstatSync(config.executable, { throwIfNoEntry: false });
  if (!s || !s.isFile() || s.isSymbolicLink() || previewSha(readFileSync(config.executable)) !== config.executableSha256) fail('fresh_book_executable_changed');
  return true as const;
}

export const freshBookConfigSchema = z.object({ version: z.literal('fresh-book-driver-config/v1'), profileFile: abs, profileSha256: hash,
  rereviewConfig: abs, rereviewConfigSha256: hash, bookDir: abs, executable: abs, executableSha256: hash, keyEnvFile: abs }).strict();
export type FreshBookConfig = z.infer<typeof freshBookConfigSchema>;
export function freshBookConfig(file: string): FreshBookConfig {
  if (!path.isAbsolute(file)) fail('fresh_book_config');
  const parsed = freshBookConfigSchema.safeParse(json(file));
  return parsed.success ? parsed.data : fail('fresh_book_config');
}

/** The current storyboard contracts (every reviewed opt-in, as the last reviewed storyboard used them), fixed in code. */
export const FRESH_BOOK_CONTRACTS = NEW_BOOK_STORYBOARD_REPAIR_2.contracts;
/** Paid API calls per stage: two readers + the storyboard review (the planner is Claude Max); the inspected child: two attempts x three. */
const TEXT_API_CALLS = 3, CHILD_API_CALLS = 6;
const pick = (rules: Record<string, unknown>, steps: string[]): MeterRules => step => steps.includes(step) ? rules[step] as ReturnType<MeterRules> : undefined;
const TEXT_RULES = pick(stageRules.text, ['comparison', 'final_review', 'storyboard_review']);
const CHILD_RULES = pick(stageRules.childAnchor, Object.keys(stageRules.childAnchor));
/** The book's stages in ledger order (each folder re-derived under its own rules). */
const bookStages = (bookDir: string): FreshBookStage[] => [
  { name: 'text', dir: path.join(bookDir, 'text'), rules: TEXT_RULES, maxCalls: TEXT_API_CALLS },
  { name: 'child', dir: path.join(bookDir, 'child'), rules: CHILD_RULES, maxCalls: CHILD_API_CALLS },
  { name: 'audition', dir: path.join(bookDir, 'audition'), rules: auditionMeterRules, maxCalls: AUDITION_WORST_CASE_CALLS }];

/** The engine files whose bytes the grant pins (the driver, its authority and every reviewed primitive it calls). */
export const FRESH_BOOK_PINNED = Object.freeze(['scripts/personal-fresh-book-driver.ts', 'scripts/personal-fresh-book-authority.ts',
  'scripts/personal-child-anchor-rereview.ts', 'scripts/personal-child-anchor-judges.ts', 'scripts/personal-simple-book-reviewed-audition.ts',
  'scripts/personal-simple-book-illustrator.ts', 'scripts/personal-causal-trial-journal.ts', 'scripts/personal-causal-trial-adapters.ts',
  'scripts/personal-opus-storyboard-transport.ts', 'scripts/personal-simple-wizard-worker.ts', 'scripts/personal-long-call-fetch.ts',
  'scripts/personal-new-book-experiment.ts', 'lib/personal-wizard/child-anchor-style.ts', 'lib/personal-wizard/simple-book-flow.ts',
  'lib/personal-wizard/simple-book-reviewed-audition.ts', 'lib/personal-wizard/storyboard.ts', 'lib/personal-wizard/simple-story-engine.ts',
  'lib/personal-wizard/simple-book-budget.ts', 'lib/generation-pipeline/stage0-method-b.ts', 'lib/local-preview-quality.ts', 'lib/generate-image.ts',
  'scripts/shims/register-server-only.cjs']);

export const realFreshBookEnv = (): FreshBookEnv => {
  const git = (...a: string[]) => execFileSync('git', ['-C', workspace(), ...a], { encoding: 'utf8' }).trim();
  return { authorityRoot: FRESH_BOOK_CYCLE.authorityRoot,
    head: () => ({ head: git('rev-parse', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'), clean: git('status', '--porcelain') === '' }) };
};

/** The frozen profile (file pinned by sha) and its reviewed request: this child, this companion, no photo, 8 pages, nothing from a fixture. */
function loadProfile(config: FreshBookConfig) {
  const bytes = fileBytes(config.profileFile);
  if (previewSha(bytes) !== config.profileSha256) fail('fresh_book_profile_changed');
  const profile: FreshBookProfile = freshBookProfileSchema.parse(JSON.parse(bytes.toString('utf8')));
  const options = resolvePersonalWizardOptions(workspace()), prepared = prepareSimpleStory(profile.request, options, profile.seed);
  const canonical = prepared.accepted.canonical;
  if (prepared.book.pages !== 8 || prepared.accepted.containsFixtureData || canonical.appearance.photo !== 'none' || canonical.companion.id !== profile.companion.id ||
      canonical.child.name !== profile.child.name || canonical.child.age !== profile.child.age || canonical.child.address !== profile.child.gender) fail('fresh_book_request');
  return { profile, options, prepared };
}
function loadRereview(config: FreshBookConfig): RereviewConfig {
  if (previewSha(fileBytes(config.rereviewConfig)) !== config.rereviewConfigSha256) fail('fresh_book_rereview_config');
  return rereviewConfig(config.rereviewConfig);
}
const layoutFor = (profile: FreshBookProfile, childImage = 'reference_child.png'): ReviewedBookLayout => reviewedBookLayoutSchema.parse({
  version: 'reviewed-book-layout/v1', seed: profile.seed, childDesign: profile.child.design, storyboardDir: 'text', childDir: 'child', childImage,
  savedCompanion: null, childAnchor: profile.childAnchor });
/** The book's child acceptance and its admission re-review must be the same contract (a materiality book is admitted by materiality evidence). */
const policyOf = (profile: FreshBookProfile, rereview: RereviewConfig) => {
  if (profile.childAnchor !== (rereview.acceptance ?? CHILD_ANCHOR_INSPECTION_VERSION)) fail('fresh_book_policy_mismatch');
  return profile.childAnchor === CHILD_ANCHOR_MATERIALITY_VERSION ? { policyAmendment: CHILD_ANCHOR_MATERIALITY_AMENDMENT } : {};
};

/** Provider-free plan and the grant this exact state needs. Independent of the future re-review result, which every stage re-derives. */
export function planFreshBook(config: FreshBookConfig, env: FreshBookEnv) {
  const { profile, prepared } = loadProfile(config), rereview = loadRereview(config), policy = policyOf(profile, rereview);
  const plan = { version: FRESH_BOOK_DRIVER_VERSION, cycle: FRESH_BOOK_CYCLE.id, profileSha256: freshBookProfileSha(profile), seed: profile.seed,
    requestId: prepared.accepted.requestId, child: { name: profile.child.name, age: profile.child.age, gender: profile.child.gender, fictional: true },
    companion: profile.companion.id, bookDir: path.resolve(config.bookDir), routes: FRESH_BOOK_CYCLE.routes, contracts: FRESH_BOOK_CONTRACTS,
    childAnchor: profile.childAnchor, ...policy, stages: ['text', 'child', 'book'],
    caps: { cycleCeilingMicroUsd: FRESH_BOOK_CYCLE.cycleCeilingMicroUsd, diagnosticSubcapMicroUsd: FRESH_BOOK_CYCLE.diagnosticSubcapMicroUsd,
      bookSubcapMicroUsd: FRESH_BOOK_CYCLE.bookSubcapMicroUsd, textApiCalls: TEXT_API_CALLS, childApiCalls: CHILD_API_CALLS, auditionCalls: AUDITION_WORST_CASE_CALLS,
      pageAttempts: FRESH_BOOK_CYCLE.pageAttempts, imageQuality: 'low' },
    sample: 'two pages first: the earliest same-scene pair of the compiled storyboard (engine rule, not chosen); the rest and the cover only if both pass',
    admission: 'the amendment outcome re-derived from settled re-review records must be passed, at every stage',
    rereviewConfigSha256: config.rereviewConfigSha256, executableSha256: config.executableSha256,
    claim: path.join(env.authorityRoot, FRESH_BOOK_CYCLE.claimName), providerCalls: 0, keyRead: false };
  const engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft: FreshBookGrant = freshBookGrantSchema.parse({ version: 'fresh-book-grant/v1', cycle: FRESH_BOOK_CYCLE.id, approval: FRESH_BOOK_CYCLE.approval,
    profileSha256: plan.profileSha256, engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)),
    bookDir: path.resolve(config.bookDir) });
  // Read-only state for the operator (never part of the plan or grant): what each stage would find now.
  const probe = (f: () => unknown) => { try { return f(); } catch (e) { return { refused: e && typeof e === 'object' && 'code' in e ? e.code : String(e) }; } };
  const state = { claimExists: existsSync(plan.claim), bookDirExists: existsSync(config.bookDir), diagnosticSettledMicroUsd: probe(() => freshBookDiagnosticSpend(rereview, env)),
    executablePinned: probe(() => assertFreshBookExecutable(config)) };
  return { plan, grantDraft, state, profile, prepared, rereview };
}

/**
 * The re-review lineage the admission stands on (original claim/outcome/folder and its configuration, every round's claim/outcome/folder),
 * this book's claim, outcome and audition start, and each earlier stage entry of this book, by digest (pinned before any reader validates them).
 */
function rootsOf(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, folders: string[]) {
  const out: Record<string, string> = { config: previewSha(canonicalJson(config)), profile: previewSha(fileBytes(config.profileFile)),
    rereviewConfig: previewSha(fileBytes(config.rereviewConfig)), diagnosticConfig: previewSha(fileBytes(rereview.diagnosticConfig)) };
  const names: string[] = [REREVIEW_AMENDMENT.originalClaimName, REREVIEW_AMENDMENT.originalOutcomeName];
  for (let round = 1; round <= REREVIEW_AMENDMENT.maxRounds; round++) names.push(REREVIEW_AMENDMENT.claimName(round), REREVIEW_AMENDMENT.outcomeName(round));
  for (const name of [...names, FRESH_BOOK_CYCLE.claimName, FRESH_BOOK_CYCLE.outcomeName, path.basename(auditionStartFile(env))]) {
    const file = path.join(env.authorityRoot, name); out[`authority/${name}`] = existsSync(file) ? previewSha(fileBytes(file)) : 'absent';
  }
  for (const [rel, d] of Object.entries(folderBaseline(rereview.diagnosticOutput))) out[`diagnostic/${rel}`] = d;
  for (let round = 1; round <= REREVIEW_AMENDMENT.maxRounds; round++) {
    const dir = rereviewOutput(rereview, round);
    if (existsSync(dir)) for (const [rel, d] of Object.entries(folderBaseline(dir))) out[`rereview${round}/${rel}`] = d;
  }
  for (const f of folders) {
    const p = path.join(config.bookDir, f);
    if (!existsSync(p)) out[`book/${f}`] = 'absent';
    else if (lstatSync(p).isDirectory()) for (const [rel, d] of Object.entries(folderBaseline(p))) out[`book/${f}/${rel}`] = d;
    else out[`book/${f}`] = previewSha(fileBytes(p));
  }
  return out;
}

/**
 * A stage's admission: the grant is exactly the draft this state rebuilds and the externally pinned bytes; admission's own final read is
 * clean at its head and branch. The baseline (grant bytes, configuration, profile, re-review lineage, this book's authority records, earlier
 * stage entries) is pinned FIRST, before the plan, its probe or the awaited admission read any of it, and held across every await: what was
 * validated is exactly what is pinned, never a later re-capture. Returns the synchronous guard of that baseline, for every write and paid call.
 */
async function admitStage(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal; earlier: string[] }) {
  const bytes = fileBytes(a.grantFile);
  if (previewSha(bytes) !== a.grantSha) fail('fresh_book_grant');
  const rereview = loadRereview(a.config);
  let roots = rootsOf(a.config, a.env, rereview, a.earlier);
  const planned = planFreshBook(a.config, a.env);
  const outcome = await assertFreshBookAdmission(planned.rereview, a.env);
  const engine = a.env.head();
  if (canonicalJson(JSON.parse(bytes.toString('utf8'))) !== canonicalJson(planned.grantDraft)) fail('fresh_book_grant');
  if (!engine.clean || engine.head !== planned.grantDraft.engine.head || engine.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    const now = fileBytes(a.grantFile);
    if (!now.equals(bytes)) fail('fresh_book_grant');
    if (canonicalJson(rootsOf(a.config, a.env, rereview, a.earlier)) !== canonicalJson(roots)) fail('fresh_book_roots_changed');
    const e = a.env.head();
    if (!e.clean || e.head !== planned.grantDraft.engine.head || e.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(planned.grantDraft.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
  };
  /** Before every paid call: the captured baseline, then the claim this grant wrote (same profile, folder and head). */
  const guard = () => { same(); assertFreshBookPaid({ env: a.env, grantFile: a.grantFile, grantSha: a.grantSha, profile: planned.profile, workspace: workspace() }); };
  /** After this stage's own exclusive writes (the claim; the audition grant and start): the ONLY accepted change is exactly these appearing. */
  const recapture = (added: string[]) => {
    const next = rootsOf(a.config, a.env, rereview, a.earlier), changed = Object.keys(next).filter(k => next[k] !== roots[k]);
    if (canonicalJson(Object.keys(next).sort()) !== canonicalJson(Object.keys(roots).sort()) || canonicalJson(changed.sort()) !== canonicalJson([...added].sort()) ||
        added.some(k => roots[k] !== 'absent' || next[k] === 'absent')) fail('fresh_book_roots_changed');
    roots = next; same();
  };
  same();
  return { planned, outcome, same, guard, recapture };
}
/** The cumulative ledger: the diagnostic subcap's settled spend and every book stage, each from its own records. Unknown halts. */
export function freshBookLedger(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig) {
  return freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env), stages: bookStages(config.bookDir) });
}
/** The book's terminal record beside its claim (once): the one book is over; nothing reopens it. */
function finish(env: FreshBookEnv, status: string, extra: Record<string, unknown>) {
  exclusiveJson(path.join(env.authorityRoot, FRESH_BOOK_CYCLE.outcomeName), { cycle: FRESH_BOOK_CYCLE.id, status, ...extra, finishedAt: new Date().toISOString() });
}
const codeOf = (error: unknown, fallback: string) => error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code
  : error instanceof Error && /^[a-z0-9_]{1,120}$/.test(error.message) ? error.message : fallback;
const sealedStatus = (dir: string) => existsSync(path.join(dir, 'sealed.json')) ? json(path.join(dir, 'sealed.json')).status : null;

// ---------------------------------------------------------------------------------------------------------------
// Stage 1: story and storyboard.
// ---------------------------------------------------------------------------------------------------------------
type OpusTransport = (wire: CausalWire, call: CausalDispatch, signal: AbortSignal) => Promise<TransportReply>;
type Responses = (payload: ReturnType<typeof simpleWizardVisualPayload>, signal: AbortSignal, timeout: number, observe?: LongCallObserver) =>
  Promise<OpenAI.Responses.Response>;
type PlannerTransport = (wire: PlannerWire, call: SimpleStoryboardDiagnosticCall, signal: AbortSignal) => Promise<TransportReply>;
export type FreshTextTransports = { opus?: OpusTransport; reader?: OpusTransport; responses?: Responses; planner?: PlannerTransport };
const TEXT_BACKSTOP_MS = generationTimeoutMs(55_000) + 60_000;

export async function runFreshBookText(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void; transports?: FreshTextTransports }) {
  const { config, env, signal } = args, transports = args.transports ?? {};
  const admitted = await admitStage({ ...args, earlier: [] }), { prepared, options, profile } = { ...loadProfile(config) };
  assertFreshBookExecutable(config);
  const ledger = freshBookLedger(config, env, admitted.planned.rereview);
  if (existsSync(config.bookDir)) fail('fresh_book_slot_used');
  realDirectory(path.dirname(config.bookDir));
  // No await from the last check to the one claim and the book folder.
  admitted.same();
  claimFreshBook(env, admitted.planned.grantDraft, args.grantSha);
  admitted.recapture([`authority/${FRESH_BOOK_CYCLE.claimName}`]);
  try { mkdirSync(config.bookDir); } catch { fail('fresh_book_slot_used'); }
  const textDir = path.join(config.bookDir, 'text'); mkdirSync(textDir); mkdirSync(path.join(textDir, 'cli-workspace'));
  exclusiveJson(path.join(config.bookDir, 'request.json'), { version: 'local-simple-wizard-request/v1', requestId: prepared.accepted.requestId,
    optionsFingerprint: prepared.accepted.optionsFingerprint, consent: 'fictional_profile_fresh_book', cycle: FRESH_BOOK_CYCLE.id, request: prepared.accepted.canonical });
  exclusiveJson(path.join(config.bookDir, 'admission.json'), { rereviewOutcome: admitted.outcome, ledger, profileSha256: freshBookProfileSha(profile) });
  const api = new AuditionMeter(path.join(textDir, 'paid-stages'), ledger.nextCapMicroUsd, TEXT_API_CALLS, ledger.bookKnownMicroUsd, 0, TEXT_RULES);
  const claudeMax = new SimpleBookBudget(path.join(textDir, 'claude-max-stages'), 0);
  const key = keyReader(config.keyEnvFile);
  const policy: WirePolicy = { executable: config.executable, executableSha256: config.executableSha256, workspace: path.join(textDir, 'cli-workspace'),
    maxWireBytes: 104000, rates: { opus: RATES.opus, astra: RATES.sol }, openAIReviewModel: SOL };
  const opus = transports.opus ?? createOpusCausalTransport(policy);
  const reader = transports.reader ?? createAstraCausalTransport({ key, rates: RATES.sol, model: SOL, fetch: longCallFetch(TEXT_BACKSTOP_MS) });
  const responses: Responses = transports.responses ?? (async (payload, s, timeout, observe) =>
    new OpenAI({ apiKey: key(), baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off', fetch: longCallFetch(timeout + 60_000, observe) })
      .responses.create(payload, { signal: s, timeout }));
  const dispatch = <T extends { stage: string }>(call: T, role: 'opus' | 'astra') => ({ ...call, role, conversationKey: `fresh-book:${prepared.accepted.requestId}:${call.stage}` });
  let storyboardDraft: unknown = null, failed: string | null = null;
  const record = (error: unknown): never => { failed ??= codeOf(error, 'fresh_book_provider_transport'); throw error; };
  const guard = () => { try { admitted.guard(); } catch (error) { record(error); } };
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    exclusiveJson(path.join(textDir, 'spend.json'), api.snapshot());
    exclusiveJson(path.join(textDir, 'claude-max-spend.json'), { ...claudeMax.snapshot(), note: 'Claude Max usage is separate: not an API invoice' });
    exclusiveJson(path.join(textDir, 'sealed.json'), { status, ...extra, runtimeEligible: false });
  };
  try {
    const result = await runSimpleWizardBook({ request: prepared.accepted.canonical, options, seed: profile.seed, signal, reservedWritingUsd: 4, ...FRESH_BOOK_CONTRACTS,
      publish: view => args.log(`phase ${view.phase}`),
      opus: async (call, s) => {
        guard();
        const d = dispatch(call, 'opus'), instructionFile = path.join(textDir, `${call.stage}-instructions.txt`);
        exclusiveText(instructionFile, call.instructions);
        const wire = prepareCausalWire(d, policy, 2000000, instructionFile);
        return claudeMax.run(call.stage, { ...wire, payload: wire.payload }, 2000000, async () => {
          const reply = await opus(wire, d, s);
          return { value: reply, estimatedMicroUsd: reply.estimatedMicroUsd, receipt: reply };
        }).catch(record);
      },
      reader: async (call, s) => {
        guard();
        const d = dispatch(call, 'astra'), wire = prepareCausalWire(d, policy, 2000000);
        return api.run(call.stage, wire, wire.reservedMicroUsd, async () => {
          const reply = await reader(wire, d, s);
          return { value: reply.output, estimatedMicroUsd: reply.estimatedMicroUsd, receipt: reply };
        }).catch(record);
      },
      visual: async (call: SimpleStoryboardDiagnosticCall, s: AbortSignal) => {
        guard();
        if (call.stage === 'storyboard') {
          // The planner is Opus 5.5 on the Claude Max route for every storyboard call of this book (fixed; never the Astra route).
          const instructionFile = path.join(textDir, 'storyboard-instructions.txt');
          exclusiveText(instructionFile, plannerRequest(call).instructions);
          const wire = prepareOpusStoryboardWire(call, policy, instructionFile);
          const cwd = path.join(textDir, 'planner-workspace'); mkdirSync(cwd);
          const plan = transports.planner ?? createOpusStoryboardTransport({ ...policy, workspace: cwd });
          return claudeMax.run('storyboard', wire, OPUS_PLANNER.sessionGuardMicroUsd, async () => {
            const reply = await plan(wire, call, s);
            storyboardDraft = reply.output;
            return { value: reply.output, estimatedMicroUsd: reply.estimatedMicroUsd, receipt: reply };
          }).catch(record);
        }
        if (call.stage !== 'review') return record(new FreshBookError('fresh_book_visual_stage'));
        const payload = simpleWizardVisualPayload(call, SOL), reserve = TEXT_RULES('storyboard_review')!.reserve(payload);
        if (reserve === null) return record(new FreshBookError('fresh_book_review_wire'));
        return api.run('storyboard_review', payload, reserve, async () => {
          const observed: unknown[] = [];
          let response: OpenAI.Responses.Response;
          try { response = await responses(payload, s, generationTimeoutMs(call.maxOutputTokens), failure => observed.push(failure)); }
          catch (error) {
            const cause = providerFailureCause(error);
            throw Object.assign(new FreshBookError(cause.sdkError === 'APIConnectionTimeoutError' ? 'fresh_book_provider_timeout' : 'fresh_book_provider_transport'),
              { receipt: { estimatedMicroUsd: null, failure: cause, observed } });
          }
          const { usage, estimatedMicroUsd, valid } = replaySettlement.answer(RATES.sol, call.maxOutputTokens, payload.model, response);
          const receipt = { raw: response, usage, estimatedMicroUsd, model: response.model, stage: 'storyboard_review' };
          if (s.aborted || !valid) throw Object.assign(new FreshBookError('fresh_book_provider_invalid'), { receipt });
          let output: unknown;
          try { output = decodePersonalBookProviderOutput(call, JSON.parse(response.output_text)); }
          catch { throw Object.assign(new FreshBookError('fresh_book_provider_schema'), { receipt }); }
          return { value: output, estimatedMicroUsd, receipt };
        }).catch(record);
      } });
    guard();
    exclusiveJson(path.join(textDir, 'simple-book-result.json'), result);
    exclusiveText(path.join(textDir, 'story.md'), `# ${result.source.manuscript.title}\n\n` +
      result.source.manuscript.pages.map(p => `## עמוד ${p.pageNumber}\n\n${p.text}`).join('\n\n') + '\n');
    if (result.storyboard) {
      exclusiveJson(path.join(textDir, 'visual_simple_book_result.json'), result);
      exclusiveJson(path.join(textDir, 'owned_storyboard_draft.json'), storyboardDraft ?? fail('fresh_book_draft_missing'));
    }
    seal(result.status);
    if (result.status !== 'review_supported') finish(env, 'held_text', { textStatus: result.status });
    return { status: result.status, api: api.snapshot(), claudeMax: claudeMax.snapshot() };
  } catch (error) {
    if (!existsSync(path.join(textDir, 'sealed.json'))) seal('failed', { code: failed ?? codeOf(error, 'fresh_book_text_failed') });
    if (!existsSync(path.join(env.authorityRoot, FRESH_BOOK_CYCLE.outcomeName))) finish(env, 'failed_text', { code: failed ?? codeOf(error, 'fresh_book_text_failed') });
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Stage 2: the inspected child anchor.
// ---------------------------------------------------------------------------------------------------------------
type Render = (step: string, prompt: string, refs: AuditionImage[], mode: 'style' | 'book_design', roles?: readonly BookDesignReferenceRole[]) => Promise<AuditionImage>;
/** The anchor's authority from THIS book: the configured design, the storyboard's wardrobe, the request the renderer plans, its context. */
function anchorAuthority(profile: FreshBookProfile, wardrobe: string) {
  const child: ChildAnchorChild = { age: profile.child.age, gender: profile.child.gender, design: profile.child.design, wardrobe };
  const technique = resolveChildAnchorTechnique(workspace()), request = childAnchorDescriptionRequest(child);
  assertChildAnchorRenderPlan(request.prompt, technique.length, request.referenceMode);
  return { child, technique, request, context: childAnchorInspectionContext(child, request.prompt, profile.childAnchor) };
}

export async function runFreshBookChild(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void }) {
  const { config, env, signal } = args;
  const admitted = await admitStage({ ...args, earlier: ['request.json', 'admission.json', 'text'] });
  admitted.guard();
  if (sealedStatus(path.join(config.bookDir, 'text')) !== 'review_supported' || existsSync(path.join(env.authorityRoot, FRESH_BOOK_CYCLE.outcomeName))) fail('fresh_book_stage_not_passed');
  const profile = admitted.planned.profile, loaded = loadReviewedStoryboard(config.bookDir, workspace(), layoutFor(profile));
  const anchor = anchorAuthority(profile, loaded.book.plan.wardrobe), contextSha = childAnchorInspectionContextSha(anchor.context);
  const ledger = freshBookLedger(config, env, admitted.planned.rereview);
  const childDir = path.join(config.bookDir, 'child'), images = path.join(childDir, 'illustrations');
  admitted.guard();
  try { mkdirSync(childDir); } catch { fail('fresh_book_child_used'); }
  mkdirSync(images);
  const meter = new AuditionMeter(path.join(childDir, 'paid-stages'), ledger.nextCapMicroUsd, CHILD_API_CALLS, ledger.bookKnownMicroUsd, 0, CHILD_RULES);
  const key = keyReader(config.keyEnvFile);
  const io = auditionAdapters({ directory: images, meter, key, signal, guard: admitted.guard });
  const judges = childAnchorJudges({ bytesOf: image => readAuditionImage(images, image), meter, key, signal, guard: admitted.guard });
  const render: Render = (step, prompt, refs, mode, roles) => io.render(step, prompt, refs, mode, roles);
  const save = (name: string, value: unknown) => exclusiveJson(path.join(childDir, `${name}.json`), value);
  const seal = (status: string, extra: Record<string, unknown> = {}) => { save('spend', meter.snapshot()); save('sealed', { status, ...extra, runtimeEligible: false }); };
  try {
    save('context', anchor.context);
    const result = await inspectedAnchor({ anchor, images, render, style: judges.inspectedStyle, design: judges.inspectedDesign, check: admitted.guard, save, log: args.log });
    admitted.guard();
    if (result.status !== 'passed') {
      seal('child_reference_held', { disposition: result.disposition, childAnchor: profile.childAnchor });
      finish(env, 'held_child', { disposition: result.disposition });
      return { status: 'child_reference_held' as const, disposition: result.disposition };
    }
    save('reference_child_adoption', { name: 'child', context: anchor.context, candidate: result.candidate, authority: 'fresh_book_reviewed_passed', anchor: result.record });
    exclusiveJson(path.join(config.bookDir, 'book-layout.json'), layoutFor(profile, result.candidate.imageName));
    seal('child_reference_passed', { candidate: result.candidate, contextSha, childAnchor: profile.childAnchor,
      ...(result.acceptedDeviations ? { acceptedDeviations: result.acceptedDeviations } : {}) });
    return { status: 'child_reference_passed' as const, candidate: result.candidate };
  } catch (error) {
    if (!existsSync(path.join(childDir, 'sealed.json'))) seal('failed', { code: codeOf(error, 'fresh_book_child_failed') });
    if (!existsSync(path.join(env.authorityRoot, FRESH_BOOK_CYCLE.outcomeName))) finish(env, 'failed_child', { code: codeOf(error, 'fresh_book_child_failed') });
    throw error;
  }
}

/**
 * The inspected anchor: render in style mode from the pinned technique files, its inspected style review, then (unless style is unassessable)
 * its inspected design + age review, both bound to this candidate, THIS context and the render recipe. One correction edit only for a known
 * defect, judged again under the SAME context (an earlier image's PASS never carries). All three dimensions of the final candidate must pass.
 */
async function inspectedAnchor(a: { anchor: ReturnType<typeof anchorAuthority>; images: string; render: Render; style: ChildAnchorInspectedStyleJudge;
  design: ChildAnchorInspectedDesignJudge; check: () => void; save: (name: string, value: unknown) => void; log: (line: string) => void }) {
  const { technique, request, context, child } = a.anchor;
  const refs = technique.map((t, i) => {
    const imageName = `style_ref_${i + 1}.png`, file = path.join(a.images, imageName);
    writeFileSync(file, t.bytes, { flag: 'wx' });
    if (previewSha(readFileSync(file)) !== t.sha256) fail('child_anchor_reference_changed');
    return { imageName, imageSha: t.sha256 };
  });
  const attempt = async (step: 'reference_child' | 'reference_child_repair', prompt: string, inputs: AuditionImage[], mode: 'style' | 'book_design',
    roles: readonly BookDesignReferenceRole[] | undefined, references: ChildAnchorRecipe['references'], rejected: AuditionImage | null) => {
    a.check();
    const candidate = await a.render(step, prompt, inputs, mode, roles); a.check();
    if (rejected && candidate.imageSha === rejected.imageSha) fail('fresh_book_child_repair_unchanged');
    const recipe = childAnchorAttemptRecipe(step, mode, references, prompt, child.age), recipeSha = childAnchorRecipeSha(recipe);
    const styleAnswer = await a.style(`${step}_style_qa`, candidate, context, recipeSha); a.check();
    const style = childAnchorStyleDisposition(styleAnswer, candidate.imageSha, childAnchorInspectionContextSha(context), recipeSha);
    a.save(`${step}_style_review`, { recipe, recipeSha, ...style }); a.log(`${step} style: ${style.disposition}`);
    if (style.disposition === 'held_uncertain') return { candidate, recipe, style, design: null, outcome: childAnchorDisposition(style, null) };
    const design = childAnchorInspectedDesignDisposition(await a.design(`${step}_qa`, candidate, context, recipe), candidate.imageSha, context, recipe); a.check();
    a.save(`${step}_design_review`, { recipe, recipeSha, design: design.design, apparentAge: design.apparentAge, visibleEvidence: design.visibleEvidence,
      unobservedConditional: design.unobservedConditional,
      ...('acceptedDeviations' in design ? { acceptedDeviations: design.acceptedDeviations, recognizableCharacter: design.recognizableCharacter } : {}), review: design.full });
    a.log(`${step} design: ${design.design}, apparent age: ${design.apparentAge.verdict}`);
    return { candidate, recipe, style, design, outcome: childAnchorDisposition(style, design) };
  };
  let current = await attempt('reference_child', request.prompt, refs, 'style', undefined, technique.map(t => ({ role: t.label, sha256: t.sha256 })), null);
  if (current.outcome.disposition === 'repair') {
    const rejected = current.candidate, prompt = childAnchorCorrectionPrompt(request.core, current.outcome.corrections);
    assertChildAnchorRenderPlan(prompt, 1, 'book_design', CHILD_ANCHOR_CORRECTION_ROLES);
    a.save('reference_child_correction_input', { candidate: rejected, corrections: current.outcome.corrections, authority: 'rejected_edit_input_only_not_canonical' });
    current = await attempt('reference_child_repair', prompt, [rejected], 'book_design', CHILD_ANCHOR_CORRECTION_ROLES, [{ role: 'rejected_edit_target', sha256: rejected.imageSha }], rejected);
  }
  if (current.outcome.disposition !== 'passed' || !current.design) return { status: 'held' as const, disposition: current.outcome.disposition };
  const record = childAnchorInspectedAdoptionRecord(context, current.recipe, current.style.review, current.design.full);
  const accepted = assertChildAnchorInspectedAccepted(record, current.candidate.imageSha, context);
  return { status: 'passed' as const, candidate: current.candidate, record, acceptedDeviations: accepted.acceptedDeviations };
}

/**
 * The inspected anchor's acceptance as the stage actually requested and was answered: each attempt's recipe rebuilt from the admitted request
 * (the correction's prompt from the first attempt's settled answers), its render wire the planned request, each review wire exactly the
 * request binding that recipe and THIS context to the returned candidate, each answer the settled provider output; exactly these calls; the
 * adoption is the record those answers derive. A saved adoption's own echoes are never the authority.
 */
export async function assertInspectedChildSettled(bookDir: string, anchor: ReturnType<typeof anchorAuthority>, adoption: any, candidateBytes: Buffer) {
  const childDir = path.join(bookDir, 'child'), paid = path.join(childDir, 'paid-stages'), images = path.join(childDir, 'illustrations');
  const same = (x: unknown, y: unknown) => canonicalJson(x) === canonicalJson(y);
  const settled = (step: string) => {
    const at = (k: string) => path.join(paid, `${step}.${k}.json`);
    if (!existsSync(at('result'))) fail('child_anchor_evidence_missing');
    const result = json(at('result'));
    if (result.completed !== true || !Number.isSafeInteger(result.estimatedMicroUsd)) fail('child_anchor_evidence_missing');
    return { wire: json(at('wire')), receipt: json(at('receipt')) };
  };
  const answer = (receipt: any) => { try { return JSON.parse(receipt.raw.output_text); } catch { return fail('child_anchor_evidence_missing'); } };
  const { request, technique, context, child } = anchor, contextSha = childAnchorInspectionContextSha(context);
  const attempt = async (step: 'reference_child' | 'reference_child_repair', prompt: string, mode: 'style' | 'book_design',
    roles: readonly BookDesignReferenceRole[] | undefined, references: ChildAnchorRecipe['references']) => {
    const recipe = childAnchorAttemptRecipe(step, mode, references, prompt, child.age), recipeSha = childAnchorRecipeSha(recipe);
    const render = settled(step), plan = assertChildAnchorRenderPlan(prompt, references.length, mode, roles), candidate = render.receipt?.candidate as AuditionImage;
    if (!same(render.wire.body, plan.bodyWithoutBinaryImage) || render.wire.mode !== plan.apiMode || !same(render.wire.referenceRoles ?? null, plan.referenceRoles ?? null) ||
        !Array.isArray(render.wire.references) || !same(render.wire.references.map((r: AuditionImage) => r.imageSha), references.map(r => r.sha256)) ||
        typeof candidate?.imageSha !== 'string' || !/^[a-z0-9_]+\.png$/.test(candidate.imageName ?? '')) fail('child_anchor_render_binding');
    const bytes = fileBytes(path.join(images, candidate.imageName));
    if (previewSha(bytes) !== candidate.imageSha) fail('child_anchor_render_binding');
    const styleCall = settled(`${step}_style_qa`);
    if (!same(styleCall.wire, inspectedStyleWire(candidate, bytes, context, recipeSha))) fail('child_anchor_review_binding');
    const style = childAnchorStyleDisposition(answer(styleCall.receipt), candidate.imageSha, contextSha, recipeSha);
    if (style.disposition === 'held_uncertain') return { candidate, recipe, style, design: null, outcome: childAnchorDisposition(style, null) };
    const designCall = settled(`${step}_qa`);
    if (!same(designCall.wire, await inspectedDesignWire(candidate, bytes, context, recipe))) fail('child_anchor_review_binding');
    const design = childAnchorInspectedDesignDisposition(answer(designCall.receipt), candidate.imageSha, context, recipe);
    return { candidate, recipe, style, design, outcome: childAnchorDisposition(style, design) };
  };
  const first = await attempt('reference_child', request.prompt, 'style', undefined, technique.map(t => ({ role: t.label, sha256: t.sha256 })));
  const final = first.outcome.disposition !== 'repair' ? first
    : await attempt('reference_child_repair', childAnchorCorrectionPrompt(request.core, first.outcome.corrections), 'book_design', CHILD_ANCHOR_CORRECTION_ROLES,
      [{ role: 'rejected_edit_target', sha256: first.candidate.imageSha }]);
  const candidateSha = previewSha(candidateBytes);
  if (final.outcome.disposition !== 'passed' || !final.design || final.candidate.imageSha !== candidateSha) fail('child_anchor_not_accepted');
  const steps = (final === first ? ['reference_child'] : ['reference_child', 'reference_child_repair']).flatMap(s => [s, `${s}_style_qa`, `${s}_qa`]);
  const claimed = readdirSync(paid).filter(n => n.endsWith('.claim.json')).map(n => n.slice(0, -'.claim.json'.length));
  if (!same(claimed.sort(), steps.sort())) fail('child_anchor_evidence_steps');
  const record = childAnchorInspectedAdoptionRecord(context, final.recipe, final.style.review, final.design!.full);
  if (!same(adoption?.anchor, record) || adoption?.candidate?.imageSha !== candidateSha || !same(adoption?.context, context)) fail('child_anchor_evidence_binding');
  return assertChildAnchorInspectedAccepted(record, candidateSha, context);
}

// ---------------------------------------------------------------------------------------------------------------
// Stage 3: the book (the audition grant derived from the verified ledgers, then the reviewed audition through its experiment guard).
// ---------------------------------------------------------------------------------------------------------------
export const FRESH_BOOK_AUDITION_SLOT = 'fresh-book-usd7' as const;
const auditionStartFile = (env: FreshBookEnv) => path.join(env.authorityRoot, 'owner-cycle-20261017-fresh-book-usd7.audition.json');
async function freshAuditionGrant(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, profile: FreshBookProfile): Promise<AuditionGrant> {
  const layout = readReviewedBookLayout(path.join(config.bookDir, 'book-layout.json'));
  if (canonicalJson(layout) !== canonicalJson(layoutFor(profile, layout.childImage))) fail('fresh_book_layout');
  const loaded = loadReviewedBook(config.bookDir, workspace(), undefined, layout);
  await assertInspectedChildSettled(config.bookDir, anchorAuthority(profile, loaded.book.plan.wardrobe), json(path.join(config.bookDir, 'child', 'reference_child_adoption.json')),
    loaded.childBytes);
  const stages = bookStages(config.bookDir).slice(0, 2);
  const ledger = freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env), stages });
  // Each stage's saved spend record must say what its own calls re-derive to (a summary is never the authority).
  const evidence = stages.map((s, i) => {
    verifyMeterRecords(path.join(s.dir, 'paid-stages'), s.rules);
    const file = path.join(s.dir, 'spend.json'), saved = json(file);
    if (saved.newKnownApiMicroUsd !== ledger.stages[i].knownMicroUsd || saved.unknownCost || saved.unknownOutcome) fail('fresh_book_ledger_record');
    return { file, sha256: previewSha(fileBytes(file)) };
  });
  const claimSha256 = previewSha(fileBytes(path.join(env.authorityRoot, FRESH_BOOK_CYCLE.claimName)));
  return auditionGrantSchema.parse({ version: 'audition-spend-grant/v1', approvalReference: FRESH_BOOK_CYCLE.approval,
    book: { requestId: loaded.queued.requestId, storyboardDigest: loaded.book.storyboardDigest },
    ledger: { priorKnownApiMicroUsd: ledger.bookKnownMicroUsd, evidence,
      note: `Fresh-book ledger under the one USD 7 book subcap (cycle ${FRESH_BOOK_CYCLE.id}): the text and child stages above, each re-derived; the diagnostic subcap (${ledger.diagnosticSettledMicroUsd} microUSD settled) is separate; old books and their carry are untouched.` },
    capMicroUsd: ledger.nextCapMicroUsd, maxCalls: AUDITION_WORST_CASE_CALLS,
    scope: { mode: 'render', pages: [0, 1, 2, 3, 4, 5, 6, 7, 8], sample: earliestSameScenePair(loaded.book) },
    claudeMax: 'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger',
    experiment: { slot: FRESH_BOOK_AUDITION_SLOT, claimSha256 } });
}

export async function runFreshBookBook(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void; resume?: true }) {
  const { config, env } = args;
  // The audition grant is pinned too (absent on a start, its bytes on a resume); the start record is part of the authority roots.
  const earlier = ['request.json', 'admission.json', 'text', 'child', 'book-layout.json', 'audition.grant.json'];
  const admitted = await admitStage({ ...args, earlier });
  admitted.guard();
  if (sealedStatus(path.join(config.bookDir, 'text')) !== 'review_supported' || sealedStatus(path.join(config.bookDir, 'child')) !== 'child_reference_passed' ||
      existsSync(path.join(env.authorityRoot, FRESH_BOOK_CYCLE.outcomeName))) fail('fresh_book_stage_not_passed');
  const grant = await freshAuditionGrant(config, env, admitted.planned.rereview, admitted.planned.profile);
  const grantFile = path.join(config.bookDir, 'audition.grant.json'), out = path.join(config.bookDir, 'audition'), start = auditionStartFile(env);
  admitted.guard();
  if (args.resume) {
    if (!existsSync(grantFile) || canonicalJson(json(grantFile)) !== canonicalJson(grant) || !existsSync(start) || !existsSync(out)) fail('fresh_book_audition_binding');
    if (canonicalJson(json(start)) !== canonicalJson({ version: 'fresh-book-audition-start/v1', out: path.resolve(out), grantSha256: previewSha(fileBytes(grantFile)),
      claimSha256: grant.experiment!.claimSha256 })) fail('fresh_book_audition_binding');
  } else {
    if (existsSync(grantFile) || existsSync(start) || existsSync(out)) fail('fresh_book_audition_used');
    exclusiveJson(grantFile, grant);
    exclusiveJson(start, { version: 'fresh-book-audition-start/v1', out: path.resolve(out), grantSha256: previewSha(fileBytes(grantFile)), claimSha256: grant.experiment!.claimSha256 });
    // The audition grant and its start record are this stage's own writes: exactly these two are accepted, nothing else that moved.
    admitted.recapture(['book/audition.grant.json', `authority/${path.basename(start)}`]);
  }
  process.env.GPT_IMAGE_EDIT_MAX_REFERENCES ??= '4';
  const result = await runReviewedAudition({ bookDir: config.bookDir, out, keyFile: config.keyEnvFile, grantFile, signal: args.signal, log: args.log,
    layout: readReviewedBookLayout(path.join(config.bookDir, 'book-layout.json')), ...(args.resume ? { resume: true as const } : {}),
    experiment: { slot: FRESH_BOOK_AUDITION_SLOT, claimSha256: grant.experiment!.claimSha256, guard: admitted.guard } });
  if (result.mode !== 'render') return fail('fresh_book_audition_mode');
  // A drawn page that is not qa_supported is held; an undrawn one is pending. Complete only when the audition itself is fully supported.
  const gate = (status: unknown): PageGate['disposition'] => status === 'qa_supported' ? 'passed' : 'held_uncertain';
  const pages = result.manifest.pages.filter(p => p.pageNumber > 0).map(p => ({ page: p.pageNumber, disposition: gate(p.status) }));
  const cover = result.manifest.pages.find(p => p.pageNumber === 0);
  const reading = freshBookReadingOrder(cover ? gate(cover.status) : null, pages);
  const status = reading.status === 'complete' && result.manifest.status !== 'qa_supported_audition' ? 'partial' as const : reading.status;
  const ledger = freshBookLedger(config, env, admitted.planned.rereview);
  exclusiveJson(path.join(config.bookDir, `book-status${args.resume ? `-${Date.now()}` : ''}.json`), { status, manifestStatus: result.manifest.status,
    order: reading.order, ledger, viewer: out, runtimeEligible: false });
  finish(env, status, { manifestStatus: result.manifest.status, ledger });
  return { status, manifestStatus: result.manifest.status, order: reading.order, ledger };
}

function argValue(name: string) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; }
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const config = freshBookConfig(argValue('--config') ?? fail('fresh_book_arguments')), env = realFreshBookEnv();
  const stage = ['plan', 'text', 'child', 'book'].find(s => process.argv.includes(s)) ?? 'plan';
  const execute = process.argv.includes('--execute');
  const done = (p: Promise<unknown>) => p.then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
  if (stage === 'plan' || !execute) done(Promise.resolve().then(() => { const { plan, grantDraft, state } = planFreshBook(config, env); return { plan, grantDraft, state }; }));
  else {
    const controller = new AbortController(); process.once('SIGINT', () => controller.abort());
    const common = { config, env, grantFile: argValue('--grant') ?? fail('fresh_book_arguments'), grantSha: argValue('--grant-sha') ?? fail('fresh_book_arguments'),
      signal: controller.signal, log: (line: string) => console.log(line) };
    done(stage === 'text' ? runFreshBookText(common) : stage === 'child' ? runFreshBookChild(common)
      : runFreshBookBook({ ...common, ...(process.argv.includes('--resume') ? { resume: true as const } : {}) }));
  }
}
export type { ChildAnchorInspectionContext };
