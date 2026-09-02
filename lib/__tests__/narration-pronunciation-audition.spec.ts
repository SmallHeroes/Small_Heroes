import { describe, expect, it } from 'vitest';

import { buildPageNarrationTtsText } from '@/backend/providers/audio';
import { stripNikud } from '@/lib/hebrew-text';
import {
  buildNarrationAuditionCells,
  NARRATION_AUDITION_ITEMS,
  NARRATION_AUDITION_NIQQUD_SCOPES,
  NARRATION_AUDITION_PUNCTUATION_MODES,
  validateNarrationAuditionItems,
} from '@/lib/tts-audition/narration-pronunciation-audition';

describe('narration pronunciation audition matrix', () => {
  it('defines four source-identical items and the approved 3 x 2 factors', () => {
    expect(() => validateNarrationAuditionItems()).not.toThrow();
    expect(NARRATION_AUDITION_ITEMS).toHaveLength(4);
    expect(NARRATION_AUDITION_NIQQUD_SCOPES).toEqual(['none', 'risk_words', 'full_sentence']);
    expect(NARRATION_AUDITION_PUNCTUATION_MODES).toEqual(['current_ellipsis', 'natural']);
    for (const item of NARRATION_AUDITION_ITEMS) {
      expect(stripNikud(item.riskWordsText)).toBe(item.rawText);
      expect(stripNikud(item.fullyVocalizedText)).toBe(item.rawText);
    }
  });

  it('builds exactly 24 unique full-factorial cells with one controlled seed per item', () => {
    const cells = buildNarrationAuditionCells();
    expect(cells).toHaveLength(24);
    expect(new Set(cells.map((cell) => cell.clipId)).size).toBe(24);

    for (const item of NARRATION_AUDITION_ITEMS) {
      const itemCells = cells.filter((cell) => cell.itemId === item.id);
      expect(itemCells).toHaveLength(6);
      expect(new Set(itemCells.map((cell) => cell.seed)).size).toBe(1);
      for (const niqqudScope of NARRATION_AUDITION_NIQQUD_SCOPES) {
        for (const punctuationMode of NARRATION_AUDITION_PUNCTUATION_MODES) {
          expect(itemCells).toContainEqual(expect.objectContaining({ niqqudScope, punctuationMode }));
        }
      }
    }
  });

  it('matches the real current runtime baseline and isolates punctuation within every niqqud scope', () => {
    const cells = buildNarrationAuditionCells();
    for (const item of NARRATION_AUDITION_ITEMS) {
      const baseline = cells.find(
        (cell) => cell.itemId === item.id && cell.niqqudScope === 'none' && cell.punctuationMode === 'current_ellipsis',
      );
      expect(baseline?.inputText).toBe(buildPageNarrationTtsText(item.rawText, false));

      for (const niqqudScope of NARRATION_AUDITION_NIQQUD_SCOPES) {
        const ellipsis = cells.find(
          (cell) => cell.itemId === item.id && cell.niqqudScope === niqqudScope && cell.punctuationMode === 'current_ellipsis',
        );
        const natural = cells.find(
          (cell) => cell.itemId === item.id && cell.niqqudScope === niqqudScope && cell.punctuationMode === 'natural',
        );
        expect(ellipsis?.inputText).toContain('... ');
        expect(natural?.inputText.endsWith('.')).toBe(true);
        expect(natural?.inputText).not.toContain('...');
      }
    }
  });

  it('contains both context-dependent readings for צפצפה and תפוח', () => {
    const poplar = NARRATION_AUDITION_ITEMS.find((item) => item.id === 'poplar_and_honked_tziftzefa');
    const apple = NARRATION_AUDITION_ITEMS.find((item) => item.id === 'apple_and_inflated_tapuach');
    expect(poplar?.riskWordsText).toContain('צִפְצְפָה');
    expect(poplar?.riskWordsText).toContain('צַפְצָפָה');
    expect(apple?.riskWordsText).toContain('תַּפּוּחַ');
    expect(apple?.riskWordsText).toContain('תָּפוּחַ');
  });
});
