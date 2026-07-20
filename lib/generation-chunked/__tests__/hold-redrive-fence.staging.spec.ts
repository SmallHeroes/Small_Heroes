import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';

/**
 * (Unit C — Codex Slice-1 P1 proof) HOLD redrive after its OWN fence bump — REAL Postgres, no renders.
 *
 * The gap Codex flagged: the pure-key test proves the `holdfenceNA` segment, but nothing exercised the actual
 * persisted `AtomicOperationReceipt` REPLAY against Postgres after a first HOLD has bumped
 * `Order.deliveryFenceVersion`. This closes it. The scenario Codex specified, exactly:
 *   1. A first `commitBaseBookReadiness` creates a plain HOLD and bumps the fence ONCE.
 *   2. A second, FRESH redrive derives the SAME `holdfenceNA` key, REPLAYS the receipt, creates NO second
 *      manifest and NO second outbox row, and does NOT bump the fence again.
 *
 * Why it holds: a hold's operationKey uses `holdfenceNA` (readiness-manifest.ts:559-560 — the load-time fence is
 * folded into the receipt IDENTITY only for a delivery-authorizing `ready` outcome), and the receipt payloadHash
 * (mutationPayload, readiness-manifest.ts:518-528) excludes deliveryFenceVersion. So a redrive at the bumped fence
 * derives the SAME key AND the SAME payloadHash → runAtomicOperation short-circuits to the recorded result
 * (atomic-operation.ts) instead of re-running the tx (which would re-bump the fence + re-create a manifest). If the
 * hold key ever (wrongly) included the fence, the redrive would derive a DIFFERENT key and this test would fail —
 * exactly the failure `HOLD_REDRIVE_BREAK=inputversion` simulates (see below).
 *
 * HOW TO RUN (staging as the sibling atomic-receipt-pooler.staging.spec.ts, or a throwaway Postgres):
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_HOLD_REDRIVE_PROOF=true READINESS_MANIFEST_ENABLED=true \
 *     DATABASE_URL='postgresql://...session-pooler...:5432/postgres' \
 *     npx vitest run lib/generation-chunked/__tests__/hold-redrive-fence.staging.spec.ts
 *
 * Add HOLD_REDRIVE_BREAK=inputversion to DEMONSTRATE the test is not vacuous: it bumps inputVersion between the two
 * drives, so the redrive derives a DIFFERENT key (a genuine second commit) — a second manifest + a second fence
 * bump — and every one of the four assertions fails. Off by default. Skipped in the normal suite (and always on prod).
 */
const RUN = process.env.RUN_HOLD_REDRIVE_PROOF === 'true' && canAccessStagingQa();
const BREAK_KEY = process.env.HOLD_REDRIVE_BREAK === 'inputversion'; // demonstration-only: force a different key
const shaOf = (u: string) => createHash('sha256').update(u.trim()).digest('hex');

describe.skipIf(!RUN)('(Unit C, Codex P1) HOLD redrive replays after its own fence bump — real Postgres', () => {
  it('same holdfenceNA key · receipt replayed · no 2nd manifest/outbox · fence not bumped twice', async () => {
    assertEnvSeparation(); // refuses to proceed if ANY prod resource is configured

    const prevFlag = process.env.READINESS_MANIFEST_ENABLED;
    const prevSoft = process.env.QA_SOFT_DELIVER;
    process.env.READINESS_MANIFEST_ENABLED = 'true';
    delete process.env.QA_SOFT_DELIVER; // a plain HOLD is never soft-deliver-SHIPPED

    const { prisma } = await import('@/lib/prisma'); // lazy: a skipped run never connects
    const { commitBaseBookReadiness } = await import('@/lib/generation-pipeline/readiness-manifest');
    const { QUALITY_EVALUATOR_CONTRACT_VERSION } = await import('@/lib/generation-pipeline/quality-evidence');

    const id = `holdredrive-${process.env.HOLD_REDRIVE_NONCE ?? 'a'}-${Date.now()}`;
    const APP = 'https://app.example.invalid';
    const coverUrl = `${APP}/cover.png`, pageUrl = `${APP}/p1.png`;
    const stubInspect = async (url: string | null | undefined) => {
      const u = (url ?? '').trim();
      if (!u) return { ok: false, bytes: 0, format: null, mime: null, width: null, height: null, sha256: null, error: 'url_not_allowlisted' } as const;
      return { ok: true, bytes: 2048, format: 'png' as const, mime: 'image/png', width: 800, height: 1200, sha256: shaOf(u) };
    };
    const fenceOf = async () => (await prisma.order.findUnique({ where: { id }, select: { deliveryFenceVersion: true } }))!.deliveryFenceVersion;

    try {
      // A fully PASS-able book (integrity + quality pass) whose only reason to hold is a low-confidence anchor
      // (anchorAllowsDelivery:false) with soft-deliver OFF → the canonical PLAIN HOLD that bumps the fence.
      await prisma.order.create({ data: {
        id, status: 'generating', customerEmail: `${id}@example.invalid`, customerName: 'T', childName: 'Kid', topic: 'holdredrive',
        basePrice: 0, addonsPrice: 0, totalPrice: 0, inputVersion: 0,
        expectedPageCount: 1, storySourceHash: 'src', selectionFilename: 'bedtime/x.md', frozenProductVersion: 'v3', coverImageUrl: coverUrl,
        book: { create: { title: 'H', coverImageUrl: coverUrl, readUrl: `${APP}/ready?orderId=${id}`, pages: { create: [{ pageNumber: 1, text: 'עמוד' }] } } },
      } });
      const book = await prisma.generatedBook.findUnique({ where: { orderId: id }, select: { pages: { select: { id: true } } } });
      await prisma.imageAsset.create({ data: { pageId: book!.pages[0].id, provider: 'stub', prompt: 'x', url: pageUrl, style: 'style-01' } });
      await prisma.generationJob.create({ data: { orderId: id, status: 'running', currentStage: 'package' } });
      for (const [artifactKey, url] of [['cover', coverUrl], ['page:1', pageUrl]] as const) {
        await prisma.qualityEvidence.create({ data: { orderId: id, artifactKey, assetSha256: shaOf(url), verdict: 'passed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, regenCount: 0 } });
      }

      const holdArgs = { orderId: id, anchorAllowsDelivery: false, anchorOrderStatus: 'needs_human_qa', anchorReason: 'anchor_low_confidence:redrive_proof' };
      const deps = { inspect: stubInspect, appBaseUrl: APP };

      const fence0 = await fenceOf();

      // ---- DRIVE 1: create the HOLD, bump the fence once, write the receipt ----
      const r1 = await commitBaseBookReadiness(prisma, holdArgs, deps);
      expect(r1.orderStatus, 'drive1 is a plain HOLD (needs_human_qa)').toBe('needs_human_qa');
      const fence1 = await fenceOf();
      expect(fence1, 'the HOLD bumped the fence exactly once').toBe(fence0 + 1);

      const receipts1 = await prisma.atomicOperationReceipt.findMany({ where: { orderId: id }, orderBy: { createdAt: 'asc' }, select: { id: true, operationKey: true } });
      expect(receipts1.length, 'exactly one receipt after drive1').toBe(1);
      const key = receipts1[0].operationKey;
      expect(key, 'the hold receipt carries the holdfenceNA segment (fence NOT in the key)').toContain(':holdfenceNA');
      expect(await prisma.bookReadinessManifest.count({ where: { orderId: id } }), 'one manifest after drive1').toBe(1);
      expect(await prisma.deliveryOutbox.count({ where: { orderId: id } }), 'a HOLD enqueues NO outbox row').toBe(0);

      // DEMONSTRATION-ONLY: bump inputVersion so the redrive derives a DIFFERENT key (a genuine second commit) —
      // the exact regression that would occur if the hold key wrongly included the fence. Makes all four fail.
      if (BREAK_KEY) await prisma.$executeRaw`UPDATE "Order" SET "inputVersion" = "inputVersion" + 1 WHERE "id" = ${id}`;

      // ---- DRIVE 2: a FRESH redrive AFTER the fence bump — must REPLAY, not re-commit ----
      const r2 = await commitBaseBookReadiness(prisma, holdArgs, deps);

      const receipts2 = await prisma.atomicOperationReceipt.findMany({ where: { orderId: id }, orderBy: { createdAt: 'asc' }, select: { id: true, operationKey: true } });
      // (1) same holdfenceNA key  +  (2) the receipt was REPLAYED (no new row — the SAME row id)
      expect(receipts2.length, 'still exactly one receipt (replayed, not re-inserted)').toBe(1);
      expect(receipts2[0].operationKey, 'the redrive derived the SAME holdfenceNA key').toBe(key);
      expect(receipts2[0].id, 'the SAME receipt row was replayed').toBe(receipts1[0].id);
      // (3) no second manifest, still no outbox
      expect(await prisma.bookReadinessManifest.count({ where: { orderId: id } }), 'no second manifest').toBe(1);
      expect(await prisma.deliveryOutbox.count({ where: { orderId: id } }), 'still no outbox row').toBe(0);
      // (4) the fence was NOT bumped a second time
      const fence2 = await fenceOf();
      expect(fence2, 'the fence was NOT bumped again by the redrive').toBe(fence1);
      // the replayed result equals the recorded one
      expect(r2.orderStatus, 'the replayed result matches drive1').toBe(r1.orderStatus);

      console.log(`[HOLD-REDRIVE] key=${key}`);
      console.log(`[HOLD-REDRIVE] fence ${fence0} -> ${fence1} -> ${fence2}  manifests=1  outbox=0  receiptReplayed=${receipts2[0].id === receipts1[0].id}`);
    } finally {
      if (prevFlag === undefined) delete process.env.READINESS_MANIFEST_ENABLED; else process.env.READINESS_MANIFEST_ENABLED = prevFlag;
      if (prevSoft === undefined) delete process.env.QA_SOFT_DELIVER; else process.env.QA_SOFT_DELIVER = prevSoft;
      await prisma.atomicOperationReceipt.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.deliveryOutbox.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.bookReadinessManifest.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.bookReadiness.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.exceptionCase.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.qualityEvidence.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.generationJob.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.imageAsset.deleteMany({ where: { page: { book: { orderId: id } } } }).catch(() => {});
      await prisma.bookPage.deleteMany({ where: { book: { orderId: id } } }).catch(() => {});
      await prisma.generatedBook.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
  }, 120_000);
});
