import 'server-only';

import type { Prisma } from '@prisma/client';

import { canonicalHash } from '@/lib/canonical-json';
import {
  deliveredUrlHash,
  hasDisqualifyingRefundOrReconciliationActivity,
  hasStrictHumanVerificationPaymentAuthority,
  lockHumanVerificationGenerationJob,
  paymentSnapshotDigest,
  refundAuthorityDigest,
  type HumanVerificationExceptionActivitySnapshot,
  type HumanVerificationPaymentSnapshot,
  type HumanVerificationRefundAttemptSnapshot,
} from './human-verified-unverified-authority';
import { getApprovedChildCanonicalAnchor } from './character-anchor-store';
import type { PipelineCache } from './types';
import { resolveHumanQaCaseOnReleaseInTx } from '@/lib/human-qa/record-hold';
import {
  HUMAN_VERIFIED_UNVERIFIED_RECEIPT_VERSION,
  HUMAN_VERIFIED_UNVERIFIED_REVIEW_STATUS,
  HUMAN_VERIFIED_UNVERIFIED_VERSION,
  humanVerifiedUnverifiedQualityAuthorityDigest,
  humanVerifiedUnverifiedResemblanceProofDigest,
  parseHumanVerifiedUnverifiedResemblanceProofs,
  serializeHumanVerifiedUnverifiedReviewReason,
  type HumanVerifiedUnverifiedCommitResult,
  type HumanVerifiedUnverifiedOutcome,
  type HumanVerifiedUnverifiedReceiptValue,
  type HumanVerifiedUnverifiedResemblanceProof,
} from './human-verified-unverified-contract';
import {
  isHumanReviewableUnverifiedReason,
  QUALITY_EVALUATOR_CONTRACT_VERSION,
  type QualityEvidenceRow,
} from './quality-evidence';
import {
  PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
  PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
} from './page-child-resemblance-vision';
import { SAFETY_SHA256_RE } from './asset-safety-signal';
import {
  evaluateSafetyDeliveryGate,
  loadSafetyGateInputs,
  projectHumanVerificationOntoGateInputs,
} from './safety-delivery-gate';
import {
  executeHumanVerifiedUnverifiedReleaseTransition,
  humanVerifiedUnverifiedMarker,
  parseSinglePageSafetyUnverifiedMarker,
} from './order-authority';

export {
  deliveredUrlHash,
  hasDisqualifyingRefundOrReconciliationActivity,
  paymentSnapshotDigest,
  refundAuthorityDigest,
} from './human-verified-unverified-authority';
export type {
  HumanVerificationExceptionActivitySnapshot,
  HumanVerificationPaymentSnapshot,
  HumanVerificationRefundAttemptSnapshot,
} from './human-verified-unverified-authority';

export interface HumanVerifiedUnverifiedReleaseRequest {
  inspectionDigest: string;
  artifactKey: string;
  expectedMarker: string;
  expectedCaseId: string;
  expectedCaseRevision: number;
  expectedCaseFingerprint: string;
  expectedAssetId: string;
  expectedAssetSha256: string;
  expectedDeliveredUrlHash: string;
  expectedAnchorEntryDigest: string;
  expectedAnchorUrlHash: string;
  expectedAnchorBytesSha256: string;
  expectedContractHash: string | null;
  expectedEvaluatorVersion: string;
  snapshotDigest: string;
  refundAuthorityDigest: string;
  paymentSnapshotDigest: string;
  resemblanceProofDigest: string;
  resemblanceProofs: HumanVerifiedUnverifiedResemblanceProof[];
  requiredResemblanceArtifacts: string[];
  reviewReason: string;
  actor: string;
  idempotencyKey: string;
}

export const HUMAN_VERIFIED_UNVERIFIED_PREPARED_VERSION =
  'human_verified_unverified_prepared/v1' as const;

const HUMAN_REQUEST_KEYS = [
  'inspectionDigest', 'artifactKey', 'expectedMarker', 'expectedCaseId', 'expectedCaseRevision',
  'expectedCaseFingerprint', 'expectedAssetId', 'expectedAssetSha256',
  'expectedDeliveredUrlHash', 'expectedAnchorEntryDigest',
  'expectedAnchorUrlHash', 'expectedAnchorBytesSha256',
  'expectedContractHash', 'expectedEvaluatorVersion',
  'snapshotDigest', 'refundAuthorityDigest', 'paymentSnapshotDigest', 'resemblanceProofDigest',
  'resemblanceProofs', 'requiredResemblanceArtifacts', 'reviewReason', 'actor', 'idempotencyKey',
] as const;

export function humanVerifiedUnverifiedPreparedOutcome(
  request: HumanVerifiedUnverifiedReleaseRequest,
): { version: typeof HUMAN_VERIFIED_UNVERIFIED_PREPARED_VERSION; request: HumanVerifiedUnverifiedReleaseRequest } {
  return { version: HUMAN_VERIFIED_UNVERIFIED_PREPARED_VERSION, request };
}

export function parseHumanVerifiedUnverifiedPreparedOutcome(
  value: unknown,
): HumanVerifiedUnverifiedReleaseRequest | null {
  if (!record(value) || Object.keys(value).length !== 2 || value.version !== HUMAN_VERIFIED_UNVERIFIED_PREPARED_VERSION) {
    return null;
  }
  if (!record(value.request)) return null;
  const keys = Object.keys(value.request).sort();
  const expected = [...HUMAN_REQUEST_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return null;
  const request = value.request as unknown as HumanVerifiedUnverifiedReleaseRequest;
  try {
    validateHumanVerifiedUnverifiedRequest(request);
  } catch {
    return null;
  }
  return request;
}

export interface HumanVerifiedUnverifiedRuntime {
  orderId: string;
  request: HumanVerifiedUnverifiedReleaseRequest;
  currentHash: string | null;
  currentArtifactHashes: ReadonlyMap<string, string | null>;
  currentAnchorBytesSha256: string | null;
  observedFence: number;
  observedInputVersion: number;
  activeContractHash: string | null;
}

export interface HumanVerifiedUnverifiedApplied {
  actionId: string;
  caseId: string;
  caseRevision: number;
  releasedMarker: string;
  postFence: number;
  observedInputVersion: number;
  deliveredUrlHash: string;
  assetId: string;
  qualityEvidenceDigest: string;
}

export type HumanVerifiedUnverifiedRefusalRule =
  | 'invalid_request'
  | 'marker_changed'
  | 'case_changed'
  | 'payment_fence_active'
  | 'payment_snapshot_changed'
  | 'exception_case_active'
  | 'asset_changed'
  | 'evidence_changed'
  | 'machine_hazard_present'
  | 'not_human_reviewable_unverified'
  | 'resemblance_not_proven'
  | 'provider_outcome_ambiguous'
  | 'gate2_still_held'
  | 'transition_lost';

export class HumanVerifiedUnverifiedAdmissibilityError extends Error {
  readonly code = 'human_verified_unverified_admissibility';

  constructor(
    public readonly rule: HumanVerifiedUnverifiedRefusalRule,
    detail?: string,
  ) {
    super(
      `[human-verified-unverified] refused: ${rule}${detail ? ` — ${detail}` : ''}`,
    );
    this.name = 'HumanVerifiedUnverifiedAdmissibilityError';
  }
}

/**
 * The human-unverified ceremony is intentionally deployable only on an explicitly enabled Preview. Keep this
 * guard in the service layer as well as the HTTP route: no alternate caller may spend Vision or commit a release
 * in local development or Production merely by constructing the internal request type.
 */
export function isHumanVerifiedUnverifiedReleaseEnvironmentEnabled(): boolean {
  return (
    process.env.VERCEL_ENV === 'preview' &&
    process.env.ALLOW_STAGING_QA === 'true' &&
    process.env.HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED === 'true' &&
    process.env.QA_SOFT_DELIVER !== 'true'
  );
}

export interface HumanVerificationOrderSnapshot {
  id: string;
  status: string;
  deliveryHoldReason: string | null;
  deliveryFenceVersion: number;
  inputVersion: number;
  manualReviewRequired: boolean;
  visualContractHash: string | null;
  visualPackageAuthority: Prisma.JsonValue | null;
  stripePaid: boolean;
  paymentProvider: string | null;
  paymentId: string | null;
  stripePaymentId: string | null;
  totalPrice: number;
}

export interface HumanVerificationCaseSnapshot {
  id: string;
  revision: number;
  kind: string;
  status: string;
  holdFingerprint: string;
  rawReason: string;
  inputVersion: number;
  contractHash: string | null;
}

export interface HumanVerificationTargetSnapshot {
  pageId: string;
  pageNumber: number;
  assetId: string;
  url: string;
  presentationUrl: string | null;
  safetyVerified: boolean;
  safetyHazards: string[];
  safetyContentSha256: string | null;
  safetyOverriddenHazards: string[];
  safetyOverrideSha256: string | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => {
    const aPage = /^page:([1-9][0-9]*)$/.exec(a);
    const bPage = /^page:([1-9][0-9]*)$/.exec(b);
    if (aPage && bPage) return Number(aPage[1]) - Number(bPage[1]);
    return a.localeCompare(b);
  });
}

function assertSha(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !SAFETY_SHA256_RE.test(value)) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'invalid_request',
      `${field} must be lowercase 64-hex`,
    );
  }
}

export function validateHumanVerifiedUnverifiedRequest(
  request: HumanVerifiedUnverifiedReleaseRequest,
): { pageNumber: number } {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.expectedMarker !== 'string' ||
    typeof request.artifactKey !== 'string'
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('invalid_request');
  }
  const marker = parseSinglePageSafetyUnverifiedMarker(
    request.expectedMarker,
  );
  if (
    marker == null ||
    request.artifactKey !== `page:${marker.pageNumber}` ||
    typeof request.expectedCaseId !== 'string' ||
    !request.expectedCaseId ||
    !Number.isInteger(request.expectedCaseRevision) ||
    request.expectedCaseRevision < 1 ||
    typeof request.expectedAssetId !== 'string' ||
    !request.expectedAssetId ||
    typeof request.reviewReason !== 'string' ||
    !request.reviewReason.trim() ||
    typeof request.actor !== 'string' ||
    !request.actor.trim() ||
    typeof request.idempotencyKey !== 'string' ||
    !request.idempotencyKey.trim() ||
    request.expectedEvaluatorVersion !== QUALITY_EVALUATOR_CONTRACT_VERSION
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('invalid_request');
  }
  assertSha(request.expectedCaseFingerprint, 'expectedCaseFingerprint');
  assertSha(request.inspectionDigest, 'inspectionDigest');
  assertSha(request.expectedAssetSha256, 'expectedAssetSha256');
  assertSha(request.expectedDeliveredUrlHash, 'expectedDeliveredUrlHash');
  assertSha(request.expectedAnchorEntryDigest, 'expectedAnchorEntryDigest');
  assertSha(request.expectedAnchorUrlHash, 'expectedAnchorUrlHash');
  assertSha(request.expectedAnchorBytesSha256, 'expectedAnchorBytesSha256');
  assertSha(request.snapshotDigest, 'snapshotDigest');
  assertSha(request.refundAuthorityDigest, 'refundAuthorityDigest');
  assertSha(request.paymentSnapshotDigest, 'paymentSnapshotDigest');
  assertSha(request.resemblanceProofDigest, 'resemblanceProofDigest');
  const strictProofs = parseHumanVerifiedUnverifiedResemblanceProofs(
    request.resemblanceProofs,
  );
  if (
    !strictProofs ||
    humanVerifiedUnverifiedResemblanceProofDigest(strictProofs) !==
      request.resemblanceProofDigest
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'invalid_request',
      'resemblanceProofs are malformed or do not match resemblanceProofDigest',
    );
  }
  if (
    request.expectedContractHash != null &&
    (typeof request.expectedContractHash !== 'string' ||
      !SAFETY_SHA256_RE.test(request.expectedContractHash))
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'invalid_request',
      'expectedContractHash is malformed',
    );
  }
  if (
    !Array.isArray(request.requiredResemblanceArtifacts) ||
    request.requiredResemblanceArtifacts.some(
      (key) => typeof key !== 'string',
    )
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'invalid_request',
      'requiredResemblanceArtifacts must be an array of page keys',
    );
  }
  const required = exactSorted(request.requiredResemblanceArtifacts);
  if (
    required.length !== request.requiredResemblanceArtifacts.length ||
    required.some((key, index) => key !== request.requiredResemblanceArtifacts[index]) ||
    required.some((key) => !/^page:[1-9][0-9]*$/.test(key)) ||
    !required.includes(request.artifactKey)
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'invalid_request',
      'requiredResemblanceArtifacts must be unique, sorted page keys including the target',
    );
  }
  if (
    strictProofs.length !== required.length ||
    strictProofs.some(
      (proof, index) => proof.artifactKey !== required[index],
    )
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'invalid_request',
      'resemblanceProofs must exactly cover requiredResemblanceArtifacts',
    );
  }
  return { pageNumber: marker.pageNumber };
}

export function humanVerifiedUnverifiedOperationKey(
  orderId: string,
  idempotencyKey: string,
): string {
  return `operator_action:human_verified_unverified_release:${orderId}:${idempotencyKey}`;
}

export function humanVerifiedUnverifiedRequestHash(
  orderId: string,
  request: HumanVerifiedUnverifiedReleaseRequest,
): string {
  return canonicalHash({
    version: HUMAN_VERIFIED_UNVERIFIED_VERSION,
    orderId,
    ...request,
    requiredResemblanceArtifacts: exactSorted(
      request.requiredResemblanceArtifacts,
    ),
  });
}

export function humanVerificationSnapshotDigest(args: {
  order: HumanVerificationOrderSnapshot;
  reviewCase: HumanVerificationCaseSnapshot;
  target: HumanVerificationTargetSnapshot;
  evidence: QualityEvidenceRow;
}): string {
  return canonicalHash({
    order: {
      id: args.order.id,
      status: args.order.status,
      marker: args.order.deliveryHoldReason,
      fence: args.order.deliveryFenceVersion,
      inputVersion: args.order.inputVersion,
      manualReviewRequired: args.order.manualReviewRequired,
      visualContractHash: args.order.visualContractHash,
      visualPackageAuthorityDigest: canonicalHash(
        args.order.visualPackageAuthority ?? null,
      ),
    },
    reviewCase: args.reviewCase,
    target: {
      ...args.target,
      deliveredUrlHash: deliveredUrlHash(
        args.target.presentationUrl ?? args.target.url,
      ),
    },
    evidence: {
      id: args.evidence.id ?? null,
      artifactKey: args.evidence.artifactKey,
      assetSha256: args.evidence.assetSha256,
      verdict: args.evidence.verdict,
      evaluatorContractVersion: args.evidence.evaluatorContractVersion,
      reason: args.evidence.reason,
      regenCount: args.evidence.regenCount,
      contractHash: args.evidence.contractHash,
      evaluatedAt: args.evidence.evaluatedAt?.toISOString() ?? null,
      evidenceDigest: canonicalHash(args.evidence.evidence ?? null),
      reviewStatus: args.evidence.reviewStatus ?? null,
      reviewedAssetSha256: args.evidence.reviewedAssetSha256 ?? null,
      reviewedContractHash: args.evidence.reviewedContractHash ?? null,
      reviewedBy: args.evidence.reviewedBy ?? null,
      reviewedAt: args.evidence.reviewedAt?.toISOString() ?? null,
      reviewReason: args.evidence.reviewReason ?? null,
      safetyOverride: args.evidence.safetyOverride,
      safetyOverrideSha256: args.evidence.safetyOverrideSha256,
    },
  });
}

export interface ResemblanceProofEntry {
  artifactKey: string;
  assetSha256: string;
  deliveredBytesSha256: string;
  referenceBytesSha256: string;
  evaluatorVersion: string;
  status: string;
  resemblanceScore: number;
  threshold: number;
  subjectVisible: boolean;
  sameChild: boolean;
  referenceImageUrlHash: string;
  source: string;
}

export function parsePassingResemblanceProof(
  row: Pick<QualityEvidenceRow, 'artifactKey' | 'assetSha256' | 'evidence'>,
): ResemblanceProofEntry | null {
  if (!record(row.evidence)) return null;
  const gate = row.evidence.pageResemblanceGate;
  if (!record(gate)) return null;
  const score = gate.resemblanceScore;
  const threshold = gate.threshold;
  const source = gate.source;
  if (
    gate.required !== true ||
    gate.status !== 'passed' ||
    gate.evaluatorVersion !== PAGE_CHILD_RESEMBLANCE_VISION_VERSION ||
    typeof score !== 'number' ||
    !Number.isFinite(score) ||
    typeof threshold !== 'number' ||
    !Number.isFinite(threshold) ||
    threshold < PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD ||
    threshold > 1 ||
    score > 1 ||
    score < threshold ||
    gate.subjectVisible !== true ||
    gate.sameChild !== true ||
    typeof gate.deliveredBytesSha256 !== 'string' ||
    gate.deliveredBytesSha256 !== row.assetSha256 ||
    !SAFETY_SHA256_RE.test(gate.deliveredBytesSha256) ||
    typeof gate.referenceBytesSha256 !== 'string' ||
    !SAFETY_SHA256_RE.test(gate.referenceBytesSha256) ||
    typeof gate.referenceImageUrl !== 'string' ||
    !gate.referenceImageUrl ||
    (source !== 'raw_same_bytes' && source !== 'delivered_bytes')
  ) return null;
  return {
    artifactKey: row.artifactKey,
    assetSha256: row.assetSha256,
    deliveredBytesSha256: gate.deliveredBytesSha256,
    referenceBytesSha256: gate.referenceBytesSha256,
    evaluatorVersion: gate.evaluatorVersion,
    status: gate.status,
    resemblanceScore: score,
    threshold,
    subjectVisible: true,
    sameChild: true,
    referenceImageUrlHash: canonicalHash(gate.referenceImageUrl),
    source,
  };
}

export function requiredResemblanceArtifactsFromRows(
  rows: Pick<QualityEvidenceRow, 'artifactKey' | 'evidence'>[],
): string[] {
  return exactSorted(
    rows.flatMap((row) => {
      if (!/^page:[1-9][0-9]*$/.test(row.artifactKey) || !record(row.evidence)) {
        return [];
      }
      const qaContext = row.evidence.qaContext;
      const gate = row.evidence.pageResemblanceGate;
      return (
        (record(qaContext) && qaContext.expectsChild === true) ||
        (record(gate) && gate.required === true)
      )
        ? [row.artifactKey]
        : [];
    }),
  );
}

export function resemblanceProofDigest(
  rows: Pick<QualityEvidenceRow, 'artifactKey' | 'assetSha256' | 'evidence'>[],
  requiredArtifacts: readonly string[],
  artifactBindings: ReadonlyMap<string, ResemblanceArtifactBinding>,
): string | null {
  const proofs = resemblanceProofsFromRows(
    rows,
    requiredArtifacts,
    artifactBindings,
  );
  return proofs
    ? humanVerifiedUnverifiedResemblanceProofDigest(proofs)
    : null;
}

export interface ResemblanceArtifactBinding {
  assetId: string;
  deliveredUrl: string;
}

export function resemblanceProofsFromRows(
  rows: Pick<QualityEvidenceRow, 'artifactKey' | 'assetSha256' | 'evidence'>[],
  requiredArtifacts: readonly string[],
  artifactBindings: ReadonlyMap<string, ResemblanceArtifactBinding>,
): HumanVerifiedUnverifiedResemblanceProof[] | null {
  const byKey = new Map(rows.map((row) => [row.artifactKey, row]));
  const proofs: HumanVerifiedUnverifiedResemblanceProof[] = [];
  for (const artifactKey of exactSorted(requiredArtifacts)) {
    const row = byKey.get(artifactKey);
    const binding = artifactBindings.get(artifactKey);
    const proof = row ? parsePassingResemblanceProof(row) : null;
    if (!proof || !binding?.assetId || !binding.deliveredUrl) return null;
    proofs.push({
      artifactKey: proof.artifactKey,
      assetId: binding.assetId,
      deliveredUrlHash: deliveredUrlHash(binding.deliveredUrl),
      deliveredBytesSha256: proof.deliveredBytesSha256,
      referenceBytesSha256: proof.referenceBytesSha256,
      referenceImageUrlHash: proof.referenceImageUrlHash,
      evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
      resemblanceScore: proof.resemblanceScore,
      threshold: proof.threshold,
      subjectVisible: true,
      sameChild: true,
      source: proof.source as 'raw_same_bytes' | 'delivered_bytes',
    });
  }
  if (proofs.length === 0) return null;
  const [firstProof] = proofs;
  if (
    proofs.some(
      (proof) =>
        proof.referenceImageUrlHash !== firstProof.referenceImageUrlHash ||
        proof.referenceBytesSha256 !== firstProof.referenceBytesSha256,
    )
  ) return null;
  return parseHumanVerifiedUnverifiedResemblanceProofs(proofs);
}

type QualityDbRow = {
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
  createdAt: Date;
  updatedAt: Date;
};

function qualityRowFromDb(row: QualityDbRow): QualityEvidenceRow {
  return row;
}

export function projectHumanVerificationOntoQuality(
  rows: QualityEvidenceRow[],
  request: HumanVerifiedUnverifiedReleaseRequest,
  orderId: string,
): QualityEvidenceRow[] {
  return rows.map((row) =>
    row.artifactKey === request.artifactKey
      ? {
          ...row,
          humanReviewVerified: true,
          humanReviewActionDigest: humanVerifiedUnverifiedRequestHash(
            orderId,
            request,
          ),
        }
      : row,
  );
}

async function lockAndLoadOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<HumanVerificationOrderSnapshot | null> {
  const rows = await tx.$queryRaw<HumanVerificationOrderSnapshot[]>`
    SELECT "id", "status", "deliveryHoldReason", "deliveryFenceVersion",
           "inputVersion", "manualReviewRequired", "visualContractHash",
           "visualPackageAuthority", "stripePaid", "paymentProvider",
           "paymentId", "stripePaymentId", "totalPrice"
      FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  return rows[0] ?? null;
}

export async function applyHumanVerifiedUnverifiedInTx(
  tx: Prisma.TransactionClient,
  runtime: HumanVerifiedUnverifiedRuntime,
  now: Date,
): Promise<HumanVerifiedUnverifiedApplied> {
  const request = runtime.request;
  const { pageNumber } = validateHumanVerifiedUnverifiedRequest(request);
  const order = await lockAndLoadOrder(tx, runtime.orderId);
  if (
    !order ||
    order.status !== 'needs_human_qa' ||
    order.deliveryHoldReason !== request.expectedMarker ||
    order.deliveryFenceVersion !== runtime.observedFence ||
    order.inputVersion !== runtime.observedInputVersion ||
    order.visualContractHash !== request.expectedContractHash
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('marker_changed');
  }

  const generationJob = await lockHumanVerificationGenerationJob(
    tx,
    runtime.orderId,
  );
  const currentAnchor = getApprovedChildCanonicalAnchor(
    (generationJob?.pipelineCache ?? {}) as PipelineCache,
  );
  if (
    !currentAnchor ||
    canonicalHash(currentAnchor) !== request.expectedAnchorEntryDigest ||
    canonicalHash(currentAnchor.url) !== request.expectedAnchorUrlHash ||
    runtime.currentAnchorBytesSha256 !== request.expectedAnchorBytesSha256 ||
    runtime.activeContractHash !== request.expectedContractHash
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'resemblance_not_proven',
      'approved canonical child anchor changed',
    );
  }

  const caseRows = await tx.$queryRaw<HumanVerificationCaseSnapshot[]>`
    SELECT "id", "revision", "kind", "status", "holdFingerprint",
           "rawReason", "inputVersion", "contractHash"
      FROM "HumanQaReviewCase"
     WHERE "activeKey" = ${`${runtime.orderId}:base_book`} FOR UPDATE`;
  const reviewCase = caseRows[0] ?? null;
  if (
    !reviewCase ||
    reviewCase.id !== request.expectedCaseId ||
    reviewCase.revision !== request.expectedCaseRevision ||
    reviewCase.kind !== 'safety' ||
    reviewCase.status !== 'open' ||
    reviewCase.holdFingerprint !== request.expectedCaseFingerprint ||
    reviewCase.rawReason !== request.expectedMarker ||
    reviewCase.inputVersion !== order.inputVersion ||
    reviewCase.contractHash !== order.visualContractHash
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('case_changed');
  }

  const paymentCase = await tx.humanQaReviewCase.findUnique({
    where: { activeKey: `${runtime.orderId}:payment` },
    select: { status: true },
  });
  if (order.manualReviewRequired || paymentCase?.status === 'open') {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'payment_fence_active',
    );
  }
  const payment = await tx.paymentRecord.findUnique({
    where: { orderId: runtime.orderId },
    select: {
      id: true,
      provider: true,
      amount: true,
      currency: true,
      paid: true,
      paidAt: true,
    },
  });
  const exceptionActivity = await tx.exceptionCase.findMany({
    where: { orderId: runtime.orderId },
    select: {
      id: true,
      kind: true,
      status: true,
      refundKey: true,
      providerActionId: true,
      actionAttemptedAt: true,
      notificationAttemptedAt: true,
      notificationMessageId: true,
      resolution: true,
      lastError: true,
    },
  });
  const refundKeys = exceptionActivity.flatMap((entry) =>
    entry.refundKey ? [entry.refundKey] : [],
  );
  const refundAttempts = refundKeys.length > 0
    ? await tx.refundAttempt.findMany({
        where: { refundKey: { in: refundKeys } },
        select: {
          refundKey: true,
          status: true,
          providerActionId: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : [];
  const currentRefundAuthorityDigest = refundAuthorityDigest({
    exceptionCases: exceptionActivity,
    refundAttempts,
  });
  if (
    hasDisqualifyingRefundOrReconciliationActivity({
      exceptionCases: exceptionActivity,
      refundAttempts,
    }) ||
    currentRefundAuthorityDigest !== request.refundAuthorityDigest
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'payment_snapshot_changed',
      'refund or reconciliation authority is active or changed',
    );
  }
  const currentPaymentDigest = paymentSnapshotDigest({
    order,
    payment,
    paymentCaseActive: false,
    refundAuthorityDigest: currentRefundAuthorityDigest,
  });
  if (
    !hasStrictHumanVerificationPaymentAuthority({ order, payment }) ||
    currentPaymentDigest !== request.paymentSnapshotDigest
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'payment_snapshot_changed',
    );
  }

  const activeException = await tx.exceptionCase.findUnique({
    where: { activeKey: `${runtime.orderId}:base_book` },
    select: { id: true },
  });
  if (activeException) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'exception_case_active',
    );
  }

  const page = await tx.bookPage.findFirst({
    where: { book: { orderId: runtime.orderId }, pageNumber },
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
  });
  const asset = page?.imageAsset;
  if (!page || !asset) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('asset_changed');
  }
  const target: HumanVerificationTargetSnapshot = {
    pageId: page.id,
    pageNumber: page.pageNumber,
    assetId: asset.id,
    url: asset.url,
    presentationUrl: asset.presentationUrl,
    safetyVerified: asset.safetyVerified,
    safetyHazards: asset.safetyHazards,
    safetyContentSha256: asset.safetyContentSha256,
    safetyOverriddenHazards: asset.safetyOverriddenHazards,
    safetyOverrideSha256: asset.safetyOverrideSha256,
  };
  const currentDeliveredUrlHash = deliveredUrlHash(
    target.presentationUrl ?? target.url,
  );
  if (
    target.assetId !== request.expectedAssetId ||
    target.safetyContentSha256 !== request.expectedAssetSha256 ||
    runtime.currentHash !== request.expectedAssetSha256 ||
    currentDeliveredUrlHash !== request.expectedDeliveredUrlHash
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('asset_changed');
  }
  if (
    target.safetyVerified === true ||
    target.safetyHazards.length !== 0 ||
    target.safetyOverriddenHazards.length !== 0 ||
    target.safetyOverrideSha256 !== null
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'machine_hazard_present',
    );
  }

  // Lock every evidence row for the Order, not only the target. The release digest covers every authoritative
  // child-present page; without row locks a concurrent re-QA of a sibling page could invalidate its proof after
  // this read but before the Order ships in the same transaction.
  const dbRows = await tx.$queryRaw<QualityDbRow[]>`
    SELECT "id", "artifactKey", "assetSha256", "verdict",
           "evaluatorContractVersion", "reason", "regenCount", "providerModel", "contractHash",
           "safetyOverride", "safetyOverrideSha256", "evidence", "evaluatedAt",
           "reviewStatus", "reviewedAssetSha256", "reviewedContractHash",
           "reviewedBy", "reviewedAt", "reviewReason", "createdAt", "updatedAt"
      FROM "QualityEvidence"
     WHERE "orderId" = ${runtime.orderId}
     ORDER BY "artifactKey"
     FOR UPDATE`;
  const qualityRows = dbRows.map(qualityRowFromDb);
  const targetEvidence = qualityRows.find(
    (row) => row.artifactKey === request.artifactKey,
  );
  if (
    !targetEvidence ||
    targetEvidence.assetSha256 !== request.expectedAssetSha256 ||
    targetEvidence.evaluatorContractVersion !== request.expectedEvaluatorVersion ||
    targetEvidence.contractHash !== request.expectedContractHash ||
    targetEvidence.verdict !== 'evidence_unknown' ||
    targetEvidence.safetyOverride !== false ||
    targetEvidence.safetyOverrideSha256 !== null ||
    targetEvidence.reviewStatus !== null ||
    targetEvidence.reviewedAssetSha256 !== null ||
    targetEvidence.reviewedContractHash !== null ||
    targetEvidence.reviewedBy !== null ||
    targetEvidence.reviewedAt !== null ||
    targetEvidence.reviewReason !== null
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('evidence_changed');
  }
  if (!isHumanReviewableUnverifiedReason(targetEvidence.reason)) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'not_human_reviewable_unverified',
    );
  }

  const requiredArtifacts = requiredResemblanceArtifactsFromRows(qualityRows);
  if (
    canonicalHash(requiredArtifacts) !==
      canonicalHash(request.requiredResemblanceArtifacts) ||
    !requiredArtifacts.includes(request.artifactKey)
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'resemblance_not_proven',
      'required artifact set changed',
    );
  }
  const requiredPageNumbers = requiredArtifacts.map((artifactKey) =>
    Number(artifactKey.slice('page:'.length)),
  );
  const requiredPages = await tx.bookPage.findMany({
    where: {
      book: { orderId: runtime.orderId },
      pageNumber: { in: requiredPageNumbers },
    },
    orderBy: { pageNumber: 'asc' },
    select: {
      pageNumber: true,
      imageAsset: {
        select: { id: true, url: true, presentationUrl: true },
      },
    },
  });
  const proofArtifactBindings = new Map<string, ResemblanceArtifactBinding>();
  for (const pageBinding of requiredPages) {
    const imageAsset = pageBinding.imageAsset;
    if (!imageAsset) continue;
    proofArtifactBindings.set(`page:${pageBinding.pageNumber}`, {
      assetId: imageAsset.id,
      deliveredUrl: imageAsset.presentationUrl ?? imageAsset.url,
    });
  }
  if (
    proofArtifactBindings.size !== requiredArtifacts.length ||
    requiredArtifacts.some((artifactKey) => {
      const proof = request.resemblanceProofs.find(
        (entry) => entry.artifactKey === artifactKey,
      );
      const binding = proofArtifactBindings.get(artifactKey);
      return (
        !proof ||
        !binding ||
        proof.assetId !== binding.assetId ||
        proof.deliveredUrlHash !== deliveredUrlHash(binding.deliveredUrl) ||
        proof.deliveredBytesSha256 !==
          runtime.currentArtifactHashes.get(artifactKey)
      );
    })
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'resemblance_not_proven',
      'a required page asset/URL/current-byte binding changed',
    );
  }
  const currentProofs = resemblanceProofsFromRows(
    qualityRows,
    requiredArtifacts,
    proofArtifactBindings,
  );
  const proofDigest = currentProofs
    ? humanVerifiedUnverifiedResemblanceProofDigest(currentProofs)
    : null;
  if (
    !proofDigest ||
    proofDigest !== request.resemblanceProofDigest ||
    canonicalHash(currentProofs) !== canonicalHash(request.resemblanceProofs)
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'resemblance_not_proven',
    );
  }

  const snapshotDigest = humanVerificationSnapshotDigest({
    order,
    reviewCase,
    target,
    evidence: targetEvidence,
  });
  if (snapshotDigest !== request.snapshotDigest) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('evidence_changed');
  }

  const projectedGate2 = evaluateSafetyDeliveryGate(
    projectHumanVerificationOntoGateInputs(
      await loadSafetyGateInputs(tx, runtime.orderId),
      { kind: 'page', pageNumber },
      { humanVerificationSha256: request.expectedAssetSha256 },
    ),
  );
  if (projectedGate2.held) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'gate2_still_held',
      projectedGate2.reason ?? undefined,
    );
  }

  const operationKey = humanVerifiedUnverifiedOperationKey(
    runtime.orderId,
    request.idempotencyKey,
  );
  const requestHash = humanVerifiedUnverifiedRequestHash(
    runtime.orderId,
    request,
  );
  const action = await tx.humanQaOperatorAction.findUnique({
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
    },
  });
  const preparedRequest = action
    ? parseHumanVerifiedUnverifiedPreparedOutcome(action.outcome)
    : null;
  if (
    !action ||
    !preparedRequest ||
    action.requestHash !== requestHash ||
    canonicalHash(preparedRequest) !== canonicalHash(request) ||
    action.orderId !== runtime.orderId ||
    action.caseId !== reviewCase.id ||
    action.caseRevision !== reviewCase.revision ||
    action.kind !== 'release' ||
    action.status !== 'pending' ||
    action.actor !== request.actor ||
    action.targetArtifacts.length !== 1 ||
    action.targetArtifacts[0] !== request.artifactKey ||
    action.observedMarker !== request.expectedMarker ||
    action.observedFence !== runtime.observedFence ||
    action.observedInputVersion !== runtime.observedInputVersion ||
    action.overriddenHazards.length !== 0 ||
    action.overrideReason !== request.reviewReason ||
    action.assetSha256 !== request.expectedAssetSha256
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'invalid_request',
      'the provider-spend claim is missing or does not bind this request',
    );
  }

  const reviewReason = serializeHumanVerifiedUnverifiedReviewReason({
    actionId: action.id,
    reason: request.reviewReason,
  });
  const evidenceUpdated = await tx.qualityEvidence.updateMany({
    where: {
      id: targetEvidence.id!,
      orderId: runtime.orderId,
      artifactKey: request.artifactKey,
      assetSha256: request.expectedAssetSha256,
      verdict: 'evidence_unknown',
      evaluatorContractVersion: request.expectedEvaluatorVersion,
      contractHash: request.expectedContractHash,
      safetyOverride: false,
      safetyOverrideSha256: null,
      reviewStatus: null,
      reviewedAssetSha256: null,
      reviewedContractHash: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: null,
    },
    data: {
      reviewStatus: HUMAN_VERIFIED_UNVERIFIED_REVIEW_STATUS,
      reviewedAssetSha256: request.expectedAssetSha256,
      reviewedContractHash: request.expectedContractHash,
      reviewedBy: request.actor,
      reviewedAt: now,
      reviewReason,
    },
  });
  if (evidenceUpdated.count !== 1) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('evidence_changed');
  }
  const reviewedEvidence = await tx.qualityEvidence.findUnique({
    where: {
      orderId_artifactKey: {
        orderId: runtime.orderId,
        artifactKey: request.artifactKey,
      },
    },
    select: {
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
      createdAt: true,
      updatedAt: true,
    },
  });
  if (
    !reviewedEvidence ||
    reviewedEvidence.reviewStatus !== HUMAN_VERIFIED_UNVERIFIED_REVIEW_STATUS ||
    reviewedEvidence.reviewedAssetSha256 !== request.expectedAssetSha256 ||
    reviewedEvidence.reviewedContractHash !== request.expectedContractHash ||
    reviewedEvidence.reviewedBy !== request.actor ||
    reviewedEvidence.reviewReason !== reviewReason
  ) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('evidence_changed');
  }
  const qualityEvidenceDigest =
    humanVerifiedUnverifiedQualityAuthorityDigest(reviewedEvidence);

  const releasedMarker = humanVerifiedUnverifiedMarker(request.expectedMarker);
  const moved = await executeHumanVerifiedUnverifiedReleaseTransition(tx, {
    orderId: runtime.orderId,
    expectedMarker: request.expectedMarker,
    observedFence: runtime.observedFence,
    expectedInputVersion: runtime.observedInputVersion,
    releasedMarker,
  });
  if (moved !== 1) {
    throw new HumanVerifiedUnverifiedAdmissibilityError('transition_lost');
  }

  await resolveHumanQaCaseOnReleaseInTx(tx, {
    orderId: runtime.orderId,
    scope: 'base_book',
    kinds: ['safety'],
    actor: request.actor,
    note: request.reviewReason,
  });

  return {
    actionId: action.id,
    caseId: reviewCase.id,
    caseRevision: reviewCase.revision,
    releasedMarker,
    postFence: runtime.observedFence + 1,
    observedInputVersion: runtime.observedInputVersion,
    deliveredUrlHash: currentDeliveredUrlHash,
    assetId: target.assetId,
    qualityEvidenceDigest,
  };
}

export async function finalizeHumanVerifiedUnverifiedInTx(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string;
    request: HumanVerifiedUnverifiedReleaseRequest;
    applied: HumanVerifiedUnverifiedApplied;
    result: HumanVerifiedUnverifiedCommitResult;
  },
): Promise<void> {
  const requestHash = humanVerifiedUnverifiedRequestHash(
    args.orderId,
    args.request,
  );
  const receiptOperationKey = humanVerifiedUnverifiedOperationKey(
    args.orderId,
    args.request.idempotencyKey,
  );
  const outcome: HumanVerifiedUnverifiedOutcome = {
    version: HUMAN_VERIFIED_UNVERIFIED_VERSION,
    decision: 'human_verified_safe',
    orderId: args.orderId,
    actionId: args.applied.actionId,
    requestHash,
    receiptOperationKey,
    caseId: args.applied.caseId,
    caseRevision: args.applied.caseRevision,
    caseFingerprint: args.request.expectedCaseFingerprint,
    artifactKey: args.request.artifactKey,
    assetId: args.applied.assetId,
    assetSha256: args.request.expectedAssetSha256,
    deliveredUrlHash: args.applied.deliveredUrlHash,
    contractHash: args.request.expectedContractHash,
    evaluatorVersion: args.request.expectedEvaluatorVersion,
    reviewer: args.request.actor,
    inspectionDigest: args.request.inspectionDigest,
    snapshotDigest: args.request.snapshotDigest,
    refundAuthorityDigest: args.request.refundAuthorityDigest,
    paymentSnapshotDigest: args.request.paymentSnapshotDigest,
    resemblanceProofDigest: args.request.resemblanceProofDigest,
    resemblanceProofs: args.request.resemblanceProofs,
    anchorEntryDigest: args.request.expectedAnchorEntryDigest,
    anchorUrlHash: args.request.expectedAnchorUrlHash,
    anchorBytesSha256: args.request.expectedAnchorBytesSha256,
    expectedMarker: args.request.expectedMarker,
    releasedMarker: args.applied.releasedMarker,
    observedFence: args.applied.postFence - 1,
    postFence: args.applied.postFence,
    observedInputVersion: args.applied.observedInputVersion,
    qualityEvidenceDigest: args.applied.qualityEvidenceDigest,
    result: args.result,
  };
  const updated = await tx.humanQaOperatorAction.updateMany({
    where: {
      id: args.applied.actionId,
      orderId: args.orderId,
      status: 'pending',
      requestHash,
    },
    data: {
      status: 'succeeded',
      outcome: outcome as unknown as Prisma.InputJsonValue,
    },
  });
  if (updated.count !== 1) {
    throw new HumanVerifiedUnverifiedAdmissibilityError(
      'evidence_changed',
      'operator action could not be finalized',
    );
  }
}

export function humanVerifiedUnverifiedReceiptValueFromOutcome(
  outcome: HumanVerifiedUnverifiedOutcome,
): HumanVerifiedUnverifiedReceiptValue {
  return {
    version: HUMAN_VERIFIED_UNVERIFIED_RECEIPT_VERSION,
    actionId: outcome.actionId,
    requestHash: outcome.requestHash,
    inspectionDigest: outcome.inspectionDigest,
    resemblanceProofDigest: outcome.resemblanceProofDigest,
    qualityEvidenceDigest: outcome.qualityEvidenceDigest,
    result: outcome.result,
  };
}
