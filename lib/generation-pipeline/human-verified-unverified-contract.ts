import { canonicalHash } from '@/lib/canonical-json';
import {
  PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
  PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
} from './page-child-resemblance-vision';

export const HUMAN_VERIFIED_UNVERIFIED_VERSION =
  'human_verified_unverified_release/v1' as const;
export const HUMAN_VERIFIED_UNVERIFIED_REVIEW_STATUS =
  HUMAN_VERIFIED_UNVERIFIED_VERSION;
export const HUMAN_VERIFIED_UNVERIFIED_RECEIPT_VERSION =
  'human_verified_unverified_receipt/v1' as const;

const SHA_RE = /^[0-9a-f]{64}$/;
const PAGE_KEY_RE = /^page:([1-9][0-9]*)$/;

export interface HumanVerifiedUnverifiedResemblanceProof {
  artifactKey: string;
  assetId: string;
  deliveredUrlHash: string;
  deliveredBytesSha256: string;
  referenceBytesSha256: string;
  referenceImageUrlHash: string;
  evaluatorVersion: typeof PAGE_CHILD_RESEMBLANCE_VISION_VERSION;
  resemblanceScore: number;
  threshold: number;
  subjectVisible: true;
  sameChild: true;
  source: 'raw_same_bytes' | 'delivered_bytes';
}

export interface HumanVerifiedUnverifiedCommitResult {
  manifestStatus: 'passed';
  enqueued: true;
  orderStatus: 'ready';
  reason: null;
  revision: number;
}

export interface HumanVerifiedUnverifiedOutcome {
  version: typeof HUMAN_VERIFIED_UNVERIFIED_VERSION;
  decision: 'human_verified_safe';
  orderId: string;
  actionId: string;
  requestHash: string;
  receiptOperationKey: string;
  caseId: string;
  caseRevision: number;
  caseFingerprint: string;
  artifactKey: string;
  assetId: string;
  assetSha256: string;
  deliveredUrlHash: string;
  contractHash: string | null;
  evaluatorVersion: string;
  reviewer: string;
  inspectionDigest: string;
  snapshotDigest: string;
  refundAuthorityDigest: string;
  paymentSnapshotDigest: string;
  resemblanceProofDigest: string;
  resemblanceProofs: HumanVerifiedUnverifiedResemblanceProof[];
  anchorEntryDigest: string;
  anchorUrlHash: string;
  anchorBytesSha256: string;
  expectedMarker: string;
  releasedMarker: string;
  observedFence: number;
  postFence: number;
  observedInputVersion: number;
  qualityEvidenceDigest: string;
  result: HumanVerifiedUnverifiedCommitResult;
}

/** The value stored under AtomicOperationReceipt.result.value for this ceremony. */
export interface HumanVerifiedUnverifiedReceiptValue {
  version: typeof HUMAN_VERIFIED_UNVERIFIED_RECEIPT_VERSION;
  actionId: string;
  requestHash: string;
  inspectionDigest: string;
  resemblanceProofDigest: string;
  qualityEvidenceDigest: string;
  result: HumanVerifiedUnverifiedCommitResult;
}

export interface HumanVerifiedUnverifiedReviewReason {
  version: typeof HUMAN_VERIFIED_UNVERIFIED_VERSION;
  actionId: string;
  reason: string;
}

export interface HumanVerifiedUnverifiedQualityAuthority {
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
  evidence: unknown;
  evaluatedAt: Date | string;
  reviewStatus: string | null;
  reviewedAssetSha256: string | null;
  reviewedContractHash: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | string | null;
  reviewReason: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function exactPageSort(values: readonly string[]): string[] {
  return [...values].sort((a, b) => {
    const aPage = PAGE_KEY_RE.exec(a);
    const bPage = PAGE_KEY_RE.exec(b);
    if (aPage && bPage) return Number(aPage[1]) - Number(bPage[1]);
    return a.localeCompare(b);
  });
}

function iso(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function humanVerifiedUnverifiedQualityAuthorityDigest(
  row: HumanVerifiedUnverifiedQualityAuthority,
): string {
  return canonicalHash({
    id: row.id,
    artifactKey: row.artifactKey,
    assetSha256: row.assetSha256,
    verdict: row.verdict,
    evaluatorContractVersion: row.evaluatorContractVersion,
    reason: row.reason,
    regenCount: row.regenCount,
    providerModel: row.providerModel,
    contractHash: row.contractHash,
    safetyOverride: row.safetyOverride,
    safetyOverrideSha256: row.safetyOverrideSha256,
    evidence: row.evidence,
    evaluatedAt: iso(row.evaluatedAt),
    reviewStatus: row.reviewStatus,
    reviewedAssetSha256: row.reviewedAssetSha256,
    reviewedContractHash: row.reviewedContractHash,
    reviewedBy: row.reviewedBy,
    reviewedAt: iso(row.reviewedAt),
    reviewReason: row.reviewReason,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  });
}

export function parseHumanVerifiedUnverifiedResemblanceProofs(
  value: unknown,
): HumanVerifiedUnverifiedResemblanceProof[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const proofs: HumanVerifiedUnverifiedResemblanceProof[] = [];
  for (const item of value) {
    if (!record(item) || !exactKeys(item, [
      'artifactKey', 'assetId', 'deliveredUrlHash', 'deliveredBytesSha256', 'referenceBytesSha256',
      'referenceImageUrlHash', 'evaluatorVersion', 'resemblanceScore',
      'threshold', 'subjectVisible', 'sameChild', 'source',
    ])) return null;
    if (
      typeof item.artifactKey !== 'string' || !PAGE_KEY_RE.test(item.artifactKey) ||
      typeof item.assetId !== 'string' || !item.assetId ||
      typeof item.deliveredUrlHash !== 'string' || !SHA_RE.test(item.deliveredUrlHash) ||
      typeof item.deliveredBytesSha256 !== 'string' || !SHA_RE.test(item.deliveredBytesSha256) ||
      typeof item.referenceBytesSha256 !== 'string' || !SHA_RE.test(item.referenceBytesSha256) ||
      typeof item.referenceImageUrlHash !== 'string' || !SHA_RE.test(item.referenceImageUrlHash) ||
      item.evaluatorVersion !== PAGE_CHILD_RESEMBLANCE_VISION_VERSION ||
      typeof item.resemblanceScore !== 'number' || !Number.isFinite(item.resemblanceScore) ||
      item.resemblanceScore < 0 || item.resemblanceScore > 1 ||
      typeof item.threshold !== 'number' || !Number.isFinite(item.threshold) ||
      item.threshold < PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD || item.threshold > 1 ||
      item.resemblanceScore < item.threshold ||
      item.subjectVisible !== true || item.sameChild !== true ||
      (item.source !== 'raw_same_bytes' && item.source !== 'delivered_bytes')
    ) return null;
    proofs.push(item as unknown as HumanVerifiedUnverifiedResemblanceProof);
  }
  const keys = proofs.map((proof) => proof.artifactKey);
  const sorted = exactPageSort(keys);
  if (
    new Set(keys).size !== keys.length ||
    keys.some((key, index) => key !== sorted[index])
  ) return null;
  const [first] = proofs;
  if (proofs.some((proof) =>
    proof.referenceBytesSha256 !== first.referenceBytesSha256 ||
    proof.referenceImageUrlHash !== first.referenceImageUrlHash
  )) return null;
  return proofs;
}

export function humanVerifiedUnverifiedResemblanceProofDigest(
  proofs: readonly HumanVerifiedUnverifiedResemblanceProof[],
): string {
  return canonicalHash({
    version: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
    minThreshold: PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
    proofs,
  });
}

export function parseHumanVerifiedUnverifiedCommitResult(
  value: unknown,
): HumanVerifiedUnverifiedCommitResult | null {
  if (!record(value) || !exactKeys(value, [
    'manifestStatus', 'enqueued', 'orderStatus', 'reason', 'revision',
  ])) return null;
  if (
    value.manifestStatus !== 'passed' || value.enqueued !== true ||
    value.orderStatus !== 'ready' || value.reason !== null ||
    typeof value.revision !== 'number' || !Number.isInteger(value.revision) || value.revision < 1
  ) return null;
  return value as unknown as HumanVerifiedUnverifiedCommitResult;
}

export function parseHumanVerifiedUnverifiedReceiptValue(
  value: unknown,
): HumanVerifiedUnverifiedReceiptValue | null {
  if (!record(value) || !exactKeys(value, [
    'version', 'actionId', 'requestHash', 'inspectionDigest',
    'resemblanceProofDigest', 'qualityEvidenceDigest', 'result',
  ])) return null;
  if (
    value.version !== HUMAN_VERIFIED_UNVERIFIED_RECEIPT_VERSION ||
    typeof value.actionId !== 'string' || !value.actionId ||
    typeof value.requestHash !== 'string' || !SHA_RE.test(value.requestHash) ||
    typeof value.inspectionDigest !== 'string' || !SHA_RE.test(value.inspectionDigest) ||
    typeof value.resemblanceProofDigest !== 'string' || !SHA_RE.test(value.resemblanceProofDigest) ||
    typeof value.qualityEvidenceDigest !== 'string' || !SHA_RE.test(value.qualityEvidenceDigest)
  ) return null;
  const result = parseHumanVerifiedUnverifiedCommitResult(value.result);
  if (!result) return null;
  return { ...value, result } as HumanVerifiedUnverifiedReceiptValue;
}

export function parseHumanVerifiedUnverifiedAtomicReceiptResult(
  value: unknown,
): HumanVerifiedUnverifiedReceiptValue | null {
  if (!record(value) || !exactKeys(value, ['value'])) return null;
  return parseHumanVerifiedUnverifiedReceiptValue(value.value);
}

export function parseHumanVerifiedUnverifiedOutcome(
  value: unknown,
): HumanVerifiedUnverifiedOutcome | null {
  if (!record(value) || !exactKeys(value, [
    'version', 'decision', 'orderId', 'actionId', 'requestHash', 'receiptOperationKey',
    'caseId', 'caseRevision', 'caseFingerprint', 'artifactKey', 'assetId',
    'assetSha256', 'deliveredUrlHash', 'contractHash', 'evaluatorVersion',
    'reviewer', 'inspectionDigest', 'snapshotDigest', 'refundAuthorityDigest', 'paymentSnapshotDigest',
    'resemblanceProofDigest', 'resemblanceProofs', 'anchorEntryDigest',
    'anchorUrlHash', 'anchorBytesSha256', 'expectedMarker', 'releasedMarker',
    'observedFence', 'postFence', 'observedInputVersion', 'qualityEvidenceDigest',
    'result',
  ])) return null;
  const marker = typeof value.expectedMarker === 'string'
    ? /^safety_hold:unverified:page:([1-9][0-9]*)$/.exec(value.expectedMarker)
    : null;
  const proofs = parseHumanVerifiedUnverifiedResemblanceProofs(value.resemblanceProofs);
  const result = parseHumanVerifiedUnverifiedCommitResult(value.result);
  if (
    value.version !== HUMAN_VERIFIED_UNVERIFIED_VERSION ||
    value.decision !== 'human_verified_safe' ||
    typeof value.orderId !== 'string' || !value.orderId ||
    typeof value.actionId !== 'string' || !value.actionId ||
    typeof value.requestHash !== 'string' || !SHA_RE.test(value.requestHash) ||
    typeof value.receiptOperationKey !== 'string' || !value.receiptOperationKey ||
    typeof value.caseId !== 'string' || !value.caseId ||
    typeof value.caseRevision !== 'number' || !Number.isInteger(value.caseRevision) || value.caseRevision < 1 ||
    typeof value.caseFingerprint !== 'string' || !SHA_RE.test(value.caseFingerprint) ||
    typeof value.artifactKey !== 'string' || !marker || value.artifactKey !== `page:${marker[1]}` ||
    typeof value.assetId !== 'string' || !value.assetId ||
    typeof value.assetSha256 !== 'string' || !SHA_RE.test(value.assetSha256) ||
    typeof value.deliveredUrlHash !== 'string' || !SHA_RE.test(value.deliveredUrlHash) ||
    !(value.contractHash === null || (typeof value.contractHash === 'string' && SHA_RE.test(value.contractHash))) ||
    typeof value.evaluatorVersion !== 'string' || !value.evaluatorVersion ||
    typeof value.reviewer !== 'string' || !value.reviewer ||
    typeof value.inspectionDigest !== 'string' || !SHA_RE.test(value.inspectionDigest) ||
    typeof value.snapshotDigest !== 'string' || !SHA_RE.test(value.snapshotDigest) ||
    typeof value.refundAuthorityDigest !== 'string' || !SHA_RE.test(value.refundAuthorityDigest) ||
    typeof value.paymentSnapshotDigest !== 'string' || !SHA_RE.test(value.paymentSnapshotDigest) ||
    typeof value.resemblanceProofDigest !== 'string' || !SHA_RE.test(value.resemblanceProofDigest) ||
    !proofs || !proofs.some((proof) => proof.artifactKey === value.artifactKey) ||
    humanVerifiedUnverifiedResemblanceProofDigest(proofs) !== value.resemblanceProofDigest ||
    typeof value.anchorEntryDigest !== 'string' || !SHA_RE.test(value.anchorEntryDigest) ||
    typeof value.anchorUrlHash !== 'string' || !SHA_RE.test(value.anchorUrlHash) ||
    typeof value.anchorBytesSha256 !== 'string' || !SHA_RE.test(value.anchorBytesSha256) ||
    value.releasedMarker !== `qa_human_verified:safety:unverified:page:${marker[1]}` ||
    typeof value.observedFence !== 'number' || !Number.isInteger(value.observedFence) || value.observedFence < 0 ||
    typeof value.postFence !== 'number' || !Number.isInteger(value.postFence) || value.postFence !== value.observedFence + 1 ||
    typeof value.observedInputVersion !== 'number' || !Number.isInteger(value.observedInputVersion) || value.observedInputVersion < 0 ||
    typeof value.qualityEvidenceDigest !== 'string' || !SHA_RE.test(value.qualityEvidenceDigest) ||
    !result
  ) return null;
  return { ...value, resemblanceProofs: proofs, result } as HumanVerifiedUnverifiedOutcome;
}

export function parseHumanVerifiedUnverifiedReviewReason(
  value: string | null | undefined,
): HumanVerifiedUnverifiedReviewReason | null {
  if (!value) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(value);
  } catch {
    return null;
  }
  if (!record(decoded) || !exactKeys(decoded, ['version', 'actionId', 'reason'])) return null;
  if (
    decoded.version !== HUMAN_VERIFIED_UNVERIFIED_VERSION ||
    typeof decoded.actionId !== 'string' || !decoded.actionId ||
    typeof decoded.reason !== 'string' || !decoded.reason.trim()
  ) return null;
  return decoded as unknown as HumanVerifiedUnverifiedReviewReason;
}

export function serializeHumanVerifiedUnverifiedReviewReason(args: {
  actionId: string;
  reason: string;
}): string {
  return JSON.stringify({
    version: HUMAN_VERIFIED_UNVERIFIED_VERSION,
    actionId: args.actionId,
    reason: args.reason,
  });
}
