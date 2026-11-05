import 'server-only';
import type { PrismaClient, Prisma } from '@prisma/client';
import { parseEngineCheckpoint } from './durable-worker';
import { assertEnginePolicyCurrent, configuredEngineSpendPolicy } from './platform-policy';
import { engineErrorCode, engineDeterministicFailure, recordEngineInfrastructureFault, clearEngineInfrastructureFault } from './failure-policy';
import { lockEngineOrder } from './order-meter';
import { failEngineOrder } from './fulfillment';
import { createLogger } from '@/lib/logger';
import { ENGINE_ORDER_DEADLINE_MS, ENGINE_ORDER_ABSOLUTE_DEADLINE_MS } from './execution-deadlines';
export { ENGINE_ORDER_DEADLINE_MS, ENGINE_ORDER_ABSOLUTE_DEADLINE_MS } from './execution-deadlines';
const logger=createLogger({subsystem:'engine-site-backstop'});

/** An abandoned paid generation cannot wait forever. This is an execution deadline, never a quality downgrade. */
/** Free, Order-first recovery. Active leases and publication/operator stages are never commandeered. */
export async function reconcileEngineGeneration(db: PrismaClient, orderId: string, now = new Date(), executorRevision?: string) {
  try { configuredEngineSpendPolicy(); }
  catch(error) { const code=engineErrorCode(error);logger.warn('Engine executor configuration unavailable; order untouched',{orderId,code});return {status:'executor_unavailable' as const,code}; }
  const outcome = await db.$transaction(async tx => {
    const order = await lockEngineOrder(tx, orderId);
    const rows = await tx.$queryRaw<Array<{ orderId: string }>>`SELECT "orderId" FROM "GenerationJob" WHERE "orderId"=${orderId} FOR UPDATE`;
    if (!rows.length) return { status: 'ineligible' as const };
    const job = await tx.generationJob.findUnique({ where: { orderId } });
    if (!job || !['pending','running'].includes(job.status) || !['paid','generating'].includes(order.status) || order.deliveryHoldReason !== null ||
      order.manualReviewRequired || ['done','failed','engine_site_accept','engine_site_review','engine_site_operator','engine_site_terminal'].includes(job.currentStage))
      return { status: 'ineligible' as const };
    if (job.lockedBy && job.leaseExpiresAt && job.leaseExpiresAt > now) return { status: 'busy' as const };
    const checkpoint = parseEngineCheckpoint(job.pipelineCache);
    // A long host is not deployment authority for orders belonging to another source revision.
    if(executorRevision && checkpoint.authority.sourceRevision!==executorRevision) return {status:'foreign_revision' as const};
    const createdAt=job.createdAt.getTime(), progressAt=Math.max(createdAt,Math.min(checkpoint.progressAt??createdAt,now.getTime()));
    let reason: string | null = now.getTime()-createdAt >= ENGINE_ORDER_ABSOLUTE_DEADLINE_MS ||
      now.getTime()-progressAt >= ENGINE_ORDER_DEADLINE_MS ? 'engine_generation_deadline' : null;
    if (!reason) {
      try { assertEnginePolicyCurrent(checkpoint.authority); }
      catch (error) { if (engineDeterministicFailure(error)) reason = engineErrorCode(error); else throw error; }
    }
    if (reason) {
      checkpoint.phase = 'held';
      await tx.order.update({ where: { id: orderId }, data: { status: 'needs_human_qa', manualReviewRequired: true, deliveryHoldReason: 'engine_site_hold:worker_failed', lastError: reason } });
      await tx.generationJob.update({ where: { orderId }, data: { status: 'failed', currentStage: 'failed', lockedBy: null, leaseExpiresAt: null,
        retryable: false, failedAt: now, lastError: reason, pipelineCache: { engineSite: checkpoint } as unknown as Prisma.InputJsonValue } });
      return { status: 'terminal' as const, reason };
    }
    await clearEngineInfrastructureFault(tx,orderId,'backstop');
    if (checkpoint.recovery && checkpoint.recovery.nextAt > now.getTime()) return { status: 'retry_scheduled' as const };
    return { status: job.currentStage === 'engine_site_long' ? 'long' as const : 'dispatch' as const };
  }).catch(async error => recordEngineInfrastructureFault(db, orderId, 'backstop', error, now.getTime()));
  if (outcome.status === 'terminal') {
    await failEngineOrder(db, orderId, outcome.reason); return { status: 'failed' as const };
  }
  return outcome;
}
