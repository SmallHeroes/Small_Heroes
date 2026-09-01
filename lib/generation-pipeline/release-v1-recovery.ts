import { createHash } from 'crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { buildArtifactIdempotencyKey } from '@/lib/generation-chunked/artifact-keys';
import { chainGenerationWorker } from '@/lib/generation-chunked/chain-worker';
import { GENERATION_VERSION } from '@/lib/generation-chunked/constants';
import { resolveStyle01GptModel } from '@/lib/style01-gptimage';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';

import {
  inspectAsset,
  isAllowedAssetUrl,
  type AssetInspection,
} from './asset-integrity';
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
import type { PipelineCache } from './types';

export const RELEASE_V1_RECOVERY_REASON = 'reviewed_code_fix_resume' as const;
const RELEASE_V1_RECOVERY_LOG_VERSION = 'release-v1-recovery-log/v1' as const;
const RELEASE_V1_RECOVERY_ATTEMPT_VERSION =
  'release-v1-recovery-attempt/v1' as const;
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
  updatedAt: true,
  expectedPageCount: true,
  totalPrice: true,
  paymentProvider: true,
  paymentId: true,
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
              idempotencyKey: true,
              safetyVerified: true,
              safetyHazards: true,
              safetyContentSha256: true,
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
      kind: true,
      status: true,
      actionAttemptedAt: true,
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
} satisfies Prisma.OrderSelect;

type RecoveryOrder = Prisma.OrderGetPayload<{
  select: typeof RELEASE_V1_RECOVERY_ORDER_SELECT;
}>;

export interface ReleaseV1RecoveryInput {
  mode: 'inspect' | 'apply';
  orderId: string;
  recoveryAttemptId: string;
  reason: typeof RELEASE_V1_RECOVERY_REASON;
  expectedOldReleaseContinuity: GenerationReleaseContinuityV1;
  expectedWizardProductBinding: WizardProductBindingV1;
  expectedArtifactInventory: {
    completedPageNumbers: number[];
    missingPageNumbers: number[];
  };
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
    }
  | {
      status: 'already_resumed';
      orderId: string;
      recoveryAttemptId: string;
      snapshotDigest: string;
      targetReleaseContinuity: GenerationReleaseContinuityV1;
      dispatched: false;
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
  dispatch?: typeof chainGenerationWorker;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
};

type RecoveryPlan = {
  order: RecoveryOrder;
  cache: PipelineCache;
  databaseSnapshotDigest: string;
  inspection: ReleaseV1RecoveryInspection;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
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
  const required = [
    'mode',
    'orderId',
    'recoveryAttemptId',
    'reason',
    'expectedOldReleaseContinuity',
    'expectedWizardProductBinding',
    'expectedArtifactInventory',
  ] as const;
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
  if (value.reason !== RELEASE_V1_RECOVERY_REASON) {
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
    reason: RELEASE_V1_RECOVERY_REASON,
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
      updatedAt: order.updatedAt.toISOString(),
      expectedPageCount: order.expectedPageCount,
      totalPrice: order.totalPrice,
      paymentProvider: order.paymentProvider,
      paymentId: order.paymentId,
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
      actionAttemptedAt:
        exceptionCase.actionAttemptedAt?.toISOString() ?? null,
      leaseExpiresAt: exceptionCase.leaseExpiresAt?.toISOString() ?? null,
      updatedAt: exceptionCase.updatedAt.toISOString(),
    })),
    humanQaReviewCases: order.humanQaReviewCases,
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
  deps: Required<Pick<RecoveryDeps, 'db' | 'inspect' | 'now' | 'env'>>,
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
  if (deps.env.GENERATION_DISABLE_SELF_CHAIN === 'true') {
    reasons.push('GENERATION_DISABLE_SELF_CHAIN must be disabled for release recovery');
  }
  if (cache.textFinalized !== true) {
    reasons.push('frozen story text is missing from the generation cache');
  }
  if (!cache.dna || !isRecord(cache.dna)) {
    reasons.push('generation DNA is missing from the generation cache');
  }
  if (cache.childAnchorApproved !== true) {
    reasons.push('approved child anchor is missing from the generation cache');
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
      !['open', 'retry_scheduled'].includes(exceptionCase.status) ||
      exceptionCase.actionAttemptedAt != null
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

  const expectedPageCount = order.expectedPageCount;
  if (!Number.isSafeInteger(expectedPageCount) || Number(expectedPageCount) <= 0) {
    reasons.push('expected page count is missing or invalid');
  }
  if (!order.book) reasons.push('generated book is missing');
  if (reasons.length > 0 || !oldContinuity || !job.failedAt || !order.book || !expectedPageCount) {
    throw new ReleaseV1RecoveryError(reasons);
  }

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
  if (!isAllowedAssetUrl(order.book.coverImageUrl)) {
    reasons.push('retained cover URL is missing or not allowlisted');
  }
  if (
    !order.book.coverSafetyVerified ||
    order.book.coverSafetyHazards.length > 0
  ) {
    reasons.push('retained cover is not durably safety-cleared');
  }
  for (const candidate of order.pageUploadCandidates) {
    if (missingPageNumbers.includes(candidate.pageNumber)) {
      reasons.push(
        `missing page ${candidate.pageNumber} has a persisted upload candidate`,
      );
    }
  }

  const model = resolveStyle01GptModel(deps.env);
  const quality = deps.env.GPT_IMAGE_QUALITY?.trim() || 'low';
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
    if (!asset.safetyVerified || asset.safetyHazards.length > 0) {
      reasons.push(`page ${page.pageNumber} is not durably safety-cleared`);
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
  if (reasons.length > 0) throw new ReleaseV1RecoveryError(reasons);

  const retainedPages = order.book.pages.filter(
    (page): page is typeof page & { imageAsset: NonNullable<typeof page.imageAsset> } =>
      page.imageAsset != null,
  );
  const [coverInspection, ...pageInspections] = await Promise.all([
    deps.inspect(order.book.coverImageUrl),
    ...retainedPages.map((page) =>
      deps.inspect(page.imageAsset.presentationUrl ?? page.imageAsset.url),
    ),
  ]);
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
    completedPageNumbers,
    missingPageNumbers,
    bookId: order.book.id,
    cover: {
      url: order.book.coverImageUrl,
      sha256: coverInspection.sha256,
      safetyContentSha256: order.book.coverSafetyContentSha256,
    },
    pages: retainedPages.map((page, index) => ({
      pageNumber: page.pageNumber,
      pageId: page.id,
      assetId: page.imageAsset.id,
      url: page.imageAsset.url,
      presentationUrl: page.imageAsset.presentationUrl,
      sha256: pageInspections[index]!.sha256,
      safetyContentSha256: page.imageAsset.safetyContentSha256,
      idempotencyKey: page.imageAsset.idempotencyKey,
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
    },
  };
}

async function lockRecoverySnapshot(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  // Lock in ownership order. Page-row locks also block a concurrent ImageAsset
  // insert for a currently missing page via the foreign-key key-share lock.
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
    Prisma.sql`SELECT "id" FROM "PageUploadCandidate" WHERE "orderId" = ${orderId} FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "ExceptionCase" WHERE "orderId" = ${orderId} FOR UPDATE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "HumanQaReviewCase" WHERE "orderId" = ${orderId} FOR UPDATE`,
  );
}

export async function executeReleaseV1Recovery(
  rawInput: unknown,
  deps: RecoveryDeps = {},
): Promise<ReleaseV1RecoveryResult> {
  const input = parseReleaseV1RecoveryInput(rawInput);
  const db = deps.db ?? prisma;
  const inspect = deps.inspect ?? inspectAsset;
  const dispatch = deps.dispatch ?? chainGenerationWorker;
  const now = deps.now ?? (() => new Date());
  const env = deps.env ?? process.env;
  const prepared = await prepareRecoveryPlan(input, { db, inspect, now, env });
  if ('status' in prepared && prepared.status === 'already_resumed') {
    return prepared;
  }
  const plan = prepared as RecoveryPlan;
  if (input.mode === 'inspect') return plan.inspection;
  if (input.expectedSnapshotDigest !== plan.inspection.snapshotDigest) {
    reject('snapshot changed after inspection');
  }

  const recoveredAt = now();
  const job = plan.order.generationJob!;
  type RecoveryAttempt = NonNullable<
    PipelineCache['releaseRecovery']
  >['attempts'][number];
  const recoveryAudit: RecoveryAttempt = {
    version: RELEASE_V1_RECOVERY_ATTEMPT_VERSION,
    attemptId: input.recoveryAttemptId,
    reason: RELEASE_V1_RECOVERY_REASON,
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
      pages: plan.inspection.retainedAssets.pages.map((page) => ({
        pageNumber: page.pageNumber,
        sha256: page.sha256,
      })),
    },
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

  const transactionResult = await db.$transaction(async (tx) => {
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
    if (idempotent) return idempotent;
    if (databaseSnapshotDigest(lockedOrder) !== plan.databaseSnapshotDigest) {
      reject('database snapshot changed after retained-byte inspection');
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
        triggerReason: `release_v1_recovery:${input.recoveryAttemptId}`,
        completedPageNumbers:
          plan.inspection.inventory.completedPageNumbers as Prisma.InputJsonValue,
        lastChainStatus: null,
        lastChainError: null,
        lastWorkerKickAt: null,
      },
    });
    if (jobClaim.count !== 1) {
      reject('generation job recovery compare-and-swap lost');
    }
    return null;
  });

  if (transactionResult) return transactionResult;

  dispatch(plan.order.id, plan.inspection.targetReleaseContinuity);
  return {
    status: 'resumed',
    orderId: plan.order.id,
    recoveryAttemptId: input.recoveryAttemptId,
    snapshotDigest: plan.inspection.snapshotDigest,
    targetReleaseContinuity: plan.inspection.targetReleaseContinuity,
    dispatched: true,
  };
}
