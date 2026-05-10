/**
 * content/ui/he/pricing.ts
 * Pricing section copy — package cards, descriptions, CTAs.
 * Note: actual prices and page counts live in backend/config/wizard.ts (STORY_LENGTHS, ADDON_PRICES).
 * This file holds only the display copy.
 */

export const PRICING = {
  h2:   'בחרו את החבילה שמתאימה לכם',
  sub:  'כל ספר נוצר אישית לפי הילד שלכם — ההבדל הוא בעומק, באורך ובחוויה שתרצו לקבל.',
  note: 'אפשר להוסיף קריינות, PDF או חבילה משולבת — לפי מה שמתאים לכם.',

  cards: [
    {
      kicker:   'להתחלה נעימה',
      name:     'ספר קצר',
      pages:    '10 עמודים',
      price:    '50',
      desc:     'מושלם לסיפור קצר ומדויק, עם מסר רגשי ברור ורגע נעים לפני השינה.',
      features: [
        'סיפור קצר וקולע',
        'מתאים לילדים עם ריכוז קצר',
        'בחירה טובה להתנסות ראשונה',
      ],
      cta:      'מתחילים בקטן',
      featured: false,
    },
    {
      kicker:   'האיזון המושלם',
      name:     'ספר בינוני',
      pages:    '15 עמודים',
      price:    '70',
      badge:    'הבחירה של רוב ההורים',
      desc:     'הסיפור המלא והמאוזן — מספיק עמוק כדי לרגש, ועדיין קליל ונעים לילד.',
      features: [
        'חוויה מלאה ומרגשת',
        'קצב נעים ומאוזן',
        'הבחירה הכי מומלצת להתחלה',
      ],
      cta:      'זה מה שאני רוצה',
      featured: true,
    },
    {
      kicker:   'חוויה עשירה יותר',
      name:     'ספר מלא',
      pages:    '20 עמודים',
      price:    '90',
      desc:     'ספר עמוק יותר — עם רגעים שנבנים לאט, התפתחות רגשית אמיתית, ומקום לעולם הפנימי של הילד.',
      features: [
        'עומק רגשי אמיתי ורגעים שנזכרים',
        'חיבור שנבנה לאט, בקצב הנכון',
        'מעולה למי שרוצה את כל החוויה',
      ],
      cta:      'אני רוצה חוויה מלאה',
      featured: false,
    },
  ],
} as const;
