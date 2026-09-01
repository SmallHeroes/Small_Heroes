import { prisma } from '@/lib/prisma';
import { chainGenerationWorker } from './chain-worker';
import { getMaxStaleReclaims } from './constants';
import { isReadinessManifestEnabled } from '@/lib/generation-pipeline/readiness-manifest';
import { openExceptionCase } from './exception-case';
import { tryDeleteOriginalChildPhotoAfterGeneration } from '@/lib/child-photo-deletion';
import {
  parseGenerationReleaseContinuityV1,
  RELEASE_V1_ORDER_AUTHORITY_SELECT,
  RELEASE_V1_PROTOCOL,
  releaseV1AuthorityCasWhere,
  requireExpectedWizardProductBinding,
  requireReleaseV1OrderPackage,
  type GenerationReleaseContinuityV1,
} from '@/lib/generation-pipeline/release-v1-continuity';
import { requireOrderVisualPackageAuthority } from '@/lib/generation-pipeline/order-visual-package-authority';

/** Progress fingerprint — changes when the job advances (stage or completed-page count). */
function progressFingerprint(currentStage: string, completedPageNumbers: unknown): string {
  const count = Array.isArray(completedPageNumbers) ? completedPageNumbers.length : 0;
  return `${currentStage}:${count}`;
}

/**
 * Source-of-truth continuation: reclaim ANY expired-lease job in pending/running (regardless of
 * `retryable`) and **dispatch** it to the worker route — the sweeper is a DISPATCHER, never a
 * renderer. It must NOT run the chunk in-process: the sweep runs inside the 60s cron route
 * (`/api/generate/cron/sweep`, maxDuration=60), and a `page_images` chunk (gpt-image + refs +
 * upload + postprocess) cannot finish in 60s — it would be killed mid-render with no asset and no
 * error, leaving the lease to expire and the reclaim counter to climb (the silent stall loop).
 * Instead it kicks `/api/generate/worker` (maxDuration=300) via the existing self-chain helper, so
 * a reclaim is telemetry-indistinguishable from a normal chain hop and compute happens only on the
 * 300s worker route.
 *
 * Anti-infinite-spend: each reclaim that does NOT change the progress fingerprint increments
 * staleReclaimCount; a job that advances resets it. After getMaxStaleReclaims() no-progress
 * reclaims the job is hard-failed (retryable=false) instead of being re-spawned forever.
 */
export async function sweepStaleGenerationJobs(
  limit = 5,
  options?: {
    orderId?: string;
    releaseProtocol?: typeof RELEASE_V1_PROTOCOL;
  }
): Promise<number> {
  if (options?.releaseProtocol === RELEASE_V1_PROTOCOL && !options.orderId) {
    throw new Error('release/v1 sweeper requires one exact orderId');
  }
  const now = new Date();
  const stale = await prisma.generationJob.findMany({
    where: {
      ...(options?.orderId ? { orderId: options.orderId } : {}),
      status: { in: ['pending', 'running'] },
      currentStage: { notIn: ['done', 'failed'] },
      OR: [{ lockedBy: null }, { leaseExpiresAt: { lt: now } }],
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: {
      orderId: true,
      status: true,
      currentStage: true,
      lockedBy: true,
      leaseExpiresAt: true,
      updatedAt: true,
      staleReclaimCount: true,
      lastReclaimStage: true,
      completedPageNumbers: true,
      pipelineCache: true,
      order: {
        select: {
          ...RELEASE_V1_ORDER_AUTHORITY_SELECT,
          status: true,
          deliveryHoldReason: true,
          manualReviewRequired: true,
        },
      },
    },
  });

  const maxReclaims = getMaxStaleReclaims();
  let processed = 0;
  for (const job of stale) {
    const orderSnapshot = (
      job as typeof job & {
        order?: Parameters<typeof requireReleaseV1OrderPackage>[0];
      }
    ).order;
    const cache =
      job.pipelineCache &&
      typeof job.pipelineCache === 'object' &&
      !Array.isArray(job.pipelineCache)
        ? (job.pipelineCache as Record<string, unknown>)
        : null;
    let releaseContinuity: GenerationReleaseContinuityV1 | undefined;
    if (options?.releaseProtocol === RELEASE_V1_PROTOCOL) {
      if (!orderSnapshot) {
        throw new Error('release/v1 sweeper Order snapshot is missing');
      }
      if (
        !['paid', 'generating'].includes(orderSnapshot.status) ||
        orderSnapshot.deliveryHoldReason != null ||
        orderSnapshot.manualReviewRequired === true
      ) {
        continue;
      }
      const releaseBinding = requireReleaseV1OrderPackage(orderSnapshot).binding;
      releaseContinuity = parseGenerationReleaseContinuityV1(
        cache?.releaseContinuity,
      );
      const current = await prisma.order.findUnique({
        where: { id: job.orderId },
        select: {
          ...RELEASE_V1_ORDER_AUTHORITY_SELECT,
          status: true,
          deliveryHoldReason: true,
          manualReviewRequired: true,
        },
      });
      if (
        !current ||
        !['paid', 'generating'].includes(current.status) ||
        current.deliveryHoldReason != null ||
        current.manualReviewRequired === true
      ) {
        continue;
      }
      requireExpectedWizardProductBinding({
        order: current,
        expected: releaseBinding,
      });
    } else {
      // Legacy/global recovery never mutates or dispatches package-backed v1
      // work. Its order-scoped versioned status/worker owns that lifecycle.
      try {
        if (
          cache?.releaseContinuity != null ||
          (orderSnapshot &&
            requireOrderVisualPackageAuthority(orderSnapshot) !== null)
        ) {
          continue;
        }
      } catch {
        continue;
      }
    }
    const fingerprint = progressFingerprint(job.currentStage, job.completedPageNumbers);
    const madeProgress = fingerprint !== job.lastReclaimStage;
    const nextCount = madeProgress ? 1 : (job.staleReclaimCount ?? 0) + 1;
    const releaseObservedStaleJobWhere = {
      status: job.status,
      currentStage: job.currentStage,
      lockedBy: job.lockedBy,
      leaseExpiresAt: job.leaseExpiresAt,
      updatedAt: job.updatedAt,
      staleReclaimCount: job.staleReclaimCount,
      lastReclaimStage: job.lastReclaimStage,
    };

    if (nextCount > maxReclaims) {
      // Stuck at the same stage with no progress across many reclaims → stop re-spending.
      const reason = `Stalled at stage ${job.currentStage} after ${nextCount - 1} no-progress reclaims`;
      const hardFailed = await prisma.$transaction(async (tx) => {
        const failedJob = options?.releaseProtocol === RELEASE_V1_PROTOCOL
          ? await tx.generationJob.updateMany({
              where: {
                orderId: job.orderId,
                ...releaseObservedStaleJobWhere,
                order: {
                  is: {
                    status: { in: ['paid', 'generating'] },
                    deliveryHoldReason: null,
                    manualReviewRequired: false,
                    ...releaseV1AuthorityCasWhere(orderSnapshot),
                  },
                },
              },
              data: {
                status: 'failed',
                currentStage: 'failed',
                retryable: false,
                failedAt: now,
                lastError: reason,
                staleReclaimCount: nextCount,
                lastReclaimStage: fingerprint,
              },
            })
          : await tx.generationJob.update({
              where: { orderId: job.orderId },
              data: {
            status: 'failed',
            currentStage: 'failed',
            retryable: false,
            failedAt: now,
            lastError: reason,
            staleReclaimCount: nextCount,
            lastReclaimStage: fingerprint,
              },
            });
        if ('count' in failedJob && failedJob.count !== 1) {
          return false;
        }
        const failedOrder = options?.releaseProtocol === RELEASE_V1_PROTOCOL
          ? await tx.order.updateMany({
              where: {
                id: job.orderId,
                status: { in: ['paid', 'generating'] },
                deliveryHoldReason: null,
                manualReviewRequired: false,
                ...releaseV1AuthorityCasWhere(orderSnapshot),
              },
              data: { status: 'failed', lastError: `Generation stalled at ${job.currentStage}` },
            })
          : await tx.order.update({
              where: { id: job.orderId },
              data: { status: 'failed', lastError: `Generation stalled at ${job.currentStage}` },
            });
        if ('count' in failedOrder && failedOrder.count !== 1) {
          throw new Error('release/v1 stalled Order authority changed');
        }
        if (isReadinessManifestEnabled()) {
          await openExceptionCase(tx, {
            orderId: job.orderId,
            kind: 'integrity_blocked',
            reason,
            sourceRef: `generation:${job.orderId}:${now.toISOString()}`,
            now,
            initialStatus: 'refund_pending',
            nextActionAt: now,
            fenceExisting: true,
          });
        }
        return true;
      });
      if (!hardFailed) continue;
      // (Track-4 Unit 1a, Finding 3) TERMINAL failure (retryable=false, retries exhausted) — the order will never
      // render, so its source photo is no longer needed. Clean it up on the failure path too (not only on success),
      // observably (the hook emits child_photo_deletion_failed on failure). Non-throwing; must not break the sweep.
      await tryDeleteOriginalChildPhotoAfterGeneration(job.orderId);
      continue;
    }

    // Record the reclaim attempt AND stamp the kick telemetry durably (awaited) so a reclaim that
    // dispatches a worker is indistinguishable from a normal chain hop — even if the fire-and-forget
    // diagnostic inside chainGenerationWorker does not flush before this cron route returns.
    const reclaimed = options?.releaseProtocol === RELEASE_V1_PROTOCOL
      ? await prisma.generationJob.updateMany({
          where: {
            orderId: job.orderId,
            ...releaseObservedStaleJobWhere,
            order: {
              is: {
                status: { in: ['paid', 'generating'] },
                deliveryHoldReason: null,
                manualReviewRequired: false,
                ...releaseV1AuthorityCasWhere(orderSnapshot),
              },
            },
          },
          data: {
            staleReclaimCount: nextCount,
            lastReclaimStage: fingerprint,
            lastWorkerKickAt: now,
            lastChainStatus: null,
            lastChainError: null,
          },
        })
      : await prisma.generationJob.update({
          where: { orderId: job.orderId },
          data: {
        staleReclaimCount: nextCount,
        lastReclaimStage: fingerprint,
        lastWorkerKickAt: now,
        lastChainStatus: null,
        lastChainError: null,
          },
        });
    if ('count' in reclaimed && reclaimed.count !== 1) continue;

    // Dispatcher boundary: kick the 300s worker route; NEVER render in-process inside the 60s cron.
    if (releaseContinuity) chainGenerationWorker(job.orderId, releaseContinuity);
    else chainGenerationWorker(job.orderId);
    processed += 1;
  }

  return processed;
}
