/**
 * (cutover Track 1.3 hardening) Testable core of the quarantine park. The CLI (scripts/cutover-quarantine.ts) is a
 * thin wrapper over these functions. DESIGN: backend/cutover/QUARANTINE-DESIGN.md. Touches production data — the CLI
 * is dry-run by default and gated; this module performs no I/O beyond the prisma handle it is given.
 */
import type { ExceptionCaseKind, Prisma, PrismaClient } from '@prisma/client';
import { writeOrderHoldFenced } from '@/lib/generation-pipeline/order-authority';
import { resolveActiveRecoveryCaseInTx } from '@/lib/generation-chunked/exception-case';

// ── Payment classification (P1-6) — NEVER infer 'paid' from Order.status as a positive signal ──────────────────────
export const REAL_PAYMENT_PROVIDERS = new Set(['payme', 'stripe']);
export type PaymentClass = 'record_paid_external' | 'record_paid_fake' | 'status_paid_only' | 'unpaid';

export interface OrderPaymentFields {
  status: string;
  stripePaymentId: string | null;
  paymeTransactionId: string | null;
}
export interface PaymentRecordFields {
  provider: string;
  paid: boolean;
}

/**
 * Classify from PaymentRecord + real payment ids FIRST; Order.status is consulted ONLY to separate a bogus
 * status='paid'-with-zero-evidence from a genuinely unpaid order — never as proof of payment. The `fake` provider
 * (test payments) and a status='paid' order with no PaymentRecord are the two classes that must not be mistaken for
 * real money. A real external payment id with a missing record is treated as external (manual review), not unpaid.
 */
export function classifyPayment(o: OrderPaymentFields, rec: PaymentRecordFields | null): PaymentClass {
  if (rec?.paid === true && rec.provider === 'fake') return 'record_paid_fake';
  if (rec?.paid === true && REAL_PAYMENT_PROVIDERS.has(rec.provider)) return 'record_paid_external';
  if (o.stripePaymentId || o.paymeTransactionId) return 'record_paid_external';
  if (o.status === 'paid') return 'status_paid_only';
  return 'unpaid';
}

// ── Schema preflight (P0-4) — the park EXECUTES only after the Track-2 bridge lands ────────────────────────────────
/**
 * Verify production has the schema the park depends on; THROW (→ non-zero exit) if anything is missing. These objects
 * do NOT exist in pre-bridge production, so this is the sequencing gate that stops the script from dying mid-write.
 */
export async function assertSchemaPreflight(prisma: PrismaClient): Promise<void> {
  const [tbl] = await prisma.$queryRawUnsafe<Array<{ has_exception_case: boolean; has_human_qa_review_case: boolean }>>(
    `SELECT to_regclass('public."ExceptionCase"') IS NOT NULL AS has_exception_case,
            to_regclass('public."HumanQaReviewCase"') IS NOT NULL AS has_human_qa_review_case`,
  );
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='Order' AND column_name IN ('deliveryFenceVersion','manualReviewRequired')`,
  );
  const en = await prisma.$queryRawUnsafe<Array<{ ok: number }>>(
    `SELECT 1 AS ok FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname='OrderStatus' AND e.enumlabel='needs_human_qa'`,
  );
  const missing: string[] = [];
  if (!tbl?.has_exception_case) missing.push('table "ExceptionCase"');
  if (!tbl?.has_human_qa_review_case) missing.push('table "HumanQaReviewCase"');
  const colSet = new Set(cols.map((c) => c.column_name));
  if (!colSet.has('deliveryFenceVersion')) missing.push('column Order.deliveryFenceVersion');
  if (!colSet.has('manualReviewRequired')) missing.push('column Order.manualReviewRequired');
  if (en.length === 0) missing.push(`OrderStatus enum label 'needs_human_qa'`);
  if (missing.length > 0) {
    throw new Error(
      `[quarantine] schema preflight FAILED — the Track-2 reconciliation bridge must land BEFORE quarantine runs. Missing: ${missing.join(', ')}.`,
    );
  }
}

// ── ExceptionCase scan (P0-2) — scan ALL active cases in EVERY scope; a blocking one HARD-STOPS the whole run ───────
export const ACTIVE_CASE_STATUSES = ['open', 'retry_scheduled', 'customer_action', 'refund_pending'] as const;
export const BLOCKING_CASE_STATUSES = ['refund_pending', 'customer_action'] as const;

export interface ActiveCaseRow {
  id: string;
  orderId: string;
  scope: string;
  kind: ExceptionCaseKind;
  status: string;
}

/** Every active ExceptionCase (any scope) for the target orders. */
export async function scanActiveCases(prisma: PrismaClient, orderIds: string[]): Promise<ActiveCaseRow[]> {
  return prisma.exceptionCase.findMany({
    where: { orderId: { in: orderIds }, status: { in: [...ACTIVE_CASE_STATUSES] } },
    select: { id: true, orderId: true, scope: true, kind: true, status: true },
  });
}

/** The subset that a park must NEVER silently cancel (a real payment/customer obligation) — the run aborts on these. */
export function blockingCases(cases: ActiveCaseRow[]): ActiveCaseRow[] {
  return cases.filter((c) => (BLOCKING_CASE_STATUSES as readonly string[]).includes(c.status));
}

// ── Atomic per-order park (P0-1) — one transaction; any failure aborts, leaving the order UNTOUCHED ────────────────
export interface ParkArgs {
  orderId: string;
  prior: string; // the pre-quarantine Order.status, encoded into the marker
  cases: ActiveCaseRow[]; // this order's active cases (all open/retry_scheduled after the blocking pre-scan)
  now: Date;
}
export interface ParkDeps {
  writeHold?: typeof writeOrderHoldFenced;
  resolveCase?: typeof resolveActiveRecoveryCaseInTx;
}

/**
 * Park ONE order atomically: (1) job → failed/failed/retryable=false, (2) neutralize each active case in its own
 * scope, (3) order → needs_human_qa via the funnel with a quarantine_cutover: marker. ALL in one $transaction: a
 * failure at ANY step throws, so Prisma rolls the whole thing back and the order is left exactly as it was. A resolver
 * that returns false (case not safely cancellable — a race or an action already attempted) ABORTS; a hold write that
 * does not return 'applied' ('superseded'/'input_drift'/'lost') ABORTS.
 */
export async function parkOneOrderAtomic(prisma: PrismaClient, args: ParkArgs, deps: ParkDeps = {}): Promise<void> {
  const writeHold = deps.writeHold ?? writeOrderHoldFenced;
  const resolveCase = deps.resolveCase ?? resolveActiveRecoveryCaseInTx;
  await prisma.$transaction(async (tx) => {
    await tx.generationJob.updateMany({
      where: { orderId: args.orderId },
      data: { status: 'failed', currentStage: 'failed', retryable: false, lastError: 'cutover_quarantine', failedAt: args.now },
    });
    for (const c of args.cases) {
      const ok = await resolveCase(tx, { orderId: args.orderId, scope: c.scope, kinds: [c.kind], reason: 'cutover_quarantine', now: args.now });
      if (!ok) {
        throw new Error(`[quarantine] ${args.orderId}: ExceptionCase ${c.id} (scope=${c.scope}, kind=${c.kind}, status=${c.status}) could not be safely neutralized — aborting park`);
      }
    }
    const res = await writeHold(tx as unknown as Prisma.TransactionClient, {
      orderId: args.orderId,
      newStatus: 'needs_human_qa',
      newHoldReason: `quarantine_cutover:${args.prior}`,
      requireNotDelivered: true,
    });
    if (res !== 'applied') {
      throw new Error(`[quarantine] ${args.orderId}: order hold write returned '${res}' (expected 'applied') — aborting park`);
    }
  });
}

// ── Post-verification (P0-7) — every order must have parked EXACTLY; caller exits non-zero on any mismatch ─────────
export interface VerifyMismatch {
  orderId: string;
  reason: string;
}
export async function verifyParked(prisma: PrismaClient, orderIds: string[]): Promise<VerifyMismatch[]> {
  const mismatches: VerifyMismatch[] = [];
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, status: true, deliveryHoldReason: true, generationJob: { select: { status: true, currentStage: true } } },
  });
  const seen = new Set(orders.map((o) => o.id));
  for (const id of orderIds) if (!seen.has(id)) mismatches.push({ orderId: id, reason: 'order row vanished' });
  for (const o of orders) {
    if (o.status !== 'needs_human_qa') mismatches.push({ orderId: o.id, reason: `status is '${o.status}', expected 'needs_human_qa'` });
    else if (!(o.deliveryHoldReason ?? '').startsWith('quarantine_cutover:')) mismatches.push({ orderId: o.id, reason: `marker is '${o.deliveryHoldReason}', expected 'quarantine_cutover:*'` });
    if (o.generationJob && (o.generationJob.status !== 'failed' || o.generationJob.currentStage !== 'failed')) {
      mismatches.push({ orderId: o.id, reason: `job is ${o.generationJob.status}/${o.generationJob.currentStage}, expected failed/failed` });
    }
  }
  return mismatches;
}
