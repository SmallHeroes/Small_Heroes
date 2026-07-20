import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';

/**
 * (Human-QA Slices 3+4 — foundation) REAL-Postgres proof of the shared operator-action contract: locking,
 * exactly-once idempotency, the four §2.3 preconditions, and the audit snapshot. No renders, no admin HTTP — it
 * drives `runOperatorAction` directly with a counting no-op body. Env-gated + inert in the normal suite (and
 * always on prod), like atomic-receipt-pooler.staging.spec.ts / hold-redrive-fence.staging.spec.ts.
 *
 * Requires the 20260722_human_qa_operator_action migration applied to the target DB.
 *
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_OPERATOR_ACTION_PROOF=true READINESS_MANIFEST_ENABLED=true \
 *     GENERATION_SECRET=… NEXT_PUBLIC_APP_URL=https://preview.vercel.app SUPABASE_URL=https://<staging>.supabase.co \
 *     SUPABASE_SERVICE_ROLE_KEY=… OPENAI_API_KEY=… REPLICATE_API_TOKEN=… \
 *     DATABASE_URL='postgresql://…session-pooler…:5432/postgres' \
 *     npx vitest run lib/human-qa/__tests__/operator-action.staging.spec.ts
 */
const RUN = process.env.RUN_OPERATOR_ACTION_PROOF === 'true' && canAccessStagingQa();
const shaOf = (u: string) => createHash('sha256').update(u).digest('hex');

describe.skipIf(!RUN)('(Human-QA 3+4) operator-action shared contract — real Postgres', () => {
  it('locks, is idempotent under the Idempotency-Key, enforces the four preconditions, and audits', async () => {
    assertEnvSeparation();
    const { prisma } = await import('@/lib/prisma');
    const { runOperatorAction, OperatorActionPreconditionError, operatorActionOperationKey } = await import('@/lib/human-qa/operator-action');

    const nonce = `${process.env.OPERATOR_ACTION_NONCE ?? 'a'}-${Date.now()}`;
    const idOk = `opact-ok-${nonce}`;
    const idNoCase = `opact-nocase-${nonce}`;
    const idPay = `opact-pay-${nonce}`;
    const idManual = `opact-manual-${nonce}`;
    const MARKER = 'safety_hold:page:3';
    const createdOrderIds: string[] = [];

    const seedOrder = async (id: string, over: Record<string, unknown> = {}) => {
      const row = await prisma.order.create({ data: {
        id, status: 'needs_human_qa', customerEmail: `${id}@example.invalid`, customerName: 'T', childName: 'Kid',
        topic: 'opact', basePrice: 0, addonsPrice: 0, totalPrice: 0, inputVersion: 4, deliveryFenceVersion: 2,
        deliveryHoldReason: MARKER, manualReviewRequired: false, ...over,
      } });
      createdOrderIds.push(id);
      return row;
    };
    const seedCase = async (orderId: string, scope: string, kind: string, revision = 1) =>
      prisma.humanQaReviewCase.create({ data: {
        activeKey: `${orderId}:${scope}`, orderId, scope, revision, kind: kind as never, status: 'open',
        holdFingerprint: shaOf(`${orderId}:${scope}:${revision}`), rawReason: MARKER, humanReason: 'held for QA', inputVersion: 4,
      } });

    let bodyRuns = 0;
    const noopBody = async () => { bodyRuns += 1; return { status: 'succeeded' as const, outcome: { did: 'noop', at: bodyRuns } }; };

    try {
      // ── order OK: held + an open base_book case, no payment case ──────────────────────────────────
      await seedOrder(idOk);
      const caseOk = await seedCase(idOk, 'base_book', 'safety', 1);

      // (A) first action → runs the body once, records ONE audit row snapshotting the observed state
      const r1 = await runOperatorAction(prisma, {
        orderId: idOk, idempotencyKey: 'key-1', kind: 'rerender', actor: 'operator-x', expectedMarker: MARKER,
        note: 'the child is well away from the railing', targetArtifacts: ['page:3'],
      }, noopBody);
      expect(r1.status).toBe('succeeded');
      const rows1 = await prisma.humanQaOperatorAction.findMany({ where: { orderId: idOk } });
      expect(rows1.length, 'exactly one audit row').toBe(1);
      expect(rows1[0]).toMatchObject({
        kind: 'rerender', status: 'succeeded', actor: 'operator-x', caseId: caseOk.id, caseRevision: 1,
        note: 'the child is well away from the railing', observedMarker: MARKER, observedFence: 2, observedInputVersion: 4,
      });
      expect(rows1[0].targetArtifacts).toEqual(['page:3']);

      // (B) IDEMPOTENT replay: same Idempotency-Key → body does NOT run again, still ONE row, same outcome
      const r2 = await runOperatorAction(prisma, {
        orderId: idOk, idempotencyKey: 'key-1', kind: 'rerender', actor: 'operator-x', expectedMarker: MARKER,
        note: 'the child is well away from the railing', targetArtifacts: ['page:3'],
      }, noopBody);
      expect(bodyRuns, 'body ran exactly once across two identical submits').toBe(1);
      expect(r2.actionId, 'the replay returns the SAME recorded action id').toBe(r1.actionId);
      expect(await prisma.humanQaOperatorAction.count({ where: { orderId: idOk } }), 'no second audit row').toBe(1);

      // (C) marker_changed: a re-hold moved the marker under the operator → throws, records NOTHING new
      await prisma.order.update({ where: { id: idOk }, data: { deliveryHoldReason: 'safety_hold:page:9' } });
      await expect(runOperatorAction(prisma, {
        orderId: idOk, idempotencyKey: 'key-stale', kind: 'rerender', actor: 'op', expectedMarker: MARKER,
      }, noopBody)).rejects.toBeInstanceOf(OperatorActionPreconditionError);
      expect(await prisma.humanQaOperatorAction.count({ where: { orderId: idOk } }), 'a refused action records nothing').toBe(1);

      // (D) not_held: an order that is not needs_human_qa can never be acted on
      await prisma.order.update({ where: { id: idOk }, data: { status: 'ready' } });
      await expect(runOperatorAction(prisma, {
        orderId: idOk, idempotencyKey: 'key-notheld', kind: 'release', actor: 'op', expectedMarker: 'safety_hold:page:9',
        targetArtifacts: ['page:9'],
      }, noopBody)).rejects.toMatchObject({ reason: 'not_held' });

      // ── no_active_case: held order with NO review case ───────────────────────────────────────────
      await seedOrder(idNoCase);
      await expect(runOperatorAction(prisma, {
        orderId: idNoCase, idempotencyKey: 'k', kind: 'rerender', actor: 'op', expectedMarker: MARKER,
      }, noopBody)).rejects.toMatchObject({ reason: 'no_active_case' });

      // ── payment_case_active: base_book case present AND an active payment case → blocked ─────────
      await seedOrder(idPay);
      await seedCase(idPay, 'base_book', 'safety', 1);
      await seedCase(idPay, 'payment', 'payment_integrity', 1);
      await expect(runOperatorAction(prisma, {
        orderId: idPay, idempotencyKey: 'k', kind: 'release', actor: 'op', expectedMarker: MARKER,
        targetArtifacts: ['page:3'],
      }, noopBody)).rejects.toMatchObject({ reason: 'payment_case_active' });
      expect(await prisma.humanQaOperatorAction.count({ where: { orderId: idPay } })).toBe(0);

      // ── payment_case_active: manualReviewRequired=true is authoritative even before a payment case exists ────────
      await seedOrder(idManual, { manualReviewRequired: true });
      await seedCase(idManual, 'base_book', 'safety', 1);
      const manualKey = operatorActionOperationKey('rerender', idManual, 'key-manual');
      await expect(runOperatorAction(prisma, {
        orderId: idManual, idempotencyKey: 'key-manual', kind: 'rerender', actor: 'op', expectedMarker: MARKER,
        targetArtifacts: ['page:3'],
      }, noopBody)).rejects.toMatchObject({ reason: 'payment_case_active' });
      expect(await prisma.humanQaOperatorAction.count({ where: { orderId: idManual } }), 'manual payment fence records no audit row').toBe(0);
      expect(await prisma.atomicOperationReceipt.count({ where: { operationKey: manualKey } }), 'precondition failure consumes no receipt').toBe(0);

      // Same key succeeds after the authoritative flag is refreshed, proving the failed precondition did not poison it.
      await prisma.order.update({ where: { id: idManual }, data: { manualReviewRequired: false } });
      const runsBeforeManualRetry = bodyRuns;
      const manualRetry = await runOperatorAction(prisma, {
        orderId: idManual, idempotencyKey: 'key-manual', kind: 'rerender', actor: 'op', expectedMarker: MARKER,
        targetArtifacts: ['page:3'],
      }, noopBody);
      expect(manualRetry.status).toBe('succeeded');
      expect(bodyRuns, 'same idempotency key succeeds after state refresh').toBe(runsBeforeManualRetry + 1);
      expect(await prisma.humanQaOperatorAction.count({ where: { orderId: idManual } })).toBe(1);
      expect(await prisma.atomicOperationReceipt.count({ where: { operationKey: manualKey } }), 'successful retry records one receipt').toBe(1);

      console.log(`[OPERATOR-ACTION] OK — 2 audit rows, manual payment fence blocks without consuming a receipt, same key succeeds after refresh, all preconditions enforced.`);
    } finally {
      for (const id of createdOrderIds) {
        await prisma.atomicOperationReceipt.deleteMany({ where: { orderId: id } }).catch(() => {});
        await prisma.humanQaOperatorAction.deleteMany({ where: { orderId: id } }).catch(() => {});
        await prisma.humanQaReviewCase.deleteMany({ where: { orderId: id } }).catch(() => {});
        await prisma.order.delete({ where: { id } }).catch(() => {});
      }
    }
  }, 120_000);
});
