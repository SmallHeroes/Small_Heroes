import { prisma } from '@/lib/prisma';
import { runGenerationWorkerInvocation } from './process-worker';
import { sweepStaleGenerationJobs } from './sweeper';

export type RunToCompletionResult = {
  orderId: string;
  done: boolean;
  chunks: number;
  status: string | null;
  lastStage?: string;
  error?: string;
};

/**
 * Local acceptance driver — loops the SAME worker path production uses.
 * No bypass of lock, lease, idempotency, or status transitions.
 */
export async function runGenerationToCompletion(
  orderId: string,
  options?: { maxChunks?: number; idleWaitMs?: number }
): Promise<RunToCompletionResult> {
  const maxChunks = options?.maxChunks ?? 200;
  const idleWaitMs = options?.idleWaitMs ?? 1500;

  let chunks = 0;
  let lastStage: string | undefined;
  let consecutiveIdle = 0;

  while (chunks < maxChunks) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order) {
      return { orderId, done: false, chunks, status: null, error: 'Order not found' };
    }
    if (order.status === 'ready' || order.status === 'partial') {
      return { orderId, done: true, chunks, status: order.status, lastStage: 'done' };
    }

    const job = await prisma.generationJob.findUnique({
      where: { orderId },
      select: { currentStage: true, status: true, lastError: true, retryable: true },
    });
    if (job?.currentStage === 'done' || job?.status === 'done') {
      return { orderId, done: true, chunks, status: order.status, lastStage: 'done' };
    }
    if (job?.status === 'failed' && !job.retryable) {
      return {
        orderId,
        done: false,
        chunks,
        status: order.status,
        lastStage: job.currentStage,
        error: job.lastError ?? 'Job failed',
      };
    }

    const result = await runGenerationWorkerInvocation(orderId);
    chunks += 1;
    lastStage = result.stage;

    if (result.ok && result.stage === 'done') {
      const finalOrder = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      return {
        orderId,
        done: finalOrder?.status === 'ready' || finalOrder?.status === 'partial',
        chunks,
        status: finalOrder?.status ?? null,
        lastStage: result.stage,
      };
    }

    if (!result.ok) {
      consecutiveIdle += 1;
      await sweepStaleGenerationJobs(1, { orderId });
      if (consecutiveIdle >= 5) {
        return {
          orderId,
          done: false,
          chunks,
          status: order.status,
          lastStage,
          error: 'Worker idle — could not acquire lease after retries',
        };
      }
      await new Promise((r) => setTimeout(r, idleWaitMs));
      continue;
    }

    consecutiveIdle = 0;
  }

  return {
    orderId,
    done: false,
    chunks,
    status: (await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } }))
      ?.status ?? null,
    lastStage,
    error: `Exceeded maxChunks=${maxChunks}`,
  };
}
