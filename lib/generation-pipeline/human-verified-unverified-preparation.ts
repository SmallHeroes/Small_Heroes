import 'server-only';

import type { Prisma, PrismaClient } from '@prisma/client';

import { canonicalHash } from '@/lib/canonical-json';
import { assertEnvSeparation } from '@/lib/generation-chunked/env-separation-guard';
import {
  inspectAssetWithBytes,
  type AssetInspectionWithBytes,
} from './asset-integrity';
import { getApprovedChildCanonicalAnchor } from './character-anchor-store';
import {
  HumanVerifiedUnverifiedAdmissibilityError,
  humanVerificationSnapshotDigest,
  humanVerifiedUnverifiedPreparedOutcome,
  humanVerifiedUnverifiedOperationKey,
  humanVerifiedUnverifiedRequestHash,
  isHumanVerifiedUnverifiedReleaseEnvironmentEnabled,
  parseHumanVerifiedUnverifiedPreparedOutcome,
  parsePassingResemblanceProof,
  resemblanceProofDigest,
  resemblanceProofsFromRows,
  validateHumanVerifiedUnverifiedRequest,
  type HumanVerificationCaseSnapshot,
  type HumanVerificationOrderSnapshot,
  type HumanVerificationTargetSnapshot,
  type HumanVerifiedUnverifiedReleaseRequest,
} from './human-verified-unverified-release';
import {
  deliveredUrlHash,
  hasDisqualifyingRefundOrReconciliationActivity,
  hasStrictHumanVerificationPaymentAuthority,
  lockHumanVerificationGenerationJob,
  paymentSnapshotDigest,
  refundAuthorityDigest,
  type HumanVerificationPaymentSnapshot,
} from './human-verified-unverified-authority';
import {
  PAGE_CHILD_RESEMBLANCE_MAX_RETRIES,
  PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
  PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
  evaluatePageChildResemblanceVision,
} from './page-child-resemblance-vision';
import {
  QUALITY_EVALUATOR_CONTRACT_VERSION,
  inspectHumanReviewAuthorityBytes,
  loadQualityEvidence,
  type QualityEvidenceRow,
} from './quality-evidence';
import { runWithStyle01RenderQualification } from './render-qualification-preflight';
import type { PipelineCache } from './types';
import {
  resolveEffectiveThreshold,
  resolveResemblanceThresholdConfig,
} from '@/lib/resemblance-core';
import {
  parseHumanVerifiedUnverifiedAtomicReceiptResult,
  parseHumanVerifiedUnverifiedOutcome,
} from './human-verified-unverified-contract';

const MAX_VISION_CALLS = 24;
// Route maxDuration is 300s. Only a durably proven pre-provider claim may be reclaimed, and only well after the
// route should have ended. A provider_started claim is never reclaimed, regardless of age.
export const HUMAN_VERIFICATION_NO_PROVIDER_CLAIM_STALE_MS = 15 * 60 * 1000;
const PREPARATION_CLAIM_VERSION =
  'human_verified_unverified_preparation_claim/v1' as const;
const PREPARATION_ABORTED_VERSION =
  'human_verified_unverified_preparation_aborted/v1' as const;
const PREPARATION_SPEND_TERMINAL_VERSION =
  'human_verified_unverified_provider_spend_terminal/v1' as const;
const PREPARATION_POST_SCORE_ABORTED_VERSION =
  'human_verified_unverified_post_score_aborted/v1' as const;

type Db = PrismaClient | Prisma.TransactionClient;

class ProviderScoringTerminalError extends HumanVerifiedUnverifiedAdmissibilityError {
  constructor(
    readonly disposition: 'deterministic_refusal' | 'unknown_or_ambiguous',
    detail: string,
  ) {
    super('resemblance_not_proven', detail);
    this.name = 'ProviderScoringTerminalError';
  }
}

export interface PrepareHumanVerifiedUnverifiedArgs {
  orderId: string;
  inspectionDigest: string;
  artifactKey: string;
  expectedMarker: string;
  expectedAssetSha256: string;
  reviewReason: string;
  actor: string;
  idempotencyKey: string;
}

export interface InspectHumanVerifiedUnverifiedArgs {
  orderId: string;
  artifactKey: string;
  expectedMarker: string;
  expectedAssetSha256: string;
}

export interface HumanVerifiedUnverifiedInspection {
  inspectionDigest: string;
  requiredArtifacts: string[];
  needsProofArtifacts: string[];
}

export type PrepareHumanVerifiedUnverifiedResult =
  | { request: HumanVerifiedUnverifiedReleaseRequest; alreadyCommitted?: never }
  | {
      request?: never;
      alreadyCommitted: {
        manifestStatus: 'passed';
        enqueued: true;
        orderStatus: 'ready';
        reason: null;
        revision: number;
      };
    };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactByteDataUrl(
  inspection: AssetInspectionWithBytes,
  label: string,
): string {
  if (
    inspection.ok !== true ||
    !inspection.sha256 ||
    !inspection.mime ||
    !inspection.data
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'asset_changed',
      `${label} exact bytes are unavailable`,
    );
  }
  return `data:${inspection.mime};base64,${inspection.data.toString('base64')}`;
}

type RawPreparationPhase = 'claimed_no_provider' | 'provider_started';

function parseRawPreparationClaim(value: unknown): {
  claimHash: string;
  inspectionDigest: string;
  proofInputDigest: string;
  phase: RawPreparationPhase;
} | null {
  if (
    !record(value) ||
    Object.keys(value).length !== 5 ||
    value.version !== PREPARATION_CLAIM_VERSION ||
    typeof value.claimHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.claimHash) ||
    typeof value.inspectionDigest !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.inspectionDigest) ||
    typeof value.proofInputDigest !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.proofInputDigest) ||
    (value.phase !== 'claimed_no_provider' && value.phase !== 'provider_started')
  ) return null;
  return {
    claimHash: value.claimHash,
    inspectionDigest: value.inspectionDigest,
    proofInputDigest: value.proofInputDigest,
    phase: value.phase,
  };
}

function parseProviderSpendTerminal(value: unknown): {
  claimHash: string;
  inspectionDigest: string;
  caseRevision: number;
  proofInputDigest: string;
  disposition: 'deterministic_refusal' | 'unknown_or_ambiguous' | 'post_score_persist_failed';
  rule: string;
} | null {
  if (
    !record(value) ||
    Object.keys(value).length !== 8 ||
    value.version !== PREPARATION_SPEND_TERMINAL_VERSION ||
    value.phase !== 'provider_settled_terminal' ||
    typeof value.claimHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.claimHash) ||
    typeof value.inspectionDigest !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.inspectionDigest) ||
    typeof value.caseRevision !== 'number' ||
    !Number.isInteger(value.caseRevision) ||
    value.caseRevision < 1 ||
    typeof value.proofInputDigest !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.proofInputDigest) ||
    (
      value.disposition !== 'deterministic_refusal' &&
      value.disposition !== 'unknown_or_ambiguous' &&
      value.disposition !== 'post_score_persist_failed'
    ) ||
    typeof value.rule !== 'string' ||
    !value.rule
  ) return null;
  return {
    claimHash: value.claimHash,
    inspectionDigest: value.inspectionDigest,
    caseRevision: value.caseRevision,
    proofInputDigest: value.proofInputDigest,
    disposition: value.disposition,
    rule: value.rule,
  };
}

function parsePostScoreAborted(value: unknown): {
  requestHash: string;
  inspectionDigest: string;
  caseRevision: number;
  proofInputDigest: string;
  rule: string;
} | null {
  if (
    !record(value) ||
    Object.keys(value).length !== 7 ||
    value.version !== PREPARATION_POST_SCORE_ABORTED_VERSION ||
    value.phase !== 'proof_settled_commit_refused' ||
    typeof value.requestHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.requestHash) ||
    typeof value.inspectionDigest !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.inspectionDigest) ||
    typeof value.caseRevision !== 'number' ||
    !Number.isInteger(value.caseRevision) ||
    value.caseRevision < 1 ||
    typeof value.proofInputDigest !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.proofInputDigest) ||
    typeof value.rule !== 'string' ||
    !value.rule
  ) return null;
  return {
    requestHash: value.requestHash,
    inspectionDigest: value.inspectionDigest,
    caseRevision: value.caseRevision,
    proofInputDigest: value.proofInputDigest,
    rule: value.rule,
  };
}

function proofInputDigestFromPreparedRequest(
  request: HumanVerifiedUnverifiedReleaseRequest,
): string | null {
  const [firstProof] = request.resemblanceProofs;
  if (
    !firstProof ||
    firstProof.referenceImageUrlHash !== request.expectedAnchorUrlHash ||
    firstProof.referenceBytesSha256 !== request.expectedAnchorBytesSha256 ||
    request.resemblanceProofs.some(
      (proof) =>
        proof.threshold !== firstProof.threshold ||
        proof.referenceImageUrlHash !== request.expectedAnchorUrlHash ||
        proof.referenceBytesSha256 !== request.expectedAnchorBytesSha256,
    )
  ) return null;
  return canonicalHash({
    requiredArtifacts: request.requiredResemblanceArtifacts,
    anchorUrlHash: request.expectedAnchorUrlHash,
    anchorBytesSha256: request.expectedAnchorBytesSha256,
    threshold: firstProof.threshold,
    caseId: request.expectedCaseId,
    caseRevision: request.expectedCaseRevision,
    inspectedArtifacts: request.resemblanceProofs.map((proof) => ({
      artifactKey: proof.artifactKey,
      assetId: proof.assetId,
      sha256: proof.deliveredBytesSha256,
      deliveredUrlHash: proof.deliveredUrlHash,
    })),
  });
}

export function classifyPriorProviderSpend(args: {
  outcome: unknown;
  status: string;
  inspectionDigest: string;
  caseRevision: number;
  proofInputDigest: string;
}): 'resemblance_not_proven' | 'provider_outcome_ambiguous' | 'invalid_request' | null {
  const terminal = parseProviderSpendTerminal(args.outcome);
  if (
    record(args.outcome) &&
    args.outcome.version === PREPARATION_SPEND_TERMINAL_VERSION &&
    !terminal
  ) return 'invalid_request';
  if (
    terminal?.caseRevision === args.caseRevision &&
    terminal.proofInputDigest === args.proofInputDigest
  ) {
    return terminal.disposition === 'deterministic_refusal'
      ? 'resemblance_not_proven'
      : 'provider_outcome_ambiguous';
  }
  if (terminal?.inspectionDigest === args.inspectionDigest) {
    return 'invalid_request';
  }
  const postScoreAbort = parsePostScoreAborted(args.outcome);
  if (
    record(args.outcome) &&
    args.outcome.version === PREPARATION_POST_SCORE_ABORTED_VERSION &&
    !postScoreAbort
  ) return 'invalid_request';
  if (
    postScoreAbort?.caseRevision === args.caseRevision &&
    postScoreAbort.proofInputDigest === args.proofInputDigest
  ) return 'invalid_request';
  if (postScoreAbort?.inspectionDigest === args.inspectionDigest) {
    return 'invalid_request';
  }
  const raw = parseRawPreparationClaim(args.outcome);
  if (
    raw?.proofInputDigest === args.proofInputDigest &&
    raw.phase === 'provider_started'
  ) return 'provider_outcome_ambiguous';
  if (raw?.inspectionDigest === args.inspectionDigest) return 'invalid_request';
  const succeeded = parseHumanVerifiedUnverifiedOutcome(args.outcome);
  if (
    args.status === 'succeeded' &&
    succeeded?.inspectionDigest === args.inspectionDigest
  ) return 'invalid_request';
  return null;
}

function claimIsConservativelyStale(updatedAt: Date, now: Date): boolean {
  return now.getTime() - updatedAt.getTime() > HUMAN_VERIFICATION_NO_PROVIDER_CLAIM_STALE_MS;
}

function qualityRow(row: {
  id: string;
  artifactKey: string;
  assetSha256: string;
  verdict: string;
  evaluatorContractVersion: string;
  reason: string | null;
  regenCount: number;
  providerModel: string | null;
  contractHash: string | null;
  safetyOverride: boolean;
  safetyOverrideSha256: string | null;
  evidence: Prisma.JsonValue | null;
  evaluatedAt: Date;
  reviewStatus: string | null;
  reviewedAssetSha256: string | null;
  reviewedContractHash: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewReason: string | null;
  updatedAt: Date;
  createdAt: Date;
}): QualityEvidenceRow & {
  updatedAt: Date;
  providerModel: string | null;
  createdAt: Date;
} {
  return row;
}

const QUALITY_SELECT = {
  id: true,
  artifactKey: true,
  assetSha256: true,
  verdict: true,
  evaluatorContractVersion: true,
  reason: true,
  regenCount: true,
  providerModel: true,
  contractHash: true,
  safetyOverride: true,
  safetyOverrideSha256: true,
  evidence: true,
  evaluatedAt: true,
  reviewStatus: true,
  reviewedAssetSha256: true,
  reviewedContractHash: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewReason: true,
  updatedAt: true,
  createdAt: true,
} as const;

async function replayIfCommitted(
  prisma: PrismaClient,
  args: PrepareHumanVerifiedUnverifiedArgs,
): Promise<PrepareHumanVerifiedUnverifiedResult | null> {
  const operationKey = humanVerifiedUnverifiedOperationKey(
    args.orderId,
    args.idempotencyKey,
  );
  const [action, receipt] = await Promise.all([
    prisma.humanQaOperatorAction.findUnique({
      where: { idempotencyKey: operationKey },
      select: {
        id: true,
        requestHash: true,
        orderId: true,
        caseId: true,
        caseRevision: true,
        kind: true,
        status: true,
        actor: true,
        targetArtifacts: true,
        observedMarker: true,
        overrideReason: true,
        assetSha256: true,
        outcome: true,
        updatedAt: true,
      },
    }),
    prisma.atomicOperationReceipt.findUnique({
      where: { operationKey },
      select: { orderId: true, kind: true, payloadHash: true, result: true },
    }),
  ]);
  if (!action && !receipt) return null;
  if (action && !receipt && action.status === 'pending') {
    const preparedRequest = parseHumanVerifiedUnverifiedPreparedOutcome(
      action.outcome,
    );
    if (
      preparedRequest &&
      action.orderId === args.orderId &&
      action.kind === 'release' &&
      action.actor === args.actor &&
      action.targetArtifacts.length === 1 &&
      action.targetArtifacts[0] === args.artifactKey &&
      action.observedMarker === args.expectedMarker &&
      action.overrideReason === args.reviewReason &&
      action.assetSha256 === args.expectedAssetSha256 &&
      preparedRequest.idempotencyKey === args.idempotencyKey &&
      preparedRequest.inspectionDigest === args.inspectionDigest &&
      action.requestHash === humanVerifiedUnverifiedRequestHash(
        args.orderId,
        preparedRequest,
      )
    ) {
      return { request: preparedRequest };
    }
    const rawClaim = parseRawPreparationClaim(action.outcome);
    if (
      rawClaim &&
      rawClaim.inspectionDigest === args.inspectionDigest &&
      action.orderId === args.orderId &&
      action.kind === 'release' &&
      action.actor === args.actor &&
      action.targetArtifacts.length === 1 &&
      action.targetArtifacts[0] === args.artifactKey &&
      action.observedMarker === args.expectedMarker &&
      action.overrideReason === args.reviewReason &&
      action.assetSha256 === args.expectedAssetSha256
    ) {
      if (rawClaim.phase === 'provider_started') {
        throw new HumanVerifiedUnverifiedAdmissibilityError(
          'provider_outcome_ambiguous',
          'provider-started preparation requires manual reconciliation',
        );
      }
      // A provider-free re-inspection is allowed. The claim transaction below decides whether this exact raw
      // claim is still live or conservatively stale; no Vision call occurs before that decision.
      return null;
    }
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'invalid_request',
      'preparation is already claimed or bound to different input',
    );
  }
  const outcome = action
    ? parseHumanVerifiedUnverifiedOutcome(action.outcome)
    : null;
  const receiptValue = receipt
    ? parseHumanVerifiedUnverifiedAtomicReceiptResult(receipt.result)
    : null;
  if (
    !action ||
    !receipt ||
    !outcome ||
    !receiptValue ||
    action.orderId !== args.orderId ||
    action.kind !== 'release' ||
    action.status !== 'succeeded' ||
    action.actor !== args.actor ||
    action.targetArtifacts.length !== 1 ||
    action.targetArtifacts[0] !== args.artifactKey ||
    action.observedMarker !== args.expectedMarker ||
    action.overrideReason !== args.reviewReason ||
    action.assetSha256 !== args.expectedAssetSha256 ||
    outcome.actionId !== action.id ||
    outcome.caseId !== action.caseId ||
    outcome.caseRevision !== action.caseRevision ||
    outcome.orderId !== args.orderId ||
    outcome.artifactKey !== args.artifactKey ||
    outcome.assetSha256 !== args.expectedAssetSha256 ||
    outcome.inspectionDigest !== args.inspectionDigest ||
    outcome.reviewer !== args.actor ||
    outcome.requestHash !== action.requestHash ||
    outcome.receiptOperationKey !== operationKey ||
    receipt.orderId !== args.orderId ||
    receipt.kind !== 'operator_action' ||
    receipt.payloadHash !== action.requestHash ||
    receiptValue.actionId !== action.id ||
    receiptValue.requestHash !== action.requestHash ||
    receiptValue.inspectionDigest !== args.inspectionDigest ||
    receiptValue.resemblanceProofDigest !== outcome.resemblanceProofDigest ||
    receiptValue.qualityEvidenceDigest !== outcome.qualityEvidenceDigest ||
    canonicalHash(receiptValue.result) !== canonicalHash(outcome.result)
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'invalid_request',
      'idempotency key is already bound to different or incomplete state',
    );
  }
  const byteAuthority = await inspectHumanReviewAuthorityBytes(
    prisma,
    args.orderId,
    inspectAssetWithBytes,
  );
  const currentQuality = await loadQualityEvidence(
    prisma,
    args.orderId,
    byteAuthority,
  );
  const currentTarget = currentQuality.find(
    (row) => row.artifactKey === args.artifactKey,
  );
  if (
    currentTarget?.humanReviewVerified !== true ||
    currentTarget.humanReviewActionDigest !== action.requestHash
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'evidence_changed',
      'committed replay is no longer backed by current strict human-review authority',
    );
  }
  return { alreadyCommitted: receiptValue.result };
}

async function loadPreparationState(
  prisma: Db,
  orderId: string,
  pageNumber: number,
) {
  const [order, reviewCase, paymentCase, exceptionCases, payment, page, rows] =
    await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          deliveryHoldReason: true,
          deliveryFenceVersion: true,
          inputVersion: true,
          manualReviewRequired: true,
          visualContractHash: true,
          visualPackageAuthority: true,
          stripePaid: true,
          paymentProvider: true,
          paymentId: true,
          stripePaymentId: true,
          totalPrice: true,
          illustrationStyle: true,
          storySourceHash: true,
          selectionFilename: true,
          generationJob: { select: { pipelineCache: true } },
        },
      }),
      prisma.humanQaReviewCase.findUnique({
        where: { activeKey: `${orderId}:base_book` },
        select: {
          id: true,
          revision: true,
          kind: true,
          status: true,
          holdFingerprint: true,
          rawReason: true,
          inputVersion: true,
          contractHash: true,
        },
      }),
      prisma.humanQaReviewCase.findUnique({
        where: { activeKey: `${orderId}:payment` },
        select: { status: true },
      }),
      prisma.exceptionCase.findMany({
        where: { orderId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          activeKey: true,
          scope: true,
          kind: true,
          status: true,
          resolution: true,
          sourceRef: true,
          refundKey: true,
          providerActionId: true,
          actionAttemptedAt: true,
          notificationAttemptedAt: true,
          notificationMessageId: true,
          lastError: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.paymentRecord.findUnique({
        where: { orderId },
        select: {
          id: true,
          provider: true,
          amount: true,
          currency: true,
          paid: true,
          paidAt: true,
        },
      }),
      prisma.bookPage.findFirst({
        where: { book: { orderId }, pageNumber },
        select: {
          id: true,
          pageNumber: true,
          imageAsset: {
            select: {
              id: true,
              url: true,
              presentationUrl: true,
              safetyVerified: true,
              safetyHazards: true,
              safetyContentSha256: true,
              safetyOverriddenHazards: true,
              safetyOverrideSha256: true,
            },
          },
        },
      }),
      prisma.qualityEvidence.findMany({
        where: { orderId },
        select: QUALITY_SELECT,
      }),
    ]);
  const refundKeys = exceptionCases.flatMap((value) =>
    value.refundKey ? [value.refundKey] : [],
  );
  const refundAttempts = refundKeys.length > 0
    ? await prisma.refundAttempt.findMany({
        where: { refundKey: { in: refundKeys } },
        orderBy: { refundKey: 'asc' },
        select: {
          id: true,
          refundKey: true,
          provider: true,
          providerSaleId: true,
          status: true,
          providerActionId: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : [];
  return {
    order,
    reviewCase,
    paymentCase,
    activeException: exceptionCases.find(
      (value) => value.activeKey === `${orderId}:base_book`,
    ) ?? null,
    exceptionCases,
    refundAttempts,
    payment,
    page,
    qualityRows: rows.map(qualityRow),
  };
}

function asOrderSnapshot(
  value: NonNullable<Awaited<ReturnType<typeof loadPreparationState>>['order']>,
): HumanVerificationOrderSnapshot {
  return value;
}

function asCaseSnapshot(
  value: NonNullable<Awaited<ReturnType<typeof loadPreparationState>>['reviewCase']>,
): HumanVerificationCaseSnapshot {
  return value;
}

function asPaymentSnapshot(
  value: Awaited<ReturnType<typeof loadPreparationState>>['payment'],
): HumanVerificationPaymentSnapshot | null {
  return value;
}

function asTargetSnapshot(
  value: NonNullable<Awaited<ReturnType<typeof loadPreparationState>>['page']>,
): HumanVerificationTargetSnapshot {
  const asset = value.imageAsset!;
  return {
    pageId: value.id,
    pageNumber: value.pageNumber,
    assetId: asset.id,
    url: asset.url,
    presentationUrl: asset.presentationUrl,
    safetyVerified: asset.safetyVerified,
    safetyHazards: asset.safetyHazards,
    safetyContentSha256: asset.safetyContentSha256,
    safetyOverriddenHazards: asset.safetyOverriddenHazards,
    safetyOverrideSha256: asset.safetyOverrideSha256,
  };
}

function hasHistoricalRefundFence(
  state: Awaited<ReturnType<typeof loadPreparationState>>,
): boolean {
  return hasDisqualifyingRefundOrReconciliationActivity({
    exceptionCases: state.exceptionCases,
    refundAttempts: state.refundAttempts,
  });
}

function ensureInitialAdmissibility(
  state: Awaited<ReturnType<typeof loadPreparationState>>,
  args: Pick<
    InspectHumanVerifiedUnverifiedArgs,
    'expectedMarker' | 'expectedAssetSha256'
  >,
): asserts state is typeof state & {
  order: NonNullable<typeof state.order>;
  reviewCase: NonNullable<typeof state.reviewCase>;
  page: NonNullable<typeof state.page> & {
    imageAsset: NonNullable<NonNullable<typeof state.page>['imageAsset']>;
  };
} {
  const order = state.order;
  const reviewCase = state.reviewCase;
  const asset = state.page?.imageAsset;
  if (
    !order ||
    order.status !== 'needs_human_qa' ||
    order.deliveryHoldReason !== args.expectedMarker
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('marker_changed');
  }
  if (
    !reviewCase ||
    reviewCase.status !== 'open' ||
    reviewCase.kind !== 'safety' ||
    reviewCase.rawReason !== args.expectedMarker ||
    reviewCase.inputVersion !== order.inputVersion ||
    reviewCase.contractHash !== order.visualContractHash
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('case_changed');
  }
  if (order.manualReviewRequired || state.paymentCase?.status === 'open') {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'payment_fence_active',
    );
  }
  const payment = state.payment;
  if (
    !hasStrictHumanVerificationPaymentAuthority({ order, payment })
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'payment_snapshot_changed',
    );
  }
  if (state.activeException) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'exception_case_active',
    );
  }
  if (hasHistoricalRefundFence(state)) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'payment_snapshot_changed',
      'historical refund authority forbids provider spend and delivery',
    );
  }
  if (
    !asset ||
    asset.safetyContentSha256 !== args.expectedAssetSha256 ||
    asset.safetyVerified === true ||
    asset.safetyHazards.length !== 0 ||
    asset.safetyOverriddenHazards.length !== 0 ||
    asset.safetyOverrideSha256 !== null
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('asset_changed');
  }
}

type LoadedQualityRow = QualityEvidenceRow & {
  updatedAt: Date;
  providerModel: string | null;
  createdAt: Date;
};

const REQUIRED_PAGE_SELECT = {
  id: true,
  pageNumber: true,
  imageAsset: {
    select: {
      id: true,
      url: true,
      presentationUrl: true,
      safetyVerified: true,
      safetyHazards: true,
      safetyContentSha256: true,
      safetyOverriddenHazards: true,
      safetyOverrideSha256: true,
    },
  },
} as const;

type RequiredPage = Awaited<ReturnType<typeof loadRequiredPages>>[number];

async function loadRequiredPages(
  prisma: Db,
  orderId: string,
  pageNumbers: number[],
) {
  return prisma.bookPage.findMany({
    where: { book: { orderId }, pageNumber: { in: pageNumbers } },
    orderBy: { pageNumber: 'asc' },
    select: REQUIRED_PAGE_SELECT,
  });
}

async function lockQualityRows(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<LoadedQualityRow[]> {
  const rows = await tx.$queryRaw<Array<{
    id: string;
    artifactKey: string;
    assetSha256: string;
    verdict: string;
    evaluatorContractVersion: string;
    reason: string | null;
    regenCount: number;
    providerModel: string | null;
    contractHash: string | null;
    safetyOverride: boolean;
    safetyOverrideSha256: string | null;
    evidence: Prisma.JsonValue | null;
    evaluatedAt: Date;
    reviewStatus: string | null;
    reviewedAssetSha256: string | null;
    reviewedContractHash: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    reviewReason: string | null;
    updatedAt: Date;
    createdAt: Date;
  }>>`
    SELECT "id", "artifactKey", "assetSha256", "verdict",
           "evaluatorContractVersion", "reason", "regenCount", "providerModel", "contractHash",
           "safetyOverride", "safetyOverrideSha256", "evidence", "evaluatedAt",
           "reviewStatus", "reviewedAssetSha256", "reviewedContractHash",
           "reviewedBy", "reviewedAt", "reviewReason", "updatedAt", "createdAt"
      FROM "QualityEvidence"
     WHERE "orderId" = ${orderId}
     ORDER BY "artifactKey"
     FOR UPDATE`;
  return rows.map(qualityRow);
}

function validateInspectionArgs(args: InspectHumanVerifiedUnverifiedArgs): number {
  const markerMatch = /^safety_hold:unverified:page:([1-9][0-9]*)$/.exec(
    args.expectedMarker,
  );
  const pageNumber = markerMatch ? Number(markerMatch[1]) : null;
  if (
    !args.orderId.trim() ||
    pageNumber == null ||
    !Number.isSafeInteger(pageNumber) ||
    args.artifactKey !== `page:${pageNumber}` ||
    !/^[0-9a-f]{64}$/.test(args.expectedAssetSha256)
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('invalid_request');
  }
  return pageNumber;
}

async function deriveRequiredPageNumbers(
  order: NonNullable<Awaited<ReturnType<typeof loadPreparationState>>['order']>,
): Promise<number[]> {
  const cache = (order.generationJob?.pipelineCache ?? {}) as PipelineCache;
  const runtimeAuthority = await runWithStyle01RenderQualification(
    {
      illustrationStyle: order.illustrationStyle,
      frozenContractHash: order.visualContractHash,
      storySourceHash: order.storySourceHash,
      order,
      cache,
      // Qualification only: no render/reference/provider preflight.
      pageNumbers: [],
    },
    async (authority) => authority,
  );
  if (!runtimeAuthority) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'resemblance_not_proven',
      'authoritative runtime projection missing',
    );
  }
  return runtimeAuthority.bookProjection.frames
    .filter(
      (frame) =>
        frame.pageNumber > 0 &&
        frame.entityPresence.childPresence === 'present',
    )
    .map((frame) => frame.pageNumber)
    .sort((a, b) => a - b);
}

function assertRequiredPages(
  pages: RequiredPage[],
  requiredPageNumbers: number[],
): void {
  if (
    pages.length !== requiredPageNumbers.length ||
    pages.some(
      (page, index) =>
        page.pageNumber !== requiredPageNumbers[index] || !page.imageAsset,
    )
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'resemblance_not_proven',
      'a required child-present page asset is missing',
    );
  }
}

type InspectedPage = {
  page: RequiredPage;
  inspection: AssetInspectionWithBytes;
};

function reusableProofArtifacts(args: {
  pages: RequiredPage[];
  inspections: InspectedPage[];
  qualityRows: LoadedQualityRow[];
  anchorUrl: string;
  anchorBytesSha256: string;
  threshold: number;
}): Map<string, { proof: NonNullable<ReturnType<typeof parsePassingResemblanceProof>>; gate: Record<string, unknown> }> {
  const rowByArtifact = new Map(
    args.qualityRows.map((row) => [row.artifactKey, row]),
  );
  return new Map(
    args.inspections.flatMap(({ page, inspection }) => {
      const artifactKey = `page:${page.pageNumber}`;
      const row = rowByArtifact.get(artifactKey);
      const proof = row ? parsePassingResemblanceProof(row) : null;
      const gate = row && record(row.evidence)
        ? row.evidence.pageResemblanceGate
        : null;
      return proof &&
        record(gate) &&
        gate.referenceImageUrl === args.anchorUrl &&
        gate.referenceBytesSha256 === args.anchorBytesSha256 &&
        proof.threshold === args.threshold &&
        row!.assetSha256 === inspection.sha256
        ? [[artifactKey, { proof, gate }] as const]
        : [];
    }),
  );
}

function inspectionSnapshotDigest(args: {
  state: Awaited<ReturnType<typeof loadPreparationState>> & {
    order: NonNullable<Awaited<ReturnType<typeof loadPreparationState>>['order']>;
    reviewCase: NonNullable<Awaited<ReturnType<typeof loadPreparationState>>['reviewCase']>;
  };
  requiredArtifacts: string[];
  pages: RequiredPage[];
  inspections: InspectedPage[];
  anchor: NonNullable<ReturnType<typeof getApprovedChildCanonicalAnchor>>;
  anchorInspection: AssetInspectionWithBytes;
  threshold: number;
  needsProofArtifacts: string[];
}): string {
  const inspectionByArtifact = new Map(
    args.inspections.map((value) => [`page:${value.page.pageNumber}`, value.inspection]),
  );
  const rowByArtifact = new Map(
    args.state.qualityRows.map((row) => [row.artifactKey, row as LoadedQualityRow]),
  );
  return canonicalHash({
    version: 'human_verified_unverified_inspection/v1',
    order: {
      id: args.state.order.id,
      status: args.state.order.status,
      deliveryHoldReason: args.state.order.deliveryHoldReason,
      deliveryFenceVersion: args.state.order.deliveryFenceVersion,
      inputVersion: args.state.order.inputVersion,
      manualReviewRequired: args.state.order.manualReviewRequired,
      visualContractHash: args.state.order.visualContractHash,
      visualPackageAuthorityDigest: canonicalHash(
        args.state.order.visualPackageAuthority ?? null,
      ),
      illustrationStyle: args.state.order.illustrationStyle,
      storySourceHash: args.state.order.storySourceHash,
      selectionFilename: args.state.order.selectionFilename,
      pipelineCacheDigest: canonicalHash(
        args.state.order.generationJob?.pipelineCache ?? {},
      ),
    },
    reviewCase: args.state.reviewCase,
    paymentSnapshotDigest: paymentSnapshotDigest({
      order: asOrderSnapshot(args.state.order),
      payment: asPaymentSnapshot(args.state.payment),
      paymentCaseActive: args.state.paymentCase?.status === 'open',
      refundAuthorityDigest: refundAuthorityDigest({
        exceptionCases: args.state.exceptionCases,
        refundAttempts: args.state.refundAttempts,
      }),
    }),
    exceptionAuthority: args.state.exceptionCases.map((value) => ({
      id: value.id,
      activeKey: value.activeKey,
      scope: value.scope,
      kind: value.kind,
      status: value.status,
      resolutionDigest: canonicalHash(value.resolution ?? null),
      sourceRefDigest: canonicalHash(value.sourceRef ?? null),
      refundKeyDigest: canonicalHash(value.refundKey ?? null),
      providerActionIdDigest: canonicalHash(value.providerActionId ?? null),
      actionAttemptedAt: value.actionAttemptedAt?.toISOString() ?? null,
      notificationAttemptedAt:
        value.notificationAttemptedAt?.toISOString() ?? null,
      notificationMessageIdDigest: canonicalHash(
        value.notificationMessageId ?? null,
      ),
      lastErrorDigest: canonicalHash(value.lastError ?? null),
      createdAt: value.createdAt.toISOString(),
      updatedAt: value.updatedAt.toISOString(),
    })),
    refundAttempts: args.state.refundAttempts.map((value) => ({
      id: value.id,
      refundKeyDigest: canonicalHash(value.refundKey),
      provider: value.provider,
      providerSaleIdDigest: canonicalHash(value.providerSaleId),
      status: value.status,
      providerActionIdDigest: canonicalHash(value.providerActionId ?? null),
      createdAt: value.createdAt.toISOString(),
      updatedAt: value.updatedAt.toISOString(),
    })),
    approvedAnchor: {
      entryDigest: canonicalHash(args.anchor),
      urlHash: canonicalHash(args.anchor.url),
      bytesSha256: args.anchorInspection.sha256,
    },
    threshold: args.threshold,
    requiredArtifacts: args.requiredArtifacts,
    needsProofArtifacts: args.needsProofArtifacts,
    pages: args.pages.map((page) => {
      const artifactKey = `page:${page.pageNumber}`;
      const asset = page.imageAsset!;
      const inspection = inspectionByArtifact.get(artifactKey);
      const row = rowByArtifact.get(artifactKey);
      return {
        artifactKey,
        pageId: page.id,
        assetId: asset.id,
        sourceUrlHash: canonicalHash(asset.url),
        presentationUrlHash: canonicalHash(asset.presentationUrl),
        deliveredUrlHash: deliveredUrlHash(asset.presentationUrl ?? asset.url),
        deliveredBytesSha256: inspection?.sha256 ?? null,
        safetyVerified: asset.safetyVerified,
        safetyHazards: asset.safetyHazards,
        safetyContentSha256: asset.safetyContentSha256,
        safetyOverriddenHazards: asset.safetyOverriddenHazards,
        safetyOverrideSha256: asset.safetyOverrideSha256,
        quality: row
          ? {
              id: row.id ?? null,
              assetSha256: row.assetSha256,
              verdict: row.verdict,
              evaluatorContractVersion: row.evaluatorContractVersion,
              reason: row.reason,
              regenCount: row.regenCount,
              providerModel: row.providerModel,
              contractHash: row.contractHash,
              safetyOverride: row.safetyOverride,
              safetyOverrideSha256: row.safetyOverrideSha256,
              evidenceDigest: canonicalHash(row.evidence ?? null),
              evaluatedAt: row.evaluatedAt?.toISOString() ?? null,
              reviewStatus: row.reviewStatus ?? null,
              reviewedAssetSha256: row.reviewedAssetSha256 ?? null,
              reviewedContractHash: row.reviewedContractHash ?? null,
              reviewedBy: row.reviewedBy ?? null,
              reviewedAt: row.reviewedAt?.toISOString() ?? null,
              reviewReason: row.reviewReason ?? null,
              updatedAt: row.updatedAt?.toISOString() ?? null,
              createdAt: row.createdAt?.toISOString() ?? null,
            }
          : null,
      };
    }),
  });
}

function assertExactInspectionBindings(args: {
  order: NonNullable<Awaited<ReturnType<typeof loadPreparationState>>['order']>;
  pages: RequiredPage[];
  inspections: InspectedPage[];
  qualityRows: LoadedQualityRow[];
  anchorInspection: AssetInspectionWithBytes;
}): void {
  if (
    args.anchorInspection.ok !== true ||
    !args.anchorInspection.sha256 ||
    !args.anchorInspection.mime ||
    !args.anchorInspection.data
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'asset_changed',
      'canonical child anchor exact bytes are unavailable',
    );
  }
  const rowByArtifact = new Map(
    args.qualityRows.map((row) => [row.artifactKey, row]),
  );
  for (const { page, inspection } of args.inspections) {
    const artifactKey = `page:${page.pageNumber}`;
    const row = rowByArtifact.get(artifactKey);
    const asset = page.imageAsset;
    if (
      !asset ||
      inspection.ok !== true ||
      !inspection.sha256 ||
      !inspection.mime ||
      !inspection.data ||
      inspection.sha256 !== asset.safetyContentSha256 ||
      !row ||
      row.assetSha256 !== inspection.sha256 ||
      row.evaluatorContractVersion !== QUALITY_EVALUATOR_CONTRACT_VERSION ||
      row.contractHash !== args.order.visualContractHash
    ) {
      throw new HumanVerifiedUnverifiedAdmissibilityError(
        'asset_changed',
        `exact-byte binding failed for ${artifactKey}`,
      );
    }
  }
}

interface InspectionMaterial {
  state: Awaited<ReturnType<typeof loadPreparationState>> & {
    order: NonNullable<Awaited<ReturnType<typeof loadPreparationState>>['order']>;
    reviewCase: NonNullable<Awaited<ReturnType<typeof loadPreparationState>>['reviewCase']>;
    page: NonNullable<Awaited<ReturnType<typeof loadPreparationState>>['page']> & {
      imageAsset: NonNullable<NonNullable<Awaited<ReturnType<typeof loadPreparationState>>['page']>['imageAsset']>;
    };
    qualityRows: LoadedQualityRow[];
  };
  anchor: NonNullable<ReturnType<typeof getApprovedChildCanonicalAnchor>>;
  anchorInspection: AssetInspectionWithBytes;
  anchorVisionUrl: string;
  pages: RequiredPage[];
  inspections: InspectedPage[];
  requiredPageNumbers: number[];
  requiredArtifacts: string[];
  needsProofArtifacts: string[];
  thresholdConfig: ReturnType<typeof resolveResemblanceThresholdConfig>;
  threshold: number;
  reusableByArtifact: ReturnType<typeof reusableProofArtifacts>;
  inspection: HumanVerifiedUnverifiedInspection;
}

async function collectInspectionMaterial(
  prisma: Db,
  args: InspectHumanVerifiedUnverifiedArgs,
): Promise<InspectionMaterial> {
  const pageNumber = validateInspectionArgs(args);
  const state = await loadPreparationState(prisma, args.orderId, pageNumber);
  ensureInitialAdmissibility(state, args);
  const order = state.order;
  const cache = (order.generationJob?.pipelineCache ?? {}) as PipelineCache;
  const anchor = getApprovedChildCanonicalAnchor(cache);
  if (!anchor?.url) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'resemblance_not_proven',
      'approved child anchor missing',
    );
  }
  const requiredPageNumbers = await deriveRequiredPageNumbers(order);
  const requiredArtifacts = requiredPageNumbers.map((number) => `page:${number}`);
  if (!requiredArtifacts.includes(args.artifactKey)) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'resemblance_not_proven',
      'target page is not an authoritative child-present frame',
    );
  }
  const pages = await loadRequiredPages(prisma, args.orderId, requiredPageNumbers);
  assertRequiredPages(pages, requiredPageNumbers);
  const anchorInspection = await inspectAssetWithBytes(anchor.url);
  const anchorVisionUrl = exactByteDataUrl(
    anchorInspection,
    'canonical child anchor',
  );
  const settledInspections = await Promise.allSettled(
    pages.map(async (page) => ({
      page,
      inspection: await inspectAssetWithBytes(
        page.imageAsset!.presentationUrl ?? page.imageAsset!.url,
      ),
    })),
  );
  const rejectedInspection = settledInspections.find(
    (entry): entry is PromiseRejectedResult => entry.status === 'rejected',
  );
  if (rejectedInspection) throw rejectedInspection.reason;
  const inspections = settledInspections.map(
    (entry) => (entry as PromiseFulfilledResult<InspectedPage>).value,
  );
  const qualityRows = state.qualityRows as LoadedQualityRow[];
  assertExactInspectionBindings({
    order,
    pages,
    inspections,
    qualityRows,
    anchorInspection,
  });
  const thresholdConfig = resolveResemblanceThresholdConfig();
  const threshold = Math.max(
    PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
    resolveEffectiveThreshold(order.illustrationStyle, thresholdConfig),
  );
  const reusableByArtifact = reusableProofArtifacts({
    pages,
    inspections,
    qualityRows,
    anchorUrl: anchor.url,
    anchorBytesSha256: anchorInspection.sha256!,
    threshold,
  });
  const needsProofArtifacts = requiredArtifacts.filter(
    (artifactKey) => !reusableByArtifact.has(artifactKey),
  );
  const typedState = state as InspectionMaterial['state'];
  const inspection: HumanVerifiedUnverifiedInspection = {
    inspectionDigest: inspectionSnapshotDigest({
      state: typedState,
      requiredArtifacts,
      pages,
      inspections,
      anchor,
      anchorInspection,
      threshold,
      needsProofArtifacts,
    }),
    requiredArtifacts,
    needsProofArtifacts,
  };
  return {
    state: typedState,
    anchor,
    anchorInspection,
    anchorVisionUrl,
    pages,
    inspections,
    requiredPageNumbers,
    requiredArtifacts,
    needsProofArtifacts,
    thresholdConfig,
    threshold,
    reusableByArtifact,
    inspection,
  };
}

export async function inspectHumanVerifiedUnverifiedRelease(
  prisma: PrismaClient,
  args: InspectHumanVerifiedUnverifiedArgs,
): Promise<HumanVerifiedUnverifiedInspection> {
  if (!isHumanVerifiedUnverifiedReleaseEnvironmentEnabled()) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'invalid_request',
      'human verification is disabled outside its explicit Preview boundary',
    );
  }
  assertEnvSeparation();
  return (await collectInspectionMaterial(prisma, args)).inspection;
}

async function rebindInspectionUnderOrderLock(
  tx: Prisma.TransactionClient,
  material: InspectionMaterial,
  args: PrepareHumanVerifiedUnverifiedArgs,
): Promise<InspectionMaterial['state']> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Order" WHERE "id" = ${args.orderId} FOR UPDATE`;
  if (locked.length !== 1) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('marker_changed');
  }
  const lockedGenerationJob = await lockHumanVerificationGenerationJob(
    tx,
    args.orderId,
  );
  if (!lockedGenerationJob) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'resemblance_not_proven',
      'generation job authority missing',
    );
  }
  const pageNumber = validateInspectionArgs(args);
  const loaded = await loadPreparationState(tx, args.orderId, pageNumber);
  if (loaded.order) {
    loaded.order.generationJob = {
      pipelineCache: lockedGenerationJob.pipelineCache,
    };
  }
  ensureInitialAdmissibility(loaded, args);
  const lockedRows = await lockQualityRows(tx, args.orderId);
  const state = { ...loaded, qualityRows: lockedRows } as InspectionMaterial['state'];
  const requiredPageNumbers = await deriveRequiredPageNumbers(state.order);
  const requiredArtifacts = requiredPageNumbers.map((number) => `page:${number}`);
  const pages = await loadRequiredPages(tx, args.orderId, requiredPageNumbers);
  assertRequiredPages(pages, requiredPageNumbers);
  const anchor = getApprovedChildCanonicalAnchor(
    (state.order.generationJob?.pipelineCache ?? {}) as PipelineCache,
  );
  if (
    !anchor?.url ||
    canonicalHash(anchor) !== canonicalHash(material.anchor) ||
    canonicalHash(anchor.url) !== canonicalHash(material.anchor.url)
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'resemblance_not_proven',
      'approved canonical child anchor changed',
    );
  }
  const inspectionByArtifact = new Map(
    material.inspections.map((value) => [`page:${value.page.pageNumber}`, value.inspection]),
  );
  const inspections = pages.map((page) => {
    const inspection = inspectionByArtifact.get(`page:${page.pageNumber}`);
    if (!inspection) {
      throw new HumanVerifiedUnverifiedAdmissibilityError(
        'evidence_changed',
        'required inspected page set changed',
      );
    }
    return { page, inspection };
  });
  assertExactInspectionBindings({
    order: state.order,
    pages,
    inspections,
    qualityRows: lockedRows,
    anchorInspection: material.anchorInspection,
  });
  const reusable = reusableProofArtifacts({
    pages,
    inspections,
    qualityRows: lockedRows,
    anchorUrl: anchor.url,
    anchorBytesSha256: material.anchorInspection.sha256!,
    threshold: material.threshold,
  });
  const needsProofArtifacts = requiredArtifacts.filter(
    (artifactKey) => !reusable.has(artifactKey),
  );
  const digest = inspectionSnapshotDigest({
    state,
    requiredArtifacts,
    pages,
    inspections,
    anchor,
    anchorInspection: material.anchorInspection,
    threshold: material.threshold,
    needsProofArtifacts,
  });
  if (
    digest !== material.inspection.inspectionDigest ||
    digest !== args.inspectionDigest ||
    canonicalHash(requiredArtifacts) !== canonicalHash(material.requiredArtifacts) ||
    canonicalHash(needsProofArtifacts) !== canonicalHash(material.needsProofArtifacts)
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'evidence_changed',
      'inspection snapshot changed before provider spend',
    );
  }
  return state;
}

/**
 * Abort only a definitely refused prepared commit. Callers must never invoke this for an ambiguous atomic commit;
 * receipt presence and the exact prepared-request CAS provide an additional fail-closed backstop.
 */
export async function abortPreparedHumanVerifiedUnverifiedRelease(
  prisma: PrismaClient,
  args: {
    orderId: string;
    request: HumanVerifiedUnverifiedReleaseRequest;
    rule: string;
  },
): Promise<boolean> {
  if (!isHumanVerifiedUnverifiedReleaseEnvironmentEnabled()) return false;
  assertEnvSeparation();
  const operationKey = humanVerifiedUnverifiedOperationKey(
    args.orderId,
    args.request.idempotencyKey,
  );
  const requestHash = humanVerifiedUnverifiedRequestHash(
    args.orderId,
    args.request,
  );
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Order" WHERE "id" = ${args.orderId} FOR UPDATE`;
    if (locked.length !== 1) return false;
    const [action, receipt] = await Promise.all([
      tx.humanQaOperatorAction.findUnique({
        where: { idempotencyKey: operationKey },
        select: {
          id: true,
          orderId: true,
          caseId: true,
          caseRevision: true,
          status: true,
          requestHash: true,
          outcome: true,
          updatedAt: true,
        },
      }),
      tx.atomicOperationReceipt.findUnique({
        where: { operationKey },
        select: { operationKey: true },
      }),
    ]);
    const prepared = action
      ? parseHumanVerifiedUnverifiedPreparedOutcome(action.outcome)
      : null;
    const proofInputDigest = prepared
      ? proofInputDigestFromPreparedRequest(prepared)
      : null;
    if (
      receipt ||
      !action ||
      action.orderId !== args.orderId ||
      action.status !== 'pending' ||
      action.requestHash !== requestHash ||
      !prepared ||
      !proofInputDigest ||
      action.caseId !== prepared.expectedCaseId ||
      action.caseRevision !== prepared.expectedCaseRevision ||
      canonicalHash(prepared) !== canonicalHash(args.request)
    ) return false;
    const updated = await tx.humanQaOperatorAction.updateMany({
      where: {
        id: action.id,
        orderId: args.orderId,
        status: 'pending',
        requestHash,
        updatedAt: action.updatedAt,
      },
      data: {
        status: 'aborted',
        outcome: {
          version: PREPARATION_POST_SCORE_ABORTED_VERSION,
          phase: 'proof_settled_commit_refused',
          requestHash,
          inspectionDigest: prepared.inspectionDigest,
          caseRevision: prepared.expectedCaseRevision,
          proofInputDigest,
          rule: args.rule,
        },
      },
    });
    return updated.count === 1;
  });
}

export async function prepareHumanVerifiedUnverifiedRelease(
  prisma: PrismaClient,
  args: PrepareHumanVerifiedUnverifiedArgs,
): Promise<PrepareHumanVerifiedUnverifiedResult> {
  if (!isHumanVerifiedUnverifiedReleaseEnvironmentEnabled()) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'invalid_request',
      'human verification is disabled outside its explicit Preview boundary',
    );
  }
  assertEnvSeparation();
  args = { ...args, reviewReason: args.reviewReason.trim() };
  const replay = await replayIfCommitted(prisma, args);
  if (replay) return replay;

  const pageNumber = validateInspectionArgs(args);
  if (
    !/^[0-9a-f]{64}$/.test(args.inspectionDigest) ||
    !args.reviewReason.trim() ||
    !args.actor.trim() ||
    !args.idempotencyKey.trim()
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('invalid_request');
  }

  const material = await collectInspectionMaterial(prisma, args);
  if (material.inspection.inspectionDigest !== args.inspectionDigest) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'evidence_changed',
      'Apply must bind the current Inspect digest',
    );
  }
  const {
    state: initial,
    anchor,
    anchorInspection,
    anchorVisionUrl,
    inspections,
    requiredPageNumbers,
    requiredArtifacts,
    thresholdConfig,
    threshold,
    reusableByArtifact,
  } = material;
  const order = initial.order;
  const attemptsPerPage = 1 + PAGE_CHILD_RESEMBLANCE_MAX_RETRIES;
  const pagesNeedingVision = requiredPageNumbers.length - reusableByArtifact.size;
  if (pagesNeedingVision * attemptsPerPage > MAX_VISION_CALLS) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'resemblance_not_proven',
      'bounded Vision allowance exceeded',
    );
  }

  // Claim this exact preparation BEFORE the first billable Vision call. The unique action key prevents concurrent
  // workers (or a same-key retry) from spending twice. At this stage the action is pending and carries only a
  // canonical claim digest; the final prepared request is attached atomically with the evidence backfill below.
  const operationKey = humanVerifiedUnverifiedOperationKey(
    args.orderId,
    args.idempotencyKey,
  );
  const inspectedArtifacts = inspections.map(({ page, inspection }) => ({
    artifactKey: `page:${page.pageNumber}`,
    assetId: page.imageAsset!.id,
    sha256: inspection.sha256,
    deliveredUrlHash: deliveredUrlHash(
      page.imageAsset!.presentationUrl ?? page.imageAsset!.url,
    ),
  }));
  const proofInputDigest = canonicalHash({
    requiredArtifacts,
    anchorUrlHash: canonicalHash(anchor.url),
    anchorBytesSha256: anchorInspection.sha256,
    threshold,
    caseId: initial.reviewCase.id,
    caseRevision: initial.reviewCase.revision,
    inspectedArtifacts,
  });
  const preparationClaimHash = canonicalHash({
    version: PREPARATION_CLAIM_VERSION,
    orderId: args.orderId,
    inspectionDigest: args.inspectionDigest,
    artifactKey: args.artifactKey,
    expectedMarker: args.expectedMarker,
    expectedAssetSha256: args.expectedAssetSha256,
    reviewReason: args.reviewReason,
    actor: args.actor,
    proofInputDigest,
    orderFence: order.deliveryFenceVersion,
    orderInputVersion: order.inputVersion,
    caseId: initial.reviewCase.id,
    caseRevision: initial.reviewCase.revision,
  });
  let claimedAction: { id: string; updatedAt: Date };
  try {
    claimedAction = await prisma.$transaction(async (tx) => {
      await rebindInspectionUnderOrderLock(tx, material, args);
      const now = new Date();
      const existing = await tx.humanQaOperatorAction.findUnique({
        where: { idempotencyKey: operationKey },
        select: {
          id: true,
          requestHash: true,
          orderId: true,
          caseId: true,
          caseRevision: true,
          kind: true,
          status: true,
          actor: true,
          targetArtifacts: true,
          observedMarker: true,
          observedFence: true,
          observedInputVersion: true,
          overriddenHazards: true,
          overrideReason: true,
          assetSha256: true,
          outcome: true,
          updatedAt: true,
        },
      });
      if (existing) {
        const rawClaim = parseRawPreparationClaim(existing.outcome);
        if (
          !rawClaim ||
          rawClaim.claimHash !== preparationClaimHash ||
          rawClaim.inspectionDigest !== args.inspectionDigest ||
          rawClaim.proofInputDigest !== proofInputDigest ||
          existing.requestHash !== preparationClaimHash ||
          existing.orderId !== args.orderId ||
          existing.caseId !== initial.reviewCase.id ||
          existing.caseRevision !== initial.reviewCase.revision ||
          existing.kind !== 'release' ||
          existing.status !== 'pending' ||
          existing.actor !== args.actor ||
          existing.targetArtifacts.length !== 1 ||
          existing.targetArtifacts[0] !== args.artifactKey ||
          existing.observedMarker !== args.expectedMarker ||
          existing.observedFence !== order.deliveryFenceVersion ||
          existing.observedInputVersion !== order.inputVersion ||
          existing.overriddenHazards.length !== 0 ||
          existing.overrideReason !== args.reviewReason ||
          existing.assetSha256 !== args.expectedAssetSha256
        ) {
          throw new HumanVerifiedUnverifiedAdmissibilityError(
            'invalid_request',
            'idempotency key is bound to a different preparation',
          );
        }
        if (rawClaim.phase === 'provider_started') {
          throw new HumanVerifiedUnverifiedAdmissibilityError(
            'provider_outcome_ambiguous',
            'provider-started preparation requires manual reconciliation',
          );
        }
        if (!claimIsConservativelyStale(existing.updatedAt, now)) {
          throw new HumanVerifiedUnverifiedAdmissibilityError(
            'invalid_request',
            'the exact preparation is still in progress',
          );
        }
        const receipt = await tx.atomicOperationReceipt.findUnique({
          where: { operationKey },
          select: { operationKey: true },
        });
        if (receipt) {
          throw new HumanVerifiedUnverifiedAdmissibilityError(
            'invalid_request',
            'a receipt exists for the pending action',
          );
        }
        const reclaimed = await tx.humanQaOperatorAction.updateMany({
          where: {
            id: existing.id,
            status: 'pending',
            requestHash: preparationClaimHash,
            updatedAt: existing.updatedAt,
          },
          data: {
            outcome: {
              version: PREPARATION_CLAIM_VERSION,
              claimHash: preparationClaimHash,
              inspectionDigest: args.inspectionDigest,
              proofInputDigest,
              phase: 'claimed_no_provider',
            },
          },
        });
        if (reclaimed.count !== 1) {
          throw new HumanVerifiedUnverifiedAdmissibilityError(
            'invalid_request',
            'stale claim reclamation lost its CAS',
          );
        }
        const refreshed = await tx.humanQaOperatorAction.findUnique({
          where: { id: existing.id },
          select: { id: true, updatedAt: true },
        });
        if (!refreshed) {
          throw new HumanVerifiedUnverifiedAdmissibilityError('invalid_request');
        }
        return refreshed;
      }

      const competingClaims = await tx.humanQaOperatorAction.findMany({
        where: {
          orderId: args.orderId,
          caseId: initial.reviewCase.id,
          caseRevision: initial.reviewCase.revision,
          kind: 'release',
        },
        select: {
          id: true,
          idempotencyKey: true,
          requestHash: true,
          status: true,
          outcome: true,
          updatedAt: true,
        },
      });
      for (const competing of competingClaims) {
        const rawClaim = parseRawPreparationClaim(competing.outcome);
        const priorSpendRule = classifyPriorProviderSpend({
          outcome: competing.outcome,
          status: competing.status,
          inspectionDigest: args.inspectionDigest,
          caseRevision: initial.reviewCase.revision,
          proofInputDigest,
        });
        if (priorSpendRule) {
          throw new HumanVerifiedUnverifiedAdmissibilityError(
            priorSpendRule,
            'this exact inspection snapshot already owns or consumed its provider allowance',
          );
        }
        const prepared = parseHumanVerifiedUnverifiedPreparedOutcome(
          competing.outcome,
        );
        if (competing.status === 'pending' && prepared) {
          throw new HumanVerifiedUnverifiedAdmissibilityError(
            'invalid_request',
            'another prepared release already owns this case',
          );
        }
        if (!rawClaim || rawClaim.proofInputDigest !== proofInputDigest) {
          if (competing.status === 'pending' && !rawClaim) {
            throw new HumanVerifiedUnverifiedAdmissibilityError(
              'invalid_request',
              'another release preparation already owns this case',
            );
          }
          continue;
        }
        if (
          competing.status !== 'pending' ||
          rawClaim.claimHash !== competing.requestHash
        ) {
          throw new HumanVerifiedUnverifiedAdmissibilityError(
            'invalid_request',
            'same-snapshot provider claim is malformed',
          );
        }
        if (rawClaim.phase === 'provider_started') {
          throw new HumanVerifiedUnverifiedAdmissibilityError(
            'provider_outcome_ambiguous',
            'another provider-started release requires manual reconciliation',
          );
        }
        if (!claimIsConservativelyStale(competing.updatedAt, now)) {
          throw new HumanVerifiedUnverifiedAdmissibilityError(
            'invalid_request',
            'another release preparation already owns this case',
          );
        }
        const receipt = await tx.atomicOperationReceipt.findUnique({
          where: { operationKey: competing.idempotencyKey },
          select: { operationKey: true },
        });
        if (receipt) {
          // A receipt can mean commit ambiguity. Never abort it automatically.
          throw new HumanVerifiedUnverifiedAdmissibilityError(
            'invalid_request',
            'a competing release may have committed',
          );
        }
        const abandoned = await tx.humanQaOperatorAction.updateMany({
          where: {
            id: competing.id,
            status: 'pending',
            requestHash: competing.requestHash,
            updatedAt: competing.updatedAt,
          },
          data: {
            status: 'aborted',
            outcome: {
              version: PREPARATION_ABORTED_VERSION,
              rule: 'stale_raw_claim_reclaimed',
            },
          },
        });
        if (abandoned.count !== 1) {
          throw new HumanVerifiedUnverifiedAdmissibilityError(
            'invalid_request',
            'competing stale claim moved during reclamation',
          );
        }
      }
      return tx.humanQaOperatorAction.create({
        data: {
          idempotencyKey: operationKey,
          requestHash: preparationClaimHash,
          orderId: args.orderId,
          caseId: initial.reviewCase.id,
          caseRevision: initial.reviewCase.revision,
          kind: 'release',
          status: 'pending',
          actor: args.actor,
          note: null,
          targetArtifacts: [args.artifactKey],
          observedMarker: args.expectedMarker,
          observedFence: order.deliveryFenceVersion,
          observedInputVersion: order.inputVersion,
          overriddenHazards: [],
          overrideReason: args.reviewReason,
          assetSha256: args.expectedAssetSha256,
          outcome: {
            version: PREPARATION_CLAIM_VERSION,
            claimHash: preparationClaimHash,
            inspectionDigest: args.inspectionDigest,
            proofInputDigest,
            phase: 'claimed_no_provider',
          },
        },
        select: { id: true, updatedAt: true },
      });
    });
  } catch (error) {
    const raced = await replayIfCommitted(prisma, args);
    if (raced) return raced;
    throw error;
  }

  // Durable spend boundary: mark provider_started before launching even the first billable call. Once this phase
  // is durable it is NEVER reclaimed automatically, because a crash may have happened after the provider accepted
  // a request but before its result was persisted. A lost/ambiguous phase-transition acknowledgement also launches
  // no provider call; a later retry fails closed for manual reconciliation.
  if (pagesNeedingVision > 0) {
    claimedAction = await prisma.$transaction(async (tx) => {
      await rebindInspectionUnderOrderLock(tx, material, args);
      const marked = await tx.humanQaOperatorAction.updateMany({
        where: {
          id: claimedAction.id,
          idempotencyKey: operationKey,
          orderId: args.orderId,
          status: 'pending',
          requestHash: preparationClaimHash,
          updatedAt: claimedAction.updatedAt,
        },
        data: {
          outcome: {
            version: PREPARATION_CLAIM_VERSION,
            claimHash: preparationClaimHash,
            inspectionDigest: args.inspectionDigest,
            proofInputDigest,
            phase: 'provider_started',
          },
        },
      });
      if (marked.count !== 1) {
        throw new HumanVerifiedUnverifiedAdmissibilityError(
          'provider_outcome_ambiguous',
          'provider spend phase could not be claimed exactly once',
        );
      }
      const refreshed = await tx.humanQaOperatorAction.findUnique({
        where: { id: claimedAction.id },
        select: { id: true, updatedAt: true },
      });
      if (!refreshed) {
        throw new HumanVerifiedUnverifiedAdmissibilityError(
          'provider_outcome_ambiguous',
        );
      }
      return refreshed;
    });
  }

  let scored: Array<{
    page: (typeof inspections)[number]['page'];
    inspection: (typeof inspections)[number]['inspection'];
    result: Awaited<ReturnType<typeof evaluatePageChildResemblanceVision>>;
  }>;
  // Calls already accepted by the provider must settle, but once any page returns a deterministic refusal no
  // sibling may begin a later retry. This shared batch fence is checked immediately before every paid attempt.
  let deterministicBatchRefusal = false;
  const settledScores = await Promise.allSettled(
    inspections.map(async ({ page, inspection }) => {
      const artifactKey = `page:${page.pageNumber}`;
      const reusable = reusableByArtifact.get(artifactKey);
      if (reusable) {
        return {
          page,
          inspection,
          result: {
            evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
            status: 'passed' as const,
            resemblanceScore: reusable.proof.resemblanceScore,
            threshold,
            subjectVisible: true,
            sameChild: true,
            reasonCode: 'same_child' as const,
            attempts: 0,
            model:
              typeof reusable.gate.model === 'string'
                ? reusable.gate.model
                : 'persisted_same_bytes',
            featureAssessments: null,
          },
        };
      }
      const result = await evaluatePageChildResemblanceVision({
        referenceImageUrl: anchorVisionUrl,
        candidateImageUrl: exactByteDataUrl(
          inspection,
          `page:${page.pageNumber}`,
        ),
        threshold,
        shouldStartAttempt: () => !deterministicBatchRefusal,
      });
      if (
        result.status !== 'passed' ||
        result.resemblanceScore == null ||
        result.resemblanceScore < threshold ||
        result.subjectVisible !== true ||
        result.sameChild !== true
      ) {
        const deterministicRefusal =
          result.status === 'failed' || result.reasonCode === 'batch_cancelled';
        if (deterministicRefusal) deterministicBatchRefusal = true;
        throw new ProviderScoringTerminalError(
          deterministicRefusal
            ? 'deterministic_refusal'
            : 'unknown_or_ambiguous',
          `page:${page.pageNumber}:${result.reasonCode}`,
        );
      }
      return { page, inspection, result };
    }),
  );
  const rejectedScores = settledScores.filter(
    (entry): entry is PromiseRejectedResult => entry.status === 'rejected',
  );
  const failedScore =
    rejectedScores.find(
      (entry) =>
        entry.reason instanceof ProviderScoringTerminalError &&
        entry.reason.disposition === 'deterministic_refusal',
    ) ?? rejectedScores[0];
  if (failedScore) {
    const error = failedScore.reason;
    // allSettled above is deliberate: no action is marked aborted while another launched paid request may still
    // be running. The CAS also prevents a stale worker from aborting a reclaimed claim.
    await prisma.humanQaOperatorAction.updateMany({
      where: {
        id: claimedAction.id,
        idempotencyKey: operationKey,
        status: 'pending',
        requestHash: preparationClaimHash,
        updatedAt: claimedAction.updatedAt,
      },
      data: {
        status: 'aborted',
        outcome: {
          version: PREPARATION_SPEND_TERMINAL_VERSION,
          phase: 'provider_settled_terminal',
          claimHash: preparationClaimHash,
          inspectionDigest: args.inspectionDigest,
          caseRevision: initial.reviewCase.revision,
          proofInputDigest,
          disposition:
            error instanceof ProviderScoringTerminalError
              ? error.disposition
              : 'unknown_or_ambiguous',
          rule:
            error instanceof HumanVerifiedUnverifiedAdmissibilityError
              ? error.rule
              : 'resemblance_not_proven',
        },
      },
    }).catch(() => {});
    throw error;
  }
  scored = settledScores.map(
    (entry) => (entry as PromiseFulfilledResult<(typeof scored)[number]>).value,
  );

  // Persist only evidence metadata, atomically and with exact-row CAS. No image/order/payment row is created or
  // replaced. Every fresh proof clears any stale human-review projection before the actual review ceremony starts.
  let request: HumanVerifiedUnverifiedReleaseRequest;
  try {
    request = await prisma.$transaction(async (tx) => {
      const postScoreState = await rebindInspectionUnderOrderLock(
        tx,
        material,
        args,
      );
      const postScoreRows = new Map(
        postScoreState.qualityRows.map((row) => [row.artifactKey, row]),
      );
      for (const { page, inspection, result } of scored) {
        const artifactKey = `page:${page.pageNumber}`;
        const row = postScoreRows.get(artifactKey)!;
        const base = record(row.evidence) ? row.evidence : {};
        const qaContext = record(base.qaContext)
          ? { ...base.qaContext, expectsChild: true }
          : { expectsChild: true };
        const nextEvidence = {
          ...base,
          qaContext,
          pageResemblanceGate: {
            required: true,
            referenceImageUrl: anchor.url,
            referenceBytesSha256: anchorInspection.sha256,
            status: result.status,
            resemblanceScore: result.resemblanceScore,
            threshold,
            minAcceptableScore: thresholdConfig.minAcceptableScore,
            faceDetectConfidence: null,
            faceAreaRatio: null,
            evaluatorVersion: result.evaluatorVersion,
            subjectVisible: result.subjectVisible,
            sameChild: result.sameChild,
            source: 'delivered_bytes',
            reasonCode: result.reasonCode,
            attempts: result.attempts,
            model: result.model,
            featureAssessments: result.featureAssessments,
            deliveredBytesSha256: inspection.sha256,
          },
        } as unknown as Prisma.InputJsonValue;
        const updated = await tx.qualityEvidence.updateMany({
          where: {
            id: row.id!,
            orderId: args.orderId,
            artifactKey,
            assetSha256: inspection.sha256!,
            evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
            contractHash: order.visualContractHash,
            evaluatedAt: row.evaluatedAt,
            updatedAt: row.updatedAt,
          },
          data: {
            evidence: nextEvidence,
            reviewStatus: null,
            reviewedAssetSha256: null,
            reviewedContractHash: null,
            reviewedBy: null,
            reviewedAt: null,
            reviewReason: null,
          },
        });
        if (updated.count !== 1) {
          throw new HumanVerifiedUnverifiedAdmissibilityError(
            'evidence_changed',
            `${artifactKey} moved during resemblance proof persist`,
          );
        }
      }
      const fresh = await loadPreparationState(tx, args.orderId, pageNumber);
      ensureInitialAdmissibility(fresh, args);
      const targetEvidence = fresh.qualityRows.find(
        (row) => row.artifactKey === args.artifactKey,
      );
      if (!targetEvidence) {
        throw new HumanVerifiedUnverifiedAdmissibilityError('evidence_changed');
      }
      const proofArtifactBindings = new Map(
        material.pages.map((page) => [
          `page:${page.pageNumber}`,
          {
            assetId: page.imageAsset!.id,
            deliveredUrl:
              page.imageAsset!.presentationUrl ?? page.imageAsset!.url,
          },
        ]),
      );
      const proofDigest = resemblanceProofDigest(
        fresh.qualityRows,
        requiredArtifacts,
        proofArtifactBindings,
      );
      const proofEntries = resemblanceProofsFromRows(
        fresh.qualityRows,
        requiredArtifacts,
        proofArtifactBindings,
      );
      if (!proofDigest || !proofEntries) {
        throw new HumanVerifiedUnverifiedAdmissibilityError(
          'resemblance_not_proven',
        );
      }
      const orderSnapshot = asOrderSnapshot(fresh.order);
      const caseSnapshot = asCaseSnapshot(fresh.reviewCase);
      const targetSnapshot = asTargetSnapshot(fresh.page);
      const currentRefundAuthorityDigest = refundAuthorityDigest({
        exceptionCases: fresh.exceptionCases,
        refundAttempts: fresh.refundAttempts,
      });
      const preparedRequest: HumanVerifiedUnverifiedReleaseRequest = {
        inspectionDigest: args.inspectionDigest,
        artifactKey: args.artifactKey,
        expectedMarker: args.expectedMarker,
        expectedCaseId: caseSnapshot.id,
        expectedCaseRevision: caseSnapshot.revision,
        expectedCaseFingerprint: caseSnapshot.holdFingerprint,
        expectedAssetId: targetSnapshot.assetId,
        expectedAssetSha256: args.expectedAssetSha256,
        expectedDeliveredUrlHash: deliveredUrlHash(
          targetSnapshot.presentationUrl ?? targetSnapshot.url,
        ),
        expectedAnchorEntryDigest: canonicalHash(anchor),
        expectedAnchorUrlHash: canonicalHash(anchor.url),
        expectedAnchorBytesSha256: anchorInspection.sha256!,
        expectedContractHash: orderSnapshot.visualContractHash,
        expectedEvaluatorVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
        snapshotDigest: humanVerificationSnapshotDigest({
          order: orderSnapshot,
          reviewCase: caseSnapshot,
          target: targetSnapshot,
          evidence: targetEvidence,
        }),
        refundAuthorityDigest: currentRefundAuthorityDigest,
        paymentSnapshotDigest: paymentSnapshotDigest({
          order: orderSnapshot,
          payment: asPaymentSnapshot(fresh.payment),
          paymentCaseActive: fresh.paymentCase?.status === 'open',
          refundAuthorityDigest: currentRefundAuthorityDigest,
        }),
        resemblanceProofDigest: proofDigest,
        resemblanceProofs: proofEntries,
        requiredResemblanceArtifacts: requiredArtifacts,
        reviewReason: args.reviewReason,
        actor: args.actor,
        idempotencyKey: args.idempotencyKey,
      };
      validateHumanVerifiedUnverifiedRequest(preparedRequest);
      const claimUpdated = await tx.humanQaOperatorAction.updateMany({
        where: {
          id: claimedAction.id,
          idempotencyKey: operationKey,
          status: 'pending',
          requestHash: preparationClaimHash,
          updatedAt: claimedAction.updatedAt,
          orderId: args.orderId,
          caseId: caseSnapshot.id,
          caseRevision: caseSnapshot.revision,
          observedMarker: args.expectedMarker,
          observedFence: orderSnapshot.deliveryFenceVersion,
          observedInputVersion: orderSnapshot.inputVersion,
          assetSha256: args.expectedAssetSha256,
        },
        data: {
          requestHash: humanVerifiedUnverifiedRequestHash(
            args.orderId,
            preparedRequest,
          ),
          outcome: humanVerifiedUnverifiedPreparedOutcome(
            preparedRequest,
          ) as unknown as Prisma.InputJsonValue,
        },
      });
      if (claimUpdated.count !== 1) {
        throw new HumanVerifiedUnverifiedAdmissibilityError(
          'evidence_changed',
          'preparation claim moved before proof persist',
        );
      }
      return preparedRequest;
    });
  } catch (error) {
    await prisma.humanQaOperatorAction.updateMany({
      where: {
        id: claimedAction.id,
        idempotencyKey: operationKey,
        status: 'pending',
        requestHash: preparationClaimHash,
        updatedAt: claimedAction.updatedAt,
      },
      data: {
        status: 'aborted',
        outcome: pagesNeedingVision > 0
          ? {
              version: PREPARATION_SPEND_TERMINAL_VERSION,
              phase: 'provider_settled_terminal',
              claimHash: preparationClaimHash,
              inspectionDigest: args.inspectionDigest,
              caseRevision: initial.reviewCase.revision,
              proofInputDigest,
              disposition: 'post_score_persist_failed',
              rule:
                error instanceof HumanVerifiedUnverifiedAdmissibilityError
                  ? error.rule
                  : 'evidence_changed',
            }
          : {
              version: PREPARATION_ABORTED_VERSION,
              rule:
                error instanceof HumanVerifiedUnverifiedAdmissibilityError
                  ? error.rule
                  : 'evidence_changed',
            },
      },
    }).catch(() => {});
    throw error;
  }
  return { request };
}
