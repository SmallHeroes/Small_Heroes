/**
 * Server mirror of public/JS/canonical-topics.js (homepage help cards + wizard topics).
 */

export type CanonicalTopic = {
  id: string;
  label: string;
  emoji: string;
  category: string;
  homepageVisible: boolean;
  wizardDescription: string;
  homepageDescription: string;
};

const CANONICAL_TOPICS: CanonicalTopic[] = [
  {
    id: 'night',
    label: 'פחדים בלילה',
    emoji: '🌙',
    category: 'NIGHT_FEAR',
    homepageVisible: true,
    wizardDescription: 'כשהלילה מרגיש מאיים או קשה להירדם',
    homepageDescription: 'כשהלילה מרגיש מאיים והילד צריך סיפור שמרגיע ונותן ביטחון.',
  },
  {
    id: 'sirens',
    label: 'רעשים ואזעקות',
    emoji: '💥',
    category: 'NOISE_FEAR',
    homepageVisible: true,
    wizardDescription: 'רעשים חזקים, אזעקות או התרגשות מפתאומית',
    homepageDescription: 'כשרעשים חזקים או אזעקות מלחיצים — והילד צריך להרגיש בטוח יותר.',
  },
  {
    id: 'new_sibling',
    label: 'אח או אחות חדשים',
    emoji: '👶',
    category: 'NEW_SIBLING',
    homepageVisible: true,
    wizardDescription: 'כשמצטרף/ת תינוק או אח/אחות — וצריך להרגיש שעדיין שייך/ה',
    homepageDescription: 'כשהמשפחה משתנה והילד צריך להרגיש שעדיין שייך ואהוב.',
  },
  {
    id: 'anger',
    label: 'כעס ותסכול',
    emoji: '⚡',
    category: 'ANGER_FRUSTRATION',
    homepageVisible: true,
    wizardDescription: 'כשכעס, תסכול או התפרצויות קשים לכולם',
    homepageDescription: 'כשרגשות חזקים קשים לו (ולכם) — והילד צריך מסגרת רגשית בטוחה.',
  },
  {
    id: 'confidence',
    label: 'ביטחון וערך עצמי',
    emoji: '🌟',
    category: 'SELF_CONFIDENCE',
    homepageVisible: true,
    wizardDescription: 'כשחשוב לחזק ביטחון, שייכות וערך עצמי',
    homepageDescription: 'כשחשוב לחזק את התחושה שהוא יכול, שייך, ולא לבד עם הקושי.',
  },
  {
    id: 'transitions',
    label: 'מעברים ושינויים',
    emoji: '🌱',
    category: 'TRANSITION',
    homepageVisible: true,
    wizardDescription: 'מעבר בבית, בגן, בכיתה או שינוי גדול בחיים',
    homepageDescription: 'כשיש שינוי גדול — מעבר, גן חדש, כיתה חדשה — והרבה לא-ודאות.',
  },
  {
    id: 'social',
    label: 'חברים ומפגשים',
    emoji: '🤝',
    category: 'SOCIAL',
    homepageVisible: true,
    wizardDescription: 'חברויות, שיתוף או מפגשים חדשים שמלחיצים',
    homepageDescription: 'כשחברויות, שיתוף או מפגשים חדשים מלחיצים או מבלבלים.',
  },
  {
    id: 'sensitivity',
    label: 'רגישות ועומס',
    emoji: '🌿',
    category: 'SENSITIVITY_OVERWHELM',
    homepageVisible: true,
    wizardDescription: 'רגישות גבוהה, עומס רגשי או שינויים קטנים שמרגישים גדולים',
    homepageDescription: 'כשעומס, רעשים או שינויים קטנים מרגישים גדולים מדי.',
  },
  {
    id: 'focus',
    label: 'קשב, סקרנות ולמידה',
    emoji: '🦋',
    category: 'FOCUS_LEARNING',
    homepageVisible: false,
    wizardDescription: 'קשב, סקרנות, למידה או התמודדות עם משימות חדשות',
    homepageDescription:
      'כשקשה להתרכז, להתחיל משהו חדש, או כשסקרנות ולמידה צריכות מסגרת רגועה.',
  },
  {
    id: 'medical',
    label: 'טיפולים רפואיים',
    emoji: '🩹',
    category: 'MEDICAL_PROCEDURE',
    homepageVisible: true,
    wizardDescription: 'ביקור רפואי, מחט, בדיקה או טיפול שמלחיץ',
    homepageDescription: 'כשיש חשש מרופא, מחט, בדיקה או בית חולים — בסיפור שמכין בעדינות.',
  },
];

function displayLabel(topic: CanonicalTopic) {
  return `${topic.emoji} ${topic.label}`.trim();
}

export function buildHomepageHelpCards() {
  return CANONICAL_TOPICS.filter((t) => t.homepageVisible !== false).map((t) => ({
    topicId: t.id,
    title: displayLabel(t),
    body: t.homepageDescription,
  }));
}
