import { z } from 'zod';
import { comparableText } from './contract';

// Retained model deliberation, NOT independent literary approval or fact authority.
const concise = z.string().trim().min(1).max(180);
const note = z.string().trim().min(10).max(240);
export const ADVENTURE_DIFFERENCE_DIMENSIONS = ['childWant', 'complication', 'discovery', 'childContribution'] as const;
export const ADVENTURE_OUTLINE_CHECKS = ['curiosity_and_stakes', 'causal_child_choices', 'earned_payoff'] as const;
const check = z.object({
  outcome: z.enum(['supported', 'needs_work']), evidenceSpreads: z.array(z.number().int().min(1).max(16)).min(1).max(3), note,
}).strict();
export const adventureSelectionSchema = z.object({
  candidates: z.array(z.object({
    id: z.enum(['A', 'B']), curiosity: concise, childWant: concise, companionWant: concise,
    complication: concise, discovery: concise, childContribution: concise, payoff: concise,
    personalFactUses: z.array(z.object({ factId: z.string().min(1), contribution: concise }).strict()).min(1).max(3),
  }).strict()).length(2),
  contrast: z.object({ dimensions: z.array(z.enum(ADVENTURE_DIFFERENCE_DIMENSIONS)).min(1).max(4), explanation: note }).strict(),
  selectedId: z.enum(['A', 'B']), reason: note,
  outlineChecks: z.object({ curiosity_and_stakes: check, causal_child_choices: check, earned_payoff: check }).strict(),
}).strict();
export const storyPlanningReceiptSchema = z.object({
  version: z.literal('personal-adventure-selection/diagnostic-v1'),
  kind: z.literal('model_selection_not_literary_acceptance'),
  sourcePlanDigest: z.string().regex(/^[a-f0-9]{64}$/), selection: adventureSelectionSchema,
}).strict();
export type AdventureSelection = z.infer<typeof adventureSelectionSchema>;

/** Literal/reference guards only. Paraphrases can still describe the same weak idea. */
export function adventureSelectionIssue(selection: AdventureSelection, facts: readonly { id: string; kind: string }[], spreads: number, usedPlanFactIds: readonly string[]): string | null {
  const [a, b] = selection.candidates;
  if (a.id !== 'A' || b.id !== 'B') return 'story_selection_identity';
  // Comparison only: CGJ/variation selectors are Mn, not Cf. Keep stored prose intact.
  const normalize = (s: string) => comparableText(s.normalize('NFKC')).replace(/[\p{P}\p{Z}\p{Cf}\p{Default_Ignorable_Code_Point}\s]/gu, '').normalize('NFC');
  if (new Set(selection.contrast.dimensions).size !== selection.contrast.dimensions.length ||
    selection.contrast.dimensions.some(key => normalize(a[key]) === normalize(b[key]))) return 'story_selection_not_distinct';
  const known = new Map(facts.map(fact => [fact.id, fact.kind]));
  for (const candidate of selection.candidates) {
    const ids = candidate.personalFactUses.map(use => use.factId);
    if (new Set(ids).size !== ids.length || ids.some(id => !known.has(id))) return 'story_selection_fact_mismatch';
    if (!ids.some(id => known.get(id) === 'interest')) return 'story_selection_personal_fact_missing';
  }
  const selected = selection.candidates.find(candidate => candidate.id === selection.selectedId)!;
  if (selected.personalFactUses.some(use => !usedPlanFactIds.includes(use.factId))) return 'story_selection_plan_fact_missing';
  const checks = Object.values(selection.outlineChecks);
  if (checks.some(row => row.evidenceSpreads.some(n => n > spreads) || new Set(row.evidenceSpreads).size !== row.evidenceSpreads.length) ||
    !selection.outlineChecks.earned_payoff.evidenceSpreads.includes(spreads)) return 'story_selection_outline_binding';
  if (checks.some(row => row.outcome === 'needs_work')) return 'story_outline_held';
  return null;
}
