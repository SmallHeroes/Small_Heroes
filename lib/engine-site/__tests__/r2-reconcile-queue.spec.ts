import { afterEach,describe,expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
const m=vi.hoisted(()=>({db:null as any,reconcile:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:new Proxy({},{get(_t,k){if(!m.db)throw Error('live_database_forbidden');return m.db[k];}})}));
vi.mock('@/lib/engine-site/fulfillment',async original=>({...await original<any>(),reconcileEngineBook:m.reconcile}));
vi.mock('@/lib/engine-site/private-storage',async original=>({...await original<any>(),productionEnginePrivateStorage:()=>({read(){throw Error('no_bytes_needed');}})}));
import { GET } from '@/app/api/engine-site/v1/cron/reconcile/route';
import { engineTestDb } from './engine-test-db';
const stores:Awaited<ReturnType<typeof engineTestDb>>[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.pg.close();vi.unstubAllEnvs();vi.clearAllMocks();});
describe('R2 P3 actual reconcile SQL with no-write oldest rows',()=>{
  it('a waiting/backoff row cannot block a later eligible book',async()=>{
    const s=await engineTestDb();stores.push(s);m.db=s.db;
    vi.stubEnv('ENGINE_SITE_FULFILLMENT_ENABLED','true');vi.stubEnv('CRON_SECRET','SYNTHETIC');vi.stubEnv('NEXT_PUBLIC_APP_URL','https://app.example.invalid');
    await s.pg.exec(`UPDATE "Order" SET status='generating'; INSERT INTO "GenerationJob"("orderId","currentStage","updatedAt") VALUES('synthetic_order','engine_site_accept',now()-interval '1 hour');
      INSERT INTO "Order"(id,status) VALUES('synthetic_next','generating');
      INSERT INTO "GenerationJob"("orderId","currentStage") VALUES('synthetic_next','engine_site_accept');`);
    m.reconcile.mockImplementation(async(_db,id)=>({status:id==='synthetic_order'?'retry_scheduled':'operator_review'}));
    const response=await GET(new NextRequest('https://app.example.invalid/cron',{headers:{authorization:'Bearer SYNTHETIC'}}));
    expect(response.status).toBe(200);expect(m.reconcile.mock.calls.map(c=>c[1])).toContain('synthetic_next');
  });
});
