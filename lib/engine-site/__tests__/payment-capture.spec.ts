import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';
const m = vi.hoisted(() => ({ db: {} as any, trigger: vi.fn(), fetch: vi.fn(),warn:vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t,k) => m.db[k] }) }));
vi.mock('@/lib/env', () => ({ env: { PAYMENT_PROVIDER: 'payme' } }));
vi.mock('@/app/api/generate/trigger', () => ({ triggerGeneration: m.trigger }));
vi.mock('@/lib/coupon/coupon-service', () => ({ confirmCouponForOrder: async () => null, couponConfirmFenceReason: async () => null }));
vi.mock('@/lib/human-qa/sync-hold-case', () => ({ syncHumanQaHoldCasePostCommit: async () => {} }));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn:m.warn, error() {} }) }));
import { POST } from '@/app/api/webhooks/payme/route';
import { engineTestDb } from './engine-test-db';
import { claimDueExceptionCases } from '@/lib/generation-chunked/exception-case';
import { processExceptionCase } from '@/lib/generation-chunked/exception-processor';
import { refundOrderPayment } from '@/lib/payment-refunds';
const stores: Awaited<ReturnType<typeof engineTestDb>>[] = [];
afterEach(async () => { for (const s of stores.splice(0)) await s.pg.close(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
async function setup(status = 'generating') {
  const s = await engineTestDb(); stores.push(s); m.db = s.db;
  await s.pg.exec(`ALTER TABLE "Order" ADD COLUMN "paymentId" text; ALTER TABLE "Order" ADD COLUMN "paymeMetadata" jsonb;
    ALTER TABLE "Order" ADD COLUMN "stripePaid" boolean DEFAULT false; ALTER TABLE "Order" ADD COLUMN "stripePaymentId" text;`);
  await s.pg.query('UPDATE "Order" SET status=$1,"paymentId"=$2,"paymeTransactionId"=$2', [status,'primary_sale']);
  vi.stubEnv('PAYME_WEBHOOK_SECRET','SYNTHETIC_ONLY'); vi.stubEnv('PAYME_API_BASE_URL','https://payme.example.invalid/api'); vi.stubEnv('PAYME_API_KEY','SYNTHETIC_ONLY');
  vi.stubEnv('ENGINE_SITE_FULFILLMENT_ENABLED','true');
  vi.stubGlobal('fetch',m.fetch); m.fetch.mockImplementation(async (_url,init) => new Response(JSON.stringify({ status_code: 0, items: [{
    sale_payme_id: JSON.parse(init.body).sale_payme_id, transaction_id: 'synthetic_order', sale_price: 5900, sale_currency: 'ILS', sale_status: 'completed' }] })));
  return s;
}
async function callback(sale: string) {
  const body = JSON.stringify({ transaction_id: 'synthetic_order', payme_sale_id: sale, sale_status: 'completed' });
  return POST(new NextRequest('https://app.example.invalid/api/webhooks/payme',{ method:'POST',body,headers:{'content-type':'application/json',
    'x-payme-signature':createHmac('sha256','SYNTHETIC_ONLY').update(body).digest('hex') } }));
}
describe('Q10 actual signed webhook, immutable primary capture and sale-specific refund liability', () => {
  it('R2-7 repeated signed paid proof refusals are logged and create an operator case',async()=>{
    const s=await setup('pending_payment');m.fetch.mockImplementation(async()=>new Response(JSON.stringify({items:[]})));
    for(let n=0;n<3;n++)expect((await callback('primary_sale')).status).toBe(503);
    expect(m.warn).toHaveBeenCalled();
    expect((await s.db.exceptionCase.findFirst())!.resolution).toMatchObject({operatorRequired:true,outcome:'payment_proof_refused'});
    expect(m.trigger).not.toHaveBeenCalled();
  });
  it('a bound primary capture becomes paid once; its replay cannot start a second job',async()=>{
    const s=await setup('pending_payment');await s.pg.exec('UPDATE "Order" SET "paymeTransactionId"=NULL');
    expect((await callback('primary_sale')).status).toBe(200);expect((await callback('primary_sale')).status).toBe(200);
    expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.status).toBe('paid');
    expect(m.trigger).toHaveBeenCalledTimes(1);expect(await s.db.exceptionCase.findMany()).toHaveLength(0);
  });
  it('never revives a failed order or replaces its captured primary sale', async () => {
    const s = await setup('failed'); expect((await callback('primary_sale')).status).toBe(200);
    const order = await s.db.order.findUnique({where:{id:'synthetic_order'}});
    expect(order!.status).toBe('failed'); expect(order!.paymeTransactionId).toBe('primary_sale'); expect(m.trigger).not.toHaveBeenCalled();
  });
  it('an additional confirmed capture has its own refundable liability and cannot change the primary sale', async () => {
    const s = await setup(); expect((await callback('extra_sale')).status).toBe(200);
    expect((await callback('extra_sale')).status).toBe(200);
    expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.paymeTransactionId).toBe('primary_sale');
    const cases = await s.db.exceptionCase.findMany(); expect(cases).toHaveLength(1); expect(cases[0].scope).toMatch(/^engine_site_extra_payment\//);
    const refundSale = vi.fn(async (_sale: string) => ({state:'refunded' as const,providerActionId:'synthetic_refund'}));
    const claimed = (await claimDueExceptionCases(s.db,new Date(Date.now()+1000),1))[0];
    await processExceptionCase(s.db,claimed,{refund:(order,key,prior,extra)=>refundOrderPayment(order,key,prior,{...extra,
      queryPaymeSale:async()=>({state:'paid',rawStatus:'paid'}),refundPaymeSale:refundSale}),refundNotice:async()=>({providerMessageId:'synthetic_notice'})});
    expect(refundSale).toHaveBeenCalledWith('extra_sale'); expect(m.trigger).not.toHaveBeenCalled();
  });
  it('a forged case-to-sale binding cannot refund the primary or a different sale',async()=>{
    const s=await setup();await callback('extra_sale');const c=(await s.db.exceptionCase.findFirst())!;
    await s.db.exceptionCase.update({where:{id:c.id},data:{resolution:{capturedSaleReceipt:'engine-site/v1/foreign/captured-sale/forged'}}});
    const claimed=(await claimDueExceptionCases(s.db,new Date(Date.now()+1000),1))[0],refund=vi.fn();
    await expect(processExceptionCase(s.db,claimed,{refund})).rejects.toThrow('engine_extra_payment_receipt_changed');expect(refund).not.toHaveBeenCalled();
  });
});
