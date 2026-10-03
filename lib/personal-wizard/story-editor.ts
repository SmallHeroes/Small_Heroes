import 'server-only';
import { createHash } from 'crypto';
import { canonicalJson } from './request-acceptance';
import { comparableText } from './contract';
import { personalStoryResultSchema, type PersonalStoryResult, type StoryUsage } from './story-contract';
import { STORY_LIMITS, STORY_PRICES, type StoryModel } from './story-config';
import { STORY_INSTRUCTIONS, RESILIENCE_INSTRUCTIONS, NARRATIVE_CRAFT_INSTRUCTIONS, type PreparedStory } from './story-writer';
import { editedStoryResultSchema, storyEditorOutputSchema, type EditedStoryResult } from './story-editor-contract';
import { adventureSelectionIssue } from './story-planning-contract';
import { measureStoryText } from './story-text-metrics';
import { assertSemanticEditEvidence, semanticEditNeedsWork, SEMANTIC_EDIT_INSTRUCTIONS } from './story-semantic-audit';

export type StoryEditorCall = { stage: 'editor'; instructions: string; input: string; maxOutputTokens: number };
export type StoryEditorProvider = { generate(call: StoryEditorCall, signal: AbortSignal): Promise<{ output: unknown; usage: StoryUsage }> };
const digest = (data: unknown) => createHash('sha256').update(canonicalJson(data)).digest('hex');
export class StoryEditorError extends Error {
  constructor(readonly code: string) { super(`story_editor_${code}`); }
}
const fail = (code: string): never => { throw new StoryEditorError(code); };
export const STORY_EDITOR_INSTRUCTIONS = `${STORY_INSTRUCTIONS}\n${RESILIENCE_INSTRUCTIONS}\n${NARRATIVE_CRAFT_INSTRUCTIONS}\n${SEMANTIC_EDIT_INSTRUCTIONS}
Act as a demanding Hebrew children's book editor, not as the author's congratulatory reviewer. Read the entire approved brief, outline and draft first.
Return a COMPLETE revised manuscript AND a matching revised narrative plan, not suggestions or a quality score. Keep strong passages; remove mechanical filler. If the premise or solution does not make sense, simplify/rework it, not just add an explanation. Do not blindly preserve a weak outline. Never insert an example plot from these instructions.
First check the ending against the beginning: having the right number of texts is not evidence that the story is complete. If the draft only covers early outline beats, compress/restructure to include the entire adventure and earned resolution. Each final spread corresponds to one COMPLETE revised beat, not half a beat. Do not approve an unresolved midpoint as an ending. If the draft stays a stationary hobby drill, revise its situation and discovery rather than merely expanding its sentences.
Check each of the six supplied criteria against the FINAL revision, explaining a concrete passage/choice and any remaining weakness. Mark needs_work if a substantial weakness remains; do not declare ready merely because you revised something. These are model observations, not an approval.
Keep EXACTLY the chosen number of narrative spreads, their age-appropriate read-aloud length, approved facts/name/address, selected companion personality, topic/exclusions and resilience mode. A changed plot must update beats, moment references, custody and ending together. Never author a digest for the revised plan; the engine binds it after validation.
No further rewrite loop is available. Produce the best coherent revision in this one pass; honestly hold any unresolved difficulty.`;

export function storyEditorOutputTokens(count: number) {
  if (![8, 12, 16].includes(count)) fail('length_invalid');
  return 12_000 + 500 * count;
}
export function storyEditorReservationUsd(model: StoryModel, count: number) {
  const price = STORY_PRICES[model];
  return (STORY_LIMITS.inputBytesPerCall * price.input + storyEditorOutputTokens(count) * price.output) / 1e6 * 1.1;
}
export function prepareStoryEdit(prepared: PreparedStory, rawDraft: unknown): StoryEditorCall {
  const draft = personalStoryResultSchema.parse(rawDraft);
  if (draft.characterDigest !== prepared.brief.companion.characterDigest) fail('character_binding');
  if (canonicalJson(rawDraft) !== canonicalJson(draft) || draft.requestId !== prepared.accepted.requestId ||
    draft.displayPages !== prepared.brief.displayPages || draft.containsFixtureData !== prepared.accepted.containsFixtureData ||
    digest(draft.plan) !== draft.planDigest) fail('source_binding');
  if (draft.planning && adventureSelectionIssue(draft.planning.selection, prepared.brief.facts, prepared.brief.beats,
    draft.plan.beats.flatMap(beat => beat.factIds))) fail('source_binding');
  const original = { plan: draft.plan, manuscript: draft.manuscript, characterDigest: draft.characterDigest };
  const call: StoryEditorCall = { stage: 'editor', instructions: STORY_EDITOR_INSTRUCTIONS,
    input: canonicalJson({ brief: prepared.brief, draft: original, draftDigest: digest(original),
      draftTextMetrics: measureStoryText(draft.manuscript, prepared.brief.child.age),
      task: 'Edit the whole story for real read-aloud enjoyment. Return all spreads in order, not just changed passages. Checks concern the revised story, not the original.' }),
    maxOutputTokens: storyEditorOutputTokens(prepared.brief.beats) };
  if (Buffer.byteLength(call.instructions + call.input, 'utf8') > STORY_LIMITS.inputBytesPerCall - 12_000) fail('input_limit');
  return call;
}

/** Deterministic binding/structural guards, NOT a semantic literary-quality proof. */
export function compileStoryEdit(prepared: PreparedStory, draft: PersonalStoryResult, raw: unknown, usage: StoryUsage): EditedStoryResult {
  const call = prepareStoryEdit(prepared, draft);
  const parsed = storyEditorOutputSchema.safeParse(raw);
  if (!parsed.success) return fail('output_invalid');
  const output = parsed.data;
  try { assertSemanticEditEvidence(output.semanticAudit, draft.manuscript, output.manuscript); }
  catch { return fail('semantic_audit_evidence'); }
  if (output.requestId !== prepared.accepted.requestId || output.draftDigest !== JSON.parse(call.input).draftDigest) fail('source_binding');
  const count = prepared.brief.beats;
  if (output.plan.beats.length !== count || output.manuscript.pages.length !== count ||
    output.plan.beats.some((beat, i) => beat.pageNumber !== i + 1) || output.manuscript.pages.some((page, i) => page.pageNumber !== i + 1)) fail('coverage');
  if (output.plan.resilience.mode !== prepared.brief.resilienceMode ||
    output.plan.resilience.moments.some(moment => moment.pageNumber < 1 || moment.pageNumber > count) ||
    new Set(output.plan.resilience.moments.map(moment => moment.pageNumber)).size !== output.plan.resilience.moments.length) fail('resilience_binding');
  const approved = new Set(prepared.brief.facts.map(fact => fact.id));
  if (output.plan.beats.some(beat => beat.factIds.some(id => !approved.has(id))) ||
    !prepared.brief.facts.some(fact => fact.kind === 'interest' && output.plan.beats.some(beat => beat.factIds.includes(fact.id)))) fail('fact_binding');
  const prose = output.manuscript.title + '\n' + output.manuscript.pages.map(page => page.text).join('\n');
  if (/[-\u05be\u2013\u2014]/u.test(prose) || /imageDirection\s*:/iu.test(prose)) fail('prose_marker');
  if (prepared.brief.excludedSubjects.some(subject => comparableText(prose).includes(comparableText(subject)))) fail('excluded_subject');
  const plan = { ...output.plan, requestId: output.requestId };
  const planDigest = digest(plan);
  const manuscript = { ...output.manuscript, requestId: output.requestId, planDigest };
  const original = structuredClone({ plan: draft.plan, manuscript: draft.manuscript, characterDigest: draft.characterDigest });
  const usages = [...draft.accounting.usage, usage];
  const price = STORY_PRICES[draft.accounting.model as StoryModel];
  if (!price) fail('model_unpriced');
  const result = editedStoryResultSchema.parse({ ...draft, plan, planDigest, manuscript,
    ...(draft.planning ? { planning: structuredClone(draft.planning) } : {}),
    accounting: { ...draft.accounting, providerCalls: 3, usage: usages,
      reservedUsd: draft.accounting.reservedUsd + storyEditorReservationUsd(draft.accounting.model as StoryModel, count),
      estimatedUsd: usages.every(row => row !== null) ? usages.reduce((sum, row) => sum + (row!.inputTokens * price.input + row!.outputTokens * price.output) / 1e6, 0) : null },
    editing: { version: 'personal-story-editor/diagnostic-v3', kind: 'model_edit_not_product_acceptance',
      original, draftDigest: digest(original), finalDigest: digest({ plan, manuscript, characterDigest: draft.characterDigest }), checks: output.checks,
      semanticAudit: output.semanticAudit, auditDigest: digest(output.semanticAudit) } });
  return result;
}
export function assertStoryEditBinding(result: EditedStoryResult) {
  const profile = result.editing.version !== 'personal-story-editor/diagnostic-v1' ? { characterDigest: result.characterDigest } : {};
  if (result.editing.version !== 'personal-story-editor/diagnostic-v1'
      ? !result.characterDigest || result.editing.original.characterDigest !== result.characterDigest
      : result.characterDigest !== undefined || result.editing.original.characterDigest !== undefined) fail('revision_binding');
  if (digest(result.plan) !== result.planDigest || digest(result.editing.original.plan) !== result.editing.original.manuscript.planDigest ||
    digest(result.editing.original) !== result.editing.draftDigest || digest({ plan: result.plan, manuscript: result.manuscript, ...profile }) !== result.editing.finalDigest) fail('revision_binding');
  if (result.planning && result.planning.sourcePlanDigest !== digest(result.editing.original.plan)) fail('revision_binding');
  if (result.editing.version === 'personal-story-editor/diagnostic-v3') {
    if (!result.editing.semanticAudit || digest(result.editing.semanticAudit) !== result.editing.auditDigest) fail('revision_binding');
    try { assertSemanticEditEvidence(result.editing.semanticAudit, result.editing.original.manuscript, result.manuscript); }
    catch { return fail('semantic_audit_evidence'); }
  }
}
export function editorNeedsWork(result: EditedStoryResult): boolean {
  return Object.values(result.editing.checks).some(check => check.outcome === 'needs_work') ||
    (result.editing.semanticAudit !== undefined && semanticEditNeedsWork(result.editing.semanticAudit));
}
