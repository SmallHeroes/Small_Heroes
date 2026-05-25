/**
 * content/ui/he/success.ts
 * Ready page and reader page copy.
 * "Ready" = book-is-done landing. "Reader" = page-by-page reading experience.
 */

export const READY = {
  pageTitle:         'גיבורים קטנים — הסיפור שלכם מוכן!',
  loadingText:       'טוענים את הספר שלכם...',
  headline:          'זה הסיפור שיצרנו עבורו',
  dedicationPrefix:  'הסיפור האישי של {name}',
  btnRead:           'לקריאה עכשיו',
  btnAudio:          '🎧 להאזין לסיפור',
  btnPdf:            'הורד PDF',
  saveHint:          'אפשר לחזור לסיפור הזה בכל זמן',
  copyLabel:         'העתקת הקישור',
  copiedLabel:       'הועתק! ✓',
  previewLabel:      'הצצה לתוך הספר',
  previewPageNum:    'עמוד ראשון',
  copyBtnAriaLabel:  'העתק קישור לספר',

  errors: {
    title:        'משהו השתבש בדרך',
    back:         'חזרה לדף הבית',
    notFound:     'לא מצאנו את ההזמנה שלכם. אנא צרו קשר עם התמיכה.',
    loadFailed:   'הספר עדיין לא נטען. רענון קצר בדרך כלל פותר את זה.',
    networkFail:  'יש כרגע הפרעה בחיבור. נסו שוב בעוד רגע.',
    missingOrder: 'פרטי ההזמנה חסרים. אנא חזרו לדף הראשי ונסו שוב.',
  },
} as const;

export const READER = {
  pageTitle:           'גיבורים קטנים — קריאת הסיפור',
  loadingText:         'פותחים את הספר...',
  navBack:             'חזרה לספר',
  pageNum:             'עמוד {current}',
  progress:            'עמוד {current} מתוך {total}',
  btnPrev:             'הקודם',
  btnNext:             'הבא',
  btnFinish:           'סיום הסיפור ✨',
  audioPlay:           'נגן',
  audioPause:          'השהה',
  audioTrackAriaLabel: 'מיקום בהקראה',
  navAriaLabel:        'ניווט בין עמודים',
  btnPrevAriaLabel:    'עמוד קודם',
  btnNextAriaLabel:    'עמוד הבא',

  errors: {
    title:        'לא הצלחנו לפתוח את הספר',
    default:      'אפשר לנסות שוב או לחזור לדף הספר.',
    notFound:     'לא מצאנו כרגע את ההזמנה. אפשר לחזור לדף הספר ולנסות שוב.',
    loadFailed:   'הספר עדיין לא נטען. רענון קצר בדרך כלל פותר את זה.',
    noPages:      'הספר לא מכיל עמודים. אנא צרו קשר עם התמיכה.',
    networkFail:  'יש כרגע הפרעה בחיבור. נסו שוב בעוד רגע.',
    missingOrder: 'פרטי ההזמנה חסרים. אנא חזרו לדף הראשי ונסו שוב.',
  },
} as const;
