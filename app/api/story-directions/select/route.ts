import { NextRequest, NextResponse } from 'next/server';
import { logServerEvent } from '../../events/route';
import { enforceRateLimit, enforceSameOrigin } from '../../../../lib/request-security';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ subsystem: 'story-directions-select', route: '/api/story-directions/select' });

export async function POST(req: NextRequest) {
  try {
    const sameOriginError = enforceSameOrigin(req);
    if (sameOriginError) return sameOriginError;
    const rateLimitError = enforceRateLimit(req, {
      namespace: 'api-story-directions-select-post',
      limit: 25,
      windowMs: 60_000,
    });
    if (rateLimitError) return rateLimitError;

    const body = await req.json();
    const orderId = body?.orderId;
    const directionId = body?.directionId;

    if (!orderId || !directionId || typeof orderId !== 'string' || typeof directionId !== 'string') {
      return NextResponse.json({ error: 'orderId and directionId are required' }, { status: 400 });
    }

    const directionSet = await prisma.storyDirectionSet.findUnique({
      where: { orderId },
      include: {
        directions: true,
        order: {
          select: {
            id: true,
            childAge: true,
            illustrationStyle: true,
          },
        },
      },
    });

    if (!directionSet) {
      return NextResponse.json({ error: 'Story direction set not found' }, { status: 404 });
    }

    const selectedDirection = directionSet.directions.find((direction) => direction.id === directionId);
    if (!selectedDirection) {
      return NextResponse.json({ error: 'Direction does not belong to this order' }, { status: 400 });
    }

    if (!['ready', 'selected'].includes(directionSet.status)) {
      return NextResponse.json({ error: 'Story directions are not ready for selection' }, { status: 409 });
    }

    await prisma.storyDirectionSet.update({
      where: { id: directionSet.id },
      data: {
        selectedDirectionId: selectedDirection.id,
        status: 'selected',
      },
    });

    const selectedAtMs = Date.now();
    const createdAtMs = directionSet.createdAt.getTime();
    const timeToSelectSeconds = Math.max(0, Math.round((selectedAtMs - createdAtMs) / 1000));
    const ageBand =
      directionSet.order.childAge && directionSet.order.childAge > 7
        ? '7-9'
        : directionSet.order.childAge && directionSet.order.childAge > 5
        ? '5-7'
        : '3-5';

    logServerEvent('story_direction_selected', {
      orderId,
      selected_archetype: selectedDirection.archetype,
      child_age_band: ageBand,
      style: directionSet.order.illustrationStyle,
      time_to_select: timeToSelectSeconds,
    });

    return NextResponse.json({
      selectedDirectionId: selectedDirection.id,
      selectedArchetype: selectedDirection.archetype,
      started: false,
    });
  } catch (error) {
    logger.error('Story direction selection failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
