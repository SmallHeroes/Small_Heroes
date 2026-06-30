import 'server-only';

import { createHash } from 'crypto';
import {
  Prisma,
  type ExceptionCase,
  type ExceptionCaseKind,
  type ExceptionCaseStatus,
  type DeliveryOutbox,
  type PrismaClient,
} from '@prisma/client';
import {
  enqueueDelivery,
  type BookReadyPayload,
} from './delivery-outbox';
import { isCanonicalReadUrl } from '@/lib/generation-pipeline/integrity-gate';

export const EXCEPTION_SCOPE_BASE_BOOK = 'base_book';
export const EXCEPTION_LEASE_MS = 4 * 60 * 1000;
export const EXCEPTION_MAX_RECOVERY_ATTEMPTS = 3;
// (#6-FIX-2) Total reissues allowed per order:scope, and the GLOBAL window from the FIRST send attempt. Durable,
// so a chain of ambiguous→failed successors (each a new case + fulfillmentVersion + clock) cannot reissue forever.
export const REISSUE_BUDGET = 1;
export const REISSUE_WINDOW_MS = 48 * 60 * 60 * 1000;

// (#6 FIX-4b) Thrown from inside the reissue tx when the budget is exhausted at consume-time — AFTER the case
// claim — so the whole tx (incl. the transition) rolls back, leaving the case un-resolved and the budget
// unconsumed. The caller maps it to a refund. (Returning instead would commit a resolved-without-delivery case.)
export class ReissueBudgetExhaustedError extends Error {
  constructor() {
    super('reissue_budget_exhausted');
    this.name = 'ReissueBudgetExhaustedError';
  }
}

export type ReissueBudgetOutcome = 'consumed' | 'exhausted' | 'window_expired';

/**
 * (#6-FIX-2) Atomically consume one unit of the durable order:scope reissue budget. The window anchor is the
 * FIRST send attempt of the ORIGINAL delivery (persisted as `windowStartAt` on first consume), NOT a per-case
 * clock, so it survives across cases + fulfillmentVersions. Runs INSIDE the reissue transaction so the budget can
 * never be over-consumed by a concurrent reissue (the count<BUDGET guard is a conditional updateMany).
 */
export async function consumeReissueBudget(
  tx: Tx,
  args: { orderId: string; scope: string; firstSendAttemptAt: Date | null; now: Date },
): Promise<ReissueBudgetOutcome> {
  const cutoff = new Date(args.now.getTime() - REISSUE_WINDOW_MS);
  const existing = await tx.reissueBudget.findUnique({
    where: { orderId_scope: { orderId: args.orderId, scope: args.scope } },
  });
  if (!existing) {
    // First reissue: anchor the global window on the original delivery's first send attempt.
    if (!args.firstSendAttemptAt || args.firstSendAttemptAt <= cutoff) return 'window_expired';
    if (REISSUE_BUDGET < 1) return 'exhausted';
    await tx.reissueBudget.create({
      data: { orderId: args.orderId, scope: args.scope, count: 1, windowStartAt: args.firstSendAttemptAt },
    });
    return 'consumed';
  }
  if (existing.windowStartAt <= cutoff) return 'window_expired';
  const bumped = await tx.reissueBudget.updateMany({
    where: { orderId: args.orderId, scope: args.scope, count: { lt: REISSUE_BUDGET } },
    data: { count: { increment: 1 } },
  });
  return bumped.count === 1 ? 'consumed' : 'exhausted';
}

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

// (#6-FIX-1) Kind precedence — higher = more severe. A pre-external case may be UPGRADED to a strictly
// higher-priority kind; it may never be downgraded or sideways-replaced.
const KIND_PRECEDENCE: Record<ExceptionCaseKind, number> = {
  infra_transient: 1,
  text_personalization: 2,
  integrity_blocked: 3,
  delivery_revoked: 4,
  unusable_photo: 5,
  quality_failed: 6,
  safety_failed: 7,
  // Delivery-reconciliation kinds are PROTECTED (never auto-replaced); precedence is unused for them.
  send_ambiguous: 0,
  invalid_payload: 0,
};

// A case is PROTECTED — its kind/status/sourceRef must NOT be overwritten by a later producer — once it is in or
// past an external action (refund/customer notice), or is a delivery-reconciliation case. Overwriting it (e.g. a
// later generation/readiness failure clobbering `send_ambiguous`) would bypass provider reconciliation and could
// refund an email that may already have delivered. (#6-FIX-1)
const PROTECTED_STATUSES = new Set<ExceptionCaseStatus>(['refund_pending', 'customer_action']);
const PROTECTED_KINDS = new Set<ExceptionCaseKind>(['send_ambiguous', 'invalid_payload']);
function isProtectedCase(c: Pick<ExceptionCase, 'status' | 'kind' | 'actionAttemptedAt'>): boolean {
  return PROTECTED_STATUSES.has(c.status) || PROTECTED_KINDS.has(c.kind) || c.actionAttemptedAt != null;
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
  /** Superseding producer signal: invalidate any processor claim based on the previous failure class. */
  fenceExisting?: boolean;
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

  // Existence at audit-label time: distinguishes a genuine creation (`producer:`) from a replay recorded against
  // an existing case (`producer_recorded:`). Cosmetic-only — it never gates the atomic decision below.
  const existedBefore = (await db.exceptionCase.findUnique({ where: { activeKey }, select: { id: true } })) != null;

  // (#6-FIX-1) Reconciliation-priority. The atomic upsert still collapses concurrent/replayed producers to one
  // row, but its `update` clause NO LONGER rewrites kind/status/sourceRef — so a later producer (e.g. a generation
  // or readiness failure) can never clobber a PROTECTED case (external action in flight, or a delivery-recon kind
  // like send_ambiguous) and bypass provider reconciliation / refund an email that may have delivered. The ONLY
  // permitted kind change is an explicit UPGRADE of a still-pre-external case to a strictly higher-priority kind,
  // applied below as a fenced guarded update.
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
      // Never rewind lifecycle or rewrite kind/status/sourceRef. Only clear lastError and (on a superseding
      // signal) fence any stale processor claim on the previous failure class.
      lastError: null,
      claimVersion: args.fenceExisting ? { increment: 1 } : undefined,
      leaseExpiresAt: args.fenceExisting ? null : undefined,
    },
  });

  // A pre-existing row keeps its own kind through the upsert; if it is still pre-external (open/retry_scheduled,
  // no send attempted) and the incoming kind is strictly higher-priority, promote it — fenced on the observed
  // state so a concurrent change is never clobbered. The label reflects actual insertion, not kind equality, so a
  // same-kind replay against an existing case is correctly logged as `producer_recorded:` (not `producer:`).
  let applied: 'created' | 'upgraded' | 'recorded' = existedBefore ? 'recorded' : 'created';
  let result = exceptionCase;
  if (
    exceptionCase.kind !== args.kind &&
    !isProtectedCase(exceptionCase) &&
    (exceptionCase.status === 'open' || exceptionCase.status === 'retry_scheduled') &&
    KIND_PRECEDENCE[args.kind] > KIND_PRECEDENCE[exceptionCase.kind]
  ) {
    const upgraded = await db.exceptionCase.updateMany({
      where: {
        activeKey,
        claimVersion: exceptionCase.claimVersion,
        status: exceptionCase.status,
        kind: exceptionCase.kind,
        actionAttemptedAt: null,
      },
      data: {
        kind: args.kind,
        status,
        reason: args.reason,
        sourceRef: args.sourceRef ?? undefined,
        nextActionAt,
        lastError: null,
      },
    });
    if (upgraded.count === 1) {
      result = (await db.exceptionCase.findUnique({ where: { activeKey } })) ?? exceptionCase;
      applied = 'upgraded';
    }
  }

  await db.exceptionCaseAudit.createMany({
    data: [{
      eventKey: stableEventKey([
        'producer',
        result.id,
        args.kind,
        args.reason,
        args.sourceRef ?? null,
      ]),
      caseId: result.id,
      fromStatus: null,
      toStatus: result.status,
      actor: 'system',
      // `producer_recorded:` marks a signal logged but NOT applied (protected / not-higher-priority) — the
      // reconciliation path on the existing kind is preserved. `producer_upgraded:` marks an applied promotion.
      reason:
        applied === 'upgraded'
          ? `producer_upgraded:${args.reason}`
          : applied === 'recorded'
            ? `producer_recorded:${args.reason}`
            : `producer:${args.reason}`,
      metadata: args.metadata,
      createdAt: now,
    }],
    skipDuplicates: true,
  });
  return result;
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

/**
 * Provider-confirmed delivery closes both sides of reconciliation atomically. A crash can therefore
 * observe either "ambiguous + active case" or "sent + resolved case", never the dangerous half-state.
 */
export async function resolveAmbiguousDelivery(
  prisma: PrismaClient,
  args: {
    exceptionCase: Pick<ExceptionCase, 'id' | 'status' | 'claimVersion'>;
    outboxId: string;
    providerMessageId: string;
    providerEvent: string | null;
    now: Date;
  },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const moved = await transitionExceptionCaseInTx(tx, {
      caseId: args.exceptionCase.id,
      claimVersion: args.exceptionCase.claimVersion,
      fromStatus: args.exceptionCase.status,
      toStatus: 'resolved',
      reason: 'provider_confirmed_delivered',
      resolution: {
        outcome: 'delivered',
        providerEvent: args.providerEvent,
        providerMessageId: args.providerMessageId,
      },
      providerActionId: args.providerMessageId,
      now: args.now,
    }, args.now);
    if (!moved) return false;

    const outbox = await tx.deliveryOutbox.updateMany({
      where: {
        id: args.outboxId,
        status: 'failed',
        failureClass: 'send_ambiguous',
      },
      data: {
        status: 'sent',
        sentAt: args.now,
        providerMessageId: args.providerMessageId,
        failureClass: null,
        lastError: `reconciled:${args.providerEvent ?? 'delivered'}`,
      },
    });
    if (outbox.count !== 1) {
      throw new Error(`ambiguous_delivery_source_changed:${args.outboxId}`);
    }
    return true;
  });
}

/**
 * A provider-confirmed failed email is no longer ambiguous. Create one explicit new fulfillment
 * intent (new key) and close the old case in the same transaction. This is the only automatic path
 * that rolls fulfillmentVersion; it is impossible while provider delivery remains unknown.
 */
export async function reissueConfirmedFailedDelivery(
  prisma: PrismaClient,
  args: {
    exceptionCase: Pick<ExceptionCase, 'id' | 'status' | 'claimVersion' | 'orderId'>;
    outboxId: string;
    providerMessageId: string;
    providerEvent: string | null;
    now: Date;
  },
): Promise<'reissued' | 'not_ready' | 'lost_lease'> {
  return prisma.$transaction(async (tx) => {
    const [oldOutbox, order, readiness] = await Promise.all([
      tx.deliveryOutbox.findUnique({ where: { id: args.outboxId } }),
      tx.order.findUnique({
        where: { id: args.exceptionCase.orderId },
        select: {
          status: true,
          fulfillmentVersion: true,
          inputVersion: true,
          customerEmail: true,
          customerName: true,
          childName: true,
          book: {
            select: {
              readUrl: true,
              pdfUrl: true,
              pages: {
                orderBy: { pageNumber: 'asc' },
                select: { audioUrl: true },
              },
            },
          },
        },
      }),
      tx.bookReadiness.findUnique({
        where: {
          orderId_scope: {
            orderId: args.exceptionCase.orderId,
            scope: EXCEPTION_SCOPE_BASE_BOOK,
          },
        },
        select: { status: true, currentManifestId: true },
      }),
    ]);
    if (
      !oldOutbox ||
      oldOutbox.status !== 'failed' ||
      oldOutbox.failureClass !== 'send_ambiguous'
    ) {
      return 'lost_lease';
    }
    if (
      !order?.book ||
      order.status !== 'ready' ||
      readiness?.status !== 'passed' ||
      !readiness.currentManifestId ||
      !isCanonicalReadUrl(
        order.book.readUrl,
        args.exceptionCase.orderId,
        process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL,
      )
    ) {
      return 'not_ready';
    }

    // (#6 FIX-4b) Claim the case FIRST. If we lost the lease, return WITHOUT touching the budget — a lost lease
    // must never burn the single reissue. The tx commits with no transition and no budget change.
    const moved = await transitionExceptionCaseInTx(tx, {
      caseId: args.exceptionCase.id,
      claimVersion: args.exceptionCase.claimVersion,
      fromStatus: args.exceptionCase.status,
      toStatus: 'resolved',
      reason: 'provider_confirmed_failed_reissued',
      resolution: {
        outcome: 'reissued',
        providerEvent: args.providerEvent,
        providerMessageId: args.providerMessageId,
        previousOutboxId: oldOutbox.id,
        fulfillmentVersion: order.fulfillmentVersion + 1,
      },
      providerActionId: args.providerMessageId,
      now: args.now,
    }, args.now);
    if (!moved) return 'lost_lease';

    // (#6-FIX-2) We hold the claim → consume the durable order:scope reissue budget atomically with the reissue.
    // An exhausted budget or an expired GLOBAL 48h window (anchored on the original first send attempt) → THROW so
    // the whole tx (incl. the transition above) rolls back and the caller refunds (#6 FIX-4b: throwing, not
    // returning, keeps the case un-resolved + the budget unconsumed on the rare pre-check/consume TOCTOU race).
    const budget = await consumeReissueBudget(tx, {
      orderId: args.exceptionCase.orderId,
      scope: EXCEPTION_SCOPE_BASE_BOOK,
      firstSendAttemptAt: oldOutbox.firstSendAttemptAt,
      now: args.now,
    });
    if (budget !== 'consumed') throw new ReissueBudgetExhaustedError();

    const version = order.fulfillmentVersion + 1;
    const rolled = await tx.order.updateMany({
      where: {
        id: args.exceptionCase.orderId,
        status: 'ready',
        fulfillmentVersion: order.fulfillmentVersion,
        inputVersion: order.inputVersion,
      },
      data: { fulfillmentVersion: version },
    });
    if (rolled.count !== 1) throw new Error('redelivery_order_changed');

    const firstAudio = order.book.pages.find((page) => page.audioUrl?.trim())?.audioUrl;
    const payload: BookReadyPayload = {
      to: order.customerEmail,
      customerName: order.customerName || order.childName,
      childName: order.childName,
      readUrl: order.book.readUrl!,
      audioUrl: firstAudio ?? undefined,
      pdfUrl: order.book.pdfUrl ?? undefined,
    };
    await enqueueDelivery(tx, {
      orderId: args.exceptionCase.orderId,
      scope: EXCEPTION_SCOPE_BASE_BOOK,
      fulfillmentVersion: version,
      manifestId: readiness.currentManifestId,
      inputVersion: order.inputVersion,
      payload,
      now: args.now,
    });
    const retired = await tx.deliveryOutbox.updateMany({
      where: {
        id: oldOutbox.id,
        status: 'failed',
        failureClass: 'send_ambiguous',
      },
      data: {
        failureClass: 'provider_confirmed_failed',
        lastError: `reissued:${args.providerEvent ?? 'failed'}`,
      },
    });
    if (retired.count !== 1) throw new Error('redelivery_source_changed');
    return 'reissued';
  });
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
  // Once recovery crossed into an external customer/payment action, a later healthy evaluation
  // cannot silently cancel that obligation and deliver the book as if nothing happened.
  if (
    !['open', 'retry_scheduled'].includes(current.status) ||
    current.actionAttemptedAt ||
    current.notificationAttemptedAt
  ) {
    return false;
  }
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

/**
 * Persist external-effect intent before calling a provider. The claim token is intentionally not
 * advanced: the same worker keeps its fence, while a reclaimed/stale worker cannot reserve a new
 * effect. The timestamp survives a crash and bounds any idempotent replay window.
 */
export async function reserveExceptionExternalAction(
  prisma: PrismaClient,
  args: {
    caseId: string;
    claimVersion: number;
    status: ExceptionCaseStatus;
    action: 'refund' | 'notification';
    now: Date;
  },
): Promise<Date | null> {
  const field =
    args.action === 'refund' ? 'actionAttemptedAt' : 'notificationAttemptedAt';
  await prisma.exceptionCase.updateMany({
    where: {
      id: args.caseId,
      status: args.status,
      claimVersion: args.claimVersion,
      [field]: null,
    },
    data: {
      [field]: args.now,
      ...(args.action === 'refund' ? { refundKey: `refund/${args.caseId}` } : {}),
    },
  });
  const current = await prisma.exceptionCase.findUnique({
    where: { id: args.caseId },
    select: {
      status: true,
      claimVersion: true,
      actionAttemptedAt: true,
      notificationAttemptedAt: true,
    },
  });
  if (
    current?.status !== args.status ||
    current.claimVersion !== args.claimVersion
  ) {
    return null;
  }
  return args.action === 'refund'
    ? current.actionAttemptedAt
    : current.notificationAttemptedAt;
}

/**
 * Outbox terminal + ExceptionCase producer are one commit. If the fencing token is stale, neither row changes.
 */
export async function fencedOutboxTerminalWithException(
  prisma: PrismaClient,
  args: {
    row: Pick<DeliveryOutbox, 'id' | 'orderId' | 'scope'>;
    token: number;
    outboxData: Prisma.DeliveryOutboxUpdateManyMutationInput;
    kind: Extract<ExceptionCaseKind, 'send_ambiguous' | 'invalid_payload' | 'delivery_revoked'>;
    reason: string;
    now: Date;
  },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.deliveryOutbox.updateMany({
      where: { id: args.row.id, status: 'processing', attempts: args.token },
      data: args.outboxData,
    });
    if (updated.count === 0) return false;
    await openExceptionCase(tx, {
      orderId: args.row.orderId,
      scope: args.row.scope,
      kind: args.kind,
      reason: args.reason,
      sourceRef: args.row.id,
      now: args.now,
      fenceExisting: true,
    });
    return true;
  });
}
