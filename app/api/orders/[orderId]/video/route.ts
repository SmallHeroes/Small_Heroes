/**
 * POST /api/orders/:orderId/video — on-demand MP4 export (slideshow + narration + overlays).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateBookVideo, storeVideo, type VideoPageInput } from '@/backend/providers/video';
import { createLogger } from '@/lib/logger';
import { evaluateReviewApproval } from '@/lib/manual-review-gate';

export const runtime = 'nodejs';

const logger = createLogger({ subsystem: 'orders', route: '/api/orders/[orderId]/video' });

/** Vercel / Next cap — raise on Pro plans as needed */
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    let accessKey: string | undefined;
    let forceRegenerate = false;
    try {
      const body = (await req.json()) as { accessKey?: string; force?: boolean };
      accessKey = typeof body?.accessKey === 'string' ? body.accessKey : undefined;
      forceRegenerate = body?.force === true;
    } catch {
      accessKey = undefined;
    }
    if (!accessKey) {
      accessKey = req.nextUrl.searchParams.get('accessKey') ?? undefined;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentId: true,
        paymeTransactionId: true,
        stripeSessionId: true,
        status: true,
        manualReviewRequired: true, // #43
        book: {
          select: {
            id: true,
            title: true,
            coverImageUrl: true,
            videoUrl: true,
            coverReviewStatus: true, // #43
            coverImageVersion: true,
            approvedCoverImageVersion: true,
            pages: {
              orderBy: { pageNumber: 'asc' },
              select: {
                pageNumber: true,
                text: true,
                audioUrl: true,
                reviewStatus: true, // #43
                imageVersion: true,
                approvedImageVersion: true,
                imageAsset: {
                  select: {
                    url: true,
                    presentationUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order?.book || !accessKey) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const expectedAccessKey = order.paymentId || order.paymeTransactionId || order.stripeSessionId;
    if (!expectedAccessKey || accessKey !== expectedAccessKey) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // #43: block video (even a cached one) while manual review is incomplete. No-op when manualReviewRequired
    // is false (every non-launch order).
    const reviewGate = evaluateReviewApproval({
      manualReviewRequired: order.manualReviewRequired,
      cover: {
        hasCover: !!order.book.coverImageUrl,
        coverReviewStatus: order.book.coverReviewStatus,
        coverImageVersion: order.book.coverImageVersion,
        approvedCoverImageVersion: order.book.approvedCoverImageVersion,
      },
      pages: order.book.pages.map((p) => ({
        pageNumber: p.pageNumber,
        reviewStatus: p.reviewStatus,
        imageVersion: p.imageVersion,
        approvedImageVersion: p.approvedImageVersion,
      })),
    });
    if (!reviewGate.fullyApproved) {
      return NextResponse.json({ error: 'Book pending manual review', blockers: reviewGate.blockers }, { status: 409 });
    }

    if (order.book.videoUrl?.trim() && !forceRegenerate) {
      return NextResponse.json({ videoUrl: order.book.videoUrl.trim(), cached: true });
    }

    if (order.status !== 'ready' && order.status !== 'partial') {
      return NextResponse.json({ error: 'Book not ready' }, { status: 409 });
    }

    const book = order.book;
    const videoPages: VideoPageInput[] = [];

    const coverSrc = book.coverImageUrl ?? null;
    if (coverSrc) {
      videoPages.push({
        pageNumber: 0,
        text: '',
        imageUrl: coverSrc,
        audioUrl: null,
        isCover: true,
      });
    }

    for (const p of book.pages) {
      const imageUrl =
        typeof p.imageAsset?.presentationUrl === 'string'
          ? p.imageAsset.presentationUrl
          : p.imageAsset?.url ?? null;
      if (!imageUrl || !imageUrl.trim()) continue;
      videoPages.push({
        pageNumber: p.pageNumber,
        text: p.text,
        imageUrl: imageUrl.trim(),
        audioUrl: p.audioUrl?.trim() ?? null,
        isCover: false,
      });
    }

    if (videoPages.length === 0) {
      return NextResponse.json({ error: 'No page images available for video' }, { status: 400 });
    }

    logger.info('Video export starting', { orderId, slideCount: videoPages.length });

    const buffer = await generateBookVideo({
      orderId: order.id,
      title: book.title,
      pages: videoPages,
    });

    const videoUrl = await storeVideo(buffer, `${orderId}-book.mp4`);

    await prisma.generatedBook.update({
      where: { id: book.id },
      data: { videoUrl },
    });

    logger.info('Video export complete', { orderId, bytes: buffer.length });

    return NextResponse.json({ videoUrl, cached: false });
  } catch (error) {
    logger.error('Video export failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video generation failed' },
      { status: 500 }
    );
  }
}
