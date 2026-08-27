import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { computeVisualContractHash } from '@/lib/visual-contract-compiler/contractHash';
import {
  commitBaseBookReadiness,
  casClaimSendSlot,
  isReadinessManifestEnabled,
  withDeliveryInputMutation,
  type CommitArgs,
} from '@/lib/generation-pipeline/readiness-manifest';
import { BASE_BOOK_SCOPE } from '@/lib/generation-pipeline/integrity-gate';
import type { AssetInspection } from '@/lib/generation-pipeline/asset-integrity';
import { QUALITY_EVALUATOR_CONTRACT_VERSION, QUALITY_REGEN_BUDGET } from '@/lib/generation-pipeline/quality-evidence';

const NOW = new Date('2026-06-29T12:00:00Z');
const stubInspect = async (url: string | null | undefined): Promise<AssetInspection> => {
  const u = (url ?? '').trim();
  if (!u) return { ok: false, bytes: 0, format: null, mime: null, width: null, height: null, sha256: null, error: 'url_not_allowlisted' };
  if (u.includes('bad')) return { ok: false, bytes: 1, format: null, mime: null, width: null, height: null, sha256: createHash('sha256').update(u).digest('hex'), error: 'not_decodable' };
  return { ok: true, bytes: 2048, format: 'png', mime: 'image/png', width: 800, height: 1200, sha256: createHash('sha256').update(u).digest('hex') };
};

// COMMIT_SELECT-shaped order row (loadCommitInputs reads it both out-of-tx and in-tx).
const orderRowFull = {
  id: 'o1', fulfillmentVersion: 1, inputVersion: 0, deliveryFenceVersion: 0, expectedPageCount: 2, storySourceHash: 'src', selectionFilename: 'bedtime/foo.md', frozenProductVersion: 'v3',
  visualPackageAuthority: null,
  illustrationStyle: 'pencil_watercolor',
  customerEmail: 'c@e.com', customerName: 'Cust', childName: 'Kid',
  book: { coverImageUrl: 'https://h/cover.png', readUrl: 'https://app.example.com/ready?orderId=o1', pdfUrl: null, pages: [
    { pageNumber: 1, text: 'עמוד אחד', audioUrl: null, imageAsset: { url: 'https://h/p1.png', presentationUrl: null } },
    { pageNumber: 2, text: 'עמוד שתיים', audioUrl: null, imageAsset: { url: 'https://h/p2.png', presentationUrl: null } },
  ] },
};
const badPageRow = { ...orderRowFull, book: { ...orderRowFull.book, pages: [orderRowFull.book.pages[0], { ...orderRowFull.book.pages[1], imageAsset: { url: 'https://h/p2-bad.png', presentationUrl: null } }] } };

function validPackageAuthority(sourcePath: string, sourceRawDigest: string) {
  return {
    version: 'frozen-visual-package-authority/v3',
    manifestVersion: 'visual-package/v5',
    storyKey: 'readiness_fixture',
    styleId: 'soft_hand_drawn_storybook',
    packagePath:
      `visual-packages/approved/readiness_fixture/soft_hand_drawn_storybook/revisions/${'c'.repeat(64)}.visual-package.json`,
    packageRevisionDigest: 'c'.repeat(64),
    sourcePath,
    sourceDigest: 'd'.repeat(64),
    sourceRawDigest,
    blueprintDigest: 'e'.repeat(64),
    authoringAuthorityDigest: 'f'.repeat(64),
    planningApprovalDigest: '1'.repeat(64),
    styleAuthorityDigest: '2'.repeat(64),
    visualContractTemplateDigest: '3'.repeat(64),
    reconciliationDigest: '4'.repeat(64),
    layoutPolicyVersion: 'portrait-layout-compatibility/v1',
  };
}

// (#7-a) Passing durable Quality evidence for an order: the delivered-bytes hash (presentationUrl ?? url)
// must equal what the integrity gate's inspect computes (stubInspect hashes the same url), else the gate
// blocks on a hash mismatch — exactly the anti-bypass we want, so tests seed matching hashes.
const shaOf = (u: string | null | undefined) => createHash('sha256').update((u ?? '').trim()).digest('hex');
type QRow = { artifactKey: string; assetSha256: string; verdict: string; evaluatorContractVersion: string; reason: string | null; regenCount: number; contractHash: string | null };
function passingQualityRows(orderRow: typeof orderRowFull): QRow[] {
  // Evidence rows bind the contract they were validated under; for a package-bound order that is the
  // Order's active stamp (else contract_stale → evidence_unknown blocks — exactly the anti-mix gate).
  const contractHash = (orderRow as { visualContractHash?: string | null }).visualContractHash ?? null;
  const rows: QRow[] = [
    { artifactKey: 'cover', assetSha256: shaOf(orderRow.book.coverImageUrl), verdict: 'passed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, reason: null, regenCount: 0, contractHash },
  ];
  for (const p of orderRow.book.pages) {
    const delivered = p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null;
    rows.push({ artifactKey: `page:${p.pageNumber}`, assetSha256: shaOf(delivered), verdict: 'passed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, reason: null, regenCount: 0, contractHash });
  }
  return rows;
}

const args = (over: Partial<CommitArgs> = {}): CommitArgs => ({ orderId: 'o1', anchorAllowsDelivery: true, anchorOrderStatus: 'ready', anchorReason: null, ...over });

function mockTx(orderRow: unknown = orderRowFull) {
  return {
    order: { findUnique: vi.fn(async () => orderRow), updateMany: vi.fn(async () => ({ count: 1 })) },
    bookReadinessManifest: { findFirst: vi.fn(async () => ({ revision: 4 })), create: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'm1', ...a.data })) },
    bookReadiness: { upsert: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) },
    exceptionCase: {
      upsert: vi.fn(async (a: { create: Record<string, unknown> }) => ({
        id: 'ec1',
        ...a.create,
      })),
      findUnique: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    exceptionCaseAudit: {
      createMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async () => ({})),
    },
    deliveryOutbox: { findUnique: vi.fn(async () => null), create: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) },
    generationJob: { update: vi.fn() },
    qualityEvidence: { findMany: vi.fn(async () => passingQualityRows(orderRow as typeof orderRowFull)) },
    // (Human-QA Slice 1) no-op stubs for the ADDITIVE review-case writes recordHumanQaHoldInTx /
    // resolveHumanQaCaseOnReleaseInTx make in-tx. No active case (findUnique→null), first revision (findFirst→null),
    // and the raw ON CONFLICT inserts return one row (created). The DECISION assertions on tx.order.updateMany are
    // unchanged — these stubs only let the additive path run; they assert nothing about the hold decision.
    humanQaReviewCase: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    operatorNotificationOutbox: { findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    // $queryRaw serves the atomic-receipt INSERT…RETURNING id AND writeOrderHoldFenced's SELECT (fence/rank/status/
    // inputVersion) — one shape carrying every key each reader needs. (delivery fence round-5)
    $queryRaw: vi.fn(async () => [{ id: 'hqc-test', fence: 0, rank: 1, status: 'generating', inputVersion: 0 }]),
    // (delivery fence — Codex round-4/5) both the `ready` ship CAS and the HOLD write (via writeOrderHoldFenced) are
    // raw $executeRaw; default = 1 row applied. A test simulating a competing hold overrides this to 0. (Mocked SQL
    // cannot express the WHERE — the real fence/CAS/precedence semantics are proven by delivery-fence.pg.spec.ts.)
    $executeRaw: vi.fn(async () => 1),
  };
}
const mockPrisma = (tx: ReturnType<typeof mockTx>, orderRow: unknown = orderRowFull) =>
  ({ order: { findUnique: vi.fn(async () => orderRow) }, qualityEvidence: { findMany: vi.fn(async () => passingQualityRows(orderRow as typeof orderRowFull)) }, $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)) });

// A commit harness with custom Quality evidence rows (same rows out-of-tx and in-tx so the TOCTOU fingerprint matches).
function mockWithQuality(qualityRows: QRow[], orderRow: typeof orderRowFull = orderRowFull) {
  const tx = mockTx(orderRow);
  tx.qualityEvidence.findMany = vi.fn(async () => qualityRows);
  const prisma = { order: { findUnique: vi.fn(async () => orderRow) }, qualityEvidence: { findMany: vi.fn(async () => qualityRows) }, $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)) };
  return { tx, prisma };
}

describe('commitBaseBookReadiness — authorized-release precondition (re-gate round-3 P0)', () => {
  const inspectOk = { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' };

  // NOTE (delivery fence — Codex round-4): the ship CAS is now a raw $executeRaw whose WHERE (fence + marker +
  // manualReviewRequired + active-strong-case + requireHold) cannot be asserted through a mock. These tests pin the
  // ORCHESTRATION (which branch runs, retry vs abort, error type); the actual CAS/interleave semantics are proven by
  // the real-PG harness (lib/__tests__/delivery-fence.pg.spec.ts).

  it('normal ship (no requireHold) → runs the raw ship CAS ($executeRaw), NOT the hold updateMany, → ready', async () => {
    const tx = mockTx();
    const r = await commitBaseBookReadiness(mockPrisma(tx) as never, args(), inspectOk);
    expect(r.orderStatus).toBe('ready');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1); // the guarded ship CAS
    expect(tx.order.updateMany).not.toHaveBeenCalled(); // ready path never uses the plain updateMany
  });

  it('requireHold set → still ships via the raw CAS → ready', async () => {
    const tx = mockTx();
    const r = await commitBaseBookReadiness(
      mockPrisma(tx) as never,
      args({ requireHold: { deliveryHoldReason: 'anchor_low_confidence:soft_band' } }),
      inspectOk,
    );
    expect(r.orderStatus).toBe('ready');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('requireHold + ship CAS matches 0 rows, inputVersion UNCHANGED (a hold landed) → ReleasePreconditionError, NOT retried', async () => {
    const tx = mockTx();
    tx.$executeRaw = vi.fn(async () => 0); // the fence/marker guard rejected the ship
    // findUnique serves the in-tx fingerprint load (1st, must match out-of-tx → no TOCTOU) THEN the distinguishing
    // read (2nd, inputVersion still 0 → precondition failure, not a drift).
    tx.order.findUnique = vi.fn()
      .mockResolvedValueOnce(orderRowFull)
      .mockResolvedValueOnce({ inputVersion: 0, deliveryFenceVersion: 1, status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:hazard:page:2', manualReviewRequired: false });
    await expect(
      commitBaseBookReadiness(
        mockPrisma(tx) as never,
        args({ requireHold: { deliveryHoldReason: 'anchor_low_confidence:soft_band' } }),
        inspectOk,
      ),
    ).rejects.toMatchObject({ name: 'ReleasePreconditionError', expectedHoldReason: 'anchor_low_confidence:soft_band' });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1); // no retry for a precondition failure
  });

  it('NORMAL ship CAS matches 0 rows, inputVersion UNCHANGED (a competing hold landed) → HELD CommitResult, not shipped, NOT retried', async () => {
    const tx = mockTx();
    tx.$executeRaw = vi.fn(async () => 0);
    tx.order.findUnique = vi.fn()
      .mockResolvedValueOnce(orderRowFull)
      .mockResolvedValueOnce({ inputVersion: 0, deliveryFenceVersion: 1, status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:hazard', manualReviewRequired: false });
    const r = await commitBaseBookReadiness(mockPrisma(tx) as never, args(), inspectOk);
    expect(r).toMatchObject({ enqueued: false, manifestStatus: 'blocked', orderStatus: 'needs_human_qa' });
    expect(r.reason).toContain('safety_hold'); // reflects the hold that won
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1); // never retried into a ship
  });

  it('ship CAS 0 rows with inputVersion CHANGED → TOCTOU retry (reload + re-eval), then ships', async () => {
    const tx = mockTx();
    tx.$executeRaw = vi.fn().mockResolvedValueOnce(0).mockResolvedValue(1); // attempt 1 blocked, attempt 2 ships
    // 1st findUnique = in-tx load (matches, no fingerprint drift); 2nd = distinguishing read with a CHANGED
    // inputVersion → genuine input drift → retry; 3rd+ = the attempt-2 in-tx load.
    tx.order.findUnique = vi.fn()
      .mockResolvedValueOnce(orderRowFull)
      .mockResolvedValueOnce({ ...orderRowFull, inputVersion: 99 })
      .mockResolvedValue(orderRowFull);
    const r = await commitBaseBookReadiness(mockPrisma(tx) as never, args(), inspectOk);
    expect(r.orderStatus).toBe('ready');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2); // aborted once (TOCTOU), committed on retry
  });
});

describe('isReadinessManifestEnabled', () => {
  let prev: string | undefined;
  beforeEach(() => { prev = process.env.READINESS_MANIFEST_ENABLED; });
  afterEach(() => { if (prev === undefined) delete process.env.READINESS_MANIFEST_ENABLED; else process.env.READINESS_MANIFEST_ENABLED = prev; });
  it('is false unless explicitly "true"', () => {
    process.env.READINESS_MANIFEST_ENABLED = '';
    expect(isReadinessManifestEnabled()).toBe(false);
    process.env.READINESS_MANIFEST_ENABLED = 'true';
    expect(isReadinessManifestEnabled()).toBe(true);
  });
});

describe('withDeliveryInputMutation — atomic writer barrier (P1-f #5)', () => {
  let previousFlag: string | undefined;
  beforeEach(() => { previousFlag = process.env.READINESS_MANIFEST_ENABLED; });
  afterEach(() => {
    if (previousFlag === undefined) delete process.env.READINESS_MANIFEST_ENABLED;
    else process.env.READINESS_MANIFEST_ENABLED = previousFlag;
  });

  function barrierDb(
    rows: Array<{ inputVersion: number; status: string; previousStatus: string }> = [
      { inputVersion: 8, status: 'generating', previousStatus: 'ready' },
    ],
  ) {
    const tx = {
      bookReadiness: { updateMany: vi.fn(async () => ({ count: 1 })) },
      generationJob: { update: vi.fn(async () => ({ orderId: 'o1' })) },
      $queryRaw: vi.fn(async () => rows),
      imageAsset: { update: vi.fn(async () => ({ id: 'asset-1' })) },
    };
    const db = {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    return { db, tx };
  }

  it('flag-on co-locates mutation + readiness stale + inputVersion/ready transition in one transaction', async () => {
    process.env.READINESS_MANIFEST_ENABLED = 'true';
    const { db, tx } = barrierDb();
    const result = await withDeliveryInputMutation(
      db as never,
      { orderId: 'o1', reason: 'page_asset_changed' },
      async (transaction) => { await transaction.imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'new' } }); },
    );
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.imageAsset.update).toHaveBeenCalledTimes(1);
    expect(tx.bookReadiness.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'o1', scope: BASE_BOOK_SCOPE, status: { in: ['passed', 'blocked'] } },
      data: { status: 'stale', reason: 'inputs_changed:page_asset_changed' },
    });
    const sql = ((tx.$queryRaw.mock.calls[0] as unknown[])[0] as string[]).join(' ');
    expect(sql).toMatch(/"inputVersion" = "inputVersion" \+ 1/);
    expect(sql).toMatch(/'ready'::"OrderStatus"/);
    expect(sql).toMatch(/'generating'::"OrderStatus"/);
    expect(sql).toMatch(/"packageStatus"[\s\S]*'pending'::"GenerationStatus"/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(tx.generationJob.update).toHaveBeenCalledWith({
      where: { orderId: 'o1' },
      data: expect.objectContaining({
        status: 'pending',
        currentStage: 'package',
        packaged: false,
        triggerReason: 'delivery_input_changed:page_asset_changed',
      }),
    });
    expect(result).toMatchObject({ inputVersion: 8, orderStatus: 'generating', readinessInvalidated: true });
  });

  it('flag-off still versions the mutation but preserves legacy readiness/status behavior', async () => {
    delete process.env.READINESS_MANIFEST_ENABLED;
    const { db, tx } = barrierDb([{ inputVersion: 3, status: 'ready', previousStatus: 'ready' }]);
    const result = await withDeliveryInputMutation(
      db as never,
      { orderId: 'o1', reason: 'page_asset_changed' },
      async (transaction) => { await transaction.imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'new' } }); },
    );
    expect(tx.bookReadiness.updateMany).not.toHaveBeenCalled();
    expect(tx.generationJob.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ inputVersion: 3, orderStatus: 'ready', readinessInvalidated: false });
  });

  it('atomically re-drives cleared page assets from page_images, not package', async () => {
    process.env.READINESS_MANIFEST_ENABLED = 'true';
    const { db, tx } = barrierDb();
    await withDeliveryInputMutation(
      db as never,
      { orderId: 'o1', reason: 'page_assets_cleared' },
      async (transaction) => { await transaction.imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'new' } }); },
    );
    expect(tx.generationJob.update).toHaveBeenCalledWith({
      where: { orderId: 'o1' },
      data: expect.objectContaining({
        status: 'pending',
        currentStage: 'page_images',
        imagesDone: false,
        packaged: false,
        completedPageNumbers: [],
        failedPageNumbers: [],
        pageAttempts: {},
      }),
    });
  });

  it('does not reset the job when the order was already generating', async () => {
    process.env.READINESS_MANIFEST_ENABLED = 'true';
    const { db, tx } = barrierDb([
      { inputVersion: 8, status: 'generating', previousStatus: 'generating' },
    ]);
    await withDeliveryInputMutation(
      db as never,
      { orderId: 'o1', reason: 'page_asset_changed' },
      async (transaction) => { await transaction.imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'new' } }); },
    );
    expect(tx.generationJob.update).not.toHaveBeenCalled();
  });

  it('frozen-truth mismatch aborts the writer transaction instead of accepting a changed story', async () => {
    process.env.READINESS_MANIFEST_ENABLED = 'true';
    const { db, tx } = barrierDb([]);
    await expect(withDeliveryInputMutation(
      db as never,
      {
        orderId: 'o1',
        reason: 'story_text_finalized',
        frozenTruth: {
          expectedPageCount: 12,
          storySourceHash: 'hash',
          selectionFilename: 'story-bank/v3-approved/story.md',
          frozenProductVersion: 'story-product/v1:adventure',
        },
      },
      async (transaction) => { await transaction.imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'new' } }); },
    )).rejects.toThrow('frozen_product_truth_mismatch');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('does not advance version/readiness when the content mutation throws', async () => {
    process.env.READINESS_MANIFEST_ENABLED = 'true';
    const { db, tx } = barrierDb();
    await expect(withDeliveryInputMutation(
      db as never,
      { orderId: 'o1', reason: 'page_asset_changed' },
      async () => { throw new Error('write_failed'); },
    )).rejects.toThrow('write_failed');
    expect(tx.bookReadiness.updateMany).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('commitBaseBookReadiness — load-fresh + in-tx fingerprint + branches', () => {
  it('hard-holds an accepted-revision Order with missing package authority before asset inspection', async () => {
    const packageOrder = {
      ...orderRowFull,
      selectionFilename:
        'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/' +
        `revisions/${'a'.repeat(64)}/integrated.md`,
      storySourceHash: 'b'.repeat(64),
      visualPackageAuthority: null,
    };
    const tx = mockTx(packageOrder);
    const inspect = vi.fn(stubInspect);

    const result = await commitBaseBookReadiness(
      mockPrisma(tx, packageOrder) as never,
      args(),
      { inspect, now: () => NOW, appBaseUrl: 'https://app.example.com' },
    );

    expect(result).toMatchObject({
      manifestStatus: 'blocked',
      enqueued: false,
      orderStatus: 'needs_human_qa',
      reason:
        'contract_world_hold:visual_package_authority_invalid',
    });
    expect(inspect).not.toHaveBeenCalled();
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
    expect(tx.exceptionCase.upsert).not.toHaveBeenCalled();
  });

  it.each([
    [
      'aliased ./ accepted reference with null authority',
      (selectionFilename: string, storySourceHash: string) => ({
        selectionFilename: `./${selectionFilename}`,
        storySourceHash,
        visualPackageAuthority: null,
      }),
    ],
    [
      'doubled-separator accepted reference with null authority',
      (selectionFilename: string, storySourceHash: string) => ({
        selectionFilename: selectionFilename.replace(
          'story-pipeline/',
          'story-pipeline//',
        ),
        storySourceHash,
        visualPackageAuthority: null,
      }),
    ],
    [
      'malformed authority envelope',
      (selectionFilename: string, storySourceHash: string) => ({
        selectionFilename,
        storySourceHash,
        visualPackageAuthority: {
          ...validPackageAuthority(selectionFilename, storySourceHash),
          hostileExtraKey: 'x',
        },
      }),
    ],
    [
      'source digest mismatch',
      (selectionFilename: string, storySourceHash: string) => ({
        selectionFilename,
        storySourceHash,
        visualPackageAuthority: {
          ...validPackageAuthority(selectionFilename, storySourceHash),
          sourceRawDigest: '9'.repeat(64),
        },
      }),
    ],
    [
      'story mismatch',
      (selectionFilename: string, storySourceHash: string) => ({
        selectionFilename,
        storySourceHash,
        visualPackageAuthority: {
          ...validPackageAuthority(selectionFilename, storySourceHash),
          storyKey: 'another_story',
        },
      }),
    ],
    [
      'style mismatch',
      (selectionFilename: string, storySourceHash: string) => ({
        selectionFilename,
        storySourceHash,
        illustrationStyle: 'detailed_whimsical_world',
        visualPackageAuthority: validPackageAuthority(
          selectionFilename,
          storySourceHash,
        ),
      }),
    ],
    [
      'aliased package path inside the authority envelope',
      (selectionFilename: string, storySourceHash: string) => ({
        selectionFilename,
        storySourceHash,
        visualPackageAuthority: {
          ...validPackageAuthority(selectionFilename, storySourceHash),
          packagePath: `./${
            validPackageAuthority(selectionFilename, storySourceHash)
              .packagePath
          }`,
        },
      }),
    ],
    [
      'legacy Story Source carrying package authority (origin mix)',
      (selectionFilename: string, storySourceHash: string) => ({
        selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
        storySourceHash,
        visualPackageAuthority: validPackageAuthority(
          selectionFilename,
          storySourceHash,
        ),
      }),
    ],
  ])(
    'hard-holds %s even with QA soft delivery enabled — no inspection, no Outbox, no soft deliver',
    async (_label, mutate) => {
      vi.stubEnv('QA_SOFT_DELIVER', 'true');
      vi.stubEnv('VERCEL_ENV', 'preview');
      try {
        const selectionFilename =
          'story-pipeline/04_approved_story_sources/accepted/readiness_fixture/' +
          `revisions/${'a'.repeat(64)}/integrated.md`;
        const storySourceHash = 'b'.repeat(64);
        const packageOrder = {
          ...orderRowFull,
          ...mutate(selectionFilename, storySourceHash),
        };
        const tx = mockTx(packageOrder);
        const inspect = vi.fn(stubInspect);

        const result = await commitBaseBookReadiness(
          mockPrisma(tx, packageOrder) as never,
          args(),
          { inspect, now: () => NOW, appBaseUrl: 'https://app.example.com' },
        );

        expect(result).toMatchObject({
          manifestStatus: 'blocked',
          enqueued: false,
          orderStatus: 'needs_human_qa',
          reason: 'contract_world_hold:visual_package_authority_invalid',
        });
        expect(inspect).not.toHaveBeenCalled();
        expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
        expect(tx.exceptionCase.upsert).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it('genuine legacy Order with null authority keeps the ordinary readiness path under QA soft delivery', async () => {
    vi.stubEnv('QA_SOFT_DELIVER', 'true');
    vi.stubEnv('VERCEL_ENV', 'preview');
    try {
      const tx = mockTx();
      const inspect = vi.fn(stubInspect);
      const result = await commitBaseBookReadiness(
        mockPrisma(tx) as never,
        args(),
        { inspect, now: () => NOW, appBaseUrl: 'https://app.example.com' },
      );
      expect(result).toMatchObject({
        manifestStatus: 'passed',
        enqueued: true,
        orderStatus: 'ready',
      });
      expect(inspect).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('continues through ordinary integrity and delivery for an exact package-bound Order', async () => {
    const selectionFilename =
      'story-pipeline/04_approved_story_sources/accepted/readiness_fixture/' +
      `revisions/${'a'.repeat(64)}/integrated.md`;
    const storySourceHash = 'b'.repeat(64);
    const authority = validPackageAuthority(selectionFilename, storySourceHash);
    const producingContract = {
      schemaVersion: 'fixture-contract/v1',
      approvedRuntimeAuthority: {
        packageRevisionDigest: authority.packageRevisionDigest,
      },
    };
    const packageOrder = {
      ...orderRowFull,
      selectionFilename,
      storySourceHash,
      visualPackageAuthority: authority,
      visualContractHash: computeVisualContractHash(
        producingContract as never,
      ),
      generationJob: {
        pipelineCache: {
          visualPackageAuthority: authority,
          visualContract: producingContract,
        },
      },
    };
    const tx = mockTx(packageOrder);
    const inspect = vi.fn(stubInspect);

    const result = await commitBaseBookReadiness(
      mockPrisma(tx, packageOrder) as never,
      args(),
      { inspect, now: () => NOW, appBaseUrl: 'https://app.example.com' },
    );

    expect(result).toMatchObject({
      manifestStatus: 'passed',
      enqueued: true,
      orderStatus: 'ready',
    });
    expect(inspect).toHaveBeenCalledTimes(3);
    expect(tx.deliveryOutbox.create).toHaveBeenCalledTimes(1);
  });

  it('A→B ADVERSARIAL (readiness-ON parity): fresh self-consistent Package B never authorizes a payload produced under Package A', async () => {
    const selectionFilename =
      'story-pipeline/04_approved_story_sources/accepted/readiness_fixture/' +
      `revisions/${'a'.repeat(64)}/integrated.md`;
    const storySourceHash = 'b'.repeat(64);
    const authorityA = validPackageAuthority(selectionFilename, storySourceHash);
    const authorityB = {
      ...authorityA,
      packagePath:
        `visual-packages/approved/readiness_fixture/soft_hand_drawn_storybook/revisions/${'9'.repeat(64)}.visual-package.json`,
      packageRevisionDigest: '9'.repeat(64),
    };
    const producingContractA = {
      schemaVersion: 'fixture-contract/v1',
      approvedRuntimeAuthority: {
        packageRevisionDigest: authorityA.packageRevisionDigest,
      },
    };
    const packageOrder = {
      ...orderRowFull,
      selectionFilename,
      storySourceHash,
      // Fresh row: internally valid under B. Producing snapshot: authority A + contract A.
      visualPackageAuthority: authorityB,
      visualContractHash: computeVisualContractHash(
        producingContractA as never,
      ),
      generationJob: {
        pipelineCache: {
          visualPackageAuthority: authorityA,
          visualContract: producingContractA,
        },
      },
    };
    const tx = mockTx(packageOrder);
    const inspect = vi.fn(stubInspect);

    const result = await commitBaseBookReadiness(
      mockPrisma(tx, packageOrder) as never,
      args(),
      { inspect, now: () => NOW, appBaseUrl: 'https://app.example.com' },
    );

    expect(result).toMatchObject({
      manifestStatus: 'blocked',
      enqueued: false,
      orderStatus: 'needs_human_qa',
      reason: 'contract_world_hold:visual_package_authority_invalid',
    });
    expect(inspect).not.toHaveBeenCalled();
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
  });

  it('A→LEGACY laundering (readiness-ON): fresh legacy row over a package-produced snapshot → blocked before inspection', async () => {
    const authorityA = validPackageAuthority(
      'story-pipeline/04_approved_story_sources/accepted/readiness_fixture/' +
        `revisions/${'a'.repeat(64)}/integrated.md`,
      'b'.repeat(64),
    );
    const packageProducedLegacyRow = {
      ...orderRowFull, // legacy selectionFilename + null authority
      visualPackageAuthority: null,
      generationJob: {
        pipelineCache: {
          visualPackageAuthority: authorityA,
          visualContract: {
            schemaVersion: 'fixture-contract/v1',
            approvedRuntimeAuthority: {
              packageRevisionDigest: authorityA.packageRevisionDigest,
            },
          },
        },
      },
    };
    const tx = mockTx(packageProducedLegacyRow);
    const inspect = vi.fn(stubInspect);

    const result = await commitBaseBookReadiness(
      mockPrisma(tx, packageProducedLegacyRow) as never,
      args(),
      { inspect, now: () => NOW, appBaseUrl: 'https://app.example.com' },
    );

    expect(result).toMatchObject({
      manifestStatus: 'blocked',
      enqueued: false,
      orderStatus: 'needs_human_qa',
      reason: 'contract_world_hold:visual_package_authority_invalid',
    });
    expect(inspect).not.toHaveBeenCalled();
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
  });

  it('(Codex round-4 MAJOR 4) caller-origin leg: package-shaped CALLER claim over a genuinely legacy fresh row → blocked before inspection', async () => {
    // The fresh row + producing snapshot are genuinely legacy — the commit itself would pass — but
    // the delivery caller declared its snapshot package-shaped: the frozen truth was re-pointed
    // after the caller loaded it. Same marker family as the readiness-OFF caller leg, evaluated
    // INSIDE the commit (the fresh in-tx read decides), zero enqueue, zero inspection.
    const tx = mockTx();
    const inspect = vi.fn(stubInspect);
    const result = await commitBaseBookReadiness(
      mockPrisma(tx) as never,
      args({ callerVisualPackageClaim: true }),
      { inspect, now: () => NOW, appBaseUrl: 'https://app.example.com' },
    );
    expect(result).toMatchObject({
      manifestStatus: 'blocked',
      enqueued: false,
      orderStatus: 'needs_human_qa',
      reason: 'contract_world_hold:delivery_snapshot_binding_invalid',
    });
    expect(inspect).not.toHaveBeenCalled();
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();

    // Genuine-legacy positive control: with the claim false/omitted the identical row still ships.
    const tx2 = mockTx();
    const shipped = await commitBaseBookReadiness(
      mockPrisma(tx2) as never,
      args(),
      { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' },
    );
    expect(shipped).toMatchObject({ manifestStatus: 'passed', orderStatus: 'ready', enqueued: true });
  });

  it('treats an eval→commit producing-cache mutation as TOCTOU drift (abort + fresh re-eval)', async () => {
    // Out-of-tx eval sees a clean legacy row; the first in-tx reload sees a
    // mutated producing cache → fingerprint drift → whole-tx retry → second
    // reload sees the original row again → passes. Mirrors the existing
    // authority-drift TOCTOU test, now for the producing snapshot itself.
    const driftedCache = {
      ...orderRowFull,
      generationJob: {
        pipelineCache: { visualContract: { schemaVersion: 'drifted/v1' } },
      },
    };
    const tx = mockTx();
    tx.order.findUnique = vi
      .fn()
      .mockResolvedValueOnce(driftedCache)
      .mockResolvedValue(orderRowFull);
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRowFull) },
      qualityEvidence: {
        findMany: vi.fn(async () => passingQualityRows(orderRowFull)),
      },
      $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    };

    const result = await commitBaseBookReadiness(
      prisma as never,
      args(),
      { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' },
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(result.manifestStatus).toBe('passed');
  });

  it('hard-holds a package-backed Order whose producing pipeline snapshot is missing (readiness-ON)', async () => {
    const selectionFilename =
      'story-pipeline/04_approved_story_sources/accepted/readiness_fixture/' +
      `revisions/${'a'.repeat(64)}/integrated.md`;
    const storySourceHash = 'b'.repeat(64);
    const packageOrder = {
      ...orderRowFull,
      selectionFilename,
      storySourceHash,
      visualPackageAuthority: validPackageAuthority(
        selectionFilename,
        storySourceHash,
      ),
      generationJob: null,
    };
    const tx = mockTx(packageOrder);
    const inspect = vi.fn(stubInspect);

    const result = await commitBaseBookReadiness(
      mockPrisma(tx, packageOrder) as never,
      args(),
      { inspect, now: () => NOW, appBaseUrl: 'https://app.example.com' },
    );

    expect(result).toMatchObject({
      manifestStatus: 'blocked',
      enqueued: false,
      orderStatus: 'needs_human_qa',
      reason: 'contract_world_hold:visual_package_authority_invalid',
    });
    expect(inspect).not.toHaveBeenCalled();
  });

  it('PASS + anchor allows: one immutable manifest INSERT, enqueue, order ready, job done', async () => {
    const tx = mockTx();
    const r = await commitBaseBookReadiness(mockPrisma(tx) as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r).toMatchObject({ manifestStatus: 'passed', enqueued: true, orderStatus: 'ready', revision: 5 });
    expect(tx.bookReadinessManifest.create).toHaveBeenCalledTimes(1); // single terminal INSERT
    expect(tx.bookReadinessManifest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'passed', revision: 5 }) }));
    expect(tx.bookReadiness.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: 'passed', currentManifestId: 'm1' }) }));
    expect(tx.deliveryOutbox.create).toHaveBeenCalledTimes(1); // enqueue inside the same tx
    // (delivery fence — Codex round-4) the `ready` transition is now the guarded raw ship CAS ($executeRaw), never
    // the plain updateMany. The CAS WHERE (fence + marker + case guards) is proven in the real-PG harness.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.generationJob.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ packaged: true, status: 'done' }) }));
  });

  it('BLOCK (bad page): manifest blocked, NO enqueue, order held + reason', async () => {
    const tx = mockTx(badPageRow);
    const r = await commitBaseBookReadiness(mockPrisma(tx, badPageRow) as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r.manifestStatus).toBe('blocked');
    expect(r.enqueued).toBe(false);
    expect(tx.bookReadinessManifest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'blocked' }) }));
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
    // (delivery fence round-5) the HOLD write is now writeOrderHoldFenced ($executeRaw + precedence), not updateMany.
    expect(r.orderStatus).toBe('needs_human_qa');
    expect(r.reason).toContain('base_book_integrity:');
    expect(tx.exceptionCase.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        kind: 'integrity_blocked',
        status: 'retry_scheduled',
        sourceRef: 'readiness:m1',
      }),
    }));
  });

  it('#7-a: quality FAILED after budget → BLOCKED manifest + quality_failed(refund_pending), NO enqueue', async () => {
    const rows = passingQualityRows(orderRowFull).map((r) =>
      r.artifactKey === 'page:2' ? { ...r, verdict: 'failed', regenCount: QUALITY_REGEN_BUDGET, reason: 'anatomy_failed' } : r);
    const { tx, prisma } = mockWithQuality(rows);
    const r = await commitBaseBookReadiness(prisma as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r.manifestStatus).toBe('blocked');
    expect(r.enqueued).toBe(false);
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
    expect(tx.bookReadinessManifest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'blocked' }) }));
    expect(tx.exceptionCase.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ kind: 'quality_failed', status: 'refund_pending' }),
    }));
    expect(r.orderStatus).toBe('needs_human_qa'); // held via writeOrderHoldFenced (round-5)
  });

  it('#7-a: quality evidence_unknown (a missing required artifact) → BLOCKED + infra_transient recovery, NO enqueue', async () => {
    const rows = passingQualityRows(orderRowFull).filter((r) => r.artifactKey !== 'page:2');
    const { tx, prisma } = mockWithQuality(rows);
    const r = await commitBaseBookReadiness(prisma as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r.manifestStatus).toBe('blocked');
    expect(r.enqueued).toBe(false);
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
    expect(tx.exceptionCase.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ kind: 'infra_transient', status: 'retry_scheduled' }),
    }));
  });

  it('#7-a anti-bypass: a passing row whose assetSha256 != the delivered bytes → BLOCKED (a swapped image never ships)', async () => {
    const rows = passingQualityRows(orderRowFull).map((r) => (r.artifactKey === 'page:2' ? { ...r, assetSha256: 'STALE_HASH' } : r));
    const { tx, prisma } = mockWithQuality(rows);
    const r = await commitBaseBookReadiness(prisma as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r.manifestStatus).toBe('blocked');
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
    expect(tx.exceptionCase.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ kind: 'infra_transient' }) }));
  });

  it('#7-a anti-bypass: an old evaluatorContractVersion is stale → BLOCKED even with verdict=passed', async () => {
    const rows = passingQualityRows(orderRowFull).map((r) => (r.artifactKey === 'cover' ? { ...r, evaluatorContractVersion: 'qa-v0' } : r));
    const { tx, prisma } = mockWithQuality(rows);
    const r = await commitBaseBookReadiness(prisma as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r.manifestStatus).toBe('blocked');
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
  });

  it('#7-a: with NO quality evidence at all → BLOCKED (no assume-passed default), NO enqueue', async () => {
    const { tx, prisma } = mockWithQuality([]);
    const r = await commitBaseBookReadiness(prisma as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r.manifestStatus).toBe('blocked');
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
  });

  it('validator-only timeout/5xx BLOCK opens infra_transient rather than a deterministic integrity case', async () => {
    const tx = mockTx();
    const transientInspect = vi.fn(async (): Promise<AssetInspection> => ({
      ok: false,
      bytes: 0,
      format: null,
      mime: null,
      width: null,
      height: null,
      sha256: null,
      error: 'timeout',
    }));
    const r = await commitBaseBookReadiness(
      mockPrisma(tx) as never,
      args(),
      { inspect: transientInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' },
    );
    expect(r.manifestStatus).toBe('blocked');
    expect(tx.exceptionCase.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ kind: 'infra_transient' }),
    }));
  });

  it('PASS but anchor holds: manifest passed, NO enqueue, anchor hold preserved', async () => {
    const tx = mockTx();
    const r = await commitBaseBookReadiness(mockPrisma(tx) as never, args({ anchorAllowsDelivery: false, anchorOrderStatus: 'needs_human_qa', anchorReason: 'anchor_low_confidence:soft_band' }), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r.manifestStatus).toBe('passed');
    expect(r.enqueued).toBe(false);
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
    expect(r.orderStatus).toBe('needs_human_qa'); // anchor hold preserved via writeOrderHoldFenced (round-5)
    expect(r.reason).toBe('anchor_low_confidence:soft_band');
  });

  it('never enqueues a newly-passing book while a refund obligation is active', async () => {
    const tx = mockTx();
    tx.exceptionCase.findUnique.mockResolvedValue({
      id: 'ec_refund',
      kind: 'integrity_blocked',
      status: 'refund_pending',
      actionAttemptedAt: NOW,
      notificationAttemptedAt: null,
    } as never);

    const r = await commitBaseBookReadiness(
      mockPrisma(tx) as never,
      args(),
      { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' },
    );

    expect(r.enqueued).toBe(false);
    expect(r.orderStatus).toBe('failed');
    expect(r.reason).toBe('exception_case:integrity_blocked:refund_pending');
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
  });

  it('aborts + retries on in-tx fingerprint drift (TOCTOU), then commits on fresh re-eval', async () => {
    const drifted = { ...orderRowFull, book: { ...orderRowFull.book, coverImageUrl: 'https://h/cover-CHANGED.png' } };
    const tx = mockTx();
    tx.order.findUnique = vi.fn().mockResolvedValueOnce(drifted).mockResolvedValue(orderRowFull); // drift on the first tx, stable after
    const prisma = { order: { findUnique: vi.fn(async () => orderRowFull) }, qualityEvidence: { findMany: vi.fn(async () => passingQualityRows(orderRowFull)) }, $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)) };
    const r = await commitBaseBookReadiness(prisma as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2); // aborted on drift, re-evaluated fresh, then committed
    expect(r.manifestStatus).toBe('passed');
  });

  it('treats a Visual Package authority change as delivery-input TOCTOU drift', async () => {
    const drifted = {
      ...orderRowFull,
      visualPackageAuthority: {
        version: 'hostile-authority-substitution',
        packageRevisionDigest: 'a'.repeat(64),
      },
    };
    const tx = mockTx();
    tx.order.findUnique = vi
      .fn()
      .mockResolvedValueOnce(drifted)
      .mockResolvedValue(orderRowFull);
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRowFull) },
      qualityEvidence: {
        findMany: vi.fn(async () => passingQualityRows(orderRowFull)),
      },
      $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    };

    const result = await commitBaseBookReadiness(
      prisma as never,
      args(),
      {
        inspect: stubInspect,
        now: () => NOW,
        appBaseUrl: 'https://app.example.com',
      },
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(result.manifestStatus).toBe('passed');
  });

  it('retries the whole transaction on a revision collision (P2002)', async () => {
    const tx = mockTx();
    const $transaction = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))
      .mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));
    const prisma = { order: { findUnique: vi.fn(async () => orderRowFull) }, qualityEvidence: { findMany: vi.fn(async () => passingQualityRows(orderRowFull)) }, $transaction };
    const r = await commitBaseBookReadiness(prisma as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect($transaction).toHaveBeenCalledTimes(2);
    expect(r.manifestStatus).toBe('passed');
  });

  it('B4: aborts the ship when a writer bumped inputVersion (ship CAS matches 0), then retries fresh', async () => {
    const tx = mockTx();
    // The ready ship CAS ($executeRaw) binds inputVersion = evaluated. A concurrent bump makes it match 0; the
    // distinguishing read shows a CHANGED inputVersion → genuine input drift → TOCTOU retry; the next attempt commits.
    tx.$executeRaw = vi.fn().mockResolvedValueOnce(0).mockResolvedValue(1);
    tx.order.findUnique = vi.fn().mockResolvedValueOnce(orderRowFull).mockResolvedValueOnce({ ...orderRowFull, inputVersion: 7 }).mockResolvedValue(orderRowFull);
    const r = await commitBaseBookReadiness(mockPrisma(tx) as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2); // attempt 1 aborted on count 0 (drift), attempt 2 committed
    expect(r.manifestStatus).toBe('passed');
    expect(r.enqueued).toBe(true);
  });

  it('#3h #1: a re-commit over a recoverable Outbox row (sendAttempted=false, old manifest) REBINDS it in place — same dedupeKey, no roll, no fulfillmentVersion change', async () => {
    const tx = mockTx();
    tx.deliveryOutbox.findUnique = vi.fn(async ({ where }: { where: { dedupeKey: string } }) =>
      where.dedupeKey === 'book-ready/o1/base-book/1' ? { manifestId: 'm_old', status: 'scheduled', sendAttempted: false, payloadHash: 'stale' } : null);
    const r = await commitBaseBookReadiness(mockPrisma(tx) as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r.enqueued).toBe(true);
    expect(r.orderStatus).toBe('ready');
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
    expect(tx.deliveryOutbox.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ dedupeKey: 'book-ready/o1/base-book/1', sendAttempted: false }), data: expect.objectContaining({ manifestId: 'm1', status: 'scheduled' }) }));
    // (delivery fence — Codex round-4) the ready transition is the raw ship CAS ($executeRaw); its SET touches only
    // status/packageStatus/deliveryHoldReason — never fulfillmentVersion — so the delivery intent is inherently stable.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });
});

describe('casClaimSendSlot — single atomic send-time CAS (P1-f #3h)', () => {
  const casRow = { id: 'ob1', orderId: 'o1', scope: BASE_BOOK_SCOPE, manifestId: 'm1', inputVersion: 0, payloadHash: 'ph' };
  const lease = new Date('2026-06-29T10:10:00Z');
  const NOW_CAS = new Date('2026-06-29T10:05:00Z');
  // db for the 0-row diagnostic path: own-row re-read + order + readiness (classify superseded_by_manifest vs revoked).
  const diagDb = (over: { cur?: unknown; order?: unknown; readiness?: unknown }) => ({
    $executeRaw: vi.fn(async () => 0),
    deliveryOutbox: { findUnique: vi.fn(async () => ('cur' in over ? over.cur : { status: 'processing', attempts: 1 })) },
    order: { findUnique: vi.fn(async () => over.order ?? null) },
    bookReadiness: { findUnique: vi.fn(async () => over.readiness ?? null) },
  });

  it('binding holds → updates exactly 1 row → ok (renews lease + records the provider attempt + verifies the full binding)', async () => {
    const $executeRaw = vi.fn(async () => 1);
    const findUnique = vi.fn();
    const r = await casClaimSendSlot({ $executeRaw, deliveryOutbox: { findUnique } } as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('ok');
    const sql = (($executeRaw.mock.calls[0] as unknown[])[0] as string[]).join(' ');
    expect(sql).toMatch(/"sendAttempted" = true/);
    expect(sql).toMatch(/"sendAttempts" = o\."sendAttempts" \+ 1/);
    expect(sql).toMatch(/"firstSendAttemptAt" = COALESCE/); // set ONCE, on the first attempt (#3h)
    expect(sql).toMatch(/"status" = 'processing'/);
    // the four outer-WHERE bindings that guarantee fencing + drift safety (dropping any is a real regression)
    expect(sql).toMatch(/"attempts" = /); // fencing token
    expect(sql).toMatch(/"payloadHash" = /);
    expect(sql).toMatch(/"manifestId" = /);
    expect(sql).toMatch(/"inputVersion" = /);
    expect(sql).toMatch(/"Order"[\s\S]*'ready'/);
    expect(sql).toMatch(/"BookReadiness"[\s\S]*'passed'/);
    expect(sql).toMatch(/"currentManifestId"/);
    expect(findUnique).not.toHaveBeenCalled(); // a hit needs no re-read
  });
  it('#3h #5: 0 rows + STILL ours + a newer VALID manifest owns the order (ready + passed, different currentManifestId) → superseded_by_manifest', async () => {
    const db = diagDb({ order: { status: 'ready' }, readiness: { status: 'passed', currentManifestId: 'm2' } });
    const r = await casClaimSendSlot(db as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('superseded_by_manifest');
  });
  it('#3h-D: 0 rows + STILL ours but the order is NOT ready (a TRANSIENT held state) → delivery_blocked (recoverable, NEVER a business revocation)', async () => {
    const db = diagDb({ order: { status: 'needs_human_qa' }, readiness: { status: 'passed', currentManifestId: 'm1' } });
    const r = await casClaimSendSlot(db as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('delivery_blocked');
  });
  it('#3h-D: 0 rows + STILL ours, a `partial` order (customer-visible elsewhere) is still TRANSIENT → delivery_blocked, not revoked', async () => {
    const db = diagDb({ order: { status: 'partial' }, readiness: { status: 'passed', currentManifestId: 'm1' } });
    const r = await casClaimSendSlot(db as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('delivery_blocked');
  });
  it('#3h-D: 0 rows + STILL ours, order ready + readiness passed but currentManifestId UNCHANGED (inputs_stale, not supersession) → delivery_blocked', async () => {
    const db = diagDb({ order: { status: 'ready' }, readiness: { status: 'passed', currentManifestId: 'm1' } });
    const r = await casClaimSendSlot(db as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('delivery_blocked');
  });
  it('#3h-D: 0 rows + STILL ours, order ready + DIFFERENT currentManifestId but readiness NOT passed (blocked) → delivery_blocked (the `passed` conjunct is load-bearing)', async () => {
    const db = diagDb({ order: { status: 'ready' }, readiness: { status: 'blocked', currentManifestId: 'm2' } });
    const r = await casClaimSendSlot(db as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('delivery_blocked');
  });
  it('#3h-D: 0 rows + STILL ours, order ready but the BookReadiness row is missing (null) → delivery_blocked (not superseded)', async () => {
    const db = diagDb({ order: { status: 'ready' }, readiness: null });
    const r = await casClaimSendSlot(db as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('delivery_blocked');
  });
  it('0 rows + the row is no longer ours (status moved off processing) → lost_lease (no order/readiness read)', async () => {
    const db = diagDb({ cur: { status: 'scheduled', attempts: 2 } });
    const r = await casClaimSendSlot(db as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('lost_lease');
    expect(db.order.findUnique).not.toHaveBeenCalled();
  });
  it('0 rows + the token advanced (reclaimed) → lost_lease', async () => {
    const db = diagDb({ cur: { status: 'processing', attempts: 2 } });
    const r = await casClaimSendSlot(db as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('lost_lease');
  });
  it('0 rows + the row vanished → lost_lease', async () => {
    const db = diagDb({ cur: null });
    const r = await casClaimSendSlot(db as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('lost_lease');
  });
});

describe('QA soft-deliver (QA_SOFT_DELIVER=true, non-prod)', () => {
  const envSaved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ['QA_SOFT_DELIVER', 'VERCEL_ENV'] as const) envSaved[k] = process.env[k];
    process.env.QA_SOFT_DELIVER = 'true';
    process.env.VERCEL_ENV = 'preview';
  });
  afterEach(() => {
    for (const k of ['QA_SOFT_DELIVER', 'VERCEL_ENV'] as const) {
      if (envSaved[k] === undefined) delete process.env[k];
      else process.env[k] = envSaved[k];
    }
  });

  it('quality_evidence_unknown → ready + enqueue with qaWarnings; blocked manifest audit; no exception case', async () => {
    const rows = passingQualityRows(orderRowFull).filter((r) => r.artifactKey !== 'page:2');
    const { tx, prisma } = mockWithQuality(rows);
    const r = await commitBaseBookReadiness(prisma as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r.manifestStatus).toBe('blocked');
    expect(r.enqueued).toBe(true);
    expect(r.orderStatus).toBe('ready');
    expect(tx.exceptionCase.upsert).not.toHaveBeenCalled();
    expect(tx.bookReadinessManifest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'blocked' }),
    }));
    expect(tx.bookReadiness.updateMany).toHaveBeenCalled();
    expect(tx.deliveryOutbox.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        payload: expect.objectContaining({
          qaWarnings: expect.objectContaining({
            wouldHaveReason: expect.stringContaining('quality_evidence_unknown'),
          }),
        }),
      }),
    }));
  });

  it('anchor hold + passing readiness → ready + enqueue with anchor qaWarnings', async () => {
    const tx = mockTx();
    const r = await commitBaseBookReadiness(
      mockPrisma(tx) as never,
      args({
        anchorAllowsDelivery: false,
        anchorOrderStatus: 'needs_human_qa',
        anchorReason: 'anchor_low_confidence:hard_band',
        anchorLowConfidence: { reason: 'hard_band', score: 0.147 },
      }),
      { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' },
    );
    expect(r.manifestStatus).toBe('passed');
    expect(r.enqueued).toBe(true);
    expect(r.orderStatus).toBe('ready');
    expect(tx.deliveryOutbox.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        payload: expect.objectContaining({
          qaWarnings: expect.objectContaining({
            anchor: expect.objectContaining({ score: 0.147, band: 'hard_band' }),
          }),
        }),
      }),
    }));
  });
});

describe('#5 writer wiring tripwire', () => {
  it('chunk-runner routes delivery-input writes through the transactional barrier', () => {
    const src = readFileSync(join(process.cwd(), 'lib/generation-pipeline/chunk-runner.ts'), 'utf8');
    expect(src.includes('withDeliveryInputMutation')).toBe(true);
    expect(src.includes('finalizePackageDelivery')).toBe(true);
  });
});
