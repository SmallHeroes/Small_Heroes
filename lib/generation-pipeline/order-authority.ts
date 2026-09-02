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

/**
 * The explicit non-terminal marker for a human verification of one exact-byte page whose automated safety signal
 * remained `unverified`. This is intentionally distinct from `qa_released:safety:`: the latter means a confirmed
 * hazard was judged a false positive, while this marker means a human verified an otherwise hazardless page without
 * fabricating an automated safety verdict. Both remain rank 1 so a later real safety hold can always supersede them.
 */
export const QA_HUMAN_VERIFIED_UNVERIFIED_PREFIX = 'qa_human_verified:safety:unverified:';

export interface HumanVerifiedUnverifiedPageMarker {
  pageNumber: number;
}

const SINGLE_PAGE_SAFETY_UNVERIFIED_RE = /^safety_hold:unverified:page:([1-9][0-9]*)$/;
const HUMAN_VERIFIED_UNVERIFIED_RE = /^qa_human_verified:safety:unverified:page:([1-9][0-9]*)$/;

function parsePositiveSafePageNumber(match: RegExpExecArray | null): HumanVerifiedUnverifiedPageMarker | null {
  if (!match) return null;
  const pageNumber = Number(match[1]);
  return Number.isSafeInteger(pageNumber) ? { pageNumber } : null;
}

/** Parse exactly one canonical page-only `safety_hold:unverified:` marker. Cover, multi-page and hazard markers fail. */
export function parseSinglePageSafetyUnverifiedMarker(
  reason: string | null | undefined,
): HumanVerifiedUnverifiedPageMarker | null {
  return parsePositiveSafePageNumber(SINGLE_PAGE_SAFETY_UNVERIFIED_RE.exec(reason ?? ''));
}

/** Parse a canonical human-verified-unverified marker. Prefix typos and non-page targets fail closed. */
export function parseHumanVerifiedUnverifiedPageMarker(
  reason: string | null | undefined,
): HumanVerifiedUnverifiedPageMarker | null {
  return parsePositiveSafePageNumber(HUMAN_VERIFIED_UNVERIFIED_RE.exec(reason ?? ''));
}

/**
 * Build the non-terminal marker from exactly one page-only `safety_hold:unverified:page:<n>` marker. The source
 * marker's page number is preserved, and every aggregate/malformed/non-unverified source is rejected.
 */
export function humanVerifiedUnverifiedMarker(originalSafetyMarker: string): string {
  const parsed = parseSinglePageSafetyUnverifiedMarker(originalSafetyMarker);
  if (!parsed) {
    throw new Error(
      `[order-authority] humanVerifiedUnverifiedMarker: not a single-page safety-unverified marker: ${originalSafetyMarker}`,
    );
  }
  return `${QA_HUMAN_VERIFIED_UNVERIFIED_PREFIX}page:${parsed.pageNumber}`;
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
  /**
   * (Codex round-9) Bind the hold to a SPECIFIC still-open HumanQaReviewCase: the write lands only
   * while `HumanQaReviewCase.id = requireOpenCaseId AND status = 'open'` holds ATOMICALLY in the
   * same UPDATE (and the fenced pre-read short-circuits to 'lost' when the case already closed).
   * This is how a case-derived Order disposition proves the case still governs at commit — a bare
   * case read is never sufficient authority. 'lost' here means NO hold landed; the caller
   * re-evaluates fresh (it must never conclude done/held on it).
   */
  requireOpenCaseId?: string;
}

/**
 * Bind + bump + never-overwrite a HOLD write, with marker precedence. Reads the current fence, CASes the write bound
 * to it (and to the precedence + optional inputVersion/not-delivered guards), and bumps the fence in the SAME
 * statement. On a bare fence-move it re-reads and retries; if a STRONGER marker is present it returns 'superseded'
 * (never overwrites); on an inputVersion drift it returns 'input_drift' (the readiness caller re-evaluates FRESH).
 */
export async function writeOrderHoldFenced(db: Db, p: HoldWriteArgs, maxRetries = 6): Promise<HoldWriteResult> {
  const newRank = markerRank(p.newHoldReason);
  const openCaseProbe = p.requireOpenCaseId !== undefined
    ? Prisma.sql`, EXISTS(SELECT 1 FROM "HumanQaReviewCase" c WHERE c."id" = ${p.requireOpenCaseId} AND c."status" = 'open') AS "caseOpen"`
    : Prisma.empty;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const cur = await db.$queryRaw<Array<{ fence: number; rank: number; status: string; inputVersion: number; caseOpen?: boolean }>>`
      SELECT "deliveryFenceVersion" AS fence, ${CURRENT_RANK_SQL} AS rank, "status"::text AS status, "inputVersion" AS "inputVersion"${openCaseProbe}
        FROM "Order" WHERE "id" = ${p.orderId}`;
    if (cur.length === 0) return 'lost';
    const row = cur[0];
    if (Number(row.rank) > newRank) return 'superseded'; // a stronger marker is present → never overwrite
    if (p.requireNotDelivered && (row.status === 'ready' || row.status === 'partial')) return 'superseded';
    if (p.inputVersion !== undefined && row.inputVersion !== p.inputVersion) return 'input_drift';
    if (p.requireOpenCaseId !== undefined && row.caseOpen !== true) return 'lost'; // the governing case closed → no authority, no hold

    const manualClause = p.manualReviewRequired !== undefined
      ? Prisma.sql`, "manualReviewRequired" = ${p.manualReviewRequired}` : Prisma.empty;
    const packageClause = p.setPackageDone ? Prisma.sql`, "packageStatus" = 'done'::"GenerationStatus"` : Prisma.empty;
    const inputBind = p.inputVersion !== undefined ? Prisma.sql` AND "inputVersion" = ${p.inputVersion}` : Prisma.empty;
    const notDeliveredBind = p.requireNotDelivered ? Prisma.sql` AND "status" NOT IN ('ready','partial')` : Prisma.empty;
    const openCaseBind = p.requireOpenCaseId !== undefined
      ? Prisma.sql` AND EXISTS(SELECT 1 FROM "HumanQaReviewCase" c WHERE c."id" = ${p.requireOpenCaseId} AND c."status" = 'open')`
      : Prisma.empty;
    const updated = await db.$executeRaw`
      UPDATE "Order"
         SET "status" = ${p.newStatus}::"OrderStatus", "deliveryHoldReason" = ${p.newHoldReason}, "deliveryFenceVersion" = "deliveryFenceVersion" + 1${manualClause}${packageClause}
       WHERE "id" = ${p.orderId}
         AND "deliveryFenceVersion" = ${row.fence}
         AND ${CURRENT_RANK_SQL} <= ${newRank}${inputBind}${notDeliveredBind}${openCaseBind}`;
    if (updated === 1) return 'applied';
    // 0 rows — a concurrent authority write moved the fence (or a stronger marker / input drift / delivery landed).
    // Loop: the next read reclassifies (→ 'superseded' / 'input_drift' / retry the bare fence move).
  }
  return 'lost';
}

/**
 * THE shared ready-transition (SHIP) CAS. Flips the order to `ready` ONLY IF, atomically at write time: inputVersion
 * unchanged (B4) AND the SHARED fence unchanged since load AND no payment fence AND no terminal safety_/contract_world_
 * marker AND no active strong Human-QA case AND NOT already in a delivered state (`ready`/`partial`).
 * `requireHoldReason` (flag-ON anchor-release ONLY) additionally pins status=needs_human_qa + the exact authorized marker.
 * Returns rows updated: 1 = shipped; 0 = a competing hold (or an input drift, or already-delivered) blocked it.
 * Exported so the real-PG harness exercises the EXACT production SQL (no drift).
 */
export async function executeReadinessShipCas(
  db: Db,
  p: {
    orderId: string;
    inputVersion: number;
    deliveryFenceVersion: number;
    deliveryHoldReason: string | null;
    requireHoldReason?: string | null;
    /**
     * (Codex round-5) Bind the ship to the OBSERVED anchor-disposition source on the producing
     * snapshot: the ship matches only while `GenerationJob.pipelineCache -> 'childAnchorLowConfidence'`
     * still equals the exact value the delivery disposition was derived from. Ordinary cache writes do
     * not bump `inputVersion`, so without this a post-read band flip could ship a stale "allow".
     * Pass `{ childAnchorLowConfidence: <observed value or null> }`; omit to leave the SQL unchanged.
     */
    producingAnchorBind?: { childAnchorLowConfidence: unknown };
  },
): Promise<number> {
  const requireHoldClause = p.requireHoldReason
    ? Prisma.sql` AND "status" = 'needs_human_qa' AND "deliveryHoldReason" = ${p.requireHoldReason}`
    : Prisma.empty;
  const producingAnchorClause = p.producingAnchorBind
    ? Prisma.sql` AND COALESCE((SELECT j."pipelineCache" -> 'childAnchorLowConfidence' FROM "GenerationJob" j WHERE j."orderId" = "Order"."id"), 'null'::jsonb) = ${JSON.stringify(p.producingAnchorBind.childAnchorLowConfidence ?? null)}::jsonb`
    : Prisma.empty;
  return db.$executeRaw`
    UPDATE "Order"
       SET "status" = 'ready'::"OrderStatus", "packageStatus" = 'done'::"GenerationStatus", "deliveryHoldReason" = ${p.deliveryHoldReason}
     WHERE "id" = ${p.orderId}
       AND "inputVersion" = ${p.inputVersion}
       AND "deliveryFenceVersion" = ${p.deliveryFenceVersion}
       AND "manualReviewRequired" = false
       AND "status" NOT IN ('ready'::"OrderStatus", 'partial'::"OrderStatus")
       AND ${TERMINAL_HOLD_NOT_LIKE_SQL}
       AND NOT EXISTS (
         SELECT 1 FROM "HumanQaReviewCase" c
          WHERE c."activeKey" IN (${p.orderId + ':base_book'}, ${p.orderId + ':payment'})
            AND c."status" = 'open'
            AND c."kind" IN ('safety', 'contract_world', 'payment_integrity')
       )${requireHoldClause}${producingAnchorClause}`;
}

/**
 * THE anchor-release (RELEASE) CAS (flag-OFF path). Flips needs_human_qa → ready ONLY IF the row is STILL held at
 * exactly the authorized anchor marker, with no payment fence and NO active strong Human-QA case (the skip_weaker
 * guard), AND (Codex round-4 MAJOR 5) still at the exact `inputVersion` + `deliveryFenceVersion` the in-tx release
 * evaluation re-proved the producing-snapshot binding and captured the email payload under — every delivery-input
 * writer bumps `inputVersion` through the barrier and every hold write bumps the fence, so a mutation between that
 * evaluation and this write matches 0 rows. The exact-marker match remains the authorization bind. Bumps the fence
 * so the release participates in the monotonic sequence. Returns rows updated: 1 = released; 0 = a stronger hold is
 * active, the marker moved, or the evaluated snapshot went stale.
 */
export async function executeAnchorReleaseCas(
  db: Db,
  p: {
    orderId: string;
    expectedHoldReason: string;
    expectedInputVersion: number;
    expectedDeliveryFenceVersion: number;
  },
): Promise<number> {
  return db.$executeRaw`
    UPDATE "Order"
       SET "status" = 'ready'::"OrderStatus", "deliveryHoldReason" = NULL, "deliveryFenceVersion" = "deliveryFenceVersion" + 1
     WHERE "id" = ${p.orderId}
       AND "status" = 'needs_human_qa'
       AND "deliveryHoldReason" = ${p.expectedHoldReason}
       AND "inputVersion" = ${p.expectedInputVersion}
       AND "deliveryFenceVersion" = ${p.expectedDeliveryFenceVersion}
       AND "manualReviewRequired" = false
       AND NOT EXISTS (
         SELECT 1 FROM "HumanQaReviewCase" c
          WHERE c."activeKey" IN (${p.orderId + ':base_book'}, ${p.orderId + ':payment'})
            AND c."status" = 'open'
            AND c."kind" IN ('safety', 'contract_world', 'payment_integrity')
       )`;
}

/**
 * (release-as-readiness-mode, 2a-2) The ONE sanctioned rank-3→lower marker transition — a human FALSE-POSITIVE safety
 * release, and nothing else. A release must move `safety_hold:hazard:` (terminal, rank 3) to a non-terminal
 * `qa_released:safety:` so the ship CAS may proceed; `writeOrderHoldFenced`'s precedence guard REFUSES that downgrade
 * by design (which is what makes a safety hold sticky). This is authorised NOT by precedence but by the EXACT current
 * marker + the observed fence + `status='needs_human_qa'` — the operator acted on THIS marker at THIS fence.
 *
 * It NEVER sets `status='ready'` (commitBaseBookReadiness's ship CAS independently owns that, and both gates must
 * still agree); it only moves the marker and BUMPS the fence (so downstream must bind the post-transition fence). It
 * is NOT a general downgradeMarker: a new AST guard (safety-release-transition-caller.spec) enforces that ONLY the
 * release mode references it. Returns rows updated: 1 = transitioned; 0 = the marker moved / fence bumped / no longer
 * held under the lock — the CAS is itself the release's idempotency (a replay matches 0 rows).
 */
export async function executeSafetyFalsePositiveReleaseTransition(
  db: Db,
  p: { orderId: string; expectedMarker: string; observedFence: number; releasedMarker: string },
): Promise<number> {
  if (!p.expectedMarker.startsWith('safety_hold:hazard:')) {
    throw new Error(`[order-authority] release transition: not a safety hazard marker: ${p.expectedMarker}`);
  }
  if (!isQaReleasedSafetyMarker(p.releasedMarker)) {
    throw new Error(`[order-authority] release transition: released marker must be qa_released:safety:, got: ${p.releasedMarker}`);
  }
  return db.$executeRaw`
    UPDATE "Order"
       SET "deliveryHoldReason" = ${p.releasedMarker}, "deliveryFenceVersion" = "deliveryFenceVersion" + 1
     WHERE "id" = ${p.orderId}
       AND "status" = 'needs_human_qa'
       AND "deliveryHoldReason" = ${p.expectedMarker}
       AND "deliveryFenceVersion" = ${p.observedFence}`;
}

/**
 * The separate rank-3 -> rank-1 marker transition for an exact-byte HUMAN verification of one page whose automated
 * safety result is `unverified`. This is deliberately not the confirmed-hazard false-positive path above and cannot
 * mint or accept its marker. Source and destination must name the SAME single page.
 *
 * The CAS closes every Order-authority drift window left after the apply layer validates the exact active base-book
 * case and evidence: exact marker, inputVersion, delivery fence, payment/manual fences and held status are all bound
 * at write time. The active base-book case is intentionally not excluded here because the caller resolves that exact
 * case in the same transaction after this transition. The marker move bumps the fence exactly once and never sets
 * the Order ready; readiness/ship remains a separate authority decision.
 */
export async function executeHumanVerifiedUnverifiedReleaseTransition(
  db: Db,
  p: {
    orderId: string;
    expectedMarker: string;
    observedFence: number;
    expectedInputVersion: number;
    releasedMarker: string;
  },
): Promise<number> {
  const expected = parseSinglePageSafetyUnverifiedMarker(p.expectedMarker);
  if (!expected) {
    throw new Error(
      `[order-authority] human-verified-unverified transition: not a single-page safety-unverified marker: ${p.expectedMarker}`,
    );
  }
  const released = parseHumanVerifiedUnverifiedPageMarker(p.releasedMarker);
  if (
    !released ||
    released.pageNumber !== expected.pageNumber ||
    p.releasedMarker !== humanVerifiedUnverifiedMarker(p.expectedMarker)
  ) {
    throw new Error(
      `[order-authority] human-verified-unverified transition: released marker must bind the same page: ${p.releasedMarker}`,
    );
  }

  return db.$executeRaw`
    UPDATE "Order"
       SET "deliveryHoldReason" = ${p.releasedMarker}, "deliveryFenceVersion" = "deliveryFenceVersion" + 1
     WHERE "id" = ${p.orderId}
       AND "status" = 'needs_human_qa'
       AND "deliveryHoldReason" = ${p.expectedMarker}
       AND "inputVersion" = ${p.expectedInputVersion}
       AND "deliveryFenceVersion" = ${p.observedFence}
       AND "manualReviewRequired" = false
       AND NOT EXISTS (
         SELECT 1 FROM "HumanQaReviewCase" c
          WHERE c."activeKey" = ${p.orderId + ':payment'}
            AND c."status" = 'open'
       )`;
}
