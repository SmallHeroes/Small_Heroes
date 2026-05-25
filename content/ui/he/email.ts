/**
 * content/ui/he/email.ts
 * Transactional email copy (book-ready notification).
 * Used by: backend/lib/email.ts
 */

export const EMAIL = {
  from:    'גיבורים קטנים <stories@gibborim-ktanim.co.il>',
  subject: (childName: string) => `✨ הסיפור של ${childName} מוכן!`,

  body: {
    greeting:  (customerName: string) => `שלום ${customerName},`,
    headline:  (childName: string)    => `✨ הסיפור של ${childName} מוכן!`,
    intro:     (childName: string)    => `יצרנו עבורכם סיפור אישי שבו ${childName} הוא הגיבור, עם דמות מאוירת בהשראת התמונה.`,
    btnRead:   '📖 לקריאת הסיפור',
    btnAudio:  '🎧 להאזנה לסיפור',
    btnPdf:    '📥 הורדת PDF',
    footer:    'גיבורים קטנים — סיפורי חוסן לילדים',
  },
} as const;
