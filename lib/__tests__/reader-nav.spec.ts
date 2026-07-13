import { describe, expect, it } from 'vitest';
import {
  readerNavForward,
  readerNavBackward,
  type ReaderNavContext,
} from '@/app/book/[id]/read-v2/reader-nav';

// Book = cover(0), story1(1), story2(2), dedication(3). lastStoryIndex = 2 (the scene before the dedication).
const withDedicationAndPowerCard: ReaderNavContext = {
  lastStoryIndex: 2,
  dedicationIndex: 3,
  hasDedication: true,
  hasPowerCard: true,
  sceneCount: 4,
};

describe('reader-nav — dedication is the FINAL page, AFTER the power card', () => {
  it('forward: last story page → power card → dedication → end', () => {
    const c = withDedicationAndPowerCard;
    // last story page (2) → power card overlay (index unchanged)
    expect(readerNavForward({ index: 2, powerCard: false, end: false }, c)).toEqual({ index: 2, powerCard: true, end: false });
    // power card → the dedication PAGE (index 3)
    expect(readerNavForward({ index: 2, powerCard: true, end: false }, c)).toEqual({ index: 3, powerCard: false, end: false });
    // dedication (the final page) → end screen
    expect(readerNavForward({ index: 3, powerCard: false, end: false }, c)).toEqual({ index: 3, powerCard: false, end: true });
  });

  it('backward: end → dedication → power card → last story page', () => {
    const c = withDedicationAndPowerCard;
    expect(readerNavBackward({ index: 3, powerCard: false, end: true }, c)).toEqual({ index: 3, powerCard: false, end: false });
    expect(readerNavBackward({ index: 3, powerCard: false, end: false }, c)).toEqual({ index: 2, powerCard: true, end: false });
    expect(readerNavBackward({ index: 2, powerCard: true, end: false }, c)).toEqual({ index: 2, powerCard: false, end: false });
  });

  it('normal forward clamps to the last story page — never slides into the dedication directly', () => {
    const c = withDedicationAndPowerCard;
    expect(readerNavForward({ index: 1, powerCard: false, end: false }, c)).toEqual({ index: 2, powerCard: false, end: false });
    // from the last story page it must go through the power card, not straight to the dedication
    expect(readerNavForward({ index: 2, powerCard: false, end: false }, c).index).toBe(2);
  });
});

describe('reader-nav — empty dedication: no dedication page (graceful)', () => {
  const noDedication: ReaderNavContext = {
    lastStoryIndex: 2,
    dedicationIndex: -1,
    hasDedication: false,
    hasPowerCard: true,
    sceneCount: 3,
  };

  it('forward: last page → power card → end (no dedication page)', () => {
    expect(readerNavForward({ index: 2, powerCard: false, end: false }, noDedication)).toEqual({ index: 2, powerCard: true, end: false });
    expect(readerNavForward({ index: 2, powerCard: true, end: false }, noDedication)).toEqual({ index: 2, powerCard: false, end: true });
  });

  it('backward: end → power card → last page (never a dedication)', () => {
    expect(readerNavBackward({ index: 2, powerCard: false, end: true }, noDedication)).toEqual({ index: 2, powerCard: true, end: false });
  });
});

describe('reader-nav — dedication without a power card', () => {
  const dedicationNoPowerCard: ReaderNavContext = {
    lastStoryIndex: 2,
    dedicationIndex: 3,
    hasDedication: true,
    hasPowerCard: false,
    sceneCount: 4,
  };

  it('forward: last story page → dedication → end (power card skipped)', () => {
    expect(readerNavForward({ index: 2, powerCard: false, end: false }, dedicationNoPowerCard)).toEqual({ index: 3, powerCard: false, end: false });
    expect(readerNavForward({ index: 3, powerCard: false, end: false }, dedicationNoPowerCard)).toEqual({ index: 3, powerCard: false, end: true });
  });

  it('backward: dedication → last story page (no power card)', () => {
    expect(readerNavBackward({ index: 3, powerCard: false, end: false }, dedicationNoPowerCard)).toEqual({ index: 2, powerCard: false, end: false });
  });
});

describe('reader-nav — neither power card nor dedication (today’s flow)', () => {
  const plain: ReaderNavContext = {
    lastStoryIndex: 2,
    dedicationIndex: -1,
    hasDedication: false,
    hasPowerCard: false,
    sceneCount: 3,
  };
  it('last page → end screen directly', () => {
    expect(readerNavForward({ index: 2, powerCard: false, end: false }, plain)).toEqual({ index: 2, powerCard: false, end: true });
  });
});
