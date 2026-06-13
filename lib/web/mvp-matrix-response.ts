/**
 * Shared MVP matrix payload for GET /api/wizard/mvp-matrix and React entry pages.
 * Single builder — React must not hand-maintain category/companion/sellability data.
 */
import {
  ACTIVE_WIZARD_CATEGORIES,
  getCompanionById,
  type ChallengeCategory,
} from '@/lib/companions';
import { isDevEnvironment } from '@/lib/dev-only-guard';
import {
  allMvpCategories,
  matrixSlotSummary,
  MVP_WIZARD_CARD_COPY,
  MVP_WIZARD_HEADER,
  MVP_STORY_MATRIX,
  type MvpCategory,
  type StoryDirection,
} from '@/backend/config/mvp-story-matrix';
import { DIRECTION_PAGE_MAP, displayPagesForBeats } from '@/backend/config/wizard';

const DIRECTIONS: StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];

/** Hebrew labels for wizard categories not yet in MVP (dev parked cards on legacy step-1). */
const PARKED_CATEGORY_COPY: Partial<
  Record<
    ChallengeCategory,
    { topicId: string; label: string; emoji: string; oneLiner: string }
  >
> = {
  NOISE_FEAR: {
    topicId: 'sirens',
    label: 'רעשים ואזעקות',
    emoji: '💥',
    oneLiner: 'רעשים חזקים, אזעקות או התרגשות מפתאומית',
  },
  SELF_CONFIDENCE: {
    topicId: 'confidence',
    label: 'ביטחון וערך עצמי',
    emoji: '🌟',
    oneLiner: 'כשחשוב לחזק ביטחון, שייכות וערך עצמי',
  },
  SENSITIVITY_OVERWHELM: {
    topicId: 'sensitivity',
    label: 'רגישות ועומס',
    emoji: '🌿',
    oneLiner: 'רגישות גבוהה, עומס רגשי או שינויים קטנים שמרגישים גדולים',
  },
  FOCUS_LEARNING: {
    topicId: 'focus',
    label: 'קשב, סקרנות ולמידה',
    emoji: '🦋',
    oneLiner: 'קשב, סקרנות, למידה או התמודדות עם משימות חדשות',
  },
};

export type MvpMatrixCategoryPayload = ReturnType<typeof buildCategoryPayload>;

function buildCategoryPayload(category: MvpCategory, publicVisible: boolean) {
  const copy = MVP_WIZARD_CARD_COPY[category];
  const companionId = MVP_STORY_MATRIX[category].companionId;
  const companion = getCompanionById(companionId);
  const directions = Object.fromEntries(
    DIRECTIONS.map((direction) => {
      const summary = matrixSlotSummary(category, direction);
      const pageMap = DIRECTION_PAGE_MAP[direction];
      return [
        direction,
        {
          configured: summary.configured,
          sellable: summary.sellable,
          priceILS: pageMap?.priceILS ?? 0,
          displayPages: displayPagesForBeats(pageMap?.pages ?? 0),
        },
      ];
    })
  ) as Record<
    StoryDirection,
    { configured: string; sellable: boolean; priceILS: number; displayPages: number }
  >;

  return {
    category,
    topicId: copy.topicId,
    label: copy.label,
    emoji: copy.emoji,
    oneLiner: copy.oneLiner,
    companionLine: copy.companionLine,
    publicVisible,
    companion: companion
      ? {
          id: companion.id,
          name: companion.name,
          image: companion.cardImage ?? companion.image,
          tagline: companion.tagline,
        }
      : { id: companionId, name: companionId, image: '', tagline: '' },
    directions,
  };
}

export function buildMvpMatrixResponse() {
  const dev = isDevEnvironment();
  const categories = allMvpCategories().map((category) => buildCategoryPayload(category, true));

  const mvpSet = new Set(allMvpCategories());
  const parkedCategories = dev
    ? (ACTIVE_WIZARD_CATEGORIES as readonly ChallengeCategory[])
        .filter((cat) => !mvpSet.has(cat as MvpCategory))
        .map((cat) => {
          const copy = PARKED_CATEGORY_COPY[cat];
          return {
            category: cat,
            topicId: copy?.topicId ?? null,
            label: copy?.label ?? cat,
            emoji: copy?.emoji ?? '🔒',
            oneLiner: copy?.oneLiner ?? 'לא ב-MVP — dev only',
            companionLine: '',
            publicVisible: false,
            companion: null,
            directions: Object.fromEntries(
              DIRECTIONS.map((direction) => [
                direction,
                { configured: 'missing' as const, sellable: false },
              ])
            ),
          };
        })
    : [];

  return {
    header: MVP_WIZARD_HEADER,
    categories,
    parkedCategories,
    dev: dev
      ? {
          showCompanionStep: false,
          showParkedCategories: true,
        }
      : null,
  };
}
