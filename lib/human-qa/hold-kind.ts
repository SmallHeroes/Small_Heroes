import 'server-only';

import type { Prisma, HumanQaHoldKind } from '@prisma/client';

/**
 * (Human-QA Slice 1, Unit 2) Shared seam helpers — map an already-persisted hold to its review-case identity.
 *
 * These NEVER decide whether to hold; they translate a decision the pipeline already made (the `deliveryHoldReason`
 * marker) into the `HumanQaReviewCase` kind + a readable reason, and load the immutable evidence snapshot the case
 * records. The seams call `recordHumanQaHoldInTx` ALONGSIDE their existing Order write — the Order-write data itself
 * is never touched.
 */

/**
 * Map a persisted `deliveryHoldReason` MARKER to the eligible base_book manual-hold kind, or `null` for a marker
 * that is NOT a terminal manual hold (`base_book_integrity:` → recoverable ExceptionCase; `qa_soft_deliver:` →
 * delivered). This is what keeps a case from being opened for a recoverable/auto-recovering park even when its
 * Order status is `needs_human_qa`. Payment fences are NOT marker-derived — they pass `payment_integrity` directly.
 */
export function humanQaKindFromMarker(
  reason: string | null | undefined,
): 'safety' | 'contract_world' | 'anchor' | null {
  if (!reason) return null;
  if (reason.startsWith('safety_hold:')) return 'safety';
  if (reason.startsWith('contract_world_hold:')) return 'contract_world';
  if (reason.startsWith('anchor_low_confidence:')) return 'anchor';
  return null;
}

/** A short operator-readable reason built from the kind + the raw marker. Display-only; never a render/decision input. */
export function humanReasonForHoldKind(kind: HumanQaHoldKind, rawReason: string): string {
  switch (kind) {
    case 'safety':
      return `Child-safety hold — ${rawReason}`;
    case 'contract_world':
      return `Contract/world drift hold — ${rawReason}`;
    case 'anchor':
      return `Anchor likeness low-confidence — ${rawReason}`;
    case 'payment_integrity':
      return `Payment integrity hold — ${rawReason}`;
    case 'legacy_unknown':
      return `Held for human review — ${rawReason}`;
  }
}

/**
 * Load the immutable evidence snapshot fields for a hold from the Order, inside the caller's tx. A localized,
 * additive SELECT — it reads nothing a decision depends on and changes no write. Runs only on a hold (rare).
 */
export async function loadHoldEvidence(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<{ childName: string; inputVersion: number; visualContractHash: string | null }> {
  const o = await tx.order.findUnique({
    where: { id: orderId },
    select: { childName: true, inputVersion: true, visualContractHash: true },
  });
  return {
    childName: o?.childName ?? '',
    inputVersion: o?.inputVersion ?? 0,
    visualContractHash: o?.visualContractHash ?? null,
  };
}
