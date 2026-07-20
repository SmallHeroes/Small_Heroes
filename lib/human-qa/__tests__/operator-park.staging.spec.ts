import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';

/**
 * (Human-QA Slice 4 — PARK) REAL-Postgres proof of the five §2.7 guarantees for operator PARK, driven through the
 * shared contract + the park body. Env-gated + inert (like the sibling staging specs). Requires the
 * 20260722_human_qa_operator_action migration.
 *
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_PARK_PROOF=true READINESS_MANIFEST_ENABLED=true \
 *     GENERATION_SECRET=… NEXT_PUBLIC_APP_URL=https://preview.vercel.app SUPABASE_URL=https://<staging>.supabase.co \
 *     SUPABASE_SERVICE_ROLE_KEY=… OPENAI_API_KEY=… REPLICATE_API_TOKEN=… \
 *     DATABASE_URL='postgresql://…session-pooler…:5432/postgres' \
 *     npx vitest run lib/human-qa/__tests__/operator-park.staging.spec.ts
 */
const RUN = process.env.RUN_PARK_PROOF === 'true' && canAccessStagingQa();
const shaOf = (u: string) => createHash('sha256').update(u).digest('hex');

describe.skipIf(!RUN)('(Human-QA 4) operator PARK — real Postgres, the five §2.7 guarantees', () => {
  it('escalates a non-terminal hold to terminal, keeps needs_human_qa, no outbox, case stays open, idempotent; safety hold is left terminal', async () => {
    assertEnvSeparation();
    const { prisma } = await import('@/lib/prisma');
    const { runOperatorAction } = await import('@/lib/human-qa/operator-action');
    const { parkOperatorActionBody } = await import('@/lib/human-qa/operator-park');

    const nonce = `${process.env.PARK_NONCE ?? 'a'}-${Date.now()}`;
    const idAnchor = `park-anchor-${nonce}`;
    const idSafety = `park-safety-${nonce}`;
    const ANCHOR = 'anchor_low_confidence:soft_band';
    const SAFETY = 'safety_hold:hazard:page:3:child_on_railing';

    const seedOrder = (id: string, marker: string) =>
      prisma.order.create({ data: {
        id, status: 'needs_human_qa', customerEmail: `${id}@example.invalid`, customerName: 'T', childName: 'Kid',
        topic: 'park', basePrice: 0, addonsPrice: 0, totalPrice: 0, inputVersion: 3, deliveryFenceVersion: 1,
        deliveryHoldReason: marker, manualReviewRequired: false,
      } });
    const seedCase = (orderId: string, kind: string, marker: string) =>
      prisma.humanQaReviewCase.create({ data: {
        activeKey: `${orderId}:base_book`, orderId, scope: 'base_book', revision: 1, kind: kind as never, status: 'open',
        holdFingerprint: shaOf(`${orderId}:${marker}`), rawReason: marker, humanReason: 'held', inputVersion: 3,
      } });
    const orderOf = (id: string) => prisma.order.findUnique({ where: { id }, select: { status: true, deliveryHoldReason: true, deliveryFenceVersion: true } });
    const caseStatus = (id: string) => prisma.humanQaReviewCase.findUnique({ where: { activeKey: `${id}:base_book` }, select: { status: true } });

    const ids = [idAnchor, idSafety];
    let bodyRuns = 0;
    const body = (ctx: Parameters<typeof parkOperatorActionBody>[0]) => { bodyRuns += 1; return parkOperatorActionBody(ctx); };

    try {
      // ── ANCHOR hold (rank-1, non-terminal) → PARK escalates to a terminal manual_resolution_hold: ──────────────
      await seedOrder(idAnchor, ANCHOR);
      await seedCase(idAnchor, 'anchor', ANCHOR);

      const r1 = await runOperatorAction(prisma, {
        orderId: idAnchor, idempotencyKey: 'k1', kind: 'park', actor: 'admin:park', expectedMarker: ANCHOR,
        note: 'unresolvable anchor — hand off to manual resolution',
      }, body);
      expect(r1.status).toBe('succeeded');
      expect(r1.outcome).toMatchObject({ parked: true, escalated: true });

      const a1 = (await orderOf(idAnchor))!;
      expect(a1.status, 'still needs_human_qa (customer stays under_review)').toBe('needs_human_qa');
      expect(a1.deliveryHoldReason, 'marker escalated to a TERMINAL manual_resolution_hold:').toBe(`manual_resolution_hold:${ANCHOR}`);
      expect(a1.deliveryFenceVersion, 'the hold write bumped the fence').toBe(2);
      expect((await caseStatus(idAnchor))?.status, 'the review case is left OPEN (visible unresolved record)').toBe('open');
      expect(await prisma.deliveryOutbox.count({ where: { orderId: idAnchor } }), 'no delivery outbox row').toBe(0);
      const rows = await prisma.humanQaOperatorAction.findMany({ where: { orderId: idAnchor } });
      expect(rows.length, 'one park audit row').toBe(1);
      expect(rows[0]).toMatchObject({ kind: 'park', status: 'succeeded', observedMarker: ANCHOR });

      // ── IDEMPOTENT: the same Idempotency-Key replays; the body does NOT run again, no second escalation ─────────
      // (the marker changed to manual_resolution_hold:…, so the fenced retry replays the recorded outcome)
      const r2 = await runOperatorAction(prisma, {
        orderId: idAnchor, idempotencyKey: 'k1', kind: 'park', actor: 'admin:park', expectedMarker: ANCHOR,
        note: 'unresolvable anchor — hand off to manual resolution',
      }, body);
      expect(bodyRuns, 'park body ran exactly once across two identical submits').toBe(1);
      expect(r2.actionId).toBe(r1.actionId);
      expect((await orderOf(idAnchor))!.deliveryFenceVersion, 'no second fence bump').toBe(2);
      expect(await prisma.humanQaOperatorAction.count({ where: { orderId: idAnchor } }), 'no second audit row').toBe(1);

      // ── SAFETY hold (already terminal) → PARK records the decision but does NOT touch the stronger marker ───────
      await seedOrder(idSafety, SAFETY);
      await seedCase(idSafety, 'safety', SAFETY);
      const rs = await runOperatorAction(prisma, {
        orderId: idSafety, idempotencyKey: 'ks', kind: 'park', actor: 'admin:park', expectedMarker: SAFETY,
      }, body);
      expect(rs.outcome).toMatchObject({ parked: true, escalated: false });
      const s1 = (await orderOf(idSafety))!;
      expect(s1.deliveryHoldReason, 'a stronger terminal marker is left in place').toBe(SAFETY);
      expect(s1.deliveryFenceVersion, 'no fence bump when already terminal').toBe(1);
      expect(await prisma.deliveryOutbox.count({ where: { orderId: idSafety } })).toBe(0);

      console.log(`[PARK] OK — anchor escalated ${ANCHOR} -> manual_resolution_hold:… (fence 1->2), case open, no outbox, idempotent; safety hold left terminal.`);
    } finally {
      for (const id of ids) {
        await prisma.humanQaOperatorAction.deleteMany({ where: { orderId: id } }).catch(() => {});
        await prisma.atomicOperationReceipt.deleteMany({ where: { orderId: id } }).catch(() => {});
        await prisma.deliveryOutbox.deleteMany({ where: { orderId: id } }).catch(() => {});
        await prisma.humanQaReviewCase.deleteMany({ where: { orderId: id } }).catch(() => {});
        await prisma.order.delete({ where: { id } }).catch(() => {});
      }
    }
  }, 120_000);
});
