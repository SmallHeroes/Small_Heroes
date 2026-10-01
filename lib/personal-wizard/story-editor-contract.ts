import { z } from 'zod';
import { personalStoryPlanSchema, personalManuscriptSchema, personalStoryResultSchema, personalStoryResultObjectSchema } from './story-contract';

// Model observations, never independent QA, benefit claims or render authority.
export const STORY_EDITOR_CRITERIA = ['personal_stakes', 'felt_child_experience', 'causal_magic', 'character_humour', 'adventure_and_payoff', 'hebrew_and_age'] as const;
const observation = z.object({ outcome: z.enum(['ready_for_reading', 'needs_work']), note: z.string().trim().min(10).max(900) }).strict();
export const storyEditorChecksSchema = z.object({
  personal_stakes: observation, felt_child_experience: observation, causal_magic: observation,
  character_humour: observation, adventure_and_payoff: observation, hebrew_and_age: observation,
}).strict();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const storyEditorOutputSchema = z.object({
  requestId: z.string(), draftDigest: hash,
  plan: personalStoryPlanSchema.omit({ requestId: true }),
  manuscript: personalManuscriptSchema.omit({ requestId: true, planDigest: true }),
  checks: storyEditorChecksSchema,
}).strict();
export const editedStoryResultSchema = personalStoryResultObjectSchema.extend({
  accounting: personalStoryResultObjectSchema.shape.accounting.extend({
    providerCalls: z.literal(3), usage: personalStoryResultObjectSchema.shape.accounting.shape.usage.max(3),
  }),
  editing: z.object({
    version: z.literal('personal-story-editor/diagnostic-v1'),
    kind: z.literal('model_edit_not_product_acceptance'),
    draftDigest: hash, finalDigest: hash, checks: storyEditorChecksSchema,
    original: z.object({ plan: personalStoryPlanSchema, manuscript: personalManuscriptSchema }).strict(),
  }).strict(),
}).strict().superRefine((result, ctx) => {
  const count = result.displayPages / 2;
  const documents = [result, result.editing.original];
  if (documents.some(doc => doc.plan.requestId !== result.requestId || doc.manuscript.requestId !== result.requestId ||
    doc.plan.beats.length !== count || doc.manuscript.pages.length !== count ||
    doc.plan.beats.some((beat, i) => beat.pageNumber !== i + 1) || doc.manuscript.pages.some((page, i) => page.pageNumber !== i + 1)) ||
    result.manuscript.planDigest !== result.planDigest || result.accounting.usage.length !== 3) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'edited_story_result_binding' });
  }
  if (result.planning && result.planning.sourcePlanDigest !== result.editing.original.manuscript.planDigest) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'edited_story_planning_binding' });
  }
});
// Explicit archive/partial compatibility. Complete v2 book results require editedStoryResultSchema.
export const anyPersonalStoryResultSchema = z.union([editedStoryResultSchema, personalStoryResultSchema]);
export type EditedStoryResult = z.infer<typeof editedStoryResultSchema>;
export type StoryEditorOutput = z.infer<typeof storyEditorOutputSchema>;
