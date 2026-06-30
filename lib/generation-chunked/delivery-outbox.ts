/**
 * Phase-1 base_book_integrity — transactional delivery Outbox (effectively-once). enqueue != send:
 * a manifest PASS enqueues a row (bound to its manifestId + inputVersion) inside the same DB transaction; a
 * separate worker/cron drains it with an atomic lease (FOR UPDATE SKIP LOCKED) and then a SINGLE atomic
 * send-time CAS (P1-f) — renew lease + set sendAttempted IFF the row is still ours AND the live truth still
 * matches the row's binding (Order.ready + inputVersion, BookReadiness.passed + currentManifestId, payloadHash)
 * — only then an idempotent provider send (Idempotency-Key = dedupeKey). The old live re-evaluation
 * (asset download + integrity re-eval) is GONE; a CAS mismatch makes the row terminal `superseded` (the new
 * manifest has its own Outbox). No import cycle: the worker takes `cas` and `send` as injected deps.
 */
import type { Prisma, PrismaClient, DeliveryOutbox } from '@prisma/client';
import { createHash } from 'crypto';
import { createLogger } from '@/lib/logger';

const log = createLogger({ subsystem: 'delivery-outbox' });

type Db = PrismaClient | Prisma.TransactionClient;

export const OUTBOX_MAX_ATTEMPTS = 6;

// Durable failure class (P1-e4-2). `send_ambiguous` = a provider send was attempted with an unknown result →
// must NOT auto-roll (enqueue refuses to mint a new idempotency key). With the P1-f pure-CAS path the only
// non-send terminal is `superseded` (CAS mismatch; sendAttempted stays false → roll-safe), so this is the only class.
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

export type DeliveryOutcome = 'sent' | 'superseded' | 'failed' | 'retry' | 'lost_lease';

/**
 * Result of the single atomic send-time CAS (P1-f):
 *  - 'ok'         — the row is still ours AND the live truth matches its binding; sendAttempted is now durably
 *                   set and the lease renewed → we hold the send slot, proceed to send.
 *  - 'superseded' — we still own the row but the binding no longer holds (a newer manifest owns the order, or
 *                   the order is no longer ready/passed) → terminal `superseded`. sendAttempted was NOT set.
 *  - 'lost_lease' — another worker reclaimed the row (status/token moved) → do nothing.
 */
export type CasResult = 'ok' | 'superseded' | 'lost_lease';

export interface OutboxDeps {
  /**
   * (P1-f) The single atomic send-time CAS. In ONE statement: renew the lease + set sendAttempted IFF the row is
   * still `processing` with this fencing token AND Order.status='ready' AND Order.inputVersion=row.inputVersion
   * AND BookReadiness.status='passed' AND BookReadiness.currentManifestId=row.manifestId AND the stored
   * payloadHash is unchanged. This REPLACES the old live re-evaluation (asset download + integrity re-eval).
   */
  cas: (row: DeliveryOutbox, token: number, leaseExpiresAt: Date) => Promise<CasResult>;
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
 * Process one already-claimed row under its fencing token (= attempts at claim). P1-f: a SINGLE atomic
 * send-time CAS (renew lease + set sendAttempted iff the binding still holds) replaces the old live re-eval.
 * 'ok' → send (idempotent); 'superseded' → terminal `superseded`; 'lost_lease' → stop. A send that fails
 * reschedules (within window) or terminal-fails `send_ambiguous`. Every terminal write is fenced.
 */
export async function processDelivery(prisma: PrismaClient, row: DeliveryOutbox, deps: OutboxDeps): Promise<DeliveryOutcome> {
  const token = row.attempts; // claim version — the fencing token
  const now = deps.now?.() ?? new Date();

  // (P1-f) The single atomic send-time CAS. Renews the lease + sets sendAttempted IFF the row is still ours AND
  // the live truth matches its binding. No live re-evaluation, no asset download.
  const cas = await deps.cas(row, token, new Date(now.getTime() + LEASE_MS));
  if (cas === 'lost_lease') return 'lost_lease';
  if (cas === 'superseded') {
    // The binding no longer holds — a newer manifest owns this order (it has its OWN Outbox row), or the order
    // is no longer ready/passed. This row is TERMINAL: no re-eval, no readiness invalidation (readiness is
    // correct), no retry loop. The CAS did NOT set sendAttempted, so a future enqueue may roll this fulfillment.
    const ok = await fenced(prisma, row.id, token, { status: 'superseded', leaseExpiresAt: null, lastError: 'cas_mismatch' });
    if (!ok) return 'lost_lease';
    log.warn('Delivery superseded at send-time CAS', { dedupeKey: row.dedupeKey });
    return 'superseded';
  }

  // cas === 'ok' → we hold the send slot (sendAttempted is durably set). Send the STORED payload (frozen at
  // enqueue; its validity is guaranteed by the inputVersion match the CAS just verified).
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

export type DrainSummary = { claimed: number; sent: number; superseded: number; failed: number; retry: number; lost_lease: number };

/**
 * Drain the Outbox. Simplification A: claim ONE row per tick by default — the single-row claim shrinks the
 * lease/fencing race surface to one row (a failure is one row, not a batch). A larger limit is still supported
 * (the SKIP-LOCKED proof seeds many), but production runs single-claim.
 */
export async function drainOutbox(prisma: PrismaClient, opts: { limit?: number }, deps: OutboxDeps): Promise<DrainSummary> {
  const now = deps.now?.() ?? new Date();
  const rows = await claimDueDeliveries(prisma, now, opts.limit ?? 1);
  const summary: DrainSummary = { claimed: rows.length, sent: 0, superseded: 0, failed: 0, retry: 0, lost_lease: 0 };
  for (const row of rows) {
    const outcome = await processDelivery(prisma, row, deps);
    summary[outcome] += 1;
  }
  return summary;
}
