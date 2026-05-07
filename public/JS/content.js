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
      },

      why: {
        h2:  'למה זה שונה?',
        sub: 'יש הרבה ספרי ילדים עם שם מותאם. זה לא אחד מהם.',
        cards: [
          { title: '💜 לא תבנית — סיפור שנולד ממה שהוא מרגיש', body: 'אתם מזינים מה קשה לו, מה עוזר לו, ומה הייתם רוצים שירגיש. הסיפור, הדמויות והמסר נבנים לפי זה — מאפס.' },
          { title: '🎨 שני סגנונות איור — אתם בוחרים', body: 'סגנון מאוייר חם או ריאליסטי עשיר. כל עמוד נוצר מחדש כך שהילד ירגיש שהספר הזה שייך רק לו.' },
          { title: '⚡ בלי לחכות — הספר נוצר לפניכם',  body: 'ממלאים שאלון קצר, בוחרים חבילה — ותוך דקות הספר מוכן לקריאה דיגיטלית, עם אפשרות לקריינות ו-PDF.' },
        ],
      },

      sample: {
        kicker: 'דוגמה אמיתית — ספר שנוצר ליובל, בן 4, מעבר לגן חדש',
        h2:     'הילד שלכם — בתוך הסיפור שלו',
        p1:     '',
        p2:     'כל ספר מבוסס על מה שהילד חווה — הדמות מתמודדת, מתגברת, ומגיעה לסוף שנותן לו משהו להחזיק בו.',
        cta:    'אני רוצה ספר כזה לילד שלי',
        quote:  'יובל הביט בדלת הגן החדש ובלע רוק. הכל פה היה שונה — הצבעים, הריח, הילדים. הדובי הקטן שבתיק לחץ לו על הגב כאילו אמר: "אני פה." יובל נשם עמוק, עשה צעד קטן קדימה, ואז עוד אחד. מישהו חייך אליו מהפינה.',
      },

      how: {
        h2: 'איך זה עובד?',
        steps: [
          { title: '✍️ אתם מספרים לנו עליו', body: 'מה קשה לו, מה עוזר לו, ומה הייתם רוצים שירגיש. לוקח 3 דקות.', note: 'אתם קובעים מה נכנס לסיפור ומה לא — בלי הפתעות.' },
          { title: '📖 הסיפור נכתב — רק בשבילו', body: 'עלילה מקורית, דמות שנראית כמוהו, ואיורים שמלווים כל רגע. הכל מותאם למה שסיפרתם.' },
          { title: '🎧 קוראים, שומעים, שומרים', body: 'ספר דיגיטלי מלא שמוכן מיד. אפשר להוסיף קריינות מקצועית או להוריד PDF לקריאה אופליין.' },
        ],
      },

      pricing: {
        h2:   'בחרו את החבילה שמתאימה לכם',
        sub:  'כל ספר נוצר אישית — ההבדל הוא באורך הסיפור ובעומק החוויה.',
        note: '',
        cards: [
          {
            kicker: 'להתחלה נעימה', name: 'ספר קצר', pages: '10 עמודים', price: '49',
            desc: 'סיפור ממוקד עם מסר רגשי ברור — מושלם לפני השינה.',
            features: ['10 עמודים עם איורים מקוריים', 'דמות מותאמת אישית', 'מתאים לילדים עד גיל 4'],
            cta: 'מתחילים בקטן', featured: false,
          },
          {
            kicker: 'הבחירה הפופולרית', name: 'ספר בינוני', pages: '15 עמודים', price: '59',
            badge: 'הבחירה של רוב ההורים',
            desc: 'הסיפור המלא — מספיק עמוק כדי לרגש, קליל מספיק לקריאה נעימה.',
            features: ['15 עמודים עם איורים מקוריים', 'דמות מותאמת + דמויות משנה', 'עלילה עם התפתחות רגשית מלאה'],
            cta: 'זה מה שאני רוצה', featured: true,
          },
          {
            kicker: 'החוויה המלאה', name: 'ספר מלא', pages: '20 עמודים', price: '69',
            desc: 'ספר עשיר עם עולם שלם — רגעים שנבנים לאט, עומק אמיתי.',
            features: ['20 עמודים עם איורים מקוריים', 'עלילה מפותחת עם שכבות רגשיות', 'מעולה לילדים שאוהבים סיפורים ארוכים'],
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
        s5:  'המשפחה בפנים. עכשיו — מה קורה בחייהם?',
        s6:  'הבנו. הסיפור ידע בדיוק מה לגעת בו.',
        s7:  'יש לנו לאן ללכת. עכשיו נמצא את הכלים.',
        s8:  'מעולה. עוד רגע הסיפור מתחיל לקבל צורה.',
        s9:  'כמעט שם. בואו נבחר איך הספר ייראה.',
        s10: 'הסיפור מוכן לצאת לדרך.',
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
          title:            'במה הילד שלכם חזק במיוחד?',
          sub:              'בחרו מהכוחות שמתאימים לו/ה — אפשר יותר מאחד.',
          extraLabel:       'יש כוח נוסף שלא מופיע כאן?',
          extraPlaceholder: 'כתבו במילים שלכם (לא חובה)',
        },

        /* ── Step 4 — Family context ──────────────────────── */
        s4fam: {
          title:        'מי עוד בסיפור',
          sub:          'אפשר להוסיף עד 2 דמויות נוספות (לא חובה)',
          sub2:         'רק מה שיעזור לסיפור להרגיש מוכר ובטוח עבור הילד שלכם.',
          parent1Label: 'מי הכי שם בשביל/ה כשקשה?',
          parent1NamePh:'שם (אמא, אבא, סבתא...)',
          parent1DescPh:'מה הוא/היא עושה שתמיד עוזר? (לא חובה)',
          parent2Label: 'יש עוד מישהו/י שחשוב/ה לו/ה? (לא חובה)',
          parent2NamePh:'שם',
          parent2DescPh:'מה מיוחד בו/ה בעיניו/ה?',
          siblingLabel: 'יש אח/ות שנמצא/ת בתמונה? (לא חובה)',
          siblingNamePh:'שם',
          siblingAgePh: 'גיל',
          siblingDescPh:'מילה אחת עליהם...',
          homeLabel:    'איפה הסיפור קורה? (לא חובה)',
          homePh:       'תל אביב, קיבוץ, בית עם גינה...',
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
          title: 'לאן הייתם רוצים שהסיפור יוביל אותו/ה?',
          sub:   'אפשר לחלום — הסיפור יאסוף את זה',
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

        /* ── Step 9 — Package ─────────────────────────────── */
        s8: {
          title:          'איזה סגנון איור הכי מתאים לסיפור?',
          sub:            'הדמות תיווצר בסגנון ספר ילדים, בהשראת התמונה',
          lengthTitle:    'כמה עמודים?',
          styleLabel:     'סגנון האיורים',
          addonsExpanded: 'הפכו את הסיפור לחוויה מלאה',
          addonsCollapsed:'רוצים לשדרג?',
          addonsSub:      '*בתוספת תשלום קטנה',
          totalLabel:     'סה"כ לתשלום:',
          audio:  { badge: 'הכי פופולרי',  name: 'קריינות (+₪19)', desc: 'הקראה נעימה לפני השינה' },
          pdf:    { badge: 'מושלם כמתנה',  name: 'PDF (+₪12)',     desc: 'הורידו והדפיסו כספר פיזי' },
          bundle: { badge: 'חסכו ₪6',      name: 'קומבו (+₪25)',   desc: 'קריינות + PDF יחד' },
          voiceTitle:   'קריינות (+₪19)',
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
        { id: 'night',         label: 'פחדים בלילה'            },
        { id: 'sirens',        label: 'קולות ואזעקות'         },
        { id: 'general_fears', label: 'פחדים אחרים'            },
        { id: 'anger',         label: 'כעס ותסכול'            },
        { id: 'sensitivity',   label: 'רגישות ועומס רגשי'     },
        { id: 'social',        label: 'חברויות ומפגשים'        },
        { id: 'confidence',    label: 'ביטחון וערך עצמי'      },
        { id: 'sibling',       label: 'אח או אחות חדשים'      },
        { id: 'transition',    label: 'מעברים גדולים'         },
        { id: 'focus',         label: 'קשב, סקרנות ולמידה'   },
        { id: 'other',         label: 'נושא אחר'              },
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

      lengths: [
        { id: 'long',   label: 'ארוך',   pages: '20 עמודים' },
        { id: 'medium', label: 'בינוני', pages: '15 עמודים' },
        { id: 'short',  label: 'קצר',    pages: '10 עמודים' },
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
        lengthLabel:    'אורך:',
        styleLabel:     'סגנון:',
        audioLabel:     'קריינות:',
        pdfLabel:       'PDF:',
        sleepLabel:     'מצב שינה:',
        ageFormat:      '· גיל {age}',
        bookDigital:    'ספר דיגיטלי {length}',
        bundleLabel:    'קריינות + PDF (חבילה)',
        audioAddon:     'קריינות 🎧',
        pdfAddon:       'PDF 📥',
        totalLabel:     'סה"כ לתשלום:',
        defaultHero:    'הגיבור/ה שלכם',
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
      btnPdf:            'הורד PDF',
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
