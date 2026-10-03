import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson } from './request-acceptance';
import { comparableText } from './contract';
import { personalManuscriptSchema, personalStoryPlanSchema } from './story-contract';
import { adventureSelectionSchema, adventureCandidatesIssue, adventureSelectionIssue } from './story-planning-contract';
import { STORY_INSTRUCTIONS, RESILIENCE_INSTRUCTIONS, NARRATIVE_CRAFT_INSTRUCTIONS, type PreparedStory } from './story-writer';
import { STORY_EDITOR_INSTRUCTIONS, storyEditorOutputTokens, type StoryEditorCall } from './story-editor';
import { storyEditorProviderSchema, decodeStoryEditorOutput } from './story-editor-openai';
import { assertSemanticEditEvidence, semanticEditNeedsWork } from './story-semantic-audit';
import { measureStoryText } from './story-text-metrics';
import { prepareOriginalStoryTextReview, prepareStoryTextReview, type StoryReviewDocument } from './story-text-review';

export const CAUSAL_EXPERIMENT_VERSION = 'personal-causal-experiment/diagnostic-v1';
export const causalDigest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
export class CausalExperimentError extends Error {
  constructor(readonly code: string) { super(`causal_experiment_${code}`); }
}
export const causalFail = (code: string): never => { throw new CausalExperimentError(code); };
const note = z.string().trim().min(10).max(600);
const proseReference = z.object({ pageNumber: z.number().int().min(1).max(16), quote: z.string().min(4).max(220) }).strict();
const beatReference = proseReference.extend({ field: z.enum(['childAction', 'companionAction', 'consequence', 'continuity']) });
export const BACKWARD_DEPENDENCIES = ['changedState', 'childDiscovery', 'enablingSetup', 'companionContribution', 'earnedPayoff'] as const;
const dependency = z.object({ claim: note, evidence: z.array(beatReference).min(1).max(3) }).strict();
const backward = z.object({ changedState: dependency, childDiscovery: dependency, enablingSetup: dependency,
  companionContribution: dependency, earnedPayoff: dependency }).strict();
const candidatePair = adventureSelectionSchema.pick({ candidates: true, contrast: true });
// Explicit diagnostic instruction profile. Keep every other approved constraint,
// but do not impose the legacy failed-attempt plot on every experimental book.
const legacyAttemptClause = 'a failed attempt with consequences and ';
if (STORY_INSTRUCTIONS.split(legacyAttemptClause).length !== 2 || !STORY_EDITOR_INSTRUCTIONS.startsWith(STORY_INSTRUCTIONS)) {
  throw new CausalExperimentError('instruction_profile_changed');
}
export const CAUSAL_STORY_INSTRUCTIONS = STORY_INSTRUCTIONS.replace(legacyAttemptClause, '') +
  '\nA failed attempt is optional. A boundary, negotiation, helping another character, changed goal or creative compromise can carry resilience. Do not require all these or impose the same sequence on every book.';
const causalEditorInstructions = CAUSAL_STORY_INSTRUCTIONS + STORY_EDITOR_INSTRUCTIONS.slice(STORY_INSTRUCTIONS.length);

export const CAUSAL_PLAN_INSTRUCTIONS = `${CAUSAL_STORY_INSTRUCTIONS}\n${RESILIENCE_INSTRUCTIONS}\n${NARRATIVE_CRAFT_INSTRUCTIONS}
This is PLANNING ONLY, no manuscript. Compare two genuinely different adventures A and B using curiosity, discovery, consequential child choices, companion want and earned payoff, with approved fact IDs. Scenery/prop substitutions are insufficient. Say why a child would want the next part and which surprising, funny or emotional ending is worth reaching. If BOTH ideas are weak, return both_rejected with the two ideas and reason, not a forced choice or plan. Only the host may permit one separately reserved planning reattempt.
For a selected idea, first describe the entire adventure as a continuous synopsis, not a compliance list. Then produce exactly the chosen number of ordered beats. Work backwards from the climax: what changed, how the child noticed/tried/understood, the prepared ability/object/rule enabling action, why the companion matters, and the established desire/relationship paid off. Cite exact fields of actual planned beats. These are questions, NOT a plot formula. No mandatory timer, broken object, companion mistake, mechanical rescue or location quota. A special rule has explicit conditions and consequences; a climax cannot quietly change it. A fundamental unresolved outline problem must mark needs_work; prose is not a rescue for a weak premise. Do not number beat arrays; the engine numbers them. No other child's profile or prior story is available.`;

export function causalPlanSchema(prepared: PreparedStory) {
  const count = prepared.brief.beats;
  const plan = personalStoryPlanSchema.omit({ requestId: true }).extend({
    beats: z.array(personalStoryPlanSchema.shape.beats.element.omit({ pageNumber: true })).length(count),
  });
  return z.discriminatedUnion('disposition', [
    z.object({ version: z.literal(CAUSAL_EXPERIMENT_VERSION), requestId: z.literal(prepared.brief.requestId),
      disposition: z.literal('selected'), selection: adventureSelectionSchema,
      synopsis: z.string().trim().min(40).max(2400), backwardDependencies: backward, plan }).strict(),
    z.object({ version: z.literal(CAUSAL_EXPERIMENT_VERSION), requestId: z.literal(prepared.brief.requestId),
      disposition: z.literal('both_rejected'), candidates: candidatePair.shape.candidates,
      contrast: candidatePair.shape.contrast, reason: note }).strict(),
  ]);
}
export function compileCausalPlan(prepared: PreparedStory, raw: unknown) {
  const parsed = causalPlanSchema(prepared).safeParse(raw);
  if (!parsed.success) return causalFail('plan_schema');
  const data = parsed.data;
  const choice = data.disposition === 'selected' ? data.selection : data;
  const issue = adventureCandidatesIssue(choice, prepared.brief.facts);
  if (issue) return causalFail(issue);
  const binding = { requestDigest: causalDigest(prepared.accepted.canonical), briefDigest: causalDigest(prepared.brief) };
  if (data.disposition === 'both_rejected') return { ...data, ...binding, runtimeEligible: false as const };
  const plan = { ...data.plan, requestId: prepared.brief.requestId,
    beats: data.plan.beats.map((beat, i) => ({ ...beat, pageNumber: i + 1 })) };
  assertPlan(prepared, plan);
  const selectionIssue = adventureSelectionIssue(data.selection, prepared.brief.facts, prepared.brief.beats, plan.beats.flatMap(b => b.factIds));
  if (selectionIssue && selectionIssue !== 'story_outline_held') return causalFail(selectionIssue);
  for (const key of BACKWARD_DEPENDENCIES) for (const ref of data.backwardDependencies[key].evidence) {
    if (!plan.beats[ref.pageNumber - 1]?.[ref.field].includes(ref.quote)) causalFail('dependency_evidence');
  }
  // Exact references prove provenance, never causal entailment or literary merit.
  const body = { ...data, plan, ...binding, planDigest: causalDigest(plan), runtimeEligible: false as const };
  return { ...body, disposition: selectionIssue ? 'outline_held' as const : 'selected' as const,
    planningDigest: causalDigest(body) };
}
export type CausalPlan = ReturnType<typeof compileCausalPlan>;
export type SelectedCausalPlan = Extract<CausalPlan, { planningDigest: string }>;

function assertPlan(prepared: PreparedStory, plan: z.infer<typeof personalStoryPlanSchema>) {
  const known = new Set(prepared.brief.facts.map(f => f.id));
  if (plan.requestId !== prepared.brief.requestId || plan.beats.length !== prepared.brief.beats ||
    plan.beats.some((b, i) => b.pageNumber !== i + 1 || b.factIds.some(id => !known.has(id))) ||
    !prepared.brief.facts.some(f => f.kind === 'interest' && plan.beats.some(b => b.factIds.includes(f.id))) ||
    plan.resilience.mode !== prepared.brief.resilienceMode ||
    plan.resilience.moments.some(m => m.pageNumber < 1 || m.pageNumber > prepared.brief.beats) ||
    new Set(plan.resilience.moments.map(m => m.pageNumber)).size !== plan.resilience.moments.length) causalFail('plan_binding');
}
function assertProse(prepared: PreparedStory, doc: StoryReviewDocument) {
  // Reuse the strict request/fact/character/digest/page binding, not GPT accounting.
  prepareOriginalStoryTextReview(prepared, doc);
  const text = [doc.manuscript.title, ...doc.manuscript.pages.map(p => p.text)].join('\n');
  if (/[-\u05be\u2013\u2014]/u.test(text) || /imageDirection\s*:/iu.test(text)) causalFail('prose_marker');
  if (prepared.brief.excludedSubjects.some(s => comparableText(text).includes(comparableText(s)))) causalFail('excluded_subject');
  assertPlan(prepared, doc.plan);
}
export function causalAuthorSchema(prepared: PreparedStory, plan: SelectedCausalPlan) {
  return personalManuscriptSchema.extend({ requestId: z.literal(prepared.brief.requestId), planDigest: z.literal(plan.planDigest),
    pages: z.array(personalManuscriptSchema.shape.pages.element.omit({ pageNumber: true })).length(prepared.brief.beats) });
}
export function compileCausalOriginal(prepared: PreparedStory, plan: SelectedCausalPlan, raw: unknown): StoryReviewDocument {
  if (plan.disposition !== 'selected' || plan.requestDigest !== causalDigest(prepared.accepted.canonical) ||
    plan.briefDigest !== causalDigest(prepared.brief) || plan.planDigest !== causalDigest(plan.plan)) causalFail('plan_binding');
  const { planningDigest, disposition, ...body } = plan;
  if (causalDigest({ ...body, disposition: 'selected' }) !== planningDigest) causalFail('plan_binding');
  const parsed = causalAuthorSchema(prepared, plan).safeParse(raw);
  if (!parsed.success) return causalFail('author_schema');
  const doc = { plan: structuredClone(plan.plan), characterDigest: prepared.brief.companion.characterDigest,
    manuscript: { ...parsed.data, pages: parsed.data.pages.map((p, i) => ({ ...p, pageNumber: i + 1 })) } };
  assertProse(prepared, doc);
  return doc;
}

const diagnosis = z.object({ scope: z.enum(['wording', 'scene', 'structure']), criterion: note,
  evidence: z.array(proseReference).min(1).max(2), problem: note }).strict();
const strength = z.object({ id: z.string().regex(/^strength[1-3]$/), original: proseReference,
  narrativeFunction: note, disposition: z.enum(['preserved', 'coherently_changed', 'unresolved']),
  revised: proseReference, explanation: note }).strict();
export function causalEditorCall(prepared: PreparedStory, original: StoryReviewDocument): StoryEditorCall {
  assertProse(prepared, original);
  return { stage: 'editor', instructions: `${causalEditorInstructions}
In this one response, record original-text diagnosis with exact citations and repair scope, and ZERO to THREE genuine strengths with narrative functions before the revision. Do not invent faults or praise to fill a quota. Preserve functions, not necessarily literal wording. A justified scene/magic change must repair all dependent setup/consequences. For each retained strength record how its function survived or coherently changed, or mark unresolved. This field order does not attest your internal thinking order. You have only this original, brief and authority, not the author conversation or critic verdict.`,
    input: canonicalJson({ brief: prepared.brief, draft: original, draftDigest: causalDigest(original),
      draftTextMetrics: measureStoryText(original.manuscript, prepared.brief.child.age) }),
    maxOutputTokens: storyEditorOutputTokens(prepared.brief.beats) + 4000 };
}
export function causalEditorSchema(call: StoryEditorCall) {
  return z.object({ version: z.literal(CAUSAL_EXPERIMENT_VERSION),
    diagnosis: z.array(diagnosis).max(6), strengths: z.array(strength).max(3), revision: storyEditorProviderSchema(call) }).strict();
}
export function compileCausalEdit(prepared: PreparedStory, original: StoryReviewDocument, raw: unknown) {
  const call = causalEditorCall(prepared, original), parsed = causalEditorSchema(call).safeParse(raw);
  if (!parsed.success) return causalFail('editor_schema');
  const data = parsed.data, output = decodeStoryEditorOutput(call, data.revision);
  const plan = personalStoryPlanSchema.parse({ ...output.plan, requestId: prepared.brief.requestId });
  const revised: StoryReviewDocument = { plan, characterDigest: original.characterDigest,
    manuscript: { ...output.manuscript, requestId: prepared.brief.requestId, planDigest: causalDigest(plan) } };
  assertProse(prepared, revised);
  const quoteExists = (ref: z.infer<typeof proseReference>, doc: StoryReviewDocument) => doc.manuscript.pages[ref.pageNumber - 1]?.text.includes(ref.quote);
  if (data.diagnosis.some(d => d.evidence.some(r => !quoteExists(r, original))) ||
    new Set(data.strengths.map(s => s.id)).size !== data.strengths.length ||
    data.strengths.some(s => !quoteExists(s.original, original) || !quoteExists(s.revised, revised))) causalFail('editor_evidence');
  try { assertSemanticEditEvidence(output.semanticAudit, original.manuscript, revised.manuscript); }
  catch { return causalFail('semantic_evidence'); }
  const held = semanticEditNeedsWork(output.semanticAudit) || Object.values(output.checks).some(c => c.outcome === 'needs_work') ||
    data.strengths.some(s => s.disposition === 'unresolved');
  return { version: CAUSAL_EXPERIMENT_VERSION, originalDigest: causalDigest(original), finalDigest: causalDigest(revised),
    diagnosis: data.diagnosis, strengths: data.strengths, checks: output.checks, semanticAudit: output.semanticAudit,
    revised, disposition: held ? 'held' as const : 'model_supported' as const, runtimeEligible: false as const };
}

export function causalReviewPackets(prepared: PreparedStory, original: StoryReviewDocument, revised: StoryReviewDocument) {
  const existing = prepareStoryTextReview(prepared, original, revised);
  const packets = { original: prepareOriginalStoryTextReview(prepared, original), final: existing.final, comparison: existing.comparison };
  for (const packet of Object.values(packets)) packet.instructions +=
    '\nUse issue/preference kinds for an isolated reading. In comparison distinguish improvement, remaining_problem, new_regression or preference, with exact references to BOTH versions.';
  return packets;
}
export type CausalReviewPacket = ReturnType<typeof causalReviewPackets>[keyof ReturnType<typeof causalReviewPackets>];
const finding = z.object({ severity: z.enum(['blocking', 'meaningful', 'polish']), criterion: note,
  kind: z.enum(['issue', 'preference', 'improvement', 'remaining_problem', 'new_regression']),
  original: z.array(proseReference).max(2), revised: z.array(proseReference).max(2), explanation: note }).strict();
export const causalCriticSchema = z.object({ packetDigest: z.string().regex(/^[a-f0-9]{64}$/), summary: note,
  findings: z.array(finding).max(20) }).strict();
export function compileCausalReading(packet: CausalReviewPacket, raw: unknown) {
  const parsed = causalCriticSchema.safeParse(raw);
  if (!parsed.success || parsed.data.packetDigest !== causalDigest(packet)) return causalFail('critic_binding');
  const doc = 'manuscript' in packet ? packet.manuscript : null;
  for (const row of parsed.data.findings) {
    if (doc && !['issue', 'preference'].includes(row.kind)) causalFail('critic_comparison_leak');
    if (!doc && row.kind === 'issue') causalFail('critic_comparison_kind');
    const original = 'original' in packet ? packet.original : packet.version.includes('/original-') ? doc : null;
    const revised = 'revised' in packet ? packet.revised : packet.version.includes('/final-') ? doc : null;
    if (!row.original.length && !row.revised.length) causalFail('critic_evidence');
    for (const [refs, source] of [[row.original, original], [row.revised, revised]] as const) {
      if (refs.some(ref => !source?.pages[ref.pageNumber - 1]?.text.includes(ref.quote))) causalFail('critic_evidence');
    }
    if ('original' in packet && (!row.original.length || !row.revised.length)) causalFail('critic_evidence');
  }
  return { ...parsed.data, kind: 'model_literary_advisory_not_product_acceptance' as const, runtimeEligible: false as const };
}
