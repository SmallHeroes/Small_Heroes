import type { Metadata } from 'next';
import { Fredoka, Playpen_Sans_Hebrew } from 'next/font/google';
import { notFound } from 'next/navigation';
import { isDevEnvironment } from '@/lib/dev-only-guard';
import { isPersonalWizardPreviewEnabled } from '@/lib/personal-wizard/flags';
import { buildMvpMatrixResponse } from '@/lib/web/mvp-matrix-response';
import { getPersonalLandingContent, PERSONAL_COMPANION_ART, PERSONAL_COMPANION_LINES, PERSONAL_COMPANION_PAPER, PERSONAL_PRODUCT_METADATA } from '@/content/personal-landing';
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

// The preview's type voice (per Guy: childlike, bigger): Fredoka for the page, a hand for the spoken words.
const fredoka = Fredoka({ subsets: ['hebrew', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-fredoka', display: 'swap' });
const playpen = Playpen_Sans_Hebrew({ subsets: ['hebrew'], weight: ['400', '500', '600'], variable: '--font-playpen', display: 'swap' });
export const metadata: Metadata = { ...PERSONAL_PRODUCT_METADATA, title: 'הכיוון האישי החדש · תצוגה מקדימה', robots: { index: false, follow: false } };
export default function PersonalProductPage() {
  if (!isDevEnvironment() || !isPersonalWizardPreviewEnabled()) notFound();
  const { categories } = buildMvpMatrixResponse();
  const roster = resolvePersonalWizardOptions().companions;
  const offered = new Set(roster.map((companion) => companion.id));
  // Personal preview eligibility is asset-backed roster availability, not legacy topic sellability.
  const companions = categories.filter((slot) => offered.has(slot.companion.id)).map((slot) => ({ ...slot, publicVisible: true }));
  // The friends row shows every companion the wizard offers, by companion and in the wizard's order.
  const friends = roster.map(({ id, name, image }) => ({ id, name, line: PERSONAL_COMPANION_LINES[id] ?? '', image: PERSONAL_COMPANION_ART[id] ?? image, paper: PERSONAL_COMPANION_PAPER[id] }));
  return (
    <div className={`${fredoka.variable} ${playpen.variable}`}>
      <LandingPage content={getPersonalLandingContent()} startHref="/dev/personal-wizard" matrixCategories={companions} personalCompanions={friends} personalPreview />
    </div>
  );
}
