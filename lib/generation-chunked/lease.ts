import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { GENERATION_LEASE_MS } from './constants';

export async function acquireGenerationLease(orderId: string): Promise<string | null> {
  const workerId = randomUUID();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + GENERATION_LEASE_MS);

  const claimed = await prisma.generationJob.updateMany({
    where: {
      orderId,
      status: { in: ['pending', 'running'] },
      currentStage: { notIn: ['done', 'failed'] },
      OR: [{ lockedBy: null }, { leaseExpiresAt: { lt: now } }],
    },
    data: {
      lockedBy: workerId,
      leaseExpiresAt,
      status: 'running',
      startedAt: now,
    },
  });

  if (claimed.count === 0) return null;
  return workerId;
}

export async function releaseGenerationLease(orderId: string, workerId: string): Promise<void> {
  const now = new Date();
  await prisma.generationJob.updateMany({
    where: { orderId, lockedBy: workerId },
    data: {
      lockedBy: null,
      // Expire immediately so the next worker/sweeper can claim without waiting TTL.
      leaseExpiresAt: now,
    },
  });
}

export async function heartbeatLease(orderId: string, workerId: string): Promise<void> {
  const leaseExpiresAt = new Date(Date.now() + GENERATION_LEASE_MS);
  await prisma.generationJob.updateMany({
    where: { orderId, lockedBy: workerId },
    data: { leaseExpiresAt },
  });
}
