import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const H = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  orderUpdateMany: vi.fn(),
  jobCreate: vi.fn(),
  jobFindUnique: vi.fn(),
  jobUpdate: vi.fn(),
  persistCache: vi.fn(),
  chain: vi.fn(),
}));

const continuity = {
  version: 'generation-release-continuity/v1' as const,
  protocol: 'release/v1' as const,
  workerBaseUrl: 'https://qa-branch.vercel.app',
  workerPath: '/api/release/v1/generate/worker' as const,
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: H.orderFindUnique, updateMany: H.orderUpdateMany },
    generationJob: {
      create: H.jobCreate,
      findUnique: H.jobFindUnique,
      update: H.jobUpdate,
    },
    generatedBook: { findUnique: vi.fn() },
  },
}));
vi.mock('@/lib/generation-chunked/env-separation-guard', () => ({
  assertEnvSeparation: vi.fn(),
  assertProdGenerationAllowed: vi.fn(),
}));
vi.mock('@/lib/generation-chunked/chain-worker', () => ({
  chainGenerationWorker: H.chain,
}));
vi.mock('@/lib/generation-pipeline/pipeline-cache-store', () => ({
  persistOrdinaryPipelineCache: H.persistCache,
  withoutBarrierOwnedPipelineCacheKeys: (value: unknown) => value,
}));
vi.mock('@/lib/generation-pipeline/release-v1-continuity', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/generation-pipeline/release-v1-continuity')
  >();
  return {
    ...actual,
    buildGenerationReleaseContinuityV1: vi.fn(() => continuity),
    requireReleaseV1OrderPackage: vi.fn(() => ({ binding: {} })),
  };
});
vi.mock('@/lib/generation-pipeline/order-visual-package-authority', () => ({
  requireOrderVisualPackageAuthority: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('release/v1 start is idempotent once a durable job exists', () => {
  it('does not reset an active lease, progress or dispatch on duplicate payment confirmation', async () => {
    H.orderFindUnique.mockResolvedValue({
      id: 'release-order',
      status: 'generating',
      deliveryHoldReason: null,
      visualPackageAuthority: { package: true },
      storyDirectionSet: null,
      generationJob: {
        status: 'running',
        currentStage: 'page_images',
        lockedBy: 'active-worker',
        leaseExpiresAt: new Date(Date.now() + 60_000),
        completedPageNumbers: [1, 2],
        pipelineCache: { releaseContinuity: continuity },
      },
    });
    const { startChunkedGeneration } = await import(
      '@/lib/generation-chunked/start'
    );
    const result = await startChunkedGeneration(
      'release-order',
      'fake_payment_confirm_success',
      { releaseProtocol: 'release/v1' },
    );
    expect(result).toMatchObject({ started: true, orderId: 'release-order' });
    expect(H.jobCreate).not.toHaveBeenCalled();
    expect(H.jobUpdate).not.toHaveBeenCalled();
    expect(H.persistCache).not.toHaveBeenCalled();
    expect(H.orderUpdateMany).not.toHaveBeenCalled();
    expect(H.chain).not.toHaveBeenCalled();
  });

  it('does not create, reset or dispatch a job for a held package-backed Order', async () => {
    H.orderFindUnique.mockResolvedValue({
      id: 'release-order-held',
      status: 'needs_human_qa',
      deliveryHoldReason: 'safety_hold:hazard_detected',
      manualReviewRequired: true,
      visualPackageAuthority: { package: true },
      storyDirectionSet: null,
      generationJob: null,
    });
    const { startChunkedGeneration } = await import(
      '@/lib/generation-chunked/start'
    );
    const result = await startChunkedGeneration(
      'release-order-held',
      'fake_payment_confirm_success',
      { releaseProtocol: 'release/v1' },
    );
    expect(result).toMatchObject({
      started: false,
      message: 'Release Order is not eligible to start generation',
    });
    expect(H.jobCreate).not.toHaveBeenCalled();
    expect(H.jobUpdate).not.toHaveBeenCalled();
    expect(H.orderUpdateMany).not.toHaveBeenCalled();
    expect(H.chain).not.toHaveBeenCalled();
  });

  it('does not reset or re-dispatch when an exact concurrent starter wins the unique job create', async () => {
    H.orderFindUnique.mockResolvedValue({
      id: 'release-order-race',
      status: 'paid',
      deliveryHoldReason: null,
      manualReviewRequired: false,
      visualPackageAuthority: { package: true },
      storyDirectionSet: null,
      generationJob: null,
    });
    H.jobCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('concurrent job', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    H.jobFindUnique.mockResolvedValueOnce({
      pipelineCache: { releaseContinuity: continuity },
    });

    const { startChunkedGeneration } = await import(
      '@/lib/generation-chunked/start'
    );
    const result = await startChunkedGeneration(
      'release-order-race',
      'fake_payment_confirm_success',
      { releaseProtocol: 'release/v1' },
    );

    expect(result).toMatchObject({
      started: true,
      message: 'Release generation job was created concurrently',
    });
    expect(H.jobUpdate).not.toHaveBeenCalled();
    expect(H.persistCache).not.toHaveBeenCalled();
    expect(H.orderUpdateMany).not.toHaveBeenCalled();
    expect(H.chain).not.toHaveBeenCalled();
  });

  it('rejects a concurrent first-start winner bound to another deployment without mutating it', async () => {
    H.orderFindUnique.mockResolvedValue({
      id: 'release-order-cross-deploy-race',
      status: 'paid',
      deliveryHoldReason: null,
      manualReviewRequired: false,
      visualPackageAuthority: { package: true },
      storyDirectionSet: null,
      generationJob: null,
    });
    H.jobCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('concurrent job', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    H.jobFindUnique.mockResolvedValueOnce({
      pipelineCache: {
        releaseContinuity: {
          ...continuity,
          workerBaseUrl: 'https://other-deployment.vercel.app',
        },
      },
    });

    const { startChunkedGeneration } = await import(
      '@/lib/generation-chunked/start'
    );
    await expect(startChunkedGeneration(
      'release-order-cross-deploy-race',
      'fake_payment_confirm_success',
      { releaseProtocol: 'release/v1' },
    )).rejects.toThrow('concurrent generation job is pinned to another deployment');

    expect(H.jobUpdate).not.toHaveBeenCalled();
    expect(H.persistCache).not.toHaveBeenCalled();
    expect(H.orderUpdateMany).not.toHaveBeenCalled();
    expect(H.chain).not.toHaveBeenCalled();
  });
});
