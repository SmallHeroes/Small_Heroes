import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  evaluateReviewApproval,
  markPageImageRewritten,
  markCoverRewritten,
  isLaunchManualReviewEnabled,
  type ReviewPageState,
} from '@/lib/manual-review-gate';

const page = (o: Partial<ReviewPageState> = {}): ReviewPageState => ({
  pageNumber: 1,
  reviewStatus: 'approved',
  imageVersion: 1,
  approvedImageVersion: 1,
  ...o,
});
const approvedCover = { hasCover: true, coverReviewStatus: 'approved' as const, coverImageVersion: 1, approvedCoverImageVersion: 1 };

describe('evaluateReviewApproval — fail-closed, version-bound', () => {
  it('bypasses entirely when manualReviewRequired is false (non-launch orders)', () => {
    const r = evaluateReviewApproval({
      manualReviewRequired: false,
      cover: { hasCover: true, coverReviewStatus: 'pending', coverImageVersion: 1, approvedCoverImageVersion: null },
      pages: [page({ reviewStatus: 'pending', approvedImageVersion: null })],
    });
    expect(r.fullyApproved).toBe(true);
    expect(r.blockers).toEqual([]);
  });

  it('approves when cover + every page are approved at the CURRENT version', () => {
    const r = evaluateReviewApproval({ manualReviewRequired: true, cover: approvedCover, pages: [page({ pageNumber: 1 }), page({ pageNumber: 2 })] });
    expect(r.fullyApproved).toBe(true);
    expect(r.blockers).toEqual([]);
  });

  it('blocks a pending page', () => {
    const r = evaluateReviewApproval({ manualReviewRequired: true, cover: approvedCover, pages: [page({ reviewStatus: 'pending', approvedImageVersion: null })] });
    expect(r.fullyApproved).toBe(false);
    expect(r.blockers).toContain('page1:pending');
  });

  it('blocks a rejected page', () => {
    const r = evaluateReviewApproval({ manualReviewRequired: true, cover: approvedCover, pages: [page({ reviewStatus: 'rejected', approvedImageVersion: null })] });
    expect(r.fullyApproved).toBe(false);
    expect(r.blockers).toContain('page1:rejected');
  });

  it('blocks a page approved at an OLD version (re-rendered since approval)', () => {
    const r = evaluateReviewApproval({ manualReviewRequired: true, cover: approvedCover, pages: [page({ imageVersion: 4, approvedImageVersion: 3 })] });
    expect(r.fullyApproved).toBe(false);
    expect(r.blockers.some((b) => b.startsWith('page1:version_mismatch'))).toBe(true);
  });

  it('blocks a pending cover even when all pages approved', () => {
    const r = evaluateReviewApproval({
      manualReviewRequired: true,
      cover: { hasCover: true, coverReviewStatus: 'pending', coverImageVersion: 1, approvedCoverImageVersion: null },
      pages: [page()],
    });
    expect(r.fullyApproved).toBe(false);
    expect(r.blockers).toContain('cover:pending');
  });

  it('blocks a cover approved at an OLD version', () => {
    const r = evaluateReviewApproval({
      manualReviewRequired: true,
      cover: { hasCover: true, coverReviewStatus: 'approved', coverImageVersion: 5, approvedCoverImageVersion: 4 },
      pages: [page()],
    });
    expect(r.fullyApproved).toBe(false);
    expect(r.blockers.some((b) => b.startsWith('cover:version_mismatch'))).toBe(true);
  });

  it('treats a book with no cover as cover-approved (n/a), still requires pages', () => {
    const r = evaluateReviewApproval({
      manualReviewRequired: true,
      cover: { hasCover: false, coverReviewStatus: 'pending', coverImageVersion: 0, approvedCoverImageVersion: null },
      pages: [page()],
    });
    expect(r.coverApproved).toBe(true);
    expect(r.fullyApproved).toBe(true);
  });

  it('blocks a manual-review order with zero pages (fail-closed)', () => {
    const r = evaluateReviewApproval({ manualReviewRequired: true, cover: approvedCover, pages: [] });
    expect(r.fullyApproved).toBe(false);
    expect(r.blockers).toContain('no_pages');
  });
});

describe('rewrite invalidation primitives', () => {
  it('markPageImageRewritten bumps the version and resets review to pending', async () => {
    const update = vi.fn(async () => ({}));
    await markPageImageRewritten({ bookPage: { update } } as never, 'page-1');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'page-1' },
      data: { imageVersion: { increment: 1 }, reviewStatus: 'pending', approvedImageVersion: null, reviewedBy: null, reviewedAt: null, reviewDecisionReason: null },
    });
  });

  it('markCoverRewritten bumps the cover version and resets cover review to pending', async () => {
    const update = vi.fn(async () => ({}));
    await markCoverRewritten({ generatedBook: { update } } as never, 'book-1');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: { coverImageVersion: { increment: 1 }, coverReviewStatus: 'pending', approvedCoverImageVersion: null, coverReviewedBy: null, coverReviewedAt: null, coverReviewDecisionReason: null },
    });
  });
});

describe('invalidation is wired at every image-write site (source guard)', () => {
  const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
  it('chunk-runner bumps the page version on a page write and the cover version on a cover write', () => {
    const src = read('lib/generation-pipeline/chunk-runner.ts');
    expect(src).toMatch(/markPageImageRewritten\(/);
    expect(src).toMatch(/markCoverRewritten\(/);
  });
  it('the single-page re-render path invalidates the page approval', () => {
    expect(read('lib/single-page-image-regen.ts')).toMatch(/markPageImageRewritten\(/);
  });
});

describe('isLaunchManualReviewEnabled', () => {
  it('is false unless LAUNCH_MANUAL_REVIEW === "true"', () => {
    const prev = process.env.LAUNCH_MANUAL_REVIEW;
    process.env.LAUNCH_MANUAL_REVIEW = '';
    expect(isLaunchManualReviewEnabled()).toBe(false);
    process.env.LAUNCH_MANUAL_REVIEW = 'true';
    expect(isLaunchManualReviewEnabled()).toBe(true);
    if (prev === undefined) delete process.env.LAUNCH_MANUAL_REVIEW;
    else process.env.LAUNCH_MANUAL_REVIEW = prev;
  });
});
