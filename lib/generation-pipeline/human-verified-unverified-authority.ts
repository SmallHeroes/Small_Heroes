import type { Prisma } from '@prisma/client';

import { canonicalHash } from '@/lib/canonical-json';

export interface LockedHumanVerificationGenerationJob {
  pipelineCache: Prisma.JsonValue | null;
}

/** Acquire GenerationJob after Order and return the exact cache snapshot that stays fixed through commit. */
export async function lockHumanVerificationGenerationJob(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<LockedHumanVerificationGenerationJob | null> {
  const rows = await tx.$queryRaw<LockedHumanVerificationGenerationJob[]>`
    SELECT "pipelineCache"
      FROM "GenerationJob"
     WHERE "orderId" = ${orderId}
     FOR UPDATE`;
  return rows[0] ?? null;
}

export interface HumanVerificationPaymentSnapshot {
  id: string;
  provider: string;
  amount: number;
  currency: string;
  paid: boolean;
  paidAt: Date | null;
}

export interface HumanVerificationPaymentOrderAuthority {
  stripePaid: boolean;
  paymentProvider: string | null;
  paymentId: string | null;
  totalPrice: number;
}

/**
 * The commercial authority shared by Inspect, Apply, and strict replay/readiness loading.
 *
 * `PaymentRecord.paid` alone is not enough: the Order must itself name a nonblank provider and
 * payment identifier, the paid record must be timestamped and belong to that exact provider, and
 * amount/currency must match the Order. Stripe keeps its additional legacy Order flag fence.
 */
export function hasStrictHumanVerificationPaymentAuthority(args: {
  order: HumanVerificationPaymentOrderAuthority | null;
  payment: HumanVerificationPaymentSnapshot | null;
}): boolean {
  const { order, payment } = args;
  if (!order || !payment) return false;
  if (!order.paymentProvider?.trim() || !order.paymentId?.trim()) return false;
  return (
    payment.paid === true &&
    payment.paidAt !== null &&
    payment.provider === order.paymentProvider &&
    payment.amount === order.totalPrice &&
    payment.currency.toLowerCase() === 'ils' &&
    (payment.provider !== 'stripe' || order.stripePaid === true)
  );
}

export interface HumanVerificationExceptionActivitySnapshot {
  id: string;
  kind: string;
  status: string;
  refundKey: string | null;
  providerActionId: string | null;
  actionAttemptedAt: Date | null;
  notificationAttemptedAt: Date | null;
  notificationMessageId: string | null;
  resolution: Prisma.JsonValue | null;
  lastError: string | null;
}

export interface HumanVerificationRefundAttemptSnapshot {
  refundKey: string;
  status: string;
  providerActionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dateIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export function deliveredUrlHash(url: string): string {
  return canonicalHash({ deliveredUrl: url });
}

export function refundAuthorityDigest(args: {
  exceptionCases: readonly HumanVerificationExceptionActivitySnapshot[];
  refundAttempts: readonly HumanVerificationRefundAttemptSnapshot[];
}): string {
  return canonicalHash({
    exceptionCases: [...args.exceptionCases]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        status: entry.status,
        refundKey: entry.refundKey,
        providerActionId: entry.providerActionId,
        actionAttemptedAt: dateIso(entry.actionAttemptedAt),
        notificationAttemptedAt: dateIso(entry.notificationAttemptedAt),
        notificationMessageId: entry.notificationMessageId,
        resolution: entry.resolution,
        lastError: entry.lastError,
      })),
    refundAttempts: [...args.refundAttempts]
      .sort((a, b) => a.refundKey.localeCompare(b.refundKey))
      .map((entry) => ({
        refundKey: entry.refundKey,
        status: entry.status,
        providerActionId: entry.providerActionId,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
  });
}

export function hasDisqualifyingRefundOrReconciliationActivity(args: {
  exceptionCases: readonly HumanVerificationExceptionActivitySnapshot[];
  refundAttempts: readonly HumanVerificationRefundAttemptSnapshot[];
}): boolean {
  if (args.refundAttempts.length > 0) return true;
  return args.exceptionCases.some((entry) => {
    const resolution = record(entry.resolution) ? entry.resolution : null;
    return (
      entry.kind === 'send_ambiguous' ||
      entry.kind === 'delivery_revoked' ||
      entry.status === 'refund_pending' ||
      entry.refundKey !== null ||
      entry.providerActionId !== null ||
      entry.actionAttemptedAt !== null ||
      entry.notificationAttemptedAt !== null ||
      entry.notificationMessageId !== null ||
      resolution?.refundConfirmed === true ||
      resolution?.noticeOutcome === 'ambiguous_no_resend'
    );
  });
}

export function paymentSnapshotDigest(args: {
  order: {
    stripePaid: boolean;
    paymentProvider: string | null;
    paymentId: string | null;
    stripePaymentId: string | null;
    totalPrice: number;
    manualReviewRequired: boolean;
  };
  payment: HumanVerificationPaymentSnapshot | null;
  paymentCaseActive: boolean;
  refundAuthorityDigest: string;
}): string {
  return canonicalHash({
    order: {
      stripePaid: args.order.stripePaid,
      paymentProvider: args.order.paymentProvider,
      paymentIdDigest: canonicalHash(args.order.paymentId ?? null),
      stripePaymentIdDigest: canonicalHash(args.order.stripePaymentId ?? null),
      totalPrice: args.order.totalPrice,
      manualReviewRequired: args.order.manualReviewRequired,
    },
    payment: args.payment
      ? {
          id: args.payment.id,
          provider: args.payment.provider,
          amount: args.payment.amount,
          currency: args.payment.currency,
          paid: args.payment.paid,
          paidAt: args.payment.paidAt?.toISOString() ?? null,
        }
      : null,
    paymentCaseActive: args.paymentCaseActive,
    refundAuthorityDigest: args.refundAuthorityDigest,
  });
}
