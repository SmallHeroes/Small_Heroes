/**
 * #43 launch manual-review release gate — shared logic for the durable, launch-wide human-review hold.
 *
 * Invariant: when an order has `manualReviewRequired`, it is held (status needs_human_qa) and BOTH the
 * release endpoint and every distribution surface fail CLOSED until the cover AND every CURRENT page are
 * human-approved. Approvals are bound to a rendered VERSION (imageVersion / coverImageVersion), which bumps
 * on every image write — so any re-render invalidates a stale approval (binding to the ImageAsset id is NOT
 * reliable: re-render updates the asset url in place, keeping the same id).
 */
import type { PrismaClient, ReviewStatus } from '@prisma/client';

/**
 * Launch-wide manual review: when on, EVERY rendered order is held for human review, independent of the
 * experimental identity-vision flag. Read at render time and PERSISTED to Order.manualReviewRequired, so the
 * release / distribution decision never depends on a live env read that could flip between render and release.
 */
export function isLaunchManualReviewEnabled(): boolean {
  return process.env.LAUNCH_MANUAL_REVIEW === 'true';
}

/**
 * Bump a page's image version + reset its review state to pending — call AFTER every page-image write
 * (initial render OR re-render). An approval can then never outlive the exact asset a human saw.
 */
export async function markPageImageRewritten(prisma: Pick<PrismaClient, 'bookPage'>, pageId: string): Promise<void> {
  await prisma.bookPage.update({
    where: { id: pageId },
    data: {
      imageVersion: { increment: 1 },
      reviewStatus: 'pending',
      approvedImageVersion: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewDecisionReason: null,
    },
  });
}

/** Bump the cover version + reset cover review to pending — call AFTER every cover write. */
export async function markCoverRewritten(prisma: Pick<PrismaClient, 'generatedBook'>, bookId: string): Promise<void> {
  await prisma.generatedBook.update({
    where: { id: bookId },
    data: {
      coverImageVersion: { increment: 1 },
      coverReviewStatus: 'pending',
      approvedCoverImageVersion: null,
      coverReviewedBy: null,
      coverReviewedAt: null,
      coverReviewDecisionReason: null,
    },
  });
}

export interface ReviewPageState {
  pageNumber: number;
  reviewStatus: ReviewStatus;
  imageVersion: number;
  approvedImageVersion: number | null;
}
export interface ReviewCoverState {
  hasCover: boolean;
  coverReviewStatus: ReviewStatus;
  coverImageVersion: number;
  approvedCoverImageVersion: number | null;
}
export interface ReviewApprovalInput {
  manualReviewRequired: boolean;
  cover: ReviewCoverState;
  pages: ReviewPageState[];
}
export interface ReviewApprovalResult {
  manualReviewRequired: boolean;
  coverApproved: boolean;
  pagesApproved: boolean;
  fullyApproved: boolean;
  /** Human-readable reasons the order is not releasable (empty ⇒ releasable). */
  blockers: string[];
}

const isPageApproved = (p: ReviewPageState): boolean =>
  p.reviewStatus === 'approved' && p.approvedImageVersion != null && p.approvedImageVersion === p.imageVersion;

const isCoverApproved = (c: ReviewCoverState): boolean =>
  !c.hasCover || (c.coverReviewStatus === 'approved' && c.approvedCoverImageVersion != null && c.approvedCoverImageVersion === c.coverImageVersion);

/**
 * Pure release / distribution gate. When `manualReviewRequired` is false the gate is not engaged
 * (fullyApproved = true). Otherwise the cover and EVERY current page must be approved at their current
 * version; any pending / rejected / version-mismatch (or a book with no pages) is a blocker.
 */
export function evaluateReviewApproval(input: ReviewApprovalInput): ReviewApprovalResult {
  if (!input.manualReviewRequired) {
    return { manualReviewRequired: false, coverApproved: true, pagesApproved: true, fullyApproved: true, blockers: [] };
  }
  const blockers: string[] = [];

  const coverApproved = isCoverApproved(input.cover);
  if (!coverApproved) {
    const c = input.cover;
    blockers.push(
      c.coverReviewStatus !== 'approved'
        ? `cover:${c.coverReviewStatus}`
        : `cover:version_mismatch(approved=${c.approvedCoverImageVersion},current=${c.coverImageVersion})`,
    );
  }

  if (input.pages.length === 0) blockers.push('no_pages');
  for (const p of input.pages) {
    if (!isPageApproved(p)) {
      blockers.push(
        p.reviewStatus !== 'approved'
          ? `page${p.pageNumber}:${p.reviewStatus}`
          : `page${p.pageNumber}:version_mismatch(approved=${p.approvedImageVersion},current=${p.imageVersion})`,
      );
    }
  }

  const pagesApproved = input.pages.length > 0 && input.pages.every(isPageApproved);
  return {
    manualReviewRequired: true,
    coverApproved,
    pagesApproved,
    fullyApproved: coverApproved && pagesApproved,
    blockers,
  };
}
