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
        .map((cat) => ({
          category: cat,
          topicId: null,
          label: cat,
          emoji: '🔒',
          oneLiner: 'לא ב-MVP — dev only',
          companionLine: '',
          publicVisible: false,
          companion: null,
          directions: Object.fromEntries(
            DIRECTIONS.map((direction) => [
              direction,
              { configured: 'missing' as const, sellable: false },
            ])
          ),
        }))
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
