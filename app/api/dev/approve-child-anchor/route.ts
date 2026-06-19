import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { PipelineCache } from '@/lib/generation-pipeline/types';
import { getChildCanonicalAnchor } from '@/lib/generation-pipeline/character-anchor-store';
import {
  attachPendingChildAnchorFromCandidate,
  pickStage0Candidate,
} from '@/lib/generation-pipeline/stage0-candidate-recovery';
import { isDevEnvironment } from '@/lib/dev-only-guard';

/**
 * Dev-only: mark the Stage 0 child anchor as human-approved so paid pages may proceed.
 * POST { "orderId": "...", "attempt": 2 }  // attempt optional — defaults to best score
 */
export async function POST(req: Request) {
  if (!isDevEnvironment()) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { orderId?: string; attempt?: number };
  const orderId = body.orderId?.trim();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  }

  const job = await prisma.generationJob.findUnique({ where: { orderId } });
  if (!job) {
    return NextResponse.json({ error: 'Generation job not found' }, { status: 404 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  let cache = (job.pipelineCache ?? {}) as PipelineCache;
  let child = getChildCanonicalAnchor(cache);

  if (!child?.url) {
    const row = pickStage0Candidate(cache, body.attempt);
    if (!row?.url) {
      return NextResponse.json(
        {
          error:
            'No child anchor in pipeline cache and no stage0AnchorCandidates to recover. Re-run Stage 0.',
        },
        { status: 400 }
      );
    }
    cache = attachPendingChildAnchorFromCandidate(order, cache, row);
    child = getChildCanonicalAnchor(cache);
  }

  if (!child?.url) {
    return NextResponse.json({ error: 'Failed to attach child anchor' }, { status: 500 });
  }

  const nextCache: PipelineCache = {
    ...cache,
    childAnchorApproved: true,
    stage0SelectedAttempt: body.attempt ?? cache.stage0SelectedAttempt,
    characterAnchorStore: {
      ...(cache.characterAnchorStore ?? {}),
      child: {
        ...child,
        qaStatus: 'passed',
        updatedAt: new Date().toISOString(),
      },
    },
  };

  const existingAnchors =
    order.characterAnchors && typeof order.characterAnchors === 'object'
      ? (order.characterAnchors as Record<string, unknown>)
      : {};

  await prisma.$transaction([
    prisma.generationJob.update({
      where: { orderId },
      data: {
        pipelineCache: nextCache as object,
        status: 'pending',
        currentStage: 'dna',
        lastError: null,
        retryable: true,
        failedAt: null,
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'generating',
        lastError: null,
        errorAt: null,
        characterAnchors: {
          ...existingAnchors,
          child: {
            ...(existingAnchors.child as Record<string, unknown> | undefined),
            anchorImageUrl: child.url,
            anchorApproved: true,
            qaStatus: 'passed',
            resemblanceScore: child.resemblanceScore,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    orderId,
    attempt: body.attempt ?? cache.stage0SelectedAttempt ?? null,
    anchorUrl: child.url,
    resemblanceScore: child.resemblanceScore,
    message:
      'Child anchor approved. Resume generation (worker will promote anchor and continue past DNA).',
  });
}
