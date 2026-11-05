import {afterEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const h=vi.hoisted(()=>({db:null as any}));
vi.mock('@/lib/prisma',()=>({prisma:new Proxy({}, {get:(_,k)=>h.db[k]})}));
vi.mock('@/lib/env',()=>({env:{PAYMENT_PROVIDER:'payme',PAYME_REDIRECT_TRUST_MODE:false}}));
vi.mock('@/app/api/generate/trigger',()=>({triggerGeneration:async()=>{}}));
vi.mock('@/lib/coupon/coupon-service',()=>({confirmCouponForOrder:async()=>null,couponConfirmFenceReason:async()=>null}));
vi.mock('@/lib/human-qa/sync-hold-case',()=>({syncHumanQaHoldCasePostCommit:async()=>{}}));
import {r4TestDb as engineTestDb} from './r4-test-db';
import {GET} from '@/app/api/payme/return/route';
import {recordEnginePaymentProofRefusal,clearEnginePaymentProofRefusal} from '../payment-proof-alert';
import {listEngineOperatorNotices} from '../operator-notices';
const stores:Awaited<ReturnType<typeof engineTestDb>>[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.pg.close();vi.unstubAllEnvs();vi.unstubAllGlobals();});
const item=()=>({sale_payme_id:'sale_b',transaction_id:'synthetic_order',sale_price:5900,sale_currency:'ILS',sale_status:'completed'});
async function setup(raw:unknown){const s=await engineTestDb();stores.push(s);h.db=s.db;vi.stubEnv('PAYME_API_BASE_URL','https://payme.example.invalid/api');vi.stubEnv('PAYME_API_KEY','SYNTHETIC_ONLY');
 await s.db.order.update({where:{id:'synthetic_order'},data:{status:'pending_payment',paymentId:'sale_b',totalPrice:5900}});vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(raw))));return s;}
const go=()=>GET(new NextRequest('https://app.example.invalid/api/payme/return?orderId=synthetic_order&status=paid&paymentId=forged'));
describe('R4 actual return route and real proof/notice SQL',()=>{
 it.each([{items:[]},{items:[item(),item()]},{sale_status:'paid'},{items:[null]},{status_code:1,items:[item()]},{items:[{...item(),sale_status:'initial'}]},{items:[{...item(),sale_status:'initial',sale_currency:''}]},{items:[{...item(),sale_status:'refunded'}]}])('ambiguous/nonpaid response never raises a proof-refused notice %j',async raw=>{
  const s=await setup(raw);await go();expect(await listEngineOperatorNotices(s.db)).toHaveLength(0);expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.status).toBe('pending_payment');
 });
 it('raises a first definitive amount mismatch, using only the stored sale',async()=>{const s=await setup({items:[{...item(),sale_price:1}]});await go();expect(await listEngineOperatorNotices(s.db)).toHaveLength(1);});
 it('settling renewed sale B closes every old sale-A notice',async()=>{const s=await setup({items:[item()]});await recordEnginePaymentProofRefusal(s.db,'synthetic_order','sale_a');await go();expect((await s.db.order.findUnique({where:{id:'synthetic_order'}}))!.status).toBe('paid');expect(await listEngineOperatorNotices(s.db)).toHaveLength(0);});
 it('a terminal order closes every proof case, preserving money and book state',async()=>{const s=await setup({items:[]});await recordEnginePaymentProofRefusal(s.db,'synthetic_order','sale_a');await s.db.order.update({where:{id:'synthetic_order'},data:{status:'failed'}});const before=await s.db.order.findUnique({where:{id:'synthetic_order'}});await clearEnginePaymentProofRefusal(s.db,'synthetic_order','sale_b');expect(await listEngineOperatorNotices(s.db)).toHaveLength(0);expect(await s.db.order.findUnique({where:{id:'synthetic_order'}})).toEqual(before);});
});
