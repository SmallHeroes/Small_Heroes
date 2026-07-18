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
import { resolveHumanQaCaseOnReleaseInTx } from '@/lib/human-qa/record-hold';
import { syncHumanQaHoldCasePostCommit } from '@/lib/human-qa/sync-hold-case';

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

  // (re-gate P0-A) ONE flag-INDEPENDENT release-authorization routine — used identically whether
  // READINESS_MANIFEST_ENABLED is on or off. Round 2 hardened ONLY the readiness-OFF path: with the flag ON the
  // handler used to call commitBaseBookReadiness and RETURN, skipping the lock, the active-case guards, and the CAS
  // — so on readiness-ON the exact `skip_weaker` divergence (a safety/payment case ACTIVE while the marker still
  // reads `anchor_low_confidence:`) still released, and commitBaseBookReadiness's CAS (id + inputVersion only, which
  // safety/payment updates do NOT bump) could not protect against it. Neither path may depend on the flag for its
  // safety, so BOTH now run this single routine. (Trade-off surfaced for the re-gate: the readiness-ON path no
  // longer routes anchor-release through the Manifest/Outbox re-eval — the anchor hold's assets already passed
  // integrity; the human has eyeballed the book — it uses the same atomic direct release as the OFF path, matching
  // the flag-OFF production default.)
  //
  // Flip to deliverable FIRST so the book is customer-viewable, THEN send the withheld email. No regeneration — we
  // reuse the already-rendered assets. The pre-tx marker read (holdReason) is a TOCTOU: a stronger hold could have
  // rewritten deliveryHoldReason, or a `skip_weaker` supersede could have left a stronger CASE active while the
  // marker was rewritten to anchor. So the release runs under a row LOCK: re-read the Order FOR UPDATE, require the
  // marker to be UNCHANGED (still this exact anchor marker), require NO active safety/contract_world/payment case,
  // and release via a status+marker CAS. Any stronger hold → 409, never released, email never sent.
  type ReleaseOutcome =
    | { ok: true }
    | { ok: false; alreadyReleased: true }
    | { ok: false; alreadyReleased?: false; status: number; error: string };
  const outcome = await prisma.$transaction(async (tx): Promise<ReleaseOutcome> => {
    const locked = await tx.$queryRaw<Array<{ status: string; deliveryHoldReason: string | null }>>`
      SELECT "status", "deliveryHoldReason" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
    const row = locked[0];
    if (!row) return { ok: false, status: 404, error: 'Order not found' };
    // Concurrent release won the race → idempotent no-op (do NOT re-send).
    if (row.status === 'ready' || row.status === 'partial') return { ok: false, alreadyReleased: true };
    if (row.status !== 'needs_human_qa') {
      return { ok: false, status: 409, error: `Order is not on delivery hold (status=${row.status})` };
    }
    const lockedReason = row.deliveryHoldReason ?? '';
    // The marker must STILL be the identical anchor marker we validated pre-tx — a supersede to a stronger hold
    // rewrote it, and THAT is never releasable here.
    if (lockedReason !== holdReason || !lockedReason.startsWith('anchor_low_confidence:')) {
      return { ok: false, status: 409, error: `Hold changed under lock (reason=${lockedReason || 'none'})` };
    }
    // Case guard: even with an anchor marker, a stronger case may still be active (skip_weaker leaves a safety case
    // open while the marker was rewritten to anchor). Any active base case that is NOT anchor, or any active payment
    // case, blocks the release. activeKey format mirrors record-hold's activeKeyFor: `${orderId}:${scope}`.
    const baseCase = await tx.humanQaReviewCase.findUnique({ where: { activeKey: `${order.id}:base_book` } });
    if (baseCase && baseCase.status === 'open' && baseCase.kind !== 'anchor') {
      return { ok: false, status: 409, error: `A stronger ${baseCase.kind} review case is active — not releasable` };
    }
    const paymentCase = await tx.humanQaReviewCase.findUnique({ where: { activeKey: `${order.id}:payment` } });
    if (paymentCase && paymentCase.status === 'open') {
      return { ok: false, status: 409, error: 'A payment_integrity review case is active — not releasable' };
    }
    // Release as a CAS bound to the exact status + marker validated under lock (belt-and-suspenders behind FOR UPDATE).
    const released = await tx.order.updateMany({
      where: { id: order.id, status: 'needs_human_qa', deliveryHoldReason: holdReason },
      data: { status: 'ready', deliveryHoldReason: null },
    });
    if (released.count === 0) return { ok: false, status: 409, error: 'Release lost a concurrency race' };
    // Close the active ANCHOR case + suppress its unsent operator notification in the SAME release tx.
    await resolveHumanQaCaseOnReleaseInTx(tx, {
      orderId: order.id,
      scope: 'base_book',
      kinds: ['anchor'],
      actor: 'admin:anchor_release',
    });
    return { ok: true };
  });

  if (!outcome.ok) {
    if (outcome.alreadyReleased) {
      return NextResponse.json({ released: true, alreadyReleased: true, orderId, status: 'ready' });
    }
    log.warn('Anchor release refused (release-authorization guard)', { orderId, status: outcome.status, reason: outcome.error });
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  // (re-gate P0-A/P0-1) POST-COMMIT case sync — belt-and-suspenders behind the in-tx `resolveHumanQaCaseOnReleaseInTx`
  // above (which already closed the anchor case atomically with the release). Re-reads the now-`ready` Order and
  // resolves any lingering anchor case; never throws into this handler. Guarantees the case is closed on BOTH flag
  // states — the missing sync on the old readiness-ON path is exactly what left cases open forever.
  await syncHumanQaHoldCasePostCommit(prisma, order.id);

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
