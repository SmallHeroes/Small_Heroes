/**
 * MVP launch matrix — single source of truth for sellable (category × direction) slots.
 * Wizard UI + order API + dev admin MUST use these helpers — no parallel hardcoding.
 */
import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join, resolve, sep } from 'path';
import {
  isV3ApprovedBankEnabled,
  isWizardQaStoryBankEnabled,
  STORY_BANK_V3_DIR_NAME,
  V3_APPROVED_DIR_NAME,
  WIZARD_QA_STORY_DIR_NAME,
} from '../providers/story-bank-index';
import { STYLE_IDS } from '@/lib/styles';
import { evaluateWizardVisualPackageSelection } from '@/lib/visual-package/wizardVisualPackageSelection';

export type SlotStatus = 'approved' | 'approved_v3' | 'in_gate' | 'missing';
export type MvpCategory = keyof typeof MVP_STORY_MATRIX;
export type StoryDirection = 'bedtime' | 'adventure' | 'fantasy';

const DIRECTIONS: StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];

export const MVP_STORY_MATRIX = {
  NIGHT_FEAR: {
    companionId: 'fox_uri',
    directions: { bedtime: 'approved_v3', adventure: 'approved_v3', fantasy: 'approved_v3' },
  },
  SOCIAL: {
    companionId: 'panda_anat',
    directions: { bedtime: 'approved_v3', adventure: 'approved_v3', fantasy: 'approved_v3' },
  },
  MEDICAL_PROCEDURE: {
    companionId: 'bunny_ometz',
    directions: { bedtime: 'approved_v3', adventure: 'approved_v3', fantasy: 'approved_v3' },
  },
  NEW_SIBLING: {
    companionId: 'dragon_dini',
    directions: { bedtime: 'approved_v3', adventure: 'approved_v3', fantasy: 'approved_v3' },
  },
  TRANSITION: {
    companionId: 'chameleon_koko',
    directions: { bedtime: 'approved_v3', adventure: 'approved_v3', fantasy: 'approved_v3' },
  },
  ANGER_FRUSTRATION: {
    companionId: 'lion_shaket',
    directions: { bedtime: 'approved_v3', adventure: 'approved_v3', fantasy: 'approved_v3' },
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
    label: 'פחדים בלילה',
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
    label: 'כעס גדול',
    emoji: '⚡',
    companionLine: 'עם האריה ליאו',
    oneLiner: 'כשהכעס ממלא את כל הגוף — לומדים לכוון אותו, לא לבלוע אותו',
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
  direction: StoryDirection,
  repoRoot: string,
): boolean {
  const sidecarPath = join(
    repoRoot,
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

function wizardQaImportSidecarValid(
  companionId: string,
  direction: StoryDirection,
  repoRoot: string,
): boolean {
  const storyKey = `${companionId}_${direction}`;
  const bankRoot = join(repoRoot, 'story-bank', WIZARD_QA_STORY_DIR_NAME);
  const sidecarPath = join(bankRoot, `${storyKey}.import.json`);
  if (!existsSync(sidecarPath)) return false;
  try {
    const meta = JSON.parse(readFileSync(sidecarPath, 'utf8')) as {
      version?: string;
      status?: string;
      authorityScope?: string;
      productionEligible?: boolean;
      storyKey?: string;
      approvedBy?: string;
      approvedAt?: string;
      companionId?: string;
      direction?: string;
      pageCount?: number;
      source?: { storySha256?: string };
      visualDirections?: { path?: string; sha256?: string };
      integratedStory?: { path?: string; sha256?: string; sourceProjectionSha256?: string };
    };
    const expectedPageCount: Record<StoryDirection, number> = {
      bedtime: 8,
      adventure: 12,
      fantasy: 16,
    };
    const expectedStoryRel = `story-bank/${WIZARD_QA_STORY_DIR_NAME}/${storyKey}.md`;
    if (
      meta.version !== 'story-bank-import/v4' ||
      meta.status !== 'qa_ready_for_low_story_generation' ||
      meta.authorityScope !== 'qa_only' ||
      meta.productionEligible !== false ||
      meta.storyKey !== storyKey ||
      !meta.approvedBy?.trim() ||
      !meta.approvedAt || Number.isNaN(Date.parse(meta.approvedAt)) ||
      meta.companionId !== companionId || meta.direction !== direction ||
      meta.pageCount !== expectedPageCount[direction] ||
      typeof meta.visualDirections?.path !== 'string' ||
      typeof meta.visualDirections.sha256 !== 'string' ||
      meta.integratedStory?.path !== expectedStoryRel ||
      typeof meta.integratedStory.sha256 !== 'string' ||
      typeof meta.integratedStory.sourceProjectionSha256 !== 'string' ||
      meta.source?.storySha256 !== meta.integratedStory.sourceProjectionSha256
    ) return false;
    const visualDirections = meta.visualDirections!;
    const integratedStory = meta.integratedStory!;
    const root = repoRoot;
    const storyPath = join(bankRoot, `${storyKey}.md`);
    const directionPath = resolve(root, visualDirections.path!);
    if (!directionPath.startsWith(`${resolve(root)}${sep}`) || !existsSync(directionPath)) return false;
    const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
    const storyBytes = readFileSync(storyPath);
    if (digest(storyBytes) !== integratedStory.sha256) return false;
    const sourceProjection = storyBytes.toString('utf8').replace(/^imageDirection:.*\r?\n/gm, '');
    if (digest(sourceProjection) !== integratedStory.sourceProjectionSha256) return false;
    if (digest(readFileSync(directionPath)) !== visualDirections.sha256) return false;
    const directionCount = (storyBytes.toString('utf8').match(/^imageDirection:\s*\S.*$/gm) ?? []).length;
    return directionCount === meta.pageCount;
  } catch {
    return false;
  }
}

/** approved_v3 = flag ON + bank file + valid import sidecar. */
export function isV3SlotRuntimeReady(
  companionId: string,
  direction: StoryDirection,
  options: { repoRoot?: string } = {},
): boolean {
  const repoRoot = options.repoRoot ?? process.cwd();
  if (isWizardQaStoryBankEnabled()) {
    return wizardQaImportSidecarValid(companionId, direction, repoRoot);
  }
  if (!isV3ApprovedBankEnabled()) return false;
  const md = join(
    repoRoot,
    'story-bank',
    V3_APPROVED_DIR_NAME,
    `${companionId}_${direction}.md`
  );
  if (!existsSync(md)) return false;
  return v3ImportSidecarValid(companionId, direction, repoRoot);
}

/** approved = golden v5 (configured bank dir) file exists for companion+direction. */
export function isGoldenSlotRuntimeReady(
  companionId: string,
  direction: StoryDirection,
  options: { repoRoot?: string } = {},
): boolean {
  const storyFile = join(
    options.repoRoot ?? process.cwd(),
    'story-bank',
    STORY_BANK_V3_DIR_NAME,
    `${companionId}_${direction}.md`
  );
  return existsSync(storyFile);
}

export function isSlotSellable(
  category: string,
  direction: string,
  options: { repoRoot?: string } = {},
): boolean {
  const cat = normalizeMvpCategory(category);
  const dir = normalizeStoryDirection(direction);
  if (!cat || !dir) return false;

  const configured = configuredSlotStatus(cat, dir);
  const companionId = MVP_STORY_MATRIX[cat].companionId;

  if (configured === 'missing' || configured === 'in_gate') return false;
  const v4Selection = evaluateWizardVisualPackageSelection({
    repoRoot: options.repoRoot ?? process.cwd(),
    storyKey: `${companionId}_${dir}`,
    styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  });
  if (v4Selection.renderQualified) return true;
  if (v4Selection.visualPackageRequired) return false;
  if (configured === 'approved_v3') {
    return isV3SlotRuntimeReady(companionId, dir, options);
  }
  if (configured === 'approved') {
    return isGoldenSlotRuntimeReady(companionId, dir, options);
  }
  return false;
}

export function sellableDirectionsFor(category: string): StoryDirection[] {
  const cat = normalizeMvpCategory(category);
  if (!cat) return [];
  return DIRECTIONS.filter((dir) => isSlotSellable(cat, dir));
}

export function matrixSlotSummary(
  category: MvpCategory,
  direction: StoryDirection,
  options: { repoRoot?: string } = {},
): {
  configured: SlotStatus;
  sellable: boolean;
  companionId: string;
} {
  const configured = configuredSlotStatus(category, direction);
  return {
    configured,
    sellable: isSlotSellable(category, direction, options),
    companionId: MVP_STORY_MATRIX[category].companionId,
  };
}

export function allMvpCategories(): MvpCategory[] {
  return Object.keys(MVP_STORY_MATRIX) as MvpCategory[];
}

/** Topic id (wizard) → MVP category */
export class MvpMatrixValidationError extends Error {
  readonly httpStatus = 422;
  constructor(message: string) {
    super(message);
    this.name = 'MvpMatrixValidationError';
  }
}

/** Server gate: derive companion from matrix; reject non-sellable or mismatched client claims. */
export function enforceMvpOrderSlot(input: {
  challengeCategory?: string | null;
  clientDirection?: string | null;
  clientCompanionId?: string | null;
}, options: { repoRoot?: string } = {}): {
  category: MvpCategory;
  direction: StoryDirection;
  companionId: string;
} {
  const category = normalizeMvpCategory(input.challengeCategory);
  if (!category) {
    throw new MvpMatrixValidationError('השילוב שנבחר אינו זמין לרכישה כרגע');
  }

  const direction = normalizeStoryDirection(input.clientDirection);
  if (!direction) {
    throw new MvpMatrixValidationError('יש לבחור סוג חוויה תקין לפני המשך');
  }

  if (!isSlotSellable(category, direction, options)) {
    throw new MvpMatrixValidationError(
      'השילוב שנבחר אינו זמין לרכישה כרגע — נסו כיוון אחר או אתגר אחר'
    );
  }

  const companionId = companionForCategory(category)!;
  const clientCompanion = String(input.clientCompanionId ?? '').trim();
  if (clientCompanion && clientCompanion !== companionId) {
    throw new MvpMatrixValidationError('דמות המלווה אינה תואמת לאתגר שנבחר');
  }

  return { category, direction, companionId };
}

export function categoryForTopicId(topicId: string): MvpCategory | null {
  const id = String(topicId ?? '').trim();
  for (const [category, copy] of Object.entries(MVP_WIZARD_CARD_COPY) as Array<
    [MvpCategory, (typeof MVP_WIZARD_CARD_COPY)[MvpCategory]]
  >) {
    if (copy.topicId === id) return category;
  }
  return null;
}
