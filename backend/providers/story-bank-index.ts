/**
 * story-bank-index.ts
 *
 * Maps wizard challengeCategory → story-bank files.
 * Each category has 6 stories (3 pairs: a/b variants).
 * Each story has 3 length variants: 10p (short), base 15p (medium), 20p (long).
 *
 * Selection logic:
 *   1. Map wizard category → bank category
 *   2. Pick a random story from the pool
 *   3. Pick the right length variant
 *   4. Return the filename for loadStoryFromBank()
 */

import { existsSync } from 'fs';
import { join } from 'path';
import type { ChallengeCategory } from '../../lib/companions';

const STORY_BANK_DIR = join(process.cwd(), 'story-bank', 'raw');

// ── Category mapping: wizard → story-bank ───────────────────────

type BankCategory =
  | 'NIGHT_FEAR'
  | 'ANGER_FRUSTRATION'
  | 'SENSITIVITY_OVERWHELM'
  | 'SOCIAL'
  | 'TRANSITION'
  | 'SIRENS'
  | 'GENERAL_FEARS'
  | 'CONFIDENCE'
  | 'SIBLING'
  | 'FOCUS'
  | 'MEDICAL';

const CATEGORY_MAP: Record<ChallengeCategory, BankCategory> = {
  NIGHT_FEAR:            'NIGHT_FEAR',
  ANGER_FRUSTRATION:     'ANGER_FRUSTRATION',
  SENSITIVITY_OVERWHELM: 'SENSITIVITY_OVERWHELM',
  SOCIAL:                'SOCIAL',
  TRANSITION:            'TRANSITION',
  NOISE_FEAR:            'SIRENS',
  GENERAL_FEARS:         'GENERAL_FEARS',
  SELF_CONFIDENCE:       'CONFIDENCE',
  NEW_SIBLING:           'SIBLING',
  FOCUS_LEARNING:        'FOCUS',
  MEDICAL_PROCEDURE:     'MEDICAL',
  OTHER:                 'GENERAL_FEARS',  // fallback
};

// ── Story pool: bank category → list of base filenames ──────────

type StoryEntry = {
  /** Base filename WITHOUT length suffix, e.g. "batch-01_1a" */
  base: string;
  /** Story title (Hebrew) for logging */
  title: string;
};

const STORY_POOL: Record<BankCategory, StoryEntry[]> = {
  NIGHT_FEAR: [
    { base: 'batch-01_1a', title: 'הצללים שרצו הביתה' },
    { base: 'batch-01_1b', title: 'השמיכה שאוכלת אור' },
    { base: 'batch-01_2a', title: 'היער שמתקתק' },
    { base: 'batch-01_2b', title: 'הירח שמתחבא מאחורי הענן' },
    { base: 'batch-01_3a', title: 'הגן של הלילה שנחנק מאור' },
    { base: 'batch-01_3b', title: 'הדלת שמנגנת בלילה' },
  ],
  ANGER_FRUSTRATION: [
    { base: 'batch-02_4a', title: 'ההר שלא מפסיק לגדול' },
    { base: 'batch-02_4b', title: 'הציור שלא הסכים להישאר' },
    { base: 'batch-02_5a', title: 'הסוד של הרוח הסחרחרה' },
    { base: 'batch-02_5b', title: 'הילדה שלא זזה כשהאש רקדה' },
    { base: 'batch-02_6a', title: 'הבריכה שלא יכלה לשתוק' },
    { base: 'batch-02_6b', title: 'הקירות שמתקמטים' },
  ],
  SENSITIVITY_OVERWHELM: [
    { base: 'batch-03_7a', title: 'השלג שלא רצה להיפשר' },
    { base: 'batch-03_7b', title: 'הבועות שלא נגמרות' },
    { base: 'batch-03_8a', title: 'ההר שעושה ששש' },
    { base: 'batch-03_8b', title: 'העץ שלא הסכים לוותר' },
    { base: 'batch-03_9a', title: 'הלב של המעיין' },
    { base: 'batch-03_9b', title: 'ארמון החול שלא הסכים' },
  ],
  SOCIAL: [
    { base: 'batch-04_10a', title: 'הענף הארוך מדי' },
    { base: 'batch-04_10b', title: 'המסילה שלא זזה לבד' },
    { base: 'batch-04_11a', title: 'הגשר שלא הסכים להיפגש' },
    { base: 'batch-04_11b', title: 'מקהלת המים המבולבלת' },
    { base: 'batch-04_12a', title: 'הגן שמקשיב לצלילים' },
    { base: 'batch-04_12b', title: 'העלים שבין הקוצים' },
  ],
  TRANSITION: [
    { base: 'batch-05_13a', title: 'החדר שכמעט נשכח' },
    { base: 'batch-05_13b', title: 'הקופסה שלא נתנה לעבור' },
    { base: 'batch-05_14a', title: 'הרוח שלא הפסיקה לרוץ' },
    { base: 'batch-05_14b', title: 'השער שלא נפתח בחינם' },
    { base: 'batch-05_15a', title: 'הזרעים שלא הסכימו לגדול' },
    { base: 'batch-05_15b', title: 'העץ שלא הסכים לזרום' },
  ],
  MEDICAL: [
    { base: 'batch-06_16a', title: 'הטירה שראתה שמיים' },
    { base: 'batch-06_16b', title: 'החלק המר שעבד' },
    { base: 'batch-06_17a', title: 'הגשר הלבן על ההר' },
    { base: 'batch-06_17b', title: 'המפה שבאה בצביטה' },
    { base: 'batch-06_18a', title: 'הפרח שצמח מתוך החום' },
    { base: 'batch-06_18b', title: 'השריון שנבנה מהרעש' },
  ],
  SIRENS: [
    { base: 'batch-07_19a', title: 'הצנצנת שצעקה' },
    { base: 'batch-07_19b', title: 'השעון שלא מפסיק לצלצל' },
    { base: 'batch-07_20a', title: 'הציפור שצורחת צבעים' },
    { base: 'batch-07_20b', title: 'התוף שלא הסכים לשתוק' },
    { base: 'batch-07_21a', title: 'האור שבקצה המנהרה' },
    { base: 'batch-07_21b', title: 'הרוח של יום שלישי לא שואלת' },
  ],
  GENERAL_FEARS: [
    { base: 'batch-08_22a', title: 'האור הקטן והצל הגדול' },
    { base: 'batch-08_22b', title: 'הארון שלא מפסיק לדבר' },
    { base: 'batch-08_23a', title: 'האבן החמה והבריכה השחורה' },
    { base: 'batch-08_23b', title: 'הלוחשת שמתחת למיטה' },
    { base: 'batch-08_24a', title: 'המדרגות שסופרות אור' },
    { base: 'batch-08_24b', title: 'אבנים מהתקרה' },
  ],
  CONFIDENCE: [
    { base: 'batch-09_25a', title: 'המראה שלא הסכימה להיות כמוני' },
    { base: 'batch-09_25b', title: 'השלט שלא סתם שותק' },
    { base: 'batch-09_26a', title: 'הילדה והאיש משלג שמדבר יותר מדי' },
    { base: 'batch-09_26b', title: 'הפעמון שמתלונן על הרוח' },
    { base: 'batch-09_27a', title: 'התעלה הקטנה' },
    { base: 'batch-09_27b', title: 'הדלת שלא הסכימה' },
  ],
  SIBLING: [
    { base: 'batch-10_28a', title: 'שתי להבות בחדר אחד' },
    { base: 'batch-10_28b', title: 'המכונה שלא הפסיקה לחבק' },
    { base: 'batch-10_29a', title: 'הכתר שנמס לשתי טבעות' },
    { base: 'batch-10_29b', title: 'הקופסה שמתכווצת' },
    { base: 'batch-10_30a', title: 'הגשר שבאמצע השקט' },
    { base: 'batch-10_30b', title: 'העץ שמעל והעץ שמתחת' },
  ],
  FOCUS: [
    { base: 'batch-11_31a', title: 'הספר שלא יושב בשקט' },
    { base: 'batch-11_31b', title: 'הנעל שעצרה רכבת' },
    { base: 'batch-11_32a', title: 'הכיסא שלא הסכים לשבת' },
    { base: 'batch-11_32b', title: 'הדלת שלא הייתה בשאלה' },
    { base: 'batch-11_33a', title: 'חוטים שלא מפסיקים ללחוש' },
    { base: 'batch-11_33b', title: 'הבלונים שלא הפסיקו למשוך' },
  ],
};

// ── Length mapping ───────────────────────────────────────────────

type StoryLength = 'short' | 'medium' | 'long';

function getLengthSuffix(length: StoryLength): string {
  switch (length) {
    case 'short':  return '_10p';
    case 'medium': return '';       // base file = 15 pages
    case 'long':   return '_20p';
  }
}

// ── Public API ──────────────────────────────────────────────────

export interface StoryBankSelection {
  /** Full filename, e.g. "batch-01_1a_10p.md" */
  filename: string;
  /** Base name for logging, e.g. "batch-01_1a" */
  base: string;
  /** Story title (Hebrew) */
  title: string;
  /** Resolved bank category */
  bankCategory: BankCategory;
}

/**
 * Select a story from the bank based on wizard inputs.
 *
 * Returns null if the category has no stories (shouldn't happen for known categories).
 *
 * @param challengeCategory - from wizard (e.g. 'NIGHT_FEAR', 'NOISE_FEAR')
 * @param storyLength       - 'short' | 'medium' | 'long'
 * @param excludeBases      - optional list of base names to exclude (avoid repeats for same user)
 */
export function selectStoryFromBank(
  challengeCategory: string,
  storyLength: StoryLength,
  excludeBases?: string[],
): StoryBankSelection | null {
  const bankCategory = CATEGORY_MAP[challengeCategory as ChallengeCategory] ?? 'GENERAL_FEARS';
  let pool = STORY_POOL[bankCategory];

  if (!pool || pool.length === 0) return null;

  // Filter out excluded stories (if any)
  if (excludeBases && excludeBases.length > 0) {
    const filtered = pool.filter(s => !excludeBases.includes(s.base));
    if (filtered.length > 0) pool = filtered;
    // If all excluded, use full pool (better to repeat than fail)
  }

  // Random selection
  const entry = pool[Math.floor(Math.random() * pool.length)];
  const suffix = getLengthSuffix(storyLength);
  let filename = `${entry.base}${suffix}.md`;

  // Safety fallback: if requested variant file doesn't exist, fall back to base (15p)
  if (suffix && !existsSync(join(STORY_BANK_DIR, filename))) {
    console.warn(`[story-bank] Missing variant ${filename}, falling back to base 15p`);
    filename = `${entry.base}.md`;
  }

  return {
    filename,
    base: entry.base,
    title: entry.title,
    bankCategory,
  };
}

/**
 * Get all available categories in the story bank.
 */
export function getAvailableBankCategories(): BankCategory[] {
  return Object.keys(STORY_POOL) as BankCategory[];
}

/**
 * Check if a wizard category has stories in the bank.
 */
export function hasBankStories(challengeCategory: string): boolean {
  const bankCategory = CATEGORY_MAP[challengeCategory as ChallengeCategory];
  if (!bankCategory) return false;
  const pool = STORY_POOL[bankCategory];
  return !!pool && pool.length > 0;
}
