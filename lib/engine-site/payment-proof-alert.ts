import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';
import { lockOrderForExceptionCase,openExceptionCase } from '@/lib/generation-chunked/exception-case';
const scope=(saleId:string)=>`engine_site_payment_proof/${canonicalHash(saleId)}`;
const key=(orderId:string,saleId:string)=>`engine-site-payment-proof/v1/${orderId}/${canonicalHash(saleId)}`;
/** Only an already authenticated signed paid callback may call this. No unverified amount is adopted. */
export async function recordEnginePaymentProofRefusal(db:PrismaClient,orderId:string,saleId:string) {
  await db.$transaction(async tx=>{
    const lock=await lockOrderForExceptionCase(tx,orderId);if(!lock)return;
    const order=await tx.order.findUnique({where:{id:orderId}});if(order?.frozenProductVersion!=='engine-site/v1')return;
    const sessionId=key(orderId,saleId),row=await tx.wizardSession.findUnique({where:{sessionId}});
    const attempts=Math.min(3,((row?.data as any)?.attempts??0)+1);
    await tx.wizardSession.upsert({where:{sessionId},create:{sessionId,data:{attempts}},update:{data:{attempts}}});
    if(attempts<3)return;
    const exception=await openExceptionCase(tx,{orderId,scope:scope(saleId),kind:'integrity_blocked',reason:'engine_payment_proof_refused',
      initialStatus:'open',nextActionAt:null,metadata:{signedPaidCallback:true,operatorRequired:true},fenceExisting:true},lock);
    if(exception.actionAttemptedAt||!['open','retry_scheduled'].includes(exception.status))return;
    await tx.exceptionCase.update({where:{id:exception.id},data:{status:'open',nextActionAt:null,leaseExpiresAt:null,
      resolution:{operatorRequired:true,outcome:'payment_proof_refused',attempts,saleSha256:canonicalHash(saleId)}}});
  });
}
export async function clearEnginePaymentProofRefusal(db:PrismaClient,orderId:string,saleId:string) {
  const row=await db.wizardSession.findUnique({where:{sessionId:key(orderId,saleId)}});if(!row)return;
  await db.$transaction(async tx=>{
    if(!await lockOrderForExceptionCase(tx,orderId))return;
    const exception=await tx.exceptionCase.findUnique({where:{activeKey:`${orderId}:${scope(saleId)}`}});
    if(exception&&!exception.actionAttemptedAt&&['open','retry_scheduled'].includes(exception.status)) {
      await tx.exceptionCase.update({where:{id:exception.id},data:{status:'resolved',activeKey:null,nextActionAt:null,leaseExpiresAt:null,
        claimVersion:{increment:1},resolution:{operatorRequired:false,outcome:'payment_proof_verified'}}});
      await tx.exceptionCaseAudit.createMany({data:[{eventKey:canonicalHash({caseId:exception.id,outcome:'verified'}),caseId:exception.id,
        fromStatus:exception.status,toStatus:'resolved',actor:'system',reason:'engine_payment_proof_verified'}],skipDuplicates:true});
    }
    await tx.wizardSession.update({where:{sessionId:row.sessionId},data:{data:{attempts:0}}});
  });
}
