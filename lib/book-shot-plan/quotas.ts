import type { ShotPlanQuotas } from './types';

/** Page-count-aware minimum shot variety (8 / 12 / 16 beats). */
export function quotasForBeatCount(pageCount: number): ShotPlanQuotas {
  if (pageCount <= 8) {
    return {
      establishing: 1,
      emotionalClose: 1,
      dynamicAction: 1,
      quietTransition: 1,
      finalResolving: 1,
    };
  }
  if (pageCount <= 12) {
    return {
      establishing: 1,
      emotionalClose: 2,
      dynamicAction: 2,
      quietTransition: 1,
      finalResolving: 1,
    };
  }
  return {
    establishing: 1,
    emotionalClose: 2,
    dynamicAction: 2,
    quietTransition: 2,
    finalResolving: 1,
  };
}
