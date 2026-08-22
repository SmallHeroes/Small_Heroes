import type { PageLocationPlan, StoryLocationPlanBundle } from './types';

/** Pure page lookup used by runtime authority projection without loading sheet-generation code. */
export function resolvePageLocationPlan(
  bundle: StoryLocationPlanBundle,
  pageNumber: number,
): PageLocationPlan | null {
  const direct = bundle.pagePlans.find((page) => page.page === pageNumber);
  if (direct) return direct;
  if (pageNumber === 0) {
    const pageOne = bundle.pagePlans.find((page) => page.page === 1);
    if (!pageOne) return null;
    return {
      ...pageOne,
      page: 0,
      visibleAnchors: [
        ...pageOne.visibleAnchors,
        'story promise: child + companion + key home-night anchors',
      ],
    };
  }
  return null;
}
