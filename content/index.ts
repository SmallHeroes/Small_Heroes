/**
 * content/index.ts — Server-side content strings
 *
 * Mirrors the subset of public/JS/content.js needed by server-side code
 * (layout metadata, email templates, checkout labels).
 */

// ── COMMON — used by app/layout.tsx ────────────────────────────────
export const COMMON = {
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

export function checkoutProductDescription(
  storyLength: string,
  storyDirection?: string | null
): string {
  const byDirection: Record<string, string> = {
    bedtime: 'סיפור לפני שינה — 10 עמודים',
    adventure: 'הרפתקה — 15 עמודים',
    fantasy: 'מסע פלאי — 20 עמודים',
  };
  const dir = typeof storyDirection === 'string' ? storyDirection.trim().toLowerCase() : '';
  if (dir && byDirection[dir]) return byDirection[dir];

  const lengthLabel: Record<string, string> = {
    short:  'סיפור לפני שינה — 10 עמודים',
    medium: 'הרפתקה — 15 עמודים',
    long:   'מסע פלאי — 20 עמודים',
  };
  return lengthLabel[storyLength] || '15 עמודים';
}

export const CHECKOUT_ADDONS = {
  bundle: 'וידאו + קובץ להדפסה',
  audio:  'קריינות',
  pdf:    'קובץ מוכן להדפסה',
  video:  'וידאו + קריינות',
};
