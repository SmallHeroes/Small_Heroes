import 'server-only';

import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  hashOperationPayload, runAtomicOperation, type AtomicOperationDeps,
} from '@/lib/generation-pipeline/atomic-operation';
import {
  authorityDigest, digestSchema, engineOrderAuthoritySchema, engineSiteFail, ENGINE_SITE_PROTOCOL,
  identifierSchema, microUsdSchema, type EngineOrderAuthority,
} from './contract';

const KINDS = {
  authority: 'engine_site_authority_v1', claim: 'engine_site_call_claim_v1', result: 'engine_site_call_result_v1',
} as const;
type Tx = Prisma.TransactionClient;
const authorityKey = (orderId: string) => `engine-site/v1/${identifierSchema.parse(orderId)}/authority`;
const callKey = (orderId: string, step: string, suffix: 'claim' | 'result') =>
  `engine-site/v1/${identifierSchema.parse(orderId)}/call/${identifierSchema.parse(step)}/${suffix}`;

const callSchema = z.object({
  step: identifierSchema,
  wireSha256: digestSchema,
  maximumMicroUsd: microUsdSchema.refine(value => value > 0),
}).strict();
export type EngineCall = z.infer<typeof callSchema>;
const claimSchema = callSchema.extend({
  authoritySha256: digestSchema,
  invocationId: z.string().uuid(),
}).strict();
const resultSchema = z.object({
  step: identifierSchema, wireSha256: digestSchema, authoritySha256: digestSchema,
  completed: z.boolean(), estimatedMicroUsd: microUsdSchema.nullable(), receiptSha256: digestSchema,
}).strict();
export type EngineCallResult = z.infer<typeof resultSchema>;
const unwrap = <T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> => z.object({ value: schema }).strict().parse(input).value;

type LockedOrder = {
  id: string; status: string; deliveryHoldReason: string | null; manualReviewRequired: boolean;
  paymentProvider: string | null; paymeTransactionId: string | null;
  selectionFilename: string | null; visualPackageAuthority: unknown; hasJob: boolean; frozenProductVersion: string | null;
};

/** Order-first lock order matches existing delivery/refund barriers. No provider is called in a transaction. */
async function lockOrder(tx: Tx, orderId: string): Promise<LockedOrder> {
  const rows = await tx.$queryRaw<LockedOrder[]>`
    SELECT o."id", o."status"::text AS "status", o."deliveryHoldReason", o."manualReviewRequired",
           o."paymentProvider", o."paymeTransactionId", o."selectionFilename", o."visualPackageAuthority", o."frozenProductVersion",
           EXISTS (SELECT 1 FROM "GenerationJob" j WHERE j."orderId" = o."id") AS "hasJob"
      FROM "Order" o WHERE o."id" = ${orderId} FOR UPDATE OF o`;
  if (rows.length !== 1) engineSiteFail('engine_order_missing');
  const order = rows[0];
  if (order.selectionFilename !== null || order.visualPackageAuthority !== null) engineSiteFail('engine_bank_order_refused');
  if (order.frozenProductVersion !== ENGINE_SITE_PROTOCOL) engineSiteFail('engine_order_protocol_mismatch');
  return order;
}

function assertDispatchable(order: LockedOrder) {
  if (!['paid', 'generating'].includes(order.status) || order.deliveryHoldReason !== null || order.manualReviewRequired ||
      order.paymentProvider !== 'payme' || !order.paymeTransactionId?.trim()) engineSiteFail('engine_order_not_dispatchable');
}

async function requireAuthority(tx: Tx, authority: EngineOrderAuthority) {
  const receipt = await tx.atomicOperationReceipt.findUnique({ where: { operationKey: authorityKey(authority.orderId) },
    select: { kind: true, orderId: true, payloadHash: true, result: true } });
  if (!receipt || receipt.kind !== KINDS.authority || receipt.orderId !== authority.orderId ||
      receipt.payloadHash !== hashOperationPayload(authority)) engineSiteFail('engine_authority_missing_or_changed');
  const recorded = unwrap(engineOrderAuthoritySchema, receipt.result);
  if (authorityDigest(recorded) !== authorityDigest(authority)) engineSiteFail('engine_authority_missing_or_changed');
}

/** Shared by the audited operator store; these helpers do not dispatch or modify Order. */
export { lockOrder as lockEngineOrder, requireAuthority as requireRegisteredEngineAuthority };

/**
 * Bind before generation/job creation. In a future order route this belongs in its order-creation
 * transaction; this standalone boundary is inactive until an authorized server caller uses it.
 * It does NOT prove that a supplied approval reference was approved: server admission owns that.
 */
export async function registerEngineOrderAuthority(db: PrismaClient, input: unknown, deps?: AtomicOperationDeps) {
  const authority = engineOrderAuthoritySchema.parse(input);
  let order: LockedOrder;
  return runAtomicOperation(db, {
    operationKey: authorityKey(authority.orderId), orderId: authority.orderId, kind: KINDS.authority,
    payloadHash: hashOperationPayload(authority),
    beforeReceipt: async tx => { order = await lockOrder(tx, authority.orderId); },
    run: async () => {
      if (!['draft', 'pending_payment', 'paid'].includes(order.status) || order.hasJob ||
          order.deliveryHoldReason !== null || order.manualReviewRequired) engineSiteFail('engine_authority_registration_refused');
      return authority;
    },
    validateReplay: async tx => { await requireAuthority(tx, authority); },
  }, deps);
}

const add = (left: number, right: number) => {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) engineSiteFail('engine_meter_overflow');
  return sum;
};

async function snapshot(tx: Tx, authority: EngineOrderAuthority, excludeClaimKey?: string) {
  await requireAuthority(tx, authority);
  const rows = await tx.atomicOperationReceipt.findMany({
    where: { orderId: authority.orderId, kind: { in: [KINDS.claim, KINDS.result] } },
    select: { operationKey: true, kind: true, payloadHash: true, result: true },
  });
  const claims = new Map<string, z.infer<typeof claimSchema>>(), results = new Map<string, EngineCallResult>();
  const digest = authorityDigest(authority);
  for (const row of rows) {
    // runAtomicOperation owns an unfilled receipt for the CURRENT fresh operation inside this transaction.
    if (row.operationKey === excludeClaimKey) continue;
    if (row.kind === KINDS.claim) {
      const claim = unwrap(claimSchema, row.result);
      const call = callSchema.parse({ step: claim.step, wireSha256: claim.wireSha256, maximumMicroUsd: claim.maximumMicroUsd });
      const slot = authority.budget.steps.find(step => step.id === call.step);
      if (row.operationKey !== callKey(authority.orderId, claim.step, 'claim') || claim.authoritySha256 !== digest ||
          row.payloadHash !== hashOperationPayload({ authoritySha256: digest, ...call }) ||
          !slot || call.maximumMicroUsd !== slot.maximumMicroUsd || claims.has(claim.step)) engineSiteFail('engine_claim_corrupt');
      claims.set(claim.step, claim);
    } else {
      const result = unwrap(resultSchema, row.result);
      if (row.operationKey !== callKey(authority.orderId, result.step, 'result') || result.authoritySha256 !== digest ||
          row.payloadHash !== hashOperationPayload(result) || results.has(result.step)) engineSiteFail('engine_result_corrupt');
      results.set(result.step, result);
    }
  }
  if ([...results.values()].some(result => claims.get(result.step)?.wireSha256 !== result.wireSha256)) {
    engineSiteFail('engine_result_without_claim');
  }
  let accountedMicroUsd = 0, knownEstimateMicroUsd = 0, pendingCalls = 0, unknownCalls = 0, failedCalls = 0, overReservedCalls = 0;
  for (const claim of claims.values()) {
    const result = results.get(claim.step);
    if (!result) { accountedMicroUsd = add(accountedMicroUsd, claim.maximumMicroUsd); pendingCalls++; continue; }
    if (result.estimatedMicroUsd === null) {
      accountedMicroUsd = add(accountedMicroUsd, claim.maximumMicroUsd); unknownCalls++;
    } else {
      accountedMicroUsd = add(accountedMicroUsd, result.estimatedMicroUsd);
      knownEstimateMicroUsd = add(knownEstimateMicroUsd, result.estimatedMicroUsd);
      if (result.estimatedMicroUsd > claim.maximumMicroUsd) overReservedCalls++;
    }
    if (!result.completed) failedCalls++;
  }
  const blocked = pendingCalls > 0 || unknownCalls > 0 || failedCalls > 0 || overReservedCalls > 0 ||
    accountedMicroUsd > authority.budget.maximumMicroUsd || claims.size > authority.budget.maximumCalls;
  return { accountedMicroUsd, knownEstimateMicroUsd, pendingCalls, unknownCalls, failedCalls, overReservedCalls,
    logicalCalls: claims.size, blocked, kind: 'estimate_not_invoice' as const };
}

/** All inspection remains order-scoped and under the same lock as reservations. */
export async function inspectEngineOrderMeter(db: PrismaClient, input: EngineOrderAuthority) {
  const authority = engineOrderAuthoritySchema.parse(input);
  return db.$transaction(async tx => { await lockOrder(tx, authority.orderId); return snapshot(tx, authority); });
}

/**
 * Only dispatch when dispatchGranted=true, once, AFTER this promise resolves. Never auto-retry the
 * provider. A new invocation has a fresh nonce, so replaying a committed claim cannot dispatch twice.
 * Pooler retries WITHIN runAtomicOperation replay the same nonce before any provider call occurs.
 */
export async function reserveEngineCall(db: PrismaClient, input: {
  authority: EngineOrderAuthority; call: EngineCall;
}, deps?: AtomicOperationDeps) {
  const authority = engineOrderAuthoritySchema.parse(input.authority), call = callSchema.parse(input.call);
  const digest = authorityDigest(authority), invocationId = randomUUID();
  const slot = authority.budget.steps.find(step => step.id === call.step);
  // A caller cannot lower a claim below the approved worst-case reserve to squeeze in more calls.
  if (!slot || call.maximumMicroUsd !== slot.maximumMicroUsd) engineSiteFail('engine_step_not_authorized');
  const key = callKey(authority.orderId, call.step, 'claim');
  const claim = await runAtomicOperation(db, {
    operationKey: key, orderId: authority.orderId, kind: KINDS.claim,
    payloadHash: hashOperationPayload({ authoritySha256: digest, ...call }),
    beforeReceipt: async tx => { assertDispatchable(await lockOrder(tx, authority.orderId)); await requireAuthority(tx, authority); },
    run: async tx => {
      const state = await snapshot(tx, authority, key);
      if (state.blocked) engineSiteFail('engine_previous_call_unresolved_or_failed');
      if (state.logicalCalls >= authority.budget.maximumCalls ||
          add(state.accountedMicroUsd, call.maximumMicroUsd) > authority.budget.maximumMicroUsd) engineSiteFail('engine_budget_exhausted');
      return claimSchema.parse({ ...call, authoritySha256: digest, invocationId });
    },
    validateReplay: async (_tx, recorded) => { claimSchema.parse(recorded); },
  }, deps);
  return { dispatchGranted: claim.invocationId === invocationId, claim };
}

/**
 * Always record returned usage, including above-reserve cost and failures. Settlement is allowed
 * after cancellation/hold; otherwise a late billed answer would disappear. Null keeps the FULL
 * reserve and blocks further calls. Cost derives from the adapter's raw receipt, never browser input.
 */
export async function settleEngineCall(db: PrismaClient, input: {
  authority: EngineOrderAuthority;
  step: string; wireSha256: string; receiptSha256: string; completed: boolean; estimatedMicroUsd: number | null;
}, deps?: AtomicOperationDeps) {
  const authority = engineOrderAuthoritySchema.parse(input.authority);
  const result = resultSchema.parse({ step: input.step, wireSha256: input.wireSha256,
    authoritySha256: authorityDigest(authority), receiptSha256: input.receiptSha256,
    completed: input.completed, estimatedMicroUsd: input.estimatedMicroUsd });
  return runAtomicOperation(db, {
    operationKey: callKey(authority.orderId, result.step, 'result'), orderId: authority.orderId, kind: KINDS.result,
    payloadHash: hashOperationPayload(result),
    beforeReceipt: async tx => { await lockOrder(tx, authority.orderId); await requireAuthority(tx, authority); },
    run: async tx => {
      const row = await tx.atomicOperationReceipt.findUnique({ where: { operationKey: callKey(authority.orderId, result.step, 'claim') },
        select: { kind: true, payloadHash: true, result: true } });
      if (!row || row.kind !== KINDS.claim) engineSiteFail('engine_result_without_claim');
      const claim = unwrap(claimSchema, row.result);
      const call = { step: claim.step, wireSha256: claim.wireSha256, maximumMicroUsd: claim.maximumMicroUsd };
      if (claim.authoritySha256 !== result.authoritySha256 || claim.wireSha256 !== result.wireSha256 ||
          row.payloadHash !== hashOperationPayload({ authoritySha256: claim.authoritySha256, ...call })) engineSiteFail('engine_result_binding');
      return result;
    },
    validateReplay: async (_tx, recorded) => { resultSchema.parse(recorded); },
  }, deps);
}
