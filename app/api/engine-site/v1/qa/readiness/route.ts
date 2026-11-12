import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { engineQaRequired, engineQaScope, engineQaMaxOrders } from '@/lib/engine-site/qa-order-policy';
import { engineSiteCheckoutEnabled } from '@/lib/engine-site/offer';
import { engineOrderIntakeEnabled } from '@/lib/engine-site/personal-orders';
import { configuredEngineSpendPolicy, engineProfileAuthority } from '@/lib/engine-site/platform-policy';
import { assertEnginePrivateDatabase, assertEnginePrivateStoragePolicy } from '@/lib/engine-site/private-assets';
import { engineFulfillmentEnabled } from '@/lib/engine-site/lifecycle-config';
import { findProdResourceLeak } from '@/lib/generation-chunked/env-separation-guard';
import { createClient } from '@supabase/supabase-js';
import { ENGINE_PRIVATE_BUCKET } from '@/lib/engine-site/private-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const present = (name: string) => typeof process.env[name] === 'string' && process.env[name]!.trim().length > 0;
const ok = async (check: () => unknown) => { try { await check(); return true; } catch { return false; } };

/**
 * QA Preview only: booleans, never values. Lets the operator confirm the deployment's wiring (scope, database
 * privacy, policy, credentials present) before any order. 404 on every non-QA deployment.
 */
export async function GET() {
  if (!engineQaRequired()) return NextResponse.json({ error: 'unavailable' }, { status: 404 });
  const qa = engineQaScope();
  let policy: ReturnType<typeof configuredEngineSpendPolicy> | null = null;
  try { policy = configuredEngineSpendPolicy(); } catch { policy = null; }
  const profile = policy ? engineProfileAuthority(policy) : {};
  const body = {
    qaScope: qa !== null, payment: qa?.payment ?? null, maxOrders: engineQaMaxOrders(),
    productionResourceLeak: findProdResourceLeak(process.env) !== null,
    flags: { checkout: engineSiteCheckoutEnabled(), intake: engineOrderIntakeEnabled(), fulfillment: engineFulfillmentEnabled() },
    spendPolicy: policy ? { valid: true, revisionMatches: true, maximumUsd: policy.maximumMicroUsd / 1e6, maximumCalls: policy.maximumCalls,
      currentEngine: 'currentEngine' in profile, imageModel: policy.engineProfile?.imageModelPolicy ?? null } : { valid: false },
    database: { private: await ok(() => assertEnginePrivateDatabase(prisma)), storagePolicy: await ok(() => assertEnginePrivateStoragePolicy(prisma)) },
    // The service-role client can see the private bucket (proves the storage credential belongs to this project).
    privateBucket: await ok(async () => {
      const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw Error('missing');
      const result = await createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.getBucket(ENGINE_PRIVATE_BUCKET);
      if (result.error || result.data?.public !== false) throw Error('bucket');
    }),
    credentials: Object.fromEntries(['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'ELEVENLABS_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
      'GENERATION_SECRET', 'DATABASE_URL', 'RESEND_API_KEY', 'VERCEL_AUTOMATION_BYPASS_SECRET'].map(name => [name, present(name)])),
  };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
