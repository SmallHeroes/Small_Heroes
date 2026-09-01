/**
 * Server-side mirror of CONTENT.he.landing (public/JS/content.js).
 * Keep in sync manually with the client bundle.
 *
 * 2026-08 copy spec (Guy + Codex): honest positioning — the child becomes the
 * HERO of one of our pre-written original stories.
 *
 * Every product claim below is verified against code:
 * - spreads: backend/config/wizard.ts DIRECTION_PAGE_MAP (8/12/16 beats) +
 *   displayPagesForBeats() (×2) — "each beat = a printed spread".
 * - narration voice choice: public/JS/wizard.js step 6 (mom | dad | fairy).
 * - pre-written plots: backend/config/mvp-story-matrix (6 categories × 3
 *   directions, all approved_v3).
 * - human QA before delivery: the human-QA authority gate in the pipeline.
 * - NO purchase buttons: BUY_MODE defaults to 'waitlist' (lib/env.ts) and
 *   app/api/checkout hard-guards every charge, AND wizard.js:591-598
 *   deliberately discards a URL direction ("chosen ACTIVELY in step 8"), so a
 *   landing package is not selectable in practice. Per Guy's rule the pricing
 *   grid is informational and the section closes with the launch-notice CTA.
 * - OMITTED per Guy until the underlying behaviour is defined and verified:
 *   the photo-handling FAQ, the delivery-time FAQ and the refunds FAQ.
 */
import type { MvpMatrixCategoryPayload } from '@/lib/web/mvp-matrix-response';
import type { StoryDirection } from '@/backend/config/mvp-story-matrix';

export const LANDING_COPY = {
  hero: {
    badge: 'ספר ילדים דיגיטלי אישי, מאויר ומוקרא בעברית',
    h1Line1: 'הפעם, הילד שלכם',
    h1Line2: 'הוא הגיבור של הסיפור.',
    sub:
      'בחרו את הרגע שמעסיק אותו עכשיו, והילד שלכם ייכנס בתפקיד הראשי - בשם שלו, בדמות מאוירת בהשראתו ועם חבר מלווה לצדו.',
    ctaPrimary: 'להתחיל את הספר שלו',
    /* scrolls to the sample section (the book, and a video of it once Guy's
       clip lands); becomes "לפתוח ספר לדוגמה" once a reader-demo route exists */
    ctaSecondary: 'לראות ספר לדוגמה',
    ctaNotes: ['תמונה לא חובה', 'קריינות מלאה בעברית'],
  },

  /* What you actually get — the concrete promise, before the emotional pick. */
  value: {
    h2: 'מה מקבלים?',
    /* one flowing line — stacked short lines read as broken text (per Guy) */
    lede: 'חוויה של ספר שלם, לקריאה ולהאזנה - לא רק תמונה עם השם שלו.',
    items: [
      {
        title: 'הילד בתפקיד הראשי',
        body: 'השם שלו משולב לאורך הסיפור, והוא זה שפועל, מנסה ובוחר ברגעים החשובים.',
      },
      {
        title: 'דמות מאוירת שמזכירה אותו',
        body: 'אפשר להוסיף תמונה שתעזור לנו לעצב את הדמות שלו - וגם אפשר בלעדיה.',
      },
      {
        title: 'סיפור ואיורים שלמים',
        body: 'הילד והחבר ממשיכים יחד לאורך העלילה - לא אוסף של תמונות נפרדות.',
      },
      {
        title: 'קריינות מלאה בעברית',
        body: 'הספר מגיע גם עם קריינות מלאה, בקול שתבחרו.',
      },
      {
        title: 'קישור אישי לספר',
        body: 'קוראים ומאזינים מהטלפון, מהטאבלט או מהמחשב.',
      },
    ],
  },

  helps: {
    h2: 'מה מעסיק אותו עכשיו?',
    lede: 'לפעמים קשה למצוא את המילים. אז אפשר להתחיל מסיפור.',
    closing: 'לכל נושא יש חבר מלווה משלו, שמכיר את הדרך הזאת יחד איתו.',
    /** Marketing card copy per category — landing-side only; the wizard keeps
        the matrix source untouched. ONE short line per card (per Guy: the
        description paragraph made the cards heavy and long). */
    cards: {
      NIGHT_FEAR: { lead: 'כשהחושך הופך כל צליל לקצת יותר גדול.' },
      SOCIAL: { lead: 'כשהוא רוצה להתקרב, אבל לא תמיד יודע איך להתחיל.' },
      MEDICAL_PROCEDURE: { lead: 'כשמשהו עומד לקרות - והוא לא יודע איך זה ירגיש.' },
      NEW_SIBLING: { lead: 'כשהלב יכול לשמוח ולהתכווץ באותו יום.' },
      TRANSITION: { lead: 'כשהעולם המוכר פתאום נראה קצת אחר.' },
      ANGER_FRUSTRATION: { lead: 'כשהרגש מגיע לפני שהמילים מספיקות להגיע.' },
    } as Record<string, { lead: string }>,
  },

  sample: {
    kicker: 'ספר לדוגמה',
    h2Line1: 'הילד שלכם לא מקבל שיעור.',
    h2Line2: 'הוא מקבל תפקיד ראשי.',
    /* two tight paragraphs — the line-by-line stanza read as broken text
       and was too long (per Guy) */
    p1:
      'החושך לא נעלם מיד, והכעס לא מסתדר במשפט אחד. אבל בתוך הסיפור הילד מבחין, מנסה, לפעמים טועה - ואז בוחר לעשות משהו. והעלילה מתקדמת בזכותו.',
    p2:
      'גם החבר שמלווה אותו לא מגיע עם כל התשובות. הוא לא צריך להציל את הילד, אלא להיות שם בזמן שהילד מגלה מה הוא יכול לעשות בעצמו.',
    /* no CTA here: this section IS the sample. The button used to point at the
       gallery, which is show rather than a sample (per Guy). */
  },

  gallery: {
    h2: 'ככה זה נראה מבפנים',
    /* the old two-line lede above the gallery was dropped per Guy */
    sub: 'אותו ילד ואותו חבר ממשיכים יחד לאורך הספר - עולם אחד, לא אוסף תמונות.',
    cta: 'להתחיל את הספר שלו',
    toggleStyle01: 'ריאליסטי מאוייר',
    toggleStyle02: 'עולם קסום',
    style02PreviewNote: 'עולם קסום - בבדיקות איכות, ייפתח בהמשך',
  },

  how: {
    h2: 'איך זה עובד?',
    lede: 'אתם בוחרים את הרגע. אנחנו הופכים את הילד לגיבור בתוכו.',
    steps: [
      {
        title: '1. בוחרים מה מעסיק אותו',
        body: 'פחד, כעס, שינוי, בדיקה או קושי חברתי - מתחילים מהרגע שהכי רלוונטי עכשיו.',
        emphasis: 'לכל נושא יש חבר מלווה שמתאים לעולם ולסיפור שלו.',
      },
      {
        title: '2. מספרים לנו על הילד',
        body: 'שם, גיל וכמה פרטים בסיסיים. אפשר להוסיף תמונה שתעזור לדמות המאוירת להזכיר אותו.',
        emphasis: 'תמונה היא בחירה - לא חובה.',
      },
      {
        title: '3. מקבלים את הספר שלו',
        body: 'הוא נכנס בתפקיד הראשי לאחד הסיפורים המקוריים שלנו - עם השם והדמות שלו, איורים וקריינות מלאה.',
        emphasis: 'בלי לכתוב פרומפטים. בלי לבנות סיפור בעצמכם.',
      },
    ],
    closing: 'אתם מביאים את הילד. אנחנו מביאים את הספר.',
    cta: 'להתחיל את הספר שלו',
  },

  /* Why our stories work differently — the story-craft argument. */
  why: {
    h2: 'למה הסיפורים שלנו עובדים אחרת?',
    lede: 'במקום עוד הסבר - סיפור שהוא יכול להיכנס אליו.',
    sub: 'הילד הוא לא "הבעיה" שצריך לפתור. בסיפורים שלנו הוא מקבל תפקיד.',
    cards: [
      {
        title: 'משהו קורה באמת',
        body: 'יש מטרה, הסתבכות, ניסיון, טעות ורגע שבו צריך לבחור מה עושים עכשיו.',
      },
      {
        title: 'הילד משנה את מה שקורה',
        body: 'החבר יכול לעזור, להצחיק או להתבלבל - אבל הוא לא פותר את הסיפור במקומו.',
      },
      {
        title: 'לא הכול נעלם בקסם',
        body: 'הפחד יכול עדיין להיות שם - אבל עכשיו יש לילד גם חוויה שבה הצליח לעשות משהו בתוכו.',
      },
      {
        title: 'ונשאר משהו שאפשר לחזור אליו',
        body: 'לפעמים זה משפט. לפעמים פעולה. לפעמים פשוט הזיכרון של מה שהגיבור עשה.',
      },
    ],
  },

  /* How quality is kept — replaces the old generic trust band. */
  trust: {
    h2: 'איך אנחנו שומרים על איכות?',
    lede: 'את הטכנולוגיה אפשר לייצר מהר. סיפור ילדים טוב - פחות.',
    sub: 'לכן בחרנו להתחיל אחרת.',
    pillars: [
      {
        icon: '📖',
        title: 'העלילות נכתבות מראש',
        body: 'הסיפורים לא מומצאים מחדש בכל הזמנה. אנחנו כותבים את העלילות מראש - כאלה שאנחנו מכירים ויכולים לעמוד מאחוריהן - והילד נכנס לתוכן בתפקיד הראשי.',
      },
      {
        icon: '✨',
        title: 'עברית שנועדה להקראה',
        body: 'הספר צריך לעבוד גם ברגע שיושבים ליד הילד וקוראים בקול: פשוט בלי להיות שטוח, מצחיק בלי להיות מטופש, ורגיש בלי להישמע כמו שיעור.',
      },
      {
        icon: '🔒',
        title: 'כל ספר עובר בדיקות איכות',
        body: 'המערכת בודקת כל ספר לפני המסירה. אם משהו לא עומד ברף שהגדרנו, הספר נעצר לבדיקה אנושית.',
      },
    ],
  },

  earlyStage: {
    line:
      'גיבורים קטנים הוא לא טיפול ולא תחליף לליווי מקצועי - הוא ספר ילדים שנוגע ברגעים אמיתיים דרך עלילה, הומור ודמיון.',
  },

  about: {
    h2: 'מאחורי גיבורים קטנים',
    lede: 'יש רגעים שבהם אתם יודעים מה עובר עליו - ופשוט קשה למצוא את המילים.',
    intro:
      'בשביל הרגעים האלה נולד גיבורים קטנים - מתוך חיבור בין הורות, עבודה רגשית עם ילדים, כתיבה, עיצוב וטכנולוגיה.',
    belief:
      'רצינו ספר שילד ירצה לשמוע קודם כול כי קורה בו משהו. ורק אחר כך, אולי, יישאר ממנו גם משהו מעבר לסיפור.',
    people: [
      {
        name: 'גל',
        role: 'מטפלת באמנות',
        bio: 'גל מביאה את המבט הרגשי - איך לפגוש פחד, כעס ושינוי בלי להפוך את הילד לבעיה שצריך לתקן.',
        img: '/Images/about/gal-placeholder.svg',
      },
      {
        name: 'גיא',
        role: 'מעצב מוצר',
        bio: 'גיא מחבר בין הסיפור, האיור והטכנולוגיה למוצר שפשוט להורה - ועשיר מספיק כדי שילד ירצה להיכנס אליו.',
        img: '/Images/about/guy-placeholder.svg',
      },
    ],
    techLine:
      'הטכנולוגיה הופכת את הספר לאישי. הסיפור הוא מה שצריך לגרום לילד לבקש אותו שוב.',
    /* the shared-language close — replaces the old "approach" card grid */
    shared: {
      h3: 'סיפור שנותן לכם שפה משותפת',
      text:
        'לפעמים אחרי ספר מגיעה שאלה, לפעמים הילד מספר על משהו שקרה לו - ולפעמים פשוט קוראים שוב מחר.',
    },
  },

  pricing: {
    kicker: 'מחירים',
    h2: 'בחרו את הספר שמתאים לכם',
    sub: 'כל ספר כולל חוויה דיגיטלית אישית, איורים וקריינות מלאה בעברית.',
    note: 'לא כל סוג סיפור מתאים לכל נושא. אחרי שתבחרו מה מעסיק את הילד, נציג את האפשרויות שמתאימות לו.',
    /* Each card carries its own CTA into the flow (per Guy, laying the ground
       for production). The waitlist notice that stood in for them is gone. */
    cards: [
      {
        kicker: 'סיפור לפני שינה',
        name: 'ספר לילה טוב אישי',
        pages: '16 עמודים',
        price: '59',
        desc: 'סיפור קצר וממוקד בקצב רגוע - להרפתקה קטנה שסוגרת את היום.',
        features: ['ספר דיגיטלי מאויר', 'קריינות מלאה בעברית'],
        cta: 'לבחור בספר לילה טוב',
        direction: 'bedtime' as const,
        featured: false,
      },
      {
        kicker: 'הרפתקה',
        name: 'הרפתקה אישית',
        pages: '24 עמודים',
        price: '79',
        desc: 'יותר מקום לעלילה, להומור ולרגעים שבהם הילד צריך לפעול כדי להתקדם.',
        features: ['ספר דיגיטלי מאויר', 'קריינות מלאה בעברית'],
        cta: 'לבחור בהרפתקה',
        direction: 'adventure' as const,
        featured: true,
      },
      {
        kicker: 'פנטזיה',
        name: 'ספר פנטזיה אישי',
        pages: '32 עמודים',
        price: '99',
        desc: 'מסע ארוך ועשיר יותר, לילדים שאוהבים להיכנס לעולם אחר ולהישאר בו.',
        features: ['ספר דיגיטלי מאויר', 'קריינות מלאה בעברית'],
        cta: 'לבחור בפנטזיה',
        direction: 'fantasy' as const,
        featured: false,
      },
    ],
  },

  faq: {
    h2: 'שאלות שהורים באמת רוצים לדעת',
    sub: 'תשובות ישרות, בלי הבטחות מיותרות.',
    items: [
      {
        q: 'עד כמה הספר אישי?',
        a:
          'העלילות נכתבות מראש, והילד שלכם נכנס לאחת מהן בתפקיד הראשי: השם שלו משולב בסיפור, הדמות המאוירת נבנית בהשראתו, והנושא והחבר המלווה הם חלק מהסיפור שבחרתם. בחרנו להתחיל מעלילות שאנחנו מכירים, קראנו ושיפרנו - במקום להמציא סיפור חדש בכל הזמנה ולקוות שיהיה טוב.',
      },
      {
        q: 'אז הסיפור לא נכתב במיוחד לילד שלי?',
        a:
          'נכון. הספר אישי. העלילה הבסיסית נכתבה מראש. הילד הופך לגיבור שלה - בשם שלו, בדמות שלו ובאיורים לאורך הספר.',
      },
      {
        q: 'האם הילד ייראה בדיוק כמו בתמונה?',
        a:
          'לא. התמונה עוזרת לנו ליצור דמות מאוירת שמזכירה את הילד - תחושה מוכרת ועקבית לאורך הספר, לא העתק מדויק של צילום.',
      },
      {
        q: 'חייבים להעלות תמונה?',
        a:
          'לא. אפשר ליצור ספר גם בלי תמונה. הילד עדיין יופיע בשם ובתפקיד הראשי, אבל הדמות המאוירת לא בהכרח תיראה כמוהו.',
      },
      {
        q: 'מי בוחר את החבר המלווה?',
        a:
          'לכל נושא יש חבר מלווה משלו. כך לכל חבר יש אופי ותפקיד אמיתיים בעלילה, במקום אותה דמות בכל סיפור.',
      },
      {
        q: 'מה בדיוק מקבלים?',
        a:
          'ספר ילדים דיגיטלי אישי ומאויר, באורך שבחרתם, עם קריינות מלאה בעברית וקישור אישי לקריאה ולהאזנה.',
      },
      {
        q: 'האם זה טיפול רגשי?',
        a:
          'לא. זהו ספר ילדים, לא טיפול ולא כלי אבחוני. הסיפורים נוגעים ברגעים שילדים מכירים, אבל המטרה הראשונה היא שילדים ירצו לשמוע אותם.',
      },
    ],
  },

  footer: {
    h2Line1: 'במקום עוד הסבר -',
    h2Line2: 'תנו לו להיכנס לסיפור.',
    sub: 'בחרו את הרגע שמעסיק אותו, והילד שלכם ייכנס בתפקיד הראשי להרפתקה אישית ומוקראת בעברית.',
    cta: 'להתחיל את הספר שלו',
  },
} as const;

export type LandingContent = ReturnType<typeof getLandingContent>;

function pricingCardsFromMatrix(categories: MvpMatrixCategoryPayload[]) {
  const ref = categories[0]?.directions;
  if (!ref) return [...LANDING_COPY.pricing.cards];

  return LANDING_COPY.pricing.cards.map((card) => {
    const direction = card.direction as StoryDirection;
    const meta = ref[direction];
    if (!meta) return { ...card };
    return {
      ...card,
      pages: `${meta.displayPages} עמודים`,
      price: String(meta.priceILS),
    };
  });
}

export function getLandingContent(matrixCategories: MvpMatrixCategoryPayload[]) {
  return {
    ...LANDING_COPY,
    pricing: {
      ...LANDING_COPY.pricing,
      cards: pricingCardsFromMatrix(matrixCategories),
    },
  };
}
