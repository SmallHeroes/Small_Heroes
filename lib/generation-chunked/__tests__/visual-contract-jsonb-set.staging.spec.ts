import { describe, it, expect } from 'vitest';
import path from 'path';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';
import type { PipelineCache } from '@/lib/generation-pipeline/types';

/**
 * (WS0c SHA 3 — staging proof 1 of 3) B2 jsonb_set KEY-PRESERVATION — real Postgres, NO render, NO LLM.
 *
 * `ensureFrozenVisualContract` writes ONLY the `{visualContract}` key of the GenerationJob.pipelineCache, via a
 * single-key `jsonb_set(COALESCE(pipelineCache,'{}'), '{visualContract}', <contract>, true)` inside the
 * delivery-input barrier — never a read-merge of the whole in-memory snapshot (so a lost-lease late freeze can never
 * clobber a newer unrelated field written by a concurrent pipelineCache writer). The unit test can only SIMULATE
 * jsonb_set; this CONFIRMS on REAL Postgres that the freeze:
 *   (a) preserves pre-existing, unrelated pipelineCache keys while adding `visualContract`,
 *   (b) stamps Order.visualContractHash to the contract's canonical hash, and
 *   (c) is idempotent — a re-freeze of the SAME contract REPLAYS through the receipt fence (operationKey embeds the
 *       hash) → no second inputVersion bump.
 *
 * It loads the real bunny_ometz_adventure artifact from disk (no LLM), so it needs only a DB — no OpenAI/Supabase,
 * no render. The freeze flag is forced ON inside the test (isolated staging, behind assertEnvSeparation). Skipped by
 * default (and always in prod) so `npm run check` stays green and never connects.
 *
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_VC_JSONB_PROOF=true \
 *     DATABASE_URL='postgresql://...pooler...:6543/postgres?pgbouncer=true' \
 *     npx vitest run lib/generation-chunked/__tests__/visual-contract-jsonb-set.staging.spec.ts
 */
const RUN = process.env.RUN_VC_JSONB_PROOF === 'true' && canAccessStagingQa();
const ARTIFACT_DIR = path.join(process.cwd(), 'story-bank', 'v3-approved');
const STORY_KEY = 'bunny_ometz_adventure';

describe.skipIf(!RUN)('(WS0c) B2 jsonb_set — real-Postgres single-key freeze preserves unrelated pipelineCache keys', () => {
  it('freeze writes {visualContract} without clobbering pre-existing keys; stamps the hash; re-freeze replays (no double bump)', async () => {
    assertEnvSeparation(); // refuses to proceed if ANY prod resource is configured
    const prevFreeze = process.env.VISUAL_CONTRACT_FREEZE;
    process.env.VISUAL_CONTRACT_FREEZE = 'true'; // exercise the REAL freeze write on isolated staging

    const { prisma } = await import('@/lib/prisma'); // lazy: a skipped run never connects
    const { ensureFrozenVisualContract } = await import('@/lib/generation-pipeline/ensure-frozen-visual-contract');
    const { loadVisualContractArtifact } = await import('@/lib/visual-contract-compiler');

    const { contract, contractHash } = loadVisualContractArtifact(ARTIFACT_DIR, STORY_KEY);
    const orderId = `vc-jsonb-${Date.now()}`;
    // Two unrelated keys that MUST survive the single-key freeze write.
    const SENTINEL = { storyFilePath: 'story-bank/v3-approved/bunny_ometz_adventure.md', unrelatedSentinel: 'KEEP_ME' };
    const injectProduce = { db: prisma, produce: async () => ({ contract, contractHash }) };

    const readCache = async () => {
      const row = await prisma.generationJob.findUnique({ where: { orderId }, select: { pipelineCache: true } });
      return (row?.pipelineCache ?? {}) as Record<string, unknown>;
    };

    try {
      await prisma.order.create({
        data: {
          id: orderId, inputVersion: 0, status: 'generating',
          customerEmail: `${orderId}@example.invalid`, customerName: 'T', childName: 'Kid',
          topic: 'vc', basePrice: 0, addonsPrice: 0, totalPrice: 0,
        },
      });
      await prisma.generationJob.create({
        data: { orderId, status: 'running', currentStage: 'cover', pipelineCache: SENTINEL },
      });

      // ── FREEZE (real barrier + real jsonb_set) ──────────────────────────────────────────────────
      const order = (await prisma.order.findUnique({ where: { id: orderId } }))!;
      await ensureFrozenVisualContract(order, { ...SENTINEL } as unknown as PipelineCache, injectProduce);

      const afterFreeze = await readCache();
      const orderAfter = (await prisma.order.findUnique({ where: { id: orderId }, select: { inputVersion: true, visualContractHash: true } }))!;

      // (a) KEY-PRESERVATION — the unrelated keys survive; the freeze added ONLY visualContract.
      expect(afterFreeze.unrelatedSentinel, 'unrelated key survives the single-key jsonb_set').toBe('KEEP_ME');
      expect(afterFreeze.storyFilePath, 'unrelated key survives the single-key jsonb_set').toBe(SENTINEL.storyFilePath);
      expect(afterFreeze.visualContract, 'visualContract written by the freeze').toBeTruthy();
      expect((afterFreeze.visualContract as { storyKey?: string }).storyKey).toBe(STORY_KEY);
      // (b) BINDING — Order.visualContractHash stamped to the contract's canonical hash.
      expect(orderAfter.visualContractHash).toBe(contractHash);
      const ivAfterFirst = orderAfter.inputVersion;
      expect(ivAfterFirst, 'exactly one inputVersion bump for the first freeze').toBe(1);

      // ── (c) IDEMPOTENT re-freeze of the SAME contract → receipt REPLAY (no second bump, keys intact) ──
      const orderReload = (await prisma.order.findUnique({ where: { id: orderId } }))!;
      await ensureFrozenVisualContract(orderReload, { ...SENTINEL } as unknown as PipelineCache, injectProduce);

      const afterReFreeze = await readCache();
      const orderFinal = (await prisma.order.findUnique({ where: { id: orderId }, select: { inputVersion: true, visualContractHash: true } }))!;
      expect(afterReFreeze.unrelatedSentinel, 're-freeze still preserves the unrelated key').toBe('KEEP_ME');
      expect(afterReFreeze.storyFilePath).toBe(SENTINEL.storyFilePath);
      expect(orderFinal.visualContractHash).toBe(contractHash);
      expect(orderFinal.inputVersion, 're-freeze REPLAYS through the fence — NO double bump').toBe(ivAfterFirst);

      // eslint-disable-next-line no-console
      console.log(`[VC-JSONB] order=${orderId} keys=${Object.keys(afterFreeze).sort().join(',')} hash=${contractHash.slice(0, 12)}… inputVersion=${orderFinal.inputVersion}`);
    } finally {
      if (prevFreeze === undefined) delete process.env.VISUAL_CONTRACT_FREEZE;
      else process.env.VISUAL_CONTRACT_FREEZE = prevFreeze;
      await prisma.atomicOperationReceipt.deleteMany({ where: { orderId } }).catch(() => {});
      await prisma.generationJob.deleteMany({ where: { orderId } }).catch(() => {});
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    }
  }, 120_000);
});
