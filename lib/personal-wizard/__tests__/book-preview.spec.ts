import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { bookAvailabilitySchema, fetchBookAvailability, readBookPreview, readBookPartialPreview } from '../book-preview';
import { watchAvailability, type AvailabilityFetch } from '../availability-client';
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

const quote = { configured: true, model: 'gpt-6-sol', reservations: [
  { lengthId: 'short', reservationUsd: 1.8018, fitsConfiguredTotalBudget: true },
] };
const response = (status: number, body: unknown): AvailabilityFetch => async () => new Response(JSON.stringify(body), { status });
describe('book availability is read-only and refreshes after sign-in', () => {
  it('accepts only valid quotes, not malformed or temporarily unavailable reads', async () => {
    expect(await fetchBookAvailability(response(200, quote))).toEqual(quote);
    for (const body of [null, {}, { ...quote, configured: false }, { ...quote, reservations: [{ lengthId: 'short' }] }]) {
      expect(await fetchBookAvailability(response(200, body))).toBeUndefined();
    }
    expect(await fetchBookAvailability(response(503, quote))).toBeUndefined();
    expect(await fetchBookAvailability(async () => { throw Error('network'); })).toBeUndefined();
    expect(await fetchBookAvailability(async () => new Response('bad json', { status: 200 }))).toBeUndefined();
  });
  it.each([401, 403, 404])('clears stale quotes on authoritative HTTP %i', async status => {
    expect(await fetchBookAvailability(response(status, quote))).toBeNull();
  });
  it('enables a quote on returning focus without remount, retains it on 503, then clears on sign-out', async () => {
    const target = new EventTarget();
    let status = 401;
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => response(status, quote)('', {}));
    let current: Awaited<ReturnType<typeof fetchBookAvailability>> = null;
    const publish = vi.fn(value => { current = value; });
    const stop = watchAvailability(target, () => fetchBookAvailability(fetcher), publish);
    const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
    await settle(); expect(current).toBeNull();
    status = 200; target.dispatchEvent(new Event('focus')); await settle(); expect(current).toEqual(quote);
    status = 503; target.dispatchEvent(new Event('focus')); await settle(); expect(current).toEqual(quote);
    expect(publish).toHaveBeenCalledTimes(2);
    status = 401; target.dispatchEvent(new Event('focus')); await settle(); expect(current).toBeNull();
    expect(publish).toHaveBeenCalledTimes(3); expect(fetcher).toHaveBeenCalledTimes(4);
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toBe('/api/dev/personal-wizard/book'); expect(init).toEqual({ cache: 'no-store' });
    }
    stop();
  });
});
