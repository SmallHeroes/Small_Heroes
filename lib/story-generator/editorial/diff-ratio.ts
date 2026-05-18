import { levenshtein } from '@/lib/story-validators/utils';
import { EDITORIAL_DIFF_RATIO_MAX } from './config';

export function pageChangeRatio(original: string, repaired: string): number {
  if (!original.length) return repaired.length > 0 ? 1 : 0;
  return levenshtein(original, repaired) / original.length;
}

export function exceedsEditorialDiffLimit(original: string, repaired: string): boolean {
  return pageChangeRatio(original, repaired) > EDITORIAL_DIFF_RATIO_MAX;
}
