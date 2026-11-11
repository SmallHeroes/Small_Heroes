import { resolveEngineWizardOptions } from '../personal-orders';
import { addTypedFact, buildReviewedRequest, confirmFactsReview, createDraft, setChildAddress, setChildAge,
  setChildName, setChildResidence, setCompanion, setIntent, setLength, setNoDifficulty, setVoice } from '@/lib/personal-wizard/draft';
const options = resolveEngineWizardOptions();
export const syntheticQaOrigin = 'https://staging.example.invalid';
export function syntheticEngineQaEnv() {
  return {
    ENGINE_SITE_ENVIRONMENT: 'staging', ENGINE_SITE_STAGING_ACCESS_ENABLED: 'true',
    ENGINE_SITE_STAGING_HOST: 'staging.example.invalid', ENGINE_SITE_STAGING_USER: 'synthetic',
    ENGINE_SITE_STAGING_PASSWORD: 'SYNTHETIC_NOT_A_REAL_SECRET_123', ENGINE_SITE_QA_PARENT_USER_ID: 'synthetic_parent',
    NEXT_PUBLIC_APP_URL: syntheticQaOrigin, VERCEL_ENV: 'preview', PAYMENT_PROVIDER: 'payme',
    PAYME_API_BASE_URL: 'https://sandbox.payme.io/api', PAYME_CHECKOUT_PAGE_ORIGIN: 'https://sandbox.payme.io',
    ENGINE_SITE_QA_SUPABASE_REF: 'abcdefghijklmnopqrst', SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    DATABASE_URL: 'postgresql://synthetic@db.abcdefghijklmnopqrst.supabase.co/postgres',
  };
}
export function syntheticEngineActivationEnv() {
  return { ...Object.fromEntries(['CHECKOUT', 'ORDER_INTAKE', 'WORKER', 'PROVIDERS', 'LONG_WORKER', 'READER', 'FULFILLMENT']
    .map(name => [`ENGINE_SITE_${name}_ENABLED`, 'true'])), ENGINE_SITE_SOURCE_REVISION: 'a'.repeat(40),
    ENGINE_SITE_SPEND_POLICY: JSON.stringify({ version: 'engine-site-spend-policy/v1', sourceRevision: 'a'.repeat(40),
      maximumMicroUsd: 10_000_000, maximumCalls: 200, approvalReference: 'SYNTHETIC_TEST_ONLY', approvedBy: 'synthetic_test',
      approvedAt: '2026-11-04T00:00:00.000Z', paidProviderActivation: 'owner_approved_live_personal_orders' }) };
}
export function syntheticEngineOrderInput(voice = 'mom', draftId = 'd_synthetic0001') {
  let draft = createDraft(draftId);
  draft = setChildAddress(setChildAge(setChildName(draft, 'סינתטי'), 5), 'boy');
  draft = setNoDifficulty(setChildResidence(draft, 'חיפה'), true);
  draft = addTypedFact(draft, 'interest', 'ציור', () => 'f_synthetic0001').draft;
  draft = setVoice(setLength(setIntent(setCompanion(confirmFactsReview(draft), 'panda_anat'), { kind: 'just_for_fun' }), 'short'), voice);
  const built = buildReviewedRequest(draft); if (!built.ok) throw Error('synthetic_invalid');
  return { version: 'engine-site-order-input/v1' as const, optionsFingerprint: options.fingerprint,
    request: built.request, appearance: { kind: 'description' as const, description: 'שיער חום קצר ועיניים חומות' } };
}
