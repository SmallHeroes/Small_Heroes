import 'server-only';

import type { Prisma, PrismaClient, OperatorNotificationOutbox } from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';
import { createLogger } from '@/lib/logger';
import { sendOperatorReviewEmail, type OperatorReviewEmailData } from '@/backend/lib/email';
import type { OperatorNotificationPayload } from '@/lib/human-qa/record-hold';

/**
 * (Human-QA Slice 1, Unit 3) The operator-notification SEND worker — the drain half of the OperatorNotificationOutbox
 * effectively-once notifier. Unit 1's `recordHumanQaHoldInTx` wrote a `status='scheduled'` row inside the hold tx;
 * THIS worker is the single place the operator-review email is actually sent. It mirrors `delivery-outbox.ts` EXACTLY:
 * an atomic lease claim (FOR UPDATE SKIP LOCKED, `claimVersion+1` as the fencing token — the analogue of
 * DeliveryOutbox.attempts, NOT a send-retry counter), then a SINGLE atomic send-time CAS that renews the lease +
 * records the provider attempt IFF the row is still ours AND the case is STILL ACTIVE (open, activeKey not null) AND
 * the Order still `needs_human_qa`, then an idempotent provider send (Idempotency-Key = dedupeKey). Every terminal
 * write is FENCED on `status='processing' AND claimVersion=token`, so a stale worker can never overwrite a newer one.
 *
 * A CAS 0-row miss on a still-owned row is NEVER a send: the case was released / superseded (or the Order left
 * needs_human_qa) → terminal `suppressed`. This worker NEVER touches the Order or the case — it only advances the
 * outbox row. Fail-closed on a missing operator recipient: it never sends and never releases the hold.
 */

const log = createLogger({ subsystem: 'human-qa-operator-notify' });

export const HUMAN_QA_MAX_SEND_ATTEMPTS = 6;

// The ONLY post-send failure class (mirrors delivery-outbox): a provider send was attempted with an unknown result,
// so the row must never be blind-retried. `invalid_payload` (corrupt row) and `no_operator_recipient` (fail-closed
// config gap) are their own distinct failureClass strings on a `failed` row.
export const FAILURE_SEND_AMBIGUOUS = 'send_ambiguous';
export const FAILURE_INVALID_PAYLOAD = 'invalid_payload';
export const FAILURE_NO_OPERATOR_RECIPIENT = 'no_operator_recipient';

const LEASE_MS = 4 * 60 * 1000; // processing lease; fencing covers overruns

// Reuse delivery-outbox's 23h idempotency-window idea: refuse to RE-attempt a send past the (configurable, <24h)
// window after the FIRST attempt — a blind resend past the provider key's TTL could double-ping. Fail closed: an
// override can never approach/exceed the 24h key retention.
const MAX_IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60 * 1000;
const DEFAULT_IDEMPOTENCY_WINDOW_MS = MAX_IDEMPOTENCY_WINDOW_MS;
export function operatorIdempotencyWindowMs(): number {
  const raw = Number(process.env.HUMAN_QA_OPERATOR_IDEMPOTENCY_WINDOW_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_IDEMPOTENCY_WINDOW_MS;
  return Math.min(raw, MAX_IDEMPOTENCY_WINDOW_MS);
}

export function operatorBackoffMs(sendAttempts: number): number {
  return Math.min(60_000 * Math.pow(2, Math.max(0, sendAttempts - 1)), 6 * 60 * 60 * 1000); // 1m,2m,4m… cap 6h
}

/**
 * Fail-closed marker: `HUMAN_QA_OPERATOR_EMAIL` is not configured, so we have no one to notify. A distinct typed
 * error so the worker classifies it as a RESCHEDULABLE `no_operator_recipient` (NOT a blind send_ambiguous) — the
 * notification simply never fires until the config is fixed, and the hold is NEVER released.
 */
export class NoOperatorRecipientError extends Error {
  constructor() {
    super('human_qa_no_operator_recipient');
    this.name = 'NoOperatorRecipientError';
  }
}

export function canonicalHashPayload(payload: unknown): string {
  return canonicalHash(payload);
}

// ─── Atomic lease claim ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Atomically claim due rows (scheduled, or crashed-processing past lease, or failed past backoff) — one worker per
 * row via FOR UPDATE SKIP LOCKED. Bumps `claimVersion` (the fencing token) + sets a processing lease. Mirrors
 * claimDueDeliveries exactly, with `claimVersion` in place of DeliveryOutbox.attempts.
 */
export async function claimDueOperatorNotifications(
  prisma: PrismaClient,
  args: { now: Date; limit: number; leaseMs?: number },
): Promise<OperatorNotificationOutbox[]> {
  const leaseExpiry = new Date(args.now.getTime() + (args.leaseMs ?? LEASE_MS));
  const rows = await prisma.$queryRaw<OperatorNotificationOutbox[]>`
    UPDATE "OperatorNotificationOutbox" SET
      "status" = 'processing',
      "leaseExpiresAt" = ${leaseExpiry},
      "claimVersion" = "claimVersion" + 1
    WHERE "id" IN (
      SELECT "id" FROM "OperatorNotificationOutbox"
      WHERE (
        "status" = 'scheduled'
        OR ("status" = 'processing' AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" < ${args.now}))
        OR ("status" = 'failed' AND "nextAttemptAt" IS NOT NULL AND "nextAttemptAt" <= ${args.now})
      )
      AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${args.now})
      ORDER BY "createdAt" ASC
      LIMIT ${args.limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
  return rows;
}

// ─── Send-time CAS ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Result of the single atomic send-time CAS.
 *  - 'ok'         — the row is still ours AND the case is STILL ACTIVE (open, activeKey not null) AND the Order
 *                   still needs_human_qa; sendAttempted/sendAttempts/firstSendAttemptAt are durably updated + lease renewed.
 *  - 'suppressed' — still ours, but the case is no longer active (resolved / superseded / cancelled) or the Order
 *                   left needs_human_qa → NEVER send; the notification is obsolete.
 *  - 'lost_lease' — another worker reclaimed the row (status/token moved) → do nothing.
 */
export type OperatorCasResult = 'ok' | 'suppressed' | 'lost_lease';

/**
 * (Slice 1, Unit 3) The single atomic send-time CAS. In ONE statement: renew the lease + set sendAttempted +
 * increment sendAttempts + set firstSendAttemptAt (COALESCE — first attempt only) IFF the row is still ours
 * (status 'processing' + this claimVersion token), its stored payloadHash is unchanged, the review case is STILL
 * ACTIVE (open AND activeKey IS NOT NULL ⇒ not superseded/resolved/cancelled), AND the Order still `needs_human_qa`.
 * A 0-row miss is diagnosed by a re-read: only if we STILL own the row (processing + this token) is it a real
 * suppression (the case was released/superseded) — otherwise the lease was lost.
 */
export async function casClaimOperatorSendSlot(
  prisma: PrismaClient,
  row: Pick<OperatorNotificationOutbox, 'id' | 'orderId' | 'caseId' | 'payloadHash'>,
  token: number,
  leaseExpiresAt: Date,
  now: Date,
): Promise<OperatorCasResult> {
  const updated = await prisma.$executeRaw`
    UPDATE "OperatorNotificationOutbox" AS o
       SET "sendAttempted" = true,
           "sendAttempts" = o."sendAttempts" + 1,
           "firstSendAttemptAt" = COALESCE(o."firstSendAttemptAt", ${now}),
           "leaseExpiresAt" = ${leaseExpiresAt}
     WHERE o."id" = ${row.id}
       AND o."status" = 'processing'
       AND o."claimVersion" = ${token}
       AND o."payloadHash" = ${row.payloadHash}
       AND EXISTS (
         SELECT 1 FROM "HumanQaReviewCase" c
          WHERE c."id" = o."caseId" AND c."status" = 'open' AND c."activeKey" IS NOT NULL
       )
       AND EXISTS (
         SELECT 1 FROM "Order" ord
          WHERE ord."id" = o."orderId" AND ord."status" = 'needs_human_qa'
       )`;
  if (updated === 1) return 'ok';
  // 0 rows: the lease was lost, OR the case is no longer active / the Order left needs_human_qa. Re-read; only if
  // we STILL own the row (processing + this token) is it a true CAS suppression — else another worker reclaimed it.
  const cur = await prisma.operatorNotificationOutbox.findUnique({
    where: { id: row.id },
    select: { status: true, claimVersion: true },
  });
  if (!cur || cur.status !== 'processing' || cur.claimVersion !== token) return 'lost_lease';
  return 'suppressed';
}

// ─── Process one claimed row ──────────────────────────────────────────────────────────────────────────────────

export type OperatorNotificationOutcome =
  | 'sent'
  | 'suppressed'
  | 'invalid_payload'
  | 'failed'
  | 'retry'
  | 'no_recipient'
  | 'lost_lease';

export interface OperatorOutboxDeps {
  /** The single atomic send-time CAS (defaults to casClaimOperatorSendSlot in the cron route). */
  cas: (row: OperatorNotificationOutbox, token: number, leaseExpiresAt: Date, now: Date) => Promise<OperatorCasResult>;
  /** Provider send; idempotencyKey = dedupeKey. Throws NoOperatorRecipientError when no recipient is configured. */
  send: (payload: OperatorNotificationPayload, idempotencyKey: string) => Promise<{ providerMessageId?: string }>;
  now?: () => Date;
}

/**
 * FENCED terminal write: only the worker holding the CURRENT claim (status 'processing' AND claimVersion === the
 * token captured at claim) may write. If another worker reclaimed the row (bumping claimVersion), this matches 0
 * rows → the stale worker STOPS and writes nothing.
 */
async function fenced(
  prisma: Pick<PrismaClient, 'operatorNotificationOutbox'>,
  rowId: string,
  token: number,
  data: Prisma.OperatorNotificationOutboxUpdateManyMutationInput,
): Promise<boolean> {
  const r = await prisma.operatorNotificationOutbox.updateMany({
    where: { id: rowId, status: 'processing', claimVersion: token },
    data,
  });
  return r.count > 0;
}

/**
 * Process one already-claimed row under its fencing token (= claimVersion at claim). Mirrors processDelivery:
 *  (a) payloadHash recompute mismatch → terminal `failed` + failureClass `invalid_payload` (never send);
 *  (b) idempotency-window guard on firstSendAttemptAt → terminal `failed` + `send_ambiguous`;
 *  (c) the send-time CAS: 'ok' → send; 'suppressed' → terminal `suppressed` (case no longer active, never send);
 *      'lost_lease' → stop;
 *  (d) send success → fenced `sent`; a send throw → NoOperatorRecipientError ⇒ fail-closed reschedulable
 *      `no_operator_recipient`; else at max attempts ⇒ terminal `failed` + `send_ambiguous`; else backoff reschedule.
 * Every terminal/reschedule write is fenced on `status='processing' AND claimVersion=token`.
 */
export async function processOperatorNotification(
  prisma: Pick<PrismaClient, 'operatorNotificationOutbox'>,
  row: OperatorNotificationOutbox,
  deps: OperatorOutboxDeps,
): Promise<OperatorNotificationOutcome> {
  const token = row.claimVersion; // claim version — the fencing token
  const now = deps.now?.() ?? new Date();

  // (a) Payload integrity: the stored payload must still hash to its stored payloadHash (a REAL canonical recompute,
  // key-order- + NFC-invariant). A mismatch means the row was corrupted/tampered → never send; terminal for review.
  if (canonicalHash(row.payload) !== row.payloadHash) {
    const ok = await fenced(prisma, row.id, token, {
      status: 'failed',
      failureClass: FAILURE_INVALID_PAYLOAD,
      leaseExpiresAt: null,
      nextAttemptAt: null,
      lastError: 'payload_integrity_mismatch',
    });
    if (!ok) return 'lost_lease';
    log.error('Operator notification payload integrity mismatch', new Error('payload_integrity_mismatch'), { dedupeKey: row.dedupeKey });
    return 'invalid_payload';
  }

  // (b) Idempotency window from firstSendAttemptAt: a RE-attempt past the (<24h) window must not blind-resend. The
  // first attempt (firstSendAttemptAt null) always proceeds.
  if (row.firstSendAttemptAt && now.getTime() - row.firstSendAttemptAt.getTime() > operatorIdempotencyWindowMs()) {
    const ok = await fenced(prisma, row.id, token, {
      status: 'failed',
      failureClass: FAILURE_SEND_AMBIGUOUS,
      leaseExpiresAt: null,
      nextAttemptAt: null,
      lastError: 'idempotency_window_expired',
    });
    if (!ok) return 'lost_lease';
    log.error('Operator notification idempotency window expired since first attempt', new Error('idempotency_window_expired'), { dedupeKey: row.dedupeKey });
    return 'failed';
  }

  // (c) The single atomic send-time CAS. Renews the lease + records the provider attempt IFF the row is ours AND
  // the case is still active AND the Order still needs_human_qa.
  const cas = await deps.cas(row, token, new Date(now.getTime() + LEASE_MS), now);
  if (cas === 'lost_lease') return 'lost_lease';
  if (cas === 'suppressed') {
    // The case was released / superseded (or the Order left needs_human_qa). The notification is obsolete → NEVER
    // send. Terminal `suppressed`; the hold lifecycle is owned elsewhere, this worker only closes the outbox row.
    const ok = await fenced(prisma, row.id, token, { status: 'suppressed', leaseExpiresAt: null, nextAttemptAt: null, lastError: 'case_no_longer_active' });
    if (!ok) return 'lost_lease';
    log.warn('Operator notification suppressed — case no longer active at send-time CAS', { dedupeKey: row.dedupeKey });
    return 'suppressed';
  }

  // (d) cas === 'ok' → we hold the send slot (sendAttempted/sendAttempts/firstSendAttemptAt durable). Send the
  // STORED payload with Idempotency-Key = dedupeKey.
  const sendAttemptNumber = row.sendAttempts + 1;
  try {
    const res = await deps.send(row.payload as unknown as OperatorNotificationPayload, row.dedupeKey);
    const sentNow = deps.now?.() ?? new Date();
    const ok = await fenced(prisma, row.id, token, {
      status: 'sent',
      sentAt: sentNow,
      providerMessageId: res.providerMessageId ?? null,
      leaseExpiresAt: null,
      lastError: null,
    });
    return ok ? 'sent' : 'lost_lease';
  } catch (e) {
    const failNow = deps.now?.() ?? new Date();
    // FAIL-CLOSED: no operator recipient configured. Never a blind send_ambiguous — leave the row RESCHEDULABLE so
    // it fires once the config is fixed, and NEVER release the hold (this worker never touches the Order/case).
    if (e instanceof NoOperatorRecipientError) {
      const ok = await fenced(prisma, row.id, token, {
        status: 'failed',
        failureClass: FAILURE_NO_OPERATOR_RECIPIENT,
        leaseExpiresAt: null,
        nextAttemptAt: new Date(failNow.getTime() + operatorBackoffMs(sendAttemptNumber)),
        lastError: 'no_operator_recipient',
      });
      if (!ok) return 'lost_lease';
      log.error('Operator notification fail-closed: HUMAN_QA_OPERATOR_EMAIL not configured', new Error('no_operator_recipient'), { dedupeKey: row.dedupeKey });
      return 'no_recipient';
    }
    const err = (e as Error).message?.slice(0, 300) ?? 'send_failed';
    // Out of attempts → give up. A provider send WAS attempted with an unknown result → `send_ambiguous` so it is
    // never blind-retried. Within the live window a transient failure just reschedules the SAME dedupeKey (dedup-safe).
    if (sendAttemptNumber >= HUMAN_QA_MAX_SEND_ATTEMPTS) {
      const ok = await fenced(prisma, row.id, token, {
        status: 'failed',
        failureClass: FAILURE_SEND_AMBIGUOUS,
        nextAttemptAt: null,
        leaseExpiresAt: null,
        lastError: err,
      });
      if (!ok) return 'lost_lease';
      log.error('Operator notification permanently failed', e, { dedupeKey: row.dedupeKey, sendAttempts: sendAttemptNumber });
      return 'failed';
    }
    const ok = await fenced(prisma, row.id, token, {
      status: 'scheduled',
      nextAttemptAt: new Date(failNow.getTime() + operatorBackoffMs(sendAttemptNumber)),
      leaseExpiresAt: null,
      lastError: err,
    });
    return ok ? 'retry' : 'lost_lease';
  }
}

// ─── Default send (reads the operator recipient) ──────────────────────────────────────────────────────────────

/**
 * The default `deps.send`: reads `HUMAN_QA_OPERATOR_EMAIL`. MISSING → FAIL-CLOSED (throw NoOperatorRecipientError):
 * do NOT send, do NOT touch the Order/case. Otherwise send the internal operator-review email with the dedupeKey as
 * the Idempotency-Key. The email carries NO customer access key and NO deep link. The email sender is injectable
 * so tests never hit the network.
 */
export function defaultOperatorSend(
  sendEmail: (data: OperatorReviewEmailData, fetchImpl?: typeof fetch) => Promise<{ providerMessageId?: string }> = sendOperatorReviewEmail,
): OperatorOutboxDeps['send'] {
  return async (payload, idempotencyKey) => {
    const to = process.env.HUMAN_QA_OPERATOR_EMAIL?.trim();
    if (!to) throw new NoOperatorRecipientError();
    return sendEmail({
      to,
      orderId: payload.orderId,
      childName: payload.childName,
      kind: payload.kind,
      humanReason: payload.humanReason,
      pages: payload.pages,
      idempotencyKey,
    });
  };
}

// ─── Drain ────────────────────────────────────────────────────────────────────────────────────────────────────

export type OperatorDrainSummary = {
  claimed: number;
  sent: number;
  suppressed: number;
  invalid_payload: number;
  failed: number;
  retry: number;
  no_recipient: number;
  lost_lease: number;
};

/**
 * Drain the operator-notification outbox. Single-claim per tick by default (shrinks the lease/fencing race surface
 * to one row); a larger limit is supported for proofs. Mirrors drainOutbox.
 */
export async function drainOperatorNotifications(
  prisma: PrismaClient,
  opts: { limit?: number },
  deps: OperatorOutboxDeps,
): Promise<OperatorDrainSummary> {
  const now = deps.now?.() ?? new Date();
  const rows = await claimDueOperatorNotifications(prisma, { now, limit: opts.limit ?? 1 });
  const summary: OperatorDrainSummary = { claimed: rows.length, sent: 0, suppressed: 0, invalid_payload: 0, failed: 0, retry: 0, no_recipient: 0, lost_lease: 0 };
  for (const row of rows) {
    const outcome = await processOperatorNotification(prisma, row, deps);
    summary[outcome] += 1;
  }
  return summary;
}
