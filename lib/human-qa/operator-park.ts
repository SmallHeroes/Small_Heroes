import 'server-only';

import { writeOrderHoldFenced, isDeliveryTerminalHold } from '@/lib/generation-pipeline/order-authority';
import type { OperatorActionBody, OperatorActionResult } from '@/lib/human-qa/operator-action';

/** The terminal marker an operator PARK stamps to freeze a book for manual resolution. */
export const MANUAL_RESOLUTION_HOLD_PREFIX = 'manual_resolution_hold:';

/**
 * (Human-QA Slice 4) The PARK action body — the launch-safe endgame (brief §2.7). It freezes a held book for manual
 * resolution and GUARANTEES all five properties WITHOUT re-implementing the shared contract (runOperatorAction owns
 * the locks, preconditions, idempotency and audit):
 *   • no `ready` transition   — it only ever writes status `needs_human_qa`; it never calls a ship/release CAS,
 *     commitBaseBookReadiness, enqueueDelivery, or startChunkedGeneration.
 *   • no delivery outbox row  — same: it enqueues nothing.
 *   • no auto-redrive         — if the current hold is not already terminal (e.g. a rank-1 anchor hold), it escalates
 *     the marker to a TERMINAL `manual_resolution_hold:`. That single marker blocks the exception-recovery redrive
 *     (start.ts refuses it) AND any concurrent ship (order-authority TERMINAL_HOLD_NOT_LIKE_SQL). A hold that is
 *     already terminal (safety_hold:/contract_world_hold:/quarantine_cutover:) is left untouched — already frozen.
 *   • customer stays under_review — status stays `needs_human_qa`, which is exactly what the customer status route
 *     reports as `under_review`.
 *   • visible unresolved record — the HumanQaReviewCase is left OPEN (never resolved/superseded here), and the
 *     HumanQaOperatorAction(kind='park') row records the operator decision. "Parked" = open case + park row + the
 *     queryable terminal marker; no new case status is invented.
 * Cancel + refund stay manual and out of scope — park never touches manualReviewRequired, never opens an
 * ExceptionCase, never refunds; and it is refused up-front if a payment fence is active.
 *
 * Runs on ctx.tx, whose Order row is already FOR UPDATE-locked by runOperatorAction, so the fence read+CAS is
 * re-entrant and single-shot (no concurrent writer can move the fence under the lock).
 */
export const parkOperatorActionBody: OperatorActionBody = async (ctx): Promise<OperatorActionResult> => {
  const priorMarker = ctx.order.deliveryHoldReason ?? '';
  const alreadyTerminal = isDeliveryTerminalHold(priorMarker);
  let newMarker = priorMarker;
  let holdResult = 'already_terminal';

  if (!alreadyTerminal) {
    newMarker = `${MANUAL_RESOLUTION_HOLD_PREFIX}${priorMarker || 'operator_park'}`;
    holdResult = await writeOrderHoldFenced(ctx.tx, {
      orderId: ctx.order.id,
      newStatus: 'needs_human_qa', // NEVER ready — the customer keeps seeing under_review
      newHoldReason: newMarker,
      requireNotDelivered: true, // never retract an already-delivered book
    });
    if (holdResult === 'input_drift' || holdResult === 'lost') {
      // Not expected while we hold the Order FOR UPDATE lock — surface it (rolls back the fenced tx; nothing recorded).
      throw new Error(`[operator-park] writeOrderHoldFenced returned '${holdResult}' under lock for order ${ctx.order.id}`);
    }
    // 'applied' (escalated) or 'superseded' (a stronger real terminal hold already stands) — both leave the order
    // terminally held, so park succeeded either way.
  }

  return {
    status: 'succeeded',
    outcome: {
      parked: true,
      escalated: !alreadyTerminal,
      priorMarker,
      newMarker,
      holdResult,
      orderStatus: 'needs_human_qa',
    },
  };
};
