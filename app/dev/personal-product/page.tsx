import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isDevEnvironment } from '@/lib/dev-only-guard';
import { isPersonalWizardPreviewEnabled } from '@/lib/personal-wizard/flags';
import { buildMvpMatrixResponse } from '@/lib/web/mvp-matrix-response';
import { getPersonalLandingContent, PERSONAL_PRODUCT_METADATA } from '@/content/personal-landing';
import { resolvePersonalWizardOptions } from '@/lib/personal-wizard/options';
import LandingPage from '@/app/landing/landing-page';
import '@/app/landing/main.css';
import '@/app/landing/landing.css';
import '@/app/landing/motion.css';
import '@/app/landing/about.css';
import '@/app/category-challenge-card.css';
import '@/app/landing/wow-2027.css';
import '@/app/premium-2027.css';
import './personal-product.css';
import './personal-wow.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { ...PERSONAL_PRODUCT_METADATA, title: 'הכיוון האישי החדש · תצוגה מקדימה', robots: { index: false, follow: false } };
export default function PersonalProductPage() {
  if (!isDevEnvironment() || !isPersonalWizardPreviewEnabled()) notFound();
  const { categories } = buildMvpMatrixResponse();
  const offered = new Set(resolvePersonalWizardOptions().companions.map((companion) => companion.id));
  // Personal preview eligibility is asset-backed roster availability, not legacy topic sellability.
  const companions = categories.filter((slot) => offered.has(slot.companion.id)).map((slot) => ({ ...slot, publicVisible: true }));
  return <LandingPage content={getPersonalLandingContent()} startHref="/dev/personal-wizard" matrixCategories={companions} personalPreview />;
}
