import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  applyBookColorNormalize,
  BOOK_COLOR_NORMALIZE_DEFAULT,
  BOOK_COLOR_SATURATION,
  BOOK_COLOR_WARM_B_SCALE,
  BOOK_COLOR_WARM_R_SCALE,
  isBookColorNormalizeEnabled,
} from '../book-color-normalize';

describe('book-color-normalize', () => {
  it('defaults normalization ON unless BOOK_COLOR_NORMALIZE=false', () => {
    expect(BOOK_COLOR_NORMALIZE_DEFAULT).toBe(true);
    const prev = process.env.BOOK_COLOR_NORMALIZE;
    delete process.env.BOOK_COLOR_NORMALIZE;
    expect(isBookColorNormalizeEnabled()).toBe(true);
    process.env.BOOK_COLOR_NORMALIZE = 'false';
    expect(isBookColorNormalizeEnabled()).toBe(false);
    if (prev === undefined) delete process.env.BOOK_COLOR_NORMALIZE;
    else process.env.BOOK_COLOR_NORMALIZE = prev;
  });

  it('applies warm bias after grey-world WB (R up, B down on neutral input)', async () => {
    const neutral = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 180, g: 160, b: 200 } },
    })
      .png()
      .toBuffer();

    const out = await applyBookColorNormalize(neutral);
    const stats = await sharp(out).stats();
    const r = stats.channels[0].mean;
    const g = stats.channels[1].mean;
    const b = stats.channels[2].mean;

    expect(r).toBeGreaterThan(g);
    expect(b).toBeLessThan(g);
    expect(BOOK_COLOR_WARM_R_SCALE).toBe(1.05);
    expect(BOOK_COLOR_WARM_B_SCALE).toBe(0.95);
    expect(BOOK_COLOR_SATURATION).toBe(0.92);
  });
});
