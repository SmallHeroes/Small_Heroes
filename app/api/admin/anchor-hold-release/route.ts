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
import { isReadinessManifestEnabled, commitBaseBookReadiness, ReleasePreconditionError } from '@/lib/generation-pipeline/readiness-manifest';
import { resolveHumanQaCaseOnReleaseInTx } from '@/lib/human-qa/record-hold';
import { syncHumanQaHoldCasePostCommit } from '@/lib/human-qa/sync-hold-case';
import { executeAnchorReleaseCas } from '@/lib/generation-pipeline/order-authority';
import { OutboxReconciliationError } from '@/lib/generation-chunked/delivery-outbox';
import {
  OrderVisualPackageAuthorityError,
  requireConsistentProducingIdentity,
  requireProducingSnapshotBinding,
} from '@/lib/generation-pipeline/order-visual-package-authority';

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
      generationJob: { select: { pipelineCache: true } },
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

  // Producing-provenance guard, flag-INDEPENDENT: break-glass anchor release must prove the SAME total
  // invariant as every other delivery consumer — the fresh Order authority must BE the authority the
  // producing pipeline snapshot rendered under (package↔package binding of cache authority, contract stamp
  // and embedded package revision; legacy only when every producing side is genuinely legacy). This pre-tx
  // pass is the CHEAP early refusal (and captures the caller-origin claim for the readiness commit); the
  // AUTHORITATIVE re-proof runs INSIDE the release transaction below (Codex round-4 MAJOR 5) — a
  // delivery-input mutation between this evaluation and the release must hold, not ship a stale payload.
  let callerPackageRevisionDigest: string | null;
  try {
    const binding = requireProducingSnapshotBinding({
      order,
      pipelineCache: order.generationJob?.pipelineCache ?? null,
    });
    // (Codex round-5) The EXACT identity this route evaluated — bound both into the in-lock
    // re-proof below (downgrade AND upgrade directions) and into the readiness commit's caller leg.
    callerPackageRevisionDigest = binding?.packageRevisionDigest ?? null;
    if (binding !== null && !order.book.readUrl?.trim()) {
      // Package-backed payload binding: the direct send may only carry the canonical
      // snapshot readUrl — a constructed fallback URL is ambiguous provenance here.
      return NextResponse.json(
        { error: 'package-backed Order has no canonical readUrl — not releasable via anchor endpoint' },
        { status: 409 },
      );
    }
  } catch (authorityError) {
    if (!(authorityError instanceof OrderVisualPackageAuthorityError)) throw authorityError;
    log.warn('Anchor release refused — producing-snapshot binding failed', {
      orderId,
      reason: authorityError.message,
    });
    return NextResponse.json(
      { error: 'Order producing-snapshot binding invalid — not releasable via anchor endpoint' },
      { status: 409 },
    );
  }

  // (re-gate forward fix — separate AUTHORIZATION from DELIVERY) AUTHORIZATION is flag-INDEPENDENT (kept exactly as
  // built in 519b89f4); DELIVERY is flag-DISPATCHED after authorization succeeds.
  //
  // AUTHORIZATION (both flag states): under a row LOCK (FOR UPDATE) re-read the Order, require the marker to be the
  // UNCHANGED exact anchor marker, and reject any active non-anchor base case or any active payment case (409). The
  // pre-tx marker read (holdReason) is a TOCTOU: a stronger hold could have rewritten deliveryHoldReason, or a
  // `skip_weaker` supersede could have left a stronger CASE active while the marker was rewritten to anchor. Any
  // stronger hold → 409, no release, no delivery of any kind.
  //
  // COMPOSITION DECISION (brief §2.4): on flag-ON the authorization tx does NOT flip status and does NOT close the
  // case — `commitBaseBookReadiness` OWNS the `ready` transition + the Outbox enqueue + the Manifest STALENESS
  // re-eval. Flipping here would double-transition and could contradict a readiness re-park (a book that went stale
  // since render must NOT ship). The pre-existing stronger-hold hole (P0-A skip_weaker) is still closed because the
  // guard above rejects it BEFORE commitBaseBookReadiness runs. The anchor case is closed POST-COMMIT once the order
  // actually reaches `ready`. On flag-OFF the authorization tx flips status (status+marker CAS) + closes the anchor
  // case atomically, then DIRECT-sends — exactly the 519b89f4 flag-off behavior. This restores, on flag-on: the
  // package-delivery.ts:104 invariant ("flag-on: Manifest + readiness + Outbox only; never a direct email"),
  // effectively-once Outbox delivery (idempotencyKey = dedupeKey → the customer can never be emailed the book
  // twice), the OutboxReconciliationError → 409 handling, and the Manifest staleness re-eval.
  const flagOn = isReadinessManifestEnabled();

  interface ReleasedEmailPayload {
    customerEmail: string;
    customerName: string | null;
    childName: string;
    readUrl: string;
    coverImageUrl: string | null;
    audioUrl: string | null;
    pdfUrl: string | null;
  }
  type ReleaseOutcome =
    | { ok: true; email: ReleasedEmailPayload | null }
    | { ok: false; alreadyReleased: true }
    | { ok: false; alreadyReleased?: false; status: number; error: string };
  const outcome = await prisma.$transaction(async (tx): Promise<ReleaseOutcome> => {
    const locked = await tx.$queryRaw<Array<{ status: string; deliveryHoldReason: string | null }>>`
      SELECT "status", "deliveryHoldReason" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
    const row = locked[0];
    if (!row) return { ok: false, status: 404, error: 'Order not found' };
    // Concurrent release won the race → idempotent no-op (do NOT re-send / re-deliver).
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

    // DELIVERY dispatch (composition decision above):
    if (flagOn) {
      // Authorized. Do NOT flip status or close the case here — commitBaseBookReadiness (below, out of this tx) OWNS
      // the transition + Outbox enqueue + staleness re-eval. The lock releases on commit; the guard has already
      // rejected any stronger PRE-EXISTING hold, so a stale re-park (not a hole) is the only thing readiness can do.
      return { ok: true, email: null };
    }
    // flag-OFF: authorize AND release atomically — then direct-send. (Codex round-4 MAJOR 5) Authority + payload are
    // re-proved from ONE fresh snapshot read UNDER the release lock — never the pre-lock route read: the Order row
    // is FOR-UPDATE-locked above, and every delivery-input writer of the job cache / Book payload bumps
    // `Order.inputVersion` inside the barrier (so it either committed before this read or blocks on the lock). The
    // release CAS binds the exact inputVersion + fence this snapshot carried, and the email payload is captured from
    // the same snapshot — the CAS and the sent payload cannot disagree about which state was released.
    const releaseTruth = await tx.order.findUnique({
      where: { id: order.id },
      select: {
        inputVersion: true,
        deliveryFenceVersion: true,
        selectionFilename: true,
        storySourceHash: true,
        illustrationStyle: true,
        visualPackageAuthority: true,
        visualContractHash: true,
        customerEmail: true,
        customerName: true,
        childName: true,
        paymentId: true,
        paymeTransactionId: true,
        stripeSessionId: true,
        generationJob: { select: { pipelineCache: true } },
        book: {
          select: {
            readUrl: true,
            coverImageUrl: true,
            pdfUrl: true,
            audioAsset: { select: { url: true } },
            pages: {
              where: { audioUrl: { not: null } },
              orderBy: { pageNumber: 'asc' },
              take: 1,
              select: { audioUrl: true },
            },
          },
        },
      },
    });
    if (!releaseTruth?.book) {
      return { ok: false, status: 409, error: 'No rendered book to release (under release lock)' };
    }
    let lockedPackageBacked: boolean;
    try {
      // (Codex round-5 finding 2) THE total snapshot invariant under the release lock: the in-lock
      // row + producing snapshot must bind AND carry the EXACT identity this route evaluated
      // pre-lock — a pre-read package that reads legacy under the lock (downgrade), a pre-read
      // legacy that reads package (upgrade), and an A→B repoint all refuse.
      lockedPackageBacked =
        requireConsistentProducingIdentity({
          callerPackageRevisionDigest,
          order: releaseTruth,
          pipelineCache: releaseTruth.generationJob?.pipelineCache ?? null,
        }) !== null;
    } catch (authorityError) {
      if (!(authorityError instanceof OrderVisualPackageAuthorityError)) throw authorityError;
      log.warn('Anchor release refused — producing-snapshot binding failed under release lock', {
        orderId,
        reason: authorityError.message,
      });
      return {
        ok: false,
        status: 409,
        error: 'Order producing-snapshot binding invalid under release lock — not released',
      };
    }
    if (lockedPackageBacked && !releaseTruth.book.readUrl?.trim()) {
      return {
        ok: false,
        status: 409,
        error: 'package-backed Order has no canonical readUrl — not releasable via anchor endpoint',
      };
    }
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    const accessKey = releaseTruth.paymentId ?? releaseTruth.paymeTransactionId ?? releaseTruth.stripeSessionId;
    const lockedReadUrl =
      releaseTruth.book.readUrl ??
      (accessKey
        ? `${appUrl}${ROUTES.ready}?orderId=${order.id}&accessKey=${encodeURIComponent(accessKey)}`
        : `${appUrl}${ROUTES.ready}?orderId=${order.id}`);
    const released = await executeAnchorReleaseCas(tx, {
      orderId: order.id,
      expectedHoldReason: holdReason,
      expectedInputVersion: releaseTruth.inputVersion,
      expectedDeliveryFenceVersion: releaseTruth.deliveryFenceVersion,
    });
    if (released === 0) return { ok: false, status: 409, error: 'Release lost a concurrency race or a stronger hold is active' };
    // Close the active ANCHOR case + suppress its unsent operator notification in the SAME release tx.
    await resolveHumanQaCaseOnReleaseInTx(tx, {
      orderId: order.id,
      scope: 'base_book',
      kinds: ['anchor'],
      actor: 'admin:anchor_release',
    });
    return {
      ok: true,
      email: {
        customerEmail: releaseTruth.customerEmail,
        customerName: releaseTruth.customerName,
        childName: releaseTruth.childName,
        readUrl: lockedReadUrl,
        coverImageUrl: releaseTruth.book.coverImageUrl,
        audioUrl: releaseTruth.book.pages[0]?.audioUrl ?? releaseTruth.book.audioAsset?.url ?? null,
        pdfUrl: releaseTruth.book.pdfUrl,
      },
    };
  });

  if (!outcome.ok) {
    if (outcome.alreadyReleased) {
      return NextResponse.json({ released: true, alreadyReleased: true, orderId, status: 'ready' });
    }
    log.warn('Anchor release refused (release-authorization guard)', { orderId, status: outcome.status, reason: outcome.error });
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  // ── DELIVERY (flag-dispatched, AFTER authorization succeeded) ─────────────────────────────────────────────────
  if (flagOn) {
    // B6 restored: route delivery through the Manifest/readiness path (re-evaluate staleness + enqueue the Outbox),
    // NEVER a direct send. The Outbox cron sends effectively-once (idempotencyKey = dedupeKey), so the customer can
    // never be emailed the book twice. commitBaseBookReadiness OWNS the ready transition (no double-transition — the
    // authorization tx above deliberately left status untouched on flag-on).
    try {
      // (re-gate round-3 P0) Thread the AUTHORIZED-RELEASE precondition into the readiness commit: its final Order
      // write must STILL find the row held at exactly this anchor marker with no payment fence. A safety/payment hold
      // that landed in the cross-tx window (after the authorization tx released its lock, before this commit) does
      // NOT bump inputVersion, so without this it would be clobbered to `ready` + Outbox-enqueued = ship an unsafe
      // book. On mismatch commitBaseBookReadiness throws ReleasePreconditionError → typed 409 below, nothing ships.
      const result = await commitBaseBookReadiness(prisma, {
        orderId: order.id,
        // (Codex round-5) The commit DERIVES the anchor disposition from its own fresh producing
        // snapshot; requireHold is the human release of exactly this marker, and the caller-identity
        // leg holds if the frozen truth was re-pointed (any direction) after this route's read.
        requireHold: { deliveryHoldReason: holdReason },
        callerPackageRevisionDigest,
      });
      // Reconcile the anchor case with the committed outcome (resolved once `ready`; left open if it re-parked stale).
      await syncHumanQaHoldCasePostCommit(prisma, order.id);
      log.info('Anchor hold released via readiness/Outbox path', { orderId, manifestStatus: result.manifestStatus, enqueued: result.enqueued });
      return NextResponse.json({ released: result.enqueued, viaOutbox: true, manifestStatus: result.manifestStatus, orderStatus: result.orderStatus, reason: result.reason });
    } catch (e) {
      // (re-gate round-3 P0) The authorized-release precondition no longer holds — a stronger hold landed in the
      // cross-tx window (or the order was already released). NEVER shipped: typed 409, no Outbox. Match by class OR
      // name (name survives a module-registry duplication — bundling, or a test's resetModules).
      const precond = e instanceof ReleasePreconditionError
        ? e
        : ((e as { name?: string })?.name === 'ReleasePreconditionError' ? (e as ReleasePreconditionError) : null);
      if (precond) {
        log.warn('Anchor release aborted — hold changed under readiness commit (stronger hold landed / already released)', {
          orderId, expected: precond.expectedHoldReason, actual: precond.actual,
        });
        return NextResponse.json(
          { error: 'Hold changed before delivery — not released (a stronger hold landed, or it was already released)', expected: precond.expectedHoldReason, actual: precond.actual },
          { status: 409 },
        );
      }
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

  // flag-OFF: the authorization tx already flipped the Order to `ready` + closed the anchor case. Reconcile
  // (idempotent) then DIRECT-send the withheld book-ready email exactly once — the status+marker CAS above guarantees
  // only ONE caller reaches here (a concurrent second caller matches 0 rows → 409; a sequential second call sees
  // `ready` at the pre-read → alreadyReleased → no re-send). (Codex round-4 MAJOR 5) The payload is the one captured
  // from the IN-TX release snapshot — the exact inputVersion/fence state the release CAS bound — never the stale
  // pre-lock route read.
  await syncHumanQaHoldCasePostCommit(prisma, order.id);

  const email = outcome.email;
  let emailSent = false;
  if (email) {
    try {
      await sendBookReadyEmail({
        to: email.customerEmail,
        customerName: email.customerName ?? email.childName,
        childName: email.childName,
        readUrl: email.readUrl,
        ...(listenUrlFromReadUrl(email.readUrl, order.id) ? { listenUrl: listenUrlFromReadUrl(email.readUrl, order.id) } : {}),
        ...(email.coverImageUrl ? { coverImageUrl: email.coverImageUrl } : {}),
        audioUrl: email.audioUrl ?? undefined,
        pdfUrl: email.pdfUrl ?? undefined,
      });
      emailSent = true;
      log.info('Delivery hold released + book-ready email sent', { orderId, was: order.deliveryHoldReason });
    } catch (e) {
      // Non-fatal: the order is already released/viewable; the email can be re-sent manually.
      log.error('Release email failed (order already released)', e, { orderId });
    }
  }

  return NextResponse.json({ released: true, orderId, status: 'ready', emailSent });
}
