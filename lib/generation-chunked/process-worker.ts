import { createLogger } from '@/lib/logger';

import { processGenerationChunk } from '@/lib/generation-pipeline/chunk-runner';

import { acquireGenerationLease, releaseGenerationLease } from './lease';

import { chainGenerationWorker } from './chain-worker';
import { assertEnvSeparation, assertProdGenerationAllowed } from './env-separation-guard';
import { prisma } from '@/lib/prisma';
import {
  buildGenerationReleaseContinuityV1,
  parseGenerationReleaseContinuityV1,
  RELEASE_V1_ORDER_AUTHORITY_SELECT,
  RELEASE_V1_PROTOCOL,
  ReleaseV1ContinuityError,
  requireExpectedWizardProductBinding,
  requireReleaseV1OrderPackage,
  type GenerationReleaseContinuityV1,
  type WizardProductBindingV1,
} from '@/lib/generation-pipeline/release-v1-continuity';
import { requireOrderVisualPackageAuthority } from '@/lib/generation-pipeline/order-visual-package-authority';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';



const log = createLogger({ subsystem: 'chunked-gen', route: 'worker' });



export async function runGenerationWorkerInvocation(
  orderId: string,
  options?: {
    routeProtocol?: typeof RELEASE_V1_PROTOCOL | 'legacy-route';
  },
): Promise<{

  ok: boolean;

  stage?: string;

  error?: string;

}> {

  // Hard-disable on prod (P0 cutover guard) BEFORE any lease/DB/spend at the shared worker entrypoint
  // (covers the minutes-cron sweep + manual/direct worker invocations).
  assertProdGenerationAllowed();
  // Guard at the shared worker entrypoint so cron/manual/direct worker invocations
  // cannot bypass the self-chain protection.
  assertEnvSeparation();

  let releaseContinuity: GenerationReleaseContinuityV1 | undefined;
  let releaseBinding: WizardProductBindingV1 | undefined;
  const routeProtocol = options?.routeProtocol ?? 'legacy-route';
  {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        ...RELEASE_V1_ORDER_AUTHORITY_SELECT,
        status: true,
        deliveryHoldReason: true,
        manualReviewRequired: true,
        generationJob: { select: { pipelineCache: true } },
      },
    });
    if (!order) {
      throw new ReleaseV1ContinuityError(['Order is missing']);
    }
    if (routeProtocol === 'legacy-route') {
      if (requireOrderVisualPackageAuthority(order)) {
        throw new ReleaseV1ContinuityError([
          'package-backed Order requires the release/v1 worker',
        ]);
      }
    } else {
      if (
        !['paid', 'generating'].includes(order.status) ||
        order.deliveryHoldReason != null ||
        order.manualReviewRequired === true
      ) {
        throw new ReleaseV1ContinuityError([
          'release/v1 worker Order is not eligible to generate',
        ]);
      }
      releaseBinding = requireReleaseV1OrderPackage(order).binding;
      const cache =
        order.generationJob?.pipelineCache &&
        typeof order.generationJob.pipelineCache === 'object' &&
        !Array.isArray(order.generationJob.pipelineCache)
          ? (order.generationJob.pipelineCache as Record<string, unknown>)
          : null;
      releaseContinuity = parseGenerationReleaseContinuityV1(
        cache?.releaseContinuity,
      );
      const currentDeployment = buildGenerationReleaseContinuityV1();
      if (
        currentDeployment.workerBaseUrl !== releaseContinuity.workerBaseUrl
      ) {
        throw new ReleaseV1ContinuityError([
          'release/v1 worker is not running on the initiating deployment',
        ]);
      }
    }
  }

  const workerId = await acquireGenerationLease(orderId);

  if (!workerId) {

    log.info('No lease acquired — another worker active or job complete', { orderId });

    return { ok: false };

  }

  if (routeProtocol === RELEASE_V1_PROTOCOL) {
    try {
      const fresh = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          ...RELEASE_V1_ORDER_AUTHORITY_SELECT,
          status: true,
          deliveryHoldReason: true,
          manualReviewRequired: true,
          generationJob: { select: { pipelineCache: true } },
        },
      });
      if (!fresh) throw new ReleaseV1ContinuityError(['Order is missing after lease']);
      if (
        !['paid', 'generating'].includes(fresh.status) ||
        fresh.deliveryHoldReason != null ||
        fresh.manualReviewRequired === true
      ) {
        throw new ReleaseV1ContinuityError([
          'release/v1 worker Order became ineligible after lease',
        ]);
      }
      requireExpectedWizardProductBinding({
        order: fresh,
        expected: releaseBinding,
      });
      const cache =
        fresh.generationJob?.pipelineCache &&
        typeof fresh.generationJob.pipelineCache === 'object' &&
        !Array.isArray(fresh.generationJob.pipelineCache)
          ? (fresh.generationJob.pipelineCache as Record<string, unknown>)
          : null;
      const durable = parseGenerationReleaseContinuityV1(cache?.releaseContinuity);
      if (
        !releaseContinuity ||
        canonicalJsonDigest(durable) !== canonicalJsonDigest(releaseContinuity)
      ) {
        throw new ReleaseV1ContinuityError([
          'release/v1 generation continuity changed after lease',
        ]);
      }
    } catch (error) {
      await releaseGenerationLease(orderId, workerId);
      throw error;
    }
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

    if (releaseContinuity) chainGenerationWorker(orderId, releaseContinuity);
    else chainGenerationWorker(orderId);

  }



  return { ok: true, stage: result?.stage, error: result?.error };

}
