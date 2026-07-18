import 'server-only';

import type { HumanQaHoldKind, Prisma, PrismaClient } from '@prisma/client';
import { recordHumanQaHoldInTx, resolveHumanQaCaseOnReleaseInTx } from '@/lib/human-qa/record-hold';
import { humanReasonForHoldKind } from '@/lib/human-qa/hold-kind';

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
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      deliveryHoldReason: true,
      manualReviewRequired: true,
      childName: true,
      inputVersion: true,
      visualContractHash: true,
    },
  });
  if (!order) return { action: 'skipped', reason: 'no_order' };

  // A delivered (ready) order must not keep an anchor case open. Resolve is close-only (no create), safe anywhere.
  if (order.status === 'ready') {
    if (opts.dryRun) return { action: 'skipped', reason: 'ready_dry_run' };
    const r = await prisma.$transaction((tx) =>
      resolveHumanQaCaseOnReleaseInTx(tx, {
        orderId,
        scope: 'base_book',
        kinds: ['anchor'],
        actor: 'system:ready_transition',
      }),
    );
    return { action: r.resolvedCaseId ? 'resolved' : 'skipped', reason: r.resolvedCaseId ? undefined : 'no_anchor_case' };
  }

  if (order.status !== 'needs_human_qa') return { action: 'skipped', reason: 'not_held' };

  const activeRecovery = await prisma.exceptionCase.findFirst({
    where: { orderId, status: { in: ACTIVE_RECOVERY_STATUSES as unknown as Prisma.Enumerable<never> } },
    select: { id: true },
  });

  const cls = classifyHoldForCase(
    {
      status: order.status,
      deliveryHoldReason: order.deliveryHoldReason,
      manualReviewRequired: order.manualReviewRequired,
      hasActiveRecoveryCase: activeRecovery !== null,
    },
    { includeUnknown: opts.includeUnknown },
  );
  if (!cls.create) return { action: 'skipped', reason: cls.reason, scope: undefined };

  if (opts.dryRun) return { action: 'would_create', kind: cls.kind, scope: cls.scope };

  const rawReason = order.deliveryHoldReason ?? `${cls.kind}:reconciled`;
  const res = await prisma.$transaction((tx) =>
    recordHumanQaHoldInTx(tx, {
      orderId,
      scope: cls.scope,
      kind: cls.kind,
      rawReason,
      humanReason: humanReasonForHoldKind(cls.kind, rawReason),
      childName: order.childName,
      inputVersion: order.inputVersion,
      contractHash: order.visualContractHash,
      sourceManifestId: null,
      artifactRefs: null,
    }),
  );
  return {
    action: res.action === 'create' || res.action === 'supersede' ? 'created' : 'idempotent',
    kind: cls.kind,
    scope: cls.scope,
    caseId: res.caseId,
  };
}

/**
 * The post-commit hook the seams call AFTER their hold/money tx commits. NEVER throws into the seam — a failed
 * case write is logged and left for the reconciler to repair. Fire-and-await so it is attempted immediately, but
 * a rejection is swallowed (the money/hold is already durably committed).
 */
export async function syncHumanQaHoldCasePostCommit(prisma: PrismaLike, orderId: string): Promise<void> {
  try {
    await syncHumanQaHoldCase(prisma, orderId);
  } catch {
    // Swallowed by design: the hold/money is committed; the reconciler is the guaranteed repair for this write.
  }
}
