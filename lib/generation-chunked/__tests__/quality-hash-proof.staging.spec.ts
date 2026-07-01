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
