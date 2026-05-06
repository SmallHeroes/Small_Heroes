/**
 * GET /api/generate/status?orderId=<id>
 * Lightweight polling endpoint for generating.html
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { STORY_LENGTHS } from '../../../../backend/config/wizard';

const prisma = new PrismaClient();

type StageStatus = 'pending' | 'running' | 'done' | 'failed';
type StageName  = 'text' | 'images' | 'audio' | 'package' | 'done';

function deriveCurrentStage(
  textStatus:    StageStatus,
  imageStatus:   StageStatus,
  audioStatus:   StageStatus,
  packageStatus: StageStatus,
  audioEnabled:  boolean,
): StageName {
  if (textStatus === 'running' || textStatus === 'pending') return 'text';
  if (textStatus === 'failed')                               return 'text';

  if (imageStatus === 'running' || imageStatus === 'pending') return 'images';
  if (imageStatus === 'failed')                               return 'images';

  if (audioEnabled) {
    if (audioStatus === 'running' || audioStatus === 'pending') return 'audio';
    if (audioStatus === 'failed')                               return 'audio';
  }

  if (packageStatus === 'running' || packageStatus === 'pending') return 'package';
  if (packageStatus === 'failed')                                  return 'package';

  return 'done';
}

function deriveFailedStage(
  textStatus:    StageStatus,
  imageStatus:   StageStatus,
  audioStatus:   StageStatus,
  packageStatus: StageStatus,
  audioEnabled:  boolean,
): StageName | null {
  if (textStatus    === 'failed') return 'text';
  if (imageStatus   === 'failed') return 'images';
  if (audioEnabled && audioStatus === 'failed') return 'audio';
  if (packageStatus === 'failed') return 'package';
  return null;
}

function computeProgress(
  textStatus:    StageStatus,
  imageStatus:   StageStatus,
  audioStatus:   StageStatus,
  packageStatus: StageStatus,
  audioEnabled:  boolean,
  imageCompletionRatio: number,
): number {
  const weights = audioEnabled
    ? { text: 24, images: 44, audio: 18, package: 14 }
    : { text: 28, images: 52, audio: 0, package: 20 };
  let pct = 0;

  if (textStatus === 'done') pct += weights.text;
  else if (textStatus === 'running') pct += weights.text * 0.25;

  if (imageStatus === 'done') {
    pct += weights.images;
  } else if (imageStatus === 'running') {
    pct += weights.images * Math.max(0, Math.min(1, imageCompletionRatio));
  }

  if (audioEnabled) {
    if (audioStatus === 'done') pct += weights.audio;
    else if (audioStatus === 'running') pct += weights.audio * 0.35;
  }

  if (packageStatus === 'done') pct += weights.package;
  else if (packageStatus === 'running') pct += weights.package * 0.45;

  return Math.round(Math.max(0, Math.min(100, pct)));
}

export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get('orderId');
    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id:            true,
        status:        true,
        audioEnabled:  true,
        storyLength:   true,
        coverImageUrl: true,
        textStatus:    true,
        imageStatus:   true,
        audioStatus:   true,
        packageStatus: true,
        lastError:     true,
        book: {
          select: {
            readUrl: true,
            coverImageUrl: true,
            pages: {
              select: {
                imageAsset: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const ts = order.textStatus    as StageStatus;
    const is = order.imageStatus   as StageStatus;
    const as = order.audioStatus   as StageStatus;
    const ps = order.packageStatus as StageStatus;
    const audio = order.audioEnabled;
    const expectedPageCount = STORY_LENGTHS.find((length) => length.id === order.storyLength)?.pages ?? 12;
    const expectedImageUnits = expectedPageCount + 1; // +1 for cover generation
    const completedPageImages = order.book?.pages?.filter((page) => Boolean(page.imageAsset?.id)).length ?? 0;
    const hasCover = Boolean(order.book?.coverImageUrl || order.coverImageUrl);
    const completedImageUnits = completedPageImages + (hasCover ? 1 : 0);
    const imageCompletionRatio = expectedImageUnits > 0 ? completedImageUnits / expectedImageUnits : 0;

    const currentStage  = deriveCurrentStage(ts, is, as, ps, audio);
    const failedStage   = deriveFailedStage(ts, is, as, ps, audio);
    const progress      = computeProgress(ts, is, as, ps, audio, imageCompletionRatio);

    const body: Record<string, unknown> = {
      status:       order.status,
      progress,
      currentStage,
    };

    if (failedStage !== null) body.failedStage = failedStage;
    if (order.lastError)      body.error = order.lastError;

    if (order.status === 'ready' && order.book?.readUrl) {
      body.readUrl = order.book.readUrl;
    }

    return NextResponse.json(body);

  } catch (error) {
    console.error('[GET /api/generate/status]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
