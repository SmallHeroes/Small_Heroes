/**
 * GET /api/wizard/mvp-matrix
 *
 * Public wizard challenge cards + direction sellability per MVP_STORY_MATRIX.
 * Dev mode also returns non-MVP categories (parked) with matrix state labels.
 */

import { NextResponse } from 'next/server';
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DIRECTIONS: StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];

function buildCategoryPayload(category: MvpCategory, publicVisible: boolean) {
  const copy = MVP_WIZARD_CARD_COPY[category];
  const companionId = MVP_STORY_MATRIX[category].companionId;
  const companion = getCompanionById(companionId);
  const directions = Object.fromEntries(
    DIRECTIONS.map((direction) => {
      const summary = matrixSlotSummary(category, direction);
      return [
        direction,
        {
          configured: summary.configured,
          sellable: summary.sellable,
        },
      ];
    })
  ) as Record<
    StoryDirection,
    { configured: string; sellable: boolean }
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
          image: companion.image,
          tagline: companion.tagline,
        }
      : { id: companionId, name: companionId, image: '', tagline: '' },
    directions,
  };
}

export async function GET() {
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

  return NextResponse.json({
    header: MVP_WIZARD_HEADER,
    categories,
    parkedCategories,
    dev: dev
      ? {
          showCompanionStep: false,
          showParkedCategories: true,
        }
      : null,
  });
}
