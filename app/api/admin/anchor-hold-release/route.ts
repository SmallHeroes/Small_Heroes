/**
 * POST /api/admin/anchor-hold-release — human-QA release of a low-confidence-anchor delivery hold.
 *
 * A book with a soft/hard low-confidence anchor finishes generation but is held: order status
 * `needs_human_qa`, deliveryHoldReason set, book-ready email withheld (see chunk-runner package
 * stage + resolveAnchorDeliveryGate). After a human eyeballs the rendered book, this endpoint
 * RELEASES it to the customer: status → `ready`, deliveryHoldReason cleared, and the withheld
 * book-ready email is sent using the ALREADY-RENDERED assets. It NEVER regenerates anything.
 *
 * Idempotent: releasing an already-released (ready/partial) order is a no-op and does not re-send.
 * Secret-gated (GENERATION_SECRET), like POST /api/generate. Deliberately NOT under /dev so it
 * works in whatever environment the held order lives in (holds occur where generation runs); the
 * secret is the only gate. Middleware does not match /api/admin.
 *
 * NOTE: this is the one deliberate, human-gated caller of sendBookReadyEmail besides the chunked
 * package stage. No automatic/payment path may send it (see the guard test in
 * lib/__tests__/book-ready-email-reachability.spec.ts).
 */
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { sendBookReadyEmail } from '@/backend/lib/email';
import { ROUTES } from '@/lib/routes';
import { createLogger } from '@/lib/logger';
import { isReadinessManifestEnabled, commitBaseBookReadiness } from '@/lib/generation-pipeline/readiness-manifest';

const log = createLogger({ subsystem: 'anchor-hold', route: '/api/admin/anchor-hold-release' });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expectedSecret = process.env.GENERATION_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: 'Release disabled (server misconfigured)' }, { status: 503 });
  }

  let body: { orderId?: unknown; secret?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.secret !== 'string' || body.secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const orderId = typeof body.orderId === 'string' ? body.orderId : '';
  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      book: {
        include: {
          audioAsset: true,
          pages: {
            where: { audioUrl: { not: null } },
            orderBy: { pageNumber: 'asc' },
            take: 1,
          },
        },
      },
    },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Idempotent: already released → no-op, do NOT re-send the email.
  if (order.status === 'ready' || order.status === 'partial') {
    return NextResponse.json({ released: true, alreadyReleased: true, orderId, status: order.status });
  }
  if (order.status !== 'needs_human_qa') {
    return NextResponse.json(
      { error: `Order is not on delivery hold (status=${order.status})` },
      { status: 409 }
    );
  }
  if (!order.book) {
    return NextResponse.json({ error: 'No rendered book to release' }, { status: 409 });
  }

  // B6: under the readiness flag this break-glass may ONLY release a genuine ANCHOR hold (never an integrity /
  // readiness-stale hold), and it routes through the readiness path (re-evaluate + Outbox enqueue) instead of a
  // direct send — so a stale book can never be force-shipped past the Manifest.
  if (isReadinessManifestEnabled()) {
    const reason = order.deliveryHoldReason ?? '';
    if (!reason.startsWith('anchor_low_confidence:')) {
      return NextResponse.json({ error: `Not releasable via anchor endpoint (reason=${reason || 'none'})` }, { status: 409 });
    }
    const result = await commitBaseBookReadiness(prisma, { orderId: order.id, anchorAllowsDelivery: true, anchorOrderStatus: 'ready', anchorReason: null });
    log.info('Anchor hold released via readiness/Outbox path', { orderId, manifestStatus: result.manifestStatus, enqueued: result.enqueued });
    return NextResponse.json({ released: result.enqueued, viaOutbox: true, manifestStatus: result.manifestStatus, orderStatus: result.orderStatus, reason: result.reason });
  }

  // Flip to deliverable FIRST so the book is customer-viewable, THEN send the withheld email.
  // No regeneration — we reuse the already-rendered assets.
  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'ready', deliveryHoldReason: null },
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const accessKey = order.paymentId ?? order.paymeTransactionId ?? order.stripeSessionId;
  const readUrl =
    order.book.readUrl ??
    (accessKey
      ? `${appUrl}${ROUTES.ready}?orderId=${order.id}&accessKey=${encodeURIComponent(accessKey)}`
      : `${appUrl}${ROUTES.ready}?orderId=${order.id}`);

  let emailSent = false;
  try {
    await sendBookReadyEmail({
      to: order.customerEmail,
      customerName: order.customerName ?? order.childName,
      childName: order.childName,
      readUrl,
      audioUrl: order.book.pages[0]?.audioUrl ?? order.book.audioAsset?.url ?? undefined,
      pdfUrl: order.book.pdfUrl ?? undefined,
    });
    emailSent = true;
    log.info('Delivery hold released + book-ready email sent', { orderId, was: order.deliveryHoldReason });
  } catch (e) {
    // Non-fatal: the order is already released/viewable; the email can be re-sent manually.
    log.error('Release email failed (order already released)', e, { orderId });
  }

  return NextResponse.json({ released: true, orderId, status: 'ready', emailSent });
}
