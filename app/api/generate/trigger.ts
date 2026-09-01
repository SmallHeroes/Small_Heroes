import { startChunkedGeneration } from '@/lib/generation-chunked/start';
import {
  assertEnvSeparation,
  assertProdGenerationAllowed,
} from '@/lib/generation-chunked/env-separation-guard';
import { createLogger } from '@/lib/logger';
import {
  RELEASE_V1_PROTOCOL,
  ReleaseV1ContinuityError,
} from '@/lib/generation-pipeline/release-v1-continuity';

const generationLogger = createLogger({
  subsystem: 'generation',
  route: '/api/generate',
});

/**
 * Shared payment-to-generation service boundary.
 *
 * Kept outside `route.ts` because Next route modules may export only HTTP
 * handlers and route configuration. Every payment/dev trigger still reaches
 * the same chunked, gated generation path through this function.
 */
export async function triggerGeneration(
  orderId: string,
  reason = 'unspecified',
  options?: { releaseProtocol?: typeof RELEASE_V1_PROTOCOL },
): Promise<void> {
  assertProdGenerationAllowed();
  assertEnvSeparation();
  const result = options
    ? await startChunkedGeneration(orderId, reason, options)
    : await startChunkedGeneration(orderId, reason);
  if (!result.started) {
    generationLogger.warn('Chunked start rejected', {
      orderId,
      reason,
      message: result.message,
    });
    if (options?.releaseProtocol === RELEASE_V1_PROTOCOL) {
      throw new ReleaseV1ContinuityError([
        `release/v1 generation start rejected: ${result.message ?? 'unknown'}`,
      ]);
    }
  }
}
