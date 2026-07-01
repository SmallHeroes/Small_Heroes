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
  hashPayload,
  idempotencyWindowMs,
  repairInvalidPayloadDelivery,
  type BookReadyPayload,
} from './delivery-outbox';
import { refundOrderPayment, prismaRefundFence, type RefundableOrder, type RefundResult, type RefundProviderDeps } from '@/lib/payment-refunds';
import { startChunkedGeneration } from './start';
import { commitBaseBookReadiness, type CommitResult } from '@/lib/generation-pipeline/readiness-manifest';
import { reQaUnknownQualityEvidence, type QualityRecoveryResult } from '@/lib/generation-pipeline/quality-recovery';
import { coverArtifactKey, pageNumberFromArtifactKey, QUALITY_REGEN_BUDGET } from '@/lib/generation-pipeline/quality-evidence';
import { clearOrderPageImages, clearOrderCover } from './clear-page-images-for-regen';
import { parsePipelineCache } from '@/lib/generation-pipeline/helpers';
import { resolveAnchorDeliveryGate } from '@/lib/anchor-resemblance-gate';
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
  /** (#7-a 6 regen-rescue) Delete the given pages' image assets so a redrive re-renders them. */
  clearPageAssets: (prisma: PrismaClient, orderId: string, pageNumbers: number[]) => Promise<number>;
  /** (#7-a 6 regen-rescue) Clear the cover so a redrive re-renders it. */
  clearCoverAsset: (prisma: PrismaClient, orderId: string) => Promise<boolean>;
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
    clearPageAssets: (prisma, orderId, pageNumbers) => clearOrderPageImages(prisma, orderId, pageNumbers),
    clearCoverAsset: (prisma, orderId) => clearOrderCover(prisma, orderId),
    recommitReadiness: async (prisma, orderId) => {
      const job = await prisma.generationJob.findUnique({
        where: { orderId },
        select: { pipelineCache: true },
      });
      const cache = parsePipelineCache(job?.pipelineCache);
      const gate = resolveAnchorDeliveryGate(cache.childAnchorLowConfidence);
      return commitBaseBookReadiness(prisma, {
        orderId,
        anchorAllowsDelivery: gate.sendBookReadyEmail,
        anchorOrderStatus: gate.orderStatus,
        anchorReason: gate.reason,
      });
    },
  };
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
    if (exceptionCase.sourceRef?.startsWith('generation:')) {
      const order = await prisma.order.findUnique({
        where: { id: exceptionCase.orderId },
        select: { status: true, generationJob: { select: { status: true } } },
      });
      if (order?.status === 'ready' || order?.status === 'partial') {
        return resolveCase(
          prisma,
          exceptionCase,
          'generation_recovered',
          now,
          { outcome: 'ready' },
        );
      }
      if (order?.status === 'generating' && ['pending', 'running'].includes(order.generationJob?.status ?? '')) {
        return retryLater(prisma, exceptionCase, 'generation_in_progress', now);
      }
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

    // (#7-a 6) Quality-evidence-unknown recovery: re-QA the REQUIRED artifacts vs their CURRENT delivered bytes
    // (ZERO renders) BEFORE the recommit — recovering a missing/hash-mismatched/stale/un-QA'd asset.
    if (exceptionCase.reason?.startsWith('quality_evidence_unknown')) {
      const recovery = await deps.reQaQualityEvidence(prisma, exceptionCase.orderId);
      // (#6-fix BLOCKER 2) Regen-rescue: a deterministic FAIL with budget remaining (regenCount < cap) gets a
      // TARGETED regen — clear that page/cover asset + redrive its render (the 5b durable reserve honors the
      // budget). The new bytes are re-QA'd on the next tick; regenCount reaches the cap → the recommit opens
      // quality_failed → refund (the "up to two replacements, then refund" contract).
      const rescuePages: number[] = [];
      let rescueCover = false;
      for (const f of recovery.nowFailed) {
        if (f.regenCount >= QUALITY_REGEN_BUDGET) continue; // budget spent → terminal (recommit → quality_failed)
        if (f.artifactKey === coverArtifactKey()) rescueCover = true;
        else {
          const pageNumber = pageNumberFromArtifactKey(f.artifactKey);
          if (pageNumber != null) rescuePages.push(pageNumber);
        }
      }
      if (rescuePages.length > 0 || rescueCover) {
        if (rescuePages.length > 0) await deps.clearPageAssets(prisma, exceptionCase.orderId, rescuePages);
        if (rescueCover) await deps.clearCoverAsset(prisma, exceptionCase.orderId);
        const started = await deps.redriveGeneration(exceptionCase.orderId);
        // (#6-fix-2) A non-started redrive is NOT a regen — the render never ran, so the 5b budget was NOT
        // consumed. Surface it distinctly instead of masquerading a no-op as a successful rescue (which was the
        // bug: startChunkedGeneration rejected needs_human_qa → started:false → silent retry → attempts-cap
        // "delete + refund"). The carve-out (reason exception_case_recovery) now claims needs_human_qa →
        // generating so a real rescue starts; a persistent non-start still hits the recovery-attempts cap → refund.
        if (!started.started) {
          return retryLater(
            prisma,
            exceptionCase,
            'quality_regen_rescue_redrive_not_started',
            now,
            started.message ?? 'redrive_not_started',
          );
        }
        return retryLater(
          prisma,
          exceptionCase,
          `quality_regen_rescue:pages=${rescuePages.length}${rescueCover ? '+cover' : ''}`,
          now,
          null,
        );
      }
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
