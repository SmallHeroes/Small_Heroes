import 'server-only';
import type { Prisma,PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { canonicalHash } from '@/lib/canonical-json';
import { runAtomicOperation,hashOperationPayload } from '@/lib/generation-pipeline/atomic-operation';
import { identifierSchema,digestSchema,engineOrderAuthoritySchema,engineSiteFail } from './contract';
import { lockEngineOrder,inspectEngineOrderMeter } from './order-meter';
import { parseEngineCheckpoint } from './durable-worker';
import { assertEnginePrivateDatabase } from './private-assets';
import { ENGINE_INFRA_SCOPE } from './failure-policy';
import { assertEnginePolicyCurrent } from './platform-policy';
import { failEngineOrder } from './fulfillment';

export const infrastructureActionSchema=z.object({action:z.enum(['resume','fail']),expectedHoldSha256:digestSchema,
  idempotencyKey:identifierSchema,reason:z.string().trim().min(1).max(500)}).strict();
type Tx=Prisma.TransactionClient;
async function state(tx:Tx,orderId:string) {
  const order=await tx.order.findUnique({where:{id:orderId}}),job=await tx.generationJob.findUnique({where:{orderId}});
  if(!order||order.frozenProductVersion!=='engine-site/v1')engineSiteFail('engine_operator_order_required');
  const checkpoint=job?parseEngineCheckpoint(job.pipelineCache):null;
  const exception=await tx.exceptionCase.findUnique({where:{activeKey:`${orderId}:${ENGINE_INFRA_SCOPE}`}});
  const receipts=await tx.atomicOperationReceipt.findMany({where:{orderId,kind:{in:['engine_site_call_claim_v1','engine_site_call_result_v1']}}});
  const recoveries=await tx.wizardSession.findMany({where:{sessionId:{startsWith:`engine-site-recovery/v1/${orderId}/`}}});
  const receiptSha256=canonicalHash(receipts.map(r=>({key:r.operationKey,kind:r.kind,hash:r.payloadHash,result:r.result})).sort((a,b)=>a.key.localeCompare(b.key)));
  const holdSha256=canonicalHash({orderId,status:order.status,hold:order.deliveryHoldReason,fence:order.deliveryFenceVersion,
    checkpoint,exception:exception?{id:exception.id,status:exception.status,claimVersion:exception.claimVersion,resolution:exception.resolution}:null,
    recovery:recoveries.map(r=>({id:r.sessionId,data:r.data})).sort((a,b)=>a.id.localeCompare(b.id)),receiptSha256});
  return {order,job,checkpoint,exception,receipts,recoveries,receiptSha256,holdSha256};
}
async function snapshot(db:PrismaClient,orderId:string) {return db.$transaction(async tx=>{await lockEngineOrder(tx,orderId);return state(tx,orderId);});}
async function resumeAllowed(db:PrismaClient,s:Awaited<ReturnType<typeof state>>) {
  try {
    if(s.job?.lockedBy&&s.job.leaseExpiresAt&&s.job.leaseExpiresAt>new Date())return false;
    if(s.checkpoint){assertEnginePolicyCurrent(s.checkpoint.authority);const meter=await inspectEngineOrderMeter(db,s.checkpoint.authority);return !meter.blocked;}
    // No job may still have a durable authority/claim after an ambiguous creation. Never guess that it is unpaid.
    return s.receipts.length===0;
  }catch{return false;}
}
export async function readEngineInfrastructureReview(db:PrismaClient,orderId:string) {
  await assertEnginePrivateDatabase(db);const s=await snapshot(db,orderId);
  if(s.order.deliveryHoldReason!=='engine_site_hold:infrastructure')return null;
  return {kind:'infrastructure' as const,orderId,holdSha256:s.holdSha256,canResume:await resumeAllowed(db,s),
    holdReason:s.order.deliveryHoldReason,code:s.order.lastError,caseId:s.exception?.id??null,
    actions:await db.atomicOperationReceipt.findMany({where:{orderId,kind:'engine_site_infrastructure_action_v1'},select:{result:true}})};
}
/** Server actor, exact hold+checkpoint+receipt binding, Order lock and existing atomic replay fence. No meter mutation. */
export async function decideEngineInfrastructure(db:PrismaClient,orderId:string,input:z.infer<typeof infrastructureActionSchema>,actorId:string) {
  const command={...infrastructureActionSchema.parse(input),orderId:identifierSchema.parse(orderId),actorId:identifierSchema.parse(actorId)};
  await assertEnginePrivateDatabase(db);
  const operationKey=`engine-site/v1/${orderId}/infrastructure-action/${command.idempotencyKey}`;
  const replay=await db.atomicOperationReceipt.findUnique({where:{operationKey}});
  const before=replay?null:await snapshot(db,orderId),canResume=before?await resumeAllowed(db,before):false;
  const action=await runAtomicOperation(db,{operationKey,orderId,kind:'engine_site_infrastructure_action_v1',payloadHash:hashOperationPayload(command),
    beforeReceipt:async tx=>{await lockEngineOrder(tx,orderId);},run:async tx=>{
      const current=await state(tx,orderId);
      if(!before||before.holdSha256!==command.expectedHoldSha256||current.holdSha256!==command.expectedHoldSha256||
        current.receiptSha256!==before.receiptSha256||current.order.status!=='needs_human_qa'||
        current.order.deliveryHoldReason!=='engine_site_hold:infrastructure'||current.job?.lockedBy&&current.job.leaseExpiresAt&&current.job.leaseExpiresAt>new Date())
        engineSiteFail('engine_operator_hold_changed');
      if(command.action==='resume'&&!canResume)engineSiteFail('engine_operator_unsettled_call');
      const sent=await tx.deliveryOutbox.findFirst({where:{orderId,sendAttempted:true}});
      const liability=await tx.exceptionCase.findFirst({where:{orderId,status:'refund_pending'}});
      if(sent||liability)engineSiteFail('engine_operator_external_action');
      const decidedAt=new Date().toISOString(),audit={...command,decidedAt,holdSha256:current.holdSha256};
      if(current.exception){
        const moved=await tx.exceptionCase.updateMany({where:{id:current.exception.id,claimVersion:current.exception.claimVersion,status:current.exception.status,actionAttemptedAt:null},data:{
          status:'resolved',activeKey:null,nextActionAt:null,leaseExpiresAt:null,claimVersion:{increment:1},resolution:{operatorRequired:false,...audit}}});
        if(moved.count!==1)engineSiteFail('engine_operator_case_changed');
        await tx.exceptionCaseAudit.createMany({data:[{eventKey:canonicalHash({operationKey}),caseId:current.exception.id,fromStatus:current.exception.status,
          toStatus:'resolved',actor:actorId,reason:`operator_${command.action}`,metadata:audit,createdAt:new Date(decidedAt)}],skipDuplicates:true});
      }
      if(command.action==='resume') {
        for(const recovery of current.recoveries)await tx.wizardSession.update({where:{sessionId:recovery.sessionId},data:{data:{
          ...(recovery.data as any),attempts:0,nextAt:0,recoveredBy:actorId,recoveredAt:decidedAt}}});
        if(current.checkpoint&&current.job){
          const cp=current.checkpoint;cp.phase=cp.recovery?.resumePhase??(cp.outputs.materialized_book?'accept':cp.outputs.native_book?'materialize':cp.outputs.prepared_source?'native':'story');
          delete cp.recovery;
          await tx.generationJob.update({where:{orderId},data:{status:'running',currentStage:cp.waiting?'engine_site_long':`engine_site_${cp.phase}`,
            lockedBy:null,leaseExpiresAt:null,retryable:true,lastError:null,pipelineCache:{engineSite:cp} as unknown as Prisma.InputJsonValue}});
        }
        await tx.order.update({where:{id:orderId},data:{status:current.job?'generating':'paid',manualReviewRequired:false,deliveryHoldReason:null,lastError:null,deliveryFenceVersion:{increment:1}}});
      } else {
        if(current.checkpoint){current.checkpoint.phase='held';
          await tx.generationJob.update({where:{orderId},data:{currentStage:'engine_site_accept',pipelineCache:{engineSite:current.checkpoint} as unknown as Prisma.InputJsonValue}});}
        await tx.order.update({where:{id:orderId},data:{deliveryHoldReason:'engine_site_hold:worker_failed',lastError:'engine_operator_failed_infrastructure'}});
      }
      return audit;
    }});
  if(action.action==='fail')await failEngineOrder(db,orderId,'engine_operator_failed_infrastructure');
  return {status:action.action==='resume'?'resumed' as const:'failed' as const,action};
}
