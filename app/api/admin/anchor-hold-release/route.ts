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
import { ROUTES, listenUrlFromReadUrl } from '@/lib/routes';
import { createLogger } from '@/lib/logger';
import { isReadinessManifestEnabled, commitBaseBookReadiness } from '@/lib/generation-pipeline/readiness-manifest';
import { resolveHumanQaCaseOnReleaseInTx } from '@/lib/human-qa/record-hold';
import { OutboxReconciliationError } from '@/lib/generation-chunked/delivery-outbox';

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

  // (Stage 1 safety FIX) This break-glass endpoint may release ONLY a low-confidence ANCHOR hold — NEVER a
  // physical-safety hold (`safety_hold:`) or a contract-world drift (`contract_world_hold:`). Those are terminal
  // human-QA parks whose already-rendered assets are unsafe/unverified/drifted; force-shipping them would deliver
  // an unsafe image. Enforced on BOTH paths (the readiness branch had this guard; the legacy readiness-OFF/prod
  // branch below did NOT — Fix 1 now routes safety holds through the same needs_human_qa status, so it must too).
  const holdReason = order.deliveryHoldReason ?? '';
  if (!holdReason.startsWith('anchor_low_confidence:')) {
    return NextResponse.json({ error: `Not releasable via anchor endpoint (reason=${holdReason || 'none'})` }, { status: 409 });
  }

  // B6: under the readiness flag this break-glass routes through the readiness path (re-evaluate + Outbox enqueue)
  // instead of a direct send — so a stale book can never be force-shipped past the Manifest.
  if (isReadinessManifestEnabled()) {
    try {
      const result = await commitBaseBookReadiness(prisma, { orderId: order.id, anchorAllowsDelivery: true, anchorOrderStatus: 'ready', anchorReason: null });
      log.info('Anchor hold released via readiness/Outbox path', { orderId, manifestStatus: result.manifestStatus, enqueued: result.enqueued });
      return NextResponse.json({ released: result.enqueued, viaOutbox: true, manifestStatus: result.manifestStatus, orderStatus: result.orderStatus, reason: result.reason });
    } catch (e) {
      // (#3h-D) A delivery already in flight / delivered / revoked / corrupt needs an EXPLICIT redelivery — surface
      // it as a typed 409, not a blanket catch (any OTHER error still propagates as a real 500). Match by class OR
      // name (name survives a module-registry duplication — e.g. bundling, or a test's resetModules).
      const recon = e instanceof OutboxReconciliationError
        ? e
        : ((e as { name?: string })?.name === 'OutboxReconciliationError' ? (e as OutboxReconciliationError) : null);
      if (recon) {
        log.warn('Anchor release blocked — delivery needs reconciliation', { orderId, dedupeKey: recon.dedupeKey, reason: recon.reason });
        return NextResponse.json({ error: 'Delivery needs explicit reconciliation (already in flight, delivered, revoked, or corrupt)', dedupeKey: recon.dedupeKey, reason: recon.reason }, { status: 409 });
      }
      throw e;
    }
  }

  // Flip to deliverable FIRST so the book is customer-viewable, THEN send the withheld email.
  // No regeneration — we reuse the already-rendered assets.
  // (Human-QA Slice 1) Close the active ANCHOR review case + suppress its unsent operator notification in the SAME
  // tx that releases the Order — otherwise the Order goes ready but the case stays open forever. kinds:['anchor']
  // means this can NEVER release a safety/contract_world case; it does not broaden what this endpoint may release
  // (the `anchor_low_confidence:` guard above already gates that). The Order-write data is byte-identical.
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'ready', deliveryHoldReason: null },
    });
    await resolveHumanQaCaseOnReleaseInTx(tx, {
      orderId: order.id,
      scope: 'base_book',
      kinds: ['anchor'],
      actor: 'admin:anchor_release',
    });
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
      ...(listenUrlFromReadUrl(readUrl, order.id) ? { listenUrl: listenUrlFromReadUrl(readUrl, order.id) } : {}),
      ...(order.book.coverImageUrl ? { coverImageUrl: order.book.coverImageUrl } : {}),
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
