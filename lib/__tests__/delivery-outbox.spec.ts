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
  it('payloadHash is CANONICAL — invariant to object key ORDER (survives the Postgres JSONB key-reorder round-trip)', () => {
    expect(hashPayload({ to: 'a', readUrl: 'b', childName: 'c' })).toBe(hashPayload({ childName: 'c', to: 'a', readUrl: 'b' }));
    // a full reversed-key copy (a stand-in for JSONB's length-then-bytewise reordering) hashes identically:
    expect(hashPayload(payload)).toBe(hashPayload(Object.fromEntries(Object.entries(payload).reverse())));
  });
});

describe('enqueueDelivery — delivery-intent rebind contract (P1-f #3h)', () => {
  const enq = (db: unknown, over: Record<string, unknown> = {}) =>
    enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, manifestId: 'M1', inputVersion: 7, payload, now: NOW, ...over });
  const updateData = (fn: ReturnType<typeof vi.fn>): Record<string, unknown> => ((fn.mock.calls[0] as unknown[])[0] as { data: Record<string, unknown> }).data;
  const okMany = () => vi.fn(async () => ({ count: 1 }));   // rebind landed (row was still sendAttempted=false)
  const lostMany = () => vi.fn(async () => ({ count: 0 })); // a worker won the send slot between read and write

  it('no row → creates a fresh scheduled row bound to the manifest + inputVersion', async () => {
    const create = vi.fn(async () => ({}));
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => null), create, updateMany: okMany() } };
    const r = await enq(db);
    expect(r).toMatchObject({ created: true, rebound: false });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dedupeKey: 'book-ready/o1/base-book/1', status: 'scheduled', manifestId: 'M1', inputVersion: 7 }) }));
  });

  it('#3h #1: a re-commit by a NEW manifest while sendAttempted=false REBINDS the same row in place (same dedupeKey → same idempotency key) — never rolls/creates', async () => {
    const create = vi.fn();
    const updateMany = okMany();
    const findUnique = vi.fn(async () => ({ manifestId: 'M_OLD', status: 'scheduled', sendAttempted: false, payloadHash: hashPayload({ ...payload, readUrl: 'old' }) }));
    const db = { deliveryOutbox: { findUnique, create, updateMany } };
    const r = await enq(db, { manifestId: 'M2', inputVersion: 9 });
    expect(r).toMatchObject({ created: false, rebound: true, dedupeKey: 'book-ready/o1/base-book/1' });
    expect(create).not.toHaveBeenCalled();
    // ATOMIC: the write is guarded on sendAttempted=false (so a worker that won the slot is not clobbered).
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { dedupeKey: 'book-ready/o1/base-book/1', sendAttempted: false } }));
    expect(updateData(updateMany)).toMatchObject({ manifestId: 'M2', inputVersion: 9, status: 'scheduled', payloadHash: hashPayload(payload) });
    expect(updateData(updateMany).attempts).toEqual({ increment: 1 }); // FENCES any in-flight worker on the old binding
  });

  it('#3h #1: the rebind LOST the race (a worker flipped sendAttempted=true between read and write → 0 rows) → reconciliation, never clobber an in-flight row', async () => {
    const updateMany = lostMany();
    const findUnique = vi.fn(async () => ({ manifestId: 'M_OLD', status: 'processing', sendAttempted: false, payloadHash: 'old' }));
    const db = { deliveryOutbox: { findUnique, create: vi.fn(), updateMany } };
    await expect(enq(db, { manifestId: 'M2' })).rejects.toThrow(/outbox_delivery_in_flight_needs_reconciliation/);
    expect(updateMany).toHaveBeenCalledTimes(1); // it attempted the guarded write, which matched 0 rows
  });

  it('#3h #5: a superseded_by_manifest row (sendAttempted=false) is recovered by the same in-place REBIND', async () => {
    const updateMany = okMany();
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ manifestId: 'M_OLD', status: 'superseded_by_manifest', sendAttempted: false, payloadHash: 'old' })), create: vi.fn(), updateMany } };
    const r = await enq(db, { manifestId: 'M2' });
    expect(r.rebound).toBe(true);
    expect(updateData(updateMany)).toMatchObject({ manifestId: 'M2', status: 'scheduled' });
  });

  it('same manifest + live + same payload → idempotent no-op (no rebind, no create)', async () => {
    const create = vi.fn();
    const updateMany = okMany();
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ manifestId: 'M1', status: 'scheduled', sendAttempted: false, payloadHash: hashPayload(payload) })), create, updateMany } };
    const r = await enq(db);
    expect(r).toMatchObject({ created: false, rebound: false });
    expect(create).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('same manifest + live + DIFFERENT payload → throws (a same-manifest payload change is a bug)', async () => {
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ manifestId: 'M1', status: 'scheduled', sendAttempted: false, payloadHash: 'different' })), create: vi.fn(), updateMany: okMany() } };
    await expect(enq(db)).rejects.toThrow(/outbox_payload_mismatch/);
  });

  it('#3h #2: sendAttempted=true → THROWS reconciliation (never auto-rebind into a duplicate email); no create, no rebind', async () => {
    const create = vi.fn();
    const updateMany = okMany();
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ manifestId: 'M_OLD', status: 'processing', sendAttempted: true, payloadHash: 'x' })), create, updateMany } };
    await expect(enq(db, { manifestId: 'M2' })).rejects.toThrow(/outbox_delivery_in_flight_needs_reconciliation/);
    expect(create).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('#3h #2: status=sent → reconciliation (a delivered intent needs explicit redelivery)', async () => {
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ manifestId: 'M_OLD', status: 'sent', sendAttempted: true, payloadHash: 'x' })), create: vi.fn(), updateMany: okMany() } };
    await expect(enq(db, { manifestId: 'M2' })).rejects.toThrow(/outbox_delivery_in_flight_needs_reconciliation/);
  });

  it('#3h #5: status=delivery_revoked (sendAttempted=false) → reconciliation, NOT rebind (a deliberately-killed intent is never auto-revived)', async () => {
    const updateMany = okMany();
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ manifestId: 'M_OLD', status: 'delivery_revoked', sendAttempted: false, payloadHash: 'x' })), create: vi.fn(), updateMany } };
    await expect(enq(db, { manifestId: 'M2' })).rejects.toThrow(/outbox_delivery_in_flight_needs_reconciliation/);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('#3h #2: status=failed → reconciliation', async () => {
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ manifestId: 'M_OLD', status: 'failed', sendAttempted: true, payloadHash: 'x' })), create: vi.fn(), updateMany: okMany() } };
    await expect(enq(db, { manifestId: 'M2' })).rejects.toThrow(/outbox_delivery_in_flight_needs_reconciliation/);
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
  it('CAS is called with (row, fencing token = attempts at claim, a future lease expiry, now)', async () => {
    const cas = vi.fn(async () => 'ok' as const);
    await processDelivery({ deliveryOutbox: { updateMany: fencedOk() } } as never, row({ attempts: 4 }) as never, { cas, send: vi.fn(async () => ({})), now: () => NOW });
    expect(cas).toHaveBeenCalledWith(expect.objectContaining({ id: 'ob1' }), 4, expect.any(Date), NOW);
  });
  it('#3h #4: payloadHash recompute mismatch → terminal delivery_revoked, NEVER reaches the CAS or sends', async () => {
    const updateMany = fencedOk();
    const cas = vi.fn(async () => 'ok' as const);
    const send = vi.fn();
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ payloadHash: 'tampered-hash' }) as never, { cas, send, now: () => NOW });
    expect(out).toBe('delivery_revoked');
    expect(cas).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(firstData(updateMany)).toMatchObject({ status: 'delivery_revoked', lastError: 'payload_integrity_mismatch' });
  });
  it('#3h #4: a JSONB key-REORDER of the SAME payload still hashes equal (canonical) → NOT revoked, proceeds to CAS + sends', async () => {
    // Postgres JSONB does not preserve key order; row.payload comes back reordered. With a non-canonical hash this
    // would false-mismatch and revoke EVERY real delivery. The stored payloadHash is the canonical hash of the
    // original; the reordered row.payload must still match it.
    const reordered = Object.fromEntries(Object.entries(payload).reverse());
    const updateMany = fencedOk();
    const cas = vi.fn(async () => 'ok' as const);
    const send = vi.fn(async () => ({ providerMessageId: 'rs' }));
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ payload: reordered, payloadHash: hashPayload(payload) }) as never, { cas, send, now: () => NOW });
    expect(out).toBe('sent');
    expect(cas).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('#3h #3: a RE-attempt > 24h after firstSendAttemptAt → terminal failed + send_ambiguous, no CAS, no send', async () => {
    const updateMany = fencedOk();
    const cas = vi.fn(async () => 'ok' as const);
    const send = vi.fn();
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ firstSendAttemptAt: new Date('2026-06-28T09:00:00Z') }) as never, { cas, send, now: () => NOW });
    expect(out).toBe('failed');
    expect(cas).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(firstData(updateMany)).toMatchObject({ status: 'failed', failureClass: 'send_ambiguous', lastError: 'idempotency_window_expired' });
  });
  it('#3h #3: a FIRST attempt (firstSendAttemptAt null) on a row that sat 25h in the queue still proceeds to the CAS + sends', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => ({ providerMessageId: 'rs' }));
    const cas = vi.fn(async () => 'ok' as const);
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ firstSendAttemptAt: null, createdAt: new Date('2026-06-28T09:00:00Z') }) as never, { cas, send, now: () => NOW });
    expect(out).toBe('sent');
    expect(cas).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('#3h #5: CAS superseded_by_manifest → fenced terminal `superseded_by_manifest`, NEVER sends (recovery is the re-commit rebind)', async () => {
    const updateMany = fencedOk();
    const send = vi.fn();
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, { cas: async () => 'superseded_by_manifest' as const, send, now: () => NOW });
    expect(out).toBe('superseded_by_manifest');
    expect(send).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'ob1', status: 'processing', attempts: 1 }), data: expect.objectContaining({ status: 'superseded_by_manifest' }) }));
  });
  it('#3h #5: CAS delivery_revoked → fenced terminal `delivery_revoked`, NEVER sends (not auto-recoverable)', async () => {
    const updateMany = fencedOk();
    const send = vi.fn();
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, { cas: async () => 'delivery_revoked' as const, send, now: () => NOW });
    expect(out).toBe('delivery_revoked');
    expect(send).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'delivery_revoked' }) }));
  });
  it('CAS superseded_by_manifest but the fenced terminal write loses the lease → lost_lease', async () => {
    const out = await processDelivery({ deliveryOutbox: { updateMany: fencedLost() } } as never, row() as never, { cas: async () => 'superseded_by_manifest' as const, send: vi.fn(), now: () => NOW });
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
