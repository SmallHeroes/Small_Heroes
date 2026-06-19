import { createLogger } from '@/lib/logger';

import { processGenerationChunk } from '@/lib/generation-pipeline/chunk-runner';

import { acquireGenerationLease, releaseGenerationLease } from './lease';

import { chainGenerationWorker } from './chain-worker';
import { assertEnvSeparation } from './env-separation-guard';



const log = createLogger({ subsystem: 'chunked-gen', route: 'worker' });



export async function runGenerationWorkerInvocation(orderId: string): Promise<{

  ok: boolean;

  stage?: string;

  error?: string;

}> {

  // Guard at the shared worker entrypoint so cron/manual/direct worker invocations
  // cannot bypass the self-chain protection.
  assertEnvSeparation();

  const workerId = await acquireGenerationLease(orderId);

  if (!workerId) {

    log.info('No lease acquired — another worker active or job complete', { orderId });

    return { ok: false };

  }



  let result: Awaited<ReturnType<typeof processGenerationChunk>> | undefined;

  try {

    result = await processGenerationChunk(orderId, workerId);

    log.info('Chunk finished', { orderId, ...result });

  } finally {

    // Release BEFORE any continuation kick so the next worker/sweeper can claim immediately.

    await releaseGenerationLease(orderId, workerId);

  }



  if (result && !result.done && process.env.GENERATION_DISABLE_SELF_CHAIN !== 'true') {

    chainGenerationWorker(orderId);

  }



  return { ok: true, stage: result?.stage, error: result?.error };

}


