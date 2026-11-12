import { notFound } from 'next/navigation';
import { PersonalWizard } from '@/app/dev/personal-wizard/PersonalWizard';
import { engineOrderIntakeEnabled, resolveEngineWizardOptions } from '@/lib/engine-site/personal-orders';
import { engineSiteCheckoutEnabled } from '@/lib/engine-site/offer';
import { ENGINE_QA_VOICE, engineQaScope } from '@/lib/engine-site/qa-order-policy';
import '../../../public/CSS/tokens.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'הספר האישי | גיבורים קטנים', robots: { index: false, follow: false } };
export default function EnginePersonalWizardPage() {
  if (!engineOrderIntakeEnabled()) notFound();
  const options = resolveEngineWizardOptions();
  const qa = engineQaScope(), fictionalQa = qa !== null;
  const visibleOptions = fictionalQa ? { ...options, voices: options.voices.filter(voice => voice.id === ENGINE_QA_VOICE) } : options;
  return <PersonalWizard options={visibleOptions} launchOrder={{ optionsFingerprint: options.fingerprint,
    checkoutEnabled: engineSiteCheckoutEnabled(), fictionalQa, ...(qa?.payment === 'fake' ? { qaFakePayment: true } : {}) }} />;
}
