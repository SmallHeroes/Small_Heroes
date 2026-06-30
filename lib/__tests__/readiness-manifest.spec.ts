import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  commitBaseBookReadiness,
  casClaimSendSlot,
  isReadinessManifestEnabled,
  withDeliveryInputMutation,
  type CommitArgs,
} from '@/lib/generation-pipeline/readiness-manifest';
import { BASE_BOOK_SCOPE } from '@/lib/generation-pipeline/integrity-gate';
import type { AssetInspection } from '@/lib/generation-pipeline/asset-integrity';

const NOW = new Date('2026-06-29T12:00:00Z');
const stubInspect = async (url: string | null | undefined): Promise<AssetInspection> => {
  const u = (url ?? '').trim();
  if (!u) return { ok: false, bytes: 0, format: null, mime: null, width: null, height: null, sha256: null, error: 'url_not_allowlisted' };
  if (u.includes('bad')) return { ok: false, bytes: 1, format: null, mime: null, width: null, height: null, sha256: createHash('sha256').update(u).digest('hex'), error: 'not_decodable' };
  return { ok: true, bytes: 2048, format: 'png', mime: 'image/png', width: 800, height: 1200, sha256: createHash('sha256').update(u).digest('hex') };
};

// COMMIT_SELECT-shaped order row (loadCommitInputs reads it both out-of-tx and in-tx).
const orderRowFull = {
  id: 'o1', fulfillmentVersion: 1, inputVersion: 0, expectedPageCount: 2, storySourceHash: 'src', selectionFilename: 'bedtime/foo.md', frozenProductVersion: 'v3',
  customerEmail: 'c@e.com', customerName: 'Cust', childName: 'Kid',
  book: { coverImageUrl: 'https://h/cover.png', readUrl: 'https://app.example.com/ready?orderId=o1', pdfUrl: null, pages: [
    { pageNumber: 1, text: 'עמוד אחד', audioUrl: null, imageAsset: { url: 'https://h/p1.png', presentationUrl: null } },
    { pageNumber: 2, text: 'עמוד שתיים', audioUrl: null, imageAsset: { url: 'https://h/p2.png', presentationUrl: null } },
  ] },
};
const badPageRow = { ...orderRowFull, book: { ...orderRowFull.book, pages: [orderRowFull.book.pages[0], { ...orderRowFull.book.pages[1], imageAsset: { url: 'https://h/p2-bad.png', presentationUrl: null } }] } };

const args = (over: Partial<CommitArgs> = {}): CommitArgs => ({ orderId: 'o1', anchorAllowsDelivery: true, anchorOrderStatus: 'ready', anchorReason: null, ...over });

function mockTx(orderRow: unknown = orderRowFull) {
  return {
    order: { findUnique: vi.fn(async () => orderRow), updateMany: vi.fn(async () => ({ count: 1 })) },
    bookReadinessManifest: { findFirst: vi.fn(async () => ({ revision: 4 })), create: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'm1', ...a.data })) },
    bookReadiness: { upsert: vi.fn() },
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
  };
}
const mockPrisma = (tx: ReturnType<typeof mockTx>, orderRow: unknown = orderRowFull) =>
  ({ order: { findUnique: vi.fn(async () => orderRow) }, $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)) });

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
      (transaction) => transaction.imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'new' } }),
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
      (transaction) => transaction.imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'new' } }),
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
      (transaction) => transaction.imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'new' } }),
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
      (transaction) => transaction.imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'new' } }),
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
      (transaction) => transaction.imageAsset.update({ where: { id: 'asset-1' }, data: { url: 'new' } }),
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
  it('PASS + anchor allows: one immutable manifest INSERT, enqueue, order ready, job done', async () => {
    const tx = mockTx();
    const r = await commitBaseBookReadiness(mockPrisma(tx) as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r).toMatchObject({ manifestStatus: 'passed', enqueued: true, orderStatus: 'ready', revision: 5 });
    expect(tx.bookReadinessManifest.create).toHaveBeenCalledTimes(1); // single terminal INSERT
    expect(tx.bookReadinessManifest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'passed', revision: 5 }) }));
    expect(tx.bookReadiness.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: 'passed', currentManifestId: 'm1' }) }));
    expect(tx.deliveryOutbox.create).toHaveBeenCalledTimes(1); // enqueue inside the same tx
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'o1', inputVersion: 0 }, data: expect.objectContaining({ status: 'ready', packageStatus: 'done', deliveryHoldReason: null }) }));
    expect(tx.generationJob.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ packaged: true, status: 'done' }) }));
  });

  it('BLOCK (bad page): manifest blocked, NO enqueue, order held + reason', async () => {
    const tx = mockTx(badPageRow);
    const r = await commitBaseBookReadiness(mockPrisma(tx, badPageRow) as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r.manifestStatus).toBe('blocked');
    expect(r.enqueued).toBe(false);
    expect(tx.bookReadinessManifest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'blocked' }) }));
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'needs_human_qa', deliveryHoldReason: expect.stringContaining('base_book_integrity:') }) }));
    expect(tx.exceptionCase.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        kind: 'integrity_blocked',
        status: 'retry_scheduled',
        sourceRef: 'readiness:m1',
      }),
    }));
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
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band' }) }));
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
    const prisma = { order: { findUnique: vi.fn(async () => orderRowFull) }, $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)) };
    const r = await commitBaseBookReadiness(prisma as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2); // aborted on drift, re-evaluated fresh, then committed
    expect(r.manifestStatus).toBe('passed');
  });

  it('retries the whole transaction on a revision collision (P2002)', async () => {
    const tx = mockTx();
    const $transaction = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))
      .mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));
    const prisma = { order: { findUnique: vi.fn(async () => orderRowFull) }, $transaction };
    const r = await commitBaseBookReadiness(prisma as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect($transaction).toHaveBeenCalledTimes(2);
    expect(r.manifestStatus).toBe('passed');
  });

  it('B4: aborts the commit when a writer bumped inputVersion (conditional write matches 0), then retries fresh', async () => {
    const tx = mockTx();
    // The Order→ready write is `updateMany where inputVersion = evaluated`. A concurrent bump makes it match 0
    // → the tx aborts as a TOCTOU drift; the next attempt finds it clear and commits.
    tx.order.updateMany = vi.fn().mockResolvedValueOnce({ count: 0 }).mockResolvedValue({ count: 1 });
    const r = await commitBaseBookReadiness(mockPrisma(tx) as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(tx.order.updateMany).toHaveBeenCalledTimes(2); // attempt 1 aborted on count 0, attempt 2 committed
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
    const orderData = ((tx.order.updateMany.mock.calls[0] as unknown[])[0] as { data: Record<string, unknown> }).data;
    expect(orderData).toMatchObject({ status: 'ready' });
    expect(orderData.fulfillmentVersion).toBeUndefined(); // delivery-intent stable → no roll persisted
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

describe('#5 writer wiring tripwire', () => {
  it('chunk-runner routes delivery-input writes through the transactional barrier', () => {
    const src = readFileSync(join(process.cwd(), 'lib/generation-pipeline/chunk-runner.ts'), 'utf8');
    expect(src.includes('withDeliveryInputMutation')).toBe(true);
    expect(src.includes('finalizePackageDelivery')).toBe(true);
  });
});
