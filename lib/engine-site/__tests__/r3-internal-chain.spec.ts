import {afterEach,describe,expect,it,vi} from 'vitest';
const fake=vi.hoisted(()=>({update:vi.fn(async()=>({})),order:vi.fn(async()=>null)}));
vi.mock('@/lib/prisma',()=>({prisma:{generationJob:{update:fake.update},order:{findUnique:fake.order,update:fake.update}}}));
import {chainGenerationWorker} from '@/lib/generation-chunked/chain-worker';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
describe('R3-4 real durable self-chain through the isolated staging gate',()=>{
 it('preserves worker Bearer auth, adds only the exact staging header, and never forwards a platform bypass or follows redirects',async()=>{
  for(const [key,value]of Object.entries({NODE_ENV:'production',VERCEL_ENV:'preview',VERCEL_URL:'staging.example.invalid',
   NEXT_PUBLIC_APP_URL:'https://staging.example.invalid',GENERATION_SECRET:'SYNTHETIC_WORKER_SECRET',ENGINE_SITE_ENVIRONMENT:'staging',
   ENGINE_SITE_STAGING_ACCESS_ENABLED:'true',ENGINE_SITE_STAGING_HOST:'staging.example.invalid',ENGINE_SITE_STAGING_USER:'synthetic',
   ENGINE_SITE_STAGING_PASSWORD:'SYNTHETIC_NOT_A_REAL_SECRET_123',VERCEL_AUTOMATION_BYPASS_SECRET:'SYNTHETIC_UNUSED_BYPASS'}))vi.stubEnv(key,value);
  const send=vi.fn(async()=>new Response('{}',{status:200}));vi.stubGlobal('fetch',send);
  chainGenerationWorker('synthetic_order');await vi.waitFor(()=>expect(fake.update).toHaveBeenCalledTimes(2));
  expect(send).toHaveBeenCalledOnce();const [url,options]=(send.mock.calls as unknown as [string,RequestInit][])[0];
  expect(url).toBe('https://staging.example.invalid/api/generate/worker');
  expect(options).toMatchObject({redirect:'manual',headers:{Authorization:'Bearer SYNTHETIC_WORKER_SECRET',
   'x-smallheroes-staging-access':'Basic '+btoa('synthetic:SYNTHETIC_NOT_A_REAL_SECRET_123')}});
  expect(options.headers).not.toHaveProperty('x-vercel-protection-bypass');
 });
});
