import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { bookAvailabilitySchema, readBookPreview, readBookPartialPreview } from '../book-preview';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { storyboardReviewDisposition } from '../storyboard';
const output = async () => {
  const f = await personalStoryboardFixture();
  return { version: 'personal-book-runner/diagnostic-v1', status: 'review_supported', writerResult: f.result,
    storyboard: f.book, review: storyboardReviewDisposition(f.book, f.review), runtimeEligible: false,
    accounting: { reservedUsd: 2, estimatedUsd: .1, knownUsageEstimateUsd: .1, providerAttempts: 4, kind: 'usage_estimate_not_invoice' } };
};
describe('browser book diagnostic boundary', () => {
  it('accepts the real compiled fixture with no server module import in the display contract', async () => {
    const data = await output(); expect(readBookPreview(data, data.writerResult.requestId)?.writerResult.manuscript.pages).toHaveLength(8);
    expect(readFileSync('lib/personal-wizard/book-preview.ts', 'utf8')).not.toMatch(/from.*(?:storyboard|book-runner|book-config|story-writer)/);
  });
  it.each(['identity', 'reviewHash', 'disposition', 'coverage', 'numbering', 'runtime'])('rejects corrupted %s before displaying it', async mode => {
    const data: any = structuredClone(await output());
    if (mode === 'identity') data.storyboard.requestId = 'old';
    if (mode === 'reviewHash') data.review.review.sourceDigest = 'b'.repeat(64);
    if (mode === 'disposition') data.status = 'held_uncertain';
    if (mode === 'coverage') data.storyboard.plan.pages.pop();
    if (mode === 'numbering') data.review.review.frames[2].pageNumber = 1;
    if (mode === 'runtime') data.runtimeEligible = true;
    expect(readBookPreview(data, data.writerResult.requestId)).toBeNull();
  });
  it('displays held diagnostics without turning the result into rendering authority', async () => {
    const data: any = await output(); data.review.review.bookChecks[0].verdict = 'uncertain';
    data.status = data.review.disposition = 'held_uncertain';
    const view = readBookPreview(data, data.writerResult.requestId);
    expect(view?.status).toBe('held_uncertain'); expect(view?.runtimeEligible).toBe(false);
  });
  it('requires explicit length quotes, not a writer fallback', () => {
    expect(bookAvailabilitySchema.safeParse({ available: true }).success).toBe(false);
    const ui = readFileSync('app/dev/personal-wizard/StoryPreview.tsx', 'utf8');
    expect(ui).not.toContain("fetch('/api/dev/personal-wizard/story'");
    expect(ui).toContain("fetch('/api/dev/personal-wizard/book'");
    expect(ui).toContain('token !== epoch.current'); expect(ui).toContain('controller.signal.aborted');
  });
  it('preserves a failed later stage manuscript as a partial view, never a completed book', async () => {
    const data = await output(); const raw = { error: 'book_storyboard_invalid', writerResult: data.writerResult, accounting: data.accounting };
    expect(readBookPartialPreview(raw, data.writerResult.requestId)?.writerResult.manuscript.pages).toHaveLength(8);
    expect(readBookPreview(raw, data.writerResult.requestId)).toBeNull();
    expect(readBookPartialPreview(raw, 'stale')).toBeNull();
  });
});
