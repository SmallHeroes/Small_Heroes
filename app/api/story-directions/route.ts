/**
 * Story directions API — GET (poll) / POST (generate + persist incrementally).
 *
 * ━━━ STORY DIRECTIONS — DEV / PRODUCT QA (manual checklist) ━━━
 * Before release or after prompt/style changes, spot-check one real order:
 *  - Exactly three cards render when ready; footer/CTA only in final state.
 *  - Same child resemblance cues (face, hair, age feel) across all three preview images.
 *  - Same illustration style across all three (matches order illustrationStyle).
 *  - At a glance (~2s): three options feel emotionally distinct.
 *  - Connection: calm, warm, close / safe — not chaotic or high-stakes.
 *  - Adventure: active, exploratory, forward motion — still child-safe, not scary.
 *  - Courage: mild tension or challenge moment — resolved or hopeful cue, still child-safe.
 *  - CTA stays disabled until the user selects a card (partial state: no CTA / no selection).
 *  - Partial state copy + skeletons make it obvious this is not the final choice screen.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma, StoryDirectionArchetype, StoryDirectionSetStatus } from '@prisma/client';
import { TOPICS } from '../../../backend/config/wizard';
import { generateStoryDirectionsIncrementally } from '../../../backend/providers/story-directions';
import { logServerEvent } from '../events/route';
import { enforceRateLimit, enforceSameOrigin } from '../../../lib/request-security';
import { prisma } from '../../../lib/prisma';
import { createLogger } from '../../../lib/logger';
import { getCompanionByIdAndCategory } from '../../../lib/companions';
import { getWizardMeta } from '../../../lib/orderMeta';

const logger = createLogger({ subsystem: 'story-directions', route: '/api/story-directions' });
const DIRECTION_ELIGIBLE_ORDER_STATUSES = new Set(['draft', 'pending_payment']);

/** Prisma `select` used for POST (generation + idempotency). */
const ORDER_SELECT_FOR_DIRECTIONS_POST = {
  id: true,
  status: true,
  childName: true,
  childAge: true,
  childGender: true,
  childTraits: true,
  childImageUrl: true,
  familyContext: true,
  topic: true,
  illustrationStyle: true,
  challengeItems: true,
  challengeFree: true,
  outcomeItems: true,
  helperItems: true,
  characterAnchors: true,
} as const;
type OrderForDirectionsPost = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT_FOR_DIRECTIONS_POST }>;

const ARCHETYPE_ORDER: StoryDirectionArchetype[] = ['connection', 'adventure', 'courage'];
const SUMMARY_MAX_CHARS = 116;

function childAgeBandLabel(age: number | null): string {
  if (!age || age <= 5) return '3-5';
  if (age <= 7) return '5-7';
  return '7-9';
}

function sortedArchetypes() {
  return [...ARCHETYPE_ORDER];
}

function compactSummary(summary: string): string {
  const raw = (summary || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const firstSentence = raw.split(/[.!?]\s/)[0].trim() || raw;
  const sentencePreferred = firstSentence.length >= 36 ? firstSentence : raw;
  let candidate = sentencePreferred;
  if (candidate.length > SUMMARY_MAX_CHARS) {
    const commaCut = candidate.split(/[,:;]/)[0].trim();
    if (commaCut.length >= 30) candidate = commaCut;
  }
  if (candidate.length > SUMMARY_MAX_CHARS) {
    const clipped = candidate.slice(0, SUMMARY_MAX_CHARS);
    const cutAt = clipped.lastIndexOf(' ');
    candidate = (cutAt > 58 ? clipped.slice(0, cutAt) : clipped).trim();
  }
  return candidate.replace(/[,:;.\-–—\s]+$/, '');
}

function isValidDirectionSet(directionSet: {
  status: StoryDirectionSetStatus;
  directions: Array<{ archetype: StoryDirectionArchetype; previewImageUrl: string | null }>;
}): boolean {
  if (!(directionSet.status === 'ready' || directionSet.status === 'selected')) return false;
  if (directionSet.directions.length !== 3) return false;
  const seen = new Set(directionSet.directions.map((direction) => direction.archetype));
  if (seen.size !== 3) return false;
  return directionSet.directions.every((direction) => Boolean(direction.previewImageUrl));
}

function toSerializable(set: {
  id: string;
  orderId: string;
  selectedStyle: string;
  selectedDirectionId: string | null;
  status: StoryDirectionSetStatus;
  createdAt: Date;
  updatedAt: Date;
  directions: Array<{
    id: string;
    archetype: StoryDirectionArchetype;
    title: string;
    summary: string;
    emotionalLabel: string;
    storyPremise: string;
    openingScenePrompt: string;
    previewImagePrompt: string;
    previewImageUrl: string | null;
    previewImageRawUrl: string | null;
  }>;
}) {
  const order = sortedArchetypes();
  const rank = new Map(order.map((value, index) => [value, index]));
  const directions = [...set.directions].sort(
    (a, b) => (rank.get(a.archetype) ?? 99) - (rank.get(b.archetype) ?? 99)
  );

  return {
    id: set.id,
    orderId: set.orderId,
    selectedStyle: set.selectedStyle,
    selectedDirectionId: set.selectedDirectionId,
    status: set.status,
    createdAt: set.createdAt.toISOString(),
    updatedAt: set.updatedAt.toISOString(),
    directions: directions.map((direction) => ({
      id: direction.id,
      archetype: direction.archetype,
      title: direction.title,
      summary: compactSummary(direction.summary),
      emotionalLabel: direction.emotionalLabel,
      storyPremise: direction.storyPremise,
      openingScenePrompt: direction.openingScenePrompt,
      previewImagePrompt: direction.previewImagePrompt,
      previewImageUrl: direction.previewImageUrl ?? undefined,
      previewImageRawUrl: direction.previewImageRawUrl ?? undefined,
    })),
  };
}

export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get('orderId');
    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const record = await prisma.storyDirectionSet.findUnique({
      where: { orderId },
      include: {
        directions: true,
        order: { select: { childAge: true, illustrationStyle: true } },
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Story direction set not found' }, { status: 404 });
    }

    const { order: orderRow, ...set } = record;

    return NextResponse.json({
      storyDirectionSet: toSerializable(set),
      meta: {
        child_age_band: childAgeBandLabel(orderRow.childAge),
        style: orderRow.illustrationStyle,
      },
    });
  } catch (error) {
    logger.error('Story directions fetch failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type StoryDirectionSetWithDirs = Prisma.StoryDirectionSetGetPayload<{
  include: { directions: true };
}>;

type ClaimResult =
  | { kind: 'order_not_found' }
  | { kind: 'reuse_ready'; set: StoryDirectionSetWithDirs }
  | { kind: 'reuse_pending'; set: StoryDirectionSetWithDirs }
  | { kind: 'ineligible' }
  | { kind: 'start'; order: OrderForDirectionsPost; preparedSet: { id: string } };

async function claimOrReuseDirectionsJob(orderId: string): Promise<ClaimResult> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: ORDER_SELECT_FOR_DIRECTIONS_POST,
      });
      if (!order) {
        return { kind: 'order_not_found' as const };
      }

      const existing = await tx.storyDirectionSet.findUnique({
        where: { orderId },
        include: { directions: true },
      });

      if (existing && isValidDirectionSet(existing)) {
        return { kind: 'reuse_ready' as const, set: existing };
      }
      if (existing?.status === 'pending') {
        return { kind: 'reuse_pending' as const, set: existing };
      }

      if (!DIRECTION_ELIGIBLE_ORDER_STATUSES.has(order.status)) {
        return { kind: 'ineligible' as const };
      }

      const preparedSet = await tx.storyDirectionSet.upsert({
        where: { orderId },
        update: {
          selectedStyle: order.illustrationStyle,
          selectedDirectionId: null,
          status: 'pending',
        },
        create: {
          orderId,
          selectedStyle: order.illustrationStyle,
          status: 'pending',
        },
      });

      await tx.storyDirection.deleteMany({
        where: { directionSetId: preparedSet.id },
      });

      return { kind: 'start' as const, order, preparedSet: { id: preparedSet.id } };
    },
    {
      maxWait: 12_000,
      timeout: 20_000,
    }
  );
}

export async function POST(req: NextRequest) {
  let orderId = '';
  try {
    const sameOriginError = enforceSameOrigin(req);
    if (sameOriginError) return sameOriginError;
    const rateLimitError = enforceRateLimit(req, {
      namespace: 'api-story-directions-post',
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimitError) return rateLimitError;

    const body = await req.json();
    orderId = body?.orderId;
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const claim = await claimOrReuseDirectionsJob(orderId);

    if (claim.kind === 'order_not_found') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (claim.kind === 'ineligible') {
      return NextResponse.json({ error: 'Order is not ready for story directions' }, { status: 409 });
    }
    if (claim.kind === 'reuse_ready') {
      const existing = claim.set;
      console.info(
        `[DirectionsGeneration] reuse_ready orderId=${orderId} ` +
          `directionSetId=${existing.id} status=${existing.status} directionsCount=${existing.directions.length}`
      );
      logger.info('Story directions cache hit: reusing existing preview images', {
        orderId,
        directionSetId: existing.id,
        status: existing.status,
        directionsCount: existing.directions.length,
      });
      return NextResponse.json({
        storyDirectionSet: toSerializable(existing),
        generated: false,
      });
    }
    if (claim.kind === 'reuse_pending') {
      const existing = claim.set;
      console.info(
        `[DirectionsGeneration] reuse_pending orderId=${orderId} ` +
          `directionSetId=${existing.id} (skip_duplicate: in-flight job)`
      );
      console.info(
        `[DirectionsGeneration] skip_duplicate orderId=${orderId} ` +
          `reason=existing_pending_serialized_by_db_lock`
      );
      logger.info('Story directions still pending: returning existing in-flight set', {
        orderId,
        directionSetId: existing.id,
      });
      return NextResponse.json(
        {
          status: 'pending',
          message: 'Story directions are already generating',
          storyDirectionSet: toSerializable(existing),
          generated: false,
        },
        { status: 202 }
      );
    }

    const { order, preparedSet } = claim;

    console.info(`[DirectionsGeneration] start orderId=${orderId} directionSetId=${preparedSet.id}`);
    const wizardMeta = getWizardMeta(order.characterAnchors);
    const resolvedCompanion = getCompanionByIdAndCategory(
      wizardMeta.companionCharacterId ?? null,
      wizardMeta.challengeCategory ?? null
    );
    console.info('[api/story-directions] resolved companion', {
      orderId,
      companionId: resolvedCompanion?.id ?? null,
      name: resolvedCompanion?.name ?? null,
    });

    logger.info('Story directions generation triggered', {
      orderId,
      reason: 'directions_generation',
      reusedExistingSet: false,
    });

    const topicLabel = TOPICS.find((topic) => topic.id === order.topic)?.label ?? order.topic;
    const genStarted = Date.now();
    await generateStoryDirectionsIncrementally(
      {
        orderId: order.id,
        childName: order.childName,
        childAge: order.childAge,
        childGender: order.childGender,
        childTraits: order.childTraits,
        childImageUrl: order.childImageUrl,
        illustrationStyle: order.illustrationStyle,
        familyContext: order.familyContext,
        topic: order.topic,
        topicLabel,
        challengeItems: order.challengeItems,
        challengeFree: order.challengeFree,
        outcomeItems: order.outcomeItems,
        helperItems: order.helperItems,
        companion: resolvedCompanion,
        challengeCategory: wizardMeta.challengeCategory ?? null,
        categoryAnswers: Array.isArray(wizardMeta.categoryAnswers) ? wizardMeta.categoryAnswers : [],
      },
      async (direction) => {
        await prisma.storyDirection.create({
          data: {
            directionSetId: preparedSet.id,
            archetype: direction.archetype,
            title: direction.title,
            summary: direction.summary,
            emotionalLabel: direction.emotionalLabel,
            storyPremise: direction.storyPremise,
            openingScenePrompt: direction.openingScenePrompt,
            previewImagePrompt: direction.previewImagePrompt,
            previewImageUrl: direction.previewImageUrl ?? null,
            previewImageRawUrl: direction.previewImageRawUrl ?? null,
          },
        });
      }
    );

    await prisma.storyDirectionSet.update({
      where: { id: preparedSet.id },
      data: { status: 'ready' },
    });

    const finalSet = await prisma.storyDirectionSet.findUnique({
      where: { id: preparedSet.id },
      include: { directions: true },
    });

    if (!finalSet) {
      throw new Error('Story direction set missing after generation');
    }

    logServerEvent('story_directions_ready', {
      orderId,
      generation_time_ms: Date.now() - genStarted,
      style: order.illustrationStyle,
      child_age_band: childAgeBandLabel(order.childAge),
    });

    return NextResponse.json({
      storyDirectionSet: toSerializable(finalSet),
      generated: true,
    });
  } catch (error) {
    logger.error('Story directions generation failed', error, {
      orderId: orderId || undefined,
      stage: 'generation',
    });
    const errorType =
      error instanceof Error ? error.message.slice(0, 120) : 'unknown';
    logServerEvent('directions_error', {
      orderId: orderId || '',
      stage: 'generation',
      error_type: errorType,
    });
    if (orderId) {
      await prisma.storyDirectionSet
        .updateMany({
          where: { orderId },
          data: { status: 'failed' },
        })
        .catch(() => {});
    }
    return NextResponse.json({ error: 'Failed to generate story directions' }, { status: 500 });
  }
}
