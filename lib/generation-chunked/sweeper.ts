import { prisma } from '@/lib/prisma';
import { chainGenerationWorker } from './chain-worker';
import { getMaxStaleReclaims } from './constants';
import { isReadinessManifestEnabled } from '@/lib/generation-pipeline/readiness-manifest';
import { openExceptionCase } from './exception-case';

/** Progress fingerprint — changes when the job advances (stage or completed-page count). */
function progressFingerprint(currentStage: string, completedPageNumbers: unknown): string {
  const count = Array.isArray(completedPageNumbers) ? completedPageNumbers.length : 0;
  return `${currentStage}:${count}`;
}

/**
 * Source-of-truth continuation: reclaim ANY expired-lease job in pending/running (regardless of
 * `retryable`) and **dispatch** it to the worker route — the sweeper is a DISPATCHER, never a
 * renderer. It must NOT run the chunk in-process: the sweep runs inside the 60s cron route
 * (`/api/generate/cron/sweep`, maxDuration=60), and a `page_images` chunk (gpt-image + refs +
 * upload + postprocess) cannot finish in 60s — it would be killed mid-render with no asset and no
 * error, leaving the lease to expire and the reclaim counter to climb (the silent stall loop).
 * Instead it kicks `/api/generate/worker` (maxDuration=300) via the existing self-chain helper, so
 * a reclaim is telemetry-indistinguishable from a normal chain hop and compute happens only on the
 * 300s worker route.
 *
 * Anti-infinite-spend: each reclaim that does NOT change the progress fingerprint increments
 * staleReclaimCount; a job that advances resets it. After getMaxStaleReclaims() no-progress
 * reclaims the job is hard-failed (retryable=false) instead of being re-spawned forever.
 */
export async function sweepStaleGenerationJobs(
  limit = 5,
  options?: { orderId?: string }
): Promise<number> {
  const now = new Date();
  const stale = await prisma.generationJob.findMany({
    where: {
      ...(options?.orderId ? { orderId: options.orderId } : {}),
      status: { in: ['pending', 'running'] },
      currentStage: { notIn: ['done', 'failed'] },
      OR: [{ lockedBy: null }, { leaseExpiresAt: { lt: now } }],
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: {
      orderId: true,
      currentStage: true,
      staleReclaimCount: true,
      lastReclaimStage: true,
      completedPageNumbers: true,
    },
  });

  const maxReclaims = getMaxStaleReclaims();
  let processed = 0;
  for (const job of stale) {
    const fingerprint = progressFingerprint(job.currentStage, job.completedPageNumbers);
    const madeProgress = fingerprint !== job.lastReclaimStage;
    const nextCount = madeProgress ? 1 : (job.staleReclaimCount ?? 0) + 1;

    if (nextCount > maxReclaims) {
      // Stuck at the same stage with no progress across many reclaims → stop re-spending.
      const reason = `Stalled at stage ${job.currentStage} after ${nextCount - 1} no-progress reclaims`;
      await prisma.$transaction(async (tx) => {
        await tx.generationJob.update({
          where: { orderId: job.orderId },
          data: {
            status: 'failed',
            currentStage: 'failed',
            retryable: false,
            failedAt: now,
            lastError: reason,
            staleReclaimCount: nextCount,
            lastReclaimStage: fingerprint,
          },
        });
        await tx.order.update({
          where: { id: job.orderId },
          data: { status: 'failed', lastError: `Generation stalled at ${job.currentStage}` },
        });
        if (isReadinessManifestEnabled()) {
          await openExceptionCase(tx, {
            orderId: job.orderId,
            kind: 'integrity_blocked',
            reason,
            sourceRef: `generation:${job.orderId}:${now.toISOString()}`,
            now,
            initialStatus: 'refund_pending',
            nextActionAt: now,
            fenceExisting: true,
          });
        }
      });
      continue;
    }

    // Record the reclaim attempt AND stamp the kick telemetry durably (awaited) so a reclaim that
    // dispatches a worker is indistinguishable from a normal chain hop — even if the fire-and-forget
    // diagnostic inside chainGenerationWorker does not flush before this cron route returns.
    await prisma.generationJob.update({
      where: { orderId: job.orderId },
      data: {
        staleReclaimCount: nextCount,
        lastReclaimStage: fingerprint,
        lastWorkerKickAt: now,
        lastChainStatus: null,
        lastChainError: null,
      },
    });

    // Dispatcher boundary: kick the 300s worker route; NEVER render in-process inside the 60s cron.
    chainGenerationWorker(job.orderId);
    processed += 1;
  }

  return processed;
}
