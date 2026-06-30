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
  it('creates a new scheduled row', async () => {
    const create = vi.fn(async () => ({}));
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => null), create } };
    const r = await enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, payload, now: NOW });
    expect(r.created).toBe(true);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dedupeKey: 'book-ready/o1/base-book/1', status: 'scheduled' }) }));
  });
  it('LIVE row (scheduled) + same payload => idempotent no-op (no second send enqueued)', async () => {
    const create = vi.fn();
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ status: 'scheduled', payloadHash: hashPayload(payload) })), create } };
    const r = await enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, payload, now: NOW });
    expect(r.created).toBe(false);
    expect(r.fulfillmentVersion).toBe(1);
    expect(create).not.toHaveBeenCalled();
  });
  it('LIVE row (scheduled) + DIFFERENT payload => throws (never change a live payload under one event)', async () => {
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ status: 'scheduled', payloadHash: 'different' })), create: vi.fn() } };
    await expect(enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, payload, now: NOW }))
      .rejects.toThrow(/outbox_payload_mismatch/);
  });
  it('B-r3-1: terminal-dead row (suppressed) => rolls to fulfillmentVersion+1 and creates a FRESH scheduled row', async () => {
    const create = vi.fn(async () => ({}));
    const findUnique = vi.fn(async ({ where }: { where: { dedupeKey: string } }) =>
      where.dedupeKey === 'book-ready/o1/base-book/1' ? { status: 'suppressed', payloadHash: 'whatever' } : null);
    const db = { deliveryOutbox: { findUnique, create } };
    const r = await enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, payload, now: NOW });
    expect(r.created).toBe(true);
    expect(r.fulfillmentVersion).toBe(2); // rolled past the dead v1
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dedupeKey: 'book-ready/o1/base-book/2', status: 'scheduled' }) }));
  });
  it('B-r3-1: a terminal-dead row never reports as live, even with the SAME payload (no ready behind a dead row)', async () => {
    const create = vi.fn(async () => ({}));
    const findUnique = vi.fn(async ({ where }: { where: { dedupeKey: string } }) =>
      where.dedupeKey === 'book-ready/o1/base-book/1' ? { status: 'failed', payloadHash: hashPayload(payload) } : null);
    const db = { deliveryOutbox: { findUnique, create } };
    const r = await enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, payload, now: NOW });
    expect(r.created).toBe(true); // NOT a no-op success on the dead row
    expect(r.fulfillmentVersion).toBe(2);
  });
  it('B-r3-1: every rolled fulfillment terminal-dead => explicit exception (never silent ready)', async () => {
    const db = { deliveryOutbox: { findUnique: vi.fn(async () => ({ status: 'failed', payloadHash: 'x' })), create: vi.fn() } };
    await expect(enqueueDelivery(db as never, { orderId: 'o1', scope: 'base_book', fulfillmentVersion: 1, payload, now: NOW }))
      .rejects.toThrow(/outbox_terminal_recovery_exhausted/);
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
  it('B-r3-2: suppress delegates to the atomic suppress dep when provided (fence + invalidation in one tx)', async () => {
    const suppress = vi.fn(async () => 'suppressed' as const);
    const send = vi.fn();
    const out = await processDelivery({ deliveryOutbox: { updateMany: vi.fn() } } as never, row() as never, { recheck: async () => ({ outcome: 'suppress', reason: 'integrity_now_x', invalidateReadiness: true, expectedManifestId: 'm1' }), send, suppress, now: () => NOW });
    expect(out).toBe('suppressed');
    expect(suppress).toHaveBeenCalledWith(expect.objectContaining({ row: expect.objectContaining({ id: 'ob1' }), token: 1, disposition: expect.objectContaining({ invalidateReadiness: true, expectedManifestId: 'm1' }) }));
    expect(send).not.toHaveBeenCalled();
  });
  it('B-r3-2: a lost-lease worker (suppress dep returns lost_lease) reports lost_lease and changes nothing', async () => {
    const suppress = vi.fn(async () => 'lost_lease' as const);
    const out = await processDelivery({ deliveryOutbox: { updateMany: vi.fn() } } as never, row() as never, { recheck: async () => ({ outcome: 'suppress', reason: 'integrity_now_x', invalidateReadiness: true, expectedManifestId: 'm1' }), send: vi.fn(), suppress, now: () => NOW });
    expect(out).toBe('lost_lease');
  });
  it('P1-e4-1: suppress dep returns manifest_superseded → worker RESCHEDULES (retry), never suppresses, never sends', async () => {
    const suppress = vi.fn(async () => 'manifest_superseded' as const);
    const updateMany = fencedOk(); // the reschedule fenced write
    const send = vi.fn();
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, { recheck: async () => ({ outcome: 'suppress', reason: 'integrity_now_x', invalidateReadiness: true, expectedManifestId: 'm1' }), send, suppress, now: () => NOW });
    expect(out).toBe('retry'); // re-checked against the CURRENT manifest on a later tick — not suppressed
    expect(send).not.toHaveBeenCalled();
    expect(firstData(updateMany)).toMatchObject({ status: 'scheduled', lastError: 'manifest_superseded' });
  });
  it('B-r3-2: WITHOUT the suppress dep, the fallback is a plain fenced suppress and performs NO readiness invalidation (the injected dep is the ONLY path to invalidation)', async () => {
    // Documents the seam contract: even a drift disposition (invalidateReadiness:true) does NOT invalidate
    // readiness when no suppress dep is wired — so the cron MUST inject it (covered by the route spec). A
    // regression that drops the dep would otherwise leave the order `ready` behind a suppressed row, silently.
    const updateMany = fencedOk();
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, { recheck: async () => ({ outcome: 'suppress', reason: 'integrity_now_x', invalidateReadiness: true, expectedManifestId: 'm1' }), send: vi.fn(), now: () => NOW });
    expect(out).toBe('suppressed');
    expect(updateMany).toHaveBeenCalledTimes(1); // ONLY the plain fenced suppress — no readiness/order writes
    expect(firstData(updateMany)).toMatchObject({ status: 'suppressed' });
  });
  it('B-r3-3: on send FAILURE, the backoff nextAttemptAt is computed from a now taken FRESH after the failed send', async () => {
    const T_afterRecheck = new Date('2026-06-29T10:00:00Z');
    const T_afterFail = new Date('2026-06-29T10:05:00Z'); // the send attempt itself took time
    const times = [T_afterRecheck, T_afterFail];
    let i = 0;
    const now = () => times[Math.min(i++, times.length - 1)];
    const updateMany = fencedOk();
    const send = vi.fn(async () => { throw new Error('network'); });
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ attempts: 2 }) as never, { recheck: async () => ({ outcome: 'allow' }), send, now });
    expect(out).toBe('retry');
    // [0] = pre-send renewal (post-recheck), [1] = reschedule with backoff(2)=2m from the post-FAILURE now
    expect((dataOf(updateMany, 1).nextAttemptAt as Date).getTime()).toBe(T_afterFail.getTime() + 2 * 60 * 1000);
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
  it('allow → renew-lease then send once + marks sent, Idempotency-Key = dedupeKey', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => ({ providerMessageId: 'rs_1' }));
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, okDeps(send));
    expect(out).toBe('sent');
    expect(send).toHaveBeenCalledWith(payload, 'book-ready/o1/base-book/1');
    expect(firstData(updateMany)).toMatchObject({ leaseExpiresAt: expect.any(Date) }); // (B1) pre-send ownership renew
    expect(dataOf(updateMany, 1)).toMatchObject({ status: 'sent', providerMessageId: 'rs_1' });
  });
  it('B-r3-3: lease renewal + sentAt use a now computed FRESH after recheck/send (expiry is future, not stale)', async () => {
    const LEASE = 4 * 60 * 1000; // mirrors LEASE_MS
    const T_afterRecheck = new Date('2026-06-29T10:10:00Z'); // recheck took longer than one lease window
    const T_afterSend = new Date('2026-06-29T10:12:00Z');
    const times = [T_afterRecheck, T_afterSend];
    let i = 0;
    const now = () => times[Math.min(i++, times.length - 1)];
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const send = vi.fn(async () => ({ providerMessageId: 'rs' }));
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, { recheck: async () => ({ outcome: 'allow' }), send, now });
    expect(out).toBe('sent');
    const renewalExpiry = firstData(updateMany).leaseExpiresAt as Date; // [0] = pre-send renewal
    expect(renewalExpiry.getTime()).toBe(T_afterRecheck.getTime() + LEASE); // computed from the fresh post-recheck now
    expect(renewalExpiry.getTime()).toBeGreaterThan(T_afterRecheck.getTime()); // strictly in the future
    expect(dataOf(updateMany, 1).sentAt).toEqual(T_afterSend); // [1] = sent write, fresh post-send time
  });
  it('B1: a worker that lost its lease during recheck NEVER calls send (ownership re-checked first)', async () => {
    const updateMany = fencedLost(); // the pre-send fenced renew matches 0 rows → reclaimed by another worker
    const send = vi.fn(async () => ({ providerMessageId: 'rs_1' }));
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row() as never, okDeps(send));
    expect(out).toBe('lost_lease');
    expect(send).not.toHaveBeenCalled(); // real call-order: send is gated BEHIND the ownership check, not after
    expect(updateMany).toHaveBeenCalledTimes(1); // only the pre-send ownership check, then STOPPED
  });
  it('retries (backoff, SAME key) on send failure with attempts remaining — provider-response-lost', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => { throw new Error('network'); });
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ attempts: 2 }) as never, okDeps(send));
    expect(out).toBe('retry');
    expect(dataOf(updateMany, 1)).toMatchObject({ status: 'scheduled' }); // [0] = pre-send renew, [1] = reschedule
    expect(dataOf(updateMany, 1).nextAttemptAt).toBeInstanceOf(Date);
  });
  it('gives up after max attempts — never blind-resend', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => { throw new Error('network'); });
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ attempts: OUTBOX_MAX_ATTEMPTS }) as never, okDeps(send));
    expect(out).toBe('failed');
    expect(dataOf(updateMany, 1).nextAttemptAt).toBeNull();
  });
  it('B3: a recheck stuck on `retry` is capped at OUTBOX_MAX_ATTEMPTS → terminal failed (not scheduled forever)', async () => {
    const updateMany = fencedOk();
    const send = vi.fn();
    const out = await processDelivery({ deliveryOutbox: { updateMany } } as never, row({ attempts: OUTBOX_MAX_ATTEMPTS }) as never, { recheck: async () => ({ outcome: 'retry', reason: 'transient_asset:timeout' }), send, now: () => NOW });
    expect(out).toBe('failed');
    expect(send).not.toHaveBeenCalled();
    expect(firstData(updateMany)).toMatchObject({ status: 'failed' }); // retry branch fences terminal directly (no pre-send renew)
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
