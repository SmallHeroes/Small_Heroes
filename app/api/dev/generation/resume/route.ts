import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startChunkedGeneration } from '@/lib/generation-chunked/start';
import { runGenerationWorkerInvocation } from '@/lib/generation-chunked/process-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dev/admin: resume a stuck or failed-retryable generation job.
 * POST { orderId, runWorkerNow?: boolean }
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_GENERATION_RESUME !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  const runWorkerNow = body.runWorkerNow !== false;

  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  }

  const job = await prisma.generationJob.findUnique({ where: { orderId } });
  if (!job) {
    return NextResponse.json({ error: 'No generation job' }, { status: 404 });
  }

  await prisma.generationJob.update({
    where: { orderId },
    data: {
      status: 'pending',
      lockedBy: null,
      leaseExpiresAt: null,
      retryable: false,
      lastError: null,
      failedAt: null,
      ...(job.currentStage === 'failed' ? { currentStage: 'page_images' } : {}),
    },
  });

  await startChunkedGeneration(orderId, 'dev_resume', { skipWorkerChain: !runWorkerNow });

  let workerResult = null;
  if (runWorkerNow) {
    workerResult = await runGenerationWorkerInvocation(orderId);
  }

  return NextResponse.json({
    ok: true,
    orderId,
    workerResult,
    statusUrl: `/api/generate/status?orderId=${encodeURIComponent(orderId)}`,
  });
}
