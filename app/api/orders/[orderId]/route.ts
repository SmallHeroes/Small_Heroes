/**
 * GET /api/orders/[orderId] — Order status
 * File: app/api/orders/[orderId]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { assignTemplatesForBook, textPlacementForTemplate, type BookPageTemplate } from '../../../../lib/bookPageLayout';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ subsystem: 'orders', route: '/api/orders/[orderId]' });
const DEV_FIXTURE_ORDER_ID = 'dev-completed-book';
const DEV_FIXTURE_ACCESS_KEY = 'dev-completed-access';

function normalizePageTemplate(value: string | null | undefined): BookPageTemplate | null {
  if (value === 'full_bleed_overlay' || value === 'art_top_text_bottom' || value === 'character_vignette_text') {
    return value;
  }
  return null;
}

function buildDevCompletedBookFixture(orderId: string) {
  const coverUrl = '/assets/paper/paper-1.png';
  const page1Url = '/assets/paper/paper-2.png';
  const page2Url = '/assets/paper/paper-3.png';
  const page3Url = '/assets/paper/grain.png';
  return {
    id: orderId,
    status: 'ready',
    childName: 'ילד בדיקה',
    storyLength: 'short',
    audioEnabled: false,
    pdfEnabled: false,
    textStatus: 'done',
    imageStatus: 'done',
    audioStatus: 'done',
    packageStatus: 'done',
    book: {
      title: 'ספר בדיקה מקומי',
      coverText: 'מסלול בדיקה בטוח ללא יצירה חדשה',
      coverImageUrl: coverUrl,
      videoUrl: null,
      pages: [
        {
          pageNumber: 0,
          text: '',
          imageUrl: coverUrl,
          presentationImageUrl: coverUrl,
          pageTemplate: 'full_bleed_overlay',
          textPlacement: textPlacementForTemplate('full_bleed_overlay'),
          isCover: true,
          title: 'ספר בדיקה מקומי',
        },
        {
          pageNumber: 1,
          text: 'עמוד בדיקה ראשון - טקסט קצר להצגת הניווט.',
          imageUrl: page1Url,
          presentationImageUrl: page1Url,
          pageTemplate: 'art_top_text_bottom',
          textPlacement: textPlacementForTemplate('art_top_text_bottom'),
        },
        {
          pageNumber: 2,
          text: 'עמוד בדיקה שני - מוודא שהמעבר קדימה ממשיך לעבוד.',
          imageUrl: page2Url,
          presentationImageUrl: page2Url,
          pageTemplate: 'character_vignette_text',
          textPlacement: textPlacementForTemplate('character_vignette_text'),
        },
        {
          pageNumber: 3,
          text: 'עמוד בדיקה שלישי - מוודא עמוד אחרון וכפתור סיום.',
          imageUrl: page3Url,
          presentationImageUrl: page3Url,
          pageTemplate: 'art_top_text_bottom',
          textPlacement: textPlacementForTemplate('art_top_text_bottom'),
        },
      ],
      audioUrl: null,
      pdfUrl: null,
      readUrl: `/book/${encodeURIComponent(orderId)}/read-v2?v=1&accessKey=${encodeURIComponent(DEV_FIXTURE_ACCESS_KEY)}`,
    },
    progress: 100,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const accessKey = req.nextUrl.searchParams.get('accessKey');

    if (
      process.env.NODE_ENV !== 'production' &&
      orderId === DEV_FIXTURE_ORDER_ID &&
      accessKey === DEV_FIXTURE_ACCESS_KEY
    ) {
      return NextResponse.json(buildDevCompletedBookFixture(orderId));
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        childName: true,
        storyLength: true,
        audioEnabled: true,
        pdfEnabled: true,
        textStatus: true,
        imageStatus: true,
        audioStatus: true,
        packageStatus: true,
        paymentId: true,
        paymeTransactionId: true,
        stripeSessionId: true,
        coverImageUrl: true,
        book: {
          select: {
            title: true,
            coverText: true,
            coverImageUrl: true,
            pdfUrl: true,
            videoUrl: true,
            readUrl: true,
            pages: {
              orderBy: { pageNumber: 'asc' },
              select: {
                pageNumber: true,
                text: true,
                narrationText: true,
                audioUrl: true,
                pageTemplate: true,
                textZone: true,
                lighting: true,
                textColorScheme: true,
                imageAsset: {
                  select: {
                    url: true,
                    presentationUrl: true,
                  },
                },
              },
            },
            audioAsset: {
              select: { url: true },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const expectedAccessKey = order.paymentId || order.paymeTransactionId || order.stripeSessionId;
    if (!expectedAccessKey || !accessKey || accessKey !== expectedAccessKey) {
      // Intentionally return not-found to avoid leaking valid order IDs.
      logger.warn('Order access denied', { orderId, reason: 'invalid_access_key' });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: order.id,
      status: order.status,
      childName: order.childName,
      storyLength: order.storyLength,
      audioEnabled: order.audioEnabled,
      pdfEnabled: order.pdfEnabled,

      // Generation stages
      textStatus: order.textStatus,
      imageStatus: order.imageStatus,
      audioStatus: order.audioStatus,
      packageStatus: order.packageStatus,

      // Book data if ready
      book: ['ready', 'partial'].includes(order.status) ? (() => {
        const pageRows = order.book?.pages ?? [];
        const templateInputs = pageRows.map((p) => ({
          pageNumber: p.pageNumber,
          text: p.text,
          imageSubject: undefined,
          imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null,
        }));
        const fallbackTemplates = assignTemplatesForBook(templateInputs);
        const contentPages = pageRows.map((p, i) => {
          const resolvedTemplate = normalizePageTemplate(p.pageTemplate) ?? fallbackTemplates[i];
          return {
            pageNumber: p.pageNumber,
            text: p.text,
            narrationText: p.narrationText ?? null,
            audioUrl: p.audioUrl ?? null,
            imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null,
            pageTemplate: resolvedTemplate,
            textPlacement: textPlacementForTemplate(resolvedTemplate),
            textZone: p.textZone ?? null,
            lighting: p.lighting ?? null,
            textColorScheme: p.textColorScheme ?? null,
          };
        });
        const withCover = order.book?.coverImageUrl
          ? [
              {
                pageNumber: 0,
                text: '',
                narrationText: null,
                audioUrl: null,
                imageUrl: order.book.coverImageUrl,
                pageTemplate: 'full_bleed_overlay',
                textPlacement: textPlacementForTemplate('full_bleed_overlay'),
                isCover: true,
                title: order.book?.title ?? '',
              },
              ...contentPages,
            ]
          : contentPages;
        return {
        title: order.book?.title,
        coverText: order.book?.coverText ?? null,
        coverImageUrl: order.book?.coverImageUrl ?? order.coverImageUrl ?? null,
        pages: withCover,
        audioUrl: order.book?.audioAsset?.url,
        pdfUrl: order.book?.pdfUrl,
        videoUrl: order.book?.videoUrl ?? null,
        readUrl: order.book?.readUrl,
        };
      })() : null,

      // Progress %
      progress: computeProgress(order),
    });

  } catch (error) {
    logger.error('Order fetch failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function computeProgress(order: {
  audioEnabled: boolean;
  textStatus: string;
  imageStatus: string;
  audioStatus: string;
  packageStatus: string;
}): number {
  let done = 0;
  const total = order.audioEnabled ? 4 : 3;

  if (order.textStatus === 'done') done++;
  if (order.imageStatus === 'done') done++;
  if (!order.audioEnabled || order.audioStatus === 'done') done++;
  if (order.packageStatus === 'done') done++;

  return Math.round((done / total) * 100);
}
