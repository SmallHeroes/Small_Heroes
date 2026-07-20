import { describe, expect, it } from 'vitest';
import {
  LEFT_PAGE_MASK_WINDOW,
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

  it('exports the left-page mask window + source vars', () => {
    const vars = openBookLayoutCssVars();
    expect(vars['--book-image-mask-window-x']).toBeDefined();
    expect(vars['--book-image-mask-window-y']).toBeDefined();
    expect(vars['--book-image-mask-window-w']).toBeDefined();
    expect(vars['--book-image-mask-window-h']).toBeDefined();
    expect(vars['--book-image-mask-src']).toContain('BookImageBottomMask.png');
  });

  it('the mask window stays within the frame and is LARGER than the old cream-margin box', () => {
    const m = LEFT_PAGE_MASK_WINDOW;
    expect(m.x).toBeGreaterThanOrEqual(0);
    expect(m.y).toBeGreaterThanOrEqual(0);
    expect(m.x + m.w).toBeLessThanOrEqual(1.01);
    expect(m.y + m.h).toBeLessThanOrEqual(1.01);
    // The finding that decides the implementation (brief §4): the mask window is wider + taller than
    // OPEN_BOOK_PAGE_BOXES.leftPage and starts higher — the illustration is re-based onto THIS window, not
    // the old box. If someone re-tightens the box under the mask, this fails loudly.
    const box = OPEN_BOOK_PAGE_BOXES.leftPage;
    expect(m.w).toBeGreaterThan(box.w);
    expect(m.h).toBeGreaterThan(box.h);
    expect(m.y).toBeLessThan(box.y);
  });
});
