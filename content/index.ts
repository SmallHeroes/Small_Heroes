/**
 * content/index.ts — Server-side content strings
 *
 * Mirrors the subset of public/JS/content.js needed by server-side code
 * (layout metadata, email templates, checkout labels).
 */

import { DIRECTION_PAGE_MAP, displayPagesForBeats } from '../backend/config/wizard';

// ── COMMON — used by app/layout.tsx ────────────────────────────────
export const COMMON = {
  brand:           'גיבורים קטנים',
  tagline:         'סיפורי חוסן לילדים',
  navCta:          'ליצירת הספר',
  siteTitle:       'גיבורים קטנים — ספרי ילדים אישיים',
  siteDescription: 'ספר ילדים מותאם אישית שנכתב סביב מה שהילד שלכם עובר עכשיו — עם דמות שדומה לו, סיפור שהוא מזדהה איתו, וסוף שנותן לו כוח.',
};

// ── EMAIL — used by backend/lib/email.ts ───────────────────────────
export const EMAIL = {
  from: 'גיבורים קטנים <noreply@smallheroes.co.il>',
  subject: (childName: string) => `הספר של ${childName} מוכן!`,
  body: {
    greeting:  (name: string)      => `שלום ${name},`,
    headline:  (childName: string) => `הספר של ${childName} מוכן!`,
    intro:     (childName: string) => `הספר האישי של ${childName} מוכן לצפייה. לחצו על הכפתור כדי לפתוח אותו:`,
    btnRead:   'פתחו את הספר',
    btnAudio:  'האזנה לקריינות',
    btnPdf:    'הורדת PDF להדפסה',
    footer:    'גיבורים קטנים — סיפורי חוסן לילדים',
  },
};

// ── CHECKOUT — used by app/api/checkout/route.ts ───────────────────
export function checkoutProductName(childName: string): string {
  return `ספר אישי עבור ${childName}`;
}

// Customer-facing page numbers = PHYSICAL pages (beats × 2), derived from the
// canonical beat map via the single displayPagesForBeats() helper.
function physicalPagesFor(direction: string): number {
  return displayPagesForBeats(DIRECTION_PAGE_MAP[direction]?.pages ?? 0);
}

export function checkoutProductDescription(
  storyLength: string,
  storyDirection?: string | null
): string {
  const byDirection: Record<string, string> = {
    bedtime: `סיפור לפני שינה — ${physicalPagesFor('bedtime')} עמודים`,
    adventure: `הרפתקה — ${physicalPagesFor('adventure')} עמודים`,
    fantasy: `מסע פלאי — ${physicalPagesFor('fantasy')} עמודים`,
  };
  const dir = typeof storyDirection === 'string' ? storyDirection.trim().toLowerCase() : '';
  if (dir && byDirection[dir]) return byDirection[dir];

  // Legacy lengths map to the same directions (a NEW checkout with a legacy
  // session still receives a canonical-length book).
  const lengthLabel: Record<string, string> = {
    short:  byDirection.bedtime,
    medium: byDirection.adventure,
    long:   byDirection.fantasy,
  };
  return lengthLabel[storyLength] || byDirection.adventure;
}

export const CHECKOUT_ADDONS = {
  bundle: 'וידאו + קובץ להדפסה',
  audio:  'קריינות',
  pdf:    'קובץ מוכן להדפסה',
  video:  'וידאו + קריינות',
};
