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
 * The ONE same-book text recovery line (owner amendment 2026-10-18), after this book's failed_text record:
 *   ... --config <abs json> recovery-plan --original-grant <abs consumed grant.json>          (dry: plan + recovery grant draft)
 *   ... --config <abs json> recover --execute --grant <abs recovery grant> --grant-sha <sha256>
 *   ... --config <abs json> <child|book> --recovery --execute --grant <abs recovery grant> --grant-sha <sha256> [--resume]
 * The ONE storyboard-only repair line (owner brief 2026-10-18), after the recovery's held_text record (its storyboard held by its review):
 *   ... --config <abs json> storyboard-repair-plan --recovery-grant <abs consumed recovery grant.json>   (dry: plan + repair grant draft)
 *   ... --config <abs json> storyboard-repair-preview --recovery-grant <abs consumed recovery grant.json> (dry: the planner request, measured)
 *   ... --config <abs json> storyboard-repair --execute --grant <abs repair grant> --grant-sha <sha256>
 *   ... --config <abs json> <child|book> --storyboard-repair --execute --grant <abs repair grant> --grant-sha <sha256> [--resume]
 * The ONE diagnosed storyboard continuation (owner amendment 2026-10-19), after the repair's held_storyboard_repair record (the stage's second
 * consecutive held candidate: the engine's recovery state requires its diagnosis and a changed strategy):
 *   ... --config <abs json> storyboard-continuation-plan --repair-grant <abs consumed repair grant.json>     (dry: plan + continuation grant draft)
 *   ... --config <abs json> storyboard-continuation-preview --repair-grant <abs consumed repair grant.json>  (dry: recovery state, diagnosis, the measured request)
 *   ... --config <abs json> storyboard-continuation --execute --grant <abs continuation grant> --grant-sha <sha256>
 *   ... --config <abs json> <child|book> --storyboard-continuation --execute --grant <abs continuation grant> --grant-sha <sha256> [--resume]
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
import { SIMPLE_STORYBOARD_INPUT_LIMIT, type SimpleStoryboardDiagnosticCall } from '../lib/personal-wizard/simple-storyboard-diagnostic';
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
  type PageGate, FRESH_BOOK_RECOVERY, freshBookRecoveryGrantSchema, claimFreshBookRecovery, assertFreshBookRecoveryPaid, type FreshBookRecoveryGrant,
  FRESH_BOOK_STORYBOARD_REPAIR, freshBookStoryboardRepairGrantSchema, claimFreshBookStoryboardRepair, assertFreshBookStoryboardRepairPaid,
  type FreshBookStoryboardRepairGrant, FRESH_BOOK_STORYBOARD_CONTINUATION, freshBookStoryboardContinuationGrantSchema, claimFreshBookStoryboardContinuation,
  assertFreshBookStoryboardContinuationPaid, type FreshBookStoryboardContinuationGrant } from './personal-fresh-book-authority';
import { prepareSourceCitationCorrection, applySourceCitationCorrection, restoreSourceCitationReview } from '../lib/personal-wizard/story-source-citations';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, storyboardReviewDisposition, personalStoryboardReviewInput,
  storyboardRecovery } from '../lib/personal-wizard/storyboard';
import { storyboardRepairFindings, type StoryboardRepair } from '../lib/personal-wizard/storyboard-repair';
import { recoveryState, STAGE_RECOVERY_VERSION } from '../lib/personal-wizard/stage-recovery';
import { chainAttempts, diagnosisDigest, STORYBOARD_MAX_ATTEMPTS, STORYBOARD_DIAGNOSIS_VERSION } from '../lib/personal-wizard/storyboard-diagnosis';
import { STORYBOARD_SELF_CHECK_VERSION } from '../lib/personal-wizard/storyboard-self-check';
import { STORYBOARD_REVIEW_IMPACT_VERSION } from '../lib/personal-wizard/storyboard-review-impact';
import { STORYBOARD_REPAIR_INPUT_FILE } from './personal-simple-book-reviewed-audition';
import type { CausalStage } from '../lib/personal-wizard/story-causal-experiment-runner';

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
/**
 * The recovery's API meter: the one citation correction (a Sol reader request of its own stage, settled like the readers, claimed at the
 * normal 600000 reservation when its request derives no more) and the still-required storyboard review under its own rule.
 */
const correctionRule: ReturnType<MeterRules> = { settle: TEXT_RULES('comparison')!.settle, reserve: wire => {
  const derived = wire?.stage === 'citation_correction' ? TEXT_RULES('comparison')!.reserve(wire) : null;
  return derived !== null && derived <= FRESH_BOOK_RECOVERY.correctionReserveMicroUsd ? FRESH_BOOK_RECOVERY.correctionReserveMicroUsd : null;
} };
const RECOVERY_RULES: MeterRules = step => step === 'citation_correction' ? correctionRule : step === 'storyboard_review' ? TEXT_RULES(step) : undefined;
/**
 * F6 (Codex 2026-10-18): the owner's fixed normal review reservation. A storyboard review claimed from now on reserves the larger of this floor
 * and its request's own computed bound (a higher bound stays higher), and the SAME rule is its claim, its journal record and its replay. The
 * consumed text and recovery folders keep the rule their recorded claims were made under (their meters re-derive them as recorded: nothing is
 * renormalized, repriced or rewritten); every new review of this book is on the storyboard-repair line, which uses only the floored rule.
 */
export const REVIEW_RESERVE_FLOOR_MICRO_USD = FRESH_BOOK_STORYBOARD_REPAIR.reviewReserveFloorMicroUsd;
export const flooredReviewRule = (rule: NonNullable<ReturnType<MeterRules>>): NonNullable<ReturnType<MeterRules>> => ({ settle: rule.settle,
  reserve: wire => { const derived = rule.reserve(wire); return derived === null ? null : Math.max(REVIEW_RESERVE_FLOOR_MICRO_USD, derived); } });
/** The storyboard repair's API meter: its one Sol storyboard review, under the floored rule. Anything else is refused by the meter. */
export const STORYBOARD_REPAIR_RULES: MeterRules = step => step === 'storyboard_review' ? flooredReviewRule(TEXT_RULES(step)!) : undefined;
/** The diagnosed continuation's API meter: its one Sol storyboard review, under the same floored rule (claim, journal and replay alike). */
export const STORYBOARD_CONTINUATION_RULES: MeterRules = STORYBOARD_REPAIR_RULES;
/**
 * Which ledger a line keeps: the original stages, the recovery's (after the failed text), the storyboard repair's (after the held recovery), or
 * the diagnosed continuation's (after the held repair).
 */
type LedgerLine = false | true | 'storyboard_repair' | 'storyboard_continuation';
/** The book's stages in ledger order (each folder re-derived under its own rules); each later line adds its own folder after the earlier ones. */
const bookStages = (bookDir: string, recovery: LedgerLine = false): FreshBookStage[] => [
  { name: 'text', dir: path.join(bookDir, 'text'), rules: TEXT_RULES, maxCalls: TEXT_API_CALLS },
  ...(recovery ? [{ name: FRESH_BOOK_RECOVERY.folder, dir: path.join(bookDir, FRESH_BOOK_RECOVERY.folder), rules: RECOVERY_RULES, maxCalls: FRESH_BOOK_RECOVERY.apiCalls }] : []),
  ...(recovery === 'storyboard_repair' || recovery === 'storyboard_continuation' ? [{ name: FRESH_BOOK_STORYBOARD_REPAIR.folder,
    dir: path.join(bookDir, FRESH_BOOK_STORYBOARD_REPAIR.folder), rules: STORYBOARD_REPAIR_RULES, maxCalls: FRESH_BOOK_STORYBOARD_REPAIR.apiCalls }] : []),
  ...(recovery === 'storyboard_continuation' ? [{ name: FRESH_BOOK_STORYBOARD_CONTINUATION.folder, dir: path.join(bookDir, FRESH_BOOK_STORYBOARD_CONTINUATION.folder),
    rules: STORYBOARD_CONTINUATION_RULES, maxCalls: FRESH_BOOK_STORYBOARD_CONTINUATION.apiCalls }] : []),
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
/** Recovery-line grants also pin the correction protocol and its compiler. */
export const FRESH_BOOK_RECOVERY_PINNED = Object.freeze([...FRESH_BOOK_PINNED, 'lib/personal-wizard/story-source-citations.ts',
  'lib/personal-wizard/story-causal-experiment.ts']);
/** Storyboard-repair-line grants also pin the repair and visible-moment contracts, the storyboard diagnostic and the provider decoder. */
export const FRESH_BOOK_STORYBOARD_REPAIR_PINNED = Object.freeze([...FRESH_BOOK_RECOVERY_PINNED, 'lib/personal-wizard/storyboard-repair.ts',
  'lib/personal-wizard/storyboard-visible-moment.ts', 'lib/personal-wizard/simple-storyboard-diagnostic.ts', 'lib/personal-wizard/book-openai.ts']);
/** Continuation-line grants also pin the reusable recovery reducer, the diagnosis, the self-check, the typed materiality and the output caps. */
export const FRESH_BOOK_STORYBOARD_CONTINUATION_PINNED = Object.freeze([...FRESH_BOOK_STORYBOARD_REPAIR_PINNED, 'lib/personal-wizard/stage-recovery.ts',
  'lib/personal-wizard/storyboard-diagnosis.ts', 'lib/personal-wizard/storyboard-self-check.ts', 'lib/personal-wizard/storyboard-review-impact.ts',
  'lib/personal-wizard/review-impact.ts', 'lib/personal-wizard/storyboard-moments.ts', 'lib/personal-wizard/book-config.ts']);

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
const layoutFor = (profile: FreshBookProfile, childImage = 'reference_child.png', storyboardDir = 'text'): ReviewedBookLayout => reviewedBookLayoutSchema.parse({
  version: 'reviewed-book-layout/v1', seed: profile.seed, childDesign: profile.child.design, storyboardDir, childDir: 'child', childImage,
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
  for (const name of [...names, FRESH_BOOK_CYCLE.claimName, FRESH_BOOK_CYCLE.outcomeName, path.basename(auditionStartFile(env)),
    FRESH_BOOK_RECOVERY.claimName, FRESH_BOOK_RECOVERY.outcomeName, FRESH_BOOK_RECOVERY.auditionStartName, FRESH_BOOK_RECOVERY.successorName,
    FRESH_BOOK_STORYBOARD_REPAIR.claimName, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName, FRESH_BOOK_STORYBOARD_REPAIR.auditionStartName,
    FRESH_BOOK_STORYBOARD_REPAIR.successorName, FRESH_BOOK_STORYBOARD_CONTINUATION.claimName, FRESH_BOOK_STORYBOARD_CONTINUATION.outcomeName,
    FRESH_BOOK_STORYBOARD_CONTINUATION.auditionStartName, FRESH_BOOK_STORYBOARD_CONTINUATION.successorName]) {
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

/**
 * The consumed original authority and failed evidence the recovery stands on, re-read exactly: the original grant is the one its claim
 * names (its own head and book), the fixed outcome and the text seal are this failure (failed_text / critic_evidence), and the original
 * text ledger is re-derived from its own records. Anything else (another failure, a foreign claim or grant) refuses.
 */
function recoveryOriginal(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, profile: FreshBookProfile, originalGrantFile: string) {
  if (!path.isAbsolute(originalGrantFile)) fail('fresh_book_recovery_original');
  const at = (name: string) => path.join(env.authorityRoot, name), textDir = path.join(config.bookDir, 'text');
  const files = { grant: originalGrantFile, claim: at(FRESH_BOOK_CYCLE.claimName), outcome: at(FRESH_BOOK_CYCLE.outcomeName), seal: path.join(textDir, 'sealed.json'),
    request: path.join(config.bookDir, 'request.json'), admission: path.join(config.bookDir, 'admission.json') };
  if (Object.values(files).some(f => !existsSync(f))) fail('fresh_book_recovery_original');
  const digest = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, previewSha(fileBytes(f))])) as Record<keyof typeof files, string>;
  const grant = freshBookGrantSchema.parse(json(files.grant)), claim = json(files.claim), outcome = json(files.outcome), seal = json(files.seal);
  const sameDir = (p: unknown) => typeof p === 'string' && path.resolve(p).toLowerCase() === path.resolve(config.bookDir).toLowerCase();
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.grantSha256 !== digest.grant || !sameDir(claim.bookDir) || !sameDir(grant.bookDir) ||
      claim.profileSha256 !== grant.profileSha256 || grant.profileSha256 !== freshBookProfileSha(profile) || claim.engineHead !== grant.engine.head) fail('fresh_book_recovery_original');
  if (outcome.cycle !== FRESH_BOOK_CYCLE.id || outcome.status !== FRESH_BOOK_RECOVERY.failedOutcome || outcome.code !== FRESH_BOOK_RECOVERY.failedCode ||
      canonicalJson(seal) !== canonicalJson({ status: 'failed', code: FRESH_BOOK_RECOVERY.failedCode, runtimeEligible: false })) fail('fresh_book_recovery_original');
  const text = freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env), stages: bookStages(config.bookDir).slice(0, 1) });
  return { original: { grantFile: path.resolve(originalGrantFile), grantSha256: digest.grant, engineHead: grant.engine.head, claimSha256: digest.claim,
    outcomeSha256: digest.outcome, textSealSha256: digest.seal, textEvidenceSha256: previewSha(canonicalJson(folderBaseline(textDir))),
    requestSha256: digest.request, admissionSha256: digest.admission },
  ledger: { diagnosticSettledMicroUsd: text.diagnosticSettledMicroUsd, originalTextKnownMicroUsd: text.bookKnownMicroUsd, originalTextCalls: text.stages[0].calls } };
}

/** Provider-free plan and the recovery grant this exact state needs (no key, no provider, no write). */
export function planFreshBookRecovery(config: FreshBookConfig, env: FreshBookEnv, originalGrantFile: string) {
  const base = planFreshBook(config, env), { original, ledger } = recoveryOriginal(config, env, base.rereview, base.profile, originalGrantFile);
  const plan = { version: FRESH_BOOK_RECOVERY.version, cycle: FRESH_BOOK_CYCLE.id, amendment: FRESH_BOOK_RECOVERY.amendment, basePlanSha256: base.grantDraft.nativePlanSha256,
    bookDir: path.resolve(config.bookDir), folder: FRESH_BOOK_RECOVERY.folder, storyboardDir: FRESH_BOOK_RECOVERY.folder,
    replay: { stages: ['author', 'editor', 'final_review', 'comparison'], from: 'text (saved wires/receipts, byte-exact; no provider callback)' },
    correction: { stage: 'citation_correction', protocol: 'story-source-citations-correction/v1', maxCalls: FRESH_BOOK_RECOVERY.correctionCalls,
      reserveMicroUsd: FRESH_BOOK_RECOVERY.correctionReserveMicroUsd, model: SOL },
    then: ['storyboard (Opus 5.5 Claude Max planner)', 'storyboard_review (Sol 6.1)'], downstream: ['child --recovery', 'book --recovery [--resume]'],
    caps: { ...base.plan.caps, recoveryApiCalls: FRESH_BOOK_RECOVERY.apiCalls }, claim: path.join(env.authorityRoot, FRESH_BOOK_RECOVERY.claimName),
    outcome: path.join(env.authorityRoot, FRESH_BOOK_RECOVERY.outcomeName), successor: path.join(env.authorityRoot, FRESH_BOOK_RECOVERY.successorName),
    successorAdmission: 'downstream re-derives the successor from the failed evidence (request, paid wire and raw answer, strict apply, readings) and its one durable record',
    providerCalls: 0, keyRead: false };
  const engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_RECOVERY_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft: FreshBookRecoveryGrant = freshBookRecoveryGrantSchema.parse({ version: 'fresh-book-recovery-grant/v1', cycle: FRESH_BOOK_CYCLE.id,
    approval: FRESH_BOOK_CYCLE.approval, amendment: FRESH_BOOK_RECOVERY.amendment, profileSha256: base.plan.profileSha256, bookDir: path.resolve(config.bookDir),
    original, ledger, allowance: { correctionCalls: FRESH_BOOK_RECOVERY.correctionCalls, correctionReserveMicroUsd: FRESH_BOOK_RECOVERY.correctionReserveMicroUsd,
      apiCalls: FRESH_BOOK_RECOVERY.apiCalls }, engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)) });
  const probe = (f: () => unknown) => { try { return f(); } catch (e) { return { refused: e && typeof e === 'object' && 'code' in e ? e.code : String(e) }; } };
  const state = { recoveryClaimExists: existsSync(plan.claim), recoveryOutcomeExists: existsSync(plan.outcome), successorExists: existsSync(plan.successor),
    recoveryFolderExists: existsSync(path.join(config.bookDir, FRESH_BOOK_RECOVERY.folder)), ledger: probe(() => freshBookLedger(config, env, base.rereview, true)),
    executablePinned: probe(() => assertFreshBookExecutable(config)), engine };
  return { plan, grantDraft, state, profile: base.profile, prepared: base.prepared, rereview: base.rereview };
}

/**
 * A recovery-line stage's admission, as admitStage: the baseline (recovery grant bytes, the original grant's bytes, configuration, profile,
 * lineage, both lines' authority records, earlier stage entries including the failed text) pinned FIRST and held across every await; the
 * grant is exactly the draft this state rebuilds, at the clean reviewed head. Its guard adds the recovery claim and the original claim.
 */
async function admitRecovery(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal; earlier: string[] }) {
  const bytes = fileBytes(a.grantFile);
  if (previewSha(bytes) !== a.grantSha) fail('fresh_book_recovery_grant');
  const parsed = freshBookRecoveryGrantSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success) return fail('fresh_book_recovery_grant');
  const originalBytes = fileBytes(parsed.data.original.grantFile), rereview = loadRereview(a.config);
  let roots = rootsOf(a.config, a.env, rereview, a.earlier);
  const planned = planFreshBookRecovery(a.config, a.env, parsed.data.original.grantFile);
  const outcome = await assertFreshBookAdmission(planned.rereview, a.env);
  const engine = a.env.head();
  if (canonicalJson(parsed.data) !== canonicalJson(planned.grantDraft)) fail('fresh_book_recovery_grant');
  if (!engine.clean || engine.head !== planned.grantDraft.engine.head || engine.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    if (!fileBytes(a.grantFile).equals(bytes)) fail('fresh_book_recovery_grant');
    if (!fileBytes(planned.grantDraft.original.grantFile).equals(originalBytes)) fail('fresh_book_recovery_original');
    if (canonicalJson(rootsOf(a.config, a.env, rereview, a.earlier)) !== canonicalJson(roots)) fail('fresh_book_roots_changed');
    const e = a.env.head();
    if (!e.clean || e.head !== planned.grantDraft.engine.head || e.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(planned.grantDraft.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
  };
  const guard = () => { same(); assertFreshBookRecoveryPaid({ env: a.env, grantFile: a.grantFile, grantSha: a.grantSha, profile: planned.profile, workspace: workspace() }); };
  const recapture = (added: string[]) => {
    const next = rootsOf(a.config, a.env, rereview, a.earlier), changed = Object.keys(next).filter(k => next[k] !== roots[k]);
    if (canonicalJson(Object.keys(next).sort()) !== canonicalJson(Object.keys(roots).sort()) || canonicalJson(changed.sort()) !== canonicalJson([...added].sort()) ||
        added.some(k => roots[k] !== 'absent' || next[k] === 'absent')) fail('fresh_book_roots_changed');
    roots = next; same();
  };
  same();
  return { planned, outcome, same, guard, recapture, grant: planned.grantDraft };
}

/**
 * The recovery's successor, re-derived from the immutable failed evidence at its completion and at every downstream entry (never its own
 * seal, summary or a re-captured folder): its admission is this grant's; the correction request rebuilds from the failed reading's saved
 * request and answer; the one paid correction wire is exactly that request and its answer is its own raw output; the strict apply reproduces
 * the saved correction; the saved result's readings are the untouched reading and the corrected one, on the reviewed manuscript. Completion
 * writes the ONE durable successor record (the folder by digest, bound to this grant and both claims); afterwards it must equal the re-derivation.
 */
function verifyRecoverySuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grant: FreshBookRecoveryGrant; grantSha: string; requestId: string;
  rereviewOutcome: unknown }, write = false) {
  const { config, env, grant } = a, oldDir = path.join(config.bookDir, 'text'), dir = path.join(config.bookDir, FRESH_BOOK_RECOVERY.folder);
  const refuse = (): never => fail('fresh_book_recovery_successor'), same = (x: unknown, y: unknown) => canonicalJson(x) === canonicalJson(y);
  const successorFile = path.join(env.authorityRoot, FRESH_BOOK_RECOVERY.successorName), READERS = ['final_review', 'comparison'] as const;
  const original: WirePolicy = { executable: config.executable, executableSha256: config.executableSha256, workspace: path.join(oldDir, 'cli-workspace'),
    maxWireBytes: 104000, rates: { opus: RATES.opus, astra: RATES.sol }, openAIReviewModel: SOL };
  const wireOf = (call: { stage: CausalStage; instructions: string; input: string; schema: z.ZodTypeAny }, policy: WirePolicy) =>
    prepareCausalWire({ ...call, maxOutputTokens: 16000, role: 'astra', conversationKey: `fresh-book:${a.requestId}:${call.stage}` }, policy, 2000000);
  /** A settled API call: its claim, wire and result bind each other, and the saved wire is exactly the rebuilt request. */
  const settled = (folder: string, step: string, wire?: unknown) => {
    const file = (k: string) => path.join(folder, 'paid-stages', `${step}.${k}.json`);
    const claim = json(file('claim')), saved = json(file('wire')), result = json(file('result'));
    if (claim.step !== step || previewSha(canonicalJson(saved)) !== claim.wireDigest || result.wireDigest !== claim.wireDigest || result.completed !== true ||
        (wire !== undefined && !same(JSON.parse(JSON.stringify(wire)), saved))) refuse();
    return { claim, wire: saved, receiptFile: file('receipt'), receipt: json(file('receipt')) };
  };
  /** A saved reading of the failed text: its review restored from the request it sent (which must rebuild exactly) and its own settled answer. */
  const reading = (step: (typeof READERS)[number]) => {
    const s = settled(oldDir, step), { packetDigest, packet } = JSON.parse(s.wire.payload.input), review = restoreSourceCitationReview(packet, s.wire.payload.instructions);
    if (packetDigest !== review.packetDigest) refuse();
    settled(oldDir, step, wireOf({ stage: step, instructions: review.instructions, input: canonicalJson({ packetDigest: review.packetDigest, packet: review.packet }),
      schema: review.schema }, original));
    const raw = review.schema.parse(JSON.parse(s.receipt.raw.output_text));
    if (!same(raw, s.receipt.output)) refuse();
    return { review, raw, receiptFile: s.receiptFile };
  };
  let record: Record<string, unknown>;
  try {
    if (!same(json(path.join(dir, 'sealed.json')), { status: 'review_supported', corrections: 1, replayed: ['author', 'editor', 'final_review', 'comparison'],
      runtimeEligible: false })) refuse();
    const admission = json(path.join(dir, 'recovery-admission.json'));
    if (!same(Object.keys(admission).sort(), ['grantSha256', 'ledger', 'original', 'rereviewOutcome', 'version']) || admission.version !== FRESH_BOOK_RECOVERY.version ||
        admission.grantSha256 !== a.grantSha || !same(admission.original, grant.original) || !same(admission.rereviewOutcome, a.rereviewOutcome) ||
        admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd || admission.ledger?.bookKnownMicroUsd !== grant.ledger.originalTextKnownMicroUsd ||
        !same(admission.ledger?.stages?.[0], { name: 'text', knownMicroUsd: grant.ledger.originalTextKnownMicroUsd, calls: grant.ledger.originalTextCalls })) refuse();
    const request = json(path.join(dir, 'citation-correction-request.json')), stage = READERS.find(s => s === request.stage) ?? refuse();
    const failed = reading(stage), correction = prepareSourceCitationCorrection(failed.review, failed.raw);
    if (!same(request, { stage, failedReceiptSha256: previewSha(fileBytes(failed.receiptFile)), correctionDigest: correction.correctionDigest, body: correction.body })) refuse();
    const paid = settled(dir, 'citation_correction', wireOf({ stage: 'citation_correction' as CausalStage, instructions: correction.instructions, input: correction.input,
      schema: correction.schema }, { ...original, workspace: path.join(dir, 'cli-workspace') }));
    const answer = correction.schema.parse(JSON.parse(paid.receipt.raw.output_text));
    if (paid.claim.maximumMicroUsd !== FRESH_BOOK_RECOVERY.correctionReserveMicroUsd || !same(answer, paid.receipt.output)) refuse();
    const applied = applySourceCitationCorrection(failed.review, failed.raw, correction, answer);
    if (!same(json(path.join(dir, 'citation-correction.json')), { stage, ...applied.provenance, corrected: applied.corrected })) refuse();
    const result = json(path.join(dir, 'simple-book-result.json')), at = READERS.indexOf(stage);
    if (result.status !== 'review_supported' || !same(json(path.join(dir, 'visual_simple_book_result.json')), result) || !Array.isArray(result.readings) ||
        !same(result.readings.map((r: any) => r?.sourceEvidence?.output), READERS.map(s => s === stage ? applied.compiled.raw : reading(s).raw)) ||
        !same({ summary: result.readings[at].summary, findings: result.readings[at].findings }, { summary: applied.compiled.summary, findings: applied.compiled.findings })) refuse();
    // The successor's source is the manuscript the failed reading reviewed (no rewritten text).
    const reviewed = (failed.review.packet as any).revised ?? (failed.review.packet as any).manuscript;
    if (!same({ title: result.source?.manuscript?.title, pages: result.source?.manuscript?.pages?.map((p: any) => ({ pageNumber: p.pageNumber, text: p.text })) },
      { title: reviewed.title, pages: reviewed.pages.map((p: any) => ({ pageNumber: p.pageNumber, text: p.units.map((u: { text: string }) => u.text).join('') })) })) refuse();
    record = { cycle: FRESH_BOOK_CYCLE.id, recovery: FRESH_BOOK_RECOVERY.version, grantSha256: a.grantSha, originalClaimSha256: grant.original.claimSha256,
      recoveryClaimSha256: previewSha(fileBytes(path.join(env.authorityRoot, FRESH_BOOK_RECOVERY.claimName))), stage, correction: applied.provenance,
      successorSha256: previewSha(canonicalJson(folderBaseline(dir))) };
  } catch { return refuse(); }
  if (write) exclusiveJson(successorFile, record);
  else if (!existsSync(successorFile) || !same(json(successorFile), record)) refuse();
  return record;
}

/**
 * Which authority a downstream stage runs under: the original line; the recovery line (its successor text, its own claim and outcome); the
 * storyboard-repair line (its repaired storyboard of the recovery's held one, its own claim and outcome); or the diagnosed continuation line
 * (its storyboard continuing the repair's held one, its own claim and outcome).
 */
type Line = { kind: 'original' | 'recovery' | 'storyboard_repair' | 'storyboard_continuation'; recovery: boolean; ledger: LedgerLine; storyboardDir: string;
  claimName: string; outcomeName: string; auditionStart: (env: FreshBookEnv) => string };
const ORIGINAL_LINE: Line = { kind: 'original', recovery: false, ledger: false, storyboardDir: 'text', claimName: FRESH_BOOK_CYCLE.claimName,
  outcomeName: FRESH_BOOK_CYCLE.outcomeName, auditionStart: env => auditionStartFile(env) };
const RECOVERY_LINE: Line = { kind: 'recovery', recovery: true, ledger: true, storyboardDir: FRESH_BOOK_RECOVERY.folder, claimName: FRESH_BOOK_RECOVERY.claimName,
  outcomeName: FRESH_BOOK_RECOVERY.outcomeName, auditionStart: env => path.join(env.authorityRoot, FRESH_BOOK_RECOVERY.auditionStartName) };
const STORYBOARD_REPAIR_LINE: Line = { kind: 'storyboard_repair', recovery: true, ledger: 'storyboard_repair', storyboardDir: FRESH_BOOK_STORYBOARD_REPAIR.folder,
  claimName: FRESH_BOOK_STORYBOARD_REPAIR.claimName, outcomeName: FRESH_BOOK_STORYBOARD_REPAIR.outcomeName,
  auditionStart: env => path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_REPAIR.auditionStartName) };
const STORYBOARD_CONTINUATION_LINE: Line = { kind: 'storyboard_continuation', recovery: true, ledger: 'storyboard_continuation',
  storyboardDir: FRESH_BOOK_STORYBOARD_CONTINUATION.folder, claimName: FRESH_BOOK_STORYBOARD_CONTINUATION.claimName,
  outcomeName: FRESH_BOOK_STORYBOARD_CONTINUATION.outcomeName, auditionStart: env => path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_CONTINUATION.auditionStartName) };
const lineOf = (recovery?: true, storyboardRepair?: true, storyboardContinuation?: true) => storyboardContinuation ? STORYBOARD_CONTINUATION_LINE
  : storyboardRepair ? STORYBOARD_REPAIR_LINE : recovery ? RECOVERY_LINE : ORIGINAL_LINE;
const admitLine = (args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal }, line: Line, earlier: string[]) =>
  line.kind === 'storyboard_continuation' ? admitStoryboardContinuation({ ...args, earlier: [...earlier, FRESH_BOOK_RECOVERY.folder, FRESH_BOOK_STORYBOARD_REPAIR.folder,
    FRESH_BOOK_STORYBOARD_CONTINUATION.folder] })
    : line.kind === 'storyboard_repair' ? admitStoryboardRepair({ ...args, earlier: [...earlier, FRESH_BOOK_RECOVERY.folder, FRESH_BOOK_STORYBOARD_REPAIR.folder] })
    : line.recovery ? admitRecovery({ ...args, earlier: [...earlier, FRESH_BOOK_RECOVERY.folder] }) : admitStage({ ...args, earlier });
/**
 * The text a downstream stage may stand on: the original line's supported text with no terminal outcome; or, on the recovery line, the
 * failed text exactly as its failure (never ignored globally), no recovery outcome, and its successor re-verified against its durable record;
 * or, on the storyboard-repair line, the failed text, the recovery's held record exactly (re-derived at admission), no repair outcome, and the
 * repair's successor re-derived by replaying its whole chain against its durable record. The caller's next guard holds what was verified to the
 * baseline pinned before every await.
 */
async function linePassed(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string }, line: Line,
  admitted: Awaited<ReturnType<typeof admitLine>>) {
  const { config, env } = a, text = path.join(config.bookDir, 'text');
  if (line.kind === 'original') return sealedStatus(text) === 'review_supported' && !existsSync(path.join(env.authorityRoot, FRESH_BOOK_CYCLE.outcomeName));
  if (line.kind === 'storyboard_continuation') {
    const at = (name: string) => existsSync(path.join(env.authorityRoot, name));
    if (sealedStatus(text) !== 'failed' || !at(FRESH_BOOK_RECOVERY.outcomeName) || at(FRESH_BOOK_RECOVERY.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_REPAIR.outcomeName) || at(FRESH_BOOK_STORYBOARD_REPAIR.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_CONTINUATION.claimName) || at(FRESH_BOOK_STORYBOARD_CONTINUATION.outcomeName)) return false;
    if (!('continuation' in admitted)) return fail('fresh_book_storyboard_continuation_grant');
    await verifyStoryboardContinuationSuccessor({ config, env, grantSha: a.grantSha, admitted });
    return true;
  }
  if (line.kind === 'storyboard_repair') {
    if (sealedStatus(text) !== 'failed' || !existsSync(path.join(env.authorityRoot, FRESH_BOOK_RECOVERY.outcomeName)) ||
        existsSync(path.join(env.authorityRoot, FRESH_BOOK_RECOVERY.successorName)) ||
        !existsSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_REPAIR.claimName)) ||
        existsSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName))) return false;
    if (!('repair' in admitted)) return fail('fresh_book_storyboard_repair_grant');
    await verifyStoryboardRepairSuccessor({ config, env, grantSha: a.grantSha, admitted });
    return true;
  }
  if (sealedStatus(text) !== 'failed' || !existsSync(path.join(env.authorityRoot, FRESH_BOOK_RECOVERY.claimName)) ||
      existsSync(path.join(env.authorityRoot, FRESH_BOOK_RECOVERY.outcomeName))) return false;
  if (!('grant' in admitted) || 'repair' in admitted || 'continuation' in admitted) return fail('fresh_book_recovery_grant');
  verifyRecoverySuccessor({ config, env, grant: admitted.grant as FreshBookRecoveryGrant, grantSha: a.grantSha, requestId: admitted.planned.prepared.accepted.requestId,
    rereviewOutcome: admitted.outcome });
  return true;
}
/** The cumulative ledger: the diagnostic subcap's settled spend and every book stage, each from its own records. Unknown halts. */
export function freshBookLedger(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, recovery: LedgerLine = false) {
  return freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env), stages: bookStages(config.bookDir, recovery) });
}
/** The book's terminal record beside its claim (once): the one book is over; nothing reopens it. The recovery line has its own (once). */
function finish(env: FreshBookEnv, status: string, extra: Record<string, unknown>, name: string = FRESH_BOOK_CYCLE.outcomeName) {
  exclusiveJson(path.join(env.authorityRoot, name), { cycle: FRESH_BOOK_CYCLE.id, status, ...extra, finishedAt: new Date().toISOString() });
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

/**
 * The storyboard calls of a text stage (one call site for the original text, its recovery and the storyboard repair): the Opus Max planner,
 * then the Sol review, claimed at the reservation `reviewRule` derives for its request: the SAME rule that stage's meter re-derives it with.
 */
function storyboardVisual(a: { textDir: string; policy: WirePolicy; claudeMax: SimpleBookBudget; api: AuditionMeter; responses: Responses; planner?: PlannerTransport;
  reviewRule: NonNullable<ReturnType<MeterRules>>; guard: () => void; record: (error: unknown) => never; draft: (value: unknown) => void }) {
  return async (call: SimpleStoryboardDiagnosticCall, s: AbortSignal) => {
    a.guard();
    if (call.stage === 'storyboard') {
      // The planner is Opus 5.5 on the Claude Max route for every storyboard call of this book (fixed; never the Astra route).
      const instructionFile = path.join(a.textDir, 'storyboard-instructions.txt');
      exclusiveText(instructionFile, plannerRequest(call).instructions);
      const wire = prepareOpusStoryboardWire(call, a.policy, instructionFile);
      const cwd = path.join(a.textDir, 'planner-workspace'); mkdirSync(cwd);
      const plan = a.planner ?? createOpusStoryboardTransport({ ...a.policy, workspace: cwd });
      return a.claudeMax.run('storyboard', wire, OPUS_PLANNER.sessionGuardMicroUsd, async () => {
        const reply = await plan(wire, call, s);
        a.draft(reply.output);
        return { value: reply.output, estimatedMicroUsd: reply.estimatedMicroUsd, receipt: reply };
      }).catch(a.record);
    }
    if (call.stage !== 'review') return a.record(new FreshBookError('fresh_book_visual_stage'));
    const payload = simpleWizardVisualPayload(call, SOL), reserve = a.reviewRule.reserve(payload);
    if (reserve === null) return a.record(new FreshBookError('fresh_book_review_wire'));
    return a.api.run('storyboard_review', payload, reserve, async () => {
      const observed: unknown[] = [];
      let response: OpenAI.Responses.Response;
      try { response = await a.responses(payload, s, generationTimeoutMs(call.maxOutputTokens), failure => observed.push(failure)); }
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
    }).catch(a.record);
  };
}
const openAIResponses = (key: () => string): Responses => async (payload, s, timeout, observe) =>
  new OpenAI({ apiKey: key(), baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off', fetch: longCallFetch(timeout + 60_000, observe) })
    .responses.create(payload, { signal: s, timeout });

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
      visual: storyboardVisual({ textDir, policy, claudeMax, api, responses, planner: transports.planner, reviewRule: TEXT_RULES('storyboard_review')!,
        guard, record, draft: d => { storyboardDraft = d; } }) });
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

/**
 * The ONE same-book text recovery: the completed author, editor and both readings are REPLAYED from the failed text's saved evidence (each
 * rebuilt request must equal its saved wire exactly; the saved answer is returned, no provider or model callback), the reading that failed
 * only its source evidence gets ONE constrained citation correction (its own claim on the recovery meter), the strict compile decides, then
 * the still-required Opus Max storyboard and Sol storyboard review run on the native call sites. Everything new is written beside the failed
 * text in its own folder; the failed text, its seal, the original claim and outcome are never written.
 */
export async function runFreshBookTextRecovery(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void; transports?: Pick<FreshTextTransports, 'reader' | 'responses' | 'planner'> }) {
  const { config, env, signal } = args, transports = args.transports ?? {};
  // Its own folder is this stage's output (absent, checked below); the failed text and the original book records are earlier entries.
  const admitted = await admitRecovery({ ...args, earlier: ['request.json', 'admission.json', 'text'] });
  const { prepared, options, profile } = loadProfile(config);
  assertFreshBookExecutable(config);
  const ledger = freshBookLedger(config, env, admitted.planned.rereview, true);
  const oldDir = path.join(config.bookDir, 'text'), dir = path.join(config.bookDir, FRESH_BOOK_RECOVERY.folder);
  if (existsSync(dir)) fail('fresh_book_recovery_used');
  // No await from the last check to the one recovery claim and its folder.
  admitted.same();
  claimFreshBookRecovery(env, admitted.grant, args.grantSha);
  admitted.recapture([`authority/${FRESH_BOOK_RECOVERY.claimName}`]);
  try { mkdirSync(dir); } catch { fail('fresh_book_recovery_used'); }
  mkdirSync(path.join(dir, 'cli-workspace'));
  exclusiveJson(path.join(dir, 'recovery-admission.json'), { version: FRESH_BOOK_RECOVERY.version, grantSha256: args.grantSha, original: admitted.grant.original,
    ledger, rereviewOutcome: admitted.outcome });
  const api = new AuditionMeter(path.join(dir, 'paid-stages'), ledger.nextCapMicroUsd, FRESH_BOOK_RECOVERY.apiCalls, ledger.bookKnownMicroUsd, 0, RECOVERY_RULES);
  const claudeMax = new SimpleBookBudget(path.join(dir, 'claude-max-stages'), 0);
  const key = keyReader(config.keyEnvFile);
  const original: WirePolicy = { executable: config.executable, executableSha256: config.executableSha256, workspace: path.join(oldDir, 'cli-workspace'),
    maxWireBytes: 104000, rates: { opus: RATES.opus, astra: RATES.sol }, openAIReviewModel: SOL };
  const policy: WirePolicy = { ...original, workspace: path.join(dir, 'cli-workspace') };
  const reader = transports.reader ?? createAstraCausalTransport({ key, rates: RATES.sol, model: SOL, fetch: longCallFetch(TEXT_BACKSTOP_MS) });
  const responses = transports.responses ?? openAIResponses(key);
  const dispatch = <T extends { stage: string }>(call: T, role: 'opus' | 'astra') => ({ ...call, role, conversationKey: `fresh-book:${prepared.accepted.requestId}:${call.stage}` });
  let storyboardDraft: unknown = null, failed: string | null = null, corrections = 0;
  const replayed: string[] = [];
  const record = (error: unknown): never => { failed ??= codeOf(error, 'fresh_book_provider_transport'); throw error; };
  const guard = () => { try { admitted.guard(); } catch (error) { record(error); } };
  /** A completed saved call of the failed text: its claim binds the saved request, and the rebuilt request is exactly it. */
  const savedCall = (folder: 'claude-max-stages' | 'paid-stages', step: string, wire: unknown) => {
    const at = (k: string) => path.join(oldDir, folder, `${step}.${k}.json`);
    if (!['claim', 'wire', 'result', 'receipt'].every(k => existsSync(at(k)))) fail('fresh_book_recovery_replay');
    const claim = json(at('claim')), saved = json(at('wire')), result = json(at('result'));
    if (claim.step !== step || previewSha(canonicalJson(saved)) !== claim.wireDigest || result.wireDigest !== claim.wireDigest || result.completed !== true ||
        canonicalJson(JSON.parse(JSON.stringify(wire))) !== canonicalJson(saved)) fail('fresh_book_recovery_replay');
    if (replayed.includes(step)) fail('fresh_book_recovery_replay');
    replayed.push(step);
    return json(at('receipt'));
  };
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    exclusiveJson(path.join(dir, 'spend.json'), api.snapshot());
    exclusiveJson(path.join(dir, 'claude-max-spend.json'), { ...claudeMax.snapshot(), note: 'Claude Max usage is separate: not an API invoice' });
    exclusiveJson(path.join(dir, 'sealed.json'), { status, ...extra, replayed: [...replayed], runtimeEligible: false });
  };
  try {
    const result = await runSimpleWizardBook({ request: prepared.accepted.canonical, options, seed: profile.seed, signal, reservedWritingUsd: 4, ...FRESH_BOOK_CONTRACTS,
      publish: view => args.log(`phase ${view.phase}`),
      opus: async call => {
        guard();
        // The saved instruction file is the request's own: its bytes must be this call's instructions (it is never rewritten).
        const instructionFile = path.join(oldDir, `${call.stage}-instructions.txt`);
        if (!existsSync(instructionFile) || fileBytes(instructionFile).toString('utf8') !== call.instructions) fail('fresh_book_recovery_replay');
        try { return savedCall('claude-max-stages', call.stage, prepareCausalWire(dispatch(call, 'opus'), original, 2000000, instructionFile)); }
        catch (error) { return record(error); }
      },
      reader: async call => {
        guard();
        try {
          const receipt = savedCall('paid-stages', call.stage, prepareCausalWire(dispatch(call, 'astra'), original, 2000000));
          if (canonicalJson(call.schema.parse(JSON.parse(receipt.raw.output_text))) !== canonicalJson(receipt.output)) fail('fresh_book_recovery_replay');
          return receipt.output;
        } catch (error) { return record(error); }
      },
      correctReading: async (stage, numbered, raw, s) => {
        if (corrections++ >= FRESH_BOOK_RECOVERY.correctionCalls) return record(new FreshBookError('fresh_book_recovery_correction_used'));
        guard();
        const correction = prepareSourceCitationCorrection(numbered, raw);
        exclusiveJson(path.join(dir, 'citation-correction-request.json'), { stage, failedReceiptSha256: previewSha(fileBytes(path.join(oldDir, 'paid-stages', `${stage}.receipt.json`))),
          correctionDigest: correction.correctionDigest, body: correction.body });
        const call = { stage: 'citation_correction' as CausalStage, instructions: correction.instructions, input: correction.input, schema: correction.schema, maxOutputTokens: 16000 };
        const d = dispatch(call, 'astra'), wire = prepareCausalWire(d, policy, 2000000);
        guard();
        const answer = await api.run('citation_correction', wire, FRESH_BOOK_RECOVERY.correctionReserveMicroUsd, async () => {
          const reply = await reader(wire, d, s);
          return { value: reply.output, estimatedMicroUsd: reply.estimatedMicroUsd, receipt: reply };
        }).catch(record);
        guard();
        let applied: ReturnType<typeof applySourceCitationCorrection>;
        try { applied = applySourceCitationCorrection(numbered, raw, correction, answer); } catch (error) { return record(error); }
        exclusiveJson(path.join(dir, 'citation-correction.json'), { stage, ...applied.provenance, corrected: applied.corrected });
        return applied.corrected;
      },
      visual: storyboardVisual({ textDir: dir, policy, claudeMax, api, responses, planner: transports.planner, reviewRule: RECOVERY_RULES('storyboard_review')!,
        guard, record, draft: d => { storyboardDraft = d; } }) });
    guard();
    if (canonicalJson(replayed) !== canonicalJson(['author', 'editor', 'final_review', 'comparison'])) fail('fresh_book_recovery_replay');
    exclusiveJson(path.join(dir, 'simple-book-result.json'), result);
    exclusiveText(path.join(dir, 'story.md'), `# ${result.source.manuscript.title}\n\n` +
      result.source.manuscript.pages.map(p => `## עמוד ${p.pageNumber}\n\n${p.text}`).join('\n\n') + '\n');
    if (result.storyboard) {
      exclusiveJson(path.join(dir, 'visual_simple_book_result.json'), result);
      exclusiveJson(path.join(dir, 'owned_storyboard_draft.json'), storyboardDraft ?? fail('fresh_book_draft_missing'));
    }
    seal(result.status, { corrections });
    if (result.status !== 'review_supported') finish(env, 'held_text', { textStatus: result.status }, FRESH_BOOK_RECOVERY.outcomeName);
    else {
      // The successor's ONE durable provenance: its chain re-derived from the failed evidence, then recorded once; only that write is accepted.
      guard();
      verifyRecoverySuccessor({ config, env, grant: admitted.grant, grantSha: args.grantSha, requestId: prepared.accepted.requestId, rereviewOutcome: admitted.outcome }, true);
      admitted.recapture([`authority/${FRESH_BOOK_RECOVERY.successorName}`]);
    }
    return { status: result.status, corrections, replayed, api: api.snapshot(), claudeMax: claudeMax.snapshot(), ledger: freshBookLedger(config, env, admitted.planned.rereview, true) };
  } catch (error) {
    const code = failed ?? codeOf(error, 'fresh_book_text_recovery_failed');
    if (!existsSync(path.join(dir, 'sealed.json'))) seal('failed', { code, corrections });
    if (!existsSync(path.join(env.authorityRoot, FRESH_BOOK_RECOVERY.outcomeName))) finish(env, 'failed_text_recovery', { code }, FRESH_BOOK_RECOVERY.outcomeName);
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The ONE storyboard-only repair line (owner 2026-10-18): the recovery's held storyboard, repaired as a bound successor.
// ---------------------------------------------------------------------------------------------------------------
const sameJson = (x: unknown, y: unknown) => canonicalJson(x) === canonicalJson(y);
const plainJson = (value: unknown) => JSON.parse(JSON.stringify(value));
const sortedSame = (x: readonly string[], y: readonly string[]) => sameJson([...x].sort(), [...y].sort());
/** The saved calls the repair's paid run consumes: the failed text's author, editor and readings, and the recovery's one citation correction. */
const REPAIR_REPLAYED = Object.freeze(['text/claude-max-stages/author', 'text/claude-max-stages/editor', 'text/paid-stages/final_review',
  'text/paid-stages/comparison', `${FRESH_BOOK_RECOVERY.folder}/paid-stages/citation_correction`]);
/**
 * One storyboard re-plan line's own shape on the shared flow: its folder, the contracts it adds over the repair's (the repair: none) and its
 * review meter rule. A re-derivation also consumes the line's own two calls: its planner session and its review.
 */
type ReplanSpec = { folder: string; contracts: { selfCheckContract?: true; reviewImpactPolicy?: true }; rules: MeterRules };
const REPAIR_SPEC: ReplanSpec = Object.freeze({ folder: FRESH_BOOK_STORYBOARD_REPAIR.folder, contracts: {}, rules: STORYBOARD_REPAIR_RULES });
const CONTINUATION_SPEC: ReplanSpec = Object.freeze({ folder: FRESH_BOOK_STORYBOARD_CONTINUATION.folder,
  contracts: { selfCheckContract: true as const, reviewImpactPolicy: true as const }, rules: STORYBOARD_CONTINUATION_RULES });
const ownCalls = (spec: ReplanSpec) => Object.freeze([`${spec.folder}/claude-max-stages/storyboard`, `${spec.folder}/paid-stages/storyboard_review`]);
const REPAIR_OWN_CALLS = ownCalls(REPAIR_SPEC);

/**
 * The consumed recovery and the held storyboard the repair stands on, re-read exactly: the recovery grant its claim names, that claim (naming
 * the original claim, at the recovery grant's own head), the whole ORIGINAL authority that grant consumed (re-derived by recoveryOriginal,
 * equal to its recorded original and ledger), its terminal held_text record, its folder sealed held (one correction, the four
 * replays) with no successor, and its held storyboard re-derived: the saved draft recompiled under this book's contracts from the recovery's
 * own saved source to its saved book, and its own raw review re-judged to that held disposition. The ledger it stands on is the stages before
 * it (the failed text and the recovery), so later stages never move it. The repair input is exactly that draft and that raw review (the
 * engine derives the findings), with the visible-moment contract added.
 */
function recoveryHeld(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, loaded: ReturnType<typeof loadProfile>, recoveryGrantFile: string) {
  const { profile, prepared, options } = loaded, refuse = (): never => fail('fresh_book_storyboard_repair_recovery');
  if (!path.isAbsolute(recoveryGrantFile)) refuse();
  const at = (name: string) => path.join(env.authorityRoot, name), dir = path.join(config.bookDir, FRESH_BOOK_RECOVERY.folder);
  const files = { grant: recoveryGrantFile, claim: at(FRESH_BOOK_RECOVERY.claimName), outcome: at(FRESH_BOOK_RECOVERY.outcomeName),
    seal: path.join(dir, 'sealed.json'), originalClaim: at(FRESH_BOOK_CYCLE.claimName) };
  if (Object.values(files).some(f => !existsSync(f)) || existsSync(at(FRESH_BOOK_RECOVERY.successorName))) refuse();
  const digest = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, previewSha(fileBytes(f))])) as Record<keyof typeof files, string>;
  const parsed = freshBookRecoveryGrantSchema.safeParse(json(files.grant));
  if (!parsed.success) return refuse();
  const grant = parsed.data, claim = json(files.claim), outcome = json(files.outcome), seal = json(files.seal);
  const sameDir = (p: unknown) => typeof p === 'string' && path.resolve(p).toLowerCase() === path.resolve(config.bookDir).toLowerCase();
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.recovery !== FRESH_BOOK_RECOVERY.version || claim.grantSha256 !== digest.grant ||
      claim.originalClaimSha256 !== digest.originalClaim || grant.original.claimSha256 !== digest.originalClaim || claim.engineHead !== grant.engine.head ||
      !sameDir(claim.bookDir) || !sameDir(grant.bookDir) || grant.profileSha256 !== freshBookProfileSha(profile) || claim.profileSha256 !== grant.profileSha256) refuse();
  // F7 (Codex 2026-10-18): the ORIGINAL authority this recovery consumed, re-derived by the recovery line's own verifier (the original grant
  // under its OWN head and exact bytes, its claim, the failed outcome and seal, the request, the admission, the failed text evidence and the
  // original ledger), must be exactly what the consumed recovery grant recorded. A changed original record or byte is not that authority.
  let lineage: ReturnType<typeof recoveryOriginal>;
  try { lineage = recoveryOriginal(config, env, rereview, profile, grant.original.grantFile); }
  catch (error) { if (error instanceof FreshBookError) throw error; return fail('fresh_book_recovery_original'); }
  if (!sameJson(lineage.original, grant.original) || !sameJson(lineage.ledger, grant.ledger)) fail('fresh_book_recovery_original');
  if (outcome.cycle !== FRESH_BOOK_CYCLE.id || outcome.status !== FRESH_BOOK_STORYBOARD_REPAIR.heldOutcome ||
      !(FRESH_BOOK_STORYBOARD_REPAIR.heldStatuses as readonly string[]).includes(outcome.textStatus) ||
      !sameJson(seal, { status: outcome.textStatus, corrections: 1, replayed: ['author', 'editor', 'final_review', 'comparison'], runtimeEligible: false })) refuse();
  const result = json(path.join(dir, 'simple-book-result.json')), draft = json(path.join(dir, 'owned_storyboard_draft.json'));
  if (!sameJson(json(path.join(dir, 'visual_simple_book_result.json')), result) || result.status !== outcome.textStatus || result.storyboard?.status !== result.status) refuse();
  let book: ReturnType<typeof compilePersonalStoryboard>, decision: ReturnType<typeof storyboardReviewDisposition>;
  try {
    const c = FRESH_BOOK_CONTRACTS;
    book = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(prepared.accepted.canonical, result.source, options, c.actorOwnedAppearance, c.momentContract,
      c.landmarkKindContract, undefined, c.sceneLocationContract, c.compilerRulesContract, undefined, c.drawnInstantContract), structuredClone(draft));
    decision = storyboardReviewDisposition(book, result.storyboard.rawReview);
  } catch { return refuse(); }
  if (book.storyboardDigest !== result.storyboard.storyboardDigest || !sameJson(plainJson(book), result.storyboard.storyboard) || decision.disposition !== result.status) refuse();
  // The held draft and raw review are the recovery's own PAID answers, never an editable summary: the planner session's settled output, and the
  // review's settled answer decoded for this held book, whose paid request was exactly this book's review input.
  const settled = (folder: 'claude-max-stages' | 'paid-stages', step: string) => {
    const at = (k: string) => path.join(dir, folder, `${step}.${k}.json`);
    if (!['claim', 'wire', 'result', 'receipt'].every(k => existsSync(at(k)))) return refuse();
    const claim = json(at('claim')), wire = json(at('wire')), done = json(at('result'));
    if (claim.step !== step || previewSha(canonicalJson(wire)) !== claim.wireDigest || done.wireDigest !== claim.wireDigest || done.completed !== true) refuse();
    return { wire, receipt: json(at('receipt')) };
  };
  const planner = settled('claude-max-stages', 'storyboard'), reviewed = settled('paid-stages', 'storyboard_review');
  const reviewCall = { stage: 'review', instructions: '', input: '', maxOutputTokens: 0, context: { narrativeSpreads: book.narrativeSpreads,
    sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest, actorOwnedAppearance: true, landmarkKindContract: true } } as unknown as SimpleStoryboardDiagnosticCall;
  let paidReview: unknown;
  try { paidReview = decodePersonalBookProviderOutput(reviewCall, JSON.parse(reviewed.receipt.raw.output_text)); } catch { return refuse(); }
  if (!sameJson(draft, planner.receipt.output) || reviewed.wire.input !== canonicalJson(personalStoryboardReviewInput(book)) ||
      !sameJson(paidReview, result.storyboard.rawReview)) refuse();
  const before = freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env), stages: bookStages(config.bookDir, true).slice(0, 2) });
  const repair: StoryboardRepair = { parentStoryboardDigest: book.storyboardDigest, draft, review: result.storyboard.rawReview,
    addedContracts: [...FRESH_BOOK_STORYBOARD_REPAIR.addedContracts] };
  return { recovery: { grantFile: path.resolve(recoveryGrantFile), grantSha256: digest.grant, claimSha256: digest.claim, outcomeSha256: digest.outcome,
      sealSha256: digest.seal, folderSha256: previewSha(canonicalJson(folderBaseline(dir))), originalClaimSha256: digest.originalClaim },
    held: { sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest, reviewDigest: decision.reviewDigest,
      disposition: decision.disposition as (typeof FRESH_BOOK_STORYBOARD_REPAIR.heldStatuses)[number], draftSha256: previewSha(canonicalJson(draft)),
      findings: storyboardRepairFindings(decision.review).length },
    ledger: { diagnosticSettledMicroUsd: before.diagnosticSettledMicroUsd, bookKnownMicroUsd: before.bookKnownMicroUsd,
      calls: before.stages.reduce((n, s) => n + s.calls, 0) },
    repair };
}

/**
 * F6 at the repair's admission: the cumulative ledger must leave at least the review's floor (the least its max(floor, bound) reservation can
 * be) before the one claim is written; the meter then refuses the derived maximum itself before the key or provider is touched.
 */
export function assertReviewFloorFits(ledger: { bookKnownMicroUsd: number; nextCapMicroUsd: number }, code = 'fresh_book_storyboard_repair_budget') {
  if (ledger.bookKnownMicroUsd + REVIEW_RESERVE_FLOOR_MICRO_USD > ledger.nextCapMicroUsd) fail(code);
  return { remainingMicroUsd: ledger.nextCapMicroUsd - ledger.bookKnownMicroUsd, reviewFloorMicroUsd: REVIEW_RESERVE_FLOOR_MICRO_USD };
}

/** Provider-free plan and the storyboard-repair grant this exact state needs (no key, no provider, no write). */
export function planFreshBookStoryboardRepair(config: FreshBookConfig, env: FreshBookEnv, recoveryGrantFile: string) {
  const base = planFreshBook(config, env), loaded = loadProfile(config);
  const { recovery, held, ledger, repair } = recoveryHeld(config, env, base.rereview, loaded, recoveryGrantFile);
  const at = (name: string) => path.join(env.authorityRoot, name);
  const plan = { version: FRESH_BOOK_STORYBOARD_REPAIR.version, cycle: FRESH_BOOK_CYCLE.id, amendment: FRESH_BOOK_STORYBOARD_REPAIR.amendment,
    basePlanSha256: base.grantDraft.nativePlanSha256, bookDir: path.resolve(config.bookDir), folder: FRESH_BOOK_STORYBOARD_REPAIR.folder,
    storyboardDir: FRESH_BOOK_STORYBOARD_REPAIR.folder,
    replay: { calls: [...REPAIR_REPLAYED], from: 'the failed text and the recovery (saved wires and receipts, byte-exact; no provider or model callback)' },
    repair: { contract: 'storyboard-repair/v1', parent: held, addedContracts: [...FRESH_BOOK_STORYBOARD_REPAIR.addedContracts],
      input: 'the held draft and its exact raw review; the engine derives every unsupported check as a finding (none chosen, edited or dropped)' },
    calls: { planner: `storyboard: Opus 5.5 on Claude Max (${OPUS_PLANNER.model}), ${FRESH_BOOK_STORYBOARD_REPAIR.plannerCalls}`,
      review: `storyboard_review: Sol 6.1 (${SOL}), ${FRESH_BOOK_STORYBOARD_REPAIR.apiCalls}`,
      reviewReserve: `max(${REVIEW_RESERVE_FLOOR_MICRO_USD}, the bound its request derives); admission refuses before the claim below the floor, the meter before the key or provider below that maximum; journal and replay derive it under the same rule` },
    downstream: ['child --storyboard-repair', 'book --storyboard-repair [--resume]'],
    caps: { ...base.plan.caps, storyboardRepairApiCalls: FRESH_BOOK_STORYBOARD_REPAIR.apiCalls },
    claim: at(FRESH_BOOK_STORYBOARD_REPAIR.claimName), outcome: at(FRESH_BOOK_STORYBOARD_REPAIR.outcomeName), successor: at(FRESH_BOOK_STORYBOARD_REPAIR.successorName),
    successorAdmission: 'downstream replays the whole chain (text, correction, planner, review) from the saved evidence against its one durable record',
    providerCalls: 0, keyRead: false };
  const engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_STORYBOARD_REPAIR_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft: FreshBookStoryboardRepairGrant = freshBookStoryboardRepairGrantSchema.parse({ version: 'fresh-book-storyboard-repair-grant/v1',
    cycle: FRESH_BOOK_CYCLE.id, approval: FRESH_BOOK_CYCLE.approval, amendment: FRESH_BOOK_STORYBOARD_REPAIR.amendment, profileSha256: base.plan.profileSha256,
    bookDir: path.resolve(config.bookDir), recovery, held, ledger,
    allowance: { plannerCalls: FRESH_BOOK_STORYBOARD_REPAIR.plannerCalls, apiCalls: FRESH_BOOK_STORYBOARD_REPAIR.apiCalls,
      reviewReserveFloorMicroUsd: FRESH_BOOK_STORYBOARD_REPAIR.reviewReserveFloorMicroUsd },
    addedContracts: [...FRESH_BOOK_STORYBOARD_REPAIR.addedContracts], engine: { head: engine.head, branch: engine.branch }, pins,
    nativePlanSha256: previewSha(canonicalJson(plan)) });
  const probe = (f: () => unknown) => { try { return f(); } catch (e) { return { refused: e && typeof e === 'object' && 'code' in e ? e.code : String(e) }; } };
  const state = { claimExists: existsSync(plan.claim), outcomeExists: existsSync(plan.outcome), successorExists: existsSync(plan.successor),
    folderExists: existsSync(path.join(config.bookDir, FRESH_BOOK_STORYBOARD_REPAIR.folder)),
    ledger: probe(() => freshBookLedger(config, env, base.rereview, 'storyboard_repair')),
    reviewFloor: probe(() => assertReviewFloorFits(freshBookLedger(config, env, base.rereview, 'storyboard_repair'))),
    executablePinned: probe(() => assertFreshBookExecutable(config)), engine };
  return { plan, grantDraft, state, profile: base.profile, prepared: loaded.prepared, options: loaded.options, rereview: base.rereview, repair };
}

/**
 * A storyboard-repair-line stage's admission, as admitRecovery: the baseline (repair grant bytes, the recovery grant's bytes and the original
 * grant's bytes it names (at their recorded digest), configuration, profile, lineage, every line's authority records, earlier stage entries
 * including the failed text and the held recovery) pinned FIRST and
 * held across every await; the grant is exactly the draft this state rebuilds, at the clean reviewed head. Its guard adds the repair claim and
 * the recovery and original claims it names.
 */
async function admitStoryboardRepair(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal; earlier: string[] }) {
  const bytes = fileBytes(a.grantFile);
  if (previewSha(bytes) !== a.grantSha) fail('fresh_book_storyboard_repair_grant');
  const parsed = freshBookStoryboardRepairGrantSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success) return fail('fresh_book_storyboard_repair_grant');
  const recoveryBytes = fileBytes(parsed.data.recovery.grantFile), rereview = loadRereview(a.config);
  // F7: the original grant the consumed recovery grant names is frozen too, at its own recorded bytes (never re-pinned to this head), and held
  // across every await below exactly as the recovery line holds it.
  let named: FreshBookRecoveryGrant;
  try { named = freshBookRecoveryGrantSchema.parse(JSON.parse(recoveryBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_repair_recovery'); }
  const originalFile = named.original.grantFile, originalBytes = fileBytes(originalFile);
  if (previewSha(originalBytes) !== named.original.grantSha256) fail('fresh_book_recovery_original');
  let roots = rootsOf(a.config, a.env, rereview, a.earlier);
  const planned = planFreshBookStoryboardRepair(a.config, a.env, parsed.data.recovery.grantFile);
  const outcome = await assertFreshBookAdmission(planned.rereview, a.env);
  const engine = a.env.head();
  if (canonicalJson(parsed.data) !== canonicalJson(planned.grantDraft)) fail('fresh_book_storyboard_repair_grant');
  if (!engine.clean || engine.head !== planned.grantDraft.engine.head || engine.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    if (!fileBytes(a.grantFile).equals(bytes)) fail('fresh_book_storyboard_repair_grant');
    if (!fileBytes(planned.grantDraft.recovery.grantFile).equals(recoveryBytes)) fail('fresh_book_storyboard_repair_recovery');
    if (!fileBytes(originalFile).equals(originalBytes)) fail('fresh_book_recovery_original');
    if (canonicalJson(rootsOf(a.config, a.env, rereview, a.earlier)) !== canonicalJson(roots)) fail('fresh_book_roots_changed');
    const e = a.env.head();
    if (!e.clean || e.head !== planned.grantDraft.engine.head || e.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(planned.grantDraft.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
  };
  const guard = () => { same(); assertFreshBookStoryboardRepairPaid({ env: a.env, grantFile: a.grantFile, grantSha: a.grantSha, profile: planned.profile, workspace: workspace() }); };
  const recapture = (added: string[]) => {
    const next = rootsOf(a.config, a.env, rereview, a.earlier), changed = Object.keys(next).filter(k => next[k] !== roots[k]);
    if (canonicalJson(Object.keys(next).sort()) !== canonicalJson(Object.keys(roots).sort()) || canonicalJson(changed.sort()) !== canonicalJson([...added].sort()) ||
        added.some(k => roots[k] !== 'absent' || next[k] === 'absent')) fail('fresh_book_roots_changed');
    roots = next; same();
  };
  same();
  return { planned, outcome, same, guard, recapture, grant: planned.grantDraft, repair: planned.repair };
}

type RepairLive = { dir: string; api: AuditionMeter; claudeMax: SimpleBookBudget; responses: Responses; planner?: PlannerTransport; guard: () => void;
  record: (error: unknown) => never; draft: (value: unknown) => void };
/**
 * The storyboard repair's flow, ONE code path for its paid run and for every later re-derivation: the text and its one citation correction
 * REPLAYED from their saved evidence (each rebuilt request must equal its saved wire exactly; the saved answer is returned, no provider or model
 * callback), the held storyboard's repair input on the existing storyboard-repair contract with the visible-moment contract added, then the
 * planner and the review: `live` on the native call sites (the review claimed under the floored rule), replayed from `replayDir`'s own saved
 * calls (their rebuilt requests equal to the saved ones), or `preview`: the planner's exact request and CLI wire handed over, nothing called.
 * Every saved call is consumed exactly once, in `seen`'s order.
 */
async function storyboardRepairFlow(a: { config: FreshBookConfig; repair: StoryboardRepair; signal: AbortSignal; log: (line: string) => void; seen: string[];
  live?: RepairLive; replayDir?: string; preview?: (wire: PlannerWire, call: SimpleStoryboardDiagnosticCall) => never; spec?: ReplanSpec }) {
  if ([a.live, a.replayDir, a.preview].filter(m => m !== undefined).length !== 1) fail('fresh_book_storyboard_repair_replay');
  const { config, seen } = a, { prepared, options, profile } = loadProfile(config), spec = a.spec ?? REPAIR_SPEC;
  const textDir = path.join(config.bookDir, 'text'), recoveryDir = path.join(config.bookDir, FRESH_BOOK_RECOVERY.folder);
  const repairDir = a.live?.dir ?? a.replayDir ?? path.join(config.bookDir, spec.folder);
  const original: WirePolicy = { executable: config.executable, executableSha256: config.executableSha256, workspace: path.join(textDir, 'cli-workspace'),
    maxWireBytes: 104000, rates: { opus: RATES.opus, astra: RATES.sol }, openAIReviewModel: SOL };
  const recoveryPolicy: WirePolicy = { ...original, workspace: path.join(recoveryDir, 'cli-workspace') };
  const repairPolicy: WirePolicy = { ...original, workspace: path.join(repairDir, 'cli-workspace') };
  const refuse = (): never => fail('fresh_book_storyboard_repair_replay');
  // On the paid run a refusal keeps its own code (recorded before any engine wrapper); a re-derivation simply refuses.
  const fault = (error: unknown): never => { if (a.live) a.live.record(error); throw error; };
  const guarded = <T>(f: () => T): T => { try { a.live?.guard(); return f(); } catch (error) { return fault(error); } };
  /** A completed saved call: its claim binds the saved request, the rebuilt request is exactly it; consumed once. Returns its receipt. */
  const saved = (dir: string, folder: 'claude-max-stages' | 'paid-stages', step: string, wire: unknown) => {
    const at = (k: string) => path.join(dir, folder, `${step}.${k}.json`), key = `${path.basename(dir)}/${folder}/${step}`;
    if (!['claim', 'wire', 'result', 'receipt'].every(k => existsSync(at(k))) || seen.includes(key)) refuse();
    const claim = json(at('claim')), savedWire = json(at('wire')), result = json(at('result'));
    if (claim.step !== step || previewSha(canonicalJson(savedWire)) !== claim.wireDigest || result.wireDigest !== claim.wireDigest || result.completed !== true ||
        !sameJson(plainJson(wire), savedWire)) refuse();
    seen.push(key);
    return json(at('receipt'));
  };
  const dispatch = <T extends { stage: string }>(call: T, role: 'opus' | 'astra') => ({ ...call, role, conversationKey: `fresh-book:${prepared.accepted.requestId}:${call.stage}` });
  let corrections = 0;
  const visual = a.live
    ? storyboardVisual({ textDir: a.live.dir, policy: repairPolicy, claudeMax: a.live.claudeMax, api: a.live.api, responses: a.live.responses, planner: a.live.planner,
      reviewRule: spec.rules('storyboard_review')!, guard: a.live.guard, record: a.live.record, draft: a.live.draft })
    : async (call: SimpleStoryboardDiagnosticCall) => {
      if (call.stage === 'storyboard') {
        const instructionFile = path.join(repairDir, 'storyboard-instructions.txt');
        // Preview: the planner request this run would send (the text and correction already replayed), its CLI wire built and measured, never sent.
        if (a.preview) return sortedSame(seen, REPAIR_REPLAYED) ? a.preview(prepareOpusStoryboardWire(call, repairPolicy, instructionFile), call) : refuse();
        if (!existsSync(instructionFile) || fileBytes(instructionFile).toString('utf8') !== plannerRequest(call).instructions) refuse();
        return saved(repairDir, 'claude-max-stages', 'storyboard', prepareOpusStoryboardWire(call, repairPolicy, instructionFile)).output;
      }
      if (call.stage !== 'review') return refuse();
      const receipt = saved(repairDir, 'paid-stages', 'storyboard_review', simpleWizardVisualPayload(call, SOL));
      return decodePersonalBookProviderOutput(call, JSON.parse(receipt.raw.output_text));
    };
  const result = await runSimpleWizardBook({ request: prepared.accepted.canonical, options, seed: profile.seed, signal: a.signal, reservedWritingUsd: 4,
    ...FRESH_BOOK_CONTRACTS, visibleMomentContract: true, ...spec.contracts, storyboardRepair: a.repair, publish: view => a.log(`phase ${view.phase}`),
    opus: async call => guarded(() => {
      // The saved instruction file is the request's own: its bytes must be this call's instructions (it is never rewritten).
      const instructionFile = path.join(textDir, `${call.stage}-instructions.txt`);
      if (!existsSync(instructionFile) || fileBytes(instructionFile).toString('utf8') !== call.instructions) refuse();
      return saved(textDir, 'claude-max-stages', call.stage, prepareCausalWire(dispatch(call, 'opus'), original, 2000000, instructionFile));
    }),
    reader: async call => guarded(() => {
      const receipt = saved(textDir, 'paid-stages', call.stage, prepareCausalWire(dispatch(call, 'astra'), original, 2000000));
      if (!sameJson(call.schema.parse(JSON.parse(receipt.raw.output_text)), receipt.output)) refuse();
      return receipt.output;
    }),
    // The recovery's ONE settled citation correction, replayed: its request rebuilds from the failed reading, its wire and answer are the saved ones,
    // and the strict apply reproduces the saved corrected reading (no correction call can happen on this line).
    correctReading: async (stage, numbered, raw) => guarded(() => {
      if (corrections++ >= FRESH_BOOK_RECOVERY.correctionCalls) refuse();
      const correction = prepareSourceCitationCorrection(numbered, raw);
      if (!sameJson(json(path.join(recoveryDir, 'citation-correction-request.json')), plainJson({ stage,
        failedReceiptSha256: previewSha(fileBytes(path.join(textDir, 'paid-stages', `${stage}.receipt.json`))), correctionDigest: correction.correctionDigest,
        body: correction.body }))) refuse();
      const call = { stage: 'citation_correction' as CausalStage, instructions: correction.instructions, input: correction.input, schema: correction.schema, maxOutputTokens: 16000 };
      const receipt = saved(recoveryDir, 'paid-stages', 'citation_correction', prepareCausalWire(dispatch(call, 'astra'), recoveryPolicy, 2000000));
      const answer = correction.schema.parse(JSON.parse(receipt.raw.output_text));
      if (!sameJson(answer, receipt.output)) refuse();
      const applied = applySourceCitationCorrection(numbered, raw, correction, answer);
      if (!sameJson(json(path.join(recoveryDir, 'citation-correction.json')), plainJson({ stage, ...applied.provenance, corrected: applied.corrected }))) refuse();
      return applied.corrected;
    }),
    visual });
  if (!sortedSame(seen, [...REPAIR_REPLAYED, ...(a.live ? [] : ownCalls(spec))])) refuse();
  return result;
}

type RepairPreview = { contentBytes: number; contentByteLimit: number; wireBytes: number; wireByteLimit: number; reservedMicroUsd: number;
  sessionGuardMicroUsd: number; findings: number; instructionsSha256: string; inputSha256: string; wireDigest: string };
/**
 * Provider-free preview of the repair's ONE planner request, on the paid run's own code path: the text and the correction replayed from their
 * saved evidence, the repaired source prepared (the held parent re-bound under its own contracts, every finding derived by the engine), then the
 * planner's request and CLI wire built and measured (content limit, wire limit, session guard) and stopped before any session. The paid stage
 * runs it before its claim, so a request that cannot be sent refuses before any claim, key, model or provider; its wire digest binds the paid one.
 */
export async function previewFreshBookStoryboardRepair(config: FreshBookConfig, repair: StoryboardRepair): Promise<RepairPreview> {
  const out: { preview?: RepairPreview } = {};
  try {
    await storyboardRepairFlow({ config, repair, signal: new AbortController().signal, log: () => {}, seen: [], preview: (wire, call) => {
      const input = JSON.parse(call.input);
      out.preview = { contentBytes: Buffer.byteLength(call.instructions, 'utf8') + Buffer.byteLength(call.input, 'utf8'), contentByteLimit: SIMPLE_STORYBOARD_INPUT_LIMIT,
        wireBytes: wire.bytes, wireByteLimit: 104000, reservedMicroUsd: wire.reservedMicroUsd, sessionGuardMicroUsd: OPUS_PLANNER.sessionGuardMicroUsd,
        findings: Array.isArray(input?.priorReviewedStoryboard?.reviewFindings) ? input.priorReviewedStoryboard.reviewFindings.length : 0,
        instructionsSha256: previewSha(call.instructions), inputSha256: previewSha(call.input), wireDigest: previewSha(canonicalJson(wire)) };
      return fail('fresh_book_storyboard_repair_preview_complete');
    } });
  } catch (error) { if (!out.preview) throw error; }
  return out.preview ?? fail('fresh_book_storyboard_repair_preview');
}

/**
 * The ONE storyboard-only repair of the same book: admission re-derives the held recovery exactly, the balance must cover the review's floor,
 * then one claim and its own folder; the text and the citation correction are replayed, the held draft and its raw review are the repair input,
 * and the Opus Max planner and the Sol review run once each on the native call sites (the review reserves max(600000, its bound)). Supported:
 * its successor is re-derived by replaying the whole chain and recorded once. Held or failed: its terminal outcome. Nothing earlier is written.
 */
export async function runFreshBookStoryboardRepair(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void; transports?: Pick<FreshTextTransports, 'responses' | 'planner'> }) {
  const { config, env, signal } = args, transports = args.transports ?? {};
  // Its own folder is this stage's output (absent, checked below); the failed text, the held recovery and the original book records are earlier entries.
  const admitted = await admitStoryboardRepair({ ...args, earlier: ['request.json', 'admission.json', 'text', FRESH_BOOK_RECOVERY.folder] });
  assertFreshBookExecutable(config);
  const ledger = freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_repair'), dir = path.join(config.bookDir, FRESH_BOOK_STORYBOARD_REPAIR.folder);
  if (existsSync(dir)) fail('fresh_book_storyboard_repair_used');
  assertReviewFloorFits(ledger);
  // Before the claim: the exact planner request must be sendable and carry every finding of the held review.
  const preview = await previewFreshBookStoryboardRepair(config, admitted.repair);
  if (preview.findings !== admitted.grant.held.findings) fail('fresh_book_storyboard_repair_findings');
  // No await from the last check to the one repair claim and its folder.
  admitted.same();
  claimFreshBookStoryboardRepair(env, admitted.grant, args.grantSha);
  admitted.recapture([`authority/${FRESH_BOOK_STORYBOARD_REPAIR.claimName}`]);
  try { mkdirSync(dir); } catch { fail('fresh_book_storyboard_repair_used'); }
  mkdirSync(path.join(dir, 'cli-workspace'));
  exclusiveJson(path.join(dir, 'repair-admission.json'), { version: FRESH_BOOK_STORYBOARD_REPAIR.version, grantSha256: args.grantSha, recovery: admitted.grant.recovery,
    held: admitted.grant.held, ledger, preview, rereviewOutcome: admitted.outcome });
  exclusiveJson(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE), admitted.repair);
  const api = new AuditionMeter(path.join(dir, 'paid-stages'), ledger.nextCapMicroUsd, FRESH_BOOK_STORYBOARD_REPAIR.apiCalls, ledger.bookKnownMicroUsd, 0, STORYBOARD_REPAIR_RULES);
  const claudeMax = new SimpleBookBudget(path.join(dir, 'claude-max-stages'), 0);
  const key = keyReader(config.keyEnvFile);
  const responses = transports.responses ?? openAIResponses(key);
  let storyboardDraft: unknown = null, failed: string | null = null;
  const seen: string[] = [];
  const record = (error: unknown): never => { failed ??= codeOf(error, 'fresh_book_provider_transport'); throw error; };
  const guard = () => { try { admitted.guard(); } catch (error) { record(error); } };
  const repaired = { parentStoryboardDigest: admitted.grant.held.storyboardDigest, addedContracts: [...FRESH_BOOK_STORYBOARD_REPAIR.addedContracts] };
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    exclusiveJson(path.join(dir, 'spend.json'), api.snapshot());
    exclusiveJson(path.join(dir, 'claude-max-spend.json'), { ...claudeMax.snapshot(), note: 'Claude Max usage is separate: not an API invoice' });
    exclusiveJson(path.join(dir, 'sealed.json'), { status, ...extra, repaired, replayed: [...seen], runtimeEligible: false });
  };
  try {
    const result = await storyboardRepairFlow({ config, repair: admitted.repair, signal, log: args.log, seen,
      live: { dir, api, claudeMax, responses, planner: transports.planner, guard, record, draft: d => { storyboardDraft = d; } } });
    guard();
    exclusiveJson(path.join(dir, 'simple-book-result.json'), result);
    exclusiveText(path.join(dir, 'story.md'), `# ${result.source.manuscript.title}\n\n` +
      result.source.manuscript.pages.map(p => `## עמוד ${p.pageNumber}\n\n${p.text}`).join('\n\n') + '\n');
    if (result.storyboard) {
      exclusiveJson(path.join(dir, 'visual_simple_book_result.json'), result);
      exclusiveJson(path.join(dir, 'owned_storyboard_draft.json'), storyboardDraft ?? fail('fresh_book_draft_missing'));
    }
    seal(result.status);
    if (result.status !== 'review_supported') finish(env, 'held_storyboard_repair', { textStatus: result.status }, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName);
    else {
      // The successor's ONE durable provenance: its whole chain replayed from the saved evidence, then recorded once under a fresh guard.
      const successor = await deriveStoryboardRepairSuccessor({ config, env, grantSha: args.grantSha, admitted });
      guard();
      exclusiveJson(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_REPAIR.successorName), successor);
      admitted.recapture([`authority/${FRESH_BOOK_STORYBOARD_REPAIR.successorName}`]);
    }
    return { status: result.status, api: api.snapshot(), claudeMax: claudeMax.snapshot(), ledger: freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_repair') };
  } catch (error) {
    const code = failed ?? codeOf(error, 'fresh_book_storyboard_repair_failed');
    if (!existsSync(path.join(dir, 'sealed.json'))) seal('failed', { code });
    if (!existsSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName))) finish(env, 'failed_storyboard_repair', { code }, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName);
    throw error;
  }
}

type RepairAdmitted = { grant: FreshBookStoryboardRepairGrant; repair: StoryboardRepair; outcome: unknown };
/**
 * The repair's successor, re-derived from its saved evidence (never its own seal, summary or a re-captured folder): its seal and admission are
 * this grant's; its repair input is exactly the held recovery's draft and raw review; its meters hold exactly the one floored review and the
 * one planner session; and replaying the WHOLE chain (text, correction, planner, review) on the paid run's own code path reproduces the saved
 * supported result exactly, in the order the run consumed it. Returns the ONE durable record (the folder by digest, bound to the grant and claims).
 */
async function deriveStoryboardRepairSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: RepairAdmitted }) {
  const { config, env } = a, grant = a.admitted.grant, dir = path.join(config.bookDir, FRESH_BOOK_STORYBOARD_REPAIR.folder);
  const refuse = (): never => fail('fresh_book_storyboard_repair_successor');
  try {
    const seal = json(path.join(dir, 'sealed.json'));
    if (!sameJson(Object.keys(seal).sort(), ['repaired', 'replayed', 'runtimeEligible', 'status']) || seal.status !== 'review_supported' || seal.runtimeEligible !== false ||
        !sameJson(seal.repaired, { parentStoryboardDigest: grant.held.storyboardDigest, addedContracts: [...FRESH_BOOK_STORYBOARD_REPAIR.addedContracts] }) ||
        !Array.isArray(seal.replayed) || !sortedSame(seal.replayed, REPAIR_REPLAYED)) refuse();
    const admission = json(path.join(dir, 'repair-admission.json'));
    if (!sameJson(Object.keys(admission).sort(), ['grantSha256', 'held', 'ledger', 'preview', 'recovery', 'rereviewOutcome', 'version']) ||
        admission.version !== FRESH_BOOK_STORYBOARD_REPAIR.version || admission.grantSha256 !== a.grantSha || !sameJson(admission.recovery, grant.recovery) ||
        !sameJson(admission.held, grant.held) || !sameJson(admission.rereviewOutcome, a.admitted.outcome) ||
        admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd || admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd) refuse();
    if (!sameJson(json(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE)), a.admitted.repair)) refuse();
    // The admitted preview is this repair's own planner request: re-derived now, and the paid planner session claimed exactly that wire.
    const preview = await previewFreshBookStoryboardRepair(config, a.admitted.repair);
    if (!sameJson(admission.preview, preview) || preview.findings !== grant.held.findings ||
        json(path.join(dir, 'claude-max-stages', 'storyboard.claim.json')).wireDigest !== preview.wireDigest) refuse();
    // The meters' own records: exactly the one review (its maximum re-derived under the floored rule) and exactly the one planner session.
    const reviewed = verifyMeterRecords(path.join(dir, 'paid-stages'), STORYBOARD_REPAIR_RULES);
    if (reviewed.length !== 1 || reviewed[0].claim.step !== 'storyboard_review' || reviewed[0].result?.completed !== true ||
        !(reviewed[0].claim.maximumMicroUsd >= REVIEW_RESERVE_FLOOR_MICRO_USD)) refuse();
    if (!sameJson(readdirSync(path.join(dir, 'claude-max-stages')).filter(n => n.endsWith('.claim.json')), ['storyboard.claim.json'])) refuse();
    const seen: string[] = [];
    const replayed = await storyboardRepairFlow({ config, repair: a.admitted.repair, signal: new AbortController().signal, log: () => {}, seen, replayDir: dir });
    const saved = json(path.join(dir, 'simple-book-result.json')), board = replayed.storyboard;
    if (!board) return refuse();
    if (!sameJson(seal.replayed, seen.filter(k => !REPAIR_OWN_CALLS.includes(k))) || replayed.status !== 'review_supported' ||
        !sameJson(plainJson(replayed), saved) || !sameJson(json(path.join(dir, 'visual_simple_book_result.json')), saved) ||
        !sameJson(json(path.join(dir, 'owned_storyboard_draft.json')), json(path.join(dir, 'claude-max-stages', 'storyboard.receipt.json')).output)) refuse();
    return { cycle: FRESH_BOOK_CYCLE.id, storyboardRepair: FRESH_BOOK_STORYBOARD_REPAIR.version, grantSha256: a.grantSha,
      originalClaimSha256: grant.recovery.originalClaimSha256, recoveryClaimSha256: grant.recovery.claimSha256,
      repairClaimSha256: previewSha(fileBytes(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_REPAIR.claimName))),
      parentStoryboardDigest: grant.held.storyboardDigest, storyboardDigest: board.storyboardDigest, reviewDigest: board.review.reviewDigest,
      reviewReserveMicroUsd: reviewed[0].claim.maximumMicroUsd as number, successorSha256: previewSha(canonicalJson(folderBaseline(dir))) };
  } catch { return refuse(); }
}
/** At every downstream entry: the successor re-derived now must equal its one durable record. */
async function verifyStoryboardRepairSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: RepairAdmitted }) {
  const record = await deriveStoryboardRepairSuccessor(a), file = path.join(a.env.authorityRoot, FRESH_BOOK_STORYBOARD_REPAIR.successorName);
  if (!existsSync(file) || !sameJson(json(file), record)) fail('fresh_book_storyboard_repair_successor');
  return record;
}

// ---------------------------------------------------------------------------------------------------------------
// The ONE diagnosed storyboard continuation (owner 2026-10-19): the first repair's held storyboard (the stage's second consecutive held
// candidate) continued as a bound successor, with the engine's own recovery state and diagnosis, under the self-check and typed review policy.
// ---------------------------------------------------------------------------------------------------------------
const CONT = FRESH_BOOK_STORYBOARD_CONTINUATION;
/** The continuation folder's durable recovery records (both re-derived by every later entry, never trusted as written). */
export const CONTINUATION_RECOVERY_STATE_FILE = 'recovery-state.json';
export const CONTINUATION_DIAGNOSIS_FILE = 'diagnosis.json';
export const CONTINUATION_RECOVERY_FINAL_FILE = 'recovery-final.json';
const admittedContinuation = (status: unknown) => (CONT.admittedStatuses as readonly unknown[]).includes(status);

/**
 * The consumed first repair and the held storyboard the continuation stands on, re-read exactly: the repair grant its claim names (naming the
 * recovery and original claims, at the repair grant's own head); the WHOLE recovery and original authority that grant consumed, re-derived by
 * the repair line's own verifier (recoveryHeld) and equal to what it recorded; its terminal held_storyboard_repair record; its folder sealed
 * held (the repaired parent, the five replays) with no successor; its admission and its saved repair input (exactly the re-derived one); its
 * meters (one floored review, one planner session); and its held storyboard re-derived: the saved draft recompiled under the repair's own
 * contracts from its own saved source and repair input to its saved book, its raw review re-judged to that held disposition, both its own
 * PAID answers. The ledger it stands on is the stages before it. The continuation input is that draft and raw review with the repair's own
 * input as parentRepair ancestry, adding the planner self-check and the typed review materiality contracts.
 */
function repairHeld(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, loaded: ReturnType<typeof loadProfile>, repairGrantFile: string) {
  const { profile, prepared, options } = loaded, refuse = (): never => fail('fresh_book_storyboard_continuation_repair');
  if (!path.isAbsolute(repairGrantFile)) refuse();
  const at = (name: string) => path.join(env.authorityRoot, name), dir = path.join(config.bookDir, FRESH_BOOK_STORYBOARD_REPAIR.folder);
  const files = { grant: repairGrantFile, claim: at(FRESH_BOOK_STORYBOARD_REPAIR.claimName), outcome: at(FRESH_BOOK_STORYBOARD_REPAIR.outcomeName),
    seal: path.join(dir, 'sealed.json'), recoveryClaim: at(FRESH_BOOK_RECOVERY.claimName), originalClaim: at(FRESH_BOOK_CYCLE.claimName),
    reviewReceipt: path.join(dir, 'paid-stages', 'storyboard_review.receipt.json') };
  if (Object.values(files).some(f => !existsSync(f)) || existsSync(at(FRESH_BOOK_STORYBOARD_REPAIR.successorName))) refuse();
  const digest = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, previewSha(fileBytes(f))])) as Record<keyof typeof files, string>;
  const parsed = freshBookStoryboardRepairGrantSchema.safeParse(json(files.grant));
  if (!parsed.success) return refuse();
  const grant = parsed.data, claim = json(files.claim), outcome = json(files.outcome), seal = json(files.seal);
  const sameDir = (p: unknown) => typeof p === 'string' && path.resolve(p).toLowerCase() === path.resolve(config.bookDir).toLowerCase();
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardRepair !== FRESH_BOOK_STORYBOARD_REPAIR.version || claim.grantSha256 !== digest.grant ||
      claim.recoveryClaimSha256 !== digest.recoveryClaim || grant.recovery.claimSha256 !== digest.recoveryClaim ||
      claim.originalClaimSha256 !== digest.originalClaim || grant.recovery.originalClaimSha256 !== digest.originalClaim || claim.engineHead !== grant.engine.head ||
      !sameDir(claim.bookDir) || !sameDir(grant.bookDir) || grant.profileSha256 !== freshBookProfileSha(profile) || claim.profileSha256 !== grant.profileSha256) refuse();
  // The whole earlier authority the repair consumed, re-derived by the repair line's own verifier, must be exactly what its grant recorded.
  let lineage: ReturnType<typeof recoveryHeld>;
  try { lineage = recoveryHeld(config, env, rereview, loaded, grant.recovery.grantFile); }
  catch (error) { if (error instanceof FreshBookError) throw error; return refuse(); }
  if (!sameJson(lineage.recovery, grant.recovery) || !sameJson(lineage.held, grant.held) || !sameJson(lineage.ledger, grant.ledger)) refuse();
  if (outcome.cycle !== FRESH_BOOK_CYCLE.id || outcome.status !== CONT.heldOutcome || !(CONT.heldStatuses as readonly string[]).includes(outcome.textStatus)) refuse();
  if (!sameJson(Object.keys(seal).sort(), ['repaired', 'replayed', 'runtimeEligible', 'status']) || seal.status !== outcome.textStatus || seal.runtimeEligible !== false ||
      !sameJson(seal.repaired, { parentStoryboardDigest: grant.held.storyboardDigest, addedContracts: [...FRESH_BOOK_STORYBOARD_REPAIR.addedContracts] }) ||
      !Array.isArray(seal.replayed) || !sortedSame(seal.replayed, REPAIR_REPLAYED)) refuse();
  const admission = json(path.join(dir, 'repair-admission.json'));
  if (!sameJson(Object.keys(admission).sort(), ['grantSha256', 'held', 'ledger', 'preview', 'recovery', 'rereviewOutcome', 'version']) ||
      admission.version !== FRESH_BOOK_STORYBOARD_REPAIR.version || admission.grantSha256 !== digest.grant || !sameJson(admission.recovery, grant.recovery) ||
      !sameJson(admission.held, grant.held)) refuse();
  const repairInput = json(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE)) as StoryboardRepair;
  if (!sameJson(repairInput, plainJson(lineage.repair))) refuse();
  const result = json(path.join(dir, 'simple-book-result.json')), draft = json(path.join(dir, 'owned_storyboard_draft.json'));
  if (!sameJson(json(path.join(dir, 'visual_simple_book_result.json')), result) || result.status !== outcome.textStatus || result.storyboard?.status !== result.status) refuse();
  let book: ReturnType<typeof compilePersonalStoryboard>, decision: ReturnType<typeof storyboardReviewDisposition>;
  try {
    const c = FRESH_BOOK_CONTRACTS;
    book = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(prepared.accepted.canonical, result.source, options, c.actorOwnedAppearance, c.momentContract,
      c.landmarkKindContract, undefined, c.sceneLocationContract, c.compilerRulesContract, repairInput, c.drawnInstantContract, true), structuredClone(draft));
    decision = storyboardReviewDisposition(book, result.storyboard.rawReview);
  } catch { return refuse(); }
  if (book.storyboardDigest !== result.storyboard.storyboardDigest || !sameJson(plainJson(book), result.storyboard.storyboard) || decision.disposition !== result.status) refuse();
  // The held draft and raw review are the repair's own PAID answers: its planner session's settled output, and its review's settled answer
  // decoded for this held book, whose paid request was exactly this book's review input.
  const settled = (folder: 'claude-max-stages' | 'paid-stages', step: string) => {
    const file = (k: string) => path.join(dir, folder, `${step}.${k}.json`);
    if (!['claim', 'wire', 'result', 'receipt'].every(k => existsSync(file(k)))) return refuse();
    const c = json(file('claim')), wire = json(file('wire')), done = json(file('result'));
    if (c.step !== step || previewSha(canonicalJson(wire)) !== c.wireDigest || done.wireDigest !== c.wireDigest || done.completed !== true) refuse();
    return { wire, receipt: json(file('receipt')) };
  };
  const planner = settled('claude-max-stages', 'storyboard'), reviewed = settled('paid-stages', 'storyboard_review');
  const reviewCall = { stage: 'review', instructions: '', input: '', maxOutputTokens: 0, context: { narrativeSpreads: book.narrativeSpreads,
    sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest, actorOwnedAppearance: true, landmarkKindContract: true } } as unknown as SimpleStoryboardDiagnosticCall;
  let paidReview: unknown;
  try { paidReview = decodePersonalBookProviderOutput(reviewCall, JSON.parse(reviewed.receipt.raw.output_text)); } catch { return refuse(); }
  if (!sameJson(draft, planner.receipt.output) || reviewed.wire.input !== canonicalJson(personalStoryboardReviewInput(book)) ||
      !sameJson(paidReview, result.storyboard.rawReview)) refuse();
  // Its meters' own records: exactly the one floored review and the one planner session.
  const meter = verifyMeterRecords(path.join(dir, 'paid-stages'), STORYBOARD_REPAIR_RULES);
  if (meter.length !== 1 || meter[0].claim.step !== 'storyboard_review' || meter[0].result?.completed !== true ||
      !sameJson(readdirSync(path.join(dir, 'claude-max-stages')).filter(n => n.endsWith('.claim.json')), ['storyboard.claim.json'])) refuse();
  const before = freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env), stages: bookStages(config.bookDir, 'storyboard_repair').slice(0, 3) });
  const continuation: StoryboardRepair = { parentStoryboardDigest: book.storyboardDigest, draft, review: result.storyboard.rawReview, parentRepair: repairInput,
    addedContracts: [...CONT.addedContracts] };
  return { repair: { grantFile: path.resolve(repairGrantFile), grantSha256: digest.grant, claimSha256: digest.claim, outcomeSha256: digest.outcome,
      sealSha256: digest.seal, folderSha256: previewSha(canonicalJson(folderBaseline(dir))), recoveryClaimSha256: digest.recoveryClaim,
      originalClaimSha256: digest.originalClaim, reviewReceiptSha256: digest.reviewReceipt },
    held: { sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest, reviewDigest: decision.reviewDigest,
      disposition: decision.disposition as (typeof CONT.heldStatuses)[number], draftSha256: previewSha(canonicalJson(draft)),
      findings: storyboardRepairFindings(decision.review).length },
    ledger: { diagnosticSettledMicroUsd: before.diagnosticSettledMicroUsd, bookKnownMicroUsd: before.bookKnownMicroUsd,
      calls: before.stages.reduce((n, s) => n + s.calls, 0) },
    earlier: lineage.held, source: result.source, continuation };
}

/**
 * The stage's durable recovery records at admission, derived by the ENGINE from the continuation source (its chain of held candidates, their
 * contexts and findings, this attempt's context and the diagnosis it carries) and checked against this line's own records: the chain is
 * exactly the recovery's and the repair's held storyboards with their findings, and the reducer's state is two consecutive failures with one
 * attempt left. Each attempt's settled costs come from its own meter records (an unknown one refuses: it is never zero). Deterministic: the
 * same saved evidence yields the same bytes at the plan, the run and every later re-derivation.
 */
function continuationRecovery(config: FreshBookConfig, loaded: ReturnType<typeof loadProfile>, held: ReturnType<typeof repairHeld>) {
  const refuse = (): never => fail('fresh_book_storyboard_continuation_recovery'), c = FRESH_BOOK_CONTRACTS;
  let rec: ReturnType<typeof storyboardRecovery>;
  try {
    rec = storyboardRecovery(prepareCurrentPersonalStoryboard(loaded.prepared.accepted.canonical, held.source, loaded.options, c.actorOwnedAppearance, c.momentContract,
      c.landmarkKindContract, undefined, c.sceneLocationContract, c.compilerRulesContract, held.continuation, c.drawnInstantContract, true, true, true));
  } catch { return refuse(); }
  const lines = [{ folder: FRESH_BOOK_RECOVERY.folder, ...held.earlier }, { folder: FRESH_BOOK_STORYBOARD_REPAIR.folder, ...held.held }];
  const diagnosis = rec.diagnosis ?? refuse(), diagnosed = rec.diagnosisDigest ?? refuse();
  if (rec.chain.length !== lines.length || rec.chain.some((a, i) => a.storyboardDigest !== lines[i].storyboardDigest || a.findings.length !== lines[i].findings) ||
      diagnosisDigest(diagnosis) !== diagnosed) refuse();
  const state = recoveryState(chainAttempts(rec.chain), { maxAttempts: STORYBOARD_MAX_ATTEMPTS });
  if (state.mode !== 'diagnose_and_change_strategy' || state.consecutiveFailures !== CONT.priorAttempts || state.maxAttempts !== CONT.maxAttempts ||
      state.remaining !== 1) refuse();
  const settledCost = (folder: string, store: 'claude-max-stages' | 'paid-stages', step: string) => {
    const done = json(path.join(config.bookDir, folder, store, `${step}.result.json`));
    return done.completed === true && Number.isSafeInteger(done.estimatedMicroUsd) && done.estimatedMicroUsd >= 0 ? done.estimatedMicroUsd as number
      : fail('fresh_book_storyboard_continuation_unknown_cost');
  };
  const record = { version: STAGE_RECOVERY_VERSION, stage: 'storyboard', diagnosisVersion: STORYBOARD_DIAGNOSIS_VERSION, maxAttempts: state.maxAttempts,
    attempts: rec.chain.map((a, i) => ({ attempt: i + 1, line: lines[i].folder, sourceDigest: lines[i].sourceDigest, storyboardDigest: a.storyboardDigest,
      reviewDigest: lines[i].reviewDigest, contextDigest: a.contextDigest, contracts: a.contracts, outcome: 'held' as const, disposition: lines[i].disposition,
      findings: chainAttempts([a])[0].findings,
      costs: { plannerClaudeMaxMicroUsd: settledCost(lines[i].folder, 'claude-max-stages', 'storyboard'),
        reviewApiMicroUsd: settledCost(lines[i].folder, 'paid-stages', 'storyboard_review') } })),
    consecutiveFailures: state.consecutiveFailures, mode: state.mode, remaining: state.remaining, trajectory: state.trajectory,
    next: { attempt: state.attempts + 1, line: CONT.folder, contracts: rec.contracts, contextDigest: rec.context, diagnosisDigest: diagnosed,
      addedContracts: [...CONT.addedContracts], reviewPolicy: STORYBOARD_REVIEW_IMPACT_VERSION, selfCheck: STORYBOARD_SELF_CHECK_VERSION,
      strategy: 'diagnose_and_change_strategy: the planner consumes the engine diagnosis (priorReviewedStoryboard.diagnosis) and answers every diagnosed finding in its self-check resolutions (cause class, confirmed facts vs hypothesis, impact, remedy, the sections it changed, verified against the parent, and the success check), protecting resolved pages; the review types each issue\'s impact (only bound, positively justified detail is a non-blocking note)' },
    terminal: null };
  const diagnosisRecord = { version: STORYBOARD_DIAGNOSIS_VERSION, diagnosisDigest: diagnosed, diagnosis,
    /** The latest held review's own words, which the diagnosis references by key (copied here for the record, never edited). */
    latestReviewFindings: rec.chain[rec.chain.length - 1].findings,
    allowance: { attempts: diagnosis.allowance, money: { bookKnownMicroUsd: held.ledger.bookKnownMicroUsd, bookSubcapMicroUsd: FRESH_BOOK_CYCLE.bookSubcapMicroUsd,
      reviewReserveFloorMicroUsd: CONT.reviewReserveFloorMicroUsd, plannerRoute: 'Claude Max: separate resource, not an API invoice, not $0' } } };
  return { record, stateSha256: previewSha(canonicalJson(record)), diagnosisRecord, contextDigest: rec.context, diagnosisDigest: diagnosed };
}

/** Provider-free plan and the continuation grant this exact state needs (no key, no provider, no write). */
export function planFreshBookStoryboardContinuation(config: FreshBookConfig, env: FreshBookEnv, repairGrantFile: string) {
  const base = planFreshBook(config, env), loaded = loadProfile(config);
  const held = repairHeld(config, env, base.rereview, loaded, repairGrantFile), derived = continuationRecovery(config, loaded, held);
  const at = (name: string) => path.join(env.authorityRoot, name);
  const plan = { version: CONT.version, cycle: FRESH_BOOK_CYCLE.id, amendment: CONT.amendment, basePlanSha256: base.grantDraft.nativePlanSha256,
    bookDir: path.resolve(config.bookDir), folder: CONT.folder, storyboardDir: CONT.folder,
    replay: { calls: [...REPAIR_REPLAYED], from: 'the failed text and the recovery (saved wires and receipts, byte-exact; no provider or model callback)' },
    continuation: { contract: 'storyboard-repair/v1', parent: held.held, ancestry: [held.earlier.storyboardDigest, held.held.storyboardDigest],
      addedContracts: [...CONT.addedContracts],
      input: 'the held repair draft and its exact raw review, with the repair\'s own input as parentRepair: the engine re-binds every ancestor and derives every finding (none chosen, edited or dropped)' },
    recovery: { reducer: STAGE_RECOVERY_VERSION, diagnosis: STORYBOARD_DIAGNOSIS_VERSION, selfCheck: STORYBOARD_SELF_CHECK_VERSION,
      reviewImpact: STORYBOARD_REVIEW_IMPACT_VERSION, attempts: derived.record.attempts.length, maxAttempts: derived.record.maxAttempts,
      mode: derived.record.mode, stateSha256: derived.stateSha256, diagnosisDigest: derived.diagnosisDigest, contextDigest: derived.contextDigest,
      last: 'this is the stage\'s last attempt: held again ends the line (stop_allowance_exhausted)' },
    calls: { planner: `storyboard: Opus 5.5 on Claude Max (${OPUS_PLANNER.model}), ${CONT.plannerCalls}`, review: `storyboard_review: Sol 6.1 (${SOL}), ${CONT.apiCalls}`,
      reviewReserve: `max(${REVIEW_RESERVE_FLOOR_MICRO_USD}, the bound its request derives); admission refuses before the claim below the floor, the meter before the key or provider below that maximum; journal and replay derive it under the same rule` },
    downstream: ['child --storyboard-continuation', 'book --storyboard-continuation [--resume]'],
    caps: { ...base.plan.caps, storyboardContinuationApiCalls: CONT.apiCalls },
    claim: at(CONT.claimName), outcome: at(CONT.outcomeName), successor: at(CONT.successorName),
    successorAdmission: 'downstream replays the whole chain (text, correction, planner, review) from the saved evidence and re-derives the recovery records against its one durable record',
    providerCalls: 0, keyRead: false };
  const engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_STORYBOARD_CONTINUATION_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft: FreshBookStoryboardContinuationGrant = freshBookStoryboardContinuationGrantSchema.parse({ version: 'fresh-book-storyboard-continuation-grant/v1',
    cycle: FRESH_BOOK_CYCLE.id, approval: FRESH_BOOK_CYCLE.approval, amendment: CONT.amendment, profileSha256: base.plan.profileSha256,
    bookDir: path.resolve(config.bookDir), repair: held.repair, held: held.held,
    recovery: { version: STAGE_RECOVERY_VERSION, attempts: derived.record.attempts.length, maxAttempts: derived.record.maxAttempts,
      consecutiveFailures: derived.record.consecutiveFailures, mode: derived.record.mode, stateSha256: derived.stateSha256, diagnosisDigest: derived.diagnosisDigest,
      contextDigest: derived.contextDigest },
    ledger: held.ledger, allowance: { plannerCalls: CONT.plannerCalls, apiCalls: CONT.apiCalls, reviewReserveFloorMicroUsd: CONT.reviewReserveFloorMicroUsd },
    addedContracts: [...CONT.addedContracts], engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)) });
  const probe = (f: () => unknown) => { try { return f(); } catch (e) { return { refused: e && typeof e === 'object' && 'code' in e ? e.code : String(e) }; } };
  const state = { claimExists: existsSync(plan.claim), outcomeExists: existsSync(plan.outcome), successorExists: existsSync(plan.successor),
    folderExists: existsSync(path.join(config.bookDir, CONT.folder)),
    ledger: probe(() => freshBookLedger(config, env, base.rereview, 'storyboard_continuation')),
    reviewFloor: probe(() => assertReviewFloorFits(freshBookLedger(config, env, base.rereview, 'storyboard_continuation'))),
    executablePinned: probe(() => assertFreshBookExecutable(config)), engine };
  return { plan, grantDraft, state, profile: base.profile, prepared: loaded.prepared, options: loaded.options, rereview: base.rereview,
    continuation: held.continuation, recoveryRecord: derived.record, diagnosisRecord: derived.diagnosisRecord };
}

/**
 * A continuation-line stage's admission, as admitStoryboardRepair: the baseline pinned FIRST and held across every await: the continuation
 * grant bytes, the consumed repair grant's bytes, the recovery grant's bytes it names and the original grant's bytes that one names (each at
 * its recorded digest, never re-pinned to this head), configuration, profile, lineage, every line's authority records and the earlier stage
 * entries (the failed text, the held recovery and the held repair). The grant is exactly the draft this state rebuilds, at the clean reviewed
 * head. Its guard adds the continuation claim and the repair, recovery and original claims it names.
 */
async function admitStoryboardContinuation(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal; earlier: string[] }) {
  const bytes = fileBytes(a.grantFile);
  if (previewSha(bytes) !== a.grantSha) fail('fresh_book_storyboard_continuation_grant');
  const parsed = freshBookStoryboardContinuationGrantSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success) return fail('fresh_book_storyboard_continuation_grant');
  const repairFile = parsed.data.repair.grantFile, repairBytes = fileBytes(repairFile);
  if (previewSha(repairBytes) !== parsed.data.repair.grantSha256) fail('fresh_book_storyboard_continuation_repair');
  let named: FreshBookStoryboardRepairGrant, recoveryGrant: FreshBookRecoveryGrant;
  try { named = freshBookStoryboardRepairGrantSchema.parse(JSON.parse(repairBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_continuation_repair'); }
  const recoveryFile = named.recovery.grantFile, recoveryBytes = fileBytes(recoveryFile);
  if (previewSha(recoveryBytes) !== named.recovery.grantSha256) fail('fresh_book_storyboard_repair_recovery');
  try { recoveryGrant = freshBookRecoveryGrantSchema.parse(JSON.parse(recoveryBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_repair_recovery'); }
  const originalFile = recoveryGrant.original.grantFile, originalBytes = fileBytes(originalFile);
  if (previewSha(originalBytes) !== recoveryGrant.original.grantSha256) fail('fresh_book_recovery_original');
  const rereview = loadRereview(a.config);
  let roots = rootsOf(a.config, a.env, rereview, a.earlier);
  const planned = planFreshBookStoryboardContinuation(a.config, a.env, repairFile);
  const outcome = await assertFreshBookAdmission(planned.rereview, a.env);
  const engine = a.env.head();
  if (canonicalJson(parsed.data) !== canonicalJson(planned.grantDraft)) fail('fresh_book_storyboard_continuation_grant');
  if (!engine.clean || engine.head !== planned.grantDraft.engine.head || engine.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    if (!fileBytes(a.grantFile).equals(bytes)) fail('fresh_book_storyboard_continuation_grant');
    if (!fileBytes(repairFile).equals(repairBytes)) fail('fresh_book_storyboard_continuation_repair');
    if (!fileBytes(recoveryFile).equals(recoveryBytes)) fail('fresh_book_storyboard_repair_recovery');
    if (!fileBytes(originalFile).equals(originalBytes)) fail('fresh_book_recovery_original');
    if (canonicalJson(rootsOf(a.config, a.env, rereview, a.earlier)) !== canonicalJson(roots)) fail('fresh_book_roots_changed');
    const e = a.env.head();
    if (!e.clean || e.head !== planned.grantDraft.engine.head || e.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(planned.grantDraft.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
  };
  const guard = () => { same(); assertFreshBookStoryboardContinuationPaid({ env: a.env, grantFile: a.grantFile, grantSha: a.grantSha, profile: planned.profile, workspace: workspace() }); };
  const recapture = (added: string[]) => {
    const next = rootsOf(a.config, a.env, rereview, a.earlier), changed = Object.keys(next).filter(k => next[k] !== roots[k]);
    if (canonicalJson(Object.keys(next).sort()) !== canonicalJson(Object.keys(roots).sort()) || canonicalJson(changed.sort()) !== canonicalJson([...added].sort()) ||
        added.some(k => roots[k] !== 'absent' || next[k] === 'absent')) fail('fresh_book_roots_changed');
    roots = next; same();
  };
  same();
  return { planned, outcome, same, guard, recapture, grant: planned.grantDraft, continuation: planned.continuation };
}

type ContinuationPreview = RepairPreview & { outputCap: number; argvChars: number; argvLimit: number; diagnosisDigest: string; resolutionsRequired: number;
  protectedPages: number[] };
/**
 * Provider-free preview of the continuation's ONE planner request, on the paid run's own code path (the repair's flow under the continuation's
 * spec): the text and the correction replayed, the continuation source prepared (both ancestors re-bound, every finding and the diagnosis
 * derived by the engine), then the planner's request and CLI wire built and measured (content, wire and argv limits, output cap, session
 * guard) and stopped before any session. The paid stage runs it before its claim; its wire digest binds the paid one.
 */
export async function previewFreshBookStoryboardContinuation(config: FreshBookConfig, continuation: StoryboardRepair): Promise<ContinuationPreview> {
  const out: { preview?: ContinuationPreview } = {};
  try {
    await storyboardRepairFlow({ config, repair: continuation, signal: new AbortController().signal, log: () => {}, seen: [], spec: CONTINUATION_SPEC, preview: (wire, call) => {
      const input = JSON.parse(call.input), diagnosis = input?.priorReviewedStoryboard?.diagnosis;
      if (!diagnosis) return fail('fresh_book_storyboard_continuation_preview');
      out.preview = { contentBytes: Buffer.byteLength(call.instructions, 'utf8') + Buffer.byteLength(call.input, 'utf8'), contentByteLimit: SIMPLE_STORYBOARD_INPUT_LIMIT,
        wireBytes: wire.bytes, wireByteLimit: 104000, reservedMicroUsd: wire.reservedMicroUsd, sessionGuardMicroUsd: OPUS_PLANNER.sessionGuardMicroUsd,
        findings: Array.isArray(input?.priorReviewedStoryboard?.reviewFindings) ? input.priorReviewedStoryboard.reviewFindings.length : 0,
        instructionsSha256: previewSha(call.instructions), inputSha256: previewSha(call.input), wireDigest: previewSha(canonicalJson(wire)),
        outputCap: wire.outputCap, argvChars: wire.args.map(x => JSON.stringify(x)).join(' ').length + String(wire.payload.executable).length, argvLimit: 31000,
        diagnosisDigest: previewSha(canonicalJson(diagnosis)), resolutionsRequired: diagnosis.findings.length, protectedPages: diagnosis.protectedPages };
      return fail('fresh_book_storyboard_continuation_preview_complete');
    } });
  } catch (error) { if (!out.preview) throw error; }
  return out.preview ?? fail('fresh_book_storyboard_continuation_preview');
}

/** The stage's terminal recovery record after the continuation's review: its own candidate appended, then the reducer's state (never a reset). */
function continuationRecoveryFinal(record: ReturnType<typeof continuationRecovery>['record'], board: { storyboardDigest: string; status: string;
  review: { reviewDigest: string; impact?: { blocking: { scope: 'book' | 'page'; pageNumber?: number; category: string; verdict: string; observation: string }[];
    notes: unknown[] } } }) {
  const admitted = admittedContinuation(board.status), impact = board.review.impact ?? fail('fresh_book_storyboard_continuation_policy');
  const own = { attempt: record.attempts.length + 1, candidateDigest: board.storyboardDigest, contextDigest: record.next.contextDigest,
    outcome: admitted ? 'admitted' as const : 'held' as const,
    findings: admitted ? [] : chainAttempts([{ storyboardDigest: board.storyboardDigest, contextDigest: record.next.contextDigest, findings: impact.blocking.map(f =>
      f.scope === 'book' ? { scope: 'book' as const, category: f.category, verdict: f.verdict as 'contradiction', observation: f.observation }
        : { scope: 'page' as const, pageNumber: f.pageNumber!, category: f.category, verdict: f.verdict as 'contradiction', observation: f.observation }) }])[0].findings };
  const state = recoveryState([...record.attempts.map(a => ({ attempt: a.attempt, candidateDigest: a.storyboardDigest, contextDigest: a.contextDigest,
    outcome: a.outcome, findings: a.findings })), own], { maxAttempts: record.maxAttempts });
  return { version: STAGE_RECOVERY_VERSION, stage: 'storyboard', stateSha256AtAdmission: previewSha(canonicalJson(record)),
    attempt: { ...own, line: CONT.folder, disposition: board.status, reviewDigest: board.review.reviewDigest, notes: impact.notes },
    consecutiveFailures: state.consecutiveFailures, mode: state.mode, remaining: state.remaining,
    terminal: admitted ? 'admitted' as const : state.mode === 'stop_allowance_exhausted' ? 'stop_allowance_exhausted' as const : fail('fresh_book_storyboard_continuation_recovery') };
}

/**
 * The ONE diagnosed continuation of the same book: admission re-derives the held repair and its whole lineage exactly, the engine's recovery
 * state and diagnosis, the balance must cover the review's floor, the planner request must be sendable; then one claim and its own folder with
 * its admission, its input, the recovery state and the diagnosis; the text and the correction are replayed, and the Opus Max planner and the
 * Sol review run once each on the native call sites (the review reserves max(600000, its bound)). Admitted (supported, or supported with bound
 * detail notes): its successor is re-derived by replaying the whole chain and recorded once. Held: its terminal outcome (the stage's attempt
 * ceiling is reached). Failed: its terminal outcome. Nothing earlier is written.
 */
export async function runFreshBookStoryboardContinuation(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void; transports?: Pick<FreshTextTransports, 'responses' | 'planner'> }) {
  const { config, env, signal } = args, transports = args.transports ?? {};
  const admitted = await admitStoryboardContinuation({ ...args, earlier: ['request.json', 'admission.json', 'text', FRESH_BOOK_RECOVERY.folder, FRESH_BOOK_STORYBOARD_REPAIR.folder] });
  assertFreshBookExecutable(config);
  const ledger = freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_continuation'), dir = path.join(config.bookDir, CONT.folder);
  if (existsSync(dir)) fail('fresh_book_storyboard_continuation_used');
  assertReviewFloorFits(ledger, 'fresh_book_storyboard_continuation_budget');
  // Before the claim: the exact planner request must be sendable, carry every finding of the held review and the diagnosis the grant names.
  const preview = await previewFreshBookStoryboardContinuation(config, admitted.continuation);
  if (preview.findings !== admitted.grant.held.findings || preview.diagnosisDigest !== admitted.grant.recovery.diagnosisDigest ||
      preview.argvChars > preview.argvLimit || preview.wireBytes > preview.wireByteLimit) fail('fresh_book_storyboard_continuation_findings');
  // No await from the last check to the one continuation claim and its folder.
  admitted.same();
  claimFreshBookStoryboardContinuation(env, admitted.grant, args.grantSha);
  admitted.recapture([`authority/${CONT.claimName}`]);
  try { mkdirSync(dir); } catch { fail('fresh_book_storyboard_continuation_used'); }
  mkdirSync(path.join(dir, 'cli-workspace'));
  exclusiveJson(path.join(dir, 'continuation-admission.json'), { version: CONT.version, grantSha256: args.grantSha, repair: admitted.grant.repair, held: admitted.grant.held,
    recovery: admitted.grant.recovery, ledger, preview, rereviewOutcome: admitted.outcome });
  exclusiveJson(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE), admitted.continuation);
  exclusiveJson(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE), admitted.planned.recoveryRecord);
  exclusiveJson(path.join(dir, CONTINUATION_DIAGNOSIS_FILE), admitted.planned.diagnosisRecord);
  const api = new AuditionMeter(path.join(dir, 'paid-stages'), ledger.nextCapMicroUsd, CONT.apiCalls, ledger.bookKnownMicroUsd, 0, STORYBOARD_CONTINUATION_RULES);
  const claudeMax = new SimpleBookBudget(path.join(dir, 'claude-max-stages'), 0);
  const key = keyReader(config.keyEnvFile);
  const responses = transports.responses ?? openAIResponses(key);
  let storyboardDraft: unknown = null, failed: string | null = null;
  const seen: string[] = [];
  const record = (error: unknown): never => { failed ??= codeOf(error, 'fresh_book_provider_transport'); throw error; };
  const guard = () => { try { admitted.guard(); } catch (error) { record(error); } };
  const continued = { parentStoryboardDigest: admitted.grant.held.storyboardDigest, addedContracts: [...CONT.addedContracts] };
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    exclusiveJson(path.join(dir, 'spend.json'), api.snapshot());
    exclusiveJson(path.join(dir, 'claude-max-spend.json'), { ...claudeMax.snapshot(), note: 'Claude Max usage is separate: not an API invoice' });
    exclusiveJson(path.join(dir, 'sealed.json'), { status, ...extra, continued, replayed: [...seen], runtimeEligible: false });
  };
  try {
    const result = await storyboardRepairFlow({ config, repair: admitted.continuation, signal, log: args.log, seen, spec: CONTINUATION_SPEC,
      live: { dir, api, claudeMax, responses, planner: transports.planner, guard, record, draft: d => { storyboardDraft = d; } } });
    guard();
    exclusiveJson(path.join(dir, 'simple-book-result.json'), result);
    exclusiveText(path.join(dir, 'story.md'), `# ${result.source.manuscript.title}\n\n` +
      result.source.manuscript.pages.map(p => `## עמוד ${p.pageNumber}\n\n${p.text}`).join('\n\n') + '\n');
    if (result.storyboard) {
      exclusiveJson(path.join(dir, 'visual_simple_book_result.json'), result);
      exclusiveJson(path.join(dir, 'owned_storyboard_draft.json'), storyboardDraft ?? fail('fresh_book_draft_missing'));
    }
    seal(result.status);
    const board = result.storyboard ?? fail('fresh_book_storyboard_continuation_policy');
    const final = continuationRecoveryFinal(admitted.planned.recoveryRecord, { storyboardDigest: board.storyboardDigest, status: result.status, review: board.review });
    exclusiveJson(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE), final);
    if (!admittedContinuation(result.status)) finish(env, CONT.ownHeldOutcome, { textStatus: result.status, recovery: final.terminal }, CONT.outcomeName);
    else {
      // The successor's ONE durable provenance: its whole chain replayed from the saved evidence, then recorded once under a fresh guard.
      const successor = await deriveStoryboardContinuationSuccessor({ config, env, grantSha: args.grantSha, admitted });
      guard();
      exclusiveJson(path.join(env.authorityRoot, CONT.successorName), successor);
      admitted.recapture([`authority/${CONT.successorName}`]);
    }
    return { status: result.status, recovery: final, api: api.snapshot(), claudeMax: claudeMax.snapshot(),
      ledger: freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_continuation') };
  } catch (error) {
    const code = failed ?? codeOf(error, 'fresh_book_storyboard_continuation_failed');
    if (!existsSync(path.join(dir, 'sealed.json'))) seal('failed', { code });
    if (!existsSync(path.join(env.authorityRoot, CONT.outcomeName))) finish(env, 'failed_storyboard_continuation', { code }, CONT.outcomeName);
    throw error;
  }
}

type ContinuationAdmitted = { grant: FreshBookStoryboardContinuationGrant; continuation: StoryboardRepair; outcome: unknown;
  planned: Pick<ReturnType<typeof planFreshBookStoryboardContinuation>, 'recoveryRecord' | 'diagnosisRecord'> };
/**
 * The continuation's successor, re-derived from its saved evidence (never its own seal, summary or a re-captured folder): its seal and
 * admission are this grant's; its input is exactly the held repair's draft and raw review with the repair input as ancestry; its recovery
 * state and diagnosis are exactly the ones the engine derives now; its meters hold exactly the one floored review and the one planner session;
 * replaying the WHOLE chain (text, correction, planner, review) on the paid run's own code path reproduces the saved admitted result exactly;
 * its terminal recovery record is the reducer's state after that result. Returns the ONE durable record (the folder by digest, bound to the
 * grant, every claim and the recovery records).
 */
async function deriveStoryboardContinuationSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: ContinuationAdmitted }) {
  const { config, env } = a, grant = a.admitted.grant, dir = path.join(config.bookDir, CONT.folder);
  const refuse = (): never => fail('fresh_book_storyboard_continuation_successor');
  try {
    const seal = json(path.join(dir, 'sealed.json'));
    if (!sameJson(Object.keys(seal).sort(), ['continued', 'replayed', 'runtimeEligible', 'status']) || !admittedContinuation(seal.status) || seal.runtimeEligible !== false ||
        !sameJson(seal.continued, { parentStoryboardDigest: grant.held.storyboardDigest, addedContracts: [...CONT.addedContracts] }) ||
        !Array.isArray(seal.replayed) || !sortedSame(seal.replayed, REPAIR_REPLAYED)) refuse();
    const admission = json(path.join(dir, 'continuation-admission.json'));
    if (!sameJson(Object.keys(admission).sort(), ['grantSha256', 'held', 'ledger', 'preview', 'recovery', 'repair', 'rereviewOutcome', 'version']) ||
        admission.version !== CONT.version || admission.grantSha256 !== a.grantSha || !sameJson(admission.repair, grant.repair) || !sameJson(admission.held, grant.held) ||
        !sameJson(admission.recovery, grant.recovery) || !sameJson(admission.rereviewOutcome, a.admitted.outcome) ||
        admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd || admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd) refuse();
    if (!sameJson(json(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE)), a.admitted.continuation) ||
        !sameJson(json(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE)), a.admitted.planned.recoveryRecord) ||
        !sameJson(json(path.join(dir, CONTINUATION_DIAGNOSIS_FILE)), a.admitted.planned.diagnosisRecord) ||
        previewSha(canonicalJson(json(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE)))) !== grant.recovery.stateSha256) refuse();
    // The admitted preview is this continuation's own planner request: re-derived now, and the paid planner session claimed exactly that wire.
    const preview = await previewFreshBookStoryboardContinuation(config, a.admitted.continuation);
    if (!sameJson(admission.preview, preview) || preview.findings !== grant.held.findings || preview.diagnosisDigest !== grant.recovery.diagnosisDigest ||
        json(path.join(dir, 'claude-max-stages', 'storyboard.claim.json')).wireDigest !== preview.wireDigest) refuse();
    const reviewed = verifyMeterRecords(path.join(dir, 'paid-stages'), STORYBOARD_CONTINUATION_RULES);
    if (reviewed.length !== 1 || reviewed[0].claim.step !== 'storyboard_review' || reviewed[0].result?.completed !== true ||
        !(reviewed[0].claim.maximumMicroUsd >= REVIEW_RESERVE_FLOOR_MICRO_USD)) refuse();
    if (!sameJson(readdirSync(path.join(dir, 'claude-max-stages')).filter(n => n.endsWith('.claim.json')), ['storyboard.claim.json'])) refuse();
    const seen: string[] = [];
    const replayed = await storyboardRepairFlow({ config, repair: a.admitted.continuation, signal: new AbortController().signal, log: () => {}, seen,
      spec: CONTINUATION_SPEC, replayDir: dir });
    const saved = json(path.join(dir, 'simple-book-result.json')), board = replayed.storyboard;
    if (!board) return refuse();
    if (!sameJson(seal.replayed, seen.filter(k => !ownCalls(CONTINUATION_SPEC).includes(k))) || !admittedContinuation(replayed.status) || replayed.status !== seal.status ||
        !sameJson(plainJson(replayed), saved) || !sameJson(json(path.join(dir, 'visual_simple_book_result.json')), saved) ||
        !sameJson(json(path.join(dir, 'owned_storyboard_draft.json')), json(path.join(dir, 'claude-max-stages', 'storyboard.receipt.json')).output)) refuse();
    const final = continuationRecoveryFinal(a.admitted.planned.recoveryRecord, { storyboardDigest: board.storyboardDigest, status: replayed.status, review: board.review });
    if (!sameJson(json(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE)), plainJson(final))) refuse();
    return { cycle: FRESH_BOOK_CYCLE.id, storyboardContinuation: CONT.version, grantSha256: a.grantSha,
      originalClaimSha256: grant.repair.originalClaimSha256, recoveryClaimSha256: grant.repair.recoveryClaimSha256, repairClaimSha256: grant.repair.claimSha256,
      continuationClaimSha256: previewSha(fileBytes(path.join(env.authorityRoot, CONT.claimName))),
      parentStoryboardDigest: grant.held.storyboardDigest, storyboardDigest: board.storyboardDigest, reviewDigest: board.review.reviewDigest,
      disposition: replayed.status, notes: board.review.impact?.notes.length ?? 0, reviewReserveMicroUsd: reviewed[0].claim.maximumMicroUsd as number,
      recoveryStateSha256: grant.recovery.stateSha256, diagnosisDigest: grant.recovery.diagnosisDigest,
      recoveryFinalSha256: previewSha(canonicalJson(final)), successorSha256: previewSha(canonicalJson(folderBaseline(dir))) };
  } catch { return refuse(); }
}
/** At every downstream entry: the continuation's successor re-derived now must equal its one durable record. */
async function verifyStoryboardContinuationSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: ContinuationAdmitted }) {
  const record = await deriveStoryboardContinuationSuccessor(a), file = path.join(a.env.authorityRoot, CONT.successorName);
  if (!existsSync(file) || !sameJson(json(file), record)) fail('fresh_book_storyboard_continuation_successor');
  return record;
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
  log: (line: string) => void; recovery?: true; storyboardRepair?: true; storyboardContinuation?: true }) {
  const { config, env, signal } = args, line = lineOf(args.recovery, args.storyboardRepair, args.storyboardContinuation);
  const admitted = await admitLine(args, line, ['request.json', 'admission.json', 'text']);
  admitted.guard();
  if (!(await linePassed(args, line, admitted))) fail('fresh_book_stage_not_passed');
  admitted.guard();
  const profile = admitted.planned.profile, loaded = loadReviewedStoryboard(config.bookDir, workspace(), layoutFor(profile, undefined, line.storyboardDir));
  const anchor = anchorAuthority(profile, loaded.book.plan.wardrobe), contextSha = childAnchorInspectionContextSha(anchor.context);
  const ledger = freshBookLedger(config, env, admitted.planned.rereview, line.ledger);
  const finishLine = (status: string, extra: Record<string, unknown>) => finish(env, status, extra, line.outcomeName);
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
      finishLine('held_child', { disposition: result.disposition });
      return { status: 'child_reference_held' as const, disposition: result.disposition };
    }
    save('reference_child_adoption', { name: 'child', context: anchor.context, candidate: result.candidate, authority: 'fresh_book_reviewed_passed', anchor: result.record });
    exclusiveJson(path.join(config.bookDir, 'book-layout.json'), layoutFor(profile, result.candidate.imageName, line.storyboardDir));
    seal('child_reference_passed', { candidate: result.candidate, contextSha, childAnchor: profile.childAnchor,
      ...(result.acceptedDeviations ? { acceptedDeviations: result.acceptedDeviations } : {}) });
    return { status: 'child_reference_passed' as const, candidate: result.candidate };
  } catch (error) {
    if (!existsSync(path.join(childDir, 'sealed.json'))) seal('failed', { code: codeOf(error, 'fresh_book_child_failed') });
    if (!existsSync(path.join(env.authorityRoot, line.outcomeName))) finishLine('failed_child', { code: codeOf(error, 'fresh_book_child_failed') });
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
async function freshAuditionGrant(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, profile: FreshBookProfile, line: Line = ORIGINAL_LINE): Promise<AuditionGrant> {
  const layout = readReviewedBookLayout(path.join(config.bookDir, 'book-layout.json'));
  if (canonicalJson(layout) !== canonicalJson(layoutFor(profile, layout.childImage, line.storyboardDir))) fail('fresh_book_layout');
  const loaded = loadReviewedBook(config.bookDir, workspace(), undefined, layout);
  await assertInspectedChildSettled(config.bookDir, anchorAuthority(profile, loaded.book.plan.wardrobe), json(path.join(config.bookDir, 'child', 'reference_child_adoption.json')),
    loaded.childBytes);
  const stages = bookStages(config.bookDir, line.ledger).slice(0, -1);
  const ledger = freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env), stages });
  // Each stage's saved spend record must say what its own calls re-derive to (a summary is never the authority).
  const evidence = stages.map((s, i) => {
    verifyMeterRecords(path.join(s.dir, 'paid-stages'), s.rules);
    const file = path.join(s.dir, 'spend.json'), saved = json(file);
    if (saved.newKnownApiMicroUsd !== ledger.stages[i].knownMicroUsd || saved.unknownCost || saved.unknownOutcome) fail('fresh_book_ledger_record');
    return { file, sha256: previewSha(fileBytes(file)) };
  });
  const claimSha256 = previewSha(fileBytes(path.join(env.authorityRoot, line.claimName)));
  return auditionGrantSchema.parse({ version: 'audition-spend-grant/v1', approvalReference: FRESH_BOOK_CYCLE.approval,
    book: { requestId: loaded.queued.requestId, storyboardDigest: loaded.book.storyboardDigest },
    ledger: { priorKnownApiMicroUsd: ledger.bookKnownMicroUsd, evidence,
      note: `Fresh-book ledger under the one USD 7 book subcap (cycle ${FRESH_BOOK_CYCLE.id}): the text and child stages above, each re-derived; the diagnostic subcap (${ledger.diagnosticSettledMicroUsd} microUSD settled) is separate; old books and their carry are untouched.` },
    capMicroUsd: ledger.nextCapMicroUsd, maxCalls: AUDITION_WORST_CASE_CALLS,
    // The continuation line carries the engine's page recovery rule (diagnosis after two held attempts, same three-attempt ceiling).
    scope: { mode: 'render', pages: [0, 1, 2, 3, 4, 5, 6, 7, 8], sample: earliestSameScenePair(loaded.book),
      ...(line.kind === 'storyboard_continuation' ? { recovery: STAGE_RECOVERY_VERSION } : {}) },
    claudeMax: 'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger',
    experiment: { slot: FRESH_BOOK_AUDITION_SLOT, claimSha256 } });
}

export async function runFreshBookBook(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void; resume?: true; recovery?: true; storyboardRepair?: true; storyboardContinuation?: true }) {
  const { config, env } = args, line = lineOf(args.recovery, args.storyboardRepair, args.storyboardContinuation);
  // The audition grant is pinned too (absent on a start, its bytes on a resume); the start record is part of the authority roots.
  const earlier = ['request.json', 'admission.json', 'text', 'child', 'book-layout.json', 'audition.grant.json'];
  const admitted = await admitLine(args, line, earlier);
  admitted.guard();
  if (!(await linePassed(args, line, admitted)) || sealedStatus(path.join(config.bookDir, 'child')) !== 'child_reference_passed' ||
      existsSync(path.join(env.authorityRoot, line.outcomeName))) fail('fresh_book_stage_not_passed');
  const grant = await freshAuditionGrant(config, env, admitted.planned.rereview, admitted.planned.profile, line);
  const grantFile = path.join(config.bookDir, 'audition.grant.json'), out = path.join(config.bookDir, 'audition'), start = line.auditionStart(env);
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
  const ledger = freshBookLedger(config, env, admitted.planned.rereview, line.ledger);
  exclusiveJson(path.join(config.bookDir, `book-status${args.resume ? `-${Date.now()}` : ''}.json`), { status, manifestStatus: result.manifest.status,
    order: reading.order, ledger, viewer: out, runtimeEligible: false });
  finish(env, status, { manifestStatus: result.manifest.status, ledger }, line.outcomeName);
  return { status, manifestStatus: result.manifest.status, order: reading.order, ledger };
}

function argValue(name: string) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; }
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const config = freshBookConfig(argValue('--config') ?? fail('fresh_book_arguments')), env = realFreshBookEnv();
  const stage = ['storyboard-continuation-preview', 'storyboard-continuation-plan', 'storyboard-continuation', 'storyboard-repair-preview',
    'storyboard-repair-plan', 'storyboard-repair', 'recovery-plan', 'recover', 'plan', 'text', 'child', 'book'].find(s => process.argv.includes(s)) ?? 'plan';
  const execute = process.argv.includes('--execute');
  // A downstream stage runs under exactly one line: two line flags at once are refused (never a silent preference).
  if (['--recovery', '--storyboard-repair', '--storyboard-continuation'].filter(f => process.argv.includes(f)).length > 1) fail('fresh_book_arguments');
  const line = process.argv.includes('--storyboard-continuation') ? { storyboardContinuation: true as const }
    : process.argv.includes('--storyboard-repair') ? { storyboardRepair: true as const } : process.argv.includes('--recovery') ? { recovery: true as const } : {};
  const done = (p: Promise<unknown>) => p.then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
  // The diagnosed continuation line (dry): the planner request it would send with the engine's recovery state and diagnosis, rebuilt offline
  // and measured; and its plan and grant draft (--repair-grant: the consumed repair grant file). No key, provider, model, claim or write.
  if (stage === 'storyboard-continuation-preview') done(Promise.resolve().then(async () => {
    const { grantDraft, continuation, recoveryRecord, diagnosisRecord } = planFreshBookStoryboardContinuation(config, env, argValue('--repair-grant') ?? fail('fresh_book_arguments'));
    return { held: grantDraft.held, recovery: grantDraft.recovery, recoveryRecord, diagnosisRecord,
      preview: await previewFreshBookStoryboardContinuation(config, continuation) }; }));
  else if (stage === 'storyboard-continuation-plan' || (stage === 'storyboard-continuation' && !execute)) done(Promise.resolve().then(() => {
    const { plan, grantDraft, state } = planFreshBookStoryboardContinuation(config, env, argValue('--repair-grant') ?? fail('fresh_book_arguments'));
    return { plan, grantDraft, state }; }));
  // The storyboard-repair line (dry): the planner request it would send, rebuilt offline and measured (no key, provider, model, claim or write).
  else if (stage === 'storyboard-repair-preview') done(Promise.resolve().then(async () => {
    const { grantDraft, repair } = planFreshBookStoryboardRepair(config, env, argValue('--recovery-grant') ?? fail('fresh_book_arguments'));
    return { held: grantDraft.held, preview: await previewFreshBookStoryboardRepair(config, repair) }; }));
  // The storyboard-repair line (dry): the plan and grant draft for the held recovery (--recovery-grant: the consumed recovery grant file).
  else if (stage === 'storyboard-repair-plan' || (stage === 'storyboard-repair' && !execute)) done(Promise.resolve().then(() => {
    const { plan, grantDraft, state } = planFreshBookStoryboardRepair(config, env, argValue('--recovery-grant') ?? fail('fresh_book_arguments'));
    return { plan, grantDraft, state }; }));
  // The recovery line (dry): the plan and recovery grant draft for the saved failed book (--original-grant: the consumed original grant file).
  else if (stage === 'recovery-plan' || (stage === 'recover' && !execute)) done(Promise.resolve().then(() => {
    const { plan, grantDraft, state } = planFreshBookRecovery(config, env, argValue('--original-grant') ?? fail('fresh_book_arguments')); return { plan, grantDraft, state }; }));
  else if (stage === 'plan' || !execute) done(Promise.resolve().then(() => { const { plan, grantDraft, state } = planFreshBook(config, env); return { plan, grantDraft, state }; }));
  else {
    const controller = new AbortController(); process.once('SIGINT', () => controller.abort());
    const common = { config, env, grantFile: argValue('--grant') ?? fail('fresh_book_arguments'), grantSha: argValue('--grant-sha') ?? fail('fresh_book_arguments'),
      signal: controller.signal, log: (line: string) => console.log(line) };
    done(stage === 'storyboard-continuation' ? runFreshBookStoryboardContinuation(common)
      : stage === 'storyboard-repair' ? runFreshBookStoryboardRepair(common) : stage === 'recover' ? runFreshBookTextRecovery(common)
      : stage === 'text' ? runFreshBookText(common) : stage === 'child' ? runFreshBookChild({ ...common, ...line })
      : runFreshBookBook({ ...common, ...line, ...(process.argv.includes('--resume') ? { resume: true as const } : {}) }));
  }
}
export type { ChildAnchorInspectionContext };
