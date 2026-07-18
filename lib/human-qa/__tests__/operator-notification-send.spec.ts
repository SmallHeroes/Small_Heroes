import { describe, it, expect, vi, afterEach } from 'vitest';
import { canonicalHash } from '@/lib/canonical-json';
import type { OperatorNotificationPayload } from '@/lib/human-qa/record-hold';
import {
  claimDueOperatorNotifications,
  casClaimOperatorSendSlot,
  processOperatorNotification,
  drainOperatorNotifications,
  defaultOperatorSend,
  operatorIdempotencyWindowMs,
  NoOperatorRecipientError,
  HUMAN_QA_MAX_SEND_ATTEMPTS,
} from '@/lib/human-qa/operator-notification-send';

/**
 * (Human-QA Slice 1, Unit 3) Synthetic unit tests for the operator-notification SEND worker. A fake prisma
 * (raw-query fns + operatorNotificationOutbox.updateMany/findUnique) and a fake `send` are injected — NO network,
 * NO DB. Proves: claim fences by claimVersion; the send-time CAS suppresses on a released/superseded case (P2-3: the
 * bound case's activeKey must still equal `${orderId}:${scope}`, the active-hold identity) or an Order that left
 * needs_human_qa (never sending); ambiguous send handling (max ⇒ terminal send_ambiguous, within window ⇒ backoff
 * reschedule same dedupeKey); a corrupt payload never sends; and a missing operator recipient fails closed (P2-2:
 * detected BEFORE the CAS ⇒ reschedulable no_operator_recipient that never consumes the idempotency window / counts
 * an attempt / goes terminal, and sends normally once the recipient is set — Order/case untouched, hold never released).
 */

const NOW = new Date('2026-06-29T10:05:00Z');
const DEDUPE = 'human-qa/o1/base_book/1';
const payload: OperatorNotificationPayload = {
  orderId: 'o1',
  childName: 'K',
  kind: 'anchor',
  scope: 'base_book',
  humanReason: 'low anchor confidence',
  pages: [3, 4],
  reviewConsole: 'pending_slice_2',
};

const row = (over: Record<string, unknown> = {}) => ({
  id: 'on1', dedupeKey: DEDUPE, caseId: 'c1', orderId: 'o1', scope: 'base_book', status: 'processing',
  payload, payloadHash: canonicalHash(payload), claimVersion: 1, sendAttempts: 0, nextAttemptAt: null,
  leaseExpiresAt: new Date(), lastError: null, failureClass: null, sendAttempted: false, firstSendAttemptAt: null,
  providerMessageId: null, createdAt: new Date('2026-06-29T10:00:00Z'), sentAt: null, ...over,
});

const okDeps = (send: ReturnType<typeof vi.fn>) => ({ cas: async () => 'ok' as const, send, hasOperatorRecipient: () => true, now: () => NOW });
const firstData = (fn: ReturnType<typeof vi.fn>): Record<string, unknown> =>
  ((fn.mock.calls[0] as unknown[])[0] as { data: Record<string, unknown> }).data;
const firstWhere = (fn: ReturnType<typeof vi.fn>): Record<string, unknown> =>
  ((fn.mock.calls[0] as unknown[])[0] as { where: Record<string, unknown> }).where;

describe('claimDueOperatorNotifications — atomic claim, fenced by claimVersion', () => {
  it('uses FOR UPDATE SKIP LOCKED, sets a processing lease, and bumps claimVersion (the fencing token)', async () => {
    const $queryRaw = vi.fn(async () => []);
    await claimDueOperatorNotifications({ $queryRaw } as never, { now: NOW, limit: 5 });
    const sql = (($queryRaw.mock.calls[0] as unknown[])[0] as string[]).join(' ');
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(sql).toMatch(/"status" = 'processing'/);
    // claimVersion is bumped DB-side (mirrors DeliveryOutbox.attempts) so it fences any prior in-flight worker.
    expect(sql).toMatch(/"claimVersion" = "claimVersion" \+ 1/);
    expect(sql).toMatch(/ORDER BY "createdAt" ASC/);
  });
});

describe('casClaimOperatorSendSlot — send-time CAS (case still ACTIVE + Order needs_human_qa)', () => {
  const casPrisma = ($executeRaw: ReturnType<typeof vi.fn>, findUnique: ReturnType<typeof vi.fn>) =>
    ({ $executeRaw, operatorNotificationOutbox: { findUnique } }) as never;

  it('CAS SQL guards: still ours (claimVersion) + case open + activeKey not null + Order needs_human_qa', async () => {
    const $executeRaw = vi.fn(async () => 1);
    const findUnique = vi.fn();
    const res = await casClaimOperatorSendSlot(casPrisma($executeRaw, findUnique), row(), 1, new Date(), NOW);
    expect(res).toBe('ok');
    expect(findUnique).not.toHaveBeenCalled(); // a 1-row CAS never re-reads
    const sql = (($executeRaw.mock.calls[0] as unknown[])[0] as string[]).join(' ');
    expect(sql).toMatch(/"claimVersion" = /);
    expect(sql).toMatch(/HumanQaReviewCase/);
    expect(sql).toMatch(/"status" = 'open'/);
    expect(sql).toMatch(/"activeKey" IS NOT NULL/);
    // P2-3: the bound case must STILL be THE ACTIVE case for this (orderId, scope) — activeKey is the active-hold
    // identity, so a superseded case (activeKey NULLed) fails this equality and the CAS matches 0 rows.
    expect(sql).toMatch(/"activeKey" = o\."orderId" \|\| ':' \|\| o\."scope"/);
    expect(sql).toMatch(/needs_human_qa/);
    expect(sql).toMatch(/"sendAttempted" = true/);
    expect(sql).toMatch(/COALESCE\(o\."firstSendAttemptAt"/);
  });

  it('0-row CAS but still ours (processing + token) → suppressed (case resolved/superseded or Order left the hold)', async () => {
    const $executeRaw = vi.fn(async () => 0);
    const findUnique = vi.fn(async () => ({ status: 'processing', claimVersion: 1 }));
    const res = await casClaimOperatorSendSlot(casPrisma($executeRaw, findUnique), row(), 1, new Date(), NOW);
    expect(res).toBe('suppressed');
  });

  it('0-row CAS and the token moved (another worker reclaimed) → lost_lease', async () => {
    const $executeRaw = vi.fn(async () => 0);
    const findUnique = vi.fn(async () => ({ status: 'processing', claimVersion: 2 }));
    const res = await casClaimOperatorSendSlot(casPrisma($executeRaw, findUnique), row(), 1, new Date(), NOW);
    expect(res).toBe('lost_lease');
  });

  it('0-row CAS and the row is gone → lost_lease', async () => {
    const $executeRaw = vi.fn(async () => 0);
    const findUnique = vi.fn(async () => null);
    const res = await casClaimOperatorSendSlot(casPrisma($executeRaw, findUnique), row(), 1, new Date(), NOW);
    expect(res).toBe('lost_lease');
  });

  it('P2-3 superseded hold: the bound case is no longer THE active case for its (orderId, scope) — activeKey was NULLed → EXISTS fails → 0-row CAS, still ours → suppressed (never sent)', async () => {
    // A supersede NULLs the old case's activeKey and mints a new case+outbox, so the SQL guard
    // `c."activeKey" = o."orderId" || ':' || o."scope"` no longer matches for this stale outbox → 0 rows. We still
    // own the row (processing + this token), so it is a TRUE suppression, not a lost lease.
    const $executeRaw = vi.fn(async () => 0);
    const findUnique = vi.fn(async () => ({ status: 'processing', claimVersion: 1 }));
    const res = await casClaimOperatorSendSlot(casPrisma($executeRaw, findUnique), row(), 1, new Date(), NOW);
    expect(res).toBe('suppressed');
  });
});

describe('processOperatorNotification — send-time lifecycle (mirrors processDelivery)', () => {
  const fencedOk = () => vi.fn(async () => ({ count: 1 }));   // this worker still holds the current claim
  const fencedLost = () => vi.fn(async () => ({ count: 0 })); // another worker reclaimed (claimVersion moved)

  it('CAS ok → send once (Idempotency-Key = dedupeKey) + marks sent', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => ({ providerMessageId: 'rs_1' }));
    const out = await processOperatorNotification({ operatorNotificationOutbox: { updateMany } } as never, row() as never, okDeps(send));
    expect(out).toBe('sent');
    expect(send).toHaveBeenCalledWith(payload, DEDUPE);
    expect(firstData(updateMany)).toMatchObject({ status: 'sent', providerMessageId: 'rs_1' });
  });

  it('CAS is called with (row, fencing token = claimVersion at claim, a future lease, now)', async () => {
    const cas = vi.fn(async () => 'ok' as const);
    await processOperatorNotification(
      { operatorNotificationOutbox: { updateMany: fencedOk() } } as never,
      row({ claimVersion: 4 }) as never,
      { cas, send: vi.fn(async () => ({})), hasOperatorRecipient: () => true, now: () => NOW },
    );
    expect(cas).toHaveBeenCalledWith(expect.objectContaining({ id: 'on1' }), 4, expect.any(Date), NOW);
  });

  it('CAS suppressed (case resolved/superseded OR Order left needs_human_qa) → terminal suppressed, NEVER sends', async () => {
    const updateMany = fencedOk();
    const send = vi.fn();
    const out = await processOperatorNotification({ operatorNotificationOutbox: { updateMany } } as never, row() as never, { cas: async () => 'suppressed' as const, send, hasOperatorRecipient: () => true, now: () => NOW });
    expect(out).toBe('suppressed');
    expect(send).not.toHaveBeenCalled();
    expect(firstData(updateMany)).toMatchObject({ status: 'suppressed' });
    // fenced on the current claim
    expect(firstWhere(updateMany)).toMatchObject({ id: 'on1', status: 'processing', claimVersion: 1 });
  });

  it('CAS lost_lease → lost_lease, NEVER sends, writes NOTHING', async () => {
    const updateMany = vi.fn();
    const send = vi.fn();
    const out = await processOperatorNotification({ operatorNotificationOutbox: { updateMany } } as never, row() as never, { cas: async () => 'lost_lease' as const, send, hasOperatorRecipient: () => true, now: () => NOW });
    expect(out).toBe('lost_lease');
    expect(send).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('payloadHash recompute mismatch → terminal failed + invalid_payload, NEVER reaches the CAS or sends', async () => {
    const updateMany = fencedOk();
    const cas = vi.fn(async () => 'ok' as const);
    const send = vi.fn();
    const out = await processOperatorNotification({ operatorNotificationOutbox: { updateMany } } as never, row({ payloadHash: 'tampered' }) as never, { cas, send, now: () => NOW });
    expect(out).toBe('invalid_payload');
    expect(cas).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(firstData(updateMany)).toMatchObject({ status: 'failed', failureClass: 'invalid_payload', lastError: 'payload_integrity_mismatch' });
  });

  it('a JSONB key-REORDER of the SAME payload still hashes equal (canonical) → proceeds to CAS + sends', async () => {
    const reordered = Object.fromEntries(Object.entries(payload).reverse());
    const updateMany = fencedOk();
    const send = vi.fn(async () => ({ providerMessageId: 'rs' }));
    const out = await processOperatorNotification({ operatorNotificationOutbox: { updateMany } } as never, row({ payload: reordered, payloadHash: canonicalHash(payload) }) as never, { cas: async () => 'ok' as const, send, hasOperatorRecipient: () => true, now: () => NOW });
    expect(out).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('a RE-attempt past the idempotency window (since firstSendAttemptAt) → terminal failed + send_ambiguous, no CAS, no send', async () => {
    const updateMany = fencedOk();
    const cas = vi.fn(async () => 'ok' as const);
    const send = vi.fn();
    const out = await processOperatorNotification({ operatorNotificationOutbox: { updateMany } } as never, row({ firstSendAttemptAt: new Date('2026-06-28T09:00:00Z') }) as never, { cas, send, now: () => NOW });
    expect(out).toBe('failed');
    expect(cas).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(firstData(updateMany)).toMatchObject({ status: 'failed', failureClass: 'send_ambiguous', lastError: 'idempotency_window_expired' });
  });

  it('CAS ok but send fails with attempts remaining → backoff reschedule (retry, SAME dedupeKey)', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => { throw new Error('network'); });
    const out = await processOperatorNotification({ operatorNotificationOutbox: { updateMany } } as never, row({ sendAttempts: 1 }) as never, okDeps(send));
    expect(out).toBe('retry');
    expect(send).toHaveBeenCalledWith(payload, DEDUPE); // reschedule keeps the SAME dedupeKey → same idempotency key
    expect(firstData(updateMany)).toMatchObject({ status: 'scheduled' });
    expect(firstData(updateMany).nextAttemptAt).toBeInstanceOf(Date);
  });

  it('CAS ok but send fails at max attempts → terminal failed + send_ambiguous (never blind-retry)', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => { throw new Error('network'); });
    const out = await processOperatorNotification({ operatorNotificationOutbox: { updateMany } } as never, row({ sendAttempts: HUMAN_QA_MAX_SEND_ATTEMPTS - 1 }) as never, okDeps(send));
    expect(out).toBe('failed');
    expect(firstData(updateMany)).toMatchObject({ status: 'failed', failureClass: 'send_ambiguous' });
    expect(firstData(updateMany).nextAttemptAt).toBeNull();
  });

  it('fences by claimVersion: a stale worker whose fenced write matches 0 rows → lost_lease (never overwrites the newer claim)', async () => {
    const updateMany = fencedLost();
    const send = vi.fn(async () => ({ providerMessageId: 'rs' }));
    const out = await processOperatorNotification({ operatorNotificationOutbox: { updateMany } } as never, row() as never, okDeps(send));
    expect(out).toBe('lost_lease');
    expect(firstWhere(updateMany)).toMatchObject({ status: 'processing', claimVersion: 1 });
  });

  it('P2-2 config gap: a MISSING recipient is caught BEFORE the CAS → reschedulable no_operator_recipient; the CAS never runs (firstSendAttemptAt/sendAttempts untouched), nothing is sent, and the row NEVER goes terminal', async () => {
    const updateMany = fencedOk();
    const cas = vi.fn(async () => 'ok' as const);
    const send = vi.fn(async () => ({ providerMessageId: 'rs' }));
    const out = await processOperatorNotification(
      { operatorNotificationOutbox: { updateMany } } as never,
      row() as never, // sendAttempts: 0, firstSendAttemptAt: null
      { cas, send, hasOperatorRecipient: () => false, now: () => NOW },
    );
    expect(out).toBe('no_recipient');
    // The send-time CAS NEVER ran, so firstSendAttemptAt / sendAttempts were never touched, and nothing was sent →
    // the 23h idempotency window is NOT consumed.
    expect(cas).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    // NON-terminal: `failed` + no_operator_recipient + a FUTURE nextAttemptAt. The worker never writes
    // firstSendAttemptAt or sendAttempts (those live only inside the CAS SQL).
    const data = firstData(updateMany);
    expect(data).toMatchObject({ status: 'failed', failureClass: 'no_operator_recipient', lastError: 'no_operator_recipient' });
    expect(data.nextAttemptAt).toBeInstanceOf(Date);
    expect((data.nextAttemptAt as Date).getTime()).toBeGreaterThan(NOW.getTime());
    expect(data).not.toHaveProperty('firstSendAttemptAt');
    expect(data).not.toHaveProperty('sendAttempts');
    // fenced on the current claim
    expect(firstWhere(updateMany)).toMatchObject({ id: 'on1', status: 'processing', claimVersion: 1 });
  });

  it('P2-2 window not consumed: after a config-gap reschedule, a subsequent run WITH the recipient set sends normally on the SAME row (firstSendAttemptAt was never started)', async () => {
    const updateMany = fencedOk();
    const send = vi.fn(async () => ({ providerMessageId: 'rs_2' }));
    const out = await processOperatorNotification(
      { operatorNotificationOutbox: { updateMany } } as never,
      row() as never, // still firstSendAttemptAt: null, sendAttempts: 0 — the window never started
      { cas: async () => 'ok' as const, send, hasOperatorRecipient: () => true, now: () => NOW },
    );
    expect(out).toBe('sent');
    expect(send).toHaveBeenCalledWith(payload, DEDUPE);
    expect(firstData(updateMany)).toMatchObject({ status: 'sent', providerMessageId: 'rs_2' });
  });
});

describe('defaultOperatorSend + fail-closed on missing HUMAN_QA_OPERATOR_EMAIL', () => {
  const saved = process.env.HUMAN_QA_OPERATOR_EMAIL;
  afterEach(() => { if (saved === undefined) delete process.env.HUMAN_QA_OPERATOR_EMAIL; else process.env.HUMAN_QA_OPERATOR_EMAIL = saved; });

  it('missing recipient → defaultOperatorSend throws NoOperatorRecipientError; the email sender is NEVER called', async () => {
    delete process.env.HUMAN_QA_OPERATOR_EMAIL;
    const sendEmail = vi.fn(async () => ({ providerMessageId: 'x' }));
    const send = defaultOperatorSend(sendEmail);
    await expect(send(payload, DEDUPE)).rejects.toBeInstanceOf(NoOperatorRecipientError);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('present recipient → forwards to the email sender with Idempotency-Key = dedupeKey, and NO access key / NO deep link', async () => {
    process.env.HUMAN_QA_OPERATOR_EMAIL = 'ops@small-heroes.test';
    const sendEmail = vi.fn(async () => ({ providerMessageId: 'rs' }));
    const send = defaultOperatorSend(sendEmail);
    const res = await send(payload, DEDUPE);
    expect(res).toMatchObject({ providerMessageId: 'rs' });
    const arg = (sendEmail.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(arg).toMatchObject({ to: 'ops@small-heroes.test', orderId: 'o1', childName: 'K', kind: 'anchor', humanReason: 'low anchor confidence', idempotencyKey: DEDUPE });
    // the operator email carries no customer access key and no deep link/url
    const serialized = JSON.stringify(arg);
    expect(serialized).not.toMatch(/accessKey/i);
    expect(serialized).not.toMatch(/https?:\/\//i);
  });

  it('fail-closed through the worker: missing recipient → no_recipient; only the outbox row is touched (Order/case untouched, hold NOT released), and the row stays reschedulable', async () => {
    delete process.env.HUMAN_QA_OPERATOR_EMAIL;
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const out = await processOperatorNotification(
      { operatorNotificationOutbox: { updateMany } } as never,
      row() as never,
      { cas: async () => 'ok' as const, send: defaultOperatorSend(), now: () => NOW },
    );
    expect(out).toBe('no_recipient');
    // ONLY operatorNotificationOutbox.updateMany was ever called — the worker has no Order/case client, so the
    // hold can never be released here. A distinct failureClass, NOT a blind send_ambiguous.
    expect(firstData(updateMany)).toMatchObject({ status: 'failed', failureClass: 'no_operator_recipient' });
    // reschedulable so the notification fires once the config is fixed.
    expect(firstData(updateMany).nextAttemptAt).toBeInstanceOf(Date);
  });
});

describe('operatorIdempotencyWindowMs — clamped below the 24h provider key TTL', () => {
  const prev = process.env.HUMAN_QA_OPERATOR_IDEMPOTENCY_WINDOW_MS;
  afterEach(() => { if (prev === undefined) delete process.env.HUMAN_QA_OPERATOR_IDEMPOTENCY_WINDOW_MS; else process.env.HUMAN_QA_OPERATOR_IDEMPOTENCY_WINDOW_MS = prev; });
  it('defaults to 23h and clamps any override at 23h (never the exact 24h boundary)', () => {
    delete process.env.HUMAN_QA_OPERATOR_IDEMPOTENCY_WINDOW_MS;
    expect(operatorIdempotencyWindowMs()).toBe(23 * 60 * 60 * 1000);
    process.env.HUMAN_QA_OPERATOR_IDEMPOTENCY_WINDOW_MS = String(48 * 60 * 60 * 1000);
    expect(operatorIdempotencyWindowMs()).toBe(23 * 60 * 60 * 1000);
    expect(operatorIdempotencyWindowMs()).toBeLessThan(24 * 60 * 60 * 1000);
  });
});

describe('drainOperatorNotifications — claim + process each', () => {
  it('claims a batch and tallies outcomes', async () => {
    const $queryRaw = vi.fn(async () => [row(), row({ id: 'on2', dedupeKey: 'human-qa/o2/base_book/1', orderId: 'o2', caseId: 'c2' })]);
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const send = vi.fn(async () => ({ providerMessageId: 'x' }));
    const summary = await drainOperatorNotifications({ $queryRaw, operatorNotificationOutbox: { updateMany } } as never, { limit: 10 }, okDeps(send));
    expect(summary).toMatchObject({ claimed: 2, sent: 2 });
    expect(send).toHaveBeenCalledTimes(2);
  });
});
