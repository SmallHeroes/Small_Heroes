import { startChunkedGeneration } from '@/lib/generation-chunked/start';
import {
  assertEnvSeparation,
  assertProdGenerationAllowed,
} from '@/lib/generation-chunked/env-separation-guard';
import { createLogger } from '@/lib/logger';

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
): Promise<void> {
  assertProdGenerationAllowed();
  assertEnvSeparation();
  const result = await startChunkedGeneration(orderId, reason);
  if (!result.started) {
    generationLogger.warn('Chunked start rejected', {
      orderId,
      reason,
      message: result.message,
    });
  }
}
