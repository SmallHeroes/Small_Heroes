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

/**
 * (cutover Track 1.3 hardening) Terminal human-QA parks that block EVERY resume/ship path. ORTHOGONAL to markerRank
 * (strength): a marker can be terminal-for-resume yet weak-for-precedence. `quarantine_cutover:` is such a case — it
 * stays markerRank 1 (a real safety_hold: can still escalate over it) but must never be resumed or shipped. Keep this
 * TS predicate and `TERMINAL_HOLD_NOT_LIKE_SQL` (below) in lock-step; both must list the exact same prefixes. PURE.
 * `manual_resolution_hold:` (Human-QA Slice 4 PARK) is the same shape — an operator freezes a book for manual
 * resolution: terminal-for-resume/ship, markerRank 1 (a real safety_hold: can still escalate over it). */
export function isDeliveryTerminalHold(reason: string | null | undefined): boolean {
  const r = reason ?? '';
  return r.startsWith('safety_hold:') || r.startsWith('contract_world_hold:') || r.startsWith('quarantine_cutover:')
    || r.startsWith('manual_resolution_hold:');
}

/** SQL twin of isDeliveryTerminalHold: true when the row is NOT held by a terminal park (so a ship may proceed). The
 *  ship CAS interpolates this so the SQL blocklist can never drift from the TS `isDeliveryTerminalHold` set. */
export const TERMINAL_HOLD_NOT_LIKE_SQL = Prisma.sql`("deliveryHoldReason" IS NULL
       OR ("deliveryHoldReason" NOT LIKE 'safety_hold:%' AND "deliveryHoldReason" NOT LIKE 'contract_world_hold:%' AND "deliveryHoldReason" NOT LIKE 'quarantine_cutover:%' AND "deliveryHoldReason" NOT LIKE 'manual_resolution_hold:%'))`;

/**
 * (release-as-readiness-mode, 2a-0) The marker a FALSE-POSITIVE safety release stamps IN PLACE of the original
 * `safety_hold:hazard:<detail>` — the intermediate that lets the ship CAS proceed (safety_hold: is terminal; this is
 * not). It is DELIVERABLE **by explicit declaration, not by absence** from the terminal blocklist above: the
 * `isDeliveryTerminalHold`/`TERMINAL_HOLD_NOT_LIKE_SQL` set MUST NOT list `qa_released:`, and the guard test asserts
 * exactly that + that a prefix TYPO is not silently accepted. It stays markerRank 1 so a genuinely new safety hazard
 * on a later render can still escalate over it (a released false positive never suppresses a real one).
 */
export const QA_RELEASED_SAFETY_PREFIX = 'qa_released:safety:';

/** Build the released marker from the original `safety_hold:hazard:<detail>` — the detail is preserved for audit
 *  (`qa_released:safety:hazard:page:4:…`). Throws if handed something that is not a safety hazard marker, so this can
 *  never mint a released marker for an unverified / non-safety hold. */
export function qaReleasedSafetyMarker(originalSafetyMarker: string): string {
  if (!originalSafetyMarker.startsWith('safety_hold:hazard:')) {
    throw new Error(`[order-authority] qaReleasedSafetyMarker: not a safety hazard marker: ${originalSafetyMarker}`);
  }
  return `${QA_RELEASED_SAFETY_PREFIX}${originalSafetyMarker.slice('safety_hold:'.length)}`;
}

/** Recognise a canonical released marker. A prefix TYPO (e.g. `qa_relesed:`) returns false — it is never silently
 *  treated as a released state (an unrecognised marker is the silent-un-hold failure this declaration exists to close). */
export function isQaReleasedSafetyMarker(reason: string | null | undefined): boolean {
  return (reason ?? '').startsWith(QA_RELEASED_SAFETY_PREFIX);
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

/**
 * THE shared ready-transition (SHIP) CAS. Flips the order to `ready` ONLY IF, atomically at write time: inputVersion
 * unchanged (B4) AND the SHARED fence unchanged since load AND no payment fence AND no terminal safety_/contract_world_
 * marker AND no active strong Human-QA case. `requireHoldReason` (flag-ON anchor-release ONLY) additionally pins
 * status=needs_human_qa + the exact authorized marker. Returns rows updated: 1 = shipped; 0 = a competing hold (or an
 * input drift) blocked it. Exported so the real-PG harness exercises the EXACT production SQL (no drift).
 */
export async function executeReadinessShipCas(
  db: Db,
  p: {
    orderId: string;
    inputVersion: number;
    deliveryFenceVersion: number;
    deliveryHoldReason: string | null;
    requireHoldReason?: string | null;
  },
): Promise<number> {
  const requireHoldClause = p.requireHoldReason
    ? Prisma.sql` AND "status" = 'needs_human_qa' AND "deliveryHoldReason" = ${p.requireHoldReason}`
    : Prisma.empty;
  return db.$executeRaw`
    UPDATE "Order"
       SET "status" = 'ready'::"OrderStatus", "packageStatus" = 'done'::"GenerationStatus", "deliveryHoldReason" = ${p.deliveryHoldReason}
     WHERE "id" = ${p.orderId}
       AND "inputVersion" = ${p.inputVersion}
       AND "deliveryFenceVersion" = ${p.deliveryFenceVersion}
       AND "manualReviewRequired" = false
       AND ${TERMINAL_HOLD_NOT_LIKE_SQL}
       AND NOT EXISTS (
         SELECT 1 FROM "HumanQaReviewCase" c
          WHERE c."activeKey" IN (${p.orderId + ':base_book'}, ${p.orderId + ':payment'})
            AND c."status" = 'open'
            AND c."kind" IN ('safety', 'contract_world', 'payment_integrity')
       )${requireHoldClause}`;
}

/**
 * THE anchor-release (RELEASE) CAS (flag-OFF path). Flips needs_human_qa → ready ONLY IF the row is STILL held at
 * exactly the authorized anchor marker, with no payment fence and NO active strong Human-QA case (the skip_weaker
 * guard). The exact-marker match is the bind-equivalent — any competing hold that landed changed the marker (or set
 * manualReviewRequired / opened a strong case) → 0 rows. Bumps the fence so the release participates in the monotonic
 * sequence. Returns rows updated: 1 = released; 0 = a stronger hold is active or the marker moved.
 */
export async function executeAnchorReleaseCas(
  db: Db,
  p: { orderId: string; expectedHoldReason: string },
): Promise<number> {
  return db.$executeRaw`
    UPDATE "Order"
       SET "status" = 'ready'::"OrderStatus", "deliveryHoldReason" = NULL, "deliveryFenceVersion" = "deliveryFenceVersion" + 1
     WHERE "id" = ${p.orderId}
       AND "status" = 'needs_human_qa'
       AND "deliveryHoldReason" = ${p.expectedHoldReason}
       AND "manualReviewRequired" = false
       AND NOT EXISTS (
         SELECT 1 FROM "HumanQaReviewCase" c
          WHERE c."activeKey" IN (${p.orderId + ':base_book'}, ${p.orderId + ':payment'})
            AND c."status" = 'open'
            AND c."kind" IN ('safety', 'contract_world', 'payment_integrity')
       )`;
}
