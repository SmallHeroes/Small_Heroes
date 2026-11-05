import {afterEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {engineTestDb} from './engine-test-db';
import {recordEnginePaymentProofRefusal,clearEnginePaymentProofRefusal} from '../payment-proof-alert';
import {recordEngineInfrastructureFault} from '../failure-policy';
import {listEngineOperatorNotices} from '../operator-notices';
import {handleEngineOperator} from '../operator-http';
const stores:Awaited<ReturnType<typeof engineTestDb>>[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.pg.close();vi.restoreAllMocks();});
describe('R3-7 actual durable in-app operator alerts, dedupe, authorization and no financial action',()=>{
 it('opens an alert on the first signed refusal, deduplicates it, and clears the visible item after verified proof',async()=>{
  const s=await engineTestDb();stores.push(s);await s.db.order.update({where:{id:'synthetic_order'},data:{status:'pending_payment'}});
  const before=await s.db.order.findUnique({where:{id:'synthetic_order'}}),warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
  await recordEnginePaymentProofRefusal(s.db,'synthetic_order','synthetic_sale');
  expect(await listEngineOperatorNotices(s.db)).toHaveLength(1);expect(warning).toHaveBeenCalledTimes(1);
  await recordEnginePaymentProofRefusal(s.db,'synthetic_order','synthetic_sale');expect(await listEngineOperatorNotices(s.db)).toHaveLength(1);
  expect(warning).toHaveBeenCalledTimes(1);expect(await s.db.order.findUnique({where:{id:'synthetic_order'}})).toEqual(before);
  expect(await s.db.refundAttempt.findMany()).toHaveLength(0);
  await s.db.order.update({where:{id:'synthetic_order'},data:{status:'paid'}});
  await clearEnginePaymentProofRefusal(s.db,'synthetic_order','synthetic_sale');expect(await listEngineOperatorNotices(s.db)).toHaveLength(0);
 });
 it('makes infrastructure alerts visible only to an authenticated allowlisted operator',async()=>{
  const s=await engineTestDb();stores.push(s);for(const delta of [-900_000,-720_000,0])await recordEngineInfrastructureFault(s.db,'synthetic_order','fulfillment',Error('synthetic_fault'),Date.now()+delta);
  const ports:any={db:s.db,parent:async()=>({id:'synthetic_operator'}),operatorIds:['synthetic_operator'],fulfillmentEnabled:true,storage:()=>({}),fulfillment:()=>({})};
  const request=()=>new NextRequest('https://app.example.invalid/api/engine-site/v1/review?view=cases');
  expect((await handleEngineOperator(request(),null,{...ports,operatorIds:[]})).status).toBe(404);
  const response=await handleEngineOperator(request(),null,ports);expect(response.status).toBe(200);
  const data=await response.json();expect(data.cases).toHaveLength(1);expect(data.cases[0]).toMatchObject({orderId:'synthetic_order',domain:'fulfillment'});
  expect(JSON.stringify(data)).not.toContain('parent@example.invalid');expect(response.headers.get('cache-control')).toBe('private, no-store');
 });
});
