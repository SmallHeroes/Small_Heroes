import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/generation-pipeline/quality-evidence', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/generation-pipeline/quality-evidence')
  >('@/lib/generation-pipeline/quality-evidence');
  return {
    ...actual,
    inspectHumanReviewAuthorityBytes: vi.fn(),
    loadQualityEvidence: vi.fn(),
  };
});

import {
  abortPreparedHumanVerifiedUnverifiedRelease,
  classifyPriorProviderSpend,
  inspectHumanVerifiedUnverifiedRelease,
  prepareHumanVerifiedUnverifiedRelease,
  type PrepareHumanVerifiedUnverifiedArgs,
} from '@/lib/generation-pipeline/human-verified-unverified-preparation';
import {
  humanVerifiedUnverifiedPreparedOutcome,
  humanVerifiedUnverifiedOperationKey,
  humanVerifiedUnverifiedRequestHash,
  type HumanVerifiedUnverifiedReleaseRequest,
} from '@/lib/generation-pipeline/human-verified-unverified-release';
import {
  HUMAN_VERIFIED_UNVERIFIED_VERSION,
  HUMAN_VERIFIED_UNVERIFIED_RECEIPT_VERSION,
  humanVerifiedUnverifiedResemblanceProofDigest,
} from '@/lib/generation-pipeline/human-verified-unverified-contract';
import {
  QUALITY_EVALUATOR_CONTRACT_VERSION,
  inspectHumanReviewAuthorityBytes,
  loadQualityEvidence,
  type QualityEvidenceRow,
} from '@/lib/generation-pipeline/quality-evidence';
import {
  PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
  PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
} from '@/lib/generation-pipeline/page-child-resemblance-vision';
import { canonicalHash } from '@/lib/canonical-json';

const PREPARATION_PATH = path.join(
  process.cwd(),
  'lib/generation-pipeline/human-verified-unverified-preparation.ts',
);
const SCORER_PATH = path.join(
  process.cwd(),
  'lib/generation-pipeline/page-child-resemblance-vision.ts',
);
const source = readFileSync(PREPARATION_PATH, 'utf8');
const scorerSource = readFileSync(SCORER_PATH, 'utf8');

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const SHA_D = 'd'.repeat(64);
const SHA_E = 'e'.repeat(64);
const SHA_F = 'f'.repeat(64);
const REQUEST_HASH = '9'.repeat(64);

const COMMITTED_PROOFS = [{
  artifactKey: 'page:6',
  assetId: 'asset-6',
  deliveredUrlHash: SHA_B,
  deliveredBytesSha256: SHA_A,
  referenceBytesSha256: SHA_C,
  referenceImageUrlHash: SHA_D,
  evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
  resemblanceScore: PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
  threshold: PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
  subjectVisible: true,
  sameChild: true,
  source: 'raw_same_bytes',
}] as const;
const COMMITTED_PROOF_DIGEST = humanVerifiedUnverifiedResemblanceProofDigest(
  COMMITTED_PROOFS,
);

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('ALLOW_STAGING_QA', 'true');
  vi.stubEnv('HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED', 'true');
  vi.stubEnv('QA_SOFT_DELIVER', 'false');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://human-review-preview.vercel.app');
  vi.stubEnv('SUPABASE_URL', 'https://staging-project.supabase.co');
  vi.stubEnv('DATABASE_URL', 'postgresql://test@staging-project.supabase.co/db');
  vi.mocked(inspectHumanReviewAuthorityBytes).mockReset();
  vi.mocked(inspectHumanReviewAuthorityBytes).mockResolvedValue({
    anchorBytesSha256: SHA_C,
    artifactBytesSha256: new Map([['page:6', SHA_A]]),
  });
  vi.mocked(loadQualityEvidence).mockReset();
  vi.mocked(loadQualityEvidence).mockResolvedValue([{
    artifactKey: 'page:6',
    humanReviewVerified: true,
    humanReviewActionDigest: REQUEST_HASH,
  } as QualityEvidenceRow]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const args: PrepareHumanVerifiedUnverifiedArgs = {
  orderId: 'order-6',
  inspectionDigest: SHA_F,
  artifactKey: 'page:6',
  expectedMarker: 'safety_hold:unverified:page:6',
  expectedAssetSha256: SHA_A,
  reviewReason: 'Exact delivered bytes reviewed as safe.',
  actor: 'admin:exact_byte_human_verification',
  idempotencyKey: 'review-page-6-v1',
};

const committedResult = {
  manifestStatus: 'passed' as const,
  enqueued: true as const,
  orderStatus: 'ready' as const,
  reason: null,
  revision: 4,
};

function preparedRequest(
  overrides: Partial<HumanVerifiedUnverifiedReleaseRequest> = {},
): HumanVerifiedUnverifiedReleaseRequest {
  return {
    inspectionDigest: args.inspectionDigest,
    refundAuthorityDigest: SHA_D,
    artifactKey: args.artifactKey,
    expectedMarker: args.expectedMarker,
    expectedCaseId: 'case-6',
    expectedCaseRevision: 3,
    expectedCaseFingerprint: SHA_A,
    expectedAssetId: 'asset-6',
    expectedAssetSha256: args.expectedAssetSha256,
    expectedDeliveredUrlHash: SHA_B,
    expectedAnchorEntryDigest: SHA_C,
    expectedAnchorUrlHash: SHA_D,
    expectedAnchorBytesSha256: SHA_E,
    expectedContractHash: SHA_F,
    expectedEvaluatorVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
    snapshotDigest: SHA_A,
    paymentSnapshotDigest: SHA_B,
    resemblanceProofDigest: COMMITTED_PROOF_DIGEST,
    resemblanceProofs: [...COMMITTED_PROOFS],
    requiredResemblanceArtifacts: [args.artifactKey],
    reviewReason: args.reviewReason,
    actor: args.actor,
    idempotencyKey: args.idempotencyKey,
    ...overrides,
  };
}

function committedAction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'action-6',
    orderId: args.orderId,
    caseId: 'case-6',
    caseRevision: 3,
    requestHash: REQUEST_HASH,
    kind: 'release',
    status: 'succeeded',
    actor: args.actor,
    targetArtifacts: [args.artifactKey],
    observedMarker: args.expectedMarker,
    overrideReason: args.reviewReason,
    assetSha256: args.expectedAssetSha256,
    outcome: {
      version: HUMAN_VERIFIED_UNVERIFIED_VERSION,
      decision: 'human_verified_safe',
      orderId: args.orderId,
      actionId: 'action-6',
      caseId: 'case-6',
      caseRevision: 3,
      artifactKey: args.artifactKey,
      assetId: 'asset-6',
      assetSha256: args.expectedAssetSha256,
      deliveredUrlHash: SHA_B,
      contractHash: SHA_C,
      evaluatorVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
      reviewer: args.actor,
      inspectionDigest: args.inspectionDigest,
      snapshotDigest: SHA_D,
      refundAuthorityDigest: SHA_D,
      paymentSnapshotDigest: SHA_E,
      resemblanceProofDigest: COMMITTED_PROOF_DIGEST,
      resemblanceProofs: [...COMMITTED_PROOFS],
      anchorEntryDigest: SHA_A,
      anchorUrlHash: SHA_B,
      anchorBytesSha256: SHA_C,
      requestHash: REQUEST_HASH,
      receiptOperationKey: humanVerifiedUnverifiedOperationKey(
        args.orderId,
        args.idempotencyKey,
      ),
      caseFingerprint: SHA_A,
      expectedMarker: args.expectedMarker,
      releasedMarker: 'qa_human_verified:safety:unverified:page:6',
      observedFence: 2,
      postFence: 3,
      observedInputVersion: 4,
      qualityEvidenceDigest: SHA_F,
      result: {
        manifestStatus: 'passed',
        orderStatus: 'ready',
        enqueued: true,
        reason: null,
        revision: committedResult.revision,
      },
    },
    ...overrides,
  };
}

function committedReceipt(overrides: Record<string, unknown> = {}) {
  return {
    orderId: args.orderId,
    kind: 'operator_action',
    payloadHash: REQUEST_HASH,
    result: {
      value: {
        version: HUMAN_VERIFIED_UNVERIFIED_RECEIPT_VERSION,
        actionId: 'action-6',
        requestHash: REQUEST_HASH,
        inspectionDigest: args.inspectionDigest,
        resemblanceProofDigest: COMMITTED_PROOF_DIGEST,
        qualityEvidenceDigest: SHA_F,
        result: committedResult,
      },
    },
    ...overrides,
  };
}

function replayDb(action: unknown, receipt: unknown) {
  const humanQaOperatorAction = {
    findUnique: vi.fn(async () => action),
  };
  const atomicOperationReceipt = {
    findUnique: vi.fn(async () => receipt),
  };
  return {
    prisma: { humanQaOperatorAction, atomicOperationReceipt } as never,
    humanQaOperatorAction,
    atomicOperationReceipt,
  };
}

function historicallyRefundedDb() {
  const bookPageFindMany = vi.fn();
  const historicalCase = {
    id: 'exception-refunded',
    activeKey: null,
    scope: 'base_book',
    kind: 'quality_failed',
    status: 'resolved',
    resolution: { outcome: 'refund_confirmed' },
    sourceRef: null,
    refundKey: 'refund:order-6',
    providerActionId: 'provider-refund-1',
    actionAttemptedAt: new Date('2026-08-01T00:00:00.000Z'),
    notificationAttemptedAt: null,
    notificationMessageId: null,
    lastError: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:01:00.000Z'),
  };
  const prisma = {
    humanQaOperatorAction: { findUnique: vi.fn(async () => null) },
    atomicOperationReceipt: { findUnique: vi.fn(async () => null) },
    order: { findUnique: vi.fn(async () => ({
      id: args.orderId,
      status: 'needs_human_qa',
      deliveryHoldReason: args.expectedMarker,
      deliveryFenceVersion: 2,
      inputVersion: 4,
      manualReviewRequired: false,
      visualContractHash: SHA_C,
      visualPackageAuthority: null,
      stripePaid: true,
      paymentProvider: 'stripe',
      paymentId: 'payment-1',
      stripePaymentId: 'pi_1',
      totalPrice: 79,
      illustrationStyle: 'pencil_watercolor',
      storySourceHash: SHA_D,
      selectionFilename: 'story.json',
      generationJob: { pipelineCache: {} },
    })) },
    humanQaReviewCase: { findUnique: vi.fn(async ({ where }: { where: { activeKey: string } }) =>
      where.activeKey.endsWith(':payment')
        ? null
        : {
            id: 'case-6',
            revision: 3,
            kind: 'safety',
            status: 'open',
            holdFingerprint: SHA_A,
            rawReason: args.expectedMarker,
            inputVersion: 4,
            contractHash: SHA_C,
          }) },
    exceptionCase: { findMany: vi.fn(async () => [historicalCase]) },
    refundAttempt: { findMany: vi.fn(async () => [{
      id: 'refund-attempt-1',
      refundKey: historicalCase.refundKey,
      provider: 'payme',
      providerSaleId: 'sale-1',
      status: 'confirmed',
      providerActionId: historicalCase.providerActionId,
      createdAt: historicalCase.createdAt,
      updatedAt: historicalCase.updatedAt,
    }]) },
    paymentRecord: { findUnique: vi.fn(async () => ({
      id: 'payment-record-1',
      provider: 'stripe',
      amount: 79,
      currency: 'ils',
      paid: true,
      paidAt: new Date('2026-07-01T00:00:00.000Z'),
    })) },
    bookPage: {
      findFirst: vi.fn(async () => ({
        id: 'page-row-6',
        pageNumber: 6,
        imageAsset: {
          id: 'asset-6',
          url: 'https://assets.example/page-6.png',
          presentationUrl: null,
          safetyVerified: false,
          safetyHazards: [],
          safetyContentSha256: args.expectedAssetSha256,
          safetyOverriddenHazards: [],
          safetyOverrideSha256: null,
        },
      })),
      findMany: bookPageFindMany,
    },
    qualityEvidence: { findMany: vi.fn(async () => []) },
  };
  return { prisma: prisma as never, bookPageFindMany };
}

function transactionSlice(
  startMarker: string,
  label: string,
): { body: string; start: number; end: number } {
  const start = source.indexOf(startMarker);
  expect(start, `preparation must have the ${label} transaction`).toBeGreaterThan(-1);
  const end = source.indexOf('\n    });', start);
  expect(end, `${label} transaction must have a bounded closing delimiter`).toBeGreaterThan(start);
  const boundedEnd = end + '\n    });'.length;
  return { body: source.slice(start, boundedEnd), start, end: boundedEnd };
}

describe('human-verified-unverified preparation — source invariants', () => {
  it('keeps Inspect provider-free and mutation-free while returning only the redacted inspection projection', () => {
    const start = source.indexOf('async function collectInspectionMaterial(');
    const end = source.indexOf('async function rebindInspectionUnderOrderLock(', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const inspectSection = source.slice(start, end);
    expect(inspectSection).toContain('inspectAssetWithBytes(anchor.url)');
    expect(inspectSection).toContain('return (await collectInspectionMaterial(prisma, args)).inspection;');
    expect(inspectSection).not.toContain('evaluatePageChildResemblanceVision');
    expect(inspectSection).not.toMatch(/\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/u);
  });

  it('is read-only for Order, PaymentRecord, ImageAsset, BookPage, and GeneratedBook', () => {
    const forbidden = [
      ...source.matchAll(
        /\b(?:prisma|tx)\.(order|paymentRecord|imageAsset|bookPage|generatedBook)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/gu,
      ),
    ].map((match) => `${match[1]}.${match[2]}`);
    expect(forbidden).toEqual([]);
  });

  it('takes no URL from the request and sends Vision only data URLs built from inspected DB-loaded bytes', () => {
    const argsStart = source.indexOf('export interface PrepareHumanVerifiedUnverifiedArgs');
    const argsEnd = source.indexOf('\n}', argsStart);
    const argsContract = source.slice(argsStart, argsEnd);
    expect(argsContract).not.toMatch(/\b(?:url|imageUrl|candidateImageUrl|referenceImageUrl)\b/iu);
    expect(source).toMatch(
      /inspectAssetWithBytes\(\s*page\.imageAsset!\.presentationUrl \?\? page\.imageAsset!\.url,?\s*\)/u,
    );
    expect(source).toContain('const anchorInspection = await inspectAssetWithBytes(anchor.url)');
    expect(source).toContain('referenceImageUrl: anchorVisionUrl');
    expect(source).toContain('candidateImageUrl: exactByteDataUrl(');
    expect(source).toContain("inspection.data.toString('base64')");
    expect(source).not.toMatch(/(?:inspectAssetWithBytes\(|candidateImageUrl:)\s*args\./u);
  });

  it('derives the complete child-required set only from authoritative runtime frames', () => {
    const qualification = source.indexOf('runWithStyle01RenderQualification');
    const frames = source.indexOf('runtimeAuthority.bookProjection.frames');
    const scoring = source.indexOf('evaluatePageChildResemblanceVision({');
    expect(qualification).toBeGreaterThan(-1);
    expect(frames).toBeGreaterThan(qualification);
    expect(scoring).toBeGreaterThan(frames);
    expect(source).toContain("frame.entityPresence.childPresence === 'present'");
    expect(source).not.toContain('requiredResemblanceArtifactsFromRows');
    expect(source).toContain('requiredArtifacts.includes(args.artifactKey)');
  });

  it('reserves at most 24 provider calls before scoring any unproven page', () => {
    expect(source).toContain('const MAX_VISION_CALLS = 24;');
    expect(source).toContain('const attemptsPerPage = 1 + PAGE_CHILD_RESEMBLANCE_MAX_RETRIES;');
    const budget = source.indexOf('pagesNeedingVision * attemptsPerPage > MAX_VISION_CALLS');
    const scoring = source.indexOf('evaluatePageChildResemblanceVision({');
    expect(budget).toBeGreaterThan(-1);
    expect(budget).toBeLessThan(scoring);
    expect(source.match(/evaluatePageChildResemblanceVision\(\{/gu)).toHaveLength(1);
  });

  it('pins the Vision version, the unchanged 0.70 floor, and exact delivered-byte SHA binding', () => {
    expect(scorerSource).toContain("'page-child-resemblance-vision/v1'");
    expect(scorerSource).toContain('PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD = 0.7;');
    expect(source).toContain('Math.max(\n    PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,');
    expect(source).toContain('inspection.sha256 !== asset.safetyContentSha256');
    expect(source).toContain('row.assetSha256 !== inspection.sha256');
    expect(source).toContain('row!.assetSha256 === inspection.sha256');
    expect(source).toContain('gate.referenceBytesSha256 === args.anchorBytesSha256');
    expect(source).toContain('referenceBytesSha256: anchorInspection.sha256');
    expect(source).toContain('result.resemblanceScore < threshold');
    expect(source).toContain('result.subjectVisible !== true');
    expect(source).toContain('result.sameChild !== true');
    expect(source).toContain('deliveredBytesSha256: inspection.sha256');
  });

  it('serializes the pre-provider claim on the Order and excludes every pending release key for the same case', () => {
    const start = source.indexOf('claimedAction = await prisma.$transaction(async (tx) => {');
    const end = source.indexOf('\n  } catch (error) {', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const claim = source.slice(start, end);
    const rebind = claim.indexOf('rebindInspectionUnderOrderLock(tx, material, args)');
    const competing = claim.indexOf('tx.humanQaOperatorAction.findMany({');
    const create = claim.indexOf('tx.humanQaOperatorAction.create({');
    expect(rebind).toBeGreaterThan(-1);
    expect(competing).toBeGreaterThan(rebind);
    expect(create).toBeGreaterThan(competing);

    const competingWindow = claim.slice(competing, create);
    for (const predicate of [
      'orderId: args.orderId',
      'caseId: initial.reviewCase.id',
      "kind: 'release'",
      "status: 'pending'",
    ]) {
      expect(competingWindow).toContain(predicate);
    }
    expect(competingWindow).toContain('another release preparation already owns this case');
    expect(competingWindow).toContain('claimIsConservativelyStale');
    expect(competingWindow).toContain('tx.atomicOperationReceipt.findUnique');
    expect(claim).toContain('updatedAt: existing.updatedAt');

    const scoring = source.indexOf('evaluatePageChildResemblanceVision({');
    expect(scoring).toBeGreaterThan(end);
  });

  it('waits for every launched score before any failed batch is aborted', () => {
    const allSettled = source.indexOf('const settledScores = await Promise.allSettled(');
    const failed = source.indexOf('const rejectedScores = settledScores.filter(', allSettled);
    const aborted = source.indexOf("status: 'aborted'", failed);
    expect(allSettled).toBeGreaterThan(-1);
    expect(failed).toBeGreaterThan(allSettled);
    expect(aborted).toBeGreaterThan(failed);
    expect(source.slice(allSettled, failed)).not.toContain('Promise.all(');
  });

  it('durably marks provider_started before scoring and never reclaims that phase', () => {
    const phase = source.indexOf("phase: 'provider_started'");
    const scoring = source.indexOf('evaluatePageChildResemblanceVision({');
    const spendBoundary = source.lastIndexOf(
      'if (pagesNeedingVision > 0)',
      phase,
    );
    const spendRebind = source.indexOf(
      'await rebindInspectionUnderOrderLock(tx, material, args);',
      spendBoundary,
    );
    expect(phase).toBeGreaterThan(-1);
    expect(phase).toBeLessThan(scoring);
    expect(spendRebind).toBeGreaterThan(spendBoundary);
    expect(spendRebind).toBeLessThan(phase);
    expect(source).toContain("rawClaim.phase === 'provider_started'");
    expect(source).toContain('rawClaim.proofInputDigest !== proofInputDigest');
    expect(source).toContain("'provider_outcome_ambiguous'");
  });

  it('shares a batch terminal fence so no sibling retry starts after deterministic refusal', () => {
    expect(source).toContain('let deterministicBatchRefusal = false;');
    expect(source).toContain(
      'shouldStartAttempt: () => !deterministicBatchRefusal',
    );
    expect(source).toContain(
      'if (deterministicRefusal) deterministicBatchRefusal = true;',
    );
  });

  it('keeps the post-score evidence transaction separate: exact-CAS backfill plus pending-claim finalization only', () => {
    const evidence = transactionSlice(
      'request = await prisma.$transaction(async (tx) => {',
      'evidence backfill',
    );
    const body = evidence.body;
    const mutations = [...body.matchAll(
      /\btx\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/gu,
    )].map((match) => `${match[1]}.${match[2]}`);
    expect(mutations).toEqual([
      'qualityEvidence.updateMany',
      'humanQaOperatorAction.updateMany',
    ]);
    for (const casField of [
      'id: row.id!',
      'orderId: args.orderId',
      'artifactKey',
      'assetSha256: inspection.sha256!',
      'evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION',
      'contractHash: order.visualContractHash',
      'evaluatedAt: row.evaluatedAt',
      'updatedAt: row.updatedAt',
    ]) {
      expect(body).toContain(casField);
    }
    for (const reviewField of [
      'reviewStatus',
      'reviewedAssetSha256',
      'reviewedContractHash',
      'reviewedBy',
      'reviewedAt',
      'reviewReason',
    ]) {
      expect(body).toContain(`${reviewField}: null`);
    }
  });

  it('revalidates current exact-byte and strict evidence authority before replaying a committed success', () => {
    expect(source).toContain('inspectHumanReviewAuthorityBytes(');
    expect(source).toContain('loadQualityEvidence(');
    expect(source).toContain('currentTarget?.humanReviewVerified !== true');
    expect(source).toContain('currentTarget.humanReviewActionDigest !== action.requestHash');
  });
});

describe('human-verified-unverified preparation — committed replay', () => {
  it('preserves post-score proof provenance on abort so a new key cannot spend again for the same proof input', async () => {
    const request = preparedRequest({ expectedAnchorBytesSha256: SHA_C });
    const requestHash = humanVerifiedUnverifiedRequestHash(args.orderId, request);
    let action: Record<string, unknown> = {
      ...committedAction({
        status: 'pending',
        requestHash,
        outcome: humanVerifiedUnverifiedPreparedOutcome(request),
      }),
      updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    };
    const updateMany = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      action = { ...action, ...data };
      return { count: 1 };
    });
    const tx = {
      $queryRaw: vi.fn(async () => [{ id: args.orderId }]),
      humanQaOperatorAction: {
        findUnique: vi.fn(async () => action),
        updateMany,
      },
      atomicOperationReceipt: { findUnique: vi.fn(async () => null) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<boolean>) =>
        callback(tx)),
    } as never;

    await expect(abortPreparedHumanVerifiedUnverifiedRelease(prisma, {
      orderId: args.orderId,
      request,
      rule: 'competing_hold',
    })).resolves.toBe(true);

    const proofInputDigest = canonicalHash({
      requiredArtifacts: request.requiredResemblanceArtifacts,
      anchorUrlHash: request.expectedAnchorUrlHash,
      anchorBytesSha256: request.expectedAnchorBytesSha256,
      threshold: request.resemblanceProofs[0].threshold,
      caseId: request.expectedCaseId,
      caseRevision: request.expectedCaseRevision,
      inspectedArtifacts: request.resemblanceProofs.map((proof) => ({
        artifactKey: proof.artifactKey,
        assetId: proof.assetId,
        sha256: proof.deliveredBytesSha256,
        deliveredUrlHash: proof.deliveredUrlHash,
      })),
    });
    expect(action.outcome).toEqual({
      version: 'human_verified_unverified_post_score_aborted/v1',
      phase: 'proof_settled_commit_refused',
      requestHash,
      inspectionDigest: request.inspectionDigest,
      caseRevision: request.expectedCaseRevision,
      proofInputDigest,
      rule: 'competing_hold',
    });

    const provider = vi.fn();
    const priorSpendRule = classifyPriorProviderSpend({
      outcome: action.outcome,
      status: 'aborted',
      inspectionDigest: request.inspectionDigest,
      caseRevision: request.expectedCaseRevision,
      proofInputDigest,
    });
    if (!priorSpendRule) provider();
    expect(priorSpendRule).toBe('invalid_request');
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    ['deterministic_refusal', 'resemblance_not_proven'],
    ['unknown_or_ambiguous', 'provider_outcome_ambiguous'],
  ] as const)(
    'blocks key B before provider when key A has terminal %s spend on the same inspection',
    (disposition, expectedRule) => {
      const provider = vi.fn();
      const proofInputDigest = '6'.repeat(64);
      const rule = classifyPriorProviderSpend({
        status: 'aborted',
        // A payment/review-only snapshot change must not reset the page/anchor proof-input allowance.
        inspectionDigest: '0'.repeat(64),
        caseRevision: 3,
        proofInputDigest,
        outcome: {
          version: 'human_verified_unverified_provider_spend_terminal/v1',
          phase: 'provider_settled_terminal',
          claimHash: '7'.repeat(64),
          inspectionDigest: args.inspectionDigest,
          caseRevision: 3,
          proofInputDigest,
          disposition,
          rule: 'resemblance_not_proven',
        },
      });
      if (!rule) provider();
      expect(rule).toBe(expectedRule);
      expect(provider).not.toHaveBeenCalled();
    },
  );

  it('refuses a resolved historical refund with no activeKey before assets or provider work', async () => {
    const db = historicallyRefundedDb();
    await expect(
      prepareHumanVerifiedUnverifiedRelease(db.prisma, args),
    ).rejects.toMatchObject({ rule: 'payment_snapshot_changed' });
    expect(db.bookPageFindMany).not.toHaveBeenCalled();
  });

  it('fails closed at the service boundary before replay or any DB read outside the explicit Preview envelope', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const db = replayDb(committedAction(), committedReceipt());
    await expect(
      prepareHumanVerifiedUnverifiedRelease(db.prisma, args),
    ).rejects.toThrow(/disabled outside its explicit Preview boundary/);
    expect(db.humanQaOperatorAction.findUnique).not.toHaveBeenCalled();
    expect(db.atomicOperationReceipt.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['SUPABASE_URL', 'https://yevwpjxqusyyaxalbvyn.supabase.co'],
    ['DATABASE_URL', 'postgresql://user:secret@db.yevwpjxqusyyaxalbvyn.supabase.co/postgres'],
  ])('refuses a leaked production %s before Inspect or Prepare can read the DB', async (key, value) => {
    vi.stubEnv(key, value);
    const db = replayDb(committedAction(), committedReceipt());

    await expect(
      inspectHumanVerifiedUnverifiedRelease(db.prisma, {
        orderId: args.orderId,
        artifactKey: args.artifactKey,
        expectedMarker: args.expectedMarker,
        expectedAssetSha256: args.expectedAssetSha256,
      }),
    ).rejects.toThrow(/\[env-separation\] Refusing to run/);
    await expect(
      prepareHumanVerifiedUnverifiedRelease(db.prisma, args),
    ).rejects.toThrow(/\[env-separation\] Refusing to run/);
    expect(db.humanQaOperatorAction.findUnique).not.toHaveBeenCalled();
    expect(db.atomicOperationReceipt.findUnique).not.toHaveBeenCalled();
  });

  it('returns the committed result only when the same key has a fully linked succeeded action and receipt', async () => {
    const db = replayDb(committedAction(), committedReceipt());
    await expect(
      prepareHumanVerifiedUnverifiedRelease(db.prisma, args),
    ).resolves.toEqual({ alreadyCommitted: committedResult });

    const operationKey = humanVerifiedUnverifiedOperationKey(
      args.orderId,
      args.idempotencyKey,
    );
    expect(db.humanQaOperatorAction.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: operationKey },
      select: expect.objectContaining({
        id: true,
        caseId: true,
        caseRevision: true,
        requestHash: true,
        outcome: true,
      }),
    });
    expect(db.atomicOperationReceipt.findUnique).toHaveBeenCalledWith({
      where: { operationKey },
      select: {
        orderId: true,
        kind: true,
        payloadHash: true,
        result: true,
      },
    });
    expect(inspectHumanReviewAuthorityBytes).toHaveBeenCalledWith(
      db.prisma,
      args.orderId,
      expect.any(Function),
    );
    expect(loadQualityEvidence).toHaveBeenCalledWith(
      db.prisma,
      args.orderId,
      expect.objectContaining({
        artifactBytesSha256: expect.any(Map),
      }),
    );
  });

  it('refuses a stale committed replay whose current strict authority no longer verifies the action digest', async () => {
    vi.mocked(loadQualityEvidence).mockResolvedValueOnce([{
      artifactKey: args.artifactKey,
      humanReviewVerified: false,
      humanReviewActionDigest: null,
    } as QualityEvidenceRow]);
    const db = replayDb(committedAction(), committedReceipt());
    await expect(
      prepareHumanVerifiedUnverifiedRelease(db.prisma, args),
    ).rejects.toMatchObject({ rule: 'evidence_changed' });
    expect(inspectHumanReviewAuthorityBytes).toHaveBeenCalledTimes(1);
    expect(loadQualityEvidence).toHaveBeenCalledTimes(1);
  });

  it('refuses a succeeded same-key replay bound to a different Inspect digest', async () => {
    const db = replayDb(committedAction(), committedReceipt());
    await expect(
      prepareHumanVerifiedUnverifiedRelease(db.prisma, {
        ...args,
        inspectionDigest: '0'.repeat(64),
      }),
    ).rejects.toThrow(/idempotency key is already bound to different or incomplete state/);
  });

  it('refuses a prepared same-key replay bound to a different Inspect digest', async () => {
    const request = preparedRequest();
    const action = committedAction({
      status: 'pending',
      requestHash: humanVerifiedUnverifiedRequestHash(args.orderId, request),
      outcome: humanVerifiedUnverifiedPreparedOutcome(request),
    });
    const db = replayDb(action, null);
    await expect(
      prepareHumanVerifiedUnverifiedRelease(db.prisma, {
        ...args,
        inspectionDigest: '0'.repeat(64),
      }),
    ).rejects.toThrow(/preparation is already claimed or bound to different input/);
  });

  it('refuses even an aged provider-started raw claim before any inspection or provider work', async () => {
    const claimHash = '7'.repeat(64);
    const action = committedAction({
      status: 'pending',
      requestHash: claimHash,
      outcome: {
        version: 'human_verified_unverified_preparation_claim/v1',
        claimHash,
        inspectionDigest: args.inspectionDigest,
        proofInputDigest: '6'.repeat(64),
        phase: 'provider_started',
      },
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    const db = replayDb(action, null);
    await expect(
      prepareHumanVerifiedUnverifiedRelease(db.prisma, args),
    ).rejects.toMatchObject({ rule: 'provider_outcome_ambiguous' });
    expect(db.humanQaOperatorAction.findUnique).toHaveBeenCalledTimes(1);
    expect(db.atomicOperationReceipt.findUnique).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'outcome belongs to another action',
      committedAction({
        outcome: { ...committedAction().outcome, actionId: 'action-forged' },
      }),
      committedReceipt(),
    ],
    [
      'outcome belongs to another case revision',
      committedAction({
        outcome: { ...committedAction().outcome, caseRevision: 4 },
      }),
      committedReceipt(),
    ],
    [
      'receipt payload does not match the action request',
      committedAction(),
      committedReceipt({ payloadHash: '8'.repeat(64) }),
    ],
    [
      'receipt is missing',
      committedAction(),
      null,
    ],
  ])('rejects same-key replay when %s', async (_label, action, receipt) => {
    const db = replayDb(action, receipt);
    await expect(
      prepareHumanVerifiedUnverifiedRelease(db.prisma, args),
    ).rejects.toThrow(/idempotency key is already bound to different or incomplete state/);
  });
});
