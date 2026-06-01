import { createLogger } from '@/lib/logger';
import { processGenerationChunk } from '@/lib/generation-pipeline/chunk-runner';
import { acquireGenerationLease, releaseGenerationLease } from './lease';
import { chainGenerationWorker } from './chain-worker';

const log = createLogger({ subsystem: 'chunked-gen', route: 'worker' });

export async function runGenerationWorkerInvocation(orderId: string): Promise<{
  ok: boolean;
  stage?: string;
  error?: string;
}> {
  const workerId = await acquireGenerationLease(orderId);
  if (!workerId) {
    log.info('No lease acquired — another worker active or job complete', { orderId });
    return { ok: false };
  }

  try {
    const result = await processGenerationChunk(orderId, workerId);
    log.info('Chunk finished', { orderId, ...result });
    if (!result.done) {
      void chainGenerationWorker(orderId);
    }
    return { ok: true, stage: result.stage, error: result.error };
  } finally {
    await releaseGenerationLease(orderId, workerId);
  }
}
