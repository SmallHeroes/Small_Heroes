import { afterEach,describe,expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';
const m=vi.hoisted(()=>({db:null as any,trigger:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:new Proxy({},{get(_t,k){if(!m.db)throw Error('live_database_forbidden');return m.db[k];}})}));
vi.mock('@/lib/auth-session',()=>({resolveUserFromRequest:async()=>({user:{id:'synthetic_parent'}})}));
vi.mock('@/lib/request-security',()=>({enforceSameOrigin:()=>null,enforceRateLimit:()=>null}));
vi.mock('@/lib/env',()=>({env:{PAYMENT_PROVIDER:'payme',PAYME_API_BASE_URL:'https://payme.example.invalid/api',PAYME_API_KEY:'SYNTHETIC'},
  isWaitlistMode:()=>false,isFakePaymentEnabled:()=>false,canUseFakePayments:()=>false}));
vi.mock('@/lib/coupon/coupon-service',()=>({reserveCoupon:vi.fn(),releaseCouponForOrder:vi.fn(),confirmCouponForOrder:async()=>null,couponConfirmFenceReason:async()=>null}));
vi.mock('@/app/api/generate/trigger',()=>({triggerGeneration:m.trigger}));
vi.mock('@/lib/human-qa/sync-hold-case',()=>({syncHumanQaHoldCasePostCommit:async()=>{}}));
import { engineTestDb } from './engine-test-db';
import { syntheticEngineActivationEnv, syntheticEngineQaEnv, syntheticQaOrigin } from './synthetic-order';
import { handleCheckoutPost } from '@/app/api/checkout/handler';
import { POST } from '@/app/api/webhooks/payme/route';
import { GET as returnFromPayme } from '@/app/api/payme/return/route';
import { ENGINE_QA_SESSION_ID, PAYME_SANDBOX_API, PAYME_SANDBOX_ORIGIN } from '../qa-order-policy';
const stores:Awaited<ReturnType<typeof engineTestDb>>[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.pg.close();m.db=null;vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
async function setup(qa = false){
  for(const [k,v] of Object.entries(syntheticEngineActivationEnv()))vi.stubEnv(k,v);
  vi.stubEnv('PAYME_API_BASE_URL','https://payme.example.invalid/api');vi.stubEnv('PAYME_API_KEY','SYNTHETIC');vi.stubEnv('PAYME_WEBHOOK_SECRET','SYNTHETIC');
  const s=await engineTestDb();stores.push(s);m.db=s.db;
  await s.pg.exec(`ALTER TABLE "Order" ADD COLUMN "paymentId" text; ALTER TABLE "Order" ADD COLUMN "paymeMetadata" jsonb;
    ALTER TABLE "Order" ADD COLUMN "checkoutAttemptToken" text; ALTER TABLE "Order" ADD COLUMN "checkoutAttemptAt" timestamptz;
    ALTER TABLE "Order" ADD COLUMN "basePrice" int DEFAULT 5900; ALTER TABLE "Order" ADD COLUMN "addonsPrice" int DEFAULT 0;
    ALTER TABLE "Order" ADD COLUMN "totalPrice" int DEFAULT 5900; ALTER TABLE "Order" ADD COLUMN "couponCode" text;
    ALTER TABLE "Order" ADD COLUMN "couponDiscountPercent" int; ALTER TABLE "Order" ADD COLUMN "couponDiscountAgorot" int;
    ALTER TABLE "Order" ADD COLUMN "stripePaid" boolean DEFAULT false; UPDATE "Order" SET status='draft',"paymeTransactionId"=NULL;`);
  let sales=0,loseReply=false,reject=false;
  const appOrigin = qa ? syntheticQaOrigin : 'https://app.example.invalid';
  const saleOrigin = qa ? PAYME_SANDBOX_ORIGIN : 'https://payme.example.invalid';
  if (qa) {
    for (const [name, value] of Object.entries(syntheticEngineQaEnv())) vi.stubEnv(name, value);
    vi.stubEnv('PAYME_WEBHOOK_SECRET', undefined);
    await s.pg.query('UPDATE "WizardSession" SET "sessionId"=$1 WHERE id=$2', [ENGINE_QA_SESSION_ID, 'synthetic_session']);
    await s.pg.exec(`ALTER TABLE "Order" ADD COLUMN "userId" text DEFAULT 'synthetic_parent';
      ALTER TABLE "Order" ADD COLUMN "selectedVoice" text DEFAULT 'dad_v2';`);
  }
  const items:{sale_payme_id:string;transaction_id:string;sale_price:string;sale_currency:string;sale_status:string;sale_url:string}[]=[];
  const network=vi.fn(async(url:any,init:any)=>{
    const body=JSON.parse(init.body);
    if(String(url).endsWith('/generate-sale')){
      if(reject){reject=false;return new Response(JSON.stringify({status_code:1,status_error_code:'SYNTHETIC_REJECT'}),{status:400});}
      const sale={sale_payme_id:`sale_${++sales}`,transaction_id:body.transaction_id,sale_price:String(body.sale_price),sale_currency:'ils',sale_status:'created',sale_url:saleOrigin+'/pay/'+sales};items.push(sale);
      if(loseReply){loseReply=false;throw Error('synthetic_lost_reply');}
      return new Response(JSON.stringify({status_code:0,payme_sale_id:sale.sale_payme_id,sale_url:sale.sale_url}));
    }
    if(String(url).endsWith('/get-sales')){const found=body.sale_payme_id?items.filter(s=>s.sale_payme_id===body.sale_payme_id):items.filter(s=>s.transaction_id===body.transaction_id);
      return new Response(JSON.stringify({status_code:0,items_count:found.length,items:found}));}
    throw Error('unexpected_network_forbidden');
  });vi.stubGlobal('fetch',network);
  const checkout=()=>handleCheckoutPost(new NextRequest(appOrigin+'/api/checkout',{method:'POST',headers:{origin:appOrigin,'content-type':'application/json'},body:JSON.stringify({orderId:'synthetic_order'})}),{routeProtocol:'legacy-route'});
  return {...s,items,network,checkout,lose(){loseReply=true;},reject(){reject=true;}};
}
describe('dedicated QA PayMe Sandbox checkout and payment proof', () => {
  const callback = (saleId: string, notifyType = 'sale-complete', eventType = 'caller_hint') => POST(new NextRequest(
    syntheticQaOrigin + '/api/webhooks/payme', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ notify_type: notifyType, transaction_id: 'synthetic_order',
        payme_sale_id: saleId, sale_status: 'completed', event_type: eventType }).toString(),
    },
  ));

  it('reuses one Sandbox sale and marks paid once after exact provider confirmation', async () => {
    const s = await setup(true);
    expect((await s.checkout()).status).toBe(200);
    expect((await s.checkout()).status).toBe(200);
    expect(s.network).toHaveBeenCalledTimes(1);
    expect(s.network.mock.calls[0][0]).toBe(PAYME_SANDBOX_API + '/generate-sale');
    const request = s.network.mock.calls[0][1];
    expect(request.redirect).toBe('error');
    expect(JSON.parse(request.body)).toMatchObject({ sale_price: 5900, currency: 'ILS',
      sale_callback_url: syntheticQaOrigin + '/api/webhooks/payme' });
    expect((await callback('unbound_sale')).status).toBe(409);
    expect((await callback('sale_1', 'refund')).status).toBe(200);
    expect(s.network).toHaveBeenCalledTimes(1);
    expect((await callback('sale_1')).status).toBe(503);
    expect(m.trigger).not.toHaveBeenCalled();
    s.items[0].sale_status = 'completed';
    expect((await callback('sale_1')).status).toBe(200);
    expect((await callback('sale_1', 'sale-complete', 'different_hint')).status).toBe(200);
    expect((await s.db.order.findUnique({ where: { id: 'synthetic_order' } }))?.status).toBe('paid');
    expect((await s.pg.query('SELECT "eventType" FROM "PaymeWebhookEvent"')).rows).toEqual([{ eventType: 'sale-complete' }]);
    expect((await s.db.paymentRecord.findUnique({ where: { orderId: 'synthetic_order' } }))?.raw)
      .toMatchObject({ items: [{ sale_payme_id: 'sale_1', sale_status: 'completed' }] });
    expect(m.trigger).toHaveBeenCalledTimes(1);
    expect(s.network.mock.calls.slice(1).every(([url, init]) => url === PAYME_SANDBOX_API + '/get-sales' &&
      init.redirect === 'error' && JSON.parse(init.body).sale_payme_id === 'sale_1')).toBe(true);
  });

  it('uses the stored Sandbox sale on browser return, ignoring its caller-supplied sale ID', async () => {
    const s = await setup(true);
    expect((await s.checkout()).status).toBe(200);
    s.items[0].sale_status = 'completed';
    const response = await returnFromPayme(new NextRequest(syntheticQaOrigin +
      '/api/payme/return?orderId=synthetic_order&paymentId=unbound&status=paid'));
    expect(response.headers.get('location')).toBe(syntheticQaOrigin + '/personal/orders/synthetic_order?payment=checking');
    expect(JSON.parse(s.network.mock.calls[1][1].body).sale_payme_id).toBe('sale_1');
    expect((await s.db.order.findUnique({ where: { id: 'synthetic_order' } }))?.status).toBe('paid');
  });

  it('refuses a live provider URL before a checkout attempt can be claimed', async () => {
    const s = await setup(true);
    vi.stubEnv('PAYME_API_BASE_URL', 'https://live.example.invalid/api');
    expect((await s.checkout()).status).toBe(503);
    expect(s.network).not.toHaveBeenCalled();
    expect((await s.db.order.findUnique({ where: { id: 'synthetic_order' } }))?.checkoutAttemptToken).toBeNull();
  });

  it('holds a Sandbox response whose checkout destination points elsewhere', async () => {
    const s = await setup(true);
    s.network.mockResolvedValueOnce(Response.json({ status_code: 0, payme_sale_id: 'sale_1',
      sale_url: 'https://sandbox.payme.io.attacker.invalid/sale' }));
    const response = await s.checkout();
    expect(response.status).toBe(500);
    expect((await s.db.order.findUnique({ where: { id: 'synthetic_order' } }))?.paymentId).toBeNull();
    expect((await s.db.order.findUnique({ where: { id: 'synthetic_order' } }))?.checkoutAttemptToken).not.toBeNull();
  });

  it('blocks ordinary engine orders on the staging checkout and payment routes', async () => {
    const s = await setup(true);
    await s.pg.query('UPDATE "WizardSession" SET "sessionId"=$1 WHERE id=$2', ['ordinary-order', 'synthetic_session']);
    expect((await s.checkout()).status).toBe(403);
    expect((await callback('sale_1')).status).toBe(409);
    expect((await returnFromPayme(new NextRequest(syntheticQaOrigin + '/api/payme/return?orderId=synthetic_order'))).status).toBe(403);
    expect(s.network).not.toHaveBeenCalled();
    expect(m.trigger).not.toHaveBeenCalled();
  });
});

describe('R2-5 actual checkout + PayMe adapter + PostgreSQL + late signed capture',()=>{
  it.each([[200,'malformed'],[503,1]] as const)('an unclear provider rejection %s/%s retains the attempt instead of guessing no sale',async(status,statusCode)=>{
    const s=await setup();s.network.mockImplementationOnce(async()=>new Response(JSON.stringify({status_code:statusCode}),{status}));
    expect((await s.checkout()).status).toBe(500);
    expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.checkoutAttemptToken).not.toBeNull();
    expect((await s.checkout()).status).toBe(409);expect(s.network).toHaveBeenCalledTimes(1);
  });
  it('releases a definite provider rejection and safely creates the next attempt',async()=>{
    const s=await setup();s.reject();expect((await s.checkout()).status).toBe(500);
    expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.checkoutAttemptToken).toBeNull();
    expect((await s.checkout()).status).toBe(200);expect(s.items).toHaveLength(1);
  });
  it('recovers a lost generate-sale reply through the documented order query without a second sale',async()=>{
    const s=await setup();s.lose();expect((await s.checkout()).status).toBe(500);
    expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.checkoutAttemptToken).not.toBeNull();
    await s.pg.exec(`UPDATE "Order" SET "checkoutAttemptAt"=now()-interval '3 minutes'`);
    const response=await s.checkout();expect(response.status).toBe(200);expect(await response.json()).toMatchObject({paymentId:'sale_1'});expect(s.items).toHaveLength(1);
    expect(s.network.mock.calls.some(([,init])=>JSON.parse(init.body).transaction_id==='synthetic_order'&&JSON.parse(init.body).page_size===500)).toBe(true);
  });
  it('renews after expiry plus margin, retains the old id and refunds a late old capture as extra',async()=>{
    const s=await setup();expect((await s.checkout()).status).toBe(200);
    const order=(await s.db.order.findUnique({where:{id:'synthetic_order'}}))!,metadata={...(order.paymeMetadata as any),
      createdAt:new Date(Date.now()-60*60_000).toISOString(),expiresAt:new Date(Date.now()-15*60_000).toISOString()};
    await s.db.order.update({where:{id:'synthetic_order'},data:{paymeMetadata:metadata}});s.items[0].sale_status='expired';
    const renewed=await s.checkout();expect(renewed.status).toBe(200);expect(await renewed.json()).toMatchObject({paymentId:'sale_2'});
    expect((await s.db.wizardSession.findMany()).some(r=>(r.data as any)?.version==='engine-site-checkout-sale/v1'&&(r.data as any).saleId==='sale_1')).toBe(true);
    s.items[0].sale_status='completed';const body=JSON.stringify({transaction_id:'synthetic_order',payme_sale_id:'sale_1',sale_status:'completed'});
    const capture=await POST(new NextRequest('https://app.example.invalid/api/webhooks/payme',{method:'POST',body,headers:{'content-type':'application/json',
      'x-payme-signature':createHmac('sha256','SYNTHETIC').update(body).digest('hex')}}));
    expect(capture.status).toBe(200);expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.paymentId).toBe('sale_2');
    expect((await s.db.exceptionCase.findFirst())!.scope).toMatch(/^engine_site_extra_payment\//);expect(m.trigger).not.toHaveBeenCalled();
  });
  it('holds during the renewal margin instead of returning an already expired checkout URL',async()=>{
    const s=await setup();expect((await s.checkout()).status).toBe(200);
    const order=(await s.db.order.findUnique({where:{id:'synthetic_order'}}))!;
    await s.db.order.update({where:{id:'synthetic_order'},data:{paymeMetadata:{...(order.paymeMetadata as any),
      createdAt:new Date(Date.now()-46*60_000).toISOString(),expiresAt:new Date(Date.now()-60_000).toISOString()}}});
    const response=await s.checkout();expect(response.status).toBe(409);expect((await response.json()).url).toBeUndefined();
    expect(s.items).toHaveLength(1);
  });
});
