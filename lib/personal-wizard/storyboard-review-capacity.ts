/** Prospective transport capacity only. No instruction/schema/evidence/quality or planner-default change. */
export const STORYBOARD_REVIEW_CAPACITY = Object.freeze({ version:'storyboard-review-input-capacity/v1' as const,
  contentBytes:208000,wireBytes:240000 });
export type StoryboardReviewCapacity = typeof STORYBOARD_REVIEW_CAPACITY.version;
export function storyboardReviewCapacity(value:unknown){
  if(value!==undefined&&value!==STORYBOARD_REVIEW_CAPACITY.version)throw Error('storyboard_review_capacity');
  return value===STORYBOARD_REVIEW_CAPACITY.version?STORYBOARD_REVIEW_CAPACITY:null;
}
