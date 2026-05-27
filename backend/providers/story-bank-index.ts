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
// Companion-direction stories. Defaults to v5-fixed-v2 (97% PASS QA, 108 stories).
// Override with STORY_BANK_V3_DIR env var to roll back (e.g. 'v3').
const V3_STORY_DIR_NAME = (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim();
const V3_STORY_DIR = join(process.cwd(), 'story-bank', V3_STORY_DIR_NAME);
export const STORY_BANK_V3_DIR_NAME = V3_STORY_DIR_NAME;

/** Companions with handcrafted v3 markdown stories (one file per direction).
 *  All 36 companions have 3 directions each (bedtime/adventure/fantasy) = 108 stories.
 *  Categories align with `lib/companions.ts` wizard categories. */
const V3_COMPANIONS = new Set([
  // ANGER_FRUSTRATION
  'octopus_seara', 'bear_cub_gahal', 'salamander_lahav',
  // NIGHT_FEAR
  'bat_lily', 'fox_uri', 'owl_chacham',
  // TRANSITION
  'chameleon_koko', 'squirrel_navad', 'turtle_beiti',
  // SENSITIVITY_OVERWHELM
  'fawn_tzvi', 'snail_sheli', 'kitten_mishi',
  // SOCIAL
  'panda_anat', 'bear_mati', 'hedgehog_rachi',
  // FOCUS_LEARNING
  'hawk_had', 'dolphin_shahkan', 'captain_navat',
  // NEW_SIBLING
  'pelican_kis', 'dragon_dini', 'bee_ima',
  // SELF_CONFIDENCE
  'lion_shaket', 'butterfly_zohar', 'ant_harutza',
  // NOISE_FEAR
  'footstep_giant', 'song_whale', 'mole_sheket',
  // GENERAL_FEARS
  'firefly_namit', 'bunny_ometz', 'mongoose_zariz',
  // MEDICAL_PROCEDURE
  'starfish_kokhavi', 'seahorse_yam', 'gecko_rifa',
  // OTHER
  'puppy_neeman', 'parrot_tzivon', 'wolf_pup_siyar',
  // BEDTIME_ANTICIPATION (Bolly — flagship v0.5 recipe)
  'bolly_armadillo',
]);

export const V3_COMPANION_BANK_CATEGORY: Record<string, BankCategory> = {
  // ANGER_FRUSTRATION
  octopus_seara: 'ANGER_FRUSTRATION',
  bear_cub_gahal: 'ANGER_FRUSTRATION',
  salamander_lahav: 'ANGER_FRUSTRATION',
  // NIGHT_FEAR
  bat_lily: 'NIGHT_FEAR',
  fox_uri: 'NIGHT_FEAR',
  owl_chacham: 'NIGHT_FEAR',
  // TRANSITION
  chameleon_koko: 'TRANSITION',
  squirrel_navad: 'TRANSITION',
  turtle_beiti: 'TRANSITION',
  // SENSITIVITY_OVERWHELM
  fawn_tzvi: 'SENSITIVITY_OVERWHELM',
  snail_sheli: 'SENSITIVITY_OVERWHELM',
  kitten_mishi: 'SENSITIVITY_OVERWHELM',
  // SOCIAL
  panda_anat: 'SOCIAL',
  bear_mati: 'SOCIAL',
  hedgehog_rachi: 'SOCIAL',
  // FOCUS_LEARNING → FOCUS
  hawk_had: 'FOCUS',
  dolphin_shahkan: 'FOCUS',
  captain_navat: 'FOCUS',
  // NEW_SIBLING → SIBLING
  pelican_kis: 'SIBLING',
  dragon_dini: 'SIBLING',
  bee_ima: 'SIBLING',
  // SELF_CONFIDENCE → CONFIDENCE
  lion_shaket: 'CONFIDENCE',
  butterfly_zohar: 'CONFIDENCE',
  ant_harutza: 'CONFIDENCE',
  // NOISE_FEAR → SIRENS
  footstep_giant: 'SIRENS',
  song_whale: 'SIRENS',
  mole_sheket: 'SIRENS',
  // GENERAL_FEARS
  firefly_namit: 'GENERAL_FEARS',
  bunny_ometz: 'GENERAL_FEARS',
  mongoose_zariz: 'GENERAL_FEARS',
  // MEDICAL_PROCEDURE → MEDICAL
  starfish_kokhavi: 'MEDICAL',
  seahorse_yam: 'MEDICAL',
  gecko_rifa: 'MEDICAL',
  // OTHER → GENERAL_FEARS (fallback bank category)
  puppy_neeman: 'GENERAL_FEARS',
  parrot_tzivon: 'GENERAL_FEARS',
  wolf_pup_siyar: 'GENERAL_FEARS',
  bolly_armadillo: 'MEDICAL',
};

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

/**
 * Try to select a companion-specific v3 story (`story-bank/v3/{companionId}_{direction}.md`).
 * Returns null if companion has no v3 story for this direction or the file is missing.
 */
export function selectCompanionStory(
  companionId: string | null | undefined,
  direction: string | null | undefined,
): StoryBankSelection | null {
  if (!companionId || !direction) return null;
  if (!V3_COMPANIONS.has(companionId)) return null;

  const dir = direction.trim().toLowerCase();
  if (dir !== 'bedtime' && dir !== 'adventure' && dir !== 'fantasy') return null;

  const filename = `${companionId}_${dir}.md`;
  const fullPath = join(V3_STORY_DIR, filename);

  if (!existsSync(fullPath)) {
    console.warn(`[story-bank] v3 file missing: ${filename}`);
    return null;
  }

  const bankCategory = V3_COMPANION_BANK_CATEGORY[companionId] ?? 'GENERAL_FEARS';

  return {
    filename,
    base: `${companionId}_${dir}`,
    title: 'v3 companion story',
    bankCategory,
  };
}
