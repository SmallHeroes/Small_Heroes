/**
 * canonical-topics.js — single source of truth for wizard + home "מתי זה מתאים?"
 * Load after content.js (patches CONTENT.he) and before landing.js / wizard.js.
 */
(function initCanonicalTopics(global) {
  const CANONICAL_TOPICS = [
    {
      id: 'night',
      label: 'פחדים בלילה',
      emoji: '🌙',
      category: 'NIGHT_FEAR',
      homepageVisible: true,
      wizardDescription: 'כשהלילה מרגיש מאיים או קשה להירדם',
      homepageDescription:
        'כשהלילה מרגיש מאיים והילד צריך סיפור שמרגיע ונותן ביטחון.',
    },
    {
      id: 'sirens',
      label: 'רעשים ואזעקות',
      emoji: '💥',
      category: 'NOISE_FEAR',
      homepageVisible: true,
      wizardDescription: 'רעשים חזקים, אזעקות או התרגשות מפתאומית',
      homepageDescription:
        'כשרעשים חזקים או אזעקות מלחיצים — והילד צריך להרגיש בטוח יותר.',
    },
    {
      id: 'new_sibling',
      label: 'אח או אחות חדשים',
      emoji: '👶',
      category: 'NEW_SIBLING',
      homepageVisible: true,
      wizardDescription: 'כשמצטרף/ת תינוק או אח/אחות — וצריך להרגיש שעדיין שייך/ה',
      homepageDescription:
        'כשהמשפחה משתנה והילד צריך להרגיש שעדיין שייך ואהוב.',
    },
    {
      id: 'anger',
      label: 'כעס ותסכול',
      emoji: '⚡',
      category: 'ANGER_FRUSTRATION',
      homepageVisible: true,
      wizardDescription: 'כשכעס, תסכול או התפרצויות קשים לכולם',
      homepageDescription:
        'כשרגשות חזקים קשים לו (ולכם) — והילד צריך מסגרת רגשית בטוחה.',
    },
    {
      id: 'confidence',
      label: 'ביטחון וערך עצמי',
      emoji: '🌟',
      category: 'SELF_CONFIDENCE',
      homepageVisible: true,
      wizardDescription: 'כשחשוב לחזק ביטחון, שייכות וערך עצמי',
      homepageDescription:
        'כשחשוב לחזק את התחושה שהוא יכול, שייך, ולא לבד עם הקושי.',
    },
    {
      id: 'transitions',
      label: 'מעברים ושינויים',
      emoji: '🌱',
      category: 'TRANSITION',
      homepageVisible: true,
      wizardDescription: 'מעבר בבית, בגן, בכיתה או שינוי גדול בחיים',
      homepageDescription:
        'כשיש שינוי גדול — מעבר, גן חדש, כיתה חדשה — והרבה לא-ודאות.',
    },
    {
      id: 'social',
      label: 'חברים ומפגשים',
      emoji: '🤝',
      category: 'SOCIAL',
      homepageVisible: true,
      wizardDescription: 'חברויות, שיתוף או מפגשים חדשים שמלחיצים',
      homepageDescription:
        'כשחברויות, שיתוף או מפגשים חדשים מלחיצים או מבלבלים.',
    },
    {
      id: 'sensitivity',
      label: 'רגישות ועומס',
      emoji: '🌿',
      category: 'SENSITIVITY_OVERWHELM',
      homepageVisible: true,
      wizardDescription: 'רגישות גבוהה, עומס רגשי או שינויים קטנים שמרגישים גדולים',
      homepageDescription:
        'כשעומס, רעשים או שינויים קטנים מרגישים גדולים מדי.',
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
      homepageDescription:
        'כשיש חשש מרופא, מחט, בדיקה או בית חולים — בסיפור שמכין בעדינות.',
    },
  ];

  /** Old wizard topic ids → canonical ids (session restore only). */
  const LEGACY_TOPIC_ID_MAP = {
    nightfear: 'night',
    generalfears: 'night',
    general_fears: 'night',
    fears: 'night',
    sibling: 'new_sibling',
    transition: 'transitions',
    selfconfidence: 'confidence',
    other: 'night',
  };

  const byId = new Map(CANONICAL_TOPICS.map((t) => [t.id, t]));

  function normalizeTopicId(topicId) {
    const raw = String(topicId || '').trim();
    if (!raw) return '';
    return LEGACY_TOPIC_ID_MAP[raw] || raw;
  }

  function displayLabel(topic) {
    return `${topic.emoji} ${topic.label}`.trim();
  }

  function findTopic(topicId) {
    const id = normalizeTopicId(topicId);
    return byId.get(id) || null;
  }

  function getCategoryForTopic(topicId) {
    const t = findTopic(topicId);
    return t?.category || 'OTHER';
  }

  /** @deprecated use getCategoryForTopic */
  function getCategoriesForTopic(topicId) {
    return [getCategoryForTopic(topicId)];
  }

  function getPrimaryCategoryForTopic(topicId) {
    return getCategoryForTopic(topicId);
  }

  /** Resolve story-bank category from companion id (safety fallback). */
  function resolveCategoryFromCompanionId(companionId) {
    const id = String(companionId || '').trim();
    if (!id) return null;
    const map = global.COMPANIONS_BY_CATEGORY;
    if (!map) {
      console.error('[TopicCatalog] COMPANIONS_BY_CATEGORY missing');
      return null;
    }
    const matches = [];
    for (const [category, list] of Object.entries(map)) {
      if (!Array.isArray(list)) continue;
      if (list.some((c) => c && c.id === id)) matches.push(category);
    }
    if (matches.length === 0) {
      console.error(`[TopicCatalog] companion "${id}" not found in any category`);
      return 'OTHER';
    }
    if (matches.length > 1) {
      console.error(
        `[TopicCatalog] companion "${id}" maps to multiple categories: ${matches.join(', ')} — using ${matches[0]}`,
      );
    }
    return matches[0];
  }

  function buildHomepageHelpCards() {
    return CANONICAL_TOPICS.filter((t) => t.homepageVisible !== false).map((t) => ({
      topicId: t.id,
      title: displayLabel(t),
      body: t.homepageDescription,
    }));
  }

  function buildWizardTopics() {
    return CANONICAL_TOPICS.map((t) => ({
      id: t.id,
      label: displayLabel(t),
      wizardDescription: t.wizardDescription,
    }));
  }

  const catalog = {
    CANONICAL_TOPICS,
    LEGACY_TOPIC_ID_MAP,
    normalizeTopicId,
    displayLabel,
    findTopic,
    getCategoryForTopic,
    getCategoriesForTopic,
    getPrimaryCategoryForTopic,
    resolveCategoryFromCompanionId,
    buildHomepageHelpCards,
    buildWizardTopics,
  };

  global.CanonicalTopics = catalog;

  if (global.CONTENT && global.CONTENT.he) {
    const H = global.CONTENT.he;
    H.canonicalTopics = CANONICAL_TOPICS;
    if (H.landing && H.landing.helps) {
      H.landing.helps.cards = buildHomepageHelpCards();
    }
    if (H.wizard) {
      H.wizard.topics = buildWizardTopics();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
