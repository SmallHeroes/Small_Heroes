import { z } from 'zod';

// Whole-story planning data, NOT a render contract or approved story source.
const line = z.string().trim().min(1).max(700);
export const personalStoryPlanSchema = z.object({
  requestId: z.string(),
  title: line,
  childGoal: line,
  companionWant: line,
  comicPromise: line,
  resilience: z.object({
    mode: z.enum(['chosen_topic', 'adventure_only']),
    // Editorial evidence proposed by the writer, not proof of psychological benefit.
    moments: z.array(z.object({
      pageNumber: z.number().int(),
      childChoice: line,
      whatHelps: line,
    }).strict()).min(1).max(4),
  }).strict(),
  beats: z.array(z.object({
    pageNumber: z.number().int(),
    location: line,
    transitionReason: line,
    childAction: line,
    companionAction: line,
    consequence: line,
    factIds: z.array(z.string()).max(8),
    continuity: line,
  }).strict()).min(8).max(16),
  ending: line,
}).strict();

export const personalManuscriptSchema = z.object({
  requestId: z.string(),
  planDigest: z.string(),
  title: z.string().trim().min(1).max(120),
  pages: z.array(z.object({
    pageNumber: z.number().int(),
    text: z.string().trim().min(20).max(1500),
  }).strict()).min(8).max(16),
}).strict();

export type PersonalStoryPlan = z.infer<typeof personalStoryPlanSchema>;
export type PersonalManuscript = z.infer<typeof personalManuscriptSchema>;
export type StoryUsage = { inputTokens: number; outputTokens: number } | null;
const usageSchema = z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() }).strict().nullable();
export const personalStoryResultSchema = z.object({
  status: z.literal('manuscript_preview'),
  requestId: z.string().min(1),
  manuscript: personalManuscriptSchema,
  plan: personalStoryPlanSchema,
  planDigest: z.string().regex(/^[a-f0-9]{64}$/),
  displayPages: z.union([z.literal(16), z.literal(24), z.literal(32)]),
  containsFixtureData: z.boolean(),
  editorialStatus: z.literal('pending_product_review'),
  runtimeEligible: z.literal(false),
  accounting: z.object({
    model: z.string().min(1), providerCalls: z.number().int().min(0).max(2),
    reservedUsd: z.number().finite().nonnegative(), estimatedUsd: z.number().finite().nonnegative().nullable(),
    usage: z.array(usageSchema).max(2), kind: z.literal('usage_estimate_not_invoice'),
  }).strict(),
}).strict().superRefine((result, ctx) => {
  const count = result.displayPages / 2;
  if (result.plan.requestId !== result.requestId || result.manuscript.requestId !== result.requestId || result.manuscript.planDigest !== result.planDigest ||
      result.plan.beats.length !== count || result.manuscript.pages.length !== count ||
      result.plan.beats.some((beat, i) => beat.pageNumber !== i + 1) || result.manuscript.pages.some((page, i) => page.pageNumber !== i + 1)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'story_result_binding' });
  }
});
export type PersonalStoryResult = z.infer<typeof personalStoryResultSchema>;
