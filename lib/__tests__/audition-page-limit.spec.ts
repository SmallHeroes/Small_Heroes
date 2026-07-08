import { describe, expect, it } from 'vitest';
import {
  resolveRenderImagePageLimit,
  selectAuditionPageNumbers,
} from '@/lib/generation-chunked/audition-limit';

/**
 * Count-propagation contract for the dev Creator (full book + audition-N). The failure class was:
 * the story-bank route truncated the story to a request page count and cached THAT as expectedPageCount,
 * while the worker's finalization reloaded a DIFFERENT count -> "Story page count N !== expected M"
 * before any image. The fix: ALWAYS load the full authored story (so expectedPageCount == the full count
 * == what the worker loads -> the guard passes truthfully) and cap only IMAGE rendering via
 * renderImagePageLimit. These tests pin both halves + the invariant that ties them together.
 */

const AUTHORED = 12; // e.g. bunny_ometz_adventure

describe('resolveRenderImagePageLimit — full book renders full; audition caps only images', () => {
  it('FULL BOOK: 0 / "all" => undefined (render every page)', () => {
    expect(resolveRenderImagePageLimit(0, AUTHORED)).toBeUndefined();
  });
  it('FULL BOOK: a requested count >= the authored count => undefined (render all, never over-render)', () => {
    expect(resolveRenderImagePageLimit(AUTHORED, AUTHORED)).toBeUndefined();
    expect(resolveRenderImagePageLimit(20, AUTHORED)).toBeUndefined();
  });
  it('AUDITION: a requested count below the authored count => that N (render first N images)', () => {
    expect(resolveRenderImagePageLimit(5, AUTHORED)).toBe(5);
    expect(resolveRenderImagePageLimit(1, AUTHORED)).toBe(1);
  });
  it('invalid / negative => undefined (render all; never a negative or zero cap)', () => {
    expect(resolveRenderImagePageLimit(-3, AUTHORED)).toBeUndefined();
    expect(resolveRenderImagePageLimit(Number.NaN, AUTHORED)).toBeUndefined();
  });
});

describe('selectAuditionPageNumbers — the first-N image set (never truncates the story)', () => {
  const allPages = Array.from({ length: AUTHORED }, (_, i) => i + 1); // [1..12], ordered asc

  it('no limit => null (every page renders — full book / prod path unchanged)', () => {
    expect(selectAuditionPageNumbers(allPages, undefined)).toBeNull();
    expect(selectAuditionPageNumbers(allPages, null)).toBeNull();
  });
  it('a limit >= total => null (render all)', () => {
    expect(selectAuditionPageNumbers(allPages, AUTHORED)).toBeNull();
    expect(selectAuditionPageNumbers(allPages, 99)).toBeNull();
  });
  it('audition N => the first N page numbers by order', () => {
    expect(selectAuditionPageNumbers(allPages, 3)).toEqual(new Set([1, 2, 3]));
    expect(selectAuditionPageNumbers(allPages, 1)).toEqual(new Set([1]));
  });
  it('respects order for non-1-based / sparse page numbers', () => {
    expect(selectAuditionPageNumbers([5, 6, 7, 8], 2)).toEqual(new Set([5, 6]));
  });
});

describe('invariant — expectedPageCount is the FULL count regardless of the image cap (no more 12!==5)', () => {
  // The route caches expectedPageCount = storyFull.pages.length (the full authored count) INDEPENDENTLY
  // of the render cap, and the worker loads the same full story. So the finalization guard
  // (expected === loaded) holds for BOTH modes: the audition never truncates the narrative — it only
  // reduces how many pages get images.
  it('full-book: expectedPageCount == authored count; no image cap; every page renders', () => {
    const expectedPageCount = AUTHORED; // route: storyFull.pages.length (full load, no truncation)
    const limit = resolveRenderImagePageLimit(0, AUTHORED);
    expect(expectedPageCount).toBe(AUTHORED);
    expect(limit).toBeUndefined();
    const pages = Array.from({ length: expectedPageCount }, (_, i) => i + 1);
    expect(selectAuditionPageNumbers(pages, limit)).toBeNull();
  });
  it('audition-5: expectedPageCount is STILL the full count (guard passes); only 5 images render', () => {
    const expectedPageCount = AUTHORED; // unchanged by the cap — the story is not truncated
    const limit = resolveRenderImagePageLimit(5, AUTHORED);
    expect(expectedPageCount).toBe(AUTHORED); // the fix: no truncation, so no "12 !== 5" mismatch
    expect(limit).toBe(5);
    const pages = Array.from({ length: expectedPageCount }, (_, i) => i + 1);
    expect(selectAuditionPageNumbers(pages, limit)).toEqual(new Set([1, 2, 3, 4, 5]));
  });
});
