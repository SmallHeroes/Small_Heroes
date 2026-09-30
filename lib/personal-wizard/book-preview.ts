import { z } from 'zod';
import { personalStoryResultSchema } from './story-contract';

// Browser display validation only. Never recreates server compilation/render authority.
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const verdict = z.enum(['supported', 'contradiction', 'uncertain']);
const check = z.object({ category: z.string(), verdict, observation: z.string() });
const status = z.enum(['review_supported', 'held_contradiction', 'held_uncertain']);
const accountingSchema = z.object({ reservedUsd: z.number().nonnegative(), estimatedUsd: z.number().nonnegative().nullable(),
  knownUsageEstimateUsd: z.number().nonnegative(), providerAttempts: z.number().int().min(0).max(4),
  kind: z.literal('usage_estimate_not_invoice') });
export const bookPreviewSchema = z.object({
  version: z.literal('personal-book-runner/diagnostic-v1'), status,
  writerResult: personalStoryResultSchema, runtimeEligible: z.literal(false),
  storyboard: z.object({ requestId: z.string(), sourceDigest: hash, storyboardDigest: hash,
    narrativeSpreads: z.number().int(), displayPages: z.number().int(), runtimeEligible: z.literal(false),
    plan: z.object({ pages: z.array(z.object({ pageNumber: z.number().int(), shot: z.string(), angle: z.string(),
      composition: z.string(), childAction: z.string(), companionAction: z.string(), scene: z.string() })) }) }),
  review: z.object({ disposition: status, runtimeEligible: z.literal(false),
    review: z.object({ sourceDigest: hash, storyboardDigest: hash, bookChecks: z.array(check),
      frames: z.array(z.object({ pageNumber: z.number().int(), checks: z.array(check) })) }) }),
  accounting: accountingSchema,
});
export type BookPreview = z.infer<typeof bookPreviewSchema>;
const failureSchema = z.object({ error: z.string(), writerResult: personalStoryResultSchema, accounting: accountingSchema });
export type BookPartialPreview = z.infer<typeof failureSchema>;
export function readBookPartialPreview(raw: unknown, requestId: string): BookPartialPreview | null {
  const parsed = failureSchema.safeParse(raw);
  return parsed.success && parsed.data.writerResult.requestId === requestId ? parsed.data : null;
}
export function readBookPreview(raw: unknown, requestId: string): BookPreview | null {
  const parsed = bookPreviewSchema.safeParse(raw);
  if (!parsed.success) return null;
  const data = parsed.data, book = data.storyboard, review = data.review.review;
  const checks = [...review.bookChecks, ...review.frames.flatMap(frame => frame.checks)];
  const disposition = checks.some(check => check.verdict === 'uncertain') ? 'held_uncertain' : checks.some(check => check.verdict === 'contradiction') ? 'held_contradiction' : 'review_supported';
  if (data.writerResult.requestId !== requestId || book.requestId !== requestId || data.status !== data.review.disposition ||
      book.sourceDigest !== review.sourceDigest || book.storyboardDigest !== review.storyboardDigest ||
      book.displayPages !== data.writerResult.displayPages || book.narrativeSpreads !== data.writerResult.manuscript.pages.length ||
      book.plan.pages.length !== book.narrativeSpreads + 1 || book.plan.pages.some((page, index) => page.pageNumber !== index) ||
      review.frames.length !== book.narrativeSpreads + 1 || review.frames.some((page, index) => page.pageNumber !== index) ||
      disposition !== data.status) return null;
  return data;
}
export const bookAvailabilitySchema = z.object({ configured: z.literal(true), model: z.string(),
  reservations: z.array(z.object({ lengthId: z.string(), reservationUsd: z.number().nonnegative(),
    fitsConfiguredTotalBudget: z.boolean() })) });
