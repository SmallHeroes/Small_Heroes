/**
 * Post-rewrite adventure word-band density check — triggers bounded enrich when thin.
 */

import { computePageWordCounts } from './story-page-utils';
import type { StoryDirection } from './story-generation-types';
import {
  ADVENTURE_WORD_MIN,
  WORD_BAND_THIN_FAIL_MAJORITY,
} from './word-bands';

export interface AdventureDensityCheck {
  direction: StoryDirection;
  pageCounts: number[];
  belowMinCount: number;
  totalPages: number;
  thinRatio: number;
  needsEnrich: boolean;
  floorWords: number;
}

export function checkAdventureDensity(
  storyMarkdown: string,
  direction: StoryDirection
): AdventureDensityCheck {
  const pageCounts = computePageWordCounts(storyMarkdown);
  const belowMinCount = pageCounts.filter((c) => c < ADVENTURE_WORD_MIN).length;
  const totalPages = pageCounts.length;
  const thinRatio = totalPages > 0 ? belowMinCount / totalPages : 0;
  const needsEnrich =
    direction === 'adventure' &&
    totalPages > 0 &&
    thinRatio > WORD_BAND_THIN_FAIL_MAJORITY;

  return {
    direction,
    pageCounts,
    belowMinCount,
    totalPages,
    thinRatio,
    needsEnrich,
    floorWords: ADVENTURE_WORD_MIN,
  };
}
