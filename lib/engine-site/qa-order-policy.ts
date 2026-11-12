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

/** QA orders: one session per parent draft, under a prefix; the legacy singleton id stays a QA id. */
export const ENGINE_QA_SESSION_PREFIX = 'engine-site-qa-order/v2/';
export const ENGINE_QA_FAKE_PROVIDER = 'qa_fake';
export const engineQaFakePaymentId = (orderId: string) => `qa_fake:${orderId}`;
export function isEngineQaSessionId(sessionId: string | null | undefined) {
  return sessionId === ENGINE_QA_SESSION_ID || (typeof sessionId === 'string' && /^engine-site-qa-order\/v2\/[a-f0-9]{64}$/.test(sessionId));
}
/** Explicit count of fictional QA orders this staging database may hold (default one). */
export function engineQaMaxOrders(env: Env = process.env) {
  const value = Number(env.ENGINE_SITE_QA_MAX_ORDERS ?? '1');
  return Number.isInteger(value) && value >= 1 && value <= 10 ? value : 1;
}

export function engineQaScope(env: Env = process.env) {
  const parentId = env.ENGINE_SITE_QA_PARENT_USER_ID;
  const projectRef = env.ENGINE_SITE_QA_SUPABASE_REF;
  const origin = 'https://' + env.ENGINE_SITE_STAGING_HOST;
  const mode = env.ENGINE_SITE_QA_PAYMENT ?? 'payme_sandbox';
  if (mode !== 'payme_sandbox' && mode !== 'fake') return null;
  const payment = mode as 'payme_sandbox' | 'fake';
  // Fake mode never talks to PayMe; any configured PayMe API must still be the Sandbox, never a live seller.
  const paymeBase = env.PAYME_API_BASE_URL?.trim().replace(/\/$/, ''), paymeOrigin = env.PAYME_CHECKOUT_PAGE_ORIGIN?.trim().replace(/\/$/, '');
  const paymeOk = payment === 'fake'
    ? (!paymeBase || paymeBase === PAYME_SANDBOX_API) && (!paymeOrigin || paymeOrigin === PAYME_SANDBOX_ORIGIN)
    : env.PAYMENT_PROVIDER === 'payme' && paymeBase === PAYME_SANDBOX_API && paymeOrigin === PAYME_SANDBOX_ORIGIN;
  if (env.ENGINE_SITE_ENVIRONMENT !== 'staging' || env.ENGINE_SITE_STAGING_ACCESS_ENABLED !== 'true' ||
      (env.VERCEL_ENV && env.VERCEL_ENV !== 'preview') || !parentId || !/^[\w-]{1,120}$/.test(parentId) ||
      env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') !== origin || !paymeOk ||
      !projectRef || !/^[a-z0-9]{20}$/.test(projectRef) ||
      env.SUPABASE_URL?.replace(/\/$/, '') !== `https://${projectRef}.supabase.co` ||
      env.PAYME_WEBHOOK_ALLOW_IP_FALLBACK === 'true' || env.PAYME_REDIRECT_TRUST_MODE === 'true') return null;
  try {
    if (findProdResourceLeak(env)) return null;
    assertEngineStorageProjectBinding(env.SUPABASE_URL, env.DATABASE_URL);
    if (env.DIRECT_URL) assertEngineStorageProjectBinding(env.SUPABASE_URL, env.DIRECT_URL);
    if (enforceEngineStagingAccess(new Request(origin + '/api/webhooks/payme', { method: 'POST' }), env)) return null;
    return { parentId, origin, payment };
  } catch {
    return null;
  }
}

export function isEngineQaOrder(scope: NonNullable<ReturnType<typeof engineQaScope>>, order: {
  userId: string | null;
  selectedVoice: string | null;
}, sessionId: string | undefined) {
  return order.userId === scope.parentId && order.selectedVoice === ENGINE_QA_VOICE && isEngineQaSessionId(sessionId);
}

/**
 * The only payment proofs an engine job may start from: a verified PayMe sale, or — inside a valid fake-payment
 * QA scope only — the QA operator's simulated payment for a fictional QA order. Never a refundable liability.
 */
export function engineOrderPaymentAccepted(order: { id: string; paymentProvider: string | null; paymeTransactionId: string | null; paymentId: string | null;
  userId: string | null; selectedVoice: string | null }, sessionId: string | undefined, env: Env = process.env) {
  if (order.paymentProvider === 'payme') return Boolean(order.paymeTransactionId);
  if (order.paymentProvider !== ENGINE_QA_FAKE_PROVIDER) return false;
  const qa = engineQaScope(env);
  return Boolean(qa && qa.payment === 'fake' && isEngineQaOrder(qa, order, sessionId) &&
    order.paymentId === engineQaFakePaymentId(order.id) && order.paymeTransactionId === null);
}

export function isPaymeSandboxCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return url.origin === PAYME_SANDBOX_ORIGIN && !url.username && !url.password;
  } catch {
    return false;
  }
}
