import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { canonicalJsonDigest } from '@/lib/visual-package/integrity';

const H = vi.hoisted(() => ({
  requireExpectedBinding: vi.fn(),
  buildContinuity: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/generation-chunked/chain-worker', () => ({
  chainGenerationWorker: H.dispatch,
}));
vi.mock('@/lib/generation-pipeline/release-v1-continuity', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/generation-pipeline/release-v1-continuity')
  >();
  return {
    ...actual,
    buildGenerationReleaseContinuityV1: H.buildContinuity,
    requireExpectedWizardProductBinding: H.requireExpectedBinding,
  };
});

import {
  ReleaseV1RecoveryError,
  ReleaseV1RecoveryInputError,
  executeReleaseV1Recovery,
  parseReleaseV1RecoveryInput,
} from '@/lib/generation-pipeline/release-v1-recovery';

const NOW = new Date('2026-09-01T20:00:00.000Z');
const ATTEMPT_ID = '11111111-1111-4111-8111-111111111111';
const OLD_CONTINUITY = {
  version: 'generation-release-continuity/v1' as const,
  protocol: 'release/v1' as const,
  workerBaseUrl: 'https://old-preview.vercel.app',
  workerPath: '/api/release/v1/generate/worker' as const,
};
const TARGET_CONTINUITY = {
  ...OLD_CONTINUITY,
  workerBaseUrl: 'https://fixed-preview.vercel.app',
};
const BINDING = {
  version: 'wizard-product-binding/v1' as const,
  storyKey: 'chameleon_koko_bedtime',
  styleId: 'soft_hand_drawn_storybook',
  sourcePath: `story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/${'a'.repeat(64)}/integrated.md`,
  sourceRawDigest: 'b'.repeat(64),
  packagePath: `visual-packages/approved/revisions/${'c'.repeat(64)}.visual-package.json`,
  packageRevisionDigest: 'c'.repeat(64),
  packageAuthorityDigest: canonicalJsonDigest({ frozen: true }),
};
const SUPABASE_ORIGIN = 'https://stage.supabase.co';
const BUCKET_PREFIX = `${SUPABASE_ORIGIN}/storage/v1/object/public/book-images`;
const COVER_SHA = 'e'.repeat(64);

function input(mode: 'inspect' | 'apply', digest?: string) {
  return {
    mode,
    orderId: 'release-order',
    recoveryAttemptId: ATTEMPT_ID,
    reason: 'reviewed_code_fix_resume',
    expectedOldReleaseContinuity: OLD_CONTINUITY,
    expectedWizardProductBinding: BINDING,
    expectedArtifactInventory: {
      completedPageNumbers: [1, 2, 3, 4, 5, 6],
      missingPageNumbers: [7, 8],
    },
    ...(digest ? { expectedSnapshotDigest: digest } : {}),
  };
}

function makeOrder() {
  const pages = Array.from({ length: 8 }, (_, index) => {
    const pageNumber = index + 1;
    const sha256 = String(pageNumber).repeat(64);
    const url = `${BUCKET_PREFIX}/orders/release-order/page-${pageNumber}.png`;
    const presentationUrl = `${BUCKET_PREFIX}/orders/release-order/page-${pageNumber}-presentation.png`;
    return {
      id: `page-${pageNumber}`,
      pageNumber,
      audioUrl: null,
      imageAsset:
        pageNumber <= 6
          ? {
              id: `asset-${pageNumber}`,
              provider: 'openai',
              url,
              presentationUrl,
              idempotencyKey: `release-order:page_image:p${pageNumber}:gpt-image-2:low:v2`,
              safetyVerified: true,
              safetyHazards: [],
              safetyContentSha256: sha256,
            }
          : null,
    };
  });
  return {
    id: 'release-order',
    selectionFilename: BINDING.sourcePath,
    storySourceHash: BINDING.sourceRawDigest,
    illustrationStyle: 'pencil_watercolor',
    visualPackageAuthority: { frozen: true },
    status: 'failed',
    inputVersion: 17,
    updatedAt: new Date('2026-09-01T19:59:00.000Z'),
    expectedPageCount: 8,
    totalPrice: 5900,
    paymentProvider: 'fake',
    paymentId: 'fake_release-order',
    payment: {
      id: 'payment-1',
      provider: 'fake',
      amount: 5900,
      currency: 'ils',
      paid: true,
      paidAt: new Date('2026-09-01T18:00:00.000Z'),
    },
    textStatus: 'done',
    imageStatus: 'failed',
    audioStatus: 'pending',
    packageStatus: 'pending',
    deliveryHoldReason: null as string | null,
    manualReviewRequired: false,
    lastError: 'Page 7 image failed',
    errorAt: new Date('2026-09-01T19:58:00.000Z'),
    generationJob: {
      id: 'job-1',
      status: 'failed',
      currentStage: 'failed',
      retryable: true,
      lockedBy: null,
      leaseExpiresAt: null,
      failedAt: new Date('2026-09-01T19:58:00.000Z') as Date | null,
      lastError: 'Page 7 failed after 3 attempts',
      textDone: true,
      imagesDone: false,
      audioDone: false,
      packaged: false,
      generationVersion: 2,
      provider: null,
      model: null,
      quality: null,
      pipelineCache: {
        releaseContinuity: OLD_CONTINUITY,
        textFinalized: true,
        dna: { childDNA: 'child', companionDNA: 'companion' },
        childAnchorApproved: true,
        visualContract: { version: 'book-visual-contract/v1' },
        visualPackageAuthority: { frozen: true },
        setIdentityBoards: { version: 'required-v2' },
        storyFilePath: BINDING.sourcePath,
        unrelatedOrdinaryKey: 'preserve-me',
      } as Record<string, unknown>,
      completedPageNumbers: [1, 2, 3, 4, 5, 6],
      failedPageNumbers: [7],
      pageAttempts: { '7': 3 },
      updatedAt: new Date('2026-09-01T19:59:30.000Z'),
    },
    book: {
      id: 'book-1',
      coverImageUrl: `${BUCKET_PREFIX}/orders/release-order/cover.png`,
      coverSafetyVerified: true,
      coverSafetyHazards: [],
      coverSafetyContentSha256: COVER_SHA,
      pages,
    },
    exceptionCases: [
      {
        id: 'exception-1',
        kind: 'infra_transient',
        status: 'open',
        actionAttemptedAt: null as Date | null,
        claimVersion: 0,
        leaseExpiresAt: null as Date | null,
        sourceRef: 'generation:release-order:failed',
        updatedAt: new Date('2026-09-01T19:58:00.000Z'),
      },
    ],
    humanQaReviewCases: [] as Array<{
      id: string;
      kind: string;
      status: string;
    }>,
    pageUploadCandidates: [] as Array<{
      id: string;
      pageNumber: number;
      url: string;
      rawUrl: string | null;
      provider: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>,
  };
}

function shaForUrl(url: string): string {
  if (url.endsWith('/cover.png')) return COVER_SHA;
  const match = /page-(\d+)-presentation\.png$/u.exec(url);
  if (!match) throw new Error(`unexpected inspection URL: ${url}`);
  return match[1]!.repeat(64);
}

function makeHarness(order = makeOrder()) {
  const inspect = vi.fn(async (url: string | null | undefined) => ({
    ok: true,
    bytes: 1024,
    format: 'png',
    mime: 'image/png',
    width: 1024,
    height: 1536,
    sha256: shaForUrl(url ?? ''),
  }));
  const tx = {
    $queryRaw: vi.fn(async () => []),
    $executeRaw: vi.fn(async () => 1),
    order: {
      findUnique: vi.fn(async () => order),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    generationJob: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const transaction = vi.fn(async (work: (value: typeof tx) => unknown) =>
    work(tx),
  );
  const db = {
    order: { findUnique: vi.fn(async () => order) },
    $transaction: transaction,
  };
  return { order, inspect, tx, transaction, db };
}

function deps(harness: ReturnType<typeof makeHarness>) {
  return {
    db: harness.db as never,
    inspect: harness.inspect as never,
    dispatch: H.dispatch,
    now: () => NOW,
    env: {
      VERCEL_URL: 'fixed-preview.vercel.app',
      STYLE_01_GPT_MODEL: 'gpt-image-2',
      GPT_IMAGE_QUALITY: 'low',
    } as unknown as NodeJS.ProcessEnv,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SUPABASE_URL', SUPABASE_ORIGIN);
  vi.stubEnv('SUPABASE_STORAGE_BUCKET', 'book-images');
  H.buildContinuity.mockReturnValue(TARGET_CONTINUITY);
  H.requireExpectedBinding.mockReturnValue(BINDING);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('release/v1 reviewed same-order recovery', () => {
  it('parses a closed request grammar and rejects unknown keys or an unreviewed apply', () => {
    expect(parseReleaseV1RecoveryInput(input('inspect'))).toMatchObject({
      mode: 'inspect',
      orderId: 'release-order',
    });
    expect(() =>
      parseReleaseV1RecoveryInput({ ...input('inspect'), extra: true }),
    ).toThrowError(ReleaseV1RecoveryInputError);
    expect(() => parseReleaseV1RecoveryInput(input('apply'))).toThrow(
      'apply requires expectedSnapshotDigest',
    );
    expect(() =>
      parseReleaseV1RecoveryInput({
        ...input('inspect'),
        expectedArtifactInventory: {
          completedPageNumbers: [2, 1],
          missingPageNumbers: [7, 8],
        },
      }),
    ).toThrow('must be sorted and unique');
  });

  it('inspects the exact retained cover/pages and returns a stable zero-write digest', async () => {
    const harness = makeHarness();
    const first = await executeReleaseV1Recovery(input('inspect'), deps(harness));
    const second = await executeReleaseV1Recovery(input('inspect'), deps(harness));

    expect(first.status).toBe('inspect_ready');
    expect(second).toEqual(first);
    if (first.status !== 'inspect_ready') throw new Error('unexpected status');
    expect(first.inventory).toEqual({
      completedPageNumbers: [1, 2, 3, 4, 5, 6],
      missingPageNumbers: [7, 8],
    });
    expect(first.retainedAssets.pages).toHaveLength(6);
    expect(first.snapshotDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(harness.inspect).toHaveBeenCalledTimes(14);
    expect(harness.transaction).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('applies one fenced state transition, preserves cache/progress, then dispatches once', async () => {
    const harness = makeHarness();
    const inspected = await executeReleaseV1Recovery(
      input('inspect'),
      deps(harness),
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');

    const result = await executeReleaseV1Recovery(
      input('apply', inspected.snapshotDigest),
      deps(harness),
    );

    expect(result).toMatchObject({ status: 'resumed', dispatched: true });
    expect(harness.tx.$queryRaw).toHaveBeenCalledTimes(9);
    expect(harness.tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'generating',
          imageStatus: 'pending',
          lastError: null,
          errorAt: null,
        },
      }),
    );
    const jobMutation = (
      harness.tx.generationJob.updateMany.mock.calls as unknown as Array<
        [Record<string, Record<string, unknown>>]
      >
    )[0]![0];
    expect(jobMutation.data).toMatchObject({
      status: 'pending',
      currentStage: 'pending',
      completedPageNumbers: [1, 2, 3, 4, 5, 6],
    });
    expect(jobMutation.data).not.toHaveProperty('pageAttempts');
    expect(jobMutation.data).not.toHaveProperty('failedPageNumbers');
    expect(jobMutation.data).not.toHaveProperty('pipelineCache');

    const cachePayload = JSON.parse(
      (
        harness.tx.$executeRaw.mock.calls as unknown as Array<unknown[]>
      )[0]![1] as string,
    ) as Record<string, unknown>;
    expect(cachePayload).toMatchObject({
      unrelatedOrdinaryKey: 'preserve-me',
      releaseContinuity: TARGET_CONTINUITY,
      releaseRecovery: {
        version: 'release-v1-recovery-log/v1',
        attempts: [
          expect.objectContaining({
            attemptId: ATTEMPT_ID,
            snapshotDigest: inspected.snapshotDigest,
          }),
        ],
      },
    });
    expect(cachePayload).not.toHaveProperty('visualContract');
    expect(cachePayload).not.toHaveProperty('visualPackageAuthority');
    expect(cachePayload).not.toHaveProperty('setIdentityBoards');
    expect(H.dispatch).toHaveBeenCalledTimes(1);
    expect(H.dispatch).toHaveBeenCalledWith(
      'release-order',
      TARGET_CONTINUITY,
    );
  });

  it('rejects a stale inspect digest before entering the mutation transaction', async () => {
    const harness = makeHarness();
    await expect(
      executeReleaseV1Recovery(input('apply', 'f'.repeat(64)), deps(harness)),
    ).rejects.toThrow('snapshot changed after inspection');
    expect(harness.transaction).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('rejects retained-byte SHA drift and a missing-page upload candidate', async () => {
    const shaHarness = makeHarness();
    shaHarness.inspect.mockImplementation(async () => ({
      ok: true,
      bytes: 1,
      format: 'png',
      mime: 'image/png',
      width: 1,
      height: 1,
      sha256: 'f'.repeat(64),
    }));
    await expect(
      executeReleaseV1Recovery(input('inspect'), deps(shaHarness)),
    ).rejects.toThrow('retained-byte hash differs');

    const candidateOrder = makeOrder();
    candidateOrder.pageUploadCandidates.push({
      id: 'candidate-7',
      pageNumber: 7,
      url: `${BUCKET_PREFIX}/candidate-7.png`,
      rawUrl: null,
      provider: 'openai',
      createdAt: NOW,
      updatedAt: NOW,
    });
    const candidateHarness = makeHarness(candidateOrder);
    await expect(
      executeReleaseV1Recovery(input('inspect'), deps(candidateHarness)),
    ).rejects.toThrow('missing page 7 has a persisted upload candidate');
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('rejects a held/protected order and a disabled self-chain before mutation', async () => {
    const order = makeOrder();
    order.deliveryHoldReason = 'safety_hold:hazard';
    order.humanQaReviewCases.push({
      id: 'qa-1',
      kind: 'safety',
      status: 'open',
    });
    order.exceptionCases = [
      {
        id: 'refund-1',
        kind: 'quality_failed',
        status: 'refund_pending',
        actionAttemptedAt: NOW,
        claimVersion: 1,
        leaseExpiresAt: null,
        sourceRef: 'generation:release-order:failed',
        updatedAt: NOW,
      },
    ];
    const harness = makeHarness(order);
    await expect(
      executeReleaseV1Recovery(input('inspect'), {
        ...deps(harness),
        env: {
          VERCEL_URL: 'fixed-preview.vercel.app',
          GENERATION_DISABLE_SELF_CHAIN: 'true',
        } as unknown as NodeJS.ProcessEnv,
      }),
    ).rejects.toBeInstanceOf(ReleaseV1RecoveryError);
    expect(harness.inspect).not.toHaveBeenCalled();
    expect(harness.transaction).not.toHaveBeenCalled();
  });

  it('requires a different immutable deployment for each reviewed code-fix recovery', async () => {
    const harness = makeHarness();
    H.buildContinuity.mockReturnValueOnce(OLD_CONTINUITY);

    await expect(
      executeReleaseV1Recovery(input('inspect'), deps(harness)),
    ).rejects.toThrow('recovery must move to a different immutable deployment');
    expect(harness.inspect).not.toHaveBeenCalled();
    expect(harness.transaction).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('fails closed unless the Preview explicitly pins the shipped Style 01 model', async () => {
    for (const STYLE_01_GPT_MODEL of [undefined, 'gpt-image-1']) {
      const harness = makeHarness();
      await expect(
        executeReleaseV1Recovery(input('inspect'), {
          ...deps(harness),
          env: {
            VERCEL_URL: 'fixed-preview.vercel.app',
            GPT_IMAGE_QUALITY: 'low',
            ...(STYLE_01_GPT_MODEL ? { STYLE_01_GPT_MODEL } : {}),
          } as unknown as NodeJS.ProcessEnv,
        }),
      ).rejects.toThrow(
        'STYLE_01_GPT_MODEL must be explicitly pinned to gpt-image-2',
      );
      expect(harness.inspect).not.toHaveBeenCalled();
      expect(harness.transaction).not.toHaveBeenCalled();
    }
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('rejects a non-Style-01 package before retained-byte inspection', async () => {
    const harness = makeHarness();
    H.requireExpectedBinding.mockReturnValueOnce({
      ...BINDING,
      styleId: 'detailed_whimsical_world',
    });

    await expect(
      executeReleaseV1Recovery(input('inspect'), deps(harness)),
    ).rejects.toThrow('release recovery currently supports only Style 01');
    expect(harness.inspect).not.toHaveBeenCalled();
    expect(harness.transaction).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('rechecks the locked database snapshot and never dispatches on drift or CAS loss', async () => {
    const driftHarness = makeHarness();
    const inspected = await executeReleaseV1Recovery(
      input('inspect'),
      deps(driftHarness),
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');
    driftHarness.tx.order.findUnique.mockResolvedValue({
      ...driftHarness.order,
      inputVersion: driftHarness.order.inputVersion + 1,
    });
    await expect(
      executeReleaseV1Recovery(
        input('apply', inspected.snapshotDigest),
        deps(driftHarness),
      ),
    ).rejects.toThrow('database snapshot changed');
    expect(driftHarness.tx.order.updateMany).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();

    const casHarness = makeHarness();
    const casInspection = await executeReleaseV1Recovery(
      input('inspect'),
      deps(casHarness),
    );
    if (casInspection.status !== 'inspect_ready') throw new Error('unexpected status');
    casHarness.tx.generationJob.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      executeReleaseV1Recovery(
        input('apply', casInspection.snapshotDigest),
        deps(casHarness),
      ),
    ).rejects.toThrow('generation job recovery compare-and-swap lost');
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('returns already_resumed for the same durable attempt without a second dispatch', async () => {
    const original = makeHarness();
    const inspected = await executeReleaseV1Recovery(
      input('inspect'),
      deps(original),
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');

    const resumedOrder = makeOrder();
    resumedOrder.status = 'generating';
    resumedOrder.imageStatus = 'pending';
    resumedOrder.generationJob.status = 'pending';
    resumedOrder.generationJob.currentStage = 'pending';
    resumedOrder.generationJob.retryable = false;
    resumedOrder.generationJob.failedAt = null;
    resumedOrder.generationJob.pipelineCache = {
      ...resumedOrder.generationJob.pipelineCache,
      releaseContinuity: TARGET_CONTINUITY,
      releaseRecovery: {
        version: 'release-v1-recovery-log/v1',
        attempts: [
          {
            version: 'release-v1-recovery-attempt/v1',
            attemptId: ATTEMPT_ID,
            reason: 'reviewed_code_fix_resume',
            snapshotDigest: inspected.snapshotDigest,
            oldContinuityDigest: canonicalJsonDigest(OLD_CONTINUITY),
            newContinuityDigest: canonicalJsonDigest(TARGET_CONTINUITY),
            previousFailedAt: inspected.failedAt,
            previousLastErrorDigest: null,
            retainedArtifactDigests: {
              cover: COVER_SHA,
              pages: inspected.retainedAssets.pages.map((page) => ({
                pageNumber: page.pageNumber,
                sha256: page.sha256,
              })),
            },
            recoveredAt: NOW.toISOString(),
          },
        ],
      },
    };
    const resumedHarness = makeHarness(resumedOrder);
    const result = await executeReleaseV1Recovery(
      input('apply', inspected.snapshotDigest),
      deps(resumedHarness),
    );
    expect(result).toMatchObject({
      status: 'already_resumed',
      dispatched: false,
    });
    expect(resumedHarness.inspect).not.toHaveBeenCalled();
    expect(resumedHarness.transaction).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });
});
