import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * (Track-4 Unit 1a, Finding 3) When the sweeper hard-fails an order (retries exhausted, retryable=false — TERMINAL,
 * it will never render), the child-photo cleanup must run on that failure path too, not only on success.
 */
const H = vi.hoisted(() => ({
  findMany: vi.fn(),
  jobUpdate: vi.fn(async () => ({})),
  tx: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({ generationJob: { update: vi.fn(async () => ({})) }, order: { update: vi.fn(async () => ({})) } })),
  tryDelete: vi.fn(async () => {}),
  chain: vi.fn(),
  maxReclaims: 0,
}));
vi.mock('@/lib/prisma', () => ({ prisma: { generationJob: { findMany: H.findMany, update: H.jobUpdate }, $transaction: H.tx } }));
vi.mock('@/lib/child-photo-deletion', () => ({ tryDeleteOriginalChildPhotoAfterGeneration: H.tryDelete }));
vi.mock('@/lib/generation-pipeline/readiness-manifest', () => ({ isReadinessManifestEnabled: () => false }));
vi.mock('@/lib/generation-chunked/chain-worker', () => ({ chainGenerationWorker: H.chain }));
vi.mock('@/lib/generation-chunked/constants', () => ({ getMaxStaleReclaims: () => H.maxReclaims }));
vi.mock('@/lib/generation-chunked/exception-case', () => ({ openExceptionCase: vi.fn() }));

import { sweepStaleGenerationJobs } from '@/lib/generation-chunked/sweeper';

describe('sweeper terminal-failure child-photo cleanup', () => {
  beforeEach(() => { H.tryDelete.mockClear(); H.chain.mockClear(); H.maxReclaims = 0; });

  it('a terminal hard-fail (retries exhausted) triggers child-photo cleanup for that order', async () => {
    H.maxReclaims = 0; // any reclaim exhausts → hard-fail
    H.findMany.mockResolvedValue([{ orderId: 'ord_terminal', currentStage: 'page_images', staleReclaimCount: 0, lastReclaimStage: 'page_images:0', completedPageNumbers: [] }]);
    await sweepStaleGenerationJobs(5);
    expect(H.tryDelete).toHaveBeenCalledWith('ord_terminal'); // cleanup ran on the failure path
    expect(H.chain).not.toHaveBeenCalled(); // a hard-failed order is NOT re-dispatched
  });

  it('a still-reclaimable job is re-dispatched, NOT hard-failed → no cleanup (photo kept)', async () => {
    H.maxReclaims = 10; // plenty of budget left → dispatch, not hard-fail
    H.findMany.mockResolvedValue([{ orderId: 'ord_active', currentStage: 'page_images', staleReclaimCount: 0, lastReclaimStage: 'page_images:0', completedPageNumbers: [] }]);
    await sweepStaleGenerationJobs(5);
    expect(H.chain).toHaveBeenCalledWith('ord_active'); // re-dispatched
    expect(H.tryDelete).not.toHaveBeenCalled(); // still renderable → photo kept
  });
});
