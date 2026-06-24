import { prisma } from '@/lib/prisma';
import { runGenerationWorkerInvocation } from './process-worker';
import { getMaxStaleReclaims } from './constants';

/** Progress fingerprint — changes when the job advances (stage or completed-page count). */
function progressFingerprint(currentStage: string, completedPageNumbers: unknown): string {
  const count = Array.isArray(completedPageNumbers) ? completedPageNumbers.length : 0;
  return `${currentStage}:${count}`;
}

/**
 * Source-of-truth continuation: reclaim ANY expired-lease job in pending/running (regardless of
 * `retryable`) and invoke the worker in-process (same path as cron). Does NOT depend on the HTTP
 * self-fetch completing — this is the durable recovery for stuck jobs (e.g. a chain 401 that left
 * the job running with an expired lease).
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
      await prisma.generationJob.update({
        where: { orderId: job.orderId },
        data: {
          status: 'failed',
          currentStage: 'failed',
          retryable: false,
          failedAt: now,
          lastError: `Stalled at stage ${job.currentStage} after ${nextCount - 1} no-progress reclaims`,
          staleReclaimCount: nextCount,
          lastReclaimStage: fingerprint,
        },
      });
      await prisma.order
        .update({
          where: { id: job.orderId },
          data: { status: 'failed', lastError: `Generation stalled at ${job.currentStage}` },
        })
        .catch(() => {});
      continue;
    }

    // Record the reclaim attempt before invoking so a crash mid-invocation still counts.
    await prisma.generationJob.update({
      where: { orderId: job.orderId },
      data: { staleReclaimCount: nextCount, lastReclaimStage: fingerprint },
    });

    const result = await runGenerationWorkerInvocation(job.orderId);
    if (result.ok) processed += 1;
  }

  return processed;
}
