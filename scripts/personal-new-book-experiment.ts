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
 *   storyboard-continuation-2 - Guy's second, separately approved attempt after that continuation's answer was refused by the scene/location
 *     sequence check: the same story replayed, the same storyboard request with exactly one change (the scene-location instruction
 *     contract), then its review, under a second recorded amendment, in the same $7.
 *   storyboard-continuation-3 - Guy's third, separately approved attempt after the second one's answer was refused at an undeclared page prop:
 *     the same request plus one more instruction contract (every audited compiler rule stated), under a third amendment, in the same $7.
 *   carry-resolution - Guy's resolution of the carried reservation (no provider): the timed-out call's actual charge, derived from his own
 *     usage-dashboard totals for that day and model minus this book's own calls that day, replaces its full reservation from the repair on.
 *   storyboard-repair - Guy's one approved repair after the third attempt's storyboard review held it: the same story replayed, the third
 *     request plus the repair contract (the held storyboard and its review's own unsupported checks), then a fresh review, under a fourth
 *     amendment, only when its reservation and its review's ceiling fit the remaining allowance of the same $7.
 *   scale-comparison - Guy's one scale comparison after the audition was held at its sample gate (relative scale): the opt-in common-scale
 *     lineup on a new entities sheet, the held locations sheet reused as judged, and each held sample page drawn once, under an amendment
 *     that binds the held audition, in the same $7 with the carry kept. Started once; --resume continues the same ledger.
 * Dry by default; nothing is retried; every paid call is journaled before dispatch.
 *   node --require ./scripts/shims/register-server-only.cjs --import tsx scripts/personal-new-book-experiment.ts \
 *     --config <abs config.json> <plan|text|storyboard-continuation|storyboard-continuation-2|storyboard-continuation-3|storyboard-repair|storyboard-repair-2|
 *       storyboard-acceptance|child|grant|audition|scale-comparison> [--execute [--resume]]
 *   ... --config <abs config.json> carry-resolution --attestation <abs attestation.json> [--execute]
 * Not production, customer, wizard or release authority. Every artifact is runtime-ineligible; acceptance is Guy's.
 */
import path from 'node:path';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { z } from 'zod';
import { gitAt } from './personal-source-git';
import { exclusiveJson, exclusiveText, fencedText, realDirectory } from './personal-causal-trial-journal';
import { CAUSAL_MODELS, createAstraCausalTransport, createOpusCausalTransport, prepareCausalWire, wireReservation, type CausalWire, type TransportReply,
  type WirePolicy, type Rates } from './personal-causal-trial-adapters';
import type { CausalDispatch } from '../lib/personal-wizard/story-causal-experiment-runner';
import { safeUsage } from './personal-story-trial-guard';
import { longCallFetch, providerFailureCause, type LongCallObserver } from './personal-long-call-fetch';
import { simpleWizardVisualPayload } from './personal-simple-wizard-worker';
import { createSimpleBookPixelJudge } from './personal-simple-book-illustrator';
import { AuditionMeter, auditionAdapters, keyReader, loadReviewedBook, loadReviewedStoryboard, reviewedChildDesign, reviewedBookLayoutSchema,
  readReviewedBookLayout, runReviewedAudition, verifyMeterRecords, digestImages, auditionRenderRule, auditionReviewRule, auditionMeterRules, readReusedSheets, derivedSheetContexts,
  STORYBOARD_REPAIR_INPUT_FILE, type AuditionGrant,
  type ReviewedBookLayout, type MeterRule, type MeterRules, STORYBOARD_OWNER_ACCEPTANCE_FILE, savedMomentContract, savedLandmarkKindContract,
  savedSceneLocationContract, savedCompilerRulesContract, savedDrawnInstantContract } from './personal-simple-book-reviewed-audition';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, storyboardReviewDisposition, storyboardOwnerAcceptance } from '../lib/personal-wizard/storyboard';
import { STORYBOARD_OWNER_ACCEPTANCE_VERSION, type StoryboardOwnerAcceptance } from '../lib/personal-wizard/storyboard-owner-acceptance';
import { resolvePersonalWizardOptions } from '../lib/personal-wizard/options';
import { prepareSimpleStory } from '../lib/personal-wizard/simple-story-engine';
import { runSimpleWizardBook } from '../lib/personal-wizard/simple-book-flow';
import { SimpleBookBudget } from '../lib/personal-wizard/simple-book-budget';
import { decodePersonalBookProviderOutput } from '../lib/personal-wizard/book-openai';
import type { SimpleStoryboardDiagnosticCall } from '../lib/personal-wizard/simple-storyboard-diagnostic';
import { generationTimeoutMs } from '../lib/personal-wizard/story-config';
import { simpleChildReferencePrompt, simpleReferenceDesignContext, REFERENCE_REPAIR_EDIT_INSTRUCTION, type AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';
import { qualityDisposition } from '../lib/local-preview-quality';
import { previewSha, previewStoryEvidence, previewTextPages } from '../lib/local-story-preview';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import type { PersonalStoryboard } from '../lib/personal-wizard/storyboard';
import { SCENE_LOCATION_STORYBOARD_ADDENDUM } from '../lib/personal-wizard/storyboard-scene-location';
import { COMPILER_RULES_STORYBOARD_ADDENDUM } from '../lib/personal-wizard/storyboard-compiler-rules';
import { REPAIR_STORYBOARD_ADDENDUM, STORYBOARD_REPAIR_VERSION, storyboardRepairFindings, type StoryboardRepair } from '../lib/personal-wizard/storyboard-repair';
import { DRAWN_INSTANT_STORYBOARD_ADDENDUM, drawnInstantGaps, drawnInstantFinding } from '../lib/personal-wizard/storyboard-drawn-instant';
import { BOOK_LIMITS, personalBookOutputLimits } from '../lib/personal-wizard/book-config';
import { OPUS_PLANNER, createOpusStoryboardTransport, plannerRequest, prepareOpusStoryboardWire, type PlannerWire } from './personal-opus-storyboard-transport';
import { AUDITION_WORST_CASE_CALLS, AUDITION_SCALE_LINEUP_VERSION, REVIEWED_AUDITION_POLICY, auditionSheetDesigns }
  from '../lib/personal-wizard/simple-book-reviewed-audition';
import { CHILD_ANCHOR_STYLE_VERSION, CHILD_ANCHOR_TECHNIQUE_MANIFEST, CHILD_ANCHOR_MANIFEST_SHA256, CHILD_ANCHOR_CORRECTION_ROLES, resolveChildAnchorTechnique,
  childAnchorDescriptionRequest, childAnchorCorrectionPrompt, assertChildAnchorRenderPlan, childAnchorAttemptRecipe, childAnchorRecipeSha,
  childAnchorStyleDisposition, childAnchorDesignDisposition, childAnchorDisposition, assertChildAnchorAccepted, childAnchorAdoptionRecord,
  childAnchorStylePayload, childAnchorDesignPayload, type ChildAnchorRecipe }
  from '../lib/personal-wizard/child-anchor-style';
import { childAnchorJudges, type ChildAnchorStyleJudge, type ChildAnchorDesignJudge } from './personal-child-anchor-judges';
import { readAuditionImage, SOL_PIXEL_REVIEW_SLOT_MICRO_USD } from './personal-simple-book-illustrator';
import type { BookDesignReferenceRole } from '../lib/generate-image';

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
 * Guy's one approved continuation of THIS book (2026-10-13): the storyboard call timed out (most likely Node's default 300 s header wait,
 * below the call's own deadline; the saved error carries no native cause). The story already paid for is reused exactly; only the storyboard and its review are called again; the timed-out
 * call's cost stays unknown and is carried in full as an unresolved reservation inside the same $7 cap. Once only.
 */
export const NEW_BOOK_CONTINUATION = Object.freeze({
  id: 'storyboard-continuation-1',
  outDir: 'text-continuation-1',
  approval: 'Guy 2026-10-13, AskUserQuestion after the storyboard timeout: "Approve fix + one retry" (offline transport fix, Codex QA, then one storyboard attempt and its review, then onward through the book within the same $7) and "Count the full $2.27" (the timed-out storyboard stays an unresolved reservation under the cap, not known spend).',
});
/**
 * Guy's second, separately approved attempt of THIS book's storyboard (2026-10-13): the first continuation's storyboard answered, but its
 * answer was refused by the scene/location sequence check (page 2 kept page 1's scene while the planned place changed). The same story is
 * replayed and the storyboard is requested ONCE more with exactly one change, the opt-in scene-location instruction contract (a general
 * engine rule), then its review. The first continuation's known cost is prior spend; the first call's unknown cost stays carried. Once only.
 */
export const NEW_BOOK_CONTINUATION_2 = Object.freeze({
  id: 'storyboard-continuation-2',
  outDir: 'text-continuation-2',
  approval: 'Guy 2026-10-13, AskUserQuestion after the first continuation\'s storyboard was refused (book_sequence_scene_location_drift at page 2): "Fix rule + 1 attempt, $7" (an offline, general fix to the storyboard instructions - a scene changes exactly when the place changes - then Codex QA, then one new storyboard attempt for this same book under the same $7).',
  contracts: Object.freeze({ ...NEW_BOOK_EXPERIMENT.contracts, sceneLocationContract: true as const }),
});
/**
 * Guy's third, separately approved attempt (2026-10-14): the second attempt's storyboard answered and its scenes followed the planned places,
 * but the answer was refused by the plan check (page 7 listed a prop, enclosure_gate, it never declared). An audit found that rule and others
 * the compiler enforces but the instructions never stated; the same story is replayed and the second request is sent ONCE more with exactly one
 * change, the opt-in compiler-rules instruction contract (every audited rule stated), then its review. Once only, under the same $7.
 */
export const NEW_BOOK_CONTINUATION_3 = Object.freeze({
  id: 'storyboard-continuation-3',
  outDir: 'text-continuation-3',
  approval: 'Guy 2026-10-14, AskUserQuestion after the second attempt\'s storyboard was refused (unknown_or_duplicate_prop: an undeclared page-7 prop): "Audit all rules + 1 attempt" (an offline, general audit of every storyboard compiler rule against the instructions, each missing rule stated, then Codex QA, then one new storyboard attempt for this same book) and "Keep $7, decide after samples".',
  contracts: Object.freeze({ ...NEW_BOOK_CONTINUATION_2.contracts, compilerRulesContract: true as const }),
});
/**
 * Guy's one approved repair (2026-10-15): the third attempt's storyboard compiled, but its independent review held it (held_uncertain). The
 * same story is replayed and the third request is sent ONCE more with exactly the repair contract added (the held storyboard and its review's
 * own unsupported checks, derived by the engine, never chosen), at the normal caps; the same compiler and a fresh review judge the result as a
 * new storyboard. Only when its reservation and its review's ceiling fit the remaining allowance of the same $7. Once only.
 */
export const NEW_BOOK_STORYBOARD_REPAIR = Object.freeze({
  id: 'storyboard-repair-1',
  outDir: 'text-repair-1',
  approval: 'Guy 2026-10-15, AskUserQuestion after the third attempt\'s storyboard review held it (held_uncertain): "Approve the repair" (a general repair step built offline - the reviewer\'s findings plus the original story go back to the planner, then the same compiler and review gates - and Codex QA; then one paid repair and re-review, only if its exact computed reservation fits the remaining allowance under the same $7 cap, otherwise stop and come back; if the review then passes, the already-approved child -> grant -> two-sample audition continues).',
  contracts: NEW_BOOK_CONTINUATION_3.contracts,
  /**
   * Guy's planner decision for this same one repair (not a second repair or a new allowance): the planner is Claude Opus 5.5 on the
   * restricted Claude Max CLI route (the author/editor hardening and $2 session guard; journaled separately, never an API invoice), and
   * the independent judge stays Sol 6.1 on the API meter. Recorded in the repair amendment.
   */
  planner: Object.freeze({ model: OPUS_PLANNER.model, route: OPUS_PLANNER.route, judge: 'gpt-6.1-sol' as const,
    approval: 'Guy 2026-10-15, in the Codex chat, delivered to Claude Code by Guy in Codex\'s execution brief: "יאללה, תן לקלוד בריף לעבור לאופוס 5.5 לתכנון הסטוריבורד ולהשאיר את Sol 6.1 כשופט. אתה תעשה QA על השינוי, ובוא נתקדם כבר לספר מלא."' }),
});
/**
 * Guy's second, separately approved repair (2026-10-15): the first repair's storyboard compiled, but its fresh review held it
 * (held_contradiction) at drawn instants the moments contract could not fully express (a temporary look of the companion) or did not make
 * complete (a state the page changes after the drawn instant, offscreen). The same story is replayed, the first repair's two answers are
 * replayed to that exact held disposition, and the first repair's request is sent ONCE more with exactly the opt-in drawn-instant contract
 * added (its addendum, its schema, and the compiler's own findings on the held storyboard beside its review's), as a repair of that repair,
 * on the same planner route and judge, under the same $7 with the carry kept. Once only.
 */
export const NEW_BOOK_STORYBOARD_REPAIR_2 = Object.freeze({
  id: 'storyboard-repair-2',
  outDir: 'text-repair-2',
  approval: 'Guy 2026-10-15, AskUserQuestion after the Opus repair\'s fresh Sol review held it (held_contradiction: page 3 flat tail undeclared, page 7 gate state undeclared): "Fix the rule, then 1 repair (Recommended)" (make the drawn-moment rule complete, with a code check so a missed override is caught, Codex QA, then one more Opus repair and Sol review), then on the corrected scope "Confirm and build (Recommended)" (a temporary child/companion look field, the completeness check, a repair of a repair, the second repair stage).',
  contracts: Object.freeze({ ...NEW_BOOK_STORYBOARD_REPAIR.contracts, drawnInstantContract: true as const }),
  addedContracts: Object.freeze(['drawnInstantContract'] as const),
});
/**
 * Guy's acceptance of the second repair's held storyboard with its review's notes (2026-10-15): as product owner he accepts that exact
 * storyboard and every check its fresh review did not support. The record (storyboard-owner-acceptance/v1) binds the compiled book, its
 * review and those findings; later stages use the held storyboard only through it, and every image gate stays as it is. Once only; no call.
 */
export const NEW_BOOK_OWNER_ACCEPTANCE = Object.freeze({
  id: 'storyboard-owner-acceptance-1',
  acceptedBy: 'Guy (owner, product authority)',
  approval: 'Guy 2026-10-15, AskUserQuestion after the second repair\'s fresh Sol review held it (held_uncertain: the herd\'s group wetness on pages 5-6, where the rest of the herd is during page 7\'s push): "Accept with notes (Recommended)" - "You accept this storyboard as product owner despite these 4 notes, recorded and bound to this exact storyboard. Needs a small engine path (the engine refuses held storyboards today) plus Codex QA. Then child reference, grant, two samples; the image checks and the 0.70 likeness bar stay unchanged."',
});
/**
 * Guy's resolution of the carried reservation (2026-10-15): the repair's reservation did not fit beside the timed-out call's full $2.27
 * reservation, so Guy reads that call's actual charge from his own provider usage records. The day's totals for the model, minus this book's
 * own calls that day (each re-derived from its raw answer), are the timed-out call's usage; its charge replaces the carried reservation.
 */
export const NEW_BOOK_CARRY_RESOLUTION = Object.freeze({
  id: 'carry-resolution-1',
  approval: 'Guy 2026-10-15, AskUserQuestion after the repair\'s reservation at the normal output cap did not fit the remaining allowance: "Check the 10/13 charge" (Guy looks up the timed-out call\'s actual cost in his OpenAI usage dashboard (gpt-6-astra, 2026-10-13); a small, Codex-reviewed step records that evidence in place of the $2.27 reservation).',
  /** The timed-out call's day (UTC; the same calls fall on it in Israel time). */
  day: '2026-10-13',
});
/**
 * Guy's one scale comparison of THIS held book (2026-10-16): the audition stopped at its sample gate, mostly on relative scale (Grandma drawn
 * about child-sized, Uri oversized). The opt-in common-scale lineup (audition-scale-lineup/v1) draws a new entities sheet; the held audition's
 * locations sheet is reused exactly as judged there; its two held sample pages are drawn once each, under the same $7 with the carry kept. A
 * diagnostic of the lineup: not a continuation of the audition. Once only.
 */
export const NEW_BOOK_SCALE_COMPARISON = Object.freeze({
  id: 'scale-comparison-1',
  outDir: 'audition-scale-1',
  approval: 'Guy 2026-10-16, AskUserQuestion after the likeness and age probes: "Fix scale first (Recommended)" - "Scale is what stopped the last book at the sample gate (giant too small, fox too big), and a Lavi book could hit the same stop. Milestone 1 is a common-scale lineup on the characters sheet: offline, then Codex QA, then a small comparison (~$0.48) with your approval." Then, during the build: "אל תשאל אותי עוד שאלות.. תענה בעצמך, קבל החלטה פשוט.." (do not ask; decide). Claude decided: one comparison of the held sample pages after Codex PASS, inside the same $7 with the carry kept.',
  /** One attempt per page; the entities sheet keeps the policy's attempts (one in-place repair). */
  pageAttempts: 1,
  /** Reused exactly as the held audition judged it: its design and requirements are unchanged under the lineup. */
  reuseSheets: Object.freeze(['locations'] as const),
});
const SOL = 'gpt-6.1-sol' as const;
const RATES = { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 10, outputMicroUsdPerToken: 50 },
  sol: { inputMicroUsdPerToken: 2, outputMicroUsdPerToken: 10 } };
/** Paid API calls per stage: two readers + storyboard + review; child render + judge, repair render + judge. */
const TEXT_API_CALLS = 4, CHILD_API_CALLS = 4;
/** The continuation calls the storyboard and its review only. */
const CONTINUATION_API_CALLS = 2;
/** The repair's API calls: its review only (its planner is on the Claude Max route, journaled apart). */
const REPAIR_API_CALLS = 1;
/** The Claude Max journal's own ceiling (SimpleBookBudget's default): a resource guard, not an invoice and not this book's API cap. */
const CLAUDE_MAX_JOURNAL_CAP = 12_000_000;

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const newBookConfigSchema = z.object({ version: z.literal('new-book-experiment-config/v1'), experiment: z.literal(NEW_BOOK_EXPERIMENT.slot),
  workspace: z.string().min(1), parent: z.string().min(1), sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  executable: z.string().min(1), executableSha256: hash, keyEnvFile: z.string().min(1),
  seed: z.string().min(1).max(120), childDesign: z.string().trim().min(20).max(1500), request: z.unknown(),
  /** Opt-in (Guy 2026-10-17, R1): the child stage draws and accepts its anchor under child-anchor-style/v1. Absent: the legacy child stage. */
  childAnchor: z.literal(CHILD_ANCHOR_STYLE_VERSION).optional() }).strict();
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
/** The text stage's saved request record, exactly: the continuation compares the whole record against this, never a part of it. */
const experimentRequestRecord = (prepared: ReturnType<typeof prepareSimpleStory>) => ({ version: 'local-simple-wizard-request/v1',
  requestId: prepared.accepted.requestId, optionsFingerprint: prepared.accepted.optionsFingerprint, consent: 'fictional_profile_new_book_experiment',
  experiment: NEW_BOOK_EXPERIMENT.slot, request: prepared.accepted.canonical });
const currentHead = (config: NewBookConfig) => gitAt(config.workspace, ['rev-parse', 'HEAD']).toString().trim();
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
 * a recorded continuation amendment, the reviewed HEAD the LATEST amendment names (never an edited config). Checked before every paid call.
 */
export function assertExperimentClaim(config: NewBookConfig) {
  const { claim, claimSha256 } = verifiedClaim(config);
  const continuation = readContinuation(config, claimSha256), refused = readRefusedChain(config, claimSha256, continuation);
  const repair = readRepair(config, claimSha256, continuation, refused), repair2 = readRepair2(config, claimSha256, repair);
  const acceptance = readAcceptance(config, claimSha256, repair2), comparison = readScaleComparison(config, claimSha256, acceptance);
  const latest = refused[refused.length - 1];
  assertExperimentSource(config, comparison?.sourceHead ?? acceptance?.sourceHead ?? repair2?.sourceHead ?? repair?.sourceHead ?? latest?.amendment.sourceHead
    ?? continuation?.sourceHead ?? config.sourceHead);
  return { claim, claimSha256, continuation, refused, repair, repair2, acceptance, comparison };
}
type ContinuationChain = { continuation: NewBookContinuation | null; refused: { step: RefusedStep; amendment: NewBookRefusedContinuation }[];
  repair: NewBookRepair | null; repair2: NewBookRepair2 | null; acceptance?: NewBookAcceptance | null; comparison?: NewBookScaleComparison | null };
/** The latest text is usable by later stages: its own review supported it, or the owner accepted that exact held storyboard (bound record). */
const textUsable = (config: NewBookConfig, chain: ContinuationChain) => {
  const status = sealedStatus(path.join(experimentDir(config), textFolderOf(chain)));
  return status === 'review_supported' || (!!chain.acceptance && !!chain.repair2 && status === chain.acceptance.status);
};
/** Where this book's latest text lives. */
const textFolderOf = (chain: ContinuationChain) => chain.repair2 ? NEW_BOOK_STORYBOARD_REPAIR_2.outDir : chain.repair ? NEW_BOOK_STORYBOARD_REPAIR.outDir
  : chain.refused[chain.refused.length - 1]?.step.spec.outDir ?? (chain.continuation ? NEW_BOOK_CONTINUATION.outDir : 'text');

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
/** Every record under one folder of the slot (plus any named files), by path relative to the slot, with its hash. */
function folderEvidence(dir: string, folder: string, files: string[] = []) {
  const walk = (rel: string) => { for (const name of readdirSync(path.join(dir, rel)).sort()) {
    const r = `${rel}/${name}`, st = lstatSync(path.join(dir, r));
    if (st.isSymbolicLink()) fail('new_book_continuation_evidence');
    if (st.isDirectory()) walk(r); else files.push(r);
  } };
  walk(folder);
  return files.map(file => ({ file, sha256: sha(readFileSync(path.join(dir, ...file.split('/')))) }));
}
/** Every original text-stage record (and the request), by path relative to the slot: the continuation's evidence. */
const originalTextEvidence = (dir: string) => folderEvidence(dir, 'text', ['request.json']);
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
  // The readers' known costs and the timed-out request's carried reservation, each re-derived from its own evidence.
  verifyPaidStages(textDir, TEXT_RULES);
  return { knownMicroUsd: snapshot.newKnownApiMicroUsd, carriedUnresolvedMicroUsd: storyboard.maximumMicroUsd as number };
}
type ContinuationBaseline = { claimSha256: string; amended: NewBookContinuation | null; ledger: ReturnType<typeof failedStoryboardLedger>;
  evidence: ReturnType<typeof originalTextEvidence> };
/**
 * The continuation's admission baseline at ONE pinned HEAD (captured once by the caller and compared here, never re-read and adopted): the
 * clean source at the pin, checked first so that every record below is read after it; the unchanged claim; once amended, the amendment's
 * own HEAD equal to the pin; the failed text stage; the COMPLETE saved request record, equal to the one the claimed configuration derives
 * and naming the claim's request; the failed storyboard ledger; and every original record by hash.
 */
function continuationBaseline(config: NewBookConfig, head: string, prepared: ReturnType<typeof prepareSimpleStory>): ContinuationBaseline {
  assertExperimentSource(config, head);
  const { claim, claimSha256 } = verifiedClaim(config);
  const amended = readContinuation(config, claimSha256);
  if (amended && amended.sourceHead !== head) fail('new_book_source_changed');
  const dir = experimentDir(config), textDir = path.join(dir, 'text');
  if (sealedStatus(textDir) !== 'failed') fail('new_book_continuation_scope');
  assertRequestRecord(dir, claim, prepared);
  return { claimSha256, amended, ledger: failedStoryboardLedger(textDir), evidence: originalTextEvidence(dir) };
}
/** The COMPLETE saved request record equals the one the claimed configuration derives, and the claim names that request. */
function assertRequestRecord(dir: string, claim: { requestId: string }, prepared: ReturnType<typeof prepareSimpleStory>) {
  const expected = experimentRequestRecord(prepared);
  let saved: unknown = null;
  try { saved = read(path.join(dir, 'request.json')); } catch { fail('new_book_continuation_request_record'); }
  if (claim.requestId !== expected.requestId || canonicalJson(saved) !== canonicalJson(expected)) fail('new_book_continuation_request_record');
}
/** The same baseline again, at the same pin: nothing it names may have changed since `admitted` (the records the replay used). */
function sameBaseline(config: NewBookConfig, head: string, prepared: ReturnType<typeof prepareSimpleStory>, admitted: ContinuationBaseline) {
  const now = continuationBaseline(config, head, prepared);
  if (now.claimSha256 !== admitted.claimSha256 || canonicalJson(now.evidence) !== canonicalJson(admitted.evidence)) fail('new_book_continuation_evidence');
  return now;
}
/**
 * Records the one continuation (exclusive), immediately after re-checking the admitted baseline at the same pinned HEAD: it binds exactly the
 * records the replay used and that HEAD. Refuses unless the original text stage failed exactly at a timed-out storyboard call.
 */
function amendForContinuation(config: NewBookConfig, head: string, prepared: ReturnType<typeof prepareSimpleStory>, admitted: ContinuationBaseline) {
  const now = sameBaseline(config, head, prepared, admitted);
  if (now.amended) return now.amended;
  const dir = experimentDir(config), textDir = path.join(dir, 'text');
  if (existsSync(path.join(dir, NEW_BOOK_CONTINUATION.outDir))) fail('new_book_continuation_scope');
  for (const stage of ['author', 'editor']) {
    const result = read(path.join(textDir, 'claude-max-stages', `${stage}.result.json`));
    if (result.completed !== true) fail('new_book_continuation_scope');
  }
  const amendment = continuationSchema.parse({ version: 'new-book-continuation/v1', id: NEW_BOOK_CONTINUATION.id, slot: NEW_BOOK_EXPERIMENT.slot,
    approval: NEW_BOOK_CONTINUATION.approval, claimSha256: now.claimSha256, configSha256: sha(canonicalJson(config)), originalSourceHead: config.sourceHead,
    sourceHead: head, failedStep: 'storyboard', priorKnownApiMicroUsd: now.ledger.knownMicroUsd, carriedUnresolvedMicroUsd: now.ledger.carriedUnresolvedMicroUsd,
    evidence: admitted.evidence });
  try { exclusiveJson(experimentContinuationFile(config), amendment); } catch { fail('new_book_continuation_used'); }
  return amendment;
}
/** Where this book's reviewed text lives now, and its verified API ledger (known spend and any carried unresolved reservation). */
export function textStage(config: NewBookConfig, chain: ContinuationChain): { folder: string; path: string; knownMicroUsd: number;
  carriedUnresolvedMicroUsd: number; evidence: { file: string; sha256: string }[] } {
  const dir = experimentDir(config), { continuation, refused, repair, repair2 } = chain;
  if (repair2) {
    // The first repair's verified ledger (held), then the second's own: its prior and carried amounts exactly that ledger (no resolution
    // since: the first repair named none and a resolution is never retroactive), its review's call and its planner's journal re-derived.
    if (!repair) return fail('new_book_continuation');
    const before = textStage(config, { ...chain, repair2: null });
    if (before.knownMicroUsd !== repair2.priorKnownApiMicroUsd || before.carriedUnresolvedMicroUsd !== repair2.carriedUnresolvedMicroUsd) fail('new_book_continuation_ledger');
    const out = path.join(dir, NEW_BOOK_STORYBOARD_REPAIR_2.outDir);
    const ledger = stageLedger(out, REPAIR_API_CALLS, repair2.priorKnownApiMicroUsd, repair2.carriedUnresolvedMicroUsd, REPAIR_API_RULES);
    const planner = verifyRepairPlanner(config, out, repair2.planner, NEW_BOOK_STORYBOARD_REPAIR_2.contracts);
    const amendment = experimentRepair2File(config), accepted = chain.acceptance ? experimentAcceptanceFile(config) : null;
    return { folder: NEW_BOOK_STORYBOARD_REPAIR_2.outDir, path: out, knownMicroUsd: repair2.priorKnownApiMicroUsd + ledger.knownMicroUsd,
      carriedUnresolvedMicroUsd: repair2.carriedUnresolvedMicroUsd,
      evidence: [...before.evidence, { file: amendment, sha256: sha(readFileSync(amendment)) }, { file: ledger.file, sha256: ledger.sha256 },
        { file: planner.file, sha256: planner.sha256 }, ...(accepted ? [{ file: accepted, sha256: sha(readFileSync(accepted)) }] : [])] };
  }
  if (repair) {
    // The held attempt's verified ledger, then the repair's own: its prior and carried amounts must be exactly that ledger with the carry
    // resolution it names applied (or none), and its folder's calls are re-derived from their own evidence.
    const before = textStage(config, { continuation, refused, repair: null, repair2: null });
    const resolution = repair.carryResolutionSha256 === null ? null : readCarryResolution(config, repair.claimSha256, chainFolders({ ...chain, repair: null, repair2: null }));
    if (repair.carryResolutionSha256 !== (resolution?.sha256 ?? null)) fail('new_book_carry_resolution');
    const expected = resolvedLedger(before, resolution);
    if (expected.knownMicroUsd !== repair.priorKnownApiMicroUsd || expected.carriedUnresolvedMicroUsd !== repair.carriedUnresolvedMicroUsd) fail('new_book_continuation_ledger');
    const out = path.join(dir, NEW_BOOK_STORYBOARD_REPAIR.outDir);
    // Its API meter holds the Sol review only; its planner's evidence (the Claude Max journal) is re-derived on its own route.
    const ledger = stageLedger(out, REPAIR_API_CALLS, repair.priorKnownApiMicroUsd, repair.carriedUnresolvedMicroUsd, REPAIR_API_RULES);
    const planner = verifyRepairPlanner(config, out, repair.planner, NEW_BOOK_STORYBOARD_REPAIR.contracts);
    const amendment = experimentRepairFile(config);
    return { folder: NEW_BOOK_STORYBOARD_REPAIR.outDir, path: out, knownMicroUsd: repair.priorKnownApiMicroUsd + ledger.knownMicroUsd,
      carriedUnresolvedMicroUsd: repair.carriedUnresolvedMicroUsd,
      evidence: [...before.evidence, ...(resolution ? [{ file: resolution.file, sha256: resolution.sha256 }] : []),
        { file: amendment, sha256: sha(readFileSync(amendment)) }, { file: ledger.file, sha256: ledger.sha256 }, { file: planner.file, sha256: planner.sha256 }] };
  }
  if (refused.length) {
    if (!continuation) return fail('new_book_continuation');
    const original = failedStoryboardLedger(path.join(dir, 'text'));
    if (original.knownMicroUsd !== continuation.priorKnownApiMicroUsd || original.carriedUnresolvedMicroUsd !== continuation.carriedUnresolvedMicroUsd) fail('new_book_continuation_ledger');
    // Every earlier continuation was refused; the latest attempt holds the reviewed text.
    const { ledger: before, records } = refusedLedgers(config, continuation, refused, refused.length);
    const last = refused[refused.length - 1].amendment, step = refused[refused.length - 1].step;
    if (before.knownMicroUsd !== last.priorKnownApiMicroUsd || before.carriedUnresolvedMicroUsd !== last.carriedUnresolvedMicroUsd) fail('new_book_continuation_ledger');
    const out = path.join(dir, step.spec.outDir);
    const ledger = stageLedger(out, CONTINUATION_API_CALLS, last.priorKnownApiMicroUsd, last.carriedUnresolvedMicroUsd, CONTINUATION_RULES);
    const one = experimentContinuationFile(config), textSpend = path.join(dir, 'text', 'spend.json');
    const evidence = [{ file: textSpend, sha256: sha(readFileSync(textSpend)) }, { file: one, sha256: sha(readFileSync(one)) }];
    refused.forEach(({ step: s }, j) => { const file = refusedFile(config, s); evidence.push(records[j], { file, sha256: sha(readFileSync(file)) }); });
    evidence.push({ file: ledger.file, sha256: ledger.sha256 });
    return { folder: step.spec.outDir, path: out, knownMicroUsd: last.priorKnownApiMicroUsd + ledger.knownMicroUsd,
      carriedUnresolvedMicroUsd: last.carriedUnresolvedMicroUsd, evidence };
  }
  if (!continuation) {
    const ledger = stageLedger(path.join(dir, 'text'), TEXT_API_CALLS, 0, 0, TEXT_RULES);
    return { folder: 'text', path: path.join(dir, 'text'), knownMicroUsd: ledger.knownMicroUsd, carriedUnresolvedMicroUsd: 0, evidence: [{ file: ledger.file, sha256: ledger.sha256 }] };
  }
  const original = failedStoryboardLedger(path.join(dir, 'text'));
  if (original.knownMicroUsd !== continuation.priorKnownApiMicroUsd || original.carriedUnresolvedMicroUsd !== continuation.carriedUnresolvedMicroUsd) fail('new_book_continuation_ledger');
  const out = path.join(dir, NEW_BOOK_CONTINUATION.outDir);
  const ledger = stageLedger(out, CONTINUATION_API_CALLS, continuation.priorKnownApiMicroUsd, continuation.carriedUnresolvedMicroUsd, CONTINUATION_RULES);
  const amendment = experimentContinuationFile(config);
  return { folder: NEW_BOOK_CONTINUATION.outDir, path: out, knownMicroUsd: continuation.priorKnownApiMicroUsd + ledger.knownMicroUsd,
    carriedUnresolvedMicroUsd: continuation.carriedUnresolvedMicroUsd,
    evidence: [{ file: path.join(dir, 'text', 'spend.json'), sha256: sha(readFileSync(path.join(dir, 'text', 'spend.json'))) },
      { file: amendment, sha256: sha(readFileSync(amendment)) }, { file: ledger.file, sha256: ledger.sha256 }] };
}
/**
 * One paid step's live pricing rule (the shared meter rule): the reservation its bound request derives, and how its saved answer settles
 * (`completed`: the meter recorded it as a completed call). Every meter of this experiment is opted in with its stage's rules (meterRules), so
 * its own calls are re-derived before every claim; every later read re-derives them again (verifyPaidStages).
 */
type PaidRule = MeterRule;
const sameUsage = (receipt: any, usage: unknown) => canonicalJson(receipt?.usage ?? null) === canonicalJson(usage ?? null);
/** The story readers: the reader transport's rule (Sol, the requested model at the default tier, its output cap) and its wire's reservation. */
const readerRule: PaidRule = {
  settle: (wire, receipt, completed) => {
    const s = answerSettlement(RATES.sol, wire?.outputCap, wire?.model, receipt?.raw);
    return { estimatedMicroUsd: s.estimatedMicroUsd, coherent: (!completed || s.valid) && sameUsage(receipt, s.usage) };
  },
  reserve: wire => wire?.role === 'astra' && wire.model === SOL && typeof wire.json === 'string'
    ? wireReservation(Buffer.byteLength(wire.json, 'utf8'), wire.outputCap, RATES.sol) : null,
};
/**
 * The storyboard and its review: the live call's own settlement and reservation (visualSettlement, visualReservation), only for a request
 * of that stage's own model, so a storyboard record renamed as its review never settles at the review's rate.
 */
const visualRule = (stage: 'storyboard' | 'review'): PaidRule => {
  const callOf = (wire: any) => ({ stage, maxOutputTokens: wire?.max_output_tokens }) as SimpleStoryboardDiagnosticCall;
  return {
    settle: (wire, receipt, completed) => {
      const call = callOf(wire), s = visualSettlement(call, wire ?? {}, receipt?.raw);
      const labels = receipt?.raw === undefined || receipt?.raw === null || receipt?.model === receipt.raw.model && receipt?.stage === visualStep(call);
      return { estimatedMicroUsd: s.estimatedMicroUsd, coherent: (!completed || s.valid) && sameUsage(receipt, s.usage) && labels };
    },
    reserve: wire => wire?.model === visualModel(callOf(wire)) ? visualReservation(callOf(wire), wire) : null,
  };
};
const TEXT_RULES: Record<string, PaidRule> = { comparison: readerRule, final_review: readerRule, storyboard: visualRule('storyboard'),
  storyboard_review: visualRule('review') };
const CONTINUATION_RULES: Record<string, PaidRule> = { storyboard: visualRule('storyboard'), storyboard_review: visualRule('review') };
/** The repair's API meter: the Sol review only. A storyboard record on its API meter (an Astra planning call) is refused. */
const REPAIR_API_RULES: Record<string, PaidRule> = { storyboard_review: visualRule('review') };
/** The child reference: the reviewed audition's own render adapter and a Sol pixel review, under their shared rules. */
const CHILD_RULES: Record<string, PaidRule> = { reference_child: auditionRenderRule, reference_child_repair: auditionRenderRule,
  reference_child_qa: auditionReviewRule, reference_child_repair_qa: auditionReviewRule };
/**
 * The opt-in child-anchor-style/v1 child stage: the render and its style review and design + age review, then (only for a known defect) the
 * one correction edit and its own style review and design + age review. Six named calls at most; any other step is refused by the meter.
 */
const CHILD_ANCHOR_RULES: Record<string, PaidRule> = { reference_child: auditionRenderRule, reference_child_style_qa: auditionReviewRule,
  reference_child_qa: auditionReviewRule, reference_child_repair: auditionRenderRule, reference_child_repair_style_qa: auditionReviewRule,
  reference_child_repair_qa: auditionReviewRule };
const CHILD_ANCHOR_API_CALLS = 6;
/** The child stage's meter terms: the legacy ones exactly, unless this configuration opted in (its own steps and call limit). */
const childTerms = (config: Pick<NewBookConfig, 'childAnchor'>) => config.childAnchor
  ? { rules: CHILD_ANCHOR_RULES, maxCalls: CHILD_ANCHOR_API_CALLS } : { rules: CHILD_RULES, maxCalls: CHILD_API_CALLS };
/** A stage's rules as its meter's opt-in: exactly the stage's own steps. */
const meterRules = (rules: Record<string, PaidRule>): MeterRules => step => Object.prototype.hasOwnProperty.call(rules, step) ? rules[step] : undefined;
/**
 * Every paid call of one stage folder, re-derived from its own evidence under that call's live pricing rule (the shared verifier the stage's
 * own meter ran before each of its claims): the request its claim bound before the call, and its raw provider answer. A recorded cost, the
 * receipt's normalized usage and labels must be exactly what the raw answer settles to, a completed call must be a valid answer, and a
 * reservation must be the one its request derives. So a summary that the evidence contradicts (result, receipt or spend record, however
 * coherent with each other and with later amendments) never becomes headroom, at any link of the ledger (Codex HOLD at a3578efb, P1).
 */
function verifyPaidStages(stageDir: string, rules: Record<string, PaidRule> | MeterRules) {
  try { verifyMeterRecords(path.join(stageDir, 'paid-stages'), typeof rules === 'function' ? rules : meterRules(rules)); }
  catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    throw typeof code === 'string' && code.startsWith('audition_meter_') ? new NewBookExperimentError(code.replace('audition_meter_', 'new_book_ledger_')) : error;
  }
}
/**
 * The verified API spend of one finished stage (after the earlier stages' `prior`): no unknown cost or outcome, it equals the stage's saved
 * spend record, and every call in it is re-derived from its own evidence under its rule.
 */
export function stageLedger(stageDir: string, maxCalls: number, prior: number, carried: number, rules: Record<string, PaidRule> | MeterRules) {
  const snapshot = new AuditionMeter(path.join(stageDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, maxCalls, prior, carried).snapshot();
  if (snapshot.unknownCost || snapshot.unknownOutcome) fail('new_book_ledger_unknown');
  const file = path.join(stageDir, 'spend.json');
  if (!existsSync(file) || canonicalJson(read(file)) !== canonicalJson(snapshot)) fail('new_book_ledger_record');
  verifyPaidStages(stageDir, rules);
  return { knownMicroUsd: snapshot.newKnownApiMicroUsd, file, sha256: sha(readFileSync(file)) };
}
export const stageRules = { text: TEXT_RULES, continuation: CONTINUATION_RULES, repair: REPAIR_API_RULES, child: CHILD_RULES, childAnchor: CHILD_ANCHOR_RULES };
/** The error's own code, else its message when that is a code (as the book-sequence checks throw), else the fallback. */
const codeOf = (error: unknown, fallback: string) =>
  error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[a-z0-9_]+$/.test(error.code) ? error.code
    : error instanceof Error && /^[a-z0-9_]{1,120}$/.test(error.message) ? error.message : fallback;
const sealedStatus = (stageDir: string) => existsSync(path.join(stageDir, 'sealed.json')) ? read(path.join(stageDir, 'sealed.json')).status : null;

// ---------------------------------------------------------------------------------------------------------------
// Stage 1: story and storyboard.
// ---------------------------------------------------------------------------------------------------------------
type OpusTransport = (wire: CausalWire, call: CausalDispatch, signal: AbortSignal) => Promise<TransportReply>;
type Responses = (payload: ReturnType<typeof simpleWizardVisualPayload>, signal: AbortSignal, timeout: number, observe?: LongCallObserver) =>
  Promise<OpenAI.Responses.Response>;
/** The storyboard planner on the Claude Max CLI route (an explicitly routed stage only). */
type PlannerTransport = (wire: PlannerWire, call: SimpleStoryboardDiagnosticCall, signal: AbortSignal) => Promise<TransportReply>;
export type TextTransports = { opus?: OpusTransport; reader?: OpusTransport; responses?: Responses; planner?: PlannerTransport };
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
type TextContracts = { actorOwnedAppearance?: true; momentContract?: true; landmarkKindContract?: true; sceneLocationContract?: true;
  compilerRulesContract?: true; drawnInstantContract?: true };
/** One rule for a storyboard or review call's journal step, price and reservation: the live call and any replay of its records share it. */
const visualStep = (call: SimpleStoryboardDiagnosticCall) => call.stage === 'review' ? 'storyboard_review' : 'storyboard';
const visualRate = (call: SimpleStoryboardDiagnosticCall) => call.stage === 'review' ? RATES.sol : RATES.astra;
/** The model each stage's request names (simpleWizardVisualPayload with the Sol review), which its rate prices. */
const visualModel = (call: SimpleStoryboardDiagnosticCall) => call.stage === 'review' ? SOL : CAUSAL_MODELS.astra;
/** The content identity of one storyboard request (instructions, input, schema, cap), whichever transport carries it. */
const plannerRequestDigest = (call: SimpleStoryboardDiagnosticCall) => previewSha(canonicalJson(plannerRequest(call)));
/** The largest storyboard or review request this experiment sends (the provider payload builder's own input limit). */
const VISUAL_WIRE_LIMIT = BOOK_LIMITS.inputBytesPerCall;
function visualReservation(call: SimpleStoryboardDiagnosticCall, payload: unknown) {
  const wireBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8'); if (wireBytes > VISUAL_WIRE_LIMIT) fail('new_book_wire_limit');
  return wireReservation(wireBytes, call.maxOutputTokens, visualRate(call));
}
/**
 * The settlement of one OpenAI answer from its raw provider response: the normalized usage, its cost at `rate` (only for the requested
 * `model` at the default tier), and whether it is a completed answer with output within `outputCap`. The storyboard and its review settle
 * with it live (visualSettlement), and it is the story readers' transport rule too (the same formula, pinned against that transport by test):
 * every replay or later read of saved records re-derives it and must find exactly what was recorded.
 */
function answerSettlement(rate: Rates, outputCap: number, model: string, response: unknown) {
  const r = (response && typeof response === 'object' ? response : {}) as { model?: unknown; service_tier?: unknown; status?: unknown;
    output_text?: unknown; usage?: { input_tokens?: unknown; output_tokens?: unknown } | null };
  const usage = safeUsage(r.usage ? { inputTokens: r.usage.input_tokens, outputTokens: r.usage.output_tokens } : null);
  const estimatedMicroUsd = usage && r.model === model && r.service_tier === 'default'
    ? Math.ceil(usage.inputTokens * rate.inputMicroUsdPerToken + usage.outputTokens * rate.outputMicroUsdPerToken) : null;
  const valid = r.model === model && r.service_tier === 'default' && r.status === 'completed' && !!r.output_text && !!usage &&
    usage.outputTokens <= outputCap;
  return { usage, estimatedMicroUsd, valid };
}
/** A storyboard or review answer's settlement, from its raw provider response and the exact request (the live call settles with this). */
function visualSettlement(call: SimpleStoryboardDiagnosticCall, payload: { model: string }, response: unknown) {
  return answerSettlement(visualRate(call), call.maxOutputTokens, payload.model, response);
}
export const replaySettlement = { answer: answerSettlement, rates: RATES };
async function textCore(args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void;
  contracts: TextContracts; transports?: TextTransports; storyboardRepair?: StoryboardRepair;
  /** Opt-in: the storyboard call goes to the Opus planner on the Claude Max route (journaled in claudeMax), only for exactly this request. */
  opusPlanner?: { requestDigest: string };
  prepared: ReturnType<typeof prepareExperimentRequest>['prepared']; options: ReturnType<typeof prepareExperimentRequest>['options'];
  outDir: string; api: AuditionMeter; claudeMax: SimpleBookBudget | null; replay: TextReplay | null; continuationId: string | null }) {
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
  // The accepted lineage this stage builds on (every amendment and every earlier text folder, not its own), pinned before its first call (at
  // the top of the sealed block below) and re-checked before each: a rewritten amendment cannot bless a changed earlier record between this
  // stage's calls (Codex HOLD at 1fd909af, F1).
  let lineage: LineagePin | null = null;
  let storyboardDraft: unknown = null;
  // The first failed paid call's own code is the stage's cause (the story/storyboard layers re-wrap callback errors); so is a guard's refusal.
  let failedStageCode: string | null = null;
  const recordFailure = (error: unknown): never => { failedStageCode ??= codeOf(error, 'new_book_provider_transport'); throw error; };
  const check = () => {
    try { if (signal.aborted) fail('new_book_cancelled'); assertExperimentClaim(config); sameLineage(config, lineage ?? fail('new_book_continuation_evidence')); }
    catch (error) { recordFailure(error); }
  };
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    exclusiveJson(path.join(outDir, 'spend.json'), api.snapshot());
    if (claudeMax) exclusiveJson(path.join(outDir, 'claude-max-spend.json'), { ...claudeMax.snapshot(), note: NEW_BOOK_EXPERIMENT.claudeMax });
    exclusiveJson(path.join(outDir, 'sealed.json'), { status, ...extra, ...(args.continuationId ? { continuation: args.continuationId } : {}), runtimeEligible: false });
  };
  try {
    lineage = lineagePin(config, chainFolders(assertExperimentClaim(config)).map(f => f.folder).filter(f => path.join(experimentDir(config), f) !== outDir));
    const result = await runSimpleWizardBook({ request, options: args.options, seed: config.seed, signal, reservedWritingUsd: 4, ...args.contracts,
      ...(args.storyboardRepair ? { storyboardRepair: args.storyboardRepair } : {}),
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
        if (call.stage === 'storyboard' && args.opusPlanner) {
          // The admitted request only, on the Claude Max route, journaled there (never on the API meter); its review stays below.
          if (plannerRequestDigest(call) !== args.opusPlanner.requestDigest || !claudeMax) return recordFailure(new NewBookExperimentError('new_book_continuation_request'));
          const instructionFile = path.join(outDir, 'storyboard-instructions.txt');
          exclusiveText(instructionFile, plannerRequest(call).instructions);
          const wire = prepareOpusStoryboardWire(call, policy, instructionFile);
          // Its own empty working folder in this stage's folder: the original text folder (sealed as evidence) is never the CLI's cwd again.
          const workspace = path.join(outDir, 'cli-workspace'); mkdirSync(workspace);
          const plan = args.transports?.planner ?? createOpusStoryboardTransport({ ...policy, workspace });
          return claudeMax.run('storyboard', wire, OPUS_PLANNER.sessionGuardMicroUsd, async () => {
            const reply = await plan(wire, call, s);
            storyboardDraft = reply.output;
            return { value: reply.output, estimatedMicroUsd: reply.estimatedMicroUsd, receipt: reply };
          }).catch(recordFailure);
        }
        const payload = simpleWizardVisualPayload(call, SOL), step = visualStep(call);
        return api.run(step, payload, visualReservation(call, payload), async () => {
          const observed: unknown[] = [];
          let response: OpenAI.Responses.Response;
          // A failed call keeps its low-level cause (the SDK drops a timeout's cause; the transport reported it as it happened).
          try { response = await responses(payload, s, generationTimeoutMs(call.maxOutputTokens), failure => observed.push(failure)); }
          catch (error) {
            const cause = providerFailureCause(error);
            throw Object.assign(new NewBookExperimentError(cause.sdkError === 'APIConnectionTimeoutError' ? 'new_book_provider_timeout' : 'new_book_provider_transport'),
              { receipt: { estimatedMicroUsd: null, failure: cause, observed } });
          }
          const { usage, estimatedMicroUsd, valid } = visualSettlement(call, payload, response);
          const receipt = { raw: response, usage, estimatedMicroUsd, model: response.model, stage: step };
          if (s.aborted || !valid) throw Object.assign(new NewBookExperimentError('new_book_provider_invalid'), { receipt });
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
  exclusiveJson(path.join(dir, 'request.json'), experimentRequestRecord(prepared));
  return textCore({ ...args, prepared, options, outDir: textDir,
    api: new AuditionMeter(path.join(textDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, TEXT_API_CALLS, 0, 0, meterRules(TEXT_RULES)),
    claudeMax: new SimpleBookBudget(path.join(textDir, 'claude-max-stages'), 0), replay: null, continuationId: null });
}

/**
 * The ORIGINAL storyboard request, reconstructed from the roots alone: the consumed configuration's request, the paid story replayed from
 * its saved answers, and the experiment's ORIGINAL contracts in code. The timed-out call's claim must name exactly this request; since its
 * stored request must equal its claim and its maximum must be that request's reservation (verifyPaidStages, at every read), the stored
 * request and the carried reservation are then the ones the book itself derives. A request rewritten together with its digests, its maximum and every ledger above it (alone, or jointly with the first
 * continuation's, which re-sent it) is not the reference, so its lower reservation never becomes headroom (Codex HOLD at 7af52722, P1).
 * Every read that admits the carried reservation calls this first: each refused attempt's admission, the child stage, the grant and the
 * audition (start and resume).
 */
async function assertOriginalRequest(config: NewBookConfig) {
  const { options, prepared } = prepareExperimentRequest(config);
  const textDir = path.join(experimentDir(config), 'text'), policy = textPolicy(config), replay = textReplay(textDir);
  const seen: { call: SimpleStoryboardDiagnosticCall | null; refusal: unknown } = { call: null, refusal: null };
  const replayed = <T>(f: () => T) => { try { return f(); } catch (error) { seen.refusal ??= error; throw error; } };
  await runSimpleWizardBook({ request: prepared.accepted.canonical, options, seed: config.seed, signal: new AbortController().signal,
    reservedWritingUsd: 4, ...NEW_BOOK_EXPERIMENT.contracts, publish: () => {},
    opus: async call => { const d = storyDispatch(call, 'opus', prepared.accepted.requestId);
      return replayed(() => replay.opus(d, prepareCausalWire(d, policy, 2000000, path.join(textDir, `${call.stage}-instructions.txt`)))); },
    reader: async call => { const d = storyDispatch(call, 'astra', prepared.accepted.requestId);
      return replayed(() => replay.reader(d, prepareCausalWire(d, policy, 2000000))); },
    visual: async (call: SimpleStoryboardDiagnosticCall) => { seen.call ??= call; throw new NewBookExperimentError('new_book_original_request_stop'); } })
    .catch((error: unknown) => { if (!seen.call) throw seen.refusal ?? error; });
  const call = seen.call;
  if (!call || call.stage !== 'storyboard') return fail('new_book_original_request');
  const payload = simpleWizardVisualPayload(call, SOL);
  const claim = read(path.join(textDir, 'paid-stages', 'storyboard.claim.json'));
  if (claim.wireDigest !== previewSha(canonicalJson(payload))) fail('new_book_original_request');
}

/**
 * Read-only preview of the continuation (no amendment, no folder, no provider call, no key): it must be admissible, the paid story must
 * replay exactly from its bound receipts, and the storyboard request it then builds must be exactly the one that timed out (the digest
 * its claim recorded before that call was sent). The continuation runs this first, so a mismatch never uses the one attempt.
 */
export async function previewStoryboardContinuation(config: NewBookConfig) {
  return (await admitContinuation(config, currentHead(config))).admitted.summary;
}
/** The preview's checks at one pinned HEAD; the continuation runs exactly this before it may consume anything. */
async function admitContinuation(config: NewBookConfig, head: string) {
  const { options, prepared } = prepareExperimentRequest(config);
  const baseline = continuationBaseline(config, head, prepared), ledger = baseline.ledger;
  const dir = experimentDir(config), textDir = path.join(dir, 'text');
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
  // The replay was asynchronous: the same pinned HEAD, still clean, and exactly the records it replayed.
  sameBaseline(config, head, prepared, baseline);
  return { prepared, options, admitted: { baseline, summary: { admissible: true, amended: !!baseline.amended,
    outDirExists: existsSync(path.join(dir, NEW_BOOK_CONTINUATION.outDir)), storyReplayed: true, sameStoryboardRequest: true,
    priorKnownApiMicroUsd: ledger.knownMicroUsd, carriedUnresolvedMicroUsd: ledger.carriedUnresolvedMicroUsd,
    remainingUnderCapMicroUsd: NEW_BOOK_EXPERIMENT.apiCapMicroUsd - ledger.knownMicroUsd - ledger.carriedUnresolvedMicroUsd,
    providerCalls: 0, keyRead: false } } };
}

/**
 * Guy's one continuation: recorded once as an amendment of the same claim, it replays the paid story calls from their bound receipts and
 * calls only the storyboard and its review again, in a new folder whose meter carries the earlier known spend and the timed-out call's
 * full unknown reservation. The original failed records stay untouched.
 */
export async function runNewBookStoryboardContinuation(args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void;
  contracts: { actorOwnedAppearance?: true; momentContract?: true; landmarkKindContract?: true }; transports?: TextTransports }) {
  const { config } = args;
  // ONE execution HEAD, captured once: the replay, the amendment and every later check compare against it (never re-read and adopted).
  const head = currentHead(config);
  const { prepared, options, admitted } = await admitContinuation(config, head);
  amendForContinuation(config, head, prepared, admitted.baseline);
  const { continuation } = assertExperimentClaim(config);
  if (!continuation) return fail('new_book_continuation');
  const dir = experimentDir(config), outDir = path.join(dir, NEW_BOOK_CONTINUATION.outDir);
  try { mkdirSync(outDir); } catch { fail('new_book_continuation_used'); }
  return textCore({ ...args, prepared, options, outDir,
    api: new AuditionMeter(path.join(outDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, CONTINUATION_API_CALLS,
      continuation.priorKnownApiMicroUsd, continuation.carriedUnresolvedMicroUsd, meterRules(CONTINUATION_RULES)),
    claudeMax: null, replay: textReplay(path.join(dir, 'text')), continuationId: NEW_BOOK_CONTINUATION.id });
}

// ---------------------------------------------------------------------------------------------------------------
// Refused-answer attempts, each a separate approval of Guy's: a continuation's storyboard ANSWERED but was refused by a named compiler check, so
// the same story is replayed and the same storyboard request is sent once more with exactly one added instruction contract, then its review.
// Each is written once beside the claim, bound to the previous amendment, every record of the previous continuation and its exact refusal.
// ---------------------------------------------------------------------------------------------------------------
type ContinuationSpec = { id: string; outDir: string };
type RefusedStep = { index: number; spec: ContinuationSpec & { approval: string; contracts: TextContracts }; previous: ContinuationSpec;
  previousContracts: TextContracts; refusal: string; failedStep: string; addendum: string };
const REFUSED_STEPS: readonly RefusedStep[] = Object.freeze([
  { index: 0, spec: NEW_BOOK_CONTINUATION_2, previous: NEW_BOOK_CONTINUATION, previousContracts: NEW_BOOK_EXPERIMENT.contracts,
    refusal: 'book_sequence_scene_location_drift', failedStep: 'storyboard_scene_location', addendum: SCENE_LOCATION_STORYBOARD_ADDENDUM },
  { index: 1, spec: NEW_BOOK_CONTINUATION_3, previous: NEW_BOOK_CONTINUATION_2, previousContracts: NEW_BOOK_CONTINUATION_2.contracts,
    refusal: 'unknown_or_duplicate_prop', failedStep: 'storyboard_undeclared_prop', addendum: COMPILER_RULES_STORYBOARD_ADDENDUM },
]);
const refusedFile = (config: NewBookConfig, step: RefusedStep) =>
  path.join(path.dirname(experimentClaimFile(config)), `${NEW_BOOK_EXPERIMENT.slot}.continuation-${step.index + 2}.json`);
export const experimentContinuation2File = (config: NewBookConfig) => refusedFile(config, REFUSED_STEPS[0]);
export const experimentContinuation3File = (config: NewBookConfig) => refusedFile(config, REFUSED_STEPS[1]);
/** The amendment the step's own amendment binds by hash: the first continuation's, or the previous refused attempt's. */
const previousAmendmentFile = (config: NewBookConfig, step: RefusedStep) =>
  step.index === 0 ? experimentContinuationFile(config) : refusedFile(config, REFUSED_STEPS[step.index - 1]);
const headSha = z.string().regex(/^[a-f0-9]{40}$/);
const refusedSchema = (step: RefusedStep) => z.object({ version: z.literal('new-book-continuation/v1'), id: z.literal(step.spec.id),
  slot: z.literal(NEW_BOOK_EXPERIMENT.slot), approval: z.literal(step.spec.approval), claimSha256: hash, configSha256: hash,
  previousSha256: hash, originalSourceHead: headSha, previousSourceHead: headSha, sourceHead: headSha, failedStep: z.literal(step.failedStep),
  priorKnownApiMicroUsd: z.number().int().nonnegative(), carriedUnresolvedMicroUsd: z.number().int().positive(),
  evidence: z.array(z.object({ file: z.string().regex(new RegExp(`^${step.previous.outDir}/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)?$`)), sha256: hash })
    .strict()).min(4).max(32) }).strict();
export type NewBookRefusedContinuation = z.infer<ReturnType<typeof refusedSchema>>;
/** The recorded refused-answer amendments, in order, each verified against its predecessor and every record of the previous continuation. */
function readRefusedChain(config: NewBookConfig, claimSha256: string, first: NewBookContinuation | null) {
  const chain: { step: RefusedStep; amendment: NewBookRefusedContinuation }[] = [];
  for (const step of REFUSED_STEPS) {
    if (!existsSync(refusedFile(config, step))) {
      // No later attempt may exist without this one.
      if (REFUSED_STEPS.slice(step.index + 1).some(later => existsSync(refusedFile(config, later)))) fail('new_book_continuation');
      break;
    }
    const previous = step.index === 0 ? first : chain[step.index - 1]?.amendment ?? null;
    if (!previous) return fail('new_book_continuation');
    const parsed = refusedSchema(step).safeParse(read(refusedFile(config, step)));
    if (!parsed.success || parsed.data.claimSha256 !== claimSha256 || parsed.data.configSha256 !== sha(canonicalJson(config)) ||
        parsed.data.originalSourceHead !== config.sourceHead || parsed.data.previousSourceHead !== previous.sourceHead ||
        parsed.data.previousSha256 !== sha(readFileSync(previousAmendmentFile(config, step)))) return fail('new_book_continuation');
    // The previous continuation's records are exactly those this amendment bound.
    if (canonicalJson(folderEvidence(experimentDir(config), step.previous.outDir)) !== canonicalJson(parsed.data.evidence)) fail('new_book_continuation_evidence');
    chain.push({ step, amendment: parsed.data });
  }
  return chain;
}
/**
 * A continuation as it ended after its answer was refused: sealed failed (by this continuation), its one storyboard call answered and settled
 * with a known cost, nothing else called. (That the answer was refused exactly at the named check is proven by replaying it, in the admission.)
 */
function refusedStoryboardLedger(config: NewBookConfig, continuation: ContinuationSpec, prior: number, carried: number) {
  const out = path.join(experimentDir(config), continuation.outDir), root = path.join(out, 'paid-stages');
  const sealed = existsSync(path.join(out, 'sealed.json')) ? read(path.join(out, 'sealed.json')) : null;
  if (sealed?.status !== 'failed' || sealed.continuation !== continuation.id || !existsSync(root)) fail('new_book_continuation_scope');
  const claims = readdirSync(root).filter(n => n.endsWith('.claim.json')).map(n => n.slice(0, -'.claim.json'.length)).sort();
  if (canonicalJson(claims) !== canonicalJson(['storyboard']) || read(path.join(root, 'storyboard.result.json')).completed !== true) fail('new_book_continuation_scope');
  const ledger = stageLedger(out, CONTINUATION_API_CALLS, prior, carried, CONTINUATION_RULES);
  return { knownMicroUsd: prior + ledger.knownMicroUsd, carriedUnresolvedMicroUsd: carried, file: ledger.file, sha256: ledger.sha256 };
}
/**
 * The verified ledger through the first `count` refused continuations (the first continuation, then each earlier refused attempt in order):
 * every amendment's prior must be exactly the known spend before it; returns the ledger after the last one and each one's spend record.
 */
function refusedLedgers(config: NewBookConfig, first: NewBookContinuation, chain: { amendment: NewBookRefusedContinuation }[], count: number) {
  let ledger = refusedStoryboardLedger(config, NEW_BOOK_CONTINUATION, first.priorKnownApiMicroUsd, first.carriedUnresolvedMicroUsd);
  let priorOfLast = first.priorKnownApiMicroUsd;
  const records = [{ file: ledger.file, sha256: ledger.sha256 }];
  for (let j = 0; j < count - 1; j++) {
    const a = chain[j].amendment;
    if (a.priorKnownApiMicroUsd !== ledger.knownMicroUsd || a.carriedUnresolvedMicroUsd !== ledger.carriedUnresolvedMicroUsd) fail('new_book_continuation_ledger');
    priorOfLast = a.priorKnownApiMicroUsd;
    ledger = refusedStoryboardLedger(config, REFUSED_STEPS[j].spec, a.priorKnownApiMicroUsd, a.carriedUnresolvedMicroUsd);
    records.push({ file: ledger.file, sha256: ledger.sha256 });
  }
  return { ledger, priorOfLast, records };
}
type RefusedBaseline = { claimSha256: string; previous: { sourceHead: string }; previousSha256: string; amended: NewBookRefusedContinuation | null;
  ledger: ReturnType<typeof refusedStoryboardLedger>; priorOfLast: number; evidence: ReturnType<typeof folderEvidence> };
/**
 * A refused-answer attempt's admission baseline at ONE pinned HEAD (compared, never adopted): the clean source first; the unchanged claim; the
 * first amendment (and through it every original record); every earlier attempt's amendment; once amended, this attempt's own HEAD equal to the
 * pin; the failed text stage; the complete request record; every earlier ledger; and every record of the previous continuation by hash.
 */
function refusedBaseline(config: NewBookConfig, step: RefusedStep, head: string, prepared: ReturnType<typeof prepareSimpleStory>): RefusedBaseline {
  assertExperimentSource(config, head);
  const { claim, claimSha256 } = verifiedClaim(config);
  const first = readContinuation(config, claimSha256);
  if (!first) return fail('new_book_continuation_scope');
  const chain = readRefusedChain(config, claimSha256, first);
  // Its predecessor attempt must exist, and no later attempt.
  if (chain.length < step.index || chain.length > step.index + 1) fail('new_book_continuation_scope');
  const amended = chain[step.index]?.amendment ?? null;
  if (amended && amended.sourceHead !== head) fail('new_book_source_changed');
  const dir = experimentDir(config), textDir = path.join(dir, 'text');
  if (sealedStatus(textDir) !== 'failed') fail('new_book_continuation_scope');
  assertRequestRecord(dir, claim, prepared);
  const original = failedStoryboardLedger(textDir);
  if (original.knownMicroUsd !== first.priorKnownApiMicroUsd || original.carriedUnresolvedMicroUsd !== first.carriedUnresolvedMicroUsd) fail('new_book_continuation_ledger');
  const { ledger, priorOfLast } = refusedLedgers(config, first, chain, step.index + 1);
  return { claimSha256, previous: step.index === 0 ? first : chain[step.index - 1].amendment, previousSha256: sha(readFileSync(previousAmendmentFile(config, step))),
    amended, ledger, priorOfLast, evidence: folderEvidence(dir, step.previous.outDir) };
}
function sameRefusedBaseline(config: NewBookConfig, step: RefusedStep, head: string, prepared: ReturnType<typeof prepareSimpleStory>, admitted: RefusedBaseline) {
  const now = refusedBaseline(config, step, head, prepared);
  if (now.claimSha256 !== admitted.claimSha256 || now.previousSha256 !== admitted.previousSha256 ||
      canonicalJson(now.evidence) !== canonicalJson(admitted.evidence)) fail('new_book_continuation_evidence');
  return now;
}
/**
 * Read-only preview of a refused-answer attempt: admissible; the paid story replays exactly; the previous continuation's saved storyboard
 * answer, replayed under its own contracts with its cost re-derived from its raw answer, is refused exactly at the named check; and the new
 * storyboard request equals the previous one except for this attempt's added instruction and the source digest that records it.
 */
export async function previewStoryboardContinuation2(config: NewBookConfig) {
  return (await admitRefused(config, REFUSED_STEPS[0], currentHead(config))).admitted.summary;
}
export async function previewStoryboardContinuation3(config: NewBookConfig) {
  return (await admitRefused(config, REFUSED_STEPS[1], currentHead(config))).admitted.summary;
}
async function admitRefused(config: NewBookConfig, step: RefusedStep, head: string) {
  const { options, prepared } = prepareExperimentRequest(config);
  const baseline = refusedBaseline(config, step, head, prepared), ledger = baseline.ledger;
  // The carried reservation is admitted only for the original request the roots derive (re-checked by the baseline after every replay).
  await assertOriginalRequest(config);
  const dir = experimentDir(config), textDir = path.join(dir, 'text'), root1 = path.join(dir, step.previous.outDir, 'paid-stages');
  const policy = textPolicy(config), replay = textReplay(textDir);
  // The previous continuation's storyboard request and answer, bound to the claim written before that call and to its settled cost.
  const [claim1, wire1, result1, receipt1] = ['claim', 'wire', 'result', 'receipt'].map(k => read(path.join(root1, `storyboard.${k}.json`)));
  if (previewSha(canonicalJson(wire1)) !== claim1.wireDigest || result1.wireDigest !== claim1.wireDigest || result1.completed !== true ||
      receipt1?.estimatedMicroUsd !== result1.estimatedMicroUsd || typeof receipt1?.raw?.output_text !== 'string') fail('new_book_continuation_replay');
  let refusal: unknown = null;
  const replayed = <T>(f: () => T) => { try { return f(); } catch (error) { refusal ??= error; throw error; } };
  const story = (contracts: TextContracts, visual: (call: SimpleStoryboardDiagnosticCall) => Promise<unknown>) =>
    runSimpleWizardBook({ request: prepared.accepted.canonical, options, seed: config.seed, signal: new AbortController().signal,
      reservedWritingUsd: 4, ...contracts, publish: () => {},
      opus: async call => { const d = storyDispatch(call, 'opus', prepared.accepted.requestId);
        return replayed(() => replay.opus(d, prepareCausalWire(d, policy, 2000000, path.join(textDir, `${call.stage}-instructions.txt`)))); },
      reader: async call => { const d = storyDispatch(call, 'astra', prepared.accepted.requestId);
        return replayed(() => replay.reader(d, prepareCausalWire(d, policy, 2000000))); },
      visual });
  // 1. The previous continuation's saved answer, under its own contracts: exactly its request, refused exactly at the named check.
  let answered = false, sameFirstRequest = false, firstSource: string | null = null, firstInstructions: string | null = null, settledCost: number | null = null;
  const refusedAt = await story(step.previousContracts, async call => {
    const payload = simpleWizardVisualPayload(call, SOL);
    sameFirstRequest = !answered && call.stage === 'storyboard' && previewSha(canonicalJson(payload)) === claim1.wireDigest;
    if (!sameFirstRequest) throw new NewBookExperimentError('new_book_continuation_replay');
    // Its cost is re-derived from the raw answer and this exact request under the live rule, never taken from the summaries alone: the
    // result (and so the stage ledger summed from it), the receipt's usage, model and step must all be what the raw answer settles to.
    const settled = visualSettlement(call, payload, receipt1.raw);
    if (!settled.valid || settled.estimatedMicroUsd === null || settled.estimatedMicroUsd !== result1.estimatedMicroUsd ||
        canonicalJson(receipt1.usage) !== canonicalJson(settled.usage) || receipt1.model !== receipt1.raw.model || receipt1.stage !== visualStep(call) ||
        ledger.knownMicroUsd !== baseline.priorOfLast + settled.estimatedMicroUsd) throw new NewBookExperimentError('new_book_continuation_cost');
    settledCost = settled.estimatedMicroUsd;
    answered = true; firstSource = call.context.sourceDigest; firstInstructions = call.instructions;
    return decodePersonalBookProviderOutput(call, JSON.parse(receipt1.raw.output_text));
  }).then(() => null, (error: unknown) => error);
  if (!answered) throw refusal ?? new NewBookExperimentError(sameFirstRequest ? 'new_book_continuation_cost' : 'new_book_continuation_replay');
  if (!(refusedAt instanceof Error) || refusedAt.message !== step.refusal) fail('new_book_continuation_scope');
  // 2. The new request: the same, but for this attempt's added instruction and the source digest that records its contract. The storyboard
  //    call's instructions gain exactly that addendum; the provider request is the previous one with those instructions (its own trailing
  //    provider note kept) and that digest swapped in, nothing else.
  let reached = false, onlyTheRule = false, newReservation: number | null = null;
  await story(step.spec.contracts, async call => {
    reached = true;
    const payload = simpleWizardVisualPayload(call, SOL), source = call.context.sourceDigest, old = canonicalJson(wire1);
    // The new request carries the rule's bytes, so its own reservation (computed as the live call will) is reported, not the previous one's.
    newReservation = visualReservation(call, payload);
    onlyTheRule = call.stage === 'storyboard' && !!firstSource && !!firstInstructions && source !== firstSource && old.split(firstSource).length === 2 &&
      call.instructions === `${firstInstructions}\n${step.addendum}` && wire1.instructions.startsWith(firstInstructions) &&
      canonicalJson(payload) === canonicalJson({ ...JSON.parse(old.split(firstSource).join(source)),
        instructions: call.instructions + wire1.instructions.slice(firstInstructions.length) });
    throw new NewBookExperimentError('new_book_continuation_preview_stop');
  }).catch((error: unknown) => { if (!reached) throw refusal ?? error; });
  if (!reached) fail('new_book_continuation_scope');
  if (!onlyTheRule) fail('new_book_continuation_request');
  // Both replays were asynchronous: the same pinned HEAD, still clean, and exactly the records they used.
  sameRefusedBaseline(config, step, head, prepared, baseline);
  return { prepared, options, admitted: { baseline, summary: { admissible: true, amended: !!baseline.amended,
    outDirExists: existsSync(path.join(dir, step.spec.outDir)), storyReplayed: true, previousRefusal: step.refusal,
    ...(step.index === 0 ? { previousRefusedAtSceneLocation: true } : {}),
    requestChangedOnlyByTheRule: true, previousStoryboardSettledMicroUsd: settledCost, newStoryboardReservationMicroUsd: newReservation,
    priorKnownApiMicroUsd: ledger.knownMicroUsd, carriedUnresolvedMicroUsd: ledger.carriedUnresolvedMicroUsd,
    remainingUnderCapMicroUsd: NEW_BOOK_EXPERIMENT.apiCapMicroUsd - ledger.knownMicroUsd - ledger.carriedUnresolvedMicroUsd,
    providerCalls: 0, keyRead: false } } };
}
/** Records the attempt (exclusive), immediately after re-checking the admitted baseline at the same pinned HEAD. */
function amendForRefused(config: NewBookConfig, step: RefusedStep, head: string, prepared: ReturnType<typeof prepareSimpleStory>, admitted: RefusedBaseline) {
  const now = sameRefusedBaseline(config, step, head, prepared, admitted);
  if (now.amended) return now.amended;
  if (existsSync(path.join(experimentDir(config), step.spec.outDir))) fail('new_book_continuation_scope');
  const amendment = refusedSchema(step).parse({ version: 'new-book-continuation/v1', id: step.spec.id, slot: NEW_BOOK_EXPERIMENT.slot,
    approval: step.spec.approval, claimSha256: now.claimSha256, configSha256: sha(canonicalJson(config)), previousSha256: now.previousSha256,
    originalSourceHead: config.sourceHead, previousSourceHead: now.previous.sourceHead, sourceHead: head, failedStep: step.failedStep,
    priorKnownApiMicroUsd: now.ledger.knownMicroUsd, carriedUnresolvedMicroUsd: now.ledger.carriedUnresolvedMicroUsd, evidence: admitted.evidence });
  try { exclusiveJson(refusedFile(config, step), amendment); } catch { fail('new_book_continuation_used'); }
  return amendment;
}
/**
 * A refused-answer attempt: one pinned HEAD, the admission above, its amendment, then only the storyboard (with the added contract) and its
 * review, in a new folder whose meter carries all earlier known spend and the first call's unresolved reservation.
 */
async function runRefused(step: RefusedStep, args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void; transports?: TextTransports }) {
  const { config } = args;
  const head = currentHead(config);
  const { prepared, options, admitted } = await admitRefused(config, step, head);
  amendForRefused(config, step, head, prepared, admitted.baseline);
  const mine = assertExperimentClaim(config).refused[step.index]?.amendment;
  if (!mine) return fail('new_book_continuation');
  const dir = experimentDir(config), outDir = path.join(dir, step.spec.outDir);
  try { mkdirSync(outDir); } catch { fail('new_book_continuation_used'); }
  return textCore({ ...args, contracts: step.spec.contracts, prepared, options, outDir,
    api: new AuditionMeter(path.join(outDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, CONTINUATION_API_CALLS,
      mine.priorKnownApiMicroUsd, mine.carriedUnresolvedMicroUsd, meterRules(CONTINUATION_RULES)),
    claudeMax: null, replay: textReplay(path.join(dir, 'text')), continuationId: step.spec.id });
}
/** Guy's second attempt (after the first continuation was refused at scene/location; adds the scene-location contract). */
export const runNewBookStoryboardContinuation2 = (args: Parameters<typeof runRefused>[1]) => runRefused(REFUSED_STEPS[0], args);
/** Guy's third attempt (after the second was refused at an undeclared page prop; adds the compiler-rules contract). */
export const runNewBookStoryboardContinuation3 = (args: Parameters<typeof runRefused>[1]) => runRefused(REFUSED_STEPS[1], args);

// ---------------------------------------------------------------------------------------------------------------
// Guy's resolution of the carried reservation: the timed-out call's actual charge, from his own provider usage records, replaces its full
// reservation. Written once beside the claim, BEFORE the repair amendment (never retroactive); the repair amendment names it by hash and every
// later read re-derives it from the attestation and this book's own records.
// ---------------------------------------------------------------------------------------------------------------
type StageFolder = { folder: string; rules: Record<string, PaidRule> };
/** Every text folder of the chain, in order: the original stage, each continuation, the repair. */
function chainFolders(chain: ContinuationChain): StageFolder[] {
  return [{ folder: 'text', rules: TEXT_RULES },
    ...(chain.continuation ? [{ folder: NEW_BOOK_CONTINUATION.outDir, rules: CONTINUATION_RULES }] : []),
    ...chain.refused.map(r => ({ folder: r.step.spec.outDir, rules: CONTINUATION_RULES })),
    ...(chain.repair ? [{ folder: NEW_BOOK_STORYBOARD_REPAIR.outDir, rules: REPAIR_API_RULES }] : []),
    ...(chain.repair2 ? [{ folder: NEW_BOOK_STORYBOARD_REPAIR_2.outDir, rules: REPAIR_API_RULES }] : [])];
}
const tokenCount = z.number().int().nonnegative().max(1_000_000_000);
/** Guy's attestation: what his provider usage records show for the timed-out call's day and model, within the scope he names. */
export const carryAttestationSchema = z.object({ version: z.literal('new-book-carry-attestation/v1'),
  attestedBy: z.string().trim().min(1).max(200), source: z.string().trim().min(1).max(500), scope: z.string().trim().min(1).max(500),
  day: z.literal(NEW_BOOK_CARRY_RESOLUTION.day), model: z.literal(CAUSAL_MODELS.astra),
  dayTotal: z.object({ requests: z.number().int().nonnegative().max(10_000), inputTokens: tokenCount, outputTokens: tokenCount }).strict(),
  note: z.string().max(2000).optional() }).strict();
export type CarryAttestation = z.infer<typeof carryAttestationSchema>;
const knownCallSchema = z.object({ folder: z.string().min(1), step: z.literal('storyboard'), wireDigest: hash, createdAt: z.string().min(1),
  inputTokens: tokenCount, outputTokens: tokenCount, estimatedMicroUsd: z.number().int().nonnegative() }).strict();
const resolutionSchema = z.object({ version: z.literal('new-book-carry-resolution/v1'), id: z.literal(NEW_BOOK_CARRY_RESOLUTION.id),
  slot: z.literal(NEW_BOOK_EXPERIMENT.slot), approval: z.literal(NEW_BOOK_CARRY_RESOLUTION.approval), claimSha256: hash, configSha256: hash,
  sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  timedOut: z.object({ folder: z.literal('text'), step: z.literal('storyboard'), claimSha256: hash, wireDigest: hash,
    maximumMicroUsd: z.number().int().positive(), maxOutputTokens: z.number().int().positive() }).strict(),
  attestation: carryAttestationSchema, knownSameDay: z.array(knownCallSchema).max(16),
  resolved: z.object({ requests: z.union([z.literal(0), z.literal(1)]), inputTokens: tokenCount, outputTokens: tokenCount,
    microUsd: z.number().int().nonnegative() }).strict() }).strict();
export const experimentCarryResolutionFile = (config: NewBookConfig) =>
  path.join(path.dirname(experimentClaimFile(config)), `${NEW_BOOK_EXPERIMENT.slot}.${NEW_BOOK_CARRY_RESOLUTION.id}.json`);
type CarryResolution = { file: string; sha256: string; resolvedMicroUsd: number; carriedBeforeMicroUsd: number; record: z.infer<typeof resolutionSchema> };

/** This book's answered storyboard calls (the timed-out call's model), each re-derived from its raw answer first, with the provider's own creation time. */
function astraCalls(config: NewBookConfig, folders: StageFolder[]) {
  const dir = experimentDir(config);
  return folders.flatMap(({ folder, rules }) => {
    verifyPaidStages(path.join(dir, folder), rules);
    const at = (k: string) => path.join(dir, folder, 'paid-stages', `storyboard.${k}.json`);
    if (!existsSync(at('claim')) || read(at('result')).completed !== true) return [];
    const claim = read(at('claim')), receipt = read(at('receipt')), raw = receipt?.raw;
    const created = Number.isSafeInteger(raw?.created_at) ? new Date(raw.created_at * 1000) : null;
    // A call that cannot be placed on a day cannot be told apart from the timed-out one.
    if (raw?.model !== CAUSAL_MODELS.astra || !created || Number.isNaN(created.getTime())) return fail('new_book_carry_attestation');
    return [{ folder, step: 'storyboard' as const, wireDigest: claim.wireDigest as string, createdAt: created.toISOString(),
      inputTokens: raw.usage.input_tokens as number, outputTokens: raw.usage.output_tokens as number, estimatedMicroUsd: receipt.estimatedMicroUsd as number }];
  });
}
/**
 * The timed-out call's charge from Guy's attestation. The day's totals for the model, minus this book's own answered calls that day, are that
 * one call - one request whose input is exactly the identical request's own (as this book's re-sent copy measured it) and whose output is within
 * its cap - or nothing at all (no request, no tokens). Anything else cannot be attributed: another request in the scope, a negative remainder.
 */
function deriveCarryResolution(config: NewBookConfig, attestation: CarryAttestation, folders: StageFolder[]) {
  const textDir = path.join(experimentDir(config), 'text'), root = path.join(textDir, 'paid-stages');
  // The timed-out call exactly as the failed stage left it: unknown cost, its whole reservation carried, its records re-derived.
  const failed = failedStoryboardLedger(textDir);
  const claimBytes = readFileSync(path.join(root, 'storyboard.claim.json')), claim = JSON.parse(claimBytes.toString('utf8'));
  const wire = read(path.join(root, 'storyboard.wire.json'));
  if (wire.model !== attestation.model || failed.carriedUnresolvedMicroUsd !== claim.maximumMicroUsd) fail('new_book_carry_resolution_scope');
  const calls = astraCalls(config, folders), knownSameDay = calls.filter(c => c.createdAt.slice(0, 10) === attestation.day);
  const sum = (k: 'inputTokens' | 'outputTokens') => knownSameDay.reduce((total, c) => total + c[k], 0);
  const rest = { requests: attestation.dayTotal.requests - knownSameDay.length, inputTokens: attestation.dayTotal.inputTokens - sum('inputTokens'),
    outputTokens: attestation.dayTotal.outputTokens - sum('outputTokens') };
  if (rest.requests < 0 || rest.inputTokens < 0 || rest.outputTokens < 0) fail('new_book_carry_attestation');
  if (rest.requests > 1) fail('new_book_carry_ambiguous');
  const identicalInput = [...new Set(calls.filter(c => c.wireDigest === claim.wireDigest).map(c => c.inputTokens))];
  if (rest.requests === 0 ? rest.inputTokens !== 0 || rest.outputTokens !== 0
    : identicalInput.length !== 1 || rest.inputTokens !== identicalInput[0] || rest.outputTokens > wire.max_output_tokens) fail('new_book_carry_attestation');
  const microUsd = Math.ceil(rest.inputTokens * RATES.astra.inputMicroUsdPerToken + rest.outputTokens * RATES.astra.outputMicroUsdPerToken);
  if (!Number.isSafeInteger(microUsd) || microUsd > claim.maximumMicroUsd) fail('new_book_carry_attestation');
  return { timedOut: { folder: 'text' as const, step: 'storyboard' as const, claimSha256: sha(claimBytes), wireDigest: claim.wireDigest as string,
      maximumMicroUsd: claim.maximumMicroUsd as number, maxOutputTokens: wire.max_output_tokens as number },
    knownSameDay, resolved: { requests: rest.requests as 0 | 1, inputTokens: rest.inputTokens, outputTokens: rest.outputTokens, microUsd } };
}
/** The recorded resolution (null when none), re-derived in full from its attestation and this book's own records. */
function readCarryResolution(config: NewBookConfig, claimSha256: string, folders: StageFolder[]): CarryResolution | null {
  const file = experimentCarryResolutionFile(config);
  if (!existsSync(file)) return null;
  const parsed = resolutionSchema.safeParse(read(file));
  if (!parsed.success || parsed.data.claimSha256 !== claimSha256 || parsed.data.configSha256 !== sha(canonicalJson(config))) return fail('new_book_carry_resolution');
  const { timedOut, knownSameDay, resolved } = deriveCarryResolution(config, parsed.data.attestation, folders);
  if (canonicalJson({ timedOut, knownSameDay, resolved }) !==
      canonicalJson({ timedOut: parsed.data.timedOut, knownSameDay: parsed.data.knownSameDay, resolved: parsed.data.resolved })) fail('new_book_carry_resolution');
  return { file, sha256: sha(readFileSync(file)), resolvedMicroUsd: resolved.microUsd, carriedBeforeMicroUsd: timedOut.maximumMicroUsd, record: parsed.data };
}
/** A ledger with a resolution applied: the reservation it resolves leaves the accounting and the attested charge enters known spend. */
function resolvedLedger(ledger: { knownMicroUsd: number; carriedUnresolvedMicroUsd: number }, resolution: CarryResolution | null) {
  if (!resolution) return { knownMicroUsd: ledger.knownMicroUsd, carriedUnresolvedMicroUsd: ledger.carriedUnresolvedMicroUsd };
  if (ledger.carriedUnresolvedMicroUsd !== resolution.carriedBeforeMicroUsd) return fail('new_book_carry_resolution');
  return { knownMicroUsd: ledger.knownMicroUsd + resolution.resolvedMicroUsd, carriedUnresolvedMicroUsd: 0 };
}
/**
 * The resolution's admission at ONE pinned HEAD (no provider, no key): the clean source; the unchanged claim and its whole amendment chain; no
 * repair amendment, child stage or audition yet (a resolution is never retroactive); the original request re-derived from the roots (the
 * reservation resolved is that request's); the latest verified ledger; and the charge derived from the attestation.
 */
async function admitCarryResolution(config: NewBookConfig, head: string, attestationFile: string) {
  let attestation: CarryAttestation;
  try { attestation = carryAttestationSchema.parse(JSON.parse(fencedText(attestationFile, 64000))); } catch { return fail('new_book_carry_attestation'); }
  const baseline = () => {
    assertExperimentSource(config, head);
    const { claimSha256 } = verifiedClaim(config), continuation = readContinuation(config, claimSha256);
    if (!continuation) return fail('new_book_carry_resolution_scope');
    const refused = readRefusedChain(config, claimSha256, continuation), dir = experimentDir(config);
    if (readRepair(config, claimSha256, continuation, refused) || existsSync(path.join(dir, NEW_BOOK_STORYBOARD_REPAIR.outDir)) ||
        existsSync(path.join(dir, 'child')) || existsSync(experimentAuditionStart(config))) fail('new_book_carry_resolution_late');
    const chain: ContinuationChain = { continuation, refused, repair: null, repair2: null }, before = textStage(config, chain);
    const derived = deriveCarryResolution(config, attestation, chainFolders(chain));
    if (before.carriedUnresolvedMicroUsd !== derived.timedOut.maximumMicroUsd) fail('new_book_carry_resolution_scope');
    return { claimSha256, before, derived, evidence: before.evidence };
  };
  const admitted = baseline();
  // The admission, compared and never adopted: the same pin, still clean, and the same records, ledger and derivation (synchronous).
  const same = () => { if (canonicalJson(baseline()) !== canonicalJson(admitted)) fail('new_book_continuation_evidence'); };
  await assertOriginalRequest(config);
  // The replay was asynchronous.
  same();
  const { before, derived } = admitted, cap = NEW_BOOK_EXPERIMENT.apiCapMicroUsd;
  // As resolvedLedger applies it at every later read: the carried reservation (checked equal above) out, the attested charge in.
  const after = { knownMicroUsd: before.knownMicroUsd + derived.resolved.microUsd, carriedUnresolvedMicroUsd: 0 };
  const record = resolutionSchema.parse({ version: 'new-book-carry-resolution/v1', id: NEW_BOOK_CARRY_RESOLUTION.id, slot: NEW_BOOK_EXPERIMENT.slot,
    approval: NEW_BOOK_CARRY_RESOLUTION.approval, claimSha256: admitted.claimSha256, configSha256: sha(canonicalJson(config)), sourceHead: head,
    timedOut: derived.timedOut, attestation, knownSameDay: derived.knownSameDay, resolved: derived.resolved });
  return { record, same, summary: { recorded: existsSync(experimentCarryResolutionFile(config)), day: attestation.day, model: attestation.model, scope: attestation.scope,
    knownSameDay: derived.knownSameDay.map(c => ({ folder: c.folder, createdAt: c.createdAt, inputTokens: c.inputTokens, outputTokens: c.outputTokens })),
    timedOutCall: { requests: derived.resolved.requests, inputTokens: derived.resolved.inputTokens, outputTokens: derived.resolved.outputTokens,
      chargeMicroUsd: derived.resolved.microUsd },
    carriedBeforeMicroUsd: derived.timedOut.maximumMicroUsd,
    ledgerBefore: { knownMicroUsd: before.knownMicroUsd, carriedUnresolvedMicroUsd: before.carriedUnresolvedMicroUsd,
      remainingUnderCapMicroUsd: cap - before.knownMicroUsd - before.carriedUnresolvedMicroUsd },
    ledgerAfter: { ...after, remainingUnderCapMicroUsd: cap - after.knownMicroUsd - after.carriedUnresolvedMicroUsd },
    providerCalls: 0, keyRead: false } };
}
/** Read-only preview of the resolution: what it would record and the ledger before and after. */
export async function previewCarryResolution(config: NewBookConfig, attestationFile: string) {
  return (await admitCarryResolution(config, currentHead(config), attestationFile)).summary;
}
/** Records the resolution once (exclusive), right after its admission at the same pinned HEAD. */
export async function writeCarryResolution(config: NewBookConfig, attestationFile: string) {
  const { record, same, summary } = await admitCarryResolution(config, currentHead(config), attestationFile);
  // That await is a scheduling boundary after the admission's last check: the same admission is re-checked synchronously, immediately
  // before the one-shot write (a moved HEAD, a dirty tree or any changed record, ledger or derivation refuses; nothing is written).
  same();
  try { exclusiveJson(experimentCarryResolutionFile(config), record); } catch { fail('new_book_carry_resolution_used'); }
  return { ...summary, recorded: true };
}

// ---------------------------------------------------------------------------------------------------------------
// Guy's one storyboard repair (a fourth amendment of the claim): the third attempt's storyboard answered and compiled, but its review held it.
// The same story is replayed, the third attempt's two answers are replayed to that exact held disposition, and the third request is sent ONCE
// more with exactly the repair contract added; the same compiler and a fresh review judge the result.
// ---------------------------------------------------------------------------------------------------------------
export const experimentRepairFile = (config: NewBookConfig) =>
  path.join(path.dirname(experimentClaimFile(config)), `${NEW_BOOK_EXPERIMENT.slot}.continuation-4.json`);
const heldStatus = z.enum(['held_uncertain', 'held_contradiction']);
const repairSchema = z.object({ version: z.literal('new-book-continuation/v1'), id: z.literal(NEW_BOOK_STORYBOARD_REPAIR.id),
  slot: z.literal(NEW_BOOK_EXPERIMENT.slot), approval: z.literal(NEW_BOOK_STORYBOARD_REPAIR.approval), claimSha256: hash, configSha256: hash,
  previousSha256: hash, originalSourceHead: headSha, previousSourceHead: headSha, sourceHead: headSha, failedStep: z.literal('storyboard_review_held'),
  previousStatus: heldStatus, parentStoryboardDigest: hash, carryResolutionSha256: hash.nullable(),
  priorKnownApiMicroUsd: z.number().int().nonnegative(), carriedUnresolvedMicroUsd: z.number().int().nonnegative(),
  // The planner this one repair uses (Guy's decision), the exact request it is admitted for, and its separate Claude Max accounting.
  planner: z.object({ model: z.literal(OPUS_PLANNER.model), route: z.literal(OPUS_PLANNER.route), judge: z.literal(SOL),
    approval: z.literal(NEW_BOOK_STORYBOARD_REPAIR.planner.approval), executableSha256: hash,
    sessionGuardMicroUsd: z.literal(OPUS_PLANNER.sessionGuardMicroUsd), requestDigest: hash,
    priorClaudeMaxMicroUsd: z.number().int().nonnegative() }).strict(),
  evidence: z.array(z.object({ file: z.string().regex(new RegExp(`^${NEW_BOOK_CONTINUATION_3.outDir}/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)?$`)), sha256: hash })
    .strict()).min(4).max(32) }).strict();
export type NewBookRepair = z.infer<typeof repairSchema>;
/**
 * This book's earlier Claude Max use (the original author and editor; no continuation called Claude Max), re-derived from its own journal,
 * which must equal its saved spend record. The repair's Max journal starts from it, so the Max value stays cumulative and truthful.
 */
function priorClaudeMax(config: NewBookConfig) {
  const dir = experimentDir(config), text = path.join(dir, 'text');
  const snapshot = new SimpleBookBudget(path.join(text, 'claude-max-stages'), 0).snapshot(), spend = path.join(text, 'claude-max-spend.json');
  if (!existsSync(spend) || canonicalJson(read(spend)) !== canonicalJson({ ...snapshot, note: NEW_BOOK_EXPERIMENT.claudeMax }) || snapshot.stopped ||
      snapshot.unknownAttemptCosts) return fail('new_book_planner_record');
  if ([NEW_BOOK_CONTINUATION, ...REFUSED_STEPS.map(s => s.spec)].some(s => existsSync(path.join(dir, s.outDir, 'claude-max-stages')))) fail('new_book_planner_record');
  return snapshot.accountedMicroUsd;
}
/** The fixed planner flags of prepareOpusStoryboardWire, for a saved wire whose call is not at hand (its schema and prompt file as recorded). */
const plannerArgs = (instructionFile: string, schema: string) => ['-p', '--safe-mode', '--model', OPUS_PLANNER.model, '--effort', OPUS_PLANNER.effort,
  '--tools', '', '--no-session-persistence', '--output-format', 'json', '--max-budget-usd', String(OPUS_PLANNER.sessionGuardMicroUsd / 1e6),
  '--system-prompt-file', instructionFile, '--json-schema', schema];
/**
 * A repair's planner evidence (its Claude Max journal), re-derived like any paid record: exactly the planner's own four records; the claim
 * binding its wire, at the session guard; the wire on the planner's route, flags, model and pinned executable, carrying exactly the admitted
 * request (its content digest); the CLI's own raw answer settling to the recorded cost (its one reported model, usage, success and confirmed
 * termination); the decoded structured answer (under that repair's contracts) exactly the saved draft; and the spend record equal to the
 * journal from the earlier Max use. Returns the spend record and the journal's cumulative accounted total (the next repair's prior).
 */
function verifyRepairPlanner(config: NewBookConfig, out: string,
  planner: { executableSha256: string; requestDigest: string; priorClaudeMaxMicroUsd: number }, contracts: TextContracts) {
  const root = path.join(out, 'claude-max-stages'), at = (k: string) => path.join(root, `storyboard.${k}.json`);
  if (!existsSync(root) || canonicalJson(readdirSync(root).sort()) !== canonicalJson(['claim', 'receipt', 'result', 'wire'].map(k => `storyboard.${k}.json`))) fail('new_book_planner_record');
  const [claim, wire, result, receipt] = ['claim', 'wire', 'result', 'receipt'].map(k => read(at(k)));
  const snapshot = new SimpleBookBudget(root, planner.priorClaudeMaxMicroUsd).snapshot(), spend = path.join(out, 'claude-max-spend.json');
  if (!existsSync(spend) || canonicalJson(read(spend)) !== canonicalJson({ ...snapshot, note: NEW_BOOK_EXPERIMENT.claudeMax })) fail('new_book_planner_record');
  const args = Array.isArray(wire?.args) ? wire.args : [], schema = typeof args[args.length - 1] === 'string' ? args[args.length - 1] : '';
  if (claim.step !== 'storyboard' || claim.maximumMicroUsd !== OPUS_PLANNER.sessionGuardMicroUsd || claim.wireDigest !== sha(canonicalJson(wire)) ||
      result.wireDigest !== claim.wireDigest || result.completed !== true || wire.role !== 'opus' || wire.stage !== 'storyboard' ||
      wire.model !== OPUS_PLANNER.model || wire.json !== JSON.stringify(wire.payload) || wire.digest !== sha(wire.json) ||
      canonicalJson(args) !== canonicalJson(plannerArgs(String(wire.payload?.instructionFile), schema)) || canonicalJson(wire.payload?.args) !== canonicalJson(args) ||
      wire.payload?.stdin !== wire.stdin || wire.payload?.executableSha256 !== planner.executableSha256 ||
      planner.executableSha256 !== config.executableSha256 ||
      previewSha(canonicalJson({ instructions: wire.payload?.instructions, input: wire.stdin, maxOutputTokens: wire.outputCap, schema: JSON.parse(schema || 'null') }))
        !== planner.requestDigest) fail('new_book_planner_record');
  // The CLI's raw answer, settled here as the transport settled it live.
  let parsed: any = null;
  try { parsed = JSON.parse(String(receipt?.raw?.stdout)); } catch { fail('new_book_planner_cost'); }
  const termination = receipt?.raw?.termination, modelKeys = Object.keys(parsed?.modelUsage ?? {}), modelUsage = parsed?.modelUsage?.[OPUS_PLANNER.model];
  const usage = safeUsage(modelUsage ? { inputTokens: modelUsage.inputTokens, outputTokens: modelUsage.outputTokens } : null);
  const cost = parsed?.total_cost_usd, micro = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? Math.ceil(cost * 1e6) : null;
  if (micro === null || !usage || micro !== result.estimatedMicroUsd || micro !== receipt.estimatedMicroUsd || micro > claim.maximumMicroUsd ||
      canonicalJson(receipt.usage) !== canonicalJson(usage) || modelKeys.length !== 1 || modelKeys[0] !== OPUS_PLANNER.model ||
      parsed.is_error !== false || parsed.subtype !== 'success' || !parsed.structured_output || termination?.code !== 0 || termination?.signal ||
      termination?.spawnError || receipt?.raw?.killConfirmed !== true || receipt?.raw?.stopped !== false) fail('new_book_planner_cost');
  // Its structured answer, decoded by the live decoder (this repair's contracts, its book's own source), is exactly the saved draft.
  const book = read(path.join(out, 'visual_simple_book_result.json'))?.storyboard?.storyboard, draft = read(path.join(out, 'owned_storyboard_draft.json'));
  let decoded: unknown = null;
  try { decoded = decodePersonalBookProviderOutput({ stage: 'storyboard', instructions: '', input: '', maxOutputTokens: wire.outputCap,
    context: { narrativeSpreads: book?.narrativeSpreads, sourceDigest: book?.sourceDigest, actorOwnedAppearance: contracts.actorOwnedAppearance,
      momentContract: contracts.momentContract, landmarkKindContract: contracts.landmarkKindContract,
      ...(contracts.drawnInstantContract ? { drawnInstantContract: true } : {}) } } as never, parsed.structured_output); }
  catch { fail('new_book_planner_record'); }
  if (canonicalJson(decoded) !== canonicalJson(draft) || canonicalJson(receipt.output) !== canonicalJson(draft)) fail('new_book_planner_record');
  return { file: spend, sha256: sha(readFileSync(spend)), knownMicroUsd: snapshot.knownEstimateMicroUsd, accountedMicroUsd: snapshot.accountedMicroUsd };
}
const thirdAmendmentFile = (config: NewBookConfig) => refusedFile(config, REFUSED_STEPS[REFUSED_STEPS.length - 1]);
/** The recorded repair amendment (null when none), verified against the third amendment, every record of the third attempt and the resolution it names. */
function readRepair(config: NewBookConfig, claimSha256: string, first: NewBookContinuation | null,
  refused: { step: RefusedStep; amendment: NewBookRefusedContinuation }[]): NewBookRepair | null {
  const file = experimentRepairFile(config);
  if (!existsSync(file)) return null;
  // It amends the third attempt: the whole earlier chain must be there.
  if (!first || refused.length !== REFUSED_STEPS.length) return fail('new_book_continuation');
  const previous = refused[refused.length - 1].amendment, parsed = repairSchema.safeParse(read(file));
  if (!parsed.success || parsed.data.claimSha256 !== claimSha256 || parsed.data.configSha256 !== sha(canonicalJson(config)) ||
      parsed.data.originalSourceHead !== config.sourceHead || parsed.data.previousSourceHead !== previous.sourceHead ||
      parsed.data.previousSha256 !== sha(readFileSync(thirdAmendmentFile(config)))) return fail('new_book_continuation');
  if (canonicalJson(folderEvidence(experimentDir(config), NEW_BOOK_CONTINUATION_3.outDir)) !== canonicalJson(parsed.data.evidence)) fail('new_book_continuation_evidence');
  // The resolution it names is the one beside the claim, unchanged; naming none, none may exist (a resolution is never retroactive).
  const resolution = experimentCarryResolutionFile(config);
  if (parsed.data.carryResolutionSha256 === null ? existsSync(resolution)
    : !existsSync(resolution) || sha(readFileSync(resolution)) !== parsed.data.carryResolutionSha256) fail('new_book_carry_resolution');
  return parsed.data;
}
type RepairBaseline = { claimSha256: string; previous: NewBookRefusedContinuation; previousSha256: string; amended: NewBookRepair | null;
  status: z.infer<typeof heldStatus>; held: ReturnType<typeof textStage>; resolution: CarryResolution | null;
  ledger: { knownMicroUsd: number; carriedUnresolvedMicroUsd: number }; evidence: ReturnType<typeof folderEvidence> };
/**
 * The repair's admission baseline at ONE pinned HEAD (compared, never adopted): the clean source first; the unchanged claim and its whole chain;
 * once amended, its own HEAD equal to the pin; the failed text stage and the complete request record; the third attempt sealed held by its own
 * review with exactly its storyboard and review answered; every ledger re-derived from evidence; the resolution (if recorded) re-derived and
 * applied; and every record of the third attempt by hash.
 */
function repairBaseline(config: NewBookConfig, head: string, prepared: ReturnType<typeof prepareSimpleStory>): RepairBaseline {
  assertExperimentSource(config, head);
  const { claim, claimSha256 } = verifiedClaim(config);
  const first = readContinuation(config, claimSha256);
  if (!first) return fail('new_book_continuation_scope');
  const refused = readRefusedChain(config, claimSha256, first);
  if (refused.length !== REFUSED_STEPS.length) fail('new_book_continuation_scope');
  const amended = readRepair(config, claimSha256, first, refused);
  if (amended && amended.sourceHead !== head) fail('new_book_source_changed');
  const dir = experimentDir(config), third = path.join(dir, NEW_BOOK_CONTINUATION_3.outDir), root = path.join(third, 'paid-stages');
  if (sealedStatus(path.join(dir, 'text')) !== 'failed') fail('new_book_continuation_scope');
  assertRequestRecord(dir, claim, prepared);
  const sealed = existsSync(path.join(third, 'sealed.json')) ? read(path.join(third, 'sealed.json')) : null, status = heldStatus.safeParse(sealed?.status);
  if (!status.success || sealed.continuation !== NEW_BOOK_CONTINUATION_3.id || !existsSync(root)) return fail('new_book_continuation_scope');
  const claims = readdirSync(root).filter(n => n.endsWith('.claim.json')).map(n => n.slice(0, -'.claim.json'.length)).sort();
  if (canonicalJson(claims) !== canonicalJson(['storyboard', 'storyboard_review']) ||
      claims.some(step => read(path.join(root, `${step}.result.json`)).completed !== true)) fail('new_book_continuation_scope');
  const chain: ContinuationChain = { continuation: first, refused, repair: null, repair2: null };
  const held = textStage(config, chain), resolution = readCarryResolution(config, claimSha256, chainFolders(chain));
  if (amended && amended.carryResolutionSha256 !== (resolution?.sha256 ?? null)) fail('new_book_carry_resolution');
  return { claimSha256, previous: refused[refused.length - 1].amendment, previousSha256: sha(readFileSync(thirdAmendmentFile(config))), amended,
    status: status.data, held, resolution, ledger: resolvedLedger(held, resolution), evidence: folderEvidence(dir, NEW_BOOK_CONTINUATION_3.outDir) };
}
function sameRepairBaseline(config: NewBookConfig, head: string, prepared: ReturnType<typeof prepareSimpleStory>, admitted: RepairBaseline) {
  const now = repairBaseline(config, head, prepared);
  if (now.claimSha256 !== admitted.claimSha256 || now.previousSha256 !== admitted.previousSha256 || now.resolution?.sha256 !== admitted.resolution?.sha256 ||
      canonicalJson(now.ledger) !== canonicalJson(admitted.ledger) || canonicalJson(now.evidence) !== canonicalJson(admitted.evidence)) fail('new_book_continuation_evidence');
  return now;
}
/**
 * The repair's admission (no provider, no key): the baseline; the original request re-derived; the third attempt's two saved answers replayed
 * under its own contracts - exactly its two requests, each cost re-derived from its raw answer under the live rule - to exactly the held
 * disposition it was sealed with; the repair input those answers derive (the held draft, its own raw review); and the repair request, which must
 * be the third request with exactly the repair added: the contract last in the instructions (before the provider's own note), the held storyboard
 * and its review's unsupported checks in the planning input, and the source digest that records them, at the same model, schema and caps.
 */
/**
 * The repair's input and its planner request as the accepted roots derive them NOW (no provider, no key, nothing written): the paid story
 * replayed from its bound receipts; the held third attempt's two saved answers replayed under its own contracts - exactly its two requests in
 * order, each cost re-derived from its raw answer under the live rule - to a held storyboard whose decoded draft (equal to the draft the
 * attempt saved) and own raw review are the repair input; then the repair request the engine builds from them, which must be the third
 * request with exactly the repair added (compared in the third request's own provider form), and its complete CLI wire under the pinned policy
 * at the repair folder's own prompt file. The admission and every later reader of the repaired storyboard derive exactly this; no recorded
 * declaration (an amendment's digest, a saved wire) is ever its authority.
 */
async function deriveRepairRequest(config: NewBookConfig, prepared: ReturnType<typeof prepareSimpleStory>,
  options: ReturnType<typeof prepareExperimentRequest>['options']) {
  const dir = experimentDir(config), textDir = path.join(dir, 'text'), third = path.join(dir, NEW_BOOK_CONTINUATION_3.outDir);
  const policy = textPolicy(config), replay = textReplay(textDir);
  const saved = (step: 'storyboard' | 'storyboard_review') => {
    const [claim, wire, result, receipt] = ['claim', 'wire', 'result', 'receipt'].map(k => read(path.join(third, 'paid-stages', `${step}.${k}.json`)));
    if (previewSha(canonicalJson(wire)) !== claim.wireDigest || result.wireDigest !== claim.wireDigest || result.completed !== true ||
        receipt?.estimatedMicroUsd !== result.estimatedMicroUsd || typeof receipt?.raw?.output_text !== 'string') fail('new_book_continuation_replay');
    return { claim, wire, result, receipt };
  };
  const answers = { storyboard: saved('storyboard'), storyboard_review: saved('storyboard_review') };
  let refusal: unknown = null, stop: string | null = null;
  const replayed = <T>(f: () => T) => { try { return f(); } catch (error) { refusal ??= error; throw error; } };
  const halt = (code: string): never => { stop ??= code; throw new NewBookExperimentError(code); };
  const story = (repair: StoryboardRepair | undefined, visual: (call: SimpleStoryboardDiagnosticCall) => Promise<unknown>) =>
    runSimpleWizardBook({ request: prepared.accepted.canonical, options, seed: config.seed, signal: new AbortController().signal,
      reservedWritingUsd: 4, ...NEW_BOOK_STORYBOARD_REPAIR.contracts, ...(repair ? { storyboardRepair: repair } : {}), publish: () => {},
      opus: async call => { const d = storyDispatch(call, 'opus', prepared.accepted.requestId);
        return replayed(() => replay.opus(d, prepareCausalWire(d, policy, 2000000, path.join(textDir, `${call.stage}-instructions.txt`)))); },
      reader: async call => { const d = storyDispatch(call, 'astra', prepared.accepted.requestId);
        return replayed(() => replay.reader(d, prepareCausalWire(d, policy, 2000000))); },
      visual });
  // 1. The third attempt's saved answers, in order, under its own contracts and exactly its requests, each settled from its raw answer.
  const settled: number[] = [];
  let draft: unknown = null, thirdSource: string | null = null, thirdInstructions: string | null = null;
  const replayedThird = await story(undefined, async call => {
    const step = visualStep(call), a = answers[step], payload = simpleWizardVisualPayload(call, SOL);
    if (settled.length !== (step === 'storyboard' ? 0 : 1) || previewSha(canonicalJson(payload)) !== a.claim.wireDigest) return halt('new_book_continuation_replay');
    const s = visualSettlement(call, payload, a.receipt.raw);
    if (!s.valid || s.estimatedMicroUsd === null || s.estimatedMicroUsd !== a.result.estimatedMicroUsd || canonicalJson(a.receipt.usage) !== canonicalJson(s.usage) ||
        a.receipt.model !== a.receipt.raw.model || a.receipt.stage !== step) return halt('new_book_continuation_cost');
    settled.push(s.estimatedMicroUsd);
    const output = decodePersonalBookProviderOutput(call, JSON.parse(a.receipt.raw.output_text));
    if (step === 'storyboard') { draft = output; thirdSource = call.context.sourceDigest; thirdInstructions = call.instructions; }
    return output;
  }).catch((error: unknown) => { throw refusal ?? (stop ? new NewBookExperimentError(stop) : error); });
  // The third attempt's storyboard and review as the flow judged them again: a held parent.
  const heldBoard = replayedThird.storyboard;
  if (settled.length !== 2 || !heldBoard || replayedThird.status !== heldBoard.status || !heldStatus.safeParse(heldBoard.status).success) return fail('new_book_continuation_scope');
  // The draft the attempt saved is the one its answer decodes to.
  if (canonicalJson(read(path.join(third, 'owned_storyboard_draft.json'))) !== canonicalJson(draft)) fail('new_book_continuation_replay');
  const repair: StoryboardRepair = { parentStoryboardDigest: heldBoard.storyboardDigest, draft: structuredClone(draft), review: structuredClone(heldBoard.rawReview) };
  const prior = { version: STORYBOARD_REPAIR_VERSION, parentStoryboardDigest: repair.parentStoryboardDigest, storyboard: repair.draft,
    reviewFindings: storyboardRepairFindings(heldBoard.review.review) };
  // 2. The repair request: the third one with exactly the repair added (the engine's request, whichever transport carries it; compared in
  //    the third request's own provider form), and its planner wire on the Claude Max route, built here exactly as the run builds it.
  const thirdWire = answers.storyboard.wire, instructionFile = path.join(dir, NEW_BOOK_STORYBOARD_REPAIR.outDir, 'storyboard-instructions.txt');
  let reached = false, onlyTheRepair = false, plannerFailure: unknown = null, planner = null as { requestDigest: string; wire: PlannerWire } | null;
  await story(repair, async call => {
    reached = true;
    const payload = simpleWizardVisualPayload(call, SOL), source = call.context.sourceDigest;
    // The CLI wire's own limits (argv, wire bytes, the session guard) are checked offline here, before anything is consumed.
    try { planner = { requestDigest: plannerRequestDigest(call), wire: prepareOpusStoryboardWire(call, textPolicy(config), instructionFile) }; }
    catch (error) { plannerFailure = error; }
    const { priorReviewedStoryboard, ...input } = JSON.parse(payload.input), thirdInput = JSON.parse(thirdWire.input);
    onlyTheRepair = call.stage === 'storyboard' && !!thirdSource && !!thirdInstructions && source !== thirdSource &&
      canonicalJson(thirdWire).split(thirdSource).length === 2 && thirdInput.personalSourceDigest === thirdSource &&
      canonicalJson(input) === canonicalJson({ ...thirdInput, personalSourceDigest: source }) && canonicalJson(priorReviewedStoryboard) === canonicalJson(prior) &&
      payload.input === canonicalJson(JSON.parse(payload.input)) && call.instructions === `${thirdInstructions}\n${REPAIR_STORYBOARD_ADDENDUM}` &&
      thirdWire.instructions.startsWith(thirdInstructions) &&
      canonicalJson(payload) === canonicalJson({ ...thirdWire, input: payload.input, instructions: call.instructions + thirdWire.instructions.slice(thirdInstructions.length) });
    throw new NewBookExperimentError('new_book_continuation_preview_stop');
  }).catch((error: unknown) => { if (!reached) throw refusal ?? error; });
  if (!reached) fail('new_book_continuation_scope');
  if (!onlyTheRepair) return fail('new_book_continuation_request');
  if (plannerFailure || !planner) throw plannerFailure ?? new NewBookExperimentError('new_book_planner_wire');
  const plan: { requestDigest: string; wire: PlannerWire } = planner;
  return { settled, status: heldStatus.parse(heldBoard.status), repair, findings: prior.reviewFindings.length, plan };
}
async function admitRepair(config: NewBookConfig, head: string) {
  const { options, prepared } = prepareExperimentRequest(config);
  const baseline = repairBaseline(config, head, prepared);
  // The carried (or resolved) reservation is admitted only for the original request the roots derive.
  await assertOriginalRequest(config);
  const dir = experimentDir(config);
  const { settled, status, repair, findings, plan } = await deriveRepairRequest(config, prepared, options);
  // As the third attempt was sealed: its held disposition, and its two settled costs in the verified ledger.
  if (status !== baseline.status || baseline.held.knownMicroUsd !== baseline.previous.priorKnownApiMicroUsd + settled[0] + settled[1]) return fail('new_book_continuation_scope');
  // Guy's condition on this route: the planner is not an API call (Claude Max, journaled apart under its own session guard), so the API
  // meter needs only the fresh review's largest possible reservation within what remains, with the whole unresolved carry kept; the Max
  // journal (from this book's earlier Max use) must hold the planner's session guard.
  const reviewCeiling = wireReservation(VISUAL_WIRE_LIMIT, personalBookOutputLimits(prepared.book.pages).reviewOutputTokens, RATES.sol);
  const remaining = NEW_BOOK_EXPERIMENT.apiCapMicroUsd - baseline.ledger.knownMicroUsd - baseline.ledger.carriedUnresolvedMicroUsd;
  const maxBefore = priorClaudeMax(config), fits = reviewCeiling <= remaining && maxBefore + OPUS_PLANNER.sessionGuardMicroUsd <= CLAUDE_MAX_JOURNAL_CAP;
  // Both replays were asynchronous: the same pinned HEAD, still clean, and exactly the records they used.
  sameRepairBaseline(config, head, prepared, baseline);
  const args = plan.wire.args;
  return { prepared, options, repair, planner: { requestDigest: plan.requestDigest, priorClaudeMaxMicroUsd: maxBefore },
    admitted: { baseline, fits, summary: { admissible: true, amended: !!baseline.amended,
    outDirExists: existsSync(path.join(dir, NEW_BOOK_STORYBOARD_REPAIR.outDir)), storyReplayed: true, previousStatus: baseline.status,
    previousStoryboardSettledMicroUsd: settled[0], previousReviewSettledMicroUsd: settled[1], parentStoryboardDigest: repair.parentStoryboardDigest,
    findings, requestChangedOnlyByTheRepair: true,
    planner: { model: OPUS_PLANNER.model, route: OPUS_PLANNER.route, judge: SOL, requestDigest: plan.requestDigest,
      wireBytes: plan.wire.bytes, wireByteLimit: textPolicy(config).maxWireBytes, argvChars: args.map(a => JSON.stringify(a)).join(' ').length + config.executable.length,
      argvCharLimit: 31_000, schemaChars: args[args.length - 1].length, stdinBytes: Buffer.byteLength(plan.wire.stdin, 'utf8'),
      instructionsBytes: Buffer.byteLength(String(plan.wire.payload.instructions), 'utf8'), outputCap: plan.wire.outputCap,
      sessionGuardMicroUsd: OPUS_PLANNER.sessionGuardMicroUsd, wireReservationMicroUsd: plan.wire.reservedMicroUsd,
      priorClaudeMaxMicroUsd: maxBefore, apiChargeMicroUsd: 0 },
    reviewReservationCeilingMicroUsd: reviewCeiling,
    carryResolution: baseline.resolution ? { sha256: baseline.resolution.sha256, resolvedMicroUsd: baseline.resolution.resolvedMicroUsd,
      carriedBeforeMicroUsd: baseline.resolution.carriedBeforeMicroUsd } : null,
    priorKnownApiMicroUsd: baseline.ledger.knownMicroUsd, carriedUnresolvedMicroUsd: baseline.ledger.carriedUnresolvedMicroUsd,
    remainingUnderCapMicroUsd: remaining, fitsUnderCap: fits, providerCalls: 0, keyRead: false } } };
}
/**
 * Every later reader of the repaired storyboard (the child stage, the grant, the audition's start and resume) re-derives, before any claim or
 * call, what the repair's planner was allowed to receive - from the accepted roots (deriveRepairRequest), never from a recorded declaration
 * - and requires the saved producer evidence to be exactly that: the third attempt's held disposition and parent, the repair input the
 * reviewed loader binds, the complete planner wire under the pinned policy (executable path and hash, flags and argv, schema, stdin, cap,
 * prompt-file path), the prompt file's own bytes, and the amendment's declared request digest. Returns the repair folder's fingerprint,
 * which the consumer re-checks before each later claim (sameRepairFolder), so a change after this check refuses the next call too. The
 * fingerprint is taken first and every checked file must be the very bytes it fingerprinted, so it never pins content other than what was checked.
 */
async function assertRepairProducer(config: NewBookConfig, repair: NewBookRepair) {
  const { options, prepared } = prepareExperimentRequest(config);
  return repairProducerPin(config, repair, await deriveRepairRequest(config, prepared, options), NEW_BOOK_STORYBOARD_REPAIR.outDir);
}
/** A repair's saved producer evidence is exactly what its roots derived (`derived`); returns its folder's fingerprint, taken first. Synchronous. */
function repairProducerPin(config: NewBookConfig, repair: { previousStatus: string; parentStoryboardDigest: string; planner: { requestDigest: string } },
  derived: { status: string; repair: StoryboardRepair; plan: { requestDigest: string; wire: PlannerWire } }, folder: string) {
  const dir = experimentDir(config), out = path.join(dir, folder), wire = derived.plan.wire;
  const evidence = folderEvidence(dir, folder);
  const pinned = (file: string, maxBytes: number) => {
    let text: string;
    try { text = fencedText(file, maxBytes); } catch { return fail('new_book_planner_source'); }
    if (evidence.find(e => e.file === path.relative(dir, file).split(path.sep).join('/'))?.sha256 !== sha(text)) fail('new_book_planner_source');
    return text;
  };
  const saved = (file: string) => { const text = pinned(file, 32_000_000); try { return canonicalJson(JSON.parse(text)); } catch { return fail('new_book_planner_source'); } };
  if (derived.status !== repair.previousStatus || derived.repair.parentStoryboardDigest !== repair.parentStoryboardDigest ||
      derived.plan.requestDigest !== repair.planner.requestDigest ||
      saved(path.join(out, STORYBOARD_REPAIR_INPUT_FILE)) !== canonicalJson(derived.repair) ||
      saved(path.join(out, 'claude-max-stages', 'storyboard.wire.json')) !== canonicalJson(wire) ||
      pinned(String(wire.payload.instructionFile), 104_000) !== wire.payload.instructions) fail('new_book_planner_source');
  return { folder, fingerprint: canonicalJson(evidence) };
}
type RepairPin = ReturnType<typeof repairProducerPin> | null;
/** Every amendment or resolution this slot can have beside its claim, the claim first (the audition's own start record is not one). */
const amendmentFiles = (config: NewBookConfig) => [experimentClaimFile(config), experimentContinuationFile(config),
  ...REFUSED_STEPS.map(step => refusedFile(config, step)), experimentCarryResolutionFile(config), experimentRepairFile(config), experimentRepair2File(config),
  experimentAcceptanceFile(config), experimentComparisonFile(config)];
/**
 * The accepted lineage a stage builds on, by hash: the claim and every amendment or resolution beside it (or its absence), the request record,
 * and every record of each text folder it names. An amendment re-read later is mutable: a changed earlier record together with a rewritten
 * evidence row in a later amendment passes every link of the chain, but not this captured whole (Codex HOLD at 1fd909af, F1).
 */
type LineagePin = { folders: string[]; fingerprint: string };
function lineageFingerprint(config: NewBookConfig, folders: string[]) {
  const dir = experimentDir(config);
  return canonicalJson({ amendments: amendmentFiles(config).map(file => ({ file, sha256: existsSync(file) ? sha(readFileSync(file)) : null })),
    request: sha(readFileSync(path.join(dir, 'request.json'))), folders: folders.map(folder => ({ folder, evidence: folderEvidence(dir, folder) })) });
}
const lineagePin = (config: NewBookConfig, folders: string[]): LineagePin => ({ folders, fingerprint: lineageFingerprint(config, folders) });
/** The pinned lineage is unchanged (a stage's per-call guard; synchronous). */
function sameLineage(config: NewBookConfig, pin: LineagePin) {
  if (lineageFingerprint(config, pin.folders) !== pin.fingerprint) fail('new_book_continuation_evidence');
}
type RootsPin = { repair: RepairPin; lineage: LineagePin };
/**
 * The source-derived checks a consumer runs before its first claim: the original timed-out request whenever a carry exists, and, once
 * repaired, the latest repair's producer request (a second repair re-derives and checks the first's too). The whole accepted lineage is pinned
 * first, before those checks read anything; it must be unchanged after them, and each producer check must have read exactly its pinned folder.
 * Returns the latest repair folder's pin (null when unrepaired) and the lineage pin, both re-checked before every later claim (sameRoots).
 */
async function assertDerivedRoots(config: NewBookConfig, chain: ContinuationChain): Promise<RootsPin> {
  const lineage = lineagePin(config, chainFolders(chain).map(f => f.folder));
  if (chain.continuation) await assertOriginalRequest(config);
  const producers = chain.repair2 ? (chain.repair ? await assertRepair2Producer(config, chain.repair, chain.repair2) : fail('new_book_continuation'))
    : chain.repair ? [await assertRepairProducer(config, chain.repair)] : [];
  // Each repair folder still the bytes its producer check read, then the whole lineage still the one pinned before any check (so each
  // producer check read exactly its pinned folder).
  for (const p of producers) sameRepairFolder(config, p);
  sameLineage(config, lineage);
  return { repair: producers[producers.length - 1] ?? null, lineage };
}
/** The repaired folder is unchanged since its producer request was re-derived (a consumer's per-call guard; synchronous). */
function sameRepairFolder(config: NewBookConfig, pin: RepairPin) {
  if (pin !== null && canonicalJson(folderEvidence(experimentDir(config), pin.folder)) !== pin.fingerprint) fail('new_book_planner_source');
}
/** A consumer's per-call guard: the latest repair folder (as its producer check saw it), then the whole lineage it was admitted on. */
function sameRoots(config: NewBookConfig, pin: RootsPin) {
  sameRepairFolder(config, pin.repair);
  sameLineage(config, pin.lineage);
}
/** Read-only preview of the repair. */
export async function previewStoryboardRepair(config: NewBookConfig) {
  return (await admitRepair(config, currentHead(config))).admitted.summary;
}
/** Records the repair amendment (exclusive), immediately after re-checking the admitted baseline at the same pinned HEAD. */
function amendForRepair(config: NewBookConfig, head: string, prepared: ReturnType<typeof prepareSimpleStory>, admitted: RepairBaseline, parentStoryboardDigest: string,
  planner: { requestDigest: string; priorClaudeMaxMicroUsd: number }) {
  const now = sameRepairBaseline(config, head, prepared, admitted);
  if (now.amended) return now.amended;
  if (existsSync(path.join(experimentDir(config), NEW_BOOK_STORYBOARD_REPAIR.outDir))) fail('new_book_continuation_scope');
  // The earlier Max use, re-derived again right here (synchronously, with the baseline above), must still be the admitted one.
  if (priorClaudeMax(config) !== planner.priorClaudeMaxMicroUsd) fail('new_book_continuation_evidence');
  const amendment = repairSchema.parse({ version: 'new-book-continuation/v1', id: NEW_BOOK_STORYBOARD_REPAIR.id, slot: NEW_BOOK_EXPERIMENT.slot,
    approval: NEW_BOOK_STORYBOARD_REPAIR.approval, claimSha256: now.claimSha256, configSha256: sha(canonicalJson(config)), previousSha256: now.previousSha256,
    originalSourceHead: config.sourceHead, previousSourceHead: now.previous.sourceHead, sourceHead: head, failedStep: 'storyboard_review_held',
    previousStatus: now.status, parentStoryboardDigest, carryResolutionSha256: now.resolution?.sha256 ?? null,
    priorKnownApiMicroUsd: now.ledger.knownMicroUsd, carriedUnresolvedMicroUsd: now.ledger.carriedUnresolvedMicroUsd,
    planner: { model: OPUS_PLANNER.model, route: OPUS_PLANNER.route, judge: SOL, approval: NEW_BOOK_STORYBOARD_REPAIR.planner.approval,
      executableSha256: config.executableSha256, sessionGuardMicroUsd: OPUS_PLANNER.sessionGuardMicroUsd, requestDigest: planner.requestDigest,
      priorClaudeMaxMicroUsd: planner.priorClaudeMaxMicroUsd },
    evidence: admitted.evidence });
  try { exclusiveJson(experimentRepairFile(config), amendment); } catch { fail('new_book_continuation_used'); }
  return amendment;
}
/**
 * Guy's one repair: one pinned HEAD, the admission above, the fit condition, its amendment, the repair input saved for the reviewed loader, then
 * only the repaired storyboard and its fresh review, in a new folder whose meter carries all earlier known spend (and the resolution it names).
 */
export async function runNewBookStoryboardRepair(args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void; transports?: TextTransports }) {
  const { config } = args;
  const head = currentHead(config);
  const { prepared, options, repair, planner, admitted } = await admitRepair(config, head);
  if (!admitted.fits) fail('new_book_repair_over_cap');
  amendForRepair(config, head, prepared, admitted.baseline, repair.parentStoryboardDigest, planner);
  const mine = assertExperimentClaim(config).repair;
  if (!mine || mine.parentStoryboardDigest !== repair.parentStoryboardDigest || mine.planner.requestDigest !== planner.requestDigest) return fail('new_book_continuation');
  const dir = experimentDir(config), outDir = path.join(dir, NEW_BOOK_STORYBOARD_REPAIR.outDir);
  try { mkdirSync(outDir); } catch { fail('new_book_continuation_used'); }
  exclusiveJson(path.join(outDir, STORYBOARD_REPAIR_INPUT_FILE), repair);
  // The planner on the Claude Max route, journaled from this book's earlier Max use and only for the admitted request; the API meter holds
  // only the fresh Sol review, with every earlier known cost and the whole carry.
  return textCore({ ...args, contracts: NEW_BOOK_STORYBOARD_REPAIR.contracts, storyboardRepair: repair, prepared, options, outDir,
    opusPlanner: { requestDigest: mine.planner.requestDigest },
    api: new AuditionMeter(path.join(outDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, REPAIR_API_CALLS,
      mine.priorKnownApiMicroUsd, mine.carriedUnresolvedMicroUsd, meterRules(REPAIR_API_RULES)),
    claudeMax: new SimpleBookBudget(path.join(outDir, 'claude-max-stages'), mine.planner.priorClaudeMaxMicroUsd, CLAUDE_MAX_JOURNAL_CAP),
    replay: textReplay(path.join(dir, 'text')), continuationId: NEW_BOOK_STORYBOARD_REPAIR.id });
}

// ---------------------------------------------------------------------------------------------------------------
// Guy's second repair (a fifth amendment of the claim): the first repair's storyboard compiled, but its fresh review held it. The same story
// is replayed, the first repair's two answers (its planner's, from its Claude Max journal; its review's) are replayed to that exact held
// disposition, and the first repair's request is sent ONCE more with exactly the drawn-instant contract added, as a repair of that repair.
// ---------------------------------------------------------------------------------------------------------------
export const experimentRepair2File = (config: NewBookConfig) =>
  path.join(path.dirname(experimentClaimFile(config)), `${NEW_BOOK_EXPERIMENT.slot}.continuation-5.json`);
const repair2Schema = z.object({ version: z.literal('new-book-continuation/v1'), id: z.literal(NEW_BOOK_STORYBOARD_REPAIR_2.id),
  slot: z.literal(NEW_BOOK_EXPERIMENT.slot), approval: z.literal(NEW_BOOK_STORYBOARD_REPAIR_2.approval), claimSha256: hash, configSha256: hash,
  previousSha256: hash, originalSourceHead: headSha, previousSourceHead: headSha, sourceHead: headSha, failedStep: z.literal('storyboard_review_held'),
  previousStatus: heldStatus, parentStoryboardDigest: hash, addedContracts: z.tuple([z.literal('drawnInstantContract')]),
  priorKnownApiMicroUsd: z.number().int().nonnegative(), carriedUnresolvedMicroUsd: z.number().int().nonnegative(),
  // The same planner route and judge as the first repair (Guy's planner decision), the exact request admitted, and the Max use before it.
  planner: z.object({ model: z.literal(OPUS_PLANNER.model), route: z.literal(OPUS_PLANNER.route), judge: z.literal(SOL),
    approval: z.literal(NEW_BOOK_STORYBOARD_REPAIR.planner.approval), executableSha256: hash,
    sessionGuardMicroUsd: z.literal(OPUS_PLANNER.sessionGuardMicroUsd), requestDigest: hash,
    priorClaudeMaxMicroUsd: z.number().int().nonnegative() }).strict(),
  evidence: z.array(z.object({ file: z.string().regex(new RegExp(`^${NEW_BOOK_STORYBOARD_REPAIR.outDir}/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)?$`)), sha256: hash })
    .strict()).min(4).max(32) }).strict();
export type NewBookRepair2 = z.infer<typeof repair2Schema>;
/** The recorded second repair amendment (null when none), verified against the first repair amendment and every record of the first repair. */
function readRepair2(config: NewBookConfig, claimSha256: string, repair1: NewBookRepair | null): NewBookRepair2 | null {
  const file = experimentRepair2File(config);
  if (!existsSync(file)) return null;
  // It amends the first repair: that amendment must be there.
  if (!repair1) return fail('new_book_continuation');
  const parsed = repair2Schema.safeParse(read(file));
  if (!parsed.success || parsed.data.claimSha256 !== claimSha256 || parsed.data.configSha256 !== sha(canonicalJson(config)) ||
      parsed.data.originalSourceHead !== config.sourceHead || parsed.data.previousSourceHead !== repair1.sourceHead ||
      parsed.data.previousSha256 !== sha(readFileSync(experimentRepairFile(config)))) return fail('new_book_continuation');
  if (canonicalJson(folderEvidence(experimentDir(config), NEW_BOOK_STORYBOARD_REPAIR.outDir)) !== canonicalJson(parsed.data.evidence)) fail('new_book_continuation_evidence');
  return parsed.data;
}
type Repair2Baseline = { claimSha256: string; repair1: NewBookRepair; repair1Sha256: string; amended: NewBookRepair2 | null;
  status: z.infer<typeof heldStatus>; held: ReturnType<typeof textStage>; maxBefore: number; evidence: ReturnType<typeof folderEvidence> };
/**
 * The second repair's admission baseline at ONE pinned HEAD (compared, never adopted): the clean source first; the unchanged claim and its
 * whole chain through the first repair; once amended, its own HEAD equal to the pin; the failed text stage and the complete request record;
 * the first repair sealed held by its own review with exactly its planner's journal and its review's call; every ledger re-derived from
 * evidence (the first repair's planner journal included, whose cumulative total is this repair's earlier Max use); and every record of the
 * first repair by hash.
 */
function repair2Baseline(config: NewBookConfig, head: string, prepared: ReturnType<typeof prepareSimpleStory>): Repair2Baseline {
  assertExperimentSource(config, head);
  const { claim, claimSha256 } = verifiedClaim(config);
  const first = readContinuation(config, claimSha256);
  if (!first) return fail('new_book_continuation_scope');
  const refused = readRefusedChain(config, claimSha256, first), repair1 = readRepair(config, claimSha256, first, refused);
  if (refused.length !== REFUSED_STEPS.length || !repair1) return fail('new_book_continuation_scope');
  const amended = readRepair2(config, claimSha256, repair1);
  if (amended && amended.sourceHead !== head) fail('new_book_source_changed');
  const dir = experimentDir(config), out1 = path.join(dir, NEW_BOOK_STORYBOARD_REPAIR.outDir), root = path.join(out1, 'paid-stages');
  if (sealedStatus(path.join(dir, 'text')) !== 'failed') fail('new_book_continuation_scope');
  assertRequestRecord(dir, claim, prepared);
  const sealed = existsSync(path.join(out1, 'sealed.json')) ? read(path.join(out1, 'sealed.json')) : null, status = heldStatus.safeParse(sealed?.status);
  if (!status.success || sealed.continuation !== NEW_BOOK_STORYBOARD_REPAIR.id || !existsSync(root)) return fail('new_book_continuation_scope');
  const claims = readdirSync(root).filter(n => n.endsWith('.claim.json')).map(n => n.slice(0, -'.claim.json'.length)).sort();
  if (canonicalJson(claims) !== canonicalJson(['storyboard_review']) || read(path.join(root, 'storyboard_review.result.json')).completed !== true) fail('new_book_continuation_scope');
  const held = textStage(config, { continuation: first, refused, repair: repair1, repair2: null });
  // The first repair started its journal from this book's earlier Max use; its journal's cumulative total starts this one's.
  if (priorClaudeMax(config) !== repair1.planner.priorClaudeMaxMicroUsd) fail('new_book_planner_record');
  const maxBefore = verifyRepairPlanner(config, out1, repair1.planner, NEW_BOOK_STORYBOARD_REPAIR.contracts).accountedMicroUsd;
  return { claimSha256, repair1, repair1Sha256: sha(readFileSync(experimentRepairFile(config))), amended, status: status.data, held, maxBefore,
    evidence: folderEvidence(dir, NEW_BOOK_STORYBOARD_REPAIR.outDir) };
}
function sameRepair2Baseline(config: NewBookConfig, head: string, prepared: ReturnType<typeof prepareSimpleStory>, admitted: Repair2Baseline) {
  const now = repair2Baseline(config, head, prepared);
  if (now.claimSha256 !== admitted.claimSha256 || now.repair1Sha256 !== admitted.repair1Sha256 || now.maxBefore !== admitted.maxBefore ||
      now.held.knownMicroUsd !== admitted.held.knownMicroUsd || now.held.carriedUnresolvedMicroUsd !== admitted.held.carriedUnresolvedMicroUsd ||
      canonicalJson(now.evidence) !== canonicalJson(admitted.evidence)) fail('new_book_continuation_evidence');
  return now;
}
/**
 * The second repair's input and its planner request as the accepted roots derive them NOW (no provider, no key, nothing written): the first
 * repair as its roots derive it (deriveRepairRequest); its two saved answers replayed under its own contracts and input - exactly its admitted
 * planner request answered by its Claude Max journal's structured answer, then exactly its review's request, its cost re-derived from its raw
 * answer under the live rule - to a held storyboard whose decoded draft (equal to the draft it saved) and own raw review, with the first
 * repair's own input nested and the drawn-instant contract added, are this repair's input; then the request the engine builds from them,
 * which must be the first repair's with exactly the contract added: its addendum before the repair contract's, its schema, the new prior (the
 * held first repair, its review's unsupported checks and the compiler's own drawn-instant findings on it) and the source digest that records
 * it, at the same model and caps; and its complete CLI wire under the pinned policy at this repair folder's own prompt file.
 */
async function deriveRepair2Request(config: NewBookConfig, prepared: ReturnType<typeof prepareSimpleStory>,
  options: ReturnType<typeof prepareExperimentRequest>['options']) {
  const dir = experimentDir(config), textDir = path.join(dir, 'text'), out1 = path.join(dir, NEW_BOOK_STORYBOARD_REPAIR.outDir);
  const policy = textPolicy(config), replay = textReplay(textDir);
  const first = await deriveRepairRequest(config, prepared, options);
  // The first repair's saved answers: its planner's structured answer (its journal's raw CLI answer) and its review's provider answer.
  let structured: unknown = null;
  try { structured = JSON.parse(String(read(path.join(out1, 'claude-max-stages', 'storyboard.receipt.json'))?.raw?.stdout)).structured_output; }
  catch { return fail('new_book_continuation_replay'); }
  const [claim, wire, result, receipt] = ['claim', 'wire', 'result', 'receipt'].map(k => read(path.join(out1, 'paid-stages', `storyboard_review.${k}.json`)));
  if (previewSha(canonicalJson(wire)) !== claim.wireDigest || result.wireDigest !== claim.wireDigest || result.completed !== true || !structured ||
      receipt?.estimatedMicroUsd !== result.estimatedMicroUsd || typeof receipt?.raw?.output_text !== 'string') fail('new_book_continuation_replay');
  let refusal: unknown = null, stop: string | null = null;
  const replayed = <T>(f: () => T) => { try { return f(); } catch (error) { refusal ??= error; throw error; } };
  const halt = (code: string): never => { stop ??= code; throw new NewBookExperimentError(code); };
  const story = (contracts: TextContracts, repair: StoryboardRepair, visual: (call: SimpleStoryboardDiagnosticCall) => Promise<unknown>) =>
    runSimpleWizardBook({ request: prepared.accepted.canonical, options, seed: config.seed, signal: new AbortController().signal,
      reservedWritingUsd: 4, ...contracts, storyboardRepair: repair, publish: () => {},
      opus: async call => { const d = storyDispatch(call, 'opus', prepared.accepted.requestId);
        return replayed(() => replay.opus(d, prepareCausalWire(d, policy, 2000000, path.join(textDir, `${call.stage}-instructions.txt`)))); },
      reader: async call => { const d = storyDispatch(call, 'astra', prepared.accepted.requestId);
        return replayed(() => replay.reader(d, prepareCausalWire(d, policy, 2000000))); },
      visual });
  // 1. The first repair, replayed: exactly its admitted planner request (answered from its journal), then exactly its review's request.
  let draft: unknown = null, firstCall: SimpleStoryboardDiagnosticCall | null = null, reviewSettled: number | null = null, calls = 0;
  const replayedFirst = await story(NEW_BOOK_STORYBOARD_REPAIR.contracts, first.repair, async call => {
    if (call.stage === 'storyboard') {
      if (calls++ !== 0 || plannerRequestDigest(call) !== first.plan.requestDigest) return halt('new_book_continuation_replay');
      firstCall = call; draft = decodePersonalBookProviderOutput(call, structured);
      return draft;
    }
    const payload = simpleWizardVisualPayload(call, SOL);
    if (calls++ !== 1 || previewSha(canonicalJson(payload)) !== claim.wireDigest) return halt('new_book_continuation_replay');
    const s = visualSettlement(call, payload, receipt.raw);
    if (!s.valid || s.estimatedMicroUsd === null || s.estimatedMicroUsd !== result.estimatedMicroUsd || canonicalJson(receipt.usage) !== canonicalJson(s.usage) ||
        receipt.model !== receipt.raw.model || receipt.stage !== visualStep(call)) return halt('new_book_continuation_cost');
    reviewSettled = s.estimatedMicroUsd;
    return decodePersonalBookProviderOutput(call, JSON.parse(receipt.raw.output_text));
  }).catch((error: unknown) => { throw refusal ?? (stop ? new NewBookExperimentError(stop) : error); });
  const heldBoard = replayedFirst.storyboard, firstStoryboardCall = firstCall as SimpleStoryboardDiagnosticCall | null;
  if (calls !== 2 || !heldBoard || !firstStoryboardCall || reviewSettled === null || replayedFirst.status !== heldBoard.status ||
      !heldStatus.safeParse(heldBoard.status).success) return fail('new_book_continuation_scope');
  // The draft the first repair saved is the one its planner's answer decodes to.
  if (canonicalJson(read(path.join(out1, 'owned_storyboard_draft.json'))) !== canonicalJson(draft)) fail('new_book_continuation_replay');
  const repair: StoryboardRepair = { parentStoryboardDigest: heldBoard.storyboardDigest, draft: structuredClone(draft), review: structuredClone(heldBoard.rawReview),
    parentRepair: structuredClone(first.repair), addedContracts: [...NEW_BOOK_STORYBOARD_REPAIR_2.addedContracts] };
  // What the engine must tell the planner: the review's own unsupported checks and the compiler's drawn-instant findings on the held storyboard.
  const texts = previewStoryEvidence(previewTextPages({ title: replayedFirst.source.manuscript.title, pages: replayedFirst.source.manuscript.pages })).texts;
  const prior = { version: STORYBOARD_REPAIR_VERSION, parentStoryboardDigest: repair.parentStoryboardDigest, storyboard: repair.draft,
    reviewFindings: storyboardRepairFindings(heldBoard.review.review),
    contractFindings: drawnInstantGaps(heldBoard.storyboard.moments!, heldBoard.storyboard.plan, heldBoard.storyboard.sequence, texts).map(drawnInstantFinding) };
  // 2. This repair's request: the first repair's with exactly the contract added, and its planner wire on the Claude Max route.
  const firstPayload = simpleWizardVisualPayload(firstStoryboardCall, SOL), repairAddendum = `\n${REPAIR_STORYBOARD_ADDENDUM}`;
  const instructionFile = path.join(dir, NEW_BOOK_STORYBOARD_REPAIR_2.outDir, 'storyboard-instructions.txt');
  let reached = false, onlyTheContract = false, plannerFailure: unknown = null, planner = null as { requestDigest: string; wire: PlannerWire } | null;
  await story(NEW_BOOK_STORYBOARD_REPAIR_2.contracts, repair, async call => {
    reached = true;
    const payload = simpleWizardVisualPayload(call, SOL), source = call.context.sourceDigest;
    try { planner = { requestDigest: plannerRequestDigest(call), wire: prepareOpusStoryboardWire(call, policy, instructionFile) }; }
    catch (error) { plannerFailure = error; }
    const { priorReviewedStoryboard, ...input } = JSON.parse(payload.input), { priorReviewedStoryboard: _first, ...firstInput } = JSON.parse(firstPayload.input);
    // The schema the first request's own call carries once the contract is added to it (the provider form, from its own context).
    const withContract = simpleWizardVisualPayload({ ...firstStoryboardCall, context: { ...firstStoryboardCall.context, drawnInstantContract: true } }, SOL);
    onlyTheContract = call.stage === 'storyboard' && source !== firstStoryboardCall.context.sourceDigest &&
      canonicalJson(call.context) === canonicalJson({ ...firstStoryboardCall.context, sourceDigest: source, drawnInstantContract: true }) &&
      canonicalJson(input) === canonicalJson({ ...firstInput, personalSourceDigest: source }) && canonicalJson(priorReviewedStoryboard) === canonicalJson(prior) &&
      payload.input === canonicalJson(JSON.parse(payload.input)) && firstStoryboardCall.instructions.endsWith(repairAddendum) &&
      call.instructions === `${firstStoryboardCall.instructions.slice(0, -repairAddendum.length)}\n${DRAWN_INSTANT_STORYBOARD_ADDENDUM}${repairAddendum}` &&
      firstPayload.instructions.startsWith(firstStoryboardCall.instructions) && canonicalJson(payload.text) === canonicalJson(withContract.text) &&
      canonicalJson(payload) === canonicalJson({ ...firstPayload, input: payload.input, text: withContract.text,
        instructions: call.instructions + firstPayload.instructions.slice(firstStoryboardCall.instructions.length) });
    throw new NewBookExperimentError('new_book_continuation_preview_stop');
  }).catch((error: unknown) => { if (!reached) throw refusal ?? error; });
  if (!reached) fail('new_book_continuation_scope');
  if (!onlyTheContract) return fail('new_book_continuation_request');
  if (plannerFailure || !planner) throw plannerFailure ?? new NewBookExperimentError('new_book_planner_wire');
  const plan: { requestDigest: string; wire: PlannerWire } = planner;
  return { first, firstStatus: heldStatus.parse(heldBoard.status), reviewSettled, repair, plan,
    findings: { review: prior.reviewFindings.length, contract: prior.contractFindings.length } };
}
async function admitRepair2(config: NewBookConfig, head: string) {
  const { options, prepared } = prepareExperimentRequest(config);
  const baseline = repair2Baseline(config, head, prepared);
  await assertOriginalRequest(config);
  const dir = experimentDir(config);
  const derived = await deriveRepair2Request(config, prepared, options);
  // The first repair's producer evidence is exactly what its roots derive (as every later reader of the repaired books requires), and it was
  // sealed exactly as replayed: its held disposition and its review's settled cost in the verified ledger.
  repairProducerPin(config, baseline.repair1, derived.first, NEW_BOOK_STORYBOARD_REPAIR.outDir);
  if (derived.firstStatus !== baseline.status || baseline.held.knownMicroUsd !== baseline.repair1.priorKnownApiMicroUsd + derived.reviewSettled) fail('new_book_continuation_scope');
  // The same route and fit as the first repair: the planner on Claude Max (its own session guard within the journal), and only the fresh
  // review's largest possible reservation on the API meter, within what remains with the whole carry kept.
  const reviewCeiling = wireReservation(VISUAL_WIRE_LIMIT, personalBookOutputLimits(prepared.book.pages).reviewOutputTokens, RATES.sol);
  const remaining = NEW_BOOK_EXPERIMENT.apiCapMicroUsd - baseline.held.knownMicroUsd - baseline.held.carriedUnresolvedMicroUsd;
  const fits = reviewCeiling <= remaining && baseline.maxBefore + OPUS_PLANNER.sessionGuardMicroUsd <= CLAUDE_MAX_JOURNAL_CAP;
  // The replays were asynchronous: the same pinned HEAD, still clean, and exactly the records they used.
  sameRepair2Baseline(config, head, prepared, baseline);
  const args = derived.plan.wire.args;
  return { prepared, options, repair: derived.repair, planner: { requestDigest: derived.plan.requestDigest, priorClaudeMaxMicroUsd: baseline.maxBefore },
    admitted: { baseline, fits, summary: { admissible: true, amended: !!baseline.amended,
    outDirExists: existsSync(path.join(dir, NEW_BOOK_STORYBOARD_REPAIR_2.outDir)), storyReplayed: true, firstRepairReplayed: true,
    previousStatus: baseline.status, previousReviewSettledMicroUsd: derived.reviewSettled, parentStoryboardDigest: derived.repair.parentStoryboardDigest,
    reviewFindings: derived.findings.review, contractFindings: derived.findings.contract, requestChangedOnlyByTheContract: true,
    addedContracts: [...NEW_BOOK_STORYBOARD_REPAIR_2.addedContracts],
    planner: { model: OPUS_PLANNER.model, route: OPUS_PLANNER.route, judge: SOL, requestDigest: derived.plan.requestDigest,
      wireBytes: derived.plan.wire.bytes, wireByteLimit: textPolicy(config).maxWireBytes, argvChars: args.map(a => JSON.stringify(a)).join(' ').length + config.executable.length,
      argvCharLimit: 31_000, schemaChars: args[args.length - 1].length, stdinBytes: Buffer.byteLength(derived.plan.wire.stdin, 'utf8'),
      instructionsBytes: Buffer.byteLength(String(derived.plan.wire.payload.instructions), 'utf8'), outputCap: derived.plan.wire.outputCap,
      sessionGuardMicroUsd: OPUS_PLANNER.sessionGuardMicroUsd, wireReservationMicroUsd: derived.plan.wire.reservedMicroUsd,
      priorClaudeMaxMicroUsd: baseline.maxBefore, apiChargeMicroUsd: 0 },
    reviewReservationCeilingMicroUsd: reviewCeiling, priorKnownApiMicroUsd: baseline.held.knownMicroUsd,
    carriedUnresolvedMicroUsd: baseline.held.carriedUnresolvedMicroUsd, remainingUnderCapMicroUsd: remaining, fitsUnderCap: fits,
    providerCalls: 0, keyRead: false } } };
}
/**
 * Every later reader of the second repair re-derives, before any claim, the first repair's producer request and then its own (see
 * repairProducerPin). Returns both folders' pins, the first repair's first; neither is dropped (Codex HOLD at 1fd909af, F1).
 */
async function assertRepair2Producer(config: NewBookConfig, repair1: NewBookRepair, repair2: NewBookRepair2) {
  const { options, prepared } = prepareExperimentRequest(config);
  const derived = await deriveRepair2Request(config, prepared, options);
  return [repairProducerPin(config, repair1, derived.first, NEW_BOOK_STORYBOARD_REPAIR.outDir),
    repairProducerPin(config, repair2, { status: derived.firstStatus, repair: derived.repair, plan: derived.plan }, NEW_BOOK_STORYBOARD_REPAIR_2.outDir)];
}
/** Read-only preview of the second repair. */
export async function previewStoryboardRepair2(config: NewBookConfig) {
  return (await admitRepair2(config, currentHead(config))).admitted.summary;
}
/** Records the second repair amendment (exclusive), immediately after re-checking the admitted baseline at the same pinned HEAD. */
function amendForRepair2(config: NewBookConfig, head: string, prepared: ReturnType<typeof prepareSimpleStory>, admitted: Repair2Baseline,
  parentStoryboardDigest: string, planner: { requestDigest: string; priorClaudeMaxMicroUsd: number }) {
  const now = sameRepair2Baseline(config, head, prepared, admitted);
  if (now.amended) return now.amended;
  if (existsSync(path.join(experimentDir(config), NEW_BOOK_STORYBOARD_REPAIR_2.outDir))) fail('new_book_continuation_scope');
  if (now.maxBefore !== planner.priorClaudeMaxMicroUsd) fail('new_book_continuation_evidence');
  const amendment = repair2Schema.parse({ version: 'new-book-continuation/v1', id: NEW_BOOK_STORYBOARD_REPAIR_2.id, slot: NEW_BOOK_EXPERIMENT.slot,
    approval: NEW_BOOK_STORYBOARD_REPAIR_2.approval, claimSha256: now.claimSha256, configSha256: sha(canonicalJson(config)), previousSha256: now.repair1Sha256,
    originalSourceHead: config.sourceHead, previousSourceHead: now.repair1.sourceHead, sourceHead: head, failedStep: 'storyboard_review_held',
    previousStatus: now.status, parentStoryboardDigest, addedContracts: [...NEW_BOOK_STORYBOARD_REPAIR_2.addedContracts],
    priorKnownApiMicroUsd: now.held.knownMicroUsd, carriedUnresolvedMicroUsd: now.held.carriedUnresolvedMicroUsd,
    planner: { model: OPUS_PLANNER.model, route: OPUS_PLANNER.route, judge: SOL, approval: NEW_BOOK_STORYBOARD_REPAIR.planner.approval,
      executableSha256: config.executableSha256, sessionGuardMicroUsd: OPUS_PLANNER.sessionGuardMicroUsd, requestDigest: planner.requestDigest,
      priorClaudeMaxMicroUsd: planner.priorClaudeMaxMicroUsd },
    evidence: admitted.evidence });
  try { exclusiveJson(experimentRepair2File(config), amendment); } catch { fail('new_book_continuation_used'); }
  return amendment;
}
/**
 * Guy's second repair: one pinned HEAD, the admission above, the fit, its amendment, its repair input saved for the reviewed loader, then only
 * the repaired storyboard (the Opus planner on Claude Max, journaled from this book's Max use so far) and its fresh Sol review (the API meter
 * with every earlier known cost and the whole carry), in a new folder.
 */
export async function runNewBookStoryboardRepair2(args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void; transports?: TextTransports }) {
  const { config } = args;
  const head = currentHead(config);
  const { prepared, options, repair, planner, admitted } = await admitRepair2(config, head);
  if (!admitted.fits) fail('new_book_repair_over_cap');
  amendForRepair2(config, head, prepared, admitted.baseline, repair.parentStoryboardDigest, planner);
  const mine = assertExperimentClaim(config).repair2;
  if (!mine || mine.parentStoryboardDigest !== repair.parentStoryboardDigest || mine.planner.requestDigest !== planner.requestDigest) return fail('new_book_continuation');
  const dir = experimentDir(config), outDir = path.join(dir, NEW_BOOK_STORYBOARD_REPAIR_2.outDir);
  try { mkdirSync(outDir); } catch { fail('new_book_continuation_used'); }
  exclusiveJson(path.join(outDir, STORYBOARD_REPAIR_INPUT_FILE), repair);
  return textCore({ ...args, contracts: NEW_BOOK_STORYBOARD_REPAIR_2.contracts, storyboardRepair: repair, prepared, options, outDir,
    opusPlanner: { requestDigest: mine.planner.requestDigest },
    api: new AuditionMeter(path.join(outDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, REPAIR_API_CALLS,
      mine.priorKnownApiMicroUsd, mine.carriedUnresolvedMicroUsd, meterRules(REPAIR_API_RULES)),
    claudeMax: new SimpleBookBudget(path.join(outDir, 'claude-max-stages'), mine.planner.priorClaudeMaxMicroUsd, CLAUDE_MAX_JOURNAL_CAP),
    replay: textReplay(path.join(dir, 'text')), continuationId: NEW_BOOK_STORYBOARD_REPAIR_2.id });
}

// ---------------------------------------------------------------------------------------------------------------
// Guy's acceptance of the second repair's held storyboard (an amendment of the claim; no paid call). The record (beside the storyboard, for
// the reviewed loader) binds the compiled book, its own review and every check that review did not support; the amendment binds the second
// repair amendment, every record of its folder and the record's bytes. Later stages use the held storyboard through it alone.
// ---------------------------------------------------------------------------------------------------------------
export const experimentAcceptanceFile = (config: NewBookConfig) =>
  path.join(path.dirname(experimentClaimFile(config)), `${NEW_BOOK_EXPERIMENT.slot}.${NEW_BOOK_OWNER_ACCEPTANCE.id}.json`);
const ACCEPTANCE_RECORD = `${NEW_BOOK_STORYBOARD_REPAIR_2.outDir}/${STORYBOARD_OWNER_ACCEPTANCE_FILE}`;
const acceptanceSchema = z.object({ version: z.literal('new-book-owner-acceptance/v1'), id: z.literal(NEW_BOOK_OWNER_ACCEPTANCE.id),
  slot: z.literal(NEW_BOOK_EXPERIMENT.slot), approval: z.literal(NEW_BOOK_OWNER_ACCEPTANCE.approval), claimSha256: hash, configSha256: hash,
  previousSha256: hash, originalSourceHead: headSha, previousSourceHead: headSha, sourceHead: headSha,
  storyboardFolder: z.literal(NEW_BOOK_STORYBOARD_REPAIR_2.outDir), status: heldStatus, storyboardDigest: hash, reviewDigest: hash,
  findings: z.number().int().positive(), recordSha256: hash,
  evidence: z.array(z.object({ file: z.string().regex(new RegExp(`^${NEW_BOOK_STORYBOARD_REPAIR_2.outDir}/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)?$`)), sha256: hash })
    .strict()).min(4).max(32) }).strict();
export type NewBookAcceptance = z.infer<typeof acceptanceSchema>;
/**
 * The recorded acceptance (null when none), verified against the second repair amendment and the second repair's folder: every record the
 * amendment bound, plus exactly the acceptance record it names by hash, and nothing else. Its own summary fields are that record's (book,
 * review, number of accepted checks) and the folder's sealed status.
 */
function readAcceptance(config: NewBookConfig, claimSha256: string, repair2: NewBookRepair2 | null): NewBookAcceptance | null {
  const file = experimentAcceptanceFile(config);
  if (!existsSync(file)) return null;
  if (!repair2) return fail('new_book_continuation');
  const parsed = acceptanceSchema.safeParse(read(file));
  if (!parsed.success || parsed.data.claimSha256 !== claimSha256 || parsed.data.configSha256 !== sha(canonicalJson(config)) ||
      parsed.data.originalSourceHead !== config.sourceHead || parsed.data.previousSourceHead !== repair2.sourceHead ||
      parsed.data.previousSha256 !== sha(readFileSync(experimentRepair2File(config)))) return fail('new_book_continuation');
  const dir = experimentDir(config), now = folderEvidence(dir, NEW_BOOK_STORYBOARD_REPAIR_2.outDir);
  if (now.find(e => e.file === ACCEPTANCE_RECORD)?.sha256 !== parsed.data.recordSha256 ||
      canonicalJson(now.filter(e => e.file !== ACCEPTANCE_RECORD)) !== canonicalJson(parsed.data.evidence)) fail('new_book_continuation_evidence');
  const record = (() => { try { return read(path.join(dir, ...ACCEPTANCE_RECORD.split('/'))); } catch { return null; } })();
  if (record?.storyboardDigest !== parsed.data.storyboardDigest || record?.reviewDigest !== parsed.data.reviewDigest ||
      !Array.isArray(record?.acceptedFindings) || record.acceptedFindings.length !== parsed.data.findings ||
      sealedStatus(path.join(dir, NEW_BOOK_STORYBOARD_REPAIR_2.outDir)) !== parsed.data.status) fail('new_book_continuation_evidence');
  return parsed.data;
}
/**
 * The second repair's held storyboard as its saved records compile it (no provider): the request record, the saved result's source and
 * contract markers, its repair input and its own draft. The compiled book must be the saved one, and its own review's disposition the held
 * status the result and the seal record.
 */
function heldRepair2Board(config: NewBookConfig) {
  const dir = experimentDir(config), visual = path.join(dir, NEW_BOOK_STORYBOARD_REPAIR_2.outDir), { options } = prepareExperimentRequest(config);
  const result = read(path.join(visual, 'visual_simple_book_result.json')), saved = result.storyboard?.storyboard;
  const source = prepareCurrentPersonalStoryboard(read(path.join(dir, 'request.json')).request, result.source, options, true, savedMomentContract(saved),
    savedLandmarkKindContract(saved), undefined, savedSceneLocationContract(saved), savedCompilerRulesContract(saved),
    read(path.join(visual, STORYBOARD_REPAIR_INPUT_FILE)), savedDrawnInstantContract(saved));
  const book = compilePersonalStoryboard(source, read(path.join(visual, 'owned_storyboard_draft.json')));
  const rawReview: unknown = result.storyboard?.rawReview, decision = storyboardReviewDisposition(book, rawReview);
  if (canonicalJson(book) !== canonicalJson(saved) || !heldStatus.safeParse(decision.disposition).success || result.status !== decision.disposition ||
      result.storyboard?.status !== decision.disposition || sealedStatus(visual) !== decision.disposition) fail('new_book_acceptance_scope');
  return { book, rawReview, decision };
}
/**
 * The acceptance's admission at ONE pinned HEAD (compared, never adopted): the clean source; the unchanged claim and its whole chain through
 * the second repair, held; never after a child stage or an audition (not retroactive); every ledger re-derived; the record derived from the
 * saved book and its own review (every unsupported check, verbatim) and bound by the engine; then the source-derived roots of the storyboard
 * being accepted (the original request, both repairs' producer requests, the lineage).
 */
async function admitAcceptance(config: NewBookConfig, head: string) {
  const dir = experimentDir(config);
  const baseline = () => {
    assertExperimentSource(config, head);
    const { claimSha256 } = verifiedClaim(config), first = readContinuation(config, claimSha256);
    const refused = first ? readRefusedChain(config, claimSha256, first) : [], repair1 = first ? readRepair(config, claimSha256, first, refused) : null;
    const repair2 = readRepair2(config, claimSha256, repair1);
    if (!first || refused.length !== REFUSED_STEPS.length || !repair1 || !repair2) return fail('new_book_acceptance_scope');
    const amended = readAcceptance(config, claimSha256, repair2);
    if (amended && amended.sourceHead !== head) fail('new_book_source_changed');
    if (existsSync(path.join(dir, 'child')) || existsSync(experimentAuditionStart(config))) fail('new_book_acceptance_late');
    const chain: ContinuationChain = { continuation: first, refused, repair: repair1, repair2, acceptance: null };
    textStage(config, chain);
    const { book, rawReview, decision } = heldRepair2Board(config);
    const record: StoryboardOwnerAcceptance = { version: STORYBOARD_OWNER_ACCEPTANCE_VERSION, storyboardDigest: book.storyboardDigest,
      reviewDigest: decision.reviewDigest, acceptedFindings: storyboardRepairFindings(decision.review), acceptedBy: NEW_BOOK_OWNER_ACCEPTANCE.acceptedBy,
      approval: NEW_BOOK_OWNER_ACCEPTANCE.approval };
    storyboardOwnerAcceptance(book, rawReview, record);
    return { claimSha256, chain, amended, status: heldStatus.parse(decision.disposition), record, repair2Sha256: sha(readFileSync(experimentRepair2File(config))),
      evidence: folderEvidence(dir, NEW_BOOK_STORYBOARD_REPAIR_2.outDir).filter(e => e.file !== ACCEPTANCE_RECORD) };
  };
  const admitted = baseline();
  await assertDerivedRoots(config, admitted.chain);
  // The roots were asynchronous: the same pinned HEAD, still clean, and exactly the same records, ledgers and record (synchronous).
  const same = () => { if (canonicalJson(baseline()) !== canonicalJson(admitted)) fail('new_book_continuation_evidence'); };
  same();
  // The exact bytes an execution writes, built and checked here so that a preview proves them: the record beside the storyboard, then the
  // amendment naming it by hash at this pinned HEAD.
  const text = JSON.stringify(admitted.record, null, 2) + '\n';
  const amendment = acceptanceSchema.parse({ version: 'new-book-owner-acceptance/v1', id: NEW_BOOK_OWNER_ACCEPTANCE.id, slot: NEW_BOOK_EXPERIMENT.slot,
    approval: NEW_BOOK_OWNER_ACCEPTANCE.approval, claimSha256: admitted.claimSha256, configSha256: sha(canonicalJson(config)), previousSha256: admitted.repair2Sha256,
    originalSourceHead: config.sourceHead, previousSourceHead: admitted.chain.repair2!.sourceHead, sourceHead: head, storyboardFolder: NEW_BOOK_STORYBOARD_REPAIR_2.outDir,
    status: admitted.status, storyboardDigest: admitted.record.storyboardDigest, reviewDigest: admitted.record.reviewDigest,
    findings: admitted.record.acceptedFindings.length, recordSha256: sha(text), evidence: admitted.evidence });
  const summary = { recorded: !!admitted.amended, status: admitted.status, storyboardDigest: admitted.record.storyboardDigest,
    reviewDigest: admitted.record.reviewDigest, acceptedFindings: admitted.record.acceptedFindings, acceptedBy: admitted.record.acceptedBy,
    recordSha256: amendment.recordSha256, providerCalls: 0, keyRead: false };
  return { admitted, same, text, amendment, summary };
}
/** Read-only preview of the acceptance: the record it would write (and that record's hash), from the saved book and its own review. */
export async function previewOwnerAcceptance(config: NewBookConfig) {
  return (await admitAcceptance(config, currentHead(config))).summary;
}
/**
 * Records the acceptance once, right after its admission is re-checked at the same pinned HEAD: the record beside the storyboard first (its
 * exact bytes; an identical record left by an interrupted run is the same record), then the one-shot amendment binding it.
 */
export async function writeOwnerAcceptance(config: NewBookConfig) {
  const { admitted, same, text, amendment, summary } = await admitAcceptance(config, currentHead(config));
  if (admitted.amended) return fail('new_book_acceptance_used');
  const target = path.join(experimentDir(config), NEW_BOOK_STORYBOARD_REPAIR_2.outDir, STORYBOARD_OWNER_ACCEPTANCE_FILE);
  same();
  if (existsSync(target) ? fencedText(target, 256_000) !== text : (exclusiveText(target, text), false)) fail('new_book_acceptance_used');
  try { exclusiveJson(experimentAcceptanceFile(config), amendment); } catch { fail('new_book_acceptance_used'); }
  return { ...summary, recorded: true };
}

// ---------------------------------------------------------------------------------------------------------------
// Stage 2: the fictional child reference.
// ---------------------------------------------------------------------------------------------------------------
type Render = (step: string, prompt: string, refs: AuditionImage[], mode: 'identity' | 'style' | 'book_design', roles?: readonly BookDesignReferenceRole[]) => Promise<AuditionImage>;
type Judge = (step: string, candidate: AuditionImage, context: unknown, contextSha: string, refs: AuditionImage[], predecessor: AuditionImage | null) => Promise<unknown>;
/** `style` and `design` are the opt-in child-anchor-style/v1 reviews (unused on the legacy path). */
export type ChildAdapters = { render?: Render; judge?: Judge; style?: ChildAnchorStyleJudge; design?: ChildAnchorDesignJudge };

/**
 * child-anchor-style/v1 admission (no write, no claim): the pinned technique bytes (refused on any mismatch), this book's child from its
 * written design and the storyboard's wardrobe, and the first request exactly as the real image seam plans it (no truncation).
 */
function childAnchorAdmission(config: NewBookConfig, loaded: Pick<ReturnType<typeof loadReviewedStoryboard>, 'prepared' | 'book'>) {
  if (config.childAnchor !== CHILD_ANCHOR_STYLE_VERSION) return fail('new_book_child_anchor');
  const technique = resolveChildAnchorTechnique(config.workspace), child = loaded.prepared.brief.child;
  const request = childAnchorDescriptionRequest({ age: child.age, gender: child.address, design: config.childDesign, wardrobe: loaded.book.plan.wardrobe });
  assertChildAnchorRenderPlan(request.prompt, technique.length, request.referenceMode);
  return { technique, request, age: child.age };
}
/** Read-only view of the opt-in: version, pinned files (verified now), steps and limits. No key, no provider, nothing written. */
export function previewChildAnchor(config: NewBookConfig) {
  resolveChildAnchorTechnique(config.workspace);
  return { version: CHILD_ANCHOR_STYLE_VERSION, identitySource: 'description' as const, referenceMode: 'style' as const,
    technique: CHILD_ANCHOR_TECHNIQUE_MANIFEST.map(({ label, file, sha256 }) => ({ label, file, sha256 })), manifestSha256: CHILD_ANCHOR_MANIFEST_SHA256,
    steps: Object.keys(CHILD_ANCHOR_RULES), maxCalls: CHILD_ANCHOR_API_CALLS, reviewReservationMicroUsd: SOL_PIXEL_REVIEW_SLOT_MICRO_USD,
    correction: 'one edit of the rejected candidate (book_design, rejected_edit_target) only for a known defect; its own style and design + age reviews',
    providerCalls: 0, keyRead: false };
}
/**
 * The opt-in child stage after admission: the pinned technique files copied in by hash; the render in `style` mode; its style review, then
 * (unless style is unassessable) its design + age review, each bound to this candidate, the written design context and the render recipe.
 * One correction edit only for a known defect, with its own reviews (an earlier image's PASS never carries). All three dimensions of the final
 * candidate must pass; uncertain or missing evidence holds. The adoption keeps the legacy design record for the reviewed-book loader.
 */
async function runChildAnchor(a: { anchor: ReturnType<typeof childAnchorAdmission>; images: string; context: unknown; contextSha: string;
  render: Render; style: ChildAnchorStyleJudge; design: ChildAnchorDesignJudge; check: () => void; save: (name: string, value: unknown) => void;
  seal: (status: string, extra?: Record<string, unknown>) => void; log: (line: string) => void; adopt: (candidate: AuditionImage) => void }) {
  // The pinned files' exact bytes, copied once (exclusive) into this stage's own folder; the render adapter re-checks each hash before sending.
  const refs = a.anchor.technique.map((t, i) => {
    const imageName = `style_ref_${i + 1}.png`, file = path.join(a.images, imageName);
    writeFileSync(file, t.bytes, { flag: 'wx' });
    if (sha(readFileSync(file)) !== t.sha256) fail('child_anchor_reference_changed');
    return { imageName, imageSha: t.sha256 };
  });
  const attempt = async (step: 'reference_child' | 'reference_child_repair', prompt: string, inputs: AuditionImage[], mode: 'style' | 'book_design',
    roles: readonly BookDesignReferenceRole[] | undefined, references: ChildAnchorRecipe['references'], rejected: AuditionImage | null) => {
    a.check();
    const candidate = await a.render(step, prompt, inputs, mode, roles); a.check();
    if (rejected && candidate.imageSha === rejected.imageSha) fail('new_book_child_repair_unchanged');
    const recipe = childAnchorAttemptRecipe(step, mode, references, prompt, a.anchor.age);
    const recipeSha = childAnchorRecipeSha(recipe);
    const style = childAnchorStyleDisposition(await a.style(`${step}_style_qa`, candidate, a.contextSha, recipeSha), candidate.imageSha, a.contextSha, recipeSha);
    a.save(`${step}_style_review`, { recipe, recipeSha, ...style }); a.log(`${step} style: ${style.disposition}`);
    // An unassessable style holds the candidate: its design review would not change that, so it is not requested.
    if (style.disposition === 'held_uncertain') return { candidate, recipe, style, design: null, outcome: childAnchorDisposition(style, null) };
    a.check();
    const design = childAnchorDesignDisposition(await a.design(`${step}_qa`, candidate, a.context, a.contextSha, recipe), candidate.imageSha, a.contextSha, recipe);
    a.save(`${step}_design_review`, { recipe, recipeSha, design: design.design, apparentAge: design.apparentAge, review: design.full });
    a.log(`${step} design: ${design.design}, apparent age: ${design.apparentAge.verdict}`);
    return { candidate, recipe, style, design, outcome: childAnchorDisposition(style, design) };
  };
  const { request, technique } = a.anchor;
  let current = await attempt('reference_child', request.prompt, refs, 'style', undefined,
    technique.map(t => ({ role: t.label, sha256: t.sha256 })), null);
  if (current.outcome.disposition === 'repair') {
    const rejected = current.candidate, prompt = childAnchorCorrectionPrompt(request.core, current.outcome.corrections);
    assertChildAnchorRenderPlan(prompt, 1, 'book_design', CHILD_ANCHOR_CORRECTION_ROLES);
    a.save('reference_child_correction_input', { candidate: rejected, corrections: current.outcome.corrections, authority: 'rejected_edit_input_only_not_canonical' });
    current = await attempt('reference_child_repair', prompt, [rejected], 'book_design', CHILD_ANCHOR_CORRECTION_ROLES,
      [{ role: 'rejected_edit_target', sha256: rejected.imageSha }], rejected);
  }
  if (current.outcome.disposition !== 'passed' || !current.design) {
    a.seal('child_reference_held', { disposition: current.outcome.disposition, childAnchor: CHILD_ANCHOR_STYLE_VERSION });
    return { status: 'child_reference_held' as const };
  }
  const { candidate } = current;
  const anchorRecord = childAnchorAdoptionRecord(current.recipe, current.style.review, current.design.full);
  // The same re-derivation the grant runs: the adopted candidate's own three dimensions, nothing from an earlier image.
  assertChildAnchorAccepted(anchorRecord, candidate.imageSha, a.contextSha);
  a.save('reference_child_adoption', { name: 'child', context: a.context, review: current.design.review, candidate,
    authority: 'new_book_experiment_reviewed_passed', anchor: anchorRecord });
  a.adopt(candidate);
  a.seal('child_reference_passed', { candidate, childAnchor: CHILD_ANCHOR_STYLE_VERSION });
  return { status: 'child_reference_passed' as const, candidate };
}

export async function runNewBookChild(args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void; adapters?: ChildAdapters }) {
  const { config, signal } = args;
  const chain = assertExperimentClaim(config);
  const dir = experimentDir(config), childDir = path.join(dir, 'child'), images = path.join(childDir, 'illustrations');
  realDirectory(dir);
  // The reviewed text is the continuation's when the one approved continuation ran.
  if (!textUsable(config, chain)) fail('new_book_text_not_supported');
  // A carried reservation enters this stage's meter only for the original request the roots derive, and a repaired storyboard only for the
  // planner request its roots derive (both re-derived before anything is created or claimed).
  const producer = await assertDerivedRoots(config, chain);
  const prior = textStage(config, chain);
  const layoutFor = (childImage?: string) => experimentLayout(config, childImage, prior.folder);
  const loaded = loadReviewedStoryboard(dir, config.workspace, layoutFor());
  sameRoots(config, producer);
  // Opted in: the pinned technique files and the first request as the real image seam plans it, before anything is created or claimed.
  const anchor = config.childAnchor ? childAnchorAdmission(config, loaded) : null;
  try { mkdirSync(childDir); } catch { fail('new_book_child_used'); }
  mkdirSync(images);
  const terms = childTerms(config);
  const meter = new AuditionMeter(path.join(childDir, 'paid-stages'), NEW_BOOK_EXPERIMENT.apiCapMicroUsd, terms.maxCalls, prior.knownMicroUsd,
    prior.carriedUnresolvedMicroUsd, meterRules(terms.rules));
  const save = (name: string, value: unknown) => exclusiveJson(path.join(childDir, `${name}.json`), value);
  const check = () => { if (signal.aborted) fail('new_book_cancelled'); assertExperimentClaim(config); sameRoots(config, producer); };
  const key = keyReader(config.keyEnvFile);
  // The claim, the source pin and the repaired folder guard every render claim too (including the one repair edit after a judgment).
  const io = args.adapters?.render ? null : auditionAdapters({ directory: images, meter, key, signal,
    guard: () => { assertExperimentClaim(config); sameRoots(config, producer); } });
  const render: Render = args.adapters?.render ?? ((step, prompt, refs, mode, roles) => io!.render(step, prompt, refs, mode, roles));
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
    if (anchor) {
      const reviews = args.adapters?.style && args.adapters?.design ? null : childAnchorJudges({ bytesOf: image => readAuditionImage(images, image), meter, key, signal,
        guard: () => { assertExperimentClaim(config); sameRoots(config, producer); } });
      return await runChildAnchor({ anchor, images, context, contextSha, render, style: args.adapters?.style ?? reviews!.style,
        design: args.adapters?.design ?? reviews!.design, check, save, seal, log: args.log,
        adopt: candidate => exclusiveJson(path.join(dir, 'book-layout.json'), layoutFor(candidate.imageName)) });
    }
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

/**
 * child-anchor-style/v1 acceptance as the stage actually requested and was answered (no write, no provider). Each attempt's recipe is rebuilt
 * from the admitted request (the correction's prompt from the first attempt's settled answers); its render wire must be that request as the
 * image seam plans it, each review wire the payload binding that recipe to the candidate the render returned, each answer the settled
 * provider output (completed, priced). The adoption must be exactly the record those answers derive; a rehashed saved assertion is not one.
 */
function assertChildAnchorSettled(anchor: ReturnType<typeof childAnchorAdmission>, childDir: string, adoption: any, candidateSha: string, context: unknown) {
  const contextSha = previewSha(JSON.stringify(context)), paid = path.join(childDir, 'paid-stages'), same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
  const settled = (step: string) => {
    const at = (kind: string) => path.join(paid, `${step}.${kind}.json`);
    if (!existsSync(at('result'))) fail('child_anchor_evidence_missing');
    const result = read(at('result'));
    if (result.completed !== true || !Number.isSafeInteger(result.estimatedMicroUsd)) fail('child_anchor_evidence_missing');
    return { wire: read(at('wire')), receipt: read(at('receipt')) };
  };
  const answer = (receipt: any) => { try { return JSON.parse(receipt.raw.output_text); } catch { return fail('child_anchor_evidence_missing'); } };
  const attempt = (step: 'reference_child' | 'reference_child_repair', prompt: string, mode: 'style' | 'book_design',
    roles: readonly BookDesignReferenceRole[] | undefined, references: ChildAnchorRecipe['references']) => {
    const recipe = childAnchorAttemptRecipe(step, mode, references, prompt, anchor.age), recipeSha = childAnchorRecipeSha(recipe);
    const render = settled(step), plan = assertChildAnchorRenderPlan(prompt, references.length, mode, roles), candidate = render.receipt?.candidate;
    if (!same(render.wire.body, plan.bodyWithoutBinaryImage) || render.wire.mode !== plan.apiMode || !same(render.wire.referenceRoles ?? null, plan.referenceRoles ?? null) ||
        !Array.isArray(render.wire.references) || !same(render.wire.references.map((r: AuditionImage) => r.imageSha), references.map(r => r.sha256)) ||
        typeof candidate?.imageSha !== 'string' || !/^[a-f0-9]{64}$/.test(candidate.imageSha)) fail('child_anchor_render_binding');
    const styleCall = settled(`${step}_style_qa`), image = `sha256:${candidate.imageSha}`;
    if (!same(styleCall.wire, digestImages(childAnchorStylePayload({ candidateSha: candidate.imageSha, contextSha, recipeSha, candidateURL: image }))))
      fail('child_anchor_review_binding');
    const style = childAnchorStyleDisposition(answer(styleCall.receipt), candidate.imageSha, contextSha, recipeSha);
    if (style.disposition === 'held_uncertain') return { candidate, recipe, style, design: null, outcome: childAnchorDisposition(style, null) };
    const designCall = settled(`${step}_qa`), crops = designCall.wire?.input?.[0]?.content?.slice(2).map((c: { image_url?: unknown }) => c?.image_url);
    if (!Array.isArray(crops) || crops.length !== 4 || crops.some(c => typeof c !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(c)) ||
        !same(designCall.wire, digestImages(childAnchorDesignPayload({ candidateSha: candidate.imageSha, contextSha, context, recipe, imageURLs: [image, ...crops] }))))
      fail('child_anchor_review_binding');
    const design = childAnchorDesignDisposition(answer(designCall.receipt), candidate.imageSha, contextSha, recipe);
    return { candidate, recipe, style, design, outcome: childAnchorDisposition(style, design) };
  };
  const { request, technique } = anchor;
  const first = attempt('reference_child', request.prompt, 'style', undefined, technique.map(t => ({ role: t.label, sha256: t.sha256 })));
  const final = first.outcome.disposition !== 'repair' ? first
    : attempt('reference_child_repair', childAnchorCorrectionPrompt(request.core, first.outcome.corrections), 'book_design', CHILD_ANCHOR_CORRECTION_ROLES,
      [{ role: 'rejected_edit_target', sha256: first.candidate.imageSha }]);
  if (final.outcome.disposition !== 'passed' || !final.design || final.candidate.imageSha !== candidateSha) fail('child_anchor_not_accepted');
  // Exactly the calls this path makes: no other claimed (or unsettled) call beside them.
  const steps = (final === first ? ['reference_child'] : ['reference_child', 'reference_child_repair']).flatMap(s => [s, `${s}_style_qa`, `${s}_qa`]);
  const claimed = readdirSync(paid).filter(n => n.endsWith('.claim.json')).map(n => n.slice(0, -'.claim.json'.length));
  if (!same(claimed.sort(), steps.sort())) fail('child_anchor_evidence_steps');
  const record = childAnchorAdoptionRecord(final.recipe, final.style.review, final.design!.full);
  if (!same(adoption?.anchor, record) || adoption?.candidate?.imageSha !== candidateSha) fail('child_anchor_evidence_binding');
  return assertChildAnchorAccepted(record, candidateSha, contextSha);
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

export async function writeNewBookGrant(config: NewBookConfig) {
  const producer = await assertDerivedRoots(config, assertExperimentClaim(config));
  const grant = newBookGrant(config);
  sameRoots(config, producer);
  exclusiveJson(path.join(experimentDir(config), 'audition.grant.json'), grant);
  return grant;
}
/** The one grant the verified ledgers (every call re-derived from its own evidence) and the reviewed book derive; written once, then compared. */
function newBookGrant(config: NewBookConfig): AuditionGrant {
  const chain = assertExperimentClaim(config), { claimSha256 } = chain;
  const dir = experimentDir(config), childDir = path.join(dir, 'child'), textFolder = textFolderOf(chain);
  if (!textUsable(config, chain) || sealedStatus(childDir) !== 'child_reference_passed') fail('new_book_stage_not_passed');
  const layout = readReviewedBookLayout(path.join(dir, 'book-layout.json'));
  if (canonicalJson(layout) !== canonicalJson(experimentLayout(config, layout.childImage, textFolder))) fail('new_book_layout');
  const loaded = loadReviewedBook(dir, config.workspace, undefined, layout);
  // Opted in: the adopted child's acceptance re-derived from the authorized request and the stage's settled calls (the loader re-checked its
  // design record and context); the adoption's own saved recipe and hash echoes are never the authority.
  if (config.childAnchor) {
    assertChildAnchorSettled(childAnchorAdmission(config, loaded), childDir, read(path.join(childDir, 'reference_child_adoption.json')),
      previewSha(loaded.childBytes), simpleReferenceDesignContext(reviewedChildDesign(loaded.prepared, loaded.book, layout)));
  }
  const text = textStage(config, chain), terms = childTerms(config);
  const child = stageLedger(childDir, terms.maxCalls, text.knownMicroUsd, text.carriedUnresolvedMicroUsd, terms.rules);
  const prior = text.knownMicroUsd + child.knownMicroUsd, carried = text.carriedUnresolvedMicroUsd;
  if (prior + carried >= NEW_BOOK_EXPERIMENT.apiCapMicroUsd) fail('new_book_budget_exhausted');
  const grant: AuditionGrant = { version: 'audition-spend-grant/v1', approvalReference: NEW_BOOK_EXPERIMENT.approval,
    book: { requestId: loaded.queued.requestId, storyboardDigest: loaded.book.storyboardDigest },
    ledger: { priorKnownApiMicroUsd: prior, ...(carried ? { carriedUnresolvedMicroUsd: carried } : {}),
      evidence: [...text.evidence, { file: child.file, sha256: child.sha256 }],
      note: carried
        ? `New-book experiment ledger under the one $7 API cap: known spend of the text stage, its continuation and the child reference, plus the timed-out storyboard call's cost, still unknown, carried in full as an unresolved reservation (never known spend). The Goni book's ledger is separate and unchanged.`
        : chain.repair?.carryResolutionSha256
        ? `New-book experiment ledger under the one $7 API cap: known spend of the text stage, its continuations, the storyboard repair and the child reference; the timed-out storyboard call is counted at the charge Guy attested from his own provider usage records (carry resolution, recorded above), in place of its reservation. The Goni book's ledger is separate and unchanged.`
        : `New-book experiment ledger: starts at $0 for this book under the one $7 API cap; text stage and child reference recorded above. The Goni book's ledger is separate and unchanged.` },
    capMicroUsd: NEW_BOOK_EXPERIMENT.apiCapMicroUsd, maxCalls: AUDITION_WORST_CASE_CALLS,
    scope: { mode: 'render', pages: [0, 1, 2, 3, 4, 5, 6, 7, 8], sample: earliestSameScenePair(loaded.book) },
    claudeMax: NEW_BOOK_EXPERIMENT.claudeMax,
    // Usable only through this experiment's guarded audition stage (never a bare runner with another output folder).
    experiment: { slot: NEW_BOOK_EXPERIMENT.slot, claimSha256 } };
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
  const chain = assertExperimentClaim(config), { claimSha256 } = chain;
  // The scale comparison binds the held audition by every record: once it is recorded, the audition never starts or resumes again.
  if (chain.comparison) fail('new_book_audition_closed');
  const dir = experimentDir(config), grantFile = path.join(dir, 'audition.grant.json'), out = path.join(dir, 'audition');
  if (!textUsable(config, chain) ||
      sealedStatus(path.join(dir, 'child')) !== 'child_reference_passed' ||
      !existsSync(grantFile)) fail('new_book_stage_not_passed');
  const grant = read(grantFile), grantSha256 = sha(readFileSync(grantFile));
  if (grant.experiment?.slot !== NEW_BOOK_EXPERIMENT.slot || grant.experiment?.claimSha256 !== claimSha256) fail('new_book_grant_binding');
  // The grant must be exactly the one the verified ledgers derive now (its prior, carried reserve, evidence, cap and scope), never a number
  // written into the file since: a start and every resume re-derive it from the records' own evidence.
  const producer = await assertDerivedRoots(config, chain);
  if (canonicalJson(grant) !== canonicalJson(newBookGrant(config))) fail('new_book_grant_ledger');
  sameRoots(config, producer);
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
    experiment: { slot: NEW_BOOK_EXPERIMENT.slot, claimSha256, guard: () => { assertExperimentClaim(config); sameRoots(config, producer); } } });
}

// ---------------------------------------------------------------------------------------------------------------
// Stage 5: the one scale comparison of the held audition (a diagnostic of the opt-in lineup, never a continuation of the audition). Its
// amendment re-pins the reviewed source and binds the held audition (start record, grant, seal, sample pages and every record of its folder);
// its grant is the one the verified ledgers derive (the text stages, the child and the held audition's own calls, each re-derived), and it
// runs through the guarded runner into its own folder. One start; a resume continues the same folder and meter.
// ---------------------------------------------------------------------------------------------------------------
/** Its paid calls at most: the entities sheet's attempts (render + review), then each page once (render + review + identity). */
const COMPARISON_API_CALLS = 2 * REVIEWED_AUDITION_POLICY.sheetAttempts + 2 * 3 * NEW_BOOK_SCALE_COMPARISON.pageAttempts;
export const experimentComparisonFile = (config: NewBookConfig) =>
  path.join(path.dirname(experimentClaimFile(config)), `${NEW_BOOK_EXPERIMENT.slot}.${NEW_BOOK_SCALE_COMPARISON.id}.json`);
export const experimentComparisonGrant = (config: NewBookConfig) => path.join(experimentDir(config), `${NEW_BOOK_SCALE_COMPARISON.outDir}.grant.json`);
const comparisonSchema = z.object({ version: z.literal('new-book-scale-comparison/v1'), id: z.literal(NEW_BOOK_SCALE_COMPARISON.id),
  slot: z.literal(NEW_BOOK_EXPERIMENT.slot), approval: z.literal(NEW_BOOK_SCALE_COMPARISON.approval), claimSha256: hash, configSha256: hash,
  previousSha256: hash, originalSourceHead: headSha, previousSourceHead: headSha, sourceHead: headSha,
  auditionStartSha256: hash, auditionGrantSha256: hash, auditionStatus: z.literal('held_sample'), pages: z.array(z.number().int().min(1).max(8)).length(2),
  priorKnownApiMicroUsd: z.number().int().nonnegative(), carriedUnresolvedMicroUsd: z.number().int().nonnegative(),
  evidence: z.array(z.object({ file: z.string().regex(/^audition\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?$/), sha256: hash }).strict()).min(8).max(400) }).strict();
export type NewBookScaleComparison = z.infer<typeof comparisonSchema>;
/**
 * The held audition as its own records state it (reads only): started once (its start record names this folder, its grant and the claim) and
 * sealed at its sample gate (held_sample), having drawn exactly its grant's two sample pages.
 */
function heldAudition(config: NewBookConfig, claimSha256: string) {
  const dir = experimentDir(config), start = experimentAuditionStart(config), grantFile = path.join(dir, 'audition.grant.json'), out = path.join(dir, 'audition');
  const manifestFile = path.join(out, 'reviewed_audition_manifest.json');
  if (!existsSync(start) || !existsSync(grantFile) || !existsSync(manifestFile)) return fail('new_book_comparison_scope');
  const record = read(start), grant = read(grantFile), manifest = read(manifestFile), grantSha256 = sha(readFileSync(grantFile));
  const sample: unknown = grant?.scope?.mode === 'render' ? grant.scope.sample : undefined;
  if (record?.version !== 'new-book-audition-start/v1' || !sameDir(String(record.out), out) || record.grantSha256 !== grantSha256 ||
      record.claimSha256 !== claimSha256 || manifest?.status !== 'held_sample' || !Array.isArray(sample) || sample.length !== 2 ||
      canonicalJson(manifest?.scope?.sample) !== canonicalJson(sample) || canonicalJson(manifest?.scope?.frames) !== canonicalJson(sample)) fail('new_book_comparison_scope');
  return { out, pages: sample as number[], startSha256: sha(readFileSync(start)), grantSha256 };
}
/**
 * The recorded scale comparison (null when none), verified against the acceptance amendment and the held audition it compares with: its start
 * record and grant by hash, its seal and sample pages, and every record of its folder exactly as the amendment bound them.
 */
function readScaleComparison(config: NewBookConfig, claimSha256: string, acceptance: NewBookAcceptance | null): NewBookScaleComparison | null {
  const file = experimentComparisonFile(config);
  if (!existsSync(file)) return null;
  if (!acceptance) return fail('new_book_continuation');
  const parsed = comparisonSchema.safeParse(read(file));
  if (!parsed.success || parsed.data.claimSha256 !== claimSha256 || parsed.data.configSha256 !== sha(canonicalJson(config)) ||
      parsed.data.originalSourceHead !== config.sourceHead || parsed.data.previousSourceHead !== acceptance.sourceHead ||
      parsed.data.previousSha256 !== sha(readFileSync(experimentAcceptanceFile(config)))) return fail('new_book_continuation');
  const held = heldAudition(config, claimSha256);
  if (held.startSha256 !== parsed.data.auditionStartSha256 || held.grantSha256 !== parsed.data.auditionGrantSha256 ||
      canonicalJson(held.pages) !== canonicalJson(parsed.data.pages) ||
      canonicalJson(folderEvidence(experimentDir(config), 'audition')) !== canonicalJson(parsed.data.evidence)) fail('new_book_continuation_evidence');
  return parsed.data;
}
/** The verified ledger the comparison starts from: the text stages and the child (as the audition grant derived them), then the held audition's own calls. */
function comparisonLedger(config: NewBookConfig, chain: ContinuationChain) {
  const dir = experimentDir(config), text = textStage(config, chain), terms = childTerms(config);
  const child = stageLedger(path.join(dir, 'child'), terms.maxCalls, text.knownMicroUsd, text.carriedUnresolvedMicroUsd, terms.rules);
  const before = text.knownMicroUsd + child.knownMicroUsd;
  const audition = stageLedger(path.join(dir, 'audition'), AUDITION_WORST_CASE_CALLS, before, text.carriedUnresolvedMicroUsd, auditionMeterRules);
  return { knownMicroUsd: before + audition.knownMicroUsd, carriedUnresolvedMicroUsd: text.carriedUnresolvedMicroUsd, audition };
}
/** The comparison's one grant, derived from the verified ledgers and its recorded amendment: written once, then compared on a resume. */
function comparisonGrant(config: NewBookConfig, chain: ContinuationChain, claimSha256: string): AuditionGrant {
  const recorded = chain.comparison;
  if (!recorded) return fail('new_book_comparison_binding');
  const dir = experimentDir(config), ledger = comparisonLedger(config, chain);
  if (ledger.knownMicroUsd !== recorded.priorKnownApiMicroUsd || ledger.carriedUnresolvedMicroUsd !== recorded.carriedUnresolvedMicroUsd) fail('new_book_continuation_ledger');
  if (ledger.knownMicroUsd + ledger.carriedUnresolvedMicroUsd >= NEW_BOOK_EXPERIMENT.apiCapMicroUsd) fail('new_book_budget_exhausted');
  const layout = readReviewedBookLayout(path.join(dir, 'book-layout.json'));
  if (canonicalJson(layout) !== canonicalJson(experimentLayout(config, layout.childImage, textFolderOf(chain)))) fail('new_book_layout');
  const { queued, book } = loadReviewedStoryboard(dir, config.workspace, layout);
  const evidence = [path.join(dir, 'audition.grant.json'), ledger.audition.file, experimentComparisonFile(config)].map(file => ({ file, sha256: sha(readFileSync(file)) }));
  return { version: 'audition-spend-grant/v1', approvalReference: NEW_BOOK_SCALE_COMPARISON.approval,
    book: { requestId: queued.requestId, storyboardDigest: book.storyboardDigest },
    ledger: { priorKnownApiMicroUsd: ledger.knownMicroUsd, ...(ledger.carriedUnresolvedMicroUsd ? { carriedUnresolvedMicroUsd: ledger.carriedUnresolvedMicroUsd } : {}), evidence,
      note: 'New-book experiment ledger under the one $7 API cap: the held audition grant (the text stages and the child reference), the held audition\'s own calls (each re-derived) and the scale comparison amendment; the timed-out storyboard call stays carried as before. The comparison adds its own calls under the same cap.' },
    capMicroUsd: NEW_BOOK_EXPERIMENT.apiCapMicroUsd, maxCalls: COMPARISON_API_CALLS,
    scope: { mode: 'render', pages: [...recorded.pages], scaleLineup: AUDITION_SCALE_LINEUP_VERSION,
      reuseSheets: { sourceRun: path.join(dir, 'audition'), roles: [...NEW_BOOK_SCALE_COMPARISON.reuseSheets] }, pageAttempts: NEW_BOOK_SCALE_COMPARISON.pageAttempts },
    claudeMax: NEW_BOOK_EXPERIMENT.claudeMax, experiment: { slot: NEW_BOOK_EXPERIMENT.slot, claimSha256 } };
}
/**
 * The comparison's admission at ONE pinned HEAD (compared, never adopted): the clean source; the unchanged claim and its whole chain through
 * the owner's acceptance; the child passed; the held audition (start record, grant, seal, sample pages, every record); every ledger re-derived;
 * once recorded, the amendment's own HEAD equal to the pin; the source-derived roots; then, before anything is written, the reused sheet: the
 * held run's saved locations sheet and its raw reviews (readReusedSheets) under a context identical to the one the lineup run computes.
 */
async function admitComparison(config: NewBookConfig, head: string) {
  const dir = experimentDir(config);
  const baseline = () => {
    assertExperimentSource(config, head);
    const { claimSha256 } = verifiedClaim(config), first = readContinuation(config, claimSha256);
    const refused = first ? readRefusedChain(config, claimSha256, first) : [], repair1 = first ? readRepair(config, claimSha256, first, refused) : null;
    const repair2 = readRepair2(config, claimSha256, repair1), acceptance = readAcceptance(config, claimSha256, repair2);
    if (!first || refused.length !== REFUSED_STEPS.length || !repair1 || !repair2 || !acceptance) return fail('new_book_comparison_scope');
    const amended = readScaleComparison(config, claimSha256, acceptance);
    if (amended && amended.sourceHead !== head) fail('new_book_source_changed');
    const chain: ContinuationChain = { continuation: first, refused, repair: repair1, repair2, acceptance };
    if (!textUsable(config, chain) || sealedStatus(path.join(dir, 'child')) !== 'child_reference_passed') fail('new_book_comparison_scope');
    const held = heldAudition(config, claimSha256), ledger = comparisonLedger(config, chain);
    return { claimSha256, chain, amended, held, prior: ledger.knownMicroUsd, carried: ledger.carriedUnresolvedMicroUsd,
      acceptanceSha256: sha(readFileSync(experimentAcceptanceFile(config))), evidence: folderEvidence(dir, 'audition') };
  };
  const admitted = baseline();
  await assertDerivedRoots(config, admitted.chain);
  const same = () => { if (canonicalJson(baseline()) !== canonicalJson(admitted)) fail('new_book_continuation_evidence'); };
  same();
  // The reused sheet binds now, before any amendment, folder or call: the held run's own record and raw reviews, each describing exactly the
  // complete context the lineup run derives (not only its claimed sha).
  const layout = readReviewedBookLayout(path.join(dir, 'book-layout.json')), loaded = loadReviewedBook(dir, config.workspace, undefined, layout);
  const reused = readReusedSheets({ sourceRun: path.join(dir, 'audition'), roles: NEW_BOOK_SCALE_COMPARISON.reuseSheets }, { requestId: loaded.queued.requestId,
    storyboardDigest: loaded.book.storyboardDigest, child: { imageName: 'reference_child.png', imageSha: previewSha(loaded.childBytes) },
    companion: { imageName: 'reference_companion.png', imageSha: previewSha(loaded.companionBytes) } }, path.join(dir, NEW_BOOK_SCALE_COMPARISON.outDir),
    derivedSheetContexts(loaded.book, loaded.texts, NEW_BOOK_SCALE_COMPARISON.reuseSheets, true));
  const designs = auditionSheetDesigns(loaded.book, loaded.texts, true);
  const amendment = comparisonSchema.parse({ version: 'new-book-scale-comparison/v1', id: NEW_BOOK_SCALE_COMPARISON.id, slot: NEW_BOOK_EXPERIMENT.slot,
    approval: NEW_BOOK_SCALE_COMPARISON.approval, claimSha256: admitted.claimSha256, configSha256: sha(canonicalJson(config)), previousSha256: admitted.acceptanceSha256,
    originalSourceHead: config.sourceHead, previousSourceHead: admitted.chain.acceptance!.sourceHead, sourceHead: head,
    auditionStartSha256: admitted.held.startSha256, auditionGrantSha256: admitted.held.grantSha256, auditionStatus: 'held_sample', pages: admitted.held.pages,
    priorKnownApiMicroUsd: admitted.prior, carriedUnresolvedMicroUsd: admitted.carried, evidence: admitted.evidence });
  if (admitted.amended && canonicalJson(admitted.amended) !== canonicalJson(amendment)) fail('new_book_continuation_evidence');
  const locations = reused.sheets.locations!;
  const summary = { recorded: !!admitted.amended, pages: admitted.held.pages, auditionStatus: 'held_sample' as const,
    priorKnownApiMicroUsd: admitted.prior, carriedUnresolvedMicroUsd: admitted.carried,
    remainingMicroUsd: NEW_BOOK_EXPERIMENT.apiCapMicroUsd - admitted.prior - admitted.carried, maxCalls: COMPARISON_API_CALLS,
    pageAttempts: NEW_BOOK_SCALE_COMPARISON.pageAttempts, reuseSheets: [...NEW_BOOK_SCALE_COMPARISON.reuseSheets], scaleLineup: designs.entities.scaleLineup,
    reusedLocations: { status: locations.status, chosenAttempt: locations.chosen.attempt, image: locations.chosen.candidate },
    providerCalls: 0, keyRead: false };
  return { admitted, same, amendment, summary };
}
/** Read-only preview of the comparison: its pages, ledger, lineup and reused sheet, and whether it is recorded. */
export async function previewScaleComparison(config: NewBookConfig) {
  return (await admitComparison(config, currentHead(config))).summary;
}
/**
 * The one comparison: admitted at the pinned HEAD, its amendment written once (exclusive), then the whole chain through it, the roots and the
 * grant the verified ledgers derive, then the guarded runner into its own folder. A resume needs the recorded amendment, folder and grant.
 */
export async function runNewBookScaleComparison(args: { config: NewBookConfig; signal: AbortSignal; log: (line: string) => void; resume?: true }) {
  const { config } = args, dir = experimentDir(config), out = path.join(dir, NEW_BOOK_SCALE_COMPARISON.outDir), grantFile = experimentComparisonGrant(config);
  const { admitted, same, amendment } = await admitComparison(config, currentHead(config));
  if (args.resume) {
    if (!admitted.amended || !existsSync(out) || !existsSync(grantFile)) fail('new_book_comparison_binding');
  } else {
    if (admitted.amended || existsSync(out) || existsSync(grantFile)) fail('new_book_comparison_used');
    same();
    try { exclusiveJson(experimentComparisonFile(config), amendment); } catch { fail('new_book_comparison_used'); }
  }
  // From here the amendment pins the source: the whole chain through it, the roots it builds on, then the one grant the ledgers derive.
  const chain = assertExperimentClaim(config);
  if (!chain.comparison) return fail('new_book_comparison_binding');
  const producer = await assertDerivedRoots(config, chain);
  const grant = comparisonGrant(config, chain, chain.claimSha256);
  sameRoots(config, producer);
  if (args.resume) { if (canonicalJson(read(grantFile)) !== canonicalJson(grant)) fail('new_book_comparison_binding'); }
  else exclusiveJson(grantFile, grant);
  process.env.GPT_IMAGE_EDIT_MAX_REFERENCES ??= '4';
  return runReviewedAudition({ bookDir: dir, out, keyFile: config.keyEnvFile, grantFile, signal: args.signal, log: args.log,
    layout: readReviewedBookLayout(path.join(dir, 'book-layout.json')), ...(args.resume ? { resume: true as const } : {}),
    experiment: { slot: NEW_BOOK_EXPERIMENT.slot, claimSha256: chain.claimSha256, guard: () => { assertExperimentClaim(config); sameRoots(config, producer); } } });
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
    continuation2: existsSync(experimentContinuation2File(config)), continuation3: existsSync(experimentContinuation3File(config)),
    carryResolution: existsSync(experimentCarryResolutionFile(config)), repair: existsSync(experimentRepairFile(config)),
    repair2: existsSync(experimentRepair2File(config)), ownerAcceptance: existsSync(experimentAcceptanceFile(config)),
    scaleComparison: existsSync(experimentComparisonFile(config)),
    stages: { text: sealedStatus(path.join(dir, 'text')), continuation: sealedStatus(path.join(dir, NEW_BOOK_CONTINUATION.outDir)),
      continuation2: sealedStatus(path.join(dir, NEW_BOOK_CONTINUATION_2.outDir)), continuation3: sealedStatus(path.join(dir, NEW_BOOK_CONTINUATION_3.outDir)),
      repair: sealedStatus(path.join(dir, NEW_BOOK_STORYBOARD_REPAIR.outDir)), repair2: sealedStatus(path.join(dir, NEW_BOOK_STORYBOARD_REPAIR_2.outDir)),
      child: sealedStatus(path.join(dir, 'child')), grant: existsSync(path.join(dir, 'audition.grant.json')),
      audition: existsSync(experimentAuditionStart(config)), scaleComparison: existsSync(path.join(dir, NEW_BOOK_SCALE_COMPARISON.outDir)) },
    ...(config.childAnchor ? { childAnchor: previewChildAnchor(config) } : {}),
    providerCalls: 0, keyRead: false, runtimeEligible: false };
}

export async function newBookExperimentCLI(argv: string[], deps: { text?: TextTransports; child?: ChildAdapters; log?: (line: string) => void } = {}) {
  // The carry resolution names its attestation file (absolute) right after the stage; every other stage takes flags only.
  const attestation = argv[2] === 'carry-resolution' && argv[3] === '--attestation' && typeof argv[4] === 'string' && path.isAbsolute(argv[4]) ? argv[4] : null;
  const flags = argv.slice(attestation ? 5 : 3);
  if (argv.length < 3 || argv.length > (attestation ? 6 : 5) || argv[0] !== '--config' || !['plan', 'text', 'storyboard-continuation', 'storyboard-continuation-2',
      'storyboard-continuation-3', 'carry-resolution', 'storyboard-repair', 'storyboard-repair-2', 'storyboard-acceptance', 'child', 'grant', 'audition',
      'scale-comparison'].includes(argv[2]) ||
      argv[2] === 'carry-resolution' && !attestation ||
      flags.some(f => f !== '--execute' && f !== '--resume') || new Set(flags).size !== flags.length ||
      flags.includes('--resume') && (!['audition', 'scale-comparison'].includes(argv[2]) || !flags.includes('--execute'))) fail('new_book_arguments');
  const config = newBookConfig(argv[1]), stage = argv[2], execute = flags.includes('--execute'), log = deps.log ?? (line => console.log(line));
  if (stage === 'carry-resolution') return execute ? { mode: 'carry-resolution' as const, resolution: await writeCarryResolution(config, attestation!) }
    : { mode: 'plan' as const, plan: planNewBook(config), carryResolution: await previewCarryResolution(config, attestation!) };
  if (stage === 'storyboard-repair' && !execute) return { mode: 'plan' as const, plan: planNewBook(config), repair: await previewStoryboardRepair(config) };
  if (stage === 'storyboard-repair-2' && !execute) return { mode: 'plan' as const, plan: planNewBook(config), repair2: await previewStoryboardRepair2(config) };
  if (stage === 'storyboard-acceptance') return execute ? { mode: 'storyboard-acceptance' as const, acceptance: await writeOwnerAcceptance(config) }
    : { mode: 'plan' as const, plan: planNewBook(config), acceptance: await previewOwnerAcceptance(config) };
  if (stage === 'scale-comparison' && !execute) return { mode: 'plan' as const, plan: planNewBook(config), comparison: await previewScaleComparison(config) };
  if (stage === 'storyboard-continuation' && !execute) return { mode: 'plan' as const, plan: planNewBook(config),
    continuation: await previewStoryboardContinuation(config) };
  if (stage === 'storyboard-continuation-2' && !execute) return { mode: 'plan' as const, plan: planNewBook(config),
    continuation2: await previewStoryboardContinuation2(config) };
  if (stage === 'storyboard-continuation-3' && !execute) return { mode: 'plan' as const, plan: planNewBook(config),
    continuation3: await previewStoryboardContinuation3(config) };
  if (stage === 'plan' || !execute) return { mode: 'plan' as const, plan: planNewBook(config) };
  const controller = new AbortController(), interrupt = () => controller.abort(); process.on('SIGINT', interrupt);
  try {
    if (stage === 'text') return { mode: 'text' as const, ...await runNewBookText({ config, signal: controller.signal, log, contracts: NEW_BOOK_EXPERIMENT.contracts,
      ...(deps.text ? { transports: deps.text } : {}) }) };
    if (stage === 'storyboard-continuation') return { mode: 'storyboard-continuation' as const, ...await runNewBookStoryboardContinuation({ config,
      signal: controller.signal, log, contracts: NEW_BOOK_EXPERIMENT.contracts, ...(deps.text ? { transports: deps.text } : {}) }) };
    if (stage === 'storyboard-continuation-2') return { mode: 'storyboard-continuation-2' as const, ...await runNewBookStoryboardContinuation2({ config,
      signal: controller.signal, log, ...(deps.text ? { transports: deps.text } : {}) }) };
    if (stage === 'storyboard-continuation-3') return { mode: 'storyboard-continuation-3' as const, ...await runNewBookStoryboardContinuation3({ config,
      signal: controller.signal, log, ...(deps.text ? { transports: deps.text } : {}) }) };
    if (stage === 'storyboard-repair') return { mode: 'storyboard-repair' as const, ...await runNewBookStoryboardRepair({ config,
      signal: controller.signal, log, ...(deps.text ? { transports: deps.text } : {}) }) };
    if (stage === 'storyboard-repair-2') return { mode: 'storyboard-repair-2' as const, ...await runNewBookStoryboardRepair2({ config,
      signal: controller.signal, log, ...(deps.text ? { transports: deps.text } : {}) }) };
    if (stage === 'child') return { mode: 'child' as const, ...await runNewBookChild({ config, signal: controller.signal, log, ...(deps.child ? { adapters: deps.child } : {}) }) };
    if (stage === 'audition') return { mode: 'audition' as const, result: await runNewBookAudition({ config, signal: controller.signal, log,
      ...(flags.includes('--resume') ? { resume: true as const } : {}) }) };
    if (stage === 'scale-comparison') return { mode: 'scale-comparison' as const, result: await runNewBookScaleComparison({ config, signal: controller.signal, log,
      ...(flags.includes('--resume') ? { resume: true as const } : {}) }) };
    return { mode: 'grant' as const, grant: await writeNewBookGrant(config) };
  } finally { process.off('SIGINT', interrupt); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  newBookExperimentCLI(process.argv.slice(2))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error('FAILED', error?.code ?? error?.message ?? error); process.exitCode = 1; });
}
