/**
 * Post-rewrite word-band density check — triggers bounded enrich when thin.
 */

import { computePageWordCounts } from './story-page-utils';
import type { StoryDirection } from './story-generation-types';
import {
  directionUsesDensityEnrich,
  directionWordBand,
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
  const band = directionWordBand(direction);
  const pageCounts = computePageWordCounts(storyMarkdown);
  const belowMinCount = pageCounts.filter((c) => c < band.min).length;
  const totalPages = pageCounts.length;
  const thinRatio = totalPages > 0 ? belowMinCount / totalPages : 0;
  const needsEnrich =
    directionUsesDensityEnrich(direction) &&
    totalPages > 0 &&
    thinRatio > WORD_BAND_THIN_FAIL_MAJORITY;

  return {
    direction,
    pageCounts,
    belowMinCount,
    totalPages,
    thinRatio,
    needsEnrich,
    floorWords: band.min,
  };
}
