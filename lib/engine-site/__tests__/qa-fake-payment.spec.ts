import { describe, expect, it } from 'vitest';
import { ENGINE_QA_FAKE_PROVIDER, ENGINE_QA_SESSION_ID, ENGINE_QA_VOICE, engineOrderPaymentAccepted, engineQaFakePaymentId,
  engineQaMaxOrders, engineQaScope, isEngineQaSessionId } from '../qa-order-policy';

const ref = 'qvksgpzzosotubcbizay', host = 'qa-preview.example.vercel.app';
const base = {
  ENGINE_SITE_ENVIRONMENT: 'staging', ENGINE_SITE_STAGING_ACCESS_ENABLED: 'true', VERCEL_ENV: 'preview',
  ENGINE_SITE_STAGING_HOST: host, NEXT_PUBLIC_APP_URL: `https://${host}`, ENGINE_SITE_STAGING_USER: 'qa',
  ENGINE_SITE_STAGING_PASSWORD: 'synthetic-password-0123456789', ENGINE_SITE_QA_PARENT_USER_ID: 'parent_1',
  ENGINE_SITE_QA_SUPABASE_REF: ref, SUPABASE_URL: `https://${ref}.supabase.co`,
  DATABASE_URL: `postgresql://postgres.${ref}:x@aws-0.pooler.supabase.com:6543/postgres`,
};
const fakeEnv = { ...base, ENGINE_SITE_QA_PAYMENT: 'fake' };
const session = 'engine-site-qa-order/v2/' + 'a'.repeat(64);
const order = (patch: Record<string, unknown> = {}) => ({ id: 'order_1', paymentProvider: ENGINE_QA_FAKE_PROVIDER, paymeTransactionId: null,
  paymentId: engineQaFakePaymentId('order_1'), userId: 'parent_1', selectedVoice: ENGINE_QA_VOICE, ...patch });

describe('fake-payment QA scope', () => {
  it('binds only on the staging Preview with an isolated database and never needs a PayMe seller', () => {
    expect(engineQaScope(fakeEnv)).toMatchObject({ parentId: 'parent_1', origin: `https://${host}`, payment: 'fake' });
    expect(engineQaScope(base)).toBeNull(); // Sandbox mode still requires the full PayMe Sandbox configuration.
    expect(engineQaScope({ ...fakeEnv, ENGINE_SITE_QA_PAYMENT: 'live' })).toBeNull();
    expect(engineQaScope({ ...fakeEnv, VERCEL_ENV: 'production' })).toBeNull();
    expect(engineQaScope({ ...fakeEnv, PAYME_API_BASE_URL: 'https://live.payme.io/api' })).toBeNull();
    expect(engineQaScope({ ...fakeEnv, DATABASE_URL: 'postgresql://postgres.yevwpjxqusyyaxalbvyn:x@db/postgres' })).toBeNull();
  });
  it('accepts a simulated payment only for the QA parent\'s own fictional QA order inside fake mode', () => {
    expect(engineOrderPaymentAccepted(order(), session, fakeEnv)).toBe(true);
    expect(engineOrderPaymentAccepted(order(), ENGINE_QA_SESSION_ID, fakeEnv)).toBe(true);
    expect(engineOrderPaymentAccepted(order(), 'engine-site-order/v1/' + 'a'.repeat(64), fakeEnv)).toBe(false);
    expect(engineOrderPaymentAccepted(order({ userId: 'someone_else' }), session, fakeEnv)).toBe(false);
    expect(engineOrderPaymentAccepted(order({ paymentId: 'qa_fake:other' }), session, fakeEnv)).toBe(false);
    expect(engineOrderPaymentAccepted(order({ paymeTransactionId: 'sale_1' }), session, fakeEnv)).toBe(false);
    expect(engineOrderPaymentAccepted(order(), session, { ...fakeEnv, ENGINE_SITE_QA_PAYMENT: 'payme_sandbox' })).toBe(false);
    expect(engineOrderPaymentAccepted(order(), session, {})).toBe(false);
    expect(engineOrderPaymentAccepted(order({ paymentProvider: 'fake' }), session, fakeEnv)).toBe(false);
  });
  it('keeps the PayMe rule unchanged', () => {
    expect(engineOrderPaymentAccepted(order({ paymentProvider: 'payme', paymeTransactionId: 'sale_1' }), undefined, {})).toBe(true);
    expect(engineOrderPaymentAccepted(order({ paymentProvider: 'payme', paymeTransactionId: null }), undefined, {})).toBe(false);
  });
  it('recognizes QA sessions and bounds the QA order count', () => {
    expect(isEngineQaSessionId(ENGINE_QA_SESSION_ID)).toBe(true);
    expect(isEngineQaSessionId(session)).toBe(true);
    expect(isEngineQaSessionId('engine-site-qa-order/v2/short')).toBe(false);
    expect(isEngineQaSessionId(undefined)).toBe(false);
    expect(engineQaMaxOrders({})).toBe(1);
    expect(engineQaMaxOrders({ ENGINE_SITE_QA_MAX_ORDERS: '3' })).toBe(3);
    expect(engineQaMaxOrders({ ENGINE_SITE_QA_MAX_ORDERS: '50' })).toBe(1);
  });
});
