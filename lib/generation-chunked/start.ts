import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { chainGenerationWorker } from './chain-worker';
import { GENERATION_VERSION } from './constants';
import type { PipelineCache } from '@/lib/generation-pipeline/types';

const log = createLogger({ subsystem: 'chunked-gen', route: 'start' });

const RETRYABLE = ['paid', 'failed'] as const;

export async function startChunkedGeneration(
  orderId: string,
  reason = 'unspecified',
  options?: { pipelineCache?: PipelineCache; skipWorkerChain?: boolean }
): Promise<{ started: boolean; orderId: string; message?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      storyDirectionSet: { include: { selectedDirection: true } },
      generationJob: true,
    },
  });

  if (!order) {
    return { started: false, orderId, message: 'Order not found' };
  }

  if (order.status === 'ready' || order.status === 'partial') {
    return { started: false, orderId, message: 'Already completed' };
  }

  if (!RETRYABLE.includes(order.status as (typeof RETRYABLE)[number]) && order.status !== 'generating') {
    return { started: false, orderId, message: `Order status ${order.status} not eligible` };
  }

  const directionSet = order.storyDirectionSet;
  if (directionSet && !directionSet.selectedDirection) {
    return { started: false, orderId, message: 'Awaiting story direction selection' };
  }

  try {
    await prisma.generationJob.create({
      data: {
        orderId,
        status: 'pending',
        currentStage: 'pending',
        triggerReason: reason,
        generationVersion: GENERATION_VERSION,
        pipelineCache: (options?.pipelineCache ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') {
      throw e;
    }
  }

  await prisma.generationJob.update({
    where: { orderId },
    data: {
      status: 'pending',
      currentStage: 'pending',
      triggerReason: reason,
      lastError: null,
      failedAt: null,
      retryable: false,
      ...(options?.pipelineCache
        ? { pipelineCache: options.pipelineCache as Prisma.InputJsonValue }
        : {}),
    },
  });

  if (order.status !== 'generating') {
    const claimed = await prisma.order.updateMany({
      where: { id: orderId, status: { in: [...RETRYABLE] } },
      data: { status: 'generating' },
    });
    if (claimed.count === 0) {
      return { started: false, orderId, message: 'Could not claim order' };
    }
  }

  log.info('Chunked generation started', { orderId, reason });

  if (!options?.skipWorkerChain) {
    void chainGenerationWorker(orderId);
  }

  return { started: true, orderId };
}
