import 'server-only';

import type { HumanQaHoldKind, Prisma, PrismaClient } from '@prisma/client';
import { recordHumanQaHoldInTx, resolveHumanQaCaseOnReleaseInTx } from '@/lib/human-qa/record-hold';
import { humanReasonForHoldKind } from '@/lib/human-qa/hold-kind';
import { createLogger } from '@/lib/logger';

const log = createLogger({ subsystem: 'human-qa-sync-hold-case' });

/**
 * (Human-QA Slice 1, re-gate P0-1) The case/outbox lifecycle lives OUTSIDE every hold/money transaction.
 *
 * WHY: `recordHumanQaHoldInTx` does reads, updates, and can THROW (supersede/skip races). If a seam `await`s it
 * inside its money/hold transaction, ANY rejection rolls back the paid transition (money) or the park itself (an
 * unheld order = a safety regression). So a seam commits the Order with `needs_human_qa` + the marker ONLY, and
 * then calls `syncHumanQaHoldCase` POST-COMMIT, in its own transaction, best-effort. A failed post-commit write is
 * repaired by the reconciler (which calls this SAME function) — the guaranteed safety net that closes the window.
 * This deliberately trades case-atomicity for hold/money integrity.
 *
 * This module NEVER decides whether to hold. It reads the Order's already-committed state and reconciles the case.
 */

/** ExceptionCase statuses that mean the recoverable auto-recovery loop still OWNS this order. */
const ACTIVE_RECOVERY_STATUSES = ['open', 'retry_scheduled', 'customer_action', 'refund_pending'] as const;

export interface HoldSignals {
  status: string;
  deliveryHoldReason: string | null;
  manualReviewRequired: boolean;
  /** True iff an active ExceptionCase (the recoverable recovery loop) owns this order. */
  hasActiveRecoveryCase: boolean;
}

export type HoldClassification =
  | { create: true; kind: HumanQaHoldKind; scope: 'base_book' | 'payment' }
  | { create: false; reason: 'not_held' | 'recoverable' | 'exception_case' | 'unknown' };

/**
 * PURE. Decide whether an already-committed Order state warrants a MANUAL review case, and of what kind.
 *
 * ONLY terminal manual holds get a case (P1-3): the safety/contract_world/anchor markers, and the payment fence
 * (manualReviewRequired). A recoverable `base_book_integrity:` park or an order with an active ExceptionCase is
 * owned by the auto-recovery loop → NO case. An unknown/null marker is NEVER auto-backfilled — it requires explicit
 * operator opt-in (`includeUnknown`), so the reconciler can never spam operators for a park it does not understand.
 */
export function classifyHoldForCase(
  signals: HoldSignals,
  opts: { includeUnknown?: boolean } = {},
): HoldClassification {
  if (signals.status !== 'needs_human_qa') return { create: false, reason: 'not_held' };
  const reason = signals.deliveryHoldReason ?? '';

  if (reason.startsWith('safety_hold:')) return { create: true, kind: 'safety', scope: 'base_book' };
  if (reason.startsWith('contract_world_hold:')) return { create: true, kind: 'contract_world', scope: 'base_book' };
  if (reason.startsWith('anchor_low_confidence:')) return { create: true, kind: 'anchor', scope: 'base_book' };

  // The payment-integrity fence sets manualReviewRequired + a coupon-fence marker (not one of the above).
  if (signals.manualReviewRequired) return { create: true, kind: 'payment_integrity', scope: 'payment' };

  // Recoverable base-book integrity park is owned by the ExceptionCase recovery loop — never a manual case.
  if (reason.startsWith('base_book_integrity:')) return { create: false, reason: 'recoverable' };
  // Any active recovery case means the recovery loop is repairing this order — do not open a manual case over it.
  if (signals.hasActiveRecoveryCase) return { create: false, reason: 'exception_case' };

  // Unrecognized/null marker: NEVER auto-backfill. Explicit opt-in only.
  if (opts.includeUnknown) return { create: true, kind: 'legacy_unknown', scope: 'base_book' };
  return { create: false, reason: 'unknown' };
}

export interface SyncHoldCaseResult {
  action: 'created' | 'idempotent' | 'resolved' | 'skipped' | 'would_create' | 'error';
  kind?: HumanQaHoldKind;
  scope?: 'base_book' | 'payment';
  reason?: string;
  caseId?: string;
  error?: string;
}

type PrismaLike = PrismaClient;

/**
 * Reconcile ONE order's review-case with its already-committed status. Best-effort, its own transaction(s):
 *  - `ready`          → resolve any active ANCHOR case (an anchor hold that reached delivery must not linger open).
 *  - `needs_human_qa` → classify; open the case (own tx) for a terminal manual hold; skip recoverable/unknown.
 *  - otherwise        → no-op.
 *
 * Used BOTH as the post-commit hook at each seam AND per-order by the reconciler — so the reconciler is literally
 * the automatic repair for a post-commit write that failed. NEVER throws control-flow at a seam: the seam wraps the
 * call in `.catch(...)`; the reconciler surfaces `action:'error'`.
 */
export async function syncHumanQaHoldCase(
  prisma: PrismaLike,
  orderId: string,
  opts: { includeUnknown?: boolean; dryRun?: boolean } = {},
): Promise<SyncHoldCaseResult> {
  // Cheap UNLOCKED pre-read: short-circuit no_order, and serve dry-run WITHOUT taking a row lock or writing.
  const pre = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, deliveryHoldReason: true, manualReviewRequired: true },
  });
  if (!pre) return { action: 'skipped', reason: 'no_order' };

  if (opts.dryRun) {
    if (pre.status === 'ready') return { action: 'skipped', reason: 'ready_dry_run' };
    if (pre.status !== 'needs_human_qa') return { action: 'skipped', reason: 'not_held' };
    const activeRecovery = await prisma.exceptionCase.findFirst({
      where: { orderId, status: { in: ACTIVE_RECOVERY_STATUSES as unknown as Prisma.Enumerable<never> } },
      select: { id: true },
    });
    const cls = classifyHoldForCase(
      {
        status: pre.status,
        deliveryHoldReason: pre.deliveryHoldReason,
        manualReviewRequired: pre.manualReviewRequired,
        hasActiveRecoveryCase: activeRecovery !== null,
      },
      { includeUnknown: opts.includeUnknown },
    );
    return cls.create
      ? { action: 'would_create', kind: cls.kind, scope: cls.scope }
      : { action: 'skipped', reason: cls.reason, scope: undefined };
  }

  // Only needs_human_qa (open a case) or ready (resolve a lingering anchor case) are actionable.
  if (pre.status !== 'needs_human_qa' && pre.status !== 'ready') return { action: 'skipped', reason: 'not_held' };

  // (re-gate P1 — TOCTOU) AUTHORITATIVE decision + write in ONE transaction that re-reads/LOCKS the Order (FOR
  // UPDATE). The status the classification is made on is the status it is written against, so a concurrent release
  // flipping the Order to `ready` between the pre-read and here can NEVER open a case on an already-released order —
  // the locked re-read sees `ready` and resolves instead of creating.
  return await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{
        status: string;
        deliveryHoldReason: string | null;
        manualReviewRequired: boolean;
        childName: string;
        inputVersion: number;
        visualContractHash: string | null;
      }>
    >`
      SELECT "status", "deliveryHoldReason", "manualReviewRequired", "childName", "inputVersion", "visualContractHash"
      FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const row = locked[0];
    if (!row) return { action: 'skipped', reason: 'no_order' };

    // A delivered/released order must NEVER get a case opened — resolve any lingering anchor case instead (close-only).
    if (row.status === 'ready') {
      const r = await resolveHumanQaCaseOnReleaseInTx(tx, {
        orderId,
        scope: 'base_book',
        kinds: ['anchor'],
        actor: 'system:ready_transition',
      });
      return { action: r.resolvedCaseId ? 'resolved' : 'skipped', reason: r.resolvedCaseId ? undefined : 'no_anchor_case' };
    }
    if (row.status !== 'needs_human_qa') return { action: 'skipped', reason: 'not_held' };

    const activeRecovery = await tx.exceptionCase.findFirst({
      where: { orderId, status: { in: ACTIVE_RECOVERY_STATUSES as unknown as Prisma.Enumerable<never> } },
      select: { id: true },
    });
    const cls = classifyHoldForCase(
      {
        status: row.status,
        deliveryHoldReason: row.deliveryHoldReason,
        manualReviewRequired: row.manualReviewRequired,
        hasActiveRecoveryCase: activeRecovery !== null,
      },
      { includeUnknown: opts.includeUnknown },
    );
    if (!cls.create) return { action: 'skipped', reason: cls.reason, scope: undefined };

    const rawReason = row.deliveryHoldReason ?? `${cls.kind}:reconciled`;
    const res = await recordHumanQaHoldInTx(tx, {
      orderId,
      scope: cls.scope,
      kind: cls.kind,
      rawReason,
      humanReason: humanReasonForHoldKind(cls.kind, rawReason),
      childName: row.childName,
      inputVersion: row.inputVersion,
      contractHash: row.visualContractHash,
      sourceManifestId: null,
      artifactRefs: null,
    });
    return {
      action: res.action === 'create' || res.action === 'supersede' ? 'created' : 'idempotent',
      kind: cls.kind,
      scope: cls.scope,
      caseId: res.caseId,
    };
  });
}

/**
 * The post-commit hook the seams call AFTER their hold/money tx commits. NEVER throws into the seam — a failed
 * case write is logged + COUNTED (re-gate P0-B) and left for the scheduled reconciler cron to repair. Fire-and-await
 * so it is attempted immediately, but a rejection is swallowed (the money/hold is already durably committed).
 *
 * The failure is emitted as a structured metric event so it is alertable: a nonzero rate here means the reconciler
 * cron (app/api/generate/cron/human-qa-reconcile) is now the load-bearing repair for those holds. The bare `catch {}`
 * that hid this (round-2 P0-B NO-GO) is gone.
 */
export async function syncHumanQaHoldCasePostCommit(prisma: PrismaLike, orderId: string): Promise<void> {
  try {
    await syncHumanQaHoldCase(prisma, orderId);
  } catch (err) {
    // Swallowed by design (never throw into the seam): the hold/money is committed. But it is LOGGED + COUNTED so a
    // silent hold is observable — the scheduled reconciler cron is the guaranteed repair for this exact failure.
    log.error('post-commit case sync failed — hold committed, case deferred to the reconciler cron', err, {
      orderId,
      event: 'human_qa_case_sync_post_commit_failed',
      metric: 'human_qa.case_sync.post_commit_failure',
      metricValue: 1,
    });
  }
}
