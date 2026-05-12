import 'server-only';

import type { ChallengeCategory } from './companions';

/**
 * Category-level emotional framework (taxonomy v2).
 *
 * Why this file exists:
 *   Each `ChallengeCategory` is NOT just a label — it's a branching key that
 *   changes which questions the wizard asks, which story directions the LLM
 *   proposes, and which tonal register the illustration pipeline uses. Keep
 *   this file as the single source of truth for all category-level metadata.
 *
 * Mirror (client bundle): wizard UI reads `hebrewLabel` + `emotionalDomain`
 * via an inlined map in `public/JS/wizard.js` (kept in sync by hand — see
 * the Cursor wiring prompt). The follow-up questions list is imported into
 * the wizard at runtime via a small API endpoint (`/api/categories/branch`).
 */

export type EmotionalDomain =
  | 'FEARS_ANXIETIES'
  | 'EMOTIONAL_REGULATION'
  | 'BELONGING_RELATIONSHIPS'
  | 'LIFE_CHANGES'
  | 'ATTENTION_LEARNING'
  | 'MEDICAL_ANXIETY'
  | 'UNCATEGORIZED';

export type StoryDirectionFlavor = 'bedtime' | 'adventure' | 'fantasy';
export type FollowUpQuestionItem = {
  id: string;
  question: string;
  quickAnswers: string[];
  placeholder?: string;
  priority?: number;
  intent?: string;
  showIf?: {
    selectedQuickAnswersAny?: string[];
    selectedQuestionIdsAny?: string[];
  };
};

/**
 * How we treat this emotional category in the book — distinct from the label.
 * Injected into the text pipeline; drives arc, what to avoid, and intended resolution.
 */
export type TreatmentStrategy = {
  /** What the child truly needs emotionally (English, for the LLM) */
  coreNeed: string;
  /** How the story helps — psychological mechanism (English) */
  approach: string;
  /** What the story must not do (English phrases) */
  avoid: string[];
  /** What kind of ending or transformation we aim for (English) */
  resolutionType: string;
  /**
   * Hard narrative rule for this category (English, for the LLM).
   * Differentiates story *logic* (where the plot may go) from content — e.g. night stays in the room,
   * anger stays in the real world with no fantasy escape.
   */
  narrativeConstraint: string;
};

export type CategoryStoryDirection = {
  /** Stable id for analytics / future UI (snake_case) */
  id: string;
  flavor: StoryDirectionFlavor;
  /** Short Hebrew headline on the direction card */
  title: string;
  /**
   * Hebrew: concrete settings/props the story should stage (room, bed, school, etc.)
   * so the book stays rooted in a child’s real day, not only metaphor.
   */
  realWorldAnchor: string;
  /** Hebrew: the emotional journey / promise of this path (cinematic, specific) */
  summary: string;
  /** English: injected into text + image direction prompts */
  promptHint: string;
  /** When set, this string REPLACES the base narrativeConstraint when this direction is chosen.
   *  Use to open up space for adventure directions while keeping connection/courage tight. */
  narrativeOverride?: string;
};

export type CategoryBranching = {
  category: ChallengeCategory;
  hebrewLabel: string;
  emotionalDomain: EmotionalDomain;

  /**
   * Short English brief for the LLM describing what this category means
   * psychologically. Injected into the story-generation system prompt so the
   * model writes from an accurate emotional frame, not from the label alone.
   */
  psychologicalMeaning: string;

  /** Category-specific therapeutic / narrative contract for the book LLM */
  treatmentStrategy: TreatmentStrategy;

  /** Examples of what a parent might say when they pick this — UX hint + LLM context */
  typicalParentIntent: string[];

  /**
   * 3–5 follow-up questions shown in the wizard after the category is chosen.
   * These REPLACE the generic "what does the child feel?" question. They are
   * the mechanism that makes two categories lead to different stories.
   */
  followUpQuestions: string[];

  /**
   * 3 story directions, one per flavor. Each must feel genuinely different —
   * different tone, different approach, different resolution shape.
   */
  storyDirections: [CategoryStoryDirection, CategoryStoryDirection, CategoryStoryDirection];

  /**
   * Pipeline tone modifier. Gets injected into the illustration prompt +
   * story-generation system prompt. This is how we make FEARS feel warm-hushed
   * and ANGER feel kinetic-contained while keeping one coherent book system.
   */
  storyTone: {
    /** Short English tone brief for LLM */
    narrativeRegister: string;
    /** English palette/mood hint for illustration prompt (not a color list) */
    illustrationMood: string;
  };
};

const DEFAULT_FOLLOWUP_PLACEHOLDER = 'פרטו עוד אם תרצו';

type FollowupAnswerSignal = {
  questionId?: string;
  selectedQuickAnswers?: string[];
};

const CATEGORY_FOLLOWUP_POOLS: Partial<Record<ChallengeCategory, FollowUpQuestionItem[]>> = {
  NIGHT_FEAR: [
    {
      id: 'night_trigger',
      question: 'מה הכי מפחיד אותו בלילה?',
      quickAnswers: ['כשיש חושך מוחלט', 'צללים שמופיעים בחדר', 'להישאר לבד במיטה', 'חלומות לא נעימים', 'רעש קטן בלילה', 'לא תמיד ברור'],
      priority: 100,
    },
    {
      id: 'night_expression',
      question: 'איך זה נראה כשהפחד מגיע?',
      quickAnswers: ['קורא לנו מהחדר', 'קם ומגיע אלינו', 'מתכסה לגמרי בשמיכה', 'בוכה או נלחץ', 'לא מצליח להירדם', 'אחר'],
      priority: 90,
    },
    {
      id: 'night_support',
      question: 'מה בדרך כלל עוזר לו להירגע?',
      quickAnswers: ['כשמישהו נשאר לידו', 'אור קטן בחדר', 'דיבור רגוע', 'חיבוק', 'נרגע לבד אחרי זמן', 'לא תמיד עוזר משהו'],
      priority: 80,
    },
  ],
  ANGER_FRUSTRATION: [
    {
      id: 'anger_trigger',
      question: 'מה בדרך כלל מדליק את הכעס?',
      quickAnswers: ['כשלא מצליח לו משהו', 'כשמפסיקים אותו באמצע', 'כשאומרים לו לא', 'כשעייף או רעב', 'כשמשהו לא קורה כמו שרצה', 'לא תמיד ברור'],
      priority: 100,
    },
    {
      id: 'anger_expression',
      question: 'איך הכעס נראה בפועל?',
      quickAnswers: ['צועק או מתפרץ', 'זורק דברים', 'בוכה מתסכול', 'נסגר בעצמו', 'מבקש עזרה אבל בכעס', 'אחר'],
      priority: 90,
    },
    {
      id: 'anger_parent',
      question: 'איך אתם מגיבים בדרך כלל?',
      quickAnswers: ['מנסים להרגיע בדיבור', 'נותנים לו רגע לבד', 'מחבקים אותו', 'מציבים גבול ברור', 'לפעמים גם אנחנו מתעצבנים', 'לא תמיד יודעים מה נכון'],
      priority: 80,
    },
  ],
  SENSITIVITY_OVERWHELM: [
    {
      id: 'sensory_trigger',
      question: 'מה הכי מציף אותו?',
      quickAnswers: ['רעש חזק או מתמשך', 'הרבה אנשים סביבו', 'אור חזק', 'בגדים או מגע לא נעים', 'שינויים פתאומיים', 'לא תמיד ברור'],
      priority: 100,
    },
    {
      id: 'sensory_expression',
      question: 'איך זה נראה כשהוא מוצף?',
      quickAnswers: ['נהיה שקט מאוד', 'מבקש ללכת', 'מתעצבן או מתפרץ', 'מתכנס בעצמו', 'נראה אבוד', 'אחר'],
      priority: 90,
    },
    {
      id: 'sensory_support',
      question: 'מה עוזר לו להירגע?',
      quickAnswers: ['מקום שקט', 'להיות עם אדם אחד קרוב', 'זמן לבד', 'חיבוק', 'להתרחק מהסיטואציה', 'לא תמיד מצליח להירגע'],
      priority: 80,
    },
  ],
  SOCIAL: [
    {
      id: 'social_context',
      question: 'איפה הכי קשה לו עם ילדים אחרים?',
      quickAnswers: ['להצטרף למשחק', 'להיות בקבוצה גדולה', 'מול ילד מסוים', 'כשלא משתפים אותו', 'כשצוחקים עליו', 'לא תמיד ברור'],
      priority: 100,
    },
    {
      id: 'social_expression',
      question: 'איך הוא מגיב במצבים כאלה?',
      quickAnswers: ['נשאר בצד', 'מתרחק', 'נעלב מהר', 'כועס', 'מנסה אבל מתקשה', 'אחר'],
      priority: 90,
    },
    {
      id: 'social_need',
      question: 'מה הכי היה עוזר לו לדעתכם?',
      quickAnswers: ['להרגיש בטוח יותר', 'להבין איך להצטרף', 'להתמודד עם אכזבה', 'ליצור קשרים חדשים', 'להרגיש שמקבלים אותו', 'לא בטוחים'],
      priority: 80,
    },
  ],
  SELF_CONFIDENCE: [
    {
      id: 'confidence_trigger',
      question: 'מתי הוא הכי מאבד ביטחון?',
      quickAnswers: ['לפני שהוא מתחיל משהו חדש', 'אחרי טעות', 'ליד ילדים אחרים', 'כשמשווים אותו', 'כשמבקשים ממנו להופיע', 'לא תמיד ברור'],
      priority: 100,
    },
    {
      id: 'confidence_expression',
      question: 'איך זה מתבטא?',
      quickAnswers: ["אומר 'אני לא יכול'", 'נמנע מלנסות', 'מתייאש מהר', 'מבקש עזרה מיד', 'נהיה שקט', 'אחר'],
      priority: 90,
    },
    {
      id: 'confidence_support',
      question: 'מה הכי היה מחזק אותו?',
      quickAnswers: ['עידוד לפני שמתחיל', 'הרגשה שמותר לטעות', 'הצלחות קטנות', 'תמיכה בזמן קושי', 'מישהו שמאמין בו', 'לא בטוחים'],
      priority: 80,
    },
  ],
  NOISE_FEAR: [
    {
      id: 'noise_trigger',
      question: 'איזה סוג רעש הכי מפחיד אותו?',
      quickAnswers: ['אזעקות', 'בומים פתאומיים', 'רעמים', 'רעש חזק ברחוב', 'קולות בלתי צפויים', 'לא תמיד ברור'],
      priority: 100,
    },
    {
      id: 'noise_expression',
      question: 'איך זה נראה אצלו כשהרעש מגיע?',
      quickAnswers: ['מכסה אוזניים', 'נלחץ ובוכה', 'קופא במקום', 'רץ אלינו מיד', 'נהיה עצבני אחר כך', 'אחר'],
      priority: 90,
    },
    {
      id: 'noise_support',
      question: 'מה בדרך כלל עוזר לו לחזור לשקט?',
      quickAnswers: ['חיבוק', 'לעבור למקום בטוח', 'דיבור רגוע', 'להכין אותו מראש', 'זמן התאוששות לבד', 'לא תמיד עוזר משהו'],
      priority: 80,
    },
  ],
  GENERAL_FEARS: [
    {
      id: 'general_fears_trigger',
      question: 'ממה הוא הכי מפחד כרגע?',
      quickAnswers: ['בעלי חיים', 'מים', 'רופא או בדיקות', 'להישאר לבד', 'משהו אחר ספציפי', 'לא תמיד ברור'],
      priority: 100,
    },
    {
      id: 'general_fears_expression',
      question: 'איך הפחד מתבטא בדרך כלל?',
      quickAnswers: ['נמנע ומתנגד', 'בוכה ונצמד', 'שואל הרבה שאלות', 'נלחץ מראש', 'כועס ומתפרץ', 'אחר'],
      priority: 90,
    },
    {
      id: 'general_fears_support',
      question: 'מה עוזר לו לעבור את זה קצת יותר בקלות?',
      quickAnswers: ['הכנה מראש', 'שנישאר לידו', 'חלוקה לצעדים קטנים', 'לתת לו תחושת שליטה', 'לעודד בעדינות', 'לא בטוחים'],
      priority: 80,
    },
  ],
  NEW_SIBLING: [
    {
      id: 'sibling_trigger',
      question: 'מתי הכי קשה לו מאז שהצטרף תינוק חדש?',
      quickAnswers: ['כשאנחנו עם התינוק', 'כשחסר לו יחס אישי', 'בשעות עייפות', 'כשיש עומס בבית', 'כשמבקשים ממנו "להיות גדול"', 'לא תמיד ברור'],
      priority: 100,
    },
    {
      id: 'sibling_expression',
      question: 'איך הקושי הזה נראה אצלו?',
      quickAnswers: ['כעס או התפרצויות', 'נצמד אלינו', 'חזרה להתנהגות קטנה', 'מתרחק ונסגר', 'מעורבב בין קנאה לסקרנות', 'אחר'],
      priority: 90,
    },
    {
      id: 'sibling_support',
      question: 'מה הכי עוזר לו להרגיש שוב בטוח במקום שלו?',
      quickAnswers: ['זמן אישי קבוע איתנו', 'מילים שמחזקות את המקום שלו', 'שגרה יציבה', 'לתת לו תפקיד קטן', 'להרגיע בלי לשפוט', 'לא תמיד יודעים מה נכון'],
      priority: 80,
    },
  ],
  TRANSITION: [
    {
      id: 'transition_trigger',
      question: 'מה השינוי שהכי קשה לו כרגע?',
      quickAnswers: ['גן או כיתה חדשים', 'מעבר בית', 'פרידה מדמות קרובה', 'שינוי שגרה בבית', 'כמה שינויים יחד', 'לא תמיד ברור'],
      priority: 100,
    },
    {
      id: 'transition_expression',
      question: 'איך הקושי הזה מתבטא ביום-יום?',
      quickAnswers: ['דבקות בהורים', 'קושי להיפרד בבוקר', 'עצבנות או בכי', 'נסיגה בהתנהגות', 'שקט ונסגרות', 'אחר'],
      priority: 90,
    },
    {
      id: 'transition_support',
      question: 'מה עוזר לו להרגיש יותר יציב בתוך השינוי?',
      quickAnswers: ['טקס קבוע בבוקר/ערב', 'חפץ מעבר מוכר', 'הכנה מראש למה שיקרה', 'זמן אחד על אחד', 'לחזק מה כן נשאר קבוע', 'לא בטוחים'],
      priority: 80,
    },
  ],
  FOCUS_LEARNING: [
    {
      id: 'focus_trigger',
      question: 'באיזה רגע הכי קשה לו לשמור על קשב?',
      quickAnswers: ['בהתחלת משימה', 'במשימות ארוכות', 'כשזה לא מעניין אותו', 'כשיש הרבה גירויים סביב', 'כשקשה לו להבין', 'לא תמיד ברור'],
      priority: 100,
    },
    {
      id: 'focus_expression',
      question: 'איך זה נראה בפועל?',
      quickAnswers: ['קופץ בין דברים', 'דוחה ומתחמק', 'מתפרץ מתסכול', 'מבקש לקום ולזוז', 'מתייאש מהר', 'אחר'],
      priority: 90,
    },
    {
      id: 'focus_support',
      question: 'מה עוזר לו להיכנס למשימה ולהחזיק בה?',
      quickAnswers: ['חלוקה לצעדים קטנים', 'התחלה עם מבוגר', 'הפסקות קצרות', 'משוב חיובי מהיר', 'סביבה שקטה יותר', 'לא בטוחים'],
      priority: 80,
    },
  ],
  OTHER: [
    {
      id: 'other_context',
      question: 'איפה זה מורגש הכי חזק אצלכם?',
      quickAnswers: ['בעיקר בבית', 'בעיקר בגן/בית ספר', 'בעיקר עם חברים', 'בעיקר לפני שינה', 'מופיע כמעט בכל מצב', 'לא תמיד ברור'],
      priority: 100,
    },
    {
      id: 'other_expression',
      question: 'איך זה נראה אצל הילד כשהקושי עולה?',
      quickAnswers: ['בכי או לחץ', 'כעס או התנגדות', 'שקט והתכנסות', 'שאלות חוזרות', 'הימנעות', 'אחר'],
      priority: 90,
    },
    {
      id: 'other_support',
      question: 'מה כבר ניסיתם ומרגיש שעוזר, אפילו קצת?',
      quickAnswers: ['להיות לידו ולדבר רגוע', 'לתת זמן לבד', 'לשמור על שגרה ברורה', 'לתווך את המצב מראש', 'חיבוק/מגע מרגיע', 'עדיין לא מצאנו מה עוזר'],
      priority: 80,
    },
  ],
};

export const CATEGORY_BRANCHING: Record<ChallengeCategory, CategoryBranching> = {
  NIGHT_FEAR: {
    category: 'NIGHT_FEAR',
    hebrewLabel: 'פחדים בלילה',
    emotionalDomain: 'FEARS_ANXIETIES',
    psychologicalMeaning:
      "Night fear is less about monsters and more about the child being alone with their imagination while losing waking anchors. The real fear is the loss of connection and control that comes with sleep. The story's job is not to disprove the fear but to make the night feel inhabited by friendly presences, so the child falls asleep accompanied.",
    treatmentStrategy: {
      coreNeed: 'reduce loneliness in the dark and calm a racing imagination with felt safety',
      approach:
        'co-regulation through companionship, reframing night as a populated gentle world, never debating whether fear is "rational"',
      avoid: [
        'forced bravery mantras',
        'mocking or minimizing fear',
        'sudden confrontations with the dark',
        'adult "there are no monsters" lectures',
      ],
      resolutionType: 'fear becomes familiar, smaller, and paired with warm presence; sleep feels shared',
      narrativeConstraint:
        'Story is anchored in the real home environment (bedroom, hallway, window). However, the real space CAN behave magically: shadows can become characters, blankets can become landscapes, ceiling stickers can come alive, objects can talk or move. The child stays physically in the home but the environment transforms around them in surprising, playful ways. Brief dreamlike sequences are allowed if they stay connected to the room. No full portal to a separate world — but the room itself should feel alive, reactive, and full of wonder. The story must still feel fun, surprising, and adventurous WITHIN this intimate space.',
    },
    typicalParentIntent: [
      'יש לה מפלצות מתחת למיטה',
      'לא רוצה להירדם לבד',
      'מתעורר באמצע הלילה',
      'חייבת אור דלוק',
      'מספר שיש חלומות רעים',
    ],
    followUpQuestions: [
      'איפה זה הכי קשה — אחרי שמכבים אור, או כבר בדרך לחדר השינה?',
      'הקושי הוא להירדם בכלל, או להישאר שקט בלי להתעורר באמצע?',
      'יש חלום או תמונה שחוזרים שוב ושוב?',
      'מה עוזר לו הכי להירגע — שמישהו לידו, או שמישהו "שומע" אותו מהחדר השני?',
      'הפחד מדביק בדבר מסוים (צל, קול) — או יותר תחושה של "אני לבד עם כל הראש"?',
    ],
    storyDirections: [
      {
        id: 'night_breath_of_home',
        flavor: 'bedtime',
        title: 'מישהו נשאר איתי עד שזה שקט',
        realWorldAnchor: 'מיטה, שמיכה, אור עמום מהמסדרון, דלת שקויה פתוחה, כוס מים, קול "עוד דקה" מבחוץ',
        summary:
          'סיפור ליווי: הלילה לא "מתווכח" אם יש או אין — יש בן-לוויה שיושב *ליד*, מדבר בקצב שינה, מחזיר לגוף חום ביתי. הילד נשאר בתפקיד של מי שמאזין; הקרבה היא הפתרון, לא "לנצח" את הלילה.',
        promptHint:
          'The hero meets a friendly night-creature companion early. The plot is built around the relationship forming; the night is re-framed as a populated, benevolent kingdom rather than an empty threat. The companion stays physically close to the hero throughout sleep-onset moments.',
      },
      {
        id: 'night_hidden_parade',
        flavor: 'adventure',
        title: 'מסלול הכוכבים מעל המיטה',
        realWorldAnchor: 'תקרה, מדבקות/כוכבים, חלון, שמים, שביל אדמה, שער לגג — מרחב *חוץ* שממנו חוזרים לחדר',
        summary:
          'רפתקה בלילה: הילד יוצא (במסע דמיוני) אל מרחב פתוח — כוכבים, שביל, "משמרת" לילית — הלילה מוצג כעולם עסוק, לא "חור שחור". הפתרון: גילוי שיש עולם מחוץ לשמיכה; לא רק תחושה פנימית.',
        promptHint:
          'The hero is guided into a hidden nocturnal world. Each element of the night (stars, dreams, shadows) is personified with a tiny job. The arc is discovery-driven — the hero ends the story knowing the night is *busy*, not empty. Keep the pacing gentle (a bedtime-story tempo).',
        narrativeOverride:
          'The story STARTS in the bedroom (page 1 only) but quickly moves into an imaginative outdoor world — a star-path above the roof, a moonlit forest, a creature village in the garden. The journey is dreamlike but vivid: real plants, real animals (personified), real paths. At least 3 distinct outdoor locations. The child physically moves through space. Return home at the end with a token or memory. The night is an adventure TO GO ON, not a threat to survive. Keep the companion playful and physically funny throughout.',
      },
      {
        id: 'night_one_small_light',
        flavor: 'fantasy',
        title: 'האור הקטן שמדליקים לבד',
        realWorldAnchor: 'מנורת שולחן, מפסק, שקע, ספרון ליד המיטה, בקבוק מים, רגע אחד לפני "מדליקים"',
        summary:
          'אקט אחד בחדר: הילד מבצע מעשה ממשי (מדליק, קורא בקול שקט, לוחץ) — *הוא*, לא הליווי. התפקיד: מי שעושה; הפתרון: רגע של שליטה קטנה בחלל הידוע, בלי הדרכה הירואית.',
        promptHint:
          'A small, concrete courageous act (lighting a lantern, opening a door, calling a name) becomes the pivot of the story. The companion is present but does not perform the act; the hero does it alone and the companion witnesses it. The resolution celebrates the smallness of the act, not its grandeur.',
      },
    ],
    storyTone: {
      narrativeRegister: 'warm-hushed, lullaby rhythm, first-half darker atmosphere dissolving into soft glow',
      illustrationMood: 'moon-blue + amber accents, soft halos of warm light against deep indigo, nothing sharp or high-contrast',
    },
  },

  NOISE_FEAR: {
    category: 'NOISE_FEAR',
    hebrewLabel: 'קולות ואזעקות',
    emotionalDomain: 'FEARS_ANXIETIES',
    psychologicalMeaning:
      "Loud unpredictable sound removes the child's ability to orient. The fear is compound: loss of control + inability to predict when the next boom comes. Story must not trivialize the sound; it should honor that loud-is-real, and give the child internal tools (inner quiet chamber, own drum) so the child becomes an agent inside sound, not a victim of it.",
    treatmentStrategy: {
      coreNeed: 'restore a sense of agency when the world gets loud; the body needs predictability and a way to re-orient',
      approach:
        'body-based grounding, co-regulation, and learning that some loudness can be chosen or shared — never “it’s not loud really”',
      avoid: [
        'dismissing the sound as "nothing"',
        'forcing exposure without consent',
        'shaming a freeze or cry response',
      ],
      resolutionType: 'the child has an inner "volume knob" and a way back to themselves after the wave passes',
      narrativeConstraint:
        'Keep the plot in real places where loud sound happens (home, street, shelter drill, car). Light personification of sound is OK; do not send the child through a portal or into a separate fantasy realm. The return to calm must land in the real body and real space.',
    },
    typicalParentIntent: [
      'נכנסת לבהלה מאזעקה',
      'פוחד מרעמים',
      'קופאת או בורח כשיש רעש חזק',
      'לא יכול להיות במקומות רועשים',
      'לוקח לו הרבה זמן להירגע אחרי רעש',
    ],
    followUpQuestions: [
      'זה בדרך־כלל אזעקה, רעם, שאון רחוב — או שכל "בום" בלי אזהרה מרגיש אותו דבר במצא את עצמם?',
      'מה קורה לו ברגע הזה — נעצר, בורח, מכסה אוזניים, בוכה?',
      'אחרי שזה נגמר: כמה זמן בערך לוקח לו לחזור לעצמו?',
      'יש מקום בבית שאפשר "לרדת מזה" מהר (ספה, שמיכה, שיר)?',
      'אם היינו יודעים מראש מתי יהיה רעש (תרגול, הסבר) — זה היה משנה איך עוברים את זה?',
    ],
    storyDirections: [
      {
        id: 'noise_warm_earthquake',
        flavor: 'bedtime',
        title: 'רעש גדול — אבל של חיבוק',
        realWorldAnchor: 'מדרגות, בניין, מרפסת, הורה שמאחד יד, כרית על האוזן — בום שמגיע *עם* מישהו',
        summary:
          'ליווי: יצור/דמות "רועש" מסביר בגוף שבום בלי כוונה אחת לבומים אחרים. הילד מפחד *פחות* כי הוא לא לבד עם הרעש. הפתרון: שיתוף וחום, לא "זה רק רעש".',
        promptHint:
          'A gentle loud-natured companion (giant, whale) becomes a mentor. The story demonstrates that sound can be warm. The climax should involve the companion and child making a sound TOGETHER that is large but safe — reframing loud as shared, not invasive.',
      },
      {
        id: 'noise_quiet_rooms',
        flavor: 'adventure',
        title: 'ריצה אחת החוצה — ואז חזרה',
        realWorldAnchor: 'רחוב, אוטובוס, חנות, בית קפה, פארק, שמיים — עולם פתוח אחרי בום, לא רק "חדר שקט"',
        summary:
          'רפתקה מחוץ: אחרי גל של רעש, הילד *עובר* מרחבים (רחבה, שביל, שער) ולומד לנווט בחזרה. הילד מגלם מסע; הפתרון: הכרת דרכים *חוץ* ולא בניית עולם בראש בלבד.',
        promptHint:
          'The plot is a journey inward. The hero learns to enter a tiny sanctuary inside themselves — a cartoon-literal inner room. The story cuts between the loud outer world and the calm inner chamber. Ending: the hero walks in the loud world while their inner chamber stays intact.',
      },
      {
        id: 'noise_their_beat',
        flavor: 'fantasy',
        title: 'התוף ביד שלי, לא בפנים',
        realWorldAnchor: 'רצפה, דופק על השולחן, תוף, מחיאות, שיר אחד בקול *שלי*',
        summary:
          'אקט קטן: הילד *בוחר* רעש (תוף, שיר) — "שלו" — שונה מרעש ש"נופל עליו". הפתרון: מעשה בגוף על חפץ אמיתי, לא הישרדות בראש.',
        promptHint:
          'The hero flips from passive-to-sound to maker-of-sound. The story gives the hero an instrument or voice. The pivotal moment is a small chosen loud — the hero makes a sound that they own, and discovers that a loud THEY made does not scare them. The companion holds space for the sound, does not shush it.',
      },
    ],
    storyTone: {
      narrativeRegister: 'grounded-safe, sound-textured prose, deliberate breathing rhythm',
      illustrationMood: 'earthy greens and warm terracottas with soft visible sound-waves; composition favors stable horizontal anchors (floors, horizons, wide safe shapes)',
    },
  },

  GENERAL_FEARS: {
    category: 'GENERAL_FEARS',
    hebrewLabel: 'פחדים וחרדות אחרים',
    emotionalDomain: 'FEARS_ANXIETIES',
    psychologicalMeaning:
      "Fear of a specific object (dog, water, doctor, separation, insects) is a placeholder for the deeper statement: 'I don't know what will happen'. The goal is not to erase the fear but to return agency to the child. A fear with agency is caution; a fear without agency is paralysis. Story should let the child choose the pace.",
    treatmentStrategy: {
      coreNeed: "agency and predictability in the face of a specific 'what if'",
      approach:
        'gradual attunement, small experiments of approach, the feared thing reframed as having boundaries too — not a battle to win in one page',
      avoid: [
        'forcing contact with the phobia for the plot',
        'mocking, bribing, or "you must be brave"',
        'instantly befriending the dog/water in a way that betrays the child’s pace',
      ],
      resolutionType: 'the child can choose a next step, retreat is allowed, and fear shrinks to proportion',
      narrativeConstraint:
        'Light fantasy or a friendly guide is allowed, but every major beat must return clearly to a real-world context (yard, clinic, pool edge, sidewalk, door). No long stay in a purely imagined kingdom; the resolution must be visible in the real situation the parent described.',
    },
    typicalParentIntent: [
      'פוחדת מכלבים',
      'לא נכנס למים',
      'בוכה אצל הרופא',
      'לא רוצה להישאר עם סבתא לבד',
      'חרדה מחרקים',
    ],
    followUpQuestions: [
      "מה *בדיוק* הופך אותו לקשה — קרבה, רעש, בדיקה, נפרדים?",
      'הפחד מלווה אותו זמן רב, או התחיל "משהו" חדש לאחרונה?',
      'היו מצבים — גם אם נדירים — שבהם זה היה *פחות* קשה? מה היה אחרת?',
      'הוא מדבר על זה בין פעמים, או רק בזמן אמת מול הדבר עצמו?',
      'אולי בבית-מישהו מרגיש דומה? זה מחבר או מרגיש שונה?',
    ],
    storyDirections: [
      {
        id: 'fear_mentor_sameness',
        flavor: 'bedtime',
        title: 'אני בדיוק הייתי שם, אבל הולך/ת',
        realWorldAnchor: 'ספה, אוזן, מים, הליכה, יד — מישהו ליד, לא "שיעור" על הפחד',
        summary:
          'מישהו אומר בקול שגם *לו* היה, ואיך *נראה* עכשיו — לא "נעלמתי מזה", אלא: מכיר. הילד שומע עדות, לא הוכחה. הפתרון: ראייה, לא ביקורת אצל הדבר המפחיד.',
        promptHint:
          'Introduce a companion who openly admits they once feared the same thing. Most of the story is the companion-hero relationship; the companion models recovery, not fearlessness. The resolution is relational — the hero feels seen more than they feel brave.',
      },
      {
        id: 'fear_treasure_keeper',
        flavor: 'adventure',
        title: 'הדרך שמעגלת את מה שמפחיד',
        realWorldAnchor: 'שביל, גן, בית, חנות, כלב ברחוק, מים, דלת — שני-שלושה עצירות ממשיות',
        summary:
          'רפתקה: הילד *מהלך* מרחב, לא "חושב על זה" בבית. כל עצירה = ניסיון קטן (קרבה, מרחק, קול). הפתרון: מפה *חוץ* של ניסיונות, לא אינספור פנים.',
        promptHint:
          'Reframe the feared object as a guardian of something valuable. The hero approaches not to conquer but to negotiate. Arc should include 2–3 small approach attempts, each honored. Final retrieval must feel earned by patience, not by force.',
      },
      {
        id: 'fear_steps_tokens',
        flavor: 'fantasy',
        title: 'אבן אחת בכל "עוד קצת"',
        realWorldAnchor: 'כיס, אבן, מטבע, שורה במחברת, חפץ *ממש* שמייצג צעד',
        summary:
          'בחדר-עולם: כל "עוד ניסיון" = חפץ קטן שמוכנס לכיס. הילד *מצטבר* הוכחות לעצמו. הפתרון: אוסף-קטן, לא ניצחון—גאווה ממה *עשו* הידיים, לא ממה *אמורים* לחשוב.',
        promptHint:
          'The plot is structured as a ladder of small approaches. Each rung yields a tiny token the hero collects. The ending is the collection itself, not the conquest — the hero ends still cautious, but now carrying proof of their own capacity.',
      },
    ],
    storyTone: {
      narrativeRegister: 'patient-respectful, never rushing the hero, gives permission to retreat',
      illustrationMood: 'soft pastels with cool-safe accents (sky blue, sage), generous negative space so the hero is never visually cornered',
    },
  },

  ANGER_FRUSTRATION: {
    category: 'ANGER_FRUSTRATION',
    hebrewLabel: 'כעס ותסכול',
    emotionalDomain: 'EMOTIONAL_REGULATION',
    psychologicalMeaning:
      "Anger is the emotion of perceived injustice or blocked autonomy. Tantrums are not manipulation — they are the moment a child runs out of neural bandwidth for regulation. The story must validate the anger as real and safe, not shame it. The arc is 'you have anger → anger is okay → anger needs a safe channel', never 'calm down' or 'bad feelings'.",
    treatmentStrategy: {
      coreNeed: 'safe expression of intensity and a sense of control when the "dam" breaks',
      approach:
        'externalize energy into movement or symbol, name the build-up, micro-pauses, never equate anger with being "bad"',
      avoid: [
        'moralized anger ("naughty", "shame on you")',
        'adults fixing the situation by shaming the feeling',
        'instant calm without discharge',
      ],
      resolutionType: 'anger remains real but finds channels; the child is proud of how they "held" the fire',
      narrativeConstraint:
        "The anger story must stay entirely inside real-life spaces such as home, room, yard, kindergarten, playground, or another concrete place from the child's world. Do not use portals, other worlds, kingdoms, floating islands, magical doors, dimensions, or escape into a fantasy world. The emotional change must happen through body regulation, breath, movement, a real object, a parent/caregiver, repair, or one small action in the real situation.",
    },
    typicalParentIntent: [
      'היסטריות על כל דבר',
      'זורק חפצים',
      'לא מצליחה להירגע',
      'נכנס לתסכול ולא יוצא',
      'מכה את עצמו',
    ],
    followUpQuestions: [
      'איפה זה "מתפרץ" — בבית מול הורים, על חבר, או כשדבר *נתקע* (משחק, בגד, משימה)?',
      "זה יותר 'בום' פתאום, או לחץ שעולה-עולה עד שאי-אפשר לעכב?",
      "אחרי — הוא מתבייש על הכעס, או שמחליק כאילו לא היה, או שאומר בכנות 'היה לי מלא'?",
      'מה באמת מוריד — ריצה, מכה בכרית, מים, שקט, או שמישהו פשוט שומע בלי לשפוט?',
      'האם הכעס "דביק" לדבר (משחק, כלל) — או שזה מרגיש "ענק בלי אובייקט"?',
    ],
    storyDirections: [
      {
        id: 'anger_warm_vent',
        flavor: 'bedtime',
        title: 'חבר שמבין את החום בפנים',
        realWorldAnchor: 'רצפה, שולחן משחק, קובייה או בובה, אח, הורה שמניח גבול, חדר — לא חושך, לא הירדמות',
        summary:
          'סיפור יחד: הליווי (קומקום, לב, "חום" נושם) מלמד *שחרור קטן בזמן* — פיסטון, שקשוק, "עוד בועה" — לפני בום. הילד בתפקיד מי שלומד *עם* מישהו; הפתרון: חיבור וקצב, לא "ניצחון" על הכעס.',
        promptHint:
          'The companion is a contained-heat archetype (volcano, kettle). The story is a gentle tutorial — the companion teaches the hero micro-releases. No shame, no calming-down lectures. The moral: release is healthy; explosion happens when release was blocked.',
      },
      {
        id: 'anger_creature_path',
        flavor: 'adventure',
        title: 'ריצה לרחוב — לפני שזה הופך לזריקה',
        realWorldAnchor: 'מדרגות בבניין, שביל, חניה, גן משחקים, כדור, שער — מקום *חוץ* שבו אפשר לזוז בלי לשבור',
        summary:
          'רגע פתוח: ה"כעס" הופך לכוח/יצור *שיוצא* החוצה — שדה, מסלול, תפילה. הילד בתפקיד מוביל-תנועה; הפתרון: ערוץ *חיצוני* לרגש, לא "חדר רגוע" ולא הידברות פנימה בלבד.',
        promptHint:
          'Externalize the anger as a friendly creature the hero OWNS. The plot is finding a home for this creature — a drum to hit, a field to run in, a hole to dig. The creature is never slain or banished; it joins the hero, channeled. Strong kinetic scenes.',
      },
      {
        id: 'anger_one_breath',
        flavor: 'fantasy',
        title: 'נשימה אחת בין "מלא" ליד',
        realWorldAnchor: 'שולחן, מפת משחק, קצה הכסא, היד על הרצפה, "עצור" אחד לפני היד נוגעת',
        summary:
          'מבנה "שלושה רגעים": פעמיים היד עוברת לפני ה*"עצור"* — בפעם השלישית אפשר. הילד בתפקיד מי ש *בוחר* קטנה; הפתרון: לא שלמות, רק הוכחה אחת שאפשר לעמוד *בשלישית* — גאווה במיקרו, לא "ניצלתי מהכעס".',
        promptHint:
          'The entire plot is built around ONE micro-skill: a single breath between feeling and action. Show three situations: two where the hero forgets and reacts; one where they remember and pause. The resolution is small and realistic — the hero is still sometimes angry, sometimes takes the breath.',
      },
    ],
    storyTone: {
      narrativeRegister: 'kinetic-contained, rhythmic sentences, honest about intensity',
      illustrationMood: 'warm reds and ochres with cooling blue accents, dynamic motion lines, open landscapes that allow energy to dissipate',
    },
  },

  SENSITIVITY_OVERWHELM: {
    category: 'SENSITIVITY_OVERWHELM',
    hebrewLabel: 'רגישות ועומס רגשי',
    emotionalDomain: 'EMOTIONAL_REGULATION',
    psychologicalMeaning:
      "Some children feel everything — other people's moods, store lighting, tags on clothes, distant arguments. This is a nervous system that processes more, not a defect. The story must reframe sensitivity as a gift that needs a shelter, not a weakness to fix. The arc gives the child a portable inner-room they can enter without leaving the outer world.",
    treatmentStrategy: {
      coreNeed: 'boundaries and recovery — to feel without drowning in the world’s volume',
      approach:
        'sensory attunement, a portable "tent" of calm, co-regulation, reframing "too much" as signal not flaw',
      avoid: [
        'calling the child "dramatic" or "exaggerating"',
        'forcing endurance in noise/crowds as character building',
        'solving with distraction alone',
      ],
      resolutionType: 'the child has rituals and a safe inner return; sensitivity becomes something they respect in themselves',
      narrativeConstraint:
        'Stage overload in real places (class, store, visit, home). If the child uses an "inner tent" or pause, show it as a felt moment (eyes closed, hands, breath) without turning it into a literal other world or long cutaway realm. No portal or fantasy dimension as the main setting.',
    },
    typicalParentIntent: [
      'סופגת את כל מה שמסביב',
      'פורצת בבכי בלי סיבה נראית',
      'לא יכולה במקומות רועשים',
      'מרגישה אשמה על דברים של אחרים',
      'נעשית "יותר מדי" אחרי ימים מלאים',
    ],
    followUpQuestions: [
      'איפה זה "מתפוצץ" — בגן, בקניות, בביקור אצל קרובים, אצל מישהו חדש?',
      'אחרי הגל: מה *באמת* מחזיר— שקט, שמיכה, חפץ, לבד, אמא, מים, שיר?',
      'היא אומרת "זה *בִּי* מכעיס" — או שזה מרגיש כמו *שלי* בלי בחירה?',
      'אולי בובה, כרית, בושם, צעיף: יש אובייקט־"בית" נייד שיודעים ללכת איתו לכל מקום?',
      'היא מזהה *לפני* או *רק אחרי* שכבר "נפל" העומס?',
    ],
    storyDirections: [
      {
        id: 'sens_two_antennas',
        flavor: 'bedtime',
        title: 'שניים כמוך — מדברים, לא "שתיקה"',
        realWorldAnchor: 'גן, קניות, ביקור, בגד, תג, רעש, אור עבה — *מי* איתך כשהכול "יותר מדי"',
        summary:
          'ליווי: מישהו "רגיש בדיוק כמוך" — שיחה, זיהוי, כיוון. הילד לא "מתוקן"; הוא *נפגש*. הפתרון: הכרה הדדית, לא התמדה במקום הומה.',
        promptHint:
          'The companion is a fellow sensitive (mimosa, dewdrop). The story frames sensitivity as a tunable skill. The companion teaches the hero to adjust intake without closing off. The ending is about shared understanding: two sensitives seeing each other.',
      },
      {
        id: 'sens_tent_suitcase',
        flavor: 'adventure',
        title: 'יוצאים לרעש — ואז אפשר לנוח',
        realWorldAnchor: 'שביל, חנות, אוטובוס, כיתה, שער בית ספר, גן, חדר הזזה',
        summary:
          'רפתקה: שני-שלושה מקומות *חוץ* — רעש, קהל, קו — הילד עובר ביניהם, לא "נעלם לתוך ראש". הפתרון: מסלול *עולמי* עם שוב מסודר, לא רק "אוהל בדמיון" בבית.',
        promptHint:
          'The adventure is inward. The hero builds (with the companion) a literal inner tent — a sanctuary they can enter mentally in any outer setting. Scenes should alternate between loud/busy outer places and the quiet inner tent. Ending: the hero carries the tent, always available.',
      },
      {
        id: 'sens_rega_ritual',
        flavor: 'fantasy',
        title: "מילה אחת: \"רֶגַע\" — בלי בושה",
        realWorldAnchor: 'שולחן, כיסא, פינה, יד לפני פה, "עצור" לפני אמא, דלת שסוגרים לשנייה',
        summary:
          'אקט אחד: הילד *אומר* או *נותן* לעצמו פאוזה. הליווי עד, לא "מי שיודע". הפתרון: הוכחה שאפשר לבקש בקול, לא "להחזיק עד שמתפוצצים".',
        promptHint:
          'The whole story revolves around the hero learning to request a pause. "Rega" (רגע) becomes almost a magic word. Show situations where the hero previously collapsed; now they pause and return. The companion validates that asking for a pause is strong, not weak.',
      },
    ],
    storyTone: {
      narrativeRegister: 'intimate-gentle, slower pacing, interior monologue-friendly',
      illustrationMood: 'muted watercolor pastels, soft edges, translucency layers, a feeling of filtered or veiled light',
    },
  },

  SOCIAL: {
    category: 'SOCIAL',
    hebrewLabel: 'חברויות ומפגשים',
    emotionalDomain: 'BELONGING_RELATIONSHIPS',
    psychologicalMeaning:
      "Social life is the first mirror the child has outside the family. Rejection, being left out, struggling to enter a group — these are about the child's sense of being wantable. Shyness isn't absence of desire; it's fear of judgment mid-attempt. Story must honor that trying IS the brave part, regardless of the response received.",
    treatmentStrategy: {
      coreNeed: "belonging and dignity — a felt sense of 'I can try without losing my worth'",
      approach:
        'model partial wins, de-center the clique, focus on a single real bid, validate mixed outcomes in groups',
      avoid: [
        'instant popularity endings',
        'the shy character magically becoming class clown',
        'peer cruelty played for laughs',
      ],
      resolutionType: 'a believable first connection or repaired bond; pride in the ask, not only the answer',
      narrativeConstraint:
        'Keep all main scenes in believable real social settings (playground, classroom, birthday, sidewalk, gate). The emotional work happens in plain daylight life—no parallel magical society, no quest world, no "other realm" where friendship is learned.',
    },
    typicalParentIntent: [
      'אין לו חברים בגן',
      'עומדת מהצד',
      'לא יודע איך להצטרף',
      'החברה הכי טובה שלה הפסיקה לשחק איתה',
      'דוחפים אותו החוצה',
    ],
    followUpQuestions: [
      'רוב הזמן: כואב *להציע* (חיבור) או *להיות מחוץ* (ריק)?',
      'הוא מרגיש שזה *בינו* לבן־אדם אחד, או ש"כולם" ביחד רחוקים?',
      "כשהוא/ה אומרים 'אפשר לי?' — בדרך-כלל מה הופך אחר-כך עם האוזן?",
      'מפגשים — הוא נשאר ליד עצמנו, או שיוצא-בחוץ ואם לא עובר — חוזר למקום־הבטוח?',
      'יש *מישהו* שכבר *עובר* (אבא, אחות, כלב) שמרגישים איתו "חבר" אהוב?',
    ],
    storyDirections: [
      {
        id: 'social_two_moons',
        flavor: 'bedtime',
        title: "שני מי שעומדים בצד — מוצאים אחד את השני",
        realWorldAnchor: 'נדנדה, שולחן קפה, פינה בגן, שער, ספסל, עיניים, מילה אחת ביניהם',
        summary:
          'ליווי: *שניים* — לא "חדירה לעדר". הם בונים דואט: יודעים שיש עוד, רחוק, מסבירים לעצמם. הפתרון: חברות-זוגית קטנה, לא פופולריות.',
        promptHint:
          'Two-outsider plot. The hero meets one other lonely creature. They bond not through heroics but through mutual recognition. The resolution is small and honest — a duo, not a crowd. Do not force the hero into the big group.',
      },
      {
        id: 'social_mission_trio',
        flavor: 'adventure',
        title: 'יוצאים לעזור למישהו — וחבורה נולדת בדרך',
        realWorldAnchor: 'מגרש, שביל, יצירה, כדור, שער בית ספר, חפץ אבוד, משימה *משותפת*',
        summary:
          'רפתקה: משחית שלישי + משימה *בחוץ* — הילד לא "נכנס לתוך קבוצה", הוא *הולך* עם מישהו. הפתרון: שיתוף פעולה במרחב, לא הופעה מול אחרים.',
        promptHint:
          'Friendship-through-task structure. The hero + a new friend help a third character. Friendship emerges as a byproduct of shared purpose, which is the most realistic path. End with the friendship intact and the task complete.',
      },
      {
        id: 'social_the_ask',
        flavor: 'fantasy',
        title: "שלום, או \"אפשר איתכם?\"",
        realWorldAnchor: "דלת כיתה, שולחן, משחק, קול, 'מצמצו', יד בכיס",
        summary:
          'מבנה אחד-שיא: מילה או הזמנה. הילד *עושה* ביד, בלשון, בבחורה. הפתרון: אומץ *בהצעה*; התשובה יכולה להיות חלקית — הגאווה היא הבריאה, לא "כן" מיליוני.',
        promptHint:
          "The entire story leads to ONE small social bid — asking to join a game, inviting someone, saying hello. The outcome must be partial-success (some accept, some don't). The courage is the asking, not the yes. Validate that trying is the achievement.",
      },
    ],
    storyTone: {
      narrativeRegister: 'warm-realistic, honest about social stakes, never saccharine',
      illustrationMood: 'daylight palette with grouping-compositions: clusters, bridges, shared-space framing',
    },
  },

  SELF_CONFIDENCE: {
    category: 'SELF_CONFIDENCE',
    hebrewLabel: 'ביטחון וערך עצמי',
    emotionalDomain: 'BELONGING_RELATIONSHIPS',
    psychologicalMeaning:
      "Confidence is built from small mastery + being seen. Lack of confidence often hides a comparison wound (sibling, classmate), an internalized critical voice, or unprocessed early failure. The story must avoid generic 'you can do it' encouragement. Real confidence comes from surviving an attempt whether or not it worked.",
    treatmentStrategy: {
      coreNeed: 'accurate self-witnessing — the child needs to feel real, not graded',
      approach:
        'small attempt + honest outcome, name a strength the child already shows, shrink the inner critic without erasing doubt',
      avoid: [
        'trophy endings for no effort',
        'comparing the child to a “perfect” peer in-story',
        'adult praise that dismisses their fear of failing',
      ],
      resolutionType: 'pride in having tried and in naming one true strength; outcome can be mixed',
      narrativeConstraint:
        'Trials happen in real arenas (class, stage at home, sport, craft table, mirror). Symbolic fantasy is OK only as a short metaphor on the same stage; do not relocate the arc into a separate adventure world. Resolution in a real attempt and its aftermath.',
    },
    typicalParentIntent: [
      "אומר 'אני לא יודעת' על כל דבר",
      'לא מנסה כי יפסיד',
      'משווה את עצמה',
      'חושב שהוא לא טוב בשום דבר',
      'לא לוקחת סיכונים',
    ],
    followUpQuestions: [
      'יש רגעים — קטנים — שבהם דווקא מרגישים “אני הצלחתי”? מה היה שם?',
      "המילים 'אני לא יודע/ת' מגיעות לפני ניסיון, או אחרי משהו שנפל?",
      'אם יש מישהו שהם משווים אליו — האם זה מדברים על זה בבית?',
      'כשמשהו מצליח / נשבר: איך זה נשמע מסביב — שמחה, שקט, ביקורת?',
      'אולי יש תחביב או דבר שהם אוהבים בו ואף אחד לא כינה אותו "כישרון"?',
    ],
    storyDirections: [
      {
        id: 'confidence_both_doubt',
        flavor: 'bedtime',
        title: "גם לו/לה יש 'קול שקט' בתוך",
        realWorldAnchor: 'אוזן, ספה, הליכה, יד, מבט, לא בימה ולא "שיעור"',
        summary:
          'ליווי: מי שנראה "מושלם" מספר אמת — גם *לו* יש ביקורת פנימית. הילד *שומע*; הפתרון: לא להעלים ספק, אלא *ללכת איתו* ביחד אחר.',
        promptHint:
          "A shared-doubt plot. The companion initially appears confident. Mid-story the companion privately admits their own inner critic. This mutual confession is the climax. The moral: confidence isn't absence of doubt, it's acting alongside it.",
      },
      {
        id: 'confidence_hidden_gift',
        flavor: 'adventure',
        title: "משימה בחוץ — ומה שיודעים *כבר* עוזר",
        realWorldAnchor: 'יער, בית, כיתה, חיה, אבדה, שביל, חפץ שצריך *להקשיב*',
        summary:
          'רפתקה: המשימה *דורשת* בדיוק משהו שהם כבר עושים. הם לא "נולדו מחדש"; הם *נותנים שם*. הפתרון: גילוי *בעולם*, לא "תפילה פנימית" בלבד.',
        promptHint:
          'Hidden-skill quest. During the adventure, the hero uses something ordinary about themselves (listening, noticing, gentleness) that turns out to be exactly what the quest needs. The discovery is of worth the hero already had but hadn\'t named.',
      },
      {
        id: 'confidence_first_stumble',
        flavor: 'fantasy',
        title: 'ליפול פעם אחת — ולעמוד',
        realWorldAnchor: 'רצפה, יד, נשימה, "עוד אחת", אותו אובייקט — *ניסיון אחד* בחדר/במגרש',
        summary:
          'מבנה ניסיון-נפילה-קימה: תוצאה *לא* מושלמת, חיים אחרי. הילד *עשה* וגם *נשאר*. הפתרון: ביטחון *אחרי* הכאב, לא "ניצחון נקי".',
        promptHint:
          'Structure around one first attempt. The hero tries something uncertain. The result should include a stumble — partial failure that is survived. The story values the AFTER-the-fall moment (getting up, trying once more) above the outcome. Honest, not triumphalist.',
      },
    ],
    storyTone: {
      narrativeRegister: 'tender-affirming without saccharine, models the inner critic honestly',
      illustrationMood: 'warm golden-hour light, scale shifts (small hero in big world that still holds them), reflective-mirror motifs',
    },
  },

  NEW_SIBLING: {
    category: 'NEW_SIBLING',
    hebrewLabel: 'אח או אחות חדשים',
    emotionalDomain: 'LIFE_CHANGES',
    psychologicalMeaning:
      "The older child isn't 'jealous' in the shallow sense — they experienced a world-altering event without consent. Regression, anger, clinginess are all valid responses. Story must NOT rush reconciliation with the baby. First it validates the older child's loss, then slowly offers them a new privileged role ('first one here', 'the one who knows').",
    treatmentStrategy: {
      coreNeed: "security that their place in the family wasn’t replaced — 'I still matter'",
      approach:
        'validate grief and regression first, then offer a dignified "big" role; baby stays secondary in emotional arc until the hero is met',
      avoid: [
        'plots that scold the older child for jealousy',
        'instant "you love the baby" hugs',
        'making the baby the moral center of every scene',
      ],
      resolutionType: 'a felt bond with a parent/companion and a specific pride in being the first — love for baby optional and never forced',
      narrativeConstraint:
        'The story lives in real family life (home rooms, routines, sofa, crib in the background). Do not run a long plot in a fantasy kingdom or magical baby-land; keep conflict and repair in the actual house and daily moments parents recognize.',
    },
    typicalParentIntent: [
      'חזר לפיפי',
      'מכה את התינוק',
      'דורש את כל תשומת הלב',
      'אומרת שלא אוהבים אותה יותר',
      'לא רוצה ללכת לגן',
    ],
    followUpQuestions: [
      'כמה בערך עבר מאז שבא התינוק — ימים, שבועות, חודשים?',
      "הרגשות יוצאים *מול* התינוק, או *מול* אמא/אבא (נדבקות, בקשת תשומת לב)?",
      'היו גם רגעים שדווקא מעוניינים/מתוקים עם התינוק, או שזה עדיין קשה?',
      'האם יש משהו שרק *שלו* — שיחה, שגרה, חדר, בובה — בלי התינוק?',
      'הוא ממילים, או יותר במעשה (רגרסיה, זליגה, כעס)?',
    ],
    storyDirections: [
      {
        id: 'sibling_crown_first',
        flavor: 'bedtime',
        title: "קודם/ת כאן — הטקס של ה\"ראשון/ת\"",
        realWorldAnchor: 'מיטה, לילה, שגרה, חדר, יד, דקה *רק* של הגדול, מבט מההורה',
        summary:
          'ליווי-טקס: "היית פה לפני" — *לא* "תאהב את התינוק". התינוק יכול בצד. הילד *מכובד*; הפתרון: שלמות-מקום, לא הוכחה של אהבה.',
        promptHint:
          "Honor-of-firstness plot. The hero is crowned — symbolically — as the first. The companion affirms their primacy. The baby (if present) is a secondary figure; the hero's worth is NOT contingent on loving the baby immediately.",
      },
      {
        id: 'sibling_older_trail',
        flavor: 'adventure',
        title: "הגדול/ה הוליך/ה — לא *במקום* התינוק",
        realWorldAnchor: "שביל, גדעון, בובה, יד קטנה, 'אני אומר' — *מוביל* בחוץ, לא 'שיעור' בבית",
        summary:
          'רפתקה: הגדול *מוביל* — נתיב, משימה, יצור קטן. הכוח: להיות *גדול* במרחב, לא "להרגיש טוב" על כורחך. הפתרון: סוכנות *חיצונית* מול תינוק בפנים.',
        promptHint:
          'Elder-as-guide structure. The hero leads a smaller creature (stand-in for the sibling or a companion-cub). The hero discovers agency and status in being big. Warm, gentle, not didactic — never "you should love your sister".',
      },
      {
        id: 'sibling_one_share',
        flavor: 'fantasy',
        title: "מחלקים *דבר* אחד — ובודקים בבטן",
        realWorldAnchor: 'שולחן, צעצוע, שיר, דקה, "עדיין מספיק לי" — *מעשה אחד*',
        summary:
          'אקט אחד: חלוקה *קונקרטית* — ואז: "האם אני *עדיין* אני?". הפתרון: שפע-של-שלמות, לא "לדחוף" אהבה; גאווה מן המעשה, לא מן הקרבה.',
        promptHint:
          'One small act of sharing. Very concrete: one toy, one story, one moment of attention. The hero gives, then checks inside themselves and finds they are still complete. The moral is abundance, not sacrifice.',
      },
    ],
    storyTone: {
      narrativeRegister: "gentle-dignifying, honors the older child's standing",
      illustrationMood: 'warm family palette, careful spatial composition where the hero is visually primary in every scene',
    },
  },

  TRANSITION: {
    category: 'TRANSITION',
    hebrewLabel: 'מעברים גדולים',
    emotionalDomain: 'LIFE_CHANGES',
    psychologicalMeaning:
      "Children depend on continuity more than adults. A transition (new kindergarten, move, divorce, new caregiver) is a small death-and-rebirth — the old self doesn't automatically fit the new place. Transitional objects, rituals, and bridging stories are how the self travels between versions of life.",
    treatmentStrategy: {
      coreNeed: 'continuity of self across change — a bridge that is not denial',
      approach:
        'naming the goodbye, carrying one anchor object or ritual, companion as pacing partner not cheerleader',
      avoid: [
        '“the new place is even better” erasure of the old',
        'rushed adaptation montages',
        'adults solving the child’s feeling by explaining',
      ],
      resolutionType: 'the child arrives still themselves, with one thread from before intact and hope toward after',
      narrativeConstraint:
        'Transition is metaphorical journeying (bridge, path) but must read as one continuous real-life change—old home to new school, box to box, goodbye to hello. No actual escape to a second world: the child ends in a real new place with a real object/ritual, not stuck in a fantasy plane.',
    },
    typicalParentIntent: [
      'עברנו דירה',
      'מתחיל גן חדש',
      'המטפלת עוזבת',
      'אבא עובד בחו"ל',
      "עולה לכיתה א'",
    ],
    followUpQuestions: [
      "במילים שלכם — *מה* השתנה (מקום, אנשים, גן, משפחה)?",
      'מה *נשאר* דומה (ארוחה, שיר, חפץ, מישהו אהוב) אחרי השינוי?',
      'הילד/ה מדבר/ת על "לפני", או מדלג/ת — ומה זה אומר לכם?',
      'אם היה *דבר אחד* שהיה בחיים הישנים — מה הכי חסר היום?',
      "עולה סקרנות לקראת חדש, או שכרגע הכל מרגיש 'לא שלי'?",
    ],
    storyDirections: [
      {
        id: 'transit_ferry_friend',
        flavor: 'bedtime',
        title: "ליד מי שמכיר/ה *כמה* זה איטי",
        realWorldAnchor: "יד, ידיים, 'עוד שבוע', בית, גן, תיק, *קצב* — לא 'טוסק'",
        summary:
          'ליווי: מישהו ש"כבר עשה מעבר" — לא "קל" בכזב; *מחזיק* בקצב. הילד *נלקח* בקשר, לא בלוגיקה. הפתרון: התאמה אנושית, לא הסבר-מבוגר.',
        promptHint:
          'Veteran-traveler companion. The companion has made this crossing many times. Their calm is not dismissive — it\'s earned. The hero attaches to the companion as their anchor during the crossing. Emphasize pacing the transition, not rushing it.',
      },
      {
        id: 'transit_bridge_river_forest',
        flavor: 'adventure',
        title: "גשר, אוטובוס, או בית-ספר *חדש* — הדרך היא העלילה",
        realWorldAnchor: 'מעלית, שער, שביל, חדר, כיתה, תיק, *גן* או *כיתה*',
        summary:
          'רפתקה-מבנה: שלב-שלב *חוץ* — הפרדה, נשיאה, כניסה. הילד *עובר* מרחבים, לא "מתרגל במילים". הפתרון: עולם *רחב* של מעבר, לא בחדר אחד.',
        promptHint:
          'Literal journey. The plot IS the transition rendered as a physical crossing. Bridge, boat, forest-path. Each stage of the crossing mirrors a real-life step (saying goodbye, carrying what matters, entering the new). The destination is revealed at the end to be warm, not identical to home.',
      },
      {
        id: 'transit_pocket_stone',
        flavor: 'fantasy',
        title: "החפץ שעובר איתי — *לא* בגלל שקל",
        realWorldAnchor: "אבן, כרטיס, שיר, ריח, תמונה, בד — *אותו* חפץ בכיס *גם* אחרי",
        summary:
          'אקט-עצמאות: חפץ אחד *נשאר* — הילד *בוחר* אותו. הפתרון: "אני עדיין אני" ביד *מוחשי*, לא דיבור-עצמי בלבד.',
        promptHint:
          'Portable-continuity plot. The hero carries one small item from the old life into the new. The item stays present across scenes. The ending: the new place is different, but the hero\'s small object — and the person they became with it — travels along. Low-drama, profound.',
      },
    ],
    storyTone: {
      narrativeRegister: 'travelling-prose, paced like a walk, honors both the left-behind and the coming',
      illustrationMood: 'gradient palette shifting from old-place to new-place tones across the spreads; bridges, horizons, open paths',
    },
  },

  FOCUS_LEARNING: {
    category: 'FOCUS_LEARNING',
    hebrewLabel: 'קשב, סקרנות ולמידה',
    emotionalDomain: 'ATTENTION_LEARNING',
    psychologicalMeaning:
      "A child who 'can't focus' often focuses too much — on everything at once. The skill isn't forced stillness; it's choosing where to point. Learning struggles often mask shame, boredom, or a mismatch between task and mode. Story must reframe attention as directable curiosity, never as a defect.",
    treatmentStrategy: {
      coreNeed: "agency over attention — a sense of 'I can aim my mind' without shame",
      approach:
        'reframe “scatter” as wide radar, teach one “catch one rabbit” move, finish one micro-task, separate boredom from self-worth',
      avoid: [
        'the moral “just concentrate”',
        'smart-aleck characters who are effortlessly perfect',
        'turning the child into a quiet statue as success',
      ],
      resolutionType: 'a finished small task + named strength in how they think; curiosity framed as power',
      narrativeConstraint:
        'Stay in real learning/play spaces (desk, floor, garden, classroom, one project). Wonder and "many ideas" stay earthbound; avoid a separate mind-palace dimension or floating study-realm as the main setting. Finish in one concrete real task.',
    },
    typicalParentIntent: [
      'לא מצליח לשבת בכיתה',
      'מתחילה ולא מסיימת',
      'משתעמם מהר',
      'קוראת עשר ספרים ביום אבל לא עושה שיעורים',
      "שכנעו אותה שהיא לא חכמה",
    ],
    followUpQuestions: [
      "באיזה דבר (לא תמיד 'לימודי') הם/ן *נתקעים* בשעה בלי לשים לב לזמן?",
      "הקושי: הם לא *מבינים*, או שזה *משעמם* / לא בקצב שלהם?",
      "מישהו אמר/ה להם מילה קשה על הראש ('לא חכמים') — או שזה מגיע מהם בפנים?",
      'אולי יש תחום (חיה, מוזיקה, בנייה, שיר) שבו אף אחד לא העריך עדיין את העומק?',
      'בחודש האחרון — עומס גדל, או שזו תמונת מצב ארוכה?',
    ],
    storyDirections: [
      {
        id: 'focus_twin_inventor',
        flavor: 'bedtime',
        title: "שני ראשים 'מלאים' — *לא* 'תרכזו כבר'",
        realWorldAnchor: "שולחן, שיעור, דף, 'רעיון אחד', ביחד, לא *שקט* כעונש",
        summary:
          'ליווי: *שניים* "כמוך" — מצביעים, לא "מתקנים". הטריק: *בחירה* של רעיון אחד, לא *כוח* נגד הראש. הפתרון: שותפות, לא יחיד בלחץ.',
        promptHint:
          'The companion is a fellow-scattered-mind (inventor, wizard). They form a kinship. The companion does NOT teach "focus harder"; they teach a small trick for catching ONE idea and running with it while letting others wait. Mutual recognition is the emotional center.',
      },
      {
        id: 'focus_spark_detail',
        flavor: 'adventure',
        title: "רואים *את זה* — אף אחד אחר",
        realWorldAnchor: 'מסלול, יער, בית, כיתה, חפץ, פרט, "שם! כאן! אחרים דילגו!"',
        summary:
          'רפתקה: *בחוץ* — אחרים "פספסו"; *הרחב* שלו פותר. הילד *מאתר*; הפתרון: גלוי-עלילה, לא "כוח פנים" בלבד.',
        promptHint:
          "Strength-of-scattered-mind plot. The hero's way of seeing everything at once becomes the exact quality the quest needs — noticing a detail others miss. Vindicating without being smug. Celebrates the hero's natural mode as an asset.",
      },
      {
        id: 'focus_one_finish',
        flavor: 'fantasy',
        title: "סוגרים *משהו אחד* — עד שיש \"סיימתי\"",
        realWorldAnchor: "דף, בנייה, חפץ, 'עד כאן', שולחן, יד, קו שמאחוריו *סגור*",
        summary:
          'מבנה-סיום: *משהו אחד* נשאר עד-קצה. הילד *עשה* לולא-סוף, לא *ניצח בכול*. הפתרון: *גמר* מוחשי, לא "ריכוז" אבstract.',
        promptHint:
          'Completion-as-victory. The hero starts many things; the story tracks just one. The drama is whether this one thing gets finished. Ending: a small completed act, and the very specific pride that comes from finishing. No overstatement.',
      },
    ],
    storyTone: {
      narrativeRegister: 'curious-playful, darts between ideas while still resolving cleanly',
      illustrationMood: 'bright multicolor accents, many small objects in scenes, but with one focal subject in each spread',
    },
  },

  MEDICAL_PROCEDURE: {
    category: 'MEDICAL_PROCEDURE',
    hebrewLabel: 'טיפולים רפואיים',
    emotionalDomain: 'MEDICAL_ANXIETY',
    psychologicalMeaning:
      "Medical experiences (shots, surgery, casts, hospital stays, chronic treatment) activate primal threat — loss of control, pain, strange adults, unfamiliar environments. The child's body is 'done to' rather than 'done by.' The story must restore agency and predictability without minimizing real discomfort. Bravery framing ('be strong') backfires; what works is understanding, preparation, and the truth that hard things end.",
    treatmentStrategy: {
      coreNeed:
        'predictability and agency — knowing what will happen, having a role in the process, and trusting that pain is temporary',
      approach:
        'normalize fear as smart (your body is protecting you), give the child a job during the procedure, show that the hard part has a shape and an end, honor the after — rest, comfort, pride',
      avoid: [
        'trivializing pain ("it\'s nothing")',
        'bravery-as-silence ("big kids don\'t cry")',
        'graphic medical detail that scares more than helps',
        'magical instant healing that denies the real process',
      ],
      resolutionType: 'the child gets through it with support, feels proud of surviving something hard, and discovers they are tougher than they thought — not because they didn\'t feel, but because they felt and stayed',
      narrativeConstraint:
        'Keep medical elements metaphorical or gently abstracted (a castle with white walls, a bridge that pinches). Never show needles, blood, or graphic procedures. The companion guides through the experience, not around it. Real-world anchor: clinic, hospital room, bed, bandage, parent\'s hand.',
    },
    typicalParentIntent: [
      'מתכוננים לניתוח או אשפוז',
      'פוחד מזריקות או בדיקות דם',
      'צריך לקחת תרופה שלא אוהב',
      'חוזר מטיפול ומעבד את החוויה',
      'גבס / שבר / פציעה שדורשת סבלנות',
      'טיפולי שיניים',
    ],
    followUpQuestions: [
      'באיזה סוג טיפול מדובר — זריקה, ניתוח, גבס, תרופה, משהו אחר?',
      'הטיפול עוד לפניכם, או שהילד/ה כבר עבר/ה את זה ומעבד/ת?',
      'מה הכי מפחיד — הכאב, הזרים, חוסר השליטה, או משהו אחר?',
      'האם יש חוויה קודמת (טובה או רעה) שהילד/ה זוכר/ת?',
      'מה עוזר — יד של הורה, להבין מראש, בובה, משהו אחר?',
    ],
    storyDirections: [
      {
        id: 'medical_guide_through',
        flavor: 'bedtime',
        title: 'המלווה שעובר את זה *איתך* — לא *במקומך*',
        realWorldAnchor: "חדר, מיטה, יד, 'אני פה', נשימה, סוף — *חזרה*",
        summary:
          'ליווי: המלווה *נוכח* בכל שלב. לא מבטל כאב, לא מרדים — *רואה* ו*נשאר*. הפתרון: הילד עובר את זה, וגם המלווה עובר — ביחד.',
        promptHint:
          'The companion stays with the child through every stage of a medical experience. No magic to erase the discomfort — the companion breathes with them, narrates what\'s happening ("now the cold part, now the pinch, now it\'s done"), and the emotional center is: I was not alone.',
      },
      {
        id: 'medical_castle_map',
        flavor: 'adventure',
        title: 'הטירה הלבנה — *מפה* של מה שיקרה',
        realWorldAnchor: "מסדרון, חדר, דלת, 'תחנה', שלב, סוף — *בחוץ*",
        summary:
          'רפתקה: מקום לא מוכר הופך ל*מפה* עם תחנות. כל תחנה — שלב בטיפול. הילד *יודע* מה הלאה. הפתרון: סוף המסלול = *חוצה*, ואתה *יודע* את הדרך.',
        promptHint:
          'The hospital/clinic becomes a castle or journey with clear stations. The child and companion travel station to station — each one is a stage of the procedure, gently abstracted. Power comes from knowing the map. Ending: emerging on the other side, lighter.',
      },
      {
        id: 'medical_armor_built',
        flavor: 'fantasy',
        title: 'השריון שנבנה *מהרעש* — כי עברת',
        realWorldAnchor: "גוף, עור, *סימן*, 'עברתי את זה', חוזק — *מבפנים*",
        summary:
          'מבנה-גבורה: הילד *מגלה* שאחרי הדבר הקשה — משהו *נבנה*. לא "לא כואב"; אלא "כאב, ועברתי, ועכשיו אני *יודע* שאני יכול". הפתרון: גאווה שקטה.',
        promptHint:
          'After the procedure, the child realizes something was built inside them — not magic armor, but the quiet knowledge that they survived something hard. The companion names it: "you stayed." Pride without bravado. The scar/bandage/cast becomes a badge, not a wound.',
      },
    ],
    storyTone: {
      narrativeRegister: 'gentle-steady, like a parent explaining step by step — warm but honest, never dismissive',
      illustrationMood: 'clean whites and soft blues with warm gold accents; medical spaces rendered as calm, not sterile; always a warm hand or soft fabric nearby',
    },
  },

  OTHER: {
    category: 'OTHER',
    hebrewLabel: 'נושא אחר',
    emotionalDomain: 'UNCATEGORIZED',
    psychologicalMeaning:
      "Safety net for topics not covered by the main taxonomy. The parent described something in free text. Treat with extra care: read their words closely, avoid forcing a pre-made arc. If the parent's text clearly matches another category, the LLM should softly anchor to that category's tone while letting the specifics of the parent's wording drive the plot.",
    treatmentStrategy: {
      coreNeed:
        "faithful attunement to the parent's own words so the child feels seen in the specific situation they described",
      approach:
        'let parent free text be the spine; use OTHER companions as listening guides; borrow tone from nearest category only lightly',
      avoid: [
        'replacing their topic with a generic “lesson”',
        'a moral that ignores their wording',
        'forcing a standard three-act arc that doesn’t fit',
      ],
      resolutionType: 'a believable next step that fits their description, not a packaged moral',
      narrativeConstraint:
        'Honor the parent’s free-text topic: if it sounds like daily life, keep the plot in ordinary real settings; do not default to a generic fantasy quest. If light magic appears, it must serve the specific situation and stay short—then return to a real next step the child can do tomorrow.',
    },
    typicalParentIntent: [
      'מצב ספציפי שלא מופיע ברשימה',
      'שילוב של כמה דברים יחד',
      'משהו שהילד מתמודד איתו באופן ייחודי',
    ],
    followUpQuestions: [
      "במילים שלכם, בלי לנסח 'נכון' — מה בדיוק עובר על הילד/ה עכשיו?",
      "איך זה מרגיש בבית — בבוקר, בערב, בימים אחרי גן/בית ספר — לא רק 'באופן כללי'?",
      'אם היה אפשר לבקש מספר קסום *דבר אחד* שהסיפור יעשה לו — מה זה היה?',
    ],
    storyDirections: [
      {
        id: 'other_mirroring_ally',
        flavor: 'bedtime',
        title: "המלווה — לפי *המילים* שלכם, לא \"תבנית\"",
        realWorldAnchor: "מה שאמרת בטופס: חפץ, מקום, בן-אדם, זמן — *זה* נכנס בזהות, לא 'דוגמה אחת לכולם'",
        summary:
          'ליווי-מיון: *אותו* אירוע; המלווה מייצר קרבה, לא "שיעור". הפתרון: ראיית *ההורה*, לא *קטלוג* אוניברסלי.',
        promptHint:
          "Since the topic is free-form, build a relational arc from the parent's description. Companion is chosen from OTHER category (magic map, seer mirror, golden key). Keep the tone warm, the specifics faithful to the parent's text.",
      },
      {
        id: 'other_path_from_words',
        flavor: 'adventure',
        title: "מסלול-עצירות: ישר מה *טקסט*",
        realWorldAnchor: "שלוש *עצירות* — כל אחת מוציאה *ציטוט* / פרט מההורה, לא 'יעד גנרי'",
        summary:
          'רפתקה: *עולם* מורכב *מהמשפטים* שלכם. הילד *עובר* בנקודות; הפתרון: שלושה-חמישה מרחבים, לא "שכבה אחת".',
        promptHint:
          "Build an adventure shaped by the parent's free-form description. Use the companion as a meta-guide (map, mirror, key). Story emerges from the parent's words, not from a template.",
      },
      {
        id: 'other_quiet_next_step',
        flavor: 'fantasy',
        title: "מעשה *אחד* — לא נאום",
        realWorldAnchor: "שולחן, דלת, הורה, חבר, *מעשה* של גוף, לא *תובנה*",
        summary:
          'אקט-קצר: *עושה* — במציאות, לא *מבין* בלב. המלווה *רואה*. הפתרון: *צעד* בגוף, לא מטא-שיעור.',
        promptHint:
          "One small courageous act tailored to the parent's description. The companion witnesses without solving. The story values the smallness of the step.",
      },
    ],
    storyTone: {
      narrativeRegister: 'attentive-listening, takes its shape from the parent\u2019s own words',
      illustrationMood: 'neutral warm palette that adapts to content, no category-specific motifs',
    },
  },
};

/** Quick lookup helper (safe on unknown strings). */
export function getCategoryBranching(
  category: string | null | undefined
): CategoryBranching | null {
  if (!category || typeof category !== 'string') return null;
  return CATEGORY_BRANCHING[category as ChallengeCategory] ?? null;
}

export function getWizardFollowupQuestions(
  category: string | null | undefined,
  currentAnswers?: FollowupAnswerSignal[]
): FollowUpQuestionItem[] {
  const branching = getCategoryBranching(category);
  if (!branching) return [];
  const defaultPool: FollowUpQuestionItem[] = branching.followUpQuestions.slice(0, 3).map((question, index) => ({
    id: `${branching.category.toLowerCase()}_${index + 1}`,
    question,
    quickAnswers: index === 0
      ? ['לא תמיד ברור', 'אחר']
      : index === 1
      ? ['נראה בלחץ', 'מתפרץ או בוכה', 'נסגר', 'מבקש קרבה', 'אחר', 'לא תמיד ברור']
      : ['חיבוק', 'דיבור רגוע', 'זמן לבד', 'שגרה ברורה', 'לא בטוחים', 'לא תמיד עוזר משהו'],
    placeholder: DEFAULT_FOLLOWUP_PLACEHOLDER,
    priority: Math.max(1, 100 - index * 5),
  }));
  const pool = (CATEGORY_FOLLOWUP_POOLS[branching.category] || defaultPool).slice();
  if (pool.length === 0) return [];

  const sorted = pool.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const firstQuestion = sorted[0];
  const selectedQuickAnswers = new Set(
    (currentAnswers || [])
      .flatMap((item) => (Array.isArray(item?.selectedQuickAnswers) ? item.selectedQuickAnswers : []))
      .filter((value): value is string => typeof value === 'string')
  );
  const selectedQuestionIds = new Set(
    (currentAnswers || [])
      .map((item) => item?.questionId)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  );

  const matchesShowIf = (item: FollowUpQuestionItem): boolean => {
    const showIf = item.showIf;
    if (!showIf) return false;
    const byQuick =
      Array.isArray(showIf.selectedQuickAnswersAny) &&
      showIf.selectedQuickAnswersAny.some((value) => selectedQuickAnswers.has(value));
    const byQuestionId =
      Array.isArray(showIf.selectedQuestionIdsAny) &&
      showIf.selectedQuestionIdsAny.some((value) => selectedQuestionIds.has(value));
    return Boolean(byQuick || byQuestionId);
  };

  const out: FollowUpQuestionItem[] = [firstQuestion];
  const dynamicMatches = sorted.filter((item) => item.id !== firstQuestion.id && matchesShowIf(item));
  for (const match of dynamicMatches) {
    if (out.length >= 3) break;
    out.push(match);
  }

  const unconditional = sorted.filter((item) => item.id !== firstQuestion.id && !item.showIf);
  for (const item of unconditional) {
    if (out.length >= 3) break;
    if (out.some((picked) => picked.id === item.id)) continue;
    out.push(item);
  }
  for (const item of sorted) {
    if (out.length >= 3) break;
    if (out.some((picked) => picked.id === item.id)) continue;
    out.push(item);
  }

  return out.slice(0, 3);
}

/** Used by the wizard UI to render domain-grouped topic selection. */
export const DOMAIN_ORDER: EmotionalDomain[] = [
  'FEARS_ANXIETIES',
  'EMOTIONAL_REGULATION',
  'BELONGING_RELATIONSHIPS',
  'LIFE_CHANGES',
  'ATTENTION_LEARNING',
  'MEDICAL_ANXIETY',
  'UNCATEGORIZED',
];

export const DOMAIN_LABELS_HE: Record<EmotionalDomain, string> = {
  FEARS_ANXIETIES: 'פחדים וחרדות',
  EMOTIONAL_REGULATION: 'ויסות רגשי',
  BELONGING_RELATIONSHIPS: 'שייכות וקשרים',
  LIFE_CHANGES: 'שינויי חיים',
  ATTENTION_LEARNING: 'קשב ולמידה',
  MEDICAL_ANXIETY: 'טיפולים רפואיים',
  UNCATEGORIZED: 'אחר',
};
