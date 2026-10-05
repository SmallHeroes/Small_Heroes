import { LANDING_COPY, type LandingContent } from './landing';

export const PERSONAL_PRODUCT_METADATA = {
  title: 'ספר ילדים אישי שנכתב במיוחד לילד שלכם | גיבורים קטנים',
  description: 'ספר הרפתקה אישי בעברית שנכתב סביב מה שתספרו על הילד: הדברים שהוא אוהב, חבר שתבחרו ומקום להתמודדות. יצירת הספר המלא עדיין בפיתוח.',
};

/**
 * Right after the hero (site audit 2026-10-01, and the spec's "profile card and hand-written synthetic
 * excerpt"): what a parent said, and what it changed in the story. Yuval is the hero's first family and
 * the picture is her approved hero art; the excerpt is hand-written and labelled as such, never presented
 * as engine output. Buni behaves as his canonical card does: a brave announcement, ears that tell the truth.
 */
export const PERSONAL_PROOF = {
  kicker: 'דוגמה',
  title: 'איך פרט קטן הופך להרפתקה',
  lede: 'מה שתספרו על הילד משנה את מה שקורה בסיפור, לא רק את השם שעל הכריכה.',
  toldLabel: 'ההורה סיפר',
  told: ['זאת יובל, היא בת שש. בשבוע הבא יש לה חיסון, והיא ממש מפחדת.', 'היא אוהבת ארנבים, ורוצה שמישהו יחזיק לה את היד.', 'הכי הייתי רוצה שתצא משם גאה בעצמה.'],
  linksLabel: 'מה זה שינה בסיפור',
  links: [
    { detail: 'אוהבת ארנבים', story: 'בוני הארנבון יוצא איתה לדרך' },
    { detail: 'רוצה שיחזיקו לה את היד', story: 'דווקא היא מחזיקה את הכפה שלו' },
    { detail: 'יוצאת גאה', story: 'נכנסת בעצמה, והלב עוד דופק מהר' },
  ],
  storyLabel: 'בסיפור',
  image: '/Images/hero-beat-2.webp',
  imageAlt: 'יובל כורעת מול בוני הארנבון',
  story: [
    'בוני הודיע שהוא בכלל לא מפחד. האוזניים שלו נצמדו לגב.',
    'יובל הסתכלה על הדלת הכחולה, ואחר כך על הכפה הקטנה שלו.',
    '״בוא נעשה ככה,״ אמרה. ״אני מחזיקה לך את הכפה, ואתה סופר איתי עד שלוש.״',
    '״אחת,״ לחש בוני. ״שתיים…״',
    'בשלוש היא כבר הייתה בפנים. הלב שלה עוד דפק מהר, והסנטר היה מורם.',
  ],
  note: 'דוגמה ספרותית שכתבנו בעצמנו, עם שם ופרטים מומצאים. היא מראה את כיוון הכתיבה ואינה טקסט שהמנוע כתב.',
} as const;

/**
 * One line of character per companion card (site audit: a name and a look are not enough to choose a
 * friend). Paraphrased from the canonical material the personal writer uses (deep profiles; the authoring
 * cards for Leo and Buni; for the added friends, their candidate character profiles), and never the old
 * topic-bound arc: no friend is "for" one difficulty.
 */
export const PERSONAL_COMPANION_LINES: Record<string, string> = {
  dragon_dini: 'חמה ומעשית. מציבה כללים קטנים ורציניים, והזנב שלה לא תמיד מקשיב להם.',
  panda_anat: 'לא ממהרת לשום מקום. מגיעה אחרונה, ודווקא היא רואה את מה שכולם פספסו.',
  fox_uri: 'הופך כל דבר לא מוכר לחקירה קטנה. הפנס שלו מהבהב רגע לפני שהוא מודה שהוא לא בטוח.',
  chameleon_koko: 'סקרנית וזריזה, עם צבע לכל מצב רוח ומשחק מילים לכל מקום חדש.',
  lion_shaket: 'ישיר, חם ומלא אנרגיה. הרעמה שלו רועדת עוד לפני שהוא אומר מה מטריד אותו.',
  bunny_ometz: 'מכריז בהתלהבות על תוכניות גדולות. האוזניים שלו מספרות את האמת לפני שהוא מודה בה.',
  elephant_momo: 'חזק ועדין, ומתייחס ברצינות גמורה לכל פירור וכפתור. רוצה להפתיע במשהו יפה, לא רק לסחוב.',
  turtle_tuk: 'הרפתקן נלהב. הראש שלו כבר במקום הבא, והשריון עוד בדרך.',
  hedgehog_tuti: 'חמה, עצמאית וישירה. אומרת בדיוק מה לא מתאים לה, ואז מפנה לך מקום לידה.',
  owl_shush: 'סקרנית עם דמיון נועז. יש לה הסבר מלהיב כמעט לכל דבר, והיא שמחה עוד יותר כשהמציאות מפתיעה אותה.',
  cloud_puf: 'אוהב לצאת לדרך ונקשר לכל פינה ולכל מזכרת. מכריז שהוא נשאר פה, ורגע אחר כך ״פה״ כבר זז.',
  kangaroo_nula: 'יצירתית וממציאה. רואה שלושה שימושים בכל חפץ, ומחליפה רעיון עוד לפני שסיפרה לך על הקודם.',
  dog_zohar: 'נמרצת ואוהבת להמציא משחקים. רוצה שיראו את הרעיון שלה, אבל הזנב שלה מתחיל לפניה.',
};

/**
 * Landing card art for the six registry companions, keyed by companion (not by legacy category): the warm
 * full-figure "Start" art the page already shows. Added companions use their own card art from the roster.
 */
export const PERSONAL_COMPANION_ART: Record<string, string> = {
  dragon_dini: '/Images/Categories/StartDuni.webp',
  panda_anat: '/Images/Categories/StartAnat.webp',
  fox_uri: '/Images/Categories/StartUri.webp',
  chameleon_koko: '/Images/Categories/StartKim.webp',
  lion_shaket: '/Images/Categories/StartLeo.webp',
  bunny_ometz: '/Images/Categories/StartBuny.webp',
};

/** The friends row on the personal landing: it drifts slowly, pauses for the parent, and stops on request. */
export const PERSONAL_COMPANION_CAROUSEL = {
  label: 'החברים להרפתקה',
  pause: 'עצירת התנועה',
  play: 'המשך התנועה',
  choose: 'לבחור את',
} as const;

/** The one action this preview offers, named for what happens next (site audit). */
export const PERSONAL_START_LABEL = 'מספרים לנו על הילד';

/**
 * The hero's living stories (Guy's idea): a parent tells us about a child out loud, and each spoken line
 * brings up one moment of that child's adventure, tagged with what was said: the hard part, the friend,
 * the way through. Three invented families take turns; labelled as an illustration.
 * Yuval's three moments are the approved hero art. Bar's and Aviv's are stand-ins from the existing
 * gallery until their own consistent pictures exist (the child's look changes between pictures).
 */
export const PERSONAL_VOICE_STORIES = {
  label: 'המחשה: שמות מומצאים ואיורים קיימים',
  description: 'הדגמה: הורה מספר על הילד בקול, וכל משפט מעלה רגע מתוך ההרפתקה שלו, עם מה שנאמר: הקושי, החבר והדרך שנמצאה.',
  pause: 'עצירת ההדגמה',
  play: 'המשך ההדגמה',
  show: 'להציג את הסיפור של',
  stories: [
    {
      name: 'יובל',
      lines: [
        [
          { text: 'זאת ' },
          { text: 'יובל, היא בת שש.', sticker: 'יובל · בת 6' },
          { text: ' בשבוע הבא יש לה חיסון, ו' },
          { text: 'היא ממש מפחדת.', sticker: 'מפחדת מחיסונים' },
        ],
        [
          { text: 'היא ' },
          { text: 'אוהבת ארנבים', sticker: 'אוהבת ארנבים' },
          { text: ', ורוצה שמישהו יחזיק לה את היד.' },
        ],
        [
          { text: 'הכי הייתי רוצה ש' },
          { text: 'תצא משם גאה בעצמה.', sticker: 'יוצאת גאה' },
        ],
      ],
      beats: [{ image: '/Images/hero-beat-1.webp' }, { image: '/Images/hero-beat-2.webp' }, { image: '/Images/hero-beat-3.webp' }],
    },
    {
      name: 'בר',
      lines: [
        [
          { text: 'זה ' },
          { text: 'בר, הוא בן חמש.', sticker: 'בר · בן 5' },
          { text: ' בלילה ' },
          { text: 'החושך מפחיד אותו,', sticker: 'מפחד מהחושך' },
          { text: ' והוא לא מוכן לכבות את האור.' },
        ],
        [
          { text: 'הוא הכי ' },
          { text: 'אוהב שועלים ופנסים.', sticker: 'אוהב שועלים ופנסים' },
        ],
        [
          { text: 'הייתי רוצה שיגלה ש' },
          { text: 'גם בלילה יש הרפתקאות.', sticker: 'מגלה את הלילה' },
        ],
      ],
      beats: [{ image: '/Images/gallery/gallery-r-1.jpg' }, { image: '/Images/spotlight/fox_uri.png', portrait: true }, { image: '/Images/gallery/gallery-6.jpg' }],
    },
    {
      name: 'אביב',
      lines: [
        [
          { text: 'זאת ' },
          { text: 'אביב, היא בת ארבע.', sticker: 'אביב · בת 4' },
          { text: ' עברנו דירה, ו' },
          { text: 'היא התחילה גן חדש.', sticker: 'בית חדש וגן חדש' },
        ],
        [
          { text: 'בבקרים קשה לה להיפרד, והיא ' },
          { text: 'אוהבת פנדות.', sticker: 'אוהבת פנדות' },
        ],
        [
          { text: 'הייתי רוצה ש' },
          { text: 'תרגיש שוב בבית.', sticker: 'מרגישה בבית' },
        ],
      ],
      beats: [{ image: '/Images/gallery/gallery-4.jpg' }, { image: '/Images/spotlight/panda_anat.png', portrait: true }, { image: '/Images/gallery/gallery-5.jpg' }],
    },
  ],
} as const;

/**
 * The preview's "how it works", right after the hero, with the recording at its heart: talk, check and
 * complete, choose a friend for the journey. Every claim matches the wizard.
 */
export const PERSONAL_HOW_IT_WORKS = {
  kicker: 'איך זה עובד',
  title: ['מספרים עליו בקול.', 'אנחנו מסדרים את הפרטים.'],
  lede: 'בלי טפסים ארוכים. לוחצים על ההקלטה ומדברים כמו שהייתם מספרים לחברה קרובה, בכל סדר ובמילים שלכם.',
  steps: [
    { title: 'מדברים חצי דקה עד דקה', body: 'שם, גיל, איפה גרים, מה הוא אוהב ומה קצת קשה לו עכשיו. אפשר להקליט עד דקה וחצי.' },
    { title: 'בודקים ומשלימים', body: 'הפרטים מסודרים בכרטיס אחד. מתקנים או מסירים כל פרט, ועונים רק על מה שחסר. גם ״אין משהו מיוחד״ היא תשובה מלאה.' },
    { title: 'בוחרים חבר למסע', body: 'חבר או חברה עם אופי משלו יוצאים עם הילד להרפתקה. הבחירה פתוחה, בלי קשר לנושא.' },
  ],
  notes: ['המיקרופון נפתח רק כשלוחצים להקליט', 'לא נוח לדבר? אפשר לכתוב או לבחור מתשובות מוכנות', 'ההקלטה לא נשמרת אצלנו ולא משמשת לקריינות'],
  cta: PERSONAL_START_LABEL,
  previewNote: 'באתר ה־QA הפענוח החי כבוי ויש דוגמה מוכנה. ניסויים מקומיים נפרדים פתוחים לבודקים מורשים בלבד. כתיבת הספר המלא עדיין בפיתוח.',
};
/** Preview copy inside the approved design; no public rollout authority. */
export function getPersonalLandingContent(): LandingContent {
  return {
    ...LANDING_COPY,
    // The hero says what this is before the mood (site audit 2026-10-01): a book written for this child,
    // with adventure and room to cope, honest that it is still being built, and one action named for what
    // happens next. The facts under it are the wizard's own: ages 3-8, voice or writing, every detail approved.
    hero: { ...LANDING_COPY.hero, badge: 'ספר ילדים אישי בעברית · בפיתוח', h1Line1: 'ספר שנכתב במיוחד', h1Line2: 'לילד שלכם.', sub: 'הרפתקה חדשה סביב מה שתספרו עליו, עם הומור, חבר שתבחרו ודרך להתמודד עם מה שקשה. הספר עדיין בפיתוח: היום אפשר להתנסות בהיכרות ולקרוא דוגמה.', ctaPrimary: PERSONAL_START_LABEL, ctaSecondary: 'קוראים דוגמה', ctaNotes: ['לגילאי 3 עד 8', 'בקול, בכתב או בבחירה', 'אתם מאשרים כל פרט'] },
    // Three ideas, not five cards: the example above already shows them, the friends and the trust sections cover the rest.
    value: { h2: 'מה הופך את הספר לשלו?', lede: 'התחביבים, ההרגלים הקטנים ומה שתבחרו לשתף יכולים לשנות את ההרפתקה. אנחנו בוחרים מתוכם את מה שעוזר לספר סיפור טוב.', items: [
      { title: 'הדברים שהוא אוהב נכנסים לעלילה', body: 'תחביב, חיה אהובה או הרגל קטן הופכים לרעיון שמזיז את ההרפתקה, לא לפרט ברקע.' },
      { title: 'הוא בוחר ומשנה את מה שקורה', body: 'הוא מעלה רעיונות, מנסה, טועה ובוחר מה לעשות עכשיו.' },
      { title: 'לנושא שתבחרו יש מקום', body: 'נושא שתרצו לחזק משפיע על ההתרחשות ועל הבחירות, בלי הבטחה שהקושי ייעלם. אפשר גם בלי נושא.' },
    ] },
    helps: { ...LANDING_COPY.helps, h2: 'מי יצטרף להרפתקה?', lede: 'אתם בוחרים את החבר. התפקיד שלו נכתב כחלק מההרפתקה של הילד.', closing: 'החבר שתבחרו יוצא למסע עם אופי משלו ומשהו שגם הוא רוצה להשיג.' },
    sample: { ...LANDING_COPY.sample, kicker: 'הכיוון לחוויית הספר', h2Line1: 'הרפתקה שכיף לפגוש שוב.', h2Line2: 'עם מקום למה שמרגישים.', p1: 'נרצה שהילד יבקש לחזור אל ההפתעות, הבדיחות והחבר. בתוך ההרפתקה יהיו גם רגעים שבהם הוא בוחר, מבקש עזרה ומנסה דרך אחרת.', p2: 'האיורים ודוגמת הקול כאן הם המחשה. הם אינם ספר אישי חדש שהושלם במנוע.' },
    gallery: { ...LANDING_COPY.gallery, h2: 'עולם שכיף להיכנס אליו', sub: 'המחשות של איורים. האיורים והקריינות עדיין אינם מחוברים לטיוטה האישית.', cta: PERSONAL_START_LABEL },
    // No `how` override: the preview renders PERSONAL_HOW_IT_WORKS right after the hero instead of the shared section.
    // Resilience stays central (spec), shown as moments a child acts in rather than described in the abstract.
    why: { ...LANDING_COPY.why, h2: 'גם למה שקשה יש מקום בסיפור', lede: 'אפשר לשלב נושא שתרצו לחזק. בתוך ההרפתקה הילד בוחר, מבקש עזרה ומוצא דרכים להמשיך.', sub: 'הסיפור נותן לכם רגע משותף שאפשר לדבר ממנו גם על מה שקורה בחיים. רגעים כאלה, למשל:', cards: [
      { title: 'לומר מה צריך', body: '״תישאר לידי, אבל תן לי לנסות לבד.״' },
      { title: 'לנסות דרך אחרת', body: 'הגשר רועד? אפשר לעבור על האבנים, אחת אחרי השנייה.' },
      { title: 'לעזור וגם להיעזר', body: 'דווקא כשהחבר נבהל, הילד יודע מה לעשות.' },
      { title: 'צעד קטן ומשמעותי', body: 'הלב עוד דופק מהר, והוא נכנס בכל זאת. החשש יכול להישאר.' },
    ] },
    trust: { ...LANDING_COPY.trust, h2: 'הפרטים שלכם, הדמיון שלנו', lede: 'אתם קובעים מה נכון על הילד. אנחנו ממציאים את ההרפתקה שסביבו.', sub: 'ספר ילדים, לא טיפול ולא כלי אבחוני.', pillars: [
      { icon: '✓', title: 'פרטים שאתם מאשרים', body: 'מה שסיפרתם מוצג לבדיקה לפני שהוא נכנס לבקשה.' },
      { icon: '✓', title: 'חופש להמציא עולם', body: 'מקומות קסומים ואירועים הם בדיה. פרטים אמיתיים על המשפחה מגיעים מכם.' },
      { icon: '✓', title: 'טיוטה שאפשר לקרוא', body: 'רואים את הסיפור הכתוב לפני שמתקדמים לאיורים ולהפקת הספר.' },
    ] },
    earlyStage: { ...LANDING_COPY.earlyStage, line: 'תצוגת פיתוח. אפשר להתנסות בכרטיס הפרטים; חיבור הכתיבה בבדיקה. איורים, קריינות ורכישה עדיין אינם מחוברים למסלול האישי.' },
    pricing: { kicker: 'אורך ההרפתקה', h2: 'כמה מקום לתת להרפתקה?', sub: 'בכל אורך: הרפתקה עם דמיון, הומור וחבר לדרך.', note: 'אלה אפשרויות אורך באבטיפוס. המחיר והזמינות יפורסמו בהמשך. כל כפולה היא יחידת סיפור אחת.', cards: LANDING_COPY.pricing.cards.map((card, index) => ({ ...card, kicker: ['קצר', 'בינוני', 'ארוך'][index], name: ['הרפתקה ממוקדת', 'עוד מקום לגלות', 'מסע רחב יותר'][index], price: '', desc: ['מטרה ברורה ומעט תחנות בדרך.', 'עוד מקום להסתבכויות, להומור ולחברות.', 'יותר תחנות וקשרים בין תחילת הדרך לסופה.'][index], features: ['הרפתקה ופנטזיה', `${[8, 12, 16][index]} כפולות סיפור`], cta: 'לבחור אורך באשף' })) },
    faq: { h2: 'שאלות שהורים באמת רוצים לדעת', sub: 'תשובות ישרות, בלי הבטחות מיותרות.', items: [
      { q: 'מה מקבלים היום?', a: 'הספר עדיין בפיתוח. היום אפשר להתנסות בהיכרות ובכרטיס הפרטים, וכתיבת הסיפור נבדקת עם בודקים מורשים. איורים, קריינות ורכישה עוד לא מחוברים למסלול האישי, והמחיר יפורסם בהמשך.' },
      { q: 'לאיזה גיל זה מתאים?', a: 'האבטיפוס בנוי לילדים בגילאי 3 עד 8.' },
      { q: 'עד כמה הסיפור אישי?', a: 'הכוונה היא שהפרטים שתאשרו ישפיעו על המטרה, הרעיונות והבחירות בתוך הרפתקה חדשה. חיבור הכתיבה עדיין בבדיקה, ולא כל פרט צריך להופיע במפורש.' },
      { q: 'צריך לבחור קושי?', a: 'לא. אפשר להמשיך בלי קושי מסוים. חברות, גמישות ועזרה יכולות לצמוח מתוך ההרפתקה בלי להמציא לילד בעיה.' },
      { q: 'מי בוחר את החבר?', a: 'אתם בוחרים אחד מששת החברים, בלי קשר לקושי או לכיוון הסיפור.' },
      { q: 'מה קורה אם הפענוח טועה?', a: 'בודקים את מה שהבנו. אפשר לתקן או להסיר כל פרט לפני שממשיכים.' },
      { q: 'מה בסיפור אמיתי ומה דמיוני?', a: 'הפרטים על הילד והמשפחה מגיעים מכם. העלילה, העולם והאירועים הקסומים הם המצאה ספרותית.' },
      { q: 'אפשר בלי תמונה?', a: 'כן. התמונה אינה דרושה לכתיבת הסיפור. באבטיפוס היא מוצגת במכשיר בלבד.' },
      { q: 'מה קורה להקלטה?', a: 'ההקלטה והתמלול נשלחים לעיבוד אצל ספק חיצוני ואינם נשמרים אצלנו. הספק עשוי לשמור את טקסט התמלול עד 30 יום לבדיקות אבטחה. בתצוגת הפיתוח, בלי עיבוד חי, ההקלטה נשארת במכשיר ולא נשלחת.' },
      { q: 'ההקלטה תהיה הקריינות?', a: 'לא. ההקלטה מוסרת פרטים על הילד. הקריינות היא אפשרות נפרדת ועדיין אינה מחוברת למסלול האישי.' },
      { q: 'האם הסיפור נכתב בעזרת AI?', a: 'כן. מסלול הכתיבה שבבדיקה משתמש בבינה מלאכותית לתכנון ולכתיבה מהפרטים שאישרתם. הוא עדיין אינו ספר מלא מאושר.' },
      { q: 'האם זה טיפול רגשי?', a: 'זהו ספר ילדים. הוא אינו טיפול או כלי אבחוני.' },
    ] },
    footer: { h2Line1: 'ההרפתקה שלו', h2Line2: 'מתחילה במה שתספרו.', sub: 'בחרו מה חשוב לכם לשלב, ואנחנו נהפוך את זה לסיפור שלו. יצירת הספר המלא עדיין בפיתוח.', cta: PERSONAL_START_LABEL },
  };
}
