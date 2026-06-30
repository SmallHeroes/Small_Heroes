import 'server-only';

import { createHash } from 'crypto';
import {
  Prisma,
  type ExceptionCase,
  type ExceptionCaseKind,
  type ExceptionCaseStatus,
  type PrismaClient,
} from '@prisma/client';

export const EXCEPTION_SCOPE_BASE_BOOK = 'base_book';
export const EXCEPTION_LEASE_MS = 4 * 60 * 1000;
export const EXCEPTION_MAX_RECOVERY_ATTEMPTS = 3;

type Db = PrismaClient | Prisma.TransactionClient;
type Tx = Prisma.TransactionClient;

const TERMINAL = new Set<ExceptionCaseStatus>(['resolved', 'cancelled']);

export function exceptionActiveKey(orderId: string, scope: string): string {
  return `${orderId}:${scope}`;
}

function stableEventKey(parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

function initialDisposition(kind: ExceptionCaseKind): {
  status: ExceptionCaseStatus;
  delayMs: number;
} {
  switch (kind) {
    case 'safety_failed':
    case 'quality_failed':
    case 'delivery_revoked':
      return { status: 'refund_pending', delayMs: 0 };
    case 'unusable_photo':
      // The secure same-order replacement-photo flow belongs to Phase 3 and is not reachable in Phase 1.
      // Fail closed if a producer appears early rather than send a link to a flow that does not exist.
      return { status: 'refund_pending', delayMs: 0 };
    case 'infra_transient':
    case 'text_personalization':
    case 'integrity_blocked':
      return { status: 'retry_scheduled', delayMs: 60_000 };
    case 'send_ambiguous':
    case 'invalid_payload':
      return { status: 'open', delayMs: 0 };
  }
}

export interface OpenExceptionCaseArgs {
  orderId: string;
  scope?: string;
  kind: ExceptionCaseKind;
  reason: string;
  sourceRef?: string | null;
  now?: Date;
  initialStatus?: ExceptionCaseStatus;
  nextActionAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Idempotent producer. The unique activeKey collapses concurrent/replayed producers to one active case.
 * Audit insertion uses a deterministic event key + createMany(skipDuplicates), so producer retries do not
 * manufacture duplicate audit history.
 */
export async function openExceptionCase(
  db: Db,
  args: OpenExceptionCaseArgs,
): Promise<ExceptionCase> {
  const now = args.now ?? new Date();
  const scope = args.scope ?? EXCEPTION_SCOPE_BASE_BOOK;
  const activeKey = exceptionActiveKey(args.orderId, scope);
  const disposition = initialDisposition(args.kind);
  const status = args.initialStatus ?? disposition.status;
  if (TERMINAL.has(status)) {
    throw new Error(`exception_case_cannot_open_terminal:${status}`);
  }
  const nextActionAt =
    args.nextActionAt === undefined
      ? new Date(now.getTime() + disposition.delayMs)
      : args.nextActionAt;

  const exceptionCase = await db.exceptionCase.upsert({
    where: { activeKey },
    create: {
      activeKey,
      orderId: args.orderId,
      scope,
      kind: args.kind,
      status,
      reason: args.reason,
      sourceRef: args.sourceRef ?? null,
      nextActionAt,
    },
    update: {
      // Do not rewind lifecycle progress (for example refund_pending → open) on a replayed producer.
      kind: args.kind,
      reason: args.reason,
      sourceRef: args.sourceRef ?? undefined,
      lastError: null,
    },
  });

  await db.exceptionCaseAudit.createMany({
    data: [{
      eventKey: stableEventKey([
        'producer',
        exceptionCase.id,
        args.kind,
        args.reason,
        args.sourceRef ?? null,
      ]),
      caseId: exceptionCase.id,
      fromStatus: null,
      toStatus: exceptionCase.status,
      actor: 'system',
      reason: `producer:${args.reason}`,
      metadata: args.metadata,
      createdAt: now,
    }],
    skipDuplicates: true,
  });
  return exceptionCase;
}

export interface TransitionExceptionArgs {
  caseId: string;
  claimVersion: number;
  fromStatus: ExceptionCaseStatus;
  toStatus: ExceptionCaseStatus;
  reason: string;
  now?: Date;
  nextActionAt?: Date | null;
  resolution?: Prisma.InputJsonValue | null;
  lastError?: string | null;
  providerActionId?: string | null;
  actionAttemptedAt?: Date | null;
  notificationMessageId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/** Fenced state transition + immutable audit in one transaction. */
export async function transitionExceptionCase(
  prisma: PrismaClient,
  args: TransitionExceptionArgs,
): Promise<boolean> {
  const now = args.now ?? new Date();
  return prisma.$transaction(async (tx) => transitionExceptionCaseInTx(tx, args, now));
}

async function transitionExceptionCaseInTx(
  tx: Tx,
  args: TransitionExceptionArgs,
  now: Date,
): Promise<boolean> {
  const terminal = TERMINAL.has(args.toStatus);
  const data: Prisma.ExceptionCaseUpdateManyMutationInput = {
    status: args.toStatus,
    activeKey: terminal ? null : undefined,
    nextActionAt: terminal ? null : (args.nextActionAt ?? null),
    leaseExpiresAt: null,
    claimVersion: { increment: 1 },
    resolution: args.resolution === null ? Prisma.DbNull : args.resolution,
    lastError: args.lastError,
    providerActionId: args.providerActionId,
    actionAttemptedAt: args.actionAttemptedAt,
    notificationMessageId: args.notificationMessageId,
    ...(args.toStatus === 'refund_pending' ? { refundKey: `refund/${args.caseId}` } : {}),
  };
  const updated = await tx.exceptionCase.updateMany({
    where: {
      id: args.caseId,
      status: args.fromStatus,
      claimVersion: args.claimVersion,
    },
    data,
  });
  if (updated.count === 0) return false;

  await tx.exceptionCaseAudit.create({
    data: {
      eventKey: stableEventKey([
        'transition',
        args.caseId,
        args.claimVersion,
        args.fromStatus,
        args.toStatus,
      ]),
      caseId: args.caseId,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
      actor: 'system',
      reason: args.reason,
      metadata: args.metadata,
      createdAt: now,
    },
  });
  return true;
}

/**
 * Resolve a recovery case from inside the transaction that proved the book healthy. This also bumps
 * claimVersion, fencing any processor that evaluated older truth.
 */
export async function resolveActiveRecoveryCaseInTx(
  tx: Tx,
  args: {
    orderId: string;
    scope?: string;
    kinds: ExceptionCaseKind[];
    reason: string;
    now: Date;
  },
): Promise<boolean> {
  const scope = args.scope ?? EXCEPTION_SCOPE_BASE_BOOK;
  const current = await tx.exceptionCase.findUnique({
    where: { activeKey: exceptionActiveKey(args.orderId, scope) },
  });
  if (!current || !args.kinds.includes(current.kind)) return false;
  const updated = await tx.exceptionCase.updateMany({
    where: { id: current.id, claimVersion: current.claimVersion, status: current.status },
    data: {
      status: 'resolved',
      activeKey: null,
      nextActionAt: null,
      leaseExpiresAt: null,
      claimVersion: { increment: 1 },
      resolution: { outcome: 'recovered', reason: args.reason },
      lastError: null,
    },
  });
  if (updated.count === 0) return false;
  await tx.exceptionCaseAudit.create({
    data: {
      eventKey: stableEventKey([
        'recovered',
        current.id,
        current.claimVersion,
        args.reason,
      ]),
      caseId: current.id,
      fromStatus: current.status,
      toStatus: 'resolved',
      actor: 'system',
      reason: args.reason,
      createdAt: args.now,
    },
  });
  return true;
}

/** Atomic SKIP-LOCKED claim. `attempts` is action budget; `claimVersion` is the fencing token. */
export async function claimDueExceptionCases(
  prisma: PrismaClient,
  now: Date,
  limit = 1,
): Promise<ExceptionCase[]> {
  const leaseExpiresAt = new Date(now.getTime() + EXCEPTION_LEASE_MS);
  return prisma.$queryRaw<ExceptionCase[]>`
    UPDATE "ExceptionCase"
       SET "claimVersion" = "claimVersion" + 1,
           "attempts" = "attempts" + 1,
           "leaseExpiresAt" = ${leaseExpiresAt},
           "updatedAt" = ${now}
     WHERE "id" IN (
       SELECT "id"
         FROM "ExceptionCase"
        WHERE "status" IN ('open', 'retry_scheduled', 'customer_action', 'refund_pending')
          AND ("nextActionAt" IS NULL OR "nextActionAt" <= ${now})
          AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" < ${now})
        ORDER BY "nextActionAt" ASC NULLS FIRST, "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
     )
     RETURNING *`;
}

export function exceptionBackoffMs(attempts: number): number {
  return Math.min(60_000 * Math.pow(2, Math.max(0, attempts - 1)), 6 * 60 * 60 * 1000);
}
