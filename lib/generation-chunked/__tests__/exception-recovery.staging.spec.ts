import { describe, it, expect, vi } from 'vitest';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';
import { seedPassingBook, cleanupFixture, fixtureInspect } from './staging-book-fixture';

/**
 * #7-b live-DB proofs — the failure→exception and quality-recovery paths on the REAL staging DB
 * (READINESS_MANIFEST_ENABLED=true):
 *
 *   FAILURE→EXCEPTION — a RECOVERABLE generation failure (infra_transient) → the real processExceptionCase
 *                       RE-DRIVES (retry_scheduled); a TERMINAL failure kind (quality_failed) → the real
 *                       openExceptionCase opens the case straight in refund_pending (no re-drive, no email).
 *   RECOVERY         — the regen-rescue on the real DB: reQaUnknownQualityEvidence routes an admissible FAILED
 *                       artifact to the rescue (#6-fix-4 P1), then reserveMarkAndClearRegen atomically
 *                       reserves→marks regen-pending→clears the asset, and the DURABLE budget caps replacements at
 *                       QUALITY_REGEN_BUDGET (2) — the 3rd reserve is declined (→ recommit refunds).
 *
 * Real Postgres transactions (the write-barrier clear, the conditional regen reserve, the exception state machine)
 * — NOT mocks. Only external I/O the proof doesn't exercise (the actual email/refund providers, image bytes) is
 * stubbed. To keep the blast radius to ONE throwaway order on shared staging, the routing is proven via the real
 * per-order producers (openExceptionCase / processExceptionCase) rather than the global syncTerminalExceptionCases
 * backfill (a bounded batch wrapper over the same producers, covered by unit specs). Each test self-cleans.
 * Runs ONLY on isolated staging behind the env-separation guard + an explicit opt-in; skipped by default.
 *
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_7B_PROOFS=true \
 *     DATABASE_URL='postgresql://...pooler...:6543/postgres?pgbouncer=true' \
 *     npx vitest run lib/generation-chunked/__tests__/exception-recovery.staging.spec.ts
 */
const RUN = process.env.RUN_7B_PROOFS === 'true' && canAccessStagingQa();
const NONCE = process.env.RUN_OUTBOX_DB_TEST_NONCE ?? 'a';
const uid = (tag: string) => `sevenb-${tag}-${NONCE}-${Date.now()}`;

function withReadinessFlag(): () => void {
  const prev = process.env.READINESS_MANIFEST_ENABLED;
  process.env.READINESS_MANIFEST_ENABLED = 'true';
  return () => {
    if (prev === undefined) delete process.env.READINESS_MANIFEST_ENABLED;
    else process.env.READINESS_MANIFEST_ENABLED = prev;
  };
}

/** Minimal failed order + failed GenerationJob (no book needed) for the failure→exception arms. */
async function seedFailedOrder(prisma: import('@prisma/client').PrismaClient, orderId: string, retryable: boolean) {
  await prisma.order.create({
    data: {
      id: orderId, status: 'failed', inputVersion: 0, fulfillmentVersion: 1,
      customerEmail: 'sevenb-exc@example.invalid', customerName: 'Fixture Parent', childName: 'Fixture Child',
      topic: '7b-exc', basePrice: 0, addonsPrice: 0, totalPrice: 0,
    },
  });
  await prisma.generationJob.create({
    data: { orderId, status: 'failed', currentStage: 'failed', retryable, lastError: 'seeded_generation_failure', failedAt: new Date() },
  });
}

describe.skipIf(!RUN)('#7-b failure→exception + quality-recovery — staging real DB (flag on)', () => {
  it('FAILURE→EXCEPTION (recoverable): a retryable generation failure → processExceptionCase RE-DRIVES (retry_scheduled)', async () => {
    assertEnvSeparation();
    const orderId = uid('recov');
    const restoreFlag = withReadinessFlag();
    const { prisma } = await import('@/lib/prisma');
    const { openExceptionCase } = await import('@/lib/generation-chunked/exception-case');
    const { processExceptionCase } = await import('@/lib/generation-chunked/exception-processor');
    try {
      await seedFailedOrder(prisma, orderId, /* retryable */ true);
      // The producer opens a recoverable infra_transient case (retry_scheduled) bound to the generation source.
      const opened = await openExceptionCase(prisma, {
        orderId, kind: 'infra_transient', reason: 'generation_failed',
        sourceRef: `generation:${orderId}:${new Date().toISOString()}`,
      });
      expect(opened.kind).toBe('infra_transient');
      expect(opened.status).toBe('retry_scheduled');

      // The real processor: order is 'failed' (not ready/partial/generating) → it re-drives generation.
      const redriveGeneration = vi.fn(async () => ({ started: true }));
      const recommitReadiness = vi.fn(); // must NOT be reached — a re-drive returns first
      const outcome = await processExceptionCase(prisma, opened, { redriveGeneration, recommitReadiness });

      expect(outcome).toBe('retry_scheduled');
      expect(redriveGeneration).toHaveBeenCalledWith(orderId);
      expect(recommitReadiness).not.toHaveBeenCalled();
      const outbox = await prisma.deliveryOutbox.findMany({ where: { orderId } });
      expect(outbox.length).toBe(0); // recovery never sends
    } finally {
      await cleanupFixture(prisma, orderId);
      restoreFlag();
    }
  }, 60_000);

  it('FAILURE→EXCEPTION (terminal): a terminal failure kind opens straight in refund_pending (no re-drive, no email)', async () => {
    assertEnvSeparation();
    const orderId = uid('term');
    const restoreFlag = withReadinessFlag();
    const { prisma } = await import('@/lib/prisma');
    const { openExceptionCase } = await import('@/lib/generation-chunked/exception-case');
    try {
      await seedFailedOrder(prisma, orderId, /* retryable */ false);
      // A deterministic terminal kind → the real disposition routes it directly to refund_pending (no recovery loop).
      const opened = await openExceptionCase(prisma, { orderId, kind: 'quality_failed', reason: 'quality_failed:page:1' });
      expect(opened.kind).toBe('quality_failed');
      expect(opened.status).toBe('refund_pending');
      const outbox = await prisma.deliveryOutbox.findMany({ where: { orderId } });
      expect(outbox.length).toBe(0);
    } finally {
      await cleanupFixture(prisma, orderId);
      restoreFlag();
    }
  }, 60_000);

  it('RECOVERY: reQa routes an admissible FAILED artifact, then reserve→mark→clear caps replacements at the budget', async () => {
    assertEnvSeparation();
    const orderId = uid('regen');
    const restoreFlag = withReadinessFlag();
    const { prisma } = await import('@/lib/prisma');
    const { reQaUnknownQualityEvidence, loadRegenPendingArtifacts } = await import('@/lib/generation-pipeline/quality-recovery');
    const { reserveMarkAndClearRegen } = await import('@/lib/generation-chunked/clear-page-images-for-regen');
    const { QUALITY_REGEN_BUDGET, coverArtifactKey, pageArtifactKey } = await import('@/lib/generation-pipeline/quality-evidence');
    try {
      // page:1 seeded FAILED at regenCount 0 (cover forced to PASS so only page:1 routes to the rescue).
      await seedPassingBook(prisma, { orderId, qualityVerdict: 'failed', qualityRegenCount: 0 });
      await prisma.qualityEvidence.update({
        where: { orderId_artifactKey: { orderId, artifactKey: coverArtifactKey() } },
        data: { verdict: 'passed' },
      });

      // (#6-fix-4 P1 #1 on the real DB) An admissible FAILED verdict matching the current bytes routes to the
      // rescue (nowFailed) WITHOUT a re-QA — it must not be silently skipped as "done".
      const recovery = await reQaUnknownQualityEvidence(prisma, orderId, { inspect: fixtureInspect() });
      expect(recovery.nowFailed).toEqual([{ artifactKey: pageArtifactKey(1), regenCount: 0 }]);

      // Reserve #1 → grants, marks regen-pending, clears the page image (regenCount 0→1).
      const r1 = await reserveMarkAndClearRegen(prisma, { orderId, artifactKey: pageArtifactKey(1) });
      expect(r1.granted).toBe(true);
      const afterClear = await prisma.imageAsset.findMany({ where: { page: { book: { orderId }, pageNumber: 1 } } });
      expect(afterClear.length, 'the delivered page image is cleared for re-render').toBe(0);
      expect(await loadRegenPendingArtifacts(prisma, orderId)).toContain(pageArtifactKey(1));
      const ev1 = await prisma.qualityEvidence.findUnique({ where: { orderId_artifactKey: { orderId, artifactKey: pageArtifactKey(1) } } });
      expect(ev1?.regenCount).toBe(1);

      // Reserve #2 → grants (regenCount 1→2).
      const r2 = await reserveMarkAndClearRegen(prisma, { orderId, artifactKey: pageArtifactKey(1) });
      expect(r2.granted).toBe(true);
      const ev2 = await prisma.qualityEvidence.findUnique({ where: { orderId_artifactKey: { orderId, artifactKey: pageArtifactKey(1) } } });
      expect(ev2?.regenCount).toBe(QUALITY_REGEN_BUDGET);

      // Reserve #3 → budget spent → DECLINED (not cleared) → the artifact stays failed-terminal → recommit refunds.
      const r3 = await reserveMarkAndClearRegen(prisma, { orderId, artifactKey: pageArtifactKey(1) });
      expect(r3.granted).toBe(false);
      const ev3 = await prisma.qualityEvidence.findUnique({ where: { orderId_artifactKey: { orderId, artifactKey: pageArtifactKey(1) } } });
      expect(ev3?.regenCount).toBe(QUALITY_REGEN_BUDGET); // never exceeds the budget
    } finally {
      await cleanupFixture(prisma, orderId);
      restoreFlag();
    }
  }, 60_000);
});
