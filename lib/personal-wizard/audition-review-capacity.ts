import { ReviewedAuditionError } from './simple-book-reviewed-audition';
const fail = (code: string): never => { throw new ReviewedAuditionError(code); };
export const AUDITION_REVIEW_CAPACITY_VERSION = 'audition-review-capacity/v1' as const;
export function auditionReviewOutputCap(version?: typeof AUDITION_REVIEW_CAPACITY_VERSION) {
  if (version !== undefined && version !== AUDITION_REVIEW_CAPACITY_VERSION) fail('audition_review_capacity');
  return version === AUDITION_REVIEW_CAPACITY_VERSION ? 24000 : 12000;
}
