import { describe, it, expect, vi } from 'vitest';
import {
  deliveryDedupeKey, hashPayload, enqueueDelivery, processDelivery, drainOutbox, claimDueDeliveries, OUTBOX_MAX_ATTEMPTS,
} from '@/lib/generation-chunked/delivery-outbox';

const payload = { to: 'c@e.com', customerName: 'C', childName: 'K', readUrl: 'r' };
const NOW = new Date('2026-06-29T10:05:00Z');
const row = (over: Record<string, unknown> = {}) => ({
  id: 'ob1', dedupeKey: 'book-ready/o1/base-book/1', orderId: 'o1', scope: 'base_book', status: 'processing',
  payload, payloadHash: hashPayload(payload), attempts: 1, createdAt: new Date('2026-06-29T10:00:00Z'),
  nextAttemptAt: null, leaseExpiresAt: new Date(), lastError: null, providerMessageId: null, sentAt: null, ...over,
});
const okDeps = (send: ReturnType<typeof vi.fn>) => ({ recheck: async () => ({ outcome: 'allow' as const }), send, now: () => NOW });
// Typed accessor for a mock's first-call `data` arg (the inferred arg tuple is empty).
const firstData = (fn: ReturnType<typeof vi.fn>): Record<string, unknown> => ((fn.mock.calls[0] as unknown[])[0] as { data: Record<string, unknown> }).data;

describe('dedupeKey + payloadHash', () => {
  it('dedupeKey = logical fulfillment event (orderId + scope + fulfillmentVersion)', () => {
    expect(deliveryDedupeKey('o1', 'base_book', 1)).toBe('book-ready/o1/base-book/1');
    expect(deliveryDedupeKey('o1', 'base_book', 2)).toBe('book-ready/o1/base-book/2');
  });
  it('payloadHash differs by payload', () => {
    expect(hashPayload(payload)).not.toBe(hashPayload({ ...payload, readUrl: 'x' }));
  });
});

describe('enqueueDelivery — idempotent on dedupeKey', () => {
  it('creates a new scheduled row', async () => {
    const create = vi.fn(async () => ({}));
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => null), create } };
    const r = await enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, payload, now: NOW });
    expect(r.created).toBe(true);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dedupeKey: 'book-ready/o1/base-book/1', status: 'scheduled' }) }));
  });
  it('same key + same payload => no-op (no second send enqueued)', async () => {
    const create = vi.fn();
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ payloadHash: hashPayload(payload) })), create } };
    const r = await enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, payload, now: NOW });
    expect(r.created).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
  it('same key + DIFFERENT payload => throws (never send a different payload under one event)', async () => {
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ payloadHash: 'different' })), create: vi.fn() } };
    await expect(enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, payload, now: NOW }))
      .rejects.toThrow(/outbox_payload_mismatch/);
  });
});

describe('processDelivery — fenced terminal writes (B1) + disposition (B2)', () => {
  const fencedOk = () => vi.fn(async () => ({ count: 1 }));   // this worker still holds the current claim
  const fencedLost = () => vi.fn(async () => ({ count: 0 })); // another worker reclaimed (token no longer current)

  it('suppress disposition → no send, fenced suppressed write', async () => {
    const updateMany = fencedOk();
    const send = vi.fn();
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, { recheck: async () => ({ outcome: 'suppress', reason: 'asset_changed' }), send, now: () => NOW });
    expect(out).toBe('suppressed');
    expect(send).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'ob1', status: 'processing', attempts: 1 }), data: expect.objectContaining({ status: 'suppressed' }) }));
  });
  it('retry disposition (transient infra) → reschedule, NO send', async () => {
    const updateMany = fencedOk();
    const send = vi.fn();
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, { recheck: async () => ({ outcome: 'retry', reason: 'transient_asset' }), send, now: () => NOW });
    expect(out).toBe('retry');
    expect(send).not.toHaveBeenCalled();
    expect(firstData(updateMany)).toMatchObject({ status: 'scheduled' });
    expect(firstData(updateMany).nextAttemptAt).toBeInstanceOf(Date);
  });
  it('a thrown recheck (infra error) is treated as retry, not suppress', async () => {
    const updateMany = fencedOk();
    const send = vi.fn();
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, { recheck: async () => { throw new Error('db down'); }, send, now: () => NOW });
    expect(out).toBe('retry');
    expect(send).not.toHaveBeenCalled();
  });
  it('allow → send once + marks sent, Idempotency-Key = dedupeKey', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => ({ providerMessageId: 'rs_1' }));
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, okDeps(send));
    expect(out).toBe('sent');
    expect(send).toHaveBeenCalledWith(payload, 'book-ready/o1/base-book/1');
    expect(firstData(updateMany)).toMatchObject({ status: 'sent', providerMessageId: 'rs_1' });
  });
  it('LOST LEASE: a stale worker writes NO terminal status (fencing blocks the overwrite)', async () => {
    const updateMany = fencedLost();
    const send = vi.fn(async () => ({ providerMessageId: 'rs_1' }));
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, okDeps(send));
    expect(out).toBe('lost_lease');
    expect(updateMany).toHaveBeenCalledTimes(1); // attempted the fenced write, matched 0 rows, then STOPPED
  });
  it('retries (backoff, SAME key) on send failure with attempts remaining — provider-response-lost', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => { throw new Error('network'); });
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ attempts: 2 }) as never, okDeps(send));
    expect(out).toBe('retry');
    expect(firstData(updateMany)).toMatchObject({ status: 'scheduled' });
    expect(firstData(updateMany).nextAttemptAt).toBeInstanceOf(Date);
  });
  it('gives up after max attempts — never blind-resend', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => { throw new Error('network'); });
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ attempts: OUTBOX_MAX_ATTEMPTS }) as never, okDeps(send));
    expect(out).toBe('failed');
    expect(firstData(updateMany).nextAttemptAt).toBeNull();
  });
  it('gives up when beyond the 24h provider idempotency window', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => { throw new Error('network'); });
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ attempts: 1, createdAt: new Date('2026-06-27T09:00:00Z') }) as never, okDeps(send));
    expect(out).toBe('failed');
  });
});

describe('claimDueDeliveries — atomic claim', () => {
  it('uses FOR UPDATE SKIP LOCKED and sets a processing lease', async () => {
    const $queryRaw = vi.fn(async () => []);
    await claimDueDeliveries({ $queryRaw } as never, NOW, 10);
    const sql = (($queryRaw.mock.calls[0] as unknown[])[0] as string[]).join(' ');
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(sql).toMatch(/processing/);
  });
});

describe('drainOutbox', () => {
  it('claims a batch and processes each row', async () => {
    const $queryRaw = vi.fn(async () => [row(), row({ id: 'ob2', dedupeKey: 'book-ready/o2/base-book/1', orderId: 'o2' })]);
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const send = vi.fn(async () => ({ providerMessageId: 'x' }));
    const summary = await drainOutbox({ $queryRaw, deliveryOutbox: { updateMany } } as never, { limit: 10 }, okDeps(send));
    expect(summary).toMatchObject({ claimed: 2, sent: 2 });
    expect(send).toHaveBeenCalledTimes(2);
  });
});
