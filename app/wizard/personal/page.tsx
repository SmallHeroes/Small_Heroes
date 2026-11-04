import { notFound } from 'next/navigation';
import { PersonalWizard } from '@/app/dev/personal-wizard/PersonalWizard';
import { engineOrderIntakeEnabled, resolveEngineWizardOptions } from '@/lib/engine-site/personal-orders';
import { engineSiteCheckoutEnabled } from '@/lib/engine-site/offer';
import '../../../public/CSS/tokens.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'הספר האישי | גיבורים קטנים', robots: { index: false, follow: false } };
export default function EnginePersonalWizardPage() {
  if (!engineOrderIntakeEnabled()) notFound();
  const options = resolveEngineWizardOptions();
  return <PersonalWizard options={options} launchOrder={{ optionsFingerprint: options.fingerprint,
    checkoutEnabled: engineSiteCheckoutEnabled() }} />;
}
