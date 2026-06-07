import type { StoryDirection } from './story-generation-types';

/** Adventure prose target — prompts and thinness gate share these. */
export const ADVENTURE_WORD_MIN = 35;
export const ADVENTURE_WORD_MAX = 50;
export const ADVENTURE_HARD_MAX = 65;

export const BEDTIME_WORD_MIN = 25;
export const BEDTIME_WORD_MAX = 45;
export const BEDTIME_HARD_MAX = 55;

/** Fail thinness gate when strictly more than half of pages are below direction min. */
export const WORD_BAND_THIN_FAIL_MAJORITY = 0.5;

export function directionWordBand(direction: StoryDirection): {
  min: number;
  max: number;
  hardMax: number;
} {
  if (direction === 'adventure') {
    return { min: ADVENTURE_WORD_MIN, max: ADVENTURE_WORD_MAX, hardMax: ADVENTURE_HARD_MAX };
  }
  if (direction === 'bedtime') {
    return { min: BEDTIME_WORD_MIN, max: BEDTIME_WORD_MAX, hardMax: BEDTIME_HARD_MAX };
  }
  return { min: 35, max: 55, hardMax: 70 };
}
