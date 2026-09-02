import 'server-only';

import type { Prisma, PrismaClient } from '@prisma/client';

import {
  runAtomicOperation,
  hashOperationPayload,
  type ReceiptSafeValue,
} from '@/lib/generation-pipeline/atomic-operation';

/**
 * (Human-QA Slices 3+4) The SHARED SAFETY CONTRACT for every operator action against a held book — re-render,
 * release, park. Every action goes through `runOperatorAction`, which owns the three cross-cutting guarantees the
 * brief §2.3 requires, so no action body re-implements (or forgets) any of them:
 *
 *   • EXACTLY-ONCE under the Idempotency-Key. Reuses the battle-tested receipt fence (runAtomicOperation): a
 *     repeated key REPLAYS the recorded outcome (the body never re-runs, no second audit row, no second effect);
 *     a repeated key with a DIFFERENT request FAILS CLOSED (payloadHash mismatch). The fence key is derived from
 *     (kind, orderId, header) so the same header on a different action can never collide.
 *   • LOCKING. Locks the Order FIRST, then the active base_book review case, both via raw `SELECT … FOR UPDATE`
 *     inside the fenced tx — Order-first matches sync-hold-case's lock order (no ABBA deadlock) and, because the
 *     case producer also takes the Order lock first, holding it closes the window in which a new case could appear.
 *   • PRECONDITIONS. Exactly `needs_human_qa` · an OPEN review case for `${orderId}:base_book` · the exact current
 *     hold marker (Order.deliveryHoldReason === the marker the operator acted on — optimistic concurrency) · and
 *     NO active payment fence (`Order.manualReviewRequired`, the authoritative money-tx flag, OR a derived
 *     `${orderId}:payment` case). A precondition failure THROWS (the endpoint maps it to 409) and the tx rolls back
 *     — nothing is recorded and the Idempotency-Key is NOT consumed, so a refreshed retry runs.
 *   • AUDIT. Writes the durable HumanQaOperatorAction row (observed marker/fence/inputVersion snapshot, actor, the
 *     note VERBATIM, targets, kind) BEFORE the body, then stamps its terminal status + outcome after — all atomic
 *     with the body's own writes and the receipt.
 *
 * The action body does ONLY the kind-specific work (re-render / release / park) with the two locks + the audit row
 * held; it never touches auth, idempotency or locking. The operator note is passed to the body but is NEVER a
 * safety/contract input — that boundary is enforced where the note is assembled into a prompt, not here.
 */

export type OperatorActionKind = 'rerender' | 'release' | 'park';

/** Operator actions act on the base_book hold slot; the payment slot is a separate case that must be inactive. */
export const OPERATOR_ACTION_SCOPE = 'base_book' as const;

export type OperatorActionPreconditionReason =
  | 'order_not_found'
  | 'not_held' // Order.status !== 'needs_human_qa'
  | 'no_active_case' // no OPEN HumanQaReviewCase for `${orderId}:base_book`
  | 'marker_changed' // Order.deliveryHoldReason !== the marker the operator acted on
  | 'payment_case_active'; // Order.manualReviewRequired=true OR an OPEN `${orderId}:payment` case exists

const PRECONDITION_MESSAGE: Record<OperatorActionPreconditionReason, string> = {
  order_not_found: 'order not found',
  not_held: 'order is not held for human QA (status is not needs_human_qa)',
  no_active_case: 'no active human-QA review case for this order',
  marker_changed: 'the hold marker changed since the operator loaded the case — refresh and retry',
  payment_case_active: 'an active payment-integrity review case blocks operator actions on this order',
};

/**
 * A precondition of the shared contract was not met. The endpoint maps this to HTTP 409. Because it is thrown
 * INSIDE the fenced tx, the whole transaction (including the receipt insert) rolls back — nothing is recorded and
 * the Idempotency-Key is not consumed, so the operator can refresh and retry.
 */
export class OperatorActionPreconditionError extends Error {
  readonly code = 'operator_action_precondition';
  constructor(public readonly reason: OperatorActionPreconditionReason) {
    super(`[operator-action] refused: ${reason} — ${PRECONDITION_MESSAGE[reason]}`);
    this.name = 'OperatorActionPreconditionError';
  }
}

/** The Order snapshot the action body receives — read FOR UPDATE inside the fenced tx. */
export interface LockedOrder {
  id: string;
  status: string;
  deliveryHoldReason: string | null;
  manualReviewRequired: boolean;
  deliveryFenceVersion: number;
  inputVersion: number;
}

/** The active base_book review case, read FOR UPDATE. */
export interface LockedReviewCase {
  id: string;
  kind: string;
  status: string;
  revision: number;
}

export interface OperatorActionInput {
  orderId: string;
  /** The raw Idempotency-Key header. The exactly-once fence key is derived from (kind, orderId, this). */
  idempotencyKey: string;
  kind: OperatorActionKind;
  /** Who acted (from the admin auth context). Stored on the audit row. */
  actor: string;
  /** The Order.deliveryHoldReason the operator acted against — optimistic concurrency (a re-hold changes it). */
  expectedMarker: string;
  note?: string | null;
  targetArtifacts?: string[];
  // RELEASE ceremony (recorded verbatim; consumed by the release body in a later slice).
  overriddenHazards?: string[];
  overrideReason?: string | null;
  assetSha256?: string | null;
}

export interface OperatorActionContext {
  tx: Prisma.TransactionClient;
  order: LockedOrder;
  activeCase: LockedReviewCase;
  /** The HumanQaOperatorAction audit row id (already inserted, status 'pending'). */
  actionId: string;
}

/** The body's result. `outcome` is JSON-safe: it is stored on the audit row AND replayed verbatim on a retry. */
export interface OperatorActionResult {
  status: 'succeeded' | 'failed' | 'aborted';
  outcome: Record<string, ReceiptSafeValue>;
}

export type OperatorActionBody = (ctx: OperatorActionContext) => Promise<OperatorActionResult>;

export interface OperatorActionReturn {
  actionId: string;
  status: OperatorActionResult['status'];
  outcome: Record<string, ReceiptSafeValue>;
}

/**
 * Release overrides bind one delivered artifact hash. Multi-artifact release must grow the schema before it can be
 * safe; for now the shared contract rejects it before any receipt/audit row is written.
 */
export class OperatorActionInputError extends Error {
  readonly code = 'operator_action_input';
  constructor(message: string) {
    super(`[operator-action] invalid input: ${message}`);
    this.name = 'OperatorActionInputError';
  }
}

export function validateOperatorActionInput(input: OperatorActionInput): void {
  if (input.kind === 'release' && (input.targetArtifacts ?? []).length !== 1) {
    throw new OperatorActionInputError('release actions must target exactly one artifact');
  }
}

/** Derive the exactly-once fence key. Scoped by kind + orderId so the same header on a different action can't collide. */
export function operatorActionOperationKey(kind: OperatorActionKind, orderId: string, idempotencyKey: string): string {
  return `operator_action:${kind}:${orderId}:${idempotencyKey}`;
}

/**
 * PURE precondition evaluation — the four §2.3 gates plus order-exists. Extracted so it is unit-testable without a
 * database; `runOperatorAction` calls it against the LOCKED rows.
 */
export function evaluateOperatorActionPreconditions(args: {
  order: Pick<LockedOrder, 'status' | 'deliveryHoldReason' | 'manualReviewRequired'> | null;
  activeCase: Pick<LockedReviewCase, 'status'> | null;
  paymentCaseActive: boolean;
  expectedMarker: string;
}): { ok: true } | { ok: false; reason: OperatorActionPreconditionReason } {
  if (!args.order) return { ok: false, reason: 'order_not_found' };
  if (args.order.status !== 'needs_human_qa') return { ok: false, reason: 'not_held' };
  if (!args.activeCase || args.activeCase.status !== 'open') return { ok: false, reason: 'no_active_case' };
  if ((args.order.deliveryHoldReason ?? '') !== args.expectedMarker) return { ok: false, reason: 'marker_changed' };
  if (args.order.manualReviewRequired || args.paymentCaseActive) return { ok: false, reason: 'payment_case_active' };
  return { ok: true };
}

/** Canonical request hash — folded into the receipt so a same-key/different-request retry fails closed. */
export function operatorActionRequestHash(input: OperatorActionInput): string {
  return hashOperationPayload({
    kind: input.kind,
    marker: input.expectedMarker,
    note: input.note ?? null,
    targetArtifacts: [...(input.targetArtifacts ?? [])].sort(),
    overriddenHazards: [...(input.overriddenHazards ?? [])].sort(),
    overrideReason: input.overrideReason ?? null,
    assetSha256: input.assetSha256 ?? null,
  });
}

async function lockOperatorOrderBeforeReceipt(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  if (rows.length !== 1) {
    throw new OperatorActionPreconditionError('order_not_found');
  }
}

/**
 * Run an operator action through the shared contract. See the file header for the four guarantees. The `body`
 * performs the kind-specific work with the Order + active case locked and the audit row already written.
 */
export async function runOperatorAction(
  prisma: PrismaClient,
  input: OperatorActionInput,
  body: OperatorActionBody,
): Promise<OperatorActionReturn> {
  validateOperatorActionInput(input);

  const operationKey = operatorActionOperationKey(input.kind, input.orderId, input.idempotencyKey);
  const requestHash = operatorActionRequestHash(input);
  const scopeKey = `${input.orderId}:${OPERATOR_ACTION_SCOPE}`;
  const paymentKey = `${input.orderId}:payment`;

  return runAtomicOperation(prisma, {
    operationKey,
    orderId: input.orderId,
    kind: 'operator_action',
    payloadHash: requestHash,
    beforeReceipt: (tx) =>
      lockOperatorOrderBeforeReceipt(tx, input.orderId),
    run: async (tx): Promise<OperatorActionReturn> => {
      // (1) Lock the Order FIRST — deterministic order (matches sync-hold-case's Order-first FOR UPDATE).
      const orderRows = await tx.$queryRaw<LockedOrder[]>`
        SELECT "id", "status", "deliveryHoldReason", "manualReviewRequired", "deliveryFenceVersion", "inputVersion"
          FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
      const order = orderRows[0] ?? null;

      // (2) Lock the active base_book review case. activeKey is set ONLY while status='open' (the DB CHECK), so a
      //     single equality FOR UPDATE targets the one open case, if any.
      const caseRows = order
        ? await tx.$queryRaw<LockedReviewCase[]>`
            SELECT "id", "kind", "status", "revision"
              FROM "HumanQaReviewCase" WHERE "activeKey" = ${scopeKey} FOR UPDATE`
        : [];
      const activeCase = caseRows[0] ?? null;

      // (3) Is there an active payment fence? manualReviewRequired is the authoritative money-tx flag; the
      //     HumanQaReviewCase is a derived post-commit artifact the reconciler may repair later.
      const payRows = order
        ? await tx.$queryRaw<Array<{ active: boolean }>>`
            SELECT EXISTS(
              SELECT 1 FROM "HumanQaReviewCase" WHERE "activeKey" = ${paymentKey} AND "status" = 'open'
            ) AS active`
        : [];
      const paymentCaseActive = payRows[0]?.active === true;

      const pre = evaluateOperatorActionPreconditions({ order, activeCase, paymentCaseActive, expectedMarker: input.expectedMarker });
      if (!pre.ok) throw new OperatorActionPreconditionError(pre.reason);
      const lockedOrder = order as LockedOrder;
      const lockedCase = activeCase as LockedReviewCase;

      // (4) Durable audit row (status 'pending') — snapshots the delivery-authority state at action time.
      const rec = await tx.humanQaOperatorAction.create({
        data: {
          idempotencyKey: operationKey,
          requestHash,
          orderId: input.orderId,
          caseId: lockedCase.id,
          caseRevision: lockedCase.revision,
          kind: input.kind,
          status: 'pending',
          actor: input.actor,
          note: input.note ?? null,
          targetArtifacts: input.targetArtifacts ?? [],
          observedMarker: lockedOrder.deliveryHoldReason ?? '',
          observedFence: lockedOrder.deliveryFenceVersion,
          observedInputVersion: lockedOrder.inputVersion,
          overriddenHazards: input.overriddenHazards ?? [],
          overrideReason: input.overrideReason ?? null,
          assetSha256: input.assetSha256 ?? null,
        },
        select: { id: true },
      });

      // (5) The kind-specific action, with both locks + the audit row held in the SAME tx.
      const result = await body({ tx, order: lockedOrder, activeCase: lockedCase, actionId: rec.id });

      // (6) Stamp the terminal status + outcome (atomic with the body's writes + the receipt).
      await tx.humanQaOperatorAction.update({
        where: { id: rec.id },
        data: { status: result.status, outcome: result.outcome as Prisma.InputJsonValue },
      });

      return { actionId: rec.id, status: result.status, outcome: result.outcome };
    },
  });
}
