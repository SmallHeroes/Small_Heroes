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
  args: { orderId: string; scope: string; fulfillmentVersion: number; payload: BookReadyPayload; now: Date },
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
          nextAttemptAt: args.now,
        },
      });
      return { created: true, dedupeKey, fulfillmentVersion };
    }
    if (existing.status === 'scheduled' || existing.status === 'processing' || existing.status === 'sent') {
      if (existing.payloadHash !== payloadHash) throw new Error(`outbox_payload_mismatch:${dedupeKey}`);
      return { created: false, dedupeKey, fulfillmentVersion }; // live/delivered + same payload → idempotent success
    }
    // suppressed | failed → terminal-dead; never report as live. Roll to the next fulfillment.
    fulfillmentVersion += 1;
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
      // atomically). Reschedule so a future tick re-checks it against the CURRENT manifest.
      const ok = await fenced(prisma, row.id, token, { status: 'scheduled', nextAttemptAt: new Date(now.getTime() + backoffMs(row.attempts)), leaseExpiresAt: null, lastError: 'manifest_superseded' });
      return ok ? 'retry' : 'lost_lease';
    }
    log.warn('Delivery suppressed at recheck', { dedupeKey: row.dedupeKey, reason: disp.reason });
    return 'suppressed';
  }
  if (disp.outcome === 'retry') {
    // B3: a recheck that keeps returning `retry` (e.g. an asset that times out forever) must NOT reschedule
    // indefinitely — cap by OUTBOX_MAX_ATTEMPTS, then terminal-fail (never `scheduled` forever).
    if (row.attempts >= OUTBOX_MAX_ATTEMPTS) {
      const lastError = `recheck_retry_exhausted:${disp.reason ?? ''}`.slice(0, 300);
      const ok = await fenced(prisma, row.id, token, { status: 'failed', nextAttemptAt: null, leaseExpiresAt: null, lastError });
      if (!ok) return 'lost_lease';
      log.error('Delivery recheck retries exhausted', new Error(lastError), { dedupeKey: row.dedupeKey, attempts: row.attempts });
      return 'failed';
    }
    const ok = await fenced(prisma, row.id, token, { status: 'scheduled', nextAttemptAt: new Date(now.getTime() + backoffMs(row.attempts)), leaseExpiresAt: null, lastError: disp.reason ?? 'recheck_retry' });
    return ok ? 'retry' : 'lost_lease';
  }

  // allow → (B1) renew the lease + RE-CONFIRM ownership atomically, immediately before send. If another
  // worker reclaimed the row during a long recheck (attempts !== token), this matches 0 rows and we STOP —
  // `send` is never called, so a worker that lost its lease can never emit a duplicate delivery.
  const stillOwned = await fenced(prisma, row.id, token, { leaseExpiresAt: new Date(now.getTime() + LEASE_MS) });
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
      const ok = await fenced(prisma, row.id, token, { status: 'failed', nextAttemptAt: null, leaseExpiresAt: null, lastError: err });
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
