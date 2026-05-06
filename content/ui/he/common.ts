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
    loadFailed:    'לא הצלחנו לטעון את הספר. אנא בדקו את החיבור לאינטרנט ונסו שוב.',
    refreshPage:   'משהו השתבש בטעינת הספר. אנא נסו לרענן את הדף.',
    genericTitle:  'משהו השתבש בדרך',
    backToHome:    'חזרה לדף הבית',
  },
} as const;
