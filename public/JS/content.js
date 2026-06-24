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
      navCta:  'ליצירת הספר',
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
        badge:
          'חבילה אחת לילד שלכם — ספר דיגיטלי, קריינות, סרטון וכרטיס כוח',
        h1:          'משהו קשה לילד שלכם עכשיו?',
        sub:
          'הילד/ה שלכם לא לבד עם מה שקשה לו/ה. אתם מספרים מה הוא עובר — ואנחנו בונים ספר אישי בעברית: דמות בהשראתו, חבר מלווה, סיפור שמדבר אליו, וסוף שנותן משהו קטן לקחת הלאה.',
        ctaPrimary:  'ליצור ספר לילד שלי',
        ctaSecondary:'לראות דוגמה',
        bullets: [
          'נכתב סביב מה שהילד באמת עובר',
          'הדמות חיה את מה שהילד מרגיש',
          'לקרוא, להאזין, לצפות ולהחזיק — הכל בחבילה אחת',
        ],
        ctaNote: 'דקה שאלון · ספר דיגיטלי · קריינות · סרטון · כרטיס כוח · בעברית',
      },

      helps: {
        h2:  'מתי זה מתאים?',
        sub: 'אם אחד מהמצבים האלה מרגיש מוכר — הספר יכול לעזור לילד להרגיש פחות לבד.',
        /** Filled at load by canonical-topics.js (9 homepage-visible topics). */
        cards: [],
      },

      trust: {
        h2: 'אנחנו יודעים שמדובר בילד שלכם — לא בסתם מוצר.',
        pillars: [
          {
            icon: '🔒',
            title: 'התמונה שלכם נשמרת בזהירות',
            body:
              'התמונה משמשת רק כדי לעזור ליצור דמות מאוירת שמזכירה את הילד/ה, ונמחקת מהמערכת שלנו עם סיום יצירת הספר. היא לא נמכרת ולא מוצגת בספר.',
          },
          {
            icon: '✨',
            title: 'בדיקה אנושית לפני שליחה',
            body: 'בתקופת ההשקה כל ספר עובר עין אנושית לפני שהוא נשלח אליכם.',
          },
          {
            icon: '📖',
            title: 'עברית טבעית, מותאמת לגיל',
            body: 'הסיפור נכתב בעברית לילדים, בשפה ובעומק שמתאימים לגיל שהזנתם.',
          },
        ],
      },

      earlyStage: {
        line:
          'Small Heroes עדיין בתחילת הדרך. אנחנו משפרים, מוסיפים סיפורים, ומקשיבים לכל משפחה בדרך.',
      },

      gallery: {
        h2:  'ככה זה נראה מבפנים',
        sub: 'כל עמוד מצוייר במיוחד. הסגנון חם, הפרטים אישיים — והילד מגלה את עצמו בתוך הסיפור.',
        cta: 'לראות איך זה נראה',
        toggleStyle01: 'ריאליסטי מאוייר',
        toggleStyle02: 'עולם קסום',
        style02PreviewNote: 'עולם קסום — בבדיקות איכות, ייפתח בהמשך',
      },

      why: {
        h2:  'מה מקבלים',
        sub: 'בכל ספר — ספר דיגיטלי, קריינות, סרטון וכרטיס כוח. הכל כלול, בלי תוספות.',
        cards: [
          { title: '📖 ספר דיגיטלי מאויר', body: 'סיפור בעברית, מותאם למה שהילד עובר, עם דמות בהשראתו וחבר מלווה — עמוד אחר עמוד.' },
          { title: '🎧 קריינות להאזנה', body: 'ספר מוקרא בקול שבוחרים — מושלם לקריאה משותפת או להאזנה לפני שינה.' },
          { title: '🎬 סרטון לשיתוף', body: 'סרטון קצר מהספר — לשיתוף עם המשפחה או לצפייה חוזרת יחד.' },
          { title: '🃏 כרטיס כוח אישי', body: 'כרטיס כוח להורדה — קובץ איכותי מוכן להדפסה, עם מסר ותזכורת מהסיפור, שילד/ה יכול/ה להחזיק כשקשה.' },
        ],
      },

      sample: {
        kicker: 'דוגמה מתוך ספר אמיתי שיצרנו · פחד בלילה, עם אוּרי השועל',
        h2:     'כשצליל קטן בלילה הופך למנגינה',
        p1:     'בספר לדוגמה, נועה שומעת טפטוף מסתורי ליד החלון. יחד עם אוּרי השועל היא יוצאת לבדוק מה קורה — ובדרך מגלה שהצליל המפחיד יכול להפוך למשחק קטן, מצחיק ומרגיע.',
        caption: 'הצצה מספר לדוגמה. האיורים והטקסט משתנים לפי הילד/ה והאתגר שנבחר.',
        cta:    'ליצור ספר לילד שלי',
      },

      how: {
        h2: 'איך זה עובד?',
        steps: [
          { title: '✍️ אתם מספרים לנו עליו', body: 'מה קשה לו, מה עוזר לו, ומה הייתם רוצים שירגיש. לוקח דקה.' },
          { title: '📖 הסיפור נבנה — רק בשבילו', body: 'סיפור אישי, דמות בהשראת הילד/ה, ואיורים שמלווים כל רגע. הכל מותאם למה שסיפרתם.' },
          { title: 'מה הלאה', body: 'ספר דיגיטלי לקריאה, קריינות להאזנה, סרטון לשיתוף, וכרטיס כוח להורדה — קובץ איכותי מוכן להדפסה — מוכן אחרי בדיקת האיכות.' },
        ],
      },

      pricing: {
        h2:   'בחרו את הסיפור שמתאים לכם',
        sub:  'כל ספר כולל ספר דיגיטלי, קריינות, סרטון וכרטיס כוח — בלי תוספות.',
        note: 'בתקופת ההשקה לא כל חוויה זמינה לכל אתגר — אחרי בחירת האתגר תראו מה פתוח עכשיו.',
        cards: [
          {
            kicker: 'סיפור לפני שינה', name: 'ספר לילה טוב אישי', pages: '16 עמודים', price: '59',
            desc: 'לילד שצריך רגיעה לפני שינה — סיפור שקט, מסר ברור, ואווירה מרגיעה.',
            features: ['ספר דיגיטלי מאויר', 'קריינות מקצועית', 'סרטון slideshow לשיתוף', 'כרטיס כוח להורדה — קובץ איכותי מוכן להדפסה'],
            cta: 'מתאים לנו — ספר לילה טוב', featured: false,
          },
          {
            kicker: 'הרפתקה', name: 'הרפתקה אישית', pages: '24 עמודים', price: '79',
            badge: 'בחירת ההשקה',
            desc: 'לילד שצריך אומץ מול משהו חדש או מפחיד — הרפתקה עם התפתחות רגשית.',
            features: ['ספר דיגיטלי מאויר', 'קריינות מקצועית', 'סרטון slideshow לשיתוף', 'כרטיס כוח להורדה — קובץ איכותי מוכן להדפסה'],
            cta: 'זה מה שמתאים לנו', featured: true,
          },
          {
            kicker: 'פנטזיה', name: 'ספר פנטזיה אישי', pages: '32 עמודים', price: '99',
            desc: 'לילד עם דמיון עשיר — עולם פנטזיה מלא, עומק ורגעים שנבנים לאט.',
            features: ['ספר דיגיטלי מאויר', 'קריינות מקצועית', 'סרטון slideshow לשיתוף', 'כרטיס כוח להורדה — קובץ איכותי מוכן להדפסה'],
            cta: 'חוויה מלאה — מתאים לנו', featured: false,
          },
        ],
      },

      faq: {
        h2:  'שאלות נפוצות',
        sub: 'תשובות ישרות — בלי הבטחות מיותרות.',
        items: [
          { q: 'האם הסיפור באמת מותאם אישית?',     a: 'כן. הספר נבנה לפי מה שאתם מזינים — שם הילד, גיל, מה קשה לו, מה עוזר לו, ואיזה שינוי הייתם רוצים לראות. זה לא תבנית עם שם.' },
          { q: 'האם הילד באמת ייראה כמו בתמונה?',   a: 'הדמות נשענת על התמונה — גיל, שיער, גוונים, הבעת פנים כללית — אבל זו איור מותאם, לא העתק פוטוגרפי. המטרה: שיזהה את עצמו בספר, לא שייראה כמו צילום.' },
          { q: 'לאיזה גיל זה מתאים?',               a: 'השפה והעומק מותאמים לגיל שהזנתם — כך שהסיפור מרגיש נכון לילד/ה שלכם.' },
          { q: 'מתאים גם לילדים רגישים במיוחד?',     a: 'בהחלט. אתם בוחרים מה נכנס לסיפור ומה לא — חושך, דמויות מפחידות, מצבים מלחיצים. הספר נבנה כך שירגיש בטוח.' },
          { q: 'זה תחליף לטיפול רגשי?',              a: 'לא. זה כלי עדין שמשלים — לא מחליף. המטרה היא שהילד ירגיש שהוא לא לבד עם מה שקשה לו.' },
          { q: 'תוך כמה זמן הספר מוכן?',             a: 'בתקופת ההשקה אנחנו בודקים כל ספר לפני שליחה, כדי לוודא שהטקסט, האיורים וההתאמה לילד/ה נראים טוב. נעדכן אתכם כשהספר מוכן.' },
          { q: 'חייבים להעלות תמונה של הילד?',       a: 'לא חובה. תמונה עוזרת לדמות להרגיש יותר אישית; בלעדיה הספר עדיין עובד — עם תיאור שאתם נותנים.' },
          { q: 'מה קורה עם התמונה אחרי יצירת הספר?', a: 'התמונה משמשת רק כדי לעזור ליצור דמות מאוירת שמזכירה את הילד/ה, ונמחקת מהמערכת שלנו עם סיום יצירת הספר. היא לא נמכרת ולא מוצגת בספר.' },
          { q: 'אפשר לתקן פרטים אחרי יצירת הספר?',    a: 'אם משהו חשוב לא מדויק — פנו אלינו דרך דף "הספרים שלי" או התמיכה, ונבדוק מה אפשר לעדכן.' },
          { q: 'מה אם לא מרוצים?',                    a: 'בתקופת ההשקה אנחנו בודקים כל ספר לפני מסירה. אם משהו לא מרגיש נכון — פנו אלינו וננסה לפתור יחד. מדיניות החזרים המלאה תפורסם עם תנאי השירות.' },
          { q: 'מה מקבלים בפועל?',            a: 'הספר מגיע כספר דיגיטלי לקריאה והאזנה בקורא האישי, עם סרטון לשיתוף. כרטיס הכוח — כרטיס כוח להורדה, קובץ איכותי מוכן להדפסה. הכל כלול בכל חבילה — בלי תוספות.' },
        ],
      },

      footer: {
        h2:               'מוכנים לתת לילד\nספר שנבנה בשבילו?',
        sub:              'הילד/ה שלכם לא לבד עם מה שקשה לו/ה. דקת שאלון — וסיפור שהוא יכול להחזיק בו כשקשה לו.',
        cta:              'ליצירת הספר — דקה',
      },
    },

    /* ── WIZARD ──────────────────────────────────────────────────── */
    wizard: {
      progressLabel: 'שלב {current} מתוך {total}',

      /* ── Micro-copy — warm acknowledgments between steps ──────── */
      /* These appear at the top of each step, after the parent moves forward. */
      microcopy: {
        companion: 'יופי. עכשיו — בואו נבחר מי הולך ללווה את הגיבור/ת במסע…',
        child:   'אנחנו מתחילים להכיר את הגיבור/ת שלכם…',
        heroNotes: 'יפה. אם תרצו — שתי מילים קצרות שיעזרו לנו להכיר אותו/ה.',
        style:   'עכשיו — איזה סגנון איור מדבר אליכם?',
        voice:   'הקריינות כלולה בכל ספר — בחרו מי יספר.',
        book:    'אפשר לתת לספר שם ומשפט הקדשה — ואז בוחרים את המוצר.',
        product: 'בחרו את הספר שמתאים לכם — הכל כלול, בלי תוספות.',
        summary: 'הסיפור מוכן. עוד רגע נסכם ונמשיך לתשלום.',
      },

      steps: {

        /* ── Step 1 — Topic ───────────────────────────────── */
        s2: {
          title: 'מה הילד שלכם עובר לאחרונה?',
          sub:   'בחרו את הדבר שהכי קרוב למה שקורה עכשיו',
        },

        /* ── Companion ───────────── */
        companion: {
          title: 'מי ילווה את הילד בסיפור?',
          sub:   'בחרו חבר שיביא איתו דרך קטנה להתמודד',
        },

        /* ── Child details (wizard step 4) + superpower ─── */
        s3: {
          title:              'איך נקרא לגיבור/ה של הספר?',
          sub:                'נשתמש בשם, בגיל ובתמונה כדי ליצור דמות מאוירת בהשראה אישית.',
          nameLabel:          'איך קוראים לו?',
          ageLabel:           'בן כמה הוא?',
          genderLabel:        'מין',
          genderBoy:          'בן',
          genderGirl:         'בת',
          genderOther:        'אחר',
          photoPrompt:        'כדי ליצור דמות שמבוססת עליו',
          photoOptional:      'כדי שהאיור יהיה דומה יותר, כדאי להעלות תמונה ברורה של הפנים. התמונה משמשת רק ליצירת הדמות המאוירת בספר.',
        },

        /* ── Hero notes (optional warmth — one screen) ───── */
            heroNotes: {
          titleFallback: 'כמה מילים על הגיבור/ה שלכם',
          titleTemplate: 'כמה מילים על {name}',
          sub: 'לא חובה — אבל זה יכול להפוך את הספר להרבה יותר אישי.',
          strengthQ: 'מה אתם אוהבים במיוחד ב{name}?',
          feelingQ: 'איך הייתם רוצים ש{name} ירגיש בסוף הסיפור?',
          skipCta: 'אפשר להמשיך גם בלי זה',
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

        /* ── Step 5 — Challenges (legacy keys; 9-step UI uses heroNotes) ─ */
        s4: {
          title:   'כמה מילים על {name}',
          sub:     'לא חובה — אבל זה יכול להפוך את הספר להרבה יותר אישי.',
          q1:      'מה אתם אוהבים במיוחד ב{name}?',
          q2:      'איך הייתם רוצים ש{name} ירגיש בסוף הסיפור?',
          skipCta: 'אפשר להמשיך גם בלי זה',
        },

        /* ── Step 6 — Goals ───────────────────────────────── */
        s5: {
          title: 'איך הייתם רוצים שירגיש בסוף הסיפור?',
          sub:   'בחרו את התחושה שאתם רוצים שיישאר איתה',
          sub2:  'אפשר לבחור יותר מאחד',
        },

        /* ── Step 7 — Helpers ─────────────────────────────── */
        s6: {
          title:            'מעבר לרגעים הקשים — מה גורם לו/ה להרגיש שלם/ה ביומיום?',
          sub:              'דברים, אנשים, או רגעים שתמיד מחזירים אותו/ה אל עצמו/ה',
          sub2:             'אפשר לבחור יותר מאחד',
          extraLabel:       'יש עוד משהו שעוזר?',
          extraPlaceholder: 'גם "שיר ספציפי שאמא שרה" או "להריח את הסבתא" — זו תשובה מושלמת',
        },

        /* ── Step 8 — Avoid ───────────────────────────────── */
        s7: {
          title:            'יש משהו שנוודא שלא יכנס?',
          sub:              'כל ילד/ה ראוי/ה לסיפור שמחזיק אותם בדיוק כמו שהם',
          sub2:             'אפשר לבחור יותר מאחד',
          extraLabel:       'יש משהו ספציפי שחשוב לדעת?',
          extraPlaceholder: 'כל דבר שיעזור לנו לשמור את הסיפור בטוח...',
        },

        /* ── Step 12 — Style ─────────────────────────────── */
        sStyle: {
          title: 'באיזה סגנון נאייר את הספר?',
          sub:  'הסגנון קובע את התחושה הוויזואלית של הספר.',
        },

        /* ── Step 6 — Voice + sleep mode ─────────────────── */
        voice: {
          title: 'הקול שיקריא את הספר',
          subTemplate: 'הקריינות כלולה בכל ספר — בחרו מי יספר ל{name}.',
          subFallback: 'הקריינות כלולה בכל ספר — בחרו מי יספר.',
          voicePreview: 'האזינו לדוגמה',
          sleep: { name: 'מותאם לשינה 🌙', desc: 'טון רגוע יותר, הפסקות ארוכות יותר' },
        },

        /* ── Step 8 — Product cards ──────────────────────── */
        product: {
          title: 'איזה ספר מתאים לכם?',
          sub:   'כל המוצרים כוללים ספר דיגיטלי, קריינות, PDF וכרטיס כוח — בחרו לפי אורך ואווירה.',
          ctaChoose: 'לבחירה',
          ctaSelected: 'זו הבחירה שלי',
          bestForLabel: 'מתאים במיוחד ל:',
          includesLabel: 'כלול במחיר:',
        },

        /* ── Step 9 — Summary + Payment ─────────────────── */
        s9: {
          title:       'הספר של {name} מוכן לצאת לדרך',
          sub:         'רגע לפני התשלום — הנה מה שבחרתם.',
          cardBookTitle:    'הסיפור שבחרתם',
          cardDetailsTitle: 'פרטי הילד והסיפור',
          card1Title:  'מה יהיה בספר',
          card2Title:  'סה"כ לתשלום',
          card3Title:  'לאן לשלוח?',
          nameLabel:   'שם מלא',
          emailLabel:  'אימייל',
          submitBtn:   'המשך לתשלום מאובטח',
          paymentLogos:'התמונה משמשת ליצירת דמות מאוירת בהשראה אישית בלבד.',
          paymentLogosNoPhoto: 'התמונה משמשת ליצירת דמות מאוירת בהשראה אישית בלבד.',
        },
      },

      nav: {
        continueDefault:   'ממשיכים',
        continueToFamily:  'ממשיכים',
        continueToStory:   'ממשיכים לסיפור',
        continueToPackage: 'ממשיכים לבחירת חבילה',
        continueToDirection: 'ממשיכים לבחירת כיוון',
        continueToStyle: 'ממשיכים לסגנון האיורים',
        continueToSummary: 'ממשיכים לסיכום',
        back:              'חזור',
      },

      /** Filled at load by canonical-topics.js (10 wizard topics). */
      topics: [],

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

      // `pages` here = PHYSICAL pages for display ONLY (beats × 2; engine
      // counts are 8/12/16 beats in backend/config/wizard.ts).
      productPackages: [
        {
          id: 'bedtime',
          productName: 'ספר לילה טוב אישי',
          tagline: 'סיפור קצר, רגוע ומחבק לפני השינה.',
          pages: 16,
          priceILS: 59,
          bestFor: [
            'פחד מהחושך',
            'קולות בחדר בלילה',
            'מחשבות לפני שינה',
            'עצב רך, פרידה מהיום',
          ],
          includes: [
            { icon: 'book',  label: 'ספר דיגיטלי מאויר' },
            { icon: 'audio', label: 'קריינות מקצועית' },
            { icon: 'pdf',   label: 'PDF להדפסה ביתית' },
            { icon: 'card',  label: 'כרטיס כוח אישי (Power Card)' },
          ],
          palette: 'moonlit',
        },
        {
          id: 'adventure',
          productName: 'הרפתקה אישית',
          tagline: 'מסע אישי עם אתגר, פעולה וחבר מלווה.',
          pages: 24,
          priceILS: 79,
          bestFor: [
            'כעס, תסכול',
            'לא מצליח/ה / לא מנצח/ת',
            'ביישנות, קושי חברתי',
            'חרדת רופא שיניים / רופא',
            'ניסיון של משהו חדש וקשה',
          ],
          includes: [
            { icon: 'book',  label: 'ספר דיגיטלי מאויר' },
            { icon: 'audio', label: 'קריינות מקצועית' },
            { icon: 'pdf',   label: 'PDF להדפסה ביתית' },
            { icon: 'card',  label: 'כרטיס כוח אישי (Power Card)' },
          ],
          palette: 'earth-warm',
        },
        {
          id: 'fantasy',
          productName: 'ספר פנטזיה אישי',
          tagline: 'ספר קסום ועשיר עם עולם מלא ודמיון גדול.',
          pages: 32,
          priceILS: 99,
          bestFor: [
            'גן/בית ספר חדש',
            'מעבר דירה',
            'אח/אחות חדש/ה',
            'עומס חושי',
            'מעברים גדולים, ביטחון עצמי',
          ],
          includes: [
            { icon: 'book',  label: 'ספר דיגיטלי מאויר' },
            { icon: 'audio', label: 'קריינות מקצועית' },
            { icon: 'pdf',   label: 'PDF להדפסה ביתית' },
            { icon: 'card',  label: 'כרטיס כוח אישי (Power Card)' },
            { icon: 'video', label: 'סרטון slideshow לשיתוף' },
            { icon: 'gift',  label: '30% הנחה לספר הבא' },
          ],
          palette: 'magical-cool',
        },
      ],

      // Static mirror of `WIZARD_ILLUSTRATION_STYLES` in `lib/styles.ts` (ids, labels, blurbs). Change both together.
      styles: [
        {
          id: 'soft_hand_drawn_storybook',
          label: 'ריאליסטי מאוייר',
          description:
            'איור ריאליסטי וחם, עם דמויות שמרגישות קרובות ולא מאיימות.',
        },
        {
          id: 'detailed_whimsical_world',
          label: 'עולם קסום',
          description:
            'עולם פנטזיה עשיר וקולנועי — אור דרמטי, פרטים בכל פינה, קסם ועומק. סגנון פרימיום שמרגיש כמו ספר הרפתקאות יוקרתי.',
        },
      ],

      voices: [
        { id: 'mom',         label: 'אמא',         emoji: '👩' },
        { id: 'dad',         label: 'אבא',         emoji: '👨' },
        { id: 'grandma',     label: 'סבתא',        emoji: '👵' },
        { id: 'dad_thick',   label: 'אבא עם קול עבה',  emoji: '👨' },
        { id: 'big_sister',  label: 'אחות גדולה',      emoji: '👧' },
        { id: 'big_brother', label: 'אח גדול',     emoji: '🧒' },
        { id: 'fairy',       label: 'פייה קסומה',  emoji: '🧚' },
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
        powerCardLabel: 'כרטיס כוח להדפסה:',
        packagePrefix:  'חבילה:',
        stylePrefix:    'סגנון:',
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
      statusInitial:      'אוספים את הפרטים שלכם...',
      statusCollecting:   'אוספים את הפרטים שלכם...',
      statusWriting:      'כותבים את הסיפור...',
      statusIllustrating: 'מציירים את האיורים...',
      statusAssembling:   'מרכיבים את הספר...',
      statusAlmostReady:  'כמעט מוכן...',
      etaTemplate:        'בעוד כ-{minutes} דקות',
      etaSoon:            'עוד רגע קטן',
      reassure:           'זה לוקח כמה דקות — אפשר להישאר כאן ולראות את ההתקדמות.',
      closeNote:          'אפשר לסגור את החלון, נשלח לכם אימייל כשהספר מוכן.',
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
