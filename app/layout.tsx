import { David_Libre, Frank_Ruhl_Libre, Heebo, Noto_Serif_Hebrew, Rubik } from 'next/font/google';
import { COMMON } from '@/content';
import '../public/CSS/tokens.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heebo',
  display: 'swap',
});

/**
 * Design-system display face (replaces the unlicensed Abraham TTF).
 * Variable axis 300–900 in one file — headings use 800/900, prices use tnum digits.
 * Rubik Mono One was evaluated and rejected: no Hebrew subset (silent fallback).
 */
const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  weight: 'variable',
  variable: '--font-rubik',
  display: 'swap',
});

/** Body story prose — weight 400 for narrative; 500 emphasis; not for headings. */
const frankRuhl = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500'],
  variable: '--font-frank',
  display: 'swap',
});

/**
 * Display titles / running headers until ABRAHAM (Fontef) is licensed.
 * @see lib/book-layout/typography-tokens.ts
 */
const davidLibre = David_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-david',
  display: 'swap',
});

const notoSerifHebrew = Noto_Serif_Hebrew({
  subsets: ['hebrew'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-serif-hebrew',
  display: 'swap',
});

export const metadata = {
  title:       COMMON.siteTitle,
  description: COMMON.siteDescription,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} ${rubik.variable} ${frankRuhl.variable} ${davidLibre.variable} ${notoSerifHebrew.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
