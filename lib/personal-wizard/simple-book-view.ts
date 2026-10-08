import { z } from 'zod';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const manuscript = z.object({ title: z.string().min(1).max(120), pages: z.array(z.object({
  pageNumber: z.number().int().min(1).max(8), text: z.string().min(1).max(1500),
}).strict()).length(8) }).strict().refine(v => v.pages.every((p, i) => p.pageNumber === i + 1));
const quote = z.object({ pageNumber: z.number().int().min(1).max(8), quote: z.string().min(1).max(2400) }).strict();
export const simpleBookViewSchema = z.object({
  version: z.literal('local-simple-wizard-book-view/v1'), requestId: hash, revision: z.number().int().min(0).max(80),
  phase: z.enum(['queued', 'author', 'editor', 'story_review', 'storyboard', 'storyboard_review', 'references_required', 'references', 'illustrating', 'illustrated_audition', 'held', 'failed']),
  images: z.array(z.object({ pageNumber: z.number().int().min(0).max(8), imageSha: hash,
    imageName: z.string().regex(/^[a-z0-9_]+\.png$/) }).strict()).max(9).default([]),
  original: manuscript.nullable(), edited: manuscript.nullable(),
  baseline: z.literal('previous_edit').optional(),
  visualReviewModel: z.literal('gpt-6.1-sol').optional(),
  imageScope: z.enum(['owned_visual_continuation', 'owned_reference_recovery', 'role_scoped_reference_continuation']).optional(),
  readings: z.array(z.object({ stage: z.enum(['final_review', 'comparison']), summary: z.string().max(2400),
    findings: z.array(z.object({ severity: z.enum(['blocking', 'meaningful', 'polish']), kind: z.string().max(40),
      criterion: z.string().max(2400), explanation: z.string().max(2400), original: z.array(quote).max(8), revised: z.array(quote).max(8),
    }).strict()).max(20) }).strict()).max(2),
  error: z.string().regex(/^[a-z0-9_]+$/).nullable(), runtimeEligible: z.literal(false),
  accounting: z.object({ knownEstimateMicroUsd: z.number().int().nonnegative(), unknownAttemptCosts: z.number().int().nonnegative(),
    logicalAttempts: z.number().int().min(0).max(80), allowanceMicroUsd: z.union([z.literal(12000000), z.literal(14000000), z.literal(16000000)]), kind: z.literal('estimate_not_invoice') }).strict(),
}).strict().superRefine((v, ctx) => {
  if ((v.accounting.allowanceMicroUsd === 14000000 && !['owned_reference_recovery', 'role_scoped_reference_continuation'].includes(v.imageScope ?? '')) ||
      (v.accounting.allowanceMicroUsd === 16000000 && v.imageScope !== 'role_scoped_reference_continuation') ||
      (v.phase === 'references_required' && (!v.original || !v.edited || v.readings.length !== 2 ||
      new Set(v.readings.map(r => r.stage)).size !== 2)) ||
      (v.phase === 'queued' && (v.original || v.edited)) ||
      v.images.some((p, i) => p.pageNumber !== i) ||
      (v.phase === 'illustrated_audition' && (!v.original || !v.edited || v.readings.length !== 2 || v.images.length !== 9 || v.error !== null || v.accounting.unknownAttemptCosts)))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'simple_book_view_phase' });
});
export type SimpleBookView = z.infer<typeof simpleBookViewSchema>;
export function emptySimpleBookView(requestId: string): SimpleBookView {
  return { version: 'local-simple-wizard-book-view/v1', requestId, revision: 0, phase: 'queued', images: [], original: null, edited: null,
    readings: [], error: null, runtimeEligible: false, accounting: { knownEstimateMicroUsd: 0, unknownAttemptCosts: 0,
      logicalAttempts: 0, allowanceMicroUsd: 12000000, kind: 'estimate_not_invoice' } };
}
export function readSimpleBookView(raw: unknown, requestId: string) {
  const parsed = simpleBookViewSchema.safeParse(raw);
  return parsed.success && parsed.data.requestId === requestId ? parsed.data : null;
}
export function newerSimpleBookView(previous: SimpleBookView | null, next: SimpleBookView) {
  return previous?.requestId === next.requestId && previous.revision > next.revision ? previous : next;
}
