import { describe, it, expect } from 'vitest';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';

/**
 * #7-b step 3 — HASH-PROOF (LOAD-BEARING). Proves the durable quality evidence binds the verdict to the EXACT
 * delivered bytes on the happy path: for BOTH the cover and page:1,
 *
 *     QualityEvidence.assetSha256 === inspectAsset(presentationUrl ?? url).sha256
 *
 * This is the seam every book depends on. persistDeliveredQualityEvidence computes the durable hash as
 * inspectAsset(deliveredUrl).sha256 where deliveredUrl = presentationUrl ?? url; the readiness quality gate later
 * re-inspects the delivered bytes and BLOCKS on any hash mismatch. So if the pipeline ever binds the verdict to
 * the WRONG url (raw vs presentation), or a presentation transform runs AFTER the hash is taken, every book
 * blocks at the gate for a genuinely-good image. A mismatch here → STOP and fix before any real order.
 *
 * The proof renders ONE page + cover from a pre-seeded matrix-sellable FIXTURE order (LOW quality, page-only via
 * CHUNKED_IMAGE_PAGE_FILTER=1 — NOT a full book, per the render-approval rule; ~2 LOW images). If Guy has already
 * rendered the fixture (e.g. `run-bunny-smoke-render --pages cover,1 --quality low`), the durable evidence is
 * already present and the drive loop is a no-op — the spec then only PROVES. Either way it reports the two hashes.
 *
 * Runs ONLY on isolated staging behind the env-separation guard + an explicit opt-in. The fixture order is Guy's
 * seeded, renderable order (NOT throwaway) — it is not deleted. Skipped by default (and always in production) so
 * `npm run check` stays green and NEVER renders/spends.
 *
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_HASH_PROOF=true READINESS_MANIFEST_ENABLED=true \
 *     IMAGE_PROVIDER=gpt-image GPT_IMAGE_QUALITY=low HASH_PROOF_ORDER_ID=<seeded-sellable-order-id> \
 *     DATABASE_URL='postgresql://...pooler...:6543/postgres?pgbouncer=true' OPENAI_API_KEY=sk-... \
 *     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx vitest run lib/generation-chunked/__tests__/quality-hash-proof.staging.spec.ts
 */
const RUN = process.env.RUN_HASH_PROOF === 'true' && canAccessStagingQa();
const ORDER_ID = process.env.HASH_PROOF_ORDER_ID ?? '';
// Each worker invocation advances one chunk (text → dna → anchor → cover → page-images). ~2 images render at LOW.
// A pre-rendered fixture breaks on iteration 0. Bounded so a stuck fixture fails loudly instead of looping forever.
const MAX_DRIVE_INVOCATIONS = Number(process.env.HASH_PROOF_MAX_INVOCATIONS ?? '80');

// (WS0c SHA 3) Two more contract-binding proofs live in this file (see the describes at the bottom):
//   • P1-4 receipt fence — a same-URL/new-hash asset write runs a NEW fenced op (RUN_CONTRACT_RECEIPT_PROOF; DB
//     only, no render/LLM).
//   • B1 render binding — QualityEvidence.contractHash === the pre-render frozen Order.visualContractHash for
//     cover + page:1 (rides the RUN_HASH_PROOF render, additionally gated on VISUAL_CONTRACT_FREEZE=true so a
//     contract actually freezes; the fixture must be a bunny_ometz_adventure bank order so its artifact exists).
const RUN_RECEIPT = process.env.RUN_CONTRACT_RECEIPT_PROOF === 'true' && canAccessStagingQa();
const RUN_B1 = RUN && process.env.VISUAL_CONTRACT_FREEZE === 'true';

/**
 * Reset the seeded fixture order so a render proof is idempotently RE-RUNNABLE without re-seeding. A prior drive
 * leaves the job TERMINAL (failed/done) → `runGenerationWorkerInvocation` then yields endless "No lease acquired
 * — job complete". This clears the derived render/quality/delivery state (durable evidence, receipt fences,
 * readiness, rendered images, the frozen contract) and DELETES the job so the REAL `startChunkedGeneration`
 * entrypoint recreates a fresh `pending` job with an EMPTY pipelineCache — dropping the child anchor + all
 * cross-chunk state so the drive re-runs the full text→dna→anchor→cover→page path from scratch. The book + pages'
 * text are kept (text-finalization upserts them). STAGING-ONLY: gated by the RUN describe + assertEnvSeparation.
 */
async function resetFixtureForRerun(orderId: string): Promise<void> {
  assertEnvSeparation(); // refuse if any prod resource is configured — never reset a prod order
  const { prisma } = await import('@/lib/prisma');
  const { startChunkedGeneration } = await import('@/lib/generation-chunked/start');
  // Derived quality / delivery / fence state → gone (the fresh drive re-derives it; text/asset fences re-run).
  for (const del of [
    () => prisma.qualityEvidence.deleteMany({ where: { orderId } }),
    () => prisma.deliveryOutbox.deleteMany({ where: { orderId } }),
    () => prisma.bookReadinessManifest.deleteMany({ where: { orderId } }),
    () => prisma.bookReadiness.deleteMany({ where: { orderId } }),
    () => prisma.exceptionCase.deleteMany({ where: { orderId } }),
    () => prisma.atomicOperationReceipt.deleteMany({ where: { orderId } }),
    () => prisma.imageAsset.deleteMany({ where: { page: { book: { orderId } } } }), // rendered images
    () => prisma.generatedBook.updateMany({ where: { orderId }, data: { coverImageUrl: null } }),
    () => prisma.generationJob.deleteMany({ where: { orderId } }), // drop the terminal job (+ its pipelineCache)
  ]) {
    await del().catch(() => {});
  }
  // Back to a claimable state (payment is the only short-circuit); clear the freeze stamp + prior error/cover.
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'paid', visualContractHash: null, coverImageUrl: null, lastError: null, errorAt: null },
  });
  // Real entrypoint: creates a fresh pending job (empty cache) + claims order → generating; skipWorkerChain = we drive.
  const started = await startChunkedGeneration(orderId, 'hash-proof-rerun-reset', { skipWorkerChain: true });
  if (!started.started) throw new Error(`reset: startChunkedGeneration did not start: ${started.message ?? 'unknown'}`);
}

describe.skipIf(!RUN)('#7-b HASH-PROOF — delivered-bytes hash binding (staging real render, page-only LOW)', () => {
  it('QualityEvidence.assetSha256 === inspectAsset(delivered).sha256 for cover + page:1 (happy path)', async () => {
    assertEnvSeparation(); // refuses to proceed if any prod resource is configured
    expect(ORDER_ID, 'set HASH_PROOF_ORDER_ID to a seeded matrix-sellable fixture order').not.toBe('');

    // Page-only + deterministic drive: restrict page renders to page 1 (cover always renders), and disable the
    // worker's self-chain so THIS loop paces the render rather than a background continuation.
    const prevPageFilter = process.env.CHUNKED_IMAGE_PAGE_FILTER;
    const prevNoChain = process.env.GENERATION_DISABLE_SELF_CHAIN;
    process.env.CHUNKED_IMAGE_PAGE_FILTER = '1';
    process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';

    try {
      const { prisma } = await import('@/lib/prisma'); // lazy import: skipped runs never connect
      const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');
      const { inspectAsset } = await import('@/lib/generation-pipeline/asset-integrity');
      const { coverArtifactKey, pageArtifactKey } = await import('@/lib/generation-pipeline/quality-evidence');

      const wanted = [coverArtifactKey(), pageArtifactKey(1)];
      const readEvidence = async () => {
        const rows = await prisma.qualityEvidence.findMany({
          where: { orderId: ORDER_ID, artifactKey: { in: wanted } },
          select: { artifactKey: true, assetSha256: true, verdict: true },
        });
        return {
          cover: rows.find((r) => r.artifactKey === coverArtifactKey()),
          page1: rows.find((r) => r.artifactKey === pageArtifactKey(1)),
        };
      };

      // Reset the fixture to a clean generating state so this proof is idempotently re-runnable (a prior drive
      // leaves a terminal job → endless "No lease acquired").
      await resetFixtureForRerun(ORDER_ID);

      // Drive the chunk worker until BOTH artifacts have a durable PASS verdict (or the fixture is already rendered).
      let ev = await readEvidence();
      for (let i = 0; i < MAX_DRIVE_INVOCATIONS; i++) {
        if (ev.cover?.verdict === 'passed' && ev.page1?.verdict === 'passed') break;
        const res = await runGenerationWorkerInvocation(ORDER_ID);
        if (res.error) throw new Error(`worker failed at stage=${res.stage ?? '?'}: ${res.error}`);
        ev = await readEvidence();
      }

      // Happy path: both required artifacts carry a durable PASS. (A non-pass here is a fixture/render problem, not
      // a hash-binding problem — surface it explicitly rather than letting the hash assert mislead.)
      expect(ev.cover?.verdict, 'cover verdict (happy-path fixture must PASS)').toBe('passed');
      expect(ev.page1?.verdict, 'page:1 verdict (happy-path fixture must PASS)').toBe('passed');

      // Re-derive the DELIVERED url exactly as the gate does (presentationUrl ?? url) and re-inspect the bytes.
      const row = await prisma.order.findUnique({
        where: { id: ORDER_ID },
        select: {
          book: {
            select: {
              coverImageUrl: true,
              pages: { where: { pageNumber: 1 }, select: { imageAsset: { select: { url: true, presentationUrl: true } } } },
            },
          },
        },
      });
      const coverUrl = row?.book?.coverImageUrl?.trim() ?? null;
      const pageAsset = row?.book?.pages[0]?.imageAsset;
      const pageUrl = (pageAsset?.presentationUrl ?? pageAsset?.url)?.trim() ?? null;

      const [coverInspect, pageInspect] = await Promise.all([inspectAsset(coverUrl), inspectAsset(pageUrl)]);

      // Report the two hashes (Codex #7-b step 3 asks for them explicitly).
      // eslint-disable-next-line no-console
      console.log(`[HASH-PROOF] cover   evidence=${ev.cover?.assetSha256}  delivered=${coverInspect.sha256}`);
      // eslint-disable-next-line no-console
      console.log(`[HASH-PROOF] page:1  evidence=${ev.page1?.assetSha256}  delivered=${pageInspect.sha256}`);

      // The delivered bytes must be inspectable (allowlisted staging URL, real raster) — an empty hash would make
      // the equality assert vacuously interesting, so require a real hash first.
      expect(coverInspect.sha256, `cover not inspectable: ${coverInspect.error ?? ''}`).toBeTruthy();
      expect(pageInspect.sha256, `page:1 not inspectable: ${pageInspect.error ?? ''}`).toBeTruthy();

      // LOAD-BEARING: the durable evidence hash equals the CURRENT delivered-bytes hash. If these differ, the
      // quality gate sees hash_mismatch for a good image → every book blocks.
      expect(ev.cover?.assetSha256).toBe(coverInspect.sha256);
      expect(ev.page1?.assetSha256).toBe(pageInspect.sha256);
    } finally {
      if (prevPageFilter === undefined) delete process.env.CHUNKED_IMAGE_PAGE_FILTER;
      else process.env.CHUNKED_IMAGE_PAGE_FILTER = prevPageFilter;
      if (prevNoChain === undefined) delete process.env.GENERATION_DISABLE_SELF_CHAIN;
      else process.env.GENERATION_DISABLE_SELF_CHAIN = prevNoChain;
    }
  }, 1_800_000); // up to 30 min: a cold fixture renders ~2 LOW images across several worker chunks; a pre-rendered one is instant
});

/**
 * (WS0c SHA 3 — staging proof 2 of 3) P1-4 asset receipt fence — same-URL/new-hash runs a NEW fenced op.
 *
 * The asset write-barrier is content-addressed on its delivered URL AND bound to the render-time contract hash
 * (operationKey = `delivery_input:<order>:page:<n>:<url>:<hash>`). The receipt fence NEVER re-runs a same-key
 * callback, so WITHOUT the hash suffix a same-URL redrive under a NEW frozen contract would replay the OLD receipt
 * and leave the atomically-bound QualityContext.contractHash stale. This proves on the REAL Postgres fence that a
 * CHANGED contractHash on an IDENTICAL delivered URL is a NEW operation that RE-RUNS the binding, while a same
 * url+hash redrive still REPLAYS. DB only — no render, no LLM.
 *
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_CONTRACT_RECEIPT_PROOF=true \
 *     DATABASE_URL='postgresql://...pooler...:6543/postgres?pgbouncer=true' \
 *     npx vitest run lib/generation-chunked/__tests__/quality-hash-proof.staging.spec.ts
 */
describe.skipIf(!RUN_RECEIPT)('(WS0c) P1-4 — same-URL/new-hash asset write runs a NEW fenced op (real receipt fence)', () => {
  it('a changed contractHash on an identical delivered URL re-runs the fenced binding; same url+hash replays', async () => {
    assertEnvSeparation();
    const { prisma } = await import('@/lib/prisma');
    const { withDeliveryInputMutation } = await import('@/lib/generation-pipeline/readiness-manifest');
    const { pageAssetOperationKey, contractHashPayloadFragment } = await import('@/lib/generation-pipeline/contract-hash-binding');

    const orderId = `vc-p14-${Date.now()}`;
    const url = 'https://app.example.invalid/orders/x/pages/page-001-abc.png'; // IDENTICAL across the two hashes
    const hashA = 'a'.repeat(64);
    const hashB = 'b'.repeat(64);
    let callbackRuns = 0;

    const bind = (hash: string) =>
      withDeliveryInputMutation(
        prisma,
        {
          orderId,
          reason: 'page_asset_changed',
          operationKey: pageAssetOperationKey(orderId, 1, url, hash),
          mutationPayload: { page: 1, deliveredUrl: url, ...contractHashPayloadFragment(hash) },
        },
        async (tx) => {
          callbackRuns += 1;
          await tx.generatedBook.update({ where: { orderId }, data: { readUrl: `bound:${hash.slice(0, 8)}` } });
        },
      );
    const inputVersion = async () =>
      (await prisma.order.findUnique({ where: { id: orderId }, select: { inputVersion: true } }))!.inputVersion;

    try {
      await prisma.order.create({
        data: {
          id: orderId, inputVersion: 0, status: 'generating',
          customerEmail: `${orderId}@example.invalid`, customerName: 'T', childName: 'Kid',
          topic: 'vc', basePrice: 0, addonsPrice: 0, totalPrice: 0,
          book: { create: { title: 'X' } },
        },
      });

      // 1) url + hashA → a fresh fenced op runs the binding.
      await bind(hashA);
      expect(callbackRuns, 'hashA: binding ran once').toBe(1);
      expect(await inputVersion(), 'hashA: one inputVersion bump').toBe(1);

      // 2) SAME url + hashB → a DIFFERENT operationKey → a NEW fenced op RE-RUNS the binding.
      await bind(hashB);
      expect(callbackRuns, 'hashB (identical url): the binding RE-RAN under the new hash').toBe(2);
      expect(await inputVersion(), 'hashB: a second inputVersion bump (a genuinely new op)').toBe(2);

      // 3) SAME url + hashA again → SAME operationKey → REPLAY (callback does NOT re-run).
      await bind(hashA);
      expect(callbackRuns, 'hashA replay: the binding did NOT re-run').toBe(2);
      expect(await inputVersion(), 'hashA replay: NO third bump').toBe(2);

      // The two receipts are keyed by the two distinct hash-bound operationKeys (and only those two).
      const keys = (await prisma.atomicOperationReceipt.findMany({ where: { orderId }, select: { operationKey: true } }))
        .map((r) => r.operationKey);
      expect(keys).toContain(pageAssetOperationKey(orderId, 1, url, hashA));
      expect(keys).toContain(pageAssetOperationKey(orderId, 1, url, hashB));
      expect(new Set(keys).size, 'exactly two distinct fenced ops (A and B), the replay added none').toBe(2);

      // eslint-disable-next-line no-console
      console.log(`[VC-P14] order=${orderId} runs=${callbackRuns} inputVersion=${await inputVersion()} distinctReceipts=${new Set(keys).size}`);
    } finally {
      await prisma.atomicOperationReceipt.deleteMany({ where: { orderId } }).catch(() => {});
      await prisma.generatedBook.deleteMany({ where: { orderId } }).catch(() => {});
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    }
  }, 120_000);
});

/**
 * (WS0c SHA 3 — staging proof 3 of 3) B1 — a real render binds delivered bytes + QA evidence + the pre-render
 * contractHash consistently.
 *
 * renderedContractHashOf(cache) captures the frozen contract hash from the LOCAL pipeline cache ONCE per artifact
 * (immune to a concurrent re-freeze of Order.visualContractHash — the TOCTOU the delivered-evidence producer used to
 * hit) and threads it into BOTH the QualityContext write and the durable QualityEvidence write. This proves under a
 * REAL render that, for the cover + page:1: (a) the contract froze this run (Order.visualContractHash set), (b) each
 * QualityEvidence.contractHash equals that pre-render frozen hash (and equals the other), and (c) the delivered
 * bytes are still bound (assetSha256 === inspectAsset(delivered).sha256) — the SAME render proves all three.
 *
 * Rides the RUN_HASH_PROOF render but is additionally gated on VISUAL_CONTRACT_FREEZE=true (so a contract actually
 * freezes) — the fixture MUST be a bunny_ometz_adventure bank order so its artifact exists to freeze. Freeze changes
 * NOTHING rendered (steering is a separate, still-OFF flag), so the bytes stay byte-identical. Add the freeze flag to
 * the hash-proof command:
 *
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_HASH_PROOF=true VISUAL_CONTRACT_FREEZE=true \
 *     READINESS_MANIFEST_ENABLED=true IMAGE_PROVIDER=gpt-image GPT_IMAGE_QUALITY=low \
 *     HASH_PROOF_ORDER_ID=<seeded bunny_ometz_adventure order> \
 *     DATABASE_URL='postgresql://...pooler...:6543/postgres?pgbouncer=true' OPENAI_API_KEY=sk-... \
 *     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx vitest run lib/generation-chunked/__tests__/quality-hash-proof.staging.spec.ts
 */
describe.skipIf(!RUN_B1)('(WS0c) B1 — a real render binds delivered bytes + QA evidence + the pre-render contractHash', () => {
  it('QualityEvidence.contractHash === Order.visualContractHash (pre-render frozen) for cover + page:1, bytes still bound', async () => {
    assertEnvSeparation();
    expect(ORDER_ID, 'set HASH_PROOF_ORDER_ID to a seeded bunny_ometz_adventure bank fixture').not.toBe('');

    const prevPageFilter = process.env.CHUNKED_IMAGE_PAGE_FILTER;
    const prevNoChain = process.env.GENERATION_DISABLE_SELF_CHAIN;
    process.env.CHUNKED_IMAGE_PAGE_FILTER = '1';
    process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';

    try {
      const { prisma } = await import('@/lib/prisma');
      const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');
      const { inspectAsset } = await import('@/lib/generation-pipeline/asset-integrity');
      const { coverArtifactKey, pageArtifactKey } = await import('@/lib/generation-pipeline/quality-evidence');

      const wanted = [coverArtifactKey(), pageArtifactKey(1)];
      const read = async () => {
        const rows = await prisma.qualityEvidence.findMany({
          where: { orderId: ORDER_ID, artifactKey: { in: wanted } },
          select: { artifactKey: true, assetSha256: true, verdict: true, contractHash: true },
        });
        const order = await prisma.order.findUnique({ where: { id: ORDER_ID }, select: { visualContractHash: true } });
        return {
          cover: rows.find((r) => r.artifactKey === coverArtifactKey()),
          page1: rows.find((r) => r.artifactKey === pageArtifactKey(1)),
          orderHash: order?.visualContractHash ?? null,
        };
      };

      // Reset the fixture to a clean generating state so this proof is idempotently re-runnable (a prior drive
      // leaves a terminal job → endless "No lease acquired").
      await resetFixtureForRerun(ORDER_ID);

      // Drive until BOTH artifacts are present AND the contract has frozen (freeze flag ON via the gate).
      let st = await read();
      for (let i = 0; i < MAX_DRIVE_INVOCATIONS; i++) {
        if (st.cover && st.page1 && st.orderHash) break;
        const res = await runGenerationWorkerInvocation(ORDER_ID);
        if (res.error) throw new Error(`worker failed at stage=${res.stage ?? '?'}: ${res.error}`);
        st = await read();
      }

      expect(st.orderHash, 'Order.visualContractHash must be frozen (VISUAL_CONTRACT_FREEZE=true + a bank artifact; reset a freeze-off fixture)').toBeTruthy();
      expect(st.cover, 'cover evidence present').toBeTruthy();
      expect(st.page1, 'page:1 evidence present').toBeTruthy();

      // (a)+(b) B1: each durable per-artifact contractHash equals the pre-render frozen hash — and equals the other.
      expect(st.cover!.contractHash, 'cover QualityEvidence.contractHash binds the frozen contract').toBe(st.orderHash);
      expect(st.page1!.contractHash, 'page:1 QualityEvidence.contractHash binds the frozen contract').toBe(st.orderHash);

      // (c) The delivered bytes are still bound — the SAME render proves all three dimensions.
      const row = await prisma.order.findUnique({
        where: { id: ORDER_ID },
        select: {
          book: {
            select: {
              coverImageUrl: true,
              pages: { where: { pageNumber: 1 }, select: { imageAsset: { select: { url: true, presentationUrl: true } } } },
            },
          },
        },
      });
      const coverUrl = row?.book?.coverImageUrl?.trim() ?? null;
      const pageAsset = row?.book?.pages[0]?.imageAsset;
      const pageUrl = (pageAsset?.presentationUrl ?? pageAsset?.url)?.trim() ?? null;
      const [coverInspect, pageInspect] = await Promise.all([inspectAsset(coverUrl), inspectAsset(pageUrl)]);
      expect(coverInspect.sha256, `cover not inspectable: ${coverInspect.error ?? ''}`).toBeTruthy();
      expect(pageInspect.sha256, `page:1 not inspectable: ${pageInspect.error ?? ''}`).toBeTruthy();
      expect(st.cover!.assetSha256).toBe(coverInspect.sha256);
      expect(st.page1!.assetSha256).toBe(pageInspect.sha256);

      // eslint-disable-next-line no-console
      console.log(`[VC-B1] order=${ORDER_ID} frozen=${st.orderHash?.slice(0, 12)}… cover.contractHash=${st.cover!.contractHash?.slice(0, 12)}… page1.contractHash=${st.page1!.contractHash?.slice(0, 12)}…`);
    } finally {
      if (prevPageFilter === undefined) delete process.env.CHUNKED_IMAGE_PAGE_FILTER;
      else process.env.CHUNKED_IMAGE_PAGE_FILTER = prevPageFilter;
      if (prevNoChain === undefined) delete process.env.GENERATION_DISABLE_SELF_CHAIN;
      else process.env.GENERATION_DISABLE_SELF_CHAIN = prevNoChain;
    }
  }, 1_800_000); // same budget as the bytes proof: a cold bunny fixture renders ~2 LOW images; a pre-rendered one is instant
});
