import { describe, expect, it } from 'vitest';
import { adaptLegacyBookToStoryScenes } from '@/lib/book-layout';
import { formatHebrewForDisplay, stripNikud } from '@/lib/hebrew-text';

describe('stripNikud / display layer', () => {
  it('removes niqqud but keeps letters and gender chips', () => {
    const raw = 'אֲנִי אוּרִי, {אמר|אמרה} {{childName}}';
    const stripped = stripNikud(raw);
    expect(stripped).toBe('אני אורי, {אמר|אמרה} {{childName}}');
    expect(stripped).not.toMatch(/[\u0591-\u05C7]/);
  });

  it('preserves maqaf (U+05BE) — hyphenated names must not fuse', () => {
    expect(stripNikud('בּוּנִי־אומץ יושב')).toBe('בוני־אומץ יושב');
    expect(formatHebrewForDisplay('בּוּנִי־אומץ')).toContain('־');
  });

  it('reader scenes use display text without nikud while bank raw keeps nikud', () => {
    const bankText = 'אֲנִי אוּרִי. {שכב|שכבה} במיטה.';
    const scenes = adaptLegacyBookToStoryScenes({
      book: {
        pages: [{ pageNumber: 1, text: bankText, imageUrl: null }],
      },
      storyDirection: 'bedtime',
    });
    expect(scenes[0].text).not.toMatch(/[\u0591-\u05C7]/);
    expect(scenes[0].text).toContain('אני אורי');
    expect(formatHebrewForDisplay(bankText)).toBe(scenes[0].text.replace(/\s+/g, ' ').trim());
  });
});
