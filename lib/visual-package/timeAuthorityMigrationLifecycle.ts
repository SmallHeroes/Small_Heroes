import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildSourcePromptProjectionDigest,
  resolveJsonPointer,
  sourcePromptReconciliationIssues,
  type SourcePromptReconciliation,
} from './sourcePromptReconciliation';
import {
  approvePendingSourcePromptReconciliation,
  buildReconciliationReviewBundle,
  persistReconciliationDraftBundle,
  reconciliationDraftBundleJsonBytes,
  renderReconciliationReviewMarkdown,
} from './reconciliationLifecycle';
import {
  buildStorySourceAuthoritySnapshot,
  legacyStorySourceAuthoritySnapshotV2,
  type LegacyStorySourceAuthoritySnapshotV2,
  type StorySourceAuthoritySnapshot,
} from './storySourceAuthority';
import { SOURCE_PROMPT_RECONCILIATION_VERSION } from './types';
import {
  canonicalJsonDigest,
  isoTimestampIsValid,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  canonicalContentAddressedJsonBytes,
  writeCanonicalContentAddressedJsonArtifact,
} from './canonicalContentAddressedJson';
import {
  buildProductionAuthoringContextFromFrozenVisualPackageCandidate,
  PRODUCTION_AUTHORING_CONTEXT_VERSION,
  type ProductionAuthoringContext,
} from './productionAuthoringContext';
import {
  migrateBookVisualContractTemplateTimeOfDayAuthority,
  type BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler';
import {
  VISUAL_PACKAGE_V4_CANDIDATE_VERSION,
  computeVisualPackageV4CandidateDigest,
  type VisualPackageV4Approval,
  type VisualPackageV4Candidate,
  type VisualPackageV4PackageReview,
} from './visualPackageV4';
import type {
  PreRenderBlueprintApprovalAttestation,
} from './preRenderBlueprintLifecycle';
import type {
  PreRenderBookVisualBlueprint,
} from './preRenderBlueprintTypes';
import {
  buildVisualPackageV4PackageReview,
  qualifyVisualPackageV4Candidate,
  visualPackageV4ApprovalIssues,
} from './visualPackageV4Lifecycle';

export const TIME_AUTHORITY_MIGRATION_VERSION =
  'visual-contract-time-authority-migration/v1' as const;
export const TIME_AUTHORITY_MIGRATION_MANIFEST_VERSION =
  'qa-wizard-time-authority-migration-manifest/v1' as const;
export const TIME_AUTHORITY_MIGRATION_APPROVAL_VERSION =
  'qa-wizard-time-authority-migration-approval/v1' as const;

const SHA256_HEX = /^[a-f0-9]{64}$/;

export const TIME_AUTHORITY_MIGRATION_DOES_NOT_AUTHORIZE = [
  'blueprint_authoring',
  'blueprint_approval',
  'visual_package_authoring',
  'visual_package_approval',
  'wizard_qualification',
  'wizard_render',
  'provider_call',
  'image_render',
  'production_publication',
  'deployment',
] as const;

export interface TimeAuthorityMigrationChange {
  path: string;
  before: string | null;
  after: string | null;
}

export interface TimeAuthorityMigrationManifest {
  version: typeof TIME_AUTHORITY_MIGRATION_MANIFEST_VERSION;
  stage: 'reconciliation_pending' | 'reconciliation_approved';
  source: {
    storyKey: string;
    storyPath: string;
    sourceSnapshotDigest: string;
    sourceSnapshotPath: string;
    sourcePackageCandidateDigest: string;
    sourcePackageCandidatePath: string;
    sourcePackageReviewDigest: string;
    sourcePackageReviewPath: string;
    sourcePackageApprovalDigest: string;
    sourcePackageApprovalPath: string;
    actionSemanticCoverageDigest: string;
  };
  migration: {
    version: typeof TIME_AUTHORITY_MIGRATION_VERSION;
    sourceTemplateDigest: string;
    migratedTemplateDigest: string;
    migratedTemplatePath: string;
    nonTimeProjectionDigest: string;
    changes: TimeAuthorityMigrationChange[];
  };
  reconciliation: {
    version: SourcePromptReconciliation['version'];
    digest: string;
    path: string;
    reviewBundleDigest: string;
    reviewBundlePath: string;
    reviewMarkdownPath: string;
    status: 'pending' | 'approved';
    reviewedBy: null | 'Guy';
    reviewedAt: string | null;
    approvalDigest: string | null;
    approvalPath: string | null;
  };
  productionContext: null | {
    version: ProductionAuthoringContext['version'];
    digest: string;
    styleId: string;
    styleAuthorityPath: string;
    styleAuthorityDigest: string;
  };
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface TimeAuthorityMigrationApproval {
  version: typeof TIME_AUTHORITY_MIGRATION_APPROVAL_VERSION;
  pendingManifestDigest: string;
  migratedTemplateDigest: string;
  reconciliationDigest: string;
  reconciliationPath: string;
  reviewBundleDigest: string;
  reviewBundlePath: string;
  reviewMarkdownPath: string;
  reviewMarkdownSha256: string;
  approvedBy: 'Guy';
  approvedAt: string;
  authorityScope: 'time_authority_migration_reconciliation_exact_content_only';
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

function readJsonObject<T>(absolutePath: string, label: string): T {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as unknown;
  } catch {
    throw new Error(`${label} JSON is invalid`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX.test(value);
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

function canonicalRelativePath(value: unknown): value is string {
  return nonEmptyString(value) &&
    !path.isAbsolute(value) &&
    !value.includes('\\') &&
    value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

function exactStringArray(
  actual: unknown,
  expected: readonly string[],
): boolean {
  return Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index]);
}

function canonicalArtifactPathMatchesDigest(args: {
  absolutePath: string;
  digest: string;
}): boolean {
  return sha256(args.digest) &&
    path.basename(args.absolutePath) === `${args.digest}.json`;
}

function assertCurrentCanonicalArtifact(args: {
  repoRoot: string;
  artifactPath: string;
  digest: string;
  value: unknown;
  label: string;
  category?: string;
}): void {
  const absolutePath = resolveRepoPath(args.repoRoot, args.artifactPath);
  if (
    !canonicalArtifactPathMatchesDigest({
      absolutePath,
      digest: args.digest,
    }) ||
    (args.category !== undefined &&
      path.basename(path.dirname(absolutePath)) !== args.category) ||
    fs.readFileSync(absolutePath, 'utf8') !==
      canonicalContentAddressedJsonBytes(args.value)
  ) {
    throw new Error(`${args.label} path or bytes are not canonical`);
  }
}

function assertCurrentReconciliationBundleJsonArtifact(args: {
  repoRoot: string;
  artifactPath: string;
  digest: string;
  value: unknown;
  label: string;
  category: 'reconciliations' | 'reviews';
}): void {
  const absolutePath = resolveRepoPath(args.repoRoot, args.artifactPath);
  if (
    !canonicalArtifactPathMatchesDigest({
      absolutePath,
      digest: args.digest,
    }) ||
    path.basename(path.dirname(absolutePath)) !== args.category ||
    fs.readFileSync(absolutePath, 'utf8') !==
      reconciliationDraftBundleJsonBytes(args.value)
  ) {
    throw new Error(`${args.label} path or bytes do not match its writer`);
  }
}

function assertReviewMarkdownArtifact(args: {
  repoRoot: string;
  artifactPath: string;
  reviewBundleDigest: string;
  markdown: string;
  label: string;
}): void {
  const absolutePath = resolveRepoPath(args.repoRoot, args.artifactPath);
  if (
    path.basename(absolutePath) !== `${args.reviewBundleDigest}.md` ||
    path.basename(path.dirname(absolutePath)) !== 'reviews' ||
    fs.readFileSync(absolutePath, 'utf8') !== args.markdown
  ) {
    throw new Error(`${args.label} path or bytes are not canonical`);
  }
}

function sha256Utf8(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function manifestPayload(
  value: Omit<TimeAuthorityMigrationManifest, 'digestAlgorithm' | 'digest'>,
): unknown {
  return value;
}

function approvalPayload(
  value: Omit<TimeAuthorityMigrationApproval, 'digestAlgorithm' | 'digest'>,
): unknown {
  return value;
}

function buildManifest(
  value: Omit<TimeAuthorityMigrationManifest, 'digestAlgorithm' | 'digest'>,
): TimeAuthorityMigrationManifest {
  return {
    ...value,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(manifestPayload(value)),
  };
}

function buildApproval(
  value: Omit<TimeAuthorityMigrationApproval, 'digestAlgorithm' | 'digest'>,
): TimeAuthorityMigrationApproval {
  return {
    ...value,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(approvalPayload(value)),
  };
}

export function timeAuthorityMigrationManifestIsValid(
  value: unknown,
): value is TimeAuthorityMigrationManifest {
  if (
    !isObject(value) ||
    !exactKeys(value, [
      'version',
      'stage',
      'source',
      'migration',
      'reconciliation',
      'productionContext',
      'doesNotAuthorize',
      'digestAlgorithm',
      'digest',
    ]) ||
    value.version !== TIME_AUTHORITY_MIGRATION_MANIFEST_VERSION ||
    !['reconciliation_pending', 'reconciliation_approved'].includes(
      String(value.stage),
    ) ||
    !isObject(value.source) ||
    !exactKeys(value.source, [
      'storyKey',
      'storyPath',
      'sourceSnapshotDigest',
      'sourceSnapshotPath',
      'sourcePackageCandidateDigest',
      'sourcePackageCandidatePath',
      'sourcePackageReviewDigest',
      'sourcePackageReviewPath',
      'sourcePackageApprovalDigest',
      'sourcePackageApprovalPath',
      'actionSemanticCoverageDigest',
    ]) ||
    !nonEmptyString(value.source.storyKey) ||
    !canonicalRelativePath(value.source.storyPath) ||
    !sha256(value.source.sourceSnapshotDigest) ||
    !canonicalRelativePath(value.source.sourceSnapshotPath) ||
    !sha256(value.source.sourcePackageCandidateDigest) ||
    !canonicalRelativePath(value.source.sourcePackageCandidatePath) ||
    !sha256(value.source.sourcePackageReviewDigest) ||
    !canonicalRelativePath(value.source.sourcePackageReviewPath) ||
    !sha256(value.source.sourcePackageApprovalDigest) ||
    !canonicalRelativePath(value.source.sourcePackageApprovalPath) ||
    !sha256(value.source.actionSemanticCoverageDigest) ||
    !isObject(value.migration) ||
    !exactKeys(value.migration, [
      'version',
      'sourceTemplateDigest',
      'migratedTemplateDigest',
      'migratedTemplatePath',
      'nonTimeProjectionDigest',
      'changes',
    ]) ||
    value.migration.version !== TIME_AUTHORITY_MIGRATION_VERSION ||
    !sha256(value.migration.sourceTemplateDigest) ||
    !sha256(value.migration.migratedTemplateDigest) ||
    !canonicalRelativePath(value.migration.migratedTemplatePath) ||
    !sha256(value.migration.nonTimeProjectionDigest) ||
    !Array.isArray(value.migration.changes) ||
    value.migration.changes.length === 0 ||
    !isObject(value.reconciliation) ||
    !exactKeys(value.reconciliation, [
      'version',
      'digest',
      'path',
      'reviewBundleDigest',
      'reviewBundlePath',
      'reviewMarkdownPath',
      'status',
      'reviewedBy',
      'reviewedAt',
      'approvalDigest',
      'approvalPath',
    ]) ||
    value.reconciliation.version !== SOURCE_PROMPT_RECONCILIATION_VERSION ||
    !sha256(value.reconciliation.digest) ||
    !canonicalRelativePath(value.reconciliation.path) ||
    !sha256(value.reconciliation.reviewBundleDigest) ||
    !canonicalRelativePath(value.reconciliation.reviewBundlePath) ||
    !canonicalRelativePath(value.reconciliation.reviewMarkdownPath) ||
    !exactStringArray(
      value.doesNotAuthorize,
      TIME_AUTHORITY_MIGRATION_DOES_NOT_AUTHORIZE,
    ) ||
    value.digestAlgorithm !== 'canonical-json-sha256' ||
    !sha256(value.digest)
  ) {
    return false;
  }
  const seenChangePaths = new Set<string>();
  for (const change of value.migration.changes) {
    if (
      !isObject(change) ||
      !exactKeys(change, ['path', 'before', 'after']) ||
      !nonEmptyString(change.path) ||
      !change.path.startsWith('/') ||
      !(
        change.before === null || typeof change.before === 'string'
      ) ||
      !(change.after === null || typeof change.after === 'string') ||
      change.before === change.after ||
      seenChangePaths.has(change.path)
    ) {
      return false;
    }
    seenChangePaths.add(change.path);
  }
  if (value.stage === 'reconciliation_pending') {
    if (
      value.reconciliation.status !== 'pending' ||
      value.reconciliation.reviewedBy !== null ||
      value.reconciliation.reviewedAt !== null ||
      value.reconciliation.approvalDigest !== null ||
      value.reconciliation.approvalPath !== null ||
      value.productionContext !== null
    ) {
      return false;
    }
  } else if (
    value.reconciliation.status !== 'approved' ||
    value.reconciliation.reviewedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(value.reconciliation.reviewedAt) ||
    !sha256(value.reconciliation.approvalDigest) ||
    !canonicalRelativePath(value.reconciliation.approvalPath) ||
    !isObject(value.productionContext) ||
    !exactKeys(value.productionContext, [
      'version',
      'digest',
      'styleId',
      'styleAuthorityPath',
      'styleAuthorityDigest',
    ]) ||
    value.productionContext.version !== PRODUCTION_AUTHORING_CONTEXT_VERSION ||
    !sha256(value.productionContext.digest) ||
    !nonEmptyString(value.productionContext.styleId) ||
    !canonicalRelativePath(value.productionContext.styleAuthorityPath) ||
    !sha256(value.productionContext.styleAuthorityDigest)
  ) {
    return false;
  }
  try {
    const {
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...payload
    } = value;
    return value.digest === canonicalJsonDigest(payload);
  } catch {
    return false;
  }
}

export function timeAuthorityMigrationApprovalIsValid(
  value: unknown,
): value is TimeAuthorityMigrationApproval {
  if (
    !isObject(value) ||
    !exactKeys(value, [
      'version',
      'pendingManifestDigest',
      'migratedTemplateDigest',
      'reconciliationDigest',
      'reconciliationPath',
      'reviewBundleDigest',
      'reviewBundlePath',
      'reviewMarkdownPath',
      'reviewMarkdownSha256',
      'approvedBy',
      'approvedAt',
      'authorityScope',
      'doesNotAuthorize',
      'digestAlgorithm',
      'digest',
    ]) ||
    value.version !== TIME_AUTHORITY_MIGRATION_APPROVAL_VERSION ||
    !sha256(value.pendingManifestDigest) ||
    !sha256(value.migratedTemplateDigest) ||
    !sha256(value.reconciliationDigest) ||
    !canonicalRelativePath(value.reconciliationPath) ||
    !sha256(value.reviewBundleDigest) ||
    !canonicalRelativePath(value.reviewBundlePath) ||
    !canonicalRelativePath(value.reviewMarkdownPath) ||
    !sha256(value.reviewMarkdownSha256) ||
    value.approvedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(value.approvedAt) ||
    value.authorityScope !==
      'time_authority_migration_reconciliation_exact_content_only' ||
    !exactStringArray(
      value.doesNotAuthorize,
      TIME_AUTHORITY_MIGRATION_DOES_NOT_AUTHORIZE,
    ) ||
    value.digestAlgorithm !== 'canonical-json-sha256' ||
    !sha256(value.digest)
  ) {
    return false;
  }
  try {
    const {
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...payload
    } = value;
    return value.digest === canonicalJsonDigest(payload);
  } catch {
    return false;
  }
}

function persistJson(args: {
  repoRoot: string;
  outputDir: string;
  category: string;
  digest: string;
  value: unknown;
  write?: boolean;
}): { path: string; digest: string; created: boolean } {
  const root = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, root);
  const destination = path.join(
    root,
    args.category,
    `${args.digest}.json`,
  );
  const result = args.write === true
    ? writeCanonicalContentAddressedJsonArtifact({
        destinationPath: destination,
        value: args.value,
      })
    : { created: false };
  return {
    path: repoRelativePath(args.repoRoot, destination),
    digest: args.digest,
    created: result.created,
  };
}

function stripTimeAuthority(
  template: BookVisualContractTemplate,
): unknown {
  const clone = structuredClone(template) as BookVisualContractTemplate &
    Record<string, unknown>;
  for (const location of clone.locations) delete location.timeOfDay;
  delete clone.coverContract.timeOfDay;
  for (const authority of clone.setBoardAuthorities ?? []) {
    for (const location of authority.locations) {
      delete (location as unknown as Record<string, unknown>).timeOfDay;
    }
  }
  return clone;
}

function migrationChanges(args: {
  source: BookVisualContractTemplate;
  migrated: BookVisualContractTemplate;
}): TimeAuthorityMigrationChange[] {
  const changes: TimeAuthorityMigrationChange[] = [];
  const add = (
    pointer: string,
    before: string | null | undefined,
    after: string | null | undefined,
  ) => {
    const normalizedBefore = before ?? null;
    const normalizedAfter = after ?? null;
    if (normalizedBefore !== normalizedAfter) {
      changes.push({
        path: pointer,
        before: normalizedBefore,
        after: normalizedAfter,
      });
    }
  };
  args.source.locations.forEach((location, index) => {
    add(
      `/locations/${index}/timeOfDay`,
      location.timeOfDay,
      args.migrated.locations[index]?.timeOfDay,
    );
  });
  add(
    '/coverContract/timeOfDay',
    args.source.coverContract.timeOfDay,
    args.migrated.coverContract.timeOfDay,
  );
  (args.source.setBoardAuthorities ?? []).forEach((authority, authorityIndex) => {
    authority.locations.forEach((location, locationIndex) => {
      add(
        `/setBoardAuthorities/${authorityIndex}/locations/${locationIndex}/timeOfDay`,
        location.timeOfDay,
        args.migrated.setBoardAuthorities?.[authorityIndex]?.locations[
          locationIndex
        ]?.timeOfDay,
      );
    });
  });
  return changes;
}

export function buildPendingTimeAuthorityMigrationReconciliation(
  source: SourcePromptReconciliation,
  sourceTemplate: BookVisualContractTemplate,
  migratedTemplate: BookVisualContractTemplate,
): SourcePromptReconciliation {
  if (
    source.review.status !== 'approved' ||
    source.review.reviewedBy !== 'Guy' ||
    !isoTimestampIsValid(source.review.reviewedAt)
  ) {
    throw new Error('source reconciliation is not exact Guy-approved content');
  }
  const exactMigration = buildTimeAuthorityMigrationProjection(sourceTemplate);
  if (canonicalJsonDigest(migratedTemplate) !== exactMigration.digest) {
    throw new Error(
      'migrated template is not the exact time-authority projection',
    );
  }
  const pending = structuredClone(source);
  pending.templateDigest = canonicalJsonDigest(migratedTemplate);
  pending.templateSchemaVersion = migratedTemplate.schemaVersion;
  for (const frame of pending.frames) {
    frame.contractProjectionDigest = buildSourcePromptProjectionDigest(
      migratedTemplate,
      frame.frameKind,
      frame.pageNumber,
    );
    for (const requirement of frame.sourceRequirements) {
      for (const beat of requirement.visualBeats) {
        for (const evidence of beat.contractEvidence) {
          const before = resolveJsonPointer(sourceTemplate, evidence.path);
          const after = resolveJsonPointer(migratedTemplate, evidence.path);
          if (
            !before.found ||
            !after.found ||
            canonicalJsonDigest(before.value) !==
              canonicalJsonDigest(evidence.value)
          ) {
            throw new Error(
              'source reconciliation contract evidence is stale or unmappable',
            );
          }
          if (
            canonicalJsonDigest(before.value) !==
            canonicalJsonDigest(after.value)
          ) {
            evidence.value = structuredClone(after.value);
          }
        }
        if (beat.disposition === 'intentionally_superseded') {
          beat.supersessionReview = {
            status: 'pending',
            reviewedBy: null,
            reviewedAt: null,
          };
        }
      }
    }
  }
  for (const entry of pending.presentationRequirementDispositions.entries) {
    entry.review = {
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
    };
  }
  pending.review = {
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
  };
  return pending;
}

export function approveTimeAuthorityMigrationReconciliation(
  pending: SourcePromptReconciliation,
  approvedAt: string,
): SourcePromptReconciliation {
  return approvePendingSourcePromptReconciliation({
    pending,
    approvedBy: 'Guy',
    approvedAt,
  });
}

function loadSourceAuthority(args: {
  repoRoot: string;
  sourcePackageCandidatePath: string;
  sourcePackageReviewPath: string;
  sourcePackageApprovalPath: string;
}): {
  snapshot: StorySourceAuthoritySnapshot;
  reconciliationSnapshot:
    | StorySourceAuthoritySnapshot
    | LegacyStorySourceAuthoritySnapshotV2;
  candidate: VisualPackageV4Candidate;
  packageReview: VisualPackageV4PackageReview;
  packageApproval: VisualPackageV4Approval;
  sourceReconciliation: SourcePromptReconciliation;
} {
  const candidateAbsolutePath = resolveRepoPath(
    args.repoRoot,
    args.sourcePackageCandidatePath,
  );
  const reviewAbsolutePath = resolveRepoPath(
    args.repoRoot,
    args.sourcePackageReviewPath,
  );
  const approvalAbsolutePath = resolveRepoPath(
    args.repoRoot,
    args.sourcePackageApprovalPath,
  );
  const candidate = readJsonObject<VisualPackageV4Candidate>(
    candidateAbsolutePath,
    'source Visual Package candidate',
  );
  const packageReview = readJsonObject<VisualPackageV4PackageReview>(
    reviewAbsolutePath,
    'source Visual Package review',
  );
  const packageApproval = readJsonObject<VisualPackageV4Approval>(
    approvalAbsolutePath,
    'source Visual Package approval',
  );
  if (
    candidate.version !== VISUAL_PACKAGE_V4_CANDIDATE_VERSION ||
    candidate.state !== 'candidate' ||
    candidate.digestAlgorithm !== 'canonical-json-sha256' ||
    candidate.digest !== computeVisualPackageV4CandidateDigest(candidate.content) ||
    !canonicalArtifactPathMatchesDigest({
      absolutePath: candidateAbsolutePath,
      digest: candidate.digest,
    }) ||
    path.basename(path.dirname(candidateAbsolutePath)) !== 'candidates'
  ) {
    throw new Error('source Visual Package candidate is invalid or tampered');
  }
  const expectedReview = buildVisualPackageV4PackageReview({ candidate });
  if (
    canonicalContentAddressedJsonBytes(expectedReview) !==
      canonicalContentAddressedJsonBytes(packageReview) ||
    !canonicalArtifactPathMatchesDigest({
      absolutePath: reviewAbsolutePath,
      digest: packageReview.digest,
    }) ||
    path.basename(path.dirname(reviewAbsolutePath)) !== 'package-reviews' ||
    !sha256(packageApproval.digest) ||
    !canonicalArtifactPathMatchesDigest({
      absolutePath: approvalAbsolutePath,
      digest: packageApproval.digest,
    }) ||
    path.basename(path.dirname(approvalAbsolutePath)) !== candidate.digest ||
    path.basename(path.dirname(path.dirname(approvalAbsolutePath))) !==
      'approvals' ||
    visualPackageV4ApprovalIssues({
      candidate,
      packageReview,
      approval: packageApproval,
    }).length > 0
  ) {
    throw new Error('source Visual Package review or approval is invalid');
  }
  const qualification = qualifyVisualPackageV4Candidate({
    repoRoot: args.repoRoot,
    candidate,
    packageReview,
    approval: packageApproval,
  });
  if (
    qualification.readyForPublication ||
    qualification.reasons.length !== 1 ||
    qualification.reasons[0]?.code !== 'template_stale' ||
    !/timeOfDay/.test(qualification.reasons[0].message)
  ) {
    throw new Error(
      'source Visual Package is not blocked solely by the approved time-authority migration defect',
    );
  }
  const snapshot = buildStorySourceAuthoritySnapshot({
    repoRoot: args.repoRoot,
    storyKey: candidate.content.storyKey,
    storyPath: candidate.content.sourceSnapshot.identity.path,
  });
  if (
    snapshot.content.sourceIdentity.digest !==
      candidate.content.sourceSnapshot.identity.digest ||
    snapshot.content.sourceIdentity.path !==
      candidate.content.sourceSnapshot.identity.path
  ) {
    throw new Error('source snapshot changed after package approval');
  }
  const sourceReconciliation =
    candidate.content.reconciliation.content;
  const legacySnapshot =
    legacyStorySourceAuthoritySnapshotV2(snapshot);
  const reconciliationSnapshot =
    sourceReconciliation.sourceAuthoritySnapshotDigest ===
      legacySnapshot.digest
      ? legacySnapshot
      : snapshot;
  const sourceTemplate = candidate.content.visualContractTemplate.content;
  const actionSemanticCoverage =
    sourceReconciliation.actionSemanticCoverageAuthority.records;
  const sourceIssues = sourcePromptReconciliationIssues({
    raw: sourceReconciliation,
    storyKey: snapshot.content.storyKey,
    sourceIdentity: snapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: reconciliationSnapshot.digest,
    rawStorySource: snapshot.content.normalizedRawStorySource,
    template: sourceTemplate,
    templateDigest: candidate.content.visualContractTemplate.digest,
    ...(snapshot.content.authoredCoverAuthority
      ? { authoredCoverAuthority: snapshot.content.authoredCoverAuthority }
      : {}),
    actionSemanticCoverage,
    requireComplete: true,
  });
  if (sourceIssues.length > 0) {
    throw new Error('source reconciliation is stale or incomplete');
  }
  return {
    snapshot,
    candidate,
    packageReview,
    packageApproval,
    sourceReconciliation,
    reconciliationSnapshot,
  };
}

export function buildTimeAuthorityMigrationProjection(
  sourceTemplate: BookVisualContractTemplate,
): {
  template: BookVisualContractTemplate;
  digest: string;
  nonTimeProjectionDigest: string;
  changes: TimeAuthorityMigrationChange[];
} {
  const template =
    migrateBookVisualContractTemplateTimeOfDayAuthority(
      sourceTemplate,
    );
  const nonTimeSource = canonicalJsonDigest(
    stripTimeAuthority(sourceTemplate),
  );
  const nonTimeMigrated = canonicalJsonDigest(stripTimeAuthority(template));
  if (nonTimeSource !== nonTimeMigrated) {
    throw new Error('time migration changed non-time Visual Contract authority');
  }
  const changes = migrationChanges({
    source: sourceTemplate,
    migrated: template,
  });
  if (changes.length === 0) {
    throw new Error('time migration produced no authority change');
  }
  return {
    template,
    digest: canonicalJsonDigest(template),
    nonTimeProjectionDigest: nonTimeSource,
    changes,
  };
}

function loadMigrationManifest(args: {
  repoRoot: string;
  manifestPath: string;
}): TimeAuthorityMigrationManifest {
  const absolute = resolveRepoPath(args.repoRoot, args.manifestPath);
  const manifest = readJsonObject<TimeAuthorityMigrationManifest>(
    absolute,
    'time-authority migration manifest',
  );
  if (
    !timeAuthorityMigrationManifestIsValid(manifest) ||
    path.basename(absolute) !== `${manifest.digest}.json` ||
    path.basename(path.dirname(absolute)) !==
      'time-authority-migration-manifests' ||
    fs.readFileSync(absolute, 'utf8') !==
      canonicalContentAddressedJsonBytes(manifest)
  ) {
    throw new Error('time-authority migration manifest is invalid or tampered');
  }
  return manifest;
}

function assertManifestBindsSourceAuthority(args: {
  repoRoot: string;
  manifest: TimeAuthorityMigrationManifest;
  source: ReturnType<typeof loadSourceAuthority>;
  migration: ReturnType<typeof buildTimeAuthorityMigrationProjection>;
}): void {
  const coverageAuthority =
    args.source.sourceReconciliation.actionSemanticCoverageAuthority;
  if (
    args.manifest.source.storyKey !== args.source.snapshot.content.storyKey ||
    args.manifest.source.storyPath !==
      args.source.snapshot.content.sourceIdentity.path ||
    args.manifest.source.sourceSnapshotDigest !==
      args.source.reconciliationSnapshot.digest ||
    args.manifest.source.sourcePackageCandidateDigest !==
      args.source.candidate.digest ||
    args.manifest.source.sourcePackageReviewDigest !==
      args.source.packageReview.digest ||
    args.manifest.source.sourcePackageApprovalDigest !==
      args.source.packageApproval.digest ||
    args.manifest.source.actionSemanticCoverageDigest !==
      coverageAuthority.actionSemanticCoverageDigest ||
    coverageAuthority.actionSemanticCoverageDigest !==
      canonicalJsonDigest(coverageAuthority.records) ||
    args.manifest.migration.sourceTemplateDigest !==
      args.source.candidate.content.visualContractTemplate.digest ||
    args.manifest.migration.migratedTemplateDigest !== args.migration.digest ||
    args.manifest.migration.nonTimeProjectionDigest !==
      args.migration.nonTimeProjectionDigest ||
    canonicalJsonDigest(args.manifest.migration.changes) !==
      canonicalJsonDigest(args.migration.changes)
  ) {
    throw new Error('time-authority migration manifest source binding is stale');
  }
  assertCurrentCanonicalArtifact({
    repoRoot: args.repoRoot,
    artifactPath: args.manifest.source.sourceSnapshotPath,
    digest: args.source.reconciliationSnapshot.digest,
    value: args.source.reconciliationSnapshot,
    label: 'migration source snapshot',
    category: 'source-snapshots',
  });
  assertCurrentCanonicalArtifact({
    repoRoot: args.repoRoot,
    artifactPath: args.manifest.migration.migratedTemplatePath,
    digest: args.migration.digest,
    value: args.migration.template,
    label: 'migrated Visual Contract Template',
    category: 'migrated-template-projections',
  });
}

export function prepareTimeAuthorityMigrationReconciliation(args: {
  repoRoot: string;
  outputDir: string;
  sourcePackageCandidatePath: string;
  sourcePackageReviewPath: string;
  sourcePackageApprovalPath: string;
  write?: boolean;
}): {
  manifest: TimeAuthorityMigrationManifest;
  manifestArtifact: { path: string; digest: string; created: boolean };
  migratedTemplateArtifact: { path: string; digest: string; created: boolean };
  sourceSnapshotArtifact: { path: string; digest: string; created: boolean };
  reconciliationArtifacts: ReturnType<typeof persistReconciliationDraftBundle>;
} {
  const source = loadSourceAuthority(args);
  const migration = buildTimeAuthorityMigrationProjection(
    source.candidate.content.visualContractTemplate.content,
  );
  const actionSemanticCoverage =
    source.sourceReconciliation.actionSemanticCoverageAuthority.records;
  const pending = buildPendingTimeAuthorityMigrationReconciliation(
    source.sourceReconciliation,
    source.candidate.content.visualContractTemplate.content,
    migration.template,
  );
  const pendingIssues = sourcePromptReconciliationIssues({
    raw: pending,
    storyKey: source.snapshot.content.storyKey,
    sourceIdentity: source.snapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: source.reconciliationSnapshot.digest,
    rawStorySource: source.snapshot.content.normalizedRawStorySource,
    template: migration.template,
    templateDigest: migration.digest,
    ...(source.snapshot.content.authoredCoverAuthority
      ? {
          authoredCoverAuthority:
            source.snapshot.content.authoredCoverAuthority,
        }
      : {}),
    actionSemanticCoverage,
    requireComplete: false,
  });
  if (
    pendingIssues.some(
      (issue) => issue.code !== 'reconciliation_incomplete',
    )
  ) {
    throw new Error('migrated reconciliation has non-review blocking issues');
  }
  const reviewBundle = buildReconciliationReviewBundle({
    reconciliation: pending,
    sourceIdentity: source.snapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: source.reconciliationSnapshot.digest,
    rawStorySource: source.snapshot.content.normalizedRawStorySource,
    template: migration.template,
    ...(source.snapshot.content.authoredCoverAuthority
      ? {
          authoredCoverAuthority:
            source.snapshot.content.authoredCoverAuthority,
        }
      : {}),
    actionSemanticCoverage,
  });
  if (reviewBundle.readyForApproval || reviewBundle.blockingIssues.length === 0) {
    throw new Error('migration preparation must require fresh human review');
  }
  const migratedTemplateArtifact = persistJson({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'migrated-template-projections',
    digest: migration.digest,
    value: migration.template,
    write: args.write,
  });
  const sourceSnapshotArtifact = persistJson({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'source-snapshots',
    digest: source.reconciliationSnapshot.digest,
    value: source.reconciliationSnapshot,
    write: args.write,
  });
  const reconciliationArtifacts = persistReconciliationDraftBundle({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    reconciliation: pending,
    reviewBundle,
    markdown: renderReconciliationReviewMarkdown(reviewBundle),
    write: args.write,
  });
  const manifest = buildManifest({
    version: TIME_AUTHORITY_MIGRATION_MANIFEST_VERSION,
    stage: 'reconciliation_pending',
    source: {
      storyKey: source.snapshot.content.storyKey,
      storyPath: source.snapshot.content.sourceIdentity.path,
      sourceSnapshotDigest: source.reconciliationSnapshot.digest,
      sourceSnapshotPath: sourceSnapshotArtifact.path,
      sourcePackageCandidateDigest: source.candidate.digest,
      sourcePackageCandidatePath: repoRelativePath(
        args.repoRoot,
        resolveRepoPath(args.repoRoot, args.sourcePackageCandidatePath),
      ),
      sourcePackageReviewDigest: source.packageReview.digest,
      sourcePackageReviewPath: repoRelativePath(
        args.repoRoot,
        resolveRepoPath(args.repoRoot, args.sourcePackageReviewPath),
      ),
      sourcePackageApprovalDigest: String(source.packageApproval.digest),
      sourcePackageApprovalPath: repoRelativePath(
        args.repoRoot,
        resolveRepoPath(args.repoRoot, args.sourcePackageApprovalPath),
      ),
      actionSemanticCoverageDigest: canonicalJsonDigest(
        actionSemanticCoverage,
      ),
    },
    migration: {
      version: TIME_AUTHORITY_MIGRATION_VERSION,
      sourceTemplateDigest:
        source.candidate.content.visualContractTemplate.digest,
      migratedTemplateDigest: migration.digest,
      migratedTemplatePath: migratedTemplateArtifact.path,
      nonTimeProjectionDigest: migration.nonTimeProjectionDigest,
      changes: migration.changes,
    },
    reconciliation: {
      version: pending.version,
      digest: reviewBundle.reconciliationDigest,
      path: reconciliationArtifacts.reconciliationPath,
      reviewBundleDigest: reviewBundle.digest,
      reviewBundlePath: reconciliationArtifacts.reviewBundlePath,
      reviewMarkdownPath: reconciliationArtifacts.markdownPath,
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      approvalDigest: null,
      approvalPath: null,
    },
    productionContext: null,
    doesNotAuthorize: [...TIME_AUTHORITY_MIGRATION_DOES_NOT_AUTHORIZE],
  });
  const manifestArtifact = persistJson({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'time-authority-migration-manifests',
    digest: manifest.digest,
    value: manifest,
    write: args.write,
  });
  return {
    manifest,
    manifestArtifact,
    migratedTemplateArtifact,
    sourceSnapshotArtifact,
    reconciliationArtifacts,
  };
}

export function recordTimeAuthorityMigrationReconciliationApproval(args: {
  repoRoot: string;
  outputDir: string;
  pendingManifestPath: string;
  approvedBy: 'Guy';
  approvedAt: string;
  write?: boolean;
}): {
  approval: TimeAuthorityMigrationApproval;
  approvalArtifact: { path: string; digest: string; created: boolean };
  approvedReconciliationArtifacts: ReturnType<
    typeof persistReconciliationDraftBundle
  >;
} {
  if (
    args.approvedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(args.approvedAt)
  ) {
    throw new Error('time-authority migration approval is invalid');
  }
  const pendingManifest = loadMigrationManifest({
    repoRoot: args.repoRoot,
    manifestPath: args.pendingManifestPath,
  });
  if (
    pendingManifest.stage !== 'reconciliation_pending' ||
    pendingManifest.reconciliation.status !== 'pending'
  ) {
    throw new Error('time-authority migration approval requires pending evidence');
  }
  const source = loadSourceAuthority({
    repoRoot: args.repoRoot,
    sourcePackageCandidatePath:
      pendingManifest.source.sourcePackageCandidatePath,
    sourcePackageReviewPath:
      pendingManifest.source.sourcePackageReviewPath,
    sourcePackageApprovalPath:
      pendingManifest.source.sourcePackageApprovalPath,
  });
  const migration = buildTimeAuthorityMigrationProjection(
    source.candidate.content.visualContractTemplate.content,
  );
  assertManifestBindsSourceAuthority({
    repoRoot: args.repoRoot,
    manifest: pendingManifest,
    source,
    migration,
  });
  const actionSemanticCoverage =
    source.sourceReconciliation.actionSemanticCoverageAuthority.records;
  const expectedPending = buildPendingTimeAuthorityMigrationReconciliation(
    source.sourceReconciliation,
    source.candidate.content.visualContractTemplate.content,
    migration.template,
  );
  const pending = readJsonObject<SourcePromptReconciliation>(
    resolveRepoPath(args.repoRoot, pendingManifest.reconciliation.path),
    'pending migrated reconciliation',
  );
  if (
    canonicalJsonDigest(pending) !== pendingManifest.reconciliation.digest ||
    canonicalJsonDigest(expectedPending) !==
      pendingManifest.reconciliation.digest
  ) {
    throw new Error('pending migrated reconciliation digest is stale');
  }
  assertCurrentReconciliationBundleJsonArtifact({
    repoRoot: args.repoRoot,
    artifactPath: pendingManifest.reconciliation.path,
    digest: pendingManifest.reconciliation.digest,
    value: expectedPending,
    label: 'pending migrated reconciliation',
    category: 'reconciliations',
  });
  const pendingReviewBundle = buildReconciliationReviewBundle({
    reconciliation: pending,
    sourceIdentity: source.snapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: source.reconciliationSnapshot.digest,
    rawStorySource: source.snapshot.content.normalizedRawStorySource,
    template: migration.template,
    ...(source.snapshot.content.authoredCoverAuthority
      ? {
          authoredCoverAuthority:
            source.snapshot.content.authoredCoverAuthority,
        }
      : {}),
    actionSemanticCoverage,
  });
  const pendingMarkdown = renderReconciliationReviewMarkdown(
    pendingReviewBundle,
  );
  if (
    pendingReviewBundle.digest !==
      pendingManifest.reconciliation.reviewBundleDigest
  ) {
    throw new Error('pending migrated reconciliation review is stale');
  }
  assertCurrentReconciliationBundleJsonArtifact({
    repoRoot: args.repoRoot,
    artifactPath: pendingManifest.reconciliation.reviewBundlePath,
    digest: pendingReviewBundle.digest,
    value: pendingReviewBundle,
    label: 'pending migrated reconciliation review bundle',
    category: 'reviews',
  });
  assertReviewMarkdownArtifact({
    repoRoot: args.repoRoot,
    artifactPath: pendingManifest.reconciliation.reviewMarkdownPath,
    reviewBundleDigest: pendingReviewBundle.digest,
    markdown: pendingMarkdown,
    label: 'pending migrated reconciliation review markdown',
  });
  const approved = approveTimeAuthorityMigrationReconciliation(
    pending,
    args.approvedAt,
  );
  const reviewBundle = buildReconciliationReviewBundle({
    reconciliation: approved,
    sourceIdentity: source.snapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: source.reconciliationSnapshot.digest,
    rawStorySource: source.snapshot.content.normalizedRawStorySource,
    template: migration.template,
    ...(source.snapshot.content.authoredCoverAuthority
      ? {
          authoredCoverAuthority:
            source.snapshot.content.authoredCoverAuthority,
        }
      : {}),
    actionSemanticCoverage,
  });
  if (!reviewBundle.readyForApproval || reviewBundle.blockingIssues.length > 0) {
    throw new Error('fresh migrated reconciliation review remains incomplete');
  }
  const markdown = renderReconciliationReviewMarkdown(reviewBundle);
  const approvedReconciliationArtifacts = persistReconciliationDraftBundle({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    reconciliation: approved,
    reviewBundle,
    markdown,
    write: args.write,
  });
  const approval = buildApproval({
    version: TIME_AUTHORITY_MIGRATION_APPROVAL_VERSION,
    pendingManifestDigest: pendingManifest.digest,
    migratedTemplateDigest: migration.digest,
    reconciliationDigest: reviewBundle.reconciliationDigest,
    reconciliationPath:
      approvedReconciliationArtifacts.reconciliationPath,
    reviewBundleDigest: reviewBundle.digest,
    reviewBundlePath: approvedReconciliationArtifacts.reviewBundlePath,
    reviewMarkdownPath: approvedReconciliationArtifacts.markdownPath,
    reviewMarkdownSha256: sha256Utf8(markdown),
    approvedBy: 'Guy',
    approvedAt: args.approvedAt,
    authorityScope:
      'time_authority_migration_reconciliation_exact_content_only',
    doesNotAuthorize: [...TIME_AUTHORITY_MIGRATION_DOES_NOT_AUTHORIZE],
  });
  const approvalArtifact = persistJson({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'time-authority-migration-approvals',
    digest: approval.digest,
    value: approval,
    write: args.write,
  });
  return {
    approval,
    approvalArtifact,
    approvedReconciliationArtifacts,
  };
}

export function advanceApprovedTimeAuthorityMigration(args: {
  repoRoot: string;
  outputDir: string;
  pendingManifestPath: string;
  approvalPath: string;
  styleId: string;
  styleAuthorityPath: string;
  expectedStyleAuthorityDigest?: string;
  write?: boolean;
}): {
  manifest: TimeAuthorityMigrationManifest;
  manifestArtifact: { path: string; digest: string; created: boolean };
  context: ProductionAuthoringContext;
} {
  const pendingManifest = loadMigrationManifest({
    repoRoot: args.repoRoot,
    manifestPath: args.pendingManifestPath,
  });
  if (pendingManifest.stage !== 'reconciliation_pending') {
    throw new Error('time-authority migration can advance only from pending');
  }
  const approval = readJsonObject<TimeAuthorityMigrationApproval>(
    resolveRepoPath(args.repoRoot, args.approvalPath),
    'time-authority migration approval',
  );
  if (
    !timeAuthorityMigrationApprovalIsValid(approval) ||
    approval.pendingManifestDigest !== pendingManifest.digest ||
    approval.migratedTemplateDigest !==
      pendingManifest.migration.migratedTemplateDigest ||
    approval.approvedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(approval.approvedAt)
  ) {
    throw new Error('time-authority migration approval is invalid or stale');
  }
  assertCurrentCanonicalArtifact({
    repoRoot: args.repoRoot,
    artifactPath: args.approvalPath,
    digest: approval.digest,
    value: approval,
    label: 'time-authority migration approval',
    category: 'time-authority-migration-approvals',
  });
  const source = loadSourceAuthority({
    repoRoot: args.repoRoot,
    sourcePackageCandidatePath:
      pendingManifest.source.sourcePackageCandidatePath,
    sourcePackageReviewPath:
      pendingManifest.source.sourcePackageReviewPath,
    sourcePackageApprovalPath:
      pendingManifest.source.sourcePackageApprovalPath,
  });
  const migration = buildTimeAuthorityMigrationProjection(
    source.candidate.content.visualContractTemplate.content,
  );
  assertManifestBindsSourceAuthority({
    repoRoot: args.repoRoot,
    manifest: pendingManifest,
    source,
    migration,
  });
  const approvedReconciliation = readJsonObject<SourcePromptReconciliation>(
    resolveRepoPath(args.repoRoot, approval.reconciliationPath),
    'approved migrated reconciliation',
  );
  const expectedPending = buildPendingTimeAuthorityMigrationReconciliation(
    source.sourceReconciliation,
    source.candidate.content.visualContractTemplate.content,
    migration.template,
  );
  const expectedApproved = approveTimeAuthorityMigrationReconciliation(
    expectedPending,
    approval.approvedAt,
  );
  if (
    canonicalJsonDigest(approvedReconciliation) !==
      approval.reconciliationDigest ||
    canonicalJsonDigest(expectedApproved) !== approval.reconciliationDigest
  ) {
    throw new Error('approved migrated reconciliation digest is stale');
  }
  assertCurrentReconciliationBundleJsonArtifact({
    repoRoot: args.repoRoot,
    artifactPath: approval.reconciliationPath,
    digest: approval.reconciliationDigest,
    value: expectedApproved,
    label: 'approved migrated reconciliation',
    category: 'reconciliations',
  });
  const approvedReviewBundle = buildReconciliationReviewBundle({
    reconciliation: approvedReconciliation,
    sourceIdentity: source.snapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: source.reconciliationSnapshot.digest,
    rawStorySource: source.snapshot.content.normalizedRawStorySource,
    template: migration.template,
    ...(source.snapshot.content.authoredCoverAuthority
      ? {
          authoredCoverAuthority:
            source.snapshot.content.authoredCoverAuthority,
        }
      : {}),
    actionSemanticCoverage:
      source.sourceReconciliation.actionSemanticCoverageAuthority.records,
  });
  const approvedMarkdown = renderReconciliationReviewMarkdown(
    approvedReviewBundle,
  );
  if (
    !approvedReviewBundle.readyForApproval ||
    approvedReviewBundle.blockingIssues.length > 0 ||
    approvedReviewBundle.reconciliationDigest !==
      approval.reconciliationDigest ||
    approvedReviewBundle.digest !== approval.reviewBundleDigest ||
    sha256Utf8(approvedMarkdown) !== approval.reviewMarkdownSha256
  ) {
    throw new Error('approved migrated reconciliation review is stale');
  }
  assertCurrentReconciliationBundleJsonArtifact({
    repoRoot: args.repoRoot,
    artifactPath: approval.reviewBundlePath,
    digest: approval.reviewBundleDigest,
    value: approvedReviewBundle,
    label: 'approved migrated reconciliation review bundle',
    category: 'reviews',
  });
  assertReviewMarkdownArtifact({
    repoRoot: args.repoRoot,
    artifactPath: approval.reviewMarkdownPath,
    reviewBundleDigest: approval.reviewBundleDigest,
    markdown: approvedMarkdown,
    label: 'approved migrated reconciliation review markdown',
  });
  const context = buildProductionAuthoringContextFromFrozenVisualPackageCandidate({
    repoRoot: args.repoRoot,
    storyKey: pendingManifest.source.storyKey,
    storyPath: pendingManifest.source.storyPath,
    templatePath: pendingManifest.migration.migratedTemplatePath,
    reconciliationPath: approval.reconciliationPath,
    styleId: args.styleId,
    styleAuthorityPath: args.styleAuthorityPath,
    ...(args.expectedStyleAuthorityDigest
      ? { expectedStyleAuthorityDigest: args.expectedStyleAuthorityDigest }
      : {}),
    frozenCandidate: source.candidate,
  });
  if (
    context.template.identity.digest !== approval.migratedTemplateDigest ||
    context.reconciliation.digest !== approval.reconciliationDigest ||
    context.reconciliation.content.review.reviewedBy !== 'Guy' ||
    context.reconciliation.content.review.reviewedAt !== approval.approvedAt
  ) {
    throw new Error('approved migration production context is stale');
  }
  const manifest = buildManifest({
    version: TIME_AUTHORITY_MIGRATION_MANIFEST_VERSION,
    stage: 'reconciliation_approved',
    source: structuredClone(pendingManifest.source),
    migration: structuredClone(pendingManifest.migration),
    reconciliation: {
      version: context.reconciliation.content.version,
      digest: context.reconciliation.digest,
      path: context.reconciliation.artifactPath,
      reviewBundleDigest: approval.reviewBundleDigest,
      reviewBundlePath: approval.reviewBundlePath,
      reviewMarkdownPath: approval.reviewMarkdownPath,
      status: 'approved',
      reviewedBy: 'Guy',
      reviewedAt: approval.approvedAt,
      approvalDigest: approval.digest,
      approvalPath: repoRelativePath(
        args.repoRoot,
        resolveRepoPath(args.repoRoot, args.approvalPath),
      ),
    },
    productionContext: {
      version: context.version,
      digest: context.digest,
      styleId: context.styleId,
      styleAuthorityPath: context.styleAuthority.identity.artifactPath,
      styleAuthorityDigest: context.styleAuthority.identity.digest,
    },
    doesNotAuthorize: [...TIME_AUTHORITY_MIGRATION_DOES_NOT_AUTHORIZE],
  });
  const manifestArtifact = persistJson({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'time-authority-migration-manifests',
    digest: manifest.digest,
    value: manifest,
    write: args.write,
  });
  return { manifest, manifestArtifact, context };
}

/**
 * Rebuild the approved production context from immutable migration evidence.
 *
 * The persisted manifest deliberately stores only the context identity. This
 * loader replays the existing advance boundary from its content-addressed
 * pending manifest and approval, then requires the reconstructed approved
 * manifest to be byte-identical to the supplied artifact. Downstream
 * lifecycles therefore never need an independently supplied context file.
 */
export function loadApprovedTimeAuthorityMigration(args: {
  repoRoot: string;
  approvedManifestPath: string;
}): {
  manifest: TimeAuthorityMigrationManifest;
  context: ProductionAuthoringContext;
  previousApproved: {
    blueprint: PreRenderBookVisualBlueprint;
    attestation: PreRenderBlueprintApprovalAttestation;
  };
  sourcePackage: {
    candidate: VisualPackageV4Candidate;
    packageReview: VisualPackageV4PackageReview;
    packageApproval: VisualPackageV4Approval;
  };
} {
  const approvedManifest = loadMigrationManifest({
    repoRoot: args.repoRoot,
    manifestPath: args.approvedManifestPath,
  });
  if (
    approvedManifest.stage !== 'reconciliation_approved' ||
    approvedManifest.productionContext === null ||
    approvedManifest.reconciliation.status !== 'approved' ||
    approvedManifest.reconciliation.approvalPath === null
  ) {
    throw new Error('time-authority migration reconciliation is not approved');
  }

  const approvedManifestAbsolute = resolveRepoPath(
    args.repoRoot,
    args.approvedManifestPath,
  );
  const outputRootAbsolute = path.dirname(path.dirname(approvedManifestAbsolute));
  const outputDir = repoRelativePath(args.repoRoot, outputRootAbsolute);
  const approval = readJsonObject<TimeAuthorityMigrationApproval>(
    resolveRepoPath(
      args.repoRoot,
      approvedManifest.reconciliation.approvalPath,
    ),
    'time-authority migration approval',
  );
  if (
    !timeAuthorityMigrationApprovalIsValid(approval) ||
    approval.digest !== approvedManifest.reconciliation.approvalDigest
  ) {
    throw new Error('approved migration manifest approval binding is invalid');
  }
  const pendingManifestPath = repoRelativePath(
    args.repoRoot,
    path.join(
      outputRootAbsolute,
      'time-authority-migration-manifests',
      `${approval.pendingManifestDigest}.json`,
    ),
  );
  const replay = advanceApprovedTimeAuthorityMigration({
    repoRoot: args.repoRoot,
    outputDir,
    pendingManifestPath,
    approvalPath: approvedManifest.reconciliation.approvalPath,
    styleId: approvedManifest.productionContext.styleId,
    styleAuthorityPath:
      approvedManifest.productionContext.styleAuthorityPath,
    expectedStyleAuthorityDigest:
      approvedManifest.productionContext.styleAuthorityDigest,
    write: false,
  });
  if (
    canonicalContentAddressedJsonBytes(replay.manifest) !==
      canonicalContentAddressedJsonBytes(approvedManifest) ||
    replay.context.version !== approvedManifest.productionContext.version ||
    replay.context.digest !== approvedManifest.productionContext.digest
  ) {
    throw new Error('approved migration manifest does not match its reconstructed context');
  }
  const source = loadSourceAuthority({
    repoRoot: args.repoRoot,
    sourcePackageCandidatePath:
      approvedManifest.source.sourcePackageCandidatePath,
    sourcePackageReviewPath: approvedManifest.source.sourcePackageReviewPath,
    sourcePackageApprovalPath:
      approvedManifest.source.sourcePackageApprovalPath,
  });
  return {
    manifest: approvedManifest,
    context: replay.context,
    previousApproved: {
      blueprint: structuredClone(source.candidate.content.blueprint.content),
      attestation: structuredClone(
        source.candidate.content.planningApproval.content,
      ),
    },
    sourcePackage: {
      candidate: structuredClone(source.candidate),
      packageReview: structuredClone(source.packageReview),
      packageApproval: structuredClone(source.packageApproval),
    },
  };
}
