import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { chainGenerationWorker } from './chain-worker';
import { GENERATION_VERSION } from './constants';
import { assertEnvSeparation, assertProdGenerationAllowed } from './env-separation-guard';
import { getWizardMeta } from '@/lib/orderMeta';
import {
  assessStoryRenderReadiness,
  deriveStoryKey,
  isVisualContractGateEnabled,
} from '@/lib/visual-contract/render-readiness';
import type { PipelineCache } from '@/lib/generation-pipeline/types';

const log = createLogger({ subsystem: 'chunked-gen', route: 'start' });

const RETRYABLE = ['paid', 'failed'] as const;

export async function startChunkedGeneration(
  orderId: string,
  reason = 'unspecified',
  options?: { pipelineCache?: PipelineCache; skipWorkerChain?: boolean }
): Promise<{ started: boolean; orderId: string; message?: string }> {
  // Hard-disable on prod (P0 cutover guard) BEFORE any DB/job work or spend.
  assertProdGenerationAllowed();
  // Guard before any DB writes so staging/local cannot mark prod orders or create prod jobs.
  assertEnvSeparation();

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

  // Increment 3 — visual-contract render PRECONDITION (amendment #5, fail-closed, flag-gated).
  // A story may not enter full render unless its contract is render-ready + calibration-trusted.
  if (isVisualContractGateEnabled()) {
    const wizardMeta = getWizardMeta(order.characterAnchors);
    const storyKey = deriveStoryKey(wizardMeta.companionCharacterId, order.storyDirection);
    const readiness = assessStoryRenderReadiness(storyKey);
    if (!readiness.allowed) {
      log.warn('Blocked by visual-contract gate (not render-ready)', { orderId, storyKey, reason: readiness.reason });
      return { started: false, orderId, message: `visual contract not render-ready: ${readiness.reason}` };
    }
    log.info('Visual-contract gate passed', { orderId, storyKey });
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
