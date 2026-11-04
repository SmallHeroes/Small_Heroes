import 'server-only';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';
import { authorityDigest, engineOrderAuthoritySchema, engineSiteFail, type EngineOrderAuthority } from './contract';
import { inspectEngineOrderMeter, readEngineCallResult, reserveEngineCall, settleEngineCall, type EngineCall } from './order-meter';
import { loadEnginePrivateAsset, persistEnginePrivateAsset, readEnginePrivateBytes } from './private-assets';
import type { EnginePrivateStorage } from './private-storage';
import { ENGINE_INFRA_MAX_FAILURES, ENGINE_INFRA_BACKOFF_MS, engineDeterministicFailure, engineErrorCode, engineOwnershipLost } from './failure-policy';

export const ENGINE_CHUNK_BUDGET_MS = 270_000;
export const ENGINE_LONG_BUDGET_MS = 25 * 60_000;
const MARGIN_MS = 45_000;
const checkpointSchema = z.object({
  version: z.literal('engine-site-job/v1'), authority: engineOrderAuthoritySchema,
  ownerId: z.string().min(1), draftId: z.string().min(1), snapshotSha256: z.string().length(64),
  phase: z.enum(['story', 'native', 'materialize', 'accept', 'held', 'operator', 'done']),
  recovery: z.object({ failures: z.number().int().nonnegative(), nextAt: z.number().int().nonnegative() }).strict().optional(),
  calls: z.record(z.object({ wireSha256: z.string().length(64), requestAssetId: z.string().uuid(),
    pendingId: z.string().optional(), deadlineAt: z.number().int().positive(), polls: z.number().int().nonnegative(),
    resultAssetId: z.string().uuid().optional(), settled: z.boolean() }).strict()),
  outputs: z.record(z.string().uuid()), waiting: z.object({ step: z.string(), requiredMs: z.number() }).strict().nullable(),
}).strict();
export type EngineCheckpoint = z.infer<typeof checkpointSchema>;
export type EngineProviderResult = { output: unknown; raw: unknown; estimatedMicroUsd: number | null;
  usage?: { inputTokens: number; outputTokens: number }; model?: string; usable?: boolean };
export type PreparedEngineCall = { call: EngineCall; wire: unknown; requiredMs: number;
  admitSaved?: (result: EngineProviderResult) => void | Promise<void>;
  completionDeadlineMs?: number;
  execute: (pendingId: string | undefined, signal: AbortSignal, assertDispatch: () => Promise<void>) => Promise<
    { kind: 'pending'; id: string; raw: unknown } | { kind: 'completed'; result: EngineProviderResult }>;
  revalidate?: () => void };
export type EngineRuntime = {
  call(plan: PreparedEngineCall): Promise<EngineProviderResult>;
  load(name: string): Promise<unknown | null>;
  result(step: string): Promise<EngineProviderResult>;
  save(name: string, output: unknown): Promise<void>;
  advance(phase: EngineCheckpoint['phase']): Promise<void>;
  check(): void; signal: AbortSignal; checkpoint: EngineCheckpoint;
};
export type EngineRecipe = (runtime: EngineRuntime) => Promise<void>;
const valueHash = (input: unknown) => canonicalHash(input);
function parseCache(cache: unknown): EngineCheckpoint {
  return checkpointSchema.parse(z.object({ engineSite: checkpointSchema }).passthrough().parse(cache).engineSite);
}
export { parseCache as parseEngineCheckpoint };

/** Order-first fence is shared with meter/refund/delivery. All writes check both nonce and unexpired lease. */
export async function engineLeaseWrite(db: PrismaClient, orderId: string, workerId: string,
  work: (tx: Prisma.TransactionClient) => Promise<void>, now = new Date()) {
  return db.$transaction(async tx => {
    const orders = await tx.$queryRaw<Array<{ status: string; deliveryHoldReason: string | null }>>`
      SELECT "status"::text AS status, "deliveryHoldReason" FROM "Order" WHERE id=${orderId} FOR UPDATE`;
    if (orders.length !== 1 || !['paid', 'generating'].includes(orders[0].status) || orders[0].deliveryHoldReason !== null)
      engineSiteFail('engine_worker_order_ineligible');
    const jobs = await tx.$queryRaw<Array<{ lockedBy: string | null; leaseExpiresAt: Date | null }>>`
      SELECT "lockedBy", "leaseExpiresAt" FROM "GenerationJob" WHERE "orderId"=${orderId} FOR UPDATE`;
    if (jobs.length !== 1 || jobs[0].lockedBy !== workerId || !jobs[0].leaseExpiresAt ||
        new Date(jobs[0].leaseExpiresAt).getTime() <= now.getTime()) engineSiteFail('engine_worker_lease_lost');
    await work(tx);
  });
}

/** One job, two invocation envelopes. A stale/ambiguous call is never dispatched again. */
export async function runEngineDurableInvocation(db: PrismaClient, orderId: string, options: {
  executor: 'chunk' | 'long'; storage: EnginePrivateStorage; recipe: EngineRecipe;
  assertAdmission: (authority: EngineOrderAuthority) => Promise<void>; signal?: AbortSignal; now?: () => number;
}) {
  const now = options.now ?? Date.now, start = now(), maximumMs = options.executor === 'long' ? ENGINE_LONG_BUDGET_MS : ENGINE_CHUNK_BUDGET_MS;
  const workerId = randomUUID(), expiry = new Date(start + maximumMs + 120_000);
  const initial = await db.generationJob.findUnique({ where: { orderId } });
  if (!initial) engineSiteFail('engine_worker_job_missing');
  const checkpoint = parseCache(initial.pipelineCache), authority = checkpoint.authority;
  if (authority.orderId !== orderId) engineSiteFail('engine_worker_authority_mismatch');
  if (options.executor === 'chunk' && checkpoint.waiting && checkpoint.waiting.requiredMs > ENGINE_CHUNK_BUDGET_MS)
    return { kind: 'long_step_required' as const, step: checkpoint.waiting.step };
  // Order first, then job: review/publication and terminal actions share this same fence.
  const claimed = await db.$transaction(async tx => {
    const orders = await tx.$queryRaw<Array<{ status: string; deliveryHoldReason: string | null; manualReviewRequired: boolean }>>`
      SELECT status::text AS status, "deliveryHoldReason", "manualReviewRequired" FROM "Order" WHERE id=${orderId} FOR UPDATE`;
    if (orders.length !== 1 || !['paid', 'generating'].includes(orders[0].status) || orders[0].deliveryHoldReason !== null || orders[0].manualReviewRequired)
      return { count: 0 };
    if (checkpoint.recovery && checkpoint.recovery.nextAt > start) return { count: 0 };
    return tx.generationJob.updateMany({ where: { orderId, status: { in: ['pending', 'running'] },
      currentStage: { notIn: ['done', 'failed', 'engine_site_accept', 'engine_site_review', 'engine_site_operator', 'engine_site_terminal'] },
      OR: [{ lockedBy: null }, { leaseExpiresAt: { lt: new Date(start) } }] },
      data: { lockedBy: workerId, leaseExpiresAt: expiry, status: 'running', startedAt: new Date(start) } });
  });
  if (claimed.count !== 1) return { kind: 'busy' as const };
  try {
    const freshJob = await db.generationJob.findUnique({ where: { orderId } });
    const freshCheckpoint = parseCache(freshJob?.pipelineCache);
    if (authorityDigest(freshCheckpoint.authority) !== authorityDigest(authority)) engineSiteFail('engine_worker_authority_mismatch');
    Object.assign(checkpoint, freshCheckpoint);
  } catch (error) {
    await db.generationJob.updateMany({ where: { orderId, lockedBy: workerId }, data: { lockedBy: null, leaseExpiresAt: new Date(now()) } });
    throw error;
  }
  let pause: 'chunk' | 'long' | 'pending' | null = null, freshCalls = 0, heartbeatFailure = false;
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const yielded = Object.assign(Error('engine_worker_yield'), { code: 'audition_cancelled' });
  const check = () => { if (pause) throw yielded; if (signal.aborted || heartbeatFailure) engineSiteFail('engine_worker_cancelled'); };
  const fence = async () => {
    check(); await options.assertAdmission(authority);
    await engineLeaseWrite(db, orderId, workerId, async () => {}, new Date(now())); check();
  };
  const persist = async () => engineLeaseWrite(db, orderId, workerId, async tx => {
    await tx.generationJob.update({ where: { orderId }, data: { pipelineCache: { engineSite: checkpoint } as unknown as Prisma.InputJsonValue,
      currentStage: checkpoint.waiting ? 'engine_site_long' : `engine_site_${checkpoint.phase}` } });
  }, new Date(now()));
  const privateJson = async (value: unknown) => {
    await fence();
    const asset = await persistEnginePrivateAsset(db, options.storage, { ownerId: checkpoint.ownerId, draftId: checkpoint.draftId,
      orderId, kind: 'receipt', contentType: 'application/json' }, Buffer.from(JSON.stringify(value), 'utf8'));
    await fence(); return asset.assetId;
  };
  const readJson = async (id: string) => {
    const asset = await loadEnginePrivateAsset(db, id);
    if (asset.orderId !== orderId || asset.ownerId !== checkpoint.ownerId || asset.kind !== 'receipt') engineSiteFail('engine_worker_asset_mismatch');
    return JSON.parse((await readEnginePrivateBytes(options.storage, asset)).toString('utf8'));
  };
  // Heartbeat is fenced; loss aborts the provider signal. The lease is longer than the entire invocation even if timers stall.
  let heartbeatInFlight = false;
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight) return; heartbeatInFlight = true;
    void engineLeaseWrite(db, orderId, workerId, async tx => {
      await tx.generationJob.update({ where: { orderId }, data: { leaseExpiresAt: new Date(now() + maximumMs + 120_000) } });
    }, new Date(now())).catch(() => { heartbeatFailure = true; controller.abort(); }).finally(() => { heartbeatInFlight = false; });
  }, 20_000);
  const runtime: EngineRuntime = {
    check, signal, checkpoint,
    async load(name) { await fence(); return checkpoint.outputs[name] ? readJson(checkpoint.outputs[name]) : null; },
    async result(step) {
      await fence();
      const recorded = await readEngineCallResult(db, authority, step);
      if (!recorded?.completed || !recorded.privateResultAssetId || recorded.estimatedMicroUsd === null) engineSiteFail('engine_worker_result_unavailable');
      const saved = await readJson(recorded.privateResultAssetId);
      if (valueHash(saved) !== recorded.receiptSha256 || saved.wireSha256 !== recorded.wireSha256 || !saved.completed)
        engineSiteFail('engine_worker_result_changed');
      return saved.result as EngineProviderResult;
    },
    async save(name, value) {
      check(); if (checkpoint.outputs[name]) {
        if (valueHash(await readJson(checkpoint.outputs[name])) !== valueHash(value)) engineSiteFail('engine_worker_output_changed'); return;
      }
      checkpoint.outputs[name] = await privateJson(value); await persist();
    },
    async advance(phase) { check(); checkpoint.phase = phase; checkpoint.waiting = null; await persist(); },
    async call(plan) {
      await fence(); plan.revalidate?.();
      const { step, wireSha256 } = plan.call;
      if (valueHash(plan.wire) !== wireSha256) engineSiteFail('engine_worker_wire_changed');
      const prior = checkpoint.calls[step];
      if (prior && prior.wireSha256 !== wireSha256) engineSiteFail('engine_worker_call_changed');
      const settlement = prior ? await readEngineCallResult(db, authority, step) : null;
      if (prior && settlement?.privateResultAssetId && !prior.resultAssetId) prior.resultAssetId = settlement.privateResultAssetId;
      if (prior?.resultAssetId) {
        const saved = await readJson(prior.resultAssetId);
        if (saved.wireSha256 !== wireSha256 || typeof saved.completed !== 'boolean') engineSiteFail('engine_worker_saved_result_invalid');
        await settleEngineCall(db, { authority, step, wireSha256, completed: saved.completed,
          estimatedMicroUsd: saved.result.estimatedMicroUsd, receiptSha256: valueHash(saved), privateResultAssetId: prior.resultAssetId });
        if (!prior.settled) { prior.settled = true; await persist(); }
        if (saved.result.estimatedMicroUsd === null) engineSiteFail('engine_worker_provider_cost_unknown');
        if (!saved.completed) engineSiteFail('engine_worker_saved_result_unusable');
        await plan.admitSaved?.(saved.result);
        return saved.result as EngineProviderResult;
      }
      if (prior && !prior.pendingId) engineSiteFail('engine_worker_dispatch_outcome_unknown');
      if (prior && now() >= prior.deadlineAt) engineSiteFail('engine_worker_pending_deadline');
      const remaining = maximumMs - (now() - start);
      if (!prior && (freshCalls > 0 || remaining < plan.requiredMs + MARGIN_MS)) {
        if (plan.requiredMs + MARGIN_MS > maximumMs && options.executor === 'long') engineSiteFail('engine_worker_step_exceeds_long_executor');
        checkpoint.waiting = plan.requiredMs + MARGIN_MS > ENGINE_CHUNK_BUDGET_MS ? { step, requiredMs: plan.requiredMs + MARGIN_MS } : null;
        await persist(); pause = checkpoint.waiting ? 'long' : 'chunk'; throw yielded;
      }
      if (!prior) {
        const requestAssetId = await privateJson({ authoritySha256: authorityDigest(authority), call: plan.call, wire: plan.wire });
        const grant = await reserveEngineCall(db, { authority, call: plan.call });
        if (!grant.dispatchGranted) engineSiteFail('engine_worker_dispatch_already_claimed');
        checkpoint.calls[step] = { wireSha256, requestAssetId, settled: false, polls: 0,
          deadlineAt: now() + (plan.completionDeadlineMs ?? plan.requiredMs) + MARGIN_MS }; checkpoint.waiting = null;
        await persist();
      } else {
        const request = await readJson(prior.requestAssetId);
        if (request.authoritySha256 !== authorityDigest(authority) || valueHash(request.wire) !== wireSha256 || valueHash(request.call) !== valueHash(plan.call))
          engineSiteFail('engine_worker_pending_request_changed');
      }
      await fence(); plan.revalidate?.(); freshCalls += 1;
      let answer: Awaited<ReturnType<PreparedEngineCall['execute']>>;
      try { answer = await plan.execute(prior?.pendingId, AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, remaining - MARGIN_MS))]), fence); }
      catch { engineSiteFail('engine_worker_provider_outcome_unknown'); }
      if (answer.kind === 'pending') {
        await fence();
        if (!answer.id || (prior?.pendingId && prior.pendingId !== answer.id)) engineSiteFail('engine_worker_pending_id_changed');
        checkpoint.calls[step].pendingId = answer.id; checkpoint.calls[step].polls += 1;
        await persist(); pause = 'pending'; throw yielded;
      }
      const completed = answer.result.usable !== false;
      const saved = { wireSha256, completed, result: answer.result };
      // Late billed answers settle even after a cancellation/lease loss. They never commit job progress without the fence.
      let privateResultAssetId: string;
      try {
        privateResultAssetId = (await persistEnginePrivateAsset(db, options.storage, {
          ownerId: checkpoint.ownerId, draftId: checkpoint.draftId, orderId, kind: 'receipt', contentType: 'application/json',
        }, Buffer.from(JSON.stringify(saved), 'utf8'))).assetId;
      } catch {
        await settleEngineCall(db, { authority, step, wireSha256, completed: false,
          estimatedMicroUsd: answer.result.estimatedMicroUsd, receiptSha256: valueHash(saved) });
        engineSiteFail('engine_worker_private_result_persistence_failed');
      }
      await settleEngineCall(db, { authority, step, wireSha256, completed,
        estimatedMicroUsd: answer.result.estimatedMicroUsd, receiptSha256: valueHash(saved), privateResultAssetId });
      await fence();
      checkpoint.calls[step].resultAssetId = privateResultAssetId;
      checkpoint.calls[step].settled = true; await persist();
      if (answer.result.estimatedMicroUsd === null) engineSiteFail('engine_worker_provider_cost_unknown');
      if (!completed) engineSiteFail('engine_worker_provider_result_unusable');
      const meter = await inspectEngineOrderMeter(db, authority);
      if (meter.blocked) engineSiteFail('engine_worker_meter_blocked');
      return answer.result;
    },
  };
  try {
    await fence();
    const current = await db.generationJob.findUnique({ where: { orderId } });
    if (!current || valueHash(parseCache(current.pipelineCache)) !== valueHash(checkpoint)) engineSiteFail('engine_worker_checkpoint_changed');
    await options.recipe(runtime); check();
    if (checkpoint.recovery) { delete checkpoint.recovery; await persist(); }
    return { kind: 'progress' as const, phase: checkpoint.phase };
  } catch (error) {
    if (pause) return { kind: pause === 'long' ? 'long_step_required' as const : pause === 'pending' ? 'pending' as const : 'progress' as const,
      phase: checkpoint.phase, step: checkpoint.waiting?.step };
    const code = engineErrorCode(error);
    if (engineOwnershipLost(error) || heartbeatFailure) return { kind: 'held' as const, code, terminalWritten: false };
    const terminal = engineDeterministicFailure(error);
    let terminalWritten = false;
    await engineLeaseWrite(db, orderId, workerId, async tx => {
      // An ambiguous paid call cannot be retried. Retain its reserve and park for an operator.
      const unknownCall = Object.values(checkpoint.calls).some(c => !c.settled && !c.pendingId) || code === 'engine_worker_pending_deadline';
      const failures = (checkpoint.recovery?.failures ?? 0) + 1;
      const operator = !terminal && (unknownCall || failures >= ENGINE_INFRA_MAX_FAILURES);
      checkpoint.recovery = { failures, nextAt: now() + ENGINE_INFRA_BACKOFF_MS[Math.min(failures, ENGINE_INFRA_MAX_FAILURES) - 1] };
      if (terminal || operator) {
        await tx.order.update({ where: { id: orderId }, data: { status: 'needs_human_qa', manualReviewRequired: true,
          deliveryHoldReason: terminal ? 'engine_site_hold:worker_failed' : 'engine_site_hold:infrastructure', lastError: code } });
        checkpoint.phase = terminal ? 'held' : 'operator';
      }
      await tx.generationJob.update({ where: { orderId }, data: { status: terminal ? 'failed' : 'running',
        currentStage: terminal ? 'failed' : operator ? 'engine_site_operator' : checkpoint.waiting ? 'engine_site_long' : `engine_site_${checkpoint.phase}`,
        failedAt: terminal ? new Date(now()) : null, retryable: !terminal && !operator, lastError: code,
        pipelineCache: { engineSite: checkpoint } as unknown as Prisma.InputJsonValue } });
      terminalWritten = terminal;
    }, new Date(now())).catch(() => {});
    return { kind: 'held' as const, code, terminalWritten };
  } finally {
    clearInterval(heartbeat); controller.abort();
    await db.generationJob.updateMany({ where: { orderId, lockedBy: workerId },
      data: { lockedBy: null, leaseExpiresAt: new Date(now()) } });
  }
}
