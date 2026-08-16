import { Arimo, David_Libre, Frank_Ruhl_Libre, Heebo, Noto_Serif_Hebrew, Rubik } from 'next/font/google';
import localFont from 'next/font/local';
import { COMMON } from '@/content';

/*
 * Marketing heading face (Guy-approved; replaces the unlicensed Abraham).
 * Suez One: slab-serif Hebrew display — the "storybook publisher" voice.
 * Bundled locally (OFL license alongside) so builds never depend on a
 * build-time Google fetch for the identity face.
 */
const suezOne = localFont({
  src: '../public/Fonts/SuezOne-Regular.ttf',
  weight: '400',
  variable: '--font-suez',
  display: 'swap',
});

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-heebo',
  display: 'swap',
});

const arimo = Arimo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-arimo',
  display: 'swap',
});

/* Secondary UI face (chips, tags, numerals); headings belong to Suez One. */
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
      className={`${suezOne.variable} ${heebo.variable} ${rubik.variable} ${arimo.variable} ${frankRuhl.variable} ${davidLibre.variable} ${notoSerifHebrew.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
