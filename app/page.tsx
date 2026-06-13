import type { Metadata } from 'next';
import LandingPage from './landing/landing-page';
import { getLandingContent } from '@/content/landing';
import '../../public/CSS/main.css';
import '../../public/CSS/landing.css';

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
  const content = getLandingContent();
  return <LandingPage content={content} />;
}
