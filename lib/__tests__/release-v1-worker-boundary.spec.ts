import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  process: vi.fn(),
  chain: vi.fn(),
  requirePackage: vi.fn(),
  requireExpected: vi.fn(),
  requireOrderAuthority: vi.fn(),
  jobFindMany: vi.fn(),
  jobUpdateMany: vi.fn(),
  orderUpdateMany: vi.fn(),
  transaction: vi.fn(),
  deletePhoto: vi.fn(),
}));

const continuity = {
  version: 'generation-release-continuity/v1' as const,
  protocol: 'release/v1' as const,
  workerBaseUrl: 'https://qa-branch.vercel.app',
  workerPath: '/api/release/v1/generate/worker' as const,
};
const binding = {
  version: 'wizard-product-binding/v1' as const,
  storyKey: 'chameleon_koko_bedtime',
  styleId: 'soft_hand_drawn_storybook',
  sourcePath: 'accepted.md',
  sourceRawDigest: 'a'.repeat(64),
  packagePath: 'package.json',
  packageRevisionDigest: 'b'.repeat(64),
  packageAuthorityDigest: 'c'.repeat(64),
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: H.orderFindUnique,
      updateMany: H.orderUpdateMany,
    },
    generationJob: {
      findMany: H.jobFindMany,
      updateMany: H.jobUpdateMany,
    },
    $transaction: H.transaction,
  },
}));
vi.mock('@/lib/generation-chunked/lease', () => ({
  acquireGenerationLease: H.acquire,
  releaseGenerationLease: H.release,
}));
vi.mock('@/lib/generation-pipeline/chunk-runner', () => ({
  processGenerationChunk: H.process,
}));
vi.mock('@/lib/generation-chunked/chain-worker', () => ({
  chainGenerationWorker: H.chain,
}));
vi.mock('@/lib/generation-chunked/env-separation-guard', () => ({
  assertEnvSeparation: vi.fn(),
  assertProdGenerationAllowed: vi.fn(),
}));
vi.mock('@/lib/generation-pipeline/release-v1-continuity', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/generation-pipeline/release-v1-continuity')
  >();
  return {
    ...actual,
    buildGenerationReleaseContinuityV1: vi.fn(() => continuity),
    parseGenerationReleaseContinuityV1: vi.fn(() => continuity),
    requireReleaseV1OrderPackage: H.requirePackage,
    requireExpectedWizardProductBinding: H.requireExpected,
  };
});
vi.mock('@/lib/generation-pipeline/order-visual-package-authority', () => ({
  requireOrderVisualPackageAuthority: H.requireOrderAuthority,
}));
vi.mock('@/lib/child-photo-deletion', () => ({
  tryDeleteOriginalChildPhotoAfterGeneration: H.deletePhoto,
}));
vi.mock('@/lib/generation-pipeline/readiness-manifest', () => ({
  isReadinessManifestEnabled: vi.fn(() => false),
}));
vi.mock('@/lib/generation-chunked/exception-case', () => ({
  openExceptionCase: vi.fn(),
}));

const order = {
  id: 'release-worker-order',
  status: 'generating',
  deliveryHoldReason: null,
  manualReviewRequired: false,
  selectionFilename: 'accepted.md',
  storySourceHash: 'a'.repeat(64),
  illustrationStyle: 'pencil_watercolor',
  visualPackageAuthority: { package: true },
  generationJob: { pipelineCache: { releaseContinuity: continuity } },
};

beforeEach(() => {
  vi.clearAllMocks();
  H.acquire.mockResolvedValue('worker-lease');
  H.release.mockResolvedValue(undefined);
  H.process.mockResolvedValue({ done: true, stage: 'done' });
  H.requirePackage.mockReturnValue({ binding });
  H.requireExpected.mockReturnValue(binding);
  H.jobUpdateMany.mockResolvedValue({ count: 1 });
  H.orderUpdateMany.mockResolvedValue({ count: 1 });
  H.deletePhoto.mockResolvedValue(undefined);
  H.transaction.mockImplementation(async (work) => work({
    generationJob: { updateMany: H.jobUpdateMany },
    order: { updateMany: H.orderUpdateMany },
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('release/v1 worker admission surrounds the lease boundary', () => {
  it('revalidates after lease and releases it before any provider work on drift', async () => {
    H.orderFindUnique.mockResolvedValueOnce(order).mockResolvedValueOnce(order);
    H.requireExpected.mockImplementation(() => {
      throw new Error('authority drift after lease');
    });
    const { runGenerationWorkerInvocation } = await import(
      '@/lib/generation-chunked/process-worker'
    );
    await expect(runGenerationWorkerInvocation(order.id, {
      routeProtocol: 'release/v1',
    })).rejects.toThrow(/authority drift after lease/u);
    expect(H.acquire).toHaveBeenCalledTimes(1);
    expect(H.release).toHaveBeenCalledWith(order.id, 'worker-lease');
    expect(H.process).not.toHaveBeenCalled();
  });

  it('the generic worker rejects package-backed work before lease acquisition', async () => {
    H.orderFindUnique.mockResolvedValueOnce(order);
    H.requireOrderAuthority.mockReturnValue({ package: true });
    const { runGenerationWorkerInvocation } = await import(
      '@/lib/generation-chunked/process-worker'
    );
    await expect(runGenerationWorkerInvocation(order.id))
      .rejects.toThrow(/requires the release\/v1 worker/u);
    expect(H.acquire).not.toHaveBeenCalled();
    expect(H.process).not.toHaveBeenCalled();
  });

  it('releases the lease without provider work when the Order gains a governing hold', async () => {
    H.orderFindUnique
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({
        ...order,
        deliveryHoldReason: 'contract_world_hold:authority_drift',
      });
    const { runGenerationWorkerInvocation } = await import(
      '@/lib/generation-chunked/process-worker'
    );
    await expect(runGenerationWorkerInvocation(order.id, {
      routeProtocol: 'release/v1',
    })).rejects.toThrow(/became ineligible after lease/u);
    expect(H.release).toHaveBeenCalledWith(order.id, 'worker-lease');
    expect(H.process).not.toHaveBeenCalled();
  });
});

describe('release/v1 stale recovery owns an exact observed job snapshot', () => {
  it('does not hard-fail the Order when a worker acquires the lease after stale selection', async () => {
    vi.stubEnv('GENERATION_MAX_STALE_RECLAIMS', '3');
    const observedAt = new Date('2026-09-01T12:00:00.000Z');
    const staleJob = {
      orderId: order.id,
      status: 'running',
      currentStage: 'page_images',
      lockedBy: null,
      leaseExpiresAt: null,
      updatedAt: observedAt,
      staleReclaimCount: 3,
      lastReclaimStage: 'page_images:0',
      completedPageNumbers: [],
      pipelineCache: { releaseContinuity: continuity },
      order,
    };
    H.jobFindMany.mockResolvedValueOnce([staleJob]);
    H.orderFindUnique.mockResolvedValueOnce(order);
    // Simulate a worker acquiring the lease between findMany and the hard-fail CAS.
    H.jobUpdateMany.mockResolvedValueOnce({ count: 0 });

    const { sweepStaleGenerationJobs } = await import(
      '@/lib/generation-chunked/sweeper'
    );
    const processed = await sweepStaleGenerationJobs(1, {
      orderId: order.id,
      releaseProtocol: 'release/v1',
    });

    expect(processed).toBe(0);
    expect(H.jobUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        orderId: order.id,
        status: 'running',
        currentStage: 'page_images',
        lockedBy: null,
        leaseExpiresAt: null,
        updatedAt: observedAt,
        staleReclaimCount: 3,
        lastReclaimStage: 'page_images:0',
      }),
    }));
    expect(H.orderUpdateMany).not.toHaveBeenCalled();
    expect(H.deletePhoto).not.toHaveBeenCalled();
    expect(H.chain).not.toHaveBeenCalled();
  });
});
