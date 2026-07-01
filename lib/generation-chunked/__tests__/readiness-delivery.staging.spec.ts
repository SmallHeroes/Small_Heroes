import { describe, it, expect } from 'vitest';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';
import type { BookReadyPayload } from '@/lib/generation-chunked/delivery-outbox';
import {
  seedPassingBook,
  cleanupFixture,
  fixtureInspect,
  STAGING_APP_BASE_URL,
} from './staging-book-fixture';

/**
 * #7-b live-DB proofs — the delivery decision on the REAL staging DB (READINESS_MANIFEST_ENABLED=true):
 *
 *   PASS         — a sellable book with passing integrity + quality evidence → commitBaseBookReadiness writes an
 *                  immutable PASSED manifest, enqueues EXACTLY ONE Outbox row, and the drain (real send-time CAS +
 *                  a counting send) sends EXACTLY ONE email; a second drain sends nothing (idempotent). Order ready.
 *   QUALITY-FAIL — a budget-spent `failed` quality verdict → BLOCKED manifest + a quality_failed ExceptionCase
 *                  (refund_pending) in the SAME tx, and NO Outbox row (no email path).
 *   CONCURRENCY  — after a PASS+enqueue, a delivery-input bump through the real write barrier moves Order.inputVersion
 *                  / stales readiness; the send-time CAS then refuses the row (delivery_blocked) → NO false send.
 *
 * These exercise the real Postgres transactions (immutable manifest INSERT, in-tx enqueue, the atomic send-time CAS)
 * — NOT mocks. Only the image bytes are faked, via an injected `inspect` that returns a fixed hash matching the
 * seeded evidence, so no render/spend happens. Each test self-cleans its throwaway order. Runs ONLY on isolated
 * staging behind the env-separation guard + an explicit opt-in; skipped by default so `npm run check` stays green.
 *
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_7B_PROOFS=true \
 *     DATABASE_URL='postgresql://...pooler...:6543/postgres?pgbouncer=true' \
 *     npx vitest run lib/generation-chunked/__tests__/readiness-delivery.staging.spec.ts
 */
const RUN = process.env.RUN_7B_PROOFS === 'true' && canAccessStagingQa();
const NONCE = process.env.RUN_OUTBOX_DB_TEST_NONCE ?? 'a';
const uid = (tag: string) => `sevenb-${tag}-${NONCE}-${Date.now()}`;

/** Set READINESS_MANIFEST_ENABLED=true for the test body, returning a restore fn (self-contained even if unset). */
function withReadinessFlag(): () => void {
  const prev = process.env.READINESS_MANIFEST_ENABLED;
  process.env.READINESS_MANIFEST_ENABLED = 'true';
  return () => {
    if (prev === undefined) delete process.env.READINESS_MANIFEST_ENABLED;
    else process.env.READINESS_MANIFEST_ENABLED = prev;
  };
}

describe.skipIf(!RUN)('#7-b delivery decision — staging real DB (flag on)', () => {
  it('PASS: sellable order → passed manifest + EXACTLY ONE outbox→email + Order ready', async () => {
    assertEnvSeparation(); // refuses to proceed if any prod resource is configured
    const orderId = uid('pass');
    const restoreFlag = withReadinessFlag();
    const { prisma } = await import('@/lib/prisma'); // lazy import: skipped runs never connect
    const { commitBaseBookReadiness, casClaimSendSlot } = await import('@/lib/generation-pipeline/readiness-manifest');
    const { drainOutbox } = await import('@/lib/generation-chunked/delivery-outbox');
    try {
      await seedPassingBook(prisma, { orderId });

      const commit = await commitBaseBookReadiness(
        prisma,
        { orderId, anchorAllowsDelivery: true, anchorOrderStatus: 'ready', anchorReason: null },
        { inspect: fixtureInspect(), appBaseUrl: STAGING_APP_BASE_URL },
      );
      expect(commit.manifestStatus).toBe('passed');
      expect(commit.enqueued).toBe(true);
      expect(commit.orderStatus).toBe('ready');

      // Immutable manifest + mutable pointer both PASSED and consistent.
      const manifest = await prisma.bookReadinessManifest.findFirst({ where: { orderId }, orderBy: { revision: 'desc' } });
      expect(manifest?.status).toBe('passed');
      const readiness = await prisma.bookReadiness.findUnique({ where: { orderId_scope: { orderId, scope: 'base_book' } } });
      expect(readiness?.status).toBe('passed');
      expect(readiness?.currentManifestId).toBe(manifest?.id);

      // Exactly one Outbox row, still awaiting send.
      const enqueued = await prisma.deliveryOutbox.findMany({ where: { orderId } });
      expect(enqueued.length).toBe(1);
      expect(enqueued[0].status).toBe('scheduled');

      // Drain with the REAL send-time CAS + a counting send → exactly one email.
      const sends: string[] = [];
      const send = async (_payload: BookReadyPayload, key: string) => { sends.push(key); return { providerMessageId: `stub-${sends.length}` }; };
      const deps = { cas: (row: never, token: number, lease: Date, now: Date) => casClaimSendSlot(prisma, row, token, lease, now), send } as never;

      const first = await drainOutbox(prisma, { limit: 1 }, deps);
      expect(first.sent).toBe(1);
      expect(sends.length).toBe(1);

      // A second drain finds nothing to claim (the row is terminal 'sent') → still exactly one email total.
      const second = await drainOutbox(prisma, { limit: 1 }, deps);
      expect(second.claimed).toBe(0);
      expect(sends.length).toBe(1);

      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
      expect(order?.status).toBe('ready');
      const sentRow = await prisma.deliveryOutbox.findFirst({ where: { orderId } });
      expect(sentRow?.status).toBe('sent');
      expect(sentRow?.sendAttempted).toBe(true);
    } finally {
      await cleanupFixture(prisma, orderId);
      restoreFlag();
    }
  }, 60_000);

  it('QUALITY-FAIL: a budget-spent failed verdict → BLOCKED manifest + quality_failed ExceptionCase + NO email', async () => {
    assertEnvSeparation();
    const orderId = uid('qfail');
    const restoreFlag = withReadinessFlag();
    const { prisma } = await import('@/lib/prisma');
    const { commitBaseBookReadiness } = await import('@/lib/generation-pipeline/readiness-manifest');
    const { QUALITY_REGEN_BUDGET } = await import('@/lib/generation-pipeline/quality-evidence');
    try {
      // A deterministic FAIL whose durable budget is spent → the quality gate returns 'failed' (terminal), not unknown.
      await seedPassingBook(prisma, { orderId, qualityVerdict: 'failed', qualityRegenCount: QUALITY_REGEN_BUDGET });

      const commit = await commitBaseBookReadiness(
        prisma,
        { orderId, anchorAllowsDelivery: true, anchorOrderStatus: 'ready', anchorReason: null },
        { inspect: fixtureInspect(), appBaseUrl: STAGING_APP_BASE_URL },
      );
      expect(commit.manifestStatus).toBe('blocked');
      expect(commit.enqueued).toBe(false);

      const manifest = await prisma.bookReadinessManifest.findFirst({ where: { orderId }, orderBy: { revision: 'desc' } });
      expect(manifest?.status).toBe('blocked');

      // A quality_failed ExceptionCase opened atomically with the block, routed straight to refund_pending.
      const ex = await prisma.exceptionCase.findFirst({ where: { orderId, kind: 'quality_failed' } });
      expect(ex, 'a quality_failed ExceptionCase must be opened').toBeTruthy();
      expect(ex?.status).toBe('refund_pending');

      // Fail-closed: NO delivery was enqueued (no email path on any blocked commit).
      const outbox = await prisma.deliveryOutbox.findMany({ where: { orderId } });
      expect(outbox.length).toBe(0);

      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
      expect(order?.status).toBe('needs_human_qa');
    } finally {
      await cleanupFixture(prisma, orderId);
      restoreFlag();
    }
  }, 60_000);

  it('CONCURRENCY: an inputVersion bump mid-flight makes the send-time CAS refuse the stale book (no false send)', async () => {
    assertEnvSeparation();
    const orderId = uid('conc');
    const restoreFlag = withReadinessFlag();
    const { prisma } = await import('@/lib/prisma');
    const { commitBaseBookReadiness, casClaimSendSlot, withDeliveryInputMutation } = await import('@/lib/generation-pipeline/readiness-manifest');
    const { drainOutbox } = await import('@/lib/generation-chunked/delivery-outbox');
    try {
      await seedPassingBook(prisma, { orderId });
      const commit = await commitBaseBookReadiness(
        prisma,
        { orderId, anchorAllowsDelivery: true, anchorOrderStatus: 'ready', anchorReason: null },
        { inspect: fixtureInspect(), appBaseUrl: STAGING_APP_BASE_URL },
      );
      expect(commit.manifestStatus).toBe('passed');
      expect(commit.enqueued).toBe(true);

      // Mid-flight: a delivery-input change through the REAL write barrier bumps Order.inputVersion, stales readiness,
      // and moves the order off 'ready' — exactly the race the send-time CAS defends against.
      const mutated = await withDeliveryInputMutation(
        prisma,
        { orderId, reason: 'package_payload_changed' },
        (tx) => tx.generatedBook.update({ where: { orderId }, data: { pdfUrl: 'https://changed.invalid/x.pdf' } }),
      );
      expect(mutated.inputVersion).toBe(1);

      // Drain with the REAL CAS + a counting send: the CAS finds Order not-ready / inputVersion moved → delivery_blocked.
      const sends: string[] = [];
      const send = async (_payload: BookReadyPayload, key: string) => { sends.push(key); return { providerMessageId: 'stub' }; };
      const deps = { cas: (row: never, token: number, lease: Date, now: Date) => casClaimSendSlot(prisma, row, token, lease, now), send } as never;
      const summary = await drainOutbox(prisma, { limit: 1 }, deps);

      expect(sends.length, 'the stale book must NOT be sent').toBe(0);
      expect(summary.delivery_blocked).toBe(1);
      const row = await prisma.deliveryOutbox.findFirst({ where: { orderId } });
      expect(row?.status).toBe('delivery_blocked');
      expect(row?.sendAttempted).toBe(false); // no provider send was ever attempted → still rebind-eligible on re-commit
    } finally {
      await cleanupFixture(prisma, orderId);
      restoreFlag();
    }
  }, 60_000);
});
