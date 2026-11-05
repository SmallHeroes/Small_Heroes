import {afterEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createHmac} from 'node:crypto';
const h=vi.hoisted(()=>({db:null as any,context:null as any,fetch:vi.fn(),trigger:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:new Proxy({},{get:(_,key)=>h.db[key]})}));
vi.mock('@/lib/env',()=>({env:{PAYMENT_PROVIDER:'payme'}}));
vi.mock('@/app/api/generate/trigger',()=>({triggerGeneration:h.trigger}));
vi.mock('@/lib/coupon/coupon-service',()=>({confirmCouponForOrder:async()=>null,couponConfirmFenceReason:async()=>null}));
vi.mock('@/lib/human-qa/sync-hold-case',()=>({syncHumanQaHoldCasePostCommit:async()=>{}}));
vi.mock('@/lib/engine-site/reader',async original=>({...await original<any>(),loadEngineReaderBook:async()=>h.context}));
import {POST} from '@/app/api/webhooks/payme/route';
import {r4TestDb} from './r4-test-db';
import {syntheticEngineActivationEnv} from './synthetic-order';
import {startEnginePersonalJob} from '../personal-jobs';
import {parseEngineCheckpoint} from '../durable-worker';
import {ensureEngineLaunchPolicy} from '../launch-policy';
import {handleEngineOperator} from '../operator-http';
import {listEngineOperatorNotices} from '../operator-notices';
import {recordEnginePaymentProofRefusal,clearEnginePaymentProofRefusal,closeEnginePaymentProofCases} from '../payment-proof-alert';
import {claimDueExceptionCases} from '@/lib/generation-chunked/exception-case';
const stores:Awaited<ReturnType<typeof r4TestDb>>[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.pg.close();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.clearAllMocks();});
const item=(change:Record<string,unknown>={})=>({sale_payme_id:'extra_sale',transaction_id:'synthetic_order',sale_price:1,sale_currency:'ILS',sale_status:'completed',...change});
async function setup(status='generating'){
 for(const[k,v]of Object.entries(syntheticEngineActivationEnv()))vi.stubEnv(k,v);
 for(const[k,v]of Object.entries({APP_URL:'https://app.example.invalid',NEXT_PUBLIC_APP_URL:'https://app.example.invalid',PAYME_WEBHOOK_SECRET:'SYNTHETIC_ONLY',PAYME_API_BASE_URL:'https://payme.example.invalid/api',PAYME_API_KEY:'SYNTHETIC_ONLY',ENGINE_SITE_FULFILLMENT_ENABLED:'true'}))vi.stubEnv(k,v);
 const s=await r4TestDb();stores.push(s);h.db=s.db;
 await startEnginePersonalJob(s.db,'synthetic_order',JSON.parse(syntheticEngineActivationEnv().ENGINE_SITE_SPEND_POLICY!));await ensureEngineLaunchPolicy(s.db);
 await s.db.order.update({where:{id:'synthetic_order'},data:{status:status as any,paymentId:'primary_sale',paymeTransactionId:'primary_sale'}});
 h.context={order:await s.db.order.findUnique({where:{id:'synthetic_order'}}),checkpoint:parseEngineCheckpoint((await s.db.generationJob.findUnique({where:{orderId:'synthetic_order'}}))!.pipelineCache),bookSha256:'a'.repeat(64),book:{pdf:{assetId:'synthetic_pdf'}}};
 vi.stubGlobal('fetch',h.fetch);h.fetch.mockImplementation(async()=>new Response(JSON.stringify({status_code:0,items:[item()]})));
 const ports:any={db:s.db,parent:async()=>({id:'synthetic_operator'}),operatorIds:['synthetic_operator'],fulfillmentEnabled:true,storage:()=>({}),fulfillment:()=>({})};
 return {...s,ports};
}
async function callback(sale='extra_sale',signed=true){const body=JSON.stringify({transaction_id:'synthetic_order',payme_sale_id:sale,sale_status:'completed'});
 return POST(new NextRequest('https://app.example.invalid/api/webhooks/payme',{method:'POST',body,headers:{'content-type':'application/json',...(signed?{'x-payme-signature':createHmac('sha256','SYNTHETIC_ONLY').update(body).digest('hex')}: {})}}));}
const request=(view='',body?:unknown)=>new NextRequest('https://app.example.invalid/api/engine-site/v1/review/synthetic_order'+view,body?{method:'POST',headers:{origin:'https://app.example.invalid','content-type':'application/json'},body:JSON.stringify(body)}:undefined);
async function moneySnapshot(s:Awaited<ReturnType<typeof setup>>){return {order:await s.db.order.findUnique({where:{id:'synthetic_order'}}),payments:await s.db.paymentRecord.findMany(),refunds:await s.db.refundAttempt.findMany(),job:await s.db.generationJob.findUnique({where:{orderId:'synthetic_order'}})};}
describe('R5 exact signed paid mismatch is a persistent manual notice, never payment/refund authority',()=>{
 it.each(['draft','pending_payment','paid','generating','ready','partial','needs_human_qa','failed'])('keeps a non-primary paid mismatch across cleanup and replay on status %s',async status=>{
  const s=await setup(status),before=await moneySnapshot(s);
  for(let i=0;i<2;i++)expect((await callback()).status).toBe(503);
  const notices=await listEngineOperatorNotices(s.db);expect(notices).toHaveLength(1);expect(notices[0]).toMatchObject({code:'engine_extra_payment_proof_mismatch',domain:'payment'});expect(notices[0].scope).toMatch(/^engine_site_payment_capture_notice\//);
  const c=(await s.db.exceptionCase.findUnique({where:{id:notices[0].caseId}}))!;
  expect(c).toMatchObject({status:'open',nextActionAt:null,actionAttemptedAt:null,resolution:{operatorRequired:true,outcome:'extra_payment_proof_mismatch',expectedAmountAgorot:5900,observedAmountAgorot:1,observedCurrency:'ILS'}});
  expect((c.resolution as any).providerProofSha256).toMatch(/^[a-f0-9]{64}$/);
  await clearEnginePaymentProofRefusal(s.db,'synthetic_order','primary_sale');await s.db.$transaction(tx=>closeEnginePaymentProofCases(tx,'synthetic_order'));
  expect(await listEngineOperatorNotices(s.db)).toHaveLength(1);expect(await claimDueExceptionCases(s.db,new Date(Date.now()+3600000),100)).toHaveLength(0);
  expect(await moneySnapshot(s)).toEqual(before);expect(h.trigger).not.toHaveBeenCalled();expect(await s.db.atomicOperationReceipt.findMany({where:{kind:'engine_site_unexpected_capture_v1'}})).toHaveLength(0);
 });
 it('survives the real paid-order/book and inbox reads; audited exact dismissal still changes no money',async()=>{
  const s=await setup('paid'),before=await moneySnapshot(s);await callback();
  for(const [id,view]of [['synthetic_order',''],[null,'?view=cases']] as const){const r=await handleEngineOperator(request(view),id,s.ports);expect(r.status).toBe(200);const body=await r.json();expect(id?body.paymentCases:body.cases).toHaveLength(1);if(id)expect(body.kind).toBe('book');}
  const notice=(await listEngineOperatorNotices(s.db))[0],command={action:'dismiss_payment_notice',caseId:notice.caseId,expectedNoticeSha256:notice.noticeSha256,idempotencyKey:'r5_synthetic_dismiss',reason:'Synthetic extra charge investigated; no automatic money action'};
  expect((await handleEngineOperator(request('',command),'synthetic_order',{...s.ports,operatorIds:[]})).status).toBe(404);
  expect((await handleEngineOperator(request('',{...command,expectedNoticeSha256:'0'.repeat(64)}),'synthetic_order',s.ports)).status).toBe(409);
  for(let i=0;i<2;i++)expect((await handleEngineOperator(request('',command),'synthetic_order',s.ports)).status).toBe(200);
  expect(await listEngineOperatorNotices(s.db)).toHaveLength(0);expect(await moneySnapshot(s)).toEqual(before);
  expect(await s.db.exceptionCaseAudit.findMany({where:{reason:'engine_payment_notice_dismissed'}})).toHaveLength(1);
 });
 it('primary-attempt cleanup never closes the separate capture notice when a renewed sale settles',async()=>{
  const s=await setup('pending_payment');await recordEnginePaymentProofRefusal(s.db,'synthetic_order','old_primary');await callback();expect(await listEngineOperatorNotices(s.db)).toHaveLength(2);
  h.fetch.mockImplementation(async()=>new Response(JSON.stringify({status_code:0,items:[item({sale_payme_id:'primary_sale',sale_price:5900})]})));
  expect((await callback('primary_sale')).status).toBe(200);const notices=await listEngineOperatorNotices(s.db);expect(notices).toHaveLength(1);expect(notices[0].code).toBe('engine_extra_payment_proof_mismatch');
  expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.status).toBe('paid');expect(h.trigger).toHaveBeenCalledTimes(1);
 });
 it.each([
  {label:'different returned sale',raw:{items:[item({sale_payme_id:'foreign_sale'})]}},
  {label:'different returned order',raw:{items:[item({transaction_id:'foreign_order'})]}},
  {label:'nonpaid initial',raw:{items:[item({sale_status:'initial'})]}},
  {label:'refunded',raw:{items:[item({sale_status:'refunded'})]}},
  {label:'unknown',raw:{items:[item({sale_status:'unknown'})]}},
  {label:'empty',raw:{items:[]}}, {label:'duplicate',raw:{items:[item(),item()]}}, {label:'provider error',raw:{status_code:1,items:[item()]}}
 ])('does not invent a persistent capture from $label',async({raw})=>{const s=await setup('paid');h.fetch.mockImplementation(async()=>new Response(JSON.stringify(raw)));expect((await callback()).status).toBe(503);expect(await listEngineOperatorNotices(s.db)).toHaveLength(0);});
 it('does not promote a primary paid mismatch or an unsigned callback into extra-capture authority',async()=>{
  const s=await setup('paid');h.fetch.mockImplementation(async()=>new Response(JSON.stringify({items:[item({sale_payme_id:'primary_sale'})]})));
  expect((await callback('primary_sale')).status).toBe(503);expect(await listEngineOperatorNotices(s.db)).toHaveLength(0);
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('PAYME_WEBHOOK_ALLOW_IP_FALLBACK','false');
  expect((await callback('extra_sale',false)).status).toBe(403);expect(await listEngineOperatorNotices(s.db)).toHaveLength(0);
 });
});
