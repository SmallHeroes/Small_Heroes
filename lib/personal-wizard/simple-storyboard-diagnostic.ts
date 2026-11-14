import { SCALE_REVIEW_ADDENDUM } from './companion-scale';
import { createHash } from 'node:crypto';
import type { EngineContinuityOptions } from './engine-continuity-contracts';
import { MATERIAL_REVIEW_ADDENDUM } from './storyboard-material-function';
import 'server-only';
import {existingChildAppearanceData,type ExistingChildAppearance} from './existing-child-appearance';
import { canonicalJson } from './request-acceptance';
import type { PersonalWizardOptions } from './options';
import { prepareCurrentPersonalStoryboard, authorPersonalStoryboard, compilePersonalStoryboard, personalStoryboardReviewInput, impactStoryboardReviewSchema, claimBasisStoryboardReviewSchema,
  calibrationStoryboardReviewSchema, sceneRelationsStoryboardReviewSchema, personalStoryboardReviewSchema, storyboardReviewDisposition, currentPersonalStoryboardFrame, storyboardInstructions,
  storyboardDraftSchema } from './storyboard';
import { MOMENT_REVIEW_ADDENDUM } from './storyboard-moments';
import { KIND_REVIEW_ADDENDUM } from './storyboard-landmark-kind';
import { INSTANCE_REVIEW_ADDENDUM } from './storyboard-instance-distinction';
import { DRAWN_INSTANT_REVIEW_ADDENDUM } from './storyboard-drawn-instant';
import { SELF_CHECK_REVIEW_ADDENDUM, SELF_CHECK_SOURCE_SPANS_REVIEW_ADDENDUM } from './storyboard-self-check';
import { STORYBOARD_REVIEW_IMPACT_ADDENDUM } from './storyboard-review-impact';
import { CLAIM_BASIS_REVIEW_ADDENDUM, CLAIM_BASIS_SELF_CHECK_REVIEW_RULE, CLAIM_BASIS_STAGING_FIELDS_REVIEW_RULE } from './storyboard-claim-basis';
import { CALIBRATION_REVIEW_IMPACT_ADDENDUM, CALIBRATION_REVIEW_ADDENDUM, calibrationClaimBasisReviewAddendum, calibrationSelfCheckReviewAddendum } from './storyboard-calibration';
import { PRESENCE_REVIEW_ADDENDUM } from './storyboard-presence';
import type { StoryboardPreservation } from './storyboard-preservation';
import type { StoryboardRepair } from './storyboard-repair';
import { PERSONAL_BOOK_REVIEW_INSTRUCTION, type BookVisualCall } from './book-runner';
import { personalBookOutputLimits } from './book-config';
import { stateParityReviewerCalibration, STATE_PARITY_REVIEW_ADDENDUM } from './storyboard-state-parity';
import { SOURCE_CONCURRENCY_REVIEW_ADDENDUM } from './storyboard-source-concurrency';
import { SCENE_RELATIONS_REVIEW } from './storyboard-scene-relations';
import { storyboardReviewCapacity, type StoryboardReviewCapacity } from './storyboard-review-capacity';

export const SIMPLE_STORYBOARD_DIAGNOSTIC_VERSION = 'personal-simple-storyboard-diagnostic/offline-v1' as const;
export const SIMPLE_STORYBOARD_INPUT_LIMIT = 104_000;
export type SimpleStoryboardDiagnosticCall = BookVisualCall & {
  schema: ReturnType<typeof storyboardDraftSchema> | typeof personalStoryboardReviewSchema | typeof impactStoryboardReviewSchema | typeof sceneRelationsStoryboardReviewSchema
    | typeof claimBasisStoryboardReviewSchema | typeof calibrationStoryboardReviewSchema;
};
/**
 * The review call's instructions for a storyboard under these contracts (shared by every caller that reviews a storyboard). Under the
 * calibration (which needs the claim basis) the self-check, typed-impact and claim-basis entries it refines are replaced, never contradicted,
 * and its own addendum closes the instruction; the presence contract (which needs the calibration) appends its rule after it.
 */
export const storyboardReviewInstructions = (contracts: { momentContract?: true; landmarkKindContract?: true; drawnInstantContract?: true;
  selfCheckContract?: true; selfCheckSourceSpans?: true; reviewImpactPolicy?: true; claimBasisContract?: true; stagingFields?: true; calibrationContract?: true; presenceContract?: true; stateParityContract?: true;
  instanceDistinctionContract?: true; engineContinuity?: EngineContinuityOptions }) => {
  if (contracts.stateParityContract !== undefined && (contracts.stateParityContract !== true || contracts.calibrationContract !== true || contracts.claimBasisContract !== true))
    throw Error('simple_storyboard_diagnostic_state_parity_policy');
  if(contracts.engineContinuity?.sourceConcurrency!==undefined&&(contracts.engineContinuity.sourceConcurrency!==true||contracts.presenceContract!==true||contracts.stateParityContract!==true))
    throw Error('simple_storyboard_diagnostic_source_concurrency_policy');
  const calibrated = contracts.calibrationContract && contracts.claimBasisContract;
  if (contracts.engineContinuity?.sceneRelations && (!calibrated || !contracts.engineContinuity.sourceConcurrency ||
      !contracts.instanceDistinctionContract || !contracts.reviewImpactPolicy)) throw Error('simple_storyboard_diagnostic_scene_relations_policy');
  return PERSONAL_BOOK_REVIEW_INSTRUCTION + (contracts.momentContract ? '\n' + MOMENT_REVIEW_ADDENDUM : '')
    + (contracts.landmarkKindContract ? '\n' + KIND_REVIEW_ADDENDUM : '') + (contracts.drawnInstantContract ? '\n' + DRAWN_INSTANT_REVIEW_ADDENDUM : '')
    + (contracts.selfCheckContract ? '\n' + (calibrated ? calibrationSelfCheckReviewAddendum()
      : contracts.claimBasisContract ? claimBasisSelfCheckReviewAddendum() : SELF_CHECK_REVIEW_ADDENDUM) : '')
    + (contracts.reviewImpactPolicy ? '\n' + (calibrated ? concurrencyReviewImpactAddendum(contracts.engineContinuity?.sourceConcurrency) : STORYBOARD_REVIEW_IMPACT_ADDENDUM) : '')
    + (contracts.claimBasisContract ? '\n' + (calibrated ? calibrationClaimBasisReviewAddendum() : CLAIM_BASIS_REVIEW_ADDENDUM) : '')
    + (contracts.claimBasisContract && contracts.stagingFields ? '\n' + CLAIM_BASIS_STAGING_FIELDS_REVIEW_RULE : '')
    + (calibrated ? '\n' + (contracts.stateParityContract ? stateParityReviewerCalibration() : CALIBRATION_REVIEW_ADDENDUM) : '')
    + (calibrated && contracts.presenceContract ? '\n' + PRESENCE_REVIEW_ADDENDUM : '')
    + (contracts.selfCheckSourceSpans ? '\n' + SELF_CHECK_SOURCE_SPANS_REVIEW_ADDENDUM : '')
    + (contracts.stateParityContract ? '\n' + STATE_PARITY_REVIEW_ADDENDUM : '')
    + (contracts.instanceDistinctionContract ? '\n' + INSTANCE_REVIEW_ADDENDUM : '') + (contracts.engineContinuity?.materialFunction ? '\n' + MATERIAL_REVIEW_ADDENDUM : '') + (contracts.engineContinuity?.companionScale ? '\n' + SCALE_REVIEW_ADDENDUM : '')
    + (contracts.engineContinuity?.sourceConcurrency?'\n'+SOURCE_CONCURRENCY_REVIEW_ADDENDUM:'')
    + (contracts.engineContinuity?.sceneRelations ? '\n' + SCENE_RELATIONS_REVIEW : '');
};
/** Replace the generic note rule only for the explicitly stricter temporal contract. Legacy bytes remain exact. */
function concurrencyReviewImpactAddendum(enabled?:true){
  if(!enabled)return CALIBRATION_REVIEW_IMPACT_ADDENDUM;
  const ordinary='inference and setting with a positive reason are notes.';
  if(!CALIBRATION_REVIEW_IMPACT_ADDENDUM.includes(ordinary))throw Error('simple_storyboard_diagnostic_concurrency_severity_rule');
  return CALIBRATION_REVIEW_IMPACT_ADDENDUM.replace(ordinary,
    'inference and setting with a positive reason are notes ONLY for ordinary non-concurrency references. ANY issue on p{n}:concurrent:* is material regardless of impact, basis or citation; uncertain temporal support remains HOLD');
}
/** The self-check review addendum under the claim basis: its claims rule admits a cited span and reads staged claims (replaced, never contradicted). */
function claimBasisSelfCheckReviewAddendum() {
  const lines = SELF_CHECK_REVIEW_ADDENDUM.split('\n'), at = lines.findIndex(l => l.startsWith('- claims:'));
  if (at < 0) return fail('claim_basis_review_rule');
  return [...lines.slice(0, at), CLAIM_BASIS_SELF_CHECK_REVIEW_RULE, ...lines.slice(at + 1)].join('\n');
}
export class SimpleStoryboardDiagnosticError extends Error {
  constructor(readonly code: string) { super(`simple_storyboard_diagnostic_${code}`); }
}
const fail = (code: string): never => { throw new SimpleStoryboardDiagnosticError(code); };

/**
 * Injected diagnostic only. No default transport, key, network, reservation, retry or image authority.
 * A future paid caller must enforce its own approved transport/accounting before supplying generate.
 */
export type SimpleStoryboardDiagnosticArgs = {
  request: unknown; writerResult: unknown; options: PersonalWizardOptions; signal: AbortSignal;
  generate: (call: SimpleStoryboardDiagnosticCall, signal: AbortSignal) => Promise<unknown>;
  inputByteLimit?: number;
  /** REVIEW only; keeps complete input bytes and planner/default capacities unchanged. */
  reviewCapacity?: StoryboardReviewCapacity;
  actorOwnedAppearance?: true;
  /** Opt-in drawn-instant/page-meaning contract; absent keeps the exact existing calls. */
  momentContract?: true;
  /** Opt-in landmark-kind contract; absent keeps the exact existing calls. */
  landmarkKindContract?: true;
  /** Opt-in re-plan of an approved parent (needs the kind contract); absent keeps the exact existing calls. */
  preservation?: StoryboardPreservation;
  /** Opt-in scene-location instruction contract; absent keeps the exact existing calls. */
  sceneLocationContract?: true;
  /** Opt-in compiler-rules instruction contract; absent keeps the exact existing calls. */
  compilerRulesContract?: true;
  /** Opt-in focused repair of a held storyboard of this source (same contracts, calls and caps); absent keeps the exact existing calls. */
  repair?: StoryboardRepair;
  /** Opt-in drawn-instant contract (needs the moments contract); absent keeps the exact existing calls. */
  drawnInstantContract?: true;
  /** Opt-in visible-moment instruction contract (needs the moments contract; the review is unchanged); absent keeps the exact existing calls. */
  visibleMomentContract?: true;
  /** Opt-in planner self-check (needs the moments contract; the review reads it); absent keeps the exact existing calls. */
  selfCheckContract?: true;
  /** Opt-in typed review materiality (the review's schema, instruction and disposition); absent keeps the exact existing calls. */
  reviewImpactPolicy?: true;
  /** Opt-in compile-level self-check section-name resolution (needs the self-check; no call or source changes); absent keeps the exact compile. */
  selfCheckNames?: true;
  /** Opt-in compile-only actual source-span overlap. The planner request stays unchanged; the new book and review carry its marker. */
  selfCheckSourceSpans?: true;
  /** Opt-in claim basis (storyboard-claim-basis/v1: needs the moments, drawn-instant, self-check and typed-review contracts); absent keeps the exact existing calls. */
  claimBasisContract?: true;
  /** Opt-in compile-level claim-basis staging fields (storyboard-claim-basis-staging-fields/v1; the review reads it); absent keeps the exact compile and review. */
  stagingFields?: true;
  /** Opt-in calibration (storyboard-calibration/v1: needs the claim basis; the planner's and the review's instructions, schemas and compile); absent keeps the exact existing calls. */
  calibrationContract?: true;
  /** Opt-in presence (storyboard-presence/v1: needs the calibration; the planner's instructions, schema and compile, and the review's rule); absent keeps the exact existing calls. */
  presenceContract?: true;
  /** Shared, prospective compiler attribute/time semantics; needs calibration and visible moment. */
  stateParityContract?: true;
  /** Opt-in instance distinction (instance-distinction/v1: needs the landmark-kind contract; the planner's schema/instruction/compile and the review's rule); absent keeps the exact existing calls. */
  instanceDistinctionContract?: true; engineContinuity?: EngineContinuityOptions; existingChildAppearance?: ExistingChildAppearance;
};

/** Legacy author + review path. No change in its calls, source or returned fields. */
export function runSimpleStoryboardDiagnostic(args: SimpleStoryboardDiagnosticArgs) {
  return runStoryboardDiagnostic(args);
}

/** Compile the supplied draft byte-for-byte, then request a NEW review of the resulting source/digest.
 * This injected library grants no draft/identity/spend authority: the engine caller must first admit the parent.
 * No planner invocation or synthetic paid planner result exists on this path. */
export function reviewSimpleStoryboardDraft(args: SimpleStoryboardDiagnosticArgs, draft: unknown) {
  if (args.repair !== undefined || args.preservation !== undefined) fail('review_only_scope');
  return runStoryboardDiagnostic(args, { draft });
}

async function runStoryboardDiagnostic(args: SimpleStoryboardDiagnosticArgs, supplied?: { draft: unknown }) {
  const suppliedCanonical = supplied ? canonicalJson(supplied.draft) : undefined;
  if (args.selfCheckSourceSpans !== undefined && (args.selfCheckSourceSpans !== true || args.selfCheckContract !== true)) fail('self_check_source_spans_policy');
  if (args.stagingFields !== undefined && (args.stagingFields !== true || args.claimBasisContract !== true)) fail('staging_fields_policy');
  if (args.calibrationContract !== undefined && (args.calibrationContract !== true || args.claimBasisContract !== true)) fail('calibration_policy');
  if (args.presenceContract !== undefined && (args.presenceContract !== true || args.calibrationContract !== true)) fail('presence_policy');
  if (args.stateParityContract !== undefined && (args.stateParityContract !== true || args.calibrationContract !== true || args.visibleMomentContract !== true)) fail('state_parity_policy');
  const limit = args.inputByteLimit ?? SIMPLE_STORYBOARD_INPUT_LIMIT;
  const reviewCapacity = storyboardReviewCapacity(args.reviewCapacity);
  if (reviewCapacity && args.inputByteLimit !== undefined) fail('input_policy');
  if (!Number.isInteger(limit) || limit < 1 || limit > SIMPLE_STORYBOARD_INPUT_LIMIT) fail('input_policy');
  if (args.signal.aborted) fail('cancelled');
  // This driver is for the explicit simple envelope only, never archive/v3 substitution.
  if (!args.writerResult || typeof args.writerResult !== 'object' || !('simpleSource' in args.writerResult)) fail('simple_source_required');
  const source = prepareCurrentPersonalStoryboard(args.request, args.writerResult, args.options, args.actorOwnedAppearance, args.momentContract, args.landmarkKindContract,
    args.preservation, args.sceneLocationContract, args.compilerRulesContract, args.repair, args.drawnInstantContract, args.visibleMomentContract,
    args.selfCheckContract, args.reviewImpactPolicy, args.claimBasisContract, args.calibrationContract, args.presenceContract, args.stateParityContract,
    args.instanceDistinctionContract, args.engineContinuity, args.existingChildAppearance);
  const instructions = storyboardInstructions(source);
  const caps = personalBookOutputLimits(source.story.pages.length, args.selfCheckContract ? { selfCheck: true } : undefined);
  const calls: (BookVisualCall & { contentBytes: number; contentByteLimit: number; headroomBytes: number })[] = [];
  const assertCurrent = () => {
    if (args.signal.aborted) fail('cancelled');
    if (supplied && canonicalJson(supplied.draft) !== suppliedCanonical) fail('draft_changed');
    try {
      if (prepareCurrentPersonalStoryboard(args.request, args.writerResult, args.options, args.actorOwnedAppearance, args.momentContract, args.landmarkKindContract,
        args.preservation, args.sceneLocationContract, args.compilerRulesContract, args.repair, args.drawnInstantContract, args.visibleMomentContract,
        args.selfCheckContract, args.reviewImpactPolicy, args.claimBasisContract, args.calibrationContract, args.presenceContract, args.stateParityContract,
        args.instanceDistinctionContract, args.engineContinuity, args.existingChildAppearance).sourceDigest !== source.sourceDigest)
        fail('source_changed');
    } catch (error) {
      if (error instanceof SimpleStoryboardDiagnosticError) throw error;
      fail('source_changed');
    }
  };
  const measure = (instructions: string, input: string, stage: 'storyboard' | 'review' = 'storyboard') => {
    const contentBytes = Buffer.byteLength(instructions, 'utf8') + Buffer.byteLength(input, 'utf8');
    const selectedLimit = stage === 'review' && reviewCapacity ? reviewCapacity.contentBytes : limit;
    if (contentBytes > selectedLimit) fail('input_limit');
    return { contentBytes, contentByteLimit: selectedLimit, headroomBytes: selectedLimit - contentBytes };
  };
  const dispatch = async (call: SimpleStoryboardDiagnosticCall) => {
    assertCurrent();
    const { schema: _schema, ...record } = call;
    calls.push({ ...record, context: { ...record.context }, ...measure(call.instructions, call.input, call.stage) });
    let output: unknown;
    try { output = await args.generate(call, args.signal); }
    catch { return fail(args.signal.aborted ? 'cancelled' : `${call.stage}_callback_failed`); }
    assertCurrent();
    return output;
  };
  // Preflight outside authorPersonalStoryboard's callback-error wrapper, before any injected invocation.
  if (!supplied) measure(instructions, canonicalJson(source.planningInput));
  assertCurrent();
  const compileOptions = args.selfCheckNames || args.stagingFields || args.selfCheckSourceSpans
    ? { ...(args.selfCheckNames ? { selfCheckNames: true as const } : {}), ...(args.stagingFields ? { stagingFields: true as const } : {}),
      ...(args.selfCheckSourceSpans ? { selfCheckSourceSpans: true as const } : {}) } : undefined;
  const storyboard = supplied ? compilePersonalStoryboard(source, supplied.draft, compileOptions)
    : await authorPersonalStoryboard(source, call => dispatch({ stage: 'storyboard',
    instructions: call.instructions, input: canonicalJson(call.input), schema: call.schema,
    maxOutputTokens: caps.storyboardOutputTokens,
    context: { narrativeSpreads: source.story.pages.length, sourceDigest: source.sourceDigest,
      ...(args.actorOwnedAppearance ? { actorOwnedAppearance: true as const } : {}),
      ...(args.momentContract ? { momentContract: true as const } : {}),
      ...(args.landmarkKindContract ? { landmarkKindContract: true as const } : {}),
      ...(args.drawnInstantContract ? { drawnInstantContract: true as const } : {}),
      ...(args.selfCheckContract ? { selfCheckContract: true as const } : {}),
      ...(args.claimBasisContract ? { claimBasisContract: true as const } : {}),
      ...(args.calibrationContract ? { calibrationContract: true as const } : {}),
      ...(args.presenceContract ? { presenceContract: true as const } : {}),
      ...(args.stateParityContract ? { stateParityContract: true as const } : {}),
      ...(args.instanceDistinctionContract ? { instanceDistinctionContract: true as const } : {}), ...(args.engineContinuity ? { engineContinuity: args.engineContinuity } : {}),
      ...(args.existingChildAppearance?{existingChildAppearance:existingChildAppearanceData(args.existingChildAppearance)}:{}) } }), args.signal,
    args.selfCheckNames || args.stagingFields || args.selfCheckSourceSpans ? { ...(args.selfCheckNames ? { selfCheckNames: true as const } : {}), ...(args.stagingFields ? { stagingFields: true as const } : {}),
      ...(args.selfCheckSourceSpans ? { selfCheckSourceSpans: true as const } : {}) }
      : undefined);
  assertCurrent();
  // A changed instant/state is a new storyboard: it gets its own review under the contract, never the old approval.
  const rawReview = await dispatch({ stage: 'review', instructions: storyboardReviewInstructions(args),
    input: canonicalJson(personalStoryboardReviewInput(storyboard)), schema: args.engineContinuity?.sceneRelations ? sceneRelationsStoryboardReviewSchema
      : args.calibrationContract ? calibrationStoryboardReviewSchema
      : args.claimBasisContract ? claimBasisStoryboardReviewSchema : args.reviewImpactPolicy ? impactStoryboardReviewSchema : personalStoryboardReviewSchema,
    maxOutputTokens: caps.reviewOutputTokens,
    context: { narrativeSpreads: storyboard.narrativeSpreads, sourceDigest: storyboard.sourceDigest, storyboardDigest: storyboard.storyboardDigest,
      ...(args.engineContinuity?.sourceConcurrency&&args.presenceContract?{presenceContract:true as const}:{}),
      ...(args.actorOwnedAppearance ? { actorOwnedAppearance: true as const } : {}),
      ...(args.landmarkKindContract ? { landmarkKindContract: true as const } : {}),
      ...(args.reviewImpactPolicy ? { reviewImpactPolicy: true as const } : {}),
      ...(args.claimBasisContract ? { claimBasisContract: true as const } : {}),
      ...(args.calibrationContract ? { calibrationContract: true as const } : {}),
      ...(args.stateParityContract ? { stateParityContract: true as const } : {}),
      ...(args.instanceDistinctionContract ? { instanceDistinctionContract: true as const } : {}), ...(args.engineContinuity ? { engineContinuity: args.engineContinuity } : {}),
      ...(args.existingChildAppearance?{existingChildAppearance:existingChildAppearanceData(args.existingChildAppearance)}:{}),
      ...(reviewCapacity ? { reviewCapacity: reviewCapacity.version } : {}) } });
  const review = storyboardReviewDisposition(storyboard, rawReview);
  assertCurrent();
  // Supported, or (typed policy only) supported with bound detail notes, which the packets then carry.
  const framePackets = review.disposition === 'review_supported' || review.disposition === 'review_supported_with_notes'
    ? Array.from({ length: storyboard.narrativeSpreads + 1 }, (_, pageNumber) => currentPersonalStoryboardFrame(storyboard, rawReview, pageNumber,
      { request: args.request, writerResult: args.writerResult, options: args.options })) : [];
  assertCurrent();
  return { version: SIMPLE_STORYBOARD_DIAGNOSTIC_VERSION, status: review.disposition,
    ...(supplied ? { draftOrigin: { version: 'unchanged-compiled-draft/v1' as const,
      canonicalSha256: createHash('sha256').update(suppliedCanonical!).digest('hex'), plannerInvoked: false as const } } : {}),
    sourceDigest: source.sourceDigest, storyboardDigest: storyboard.storyboardDigest,
    writerResult: source.result, storyboard, rawReview, review, framePackets, calls,
    measurementScope: 'instruction_and_input_utf8_content_not_wire_tokens_or_output_adequacy' as const,
    runtimeEligible: false as const };
}
