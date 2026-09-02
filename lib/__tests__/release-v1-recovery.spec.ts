import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import type { PageVisualQaResult } from '@/lib/generation-pipeline/page-visual-qa';
import { shouldSkipPaidPageImageRegen } from '@/lib/generation-chunked/paid-artifact-guard';
import { pageAssetOperationKey } from '@/lib/generation-pipeline/contract-hash-binding';

const H = vi.hoisted(() => ({
  requireExpectedBinding: vi.fn(),
  buildContinuity: vi.fn(),
  dispatch: vi.fn(),
  probeWorker: vi.fn(),
  qualifyRender: vi.fn(),
  assertBoards: vi.fn(),
  bookFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { generatedBook: { findUnique: H.bookFindUnique } },
}));
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
  RELEASE_V1_PAGE_RERENDER_REASON,
  executeReleaseV1Recovery,
  parseReleaseV1RecoveryInput,
} from '@/lib/generation-pipeline/release-v1-recovery';

const NOW = new Date('2026-09-01T20:00:00.000Z');
const ATTEMPT_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const FRESH_REVIEW_PROJECTION = {
  reviewStatus: null,
  reviewedAssetSha256: null,
  reviewedContractHash: null,
  reviewedBy: null,
  reviewedAt: null,
  reviewReason: null,
};
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

function rerenderInput(
  mode: 'inspect' | 'apply',
  digest?: string,
  recoveryAttemptId = SECOND_ATTEMPT_ID,
  pageNumber = 6,
) {
  return {
    ...input(mode, digest, recoveryAttemptId),
    reason: RELEASE_V1_PAGE_RERENDER_REASON,
    rerenderPageNumbers: [pageNumber],
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
              rawUrl: null,
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
    audioEnabled: true,
    videoEnabled: false,
    bundleEnabled: false,
    selectedVoice: 'dad_v2' as string | null,
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
        characterAnchorStore: {
          child: {
            orderId: 'release-order',
            styleId: 'soft_hand_drawn_storybook',
            characterId: 'child',
            role: 'child',
            anchorType: 'canonical_portrait',
            source: 'uploaded_photo',
            url: `${BUCKET_PREFIX}/orders/release-order/child-anchor.png`,
            qaStatus: 'passed',
            createdAt: NOW.toISOString(),
            updatedAt: NOW.toISOString(),
          },
        },
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
        scope: 'base_book',
        kind: 'infra_transient',
        status: 'open',
        reason: 'generation failed transiently',
        attempts: 5,
        nextActionAt: new Date('2026-09-01T19:58:30.000Z') as Date | null,
        actionAttemptedAt: null as Date | null,
        notificationAttemptedAt: null as Date | null,
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
  options: {
    ambiguousAfterCommitFor?: string;
    rollbackThenConcurrentWinnerFor?: string;
  } = {},
) {
  const receipts = new Map<
    string,
    {
      operationKey: string;
      orderId: string;
      kind: string;
      payloadHash: string;
      result: unknown;
      createdAt: Date;
    }
  >();
  const recoveryOrderView = () => ({
    ...order,
    exceptionCases: order.exceptionCases.filter((row) =>
      ['open', 'retry_scheduled', 'customer_action', 'refund_pending'].includes(row.status),
    ),
  });
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
          operationKey,
          orderId: String(queryArgs[3]),
          kind: String(queryArgs[4]),
          payloadHash: String(queryArgs[5]),
          result: {},
          createdAt: NOW,
        });
        return [{ id: `receipt-${receipts.size}` }];
      }
      if (sql.includes('FROM "Order"') && sql.includes('FOR UPDATE')) {
        return [{ id: order.id }];
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
      findUnique: vi.fn(async () => recoveryOrderView()),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    generationJob: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    exceptionCase: {
      findUnique: vi.fn(async ({ where }: { where: { activeKey: string } }) => {
        const activeKey = `${order.id}:base_book`;
        if (where.activeKey !== activeKey) return null;
        const row = order.exceptionCases.find((candidate) =>
          ['open', 'retry_scheduled', 'customer_action', 'refund_pending'].includes(candidate.status),
        );
        return row ? { ...row } : null;
      }),
      updateMany: vi.fn(async ({
        where,
        data,
      }: {
        where: { id: string; claimVersion: number; status: string };
        data: Record<string, unknown>;
      }) => {
        const row = order.exceptionCases.find((candidate) =>
          candidate.id === where.id &&
          candidate.claimVersion === where.claimVersion &&
          candidate.status === where.status,
        );
        if (!row) return { count: 0 };
        row.status = String(data.status);
        row.claimVersion += 1;
        row.nextActionAt = null;
        row.leaseExpiresAt = null;
        return { count: 1 };
      }),
    },
    exceptionCaseAudit: {
      create: vi.fn(async () => ({})),
    },
    imageAsset: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    generatedBook: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    qualityEvidence: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    pageUploadCandidate: {
      deleteMany: vi.fn(async ({ where }: { where: { pageNumber: number } }) => ({
        count: order.pageUploadCandidates.some(
          (candidate) => candidate.pageNumber === where.pageNumber,
        )
          ? 1
          : 0,
      })),
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
      deleteMany: vi.fn(
        async ({ where }: { where: { operationKey: string } }) => {
          const deleted = receipts.delete(where.operationKey);
          return { count: deleted ? 1 : 0 };
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
    const concurrentWinnerKey = [...receipts.keys()].find(
      (key) =>
        !receiptKeysBefore.has(key) &&
        options.rollbackThenConcurrentWinnerFor &&
        key.includes(options.rollbackThenConcurrentWinnerFor),
    );
    if (concurrentWinnerKey && !ambiguousCommitRaised) {
      ambiguousCommitRaised = true;
      const inserted = receipts.get(concurrentWinnerKey)!;
      // Simulate this transaction rolling back while another invocation commits
      // the same operation and records its own dispatch-ownership token.
      receipts.set(concurrentWinnerKey, {
        ...inserted,
        payloadHash: inserted.payloadHash,
        result: { value: 'concurrent-winner-dispatch-token' },
      });
      const error = new Error('Transaction not found after rollback') as Error & {
        code: string;
      };
      error.code = 'P2028';
      throw error;
    }
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
    order: { findUnique: vi.fn(async () => recoveryOrderView()) },
    atomicOperationReceipt: tx.atomicOperationReceipt,
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
    probeWorker: H.probeWorker,
    qualifyRender: H.qualifyRender,
    assertBoards: H.assertBoards,
    now: () => NOW,
    env: {
      VERCEL_URL: 'fixed-preview.vercel.app',
      NEXT_PUBLIC_APP_URL: 'https://fixed-preview.vercel.app',
      STYLE_01_GPT_MODEL: 'gpt-image-2',
      GPT_IMAGE_QUALITY: 'low',
      PAGE_VISUAL_QA_ENABLED: 'true',
      QA_SOFT_DELIVER: 'false',
      RESEMBLANCE_BASE_THRESHOLD: '0.72',
      GENERATION_SECRET: 'test-generation-secret',
      PHASE2_STYLE01_BOOK_PIPELINE: 'true',
      DISABLE_IMAGE_GENERATION: 'false',
      OPENAI_API_KEY: 'test-openai-key',
      SUPABASE_URL: SUPABASE_ORIGIN,
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
      SUPABASE_STORAGE_BUCKET: 'book-images',
      ELEVENLABS_API_KEY: 'test-elevenlabs-key',
      VERCEL_AUTOMATION_BYPASS_SECRET: 'test-preview-bypass-secret',
      READINESS_MANIFEST_ENABLED:
        process.env.READINESS_MANIFEST_ENABLED ?? 'false',
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
  H.probeWorker.mockResolvedValue(undefined);
  H.qualifyRender.mockReturnValue({ version: 'style01-runtime-authority/v7' });
  H.assertBoards.mockResolvedValue(undefined);
  H.bookFindUnique.mockResolvedValue({ coverImageUrl: `${BUCKET_PREFIX}/cover.png` });
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

  it('parses the distinct one-page re-render grammar without widening legacy recovery', () => {
    expect(parseReleaseV1RecoveryInput(rerenderInput('inspect'))).toMatchObject({
      reason: RELEASE_V1_PAGE_RERENDER_REASON,
      rerenderPageNumbers: [6],
    });
    expect(() =>
      parseReleaseV1RecoveryInput({
        ...rerenderInput('inspect'),
        rerenderPageNumbers: [],
      }),
    ).toThrow('exactly one page');
    expect(() =>
      parseReleaseV1RecoveryInput({
        ...rerenderInput('inspect'),
        rerenderPageNumbers: [5, 6],
      }),
    ).toThrow('exactly one page');
    expect(() =>
      parseReleaseV1RecoveryInput({
        ...input('inspect'),
        rerenderPageNumbers: [6],
      }),
    ).toThrow('request body keys are invalid');
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

  it('inspects one eligible page re-render using only byte metadata and plans pages 6-8', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    const order = makeOrder();
    const { asset, qaContext } = markPageUnverified(order);
    order.pageUploadCandidates.push({
      id: 'candidate-6',
      pageNumber: 6,
      url: asset.url,
      rawUrl: asset.rawUrl,
      provider: asset.provider,
      createdAt: new Date('2026-09-01T19:55:00.000Z'),
      updatedAt: new Date('2026-09-01T19:55:30.000Z'),
    });
    const harness = makeHarness(order);
    const evaluate = vi.fn();
    const evaluateWorld = vi.fn();

    const result = await executeReleaseV1Recovery(rerenderInput('inspect'), {
      ...deps(harness),
      evaluate: evaluate as never,
      evaluateWorld: evaluateWorld as never,
    });

    expect(result.status).toBe('inspect_ready');
    if (result.status !== 'inspect_ready') throw new Error('unexpected status');
    expect(result.safetyReverification).toEqual([]);
    expect(result.pageRerender).toEqual({
      targets: [
        expect.objectContaining({
          artifactKey: 'page:6',
          pageNumber: 6,
          assetId: asset.id,
          sha256: asset.safetyContentSha256,
          qaContextDigest: canonicalJsonDigest(qaContext),
          candidateId: 'candidate-6',
        }),
      ],
      resumeInventory: {
        completedPageNumbers: [1, 2, 3, 4, 5],
        missingPageNumbers: [6, 7, 8],
      },
      effectiveResemblanceThreshold: 0.7,
      readerBaseUrl: 'https://fixed-preview.vercel.app',
    });
    expect(harness.inspect).toHaveBeenCalledTimes(7);
    expect(harness.inspectWithBytes).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
    expect(evaluateWorld).not.toHaveBeenCalled();
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
          ...FRESH_REVIEW_PROJECTION,
        }),
      }),
    );
    expect(harness.tx.bookReadiness.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.tx.atomicOperationReceipt.update).toHaveBeenCalledTimes(2);
    expect(harness.tx.$queryRaw).toHaveBeenCalledTimes(29);
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

  it('atomically resolves the due near-budget generation exception, invalidates only page 6, and resumes without provider QA', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    const order = makeOrder();
    const { asset } = markPageUnverified(order);
    order.pageUploadCandidates.push({
      id: 'candidate-6',
      pageNumber: 6,
      url: asset.url,
      rawUrl: asset.rawUrl,
      provider: asset.provider,
      createdAt: new Date('2026-09-01T19:55:00.000Z'),
      updatedAt: new Date('2026-09-01T19:55:30.000Z'),
    });
    const harness = makeHarness(order);
    const evaluate = vi.fn(async () => {
      throw new Error('Vision must not run for page re-render recovery');
    });
    const evaluateWorld = vi.fn(async () => {
      throw new Error('world QA must not run for page re-render recovery');
    });
    const recoveryDeps = {
      ...deps(harness),
      evaluate: evaluate as never,
      evaluateWorld: evaluateWorld as never,
    };
    const inspected = await executeReleaseV1Recovery(
      rerenderInput('inspect'),
      recoveryDeps,
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');

    const result = await executeReleaseV1Recovery(
      rerenderInput('apply', inspected.snapshotDigest),
      recoveryDeps,
    );

    expect(result).toMatchObject({
      status: 'resumed',
      dispatched: true,
      orderId: 'release-order',
      rerenderedPageNumbers: [6],
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(evaluateWorld).not.toHaveBeenCalled();
    expect(harness.inspectWithBytes).not.toHaveBeenCalled();
    expect(harness.tx.imageAsset.updateMany).not.toHaveBeenCalled();
    expect(harness.tx.imageAsset.deleteMany).toHaveBeenCalledTimes(1);
    expect(harness.tx.exceptionCase.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'exception-1',
        claimVersion: 0,
        status: 'open',
      },
      data: expect.objectContaining({
        status: 'resolved',
        activeKey: null,
        nextActionAt: null,
        leaseExpiresAt: null,
        claimVersion: { increment: 1 },
        resolution: {
          outcome: 'recovered',
          reason: `release_v1_reviewed_recovery:${SECOND_ATTEMPT_ID}`,
        },
      }),
    });
    expect(harness.tx.exceptionCaseAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: 'exception-1',
        fromStatus: 'open',
        toStatus: 'resolved',
        reason: `release_v1_reviewed_recovery:${SECOND_ATTEMPT_ID}`,
      }),
    });
    expect(order.exceptionCases[0]).toMatchObject({
      status: 'resolved',
      claimVersion: 1,
      nextActionAt: null,
      leaseExpiresAt: null,
    });
    expect(harness.tx.imageAsset.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: asset.id,
        pageId: 'page-6',
        url: asset.url,
        presentationUrl: asset.presentationUrl,
        idempotencyKey: asset.idempotencyKey,
        safetyVerified: false,
        safetyContentSha256: asset.safetyContentSha256,
        safetyOverrideSha256: null,
      }),
    });
    expect(harness.tx.pageUploadCandidate.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'candidate-6',
        orderId: 'release-order',
        pageNumber: 6,
      }),
    });
    expect(harness.tx.qualityEvidence.updateMany).toHaveBeenCalledTimes(1);
    const evidenceMutation = (
      harness.tx.qualityEvidence.updateMany.mock.calls as unknown as Array<
        [{ data: Record<string, unknown> }]
      >
    )[0]![0];
    expect(evidenceMutation.data).toMatchObject({
      assetSha256: '',
      verdict: 'evidence_unknown',
      reason: 'recovery:rerender_pending',
      safetyOverride: false,
      safetyOverrideSha256: null,
      ...FRESH_REVIEW_PROJECTION,
      evidence: expect.objectContaining({
        releaseV1PageRerender: expect.objectContaining({
          recoveryAttemptId: SECOND_ATTEMPT_ID,
          previousAssetId: asset.id,
          previousAssetSha256: asset.safetyContentSha256,
        }),
      }),
    });
    expect(evidenceMutation.data).not.toHaveProperty('regenCount');

    const jobMutation = (
      harness.tx.generationJob.updateMany.mock.calls as unknown as Array<
        [{ data: Record<string, unknown> }]
      >
    )[0]![0];
    expect(jobMutation.data).toMatchObject({
      status: 'pending',
      currentStage: 'pending',
      imagesDone: false,
      completedPageNumbers: [1, 2, 3, 4, 5],
      failedPageNumbers: [],
      pageAttempts: {},
      triggerReason: `release_v1_page_rerender:${SECOND_ATTEMPT_ID}`,
    });
    const cachePayload = JSON.parse(
      (
        harness.tx.$executeRaw.mock.calls as unknown as Array<unknown[]>
      )[0]![1] as string,
    ) as {
      releaseRecovery: { attempts: Array<Record<string, unknown>> };
    };
    expect(cachePayload.releaseRecovery.attempts[0]).toMatchObject({
      version: 'release-v1-page-rerender-attempt/v1',
      reason: RELEASE_V1_PAGE_RERENDER_REASON,
      rerenderedArtifacts: [
        expect.objectContaining({
          artifactKey: 'page:6',
          pageNumber: 6,
          assetId: asset.id,
          candidateId: 'candidate-6',
          sourceUrl: asset.url,
          presentationUrl: asset.presentationUrl,
          rawUrl: asset.rawUrl,
          deliveredUrl: asset.presentationUrl,
          provider: asset.provider,
          idempotencyKey: asset.idempotencyKey,
        }),
      ],
      effectiveResemblanceThreshold: 0.7,
      previousJobProgress: {
        completedPageNumbers: [1, 2, 3, 4, 5, 6],
        failedPageNumbers: [7],
        pageAttempts: { '7': 3 },
      },
    });
    const { requiresReleaseV1PageResemblanceGate } = await import(
      '@/lib/generation-pipeline/chunk-runner'
    );
    expect(
      requiresReleaseV1PageResemblanceGate(cachePayload as never),
    ).toBe(true);
    expect(H.dispatch).toHaveBeenCalledTimes(1);
    expect(H.dispatch).toHaveBeenCalledWith(
      'release-order',
      TARGET_CONTINUITY,
    );
  });

  it('loses closed when the exception processor claims the due case between Inspect and the locked Apply snapshot', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order);
    const recoveryDeps = deps(harness);
    const inspected = await executeReleaseV1Recovery(
      rerenderInput('inspect'),
      recoveryDeps,
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');

    harness.tx.order.findUnique.mockImplementationOnce(async () => {
      order.exceptionCases[0]!.status = 'retry_scheduled';
      order.exceptionCases[0]!.claimVersion = 1;
      order.exceptionCases[0]!.leaseExpiresAt = new Date('2026-09-02T10:05:00.000Z');
      order.exceptionCases[0]!.updatedAt = new Date('2026-09-02T10:00:01.000Z');
      return order;
    });

    await expect(
      executeReleaseV1Recovery(
        rerenderInput('apply', inspected.snapshotDigest),
        recoveryDeps,
      ),
    ).rejects.toThrow('database snapshot changed after retained-byte inspection');
    expect(harness.tx.exceptionCase.updateMany).not.toHaveBeenCalled();
    expect(harness.tx.imageAsset.deleteMany).not.toHaveBeenCalled();
    expect(harness.tx.order.updateMany).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('rejects page re-render eligibility drift before any destructive write', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    const cases: Array<{
      label: string;
      mutate: (order: ReturnType<typeof makeOrder>) => void;
      message: string;
    }> = [
      {
        label: 'already-safe target',
        mutate: () => undefined,
        message: 'not an eligible safety-unverified artifact',
      },
      {
        label: 'passed evidence',
        mutate: (order) => {
          markPageUnverified(order);
          order.qualityEvidence[0]!.verdict = 'passed';
        },
        message: 'must have safety-unverified quality evidence',
      },
      {
        label: 'mismatched delivered URL',
        mutate: (order) => {
          markPageUnverified(order);
          order.qualityEvidence[0]!.evidence = {
            ...order.qualityEvidence[0]!.evidence,
            deliveredUrl: `${BUCKET_PREFIX}/different.png`,
          };
        },
        message: 'bound to a different delivered URL',
      },
      {
        label: 'second unverified artifact',
        mutate: (order) => {
          markPageUnverified(order);
          markPageUnverified(order, 5);
        },
        message: 'sole unverified artifact',
      },
      {
        label: 'mismatched upload candidate',
        mutate: (order) => {
          const { asset } = markPageUnverified(order);
          order.pageUploadCandidates.push({
            id: 'candidate-6',
            pageNumber: 6,
            url: `${asset.url}-different`,
            rawUrl: asset.rawUrl,
            provider: asset.provider,
            createdAt: NOW,
            updatedAt: NOW,
          });
        },
        message: 'upload candidate differs',
      },
      {
        label: 'missing worker child DNA',
        mutate: (order) => {
          order.generationJob.pipelineCache.dna = { childDNA: '' };
          markPageUnverified(order);
        },
        message: 'generation child DNA is missing',
      },
      {
        label: 'missing approved canonical anchor',
        mutate: (order) => {
          delete order.generationJob.pipelineCache.characterAnchorStore;
          markPageUnverified(order);
        },
        message: 'approved child canonical anchor is missing',
      },
    ];

    for (const testCase of cases) {
      const order = makeOrder();
      testCase.mutate(order);
      const harness = makeHarness(order);
      await expect(
        executeReleaseV1Recovery(rerenderInput('inspect'), deps(harness)),
        testCase.label,
      ).rejects.toThrow(testCase.message);
      expect(harness.tx.imageAsset.deleteMany).not.toHaveBeenCalled();
      expect(harness.tx.qualityEvidence.updateMany).not.toHaveBeenCalled();
      expect(harness.tx.order.updateMany).not.toHaveBeenCalled();
    }
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('requires the exact frozen render and Board preflights before page deletion', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    for (const testCase of [
      {
        message: 'frozen render qualification failed',
        arrange: () =>
          H.qualifyRender.mockImplementationOnce(() => {
            throw new Error('invalid frozen projection');
          }),
      },
      {
        message: 'set identity boards are not render-ready',
        arrange: () =>
          H.assertBoards.mockRejectedValueOnce(new Error('board bytes drifted')),
      },
    ]) {
      const order = makeOrder();
      markPageUnverified(order);
      const harness = makeHarness(order);
      testCase.arrange();

      await expect(
        executeReleaseV1Recovery(rerenderInput('inspect'), deps(harness)),
      ).rejects.toThrow(testCase.message);
      expect(harness.transaction).not.toHaveBeenCalled();
      expect(harness.tx.imageAsset.deleteMany).not.toHaveBeenCalled();
      expect(H.dispatch).not.toHaveBeenCalled();
    }
  });

  it('requires the receipt fence, LOW quality, and non-audition worker mode', async () => {
    const order = makeOrder();
    markPageUnverified(order);
    const cases = [
      {
        env: {
          VERCEL_URL: 'fixed-preview.vercel.app',
          STYLE_01_GPT_MODEL: 'gpt-image-2',
          GPT_IMAGE_QUALITY: 'low',
          RESEMBLANCE_BASE_THRESHOLD: '0.72',
          GENERATION_SECRET: 'test-generation-secret',
          PHASE2_STYLE01_BOOK_PIPELINE: 'true',
          VERCEL_AUTOMATION_BYPASS_SECRET: 'test-preview-bypass-secret',
          READINESS_MANIFEST_ENABLED: 'false',
        },
        message: 'READINESS_MANIFEST_ENABLED must be true',
      },
      {
        env: {
          VERCEL_URL: 'fixed-preview.vercel.app',
          STYLE_01_GPT_MODEL: 'gpt-image-2',
          GPT_IMAGE_QUALITY: 'high',
          RESEMBLANCE_BASE_THRESHOLD: '0.72',
          GENERATION_SECRET: 'test-generation-secret',
          PHASE2_STYLE01_BOOK_PIPELINE: 'true',
          VERCEL_AUTOMATION_BYPASS_SECRET: 'test-preview-bypass-secret',
          READINESS_MANIFEST_ENABLED: 'true',
        },
        message: 'restricted to low image quality',
      },
      {
        env: {
          VERCEL_URL: 'fixed-preview.vercel.app',
          STYLE_01_GPT_MODEL: 'gpt-image-2',
          GPT_IMAGE_QUALITY: 'low',
          RESEMBLANCE_BASE_THRESHOLD: '0.72',
          GENERATION_SECRET: 'test-generation-secret',
          PHASE2_STYLE01_BOOK_PIPELINE: 'true',
          VERCEL_AUTOMATION_BYPASS_SECRET: 'test-preview-bypass-secret',
          READINESS_MANIFEST_ENABLED: 'true',
          STYLE_01_AUDITION_MODE: 'true',
        },
        message: 'STYLE_01_AUDITION_MODE must be disabled',
      },
      {
        env: {
          VERCEL_URL: 'fixed-preview.vercel.app',
          STYLE_01_GPT_MODEL: 'gpt-image-2',
          GPT_IMAGE_QUALITY: 'low',
          RESEMBLANCE_BASE_THRESHOLD: '0.72',
          GENERATION_SECRET: 'test-generation-secret',
          PHASE2_STYLE01_BOOK_PIPELINE: 'true',
          VERCEL_AUTOMATION_BYPASS_SECRET: '',
          READINESS_MANIFEST_ENABLED: 'true',
        },
        message: 'VERCEL_AUTOMATION_BYPASS_SECRET is required',
      },
      {
        env: {
          VERCEL_URL: 'fixed-preview.vercel.app',
          STYLE_01_GPT_MODEL: 'gpt-image-2',
          GPT_IMAGE_QUALITY: 'low',
          RESEMBLANCE_BASE_THRESHOLD: '0.70',
          GENERATION_SECRET: 'test-generation-secret',
          PHASE2_STYLE01_BOOK_PIPELINE: 'true',
          VERCEL_AUTOMATION_BYPASS_SECRET: 'test-preview-bypass-secret',
          READINESS_MANIFEST_ENABLED: 'true',
        },
        message: 'effective resemblance threshold of 0.70',
      },
      {
        env: {
          VERCEL_URL: 'fixed-preview.vercel.app',
          STYLE_01_GPT_MODEL: 'gpt-image-2',
          GPT_IMAGE_QUALITY: 'low',
          RESEMBLANCE_BASE_THRESHOLD: '0.72',
          PHASE2_STYLE01_BOOK_PIPELINE: 'true',
          GENERATION_SECRET: '',
          VERCEL_AUTOMATION_BYPASS_SECRET: 'test-preview-bypass-secret',
          READINESS_MANIFEST_ENABLED: 'true',
        },
        message: 'GENERATION_SECRET is required',
      },
      {
        env: {
          VERCEL_URL: 'fixed-preview.vercel.app',
          STYLE_01_GPT_MODEL: 'gpt-image-2',
          GPT_IMAGE_QUALITY: 'low',
          RESEMBLANCE_BASE_THRESHOLD: '0.72',
          GENERATION_SECRET: 'test-generation-secret',
          PHASE2_STYLE01_BOOK_PIPELINE: 'false',
          VERCEL_AUTOMATION_BYPASS_SECRET: 'test-preview-bypass-secret',
          READINESS_MANIFEST_ENABLED: 'true',
        },
        message: 'PHASE2_STYLE01_BOOK_PIPELINE must be true',
      },
      {
        env: { OPENAI_API_KEY: '' },
        message: 'OPENAI_API_KEY is required',
      },
      {
        env: { DISABLE_IMAGE_GENERATION: 'true' },
        message: 'DISABLE_IMAGE_GENERATION must be false',
      },
      {
        env: {
          GPT_IMAGE_QUALITY: 'LOW',
          READINESS_MANIFEST_ENABLED: 'true',
        },
        message: 'GPT_IMAGE_QUALITY must be exactly low',
      },
      {
        env: {
          GPT_IMAGE_QUALITY: undefined,
          READINESS_MANIFEST_ENABLED: 'true',
        },
        message: 'GPT_IMAGE_QUALITY must be exactly low',
      },
      {
        env: {
          GPT_IMAGE_QUALITY: '',
          READINESS_MANIFEST_ENABLED: 'true',
        },
        message: 'GPT_IMAGE_QUALITY must be exactly low',
      },
      {
        env: { PAGE_VISUAL_QA_ENABLED: 'false' },
        message: 'PAGE_VISUAL_QA_ENABLED must be explicitly true',
      },
      {
        env: { QA_SOFT_DELIVER: 'true' },
        message: 'QA_SOFT_DELIVER must be explicitly false',
      },
      {
        env: { NEXT_PUBLIC_APP_URL: '' },
        message: 'NEXT_PUBLIC_APP_URL must be an exact HTTPS reader origin',
      },
      {
        env: { NEXT_PUBLIC_APP_URL: 'http://fixed-preview.vercel.app' },
        message: 'NEXT_PUBLIC_APP_URL must be an exact HTTPS reader origin',
      },
      {
        env: { ELEVENLABS_API_KEY: '' },
        message: 'ELEVENLABS_API_KEY is required for this audio-enabled recovery',
      },
      {
        env: { PHASE2_STYLE01_REF_CONFIG: 'B' },
        message: 'effective PHASE2_STYLE01_REF_CONFIG must be A',
      },
      {
        env: {
          PHASE2_STYLE01_REF_CONFIG: undefined,
          PHASE2_STYLE02_REF_CONFIG: 'B',
        },
        message: 'effective PHASE2_STYLE01_REF_CONFIG must be A',
      },
    ];

    for (const testCase of cases) {
      const harness = makeHarness(order);
      await expect(
        executeReleaseV1Recovery(rerenderInput('inspect'), {
          ...deps(harness),
          env: {
            ...deps(harness).env,
            ...testCase.env,
          } as unknown as NodeJS.ProcessEnv,
        }),
      ).rejects.toThrow(testCase.message);
      expect(harness.inspect).not.toHaveBeenCalled();
      expect(harness.transaction).not.toHaveBeenCalled();
    }
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('does not require ElevenLabs for a product that has no selected audio output', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    const order = makeOrder();
    order.audioEnabled = false;
    order.videoEnabled = false;
    order.bundleEnabled = false;
    order.selectedVoice = null;
    markPageUnverified(order);
    const harness = makeHarness(order);

    await expect(
      executeReleaseV1Recovery(rerenderInput('inspect'), {
        ...deps(harness),
        env: {
          ...deps(harness).env,
          ELEVENLABS_API_KEY: '',
        } as NodeJS.ProcessEnv,
      }),
    ).resolves.toMatchObject({ status: 'inspect_ready' });
    expect(harness.transaction).not.toHaveBeenCalled();
  });

  it('fails closed before mutation when the protected release/v1 worker probe fails', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order);
    H.probeWorker.mockRejectedValueOnce(new Error('protected edge rejected'));

    await expect(
      executeReleaseV1Recovery(rerenderInput('inspect'), deps(harness)),
    ).rejects.toThrow(
      'protected Preview release/v1 worker reachability probe failed',
    );

    expect(H.probeWorker).toHaveBeenCalledWith(
      TARGET_CONTINUITY,
      expect.objectContaining({
        VERCEL_AUTOMATION_BYPASS_SECRET: 'test-preview-bypass-secret',
      }),
    );
    expect(harness.transaction).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('repeats the protected worker probe on Apply and blocks if it changed after Inspect', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order);

    const inspected = await executeReleaseV1Recovery(
      rerenderInput('inspect'),
      deps(harness),
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');
    H.probeWorker.mockRejectedValueOnce(new Error('bypass rotated'));

    await expect(
      executeReleaseV1Recovery(
        rerenderInput('apply', inspected.snapshotDigest),
        deps(harness),
      ),
    ).rejects.toThrow(
      'protected Preview release/v1 worker reachability probe failed',
    );

    expect(H.probeWorker).toHaveBeenCalledTimes(2);
    expect(harness.transaction).not.toHaveBeenCalled();
    expect(harness.tx.imageAsset.deleteMany).not.toHaveBeenCalled();
    expect(harness.tx.qualityEvidence.updateMany).not.toHaveBeenCalled();
    expect(harness.tx.order.updateMany).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('repeats the dispatch environment-separation guard on Apply before clearing the page', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order);

    const inspected = await executeReleaseV1Recovery(
      rerenderInput('inspect'),
      deps(harness),
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');

    await expect(
      executeReleaseV1Recovery(
        rerenderInput('apply', inspected.snapshotDigest),
        {
          ...deps(harness),
          env: {
            ...deps(harness).env,
            VERCEL_ENV: 'preview',
            NEXT_PUBLIC_APP_URL: 'https://smallheroes.co.il',
          } as NodeJS.ProcessEnv,
        },
      ),
    ).rejects.toThrow('[env-separation] Refusing to run');

    expect(H.probeWorker).toHaveBeenCalledTimes(1);
    expect(harness.transaction).not.toHaveBeenCalled();
    expect(harness.tx.imageAsset.deleteMany).not.toHaveBeenCalled();
    expect(harness.tx.qualityEvidence.updateMany).not.toHaveBeenCalled();
    expect(harness.tx.order.updateMany).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('binds the exact HTTPS reader origin across Inspect and Apply', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order);

    const inspected = await executeReleaseV1Recovery(
      rerenderInput('inspect'),
      deps(harness),
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');
    expect(inspected.pageRerender?.readerBaseUrl).toBe(
      'https://fixed-preview.vercel.app',
    );

    await expect(
      executeReleaseV1Recovery(
        rerenderInput('apply', inspected.snapshotDigest),
        {
          ...deps(harness),
          env: {
            ...deps(harness).env,
            NEXT_PUBLIC_APP_URL: 'https://other-reader-preview.example',
          } as NodeJS.ProcessEnv,
        },
      ),
    ).rejects.toThrow('snapshot changed after inspection');

    expect(harness.transaction).not.toHaveBeenCalled();
    expect(harness.tx.imageAsset.deleteMany).not.toHaveBeenCalled();
    expect(harness.tx.qualityEvidence.updateMany).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('rolls back a page re-render CAS loss and never resumes or dispatches', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order);
    const inspected = await executeReleaseV1Recovery(
      rerenderInput('inspect'),
      deps(harness),
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');
    harness.tx.imageAsset.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      executeReleaseV1Recovery(
        rerenderInput('apply', inspected.snapshotDigest),
        deps(harness),
      ),
    ).rejects.toThrow('page re-render asset compare-and-swap lost');
    expect(harness.tx.pageUploadCandidate.deleteMany).not.toHaveBeenCalled();
    expect(harness.tx.qualityEvidence.updateMany).not.toHaveBeenCalled();
    expect(harness.tx.order.updateMany).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
  });

  it('fails closed on upload-candidate and quality-evidence CAS loss', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    for (const testCase of [
      {
        message: 'page re-render upload candidate compare-and-swap lost',
        arrangeOrder: (order: ReturnType<typeof makeOrder>) => {
          const { asset } = markPageUnverified(order);
          order.pageUploadCandidates.push({
            id: 'candidate-6',
            pageNumber: 6,
            url: asset.url,
            rawUrl: asset.rawUrl,
            provider: asset.provider,
            createdAt: NOW,
            updatedAt: NOW,
          });
        },
        loseCas: (harness: ReturnType<typeof makeHarness>) =>
          harness.tx.pageUploadCandidate.deleteMany.mockResolvedValue({ count: 0 }),
      },
      {
        message: 'page re-render quality evidence compare-and-swap lost',
        arrangeOrder: (order: ReturnType<typeof makeOrder>) => {
          markPageUnverified(order);
        },
        loseCas: (harness: ReturnType<typeof makeHarness>) =>
          harness.tx.qualityEvidence.updateMany.mockResolvedValue({ count: 0 }),
      },
    ]) {
      const order = makeOrder();
      testCase.arrangeOrder(order);
      const harness = makeHarness(order);
      const inspected = await executeReleaseV1Recovery(
        rerenderInput('inspect'),
        deps(harness),
      );
      if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');
      testCase.loseCas(harness);

      await expect(
        executeReleaseV1Recovery(
          rerenderInput('apply', inspected.snapshotDigest),
          deps(harness),
        ),
      ).rejects.toThrow(testCase.message);
      expect(harness.tx.order.updateMany).not.toHaveBeenCalled();
      expect(H.dispatch).not.toHaveBeenCalled();
    }
  });

  it('routes the cleared page and the two already-missing pages through the ordinary page-images stage', async () => {
    const order = makeOrder();
    order.book.pages[5]!.imageAsset = null;
    const pendingPageNumbers = order.book.pages
      .filter((page) => !shouldSkipPaidPageImageRegen(page.imageAsset))
      .map((page) => page.pageNumber);

    expect(pendingPageNumbers).toEqual([6, 7, 8]);
    const { deriveStartingStage } = await import(
      '@/lib/generation-pipeline/chunk-runner'
    );
    await expect(
      deriveStartingStage(
        order.id,
        {
          textDone: true,
          imagesDone: false,
          audioDone: false,
          packaged: false,
        },
        order.generationJob.pipelineCache,
      ),
    ).resolves.toBe('page_images');
  });

  it('removes the exact prior page-write receipt so identical replacement bytes can recreate the asset', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    const order = makeOrder();
    const { asset } = markPageUnverified(order);
    const harness = makeHarness(order);
    const oldOperationKey = pageAssetOperationKey(
      order.id,
      6,
      asset.presentationUrl!,
      order.visualContractHash,
    );
    harness.receipts.set(oldOperationKey, {
      operationKey: oldOperationKey,
      orderId: order.id,
      kind: 'delivery_input',
      payloadHash: 'old-page-receipt-payload',
      result: { value: { inputVersion: 11 } },
      createdAt: new Date('2026-09-01T19:56:30.000Z'),
    });

    const inspected = await executeReleaseV1Recovery(
      rerenderInput('inspect'),
      deps(harness),
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');
    expect(inspected.pageRerender?.targets[0]).toMatchObject({
      priorAssetReceiptOperationKey: oldOperationKey,
      priorAssetReceiptPayloadHash: 'old-page-receipt-payload',
    });

    const result = await executeReleaseV1Recovery(
      rerenderInput('apply', inspected.snapshotDigest),
      deps(harness),
    );

    expect(result).toMatchObject({ status: 'resumed', dispatched: true });
    expect(harness.tx.atomicOperationReceipt.deleteMany).toHaveBeenCalledWith({
      where: {
        operationKey: oldOperationKey,
        orderId: order.id,
        kind: 'delivery_input',
        payloadHash: 'old-page-receipt-payload',
        createdAt: new Date('2026-09-01T19:56:30.000Z'),
      },
    });
    expect(harness.receipts.has(oldOperationKey)).toBe(false);
  });

  it('fences an ambiguous page re-render commit and dispatches exactly once across replay', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order, {
      ambiguousAfterCommitFor: 'release_v1_page_rerender',
    });
    const recoveryDeps = deps(harness);
    const inspected = await executeReleaseV1Recovery(
      rerenderInput('inspect'),
      recoveryDeps,
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');
    const apply = rerenderInput('apply', inspected.snapshotDigest);

    const first = await executeReleaseV1Recovery(apply, recoveryDeps);
    // The lightweight ambiguity harness persists only the receipt, not the other committed row mutations. Restore
    // its in-memory exception fixture to the same pre-commit snapshot so replay exercises receipt ownership exactly
    // as the existing Order/job fixtures do (the callback itself must still run only once).
    Object.assign(order.exceptionCases[0]!, {
      status: 'open',
      claimVersion: 0,
      nextActionAt: new Date('2026-09-01T19:58:30.000Z'),
      leaseExpiresAt: null,
    });
    const replay = await executeReleaseV1Recovery(apply, recoveryDeps);

    expect(first).toMatchObject({ status: 'resumed', dispatched: true });
    expect(replay).toMatchObject({
      status: 'already_resumed',
      dispatched: false,
      rerenderedPageNumbers: [6],
    });
    expect(harness.tx.imageAsset.deleteMany).toHaveBeenCalledTimes(1);
    expect(harness.tx.qualityEvidence.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.tx.order.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.tx.generationJob.updateMany).toHaveBeenCalledTimes(1);
    expect(H.dispatch).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch when its rolled-back attempt replays a concurrent winner receipt', async () => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    const order = makeOrder();
    markPageUnverified(order);
    const harness = makeHarness(order, {
      rollbackThenConcurrentWinnerFor: 'release_v1_page_rerender',
    });
    const recoveryDeps = deps(harness);
    const inspected = await executeReleaseV1Recovery(
      rerenderInput('inspect'),
      recoveryDeps,
    );
    if (inspected.status !== 'inspect_ready') throw new Error('unexpected status');

    const result = await executeReleaseV1Recovery(
      rerenderInput('apply', inspected.snapshotDigest),
      recoveryDeps,
    );

    expect(result).toMatchObject({
      status: 'already_resumed',
      dispatched: false,
      rerenderedPageNumbers: [6],
    });
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
    expect(harness.tx.$queryRaw).toHaveBeenCalledTimes(12);
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
        scope: 'base_book',
        kind: 'quality_failed',
        status: 'refund_pending',
        reason: 'quality failed',
        attempts: 1,
        nextActionAt: NOW,
        actionAttemptedAt: NOW,
        notificationAttemptedAt: null,
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

  it.each([
    ['non-generation source', (row: ReturnType<typeof makeOrder>['exceptionCases'][number]) => { row.sourceRef = 'readiness:manifest-1'; }, 'protected exception case blocks recovery'],
    ['non-base scope', (row: ReturnType<typeof makeOrder>['exceptionCases'][number]) => { row.scope = 'other_scope'; }, 'protected exception case blocks recovery'],
    ['notification already attempted', (row: ReturnType<typeof makeOrder>['exceptionCases'][number]) => { row.notificationAttemptedAt = NOW; }, 'protected exception case blocks recovery'],
    ['external action already attempted', (row: ReturnType<typeof makeOrder>['exceptionCases'][number]) => { row.actionAttemptedAt = NOW; }, 'protected exception case blocks recovery'],
    ['live processor lease', (row: ReturnType<typeof makeOrder>['exceptionCases'][number]) => { row.leaseExpiresAt = new Date(NOW.getTime() + 60_000); }, 'live exception lease blocks recovery'],
  ])('rejects %s before any recovery mutation', async (_label, mutate, message) => {
    const order = makeOrder();
    mutate(order.exceptionCases[0]!);
    const harness = makeHarness(order);

    await expect(
      executeReleaseV1Recovery(rerenderInput('inspect'), deps(harness)),
    ).rejects.toThrow(message);
    expect(harness.transaction).not.toHaveBeenCalled();
    expect(harness.tx.exceptionCase.updateMany).not.toHaveBeenCalled();
    expect(harness.tx.imageAsset.deleteMany).not.toHaveBeenCalled();
    expect(H.dispatch).not.toHaveBeenCalled();
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
