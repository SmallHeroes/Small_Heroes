import { prisma } from '@/lib/prisma';
import { runGenerationWorkerInvocation } from './process-worker';

/**
 * Source-of-truth continuation: invoke the worker in-process (same path as cron).
 * Does NOT depend on HTTP self-fetch completing.
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
    select: { orderId: true },
  });

  let processed = 0;
  for (const job of stale) {
    const result = await runGenerationWorkerInvocation(job.orderId);
    if (result.ok) processed += 1;
  }

  return processed;
}
