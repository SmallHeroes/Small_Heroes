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
 * Personal Wizard prototype. Isolated preview route: no orders, payment or render. Gated by
 * middleware (/dev is 404 on real production), `isDevEnvironment()` and the explicit
 * PERSONAL_WIZARD_PREVIEW flag. Live intake (P2) is a further, separately gated server switch that
 * the client discovers through the status route. Rollback: unset the flags.
 */
export default function PersonalWizardPage() {
  if (!isDevEnvironment() || !isPersonalWizardPreviewEnabled()) notFound();
  const { companions, topics, voices, lengths } = resolvePersonalWizardOptions();
  return <PersonalWizard options={{ companions, topics, voices, lengths }} />;
}
