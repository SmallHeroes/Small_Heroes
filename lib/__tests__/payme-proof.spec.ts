import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m = vi.hoisted(() => ({ order: vi.fn(), update: vi.fn(), record: vi.fn(), trigger: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findUnique: m.order }, $transaction: (f: any) => f({
  order: { updateMany: m.update }, paymentRecord: { upsert: m.record } }) } }));
vi.mock('@/lib/env', () => ({ env: { PAYMENT_PROVIDER: 'payme', PAYME_REDIRECT_TRUST_MODE: false } }));
vi.mock('@/app/api/generate/trigger', () => ({ triggerGeneration: m.trigger }));
vi.mock('@/lib/coupon/coupon-service', () => ({ confirmCouponForOrder: vi.fn(), couponConfirmFenceReason: async () => null }));
vi.mock('@/lib/human-qa/sync-hold-case', () => ({ syncHumanQaHoldCasePostCommit: async () => {} }));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }));
import { verifyPaymePayment, queryPaymeSale } from '@/lib/payme';
import { GET } from '@/app/api/payme/return/route';
const sale = () => ({ sale_payme_id: 'sale_server', transaction_id: 'order_synthetic', sale_price: 5900,
  sale_currency: 'ILS', sale_status: 'completed' });
const verify = () => verifyPaymePayment({ orderId: 'order_synthetic', paymentId: 'sale_server', amountAgorot: 5900, currency: 'ILS' } as any);
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('PAYME_API_BASE_URL', 'https://payme.example.invalid/api'); vi.stubEnv('PAYME_API_KEY', 'SYNTHETIC_ONLY');
  vi.stubGlobal('fetch', m.fetch); m.fetch.mockResolvedValue(new Response(JSON.stringify({ status_code: 0, items: [sale()] })));
  m.order.mockResolvedValue({ id: 'order_synthetic', status: 'pending_payment', paymentProvider: 'payme', paymentId: 'sale_server', totalPrice: 5900, frozenProductVersion: 'engine-site/v1' });
  m.update.mockResolvedValue({ count: 1 }); m.record.mockResolvedValue({});
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('Q1 actual PayMe verifier and redirect, synthetic HTTP only', () => {
  it.each([{sale_price:'5900'},{sale_currency:'ils'},{sale_currency:undefined,currency:'ILS'}])(
    'R2-7 normalizes exact provider types without relaxing binding %j',async change=>{
      m.fetch.mockResolvedValueOnce(new Response(JSON.stringify({items:[{...sale(),...change}]})));
      expect(await verify()).toMatchObject({verified:true,status:'paid'});
    });
  it('R2-7 compares the exact truncated generate-sale order reference',async()=>{
    const orderId='synthetic_'+ 'a'.repeat(70);
    m.fetch.mockResolvedValueOnce(new Response(JSON.stringify({items:[{...sale(),transaction_id:orderId.slice(0,50)}]})));
    expect((await verifyPaymePayment({orderId,paymentId:'sale_server',amountAgorot:5900,currency:'ILS'})).verified).toBe(true);
  });
  it.each(['5900.01','5.9e3','5900oops',5900.5,null])('R2-7 rejects fractional/ambiguous money %j',async value=>{
    m.fetch.mockResolvedValueOnce(new Response(JSON.stringify({items:[{...sale(),sale_price:value}]})));
    expect((await verify()).verified).toBe(false);
  });
  it('Q1 refund reconciliation also refuses another sale or the root fallback', async () => {
    m.fetch.mockResolvedValueOnce(new Response(JSON.stringify({items:[{...sale(),sale_payme_id:'other'}]})));
    await expect(queryPaymeSale('sale_server')).rejects.toThrow('binding');
  });
  it('queries the documented exact sale filter and accepts a fully bound paid sale', async () => {
    expect(await verify()).toMatchObject({ verified: true, status: 'paid' });
    expect(JSON.parse(m.fetch.mock.calls[0][1].body)).toEqual({ seller_payme_id: 'SYNTHETIC_ONLY', sale_payme_id: 'sale_server' });
  });
  it.each([
    { sale_payme_id: 'unrelated_sale' }, { transaction_id: 'other_order' }, { sale_price: 1 },
    { sale_currency: 'USD' }, { sale_price: undefined }, { sale_currency: undefined },
  ])('refuses mismatched or absent sale/order/amount/currency %j', async change => {
    m.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ status_code: 0, items: [{ ...sale(), ...change }] })));
    expect((await verify()).verified).toBe(false);
  });
  it.each([{ ...sale(), items: [] }, { items: [sale(), sale()] }, { status_code: 1, items: [sale()] }])(
    'refuses root fallback, ambiguous result and provider error %j', async raw => {
      m.fetch.mockResolvedValueOnce(new Response(JSON.stringify(raw))); expect((await verify()).verified).toBe(false);
    });
  it.each(['engine-site/v1', null])('ignores forged browser sale ids on personal and historical returns: %s', async version => {
    m.order.mockResolvedValueOnce({ id: 'order_synthetic', status: 'pending_payment', paymentProvider: 'payme', paymentId: 'sale_server', totalPrice: 5900, frozenProductVersion: version });
    await GET(new NextRequest('https://app.example.invalid/api/payme/return?orderId=order_synthetic&transactionId=unrelated_paid&paymentId=random'));
    expect(JSON.parse(m.fetch.mock.calls[0][1].body).sale_payme_id).toBe('sale_server');
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentId: 'sale_server', paymeTransactionId: 'sale_server' }) }));
  });
  it('never revives a failed personal order from a late return', async () => {
    m.order.mockResolvedValueOnce({ id: 'order_synthetic', status: 'failed', paymentProvider: 'payme', paymentId: 'sale_server', totalPrice: 5900, frozenProductVersion: 'engine-site/v1' });
    await GET(new NextRequest('https://app.example.invalid/api/payme/return?orderId=order_synthetic'));
    expect(m.update).not.toHaveBeenCalled(); expect(m.trigger).not.toHaveBeenCalled();
  });
});
