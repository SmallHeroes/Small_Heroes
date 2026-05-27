import { describe, expect, it } from 'vitest';
import {
  OPEN_BOOK_PAGE_BOXES,
  openBookLayoutCssVars,
  openBookTextSafeZone,
} from '../open-book-layout';

describe('open-book-layout', () => {
  it('page boxes stay within unit square', () => {
    for (const box of Object.values(OPEN_BOOK_PAGE_BOXES)) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(1.01);
      expect(box.y + box.h).toBeLessThanOrEqual(1.01);
    }
  });

  it('text safe zone sits inside right page with mask-clearing padding', () => {
    const safe = openBookTextSafeZone();
    const right = OPEN_BOOK_PAGE_BOXES.rightPage;
    expect(safe.x).toBeGreaterThan(right.x);
    expect(safe.x + safe.w).toBeLessThan(right.x + right.w);
    expect(safe.y).toBeGreaterThanOrEqual(right.y);
    // Safe column must clear MaskOnBook decorative borders on every side.
    // Width: >=80% of page (some loss to mask borders is expected).
    expect(safe.w / right.w).toBeGreaterThan(0.80);
    // Height: >=80% of page (top/bottom mask borders need clearance).
    expect(safe.h / right.h).toBeGreaterThan(0.80);
  });

  it('exports CSS vars for all measured regions', () => {
    const vars = openBookLayoutCssVars();
    expect(vars['--open-left-page-x']).toBeDefined();
    expect(vars['--open-text-safe-w']).toBeDefined();
    expect(vars['--open-spread-h']).toBeDefined();
  });
});
