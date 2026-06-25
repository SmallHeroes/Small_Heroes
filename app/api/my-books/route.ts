import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { MVP_STORY_MATRIX, normalizeMvpCategory } from '@/backend/config/mvp-story-matrix';
import { getCompanionById } from '@/lib/companions';
import { getWizardMeta } from '@/lib/orderMeta';
import { prisma } from '@/lib/prisma';
import { resolveUserFromRequest } from '@/lib/auth-session';
import { ROUTES } from '@/lib/routes';

/** Category-card art paths (see app/category-challenge-card.tsx). */
const CATEGORY_CARD_IMAGE: Record<string, string> = {
  NIGHT_FEAR: '/Images/Categories/StartUri.webp',
  SOCIAL: '/Images/Categories/StartAnat.webp',
  MEDICAL_PROCEDURE: '/Images/Categories/StartBuny.webp',
  NEW_SIBLING: '/Images/Categories/StartDuni.webp',
  TRANSITION: '/Images/Categories/StartKim.webp',
  ANGER_FRUSTRATION: '/Images/Categories/StartLeo.webp',
};

function resolveCompanionForOrder(characterAnchors: unknown) {
  const { challengeCategory } = getWizardMeta(characterAnchors as Prisma.JsonValue | null | undefined);
  const category = normalizeMvpCategory(challengeCategory);
  if (!category) {
    return { companionName: null as string | null, companionImage: null as string | null };
  }

  const companionId = MVP_STORY_MATRIX[category].companionId;
  const companion = getCompanionById(companionId);
  if (!companion) {
    return { companionName: null, companionImage: null };
  }

  return {
    companionName: companion.name,
    companionImage:
      CATEGORY_CARD_IMAGE[category] ?? companion.cardImage ?? companion.image ?? null,
  };
}

export async function GET(req: NextRequest) {
  const resolved = await resolveUserFromRequest(req);
  if (!resolved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: {
      userId: resolved.user.id,
      status: { in: ['ready', 'partial', 'generating', 'paid'] },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      childName: true,
      createdAt: true,
      paymentId: true,
      paymeTransactionId: true,
      stripeSessionId: true,
      characterAnchors: true,
      book: {
        select: {
          title: true,
          coverImageUrl: true,
        },
      },
    },
  });

  return NextResponse.json({
    user: resolved.user,
    books: orders.map((order) => {
      const accessKey = order.paymentId || order.paymeTransactionId || order.stripeSessionId || null;
      const readyUrl = `${ROUTES.ready}?orderId=${encodeURIComponent(order.id)}${accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : ''}`;
      const { companionName, companionImage } = resolveCompanionForOrder(order.characterAnchors);

      return {
        orderId: order.id,
        status: order.status,
        childName: order.childName,
        title: order.book?.title || null,
        coverImageUrl: order.book?.coverImageUrl || null,
        readyUrl,
        accessKey,
        createdAt: order.createdAt,
        companionName,
        companionImage,
      };
    }),
  });
}
