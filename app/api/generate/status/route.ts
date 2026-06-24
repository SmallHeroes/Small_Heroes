/**
 * GET /api/generate/status?orderId=<id>
 * Lightweight polling endpoint for generating.html
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { DIRECTION_PAGE_MAP, STORY_LENGTHS } from '../../../../backend/config/wizard';

type BeatDirection = keyof typeof DIRECTION_PAGE_MAP;

/** Beat count for progress UI — direction truth first, legacy length for old DB rows. */
function resolveExpectedBeatCount(order: {
  storyDirection: string | null;
  storyLength: string | null;
  book?: { pages: unknown[] } | null;
}): number {
  const dir = order.storyDirection?.trim().toLowerCase();
  if (dir && dir in DIRECTION_PAGE_MAP) {
    return DIRECTION_PAGE_MAP[dir as BeatDirection].pages;
  }
  const legacy = STORY_LENGTHS.find((length) => length.id === order.storyLength);
  if (legacy) return legacy.pages;
  if (order.book?.pages?.length) return order.book.pages.length;
  return DIRECTION_PAGE_MAP.adventure.pages;
}
import { sweepStaleGenerationJobs } from '@/lib/generation-chunked/sweeper';

/** Prisma `@default(cuid())` — reject garbage before DB to avoid Prisma/driver 500s. */
const ORDER_ID_RE = /^c[a-z0-9]{24}$/i;

function parseOrderIdParam(req: NextRequest): string | null {
  const raw = req.nextUrl.searchParams.get('orderId');
  const orderId = raw?.trim() ?? '';
  if (!orderId || !ORDER_ID_RE.test(orderId)) return null;
  return orderId;
}

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
  const orderId = parseOrderIdParam(req);
  if (!orderId) {
    return NextResponse.json({ error: 'invalid_order_id' }, { status: 400 });
  }

  try {
    void sweepStaleGenerationJobs(3);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id:            true,
        status:        true,
        childName:     true,
        audioEnabled:  true,
        storyLength:   true,
        storyDirection: true,
        coverImageUrl: true,
        textStatus:    true,
        imageStatus:   true,
        audioStatus:   true,
        packageStatus: true,
        lastError:     true,
        generationJob: {
          select: {
            currentStage: true,
            status: true,
            textDone: true,
            imagesDone: true,
            audioDone: true,
            packaged: true,
            retryable: true,
          },
        },
        book: {
          select: {
            readUrl: true,
            coverImageUrl: true,
            pages: {
              select: {
                pageNumber: true,
                audioUrl: true,
                imageAsset: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
    }

    const ts = order.textStatus    as StageStatus;
    const is = order.imageStatus   as StageStatus;
    const as = order.audioStatus   as StageStatus;
    const ps = order.packageStatus as StageStatus;
    const audio = order.audioEnabled;
    const expectedPageCount = resolveExpectedBeatCount(order);
    const expectedImageUnits = expectedPageCount + 1; // +1 for cover generation
    const completedPageImages = order.book?.pages?.filter((page) => Boolean(page.imageAsset?.id)).length ?? 0;
    const hasCover = Boolean(order.book?.coverImageUrl || order.coverImageUrl);
    const completedImageUnits = completedPageImages + (hasCover ? 1 : 0);
    const imageCompletionRatio = expectedImageUnits > 0 ? completedImageUnits / expectedImageUnits : 0;

    const currentStage  = deriveCurrentStage(ts, is, as, ps, audio);
    const failedStage   = deriveFailedStage(ts, is, as, ps, audio);
    const progress      = computeProgress(ts, is, as, ps, audio, imageCompletionRatio);

    const pagesWithAudio =
      order.book?.pages?.filter((p) => Boolean(p.audioUrl?.trim())).length ?? 0;
    const pagesNeedingAudio = order.audioEnabled
      ? order.book?.pages?.filter((p) => true).length ?? expectedPageCount
      : 0;

    const body: Record<string, unknown> = {
      status:       order.status,
      childName:    order.childName,
      progress,
      currentStage: order.generationJob?.currentStage ?? currentStage,
      jobStage: order.generationJob?.currentStage ?? null,
      pagesDone: completedPageImages,
      pagesTotal: expectedPageCount,
      coverDone: hasCover,
      imagesDone: order.generationJob?.imagesDone ?? is === 'done',
      audioDone: order.generationJob?.audioDone ?? as === 'done',
      packaged: order.generationJob?.packaged ?? ps === 'done',
      retryable: order.generationJob?.retryable ?? false,
      audioPagesDone: pagesWithAudio,
      audioPagesTotal: pagesNeedingAudio,
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
