import 'server-only';
import { findProdResourceLeak } from '@/lib/generation-chunked/env-separation-guard';
import { enforceEngineStagingAccess } from './staging-access';
import { assertEngineStorageProjectBinding } from './storage-project';

type Env = Readonly<Record<string, string | undefined>>;
export const ENGINE_QA_SESSION_ID = 'engine-site-qa-order/v1/singleton';
export const ENGINE_QA_VOICE = 'dad_v2';
export const PAYME_SANDBOX_ORIGIN = 'https://sandbox.payme.io';
export const PAYME_SANDBOX_API = PAYME_SANDBOX_ORIGIN + '/api';

export function engineQaRequired(env: Env = process.env) {
  return env.ENGINE_SITE_ENVIRONMENT === 'staging' || env.ENGINE_SITE_STAGING_ACCESS_ENABLED === 'true' ||
    env.ENGINE_SITE_QA_PARENT_USER_ID !== undefined || env.ENGINE_SITE_QA_SUPABASE_REF !== undefined;
}

export function engineQaScope(env: Env = process.env) {
  const parentId = env.ENGINE_SITE_QA_PARENT_USER_ID;
  const projectRef = env.ENGINE_SITE_QA_SUPABASE_REF;
  const origin = 'https://' + env.ENGINE_SITE_STAGING_HOST;
  if (env.ENGINE_SITE_ENVIRONMENT !== 'staging' || env.ENGINE_SITE_STAGING_ACCESS_ENABLED !== 'true' ||
      (env.VERCEL_ENV && env.VERCEL_ENV !== 'preview') || !parentId || !/^[\w-]{1,120}$/.test(parentId) ||
      env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') !== origin ||
      env.PAYMENT_PROVIDER !== 'payme' || env.PAYME_API_BASE_URL?.trim().replace(/\/$/, '') !== PAYME_SANDBOX_API ||
      env.PAYME_CHECKOUT_PAGE_ORIGIN?.trim().replace(/\/$/, '') !== PAYME_SANDBOX_ORIGIN ||
      !projectRef || !/^[a-z0-9]{20}$/.test(projectRef) ||
      env.SUPABASE_URL?.replace(/\/$/, '') !== `https://${projectRef}.supabase.co` ||
      env.PAYME_WEBHOOK_ALLOW_IP_FALLBACK === 'true' || env.PAYME_REDIRECT_TRUST_MODE === 'true') return null;
  try {
    if (findProdResourceLeak(env)) return null;
    assertEngineStorageProjectBinding(env.SUPABASE_URL, env.DATABASE_URL);
    if (env.DIRECT_URL) assertEngineStorageProjectBinding(env.SUPABASE_URL, env.DIRECT_URL);
    if (enforceEngineStagingAccess(new Request(origin + '/api/webhooks/payme', { method: 'POST' }), env)) return null;
    return { parentId, origin };
  } catch {
    return null;
  }
}

export function isEngineQaOrder(scope: NonNullable<ReturnType<typeof engineQaScope>>, order: {
  userId: string | null;
  selectedVoice: string | null;
}, sessionId: string | undefined) {
  return order.userId === scope.parentId && order.selectedVoice === ENGINE_QA_VOICE && sessionId === ENGINE_QA_SESSION_ID;
}

export function isPaymeSandboxCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return url.origin === PAYME_SANDBOX_ORIGIN && !url.username && !url.password;
  } catch {
    return false;
  }
}
