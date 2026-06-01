import { prisma } from '@/lib/prisma';
import { chainGenerationWorker } from './chain-worker';

/**
 * Resume jobs whose lease expired or never acquired a worker (source of truth — not self-fetch).
 */
export async function sweepStaleGenerationJobs(limit = 5): Promise<number> {
  const now = new Date();
  const stale = await prisma.generationJob.findMany({
    where: {
      status: { in: ['pending', 'running'] },
      currentStage: { notIn: ['done', 'failed'] },
      OR: [{ lockedBy: null }, { leaseExpiresAt: { lt: now } }],
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: { orderId: true },
  });

  for (const job of stale) {
    await chainGenerationWorker(job.orderId);
  }

  return stale.length;
}
