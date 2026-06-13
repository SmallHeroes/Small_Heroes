/**
 * Customer-facing direction labels + page/price metadata from wizard config.
 */
import {
  DIRECTION_PAGE_MAP,
  displayPagesForBeats,
} from '@/backend/config/wizard';
import type { StoryDirection } from '@/backend/config/mvp-story-matrix';

export const DIRECTION_ORDER: StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];

export const DIRECTION_LABELS: Record<StoryDirection, string> = {
  bedtime: 'לילה טוב',
  adventure: 'הרפתקה',
  fantasy: 'פנטזיה',
};

export function directionDisplayMeta(direction: StoryDirection) {
  const map = DIRECTION_PAGE_MAP[direction];
  return {
    priceILS: map?.priceILS ?? 0,
    displayPages: displayPagesForBeats(map?.pages ?? 0),
  };
}
