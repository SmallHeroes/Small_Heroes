import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';

/**
 * (Codex B′) MANDATORY LIVE PROOF — receipt-fenced exactly-once over the REAL Supavisor TRANSACTION pooler (6543),
 * NO renders. Reproduces the production failure: a post-render barrier tx COMMITS on the server yet the caller
 * receives P2028 ("Transaction not found") because the pooled connection was recycled during the ~45-50s render
 * gap. Each of the 17 cycles: sleep 45-50s (the real gap that recycles the connection), then drive all THREE
 * fenced barriers with an INJECTED ambiguous commit (afterCommit throws a P2028 AFTER the tx committed) and prove:
 *   A. delivery-input barrier   → EXACTLY ONE inputVersion++ per key (no double bump),
 *   B. regen-reserve            → EXACTLY ONE regenCount++ per key (no double budget burn),
 *   C. readiness-commit         → EXACTLY ONE Manifest + ONE Outbox intent per key (no duplicate delivery).
 * Plus: a same-key/different-payload receipt FAILS CLOSED. Any genuine pooler P2028 during the gap is retried
 * THROUGH the fence and logged. Skipped by default (and always in prod) so `npm run check` stays green without a DB.
 *
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_B_PRIME_PROOF=true READINESS_MANIFEST_ENABLED=true \
 *     DATABASE_URL='postgresql://...pooler...:6543/postgres?pgbouncer=true' npx vitest run \
 *     lib/generation-chunked/__tests__/atomic-receipt-pooler.staging.spec.ts
 *
 * Set B_PRIME_PROOF_CYCLES=1 (and a short B_PRIME_PROOF_GAP_MS) for a fast smoke; defaults are 17 cycles @ 45-50s.
 */
const RUN = process.env.RUN_B_PRIME_PROOF === 'true' && canAccessStagingQa();
const CYCLES = Number(process.env.B_PRIME_PROOF_CYCLES ?? 17);
const gapMsFor = (i: number): number =>
  process.env.B_PRIME_PROOF_GAP_MS ? Number(process.env.B_PRIME_PROOF_GAP_MS) : 45_000 + (i % 6) * 1_000; // [45s,50s]
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const shaOf = (u: string) => createHash('sha256').update(u.trim()).digest('hex');

/** Prisma-shaped P2028 (mirrors Supavisor: `{ code:'P2028', meta:{ error:'Transaction not found...' } }`). */
class InjectedP2028 extends Error {
  readonly code = 'P2028';
  readonly meta = { error: 'Transaction not found. The transaction was recycled by the pooler across the render gap.' };
  constructor() { super('Transaction not found'); this.name = 'InjectedP2028'; }
}
/** afterCommit hook: throw the ambiguous-commit P2028 on the FIRST (committed) attempt only. Logs the exact meta. */
function ambiguousCommit(cycle: number, path: string) {
  return async (attempt: number) => {
    if (attempt !== 0) return;
    const err = new InjectedP2028();
    console.log(`[B′-PROOF] cycle=${cycle} path=${path} phase=after_commit injected code=${err.code} meta.error="${err.meta.error}"`);
    throw err;
  };
}

describe.skipIf(!RUN)('(Codex B′) receipt fence — 17-cycle live 6543-pooler exactly-once proof', () => {
  it('17× (45-50s gap → barrier tx) with an injected ambiguous commit: exactly-once across all 3 paths + fail-closed', async () => {
    assertEnvSeparation(); // refuses to proceed if ANY prod resource is configured
    const previousFlag = process.env.READINESS_MANIFEST_ENABLED;
    process.env.READINESS_MANIFEST_ENABLED = 'true';
    const { prisma } = await import('@/lib/prisma'); // lazy import: a skipped run never connects
    const { withDeliveryInputMutation, commitBaseBookReadiness } = await import('@/lib/generation-pipeline/readiness-manifest');
    const { reserveMarkAndClearRegen } = await import('@/lib/generation-chunked/clear-page-images-for-regen');
    const { runAtomicOperation, hashOperationPayload, ReceiptPayloadMismatchError } = await import('@/lib/generation-pipeline/atomic-operation');
    const { QUALITY_EVALUATOR_CONTRACT_VERSION } = await import('@/lib/generation-pipeline/quality-evidence');

    const nonce = `${process.env.B_PRIME_PROOF_NONCE ?? 'a'}-${Date.now()}`;
    const idA = `bprime-A-${nonce}`; // delivery-input
    const idB = `bprime-B-${nonce}`; // regen-reserve
    const idC = `bprime-C-${nonce}`; // readiness-commit
    const APP = 'https://app.example.invalid';
    const stubInspect = async (url: string | null | undefined) => {
      const u = (url ?? '').trim();
      if (!u) return { ok: false, bytes: 0, format: null, mime: null, width: null, height: null, sha256: null, error: 'url_not_allowlisted' } as const;
      return { ok: true, bytes: 2048, format: 'png' as const, mime: 'image/png', width: 800, height: 1200, sha256: shaOf(u) };
    };

    const order = (id: string, over: Record<string, unknown> = {}) => ({
      id, inputVersion: 0, customerEmail: `${id}@example.invalid`, customerName: 'T', childName: 'Kid',
      topic: 'bprime', basePrice: 0, addonsPrice: 0, totalPrice: 0, ...over,
    });

    try {
      // ---- seed order A (delivery-input barrier) ----
      await prisma.order.create({ data: { ...order(idA, { status: 'generating' }), book: { create: { title: 'A', readUrl: `${APP}/old` } } } });

      // ---- seed order B (regen-reserve): book + one page so the clear has a target ----
      await prisma.order.create({ data: { ...order(idB, { status: 'generating' }), book: { create: { title: 'B', pages: { create: [{ pageNumber: 1, text: 'p1' }] } } } } });

      // ---- seed order C (readiness-commit): a fully PASS-able book (cover + 1 page) + passing quality evidence ----
      const coverUrl = `${APP}/cover.png`, pageUrl = `${APP}/p1.png`;
      await prisma.order.create({ data: { ...order(idC, {
        status: 'generating', expectedPageCount: 1, storySourceHash: 'src', selectionFilename: 'bedtime/x.md', frozenProductVersion: 'v3',
        coverImageUrl: coverUrl,
        book: { create: { title: 'C', coverImageUrl: coverUrl, readUrl: `${APP}/ready?orderId=${idC}`, pages: { create: [{ pageNumber: 1, text: 'עמוד' }] } } },
      }) } });
      const bookC = await prisma.generatedBook.findUnique({ where: { orderId: idC }, select: { pages: { select: { id: true, pageNumber: true } } } });
      await prisma.imageAsset.create({ data: { pageId: bookC!.pages[0].id, provider: 'stub', prompt: 'x', url: pageUrl, style: 'style-01' } });
      await prisma.generationJob.create({ data: { orderId: idC, status: 'running', currentStage: 'package' } });
      for (const [artifactKey, url] of [['cover', coverUrl], ['page:1', pageUrl]] as const) {
        await prisma.qualityEvidence.create({ data: { orderId: idC, artifactKey, assetSha256: shaOf(url), verdict: 'passed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, regenCount: 0 } });
      }

      let ivA = 0; // track order A's inputVersion; must advance by EXACTLY 1 per cycle

      for (let i = 0; i < CYCLES; i++) {
        const gap = gapMsFor(i);
        console.log(`[B′-PROOF] cycle=${i} phase=gap sleeping ${gap}ms (real pooler recycle window)`);
        await sleep(gap);

        // ---------- PATH A: delivery-input barrier → exactly one inputVersion++ ----------
        try {
          const before = (await prisma.order.findUnique({ where: { id: idA }, select: { inputVersion: true } }))!.inputVersion;
          await withDeliveryInputMutation(
            prisma,
            { orderId: idA, reason: 'package_payload_changed', operationKey: `delivery_input:${idA}:readurl:cycle${i}`, atomic: { afterCommit: ambiguousCommit(i, 'delivery_input') } },
            (tx) => tx.generatedBook.update({ where: { orderId: idA }, data: { readUrl: `${APP}/c${i}` } }),
          );
          const after = (await prisma.order.findUnique({ where: { id: idA }, select: { inputVersion: true } }))!.inputVersion;
          expect(after - before, `cycle ${i}: inputVersion advanced by exactly 1`).toBe(1);
          ivA = after;
        } catch (e) {
          console.log(`[B′-PROOF] cycle=${i} path=delivery_input GENUINE error code=${(e as { code?: string }).code} meta=${JSON.stringify((e as { meta?: unknown }).meta)}`);
          throw e;
        }

        // ---------- PATH B: regen-reserve → exactly one regenCount++ (fresh artifact per cycle) ----------
        const artifactKey = `page:${1000 + i}`; // distinct per cycle so a fresh reservation grants (budget=2)
        await prisma.qualityEvidence.create({ data: { orderId: idB, artifactKey, assetSha256: 'seed', verdict: 'evidence_unknown', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, regenCount: 0 } });
        const grant = await reserveMarkAndClearRegen(prisma, { orderId: idB, artifactKey, operationKey: `regen_reserve:${idB}:cyc${i}:${artifactKey}`, atomic: { afterCommit: ambiguousCommit(i, 'regen_reserve') } });
        expect(grant.granted, `cycle ${i}: reservation granted`).toBe(true);
        const qb = await prisma.qualityEvidence.findUnique({ where: { orderId_artifactKey: { orderId: idB, artifactKey } }, select: { regenCount: true } });
        expect(qb?.regenCount, `cycle ${i}: regenCount is exactly 1, not double-burned`).toBe(1);

        // ---------- PATH C: readiness-commit → exactly one Manifest + one Outbox per key ----------
        // Make each cycle a genuinely NEW commit (distinct inputVersion → distinct operationKey) by bumping C's
        // inputVersion first; then the injected ambiguous commit must still produce exactly ONE manifest + outbox.
        await prisma.$executeRaw`UPDATE "Order" SET "inputVersion" = "inputVersion" + 1 WHERE "id" = ${idC}`;
        await prisma.order.update({ where: { id: idC }, data: { status: 'generating' } });
        const manifestsBefore = await prisma.bookReadinessManifest.count({ where: { orderId: idC } });
        const outboxBefore = await prisma.deliveryOutbox.count({ where: { orderId: idC } });
        const commit = await commitBaseBookReadiness(
          prisma,
          { orderId: idC, anchorAllowsDelivery: true, anchorOrderStatus: 'ready', anchorReason: null },
          { inspect: stubInspect, appBaseUrl: APP, atomic: { afterCommit: ambiguousCommit(i, 'readiness_commit') } },
        );
        expect(commit.manifestStatus, `cycle ${i}: commit passed`).toBe('passed');
        const manifestsAfter = await prisma.bookReadinessManifest.count({ where: { orderId: idC } });
        const outboxAfter = await prisma.deliveryOutbox.count({ where: { orderId: idC } });
        expect(manifestsAfter - manifestsBefore, `cycle ${i}: exactly ONE manifest`).toBe(1);
        // Outbox is REBOUND in place on a re-commit (same dedupeKey), so total count stays 1 across all cycles.
        expect(outboxAfter, `cycle ${i}: exactly ONE outbox intent total`).toBe(1);
        expect(outboxBefore <= 1).toBe(true);
      }

      // ---- FAIL-CLOSED: a same-key/different-payload receipt fails closed (never re-applies) ----
      const mismatchKey = `bprime-mismatch-${nonce}`;
      await prisma.atomicOperationReceipt.create({ data: { operationKey: mismatchKey, orderId: idA, kind: 'delivery_input', payloadHash: 'ORIGINAL', result: { value: 'recorded' } } });
      let failedClosed = false;
      try {
        await runAtomicOperation(prisma, { operationKey: mismatchKey, orderId: idA, kind: 'delivery_input', payloadHash: hashOperationPayload({ different: true }), run: async () => 'SHOULD_NEVER_RUN' });
      } catch (e) {
        failedClosed = e instanceof ReceiptPayloadMismatchError;
        console.log(`[B′-PROOF] fail-closed: ${(e as Error).name} — ${(e as Error).message}`);
      }
      expect(failedClosed, 'same key + different payload FAILS CLOSED').toBe(true);

      // ---- Summary assertions ----
      expect(ivA, `order A inputVersion advanced exactly ${CYCLES}×`).toBe(CYCLES);
      const receiptCount = await prisma.atomicOperationReceipt.count({ where: { orderId: { in: [idA, idB, idC] } } });
      console.log(`[B′-PROOF] DONE cycles=${CYCLES} order-A inputVersion=${ivA} receipts=${receiptCount}`);
    } finally {
      if (previousFlag === undefined) delete process.env.READINESS_MANIFEST_ENABLED;
      else process.env.READINESS_MANIFEST_ENABLED = previousFlag;
      for (const id of [idA, idB, idC]) {
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
    }
  }, 1_500_000); // up to ~25 min for 17 × ~47s gaps + tx overhead
});
