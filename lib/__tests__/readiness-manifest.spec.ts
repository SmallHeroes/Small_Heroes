import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { commitBaseBookReadiness, recheckBaseBookDelivery, markBaseBookStale, isReadinessManifestEnabled, type CommitArgs } from '@/lib/generation-pipeline/readiness-manifest';
import { evaluateBaseBookIntegrity, BASE_BOOK_SCOPE } from '@/lib/generation-pipeline/integrity-gate';
import { hashPayload } from '@/lib/generation-chunked/delivery-outbox';
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
    deliveryOutbox: { findUnique: vi.fn(async () => null), create: vi.fn() },
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

  it('B-r3-1: a terminal-dead Outbox (suppressed v1) → rolls to a fresh scheduled v2 + persists fulfillmentVersion (never ready behind a dead row)', async () => {
    const tx = mockTx();
    tx.deliveryOutbox.findUnique = vi.fn(async ({ where }: { where: { dedupeKey: string } }) =>
      where.dedupeKey === 'book-ready/o1/base-book/1' ? { status: 'suppressed', payloadHash: 'stale' } : null);
    const r = await commitBaseBookReadiness(mockPrisma(tx) as never, args(), { inspect: stubInspect, now: () => NOW, appBaseUrl: 'https://app.example.com' });
    expect(r.enqueued).toBe(true);
    expect(r.orderStatus).toBe('ready');
    expect(tx.deliveryOutbox.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dedupeKey: 'book-ready/o1/base-book/2', status: 'scheduled' }) }));
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ready', fulfillmentVersion: 2 }) }));
  });
});

describe('markBaseBookStale — send-time drift (B2)', () => {
  const mk = (invalidatedCount: number, sentCount: number) => {
    const brUpdateMany = vi.fn(async () => ({ count: invalidatedCount }));
    const orderUpdateMany = vi.fn(async () => ({ count: 1 }));
    const obxCount = vi.fn(async () => sentCount);
    const tx = { bookReadiness: { updateMany: brUpdateMany }, order: { updateMany: orderUpdateMany }, deliveryOutbox: { count: obxCount } };
    const prisma = { $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)) };
    return { prisma, brUpdateMany, orderUpdateMany, obxCount };
  };

  it('marks readiness stale (guarded to the rechecked manifest) + un-readies the order', async () => {
    const { prisma, brUpdateMany, orderUpdateMany } = mk(1, 0);
    await markBaseBookStale(prisma as never, 'o1', BASE_BOOK_SCOPE, 'm1', 'integrity_now_page2_image_invalid');
    expect(brUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orderId: 'o1', scope: BASE_BOOK_SCOPE, currentManifestId: 'm1' }, data: expect.objectContaining({ status: 'stale', reason: 'integrity_now_page2_image_invalid' }) }));
    expect(orderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'o1', status: 'ready' }, data: expect.objectContaining({ status: 'needs_human_qa', deliveryHoldReason: 'base_book_readiness_stale' }) }));
  });

  it('does NOT stomp a NEWER manifest: when the guarded update matches 0, the order is left alone', async () => {
    const { prisma, orderUpdateMany } = mk(0, 0); // a newer manifest already replaced m1
    await markBaseBookStale(prisma as never, 'o1', BASE_BOOK_SCOPE, 'm1');
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it('does NOT un-ready an order whose email already shipped (an outbox row is already `sent`)', async () => {
    const { prisma, orderUpdateMany } = mk(1, 1); // readiness invalidated, but delivery already sent
    await markBaseBookStale(prisma as never, 'o1', BASE_BOOK_SCOPE, 'm1');
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });
});

describe('recheckBaseBookDelivery — send-time guard', () => {
  const READ_URL = 'https://app.example.com/ready?orderId=o1';
  const passedInput = {
    scope: BASE_BOOK_SCOPE,
    orderId: 'o1',
    readUrl: READ_URL,
    appBaseUrl: 'https://app.example.com',
    frozen: { expectedPageCount: 2, storySourceHash: 'src', selectionFilename: 'bedtime/foo.md', frozenProductVersion: 'v3' },
    cover: { imageUrl: 'https://h/cover.png' },
    pages: [ { pageNumber: 1, imageUrl: 'https://h/p1.png', text: 'עמוד אחד' }, { pageNumber: 2, imageUrl: 'https://h/p2.png', text: 'עמוד שתיים' } ],
  };
  const orderRow = {
    id: 'o1', status: 'ready', inputVersion: 0, expectedPageCount: 2, storySourceHash: 'src', selectionFilename: 'bedtime/foo.md', frozenProductVersion: 'v3',
    customerEmail: 'c@e.com', customerName: 'Cust', childName: 'Kid',
    book: { coverImageUrl: 'https://h/cover.png', readUrl: READ_URL, pdfUrl: null, pages: [
      { pageNumber: 1, text: 'עמוד אחד', audioUrl: null, imageAsset: { url: 'https://h/p1.png', presentationUrl: null } },
      { pageNumber: 2, text: 'עמוד שתיים', audioUrl: null, imageAsset: { url: 'https://h/p2.png', presentationUrl: null } },
    ] },
  };
  // The payload the worker enqueued for this order (recompute with the SAME builder the commit uses).
  const ENQUEUED_PAYLOAD_HASH = hashPayload({ to: 'c@e.com', customerName: 'Cust', childName: 'Kid', readUrl: READ_URL, audioUrl: undefined, pdfUrl: undefined });

  it('allow when integrity still passes and inputsHash matches the current manifest', async () => {
    const fresh = await evaluateBaseBookIntegrity(passedInput, stubInspect);
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow) },
      bookReadiness: { findUnique: vi.fn(async () => ({ status: 'passed', currentManifestId: 'm1' })) },
      bookReadinessManifest: { findUnique: vi.fn(async () => ({ inputVersion: 0, inputsHash: fresh.inputsHash })) },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: stubInspect, appBaseUrl: 'https://app.example.com' });
    expect(r.outcome).toBe('allow');
  });

  it('SUPPRESS + invalidateReadiness when the assets changed since the manifest (inputsHash mismatch — real drift)', async () => {
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow) },
      bookReadiness: { findUnique: vi.fn(async () => ({ status: 'passed', currentManifestId: 'm1' })) },
      bookReadinessManifest: { findUnique: vi.fn(async () => ({ inputVersion: 0, inputsHash: 'stale-hash' })) },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: stubInspect, appBaseUrl: 'https://app.example.com' });
    expect(r.outcome).toBe('suppress');
    expect(r.reason).toBe('inputs_changed_since_manifest');
    expect(r.invalidateReadiness).toBe(true);
    expect(r.expectedManifestId).toBe('m1'); // guards markBaseBookStale to exactly this manifest
  });

  it('SUPPRESS + invalidateReadiness when a page asset is now corrupt/deleted (integrity_now_*) — B2', async () => {
    const corruptInspect = async (url: string | null | undefined) => {
      if ((url ?? '').includes('p2')) return { ok: false, bytes: 5, format: null, mime: null, width: null, height: null, sha256: null, error: 'not_decodable' as const };
      return stubInspect(url);
    };
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow) },
      bookReadiness: { findUnique: vi.fn(async () => ({ status: 'passed', currentManifestId: 'm1' })) },
      bookReadinessManifest: { findUnique: vi.fn(async () => ({ inputVersion: 0, inputsHash: 'whatever' })) },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: corruptInspect, appBaseUrl: 'https://app.example.com' });
    expect(r.outcome).toBe('suppress');
    expect(r.reason).toMatch(/^integrity_now_/);
    expect(r.invalidateReadiness).toBe(true); // a now-broken asset must drop the order from `ready`, not just suppress
    expect(r.expectedManifestId).toBe('m1');
  });

  it('RETRY (not suppress) on a TRANSIENT asset error (timeout/5xx) — B2', async () => {
    const transientInspect = async (url: string | null | undefined) => {
      if ((url ?? '').includes('p2')) return { ok: false, bytes: 0, format: null, mime: null, width: null, height: null, sha256: null, error: 'timeout' as const };
      return stubInspect(url);
    };
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow) },
      bookReadiness: { findUnique: vi.fn(async () => ({ status: 'passed', currentManifestId: 'm1' })) },
      bookReadinessManifest: { findUnique: vi.fn(async () => ({ inputVersion: 0, inputsHash: 'whatever' })) },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: transientInspect });
    expect(r.outcome).toBe('retry');
  });

  it('SUPPRESS (allowlist) when the order is re-held — only `ready` may send', async () => {
    const prisma = {
      order: { findUnique: vi.fn(async () => ({ ...orderRow, status: 'needs_human_qa' })) },
      bookReadiness: { findUnique: vi.fn() },
      bookReadinessManifest: { findUnique: vi.fn() },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: stubInspect, appBaseUrl: 'https://app.example.com' });
    expect(r.outcome).toBe('suppress');
    expect(r.reason).toBe('order_not_ready:needs_human_qa');
  });

  it('SUPPRESS (allowlist, fail-closed) when the order is still `generating` (not a held status) — B3', async () => {
    const prisma = {
      order: { findUnique: vi.fn(async () => ({ ...orderRow, status: 'generating' })) },
      bookReadiness: { findUnique: vi.fn() },
      bookReadinessManifest: { findUnique: vi.fn() },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: stubInspect, appBaseUrl: 'https://app.example.com' });
    expect(r.outcome).toBe('suppress');
    expect(r.reason).toBe('order_not_ready:generating'); // the blacklist would have let this through
  });

  it('SUPPRESS when readiness is not passed', async () => {
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow) },
      bookReadiness: { findUnique: vi.fn(async () => ({ status: 'blocked', currentManifestId: null })) },
      bookReadinessManifest: { findUnique: vi.fn() },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: stubInspect, appBaseUrl: 'https://app.example.com' });
    expect(r.outcome).toBe('suppress');
    expect(r.reason).toBe('readiness_not_passed');
  });

  it('SUPPRESS + invalidateReadiness when Order.inputVersion moved past the manifest (B4 optimistic concurrency)', async () => {
    const prisma = {
      order: { findUnique: vi.fn(async () => ({ ...orderRow, inputVersion: 1 })) }, // a writer bumped it
      bookReadiness: { findUnique: vi.fn(async () => ({ status: 'passed', currentManifestId: 'm1' })) },
      bookReadinessManifest: { findUnique: vi.fn(async () => ({ inputVersion: 0, inputsHash: 'whatever' })) },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: stubInspect, appBaseUrl: 'https://app.example.com' }, ENQUEUED_PAYLOAD_HASH);
    expect(r.outcome).toBe('suppress');
    expect(r.reason).toBe('inputs_changed_since_manifest');
    expect(r.invalidateReadiness).toBe(true);
    expect(r.expectedManifestId).toBe('m1');
  });

  it('ALLOW when the live payload still hashes to what was enqueued (B4 payload binding)', async () => {
    const fresh = await evaluateBaseBookIntegrity(passedInput, stubInspect);
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow) },
      bookReadiness: { findUnique: vi.fn(async () => ({ status: 'passed', currentManifestId: 'm1' })) },
      bookReadinessManifest: { findUnique: vi.fn(async () => ({ inputVersion: 0, inputsHash: fresh.inputsHash })) },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: stubInspect, appBaseUrl: 'https://app.example.com' }, ENQUEUED_PAYLOAD_HASH);
    expect(r.outcome).toBe('allow');
  });

  it('SUPPRESS (payload_changed_since_enqueue) when a payload field drifted since enqueue — B4', async () => {
    const fresh = await evaluateBaseBookIntegrity(passedInput, stubInspect);
    const prisma = {
      order: { findUnique: vi.fn(async () => ({ ...orderRow, customerEmail: 'CHANGED@e.com' })) }, // email changed after enqueue
      bookReadiness: { findUnique: vi.fn(async () => ({ status: 'passed', currentManifestId: 'm1' })) },
      bookReadinessManifest: { findUnique: vi.fn(async () => ({ inputVersion: 0, inputsHash: fresh.inputsHash })) },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: stubInspect, appBaseUrl: 'https://app.example.com' }, ENQUEUED_PAYLOAD_HASH);
    expect(r.outcome).toBe('suppress');
    expect(r.reason).toBe('payload_changed_since_enqueue');
    expect(r.invalidateReadiness).toBe(true);
  });
});
