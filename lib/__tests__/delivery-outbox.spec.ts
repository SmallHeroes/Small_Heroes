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
const okDeps = (send: ReturnType<typeof vi.fn>) => ({ cas: async () => 'ok' as const, send, now: () => NOW });
// Typed accessor for a mock's nth-call `data` arg (the inferred arg tuple is empty).
const dataOf = (fn: ReturnType<typeof vi.fn>, n: number): Record<string, unknown> => ((fn.mock.calls[n] as unknown[])[0] as { data: Record<string, unknown> }).data;
const firstData = (fn: ReturnType<typeof vi.fn>): Record<string, unknown> => dataOf(fn, 0);

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
  it('creates a new scheduled row bound to the manifest + inputVersion (P1-f #2)', async () => {
    const create = vi.fn(async () => ({}));
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => null), create } };
    const r = await enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, manifestId: 'M1', inputVersion: 7, payload, now: NOW });
    expect(r.created).toBe(true);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dedupeKey: 'book-ready/o1/base-book/1', status: 'scheduled', manifestId: 'M1', inputVersion: 7 }) }));
  });
  it('P1-f #2: an existing LIVE row bound to a DIFFERENT manifest is NEVER adopted — rolls to a fresh key bound to THIS manifest', async () => {
    const create = vi.fn(async () => ({}));
    const findUnique = vi.fn(async ({ where }: { where: { dedupeKey: string } }) =>
      where.dedupeKey === 'book-ready/o1/base-book/1' ? { manifestId: 'M_OLD', status: 'scheduled', payloadHash: hashPayload(payload) } : null);
    const db = { deliveryOutbox: { findUnique, create } };
    const r = await enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, manifestId: 'M1', inputVersion: 0, payload, now: NOW });
    expect(r.created).toBe(true);
    expect(r.fulfillmentVersion).toBe(2); // did NOT adopt M_OLD's row
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dedupeKey: 'book-ready/o1/base-book/2', manifestId: 'M1' }) }));
  });
  it('LIVE row (scheduled) + same payload => idempotent no-op (no second send enqueued)', async () => {
    const create = vi.fn();
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ manifestId: 'M1', status: 'scheduled', payloadHash: hashPayload(payload) })), create } };
    const r = await enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, manifestId: 'M1', inputVersion: 0, payload, now: NOW });
    expect(r.created).toBe(false);
    expect(r.fulfillmentVersion).toBe(1);
    expect(create).not.toHaveBeenCalled();
  });
  it('LIVE row (scheduled) + DIFFERENT payload => throws (never change a live payload under one event)', async () => {
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ manifestId: 'M1', status: 'scheduled', payloadHash: 'different' })), create: vi.fn() } };
    await expect(enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, manifestId: 'M1', inputVersion: 0, payload, now: NOW }))
      .rejects.toThrow(/outbox_payload_mismatch/);
  });
  it('B-r3-1: terminal-dead row (suppressed) => rolls to fulfillmentVersion+1 and creates a FRESH scheduled row', async () => {
    const create = vi.fn(async () => ({}));
    const findUnique = vi.fn(async ({ where }: { where: { dedupeKey: string } }) =>
      where.dedupeKey === 'book-ready/o1/base-book/1' ? { manifestId: 'M1', status: 'suppressed', payloadHash: 'whatever' } : null);
    const db = { deliveryOutbox: { findUnique, create } };
    const r = await enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, manifestId: 'M1', inputVersion: 0, payload, now: NOW });
    expect(r.created).toBe(true);
    expect(r.fulfillmentVersion).toBe(2); // rolled past the dead v1
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dedupeKey: 'book-ready/o1/base-book/2', status: 'scheduled' }) }));
  });
  it('P1-f #1: a terminal-dead row with sendAttempted=false rolls (proven no send), even with the SAME payload', async () => {
    const create = vi.fn(async () => ({}));
    const findUnique = vi.fn(async ({ where }: { where: { dedupeKey: string } }) =>
      where.dedupeKey === 'book-ready/o1/base-book/1' ? { manifestId: 'M1', status: 'failed', sendAttempted: false, payloadHash: hashPayload(payload) } : null);
    const db = { deliveryOutbox: { findUnique, create } };
    const r = await enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, manifestId: 'M1', inputVersion: 0, payload, now: NOW });
    expect(r.created).toBe(true); // NOT a no-op success on the dead row
    expect(r.fulfillmentVersion).toBe(2);
  });
  it('B-r3-1: every rolled fulfillment terminal-dead (suppressed) => explicit exception (never silent ready)', async () => {
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ manifestId: 'M1', status: 'suppressed', payloadHash: 'x' })), create: vi.fn() } };
    await expect(enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, manifestId: 'M1', inputVersion: 0, payload, now: NOW }))
      .rejects.toThrow(/outbox_terminal_recovery_exhausted/);
  });
  it('P1-f #1: a terminal row with sendAttempted=true => THROWS reconciliation (never auto-rolls into a new idempotency key)', async () => {
    const create = vi.fn();
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ manifestId: 'M1', status: 'failed', failureClass: 'send_ambiguous', sendAttempted: true, payloadHash: 'x' })), create } };
    await expect(enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, manifestId: 'M1', inputVersion: 0, payload, now: NOW }))
      .rejects.toThrow(/outbox_send_ambiguous_needs_reconciliation/);
    expect(create).not.toHaveBeenCalled(); // no new fulfillment created → no duplicate email path
  });
  it('P1-f #1: a `suppressed` row with sendAttempted=true also refuses to roll (sendAttempted is the only signal)', async () => {
    const create = vi.fn();
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ manifestId: 'M1', status: 'suppressed', sendAttempted: true, payloadHash: 'x' })), create } };
    await expect(enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, manifestId: 'M1', inputVersion: 0, payload, now: NOW }))
      .rejects.toThrow(/outbox_send_ambiguous_needs_reconciliation/);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('processDelivery — send-time CAS (P1-f)', () => {
  const fencedOk = () => vi.fn(async () => ({ count: 1 }));   // this worker still holds the current claim
  const fencedLost = () => vi.fn(async () => ({ count: 0 })); // another worker reclaimed (token no longer current)

  it('CAS ok → send once + marks sent (Idempotency-Key = dedupeKey); the CAS already renewed the lease', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => ({ providerMessageId: 'rs_1' }));
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, okDeps(send));
    expect(out).toBe('sent');
    expect(send).toHaveBeenCalledWith(payload, 'book-ready/o1/base-book/1');
    expect(updateMany).toHaveBeenCalledTimes(1); // ONLY the terminal sent write — the renew+sendAttempted is in the CAS
    expect(firstData(updateMany)).toMatchObject({ status: 'sent', providerMessageId: 'rs_1' });
  });
  it('CAS is called with (row, fencing token = attempts at claim, a future lease expiry)', async () => {
    const cas = vi.fn(async () => 'ok' as const);
    await processDelivery({ deliveryOutbox: { updateMany: fencedOk() } } as never, row({ attempts: 4 }) as never, { cas, send: vi.fn(async () => ({})), now: () => NOW });
    expect(cas).toHaveBeenCalledWith(expect.objectContaining({ id: 'ob1' }), 4, expect.any(Date));
  });
  it('CAS superseded → fenced terminal `superseded`, NEVER sends (no re-eval, no readiness invalidation)', async () => {
    const updateMany = fencedOk();
    const send = vi.fn();
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, { cas: async () => 'superseded' as const, send, now: () => NOW });
    expect(out).toBe('superseded');
    expect(send).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'ob1', status: 'processing', attempts: 1 }), data: expect.objectContaining({ status: 'superseded' }) }));
  });
  it('CAS superseded but the fenced terminal write loses the lease → lost_lease', async () => {
    const out = await processDelivery({ deliveryOutbox: { updateMany: fencedLost() } } as never, row() as never, { cas: async () => 'superseded' as const, send: vi.fn(), now: () => NOW });
    expect(out).toBe('lost_lease');
  });
  it('CAS lost_lease → lost_lease, NEVER sends, writes NOTHING', async () => {
    const updateMany = vi.fn();
    const send = vi.fn();
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, { cas: async () => 'lost_lease' as const, send, now: () => NOW });
    expect(out).toBe('lost_lease');
    expect(send).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('CAS ok but send fails with attempts remaining → reschedule (retry, SAME dedupeKey — Resend dedups)', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => { throw new Error('network'); });
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ attempts: 2 }) as never, okDeps(send));
    expect(out).toBe('retry');
    expect(firstData(updateMany)).toMatchObject({ status: 'scheduled' });
    expect(firstData(updateMany).nextAttemptAt).toBeInstanceOf(Date);
  });
  it('CAS ok but send fails at max attempts → terminal failed + send_ambiguous (never roll-safe)', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => { throw new Error('network'); });
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ attempts: OUTBOX_MAX_ATTEMPTS }) as never, okDeps(send));
    expect(out).toBe('failed');
    expect(firstData(updateMany)).toMatchObject({ status: 'failed', failureClass: 'send_ambiguous' });
    expect(firstData(updateMany).nextAttemptAt).toBeNull();
  });
  it('CAS ok but send fails beyond the 24h idempotency window → terminal failed', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => { throw new Error('network'); });
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ attempts: 1, createdAt: new Date('2026-06-27T09:00:00Z') }) as never, okDeps(send));
    expect(out).toBe('failed');
  });
  it('a send-failure terminal write that loses the lease → lost_lease', async () => {
    const send = vi.fn(async () => { throw new Error('network'); });
    const out = await processDelivery({ deliveryOutbox: { updateMany: fencedLost() } } as never, row({ attempts: OUTBOX_MAX_ATTEMPTS }) as never, okDeps(send));
    expect(out).toBe('lost_lease');
  });
  it('B-r3-3: sentAt uses a now computed FRESH after the send completes (not the top-of-function now)', async () => {
    const T_afterSend = new Date('2026-06-29T10:12:00Z');
    const times = [NOW, T_afterSend];
    let i = 0;
    const now = () => times[Math.min(i++, times.length - 1)];
    const updateMany = fencedOk();
    const send = vi.fn(async () => ({ providerMessageId: 'rs' }));
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, { cas: async () => 'ok' as const, send, now });
    expect(out).toBe('sent');
    expect(firstData(updateMany).sentAt).toEqual(T_afterSend);
  });
  it('B-r3-3: on send FAILURE, the backoff nextAttemptAt is computed from a now taken FRESH after the failed send', async () => {
    const T_afterFail = new Date('2026-06-29T10:05:00Z');
    const times = [NOW, T_afterFail];
    let i = 0;
    const now = () => times[Math.min(i++, times.length - 1)];
    const updateMany = fencedOk();
    const send = vi.fn(async () => { throw new Error('network'); });
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ attempts: 2 }) as never, { cas: async () => 'ok' as const, send, now });
    expect(out).toBe('retry');
    expect((firstData(updateMany).nextAttemptAt as Date).getTime()).toBe(T_afterFail.getTime() + 2 * 60 * 1000); // backoff(2)=2m from the post-FAILURE now
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
