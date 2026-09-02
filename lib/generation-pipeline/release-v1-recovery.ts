import { createHash, randomUUID } from 'crypto';
import { Prisma, type Order, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { buildArtifactIdempotencyKey } from '@/lib/generation-chunked/artifact-keys';
import { chainGenerationWorker } from '@/lib/generation-chunked/chain-worker';
import { GENERATION_VERSION } from '@/lib/generation-chunked/constants';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';
import {
  EXCEPTION_SCOPE_BASE_BOOK,
  resolveActiveRecoveryCaseInTx,
} from '@/lib/generation-chunked/exception-case';
import { pageAssetOperationKey } from '@/lib/generation-pipeline/contract-hash-binding';
import { probeReleaseV1WorkerReachability } from '@/lib/generation-chunked/release-v1-worker-reachability';
import {
  resolveEffectiveThreshold,
  resolveResemblanceThresholdConfig,
} from '@/lib/resemblance-core';
import { normalizeStyleId, STYLE_IDS } from '@/lib/styles';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';

import {
  inspectAsset,
  inspectAssetWithBytes,
  isAllowedAssetUrl,
  type AssetInspection,
  type AssetInspectionWithBytes,
} from './asset-integrity';
import {
  classifyPageVisualQaOutcome,
  evaluatePageVisualQa,
  evaluatePageVisualQaWithReQa,
  REQA_MALFORMED_MAX_ATTEMPTS,
  type PageVisualQaResult,
} from './page-visual-qa';
import {
  evaluatePageWorldQa,
  type PageWorldQaResult,
} from './page-world-qa';
import { QUALITY_EVALUATOR_CONTRACT_VERSION } from './quality-evidence';
import type { QaContext } from './quality-evidence-producer';
import { writeRetainedSafetyEvaluation } from './asset-safety-writer';
import {
  buildGenerationReleaseContinuityV1,
  parseGenerationReleaseContinuityV1,
  parseWizardProductBindingV1,
  RELEASE_V1_ORDER_AUTHORITY_SELECT,
  releaseV1AuthorityCasWhere,
  requireExpectedWizardProductBinding,
  type GenerationReleaseContinuityV1,
  type WizardProductBindingV1,
} from './release-v1-continuity';
import { persistOrdinaryPipelineCache } from './pipeline-cache-store';
import { withDeliveryInputMutation } from './readiness-manifest';
import {
  hashOperationPayload,
  runAtomicOperation,
} from './atomic-operation';
import type { PipelineCache } from './types';
import { isStoryTimeOfDay } from '@/lib/story-time-of-day';
import { getApprovedChildCanonicalAnchor } from './character-anchor-store';
import { requireStyle01RenderQualification } from './render-qualification-preflight';
import { requireSetIdentityBoardsBoundForRender } from './set-identity-board-stage';

export const RELEASE_V1_RECOVERY_REASON = 'reviewed_code_fix_resume' as const;
export const RELEASE_V1_PAGE_RERENDER_REASON =
  'reviewed_single_page_rerender_resume' as const;
const RELEASE_V1_RECOVERY_LOG_VERSION = 'release-v1-recovery-log/v1' as const;
const RELEASE_V1_RECOVERY_ATTEMPT_VERSION =
  'release-v1-recovery-attempt/v1' as const;
const RELEASE_V1_PAGE_RERENDER_ATTEMPT_VERSION =
  'release-v1-page-rerender-attempt/v1' as const;
const SHA256_RE = /^[a-f0-9]{64}$/u;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const ACTIVE_EXCEPTION_STATUSES = [
  'open',
  'retry_scheduled',
  'customer_action',
  'refund_pending',
] as const;

const RELEASE_V1_RECOVERY_ORDER_SELECT = {
  ...RELEASE_V1_ORDER_AUTHORITY_SELECT,
  status: true,
  inputVersion: true,
  deliveryFenceVersion: true,
  visualContractHash: true,
  updatedAt: true,
  expectedPageCount: true,
  totalPrice: true,
  paymentProvider: true,
  paymentId: true,
  audioEnabled: true,
  videoEnabled: true,
  bundleEnabled: true,
  selectedVoice: true,
  payment: {
    select: {
      id: true,
      provider: true,
      amount: true,
      currency: true,
      paid: true,
      paidAt: true,
    },
  },
  textStatus: true,
  imageStatus: true,
  audioStatus: true,
  packageStatus: true,
  deliveryHoldReason: true,
  manualReviewRequired: true,
  lastError: true,
  errorAt: true,
  generationJob: {
    select: {
      id: true,
      status: true,
      currentStage: true,
      retryable: true,
      lockedBy: true,
      leaseExpiresAt: true,
      failedAt: true,
      lastError: true,
      textDone: true,
      imagesDone: true,
      audioDone: true,
      packaged: true,
      generationVersion: true,
      provider: true,
      model: true,
      quality: true,
      pipelineCache: true,
      completedPageNumbers: true,
      failedPageNumbers: true,
      pageAttempts: true,
      updatedAt: true,
    },
  },
  book: {
    select: {
      id: true,
      coverImageUrl: true,
      coverSafetyVerified: true,
      coverSafetyHazards: true,
      coverSafetyContentSha256: true,
      coverSafetyOverriddenHazards: true,
      coverSafetyOverrideSha256: true,
      pages: {
        orderBy: { pageNumber: 'asc' },
        select: {
          id: true,
          pageNumber: true,
          audioUrl: true,
          imageAsset: {
            select: {
              id: true,
              provider: true,
              url: true,
              presentationUrl: true,
              rawUrl: true,
              idempotencyKey: true,
              safetyVerified: true,
              safetyHazards: true,
              safetyContentSha256: true,
              safetyOverriddenHazards: true,
              safetyOverrideSha256: true,
            },
          },
        },
      },
    },
  },
  exceptionCases: {
    where: { status: { in: [...ACTIVE_EXCEPTION_STATUSES] } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      scope: true,
      kind: true,
      status: true,
      reason: true,
      attempts: true,
      nextActionAt: true,
      actionAttemptedAt: true,
      notificationAttemptedAt: true,
      claimVersion: true,
      leaseExpiresAt: true,
      sourceRef: true,
      updatedAt: true,
    },
  },
  humanQaReviewCases: {
    where: { status: 'open' },
    select: { id: true, kind: true, status: true },
  },
  pageUploadCandidates: {
    orderBy: { pageNumber: 'asc' },
    select: {
      id: true,
      pageNumber: true,
      url: true,
      rawUrl: true,
      provider: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  qualityEvidence: {
    orderBy: { artifactKey: 'asc' },
    select: {
      artifactKey: true,
      assetSha256: true,
      verdict: true,
      evaluatorContractVersion: true,
      reason: true,
      regenCount: true,
      providerModel: true,
      evidence: true,
      contractHash: true,
      safetyOverride: true,
      safetyOverrideSha256: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.OrderSelect;

type RecoveryOrder = Prisma.OrderGetPayload<{
  select: typeof RELEASE_V1_RECOVERY_ORDER_SELECT;
}>;

export interface ReleaseV1RecoveryInput {
  mode: 'inspect' | 'apply';
  orderId: string;
  recoveryAttemptId: string;
  reason:
    | typeof RELEASE_V1_RECOVERY_REASON
    | typeof RELEASE_V1_PAGE_RERENDER_REASON;
  expectedOldReleaseContinuity: GenerationReleaseContinuityV1;
  expectedWizardProductBinding: WizardProductBindingV1;
  expectedArtifactInventory: {
    completedPageNumbers: number[];
    missingPageNumbers: number[];
  };
  /** Present only for the distinct reviewed one-page re-render recovery. */
  rerenderPageNumbers?: number[];
  expectedSnapshotDigest?: string;
}

export interface ReleaseV1RecoveryInspection {
  status: 'inspect_ready';
  orderId: string;
  snapshotDigest: string;
  failedAt: string;
  inputVersion: number;
  generationVersion: number;
  model: string;
  quality: string;
  oldReleaseContinuity: GenerationReleaseContinuityV1;
  targetReleaseContinuity: GenerationReleaseContinuityV1;
  wizardProductBinding: WizardProductBindingV1;
  inventory: {
    completedPageNumbers: number[];
    missingPageNumbers: number[];
  };
  retainedAssets: {
    cover: { url: string; sha256: string };
    pages: Array<{
      pageNumber: number;
      assetId: string;
      url: string;
      deliveredUrl: string;
      sha256: string;
    }>;
  };
  safetyReverification: Array<{
    artifactKey: string;
    pageNumber: number | null;
    sha256: string;
    qaContextDigest: string;
    evaluatorContractVersion: string;
    contractHash: string | null;
  }>;
  pageRerender?: {
    targets: Array<{
      artifactKey: string;
      pageNumber: number;
      assetId: string;
      sha256: string;
      sourceUrl: string;
      presentationUrl: string | null;
      rawUrl: string | null;
      deliveredUrl: string;
      provider: string;
      idempotencyKey: string;
      qaContextDigest: string;
      evidenceDigest: string;
      candidateId: string | null;
      evaluatorContractVersion: string;
      contractHash: string | null;
      priorAssetReceiptOperationKey: string | null;
      priorAssetReceiptPayloadHash: string | null;
      priorAssetReceiptResultDigest: string | null;
    }>;
    resumeInventory: {
      completedPageNumbers: number[];
      missingPageNumbers: number[];
    };
    effectiveResemblanceThreshold: number;
    readerBaseUrl: string;
  };
}

export type ReleaseV1RecoveryResult =
  | ReleaseV1RecoveryInspection
  | {
      status: 'resumed';
      orderId: string;
      recoveryAttemptId: string;
      snapshotDigest: string;
      targetReleaseContinuity: GenerationReleaseContinuityV1;
      dispatched: true;
      rerenderedPageNumbers?: number[];
    }
  | {
      status: 'already_resumed';
      orderId: string;
      recoveryAttemptId: string;
      snapshotDigest: string;
      targetReleaseContinuity: GenerationReleaseContinuityV1;
      dispatched: false;
      rerenderedPageNumbers?: number[];
    };

export class ReleaseV1RecoveryInputError extends Error {
  readonly code = 'release_v1_recovery_invalid_request' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ReleaseV1RecoveryInputError';
  }
}

export class ReleaseV1RecoveryError extends Error {
  readonly code = 'release_v1_recovery_rejected' as const;

  constructor(readonly reasons: readonly string[]) {
    const stable = [...new Set(reasons)].sort((left, right) =>
      left.localeCompare(right),
    );
    super(`[release_v1_recovery] ${stable.join('; ')}`);
    this.name = 'ReleaseV1RecoveryError';
  }
}

type RecoveryDeps = {
  db?: PrismaClient;
  inspect?: typeof inspectAsset;
  inspectWithBytes?: typeof inspectAssetWithBytes;
  evaluate?: (
    input: Parameters<typeof evaluatePageVisualQa>[0],
  ) => Promise<PageVisualQaResult>;
  evaluateWorld?: (
    input: Parameters<typeof evaluatePageWorldQa>[0],
  ) => Promise<PageWorldQaResult>;
  dispatch?: typeof chainGenerationWorker;
  probeWorker?: typeof probeReleaseV1WorkerReachability;
  qualifyRender?: typeof requireStyle01RenderQualification;
  assertBoards?: typeof requireSetIdentityBoardsBoundForRender;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
};

type RecoveryQualityEvidence = RecoveryOrder['qualityEvidence'][number];
type RecoveryPageUploadCandidate =
  RecoveryOrder['pageUploadCandidates'][number];

type SafetyReverificationTarget = {
  artifactKey: string;
  kind: 'cover' | 'page';
  pageNumber: number | null;
  pageId: string | null;
  assetId: string | null;
  sourceUrl: string;
  presentationUrl: string | null;
  deliveredUrl: string;
  sha256: string;
  qaContext: QaContext;
  qaContextDigest: string;
  evidence: RecoveryQualityEvidence;
  inspection: AssetInspectionWithBytes;
};

type PendingSafetyReverificationTarget = Omit<
  SafetyReverificationTarget,
  'sha256' | 'inspection'
> & {
  safetyContentSha256: string;
};

type PageRerenderTarget = Omit<
  PendingSafetyReverificationTarget,
  'kind' | 'pageNumber' | 'pageId' | 'assetId' | 'safetyContentSha256'
> & {
  kind: 'page';
  pageNumber: number;
  pageId: string;
  assetId: string;
  sha256: string;
  provider: string;
  rawUrl: string | null;
  idempotencyKey: string;
  evidenceDigest: string;
  candidate: RecoveryPageUploadCandidate | null;
  priorAssetReceipt: {
    operationKey: string;
    payloadHash: string;
    kind: string;
    resultDigest: string;
    createdAt: Date;
  } | null;
};

type SafetyReverificationProof = {
  target: SafetyReverificationTarget;
  visual: PageVisualQaResult;
  world: PageWorldQaResult | null;
};

type SafetyReverificationEvaluation =
  | { status: 'passed'; proofs: SafetyReverificationProof[] }
  | { status: 'confirmed_hazard'; proof: SafetyReverificationProof };

type RecoveryPlan = {
  order: RecoveryOrder;
  cache: PipelineCache;
  databaseSnapshotDigest: string;
  inspection: ReleaseV1RecoveryInspection;
  safetyReverificationTargets: SafetyReverificationTarget[];
  pageRerenderTargets: PageRerenderTarget[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const QA_CONTEXT_BOOLEAN_KEYS = [
  'expectsChild',
  'expectsCompanion',
  'isEmotionalClosing',
  'hasStructuredObjects',
  'hasRailedBedOrCrib',
  'hasHumanFamily',
] as const;

function exactHttpsOrigin(value: string | undefined): string | null {
  if (!value || value !== value.trim()) return null;
  const normalized = value.endsWith('/') ? value.slice(0, -1) : value;
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.origin !== normalized ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    return null;
  }
  return parsed.origin;
}

function parseStoredQaContext(
  evidence: Prisma.JsonValue | null,
): QaContext | null {
  if (!isRecord(evidence) || !isRecord(evidence.qaContext)) return null;
  const raw = evidence.qaContext;
  if (QA_CONTEXT_BOOLEAN_KEYS.some((key) => typeof raw[key] !== 'boolean')) {
    return null;
  }
  if (
    raw.expectedPageTimeOfDay !== null &&
    !isStoryTimeOfDay(raw.expectedPageTimeOfDay)
  ) {
    return null;
  }

  let worldExpectation: QaContext['worldExpectation'];
  if (raw.worldExpectation === undefined || raw.worldExpectation === null) {
    worldExpectation = raw.worldExpectation as null | undefined;
  } else {
    if (!isRecord(raw.worldExpectation)) return null;
    const world = raw.worldExpectation;
    if (
      typeof world.zoneDescription !== 'string' ||
      !Array.isArray(world.objects) ||
      !world.objects.every(
        (item) =>
          isRecord(item) &&
          typeof item.label === 'string' &&
          typeof item.identity === 'string',
      ) ||
      !Array.isArray(world.forbiddenScenes) ||
      !world.forbiddenScenes.every((item) => typeof item === 'string')
    ) {
      return null;
    }
    worldExpectation = {
      zoneDescription: world.zoneDescription,
      objects: world.objects.map((item) => ({
        label: (item as Record<string, unknown>).label as string,
        identity: (item as Record<string, unknown>).identity as string,
      })),
      forbiddenScenes: [...world.forbiddenScenes] as string[],
    };
  }

  return {
    expectsChild: raw.expectsChild as boolean,
    expectsCompanion: raw.expectsCompanion as boolean,
    expectedPageTimeOfDay: raw.expectedPageTimeOfDay,
    isEmotionalClosing: raw.isEmotionalClosing as boolean,
    hasStructuredObjects: raw.hasStructuredObjects as boolean,
    hasRailedBedOrCrib: raw.hasRailedBedOrCrib as boolean,
    hasHumanFamily: raw.hasHumanFamily as boolean,
    ...(worldExpectation === undefined ? {} : { worldExpectation }),
  };
}

function qualityEvidenceByArtifact(
  order: RecoveryOrder,
): Map<string, RecoveryQualityEvidence> {
  return new Map(order.qualityEvidence.map((row) => [row.artifactKey, row]));
}

function recoveryEvidenceDigest(evidence: RecoveryQualityEvidence): string {
  return canonicalJsonDigest({
    ...evidence,
    updatedAt: evidence.updatedAt.toISOString(),
  });
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => allowed.has(key));
}

function parsePageNumberList(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) {
    throw new ReleaseV1RecoveryInputError(`${label} must be an array`);
  }
  const parsed = value.map((item) => {
    if (!Number.isSafeInteger(item) || Number(item) <= 0) {
      throw new ReleaseV1RecoveryInputError(`${label} must contain positive integers`);
    }
    return Number(item);
  });
  const canonical = [...new Set(parsed)].sort((left, right) => left - right);
  if (JSON.stringify(parsed) !== JSON.stringify(canonical)) {
    throw new ReleaseV1RecoveryInputError(`${label} must be sorted and unique`);
  }
  return parsed;
}

export function parseReleaseV1RecoveryInput(value: unknown): ReleaseV1RecoveryInput {
  if (!isRecord(value)) {
    throw new ReleaseV1RecoveryInputError('request body must be an object');
  }
  const commonRequired = [
    'mode',
    'orderId',
    'recoveryAttemptId',
    'reason',
    'expectedOldReleaseContinuity',
    'expectedWizardProductBinding',
    'expectedArtifactInventory',
  ] as const;
  const pageRerender = value.reason === RELEASE_V1_PAGE_RERENDER_REASON;
  const required = pageRerender
    ? [...commonRequired, 'rerenderPageNumbers']
    : commonRequired;
  if (!exactKeys(value, required, ['expectedSnapshotDigest'])) {
    throw new ReleaseV1RecoveryInputError('request body keys are invalid');
  }
  if (value.mode !== 'inspect' && value.mode !== 'apply') {
    throw new ReleaseV1RecoveryInputError('mode must be inspect or apply');
  }
  if (typeof value.orderId !== 'string' || !value.orderId.trim()) {
    throw new ReleaseV1RecoveryInputError('orderId is required');
  }
  if (
    typeof value.recoveryAttemptId !== 'string' ||
    !UUID_RE.test(value.recoveryAttemptId)
  ) {
    throw new ReleaseV1RecoveryInputError('recoveryAttemptId must be a UUID v4');
  }
  if (
    value.reason !== RELEASE_V1_RECOVERY_REASON &&
    value.reason !== RELEASE_V1_PAGE_RERENDER_REASON
  ) {
    throw new ReleaseV1RecoveryInputError('reason is invalid');
  }
  if (!isRecord(value.expectedArtifactInventory) || !exactKeys(
    value.expectedArtifactInventory,
    ['completedPageNumbers', 'missingPageNumbers'],
  )) {
    throw new ReleaseV1RecoveryInputError('expectedArtifactInventory is invalid');
  }
  const expectedSnapshotDigest = value.expectedSnapshotDigest;
  if (
    value.mode === 'apply' &&
    (typeof expectedSnapshotDigest !== 'string' || !SHA256_RE.test(expectedSnapshotDigest))
  ) {
    throw new ReleaseV1RecoveryInputError(
      'apply requires expectedSnapshotDigest from a successful inspect',
    );
  }
  const rerenderPageNumbers = pageRerender
    ? parsePageNumberList(value.rerenderPageNumbers, 'rerenderPageNumbers')
    : undefined;
  if (pageRerender && rerenderPageNumbers?.length !== 1) {
    throw new ReleaseV1RecoveryInputError(
      'rerenderPageNumbers must contain exactly one page',
    );
  }
  if (
    expectedSnapshotDigest !== undefined &&
    (typeof expectedSnapshotDigest !== 'string' || !SHA256_RE.test(expectedSnapshotDigest))
  ) {
    throw new ReleaseV1RecoveryInputError('expectedSnapshotDigest is invalid');
  }
  const completedPageNumbers = parsePageNumberList(
    value.expectedArtifactInventory.completedPageNumbers,
    'completedPageNumbers',
  );
  const missingPageNumbers = parsePageNumberList(
    value.expectedArtifactInventory.missingPageNumbers,
    'missingPageNumbers',
  );
  if (
    completedPageNumbers.some((pageNumber) =>
      missingPageNumbers.includes(pageNumber),
    )
  ) {
    throw new ReleaseV1RecoveryInputError(
      'completedPageNumbers and missingPageNumbers must be disjoint',
    );
  }
  return {
    mode: value.mode,
    orderId: value.orderId.trim(),
    recoveryAttemptId: value.recoveryAttemptId.toLowerCase(),
    reason: value.reason,
    expectedOldReleaseContinuity: parseGenerationReleaseContinuityV1(
      value.expectedOldReleaseContinuity,
    ),
    expectedWizardProductBinding: parseWizardProductBindingV1(
      value.expectedWizardProductBinding,
    ),
    expectedArtifactInventory: {
      completedPageNumbers,
      missingPageNumbers,
    },
    ...(rerenderPageNumbers ? { rerenderPageNumbers } : {}),
    ...(typeof expectedSnapshotDigest === 'string'
      ? { expectedSnapshotDigest }
      : {}),
  };
}

function reject(...reasons: string[]): never {
  throw new ReleaseV1RecoveryError(reasons);
}

function sha256Text(value: string | null): string | null {
  return value == null
    ? null
    : createHash('sha256').update(value, 'utf8').digest('hex');
}

function databaseSnapshotDigest(order: RecoveryOrder): string {
  const job = order.generationJob;
  return canonicalJsonDigest({
    order: {
      id: order.id,
      status: order.status,
      inputVersion: order.inputVersion,
      deliveryFenceVersion: order.deliveryFenceVersion,
      visualContractHash: order.visualContractHash,
      updatedAt: order.updatedAt.toISOString(),
      expectedPageCount: order.expectedPageCount,
      totalPrice: order.totalPrice,
      paymentProvider: order.paymentProvider,
      paymentId: order.paymentId,
      audioEnabled: order.audioEnabled,
      videoEnabled: order.videoEnabled,
      bundleEnabled: order.bundleEnabled,
      selectedVoice: order.selectedVoice,
      payment: order.payment
        ? {
            ...order.payment,
            paidAt: order.payment.paidAt?.toISOString() ?? null,
          }
        : null,
      textStatus: order.textStatus,
      imageStatus: order.imageStatus,
      audioStatus: order.audioStatus,
      packageStatus: order.packageStatus,
      deliveryHoldReason: order.deliveryHoldReason,
      manualReviewRequired: order.manualReviewRequired,
      lastError: order.lastError,
      errorAt: order.errorAt?.toISOString() ?? null,
      selectionFilename: order.selectionFilename,
      storySourceHash: order.storySourceHash,
      illustrationStyle: order.illustrationStyle,
      visualPackageAuthority: order.visualPackageAuthority,
    },
    job: job
      ? {
          ...job,
          leaseExpiresAt: job.leaseExpiresAt?.toISOString() ?? null,
          failedAt: job.failedAt?.toISOString() ?? null,
          updatedAt: job.updatedAt.toISOString(),
        }
      : null,
    book: order.book,
    exceptionCases: order.exceptionCases.map((exceptionCase) => ({
      ...exceptionCase,
      nextActionAt: exceptionCase.nextActionAt?.toISOString() ?? null,
      actionAttemptedAt:
        exceptionCase.actionAttemptedAt?.toISOString() ?? null,
      notificationAttemptedAt:
        exceptionCase.notificationAttemptedAt?.toISOString() ?? null,
      leaseExpiresAt: exceptionCase.leaseExpiresAt?.toISOString() ?? null,
      updatedAt: exceptionCase.updatedAt.toISOString(),
    })),
    humanQaReviewCases: order.humanQaReviewCases,
    qualityEvidence: order.qualityEvidence.map((row) => ({
      ...row,
      updatedAt: row.updatedAt.toISOString(),
    })),
    pageUploadCandidates: order.pageUploadCandidates.map((candidate) => ({
      ...candidate,
      createdAt: candidate.createdAt.toISOString(),
      updatedAt: candidate.updatedAt.toISOString(),
    })),
  });
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pageRange(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

function requestedRerenderPageNumbers(
  input: ReleaseV1RecoveryInput,
): number[] {
  return input.reason === RELEASE_V1_PAGE_RERENDER_REASON
    ? [...(input.rerenderPageNumbers ?? [])]
    : [];
}

function auditedRerenderPageNumbers(
  attempt: NonNullable<PipelineCache['releaseRecovery']>['attempts'][number],
): number[] {
  return (attempt.rerenderedArtifacts ?? [])
    .map((artifact) => artifact.pageNumber)
    .sort((left, right) => left - right);
}

function requireObjectCache(value: Prisma.JsonValue | null): PipelineCache {
  if (!isRecord(value)) reject('generation job pipeline cache is missing or invalid');
  return value as PipelineCache;
}

function requireSuccessfulInspection(
  label: string,
  inspection: AssetInspection,
): asserts inspection is AssetInspection & { sha256: string } {
  if (!inspection.ok || !inspection.sha256) {
    reject(`${label} failed retained-byte inspection: ${inspection.error ?? 'invalid_image'}`);
  }
}

function readExistingAttempt(args: {
  input: ReleaseV1RecoveryInput;
  order: RecoveryOrder;
  cache: PipelineCache;
  targetContinuity: GenerationReleaseContinuityV1;
}): ReleaseV1RecoveryResult | null {
  const recoveryLog = args.cache.releaseRecovery;
  if (!recoveryLog) return null;
  if (recoveryLog.version !== RELEASE_V1_RECOVERY_LOG_VERSION) {
    reject('durable recovery log version is invalid');
  }
  if (!Array.isArray(recoveryLog.attempts)) {
    reject('durable recovery log attempts are invalid');
  }
  const matching = recoveryLog.attempts.filter(
    (attempt) => attempt.attemptId === args.input.recoveryAttemptId,
  );
  if (matching.length > 1) reject('durable recovery attempt is duplicated');
  const recovery = matching[0];
  if (!recovery) return null;
  const expectedSnapshotDigest = args.input.expectedSnapshotDigest;
  const expectedOldDigest = canonicalJsonDigest(
    args.input.expectedOldReleaseContinuity,
  );
  const targetDigest = canonicalJsonDigest(args.targetContinuity);
  const durableContinuity = parseGenerationReleaseContinuityV1(
    args.cache.releaseContinuity,
  );
  const reasons: string[] = [];
  if (args.input.mode !== 'apply') {
    reasons.push('an applied recovery attempt cannot be inspected as a fresh attempt');
  }
  if (expectedSnapshotDigest !== recovery.snapshotDigest) {
    reasons.push('recovery attempt snapshot digest differs from the durable audit');
  }
  if (recovery.oldContinuityDigest !== expectedOldDigest) {
    reasons.push('recovery attempt old continuity differs from the durable audit');
  }
  if (recovery.reason !== args.input.reason) {
    reasons.push('recovery attempt reason differs from the durable audit');
  }
  if (
    !sameNumbers(
      auditedRerenderPageNumbers(recovery),
      requestedRerenderPageNumbers(args.input),
    )
  ) {
    reasons.push('recovery attempt page re-render target differs from the durable audit');
  }
  if (
    recovery.newContinuityDigest !== targetDigest ||
    canonicalJsonDigest(durableContinuity) !== targetDigest
  ) {
    reasons.push('recovery attempt target continuity differs from this deployment');
  }
  if (args.order.generationJob?.status === 'failed') {
    reasons.push('the same recovery attempt failed; use a new reviewed attempt UUID');
  } else if (
    !args.order.generationJob ||
    !['pending', 'running', 'done'].includes(args.order.generationJob.status)
  ) {
    reasons.push('recovery attempt is not in an idempotent resumed state');
  }
  if (reasons.length > 0) throw new ReleaseV1RecoveryError(reasons);
  return {
    status: 'already_resumed',
    orderId: args.order.id,
    recoveryAttemptId: args.input.recoveryAttemptId,
    snapshotDigest: recovery.snapshotDigest,
    targetReleaseContinuity: args.targetContinuity,
    dispatched: false,
    ...(auditedRerenderPageNumbers(recovery).length > 0
      ? { rerenderedPageNumbers: auditedRerenderPageNumbers(recovery) }
      : {}),
  };
}

async function loadOrder(db: PrismaClient, orderId: string): Promise<RecoveryOrder> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: RELEASE_V1_RECOVERY_ORDER_SELECT,
  });
  if (!order) reject('order not found');
  return order;
}

async function prepareRecoveryPlan(
  input: ReleaseV1RecoveryInput,
  deps: Required<
    Pick<
      RecoveryDeps,
      | 'db'
      | 'inspect'
      | 'inspectWithBytes'
      | 'qualifyRender'
      | 'assertBoards'
      | 'now'
      | 'env'
    >
  >,
): Promise<RecoveryPlan | ReleaseV1RecoveryResult> {
  const order = await loadOrder(deps.db, input.orderId);
  const job = order.generationJob;
  if (!job) reject('generation job is missing');
  const cache = requireObjectCache(job.pipelineCache);
  const targetContinuity = buildGenerationReleaseContinuityV1(deps.env);
  const binding = requireExpectedWizardProductBinding({
    order,
    expected: input.expectedWizardProductBinding,
  });
  const rerenderPageNumbers = requestedRerenderPageNumbers(input);

  const duplicate = readExistingAttempt({
    input,
    order,
    cache,
    targetContinuity,
  });
  if (duplicate) return duplicate;

  const reasons: string[] = [];
  if (order.status !== 'failed') reasons.push('order status must be failed');
  if (order.textStatus !== 'done') reasons.push('order text status must be done');
  if (order.imageStatus !== 'failed') reasons.push('order image status must be failed');
  if (order.audioStatus !== 'pending') reasons.push('order audio status must be pending');
  if (order.packageStatus !== 'pending') reasons.push('order package status must be pending');
  if (order.deliveryHoldReason != null) reasons.push('order has a delivery hold');
  if (order.manualReviewRequired) reasons.push('order requires manual review');
  if (!order.paymentProvider?.trim() || !order.paymentId?.trim()) {
    reasons.push('order payment identity is missing');
  }
  if (
    !order.payment?.paid ||
    !order.payment.paidAt ||
    order.payment.provider !== order.paymentProvider ||
    order.payment.amount !== order.totalPrice ||
    order.payment.currency.toLowerCase() !== 'ils'
  ) {
    reasons.push('paid payment record does not match the order');
  }
  if (job.status !== 'failed' || job.currentStage !== 'failed') {
    reasons.push('generation job must be failed at the failed stage');
  }
  if (!job.retryable) reasons.push('generation job is not retryable');
  if (job.lockedBy != null) reasons.push('generation job still has a worker lock');
  const now = deps.now();
  if (job.leaseExpiresAt && job.leaseExpiresAt.getTime() > now.getTime()) {
    reasons.push('generation job still has a live lease');
  }
  if (!job.failedAt) reasons.push('generation job failedAt is missing');
  if (!job.textDone) reasons.push('generation job text stage is incomplete');
  if (job.imagesDone) reasons.push('generation job images stage is already complete');
  if (job.audioDone || job.packaged) {
    reasons.push('generation job has impossible downstream completion state');
  }
  if (job.generationVersion !== GENERATION_VERSION) {
    reasons.push('generation version differs from the current recovery runtime');
  }
  if (cache.renderImagePageLimit !== undefined) {
    reasons.push('renderImagePageLimit is forbidden for release recovery');
  }
  if (deps.env.CHUNKED_IMAGE_PAGE_FILTER?.trim()) {
    reasons.push('CHUNKED_IMAGE_PAGE_FILTER must be empty for release recovery');
  }
  if (deps.env.GENERATION_ANCHOR_ONLY === 'true') {
    reasons.push('GENERATION_ANCHOR_ONLY must be disabled for release recovery');
  }
  if (
    deps.env.STYLE_01_AUDITION_MODE?.trim().toLowerCase() === 'true'
  ) {
    reasons.push('STYLE_01_AUDITION_MODE must be disabled for release recovery');
  }
  if (deps.env.GENERATION_DISABLE_SELF_CHAIN === 'true') {
    reasons.push('GENERATION_DISABLE_SELF_CHAIN must be disabled for release recovery');
  }
  if (
    rerenderPageNumbers.length > 0 &&
    !deps.env.GENERATION_SECRET?.trim()
  ) {
    reasons.push('GENERATION_SECRET is required for release recovery self-chain');
  }
  if (
    rerenderPageNumbers.length > 0 &&
    deps.env.PHASE2_STYLE01_BOOK_PIPELINE !== 'true'
  ) {
    reasons.push('PHASE2_STYLE01_BOOK_PIPELINE must be true for page re-render recovery');
  }
  if (
    rerenderPageNumbers.length > 0 &&
    deps.env.DISABLE_IMAGE_GENERATION === 'true'
  ) {
    reasons.push('DISABLE_IMAGE_GENERATION must be false for page re-render recovery');
  }
  if (rerenderPageNumbers.length > 0) {
    for (const variableName of [
      'OPENAI_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ] as const) {
      if (!deps.env[variableName]?.trim()) {
        reasons.push(`${variableName} is required for page re-render recovery`);
      }
    }
    const needsAudio =
      (order.audioEnabled || order.videoEnabled || order.bundleEnabled) &&
      Boolean(order.selectedVoice?.trim());
    if (needsAudio && !deps.env.ELEVENLABS_API_KEY?.trim()) {
      reasons.push('ELEVENLABS_API_KEY is required for this audio-enabled recovery');
    }
  }
  if (
    rerenderPageNumbers.length > 0 &&
    deps.env.READINESS_MANIFEST_ENABLED !== 'true'
  ) {
    reasons.push(
      'READINESS_MANIFEST_ENABLED must be true for fenced page re-render recovery',
    );
  }
  if (
    rerenderPageNumbers.length > 0 &&
    !deps.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()
  ) {
    reasons.push(
      'VERCEL_AUTOMATION_BYPASS_SECRET is required for protected Preview self-chain',
    );
  }
  const readerBaseUrl = exactHttpsOrigin(deps.env.NEXT_PUBLIC_APP_URL);
  if (rerenderPageNumbers.length > 0 && !readerBaseUrl) {
    reasons.push(
      'NEXT_PUBLIC_APP_URL must be an exact HTTPS reader origin for page re-render recovery',
    );
  }
  if (
    rerenderPageNumbers.length > 0 &&
    deps.env.PAGE_VISUAL_QA_ENABLED !== 'true'
  ) {
    reasons.push(
      'PAGE_VISUAL_QA_ENABLED must be explicitly true for page re-render recovery',
    );
  }
  if (
    rerenderPageNumbers.length > 0 &&
    deps.env.QA_SOFT_DELIVER !== 'false'
  ) {
    reasons.push(
      'QA_SOFT_DELIVER must be explicitly false for page re-render recovery',
    );
  }
  const effectiveStyle01RefConfig = (
    deps.env.PHASE2_STYLE01_REF_CONFIG ??
    deps.env.PHASE2_STYLE02_REF_CONFIG ??
    'A'
  )
    .trim()
    .toUpperCase();
  if (
    rerenderPageNumbers.length > 0 &&
    effectiveStyle01RefConfig !== 'A'
  ) {
    reasons.push(
      'effective PHASE2_STYLE01_REF_CONFIG must be A for page re-render recovery',
    );
  }
  if (cache.textFinalized !== true) {
    reasons.push('frozen story text is missing from the generation cache');
  }
  if (!cache.dna || !isRecord(cache.dna)) {
    reasons.push('generation DNA is missing from the generation cache');
  } else if (
    typeof cache.dna.childDNA !== 'string' ||
    !cache.dna.childDNA.trim()
  ) {
    reasons.push('generation child DNA is missing from the generation cache');
  }
  if (cache.childAnchorApproved !== true) {
    reasons.push('approved child anchor is missing from the generation cache');
  }
  const approvedChildAnchor = getApprovedChildCanonicalAnchor(cache);
  if (!approvedChildAnchor?.url) {
    reasons.push('approved child canonical anchor is missing from the generation cache');
  } else if (!isAllowedAssetUrl(approvedChildAnchor.url)) {
    reasons.push('approved child canonical anchor URL is not allowlisted');
  }
  if (!isRecord(cache.visualContract)) {
    reasons.push('frozen visual contract is missing from the generation cache');
  }
  if (!isRecord(cache.visualPackageAuthority)) {
    reasons.push('frozen visual package authority is missing from the generation cache');
  } else if (
    canonicalJsonDigest(cache.visualPackageAuthority) !==
    binding.packageAuthorityDigest
  ) {
    reasons.push('cached visual package authority differs from the frozen Order package');
  }
  if (!isRecord(cache.setIdentityBoards)) {
    reasons.push('bound set identity boards are missing from the generation cache');
  }
  if (binding.styleId !== STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK) {
    reasons.push('release recovery currently supports only Style 01');
  }

  let oldContinuity: GenerationReleaseContinuityV1 | null = null;
  try {
    oldContinuity = parseGenerationReleaseContinuityV1(cache.releaseContinuity);
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : String(error));
  }
  if (
    oldContinuity &&
    canonicalJsonDigest(oldContinuity) !==
      canonicalJsonDigest(input.expectedOldReleaseContinuity)
  ) {
    reasons.push('old release continuity differs from the expected failed deployment');
  }
  if (
    oldContinuity &&
    canonicalJsonDigest(oldContinuity) === canonicalJsonDigest(targetContinuity)
  ) {
    reasons.push('recovery must move to a different immutable deployment');
  }

  for (const exceptionCase of order.exceptionCases) {
    if (
      exceptionCase.kind !== 'infra_transient' ||
      exceptionCase.scope !== EXCEPTION_SCOPE_BASE_BOOK ||
      !exceptionCase.sourceRef?.startsWith(`generation:${order.id}:`) ||
      !['open', 'retry_scheduled'].includes(exceptionCase.status) ||
      exceptionCase.actionAttemptedAt != null ||
      exceptionCase.notificationAttemptedAt != null
    ) {
      reasons.push(`protected exception case blocks recovery: ${exceptionCase.id}`);
    }
    if (
      exceptionCase.leaseExpiresAt &&
      exceptionCase.leaseExpiresAt.getTime() > now.getTime()
    ) {
      reasons.push(`live exception lease blocks recovery: ${exceptionCase.id}`);
    }
  }
  if (order.humanQaReviewCases.length > 0) {
    reasons.push('an open human QA review case blocks recovery');
  }
  if (rerenderPageNumbers.length > 0) {
    for (const prior of cache.releaseRecovery?.attempts ?? []) {
      const alreadyRerendered = auditedRerenderPageNumbers(prior);
      if (
        rerenderPageNumbers.some((pageNumber) =>
          alreadyRerendered.includes(pageNumber),
        )
      ) {
        reasons.push(
          `page ${rerenderPageNumbers[0]} was already replaced by reviewed release recovery`,
        );
      }
    }
  }

  const expectedPageCount = order.expectedPageCount;
  if (!Number.isSafeInteger(expectedPageCount) || Number(expectedPageCount) <= 0) {
    reasons.push('expected page count is missing or invalid');
  }
  if (!order.book) reasons.push('generated book is missing');
  if (reasons.length > 0 || !oldContinuity || !job.failedAt || !order.book || !expectedPageCount) {
    throw new ReleaseV1RecoveryError(reasons);
  }

  const evidenceByArtifact = qualityEvidenceByArtifact(order);
  const pendingSafetyReverification: PendingSafetyReverificationTarget[] = [];
  const registerUnverifiedSafety = (args: {
    artifactKey: string;
    kind: 'cover' | 'page';
    pageNumber: number | null;
    pageId: string | null;
    assetId: string | null;
    sourceUrl: string;
    presentationUrl: string | null;
    deliveredUrl: string;
    safetyContentSha256: string | null;
    safetyOverriddenHazards: string[];
    safetyOverrideSha256: string | null;
  }): void => {
    const evidence = evidenceByArtifact.get(args.artifactKey);
    const qaContext = evidence
      ? parseStoredQaContext(evidence.evidence)
      : null;
    if (!SHA256_RE.test(args.safetyContentSha256 ?? '')) {
      reasons.push(`${args.artifactKey} unverified safety signal has no valid byte binding`);
    }
    if (
      args.safetyOverriddenHazards.length > 0 ||
      args.safetyOverrideSha256 != null
    ) {
      reasons.push(`${args.artifactKey} unverified safety signal has an override`);
    }
    if (!evidence) {
      reasons.push(`${args.artifactKey} quality evidence is missing`);
    } else {
      if (evidence.evaluatorContractVersion !== QUALITY_EVALUATOR_CONTRACT_VERSION) {
        reasons.push(`${args.artifactKey} quality evaluator contract is stale`);
      }
      if (evidence.contractHash !== order.visualContractHash) {
        reasons.push(`${args.artifactKey} quality evidence contract binding is stale`);
      }
      if (evidence.assetSha256 !== args.safetyContentSha256) {
        reasons.push(`${args.artifactKey} quality evidence byte binding differs from safety`);
      }
      if (!['passed', 'evidence_unknown'].includes(evidence.verdict)) {
        reasons.push(`${args.artifactKey} has a confirmed quality failure`);
      }
      if (evidence.safetyOverride || evidence.safetyOverrideSha256 != null) {
        reasons.push(`${args.artifactKey} quality evidence has an override`);
      }
      if (!qaContext) {
        reasons.push(`${args.artifactKey} stored QA context is missing or invalid`);
      }
    }
    if (
      SHA256_RE.test(args.safetyContentSha256 ?? '') &&
      args.safetyOverriddenHazards.length === 0 &&
      args.safetyOverrideSha256 == null &&
      evidence &&
      evidence.evaluatorContractVersion === QUALITY_EVALUATOR_CONTRACT_VERSION &&
      evidence.contractHash === order.visualContractHash &&
      evidence.assetSha256 === args.safetyContentSha256 &&
      ['passed', 'evidence_unknown'].includes(evidence.verdict) &&
      !evidence.safetyOverride &&
      evidence.safetyOverrideSha256 == null &&
      qaContext
    ) {
      pendingSafetyReverification.push({
        artifactKey: args.artifactKey,
        kind: args.kind,
        pageNumber: args.pageNumber,
        pageId: args.pageId,
        assetId: args.assetId,
        sourceUrl: args.sourceUrl,
        presentationUrl: args.presentationUrl,
        deliveredUrl: args.deliveredUrl,
        safetyContentSha256: args.safetyContentSha256!,
        qaContext,
        qaContextDigest: canonicalJsonDigest(qaContext),
        evidence,
      });
    }
  };

  const allPages = pageRange(expectedPageCount);
  const actualBookPages = order.book.pages.map((page) => page.pageNumber);
  if (!sameNumbers(actualBookPages, allPages)) {
    reasons.push('book pages are not the exact expected contiguous range');
  }
  const completedPageNumbers = order.book.pages
    .filter((page) => page.imageAsset != null)
    .map((page) => page.pageNumber);
  const missingPageNumbers = order.book.pages
    .filter((page) => page.imageAsset == null)
    .map((page) => page.pageNumber);
  if (
    rerenderPageNumbers.some(
      (pageNumber) => !completedPageNumbers.includes(pageNumber),
    )
  ) {
    reasons.push('page re-render target is not a completed page');
  }
  if (
    !sameNumbers(
      completedPageNumbers,
      input.expectedArtifactInventory.completedPageNumbers,
    ) ||
    !sameNumbers(
      missingPageNumbers,
      input.expectedArtifactInventory.missingPageNumbers,
    )
  ) {
    reasons.push('persisted artifact inventory differs from the reviewed expectation');
  }
  const inventoryUnion = [
    ...input.expectedArtifactInventory.completedPageNumbers,
    ...input.expectedArtifactInventory.missingPageNumbers,
  ].sort((left, right) => left - right);
  if (!sameNumbers(inventoryUnion, allPages)) {
    reasons.push('reviewed artifact inventory does not cover the exact page range');
  }
  if (rerenderPageNumbers.length > 0) {
    const recoveryPageNumbers = [
      ...new Set([...missingPageNumbers, ...rerenderPageNumbers]),
    ].sort((left, right) => left - right);
    let renderQualified = false;
    try {
      deps.qualifyRender({
        illustrationStyle: order.illustrationStyle,
        frozenContractHash: order.visualContractHash,
        storySourceHash: order.storySourceHash,
        order,
        cache,
        pageNumbers: recoveryPageNumbers,
      });
      renderQualified = true;
    } catch {
      reasons.push('frozen render qualification failed for recovery pages');
    }
    if (renderQualified) {
      try {
        await deps.assertBoards(order as unknown as Order, cache);
      } catch {
        reasons.push('set identity boards are not render-ready for recovery pages');
      }
    }
  }
  if (!isAllowedAssetUrl(order.book.coverImageUrl)) {
    reasons.push('retained cover URL is missing or not allowlisted');
  }
  if (order.book.coverSafetyHazards.length > 0) {
    reasons.push('retained cover has confirmed safety hazards');
  } else if (!order.book.coverSafetyVerified && order.book.coverImageUrl) {
    registerUnverifiedSafety({
      artifactKey: 'cover',
      kind: 'cover',
      pageNumber: null,
      pageId: null,
      assetId: null,
      sourceUrl: order.book.coverImageUrl,
      presentationUrl: null,
      deliveredUrl: order.book.coverImageUrl,
      safetyContentSha256: order.book.coverSafetyContentSha256,
      safetyOverriddenHazards: order.book.coverSafetyOverriddenHazards,
      safetyOverrideSha256: order.book.coverSafetyOverrideSha256,
    });
  }
  for (const candidate of order.pageUploadCandidates) {
    if (missingPageNumbers.includes(candidate.pageNumber)) {
      reasons.push(
        `missing page ${candidate.pageNumber} has a persisted upload candidate`,
      );
    }
  }

  const configuredModel = deps.env.STYLE_01_GPT_MODEL?.trim();
  if (configuredModel !== 'gpt-image-2') {
    reasons.push(
      'STYLE_01_GPT_MODEL must be explicitly pinned to gpt-image-2 for release recovery',
    );
  }
  const model = configuredModel || '(unconfigured)';
  const configuredQuality = deps.env.GPT_IMAGE_QUALITY;
  const quality = (configuredQuality?.trim() || 'low').toLowerCase();
  if (rerenderPageNumbers.length > 0 && quality !== 'low') {
    reasons.push('page re-render recovery is restricted to low image quality');
  } else if (
    rerenderPageNumbers.length > 0 &&
    configuredQuality !== 'low'
  ) {
    reasons.push(
      'GPT_IMAGE_QUALITY must be exactly low for stable page idempotency keys',
    );
  }
  let effectiveResemblanceThreshold = Number.NaN;
  if (rerenderPageNumbers.length > 0) {
    try {
      effectiveResemblanceThreshold = resolveEffectiveThreshold(
        normalizeStyleId(order.illustrationStyle).toLowerCase(),
        resolveResemblanceThresholdConfig(deps.env),
      );
      if (effectiveResemblanceThreshold !== 0.7) {
        reasons.push(
          'page re-render recovery requires an effective resemblance threshold of 0.70',
        );
      }
    } catch {
      reasons.push('page re-render recovery resemblance threshold is invalid');
    }
  }
  if (job.model?.trim() && job.model.trim() !== model) {
    reasons.push('generation job model differs from the current recovery runtime');
  }
  if (job.quality?.trim() && job.quality.trim() !== quality) {
    reasons.push('generation job quality differs from the current recovery runtime');
  }
  for (const page of order.book.pages) {
    const asset = page.imageAsset;
    if (!asset) continue;
    if (!isAllowedAssetUrl(asset.url)) {
      reasons.push(`page ${page.pageNumber} source asset URL is not allowlisted`);
    }
    if (asset.presentationUrl && !isAllowedAssetUrl(asset.presentationUrl)) {
      reasons.push(`page ${page.pageNumber} presentation asset URL is not allowlisted`);
    }
    if (asset.safetyHazards.length > 0) {
      reasons.push(`page ${page.pageNumber} has confirmed safety hazards`);
    } else if (!asset.safetyVerified) {
      registerUnverifiedSafety({
        artifactKey: `page:${page.pageNumber}`,
        kind: 'page',
        pageNumber: page.pageNumber,
        pageId: page.id,
        assetId: asset.id,
        sourceUrl: asset.url,
        presentationUrl: asset.presentationUrl,
        deliveredUrl: asset.presentationUrl ?? asset.url,
        safetyContentSha256: asset.safetyContentSha256,
        safetyOverriddenHazards: asset.safetyOverriddenHazards,
        safetyOverrideSha256: asset.safetyOverrideSha256,
      });
    }
    const expectedKey = buildArtifactIdempotencyKey({
      orderId: order.id,
      kind: 'page_image',
      pageNumber: page.pageNumber,
      model,
      quality,
      generationVersion: GENERATION_VERSION,
    });
    if (asset.idempotencyKey !== expectedKey) {
      reasons.push(`page ${page.pageNumber} idempotency contract differs from this runtime`);
    }
  }
  const rerenderArtifactKeys = new Set(
    rerenderPageNumbers.map((pageNumber) => `page:${pageNumber}`),
  );
  if (rerenderPageNumbers.length > 0) {
    const selectedPending = pendingSafetyReverification.filter((target) =>
      rerenderArtifactKeys.has(target.artifactKey),
    );
    if (selectedPending.length !== 1) {
      reasons.push(
        'page re-render target is not an eligible safety-unverified artifact',
      );
    }
    if (pendingSafetyReverification.length !== selectedPending.length) {
      reasons.push(
        'page re-render recovery requires the selected page to be the sole unverified artifact',
      );
    }
    const selected = selectedPending[0];
    if (selected) {
      if (
        selected.evidence.verdict !== 'evidence_unknown' ||
        !selected.evidence.reason?.includes('safety:unverified')
      ) {
        reasons.push(
          'page re-render target must have safety-unverified quality evidence',
        );
      }
      const evidencePayload = isRecord(selected.evidence.evidence)
        ? selected.evidence.evidence
        : null;
      if (evidencePayload?.deliveredUrl !== selected.deliveredUrl) {
        reasons.push(
          'page re-render target QA context is bound to a different delivered URL',
        );
      }
      const candidates = order.pageUploadCandidates.filter(
        (candidate) => candidate.pageNumber === selected.pageNumber,
      );
      if (candidates.length > 1) {
        reasons.push('page re-render target has duplicate upload candidates');
      }
      const page = order.book.pages.find(
        (item) => item.pageNumber === selected.pageNumber,
      );
      const candidate = candidates[0];
      if (
        candidate &&
        (!page?.imageAsset ||
          candidate.url !== page.imageAsset.url ||
          candidate.provider !== page.imageAsset.provider ||
          candidate.rawUrl !== page.imageAsset.rawUrl)
      ) {
        reasons.push(
          'page re-render upload candidate differs from the current page asset',
        );
      }
    }
  }
  if (reasons.length > 0) throw new ReleaseV1RecoveryError(reasons);

  const retainedPages = order.book.pages.filter(
    (page): page is typeof page & { imageAsset: NonNullable<typeof page.imageAsset> } =>
      page.imageAsset != null,
  );
  const safetyReverificationPending = pendingSafetyReverification.filter(
    (target) => !rerenderArtifactKeys.has(target.artifactKey),
  );
  const pendingByArtifact = new Map(
    safetyReverificationPending.map((target) => [target.artifactKey, target]),
  );
  const coverInspection = pendingByArtifact.has('cover')
    ? await deps.inspectWithBytes(order.book.coverImageUrl)
    : await deps.inspect(order.book.coverImageUrl);
  const pageInspections: AssetInspection[] = [];
  for (const page of retainedPages) {
    const artifactKey = `page:${page.pageNumber}`;
    const deliveredUrl = page.imageAsset.presentationUrl ?? page.imageAsset.url;
    pageInspections.push(
      pendingByArtifact.has(artifactKey)
        ? await deps.inspectWithBytes(deliveredUrl)
        : await deps.inspect(deliveredUrl),
    );
  }
  requireSuccessfulInspection('cover', coverInspection);
  if (order.book.coverSafetyContentSha256 !== coverInspection.sha256) {
    reject('cover retained-byte hash differs from its durable safety binding');
  }
  for (let index = 0; index < retainedPages.length; index += 1) {
    requireSuccessfulInspection(
      `page ${retainedPages[index]!.pageNumber}`,
      pageInspections[index]!,
    );
    if (
      retainedPages[index]!.imageAsset.safetyContentSha256 !==
      pageInspections[index]!.sha256
    ) {
      reject(
        `page ${retainedPages[index]!.pageNumber} retained-byte hash differs from its durable safety binding`,
      );
    }
  }

  const safetyReverificationTargets: SafetyReverificationTarget[] = [];
  for (const pending of safetyReverificationPending) {
    const inspection =
      pending.kind === 'cover'
        ? coverInspection
        : pageInspections[
            retainedPages.findIndex(
              (page) => page.pageNumber === pending.pageNumber,
            )
          ];
    const inspectionWithBytes = inspection as
      | AssetInspectionWithBytes
      | undefined;
    if (
      !inspectionWithBytes ||
      !inspectionWithBytes.data ||
      !inspectionWithBytes.mime ||
      inspectionWithBytes.sha256 !== pending.safetyContentSha256
    ) {
      reject(`${pending.artifactKey} exact bytes are unavailable for safety re-verification`);
    }
    safetyReverificationTargets.push({
      ...pending,
      sha256: inspectionWithBytes.sha256!,
      inspection: inspectionWithBytes,
    });
  }

  const pageRerenderTargets: PageRerenderTarget[] = [];
  for (const pending of pendingSafetyReverification) {
    if (!rerenderArtifactKeys.has(pending.artifactKey)) continue;
    if (
      pending.kind !== 'page' ||
      pending.pageNumber == null ||
      !pending.pageId ||
      !pending.assetId
    ) {
      reject('page re-render target is not a page asset');
    }
    const pageIndex = retainedPages.findIndex(
      (page) => page.pageNumber === pending.pageNumber,
    );
    const retainedPage = retainedPages[pageIndex];
    const inspection = pageInspections[pageIndex];
    if (
      !retainedPage ||
      !inspection?.sha256 ||
      inspection.sha256 !== pending.safetyContentSha256 ||
      !retainedPage.imageAsset.idempotencyKey
    ) {
      reject(
        `${pending.artifactKey} exact bytes are unavailable for page re-render audit`,
      );
    }
    const candidate =
      order.pageUploadCandidates.find(
        (item) => item.pageNumber === pending.pageNumber,
      ) ?? null;
    const priorAssetOperationKey = pageAssetOperationKey(
      order.id,
      pending.pageNumber,
      pending.deliveredUrl,
      order.visualContractHash,
    );
    const priorAssetReceipt = await deps.db.atomicOperationReceipt.findUnique({
      where: { operationKey: priorAssetOperationKey },
      select: {
        operationKey: true,
        orderId: true,
        payloadHash: true,
        kind: true,
        result: true,
        createdAt: true,
      },
    });
    if (priorAssetReceipt && priorAssetReceipt.orderId !== order.id) {
      reject('page asset receipt belongs to a different order');
    }
    pageRerenderTargets.push({
      ...pending,
      kind: 'page',
      pageNumber: pending.pageNumber,
      pageId: pending.pageId,
      assetId: pending.assetId,
      sha256: inspection.sha256,
      provider: retainedPage.imageAsset.provider,
      rawUrl: retainedPage.imageAsset.rawUrl,
      idempotencyKey: retainedPage.imageAsset.idempotencyKey,
      evidenceDigest: recoveryEvidenceDigest(pending.evidence),
      candidate,
      priorAssetReceipt: priorAssetReceipt
        ? {
            operationKey: priorAssetReceipt.operationKey,
            payloadHash: priorAssetReceipt.payloadHash,
            kind: priorAssetReceipt.kind,
            resultDigest: canonicalJsonDigest(priorAssetReceipt.result),
            createdAt: priorAssetReceipt.createdAt,
          }
        : null,
    });
  }

  const resumeCompletedPageNumbers = completedPageNumbers.filter(
    (pageNumber) => !rerenderPageNumbers.includes(pageNumber),
  );
  const resumeMissingPageNumbers = [
    ...new Set([...missingPageNumbers, ...rerenderPageNumbers]),
  ].sort((left, right) => left - right);

  const retainedPageEvidence = retainedPages.map((page, index) => ({
    pageNumber: page.pageNumber,
    assetId: page.imageAsset.id,
    url: page.imageAsset.url,
    deliveredUrl: page.imageAsset.presentationUrl ?? page.imageAsset.url,
    sha256: pageInspections[index]!.sha256!,
  }));
  const dbSnapshotDigest = databaseSnapshotDigest(order);
  const snapshotDigest = canonicalJsonDigest({
    version: 'release-v1-recovery-snapshot/v1',
    recoveryAttemptId: input.recoveryAttemptId,
    reason: input.reason,
    orderId: order.id,
    expectedOldReleaseContinuity: input.expectedOldReleaseContinuity,
    expectedWizardProductBinding: input.expectedWizardProductBinding,
    expectedArtifactInventory: input.expectedArtifactInventory,
    rerenderPageNumbers,
    databaseSnapshotDigest: dbSnapshotDigest,
    orderStatus: order.status,
    orderInputVersion: order.inputVersion,
    orderUpdatedAt: order.updatedAt.toISOString(),
    paymentProvider: order.paymentProvider,
    paymentId: order.paymentId,
    authorityDigest: canonicalJsonDigest(binding),
    jobId: job.id,
    jobStatus: job.status,
    jobStage: job.currentStage,
    jobUpdatedAt: job.updatedAt.toISOString(),
    failedAt: job.failedAt.toISOString(),
    jobPipelineCacheDigest: canonicalJsonDigest(cache),
    oldContinuityDigest: canonicalJsonDigest(oldContinuity),
    targetContinuityDigest: canonicalJsonDigest(targetContinuity),
    ...(rerenderPageNumbers.length > 0
      ? { effectiveResemblanceThreshold, readerBaseUrl }
      : {}),
    completedPageNumbers,
    missingPageNumbers,
    bookId: order.book.id,
    cover: {
      url: order.book.coverImageUrl,
      sha256: coverInspection.sha256,
      safetyContentSha256: order.book.coverSafetyContentSha256,
      safetyVerified: order.book.coverSafetyVerified,
      safetyHazards: order.book.coverSafetyHazards,
      safetyOverriddenHazards: order.book.coverSafetyOverriddenHazards,
      safetyOverrideSha256: order.book.coverSafetyOverrideSha256,
    },
    pages: retainedPages.map((page, index) => ({
      pageNumber: page.pageNumber,
      pageId: page.id,
      assetId: page.imageAsset.id,
      url: page.imageAsset.url,
      presentationUrl: page.imageAsset.presentationUrl,
      rawUrl: page.imageAsset.rawUrl,
      provider: page.imageAsset.provider,
      sha256: pageInspections[index]!.sha256,
      safetyVerified: page.imageAsset.safetyVerified,
      safetyHazards: page.imageAsset.safetyHazards,
      safetyContentSha256: page.imageAsset.safetyContentSha256,
      safetyOverriddenHazards: page.imageAsset.safetyOverriddenHazards,
      safetyOverrideSha256: page.imageAsset.safetyOverrideSha256,
      idempotencyKey: page.imageAsset.idempotencyKey,
    })),
    safetyReverification: safetyReverificationTargets.map((target) => ({
      artifactKey: target.artifactKey,
      kind: target.kind,
      pageNumber: target.pageNumber,
      assetId: target.assetId,
      deliveredUrl: target.deliveredUrl,
      sha256: target.sha256,
      qaContextDigest: target.qaContextDigest,
      evidence: {
        assetSha256: target.evidence.assetSha256,
        verdict: target.evidence.verdict,
        evaluatorContractVersion:
          target.evidence.evaluatorContractVersion,
        contractHash: target.evidence.contractHash,
        safetyOverride: target.evidence.safetyOverride,
        safetyOverrideSha256: target.evidence.safetyOverrideSha256,
        updatedAt: target.evidence.updatedAt.toISOString(),
      },
    })),
    pageRerender: pageRerenderTargets.map((target) => ({
      artifactKey: target.artifactKey,
      pageNumber: target.pageNumber,
      pageId: target.pageId,
      assetId: target.assetId,
      sha256: target.sha256,
      sourceUrl: target.sourceUrl,
      presentationUrl: target.presentationUrl,
      rawUrl: target.rawUrl,
      deliveredUrl: target.deliveredUrl,
      provider: target.provider,
      idempotencyKey: target.idempotencyKey,
      qaContextDigest: target.qaContextDigest,
      evidenceDigest: target.evidenceDigest,
      evidence: {
        assetSha256: target.evidence.assetSha256,
        verdict: target.evidence.verdict,
        reason: target.evidence.reason,
        regenCount: target.evidence.regenCount,
        providerModel: target.evidence.providerModel,
        evaluatorContractVersion: target.evidence.evaluatorContractVersion,
        contractHash: target.evidence.contractHash,
        safetyOverride: target.evidence.safetyOverride,
        safetyOverrideSha256: target.evidence.safetyOverrideSha256,
        updatedAt: target.evidence.updatedAt.toISOString(),
      },
      candidate: target.candidate
        ? {
            ...target.candidate,
            createdAt: target.candidate.createdAt.toISOString(),
            updatedAt: target.candidate.updatedAt.toISOString(),
          }
        : null,
      priorAssetReceipt: target.priorAssetReceipt
        ? {
            ...target.priorAssetReceipt,
            createdAt: target.priorAssetReceipt.createdAt.toISOString(),
          }
        : null,
    })),
  });

  return {
    order,
    cache,
    databaseSnapshotDigest: dbSnapshotDigest,
    inspection: {
      status: 'inspect_ready',
      orderId: order.id,
      snapshotDigest,
      failedAt: job.failedAt.toISOString(),
      inputVersion: order.inputVersion,
      generationVersion: job.generationVersion,
      model,
      quality,
      oldReleaseContinuity: oldContinuity,
      targetReleaseContinuity: targetContinuity,
      wizardProductBinding: binding,
      inventory: { completedPageNumbers, missingPageNumbers },
      retainedAssets: {
        cover: {
          url: order.book.coverImageUrl!,
          sha256: coverInspection.sha256,
        },
        pages: retainedPageEvidence,
      },
      safetyReverification: safetyReverificationTargets.map((target) => ({
        artifactKey: target.artifactKey,
        pageNumber: target.pageNumber,
        sha256: target.sha256,
        qaContextDigest: target.qaContextDigest,
        evaluatorContractVersion: target.evidence.evaluatorContractVersion,
        contractHash: target.evidence.contractHash,
      })),
      ...(pageRerenderTargets.length > 0
        ? {
            pageRerender: {
              targets: pageRerenderTargets.map((target) => ({
                artifactKey: target.artifactKey,
                pageNumber: target.pageNumber,
                assetId: target.assetId,
                sha256: target.sha256,
                sourceUrl: target.sourceUrl,
                presentationUrl: target.presentationUrl,
                rawUrl: target.rawUrl,
                deliveredUrl: target.deliveredUrl,
                provider: target.provider,
                idempotencyKey: target.idempotencyKey,
                qaContextDigest: target.qaContextDigest,
                evidenceDigest: target.evidenceDigest,
                candidateId: target.candidate?.id ?? null,
                evaluatorContractVersion:
                  target.evidence.evaluatorContractVersion,
                contractHash: target.evidence.contractHash,
                priorAssetReceiptOperationKey:
                  target.priorAssetReceipt?.operationKey ?? null,
                priorAssetReceiptPayloadHash:
                  target.priorAssetReceipt?.payloadHash ?? null,
                priorAssetReceiptResultDigest:
                  target.priorAssetReceipt?.resultDigest ?? null,
              })),
              resumeInventory: {
                completedPageNumbers: resumeCompletedPageNumbers,
                missingPageNumbers: resumeMissingPageNumbers,
              },
              effectiveResemblanceThreshold,
              readerBaseUrl: readerBaseUrl!,
            },
          }
        : {}),
    },
    safetyReverificationTargets,
    pageRerenderTargets,
  };
}

async function evaluateSafetyReverificationTargets(
  plan: RecoveryPlan,
  deps: Required<Pick<RecoveryDeps, 'evaluate' | 'evaluateWorld'>>,
): Promise<SafetyReverificationEvaluation> {
  const proofs: SafetyReverificationProof[] = [];
  for (const target of plan.safetyReverificationTargets) {
    const { data, mime } = target.inspection;
    if (!data || !mime) {
      reject(`${target.artifactKey} exact bytes are unavailable for safety re-verification`);
    }
    const imageUrl = `data:${mime};base64,${data.toString('base64')}`;
    const { worldExpectation, ...visualContext } = target.qaContext;
    // The incident allowance is three provider-side Vision calls total per
    // retained asset. A crib page may consume one strict follow-up and a
    // world-bound page may consume one world call, so reserve those calls
    // before granting malformed/transport re-QA attempts.
    const reservedFollowups =
      (visualContext.hasRailedBedOrCrib ? 1 : 0) +
      (worldExpectation?.zoneDescription.trim() ? 1 : 0);
    const maxReQa = Math.max(
      0,
      REQA_MALFORMED_MAX_ATTEMPTS - reservedFollowups,
    );
    const visual = await evaluatePageVisualQaWithReQa(
      { imageUrl, ...visualContext },
      deps.evaluate,
      maxReQa,
    );
    // A concrete hazard always dominates an inconsistent status/verdict tuple.
    // A later or malformed `safe` label must never erase positive evidence.
    if (visual.safetyHazards.length > 0) {
      return {
        status: 'confirmed_hazard',
        proof: { target, visual, world: null },
      };
    }
    if (
      classifyPageVisualQaOutcome(visual) !== 'verified_pass' ||
      visual.safetyStatus !== 'safe' ||
      visual.safetyHazards.length !== 0
    ) {
      reject(`${target.artifactKey} same-byte safety re-verification did not pass`);
    }

    let world: PageWorldQaResult | null = null;
    if (worldExpectation?.zoneDescription.trim()) {
      world = await deps.evaluateWorld({
        imageUrl,
        zoneDescription: worldExpectation.zoneDescription,
        objects: worldExpectation.objects,
        forbiddenScenes: worldExpectation.forbiddenScenes,
      });
      if (world.status !== 'pass' || !world.passed) {
        reject(`${target.artifactKey} same-byte world re-verification did not pass`);
      }
    }
    proofs.push({ target, visual, world });
  }
  return { status: 'passed', proofs };
}

function safetyReverificationEvidence(
  proof: SafetyReverificationProof,
  input: ReleaseV1RecoveryInput,
  evaluatedAt: Date,
): Prisma.InputJsonValue {
  const prior = isRecord(proof.target.evidence.evidence)
    ? proof.target.evidence.evidence
    : {};
  return {
    ...prior,
    deliveredUrl: proof.target.deliveredUrl,
    qaContext: proof.target.qaContext,
    retainedSafetyReverification: {
      version: 'retained-safety-reverification/v1',
      recoveryAttemptId: input.recoveryAttemptId,
      assetSha256: proof.target.sha256,
      qaContextDigest: proof.target.qaContextDigest,
      evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
      visualVerdict: proof.visual.verdict,
      visualReason: proof.visual.reason,
      safetyStatus: proof.visual.safetyStatus,
      worldStatus: proof.world?.status ?? null,
      evaluatedAt: evaluatedAt.toISOString(),
    },
  } as unknown as Prisma.InputJsonValue;
}

async function lockRecoverySnapshot(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  // Lock in ownership order. Page-row locks also block a concurrent ImageAsset
  // insert for a currently missing page via the foreign-key key-share lock.
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "BookReadiness" WHERE "orderId" = ${orderId} AND "scope" = 'base_book' FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "GenerationJob" WHERE "orderId" = ${orderId} FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "PaymentRecord" WHERE "orderId" = ${orderId} FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "GeneratedBook" WHERE "orderId" = ${orderId} FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`
      SELECT p."id"
      FROM "BookPage" p
      INNER JOIN "GeneratedBook" b ON b."id" = p."bookId"
      WHERE b."orderId" = ${orderId}
      ORDER BY p."pageNumber"
      FOR UPDATE OF p
    `,
  );
  await tx.$queryRaw(
    Prisma.sql`
      SELECT a."id"
      FROM "ImageAsset" a
      INNER JOIN "BookPage" p ON p."id" = a."pageId"
      INNER JOIN "GeneratedBook" b ON b."id" = p."bookId"
      WHERE b."orderId" = ${orderId}
      ORDER BY p."pageNumber"
      FOR UPDATE OF a
    `,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "QualityEvidence" WHERE "orderId" = ${orderId} ORDER BY "artifactKey" FOR UPDATE`,
  );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "PageUploadCandidate" WHERE "orderId" = ${orderId} FOR UPDATE`,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "AtomicOperationReceipt" WHERE "orderId" = ${orderId} ORDER BY "operationKey" FOR UPDATE`,
    );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "ExceptionCase" WHERE "orderId" = ${orderId} FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "HumanQaReviewCase" WHERE "orderId" = ${orderId} FOR UPDATE`,
  );
}

/**
 * Consume the exact database snapshot before any nondeterministic Vision call.
 *
 * The claim is keyed by the database snapshot rather than the public inspect
 * digest because the latter intentionally includes the caller's attempt UUID.
 * That makes different UUIDs/deployments contend for one safety evaluation of
 * the same durable state. Receipt replay never evaluates again; an ambiguous
 * commit retry in this same invocation keeps `claimedHere=true` and may proceed.
 */
async function claimSafetyReverificationSnapshot(
  db: PrismaClient,
  plan: RecoveryPlan,
): Promise<void> {
  let claimedHere = false;
  const operationKey =
    `release_v1_safety_eval:${plan.order.id}:${plan.databaseSnapshotDigest}`;
  const claimPayload = {
    version: 'release-v1-safety-evaluation-claim/v1',
    orderId: plan.order.id,
    databaseSnapshotDigest: plan.databaseSnapshotDigest,
    evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
    maxProviderCallsPerArtifact: 3,
    targets: plan.safetyReverificationTargets
      .map((target) => ({
        artifactKey: target.artifactKey,
        sha256: target.sha256,
        qaContextDigest: target.qaContextDigest,
      }))
      .sort((left, right) => left.artifactKey.localeCompare(right.artifactKey)),
  };

  await runAtomicOperation(db, {
    operationKey,
    orderId: plan.order.id,
    kind: 'release_v1_safety_evaluation_claim',
    payloadHash: hashOperationPayload(claimPayload),
    run: async (tx) => {
      await lockRecoverySnapshot(tx, plan.order.id);
      const lockedOrder = await tx.order.findUnique({
        where: { id: plan.order.id },
        select: RELEASE_V1_RECOVERY_ORDER_SELECT,
      });
      if (
        !lockedOrder?.generationJob ||
        databaseSnapshotDigest(lockedOrder) !== plan.databaseSnapshotDigest
      ) {
        reject('database snapshot changed before safety re-verification claim');
      }
      claimedHere = true;
      return {
        status: 'claimed',
        databaseSnapshotDigest: plan.databaseSnapshotDigest,
      };
    },
  });

  if (!claimedHere) {
    reject('safety re-verification for this database snapshot was already consumed');
  }
}

export async function executeReleaseV1Recovery(
  rawInput: unknown,
  deps: RecoveryDeps = {},
): Promise<ReleaseV1RecoveryResult> {
  const input = parseReleaseV1RecoveryInput(rawInput);
  const db = deps.db ?? prisma;
  const inspect = deps.inspect ?? inspectAsset;
  const inspectWithBytes = deps.inspectWithBytes ?? inspectAssetWithBytes;
  const evaluate = deps.evaluate ?? evaluatePageVisualQa;
  const evaluateWorld = deps.evaluateWorld ?? evaluatePageWorldQa;
  const dispatch = deps.dispatch ?? chainGenerationWorker;
  const probeWorker = deps.probeWorker ?? probeReleaseV1WorkerReachability;
  const qualifyRender =
    deps.qualifyRender ?? requireStyle01RenderQualification;
  const assertBoards =
    deps.assertBoards ?? requireSetIdentityBoardsBoundForRender;
  const now = deps.now ?? (() => new Date());
  const env = deps.env ?? process.env;
  const prepared = await prepareRecoveryPlan(input, {
    db,
    inspect,
    inspectWithBytes,
    qualifyRender,
    assertBoards,
    now,
    env,
  });
  if ('status' in prepared && prepared.status === 'already_resumed') {
    return prepared;
  }
  const plan = prepared as RecoveryPlan;
  // Use the same environment-separation guard as the synchronous dispatch
  // boundary before any recovery claim or delivery-input mutation. Otherwise
  // dispatch could throw after the destructive page clear has committed.
  assertEnvSeparation(env);
  if (plan.pageRerenderTargets.length > 0) {
    try {
      await probeWorker(plan.inspection.targetReleaseContinuity, env);
    } catch {
      reject('protected Preview release/v1 worker reachability probe failed');
    }
  }
  if (input.mode === 'inspect') return plan.inspection;
  if (input.expectedSnapshotDigest !== plan.inspection.snapshotDigest) {
    reject('snapshot changed after inspection');
  }

  if (plan.safetyReverificationTargets.length > 0) {
    await claimSafetyReverificationSnapshot(db, plan);
  }

  const safetyEvaluation = await evaluateSafetyReverificationTargets(plan, {
    evaluate,
    evaluateWorld,
  });

  if (safetyEvaluation.status === 'confirmed_hazard') {
    const proof = safetyEvaluation.proof;
    const evaluatedAt = now();
    await withDeliveryInputMutation(
      db,
      {
        orderId: plan.order.id,
        reason: 'retained_safety_evaluated',
        operationKey: `delivery_input:${plan.order.id}:release_v1_safety_hazard:${input.recoveryAttemptId}`,
        mutationPayload: {
          snapshotDigest: plan.inspection.snapshotDigest,
          artifactKey: proof.target.artifactKey,
          sha256: proof.target.sha256,
          qaContextDigest: proof.target.qaContextDigest,
          hazards: [...proof.visual.safetyHazards].sort(),
        },
        kind: 'release_v1_safety_hazard',
      },
      async (tx) => {
        await lockRecoverySnapshot(tx, plan.order.id);
        const lockedOrder = await tx.order.findUnique({
          where: { id: plan.order.id },
          select: RELEASE_V1_RECOVERY_ORDER_SELECT,
        });
        if (
          !lockedOrder?.generationJob ||
          databaseSnapshotDigest(lockedOrder) !== plan.databaseSnapshotDigest
        ) {
          reject('database snapshot changed during safety re-verification');
        }
        await writeRetainedSafetyEvaluation(tx, {
          orderId: plan.order.id,
          artifactKey: proof.target.artifactKey,
          target:
            proof.target.kind === 'page'
              ? {
                  kind: 'page',
                  pageId: proof.target.pageId!,
                  assetId: proof.target.assetId!,
                  sourceUrl: proof.target.sourceUrl,
                  presentationUrl: proof.target.presentationUrl,
                }
              : {
                  kind: 'cover',
                  bookId: plan.order.book!.id,
                  coverImageUrl: proof.target.deliveredUrl,
                },
          sha256: proof.target.sha256,
          hazards: [...new Set(proof.visual.safetyHazards)].sort(),
          evidence: safetyReverificationEvidence(proof, input, evaluatedAt),
          evaluatedAt,
          expectedEvidence: {
            assetSha256: proof.target.evidence.assetSha256,
            verdict: proof.target.evidence.verdict,
            evaluatorContractVersion:
              proof.target.evidence.evaluatorContractVersion,
            contractHash: proof.target.evidence.contractHash,
            safetyOverride: proof.target.evidence.safetyOverride,
            safetyOverrideSha256:
              proof.target.evidence.safetyOverrideSha256,
            updatedAt: proof.target.evidence.updatedAt,
          },
        });
        return null;
      },
    );
    reject(
      `${proof.target.artifactKey} same-byte safety re-verification confirmed a hazard`,
    );
  }

  const safetyProofs = safetyEvaluation.proofs;

  const recoveredAt = now();
  const job = plan.order.generationJob!;
  type RecoveryAttempt = NonNullable<
    PipelineCache['releaseRecovery']
  >['attempts'][number];
  const recoveryAudit: RecoveryAttempt = {
    version:
      plan.pageRerenderTargets.length > 0
        ? RELEASE_V1_PAGE_RERENDER_ATTEMPT_VERSION
        : RELEASE_V1_RECOVERY_ATTEMPT_VERSION,
    attemptId: input.recoveryAttemptId,
    reason: input.reason,
    snapshotDigest: plan.inspection.snapshotDigest,
    oldContinuityDigest: canonicalJsonDigest(
      plan.inspection.oldReleaseContinuity,
    ),
    newContinuityDigest: canonicalJsonDigest(
      plan.inspection.targetReleaseContinuity,
    ),
    previousFailedAt: plan.inspection.failedAt,
    previousLastErrorDigest: sha256Text(job.lastError),
    retainedArtifactDigests: {
      cover: plan.inspection.retainedAssets.cover.sha256,
      pages: plan.inspection.retainedAssets.pages
        .filter(
          (page) =>
            !plan.pageRerenderTargets.some(
              (target) => target.pageNumber === page.pageNumber,
            ),
        )
        .map((page) => ({
          pageNumber: page.pageNumber,
          sha256: page.sha256,
        })),
    },
    safetyReverification: safetyProofs.map((proof) => ({
      artifactKey: proof.target.artifactKey,
      sha256: proof.target.sha256,
      qaContextDigest: proof.target.qaContextDigest,
      evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
      visualVerdict: proof.visual.verdict,
      safetyStatus: proof.visual.safetyStatus,
      worldStatus: proof.world?.status ?? null,
    })),
    ...(plan.pageRerenderTargets.length > 0
      ? {
          rerenderedArtifacts: plan.pageRerenderTargets.map((target) => ({
            artifactKey: target.artifactKey,
            pageNumber: target.pageNumber,
            pageId: target.pageId,
            assetId: target.assetId,
            sha256: target.sha256,
            sourceUrl: target.sourceUrl,
            presentationUrl: target.presentationUrl,
            rawUrl: target.rawUrl,
            deliveredUrl: target.deliveredUrl,
            provider: target.provider,
            idempotencyKey: target.idempotencyKey,
            qaContextDigest: target.qaContextDigest,
            evidenceDigest: target.evidenceDigest,
            candidateId: target.candidate?.id ?? null,
            evaluatorContractVersion:
              target.evidence.evaluatorContractVersion,
            contractHash: target.evidence.contractHash,
            priorAssetReceipt: target.priorAssetReceipt
              ? {
                  ...target.priorAssetReceipt,
                  createdAt: target.priorAssetReceipt.createdAt.toISOString(),
                }
              : null,
          })),
          effectiveResemblanceThreshold:
            plan.inspection.pageRerender!.effectiveResemblanceThreshold,
          previousJobProgress: {
            completedPageNumbers: job.completedPageNumbers,
            failedPageNumbers: job.failedPageNumbers,
            pageAttempts: job.pageAttempts,
          },
        }
      : {}),
    recoveredAt: recoveredAt.toISOString(),
  };
  const nextCache: PipelineCache = {
    ...plan.cache,
    releaseContinuity: plan.inspection.targetReleaseContinuity,
    releaseRecovery: {
      version: RELEASE_V1_RECOVERY_LOG_VERSION,
      attempts: [
        ...(plan.cache.releaseRecovery?.attempts ?? []),
        recoveryAudit,
      ],
    },
  };

  // Direct (unfenced) recovery uses the callback flag. Fenced recovery replaces
  // it after commit/replay with the per-invocation receipt token comparison.
  let recoveredHere = false;
  // Fenced paths return this per-invocation token from the committed receipt.
  // If a concurrent invocation wins after this callback rolled back, replay
  // returns the winner's different token and this invocation must not dispatch.
  const dispatchOwnershipToken = randomUUID();

  const recoverLockedSnapshot = async (
    tx: Prisma.TransactionClient,
    permitIdempotentReplay: boolean,
    clearPageRerender?: () => Promise<void>,
  ): Promise<ReleaseV1RecoveryResult | null> => {
    await lockRecoverySnapshot(tx, plan.order.id);
    const lockedOrder = await tx.order.findUnique({
      where: { id: plan.order.id },
      select: RELEASE_V1_RECOVERY_ORDER_SELECT,
    });
    if (!lockedOrder?.generationJob) {
      reject('database snapshot disappeared after retained-byte inspection');
    }
    const lockedCache = requireObjectCache(
      lockedOrder.generationJob.pipelineCache,
    );
    const idempotent = readExistingAttempt({
      input,
      order: lockedOrder,
      cache: lockedCache,
      targetContinuity: plan.inspection.targetReleaseContinuity,
    });
    if (idempotent) {
      if (permitIdempotentReplay) return idempotent;
      reject('database snapshot changed during safety re-verification');
    }
    if (databaseSnapshotDigest(lockedOrder) !== plan.databaseSnapshotDigest) {
      reject('database snapshot changed after retained-byte inspection');
    }

    // The failed generation's active infra case is part of the exact inspected snapshot. Resolve it inside the SAME
    // locked transaction before the job becomes pending: this increments claimVersion + clears activeKey/nextActionAt,
    // so a due exception processor cannot keep spending attempts or cross into refund while the reviewed worker runs.
    // A subsequent worker failure is free to open a fresh case against the new generation state.
    for (const exceptionCase of lockedOrder.exceptionCases) {
      const resolved = await resolveActiveRecoveryCaseInTx(tx, {
        orderId: plan.order.id,
        scope: exceptionCase.scope,
        kinds: ['infra_transient'],
        reason: `release_v1_reviewed_recovery:${input.recoveryAttemptId}`,
        now: recoveredAt,
        expected: {
          id: exceptionCase.id,
          status: exceptionCase.status,
          claimVersion: exceptionCase.claimVersion,
          sourceRef: exceptionCase.sourceRef,
          attempts: exceptionCase.attempts,
          nextActionAt: exceptionCase.nextActionAt,
        },
      });
      if (!resolved) {
        reject(`active exception case recovery compare-and-swap lost: ${exceptionCase.id}`);
      }
    }

    for (const proof of safetyProofs) {
      await writeRetainedSafetyEvaluation(tx, {
        orderId: plan.order.id,
        artifactKey: proof.target.artifactKey,
        target:
          proof.target.kind === 'page'
            ? {
                kind: 'page',
                pageId: proof.target.pageId!,
                assetId: proof.target.assetId!,
                sourceUrl: proof.target.sourceUrl,
                presentationUrl: proof.target.presentationUrl,
              }
            : {
                kind: 'cover',
                bookId: plan.order.book!.id,
                coverImageUrl: proof.target.deliveredUrl,
              },
        sha256: proof.target.sha256,
        hazards: [],
        evidence: safetyReverificationEvidence(proof, input, recoveredAt),
        evaluatedAt: recoveredAt,
        expectedEvidence: {
          assetSha256: proof.target.evidence.assetSha256,
          verdict: proof.target.evidence.verdict,
          evaluatorContractVersion:
            proof.target.evidence.evaluatorContractVersion,
          contractHash: proof.target.evidence.contractHash,
          safetyOverride: proof.target.evidence.safetyOverride,
          safetyOverrideSha256:
            proof.target.evidence.safetyOverrideSha256,
          updatedAt: proof.target.evidence.updatedAt,
        },
      });
    }

    if (plan.pageRerenderTargets.length > 0) {
      if (!clearPageRerender) {
        reject('page re-render must execute inside the delivery-input barrier');
      }
      await clearPageRerender();
    }

    const orderClaim = await tx.order.updateMany({
      where: {
        id: plan.order.id,
        status: 'failed',
        inputVersion: plan.order.inputVersion,
        updatedAt: plan.order.updatedAt,
        paymentProvider: plan.order.paymentProvider,
        paymentId: plan.order.paymentId,
        textStatus: 'done',
        imageStatus: 'failed',
        deliveryHoldReason: null,
        manualReviewRequired: false,
        ...releaseV1AuthorityCasWhere(plan.order),
      },
      data: {
        status: 'generating',
        imageStatus: 'pending',
        lastError: null,
        errorAt: null,
      },
    });
    if (orderClaim.count !== 1) {
      reject('order recovery compare-and-swap lost');
    }
    const cachePersisted = await persistOrdinaryPipelineCache(
      tx,
      plan.order.id,
      nextCache,
    );
    if (cachePersisted !== 1) {
      reject('generation job cache recovery compare-and-swap lost');
    }
    const jobClaim = await tx.generationJob.updateMany({
      where: {
        orderId: plan.order.id,
        status: 'failed',
        currentStage: 'failed',
        retryable: true,
        lockedBy: null,
        leaseExpiresAt: job.leaseExpiresAt,
        failedAt: job.failedAt,
        updatedAt: job.updatedAt,
      },
      data: {
        status: 'pending',
        currentStage: 'pending',
        retryable: false,
        lockedBy: null,
        leaseExpiresAt: null,
        failedAt: null,
        lastError: null,
        triggerReason:
          plan.pageRerenderTargets.length > 0
            ? `release_v1_page_rerender:${input.recoveryAttemptId}`
            : `release_v1_recovery:${input.recoveryAttemptId}`,
        completedPageNumbers:
          (plan.inspection.pageRerender?.resumeInventory
            .completedPageNumbers ??
            plan.inspection.inventory.completedPageNumbers) as Prisma.InputJsonValue,
        ...(plan.pageRerenderTargets.length > 0
          ? {
              imagesDone: false,
              failedPageNumbers: [] as Prisma.InputJsonValue,
              pageAttempts: {} as Prisma.InputJsonValue,
            }
          : {}),
        lastChainStatus: null,
        lastChainError: null,
        lastWorkerKickAt: null,
      },
    });
    if (jobClaim.count !== 1) {
      reject('generation job recovery compare-and-swap lost');
    }
    recoveredHere = true;
    return null;
  };

  let transactionResult: ReleaseV1RecoveryResult | null;
  if (plan.pageRerenderTargets.length > 0) {
    const mutation = await withDeliveryInputMutation(
      db,
      {
        orderId: plan.order.id,
        reason: 'page_assets_cleared',
        operationKey: `delivery_input:${plan.order.id}:release_v1_page_rerender:${input.recoveryAttemptId}`,
        mutationPayload: {
          snapshotDigest: plan.inspection.snapshotDigest,
          artifacts: plan.pageRerenderTargets.map((target) => ({
            artifactKey: target.artifactKey,
            pageNumber: target.pageNumber,
            pageId: target.pageId,
            assetId: target.assetId,
            sha256: target.sha256,
            qaContextDigest: target.qaContextDigest,
            evidenceDigest: target.evidenceDigest,
            candidateId: target.candidate?.id ?? null,
          })),
        },
        kind: 'release_v1_page_rerender',
      },
      async (tx) => {
        const result = await recoverLockedSnapshot(tx, false, async () => {
          for (const target of plan.pageRerenderTargets) {
            const deletedAsset = await tx.imageAsset.deleteMany({
              where: {
                id: target.assetId,
                pageId: target.pageId,
                provider: target.provider,
                url: target.sourceUrl,
                presentationUrl: target.presentationUrl,
                idempotencyKey: target.idempotencyKey,
                safetyVerified: false,
                safetyHazards: { equals: [] },
                safetyContentSha256: target.sha256,
                safetyOverriddenHazards: { equals: [] },
                safetyOverrideSha256: null,
              },
            });
            if (deletedAsset.count !== 1) {
              reject('page re-render asset compare-and-swap lost');
            }

            const deletedCandidate = await tx.pageUploadCandidate.deleteMany({
              where: target.candidate
                ? {
                    id: target.candidate.id,
                    orderId: plan.order.id,
                    pageNumber: target.pageNumber,
                    url: target.candidate.url,
                    rawUrl: target.candidate.rawUrl,
                    provider: target.candidate.provider,
                    createdAt: target.candidate.createdAt,
                    updatedAt: target.candidate.updatedAt,
                  }
                : {
                    orderId: plan.order.id,
                    pageNumber: target.pageNumber,
                  },
            });
            if (deletedCandidate.count !== (target.candidate ? 1 : 0)) {
              reject('page re-render upload candidate compare-and-swap lost');
            }

            const deletedPriorReceipt =
              await tx.atomicOperationReceipt.deleteMany({
                where: target.priorAssetReceipt
                  ? {
                      operationKey: target.priorAssetReceipt.operationKey,
                      orderId: plan.order.id,
                      kind: target.priorAssetReceipt.kind,
                      payloadHash: target.priorAssetReceipt.payloadHash,
                      createdAt: target.priorAssetReceipt.createdAt,
                    }
                  : {
                      operationKey: pageAssetOperationKey(
                        plan.order.id,
                        target.pageNumber,
                        target.deliveredUrl,
                        plan.order.visualContractHash,
                      ),
                    },
              });
            if (
              deletedPriorReceipt.count !==
              (target.priorAssetReceipt ? 1 : 0)
            ) {
              reject('page re-render prior asset receipt compare-and-swap lost');
            }

            const priorEvidence = isRecord(target.evidence.evidence)
              ? target.evidence.evidence
              : {};
            const invalidatedEvidence = await tx.qualityEvidence.updateMany({
              where: {
                orderId: plan.order.id,
                artifactKey: target.artifactKey,
                assetSha256: target.evidence.assetSha256,
                verdict: target.evidence.verdict,
                evaluatorContractVersion:
                  target.evidence.evaluatorContractVersion,
                reason: target.evidence.reason,
                regenCount: target.evidence.regenCount,
                providerModel: target.evidence.providerModel,
                contractHash: target.evidence.contractHash,
                safetyOverride: false,
                safetyOverrideSha256: null,
                updatedAt: target.evidence.updatedAt,
              },
              data: {
                assetSha256: '',
                verdict: 'evidence_unknown',
                reason: 'recovery:rerender_pending',
                safetyOverride: false,
                safetyOverrideSha256: null,
                evidence: {
                  ...priorEvidence,
                  releaseV1PageRerender: {
                    version: 'release-v1-page-rerender-pending/v1',
                    recoveryAttemptId: input.recoveryAttemptId,
                    previousAssetId: target.assetId,
                    previousAssetSha256: target.sha256,
                    previousQaContextDigest: target.qaContextDigest,
                    previousEvidenceDigest: target.evidenceDigest,
                    requestedAt: recoveredAt.toISOString(),
                  },
                } as unknown as Prisma.InputJsonValue,
              },
            });
            if (invalidatedEvidence.count !== 1) {
              reject('page re-render quality evidence compare-and-swap lost');
            }
          }
        });
        if (result) {
          reject('database snapshot changed during page re-render recovery');
        }
        return dispatchOwnershipToken;
      },
    );
    recoveredHere = mutation.value === dispatchOwnershipToken;
    transactionResult = null;
  } else if (safetyProofs.length > 0) {
    const mutation = await withDeliveryInputMutation(
      db,
      {
        orderId: plan.order.id,
        reason: 'retained_safety_evaluated',
        operationKey: `delivery_input:${plan.order.id}:release_v1_safety_reverification:${input.recoveryAttemptId}`,
        mutationPayload: {
          snapshotDigest: plan.inspection.snapshotDigest,
          artifacts: safetyProofs.map((proof) => ({
            artifactKey: proof.target.artifactKey,
            sha256: proof.target.sha256,
            qaContextDigest: proof.target.qaContextDigest,
            visualVerdict: proof.visual.verdict,
            safetyStatus: proof.visual.safetyStatus,
            worldStatus: proof.world?.status ?? null,
          })),
        },
        kind: 'release_v1_safety_reverification',
      },
      async (tx) => {
        const result = await recoverLockedSnapshot(tx, false);
        if (result) reject('database snapshot changed during safety re-verification');
        return dispatchOwnershipToken;
      },
    );
    recoveredHere = mutation.value === dispatchOwnershipToken;
    transactionResult = null;
  } else {
    transactionResult = await db.$transaction((tx) =>
      recoverLockedSnapshot(tx, true),
    );
  }

  if (transactionResult) return transactionResult;

  if (!recoveredHere) {
    return {
      status: 'already_resumed',
      orderId: plan.order.id,
      recoveryAttemptId: input.recoveryAttemptId,
      snapshotDigest: plan.inspection.snapshotDigest,
      targetReleaseContinuity: plan.inspection.targetReleaseContinuity,
      dispatched: false,
      ...(plan.pageRerenderTargets.length > 0
        ? {
            rerenderedPageNumbers: plan.pageRerenderTargets.map(
              (target) => target.pageNumber,
            ),
          }
        : {}),
    };
  }

  dispatch(plan.order.id, plan.inspection.targetReleaseContinuity);
  return {
    status: 'resumed',
    orderId: plan.order.id,
    recoveryAttemptId: input.recoveryAttemptId,
    snapshotDigest: plan.inspection.snapshotDigest,
    targetReleaseContinuity: plan.inspection.targetReleaseContinuity,
    dispatched: true,
    ...(plan.pageRerenderTargets.length > 0
      ? {
          rerenderedPageNumbers: plan.pageRerenderTargets.map(
            (target) => target.pageNumber,
          ),
        }
      : {}),
  };
}
