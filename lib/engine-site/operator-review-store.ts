import 'server-only';

import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { hashOperationPayload, runAtomicOperation, type AtomicOperationDeps } from '@/lib/generation-pipeline/atomic-operation';
import {
  authorityDigest, bookDigest, boundBookManifest, digestSchema, engineOrderAuthoritySchema, engineSiteFail,
  identifierSchema, type EngineOrderAuthority,
} from './contract';
import {
  launchGatePolicySchema, nextOperatorDecision, operatorDecisionDigest, operatorDecisionSchema, policyDigest,
  validateDecisionHistory, type LaunchGatePolicy,
} from './delivery-gate';
import { lockEngineOrder, requireRegisteredEngineAuthority } from './order-meter';

const KIND = 'engine_site_operator_review_v1';
const commandSchema = z.object({
  idempotencyKey: identifierSchema, orderId: identifierSchema, authoritySha256: digestSchema,
  bookSha256: digestSchema, policySha256: digestSchema, previousDecisionSha256: digestSchema.nullable(),
  actorId: identifierSchema, decision: z.enum(['approve', 'reject']), reason: z.string().trim().min(1).max(500),
}).strict();
const storedSchema = z.object({ command: commandSchema, decision: operatorDecisionSchema }).strict();
const operationKey = (orderId: string, id: string) => `engine-site/v1/${orderId}/operator-review/${id}`;

async function readHistory(tx: Prisma.TransactionClient, authority: EngineOrderAuthority, excludeOperation?: string) {
  const rows = await tx.atomicOperationReceipt.findMany({
    where: { orderId: authority.orderId, kind: { in: [KIND] } },
    select: { operationKey: true, orderId: true, kind: true, payloadHash: true, result: true },
  });
  const history = rows.filter(row => row.operationKey !== excludeOperation).map(row => {
    const { value } = z.object({ value: storedSchema }).strict().parse(row.result);
    const { command, decision } = value;
    if (row.operationKey !== operationKey(authority.orderId, command.idempotencyKey) ||
        row.payloadHash !== hashOperationPayload(command) || command.orderId !== authority.orderId ||
        command.authoritySha256 !== authorityDigest(authority) || decision.orderId !== command.orderId ||
        decision.authoritySha256 !== command.authoritySha256 || decision.bookSha256 !== command.bookSha256 ||
        decision.policySha256 !== command.policySha256 || decision.actorId !== command.actorId ||
        decision.previousDecisionSha256 !== command.previousDecisionSha256 || decision.decision !== command.decision ||
        decision.reason !== command.reason) engineSiteFail('operator_receipt_corrupt');
    return decision;
  }).sort((left, right) => left.sequence - right.sequence);
  return validateDecisionHistory(authority.orderId, authorityDigest(authority), history);
}
export { readHistory as readEngineOperatorHistoryInTx };

export async function readEngineOperatorHistory(db: PrismaClient, input: EngineOrderAuthority) {
  const authority = engineOrderAuthoritySchema.parse(input);
  return db.$transaction(async tx => {
    await lockEngineOrder(tx, authority.orderId); await requireRegisteredEngineAuthority(tx, authority);
    return readHistory(tx, authority);
  });
}

/**
 * Append-only audit using the existing Order lock and receipt/replay protocol. Actor/time/policy and
 * manifest must come from authenticated server state. This has no HTTP authorization by itself.
 * The eventual readiness/send path MUST re-read this history or bind/bump its delivery fence.
 */
export async function recordEngineOperatorDecision(db: PrismaClient, input: {
  authority: EngineOrderAuthority; manifest: unknown; policy: LaunchGatePolicy;
  expectedBookSha256: string; expectedPreviousDecisionSha256: string | null;
  idempotencyKey: string; actorId: string; decision: 'approve' | 'reject'; reason: string;
}, options: { now?: () => Date; atomic?: AtomicOperationDeps;
  beforeOrderLock?: (tx: Prisma.TransactionClient) => Promise<void>;
  onFreshDecision?: (tx: Prisma.TransactionClient, decision: ReturnType<typeof nextOperatorDecision>) => Promise<void> } = {}) {
  const authority = engineOrderAuthoritySchema.parse(input.authority), policy = launchGatePolicySchema.parse(input.policy);
  const book = boundBookManifest(authority, input.manifest);
  if (bookDigest(book) !== digestSchema.parse(input.expectedBookSha256)) engineSiteFail('operator_book_changed');
  const command = commandSchema.parse({ idempotencyKey: input.idempotencyKey, orderId: authority.orderId,
    authoritySha256: authorityDigest(authority), bookSha256: bookDigest(book), policySha256: policyDigest(policy),
    previousDecisionSha256: input.expectedPreviousDecisionSha256,
    actorId: input.actorId, decision: input.decision, reason: input.reason });
  const key = operationKey(authority.orderId, command.idempotencyKey);
  const stored = await runAtomicOperation(db, {
    operationKey: key, orderId: authority.orderId, kind: KIND, payloadHash: hashOperationPayload(command),
    beforeReceipt: async tx => {
      await options.beforeOrderLock?.(tx);
      await lockEngineOrder(tx, authority.orderId); await requireRegisteredEngineAuthority(tx, authority);
    },
    run: async tx => {
      const history = await readHistory(tx, authority, key), latest = history[history.length - 1];
      if ((latest ? operatorDecisionDigest(latest) : null) !== command.previousDecisionSha256) engineSiteFail('operator_review_conflict');
      const decision = nextOperatorDecision({ authority, manifest: book, policy, history,
        actorId: command.actorId, now: (options.now ?? (() => new Date()))(), decision: command.decision, reason: command.reason });
      await options.onFreshDecision?.(tx, decision);
      return storedSchema.parse({ command, decision });
    },
    validateReplay: async (_tx, value) => { storedSchema.parse(value); },
  }, options.atomic);
  return stored.decision;
}
