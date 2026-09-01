import { beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  process: vi.fn(),
  chain: vi.fn(),
  requirePackage: vi.fn(),
  requireExpected: vi.fn(),
  requireOrderAuthority: vi.fn(),
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
  prisma: { order: { findUnique: H.orderFindUnique } },
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
