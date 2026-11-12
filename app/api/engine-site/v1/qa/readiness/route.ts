import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { engineQaRequired, engineQaScope, engineQaMaxOrders } from '@/lib/engine-site/qa-order-policy';
import { engineSiteCheckoutEnabled } from '@/lib/engine-site/offer';
import { engineOrderIntakeEnabled } from '@/lib/engine-site/personal-orders';
import { configuredEngineSpendPolicy, engineProfileAuthority } from '@/lib/engine-site/platform-policy';
import { assertEnginePrivateDatabase, assertEnginePrivateStoragePolicy } from '@/lib/engine-site/private-assets';
import { engineFulfillmentEnabled } from '@/lib/engine-site/lifecycle-config';
import { findProdResourceLeak } from '@/lib/generation-chunked/env-separation-guard';

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
    credentials: Object.fromEntries(['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'ELEVENLABS_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
      'GENERATION_SECRET', 'DATABASE_URL', 'RESEND_API_KEY', 'VERCEL_AUTOMATION_BYPASS_SECRET'].map(name => [name, present(name)])),
  };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
