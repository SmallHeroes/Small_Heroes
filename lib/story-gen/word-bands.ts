import type { StoryDirection } from './story-generation-types';

/** Adventure prose target — prompts and thinness gate share these. */
export const ADVENTURE_WORD_MIN = 35;
export const ADVENTURE_WORD_MAX = 50;
export const ADVENTURE_HARD_MAX = 65;

/** Thin-page enrich target band (adventure). */
export const ENRICH_TARGET_MIN = 40;
export const ENRICH_TARGET_MAX = 48;
export const ENRICH_HARD_MAX = 55;

/** Fantasy prose target — 16-page books need richer read-aloud substance per page. */
export const FANTASY_WORD_MIN = 45;
export const FANTASY_WORD_MAX = 60;
export const FANTASY_HARD_MAX = 72;

/** Thin-page enrich target band (fantasy). */
export const FANTASY_ENRICH_TARGET_MIN = 48;
export const FANTASY_ENRICH_TARGET_MAX = 58;
export const FANTASY_ENRICH_HARD_MAX = 68;

export const BEDTIME_WORD_MIN = 25;
export const BEDTIME_WORD_MAX = 45;
export const BEDTIME_HARD_MAX = 55;

/** Fail thinness gate when strictly more than 25% of pages are below direction min. */
export const WORD_BAND_THIN_FAIL_MAJORITY = 0.25;

export function directionWordBand(direction: StoryDirection): {
  min: number;
  max: number;
  hardMax: number;
} {
  if (direction === 'adventure') {
    return { min: ADVENTURE_WORD_MIN, max: ADVENTURE_WORD_MAX, hardMax: ADVENTURE_HARD_MAX };
  }
  if (direction === 'fantasy') {
    return { min: FANTASY_WORD_MIN, max: FANTASY_WORD_MAX, hardMax: FANTASY_HARD_MAX };
  }
  if (direction === 'bedtime') {
    return { min: BEDTIME_WORD_MIN, max: BEDTIME_WORD_MAX, hardMax: BEDTIME_HARD_MAX };
  }
  return { min: 35, max: 55, hardMax: 70 };
}

export function directionEnrichBand(direction: StoryDirection): {
  floorWords: number;
  targetMin: number;
  targetMax: number;
  enrichHardMax: number;
} {
  if (direction === 'fantasy') {
    return {
      floorWords: FANTASY_WORD_MIN,
      targetMin: FANTASY_ENRICH_TARGET_MIN,
      targetMax: FANTASY_ENRICH_TARGET_MAX,
      enrichHardMax: FANTASY_ENRICH_HARD_MAX,
    };
  }
  return {
    floorWords: ADVENTURE_WORD_MIN,
    targetMin: ENRICH_TARGET_MIN,
    targetMax: ENRICH_TARGET_MAX,
    enrichHardMax: ENRICH_HARD_MAX,
  };
}

/** Directions that run post-rewrite thin-page enrich when below word floor. */
export function directionUsesDensityEnrich(direction: StoryDirection): boolean {
  return direction === 'adventure' || direction === 'fantasy';
}
