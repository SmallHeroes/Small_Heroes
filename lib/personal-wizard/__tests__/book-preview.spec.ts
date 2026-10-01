import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { bookAvailabilitySchema, fetchBookAvailability, fetchTextBookAvailability, readTextBookPreview, readBookPreview, readBookPartialPreview, readBookPlanningHoldPreview } from '../book-preview';
import { watchAvailability, type AvailabilityFetch } from '../availability-client';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { storyboardReviewDisposition } from '../storyboard';
const output = async () => {
  const f = await personalStoryboardFixture();
  return { version: 'personal-book-runner/diagnostic-v2', status: 'review_supported', writerResult: f.result,
    storyboard: f.book, review: storyboardReviewDisposition(f.book, f.review), runtimeEligible: false,
    accounting: { reservedUsd: 2.2, estimatedUsd: .1, knownUsageEstimateUsd: .1, providerAttempts: 5, kind: 'usage_estimate_not_invoice' } };
};
const heldOutput = async () => {
  const f = await personalStoryboardFixture(); const { requestId, plan, planDigest, displayPages, containsFixtureData, planning } = f.draftResult;
  const selection = structuredClone(planning!); selection.selection.outlineChecks.earned_payoff.outcome = 'needs_work';
  return { version: 'personal-book-planning-hold/diagnostic-v1', status: 'planning_held', error: 'book_outline_held', runtimeEligible: false,
    planningResult: { version: 'personal-story-plan-hold/diagnostic-v1', status: 'planning_held', requestId, plan, planDigest,
      displayPages, containsFixtureData, planning: selection, runtimeEligible: false },
    accounting: { reservedUsd: 2.2, estimatedUsd: .0022, knownUsageEstimateUsd: .0022, providerAttempts: 1, kind: 'usage_estimate_not_invoice' } };
};
describe('browser book diagnostic boundary', () => {
  it('displays only a complete edited story-only result with exactly three calls', async () => {
    const f = await personalStoryboardFixture();
    const raw: any = { version: 'personal-book-text/diagnostic-v1', status: 'story_ready_for_reading', writerResult: f.result, runtimeEligible: false,
      accounting: { reservedUsd: .8184, estimatedUsd: .02, knownUsageEstimateUsd: .02, providerAttempts: 3, kind: 'usage_estimate_not_invoice' } };
    expect(readTextBookPreview(raw, f.result.requestId)?.writerResult.manuscript.pages).toHaveLength(8);
    expect(readBookPreview(raw, f.result.requestId)).toBeNull(); expect(readTextBookPreview(raw, 'stale')).toBeNull();
    for (const mutation of ['held', 'unavailable', 'five', 'draft', 'authority', 'storyboard', 'packets']) {
      const changed = structuredClone(raw);
      if (mutation === 'held') changed.writerResult.editing.checks.causal_magic.outcome = 'needs_work';
      if (mutation === 'unavailable') changed.status = 'review_supported';
      if (mutation === 'five') changed.accounting.providerAttempts = 5;
      if (mutation === 'draft') changed.writerResult = f.draftResult;
      if (mutation === 'authority') changed.runtimeEligible = true;
      if (mutation === 'storyboard') changed.storyboard = f.book;
      if (mutation === 'packets') changed.framePackets = [];
      expect(readTextBookPreview(changed, f.result.requestId)).toBeNull();
    }
    const ui = readFileSync('app/dev/personal-wizard/StoryPreview.tsx', 'utf8');
    expect(ui).toContain("scope: 'story_only'"); expect(ui).toContain('בחירת רעיון'); expect(ui).toContain('בלי סטוריבורד, איורים או קריינות');
  });
  it('requests explicit text-only quotes and rejects a storyboard quote', async () => {
    const raw = { configured: true, scope: 'story_only', maxProviderAttempts: 3, model: 'synthetic', reservations: [{ lengthId: 'short', reservationUsd: .8184, fitsConfiguredTotalBudget: true }] };
    const mock = vi.fn(async () => new Response(JSON.stringify(raw), { status: 200 }));
    expect(await fetchTextBookAvailability(mock)).toEqual(raw);
    expect(mock).toHaveBeenCalledWith('/api/dev/personal-wizard/book?scope=story_only', { cache: 'no-store' });
    expect(await fetchTextBookAvailability(async () => new Response(JSON.stringify({ ...raw, scope: 'storyboard', maxProviderAttempts: 5 })))).toBeUndefined();
  });
  it('admits only plan display, never a completed or partial manuscript, from a typed one-attempt HOLD', async () => {
    const raw = await heldOutput(), id = raw.planningResult.requestId;
    expect(readBookPlanningHoldPreview(raw, id)?.planningResult.planning.selection).toEqual(raw.planningResult.planning.selection);
    expect(readBookPreview(raw, id)).toBeNull(); expect(readBookPartialPreview(raw, id)).toBeNull();
    expect(readBookPlanningHoldPreview(raw, 'stale')).toBeNull();
    raw.accounting.estimatedUsd = null as any;
    expect(readBookPlanningHoldPreview(raw, id)?.accounting.estimatedUsd).toBeNull();
  });
  it.each(['version', 'status', 'error', 'runtime', 'innerRuntime', 'identity', 'receipt', 'coverage', 'numbering',
    'supported', 'ending', 'duplicate', 'attempts', 'writerResult', 'framePackets', 'storyboard', 'review', 'manuscript'])('rejects malformed or promoted HOLD %s', async mode => {
    const raw: any = await heldOutput(), id = raw.planningResult.requestId;
    if (mode === 'version') raw.version = 'personal-book-runner/diagnostic-v2';
    if (mode === 'status') raw.status = 'review_supported';
    if (mode === 'error') raw.error = 'book_cancelled';
    if (mode === 'runtime') raw.runtimeEligible = true;
    if (mode === 'innerRuntime') raw.planningResult.runtimeEligible = true;
    if (mode === 'identity') raw.planningResult.plan.requestId = 'foreign';
    if (mode === 'receipt') raw.planningResult.planning.sourcePlanDigest = 'a'.repeat(64);
    if (mode === 'coverage') raw.planningResult.plan.beats.pop();
    if (mode === 'numbering') raw.planningResult.plan.beats[1].pageNumber = 1;
    if (mode === 'supported') raw.planningResult.planning.selection.outlineChecks.earned_payoff.outcome = 'supported';
    if (mode === 'ending') raw.planningResult.planning.selection.outlineChecks.earned_payoff.evidenceSpreads = [1];
    if (mode === 'duplicate') raw.planningResult.planning.selection.outlineChecks.earned_payoff.evidenceSpreads = [8, 8];
    if (mode === 'attempts') raw.accounting.providerAttempts = 2;
    if (['writerResult', 'framePackets', 'storyboard', 'review', 'manuscript'].includes(mode)) raw[mode] = {};
    expect(readBookPlanningHoldPreview(raw, id)).toBeNull();
  });
  it.each(['book_cancelled', 'book_source_changed', 'book_outline_held'])('rejects a manufactured partial manuscript on %s', async error => {
    const data = await output();
    expect(readBookPartialPreview({ error, writerResult: data.writerResult, accounting: data.accounting }, data.writerResult.requestId)).toBeNull();
  });
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
