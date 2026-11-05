import 'server-only';
import type { Prisma,PrismaClient } from '@prisma/client';
import {z} from 'zod';
import {runAtomicOperation,hashOperationPayload} from '@/lib/generation-pipeline/atomic-operation';
import {identifierSchema,digestSchema,engineSiteFail} from './contract';
import { canonicalHash } from '@/lib/canonical-json';
import { lockOrderForExceptionCase,openExceptionCase } from '@/lib/generation-chunked/exception-case';
import { recordEngineOperatorNotice } from './operator-notices';
import type { PaymePaidProofMismatch } from '@/lib/payme';
const scope=(saleId:string)=>`engine_site_payment_proof/${canonicalHash(saleId)}`;
const key=(orderId:string,saleId:string)=>`engine-site-payment-proof/v1/${orderId}/${canonicalHash(saleId)}`;
const captureScope=(saleId:string)=>`engine_site_payment_capture_notice/${canonicalHash(saleId)}`;
const isPaymentNoticeScope=(value:string)=>value.startsWith('engine_site_payment_proof/')||value.startsWith('engine_site_payment_capture_notice/');
/** A signed callback or a server query using the stored sale. No browser status/amount is adopted. */
export async function recordEnginePaymentProofRefusal(db:PrismaClient,orderId:string,saleId:string,evidence:'signed_callback'|'stored_sale_query'='signed_callback',paidMismatch?:PaymePaidProofMismatch) {
  await db.$transaction(async tx=>{
    const lock=await lockOrderForExceptionCase(tx,orderId);if(!lock)return;
    const order=await tx.order.findUnique({where:{id:orderId}});if(order?.frozenProductVersion!=='engine-site/v1')return;
    if(paidMismatch&&(paidMismatch.orderId!==orderId||paidMismatch.saleId!==saleId||paidMismatch.expectedAmountAgorot!==order.totalPrice||
      !/^[a-f0-9]{64}$/.test(paidMismatch.providerProofSha256)))engineSiteFail('engine_payment_mismatch_changed');
    const primary=order.paymeTransactionId||order.paymentId;
    const extraPaidMismatch=!!paidMismatch&&!!primary&&primary!==saleId;
    // Advancing the order retires checkout-attempt notices, never a different confirmed paid sale.
    if(!['draft','pending_payment'].includes(order.status)){
      await closeEnginePaymentProofCases(tx,orderId);if(!extraPaidMismatch)return;
    }
    const sessionId=key(orderId,saleId),row=await tx.wizardSession.findUnique({where:{sessionId}});
    const attempts=Math.min(3,((row?.data as any)?.attempts??0)+1);
    await tx.wizardSession.upsert({where:{sessionId},create:{sessionId,data:{attempts}},update:{data:{attempts}}});
    const noticeScope=extraPaidMismatch?captureScope(saleId):scope(saleId);
    const code=extraPaidMismatch?'engine_extra_payment_proof_mismatch':'engine_payment_proof_refused';
    const exception=await openExceptionCase(tx,{orderId,scope:noticeScope,kind:'integrity_blocked',reason:code,
      initialStatus:'open',nextActionAt:null,metadata:{evidence,operatorRequired:true},fenceExisting:true},lock);
    if(exception.actionAttemptedAt||!['open','retry_scheduled'].includes(exception.status))return;
    await tx.exceptionCase.update({where:{id:exception.id},data:{status:'open',nextActionAt:null,leaseExpiresAt:null,
      resolution:{operatorRequired:true,outcome:extraPaidMismatch?'extra_payment_proof_mismatch':'payment_proof_refused',attempts,evidence,saleSha256:canonicalHash(saleId),
        ...(extraPaidMismatch?{expectedAmountAgorot:paidMismatch!.expectedAmountAgorot,observedAmountAgorot:paidMismatch!.observedAmountAgorot,
          observedCurrency:paidMismatch!.observedCurrency,providerProofSha256:paidMismatch!.providerProofSha256}:{})}}});
    await recordEngineOperatorNotice(tx,{caseId:exception.id,orderId,scope:noticeScope,code,domain:'payment'});
  });
}
export async function clearEnginePaymentProofRefusal(db:PrismaClient,orderId:string,saleId:string) {
  // Kept saleId parameter for old callers; settlement/terminal state closes all previous sale attempts.
  const order=await db.order.findUnique({where:{id:orderId}});
  if(order?.frozenProductVersion!=='engine-site/v1'||['draft','pending_payment'].includes(order.status))return;
  await db.$transaction(async tx=>{
    if(!await lockOrderForExceptionCase(tx,orderId))return;
    const current=await tx.order.findUnique({where:{id:orderId}});
    if(current?.frozenProductVersion==='engine-site/v1'&&!['draft','pending_payment'].includes(current.status))await closeEnginePaymentProofCases(tx,orderId);
  });
}
export async function closeEnginePaymentProofCases(tx:Prisma.TransactionClient,orderId:string) {
 const cases=await tx.exceptionCase.findMany({where:{orderId,scope:{startsWith:'engine_site_payment_proof/'},status:{in:['open','retry_scheduled']},actionAttemptedAt:null}});
 for(const row of cases)await resolveCase(tx,row,'system','engine_payment_order_settled_or_terminal',null);
}
async function resolveCase(tx:Prisma.TransactionClient,row:{id:string;status:any},actor:string,reason:string,metadata:Prisma.InputJsonValue|null){
 await tx.exceptionCase.update({where:{id:row.id},data:{status:'resolved',activeKey:null,nextActionAt:null,leaseExpiresAt:null,claimVersion:{increment:1},resolution:{operatorRequired:false,outcome:reason}}});
 await tx.exceptionCaseAudit.createMany({data:[{eventKey:canonicalHash({caseId:row.id,reason,metadata}),caseId:row.id,fromStatus:row.status,toStatus:'resolved',actor,reason,metadata:metadata??undefined}],skipDuplicates:true});
}
export const paymentNoticeDismissSchema=z.object({action:z.literal('dismiss_payment_notice'),caseId:identifierSchema,expectedNoticeSha256:digestSchema,idempotencyKey:identifierSchema,reason:z.string().trim().min(1).max(500)}).strict();
export async function dismissEnginePaymentNotice(db:PrismaClient,orderId:string,input:z.infer<typeof paymentNoticeDismissSchema>,actorId:string){
 const command={...paymentNoticeDismissSchema.parse(input),orderId:identifierSchema.parse(orderId),actorId:identifierSchema.parse(actorId)};
 return runAtomicOperation(db,{operationKey:`engine-site/v1/${orderId}/payment-notice-dismiss/${command.idempotencyKey}`,orderId,kind:'engine_site_payment_notice_dismiss_v1',payloadHash:hashOperationPayload(command),
 beforeReceipt:async tx=>{await lockOrderForExceptionCase(tx,orderId);},run:async tx=>{
  const order=await tx.order.findUnique({where:{id:orderId}}),row=await tx.exceptionCase.findUnique({where:{id:command.caseId}}),notice=await tx.wizardSession.findUnique({where:{sessionId:'engine-site-operator-notice/v1/'+command.caseId}});
  if(order?.frozenProductVersion!=='engine-site/v1'||row?.orderId!==orderId||!isPaymentNoticeScope(row.scope)||!row.activeKey||row.actionAttemptedAt||!['open','retry_scheduled'].includes(row.status)||canonicalHash(notice?.data)!==command.expectedNoticeSha256)engineSiteFail('engine_payment_notice_changed');
  const audit={...command,decidedAt:new Date().toISOString()};await resolveCase(tx,row,actorId,'engine_payment_notice_dismissed',audit);return {status:'dismissed',audit};}});
}
