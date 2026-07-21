import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';

/**
 * (release-as-readiness-mode, 2a-2 — the §8 live proof) REAL Postgres, no renders. Seeds a fully-shippable book whose
 * ONLY blocker is one `safety_hold:hazard:` page, then drives commitBaseBookReadiness's RELEASE MODE end to end:
 *   • determinate hazard → release → both gates pass → ship CAS → ready + Outbox, marker cleared, BOTH overrides
 *     written, safety case resolved, ONE release audit row, fence bumped to F+1 (ship + Outbox bind F+1);
 *   • REPLAY → refused (marker now qa_released:/ready) — never replayed-as-success;
 *   • UNVERIFIED marker → refused (marker_not_safety_hazard);
 *   • SHA_MISSING → refused;
 *   • PASSES-OUT / FAILS-IN (hazards not a subset) → the whole release rolls back: marker + case intact, NO override,
 *     NO audit, NO outbox — the failure-rollback ruling.
 *
 * HOW TO RUN (staging session pooler; needs the 20260722/23/24 migrations + a canonical schema):
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_RELEASE_MODE_PROOF=true READINESS_MANIFEST_ENABLED=true \
 *     GENERATION_SECRET=… NEXT_PUBLIC_APP_URL=https://preview.example.invalid SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     OPENAI_API_KEY=… REPLICATE_API_TOKEN=… DATABASE_URL='postgresql://…:5432/postgres' \
 *     npx vitest run lib/generation-pipeline/__tests__/release-mode.staging.spec.ts
 */
const RUN = process.env.RUN_RELEASE_MODE_PROOF === 'true' && canAccessStagingQa();
const shaOf = (u: string) => createHash('sha256').update(u).digest('hex');

describe.skipIf(!RUN)('(release-as-readiness-mode) commitBaseBookReadiness release mode — real Postgres', () => {
  it('ships a determinate hazard release, refuses unverified/sha_missing/replay, and rolls back a passes-out/fails-in', async () => {
    assertEnvSeparation();

    const prevFlag = process.env.READINESS_MANIFEST_ENABLED;
    const prevSoft = process.env.QA_SOFT_DELIVER;
    process.env.READINESS_MANIFEST_ENABLED = 'true';
    delete process.env.QA_SOFT_DELIVER; // never soft-deliver in this proof

    const { prisma } = await import('@/lib/prisma');
    const { commitBaseBookReadiness } = await import('@/lib/generation-pipeline/readiness-manifest');
    const { QUALITY_EVALUATOR_CONTRACT_VERSION } = await import('@/lib/generation-pipeline/quality-evidence');
    const { ReleaseAdmissibilityError } = await import('@/lib/generation-pipeline/safety-release');

    const nonce = `${process.env.RELEASE_MODE_NONCE ?? 'a'}-${Date.now()}`;
    const APP = 'https://app.example.invalid';
    const stubInspect = async (url: string | null | undefined) => {
      const u = (url ?? '').trim();
      return u
        ? { ok: true as const, bytes: 2048, format: 'png' as const, mime: 'image/png', width: 800, height: 1200, sha256: shaOf(u) }
        : { ok: false as const, bytes: 0, format: null, mime: null, width: null, height: null, sha256: null, error: 'no_url' };
    };
    const deps = { inspect: stubInspect, appBaseUrl: APP } as never;

    // Seed a shippable 1-page book: cover PASSED, page 1 FAILED with a determinate safety hazard + an open safety case.
    const seed = async (id: string, opts: { hazards: string[]; contentSha: string | null; marker: string }) => {
      const coverUrl = `${APP}/${id}/cover.png`, pageUrl = `${APP}/${id}/p1.png`;
      await prisma.order.create({ data: {
        id, status: 'generating', customerEmail: `${id}@example.invalid`, customerName: 'T', childName: 'Kid', topic: 'reltest',
        basePrice: 0, addonsPrice: 0, totalPrice: 0, inputVersion: 0,
        expectedPageCount: 1, storySourceHash: 'src', selectionFilename: 'bedtime/x.md', frozenProductVersion: 'v3', coverImageUrl: coverUrl,
        book: { create: { title: 'R', coverImageUrl: coverUrl, readUrl: `${APP}/ready?orderId=${id}`, pages: { create: [{ pageNumber: 1, text: 'עמוד' }] } } },
      } });
      const book = await prisma.generatedBook.findUnique({ where: { orderId: id }, select: { pages: { select: { id: true } } } });
      await prisma.imageAsset.create({ data: {
        pageId: book!.pages[0].id, provider: 'stub', prompt: 'x', url: pageUrl, style: 'style-01',
        safetyVerified: true, safetyHazards: opts.hazards, safetyContentSha256: opts.contentSha,
      } });
      await prisma.generatedBook.update({ where: { orderId: id }, data: { coverSafetyVerified: true, coverSafetyHazards: [], coverSafetyContentSha256: shaOf(coverUrl) } });
      await prisma.generationJob.create({ data: { orderId: id, status: 'running', currentStage: 'package' } });
      await prisma.qualityEvidence.create({ data: { orderId: id, artifactKey: 'cover', assetSha256: shaOf(coverUrl), verdict: 'passed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, regenCount: 0 } });
      await prisma.qualityEvidence.create({ data: { orderId: id, artifactKey: 'page:1', assetSha256: shaOf(pageUrl), verdict: 'failed', reason: `safety:${opts.hazards.join('|')}`, evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, regenCount: 0 } });
      await prisma.humanQaReviewCase.create({ data: {
        activeKey: `${id}:base_book`, orderId: id, scope: 'base_book', revision: 1, kind: 'safety' as never, status: 'open',
        holdFingerprint: shaOf(`${id}:safety`), rawReason: opts.marker, humanReason: 'safety hold', inputVersion: 0,
      } });
      await prisma.order.update({ where: { id }, data: { status: 'needs_human_qa', deliveryHoldReason: opts.marker } });
      return { pageUrl, coverUrl };
    };
    const rel = (id: string, over: Record<string, unknown> = {}) => ({
      orderId: id, anchorAllowsDelivery: true, anchorOrderStatus: 'ready', anchorReason: null,
      release: { artifactKey: 'page:1', expectedMarker: 'safety_hold:hazard:page:1:unsafe_pose', overriddenHazards: ['unsafe_pose'], assetSha256: '', overrideReason: 'child is on the floor', actor: 'op', ...over },
    });
    const ids: string[] = [];
    const cleanup = async (id: string) => {
      await prisma.humanQaOperatorAction.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.deliveryOutbox.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.bookReadinessManifest.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.bookReadiness.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.humanQaReviewCase.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.qualityEvidence.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.generationJob.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.imageAsset.deleteMany({ where: { page: { book: { orderId: id } } } }).catch(() => {});
      await prisma.bookPage.deleteMany({ where: { book: { orderId: id } } }).catch(() => {});
      await prisma.generatedBook.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.order.delete({ where: { id } }).catch(() => {});
    };

    try {
      // ── (1) HAPPY PATH: determinate hazard → release → ships ─────────────────────────────────────────────
      const idOk = `relmode-ok-${nonce}`; ids.push(idOk);
      const { pageUrl } = await seed(idOk, { hazards: ['unsafe_pose'], contentSha: shaOf(`${APP}/${idOk}/p1.png`), marker: 'safety_hold:hazard:page:1:unsafe_pose' });
      const fence0 = (await prisma.order.findUnique({ where: { id: idOk }, select: { deliveryFenceVersion: true } }))!.deliveryFenceVersion;
      const okRes = await commitBaseBookReadiness(prisma, rel(idOk, { assetSha256: shaOf(pageUrl) }) as never, deps);
      expect(okRes.orderStatus, 'the release ships to ready').toBe('ready');
      expect(okRes.enqueued, 'the Outbox is enqueued').toBe(true);
      const shipped = await prisma.order.findUnique({ where: { id: idOk }, select: { status: true, deliveryHoldReason: true, deliveryFenceVersion: true } });
      expect(shipped!.status).toBe('ready');
      expect(shipped!.deliveryHoldReason, 'the marker is cleared on ready').toBeNull();
      expect(shipped!.deliveryFenceVersion, 'the transition bumped the fence to F+1').toBe(fence0 + 1);
      const outbox = await prisma.deliveryOutbox.findFirst({ where: { orderId: idOk }, select: { deliveryFenceVersion: true } });
      expect(outbox!.deliveryFenceVersion, 'the Outbox binds the POST-transition fence F+1').toBe(fence0 + 1);
      const asset = await prisma.imageAsset.findFirst({ where: { page: { book: { orderId: idOk } } }, select: { safetyOverriddenHazards: true, safetyOverrideSha256: true, safetyHazards: true } });
      expect(asset, 'Gate-2 override written; the detector finding is NEVER deleted').toMatchObject({ safetyOverriddenHazards: ['unsafe_pose'], safetyOverrideSha256: shaOf(pageUrl), safetyHazards: ['unsafe_pose'] });
      const ev = await prisma.qualityEvidence.findUnique({ where: { orderId_artifactKey: { orderId: idOk, artifactKey: 'page:1' } }, select: { safetyOverride: true, verdict: true, reason: true } });
      expect(ev, 'Gate-1 override written; verdict/reason immutable').toMatchObject({ safetyOverride: true, verdict: 'failed', reason: 'safety:unsafe_pose' });
      const closed = await prisma.humanQaReviewCase.findUnique({ where: { activeKey: `${idOk}:base_book` } });
      expect(closed, 'the safety case is resolved (activeKey freed)').toBeNull();
      const audit = await prisma.humanQaOperatorAction.findMany({ where: { orderId: idOk } });
      expect(audit.length, 'exactly ONE release audit row (in-tx, release-only)').toBe(1);
      expect(audit[0]).toMatchObject({ kind: 'release', status: 'succeeded', assetSha256: shaOf(pageUrl), overriddenHazards: ['unsafe_pose'] });

      // ── (2) REPLAY → refused (marker now cleared/ready) — never a silent success ─────────────────────────
      await expect(commitBaseBookReadiness(prisma, rel(idOk, { assetSha256: shaOf(pageUrl) }) as never, deps))
        .rejects.toBeInstanceOf(ReleaseAdmissibilityError);

      // ── (3) UNVERIFIED marker → refused ─────────────────────────────────────────────────────────────────
      const idUnv = `relmode-unv-${nonce}`; ids.push(idUnv);
      const u = await seed(idUnv, { hazards: ['unsafe_pose'], contentSha: shaOf(`${APP}/${idUnv}/p1.png`), marker: 'safety_hold:unverified:page:1' });
      await expect(commitBaseBookReadiness(prisma, rel(idUnv, { expectedMarker: 'safety_hold:unverified:page:1', assetSha256: shaOf(u.pageUrl) }) as never, deps))
        .rejects.toMatchObject({ rule: 'marker_not_safety_hazard' });

      // ── (4) SHA_MISSING → refused ───────────────────────────────────────────────────────────────────────
      const idSm = `relmode-sm-${nonce}`; ids.push(idSm);
      const s = await seed(idSm, { hazards: ['unsafe_pose'], contentSha: null, marker: 'safety_hold:hazard:page:1:unsafe_pose' });
      await expect(commitBaseBookReadiness(prisma, rel(idSm, { assetSha256: shaOf(s.pageUrl) }) as never, deps))
        .rejects.toMatchObject({ rule: 'sha_missing' });

      // ── (5) PASSES-OUT / FAILS-IN → complete rollback (the failure-rollback ruling) ──────────────────────
      // The asset carries TWO hazards; the release overrides only one. Gate 1 (projection) passes on the override
      // flag, but the in-tx admissibility (hazards subset) fails → the whole release rolls back.
      const idPof = `relmode-pof-${nonce}`; ids.push(idPof);
      const p = await seed(idPof, { hazards: ['unsafe_pose', 'height'], contentSha: shaOf(`${APP}/${idPof}/p1.png`), marker: 'safety_hold:hazard:page:1:unsafe_pose' });
      const fenceP = (await prisma.order.findUnique({ where: { id: idPof }, select: { deliveryFenceVersion: true } }))!.deliveryFenceVersion;
      await expect(commitBaseBookReadiness(prisma, rel(idPof, { assetSha256: shaOf(p.pageUrl), overriddenHazards: ['unsafe_pose'] }) as never, deps))
        .rejects.toMatchObject({ rule: 'hazards_not_subset' });
      const afterPof = await prisma.order.findUnique({ where: { id: idPof }, select: { status: true, deliveryHoldReason: true, deliveryFenceVersion: true } });
      expect(afterPof, 'marker + status + fence intact (nothing moved)').toMatchObject({ status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:hazard:page:1:unsafe_pose', deliveryFenceVersion: fenceP });
      expect(await prisma.humanQaReviewCase.findUnique({ where: { activeKey: `${idPof}:base_book` } }), 'the safety case is STILL open').not.toBeNull();
      const pofAsset = await prisma.imageAsset.findFirst({ where: { page: { book: { orderId: idPof } } }, select: { safetyOverrideSha256: true } });
      expect(pofAsset!.safetyOverrideSha256, 'NO override was written').toBeNull();
      expect(await prisma.humanQaOperatorAction.count({ where: { orderId: idPof } }), 'NO audit row (refusal writes nothing)').toBe(0);
      expect(await prisma.deliveryOutbox.count({ where: { orderId: idPof } }), 'NO outbox row').toBe(0);

      console.log(`[RELEASE-MODE] ship✓ replay-refused✓ unverified-refused✓ sha_missing-refused✓ passes-out/fails-in-rollback✓ fence ${fence0}->${fence0 + 1}`);
    } finally {
      if (prevFlag === undefined) delete process.env.READINESS_MANIFEST_ENABLED; else process.env.READINESS_MANIFEST_ENABLED = prevFlag;
      if (prevSoft === undefined) delete process.env.QA_SOFT_DELIVER; else process.env.QA_SOFT_DELIVER = prevSoft;
      for (const id of ids) await cleanup(id);
    }
  }, 180_000);
});
