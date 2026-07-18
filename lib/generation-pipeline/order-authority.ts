import 'server-only';

import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

/**
 * (delivery fence — Codex round-5) THE shared Order-authority write funnel. Every write that changes
 * `Order.status`, `deliveryHoldReason` or `manualReviewRequired` MUST go through one of these helpers (enforced by
 * the structural guard in lib/__tests__/order-authority-writer-guard.spec.ts). Each enforces the round-5 rule:
 *   (a) BIND the observed `deliveryFenceVersion` in the WHERE,
 *   (b) BUMP it in the same statement,
 *   (c) on 0 rows NEVER overwrite — a competing authority write won; leave it and re-evaluate/abort,
 *   plus hold PRECEDENCE: a weaker hold never overwrites a stronger marker (safety > contract_world > else),
 *   independent of the fence.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Marker strength. safety(3) > contract_world(2) > everything else (anchor / base_book_integrity / soft-deliver /
 *  payment-fence / null)(1). PURE. */
export function markerRank(reason: string | null | undefined): 1 | 2 | 3 {
  const r = reason ?? '';
  if (r.startsWith('safety_hold:')) return 3;
  if (r.startsWith('contract_world_hold:')) return 2;
  return 1;
}

/** SQL for the CURRENT row's marker rank — the precedence guard compares against the incoming marker's rank. */
const CURRENT_RANK_SQL = Prisma.sql`(CASE
  WHEN "deliveryHoldReason" LIKE 'safety_hold:%' THEN 3
  WHEN "deliveryHoldReason" LIKE 'contract_world_hold:%' THEN 2
  ELSE 1 END)`;

export type HoldWriteResult = 'applied' | 'superseded' | 'input_drift' | 'lost';

export interface HoldWriteArgs {
  orderId: string;
  newStatus: string;
  newHoldReason: string;
  /** Set manualReviewRequired (payment fence). Omitted → column untouched. */
  manualReviewRequired?: boolean;
  /** Also set packageStatus='done' (the package-boundary parks). */
  setPackageDone?: boolean;
  /** Never retract an already-delivered book (park guard: status NOT IN ('ready','partial')). */
  requireNotDelivered?: boolean;
  /** B4 optimistic-concurrency bind (readiness): abort as input_drift if inputVersion changed. */
  inputVersion?: number;
}

/**
 * Bind + bump + never-overwrite a HOLD write, with marker precedence. Reads the current fence, CASes the write bound
 * to it (and to the precedence + optional inputVersion/not-delivered guards), and bumps the fence in the SAME
 * statement. On a bare fence-move it re-reads and retries; if a STRONGER marker is present it returns 'superseded'
 * (never overwrites); on an inputVersion drift it returns 'input_drift' (the readiness caller re-evaluates FRESH).
 */
export async function writeOrderHoldFenced(db: Db, p: HoldWriteArgs, maxRetries = 6): Promise<HoldWriteResult> {
  const newRank = markerRank(p.newHoldReason);
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const cur = await db.$queryRaw<Array<{ fence: number; rank: number; status: string; inputVersion: number }>>`
      SELECT "deliveryFenceVersion" AS fence, ${CURRENT_RANK_SQL} AS rank, "status"::text AS status, "inputVersion" AS "inputVersion"
        FROM "Order" WHERE "id" = ${p.orderId}`;
    if (cur.length === 0) return 'lost';
    const row = cur[0];
    if (Number(row.rank) > newRank) return 'superseded'; // a stronger marker is present → never overwrite
    if (p.requireNotDelivered && (row.status === 'ready' || row.status === 'partial')) return 'superseded';
    if (p.inputVersion !== undefined && row.inputVersion !== p.inputVersion) return 'input_drift';

    const manualClause = p.manualReviewRequired !== undefined
      ? Prisma.sql`, "manualReviewRequired" = ${p.manualReviewRequired}` : Prisma.empty;
    const packageClause = p.setPackageDone ? Prisma.sql`, "packageStatus" = 'done'::"GenerationStatus"` : Prisma.empty;
    const inputBind = p.inputVersion !== undefined ? Prisma.sql` AND "inputVersion" = ${p.inputVersion}` : Prisma.empty;
    const notDeliveredBind = p.requireNotDelivered ? Prisma.sql` AND "status" NOT IN ('ready','partial')` : Prisma.empty;
    const updated = await db.$executeRaw`
      UPDATE "Order"
         SET "status" = ${p.newStatus}::"OrderStatus", "deliveryHoldReason" = ${p.newHoldReason}, "deliveryFenceVersion" = "deliveryFenceVersion" + 1${manualClause}${packageClause}
       WHERE "id" = ${p.orderId}
         AND "deliveryFenceVersion" = ${row.fence}
         AND ${CURRENT_RANK_SQL} <= ${newRank}${inputBind}${notDeliveredBind}`;
    if (updated === 1) return 'applied';
    // 0 rows — a concurrent authority write moved the fence (or a stronger marker / input drift / delivery landed).
    // Loop: the next read reclassifies (→ 'superseded' / 'input_drift' / retry the bare fence move).
  }
  return 'lost';
}
