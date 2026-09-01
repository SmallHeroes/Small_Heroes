import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import type { PageVisualQaResult } from '@/lib/generation-pipeline/page-visual-qa';

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
const SECOND_ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
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
const QA_FLAGS: PageVisualQaResult['flags'] = {
  anatomyOk: true,
  identityOk: true,
  styleOk: true,
  singleChildOk: true,
  objectGeometryOk: true,
  emotionalStagingOk: true,
  timeOfDayOk: true,
  companionSilhouetteOk: true,
  childPresenceOk: true,
  safetyOk: true,
};

function qaResult(
  overrides: Partial<PageVisualQaResult>,
): PageVisualQaResult {
  return {
    passed: true,
    verdict: 'evidence_unknown',
    reason: 'vision_malformed',
    details: '',
    flags: QA_FLAGS,
    safetyHazards: [],
    safetyStatus: 'unverified',
    ...overrides,
  };
}

const QA_MALFORMED = qaResult({});
const QA_SKIPPED = qaResult({ reason: 'vision_skipped' });
const QA_PASSED = qaResult({
  passed: true,
  verdict: 'passed',
  reason: 'ok',
  safetyStatus: 'safe',
});
const QA_VISUAL_FAILED = qaResult({
  passed: false,
  verdict: 'failed',
  reason: 'anatomy_failed',
  safetyStatus: 'safe',
});
const QA_HAZARD = qaResult({
  passed: false,
  verdict: 'failed',
  reason: 'safety_failed',
  safetyStatus: 'hazard',
  safetyHazards: ['unsafe_pose'],
});
const QA_INCONSISTENT_SAFE_HAZARD = qaResult({
  passed: true,
  verdict: 'passed',
  reason: 'ok',
  safetyStatus: 'safe',
  safetyHazards: ['unsafe_pose'],
});

function input(
  mode: 'inspect' | 'apply',
  digest?: string,
  recoveryAttemptId = ATTEMPT_ID,
) {
  return {
    mode,
    orderId: 'release-order',
    recoveryAttemptId,
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
              safetyHazards: [] as string[],
              safetyContentSha256: sha256,
              safetyOverriddenHazards: [],
              safetyOverrideSha256: null,
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
    deliveryFenceVersion: 3,
    visualContractHash: null as string | null,
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
      coverSafetyHazards: [] as string[],
      coverSafetyContentSha256: COVER_SHA,
      coverSafetyOverriddenHazards: [],
      coverSafetyOverrideSha256: null,
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
    qualityEvidence: [] as Array<{
      artifactKey: string;
      assetSha256: string;
      verdict: string;
      evaluatorContractVersion: string;
      reason: string | null;
      regenCount: number;
      providerModel: string | null;
      evidence: Record<string, unknown> | null;
      contractHash: string | null;
      safetyOverride: boolean;
      safetyOverrideSha256: string | null;
      updatedAt: Date;
    }>,
  };
}

function markPageUnverified(
  order: ReturnType<typeof makeOrder>,
  pageNumber = 6,
  options: {
    hasRailedBedOrCrib?: boolean;
    worldExpectation?: {
      zoneDescription: string;
      objects: Array<{ label: string; identity: string }>;
      forbiddenScenes: string[];
    };
  } = {},
) {
  const page = order.book.pages[pageNumber - 1]!;
  const asset = page.imageAsset!;
  asset.safetyVerified = false;
  const qaContext = {
    expectsChild: true,
    expectsCompanion: true,
    expectedPageTimeOfDay: 'night',
    isEmotionalClosing: false,
    hasStructuredObjects: true,
    hasRailedBedOrCrib: options.hasRailedBedOrCrib ?? false,
    hasHumanFamily: false,
    ...(options.worldExpectation
      ? { worldExpectation: options.worldExpectation }
      : {}),
  };
  order.qualityEvidence.push({
    artifactKey: `page:${pageNumber}`,
    assetSha256: asset.safetyContentSha256,
    verdict: 'evidence_unknown',
    evaluatorContractVersion: 'qa-v3',
    reason: 'safety:unverified',
    regenCount: 0,
    providerModel: 'gpt-4o',
    evidence: {
      deliveredUrl: asset.presentationUrl,
      qaContext,
    },
    contractHash: order.visualContractHash,
    safetyOverride: false,
    safetyOverrideSha256: null,
    updatedAt: new Date('2026-09-01T19:57:00.000Z'),
  });
  return { page, asset, qaContext };
}

function markCoverUnverified(order: ReturnType<typeof makeOrder>) {
  order.book.coverSafetyVerified = false;
  const qaContext = {
    expectsChild: true,
    expectsCompanion: true,
    expectedPageTimeOfDay: 'night',
    isEmotionalClosing: false,
    hasStructuredObjects: false,
    hasRailedBedOrCrib: false,
    hasHumanFamily: false,
  };
  order.qualityEvidence.push({
    artifactKey: 'cover',
    assetSha256: order.book.coverSafetyContentSha256,
    verdict: 'evidence_unknown',
    evaluatorContractVersion: 'qa-v3',
    reason: 'safety:unverified',
    regenCount: 0,
    providerModel: 'gpt-4o',
    evidence: { deliveredUrl: order.book.coverImageUrl, qaContext },
    contractHash: order.visualContractHash,
    safetyOverride: false,
    safetyOverrideSha256: null,
    updatedAt: new Date('2026-09-01T19:56:00.000Z'),
  });
  return { qaContext };
}

function shaForUrl(url: string): string {
  if (url.endsWith('/cover.png')) return COVER_SHA;
  const match = /page-(\d+)-presentation\.png$/u.exec(url);
  if (!match) throw new Error(`unexpected inspection URL: ${url}`);
  return match[1]!.repeat(64);
}

function makeHarness(
  order = makeOrder(),
  options: { ambiguousAfterCommitFor?: string } = {},
) {
  const receipts = new Map<
    string,
    { payloadHash: string; result: unknown }
  >();
  let ambiguousCommitRaised = false;
  const inspect = vi.fn(async (url: string | null | undefined) => ({
    ok: true,
    bytes: 1024,
    format: 'png',
    mime: 'image/png',
    width: 1024,
    height: 1536,
    sha256: shaForUrl(url ?? ''),
  }));
  const inspectWithBytes = vi.fn(async (url: string | null | undefined) => ({
    ...(await inspect(url)),
    data: Buffer.from('exact-retained-image-bytes'),
  }));
  const tx = {
    $queryRaw: vi.fn(async (...queryArgs: unknown[]) => {
      const query = queryArgs[0] as
        | { strings?: readonly string[] }
        | readonly string[]
        | string;
      const sql =
        typeof query === 'string'
          ? query
          : (query as { strings?: readonly string[] }).strings
            ? (query as { strings: readonly string[] }).strings.join('')
            : (query as readonly string[]).join('');
      if (sql.includes('INSERT INTO "AtomicOperationReceipt"')) {
        const operationKey = String(queryArgs[2]);
        if (receipts.has(operationKey)) return [];
        receipts.set(operationKey, {
          payloadHash: String(queryArgs[5]),
          result: {},
        });
        return [{ id: `receipt-${receipts.size}` }];
      }
      return sql.includes('UPDATE "Order" AS target')
        ? [
            {
              inputVersion: order.inputVersion + 1,
              status: 'generating',
              previousStatus: 'generating',
            },
          ]
        : [];
    }),
    $executeRaw: vi.fn(async () => 1),
    bookReadiness: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    order: {
      findUnique: vi.fn(async () => order),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    generationJob: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    imageAsset: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    generatedBook: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    qualityEvidence: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    atomicOperationReceipt: {
      findUnique: vi.fn(
        async ({ where }: { where: { operationKey: string } }) =>
          receipts.get(where.operationKey) ?? null,
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { operationKey: string };
          data: { result: unknown };
        }) => {
          const receipt = receipts.get(where.operationKey);
          if (!receipt) throw new Error('missing fake atomic receipt');
          receipt.result = data.result;
          return { id: `receipt-${where.operationKey}` };
        },
      ),
    },
  };
  const transaction = vi.fn(async (work: (value: typeof tx) => unknown) => {
    const receiptKeysBefore = new Set(receipts.keys());
    const value = await work(tx);
    const ambiguousKey = [...receipts.keys()].find(
      (key) =>
        !receiptKeysBefore.has(key) &&
        options.ambiguousAfterCommitFor &&
        key.includes(options.ambiguousAfterCommitFor),
    );
    if (ambiguousKey && !ambiguousCommitRaised) {
      ambiguousCommitRaised = true;
      const error = new Error('Transaction not found after commit') as Error & {
        code: string;
      };
      error.code = 'P2028';
      throw error;
    }
    return value;
  });
  const db = {
    order: { findUnique: vi.fn(async () => order) },
    $transaction: transaction,
  };
  return {
    order,
    inspect,
    inspectWithBytes,
    tx,
    transaction,
    db,
    receipts,
  };
}

function deps(harness: ReturnType<typeof makeHarness>) {
  return {
    db: harness.db as never,
    inspect: harness.inspect as never,
    inspectWithBytes: harness.inspectWithBytes as never,
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
  vi.stubEnv('READINESS_MANIFEST_ENABLED', 'false');
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
    expect(first.safetyReverification).toEqual([]);
    expect(first.snapshotDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(harness.inspect).toHaveBeenCalledTimes(14);
    expect(harness.transaction).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('inspects an unverified hazardless retained page as an exact-byte re-verification target without QA or writes', async () => {
    const order = makeOrder();
    const { asset, qaContext } = markPageUnverified(order);
    const harness = makeHarness(order);
    const evaluate = vi.fn();

    const result = await executeReleaseV1Recovery(input('inspect'), {
      ...deps(harness),
      evaluate: evaluate as never,
    });

    expect(result.status).toBe('inspect_ready');
    if (result.status !== 'inspect_ready') throw new Error('unexpected status');
    expect(result.safetyReverification).toEqual([
      expect.objectContaining({
        artifactKey: 'page:6',
        pageNumber: 6,
        sha256: asset.safetyContentSha256,
        qaContextDigest: canonicalJsonDigest(qaContext),
        evaluatorContractVersion: 'qa-v3',
      }),
    ]);
    expect(harness.inspectWithBytes).toHaveBeenCalledTimes(1);
    expect(evaluate).not.toHaveBeenCalled();
    expect(harness.transaction).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('uses the same exact-byte dual-gate path for an eligible retained cover', async () => {
    const order = makeOrder();
    markCoverUnverified(order);
    const harness = makeHarness(order);
    const evaluate = vi.fn().mockResolvedValue(QA_PASSED);
    const recoveryDeps = { ...deps(harness), evaluate: evaluate as never };
    const inspected = await executeReleaseV1Recovery(
      input('inspect'),
      recoveryDeps,
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');
    expect(inspected.safetyReverification).toEqual([
      expect.objectContaining({ artifactKey: 'cover', pageNumber: null }),
    ]);

    const result = await executeReleaseV1Recovery(
      input('apply', inspected.snapshotDigest),
      recoveryDeps,
    );

    expect(result).toMatchObject({ status: 'resumed', dispatched: true });
    expect(harness.tx.generatedBook.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'book-1',
          coverSafetyVerified: false,
          coverSafetyContentSha256: COVER_SHA,
        }),
        data: expect.objectContaining({
          coverSafetyVerified: true,
          coverSafetyHazards: [],
          coverSafetyContentSha256: COVER_SHA,
        }),
      }),
    );
    expect(harness.tx.imageAsset.updateMany).not.toHaveBeenCalled();
    expect(harness.tx.qualityEvidence.updateMany).toHaveBeenCalledTimes(1);
    expect(H.dispatch).toHaveBeenCalledTimes(1);
  });

  it('re-verifies identical retained bytes after two malformed replies, atomically reconciles both gates, bumps input authority, and resumes once', async () => {
    const order = makeOrder();
    const { asset } = markPageUnverified(order);
    const harness = makeHarness(order);
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce(QA_MALFORMED)
      .mockResolvedValueOnce(QA_MALFORMED)
      .mockResolvedValueOnce(QA_PASSED);
    const recoveryDeps = {
      ...deps(harness),
      evaluate: evaluate as never,
    };
    const inspected = await executeReleaseV1Recovery(
      input('inspect'),
      recoveryDeps,
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');

    const result = await executeReleaseV1Recovery(
      input('apply', inspected.snapshotDigest),
      recoveryDeps,
    );

    expect(result).toMatchObject({ status: 'resumed', dispatched: true });
    expect(evaluate).toHaveBeenCalledTimes(3);
    const visionInputs = evaluate.mock.calls.map(([callInput]) => callInput.imageUrl);
    expect(new Set(visionInputs).size).toBe(1);
    expect(visionInputs[0]).toMatch(/^data:image\/png;base64,/u);
    expect(visionInputs[0]).not.toContain(asset.presentationUrl);
    expect(harness.tx.imageAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: asset.id,
          safetyVerified: false,
          safetyContentSha256: asset.safetyContentSha256,
          safetyOverrideSha256: null,
        }),
        data: expect.objectContaining({
          safetyVerified: true,
          safetyHazards: [],
          safetyContentSha256: asset.safetyContentSha256,
          safetyOverriddenHazards: [],
          safetyOverrideSha256: null,
        }),
      }),
    );
    expect(harness.tx.qualityEvidence.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verdict: 'passed',
          reason: null,
          assetSha256: asset.safetyContentSha256,
          safetyOverride: false,
          safetyOverrideSha256: null,
        }),
      }),
    );
    expect(harness.tx.bookReadiness.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.tx.atomicOperationReceipt.update).toHaveBeenCalledTimes(2);
    expect(harness.tx.$queryRaw).toHaveBeenCalledTimes(25);
    expect(H.dispatch).toHaveBeenCalledTimes(1);

    const cachePayload = JSON.parse(
      (
        harness.tx.$executeRaw.mock.calls as unknown as Array<unknown[]>
      )[0]![1] as string,
    ) as {
      releaseRecovery: { attempts: Array<Record<string, unknown>> };
    };
    expect(cachePayload.releaseRecovery.attempts[0]).toMatchObject({
      safetyReverification: [
        expect.objectContaining({
          artifactKey: 'page:6',
          visualVerdict: 'passed',
          safetyStatus: 'safe',
        }),
      ],
    });
  });

  it.each([
    ['persistent malformed evidence', QA_MALFORMED, 3],
    ['skipped vision', QA_SKIPPED, 1],
    ['a verified visual failure', QA_VISUAL_FAILED, 1],
  ])('%s is claimed once but blocks before safety/order mutation and dispatch', async (_label, qa, expectedCalls) => {
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order);
    const evaluate = vi.fn().mockResolvedValue(qa);
    const recoveryDeps = { ...deps(harness), evaluate: evaluate as never };
    const inspected = await executeReleaseV1Recovery(input('inspect'), recoveryDeps);
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');

    await expect(
      executeReleaseV1Recovery(
        input('apply', inspected.snapshotDigest),
        recoveryDeps,
      ),
    ).rejects.toThrow('same-byte safety re-verification did not pass');
    expect(evaluate).toHaveBeenCalledTimes(expectedCalls);
    expect(harness.transaction).toHaveBeenCalledTimes(1);
    expect(harness.tx.imageAsset.updateMany).not.toHaveBeenCalled();
    expect(harness.tx.qualityEvidence.updateMany).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('claims the database snapshot before Vision so a repeated malformed apply spends only one bounded provider sequence', async () => {
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order);
    const evaluate = vi.fn().mockResolvedValue(QA_MALFORMED);
    const recoveryDeps = { ...deps(harness), evaluate: evaluate as never };
    const inspected = await executeReleaseV1Recovery(
      input('inspect'),
      recoveryDeps,
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');
    const apply = input('apply', inspected.snapshotDigest);

    await expect(
      executeReleaseV1Recovery(apply, recoveryDeps),
    ).rejects.toThrow('same-byte safety re-verification did not pass');
    await expect(
      executeReleaseV1Recovery(apply, recoveryDeps),
    ).rejects.toBeInstanceOf(ReleaseV1RecoveryError);

    expect(evaluate).toHaveBeenCalledTimes(3);
    const claimKeys = [...harness.receipts.keys()].filter((key) =>
      key.startsWith('release_v1_safety_eval:release-order:'),
    );
    expect(claimKeys).toHaveLength(1);
    expect(claimKeys[0]).not.toContain(ATTEMPT_ID);
    expect(harness.tx.imageAsset.updateMany).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('keys the pre-Vision claim by database snapshot so different concurrent UUIDs cannot both evaluate', async () => {
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order);
    const evaluate = vi.fn().mockResolvedValue(QA_PASSED);
    const recoveryDeps = { ...deps(harness), evaluate: evaluate as never };
    const firstInspection = await executeReleaseV1Recovery(
      input('inspect'),
      recoveryDeps,
    );
    const secondInspection = await executeReleaseV1Recovery(
      input('inspect', undefined, SECOND_ATTEMPT_ID),
      recoveryDeps,
    );
    if (
      firstInspection.status !== 'inspect_ready' ||
      secondInspection.status !== 'inspect_ready'
    ) {
      throw new Error('unexpected status');
    }
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');

    const results = await Promise.allSettled([
      executeReleaseV1Recovery(
        input('apply', firstInspection.snapshotDigest),
        recoveryDeps,
      ),
      executeReleaseV1Recovery(
        input('apply', secondInspection.snapshotDigest, SECOND_ATTEMPT_ID),
        recoveryDeps,
      ),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(harness.tx.imageAsset.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.tx.order.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.tx.generationJob.updateMany).toHaveBeenCalledTimes(1);
    expect(H.dispatch).toHaveBeenCalledTimes(1);
    const claimKeys = [...harness.receipts.keys()].filter((key) =>
      key.startsWith('release_v1_safety_eval:release-order:'),
    );
    expect(claimKeys).toHaveLength(1);
    expect(claimKeys[0]).not.toContain(ATTEMPT_ID);
    expect(claimKeys[0]).not.toContain(SECOND_ATTEMPT_ID);
  });

  it('durably records a newly confirmed hazard in both gates, never resumes, and cannot later forget the finding', async () => {
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order);
    const evaluate = vi.fn().mockResolvedValue(QA_HAZARD);
    const recoveryDeps = { ...deps(harness), evaluate: evaluate as never };
    const inspected = await executeReleaseV1Recovery(input('inspect'), recoveryDeps);
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');

    await expect(
      executeReleaseV1Recovery(
        input('apply', inspected.snapshotDigest),
        recoveryDeps,
      ),
    ).rejects.toThrow('confirmed a hazard');

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(harness.tx.imageAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          safetyVerified: true,
          safetyHazards: ['unsafe_pose'],
          safetyOverriddenHazards: [],
          safetyOverrideSha256: null,
        }),
      }),
    );
    expect(harness.tx.qualityEvidence.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verdict: 'failed',
          reason: 'safety:unsafe_pose',
        }),
      }),
    );
    expect(harness.tx.order.updateMany).not.toHaveBeenCalled();
    expect(harness.tx.generationJob.updateMany).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('treats any nonempty hazard list as hazardous even when the provider inconsistently labels the status safe', async () => {
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order);
    const evaluate = vi.fn().mockResolvedValue(QA_INCONSISTENT_SAFE_HAZARD);
    const recoveryDeps = { ...deps(harness), evaluate: evaluate as never };
    const inspected = await executeReleaseV1Recovery(
      input('inspect'),
      recoveryDeps,
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');

    await expect(
      executeReleaseV1Recovery(
        input('apply', inspected.snapshotDigest),
        recoveryDeps,
      ),
    ).rejects.toThrow('confirmed a hazard');

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(harness.tx.imageAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          safetyVerified: true,
          safetyHazards: ['unsafe_pose'],
        }),
      }),
    );
    expect(harness.tx.qualityEvidence.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verdict: 'failed',
          reason: 'safety:unsafe_pose',
        }),
      }),
    );
    expect(harness.tx.order.updateMany).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('dispatches exactly once when a safe fenced recovery replays after an ambiguous committed transaction', async () => {
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order, {
      ambiguousAfterCommitFor: 'release_v1_safety_reverification',
    });
    const evaluate = vi.fn().mockResolvedValue(QA_PASSED);
    const recoveryDeps = { ...deps(harness), evaluate: evaluate as never };
    const inspected = await executeReleaseV1Recovery(
      input('inspect'),
      recoveryDeps,
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');

    const result = await executeReleaseV1Recovery(
      input('apply', inspected.snapshotDigest),
      recoveryDeps,
    );

    expect(result).toMatchObject({ status: 'resumed', dispatched: true });
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(harness.tx.imageAsset.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.tx.order.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.tx.generationJob.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.tx.atomicOperationReceipt.findUnique).toHaveBeenCalled();
    expect(
      [...harness.receipts.keys()].filter((key) =>
        key.includes('release_v1_safety_reverification'),
      ),
    ).toHaveLength(1);
    expect(H.dispatch).toHaveBeenCalledTimes(1);
  });

  it('runs required world QA on the identical bytes and blocks a world failure before mutation', async () => {
    const order = makeOrder();
    markPageUnverified(order, 6, {
      worldExpectation: {
        zoneDescription: 'the same moonlit garden gate',
        objects: [{ label: 'gate', identity: 'small pale wooden gate' }],
        forbiddenScenes: ['daylight garden'],
      },
    });
    const harness = makeHarness(order);
    const evaluate = vi.fn().mockResolvedValue(QA_PASSED);
    const evaluateWorld = vi.fn().mockResolvedValue({
      status: 'fail',
      passed: false,
      hardFailures: ['wrong_zone'],
      driftObjects: [],
      notes: '',
    });
    const recoveryDeps = {
      ...deps(harness),
      evaluate: evaluate as never,
      evaluateWorld: evaluateWorld as never,
    };
    const inspected = await executeReleaseV1Recovery(input('inspect'), recoveryDeps);
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');

    await expect(
      executeReleaseV1Recovery(
        input('apply', inspected.snapshotDigest),
        recoveryDeps,
      ),
    ).rejects.toThrow('same-byte world re-verification did not pass');
    expect(evaluateWorld).toHaveBeenCalledTimes(1);
    expect(evaluateWorld.mock.calls[0]![0].imageUrl).toBe(
      evaluate.mock.calls[0]![0].imageUrl,
    );
    expect(harness.transaction).toHaveBeenCalledTimes(1);
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('reserves the world check inside the three-call provider allowance', async () => {
    const order = makeOrder();
    markPageUnverified(order, 6, {
      worldExpectation: {
        zoneDescription: 'the same moonlit garden gate',
        objects: [],
        forbiddenScenes: [],
      },
    });
    const harness = makeHarness(order);
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce(QA_MALFORMED)
      .mockResolvedValueOnce(QA_PASSED);
    const evaluateWorld = vi.fn().mockResolvedValue({
      status: 'pass',
      passed: true,
      hardFailures: [],
      driftObjects: [],
      notes: 'same world',
    });
    const recoveryDeps = {
      ...deps(harness),
      evaluate: evaluate as never,
      evaluateWorld: evaluateWorld as never,
    };
    const inspected = await executeReleaseV1Recovery(
      input('inspect'),
      recoveryDeps,
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');

    const result = await executeReleaseV1Recovery(
      input('apply', inspected.snapshotDigest),
      recoveryDeps,
    );

    expect(result).toMatchObject({ status: 'resumed', dispatched: true });
    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(evaluateWorld).toHaveBeenCalledTimes(1);
    expect(H.dispatch).toHaveBeenCalledTimes(1);
  });

  it('reserves both strict-crib and world follow-ups before granting re-QA', async () => {
    const order = makeOrder();
    markPageUnverified(order, 6, {
      hasRailedBedOrCrib: true,
      worldExpectation: {
        zoneDescription: 'the same moonlit bedroom',
        objects: [],
        forbiddenScenes: [],
      },
    });
    const harness = makeHarness(order);
    const evaluate = vi.fn().mockResolvedValue(QA_MALFORMED);
    const evaluateWorld = vi.fn();
    const recoveryDeps = {
      ...deps(harness),
      evaluate: evaluate as never,
      evaluateWorld: evaluateWorld as never,
    };
    const inspected = await executeReleaseV1Recovery(
      input('inspect'),
      recoveryDeps,
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');

    await expect(
      executeReleaseV1Recovery(
        input('apply', inspected.snapshotDigest),
        recoveryDeps,
      ),
    ).rejects.toThrow('same-byte safety re-verification did not pass');

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluateWorld).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('loses closed on locked evidence drift or the exact asset CAS and never partially resumes', async () => {
    const driftOrder = makeOrder();
    markPageUnverified(driftOrder);
    const driftHarness = makeHarness(driftOrder);
    const driftEvaluate = vi.fn().mockResolvedValue(QA_PASSED);
    const driftDeps = {
      ...deps(driftHarness),
      evaluate: driftEvaluate as never,
    };
    const driftInspection = await executeReleaseV1Recovery(
      input('inspect'),
      driftDeps,
    );
    if (driftInspection.status !== 'inspect_ready') throw new Error('unexpected status');
    driftHarness.tx.order.findUnique.mockResolvedValue({
      ...driftOrder,
      qualityEvidence: driftOrder.qualityEvidence.map((row) => ({
        ...row,
        updatedAt: new Date(row.updatedAt.getTime() + 1),
      })),
    });
    await expect(
      executeReleaseV1Recovery(
        input('apply', driftInspection.snapshotDigest),
        driftDeps,
      ),
    ).rejects.toThrow('database snapshot changed');
    expect(driftHarness.tx.imageAsset.updateMany).not.toHaveBeenCalled();
    expect(driftHarness.tx.order.updateMany).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();

    vi.clearAllMocks();
    H.buildContinuity.mockReturnValue(TARGET_CONTINUITY);
    H.requireExpectedBinding.mockReturnValue(BINDING);
    const casOrder = makeOrder();
    markPageUnverified(casOrder);
    const casHarness = makeHarness(casOrder);
    const casEvaluate = vi.fn().mockResolvedValue(QA_PASSED);
    const casDeps = { ...deps(casHarness), evaluate: casEvaluate as never };
    const casInspection = await executeReleaseV1Recovery(
      input('inspect'),
      casDeps,
    );
    if (casInspection.status !== 'inspect_ready') throw new Error('unexpected status');
    casHarness.tx.imageAsset.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      executeReleaseV1Recovery(
        input('apply', casInspection.snapshotDigest),
        casDeps,
      ),
    ).rejects.toThrow('retained page safety CAS lost');
    expect(casHarness.tx.qualityEvidence.updateMany).not.toHaveBeenCalled();
    expect(casHarness.tx.order.updateMany).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('never re-verifies a retained asset with an existing confirmed hazard or invalid stored context', async () => {
    const hazardOrder = makeOrder();
    const { asset } = markPageUnverified(hazardOrder);
    asset.safetyVerified = true;
    asset.safetyHazards = ['unsafe_pose'];
    const hazardHarness = makeHarness(hazardOrder);
    await expect(
      executeReleaseV1Recovery(input('inspect'), deps(hazardHarness)),
    ).rejects.toThrow('confirmed safety hazards');
    expect(hazardHarness.inspectWithBytes).not.toHaveBeenCalled();

    const contextOrder = makeOrder();
    markPageUnverified(contextOrder);
    contextOrder.qualityEvidence[0]!.evidence = null;
    const contextHarness = makeHarness(contextOrder);
    await expect(
      executeReleaseV1Recovery(input('inspect'), deps(contextHarness)),
    ).rejects.toThrow('stored QA context is missing or invalid');
    expect(contextHarness.inspectWithBytes).not.toHaveBeenCalled();
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
    expect(harness.tx.$queryRaw).toHaveBeenCalledTimes(11);
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
