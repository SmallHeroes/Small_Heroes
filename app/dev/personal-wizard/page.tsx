import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';

import { isDevEnvironment } from '@/lib/dev-only-guard';
import { isPersonalWizardPreviewEnabled } from '@/lib/personal-wizard/flags';
import { resolvePersonalWizardOptions } from '@/lib/personal-wizard/options';

import '../../../public/CSS/tokens.css';
import { PersonalWizard } from './PersonalWizard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'הספר האישי · אבטיפוס',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * Personal Wizard prototype (P1). Isolated preview route: no orders, payment, render or provider
 * call. Gated by middleware (/dev is 404 on real production), `isDevEnvironment()` and the
 * explicit PERSONAL_WIZARD_PREVIEW flag. Rollback: unset the flag.
 */
export default function PersonalWizardPage() {
  if (!isDevEnvironment() || !isPersonalWizardPreviewEnabled()) notFound();
  const { companions, topics, voices, packages } = resolvePersonalWizardOptions();
  return <PersonalWizard options={{ companions, topics, voices, packages }} liveIntake={false} />;
}
