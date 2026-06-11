/**
 * MVP launch matrix — single source of truth for sellable (category × direction) slots.
 * Wizard UI + order API + dev admin MUST use these helpers — no parallel hardcoding.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  isV3ApprovedBankEnabled,
  STORY_BANK_V3_DIR_NAME,
  V3_APPROVED_DIR_NAME,
} from '../providers/story-bank-index';

export type SlotStatus = 'approved' | 'approved_v3' | 'in_gate' | 'missing';
export type MvpCategory = keyof typeof MVP_STORY_MATRIX;
export type StoryDirection = 'bedtime' | 'adventure' | 'fantasy';

const DIRECTIONS: StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];

export const MVP_STORY_MATRIX = {
  NIGHT_FEAR: {
    companionId: 'fox_uri',
    directions: { bedtime: 'approved', adventure: 'missing', fantasy: 'missing' },
  },
  SOCIAL: {
    companionId: 'panda_anat',
    directions: { bedtime: 'missing', adventure: 'approved', fantasy: 'missing' },
  },
  MEDICAL_PROCEDURE: {
    companionId: 'bunny_ometz',
    directions: { bedtime: 'approved_v3', adventure: 'approved', fantasy: 'missing' },
  },
  NEW_SIBLING: {
    companionId: 'dragon_dini',
    directions: { bedtime: 'missing', adventure: 'missing', fantasy: 'approved' },
  },
  TRANSITION: {
    companionId: 'chameleon_koko',
    directions: { bedtime: 'missing', adventure: 'approved', fantasy: 'missing' },
  },
  ANGER_FRUSTRATION: {
    companionId: 'lion_shaket',
    directions: { bedtime: 'missing', adventure: 'approved', fantasy: 'missing' },
  },
} as const satisfies Record<
  string,
  { companionId: string; directions: Record<StoryDirection, SlotStatus> }
>;

/** Wizard card copy — parent-facing one-liners (Hebrew). */
export const MVP_WIZARD_CARD_COPY: Record<
  MvpCategory,
  { topicId: string; label: string; emoji: string; oneLiner: string; companionLine: string }
> = {
  NIGHT_FEAR: {
    topicId: 'night',
    label: 'פחד בלילה',
    emoji: '🌙',
    companionLine: 'עם אוּרי השועל והפנס הקטן',
    oneLiner: 'סיפור שעוזר להכיר את הלילה במקום לפחד ממנו',
  },
  SOCIAL: {
    topicId: 'social',
    label: 'קושי חברתי',
    emoji: '🤝',
    companionLine: 'עם הפנדה עֲנָת',
    oneLiner: 'סיפור שעוזר למצוא דרך להצטרף — גם בלי להיות הכי רועשים בחדר',
  },
  MEDICAL_PROCEDURE: {
    topicId: 'medical',
    label: 'בדיקה רפואית',
    emoji: '🩹',
    companionLine: 'עם בּוּנִי־אומץ',
    oneLiner: 'סיפור שעוזר להגיד אמת קטנה גם כשהגוף קצת רועד',
  },
  NEW_SIBLING: {
    topicId: 'new_sibling',
    label: 'אח/ות חדש/ה',
    emoji: '👶',
    companionLine: 'עם הדרקון דיני',
    oneLiner: 'סיפור על מקום בלב גם כשמישהו חדש מצטרף לבית',
  },
  TRANSITION: {
    topicId: 'transitions',
    label: 'מעבר ושינוי',
    emoji: '🌱',
    companionLine: 'עם הזיקית קִים',
    oneLiner: 'בכל מקום חדש — חלק מהבית נוסע איתך',
  },
  ANGER_FRUSTRATION: {
    topicId: 'anger',
    label: 'כעס ותסכול',
    emoji: '⚡',
    companionLine: 'עם האריה לֵיוֹ',
    oneLiner: 'הקול שלך קיים — לפעמים הלחש חזק מהצעקה',
  },
};

export const MVP_WIZARD_HEADER = {
  title: 'בחרו את האתגר של הילד/ה — ואחר כך את סוג החוויה שמתאים לכם עכשיו.',
  sub: 'לכל אתגר בחרנו חבר סיפור שמתאים במיוחד אליו.',
};

export function isMvpCategory(value: string | null | undefined): value is MvpCategory {
  const key = String(value ?? '').trim().toUpperCase();
  return key in MVP_STORY_MATRIX;
}

export function normalizeMvpCategory(value: string | null | undefined): MvpCategory | null {
  return isMvpCategory(value) ? (String(value).trim().toUpperCase() as MvpCategory) : null;
}

export function normalizeStoryDirection(value: string | null | undefined): StoryDirection | null {
  const raw = String(value ?? '').trim().toLowerCase();
  return (DIRECTIONS as string[]).includes(raw) ? (raw as StoryDirection) : null;
}

export function companionForCategory(category: string): string | null {
  const cat = normalizeMvpCategory(category);
  if (!cat) return null;
  return MVP_STORY_MATRIX[cat].companionId;
}

export function configuredSlotStatus(category: MvpCategory, direction: StoryDirection): SlotStatus {
  return MVP_STORY_MATRIX[category].directions[direction];
}

function v3ImportSidecarValid(
  companionId: string,
  direction: StoryDirection
): boolean {
  const sidecarPath = join(
    process.cwd(),
    'story-bank',
    V3_APPROVED_DIR_NAME,
    `${companionId}_${direction}.import.json`
  );
  if (!existsSync(sidecarPath)) return false;
  try {
    const meta = JSON.parse(readFileSync(sidecarPath, 'utf8')) as {
      approvedBy?: string;
      approvedAt?: string;
      companionId?: string;
      direction?: string;
    };
    return Boolean(
      meta.approvedBy?.trim() &&
        meta.approvedAt &&
        !Number.isNaN(Date.parse(meta.approvedAt)) &&
        meta.companionId === companionId &&
        meta.direction === direction
    );
  } catch {
    return false;
  }
}

/** approved_v3 = flag ON + bank file + valid import sidecar. */
export function isV3SlotRuntimeReady(companionId: string, direction: StoryDirection): boolean {
  if (!isV3ApprovedBankEnabled()) return false;
  const md = join(
    process.cwd(),
    'story-bank',
    V3_APPROVED_DIR_NAME,
    `${companionId}_${direction}.md`
  );
  if (!existsSync(md)) return false;
  return v3ImportSidecarValid(companionId, direction);
}

/** approved = golden v5 (configured bank dir) file exists for companion+direction. */
export function isGoldenSlotRuntimeReady(companionId: string, direction: StoryDirection): boolean {
  const storyFile = join(
    process.cwd(),
    'story-bank',
    STORY_BANK_V3_DIR_NAME,
    `${companionId}_${direction}.md`
  );
  return existsSync(storyFile);
}

export function isSlotSellable(category: string, direction: string): boolean {
  const cat = normalizeMvpCategory(category);
  const dir = normalizeStoryDirection(direction);
  if (!cat || !dir) return false;

  const configured = configuredSlotStatus(cat, dir);
  const companionId = MVP_STORY_MATRIX[cat].companionId;

  if (configured === 'missing' || configured === 'in_gate') return false;
  if (configured === 'approved_v3') return isV3SlotRuntimeReady(companionId, dir);
  if (configured === 'approved') return isGoldenSlotRuntimeReady(companionId, dir);
  return false;
}

export function sellableDirectionsFor(category: string): StoryDirection[] {
  const cat = normalizeMvpCategory(category);
  if (!cat) return [];
  return DIRECTIONS.filter((dir) => isSlotSellable(cat, dir));
}

export function matrixSlotSummary(category: MvpCategory, direction: StoryDirection): {
  configured: SlotStatus;
  sellable: boolean;
  companionId: string;
} {
  const configured = configuredSlotStatus(category, direction);
  return {
    configured,
    sellable: isSlotSellable(category, direction),
    companionId: MVP_STORY_MATRIX[category].companionId,
  };
}

export function allMvpCategories(): MvpCategory[] {
  return Object.keys(MVP_STORY_MATRIX) as MvpCategory[];
}

/** Topic id (wizard) → MVP category */
export function categoryForTopicId(topicId: string): MvpCategory | null {
  const id = String(topicId ?? '').trim();
  for (const [category, copy] of Object.entries(MVP_WIZARD_CARD_COPY) as Array<
    [MvpCategory, (typeof MVP_WIZARD_CARD_COPY)[MvpCategory]]
  >) {
    if (copy.topicId === id) return category;
  }
  return null;
}
