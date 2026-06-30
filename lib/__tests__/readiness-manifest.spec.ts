import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { commitBaseBookReadiness, casClaimSendSlot, bumpOrderInputVersion, isReadinessManifestEnabled, type CommitArgs } from '@/lib/generation-pipeline/readiness-manifest';
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

describe('bumpOrderInputVersion — single writer-side bump (P1-f contract)', () => {
  it('atomically increments Order.inputVersion', async () => {
    const update = vi.fn(async () => ({}));
    await bumpOrderInputVersion({ order: { update } } as never, 'o1');
    expect(update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { inputVersion: { increment: 1 } } });
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
  });

  it('PASS but anchor holds: manifest passed, NO enqueue, anchor hold preserved', async () => {
    const tx = mockTx();
    const r = await commitBaseBookReadiness(mockPrisma(tx) as never, args({ anchorAllowsDelivery: false, anchorOrderStatus: 'needs_human_qa', anchorReason: 'anchor_low_confidence:soft_band' }), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r.manifestStatus).toBe('passed');
    expect(r.enqueued).toBe(false);
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band' }) }));
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
    expect(tx.deliveryOutbox.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { dedupeKey: 'book-ready/o1/base-book/1', sendAttempted: false }, data: expect.objectContaining({ manifestId: 'm1', status: 'scheduled' }) }));
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

  it('binding holds → updates exactly 1 row → ok (renews lease + sets sendAttempted + firstSendAttemptAt via COALESCE + verifies the full binding)', async () => {
    const $executeRaw = vi.fn(async () => 1);
    const findUnique = vi.fn();
    const r = await casClaimSendSlot({ $executeRaw, deliveryOutbox: { findUnique } } as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('ok');
    const sql = (($executeRaw.mock.calls[0] as unknown[])[0] as string[]).join(' ');
    expect(sql).toMatch(/"sendAttempted" = true/);
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
  it('#3h #5: 0 rows + STILL ours but the order is NOT ready (held) → delivery_revoked (not a manifest supersession)', async () => {
    const db = diagDb({ order: { status: 'needs_human_qa' }, readiness: { status: 'passed', currentManifestId: 'm1' } });
    const r = await casClaimSendSlot(db as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('delivery_revoked');
  });
  it('#3h #5: 0 rows + STILL ours, order ready + readiness passed but currentManifestId UNCHANGED (inputs_stale, not supersession) → delivery_revoked', async () => {
    const db = diagDb({ order: { status: 'ready' }, readiness: { status: 'passed', currentManifestId: 'm1' } });
    const r = await casClaimSendSlot(db as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('delivery_revoked');
  });
  it('#3h #5: 0 rows + STILL ours, order ready + DIFFERENT currentManifestId but readiness NOT passed (blocked) → delivery_revoked (the `passed` conjunct is load-bearing)', async () => {
    const db = diagDb({ order: { status: 'ready' }, readiness: { status: 'blocked', currentManifestId: 'm2' } });
    const r = await casClaimSendSlot(db as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('delivery_revoked');
  });
  it('#3h #5: 0 rows + STILL ours, order ready but the BookReadiness row is missing (null) → delivery_revoked (not superseded)', async () => {
    const db = diagDb({ order: { status: 'ready' }, readiness: null });
    const r = await casClaimSendSlot(db as never, casRow, 1, lease, NOW_CAS);
    expect(r).toBe('delivery_revoked');
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

describe('#3h #7 — flag-on gating tripwire: the inputVersion drift guard is dormant until the #5 writer-audit', () => {
  // The send-time CAS requires Order.inputVersion === row.inputVersion. That only catches payload/gate drift once
  // EVERY writer that mutates a gate/payload input bumps Order.inputVersion in the SAME tx (the #5 writer
  // contract). Pre-#5 nothing calls bumpOrderInputVersion, so the binding is always N===N — flipping
  // READINESS_MANIFEST_ENABLED on now would ship with an UNGUARDED drift surface. This tripwire FAILS the moment
  // #5 wires the writer, forcing a conscious gate flip (update this test + the launch checklist together).
  it('chunk-runner.ts does NOT yet call bumpOrderInputVersion (drift guard unwired → flag MUST stay OFF)', () => {
    const src = readFileSync(join(process.cwd(), 'lib/generation-pipeline/chunk-runner.ts'), 'utf8');
    expect(src.includes('bumpOrderInputVersion')).toBe(false);
  });
});
