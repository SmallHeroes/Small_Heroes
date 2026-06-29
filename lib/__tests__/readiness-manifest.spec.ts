import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { commitBaseBookReadiness, recheckBaseBookDelivery, isReadinessManifestEnabled, type CommitArgs } from '@/lib/generation-pipeline/readiness-manifest';
import { evaluateBaseBookIntegrity, BASE_BOOK_SCOPE } from '@/lib/generation-pipeline/integrity-gate';
import type { AssetInspection } from '@/lib/generation-pipeline/asset-integrity';

const NOW = new Date('2026-06-29T12:00:00Z');
const stubInspect = async (url: string | null | undefined): Promise<AssetInspection> => {
  const u = (url ?? '').trim();
  if (!u) return { ok: false, bytes: 0, format: null, mime: null, width: null, height: null, sha256: null, error: 'url_not_allowlisted' };
  if (u.includes('bad')) return { ok: false, bytes: 1, format: null, mime: null, width: null, height: null, sha256: createHash('sha256').update(u).digest('hex'), error: 'not_decodable' };
  return { ok: true, bytes: 2048, format: 'png', mime: 'image/png', width: 800, height: 1200, sha256: createHash('sha256').update(u).digest('hex') };
};

const args = (over: Partial<CommitArgs> = {}): CommitArgs => ({
  order: { id: 'o1', fulfillmentVersion: 1, expectedPageCount: 2, storySourceHash: 'src', selectionFilename: 'bedtime/foo.md', frozenProductVersion: 'v3', customerEmail: 'c@e.com', customerName: 'Cust', childName: 'Kid' },
  book: {
    coverImageUrl: 'https://h/cover.png', readUrl: 'https://app.example.com/book/o1/read', pdfUrl: null, firstAudioUrl: null,
    pages: [
      { pageNumber: 1, imageUrl: 'https://h/p1.png', text: 'עמוד אחד' },
      { pageNumber: 2, imageUrl: 'https://h/p2.png', text: 'עמוד שתיים' },
    ],
  },
  anchorAllowsDelivery: true,
  anchorOrderStatus: 'ready',
  anchorReason: null,
  ...over,
});

function mockTx() {
  return {
    bookReadinessManifest: { findFirst: vi.fn(async () => ({ revision: 4 })), create: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'm1', ...a.data })) },
    bookReadiness: { upsert: vi.fn() },
    deliveryOutbox: { findUnique: vi.fn(async () => null), create: vi.fn() },
    order: { update: vi.fn() },
    generationJob: { update: vi.fn() },
  };
}
const txRunner = (tx: ReturnType<typeof mockTx>) => vi.fn(async (cb: (t: unknown) => unknown) => cb(tx));

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

describe('commitBaseBookReadiness — single transaction, PASS/BLOCK/anchor branches', () => {
  it('PASS + anchor allows: one immutable manifest INSERT, enqueue, order ready, job done', async () => {
    const tx = mockTx();
    const prisma = { $transaction: txRunner(tx) };
    const r = await commitBaseBookReadiness(prisma as never, args(), { inspect: stubInspect, now: () => NOW });
    expect(r).toMatchObject({ manifestStatus: 'passed', enqueued: true, orderStatus: 'ready', revision: 5 });
    expect(tx.bookReadinessManifest.create).toHaveBeenCalledTimes(1); // single terminal INSERT
    expect(tx.bookReadinessManifest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'passed', revision: 5 }) }));
    expect(tx.bookReadiness.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: 'passed', currentManifestId: 'm1' }) }));
    expect(tx.deliveryOutbox.create).toHaveBeenCalledTimes(1); // enqueue inside the same tx
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ready', packageStatus: 'done', deliveryHoldReason: null }) }));
    expect(tx.generationJob.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ packaged: true, status: 'done' }) }));
  });

  it('BLOCK (bad page): manifest blocked, NO enqueue, order held + reason', async () => {
    const tx = mockTx();
    const prisma = { $transaction: txRunner(tx) };
    const a = args();
    a.book.pages[1].imageUrl = 'https://h/p2-bad.png';
    const r = await commitBaseBookReadiness(prisma as never, a, { inspect: stubInspect, now: () => NOW });
    expect(r.manifestStatus).toBe('blocked');
    expect(r.enqueued).toBe(false);
    expect(tx.bookReadinessManifest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'blocked' }) }));
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'needs_human_qa', deliveryHoldReason: expect.stringContaining('base_book_integrity:') }) }));
  });

  it('PASS but anchor holds: manifest passed, NO enqueue, anchor hold preserved', async () => {
    const tx = mockTx();
    const prisma = { $transaction: txRunner(tx) };
    const r = await commitBaseBookReadiness(prisma as never, args({ anchorAllowsDelivery: false, anchorOrderStatus: 'needs_human_qa', anchorReason: 'anchor_low_confidence:soft_band' }), { inspect: stubInspect, now: () => NOW });
    expect(r.manifestStatus).toBe('passed');
    expect(r.enqueued).toBe(false);
    expect(tx.deliveryOutbox.create).not.toHaveBeenCalled();
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'needs_human_qa', deliveryHoldReason: 'anchor_low_confidence:soft_band' }) }));
  });

  it('retries the whole transaction on a revision collision (P2002)', async () => {
    const tx = mockTx();
    const $transaction = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))
      .mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));
    const r = await commitBaseBookReadiness({ $transaction } as never, args(), { inspect: stubInspect, now: () => NOW });
    expect($transaction).toHaveBeenCalledTimes(2);
    expect(r.manifestStatus).toBe('passed');
  });
});

describe('recheckBaseBookDelivery — send-time guard', () => {
  const READ_URL = 'https://app.example.com/book/o1/read';
  const passedInput = {
    scope: BASE_BOOK_SCOPE,
    orderId: 'o1',
    readUrl: READ_URL,
    frozen: { expectedPageCount: 2, storySourceHash: 'src', selectionFilename: 'bedtime/foo.md', frozenProductVersion: 'v3' },
    cover: { imageUrl: 'https://h/cover.png' },
    pages: [ { pageNumber: 1, imageUrl: 'https://h/p1.png', text: 'עמוד אחד' }, { pageNumber: 2, imageUrl: 'https://h/p2.png', text: 'עמוד שתיים' } ],
  };
  const orderRow = {
    id: 'o1', status: 'ready', expectedPageCount: 2, storySourceHash: 'src', selectionFilename: 'bedtime/foo.md', frozenProductVersion: 'v3',
    book: { coverImageUrl: 'https://h/cover.png', readUrl: READ_URL, pages: [
      { pageNumber: 1, text: 'עמוד אחד', imageAsset: { url: 'https://h/p1.png', presentationUrl: null } },
      { pageNumber: 2, text: 'עמוד שתיים', imageAsset: { url: 'https://h/p2.png', presentationUrl: null } },
    ] },
  };

  it('allow when integrity still passes and inputsHash matches the current manifest', async () => {
    const fresh = await evaluateBaseBookIntegrity(passedInput, stubInspect);
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow) },
      bookReadiness: { findUnique: vi.fn(async () => ({ status: 'passed', currentManifestId: 'm1' })) },
      bookReadinessManifest: { findUnique: vi.fn(async () => ({ inputsHash: fresh.inputsHash })) },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: stubInspect });
    expect(r.outcome).toBe('allow');
  });

  it('SUPPRESS when the assets changed since the manifest (inputsHash mismatch — real drift)', async () => {
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow) },
      bookReadiness: { findUnique: vi.fn(async () => ({ status: 'passed', currentManifestId: 'm1' })) },
      bookReadinessManifest: { findUnique: vi.fn(async () => ({ inputsHash: 'stale-hash' })) },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: stubInspect });
    expect(r.outcome).toBe('suppress');
    expect(r.reason).toBe('inputs_changed_since_manifest');
  });

  it('RETRY (not suppress) on a TRANSIENT asset error (timeout/5xx) — B2', async () => {
    const transientInspect = async (url: string | null | undefined) => {
      if ((url ?? '').includes('p2')) return { ok: false, bytes: 0, format: null, mime: null, width: null, height: null, sha256: null, error: 'timeout' as const };
      return stubInspect(url);
    };
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow) },
      bookReadiness: { findUnique: vi.fn(async () => ({ status: 'passed', currentManifestId: 'm1' })) },
      bookReadinessManifest: { findUnique: vi.fn(async () => ({ inputsHash: 'whatever' })) },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: transientInspect });
    expect(r.outcome).toBe('retry');
  });

  it('SUPPRESS when the order was re-held', async () => {
    const prisma = {
      order: { findUnique: vi.fn(async () => ({ ...orderRow, status: 'needs_human_qa' })) },
      bookReadiness: { findUnique: vi.fn() },
      bookReadinessManifest: { findUnique: vi.fn() },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: stubInspect });
    expect(r.outcome).toBe('suppress');
    expect(r.reason).toContain('order_re_held');
  });

  it('SUPPRESS when readiness is not passed', async () => {
    const prisma = {
      order: { findUnique: vi.fn(async () => orderRow) },
      bookReadiness: { findUnique: vi.fn(async () => ({ status: 'blocked', currentManifestId: null })) },
      bookReadinessManifest: { findUnique: vi.fn() },
    };
    const r = await recheckBaseBookDelivery(prisma as never, 'o1', BASE_BOOK_SCOPE, { inspect: stubInspect });
    expect(r.outcome).toBe('suppress');
    expect(r.reason).toBe('readiness_not_passed');
  });
});
