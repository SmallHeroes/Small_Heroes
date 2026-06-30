/**
 * Phase-1 base_book_integrity — transactional delivery Outbox (effectively-once). enqueue != send:
 * a manifest PASS enqueues a row inside the same DB transaction; a separate worker/cron drains it with
 * an atomic lease (FOR UPDATE SKIP LOCKED), a pre-send recheck (suppress if anything changed), and an
 * idempotent provider send (Idempotency-Key = dedupeKey). No import cycle: the worker takes `recheck`
 * and `send` as injected deps (the cron route wires the real ones).
 */
import type { Prisma, PrismaClient, DeliveryOutbox } from '@prisma/client';
import { createHash } from 'crypto';
import { createLogger } from '@/lib/logger';

const log = createLogger({ subsystem: 'delivery-outbox' });

type Db = PrismaClient | Prisma.TransactionClient;

export const OUTBOX_MAX_ATTEMPTS = 6;

// Durable failure classes (P1-e4-2). Only `recheck_exhausted` is provably send-free → safe to roll forward.
// `send_ambiguous` means a provider send was attempted with an unknown result → must NOT auto-roll.
export const FAILURE_RECHECK_EXHAUSTED = 'recheck_exhausted';
export const FAILURE_SEND_AMBIGUOUS = 'send_ambiguous';
const LEASE_MS = 4 * 60 * 1000; // processing lease > worst-case single-row recheck (downloads); fencing covers overruns
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000; // Resend keeps Idempotency-Key 24h — no blind resend after.

export function deliveryDedupeKey(orderId: string, scope: string, fulfillmentVersion: number): string {
  const s = scope === 'base_book' ? 'base-book' : scope;
  return `book-ready/${orderId}/${s}/${fulfillmentVersion}`;
}

export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export interface BookReadyPayload {
  to: string;
  customerName: string;
  childName: string;
  readUrl: string;
  audioUrl?: string;
  pdfUrl?: string;
}

export interface EnqueueResult {
  created: boolean;
  dedupeKey: string;
  /** The fulfillmentVersion the live/created row actually uses — may have rolled forward (B-r3-1). */
  fulfillmentVersion: number;
}

// Safety bound on consecutive terminal-dead fulfillments before we refuse to roll forward (B-r3-1).
const MAX_FULFILLMENT_ROLL = 50;

/**
 * Enqueue a delivery, with an explicit recovery contract by the existing row's status (B-r3-1) — so the
 * commit can never mark an Order `ready` behind an Outbox row that is terminal-dead and will never be claimed:
 *   - no row                         → create a fresh `scheduled` row (created).
 *   - scheduled | processing | sent  → a LIVE or already-delivered row backs `ready`:
 *        same payloadHash → idempotent success; DIFFERENT payloadHash → throw (never change a live payload).
 *   - suppressed | failed (terminal) → this fulfillment is dead; ROLL to fulfillmentVersion+1 (new dedupeKey →
 *        a fresh `scheduled` row), so `ready` is always backed by a claimable row. The caller persists the
 *        returned fulfillmentVersion on the Order in the same transaction.
 * If every rolled fulfillment is also terminal-dead, throw `outbox_terminal_recovery_exhausted` (explicit,
 * never a silent `ready`). Pass a transaction client to enqueue atomically with the manifest PASS.
 */
export async function enqueueDelivery(
  db: Db,
  args: { orderId: string; scope: string; fulfillmentVersion: number; manifestId: string; inputVersion: number; payload: BookReadyPayload; now: Date },
): Promise<EnqueueResult> {
  const payloadHash = hashPayload(args.payload);
  let fulfillmentVersion = args.fulfillmentVersion;
  for (let roll = 0; roll <= MAX_FULFILLMENT_ROLL; roll++) {
    const dedupeKey = deliveryDedupeKey(args.orderId, args.scope, fulfillmentVersion);
    const existing = await db.deliveryOutbox.findUnique({ where: { dedupeKey } });
    if (!existing) {
      await db.deliveryOutbox.create({
        data: {
          dedupeKey,
          orderId: args.orderId,
          scope: args.scope,
          status: 'scheduled',
          payload: args.payload as unknown as Prisma.InputJsonValue,
          payloadHash,
          manifestId: args.manifestId,
          inputVersion: args.inputVersion,
          nextAttemptAt: args.now,
        },
      });
      return { created: true, dedupeKey, fulfillmentVersion };
    }
    // (P1-f #2) A NEW manifest NEVER adopts an existing row — each manifest gets its OWN Outbox bound to it.
    // If the row at this key belongs to a different manifest, roll to a fresh key (a distinct delivery event).
    if (existing.manifestId !== args.manifestId) {
      fulfillmentVersion += 1;
      continue;
    }
    // SAME manifest: a live/delivered row + same payload is an idempotent no-op; a different payload is a bug.
    if (existing.status === 'scheduled' || existing.status === 'processing' || existing.status === 'sent') {
      if (existing.payloadHash !== payloadHash) throw new Error(`outbox_payload_mismatch:${dedupeKey}`);
      return { created: false, dedupeKey, fulfillmentVersion };
    }
    // SAME manifest, terminal-dead. Roll ONLY when we can prove NO provider send was EVER attempted (P1-f #1):
    // `sendAttempted === false` is the single durable source of truth. Any sendAttempted === true → a provider
    // send may have reached Resend → rolling would mint a new idempotency key and bypass the 24h dedup →
    // duplicate email. Refuse — explicit reconciliation required.
    if (!existing.sendAttempted) {
      fulfillmentVersion += 1;
      continue;
    }
    throw new Error(`outbox_send_ambiguous_needs_reconciliation:${dedupeKey}`);
  }
  throw new Error(`outbox_terminal_recovery_exhausted:${args.orderId}:${args.scope}`);
}

/**
 * Atomically claim due rows (scheduled, or crashed-processing past lease, or failed past backoff) — one
 * worker per row via FOR UPDATE SKIP LOCKED. Increments attempts + sets a processing lease.
 */
export async function claimDueDeliveries(prisma: PrismaClient, now: Date, limit: number): Promise<DeliveryOutbox[]> {
  const leaseExpiry = new Date(now.getTime() + LEASE_MS);
  const rows = await prisma.$queryRaw<DeliveryOutbox[]>`
    UPDATE "DeliveryOutbox" SET
      "status" = 'processing',
      "leaseExpiresAt" = ${leaseExpiry},
      "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "DeliveryOutbox"
      WHERE (
        "status" = 'scheduled'
        OR ("status" = 'processing' AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" < ${now}))
        OR ("status" = 'failed' AND "nextAttemptAt" IS NOT NULL AND "nextAttemptAt" <= ${now})
      )
      AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
  return rows;
}

/**
 * Recheck verdict (B2): allow (deliverable now), retry (transient infra — try later), suppress (drift/held).
 * On a suppress that represents real drift, `invalidateReadiness` asks the caller to mark readiness stale +
 * take the order off `ready`, guarded by `expectedManifestId` (only stomp the manifest we actually rechecked).
 */
export type Disposition = {
  outcome: 'allow' | 'retry' | 'suppress';
  reason?: string;
  invalidateReadiness?: boolean;
  expectedManifestId?: string;
  /**
   * (P1-e4 hardening) For a NON-invalidating suppress: true iff the reason is a transient deliverability state a
   * later reschedule could resolve (order not yet ready, readiness not yet passed) — i.e. a newer manifest could
   * have adopted this row. The suppress path rolls back (manifest_superseded) only for these; structurally-dead
   * reasons (book/manifest gone) a reschedule can never clear are always suppressed, never rolled back (no livelock).
   */
  supersedable?: boolean;
};
export type DeliveryOutcome = 'sent' | 'suppressed' | 'failed' | 'retry' | 'lost_lease';

/**
 * Outcome of the atomic suppress dep (B-r3-2 + P1-e4-1):
 *  - 'suppressed'          — fence held; row is terminal `suppressed` (+ invalidation if it was real drift);
 *  - 'lost_lease'          — fence matched 0 rows (another worker reclaimed); nothing changed;
 *  - 'manifest_superseded' — fence held BUT a newer manifest already replaced the one we rechecked, so this
 *                            `processing` row now backs the NEW manifest; the suppress was ROLLED BACK (the
 *                            whole tx), and the worker must reschedule the row, not kill it.
 */
export type SuppressOutcome = 'suppressed' | 'lost_lease' | 'manifest_superseded';

export interface SuppressArgs {
  row: DeliveryOutbox;
  /** Fencing token captured at claim (= attempts). */
  token: number;
  disposition: Disposition;
}

export interface OutboxDeps {
  /** Pre-send recheck. Receives the claimed row so it can bind the enqueued payloadHash (B4). */
  recheck: (row: DeliveryOutbox) => Promise<Disposition>;
  /** Provider send; idempotencyKey = dedupeKey. Returns the provider message id when available. */
  send: (payload: BookReadyPayload, idempotencyKey: string) => Promise<{ providerMessageId?: string }>;
  /**
   * (B-r3-2 + P1-e4-1) Atomically, in ONE transaction: fence this row → terminal `suppressed` (by id + status
   * 'processing' + attempts === token), and ONLY if the fence held, invalidate the exact manifest + drop the
   * order from `ready`. If the manifest was superseded mid-flight (invalidation matches 0), the whole tx ROLLS
   * BACK and it returns 'manifest_superseded'. When omitted, processDelivery falls back to a plain fenced
   * suppress (no readiness invalidation) — used by unit tests; the cron injects the readiness-aware impl.
   */
  suppress?: (args: SuppressArgs) => Promise<SuppressOutcome>;
  now?: () => Date;
}

function backoffMs(attempts: number): number {
  return Math.min(60_000 * Math.pow(2, Math.max(0, attempts - 1)), 6 * 60 * 60 * 1000); // 1m,2m,4m… cap 6h
}

/**
 * FENCED terminal write (B1): only the worker holding the CURRENT claim (status 'processing' AND
 * attempts === the token captured at claim) may write. If another worker reclaimed the row (incrementing
 * attempts), this matches 0 rows → the stale worker STOPS and writes nothing — it can never overwrite the
 * new worker's terminal status.
 */
async function fenced(prisma: PrismaClient, rowId: string, token: number, data: Prisma.DeliveryOutboxUpdateManyMutationInput): Promise<boolean> {
  const r = await prisma.deliveryOutbox.updateMany({ where: { id: rowId, status: 'processing', attempts: token }, data });
  return r.count > 0;
}

/**
 * Process one already-claimed row under its fencing token (= attempts at claim). recheck → allow ? send
 * (idempotent) : retry|suppress. Every terminal write is fenced; a lost lease returns 'lost_lease' and
 * writes nothing further.
 */
export async function processDelivery(prisma: PrismaClient, row: DeliveryOutbox, deps: OutboxDeps): Promise<DeliveryOutcome> {
  const token = row.attempts; // claim version — the fencing token

  let disp: Disposition;
  try {
    disp = await deps.recheck(row);
  } catch (e) {
    disp = { outcome: 'retry', reason: `recheck_error:${(e as Error).message?.slice(0, 120)}` }; // transient infra → retry
  }

  // (B-r3-3) capture `now` FRESH, AFTER the (possibly long) recheck — a `now` snapped before the recheck could
  // write a lease renewal / backoff that is already in the past by the time we write it.
  const now = deps.now?.() ?? new Date();

  if (disp.outcome === 'suppress') {
    // (B-r3-2) the fenced transition + readiness invalidation are ONE atomic, fence-gated step (injected by the
    // cron). A worker that lost its lease can neither suppress nor invalidate. Unit tests omit the dep → plain
    // fenced suppress.
    let res: SuppressOutcome;
    if (deps.suppress) {
      res = await deps.suppress({ row, token, disposition: disp });
    } else {
      const held = await fenced(prisma, row.id, token, { status: 'suppressed', leaseExpiresAt: null, lastError: disp.reason ?? 'suppressed' });
      res = held ? 'suppressed' : 'lost_lease';
    }
    if (res === 'lost_lease') return 'lost_lease';
    if (res === 'manifest_superseded') {
      // (P1-e4-1) a newer manifest now backs this row — it must NOT be suppressed (the suppress was rolled back
      // atomically). Reschedule so a future tick re-checks it against the CURRENT manifest. This is BENIGN, so
      // undo the claim's attempt increment — a re-commit storm must not consume the failure budget.
      const ok = await fenced(prisma, row.id, token, { status: 'scheduled', nextAttemptAt: new Date(now.getTime() + backoffMs(row.attempts)), leaseExpiresAt: null, lastError: 'manifest_superseded', attempts: Math.max(0, row.attempts - 1) });
      return ok ? 'retry' : 'lost_lease';
    }
    log.warn('Delivery suppressed at recheck', { dedupeKey: row.dedupeKey, reason: disp.reason });
    return 'suppressed';
  }
  if (disp.outcome === 'retry') {
    // B3: a recheck that keeps returning `retry` (e.g. an asset that times out forever) must NOT reschedule
    // indefinitely — cap by OUTBOX_MAX_ATTEMPTS, then terminal-fail (never `scheduled` forever). EXCEPT a
    // `manifest_superseded` retry, which is BENIGN (a valid newer manifest owns the row) — it must not count
    // toward the cap, or a re-commit storm could terminal-fail a healthy delivery.
    const superseded = disp.reason === 'manifest_superseded';
    if (!superseded && row.attempts >= OUTBOX_MAX_ATTEMPTS) {
      const lastError = `recheck_retry_exhausted:${disp.reason ?? ''}`.slice(0, 300);
      // (P1-e4-2 + review C) classify by whether a provider send was EVER attempted on this row (durable flag),
      // not by the current attempt — a prior ambiguous send must not be mis-tagged roll-safe.
      const failureClass = row.sendAttempted ? FAILURE_SEND_AMBIGUOUS : FAILURE_RECHECK_EXHAUSTED;
      const ok = await fenced(prisma, row.id, token, { status: 'failed', failureClass, nextAttemptAt: null, leaseExpiresAt: null, lastError });
      if (!ok) return 'lost_lease';
      log.error('Delivery recheck retries exhausted', new Error(lastError), { dedupeKey: row.dedupeKey, attempts: row.attempts, failureClass });
      return 'failed';
    }
    const data: Prisma.DeliveryOutboxUpdateManyMutationInput = { status: 'scheduled', nextAttemptAt: new Date(now.getTime() + backoffMs(row.attempts)), leaseExpiresAt: null, lastError: disp.reason ?? 'recheck_retry' };
    if (superseded) data.attempts = Math.max(0, row.attempts - 1); // undo the claim increment — benign retry
    const ok = await fenced(prisma, row.id, token, data);
    return ok ? 'retry' : 'lost_lease';
  }

  // allow → (B1) renew the lease + RE-CONFIRM ownership atomically, immediately before send. If another
  // worker reclaimed the row during a long recheck (attempts !== token), this matches 0 rows and we STOP —
  // `send` is never called, so a worker that lost its lease can never emit a duplicate delivery.
  // (review C) durably record that a provider send is about to be attempted on this row, so a later
  // recheck-exhaustion on a re-claim classifies as `send_ambiguous`, never roll-safe `recheck_exhausted`.
  const stillOwned = await fenced(prisma, row.id, token, { leaseExpiresAt: new Date(now.getTime() + LEASE_MS), sendAttempted: true });
  if (!stillOwned) return 'lost_lease';

  // allow → send
  try {
    const res = await deps.send(row.payload as unknown as BookReadyPayload, row.dedupeKey);
    const sentNow = deps.now?.() ?? new Date(); // (B-r3-3) sentAt = a FRESH timestamp once the send completes
    const ok = await fenced(prisma, row.id, token, { status: 'sent', sentAt: sentNow, providerMessageId: res.providerMessageId ?? null, leaseExpiresAt: null, lastError: null });
    return ok ? 'sent' : 'lost_lease';
  } catch (e) {
    const err = (e as Error).message?.slice(0, 300) ?? 'send_failed';
    const failNow = deps.now?.() ?? new Date(); // (B-r3-3) fresh after the failed send for window + backoff math
    // Past the provider's idempotency window OR out of attempts => give up (never blind-resend after 24h).
    const beyondWindow = failNow.getTime() - row.createdAt.getTime() > IDEMPOTENCY_WINDOW_MS;
    if (row.attempts >= OUTBOX_MAX_ATTEMPTS || beyondWindow) {
      // (P1-e4-2) a provider send WAS attempted and the result is unknown (Resend may have accepted) → mark
      // ambiguous so enqueue never auto-rolls this into a new idempotency key (which would risk a duplicate email).
      const ok = await fenced(prisma, row.id, token, { status: 'failed', failureClass: FAILURE_SEND_AMBIGUOUS, nextAttemptAt: null, leaseExpiresAt: null, lastError: err });
      if (!ok) return 'lost_lease';
      log.error('Delivery permanently failed', e, { dedupeKey: row.dedupeKey, attempts: row.attempts });
      return 'failed';
    }
    // Retry the SAME dedupeKey (Resend dedups if the provider had actually accepted — response-lost case).
    const ok = await fenced(prisma, row.id, token, { status: 'scheduled', nextAttemptAt: new Date(failNow.getTime() + backoffMs(row.attempts)), leaseExpiresAt: null, lastError: err });
    return ok ? 'retry' : 'lost_lease';
  }
}

export type DrainSummary = { claimed: number; sent: number; suppressed: number; failed: number; retry: number; lost_lease: number };

/**
 * Drain the Outbox. Simplification A: claim ONE row per tick by default (the recheck downloads assets, so a
 * single-row claim shrinks the lease/fencing race surface to one row — a failure is one row, not a batch).
 * A larger limit is still supported (the SKIP-LOCKED proof seeds many), but production runs single-claim.
 */
export async function drainOutbox(prisma: PrismaClient, opts: { limit?: number }, deps: OutboxDeps): Promise<DrainSummary> {
  const now = deps.now?.() ?? new Date();
  const rows = await claimDueDeliveries(prisma, now, opts.limit ?? 1);
  const summary: DrainSummary = { claimed: rows.length, sent: 0, suppressed: 0, failed: 0, retry: 0, lost_lease: 0 };
  for (const row of rows) {
    const outcome = await processDelivery(prisma, row, deps);
    summary[outcome] += 1;
  }
  return summary;
}
