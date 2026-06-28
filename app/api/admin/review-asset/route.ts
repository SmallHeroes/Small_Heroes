/**
 * POST /api/admin/review-asset — record a human review decision (#43) for a single page image or the cover.
 *
 * Approving BINDS the decision to the asset's CURRENT rendered version (approvedImageVersion = imageVersion,
 * approvedCoverImageVersion = coverImageVersion). A later re-render bumps the version and resets the item to
 * `pending` (markPageImageRewritten / markCoverRewritten), so a stale approval can never survive a re-render.
 * The release endpoint (anchor-hold-release) then fails CLOSED until the cover + every page are approved at
 * their current version. Secret-gated (GENERATION_SECRET), mirroring anchor-hold-release. This is the backend
 * contract the (separate) reviewer UI builds on.
 */
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const log = createLogger({ subsystem: 'manual-review', route: '/api/admin/review-asset' });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expectedSecret = process.env.GENERATION_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: 'Review disabled (server misconfigured)' }, { status: 503 });
  }

  let body: {
    secret?: unknown; orderId?: unknown; target?: unknown;
    pageNumber?: unknown; decision?: unknown; reviewedBy?: unknown; reason?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.secret !== 'string' || body.secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId : '';
  const target = body.target === 'page' || body.target === 'cover' ? body.target : null;
  const decision = body.decision === 'approved' || body.decision === 'rejected' ? body.decision : null;
  const reviewedBy = typeof body.reviewedBy === 'string' ? body.reviewedBy.slice(0, 200) : null;
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;
  if (!orderId || !target || !decision) {
    return NextResponse.json({ error: 'orderId, target (page|cover) and decision (approved|rejected) are required' }, { status: 400 });
  }

  const book = await prisma.generatedBook.findUnique({ where: { orderId }, select: { id: true } });
  if (!book) {
    return NextResponse.json({ error: 'No book for order' }, { status: 404 });
  }
  const now = new Date();

  if (target === 'cover') {
    const current = await prisma.generatedBook.findUnique({ where: { id: book.id }, select: { coverImageVersion: true } });
    await prisma.generatedBook.update({
      where: { id: book.id },
      data: {
        coverReviewStatus: decision,
        approvedCoverImageVersion: decision === 'approved' ? current!.coverImageVersion : null,
        coverReviewedBy: reviewedBy,
        coverReviewedAt: now,
        coverReviewDecisionReason: reason,
      },
    });
    log.info('Cover review recorded', { orderId, decision, by: reviewedBy });
    return NextResponse.json({ ok: true, target, decision, approvedVersion: decision === 'approved' ? current!.coverImageVersion : null });
  }

  // target === 'page'
  const pageNumber = typeof body.pageNumber === 'number' && Number.isInteger(body.pageNumber) ? body.pageNumber : null;
  if (pageNumber === null) {
    return NextResponse.json({ error: 'pageNumber (integer) is required for target=page' }, { status: 400 });
  }
  const page = await prisma.bookPage.findFirst({ where: { bookId: book.id, pageNumber }, select: { id: true, imageVersion: true } });
  if (!page) {
    return NextResponse.json({ error: `Page ${pageNumber} not found` }, { status: 404 });
  }
  await prisma.bookPage.update({
    where: { id: page.id },
    data: {
      reviewStatus: decision,
      approvedImageVersion: decision === 'approved' ? page.imageVersion : null,
      reviewedBy,
      reviewedAt: now,
      reviewDecisionReason: reason,
    },
  });
  log.info('Page review recorded', { orderId, pageNumber, decision, by: reviewedBy });
  return NextResponse.json({ ok: true, target, pageNumber, decision, approvedVersion: decision === 'approved' ? page.imageVersion : null });
}
