import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { lockEngineOrder } from './order-meter';
import { lockOrderForExceptionCase,openExceptionCase } from '@/lib/generation-chunked/exception-case';

export const ENGINE_INFRA_SCOPE = 'engine_site_infrastructure';
/** Caller already owns the Order fence. This is a manual case, never an automatic refund/redrive. */
export async function openEngineInfrastructureCase(tx: Prisma.TransactionClient, orderId:string, domain:string, code:string) {
  const lock=await lockOrderForExceptionCase(tx,orderId);if(!lock)throw Error('engine_order_missing');
  const row=await openExceptionCase(tx,{orderId,scope:ENGINE_INFRA_SCOPE,kind:'infra_transient',reason:code,
    initialStatus:'open',nextActionAt:null,metadata:{domain,operatorRequired:true},fenceExisting:true},lock);
  if(row.actionAttemptedAt||!['open','retry_scheduled'].includes(row.status))throw Error('engine_operator_case_conflict');
  await tx.exceptionCase.update({where:{id:row.id},data:{status:'open',nextActionAt:null,leaseExpiresAt:null,
    resolution:{operatorRequired:true,outcome:'infrastructure_hold',domain,code}}});
}

export const ENGINE_INFRA_MAX_FAILURES = 3;
export const ENGINE_INFRA_BACKOFF_MS = [30_000, 120_000, 600_000] as const;
export function engineErrorCode(error: unknown) {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  const value = typeof code === 'string' ? code : error instanceof Error ? error.message : '';
  return /^engine_[a-z_]+$/.test(value) ? value : 'engine_infrastructure_unavailable';
}
export function engineOwnershipLost(error: unknown) {
  return ['engine_worker_order_ineligible', 'engine_worker_lease_lost', 'engine_worker_checkpoint_changed',
    'engine_worker_cancelled', 'engine_order_not_dispatchable'].includes(engineErrorCode(error));
}
/** An explicit allowlist: unknown exceptions and transport outcomes can never authorize a refund. */
export function engineDeterministicFailure(error: unknown) {
  const code = engineErrorCode(error);
  return /^(engine_readmission_|engine_saved_|engine_final_|engine_claim_corrupt$|engine_result_corrupt$)/.test(code) ||
    ['engine_private_bytes_changed', 'engine_reader_order_changed', 'engine_reader_manifest_binding',
      'engine_budget_exhausted', 'engine_native_review_reask_limit', 'engine_runtime_policy_changed',
      'engine_runtime_revision_mismatch', 'engine_worker_input_changed', 'engine_worker_call_changed',
      'engine_worker_wire_changed', 'engine_worker_output_changed', 'engine_worker_result_changed',
      'engine_worker_saved_result_invalid', 'engine_worker_provider_result_unusable', 'engine_worker_saved_result_unusable',
      'engine_native_book_held', 'engine_child_style_held', 'engine_reference_sheet_held',
      'engine_operator_rejected', 'engine_automatic_acceptance_held','engine_narration_media_invalid'].includes(code);
}
export const engineRecoveryKey = (orderId: string, domain: string) => `engine-site-recovery/v1/${orderId}/${domain}`;
export async function engineRecoveryDue(db: Pick<Prisma.TransactionClient, 'wizardSession'>, orderId: string, domain: string, now = Date.now()) {
  const row = await db.wizardSession.findUnique({ where: { sessionId: engineRecoveryKey(orderId, domain) } });
  const data = row?.data as { attempts?: number; nextAt?: number } | undefined;
  return !data || (data.attempts ?? 0) < ENGINE_INFRA_MAX_FAILURES && (data.nextAt ?? 0) <= now;
}
export async function clearEngineInfrastructureFault(db: Pick<Prisma.TransactionClient, 'wizardSession'>, orderId: string, domain: string) {
  const sessionId=engineRecoveryKey(orderId,domain), row=await db.wizardSession.findUnique({where:{sessionId}});
  const data=row?.data as { attempts?: number } | undefined;
  if (data && (data.attempts ?? 0)>0 && (data.attempts ?? 0)<ENGINE_INFRA_MAX_FAILURES)
    await db.wizardSession.update({where:{sessionId},data:{data:{...data,attempts:0,nextAt:0,recoveredAt:new Date().toISOString()}}});
}
/** Bounded free retries, then a durable operator hold. This never creates a refund liability. */
export async function recordEngineInfrastructureFault(db: PrismaClient, orderId: string, domain: string, error: unknown, now = Date.now()) {
  return db.$transaction(async tx => {
    const order = await lockEngineOrder(tx, orderId);
    const job = await tx.generationJob.findUnique({ where: { orderId } });
    if (job?.lockedBy && job.leaseExpiresAt && job.leaseExpiresAt.getTime() > now) return { status: 'busy' as const };
    if(await tx.deliveryOutbox.findFirst({where:{orderId,scope:'engine_site_book',status:'processing',sendAttempted:true}}))return {status:'busy' as const};
    if (order.status === 'failed' || order.deliveryHoldReason && !['engine_site_hold:operator_review', 'engine_site_hold:infrastructure'].includes(order.deliveryHoldReason))
      return { status: 'operator_reconciliation_required' as const };
    const sessionId = engineRecoveryKey(orderId, domain), prior = await tx.wizardSession.findUnique({ where: { sessionId } });
    const data = prior?.data as { attempts?: number; nextAt?: number } | undefined;
    if (data && (data.nextAt ?? 0) > now && (data.attempts ?? 0) < ENGINE_INFRA_MAX_FAILURES) return { status: 'retry_scheduled' as const };
    const attempts = Math.min(ENGINE_INFRA_MAX_FAILURES, (data?.attempts ?? 0) + 1), parked = attempts === ENGINE_INFRA_MAX_FAILURES;
    const state = { version: 'engine-site-infrastructure-recovery/v1', orderId, domain, attempts,
      nextAt: now + ENGINE_INFRA_BACKOFF_MS[attempts - 1], code: engineErrorCode(error), recordedAt: new Date(now).toISOString() };
    await tx.wizardSession.upsert({ where: { sessionId }, create: { sessionId, data: state }, update: { data: state } });
    if (parked) {
      await tx.order.update({ where: { id: orderId }, data: { status: 'needs_human_qa', manualReviewRequired: true,
        deliveryHoldReason: 'engine_site_hold:infrastructure', lastError: state.code, deliveryFenceVersion: { increment: 1 } } });
      await tx.generationJob.updateMany({ where: { orderId }, data: { currentStage: 'engine_site_operator', retryable: false, lastError: state.code } });
      await tx.bookReadiness.updateMany({ where: { orderId, scope: 'engine_site_book' }, data: { status: 'blocked', reason: 'engine_infrastructure_operator_required' } });
      await openEngineInfrastructureCase(tx,orderId,domain,state.code);
    }
    return { status: parked ? 'operator_reconciliation_required' as const : 'retry_scheduled' as const };
  });
}
