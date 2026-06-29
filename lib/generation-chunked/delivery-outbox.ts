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

/**
 * Enqueue a delivery (idempotent on dedupeKey). Same key + same payload => no-op (returns existing). Same
 * key + DIFFERENT payload => throws (a logic bug — never silently send a different payload under one event).
 * Pass a transaction client to enqueue atomically with the manifest PASS.
 */
export async function enqueueDelivery(
  db: Db,
  args: { orderId: string; scope: string; fulfillmentVersion: number; payload: BookReadyPayload; now: Date },
): Promise<{ created: boolean; dedupeKey: string }> {
  const dedupeKey = deliveryDedupeKey(args.orderId, args.scope, args.fulfillmentVersion);
  const payloadHash = hashPayload(args.payload);
  const existing = await db.deliveryOutbox.findUnique({ where: { dedupeKey } });
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw new Error(`outbox_payload_mismatch:${dedupeKey}`);
    }
    return { created: false, dedupeKey };
  }
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
  return { created: true, dedupeKey };
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

/** Recheck verdict (B2): allow (deliverable now), retry (transient infra — try later), suppress (drift/held). */
export type Disposition = { outcome: 'allow' | 'retry' | 'suppress'; reason?: string };
export type DeliveryOutcome = 'sent' | 'suppressed' | 'failed' | 'retry' | 'lost_lease';

export interface OutboxDeps {
  recheck: (orderId: string, scope: string) => Promise<Disposition>;
  /** Provider send; idempotencyKey = dedupeKey. Returns the provider message id when available. */
  send: (payload: BookReadyPayload, idempotencyKey: string) => Promise<{ providerMessageId?: string }>;
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
  const now = deps.now?.() ?? new Date();
  const token = row.attempts; // claim version — the fencing token

  let disp: Disposition;
  try {
    disp = await deps.recheck(row.orderId, row.scope);
  } catch (e) {
    disp = { outcome: 'retry', reason: `recheck_error:${(e as Error).message?.slice(0, 120)}` }; // transient infra → retry
  }

  if (disp.outcome === 'suppress') {
    const ok = await fenced(prisma, row.id, token, { status: 'suppressed', leaseExpiresAt: null, lastError: disp.reason ?? 'suppressed' });
    if (!ok) return 'lost_lease';
    log.warn('Delivery suppressed at recheck', { dedupeKey: row.dedupeKey, reason: disp.reason });
    return 'suppressed';
  }
  if (disp.outcome === 'retry') {
    const ok = await fenced(prisma, row.id, token, { status: 'scheduled', nextAttemptAt: new Date(now.getTime() + backoffMs(row.attempts)), leaseExpiresAt: null, lastError: disp.reason ?? 'recheck_retry' });
    return ok ? 'retry' : 'lost_lease';
  }

  // allow → send
  try {
    const res = await deps.send(row.payload as unknown as BookReadyPayload, row.dedupeKey);
    const ok = await fenced(prisma, row.id, token, { status: 'sent', sentAt: now, providerMessageId: res.providerMessageId ?? null, leaseExpiresAt: null, lastError: null });
    return ok ? 'sent' : 'lost_lease';
  } catch (e) {
    const err = (e as Error).message?.slice(0, 300) ?? 'send_failed';
    // Past the provider's idempotency window OR out of attempts => give up (never blind-resend after 24h).
    const beyondWindow = now.getTime() - row.createdAt.getTime() > IDEMPOTENCY_WINDOW_MS;
    if (row.attempts >= OUTBOX_MAX_ATTEMPTS || beyondWindow) {
      const ok = await fenced(prisma, row.id, token, { status: 'failed', nextAttemptAt: null, leaseExpiresAt: null, lastError: err });
      if (!ok) return 'lost_lease';
      log.error('Delivery permanently failed', e, { dedupeKey: row.dedupeKey, attempts: row.attempts });
      return 'failed';
    }
    // Retry the SAME dedupeKey (Resend dedups if the provider had actually accepted — response-lost case).
    const ok = await fenced(prisma, row.id, token, { status: 'scheduled', nextAttemptAt: new Date(now.getTime() + backoffMs(row.attempts)), leaseExpiresAt: null, lastError: err });
    return ok ? 'retry' : 'lost_lease';
  }
}

export type DrainSummary = { claimed: number; sent: number; suppressed: number; failed: number; retry: number; lost_lease: number };

/** Drain a SMALL batch (recheck downloads assets): claim atomically, then process each. */
export async function drainOutbox(prisma: PrismaClient, opts: { limit?: number }, deps: OutboxDeps): Promise<DrainSummary> {
  const now = deps.now?.() ?? new Date();
  const rows = await claimDueDeliveries(prisma, now, opts.limit ?? 5);
  const summary: DrainSummary = { claimed: rows.length, sent: 0, suppressed: 0, failed: 0, retry: 0, lost_lease: 0 };
  for (const row of rows) {
    const outcome = await processDelivery(prisma, row, deps);
    summary[outcome] += 1;
  }
  return summary;
}
