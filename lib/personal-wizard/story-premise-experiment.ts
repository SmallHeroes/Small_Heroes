/** Pure diagnostic boundary. No provider, credential, live host, retry or customer route. */
import 'server-only';
import { z } from 'zod';
import { randomInt } from 'node:crypto';
import { canonicalJson } from './request-acceptance';
import { RESILIENCE_INSTRUCTIONS, type PreparedStory } from './story-writer';
import { personalStoryOutputLimits } from './story-config';
import { adventureSelectionSchema, adventureCandidatesIssue, ADVENTURE_DIFFERENCE_DIMENSIONS } from './story-planning-contract';
import { CAUSAL_STORY_INSTRUCTIONS, CAUSAL_NARRATIVE_CRAFT_INSTRUCTIONS, CAUSAL_PLAN_INSTRUCTIONS,
  causalDigest, causalFail, causalPlanSchema, compileCausalPlan } from './story-causal-experiment';
import type { CausalDispatch } from './story-causal-experiment-runner';

export const PREMISE_EXPERIMENT_VERSION = 'personal-premise-boundary/diagnostic-v1';
export const PREMISE_CRITERIA = ['interest', 'causality', 'childAgency', 'reciprocity', 'consistency'] as const;
const candidateSchema = adventureSelectionSchema.shape.candidates.element;
type Candidate = z.infer<typeof candidateSchema>;
const candidateFields = ['curiosity', 'childWant', 'companionWant', 'complication', 'discovery', 'childContribution', 'payoff', 'personalFactUses'] as const;
const note = z.string().trim().min(10).max(240);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const PREMISE_ONLY_INSTRUCTIONS = `${CAUSAL_STORY_INSTRUCTIONS}\n${RESILIENCE_INSTRUCTIONS}\n${CAUSAL_NARRATIVE_CRAFT_INSTRUCTIONS}
This diagnostic call produces ONLY two short adventure premises A and B in the supplied candidate fields. Do not select, rank, write a synopsis, expand into beats, or supply self-checks. Narrative fields mentioned above are guidance, not additional response keys. Use the same approved brief; no prior story or example is available.
Each premise uses an approved interest fact ID, without inventing real competence or history. An interest can influence motive, attention, play, choice or action; it need not supply a magical mechanism. Describe why the adventure is interesting, not merely how it demonstrates coping. Different scenery or wording alone does not establish a different adventure; goals, complications, partnership, discoveries or resolutions may genuinely differ. These are comparison dimensions, not a mandatory plot recipe. Do not manufacture a weak alternative to justify a favourite. A reviewer will separately assess both; your response is not approval.`;

export function premisePairSchema(prepared: PreparedStory) {
  return z.object({ version: z.literal(PREMISE_EXPERIMENT_VERSION), requestId: z.literal(prepared.brief.requestId),
    candidates: adventureSelectionSchema.shape.candidates }).strict();
}
function literalContrast(candidates: Candidate[], prepared: PreparedStory) {
  // Existing comparison/reference guards only. This is NOT semantic novelty detection.
  const referenceIssue = adventureCandidatesIssue({ candidates,
    contrast: { dimensions: [], explanation: 'Reference-only precheck; literal contrasts are checked separately below.' } }, prepared.brief.facts);
  if (referenceIssue) return causalFail(referenceIssue);
  const dimensions = ADVENTURE_DIFFERENCE_DIMENSIONS.filter(key => adventureCandidatesIssue({ candidates,
    contrast: { dimensions: [key], explanation: 'Literal comparison only, not proof of different adventures.' } }, prepared.brief.facts) === null);
  // Zero differences is a measured weak/repeated output, not a reason to discard it.
  return { dimensions, explanation: 'Literal field differences only; source-bound external judgement remains fallible.' };
}
function pairRecord(prepared: PreparedStory, candidates: Candidate[], origin: 'premise_only' | 'joint_projection', sourcePlanDigest: string | null) {
  const parsed = adventureSelectionSchema.shape.candidates.safeParse(candidates);
  if (!parsed.success) return causalFail('premise_schema');
  const contrast = literalContrast(parsed.data, prepared);
  const body = { version: PREMISE_EXPERIMENT_VERSION, kind: 'unreviewed_premises' as const, origin,
    requestDigest: causalDigest(prepared.accepted.canonical), briefDigest: causalDigest(prepared.brief),
    sourcePlanDigest, candidates: parsed.data, contrast, runtimeEligible: false as const };
  return { ...body, premisesDigest: causalDigest(body) };
}
export type PremisePair = ReturnType<typeof pairRecord>;
export function compilePremises(prepared: PreparedStory, raw: unknown): PremisePair {
  const parsed = premisePairSchema(prepared).safeParse(raw);
  if (!parsed.success) return causalFail('premise_schema');
  return pairRecord(prepared, parsed.data.candidates, 'premise_only', null);
}
export function projectJointPremises(prepared: PreparedStory, raw: unknown): PremisePair {
  const plan = compileCausalPlan(prepared, raw);
  // Both alternatives survive, including model HOLD/rejection. Never export the author's choice/reason.
  return pairRecord(prepared, 'selection' in plan ? plan.selection.candidates : plan.candidates,
    'joint_projection', causalDigest(plan));
}
function assertPair(prepared: PreparedStory, pair: PremisePair) {
  if (pair.requestDigest !== causalDigest(prepared.accepted.canonical) || pair.briefDigest !== causalDigest(prepared.brief) ||
    !['premise_only', 'joint_projection'].includes(pair.origin) ||
    (pair.origin === 'premise_only' ? pair.sourcePlanDigest !== null : !digestSchema.safeParse(pair.sourcePlanDigest).success)) return causalFail('premise_binding');
  const expected = pairRecord(prepared, pair.candidates, pair.origin, pair.sourcePlanDigest);
  if (causalDigest(expected) !== causalDigest(pair)) return causalFail('premise_binding');
}
export function preparePremiseCall(prepared: PreparedStory, conversationKey: string): CausalDispatch {
  return { role: 'opus', stage: 'plan', conversationKey, instructions: PREMISE_ONLY_INSTRUCTIONS,
    input: canonicalJson({ brief: prepared.brief, priorRejection: null }), schema: premisePairSchema(prepared),
    maxOutputTokens: personalStoryOutputLimits(prepared.brief.beats).planOutputTokens + 6000 };
}

export function prepareBlindPremiseReview(prepared: PreparedStory, pairs: readonly PremisePair[], requestedOrder?: readonly number[]) {
  // Repeated outputs are data, not a reason to cherry-pick them away. Occurrence is bound by position.
  if (!pairs.length || pairs.length > 6) return causalFail('premise_sources');
  pairs.forEach(pair => assertPair(prepared, pair));
  if (requestedOrder !== undefined && !Array.isArray(requestedOrder)) return causalFail('premise_order');
  const total = pairs.length * 2, order = requestedOrder ? [...requestedOrder] : Array.from({ length: total }, (_, i) => i);
  if (order.length !== total || new Set(order).size !== total || order.some(i => !Number.isSafeInteger(i) || i < 0 || i >= total)) return causalFail('premise_order');
  if (!requestedOrder) for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  const cards = order.map((index, n) => {
    const { id: _id, ...candidate } = pairs[Math.floor(index / 2)].candidates[index % 2];
    return { cardId: `P${n + 1}`, ...structuredClone(candidate) };
  });
  const packet = { version: PREMISE_EXPERIMENT_VERSION, kind: 'blind_premise_review' as const,
    brief: structuredClone(prepared.brief), criteria: [...PREMISE_CRITERIA], cards,
    instructions: 'Assess each idea separately; scores are fallible claims, not story acceptance. Group premise families separately from quality. Distinguish different mechanisms inside one premise family from different adventures. An author selection, explanation or arm is not supplied. Do not write or fix a story. Familiar words, meaningful child action, mutual care and consequential topic coverage matter; do not require a fixed coping arc or plot. Cite sourceFields; source text is resolved by code, not copied by the reviewer.' };
  const body = { packet, packetDigest: causalDigest(packet), pairs: structuredClone(pairs), order,
    requestDigest: causalDigest(prepared.accepted.canonical), briefDigest: causalDigest(prepared.brief), runtimeEligible: false as const };
  return { ...body, reviewDigest: causalDigest(body) };
}
export type BlindPremiseReview = ReturnType<typeof prepareBlindPremiseReview>;
function assertReview(prepared: PreparedStory, review: BlindPremiseReview) {
  const expected = prepareBlindPremiseReview(prepared, review.pairs, review.order);
  if (causalDigest(expected) !== causalDigest(review)) return causalFail('premise_review_binding');
}
const assessmentSchema = z.object({ cardId: z.string(), recommendation: z.enum(['expand', 'hold']),
  scores: z.object({ interest: z.number().int().min(0).max(3), causality: z.number().int().min(0).max(3),
    childAgency: z.number().int().min(0).max(3), reciprocity: z.number().int().min(0).max(3), consistency: z.number().int().min(0).max(3) }).strict(),
  topicCoverage: z.enum(['supported', 'partial', 'unclear', 'not_applicable']),
  sourceFields: z.array(z.enum(candidateFields)).min(1).max(8), reason: note }).strict();
const decisionCommon = { version: z.literal(PREMISE_EXPERIMENT_VERSION), packetDigest: digestSchema,
  assessments: z.array(assessmentSchema).min(2).max(12),
  premiseFamilies: z.array(z.object({ cardIds: z.array(z.string()).min(1).max(12), reason: note }).strict()).min(1).max(12), reason: note };
export const premiseDecisionSchema = z.discriminatedUnion('disposition', [
  z.object({ ...decisionCommon, disposition: z.literal('hold'), selectedCardId: z.null() }).strict(),
  z.object({ ...decisionCommon, disposition: z.literal('expand'), selectedCardId: z.string() }).strict(),
]);
export function compilePremiseDecision(prepared: PreparedStory, review: BlindPremiseReview, raw: unknown) {
  assertReview(prepared, review);
  const parsed = premiseDecisionSchema.safeParse(raw);
  if (!parsed.success || parsed.data.packetDigest !== review.packetDigest) return causalFail('premise_decision_binding');
  const decision = parsed.data, cards = new Map(review.packet.cards.map(card => [card.cardId, card]));
  const ids = decision.assessments.map(row => row.cardId), grouped = decision.premiseFamilies.flatMap(row => row.cardIds);
  if (ids.length !== cards.size || new Set(ids).size !== cards.size || ids.some(id => !cards.has(id)) ||
    grouped.length !== cards.size || new Set(grouped).size !== cards.size || grouped.some(id => !cards.has(id)) ||
    decision.assessments.some(row => new Set(row.sourceFields).size !== row.sourceFields.length)) return causalFail('premise_review_coverage');
  if (decision.disposition === 'expand' && decision.assessments.find(row => row.cardId === decision.selectedCardId)?.recommendation !== 'expand') return causalFail('premise_choice_held');
  // This pure boundary cannot attest who supplied the judgement or its semantic correctness.
  const body = { ...decision, kind: 'source_bound_judgement_not_story_acceptance' as const,
    requestDigest: review.requestDigest, briefDigest: review.briefDigest, reviewDigest: review.reviewDigest,
    evidence: decision.assessments.map(row => ({ cardId: row.cardId,
      fields: row.sourceFields.map(field => ({ field, source: structuredClone(cards.get(row.cardId)![field]) })) })), runtimeEligible: false as const };
  return { ...body, decisionDigest: causalDigest(body) };
}
export type PremiseDecision = ReturnType<typeof compilePremiseDecision>;
function assertDecision(prepared: PreparedStory, review: BlindPremiseReview, decision: PremiseDecision) {
  const raw = { version: decision.version, packetDigest: decision.packetDigest, assessments: decision.assessments,
    premiseFamilies: decision.premiseFamilies, reason: decision.reason, disposition: decision.disposition, selectedCardId: decision.selectedCardId };
  if (causalDigest(compilePremiseDecision(prepared, review, raw)) !== causalDigest(decision)) return causalFail('premise_decision_binding');
}
function selectedPair(prepared: PreparedStory, review: BlindPremiseReview, decision: PremiseDecision) {
  assertDecision(prepared, review, decision);
  if (decision.disposition !== 'expand') return causalFail('premise_choice_held');
  const position = review.packet.cards.findIndex(card => card.cardId === decision.selectedCardId);
  const original = review.order[position], pair = review.pairs[Math.floor(original / 2)];
  return { pair, candidate: pair.candidates[original % 2] };
}
export function premiseExpansionSchema(prepared: PreparedStory, review: BlindPremiseReview, decision: PremiseDecision) {
  const { pair, candidate } = selectedPair(prepared, review, decision);
  // Until the legacy outline contract changes, do not invent a contrast to satisfy it.
  if (!pair.contrast.dimensions.length) return causalFail('premise_legacy_contrast_unrepresentable');
  return causalPlanSchema(prepared).options[0].omit({ selection: true }).extend({
    premisesDigest: z.literal(pair.premisesDigest), decisionDigest: z.literal(decision.decisionDigest),
    selectedId: z.literal(candidate.id), outlineChecks: adventureSelectionSchema.shape.outlineChecks,
  }).strict();
}
export function preparePremiseExpansion(prepared: PreparedStory, review: BlindPremiseReview, decision: PremiseDecision, conversationKey: string): CausalDispatch {
  const { pair, candidate } = selectedPair(prepared, review, decision);
  return { role: 'opus', stage: 'plan', conversationKey,
    instructions: CAUSAL_PLAN_INSTRUCTIONS + '\nThis call is EXPANSION ONLY after a separately source-bound choice. The A/B generation and selection guidance above has already been completed. Only the selected candidate is provided; preserve its meaning while developing it, do not generate alternatives or change the choice. Return the supplied expansion schema with synopsis, plan and fallible outlineChecks. Do not return a selection object. A prepared expansion is not authority to spend, write prose or release a book.',
    input: canonicalJson({ brief: prepared.brief, selectedPremise: candidate, premisesDigest: pair.premisesDigest,
      decisionDigest: decision.decisionDigest, selectedId: candidate.id }),
    schema: premiseExpansionSchema(prepared, review, decision),
    maxOutputTokens: personalStoryOutputLimits(prepared.brief.beats).planOutputTokens + 6000 };
}
export function compilePremiseExpansion(prepared: PreparedStory, review: BlindPremiseReview, decision: PremiseDecision, raw: unknown) {
  const { pair, candidate } = selectedPair(prepared, review, decision), parsed = premiseExpansionSchema(prepared, review, decision).safeParse(raw);
  if (!parsed.success) return causalFail('premise_expansion_binding');
  const { premisesDigest, decisionDigest, selectedId, outlineChecks, ...output } = parsed.data;
  const expanded = compileCausalPlan(prepared, { ...output,
    selection: { candidates: pair.candidates, contrast: pair.contrast, selectedId: candidate.id, reason: decision.reason, outlineChecks } });
  const body = { version: PREMISE_EXPERIMENT_VERSION, kind: 'diagnostic_expansion_not_book_source' as const,
    premisesDigest, decisionDigest, selectedId, expanded, runtimeEligible: false as const };
  return { ...body, expansionDigest: causalDigest(body) };
}
