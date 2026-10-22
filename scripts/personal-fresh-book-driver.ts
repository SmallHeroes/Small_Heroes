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
 * The bound revalidation (same amendment and allowance, 2026-10-19), after the continuation's failed_storyboard_continuation record for its
 * compile refusal (storyboard_self_check_resolution_changed, before its review): the SAME paid planner answer, replayed, compiled under
 * storyboard-self-check-names/v1 and given the ONE unspent Sol review (no planner call):
 *   ... --config <abs json> storyboard-revalidation-plan --continuation-grant <abs consumed continuation grant.json>    (dry: plan + grant draft)
 *   ... --config <abs json> storyboard-revalidation-preview --continuation-grant <abs consumed continuation grant.json> (dry: the measured review request)
 *   ... --config <abs json> storyboard-revalidation --execute --grant <abs revalidation grant> --grant-sha <sha256>
 *   ... --config <abs json> <child|book> --storyboard-revalidation --execute --grant <abs revalidation grant> --grant-sha <sha256> [--resume]
 * The ONE owner-approved extension (refined Proposal B, Guy 2026-10-19), after the revalidation's held_storyboard_revalidation record at the
 * base ceiling: attempt 4 of 4 under the claim-basis contract (ONE Opus Max planner, ONE Sol review):
 *   ... --config <abs json> storyboard-extension-plan --revalidation-grant <abs consumed revalidation grant.json> --owner-approval <abs record>  (dry)
 *   ... --config <abs json> storyboard-extension-preview --revalidation-grant <abs ...> --owner-approval <abs record>  (dry: the measured request)
 *   ... --config <abs json> storyboard-extension --execute --grant <abs extension grant> --grant-sha <sha256>
 *   ... --config <abs json> <child|book> --storyboard-extension --execute --grant <abs extension grant> --grant-sha <sha256> [--resume]
 * The bound extension revalidation (same owner record, same allowance), after the extension's compile refusal (storyboard_claim_basis_staging_ref,
 * before its review): the SAME paid planner answer, replayed, compiled under storyboard-claim-basis-staging-fields/v1 and given the ONE unspent
 * Sol review (no planner call); still attempt 4 of 4:
 *   ... --config <abs json> storyboard-extension-revalidation-plan --extension-grant <abs consumed extension grant.json>    (dry: plan + grant draft)
 *   ... --config <abs json> storyboard-extension-revalidation-preview --extension-grant <abs ...>                           (dry: the measured review request)
 *   ... --config <abs json> storyboard-extension-revalidation --execute --grant <abs extension revalidation grant> --grant-sha <sha256>
 *   ... --config <abs json> <child|book> --storyboard-extension-revalidation --execute --grant <abs ...> --grant-sha <sha256> [--resume]
 * The ONE owner-approved calibration attempt (corrected B, Guy 2026-10-20), after the extension revalidation's held record at the owner's
 * ceiling 4: attempt 5 of 5 under the calibration contract (ONE Opus Max planner, ONE Sol review):
 *   ... --config <abs json> storyboard-calibration-plan --extension-revalidation-grant <abs consumed grant.json> --owner-approval <abs record>  (dry)
 *   ... --config <abs json> storyboard-calibration-preview --extension-revalidation-grant <abs ...> --owner-approval <abs record>  (dry: the request)
 *   ... --config <abs json> storyboard-calibration --execute --grant <abs calibration grant> --grant-sha <sha256>
 *   ... --config <abs json> <child|book> --storyboard-calibration --execute --grant <abs calibration grant> --grant-sha <sha256> [--resume]
 * The ONE owner-directed presence attempt (Guy's same-book continuation 2026-10-20), after the calibration's held record at the owner's
 * ceiling 5: historically attempt 6 under the presence contract (ONE Opus Max planner, ONE Sol review):
 *   ... --config <abs json> storyboard-presence-plan --calibration-grant <abs consumed calibration grant.json> --owner-approval <abs record>  (dry)
 *   ... --config <abs json> storyboard-presence-preview --calibration-grant <abs ...> --owner-approval <abs record>  (dry: the request)
 *   ... --config <abs json> storyboard-presence --execute --grant <abs presence grant> --grant-sha <sha256>
 *   ... --config <abs json> <child|book> --storyboard-presence --execute --grant <abs presence grant> --grant-sha <sha256> [--resume]
 * The ONE owner-approved child recovery (Guy 2026-10-21), after the presence line's held_child record (its storyboard admitted, its child anchor
 * held): ONE LOW correction edit of the held anchor under child-anchor-visible-pose/v1 and the typed child-anchor-visibility-recovery/v1, and
 * its TWO fresh Sol reviews; then the book on its gates:
 *   ... --config <abs json> child-recovery-plan --presence-grant <abs consumed presence grant.json> --owner-approval <abs record>  (dry)
 *   ... --config <abs json> child-recovery --execute --grant <abs child-recovery grant> --grant-sha <sha256>
 *   ... --config <abs json> book --child-recovery --execute --grant <abs child-recovery grant> --grant-sha <sha256> [--resume]
 * The ONE owner-approved fresh child anchor (Guy 2026-10-21), after the child recovery's held_child_recovery record: the general child stage
 * under child-anchor-visible-pose/v2 (a fresh render, its two reviews, at most its one correction and their two reviews); then the book:
 *   ... --config <abs json> child-fresh-anchor-plan --recovery-grant <abs consumed child-recovery grant.json> --owner-approval <abs record>  (dry)
 *   ... --config <abs json> child-fresh-anchor --execute --grant <abs fresh-anchor grant> --grant-sha <sha256>
 *   ... --config <abs json> book --child-fresh-anchor --execute --grant <abs fresh-anchor grant> --grant-sha <sha256> [--resume]
 * The ONE owner-approved continuation of the SAME audition (Guy 2026-10-21), after that book halted on ONE review with no receipt: ONE
 * conservative budget debit of that call (its actual charge stays unknown), then the same audition resumed (its interrupted attempts closed
 * and counted; the 600 s review deadline) through every remaining page and the cover:
 *   ... --config <abs json> audition-continuation-plan --fresh-grant <abs consumed fresh-anchor grant.json> --owner-approval <abs record>  (dry)
 *   ... --config <abs json> audition-continuation --execute --grant <abs continuation grant> --grant-sha <sha256>
 * The ONE owner-approved re-review of the SAME audition (Guy 2026-10-22, path A), after the continuation ended with its sample held and the last
 * drawn attempt's review lost: ONE more conservative debit, ONE re-review of that existing image (the identical request) on the client-scoped
 * review transport, then the cover and the remaining pages only if the page passes:
 *   ... --config <abs json> audition-rereview-plan --continuation-grant <abs consumed continuation grant.json> --owner-approval <abs record>  (dry)
 *   ... --config <abs json> audition-rereview --execute --grant <abs re-review grant> --grant-sha <sha256>
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
import { GPT_IMAGE_PROMPT_MAX_CHARS, type BookDesignReferenceRole } from '../lib/generate-image';
import { AUDITION_WORST_CASE_CALLS, AUDITION_CALIBRATION_VERSION, LANDMARK_DESIGN_HEAD_VERSION, illustrateReviewedAudition,
  AUDITION_TOPOLOGY_CONTINUATION_VERSION, LANDMARK_TOPOLOGY_VERSION, calibrationRequalificationParent, reviewedAuditionPolicy,
  auditionPageReviewSchemaForContext, ReviewedAuditionError, AUDITION_REREVIEW_VERSION, type SavedPage, type SavedRereview,
  type SavedCalibration, type AuditionCalibration, type AuditionTopologyContinuation } from '../lib/personal-wizard/simple-book-reviewed-audition';
import { evaluatePageChildResemblanceVision } from '../lib/generation-pipeline/page-child-resemblance-vision';
import { previewQualityContextSha } from '../lib/local-preview-quality';
import { CHILD_ANCHOR_INSPECTION_VERSION, CHILD_ANCHOR_MATERIALITY_VERSION, CHILD_ANCHOR_MATERIALITY_AMENDMENT, CHILD_ANCHOR_CORRECTION_ROLES, resolveChildAnchorTechnique, childAnchorDescriptionRequest, childAnchorCorrectionPrompt,
  assertChildAnchorRenderPlan, childAnchorAttemptRecipe, childAnchorRecipeSha, childAnchorStyleDisposition, childAnchorDisposition,
  childAnchorInspectionContext, childAnchorInspectionContextSha, childAnchorInspectedDesignDisposition, childAnchorInspectedAdoptionRecord,
  assertChildAnchorInspectedAccepted, CHILD_ANCHOR_POSE_VERSION, CHILD_ANCHOR_POSE_CLAUSE_SHA256, CHILD_ANCHOR_PRODUCTION_POSE_LINE,
  CHILD_ANCHOR_VISIBILITY_RECOVERY_VERSION, childAnchorPoseDescriptionRequest, childAnchorPoseCorrectionPrompt, childAnchorVisibilityRecovery,
  CHILD_ANCHOR_POSE_V2, type ChildAnchorPoseVersion, type ChildAnchorChild, type ChildAnchorInspectionContext, type ChildAnchorRecipe } from '../lib/personal-wizard/child-anchor-style';
import { AuditionMeter, auditionAdapters, auditionMeterRules, keyReader, loadReviewedStoryboard, loadReviewedBook, reviewedBookLayoutSchema, readReviewedBookLayout,
  runReviewedAudition, auditionGrantSchema, auditionJudgePayload, digestImages, verifyMeterRecords, renderMaximum, conservativeDebitOf, interruptedAttempts, rereviewAllowance, AUDITION_REVIEW_TIMEOUT_MS,
  AUDITION_TRANSPORT_MARGIN_MS, type AuditionGrant, type ReviewedBookLayout, type MeterRules, type ConservativeDebit } from './personal-simple-book-reviewed-audition';
import { readAuditionImage, SOL_PIXEL_REVIEW_SLOT_MICRO_USD } from './personal-simple-book-illustrator';
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
  assertFreshBookStoryboardContinuationPaid, type FreshBookStoryboardContinuationGrant, FRESH_BOOK_STORYBOARD_REVALIDATION,
  freshBookStoryboardRevalidationGrantSchema, claimFreshBookStoryboardRevalidation, assertFreshBookStoryboardRevalidationPaid,
  type FreshBookStoryboardRevalidationGrant, FRESH_BOOK_STORYBOARD_EXTENSION, freshBookStoryboardExtensionGrantSchema, claimFreshBookStoryboardExtension,
  assertFreshBookStoryboardExtensionPaid, type FreshBookStoryboardExtensionGrant, FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION,
  freshBookStoryboardExtensionRevalidationGrantSchema, claimFreshBookStoryboardExtensionRevalidation, assertFreshBookStoryboardExtensionRevalidationPaid,
  type FreshBookStoryboardExtensionRevalidationGrant, FRESH_BOOK_STORYBOARD_CALIBRATION, freshBookStoryboardCalibrationGrantSchema,
  claimFreshBookStoryboardCalibration, assertFreshBookStoryboardCalibrationPaid, type FreshBookStoryboardCalibrationGrant, FRESH_BOOK_STORYBOARD_PRESENCE,
  freshBookStoryboardPresenceGrantSchema, claimFreshBookStoryboardPresence, assertFreshBookStoryboardPresencePaid,
  type FreshBookStoryboardPresenceGrant, FRESH_BOOK_CHILD_RECOVERY, freshBookChildRecoveryGrantSchema, claimFreshBookChildRecovery,
  assertFreshBookChildRecoveryPaid, type FreshBookChildRecoveryGrant, FRESH_BOOK_CHILD_FRESH_ANCHOR, freshBookChildFreshAnchorGrantSchema,
  claimFreshBookChildFreshAnchor, assertFreshBookChildFreshAnchorPaid, type FreshBookChildFreshAnchorGrant, freshAnchorClaimFields,
  FRESH_BOOK_AUDITION_CONTINUATION, freshBookAuditionContinuationGrantSchema, claimFreshBookAuditionContinuation, assertFreshBookAuditionContinuationPaid,
  type FreshBookAuditionContinuationGrant, continuationClaimFields, FRESH_BOOK_AUDITION_REREVIEW, freshBookAuditionRereviewGrantSchema,
  claimFreshBookAuditionRereview, assertFreshBookAuditionRereviewPaid, rereviewClaimFields, type FreshBookAuditionRereviewGrant } from './personal-fresh-book-authority';
import { STORYBOARD_ATTEMPT_EXTENSION_VERSION, STORYBOARD_ATTEMPT_EXTENSION_V2 } from '../lib/personal-wizard/storyboard-repair';
import { STORYBOARD_CALIBRATION_VERSION, STORYBOARD_REVIEW_SEVERITY_VERSION, CALIBRATION_COMPONENTS, findingGroups } from '../lib/personal-wizard/storyboard-calibration';
import { STORYBOARD_PRESENCE_VERSION, PRESENCE_COMPONENTS } from '../lib/personal-wizard/storyboard-presence';
import { CLAIM_BASIS_CONTRACT_VERSION, CLAIM_BASIS_STAGING_FIELDS_VERSION, stagedPlanFields } from '../lib/personal-wizard/storyboard-claim-basis';
import { prepareSourceCitationCorrection, applySourceCitationCorrection, restoreSourceCitationReview } from '../lib/personal-wizard/story-source-citations';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, storyboardReviewDisposition, personalStoryboardReviewInput,
  storyboardRecovery } from '../lib/personal-wizard/storyboard';
import { storyboardRepairFindings, type StoryboardRepair } from '../lib/personal-wizard/storyboard-repair';
import { recoveryState, STAGE_RECOVERY_VERSION } from '../lib/personal-wizard/stage-recovery';
import { chainAttempts, diagnosisDigest, draftSections, changedSections, STORYBOARD_MAX_ATTEMPTS, STORYBOARD_DIAGNOSIS_VERSION } from '../lib/personal-wizard/storyboard-diagnosis';
import { STORYBOARD_SELF_CHECK_VERSION, STORYBOARD_SELF_CHECK_NAMES_VERSION, resolveSelfCheckSections } from '../lib/personal-wizard/storyboard-self-check';
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
/** The revalidation's API meter: the continuation's ONE unspent Sol review, under the same floored rule. */
export const STORYBOARD_REVALIDATION_RULES: MeterRules = STORYBOARD_REPAIR_RULES;
/**
 * Which ledger a line keeps: the original stages, the recovery's (after the failed text), the storyboard repair's (after the held recovery),
 * the diagnosed continuation's (after the held repair), the revalidation's (after the continuation's compile refusal), the owner-approved
 * extension's (after the held revalidation), or the extension revalidation's (after the extension's compile refusal).
 */
type LedgerLine = false | true | 'storyboard_repair' | 'storyboard_continuation' | 'storyboard_revalidation' | 'storyboard_extension'
  | 'storyboard_extension_revalidation' | 'storyboard_calibration' | 'storyboard_presence' | 'child_recovery' | 'child_fresh_anchor';
/** The child recovery's API meter: its one correction edit and that candidate's two reviews, under their child-anchor rules; nothing else. */
const CHILD_RECOVERY_RULES = pick(stageRules.childAnchor, [...FRESH_BOOK_CHILD_RECOVERY.steps]);
/**
 * The book's stages in ledger order (each folder re-derived under its own rules); each later line adds its own folder after the earlier ones.
 * The child recovery keeps the presence line's stages and its held child, then adds its own folder after that child; the fresh anchor keeps the
 * recovery's and adds its own folder after the recovery's.
 */
const bookStages = (bookDir: string, recovery: LedgerLine = false, debits?: readonly ConservativeDebit[]): FreshBookStage[] => [
  { name: 'text', dir: path.join(bookDir, 'text'), rules: TEXT_RULES, maxCalls: TEXT_API_CALLS },
  ...(recovery ? [{ name: FRESH_BOOK_RECOVERY.folder, dir: path.join(bookDir, FRESH_BOOK_RECOVERY.folder), rules: RECOVERY_RULES, maxCalls: FRESH_BOOK_RECOVERY.apiCalls }] : []),
  ...(recovery === 'storyboard_repair' || recovery === 'storyboard_continuation' || recovery === 'storyboard_revalidation' || recovery === 'storyboard_extension'
    || recovery === 'storyboard_extension_revalidation' || recovery === 'storyboard_calibration' || recovery === 'storyboard_presence' || recovery === 'child_recovery' || recovery === 'child_fresh_anchor'
    ? [{ name: FRESH_BOOK_STORYBOARD_REPAIR.folder, dir: path.join(bookDir, FRESH_BOOK_STORYBOARD_REPAIR.folder), rules: STORYBOARD_REPAIR_RULES,
      maxCalls: FRESH_BOOK_STORYBOARD_REPAIR.apiCalls }] : []),
  ...(recovery === 'storyboard_continuation' || recovery === 'storyboard_revalidation' || recovery === 'storyboard_extension'
    || recovery === 'storyboard_extension_revalidation' || recovery === 'storyboard_calibration' || recovery === 'storyboard_presence' || recovery === 'child_recovery' || recovery === 'child_fresh_anchor'
    ? [{ name: FRESH_BOOK_STORYBOARD_CONTINUATION.folder,
    dir: path.join(bookDir, FRESH_BOOK_STORYBOARD_CONTINUATION.folder), rules: STORYBOARD_CONTINUATION_RULES, maxCalls: FRESH_BOOK_STORYBOARD_CONTINUATION.apiCalls }] : []),
  ...(recovery === 'storyboard_revalidation' || recovery === 'storyboard_extension' || recovery === 'storyboard_extension_revalidation'
    || recovery === 'storyboard_calibration' || recovery === 'storyboard_presence' || recovery === 'child_recovery' || recovery === 'child_fresh_anchor' ? [{ name: FRESH_BOOK_STORYBOARD_REVALIDATION.folder,
    dir: path.join(bookDir, FRESH_BOOK_STORYBOARD_REVALIDATION.folder), rules: STORYBOARD_REVALIDATION_RULES, maxCalls: FRESH_BOOK_STORYBOARD_REVALIDATION.apiCalls }] : []),
  ...(recovery === 'storyboard_extension' || recovery === 'storyboard_extension_revalidation' || recovery === 'storyboard_calibration'
    || recovery === 'storyboard_presence' || recovery === 'child_recovery' || recovery === 'child_fresh_anchor' ? [{ name: FRESH_BOOK_STORYBOARD_EXTENSION.folder,
    dir: path.join(bookDir, FRESH_BOOK_STORYBOARD_EXTENSION.folder), rules: STORYBOARD_REPAIR_RULES, maxCalls: FRESH_BOOK_STORYBOARD_EXTENSION.apiCalls }] : []),
  ...(recovery === 'storyboard_extension_revalidation' || recovery === 'storyboard_calibration' || recovery === 'storyboard_presence' || recovery === 'child_recovery' || recovery === 'child_fresh_anchor'
    ? [{ name: FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.folder,
    dir: path.join(bookDir, FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.folder), rules: STORYBOARD_REPAIR_RULES,
    maxCalls: FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.apiCalls }] : []),
  ...(recovery === 'storyboard_calibration' || recovery === 'storyboard_presence' || recovery === 'child_recovery' || recovery === 'child_fresh_anchor' ? [{ name: FRESH_BOOK_STORYBOARD_CALIBRATION.folder,
    dir: path.join(bookDir, FRESH_BOOK_STORYBOARD_CALIBRATION.folder), rules: STORYBOARD_REPAIR_RULES, maxCalls: FRESH_BOOK_STORYBOARD_CALIBRATION.apiCalls }] : []),
  ...(recovery === 'storyboard_presence' || recovery === 'child_recovery' || recovery === 'child_fresh_anchor' ? [{ name: FRESH_BOOK_STORYBOARD_PRESENCE.folder,
    dir: path.join(bookDir, FRESH_BOOK_STORYBOARD_PRESENCE.folder), rules: STORYBOARD_REPAIR_RULES, maxCalls: FRESH_BOOK_STORYBOARD_PRESENCE.apiCalls }] : []),
  { name: 'child', dir: path.join(bookDir, 'child'), rules: CHILD_RULES, maxCalls: CHILD_API_CALLS },
  ...(recovery === 'child_recovery' || recovery === 'child_fresh_anchor' ? [{ name: FRESH_BOOK_CHILD_RECOVERY.folder, dir: path.join(bookDir, FRESH_BOOK_CHILD_RECOVERY.folder),
    rules: CHILD_RECOVERY_RULES, maxCalls: FRESH_BOOK_CHILD_RECOVERY.apiCalls }] : []),
  ...(recovery === 'child_fresh_anchor' ? [{ name: FRESH_BOOK_CHILD_FRESH_ANCHOR.folder, dir: path.join(bookDir, FRESH_BOOK_CHILD_FRESH_ANCHOR.folder),
    rules: CHILD_RULES, maxCalls: FRESH_BOOK_CHILD_FRESH_ANCHOR.apiCalls }] : []),
  // The audition continuation alone passes its owner-approved conservative debit of one audition record (absent on every other line).
  { name: 'audition', dir: path.join(bookDir, 'audition'), rules: auditionMeterRules, maxCalls: AUDITION_WORST_CASE_CALLS, ...(debits?.length ? { debits } : {}) }];

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
/** Revalidation-line grants pin exactly the continuation line's files (the correction lives in files it already pins). */
export const FRESH_BOOK_STORYBOARD_REVALIDATION_PINNED = FRESH_BOOK_STORYBOARD_CONTINUATION_PINNED;
/** Extension-line grants also pin the claim-basis contract, the drawn-instant contract it refines and the provider call context (book-runner). */
export const FRESH_BOOK_STORYBOARD_EXTENSION_PINNED = Object.freeze([...FRESH_BOOK_STORYBOARD_CONTINUATION_PINNED, 'lib/personal-wizard/storyboard-claim-basis.ts',
  'lib/personal-wizard/storyboard-drawn-instant.ts', 'lib/personal-wizard/book-runner.ts']);
/** Extension-revalidation-line grants pin exactly the extension line's files (the correction lives in files it already pins). */
export const FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION_PINNED = FRESH_BOOK_STORYBOARD_EXTENSION_PINNED;
/** Calibration-line grants also pin the calibration contract (its transport compaction lives in files the base list already pins). */
export const FRESH_BOOK_STORYBOARD_CALIBRATION_PINNED = Object.freeze([...FRESH_BOOK_STORYBOARD_EXTENSION_PINNED, 'lib/personal-wizard/storyboard-calibration.ts']);
/** Presence-line grants also pin the presence contract (its moments, drawn-instant, claim and review hooks live in files already pinned). */
export const FRESH_BOOK_STORYBOARD_PRESENCE_PINNED = Object.freeze([...FRESH_BOOK_STORYBOARD_CALIBRATION_PINNED, 'lib/personal-wizard/storyboard-presence.ts']);
/** Child-recovery-line grants pin exactly the presence line's files (the pose contract and the recovery live in files it already pins). */
export const FRESH_BOOK_CHILD_RECOVERY_PINNED = FRESH_BOOK_STORYBOARD_PRESENCE_PINNED;
/** Fresh-anchor-line grants pin exactly the same files (pose v2 lives in files they already pin). */
export const FRESH_BOOK_CHILD_FRESH_ANCHOR_PINNED = FRESH_BOOK_STORYBOARD_PRESENCE_PINNED;

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
/** The book's layout: its storyboard folder, its child folder and image, and (the child recovery only) the pose contract its adopted child binds. */
const layoutFor = (profile: FreshBookProfile, childImage = 'reference_child.png', storyboardDir = 'text', childDir = 'child',
  pose?: ChildAnchorPoseVersion): ReviewedBookLayout => reviewedBookLayoutSchema.parse({
  version: 'reviewed-book-layout/v1', seed: profile.seed, childDesign: profile.child.design, storyboardDir, childDir, childImage,
  savedCompanion: null, childAnchor: profile.childAnchor, ...(pose ? { childAnchorPose: pose } : {}) });
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
    FRESH_BOOK_STORYBOARD_CONTINUATION.auditionStartName, FRESH_BOOK_STORYBOARD_CONTINUATION.successorName, FRESH_BOOK_STORYBOARD_REVALIDATION.claimName,
    FRESH_BOOK_STORYBOARD_REVALIDATION.outcomeName, FRESH_BOOK_STORYBOARD_REVALIDATION.auditionStartName, FRESH_BOOK_STORYBOARD_REVALIDATION.successorName,
    FRESH_BOOK_STORYBOARD_EXTENSION.claimName, FRESH_BOOK_STORYBOARD_EXTENSION.outcomeName, FRESH_BOOK_STORYBOARD_EXTENSION.auditionStartName,
    FRESH_BOOK_STORYBOARD_EXTENSION.successorName, FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.claimName,
    FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.outcomeName, FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.auditionStartName,
    FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.successorName, FRESH_BOOK_STORYBOARD_CALIBRATION.claimName, FRESH_BOOK_STORYBOARD_CALIBRATION.outcomeName,
    FRESH_BOOK_STORYBOARD_CALIBRATION.auditionStartName, FRESH_BOOK_STORYBOARD_CALIBRATION.successorName, FRESH_BOOK_STORYBOARD_PRESENCE.claimName,
    FRESH_BOOK_STORYBOARD_PRESENCE.outcomeName, FRESH_BOOK_STORYBOARD_PRESENCE.auditionStartName, FRESH_BOOK_STORYBOARD_PRESENCE.successorName,
    FRESH_BOOK_CHILD_RECOVERY.claimName, FRESH_BOOK_CHILD_RECOVERY.outcomeName, FRESH_BOOK_CHILD_RECOVERY.auditionStartName,
    FRESH_BOOK_CHILD_RECOVERY.successorName, FRESH_BOOK_CHILD_FRESH_ANCHOR.claimName, FRESH_BOOK_CHILD_FRESH_ANCHOR.outcomeName,
    FRESH_BOOK_CHILD_FRESH_ANCHOR.auditionStartName, FRESH_BOOK_CHILD_FRESH_ANCHOR.successorName, FRESH_BOOK_AUDITION_CONTINUATION.claimName,
    FRESH_BOOK_AUDITION_CONTINUATION.outcomeName, FRESH_BOOK_AUDITION_REREVIEW.claimName, FRESH_BOOK_AUDITION_REREVIEW.outcomeName]) {
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
 * storyboard-repair line (its repaired storyboard of the recovery's held one, its own claim and outcome); the diagnosed continuation line
 * (its storyboard continuing the repair's held one, its own claim and outcome); or the revalidation line (the continuation's paid answer,
 * compiled under the correction and reviewed; its own claim and outcome).
 */
type Line = { kind: 'original' | 'recovery' | 'storyboard_repair' | 'storyboard_continuation' | 'storyboard_revalidation' | 'storyboard_extension'
    | 'storyboard_extension_revalidation' | 'storyboard_calibration' | 'storyboard_presence' | 'child_recovery' | 'child_fresh_anchor'; recovery: boolean;
  ledger: LedgerLine; storyboardDir: string; claimName: string; outcomeName: string; auditionStart: (env: FreshBookEnv) => string };
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
const STORYBOARD_REVALIDATION_LINE: Line = { kind: 'storyboard_revalidation', recovery: true, ledger: 'storyboard_revalidation',
  storyboardDir: FRESH_BOOK_STORYBOARD_REVALIDATION.folder, claimName: FRESH_BOOK_STORYBOARD_REVALIDATION.claimName,
  outcomeName: FRESH_BOOK_STORYBOARD_REVALIDATION.outcomeName, auditionStart: env => path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_REVALIDATION.auditionStartName) };
const STORYBOARD_EXTENSION_LINE: Line = { kind: 'storyboard_extension', recovery: true, ledger: 'storyboard_extension',
  storyboardDir: FRESH_BOOK_STORYBOARD_EXTENSION.folder, claimName: FRESH_BOOK_STORYBOARD_EXTENSION.claimName,
  outcomeName: FRESH_BOOK_STORYBOARD_EXTENSION.outcomeName, auditionStart: env => path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_EXTENSION.auditionStartName) };
const STORYBOARD_EXTENSION_REVALIDATION_LINE: Line = { kind: 'storyboard_extension_revalidation', recovery: true, ledger: 'storyboard_extension_revalidation',
  storyboardDir: FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.folder, claimName: FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.claimName,
  outcomeName: FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.outcomeName,
  auditionStart: env => path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.auditionStartName) };
const STORYBOARD_CALIBRATION_LINE: Line = { kind: 'storyboard_calibration', recovery: true, ledger: 'storyboard_calibration',
  storyboardDir: FRESH_BOOK_STORYBOARD_CALIBRATION.folder, claimName: FRESH_BOOK_STORYBOARD_CALIBRATION.claimName,
  outcomeName: FRESH_BOOK_STORYBOARD_CALIBRATION.outcomeName, auditionStart: env => path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_CALIBRATION.auditionStartName) };
const STORYBOARD_PRESENCE_LINE: Line = { kind: 'storyboard_presence', recovery: true, ledger: 'storyboard_presence',
  storyboardDir: FRESH_BOOK_STORYBOARD_PRESENCE.folder, claimName: FRESH_BOOK_STORYBOARD_PRESENCE.claimName,
  outcomeName: FRESH_BOOK_STORYBOARD_PRESENCE.outcomeName, auditionStart: env => path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_PRESENCE.auditionStartName) };
/** The child recovery: the presence line's admitted storyboard, its own recovered child (its own folder), claim, outcome and audition start. */
const CHILD_RECOVERY_LINE: Line = { kind: 'child_recovery', recovery: true, ledger: 'child_recovery', storyboardDir: FRESH_BOOK_STORYBOARD_PRESENCE.folder,
  claimName: FRESH_BOOK_CHILD_RECOVERY.claimName, outcomeName: FRESH_BOOK_CHILD_RECOVERY.outcomeName,
  auditionStart: env => path.join(env.authorityRoot, FRESH_BOOK_CHILD_RECOVERY.auditionStartName) };
/** The fresh anchor: the presence line's admitted storyboard, its own fresh child (its own folder), claim, outcome and audition start. */
const CHILD_FRESH_ANCHOR_LINE: Line = { kind: 'child_fresh_anchor', recovery: true, ledger: 'child_fresh_anchor', storyboardDir: FRESH_BOOK_STORYBOARD_PRESENCE.folder,
  claimName: FRESH_BOOK_CHILD_FRESH_ANCHOR.claimName, outcomeName: FRESH_BOOK_CHILD_FRESH_ANCHOR.outcomeName,
  auditionStart: env => path.join(env.authorityRoot, FRESH_BOOK_CHILD_FRESH_ANCHOR.auditionStartName) };
/** Where a line's adopted child lives, and the layout its book reads: a child line's own folder and pose contract, else `child`. */
const childDirOf = (line: Line) => line.kind === 'child_recovery' ? FRESH_BOOK_CHILD_RECOVERY.folder
  : line.kind === 'child_fresh_anchor' ? FRESH_BOOK_CHILD_FRESH_ANCHOR.folder : 'child';
const lineLayout = (profile: FreshBookProfile, childImage: string | undefined, line: Line) => line.kind === 'child_recovery'
  ? layoutFor(profile, childImage, line.storyboardDir, FRESH_BOOK_CHILD_RECOVERY.folder, CHILD_ANCHOR_POSE_VERSION)
  : line.kind === 'child_fresh_anchor' ? layoutFor(profile, childImage, line.storyboardDir, FRESH_BOOK_CHILD_FRESH_ANCHOR.folder, CHILD_ANCHOR_POSE_V2)
  : layoutFor(profile, childImage, line.storyboardDir);
const lineOf = (recovery?: true, storyboardRepair?: true, storyboardContinuation?: true, storyboardRevalidation?: true, storyboardExtension?: true,
  storyboardExtensionRevalidation?: true, storyboardCalibration?: true, storyboardPresence?: true, childRecovery?: true, childFreshAnchor?: true) =>
  childFreshAnchor ? CHILD_FRESH_ANCHOR_LINE : childRecovery ? CHILD_RECOVERY_LINE : storyboardPresence ? STORYBOARD_PRESENCE_LINE : storyboardCalibration ? STORYBOARD_CALIBRATION_LINE
  : storyboardExtensionRevalidation ? STORYBOARD_EXTENSION_REVALIDATION_LINE : storyboardExtension ? STORYBOARD_EXTENSION_LINE
  : storyboardRevalidation ? STORYBOARD_REVALIDATION_LINE : storyboardContinuation ? STORYBOARD_CONTINUATION_LINE
  : storyboardRepair ? STORYBOARD_REPAIR_LINE : recovery ? RECOVERY_LINE : ORIGINAL_LINE;
const admitLine = (args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal }, line: Line, earlier: string[]) =>
  line.kind === 'child_fresh_anchor' ? admitChildFreshAnchor({ ...args, earlier: [...earlier, FRESH_BOOK_RECOVERY.folder, FRESH_BOOK_STORYBOARD_REPAIR.folder,
    FRESH_BOOK_STORYBOARD_CONTINUATION.folder, FRESH_BOOK_STORYBOARD_REVALIDATION.folder, FRESH_BOOK_STORYBOARD_EXTENSION.folder,
    FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.folder, FRESH_BOOK_STORYBOARD_CALIBRATION.folder, FRESH_BOOK_STORYBOARD_PRESENCE.folder,
    FRESH_BOOK_CHILD_RECOVERY.folder, FRESH_BOOK_CHILD_FRESH_ANCHOR.folder] })
  : line.kind === 'child_recovery' ? admitChildRecovery({ ...args, earlier: [...earlier, FRESH_BOOK_RECOVERY.folder, FRESH_BOOK_STORYBOARD_REPAIR.folder,
    FRESH_BOOK_STORYBOARD_CONTINUATION.folder, FRESH_BOOK_STORYBOARD_REVALIDATION.folder, FRESH_BOOK_STORYBOARD_EXTENSION.folder,
    FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.folder, FRESH_BOOK_STORYBOARD_CALIBRATION.folder, FRESH_BOOK_STORYBOARD_PRESENCE.folder, FRESH_BOOK_CHILD_RECOVERY.folder] })
  : line.kind === 'storyboard_presence' ? admitStoryboardPresence({ ...args, earlier: [...earlier, FRESH_BOOK_RECOVERY.folder,
    FRESH_BOOK_STORYBOARD_REPAIR.folder, FRESH_BOOK_STORYBOARD_CONTINUATION.folder, FRESH_BOOK_STORYBOARD_REVALIDATION.folder, FRESH_BOOK_STORYBOARD_EXTENSION.folder,
    FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.folder, FRESH_BOOK_STORYBOARD_CALIBRATION.folder, FRESH_BOOK_STORYBOARD_PRESENCE.folder] })
  : line.kind === 'storyboard_calibration' ? admitStoryboardCalibration({ ...args, earlier: [...earlier, FRESH_BOOK_RECOVERY.folder,
    FRESH_BOOK_STORYBOARD_REPAIR.folder, FRESH_BOOK_STORYBOARD_CONTINUATION.folder, FRESH_BOOK_STORYBOARD_REVALIDATION.folder, FRESH_BOOK_STORYBOARD_EXTENSION.folder,
    FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.folder, FRESH_BOOK_STORYBOARD_CALIBRATION.folder] })
  : line.kind === 'storyboard_extension_revalidation' ? admitStoryboardExtensionRevalidation({ ...args, earlier: [...earlier, FRESH_BOOK_RECOVERY.folder,
    FRESH_BOOK_STORYBOARD_REPAIR.folder, FRESH_BOOK_STORYBOARD_CONTINUATION.folder, FRESH_BOOK_STORYBOARD_REVALIDATION.folder, FRESH_BOOK_STORYBOARD_EXTENSION.folder,
    FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.folder] })
  : line.kind === 'storyboard_extension' ? admitStoryboardExtension({ ...args, earlier: [...earlier, FRESH_BOOK_RECOVERY.folder, FRESH_BOOK_STORYBOARD_REPAIR.folder,
    FRESH_BOOK_STORYBOARD_CONTINUATION.folder, FRESH_BOOK_STORYBOARD_REVALIDATION.folder, FRESH_BOOK_STORYBOARD_EXTENSION.folder] })
  : line.kind === 'storyboard_revalidation' ? admitStoryboardRevalidation({ ...args, earlier: [...earlier, FRESH_BOOK_RECOVERY.folder,
    FRESH_BOOK_STORYBOARD_REPAIR.folder, FRESH_BOOK_STORYBOARD_CONTINUATION.folder, FRESH_BOOK_STORYBOARD_REVALIDATION.folder] })
  : line.kind === 'storyboard_continuation' ? admitStoryboardContinuation({ ...args, earlier: [...earlier, FRESH_BOOK_RECOVERY.folder, FRESH_BOOK_STORYBOARD_REPAIR.folder,
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
  if (line.kind === 'child_fresh_anchor') {
    // The presence line's held_child and admitted storyboard, the child recovery's terminal held_child_recovery (no successor, no audition),
    // this line's own claim and successor and no outcome yet; the fresh child's successor re-derived now (the admission re-derived the rest).
    const at = (name: string) => existsSync(path.join(env.authorityRoot, name)), P = FRESH_BOOK_STORYBOARD_PRESENCE, CR = FRESH_BOOK_CHILD_RECOVERY,
      CF = FRESH_BOOK_CHILD_FRESH_ANCHOR;
    if (sealedStatus(text) !== 'failed' || !at(P.claimName) || !at(P.outcomeName) || !at(P.successorName) || at(P.auditionStartName) ||
        !at(CR.claimName) || !at(CR.outcomeName) || at(CR.successorName) || at(CR.auditionStartName) ||
        !at(CF.claimName) || !at(CF.successorName) || at(CF.outcomeName)) return false;
    if (!('childFreshAnchor' in admitted)) return fail('fresh_book_child_fresh_anchor_grant');
    await verifyChildFreshAnchorSuccessor({ config, env, grantSha: a.grantSha, admitted });
    return true;
  }
  if (line.kind === 'child_recovery') {
    // The presence line's terminal held_child, its admitted storyboard's successor, and this line's own claim, successor and no outcome yet;
    // the recovered child's successor re-derived now (the admission already re-derived the presence chain and the held child exactly).
    const at = (name: string) => existsSync(path.join(env.authorityRoot, name)), P = FRESH_BOOK_STORYBOARD_PRESENCE, CR = FRESH_BOOK_CHILD_RECOVERY;
    if (sealedStatus(text) !== 'failed' || !at(P.claimName) || !at(P.outcomeName) || !at(P.successorName) || at(P.auditionStartName) ||
        !at(CR.claimName) || !at(CR.successorName) || at(CR.outcomeName)) return false;
    if (!('childRecovery' in admitted)) return fail('fresh_book_child_recovery_grant');
    await verifyChildRecoverySuccessor({ config, env, grantSha: a.grantSha, admitted });
    return true;
  }
  if (line.kind === 'storyboard_presence') {
    const at = (name: string) => existsSync(path.join(env.authorityRoot, name)), X = FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION, C = FRESH_BOOK_STORYBOARD_CALIBRATION,
      P = FRESH_BOOK_STORYBOARD_PRESENCE;
    if (sealedStatus(text) !== 'failed' || !at(FRESH_BOOK_RECOVERY.outcomeName) || at(FRESH_BOOK_RECOVERY.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_REPAIR.outcomeName) || at(FRESH_BOOK_STORYBOARD_REPAIR.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_CONTINUATION.outcomeName) || at(FRESH_BOOK_STORYBOARD_CONTINUATION.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_REVALIDATION.outcomeName) || at(FRESH_BOOK_STORYBOARD_REVALIDATION.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_EXTENSION.outcomeName) || at(FRESH_BOOK_STORYBOARD_EXTENSION.successorName) ||
        !at(X.outcomeName) || at(X.successorName) || !at(C.outcomeName) || at(C.successorName) || !at(P.claimName) || at(P.outcomeName)) return false;
    if (!('presence' in admitted)) return fail('fresh_book_storyboard_presence_grant');
    await verifyStoryboardPresenceSuccessor({ config, env, grantSha: a.grantSha, admitted });
    return true;
  }
  if (line.kind === 'storyboard_calibration') {
    const at = (name: string) => existsSync(path.join(env.authorityRoot, name)), X = FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION, C = FRESH_BOOK_STORYBOARD_CALIBRATION;
    if (sealedStatus(text) !== 'failed' || !at(FRESH_BOOK_RECOVERY.outcomeName) || at(FRESH_BOOK_RECOVERY.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_REPAIR.outcomeName) || at(FRESH_BOOK_STORYBOARD_REPAIR.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_CONTINUATION.outcomeName) || at(FRESH_BOOK_STORYBOARD_CONTINUATION.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_REVALIDATION.outcomeName) || at(FRESH_BOOK_STORYBOARD_REVALIDATION.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_EXTENSION.outcomeName) || at(FRESH_BOOK_STORYBOARD_EXTENSION.successorName) ||
        !at(X.outcomeName) || at(X.successorName) || !at(C.claimName) || at(C.outcomeName)) return false;
    if (!('calibration' in admitted)) return fail('fresh_book_storyboard_calibration_grant');
    await verifyStoryboardCalibrationSuccessor({ config, env, grantSha: a.grantSha, admitted });
    return true;
  }
  if (line.kind === 'storyboard_extension_revalidation') {
    const at = (name: string) => existsSync(path.join(env.authorityRoot, name)), X = FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION;
    if (sealedStatus(text) !== 'failed' || !at(FRESH_BOOK_RECOVERY.outcomeName) || at(FRESH_BOOK_RECOVERY.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_REPAIR.outcomeName) || at(FRESH_BOOK_STORYBOARD_REPAIR.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_CONTINUATION.outcomeName) || at(FRESH_BOOK_STORYBOARD_CONTINUATION.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_REVALIDATION.outcomeName) || at(FRESH_BOOK_STORYBOARD_REVALIDATION.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_EXTENSION.outcomeName) || at(FRESH_BOOK_STORYBOARD_EXTENSION.successorName) ||
        !at(X.claimName) || at(X.outcomeName)) return false;
    if (!('extensionRevalidation' in admitted)) return fail('fresh_book_storyboard_extension_revalidation_grant');
    await verifyStoryboardExtensionRevalidationSuccessor({ config, env, grantSha: a.grantSha, admitted });
    return true;
  }
  if (line.kind === 'storyboard_extension') {
    const at = (name: string) => existsSync(path.join(env.authorityRoot, name));
    if (sealedStatus(text) !== 'failed' || !at(FRESH_BOOK_RECOVERY.outcomeName) || at(FRESH_BOOK_RECOVERY.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_REPAIR.outcomeName) || at(FRESH_BOOK_STORYBOARD_REPAIR.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_CONTINUATION.outcomeName) || at(FRESH_BOOK_STORYBOARD_CONTINUATION.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_REVALIDATION.outcomeName) || at(FRESH_BOOK_STORYBOARD_REVALIDATION.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_EXTENSION.claimName) || at(FRESH_BOOK_STORYBOARD_EXTENSION.outcomeName)) return false;
    if (!('extension' in admitted)) return fail('fresh_book_storyboard_extension_grant');
    await verifyStoryboardExtensionSuccessor({ config, env, grantSha: a.grantSha, admitted });
    return true;
  }
  if (line.kind === 'storyboard_revalidation') {
    const at = (name: string) => existsSync(path.join(env.authorityRoot, name));
    if (sealedStatus(text) !== 'failed' || !at(FRESH_BOOK_RECOVERY.outcomeName) || at(FRESH_BOOK_RECOVERY.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_REPAIR.outcomeName) || at(FRESH_BOOK_STORYBOARD_REPAIR.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_CONTINUATION.outcomeName) || at(FRESH_BOOK_STORYBOARD_CONTINUATION.successorName) ||
        !at(FRESH_BOOK_STORYBOARD_REVALIDATION.claimName) || at(FRESH_BOOK_STORYBOARD_REVALIDATION.outcomeName)) return false;
    if (!('revalidation' in admitted)) return fail('fresh_book_storyboard_revalidation_grant');
    await verifyStoryboardRevalidationSuccessor({ config, env, grantSha: a.grantSha, admitted });
    return true;
  }
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
  if (!('grant' in admitted) || 'repair' in admitted || 'continuation' in admitted || 'revalidation' in admitted || 'extension' in admitted ||
      'extensionRevalidation' in admitted || 'calibration' in admitted || 'presence' in admitted || 'childRecovery' in admitted ||
      'childFreshAnchor' in admitted) return fail('fresh_book_recovery_grant');
  verifyRecoverySuccessor({ config, env, grant: admitted.grant as FreshBookRecoveryGrant, grantSha: a.grantSha, requestId: admitted.planned.prepared.accepted.requestId,
    rereviewOutcome: admitted.outcome });
  return true;
}
/**
 * The cumulative ledger: the diagnostic subcap's settled spend and every book stage, each from its own records. Unknown halts. `debits`: the
 * audition continuation's owner-approved conservative debit of one audition record (absent: the ledger exactly as before).
 */
export function freshBookLedger(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, recovery: LedgerLine = false,
  debits?: readonly ConservativeDebit[]) {
  return freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env), stages: bookStages(config.bookDir, recovery, debits) });
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
 * A line without a planner budget (one that replays an earlier line's paid planner answer) can make no planner call here.
 */
function storyboardVisual(a: { textDir: string; policy: WirePolicy; claudeMax?: SimpleBookBudget; api: AuditionMeter; responses: Responses; planner?: PlannerTransport;
  reviewRule: NonNullable<ReturnType<MeterRules>>; guard: () => void; record: (error: unknown) => never; draft: (value: unknown) => void }) {
  return async (call: SimpleStoryboardDiagnosticCall, s: AbortSignal) => {
    a.guard();
    if (call.stage === 'storyboard') {
      const budget = a.claudeMax;
      if (!budget) return a.record(new FreshBookError('fresh_book_visual_stage'));
      // The planner is Opus 5.5 on the Claude Max route for every storyboard call of this book (fixed; never the Astra route).
      const instructionFile = path.join(a.textDir, 'storyboard-instructions.txt');
      exclusiveText(instructionFile, plannerRequest(call).instructions);
      const wire = prepareOpusStoryboardWire(call, a.policy, instructionFile);
      const cwd = path.join(a.textDir, 'planner-workspace'); mkdirSync(cwd);
      const plan = a.planner ?? createOpusStoryboardTransport({ ...a.policy, workspace: cwd });
      return budget.run('storyboard', wire, OPUS_PLANNER.sessionGuardMicroUsd, async () => {
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
type ReplanSpec = { folder: string; contracts: { selfCheckContract?: true; reviewImpactPolicy?: true; claimBasisContract?: true; calibrationContract?: true;
  presenceContract?: true };
  rules: MeterRules;
  /** A line that makes NO planner call of its own: it replays this earlier line's PAID planner call (the revalidation). */
  plannerFrom?: string;
  /** Opt-in compile options (storyboard-self-check-names/v1; storyboard-claim-basis-staging-fields/v1), bound in the compiled book's markers. */
  compile?: { selfCheckNames: true; stagingFields?: true };
  /** Opt-in planner schema compaction for this line's own planner wire (the calibration); absent, the exact existing wire. */
  plannerSchema?: 'definition-names/v1' };
const REPAIR_SPEC: ReplanSpec = Object.freeze({ folder: FRESH_BOOK_STORYBOARD_REPAIR.folder, contracts: {}, rules: STORYBOARD_REPAIR_RULES });
const CONTINUATION_SPEC: ReplanSpec = Object.freeze({ folder: FRESH_BOOK_STORYBOARD_CONTINUATION.folder,
  contracts: { selfCheckContract: true as const, reviewImpactPolicy: true as const }, rules: STORYBOARD_CONTINUATION_RULES });
const REVALIDATION_SPEC: ReplanSpec = Object.freeze({ folder: FRESH_BOOK_STORYBOARD_REVALIDATION.folder,
  contracts: { selfCheckContract: true as const, reviewImpactPolicy: true as const }, rules: STORYBOARD_REVALIDATION_RULES,
  plannerFrom: FRESH_BOOK_STORYBOARD_CONTINUATION.folder, compile: { selfCheckNames: true as const } });
/** A line's own calls (a re-derivation consumes them too): its planner session and its review, or only its review when it borrows a planner. */
const ownCalls = (spec: ReplanSpec) => Object.freeze(spec.plannerFrom ? [`${spec.folder}/paid-stages/storyboard_review`]
  : [`${spec.folder}/claude-max-stages/storyboard`, `${spec.folder}/paid-stages/storyboard_review`]);
/** The earlier line's paid planner call a borrowing line consumes on every run and re-derivation. */
const borrowedCalls = (spec: ReplanSpec) => spec.plannerFrom ? [`${spec.plannerFrom}/claude-max-stages/storyboard`] : [];
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

/** A paid run's live parts; a borrowing line (no planner call of its own) carries no planner budget, every other line carries one. */
type RepairLive = { dir: string; api: AuditionMeter; claudeMax?: SimpleBookBudget; responses: Responses; planner?: PlannerTransport; guard: () => void;
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
  live?: RepairLive; replayDir?: string; preview?: (wire: PlannerWire, call: SimpleStoryboardDiagnosticCall) => never; spec?: ReplanSpec;
  /** A borrowing line's preview: the review request it would send (the paid planner answer replayed and compiled), measured, never sent. */
  reviewPreview?: (payload: ReturnType<typeof simpleWizardVisualPayload>, call: SimpleStoryboardDiagnosticCall) => never }) {
  if ([a.live, a.replayDir, a.preview, a.reviewPreview].filter(m => m !== undefined).length !== 1) fail('fresh_book_storyboard_repair_replay');
  const { config, seen } = a, { prepared, options, profile } = loadProfile(config), spec = a.spec ?? REPAIR_SPEC;
  if (a.preview && spec.plannerFrom || a.reviewPreview && !spec.plannerFrom || a.live && !a.live.claudeMax !== !!spec.plannerFrom) fail('fresh_book_storyboard_repair_replay');
  const textDir = path.join(config.bookDir, 'text'), recoveryDir = path.join(config.bookDir, FRESH_BOOK_RECOVERY.folder);
  const repairDir = a.live?.dir ?? a.replayDir ?? path.join(config.bookDir, spec.folder);
  const original: WirePolicy = { executable: config.executable, executableSha256: config.executableSha256, workspace: path.join(textDir, 'cli-workspace'),
    maxWireBytes: 104000, rates: { opus: RATES.opus, astra: RATES.sol }, openAIReviewModel: SOL };
  const recoveryPolicy: WirePolicy = { ...original, workspace: path.join(recoveryDir, 'cli-workspace') };
  // This line's own planner wire carries its schema compaction (opt-in); a borrowed planner call keeps the wire it was claimed with.
  const compaction = spec.plannerSchema ? { plannerSchema: spec.plannerSchema } : {};
  const repairPolicy: WirePolicy = { ...original, workspace: path.join(repairDir, 'cli-workspace'), ...compaction };
  // The planner call's own folder: this line's, or (a borrowing line) the earlier line's whose PAID call is replayed under ITS own wire.
  const plannerDir = spec.plannerFrom ? path.join(config.bookDir, spec.plannerFrom) : repairDir;
  const plannerPolicy: WirePolicy = { ...original, workspace: path.join(plannerDir, 'cli-workspace'), ...(spec.plannerFrom ? {} : compaction) };
  // The first refusal raised inside an engine callback (a replay or decode mismatch, a guard): the engine's callback wrappers rename it, so the
  // flow rethrows it as itself below (a preview and an operator see the engine's own code). The success path is unchanged.
  let refusal: unknown;
  const refuse = (): never => { const error = new FreshBookError('fresh_book_storyboard_repair_replay'); refusal ??= error; throw error; };
  // On the paid run a refusal keeps its own code (recorded before any engine wrapper); a re-derivation simply refuses.
  const fault = (error: unknown): never => { refusal ??= error; if (a.live) a.live.record(error); throw error; };
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
  /**
   * The saved planner call (this line's, or the borrowed earlier line's): its instruction file and rebuilt wire are exactly the saved ones. A
   * borrowed PAID answer is also re-decoded from that session's own CLI output by the engine's decoder for THIS call (never a summary of it).
   */
  const replayPlanner = (call: SimpleStoryboardDiagnosticCall) => {
    const instructionFile = path.join(plannerDir, 'storyboard-instructions.txt');
    if (!existsSync(instructionFile) || fileBytes(instructionFile).toString('utf8') !== plannerRequest(call).instructions) refuse();
    const receipt = saved(plannerDir, 'claude-max-stages', 'storyboard', prepareOpusStoryboardWire(call, plannerPolicy, instructionFile));
    if (spec.plannerFrom) {
      let answer: { is_error?: unknown; subtype?: unknown; structured_output?: unknown };
      try { answer = JSON.parse(receipt.raw.stdout); } catch { return refuse(); }
      if (answer?.is_error !== false || answer.subtype !== 'success' ||
          !sameJson(plainJson(decodePersonalBookProviderOutput(call, answer.structured_output)), receipt.output)) refuse();
    }
    return receipt.output;
  };
  const liveVisual = a.live ? storyboardVisual({ textDir: a.live.dir, policy: repairPolicy, claudeMax: a.live.claudeMax, api: a.live.api, responses: a.live.responses,
    planner: a.live.planner, reviewRule: spec.rules('storyboard_review')!, guard: a.live.guard, record: a.live.record, draft: a.live.draft }) : null;
  const visual = liveVisual && !spec.plannerFrom ? liveVisual
    // A borrowing line on its paid run: the planner answer replayed (no planner call), the review live.
    : liveVisual ? async (call: SimpleStoryboardDiagnosticCall, s: AbortSignal) => call.stage === 'storyboard'
      ? guarded(() => { const output = replayPlanner(call); a.live!.draft(output); return output; }) : liveVisual(call, s)
    : async (call: SimpleStoryboardDiagnosticCall) => {
      if (call.stage === 'storyboard') {
        const instructionFile = path.join(repairDir, 'storyboard-instructions.txt');
        // Preview: the planner request this run would send (the text and correction already replayed), its CLI wire built and measured, never sent.
        // A wire the transport would refuse (argv, wire or budget limit) surfaces under the transport's own code, not the callback wrapper's.
        if (a.preview) {
          if (!sortedSame(seen, REPAIR_REPLAYED)) return refuse();
          let wire: PlannerWire;
          try { wire = prepareOpusStoryboardWire(call, repairPolicy, instructionFile); } catch (error) { refusal ??= error; throw error; }
          return a.preview(wire, call);
        }
        return replayPlanner(call);
      }
      if (call.stage !== 'review') return refuse();
      const payload = simpleWizardVisualPayload(call, SOL);
      // Review preview (a borrowing line): every earlier call replayed, the compiled candidate's review request measured, never sent.
      if (a.reviewPreview) return sortedSame(seen, [...REPAIR_REPLAYED, ...borrowedCalls(spec)]) ? a.reviewPreview(payload, call) : refuse();
      const receipt = saved(repairDir, 'paid-stages', 'storyboard_review', payload);
      return decodePersonalBookProviderOutput(call, JSON.parse(receipt.raw.output_text));
    };
  if (spec.plannerSchema && spec.plannerFrom) fail('fresh_book_storyboard_repair_replay');
  const result = await runSimpleWizardBook({ request: prepared.accepted.canonical, options, seed: profile.seed, signal: a.signal, reservedWritingUsd: 4,
    ...FRESH_BOOK_CONTRACTS, visibleMomentContract: true, ...spec.contracts, ...(spec.compile ? { selfCheckNames: true as const } : {}),
    ...(spec.compile?.stagingFields ? { stagingFields: true as const } : {}),
    storyboardRepair: a.repair, publish: view => a.log(`phase ${view.phase}`),
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
    visual }).catch((error: unknown) => { throw refusal ?? error; });
  if (!sortedSame(seen, [...REPAIR_REPLAYED, ...borrowedCalls(spec), ...(a.live ? [] : ownCalls(spec))])) refuse();
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

/**
 * The stage's terminal recovery record after the continuation's review (or, on the revalidation line, the review of the same paid attempt):
 * its own candidate appended, then the reducer's state (never a reset).
 */
function continuationRecoveryFinal(record: { maxAttempts: number; next: { contextDigest: string };
  attempts: { attempt: number; storyboardDigest: string; contextDigest: string; outcome: 'held'; findings: ReturnType<typeof chainAttempts>[number]['findings'] }[] },
  board: { storyboardDigest: string; status: string;
  review: { reviewDigest: string; impact?: { blocking: { scope: 'book' | 'page'; pageNumber?: number; category: string; verdict: string; observation: string }[];
    notes: unknown[] } } }, line: string = CONT.folder) {
  const admitted = admittedContinuation(board.status), impact = board.review.impact ?? fail('fresh_book_storyboard_continuation_policy');
  const own = { attempt: record.attempts.length + 1, candidateDigest: board.storyboardDigest, contextDigest: record.next.contextDigest,
    outcome: admitted ? 'admitted' as const : 'held' as const,
    findings: admitted ? [] : chainAttempts([{ storyboardDigest: board.storyboardDigest, contextDigest: record.next.contextDigest, findings: impact.blocking.map(f =>
      f.scope === 'book' ? { scope: 'book' as const, category: f.category, verdict: f.verdict as 'contradiction', observation: f.observation }
        : { scope: 'page' as const, pageNumber: f.pageNumber!, category: f.category, verdict: f.verdict as 'contradiction', observation: f.observation }) }])[0].findings };
  const state = recoveryState([...record.attempts.map(a => ({ attempt: a.attempt, candidateDigest: a.storyboardDigest, contextDigest: a.contextDigest,
    outcome: a.outcome, findings: a.findings })), own], { maxAttempts: record.maxAttempts });
  return { version: STAGE_RECOVERY_VERSION, stage: 'storyboard', stateSha256AtAdmission: previewSha(canonicalJson(record)),
    attempt: { ...own, line, disposition: board.status, reviewDigest: board.review.reviewDigest, notes: impact.notes },
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
// The bound revalidation (same owner amendment, same allowance, 2026-10-19): the continuation's ONE paid planner answer, refused at compile by
// the strict self-check section-name check before its review, compiled under storyboard-self-check-names/v1 and given the ONE unspent review.
// ---------------------------------------------------------------------------------------------------------------
const REVAL = FRESH_BOOK_STORYBOARD_REVALIDATION;
/** The revalidation folder's own admission record (beside its input and its terminal recovery record). */
export const REVALIDATION_ADMISSION_FILE = 'revalidation-admission.json';
const admittedRevalidation = (status: unknown) => (REVAL.admittedStatuses as readonly unknown[]).includes(status);
/** The seal's binding of what was revalidated: the consumed continuation's grant, its paid planner wire, the candidate and the compile correction. */
const revalidatedOf = (grant: FreshBookStoryboardRevalidationGrant) => ({ continuationGrantSha256: grant.continuation.grantSha256,
  plannerWireDigest: grant.continuation.plannerWireDigest, candidateStoryboardDigest: grant.candidate.storyboardDigest, compile: [...grant.compile] });

/**
 * The consumed continuation and its compile refusal the revalidation stands on, re-read exactly: the continuation grant its claim names (naming
 * the repair, recovery and original claims, at the continuation grant's own head); the WHOLE earlier authority that grant consumed, re-derived
 * by the continuation line's own verifiers (repairHeld, continuationRecovery) and equal to what it recorded; its terminal record and seal are
 * exactly this refusal (failed_storyboard_continuation / storyboard_self_check_resolution_changed) with no successor, audition or terminal
 * recovery record; its admission, input, recovery state and diagnosis are the engine's (its rereview outcome and its planner preview re-derived
 * now); its API meter holds NO call (refused before its review) and its planner meter exactly the one settled session, whose claimed wire is
 * the request the engine rebuilds for that continuation now. The paid answer is that session's own output. The refusal reproduces: the strict
 * compile refuses the answer with exactly the recorded code, and the corrected compile (storyboard-self-check-names/v1) admits it, every
 * corrected name recorded (at least one: otherwise there was nothing to correct). The ledger it stands on is the stages before it.
 */
async function continuationFailed(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, loaded: ReturnType<typeof loadProfile>,
  continuationGrantFile: string) {
  const { profile, prepared, options } = loaded, refuse = (): never => fail('fresh_book_storyboard_revalidation_continuation');
  if (!path.isAbsolute(continuationGrantFile)) refuse();
  const at = (name: string) => path.join(env.authorityRoot, name), dir = path.join(config.bookDir, CONT.folder);
  const maxDir = path.join(dir, 'claude-max-stages'), paidDir = path.join(dir, 'paid-stages');
  const files = { grant: continuationGrantFile, claim: at(CONT.claimName), outcome: at(CONT.outcomeName), seal: path.join(dir, 'sealed.json'),
    repairClaim: at(FRESH_BOOK_STORYBOARD_REPAIR.claimName), recoveryClaim: at(FRESH_BOOK_RECOVERY.claimName), originalClaim: at(FRESH_BOOK_CYCLE.claimName),
    plannerReceipt: path.join(maxDir, 'storyboard.receipt.json') };
  if (Object.values(files).some(f => !existsSync(f)) || existsSync(at(CONT.successorName)) || existsSync(at(CONT.auditionStartName)) ||
      existsSync(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE))) refuse();
  const digest = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, previewSha(fileBytes(f))])) as Record<keyof typeof files, string>;
  const parsed = freshBookStoryboardContinuationGrantSchema.safeParse(json(files.grant));
  if (!parsed.success) return refuse();
  const grant = parsed.data, claim = json(files.claim), outcome = json(files.outcome), seal = json(files.seal);
  const sameDir = (p: unknown) => typeof p === 'string' && path.resolve(p).toLowerCase() === path.resolve(config.bookDir).toLowerCase();
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardContinuation !== CONT.version || claim.grantSha256 !== digest.grant ||
      claim.repairClaimSha256 !== digest.repairClaim || grant.repair.claimSha256 !== digest.repairClaim ||
      claim.recoveryClaimSha256 !== digest.recoveryClaim || grant.repair.recoveryClaimSha256 !== digest.recoveryClaim ||
      claim.originalClaimSha256 !== digest.originalClaim || grant.repair.originalClaimSha256 !== digest.originalClaim || claim.engineHead !== grant.engine.head ||
      !sameDir(claim.bookDir) || !sameDir(grant.bookDir) || grant.profileSha256 !== freshBookProfileSha(profile) || claim.profileSha256 !== grant.profileSha256) refuse();
  // The whole earlier authority the continuation consumed, re-derived by the continuation line's own verifiers, must be exactly what its grant recorded.
  let held: ReturnType<typeof repairHeld>;
  try { held = repairHeld(config, env, rereview, loaded, grant.repair.grantFile); }
  catch (error) { if (error instanceof FreshBookError) throw error; return refuse(); }
  const derived = continuationRecovery(config, loaded, held);
  if (!sameJson(held.repair, grant.repair) || !sameJson(held.held, grant.held) || !sameJson(held.ledger, grant.ledger) ||
      !sameJson(grant.recovery, { version: STAGE_RECOVERY_VERSION, attempts: derived.record.attempts.length, maxAttempts: derived.record.maxAttempts,
        consecutiveFailures: derived.record.consecutiveFailures, mode: derived.record.mode, stateSha256: derived.stateSha256, diagnosisDigest: derived.diagnosisDigest,
        contextDigest: derived.contextDigest })) refuse();
  // Its terminal record and seal: exactly this refusal, after the five replays, before any review.
  if (!sameJson(Object.keys(outcome).sort(), ['code', 'cycle', 'finishedAt', 'status']) || outcome.cycle !== FRESH_BOOK_CYCLE.id ||
      outcome.status !== REVAL.failedOutcome || outcome.code !== REVAL.failedCode) refuse();
  if (!sameJson(Object.keys(seal).sort(), ['code', 'continued', 'replayed', 'runtimeEligible', 'status']) || seal.status !== 'failed' || seal.code !== REVAL.failedCode ||
      seal.runtimeEligible !== false || !sameJson(seal.continued, { parentStoryboardDigest: grant.held.storyboardDigest, addedContracts: [...CONT.addedContracts] }) ||
      !Array.isArray(seal.replayed) || !sortedSame(seal.replayed, REPAIR_REPLAYED)) refuse();
  // Its admission and records: this grant's; the input, recovery state and diagnosis the engine derives now.
  const admission = json(path.join(dir, 'continuation-admission.json'));
  if (!sameJson(Object.keys(admission).sort(), ['grantSha256', 'held', 'ledger', 'preview', 'recovery', 'repair', 'rereviewOutcome', 'version']) ||
      admission.version !== CONT.version || admission.grantSha256 !== digest.grant || !sameJson(admission.repair, grant.repair) || !sameJson(admission.held, grant.held) ||
      !sameJson(admission.recovery, grant.recovery) || admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd ||
      admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd || !sameJson(admission.rereviewOutcome, await assertFreshBookAdmission(rereview, env))) refuse();
  if (!sameJson(json(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE)), plainJson(held.continuation)) ||
      !sameJson(json(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE)), plainJson(derived.record)) ||
      !sameJson(json(path.join(dir, CONTINUATION_DIAGNOSIS_FILE)), plainJson(derived.diagnosisRecord))) refuse();
  // Its meters: NO API claim (refused before its review); exactly the one settled planner session, accounted in its own spend records.
  if (existsSync(paidDir) && readdirSync(paidDir).length) refuse();
  if (!sameJson(readdirSync(maxDir).sort(), ['storyboard.claim.json', 'storyboard.receipt.json', 'storyboard.result.json', 'storyboard.wire.json'])) refuse();
  const plannerClaim = json(path.join(maxDir, 'storyboard.claim.json')), plannerWire = json(path.join(maxDir, 'storyboard.wire.json'));
  const plannerResult = json(path.join(maxDir, 'storyboard.result.json')), receipt = json(files.plannerReceipt);
  const spend = json(path.join(dir, 'spend.json')), maxSpend = json(path.join(dir, 'claude-max-spend.json'));
  if (plannerClaim.step !== 'storyboard' || previewSha(canonicalJson(plannerWire)) !== plannerClaim.wireDigest || plannerResult.wireDigest !== plannerClaim.wireDigest ||
      plannerResult.completed !== true || !Number.isSafeInteger(plannerResult.estimatedMicroUsd) || plannerResult.estimatedMicroUsd < 0 ||
      receipt.estimatedMicroUsd !== plannerResult.estimatedMicroUsd) refuse();
  if (spend.calls !== 0 || spend.newKnownApiMicroUsd !== 0 || spend.reservedUnsettledMicroUsd !== 0 || spend.unknownCost || spend.unknownOutcome ||
      maxSpend.accountedMicroUsd !== plannerResult.estimatedMicroUsd || maxSpend.knownEstimateMicroUsd !== plannerResult.estimatedMicroUsd ||
      maxSpend.unknownAttemptCosts !== 0 || maxSpend.logicalAttempts !== 1) refuse();
  // The paid session claimed exactly the request the engine rebuilds for that continuation now (its admitted preview, re-derived).
  const preview = await previewFreshBookStoryboardContinuation(config, held.continuation);
  if (!sameJson(admission.preview, preview) || plannerClaim.wireDigest !== preview.wireDigest) refuse();
  // The refusal reproduces on the paid answer, and the corrected compile admits that same answer.
  const draft = receipt.output, c = FRESH_BOOK_CONTRACTS;
  const sourceOf = () => prepareCurrentPersonalStoryboard(prepared.accepted.canonical, held.source, options, c.actorOwnedAppearance, c.momentContract,
    c.landmarkKindContract, undefined, c.sceneLocationContract, c.compilerRulesContract, held.continuation, c.drawnInstantContract, true, true, true);
  let strict: unknown = null;
  try { compilePersonalStoryboard(sourceOf(), structuredClone(draft)); } catch (error) { strict = error; }
  if (codeOf(strict, '') !== REVAL.failedCode) refuse();
  let book: ReturnType<typeof compilePersonalStoryboard>;
  try { book = compilePersonalStoryboard(sourceOf(), structuredClone(draft), { selfCheckNames: true }); } catch { return refuse(); }
  const raw = (draft as { selfCheck?: { resolutions?: { changed: string[] }[] } }).selfCheck?.resolutions ?? refuse();
  const checked = book.selfCheck ?? refuse();
  const sections = new Set(Object.keys(draftSections(draft))), moved = changedSections(held.continuation.draft, draft);
  const resolvedNames: { from: string; to: string[] }[] = [];
  for (const name of raw.flatMap(r => r.changed)) {
    const to = resolveSelfCheckSections([name], sections, moved);
    if (!sameJson(to, [name]) && !resolvedNames.some(r => r.from === name)) resolvedNames.push({ from: name, to });
  }
  if (book.selfCheckNames !== STORYBOARD_SELF_CHECK_NAMES_VERSION || !resolvedNames.length ||
      !sameJson(checked.resolutions.map(r => r.changed), raw.map(r => resolveSelfCheckSections(r.changed, sections, moved)))) refuse();
  const before = freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env),
    stages: bookStages(config.bookDir, 'storyboard_continuation').slice(0, 4) });
  return { continuation: { grantFile: path.resolve(continuationGrantFile), grantSha256: digest.grant, claimSha256: digest.claim, outcomeSha256: digest.outcome,
      sealSha256: digest.seal, folderSha256: previewSha(canonicalJson(folderBaseline(dir))), plannerReceiptSha256: digest.plannerReceipt,
      plannerWireDigest: plannerClaim.wireDigest as string, plannerMaxMicroUsd: plannerResult.estimatedMicroUsd as number, repairClaimSha256: digest.repairClaim,
      recoveryClaimSha256: digest.recoveryClaim, originalClaimSha256: digest.originalClaim },
    candidate: { sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest, draftSha256: previewSha(canonicalJson(draft)),
      claims: checked.frames.reduce((n, f) => n + f.claims.length, 0), resolutions: checked.resolutions.length, resolvedNames },
    recovery: { attempt: derived.record.next.attempt, maxAttempts: derived.record.maxAttempts, stateSha256: derived.stateSha256, diagnosisDigest: derived.diagnosisDigest },
    ledger: { diagnosticSettledMicroUsd: before.diagnosticSettledMicroUsd, bookKnownMicroUsd: before.bookKnownMicroUsd,
      calls: before.stages.reduce((n, s) => n + s.calls, 0) },
    input: held.continuation, recoveryRecord: derived.record, diagnosisRecord: derived.diagnosisRecord,
    /** The verified writer source and the two earlier held candidates (for a later line that re-derives this one). */
    source: held.source, earlier: [held.earlier, held.held] as const };
}

/** Provider-free plan and the revalidation grant this exact state needs (no key, no provider, no write). */
export async function planFreshBookStoryboardRevalidation(config: FreshBookConfig, env: FreshBookEnv, continuationGrantFile: string) {
  const base = planFreshBook(config, env), loaded = loadProfile(config);
  const failed = await continuationFailed(config, env, base.rereview, loaded, continuationGrantFile);
  const at = (name: string) => path.join(env.authorityRoot, name);
  const plan = { version: REVAL.version, cycle: FRESH_BOOK_CYCLE.id, amendment: REVAL.amendment, basePlanSha256: base.grantDraft.nativePlanSha256,
    bookDir: path.resolve(config.bookDir), folder: REVAL.folder, storyboardDir: REVAL.folder,
    replay: { calls: [...REPAIR_REPLAYED, ...borrowedCalls(REVALIDATION_SPEC)],
      from: 'the failed text, the recovery and the continuation\'s ONE paid planner session (saved wires and receipts, byte-exact; the planner answer re-decoded from its own CLI output; no provider or model callback)' },
    revalidation: { refused: { outcome: REVAL.failedOutcome, code: REVAL.failedCode }, compile: [STORYBOARD_SELF_CHECK_NAMES_VERSION], candidate: failed.candidate,
      input: 'the continuation\'s own saved input (the held repair draft and its exact raw review, with the repair\'s input as ancestry), unchanged' },
    recovery: { reducer: STAGE_RECOVERY_VERSION, attempt: failed.recovery.attempt, maxAttempts: failed.recovery.maxAttempts, stateSha256: failed.recovery.stateSha256,
      diagnosisDigest: failed.recovery.diagnosisDigest, last: 'this reviews the stage\'s last attempt: held ends the line (stop_allowance_exhausted)' },
    calls: { planner: 'none: the continuation\'s paid answer is replayed, never re-sent', review: `storyboard_review: Sol 6.1 (${SOL}), ${REVAL.apiCalls}`,
      reviewReserve: `max(${REVIEW_RESERVE_FLOOR_MICRO_USD}, the bound its request derives); admission refuses before the claim below the floor, the meter before the key or provider below that maximum; journal and replay derive it under the same rule` },
    downstream: ['child --storyboard-revalidation', 'book --storyboard-revalidation [--resume]'],
    caps: { ...base.plan.caps, storyboardRevalidationApiCalls: REVAL.apiCalls },
    claim: at(REVAL.claimName), outcome: at(REVAL.outcomeName), successor: at(REVAL.successorName),
    successorAdmission: 'downstream replays the whole chain (text, correction, the borrowed paid planner answer, review) from the saved evidence and re-derives the refusal and the recovery records against its one durable record',
    providerCalls: 0, keyRead: false };
  const engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_STORYBOARD_REVALIDATION_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft: FreshBookStoryboardRevalidationGrant = freshBookStoryboardRevalidationGrantSchema.parse({ version: 'fresh-book-storyboard-revalidation-grant/v1',
    cycle: FRESH_BOOK_CYCLE.id, approval: FRESH_BOOK_CYCLE.approval, amendment: REVAL.amendment, profileSha256: base.plan.profileSha256,
    bookDir: path.resolve(config.bookDir), continuation: failed.continuation, candidate: failed.candidate, recovery: failed.recovery, ledger: failed.ledger,
    allowance: { plannerCalls: REVAL.plannerCalls, apiCalls: REVAL.apiCalls, reviewReserveFloorMicroUsd: REVAL.reviewReserveFloorMicroUsd },
    compile: [STORYBOARD_SELF_CHECK_NAMES_VERSION], engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)) });
  const probe = (f: () => unknown) => { try { return f(); } catch (e) { return { refused: e && typeof e === 'object' && 'code' in e ? e.code : String(e) }; } };
  const state = { claimExists: existsSync(plan.claim), outcomeExists: existsSync(plan.outcome), successorExists: existsSync(plan.successor),
    folderExists: existsSync(path.join(config.bookDir, REVAL.folder)),
    ledger: probe(() => freshBookLedger(config, env, base.rereview, 'storyboard_revalidation')),
    reviewFloor: probe(() => assertReviewFloorFits(freshBookLedger(config, env, base.rereview, 'storyboard_revalidation'))), engine };
  return { plan, grantDraft, state, profile: base.profile, prepared: loaded.prepared, options: loaded.options, rereview: base.rereview,
    input: failed.input, recoveryRecord: failed.recoveryRecord, diagnosisRecord: failed.diagnosisRecord };
}

/**
 * A revalidation-line stage's admission, as admitStoryboardContinuation: the baseline pinned FIRST and held across every await: the revalidation
 * grant bytes, the consumed continuation grant's bytes, the repair, recovery and original grants' bytes that chain names (each at its recorded
 * digest, never re-pinned to this head), configuration, profile, lineage, every line's authority records and the earlier stage entries (the
 * failed text, the held recovery, the held repair and the refused continuation). The grant is exactly the draft this state rebuilds, at the
 * clean reviewed head. Its guard adds the revalidation claim and the continuation, repair, recovery and original claims it names.
 */
async function admitStoryboardRevalidation(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal; earlier: string[] }) {
  const bytes = fileBytes(a.grantFile);
  if (previewSha(bytes) !== a.grantSha) fail('fresh_book_storyboard_revalidation_grant');
  const parsed = freshBookStoryboardRevalidationGrantSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success) return fail('fresh_book_storyboard_revalidation_grant');
  const contFile = parsed.data.continuation.grantFile, contBytes = fileBytes(contFile);
  if (previewSha(contBytes) !== parsed.data.continuation.grantSha256) fail('fresh_book_storyboard_revalidation_continuation');
  let cont: FreshBookStoryboardContinuationGrant, named: FreshBookStoryboardRepairGrant, recoveryGrant: FreshBookRecoveryGrant;
  try { cont = freshBookStoryboardContinuationGrantSchema.parse(JSON.parse(contBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_revalidation_continuation'); }
  const repairFile = cont.repair.grantFile, repairBytes = fileBytes(repairFile);
  if (previewSha(repairBytes) !== cont.repair.grantSha256) fail('fresh_book_storyboard_continuation_repair');
  try { named = freshBookStoryboardRepairGrantSchema.parse(JSON.parse(repairBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_continuation_repair'); }
  const recoveryFile = named.recovery.grantFile, recoveryBytes = fileBytes(recoveryFile);
  if (previewSha(recoveryBytes) !== named.recovery.grantSha256) fail('fresh_book_storyboard_repair_recovery');
  try { recoveryGrant = freshBookRecoveryGrantSchema.parse(JSON.parse(recoveryBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_repair_recovery'); }
  const originalFile = recoveryGrant.original.grantFile, originalBytes = fileBytes(originalFile);
  if (previewSha(originalBytes) !== recoveryGrant.original.grantSha256) fail('fresh_book_recovery_original');
  const rereview = loadRereview(a.config);
  let roots = rootsOf(a.config, a.env, rereview, a.earlier);
  const planned = await planFreshBookStoryboardRevalidation(a.config, a.env, contFile);
  const outcome = await assertFreshBookAdmission(planned.rereview, a.env);
  const engine = a.env.head();
  if (canonicalJson(parsed.data) !== canonicalJson(planned.grantDraft)) fail('fresh_book_storyboard_revalidation_grant');
  if (!engine.clean || engine.head !== planned.grantDraft.engine.head || engine.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    if (!fileBytes(a.grantFile).equals(bytes)) fail('fresh_book_storyboard_revalidation_grant');
    if (!fileBytes(contFile).equals(contBytes)) fail('fresh_book_storyboard_revalidation_continuation');
    if (!fileBytes(repairFile).equals(repairBytes)) fail('fresh_book_storyboard_continuation_repair');
    if (!fileBytes(recoveryFile).equals(recoveryBytes)) fail('fresh_book_storyboard_repair_recovery');
    if (!fileBytes(originalFile).equals(originalBytes)) fail('fresh_book_recovery_original');
    if (canonicalJson(rootsOf(a.config, a.env, rereview, a.earlier)) !== canonicalJson(roots)) fail('fresh_book_roots_changed');
    const e = a.env.head();
    if (!e.clean || e.head !== planned.grantDraft.engine.head || e.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(planned.grantDraft.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
  };
  const guard = () => { same(); assertFreshBookStoryboardRevalidationPaid({ env: a.env, grantFile: a.grantFile, grantSha: a.grantSha, profile: planned.profile, workspace: workspace() }); };
  const recapture = (added: string[]) => {
    const next = rootsOf(a.config, a.env, rereview, a.earlier), changed = Object.keys(next).filter(k => next[k] !== roots[k]);
    if (canonicalJson(Object.keys(next).sort()) !== canonicalJson(Object.keys(roots).sort()) || canonicalJson(changed.sort()) !== canonicalJson([...added].sort()) ||
        added.some(k => roots[k] !== 'absent' || next[k] === 'absent')) fail('fresh_book_roots_changed');
    roots = next; same();
  };
  same();
  return { planned, outcome, same, guard, recapture, grant: planned.grantDraft, revalidation: planned.input };
}

type RevalidationPreview = { sourceDigest: string; storyboardDigest: string; contentBytes: number; contentByteLimit: number; payloadBytes: number;
  payloadDigest: string; reviewReserveMicroUsd: number; reviewFloorMicroUsd: number; maxOutputTokens: number; model: string; instructionsSha256: string;
  inputSha256: string };
/**
 * Provider-free preview of the revalidation's ONE review request, on the paid run's own code path (the shared flow under the revalidation's
 * spec): the text and the correction replayed, the continuation's paid planner answer replayed under its own saved wire and re-decoded from its
 * CLI output, compiled under the correction, then the review request built and measured (content limit, the floored reservation) and stopped
 * before any key or provider. The paid stage runs it before its claim; its payload digest binds the paid review's claim.
 */
export async function previewFreshBookStoryboardRevalidation(config: FreshBookConfig, input: StoryboardRepair): Promise<RevalidationPreview> {
  const out: { preview?: RevalidationPreview } = {};
  try {
    await storyboardRepairFlow({ config, repair: input, signal: new AbortController().signal, log: () => {}, seen: [], spec: REVALIDATION_SPEC, reviewPreview: (payload, call) => {
      const reserve = STORYBOARD_REVALIDATION_RULES('storyboard_review')!.reserve(payload);
      if (reserve === null || typeof call.context.storyboardDigest !== 'string') return fail('fresh_book_storyboard_revalidation_preview');
      out.preview = { sourceDigest: call.context.sourceDigest, storyboardDigest: call.context.storyboardDigest,
        contentBytes: Buffer.byteLength(call.instructions, 'utf8') + Buffer.byteLength(call.input, 'utf8'), contentByteLimit: SIMPLE_STORYBOARD_INPUT_LIMIT,
        payloadBytes: Buffer.byteLength(JSON.stringify(payload), 'utf8'), payloadDigest: previewSha(canonicalJson(payload)), reviewReserveMicroUsd: reserve,
        reviewFloorMicroUsd: REVIEW_RESERVE_FLOOR_MICRO_USD, maxOutputTokens: call.maxOutputTokens, model: String(payload.model),
        instructionsSha256: previewSha(call.instructions), inputSha256: previewSha(call.input) };
      return fail('fresh_book_storyboard_revalidation_preview_complete');
    } });
  } catch (error) { if (!out.preview) throw error; }
  return out.preview ?? fail('fresh_book_storyboard_revalidation_preview');
}

/**
 * The bound revalidation of the same book: admission re-derives the refused continuation and its whole lineage exactly (the refusal reproduced
 * on the paid answer, the corrected compile admitting it), the balance must cover the review's floor and the review request must be sendable
 * and name exactly the admitted candidate; then one claim and its own folder with its admission and input; the text, the correction and the
 * continuation's paid planner answer are replayed (no planner call), and the ONE Sol review runs on the native call site (max(600000, its
 * bound)). Admitted: its successor is re-derived by replaying the whole chain and recorded once. Held: its terminal outcome (the stage's attempt
 * ceiling is reached). Failed: its terminal outcome. Nothing earlier is written.
 */
export async function runFreshBookStoryboardRevalidation(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void; transports?: Pick<FreshTextTransports, 'responses'> }) {
  const { config, env, signal } = args, transports = args.transports ?? {};
  const admitted = await admitStoryboardRevalidation({ ...args, earlier: ['request.json', 'admission.json', 'text', FRESH_BOOK_RECOVERY.folder,
    FRESH_BOOK_STORYBOARD_REPAIR.folder, CONT.folder] });
  const ledger = freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_revalidation'), dir = path.join(config.bookDir, REVAL.folder);
  if (existsSync(dir)) fail('fresh_book_storyboard_revalidation_used');
  const floor = assertReviewFloorFits(ledger, 'fresh_book_storyboard_revalidation_budget');
  // Before the claim: the exact review request must be sendable, within the balance, and name exactly the admitted candidate.
  const preview = await previewFreshBookStoryboardRevalidation(config, admitted.revalidation);
  if (preview.sourceDigest !== admitted.grant.candidate.sourceDigest || preview.storyboardDigest !== admitted.grant.candidate.storyboardDigest ||
      preview.contentBytes > preview.contentByteLimit || preview.reviewReserveMicroUsd > floor.remainingMicroUsd) fail('fresh_book_storyboard_revalidation_preview');
  // No await from the last check to the one revalidation claim and its folder.
  admitted.same();
  claimFreshBookStoryboardRevalidation(env, admitted.grant, args.grantSha);
  admitted.recapture([`authority/${REVAL.claimName}`]);
  try { mkdirSync(dir); } catch { fail('fresh_book_storyboard_revalidation_used'); }
  exclusiveJson(path.join(dir, REVALIDATION_ADMISSION_FILE), { version: REVAL.version, grantSha256: args.grantSha, continuation: admitted.grant.continuation,
    candidate: admitted.grant.candidate, recovery: admitted.grant.recovery, ledger, preview, rereviewOutcome: admitted.outcome });
  exclusiveJson(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE), admitted.revalidation);
  const api = new AuditionMeter(path.join(dir, 'paid-stages'), ledger.nextCapMicroUsd, REVAL.apiCalls, ledger.bookKnownMicroUsd, 0, STORYBOARD_REVALIDATION_RULES);
  const key = keyReader(config.keyEnvFile);
  const responses = transports.responses ?? openAIResponses(key);
  let storyboardDraft: unknown = null, failed: string | null = null;
  const seen: string[] = [];
  const record = (error: unknown): never => { failed ??= codeOf(error, 'fresh_book_provider_transport'); throw error; };
  const guard = () => { try { admitted.guard(); } catch (error) { record(error); } };
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    exclusiveJson(path.join(dir, 'spend.json'), api.snapshot());
    exclusiveJson(path.join(dir, 'sealed.json'), { status, ...extra, revalidated: revalidatedOf(admitted.grant), replayed: [...seen], runtimeEligible: false });
  };
  try {
    const result = await storyboardRepairFlow({ config, repair: admitted.revalidation, signal, log: args.log, seen, spec: REVALIDATION_SPEC,
      live: { dir, api, responses, guard, record, draft: d => { storyboardDraft = d; } } });
    guard();
    exclusiveJson(path.join(dir, 'simple-book-result.json'), result);
    exclusiveText(path.join(dir, 'story.md'), `# ${result.source.manuscript.title}\n\n` +
      result.source.manuscript.pages.map(p => `## עמוד ${p.pageNumber}\n\n${p.text}`).join('\n\n') + '\n');
    if (result.storyboard) {
      exclusiveJson(path.join(dir, 'visual_simple_book_result.json'), result);
      exclusiveJson(path.join(dir, 'owned_storyboard_draft.json'), storyboardDraft ?? fail('fresh_book_draft_missing'));
    }
    seal(result.status);
    const board = result.storyboard ?? fail('fresh_book_storyboard_revalidation_policy');
    const final = continuationRecoveryFinal(admitted.planned.recoveryRecord, { storyboardDigest: board.storyboardDigest, status: result.status, review: board.review }, REVAL.folder);
    exclusiveJson(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE), final);
    if (!admittedRevalidation(result.status)) finish(env, REVAL.ownHeldOutcome, { textStatus: result.status, recovery: final.terminal }, REVAL.outcomeName);
    else {
      // The successor's ONE durable provenance: its whole chain replayed from the saved evidence, then recorded once under a fresh guard.
      const successor = await deriveStoryboardRevalidationSuccessor({ config, env, grantSha: args.grantSha, admitted });
      guard();
      exclusiveJson(path.join(env.authorityRoot, REVAL.successorName), successor);
      admitted.recapture([`authority/${REVAL.successorName}`]);
    }
    return { status: result.status, recovery: final, api: api.snapshot(), ledger: freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_revalidation') };
  } catch (error) {
    const code = failed ?? codeOf(error, 'fresh_book_storyboard_revalidation_failed');
    if (!existsSync(path.join(dir, 'sealed.json'))) seal('failed', { code });
    if (!existsSync(path.join(env.authorityRoot, REVAL.outcomeName))) finish(env, 'failed_storyboard_revalidation', { code }, REVAL.outcomeName);
    throw error;
  }
}

type RevalidationAdmitted = { grant: FreshBookStoryboardRevalidationGrant; revalidation: StoryboardRepair; outcome: unknown;
  planned: Pick<Awaited<ReturnType<typeof planFreshBookStoryboardRevalidation>>, 'recoveryRecord'> };
/**
 * The revalidation's successor, re-derived from its saved evidence (never its own seal, summary or a re-captured folder): its seal and admission
 * are this grant's; its input is exactly the continuation's; its review request is the one the engine rebuilds now (the paid claim's wire); its
 * meters hold exactly the one floored review and NO planner session; replaying the WHOLE chain (text, correction, the borrowed paid planner
 * answer, review) on the paid run's own code path reproduces the saved admitted result exactly; its draft is the continuation's paid answer;
 * its terminal recovery record is the reducer's state after that result. Returns the ONE durable record.
 */
async function deriveStoryboardRevalidationSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: RevalidationAdmitted }) {
  const { config, env } = a, grant = a.admitted.grant, dir = path.join(config.bookDir, REVAL.folder);
  const refuse = (): never => fail('fresh_book_storyboard_revalidation_successor');
  try {
    const seal = json(path.join(dir, 'sealed.json'));
    if (!sameJson(Object.keys(seal).sort(), ['replayed', 'revalidated', 'runtimeEligible', 'status']) || !admittedRevalidation(seal.status) || seal.runtimeEligible !== false ||
        !sameJson(seal.revalidated, revalidatedOf(grant)) || !Array.isArray(seal.replayed) ||
        !sortedSame(seal.replayed, [...REPAIR_REPLAYED, ...borrowedCalls(REVALIDATION_SPEC)])) refuse();
    const admission = json(path.join(dir, REVALIDATION_ADMISSION_FILE));
    if (!sameJson(Object.keys(admission).sort(), ['candidate', 'continuation', 'grantSha256', 'ledger', 'preview', 'recovery', 'rereviewOutcome', 'version']) ||
        admission.version !== REVAL.version || admission.grantSha256 !== a.grantSha || !sameJson(admission.continuation, grant.continuation) ||
        !sameJson(admission.candidate, grant.candidate) || !sameJson(admission.recovery, grant.recovery) || !sameJson(admission.rereviewOutcome, a.admitted.outcome) ||
        admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd || admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd) refuse();
    if (!sameJson(json(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE)), plainJson(a.admitted.revalidation))) refuse();
    // The admitted preview is this revalidation's own review request: re-derived now, and the paid review claimed exactly that wire.
    const preview = await previewFreshBookStoryboardRevalidation(config, a.admitted.revalidation);
    const reviewed = verifyMeterRecords(path.join(dir, 'paid-stages'), STORYBOARD_REVALIDATION_RULES);
    if (!sameJson(admission.preview, preview) || preview.storyboardDigest !== grant.candidate.storyboardDigest || reviewed.length !== 1 ||
        reviewed[0].claim.step !== 'storyboard_review' || reviewed[0].result?.completed !== true || reviewed[0].claim.wireDigest !== preview.payloadDigest ||
        !(reviewed[0].claim.maximumMicroUsd >= REVIEW_RESERVE_FLOOR_MICRO_USD) || existsSync(path.join(dir, 'claude-max-stages'))) refuse();
    const seen: string[] = [];
    const replayed = await storyboardRepairFlow({ config, repair: a.admitted.revalidation, signal: new AbortController().signal, log: () => {}, seen,
      spec: REVALIDATION_SPEC, replayDir: dir });
    const saved = json(path.join(dir, 'simple-book-result.json')), board = replayed.storyboard;
    if (!board) return refuse();
    if (!sameJson(seal.replayed, seen.filter(k => !ownCalls(REVALIDATION_SPEC).includes(k))) || !admittedRevalidation(replayed.status) ||
        replayed.status !== seal.status || board.storyboardDigest !== grant.candidate.storyboardDigest ||
        !sameJson(plainJson(replayed), saved) || !sameJson(json(path.join(dir, 'visual_simple_book_result.json')), saved) ||
        !sameJson(json(path.join(dir, 'owned_storyboard_draft.json')), json(path.join(config.bookDir, CONT.folder, 'claude-max-stages', 'storyboard.receipt.json')).output)) refuse();
    const final = continuationRecoveryFinal(a.admitted.planned.recoveryRecord, { storyboardDigest: board.storyboardDigest, status: replayed.status, review: board.review },
      REVAL.folder);
    if (!sameJson(json(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE)), plainJson(final))) refuse();
    return { cycle: FRESH_BOOK_CYCLE.id, storyboardRevalidation: REVAL.version, grantSha256: a.grantSha,
      originalClaimSha256: grant.continuation.originalClaimSha256, recoveryClaimSha256: grant.continuation.recoveryClaimSha256,
      repairClaimSha256: grant.continuation.repairClaimSha256, continuationClaimSha256: grant.continuation.claimSha256,
      revalidationClaimSha256: previewSha(fileBytes(path.join(env.authorityRoot, REVAL.claimName))), plannerWireDigest: grant.continuation.plannerWireDigest,
      storyboardDigest: board.storyboardDigest, reviewDigest: board.review.reviewDigest, disposition: replayed.status, notes: board.review.impact?.notes.length ?? 0,
      reviewReserveMicroUsd: reviewed[0].claim.maximumMicroUsd as number, recoveryStateSha256: grant.recovery.stateSha256, diagnosisDigest: grant.recovery.diagnosisDigest,
      recoveryFinalSha256: previewSha(canonicalJson(final)), successorSha256: previewSha(canonicalJson(folderBaseline(dir))) };
  } catch { return refuse(); }
}
/** At every downstream entry: the revalidation's successor re-derived now must equal its one durable record. */
async function verifyStoryboardRevalidationSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: RevalidationAdmitted }) {
  const record = await deriveStoryboardRevalidationSuccessor(a), file = path.join(a.env.authorityRoot, REVAL.successorName);
  if (!existsSync(file) || !sameJson(json(file), record)) fail('fresh_book_storyboard_revalidation_successor');
  return record;
}

// ---------------------------------------------------------------------------------------------------------------
// The ONE owner-approved extension (refined Proposal B, 2026-10-19): attempt 4 of 4 of the storyboard stage under the claim-basis contract.
// ---------------------------------------------------------------------------------------------------------------
const EXT = FRESH_BOOK_STORYBOARD_EXTENSION;
/** The extension folder's own admission record (beside its input and its recovery records). */
export const EXTENSION_ADMISSION_FILE = 'extension-admission.json';
/** The extension's API meter: its one Sol storyboard review, under the same floored rule (claim, journal and replay alike). */
export const STORYBOARD_EXTENSION_RULES: MeterRules = STORYBOARD_REPAIR_RULES;
const admittedExtension = (status: unknown) => (EXT.admittedStatuses as readonly unknown[]).includes(status);
/** The extension's shape on the shared flow: the continuation's contracts plus the claim basis, compiled under the section-name correction. */
const EXTENSION_SPEC: ReplanSpec = Object.freeze({ folder: EXT.folder,
  contracts: { selfCheckContract: true as const, reviewImpactPolicy: true as const, claimBasisContract: true as const }, rules: STORYBOARD_EXTENSION_RULES,
  compile: { selfCheckNames: true as const } });

/**
 * The consumed revalidation and the held storyboard the extension stands on, re-read exactly: the revalidation grant its claim names (naming
 * the continuation, repair, recovery and original claims, at the revalidation grant's own head); the WHOLE earlier authority that grant consumed,
 * re-derived by the revalidation line's own verifier (continuationFailed) and equal to what it recorded; its terminal record and seal are its
 * own review holding it at the base ceiling (stop_allowance_exhausted) with no successor or audition; its admission, input and admitted review
 * preview are the engine's (re-derived now); its meter holds exactly the one floored review (the previewed payload) and no planner session;
 * its draft is the continuation's paid answer; the held book is that answer recompiled under the correction to the bound candidate; its raw
 * review is the paid answer decoded for that book (whose paid request was exactly its review input) and re-judges to that held disposition;
 * its terminal recovery record is the reducer's derivation. The ledger it stands on is the stages through the revalidation.
 */
async function revalidationHeld(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, loaded: ReturnType<typeof loadProfile>,
  revalidationGrantFile: string) {
  const { profile, prepared, options } = loaded, refuse = (): never => fail('fresh_book_storyboard_extension_revalidation');
  if (!path.isAbsolute(revalidationGrantFile)) refuse();
  const at = (name: string) => path.join(env.authorityRoot, name), dir = path.join(config.bookDir, REVAL.folder);
  const files = { grant: revalidationGrantFile, claim: at(REVAL.claimName), outcome: at(REVAL.outcomeName), seal: path.join(dir, 'sealed.json'),
    reviewReceipt: path.join(dir, 'paid-stages', 'storyboard_review.receipt.json'), recoveryFinal: path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE),
    continuationClaim: at(CONT.claimName), repairClaim: at(FRESH_BOOK_STORYBOARD_REPAIR.claimName), recoveryClaim: at(FRESH_BOOK_RECOVERY.claimName),
    originalClaim: at(FRESH_BOOK_CYCLE.claimName) };
  if (Object.values(files).some(f => !existsSync(f)) || existsSync(at(REVAL.successorName)) || existsSync(at(REVAL.auditionStartName))) refuse();
  const digest = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, previewSha(fileBytes(f))])) as Record<keyof typeof files, string>;
  const parsed = freshBookStoryboardRevalidationGrantSchema.safeParse(json(files.grant));
  if (!parsed.success) return refuse();
  const grant = parsed.data, claim = json(files.claim), outcome = json(files.outcome), seal = json(files.seal);
  const sameDir = (p: unknown) => typeof p === 'string' && path.resolve(p).toLowerCase() === path.resolve(config.bookDir).toLowerCase();
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardRevalidation !== REVAL.version || claim.grantSha256 !== digest.grant ||
      claim.continuationClaimSha256 !== digest.continuationClaim || grant.continuation.claimSha256 !== digest.continuationClaim ||
      claim.repairClaimSha256 !== digest.repairClaim || grant.continuation.repairClaimSha256 !== digest.repairClaim ||
      claim.recoveryClaimSha256 !== digest.recoveryClaim || grant.continuation.recoveryClaimSha256 !== digest.recoveryClaim ||
      claim.originalClaimSha256 !== digest.originalClaim || grant.continuation.originalClaimSha256 !== digest.originalClaim || claim.engineHead !== grant.engine.head ||
      !sameDir(claim.bookDir) || !sameDir(grant.bookDir) || grant.profileSha256 !== freshBookProfileSha(profile) || claim.profileSha256 !== grant.profileSha256) refuse();
  // The whole earlier authority the revalidation consumed, re-derived by its own verifier, must be exactly what its grant recorded.
  let failed: Awaited<ReturnType<typeof continuationFailed>>;
  try { failed = await continuationFailed(config, env, rereview, loaded, grant.continuation.grantFile); }
  catch (error) { if (error instanceof FreshBookError) throw error; return refuse(); }
  if (!sameJson(failed.continuation, grant.continuation) || !sameJson(failed.candidate, grant.candidate) || !sameJson(failed.recovery, grant.recovery) ||
      !sameJson(failed.ledger, grant.ledger)) refuse();
  // Its terminal record and seal: its own review held it at the base ceiling.
  if (!sameJson(Object.keys(outcome).sort(), ['cycle', 'finishedAt', 'recovery', 'status', 'textStatus']) || outcome.cycle !== FRESH_BOOK_CYCLE.id ||
      outcome.status !== EXT.heldOutcome || !(EXT.heldStatuses as readonly string[]).includes(outcome.textStatus) || outcome.recovery !== EXT.heldRecovery) refuse();
  if (!sameJson(Object.keys(seal).sort(), ['replayed', 'revalidated', 'runtimeEligible', 'status']) || seal.status !== outcome.textStatus || seal.runtimeEligible !== false ||
      !sameJson(seal.revalidated, revalidatedOf(grant)) || !Array.isArray(seal.replayed) ||
      !sortedSame(seal.replayed, [...REPAIR_REPLAYED, ...borrowedCalls(REVALIDATION_SPEC)])) refuse();
  const admission = json(path.join(dir, REVALIDATION_ADMISSION_FILE));
  if (!sameJson(Object.keys(admission).sort(), ['candidate', 'continuation', 'grantSha256', 'ledger', 'preview', 'recovery', 'rereviewOutcome', 'version']) ||
      admission.version !== REVAL.version || admission.grantSha256 !== digest.grant || !sameJson(admission.continuation, grant.continuation) ||
      !sameJson(admission.candidate, grant.candidate) || !sameJson(admission.recovery, grant.recovery) ||
      admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd || admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd ||
      !sameJson(admission.rereviewOutcome, await assertFreshBookAdmission(rereview, env))) refuse();
  if (!sameJson(json(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE)), plainJson(failed.input))) refuse();
  const preview = await previewFreshBookStoryboardRevalidation(config, failed.input);
  const meter = verifyMeterRecords(path.join(dir, 'paid-stages'), STORYBOARD_REVALIDATION_RULES);
  if (!sameJson(admission.preview, preview) || meter.length !== 1 || meter[0].claim.step !== 'storyboard_review' || meter[0].result?.completed !== true ||
      meter[0].claim.wireDigest !== preview.payloadDigest || existsSync(path.join(dir, 'claude-max-stages'))) refuse();
  // The held book: the continuation's paid answer recompiled under the correction to the bound candidate; its review the paid answer.
  const result = json(path.join(dir, 'simple-book-result.json')), draft = json(path.join(dir, 'owned_storyboard_draft.json'));
  const paidPlanner = json(path.join(config.bookDir, CONT.folder, 'claude-max-stages', 'storyboard.receipt.json'));
  if (!sameJson(json(path.join(dir, 'visual_simple_book_result.json')), result) || result.status !== outcome.textStatus || result.storyboard?.status !== result.status ||
      !sameJson(draft, paidPlanner.output)) refuse();
  const c = FRESH_BOOK_CONTRACTS;
  let book: ReturnType<typeof compilePersonalStoryboard>, decision: ReturnType<typeof storyboardReviewDisposition>;
  try {
    book = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(prepared.accepted.canonical, failed.source, options, c.actorOwnedAppearance, c.momentContract,
      c.landmarkKindContract, undefined, c.sceneLocationContract, c.compilerRulesContract, failed.input, c.drawnInstantContract, true, true, true),
      structuredClone(draft), { selfCheckNames: true });
    decision = storyboardReviewDisposition(book, result.storyboard.rawReview);
  } catch { return refuse(); }
  if (book.storyboardDigest !== grant.candidate.storyboardDigest || book.storyboardDigest !== result.storyboard.storyboardDigest ||
      !sameJson(plainJson(book), result.storyboard.storyboard) || decision.disposition !== result.status) refuse();
  const reviewWire = json(path.join(dir, 'paid-stages', 'storyboard_review.wire.json')), receipt = json(files.reviewReceipt);
  const reviewCall = { stage: 'review', instructions: '', input: '', maxOutputTokens: 0, context: { narrativeSpreads: book.narrativeSpreads,
    sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest, actorOwnedAppearance: true, landmarkKindContract: true, reviewImpactPolicy: true } } as unknown as SimpleStoryboardDiagnosticCall;
  let paidReview: unknown;
  try { paidReview = decodePersonalBookProviderOutput(reviewCall, JSON.parse(receipt.raw.output_text)); } catch { return refuse(); }
  if (reviewWire.input !== canonicalJson(personalStoryboardReviewInput(book)) || !sameJson(paidReview, result.storyboard.rawReview)) refuse();
  const final = continuationRecoveryFinal(failed.recoveryRecord, { storyboardDigest: book.storyboardDigest, status: result.status, review: decision }, REVAL.folder);
  if (!sameJson(json(files.recoveryFinal), plainJson(final)) || final.terminal !== EXT.heldRecovery) refuse();
  const before = freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env),
    stages: bookStages(config.bookDir, 'storyboard_revalidation').slice(0, 5) });
  return { revalidation: { grantFile: path.resolve(revalidationGrantFile), grantSha256: digest.grant, claimSha256: digest.claim, outcomeSha256: digest.outcome,
      sealSha256: digest.seal, folderSha256: previewSha(canonicalJson(folderBaseline(dir))), reviewReceiptSha256: digest.reviewReceipt,
      recoveryFinalSha256: digest.recoveryFinal, continuationClaimSha256: digest.continuationClaim, repairClaimSha256: digest.repairClaim,
      recoveryClaimSha256: digest.recoveryClaim, originalClaimSha256: digest.originalClaim },
    held: { sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest, reviewDigest: decision.reviewDigest,
      disposition: decision.disposition as (typeof EXT.heldStatuses)[number], draftSha256: previewSha(canonicalJson(draft)),
      findings: (decision.impact?.blocking ?? []).length },
    ledger: { diagnosticSettledMicroUsd: before.diagnosticSettledMicroUsd, bookKnownMicroUsd: before.bookKnownMicroUsd,
      calls: before.stages.reduce((n, s) => n + s.calls, 0) },
    failed, draft, rawReview: result.storyboard.rawReview };
}

/** The extension input: the held attempt-3 draft and its raw review, the continuation input as ancestry, the claim basis, the parent's compile, the owner's extension. */
const extensionInput = (held: Awaited<ReturnType<typeof revalidationHeld>>, approvalSha256: string): StoryboardRepair => ({
  parentStoryboardDigest: held.held.storyboardDigest, draft: held.draft, review: held.rawReview, parentRepair: held.failed.input,
  addedContracts: [...EXT.addedContracts], parentCompile: { selfCheckNames: true }, extension: { version: STORYBOARD_ATTEMPT_EXTENSION_VERSION,
    maxAttempts: EXT.maxAttempts, approvalSha256 } });

/**
 * The stage's durable recovery records at admission, derived by the ENGINE from the extension source (its chain of three held candidates, their
 * contexts and findings, this attempt's context and the diagnosis it carries) and checked against this line's records: the chain is exactly the
 * recovery's, the repair's and the revalidated candidates with their findings, and the reducer's state under the owner's ceiling is three
 * consecutive failures with one attempt left. Each attempt's settled costs come from its own meter records (an unknown one refuses).
 */
function extensionRecovery(config: FreshBookConfig, loaded: ReturnType<typeof loadProfile>, held: Awaited<ReturnType<typeof revalidationHeld>>, input: StoryboardRepair) {
  const refuse = (): never => fail('fresh_book_storyboard_extension_recovery'), c = FRESH_BOOK_CONTRACTS;
  let rec: ReturnType<typeof storyboardRecovery>;
  try {
    rec = storyboardRecovery(prepareCurrentPersonalStoryboard(loaded.prepared.accepted.canonical, held.failed.source, loaded.options, c.actorOwnedAppearance,
      c.momentContract, c.landmarkKindContract, undefined, c.sceneLocationContract, c.compilerRulesContract, input, c.drawnInstantContract, true, true, true, true));
  } catch { return refuse(); }
  const [first, second] = held.failed.earlier, third = held.held;
  // Each attempt's line, held candidate and where its paid planner session and its paid review live.
  const lines = [{ folder: FRESH_BOOK_RECOVERY.folder, planner: FRESH_BOOK_RECOVERY.folder, review: FRESH_BOOK_RECOVERY.folder, ...first },
    { folder: FRESH_BOOK_STORYBOARD_REPAIR.folder, planner: FRESH_BOOK_STORYBOARD_REPAIR.folder, review: FRESH_BOOK_STORYBOARD_REPAIR.folder, ...second },
    { folder: REVAL.folder, planner: CONT.folder, review: REVAL.folder, ...third }];
  const diagnosis = rec.diagnosis ?? refuse(), diagnosed = rec.diagnosisDigest ?? refuse();
  if (rec.chain.length !== lines.length || rec.chain.some((a, i) => a.storyboardDigest !== lines[i].storyboardDigest || a.findings.length !== lines[i].findings) ||
      diagnosisDigest(diagnosis) !== diagnosed) refuse();
  const state = recoveryState(chainAttempts(rec.chain), { maxAttempts: EXT.maxAttempts });
  if (state.mode !== 'diagnose_and_change_strategy' || state.consecutiveFailures !== EXT.priorAttempts || state.maxAttempts !== EXT.maxAttempts || state.remaining !== 1) refuse();
  const settledCost = (folder: string, store: 'claude-max-stages' | 'paid-stages', step: string) => {
    const done = json(path.join(config.bookDir, folder, store, `${step}.result.json`));
    return done.completed === true && Number.isSafeInteger(done.estimatedMicroUsd) && done.estimatedMicroUsd >= 0 ? done.estimatedMicroUsd as number
      : fail('fresh_book_storyboard_extension_unknown_cost');
  };
  const record = { version: STAGE_RECOVERY_VERSION, stage: 'storyboard', diagnosisVersion: STORYBOARD_DIAGNOSIS_VERSION, maxAttempts: state.maxAttempts,
    extension: input.extension,
    attempts: rec.chain.map((a, i) => ({ attempt: i + 1, line: lines[i].folder, sourceDigest: lines[i].sourceDigest, storyboardDigest: a.storyboardDigest,
      reviewDigest: lines[i].reviewDigest, contextDigest: a.contextDigest, contracts: a.contracts, outcome: 'held' as const, disposition: lines[i].disposition,
      findings: chainAttempts([a])[0].findings,
      costs: { plannerClaudeMaxMicroUsd: settledCost(lines[i].planner, 'claude-max-stages', 'storyboard'),
        reviewApiMicroUsd: settledCost(lines[i].review, 'paid-stages', 'storyboard_review') } })),
    consecutiveFailures: state.consecutiveFailures, mode: state.mode, remaining: state.remaining, trajectory: state.trajectory,
    next: { attempt: state.attempts + 1, line: EXT.folder, contracts: rec.contracts, contextDigest: rec.context, diagnosisDigest: diagnosed,
      addedContracts: [...EXT.addedContracts], reviewPolicy: STORYBOARD_REVIEW_IMPACT_VERSION, selfCheck: STORYBOARD_SELF_CHECK_VERSION,
      claimBasis: CLAIM_BASIS_CONTRACT_VERSION,
      strategy: 'diagnose_and_change_strategy under the claim basis: stated claims bound to the sentence that states them, visual direction listed as staging, reveal timing as withhold requirements bound to the first frame that shows the entity, overrides only for visible entities and placement from the relations; every diagnosed finding answered in the self-check resolutions with exact section names' },
    terminal: null };
  const diagnosisRecord = { version: STORYBOARD_DIAGNOSIS_VERSION, diagnosisDigest: diagnosed, diagnosis, latestReviewFindings: rec.chain[rec.chain.length - 1].findings,
    allowance: { attempts: diagnosis.allowance, money: { bookKnownMicroUsd: held.ledger.bookKnownMicroUsd, bookSubcapMicroUsd: FRESH_BOOK_CYCLE.bookSubcapMicroUsd,
      reviewReserveFloorMicroUsd: EXT.reviewReserveFloorMicroUsd, plannerRoute: 'Claude Max: separate resource, not an API invoice, not $0' } } };
  return { record, stateSha256: previewSha(canonicalJson(record)), diagnosisRecord, contextDigest: rec.context, diagnosisDigest: diagnosed };
}

/** The owner's approval record: its bytes by digest, and its own verbatim approval line present (never a summary of it). */
function ownerApproval(file: string, line: string = EXT.approvalLine, code = 'fresh_book_storyboard_extension_approval') {
  if (!path.isAbsolute(file)) fail(code);
  const bytes = fileBytes(file);
  if (!bytes.toString('utf8').includes(line)) fail(code);
  return { file: path.resolve(file), sha256: previewSha(bytes) };
}

/** Provider-free plan and the extension grant this exact state needs (no key, no provider, no write). */
export async function planFreshBookStoryboardExtension(config: FreshBookConfig, env: FreshBookEnv, revalidationGrantFile: string, ownerApprovalFile: string) {
  const base = planFreshBook(config, env), loaded = loadProfile(config), approval = ownerApproval(ownerApprovalFile);
  const held = await revalidationHeld(config, env, base.rereview, loaded, revalidationGrantFile);
  const input = extensionInput(held, approval.sha256), derived = extensionRecovery(config, loaded, held, input);
  const at = (name: string) => path.join(env.authorityRoot, name);
  const plan = { version: EXT.version, cycle: FRESH_BOOK_CYCLE.id, amendment: EXT.amendment, ownerApproval: approval, basePlanSha256: base.grantDraft.nativePlanSha256,
    bookDir: path.resolve(config.bookDir), folder: EXT.folder, storyboardDir: EXT.folder,
    replay: { calls: [...REPAIR_REPLAYED], from: 'the failed text and the recovery (saved wires and receipts, byte-exact; no provider or model callback)' },
    extension: { contract: 'storyboard-repair/v1', parent: held.held, addedContracts: [...EXT.addedContracts], parentCompile: input.parentCompile,
      attemptExtension: input.extension, input: 'the held attempt-3 draft (the continuation\'s paid answer) and its exact raw review, with the continuation\'s input as ancestry: the engine re-binds every ancestor and derives every finding with its typed issues (none chosen, edited or dropped)' },
    recovery: { reducer: STAGE_RECOVERY_VERSION, diagnosis: STORYBOARD_DIAGNOSIS_VERSION, selfCheck: STORYBOARD_SELF_CHECK_VERSION, reviewImpact: STORYBOARD_REVIEW_IMPACT_VERSION,
      claimBasis: CLAIM_BASIS_CONTRACT_VERSION, attempts: derived.record.attempts.length, maxAttempts: derived.record.maxAttempts, mode: derived.record.mode,
      stateSha256: derived.stateSha256, diagnosisDigest: derived.diagnosisDigest, contextDigest: derived.contextDigest,
      last: 'this is the owner\'s ONE extra attempt (4 of 4): held again ends the line (stop_allowance_exhausted); no attempt 5' },
    calls: { planner: `storyboard: Opus 5.5 on Claude Max (${OPUS_PLANNER.model}), ${EXT.plannerCalls}`, review: `storyboard_review: Sol 6.1 (${SOL}), ${EXT.apiCalls}`,
      reviewReserve: `max(${REVIEW_RESERVE_FLOOR_MICRO_USD}, the bound its request derives); admission refuses before the claim below the floor, the meter before the key or provider below that maximum; journal and replay derive it under the same rule` },
    downstream: ['child --storyboard-extension', 'book --storyboard-extension [--resume]'],
    caps: { ...base.plan.caps, storyboardExtensionApiCalls: EXT.apiCalls },
    claim: at(EXT.claimName), outcome: at(EXT.outcomeName), successor: at(EXT.successorName),
    successorAdmission: 'downstream replays the whole chain (text, correction, planner, review) from the saved evidence and re-derives the recovery records against its one durable record',
    providerCalls: 0, keyRead: false };
  const engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_STORYBOARD_EXTENSION_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft: FreshBookStoryboardExtensionGrant = freshBookStoryboardExtensionGrantSchema.parse({ version: 'fresh-book-storyboard-extension-grant/v1',
    cycle: FRESH_BOOK_CYCLE.id, approval: FRESH_BOOK_CYCLE.approval, amendment: EXT.amendment, ownerApproval: approval, profileSha256: base.plan.profileSha256,
    bookDir: path.resolve(config.bookDir), revalidation: held.revalidation, held: held.held,
    recovery: { version: STAGE_RECOVERY_VERSION, attempts: derived.record.attempts.length, maxAttempts: derived.record.maxAttempts,
      consecutiveFailures: derived.record.consecutiveFailures, mode: derived.record.mode, stateSha256: derived.stateSha256, diagnosisDigest: derived.diagnosisDigest,
      contextDigest: derived.contextDigest },
    ledger: held.ledger, allowance: { plannerCalls: EXT.plannerCalls, apiCalls: EXT.apiCalls, reviewReserveFloorMicroUsd: EXT.reviewReserveFloorMicroUsd },
    addedContracts: [...EXT.addedContracts], compile: [STORYBOARD_SELF_CHECK_NAMES_VERSION], engine: { head: engine.head, branch: engine.branch }, pins,
    nativePlanSha256: previewSha(canonicalJson(plan)) });
  const probe = (f: () => unknown) => { try { return f(); } catch (e) { return { refused: e && typeof e === 'object' && 'code' in e ? e.code : String(e) }; } };
  const state = { claimExists: existsSync(plan.claim), outcomeExists: existsSync(plan.outcome), successorExists: existsSync(plan.successor),
    folderExists: existsSync(path.join(config.bookDir, EXT.folder)),
    ledger: probe(() => freshBookLedger(config, env, base.rereview, 'storyboard_extension')),
    reviewFloor: probe(() => assertReviewFloorFits(freshBookLedger(config, env, base.rereview, 'storyboard_extension'))),
    executablePinned: probe(() => assertFreshBookExecutable(config)), engine };
  return { plan, grantDraft, state, profile: base.profile, prepared: loaded.prepared, options: loaded.options, rereview: base.rereview,
    input, recoveryRecord: derived.record, diagnosisRecord: derived.diagnosisRecord };
}

/**
 * An extension-line stage's admission, as admitStoryboardRevalidation: the baseline pinned FIRST and held across every await: the extension grant
 * bytes, the owner's approval record bytes, the consumed revalidation, continuation, repair, recovery and original grants' bytes that chain
 * names (each at its recorded digest, never re-pinned to this head), configuration, profile, lineage, every line's authority records and the
 * earlier stage entries. The grant is exactly the draft this state rebuilds, at the clean reviewed head. Its guard adds the extension claim and
 * every claim it names.
 */
async function admitStoryboardExtension(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal; earlier: string[] }) {
  const bytes = fileBytes(a.grantFile);
  if (previewSha(bytes) !== a.grantSha) fail('fresh_book_storyboard_extension_grant');
  const parsed = freshBookStoryboardExtensionGrantSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success) return fail('fresh_book_storyboard_extension_grant');
  const approvalFile = parsed.data.ownerApproval.file, approvalBytes = fileBytes(approvalFile);
  if (previewSha(approvalBytes) !== parsed.data.ownerApproval.sha256) fail('fresh_book_storyboard_extension_approval');
  const revalFile = parsed.data.revalidation.grantFile, revalBytes = fileBytes(revalFile);
  if (previewSha(revalBytes) !== parsed.data.revalidation.grantSha256) fail('fresh_book_storyboard_extension_revalidation');
  let reval: FreshBookStoryboardRevalidationGrant, cont: FreshBookStoryboardContinuationGrant, named: FreshBookStoryboardRepairGrant, recoveryGrant: FreshBookRecoveryGrant;
  try { reval = freshBookStoryboardRevalidationGrantSchema.parse(JSON.parse(revalBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_extension_revalidation'); }
  const contFile = reval.continuation.grantFile, contBytes = fileBytes(contFile);
  if (previewSha(contBytes) !== reval.continuation.grantSha256) fail('fresh_book_storyboard_revalidation_continuation');
  try { cont = freshBookStoryboardContinuationGrantSchema.parse(JSON.parse(contBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_revalidation_continuation'); }
  const repairFile = cont.repair.grantFile, repairBytes = fileBytes(repairFile);
  if (previewSha(repairBytes) !== cont.repair.grantSha256) fail('fresh_book_storyboard_continuation_repair');
  try { named = freshBookStoryboardRepairGrantSchema.parse(JSON.parse(repairBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_continuation_repair'); }
  const recoveryFile = named.recovery.grantFile, recoveryBytes = fileBytes(recoveryFile);
  if (previewSha(recoveryBytes) !== named.recovery.grantSha256) fail('fresh_book_storyboard_repair_recovery');
  try { recoveryGrant = freshBookRecoveryGrantSchema.parse(JSON.parse(recoveryBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_repair_recovery'); }
  const originalFile = recoveryGrant.original.grantFile, originalBytes = fileBytes(originalFile);
  if (previewSha(originalBytes) !== recoveryGrant.original.grantSha256) fail('fresh_book_recovery_original');
  const rereview = loadRereview(a.config);
  let roots = rootsOf(a.config, a.env, rereview, a.earlier);
  const planned = await planFreshBookStoryboardExtension(a.config, a.env, revalFile, approvalFile);
  const outcome = await assertFreshBookAdmission(planned.rereview, a.env);
  const engine = a.env.head();
  if (canonicalJson(parsed.data) !== canonicalJson(planned.grantDraft)) fail('fresh_book_storyboard_extension_grant');
  if (!engine.clean || engine.head !== planned.grantDraft.engine.head || engine.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
  const frozen: [string, Buffer, string][] = [[a.grantFile, bytes, 'fresh_book_storyboard_extension_grant'], [approvalFile, approvalBytes, 'fresh_book_storyboard_extension_approval'],
    [revalFile, revalBytes, 'fresh_book_storyboard_extension_revalidation'], [contFile, contBytes, 'fresh_book_storyboard_revalidation_continuation'],
    [repairFile, repairBytes, 'fresh_book_storyboard_continuation_repair'], [recoveryFile, recoveryBytes, 'fresh_book_storyboard_repair_recovery'],
    [originalFile, originalBytes, 'fresh_book_recovery_original']];
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    for (const [file, held, code] of frozen) if (!fileBytes(file).equals(held)) fail(code);
    if (canonicalJson(rootsOf(a.config, a.env, rereview, a.earlier)) !== canonicalJson(roots)) fail('fresh_book_roots_changed');
    const e = a.env.head();
    if (!e.clean || e.head !== planned.grantDraft.engine.head || e.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(planned.grantDraft.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
  };
  const guard = () => { same(); assertFreshBookStoryboardExtensionPaid({ env: a.env, grantFile: a.grantFile, grantSha: a.grantSha, profile: planned.profile, workspace: workspace() }); };
  const recapture = (added: string[]) => {
    const next = rootsOf(a.config, a.env, rereview, a.earlier), changed = Object.keys(next).filter(k => next[k] !== roots[k]);
    if (canonicalJson(Object.keys(next).sort()) !== canonicalJson(Object.keys(roots).sort()) || canonicalJson(changed.sort()) !== canonicalJson([...added].sort()) ||
        added.some(k => roots[k] !== 'absent' || next[k] === 'absent')) fail('fresh_book_roots_changed');
    roots = next; same();
  };
  same();
  return { planned, outcome, same, guard, recapture, grant: planned.grantDraft, extension: planned.input };
}

/**
 * Provider-free preview of the extension's ONE planner request, on the paid run's own code path (the shared flow under the extension's spec):
 * the text and the correction replayed, the extension source prepared (every ancestor re-bound, every finding with its typed issues and the
 * diagnosis derived by the engine), then the planner's request and CLI wire built and measured (content, wire and argv limits, output cap,
 * session guard) and stopped before any session. The paid stage runs it before its claim; its wire digest binds the paid one.
 */
export async function previewFreshBookStoryboardExtension(config: FreshBookConfig, input: StoryboardRepair): Promise<ContinuationPreview> {
  const out: { preview?: ContinuationPreview } = {};
  try {
    await storyboardRepairFlow({ config, repair: input, signal: new AbortController().signal, log: () => {}, seen: [], spec: EXTENSION_SPEC, preview: (wire, call) => {
      const parsedInput = JSON.parse(call.input), diagnosis = parsedInput?.priorReviewedStoryboard?.diagnosis;
      if (!diagnosis) return fail('fresh_book_storyboard_extension_preview');
      out.preview = { contentBytes: Buffer.byteLength(call.instructions, 'utf8') + Buffer.byteLength(call.input, 'utf8'), contentByteLimit: SIMPLE_STORYBOARD_INPUT_LIMIT,
        wireBytes: wire.bytes, wireByteLimit: 104000, reservedMicroUsd: wire.reservedMicroUsd, sessionGuardMicroUsd: OPUS_PLANNER.sessionGuardMicroUsd,
        findings: Array.isArray(parsedInput?.priorReviewedStoryboard?.reviewFindings) ? parsedInput.priorReviewedStoryboard.reviewFindings.length : 0,
        instructionsSha256: previewSha(call.instructions), inputSha256: previewSha(call.input), wireDigest: previewSha(canonicalJson(wire)),
        outputCap: wire.outputCap, argvChars: wire.args.map(x => JSON.stringify(x)).join(' ').length + String(wire.payload.executable).length, argvLimit: 31000,
        diagnosisDigest: previewSha(canonicalJson(diagnosis)), resolutionsRequired: diagnosis.findings.length, protectedPages: diagnosis.protectedPages };
      return fail('fresh_book_storyboard_extension_preview_complete');
    } });
  } catch (error) { if (!out.preview) throw error; }
  return out.preview ?? fail('fresh_book_storyboard_extension_preview');
}

/**
 * The ONE owner-approved extension of the same book: admission re-derives the held revalidation and its whole lineage exactly, the engine's
 * recovery state under the owner's ceiling and the diagnosis, the balance must cover the review's floor, the planner request must be sendable;
 * then one claim and its own folder with its admission, its input, the recovery state and the diagnosis; the text and the correction are
 * replayed, and the Opus Max planner and the Sol review run once each on the native call sites (the review reserves max(600000, its bound)).
 * Admitted: its successor is re-derived by replaying the whole chain and recorded once. Held: its terminal outcome (no attempt 5). Failed: its
 * terminal outcome. Nothing earlier is written.
 */
export async function runFreshBookStoryboardExtension(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void; transports?: Pick<FreshTextTransports, 'responses' | 'planner'> }) {
  const { config, env, signal } = args, transports = args.transports ?? {};
  const admitted = await admitStoryboardExtension({ ...args, earlier: ['request.json', 'admission.json', 'text', FRESH_BOOK_RECOVERY.folder,
    FRESH_BOOK_STORYBOARD_REPAIR.folder, CONT.folder, REVAL.folder] });
  assertFreshBookExecutable(config);
  const ledger = freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_extension'), dir = path.join(config.bookDir, EXT.folder);
  if (existsSync(dir)) fail('fresh_book_storyboard_extension_used');
  assertReviewFloorFits(ledger, 'fresh_book_storyboard_extension_budget');
  // Before the claim: the exact planner request must be sendable, carry every finding of the held review and the diagnosis the grant names.
  const preview = await previewFreshBookStoryboardExtension(config, admitted.extension);
  if (preview.findings !== admitted.grant.held.findings || preview.diagnosisDigest !== admitted.grant.recovery.diagnosisDigest ||
      preview.argvChars > preview.argvLimit || preview.wireBytes > preview.wireByteLimit || preview.contentBytes > preview.contentByteLimit)
    fail('fresh_book_storyboard_extension_findings');
  // No await from the last check to the one extension claim and its folder.
  admitted.same();
  claimFreshBookStoryboardExtension(env, admitted.grant, args.grantSha);
  admitted.recapture([`authority/${EXT.claimName}`]);
  try { mkdirSync(dir); } catch { fail('fresh_book_storyboard_extension_used'); }
  mkdirSync(path.join(dir, 'cli-workspace'));
  exclusiveJson(path.join(dir, EXTENSION_ADMISSION_FILE), { version: EXT.version, grantSha256: args.grantSha, ownerApproval: admitted.grant.ownerApproval,
    revalidation: admitted.grant.revalidation, held: admitted.grant.held, recovery: admitted.grant.recovery, ledger, preview, rereviewOutcome: admitted.outcome });
  exclusiveJson(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE), admitted.extension);
  exclusiveJson(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE), admitted.planned.recoveryRecord);
  exclusiveJson(path.join(dir, CONTINUATION_DIAGNOSIS_FILE), admitted.planned.diagnosisRecord);
  const api = new AuditionMeter(path.join(dir, 'paid-stages'), ledger.nextCapMicroUsd, EXT.apiCalls, ledger.bookKnownMicroUsd, 0, STORYBOARD_EXTENSION_RULES);
  const claudeMax = new SimpleBookBudget(path.join(dir, 'claude-max-stages'), 0);
  const key = keyReader(config.keyEnvFile);
  const responses = transports.responses ?? openAIResponses(key);
  let storyboardDraft: unknown = null, failed: string | null = null;
  const seen: string[] = [];
  const record = (error: unknown): never => { failed ??= codeOf(error, 'fresh_book_provider_transport'); throw error; };
  const guard = () => { try { admitted.guard(); } catch (error) { record(error); } };
  const extended = { parentStoryboardDigest: admitted.grant.held.storyboardDigest, addedContracts: [...EXT.addedContracts], attempt: EXT.maxAttempts };
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    exclusiveJson(path.join(dir, 'spend.json'), api.snapshot());
    exclusiveJson(path.join(dir, 'claude-max-spend.json'), { ...claudeMax.snapshot(), note: 'Claude Max usage is separate: not an API invoice' });
    exclusiveJson(path.join(dir, 'sealed.json'), { status, ...extra, extended, replayed: [...seen], runtimeEligible: false });
  };
  try {
    const result = await storyboardRepairFlow({ config, repair: admitted.extension, signal, log: args.log, seen, spec: EXTENSION_SPEC,
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
    const board = result.storyboard ?? fail('fresh_book_storyboard_extension_policy');
    const final = continuationRecoveryFinal(admitted.planned.recoveryRecord, { storyboardDigest: board.storyboardDigest, status: result.status, review: board.review }, EXT.folder);
    exclusiveJson(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE), final);
    if (!admittedExtension(result.status)) finish(env, EXT.ownHeldOutcome, { textStatus: result.status, recovery: final.terminal }, EXT.outcomeName);
    else {
      // The successor's ONE durable provenance: its whole chain replayed from the saved evidence, then recorded once under a fresh guard.
      const successor = await deriveStoryboardExtensionSuccessor({ config, env, grantSha: args.grantSha, admitted });
      guard();
      exclusiveJson(path.join(env.authorityRoot, EXT.successorName), successor);
      admitted.recapture([`authority/${EXT.successorName}`]);
    }
    return { status: result.status, recovery: final, api: api.snapshot(), claudeMax: claudeMax.snapshot(),
      ledger: freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_extension') };
  } catch (error) {
    const code = failed ?? codeOf(error, 'fresh_book_storyboard_extension_failed');
    if (!existsSync(path.join(dir, 'sealed.json'))) seal('failed', { code });
    if (!existsSync(path.join(env.authorityRoot, EXT.outcomeName))) finish(env, 'failed_storyboard_extension', { code }, EXT.outcomeName);
    throw error;
  }
}

type ExtensionAdmitted = { grant: FreshBookStoryboardExtensionGrant; extension: StoryboardRepair; outcome: unknown;
  planned: Pick<Awaited<ReturnType<typeof planFreshBookStoryboardExtension>>, 'recoveryRecord' | 'diagnosisRecord'> };
/**
 * The extension's successor, re-derived from its saved evidence (never its own seal, summary or a re-captured folder): its seal and admission
 * are this grant's; its input is exactly the held revalidation's draft and raw review with the continuation input as ancestry, the claim basis,
 * the parent's compile and the owner's extension; its recovery state and diagnosis are the ones the engine derives now; its meters hold exactly
 * the one floored review and the one planner session; replaying the WHOLE chain (text, correction, planner, review) on the paid run's own code
 * path reproduces the saved admitted result exactly; its terminal recovery record is the reducer's state after that result.
 */
async function deriveStoryboardExtensionSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: ExtensionAdmitted }) {
  const { config, env } = a, grant = a.admitted.grant, dir = path.join(config.bookDir, EXT.folder);
  const refuse = (): never => fail('fresh_book_storyboard_extension_successor');
  try {
    const seal = json(path.join(dir, 'sealed.json'));
    if (!sortedSame(Object.keys(seal), ['extended', 'replayed', 'runtimeEligible', 'status']) || !admittedExtension(seal.status) || seal.runtimeEligible !== false ||
        !sameJson(seal.extended, { parentStoryboardDigest: grant.held.storyboardDigest, addedContracts: [...EXT.addedContracts], attempt: EXT.maxAttempts }) ||
        !Array.isArray(seal.replayed) || !sortedSame(seal.replayed, REPAIR_REPLAYED)) refuse();
    const admission = json(path.join(dir, EXTENSION_ADMISSION_FILE));
    if (!sortedSame(Object.keys(admission), ['grantSha256', 'held', 'ledger', 'ownerApproval', 'preview', 'recovery', 'rereviewOutcome', 'revalidation', 'version']) ||
        admission.version !== EXT.version || admission.grantSha256 !== a.grantSha || !sameJson(admission.ownerApproval, grant.ownerApproval) ||
        !sameJson(admission.revalidation, grant.revalidation) || !sameJson(admission.held, grant.held) || !sameJson(admission.recovery, grant.recovery) ||
        !sameJson(admission.rereviewOutcome, a.admitted.outcome) || admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd ||
        admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd) refuse();
    if (!sameJson(json(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE)), plainJson(a.admitted.extension)) ||
        !sameJson(json(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE)), plainJson(a.admitted.planned.recoveryRecord)) ||
        !sameJson(json(path.join(dir, CONTINUATION_DIAGNOSIS_FILE)), plainJson(a.admitted.planned.diagnosisRecord)) ||
        previewSha(canonicalJson(json(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE)))) !== grant.recovery.stateSha256) refuse();
    // The admitted preview is this extension's own planner request: re-derived now, and the paid planner session claimed exactly that wire.
    const preview = await previewFreshBookStoryboardExtension(config, a.admitted.extension);
    if (!sameJson(admission.preview, preview) || preview.findings !== grant.held.findings || preview.diagnosisDigest !== grant.recovery.diagnosisDigest ||
        json(path.join(dir, 'claude-max-stages', 'storyboard.claim.json')).wireDigest !== preview.wireDigest) refuse();
    const reviewed = verifyMeterRecords(path.join(dir, 'paid-stages'), STORYBOARD_EXTENSION_RULES);
    if (reviewed.length !== 1 || reviewed[0].claim.step !== 'storyboard_review' || reviewed[0].result?.completed !== true ||
        !(reviewed[0].claim.maximumMicroUsd >= REVIEW_RESERVE_FLOOR_MICRO_USD)) refuse();
    if (!sameJson(readdirSync(path.join(dir, 'claude-max-stages')).filter(n => n.endsWith('.claim.json')), ['storyboard.claim.json'])) refuse();
    const seen: string[] = [];
    const replayed = await storyboardRepairFlow({ config, repair: a.admitted.extension, signal: new AbortController().signal, log: () => {}, seen,
      spec: EXTENSION_SPEC, replayDir: dir });
    const saved = json(path.join(dir, 'simple-book-result.json')), board = replayed.storyboard;
    if (!board) return refuse();
    if (!sameJson(seal.replayed, seen.filter(k => !ownCalls(EXTENSION_SPEC).includes(k))) || !admittedExtension(replayed.status) || replayed.status !== seal.status ||
        !sameJson(plainJson(replayed), saved) || !sameJson(json(path.join(dir, 'visual_simple_book_result.json')), saved) ||
        !sameJson(json(path.join(dir, 'owned_storyboard_draft.json')), json(path.join(dir, 'claude-max-stages', 'storyboard.receipt.json')).output)) refuse();
    const final = continuationRecoveryFinal(a.admitted.planned.recoveryRecord, { storyboardDigest: board.storyboardDigest, status: replayed.status, review: board.review },
      EXT.folder);
    if (!sameJson(json(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE)), plainJson(final))) refuse();
    return { cycle: FRESH_BOOK_CYCLE.id, storyboardExtension: EXT.version, grantSha256: a.grantSha, ownerApprovalSha256: grant.ownerApproval.sha256,
      originalClaimSha256: grant.revalidation.originalClaimSha256, recoveryClaimSha256: grant.revalidation.recoveryClaimSha256,
      repairClaimSha256: grant.revalidation.repairClaimSha256, continuationClaimSha256: grant.revalidation.continuationClaimSha256,
      revalidationClaimSha256: grant.revalidation.claimSha256, extensionClaimSha256: previewSha(fileBytes(path.join(env.authorityRoot, EXT.claimName))),
      parentStoryboardDigest: grant.held.storyboardDigest, storyboardDigest: board.storyboardDigest, reviewDigest: board.review.reviewDigest,
      disposition: replayed.status, notes: board.review.impact?.notes.length ?? 0, reviewReserveMicroUsd: reviewed[0].claim.maximumMicroUsd as number,
      recoveryStateSha256: grant.recovery.stateSha256, diagnosisDigest: grant.recovery.diagnosisDigest,
      recoveryFinalSha256: previewSha(canonicalJson(final)), successorSha256: previewSha(canonicalJson(folderBaseline(dir))) };
  } catch { return refuse(); }
}
/** At every downstream entry: the extension's successor re-derived now must equal its one durable record. */
async function verifyStoryboardExtensionSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: ExtensionAdmitted }) {
  const record = await deriveStoryboardExtensionSuccessor(a), file = path.join(a.env.authorityRoot, EXT.successorName);
  if (!existsSync(file) || !sameJson(json(file), record)) fail('fresh_book_storyboard_extension_successor');
  return record;
}

// ---------------------------------------------------------------------------------------------------------------
// The bound extension revalidation (same owner record, same allowance, 2026-10-20): the extension's ONE paid planner answer, refused at compile
// by the strict claim-basis staging check before its review, compiled under storyboard-claim-basis-staging-fields/v1 and given the ONE unspent
// review. Still attempt 4 of 4: held ends the line (no attempt 5).
// ---------------------------------------------------------------------------------------------------------------
const XREVAL = FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION;
/** The extension revalidation folder's own admission record (beside its input and its terminal recovery record). */
export const EXTENSION_REVALIDATION_ADMISSION_FILE = 'extension-revalidation-admission.json';
const admittedExtensionRevalidation = (status: unknown) => (XREVAL.admittedStatuses as readonly unknown[]).includes(status);
/** The extension revalidation's shape on the shared flow: the extension's contracts, NO planner call (the extension's paid one is replayed), both corrections. */
const EXTENSION_REVALIDATION_SPEC: ReplanSpec = Object.freeze({ folder: XREVAL.folder, contracts: EXTENSION_SPEC.contracts, rules: STORYBOARD_EXTENSION_RULES,
  plannerFrom: EXT.folder, compile: { selfCheckNames: true as const, stagingFields: true as const } });
/** The seal's binding of what was revalidated: the consumed extension's grant, its paid planner wire, the candidate and the compile corrections. */
const extensionRevalidatedOf = (grant: FreshBookStoryboardExtensionRevalidationGrant) => ({ extensionGrantSha256: grant.extension.grantSha256,
  plannerWireDigest: grant.extension.plannerWireDigest, candidateStoryboardDigest: grant.candidate.storyboardDigest, compile: [...grant.compile] });

/**
 * The consumed extension and its compile refusal the extension revalidation stands on, re-read exactly: the extension grant its claim names
 * (naming the revalidation, continuation, repair, recovery and original claims, at the extension grant's own head) and the owner's record it
 * binds (its bytes and its verbatim line); the WHOLE earlier authority that grant consumed, re-derived by the extension line's own verifiers
 * (revalidationHeld, extensionRecovery) and equal to what it recorded; its terminal record and seal are exactly this refusal
 * (failed_storyboard_extension / storyboard_claim_basis_staging_ref) with no successor, audition or terminal recovery record; its admission,
 * input, recovery state and diagnosis are the engine's (its rereview outcome and its planner preview re-derived now); its API meter holds NO
 * call (refused before its review) and its planner meter exactly the one settled session, whose claimed wire is the request the engine rebuilds
 * for that extension now. The paid answer is that session's own output. The refusal reproduces: the strict compile (the extension's own,
 * storyboard-self-check-names/v1) refuses the answer with exactly the recorded code, and the corrected compile
 * (+ storyboard-claim-basis-staging-fields/v1) admits it, every staged plan direction field recorded (at least one: otherwise there was nothing
 * to correct). The ledger it stands on is the stages before it.
 */
async function extensionFailed(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, loaded: ReturnType<typeof loadProfile>,
  extensionGrantFile: string) {
  const { profile, prepared, options } = loaded, refuse = (): never => fail('fresh_book_storyboard_extension_revalidation_extension');
  if (!path.isAbsolute(extensionGrantFile)) refuse();
  const at = (name: string) => path.join(env.authorityRoot, name), dir = path.join(config.bookDir, EXT.folder);
  const maxDir = path.join(dir, 'claude-max-stages'), paidDir = path.join(dir, 'paid-stages');
  const files = { grant: extensionGrantFile, claim: at(EXT.claimName), outcome: at(EXT.outcomeName), seal: path.join(dir, 'sealed.json'),
    revalidationClaim: at(REVAL.claimName), continuationClaim: at(CONT.claimName), repairClaim: at(FRESH_BOOK_STORYBOARD_REPAIR.claimName),
    recoveryClaim: at(FRESH_BOOK_RECOVERY.claimName), originalClaim: at(FRESH_BOOK_CYCLE.claimName), plannerReceipt: path.join(maxDir, 'storyboard.receipt.json') };
  if (Object.values(files).some(f => !existsSync(f)) || existsSync(at(EXT.successorName)) || existsSync(at(EXT.auditionStartName)) ||
      existsSync(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE))) refuse();
  const digest = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, previewSha(fileBytes(f))])) as Record<keyof typeof files, string>;
  const parsed = freshBookStoryboardExtensionGrantSchema.safeParse(json(files.grant));
  if (!parsed.success) return refuse();
  const grant = parsed.data, claim = json(files.claim), outcome = json(files.outcome), seal = json(files.seal);
  const sameDir = (p: unknown) => typeof p === 'string' && path.resolve(p).toLowerCase() === path.resolve(config.bookDir).toLowerCase();
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardExtension !== EXT.version || claim.grantSha256 !== digest.grant ||
      claim.ownerApprovalSha256 !== grant.ownerApproval.sha256 ||
      claim.revalidationClaimSha256 !== digest.revalidationClaim || grant.revalidation.claimSha256 !== digest.revalidationClaim ||
      claim.continuationClaimSha256 !== digest.continuationClaim || grant.revalidation.continuationClaimSha256 !== digest.continuationClaim ||
      claim.repairClaimSha256 !== digest.repairClaim || grant.revalidation.repairClaimSha256 !== digest.repairClaim ||
      claim.recoveryClaimSha256 !== digest.recoveryClaim || grant.revalidation.recoveryClaimSha256 !== digest.recoveryClaim ||
      claim.originalClaimSha256 !== digest.originalClaim || grant.revalidation.originalClaimSha256 !== digest.originalClaim || claim.engineHead !== grant.engine.head ||
      !sameDir(claim.bookDir) || !sameDir(grant.bookDir) || grant.profileSha256 !== freshBookProfileSha(profile) || claim.profileSha256 !== grant.profileSha256) refuse();
  // The owner's record the extension bound: its bytes at that digest, with its verbatim line.
  const approval = ownerApproval(grant.ownerApproval.file);
  if (approval.sha256 !== grant.ownerApproval.sha256 || approval.file !== path.resolve(grant.ownerApproval.file)) refuse();
  // The whole earlier authority the extension consumed, re-derived by the extension line's own verifiers, must be exactly what its grant recorded.
  let held: Awaited<ReturnType<typeof revalidationHeld>>;
  try { held = await revalidationHeld(config, env, rereview, loaded, grant.revalidation.grantFile); }
  catch (error) { if (error instanceof FreshBookError) throw error; return refuse(); }
  const input = extensionInput(held, grant.ownerApproval.sha256), derived = extensionRecovery(config, loaded, held, input);
  if (!sameJson(held.revalidation, grant.revalidation) || !sameJson(held.held, grant.held) || !sameJson(held.ledger, grant.ledger) ||
      !sameJson(grant.recovery, { version: STAGE_RECOVERY_VERSION, attempts: derived.record.attempts.length, maxAttempts: derived.record.maxAttempts,
        consecutiveFailures: derived.record.consecutiveFailures, mode: derived.record.mode, stateSha256: derived.stateSha256,
        diagnosisDigest: derived.diagnosisDigest, contextDigest: derived.contextDigest })) refuse();
  // Its terminal record and seal: exactly this refusal, after the five replays, before any review.
  if (!sortedSame(Object.keys(outcome), ['code', 'cycle', 'finishedAt', 'status']) || outcome.cycle !== FRESH_BOOK_CYCLE.id ||
      outcome.status !== XREVAL.failedOutcome || outcome.code !== XREVAL.failedCode) refuse();
  if (!sortedSame(Object.keys(seal), ['code', 'extended', 'replayed', 'runtimeEligible', 'status']) || seal.status !== 'failed' || seal.code !== XREVAL.failedCode ||
      seal.runtimeEligible !== false || !sameJson(seal.extended, { parentStoryboardDigest: grant.held.storyboardDigest, addedContracts: [...EXT.addedContracts],
        attempt: EXT.maxAttempts }) || !Array.isArray(seal.replayed) || !sortedSame(seal.replayed, REPAIR_REPLAYED)) refuse();
  // Its admission and records: this grant's; the input, recovery state and diagnosis the engine derives now.
  const admission = json(path.join(dir, EXTENSION_ADMISSION_FILE));
  if (!sortedSame(Object.keys(admission), ['grantSha256', 'held', 'ledger', 'ownerApproval', 'preview', 'recovery', 'revalidation', 'rereviewOutcome', 'version']) ||
      admission.version !== EXT.version || admission.grantSha256 !== digest.grant || !sameJson(admission.ownerApproval, grant.ownerApproval) ||
      !sameJson(admission.revalidation, grant.revalidation) || !sameJson(admission.held, grant.held) || !sameJson(admission.recovery, grant.recovery) ||
      admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd || admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd ||
      !sameJson(admission.rereviewOutcome, await assertFreshBookAdmission(rereview, env))) refuse();
  if (!sameJson(json(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE)), plainJson(input)) ||
      !sameJson(json(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE)), plainJson(derived.record)) ||
      !sameJson(json(path.join(dir, CONTINUATION_DIAGNOSIS_FILE)), plainJson(derived.diagnosisRecord))) refuse();
  // Its meters: NO API claim (refused before its review); exactly the one settled planner session, accounted in its own spend records.
  if (existsSync(paidDir) && readdirSync(paidDir).length) refuse();
  if (!sameJson(readdirSync(maxDir).sort(), ['storyboard.claim.json', 'storyboard.receipt.json', 'storyboard.result.json', 'storyboard.wire.json'])) refuse();
  const plannerClaim = json(path.join(maxDir, 'storyboard.claim.json')), plannerWire = json(path.join(maxDir, 'storyboard.wire.json'));
  const plannerResult = json(path.join(maxDir, 'storyboard.result.json')), receipt = json(files.plannerReceipt);
  const spend = json(path.join(dir, 'spend.json')), maxSpend = json(path.join(dir, 'claude-max-spend.json'));
  if (plannerClaim.step !== 'storyboard' || previewSha(canonicalJson(plannerWire)) !== plannerClaim.wireDigest || plannerResult.wireDigest !== plannerClaim.wireDigest ||
      plannerResult.completed !== true || !Number.isSafeInteger(plannerResult.estimatedMicroUsd) || plannerResult.estimatedMicroUsd < 0 ||
      receipt.estimatedMicroUsd !== plannerResult.estimatedMicroUsd) refuse();
  if (spend.calls !== 0 || spend.newKnownApiMicroUsd !== 0 || spend.reservedUnsettledMicroUsd !== 0 || spend.unknownCost || spend.unknownOutcome ||
      maxSpend.accountedMicroUsd !== plannerResult.estimatedMicroUsd || maxSpend.knownEstimateMicroUsd !== plannerResult.estimatedMicroUsd ||
      maxSpend.unknownAttemptCosts !== 0 || maxSpend.logicalAttempts !== 1) refuse();
  // The paid session claimed exactly the request the engine rebuilds for that extension now (its admitted preview, re-derived).
  const preview = await previewFreshBookStoryboardExtension(config, input);
  if (!sameJson(admission.preview, preview) || plannerClaim.wireDigest !== preview.wireDigest) refuse();
  // The refusal reproduces on the paid answer, and the corrected compile admits that same answer.
  const draft = receipt.output, c = FRESH_BOOK_CONTRACTS;
  const sourceOf = () => prepareCurrentPersonalStoryboard(prepared.accepted.canonical, held.failed.source, options, c.actorOwnedAppearance, c.momentContract,
    c.landmarkKindContract, undefined, c.sceneLocationContract, c.compilerRulesContract, input, c.drawnInstantContract, true, true, true, true);
  let strict: unknown = null;
  try { compilePersonalStoryboard(sourceOf(), structuredClone(draft), { selfCheckNames: true }); } catch (error) { strict = error; }
  if (codeOf(strict, '') !== XREVAL.failedCode) refuse();
  let book: ReturnType<typeof compilePersonalStoryboard>;
  try { book = compilePersonalStoryboard(sourceOf(), structuredClone(draft), { selfCheckNames: true, stagingFields: true }); } catch { return refuse(); }
  const checked = book.selfCheck ?? refuse(), stagedFields = stagedPlanFields(book.moments ?? refuse());
  if (book.stagingFields !== CLAIM_BASIS_STAGING_FIELDS_VERSION || book.selfCheckNames !== STORYBOARD_SELF_CHECK_NAMES_VERSION || !stagedFields.length) refuse();
  const before = freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env),
    stages: bookStages(config.bookDir, 'storyboard_extension').slice(0, 6) });
  return { extension: { grantFile: path.resolve(extensionGrantFile), grantSha256: digest.grant, claimSha256: digest.claim, outcomeSha256: digest.outcome,
      sealSha256: digest.seal, folderSha256: previewSha(canonicalJson(folderBaseline(dir))), plannerReceiptSha256: digest.plannerReceipt,
      plannerWireDigest: plannerClaim.wireDigest as string, plannerMaxMicroUsd: plannerResult.estimatedMicroUsd as number,
      revalidationClaimSha256: digest.revalidationClaim, continuationClaimSha256: digest.continuationClaim, repairClaimSha256: digest.repairClaim,
      recoveryClaimSha256: digest.recoveryClaim, originalClaimSha256: digest.originalClaim },
    candidate: { sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest, draftSha256: previewSha(canonicalJson(draft)),
      claims: checked.frames.reduce((n, f) => n + f.claims.length, 0), resolutions: checked.resolutions.length, stagedFields },
    recovery: { attempt: derived.record.next.attempt, maxAttempts: derived.record.maxAttempts, stateSha256: derived.stateSha256, diagnosisDigest: derived.diagnosisDigest },
    ledger: { diagnosticSettledMicroUsd: before.diagnosticSettledMicroUsd, bookKnownMicroUsd: before.bookKnownMicroUsd,
      calls: before.stages.reduce((n, s) => n + s.calls, 0) },
    ownerApproval: { file: approval.file, sha256: approval.sha256 }, input, recoveryRecord: derived.record, diagnosisRecord: derived.diagnosisRecord,
    source: held.failed.source };
}

/** Provider-free plan and the extension revalidation grant this exact state needs (no key, no provider, no write). */
export async function planFreshBookStoryboardExtensionRevalidation(config: FreshBookConfig, env: FreshBookEnv, extensionGrantFile: string) {
  const base = planFreshBook(config, env), loaded = loadProfile(config);
  const failed = await extensionFailed(config, env, base.rereview, loaded, extensionGrantFile);
  const at = (name: string) => path.join(env.authorityRoot, name);
  const plan = { version: XREVAL.version, cycle: FRESH_BOOK_CYCLE.id, amendment: XREVAL.amendment, ownerApproval: failed.ownerApproval,
    basePlanSha256: base.grantDraft.nativePlanSha256, bookDir: path.resolve(config.bookDir), folder: XREVAL.folder, storyboardDir: XREVAL.folder,
    replay: { calls: [...REPAIR_REPLAYED, ...borrowedCalls(EXTENSION_REVALIDATION_SPEC)],
      from: 'the failed text, the recovery and the extension\'s ONE paid planner session (saved wires and receipts, byte-exact; the planner answer re-decoded from its own CLI output; no provider or model callback)' },
    extensionRevalidation: { refused: { outcome: XREVAL.failedOutcome, code: XREVAL.failedCode },
      compile: [STORYBOARD_SELF_CHECK_NAMES_VERSION, CLAIM_BASIS_STAGING_FIELDS_VERSION], candidate: failed.candidate,
      input: 'the extension\'s own saved input (the held attempt-3 draft and its exact raw review, with the continuation\'s input as ancestry, the claim basis, the parent\'s compile and the owner\'s extension), unchanged' },
    recovery: { reducer: STAGE_RECOVERY_VERSION, attempt: failed.recovery.attempt, maxAttempts: failed.recovery.maxAttempts, stateSha256: failed.recovery.stateSha256,
      diagnosisDigest: failed.recovery.diagnosisDigest, last: 'this reviews the stage\'s last attempt (4 of 4): held ends the line (stop_allowance_exhausted); no attempt 5' },
    calls: { planner: 'none: the extension\'s paid answer is replayed, never re-sent', review: `storyboard_review: Sol 6.1 (${SOL}), ${XREVAL.apiCalls}`,
      reviewReserve: `max(${REVIEW_RESERVE_FLOOR_MICRO_USD}, the bound its request derives); admission refuses before the claim below the floor, the meter before the key or provider below that maximum; journal and replay derive it under the same rule` },
    downstream: ['child --storyboard-extension-revalidation', 'book --storyboard-extension-revalidation [--resume]'],
    caps: { ...base.plan.caps, storyboardExtensionRevalidationApiCalls: XREVAL.apiCalls },
    claim: at(XREVAL.claimName), outcome: at(XREVAL.outcomeName), successor: at(XREVAL.successorName),
    successorAdmission: 'downstream replays the whole chain (text, correction, the borrowed paid planner answer, review) from the saved evidence and re-derives the refusal and the recovery records against its one durable record',
    providerCalls: 0, keyRead: false };
  const engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft: FreshBookStoryboardExtensionRevalidationGrant = freshBookStoryboardExtensionRevalidationGrantSchema.parse({
    version: 'fresh-book-storyboard-extension-revalidation-grant/v1', cycle: FRESH_BOOK_CYCLE.id, approval: FRESH_BOOK_CYCLE.approval, amendment: XREVAL.amendment,
    ownerApproval: failed.ownerApproval, profileSha256: base.plan.profileSha256, bookDir: path.resolve(config.bookDir), extension: failed.extension,
    candidate: failed.candidate, recovery: failed.recovery, ledger: failed.ledger,
    allowance: { plannerCalls: XREVAL.plannerCalls, apiCalls: XREVAL.apiCalls, reviewReserveFloorMicroUsd: XREVAL.reviewReserveFloorMicroUsd },
    compile: [STORYBOARD_SELF_CHECK_NAMES_VERSION, CLAIM_BASIS_STAGING_FIELDS_VERSION], engine: { head: engine.head, branch: engine.branch }, pins,
    nativePlanSha256: previewSha(canonicalJson(plan)) });
  const probe = (f: () => unknown) => { try { return f(); } catch (e) { return { refused: e && typeof e === 'object' && 'code' in e ? e.code : String(e) }; } };
  const state = { claimExists: existsSync(plan.claim), outcomeExists: existsSync(plan.outcome), successorExists: existsSync(plan.successor),
    folderExists: existsSync(path.join(config.bookDir, XREVAL.folder)),
    ledger: probe(() => freshBookLedger(config, env, base.rereview, 'storyboard_extension_revalidation')),
    reviewFloor: probe(() => assertReviewFloorFits(freshBookLedger(config, env, base.rereview, 'storyboard_extension_revalidation'))),
    executablePinned: probe(() => assertFreshBookExecutable(config)), engine };
  return { plan, grantDraft, state, profile: base.profile, prepared: loaded.prepared, options: loaded.options, rereview: base.rereview,
    input: failed.input, recoveryRecord: failed.recoveryRecord, diagnosisRecord: failed.diagnosisRecord };
}

/**
 * An extension-revalidation-line stage's admission, as admitStoryboardExtension: the baseline pinned FIRST and held across every await: its
 * grant bytes, the owner's record bytes, the consumed extension, revalidation, continuation, repair, recovery and original grants' bytes that
 * chain names (each at its recorded digest, never re-pinned to this head), configuration, profile, lineage, every line's authority records and
 * the earlier stage entries. The grant is exactly the draft this state rebuilds, at the clean reviewed head. Its guard adds its own claim and
 * every claim it names.
 */
async function admitStoryboardExtensionRevalidation(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  earlier: string[] }) {
  const bytes = fileBytes(a.grantFile);
  if (previewSha(bytes) !== a.grantSha) fail('fresh_book_storyboard_extension_revalidation_grant');
  const parsed = freshBookStoryboardExtensionRevalidationGrantSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success) return fail('fresh_book_storyboard_extension_revalidation_grant');
  const approvalFile = parsed.data.ownerApproval.file, approvalBytes = fileBytes(approvalFile);
  if (previewSha(approvalBytes) !== parsed.data.ownerApproval.sha256) fail('fresh_book_storyboard_extension_approval');
  const extFile = parsed.data.extension.grantFile, extBytes = fileBytes(extFile);
  if (previewSha(extBytes) !== parsed.data.extension.grantSha256) fail('fresh_book_storyboard_extension_revalidation_extension');
  let ext: FreshBookStoryboardExtensionGrant, reval: FreshBookStoryboardRevalidationGrant, cont: FreshBookStoryboardContinuationGrant,
    named: FreshBookStoryboardRepairGrant, recoveryGrant: FreshBookRecoveryGrant;
  try { ext = freshBookStoryboardExtensionGrantSchema.parse(JSON.parse(extBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_extension_revalidation_extension'); }
  const revalFile = ext.revalidation.grantFile, revalBytes = fileBytes(revalFile);
  if (previewSha(revalBytes) !== ext.revalidation.grantSha256) fail('fresh_book_storyboard_extension_revalidation');
  try { reval = freshBookStoryboardRevalidationGrantSchema.parse(JSON.parse(revalBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_extension_revalidation'); }
  const contFile = reval.continuation.grantFile, contBytes = fileBytes(contFile);
  if (previewSha(contBytes) !== reval.continuation.grantSha256) fail('fresh_book_storyboard_revalidation_continuation');
  try { cont = freshBookStoryboardContinuationGrantSchema.parse(JSON.parse(contBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_revalidation_continuation'); }
  const repairFile = cont.repair.grantFile, repairBytes = fileBytes(repairFile);
  if (previewSha(repairBytes) !== cont.repair.grantSha256) fail('fresh_book_storyboard_continuation_repair');
  try { named = freshBookStoryboardRepairGrantSchema.parse(JSON.parse(repairBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_continuation_repair'); }
  const recoveryFile = named.recovery.grantFile, recoveryBytes = fileBytes(recoveryFile);
  if (previewSha(recoveryBytes) !== named.recovery.grantSha256) fail('fresh_book_storyboard_repair_recovery');
  try { recoveryGrant = freshBookRecoveryGrantSchema.parse(JSON.parse(recoveryBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_repair_recovery'); }
  const originalFile = recoveryGrant.original.grantFile, originalBytes = fileBytes(originalFile);
  if (previewSha(originalBytes) !== recoveryGrant.original.grantSha256) fail('fresh_book_recovery_original');
  const rereview = loadRereview(a.config);
  let roots = rootsOf(a.config, a.env, rereview, a.earlier);
  const planned = await planFreshBookStoryboardExtensionRevalidation(a.config, a.env, extFile);
  const outcome = await assertFreshBookAdmission(planned.rereview, a.env);
  const engine = a.env.head();
  if (canonicalJson(parsed.data) !== canonicalJson(planned.grantDraft)) fail('fresh_book_storyboard_extension_revalidation_grant');
  if (!engine.clean || engine.head !== planned.grantDraft.engine.head || engine.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
  const frozen: [string, Buffer, string][] = [[a.grantFile, bytes, 'fresh_book_storyboard_extension_revalidation_grant'],
    [approvalFile, approvalBytes, 'fresh_book_storyboard_extension_approval'], [extFile, extBytes, 'fresh_book_storyboard_extension_revalidation_extension'],
    [revalFile, revalBytes, 'fresh_book_storyboard_extension_revalidation'], [contFile, contBytes, 'fresh_book_storyboard_revalidation_continuation'],
    [repairFile, repairBytes, 'fresh_book_storyboard_continuation_repair'], [recoveryFile, recoveryBytes, 'fresh_book_storyboard_repair_recovery'],
    [originalFile, originalBytes, 'fresh_book_recovery_original']];
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    for (const [file, held, code] of frozen) if (!fileBytes(file).equals(held)) fail(code);
    if (canonicalJson(rootsOf(a.config, a.env, rereview, a.earlier)) !== canonicalJson(roots)) fail('fresh_book_roots_changed');
    const e = a.env.head();
    if (!e.clean || e.head !== planned.grantDraft.engine.head || e.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(planned.grantDraft.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
  };
  const guard = () => { same(); assertFreshBookStoryboardExtensionRevalidationPaid({ env: a.env, grantFile: a.grantFile, grantSha: a.grantSha, profile: planned.profile,
    workspace: workspace() }); };
  const recapture = (added: string[]) => {
    const next = rootsOf(a.config, a.env, rereview, a.earlier), changed = Object.keys(next).filter(k => next[k] !== roots[k]);
    if (canonicalJson(Object.keys(next).sort()) !== canonicalJson(Object.keys(roots).sort()) || canonicalJson(changed.sort()) !== canonicalJson([...added].sort()) ||
        added.some(k => roots[k] !== 'absent' || next[k] === 'absent')) fail('fresh_book_roots_changed');
    roots = next; same();
  };
  same();
  return { planned, outcome, same, guard, recapture, grant: planned.grantDraft, extensionRevalidation: planned.input };
}

/**
 * Provider-free preview of the extension revalidation's ONE review request, on the paid run's own code path (the shared flow under its spec):
 * the text and the correction replayed, the extension's paid planner answer replayed under its own saved wire and re-decoded from its CLI
 * output, compiled under both corrections, then the review request built and measured (content limit, the floored reservation) and stopped
 * before any key or provider. The paid stage runs it before its claim; its payload digest binds the paid review's claim.
 */
export async function previewFreshBookStoryboardExtensionRevalidation(config: FreshBookConfig, input: StoryboardRepair): Promise<RevalidationPreview> {
  const out: { preview?: RevalidationPreview } = {};
  try {
    await storyboardRepairFlow({ config, repair: input, signal: new AbortController().signal, log: () => {}, seen: [], spec: EXTENSION_REVALIDATION_SPEC,
      reviewPreview: (payload, call) => {
        const reserve = STORYBOARD_EXTENSION_RULES('storyboard_review')!.reserve(payload);
        if (reserve === null || typeof call.context.storyboardDigest !== 'string') return fail('fresh_book_storyboard_extension_revalidation_preview');
        out.preview = { sourceDigest: call.context.sourceDigest, storyboardDigest: call.context.storyboardDigest,
          contentBytes: Buffer.byteLength(call.instructions, 'utf8') + Buffer.byteLength(call.input, 'utf8'), contentByteLimit: SIMPLE_STORYBOARD_INPUT_LIMIT,
          payloadBytes: Buffer.byteLength(JSON.stringify(payload), 'utf8'), payloadDigest: previewSha(canonicalJson(payload)), reviewReserveMicroUsd: reserve,
          reviewFloorMicroUsd: REVIEW_RESERVE_FLOOR_MICRO_USD, maxOutputTokens: call.maxOutputTokens, model: String(payload.model),
          instructionsSha256: previewSha(call.instructions), inputSha256: previewSha(call.input) };
        return fail('fresh_book_storyboard_extension_revalidation_preview_complete');
      } });
  } catch (error) { if (!out.preview) throw error; }
  return out.preview ?? fail('fresh_book_storyboard_extension_revalidation_preview');
}

/**
 * The bound extension revalidation of the same book: admission re-derives the refused extension and its whole lineage exactly (the refusal
 * reproduced on the paid answer, the corrected compile admitting it), the balance must cover the review's floor and the review request must be
 * sendable and name exactly the admitted candidate; then one claim and its own folder with its admission and input; the text, the correction
 * and the extension's paid planner answer are replayed (no planner call), and the ONE Sol review runs on the native call site (max(600000, its
 * bound)). Admitted: its successor is re-derived by replaying the whole chain and recorded once. Held: its terminal outcome (attempt 4 of 4;
 * no attempt 5). Failed: its terminal outcome. Nothing earlier is written.
 */
export async function runFreshBookStoryboardExtensionRevalidation(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string;
  signal: AbortSignal; log: (line: string) => void; transports?: Pick<FreshTextTransports, 'responses'> }) {
  const { config, env, signal } = args, transports = args.transports ?? {};
  const admitted = await admitStoryboardExtensionRevalidation({ ...args, earlier: ['request.json', 'admission.json', 'text', FRESH_BOOK_RECOVERY.folder,
    FRESH_BOOK_STORYBOARD_REPAIR.folder, CONT.folder, REVAL.folder, EXT.folder] });
  assertFreshBookExecutable(config);
  const ledger = freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_extension_revalidation'), dir = path.join(config.bookDir, XREVAL.folder);
  if (existsSync(dir)) fail('fresh_book_storyboard_extension_revalidation_used');
  const floor = assertReviewFloorFits(ledger, 'fresh_book_storyboard_extension_revalidation_budget');
  // Before the claim: the exact review request must be sendable, within the balance, and name exactly the admitted candidate.
  const preview = await previewFreshBookStoryboardExtensionRevalidation(config, admitted.extensionRevalidation);
  if (preview.sourceDigest !== admitted.grant.candidate.sourceDigest || preview.storyboardDigest !== admitted.grant.candidate.storyboardDigest ||
      preview.contentBytes > preview.contentByteLimit || preview.reviewReserveMicroUsd > floor.remainingMicroUsd) fail('fresh_book_storyboard_extension_revalidation_preview');
  // No await from the last check to the one claim and its folder.
  admitted.same();
  claimFreshBookStoryboardExtensionRevalidation(env, admitted.grant, args.grantSha);
  admitted.recapture([`authority/${XREVAL.claimName}`]);
  try { mkdirSync(dir); } catch { fail('fresh_book_storyboard_extension_revalidation_used'); }
  exclusiveJson(path.join(dir, EXTENSION_REVALIDATION_ADMISSION_FILE), { version: XREVAL.version, grantSha256: args.grantSha, ownerApproval: admitted.grant.ownerApproval,
    extension: admitted.grant.extension, candidate: admitted.grant.candidate, recovery: admitted.grant.recovery, ledger, preview, rereviewOutcome: admitted.outcome });
  exclusiveJson(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE), admitted.extensionRevalidation);
  const api = new AuditionMeter(path.join(dir, 'paid-stages'), ledger.nextCapMicroUsd, XREVAL.apiCalls, ledger.bookKnownMicroUsd, 0, STORYBOARD_EXTENSION_RULES);
  const key = keyReader(config.keyEnvFile);
  const responses = transports.responses ?? openAIResponses(key);
  let storyboardDraft: unknown = null, failed: string | null = null;
  const seen: string[] = [];
  const record = (error: unknown): never => { failed ??= codeOf(error, 'fresh_book_provider_transport'); throw error; };
  const guard = () => { try { admitted.guard(); } catch (error) { record(error); } };
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    exclusiveJson(path.join(dir, 'spend.json'), api.snapshot());
    exclusiveJson(path.join(dir, 'sealed.json'), { status, ...extra, extensionRevalidated: extensionRevalidatedOf(admitted.grant), replayed: [...seen],
      runtimeEligible: false });
  };
  try {
    const result = await storyboardRepairFlow({ config, repair: admitted.extensionRevalidation, signal, log: args.log, seen, spec: EXTENSION_REVALIDATION_SPEC,
      live: { dir, api, responses, guard, record, draft: d => { storyboardDraft = d; } } });
    guard();
    exclusiveJson(path.join(dir, 'simple-book-result.json'), result);
    exclusiveText(path.join(dir, 'story.md'), `# ${result.source.manuscript.title}\n\n` +
      result.source.manuscript.pages.map(p => `## עמוד ${p.pageNumber}\n\n${p.text}`).join('\n\n') + '\n');
    if (result.storyboard) {
      exclusiveJson(path.join(dir, 'visual_simple_book_result.json'), result);
      exclusiveJson(path.join(dir, 'owned_storyboard_draft.json'), storyboardDraft ?? fail('fresh_book_draft_missing'));
    }
    seal(result.status);
    const board = result.storyboard ?? fail('fresh_book_storyboard_extension_revalidation_policy');
    const final = continuationRecoveryFinal(admitted.planned.recoveryRecord, { storyboardDigest: board.storyboardDigest, status: result.status, review: board.review },
      XREVAL.folder);
    exclusiveJson(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE), final);
    if (!admittedExtensionRevalidation(result.status)) finish(env, XREVAL.ownHeldOutcome, { textStatus: result.status, recovery: final.terminal }, XREVAL.outcomeName);
    else {
      // The successor's ONE durable provenance: its whole chain replayed from the saved evidence, then recorded once under a fresh guard.
      const successor = await deriveStoryboardExtensionRevalidationSuccessor({ config, env, grantSha: args.grantSha, admitted });
      guard();
      exclusiveJson(path.join(env.authorityRoot, XREVAL.successorName), successor);
      admitted.recapture([`authority/${XREVAL.successorName}`]);
    }
    return { status: result.status, recovery: final, api: api.snapshot(),
      ledger: freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_extension_revalidation') };
  } catch (error) {
    const code = failed ?? codeOf(error, 'fresh_book_storyboard_extension_revalidation_failed');
    if (!existsSync(path.join(dir, 'sealed.json'))) seal('failed', { code });
    if (!existsSync(path.join(env.authorityRoot, XREVAL.outcomeName))) finish(env, 'failed_storyboard_extension_revalidation', { code }, XREVAL.outcomeName);
    throw error;
  }
}

type ExtensionRevalidationAdmitted = { grant: FreshBookStoryboardExtensionRevalidationGrant; extensionRevalidation: StoryboardRepair; outcome: unknown;
  planned: Pick<Awaited<ReturnType<typeof planFreshBookStoryboardExtensionRevalidation>>, 'recoveryRecord'> };
/**
 * The extension revalidation's successor, re-derived from its saved evidence (never its own seal, summary or a re-captured folder): its seal
 * and admission are this grant's; its input is exactly the extension's; its review request is the one the engine rebuilds now (the paid claim's
 * wire); its meters hold exactly the one floored review and NO planner session; replaying the WHOLE chain (text, correction, the borrowed paid
 * planner answer, review) on the paid run's own code path reproduces the saved admitted result exactly; its draft is the extension's paid
 * answer; its terminal recovery record is the reducer's state after that result. Returns the ONE durable record.
 */
async function deriveStoryboardExtensionRevalidationSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string;
  admitted: ExtensionRevalidationAdmitted }) {
  const { config, env } = a, grant = a.admitted.grant, dir = path.join(config.bookDir, XREVAL.folder);
  const refuse = (): never => fail('fresh_book_storyboard_extension_revalidation_successor');
  try {
    const seal = json(path.join(dir, 'sealed.json'));
    if (!sortedSame(Object.keys(seal), ['extensionRevalidated', 'replayed', 'runtimeEligible', 'status']) || !admittedExtensionRevalidation(seal.status) ||
        seal.runtimeEligible !== false || !sameJson(seal.extensionRevalidated, extensionRevalidatedOf(grant)) || !Array.isArray(seal.replayed) ||
        !sortedSame(seal.replayed, [...REPAIR_REPLAYED, ...borrowedCalls(EXTENSION_REVALIDATION_SPEC)])) refuse();
    const admission = json(path.join(dir, EXTENSION_REVALIDATION_ADMISSION_FILE));
    if (!sortedSame(Object.keys(admission), ['candidate', 'extension', 'grantSha256', 'ledger', 'ownerApproval', 'preview', 'recovery', 'rereviewOutcome', 'version']) ||
        admission.version !== XREVAL.version || admission.grantSha256 !== a.grantSha || !sameJson(admission.ownerApproval, grant.ownerApproval) ||
        !sameJson(admission.extension, grant.extension) || !sameJson(admission.candidate, grant.candidate) || !sameJson(admission.recovery, grant.recovery) ||
        !sameJson(admission.rereviewOutcome, a.admitted.outcome) || admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd ||
        admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd) refuse();
    if (!sameJson(json(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE)), plainJson(a.admitted.extensionRevalidation))) refuse();
    // The admitted preview is this line's own review request: re-derived now, and the paid review claimed exactly that wire.
    const preview = await previewFreshBookStoryboardExtensionRevalidation(config, a.admitted.extensionRevalidation);
    const reviewed = verifyMeterRecords(path.join(dir, 'paid-stages'), STORYBOARD_EXTENSION_RULES);
    if (!sameJson(admission.preview, preview) || preview.storyboardDigest !== grant.candidate.storyboardDigest || reviewed.length !== 1 ||
        reviewed[0].claim.step !== 'storyboard_review' || reviewed[0].result?.completed !== true || reviewed[0].claim.wireDigest !== preview.payloadDigest ||
        !(reviewed[0].claim.maximumMicroUsd >= REVIEW_RESERVE_FLOOR_MICRO_USD) || existsSync(path.join(dir, 'claude-max-stages'))) refuse();
    const seen: string[] = [];
    const replayed = await storyboardRepairFlow({ config, repair: a.admitted.extensionRevalidation, signal: new AbortController().signal, log: () => {}, seen,
      spec: EXTENSION_REVALIDATION_SPEC, replayDir: dir });
    const saved = json(path.join(dir, 'simple-book-result.json')), board = replayed.storyboard;
    if (!board) return refuse();
    if (!sameJson(seal.replayed, seen.filter(k => !ownCalls(EXTENSION_REVALIDATION_SPEC).includes(k))) || !admittedExtensionRevalidation(replayed.status) ||
        replayed.status !== seal.status || board.storyboardDigest !== grant.candidate.storyboardDigest ||
        !sameJson(plainJson(replayed), saved) || !sameJson(json(path.join(dir, 'visual_simple_book_result.json')), saved) ||
        !sameJson(json(path.join(dir, 'owned_storyboard_draft.json')), json(path.join(config.bookDir, EXT.folder, 'claude-max-stages', 'storyboard.receipt.json')).output)) refuse();
    const final = continuationRecoveryFinal(a.admitted.planned.recoveryRecord, { storyboardDigest: board.storyboardDigest, status: replayed.status, review: board.review },
      XREVAL.folder);
    if (!sameJson(json(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE)), plainJson(final))) refuse();
    return { cycle: FRESH_BOOK_CYCLE.id, storyboardExtensionRevalidation: XREVAL.version, grantSha256: a.grantSha, ownerApprovalSha256: grant.ownerApproval.sha256,
      originalClaimSha256: grant.extension.originalClaimSha256, recoveryClaimSha256: grant.extension.recoveryClaimSha256,
      repairClaimSha256: grant.extension.repairClaimSha256, continuationClaimSha256: grant.extension.continuationClaimSha256,
      revalidationClaimSha256: grant.extension.revalidationClaimSha256, extensionClaimSha256: grant.extension.claimSha256,
      extensionRevalidationClaimSha256: previewSha(fileBytes(path.join(env.authorityRoot, XREVAL.claimName))), plannerWireDigest: grant.extension.plannerWireDigest,
      storyboardDigest: board.storyboardDigest, reviewDigest: board.review.reviewDigest, disposition: replayed.status, notes: board.review.impact?.notes.length ?? 0,
      reviewReserveMicroUsd: reviewed[0].claim.maximumMicroUsd as number, recoveryStateSha256: grant.recovery.stateSha256, diagnosisDigest: grant.recovery.diagnosisDigest,
      recoveryFinalSha256: previewSha(canonicalJson(final)), successorSha256: previewSha(canonicalJson(folderBaseline(dir))) };
  } catch { return refuse(); }
}
/** At every downstream entry: the extension revalidation's successor re-derived now must equal its one durable record. */
async function verifyStoryboardExtensionRevalidationSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string;
  admitted: ExtensionRevalidationAdmitted }) {
  const record = await deriveStoryboardExtensionRevalidationSuccessor(a), file = path.join(a.env.authorityRoot, XREVAL.successorName);
  if (!existsSync(file) || !sameJson(json(file), record)) fail('fresh_book_storyboard_extension_revalidation_successor');
  return record;
}

// ---------------------------------------------------------------------------------------------------------------
// The ONE owner-approved CALIBRATION attempt (corrected B, 2026-10-20): attempt 5 of 5 of the storyboard stage under storyboard-calibration/v1.
// ---------------------------------------------------------------------------------------------------------------
const CAL = FRESH_BOOK_STORYBOARD_CALIBRATION;
/** The calibration folder's own admission record (beside its input and its recovery records). */
export const CALIBRATION_ADMISSION_FILE = 'calibration-admission.json';
const admittedCalibration = (status: unknown) => (CAL.admittedStatuses as readonly unknown[]).includes(status);
/** The calibration's shape on the shared flow: the extension's contracts plus the calibration, compiled under both corrections, its own planner wire compacted. */
const CALIBRATION_SPEC: ReplanSpec = Object.freeze({ folder: CAL.folder,
  contracts: { selfCheckContract: true as const, reviewImpactPolicy: true as const, claimBasisContract: true as const, calibrationContract: true as const },
  rules: STORYBOARD_EXTENSION_RULES, compile: { selfCheckNames: true as const, stagingFields: true as const }, plannerSchema: CAL.plannerSchema });

/**
 * The consumed extension revalidation and the held storyboard the calibration stands on, re-read exactly: the extension-revalidation grant its
 * claim names (naming the extension, revalidation, continuation, repair, recovery and original claims, at that grant's own head); the WHOLE
 * earlier authority that grant consumed, re-derived by its own verifier (extensionFailed) and equal to what it recorded; its terminal record
 * and seal are its own review holding attempt 4 at the owner's ceiling (stop_allowance_exhausted) with no successor or audition; its admission,
 * input and admitted review preview are the engine's (re-derived now); its meter holds exactly the one floored review (the previewed payload)
 * and no planner session; its draft is the extension's paid answer; the held book is that answer compiled under both corrections to the bound
 * candidate; its raw review is the paid answer decoded for that book (whose paid request was exactly its review input) and re-judges to that
 * held disposition; its terminal recovery record is the reducer's derivation. The ledger it stands on is the stages through it.
 */
async function extensionRevalidationHeld(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, loaded: ReturnType<typeof loadProfile>,
  extensionRevalidationGrantFile: string) {
  const { profile, prepared, options } = loaded, refuse = (): never => fail('fresh_book_storyboard_calibration_extension_revalidation');
  if (!path.isAbsolute(extensionRevalidationGrantFile)) refuse();
  const at = (name: string) => path.join(env.authorityRoot, name), dir = path.join(config.bookDir, XREVAL.folder);
  const files = { grant: extensionRevalidationGrantFile, claim: at(XREVAL.claimName), outcome: at(XREVAL.outcomeName), seal: path.join(dir, 'sealed.json'),
    reviewReceipt: path.join(dir, 'paid-stages', 'storyboard_review.receipt.json'), recoveryFinal: path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE),
    extensionClaim: at(EXT.claimName), revalidationClaim: at(REVAL.claimName), continuationClaim: at(CONT.claimName),
    repairClaim: at(FRESH_BOOK_STORYBOARD_REPAIR.claimName), recoveryClaim: at(FRESH_BOOK_RECOVERY.claimName), originalClaim: at(FRESH_BOOK_CYCLE.claimName) };
  if (Object.values(files).some(f => !existsSync(f)) || existsSync(at(XREVAL.successorName)) || existsSync(at(XREVAL.auditionStartName))) refuse();
  const digest = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, previewSha(fileBytes(f))])) as Record<keyof typeof files, string>;
  const parsed = freshBookStoryboardExtensionRevalidationGrantSchema.safeParse(json(files.grant));
  if (!parsed.success) return refuse();
  const grant = parsed.data, claim = json(files.claim), outcome = json(files.outcome), seal = json(files.seal), x = grant.extension;
  const sameDir = (p: unknown) => typeof p === 'string' && path.resolve(p).toLowerCase() === path.resolve(config.bookDir).toLowerCase();
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardExtensionRevalidation !== XREVAL.version || claim.grantSha256 !== digest.grant ||
      claim.ownerApprovalSha256 !== grant.ownerApproval.sha256 ||
      claim.extensionClaimSha256 !== digest.extensionClaim || x.claimSha256 !== digest.extensionClaim ||
      claim.revalidationClaimSha256 !== digest.revalidationClaim || x.revalidationClaimSha256 !== digest.revalidationClaim ||
      claim.continuationClaimSha256 !== digest.continuationClaim || x.continuationClaimSha256 !== digest.continuationClaim ||
      claim.repairClaimSha256 !== digest.repairClaim || x.repairClaimSha256 !== digest.repairClaim ||
      claim.recoveryClaimSha256 !== digest.recoveryClaim || x.recoveryClaimSha256 !== digest.recoveryClaim ||
      claim.originalClaimSha256 !== digest.originalClaim || x.originalClaimSha256 !== digest.originalClaim || claim.engineHead !== grant.engine.head ||
      !sameDir(claim.bookDir) || !sameDir(grant.bookDir) || grant.profileSha256 !== freshBookProfileSha(profile) || claim.profileSha256 !== grant.profileSha256) refuse();
  // The whole earlier authority the extension revalidation consumed, re-derived by its own verifier, must be exactly what its grant recorded.
  let failed: Awaited<ReturnType<typeof extensionFailed>>;
  try { failed = await extensionFailed(config, env, rereview, loaded, x.grantFile); }
  catch (error) { if (error instanceof FreshBookError) throw error; return refuse(); }
  if (!sameJson(failed.extension, grant.extension) || !sameJson(failed.candidate, grant.candidate) || !sameJson(failed.recovery, grant.recovery) ||
      !sameJson(failed.ledger, grant.ledger) || !sameJson(failed.ownerApproval, grant.ownerApproval)) refuse();
  // Its terminal record and seal: its own review held attempt 4 at the owner's ceiling.
  if (!sortedSame(Object.keys(outcome), ['cycle', 'finishedAt', 'recovery', 'status', 'textStatus']) || outcome.cycle !== FRESH_BOOK_CYCLE.id ||
      outcome.status !== CAL.heldOutcome || !(CAL.heldStatuses as readonly string[]).includes(outcome.textStatus) || outcome.recovery !== CAL.heldRecovery) refuse();
  if (!sortedSame(Object.keys(seal), ['extensionRevalidated', 'replayed', 'runtimeEligible', 'status']) || seal.status !== outcome.textStatus ||
      seal.runtimeEligible !== false || !sameJson(seal.extensionRevalidated, extensionRevalidatedOf(grant)) || !Array.isArray(seal.replayed) ||
      !sortedSame(seal.replayed, [...REPAIR_REPLAYED, ...borrowedCalls(EXTENSION_REVALIDATION_SPEC)])) refuse();
  const admission = json(path.join(dir, EXTENSION_REVALIDATION_ADMISSION_FILE));
  if (!sortedSame(Object.keys(admission), ['candidate', 'extension', 'grantSha256', 'ledger', 'ownerApproval', 'preview', 'recovery', 'rereviewOutcome', 'version']) ||
      admission.version !== XREVAL.version || admission.grantSha256 !== digest.grant || !sameJson(admission.ownerApproval, grant.ownerApproval) ||
      !sameJson(admission.extension, grant.extension) || !sameJson(admission.candidate, grant.candidate) || !sameJson(admission.recovery, grant.recovery) ||
      admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd || admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd ||
      !sameJson(admission.rereviewOutcome, await assertFreshBookAdmission(rereview, env))) refuse();
  if (!sameJson(json(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE)), plainJson(failed.input))) refuse();
  const preview = await previewFreshBookStoryboardExtensionRevalidation(config, failed.input);
  const meter = verifyMeterRecords(path.join(dir, 'paid-stages'), STORYBOARD_EXTENSION_RULES);
  if (!sameJson(admission.preview, preview) || meter.length !== 1 || meter[0].claim.step !== 'storyboard_review' || meter[0].result?.completed !== true ||
      meter[0].claim.wireDigest !== preview.payloadDigest || existsSync(path.join(dir, 'claude-max-stages'))) refuse();
  // The held book: the extension's paid answer compiled under both corrections to the bound candidate; its review the paid answer.
  const result = json(path.join(dir, 'simple-book-result.json')), draft = json(path.join(dir, 'owned_storyboard_draft.json'));
  const paidPlanner = json(path.join(config.bookDir, EXT.folder, 'claude-max-stages', 'storyboard.receipt.json'));
  if (!sameJson(json(path.join(dir, 'visual_simple_book_result.json')), result) || result.status !== outcome.textStatus || result.storyboard?.status !== result.status ||
      !sameJson(draft, paidPlanner.output)) refuse();
  const c = FRESH_BOOK_CONTRACTS;
  let book: ReturnType<typeof compilePersonalStoryboard>, decision: ReturnType<typeof storyboardReviewDisposition>;
  try {
    book = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(prepared.accepted.canonical, failed.source, options, c.actorOwnedAppearance, c.momentContract,
      c.landmarkKindContract, undefined, c.sceneLocationContract, c.compilerRulesContract, failed.input, c.drawnInstantContract, true, true, true, true),
      structuredClone(draft), { selfCheckNames: true, stagingFields: true });
    decision = storyboardReviewDisposition(book, result.storyboard.rawReview);
  } catch { return refuse(); }
  if (book.storyboardDigest !== grant.candidate.storyboardDigest || book.storyboardDigest !== result.storyboard.storyboardDigest ||
      !sameJson(plainJson(book), result.storyboard.storyboard) || decision.disposition !== result.status) refuse();
  const impact = decision.impact ?? refuse();
  const reviewWire = json(path.join(dir, 'paid-stages', 'storyboard_review.wire.json')), receipt = json(files.reviewReceipt);
  const reviewCall = { stage: 'review', instructions: '', input: '', maxOutputTokens: 0, context: { narrativeSpreads: book.narrativeSpreads,
    sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest, actorOwnedAppearance: true, landmarkKindContract: true, reviewImpactPolicy: true,
    claimBasisContract: true } } as unknown as SimpleStoryboardDiagnosticCall;
  let paidReview: unknown;
  try { paidReview = decodePersonalBookProviderOutput(reviewCall, JSON.parse(receipt.raw.output_text)); } catch { return refuse(); }
  if (reviewWire.input !== canonicalJson(personalStoryboardReviewInput(book)) || !sameJson(paidReview, result.storyboard.rawReview)) refuse();
  const final = continuationRecoveryFinal(failed.recoveryRecord, { storyboardDigest: book.storyboardDigest, status: result.status, review: decision }, XREVAL.folder);
  if (!sameJson(json(files.recoveryFinal), plainJson(final)) || final.terminal !== CAL.heldRecovery) refuse();
  const before = freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env),
    stages: bookStages(config.bookDir, 'storyboard_extension_revalidation').slice(0, 7) });
  return { extensionRevalidation: { grantFile: path.resolve(extensionRevalidationGrantFile), grantSha256: digest.grant, claimSha256: digest.claim,
      outcomeSha256: digest.outcome, sealSha256: digest.seal, folderSha256: previewSha(canonicalJson(folderBaseline(dir))), reviewReceiptSha256: digest.reviewReceipt,
      recoveryFinalSha256: digest.recoveryFinal, extensionClaimSha256: digest.extensionClaim, revalidationClaimSha256: digest.revalidationClaim,
      continuationClaimSha256: digest.continuationClaim, repairClaimSha256: digest.repairClaim, recoveryClaimSha256: digest.recoveryClaim,
      originalClaimSha256: digest.originalClaim },
    held: { sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest, reviewDigest: decision.reviewDigest,
      disposition: decision.disposition as (typeof CAL.heldStatuses)[number], draftSha256: previewSha(canonicalJson(draft)),
      findings: impact.blocking.length, findingGroups: findingGroups(impact.blocking).length },
    ledger: { diagnosticSettledMicroUsd: before.diagnosticSettledMicroUsd, bookKnownMicroUsd: before.bookKnownMicroUsd,
      calls: before.stages.reduce((n, s) => n + s.calls, 0) },
    failed, draft, rawReview: result.storyboard.rawReview };
}

/** The calibration input: the held attempt-4 draft and its raw review, the extension input as ancestry, the calibration, both parent compile options, the owner's v2 extension. */
const calibrationInput = (held: Awaited<ReturnType<typeof extensionRevalidationHeld>>, approvalSha256: string): StoryboardRepair => ({
  parentStoryboardDigest: held.held.storyboardDigest, draft: held.draft, review: held.rawReview, parentRepair: held.failed.input,
  addedContracts: [...CAL.addedContracts], parentCompile: { selfCheckNames: true, stagingFields: true },
  extension: { version: STORYBOARD_ATTEMPT_EXTENSION_V2, maxAttempts: CAL.maxAttempts, approvalSha256,
    previous: held.failed.input.extension ?? fail('fresh_book_storyboard_calibration_extension_revalidation') } });

/**
 * The stage's durable recovery records at admission, derived by the ENGINE from the calibration source (its chain of four held candidates, their
 * contexts and findings, this attempt's context and the diagnosis it carries) and checked against this line's records: the first three are
 * exactly the extension's own recorded attempts, the fourth the extension revalidation's held candidate, and the reducer's state under the
 * owner's ceiling 5 is four consecutive failures with one attempt left. Each attempt's settled costs come from its own meter records.
 */
function calibrationRecovery(config: FreshBookConfig, loaded: ReturnType<typeof loadProfile>, held: Awaited<ReturnType<typeof extensionRevalidationHeld>>,
  input: StoryboardRepair) {
  const refuse = (): never => fail('fresh_book_storyboard_calibration_recovery'), c = FRESH_BOOK_CONTRACTS;
  let rec: ReturnType<typeof storyboardRecovery>;
  try {
    rec = storyboardRecovery(prepareCurrentPersonalStoryboard(loaded.prepared.accepted.canonical, held.failed.source, loaded.options, c.actorOwnedAppearance,
      c.momentContract, c.landmarkKindContract, undefined, c.sceneLocationContract, c.compilerRulesContract, input, c.drawnInstantContract, true, true, true, true, true));
  } catch { return refuse(); }
  // Each attempt's line, held candidate and where its paid planner session and its paid review live.
  const earlier = held.failed.recoveryRecord.attempts as { line: string; sourceDigest: string; storyboardDigest: string; reviewDigest: string;
    disposition: string; findings: unknown[] }[];
  const places = [{ folder: FRESH_BOOK_RECOVERY.folder, planner: FRESH_BOOK_RECOVERY.folder, review: FRESH_BOOK_RECOVERY.folder },
    { folder: FRESH_BOOK_STORYBOARD_REPAIR.folder, planner: FRESH_BOOK_STORYBOARD_REPAIR.folder, review: FRESH_BOOK_STORYBOARD_REPAIR.folder },
    { folder: REVAL.folder, planner: CONT.folder, review: REVAL.folder }];
  if (earlier.length !== places.length || earlier.some((a, i) => a.line !== places[i].folder)) refuse();
  const lines = [...earlier.map((a, i) => ({ ...places[i], sourceDigest: a.sourceDigest, storyboardDigest: a.storyboardDigest, reviewDigest: a.reviewDigest,
    disposition: a.disposition, findings: a.findings.length })),
    { folder: XREVAL.folder, planner: EXT.folder, review: XREVAL.folder, ...held.held }];
  const diagnosis = rec.diagnosis ?? refuse(), diagnosed = rec.diagnosisDigest ?? refuse();
  if (rec.chain.length !== lines.length || rec.chain.some((a, i) => a.storyboardDigest !== lines[i].storyboardDigest || a.findings.length !== lines[i].findings) ||
      diagnosisDigest(diagnosis) !== diagnosed) refuse();
  const state = recoveryState(chainAttempts(rec.chain), { maxAttempts: CAL.maxAttempts });
  if (state.mode !== 'diagnose_and_change_strategy' || state.consecutiveFailures !== CAL.priorAttempts || state.maxAttempts !== CAL.maxAttempts || state.remaining !== 1) refuse();
  const settledCost = (folder: string, store: 'claude-max-stages' | 'paid-stages', step: string) => {
    const done = json(path.join(config.bookDir, folder, store, `${step}.result.json`));
    return done.completed === true && Number.isSafeInteger(done.estimatedMicroUsd) && done.estimatedMicroUsd >= 0 ? done.estimatedMicroUsd as number
      : fail('fresh_book_storyboard_calibration_unknown_cost');
  };
  const record = { version: STAGE_RECOVERY_VERSION, stage: 'storyboard', diagnosisVersion: STORYBOARD_DIAGNOSIS_VERSION, maxAttempts: state.maxAttempts,
    extension: input.extension,
    attempts: rec.chain.map((a, i) => ({ attempt: i + 1, line: lines[i].folder, sourceDigest: lines[i].sourceDigest, storyboardDigest: a.storyboardDigest,
      reviewDigest: lines[i].reviewDigest, contextDigest: a.contextDigest, contracts: a.contracts, outcome: 'held' as const, disposition: lines[i].disposition,
      findings: chainAttempts([a])[0].findings,
      costs: { plannerClaudeMaxMicroUsd: settledCost(lines[i].planner, 'claude-max-stages', 'storyboard'),
        reviewApiMicroUsd: settledCost(lines[i].review, 'paid-stages', 'storyboard_review') } })),
    consecutiveFailures: state.consecutiveFailures, mode: state.mode, remaining: state.remaining, trajectory: state.trajectory,
    next: { attempt: state.attempts + 1, line: CAL.folder, contracts: rec.contracts, contextDigest: rec.context, diagnosisDigest: diagnosed,
      addedContracts: [...CAL.addedContracts], reviewPolicy: STORYBOARD_REVIEW_SEVERITY_VERSION, selfCheck: STORYBOARD_SELF_CHECK_VERSION,
      claimBasis: CLAIM_BASIS_CONTRACT_VERSION, calibration: STORYBOARD_CALIBRATION_VERSION, components: [...CALIBRATION_COMPONENTS],
      strategy: 'diagnose_and_change_strategy under the calibration: the owner\'s visual-completion rule shared with the review (setting and inference completions are direction; consequential places, routes, viewpoints, actions, reveals and state changes stay stated by the text), multi-sentence evidence as one self-check part per sentence, momentary contacts in the drawn instant with the ledger keeping entities at places, one source for changing state (the visual language\'s changes as mutable ledger changes, listed in selfCheck.visualStates), and every finding group fixed once where it lives' },
    terminal: null };
  const diagnosisRecord = { version: STORYBOARD_DIAGNOSIS_VERSION, diagnosisDigest: diagnosed, diagnosis, latestReviewFindings: rec.chain[rec.chain.length - 1].findings,
    allowance: { attempts: diagnosis.allowance, money: { bookKnownMicroUsd: held.ledger.bookKnownMicroUsd, bookSubcapMicroUsd: FRESH_BOOK_CYCLE.bookSubcapMicroUsd,
      reviewReserveFloorMicroUsd: CAL.reviewReserveFloorMicroUsd, plannerRoute: 'Claude Max: separate resource, not an API invoice, not $0' } } };
  return { record, stateSha256: previewSha(canonicalJson(record)), diagnosisRecord, contextDigest: rec.context, diagnosisDigest: diagnosed };
}

/** Provider-free plan and the calibration grant this exact state needs (no key, no provider, no write). */
export async function planFreshBookStoryboardCalibration(config: FreshBookConfig, env: FreshBookEnv, extensionRevalidationGrantFile: string, ownerApprovalFile: string) {
  const base = planFreshBook(config, env), loaded = loadProfile(config);
  const approval = ownerApproval(ownerApprovalFile, CAL.approvalLine, 'fresh_book_storyboard_calibration_approval');
  const held = await extensionRevalidationHeld(config, env, base.rereview, loaded, extensionRevalidationGrantFile);
  const input = calibrationInput(held, approval.sha256), derived = calibrationRecovery(config, loaded, held, input);
  const at = (name: string) => path.join(env.authorityRoot, name);
  const plan = { version: CAL.version, cycle: FRESH_BOOK_CYCLE.id, amendment: CAL.amendment, ownerApproval: approval, basePlanSha256: base.grantDraft.nativePlanSha256,
    bookDir: path.resolve(config.bookDir), folder: CAL.folder, storyboardDir: CAL.folder,
    replay: { calls: [...REPAIR_REPLAYED], from: 'the failed text and the recovery (saved wires and receipts, byte-exact; no provider or model callback)' },
    calibration: { contract: 'storyboard-repair/v1', parent: held.held, addedContracts: [...CAL.addedContracts], parentCompile: input.parentCompile,
      attemptExtension: input.extension, components: [...CALIBRATION_COMPONENTS], plannerSchema: CAL.plannerSchema,
      input: 'the held attempt-4 draft (the extension\'s paid answer) and its exact raw review, with the extension\'s input as ancestry: the engine re-binds every ancestor, derives every finding with its typed issues and groups them by reference (none chosen, edited or dropped)' },
    recovery: { reducer: STAGE_RECOVERY_VERSION, diagnosis: STORYBOARD_DIAGNOSIS_VERSION, selfCheck: STORYBOARD_SELF_CHECK_VERSION, reviewImpact: STORYBOARD_REVIEW_IMPACT_VERSION,
      claimBasis: CLAIM_BASIS_CONTRACT_VERSION, calibration: STORYBOARD_CALIBRATION_VERSION, attempts: derived.record.attempts.length,
      maxAttempts: derived.record.maxAttempts, mode: derived.record.mode, stateSha256: derived.stateSha256, diagnosisDigest: derived.diagnosisDigest,
      contextDigest: derived.contextDigest, last: 'this is the owner\'s ONE calibration attempt (5 of 5): held again ends the line (stop_allowance_exhausted); no attempt 6' },
    calls: { planner: `storyboard: Opus 5.5 on Claude Max (${OPUS_PLANNER.model}), ${CAL.plannerCalls}`, review: `storyboard_review: Sol 6.1 (${SOL}), ${CAL.apiCalls}`,
      reviewReserve: `max(${REVIEW_RESERVE_FLOOR_MICRO_USD}, the bound its request derives); admission refuses before the claim below the floor, the meter before the key or provider below that maximum; journal and replay derive it under the same rule` },
    downstream: ['child --storyboard-calibration', 'book --storyboard-calibration [--resume]'],
    caps: { ...base.plan.caps, storyboardCalibrationApiCalls: CAL.apiCalls },
    claim: at(CAL.claimName), outcome: at(CAL.outcomeName), successor: at(CAL.successorName),
    successorAdmission: 'downstream replays the whole chain (text, correction, planner, review) from the saved evidence and re-derives the recovery records against its one durable record',
    providerCalls: 0, keyRead: false };
  const engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_STORYBOARD_CALIBRATION_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft: FreshBookStoryboardCalibrationGrant = freshBookStoryboardCalibrationGrantSchema.parse({ version: 'fresh-book-storyboard-calibration-grant/v1',
    cycle: FRESH_BOOK_CYCLE.id, approval: FRESH_BOOK_CYCLE.approval, amendment: CAL.amendment, ownerApproval: approval, profileSha256: base.plan.profileSha256,
    bookDir: path.resolve(config.bookDir), extensionRevalidation: held.extensionRevalidation, held: held.held,
    recovery: { version: STAGE_RECOVERY_VERSION, attempts: derived.record.attempts.length, maxAttempts: derived.record.maxAttempts,
      consecutiveFailures: derived.record.consecutiveFailures, mode: derived.record.mode, stateSha256: derived.stateSha256, diagnosisDigest: derived.diagnosisDigest,
      contextDigest: derived.contextDigest },
    ledger: held.ledger, allowance: { plannerCalls: CAL.plannerCalls, apiCalls: CAL.apiCalls, reviewReserveFloorMicroUsd: CAL.reviewReserveFloorMicroUsd },
    addedContracts: [...CAL.addedContracts], compile: [STORYBOARD_SELF_CHECK_NAMES_VERSION, CLAIM_BASIS_STAGING_FIELDS_VERSION], plannerSchema: CAL.plannerSchema,
    engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)) });
  const probe = (f: () => unknown) => { try { return f(); } catch (e) { return { refused: e && typeof e === 'object' && 'code' in e ? e.code : String(e) }; } };
  const state = { claimExists: existsSync(plan.claim), outcomeExists: existsSync(plan.outcome), successorExists: existsSync(plan.successor),
    folderExists: existsSync(path.join(config.bookDir, CAL.folder)),
    ledger: probe(() => freshBookLedger(config, env, base.rereview, 'storyboard_calibration')),
    reviewFloor: probe(() => assertReviewFloorFits(freshBookLedger(config, env, base.rereview, 'storyboard_calibration'))),
    executablePinned: probe(() => assertFreshBookExecutable(config)), engine };
  return { plan, grantDraft, state, profile: base.profile, prepared: loaded.prepared, options: loaded.options, rereview: base.rereview,
    input, recoveryRecord: derived.record, diagnosisRecord: derived.diagnosisRecord };
}

/**
 * A calibration-line stage's admission, as admitStoryboardExtension: the baseline pinned FIRST and held across every await: the calibration grant
 * bytes, the owner's approval record bytes, the consumed extension-revalidation, extension, revalidation, continuation, repair, recovery and
 * original grants' bytes that chain names (each at its recorded digest, never re-pinned to this head), configuration, profile, lineage, every
 * line's authority records and the earlier stage entries. The grant is exactly the draft this state rebuilds, at the clean reviewed head. Its
 * guard adds the calibration claim and every claim it names.
 */
async function admitStoryboardCalibration(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal; earlier: string[] }) {
  const bytes = fileBytes(a.grantFile);
  if (previewSha(bytes) !== a.grantSha) fail('fresh_book_storyboard_calibration_grant');
  const parsed = freshBookStoryboardCalibrationGrantSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success) return fail('fresh_book_storyboard_calibration_grant');
  const approvalFile = parsed.data.ownerApproval.file, approvalBytes = fileBytes(approvalFile);
  if (previewSha(approvalBytes) !== parsed.data.ownerApproval.sha256) fail('fresh_book_storyboard_calibration_approval');
  const xrevalFile = parsed.data.extensionRevalidation.grantFile, xrevalBytes = fileBytes(xrevalFile);
  if (previewSha(xrevalBytes) !== parsed.data.extensionRevalidation.grantSha256) fail('fresh_book_storyboard_calibration_extension_revalidation');
  let xreval: FreshBookStoryboardExtensionRevalidationGrant, ext: FreshBookStoryboardExtensionGrant, reval: FreshBookStoryboardRevalidationGrant,
    cont: FreshBookStoryboardContinuationGrant, named: FreshBookStoryboardRepairGrant, recoveryGrant: FreshBookRecoveryGrant;
  try { xreval = freshBookStoryboardExtensionRevalidationGrantSchema.parse(JSON.parse(xrevalBytes.toString('utf8'))); }
  catch { return fail('fresh_book_storyboard_calibration_extension_revalidation'); }
  const extFile = xreval.extension.grantFile, extBytes = fileBytes(extFile);
  if (previewSha(extBytes) !== xreval.extension.grantSha256) fail('fresh_book_storyboard_extension_revalidation_extension');
  try { ext = freshBookStoryboardExtensionGrantSchema.parse(JSON.parse(extBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_extension_revalidation_extension'); }
  const revalFile = ext.revalidation.grantFile, revalBytes = fileBytes(revalFile);
  if (previewSha(revalBytes) !== ext.revalidation.grantSha256) fail('fresh_book_storyboard_extension_revalidation');
  try { reval = freshBookStoryboardRevalidationGrantSchema.parse(JSON.parse(revalBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_extension_revalidation'); }
  const contFile = reval.continuation.grantFile, contBytes = fileBytes(contFile);
  if (previewSha(contBytes) !== reval.continuation.grantSha256) fail('fresh_book_storyboard_revalidation_continuation');
  try { cont = freshBookStoryboardContinuationGrantSchema.parse(JSON.parse(contBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_revalidation_continuation'); }
  const repairFile = cont.repair.grantFile, repairBytes = fileBytes(repairFile);
  if (previewSha(repairBytes) !== cont.repair.grantSha256) fail('fresh_book_storyboard_continuation_repair');
  try { named = freshBookStoryboardRepairGrantSchema.parse(JSON.parse(repairBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_continuation_repair'); }
  const recoveryFile = named.recovery.grantFile, recoveryBytes = fileBytes(recoveryFile);
  if (previewSha(recoveryBytes) !== named.recovery.grantSha256) fail('fresh_book_storyboard_repair_recovery');
  try { recoveryGrant = freshBookRecoveryGrantSchema.parse(JSON.parse(recoveryBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_repair_recovery'); }
  const originalFile = recoveryGrant.original.grantFile, originalBytes = fileBytes(originalFile);
  if (previewSha(originalBytes) !== recoveryGrant.original.grantSha256) fail('fresh_book_recovery_original');
  const rereview = loadRereview(a.config);
  let roots = rootsOf(a.config, a.env, rereview, a.earlier);
  const planned = await planFreshBookStoryboardCalibration(a.config, a.env, xrevalFile, approvalFile);
  const outcome = await assertFreshBookAdmission(planned.rereview, a.env);
  const engine = a.env.head();
  if (canonicalJson(parsed.data) !== canonicalJson(planned.grantDraft)) fail('fresh_book_storyboard_calibration_grant');
  if (!engine.clean || engine.head !== planned.grantDraft.engine.head || engine.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
  const frozen: [string, Buffer, string][] = [[a.grantFile, bytes, 'fresh_book_storyboard_calibration_grant'],
    [approvalFile, approvalBytes, 'fresh_book_storyboard_calibration_approval'], [xrevalFile, xrevalBytes, 'fresh_book_storyboard_calibration_extension_revalidation'],
    [extFile, extBytes, 'fresh_book_storyboard_extension_revalidation_extension'], [revalFile, revalBytes, 'fresh_book_storyboard_extension_revalidation'],
    [contFile, contBytes, 'fresh_book_storyboard_revalidation_continuation'], [repairFile, repairBytes, 'fresh_book_storyboard_continuation_repair'],
    [recoveryFile, recoveryBytes, 'fresh_book_storyboard_repair_recovery'], [originalFile, originalBytes, 'fresh_book_recovery_original']];
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    for (const [file, held, code] of frozen) if (!fileBytes(file).equals(held)) fail(code);
    if (canonicalJson(rootsOf(a.config, a.env, rereview, a.earlier)) !== canonicalJson(roots)) fail('fresh_book_roots_changed');
    const e = a.env.head();
    if (!e.clean || e.head !== planned.grantDraft.engine.head || e.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(planned.grantDraft.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
  };
  const guard = () => { same(); assertFreshBookStoryboardCalibrationPaid({ env: a.env, grantFile: a.grantFile, grantSha: a.grantSha, profile: planned.profile, workspace: workspace() }); };
  const recapture = (added: string[]) => {
    const next = rootsOf(a.config, a.env, rereview, a.earlier), changed = Object.keys(next).filter(k => next[k] !== roots[k]);
    if (canonicalJson(Object.keys(next).sort()) !== canonicalJson(Object.keys(roots).sort()) || canonicalJson(changed.sort()) !== canonicalJson([...added].sort()) ||
        added.some(k => roots[k] !== 'absent' || next[k] === 'absent')) fail('fresh_book_roots_changed');
    roots = next; same();
  };
  same();
  return { planned, outcome, same, guard, recapture, grant: planned.grantDraft, calibration: planned.input };
}

type CalibrationPreview = ContinuationPreview & { findingGroups: number; schemaCompaction: string | null };
/**
 * Provider-free preview of the calibration's ONE planner request, on the paid run's own code path (the shared flow under its spec): the text
 * and the correction replayed, the calibration source prepared (every ancestor re-bound, every finding with its typed issues and groups and the
 * diagnosis derived by the engine), then the planner's request and its compacted CLI wire built and measured (content, wire and argv limits,
 * output cap, session guard) and stopped before any session. The paid stage runs it before its claim; its wire digest binds the paid one.
 */
export async function previewFreshBookStoryboardCalibration(config: FreshBookConfig, input: StoryboardRepair): Promise<CalibrationPreview> {
  const out: { preview?: CalibrationPreview } = {};
  try {
    await storyboardRepairFlow({ config, repair: input, signal: new AbortController().signal, log: () => {}, seen: [], spec: CALIBRATION_SPEC, preview: (wire, call) => {
      const parsedInput = JSON.parse(call.input), prior = parsedInput?.priorReviewedStoryboard, diagnosis = prior?.diagnosis;
      if (!diagnosis || !Array.isArray(prior?.findingGroups)) return fail('fresh_book_storyboard_calibration_preview');
      out.preview = { contentBytes: Buffer.byteLength(call.instructions, 'utf8') + Buffer.byteLength(call.input, 'utf8'), contentByteLimit: SIMPLE_STORYBOARD_INPUT_LIMIT,
        wireBytes: wire.bytes, wireByteLimit: 104000, reservedMicroUsd: wire.reservedMicroUsd, sessionGuardMicroUsd: OPUS_PLANNER.sessionGuardMicroUsd,
        findings: Array.isArray(prior.reviewFindings) ? prior.reviewFindings.length : 0, findingGroups: prior.findingGroups.length,
        instructionsSha256: previewSha(call.instructions), inputSha256: previewSha(call.input), wireDigest: previewSha(canonicalJson(wire)),
        outputCap: wire.outputCap, argvChars: wire.args.map(x => JSON.stringify(x)).join(' ').length + String(wire.payload.executable).length, argvLimit: 31000,
        diagnosisDigest: previewSha(canonicalJson(diagnosis)), resolutionsRequired: diagnosis.findings.length, protectedPages: diagnosis.protectedPages,
        schemaCompaction: typeof wire.payload.schemaCompaction === 'string' ? wire.payload.schemaCompaction : null };
      return fail('fresh_book_storyboard_calibration_preview_complete');
    } });
  } catch (error) { if (!out.preview) throw error; }
  return out.preview ?? fail('fresh_book_storyboard_calibration_preview');
}

/**
 * The ONE owner-approved calibration attempt of the same book: admission re-derives the held extension revalidation and its whole lineage
 * exactly, the engine's recovery state under the owner's ceiling 5 and the diagnosis, the balance must cover the review's floor, the planner
 * request must be sendable (its compacted wire within every limit); then one claim and its own folder with its admission, its input, the
 * recovery state and the diagnosis; the text and the correction are replayed, and the Opus Max planner and the Sol review run once each on the
 * native call sites (the review reserves max(600000, its bound)). Admitted: its successor is re-derived by replaying the whole chain and
 * recorded once. Held: its terminal outcome (no attempt 6). Failed: its terminal outcome. Nothing earlier is written.
 */
export async function runFreshBookStoryboardCalibration(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void; transports?: Pick<FreshTextTransports, 'responses' | 'planner'> }) {
  const { config, env, signal } = args, transports = args.transports ?? {};
  const admitted = await admitStoryboardCalibration({ ...args, earlier: ['request.json', 'admission.json', 'text', FRESH_BOOK_RECOVERY.folder,
    FRESH_BOOK_STORYBOARD_REPAIR.folder, CONT.folder, REVAL.folder, EXT.folder, XREVAL.folder] });
  assertFreshBookExecutable(config);
  const ledger = freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_calibration'), dir = path.join(config.bookDir, CAL.folder);
  if (existsSync(dir)) fail('fresh_book_storyboard_calibration_used');
  assertReviewFloorFits(ledger, 'fresh_book_storyboard_calibration_budget');
  // Before the claim: the exact planner request must be sendable, carry every finding of the held review, its groups and the diagnosis the grant names.
  const preview = await previewFreshBookStoryboardCalibration(config, admitted.calibration);
  if (preview.findings !== admitted.grant.held.findings || preview.findingGroups !== admitted.grant.held.findingGroups ||
      preview.diagnosisDigest !== admitted.grant.recovery.diagnosisDigest || preview.schemaCompaction !== CAL.plannerSchema ||
      preview.argvChars > preview.argvLimit || preview.wireBytes > preview.wireByteLimit || preview.contentBytes > preview.contentByteLimit)
    fail('fresh_book_storyboard_calibration_findings');
  // No await from the last check to the one calibration claim and its folder.
  admitted.same();
  claimFreshBookStoryboardCalibration(env, admitted.grant, args.grantSha);
  admitted.recapture([`authority/${CAL.claimName}`]);
  try { mkdirSync(dir); } catch { fail('fresh_book_storyboard_calibration_used'); }
  mkdirSync(path.join(dir, 'cli-workspace'));
  exclusiveJson(path.join(dir, CALIBRATION_ADMISSION_FILE), { version: CAL.version, grantSha256: args.grantSha, ownerApproval: admitted.grant.ownerApproval,
    extensionRevalidation: admitted.grant.extensionRevalidation, held: admitted.grant.held, recovery: admitted.grant.recovery, ledger, preview,
    rereviewOutcome: admitted.outcome });
  exclusiveJson(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE), admitted.calibration);
  exclusiveJson(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE), admitted.planned.recoveryRecord);
  exclusiveJson(path.join(dir, CONTINUATION_DIAGNOSIS_FILE), admitted.planned.diagnosisRecord);
  const api = new AuditionMeter(path.join(dir, 'paid-stages'), ledger.nextCapMicroUsd, CAL.apiCalls, ledger.bookKnownMicroUsd, 0, STORYBOARD_EXTENSION_RULES);
  const claudeMax = new SimpleBookBudget(path.join(dir, 'claude-max-stages'), 0);
  const key = keyReader(config.keyEnvFile);
  const responses = transports.responses ?? openAIResponses(key);
  let storyboardDraft: unknown = null, failed: string | null = null;
  const seen: string[] = [];
  const record = (error: unknown): never => { failed ??= codeOf(error, 'fresh_book_provider_transport'); throw error; };
  const guard = () => { try { admitted.guard(); } catch (error) { record(error); } };
  const calibrated = { parentStoryboardDigest: admitted.grant.held.storyboardDigest, addedContracts: [...CAL.addedContracts], attempt: CAL.maxAttempts,
    components: [...CALIBRATION_COMPONENTS], plannerSchema: CAL.plannerSchema };
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    exclusiveJson(path.join(dir, 'spend.json'), api.snapshot());
    exclusiveJson(path.join(dir, 'claude-max-spend.json'), { ...claudeMax.snapshot(), note: 'Claude Max usage is separate: not an API invoice' });
    exclusiveJson(path.join(dir, 'sealed.json'), { status, ...extra, calibrated, replayed: [...seen], runtimeEligible: false });
  };
  try {
    const result = await storyboardRepairFlow({ config, repair: admitted.calibration, signal, log: args.log, seen, spec: CALIBRATION_SPEC,
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
    const board = result.storyboard ?? fail('fresh_book_storyboard_calibration_policy');
    const final = continuationRecoveryFinal(admitted.planned.recoveryRecord, { storyboardDigest: board.storyboardDigest, status: result.status, review: board.review }, CAL.folder);
    exclusiveJson(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE), final);
    if (!admittedCalibration(result.status)) finish(env, CAL.ownHeldOutcome, { textStatus: result.status, recovery: final.terminal }, CAL.outcomeName);
    else {
      // The successor's ONE durable provenance: its whole chain replayed from the saved evidence, then recorded once under a fresh guard.
      const successor = await deriveStoryboardCalibrationSuccessor({ config, env, grantSha: args.grantSha, admitted });
      guard();
      exclusiveJson(path.join(env.authorityRoot, CAL.successorName), successor);
      admitted.recapture([`authority/${CAL.successorName}`]);
    }
    return { status: result.status, recovery: final, api: api.snapshot(), claudeMax: claudeMax.snapshot(),
      ledger: freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_calibration') };
  } catch (error) {
    const code = failed ?? codeOf(error, 'fresh_book_storyboard_calibration_failed');
    if (!existsSync(path.join(dir, 'sealed.json'))) seal('failed', { code });
    if (!existsSync(path.join(env.authorityRoot, CAL.outcomeName))) finish(env, 'failed_storyboard_calibration', { code }, CAL.outcomeName);
    throw error;
  }
}

type CalibrationAdmitted = { grant: FreshBookStoryboardCalibrationGrant; calibration: StoryboardRepair; outcome: unknown;
  planned: Pick<Awaited<ReturnType<typeof planFreshBookStoryboardCalibration>>, 'recoveryRecord' | 'diagnosisRecord'> };
/**
 * The calibration's successor, re-derived from its saved evidence (never its own seal, summary or a re-captured folder): its seal and admission
 * are this grant's; its input is exactly the held attempt-4 draft and raw review with the extension's input as ancestry, the calibration, both
 * parent compile options and the owner's v2 extension; its recovery state and diagnosis are the ones the engine derives now; its meters hold
 * exactly the one floored review and the one planner session (its compacted wire the one the engine rebuilds); replaying the WHOLE chain (text,
 * correction, planner, review) on the paid run's own code path reproduces the saved admitted result exactly; its terminal recovery record is
 * the reducer's state after that result.
 */
async function deriveStoryboardCalibrationSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: CalibrationAdmitted }) {
  const { config, env } = a, grant = a.admitted.grant, dir = path.join(config.bookDir, CAL.folder);
  const refuse = (): never => fail('fresh_book_storyboard_calibration_successor');
  try {
    const seal = json(path.join(dir, 'sealed.json'));
    if (!sortedSame(Object.keys(seal), ['calibrated', 'replayed', 'runtimeEligible', 'status']) || !admittedCalibration(seal.status) || seal.runtimeEligible !== false ||
        !sameJson(seal.calibrated, { parentStoryboardDigest: grant.held.storyboardDigest, addedContracts: [...CAL.addedContracts], attempt: CAL.maxAttempts,
          components: [...CALIBRATION_COMPONENTS], plannerSchema: CAL.plannerSchema }) ||
        !Array.isArray(seal.replayed) || !sortedSame(seal.replayed, REPAIR_REPLAYED)) refuse();
    const admission = json(path.join(dir, CALIBRATION_ADMISSION_FILE));
    if (!sortedSame(Object.keys(admission), ['extensionRevalidation', 'grantSha256', 'held', 'ledger', 'ownerApproval', 'preview', 'recovery', 'rereviewOutcome', 'version']) ||
        admission.version !== CAL.version || admission.grantSha256 !== a.grantSha || !sameJson(admission.ownerApproval, grant.ownerApproval) ||
        !sameJson(admission.extensionRevalidation, grant.extensionRevalidation) || !sameJson(admission.held, grant.held) || !sameJson(admission.recovery, grant.recovery) ||
        !sameJson(admission.rereviewOutcome, a.admitted.outcome) || admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd ||
        admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd) refuse();
    if (!sameJson(json(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE)), plainJson(a.admitted.calibration)) ||
        !sameJson(json(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE)), plainJson(a.admitted.planned.recoveryRecord)) ||
        !sameJson(json(path.join(dir, CONTINUATION_DIAGNOSIS_FILE)), plainJson(a.admitted.planned.diagnosisRecord)) ||
        previewSha(canonicalJson(json(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE)))) !== grant.recovery.stateSha256) refuse();
    // The admitted preview is this calibration's own planner request: re-derived now, and the paid planner session claimed exactly that wire.
    const preview = await previewFreshBookStoryboardCalibration(config, a.admitted.calibration);
    if (!sameJson(admission.preview, preview) || preview.findings !== grant.held.findings || preview.findingGroups !== grant.held.findingGroups ||
        preview.diagnosisDigest !== grant.recovery.diagnosisDigest || json(path.join(dir, 'claude-max-stages', 'storyboard.claim.json')).wireDigest !== preview.wireDigest) refuse();
    const reviewed = verifyMeterRecords(path.join(dir, 'paid-stages'), STORYBOARD_EXTENSION_RULES);
    if (reviewed.length !== 1 || reviewed[0].claim.step !== 'storyboard_review' || reviewed[0].result?.completed !== true ||
        !(reviewed[0].claim.maximumMicroUsd >= REVIEW_RESERVE_FLOOR_MICRO_USD)) refuse();
    if (!sameJson(readdirSync(path.join(dir, 'claude-max-stages')).filter(n => n.endsWith('.claim.json')), ['storyboard.claim.json'])) refuse();
    const seen: string[] = [];
    const replayed = await storyboardRepairFlow({ config, repair: a.admitted.calibration, signal: new AbortController().signal, log: () => {}, seen,
      spec: CALIBRATION_SPEC, replayDir: dir });
    const saved = json(path.join(dir, 'simple-book-result.json')), board = replayed.storyboard;
    if (!board) return refuse();
    if (!sameJson(seal.replayed, seen.filter(k => !ownCalls(CALIBRATION_SPEC).includes(k))) || !admittedCalibration(replayed.status) || replayed.status !== seal.status ||
        !sameJson(plainJson(replayed), saved) || !sameJson(json(path.join(dir, 'visual_simple_book_result.json')), saved) ||
        !sameJson(json(path.join(dir, 'owned_storyboard_draft.json')), json(path.join(dir, 'claude-max-stages', 'storyboard.receipt.json')).output)) refuse();
    const final = continuationRecoveryFinal(a.admitted.planned.recoveryRecord, { storyboardDigest: board.storyboardDigest, status: replayed.status, review: board.review },
      CAL.folder);
    if (!sameJson(json(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE)), plainJson(final))) refuse();
    const x = grant.extensionRevalidation;
    return { cycle: FRESH_BOOK_CYCLE.id, storyboardCalibration: CAL.version, grantSha256: a.grantSha, ownerApprovalSha256: grant.ownerApproval.sha256,
      originalClaimSha256: x.originalClaimSha256, recoveryClaimSha256: x.recoveryClaimSha256, repairClaimSha256: x.repairClaimSha256,
      continuationClaimSha256: x.continuationClaimSha256, revalidationClaimSha256: x.revalidationClaimSha256, extensionClaimSha256: x.extensionClaimSha256,
      extensionRevalidationClaimSha256: x.claimSha256, calibrationClaimSha256: previewSha(fileBytes(path.join(env.authorityRoot, CAL.claimName))),
      parentStoryboardDigest: grant.held.storyboardDigest, storyboardDigest: board.storyboardDigest, reviewDigest: board.review.reviewDigest,
      disposition: replayed.status, notes: board.review.impact?.notes.length ?? 0, reviewReserveMicroUsd: reviewed[0].claim.maximumMicroUsd as number,
      recoveryStateSha256: grant.recovery.stateSha256, diagnosisDigest: grant.recovery.diagnosisDigest,
      recoveryFinalSha256: previewSha(canonicalJson(final)), successorSha256: previewSha(canonicalJson(folderBaseline(dir))) };
  } catch { return refuse(); }
}
/** At every downstream entry: the calibration's successor re-derived now must equal its one durable record. */
async function verifyStoryboardCalibrationSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: CalibrationAdmitted }) {
  const record = await deriveStoryboardCalibrationSuccessor(a), file = path.join(a.env.authorityRoot, CAL.successorName);
  if (!existsSync(file) || !sameJson(json(file), record)) fail('fresh_book_storyboard_calibration_successor');
  return record;
}

// ---------------------------------------------------------------------------------------------------------------
// The ONE owner-directed PRESENCE attempt (Guy's same-book continuation, 2026-10-20): historically attempt 6 of the storyboard stage under
// storyboard-presence/v1.
// ---------------------------------------------------------------------------------------------------------------
const PRS = FRESH_BOOK_STORYBOARD_PRESENCE;
/** The presence folder's own admission record (beside its input and its recovery records). */
export const PRESENCE_ADMISSION_FILE = 'presence-admission.json';
const admittedPresence = (status: unknown) => (PRS.admittedStatuses as readonly unknown[]).includes(status);
/** The presence attempt's shape on the shared flow: the calibration's contracts plus presence, compiled under both corrections, its planner wire compacted. */
const PRESENCE_SPEC: ReplanSpec = Object.freeze({ folder: PRS.folder,
  contracts: { selfCheckContract: true as const, reviewImpactPolicy: true as const, claimBasisContract: true as const, calibrationContract: true as const,
    presenceContract: true as const },
  rules: STORYBOARD_EXTENSION_RULES, compile: { selfCheckNames: true as const, stagingFields: true as const }, plannerSchema: PRS.plannerSchema });
/** The calibration run's own seal record for its grant. */
const calibratedSeal = (grant: FreshBookStoryboardCalibrationGrant) => ({ parentStoryboardDigest: grant.held.storyboardDigest, addedContracts: [...CAL.addedContracts],
  attempt: CAL.maxAttempts, components: [...CALIBRATION_COMPONENTS], plannerSchema: CAL.plannerSchema });

/**
 * The consumed calibration attempt and the held storyboard the presence attempt stands on, re-read exactly: the calibration grant its claim
 * names (naming the extension-revalidation, extension, revalidation, continuation, repair, recovery and original claims, at that grant's own
 * head) and the owner record it bound; the WHOLE earlier authority that grant consumed, re-derived by its own verifier (extensionRevalidationHeld)
 * and equal to what it recorded; its input, recovery state and diagnosis are the engine's (re-derived now); its terminal record and seal are its
 * own review holding attempt 5 at the owner's ceiling (stop_allowance_exhausted) with no successor or audition; its admission and admitted
 * planner preview are the engine's; its meters hold exactly the one floored review and the one planner session on the previewed wire; its draft
 * is that session's paid answer; the held book is that answer compiled under the calibration and both corrections to the bound candidate; its
 * raw review is the paid answer decoded for that book (whose paid request was exactly its review input) and re-judges to that held
 * disposition; its terminal recovery record is the reducer's derivation. The ledger it stands on is the stages through it.
 */
async function calibrationHeld(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, loaded: ReturnType<typeof loadProfile>,
  calibrationGrantFile: string) {
  const { profile, prepared, options } = loaded, refuse = (): never => fail('fresh_book_storyboard_presence_calibration');
  if (!path.isAbsolute(calibrationGrantFile)) refuse();
  const at = (name: string) => path.join(env.authorityRoot, name), dir = path.join(config.bookDir, CAL.folder);
  const files = { grant: calibrationGrantFile, claim: at(CAL.claimName), outcome: at(CAL.outcomeName), seal: path.join(dir, 'sealed.json'),
    reviewReceipt: path.join(dir, 'paid-stages', 'storyboard_review.receipt.json'), plannerReceipt: path.join(dir, 'claude-max-stages', 'storyboard.receipt.json'),
    recoveryFinal: path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE), extensionRevalidationClaim: at(XREVAL.claimName), extensionClaim: at(EXT.claimName),
    revalidationClaim: at(REVAL.claimName), continuationClaim: at(CONT.claimName), repairClaim: at(FRESH_BOOK_STORYBOARD_REPAIR.claimName),
    recoveryClaim: at(FRESH_BOOK_RECOVERY.claimName), originalClaim: at(FRESH_BOOK_CYCLE.claimName) };
  if (Object.values(files).some(f => !existsSync(f)) || existsSync(at(CAL.successorName)) || existsSync(at(CAL.auditionStartName))) refuse();
  const digest = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, previewSha(fileBytes(f))])) as Record<keyof typeof files, string>;
  const parsed = freshBookStoryboardCalibrationGrantSchema.safeParse(json(files.grant));
  if (!parsed.success) return refuse();
  const grant = parsed.data, claim = json(files.claim), outcome = json(files.outcome), seal = json(files.seal), x = grant.extensionRevalidation;
  const sameDir = (p: unknown) => typeof p === 'string' && path.resolve(p).toLowerCase() === path.resolve(config.bookDir).toLowerCase();
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardCalibration !== CAL.version || claim.grantSha256 !== digest.grant ||
      claim.ownerApprovalSha256 !== grant.ownerApproval.sha256 || previewSha(fileBytes(grant.ownerApproval.file)) !== grant.ownerApproval.sha256 ||
      claim.extensionRevalidationClaimSha256 !== digest.extensionRevalidationClaim || x.claimSha256 !== digest.extensionRevalidationClaim ||
      claim.extensionClaimSha256 !== digest.extensionClaim || x.extensionClaimSha256 !== digest.extensionClaim ||
      claim.revalidationClaimSha256 !== digest.revalidationClaim || x.revalidationClaimSha256 !== digest.revalidationClaim ||
      claim.continuationClaimSha256 !== digest.continuationClaim || x.continuationClaimSha256 !== digest.continuationClaim ||
      claim.repairClaimSha256 !== digest.repairClaim || x.repairClaimSha256 !== digest.repairClaim ||
      claim.recoveryClaimSha256 !== digest.recoveryClaim || x.recoveryClaimSha256 !== digest.recoveryClaim ||
      claim.originalClaimSha256 !== digest.originalClaim || x.originalClaimSha256 !== digest.originalClaim || claim.engineHead !== grant.engine.head ||
      !sameDir(claim.bookDir) || !sameDir(grant.bookDir) || grant.profileSha256 !== freshBookProfileSha(profile) || claim.profileSha256 !== grant.profileSha256) refuse();
  // The whole earlier authority the calibration consumed, re-derived by its own verifier, must be exactly what its grant recorded.
  let xheld: Awaited<ReturnType<typeof extensionRevalidationHeld>>;
  try { xheld = await extensionRevalidationHeld(config, env, rereview, loaded, x.grantFile); }
  catch (error) { if (error instanceof FreshBookError) throw error; return refuse(); }
  if (!sameJson(xheld.extensionRevalidation, grant.extensionRevalidation) || !sameJson(xheld.held, grant.held) || !sameJson(xheld.ledger, grant.ledger)) refuse();
  // Its input, recovery state and diagnosis: the engine's, re-derived now from that authority and its owner record.
  const input = calibrationInput(xheld, grant.ownerApproval.sha256), derived = calibrationRecovery(config, loaded, xheld, input);
  if (!sameJson(json(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE)), plainJson(input)) ||
      !sameJson(json(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE)), plainJson(derived.record)) ||
      !sameJson(json(path.join(dir, CONTINUATION_DIAGNOSIS_FILE)), plainJson(derived.diagnosisRecord)) ||
      derived.stateSha256 !== grant.recovery.stateSha256 || derived.diagnosisDigest !== grant.recovery.diagnosisDigest) refuse();
  // Its terminal record and seal: its own review held attempt 5 at the owner's ceiling.
  if (!sortedSame(Object.keys(outcome), ['cycle', 'finishedAt', 'recovery', 'status', 'textStatus']) || outcome.cycle !== FRESH_BOOK_CYCLE.id ||
      outcome.status !== PRS.heldOutcome || !(PRS.heldStatuses as readonly string[]).includes(outcome.textStatus) || outcome.recovery !== PRS.heldRecovery) refuse();
  if (!sortedSame(Object.keys(seal), ['calibrated', 'replayed', 'runtimeEligible', 'status']) || seal.status !== outcome.textStatus || seal.runtimeEligible !== false ||
      !sameJson(seal.calibrated, calibratedSeal(grant)) || !Array.isArray(seal.replayed) || !sortedSame(seal.replayed, REPAIR_REPLAYED)) refuse();
  const admission = json(path.join(dir, CALIBRATION_ADMISSION_FILE));
  if (!sortedSame(Object.keys(admission), ['extensionRevalidation', 'grantSha256', 'held', 'ledger', 'ownerApproval', 'preview', 'recovery', 'rereviewOutcome', 'version']) ||
      admission.version !== CAL.version || admission.grantSha256 !== digest.grant || !sameJson(admission.ownerApproval, grant.ownerApproval) ||
      !sameJson(admission.extensionRevalidation, grant.extensionRevalidation) || !sameJson(admission.held, grant.held) || !sameJson(admission.recovery, grant.recovery) ||
      admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd || admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd ||
      !sameJson(admission.rereviewOutcome, await assertFreshBookAdmission(rereview, env))) refuse();
  // Its meters: exactly the one floored review (API) and the one planner session (Claude Max) on the previewed, compacted wire, both settled.
  const preview = await previewFreshBookStoryboardCalibration(config, input);
  const reviewed = verifyMeterRecords(path.join(dir, 'paid-stages'), STORYBOARD_EXTENSION_RULES);
  const plannerClaim = json(path.join(dir, 'claude-max-stages', 'storyboard.claim.json')), plannerResult = json(path.join(dir, 'claude-max-stages', 'storyboard.result.json'));
  if (!sameJson(admission.preview, preview) || reviewed.length !== 1 || reviewed[0].claim.step !== 'storyboard_review' || reviewed[0].result?.completed !== true ||
      !(reviewed[0].claim.maximumMicroUsd >= REVIEW_RESERVE_FLOOR_MICRO_USD) ||
      !sameJson(readdirSync(path.join(dir, 'claude-max-stages')).filter(n => n.endsWith('.claim.json')), ['storyboard.claim.json']) ||
      plannerClaim.wireDigest !== preview.wireDigest || plannerResult.wireDigest !== preview.wireDigest || plannerResult.completed !== true ||
      !Number.isSafeInteger(plannerResult.estimatedMicroUsd) || plannerResult.estimatedMicroUsd < 0) refuse();
  // The held book: the paid planner answer compiled under the calibration and both corrections to the bound candidate; its review the paid answer.
  const result = json(path.join(dir, 'simple-book-result.json')), draft = json(path.join(dir, 'owned_storyboard_draft.json'));
  if (!sameJson(json(path.join(dir, 'visual_simple_book_result.json')), result) || result.status !== outcome.textStatus || result.storyboard?.status !== result.status ||
      !sameJson(draft, json(files.plannerReceipt).output)) refuse();
  const c = FRESH_BOOK_CONTRACTS;
  let book: ReturnType<typeof compilePersonalStoryboard>, decision: ReturnType<typeof storyboardReviewDisposition>;
  try {
    book = compilePersonalStoryboard(prepareCurrentPersonalStoryboard(prepared.accepted.canonical, xheld.failed.source, options, c.actorOwnedAppearance, c.momentContract,
      c.landmarkKindContract, undefined, c.sceneLocationContract, c.compilerRulesContract, input, c.drawnInstantContract, true, true, true, true, true),
      structuredClone(draft), { selfCheckNames: true, stagingFields: true });
    decision = storyboardReviewDisposition(book, result.storyboard.rawReview);
  } catch { return refuse(); }
  if (book.storyboardDigest !== result.storyboard.storyboardDigest || !sameJson(plainJson(book), result.storyboard.storyboard) || decision.disposition !== result.status) refuse();
  const impact = decision.impact ?? refuse();
  const reviewWire = json(path.join(dir, 'paid-stages', 'storyboard_review.wire.json')), receipt = json(files.reviewReceipt);
  const reviewCall = { stage: 'review', instructions: '', input: '', maxOutputTokens: 0, context: { narrativeSpreads: book.narrativeSpreads,
    sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest, actorOwnedAppearance: true, landmarkKindContract: true, reviewImpactPolicy: true,
    claimBasisContract: true, calibrationContract: true } } as unknown as SimpleStoryboardDiagnosticCall;
  let paidReview: unknown;
  try { paidReview = decodePersonalBookProviderOutput(reviewCall, JSON.parse(receipt.raw.output_text)); } catch { return refuse(); }
  if (reviewWire.input !== canonicalJson(personalStoryboardReviewInput(book)) || !sameJson(paidReview, result.storyboard.rawReview)) refuse();
  const final = continuationRecoveryFinal(derived.record, { storyboardDigest: book.storyboardDigest, status: result.status, review: decision }, CAL.folder);
  if (!sameJson(json(files.recoveryFinal), plainJson(final)) || final.terminal !== PRS.heldRecovery) refuse();
  const before = freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env),
    stages: bookStages(config.bookDir, 'storyboard_calibration').slice(0, 8) });
  return { calibration: { grantFile: path.resolve(calibrationGrantFile), grantSha256: digest.grant, claimSha256: digest.claim, outcomeSha256: digest.outcome,
      sealSha256: digest.seal, folderSha256: previewSha(canonicalJson(folderBaseline(dir))), reviewReceiptSha256: digest.reviewReceipt,
      plannerReceiptSha256: digest.plannerReceipt, recoveryFinalSha256: digest.recoveryFinal, extensionRevalidationClaimSha256: digest.extensionRevalidationClaim,
      extensionClaimSha256: digest.extensionClaim, revalidationClaimSha256: digest.revalidationClaim, continuationClaimSha256: digest.continuationClaim,
      repairClaimSha256: digest.repairClaim, recoveryClaimSha256: digest.recoveryClaim, originalClaimSha256: digest.originalClaim },
    held: { sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest, reviewDigest: decision.reviewDigest,
      disposition: decision.disposition as (typeof PRS.heldStatuses)[number], draftSha256: previewSha(canonicalJson(draft)),
      findings: impact.blocking.length, findingGroups: findingGroups(impact.blocking).length },
    ledger: { diagnosticSettledMicroUsd: before.diagnosticSettledMicroUsd, bookKnownMicroUsd: before.bookKnownMicroUsd,
      calls: before.stages.reduce((n, s) => n + s.calls, 0) },
    xheld, input, recoveryRecord: derived.record, draft, rawReview: result.storyboard.rawReview };
}

/** The presence input: the held attempt-5 draft and its raw review, the calibration input as ancestry, presence, both parent compile options, the owner's v2 extension. */
const presenceInput = (held: Awaited<ReturnType<typeof calibrationHeld>>, approvalSha256: string): StoryboardRepair => ({
  parentStoryboardDigest: held.held.storyboardDigest, draft: held.draft, review: held.rawReview, parentRepair: held.input,
  addedContracts: [...PRS.addedContracts], parentCompile: { selfCheckNames: true, stagingFields: true },
  extension: { version: STORYBOARD_ATTEMPT_EXTENSION_V2, maxAttempts: PRS.maxAttempts, approvalSha256,
    previous: held.input.extension ?? fail('fresh_book_storyboard_presence_calibration') } });

/**
 * The stage's durable recovery records at admission, derived by the ENGINE from the presence source (its chain of five held candidates, their
 * contexts and findings, this attempt's context, the diagnosis it carries and its repeated references) and checked against this line's
 * records: the first four are exactly the calibration's own recorded attempts, the fifth the calibration's held candidate, and the reducer's
 * state under the owner's ceiling 6 is five consecutive failures with one attempt left. Each attempt's settled costs come from its own meter records.
 */
function presenceRecovery(config: FreshBookConfig, loaded: ReturnType<typeof loadProfile>, held: Awaited<ReturnType<typeof calibrationHeld>>,
  input: StoryboardRepair) {
  const refuse = (): never => fail('fresh_book_storyboard_presence_recovery'), c = FRESH_BOOK_CONTRACTS;
  let rec: ReturnType<typeof storyboardRecovery>, repeated: unknown;
  try {
    const source = prepareCurrentPersonalStoryboard(loaded.prepared.accepted.canonical, held.xheld.failed.source, loaded.options, c.actorOwnedAppearance,
      c.momentContract, c.landmarkKindContract, undefined, c.sceneLocationContract, c.compilerRulesContract, input, c.drawnInstantContract, true, true, true, true, true,
      true);
    rec = storyboardRecovery(source);
    repeated = (source.planningInput as { priorReviewedStoryboard?: { repeatedReferences?: unknown } }).priorReviewedStoryboard?.repeatedReferences;
  } catch { return refuse(); }
  if (!Array.isArray(repeated)) refuse();
  // Each attempt's line, held candidate and where its paid planner session and its paid review live.
  const earlier = held.recoveryRecord.attempts as { line: string; sourceDigest: string; storyboardDigest: string; reviewDigest: string;
    disposition: string; findings: unknown[] }[];
  const places = [{ folder: FRESH_BOOK_RECOVERY.folder, planner: FRESH_BOOK_RECOVERY.folder, review: FRESH_BOOK_RECOVERY.folder },
    { folder: FRESH_BOOK_STORYBOARD_REPAIR.folder, planner: FRESH_BOOK_STORYBOARD_REPAIR.folder, review: FRESH_BOOK_STORYBOARD_REPAIR.folder },
    { folder: REVAL.folder, planner: CONT.folder, review: REVAL.folder }, { folder: XREVAL.folder, planner: EXT.folder, review: XREVAL.folder }];
  if (earlier.length !== places.length || earlier.some((a, i) => a.line !== places[i].folder)) refuse();
  const lines = [...earlier.map((a, i) => ({ ...places[i], sourceDigest: a.sourceDigest, storyboardDigest: a.storyboardDigest, reviewDigest: a.reviewDigest,
    disposition: a.disposition, findings: a.findings.length })),
    { folder: CAL.folder, planner: CAL.folder, review: CAL.folder, ...held.held }];
  const diagnosis = rec.diagnosis ?? refuse(), diagnosed = rec.diagnosisDigest ?? refuse();
  if (rec.chain.length !== lines.length || rec.chain.some((a, i) => a.storyboardDigest !== lines[i].storyboardDigest || a.findings.length !== lines[i].findings) ||
      diagnosisDigest(diagnosis) !== diagnosed) refuse();
  const state = recoveryState(chainAttempts(rec.chain), { maxAttempts: PRS.maxAttempts });
  if (state.mode !== 'diagnose_and_change_strategy' || state.consecutiveFailures !== PRS.priorAttempts || state.maxAttempts !== PRS.maxAttempts || state.remaining !== 1) refuse();
  const settledCost = (folder: string, store: 'claude-max-stages' | 'paid-stages', step: string) => {
    const done = json(path.join(config.bookDir, folder, store, `${step}.result.json`));
    return done.completed === true && Number.isSafeInteger(done.estimatedMicroUsd) && done.estimatedMicroUsd >= 0 ? done.estimatedMicroUsd as number
      : fail('fresh_book_storyboard_presence_unknown_cost');
  };
  const record = { version: STAGE_RECOVERY_VERSION, stage: 'storyboard', diagnosisVersion: STORYBOARD_DIAGNOSIS_VERSION, maxAttempts: state.maxAttempts,
    extension: input.extension,
    attempts: rec.chain.map((a, i) => ({ attempt: i + 1, line: lines[i].folder, sourceDigest: lines[i].sourceDigest, storyboardDigest: a.storyboardDigest,
      reviewDigest: lines[i].reviewDigest, contextDigest: a.contextDigest, contracts: a.contracts, outcome: 'held' as const, disposition: lines[i].disposition,
      findings: chainAttempts([a])[0].findings,
      costs: { plannerClaudeMaxMicroUsd: settledCost(lines[i].planner, 'claude-max-stages', 'storyboard'),
        reviewApiMicroUsd: settledCost(lines[i].review, 'paid-stages', 'storyboard_review') } })),
    consecutiveFailures: state.consecutiveFailures, mode: state.mode, remaining: state.remaining, trajectory: state.trajectory,
    next: { attempt: state.attempts + 1, line: PRS.folder, contracts: rec.contracts, contextDigest: rec.context, diagnosisDigest: diagnosed,
      addedContracts: [...PRS.addedContracts], reviewPolicy: STORYBOARD_REVIEW_SEVERITY_VERSION, selfCheck: STORYBOARD_SELF_CHECK_VERSION,
      claimBasis: CLAIM_BASIS_CONTRACT_VERSION, calibration: STORYBOARD_CALIBRATION_VERSION, presence: STORYBOARD_PRESENCE_VERSION,
      components: [...PRESENCE_COMPONENTS], repeatedReferences: repeated as unknown[],
      strategy: 'diagnose_and_change_strategy under presence: a visible cast member the text includes in the scene but does not place is listed in depicted.presence (no position, move, contact or action claimed) instead of an invented relation; a reference held for the same impact in both last reviews is not re-quoted, recycled with a relation value it was held with, staged or hidden (a relation the page states with a different relation or target goes to the review); every other finding group fixed once where it lives under the calibration' },
    terminal: null };
  const diagnosisRecord = { version: STORYBOARD_DIAGNOSIS_VERSION, diagnosisDigest: diagnosed, diagnosis, latestReviewFindings: rec.chain[rec.chain.length - 1].findings,
    allowance: { attempts: diagnosis.allowance, money: { bookKnownMicroUsd: held.ledger.bookKnownMicroUsd, bookSubcapMicroUsd: FRESH_BOOK_CYCLE.bookSubcapMicroUsd,
      reviewReserveFloorMicroUsd: PRS.reviewReserveFloorMicroUsd, plannerRoute: 'Claude Max: separate resource, not an API invoice, not $0' } } };
  return { record, stateSha256: previewSha(canonicalJson(record)), diagnosisRecord, contextDigest: rec.context, diagnosisDigest: diagnosed,
    repeatedReferences: (repeated as unknown[]).length };
}

/** Provider-free plan and the presence grant this exact state needs (no key, no provider, no write). */
export async function planFreshBookStoryboardPresence(config: FreshBookConfig, env: FreshBookEnv, calibrationGrantFile: string, ownerApprovalFile: string) {
  const base = planFreshBook(config, env), loaded = loadProfile(config);
  const approval = ownerApproval(ownerApprovalFile, PRS.approvalLine, 'fresh_book_storyboard_presence_approval');
  const held = await calibrationHeld(config, env, base.rereview, loaded, calibrationGrantFile);
  const input = presenceInput(held, approval.sha256), derived = presenceRecovery(config, loaded, held, input);
  const at = (name: string) => path.join(env.authorityRoot, name);
  const plan = { version: PRS.version, cycle: FRESH_BOOK_CYCLE.id, amendment: PRS.amendment, ownerApproval: approval, basePlanSha256: base.grantDraft.nativePlanSha256,
    bookDir: path.resolve(config.bookDir), folder: PRS.folder, storyboardDir: PRS.folder,
    replay: { calls: [...REPAIR_REPLAYED], from: 'the failed text and the recovery (saved wires and receipts, byte-exact; no provider or model callback)' },
    presence: { contract: 'storyboard-repair/v1', parent: held.held, addedContracts: [...PRS.addedContracts], parentCompile: input.parentCompile,
      attemptExtension: input.extension, components: [...PRESENCE_COMPONENTS], plannerSchema: PRS.plannerSchema, repeatedReferences: derived.repeatedReferences,
      input: 'the held attempt-5 draft (the calibration\'s paid answer) and its exact raw review, with the calibration\'s input as ancestry: the engine re-binds every ancestor, derives every finding with its typed issues, groups them by reference and lists the references the last two reviews held for the same impact (none chosen, edited or dropped)' },
    recovery: { reducer: STAGE_RECOVERY_VERSION, diagnosis: STORYBOARD_DIAGNOSIS_VERSION, selfCheck: STORYBOARD_SELF_CHECK_VERSION, reviewImpact: STORYBOARD_REVIEW_IMPACT_VERSION,
      claimBasis: CLAIM_BASIS_CONTRACT_VERSION, calibration: STORYBOARD_CALIBRATION_VERSION, presence: STORYBOARD_PRESENCE_VERSION, attempts: derived.record.attempts.length,
      maxAttempts: derived.record.maxAttempts, mode: derived.record.mode, stateSha256: derived.stateSha256, diagnosisDigest: derived.diagnosisDigest,
      contextDigest: derived.contextDigest, last: 'this is the owner\'s ONE presence attempt (historically 6 of 6): held again ends the line (stop_allowance_exhausted); no attempt 7' },
    calls: { planner: `storyboard: Opus 5.5 on Claude Max (${OPUS_PLANNER.model}), ${PRS.plannerCalls}`, review: `storyboard_review: Sol 6.1 (${SOL}), ${PRS.apiCalls}`,
      reviewReserve: `max(${REVIEW_RESERVE_FLOOR_MICRO_USD}, the bound its request derives); admission refuses before the claim below the floor, the meter before the key or provider below that maximum; journal and replay derive it under the same rule` },
    downstream: ['child --storyboard-presence', 'book --storyboard-presence [--resume]'],
    caps: { ...base.plan.caps, storyboardPresenceApiCalls: PRS.apiCalls },
    claim: at(PRS.claimName), outcome: at(PRS.outcomeName), successor: at(PRS.successorName),
    successorAdmission: 'downstream replays the whole chain (text, correction, planner, review) from the saved evidence and re-derives the recovery records against its one durable record',
    providerCalls: 0, keyRead: false };
  const engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_STORYBOARD_PRESENCE_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft: FreshBookStoryboardPresenceGrant = freshBookStoryboardPresenceGrantSchema.parse({ version: 'fresh-book-storyboard-presence-grant/v1',
    cycle: FRESH_BOOK_CYCLE.id, approval: FRESH_BOOK_CYCLE.approval, amendment: PRS.amendment, ownerApproval: approval, profileSha256: base.plan.profileSha256,
    bookDir: path.resolve(config.bookDir), calibration: held.calibration, held: { ...held.held, repeatedReferences: derived.repeatedReferences },
    recovery: { version: STAGE_RECOVERY_VERSION, attempts: derived.record.attempts.length, maxAttempts: derived.record.maxAttempts,
      consecutiveFailures: derived.record.consecutiveFailures, mode: derived.record.mode, stateSha256: derived.stateSha256, diagnosisDigest: derived.diagnosisDigest,
      contextDigest: derived.contextDigest },
    ledger: held.ledger, allowance: { plannerCalls: PRS.plannerCalls, apiCalls: PRS.apiCalls, reviewReserveFloorMicroUsd: PRS.reviewReserveFloorMicroUsd },
    addedContracts: [...PRS.addedContracts], compile: [STORYBOARD_SELF_CHECK_NAMES_VERSION, CLAIM_BASIS_STAGING_FIELDS_VERSION], plannerSchema: PRS.plannerSchema,
    engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)) });
  const probe = (f: () => unknown) => { try { return f(); } catch (e) { return { refused: e && typeof e === 'object' && 'code' in e ? e.code : String(e) }; } };
  const state = { claimExists: existsSync(plan.claim), outcomeExists: existsSync(plan.outcome), successorExists: existsSync(plan.successor),
    folderExists: existsSync(path.join(config.bookDir, PRS.folder)),
    ledger: probe(() => freshBookLedger(config, env, base.rereview, 'storyboard_presence')),
    reviewFloor: probe(() => assertReviewFloorFits(freshBookLedger(config, env, base.rereview, 'storyboard_presence'))),
    executablePinned: probe(() => assertFreshBookExecutable(config)), engine };
  return { plan, grantDraft, state, profile: base.profile, prepared: loaded.prepared, options: loaded.options, rereview: base.rereview,
    input, recoveryRecord: derived.record, diagnosisRecord: derived.diagnosisRecord };
}

/**
 * A presence-line stage's admission, as admitStoryboardCalibration: the baseline pinned FIRST and held across every await: the presence grant
 * bytes, the owner's record bytes, the consumed calibration, extension-revalidation, extension, revalidation, continuation, repair, recovery
 * and original grants' bytes that chain names (each at its recorded digest, never re-pinned to this head), configuration, profile, lineage,
 * every line's authority records and the earlier stage entries. The grant is exactly the draft this state rebuilds, at the clean reviewed head.
 * Its guard adds the presence claim and every claim it names.
 */
async function admitStoryboardPresence(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal; earlier: string[] }) {
  const bytes = fileBytes(a.grantFile);
  if (previewSha(bytes) !== a.grantSha) fail('fresh_book_storyboard_presence_grant');
  const parsed = freshBookStoryboardPresenceGrantSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success) return fail('fresh_book_storyboard_presence_grant');
  const approvalFile = parsed.data.ownerApproval.file, approvalBytes = fileBytes(approvalFile);
  if (previewSha(approvalBytes) !== parsed.data.ownerApproval.sha256) fail('fresh_book_storyboard_presence_approval');
  const calFile = parsed.data.calibration.grantFile, calBytes = fileBytes(calFile);
  if (previewSha(calBytes) !== parsed.data.calibration.grantSha256) fail('fresh_book_storyboard_presence_calibration');
  let cal: FreshBookStoryboardCalibrationGrant, xreval: FreshBookStoryboardExtensionRevalidationGrant, ext: FreshBookStoryboardExtensionGrant,
    reval: FreshBookStoryboardRevalidationGrant, cont: FreshBookStoryboardContinuationGrant, named: FreshBookStoryboardRepairGrant, recoveryGrant: FreshBookRecoveryGrant;
  try { cal = freshBookStoryboardCalibrationGrantSchema.parse(JSON.parse(calBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_presence_calibration'); }
  const xrevalFile = cal.extensionRevalidation.grantFile, xrevalBytes = fileBytes(xrevalFile);
  if (previewSha(xrevalBytes) !== cal.extensionRevalidation.grantSha256) fail('fresh_book_storyboard_calibration_extension_revalidation');
  try { xreval = freshBookStoryboardExtensionRevalidationGrantSchema.parse(JSON.parse(xrevalBytes.toString('utf8'))); }
  catch { return fail('fresh_book_storyboard_calibration_extension_revalidation'); }
  const extFile = xreval.extension.grantFile, extBytes = fileBytes(extFile);
  if (previewSha(extBytes) !== xreval.extension.grantSha256) fail('fresh_book_storyboard_extension_revalidation_extension');
  try { ext = freshBookStoryboardExtensionGrantSchema.parse(JSON.parse(extBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_extension_revalidation_extension'); }
  const revalFile = ext.revalidation.grantFile, revalBytes = fileBytes(revalFile);
  if (previewSha(revalBytes) !== ext.revalidation.grantSha256) fail('fresh_book_storyboard_extension_revalidation');
  try { reval = freshBookStoryboardRevalidationGrantSchema.parse(JSON.parse(revalBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_extension_revalidation'); }
  const contFile = reval.continuation.grantFile, contBytes = fileBytes(contFile);
  if (previewSha(contBytes) !== reval.continuation.grantSha256) fail('fresh_book_storyboard_revalidation_continuation');
  try { cont = freshBookStoryboardContinuationGrantSchema.parse(JSON.parse(contBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_revalidation_continuation'); }
  const repairFile = cont.repair.grantFile, repairBytes = fileBytes(repairFile);
  if (previewSha(repairBytes) !== cont.repair.grantSha256) fail('fresh_book_storyboard_continuation_repair');
  try { named = freshBookStoryboardRepairGrantSchema.parse(JSON.parse(repairBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_continuation_repair'); }
  const recoveryFile = named.recovery.grantFile, recoveryBytes = fileBytes(recoveryFile);
  if (previewSha(recoveryBytes) !== named.recovery.grantSha256) fail('fresh_book_storyboard_repair_recovery');
  try { recoveryGrant = freshBookRecoveryGrantSchema.parse(JSON.parse(recoveryBytes.toString('utf8'))); } catch { return fail('fresh_book_storyboard_repair_recovery'); }
  const originalFile = recoveryGrant.original.grantFile, originalBytes = fileBytes(originalFile);
  if (previewSha(originalBytes) !== recoveryGrant.original.grantSha256) fail('fresh_book_recovery_original');
  const rereview = loadRereview(a.config);
  let roots = rootsOf(a.config, a.env, rereview, a.earlier);
  const planned = await planFreshBookStoryboardPresence(a.config, a.env, calFile, approvalFile);
  const outcome = await assertFreshBookAdmission(planned.rereview, a.env);
  const engine = a.env.head();
  if (canonicalJson(parsed.data) !== canonicalJson(planned.grantDraft)) fail('fresh_book_storyboard_presence_grant');
  if (!engine.clean || engine.head !== planned.grantDraft.engine.head || engine.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
  const frozen: [string, Buffer, string][] = [[a.grantFile, bytes, 'fresh_book_storyboard_presence_grant'],
    [approvalFile, approvalBytes, 'fresh_book_storyboard_presence_approval'], [calFile, calBytes, 'fresh_book_storyboard_presence_calibration'],
    [xrevalFile, xrevalBytes, 'fresh_book_storyboard_calibration_extension_revalidation'],
    [extFile, extBytes, 'fresh_book_storyboard_extension_revalidation_extension'], [revalFile, revalBytes, 'fresh_book_storyboard_extension_revalidation'],
    [contFile, contBytes, 'fresh_book_storyboard_revalidation_continuation'], [repairFile, repairBytes, 'fresh_book_storyboard_continuation_repair'],
    [recoveryFile, recoveryBytes, 'fresh_book_storyboard_repair_recovery'], [originalFile, originalBytes, 'fresh_book_recovery_original']];
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    for (const [file, held, code] of frozen) if (!fileBytes(file).equals(held)) fail(code);
    if (canonicalJson(rootsOf(a.config, a.env, rereview, a.earlier)) !== canonicalJson(roots)) fail('fresh_book_roots_changed');
    const e = a.env.head();
    if (!e.clean || e.head !== planned.grantDraft.engine.head || e.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(planned.grantDraft.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
  };
  const guard = () => { same(); assertFreshBookStoryboardPresencePaid({ env: a.env, grantFile: a.grantFile, grantSha: a.grantSha, profile: planned.profile, workspace: workspace() }); };
  const recapture = (added: string[]) => {
    const next = rootsOf(a.config, a.env, rereview, a.earlier), changed = Object.keys(next).filter(k => next[k] !== roots[k]);
    if (canonicalJson(Object.keys(next).sort()) !== canonicalJson(Object.keys(roots).sort()) || canonicalJson(changed.sort()) !== canonicalJson([...added].sort()) ||
        added.some(k => roots[k] !== 'absent' || next[k] === 'absent')) fail('fresh_book_roots_changed');
    roots = next; same();
  };
  same();
  return { planned, outcome, same, guard, recapture, grant: planned.grantDraft, presence: planned.input };
}

type PresencePreview = CalibrationPreview & { repeatedReferences: number };
/**
 * Provider-free preview of the presence attempt's ONE planner request, on the paid run's own code path (the shared flow under its spec): the
 * text and the correction replayed, the presence source prepared (every ancestor re-bound, every finding with its typed issues, groups,
 * repeated references and the diagnosis derived by the engine), then the planner's request and its compacted CLI wire built and measured
 * (content, wire and argv limits, output cap, session guard) and stopped before any session. The paid stage runs it before its claim.
 */
export async function previewFreshBookStoryboardPresence(config: FreshBookConfig, input: StoryboardRepair): Promise<PresencePreview> {
  const out: { preview?: PresencePreview } = {};
  try {
    await storyboardRepairFlow({ config, repair: input, signal: new AbortController().signal, log: () => {}, seen: [], spec: PRESENCE_SPEC, preview: (wire, call) => {
      const parsedInput = JSON.parse(call.input), prior = parsedInput?.priorReviewedStoryboard, diagnosis = prior?.diagnosis;
      if (!diagnosis || !Array.isArray(prior?.findingGroups) || !Array.isArray(prior?.repeatedReferences)) return fail('fresh_book_storyboard_presence_preview');
      out.preview = { contentBytes: Buffer.byteLength(call.instructions, 'utf8') + Buffer.byteLength(call.input, 'utf8'), contentByteLimit: SIMPLE_STORYBOARD_INPUT_LIMIT,
        wireBytes: wire.bytes, wireByteLimit: 104000, reservedMicroUsd: wire.reservedMicroUsd, sessionGuardMicroUsd: OPUS_PLANNER.sessionGuardMicroUsd,
        findings: Array.isArray(prior.reviewFindings) ? prior.reviewFindings.length : 0, findingGroups: prior.findingGroups.length,
        instructionsSha256: previewSha(call.instructions), inputSha256: previewSha(call.input), wireDigest: previewSha(canonicalJson(wire)),
        outputCap: wire.outputCap, argvChars: wire.args.map(x => JSON.stringify(x)).join(' ').length + String(wire.payload.executable).length, argvLimit: 31000,
        diagnosisDigest: previewSha(canonicalJson(diagnosis)), resolutionsRequired: diagnosis.findings.length, protectedPages: diagnosis.protectedPages,
        schemaCompaction: typeof wire.payload.schemaCompaction === 'string' ? wire.payload.schemaCompaction : null,
        repeatedReferences: prior.repeatedReferences.length };
      return fail('fresh_book_storyboard_presence_preview_complete');
    } });
  } catch (error) { if (!out.preview) throw error; }
  return out.preview ?? fail('fresh_book_storyboard_presence_preview');
}

/**
 * The ONE owner-directed presence attempt of the same book: admission re-derives the held calibration and its whole lineage exactly, the
 * engine's recovery state under the owner's ceiling 6 and the diagnosis, the balance must cover the review's floor, the planner request must be
 * sendable (its compacted wire within every limit); then one claim and its own folder with its admission, its input, the recovery state and the
 * diagnosis; the text and the correction are replayed, and the Opus Max planner and the Sol review run once each on the native call sites (the
 * review reserves max(600000, its bound)). Admitted: its successor is re-derived by replaying the whole chain and recorded once. Held: its
 * terminal outcome (no attempt 7). Failed: its terminal outcome. Nothing earlier is written.
 */
export async function runFreshBookStoryboardPresence(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void; transports?: Pick<FreshTextTransports, 'responses' | 'planner'> }) {
  const { config, env, signal } = args, transports = args.transports ?? {};
  const admitted = await admitStoryboardPresence({ ...args, earlier: ['request.json', 'admission.json', 'text', FRESH_BOOK_RECOVERY.folder,
    FRESH_BOOK_STORYBOARD_REPAIR.folder, CONT.folder, REVAL.folder, EXT.folder, XREVAL.folder, CAL.folder] });
  assertFreshBookExecutable(config);
  const ledger = freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_presence'), dir = path.join(config.bookDir, PRS.folder);
  if (existsSync(dir)) fail('fresh_book_storyboard_presence_used');
  assertReviewFloorFits(ledger, 'fresh_book_storyboard_presence_budget');
  // Before the claim: the exact planner request must be sendable and carry every finding of the held review, its groups, its repeated
  // references and the diagnosis the grant names.
  const preview = await previewFreshBookStoryboardPresence(config, admitted.presence);
  if (preview.findings !== admitted.grant.held.findings || preview.findingGroups !== admitted.grant.held.findingGroups ||
      preview.repeatedReferences !== admitted.grant.held.repeatedReferences || preview.diagnosisDigest !== admitted.grant.recovery.diagnosisDigest ||
      preview.schemaCompaction !== PRS.plannerSchema || preview.argvChars > preview.argvLimit || preview.wireBytes > preview.wireByteLimit ||
      preview.contentBytes > preview.contentByteLimit) fail('fresh_book_storyboard_presence_findings');
  // No await from the last check to the one presence claim and its folder.
  admitted.same();
  claimFreshBookStoryboardPresence(env, admitted.grant, args.grantSha);
  admitted.recapture([`authority/${PRS.claimName}`]);
  try { mkdirSync(dir); } catch { fail('fresh_book_storyboard_presence_used'); }
  mkdirSync(path.join(dir, 'cli-workspace'));
  exclusiveJson(path.join(dir, PRESENCE_ADMISSION_FILE), { version: PRS.version, grantSha256: args.grantSha, ownerApproval: admitted.grant.ownerApproval,
    calibration: admitted.grant.calibration, held: admitted.grant.held, recovery: admitted.grant.recovery, ledger, preview, rereviewOutcome: admitted.outcome });
  exclusiveJson(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE), admitted.presence);
  exclusiveJson(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE), admitted.planned.recoveryRecord);
  exclusiveJson(path.join(dir, CONTINUATION_DIAGNOSIS_FILE), admitted.planned.diagnosisRecord);
  const api = new AuditionMeter(path.join(dir, 'paid-stages'), ledger.nextCapMicroUsd, PRS.apiCalls, ledger.bookKnownMicroUsd, 0, STORYBOARD_EXTENSION_RULES);
  const claudeMax = new SimpleBookBudget(path.join(dir, 'claude-max-stages'), 0);
  const key = keyReader(config.keyEnvFile);
  const responses = transports.responses ?? openAIResponses(key);
  let storyboardDraft: unknown = null, failed: string | null = null;
  const seen: string[] = [];
  const record = (error: unknown): never => { failed ??= codeOf(error, 'fresh_book_provider_transport'); throw error; };
  const guard = () => { try { admitted.guard(); } catch (error) { record(error); } };
  const present = { parentStoryboardDigest: admitted.grant.held.storyboardDigest, addedContracts: [...PRS.addedContracts], attempt: PRS.maxAttempts,
    components: [...PRESENCE_COMPONENTS], plannerSchema: PRS.plannerSchema };
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    exclusiveJson(path.join(dir, 'spend.json'), api.snapshot());
    exclusiveJson(path.join(dir, 'claude-max-spend.json'), { ...claudeMax.snapshot(), note: 'Claude Max usage is separate: not an API invoice' });
    exclusiveJson(path.join(dir, 'sealed.json'), { status, ...extra, presence: present, replayed: [...seen], runtimeEligible: false });
  };
  try {
    const result = await storyboardRepairFlow({ config, repair: admitted.presence, signal, log: args.log, seen, spec: PRESENCE_SPEC,
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
    const board = result.storyboard ?? fail('fresh_book_storyboard_presence_policy');
    const final = continuationRecoveryFinal(admitted.planned.recoveryRecord, { storyboardDigest: board.storyboardDigest, status: result.status, review: board.review }, PRS.folder);
    exclusiveJson(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE), final);
    if (!admittedPresence(result.status)) finish(env, PRS.ownHeldOutcome, { textStatus: result.status, recovery: final.terminal }, PRS.outcomeName);
    else {
      // The successor's ONE durable provenance: its whole chain replayed from the saved evidence, then recorded once under a fresh guard.
      const successor = await deriveStoryboardPresenceSuccessor({ config, env, grantSha: args.grantSha, admitted });
      guard();
      exclusiveJson(path.join(env.authorityRoot, PRS.successorName), successor);
      admitted.recapture([`authority/${PRS.successorName}`]);
    }
    return { status: result.status, recovery: final, api: api.snapshot(), claudeMax: claudeMax.snapshot(),
      ledger: freshBookLedger(config, env, admitted.planned.rereview, 'storyboard_presence') };
  } catch (error) {
    const code = failed ?? codeOf(error, 'fresh_book_storyboard_presence_failed');
    if (!existsSync(path.join(dir, 'sealed.json'))) seal('failed', { code });
    if (!existsSync(path.join(env.authorityRoot, PRS.outcomeName))) finish(env, 'failed_storyboard_presence', { code }, PRS.outcomeName);
    throw error;
  }
}

type PresenceAdmitted = { grant: FreshBookStoryboardPresenceGrant; presence: StoryboardRepair; outcome: unknown;
  planned: Pick<Awaited<ReturnType<typeof planFreshBookStoryboardPresence>>, 'recoveryRecord' | 'diagnosisRecord'> };
/**
 * The presence attempt's successor, re-derived from its saved evidence (never its own seal, summary or a re-captured folder): its seal and
 * admission are this grant's; its input is exactly the held attempt-5 draft and raw review with the calibration's input as ancestry, presence,
 * both parent compile options and the owner's v2 extension; its recovery state and diagnosis are the ones the engine derives now; its meters
 * hold exactly the one floored review and the one planner session (its compacted wire the one the engine rebuilds); replaying the WHOLE chain
 * (text, correction, planner, review) on the paid run's own code path reproduces the saved admitted result exactly; its terminal recovery
 * record is the reducer's state after that result.
 */
async function deriveStoryboardPresenceSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: PresenceAdmitted }) {
  const { config, env } = a, grant = a.admitted.grant, dir = path.join(config.bookDir, PRS.folder);
  const refuse = (): never => fail('fresh_book_storyboard_presence_successor');
  try {
    const seal = json(path.join(dir, 'sealed.json'));
    if (!sortedSame(Object.keys(seal), ['presence', 'replayed', 'runtimeEligible', 'status']) || !admittedPresence(seal.status) || seal.runtimeEligible !== false ||
        !sameJson(seal.presence, { parentStoryboardDigest: grant.held.storyboardDigest, addedContracts: [...PRS.addedContracts], attempt: PRS.maxAttempts,
          components: [...PRESENCE_COMPONENTS], plannerSchema: PRS.plannerSchema }) ||
        !Array.isArray(seal.replayed) || !sortedSame(seal.replayed, REPAIR_REPLAYED)) refuse();
    const admission = json(path.join(dir, PRESENCE_ADMISSION_FILE));
    if (!sortedSame(Object.keys(admission), ['calibration', 'grantSha256', 'held', 'ledger', 'ownerApproval', 'preview', 'recovery', 'rereviewOutcome', 'version']) ||
        admission.version !== PRS.version || admission.grantSha256 !== a.grantSha || !sameJson(admission.ownerApproval, grant.ownerApproval) ||
        !sameJson(admission.calibration, grant.calibration) || !sameJson(admission.held, grant.held) || !sameJson(admission.recovery, grant.recovery) ||
        !sameJson(admission.rereviewOutcome, a.admitted.outcome) || admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd ||
        admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd) refuse();
    if (!sameJson(json(path.join(dir, STORYBOARD_REPAIR_INPUT_FILE)), plainJson(a.admitted.presence)) ||
        !sameJson(json(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE)), plainJson(a.admitted.planned.recoveryRecord)) ||
        !sameJson(json(path.join(dir, CONTINUATION_DIAGNOSIS_FILE)), plainJson(a.admitted.planned.diagnosisRecord)) ||
        previewSha(canonicalJson(json(path.join(dir, CONTINUATION_RECOVERY_STATE_FILE)))) !== grant.recovery.stateSha256) refuse();
    // The admitted preview is this attempt's own planner request: re-derived now, and the paid planner session claimed exactly that wire.
    const preview = await previewFreshBookStoryboardPresence(config, a.admitted.presence);
    if (!sameJson(admission.preview, preview) || preview.findings !== grant.held.findings || preview.findingGroups !== grant.held.findingGroups ||
        preview.repeatedReferences !== grant.held.repeatedReferences || preview.diagnosisDigest !== grant.recovery.diagnosisDigest ||
        json(path.join(dir, 'claude-max-stages', 'storyboard.claim.json')).wireDigest !== preview.wireDigest) refuse();
    const reviewed = verifyMeterRecords(path.join(dir, 'paid-stages'), STORYBOARD_EXTENSION_RULES);
    if (reviewed.length !== 1 || reviewed[0].claim.step !== 'storyboard_review' || reviewed[0].result?.completed !== true ||
        !(reviewed[0].claim.maximumMicroUsd >= REVIEW_RESERVE_FLOOR_MICRO_USD)) refuse();
    if (!sameJson(readdirSync(path.join(dir, 'claude-max-stages')).filter(n => n.endsWith('.claim.json')), ['storyboard.claim.json'])) refuse();
    const seen: string[] = [];
    const replayed = await storyboardRepairFlow({ config, repair: a.admitted.presence, signal: new AbortController().signal, log: () => {}, seen,
      spec: PRESENCE_SPEC, replayDir: dir });
    const saved = json(path.join(dir, 'simple-book-result.json')), board = replayed.storyboard;
    if (!board) return refuse();
    if (!sameJson(seal.replayed, seen.filter(k => !ownCalls(PRESENCE_SPEC).includes(k))) || !admittedPresence(replayed.status) || replayed.status !== seal.status ||
        !sameJson(plainJson(replayed), saved) || !sameJson(json(path.join(dir, 'visual_simple_book_result.json')), saved) ||
        !sameJson(json(path.join(dir, 'owned_storyboard_draft.json')), json(path.join(dir, 'claude-max-stages', 'storyboard.receipt.json')).output)) refuse();
    const final = continuationRecoveryFinal(a.admitted.planned.recoveryRecord, { storyboardDigest: board.storyboardDigest, status: replayed.status, review: board.review },
      PRS.folder);
    if (!sameJson(json(path.join(dir, CONTINUATION_RECOVERY_FINAL_FILE)), plainJson(final))) refuse();
    const c = grant.calibration;
    return { cycle: FRESH_BOOK_CYCLE.id, storyboardPresence: PRS.version, grantSha256: a.grantSha, ownerApprovalSha256: grant.ownerApproval.sha256,
      originalClaimSha256: c.originalClaimSha256, recoveryClaimSha256: c.recoveryClaimSha256, repairClaimSha256: c.repairClaimSha256,
      continuationClaimSha256: c.continuationClaimSha256, revalidationClaimSha256: c.revalidationClaimSha256, extensionClaimSha256: c.extensionClaimSha256,
      extensionRevalidationClaimSha256: c.extensionRevalidationClaimSha256, calibrationClaimSha256: c.claimSha256,
      presenceClaimSha256: previewSha(fileBytes(path.join(env.authorityRoot, PRS.claimName))),
      parentStoryboardDigest: grant.held.storyboardDigest, storyboardDigest: board.storyboardDigest, reviewDigest: board.review.reviewDigest,
      disposition: replayed.status, notes: board.review.impact?.notes.length ?? 0, reviewReserveMicroUsd: reviewed[0].claim.maximumMicroUsd as number,
      recoveryStateSha256: grant.recovery.stateSha256, diagnosisDigest: grant.recovery.diagnosisDigest,
      recoveryFinalSha256: previewSha(canonicalJson(final)), successorSha256: previewSha(canonicalJson(folderBaseline(dir))) };
  } catch { return refuse(); }
}
/** At every downstream entry: the presence attempt's successor re-derived now must equal its one durable record. */
async function verifyStoryboardPresenceSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: PresenceAdmitted }) {
  const record = await deriveStoryboardPresenceSuccessor(a), file = path.join(a.env.authorityRoot, PRS.successorName);
  if (!existsSync(file) || !sameJson(json(file), record)) fail('fresh_book_storyboard_presence_successor');
  return record;
}

// ---------------------------------------------------------------------------------------------------------------
// Stage 2: the inspected child anchor.
// ---------------------------------------------------------------------------------------------------------------
type Render = (step: string, prompt: string, refs: AuditionImage[], mode: 'style' | 'book_design', roles?: readonly BookDesignReferenceRole[]) => Promise<AuditionImage>;
/**
 * The anchor's authority from THIS book: the configured design, the storyboard's wardrobe, the request the renderer plans, its context.
 * `pose` (opt-in): the pose contract version the request and the context are both built under (absent: production's request, unchanged).
 */
function anchorAuthority(profile: FreshBookProfile, wardrobe: string, pose?: ChildAnchorPoseVersion) {
  const child: ChildAnchorChild = { age: profile.child.age, gender: profile.child.gender, design: profile.child.design, wardrobe };
  const technique = resolveChildAnchorTechnique(workspace()), request = pose ? childAnchorPoseDescriptionRequest(child, pose) : childAnchorDescriptionRequest(child);
  assertChildAnchorRenderPlan(request.prompt, technique.length, request.referenceMode);
  return { child, technique, request, pose, context: childAnchorInspectionContext(child, request.prompt, profile.childAnchor, pose) };
}

export async function runFreshBookChild(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void; recovery?: true; storyboardRepair?: true; storyboardContinuation?: true; storyboardRevalidation?: true; storyboardExtension?: true;
  storyboardExtensionRevalidation?: true; storyboardCalibration?: true; storyboardPresence?: true }) {
  const { config, env, signal } = args, line = lineOf(args.recovery, args.storyboardRepair, args.storyboardContinuation, args.storyboardRevalidation,
    args.storyboardExtension, args.storyboardExtensionRevalidation, args.storyboardCalibration, args.storyboardPresence);
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

/** The live I/O of one inspected attempt: the render seam, the two judges, the guard, the record writer and the log. */
type AttemptIO = { render: Render; style: ChildAnchorInspectedStyleJudge; design: ChildAnchorInspectedDesignJudge; check: () => void;
  save: (name: string, value: unknown) => void; log: (line: string) => void };
type AttemptStep = 'reference_child' | 'reference_child_repair';
/** The saved record of one inspected design + age review, exactly as an attempt writes it (a verifier rebuilds it from the settled answer). */
const designReviewRecord = (recipe: ChildAnchorRecipe, recipeSha: string, design: ReturnType<typeof childAnchorInspectedDesignDisposition>) =>
  ({ recipe, recipeSha, design: design.design, apparentAge: design.apparentAge, visibleEvidence: design.visibleEvidence,
    unobservedConditional: design.unobservedConditional,
    ...('acceptedDeviations' in design ? { acceptedDeviations: design.acceptedDeviations, recognizableCharacter: design.recognizableCharacter } : {}), review: design.full });
/**
 * ONE inspected attempt (the child stage's and the child recovery's one call path): its render, its inspected style review, then (unless style
 * is unassessable) its inspected design + age review, both bound to this candidate, THIS context and the recipe rebuilt from the attempt's own
 * inputs, each saved as reviewed; its outcome under the unchanged disposition. A correction that returns its rejected input unchanged refuses.
 */
async function anchorAttempt(a: AttemptIO, context: ChildAnchorInspectionContext, age: number, step: AttemptStep, prompt: string, inputs: AuditionImage[],
  mode: 'style' | 'book_design', roles: readonly BookDesignReferenceRole[] | undefined, references: ChildAnchorRecipe['references'], rejected: AuditionImage | null) {
  a.check();
  const candidate = await a.render(step, prompt, inputs, mode, roles); a.check();
  if (rejected && candidate.imageSha === rejected.imageSha) fail('fresh_book_child_repair_unchanged');
  const recipe = childAnchorAttemptRecipe(step, mode, references, prompt, age), recipeSha = childAnchorRecipeSha(recipe);
  const styleAnswer = await a.style(`${step}_style_qa`, candidate, context, recipeSha); a.check();
  const style = childAnchorStyleDisposition(styleAnswer, candidate.imageSha, childAnchorInspectionContextSha(context), recipeSha);
  a.save(`${step}_style_review`, { recipe, recipeSha, ...style }); a.log(`${step} style: ${style.disposition}`);
  if (style.disposition === 'held_uncertain') return { candidate, recipe, style, design: null, outcome: childAnchorDisposition(style, null) };
  const design = childAnchorInspectedDesignDisposition(await a.design(`${step}_qa`, candidate, context, recipe), candidate.imageSha, context, recipe); a.check();
  a.save(`${step}_design_review`, designReviewRecord(recipe, recipeSha, design));
  a.log(`${step} design: ${design.design}, apparent age: ${design.apparentAge.verdict}`);
  return { candidate, recipe, style, design, outcome: childAnchorDisposition(style, design) };
}

/**
 * The one correction the general child stage plans after its first attempt: a known defect's corrections (repair), or (opt-in, under a pose
 * contract only) the typed visibility recovery of a hold; its prompt on the request's core (pose-aware under a pose contract). Null when the
 * first attempt neither repairs nor recovers. The live stage and its settled verifier call the same function.
 */
function anchorCorrection(anchor: ReturnType<typeof anchorAuthority>, first: Pick<SettledAttempt, 'outcome' | 'style' | 'design'>, visibilityRecovery?: true) {
  if (visibilityRecovery && !anchor.pose) fail('fresh_book_child_visibility_needs_pose');
  const recovery = visibilityRecovery && anchor.pose && first.outcome.disposition === 'held_uncertain'
    ? childAnchorVisibilityRecovery(first.style, first.design, anchor.pose) : null;
  const corrections = first.outcome.disposition === 'repair' ? first.outcome.corrections : recovery?.corrections;
  if (!corrections) return null;
  return { corrections, recovery, prompt: anchor.pose ? childAnchorPoseCorrectionPrompt(anchor.request.core, corrections) : childAnchorCorrectionPrompt(anchor.request.core, corrections) };
}
/**
 * The inspected anchor: render in style mode from the pinned technique files, its inspected style review, then (unless style is unassessable)
 * its inspected design + age review, both bound to this candidate, THIS context and the render recipe. One correction edit only for a known
 * defect (or, opt-in under a pose contract, a typed-visibility hold), judged again under the SAME context (an earlier image's PASS never
 * carries). All three dimensions of the final candidate must pass.
 */
async function inspectedAnchor(a: AttemptIO & { anchor: ReturnType<typeof anchorAuthority>; images: string; visibilityRecovery?: true }) {
  const { technique, request, context, child } = a.anchor;
  const refs = technique.map((t, i) => {
    const imageName = `style_ref_${i + 1}.png`, file = path.join(a.images, imageName);
    writeFileSync(file, t.bytes, { flag: 'wx' });
    if (previewSha(readFileSync(file)) !== t.sha256) fail('child_anchor_reference_changed');
    return { imageName, imageSha: t.sha256 };
  });
  let current = await anchorAttempt(a, context, child.age, 'reference_child', request.prompt, refs, 'style', undefined,
    technique.map(t => ({ role: t.label, sha256: t.sha256 })), null);
  const correction = anchorCorrection(a.anchor, current, a.visibilityRecovery);
  if (correction) {
    const rejected = current.candidate;
    assertChildAnchorRenderPlan(correction.prompt, 1, 'book_design', CHILD_ANCHOR_CORRECTION_ROLES);
    a.save('reference_child_correction_input', { candidate: rejected, corrections: correction.corrections,
      ...(correction.recovery ? { recovery: { version: correction.recovery.version, pose: correction.recovery.pose, aspects: correction.recovery.aspects } } : {}),
      authority: 'rejected_edit_input_only_not_canonical' });
    current = await anchorAttempt(a, context, child.age, 'reference_child_repair', correction.prompt, [rejected], 'book_design', CHILD_ANCHOR_CORRECTION_ROLES,
      [{ role: 'rejected_edit_target', sha256: rejected.imageSha }], rejected);
  }
  if (current.outcome.disposition !== 'passed' || !current.design) return { status: 'held' as const, disposition: current.outcome.disposition };
  const record = childAnchorInspectedAdoptionRecord(context, current.recipe, current.style.review, current.design.full);
  const accepted = assertChildAnchorInspectedAccepted(record, current.candidate.imageSha, context);
  return { status: 'passed' as const, candidate: current.candidate, record, acceptedDeviations: accepted.acceptedDeviations };
}

/** One settled call of a child folder's meter: its saved request and receipt, completed and priced. */
function settledChildCall(paid: string, step: string) {
  const at = (k: string) => path.join(paid, `${step}.${k}.json`);
  if (!existsSync(at('result'))) fail('child_anchor_evidence_missing');
  const result = json(at('result'));
  if (result.completed !== true || !Number.isSafeInteger(result.estimatedMicroUsd)) fail('child_anchor_evidence_missing');
  return { wire: json(at('wire')), receipt: json(at('receipt')) };
}
const settledAnswer = (receipt: any) => { try { return JSON.parse(receipt.raw.output_text); } catch { return fail('child_anchor_evidence_missing'); } };
/**
 * ONE inspected attempt as a child folder settled it (the child stage's and the child recovery's one verifier path): its recipe rebuilt from the
 * attempt's own inputs, its render wire the planned request with exactly these references, its image the receipt's candidate (by digest), each
 * review wire exactly the request binding that recipe and THIS context to that candidate, each answer the settled provider output.
 */
async function settledAnchorAttempt(childDir: string, context: ChildAnchorInspectionContext, age: number, step: AttemptStep, prompt: string,
  mode: 'style' | 'book_design', roles: readonly BookDesignReferenceRole[] | undefined, references: ChildAnchorRecipe['references']) {
  const paid = path.join(childDir, 'paid-stages'), images = path.join(childDir, 'illustrations'), contextSha = childAnchorInspectionContextSha(context);
  const recipe = childAnchorAttemptRecipe(step, mode, references, prompt, age), recipeSha = childAnchorRecipeSha(recipe);
  const render = settledChildCall(paid, step), plan = assertChildAnchorRenderPlan(prompt, references.length, mode, roles), candidate = render.receipt?.candidate as AuditionImage;
  if (!sameJson(render.wire.body, plan.bodyWithoutBinaryImage) || render.wire.mode !== plan.apiMode || !sameJson(render.wire.referenceRoles ?? null, plan.referenceRoles ?? null) ||
      !Array.isArray(render.wire.references) || !sameJson(render.wire.references.map((r: AuditionImage) => r.imageSha), references.map(r => r.sha256)) ||
      typeof candidate?.imageSha !== 'string' || !/^[a-z0-9_]+\.png$/.test(candidate.imageName ?? '')) fail('child_anchor_render_binding');
  const bytes = fileBytes(path.join(images, candidate.imageName));
  if (previewSha(bytes) !== candidate.imageSha) fail('child_anchor_render_binding');
  const styleCall = settledChildCall(paid, `${step}_style_qa`);
  if (!sameJson(styleCall.wire, inspectedStyleWire(candidate, bytes, context, recipeSha))) fail('child_anchor_review_binding');
  const style = childAnchorStyleDisposition(settledAnswer(styleCall.receipt), candidate.imageSha, contextSha, recipeSha);
  if (style.disposition === 'held_uncertain') return { candidate, bytes, recipe, recipeSha, style, design: null, outcome: childAnchorDisposition(style, null) };
  const designCall = settledChildCall(paid, `${step}_qa`);
  if (!sameJson(designCall.wire, await inspectedDesignWire(candidate, bytes, context, recipe))) fail('child_anchor_review_binding');
  const design = childAnchorInspectedDesignDisposition(settledAnswer(designCall.receipt), candidate.imageSha, context, recipe);
  return { candidate, bytes, recipe, recipeSha, style, design, outcome: childAnchorDisposition(style, design) };
}
type SettledAttempt = Awaited<ReturnType<typeof settledAnchorAttempt>>;
/** The step names a child folder claimed, from its meter's claim records. */
const claimedSteps = (childDir: string) => readdirSync(path.join(childDir, 'paid-stages')).filter(n => n.endsWith('.claim.json')).map(n => n.slice(0, -'.claim.json'.length));

/**
 * The inspected anchor's acceptance as the stage actually requested and was answered: each attempt's recipe rebuilt from the admitted request
 * (the correction's prompt from the first attempt's settled answers), its render wire the planned request, each review wire exactly the
 * request binding that recipe and THIS context to the returned candidate, each answer the settled provider output; exactly these calls; the
 * adoption is the record those answers derive. A saved adoption's own echoes are never the authority.
 */
export async function assertInspectedChildSettled(bookDir: string, anchor: ReturnType<typeof anchorAuthority>, adoption: any, candidateBytes: Buffer,
  options: { childDir?: string; visibilityRecovery?: true } = {}) {
  return (await settledInspectedChild(bookDir, anchor, adoption, candidateBytes, options)).accepted;
}
/** The settled child stage of one folder (`options.childDir`, default `child`): its attempts, its one correction and the acceptance they derive. */
async function settledInspectedChild(bookDir: string, anchor: ReturnType<typeof anchorAuthority>, adoption: any, candidateBytes: Buffer,
  options: { childDir?: string; visibilityRecovery?: true }) {
  const childDir = path.join(bookDir, options.childDir ?? 'child'), { request, technique, context, child } = anchor;
  const first = await settledAnchorAttempt(childDir, context, child.age, 'reference_child', request.prompt, 'style', undefined,
    technique.map(t => ({ role: t.label, sha256: t.sha256 })));
  const correction = anchorCorrection(anchor, first, options.visibilityRecovery);
  const final = !correction ? first
    : await settledAnchorAttempt(childDir, context, child.age, 'reference_child_repair', correction.prompt, 'book_design',
      CHILD_ANCHOR_CORRECTION_ROLES, [{ role: 'rejected_edit_target', sha256: first.candidate.imageSha }]);
  const candidateSha = previewSha(candidateBytes);
  if (final.outcome.disposition !== 'passed' || !final.design || final.candidate.imageSha !== candidateSha) fail('child_anchor_not_accepted');
  const steps = (final === first ? ['reference_child'] : ['reference_child', 'reference_child_repair']).flatMap(s => [s, `${s}_style_qa`, `${s}_qa`]);
  if (!sortedSame(claimedSteps(childDir), steps)) fail('child_anchor_evidence_steps');
  const record = childAnchorInspectedAdoptionRecord(context, final.recipe, final.style.review, final.design!.full);
  if (!sameJson(adoption?.anchor, record) || adoption?.candidate?.imageSha !== candidateSha || !sameJson(adoption?.context, context)) fail('child_anchor_evidence_binding');
  return { first, final, correction, record, accepted: assertChildAnchorInspectedAccepted(record, candidateSha, context) };
}

// ---------------------------------------------------------------------------------------------------------------
// The ONE owner-approved child recovery (Guy 2026-10-21): the presence line's held child anchor corrected once under child-anchor-visible-pose/v1
// and the typed child-anchor-visibility-recovery/v1, that one candidate reviewed twice; the book on its gates only if it passes.
// ---------------------------------------------------------------------------------------------------------------
const CR = FRESH_BOOK_CHILD_RECOVERY;
/** The recovery folder's own admission record (beside its context, its correction input and its reviews). */
export const CHILD_RECOVERY_ADMISSION_FILE = 'child-recovery-admission.json';
/** The held anchor's image, copied byte-exact into the recovery folder as its ONE edit input (the rejected edit target only, never canonical). */
const HELD_INPUT_IMAGE = 'reference_child.png';
/**
 * The recovery's authority from THIS book: the held anchor's own (production's description request, the technique files, its context) and the
 * pose route (the pose description request and the context whose view binds its pose clause), from one child definition.
 */
function recoveryAuthority(profile: FreshBookProfile, wardrobe: string) {
  const held = anchorAuthority(profile, wardrobe), request = childAnchorPoseDescriptionRequest(held.child);
  return { held, request, context: childAnchorInspectionContext(held.child, request.prompt, profile.childAnchor, CHILD_ANCHOR_POSE_VERSION) };
}
/**
 * The ONE correction the typed recovery plans from the held anchor's settled answers: the engine's recovery (never the judge's identity text),
 * its prompt on the pose request's core, the real image seam's plan for exactly one rejected edit target, the recipe it binds and that edit's
 * claim maximum. A hold that is not visibility-only refuses.
 */
function recoveryCorrection(rec: ReturnType<typeof recoveryAuthority>, held: SettledAttempt) {
  const recovery = childAnchorVisibilityRecovery(held.style, held.design) ?? fail('fresh_book_child_recovery_not_visibility');
  const prompt = childAnchorPoseCorrectionPrompt(rec.request.core, recovery.corrections);
  const plan = assertChildAnchorRenderPlan(prompt, 1, 'book_design', CHILD_ANCHOR_CORRECTION_ROLES);
  const references: ChildAnchorRecipe['references'] = [{ role: 'rejected_edit_target', sha256: held.candidate.imageSha }];
  const recipe = childAnchorAttemptRecipe('reference_child_repair', 'book_design', references, prompt, rec.held.child.age);
  return { recovery, prompt, finalPrompt: plan.finalPrompt, references, recipe, recipeSha: childAnchorRecipeSha(recipe),
    contextSha: childAnchorInspectionContextSha(rec.context), renderMaximumMicroUsd: renderMaximum(plan.finalPrompt, 1) };
}
/** The recovery's reservation: the one edit's claim maximum and both reviews' slots must fit under the balance before the claim. */
function assertChildRecoveryFits(ledger: { bookKnownMicroUsd: number; nextCapMicroUsd: number }, renderMaximumMicroUsd: number) {
  const reserveMicroUsd = renderMaximumMicroUsd + CR.reviewCalls * SOL_PIXEL_REVIEW_SLOT_MICRO_USD;
  if (SOL_PIXEL_REVIEW_SLOT_MICRO_USD !== CR.reviewReserveMicroUsd || !Number.isSafeInteger(reserveMicroUsd) ||
      ledger.bookKnownMicroUsd + reserveMicroUsd > ledger.nextCapMicroUsd) fail('fresh_book_child_recovery_budget');
  return { remainingMicroUsd: ledger.nextCapMicroUsd - ledger.bookKnownMicroUsd, reserveMicroUsd };
}
/** The consumed grants the presence grant's chain names (calibration back to the original), each read at its recorded digest. */
function presenceChainGrants(presence: FreshBookStoryboardPresenceGrant): [string, Buffer, string][] {
  const read = <T>(file: string, digest: string, schema: { parse(value: unknown): T }, code: string): [T, Buffer] => {
    const bytes = fileBytes(file);
    if (previewSha(bytes) !== digest) fail(code);
    try { return [schema.parse(JSON.parse(bytes.toString('utf8'))), bytes]; } catch { return fail(code); }
  };
  const calFile = presence.calibration.grantFile;
  const [cal, calBytes] = read(calFile, presence.calibration.grantSha256, freshBookStoryboardCalibrationGrantSchema, 'fresh_book_storyboard_presence_calibration');
  const xrevalFile = cal.extensionRevalidation.grantFile;
  const [xreval, xrevalBytes] = read(xrevalFile, cal.extensionRevalidation.grantSha256, freshBookStoryboardExtensionRevalidationGrantSchema,
    'fresh_book_storyboard_calibration_extension_revalidation');
  const extFile = xreval.extension.grantFile;
  const [ext, extBytes] = read(extFile, xreval.extension.grantSha256, freshBookStoryboardExtensionGrantSchema, 'fresh_book_storyboard_extension_revalidation_extension');
  const revalFile = ext.revalidation.grantFile;
  const [reval, revalBytes] = read(revalFile, ext.revalidation.grantSha256, freshBookStoryboardRevalidationGrantSchema, 'fresh_book_storyboard_extension_revalidation');
  const contFile = reval.continuation.grantFile;
  const [cont, contBytes] = read(contFile, reval.continuation.grantSha256, freshBookStoryboardContinuationGrantSchema, 'fresh_book_storyboard_revalidation_continuation');
  const repairFile = cont.repair.grantFile;
  const [repair, repairBytes] = read(repairFile, cont.repair.grantSha256, freshBookStoryboardRepairGrantSchema, 'fresh_book_storyboard_continuation_repair');
  const recoveryFile = repair.recovery.grantFile;
  const [recovery, recoveryBytes] = read(recoveryFile, repair.recovery.grantSha256, freshBookRecoveryGrantSchema, 'fresh_book_storyboard_repair_recovery');
  const originalFile = recovery.original.grantFile, originalBytes = fileBytes(originalFile);
  if (previewSha(originalBytes) !== recovery.original.grantSha256) fail('fresh_book_recovery_original');
  return [[calFile, calBytes, 'fresh_book_storyboard_presence_calibration'], [xrevalFile, xrevalBytes, 'fresh_book_storyboard_calibration_extension_revalidation'],
    [extFile, extBytes, 'fresh_book_storyboard_extension_revalidation_extension'], [revalFile, revalBytes, 'fresh_book_storyboard_extension_revalidation'],
    [contFile, contBytes, 'fresh_book_storyboard_revalidation_continuation'], [repairFile, repairBytes, 'fresh_book_storyboard_continuation_repair'],
    [recoveryFile, recoveryBytes, 'fresh_book_storyboard_repair_recovery'], [originalFile, originalBytes, 'fresh_book_recovery_original']];
}

/**
 * The consumed presence line and the held child the recovery stands on, re-read exactly: the presence grant its claim names (naming every
 * earlier claim of the chain, at that grant's own head) and its owner record; everything that grant recorded except its own head and pins,
 * re-derived now by the engine and equal; its admitted storyboard's successor re-derived by replaying the whole chain and equal to its one
 * durable record; its terminal record exactly held_child / held_uncertain and no audition start of its own; the held child folder exactly the
 * presence child stage's: its three claimed calls (render, style review, design + age review) re-derive under ITS context (production's request)
 * to held_uncertain, its seal, context, saved reviews, images and spend are what they derive; then the engine's typed recovery of those answers
 * and the one correction it plans. The ledger it stands on is every stage through the held child.
 */
async function presenceChildHeld(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, loaded: ReturnType<typeof loadProfile>,
  presenceGrantFile: string) {
  const { profile } = loaded, refuse = (): never => fail('fresh_book_child_recovery_presence');
  if (!path.isAbsolute(presenceGrantFile)) refuse();
  const at = (name: string) => path.join(env.authorityRoot, name), childDir = path.join(config.bookDir, 'child');
  const files = { grant: presenceGrantFile, claim: at(PRS.claimName), outcome: at(PRS.outcomeName), successor: at(PRS.successorName),
    calibrationClaim: at(CAL.claimName), extensionRevalidationClaim: at(XREVAL.claimName), extensionClaim: at(EXT.claimName), revalidationClaim: at(REVAL.claimName),
    continuationClaim: at(CONT.claimName), repairClaim: at(FRESH_BOOK_STORYBOARD_REPAIR.claimName), recoveryClaim: at(FRESH_BOOK_RECOVERY.claimName),
    originalClaim: at(FRESH_BOOK_CYCLE.claimName), seal: path.join(childDir, 'sealed.json') };
  if (Object.values(files).some(f => !existsSync(f)) || existsSync(at(PRS.auditionStartName))) refuse();
  const digest = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, previewSha(fileBytes(f))])) as Record<keyof typeof files, string>;
  const parsed = freshBookStoryboardPresenceGrantSchema.safeParse(json(files.grant));
  if (!parsed.success) return refuse();
  const grant = parsed.data, claim = json(files.claim), c = grant.calibration;
  const sameDir = (p: unknown) => typeof p === 'string' && path.resolve(p).toLowerCase() === path.resolve(config.bookDir).toLowerCase();
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardPresence !== PRS.version || claim.grantSha256 !== digest.grant ||
      claim.ownerApprovalSha256 !== grant.ownerApproval.sha256 || previewSha(fileBytes(grant.ownerApproval.file)) !== grant.ownerApproval.sha256 ||
      claim.calibrationClaimSha256 !== digest.calibrationClaim || c.claimSha256 !== digest.calibrationClaim ||
      claim.extensionRevalidationClaimSha256 !== digest.extensionRevalidationClaim || c.extensionRevalidationClaimSha256 !== digest.extensionRevalidationClaim ||
      claim.extensionClaimSha256 !== digest.extensionClaim || c.extensionClaimSha256 !== digest.extensionClaim ||
      claim.revalidationClaimSha256 !== digest.revalidationClaim || c.revalidationClaimSha256 !== digest.revalidationClaim ||
      claim.continuationClaimSha256 !== digest.continuationClaim || c.continuationClaimSha256 !== digest.continuationClaim ||
      claim.repairClaimSha256 !== digest.repairClaim || c.repairClaimSha256 !== digest.repairClaim ||
      claim.recoveryClaimSha256 !== digest.recoveryClaim || c.recoveryClaimSha256 !== digest.recoveryClaim ||
      claim.originalClaimSha256 !== digest.originalClaim || c.originalClaimSha256 !== digest.originalClaim || claim.engineHead !== grant.engine.head ||
      !sameDir(claim.bookDir) || !sameDir(grant.bookDir) || grant.profileSha256 !== freshBookProfileSha(profile) || claim.profileSha256 !== grant.profileSha256) refuse();
  // Everything the consumed presence grant recorded, except its own head and pins (they bind ITS head), re-derived now by the engine.
  const replanned = await planFreshBookStoryboardPresence(config, env, c.grantFile, grant.ownerApproval.file);
  if (!sameJson({ ...replanned.grantDraft, engine: grant.engine, pins: grant.pins }, grant)) refuse();
  // Its admitted storyboard: the successor re-derived by replaying the whole chain, equal to its one durable record.
  const presenceAdmitted: PresenceAdmitted = { grant, presence: replanned.input, outcome: await assertFreshBookAdmission(rereview, env),
    planned: { recoveryRecord: replanned.recoveryRecord, diagnosisRecord: replanned.diagnosisRecord } };
  const successor = await verifyStoryboardPresenceSuccessor({ config, env, grantSha: digest.grant, admitted: presenceAdmitted });
  if (!admittedPresence(successor.disposition)) refuse();
  // Its terminal record: its own child stage held the anchor.
  const outcome = json(files.outcome);
  if (!sortedSame(Object.keys(outcome), ['cycle', 'disposition', 'finishedAt', 'status']) || outcome.cycle !== FRESH_BOOK_CYCLE.id ||
      outcome.status !== CR.heldOutcome || outcome.disposition !== CR.heldDisposition) refuse();
  // The held child: the presence child stage's folder exactly, its three settled calls re-derived under ITS context (production's request).
  const board = loadReviewedStoryboard(config.bookDir, workspace(), layoutFor(profile, undefined, PRS.folder));
  const rec = recoveryAuthority(profile, board.book.plan.wardrobe), anchor = rec.held;
  const first = await settledAnchorAttempt(childDir, anchor.context, anchor.child.age, 'reference_child', anchor.request.prompt, 'style', undefined,
    anchor.technique.map(t => ({ role: t.label, sha256: t.sha256 })));
  const firstDesign = first.design ?? refuse();
  if (first.outcome.disposition !== CR.heldDisposition || !sortedSame(claimedSteps(childDir), ['reference_child', 'reference_child_style_qa', 'reference_child_qa'])) refuse();
  const images = path.join(childDir, 'illustrations');
  if (!sameJson(json(files.seal), { status: 'child_reference_held', disposition: CR.heldDisposition, childAnchor: profile.childAnchor, runtimeEligible: false }) ||
      !sameJson(json(path.join(childDir, 'context.json')), anchor.context) ||
      !sameJson(json(path.join(childDir, 'reference_child_style_review.json')), plainJson({ recipe: first.recipe, recipeSha: first.recipeSha, ...first.style })) ||
      !sameJson(json(path.join(childDir, 'reference_child_design_review.json')), plainJson(designReviewRecord(first.recipe, first.recipeSha, firstDesign))) ||
      !sortedSame(readdirSync(childDir), ['context.json', 'illustrations', 'paid-stages', 'reference_child_design_review.json', 'reference_child_style_review.json',
        'sealed.json', 'spend.json']) || !sortedSame(readdirSync(images), [first.candidate.imageName, 'style_ref_1.png', 'style_ref_2.png']) ||
      anchor.technique.some((t, i) => previewSha(fileBytes(path.join(images, `style_ref_${i + 1}.png`))) !== t.sha256)) refuse();
  // Its spend record is its own meter's, re-derived from its calls on the ledger before it.
  const before = freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env), stages: bookStages(config.bookDir, 'storyboard_presence').slice(0, -2) });
  if (!sameJson(json(path.join(childDir, 'spend.json')), new AuditionMeter(path.join(childDir, 'paid-stages'), before.nextCapMicroUsd, CHILD_API_CALLS,
    before.bookKnownMicroUsd, 0, CHILD_RULES).snapshot())) refuse();
  const correction = recoveryCorrection(rec, first);
  const through = freshBookCycleLedger({ diagnosticSettledMicroUsd: before.diagnosticSettledMicroUsd, stages: bookStages(config.bookDir, 'child_recovery').slice(0, -2) });
  return { presence: { grantFile: path.resolve(presenceGrantFile), grantSha256: digest.grant, claimSha256: digest.claim, outcomeSha256: digest.outcome,
      successorSha256: digest.successor, storyboardDigest: successor.storyboardDigest, calibrationClaimSha256: digest.calibrationClaim,
      extensionRevalidationClaimSha256: digest.extensionRevalidationClaim, extensionClaimSha256: digest.extensionClaim, revalidationClaimSha256: digest.revalidationClaim,
      continuationClaimSha256: digest.continuationClaim, repairClaimSha256: digest.repairClaim, recoveryClaimSha256: digest.recoveryClaim,
      originalClaimSha256: digest.originalClaim },
    held: { folderSha256: previewSha(canonicalJson(folderBaseline(childDir))), sealSha256: digest.seal, candidateSha256: first.candidate.imageSha,
      recipeSha256: first.recipeSha, contextSha256: childAnchorInspectionContextSha(anchor.context), style: first.style.disposition, design: firstDesign.design,
      disposition: first.outcome.disposition },
    recovery: { version: correction.recovery.version, pose: correction.recovery.pose, aspects: correction.recovery.aspects, corrections: correction.recovery.corrections,
      correctionPromptSha256: previewSha(correction.prompt), recipeSha256: correction.recipeSha, contextSha256: correction.contextSha,
      renderMaximumMicroUsd: correction.renderMaximumMicroUsd },
    ledger: { diagnosticSettledMicroUsd: through.diagnosticSettledMicroUsd, bookKnownMicroUsd: through.bookKnownMicroUsd,
      calls: through.stages.reduce((n, s) => n + s.calls, 0) },
    rec, first, correction, presenceGrant: grant };
}
type ChildRecoveryHeld = Awaited<ReturnType<typeof presenceChildHeld>>;

/** Provider-free plan and the child-recovery grant this exact state needs (no key, no provider, no write). */
export async function planFreshBookChildRecovery(config: FreshBookConfig, env: FreshBookEnv, presenceGrantFile: string, ownerApprovalFile: string) {
  const base = planFreshBook(config, env), loaded = loadProfile(config);
  const approval = ownerApproval(ownerApprovalFile, CR.approvalLine, 'fresh_book_child_recovery_approval');
  const held = await presenceChildHeld(config, env, base.rereview, loaded, presenceGrantFile);
  const at = (name: string) => path.join(env.authorityRoot, name);
  const plan = { version: CR.version, cycle: FRESH_BOOK_CYCLE.id, amendment: CR.amendment, ownerApproval: approval, basePlanSha256: base.grantDraft.nativePlanSha256,
    bookDir: path.resolve(config.bookDir), folder: CR.folder, storyboardDir: PRS.folder, childDir: CR.folder,
    presence: held.presence, held: held.held,
    storyboard: 'the presence line\'s admitted storyboard, its successor re-derived by replaying the whole chain; no author, editor, planner or storyboard call',
    pose: { contract: CHILD_ANCHOR_POSE_VERSION, clauseSha256: CHILD_ANCHOR_POSE_CLAUSE_SHA256, replaces: CHILD_ANCHOR_PRODUCTION_POSE_LINE,
      requestPromptSha256: previewSha(held.rec.request.prompt), view: 'the corrected candidate is reviewed under the context whose view binds this clause' },
    recovery: held.recovery,
    calls: { edit: `reference_child_repair: gpt-image-2 LOW 1024x1024 images.edit of the held candidate ${held.held.candidateSha256} only (rejected_edit_target), ${CR.editCalls}`,
      reviews: `reference_child_repair_style_qa, reference_child_repair_qa: Sol 6.1 (${SOL}), ${CR.reviewCalls}, each claimed at ${CR.reviewReserveMicroUsd}; the design review is not sent when the style review is unassessable (held)`,
      reserveMicroUsd: held.recovery.renderMaximumMicroUsd + CR.reviewCalls * CR.reviewReserveMicroUsd },
    acceptance: 'the corrected candidate passes only under the unchanged disposition (style, every design category, apparent age, materiality); no recovery applies to it; anything else ends the line',
    downstream: ['book --child-recovery [--resume]: two samples first, then the rest and the cover only if both pass (LOW, max 3 attempts/page)'],
    caps: { ...base.plan.caps, childRecoveryApiCalls: CR.apiCalls },
    claim: at(CR.claimName), outcome: at(CR.outcomeName), successor: at(CR.successorName),
    successorAdmission: 'downstream re-derives the presence chain, the held child, the typed recovery and the recovered child from the saved evidence against its one durable record',
    providerCalls: 0, keyRead: false };
  const engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_CHILD_RECOVERY_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft: FreshBookChildRecoveryGrant = freshBookChildRecoveryGrantSchema.parse({ version: 'fresh-book-child-recovery-grant/v1',
    cycle: FRESH_BOOK_CYCLE.id, approval: FRESH_BOOK_CYCLE.approval, amendment: CR.amendment, ownerApproval: approval, profileSha256: base.plan.profileSha256,
    bookDir: path.resolve(config.bookDir), presence: held.presence, held: held.held, recovery: held.recovery, ledger: held.ledger,
    allowance: { apiCalls: CR.apiCalls, editCalls: CR.editCalls, reviewCalls: CR.reviewCalls, reviewReserveMicroUsd: CR.reviewReserveMicroUsd },
    engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)) });
  const probe = (f: () => unknown) => { try { return f(); } catch (e) { return { refused: e && typeof e === 'object' && 'code' in e ? e.code : String(e) }; } };
  const state = { claimExists: existsSync(plan.claim), outcomeExists: existsSync(plan.outcome), successorExists: existsSync(plan.successor),
    folderExists: existsSync(path.join(config.bookDir, CR.folder)), layoutExists: existsSync(path.join(config.bookDir, 'book-layout.json')),
    ledger: probe(() => freshBookLedger(config, env, base.rereview, 'child_recovery')),
    budget: probe(() => assertChildRecoveryFits(freshBookLedger(config, env, base.rereview, 'child_recovery'), held.recovery.renderMaximumMicroUsd)), engine };
  return { plan, grantDraft, state, profile: base.profile, prepared: loaded.prepared, rereview: base.rereview, held };
}

/**
 * A child-recovery-line stage's admission, as admitStoryboardPresence: the baseline pinned FIRST and held across every await: the recovery grant
 * bytes, the owner's record bytes, the consumed presence grant and every grant its chain names (each at its recorded digest, never re-pinned to
 * this head), configuration, profile, lineage, every line's authority records and the earlier stage entries (the held child among them). The
 * grant is exactly the draft this state rebuilds, at the clean reviewed head. Its guard adds the recovery claim and every record it names.
 */
async function admitChildRecovery(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal; earlier: string[] }) {
  const bytes = fileBytes(a.grantFile);
  if (previewSha(bytes) !== a.grantSha) fail('fresh_book_child_recovery_grant');
  const parsed = freshBookChildRecoveryGrantSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success) return fail('fresh_book_child_recovery_grant');
  const approvalFile = parsed.data.ownerApproval.file, approvalBytes = fileBytes(approvalFile);
  if (previewSha(approvalBytes) !== parsed.data.ownerApproval.sha256) fail('fresh_book_child_recovery_approval');
  const presenceFile = parsed.data.presence.grantFile, presenceBytes = fileBytes(presenceFile);
  if (previewSha(presenceBytes) !== parsed.data.presence.grantSha256) fail('fresh_book_child_recovery_presence');
  let presence: FreshBookStoryboardPresenceGrant;
  try { presence = freshBookStoryboardPresenceGrantSchema.parse(JSON.parse(presenceBytes.toString('utf8'))); } catch { return fail('fresh_book_child_recovery_presence'); }
  const presenceApprovalFile = presence.ownerApproval.file, presenceApprovalBytes = fileBytes(presenceApprovalFile);
  if (previewSha(presenceApprovalBytes) !== presence.ownerApproval.sha256) fail('fresh_book_storyboard_presence_approval');
  const chain = presenceChainGrants(presence);
  const rereview = loadRereview(a.config);
  let roots = rootsOf(a.config, a.env, rereview, a.earlier);
  const planned = await planFreshBookChildRecovery(a.config, a.env, presenceFile, approvalFile);
  const outcome = await assertFreshBookAdmission(planned.rereview, a.env);
  const engine = a.env.head();
  if (canonicalJson(parsed.data) !== canonicalJson(planned.grantDraft)) fail('fresh_book_child_recovery_grant');
  if (!engine.clean || engine.head !== planned.grantDraft.engine.head || engine.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
  const frozen: [string, Buffer, string][] = [[a.grantFile, bytes, 'fresh_book_child_recovery_grant'], [approvalFile, approvalBytes, 'fresh_book_child_recovery_approval'],
    [presenceFile, presenceBytes, 'fresh_book_child_recovery_presence'], [presenceApprovalFile, presenceApprovalBytes, 'fresh_book_storyboard_presence_approval'], ...chain];
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    for (const [file, held, code] of frozen) if (!fileBytes(file).equals(held)) fail(code);
    if (canonicalJson(rootsOf(a.config, a.env, rereview, a.earlier)) !== canonicalJson(roots)) fail('fresh_book_roots_changed');
    const e = a.env.head();
    if (!e.clean || e.head !== planned.grantDraft.engine.head || e.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(planned.grantDraft.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
  };
  const guard = () => { same(); assertFreshBookChildRecoveryPaid({ env: a.env, grantFile: a.grantFile, grantSha: a.grantSha, profile: planned.profile, workspace: workspace() }); };
  const recapture = (added: string[]) => {
    const next = rootsOf(a.config, a.env, rereview, a.earlier), changed = Object.keys(next).filter(k => next[k] !== roots[k]);
    if (canonicalJson(Object.keys(next).sort()) !== canonicalJson(Object.keys(roots).sort()) || canonicalJson(changed.sort()) !== canonicalJson([...added].sort()) ||
        added.some(k => roots[k] !== 'absent' || next[k] === 'absent')) fail('fresh_book_roots_changed');
    roots = next; same();
  };
  same();
  return { planned, outcome, same, guard, recapture, grant: planned.grantDraft, childRecovery: planned.held };
}
type ChildRecoveryAdmitted = { grant: FreshBookChildRecoveryGrant; childRecovery: ChildRecoveryHeld; outcome: unknown; planned: { profile: FreshBookProfile } };

/**
 * The recovered anchor's acceptance as the recovery actually requested and was answered: the held attempt and its typed recovery (re-derived by
 * the admission from the held folder under ITS context); the recovery folder's ONE correction re-derived from that recovery's prompt on the pose
 * core with the held candidate (byte-exact in this folder) as its only reference, its two reviews under the pose context and the frozen recipe;
 * exactly these three calls; the adoption is the record those answers derive under the pose context. A saved adoption's echoes are never the authority.
 */
export async function assertRecoveredChildSettled(bookDir: string, held: Pick<ChildRecoveryHeld, 'rec' | 'first' | 'correction'>, adoption: any, candidateBytes: Buffer) {
  const dir = path.join(bookDir, CR.folder), { rec, first, correction } = held;
  if (previewSha(fileBytes(path.join(dir, 'illustrations', HELD_INPUT_IMAGE))) !== first.candidate.imageSha) fail('child_anchor_render_binding');
  const final = await settledAnchorAttempt(dir, rec.context, rec.held.child.age, 'reference_child_repair', correction.prompt, 'book_design', CHILD_ANCHOR_CORRECTION_ROLES,
    correction.references);
  const candidateSha = previewSha(candidateBytes);
  const finalDesign = final.design ?? fail('child_anchor_not_accepted');
  if (final.recipeSha !== correction.recipeSha || final.outcome.disposition !== 'passed' || final.candidate.imageSha !== candidateSha ||
      candidateSha === first.candidate.imageSha) fail('child_anchor_not_accepted');
  if (!sortedSame(claimedSteps(dir), [...CR.steps])) fail('child_anchor_evidence_steps');
  const record = childAnchorInspectedAdoptionRecord(rec.context, final.recipe, final.style.review, finalDesign.full);
  if (!sameJson(adoption?.anchor, record) || adoption?.candidate?.imageSha !== candidateSha || !sameJson(adoption?.context, rec.context) ||
      adoption?.name !== 'child' || adoption?.authority !== 'fresh_book_reviewed_passed') fail('child_anchor_evidence_binding');
  return { final, design: finalDesign, accepted: assertChildAnchorInspectedAccepted(record, candidateSha, rec.context) };
}

/**
 * The ONE owner-approved child recovery: admission re-derives the presence chain, its admitted storyboard, the held child and the typed recovery
 * exactly; the balance must cover the edit's maximum and both review slots; then one claim and its own folder with its admission, the bound pose
 * context, the held candidate copied byte-exact as the ONE edit input and the correction record; ONE gpt-image-2 LOW correction edit and its Sol
 * reviews on the shared attempt path (the unchanged disposition: passed, or held; no second correction, no fresh render). Passed: the adoption, the
 * book layout (this folder, the pose contract) and the ONE durable successor re-derived from the settled evidence. Held or failed: its own terminal
 * outcome. Nothing earlier is written.
 */
export async function runFreshBookChildRecovery(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void }) {
  const { config, env, signal } = args;
  const admitted = await admitChildRecovery({ ...args, earlier: ['request.json', 'admission.json', 'text', FRESH_BOOK_RECOVERY.folder, FRESH_BOOK_STORYBOARD_REPAIR.folder,
    CONT.folder, REVAL.folder, EXT.folder, XREVAL.folder, CAL.folder, PRS.folder, 'child'] });
  const held = admitted.childRecovery, profile = admitted.planned.profile, dir = path.join(config.bookDir, CR.folder), images = path.join(dir, 'illustrations');
  const ledger = freshBookLedger(config, env, admitted.planned.rereview, 'child_recovery');
  if (existsSync(dir) || ['book-layout.json', 'audition.grant.json', 'audition'].some(f => existsSync(path.join(config.bookDir, f)))) fail('fresh_book_child_recovery_used');
  if (ledger.bookKnownMicroUsd !== admitted.grant.ledger.bookKnownMicroUsd || ledger.diagnosticSettledMicroUsd !== admitted.grant.ledger.diagnosticSettledMicroUsd)
    fail('fresh_book_child_recovery_ledger');
  assertChildRecoveryFits(ledger, held.correction.renderMaximumMicroUsd);
  // No await from the last check to the one recovery claim and its folder.
  admitted.same();
  claimFreshBookChildRecovery(env, admitted.grant, args.grantSha);
  admitted.recapture([`authority/${CR.claimName}`]);
  try { mkdirSync(dir); } catch { fail('fresh_book_child_recovery_used'); }
  mkdirSync(images);
  const meter = new AuditionMeter(path.join(dir, 'paid-stages'), ledger.nextCapMicroUsd, CR.apiCalls, ledger.bookKnownMicroUsd, 0, CHILD_RECOVERY_RULES);
  const save = (name: string, value: unknown) => exclusiveJson(path.join(dir, `${name}.json`), value);
  const seal = (status: string, extra: Record<string, unknown> = {}) => { save('spend', meter.snapshot()); save('sealed', { status, ...extra, runtimeEligible: false }); };
  try {
    exclusiveJson(path.join(dir, CHILD_RECOVERY_ADMISSION_FILE), { version: CR.version, grantSha256: args.grantSha, ownerApproval: admitted.grant.ownerApproval,
      presence: admitted.grant.presence, held: admitted.grant.held, recovery: admitted.grant.recovery, ledger, rereviewOutcome: admitted.outcome });
    save('context', held.rec.context);
    const input: AuditionImage = { imageName: HELD_INPUT_IMAGE, imageSha: held.first.candidate.imageSha };
    writeFileSync(path.join(images, HELD_INPUT_IMAGE), held.first.bytes, { flag: 'wx' });
    if (previewSha(readFileSync(path.join(images, HELD_INPUT_IMAGE))) !== input.imageSha) fail('fresh_book_child_recovery_input');
    save('reference_child_correction_input', { candidate: input, corrections: held.correction.recovery.corrections,
      recovery: { version: CHILD_ANCHOR_VISIBILITY_RECOVERY_VERSION, pose: CHILD_ANCHOR_POSE_VERSION, aspects: held.correction.recovery.aspects },
      authority: 'rejected_edit_input_only_not_canonical' });
    const key = keyReader(config.keyEnvFile);
    const io = auditionAdapters({ directory: images, meter, key, signal, guard: admitted.guard });
    const judges = childAnchorJudges({ bytesOf: image => readAuditionImage(images, image), meter, key, signal, guard: admitted.guard });
    const render: Render = (step, prompt, refs, mode, roles) => io.render(step, prompt, refs, mode, roles);
    const result = await anchorAttempt({ render, style: judges.inspectedStyle, design: judges.inspectedDesign, check: admitted.guard, save, log: args.log },
      held.rec.context, held.rec.held.child.age, 'reference_child_repair', held.correction.prompt, [input], 'book_design', CHILD_ANCHOR_CORRECTION_ROLES,
      held.correction.references, input);
    admitted.guard();
    if (childAnchorRecipeSha(result.recipe) !== admitted.grant.recovery.recipeSha256) fail('fresh_book_child_recovery_recipe');
    if (result.outcome.disposition !== 'passed' || !result.design) {
      seal('child_reference_held', { disposition: result.outcome.disposition, childAnchor: profile.childAnchor, childAnchorPose: CHILD_ANCHOR_POSE_VERSION });
      finish(env, CR.ownHeldOutcome, { disposition: result.outcome.disposition }, CR.outcomeName);
      return { status: 'child_reference_held' as const, disposition: result.outcome.disposition, api: meter.snapshot(),
        ledger: freshBookLedger(config, env, admitted.planned.rereview, 'child_recovery') };
    }
    const record = childAnchorInspectedAdoptionRecord(held.rec.context, result.recipe, result.style.review, result.design.full);
    const accepted = assertChildAnchorInspectedAccepted(record, result.candidate.imageSha, held.rec.context);
    save('reference_child_adoption', { name: 'child', context: held.rec.context, candidate: result.candidate, authority: 'fresh_book_reviewed_passed', anchor: record });
    exclusiveJson(path.join(config.bookDir, 'book-layout.json'), lineLayout(profile, result.candidate.imageName, CHILD_RECOVERY_LINE));
    seal('child_reference_passed', { candidate: result.candidate, contextSha: held.correction.contextSha, childAnchor: profile.childAnchor,
      childAnchorPose: CHILD_ANCHOR_POSE_VERSION, ...(accepted.acceptedDeviations ? { acceptedDeviations: accepted.acceptedDeviations } : {}) });
    // The recovered child's ONE durable provenance: its whole evidence re-derived from the saved records, then recorded once under a fresh guard.
    const successor = await deriveChildRecoverySuccessor({ config, env, grantSha: args.grantSha, admitted });
    admitted.guard();
    exclusiveJson(path.join(env.authorityRoot, CR.successorName), successor);
    admitted.recapture([`authority/${CR.successorName}`]);
    return { status: 'child_reference_passed' as const, candidate: result.candidate, api: meter.snapshot(),
      ledger: freshBookLedger(config, env, admitted.planned.rereview, 'child_recovery') };
  } catch (error) {
    const code = codeOf(error, 'fresh_book_child_recovery_failed');
    if (!existsSync(path.join(dir, 'sealed.json'))) seal('failed', { code });
    if (!existsSync(path.join(env.authorityRoot, CR.outcomeName))) finish(env, 'failed_child_recovery', { code }, CR.outcomeName);
    throw error;
  }
}

/**
 * The recovered child's successor, re-derived from its saved evidence (never its own seal, summary or a re-captured folder): its admission is
 * this grant's; its context is the pose context; its correction record is the typed recovery's; its folder holds exactly its records, the held
 * candidate (its one edit input) and the corrected candidate; its settled calls re-derive to a pass (assertRecoveredChildSettled); its seal,
 * spend and the book layout are what that evidence derives.
 */
async function deriveChildRecoverySuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: ChildRecoveryAdmitted }) {
  const { config, env } = a, grant = a.admitted.grant, held = a.admitted.childRecovery, dir = path.join(config.bookDir, CR.folder);
  const refuse = (): never => fail('fresh_book_child_recovery_successor'), layoutFile = path.join(config.bookDir, 'book-layout.json');
  try {
    const admission = json(path.join(dir, CHILD_RECOVERY_ADMISSION_FILE)), adoption = json(path.join(dir, 'reference_child_adoption.json'));
    if (!sortedSame(Object.keys(admission), ['grantSha256', 'held', 'ledger', 'ownerApproval', 'presence', 'recovery', 'rereviewOutcome', 'version']) ||
        admission.version !== CR.version || admission.grantSha256 !== a.grantSha || !sameJson(admission.ownerApproval, grant.ownerApproval) ||
        !sameJson(admission.presence, grant.presence) || !sameJson(admission.held, grant.held) || !sameJson(admission.recovery, grant.recovery) ||
        !sameJson(admission.rereviewOutcome, a.admitted.outcome) || admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd ||
        admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd) refuse();
    const input = { imageName: HELD_INPUT_IMAGE, imageSha: held.first.candidate.imageSha };
    if (!sameJson(json(path.join(dir, 'context.json')), held.rec.context) || !sameJson(json(path.join(dir, 'reference_child_correction_input.json')),
      { candidate: input, corrections: held.correction.recovery.corrections, recovery: { version: CHILD_ANCHOR_VISIBILITY_RECOVERY_VERSION, pose: CHILD_ANCHOR_POSE_VERSION,
        aspects: held.correction.recovery.aspects }, authority: 'rejected_edit_input_only_not_canonical' })) refuse();
    const candidate = adoption?.candidate as AuditionImage;
    if (typeof candidate?.imageName !== 'string' || !/^[a-z0-9_]+\.png$/.test(candidate.imageName) ||
        !sortedSame(readdirSync(path.join(dir, 'illustrations')), [HELD_INPUT_IMAGE, candidate.imageName])) refuse();
    const { final, design, accepted } = await assertRecoveredChildSettled(config.bookDir, held, adoption, fileBytes(path.join(dir, 'illustrations', candidate.imageName)));
    if (!sameJson(candidate, final.candidate) ||
        !sameJson(json(path.join(dir, 'reference_child_repair_style_review.json')), plainJson({ recipe: final.recipe, recipeSha: final.recipeSha, ...final.style })) ||
        !sameJson(json(path.join(dir, 'reference_child_repair_design_review.json')), plainJson(designReviewRecord(final.recipe, final.recipeSha, design))) ||
        !sameJson(json(path.join(dir, 'sealed.json')), { status: 'child_reference_passed', candidate, contextSha: held.correction.contextSha,
          childAnchor: a.admitted.planned.profile.childAnchor, childAnchorPose: CHILD_ANCHOR_POSE_VERSION,
          ...(accepted.acceptedDeviations ? { acceptedDeviations: accepted.acceptedDeviations } : {}), runtimeEligible: false }) ||
        !sortedSame(readdirSync(dir), [CHILD_RECOVERY_ADMISSION_FILE, 'context.json', 'illustrations', 'paid-stages', 'reference_child_adoption.json',
          'reference_child_correction_input.json', 'reference_child_repair_design_review.json', 'reference_child_repair_style_review.json', 'sealed.json', 'spend.json']) ||
        !sameJson(readReviewedBookLayout(layoutFile), lineLayout(a.admitted.planned.profile, candidate.imageName, CHILD_RECOVERY_LINE)) ||
        !sameJson(json(path.join(dir, 'spend.json')), new AuditionMeter(path.join(dir, 'paid-stages'),
          freshBookCycleLedger({ diagnosticSettledMicroUsd: grant.ledger.diagnosticSettledMicroUsd, stages: [] }).nextCapMicroUsd, CR.apiCalls,
          grant.ledger.bookKnownMicroUsd, 0, CHILD_RECOVERY_RULES).snapshot())) refuse();
    return { cycle: FRESH_BOOK_CYCLE.id, childRecovery: CR.version, grantSha256: a.grantSha, ownerApprovalSha256: grant.ownerApproval.sha256,
      presenceGrantSha256: grant.presence.grantSha256, presenceClaimSha256: grant.presence.claimSha256, presenceOutcomeSha256: grant.presence.outcomeSha256,
      presenceSuccessorSha256: grant.presence.successorSha256, recoveryClaimSha256: previewSha(fileBytes(path.join(env.authorityRoot, CR.claimName))),
      storyboardDigest: grant.presence.storyboardDigest, heldCandidateSha256: grant.held.candidateSha256, heldContextSha256: grant.held.contextSha256,
      recovery: { version: grant.recovery.version, pose: grant.recovery.pose, aspects: grant.recovery.aspects }, candidateSha256: candidate.imageSha,
      contextSha256: grant.recovery.contextSha256, recipeSha256: grant.recovery.recipeSha256, layoutSha256: previewSha(fileBytes(layoutFile)),
      successorSha256: previewSha(canonicalJson(folderBaseline(dir))) };
  } catch { return refuse(); }
}
/** At every downstream entry: the recovered child's successor re-derived now must equal its one durable record. */
async function verifyChildRecoverySuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: ChildRecoveryAdmitted }) {
  const record = await deriveChildRecoverySuccessor(a), file = path.join(a.env.authorityRoot, CR.successorName);
  if (!existsSync(file) || !sameJson(json(file), record)) fail('fresh_book_child_recovery_successor');
  return record;
}

// ---------------------------------------------------------------------------------------------------------------
// The ONE owner-approved fresh child anchor (Guy 2026-10-21): after the child recovery's terminal hold, the GENERAL child stage under
// child-anchor-visible-pose/v2 (a fresh render and its two reviews; at most its one correction for a known or typed-visibility defect and
// their two reviews); the book on its gates only if it passes.
// ---------------------------------------------------------------------------------------------------------------
const CF = FRESH_BOOK_CHILD_FRESH_ANCHOR;
/** The fresh-anchor folder's own admission record (beside its context and the general child stage's records). */
export const CHILD_FRESH_ANCHOR_ADMISSION_FILE = 'child-fresh-anchor-admission.json';
/** The general child stage's options on this line: its own folder and the typed visibility recovery (pose v2 lives in its authority). */
const FRESH_ANCHOR_STAGE = Object.freeze({ childDir: CF.folder, visibilityRecovery: true as const });
/**
 * The worst case of the general child stage before its claim: the first render's claim maximum, one correction render at the longest prompt the
 * image seam accepts (4 bytes a character, one reference) and four review slots.
 */
function childFreshAnchorReserve(firstRenderMicroUsd: number) {
  return firstRenderMicroUsd + renderMaximum('x'.repeat(GPT_IMAGE_PROMPT_MAX_CHARS * 4), 1) + CF.reviews * SOL_PIXEL_REVIEW_SLOT_MICRO_USD;
}
export function assertChildFreshAnchorFits(ledger: { bookKnownMicroUsd: number; nextCapMicroUsd: number }, firstRenderMicroUsd: number) {
  const reserveMicroUsd = childFreshAnchorReserve(firstRenderMicroUsd);
  if (SOL_PIXEL_REVIEW_SLOT_MICRO_USD !== CF.reviewReserveMicroUsd || !Number.isSafeInteger(reserveMicroUsd) ||
      ledger.bookKnownMicroUsd + reserveMicroUsd > ledger.nextCapMicroUsd) fail('fresh_book_child_fresh_anchor_budget');
  return { remainingMicroUsd: ledger.nextCapMicroUsd - ledger.bookKnownMicroUsd, reserveMicroUsd };
}

/**
 * The consumed child recovery and its terminal hold, re-read exactly: the recovery grant its claim names (naming the presence claim, terminal
 * record and successor and every claim of the chain, at that grant's own head) and its owner record; everything that grant recorded except its
 * own head and pins, re-planned now by the engine and equal (the presence chain, its admitted storyboard and the held child re-derived on the
 * way); its terminal record exactly held_child_recovery / held_uncertain with no successor or audition start of its own; its folder exactly what
 * its three settled calls derive under ITS context (the v1 pose context) to held_uncertain: seal, context, admission, correction input, saved
 * reviews, images and spend. Then the fresh anchor the GENERAL child stage plans under v2 from this book's own data. The ledger it stands on
 * is every stage through the recovery.
 */
async function childRecoveryHeld(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, loaded: ReturnType<typeof loadProfile>,
  recoveryGrantFile: string) {
  const refuse = (): never => fail('fresh_book_child_fresh_anchor_recovery');
  if (!path.isAbsolute(recoveryGrantFile)) refuse();
  const at = (name: string) => path.join(env.authorityRoot, name), dir = path.join(config.bookDir, CR.folder), images = path.join(dir, 'illustrations');
  const files = { grant: recoveryGrantFile, claim: at(CR.claimName), outcome: at(CR.outcomeName), seal: path.join(dir, 'sealed.json') };
  if (Object.values(files).some(f => !existsSync(f)) || existsSync(at(CR.successorName)) || existsSync(at(CR.auditionStartName))) refuse();
  const digest = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, previewSha(fileBytes(f))])) as Record<keyof typeof files, string>;
  const parsed = freshBookChildRecoveryGrantSchema.safeParse(json(files.grant));
  if (!parsed.success) return refuse();
  const grant = parsed.data, claim = json(files.claim), p = grant.presence;
  const sameDir = (x: unknown) => typeof x === 'string' && path.resolve(x).toLowerCase() === path.resolve(config.bookDir).toLowerCase();
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.childRecovery !== CR.version || claim.grantSha256 !== digest.grant || claim.engineHead !== grant.engine.head ||
      claim.ownerApprovalSha256 !== grant.ownerApproval.sha256 || previewSha(fileBytes(grant.ownerApproval.file)) !== grant.ownerApproval.sha256 ||
      claim.presenceClaimSha256 !== p.claimSha256 || claim.presenceOutcomeSha256 !== p.outcomeSha256 || claim.presenceSuccessorSha256 !== p.successorSha256 ||
      claim.calibrationClaimSha256 !== p.calibrationClaimSha256 || claim.extensionRevalidationClaimSha256 !== p.extensionRevalidationClaimSha256 ||
      claim.extensionClaimSha256 !== p.extensionClaimSha256 || claim.revalidationClaimSha256 !== p.revalidationClaimSha256 ||
      claim.continuationClaimSha256 !== p.continuationClaimSha256 || claim.repairClaimSha256 !== p.repairClaimSha256 ||
      claim.recoveryClaimSha256 !== p.recoveryClaimSha256 || claim.originalClaimSha256 !== p.originalClaimSha256 ||
      claim.heldCandidateSha256 !== grant.held.candidateSha256 || claim.profileSha256 !== grant.profileSha256 || !sameDir(claim.bookDir) || !sameDir(grant.bookDir) ||
      grant.profileSha256 !== freshBookProfileSha(loaded.profile)) refuse();
  // Everything the consumed recovery grant recorded, except its own head and pins (they bind ITS head), re-derived now by the engine.
  const replanned = await planFreshBookChildRecovery(config, env, p.grantFile, grant.ownerApproval.file), held = replanned.held;
  if (!sameJson({ ...replanned.grantDraft, engine: grant.engine, pins: grant.pins }, grant)) refuse();
  // Its terminal record: its own gates held the corrected child.
  const outcome = json(files.outcome);
  if (!sortedSame(Object.keys(outcome), ['cycle', 'disposition', 'finishedAt', 'status']) || outcome.cycle !== FRESH_BOOK_CYCLE.id ||
      outcome.status !== CF.heldOutcome || outcome.disposition !== CF.heldDisposition) refuse();
  // Its folder: its settled calls re-derive under ITS context to held_uncertain (the design review only when its style review was assessable),
  // and every record is what they derive.
  const final = await settledAnchorAttempt(dir, held.rec.context, held.rec.held.child.age, 'reference_child_repair', held.correction.prompt, 'book_design',
    CHILD_ANCHOR_CORRECTION_ROLES, held.correction.references);
  const diagnostic = freshBookDiagnosticSpend(rereview, env), reviewed = final.design !== null;
  if (final.outcome.disposition !== CF.heldDisposition || final.recipeSha !== held.correction.recipeSha ||
      !sortedSame(claimedSteps(dir), ['reference_child_repair', 'reference_child_repair_style_qa', ...(reviewed ? ['reference_child_repair_qa'] : [])]) ||
      !sameJson(json(files.seal), { status: 'child_reference_held', disposition: CF.heldDisposition, childAnchor: loaded.profile.childAnchor,
        childAnchorPose: CHILD_ANCHOR_POSE_VERSION, runtimeEligible: false }) ||
      !sameJson(json(path.join(dir, 'context.json')), held.rec.context) ||
      !sameJson(json(path.join(dir, 'reference_child_correction_input.json')), { candidate: { imageName: HELD_INPUT_IMAGE, imageSha: held.first.candidate.imageSha },
        corrections: held.correction.recovery.corrections, recovery: { version: CHILD_ANCHOR_VISIBILITY_RECOVERY_VERSION, pose: CHILD_ANCHOR_POSE_VERSION,
          aspects: held.correction.recovery.aspects }, authority: 'rejected_edit_input_only_not_canonical' }) ||
      !sameJson(json(path.join(dir, 'reference_child_repair_style_review.json')), plainJson({ recipe: final.recipe, recipeSha: final.recipeSha, ...final.style })) ||
      (final.design && !sameJson(json(path.join(dir, 'reference_child_repair_design_review.json')),
        plainJson(designReviewRecord(final.recipe, final.recipeSha, final.design)))) ||
      !sortedSame(readdirSync(dir), [CHILD_RECOVERY_ADMISSION_FILE, 'context.json', 'illustrations', 'paid-stages', 'reference_child_correction_input.json',
        ...(reviewed ? ['reference_child_repair_design_review.json'] : []), 'reference_child_repair_style_review.json', 'sealed.json', 'spend.json']) ||
      !sortedSame(readdirSync(images), [HELD_INPUT_IMAGE, final.candidate.imageName]) ||
      previewSha(fileBytes(path.join(images, HELD_INPUT_IMAGE))) !== held.first.candidate.imageSha ||
      !sameJson(json(path.join(dir, 'spend.json')), new AuditionMeter(path.join(dir, 'paid-stages'),
        freshBookCycleLedger({ diagnosticSettledMicroUsd: diagnostic, stages: [] }).nextCapMicroUsd, CR.apiCalls, grant.ledger.bookKnownMicroUsd, 0,
        CHILD_RECOVERY_RULES).snapshot())) refuse();
  const admission = json(path.join(dir, CHILD_RECOVERY_ADMISSION_FILE));
  if (!sortedSame(Object.keys(admission), ['grantSha256', 'held', 'ledger', 'ownerApproval', 'presence', 'recovery', 'rereviewOutcome', 'version']) ||
      admission.version !== CR.version || admission.grantSha256 !== digest.grant || !sameJson(admission.ownerApproval, grant.ownerApproval) ||
      !sameJson(admission.presence, grant.presence) || !sameJson(admission.held, grant.held) || !sameJson(admission.recovery, grant.recovery) ||
      !sameJson(admission.rereviewOutcome, await assertFreshBookAdmission(rereview, env)) || admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd ||
      admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd) refuse();
  // The fresh anchor the general child stage plans under v2, from this book's own data (its configured design, the storyboard's wardrobe).
  const anchor = anchorAuthority(loaded.profile, held.rec.held.child.wardrobe, CHILD_ANCHOR_POSE_V2);
  const plan = assertChildAnchorRenderPlan(anchor.request.prompt, anchor.technique.length, anchor.request.referenceMode);
  const through = freshBookCycleLedger({ diagnosticSettledMicroUsd: diagnostic, stages: bookStages(config.bookDir, 'child_fresh_anchor').slice(0, -2) });
  return { presence: held.presence, held: held.held,
    recovery: { grantFile: path.resolve(recoveryGrantFile), grantSha256: digest.grant, claimSha256: digest.claim, outcomeSha256: digest.outcome,
      folderSha256: previewSha(canonicalJson(folderBaseline(dir))), sealSha256: digest.seal, candidateSha256: final.candidate.imageSha,
      contextSha256: childAnchorInspectionContextSha(held.rec.context), recipeSha256: final.recipeSha },
    fresh: { pose: CHILD_ANCHOR_POSE_V2, visibilityRecovery: CHILD_ANCHOR_VISIBILITY_RECOVERY_VERSION, requestPromptSha256: previewSha(anchor.request.prompt),
      contextSha256: childAnchorInspectionContextSha(anchor.context), renderMaximumMicroUsd: renderMaximum(plan.finalPrompt, anchor.technique.length) },
    ledger: { diagnosticSettledMicroUsd: through.diagnosticSettledMicroUsd, bookKnownMicroUsd: through.bookKnownMicroUsd,
      calls: through.stages.reduce((n, s) => n + s.calls, 0) },
    anchor, recoveryGrant: grant, heldChild: held };
}
type ChildFreshAnchorHeld = Awaited<ReturnType<typeof childRecoveryHeld>>;

/** Provider-free plan and the fresh-anchor grant this exact state needs (no key, no provider, no write). */
export async function planFreshBookChildFreshAnchor(config: FreshBookConfig, env: FreshBookEnv, recoveryGrantFile: string, ownerApprovalFile: string) {
  const base = planFreshBook(config, env), loaded = loadProfile(config);
  const approval = ownerApproval(ownerApprovalFile, CF.approvalLine, 'fresh_book_child_fresh_anchor_approval');
  const held = await childRecoveryHeld(config, env, base.rereview, loaded, recoveryGrantFile);
  const at = (name: string) => path.join(env.authorityRoot, name);
  const plan = { version: CF.version, cycle: FRESH_BOOK_CYCLE.id, amendment: CF.amendment, ownerApproval: approval, basePlanSha256: base.grantDraft.nativePlanSha256,
    bookDir: path.resolve(config.bookDir), folder: CF.folder, storyboardDir: PRS.folder, childDir: CF.folder,
    presence: held.presence, held: held.held, recovery: held.recovery, fresh: held.fresh,
    storyboard: 'the presence line\'s admitted storyboard, its successor re-derived by replaying the whole chain; no author, editor, planner or storyboard call',
    stage: `the general child stage under ${CHILD_ANCHOR_POSE_V2}: ONE fresh gpt-image-2 LOW 1024x1024 render from the pinned technique references (style mode), its style review and its design + apparent-age review (Sol 6.1); only for a known defect or a typed-visibility hold, ONE correction edit of that candidate (pose-aware) and its two reviews; the unchanged disposition decides`,
    calls: { renders: `reference_child, reference_child_repair (only for a correction): gpt-image-2 LOW, ${CF.renders} at most`,
      reviews: `reference_child_style_qa, reference_child_qa and the repair's two: Sol 6.1 (${SOL}), ${CF.reviews} at most, each claimed at ${CF.reviewReserveMicroUsd}`,
      reserveMicroUsd: childFreshAnchorReserve(held.fresh.renderMaximumMicroUsd) },
    acceptance: 'the final candidate passes only under the unchanged disposition (style, every design category, apparent age, materiality); no recovery applies to a corrected candidate; anything else ends the line',
    downstream: ['book --child-fresh-anchor [--resume]: two samples first, then the rest and the cover only if both pass (LOW, max 3 attempts/page)'],
    caps: { ...base.plan.caps, childFreshAnchorApiCalls: CF.apiCalls },
    claim: at(CF.claimName), outcome: at(CF.outcomeName), successor: at(CF.successorName),
    successorAdmission: 'downstream re-derives the presence chain, the held child, the recovery\'s terminal hold and the fresh child from the saved evidence against its one durable record',
    providerCalls: 0, keyRead: false };
  const engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_CHILD_FRESH_ANCHOR_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft: FreshBookChildFreshAnchorGrant = freshBookChildFreshAnchorGrantSchema.parse({ version: 'fresh-book-child-fresh-anchor-grant/v1',
    cycle: FRESH_BOOK_CYCLE.id, approval: FRESH_BOOK_CYCLE.approval, amendment: CF.amendment, ownerApproval: approval, profileSha256: base.plan.profileSha256,
    bookDir: path.resolve(config.bookDir), presence: held.presence, held: held.held, recovery: held.recovery, fresh: held.fresh, ledger: held.ledger,
    allowance: { apiCalls: CF.apiCalls, renders: CF.renders, reviews: CF.reviews, reviewReserveMicroUsd: CF.reviewReserveMicroUsd },
    engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)) });
  const probe = (f: () => unknown) => { try { return f(); } catch (e) { return { refused: e && typeof e === 'object' && 'code' in e ? e.code : String(e) }; } };
  const state = { claimExists: existsSync(plan.claim), outcomeExists: existsSync(plan.outcome), successorExists: existsSync(plan.successor),
    folderExists: existsSync(path.join(config.bookDir, CF.folder)), layoutExists: existsSync(path.join(config.bookDir, 'book-layout.json')),
    ledger: probe(() => freshBookLedger(config, env, base.rereview, 'child_fresh_anchor')),
    budget: probe(() => assertChildFreshAnchorFits(freshBookLedger(config, env, base.rereview, 'child_fresh_anchor'), held.fresh.renderMaximumMicroUsd)), engine };
  return { plan, grantDraft, state, profile: base.profile, prepared: loaded.prepared, rereview: base.rereview, held };
}

/**
 * A fresh-anchor-line stage's admission, as admitChildRecovery: the baseline pinned FIRST and held across every await: this grant's bytes, the
 * owner's record, the consumed recovery grant and its owner record, the consumed presence grant and its owner record and every grant of its
 * chain (each at its recorded digest, never re-pinned to this head), configuration, profile, lineage, every line's authority records and the
 * earlier stage entries (the held child and the held recovery among them). The grant is exactly the draft this state rebuilds, at the clean
 * reviewed head. Its guard adds the fresh-anchor claim and every record it names.
 */
async function admitChildFreshAnchor(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal; earlier: string[] }) {
  const bytes = fileBytes(a.grantFile);
  if (previewSha(bytes) !== a.grantSha) fail('fresh_book_child_fresh_anchor_grant');
  const parsed = freshBookChildFreshAnchorGrantSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success) return fail('fresh_book_child_fresh_anchor_grant');
  const read = <T>(file: string, digest: string, schema: { parse(value: unknown): T } | null, code: string): [T, Buffer] => {
    const b = fileBytes(file);
    if (previewSha(b) !== digest) fail(code);
    try { return [schema ? schema.parse(JSON.parse(b.toString('utf8'))) : (null as T), b]; } catch { return fail(code); }
  };
  const approvalFile = parsed.data.ownerApproval.file, [, approvalBytes] = read(approvalFile, parsed.data.ownerApproval.sha256, null, 'fresh_book_child_fresh_anchor_approval');
  const recoveryFile = parsed.data.recovery.grantFile;
  const [recoveryGrant, recoveryBytes] = read(recoveryFile, parsed.data.recovery.grantSha256, freshBookChildRecoveryGrantSchema, 'fresh_book_child_fresh_anchor_recovery');
  const recoveryApprovalFile = recoveryGrant.ownerApproval.file;
  const [, recoveryApprovalBytes] = read(recoveryApprovalFile, recoveryGrant.ownerApproval.sha256, null, 'fresh_book_child_recovery_approval');
  const presenceFile = recoveryGrant.presence.grantFile;
  const [presence, presenceBytes] = read(presenceFile, recoveryGrant.presence.grantSha256, freshBookStoryboardPresenceGrantSchema, 'fresh_book_child_recovery_presence');
  const presenceApprovalFile = presence.ownerApproval.file;
  const [, presenceApprovalBytes] = read(presenceApprovalFile, presence.ownerApproval.sha256, null, 'fresh_book_storyboard_presence_approval');
  const chain = presenceChainGrants(presence);
  const rereview = loadRereview(a.config);
  let roots = rootsOf(a.config, a.env, rereview, a.earlier);
  const planned = await planFreshBookChildFreshAnchor(a.config, a.env, recoveryFile, approvalFile);
  const outcome = await assertFreshBookAdmission(planned.rereview, a.env);
  const engine = a.env.head();
  if (canonicalJson(parsed.data) !== canonicalJson(planned.grantDraft)) fail('fresh_book_child_fresh_anchor_grant');
  if (!engine.clean || engine.head !== planned.grantDraft.engine.head || engine.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
  const frozen: [string, Buffer, string][] = [[a.grantFile, bytes, 'fresh_book_child_fresh_anchor_grant'], [approvalFile, approvalBytes, 'fresh_book_child_fresh_anchor_approval'],
    [recoveryFile, recoveryBytes, 'fresh_book_child_fresh_anchor_recovery'], [recoveryApprovalFile, recoveryApprovalBytes, 'fresh_book_child_recovery_approval'],
    [presenceFile, presenceBytes, 'fresh_book_child_recovery_presence'], [presenceApprovalFile, presenceApprovalBytes, 'fresh_book_storyboard_presence_approval'], ...chain];
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    for (const [file, held, code] of frozen) if (!fileBytes(file).equals(held)) fail(code);
    if (canonicalJson(rootsOf(a.config, a.env, rereview, a.earlier)) !== canonicalJson(roots)) fail('fresh_book_roots_changed');
    const e = a.env.head();
    if (!e.clean || e.head !== planned.grantDraft.engine.head || e.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(planned.grantDraft.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
  };
  const guard = () => { same(); assertFreshBookChildFreshAnchorPaid({ env: a.env, grantFile: a.grantFile, grantSha: a.grantSha, profile: planned.profile, workspace: workspace() }); };
  const recapture = (added: string[]) => {
    const next = rootsOf(a.config, a.env, rereview, a.earlier), changed = Object.keys(next).filter(k => next[k] !== roots[k]);
    if (canonicalJson(Object.keys(next).sort()) !== canonicalJson(Object.keys(roots).sort()) || canonicalJson(changed.sort()) !== canonicalJson([...added].sort()) ||
        added.some(k => roots[k] !== 'absent' || next[k] === 'absent')) fail('fresh_book_roots_changed');
    roots = next; same();
  };
  same();
  return { planned, outcome, same, guard, recapture, grant: planned.grantDraft, childFreshAnchor: planned.held };
}
type ChildFreshAnchorAdmitted = { grant: FreshBookChildFreshAnchorGrant; childFreshAnchor: ChildFreshAnchorHeld; outcome: unknown; planned: { profile: FreshBookProfile } };

/**
 * The ONE owner-approved fresh child anchor: admission re-derives the presence chain, its admitted storyboard, the held child, the recovery's
 * terminal hold and the fresh plan exactly; the balance must cover the general child stage's worst case; then one claim and its own folder
 * with its admission and the bound v2 context; the GENERAL child stage (one fresh LOW render and its reviews; at most its one correction for a
 * known or typed-visibility defect and their reviews) on the shared attempt path. Passed: the adoption, the book layout (this folder, pose v2)
 * and the ONE durable successor re-derived from the settled evidence. Held or failed: its own terminal outcome. Nothing earlier is written.
 */
export async function runFreshBookChildFreshAnchor(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void }) {
  const { config, env, signal } = args;
  const admitted = await admitChildFreshAnchor({ ...args, earlier: ['request.json', 'admission.json', 'text', FRESH_BOOK_RECOVERY.folder, FRESH_BOOK_STORYBOARD_REPAIR.folder,
    CONT.folder, REVAL.folder, EXT.folder, XREVAL.folder, CAL.folder, PRS.folder, 'child', CR.folder] });
  const held = admitted.childFreshAnchor, profile = admitted.planned.profile, anchor = held.anchor;
  const dir = path.join(config.bookDir, CF.folder), images = path.join(dir, 'illustrations');
  const ledger = freshBookLedger(config, env, admitted.planned.rereview, 'child_fresh_anchor');
  if (existsSync(dir) || ['book-layout.json', 'audition.grant.json', 'audition'].some(f => existsSync(path.join(config.bookDir, f)))) fail('fresh_book_child_fresh_anchor_used');
  if (ledger.bookKnownMicroUsd !== admitted.grant.ledger.bookKnownMicroUsd || ledger.diagnosticSettledMicroUsd !== admitted.grant.ledger.diagnosticSettledMicroUsd)
    fail('fresh_book_child_fresh_anchor_ledger');
  assertChildFreshAnchorFits(ledger, held.fresh.renderMaximumMicroUsd);
  // No await from the last check to the one fresh-anchor claim and its folder.
  admitted.same();
  claimFreshBookChildFreshAnchor(env, admitted.grant, args.grantSha);
  admitted.recapture([`authority/${CF.claimName}`]);
  try { mkdirSync(dir); } catch { fail('fresh_book_child_fresh_anchor_used'); }
  mkdirSync(images);
  const meter = new AuditionMeter(path.join(dir, 'paid-stages'), ledger.nextCapMicroUsd, CF.apiCalls, ledger.bookKnownMicroUsd, 0, CHILD_RULES);
  const save = (name: string, value: unknown) => exclusiveJson(path.join(dir, `${name}.json`), value);
  const seal = (status: string, extra: Record<string, unknown> = {}) => { save('spend', meter.snapshot()); save('sealed', { status, ...extra, runtimeEligible: false }); };
  try {
    exclusiveJson(path.join(dir, CHILD_FRESH_ANCHOR_ADMISSION_FILE), { version: CF.version, grantSha256: args.grantSha, ownerApproval: admitted.grant.ownerApproval,
      presence: admitted.grant.presence, held: admitted.grant.held, recovery: admitted.grant.recovery, fresh: admitted.grant.fresh, ledger, rereviewOutcome: admitted.outcome });
    save('context', anchor.context);
    const key = keyReader(config.keyEnvFile);
    const io = auditionAdapters({ directory: images, meter, key, signal, guard: admitted.guard });
    const judges = childAnchorJudges({ bytesOf: image => readAuditionImage(images, image), meter, key, signal, guard: admitted.guard });
    const render: Render = (step, prompt, refs, mode, roles) => io.render(step, prompt, refs, mode, roles);
    const result = await inspectedAnchor({ anchor, images, render, style: judges.inspectedStyle, design: judges.inspectedDesign, check: admitted.guard, save, log: args.log,
      visibilityRecovery: FRESH_ANCHOR_STAGE.visibilityRecovery });
    admitted.guard();
    if (result.status !== 'passed') {
      seal('child_reference_held', { disposition: result.disposition, childAnchor: profile.childAnchor, childAnchorPose: CHILD_ANCHOR_POSE_V2 });
      finish(env, CF.ownHeldOutcome, { disposition: result.disposition }, CF.outcomeName);
      return { status: 'child_reference_held' as const, disposition: result.disposition, api: meter.snapshot(),
        ledger: freshBookLedger(config, env, admitted.planned.rereview, 'child_fresh_anchor') };
    }
    save('reference_child_adoption', { name: 'child', context: anchor.context, candidate: result.candidate, authority: 'fresh_book_reviewed_passed', anchor: result.record });
    exclusiveJson(path.join(config.bookDir, 'book-layout.json'), lineLayout(profile, result.candidate.imageName, CHILD_FRESH_ANCHOR_LINE));
    seal('child_reference_passed', { candidate: result.candidate, contextSha: held.fresh.contextSha256, childAnchor: profile.childAnchor,
      childAnchorPose: CHILD_ANCHOR_POSE_V2, ...(result.acceptedDeviations ? { acceptedDeviations: result.acceptedDeviations } : {}) });
    // The fresh child's ONE durable provenance: its whole evidence re-derived from the saved records, then recorded once under a fresh guard.
    const successor = await deriveChildFreshAnchorSuccessor({ config, env, grantSha: args.grantSha, admitted });
    admitted.guard();
    exclusiveJson(path.join(env.authorityRoot, CF.successorName), successor);
    admitted.recapture([`authority/${CF.successorName}`]);
    return { status: 'child_reference_passed' as const, candidate: result.candidate, api: meter.snapshot(),
      ledger: freshBookLedger(config, env, admitted.planned.rereview, 'child_fresh_anchor') };
  } catch (error) {
    const code = codeOf(error, 'fresh_book_child_fresh_anchor_failed');
    if (!existsSync(path.join(dir, 'sealed.json'))) seal('failed', { code });
    if (!existsSync(path.join(env.authorityRoot, CF.outcomeName))) finish(env, 'failed_child_fresh_anchor', { code }, CF.outcomeName);
    throw error;
  }
}

/**
 * The fresh child's successor, re-derived from its saved evidence (never its own seal, summary or a re-captured folder): its admission is this
 * grant's; its context is the v2 context; its settled calls re-derive to a pass on the general child stage's path (settledInspectedChild:
 * the first attempt, the one correction it planned if any, exactly those calls); every record it wrote (reviews, correction input, adoption,
 * seal, spend) and the book layout are what that evidence derives; its folder holds nothing else.
 */
async function deriveChildFreshAnchorSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: ChildFreshAnchorAdmitted }) {
  const { config, env } = a, grant = a.admitted.grant, held = a.admitted.childFreshAnchor, profile = a.admitted.planned.profile;
  const dir = path.join(config.bookDir, CF.folder), images = path.join(dir, 'illustrations'), layoutFile = path.join(config.bookDir, 'book-layout.json');
  const refuse = (): never => fail('fresh_book_child_fresh_anchor_successor');
  try {
    const admission = json(path.join(dir, CHILD_FRESH_ANCHOR_ADMISSION_FILE)), adoption = json(path.join(dir, 'reference_child_adoption.json'));
    if (!sortedSame(Object.keys(admission), ['fresh', 'grantSha256', 'held', 'ledger', 'ownerApproval', 'presence', 'recovery', 'rereviewOutcome', 'version']) ||
        admission.version !== CF.version || admission.grantSha256 !== a.grantSha || !sameJson(admission.ownerApproval, grant.ownerApproval) ||
        !sameJson(admission.presence, grant.presence) || !sameJson(admission.held, grant.held) || !sameJson(admission.recovery, grant.recovery) ||
        !sameJson(admission.fresh, grant.fresh) || !sameJson(admission.rereviewOutcome, a.admitted.outcome) ||
        admission.ledger?.bookKnownMicroUsd !== grant.ledger.bookKnownMicroUsd || admission.ledger?.diagnosticSettledMicroUsd !== grant.ledger.diagnosticSettledMicroUsd ||
        !sameJson(json(path.join(dir, 'context.json')), held.anchor.context)) refuse();
    const candidate = adoption?.candidate as AuditionImage;
    if (typeof candidate?.imageName !== 'string' || !/^[a-z0-9_]+\.png$/.test(candidate.imageName)) refuse();
    const settled = await settledInspectedChild(config.bookDir, held.anchor, adoption, fileBytes(path.join(images, candidate.imageName)), FRESH_ANCHOR_STAGE);
    const { first, final, correction, accepted } = settled, firstDesign = first.design ?? refuse();
    const corrected = correction !== null;
    if (!sortedSame(readdirSync(dir), [CHILD_FRESH_ANCHOR_ADMISSION_FILE, 'context.json', 'illustrations', 'paid-stages', 'reference_child_adoption.json',
          'reference_child_design_review.json', 'reference_child_style_review.json', 'sealed.json', 'spend.json',
          ...(corrected ? ['reference_child_correction_input.json', 'reference_child_repair_design_review.json', 'reference_child_repair_style_review.json'] : [])]) ||
        !sortedSame(readdirSync(images), [...held.anchor.technique.map((_, i) => `style_ref_${i + 1}.png`), first.candidate.imageName,
          ...(corrected ? [final.candidate.imageName] : [])]) ||
        held.anchor.technique.some((t, i) => previewSha(fileBytes(path.join(images, `style_ref_${i + 1}.png`))) !== t.sha256) ||
        !sameJson(json(path.join(dir, 'reference_child_style_review.json')), plainJson({ recipe: first.recipe, recipeSha: first.recipeSha, ...first.style })) ||
        !sameJson(json(path.join(dir, 'reference_child_design_review.json')), plainJson(designReviewRecord(first.recipe, first.recipeSha, firstDesign)))) refuse();
    if (correction && (!sameJson(json(path.join(dir, 'reference_child_correction_input.json')), { candidate: first.candidate, corrections: correction.corrections,
          ...(correction.recovery ? { recovery: { version: correction.recovery.version, pose: correction.recovery.pose, aspects: correction.recovery.aspects } } : {}),
          authority: 'rejected_edit_input_only_not_canonical' }) ||
        !sameJson(json(path.join(dir, 'reference_child_repair_style_review.json')), plainJson({ recipe: final.recipe, recipeSha: final.recipeSha, ...final.style })) ||
        !sameJson(json(path.join(dir, 'reference_child_repair_design_review.json')), plainJson(designReviewRecord(final.recipe, final.recipeSha, final.design!))))) refuse();
    if (!sameJson(candidate, final.candidate) || adoption.name !== 'child' || adoption.authority !== 'fresh_book_reviewed_passed' ||
        !sameJson(json(path.join(dir, 'sealed.json')), { status: 'child_reference_passed', candidate, contextSha: grant.fresh.contextSha256, childAnchor: profile.childAnchor,
          childAnchorPose: CHILD_ANCHOR_POSE_V2, ...(accepted.acceptedDeviations ? { acceptedDeviations: accepted.acceptedDeviations } : {}), runtimeEligible: false }) ||
        !sameJson(readReviewedBookLayout(layoutFile), lineLayout(profile, candidate.imageName, CHILD_FRESH_ANCHOR_LINE)) ||
        !sameJson(json(path.join(dir, 'spend.json')), new AuditionMeter(path.join(dir, 'paid-stages'),
          freshBookCycleLedger({ diagnosticSettledMicroUsd: grant.ledger.diagnosticSettledMicroUsd, stages: [] }).nextCapMicroUsd, CF.apiCalls,
          grant.ledger.bookKnownMicroUsd, 0, CHILD_RULES).snapshot())) refuse();
    return { cycle: FRESH_BOOK_CYCLE.id, childFreshAnchor: CF.version, grantSha256: a.grantSha, ownerApprovalSha256: grant.ownerApproval.sha256,
      recoveryGrantSha256: grant.recovery.grantSha256, recoveryClaimSha256: grant.recovery.claimSha256, recoveryOutcomeSha256: grant.recovery.outcomeSha256,
      presenceGrantSha256: grant.presence.grantSha256, presenceClaimSha256: grant.presence.claimSha256, presenceOutcomeSha256: grant.presence.outcomeSha256,
      presenceSuccessorSha256: grant.presence.successorSha256, freshClaimSha256: previewSha(fileBytes(path.join(env.authorityRoot, CF.claimName))),
      storyboardDigest: grant.presence.storyboardDigest, pose: CHILD_ANCHOR_POSE_V2, contextSha256: grant.fresh.contextSha256, candidateSha256: candidate.imageSha,
      corrected, ...(correction?.recovery ? { visibility: correction.recovery.aspects } : {}), layoutSha256: previewSha(fileBytes(layoutFile)),
      successorSha256: previewSha(canonicalJson(folderBaseline(dir))) };
  } catch { return refuse(); }
}
/** At every downstream entry: the fresh child's successor re-derived now must equal its one durable record. */
async function verifyChildFreshAnchorSuccessor(a: { config: FreshBookConfig; env: FreshBookEnv; grantSha: string; admitted: ChildFreshAnchorAdmitted }) {
  const record = await deriveChildFreshAnchorSuccessor(a), file = path.join(a.env.authorityRoot, CF.successorName);
  if (!existsSync(file) || !sameJson(json(file), record)) fail('fresh_book_child_fresh_anchor_successor');
  return record;
}

// ---------------------------------------------------------------------------------------------------------------
// The ONE owner-approved continuation of the SAME audition (Guy 2026-10-21): the fresh-anchor line's book halted on one review that ended
// without a receipt; ONE conservative budget debit of that call (its actual charge stays unknown), then the same audition resumed under the
// reviewed engine (its interrupted attempts closed and counted; the 600 s review deadline) through every remaining page and the cover.
// ---------------------------------------------------------------------------------------------------------------
const AC = FRESH_BOOK_AUDITION_CONTINUATION;
/** Continuation-line grants pin exactly the presence line's files (the meter, the resume and the deadline live in files they already pin). */
export const FRESH_BOOK_AUDITION_CONTINUATION_PINNED = FRESH_BOOK_STORYBOARD_PRESENCE_PINNED;
/** The audition files a run writes only on completion or on a resume: their absence shows the audition stands exactly as it halted. */
const AUDITION_LATER = /^(resume-[0-9]+\.json|book(-r[0-9]+)?\.html|spend(-r[0-9]+)?\.json|reviewed_audition_manifest\.json|halted_.+\.json)$/;
/**
 * The consumed fresh-anchor line and its halted audition, re-read exactly. The fresh-anchor grant its claim names (every field that claim
 * wrote, at that grant's own head) and its owner record; everything that grant recorded except its own head and pins, re-planned now and
 * equal (the recovery's hold, the presence chain, its admitted storyboard and the held child re-derived on the way); the fresh child's
 * successor re-derived from its saved evidence and equal to its one durable record; no outcome of the line. Its audition: the start record and
 * the audition grant exactly what the line derives; every journal record re-derived under its rules; no unknown outcome and exactly ONE
 * unknown cost, whose conservative debit is derived from that call's own records; with that debit nothing else is unknown and no repeated
 * failure stands; the audition never resumed or finished; the saved images and every closed attempt as the runner reconstructs them.
 */
async function freshAnchorAuditionHalted(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, loaded: ReturnType<typeof loadProfile>,
  freshGrantFile: string) {
  const refuse = (): never => fail('fresh_book_audition_continuation_fresh');
  if (!path.isAbsolute(freshGrantFile)) refuse();
  const at = (name: string) => path.join(env.authorityRoot, name), auditionDir = path.join(config.bookDir, 'audition');
  const paid = path.join(auditionDir, 'paid-stages'), images = path.join(auditionDir, 'illustrations');
  const files = { grant: freshGrantFile, claim: at(CF.claimName), successor: at(CF.successorName), start: at(CF.auditionStartName),
    auditionGrant: path.join(config.bookDir, 'audition.grant.json'), layout: path.join(config.bookDir, 'book-layout.json'),
    admission: path.join(auditionDir, 'admission.json') };
  if (Object.values(files).some(f => !existsSync(f)) || existsSync(at(CF.outcomeName)) || !existsSync(paid)) refuse();
  const digest = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, previewSha(fileBytes(f))])) as Record<keyof typeof files, string>;
  const parsed = freshBookChildFreshAnchorGrantSchema.safeParse(json(files.grant));
  if (!parsed.success) return refuse();
  const grant = parsed.data, claim = json(files.claim);
  const sameDir = (x: unknown) => typeof x === 'string' && path.resolve(x).toLowerCase() === path.resolve(config.bookDir).toLowerCase();
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.childFreshAnchor !== CF.version || claim.grantSha256 !== digest.grant ||
      claim.ownerApprovalSha256 !== grant.ownerApproval.sha256 || previewSha(fileBytes(grant.ownerApproval.file)) !== grant.ownerApproval.sha256 ||
      canonicalJson(claim.named) !== canonicalJson(freshAnchorClaimFields(grant)) || claim.profileSha256 !== grant.profileSha256 || !sameDir(claim.bookDir) ||
      !sameDir(grant.bookDir) || claim.engineHead !== grant.engine.head || grant.profileSha256 !== freshBookProfileSha(loaded.profile)) refuse();
  // Everything the consumed fresh-anchor grant recorded, except its own head and pins (they bind ITS head), re-derived now by the engine.
  const replanned = await planFreshBookChildFreshAnchor(config, env, grant.recovery.grantFile, grant.ownerApproval.file);
  if (!sameJson({ ...replanned.grantDraft, engine: grant.engine, pins: grant.pins }, grant)) refuse();
  // The fresh child: its successor re-derived from the saved evidence, equal to its one durable record.
  const outcome = await assertFreshBookAdmission(rereview, env);
  const successor = await verifyChildFreshAnchorSuccessor({ config, env, grantSha: digest.grant,
    admitted: { grant, childFreshAnchor: replanned.held, outcome, planned: { profile: loaded.profile } } });
  // The audition it started: its start record and its grant exactly what the line derives (the ledger through the fresh child, unchanged).
  const auditionGrant = await freshAuditionGrant(config, env, rereview, loaded.profile, CHILD_FRESH_ANCHOR_LINE);
  if (canonicalJson(json(files.auditionGrant)) !== canonicalJson(auditionGrant) || canonicalJson(json(files.start)) !== canonicalJson({
    version: 'fresh-book-audition-start/v1', out: path.resolve(auditionDir), grantSha256: digest.auditionGrant, claimSha256: digest.claim })) refuse();
  // Its journal: every record re-derived under its rules; no unknown outcome and exactly the ONE unknown cost this line debits.
  const records = verifyMeterRecords(paid, auditionMeterRules);
  const unknown = records.filter(r => r.result && typeof r.result.estimatedMicroUsd !== 'number');
  if (records.some(r => !r.result) || unknown.length !== AC.debitCalls) refuse();
  const debit = conservativeDebitOf(paid, unknown[0].claim.step);
  const spend = new AuditionMeter(paid, auditionGrant.capMicroUsd, auditionGrant.maxCalls, auditionGrant.ledger.priorKnownApiMicroUsd,
    auditionGrant.ledger.carriedUnresolvedMicroUsd ?? 0, auditionMeterRules, [debit]).snapshot();
  if (spend.unknownCost || spend.unknownOutcome || spend.repeatedFailure || readdirSync(auditionDir).some(n => AUDITION_LATER.test(n))) refuse();
  // What a resume re-binds: the saved images, and the closed attempts of every image without a saved record (the runner's own reconstruction).
  const saved = (name: string) => existsSync(path.join(auditionDir, `${name}.json`));
  const scopePages = auditionGrant.scope.mode === 'render' ? auditionGrant.scope.pages : refuse();
  const savedSheets = (['entities', 'locations'] as const).filter(role => saved(`sheet_${role}`)), savedPages = scopePages.filter(n => saved(`page_${n}`));
  const count = (entries: (readonly [string, number])[]) => Object.fromEntries(entries.filter(([, n]) => n > 0));
  const interrupted = { sheets: count((['entities', 'locations'] as const).filter(role => !savedSheets.includes(role))
      .map(role => [role, interruptedAttempts(paid, images, 'sheet', role).length] as const)),
    pages: count(scopePages.filter(n => !savedPages.includes(n)).map(n => [String(n), interruptedAttempts(paid, images, 'page', String(n)).length] as const)) };
  const diagnostic = freshBookDiagnosticSpend(rereview, env);
  const ledger = freshBookCycleLedger({ diagnosticSettledMicroUsd: diagnostic, stages: bookStages(config.bookDir, 'child_fresh_anchor', [debit]) });
  return {
    fresh: { grantFile: path.resolve(freshGrantFile), grantSha256: digest.grant, claimSha256: digest.claim, successorSha256: digest.successor,
      auditionStartSha256: digest.start, candidateSha256: successor.candidateSha256, contextSha256: grant.fresh.contextSha256,
      storyboardDigest: grant.presence.storyboardDigest, layoutSha256: digest.layout },
    audition: { grantSha256: digest.auditionGrant, admissionSha256: digest.admission, folderSha256: previewSha(canonicalJson(folderBaseline(auditionDir))),
      calls: records.length, knownMicroUsd: spend.newKnownApiMicroUsd, savedSheets, savedPages, interrupted },
    debit,
    ledger: { diagnosticSettledMicroUsd: ledger.diagnosticSettledMicroUsd, bookKnownMicroUsd: ledger.bookKnownMicroUsd,
      conservativeDebitMicroUsd: (ledger as { conservativeDebitMicroUsd?: number }).conservativeDebitMicroUsd ?? refuse(),
      calls: ledger.stages.reduce((n, s) => n + s.calls, 0) },
    freshGrant: grant, freshHeld: replanned.held, auditionGrant, fullLedger: ledger };
}
type AuditionContinuationHeld = Awaited<ReturnType<typeof freshAnchorAuditionHalted>>;

/** Provider-free plan and the continuation grant this exact state needs (no key, no provider, no write). */
export async function planFreshBookAuditionContinuation(config: FreshBookConfig, env: FreshBookEnv, freshGrantFile: string, ownerApprovalFile: string) {
  const base = planFreshBook(config, env), loaded = loadProfile(config);
  const approval = ownerApproval(ownerApprovalFile, AC.approvalLine, 'fresh_book_audition_continuation_approval');
  const held = await freshAnchorAuditionHalted(config, env, base.rereview, loaded, freshGrantFile);
  const at = (name: string) => path.join(env.authorityRoot, name);
  const remaining = held.fullLedger.nextCapMicroUsd - held.ledger.bookKnownMicroUsd - held.ledger.conservativeDebitMicroUsd;
  const plan = { version: AC.version, cycle: FRESH_BOOK_CYCLE.id, amendment: AC.amendment, ownerApproval: approval, basePlanSha256: base.grantDraft.nativePlanSha256,
    bookDir: path.resolve(config.bookDir), fresh: held.fresh, audition: held.audition, debit: held.debit, ledger: held.ledger,
    accounting: `ONE conservative budget debit of ${held.debit.debitMicroUsd} microUSD for ${held.debit.step} (seq ${held.debit.seq}): its claim maximum, counted against both caps in place of its unknown cost; its actual charge stays unknown and its records stay as they are; known spend is reported apart; any other unknown cost or outcome still stops the meter`,
    resume: 'the SAME audition (its admission, grant, start, sheets and saved pages re-bound as before); every image without a saved record continues after its closed paid attempts (RSM-1), inside the same ceiling; the page review deadline is 600 s with no retries',
    remainingMicroUsd: remaining,
    downstream: 'the remaining pages and the cover on the unchanged gates (samples first, LOW, Sol 6.1, gpt-4o 0.70, at most 3 attempts per page), then the book status and this line\'s outcome',
    claim: at(AC.claimName), outcome: at(AC.outcomeName), providerCalls: 0, keyRead: false };
  const engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_AUDITION_CONTINUATION_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft: FreshBookAuditionContinuationGrant = freshBookAuditionContinuationGrantSchema.parse({ version: 'fresh-book-audition-continuation-grant/v1',
    cycle: FRESH_BOOK_CYCLE.id, approval: FRESH_BOOK_CYCLE.approval, amendment: AC.amendment, ownerApproval: approval, profileSha256: base.plan.profileSha256,
    bookDir: path.resolve(config.bookDir), fresh: held.fresh, audition: held.audition, debit: held.debit, ledger: held.ledger,
    engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)) });
  const state = { claimExists: existsSync(plan.claim), outcomeExists: existsSync(plan.outcome), freshOutcomeExists: existsSync(at(CF.outcomeName)),
    ledger: held.fullLedger, remainingMicroUsd: remaining, engine };
  return { plan, grantDraft, state, profile: base.profile, prepared: loaded.prepared, rereview: base.rereview, held };
}

/**
 * The continuation's admission, as admitChildFreshAnchor: the baseline pinned FIRST and held across every await: this grant's bytes, the
 * owner's record, the consumed fresh-anchor grant and its owner record, the consumed recovery grant and its owner record, the consumed
 * presence grant and its owner record and every grant of its chain (each at its recorded digest, never re-pinned), configuration, profile,
 * lineage, every line's authority records and every earlier stage entry (the fresh child's folder, the layout and the audition grant among
 * them; the audition folder itself is bound by the grant's digest and by its meter). The grant is exactly the draft this state rebuilds, at the
 * clean reviewed head. Its guard adds the continuation claim and every record it names.
 */
async function admitAuditionContinuation(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal; earlier: string[] }) {
  const bytes = fileBytes(a.grantFile);
  if (previewSha(bytes) !== a.grantSha) fail('fresh_book_audition_continuation_grant');
  const parsed = freshBookAuditionContinuationGrantSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success) return fail('fresh_book_audition_continuation_grant');
  const read = <T>(file: string, digest: string, schema: { parse(value: unknown): T } | null, code: string): [T, Buffer] => {
    const b = fileBytes(file);
    if (previewSha(b) !== digest) fail(code);
    try { return [schema ? schema.parse(JSON.parse(b.toString('utf8'))) : (null as T), b]; } catch { return fail(code); }
  };
  const approvalFile = parsed.data.ownerApproval.file;
  const [, approvalBytes] = read(approvalFile, parsed.data.ownerApproval.sha256, null, 'fresh_book_audition_continuation_approval');
  const freshFile = parsed.data.fresh.grantFile;
  const [fresh, freshBytes] = read(freshFile, parsed.data.fresh.grantSha256, freshBookChildFreshAnchorGrantSchema, 'fresh_book_audition_continuation_fresh');
  const [, freshApprovalBytes] = read(fresh.ownerApproval.file, fresh.ownerApproval.sha256, null, 'fresh_book_child_fresh_anchor_approval');
  const [recovery, recoveryBytes] = read(fresh.recovery.grantFile, fresh.recovery.grantSha256, freshBookChildRecoveryGrantSchema, 'fresh_book_child_fresh_anchor_recovery');
  const [, recoveryApprovalBytes] = read(recovery.ownerApproval.file, recovery.ownerApproval.sha256, null, 'fresh_book_child_recovery_approval');
  const [presence, presenceBytes] = read(recovery.presence.grantFile, recovery.presence.grantSha256, freshBookStoryboardPresenceGrantSchema, 'fresh_book_child_recovery_presence');
  const [, presenceApprovalBytes] = read(presence.ownerApproval.file, presence.ownerApproval.sha256, null, 'fresh_book_storyboard_presence_approval');
  const chain = presenceChainGrants(presence);
  const rereview = loadRereview(a.config);
  let roots = rootsOf(a.config, a.env, rereview, a.earlier);
  const planned = await planFreshBookAuditionContinuation(a.config, a.env, freshFile, approvalFile);
  const outcome = await assertFreshBookAdmission(planned.rereview, a.env);
  const engine = a.env.head();
  if (canonicalJson(parsed.data) !== canonicalJson(planned.grantDraft)) fail('fresh_book_audition_continuation_grant');
  if (!engine.clean || engine.head !== planned.grantDraft.engine.head || engine.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
  const frozen: [string, Buffer, string][] = [[a.grantFile, bytes, 'fresh_book_audition_continuation_grant'],
    [approvalFile, approvalBytes, 'fresh_book_audition_continuation_approval'], [freshFile, freshBytes, 'fresh_book_audition_continuation_fresh'],
    [fresh.ownerApproval.file, freshApprovalBytes, 'fresh_book_child_fresh_anchor_approval'],
    [fresh.recovery.grantFile, recoveryBytes, 'fresh_book_child_fresh_anchor_recovery'], [recovery.ownerApproval.file, recoveryApprovalBytes, 'fresh_book_child_recovery_approval'],
    [recovery.presence.grantFile, presenceBytes, 'fresh_book_child_recovery_presence'], [presence.ownerApproval.file, presenceApprovalBytes, 'fresh_book_storyboard_presence_approval'],
    ...chain];
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    for (const [file, held, code] of frozen) if (!fileBytes(file).equals(held)) fail(code);
    if (canonicalJson(rootsOf(a.config, a.env, rereview, a.earlier)) !== canonicalJson(roots)) fail('fresh_book_roots_changed');
    const e = a.env.head();
    if (!e.clean || e.head !== planned.grantDraft.engine.head || e.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(planned.grantDraft.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
  };
  const guard = () => { same(); assertFreshBookAuditionContinuationPaid({ env: a.env, grantFile: a.grantFile, grantSha: a.grantSha, profile: planned.profile, workspace: workspace() }); };
  const recapture = (added: string[]) => {
    const next = rootsOf(a.config, a.env, rereview, a.earlier), changed = Object.keys(next).filter(k => next[k] !== roots[k]);
    if (canonicalJson(Object.keys(next).sort()) !== canonicalJson(Object.keys(roots).sort()) || canonicalJson(changed.sort()) !== canonicalJson([...added].sort()) ||
        added.some(k => roots[k] !== 'absent' || next[k] === 'absent')) fail('fresh_book_roots_changed');
    roots = next; same();
  };
  same();
  return { planned, outcome, same, guard, recapture, grant: planned.grantDraft, continuation: planned.held };
}

/**
 * The ONE owner-approved continuation of the SAME audition: admission re-derives the fresh-anchor line, the fresh child's successor and the
 * halted audition exactly (its one unknown-cost call and that call's debit); the audition folder must still be exactly as the grant binds it;
 * then one claim, and the native audition resumed (resume: true) with that ONE debit under this line's guard: the sheets and the saved pages
 * re-bound from their raw reviews, every image without a saved record continuing after its closed paid attempts, samples first, the cover and
 * the remaining pages on the unchanged gates. At the end its book status and its own terminal outcome; a failure (a new unknown cost
 * included) is recorded as its terminal outcome and ends the line. Nothing earlier is written.
 */
export async function runFreshBookAuditionContinuation(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void }) {
  const { config, env } = args;
  const admitted = await admitAuditionContinuation({ ...args, earlier: ['request.json', 'admission.json', 'text', FRESH_BOOK_RECOVERY.folder,
    FRESH_BOOK_STORYBOARD_REPAIR.folder, CONT.folder, REVAL.folder, EXT.folder, XREVAL.folder, CAL.folder, PRS.folder, 'child', CR.folder, CF.folder,
    'book-layout.json', 'audition.grant.json'] });
  const grant = admitted.grant, auditionDir = path.join(config.bookDir, 'audition'), at = (name: string) => path.join(env.authorityRoot, name);
  if (existsSync(at(AC.claimName)) || existsSync(at(AC.outcomeName)) || existsSync(at(CF.outcomeName))) fail('fresh_book_audition_continuation_used');
  // No await from this check to the one claim: the audition stands exactly as the grant binds it.
  if (previewSha(canonicalJson(folderBaseline(auditionDir))) !== grant.audition.folderSha256) fail('fresh_book_audition_continuation_audition');
  admitted.same();
  claimFreshBookAuditionContinuation(env, grant, args.grantSha);
  admitted.recapture([`authority/${AC.claimName}`]);
  try {
    process.env.GPT_IMAGE_EDIT_MAX_REFERENCES ??= '4';
    const result = await runReviewedAudition({ bookDir: config.bookDir, out: auditionDir, keyFile: config.keyEnvFile,
      grantFile: path.join(config.bookDir, 'audition.grant.json'), signal: args.signal, log: args.log,
      layout: readReviewedBookLayout(path.join(config.bookDir, 'book-layout.json')), resume: true, debits: [grant.debit],
      experiment: { slot: FRESH_BOOK_AUDITION_SLOT, claimSha256: grant.fresh.claimSha256, guard: admitted.guard } });
    if (result.mode !== 'render') return fail('fresh_book_audition_mode');
    // A drawn page that is not qa_supported is held; an undrawn one is pending. Complete only when the audition itself is fully supported.
    const gate = (status: unknown): PageGate['disposition'] => status === 'qa_supported' ? 'passed' : 'held_uncertain';
    const pages = result.manifest.pages.filter(p => p.pageNumber > 0).map(p => ({ page: p.pageNumber, disposition: gate(p.status) }));
    const cover = result.manifest.pages.find(p => p.pageNumber === 0);
    const reading = freshBookReadingOrder(cover ? gate(cover.status) : null, pages);
    const status = reading.status === 'complete' && result.manifest.status !== 'qa_supported_audition' ? 'partial' as const : reading.status;
    const ledger = freshBookLedger(config, env, admitted.planned.rereview, 'child_fresh_anchor', [grant.debit]);
    exclusiveJson(path.join(config.bookDir, 'book-status-continuation.json'), { status, manifestStatus: result.manifest.status, order: reading.order,
      ledger, debit: { step: grant.debit.step, debitMicroUsd: grant.debit.debitMicroUsd, actualCost: grant.debit.actualCost }, viewer: auditionDir,
      runtimeEligible: false });
    finish(env, status, { manifestStatus: result.manifest.status, ledger }, AC.outcomeName);
    return { status, manifestStatus: result.manifest.status, order: reading.order, ledger };
  } catch (error) {
    const code = codeOf(error, 'fresh_book_audition_continuation_failed');
    if (!existsSync(at(AC.outcomeName))) finish(env, 'failed_audition_continuation', { code }, AC.outcomeName);
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The ONE owner-approved re-review of the SAME audition (Guy 2026-10-22, path A): the continuation ended with its sample page held and the
// last drawn attempt's review lost at the transport limit (no receipt). ONE more conservative budget debit of that call, ONE re-review of
// that existing image (the identical request, a step successor of the saved page) on the client-scoped review transport, then, only if the
// page passes, the same audition's cover and remaining pages on the unchanged gates.
// ---------------------------------------------------------------------------------------------------------------
const AR = FRESH_BOOK_AUDITION_REREVIEW;
/** Re-review grants pin exactly the presence line's files (the transport, the meter and the re-review live in files they already pin). */
export const FRESH_BOOK_AUDITION_REREVIEW_PINNED = FRESH_BOOK_STORYBOARD_PRESENCE_PINNED;
/** Every file an audition run writes at its end or on a resume. After the continuation exactly its own are present. */
const AUDITION_RUN_FILES = /^(resume-[0-9]+\.json|book(-r[0-9]+)?\.html|spend(-r[0-9]+)?\.json|reviewed_audition_manifest(-r[0-9]+)?\.json|page_[0-8]_rereview\.json|halted_.+\.json)$/;
/**
 * The consumed continuation and the audition it left, re-read exactly (no write). The continuation grant its claim names (every field that
 * claim wrote; its owner record by digest) and its terminal record (failed); the fresh-anchor records that grant binds, byte for byte (the
 * audition has moved on since, so it is bound by bytes, not re-planned); the audition grant and admission it binds. The journal: every
 * record re-derived under its rules, no unknown outcome, exactly TWO unknown costs: the continuation's debited call (its debit re-derived
 * equal) and ONE more, whose conservative debit is derived from its own records; with both, nothing unknown and no repeated failure. The
 * folder exactly as the continuation's run left it. The ONE re-review: the saved page whose drawn attempt's review is that second call,
 * checked by the runner's own allowance (the render drew exactly that image; no other review of it was claimed).
 */
async function continuationEnded(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, loaded: ReturnType<typeof loadProfile>,
  continuationGrantFile: string) {
  const refuse = (): never => fail('fresh_book_audition_rereview_continuation');
  if (!path.isAbsolute(continuationGrantFile) || !existsSync(continuationGrantFile)) refuse();
  const parsed = freshBookAuditionContinuationGrantSchema.safeParse(json(continuationGrantFile));
  if (!parsed.success) return refuse();
  const cg = parsed.data, at = (name: string) => path.join(env.authorityRoot, name), auditionDir = path.join(config.bookDir, 'audition');
  const paid = path.join(auditionDir, 'paid-stages');
  const files = { grant: continuationGrantFile, claim: at(AC.claimName), outcome: at(AC.outcomeName), ownerApproval: cg.ownerApproval.file,
    freshGrant: cg.fresh.grantFile, freshClaim: at(CF.claimName), successor: at(CF.successorName), start: at(CF.auditionStartName),
    auditionGrant: path.join(config.bookDir, 'audition.grant.json'), layout: path.join(config.bookDir, 'book-layout.json'),
    admission: path.join(auditionDir, 'admission.json'), manifest: path.join(auditionDir, 'reviewed_audition_manifest.json') };
  if (Object.values(files).some(f => !existsSync(f)) || existsSync(at(CF.outcomeName)) || !existsSync(paid)) refuse();
  const digest = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, previewSha(fileBytes(f))])) as Record<keyof typeof files, string>;
  const claim = json(files.claim), outcome = json(files.outcome);
  const sameDir = (x: unknown) => typeof x === 'string' && path.resolve(x).toLowerCase() === path.resolve(config.bookDir).toLowerCase();
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.auditionContinuation !== AC.version || claim.grantSha256 !== digest.grant ||
      claim.ownerApprovalSha256 !== cg.ownerApproval.sha256 || digest.ownerApproval !== cg.ownerApproval.sha256 ||
      canonicalJson(claim.named) !== canonicalJson(continuationClaimFields(cg)) || claim.profileSha256 !== cg.profileSha256 || !sameDir(claim.bookDir) ||
      !sameDir(cg.bookDir) || claim.engineHead !== cg.engine.head || cg.profileSha256 !== freshBookProfileSha(loaded.profile)) refuse();
  if (outcome?.cycle !== FRESH_BOOK_CYCLE.id || outcome.status !== 'failed_audition_continuation' || typeof outcome.code !== 'string') refuse();
  if (digest.freshGrant !== cg.fresh.grantSha256 || digest.freshClaim !== cg.fresh.claimSha256 || digest.successor !== cg.fresh.successorSha256 ||
      digest.start !== cg.fresh.auditionStartSha256 || digest.layout !== cg.fresh.layoutSha256 || digest.auditionGrant !== cg.audition.grantSha256 ||
      digest.admission !== cg.audition.admissionSha256) refuse();
  const auditionGrant = auditionGrantSchema.parse(json(files.auditionGrant));
  const records = verifyMeterRecords(paid, auditionMeterRules);
  const unknown = records.filter(r => r.result && typeof r.result.estimatedMicroUsd !== 'number').map(r => r.claim.step as string);
  if (records.some(r => !r.result) || unknown.length !== 2 || !unknown.includes(cg.debit.step) ||
      canonicalJson(conservativeDebitOf(paid, cg.debit.step)) !== canonicalJson(cg.debit)) refuse();
  const lostStep = unknown.find(s => s !== cg.debit.step)!, debits = [cg.debit, conservativeDebitOf(paid, lostStep)];
  const spend = new AuditionMeter(paid, auditionGrant.capMicroUsd, auditionGrant.maxCalls, auditionGrant.ledger.priorKnownApiMicroUsd,
    auditionGrant.ledger.carriedUnresolvedMicroUsd ?? 0, auditionMeterRules, debits).snapshot();
  if (spend.unknownCost || spend.unknownOutcome || spend.repeatedFailure) refuse();
  // Exactly what the continuation's run wrote at its end (its one resume, its viewer, spend and manifest); nothing later.
  if (canonicalJson(readdirSync(auditionDir).filter(n => AUDITION_RUN_FILES.test(n)).sort()) !==
      canonicalJson(['book-r1.html', 'resume-1.json', 'reviewed_audition_manifest.json', 'spend-r1.json'])) refuse();
  const m = /^(?:r[0-9]{1,2}_)?page_([1-8])_([0-9])_qa$/.exec(lostStep), pageFile = m ? path.join(auditionDir, `page_${m[1]}.json`) : '';
  if (!m || !existsSync(pageFile)) refuse();
  const page = Number(m![1]), attempt = Number(m![2]), saved = json(pageFile);
  const target = Array.isArray(saved?.attempts) ? saved.attempts.find((a: { attempt: number }) => a.attempt === attempt) : null;
  if (!target?.candidate || target.status !== 'unavailable' || target.review !== null || target.assessment !== null || 'identity' in target) refuse();
  const [allowed] = rereviewAllowance([{ page, attempt, lostStep }], { paid, pages: { [page]: saved }, rebound: {}, debits, stepPrefix: 'r2_' });
  const ledger = freshBookCycleLedger({ diagnosticSettledMicroUsd: freshBookDiagnosticSpend(rereview, env), stages: bookStages(config.bookDir, 'child_fresh_anchor', debits) });
  return {
    continuation: { grantFile: path.resolve(continuationGrantFile), grantSha256: digest.grant, claimSha256: digest.claim, outcomeSha256: digest.outcome,
      outcomeStatus: outcome.status as string, outcomeCode: outcome.code as string },
    audition: { grantSha256: digest.auditionGrant, admissionSha256: digest.admission, folderSha256: previewSha(canonicalJson(folderBaseline(auditionDir))),
      calls: records.length, knownMicroUsd: spend.newKnownApiMicroUsd, manifestStatus: String(json(files.manifest).status), resumeMarkers: 1,
      pageSha256: previewSha(fileBytes(pageFile)) },
    rereview: { page, attempt, lostStep, lostWireDigest: allowed.wireDigest, candidate: target.candidate as { imageName: string; imageSha: string }, step: allowed.step },
    debits,
    ledger: { diagnosticSettledMicroUsd: ledger.diagnosticSettledMicroUsd, bookKnownMicroUsd: ledger.bookKnownMicroUsd,
      conservativeDebitMicroUsd: (ledger as { conservativeDebitMicroUsd?: number }).conservativeDebitMicroUsd ?? refuse(),
      calls: ledger.stages.reduce((n, s) => n + s.calls, 0) },
    continuationGrant: cg, fullLedger: ledger };
}

/** Provider-free plan and the re-review grant this exact state needs (no key, no provider, no write). */
export async function planFreshBookAuditionRereview(config: FreshBookConfig, env: FreshBookEnv, continuationGrantFile: string, ownerApprovalFile: string) {
  const base = planFreshBook(config, env), loaded = loadProfile(config);
  const approval = ownerApproval(ownerApprovalFile, AR.approvalLine, 'fresh_book_audition_rereview_approval');
  const ended = await continuationEnded(config, env, base.rereview, loaded, continuationGrantFile);
  const at = (name: string) => path.join(env.authorityRoot, name), r = ended.rereview;
  const remaining = ended.fullLedger.nextCapMicroUsd - ended.ledger.bookKnownMicroUsd - ended.ledger.conservativeDebitMicroUsd;
  const plan = { version: AR.version, cycle: FRESH_BOOK_CYCLE.id, amendment: AR.amendment, ownerApproval: approval, basePlanSha256: base.grantDraft.nativePlanSha256,
    bookDir: path.resolve(config.bookDir), continuation: ended.continuation, audition: ended.audition, rereview: r, debits: ended.debits, ledger: ended.ledger,
    accounting: `ONE more conservative budget debit of ${ended.debits[1].debitMicroUsd} microUSD for ${ended.debits[1].step} (seq ${ended.debits[1].seq}) beside the continuation's for ${ended.debits[0].step}: each its call's claim maximum, counted against both caps in place of its unknown cost; their actual charges stay unknown and their records stay as they are; known spend is reported apart; any other unknown cost or outcome still stops the meter`,
    rereviewRule: `ONE re-review of page ${r.page} attempt ${r.attempt} (${r.candidate.imageName}): its lost request (wire ${r.lostWireDigest}) re-sent unchanged as ${r.step}, a step successor of the saved page (page_${r.page}.json stays as it is), then the identity check its gate needs; no image is drawn and no attempt is added`,
    transport: `each review call's own dispatcher: header and body limits ${AUDITION_REVIEW_TIMEOUT_MS + AUDITION_TRANSPORT_MARGIN_MS} ms, above the ${AUDITION_REVIEW_TIMEOUT_MS} ms deadline; Node's process-wide dispatcher untouched; no retries; a failure keeps its cause chain`,
    remainingMicroUsd: remaining,
    downstream: 'only if the re-reviewed page passes its gates: the cover and the remaining pages of the SAME audition (LOW, Sol 6.1, gpt-4o 0.70, at most 3 attempts each, the existing diagnosis after two holds), then the book status and this line\'s outcome; a held page stops at the sample gate',
    claim: at(AR.claimName), outcome: at(AR.outcomeName), providerCalls: 0, keyRead: false };
  const engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_AUDITION_REREVIEW_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft: FreshBookAuditionRereviewGrant = freshBookAuditionRereviewGrantSchema.parse({ version: 'fresh-book-audition-rereview-grant/v1',
    cycle: FRESH_BOOK_CYCLE.id, approval: FRESH_BOOK_CYCLE.approval, amendment: AR.amendment, ownerApproval: approval, profileSha256: base.plan.profileSha256,
    bookDir: path.resolve(config.bookDir), continuation: ended.continuation, audition: ended.audition, rereview: r, debits: ended.debits, ledger: ended.ledger,
    engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)) });
  const state = { claimExists: existsSync(plan.claim), outcomeExists: existsSync(plan.outcome), ledger: ended.fullLedger, remainingMicroUsd: remaining, engine };
  return { plan, grantDraft, state, profile: base.profile, prepared: loaded.prepared, rereview: base.rereview, ended };
}

/**
 * The re-review's admission, as admitAuditionContinuation: the baseline pinned FIRST and held across every await: this grant's bytes, the
 * owner's record, the consumed continuation grant and its owner record, the consumed fresh-anchor, recovery and presence grants and their
 * owner records and every grant of the presence chain (each at its recorded digest, never re-pinned), configuration, profile, lineage, every
 * line's authority records and every earlier stage entry. The grant is exactly the draft this state rebuilds, at the clean reviewed head.
 * Its guard adds the re-review claim and the records it names.
 */
async function admitAuditionRereview(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal; earlier: string[] }) {
  const bytes = fileBytes(a.grantFile);
  if (previewSha(bytes) !== a.grantSha) fail('fresh_book_audition_rereview_grant');
  const parsed = freshBookAuditionRereviewGrantSchema.safeParse(JSON.parse(bytes.toString('utf8')));
  if (!parsed.success) return fail('fresh_book_audition_rereview_grant');
  const read = <T>(file: string, digest: string, schema: { parse(value: unknown): T } | null, code: string): [T, Buffer] => {
    const b = fileBytes(file);
    if (previewSha(b) !== digest) fail(code);
    try { return [schema ? schema.parse(JSON.parse(b.toString('utf8'))) : (null as T), b]; } catch { return fail(code); }
  };
  const approvalFile = parsed.data.ownerApproval.file, contFile = parsed.data.continuation.grantFile;
  const [, approvalBytes] = read(approvalFile, parsed.data.ownerApproval.sha256, null, 'fresh_book_audition_rereview_approval');
  const [cont, contBytes] = read(contFile, parsed.data.continuation.grantSha256, freshBookAuditionContinuationGrantSchema, 'fresh_book_audition_rereview_continuation');
  const [, contApprovalBytes] = read(cont.ownerApproval.file, cont.ownerApproval.sha256, null, 'fresh_book_audition_continuation_approval');
  const [fresh, freshBytes] = read(cont.fresh.grantFile, cont.fresh.grantSha256, freshBookChildFreshAnchorGrantSchema, 'fresh_book_audition_continuation_fresh');
  const [, freshApprovalBytes] = read(fresh.ownerApproval.file, fresh.ownerApproval.sha256, null, 'fresh_book_child_fresh_anchor_approval');
  const [recovery, recoveryBytes] = read(fresh.recovery.grantFile, fresh.recovery.grantSha256, freshBookChildRecoveryGrantSchema, 'fresh_book_child_fresh_anchor_recovery');
  const [, recoveryApprovalBytes] = read(recovery.ownerApproval.file, recovery.ownerApproval.sha256, null, 'fresh_book_child_recovery_approval');
  const [presence, presenceBytes] = read(recovery.presence.grantFile, recovery.presence.grantSha256, freshBookStoryboardPresenceGrantSchema, 'fresh_book_child_recovery_presence');
  const [, presenceApprovalBytes] = read(presence.ownerApproval.file, presence.ownerApproval.sha256, null, 'fresh_book_storyboard_presence_approval');
  const chain = presenceChainGrants(presence);
  const rereviewConfig = loadRereview(a.config);
  let roots = rootsOf(a.config, a.env, rereviewConfig, a.earlier);
  const planned = await planFreshBookAuditionRereview(a.config, a.env, contFile, approvalFile);
  const outcome = await assertFreshBookAdmission(planned.rereview, a.env);
  const engine = a.env.head();
  if (canonicalJson(parsed.data) !== canonicalJson(planned.grantDraft)) fail('fresh_book_audition_rereview_grant');
  if (!engine.clean || engine.head !== planned.grantDraft.engine.head || engine.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
  const frozen: [string, Buffer, string][] = [[a.grantFile, bytes, 'fresh_book_audition_rereview_grant'],
    [approvalFile, approvalBytes, 'fresh_book_audition_rereview_approval'], [contFile, contBytes, 'fresh_book_audition_rereview_continuation'],
    [cont.ownerApproval.file, contApprovalBytes, 'fresh_book_audition_continuation_approval'], [cont.fresh.grantFile, freshBytes, 'fresh_book_audition_continuation_fresh'],
    [fresh.ownerApproval.file, freshApprovalBytes, 'fresh_book_child_fresh_anchor_approval'],
    [fresh.recovery.grantFile, recoveryBytes, 'fresh_book_child_fresh_anchor_recovery'], [recovery.ownerApproval.file, recoveryApprovalBytes, 'fresh_book_child_recovery_approval'],
    [recovery.presence.grantFile, presenceBytes, 'fresh_book_child_recovery_presence'], [presence.ownerApproval.file, presenceApprovalBytes, 'fresh_book_storyboard_presence_approval'],
    ...chain];
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    for (const [file, held, code] of frozen) if (!fileBytes(file).equals(held)) fail(code);
    if (canonicalJson(rootsOf(a.config, a.env, rereviewConfig, a.earlier)) !== canonicalJson(roots)) fail('fresh_book_roots_changed');
    const e = a.env.head();
    if (!e.clean || e.head !== planned.grantDraft.engine.head || e.branch !== planned.grantDraft.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(planned.grantDraft.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
  };
  const guard = () => { same(); assertFreshBookAuditionRereviewPaid({ env: a.env, grantFile: a.grantFile, grantSha: a.grantSha, profile: planned.profile, workspace: workspace() }); };
  const recapture = (added: string[]) => {
    const next = rootsOf(a.config, a.env, rereviewConfig, a.earlier), changed = Object.keys(next).filter(k => next[k] !== roots[k]);
    if (canonicalJson(Object.keys(next).sort()) !== canonicalJson(Object.keys(roots).sort()) || canonicalJson(changed.sort()) !== canonicalJson([...added].sort()) ||
        added.some(k => roots[k] !== 'absent' || next[k] === 'absent')) fail('fresh_book_roots_changed');
    roots = next; same();
  };
  same();
  return { planned, outcome, same, guard, recapture, grant: planned.grantDraft, continuation: cont };
}

/**
 * The ONE owner-approved re-review of the SAME audition: admission re-derives the consumed continuation and the audition it left (its two
 * unknown-cost calls and their debits, the saved page and its never-judged drawn attempt); the audition folder must still be exactly as the
 * grant binds it; then one claim, and the native audition resumed (resume: true) with BOTH debits and the ONE re-review under this line's
 * guard: the sheets and saved pages re-bound from their raw reviews, the named attempt re-reviewed with its identical request, and only if
 * the page then passes, the cover and the remaining pages on the unchanged gates. At the end its book status and its own terminal outcome; a
 * failure (a new unknown cost included) is recorded as its terminal outcome and ends the line. Nothing earlier is written.
 */
export async function runFreshBookAuditionRereview(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void }) {
  const { config, env } = args;
  const admitted = await admitAuditionRereview({ ...args, earlier: ['request.json', 'admission.json', 'text', FRESH_BOOK_RECOVERY.folder,
    FRESH_BOOK_STORYBOARD_REPAIR.folder, CONT.folder, REVAL.folder, EXT.folder, XREVAL.folder, CAL.folder, PRS.folder, 'child', CR.folder, CF.folder,
    'book-layout.json', 'audition.grant.json'] });
  const grant = admitted.grant, auditionDir = path.join(config.bookDir, 'audition'), at = (name: string) => path.join(env.authorityRoot, name);
  if (existsSync(at(AR.claimName)) || existsSync(at(AR.outcomeName)) || existsSync(at(CF.outcomeName))) fail('fresh_book_audition_rereview_used');
  // No await from this check to the one claim: the audition stands exactly as the grant binds it.
  if (previewSha(canonicalJson(folderBaseline(auditionDir))) !== grant.audition.folderSha256) fail('fresh_book_audition_rereview_audition');
  admitted.same();
  claimFreshBookAuditionRereview(env, grant, args.grantSha);
  admitted.recapture([`authority/${AR.claimName}`]);
  try {
    process.env.GPT_IMAGE_EDIT_MAX_REFERENCES ??= '4';
    const result = await runReviewedAudition({ bookDir: config.bookDir, out: auditionDir, keyFile: config.keyEnvFile,
      grantFile: path.join(config.bookDir, 'audition.grant.json'), signal: args.signal, log: args.log,
      layout: readReviewedBookLayout(path.join(config.bookDir, 'book-layout.json')), resume: true, debits: grant.debits,
      rereview: [{ page: grant.rereview.page, attempt: grant.rereview.attempt, lostStep: grant.rereview.lostStep }],
      experiment: { slot: FRESH_BOOK_AUDITION_SLOT, claimSha256: admitted.continuation.fresh.claimSha256, guard: admitted.guard } });
    if (result.mode !== 'render') return fail('fresh_book_audition_mode');
    const gate = (status: unknown): PageGate['disposition'] => status === 'qa_supported' ? 'passed' : 'held_uncertain';
    const pages = result.manifest.pages.filter(p => p.pageNumber > 0).map(p => ({ page: p.pageNumber, disposition: gate(p.status) }));
    const cover = result.manifest.pages.find(p => p.pageNumber === 0);
    const reading = freshBookReadingOrder(cover ? gate(cover.status) : null, pages);
    // A held sample is named as such (the rest was never drawn); otherwise complete only when the audition itself is fully supported.
    const status = result.manifest.status === 'held_sample' ? 'held_sample' as const
      : reading.status === 'complete' && result.manifest.status !== 'qa_supported_audition' ? 'partial' as const : reading.status;
    const ledger = freshBookLedger(config, env, admitted.planned.rereview, 'child_fresh_anchor', grant.debits);
    exclusiveJson(path.join(config.bookDir, 'book-status-rereview.json'), { status, manifestStatus: result.manifest.status, order: reading.order, ledger,
      debits: grant.debits.map(d => ({ step: d.step, debitMicroUsd: d.debitMicroUsd, actualCost: d.actualCost })),
      rereview: { page: grant.rereview.page, attempt: grant.rereview.attempt, step: grant.rereview.step }, viewer: auditionDir, runtimeEligible: false });
    finish(env, status, { manifestStatus: result.manifest.status, ledger }, AR.outcomeName);
    return { status, manifestStatus: result.manifest.status, order: reading.order, ledger };
  } catch (error) {
    const code = codeOf(error, 'fresh_book_audition_rereview_failed');
    if (!existsSync(at(AR.outcomeName))) finish(env, 'failed_audition_rereview', { code }, AR.outcomeName);
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Stage 3: the book (the audition grant derived from the verified ledgers, then the reviewed audition through its experiment guard).
// ---------------------------------------------------------------------------------------------------------------
export const FRESH_BOOK_AUDITION_SLOT = 'fresh-book-usd7' as const;
const auditionStartFile = (env: FreshBookEnv) => path.join(env.authorityRoot, 'owner-cycle-20261017-fresh-book-usd7.audition.json');
/** This ONE continuation follows the consumed re-review, not a relabelled original grant. Defaults/old lines remain closed. */
export const FRESH_BOOK_AUDITION_CALIBRATION = Object.freeze({ version: AUDITION_CALIBRATION_VERSION,
  claimName: 'owner-cycle-20261017-fresh-book-usd7.audition-calibration.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.audition-calibration.outcome.json',
  approvalLine: 'יאללה תמשיך! קלוד בהשהייה - הביצוע עליך' });
const AK = FRESH_BOOK_AUDITION_CALIBRATION;
const CALIBRATION_EARLIER = ['request.json', 'admission.json', 'text', FRESH_BOOK_RECOVERY.folder, FRESH_BOOK_STORYBOARD_REPAIR.folder,
  CONT.folder, REVAL.folder, EXT.folder, XREVAL.folder, CAL.folder, PRS.folder, 'child', CR.folder, CF.folder, 'book-layout.json',
  'audition.grant.json', 'book-status-rereview.json'];
const calibrationParentSchema = z.object({ page: z.number().int().min(1).max(8), action: z.enum(['requalify', 'correct_once']),
  priorSha256: z.string().regex(/^[a-f0-9]{64}$/), consumedAttemptsBefore: z.number().int().min(1).max(3) }).strict();
export const freshBookAuditionCalibrationGrantSchema = z.object({ version: z.literal('fresh-book-audition-calibration-grant/v1'),
  cycle: z.literal(FRESH_BOOK_CYCLE.id), contract: z.literal(LANDMARK_DESIGN_HEAD_VERSION),
  ownerApproval: z.object({ file: z.string(), sha256: z.string() }).strict(), profileSha256: z.string(), bookDir: z.string(),
  parent: z.object({ grantFile: z.string(), grantSha256: z.string(), claimSha256: z.string(), outcomeSha256: z.string() }).strict(),
  auditionFolderSha256: z.string(), rootsSha256: z.string(),
  calibration: z.object({ version: z.literal(AUDITION_CALIBRATION_VERSION), pages: z.array(calibrationParentSchema).length(2) }).strict(),
  debits: freshBookAuditionRereviewGrantSchema.shape.debits,
  ledger: z.unknown(), engine: freshBookAuditionRereviewGrantSchema.shape.engine, pins: freshBookAuditionRereviewGrantSchema.shape.pins,
  nativePlanSha256: z.string() }).strict();

/** Offline plan: consumed authority, original admission, cumulative ledger and every sample parent, before a key/claim/provider. */
export async function planFreshBookAuditionCalibration(config: FreshBookConfig, env: FreshBookEnv, parentGrantFile: string, approvalFile: string) {
  const base = planFreshBook(config, env), approval = ownerApproval(approvalFile, AK.approvalLine, 'fresh_book_calibration_approval');
  const refuse = (): never => fail('fresh_book_calibration_parent');
  const parentBytes = fileBytes(parentGrantFile), parent = freshBookAuditionRereviewGrantSchema.parse(JSON.parse(parentBytes.toString('utf8')));
  const at = (name: string) => path.join(env.authorityRoot, name), dir = path.join(config.bookDir, 'audition');
  const claim = json(at(AR.claimName)), outcome = json(at(AR.outcomeName));
  if (parent.profileSha256 !== base.plan.profileSha256 || path.resolve(parent.bookDir).toLowerCase() !== path.resolve(config.bookDir).toLowerCase() ||
      claim.cycle !== FRESH_BOOK_CYCLE.id || claim.auditionRereview !== AR.version || claim.grantSha256 !== previewSha(parentBytes) ||
      claim.ownerApprovalSha256 !== parent.ownerApproval.sha256 || claim.profileSha256 !== parent.profileSha256 || claim.engineHead !== parent.engine.head ||
      path.resolve(claim.bookDir).toLowerCase() !== path.resolve(config.bookDir).toLowerCase() ||
      canonicalJson(claim.named) !== canonicalJson(rereviewClaimFields(parent)) || outcome.cycle !== FRESH_BOOK_CYCLE.id || outcome.status !== 'held_sample' ||
      outcome.manifestStatus !== 'held_sample' || previewSha(fileBytes(parent.ownerApproval.file)) !== parent.ownerApproval.sha256 ||
      previewSha(fileBytes(path.join(dir, 'admission.json'))) !== parent.audition.admissionSha256 ||
      previewSha(fileBytes(path.join(config.bookDir, 'audition.grant.json'))) !== parent.audition.grantSha256) refuse();
  // Re-read the consumed continuation grant, its owner record and named claim/outcome: no relabelling the ancestry.
  const contBytes = fileBytes(parent.continuation.grantFile), cont = freshBookAuditionContinuationGrantSchema.parse(JSON.parse(contBytes.toString('utf8')));
  if (previewSha(contBytes) !== parent.continuation.grantSha256 || previewSha(fileBytes(at(AC.claimName))) !== parent.continuation.claimSha256 ||
      previewSha(fileBytes(at(AC.outcomeName))) !== parent.continuation.outcomeSha256 ||
      previewSha(fileBytes(cont.ownerApproval.file)) !== cont.ownerApproval.sha256 ||
      canonicalJson(parent.debits[0]) !== canonicalJson(cont.debit)) refuse();
  await assertFreshBookAdmission(base.rereview, env);
  // loadReviewedBook binds the admitted storyboard and inspected final child to the frozen layout/profile, not cwd/env assets.
  const loaded = loadReviewedBook(config.bookDir, workspace(), undefined, readReviewedBookLayout(path.join(config.bookDir, 'book-layout.json')));
  const auditionGrant = auditionGrantSchema.parse(json(path.join(config.bookDir, 'audition.grant.json')));
  if (auditionGrant.scope.mode !== 'render') return refuse();
  const scope = auditionGrant.scope;
  if (scope.scaleLineup || scope.pageAttempts !== undefined || scope.sample?.length !== 2 ||
      auditionGrant.book.requestId !== loaded.queued.requestId || auditionGrant.book.storyboardDigest !== loaded.book.storyboardDigest) refuse();
  const ledger = freshBookLedger(config, env, base.rereview, 'child_fresh_anchor', parent.debits);
  if (canonicalJson(ledger) !== canonicalJson(outcome.ledger)) refuse();
  const manifest = json(path.join(dir, 'reviewed_audition_manifest-r2.json'));
  if (manifest.status !== 'held_sample' || manifest.pages.length !== 2 || manifest.scope.sample?.join(',') !== scope.sample!.join(',')) refuse();
  const parents = scope.sample!.map(page => {
    const prior = json(path.join(dir, `page_${page}.json`)) as SavedPage;
    const reFile = path.join(dir, `page_${page}_rereview.json`);
    let effective = prior;
    if (existsSync(reFile)) {
      const re = json(reFile) as SavedRereview;
      if (re.version !== AUDITION_REREVIEW_VERSION || re.priorSha256 !== previewSha(canonicalJson(prior))) refuse();
      effective = { ...prior, attempts: prior.attempts.map(a => a.attempt === re.attempt ? re.reviewed : a), chosen: re.chosen, status: re.status,
        rereview: { version: AUDITION_REREVIEW_VERSION, attempt: re.attempt } };
    }
    return { page, action: effective.status === 'qa_supported' ? 'requalify' as const : 'correct_once' as const,
      priorSha256: previewSha(canonicalJson(effective)), consumedAttemptsBefore: effective.attempts.length };
  });
  const calibration: AuditionCalibration = { version: AUDITION_CALIBRATION_VERSION, pages: parents };
  if (parents[0].action !== 'requalify' || parents[1].action !== 'correct_once' || parents[1].consumedAttemptsBefore !== FRESH_BOOK_CYCLE.pageAttempts ||
      readdirSync(dir).filter(n => /^resume-[0-9]+\.json$/.test(n)).length !== 2 || existsSync(path.join(dir, 'admission-calibration.json'))) refuse();
  // Exercise the SAME engine's old-context binding of ALL parents, then stop at its first new judge call. No side effect or provider.
  let preview: { step: string; contextSha: string; context: unknown; candidate: AuditionImage } | null = null;
  const readImage = (imageName: string) => ({ imageName, imageSha: previewSha(fileBytes(path.join(dir, 'illustrations', imageName))) });
  const savedPages = Object.fromEntries(parents.map(p => [p.page, json(path.join(dir, `page_${p.page}.json`))]));
  const rebound = Object.fromEntries(parents.filter(p => existsSync(path.join(dir, `page_${p.page}_rereview.json`))).map(p => {
    const saved = json(path.join(dir, `page_${p.page}_rereview.json`)); return [p.page, { attempt: saved.attempt, saved }]; }));
  try {
    await illustrateReviewedAudition({ book: loaded.book, rawReview: loaded.rawReview, texts: loaded.texts, current: loaded.current,
      child: readImage('reference_child.png'), companion: readImage('reference_companion.png'), companionDescription: loaded.companionDescription,
      pages: scope.pages, sample: scope.sample, recovery: scope.recovery ? true : undefined, calibration,
      ...('ownerAcceptance' in loaded ? { ownerAcceptance: loaded.ownerAcceptance } : {}),
      resume: { designs: json(path.join(dir, 'audition_sheet_designs.json')), sheets: { entities: json(path.join(dir, 'sheet_entities.json')),
        locations: json(path.join(dir, 'sheet_locations.json')) }, pages: savedPages, stepPrefix: 'r3_', rereview: { pages: rebound } },
      check: () => { if (preview) fail('fresh_book_calibration_preview_complete'); }, save: () => fail('fresh_book_calibration_preview_write'),
      render: async () => fail('fresh_book_calibration_preview_render'), identity: async () => fail('fresh_book_calibration_preview_identity'),
      judge: async (step, candidate, context, contextSha) => {
        preview = { step, candidate, context, contextSha }; throw new ReviewedAuditionError('fresh_book_calibration_preview_complete'); } });
  } catch (error) { if (!preview || codeOf(error, '') !== 'fresh_book_calibration_preview_complete') throw error; }
  if (!preview) return refuse();
  const roots = rootsOf(config, env, base.rereview, CALIBRATION_EARLIER), auditionFiles = folderBaseline(dir), engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_AUDITION_REREVIEW_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const plan = { version: AK.version, cycle: FRESH_BOOK_CYCLE.id, contract: LANDMARK_DESIGN_HEAD_VERSION, ownerApproval: approval,
    profileSha256: base.plan.profileSha256, bookDir: path.resolve(config.bookDir),
    parent: { grantFile: path.resolve(parentGrantFile), grantSha256: previewSha(parentBytes), claimSha256: previewSha(fileBytes(at(AR.claimName))),
      outcomeSha256: previewSha(fileBytes(at(AR.outcomeName))) }, auditionFolderSha256: previewSha(canonicalJson(auditionFiles)),
    rootsSha256: previewSha(canonicalJson(roots)), calibration, debits: parent.debits, ledger,
    firstContextSha256: previewSha(canonicalJson(preview)),
    ceiling: 'requalify saved first sample (no render); ONE LOW correction of the held second sample as explicit attempt 4, fresh quality/identity evidence under v11 for both; downstream only after both PASS; no further calibration retry/resume',
    downstream: 'SAME book, remaining pages and cover, existing 3 ordinary attempts each, gpt-image-2 LOW, Sol6.1 quality, gpt-4o numeric identity >=0.70; held sheets stay held; no budget/call reset',
    providerCalls: 0, keyRead: false };
  const { ceiling: _ceiling, downstream: _downstream, providerCalls: _calls, keyRead: _key, firstContextSha256: _context, ...bound } = plan;
  const grantDraft = freshBookAuditionCalibrationGrantSchema.parse({ ...bound, version: 'fresh-book-audition-calibration-grant/v1',
    engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)) });
  return { plan, grantDraft, state: { engine, claimExists: existsSync(at(AK.claimName)), outcomeExists: existsSync(at(AK.outcomeName)) },
    roots, auditionFiles, base, parent, cont, calibration };
}

/** Native one-use continuation. No original grant, admission, image, raw review, claim, outcome or debit is overwritten. */
export async function runFreshBookAuditionCalibration(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string;
  signal: AbortSignal; log: (line: string) => void }) {
  const bytes = fileBytes(a.grantFile), refuse = (): never => fail('fresh_book_calibration_grant');
  if (previewSha(bytes) !== a.grantSha) refuse();
  const g = freshBookAuditionCalibrationGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  const p = await planFreshBookAuditionCalibration(a.config, a.env, g.parent.grantFile, g.ownerApproval.file);
  if (canonicalJson(g) !== canonicalJson(p.grantDraft)) refuse();
  const at = (name: string) => path.join(a.env.authorityRoot, name), dir = path.join(a.config.bookDir, 'audition');
  const frozen = [[a.grantFile, a.grantSha], [g.ownerApproval.file, g.ownerApproval.sha256], [g.parent.grantFile, g.parent.grantSha256],
    [p.parent.ownerApproval.file, p.parent.ownerApproval.sha256], [p.parent.continuation.grantFile, p.parent.continuation.grantSha256],
    [p.cont.ownerApproval.file, p.cont.ownerApproval.sha256]];
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    const e = a.env.head();
    if (!e.clean || e.head !== g.engine.head || e.branch !== g.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, digest] of Object.entries(g.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('fresh_book_source_changed');
    for (const [file, digest] of frozen) if (previewSha(fileBytes(file)) !== digest) refuse();
    if (canonicalJson(rootsOf(a.config, a.env, p.base.rereview, CALIBRATION_EARLIER)) !== canonicalJson(p.roots)) fail('fresh_book_roots_changed');
    for (const [rel, digest] of Object.entries(p.auditionFiles)) if (previewSha(fileBytes(path.join(dir, rel))) !== digest) fail('fresh_book_calibration_parent');
  };
  same();
  if (p.state.claimExists || p.state.outcomeExists || existsSync(at(AK.claimName)) || existsSync(at(AK.outcomeName))) fail('fresh_book_calibration_used');
  const claim = { cycle: FRESH_BOOK_CYCLE.id, version: AK.version, grantSha256: a.grantSha, parent: g.parent,
    ownerApproval: g.ownerApproval, engine: g.engine, bookDir: g.bookDir, calibration: g.calibration };
  exclusiveJson(at(AK.claimName), claim);
  const claimSha256 = previewSha(fileBytes(at(AK.claimName)));
  const guard = () => {
    same();
    if (previewSha(fileBytes(at(AK.claimName))) !== claimSha256 || existsSync(at(AK.outcomeName))) fail('fresh_book_calibration_used');
  };
  try {
    const result = await runReviewedAudition({ bookDir: a.config.bookDir, out: dir, keyFile: a.config.keyEnvFile,
      grantFile: path.join(a.config.bookDir, 'audition.grant.json'), signal: a.signal, log: a.log,
      layout: readReviewedBookLayout(path.join(a.config.bookDir, 'book-layout.json')), resume: true, debits: g.debits,
      calibration: { grantSha256: a.grantSha, contract: p.calibration },
      experiment: { slot: FRESH_BOOK_AUDITION_SLOT, claimSha256: p.cont.fresh.claimSha256, guard } });
    if (result.mode !== 'render') return fail('fresh_book_audition_mode');
    const gate = (s: unknown): PageGate['disposition'] => s === 'qa_supported' ? 'passed' : 'held_uncertain';
    const cover = result.manifest.pages.find(x => x.pageNumber === 0), reading = freshBookReadingOrder(cover ? gate(cover.status) : null,
      result.manifest.pages.filter(x => x.pageNumber > 0).map(x => ({ page: x.pageNumber, disposition: gate(x.status) })));
    const status = result.manifest.status === 'held_sample' ? 'held_sample' : reading.status === 'complete' &&
      result.manifest.status !== 'qa_supported_audition' ? 'partial' : reading.status;
    const ledger = freshBookLedger(a.config, a.env, p.base.rereview, 'child_fresh_anchor', g.debits);
    exclusiveJson(path.join(a.config.bookDir, 'book-status-calibration.json'), { status, manifestStatus: result.manifest.status,
      order: reading.order, ledger, grantSha256: a.grantSha, runtimeEligible: false });
    finish(a.env, status, { manifestStatus: result.manifest.status, ledger }, AK.outcomeName);
    return { status, manifestStatus: result.manifest.status, order: reading.order, ledger };
  } catch (error) {
    if (!existsSync(at(AK.outcomeName))) finish(a.env, 'failed_audition_calibration', { code: codeOf(error, 'fresh_book_calibration_failed') }, AK.outcomeName);
    throw error;
  }
}

/** A new fixed one-use line, following rather than repinning the consumed calibration. */
export const FRESH_BOOK_AUDITION_TOPOLOGY = Object.freeze({ version: AUDITION_TOPOLOGY_CONTINUATION_VERSION,
  claimName: 'owner-cycle-20261017-fresh-book-usd7.audition-topology.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.audition-topology.outcome.json',
  approvalLine: 'יש אישור בתשלום - אל תעצור כדי לשאול אותי' });
const AT = FRESH_BOOK_AUDITION_TOPOLOGY;
export const FRESH_BOOK_AUDITION_TOPOLOGY_PINNED = Object.freeze([...FRESH_BOOK_AUDITION_REREVIEW_PINNED,
  'lib/personal-wizard/landmark-topology.ts', 'lib/personal-wizard/simple-book-illustrations.ts',
  'lib/generation-pipeline/page-child-resemblance-vision.ts', 'lib/generation-pipeline/asset-integrity.ts',
  'lib/personal-wizard/request-acceptance.ts', 'package-lock.json']);
export const freshBookAuditionTopologyGrantSchema = freshBookAuditionCalibrationGrantSchema.omit({ version: true, contract: true, calibration: true }).extend({
  version: z.literal('fresh-book-audition-topology-grant/v1'), contract: z.literal(LANDMARK_TOPOLOGY_VERSION),
  transition: z.object({ version: z.literal(AUDITION_TOPOLOGY_CONTINUATION_VERSION), pages: z.array(calibrationParentSchema).length(2) }).strict(),
  firstReview: z.object({ step: z.string().regex(/^r[0-9]{1,2}_page_[1-8]_[0-9]+_qa$/), wireDigest: hash, contextSha256: hash }).strict(),
  allowance: z.object({ firstSampleRenders: z.literal(0), extraSecondSampleRenders: z.literal(1), ordinaryPageAttempts: z.literal(3),
    maxNewCalls: z.number().int().positive().max(AUDITION_WORST_CASE_CALLS) }).strict(),
}).strict();
const topologyEarlier = [...CALIBRATION_EARLIER, 'book-status-calibration.json'];
function topologyRoots(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig) {
  return { ...rootsOf(config, env, rereview, topologyEarlier),
    [`authority/${AK.claimName}`]: previewSha(fileBytes(path.join(env.authorityRoot, AK.claimName))),
    [`authority/${AK.outcomeName}`]: previewSha(fileBytes(path.join(env.authorityRoot, AK.outcomeName))) };
}

/** Re-derive the spent v11 line, receipt evidence, cumulative meter and exact prospective v12 seam; no key/provider/write. */
export async function planFreshBookAuditionTopology(config: FreshBookConfig, env: FreshBookEnv, parentGrantFile: string, approvalFile: string) {
  const base = planFreshBook(config, env), approval = ownerApproval(approvalFile, AT.approvalLine, 'fresh_book_topology_approval');
  const refuse = (): never => fail('fresh_book_topology_parent'), dir = path.join(config.bookDir, 'audition');
  const at = (name: string) => path.join(env.authorityRoot, name);
  const parentBytes = fileBytes(parentGrantFile), parent = freshBookAuditionCalibrationGrantSchema.parse(JSON.parse(parentBytes.toString('utf8')));
  // Freeze before awaited replay/inspection. No later recapture can silently turn changed data into the admitted baseline.
  const roots = topologyRoots(config, env, base.rereview), auditionFiles = folderBaseline(dir), engine = env.head();
  const pins = Object.fromEntries(FRESH_BOOK_AUDITION_TOPOLOGY_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const immutableFiles: [string, string][] = [[parentGrantFile, previewSha(parentBytes)], [approval.file, approval.sha256],
    [parent.ownerApproval.file, parent.ownerApproval.sha256], [parent.parent.grantFile, parent.parent.grantSha256]];
  const same = () => {
    if (canonicalJson(roots) !== canonicalJson(topologyRoots(config, env, base.rereview)) ||
        canonicalJson(auditionFiles) !== canonicalJson(folderBaseline(dir))) fail('fresh_book_roots_changed');
    for (const [f, sha] of immutableFiles) if (previewSha(fileBytes(f)) !== sha) refuse();
    const now = env.head();
    if (now.head !== engine.head || now.branch !== engine.branch || now.clean !== engine.clean) fail('fresh_book_source_changed');
    for (const [rel, sha] of Object.entries(pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== sha) fail('fresh_book_source_changed');
  };
  const claim = json(at(AK.claimName)), outcome = json(at(AK.outcomeName));
  const expectedClaim = { cycle: FRESH_BOOK_CYCLE.id, version: AK.version, grantSha256: previewSha(parentBytes), parent: parent.parent,
    ownerApproval: parent.ownerApproval, engine: parent.engine, bookDir: parent.bookDir, calibration: parent.calibration };
  if (canonicalJson(claim) !== canonicalJson(expectedClaim) || parent.profileSha256 !== base.plan.profileSha256 ||
      path.resolve(parent.bookDir).toLowerCase() !== path.resolve(config.bookDir).toLowerCase() ||
      outcome.cycle !== FRESH_BOOK_CYCLE.id || outcome.status !== 'held_sample' || outcome.manifestStatus !== 'held_sample' ||
      previewSha(canonicalJson(rootsOf(config, env, base.rereview, CALIBRATION_EARLIER))) !== parent.rootsSha256 ||
      previewSha(fileBytes(at(AR.claimName))) !== parent.parent.claimSha256 ||
      previewSha(fileBytes(at(AR.outcomeName))) !== parent.parent.outcomeSha256) refuse();
  const reBytes = fileBytes(parent.parent.grantFile), re = freshBookAuditionRereviewGrantSchema.parse(JSON.parse(reBytes.toString('utf8')));
  const contBytes = fileBytes(re.continuation.grantFile), cont = freshBookAuditionContinuationGrantSchema.parse(JSON.parse(contBytes.toString('utf8')));
  immutableFiles.push([re.ownerApproval.file, re.ownerApproval.sha256], [re.continuation.grantFile, re.continuation.grantSha256],
    [cont.ownerApproval.file, cont.ownerApproval.sha256]);
  if (re.profileSha256 !== parent.profileSha256 || canonicalJson(re.debits) !== canonicalJson(parent.debits) ||
      previewSha(contBytes) !== re.continuation.grantSha256 ||
      previewSha(fileBytes(at(AC.claimName))) !== re.continuation.claimSha256 || previewSha(fileBytes(at(AC.outcomeName))) !== re.continuation.outcomeSha256 ||
      canonicalJson(cont.debit) !== canonicalJson(parent.debits[0])) refuse();
  // The consumed calibration added exactly these fourteen audition files, no render. Its entire earlier folder still binds its old grant.
  const samples = parent.calibration.pages, first = samples[0], second = samples[1];
  if (first.action !== 'requalify' || second.action !== 'correct_once') refuse();
  const saved = json(path.join(dir, `page_${first.page}_calibration.json`)) as SavedCalibration;
  const oldStep = `r3_page_${first.page}_${saved.reviewed.attempt}`;
  const additions = new Set(['admission-calibration.json', 'resume-3.json', `page_${first.page}_calibration.json`,
    'reviewed_audition_manifest-r3.json', 'book-r3.html', 'spend-r3.json', ...['_qa', '_identity'].flatMap(suffix =>
      ['wire', 'claim', 'receipt', 'result'].map(kind => `paid-stages/${oldStep}${suffix}.${kind}.json`))]);
  if ([...additions].some(n => !auditionFiles[n]) || previewSha(canonicalJson(Object.fromEntries(Object.entries(auditionFiles)
      .filter(([rel]) => !additions.has(rel))))) !== parent.auditionFolderSha256 ||
      readdirSync(dir).filter(n => /^resume-[0-9]+\.json$/.test(n)).length !== 3 || existsSync(path.join(dir, 'admission-topology.json'))) refuse();
  const originalAdmission = path.join(dir, 'admission.json');
  if (canonicalJson(json(path.join(dir, 'admission-calibration.json'))) !== canonicalJson({ version: AK.version,
      parentAdmissionSha256: previewSha(fileBytes(originalAdmission)), grantSha256: previewSha(parentBytes),
      contract: parent.calibration, policy: reviewedAuditionPolicy(undefined, true) })) refuse();
  await assertFreshBookAdmission(base.rereview, env); same();
  const layout = readReviewedBookLayout(path.join(config.bookDir, 'book-layout.json'));
  const loaded = loadReviewedBook(config.bookDir, workspace(), undefined, layout);
  const grant = auditionGrantSchema.parse(json(path.join(config.bookDir, 'audition.grant.json')));
  if (grant.scope.mode !== 'render') return refuse();
  const scope = grant.scope;
  if (scope.scaleLineup || scope.pageAttempts !== undefined || scope.reuseSheets || scope.sample?.length !== 2 ||
      canonicalJson(scope.pages) !== canonicalJson([0, 1, 2, 3, 4, 5, 6, 7, 8]) ||
      canonicalJson(scope.sample) !== canonicalJson(samples.map(p => p.page)) || grant.maxCalls !== AUDITION_WORST_CASE_CALLS ||
      grant.book.requestId !== loaded.queued.requestId || grant.book.storyboardDigest !== loaded.book.storyboardDigest ||
      previewSha(fileBytes(originalAdmission)) !== re.audition.admissionSha256 ||
      previewSha(fileBytes(path.join(config.bookDir, 'audition.grant.json'))) !== re.audition.grantSha256) refuse();
  const ledger = freshBookLedger(config, env, base.rereview, 'child_fresh_anchor', parent.debits);
  if (canonicalJson(ledger) !== canonicalJson(outcome.ledger)) refuse();
  const readImage = (imageName: string) => ({ imageName, imageSha: previewSha(fileBytes(path.join(dir, 'illustrations', imageName))) });
  const bytesOf = (image: AuditionImage) => {
    const b = fileBytes(path.join(dir, 'illustrations', image.imageName)); if (previewSha(b) !== image.imageSha) refuse(); return b;
  };
  const pages = Object.fromEntries(samples.map(p => [p.page, json(path.join(dir, `page_${p.page}.json`)) as SavedPage]));
  const rebound = Object.fromEntries(samples.filter(p => existsSync(path.join(dir, `page_${p.page}_rereview.json`))).map(p => {
    const s = json(path.join(dir, `page_${p.page}_rereview.json`)); return [p.page, { attempt: s.attempt, saved: s }]; }));
  const parentCalibration: AuditionCalibration = { ...parent.calibration,
    pages: samples.map(p => ({ ...p, ...(p.page === first.page ? { saved } : {}) })) };
  const resume = { designs: json(path.join(dir, 'audition_sheet_designs.json')), pages,
    sheets: { entities: json(path.join(dir, 'sheet_entities.json')), locations: json(path.join(dir, 'sheet_locations.json')) },
    stepPrefix: 'r4_', rereview: { pages: rebound } };
  const engineArgs = { book: loaded.book, rawReview: loaded.rawReview, texts: loaded.texts, current: loaded.current,
    child: readImage('reference_child.png'), companion: readImage('reference_companion.png'), companionDescription: loaded.companionDescription,
    pages: scope.pages, sample: scope.sample, recovery: scope.recovery ? true as const : undefined, resume,
    ...('ownerAcceptance' in loaded ? { ownerAcceptance: loaded.ownerAcceptance } : {}), check: same,
    render: async (): Promise<never> => refuse(), identity: async (): Promise<never> => refuse(), judge: async (): Promise<never> => refuse() };
  let oldManifest: unknown;
  await illustrateReviewedAudition({ ...engineArgs, calibration: parentCalibration,
    save: (name, value) => { if (name !== 'reviewed_audition_manifest') refuse(); oldManifest = value; } });
  if (canonicalJson(oldManifest) !== canonicalJson(json(path.join(dir, 'reviewed_audition_manifest-r3.json')))) refuse();
  // The v11 saved judgment is also its ACTUAL receipt and wire, not a fabricated coherent raw/assessment pair.
  const oldWire = json(path.join(dir, 'paid-stages', `${oldStep}_qa.wire.json`));
  const oldContext = JSON.parse(oldWire.input[0].content.find((c: any) => c.type === 'input_text').text).context;
  if (previewQualityContextSha(oldContext) !== saved.contextSha) refuse();
  const oldPayload = await auditionJudgePayload({ candidate: saved.reviewed.candidate!, candidateBytes: bytesOf(saved.reviewed.candidate!),
    context: oldContext, contextSha: saved.contextSha, refs: oldContext.references.map(bytesOf),
    predecessor: oldContext.predecessor ? bytesOf(oldContext.predecessor) : null, kind: 'page' });
  if (canonicalJson(digestImages(oldPayload)) !== canonicalJson(oldWire) || canonicalJson(saved.reviewed.review) !== canonicalJson(
      auditionPageReviewSchemaForContext(oldContext).parse(JSON.parse(json(path.join(dir, 'paid-stages', `${oldStep}_qa.receipt.json`)).raw.output_text)))) refuse();
  const idReceipt = json(path.join(dir, 'paid-stages', `${oldStep}_identity.receipt.json`));
  const identity = await evaluatePageChildResemblanceVision({ referenceImageUrl: `data:image/png;base64,${bytesOf(engineArgs.child).toString('base64')}`,
    candidateImageUrl: `data:image/png;base64,${bytesOf(saved.reviewed.candidate!).toString('base64')}`, threshold: .7, model: 'gpt-4o',
    apiKey: 'offline-receipt-replay-not-a-key', maxRetries: 0, fetchImpl: async (_url, init) => {
      if (canonicalJson(digestImages(JSON.parse(String(init!.body)))) !== canonicalJson(json(path.join(dir, 'paid-stages', `${oldStep}_identity.wire.json`)))) refuse();
      return new Response(JSON.stringify(idReceipt.raw), { status: idReceipt.status });
    } });
  if (canonicalJson(identity) !== canonicalJson(saved.reviewed.identity)) refuse();
  const effective = (page: number): SavedPage => {
    const original = pages[page], re = rebound[page]?.saved as SavedRereview | undefined;
    return re ? { ...original, attempts: original.attempts.map(a => a.attempt === re.attempt ? re.reviewed : a), chosen: re.chosen, status: re.status,
      rereview: { version: AUDITION_REREVIEW_VERSION, attempt: re.attempt } } : original;
  };
  const firstParent = calibrationRequalificationParent(effective(first.page), saved), secondParent = effective(second.page);
  const transition = { version: AT.version, pages: [
    { page: first.page, action: 'requalify' as const, priorSha256: previewSha(canonicalJson(firstParent)), consumedAttemptsBefore: first.consumedAttemptsBefore },
    { page: second.page, action: 'correct_once' as const, priorSha256: previewSha(canonicalJson(secondParent)), consumedAttemptsBefore: secondParent.attempts.length }] };
  const contract: AuditionTopologyContinuation = { ...transition, parentCalibration };
  let preview: { step: string; candidate: AuditionImage; context: any; contextSha: string; refs: AuditionImage[]; predecessor: AuditionImage | null } | undefined;
  try {
    await illustrateReviewedAudition({ ...engineArgs, topologyContinuation: contract, landmarkTopology: LANDMARK_TOPOLOGY_VERSION,
      save: () => refuse(), judge: async (step, candidate, context, contextSha, refs, predecessor) => {
        preview = { step, candidate, context, contextSha, refs, predecessor }; throw new ReviewedAuditionError('fresh_book_topology_preview_complete'); },
      check: () => { same(); if (preview) fail('fresh_book_topology_preview_complete'); } });
  } catch (e) { if (!preview || codeOf(e, '') !== 'fresh_book_topology_preview_complete') throw e; }
  if (!preview) return refuse();
  const payload = await auditionJudgePayload({ candidate: preview.candidate, candidateBytes: bytesOf(preview.candidate),
    context: preview.context, contextSha: preview.contextSha, refs: preview.refs.map(bytesOf),
    predecessor: preview.predecessor ? bytesOf(preview.predecessor) : null, kind: 'page' });
  same();
  const firstReview = { step: preview.step, contextSha256: preview.contextSha, wireDigest: previewSha(canonicalJson(digestImages(payload))) };
  const used = ledger.stages.find(s => s.name === 'audition')!.calls;
  const allowance = { firstSampleRenders: 0 as const, extraSecondSampleRenders: 1 as const, ordinaryPageAttempts: 3 as const,
    maxNewCalls: grant.maxCalls - used };
  if (allowance.maxNewCalls < 26) fail('fresh_book_topology_calls');
  const plan = { version: AT.version, cycle: FRESH_BOOK_CYCLE.id, contract: LANDMARK_TOPOLOGY_VERSION, ownerApproval: approval,
    profileSha256: base.plan.profileSha256, bookDir: path.resolve(config.bookDir),
    parent: { grantFile: path.resolve(parentGrantFile), grantSha256: previewSha(parentBytes),
      claimSha256: roots[`authority/${AK.claimName}`], outcomeSha256: roots[`authority/${AK.outcomeName}`] },
    auditionFolderSha256: previewSha(canonicalJson(auditionFiles)), rootsSha256: previewSha(canonicalJson(roots)),
    transition, firstReview, allowance, debits: parent.debits, ledger,
    ceiling: 'ONE requalification of same first candidate (0 images); only on PASS ONE LOW second-sample correction at carried index3/fourth render; fresh v12 quality+identity for both, then same cover/pages3-8 ordinary3attempts. No retries/resume of this line; held sheets diagnostic.',
    callLimit: 'Original cumulative89 meter unchanged: nominal26 newcalls fit; theoretical all-frame retries68 exceed remaining64 and are NOT guaranteed/expanded. Every claim keeps original reservation and budget/unknown guards.',
    providerCalls: 0, keyRead: false };
  const { ceiling: _c, callLimit: _limit, providerCalls: _calls, keyRead: _key, ...bound } = plan;
  const grantDraft = freshBookAuditionTopologyGrantSchema.parse({ ...bound, version: 'fresh-book-audition-topology-grant/v1',
    engine: { head: engine.head, branch: engine.branch }, pins, nativePlanSha256: previewSha(canonicalJson(plan)) });
  return { plan, grantDraft, state: { engine, claimExists: existsSync(at(AT.claimName)), outcomeExists: existsSync(at(AT.outcomeName)) },
    roots, auditionFiles, base, parent, re, cont, contract, immutableFiles };
}

export async function runFreshBookAuditionTopology(a: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string;
  signal: AbortSignal; log: (line: string) => void }) {
  const bytes = fileBytes(a.grantFile), refuse = (): never => fail('fresh_book_topology_grant');
  if (previewSha(bytes) !== a.grantSha) refuse();
  const g = freshBookAuditionTopologyGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  const p = await planFreshBookAuditionTopology(a.config, a.env, g.parent.grantFile, g.ownerApproval.file);
  if (canonicalJson(g) !== canonicalJson(p.grantDraft)) refuse();
  const at = (name: string) => path.join(a.env.authorityRoot, name), dir = path.join(a.config.bookDir, 'audition');
  const same = () => {
    if (a.signal.aborted) fail('fresh_book_cancelled');
    const e = a.env.head();
    if (!e.clean || e.head !== g.engine.head || e.branch !== g.engine.branch) fail('fresh_book_source_changed');
    for (const [rel, sha] of Object.entries(g.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== sha) fail('fresh_book_source_changed');
    for (const [f, sha] of [[a.grantFile, a.grantSha], ...p.immutableFiles]) if (previewSha(fileBytes(f)) !== sha) refuse();
    if (canonicalJson(topologyRoots(a.config, a.env, p.base.rereview)) !== canonicalJson(p.roots)) fail('fresh_book_roots_changed');
    for (const [rel, sha] of Object.entries(p.auditionFiles)) if (previewSha(fileBytes(path.join(dir, rel))) !== sha) fail('fresh_book_topology_parent');
  };
  same();
  if (p.state.claimExists || p.state.outcomeExists || existsSync(at(AT.claimName)) || existsSync(at(AT.outcomeName))) fail('fresh_book_topology_used');
  exclusiveJson(at(AT.claimName), { cycle: FRESH_BOOK_CYCLE.id, version: AT.version, grantSha256: a.grantSha, parent: g.parent,
    ownerApproval: g.ownerApproval, engine: g.engine, bookDir: g.bookDir, transition: g.transition, allowance: g.allowance });
  const claimSha256 = previewSha(fileBytes(at(AT.claimName)));
  const guard = () => { same(); if (previewSha(fileBytes(at(AT.claimName))) !== claimSha256 || existsSync(at(AT.outcomeName))) fail('fresh_book_topology_used'); };
  try {
    const result = await runReviewedAudition({ bookDir: a.config.bookDir, out: dir, keyFile: a.config.keyEnvFile,
      grantFile: path.join(a.config.bookDir, 'audition.grant.json'), signal: a.signal, log: a.log, resume: true, debits: g.debits,
      layout: readReviewedBookLayout(path.join(a.config.bookDir, 'book-layout.json')),
      topologyContinuation: { grantSha256: a.grantSha, contract: p.contract, firstReview: g.firstReview },
      experiment: { slot: FRESH_BOOK_AUDITION_SLOT, claimSha256: p.cont.fresh.claimSha256, guard } });
    if (result.mode !== 'render') return fail('fresh_book_audition_mode');
    const gate = (s: unknown): PageGate['disposition'] => s === 'qa_supported' ? 'passed' : 'held_uncertain';
    const cover = result.manifest.pages.find(x => x.pageNumber === 0), reading = freshBookReadingOrder(cover ? gate(cover.status) : null,
      result.manifest.pages.filter(x => x.pageNumber > 0).map(x => ({ page: x.pageNumber, disposition: gate(x.status) })));
    const status = result.manifest.status === 'held_sample' ? 'held_sample' : reading.status === 'complete' &&
      result.manifest.status !== 'qa_supported_audition' ? 'partial' : reading.status;
    const ledger = freshBookLedger(a.config, a.env, p.base.rereview, 'child_fresh_anchor', g.debits);
    exclusiveJson(path.join(a.config.bookDir, 'book-status-topology.json'), { status, manifestStatus: result.manifest.status,
      order: reading.order, ledger, grantSha256: a.grantSha, runtimeEligible: false });
    finish(a.env, status, { manifestStatus: result.manifest.status, ledger }, AT.outcomeName);
    return { status, manifestStatus: result.manifest.status, order: reading.order, ledger };
  } catch (e) {
    if (!existsSync(at(AT.outcomeName))) finish(a.env, 'failed_audition_topology', { code: codeOf(e, 'fresh_book_topology_failed') }, AT.outcomeName);
    throw e;
  }
}

async function freshAuditionGrant(config: FreshBookConfig, env: FreshBookEnv, rereview: RereviewConfig, profile: FreshBookProfile, line: Line = ORIGINAL_LINE,
  recovered?: ChildRecoveryHeld): Promise<AuditionGrant> {
  const layout = readReviewedBookLayout(path.join(config.bookDir, 'book-layout.json'));
  if (canonicalJson(layout) !== canonicalJson(lineLayout(profile, layout.childImage, line))) fail('fresh_book_layout');
  const loaded = loadReviewedBook(config.bookDir, workspace(), undefined, layout);
  // The child recovery's adopted child is the recovered one (its held parent and typed recovery re-derived by the admission); the fresh anchor's
  // is the general child stage's under pose v2 in its own folder; any other line's is `child`.
  if (line.kind === 'child_recovery') await assertRecoveredChildSettled(config.bookDir, recovered ?? fail('fresh_book_child_recovery_grant'),
    json(path.join(config.bookDir, CR.folder, 'reference_child_adoption.json')), loaded.childBytes);
  else if (line.kind === 'child_fresh_anchor') await assertInspectedChildSettled(config.bookDir, anchorAuthority(profile, loaded.book.plan.wardrobe, CHILD_ANCHOR_POSE_V2),
    json(path.join(config.bookDir, CF.folder, 'reference_child_adoption.json')), loaded.childBytes, FRESH_ANCHOR_STAGE);
  else await assertInspectedChildSettled(config.bookDir, anchorAuthority(profile, loaded.book.plan.wardrobe), json(path.join(config.bookDir, 'child', 'reference_child_adoption.json')),
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
    // The continuation and revalidation lines carry the engine's page recovery rule (diagnosis after two held attempts, same three-attempt ceiling).
    scope: { mode: 'render', pages: [0, 1, 2, 3, 4, 5, 6, 7, 8], sample: earliestSameScenePair(loaded.book),
      ...(line.kind === 'storyboard_continuation' || line.kind === 'storyboard_revalidation' || line.kind === 'storyboard_extension'
        || line.kind === 'storyboard_extension_revalidation' || line.kind === 'storyboard_calibration' || line.kind === 'storyboard_presence'
        || line.kind === 'child_recovery' || line.kind === 'child_fresh_anchor' ? { recovery: STAGE_RECOVERY_VERSION } : {}) },
    claudeMax: 'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger',
    experiment: { slot: FRESH_BOOK_AUDITION_SLOT, claimSha256 } });
}

export async function runFreshBookBook(args: { config: FreshBookConfig; env: FreshBookEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void; resume?: true; recovery?: true; storyboardRepair?: true; storyboardContinuation?: true; storyboardRevalidation?: true;
  storyboardExtension?: true; storyboardExtensionRevalidation?: true; storyboardCalibration?: true; storyboardPresence?: true; childRecovery?: true;
  childFreshAnchor?: true }) {
  const { config, env } = args, line = lineOf(args.recovery, args.storyboardRepair, args.storyboardContinuation, args.storyboardRevalidation,
    args.storyboardExtension, args.storyboardExtensionRevalidation, args.storyboardCalibration, args.storyboardPresence, args.childRecovery, args.childFreshAnchor);
  // The audition grant is pinned too (absent on a start, its bytes on a resume); the start record is part of the authority roots.
  const earlier = ['request.json', 'admission.json', 'text', 'child', 'book-layout.json', 'audition.grant.json'];
  const admitted = await admitLine(args, line, earlier);
  admitted.guard();
  if (!(await linePassed(args, line, admitted)) || sealedStatus(path.join(config.bookDir, childDirOf(line))) !== 'child_reference_passed' ||
      existsSync(path.join(env.authorityRoot, line.outcomeName))) fail('fresh_book_stage_not_passed');
  const grant = await freshAuditionGrant(config, env, admitted.planned.rereview, admitted.planned.profile, line,
    'childRecovery' in admitted ? admitted.childRecovery : undefined);
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
  const stage = ['audition-topology-plan', 'audition-topology', 'audition-calibration-plan', 'audition-calibration', 'audition-rereview-plan', 'audition-rereview', 'audition-continuation-plan', 'audition-continuation', 'child-fresh-anchor-plan', 'child-fresh-anchor',
    'child-recovery-plan', 'child-recovery',
    'storyboard-presence-preview', 'storyboard-presence-plan', 'storyboard-presence',
    'storyboard-calibration-preview', 'storyboard-calibration-plan', 'storyboard-calibration',
    'storyboard-extension-revalidation-preview', 'storyboard-extension-revalidation-plan', 'storyboard-extension-revalidation',
    'storyboard-extension-preview', 'storyboard-extension-plan', 'storyboard-extension', 'storyboard-revalidation-preview',
    'storyboard-revalidation-plan', 'storyboard-revalidation', 'storyboard-continuation-preview', 'storyboard-continuation-plan', 'storyboard-continuation',
    'storyboard-repair-preview', 'storyboard-repair-plan', 'storyboard-repair', 'recovery-plan', 'recover', 'plan', 'text', 'child', 'book']
    .find(s => process.argv.includes(s)) ?? 'plan';
  const execute = process.argv.includes('--execute');
  // A downstream stage runs under exactly one line: two line flags at once are refused (never a silent preference).
  if (['--recovery', '--storyboard-repair', '--storyboard-continuation', '--storyboard-revalidation', '--storyboard-extension', '--storyboard-extension-revalidation',
    '--storyboard-calibration', '--storyboard-presence', '--child-recovery', '--child-fresh-anchor'].filter(f => process.argv.includes(f)).length > 1) fail('fresh_book_arguments');
  // The child recovery and the fresh anchor replace the child stage of their line: only their book stage runs under the flag.
  if ((process.argv.includes('--child-recovery') || process.argv.includes('--child-fresh-anchor')) && stage !== 'book') fail('fresh_book_arguments');
  const line = process.argv.includes('--child-fresh-anchor') ? { childFreshAnchor: true as const }
    : process.argv.includes('--child-recovery') ? { childRecovery: true as const }
    : process.argv.includes('--storyboard-presence') ? { storyboardPresence: true as const }
    : process.argv.includes('--storyboard-calibration') ? { storyboardCalibration: true as const }
    : process.argv.includes('--storyboard-extension-revalidation') ? { storyboardExtensionRevalidation: true as const }
    : process.argv.includes('--storyboard-extension') ? { storyboardExtension: true as const }
    : process.argv.includes('--storyboard-revalidation') ? { storyboardRevalidation: true as const }
    : process.argv.includes('--storyboard-continuation') ? { storyboardContinuation: true as const }
    : process.argv.includes('--storyboard-repair') ? { storyboardRepair: true as const } : process.argv.includes('--recovery') ? { recovery: true as const } : {};
  const done = (p: Promise<unknown>) => p.then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
  // The audition continuation and the audition re-review take no line flag: each is its own stage on the audition it follows.
  if ((stage === 'audition-continuation' || stage === 'audition-rereview' || stage === 'audition-calibration' || stage === 'audition-topology' || stage === 'audition-topology-plan') && ['--recovery', '--storyboard-repair', '--storyboard-continuation',
    '--storyboard-revalidation', '--storyboard-extension', '--storyboard-extension-revalidation', '--storyboard-calibration', '--storyboard-presence',
    '--child-recovery', '--child-fresh-anchor', '--resume'].some(f => process.argv.includes(f))) fail('fresh_book_arguments');
  // The audition re-review (dry): the consumed continuation and the audition it left re-derived, its two unknown-cost calls and their debits,
  // the ONE re-review (the saved page, its never-judged drawn attempt, the lost request and the new step), the ledger with both debits and the
  // grant draft (--continuation-grant: the consumed continuation grant file; --owner-approval: the owner's record). No key, provider, claim or write.
  if (stage === 'audition-topology-plan' || (stage === 'audition-topology' && !execute)) done(Promise.resolve().then(async () => {
    const { plan, grantDraft, state } = await planFreshBookAuditionTopology(config, env, argValue('--calibration-grant') ?? fail('fresh_book_arguments'),
      argValue('--owner-approval') ?? fail('fresh_book_arguments')); return { plan, grantDraft, state }; }))
  else if (stage === 'audition-calibration-plan' || (stage === 'audition-calibration' && !execute)) done(Promise.resolve().then(async () => {
    const { plan, grantDraft, state } = await planFreshBookAuditionCalibration(config, env, argValue('--rereview-grant') ?? fail('fresh_book_arguments'),
      argValue('--owner-approval') ?? fail('fresh_book_arguments')); return { plan, grantDraft, state }; }))
  else if (stage === 'audition-rereview-plan' || (stage === 'audition-rereview' && !execute)) done(Promise.resolve().then(async () => {
    const { plan, grantDraft, state } = await planFreshBookAuditionRereview(config, env, argValue('--continuation-grant') ?? fail('fresh_book_arguments'),
      argValue('--owner-approval') ?? fail('fresh_book_arguments'));
    return { plan, grantDraft, state }; }));
  // The audition continuation (dry): the fresh-anchor line, the fresh child's successor and the halted audition re-derived, its ONE unknown-cost
  // call and that call's conservative debit, the closed attempts a resume keeps, the ledger with that debit and the grant draft
  // (--fresh-grant: the consumed fresh-anchor grant file; --owner-approval: the owner's record). No key, provider, model, claim or write.
  else if (stage === 'audition-continuation-plan' || (stage === 'audition-continuation' && !execute)) done(Promise.resolve().then(async () => {
    const { plan, grantDraft, state } = await planFreshBookAuditionContinuation(config, env, argValue('--fresh-grant') ?? fail('fresh_book_arguments'),
      argValue('--owner-approval') ?? fail('fresh_book_arguments'));
    return { plan, grantDraft, state }; }));
  // The fresh anchor (dry): the presence chain, its admitted storyboard, the held child and the recovery's terminal hold re-derived, the fresh
  // anchor the general child stage plans under pose v2 (its full prompt as the real image seam plans it, its claim maximum and bound context),
  // the stage's worst-case reservation and the grant draft (--recovery-grant: the consumed child-recovery grant file; --owner-approval: the
  // owner's record). No key, provider, model, claim or write.
  else if (stage === 'child-fresh-anchor-plan' || (stage === 'child-fresh-anchor' && !execute)) done(Promise.resolve().then(async () => {
    const { plan, grantDraft, state, held } = await planFreshBookChildFreshAnchor(config, env, argValue('--recovery-grant') ?? fail('fresh_book_arguments'),
      argValue('--owner-approval') ?? fail('fresh_book_arguments'));
    const render = assertChildAnchorRenderPlan(held.anchor.request.prompt, held.anchor.technique.length, held.anchor.request.referenceMode);
    return { plan, grantDraft, state, fresh: { finalPrompt: render.finalPrompt, finalPromptChars: render.finalPrompt.length, context: held.anchor.context } }; }));
  // The child recovery (dry): the presence chain, its admitted storyboard and the held child re-derived, the engine's typed recovery, the one
  // correction it plans (its full prompt as the real image seam plans it, its claim maximum, recipe and bound pose context) and the grant draft
  // (--presence-grant: the consumed presence grant file; --owner-approval: the owner's record). No key, provider, model, claim or write.
  else if (stage === 'child-recovery-plan' || (stage === 'child-recovery' && !execute)) done(Promise.resolve().then(async () => {
    const { plan, grantDraft, state, held } = await planFreshBookChildRecovery(config, env, argValue('--presence-grant') ?? fail('fresh_book_arguments'),
      argValue('--owner-approval') ?? fail('fresh_book_arguments'));
    return { plan, grantDraft, state, correction: { finalPrompt: held.correction.finalPrompt, finalPromptChars: held.correction.finalPrompt.length,
      recipe: held.correction.recipe, context: held.rec.context } }; }));
  // The presence line (dry): the planner request it would send under the presence contract with the engine's recovery state, diagnosis,
  // finding groups and repeated references, rebuilt offline and measured on its compacted wire; and its plan and grant draft
  // (--calibration-grant: the consumed calibration grant file; --owner-approval: the owner's record). No key, provider, model, claim or write.
  else if (stage === 'storyboard-presence-preview') done(Promise.resolve().then(async () => {
    const { grantDraft, input, recoveryRecord, diagnosisRecord } = await planFreshBookStoryboardPresence(config, env,
      argValue('--calibration-grant') ?? fail('fresh_book_arguments'), argValue('--owner-approval') ?? fail('fresh_book_arguments'));
    return { held: grantDraft.held, recovery: grantDraft.recovery, ledger: grantDraft.ledger, recoveryRecord, diagnosisRecord,
      preview: await previewFreshBookStoryboardPresence(config, input) }; }));
  else if (stage === 'storyboard-presence-plan' || (stage === 'storyboard-presence' && !execute)) done(Promise.resolve().then(async () => {
    const { plan, grantDraft, state } = await planFreshBookStoryboardPresence(config, env, argValue('--calibration-grant') ?? fail('fresh_book_arguments'),
      argValue('--owner-approval') ?? fail('fresh_book_arguments'));
    return { plan, grantDraft, state }; }));
  // The calibration line (dry): the planner request it would send under the calibration with the engine's recovery state, diagnosis and finding
  // groups, rebuilt offline and measured on its compacted wire; and its plan and grant draft (--extension-revalidation-grant: the consumed
  // extension-revalidation grant file; --owner-approval: the owner's approval record). No key, provider, model, claim or write.
  else if (stage === 'storyboard-calibration-preview') done(Promise.resolve().then(async () => {
    const { grantDraft, input, recoveryRecord, diagnosisRecord } = await planFreshBookStoryboardCalibration(config, env,
      argValue('--extension-revalidation-grant') ?? fail('fresh_book_arguments'), argValue('--owner-approval') ?? fail('fresh_book_arguments'));
    return { held: grantDraft.held, recovery: grantDraft.recovery, ledger: grantDraft.ledger, recoveryRecord, diagnosisRecord,
      preview: await previewFreshBookStoryboardCalibration(config, input) }; }));
  else if (stage === 'storyboard-calibration-plan' || (stage === 'storyboard-calibration' && !execute)) done(Promise.resolve().then(async () => {
    const { plan, grantDraft, state } = await planFreshBookStoryboardCalibration(config, env, argValue('--extension-revalidation-grant') ?? fail('fresh_book_arguments'),
      argValue('--owner-approval') ?? fail('fresh_book_arguments'));
    return { plan, grantDraft, state }; }));
  // The extension revalidation line (dry): the review request it would send for the extension's paid answer under both corrections, rebuilt
  // offline and measured; and its plan and grant draft (--extension-grant: the consumed extension grant file). No key, provider, model, claim or write.
  else if (stage === 'storyboard-extension-revalidation-preview') done(Promise.resolve().then(async () => {
    const { grantDraft, input } = await planFreshBookStoryboardExtensionRevalidation(config, env, argValue('--extension-grant') ?? fail('fresh_book_arguments'));
    return { extension: grantDraft.extension, candidate: grantDraft.candidate, recovery: grantDraft.recovery, ledger: grantDraft.ledger,
      preview: await previewFreshBookStoryboardExtensionRevalidation(config, input) }; }));
  else if (stage === 'storyboard-extension-revalidation-plan' || (stage === 'storyboard-extension-revalidation' && !execute))
    done(Promise.resolve().then(async () => {
      const { plan, grantDraft, state } = await planFreshBookStoryboardExtensionRevalidation(config, env, argValue('--extension-grant') ?? fail('fresh_book_arguments'));
      return { plan, grantDraft, state }; }));
  // The owner-approved extension line (dry): the planner request it would send under the claim basis with the engine's recovery state and
  // diagnosis, rebuilt offline and measured; and its plan and grant draft (--revalidation-grant: the consumed revalidation grant file;
  // --owner-approval: the owner's approval record). No key, provider, model, claim or write.
  else if (stage === 'storyboard-extension-preview') done(Promise.resolve().then(async () => {
    const { grantDraft, input, recoveryRecord, diagnosisRecord } = await planFreshBookStoryboardExtension(config, env,
      argValue('--revalidation-grant') ?? fail('fresh_book_arguments'), argValue('--owner-approval') ?? fail('fresh_book_arguments'));
    return { held: grantDraft.held, recovery: grantDraft.recovery, ledger: grantDraft.ledger, recoveryRecord, diagnosisRecord,
      preview: await previewFreshBookStoryboardExtension(config, input) }; }));
  else if (stage === 'storyboard-extension-plan' || (stage === 'storyboard-extension' && !execute)) done(Promise.resolve().then(async () => {
    const { plan, grantDraft, state } = await planFreshBookStoryboardExtension(config, env, argValue('--revalidation-grant') ?? fail('fresh_book_arguments'),
      argValue('--owner-approval') ?? fail('fresh_book_arguments'));
    return { plan, grantDraft, state }; }));
  // The revalidation line (dry): the review request it would send for the continuation's paid answer under the correction, rebuilt offline and
  // measured; and its plan and grant draft (--continuation-grant: the consumed continuation grant file). No key, provider, model, claim or write.
  else if (stage === 'storyboard-revalidation-preview') done(Promise.resolve().then(async () => {
    const { grantDraft, input } = await planFreshBookStoryboardRevalidation(config, env, argValue('--continuation-grant') ?? fail('fresh_book_arguments'));
    return { continuation: grantDraft.continuation, candidate: grantDraft.candidate, recovery: grantDraft.recovery, ledger: grantDraft.ledger,
      preview: await previewFreshBookStoryboardRevalidation(config, input) }; }));
  else if (stage === 'storyboard-revalidation-plan' || (stage === 'storyboard-revalidation' && !execute)) done(Promise.resolve().then(async () => {
    const { plan, grantDraft, state } = await planFreshBookStoryboardRevalidation(config, env, argValue('--continuation-grant') ?? fail('fresh_book_arguments'));
    return { plan, grantDraft, state }; }));
  // The diagnosed continuation line (dry): the planner request it would send with the engine's recovery state and diagnosis, rebuilt offline
  // and measured; and its plan and grant draft (--repair-grant: the consumed repair grant file). No key, provider, model, claim or write.
  else if (stage === 'storyboard-continuation-preview') done(Promise.resolve().then(async () => {
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
    done(stage === 'audition-topology' ? runFreshBookAuditionTopology(common) : stage === 'audition-calibration' ? runFreshBookAuditionCalibration(common) : stage === 'audition-rereview' ? runFreshBookAuditionRereview(common) : stage === 'audition-continuation' ? runFreshBookAuditionContinuation(common)
      : stage === 'child-fresh-anchor' ? runFreshBookChildFreshAnchor(common) : stage === 'child-recovery' ? runFreshBookChildRecovery(common)
      : stage === 'storyboard-presence' ? runFreshBookStoryboardPresence(common)
      : stage === 'storyboard-calibration' ? runFreshBookStoryboardCalibration(common)
      : stage === 'storyboard-extension-revalidation' ? runFreshBookStoryboardExtensionRevalidation(common)
      : stage === 'storyboard-extension' ? runFreshBookStoryboardExtension(common)
      : stage === 'storyboard-revalidation' ? runFreshBookStoryboardRevalidation(common)
      : stage === 'storyboard-continuation' ? runFreshBookStoryboardContinuation(common)
      : stage === 'storyboard-repair' ? runFreshBookStoryboardRepair(common) : stage === 'recover' ? runFreshBookTextRecovery(common)
      : stage === 'text' ? runFreshBookText(common) : stage === 'child' ? runFreshBookChild({ ...common,
        ...('childRecovery' in line || 'childFreshAnchor' in line ? fail('fresh_book_arguments') : line) })
      : runFreshBookBook({ ...common, ...line, ...(process.argv.includes('--resume') ? { resume: true as const } : {}) }));
  }
}
export type { ChildAnchorInspectionContext };
