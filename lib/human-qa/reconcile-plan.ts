import type { HumanQaHoldKind } from '@prisma/client';
import {
  deriveHumanQaHoldKindFromOrder,
  scopeForHoldKind,
  type RecordHumanQaHoldArgs,
} from '@/lib/human-qa/record-hold';

/**
 * (Human-QA Slice 1, Unit 5) PURE reconcile planner for the idempotent BACKFILL of orders ALREADY sitting in
 * terminal `needs_human_qa`. The Unit-1 migration created the case tables but opens NO case for an order held
 * before those tables existed (or held while `recordHumanQaHoldInTx` was still inert) — that is the silent-hold
 * gap. The reconciler walks those orders and opens exactly one review case (+ its scheduled operator notification)
 * per order/scope.
 *
 * This module holds ONLY the deterministic decision — given an order row, WHICH kind / scope / args a case would be
 * recorded with. The DB loop (scripts/reconcile-human-qa-holds.ts) is the thin shell: it skips orders that already
 * have an active case and calls `recordHumanQaHoldInTx` per order in its own transaction. Determinism here is what
 * makes the whole backfill idempotent: a re-run produces the identical hold fingerprint, so `recordHumanQaHoldInTx`
 * collapses to its `idempotent` branch and writes nothing new.
 */

/** Fallback raw marker for an order held before markers existed (kept STABLE so re-runs stay idempotent). */
export const RECONCILE_LEGACY_RAW_REASON = 'legacy_unknown:reconciled';

/** The minimal Order fields the reconcile planner reads. */
export interface ReconcileOrderRow {
  id: string;
  deliveryHoldReason: string | null;
  manualReviewRequired: boolean;
  childName: string;
  inputVersion: number;
  visualContractHash: string | null;
}

export interface ReconcileOrderPlan {
  orderId: string;
  /** `${orderId}:${scope}` — the key the shell checks for an existing active case before writing. */
  activeKey: string;
  scope: 'base_book' | 'payment';
  kind: HumanQaHoldKind;
  /** True iff the kind could not be recognized (`legacy_unknown`) — still backfilled, but flagged for an operator. */
  needsOperatorAttention: boolean;
  /** The EXACT args (minus the tx) handed to `recordHumanQaHoldInTx`. */
  recordArgs: RecordHumanQaHoldArgs;
}

/** PURE. Readable, operator-facing reason derived from the raw hold marker (the notification carries this). */
export function deriveHumanReasonFromMarker(
  kind: HumanQaHoldKind,
  deliveryHoldReason: string | null,
): string {
  const detail = (deliveryHoldReason ?? '').trim();
  const withDetail = (base: string): string => (detail ? `${base} (${detail})` : base);
  switch (kind) {
    case 'safety':
      return withDetail('Child-safety hold flagged during QA; needs a human eye before delivery.');
    case 'contract_world':
      return withDetail('Visual-contract / world drift flagged during QA; needs a human review before delivery.');
    case 'anchor':
      return withDetail('Low-confidence character resemblance; needs a human look before delivery.');
    case 'payment_integrity':
      return withDetail('Payment-integrity fence tripped; needs a human decision before delivery.');
    case 'legacy_unknown':
      return withDetail(
        'Order is in needs_human_qa with no recognizable hold marker; needs explicit operator triage.',
      );
  }
}

/**
 * PURE. Map one terminal `needs_human_qa` order row to the case it should be reconciled into. Deterministic in the
 * order row alone — no DB, no clock, no randomness — so two calls with the same row are deeply equal. That
 * determinism (identical args ⇒ identical fingerprint) is the property the idempotency of the backfill rests on.
 */
export function planReconcileOrder(order: ReconcileOrderRow): ReconcileOrderPlan {
  const kind = deriveHumanQaHoldKindFromOrder({
    deliveryHoldReason: order.deliveryHoldReason,
    manualReviewRequired: order.manualReviewRequired,
  });
  const scope = scopeForHoldKind(kind);
  return {
    orderId: order.id,
    activeKey: `${order.id}:${scope}`,
    scope,
    kind,
    needsOperatorAttention: kind === 'legacy_unknown',
    recordArgs: {
      orderId: order.id,
      scope,
      kind,
      rawReason: order.deliveryHoldReason ?? RECONCILE_LEGACY_RAW_REASON,
      humanReason: deriveHumanReasonFromMarker(kind, order.deliveryHoldReason),
      childName: order.childName,
      inputVersion: order.inputVersion,
      contractHash: order.visualContractHash,
      sourceManifestId: null,
      artifactRefs: null,
    },
  };
}
