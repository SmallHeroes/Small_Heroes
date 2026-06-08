import { describe, expect, it } from 'vitest';
import {
  ADVENTURE_WORD_MAX,
  ADVENTURE_WORD_MIN,
  BEDTIME_WORD_MAX,
  BEDTIME_WORD_MIN,
  directionEnrichBand,
  directionUsesDensityEnrich,
  directionWordBand,
  FANTASY_ENRICH_TARGET_MAX,
  FANTASY_ENRICH_TARGET_MIN,
  FANTASY_WORD_MAX,
  FANTASY_WORD_MIN,
} from '../story-gen/word-bands';

describe('directionWordBand', () => {
  it('keeps adventure and bedtime bands unchanged', () => {
    expect(directionWordBand('adventure')).toEqual({
      min: ADVENTURE_WORD_MIN,
      max: ADVENTURE_WORD_MAX,
      hardMax: 65,
    });
    expect(directionWordBand('bedtime')).toEqual({
      min: BEDTIME_WORD_MIN,
      max: BEDTIME_WORD_MAX,
      hardMax: 55,
    });
  });

  it('sets fantasy-specific density target 45–60 words/page', () => {
    expect(directionWordBand('fantasy')).toEqual({
      min: FANTASY_WORD_MIN,
      max: FANTASY_WORD_MAX,
      hardMax: 72,
    });
    expect(FANTASY_WORD_MIN).toBe(45);
    expect(FANTASY_WORD_MAX).toBe(60);
  });

  it('enables density enrich for adventure and fantasy only', () => {
    expect(directionUsesDensityEnrich('adventure')).toBe(true);
    expect(directionUsesDensityEnrich('fantasy')).toBe(true);
    expect(directionUsesDensityEnrich('bedtime')).toBe(false);
  });

  it('provides fantasy enrich band above adventure floor', () => {
    const band = directionEnrichBand('fantasy');
    expect(band.floorWords).toBe(45);
    expect(band.targetMin).toBe(FANTASY_ENRICH_TARGET_MIN);
    expect(band.targetMax).toBe(FANTASY_ENRICH_TARGET_MAX);
    expect(band.targetMin).toBeGreaterThanOrEqual(48);
  });
});
