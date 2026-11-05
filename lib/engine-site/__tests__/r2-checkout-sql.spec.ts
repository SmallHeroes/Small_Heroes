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
import { syntheticEngineActivationEnv } from './synthetic-order';
import { handleCheckoutPost } from '@/app/api/checkout/handler';
import { POST } from '@/app/api/webhooks/payme/route';
const stores:Awaited<ReturnType<typeof engineTestDb>>[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.pg.close();m.db=null;vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
async function setup(){
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
  const items:{sale_payme_id:string;transaction_id:string;sale_price:string;sale_currency:string;sale_status:string;sale_url:string}[]=[];
  const network=vi.fn(async(url:any,init:any)=>{
    const body=JSON.parse(init.body);
    if(String(url).endsWith('/generate-sale')){
      if(reject){reject=false;return new Response(JSON.stringify({status_code:1,status_error_code:'SYNTHETIC_REJECT'}),{status:400});}
      const sale={sale_payme_id:`sale_${++sales}`,transaction_id:body.transaction_id,sale_price:String(body.sale_price),sale_currency:'ils',sale_status:'created',sale_url:`https://payme.example.invalid/pay/${sales}`};items.push(sale);
      if(loseReply){loseReply=false;throw Error('synthetic_lost_reply');}
      return new Response(JSON.stringify({status_code:0,payme_sale_id:sale.sale_payme_id,sale_url:sale.sale_url}));
    }
    if(String(url).endsWith('/get-sales')){const found=body.sale_payme_id?items.filter(s=>s.sale_payme_id===body.sale_payme_id):items.filter(s=>s.transaction_id===body.transaction_id);
      return new Response(JSON.stringify({status_code:0,items_count:found.length,items:found}));}
    throw Error('unexpected_network_forbidden');
  });vi.stubGlobal('fetch',network);
  const checkout=()=>handleCheckoutPost(new NextRequest('https://app.example.invalid/api/checkout',{method:'POST',headers:{origin:'https://app.example.invalid','content-type':'application/json'},body:JSON.stringify({orderId:'synthetic_order'})}),{routeProtocol:'legacy-route'});
  return {...s,items,network,checkout,lose(){loseReply=true;},reject(){reject=true;}};
}
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
