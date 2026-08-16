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
import './landing/motion.css';
import './landing/about.css';
import './category-challenge-card.css';
import './landing/wow-2027.css';
import './premium-2027.css';

export const metadata: Metadata = {
  title: 'גיבורים קטנים | ספר ילדים אישי שנבנה סביב הילד שלכם',
  description:
    'יוצרים ספר ילדים אישי בעברית עם עלילה, איורים וקריינות שנבנים סביב הילד שלכם ומה שמעסיק אותו עכשיו. בוחרים כיוון סיפור ויוצרים ספר שהוא באמת שלו.',
  alternates: { canonical: 'https://smallheroes.co.il/' },
  openGraph: {
    type: 'website',
    title: 'לא מכניסים את הילד שלכם לסיפור מוכן. בונים את הסיפור סביבו.',
    description:
      'ספר ילדים אישי, מאויר ומוקרא בעברית, שנבנה סביב הילד שלכם — לא רק עם השם שלו.',
    url: 'https://smallheroes.co.il/',
    locale: 'he_IL',
    siteName: 'גיבורים קטנים',
    images: [{ url: 'https://smallheroes.co.il/Images/DesktopHero.webp' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'לא מכניסים את הילד שלכם לסיפור מוכן. בונים את הסיפור סביבו.',
    description:
      'ספר ילדים אישי, מאויר ומוקרא בעברית, שנבנה סביב הילד שלכם — לא רק עם השם שלו.',
    images: ['https://smallheroes.co.il/Images/DesktopHero.webp'],
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
