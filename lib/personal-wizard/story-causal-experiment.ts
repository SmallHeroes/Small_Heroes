import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson } from './request-acceptance';
import { comparableText } from './contract';
import { personalManuscriptSchema, personalStoryPlanSchema } from './story-contract';
import { adventureSelectionSchema, adventureCandidatesIssue, adventureSelectionIssue } from './story-planning-contract';
import { STORY_INSTRUCTIONS, RESILIENCE_INSTRUCTIONS, NARRATIVE_CRAFT_INSTRUCTIONS, CANDIDATE_PERSONAL_FACT_INSTRUCTIONS, type PreparedStory } from './story-writer';
import { STORY_EDITOR_INSTRUCTIONS, storyEditorOutputTokens, type StoryEditorCall } from './story-editor';
import { storyEditorProviderSchema, decodeStoryEditorOutput } from './story-editor-openai';
import { assertSemanticEditEvidence, semanticEditNeedsWork } from './story-semantic-audit';
import { measureStoryText } from './story-text-metrics';
import { prepareOriginalStoryTextReview, prepareStoryTextReview, type StoryReviewDocument } from './story-text-review';

export const CAUSAL_EXPERIMENT_VERSION = 'personal-causal-experiment/diagnostic-v2';
export const causalDigest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
export class CausalExperimentError extends Error {
  constructor(readonly code: string) { super(`causal_experiment_${code}`); }
}
export const causalFail = (code: string): never => { throw new CausalExperimentError(code); };
const note = z.string().trim().min(10).max(600);
const proseReference = z.object({ pageNumber: z.number().int().min(1).max(16), quote: z.string().min(4).max(220) }).strict();
const candidatePair = adventureSelectionSchema.pick({ candidates: true, contrast: true });
// Explicit diagnostic instruction profile. Keep every other approved constraint,
// but do not impose the legacy failed-attempt plot or assume a deadline.
const legacyAttemptClause = 'a failed attempt with consequences and ';
const legacyDeadlineClause = 'when a deadline is reached, what happens if it is missed, and which earlier observation or ability enables the solution';
const conditionalDeadlineClause = 'which earlier observation or ability enables the solution. If the selected adventure uses a deadline, state when it is reached and what happens if it is missed. Do not presume or add a deadline merely to satisfy this guidance';
if (STORY_INSTRUCTIONS.split(legacyAttemptClause).length !== 2 || !STORY_EDITOR_INSTRUCTIONS.startsWith(STORY_INSTRUCTIONS) ||
  NARRATIVE_CRAFT_INSTRUCTIONS.split(legacyDeadlineClause).length !== 2 ||
  STORY_EDITOR_INSTRUCTIONS.split(NARRATIVE_CRAFT_INSTRUCTIONS).length !== 2) {
  throw new CausalExperimentError('instruction_profile_changed');
}
export const CAUSAL_STORY_INSTRUCTIONS = STORY_INSTRUCTIONS.replace(legacyAttemptClause, '') +
  '\nA failed attempt is optional. A boundary, negotiation, helping another character, changed goal or creative compromise can carry resilience. Do not require all these or impose the same sequence on every book.';
export const CAUSAL_NARRATIVE_CRAFT_INSTRUCTIONS = NARRATIVE_CRAFT_INSTRUCTIONS.replace(legacyDeadlineClause, conditionalDeadlineClause);
const causalEditorInstructions = CAUSAL_STORY_INSTRUCTIONS + STORY_EDITOR_INSTRUCTIONS.slice(STORY_INSTRUCTIONS.length)
  .replace(NARRATIVE_CRAFT_INSTRUCTIONS, CAUSAL_NARRATIVE_CRAFT_INSTRUCTIONS);

export const CAUSAL_PLAN_INSTRUCTIONS = `${CAUSAL_STORY_INSTRUCTIONS}\n${RESILIENCE_INSTRUCTIONS}\n${CAUSAL_NARRATIVE_CRAFT_INSTRUCTIONS}
This is PLANNING ONLY, no manuscript. Compare two genuinely different adventures A and B using curiosity, discovery, consequential child choices, companion want and earned payoff, with approved fact IDs. Scenery/prop substitutions are insufficient. Say why a child would want the next part and which surprising, funny or emotional ending is worth reaching. If BOTH ideas are weak, return both_rejected with the two ideas and reason, not a forced choice or plan. Only the host may permit one separately reserved planning reattempt.
${CANDIDATE_PERSONAL_FACT_INSTRUCTIONS} This applies independently to BOTH A and B, including the unselected candidate and both_rejected responses. personalFactUses may use only IDs from brief.facts, with no duplicate IDs within a candidate; A and B may share an interest. Each candidate must use an approved fact with kind "interest"; a habit or difficulty alone does not satisfy that binding.
In a selected plan, every factId in the selected candidate's personalFactUses must occur in at least one plan beat's factIds. Every beat factId must come from brief.facts, and at least one approved interest must influence an action. Keep plan.resilience.mode equal to brief.resilienceMode. resilience.moments.pageNumber and all outlineChecks.evidenceSpreads refer to positions 1 through brief.beats, with no duplicate positions within each list. The earned_payoff check must include the final spread (brief.beats) in evidenceSpreads. These are binding/coverage requirements, not a formula for the plot or proof of literary quality.
For a selected idea, first describe the entire adventure as a continuous synopsis, not a compliance list. Then produce exactly the chosen number of ordered beats. Work backwards from the climax: what changed, how the child noticed/tried/understood, the prepared ability/object/rule enabling action, why the companion matters, and the established desire/relationship paid off. Resolve missing causal links in the synopsis and beats before writing prose; do not add a separate self-citation ledger. These are questions, NOT a plot formula. No mandatory timer, broken object, companion mistake, mechanical rescue or location quota. A special rule has explicit conditions and consequences; a climax cannot quietly change it. A fundamental unresolved outline problem must mark needs_work; prose is not a rescue for a weak premise. Do not number beat arrays; the engine numbers them. No other child's profile or prior story is available.`;

export function causalPlanSchema(prepared: PreparedStory) {
  const count = prepared.brief.beats;
  const plan = personalStoryPlanSchema.omit({ requestId: true }).extend({
    beats: z.array(personalStoryPlanSchema.shape.beats.element.omit({ pageNumber: true })).length(count),
  });
  return z.discriminatedUnion('disposition', [
    z.object({ version: z.literal(CAUSAL_EXPERIMENT_VERSION), requestId: z.literal(prepared.brief.requestId),
      disposition: z.literal('selected'), selection: adventureSelectionSchema,
      synopsis: z.string().trim().min(40).max(2400), plan }).strict(),
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
  const body = { ...data, disposition: selectionIssue ? 'outline_held' as const : 'selected' as const,
    plan, ...binding, planDigest: causalDigest(plan), runtimeEligible: false as const };
  return { ...body, planningDigest: causalDigest(body) };
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
  if (plan.version !== CAUSAL_EXPERIMENT_VERSION || plan.disposition !== 'selected' || plan.requestDigest !== causalDigest(prepared.accepted.canonical) ||
    plan.briefDigest !== causalDigest(prepared.brief) || plan.planDigest !== causalDigest(plan.plan)) causalFail('plan_binding');
  const { planningDigest, ...body } = plan;
  if (causalDigest(body) !== planningDigest || adventureSelectionIssue(plan.selection, prepared.brief.facts,
    prepared.brief.beats, plan.plan.beats.flatMap(beat => beat.factIds))) causalFail('plan_binding');
  const parsed = causalAuthorSchema(prepared, plan).safeParse(raw);
  if (!parsed.success) return causalFail('author_schema');
  const doc = { plan: structuredClone(plan.plan), characterDigest: prepared.brief.companion.characterDigest,
    manuscript: { ...parsed.data, pages: parsed.data.pages.map((p, i) => ({ ...p, pageNumber: i + 1 })) } };
  assertProse(prepared, doc);
  return doc;
}

export function causalEditorCall(prepared: PreparedStory, original: StoryReviewDocument): StoryEditorCall {
  assertProse(prepared, original);
  return { stage: 'editor', instructions: `${causalEditorInstructions}
Diagnose before revising: identify significant problems and any genuine strengths worth preserving. Do not invent faults or praise to fill a quota, and do not output an additional diagnosis or strengths ledger. Preserve functions, not necessarily literal wording. A justified scene/magic change must repair all dependent setup/consequences. Keep successful humour, child choices and companion personality where they work; shorten only when understanding, feeling and humour survive. All revised plan beat factIds must come from brief.facts; at least one approved fact of kind interest must remain used in the revised beats. A habit/difficulty alone does not satisfy that binding; do not force every fact into the story. All semanticAudit quotes must be contiguous verbatim substrings copied from the cited version's actual page text at that pageNumber, not paraphrases or quotes from the plan. semanticAudit.original uses original pages, while semanticAudit.revised uses revised pages. Guidance does not attest your internal thinking order. You have only this original, brief and authority, not the author conversation or critic verdict.`,
    input: canonicalJson({ brief: prepared.brief, draft: original, draftDigest: causalDigest(original),
      draftTextMetrics: measureStoryText(original.manuscript, prepared.brief.child.age) }),
    maxOutputTokens: storyEditorOutputTokens(prepared.brief.beats) + 4000 };
}
export function causalEditorSchema(call: StoryEditorCall) {
  return z.object({ version: z.literal(CAUSAL_EXPERIMENT_VERSION), revision: storyEditorProviderSchema(call) }).strict();
}
export function compileCausalEdit(prepared: PreparedStory, original: StoryReviewDocument, raw: unknown) {
  const call = causalEditorCall(prepared, original), parsed = causalEditorSchema(call).safeParse(raw);
  if (!parsed.success) return causalFail('editor_schema');
  const data = parsed.data, output = decodeStoryEditorOutput(call, data.revision);
  const plan = personalStoryPlanSchema.parse({ ...output.plan, requestId: prepared.brief.requestId });
  const revised: StoryReviewDocument = { plan, characterDigest: original.characterDigest,
    manuscript: { ...output.manuscript, requestId: prepared.brief.requestId, planDigest: causalDigest(plan) } };
  assertProse(prepared, revised);
  try { assertSemanticEditEvidence(output.semanticAudit, original.manuscript, revised.manuscript); }
  catch { return causalFail('semantic_evidence'); }
  const held = semanticEditNeedsWork(output.semanticAudit) || Object.values(output.checks).some(c => c.outcome === 'needs_work');
  return { version: CAUSAL_EXPERIMENT_VERSION, originalDigest: causalDigest(original), finalDigest: causalDigest(revised),
    checks: output.checks, semanticAudit: output.semanticAudit,
    revised, disposition: held ? 'held' as const : 'model_supported' as const, runtimeEligible: false as const };
}

export function causalReviewPackets(prepared: PreparedStory, original: StoryReviewDocument, revised: StoryReviewDocument) {
  const existing = prepareStoryTextReview(prepared, original, revised);
  const packets = { original: prepareOriginalStoryTextReview(prepared, original), final: existing.final, comparison: existing.comparison };
  for (const [kind, packet] of Object.entries(packets)) packet.instructions +=
    '\nReturn the supplied packetDigest exactly; do not recompute it. Every finding quote must be a contiguous verbatim substring copied from the cited version\'s actual page text at that pageNumber, not a paraphrase or a quote from the brief/title/plan. A literal quote proves provenance, not the truth of your interpretation.' +
    (kind === 'comparison'
      ? '\nUse improvement, remaining_problem, new_regression or preference, never issue. EVERY finding, including polish or preference, requires at least one original[] citation AND at least one revised[] citation from their respective versions.'
      : `\nUse only issue or preference. For this ${kind.toUpperCase()}-only reading, EVERY finding must put at least one citation in ${kind === 'original' ? 'original[]' : 'revised[]'} and leave ${kind === 'original' ? 'revised[]' : 'original[]'} empty. Do not invent evidence from the unavailable other version.`);
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
  const stage = 'original' in packet ? 'comparison' as const : packet.version.includes('/original-') ? 'original_review' as const : 'final_review' as const;
  return { ...parsed.data, stage, kind: 'model_literary_advisory_not_product_acceptance' as const, runtimeEligible: false as const };
}
