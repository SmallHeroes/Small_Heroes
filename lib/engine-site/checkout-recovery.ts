import 'server-only';
import type { Order,PrismaClient,Prisma } from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';
import { PAYME_SALE_TTL_MS,queryPaymeOrderSales,isPaymeStatusPaid } from '@/lib/payme';
import { recordEngineUnexpectedCapture } from './extra-payment';
import { engineQaRequired, isPaymeSandboxCheckoutUrl } from './qa-order-policy';
export const ENGINE_CHECKOUT_RENEWAL_MARGIN_MS=5*60_000;
const ATTEMPT_LEASE_MS=2*60_000;
type CheckoutOrder=Pick<Order,'id'|'paymentId'|'paymentProvider'|'checkoutAttemptToken'|'checkoutAttemptAt'|'paymeMetadata'|'totalPrice'|'status'>;
export function personalCheckoutMetadata(saleId:string,checkoutUrl:string,issuedAt=new Date()) {
  return {version:'engine-site-payme-checkout/v2',saleId,checkoutUrl,createdAt:issuedAt.toISOString(),expiresAt:new Date(issuedAt.getTime()+PAYME_SALE_TTL_MS).toISOString()};
}
function validUrl(value:unknown,appUrl:string) {
  if (engineQaRequired() && (typeof value !== 'string' || !isPaymeSandboxCheckoutUrl(value))) return null;
  try{const url=new URL(String(value));return url.protocol==='https:'&&!url.username&&!url.password&&url.origin!==new URL(appUrl).origin?url.href:null;}catch{return null;}
}
/** Lookup occurs outside the transaction; its observation is adopted only if the original Order attempt still matches. */
export async function recoverEngineCheckout(db:PrismaClient,order:CheckoutOrder,appUrl:string,now=Date.now()) {
  if(!order.paymentId&&!order.checkoutAttemptToken)return {kind:'create' as const};
  const data=order.paymeMetadata as any;
  const issuedAt=data?.createdAt?Date.parse(data.createdAt):order.checkoutAttemptAt?.getTime();
  if(!Number.isFinite(issuedAt))return {kind:'hold' as const};
  const expiresAt=data?.expiresAt?Date.parse(data.expiresAt):issuedAt!+PAYME_SALE_TTL_MS;
  const url=validUrl(data?.checkoutUrl??data?.sale_url,appUrl);
  if(order.paymentId&&order.paymentProvider==='payme'&&url&&now<expiresAt)
    return {kind:'reuse' as const,saleId:order.paymentId,url};
  if(!order.paymentId&&now-issuedAt!<ATTEMPT_LEASE_MS)return {kind:'hold' as const};
  const sales=await queryPaymeOrderSales(order.id,order.totalPrice);
  const paid=sales.filter(s=>isPaymeStatusPaid(s.status));
  const live=sales.filter(s=>['created','initial','pending','processing','authorized','validated'].includes(s.status));
  if(sales.some(s=>!isPaymeStatusPaid(s.status)&&!['created','initial','pending','processing','authorized','validated','expired','cancelled','canceled','failed','declined','refunded'].includes(s.status)))
    return {kind:'hold' as const};
  const selected=paid.find(s=>s.saleId===order.paymentId)??paid.slice().sort((a,b)=>a.saleId.localeCompare(b.saleId))[0]??
    (live.length===1&&now<expiresAt?live[0]:null);
  if(!selected&&now<expiresAt+ENGINE_CHECKOUT_RENEWAL_MARGIN_MS)return {kind:'hold' as const};
  if(selected&&!isPaymeStatusPaid(selected.status)&&!validUrl(selected.checkoutUrl,appUrl))return {kind:'hold' as const};
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${order.id} FOR UPDATE`;
    const current=await tx.order.findUnique({where:{id:order.id}});
    if(!current||!['draft','pending_payment'].includes(current.status)||current.paymentId!==order.paymentId||
      current.checkoutAttemptToken!==order.checkoutAttemptToken||current.totalPrice!==order.totalPrice)return {kind:'hold' as const};
    const archived=[...new Set([...(order.paymentId?[order.paymentId]:[]),...sales.map(s=>s.saleId)])];
    for(const saleId of archived){
      const sessionId=`engine-site-checkout-sale/v1/${order.id}/${canonicalHash(saleId)}`;
      await tx.wizardSession.upsert({where:{sessionId},create:{sessionId,data:{version:'engine-site-checkout-sale/v1',orderId:order.id,saleId,
        observedAt:new Date(now).toISOString(),attemptAt:new Date(issuedAt!).toISOString()}},update:{}});
    }
    if(selected){
      const paymentUrl=isPaymeStatusPaid(selected.status)?`${appUrl}/api/payme/return?orderId=${encodeURIComponent(order.id)}`:validUrl(selected.checkoutUrl,appUrl)!;
      await tx.order.update({where:{id:order.id},data:{paymentId:selected.saleId,paymentProvider:'payme',checkoutAttemptToken:null,checkoutAttemptAt:null,
        paymeMetadata:personalCheckoutMetadata(selected.saleId,validUrl(selected.checkoutUrl,appUrl)??url??'',new Date(issuedAt!))}});
      for(const extra of paid.filter(s=>s.saleId!==selected.saleId))await recordEngineUnexpectedCapture(tx,current,extra.saleId);
      return {kind:'reuse' as const,saleId:selected.saleId,url:paymentUrl};
    }
    // Old sale ids are retained even if a provider ignores expiry; any late capture is independently refunded.
    await tx.order.update({where:{id:order.id},data:{paymentId:null,checkoutAttemptToken:null,checkoutAttemptAt:null,
      paymeMetadata:{version:'engine-site-payme-retired/v1',retiredSaleIds:archived,retiredAt:new Date(now).toISOString()} as Prisma.InputJsonValue}});
    return {kind:'create' as const};
  });
}
