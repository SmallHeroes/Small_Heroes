/**
 * content/ui/he/common.ts
 * Shared brand strings, site metadata, and global error messages.
 * Used by: app/layout.tsx, all API routes, email templates.
 */

export const COMMON = {
  brand:           'גיבורים קטנים',
  tagline:         'סיפורי חוסן לילדים',
  navCta:          'אני רוצה לנסות',
  siteTitle:       'גיבורים קטנים',
  siteDescription: 'ספרי ילדים מותאמים אישית',

  errors: {
    missingOrder:  'פרטי ההזמנה חסרים. אנא חזרו לדף הראשי ונסו שוב.',
    orderNotFound: 'לא מצאנו את ההזמנה שלכם. אנא צרו קשר עם התמיכה.',
    loadFailed:    'הספר עדיין לא נטען. בדקו חיבור לאינטרנט ונסו שוב.',
    refreshPage:   'הטעינה מתעכבת מעט. רענון קצר בדרך כלל פותר את זה.',
    genericTitle:  'משהו השתבש בדרך',
    backToHome:    'חזרה לדף הבית',
  },
} as const;
