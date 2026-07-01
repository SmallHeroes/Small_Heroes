import { Prisma, type OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { chainGenerationWorker } from './chain-worker';
import { GENERATION_VERSION } from './constants';
import { assertEnvSeparation, assertProdGenerationAllowed } from './env-separation-guard';
import type { PipelineCache } from '@/lib/generation-pipeline/types';

const log = createLogger({ subsystem: 'chunked-gen', route: 'start' });

const RETRYABLE = ['paid', 'failed'] as const;
/** Exception-processor regen-rescue redrives blocked orders (needs_human_qa + job done). */
export const RECOVERY_REDRIVE_REASON = 'exception_case_recovery';

async function computeRegenResumeJobPatch(orderId: string): Promise<{
  imagesDone: boolean;
  packaged: false;
  completedAt: null;
}> {
  const book = await prisma.generatedBook.findUnique({
    where: { orderId },
    select: {
      coverImageUrl: true,
      pages: { select: { imageAsset: { select: { id: true } } } },
    },
  });
  if (!book) {
    return { imagesDone: false, packaged: false, completedAt: null };
  }
  const hasCover = Boolean(book.coverImageUrl?.trim());
  const allPagesRendered =
    book.pages.length > 0 && book.pages.every((page) => page.imageAsset != null);
  return { imagesDone: hasCover && allPagesRendered, packaged: false, completedAt: null };
}

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

  const recoveryRedrive = reason === RECOVERY_REDRIVE_REASON;

  if (
    order.status === 'ready' ||
    order.status === 'partial' ||
    (order.status === 'needs_human_qa' && !recoveryRedrive)
  ) {
    // needs_human_qa: rendered + held — terminal unless exception-processor regen-rescue is redriving.
    return { started: false, orderId, message: 'Already completed' };
  }

  const claimableStatuses: OrderStatus[] = recoveryRedrive
    ? [...RETRYABLE, 'needs_human_qa']
    : [...RETRYABLE];

  if (!claimableStatuses.includes(order.status) && order.status !== 'generating') {
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

  const regenResumePatch = recoveryRedrive ? await computeRegenResumeJobPatch(orderId) : null;

  await prisma.generationJob.update({
    where: { orderId },
    data: {
      status: 'pending',
      currentStage: 'pending',
      triggerReason: reason,
      lastError: null,
      failedAt: null,
      retryable: false,
      lockedBy: null,
      leaseExpiresAt: null,
      ...(regenResumePatch ?? {}),
      ...(options?.pipelineCache
        ? { pipelineCache: options.pipelineCache as Prisma.InputJsonValue }
        : {}),
    },
  });

  if (order.status !== 'generating') {
    const claimed = await prisma.order.updateMany({
      where: { id: orderId, status: { in: claimableStatuses } },
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
