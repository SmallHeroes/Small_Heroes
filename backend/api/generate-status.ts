/**
 * Generation Status API
 * GET /api/generate/status?orderId=<id>
 *
 * Lightweight polling endpoint for generating.html.
 * Returns only what the UI needs — no book content, no payment data.
 *
 * File: app/api/generate/status/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Stage derivation ─────────────────────────────────
// Returns the name of the stage currently active or most recently failed.
// Priority: text → images → audio → package
type StageStatus = 'pending' | 'running' | 'done' | 'failed';
type StageName  = 'text' | 'images' | 'audio' | 'package' | 'done';

function deriveCurrentStage(
  textStatus:    StageStatus,
  imageStatus:   StageStatus,
  audioStatus:   StageStatus,
  packageStatus: StageStatus,
  audioEnabled:  boolean,
): StageName {
  // Walk stages in order; return the first one that is running or pending.
  // If text is running/pending → 'text'
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

// ─── Progress computation ─────────────────────────────
// Mirrors computeProgress() in orders.ts — kept local to avoid coupling.
function computeProgress(
  textStatus:    StageStatus,
  imageStatus:   StageStatus,
  audioStatus:   StageStatus,
  packageStatus: StageStatus,
  audioEnabled:  boolean,
): number {
  let done  = 0;
  const total = audioEnabled ? 4 : 3;

  if (textStatus    === 'done') done++;
  if (imageStatus   === 'done') done++;
  if (!audioEnabled || audioStatus === 'done') done++;
  if (packageStatus === 'done') done++;

  return Math.round((done / total) * 100);
}

// ─── Route handler ────────────────────────────────────
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
        textStatus:    true,
        imageStatus:   true,
        audioStatus:   true,
        packageStatus: true,
        lastError:     true,
        // book readUrl — only populated when status === 'ready'
        book: {
          select: { readUrl: true },
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

    const currentStage  = deriveCurrentStage(ts, is, as, ps, audio);
    const failedStage   = deriveFailedStage(ts, is, as, ps, audio);
    const progress      = computeProgress(ts, is, as, ps, audio);

    // Build response — omit null/irrelevant fields
    const body: Record<string, unknown> = {
      status:       order.status,
      progress,
      currentStage,
    };

    if (failedStage !== null) {
      body.failedStage = failedStage;
    }

    if (order.lastError) {
      body.error = order.lastError;
    }

    // Surface readUrl once book is ready so generating.js can redirect
    if (order.status === 'ready' && order.book?.readUrl) {
      body.readUrl = order.book.readUrl;
    }

    return NextResponse.json(body);

  } catch (error) {
    console.error('[GET /api/generate/status]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
