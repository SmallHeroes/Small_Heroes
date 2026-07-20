import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { canAccessStagingQa } from '@/lib/runtime-env';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';

/**
 * (Human-QA release, shape C — the §9 live proof) REAL Postgres, no renders. Exercises the Gate-2 override mechanism
 * end-to-end against the actual columns + the 20260724 CHECK constraint:
 *   1. DB CHECK — a malformed SHA on any safety-SHA column is REJECTED by Postgres (the last line of defense).
 *   2. WRITER (shape C) — phase-1 (imageAssetSafetyFields, content SHA null) then phase-2 (bindPageSafetySha) yields
 *      the SHA-bound signal on the real row (override reset). Same for the "unverified WITH a SHA" regen lifecycle.
 *   3. Gate 2 HONORS a byte-bound override — a confirmed hazard holds; an override bound to the current
 *      safetyContentSha256 clears it (the readiness-INDEPENDENT gate passes). This is the release mechanism.
 *   4. UNVERIFIED → refused — you cannot override ignorance: an unverified asset holds regardless of any override.
 *   5. MISSED phase-2 → observable — a hazard with a null content SHA holds AND surfaces as `sha_missing` (not a
 *      silent hold, and NOT releasable).
 *   6. BYTE CHANGE voids a stale override — re-writing the signal (new bytes) resets the override → Gate 2 re-holds.
 *
 * The FULL ship (both gates → ready + Outbox) additionally needs the Gate-1 evidence override branch + the release
 * action body — a SEPARATE unit. This proves everything Units 0+1 deliver: the writer, the DB floor, and Gate 2.
 *
 * HOW TO RUN (staging session pooler, like the sibling *.staging.spec.ts — needs 20260723 + 20260724 applied):
 *   VERCEL_ENV=preview ALLOW_STAGING_QA=true RUN_RELEASE_OVERRIDE_PROOF=true \
 *     DATABASE_URL='postgresql://...session-pooler...:5432/postgres' \
 *     npx vitest run lib/generation-pipeline/__tests__/release-override-gate.staging.spec.ts
 */
const RUN = process.env.RUN_RELEASE_OVERRIDE_PROOF === 'true' && canAccessStagingQa();
const shaOf = (u: string) => createHash('sha256').update(u).digest('hex');

describe.skipIf(!RUN)('(release shape C) Gate-2 override mechanism + DB floor — real Postgres', () => {
  it('DB CHECK · writer phase-1→2 · Gate-2 honor · unverified-refused · sha_missing · byte-change voids override', async () => {
    assertEnvSeparation(); // refuses to proceed if ANY prod resource is configured

    const { prisma } = await import('@/lib/prisma'); // lazy: a skipped run never connects
    const { imageAssetSafetyFields, coverSafetyFields } = await import('@/lib/generation-pipeline/asset-safety-signal');
    const { bindPageSafetySha } = await import('@/lib/generation-pipeline/asset-safety-writer');
    const { resolveSafetyDeliveryGate } = await import('@/lib/generation-pipeline/package-delivery');

    const id = `reloverride-${process.env.RELEASE_OVERRIDE_NONCE ?? 'a'}-${Date.now()}`;
    const APP = 'https://app.example.invalid';
    const coverUrl = `${APP}/cover.png`;
    const hazUrl = `${APP}/hazard.png`;
    const hazSha = shaOf(hazUrl);
    const hazSha2 = shaOf(`${hazUrl}?v2`); // "new bytes" for the byte-change step

    const assetOfPage = async (n: number) => {
      const book = await prisma.generatedBook.findUnique({ where: { orderId: id }, select: { pages: { where: { pageNumber: n }, select: { imageAsset: { select: {
        safetyVerified: true, safetyHazards: true, safetyContentSha256: true, safetyOverriddenHazards: true, safetyOverrideSha256: true,
      } } } } } });
      return book!.pages[0].imageAsset!;
    };

    try {
      // ── seed: a book whose COVER is clear (verified + SHA-bound), page 1 = a hazard, page 2 = unverified ──
      await prisma.order.create({ data: {
        id, status: 'generating', customerEmail: `${id}@example.invalid`, customerName: 'T', childName: 'Kid', topic: 'reloverride',
        basePrice: 0, addonsPrice: 0, totalPrice: 0, inputVersion: 0,
        expectedPageCount: 2, storySourceHash: 'src', selectionFilename: 'bedtime/x.md', frozenProductVersion: 'v3', coverImageUrl: coverUrl,
        book: { create: { title: 'R', coverImageUrl: coverUrl, readUrl: `${APP}/ready?orderId=${id}`,
          ...coverSafetyFields({ verified: true, hazards: [], contentSha256: shaOf(coverUrl) }),
          pages: { create: [{ pageNumber: 1, text: 'עמוד' }, { pageNumber: 2, text: 'עמוד' }] } } },
      } });
      const book = await prisma.generatedBook.findUnique({ where: { orderId: id }, select: { pages: { orderBy: { pageNumber: 'asc' }, select: { id: true, pageNumber: true } } } });
      const page1Id = book!.pages.find((p) => p.pageNumber === 1)!.id;
      const page2Id = book!.pages.find((p) => p.pageNumber === 2)!.id;

      // page 1: a confirmed hazard, phase-1 (SHA null) then phase-2 bind — the WRITER's shape-C output
      await prisma.imageAsset.create({ data: { pageId: page1Id, provider: 'stub', prompt: 'x', url: hazUrl, style: 'style-01',
        ...imageAssetSafetyFields({ verified: true, hazards: ['child_on_railing'], contentSha256: null }) } });
      // page 2: the "unverified WITH a SHA" regen lifecycle — verified:false, hazards:[], phase-2 binds a SHA
      const p2Url = `${APP}/p2.png`;
      await prisma.imageAsset.create({ data: { pageId: page2Id, provider: 'stub', prompt: 'x', url: p2Url, style: 'style-01',
        ...imageAssetSafetyFields({ verified: false, hazards: [], contentSha256: null }) } });

      // ── (1) DB CHECK rejects a malformed SHA on the real column ──────────────────────────────────────────
      await expect(
        prisma.imageAsset.update({ where: { pageId: page1Id }, data: { safetyContentSha256: 'NOT_A_VALID_SHA' } }),
        'the 20260724 CHECK must reject a non-hex SHA',
      ).rejects.toThrow();
      await expect(
        prisma.imageAsset.update({ where: { pageId: page1Id }, data: { safetyContentSha256: 'A'.repeat(64) } }),
        'uppercase hex is rejected too',
      ).rejects.toThrow();

      // ── (5) MISSED phase-2: before we bind page 1, its content SHA is null → held + surfaced sha_missing ──
      const preBindGate = await resolveSafetyDeliveryGate(prisma as never, id);
      expect(preBindGate.held, 'a null-SHA hazard holds').toBe(true);
      expect(preBindGate.reason, 'and is surfaced as sha_missing (not releasable)').toBe('safety_hold:hazard:page:1:sha_missing');

      // ── (2) WRITER phase-2: bind page 1's SHA (CAS on the delivered url) ─────────────────────────────────
      const bind1 = await bindPageSafetySha(prisma, { pageId: page1Id, deliveredUrl: hazUrl, presentationApplied: false, sha256: hazSha });
      expect(bind1, 'phase-2 binds the inspected SHA').toEqual({ bound: true });
      const bind2 = await bindPageSafetySha(prisma, { pageId: page2Id, deliveredUrl: p2Url, presentationApplied: false, sha256: shaOf(p2Url) });
      expect(bind2.bound, 'the regen page binds its SHA too (unverified WITH a SHA)').toBe(true);
      const a1 = await assetOfPage(1);
      expect(a1, 'page 1 is now hazard-with-SHA, override reset').toMatchObject({
        safetyVerified: true, safetyHazards: ['child_on_railing'], safetyContentSha256: hazSha, safetyOverriddenHazards: [], safetyOverrideSha256: null,
      });
      const a2 = await assetOfPage(2);
      expect(a2, 'page 2 is unverified WITH a SHA').toMatchObject({ safetyVerified: false, safetyHazards: [], safetyContentSha256: shaOf(p2Url) });

      // now page 1 holds as an ORDINARY (releasable) hazard, page 2 as unverified
      const boundGate = await resolveSafetyDeliveryGate(prisma as never, id);
      expect(boundGate.held).toBe(true);
      expect(boundGate.reason, 'hazard is reported over unverified').toContain('safety_hold:hazard:page:1:child_on_railing');
      expect(boundGate.reason, 'no sha_missing now — the SHA is bound').not.toContain('sha_missing');

      // ── (3) Gate-2 HONORS an override bound to the current bytes (the release mechanism) ─────────────────
      await prisma.imageAsset.update({ where: { pageId: page1Id }, data: { safetyOverriddenHazards: ['child_on_railing'], safetyOverrideSha256: hazSha } });
      // page 2 (unverified) would still hold; overriding it to test (4) must NOT clear it. Release only page 1.
      const releasedGate = await resolveSafetyDeliveryGate(prisma as never, id);
      // page 1's hazard is cleared; page 2 is still unverified → the book still holds, but NOT for page 1's hazard
      expect(releasedGate.reason ?? '', 'page 1 hazard cleared by the byte-bound override').not.toContain('page:1');
      // isolate page 1: mark page 2 verified-safe with a SHA so ONLY page 1's override decides the gate
      await prisma.imageAsset.update({ where: { pageId: page2Id }, data: { ...imageAssetSafetyFields({ verified: true, hazards: [], contentSha256: shaOf(p2Url) }) } });
      const onlyPage1 = await resolveSafetyDeliveryGate(prisma as never, id);
      expect(onlyPage1, 'with page 2 clear, the byte-bound override on page 1 makes Gate 2 PASS').toEqual({ held: false, reason: null });

      // ── (4) UNVERIFIED → refused: put page 2 back to unverified and try to "override" it — ignorance is not overridable ──
      await prisma.imageAsset.update({ where: { pageId: page2Id }, data: {
        ...imageAssetSafetyFields({ verified: false, hazards: [], contentSha256: shaOf(p2Url) }),
        // a bogus override (no hazards to cover) must not deliver an unverified asset
        safetyOverriddenHazards: ['anything'], safetyOverrideSha256: shaOf(p2Url),
      } });
      const unverGate = await resolveSafetyDeliveryGate(prisma as never, id);
      expect(unverGate.held, 'an unverified asset holds regardless of an override').toBe(true);
      expect(unverGate.reason).toContain('safety_hold:unverified:page:2');

      // ── (6) BYTE CHANGE voids a stale override — re-write page 1's signal (new bytes) then bind SHA2 ──────
      await prisma.imageAsset.update({ where: { pageId: page1Id }, data: {
        url: `${hazUrl}?v2`, // "new bytes" at a new url
        ...imageAssetSafetyFields({ verified: true, hazards: ['child_on_railing'], contentSha256: null }), // resets the override
      } });
      const afterReset = await assetOfPage(1);
      expect(afterReset, 'the single writer reset the stale override on new bytes').toMatchObject({ safetyOverriddenHazards: [], safetyOverrideSha256: null, safetyContentSha256: null });
      await bindPageSafetySha(prisma, { pageId: page1Id, deliveredUrl: `${hazUrl}?v2`, presentationApplied: false, sha256: hazSha2 });
      const reheld = await resolveSafetyDeliveryGate(prisma as never, id);
      expect(reheld.held, 'the new bytes carry NO override → Gate 2 re-holds').toBe(true);
      expect(reheld.reason).toContain('safety_hold:hazard:page:1:child_on_railing');

      console.log(`[RELEASE-OVERRIDE] DB-CHECK✓  writer✓  gate2-honor✓  unverified-refused✓  sha_missing✓  byte-change-void✓  (hazSha=${hazSha.slice(0, 12)}…)`);
    } finally {
      await prisma.qualityEvidence.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.imageAsset.deleteMany({ where: { page: { book: { orderId: id } } } }).catch(() => {});
      await prisma.bookPage.deleteMany({ where: { book: { orderId: id } } }).catch(() => {});
      await prisma.generatedBook.deleteMany({ where: { orderId: id } }).catch(() => {});
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
  }, 120_000);
});
