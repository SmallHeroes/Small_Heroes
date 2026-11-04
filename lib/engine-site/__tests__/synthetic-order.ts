import { resolveEngineWizardOptions } from '../personal-orders';
import { addTypedFact, buildReviewedRequest, confirmFactsReview, createDraft, setChildAddress, setChildAge,
  setChildName, setChildResidence, setCompanion, setIntent, setLength, setNoDifficulty, setVoice } from '@/lib/personal-wizard/draft';
const options = resolveEngineWizardOptions();
export function syntheticEngineActivationEnv() {
  return { ...Object.fromEntries(['CHECKOUT', 'ORDER_INTAKE', 'WORKER', 'PROVIDERS', 'LONG_WORKER', 'READER', 'FULFILLMENT']
    .map(name => [`ENGINE_SITE_${name}_ENABLED`, 'true'])), ENGINE_SITE_SOURCE_REVISION: 'a'.repeat(40),
    ENGINE_SITE_SPEND_POLICY: JSON.stringify({ version: 'engine-site-spend-policy/v1', sourceRevision: 'a'.repeat(40),
      maximumMicroUsd: 10_000_000, maximumCalls: 200, approvalReference: 'SYNTHETIC_TEST_ONLY', approvedBy: 'synthetic_test',
      approvedAt: '2026-11-04T00:00:00.000Z', paidProviderActivation: 'owner_approved_live_personal_orders' }) };
}
export function syntheticEngineOrderInput() {
  let draft = createDraft('d_synthetic0001');
  draft = setChildAddress(setChildAge(setChildName(draft, 'סינתטי'), 5), 'boy');
  draft = setNoDifficulty(setChildResidence(draft, 'חיפה'), true);
  draft = addTypedFact(draft, 'interest', 'ציור', () => 'f_synthetic0001').draft;
  draft = setVoice(setLength(setIntent(setCompanion(confirmFactsReview(draft), 'panda_anat'), { kind: 'just_for_fun' }), 'short'), 'mom');
  const built = buildReviewedRequest(draft); if (!built.ok) throw Error('synthetic_invalid');
  return { version: 'engine-site-order-input/v1' as const, optionsFingerprint: options.fingerprint,
    request: built.request, appearance: { kind: 'description' as const, description: 'שיער חום קצר ועיניים חומות' } };
}
