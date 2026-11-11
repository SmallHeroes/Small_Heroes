import localFont from 'next/font/local';
import { COMMON } from '@/content';

/*
 * Marketing type is Rubik end to end (per Guy — the Secular One display run
 * was reverted; Rubik simply works better until a new display face is
 * chosen). Its variable axis covers the heading scale: H1 800, H2 600.
 * Secular One is no longer loaded, so nothing ships an unused webfont.
 */

/* Suez One stays loaded for the reader/book surfaces that reference it. */
const suezOne = localFont({
  src: '../public/Fonts/SuezOne-Regular.ttf',
  weight: '400',
  variable: '--font-suez',
  display: 'swap',
});

const heebo = localFont({
  src: './fonts/heebo/Heebo-Variable.ttf',
  weight: '400 600',
  variable: '--font-heebo',
  display: 'swap',
});

const arimo = localFont({
  src: './fonts/arimo/Arimo-Variable.ttf',
  weight: '400 700',
  variable: '--font-arimo',
  display: 'swap',
  preload: false,
});

/* Secondary UI face (chips, tags, numerals); headings belong to Suez One. */
const rubik = localFont({
  src: './fonts/rubik/Rubik-Variable.ttf',
  weight: '300 900',
  variable: '--font-rubik',
  display: 'swap',
});

/** Body story prose — weight 400 for narrative; 500 emphasis; not for headings. */
const frankRuhl = localFont({
  src: './fonts/frankruhllibre/FrankRuhlLibre-Variable.ttf',
  weight: '400 500',
  variable: '--font-frank',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

/**
 * Display titles / running headers until ABRAHAM (Fontef) is licensed.
 * @see lib/book-layout/typography-tokens.ts
 */
const davidLibre = localFont({
  src: [
    { path: './fonts/davidlibre/DavidLibre-Regular.ttf', weight: '400' },
    { path: './fonts/davidlibre/DavidLibre-Medium.ttf', weight: '500' },
    { path: './fonts/davidlibre/DavidLibre-Bold.ttf', weight: '700' },
  ],
  variable: '--font-david',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

const notoSerifHebrew = localFont({
  src: './fonts/notoserifhebrew/NotoSerifHebrew-Variable.ttf',
  weight: '400 700',
  variable: '--font-noto-serif-hebrew',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
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
      className={`${suezOne.variable} ${heebo.variable} ${rubik.variable} ${arimo.variable} ${frankRuhl.variable} ${davidLibre.variable} ${notoSerifHebrew.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
