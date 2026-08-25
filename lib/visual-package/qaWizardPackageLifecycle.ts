import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  canonicalContentAddressedJsonBytes,
  writeCanonicalContentAddressedJsonArtifact,
} from './canonicalContentAddressedJson';
import {
  canonicalJsonDigest,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  QA_WIZARD_BLUEPRINT_AUTHORING_MANIFEST_VERSION,
  loadQaWizardBlueprintAuthoringManifest,
  type QaWizardBlueprintAuthoringManifest,
} from './qaWizardBlueprintAuthoringLifecycle';
import {
  QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION,
  loadQaWizardApprovedProductionContext,
} from './qaWizardCandidateBridge';
import { writeImmutableLocalArtifact } from './preRenderBlueprintLifecycle';
import type { VisualPackageReviewReality } from './types';
import {
  VISUAL_PACKAGE_V4_APPROVAL_EXCLUSIONS,
  VISUAL_PACKAGE_V4_APPROVAL_VERSION,
  VISUAL_PACKAGE_V4_LOCATOR_VERSION,
  computeVisualPackageV4ApprovalDigest,
  loadCurrentVisualPackageV4,
  publishVisualPackageV4,
  visualPackageV4LocatorPath,
  type VisualPackageV4,
  type VisualPackageV4Approval,
  type VisualPackageV4Candidate,
  type VisualPackageV4Locator,
  type VisualPackageV4PackageReview,
} from './visualPackageV4';
import {
  assembleVisualPackageV4Candidate,
  finalizeApprovedVisualPackageV4,
  loadApprovedBlueprintLifecycle,
  persistVisualPackageV4CandidateReview,
  qualifyVisualPackageV4Candidate,
  visualPackageV4ApprovalIssues,
  type ApprovedBlueprintLifecyclePaths,
  type VisualPackageV4OfflineQualification,
} from './visualPackageV4Lifecycle';

export const QA_WIZARD_PACKAGE_LIFECYCLE_MANIFEST_VERSION =
  'qa-wizard-package-lifecycle-manifest/v1' as const;
export const QA_WIZARD_PACKAGE_APPROVAL_DECISION_VERSION =
  'qa-wizard-package-approval-decision/v1' as const;
export const QA_WIZARD_PACKAGE_PUBLICATION_CLAIM_VERSION =
  'qa-wizard-package-publication-claim/v1' as const;
export const QA_WIZARD_PACKAGE_LIFECYCLE_LEDGER_ROOT =
  'outputs/qa-wizard-package-lifecycle-ledger-v1' as const;

const DIGEST_ALGORITHM = 'canonical-json-sha256' as const;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const CANONICAL_UTC_MILLISECONDS =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const APPROVED_PACKAGES_DIR = 'visual-packages/approved' as const;

const BEFORE_APPROVAL_EXCLUSIONS = [
  'package_approval',
  'publication',
  'locator_update',
  'production_activation',
  'image_render',
  'audio_render',
  'database_write',
  'storage_write',
  'deployment',
  'release',
] as const;

const AFTER_APPROVAL_EXCLUSIONS = [
  'publication',
  'locator_update',
  'production_activation',
  'image_render',
  'audio_render',
  'database_write',
  'storage_write',
  'deployment',
  'release',
] as const;

const AFTER_PUBLICATION_EXCLUSIONS = [
  'image_render',
  'audio_render',
  'database_write',
  'storage_write',
  'deployment',
  'release',
] as const;

const MANIFEST_KEYS = [
  'approval',
  'approvedBlueprint',
  'bridge',
  'context',
  'digest',
  'digestAlgorithm',
  'doesNotAuthorize',
  'externalCounters',
  'locatorBefore',
  'package',
  'predecessor',
  'publication',
  'reviewReality',
  'stage',
  'version',
] as const;

export type QaWizardPackageLifecycleStage =
  | 'package_candidate'
  | 'package_approved'
  | 'package_published';

interface ManifestPredecessor {
  version: typeof QA_WIZARD_PACKAGE_LIFECYCLE_MANIFEST_VERSION;
  digest: string;
  path: string;
}

interface ManifestApprovedBlueprint {
  version: typeof QA_WIZARD_BLUEPRINT_AUTHORING_MANIFEST_VERSION;
  digest: string;
  path: string;
  blueprintDigest: string;
  authoringAuthorityDigest: string;
  planningApprovalDigest: string;
  planningApprovalPath: string;
}

interface ManifestBridge {
  version: typeof QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION;
  digest: string;
  path: string;
}

interface ManifestContext {
  version: string;
  digest: string;
}

interface ManifestPackage {
  candidateDigest: string;
  candidatePath: string;
  reviewDigest: string;
  reviewPath: string;
  qualificationDigest: string;
  approvedRevisionDigest: string | null;
}

export interface QaWizardPackageLocatorSnapshot {
  path: string;
  state: 'absent' | 'present';
  sha256: string | null;
  locator: VisualPackageV4Locator | null;
}

interface ManifestApproval {
  version: typeof VISUAL_PACKAGE_V4_APPROVAL_VERSION;
  digest: string;
  path: string;
  approvedBy: 'Guy';
  approvedAt: string;
  decisionPath: string;
}

interface ManifestPublication {
  publishedAt: string;
  claimDigest: string;
  claimPath: string;
  packagePath: string;
  packageSha256: string;
  locatorPath: string;
  locatorSha256: string;
  locatorChanged: boolean;
}

interface ManifestExternalCounters {
  providerCalls: 0;
  imageRenders: 0;
  audioRenders: 0;
  databaseWrites: 0;
  storageWrites: 0;
  locatorWrites: 0 | 1;
}

export interface QaWizardPackageLifecycleManifest {
  version: typeof QA_WIZARD_PACKAGE_LIFECYCLE_MANIFEST_VERSION;
  stage: QaWizardPackageLifecycleStage;
  predecessor: ManifestPredecessor | null;
  approvedBlueprint: ManifestApprovedBlueprint;
  bridge: ManifestBridge;
  context: ManifestContext;
  reviewReality: VisualPackageReviewReality;
  package: ManifestPackage;
  locatorBefore: QaWizardPackageLocatorSnapshot;
  approval: ManifestApproval | null;
  publication: ManifestPublication | null;
  externalCounters: ManifestExternalCounters;
  doesNotAuthorize: readonly string[];
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface QaWizardPackageApprovalDecision {
  version: typeof QA_WIZARD_PACKAGE_APPROVAL_DECISION_VERSION;
  candidateManifestDigest: string;
  candidateManifestPath: string;
  packageCandidateDigest: string;
  packageReviewDigest: string;
  approvalDigest: string;
  approvalPath: string;
  approvedManifestDigest: string;
  approvedManifestPath: string;
  approvedBy: 'Guy';
  approvedAt: string;
  note: string | null;
  scope: 'single_package_approval_decision';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface QaWizardPackagePublicationClaim {
  version: typeof QA_WIZARD_PACKAGE_PUBLICATION_CLAIM_VERSION;
  approvedManifestDigest: string;
  approvedManifestPath: string;
  packageCandidateDigest: string;
  packageReviewDigest: string;
  approvalDigest: string;
  publishedAt: string;
  locatorBefore: QaWizardPackageLocatorSnapshot;
  packageRevisionDigest: string;
  packagePath: string;
  packageSha256: string;
  locatorPath: string;
  locatorSha256: string;
  scope: 'single_canonical_package_publication';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface PreparedQaWizardPackageCandidate {
  manifest: QaWizardPackageLifecycleManifest;
  manifestPath: string;
  candidate: VisualPackageV4Candidate;
  packageReview: VisualPackageV4PackageReview;
  qualification: VisualPackageV4OfflineQualification;
  wrote: boolean;
}

export interface QaWizardPackageApprovalResult {
  manifest: QaWizardPackageLifecycleManifest;
  manifestPath: string;
  approval: VisualPackageV4Approval;
  approvalPath: string;
  decisionPath: string;
  packageValue: VisualPackageV4;
  wrote: boolean;
}

export interface QaWizardPackagePublicationResult {
  manifest: QaWizardPackageLifecycleManifest;
  manifestPath: string;
  packageValue: VisualPackageV4;
  packagePath: string;
  locator: VisualPackageV4Locator;
  locatorPath: string;
  locatorChanged: boolean;
  publicationClaimPath: string;
  wrote: boolean;
}

export interface QaWizardPackageLifecycleHooks {
  afterApprovalDecision?: () => void;
  afterPublicationClaim?: () => void;
  afterRevisionWrite?: () => void;
  afterLocatorWrite?: () => void;
}

interface CandidateAuthority {
  manifest: QaWizardPackageLifecycleManifest;
  manifestPath: string;
  outputDir: string;
  candidate: VisualPackageV4Candidate;
  packageReview: VisualPackageV4PackageReview;
  qualification: VisualPackageV4OfflineQualification;
}

interface ApprovedAuthority extends CandidateAuthority {
  approval: VisualPackageV4Approval;
  packageValue: VisualPackageV4;
  approvedManifest: QaWizardPackageLifecycleManifest;
  approvedManifestPath: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: unknown, expected: readonly string[]): boolean {
  return (
    record(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...expected].sort())
  );
}

function canonicalUtcTimestampIsValid(value: unknown): value is string {
  if (typeof value !== 'string' || !CANONICAL_UTC_MILLISECONDS.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function payloadWithoutDigest(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = value;
  return payload;
}

function withDigest<T extends object>(payload: T): T & {
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
} {
  return {
    ...payload,
    digestAlgorithm: DIGEST_ALGORITHM,
    digest: canonicalJsonDigest(payload),
  };
}

function manifestExclusions(
  stage: QaWizardPackageLifecycleStage,
): readonly string[] {
  if (stage === 'package_candidate') return BEFORE_APPROVAL_EXCLUSIONS;
  if (stage === 'package_approved') return AFTER_APPROVAL_EXCLUSIONS;
  return AFTER_PUBLICATION_EXCLUSIONS;
}

function counters(locatorWrites: 0 | 1): ManifestExternalCounters {
  return {
    providerCalls: 0,
    imageRenders: 0,
    audioRenders: 0,
    databaseWrites: 0,
    storageWrites: 0,
    locatorWrites,
  };
}

function buildManifest(
  payload: Omit<
    QaWizardPackageLifecycleManifest,
    'digestAlgorithm' | 'digest'
  >,
): QaWizardPackageLifecycleManifest {
  return withDigest(payload);
}

function artifactPath(args: {
  repoRoot: string;
  outputDir: string;
  category: string;
  fileName: string;
}): string {
  return repoRelativePath(
    args.repoRoot,
    path.join(
      resolveRepoPath(args.repoRoot, args.outputDir),
      args.category,
      args.fileName,
    ),
  );
}

function outputDirFromManifestPath(manifestPath: string): string {
  const normalized = manifestPath.replace(/\\/g, '/');
  if (
    path.posix.basename(path.posix.dirname(normalized)) !==
    'package-lifecycle-manifests'
  ) {
    throw new Error('Package lifecycle manifest path is outside its canonical category');
  }
  return path.posix.dirname(path.posix.dirname(normalized));
}

function sameOutputDir(args: {
  repoRoot: string;
  outputDir: string;
  manifestPath: string;
}): string {
  const requested = repoRelativePath(
    args.repoRoot,
    resolveRepoPath(args.repoRoot, args.outputDir),
  );
  const manifested = outputDirFromManifestPath(args.manifestPath);
  if (requested !== manifested) {
    throw new Error('Package lifecycle outputDir differs from the manifest authority root');
  }
  return requested;
}

function readContainedUtf8(args: {
  repoRoot: string;
  artifactPath: string;
  label: string;
}): { absolutePath: string; bytes: string } {
  const absolutePath = resolveRepoPath(args.repoRoot, args.artifactPath);
  if (!fs.existsSync(absolutePath)) throw new Error(`${args.label} is missing`);
  const stat = fs.lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
    throw new Error(`${args.label} must be one unique contained regular file`);
  }
  const real = fs.realpathSync(absolutePath);
  repoRelativePath(args.repoRoot, real);
  if (path.resolve(real).toLowerCase() !== path.resolve(absolutePath).toLowerCase()) {
    throw new Error(`${args.label} path identity is invalid`);
  }
  return { absolutePath, bytes: fs.readFileSync(absolutePath, 'utf8') };
}

function readJson<T>(args: {
  repoRoot: string;
  artifactPath: string;
  label: string;
}): { absolutePath: string; bytes: string; value: T } {
  const loaded = readContainedUtf8(args);
  let value: unknown;
  try {
    value = JSON.parse(loaded.bytes) as unknown;
  } catch {
    throw new Error(`${args.label} JSON is invalid`);
  }
  if (!record(value)) throw new Error(`${args.label} must be a JSON object`);
  return { ...loaded, value: value as T };
}

function persistCanonical(args: {
  repoRoot: string;
  artifactPath: string;
  value: unknown;
  write: boolean;
}): { created: boolean } {
  const absolutePath = resolveRepoPath(args.repoRoot, args.artifactPath);
  return args.write
    ? writeCanonicalContentAddressedJsonArtifact({
        destinationPath: absolutePath,
        value: args.value,
      })
    : { created: false };
}

function assertPrettyArtifact<T>(args: {
  repoRoot: string;
  artifactPath: string;
  expected: T;
  label: string;
}): void {
  const loaded = readContainedUtf8(args);
  if (loaded.bytes !== `${JSON.stringify(args.expected, null, 2)}\n`) {
    throw new Error(`${args.label} bytes changed after review`);
  }
}

function manifestPath(args: {
  repoRoot: string;
  outputDir: string;
  manifest: QaWizardPackageLifecycleManifest;
}): string {
  return artifactPath({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'package-lifecycle-manifests',
    fileName: `${args.manifest.digest}.json`,
  });
}

function approvalDecisionPath(args: {
  repoRoot: string;
  candidateDigest: string;
}): string {
  return artifactPath({
    repoRoot: args.repoRoot,
    outputDir: QA_WIZARD_PACKAGE_LIFECYCLE_LEDGER_ROOT,
    category: 'approval-decisions',
    fileName: `${args.candidateDigest}.json`,
  });
}

function publicationClaimPath(args: {
  repoRoot: string;
  candidateDigest: string;
}): string {
  return artifactPath({
    repoRoot: args.repoRoot,
    outputDir: QA_WIZARD_PACKAGE_LIFECYCLE_LEDGER_ROOT,
    category: 'publication-claims',
    fileName: `${args.candidateDigest}.json`,
  });
}

function packageApprovalPath(args: {
  repoRoot: string;
  outputDir: string;
  candidateDigest: string;
  approvalDigest: string;
}): string {
  return artifactPath({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'package-approvals',
    fileName: `${args.candidateDigest}/${args.approvalDigest}.json`,
  });
}

function locatorSnapshot(args: {
  repoRoot: string;
  storyKey: string;
  styleId: string;
}): QaWizardPackageLocatorSnapshot {
  const locatorPath = visualPackageV4LocatorPath({
    repoRoot: args.repoRoot,
    storyKey: args.storyKey,
    styleId: args.styleId,
  });
  const absolutePath = resolveRepoPath(args.repoRoot, locatorPath);
  if (!fs.existsSync(absolutePath)) {
    return { path: locatorPath, state: 'absent', sha256: null, locator: null };
  }
  const bytes = fs.readFileSync(absolutePath, 'utf8');
  const selected = loadCurrentVisualPackageV4({
    repoRoot: args.repoRoot,
    locatorPath,
    storyKey: args.storyKey,
    styleId: args.styleId,
  });
  return {
    path: locatorPath,
    state: 'present',
    sha256: sha256(bytes),
    locator: structuredClone(selected.locator),
  };
}

function locatorSnapshotIsValid(value: QaWizardPackageLocatorSnapshot): boolean {
  if (!exactKeys(value, ['locator', 'path', 'sha256', 'state'])) return false;
  if (typeof value.path !== 'string') return false;
  if (value.state === 'absent') {
    return value.sha256 === null && value.locator === null;
  }
  return (
    value.state === 'present' &&
    typeof value.sha256 === 'string' &&
    SHA256_HEX.test(value.sha256) &&
    exactKeys(value.locator, [
      'packagePath',
      'revisionDigest',
      'storyKey',
      'styleId',
      'version',
    ]) &&
    value.locator?.version === VISUAL_PACKAGE_V4_LOCATOR_VERSION &&
    typeof value.locator.storyKey === 'string' &&
    typeof value.locator.styleId === 'string' &&
    typeof value.locator.packagePath === 'string' &&
    SHA256_HEX.test(value.locator.revisionDigest)
  );
}

function snapshotMatchesCurrent(args: {
  repoRoot: string;
  snapshot: QaWizardPackageLocatorSnapshot;
  storyKey: string;
  styleId: string;
}): boolean {
  const absolutePath = resolveRepoPath(args.repoRoot, args.snapshot.path);
  if (args.snapshot.state === 'absent') return !fs.existsSync(absolutePath);
  if (
    !fs.existsSync(absolutePath) ||
    sha256(fs.readFileSync(absolutePath, 'utf8')) !== args.snapshot.sha256 ||
    args.snapshot.locator === null
  ) {
    return false;
  }
  try {
    const selected = loadCurrentVisualPackageV4({
      repoRoot: args.repoRoot,
      locatorPath: args.snapshot.path,
      storyKey: args.storyKey,
      styleId: args.styleId,
    });
    return (
      canonicalJsonDigest(selected.locator) ===
      canonicalJsonDigest(args.snapshot.locator)
    );
  } catch {
    return false;
  }
}

function approvedBlueprintPaths(
  manifest: QaWizardBlueprintAuthoringManifest,
): ApprovedBlueprintLifecyclePaths {
  if (manifest.stage !== 'blueprint_approved' || !manifest.blueprint || !manifest.approval) {
    throw new Error('Package preparation requires an exact blueprint_approved manifest');
  }
  return {
    blueprintPath: manifest.blueprint.candidatePath,
    authoringProvenancePath: manifest.blueprint.provenancePath,
    validationEvidencePath: manifest.blueprint.validationEvidencePath,
    reviewPacketPath: manifest.blueprint.reviewPacketPath,
    planningApprovalPath: manifest.approval.path,
  };
}

function buildCandidateAuthority(args: {
  repoRoot: string;
  approvedBlueprintManifestPath: string;
  outputDir: string;
  worldMode: NonNullable<VisualPackageReviewReality['worldMode']>;
  reviewedBy: 'Guy';
  reviewedAt: string;
  locatorBefore?: QaWizardPackageLocatorSnapshot;
}): PreparedQaWizardPackageCandidate {
  if (
    args.reviewedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(args.reviewedAt) ||
    !['grounded', 'grounded_with_visual_metaphor', 'fantastical'].includes(
      args.worldMode,
    )
  ) {
    throw new Error(
      'Package review requires exact Guy, canonical UTC time, and a supported worldMode',
    );
  }
  const outputDir = repoRelativePath(
    args.repoRoot,
    resolveRepoPath(args.repoRoot, args.outputDir),
  );
  const blueprintManifest = loadQaWizardBlueprintAuthoringManifest({
    repoRoot: args.repoRoot,
    manifestPath: args.approvedBlueprintManifestPath,
  });
  const paths = approvedBlueprintPaths(blueprintManifest);
  const loadedContext = loadQaWizardApprovedProductionContext({
    repoRoot: args.repoRoot,
    bridgeManifestPath: blueprintManifest.bridge.path,
  });
  if (
    loadedContext.manifest.version !== blueprintManifest.bridge.version ||
    loadedContext.manifest.digest !== blueprintManifest.bridge.digest ||
    loadedContext.context.version !== blueprintManifest.context.version ||
    loadedContext.context.digest !== blueprintManifest.context.digest
  ) {
    throw new Error('Approved Blueprint bridge or production context is stale');
  }
  const approvedBlueprint = loadApprovedBlueprintLifecycle({
    repoRoot: args.repoRoot,
    context: loadedContext.context,
    paths,
  });
  if (
    !blueprintManifest.blueprint ||
    !blueprintManifest.approval ||
    approvedBlueprint.blueprint.content.digest !==
      blueprintManifest.blueprint.blueprintDigest ||
    approvedBlueprint.blueprint.content.identity.authoringAuthority.digest !==
      blueprintManifest.blueprint.authoringAuthorityDigest ||
    approvedBlueprint.planningApproval.content.digest !==
      blueprintManifest.approval.digest ||
    approvedBlueprint.planningApproval.artifactPath !==
      blueprintManifest.approval.path
  ) {
    throw new Error('Approved Blueprint artifacts do not match their manifest');
  }
  const authoredBy = approvedBlueprint.authoringProvenance.content.model;
  if (!authoredBy?.trim()) {
    throw new Error('Approved Blueprint authoring provenance has no model identity');
  }
  const reviewReality: VisualPackageReviewReality = {
    authoredBy,
    reviewedBy: args.reviewedBy,
    reviewedAt: args.reviewedAt,
    worldMode: args.worldMode,
  };
  const assembled = assembleVisualPackageV4Candidate({
    repoRoot: args.repoRoot,
    context: loadedContext.context,
    approvedBlueprintPaths: paths,
    review: reviewReality,
  });
  const qualification = qualifyVisualPackageV4Candidate({
    repoRoot: args.repoRoot,
    candidate: assembled.candidate,
    packageReview: assembled.packageReview,
    approval: null,
  });
  if (
    !qualification.candidateValid ||
    !qualification.reviewReady ||
    qualification.approvalValid ||
    qualification.readyForPublication ||
    qualification.zeroWrite !== true ||
    qualification.reasons.length !== 1 ||
    qualification.reasons[0]?.code !== 'package_approval_missing'
  ) {
    throw new Error('Assembled package is not exactly ready for package approval');
  }
  const persistencePlan = persistVisualPackageV4CandidateReview({
    repoRoot: args.repoRoot,
    outputDir,
    candidate: assembled.candidate,
    packageReview: assembled.packageReview,
    write: false,
  });
  const locatorBefore = args.locatorBefore
    ? structuredClone(args.locatorBefore)
    : locatorSnapshot({
        repoRoot: args.repoRoot,
        storyKey: assembled.candidate.content.storyKey,
        styleId: assembled.candidate.content.styleId,
      });
  if (
    !locatorSnapshotIsValid(locatorBefore) ||
    locatorBefore.path !==
      visualPackageV4LocatorPath({
        repoRoot: args.repoRoot,
        storyKey: assembled.candidate.content.storyKey,
        styleId: assembled.candidate.content.styleId,
      })
  ) {
    throw new Error('Reviewed predecessor locator snapshot is invalid');
  }
  const manifest = buildManifest({
    version: QA_WIZARD_PACKAGE_LIFECYCLE_MANIFEST_VERSION,
    stage: 'package_candidate',
    predecessor: null,
    approvedBlueprint: {
      version: blueprintManifest.version,
      digest: blueprintManifest.digest,
      path: args.approvedBlueprintManifestPath,
      blueprintDigest: approvedBlueprint.blueprint.content.digest,
      authoringAuthorityDigest:
        approvedBlueprint.blueprint.content.identity.authoringAuthority.digest,
      planningApprovalDigest: approvedBlueprint.planningApproval.content.digest,
      planningApprovalPath: approvedBlueprint.planningApproval.artifactPath,
    },
    bridge: {
      version: loadedContext.manifest.version,
      digest: loadedContext.manifest.digest,
      path: blueprintManifest.bridge.path,
    },
    context: {
      version: loadedContext.context.version,
      digest: loadedContext.context.digest,
    },
    reviewReality,
    package: {
      candidateDigest: assembled.candidate.digest,
      candidatePath: persistencePlan.candidatePath,
      reviewDigest: assembled.packageReview.digest,
      reviewPath: persistencePlan.packageReviewPath,
      qualificationDigest: qualification.digest,
      approvedRevisionDigest: null,
    },
    locatorBefore,
    approval: null,
    publication: null,
    externalCounters: counters(0),
    doesNotAuthorize: manifestExclusions('package_candidate'),
  });
  return {
    manifest,
    manifestPath: manifestPath({ repoRoot: args.repoRoot, outputDir, manifest }),
    candidate: assembled.candidate,
    packageReview: assembled.packageReview,
    qualification,
    wrote: false,
  };
}

export function prepareQaWizardPackageCandidate(args: {
  repoRoot: string;
  approvedBlueprintManifestPath: string;
  outputDir: string;
  worldMode: NonNullable<VisualPackageReviewReality['worldMode']>;
  reviewedBy: 'Guy';
  reviewedAt: string;
  write?: boolean;
}): PreparedQaWizardPackageCandidate {
  const prepared = buildCandidateAuthority(args);
  if (args.write === true) {
    const persisted = persistVisualPackageV4CandidateReview({
      repoRoot: args.repoRoot,
      outputDir: args.outputDir,
      candidate: prepared.candidate,
      packageReview: prepared.packageReview,
      write: true,
    });
    if (
      persisted.candidatePath !== prepared.manifest.package.candidatePath ||
      persisted.packageReviewPath !== prepared.manifest.package.reviewPath
    ) {
      throw new Error('Persisted package artifacts differ from their preflight');
    }
    persistCanonical({
      repoRoot: args.repoRoot,
      artifactPath: prepared.manifestPath,
      value: prepared.manifest,
      write: true,
    });
  }
  return { ...prepared, wrote: args.write === true };
}

function manifestShapeIsValid(
  value: unknown,
): value is QaWizardPackageLifecycleManifest {
  try {
    if (!exactKeys(value, MANIFEST_KEYS)) return false;
    const manifest = value as QaWizardPackageLifecycleManifest;
    const stageValid = [
      'package_candidate',
      'package_approved',
      'package_published',
    ].includes(manifest.stage);
    if (
      manifest.version !== QA_WIZARD_PACKAGE_LIFECYCLE_MANIFEST_VERSION ||
      !stageValid ||
      manifest.digestAlgorithm !== DIGEST_ALGORITHM ||
      !SHA256_HEX.test(manifest.digest) ||
      manifest.digest !==
        canonicalJsonDigest(
          payloadWithoutDigest(value as Record<string, unknown>),
        ) ||
      JSON.stringify(manifest.doesNotAuthorize) !==
        JSON.stringify(manifestExclusions(manifest.stage)) ||
      !exactKeys(manifest.approvedBlueprint, [
        'authoringAuthorityDigest',
        'blueprintDigest',
        'digest',
        'path',
        'planningApprovalDigest',
        'planningApprovalPath',
        'version',
      ]) ||
      manifest.approvedBlueprint.version !==
        QA_WIZARD_BLUEPRINT_AUTHORING_MANIFEST_VERSION ||
      ![
        manifest.approvedBlueprint.digest,
        manifest.approvedBlueprint.blueprintDigest,
        manifest.approvedBlueprint.authoringAuthorityDigest,
        manifest.approvedBlueprint.planningApprovalDigest,
      ].every((entry) => SHA256_HEX.test(entry)) ||
      !exactKeys(manifest.bridge, ['digest', 'path', 'version']) ||
      manifest.bridge.version !== QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION ||
      !SHA256_HEX.test(manifest.bridge.digest) ||
      !exactKeys(manifest.context, ['digest', 'version']) ||
      !SHA256_HEX.test(manifest.context.digest) ||
      !exactKeys(manifest.reviewReality, [
        'authoredBy',
        'reviewedAt',
        'reviewedBy',
        'worldMode',
      ]) ||
      manifest.reviewReality.reviewedBy !== 'Guy' ||
      !canonicalUtcTimestampIsValid(manifest.reviewReality.reviewedAt) ||
      !exactKeys(manifest.package, [
        'approvedRevisionDigest',
        'candidateDigest',
        'candidatePath',
        'qualificationDigest',
        'reviewDigest',
        'reviewPath',
      ]) ||
      ![
        manifest.package.candidateDigest,
        manifest.package.reviewDigest,
        manifest.package.qualificationDigest,
      ].every((entry) => SHA256_HEX.test(entry)) ||
      !locatorSnapshotIsValid(manifest.locatorBefore) ||
      !exactKeys(manifest.externalCounters, [
        'audioRenders',
        'databaseWrites',
        'imageRenders',
        'locatorWrites',
        'providerCalls',
        'storageWrites',
      ]) ||
      canonicalJsonDigest(manifest.externalCounters) !==
        canonicalJsonDigest(
          counters(manifest.stage === 'package_published' ? 1 : 0),
        )
    ) {
      return false;
    }
    if (manifest.stage === 'package_candidate') {
      return (
        manifest.predecessor === null &&
        manifest.approval === null &&
        manifest.publication === null &&
        manifest.package.approvedRevisionDigest === null
      );
    }
    if (
      !exactKeys(manifest.predecessor, ['digest', 'path', 'version']) ||
      manifest.predecessor?.version !==
        QA_WIZARD_PACKAGE_LIFECYCLE_MANIFEST_VERSION ||
      !SHA256_HEX.test(manifest.predecessor.digest) ||
      !exactKeys(manifest.approval, [
        'approvedAt',
        'approvedBy',
        'decisionPath',
        'digest',
        'path',
        'version',
      ]) ||
      manifest.approval?.version !== VISUAL_PACKAGE_V4_APPROVAL_VERSION ||
      manifest.approval.approvedBy !== 'Guy' ||
      !canonicalUtcTimestampIsValid(manifest.approval.approvedAt) ||
      !SHA256_HEX.test(manifest.approval.digest) ||
      manifest.package.approvedRevisionDigest === null ||
      !SHA256_HEX.test(manifest.package.approvedRevisionDigest)
    ) {
      return false;
    }
    if (manifest.stage === 'package_approved') {
      return manifest.publication === null;
    }
    return (
      exactKeys(manifest.publication, [
        'claimDigest',
        'claimPath',
        'locatorChanged',
        'locatorPath',
        'locatorSha256',
        'packagePath',
        'packageSha256',
        'publishedAt',
      ]) &&
      canonicalUtcTimestampIsValid(manifest.publication?.publishedAt) &&
      SHA256_HEX.test(manifest.publication.claimDigest) &&
      SHA256_HEX.test(manifest.publication.locatorSha256) &&
      SHA256_HEX.test(manifest.publication.packageSha256) &&
      typeof manifest.publication.locatorChanged === 'boolean'
    );
  } catch {
    return false;
  }
}

export function loadQaWizardPackageLifecycleManifest(args: {
  repoRoot: string;
  manifestPath: string;
}): QaWizardPackageLifecycleManifest {
  const loaded = readJson<QaWizardPackageLifecycleManifest>({
    repoRoot: args.repoRoot,
    artifactPath: args.manifestPath,
    label: 'QA Wizard package lifecycle manifest',
  });
  if (
    !manifestShapeIsValid(loaded.value) ||
    path.basename(loaded.absolutePath) !== `${loaded.value.digest}.json` ||
    path.basename(path.dirname(loaded.absolutePath)) !==
      'package-lifecycle-manifests' ||
    loaded.bytes !== canonicalContentAddressedJsonBytes(loaded.value)
  ) {
    throw new Error('QA Wizard package lifecycle manifest is invalid');
  }
  return loaded.value;
}

function loadCandidateAuthority(args: {
  repoRoot: string;
  manifestPath: string;
}): CandidateAuthority {
  const manifest = loadQaWizardPackageLifecycleManifest(args);
  if (manifest.stage !== 'package_candidate') {
    throw new Error('Package approval requires a package_candidate manifest');
  }
  const outputDir = outputDirFromManifestPath(args.manifestPath);
  const replay = buildCandidateAuthority({
    repoRoot: args.repoRoot,
    approvedBlueprintManifestPath: manifest.approvedBlueprint.path,
    outputDir,
    worldMode: manifest.reviewReality.worldMode as NonNullable<
      VisualPackageReviewReality['worldMode']
    >,
    reviewedBy: manifest.reviewReality.reviewedBy as 'Guy',
    reviewedAt: manifest.reviewReality.reviewedAt as string,
    locatorBefore: manifest.locatorBefore,
  });
  if (
    replay.manifestPath !== args.manifestPath ||
    canonicalContentAddressedJsonBytes(replay.manifest) !==
      canonicalContentAddressedJsonBytes(manifest)
  ) {
    throw new Error('Package candidate manifest does not replay exactly');
  }
  assertPrettyArtifact({
    repoRoot: args.repoRoot,
    artifactPath: manifest.package.candidatePath,
    expected: replay.candidate,
    label: 'Package candidate',
  });
  assertPrettyArtifact({
    repoRoot: args.repoRoot,
    artifactPath: manifest.package.reviewPath,
    expected: replay.packageReview,
    label: 'Package review',
  });
  return {
    manifest,
    manifestPath: args.manifestPath,
    outputDir,
    candidate: replay.candidate,
    packageReview: replay.packageReview,
    qualification: replay.qualification,
  };
}

function buildApproval(args: {
  candidate: VisualPackageV4Candidate;
  packageReview: VisualPackageV4PackageReview;
  approvedBy: 'Guy';
  approvedAt: string;
  note?: string;
}): VisualPackageV4Approval {
  const approval: VisualPackageV4Approval = {
    version: VISUAL_PACKAGE_V4_APPROVAL_VERSION,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
    scope: 'immutable_runtime_authority_promotion',
    blueprintApprovalDigest:
      args.candidate.content.planningApproval.content.digest,
    packageCandidateDigest: args.candidate.digest,
    packageReviewDigest: args.packageReview.digest,
    doesNotAuthorize: VISUAL_PACKAGE_V4_APPROVAL_EXCLUSIONS,
    ...(args.note?.trim() ? { note: args.note } : {}),
    digestAlgorithm: DIGEST_ALGORITHM,
    digest: '',
  };
  approval.digest = computeVisualPackageV4ApprovalDigest(approval);
  return approval;
}

function approvedManifestFor(args: {
  candidateAuthority: CandidateAuthority;
  approval: VisualPackageV4Approval;
  approvalPath: string;
  decisionPath: string;
  packageValue: VisualPackageV4;
}): QaWizardPackageLifecycleManifest {
  const candidateManifest = args.candidateAuthority.manifest;
  return buildManifest({
    version: QA_WIZARD_PACKAGE_LIFECYCLE_MANIFEST_VERSION,
    stage: 'package_approved',
    predecessor: {
      version: candidateManifest.version,
      digest: candidateManifest.digest,
      path: args.candidateAuthority.manifestPath,
    },
    approvedBlueprint: structuredClone(candidateManifest.approvedBlueprint),
    bridge: structuredClone(candidateManifest.bridge),
    context: structuredClone(candidateManifest.context),
    reviewReality: structuredClone(candidateManifest.reviewReality),
    package: {
      ...structuredClone(candidateManifest.package),
      approvedRevisionDigest: args.packageValue.revisionDigest,
    },
    locatorBefore: structuredClone(candidateManifest.locatorBefore),
    approval: {
      version: args.approval.version,
      digest: args.approval.digest,
      path: args.approvalPath,
      approvedBy: args.approval.approvedBy,
      approvedAt: args.approval.approvedAt,
      decisionPath: args.decisionPath,
    },
    publication: null,
    externalCounters: counters(0),
    doesNotAuthorize: manifestExclusions('package_approved'),
  });
}

function approvalDecisionFor(args: {
  candidateAuthority: CandidateAuthority;
  approval: VisualPackageV4Approval;
  approvalPath: string;
  approvedManifest: QaWizardPackageLifecycleManifest;
  approvedManifestPath: string;
}): QaWizardPackageApprovalDecision {
  return withDigest({
    version: QA_WIZARD_PACKAGE_APPROVAL_DECISION_VERSION,
    candidateManifestDigest: args.candidateAuthority.manifest.digest,
    candidateManifestPath: args.candidateAuthority.manifestPath,
    packageCandidateDigest: args.candidateAuthority.candidate.digest,
    packageReviewDigest: args.candidateAuthority.packageReview.digest,
    approvalDigest: args.approval.digest,
    approvalPath: args.approvalPath,
    approvedManifestDigest: args.approvedManifest.digest,
    approvedManifestPath: args.approvedManifestPath,
    approvedBy: args.approval.approvedBy,
    approvedAt: args.approval.approvedAt,
    note: args.approval.note ?? null,
    scope: 'single_package_approval_decision' as const,
  });
}

function assertCompatibleIfPresent(args: {
  repoRoot: string;
  artifactPath: string;
  expectedBytes: string;
  label: string;
}): void {
  const absolutePath = resolveRepoPath(args.repoRoot, args.artifactPath);
  if (
    fs.existsSync(absolutePath) &&
    fs.readFileSync(absolutePath, 'utf8') !== args.expectedBytes
  ) {
    throw new Error(`${args.label} conflicts with the requested immutable authority`);
  }
}

export function recordQaWizardPackageApproval(
  args: {
    repoRoot: string;
    candidateManifestPath: string;
    outputDir: string;
    expectedPackageCandidateDigest: string;
    expectedPackageReviewDigest: string;
    approvedBy: 'Guy';
    approvedAt: string;
    note?: string;
    write?: boolean;
  },
  hooks: QaWizardPackageLifecycleHooks = {},
): QaWizardPackageApprovalResult {
  if (
    args.approvedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(args.approvedAt)
  ) {
    throw new Error('Package approval requires exact Guy and canonical UTC time');
  }
  const candidateAuthority = loadCandidateAuthority({
    repoRoot: args.repoRoot,
    manifestPath: args.candidateManifestPath,
  });
  sameOutputDir({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    manifestPath: args.candidateManifestPath,
  });
  if (
    args.expectedPackageCandidateDigest !== candidateAuthority.candidate.digest ||
    args.expectedPackageReviewDigest !== candidateAuthority.packageReview.digest
  ) {
    throw new Error('Package approval does not bind the reviewed candidate and review');
  }
  if (
    !snapshotMatchesCurrent({
      repoRoot: args.repoRoot,
      snapshot: candidateAuthority.manifest.locatorBefore,
      storyKey: candidateAuthority.candidate.content.storyKey,
      styleId: candidateAuthority.candidate.content.styleId,
    })
  ) {
    throw new Error('Current package locator changed after package review');
  }
  const approval = buildApproval({
    candidate: candidateAuthority.candidate,
    packageReview: candidateAuthority.packageReview,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
    note: args.note,
  });
  const qualification = qualifyVisualPackageV4Candidate({
    repoRoot: args.repoRoot,
    candidate: candidateAuthority.candidate,
    packageReview: candidateAuthority.packageReview,
    approval,
  });
  if (
    visualPackageV4ApprovalIssues({
      candidate: candidateAuthority.candidate,
      packageReview: candidateAuthority.packageReview,
      approval,
    }).length > 0 ||
    !qualification.candidateValid ||
    !qualification.reviewReady ||
    !qualification.approvalValid ||
    !qualification.readyForPublication ||
    qualification.reasons.length !== 0
  ) {
    throw new Error('Exact package approval does not make the package publishable');
  }
  const packageValue = finalizeApprovedVisualPackageV4({
    repoRoot: args.repoRoot,
    candidate: candidateAuthority.candidate,
    packageReview: candidateAuthority.packageReview,
    packageReviewArtifactPath: candidateAuthority.manifest.package.reviewPath,
    approval,
  });
  const approvalPath = packageApprovalPath({
    repoRoot: args.repoRoot,
    outputDir: candidateAuthority.outputDir,
    candidateDigest: candidateAuthority.candidate.digest,
    approvalDigest: approval.digest,
  });
  const decisionPath = approvalDecisionPath({
    repoRoot: args.repoRoot,
    candidateDigest: candidateAuthority.candidate.digest,
  });
  const approvedManifest = approvedManifestFor({
    candidateAuthority,
    approval,
    approvalPath,
    decisionPath,
    packageValue,
  });
  const approvedManifestPath = manifestPath({
    repoRoot: args.repoRoot,
    outputDir: candidateAuthority.outputDir,
    manifest: approvedManifest,
  });
  const decision = approvalDecisionFor({
    candidateAuthority,
    approval,
    approvalPath,
    approvedManifest,
    approvedManifestPath,
  });
  const planned = [
    {
      path: decisionPath,
      bytes: canonicalContentAddressedJsonBytes(decision),
      label: 'Package approval decision',
    },
    {
      path: approvalPath,
      bytes: canonicalContentAddressedJsonBytes(approval),
      label: 'Package approval',
    },
    {
      path: approvedManifestPath,
      bytes: canonicalContentAddressedJsonBytes(approvedManifest),
      label: 'Approved package manifest',
    },
  ];
  for (const artifact of planned) {
    assertCompatibleIfPresent({
      repoRoot: args.repoRoot,
      artifactPath: artifact.path,
      expectedBytes: artifact.bytes,
      label: artifact.label,
    });
  }
  if (args.write === true) {
    persistCanonical({
      repoRoot: args.repoRoot,
      artifactPath: decisionPath,
      value: decision,
      write: true,
    });
    hooks.afterApprovalDecision?.();
    persistCanonical({
      repoRoot: args.repoRoot,
      artifactPath: approvalPath,
      value: approval,
      write: true,
    });
    persistCanonical({
      repoRoot: args.repoRoot,
      artifactPath: approvedManifestPath,
      value: approvedManifest,
      write: true,
    });
  }
  return {
    manifest: approvedManifest,
    manifestPath: approvedManifestPath,
    approval,
    approvalPath,
    decisionPath,
    packageValue,
    wrote: args.write === true,
  };
}

function loadApprovedAuthority(args: {
  repoRoot: string;
  manifestPath: string;
}): ApprovedAuthority {
  const approvedManifest = loadQaWizardPackageLifecycleManifest(args);
  if (
    approvedManifest.stage !== 'package_approved' ||
    !approvedManifest.predecessor ||
    !approvedManifest.approval
  ) {
    throw new Error('Package publication requires a package_approved manifest');
  }
  const candidateAuthority = loadCandidateAuthority({
    repoRoot: args.repoRoot,
    manifestPath: approvedManifest.predecessor.path,
  });
  if (
    approvedManifest.predecessor.digest !== candidateAuthority.manifest.digest ||
    approvedManifest.predecessor.version !== candidateAuthority.manifest.version ||
    outputDirFromManifestPath(args.manifestPath) !== candidateAuthority.outputDir
  ) {
    throw new Error('Approved package predecessor is stale or substituted');
  }
  const approvalArtifact = readJson<VisualPackageV4Approval>({
    repoRoot: args.repoRoot,
    artifactPath: approvedManifest.approval.path,
    label: 'Package approval',
  });
  const approval = approvalArtifact.value;
  const expectedApprovalKeys = [
    'approvedAt',
    'approvedBy',
    'blueprintApprovalDigest',
    'digest',
    'digestAlgorithm',
    'doesNotAuthorize',
    'packageCandidateDigest',
    'packageReviewDigest',
    'scope',
    'version',
    ...(approval.note === undefined ? [] : ['note']),
  ];
  if (
    !exactKeys(approval, expectedApprovalKeys) ||
    approvalArtifact.bytes !== canonicalContentAddressedJsonBytes(approval) ||
    approvedManifest.approval.digest !== approval.digest ||
    approvedManifest.approval.version !== approval.version ||
    approvedManifest.approval.approvedBy !== approval.approvedBy ||
    approvedManifest.approval.approvedAt !== approval.approvedAt ||
    packageApprovalPath({
      repoRoot: args.repoRoot,
      outputDir: candidateAuthority.outputDir,
      candidateDigest: candidateAuthority.candidate.digest,
      approvalDigest: approval.digest,
    }) !== approvedManifest.approval.path ||
    visualPackageV4ApprovalIssues({
      candidate: candidateAuthority.candidate,
      packageReview: candidateAuthority.packageReview,
      approval,
    }).length > 0
  ) {
    throw new Error('Package approval artifact is stale or noncanonical');
  }
  const packageValue = finalizeApprovedVisualPackageV4({
    repoRoot: args.repoRoot,
    candidate: candidateAuthority.candidate,
    packageReview: candidateAuthority.packageReview,
    packageReviewArtifactPath: candidateAuthority.manifest.package.reviewPath,
    approval,
  });
  const expectedApprovedManifest = approvedManifestFor({
    candidateAuthority,
    approval,
    approvalPath: approvedManifest.approval.path,
    decisionPath: approvedManifest.approval.decisionPath,
    packageValue,
  });
  if (
    expectedApprovedManifest.digest !== approvedManifest.digest ||
    canonicalContentAddressedJsonBytes(expectedApprovedManifest) !==
      canonicalContentAddressedJsonBytes(approvedManifest) ||
    approvedManifest.package.approvedRevisionDigest !== packageValue.revisionDigest
  ) {
    throw new Error('Approved package manifest does not replay exactly');
  }
  const expectedDecision = approvalDecisionFor({
    candidateAuthority,
    approval,
    approvalPath: approvedManifest.approval.path,
    approvedManifest,
    approvedManifestPath: args.manifestPath,
  });
  const decision = readJson<QaWizardPackageApprovalDecision>({
    repoRoot: args.repoRoot,
    artifactPath: approvedManifest.approval.decisionPath,
    label: 'Package approval decision',
  });
  if (
    approvalDecisionPath({
      repoRoot: args.repoRoot,
      candidateDigest: candidateAuthority.candidate.digest,
    }) !== approvedManifest.approval.decisionPath ||
    decision.bytes !== canonicalContentAddressedJsonBytes(expectedDecision)
  ) {
    throw new Error('Package approval decision is stale or conflicting');
  }
  return {
    ...candidateAuthority,
    approval,
    packageValue,
    approvedManifest,
    approvedManifestPath: args.manifestPath,
  };
}

function publicationClaimFor(args: {
  authority: ApprovedAuthority;
  publishedAt: string;
  packagePath: string;
  packageSha256: string;
  locatorPath: string;
  locatorSha256: string;
}): QaWizardPackagePublicationClaim {
  return withDigest({
    version: QA_WIZARD_PACKAGE_PUBLICATION_CLAIM_VERSION,
    approvedManifestDigest: args.authority.approvedManifest.digest,
    approvedManifestPath: args.authority.approvedManifestPath,
    packageCandidateDigest: args.authority.candidate.digest,
    packageReviewDigest: args.authority.packageReview.digest,
    approvalDigest: args.authority.approval.digest,
    publishedAt: args.publishedAt,
    locatorBefore: structuredClone(args.authority.manifest.locatorBefore),
    packageRevisionDigest: args.authority.packageValue.revisionDigest,
    packagePath: args.packagePath,
    packageSha256: args.packageSha256,
    locatorPath: args.locatorPath,
    locatorSha256: args.locatorSha256,
    scope: 'single_canonical_package_publication' as const,
  });
}

function publishedManifestFor(args: {
  authority: ApprovedAuthority;
  publishedAt: string;
  claim: QaWizardPackagePublicationClaim;
  claimPath: string;
  packagePath: string;
  packageSha256: string;
  locatorPath: string;
  locatorSha256: string;
  locatorReplacementRequired: boolean;
}): QaWizardPackageLifecycleManifest {
  const approved = args.authority.approvedManifest;
  return buildManifest({
    version: QA_WIZARD_PACKAGE_LIFECYCLE_MANIFEST_VERSION,
    stage: 'package_published',
    predecessor: {
      version: approved.version,
      digest: approved.digest,
      path: args.authority.approvedManifestPath,
    },
    approvedBlueprint: structuredClone(approved.approvedBlueprint),
    bridge: structuredClone(approved.bridge),
    context: structuredClone(approved.context),
    reviewReality: structuredClone(approved.reviewReality),
    package: structuredClone(approved.package),
    locatorBefore: structuredClone(approved.locatorBefore),
    approval: structuredClone(approved.approval),
    publication: {
      publishedAt: args.publishedAt,
      claimDigest: args.claim.digest,
      claimPath: args.claimPath,
      packagePath: args.packagePath,
      packageSha256: args.packageSha256,
      locatorPath: args.locatorPath,
      locatorSha256: args.locatorSha256,
      locatorChanged: args.locatorReplacementRequired,
    },
    externalCounters: counters(1),
    doesNotAuthorize: manifestExclusions('package_published'),
  });
}

type LocatorDisposition = 'predecessor' | 'successor';

function currentLocatorDisposition(args: {
  repoRoot: string;
  snapshot: QaWizardPackageLocatorSnapshot;
  successor: VisualPackageV4Locator;
  successorBytes: string;
  storyKey: string;
  styleId: string;
}): LocatorDisposition {
  const absolutePath = resolveRepoPath(args.repoRoot, args.snapshot.path);
  if (!fs.existsSync(absolutePath)) {
    if (args.snapshot.state === 'absent') return 'predecessor';
    throw new Error('Reviewed predecessor package locator is missing');
  }
  const bytes = fs.readFileSync(absolutePath, 'utf8');
  if (bytes === args.successorBytes) return 'successor';
  if (
    args.snapshot.state !== 'present' ||
    sha256(bytes) !== args.snapshot.sha256 ||
    args.snapshot.locator === null
  ) {
    throw new Error('Current package locator changed after reviewed package assembly');
  }
  const current = loadCurrentVisualPackageV4({
    repoRoot: args.repoRoot,
    locatorPath: args.snapshot.path,
    storyKey: args.storyKey,
    styleId: args.styleId,
  });
  if (
    canonicalJsonDigest(current.locator) !==
    canonicalJsonDigest(args.snapshot.locator)
  ) {
    throw new Error('Current package locator no longer selects the reviewed predecessor');
  }
  return 'predecessor';
}

function writeMutableFileAtomically(args: {
  destinationPath: string;
  bytes: string;
}): void {
  fs.mkdirSync(path.dirname(args.destinationPath), { recursive: true });
  const temporary = `${args.destinationPath}.qa-wizard-${process.pid}.tmp`;
  fs.writeFileSync(temporary, args.bytes, { encoding: 'utf8', flag: 'wx' });
  try {
    fs.renameSync(temporary, args.destinationPath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function publishQaWizardApprovedPackage(
  args: {
    repoRoot: string;
    approvedManifestPath: string;
    outputDir: string;
    publishedAt: string;
    write?: boolean;
  },
  hooks: QaWizardPackageLifecycleHooks = {},
): QaWizardPackagePublicationResult {
  if (!canonicalUtcTimestampIsValid(args.publishedAt)) {
    throw new Error('Package publication requires canonical UTC time');
  }
  const authority = loadApprovedAuthority({
    repoRoot: args.repoRoot,
    manifestPath: args.approvedManifestPath,
  });
  sameOutputDir({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    manifestPath: args.approvedManifestPath,
  });
  const approvedPackagesDir = resolveRepoPath(
    args.repoRoot,
    APPROVED_PACKAGES_DIR,
  );
  const plan = publishVisualPackageV4({
    repoRoot: args.repoRoot,
    approvedPackagesDir,
    packageValue: authority.packageValue,
    write: false,
  });
  if (plan.locatorPath !== authority.manifest.locatorBefore.path) {
    throw new Error('Canonical package locator path differs from reviewed predecessor');
  }
  const packageBytes = `${JSON.stringify(authority.packageValue, null, 2)}\n`;
  const locatorBytes = `${JSON.stringify(plan.locator, null, 2)}\n`;
  const packageSha256 = sha256(packageBytes);
  const locatorSha256 = sha256(locatorBytes);
  const locatorReplacementRequired =
    authority.manifest.locatorBefore.state === 'absent' ||
    canonicalJsonDigest(authority.manifest.locatorBefore.locator) !==
      canonicalJsonDigest(plan.locator);
  if (!locatorReplacementRequired) {
    throw new Error('Package publication is a no-op against the reviewed locator');
  }
  const claimPath = publicationClaimPath({
    repoRoot: args.repoRoot,
    candidateDigest: authority.candidate.digest,
  });
  const claim = publicationClaimFor({
    authority,
    publishedAt: args.publishedAt,
    packagePath: plan.packagePath,
    packageSha256,
    locatorPath: plan.locatorPath,
    locatorSha256,
  });
  const publishedManifest = publishedManifestFor({
    authority,
    publishedAt: args.publishedAt,
    claim,
    claimPath,
    packagePath: plan.packagePath,
    packageSha256,
    locatorPath: plan.locatorPath,
    locatorSha256,
    locatorReplacementRequired,
  });
  const publishedManifestPath = manifestPath({
    repoRoot: args.repoRoot,
    outputDir: authority.outputDir,
    manifest: publishedManifest,
  });
  assertCompatibleIfPresent({
    repoRoot: args.repoRoot,
    artifactPath: claimPath,
    expectedBytes: canonicalContentAddressedJsonBytes(claim),
    label: 'Package publication claim',
  });
  assertCompatibleIfPresent({
    repoRoot: args.repoRoot,
    artifactPath: publishedManifestPath,
    expectedBytes: canonicalContentAddressedJsonBytes(publishedManifest),
    label: 'Published package manifest',
  });
  const packageAbsolutePath = resolveRepoPath(args.repoRoot, plan.packagePath);
  const locatorAbsolutePath = resolveRepoPath(args.repoRoot, plan.locatorPath);
  assertCompatibleIfPresent({
    repoRoot: args.repoRoot,
    artifactPath: plan.packagePath,
    expectedBytes: packageBytes,
    label: 'Approved package revision',
  });
  let disposition = currentLocatorDisposition({
    repoRoot: args.repoRoot,
    snapshot: authority.manifest.locatorBefore,
    successor: plan.locator,
    successorBytes: locatorBytes,
    storyKey: authority.packageValue.storyKey,
    styleId: authority.packageValue.styleId,
  });
  let locatorChanged = false;
  if (args.write === true) {
    persistCanonical({
      repoRoot: args.repoRoot,
      artifactPath: claimPath,
      value: claim,
      write: true,
    });
    hooks.afterPublicationClaim?.();
    fs.mkdirSync(path.dirname(locatorAbsolutePath), { recursive: true });
    const lockPath = `${locatorAbsolutePath}.qa-wizard-package.lock`;
    let lock: number | null = null;
    try {
      lock = fs.openSync(lockPath, 'wx');
      disposition = currentLocatorDisposition({
        repoRoot: args.repoRoot,
        snapshot: authority.manifest.locatorBefore,
        successor: plan.locator,
        successorBytes: locatorBytes,
        storyKey: authority.packageValue.storyKey,
        styleId: authority.packageValue.styleId,
      });
      if (disposition === 'predecessor') {
        writeImmutableLocalArtifact({
          destinationPath: packageAbsolutePath,
          bytes: packageBytes,
        });
        hooks.afterRevisionWrite?.();
        writeMutableFileAtomically({
          destinationPath: locatorAbsolutePath,
          bytes: locatorBytes,
        });
        locatorChanged = true;
        hooks.afterLocatorWrite?.();
      }
      if (
        !fs.existsSync(packageAbsolutePath) ||
        fs.readFileSync(packageAbsolutePath, 'utf8') !== packageBytes ||
        fs.readFileSync(locatorAbsolutePath, 'utf8') !== locatorBytes
      ) {
        throw new Error('Published package revision or locator bytes differ from plan');
      }
      const selected = loadCurrentVisualPackageV4({
        repoRoot: args.repoRoot,
        locatorPath: plan.locatorPath,
        storyKey: authority.packageValue.storyKey,
        styleId: authority.packageValue.styleId,
      });
      if (
        selected.packageValue.revisionDigest !==
          authority.packageValue.revisionDigest ||
        selected.locator.packagePath !== plan.packagePath
      ) {
        throw new Error('Canonical locator does not select the approved package revision');
      }
      persistCanonical({
        repoRoot: args.repoRoot,
        artifactPath: publishedManifestPath,
        value: publishedManifest,
        write: true,
      });
    } finally {
      if (lock !== null) {
        fs.closeSync(lock);
        if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
      }
    }
  }
  return {
    manifest: publishedManifest,
    manifestPath: publishedManifestPath,
    packageValue: authority.packageValue,
    packagePath: plan.packagePath,
    locator: plan.locator,
    locatorPath: plan.locatorPath,
    locatorChanged,
    publicationClaimPath: claimPath,
    wrote: args.write === true,
  };
}
