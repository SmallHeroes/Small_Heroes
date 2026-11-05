import {describe,expect,it} from 'vitest';
import {enforceEngineStagingAccess,engineStagingInternalHeaders} from '../staging-access';
import {middleware} from '@/middleware';
import {NextRequest} from 'next/server';
import {afterEach,vi} from 'vitest';
afterEach(()=>vi.unstubAllEnvs());
const env={ENGINE_SITE_STAGING_ACCESS_ENABLED:'true',ENGINE_SITE_ENVIRONMENT:'staging',ENGINE_SITE_STAGING_HOST:'staging.example.invalid',
 ENGINE_SITE_STAGING_USER:'synthetic',ENGINE_SITE_STAGING_PASSWORD:'SYNTHETIC_NOT_A_REAL_SECRET_123'};
describe('R3-4 option A isolated staging application gate, no platform bypass token',()=>{
 it('is inert while disabled',async()=>expect(await enforceEngineStagingAccess(new Request('https://example.invalid/'),{})).toBeNull());
 it('preserves real-production dev/debug404s even if staging variables are accidentally present',()=>{
  for(const [key,value]of Object.entries({...env,NODE_ENV:'production',VERCEL_ENV:'production',VERCEL:'1'}))vi.stubEnv(key,value);
  for(const path of ['/api/debug/regen-page','/api/dev/fake-payment/confirm','/dev/personal-wizard'])
   expect(middleware(new NextRequest('https://staging.example.invalid'+path)).status).toBe(404);
 });
 it.each(['/','/wizard/personal','/api/engine-site/v1/orders','/_next/static/file.js','/api/webhooks/payme'])('protects %s without authorization',async path=>{
  const response=await enforceEngineStagingAccess(new Request('https://staging.example.invalid'+path),env);expect(response?.status).toBe(401);
  expect(response?.headers.get('cache-control')).toBe('private, no-store');
 });
 it('admits exact dedicated credentials without changing the request or returning a secret',async()=>{
  const req=new Request('https://staging.example.invalid/wizard/personal',{headers:{authorization:'Basic '+btoa(env.ENGINE_SITE_STAGING_USER+':'+env.ENGINE_SITE_STAGING_PASSWORD)}});
  expect(await enforceEngineStagingAccess(req,env)).toBeNull();
 });
 it('admits only POST to the exact PayMe webhook transport, retaining downstream signature validation',async()=>{
  expect(await enforceEngineStagingAccess(new Request('https://staging.example.invalid/api/webhooks/payme',{method:'POST'}),env)).toBeNull();
  expect((await enforceEngineStagingAccess(new Request('https://staging.example.invalid/api/webhooks/payme/other',{method:'POST'}),env))?.status).toBe(401);
 });
 it('authenticates internal calls in a separate header without replacing their Bearer secret or leaking across origins',()=>{
  const headers={authorization:'Bearer SYNTHETIC_CRON',...engineStagingInternalHeaders('https://staging.example.invalid',env)};
  expect(headers.authorization).toBe('Bearer SYNTHETIC_CRON');
  expect(enforceEngineStagingAccess(new Request('https://staging.example.invalid/api/engine-site/v1/cron/reconcile',{headers}),env)).toBeNull();
  expect(()=>engineStagingInternalHeaders('https://other.example.invalid',env)).toThrow('engine_staging_target_invalid');
 });
 it.each([{ENGINE_SITE_ENVIRONMENT:'production'},{ENGINE_SITE_STAGING_PASSWORD:''},{ENGINE_SITE_STAGING_HOST:'other.example.invalid'}])('fails closed for bad staging configuration %j',async change=>{
  const response=await enforceEngineStagingAccess(new Request('https://staging.example.invalid/api/webhooks/payme',{method:'POST'}),{...env,...change});
  expect(response?.status).toBe(503);expect(await response?.text()).not.toContain(env.ENGINE_SITE_STAGING_PASSWORD);
 });
});
