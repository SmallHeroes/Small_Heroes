/**
 * content.js — Small Heroes centralised string table
 *
 * ALL user-facing Hebrew text lives here.  No other file may contain
 * hardcoded Hebrew strings.  Adding a locale is done by adding a new
 * top-level key (e.g. CONTENT.en) with the same shape as CONTENT.he.
 *
 * Usage
 *   t("reader.pageNum", { current: 3, total: 10 })   → "עמוד 3 מתוך 10"
 *   t("wizard.topics")                                → Array (use directly)
 *   CONTENT.he.wizard.topics                          → same array
 *
 * File: JS/content.js
 */

const CONTENT = {
  he: {

    /* ── COMMON ─────────────────────────────────────────────────── */
    common: {
      brand:   'גיבורים קטנים',
      tagline: 'סיפורי חוסן לילדים',
      navCta:  'אני רוצה לנסות',
      errors: {
        missingOrder: 'פרטי ההזמנה חסרים. אנא חזרו לדף הראשי ונסו שוב.',
        orderNotFound:'לא מצאנו את ההזמנה שלכם. אנא צרו קשר עם התמיכה.',
        loadFailed:   'הספר עדיין לא נטען. בדקו חיבור לאינטרנט ונסו שוב.',
        refreshPage:  'הטעינה מתעכבת מעט. רענון קצר בדרך כלל פותר את זה.',
        genericTitle: 'משהו השתבש בדרך',
        backToHome:   'חזרה לדף הבית',
      },
    },

    /* ── LANDING PAGE ────────────────────────────────────────────── */
    landing: {
      historyLabel:         'הספרים האחרונים שלכם:',
      historyClearAriaLabel:'נקה היסטוריה',
      bookUnnamed:          'ספר ללא שם',
      bookByChild:          'ספר של {name}',
      bookRemoveAriaLabel:  'הסר את "{label}" מההיסטוריה',

      hero: {
        badge:       'ספר אישי 100% — מוכן תוך דקות',
        h1:          'משהו קשה לו עכשיו?',
        sub:         'אתם מספרים מה קשה לו — אנחנו בונים ספר סביב זה.',
        body:        'ספר ילדים שנכתב סביב מה שהילד שלכם עובר עכשיו — עם דמות שדומה לו, סיפור שהוא מזדהה איתו, וסוף שנותן לו כוח.',
        ctaPrimary:  'אני רוצה ספר כזה',
        ctaSecondary:'למחירים',
        bullets: [
          'נכתב סביב הקושי האמיתי שלו',
          'הדמות עוברת בדיוק את מה שהוא עובר',
          'ילדים מבקשים לשמוע אותו שוב ושוב',
        ],
        socialProof: '',
        trustBadge:  '',
        ctaNote:     '',
      },

      gallery: {
        h2:  'ככה זה נראה מבפנים',
        sub: 'כל עמוד מצוייר במיוחד. הסגנון חם, הפרטים אישיים — והילד מגלה את עצמו בתוך הסיפור.',
        cta: 'אני רוצה ספר כזה',
        toggleIllustrated: 'מאוייר',
        toggleRealistic: 'אקוורל',
        // toggleDetailed removed — Style 03 retired
        /** Placeholder — swap when Style 03 gallery assets ship */
        detailedComingSoonNote: 'גלריה לסגנון העולם הקסום בעדכון הקרוב.',
      },

      why: {
        h2:  'למה זה שונה?',
        sub: 'יש הרבה ספרי ילדים עם שם מותאם. זה לא אחד מהם.',
        cards: [
          { title: '💜 לא תבנית — סיפור שנולד ממה שהוא מרגיש', body: 'אתם מזינים מה קשה לו, מה עוזר לו, ומה הייתם רוצים שירגיש. הסיפור, הדמויות והמסר נבנים לפי זה — מאפס.' },
          { title: '🎨 שני סגנונות איור — אתם בוחרים', body: 'סגנון מאוייר חם וחמוד או אקוורל ריאליסטי. כל עמוד נוצר מחדש כך שהילד ירגיש שהספר הזה שייך רק לו.' },
          { title: '⚡ בלי לחכות — הספר נוצר לפניכם',  body: 'ממלאים שאלון קצר, בוחרים חבילה — ותוך דקות הספר מוכן לקריאה דיגיטלית, עם אפשרות לקריינות והדפסה.' },
        ],
      },

      sample: {
        kicker: 'דוגמה אמיתית — ספר שנוצר לתמר, בת 5, פחד מאזעקות',
        h2:     'הילד שלכם — בתוך הסיפור שלו',
        p1:     '',
        p2:     'הוא לא רק מככב בסיפור. הוא עובר בו משהו אמיתי — פוגש דמויות, מוצא כוחות שלא ידע שיש לו, ומגיע לסוף שנותן לו משהו להחזיק בו.',
        cta:    'אני רוצה ספר כזה לילד שלי',
        quote:  'פתאום, קול אזעקה חזק נשמע מבחוץ, וקירות החדר רעדו מהרעש. תמר קפאה במקומה, ידיה נעו במהירות לאוזניה. היד שלה רעדה מעט — ואז, לאט, הושיטה אותה לעבר החלון. תמר הביטה בחדר השקט, נשענה בנחת על השטיח הרך, וחיוכה הקטן הופיע.',
      },

      how: {
        h2: 'איך זה עובד?',
        steps: [
          { title: '✍️ אתם מספרים לנו עליו', body: 'מה קשה לו, מה עוזר לו, ומה הייתם רוצים שירגיש. לוקח 3 דקות.', note: 'אתם קובעים מה נכנס לסיפור ומה לא — בלי הפתעות.' },
          { title: '📖 הסיפור נכתב — רק בשבילו', body: 'עלילה מקורית, דמות שנראית כמוהו, ואיורים שמלווים כל רגע. הכל מותאם למה שסיפרתם.' },
          { title: '🎧 קוראים, שומעים, מדפיסים', body: 'ספר דיגיטלי מלא שמוכן מיד. אפשר להוסיף קריינות מקצועית או להדפיס כספר אמיתי.' },
        ],
      },

      pricing: {
        h2:   'בחרו את הסיפור שמתאים לכם',
        sub:  'כל ספר נוצר אישית — הכיוון קובע את האורך והאווירה.',
        note: '',
        cards: [
          {
            kicker: 'סיפור לפני שינה', name: 'שקט וחם', pages: '10 עמודים', price: '59',
            desc: 'סיפור רגוע עם מסר רגשי ברור — מושלם לפני השינה.',
            features: ['10 עמודים עם איורים מקוריים', 'דמות מותאמת אישית', 'אווירה שקטה ומרגיעה'],
            cta: 'מתחילים בקטן', featured: false,
          },
          {
            kicker: 'הרפתקה', name: 'פעולה וגילוי', pages: '15 עמודים', price: '79',
            badge: 'הבחירה של רוב ההורים',
            desc: 'הסיפור המלא — מספיק עמוק כדי לרגש, קליל מספיק לקריאה נעימה.',
            features: ['15 עמודים עם איורים מקוריים', 'דמות מותאמת + עלילה מלאה', 'הרפתקה עם התפתחות רגשית'],
            cta: 'זה מה שאני רוצה', featured: true,
          },
          {
            kicker: 'מסע פלאי', name: 'דמיון ללא גבולות', pages: '20 עמודים', price: '99',
            desc: 'ספר עשיר עם עולם שלם — רגעים שנבנים לאט, עומק אמיתי.',
            features: ['20 עמודים עם איורים מקוריים', 'עלילה מפותחת עם שכבות רגשיות', 'עולם פנטזיה שלם'],
            cta: 'אני רוצה חוויה מלאה', featured: false,
          },
        ],
      },

      faq: {
        h2:  'שאלות נפוצות',
        sub: '',
        items: [
          { q: 'האם הסיפור באמת מותאם אישית?',     a: 'כן. הספר נבנה מאפס לפי מה שאתם מזינים — שם הילד, גיל, מה קשה לו, מה עוזר לו, ואיזה שינוי הייתם רוצים לראות. זה לא תבנית עם שם.' },
          { q: 'לאיזה גיל זה מתאים?',               a: 'בעיקר לגילאי 3–8. השפה והעומק מותאמים לגיל שאתם מזינים.' },
          { q: 'מתאים גם לילדים רגישים במיוחד?',     a: 'בהחלט. אתם בוחרים מה נכנס לסיפור ומה לא — חושך, דמויות מפחידות, מצבים מלחיצים. הספר נבנה כך שירגיש בטוח.' },
          { q: 'זה תחליף לטיפול רגשי?',              a: 'לא. זה כלי עדין שמשלים — לא מחליף. המטרה היא שהילד ירגיש שהוא לא לבד עם מה שקשה לו.' },
          { q: 'תוך כמה זמן הספר מוכן?',             a: 'תוך כמה דקות מרגע התשלום. הסיפור, האיורים והקריינות (אם בחרתם) נוצרים מיד.' },
          { q: 'חייבים להעלות תמונה של הילד?',       a: 'לא. תמונה עוזרת לדמות להרגיש יותר אישית, אבל גם בלעדיה הספר עובד מצוין.' },
        ],
      },

      footer: {
        h2:               'מוכנים ליצור\nאת הספר שלו?',
        sub:              'שלוש דקות, כמה שאלות — וספר שנכתב בדיוק בשבילו.',
        cta:              'בואו נתחיל',
      },
    },

    /* ── WIZARD ──────────────────────────────────────────────────── */
    wizard: {
      progressLabel: 'שלב {current} מתוך {total}',

      /* ── Micro-copy — warm acknowledgments between steps ──────── */
      /* These appear at the top of each step, after the parent moves forward. */
      microcopy: {
        s3:  'אנחנו מתחילים להכיר את הגיבור/ת שלכם…',
        s4:  'יפה. הסיפור כבר מתחיל להיות שלהם.',
        s5:  'תודה ששיתפתם. עכשיו — מה קצת קשה לו/ה בתקופה הזו?',
        s6:  'הבנו. עכשיו — איך הייתם רוצים שירגיש בסוף הסיפור?',
        s7:  'יש לנו כיוון. עכשיו נמצא מה עוזר לו/ה להרגיע ולחזק.',
        s8:  'מעולה. נוודא גם מה להשאיר מחוץ לסיפור.',
        s9:  'כמעט שם. בואו נבחר איך הספר נראה ונשמע.',
        s10: 'הסיפור מוכן. עוד רגע נסכם ונמשיך לתשלום.',
        s11: 'אפשר לתת לספר שם ומשפט הקדשה — ואז ממשיכים לסיכום.',
        companion: 'יופי. עכשיו — בואו נבחר מי הולך ללווה את הגיבור/ת במסע…',
      },

      steps: {

        /* ── Step 1 — Welcome ─────────────────────────────── */
        s1: {
          title: 'בואו ניצור סיפור מיוחד עבור הילד שלכם',
          sub:   'כזה שהוא ירגיש שהוא חלק ממנו',
          cta:   'מתחילים',
        },

        /* ── Step 2 — Topic ───────────────────────────────── */
        s2: {
          title: 'מה הכי קשה לו לאחרונה?',
          sub:   'בחרו את מה שהכי מרגיש נכון',
        },

        categoryFollowup: {
          title: 'נעזור לסיפור להרגיש יותר שלו',
          sub:   'אפשר לבחור תשובות קצרות — לא חייבים לכתוב הרבה',
        },

        /* ── Companion (after follow-up) ───────────── */
        companion: {
          title: 'מי יעזור לו במסע?',
          sub:   'בחרו חבר קטן שילווה אותו בסיפור',
        },

        /* ── Child details (wizard step 4) + superpower ─── */
        s3: {
          title:              'איך קוראים לילד?',
          sub:                'כדי ליצור דמות שמבוססת עליו',
          nameLabel:          'איך קוראים לו?',
          ageLabel:           'בן כמה הוא?',
          genderLabel:        'מין',
          genderBoy:          'בן',
          genderGirl:         'בת',
          genderOther:        'אחר',
          traitsLabel:        'מה מאפיין אותו/ה?',
          traitsNote:         'בחרו את מה שמרגיש הכי נכון — אפשר יותר מאחד',
          photoPrompt:        'כדי ליצור דמות שמבוססת עליו',
          photoOptional:      'העלו תמונה ברורה של הפנים — האיור ייווצר בסגנון ספר ילדים ובהשראת התמונה',
        },

        /* ── Step 4 — Superpower ─────────────────────────── */
        s4power: {
          title:            'מה גורם לו/ה לזרוח?',
          sub:              'הדברים האלה יהפכו לכוחות העל של הדמות בסיפור',
          extraLabel:       'יש עוד משהו מיוחד שבו/ה?',
          extraPlaceholder: 'כתבו במילים שלכם (לא חובה)',
        },

        /* ── Book name + dedication (before summary) ─────── */
        sBook: {
          title: 'שם הספר',
          sub:   'בחרו שם לספר — ואופציונלית משפט הקדשה לדף הראשון',
          bookNameLabel: 'שם הספר',
          bookNameHint: 'איך תרצו לקרוא לספר — יופיע על הכריכה והמסכים',
          dedicationHeading: 'הקדשה',
          dedicationOptional: '(אופציונלי)',
          dedicationHint: 'הקדשה אישית שתופיע בדף הראשון של הספר',
          dedicationPlaceholder: 'לדוגמה: הספר הזה מוקדש לסבתא רות ולדוד יוסי, שתמיד שומרים על יואב',
        },

        /* ── Step 5 — Challenges ──────────────────────────── */
        s4: {
          title:            'מה קצת קשה לו/ה בתקופה הזו?',
          sub:              'לא כדי לדאוג — כדי שהסיפור ידע בדיוק מה לגעת בו',
          sub2:             'אפשר לבחור יותר מאחד',
          extraLabel:       'יש משהו שלא מצאתם פה?',
          extraPlaceholder: 'ספרו במילים שלכם — גם משפט אחד מספיק',
        },

        /* ── Step 6 — Goals ───────────────────────────────── */
        s5: {
          title: 'איך הייתם רוצים שירגיש בסוף הסיפור?',
          sub:   'בחרו את התחושה שאתם רוצים שיישאר איתה',
          sub2:  'אפשר לבחור יותר מאחד',
        },

        /* ── Step 7 — Helpers ─────────────────────────────── */
        s6: {
          title:            'מה עוזר לו/ה להרגיש שלם/ה?',
          sub:              'הדברים האלה יופיעו בסיפור כמשאבים — לא כשיעורים',
          sub2:             'אפשר לבחור יותר מאחד',
          extraLabel:       'יש עוד משהו שעוזר?',
          extraPlaceholder: 'גם "לשבת ליד הדלת עד שנרדם/ת" — זו תשובה מושלמת',
        },

        /* ── Step 8 — Avoid ───────────────────────────────── */
        s7: {
          title:            'יש משהו שנוודא שלא יכנס?',
          sub:              'כל ילד/ה ראוי/ה לסיפור שמחזיק אותם בדיוק כמו שהם',
          sub2:             'אפשר לבחור יותר מאחד',
          extraLabel:       'יש משהו ספציפי שחשוב לדעת?',
          extraPlaceholder: 'כל דבר שיעזור לנו לשמור את הסיפור בטוח...',
        },

        /* ── Step 11 — Package: structure (direction + style) ─ */
        s8a: {
          title:          'איך תרצו שהספר ייראה?',
          sub:            'הכיוון קובע את האווירה והאורך. הסגנון קובע את הוויזואל.',
          directionTitle: 'סוג הסיפור והיקף',
          styleLabel:     'סגנון האיורים',
        },

        /* ── Step 11 — Package: addons + voice + sleep ─────── */
        s8b: {
          title:          'שדרוגים — להפוך את החוויה ליותר',
          sub:            'הכל אופציונלי. אפשר לדלג ולחזור בעתיד.',
          addonsExpanded: 'הפכו את הסיפור לחוויה מלאה',
          addonsCollapsed:'רוצים לשדרג?',
          addonsSub:      '*בתוספת תשלום קטנה',
          audio:  { badge: 'הכי פופולרי',  name: 'קריינות (+₪19)', desc: 'הקראה אישית נעימה' },
          pdf:    { badge: 'מושלם כמתנה',  name: 'קובץ מוכן להדפסה (+₪19)', desc: 'קובץ מעוצב להדפסה' },
          video:  { badge: 'חדש!',       name: 'וידאו + קריינות (+₪29)',  desc: 'סיפור מוקרן עם הקראה אוטומטית' },
          bundle: { badge: 'חסכו ₪9',     name: 'וידאו + הדפסה (+₪39)',    desc: 'וידאו עם קריינות + קובץ להדפסה' },
          voiceTitle:   'בחירת קול לקריינות',
          voicePreview: 'האזן לדוגמה',
          sleep: { name: 'מותאם לשינה 🌙', desc: 'טון רגוע יותר, הפסקות ארוכות יותר' },
        },

        /* ── Step 10 — Summary + Payment ─────────────────── */
        s9: {
          title:       'כמעט מתחילים ליצור את הסיפור',
          sub:         'ניצור עבורו סיפור אישי בעברית עם דמות מאוירת שמבוססת עליו',
          card1Title:  'מה יהיה בספר',
          card2Title:  'סה"כ לתשלום',
          card3Title:  'לאן לשלוח?',
          nameLabel:   'שם מלא',
          emailLabel:  'אימייל',
          submitBtn:   'המשך לתשלום מאובטח',
          paymentLogos:'הספר כולל סיפור אישי ודמות מאוירת בהשראת התמונה',
          paymentLogosNoPhoto: 'הספר כולל סיפור אישי ודמות מאוירת שתיווצר עבורו במיוחד',
        },
      },

      nav: {
        continueDefault:   'ממשיכים',
        continueToFamily:  'ממשיכים',
        continueToStory:   'ממשיכים לסיפור',
        continueToPackage: 'ממשיכים לבחירת חבילה',
        continueToSummary: 'ממשיכים לסיכום',
        back:              'חזור',
      },

      topics: [
        { id: 'night',         label: '🌙 פחדים בלילה'            },
        { id: 'sirens',        label: '💥 קולות ואזעקות'         },
        { id: 'general_fears', label: '🌊 פחדים אחרים'            },
        { id: 'anger',         label: '⚡ כעס ותסכול'            },
        { id: 'sensitivity',   label: '🌿 רגישות ועומס רגשי'     },
        { id: 'social',        label: '🤝 חברויות ומפגשים'        },
        { id: 'confidence',    label: '🌟 ביטחון וערך עצמי'      },
        { id: 'sibling',       label: '👶 אח או אחות חדשים'      },
        { id: 'transition',    label: '🌱 מעברים גדולים'         },
        { id: 'focus',         label: '🦋 קשב, סקרנות ולמידה'   },
        { id: 'medical',       label: '🩹 טיפולים רפואיים'       },
        { id: 'other',         label: '✏️ נושא אחר'              },
      ],

      traits: [
        { id: 'sensitive',   label: 'רגיש'            },
        { id: 'mischievous', label: 'שובב'             },
        { id: 'funny',       label: 'מצחיק'            },
        { id: 'dreamer',     label: 'חולם'             },
        { id: 'shy',         label: 'ביישן'            },
        { id: 'energetic',   label: 'אוהב להשתולל'    },
        { id: 'gentle',      label: 'עדין'             },
        { id: 'curious',     label: 'סקרן'             },
        { id: 'brave',       label: 'אמיץ'             },
        { id: 'other',       label: 'אחר'              },
      ],

      superpowers: [
        { id: 'details',    label: 'שם לב לפרטים' },
        { id: 'persistence',label: 'לא מוותר' },
        { id: 'kindness',   label: 'לב טוב' },
        { id: 'imagination',label: 'דמיון עשיר' },
        { id: 'inner-courage', label: 'אומץ מבפנים' },
        { id: 'deep-thinker',  label: 'חושב לעומק' },
        { id: 'self-calm',  label: 'יודע להירגע' },
      ],

      difficulties: [
        { id: 'startled',   label: '🌊 נבהל/ת מרעשים או דברים פתאומיים' },
        { id: 'relaxation', label: '😴 מתקשה להירגע'                      },
        { id: 'sleep',      label: '🌙 מפחד/ת להירדם לבד'                 },
        { id: 'clingy',     label: '🤍 נצמד/ת אלינו יותר מהרגיל'         },
        { id: 'questions',  label: '❓ שואל/ת הרבה שאלות מדאגה'           },
        { id: 'withdrawn',  label: '🐚 נהיה/ית שקט/ה או סגור/ה'           },
        { id: 'frustrated', label: '⚡ מתעצבן/ת יותר מהרגיל'             },
        { id: 'other',      label: '✏️ אחר'                               },
      ],

      goals: [
        { id: 'calm',        label: '🌿 נרגע/ת בקלות'               },
        { id: 'safe',        label: '🛡️ מרגיש/ה בטוח/ה יותר'        },
        { id: 'sleep',       label: '🌙 נרדם/ת בשקט'                 },
        { id: 'play',        label: '🎈 משחק/ת ונהנה/ית'             },
        { id: 'cope',        label: '💪 מתמודד/ת טוב יותר'           },
        { id: 'curious',     label: '✨ שואל/ת מתוך סקרנות'          },
        { id: 'alone',       label: '🌟 מרגיש/ה רגוע/ה גם לבד'      },
        { id: 'independent', label: '💛 פחות נצמד/ת אלינו'           },
        { id: 'other',       label: '✏️ אחר'                          },
      ],

      helpers: [
        { id: 'hug',        label: '🤗 חיבוק'              },
        { id: 'mom',        label: '💜 אמא'                },
        { id: 'dad',        label: '💙 אבא'                },
        { id: 'toy',        label: '🐻 בובה / חפץ אהוב'    },
        { id: 'nightlight', label: '🌙 אור קטן בלילה'     },
        { id: 'music',      label: '🎵 שיר או מוזיקה'     },
        { id: 'talk',       label: '💬 לדבר על זה'        },
        { id: 'play',       label: '🎮 משחק או פעילות'    },
        { id: 'quiet',      label: '🌿 זמן שקט לבד'       },
        { id: 'other',      label: '✏️ אחר'                },
      ],

      avoid: [
        { id: 'darkness',  label: '⚫ חושך'                          },
        { id: 'noise',     label: '🔊 רעשים חזקים'                   },
        { id: 'scary',     label: '😨 דמויות מפחידות'                },
        { id: 'war',       label: '💥 אזכורים של מלחמה'              },
        { id: 'sadness',   label: '😢 עצב או בכי ממושך'              },
        { id: 'stress',    label: '⚡ מצבים מלחיצים'                 },
        { id: 'harsh',     label: '💧 מילים קשות'                    },
        { id: 'monsters',  label: '👾 מפלצות / יצורים מפחידים'      },
        { id: 'other',     label: '✏️ אחר'                            },
      ],

      directionPackages: [
        {
          id: 'bedtime',
          label: 'סיפור לפני שינה',
          pagesLine: '10 עמודים',
          price: 59,
        },
        {
          id: 'adventure',
          label: 'הרפתקה',
          pagesLine: '15 עמודים',
          price: 79,
        },
        {
          id: 'fantasy',
          label: 'מסע פלאי',
          pagesLine: '20 עמודים',
          price: 99,
        },
      ],

      // Static mirror of `WIZARD_ILLUSTRATION_STYLES` in `lib/styles.ts` (ids, labels, blurbs). Change both together.
      styles: [
        {
          id: 'soft_hand_drawn_storybook',
          label: 'מאוייר חם ועדין',
          description: 'דמויות עגולות וחמודות בסגנון ספר ילדים מצויר — צבעי מים רכים, רקע קרם חם, הרגשה של חיבוק.',
        },
        {
          id: 'expressive_painterly_storybook',
          label: 'אקוורל ריאליסטי',
          description: 'הילד נראה כמו ילד אמיתי בציור אקוורל עדין — לא קריקטורה, אלא פורטרט רך וחם עם נגיעות צבעי מים.',
        },
      ],

      voices: [
        { id: 'mom',   label: 'אמא',        emoji: '👩' },
        { id: 'dad',   label: 'אבא',        emoji: '👨' },
        { id: 'fairy', label: 'פייה קסומה', emoji: '🧚' },
      ],

      summary: {
        childNameLabel: 'שם הילד:',
        topicLabel:     'נושא:',
        lengthLabel:    'חבילה:',
        styleLabel:     'סגנון:',
        audioLabel:     'קריינות:',
        pdfLabel:       'קובץ להדפסה:',
        sleepLabel:     'מצב שינה:',
        videoLabel:     'סרטון:',
        ageFormat:      '· גיל {age}',
        bookDigital:    'ספר דיגיטלי ({length})',
        bundleLabel:    'וידאו + קובץ להדפסה (חבילה)',
        audioAddon:     'קריינות 🎧',
        pdfAddon:       'קובץ להדפסה 📥',
        videoAddon:     'סרטון 🎬',
        totalLabel:     'סה"כ לתשלום:',
        defaultHero:    'הגיבור/ה שלכם',
      },
    },

    directions: {
      pageTitle: 'גיבורים קטנים — בוחרים כיוון לסיפור',
      title: 'איזה סוג סיפור יתאים לו?',
      subtitle: 'הכנו שלוש אפשרויות שונות — בחרו את מה שהכי מרגיש נכון לילד שלכם.',
      loadingTitle: 'אנחנו מכינים עכשיו שלוש אפשרויות לסיפור שלכם...',
      loadingHint: 'זה לוקח בדרך כלל דקה או שתיים',
      retry: 'מנסים שוב',
      cardSubmitting: 'בוחרים...',
      checkoutLoading: 'מעבירים אתכם לתשלום...',
      transitioningTitle: 'מעבירים אתכם לתשלום...',
      transitioningHint: 'עוד רגע נפתח את עמוד התשלום המאובטח',
      checkoutError: 'עוד רגע ונפתח את התשלום. אפשר לנסות שוב בעוד כמה שניות.',
      errorTitle: 'עוד רגע, אנחנו מכינים את האפשרויות מחדש',
      errorMessage: 'זה לוקח קצת יותר זמן מהרגיל. אפשר לנסות שוב או לחזור שלב אחד אחורה.',
      tagPrefix: 'כיוון',
      cardChoose: 'לבחירה',
      cardSelected: 'נבחר',
      labels: {
        bedtime: 'שקט וחם',
        adventure: 'פעולה וגילוי',
        fantasy: 'דמיון ללא גבולות',
      },
    },

    /* ── GENERATING ──────────────────────────────────────────────── */
    generating: {
      headline:     'אנחנו מתחילים ליצור עכשיו את הספר שלכם',

      stallMessage:       'עוד עובדים בשבילכם... לפעמים הספרים הכי מיוחדים לוקחים קצת יותר זמן',
      completionMessage:  'הספר מוכן כמעט לגמרי... מעבירים אותו בעדינות לעמוד הבא',
      errorTitle:         'משהו השתבש בדרך',
      errorNotFound:      'לא מצאנו את ההזמנה שלכם. אנא צרו קשר עם התמיכה.',
      errorFailed:        'הספר עדיין לא הושלם. אפשר לנסות שוב בעוד רגע או לפנות לתמיכה ונעזור מיד.',
      errorMissingOrder:  'פרטי ההזמנה חסרים. אנא חזרו לדף הראשי ונסו שוב.',
      errorBack:          'חזרה לדף הבית',
      errorMessage:       'הספר עדיין לא הושלם. אפשר לנסות שוב בעוד רגע או לפנות לתמיכה ונעזור מיד.',
      errorButton:        'חזרה לדף הבית',
      pageTitle:          'גיבורים קטנים — יוצרים את הספר שלכם',
      statusInitial:      'מתחילים לכתוב ספר שמותאם בדיוק לכם',
    },

    /* ── READY PAGE ──────────────────────────────────────────────── */
    ready: {
      loadingText:       'טוענים את הספר שלכם...',
      errorTitle:        'משהו השתבש בדרך',
      errorBack:         'חזרה לדף הבית',
      errorNotFound:     'לא מצאנו את ההזמנה שלכם. אנא צרו קשר עם התמיכה.',
      errorLoadFailed:   'הספר עדיין לא נטען. רענון קצר בדרך כלל פותר את זה.',
      errorNetworkFail:  'יש כרגע הפרעה בחיבור. נסו שוב בעוד רגע.',
      errorMissingOrder: 'פרטי ההזמנה חסרים. אנא חזרו לדף הראשי ונסו שוב.',
      errorMessage:      'הספר עדיין לא נטען. רענון קצר בדרך כלל פותר את זה.',
      errorButton:       'חזרה לדף הבית',
      headline:          'זה הסיפור שיצרנו עבורו',
      dedicationPrefix:  'הסיפור האישי של {name}',
      btnRead:           'לקריאה עכשיו',
      btnAudio:          '🎧 להאזין לסיפור',
      btnPdf:            'קובץ מוכן להדפסה',
      saveHint:          'אפשר לחזור לסיפור הזה בכל זמן',
      copyLabel:         'העתקת הקישור',
      copiedLabel:       'הועתק! ✓',
      copyBtnAriaLabel:      'העתק קישור לספר',
      pageTitle:             'גיבורים קטנים — הספר שלכם מוכן!',
    },

    /* ── READER PAGE ─────────────────────────────────────────────── */
    reader: {
      loadingText:       'פותחים את הספר...',
      errorTitle:        'לא הצלחנו לפתוח את הספר',
      errorDefault:      'אפשר לנסות שוב או לחזור לדף הספר.',
      errorNotFound:     'לא מצאנו כרגע את ההזמנה. אפשר לחזור לדף הספר ולנסות שוב.',
      errorLoadFailed:   'הספר עדיין לא נטען. רענון קצר בדרך כלל פותר את זה.',
      errorNoPages:      'הספר לא מכיל עמודים. אנא צרו קשר עם התמיכה.',
      errorNetworkFail:  'יש כרגע הפרעה בחיבור. נסו שוב בעוד רגע.',
      errorMissingOrder: 'פרטי ההזמנה חסרים. אנא חזרו לדף הראשי ונסו שוב.',
      navBack:           'חזרה לספר',
      pageNum:           'עמוד {current}',
      coverPageNum:      'כריכה',
      progress:          'עמוד {current} מתוך {total}',
      coverProgress:     'כריכה · עמוד {current} מתוך {total}',
      btnPrev:           'הקודם',
      btnNext:           'הבא',
      btnFinish:         'סיום הסיפור ✨',
      audioPlay:            'נגן',
      audioPause:           'השהה',
      pageTitle:            'גיבורים קטנים — קריאת הסיפור',
      audioTrackAriaLabel:  'מיקום בהקראה',
      navAriaLabel:         'ניווט בין עמודים',
      btnPrevAriaLabel:     'עמוד קודם',
      btnNextAriaLabel:     'עמוד הבא',
    },

  },
};

const REQUIRED_CONTENT_KEYS = {
  he: {
    generating: [
      'headline',
      'statusInitial',
      'stallMessage',
      'completionMessage',
      'pageTitle',
      'errorTitle',
      'errorNotFound',
      'errorFailed',
      'errorMissingOrder',
      'errorBack',
      // Optional canonical aliases for future consumers.
      'errorMessage',
      'errorButton',
    ],
    ready: [
      'loadingText',
      'headline',
      'dedicationPrefix',
      'btnRead',
      'btnAudio',
      'btnPdf',
      'saveHint',
      'copyLabel',
      'copiedLabel',
      'copyBtnAriaLabel',
      'pageTitle',
      'errorTitle',
      'errorNotFound',
      'errorLoadFailed',
      'errorNetworkFail',
      'errorMissingOrder',
      'errorBack',
      // Optional canonical aliases for future consumers.
      'errorMessage',
      'errorButton',
    ],
  },
};

function validateContentContract(content, schema) {
  const missing = [];
  Object.entries(schema).forEach(([locale, sections]) => {
    Object.entries(sections).forEach(([sectionName, keys]) => {
      keys.forEach((key) => {
        const value = content?.[locale]?.[sectionName]?.[key];
        if (typeof value !== 'string' || value.trim() === '') {
          missing.push(`${locale}.${sectionName}.${key}`);
        }
      });
    });
  });
  if (missing.length > 0) {
    const message = `[CONTENT CONTRACT] Missing keys: ${missing.join(', ')}`;
    const isDev =
      typeof window !== 'undefined' &&
      window.location &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');
    if (isDev) {
      throw new Error(message);
    } else {
      console.error(message);
    }
  }
}

validateContentContract(CONTENT, REQUIRED_CONTENT_KEYS);
window.CONTENT = CONTENT;

// ─── t() — locale-aware string accessor with {placeholder} interpolation ──────
// Load this script FIRST on every page (before wizard.js, generating.js, etc.)
(function () {
  var locale  = (document.documentElement.lang || 'he').split('-')[0];
  var strings = window.CONTENT[locale] || window.CONTENT.he;

  /**
   * t("reader.pageNum", { current: 3 })  →  "עמוד 3"
   * t("wizard.topics")                   →  Array (returned as-is)
   */
  window.t = function t(path, vars) {
    var keys = path.split('.');
    var val  = strings;
    for (var i = 0; i < keys.length; i++) {
      if (val == null) return path;
      val = val[keys[i]];
    }
    if (val == null) return path;
    if (typeof val !== 'string') return val;   // return arrays/objects as-is
    if (!vars) return val;
    return val.replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] != null ? vars[k] : '';
    });
  };
})();
