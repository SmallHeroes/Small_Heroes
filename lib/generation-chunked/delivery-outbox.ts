/**
 * Phase-1 base_book_integrity — transactional delivery Outbox (effectively-once). enqueue != send:
 * a manifest PASS enqueues a row (bound to its manifestId + inputVersion) inside the same DB transaction; a
 * separate worker/cron drains it with an atomic lease (FOR UPDATE SKIP LOCKED) and then a SINGLE atomic
 * send-time CAS (P1-f) — renew lease + set sendAttempted IFF the row is still ours AND the live truth still
 * matches the row's binding (Order.ready + inputVersion, BookReadiness.passed + currentManifestId, payloadHash)
 * — only then an idempotent provider send (Idempotency-Key = dedupeKey). The old live re-evaluation
 * (asset download + integrity re-eval) is GONE. A CAS mismatch is NEVER a business revocation — it makes the row
 * a RECOVERABLE terminal: `delivery_blocked` (order not-yet-deliverable / inputs_stale) or `superseded_by_manifest`
 * (defense-in-depth) — both rebind-eligible on a re-commit WHILE sendAttempted=false (a row whose send was already
 * attempted needs explicit reconciliation, never an auto-rebind). (`delivery_revoked` is reserved for a future
 * explicit cancellation/refund domain action; the CAS never writes it.) No import cycle: `cas`/`send` are deps.
 */
import type { Prisma, PrismaClient, DeliveryOutbox } from '@prisma/client';
import { createHash } from 'crypto';
import { createLogger } from '@/lib/logger';

const log = createLogger({ subsystem: 'delivery-outbox' });

type Db = PrismaClient | Prisma.TransactionClient;

export const OUTBOX_MAX_ATTEMPTS = 6;

// Durable failure class (P1-e4-2). `send_ambiguous` = a provider send was attempted with an unknown result →
// the row must NOT be auto-rebound (enqueue refuses, requiring explicit reconciliation, so no new idempotency
// key bypasses Resend's dedup). The recoverable CAS terminals (delivery_blocked / superseded_by_manifest) leave
// sendAttempted=false and carry their own lastError, so `send_ambiguous` is the only post-send failure class.
export const FAILURE_SEND_AMBIGUOUS = 'send_ambiguous';
const LEASE_MS = 4 * 60 * 1000; // processing lease > worst-case single-row recheck (downloads); fencing covers overruns

// (#3h-D) Resend retains an Idempotency-Key for 24h. The window after which we refuse to RE-attempt a send (a
// blind resend past the key's lifetime could double-deliver) is configurable, with a safety margin BELOW 24h so
// we never rely on the exact boundary. Default 23h. Read per-call so tests/ops can tune it without a re-import.
const DEFAULT_IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60 * 1000;
export function idempotencyWindowMs(): number {
  const raw = Number(process.env.OUTBOX_IDEMPOTENCY_WINDOW_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_IDEMPOTENCY_WINDOW_MS;
}

// (#3h-D) The reconciliation signal: enqueue refuses to auto-revive an in-flight / delivered / revoked / corrupt
// intent — reviving it is a deliberate redelivery, never automatic. A TYPED error so callers (e.g. an admin
// route) can map it to a 409 WITHOUT a blanket catch that would also swallow a genuine 500.
export class OutboxReconciliationError extends Error {
  constructor(public readonly dedupeKey: string, public readonly reason: string) {
    super(`outbox_delivery_in_flight_needs_reconciliation:${dedupeKey}:${reason}`);
    this.name = 'OutboxReconciliationError';
  }
}

export function deliveryDedupeKey(orderId: string, scope: string, fulfillmentVersion: number): string {
  const s = scope === 'base_book' ? 'base-book' : scope;
  return `book-ready/${orderId}/${s}/${fulfillmentVersion}`;
}

// Recursively sort object keys AND NFC-normalize strings so the serialization is invariant to (a) key ORDER and
// (b) Unicode composition. This is REQUIRED for the #3h #4 integrity recompute: the payload is stored as Postgres
// JSONB, which physically reorders object keys (by key length, then bytewise) and does NOT preserve insertion
// order — and a name/string could round-trip in a different Unicode normal form. Hashing JSON.stringify(payload)
// directly would make hashPayload(enqueue-time object) !== hashPayload(row.payload read back from JSONB) → every
// row would false-mismatch. Canonicalizing first makes the hash stable across the round-trip.
function canonicalize(v: unknown): unknown {
  if (typeof v === 'string') return v.normalize('NFC');
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === 'object') {
    return Object.keys(v as Record<string, unknown>)
      .sort()
      .reduce((acc, k) => { acc[k] = canonicalize((v as Record<string, unknown>)[k]); return acc; }, {} as Record<string, unknown>);
  }
  return v;
}

export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
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
  /** The existing row was rebound in place to the new manifest (same dedupeKey, same idempotency key). */
  rebound: boolean;
  dedupeKey: string;
}

/**
 * (P1-f #3h) Enqueue/refresh the delivery for a delivery-INTENT. `fulfillmentVersion` identifies the intent — a
 * stable dedupeKey = a stable idempotency key. The Manifest is only the validity proof BOUND to the row, not a
 * new intent: a re-commit re-binds the SAME row rather than minting a new key (which is what caused duplicate
 * emails). Contract by the existing row's state:
 *   - no row → create a fresh `scheduled` row bound to (manifestId, inputVersion).
 *   - sendAttempted=true OR status in {sent, failed, delivery_revoked, invalid_payload} → in-flight / delivered /
 *     domain-revoked / corrupt: NEVER auto-recover. Throw `OutboxReconciliationError` — a second email, or reviving
 *     a revoked/corrupt intent, is a DELIBERATE product action (explicit redelivery), never automatic.
 *   - same manifest, live (scheduled/processing): same payload → idempotent no-op; different payload → throw
 *     (a same-manifest payload change is a bug).
 *   - otherwise (sendAttempted=false; a NEW manifest, or a RECOVERABLE terminal — delivery_blocked /
 *     superseded_by_manifest): REBIND this same row IN PLACE via an atomic recoverable-status-allowlist updateMany
 *     — new manifestId/inputVersion/payload, reset to `scheduled`, bump attempts to FENCE any in-flight worker —
 *     keeping the SAME dedupeKey → SAME idempotency key → NO dup email.
 * Pass a transaction client to enqueue atomically with the manifest PASS.
 */
export async function enqueueDelivery(
  db: Db,
  args: { orderId: string; scope: string; fulfillmentVersion: number; manifestId: string; inputVersion: number; payload: BookReadyPayload; now: Date },
): Promise<EnqueueResult> {
  const payloadHash = hashPayload(args.payload);
  const dedupeKey = deliveryDedupeKey(args.orderId, args.scope, args.fulfillmentVersion);
  const existing = await db.deliveryOutbox.findUnique({ where: { dedupeKey } });
  if (!existing) {
    await db.deliveryOutbox.create({
      data: {
        dedupeKey, orderId: args.orderId, scope: args.scope, status: 'scheduled',
        payload: args.payload as unknown as Prisma.InputJsonValue, payloadHash,
        manifestId: args.manifestId, inputVersion: args.inputVersion, nextAttemptAt: args.now,
      },
    });
    return { created: true, rebound: false, dedupeKey };
  }
  // In-flight / delivered / corrupt / domain-revoked → never auto-rebind. sendAttempted=true may have reached
  // Resend; `delivery_revoked` is a deliberately-killed intent; `invalid_payload` is a corrupt row → reviving any
  // of them is a deliberate redelivery (reconciliation), never automatic.
  if (existing.sendAttempted || existing.status === 'sent' || existing.status === 'failed'
      || existing.status === 'delivery_revoked' || existing.status === 'invalid_payload') {
    throw new OutboxReconciliationError(dedupeKey, `existing_status:${existing.status}`);
  }
  // Same manifest + live → idempotent (a retried commit of the SAME manifest); a different payload is a bug.
  if (existing.manifestId === args.manifestId && (existing.status === 'scheduled' || existing.status === 'processing')) {
    if (existing.payloadHash !== payloadHash) throw new Error(`outbox_payload_mismatch:${dedupeKey}`);
    return { created: false, rebound: false, dedupeKey };
  }
  // sendAttempted=false, a NEW manifest (or a recoverable terminal: delivery_blocked / superseded_by_manifest) →
  // REBIND in place, same dedupeKey. ATOMIC (#3h-D HIGH): the findUnique above is a stale snapshot, so guard the
  // write on an ALLOWLIST of RECOVERABLE statuses + sendAttempted=false. A row that turned terminal between our
  // read and this write — sent (sendAttempted=true), or invalid_payload / delivery_revoked (NOT in the allowlist)
  // — matches 0 rows → we reconcile instead of REVIVING it. attempts:{increment:1} is a DB-side bump (not the
  // stale read), so it fences whatever worker currently holds the row regardless of token.
  const rebound = await db.deliveryOutbox.updateMany({
    where: { dedupeKey, sendAttempted: false, status: { in: ['scheduled', 'processing', 'delivery_blocked', 'superseded_by_manifest'] } },
    data: {
      manifestId: args.manifestId, inputVersion: args.inputVersion,
      payload: args.payload as unknown as Prisma.InputJsonValue, payloadHash,
      status: 'scheduled', attempts: { increment: 1 }, leaseExpiresAt: null, nextAttemptAt: args.now, lastError: 'rebound',
    },
  });
  if (rebound.count === 0) throw new OutboxReconciliationError(dedupeKey, 'rebind_lost_race');
  return { created: false, rebound: true, dedupeKey };
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

export type DeliveryOutcome = 'sent' | 'superseded_by_manifest' | 'delivery_blocked' | 'invalid_payload' | 'failed' | 'retry' | 'lost_lease';

/**
 * Result of the single atomic send-time CAS (P1-f #3h-D). A CAS mismatch is NEVER a business revocation — both
 * non-ok terminals below are RECOVERABLE (rebind-eligible on a re-commit). The CAS never writes delivery_revoked.
 *  - 'ok'                     — the row is still ours AND the live truth matches its binding; sendAttempted +
 *                              firstSendAttemptAt are now durably set and the lease renewed → hold the send slot.
 *  - 'superseded_by_manifest' — defense-in-depth: we still own the row but a newer VALID manifest owns the order
 *                              (ready + passed, different currentManifestId). Recoverable via the re-commit rebind.
 *  - 'delivery_blocked'       — we still own the row but the order is not-yet-deliverable for a TRANSIENT reason
 *                              (order not ready — paid/generating/needs_human_qa/partial — or readiness not passed
 *                              / inputs_stale). RECOVERABLE: a re-commit rebinds it when it returns to ready —
 *                              but ONLY while sendAttempted=false (else reconciliation, like any post-send row).
 *  - 'lost_lease'             — another worker reclaimed the row (status/token moved) → do nothing.
 */
export type CasResult = 'ok' | 'superseded_by_manifest' | 'delivery_blocked' | 'lost_lease';

export interface OutboxDeps {
  /**
   * (P1-f) The single atomic send-time CAS. In ONE statement: renew the lease + set sendAttempted +
   * firstSendAttemptAt (COALESCE — first attempt only) IFF the row is still `processing` with this fencing token
   * AND Order.status='ready' AND Order.inputVersion=row.inputVersion AND BookReadiness.status='passed' AND
   * BookReadiness.currentManifestId=row.manifestId AND the stored payloadHash is unchanged. On a 0-row miss it
   * diagnoses superseded_by_manifest vs delivery_blocked vs lost_lease (never a business revocation).
   */
  cas: (row: DeliveryOutbox, token: number, leaseExpiresAt: Date, now: Date) => Promise<CasResult>;
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
 * 'ok' → send (idempotent); recoverable CAS mismatch → terminal `delivery_blocked` / `superseded_by_manifest`
 * (never a business revocation); corrupt payload → `invalid_payload`; 'lost_lease' → stop. A send that fails
 * reschedules (within window) or terminal-fails `send_ambiguous`. Every terminal write is fenced.
 */
export async function processDelivery(prisma: PrismaClient, row: DeliveryOutbox, deps: OutboxDeps): Promise<DeliveryOutcome> {
  const token = row.attempts; // claim version — the fencing token
  const now = deps.now?.() ?? new Date();

  // (#4) Payload integrity: the stored payload must still hash to its stored payloadHash (a REAL recompute, not a
  // self-comparison). A mismatch means the row was corrupted/tampered → never send; terminal `invalid_payload`
  // (a SEPARATE corrupt-row state — NOT a business revocation), for investigation.
  if (hashPayload(row.payload) !== row.payloadHash) {
    const ok = await fenced(prisma, row.id, token, { status: 'invalid_payload', leaseExpiresAt: null, nextAttemptAt: null, lastError: 'payload_integrity_mismatch' });
    if (!ok) return 'lost_lease';
    log.error('Delivery payload integrity mismatch', new Error('payload_integrity_mismatch'), { dedupeKey: row.dedupeKey });
    return 'invalid_payload';
  }

  // (#3) Idempotency window from firstSendAttemptAt: a RE-attempt past the (configurable, <24h) window after the
  // FIRST send attempt must not blind-resend (Resend's dedup key has expired → a resend could double-deliver).
  // The first attempt (firstSendAttemptAt null) always proceeds — a 25h-queued order still gets its first attempt.
  if (row.firstSendAttemptAt && now.getTime() - row.firstSendAttemptAt.getTime() > idempotencyWindowMs()) {
    const ok = await fenced(prisma, row.id, token, { status: 'failed', failureClass: FAILURE_SEND_AMBIGUOUS, leaseExpiresAt: null, nextAttemptAt: null, lastError: 'idempotency_window_expired' });
    if (!ok) return 'lost_lease';
    log.error('Delivery idempotency window expired since first attempt', new Error('idempotency_window_expired'), { dedupeKey: row.dedupeKey });
    return 'failed';
  }

  // (P1-f) The single atomic send-time CAS. Renews the lease + sets sendAttempted + firstSendAttemptAt IFF the
  // row is still ours AND the live truth matches its binding. No live re-evaluation, no asset download.
  const cas = await deps.cas(row, token, new Date(now.getTime() + LEASE_MS), now);
  if (cas === 'lost_lease') return 'lost_lease';
  if (cas === 'superseded_by_manifest') {
    // A newer VALID manifest owns the order; a re-commit rebinds this row in place (same dedupeKey) while
    // sendAttempted=false. Mark terminal-for-this-worker — recovery is the rebind. No send, no readiness change.
    const ok = await fenced(prisma, row.id, token, { status: 'superseded_by_manifest', leaseExpiresAt: null, lastError: 'cas_superseded_by_manifest' });
    if (!ok) return 'lost_lease';
    log.warn('Delivery superseded by a newer manifest at send-time CAS', { dedupeKey: row.dedupeKey });
    return 'superseded_by_manifest';
  }
  if (cas === 'delivery_blocked') {
    // The order is not-yet-deliverable for a TRANSIENT reason (order not ready — paid/generating/needs_human_qa/
    // partial — or readiness not passed / inputs_stale). NOT a business revocation. RECOVERABLE: a re-commit
    // rebinds this row when the order returns to ready+passed — but only while sendAttempted=false (a row whose
    // send was already attempted goes to reconciliation instead). Terminal-for-this-worker only; no send.
    const ok = await fenced(prisma, row.id, token, { status: 'delivery_blocked', leaseExpiresAt: null, lastError: 'cas_delivery_blocked' });
    if (!ok) return 'lost_lease';
    log.warn('Delivery blocked at send-time CAS (recoverable, awaiting re-commit)', { dedupeKey: row.dedupeKey });
    return 'delivery_blocked';
  }

  // cas === 'ok' → we hold the send slot (sendAttempted + firstSendAttemptAt are durably set). Send the STORED
  // payload (frozen at enqueue; its validity is guaranteed by the inputVersion match the CAS just verified).
  try {
    const res = await deps.send(row.payload as unknown as BookReadyPayload, row.dedupeKey);
    const sentNow = deps.now?.() ?? new Date(); // (B-r3-3) sentAt = a FRESH timestamp once the send completes
    const ok = await fenced(prisma, row.id, token, { status: 'sent', sentAt: sentNow, providerMessageId: res.providerMessageId ?? null, leaseExpiresAt: null, lastError: null });
    return ok ? 'sent' : 'lost_lease';
  } catch (e) {
    const err = (e as Error).message?.slice(0, 300) ?? 'send_failed';
    const failNow = deps.now?.() ?? new Date(); // (B-r3-3) fresh after the failed send for backoff math
    // Out of attempts → give up. The 24h-window cutoff is enforced PRE-send (#3 above), so within a live window
    // a transient send failure just reschedules the SAME dedupeKey (Resend dedups a response-lost accept).
    if (row.attempts >= OUTBOX_MAX_ATTEMPTS) {
      // A provider send WAS attempted and the result is unknown (Resend may have accepted) → mark ambiguous so
      // enqueue never auto-rebinds this into a delivery that bypasses the dedup (would risk a duplicate email).
      const ok = await fenced(prisma, row.id, token, { status: 'failed', failureClass: FAILURE_SEND_AMBIGUOUS, nextAttemptAt: null, leaseExpiresAt: null, lastError: err });
      if (!ok) return 'lost_lease';
      log.error('Delivery permanently failed', e, { dedupeKey: row.dedupeKey, attempts: row.attempts });
      return 'failed';
    }
    const ok = await fenced(prisma, row.id, token, { status: 'scheduled', nextAttemptAt: new Date(failNow.getTime() + backoffMs(row.attempts)), leaseExpiresAt: null, lastError: err });
    return ok ? 'retry' : 'lost_lease';
  }
}

export type DrainSummary = { claimed: number; sent: number; superseded_by_manifest: number; delivery_blocked: number; invalid_payload: number; failed: number; retry: number; lost_lease: number };

/**
 * Drain the Outbox. Simplification A: claim ONE row per tick by default — the single-row claim shrinks the
 * lease/fencing race surface to one row (a failure is one row, not a batch). A larger limit is still supported
 * (the SKIP-LOCKED proof seeds many), but production runs single-claim.
 */
export async function drainOutbox(prisma: PrismaClient, opts: { limit?: number }, deps: OutboxDeps): Promise<DrainSummary> {
  const now = deps.now?.() ?? new Date();
  const rows = await claimDueDeliveries(prisma, now, opts.limit ?? 1);
  const summary: DrainSummary = { claimed: rows.length, sent: 0, superseded_by_manifest: 0, delivery_blocked: 0, invalid_payload: 0, failed: 0, retry: 0, lost_lease: 0 };
  for (const row of rows) {
    const outcome = await processDelivery(prisma, row, deps);
    summary[outcome] += 1;
  }
  return summary;
}
