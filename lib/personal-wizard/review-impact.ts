/**
 * The ONE impact vocabulary of the reviewed stages, most severe first: the reviewed audition's page/sheet findings use it as is, and the
 * storyboard's typed review materiality (storyboard-review-impact/v1) adds its required-evidence gate before detail. Only a detail is
 * non-material; every other impact is material and blocks. Kept dependency-free so both stages import it without a cycle.
 */
export const REVIEW_IMPACT_ORDER = ['safety', 'story', 'identity', 'continuity', 'detail'] as const;
export type ReviewImpact = typeof REVIEW_IMPACT_ORDER[number];
/** Materiality is the reviewer's typed answer: only `detail` is non-material (never inferred from a category, name or verdict). */
export const impactIsMaterial = (impact: string) => impact !== 'detail';
