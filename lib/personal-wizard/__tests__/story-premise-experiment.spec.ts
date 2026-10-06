import { describe, expect, it } from 'vitest';
import { causalTrialCohort } from '../../../scripts/personal-causal-cohort';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStory, CANDIDATE_PERSONAL_FACT_INSTRUCTIONS } from '../story-writer';
import { fixtureAdventureSelection } from './story-planning-fixture';
import { CAUSAL_EXPERIMENT_VERSION, CAUSAL_PLAN_INSTRUCTIONS, causalDigest, compileCausalPlan } from '../story-causal-experiment';
import { PREMISE_EXPERIMENT_VERSION, PREMISE_ONLY_INSTRUCTIONS, compilePremises, projectJointPremises,
  preparePremiseCall, prepareBlindPremiseReview, compilePremiseDecision, preparePremiseExpansion,
  compilePremiseExpansion } from '../story-premise-experiment';

const options = resolvePersonalWizardOptions(), clone = <T>(value: T): T => structuredClone(value);
function setup(index = 0) {
  const prepared = preparePersonalStory(causalTrialCohort()[index].request, options);
  const factId = prepared.brief.facts.find(f => f.kind === 'interest')!.id;
  const selection = fixtureAdventureSelection(prepared.brief.beats, factId);
  const raw: any = { version: PREMISE_EXPERIMENT_VERSION, requestId: prepared.brief.requestId, candidates: selection.candidates };
  const pair = compilePremises(prepared, raw), review = prepareBlindPremiseReview(prepared, [pair], [1, 0]);
  const decisionRaw: any = { version: PREMISE_EXPERIMENT_VERSION, packetDigest: review.packetDigest, disposition: 'expand', selectedCardId: 'P1',
    assessments: review.packet.cards.map(card => ({ cardId: card.cardId, recommendation: 'expand',
      scores: { interest: 2, causality: 2, childAgency: 2, reciprocity: 2, consistency: 2 },
      topicCoverage: 'unclear', sourceFields: ['childContribution', 'complication'], reason: 'Synthetic diagnostic judgement, not literary proof.' })),
    premiseFamilies: [{ cardIds: ['P1', 'P2'], reason: 'Synthetic family grouping, not a diversity verdict.' }],
    reason: 'Synthetic separate choice of B, not a good-story claim.' };
  const decision = compilePremiseDecision(prepared, review, decisionRaw);
  const plan = { title: 'הרפתקה לבדיקה', childGoal: 'לגלות דרך חדשה', companionWant: 'לנסות משהו ביחד', comicPromise: 'הפתעה בתוך משחק',
    resilience: { mode: prepared.brief.resilienceMode, moments: [{ pageNumber: 2, childChoice: 'בוחרת דרך אחרת', whatHelps: 'החברה מצטרפת' }] },
    beats: Array.from({ length: prepared.brief.beats }, () => ({ location: 'הגינה', transitionReason: 'הגילוי משנה את הדרך',
      childAction: 'מציעה דרך אחרת', companionAction: 'מנסה ביחד', consequence: 'מגלים משהו חדש', factIds: [factId], continuity: 'החפץ איתם' })),
    ending: 'ממשיכים לשחק יחד' };
  const expansionRaw: any = { version: CAUSAL_EXPERIMENT_VERSION, requestId: prepared.brief.requestId, disposition: 'selected',
    premisesDigest: pair.premisesDigest, decisionDigest: decision.decisionDigest, selectedId: 'B',
    synopsis: 'A structurally valid synthetic continuous synopsis, not evidence of story quality.', plan, outlineChecks: selection.outlineChecks };
  const jointRaw: any = { version: CAUSAL_EXPERIMENT_VERSION, requestId: prepared.brief.requestId, disposition: 'selected',
    selection: { ...selection, reason: 'AUTHOR_BIASED_REASON_DO_NOT_SEND' }, synopsis: expansionRaw.synopsis, plan };
  return { prepared, raw, pair, review, decisionRaw, decision, expansionRaw, jointRaw };
}
const fails = (run: () => unknown, code: string) => expect(run).toThrow(`causal_experiment_${code}`);

describe('premise-only generation and honest admission', () => {
  it('shares the exact approved-interest instruction with the joint arm', () => {
    expect(PREMISE_ONLY_INSTRUCTIONS).toContain(CANDIDATE_PERSONAL_FACT_INSTRUCTIONS);
    expect(CAUSAL_PLAN_INSTRUCTIONS).toContain(CANDIDATE_PERSONAL_FACT_INSTRUCTIONS);
  });
  it('prepares only Opus planning input, same brief/cap, no previous output and no transport', () => {
    const h = setup(), call = preparePremiseCall(h.prepared, 'offline:premises');
    expect(call).toMatchObject({ role: 'opus', stage: 'plan', conversationKey: 'offline:premises', instructions: PREMISE_ONLY_INSTRUCTIONS });
    expect(JSON.parse(call.input)).toEqual({ brief: h.prepared.brief, priorRejection: null });
    expect(call.maxOutputTokens).toBe(18000);
    expect(call.schema.safeParse(h.raw).success).toBe(true);
    expect(call.schema.safeParse(h.jointRaw).success).toBe(false);
  });
  it('keeps candidates unreviewed and rejects premature choice, outline or rating keys', () => {
    const h = setup(); expect(h.pair).toMatchObject({ kind: 'unreviewed_premises', runtimeEligible: false, origin: 'premise_only' });
    for (const field of ['selectedId', 'plan', 'synopsis', 'outlineChecks', 'scores']) fails(() => compilePremises(h.prepared, { ...h.raw, [field]: {} }), 'premise_schema');
  });
  it.each(['A', 'B'])('binds approved interest references for %s', id => {
    const h = setup(), raw = clone(h.raw); raw.candidates.find((c: any) => c.id === id).personalFactUses[0].factId = 'f_unknown0001';
    fails(() => compilePremises(h.prepared, raw), 'story_selection_fact_mismatch');
  });
  it('rejects duplicate/missing interest refs and candidate ID substitution', () => {
    const h = setup();
    const duplicate = clone(h.raw); duplicate.candidates[1].personalFactUses.push(clone(duplicate.candidates[1].personalFactUses[0]));
    fails(() => compilePremises(h.prepared, duplicate), 'story_selection_fact_mismatch');
    const noInterest = clone(h.raw); noInterest.candidates[1].personalFactUses = [];
    fails(() => compilePremises(h.prepared, noInterest), 'premise_schema');
    const wrongId = clone(h.raw); wrongId.candidates[1].id = 'A';
    fails(() => compilePremises(h.prepared, wrongId), 'story_selection_identity');
  });
  it('binds the request and preserves literal clones as unreviewed data, never semantic novelty', () => {
    const h = setup(); fails(() => compilePremises(h.prepared, { ...h.raw, requestId: 'f'.repeat(64) }), 'premise_schema');
    const raw = clone(h.raw); raw.candidates[1] = { ...clone(raw.candidates[0]), id: 'B' };
    const repeated = compilePremises(h.prepared, raw);
    expect(repeated.contrast.dimensions).toEqual([]); expect(repeated.kind).toBe('unreviewed_premises');
    raw.candidates[1].childWant += ' again';
    expect(compilePremises(h.prepared, raw).kind).toBe('unreviewed_premises');
  });
  it('projects both joint candidates verbatim, even when held or rejected', () => {
    const h = setup();
    for (const raw of [h.jointRaw, { ...clone(h.jointRaw), selection: { ...clone(h.jointRaw.selection),
      outlineChecks: { ...clone(h.jointRaw.selection.outlineChecks), causal_child_choices: { ...h.jointRaw.selection.outlineChecks.causal_child_choices, outcome: 'needs_work' } } } },
      { version: CAUSAL_EXPERIMENT_VERSION, requestId: h.prepared.brief.requestId, disposition: 'both_rejected',
        candidates: h.raw.candidates, contrast: h.jointRaw.selection.contrast, reason: 'Both ideas need independent assessment before expansion.' }]) {
      const pair = projectJointPremises(h.prepared, raw);
      expect(pair.candidates).toEqual(h.raw.candidates); expect(pair.origin).toBe('joint_projection');
      expect(pair.sourcePlanDigest).toBe(causalDigest(compileCausalPlan(h.prepared, raw)));
      expect(pair).not.toHaveProperty('selectedId'); expect(pair).not.toHaveProperty('reason');
    }
  });
});

describe('blinding and complete fallible review', () => {
  it('supplies the same candidate fields from joint and short sources without author provenance', () => {
    const h = setup(), joint = projectJointPremises(h.prepared, h.jointRaw);
    const review = prepareBlindPremiseReview(h.prepared, [joint, h.pair], [3, 0, 2, 1]);
    expect(review.packet.cards.map(c => c.cardId)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(Object.keys(review.packet.cards[0]).sort()).toEqual(Object.keys(review.packet.cards[1]).sort());
    expect(review.packet.cards[0].childWant).toBe(h.raw.candidates[1].childWant);
    const text = JSON.stringify(review.packet);
    for (const value of ['AUTHOR_BIASED_REASON_DO_NOT_SEND', 'joint_projection', 'premise_only', '"selectedId":', '"sourcePlanDigest":', '"contrast":', '"sourceHead":', '"arm":']) expect(text).not.toContain(value);
    expect(review.packet).not.toHaveProperty('pairs'); expect(review.packet).not.toHaveProperty('order');
  });
  it('random order remains a complete permutation and every card resolves to exact source fields', () => {
    const h = setup(), review = prepareBlindPremiseReview(h.prepared, [h.pair]);
    expect([...review.order].sort()).toEqual([0, 1]);
    review.packet.cards.forEach((card, n) => {
      const { id: _id, ...source } = h.pair.candidates[review.order[n]];
      expect(card).toEqual({ cardId: `P${n + 1}`, ...source });
    });
  });
  it.each([[], [0], [0, 0], [0, 2], [-1, 0], [0, 1.5], [0, 1, 2]].map(order => ({ order })))('rejects invalid order $order', ({ order }) => {
    const h = setup(); fails(() => prepareBlindPremiseReview(h.prepared, [h.pair], order), 'premise_order');
  });
  it('rejects missing sources, changed candidate text and another brief', () => {
    const h = setup(); fails(() => prepareBlindPremiseReview(h.prepared, []), 'premise_sources');
    const changed = clone(h.pair); changed.candidates[0].payoff += ' changed';
    fails(() => prepareBlindPremiseReview(h.prepared, [changed]), 'premise_binding');
    fails(() => prepareBlindPremiseReview(setup(1).prepared, [h.pair]), 'premise_binding');
  });
  it('preserves repeated outputs as separate card occurrences, rather than hiding lack of variety', () => {
    const h = setup(), review = prepareBlindPremiseReview(h.prepared, [h.pair, clone(h.pair)], [0, 1, 2, 3]);
    expect(review.packet.cards).toHaveLength(4);
    expect(review.packet.cards[0].childWant).toBe(review.packet.cards[2].childWant);
    expect(review.packet.cards[0].cardId).not.toBe(review.packet.cards[2].cardId);
  });
  it('records every assessment and extracts cited fields, not reviewer-created quotes', () => {
    const h = setup(); expect(h.decision).toMatchObject({ kind: 'source_bound_judgement_not_story_acceptance', runtimeEligible: false });
    expect(h.decision.evidence[0].fields).toEqual(h.decisionRaw.assessments[0].sourceFields.map((field: string) => ({ field, source: (h.review.packet.cards[0] as any)[field] })));
    const raw = { ...h.decisionRaw, quote: 'A made-up quotation.' };
    fails(() => compilePremiseDecision(h.prepared, h.review, raw), 'premise_decision_binding');
  });
  it.each(['missing_assessment', 'duplicate_assessment', 'unknown_assessment', 'missing_family', 'duplicate_family', 'unknown_family', 'duplicate_field'])('rejects incomplete/duplicated coverage: %s', mode => {
    const h = setup(), review = prepareBlindPremiseReview(h.prepared, [h.pair, clone(h.pair)], [1, 0, 3, 2]);
    const raw = { ...clone(h.decisionRaw), packetDigest: review.packetDigest,
      assessments: review.packet.cards.map(card => ({ ...clone(h.decisionRaw.assessments[0]), cardId: card.cardId })),
      premiseFamilies: [{ cardIds: review.packet.cards.map(card => card.cardId), reason: h.decisionRaw.premiseFamilies[0].reason }] };
    if (mode === 'missing_assessment') raw.assessments.pop();
    if (mode === 'duplicate_assessment') raw.assessments[1] = clone(raw.assessments[0]);
    if (mode === 'unknown_assessment') raw.assessments[1].cardId = 'P9';
    if (mode === 'missing_family') raw.premiseFamilies[0].cardIds.pop();
    if (mode === 'duplicate_family') raw.premiseFamilies[0].cardIds[1] = 'P1';
    if (mode === 'unknown_family') raw.premiseFamilies[0].cardIds[1] = 'P9';
    if (mode === 'duplicate_field') raw.assessments[1].sourceFields = ['payoff', 'payoff'];
    fails(() => compilePremiseDecision(h.prepared, review, raw), 'premise_review_coverage');
  });
  it.each(['interest', 'causality', 'childAgency', 'reciprocity', 'consistency'])('keeps %s separate and bounds its scale', key => {
    const h = setup(), raw = clone(h.decisionRaw); raw.assessments[0].scores[key] = 4;
    fails(() => compilePremiseDecision(h.prepared, h.review, raw), 'premise_decision_binding');
  });
  it('refuses a held or nonexistent selection even if unrelated scores look high', () => {
    const h = setup(), held = clone(h.decisionRaw); held.assessments[0].recommendation = 'hold';
    fails(() => compilePremiseDecision(h.prepared, h.review, held), 'premise_choice_held');
    fails(() => compilePremiseDecision(h.prepared, h.review, { ...h.decisionRaw, selectedCardId: 'P99' }), 'premise_choice_held');
  });
  it('refuses stale packet and a forged changed card even after packetDigest is recomputed', () => {
    const h = setup(); fails(() => compilePremiseDecision(h.prepared, h.review, { ...h.decisionRaw, packetDigest: 'a'.repeat(64) }), 'premise_decision_binding');
    const review = clone(h.review); review.packet.cards[0].payoff += ' changed'; review.packetDigest = causalDigest(review.packet);
    fails(() => compilePremiseDecision(h.prepared, review, { ...h.decisionRaw, packetDigest: review.packetDigest }), 'premise_review_binding');
  });
});

describe('separate choice locks the expansion boundary', () => {
  it('expands only externally chosen B, not original author preference A', () => {
    const h = setup(), call = preparePremiseExpansion(h.prepared, h.review, h.decision, 'offline:expand'), input = JSON.parse(call.input);
    expect(input.selectedPremise).toEqual(h.pair.candidates[1]); expect(input.selectedId).toBe('B');
    for (const field of ['candidates', 'assessments', 'premiseFamilies', 'selection', 'priorRejection']) expect(input).not.toHaveProperty(field);
    const result = compilePremiseExpansion(h.prepared, h.review, h.decision, h.expansionRaw);
    expect(result.expanded.disposition).toBe('selected');
    if (!('selection' in result.expanded)) throw Error('fixture');
    expect(result.expanded.selection.selectedId).toBe('B'); expect(result.expanded.selection.candidates).toEqual(h.pair.candidates);
    expect(result).toMatchObject({ kind: 'diagnostic_expansion_not_book_source', runtimeEligible: false });
  });
  it('terminal HOLD cannot prepare or compile expansion', () => {
    const h = setup(), decision = compilePremiseDecision(h.prepared, h.review, { ...h.decisionRaw, disposition: 'hold', selectedCardId: null });
    fails(() => preparePremiseExpansion(h.prepared, h.review, decision, 'offline:expand'), 'premise_choice_held');
    fails(() => compilePremiseExpansion(h.prepared, h.review, decision, h.expansionRaw), 'premise_choice_held');
  });
  it.each(['selectedId', 'premisesDigest', 'decisionDigest', 'requestId'])('rejects changed expansion %s at the real compiler', key => {
    const h = setup(), raw = clone(h.expansionRaw); raw[key] = key === 'selectedId' ? 'A' : 'f'.repeat(64);
    fails(() => compilePremiseExpansion(h.prepared, h.review, h.decision, raw), 'premise_expansion_binding');
  });
  it('revalidates decision and order, rather than trusting typed objects', () => {
    const h = setup(), changed = clone(h.decision); changed.selectedCardId = 'P2';
    fails(() => preparePremiseExpansion(h.prepared, h.review, changed, 'offline:expand'), 'premise_decision_binding');
    const reordered = clone(h.review); reordered.order.reverse();
    fails(() => preparePremiseExpansion(h.prepared, reordered, h.decision, 'offline:expand'), 'premise_review_binding');
    fails(() => preparePremiseExpansion(setup(1).prepared, h.review, h.decision, 'offline:expand'), 'premise_binding');
  });
  it('reuses real plan fact/resilience/beat checks and retains model outline HOLD', () => {
    const h = setup(), bad = clone(h.expansionRaw); bad.plan.beats[0].factIds = ['f_unknown0001'];
    fails(() => compilePremiseExpansion(h.prepared, h.review, h.decision, bad), 'plan_binding');
    const mismatch = clone(h.expansionRaw); mismatch.plan.resilience.mode = h.prepared.brief.resilienceMode === 'chosen_topic' ? 'adventure_only' : 'chosen_topic';
    fails(() => compilePremiseExpansion(h.prepared, h.review, h.decision, mismatch), 'plan_binding');
    const count = clone(h.expansionRaw); count.plan.beats.pop();
    fails(() => compilePremiseExpansion(h.prepared, h.review, h.decision, count), 'premise_expansion_binding');
    const held = clone(h.expansionRaw); held.outlineChecks.causal_child_choices.outcome = 'needs_work';
    expect(compilePremiseExpansion(h.prepared, h.review, h.decision, held).expanded.disposition).toBe('outline_held');
  });
  it('does not accept joint selection data inside a locked expansion', () => {
    const h = setup(); fails(() => compilePremiseExpansion(h.prepared, h.review, h.decision, { ...h.expansionRaw, selection: h.jointRaw.selection }), 'premise_expansion_binding');
  });
  it('does not mistake matching IDs and self-checks for semantic adherence to the chosen idea', () => {
    const h = setup(), raw = clone(h.expansionRaw);
    raw.plan.beats.forEach((beat: any) => {
      beat.childAction = 'עומדת ומסתכלת מהצד'; beat.companionAction = 'פותחת דלת לא קשורה ומחליטה לבד';
      beat.consequence = 'החברה פתרה הכול לבדה';
    });
    const result = compilePremiseExpansion(h.prepared, h.review, h.decision, raw);
    expect(result.expanded.disposition).toBe('selected');
    expect(result.kind).toBe('diagnostic_expansion_not_book_source'); expect(result.runtimeEligible).toBe(false);
  });
  it('does not fake contrast to expand an identical pair through the legacy contract', () => {
    const h = setup(), raw = clone(h.raw); raw.candidates[1] = { ...clone(raw.candidates[0]), id: 'B' };
    const pair = compilePremises(h.prepared, raw), review = prepareBlindPremiseReview(h.prepared, [pair], [1, 0]);
    const decision = compilePremiseDecision(h.prepared, review, { ...h.decisionRaw, packetDigest: review.packetDigest });
    fails(() => preparePremiseExpansion(h.prepared, review, decision, 'offline:expand'), 'premise_legacy_contrast_unrepresentable');
    expect(review.packet.cards).toHaveLength(2);
  });
});
