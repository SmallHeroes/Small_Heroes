import 'server-only';

import type { ExceptionCase, Prisma, PrismaClient } from '@prisma/client';
import {
  getBookReadyEmailDeliveryState,
  sendBookReadyEmail,
  sendRefundNoticeEmail,
  type EmailDeliveryState,
} from '@/backend/lib/email';
import {
  claimDueExceptionCases,
  EXCEPTION_MAX_RECOVERY_ATTEMPTS,
  EXCEPTION_SCOPE_BASE_BOOK,
  exceptionBackoffMs,
  openExceptionCase,
  reissueConfirmedFailedDelivery,
  reserveExceptionExternalAction,
  resolveAmbiguousDelivery,
  transitionExceptionCase,
  REISSUE_BUDGET,
  REISSUE_WINDOW_MS,
  ReissueBudgetExhaustedError,
} from './exception-case';
import {
  deliveryDedupeKey,
  hashPayload,
  idempotencyWindowMs,
  repairInvalidPayloadDelivery,
  type BookReadyPayload,
} from './delivery-outbox';
import { refundOrderPayment, prismaRefundFence, type RefundableOrder, type RefundResult, type RefundProviderDeps } from '@/lib/payment-refunds';
import { startChunkedGeneration } from './start';
import { commitBaseBookReadiness, type CommitResult } from '@/lib/generation-pipeline/readiness-manifest';
import { writeOrderHoldFenced } from '@/lib/generation-pipeline/order-authority';
import {
  reQaUnknownQualityEvidence,
  loadRegenPendingArtifacts,
  type QualityRecoveryResult,
} from '@/lib/generation-pipeline/quality-recovery';
import { QUALITY_REGEN_BUDGET, type HardHoldKind } from '@/lib/generation-pipeline/quality-evidence';
import { reserveMarkAndClearRegen } from './clear-page-images-for-regen';
import { syncHumanQaHoldCasePostCommit } from '@/lib/human-qa/sync-hold-case';
import { createLogger } from '@/lib/logger';

const log = createLogger({ subsystem: 'exception-processor' });
const RECONCILIATION_MAX_AGE_MS = 48 * 60 * 60 * 1000;

// (#6-FIX-2) Read-only pre-check mirroring consumeReissueBudget: is a reissue allowed by the durable order:scope
// budget AND the GLOBAL 48h window (anchored on the first send attempt)? The authoritative consume is atomic
// inside the reissue tx; this gates BEFORE the reissue so an exhausted/expired intent routes straight to refund.
async function reissueBudgetAllows(
  prisma: PrismaClient,
  orderId: string,
  firstSendAttemptAt: Date | null,
  now: Date,
): Promise<boolean> {
  const cutoff = new Date(now.getTime() - REISSUE_WINDOW_MS);
  const budget = await prisma.reissueBudget.findUnique({
    where: { orderId_scope: { orderId, scope: EXCEPTION_SCOPE_BASE_BOOK } },
  });
  if (!budget) return firstSendAttemptAt != null && firstSendAttemptAt > cutoff;
  return budget.count < REISSUE_BUDGET && budget.windowStartAt > cutoff;
}

type Resolution = Record<string, unknown>;

function resolutionOf(value: Prisma.JsonValue | null): Resolution {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Resolution
    : {};
}

export interface ExceptionProcessorDeps {
  now: () => Date;
  replayEmail: (
    payload: BookReadyPayload,
    idempotencyKey: string,
  ) => Promise<{ providerMessageId?: string }>;
  emailState: (
    providerMessageId: string,
  ) => Promise<{ state: EmailDeliveryState; event: string | null }>;
  refund: (
    order: RefundableOrder,
    refundKey: string,
    previousProviderActionId?: string | null,
    overrides?: RefundProviderDeps,
  ) => Promise<RefundResult>;
  refundNotice: (data: {
    to: string;
    customerName: string;
    childName: string;
    idempotencyKey: string;
  }) => Promise<{ providerMessageId?: string }>;
  repairInvalidPayload: (
    prisma: PrismaClient,
    outboxId: string,
    now: Date,
  ) => Promise<'repaired' | 'already_repaired' | 'not_repairable'>;
  redriveGeneration: (orderId: string) => Promise<{ started: boolean; message?: string }>;
  recommitReadiness: (prisma: PrismaClient, orderId: string) => Promise<CommitResult>;
  /** (#7-a 6) Re-QA the order's required artifacts vs their CURRENT delivered bytes (0 renders). */
  reQaQualityEvidence: (prisma: PrismaClient, orderId: string) => Promise<QualityRecoveryResult>;
  /** (#6-fix-3) ATOMICALLY reserve the durable regen budget → mark regen-pending → clear the artifact, as one tx.
   *  `granted:false` = budget spent → NOT cleared (stays failed-terminal → the recommit refunds it).
   *  (Codex B′) `operationKey` = the receipt fence: caseId + claimVersion + artifactKey → EXACTLY ONE regenCount++
   *  even if the reservation tx commits ambiguously (P2028) and the worker restarts under the same claim. */
  reserveMarkAndClearRegen: (prisma: PrismaClient, orderId: string, artifactKey: string, operationKey: string) => Promise<{ granted: boolean }>;
  /** (#6-fix-3) Artifact keys durably marked regen-pending — cleared, awaiting a re-render/redrive. */
  loadRegenPending: (prisma: PrismaClient, orderId: string) => Promise<string[]>;
  /** (Slice A / Fix 5) Terminal human-QA PARK for a hard hold: hold the order at needs_human_qa with a distinct
   *  marker per kind (safety_hold / contract_world_hold); never redrive/refund; never retract a delivered book. */
  parkForHardHoldQa: (prisma: PrismaClient, orderId: string, artifactKeys: string[], kind: HardHoldKind) => Promise<void>;
}

function defaultDeps(): ExceptionProcessorDeps {
  return {
    now: () => new Date(),
    replayEmail: (payload, idempotencyKey) =>
      sendBookReadyEmail({ ...payload, idempotencyKey }),
    emailState: (providerMessageId) => getBookReadyEmailDeliveryState(providerMessageId),
    refund: refundOrderPayment,
    refundNotice: sendRefundNoticeEmail,
    repairInvalidPayload: repairInvalidPayloadDelivery,
    redriveGeneration: (orderId) =>
      startChunkedGeneration(orderId, 'exception_case_recovery'),
    reQaQualityEvidence: (prisma, orderId) => reQaUnknownQualityEvidence(prisma, orderId),
    reserveMarkAndClearRegen: (prisma, orderId, artifactKey, operationKey) =>
      reserveMarkAndClearRegen(prisma, { orderId, artifactKey, operationKey }),
    loadRegenPending: (prisma, orderId) => loadRegenPendingArtifacts(prisma, orderId),
    parkForHardHoldQa: (prisma, orderId, artifactKeys, kind) =>
      parkOrderForHardHoldQa(prisma, orderId, artifactKeys, kind),
    recommitReadiness: async (prisma, orderId) => {
      // (Codex round-5) The commit derives the anchor disposition from its OWN fresh load of the
      // producing snapshot — the pre-load here became redundant and was removed with it.
      const result = await commitBaseBookReadiness(prisma, { orderId });
      // (Human-QA Slice 1, re-gate P0-1) POST-COMMIT: reconcile the review case after the readiness tx commits
      // (opens an anchor case if it re-parked; resolves it on a ready recommit). Best-effort in its own tx.
      await syncHumanQaHoldCasePostCommit(prisma, orderId);
      return result;
    },
  };
}

/**
 * (Slice A / Fix 5) Terminal human-QA PARK for a hard hold. Holds the order at needs_human_qa with a DISTINCT marker
 * per kind — `safety_hold:` (physical safety) or `contract_world_hold:` (contract-world drift), both of which
 * start.ts refuses to redrive. NEVER retracts an already-delivered book (ready/partial) — a delivered-book revoke
 * is a separate, out-of-scope decision.
 */
async function parkOrderForHardHoldQa(
  prisma: PrismaClient,
  orderId: string,
  artifactKeys: string[],
  kind: HardHoldKind,
): Promise<void> {
  const marker = kind === 'safety' ? 'safety_hold' : 'contract_world_hold';
  const rawReason = `${marker}:${artifactKeys.join(',')}`;
  // (Codex round-5 Unit 2) The hard-hold park goes through the shared funnel: bind + bump + precedence, and
  // requireNotDelivered preserves the "never retract a delivered book" guard (status NOT IN ready/partial). safety=3
  // always wins; contract_world=2 wins over anchor/integrity but yields to an already-committed safety hold. The
  // review case is opened POST-COMMIT (never inside this write) so a case-write rejection cannot roll back the hold.
  await writeOrderHoldFenced(prisma, {
    orderId,
    newStatus: 'needs_human_qa',
    newHoldReason: rawReason,
    requireNotDelivered: true,
  });
  // POST-COMMIT: reconcile the safety/contract_world review case from the committed Order state (a no-op if the
  // order was already delivered and the park matched no row). Best-effort in its own tx.
  await syncHumanQaHoldCasePostCommit(prisma, orderId);
}

async function moveToRefund(
  prisma: PrismaClient,
  exceptionCase: ExceptionCase,
  reason: string,
  now: Date,
): Promise<'refund_pending' | 'lost_lease'> {
  const moved = await transitionExceptionCase(prisma, {
    caseId: exceptionCase.id,
    claimVersion: exceptionCase.claimVersion,
    fromStatus: exceptionCase.status,
    toStatus: 'refund_pending',
    reason,
    nextActionAt: now,
    lastError: null,
    resolution: {
      ...resolutionOf(exceptionCase.resolution),
      recoveryExhaustedReason: reason,
    },
    now,
  });
  return moved ? 'refund_pending' : 'lost_lease';
}

async function retryLater(
  prisma: PrismaClient,
  exceptionCase: ExceptionCase,
  reason: string,
  now: Date,
  lastError: string | null = null,
  resolution?: Prisma.InputJsonValue,
): Promise<'retry_scheduled' | 'lost_lease'> {
  const moved = await transitionExceptionCase(prisma, {
    caseId: exceptionCase.id,
    claimVersion: exceptionCase.claimVersion,
    fromStatus: exceptionCase.status,
    toStatus: 'retry_scheduled',
    reason,
    nextActionAt: new Date(now.getTime() + exceptionBackoffMs(exceptionCase.attempts)),
    lastError,
    resolution,
    now,
  });
  return moved ? 'retry_scheduled' : 'lost_lease';
}

async function refundLater(
  prisma: PrismaClient,
  exceptionCase: ExceptionCase,
  reason: string,
  now: Date,
  lastError: string | null,
  resolution: Prisma.InputJsonValue,
  providerActionId?: string | null,
): Promise<'refund_pending' | 'lost_lease'> {
  const moved = await transitionExceptionCase(prisma, {
    caseId: exceptionCase.id,
    claimVersion: exceptionCase.claimVersion,
    fromStatus: exceptionCase.status,
    toStatus: 'refund_pending',
    reason,
    nextActionAt: new Date(now.getTime() + exceptionBackoffMs(exceptionCase.attempts)),
    lastError,
    resolution,
    providerActionId,
    now,
  });
  return moved ? 'refund_pending' : 'lost_lease';
}

async function resolveCase(
  prisma: PrismaClient,
  exceptionCase: ExceptionCase,
  reason: string,
  now: Date,
  resolution: Prisma.InputJsonValue,
  extra: {
    providerActionId?: string | null;
    notificationMessageId?: string | null;
  } = {},
): Promise<'resolved' | 'lost_lease'> {
  const moved = await transitionExceptionCase(prisma, {
    caseId: exceptionCase.id,
    claimVersion: exceptionCase.claimVersion,
    fromStatus: exceptionCase.status,
    toStatus: 'resolved',
    reason,
    resolution,
    providerActionId: extra.providerActionId,
    notificationMessageId: extra.notificationMessageId,
    now,
  });
  if (moved) return 'resolved';
  const current = await prisma.exceptionCase.findUnique({
    where: { id: exceptionCase.id },
    select: { status: true },
  });
  return current?.status === 'resolved' ? 'resolved' : 'lost_lease';
}

async function handleSendAmbiguous(
  prisma: PrismaClient,
  exceptionCase: ExceptionCase,
  deps: ExceptionProcessorDeps,
  now: Date,
): Promise<ExceptionProcessOutcome> {
  if (!exceptionCase.sourceRef) {
    return moveToRefund(prisma, exceptionCase, 'send_ambiguous_missing_outbox', now);
  }
  const row = await prisma.deliveryOutbox.findUnique({ where: { id: exceptionCase.sourceRef } });
  if (!row) {
    return moveToRefund(prisma, exceptionCase, 'send_ambiguous_source_missing', now);
  }
  // (Codex round-5 finding 5) SOURCE-IDENTITY + CANONICAL-KEY binding, BEFORE any disposition
  // (including the `sent` resolution — a cross-source row must not resolve the wrong case as
  // delivered). The named send_ambiguous exception is a continuation of THIS order's authorized
  // attempt only when: the Outbox row belongs to this case's exact order + scope, AND its
  // dedupeKey is the exact canonical key for that identity (`deliveryDedupeKey(orderId, scope, N)`
  // for the embedded fulfillment version) — a valid payloadHash with a drifted or cross-source
  // key never replays.
  const keyVersionSegment = row.dedupeKey.slice(row.dedupeKey.lastIndexOf('/') + 1);
  const keyVersion = /^\d+$/.test(keyVersionSegment) ? Number(keyVersionSegment) : null;
  const canonicalKey =
    keyVersion !== null ? deliveryDedupeKey(row.orderId, row.scope, keyVersion) : null;
  if (
    row.orderId !== exceptionCase.orderId ||
    row.scope !== exceptionCase.scope ||
    canonicalKey === null ||
    canonicalKey !== row.dedupeKey
  ) {
    return moveToRefund(prisma, exceptionCase, 'send_ambiguous_source_identity_mismatch', now);
  }
  if (row.status === 'sent') {
    return resolveCase(
      prisma,
      exceptionCase,
      'ambiguous_source_already_reconciled',
      now,
      {
        outcome: 'delivered',
        providerMessageId: row.providerMessageId,
        sourceStatus: 'sent',
      },
    );
  }
  if (row.failureClass !== 'send_ambiguous') {
    return retryLater(
      prisma,
      exceptionCase,
      `send_ambiguous_source_changed:${row.status}`,
      now,
    );
  }

  let providerMessageId = row.providerMessageId;
  const firstAttemptAt = row.firstSendAttemptAt;
  const ageMs = firstAttemptAt ? now.getTime() - firstAttemptAt.getTime() : Number.POSITIVE_INFINITY;
  if (!providerMessageId) {
    if (ageMs >= idempotencyWindowMs() || hashPayload(row.payload) !== row.payloadHash) {
      return moveToRefund(prisma, exceptionCase, 'send_ambiguous_not_replay_safe', now);
    }
    // This is reconciliation, not a blind resend: the exact payload + exact key are replayed only while
    // Resend guarantees deduplication, solely to recover the provider message id.
    try {
      const replayed = await deps.replayEmail(
        row.payload as unknown as BookReadyPayload,
        row.dedupeKey,
      );
      providerMessageId = replayed.providerMessageId ?? null;
      if (providerMessageId) {
        await prisma.deliveryOutbox.updateMany({
          where: { id: row.id, status: 'failed', failureClass: 'send_ambiguous' },
          data: { providerMessageId },
        });
      }
    } catch (error) {
      return retryLater(
        prisma,
        exceptionCase,
        'send_ambiguous_provider_replay_retry',
        now,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  if (!providerMessageId) {
    return moveToRefund(prisma, exceptionCase, 'send_ambiguous_provider_id_unavailable', now);
  }

  try {
    const state = await deps.emailState(providerMessageId);
    if (state.state === 'delivered') {
      const resolved = await resolveAmbiguousDelivery(prisma, {
        exceptionCase,
        outboxId: row.id,
        providerMessageId,
        providerEvent: state.event,
        now,
      });
      return resolved ? 'resolved' : 'lost_lease';
    }
    if (state.state === 'failed') {
      // (#6-FIX-2) Durable order:scope reissue budget + GLOBAL 48h window (from the first send attempt), checked
      // BEFORE the reissue. A per-case bound does not compose — each reissue spawns a new case + fulfillmentVersion
      // + clock — so a budget exhausted here, or a window expired, routes to refund instead of another reissue.
      if (!(await reissueBudgetAllows(prisma, exceptionCase.orderId, firstAttemptAt, now))) {
        return moveToRefund(prisma, exceptionCase, 'reissue_budget_or_window_exhausted', now);
      }
      let reissued: 'reissued' | 'not_ready' | 'lost_lease';
      try {
        reissued = await reissueConfirmedFailedDelivery(prisma, {
          exceptionCase,
          outboxId: row.id,
          providerMessageId,
          providerEvent: state.event,
          now,
        });
      } catch (error) {
        // (#6 FIX-4b) The in-tx consume is authoritative: if a concurrent reissue won the budget after our
        // pre-check, the reissue tx rolls back (case un-resolved, budget unconsumed) and we refund instead.
        if (error instanceof ReissueBudgetExhaustedError) {
          return moveToRefund(prisma, exceptionCase, 'reissue_budget_exhausted', now);
        }
        throw error;
      }
      if (reissued === 'reissued') return 'resolved';
      if (reissued === 'lost_lease') return 'lost_lease';
      return moveToRefund(prisma, exceptionCase, 'confirmed_failed_redelivery_not_safe', now);
    }
    if (ageMs >= RECONCILIATION_MAX_AGE_MS) {
      return moveToRefund(prisma, exceptionCase, 'provider_delivery_unresolved_after_sla', now);
    }
    return retryLater(
      prisma,
      exceptionCase,
      `provider_delivery_${state.state}:${state.event ?? 'unknown'}`,
      now,
    );
  } catch (error) {
    return retryLater(
      prisma,
      exceptionCase,
      'provider_reconciliation_transient',
      now,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function handleRefund(
  prisma: PrismaClient,
  exceptionCase: ExceptionCase,
  deps: ExceptionProcessorDeps,
  now: Date,
): Promise<ExceptionProcessOutcome> {
  const order = await prisma.order.findUnique({
    where: { id: exceptionCase.orderId },
    select: {
      id: true,
      paymentProvider: true,
      paymentId: true,
      paymeTransactionId: true,
      stripePaymentId: true,
      customerEmail: true,
      customerName: true,
      childName: true,
      payment: { select: { provider: true } },
    },
  });
  if (!order) {
    return retryLater(prisma, exceptionCase, 'refund_order_missing', now, 'order_missing');
  }

  const prior = resolutionOf(exceptionCase.resolution);
  let providerActionId = exceptionCase.providerActionId;
  let refundConfirmed = prior.refundConfirmed === true;
  if (!refundConfirmed) {
    const refundFirstAttemptAt = await reserveExceptionExternalAction(prisma, {
      caseId: exceptionCase.id,
      claimVersion: exceptionCase.claimVersion,
      status: exceptionCase.status,
      action: 'refund',
      now,
    });
    if (!refundFirstAttemptAt) return 'lost_lease';
    try {
      const refund = await deps.refund(
        order,
        exceptionCase.refundKey ?? `refund/${exceptionCase.id}`,
        providerActionId,
        // (#6-FIX-3) the durable exactly-once refund fence (PayMe) — prisma is only in scope here, not in defaultDeps.
        { refundFence: prismaRefundFence(prisma) },
      );
      providerActionId = refund.providerActionId;
      if (refund.state === 'pending') {
        return refundLater(
          prisma,
          exceptionCase,
          'refund_provider_pending',
          now,
          null,
          {
            ...prior,
            refundConfirmed: false,
            refundProvider: refund.provider,
          },
          refund.providerActionId,
        );
      }
      refundConfirmed = true;
      prior.refundConfirmed = true;
      prior.refundProvider = refund.provider;
      prior.refundConfirmedAt = now.toISOString();
    } catch (error) {
      // A refund is a durable liability. Provider outages never convert it to resolved/cancelled.
      return refundLater(
        prisma,
        exceptionCase,
        'refund_provider_retry',
        now,
        error instanceof Error ? error.message : String(error),
        prior as Prisma.InputJsonValue,
        providerActionId,
      );
    }
  }

  const noticeFirstAttemptAt = exceptionCase.notificationMessageId
    ? exceptionCase.notificationAttemptedAt ?? now
    : await reserveExceptionExternalAction(prisma, {
        caseId: exceptionCase.id,
        claimVersion: exceptionCase.claimVersion,
        status: exceptionCase.status,
        action: 'notification',
        now,
      });
  if (!noticeFirstAttemptAt) return 'lost_lease';
  if (
    !exceptionCase.notificationMessageId &&
    now.getTime() - noticeFirstAttemptAt.getTime() >= idempotencyWindowMs()
  ) {
    return resolveCase(
      prisma,
      exceptionCase,
      'refund_confirmed_notice_ambiguous_no_resend',
      now,
      {
        ...prior,
        refundConfirmed,
        noticeOutcome: 'ambiguous_no_resend',
      } as Prisma.InputJsonValue,
      { providerActionId },
    );
  }

  try {
    const notice = exceptionCase.notificationMessageId
      ? { providerMessageId: exceptionCase.notificationMessageId }
      : await deps.refundNotice({
          to: order.customerEmail,
          customerName: order.customerName || order.childName,
          childName: order.childName,
          idempotencyKey: `refund-notice/${exceptionCase.id}`,
        });
    return resolveCase(
      prisma,
      exceptionCase,
      'refund_confirmed',
      now,
      {
        ...prior,
        refundConfirmed,
        noticeFirstAttemptAt: noticeFirstAttemptAt.toISOString(),
        noticeOutcome: 'sent',
      } as Prisma.InputJsonValue,
      {
        providerActionId,
        notificationMessageId: notice.providerMessageId ?? null,
      },
    );
  } catch (error) {
    return refundLater(
      prisma,
      exceptionCase,
      'refund_notice_retry',
      now,
      error instanceof Error ? error.message : String(error),
      {
        ...prior,
        refundConfirmed,
        noticeFirstAttemptAt: noticeFirstAttemptAt.toISOString(),
      } as Prisma.InputJsonValue,
      providerActionId,
    );
  }
}

async function runQualityEvidenceRescue(
  prisma: PrismaClient,
  exceptionCase: ExceptionCase,
  deps: ExceptionProcessorDeps,
  now: Date,
): Promise<ExceptionProcessOutcome | 'continue'> {
  const recovery = await deps.reQaQualityEvidence(prisma, exceptionCase.orderId);
  // (Slice A) A deterministic contract-world drift is a TERMINAL human-QA PARK — resolve the case and hold the
  // order at needs_human_qa, BEFORE the regen-rescue. This is the guarantee: no reserve/clear/redrive (budget
  // remaining) AND no fall-through to moveToRefund (budget exhausted). It clears only via a human re-render.
  if (recovery.nowParked.length > 0) {
    const parkKind: HardHoldKind = recovery.nowParkedKind ?? 'contract_world';
    await deps.parkForHardHoldQa(prisma, exceptionCase.orderId, recovery.nowParked, parkKind);
    return resolveCase(
      prisma,
      exceptionCase,
      `${parkKind === 'safety' ? 'safety' : 'contract_world'}_parked:${recovery.nowParked.join(',')}`,
      now,
      { outcome: 'needs_human_qa', parked: recovery.nowParked },
    );
  }
  for (const f of recovery.nowFailed) {
    if (f.regenCount >= QUALITY_REGEN_BUDGET) continue;
    const operationKey = `regen_reserve:${exceptionCase.id}:${exceptionCase.claimVersion}:${f.artifactKey}`;
    await deps.reserveMarkAndClearRegen(prisma, exceptionCase.orderId, f.artifactKey, operationKey);
  }
  const pending = await deps.loadRegenPending(prisma, exceptionCase.orderId);
  if (pending.length > 0) {
    const started = await deps.redriveGeneration(exceptionCase.orderId);
    if (!started.started) {
      return retryLater(
        prisma,
        exceptionCase,
        'quality_regen_rescue_redrive_not_started',
        now,
        started.message ?? 'redrive_not_started',
      );
    }
    return retryLater(prisma, exceptionCase, `quality_regen_rescue:${pending.join(',')}`, now, null);
  }
  return 'continue';
}

async function handleRecoveryRetry(
  prisma: PrismaClient,
  exceptionCase: ExceptionCase,
  deps: ExceptionProcessorDeps,
  now: Date,
): Promise<ExceptionProcessOutcome> {
  if (exceptionCase.attempts > EXCEPTION_MAX_RECOVERY_ATTEMPTS) {
    return moveToRefund(prisma, exceptionCase, 'recovery_attempts_exhausted', now);
  }
  try {
    const [order, readiness, pending] = await Promise.all([
      prisma.order.findUnique({
        where: { id: exceptionCase.orderId },
        select: { status: true, generationJob: { select: { status: true } } },
      }),
      prisma.bookReadiness.findUnique({
        where: {
          orderId_scope: { orderId: exceptionCase.orderId, scope: EXCEPTION_SCOPE_BASE_BOOK },
        },
        select: { status: true, reason: true },
      }),
      deps.loadRegenPending(prisma, exceptionCase.orderId),
    ]);

    const effectiveReason =
      readiness?.status === 'blocked' && readiness.reason
        ? readiness.reason
        : exceptionCase.reason;

    const parkForHumanQa =
      order?.status === 'needs_human_qa' &&
      order.generationJob?.status === 'done' &&
      readiness?.status === 'passed' &&
      pending.length === 0;

    if (exceptionCase.sourceRef?.startsWith('generation:')) {
      if (order?.status === 'ready' || order?.status === 'partial') {
        return resolveCase(
          prisma,
          exceptionCase,
          'generation_recovered',
          now,
          { outcome: 'ready' },
        );
      }
      if (
        order?.status === 'generating' &&
        ['pending', 'running'].includes(order.generationJob?.status ?? '')
      ) {
        return retryLater(prisma, exceptionCase, 'generation_in_progress', now);
      }
    }

    if (effectiveReason?.startsWith('quality_evidence_unknown')) {
      const rescue = await runQualityEvidenceRescue(prisma, exceptionCase, deps, now);
      if (rescue !== 'continue') return rescue;
    } else if (pending.length > 0) {
      const started = await deps.redriveGeneration(exceptionCase.orderId);
      if (!started.started) {
        return retryLater(
          prisma,
          exceptionCase,
          'regen_pending_redrive_not_started',
          now,
          started.message ?? 'redrive_not_started',
        );
      }
      return retryLater(
        prisma,
        exceptionCase,
        `regen_pending_redrive:${pending.join(',')}`,
        now,
        null,
      );
    }

    if (parkForHumanQa) {
      return resolveCase(
        prisma,
        exceptionCase,
        'generation_parked_for_qa',
        now,
        { outcome: 'needs_human_qa' },
      );
    }

    if (exceptionCase.sourceRef?.startsWith('generation:')) {
      const started = await deps.redriveGeneration(exceptionCase.orderId);
      if (!started.started && started.message === 'Already completed') {
        return resolveCase(
          prisma,
          exceptionCase,
          'generation_already_completed',
          now,
          { outcome: 'already_completed' },
        );
      }
      if (!started.started) throw new Error(started.message ?? 'generation_redrive_not_started');
      return retryLater(prisma, exceptionCase, 'generation_redriven', now);
    }

    const result = await deps.recommitReadiness(prisma, exceptionCase.orderId);
    if (result.manifestStatus === 'passed' && result.orderStatus === 'ready') {
      return resolveCase(
        prisma,
        exceptionCase,
        'readiness_recovered',
        now,
        { outcome: 'passed', revision: result.revision },
      );
    }
    if (exceptionCase.attempts >= EXCEPTION_MAX_RECOVERY_ATTEMPTS) {
      return moveToRefund(prisma, exceptionCase, 'integrity_retry_budget_exhausted', now);
    }
    return retryLater(
      prisma,
      exceptionCase,
      `readiness_still_${result.manifestStatus}`,
      now,
    );
  } catch (error) {
    if (exceptionCase.attempts >= EXCEPTION_MAX_RECOVERY_ATTEMPTS) {
      return moveToRefund(prisma, exceptionCase, 'recovery_exception_budget_exhausted', now);
    }
    return retryLater(
      prisma,
      exceptionCase,
      'recovery_transient_error',
      now,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export type ExceptionProcessOutcome =
  | 'resolved'
  | 'retry_scheduled'
  | 'refund_pending'
  | 'lost_lease';

export async function processExceptionCase(
  prisma: PrismaClient,
  exceptionCase: ExceptionCase,
  overrides: Partial<ExceptionProcessorDeps> = {},
): Promise<ExceptionProcessOutcome> {
  const deps = { ...defaultDeps(), ...overrides };
  const now = deps.now();
  log.info('Processing exception case', {
    caseId: exceptionCase.id,
    orderId: exceptionCase.orderId,
    kind: exceptionCase.kind,
    status: exceptionCase.status,
    attempts: exceptionCase.attempts,
  });

  if (exceptionCase.status === 'refund_pending') {
    return handleRefund(prisma, exceptionCase, deps, now);
  }
  if (exceptionCase.status === 'customer_action') {
    return moveToRefund(prisma, exceptionCase, 'customer_action_sla_expired', now);
  }
  switch (exceptionCase.kind) {
    case 'send_ambiguous':
      return handleSendAmbiguous(prisma, exceptionCase, deps, now);
    case 'invalid_payload': {
      if (!exceptionCase.sourceRef) {
        return moveToRefund(prisma, exceptionCase, 'invalid_payload_missing_outbox', now);
      }
      const repaired = await deps.repairInvalidPayload(
        prisma,
        exceptionCase.sourceRef,
        now,
      );
      return repaired === 'repaired' || repaired === 'already_repaired'
        ? resolveCase(
            prisma,
            exceptionCase,
            repaired === 'repaired'
              ? 'invalid_payload_repaired'
              : 'invalid_payload_repair_recovered_after_crash',
            now,
            { outcome: repaired },
          )
        : moveToRefund(prisma, exceptionCase, 'invalid_payload_not_repairable', now);
    }
    case 'delivery_revoked':
    case 'safety_failed':
    case 'quality_failed':
    case 'unusable_photo':
      return moveToRefund(prisma, exceptionCase, `terminal_kind:${exceptionCase.kind}`, now);
    case 'infra_transient':
    case 'text_personalization':
    case 'integrity_blocked':
      return handleRecoveryRetry(prisma, exceptionCase, deps, now);
  }
}

/** Backfill/safety-net for terminal rows produced before the atomic hooks were deployed. */
export async function syncTerminalExceptionCases(
  prisma: PrismaClient,
  now: Date,
): Promise<number> {
  const [outboxRows, failedJobs] = await Promise.all([
    prisma.deliveryOutbox.findMany({
      where: {
        OR: [
          { status: 'invalid_payload' },
          { status: 'delivery_revoked' },
          { status: 'failed', failureClass: 'send_ambiguous' },
        ],
      },
      take: 20,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.generationJob.findMany({
      where: { status: 'failed', order: { status: 'failed' } },
      select: {
        orderId: true,
        retryable: true,
        lastError: true,
        failedAt: true,
        updatedAt: true,
      },
      take: 20,
      orderBy: { updatedAt: 'asc' },
    }),
  ]);
  const generationSources = failedJobs.map((job) =>
    `generation:${job.orderId}:${(job.failedAt ?? job.updatedAt).toISOString()}`,
  );
  const sourceRefs = [
    ...outboxRows.map((row) => row.id),
    ...generationSources,
  ];
  const existing = sourceRefs.length === 0
    ? []
    : await prisma.exceptionCase.findMany({
        where: { sourceRef: { in: sourceRefs } },
        select: { sourceRef: true },
      });
  const alreadyProduced = new Set(
    existing.map((row) => row.sourceRef).filter((value): value is string => Boolean(value)),
  );
  let produced = 0;
  for (const row of outboxRows) {
    if (alreadyProduced.has(row.id)) continue;
    const kind =
      row.status === 'invalid_payload'
        ? 'invalid_payload'
        : row.status === 'delivery_revoked'
          ? 'delivery_revoked'
          : 'send_ambiguous';
    await openExceptionCase(prisma, {
      orderId: row.orderId,
      scope: row.scope,
      kind,
      reason: row.lastError ?? row.failureClass ?? row.status,
      sourceRef: row.id,
      now,
      fenceExisting: true,
    });
    produced += 1;
  }
  for (const [index, job] of failedJobs.entries()) {
    const sourceRef = generationSources[index];
    if (alreadyProduced.has(sourceRef)) continue;
    await openExceptionCase(prisma, {
      orderId: job.orderId,
      kind: job.retryable ? 'infra_transient' : 'integrity_blocked',
      reason: job.lastError ?? 'generation_failed',
      sourceRef,
      now,
      fenceExisting: true,
      ...(job.retryable
        ? {}
        : { initialStatus: 'refund_pending' as const, nextActionAt: now }),
    });
    produced += 1;
  }
  return produced;
}

export type ExceptionDrainSummary = {
  synced: number;
  claimed: number;
  resolved: number;
  retry_scheduled: number;
  refund_pending: number;
  lost_lease: number;
};

export async function drainExceptionCases(
  prisma: PrismaClient,
  options: { limit?: number } = {},
  overrides: Partial<ExceptionProcessorDeps> = {},
): Promise<ExceptionDrainSummary> {
  const deps = { ...defaultDeps(), ...overrides };
  const now = deps.now();
  const synced = await syncTerminalExceptionCases(prisma, now);
  const rows = await claimDueExceptionCases(prisma, now, options.limit ?? 1);
  const summary: ExceptionDrainSummary = {
    synced,
    claimed: rows.length,
    resolved: 0,
    retry_scheduled: 0,
    refund_pending: 0,
    lost_lease: 0,
  };
  for (const row of rows) {
    const outcome = await processExceptionCase(prisma, row, deps);
    summary[outcome] += 1;
  }
  return summary;
}
