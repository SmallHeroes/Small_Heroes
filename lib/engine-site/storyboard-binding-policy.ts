/** Additive policy, never a reinterpretation of historical authority/receipt bytes. */
export const ENGINE_STORYBOARD_BINDING = 'accepted-board-child-binding/v1' as const;
export const ENGINE_BOUND_REVIEW_STEP = 'prep_child_bound_review';
/**
 * The current customer engine's one focused repair of a held BOUND board (storyboard-bound-repair/v1) and its new review. An authority
 * without both slots (every historical one) keeps the exact old behaviour: a held bound review stops the book.
 */
export const ENGINE_BOUND_REPAIR_STEP = 'prep_child_bound_repair';
export const ENGINE_BOUND_REPAIR_REVIEW_STEP = 'prep_child_bound_repair_review';
