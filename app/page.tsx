import type { Metadata } from 'next';
import LandingPage from './landing/landing-page';
import { getLandingContent } from '@/content/landing';
import { ROUTES } from '@/lib/routes';
import { buildMvpMatrixResponse } from '@/lib/web/mvp-matrix-response';
/**
 * Landing styles — copied from public/CSS/{main,landing}.css (App Router cannot
 * import from public/). Legacy HTML shells still link public/CSS/* directly;
 * keep both copies in sync until legacy pages are retired.
 */
import './landing/main.css';
import './landing/landing.css';
import './category-challenge-card.css';

export const metadata: Metadata = {
  title: 'גיבורים קטנים — ספרי ילדים מותאמים אישית לחיזוק רגשי',
  description:
    'צרו ספר ילדים מותאם אישית — סיפור ואיורים סביב מה שהילד עובר עכשיו: פחד לפני שינה, ביקור רפואי, אח חדש, מעבר בבית או בגן. שאלון קצר, ספר דיגיטלי בעברית.',
  alternates: { canonical: 'https://smallheroes.co.il/' },
  openGraph: {
    type: 'website',
    title: 'גיבורים קטנים — ספר ילדים מותאם אישית',
    description:
      'סיפור אישי עם איורים מקוריים, שם הילד/ה, ודמות מלווה — ספר שנבנה במיוחד בשבילכם.',
    url: 'https://smallheroes.co.il/',
    locale: 'he_IL',
    siteName: 'גיבורים קטנים',
    images: [{ url: 'https://smallheroes.co.il/Images/HeroIllustrated.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'גיבורים קטנים — ספר ילדים מותאם אישית',
    description:
      'סיפור אישי עם איורים מקוריים, שם הילד/ה, ודמות מלווה — ספר שנבנה במיוחד בשבילכם.',
    images: ['https://smallheroes.co.il/Images/HeroIllustrated.png'],
  },
};

export default function HomePage() {
  const matrix = buildMvpMatrixResponse();
  const content = getLandingContent(matrix.categories);
  return (
    <LandingPage
      content={content}
      startHref={ROUTES.start}
      matrixCategories={matrix.categories}
    />
  );
}
