/**
 * content/ui/he/success.ts
 * Ready page and reader page copy.
 * "Ready" = book-is-done landing. "Reader" = page-by-page reading experience.
 */

export const READY = {
  pageTitle:         'גיבורים קטנים — הספר שלכם מוכן!',
  loadingText:       'טוענים את הספר שלכם...',
  headline:          'הספר שלכם מוכן',
  dedicationPrefix:  'הסיפור הזה נכתב במיוחד בשביל {name}',
  btnRead:           'לקרוא את הספר',
  btnAudio:          '🎧 להאזין לסיפור',
  btnPdf:            'הורד PDF',
  saveHint:          'שמרו את הקישור לספר כדי לחזור אליו בכל עת',
  copyLabel:         'העתקת הקישור',
  copiedLabel:       'הועתק! ✓',
  previewLabel:      'הצצה לתוך הספר',
  previewPageNum:    'עמוד ראשון',
  copyBtnAriaLabel:  'העתק קישור לספר',

  errors: {
    title:        'משהו השתבש בדרך',
    back:         'חזרה לדף הבית',
    notFound:     'לא מצאנו את ההזמנה שלכם. אנא צרו קשר עם התמיכה.',
    loadFailed:   'משהו השתבש בטעינת הספר. אנא נסו לרענן את הדף.',
    networkFail:  'לא הצלחנו לטעון את הספר. אנא בדקו את החיבור לאינטרנט ונסו שוב.',
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
    default:      'אנא נסו שוב או חזרו לדף הספר.',
    notFound:     'לא מצאנו את ההזמנה שלכם. אנא חזרו לדף הספר.',
    loadFailed:   'משהו השתבש בטעינת הספר. אנא נסו לרענן את הדף.',
    noPages:      'הספר לא מכיל עמודים. אנא צרו קשר עם התמיכה.',
    networkFail:  'לא הצלחנו לטעון את הספר. אנא בדקו את החיבור לאינטרנט ונסו שוב.',
    missingOrder: 'פרטי ההזמנה חסרים. אנא חזרו לדף הראשי ונסו שוב.',
  },
} as const;
