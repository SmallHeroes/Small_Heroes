import fs from 'node:fs';
import path from 'node:path';

import type { BookVisualContract } from '@/lib/visual-contract-compiler/types';
import {
  SET_IDENTITY_BOARD_VERSION,
  SET_IDENTITY_REGISTRY_VERSION,
  type SetIdentityBoardRegistryEntry,
} from '@/lib/set-identity-board/types';
import {
  computeSetBoardContentPolicyDigest,
  computeSetDefinitionHash,
  projectSetDefinition,
} from '@/lib/set-identity-board/setDefinition';
import {
  validateSetIdentityBoardRegistryEntry,
  validateSetIdentityBoardRegistryIdentity,
  type ExpectedRegistryIdentity,
} from '@/lib/set-identity-board/registry';
import {
  setIdentityBoardRegistryPath,
} from '@/lib/set-identity-board/registryPath';

import {
  canonicalContentAddressedJsonBytes,
  writeCanonicalContentAddressedJsonArtifact,
} from './canonicalContentAddressedJson';
import {
  canonicalJsonDigest,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import { writeImmutableLocalArtifact } from './preRenderBlueprintLifecycle';
import { loadApprovedTimeAuthorityMigration } from './timeAuthorityMigrationLifecycle';

export const TIME_AUTHORITY_SET_BOARD_REBIND_CANDIDATE_VERSION =
  'time-authority-set-board-rebind-candidate/v1' as const;
export const TIME_AUTHORITY_SET_BOARD_REBIND_REVIEW_VERSION =
  'time-authority-set-board-rebind-review/v1' as const;
export const TIME_AUTHORITY_SET_BOARD_REBIND_APPROVAL_VERSION =
  'time-authority-set-board-rebind-approval/v1' as const;

export const TIME_AUTHORITY_SET_BOARD_REBIND_DOES_NOT_AUTHORIZE = [
  'visual_package_approval',
  'wizard_qualification',
  'wizard_render',
  'provider_call',
  'image_render',
  'publication',
  'locator_update',
  'production_activation',
  'deployment',
  'release',
] as const;

const SHA256_HEX = /^[a-f0-9]{64}$/;
const REGISTRY_ENTRY_KEYS = [
  'registryVersion',
  'boardVersion',
  'storyKey',
  'setIdentityId',
  'styleId',
  'setDefinitionHash',
  'contentPolicyDigest',
  'declaredPropIds',
  'storageKey',
  'assetSha256',
  'promptHash',
  'model',
  'quality',
  'qaStatus',
  'qaCheckedAt',
  'approvedBy',
  'approvedAt',
] as const;

type RebindBoundary =
  typeof TIME_AUTHORITY_SET_BOARD_REBIND_DOES_NOT_AUTHORIZE;

export interface TimeAuthoritySetBoardRebindCandidate {
  version: typeof TIME_AUTHORITY_SET_BOARD_REBIND_CANDIDATE_VERSION;
  migrationManifestDigest: string;
  sourcePackageCandidateDigest: string;
  sourceBoardArtifactPath: string;
  sourceBoardArtifactDigest: string;
  targetRegistryPath: string;
  storyKey: string;
  setIdentityId: string;
  styleId: string;
  sourceSetDefinitionHash: string;
  targetSetDefinitionHash: string;
  sourceRegistryEntry: SetIdentityBoardRegistryEntry;
  proposedRegistryEntry: SetIdentityBoardRegistryEntry;
  changedFields: readonly [
    '/setDefinitionHash',
    '/approvedBy',
    '/approvedAt',
  ];
  doesNotAuthorize: RebindBoundary;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface TimeAuthoritySetBoardRebindReview {
  version: typeof TIME_AUTHORITY_SET_BOARD_REBIND_REVIEW_VERSION;
  candidateDigest: string;
  migrationManifestDigest: string;
  sourcePackageCandidateDigest: string;
  storyKey: string;
  setIdentityId: string;
  styleId: string;
  sourceSetDefinitionHash: string;
  targetSetDefinitionHash: string;
  preservedStorageKey: string;
  preservedAssetSha256: string;
  preservedPromptHash: string;
  sourceQaStatus: 'passed';
  sourceApprovedBy: 'Guy';
  sourceApprovedAt: string;
  blockers: readonly [];
  readyForApproval: true;
  doesNotAuthorize: RebindBoundary;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface TimeAuthoritySetBoardRebindApproval {
  version: typeof TIME_AUTHORITY_SET_BOARD_REBIND_APPROVAL_VERSION;
  candidateDigest: string;
  reviewDigest: string;
  migrationManifestDigest: string;
  targetRegistryPath: string;
  targetRegistryEntryDigest: string;
  approvedBy: 'Guy';
  approvedAt: string;
  authorityScope: 'time_authority_set_board_identity_rebind_only';
  doesNotAuthorize: RebindBoundary;
  note?: string;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface PrepareTimeAuthoritySetBoardRebindArgs {
  repoRoot: string;
  approvedManifestPath: string;
  outputRoot: string;
  setIdentityId: string;
  targetBoardRegistryDir?: string;
  write?: boolean;
}

export interface ApproveTimeAuthoritySetBoardRebindArgs
  extends PrepareTimeAuthoritySetBoardRebindArgs {
  candidatePath: string;
  reviewPath: string;
  approvedBy: 'Guy';
  approvedAt: string;
  note?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

function sha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX.test(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalRelativePath(value: unknown): value is string {
  if (!nonEmpty(value) || value.includes('\\')) return false;
  if (path.posix.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value);
  return normalized === value &&
    normalized !== '.' &&
    !normalized.startsWith('../') &&
    !normalized.includes('/../');
}

function canonicalUtcTimestampIsValid(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function exactBoundary(value: unknown): value is RebindBoundary {
  return Array.isArray(value) &&
    canonicalJsonDigest(value) ===
      canonicalJsonDigest(TIME_AUTHORITY_SET_BOARD_REBIND_DOES_NOT_AUTHORIZE);
}

function registryEntryShapeIsExact(
  value: unknown,
): value is SetIdentityBoardRegistryEntry {
  return isRecord(value) && exactKeys(value, REGISTRY_ENTRY_KEYS);
}

function candidatePayload(
  candidate: TimeAuthoritySetBoardRebindCandidate,
): Omit<TimeAuthoritySetBoardRebindCandidate, 'digestAlgorithm' | 'digest'> {
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = candidate;
  return payload;
}

function reviewPayload(
  review: TimeAuthoritySetBoardRebindReview,
): Omit<TimeAuthoritySetBoardRebindReview, 'digestAlgorithm' | 'digest'> {
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = review;
  return payload;
}

function approvalPayload(
  approval: TimeAuthoritySetBoardRebindApproval,
): Omit<TimeAuthoritySetBoardRebindApproval, 'digestAlgorithm' | 'digest'> {
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = approval;
  return payload;
}

function preservedRegistryFieldsMatch(
  source: SetIdentityBoardRegistryEntry,
  target: SetIdentityBoardRegistryEntry,
): boolean {
  return source.registryVersion === target.registryVersion &&
    source.boardVersion === target.boardVersion &&
    source.storyKey === target.storyKey &&
    source.setIdentityId === target.setIdentityId &&
    source.styleId === target.styleId &&
    source.contentPolicyDigest === target.contentPolicyDigest &&
    canonicalJsonDigest(source.declaredPropIds) ===
      canonicalJsonDigest(target.declaredPropIds) &&
    source.storageKey === target.storageKey &&
    source.assetSha256 === target.assetSha256 &&
    source.promptHash === target.promptHash &&
    source.model === target.model &&
    source.quality === target.quality &&
    source.qaStatus === target.qaStatus &&
    source.qaCheckedAt === target.qaCheckedAt;
}

export function timeAuthoritySetBoardRebindCandidateIsValid(
  value: unknown,
): value is TimeAuthoritySetBoardRebindCandidate {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'version',
      'migrationManifestDigest',
      'sourcePackageCandidateDigest',
      'sourceBoardArtifactPath',
      'sourceBoardArtifactDigest',
      'targetRegistryPath',
      'storyKey',
      'setIdentityId',
      'styleId',
      'sourceSetDefinitionHash',
      'targetSetDefinitionHash',
      'sourceRegistryEntry',
      'proposedRegistryEntry',
      'changedFields',
      'doesNotAuthorize',
      'digestAlgorithm',
      'digest',
    ]) ||
    value.version !== TIME_AUTHORITY_SET_BOARD_REBIND_CANDIDATE_VERSION ||
    !sha256(value.migrationManifestDigest) ||
    !sha256(value.sourcePackageCandidateDigest) ||
    !canonicalRelativePath(value.sourceBoardArtifactPath) ||
    !sha256(value.sourceBoardArtifactDigest) ||
    !canonicalRelativePath(value.targetRegistryPath) ||
    !nonEmpty(value.storyKey) ||
    !nonEmpty(value.setIdentityId) ||
    !nonEmpty(value.styleId) ||
    !sha256(value.sourceSetDefinitionHash) ||
    !sha256(value.targetSetDefinitionHash) ||
    value.sourceSetDefinitionHash === value.targetSetDefinitionHash ||
    !registryEntryShapeIsExact(value.sourceRegistryEntry) ||
    !registryEntryShapeIsExact(value.proposedRegistryEntry) ||
    canonicalJsonDigest(value.changedFields) !==
      canonicalJsonDigest([
        '/setDefinitionHash',
        '/approvedBy',
        '/approvedAt',
      ]) ||
    !exactBoundary(value.doesNotAuthorize) ||
    value.digestAlgorithm !== 'canonical-json-sha256' ||
    !sha256(value.digest)
  ) {
    return false;
  }
  const candidate = value as unknown as TimeAuthoritySetBoardRebindCandidate;
  const sourceExpected: ExpectedRegistryIdentity = {
    registryVersion: candidate.sourceRegistryEntry.registryVersion,
    boardVersion: candidate.sourceRegistryEntry.boardVersion,
    storyKey: candidate.storyKey,
    setIdentityId: candidate.setIdentityId,
    styleId: candidate.styleId,
    setDefinitionHash: candidate.sourceSetDefinitionHash,
    contentPolicyDigest: candidate.sourceRegistryEntry.contentPolicyDigest,
    declaredPropIds: [...candidate.sourceRegistryEntry.declaredPropIds],
  };
  const targetExpected: ExpectedRegistryIdentity = {
    registryVersion: candidate.proposedRegistryEntry.registryVersion,
    boardVersion: candidate.proposedRegistryEntry.boardVersion,
    storyKey: candidate.storyKey,
    setIdentityId: candidate.setIdentityId,
    styleId: candidate.styleId,
    setDefinitionHash: candidate.targetSetDefinitionHash,
    contentPolicyDigest: candidate.proposedRegistryEntry.contentPolicyDigest,
    declaredPropIds: [...candidate.proposedRegistryEntry.declaredPropIds],
  };
  if (
    candidate.sourceRegistryEntry.storyKey !== candidate.storyKey ||
    candidate.proposedRegistryEntry.storyKey !== candidate.storyKey ||
    candidate.sourceRegistryEntry.setIdentityId !== candidate.setIdentityId ||
    candidate.proposedRegistryEntry.setIdentityId !== candidate.setIdentityId ||
    candidate.sourceRegistryEntry.styleId !== candidate.styleId ||
    candidate.proposedRegistryEntry.styleId !== candidate.styleId ||
    candidate.sourceRegistryEntry.setDefinitionHash !==
      candidate.sourceSetDefinitionHash ||
    candidate.proposedRegistryEntry.setDefinitionHash !==
      candidate.targetSetDefinitionHash ||
    candidate.sourceRegistryEntry.qaStatus !== 'passed' ||
    candidate.sourceRegistryEntry.approvedBy !== 'Guy' ||
    !nonEmpty(candidate.sourceRegistryEntry.approvedAt) ||
    !validateSetIdentityBoardRegistryEntry(
      candidate.sourceRegistryEntry,
      sourceExpected,
    ).ok ||
    candidate.proposedRegistryEntry.qaStatus !== 'passed' ||
    candidate.proposedRegistryEntry.approvedBy !== null ||
    candidate.proposedRegistryEntry.approvedAt !== null ||
    !validateSetIdentityBoardRegistryIdentity(
      candidate.proposedRegistryEntry,
      targetExpected,
    ).ok ||
    !preservedRegistryFieldsMatch(
      candidate.sourceRegistryEntry,
      candidate.proposedRegistryEntry,
    ) ||
    candidate.sourceBoardArtifactDigest !==
      canonicalJsonDigest(candidate.sourceRegistryEntry) ||
    path.posix.basename(candidate.sourceBoardArtifactPath) !==
      `${candidate.sourceSetDefinitionHash}.json` ||
    path.posix.basename(candidate.targetRegistryPath) !==
      `${candidate.targetSetDefinitionHash}.json` ||
    candidate.digest !== canonicalJsonDigest(candidatePayload(candidate))
  ) {
    return false;
  }
  return true;
}

export function timeAuthoritySetBoardRebindReviewIsValid(
  value: unknown,
  candidate: TimeAuthoritySetBoardRebindCandidate,
): value is TimeAuthoritySetBoardRebindReview {
  if (
    !timeAuthoritySetBoardRebindCandidateIsValid(candidate) ||
    !isRecord(value) ||
    !exactKeys(value, [
      'version',
      'candidateDigest',
      'migrationManifestDigest',
      'sourcePackageCandidateDigest',
      'storyKey',
      'setIdentityId',
      'styleId',
      'sourceSetDefinitionHash',
      'targetSetDefinitionHash',
      'preservedStorageKey',
      'preservedAssetSha256',
      'preservedPromptHash',
      'sourceQaStatus',
      'sourceApprovedBy',
      'sourceApprovedAt',
      'blockers',
      'readyForApproval',
      'doesNotAuthorize',
      'digestAlgorithm',
      'digest',
    ]) ||
    value.version !== TIME_AUTHORITY_SET_BOARD_REBIND_REVIEW_VERSION ||
    value.candidateDigest !== candidate.digest ||
    value.migrationManifestDigest !== candidate.migrationManifestDigest ||
    value.sourcePackageCandidateDigest !==
      candidate.sourcePackageCandidateDigest ||
    value.storyKey !== candidate.storyKey ||
    value.setIdentityId !== candidate.setIdentityId ||
    value.styleId !== candidate.styleId ||
    value.sourceSetDefinitionHash !== candidate.sourceSetDefinitionHash ||
    value.targetSetDefinitionHash !== candidate.targetSetDefinitionHash ||
    value.preservedStorageKey !== candidate.sourceRegistryEntry.storageKey ||
    value.preservedAssetSha256 !== candidate.sourceRegistryEntry.assetSha256 ||
    value.preservedPromptHash !== candidate.sourceRegistryEntry.promptHash ||
    value.sourceQaStatus !== 'passed' ||
    value.sourceApprovedBy !== 'Guy' ||
    value.sourceApprovedAt !== candidate.sourceRegistryEntry.approvedAt ||
    !Array.isArray(value.blockers) ||
    value.blockers.length !== 0 ||
    value.readyForApproval !== true ||
    !exactBoundary(value.doesNotAuthorize) ||
    value.digestAlgorithm !== 'canonical-json-sha256' ||
    !sha256(value.digest)
  ) {
    return false;
  }
  const review = value as unknown as TimeAuthoritySetBoardRebindReview;
  return review.digest === canonicalJsonDigest(reviewPayload(review));
}

export function timeAuthoritySetBoardRebindApprovalIsValid(args: {
  value: unknown;
  candidate: TimeAuthoritySetBoardRebindCandidate;
  review: TimeAuthoritySetBoardRebindReview;
  targetRegistryEntry: SetIdentityBoardRegistryEntry;
}): args is {
  value: TimeAuthoritySetBoardRebindApproval;
  candidate: TimeAuthoritySetBoardRebindCandidate;
  review: TimeAuthoritySetBoardRebindReview;
  targetRegistryEntry: SetIdentityBoardRegistryEntry;
} {
  if (
    !timeAuthoritySetBoardRebindReviewIsValid(args.review, args.candidate) ||
    !isRecord(args.value)
  ) {
    return false;
  }
  const expectedKeys = [
    'version',
    'candidateDigest',
    'reviewDigest',
    'migrationManifestDigest',
    'targetRegistryPath',
    'targetRegistryEntryDigest',
    'approvedBy',
    'approvedAt',
    'authorityScope',
    'doesNotAuthorize',
    ...(Object.prototype.hasOwnProperty.call(args.value, 'note') ? ['note'] : []),
    'digestAlgorithm',
    'digest',
  ];
  if (
    !exactKeys(args.value, expectedKeys) ||
    args.value.version !== TIME_AUTHORITY_SET_BOARD_REBIND_APPROVAL_VERSION ||
    args.value.candidateDigest !== args.candidate.digest ||
    args.value.reviewDigest !== args.review.digest ||
    args.value.migrationManifestDigest !==
      args.candidate.migrationManifestDigest ||
    args.value.targetRegistryPath !== args.candidate.targetRegistryPath ||
    args.value.targetRegistryEntryDigest !==
      canonicalJsonDigest(args.targetRegistryEntry) ||
    args.value.approvedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(args.value.approvedAt) ||
    args.value.authorityScope !==
      'time_authority_set_board_identity_rebind_only' ||
    !exactBoundary(args.value.doesNotAuthorize) ||
    ('note' in args.value && !nonEmpty(args.value.note)) ||
    args.value.digestAlgorithm !== 'canonical-json-sha256' ||
    !sha256(args.value.digest)
  ) {
    return false;
  }
  const approval = args.value as unknown as TimeAuthoritySetBoardRebindApproval;
  const expectedTargetRegistryEntry: SetIdentityBoardRegistryEntry = {
    ...structuredClone(args.candidate.proposedRegistryEntry),
    approvedBy: 'Guy',
    approvedAt: approval.approvedAt,
  };
  return registryEntryShapeIsExact(args.targetRegistryEntry) &&
    canonicalJsonDigest(args.targetRegistryEntry) ===
      canonicalJsonDigest(expectedTargetRegistryEntry) &&
    preservedRegistryFieldsMatch(
      args.candidate.sourceRegistryEntry,
      args.targetRegistryEntry,
    ) &&
    approval.digest === canonicalJsonDigest(approvalPayload(approval));
}

function readJson<T>(absolutePath: string, label: string): T {
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
  } catch {
    throw new Error(`${label} is missing or invalid JSON`);
  }
}

function targetIdentity(args: {
  storyKey: string;
  styleId: string;
  setIdentityId: string;
  contract: BookVisualContract;
}): ExpectedRegistryIdentity {
  const definition = projectSetDefinition(
    args.contract,
    args.setIdentityId,
    args.styleId,
  );
  return {
    registryVersion: SET_IDENTITY_REGISTRY_VERSION,
    boardVersion: SET_IDENTITY_BOARD_VERSION,
    storyKey: args.storyKey,
    setIdentityId: args.setIdentityId,
    styleId: args.styleId,
    setDefinitionHash: computeSetDefinitionHash(
      args.contract,
      args.setIdentityId,
      args.styleId,
    ),
    contentPolicyDigest: computeSetBoardContentPolicyDigest(definition),
    declaredPropIds: [...definition.contentPolicy.includedPropIds],
  };
}

function buildCandidateAndReview(
  args: PrepareTimeAuthoritySetBoardRebindArgs,
): {
  candidate: TimeAuthoritySetBoardRebindCandidate;
  review: TimeAuthoritySetBoardRebindReview;
  candidatePath: string;
  reviewPath: string;
} {
  const migration = loadApprovedTimeAuthorityMigration({
    repoRoot: args.repoRoot,
    approvedManifestPath: args.approvedManifestPath,
  });
  const matches = migration.sourcePackage.candidate.content.requiredBoards
    .filter((board) => board.setIdentityId === args.setIdentityId);
  if (matches.length !== 1) {
    throw new Error(
      'set Board rebind requires exactly one source package Board identity',
    );
  }
  const sourceBoard = matches[0]!;
  const sourceBoardAbsolutePath = resolveRepoPath(
    args.repoRoot,
    sourceBoard.artifactPath,
  );
  const sourceEntry = readJson<SetIdentityBoardRegistryEntry>(
    sourceBoardAbsolutePath,
    'source Set Board Registry entry',
  );
  if (
    !registryEntryShapeIsExact(sourceEntry) ||
    sourceBoard.artifactDigest !== canonicalJsonDigest(sourceEntry) ||
    sourceEntry.registryVersion !== sourceBoard.registryVersion ||
    sourceEntry.boardVersion !== sourceBoard.boardVersion ||
    sourceEntry.storyKey !== sourceBoard.storyKey ||
    sourceEntry.setIdentityId !== sourceBoard.setIdentityId ||
    sourceEntry.styleId !== sourceBoard.styleId ||
    sourceEntry.setDefinitionHash !== sourceBoard.setDefinitionHash ||
    sourceEntry.contentPolicyDigest !== sourceBoard.contentPolicyDigest ||
    canonicalJsonDigest(sourceEntry.declaredPropIds) !==
      canonicalJsonDigest(sourceBoard.declaredPropIds) ||
    sourceEntry.storageKey !== sourceBoard.storageKey ||
    sourceEntry.assetSha256 !== sourceBoard.assetSha256 ||
    sourceEntry.approvedBy !== 'Guy' ||
    sourceEntry.approvedAt !== sourceBoard.approvedAt ||
    sourceEntry.qaStatus !== 'passed'
  ) {
    throw new Error('source Set Board identity or approval is stale');
  }

  const expected = targetIdentity({
    storyKey: migration.context.storyKey,
    styleId: migration.context.styleId,
    setIdentityId: args.setIdentityId,
    contract: migration.context.template.content as unknown as BookVisualContract,
  });
  if (
    sourceEntry.setDefinitionHash === expected.setDefinitionHash ||
    sourceEntry.registryVersion !== expected.registryVersion ||
    sourceEntry.boardVersion !== expected.boardVersion ||
    sourceEntry.storyKey !== expected.storyKey ||
    sourceEntry.setIdentityId !== expected.setIdentityId ||
    sourceEntry.styleId !== expected.styleId ||
    sourceEntry.contentPolicyDigest !== expected.contentPolicyDigest ||
    canonicalJsonDigest(sourceEntry.declaredPropIds) !==
      canonicalJsonDigest(expected.declaredPropIds)
  ) {
    throw new Error(
      'Set Board rebind is not an exact time-only identity change',
    );
  }

  const proposedRegistryEntry: SetIdentityBoardRegistryEntry = {
    ...structuredClone(sourceEntry),
    registryVersion: expected.registryVersion,
    boardVersion: expected.boardVersion,
    storyKey: expected.storyKey,
    setIdentityId: expected.setIdentityId,
    styleId: expected.styleId,
    setDefinitionHash: expected.setDefinitionHash,
    contentPolicyDigest: expected.contentPolicyDigest,
    declaredPropIds: [...expected.declaredPropIds],
    approvedBy: null,
    approvedAt: null,
  };
  const identityValidation = validateSetIdentityBoardRegistryIdentity(
    proposedRegistryEntry,
    expected,
  );
  if (!identityValidation.ok) {
    throw new Error(
      `target Set Board identity is invalid: ${identityValidation.errors.join('; ')}`,
    );
  }
  const targetRegistryAbsolutePath = setIdentityBoardRegistryPath(
    expected,
    resolveRepoPath(
      args.repoRoot,
      args.targetBoardRegistryDir ?? 'set-identity-boards',
    ),
  );
  if (fs.existsSync(targetRegistryAbsolutePath)) {
    const existing = readJson<SetIdentityBoardRegistryEntry>(
      targetRegistryAbsolutePath,
      'target Set Board Registry entry',
    );
    const validation = validateSetIdentityBoardRegistryEntry(existing, expected);
    if (
      !validation.ok ||
      !preservedRegistryFieldsMatch(sourceEntry, existing)
    ) {
      throw new Error('target Set Board Registry path contains conflicting authority');
    }
  }
  const outputRootAbsolute = resolveRepoPath(args.repoRoot, args.outputRoot);
  const targetRegistryPath = repoRelativePath(
    args.repoRoot,
    targetRegistryAbsolutePath,
  );
  const candidateWithoutDigest = {
    version: TIME_AUTHORITY_SET_BOARD_REBIND_CANDIDATE_VERSION,
    migrationManifestDigest: migration.manifest.digest,
    sourcePackageCandidateDigest:
      migration.sourcePackage.candidate.digest,
    sourceBoardArtifactPath: sourceBoard.artifactPath,
    sourceBoardArtifactDigest: sourceBoard.artifactDigest,
    targetRegistryPath,
    storyKey: expected.storyKey,
    setIdentityId: expected.setIdentityId,
    styleId: expected.styleId,
    sourceSetDefinitionHash: sourceEntry.setDefinitionHash,
    targetSetDefinitionHash: expected.setDefinitionHash,
    sourceRegistryEntry: structuredClone(sourceEntry),
    proposedRegistryEntry,
    changedFields: [
      '/setDefinitionHash',
      '/approvedBy',
      '/approvedAt',
    ] as const,
    doesNotAuthorize: TIME_AUTHORITY_SET_BOARD_REBIND_DOES_NOT_AUTHORIZE,
  };
  const candidate: TimeAuthoritySetBoardRebindCandidate = {
    ...candidateWithoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(candidateWithoutDigest),
  };
  if (!timeAuthoritySetBoardRebindCandidateIsValid(candidate)) {
    throw new Error('constructed Set Board rebind candidate is invalid');
  }
  const reviewWithoutDigest = {
    version: TIME_AUTHORITY_SET_BOARD_REBIND_REVIEW_VERSION,
    candidateDigest: candidate.digest,
    migrationManifestDigest: candidate.migrationManifestDigest,
    sourcePackageCandidateDigest: candidate.sourcePackageCandidateDigest,
    storyKey: candidate.storyKey,
    setIdentityId: candidate.setIdentityId,
    styleId: candidate.styleId,
    sourceSetDefinitionHash: candidate.sourceSetDefinitionHash,
    targetSetDefinitionHash: candidate.targetSetDefinitionHash,
    preservedStorageKey: sourceEntry.storageKey,
    preservedAssetSha256: sourceEntry.assetSha256,
    preservedPromptHash: sourceEntry.promptHash,
    sourceQaStatus: 'passed' as const,
    sourceApprovedBy: 'Guy' as const,
    sourceApprovedAt: sourceEntry.approvedAt!,
    blockers: [] as const,
    readyForApproval: true as const,
    doesNotAuthorize: TIME_AUTHORITY_SET_BOARD_REBIND_DOES_NOT_AUTHORIZE,
  };
  const review: TimeAuthoritySetBoardRebindReview = {
    ...reviewWithoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(reviewWithoutDigest),
  };
  if (!timeAuthoritySetBoardRebindReviewIsValid(review, candidate)) {
    throw new Error('constructed Set Board rebind review is invalid');
  }
  return {
    candidate,
    review,
    candidatePath: repoRelativePath(
      args.repoRoot,
      path.join(
        outputRootAbsolute,
        'set-board-rebind-candidates',
        `${candidate.digest}.json`,
      ),
    ),
    reviewPath: repoRelativePath(
      args.repoRoot,
      path.join(
        outputRootAbsolute,
        'set-board-rebind-reviews',
        `${review.digest}.json`,
      ),
    ),
  };
}

export function prepareTimeAuthoritySetBoardRebind(
  args: PrepareTimeAuthoritySetBoardRebindArgs,
): {
  candidate: TimeAuthoritySetBoardRebindCandidate;
  review: TimeAuthoritySetBoardRebindReview;
  candidateArtifact: { path: string; digest: string; created: boolean };
  reviewArtifact: { path: string; digest: string; created: boolean };
  targetRegistryPath: string;
} {
  const built = buildCandidateAndReview(args);
  const candidateCreated = args.write === true
    ? writeCanonicalContentAddressedJsonArtifact({
        destinationPath: resolveRepoPath(args.repoRoot, built.candidatePath),
        value: built.candidate,
      }).created
    : false;
  const reviewCreated = args.write === true
    ? writeCanonicalContentAddressedJsonArtifact({
        destinationPath: resolveRepoPath(args.repoRoot, built.reviewPath),
        value: built.review,
      }).created
    : false;
  return {
    candidate: built.candidate,
    review: built.review,
    candidateArtifact: {
      path: built.candidatePath,
      digest: built.candidate.digest,
      created: candidateCreated,
    },
    reviewArtifact: {
      path: built.reviewPath,
      digest: built.review.digest,
      created: reviewCreated,
    },
    targetRegistryPath: built.candidate.targetRegistryPath,
  };
}

function readExpectedCanonicalArtifact<T>(args: {
  repoRoot: string;
  artifactPath: string;
  expectedPath: string;
  expectedValue: T;
  label: string;
}): T {
  const absolutePath = resolveRepoPath(args.repoRoot, args.artifactPath);
  const expectedAbsolutePath = resolveRepoPath(args.repoRoot, args.expectedPath);
  if (absolutePath !== expectedAbsolutePath) {
    throw new Error(`${args.label} path is not the canonical prepared path`);
  }
  const bytes = fs.readFileSync(absolutePath, 'utf8');
  const value = readJson<T>(absolutePath, args.label);
  if (
    bytes !== canonicalContentAddressedJsonBytes(value) ||
    canonicalContentAddressedJsonBytes(value) !==
      canonicalContentAddressedJsonBytes(args.expectedValue)
  ) {
    throw new Error(`${args.label} bytes do not match the prepared authority`);
  }
  return value;
}

function assertImmutableLocalBytesCompatible(args: {
  destinationPath: string;
  bytes: string;
  label: string;
}): void {
  if (
    fs.existsSync(args.destinationPath) &&
    fs.readFileSync(args.destinationPath, 'utf8') !== args.bytes
  ) {
    throw new Error(`${args.label} conflicts with requested approval`);
  }
}

export function approveTimeAuthoritySetBoardRebind(
  args: ApproveTimeAuthoritySetBoardRebindArgs,
): {
  candidate: TimeAuthoritySetBoardRebindCandidate;
  review: TimeAuthoritySetBoardRebindReview;
  approval: TimeAuthoritySetBoardRebindApproval;
  targetRegistryEntry: SetIdentityBoardRegistryEntry;
  approvalArtifact: { path: string; digest: string; created: boolean };
  registryArtifact: { path: string; digest: string; created: boolean };
} {
  if (args.approvedBy !== 'Guy') {
    throw new Error('approvedBy must be exact value Guy');
  }
  if (!canonicalUtcTimestampIsValid(args.approvedAt)) {
    throw new Error('approvedAt must be a canonical UTC ISO timestamp');
  }
  if (args.note !== undefined && !nonEmpty(args.note)) {
    throw new Error('approval note must be non-empty when provided');
  }
  const prepared = prepareTimeAuthoritySetBoardRebind({
    repoRoot: args.repoRoot,
    approvedManifestPath: args.approvedManifestPath,
    outputRoot: args.outputRoot,
    setIdentityId: args.setIdentityId,
    ...(args.targetBoardRegistryDir !== undefined
      ? { targetBoardRegistryDir: args.targetBoardRegistryDir }
      : {}),
    write: false,
  });
  const candidate = readExpectedCanonicalArtifact({
    repoRoot: args.repoRoot,
    artifactPath: args.candidatePath,
    expectedPath: prepared.candidateArtifact.path,
    expectedValue: prepared.candidate,
    label: 'Set Board rebind candidate',
  });
  const review = readExpectedCanonicalArtifact({
    repoRoot: args.repoRoot,
    artifactPath: args.reviewPath,
    expectedPath: prepared.reviewArtifact.path,
    expectedValue: prepared.review,
    label: 'Set Board rebind review',
  });
  if (
    !timeAuthoritySetBoardRebindCandidateIsValid(candidate) ||
    !timeAuthoritySetBoardRebindReviewIsValid(review, candidate)
  ) {
    throw new Error('Set Board rebind candidate or review is invalid');
  }
  const targetRegistryEntry: SetIdentityBoardRegistryEntry = {
    ...structuredClone(candidate.proposedRegistryEntry),
    approvedBy: 'Guy',
    approvedAt: args.approvedAt,
  };
  const expected: ExpectedRegistryIdentity = {
    registryVersion: targetRegistryEntry.registryVersion,
    boardVersion: targetRegistryEntry.boardVersion,
    storyKey: targetRegistryEntry.storyKey,
    setIdentityId: targetRegistryEntry.setIdentityId,
    styleId: targetRegistryEntry.styleId,
    setDefinitionHash: targetRegistryEntry.setDefinitionHash,
    contentPolicyDigest: targetRegistryEntry.contentPolicyDigest,
    declaredPropIds: [...targetRegistryEntry.declaredPropIds],
  };
  const validation = validateSetIdentityBoardRegistryEntry(
    targetRegistryEntry,
    expected,
  );
  if (
    !validation.ok ||
    !preservedRegistryFieldsMatch(
      candidate.sourceRegistryEntry,
      targetRegistryEntry,
    )
  ) {
    throw new Error(
      `approved target Set Board Registry entry is invalid${
        validation.ok ? '' : `: ${validation.errors.join('; ')}`
      }`,
    );
  }
  const approvalWithoutDigest = {
    version: TIME_AUTHORITY_SET_BOARD_REBIND_APPROVAL_VERSION,
    candidateDigest: candidate.digest,
    reviewDigest: review.digest,
    migrationManifestDigest: candidate.migrationManifestDigest,
    targetRegistryPath: candidate.targetRegistryPath,
    targetRegistryEntryDigest: canonicalJsonDigest(targetRegistryEntry),
    approvedBy: 'Guy' as const,
    approvedAt: args.approvedAt,
    authorityScope:
      'time_authority_set_board_identity_rebind_only' as const,
    doesNotAuthorize: TIME_AUTHORITY_SET_BOARD_REBIND_DOES_NOT_AUTHORIZE,
    ...(args.note !== undefined ? { note: args.note } : {}),
  };
  const approval: TimeAuthoritySetBoardRebindApproval = {
    ...approvalWithoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(approvalWithoutDigest),
  };
  if (!timeAuthoritySetBoardRebindApprovalIsValid({
    value: approval,
    candidate,
    review,
    targetRegistryEntry,
  })) {
    throw new Error('constructed Set Board rebind approval is invalid');
  }
  const approvalPath = repoRelativePath(
    args.repoRoot,
    path.join(
      resolveRepoPath(args.repoRoot, args.outputRoot),
      'set-board-rebind-approvals',
      `${approval.digest}.json`,
    ),
  );
  const registryAbsolutePath = resolveRepoPath(
    args.repoRoot,
    candidate.targetRegistryPath,
  );
  const registryBytes = `${JSON.stringify(targetRegistryEntry, null, 2)}\n`;
  let approvalCreated = false;
  let registryCreated = false;
  if (args.write === true) {
    assertImmutableLocalBytesCompatible({
      destinationPath: registryAbsolutePath,
      bytes: registryBytes,
      label: 'target Set Board Registry entry',
    });
    approvalCreated = writeCanonicalContentAddressedJsonArtifact({
      destinationPath: resolveRepoPath(args.repoRoot, approvalPath),
      value: approval,
    }).created;
    registryCreated = writeImmutableLocalArtifact({
      destinationPath: registryAbsolutePath,
      bytes: registryBytes,
    }).created;
  }
  return {
    candidate,
    review,
    approval,
    targetRegistryEntry,
    approvalArtifact: {
      path: approvalPath,
      digest: approval.digest,
      created: approvalCreated,
    },
    registryArtifact: {
      path: candidate.targetRegistryPath,
      digest: canonicalJsonDigest(targetRegistryEntry),
      created: registryCreated,
    },
  };
}
