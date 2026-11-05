import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state=vi.hoisted(()=>({db:null as any}));
vi.mock('@/lib/prisma',()=>({prisma:new Proxy({},{get(_t,k){if(!state.db)throw Error('live_database_forbidden');return state.db[k];}})}));
vi.mock('@/lib/generation-pipeline/readiness-manifest',async original=>({...await original<any>(),isReadinessManifestEnabled:()=>false}));
vi.mock('@/backend/lib/email',()=>({sendBookReadyEmail:vi.fn(),sendRefundNoticeEmail:vi.fn(),getBookReadyEmailDeliveryState:vi.fn()}));
vi.mock('@/lib/env',()=>({env:{}}));
import { engineTestDb } from './engine-test-db';
import { GET } from '@/app/api/generate/cron/exceptions/route';
import { claimDueExceptionCases } from '@/lib/generation-chunked/exception-case';
const stores:Awaited<ReturnType<typeof engineTestDb>>[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.pg.close();state.db=null;vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('R2-1 actual engine-only cron and legacy quarantine boundary',()=>{
  it('M15 claims require both a personal scope and personal owning order and exclude manual cases',async()=>{
    const s=await engineTestDb();stores.push(s);
    await s.pg.exec(`INSERT INTO "Order"(id,status,"frozenProductVersion") VALUES('legacy_owner','failed','legacy/v1');
      INSERT INTO "ExceptionCase"(id,"activeKey","orderId",scope,kind,status,reason,resolution) VALUES
      ('wrong_owner','legacy_owner:engine_site_book','legacy_owner','engine_site_book','quality_failed','refund_pending','synthetic',NULL),
      ('wrong_scope','synthetic_order:legacy_scope','synthetic_order','legacy_scope','quality_failed','refund_pending','synthetic',NULL),
      ('manual','synthetic_order:engine_site_infrastructure','synthetic_order','engine_site_infrastructure','infra_transient','open','synthetic','{"operatorRequired":true}'),
      ('personal_due','synthetic_order:engine_site_book','synthetic_order','engine_site_book','quality_failed','refund_pending','synthetic',NULL);`);
    const claimed=await claimDueExceptionCases(s.db,new Date(),10,true);
    expect(claimed.map(row=>row.id)).toEqual(['personal_due']);
    const remaining=(await s.pg.query<{id:string;attempts:number}>('SELECT id,attempts FROM "ExceptionCase" WHERE id<>\'personal_due\' ORDER BY id')).rows;
    expect(remaining.map(row=>row.attempts)).toEqual([0,0,0]);
  });
  it('does not synthesize, claim, redrive or refund legacy failures or cases when readiness is off',async()=>{
    const s=await engineTestDb();stores.push(s);state.db=s.db;
    vi.stubEnv('CRON_SECRET','SYNTHETIC_CRON');vi.stubEnv('ENGINE_SITE_FULFILLMENT_ENABLED','true');
    vi.stubGlobal('fetch',()=>{throw Error('live_network_forbidden');});
    await s.pg.exec(`INSERT INTO "Order"(id,status,"frozenProductVersion") VALUES('legacy_failed','failed','legacy/v1');
      INSERT INTO "GenerationJob"("orderId",status,"currentStage","failedAt") VALUES('legacy_failed','failed','failed',now());
      INSERT INTO "ExceptionCase"(id,"activeKey","orderId",scope,kind,status,reason,"nextActionAt")
        VALUES('legacy_case','legacy_failed:legacy_scope','legacy_failed','legacy_scope','infra_transient','retry_scheduled','synthetic',now()-interval '1 minute');`);
    const before=(await s.pg.query('SELECT * FROM "ExceptionCase" ORDER BY id')).rows;
    const response=await GET(new NextRequest('https://app.example.invalid/cron',{headers:{authorization:'Bearer SYNTHETIC_CRON'}}));
    expect(response.status).toBe(200);expect(await response.json()).toMatchObject({synced:0,claimed:0});
    expect((await s.pg.query('SELECT * FROM "ExceptionCase" ORDER BY id')).rows).toEqual(before);
    expect((await s.db.order.findUnique({where:{id:'legacy_failed'}}))!.status).toBe('failed');
  });
});
