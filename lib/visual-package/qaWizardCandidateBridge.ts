import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

import {
  buildProductionAuthoringContext,
  PRODUCTION_AUTHORING_CONTEXT_VERSION,
  type ProductionAuthoringContext,
} from './productionAuthoringContext';
import {
  assertVisualContractCandidateForReconciliation,
  buildProductionReconciliationDraftFromFiles,
  buildProductionReconciliationDraftFromVisualContractCandidate,
  buildReconciliationReviewBundle,
  loadVisualContractCandidateForReconciliation,
  persistReconciliationDraftBundle,
  RECONCILIATION_REVIEW_BUNDLE_VERSION,
  renderReconciliationReviewMarkdown,
} from './reconciliationLifecycle';
import {
  canonicalJsonDigest,
  isoTimestampIsValid,
  nonEmpty,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  canonicalContentAddressedJsonBytes,
} from './canonicalContentAddressedJson';
import {
  createContainedContentAddressedJsonArtifactStore,
  canonicalLiveAuthoringJsonBytes,
} from './canonicalLiveAuthoringArtifacts';
import {
  CANONICAL_PRE_LIVE_READINESS_EVIDENCE_VERSION,
  assertValidCanonicalPreLiveReadinessEvidence,
  type CanonicalPreLiveReadinessEvidence,
} from './canonicalPreLiveReadiness';
import {
  CANONICAL_LIVE_EXECUTION_CHILD_OUTPUT_AUTHORITY_VERSION,
  CANONICAL_LIVE_EXECUTION_REQUEST_VERSION,
  CANONICAL_LIVE_EXECUTION_RESULT_VERSION,
  assertValidCanonicalLiveExecutionChildOutputAuthority,
  canonicalLiveExecutionExpectedAbsentPaths,
  assertValidCanonicalLiveExecutionReadiness,
  assertValidCanonicalLiveExecutionRequest,
  type CanonicalLiveExecutionLiveResult,
  type CanonicalLiveExecutionRequest,
} from './liveExecutionSupervisor';
import {
  assertValidLiveRequestMaterializationManifest,
  verifyCanonicalLiveRequestBundle,
  type LiveRequestMaterializationManifest,
} from './liveRequestMaterialization';
import {
  assertValidStorySourceAuthoritySnapshot,
  buildStorySourceAuthoritySnapshot,
  persistStorySourceAuthoritySnapshot,
  STORY_SOURCE_AUTHORITY_SNAPSHOT_VERSION,
} from './storySourceAuthority';
import {
  SOURCE_PROMPT_RECONCILIATION_VERSION,
} from './types';
import type {
  SourcePromptReconciliation,
} from './sourcePromptReconciliation';
import {
  buildVisualContractAuthoringRequest,
  buildVisualContractCandidateArtifact,
  VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION,
  VISUAL_CONTRACT_AUTHORING_READINESS_VERSION,
  VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION,
  VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION,
  persistVisualContractAuthoringReadiness,
  type VisualContractAuthoringReadinessEvidence,
  type VisualContractAuthoringRequest,
  type VisualContractAuthoringReceipt,
  type VisualContractCandidateArtifact,
} from './visualContractAuthoringLifecycle';
import { loadTemplateForPackage } from './artifacts';

export const QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION =
  'qa-wizard-candidate-bridge-manifest/v2' as const;
export const QA_WIZARD_CANDIDATE_BRIDGE_LEGACY_MANIFEST_VERSION =
  'qa-wizard-candidate-bridge-manifest/v1' as const;

export const QA_WIZARD_RECONCILIATION_APPROVAL_ATTESTATION_VERSION =
  'qa-wizard-reconciliation-approval-attestation/v1' as const;

export const QA_WIZARD_RECONCILIATION_APPROVAL_DOES_NOT_AUTHORIZE = [
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

export const QA_WIZARD_CANDIDATE_BRIDGE_DOES_NOT_AUTHORIZE = [
  'reconciliation_approval',
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

export type QaWizardCandidateBridgeStage =
  | 'reconciliation_pending'
  | 'reconciliation_approved';

export interface QaWizardCandidateBridgeManifest {
  version:
    | typeof QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION
    | typeof QA_WIZARD_CANDIDATE_BRIDGE_LEGACY_MANIFEST_VERSION;
  stage: QaWizardCandidateBridgeStage;
  source: {
    storyKey: string;
    storyPath: string;
    sourceDigest: string;
    snapshotVersion: typeof STORY_SOURCE_AUTHORITY_SNAPSHOT_VERSION;
    snapshotDigest: string;
    snapshotPath: string;
  };
  supervisor: {
    freshReadinessVersion:
      typeof CANONICAL_PRE_LIVE_READINESS_EVIDENCE_VERSION;
    freshReadinessDigest: string;
    freshReadinessPath: string;
    executionRequestVersion:
      typeof CANONICAL_LIVE_EXECUTION_REQUEST_VERSION;
    executionRequestDigest: string;
    executionRequestPath: string;
    executionResultVersion:
      typeof CANONICAL_LIVE_EXECUTION_RESULT_VERSION;
    executionResultDigest: string;
    executionResultPath: string;
    childOutputAuthorityVersion:
      typeof CANONICAL_LIVE_EXECUTION_CHILD_OUTPUT_AUTHORITY_VERSION;
    childOutputAuthorityDigest: string;
    repositoryBranch: string;
    repositoryHead: string;
  };
  visualContract: {
    requestVersion: typeof VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION;
    requestDigest: string;
    requestPath: string;
    candidateVersion: typeof VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION;
    candidateDigest: string;
    candidatePath: string;
    templateSchemaVersion: string;
    templateDigest: string;
    templatePath: string;
    receiptVersion: typeof VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION;
    receiptDigest: string;
    receiptPath: string;
    readinessVersion: typeof VISUAL_CONTRACT_AUTHORING_READINESS_VERSION;
    readinessDigest: string;
    readinessPath: string;
    actionSemanticCoverageDigest: string;
    sourceEvidenceCatalogDigest: string;
  };
  reconciliation: {
    version: typeof SOURCE_PROMPT_RECONCILIATION_VERSION;
    digest: string;
    path: string;
    reviewBundleVersion: typeof RECONCILIATION_REVIEW_BUNDLE_VERSION;
    reviewBundleDigest: string;
    reviewBundlePath: string;
    reviewMarkdownPath: string;
    status: 'pending' | 'approved';
    reviewedBy: null | 'Guy';
    reviewedAt: string | null;
    approvalAttestationVersion:
      | typeof QA_WIZARD_RECONCILIATION_APPROVAL_ATTESTATION_VERSION
      | null;
    approvalAttestationDigest: string | null;
    approvalAttestationPath: string | null;
    pendingManifestDigest: string | null;
  };
  productionContext: null | {
    version: typeof PRODUCTION_AUTHORING_CONTEXT_VERSION;
    digest: string;
    styleId: string;
    styleAuthorityPath: string;
    styleAuthorityDigest: string;
  };
  blueprint: null;
  visualPackage: null;
  wizard: null;
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

interface BridgeManifestPayload
  extends Omit<
    QaWizardCandidateBridgeManifest,
    'digestAlgorithm' | 'digest'
  > {}

export interface QaWizardCandidateBridgeArtifactWrite {
  path: string;
  digest: string;
  created: boolean;
}

export interface PrepareQaWizardCandidateReconciliationRequest {
  repoRoot: string;
  outputDir: string;
  storyKey: string;
  storyPath: string;
  candidatePath: string;
  authoringRequestPath: string;
  authoringReceiptPath: string;
  authoringReadinessPath: string;
  freshReadinessPath: string;
  supervisorExecutionRequestPath: string;
  supervisorExecutionResultPath: string;
  write?: boolean;
}

export interface AdvanceQaWizardApprovedReconciliationRequest {
  repoRoot: string;
  outputDir: string;
  bridgeManifestPath: string;
  approvedReconciliationPath: string;
  approvedReviewBundlePath: string;
  approvedReviewMarkdownPath: string;
  approvalAttestationPath: string;
  styleId: string;
  styleAuthorityPath: string;
  expectedStyleAuthorityDigest?: string;
  write?: boolean;
}

export interface RecordQaWizardReconciliationApprovalRequest {
  repoRoot: string;
  outputDir: string;
  pendingManifestPath: string;
  approvedReconciliationPath: string;
  approvedReviewBundlePath: string;
  approvedReviewMarkdownPath: string;
  approvedBy: 'Guy';
  approvedAt: string;
  write?: boolean;
}

export interface CaptureQaWizardCanonicalSupervisorResultRequest {
  repoRoot: string;
  outputDir: string;
  supervisorResultSourcePath: string;
  write?: boolean;
}

export interface QaWizardReconciliationApprovalAttestation {
  version:
    typeof QA_WIZARD_RECONCILIATION_APPROVAL_ATTESTATION_VERSION;
  pendingManifestDigest: string;
  reconciliationVersion: typeof SOURCE_PROMPT_RECONCILIATION_VERSION;
  reconciliationDigest: string;
  reviewBundleVersion: typeof RECONCILIATION_REVIEW_BUNDLE_VERSION;
  reviewBundleDigest: string;
  reviewMarkdownSha256: string;
  decision: 'approved';
  approvedBy: 'Guy';
  approvedAt: string;
  authorityScope: 'reconciliation_exact_content_approval_only';
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort())
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function readJsonObject(filePath: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    throw new Error(`${label} JSON is missing or invalid`);
  }
  if (!isObject(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed;
}

function sha256Utf8(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizedAbsolute(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function runGit(repoRoot: string, args: readonly string[]): string {
  const result = spawnSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0 || result.signal || result.error) {
    throw new Error('QA Wizard bridge repository authority is unavailable');
  }
  return result.stdout.trim();
}

function canonicalSupervisorResultIsValid(
  value: unknown,
): value is CanonicalLiveExecutionLiveResult {
  if (
    !isObject(value) ||
    !exactKeys(value, [
      'version',
      'mode',
      'status',
      'readiness',
      'reasonCodes',
      'credential',
      'child',
      'outputAuthority',
    ]) ||
    value.version !== CANONICAL_LIVE_EXECUTION_RESULT_VERSION ||
    value.mode !== 'live' ||
    value.status !== 'child_completed' ||
    !Array.isArray(value.reasonCodes) ||
    value.reasonCodes.length !== 0 ||
    !isObject(value.credential) ||
    !exactKeys(value.credential, [
      'sourceAccessAttempted',
      'sourceReadSucceeded',
      'authorityCleared',
    ]) ||
    value.credential.sourceAccessAttempted !== true ||
    value.credential.sourceReadSucceeded !== true ||
    value.credential.authorityCleared !== true ||
    !isObject(value.child) ||
    !exactKeys(value.child, ['termination', 'stdout', 'stderr']) ||
    value.child.stdout !== 'suppressed' ||
    value.child.stderr !== 'suppressed' ||
    !isObject(value.child.termination) ||
    !exactKeys(value.child.termination, ['kind', 'exitCode']) ||
    value.child.termination.kind !== 'exit' ||
    value.child.termination.exitCode !== 0
  ) {
    return false;
  }
  try {
    assertValidCanonicalLiveExecutionReadiness(value.readiness);
    assertValidCanonicalLiveExecutionChildOutputAuthority(
      value.outputAuthority,
    );
  } catch {
    return false;
  }
  return (
    value.readiness.mode === 'live' &&
    value.readiness.status === 'ready' &&
    value.readiness.reasonCodes.length === 0 &&
    value.readiness.requestDigest !== null
  );
}

function assertCanonicalJsonArtifact(args: {
  absolutePath: string;
  value: unknown;
  digest: string;
  category: string;
  label: string;
}): void {
  if (
    path.basename(args.absolutePath) !== `${args.digest}.json` ||
    path.basename(path.dirname(args.absolutePath)) !== args.category ||
    fs.readFileSync(args.absolutePath, 'utf8') !==
      canonicalLiveAuthoringJsonBytes(args.value)
  ) {
    throw new Error(`${args.label} path or bytes are not canonical`);
  }
}

function relativePathIsWithin(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`);
}

function commandFlag(
  request: CanonicalLiveExecutionRequest,
  flag: string,
): string | null {
  const index = request.futureLiveCommand.arguments.indexOf(flag);
  return index >= 0
    ? request.futureLiveCommand.arguments[index + 1] ?? null
    : null;
}

function resolveExistingContainedArtifact(args: {
  repoRoot: string;
  relativePath: string;
  label: string;
}): string {
  if (
    args.relativePath.includes('\\') ||
    path.posix.normalize(args.relativePath) !== args.relativePath ||
    args.relativePath.startsWith('./')
  ) {
    throw new Error(`${args.label} path is not canonical repository-relative`);
  }
  const absolute = resolveRepoPath(args.repoRoot, args.relativePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`${args.label} is missing`);
  }
  const lexicalStat = fs.lstatSync(absolute);
  if (!lexicalStat.isFile() || lexicalStat.nlink !== 1) {
    throw new Error(`${args.label} must be a unique regular file`);
  }
  const repositoryRealPath = fs.realpathSync(args.repoRoot);
  const artifactRealPath = fs.realpathSync(absolute);
  repoRelativePath(repositoryRealPath, artifactRealPath);
  if (normalizedAbsolute(artifactRealPath) !== normalizedAbsolute(absolute)) {
    throw new Error(`${args.label} path uses a symlink or junction alias`);
  }
  const realStat = fs.statSync(artifactRealPath);
  if (
    !realStat.isFile() ||
    realStat.nlink !== 1 ||
    realStat.dev !== lexicalStat.dev ||
    realStat.ino !== lexicalStat.ino
  ) {
    throw new Error(`${args.label} filesystem identity is not stable`);
  }
  if (repoRelativePath(args.repoRoot, absolute) !== args.relativePath) {
    throw new Error(`${args.label} path is not canonical repository-relative`);
  }
  return absolute;
}

function prepareBridgeOutputRoot(args: {
  repoRoot: string;
  outputDir: string;
}): void {
  const store = createContainedContentAddressedJsonArtifactStore({
    repoRoot: args.repoRoot,
    repositoryRealPath: fs.realpathSync(args.repoRoot),
    outputDir: args.outputDir,
    categories: [
      'bridge-manifests',
      'candidate-template-projections',
      'source-snapshots',
      'reconciliations',
      'reviews',
      'reconciliation-approvals',
    ] as const,
    rejectSymlinkAliases: true,
    errorPrefix: 'QA Wizard candidate bridge',
  });
  store.prepare();
}

function persistCandidateTemplateProjection(args: {
  repoRoot: string;
  outputDir: string;
  candidate: VisualContractCandidateArtifact;
  write?: boolean;
}): QaWizardCandidateBridgeArtifactWrite {
  const outputRoot = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, outputRoot);
  const destinationPath = path.join(
    outputRoot,
    'candidate-template-projections',
    `${args.candidate.templateDigest}.json`,
  );
  let persistence = { created: false };
  if (args.write === true) {
    const store = createContainedContentAddressedJsonArtifactStore({
      repoRoot: args.repoRoot,
      repositoryRealPath: fs.realpathSync(args.repoRoot),
      outputDir: args.outputDir,
      categories: ['candidate-template-projections'] as const,
      rejectSymlinkAliases: true,
      errorPrefix: 'QA Wizard candidate template projection',
    });
    store.prepare();
    persistence = store.persist({
      category: 'candidate-template-projections',
      digest: args.candidate.templateDigest,
      value: args.candidate.template,
    });
  }
  return {
    path: repoRelativePath(args.repoRoot, destinationPath),
    digest: args.candidate.templateDigest,
    created: persistence.created,
  };
}

function loadAndValidateCandidateTemplateProjection(args: {
  repoRoot: string;
  bridgeOutputDir: string;
  storyKey: string;
  storyPath: string;
  candidatePath: string;
  templatePath: string;
  expectedCandidateDigest: string;
  expectedTemplateDigest: string;
  expectedTemplateSchemaVersion: string;
}): VisualContractCandidateArtifact {
  const snapshot = buildStorySourceAuthoritySnapshot({
    repoRoot: args.repoRoot,
    storyKey: args.storyKey,
    storyPath: args.storyPath,
  });
  assertValidStorySourceAuthoritySnapshot(snapshot);
  const candidateAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.candidatePath,
    label: 'Visual Contract candidate',
  });
  const candidate = readJsonObject(
    candidateAbsolute,
    'Visual Contract candidate',
  ) as unknown as VisualContractCandidateArtifact;
  assertVisualContractCandidateForReconciliation({ snapshot, candidate });
  assertCanonicalJsonArtifact({
    absolutePath: candidateAbsolute,
    value: candidate,
    digest: candidate.digest,
    category: 'contract-candidates',
    label: 'Visual Contract candidate',
  });
  const expectedProjectionPath =
    `${args.bridgeOutputDir}/candidate-template-projections/${candidate.templateDigest}.json`;
  if (
    candidate.digest !== args.expectedCandidateDigest ||
    candidate.templateDigest !== args.expectedTemplateDigest ||
    candidate.template.schemaVersion !== args.expectedTemplateSchemaVersion ||
    args.templatePath !== expectedProjectionPath
  ) {
    throw new Error(
      'QA Wizard candidate template projection identity is stale or cross-bound',
    );
  }
  const templateAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.templatePath,
    label: 'Visual Contract candidate template projection',
  });
  assertCanonicalJsonArtifact({
    absolutePath: templateAbsolute,
    value: candidate.template,
    digest: candidate.templateDigest,
    category: 'candidate-template-projections',
    label: 'Visual Contract candidate template projection',
  });
  const loadedTemplate = loadTemplateForPackage({
    repoRoot: args.repoRoot,
    templatePath: args.templatePath,
    storyKey: args.storyKey,
    source: snapshot.content.sourceIdentity,
    expectedDigest: candidate.templateDigest,
  });
  if (
    loadedTemplate.issues.length > 0 ||
    !loadedTemplate.template ||
    !loadedTemplate.identity ||
    loadedTemplate.identity.artifactPath !== args.templatePath ||
    canonicalContentAddressedJsonBytes(loadedTemplate.template) !==
      canonicalContentAddressedJsonBytes(candidate.template)
  ) {
    throw new Error(
      'Visual Contract candidate template projection is invalid or tampered',
    );
  }
  return candidate;
}

function loadCanonicalSupervisorAuthority(args: {
  repoRoot: string;
  freshReadinessPath: string;
  executionRequestPath: string;
  executionResultPath: string;
  authoringRequestPath: string;
  authoringReceiptPath: string;
  authoringReadinessPath: string;
  candidatePath: string;
}): {
  freshReadiness: CanonicalPreLiveReadinessEvidence;
  executionRequest: CanonicalLiveExecutionRequest;
  executionResult: CanonicalLiveExecutionLiveResult;
  executionResultDigest: string;
  materializationManifest: LiveRequestMaterializationManifest;
} {
  const freshAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.freshReadinessPath,
    label: 'canonical Fresh Readiness evidence',
  });
  const freshReadiness = readJsonObject(
    freshAbsolute,
    'canonical Fresh Readiness evidence',
  ) as unknown as CanonicalPreLiveReadinessEvidence;
  assertValidCanonicalPreLiveReadinessEvidence(freshReadiness);
  assertCanonicalJsonArtifact({
    absolutePath: freshAbsolute,
    value: freshReadiness,
    digest: freshReadiness.digest,
    category: 'canonical-pre-live-readiness-evidence',
    label: 'canonical Fresh Readiness evidence',
  });

  const executionRequestAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.executionRequestPath,
    label: 'canonical Supervisor execution request',
  });
  const executionRequest = readJsonObject(
    executionRequestAbsolute,
    'canonical Supervisor execution request',
  ) as unknown as CanonicalLiveExecutionRequest;
  assertValidCanonicalLiveExecutionRequest(executionRequest);
  assertCanonicalJsonArtifact({
    absolutePath: executionRequestAbsolute,
    value: executionRequest,
    digest: executionRequest.digest,
    category: 'canonical-live-execution-requests',
    label: 'canonical Supervisor execution request',
  });

  const manifestAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: executionRequest.canonicalBundle.manifestPath,
    label: 'canonical B0 materialization manifest',
  });
  const materializationManifest = readJsonObject(
    manifestAbsolute,
    'canonical B0 materialization manifest',
  ) as unknown as LiveRequestMaterializationManifest;
  assertValidLiveRequestMaterializationManifest(materializationManifest);
  assertCanonicalJsonArtifact({
    absolutePath: manifestAbsolute,
    value: materializationManifest,
    digest: materializationManifest.digest,
    category: 'live-request-materializations',
    label: 'canonical B0 materialization manifest',
  });
  const bundleVerification = verifyCanonicalLiveRequestBundle({
    repoRoot: args.repoRoot,
    manifestPath: executionRequest.canonicalBundle.manifestPath,
  });
  if (bundleVerification.status !== 'verified') {
    throw new Error('canonical B0 materialization bundle is no longer valid');
  }
  const verifiedB0AuthorityPairs = [
    [
      executionRequest.canonicalBundle.structuredOutputCompatibility,
      bundleVerification.structuredOutputCompatibility,
    ],
    [
      executionRequest.canonicalBundle.compactRepairStructuredOutputCompatibility,
      bundleVerification.compactRepairStructuredOutputCompatibility,
    ],
    [
      executionRequest.canonicalBundle.pageContractRepairStructuredOutputCompatibility,
      bundleVerification.pageContractRepairStructuredOutputCompatibility,
    ],
    [
      executionRequest.canonicalBundle.pageSpatialReferenceRepairStructuredOutputCompatibility,
      bundleVerification.pageSpatialReferenceRepairStructuredOutputCompatibility,
    ],
    [
      executionRequest.canonicalBundle.structuralBundleRepairStructuredOutputCompatibility,
      bundleVerification.structuralBundleRepairStructuredOutputCompatibility,
    ],
    [
      executionRequest.canonicalBundle.bookSurfaceRepairStructuredOutputCompatibility,
      bundleVerification.bookSurfaceRepairStructuredOutputCompatibility,
    ],
    [
      executionRequest.canonicalBundle.presentationRequirementRepairStructuredOutputCompatibility,
      bundleVerification.presentationRequirementRepairStructuredOutputCompatibility,
    ],
    [
      executionRequest.canonicalBundle.stablePropScopeRepairStructuredOutputCompatibility,
      bundleVerification.stablePropScopeRepairStructuredOutputCompatibility,
    ],
    [executionRequest.canonicalBundle.requestPolicy, bundleVerification.requestPolicy],
  ] as const;
  if (
    executionRequest.canonicalBundle.manifestDigest !==
      bundleVerification.identities.manifestDigest ||
    materializationManifest.requestId !== bundleVerification.identities.requestId ||
    materializationManifest.sourceRevision.storyKey !==
      bundleVerification.identities.storyKey ||
    materializationManifest.sourceRevision.sourceSnapshotDigest !==
      bundleVerification.identities.sourceSnapshotDigest ||
    materializationManifest.sourceRevision.normalizedSourceDigest !==
      bundleVerification.identities.normalizedSourceDigest ||
    materializationManifest.artifacts.sourceAuthorityRequest.digest !==
      bundleVerification.identities.sourceAuthorityRequestDigest ||
    materializationManifest.artifacts.liveAuthoringRequest.digest !==
      bundleVerification.identities.liveAuthoringRequestDigest ||
    verifiedB0AuthorityPairs.some(
      ([observed, expected]) =>
        canonicalJsonDigest(observed) !== canonicalJsonDigest(expected),
    )
  ) {
    throw new Error(
      'canonical execution request does not match the verified B0 bundle',
    );
  }

  const executionResultAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.executionResultPath,
    label: 'canonical Supervisor execution result',
  });
  const executionResult = readJsonObject(
    executionResultAbsolute,
    'canonical Supervisor execution result',
  );
  if (!canonicalSupervisorResultIsValid(executionResult)) {
    throw new Error('canonical Supervisor execution result is not a completed live run');
  }
  const childOutputAuthority = executionResult.outputAuthority;
  if (childOutputAuthority === null) {
    throw new Error(
      'canonical Supervisor execution result has no child output authority',
    );
  }
  const executionResultDigest = canonicalJsonDigest(executionResult);
  assertCanonicalJsonArtifact({
    absolutePath: executionResultAbsolute,
    value: executionResult,
    digest: executionResultDigest,
    category: 'canonical-live-execution-results',
    label: 'canonical Supervisor execution result',
  });

  const outputRoot = freshReadiness.request.outputRoot;
  const b0Root = `${outputRoot}/b0`;
  const expectedCanonicalAbsentPaths =
    canonicalLiveExecutionExpectedAbsentPaths(b0Root);
  for (const [label, artifactPath, category] of [
    ['Visual Contract authoring request', args.authoringRequestPath, 'authoring-requests'],
    ['Visual Contract authoring receipt', args.authoringReceiptPath, 'authoring-receipts'],
    ['Visual Contract authoring readiness', args.authoringReadinessPath, 'readiness-evidence'],
    ['Visual Contract candidate', args.candidatePath, 'contract-candidates'],
  ] as const) {
    if (
      !relativePathIsWithin(b0Root, artifactPath) ||
      path.posix.basename(path.posix.dirname(artifactPath)) !== category
    ) {
      throw new Error(`${label} is outside the canonical live output root`);
    }
  }
  if (
    args.freshReadinessPath !==
      `${outputRoot}/canonical-pre-live-readiness-evidence/${freshReadiness.digest}.json` ||
    args.executionRequestPath !==
      freshReadiness.canonicalAuthorities.executionRequest.path ||
    executionRequest.digest !==
      freshReadiness.canonicalAuthorities.executionRequest.digest ||
    !relativePathIsWithin(`${outputRoot}/execution`, args.executionResultPath) ||
    executionResult.readiness.requestDigest !== executionRequest.digest ||
    executionRequest.canonicalBundle.manifestDigest !==
      freshReadiness.canonicalAuthorities.b0.manifestDigest ||
    executionRequest.canonicalBundle.manifestPath !==
      freshReadiness.canonicalAuthorities.b0.manifestPath ||
    materializationManifest.digest !==
      executionRequest.canonicalBundle.manifestDigest ||
    materializationManifest.repositoryRealPath !==
      executionRequest.repository.realPath ||
    materializationManifest.artifacts.liveAuthoringRequest.path !==
      args.authoringRequestPath ||
    executionRequest.futureLiveCommand.executable !==
      materializationManifest.futureLiveCommand.executable ||
    JSON.stringify(executionRequest.futureLiveCommand.arguments) !==
      JSON.stringify(materializationManifest.futureLiveCommand.arguments) ||
    canonicalJsonDigest(executionRequest.canonicalBundle.requestPolicy) !==
      canonicalJsonDigest(freshReadiness.canonicalAuthorities.b0.requestPolicy) ||
    commandFlag(executionRequest, '--request') !== args.authoringRequestPath ||
    commandFlag(executionRequest, '--out') !== b0Root ||
    childOutputAuthority.outputRoot !== b0Root ||
    childOutputAuthority.authoringRequest.path !==
      args.authoringRequestPath ||
    childOutputAuthority.authoringRequest.digest !==
      materializationManifest.artifacts.liveAuthoringRequest.digest ||
    childOutputAuthority.authoringReceipt.path !==
      args.authoringReceiptPath ||
    childOutputAuthority.authoringReceipt.digest !==
      path.posix.basename(args.authoringReceiptPath, '.json') ||
    childOutputAuthority.authoringReadiness.path !==
      args.authoringReadinessPath ||
    childOutputAuthority.authoringReadiness.digest !==
      path.posix.basename(args.authoringReadinessPath, '.json') ||
    childOutputAuthority.visualContractCandidate.path !==
      args.candidatePath ||
    childOutputAuthority.visualContractCandidate.digest !==
      path.posix.basename(args.candidatePath, '.json') ||
    JSON.stringify(executionRequest.expectedAbsentPaths) !==
      JSON.stringify(expectedCanonicalAbsentPaths) ||
    freshReadiness.request.childRequestIds.b0 !==
      `${freshReadiness.request.requestId}:b0` ||
    freshReadiness.request.childRequestIds.execution !==
      `${freshReadiness.request.requestId}:execution` ||
    materializationManifest.requestId !==
      freshReadiness.request.childRequestIds.b0 ||
    executionRequest.requestId !==
      freshReadiness.request.childRequestIds.execution ||
    materializationManifest.requestedAt !==
      freshReadiness.request.requestedAt ||
    executionRequest.requestedAt !==
      freshReadiness.request.requestedAt
  ) {
    throw new Error(
      'canonical Supervisor, Fresh Readiness, execution request, and child artifacts are not exactly cross-bound',
    );
  }

  const liveReadiness = executionResult.readiness;
  const b0AuthorityPairs = [
    [
      liveReadiness.b0.structuredOutputCompatibility,
      executionRequest.canonicalBundle.structuredOutputCompatibility,
    ],
    [
      liveReadiness.b0.compactRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.compactRepairStructuredOutputCompatibility,
    ],
    [
      liveReadiness.b0.pageContractRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.pageContractRepairStructuredOutputCompatibility,
    ],
    [
      liveReadiness.b0.pageSpatialReferenceRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.pageSpatialReferenceRepairStructuredOutputCompatibility,
    ],
    [
      liveReadiness.b0.structuralBundleRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.structuralBundleRepairStructuredOutputCompatibility,
    ],
    [
      liveReadiness.b0.bookSurfaceRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.bookSurfaceRepairStructuredOutputCompatibility,
    ],
    [
      liveReadiness.b0.presentationRequirementRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.presentationRequirementRepairStructuredOutputCompatibility,
    ],
    [
      liveReadiness.b0.stablePropScopeRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.stablePropScopeRepairStructuredOutputCompatibility,
    ],
    [liveReadiness.b0.requestPolicy, executionRequest.canonicalBundle.requestPolicy],
  ] as const;
  const freshB0AuthorityPairs = [
    [
      freshReadiness.canonicalAuthorities.b0.structuredOutputCompatibility,
      executionRequest.canonicalBundle.structuredOutputCompatibility,
    ],
    [
      freshReadiness.canonicalAuthorities.b0.compactRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.compactRepairStructuredOutputCompatibility,
    ],
    [
      freshReadiness.canonicalAuthorities.b0.pageContractRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.pageContractRepairStructuredOutputCompatibility,
    ],
    [
      freshReadiness.canonicalAuthorities.b0.pageSpatialReferenceRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.pageSpatialReferenceRepairStructuredOutputCompatibility,
    ],
    [
      freshReadiness.canonicalAuthorities.b0.structuralBundleRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.structuralBundleRepairStructuredOutputCompatibility,
    ],
    [
      freshReadiness.canonicalAuthorities.b0.bookSurfaceRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.bookSurfaceRepairStructuredOutputCompatibility,
    ],
    [
      freshReadiness.canonicalAuthorities.b0.presentationRequirementRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.presentationRequirementRepairStructuredOutputCompatibility,
    ],
    [
      freshReadiness.canonicalAuthorities.b0.stablePropScopeRepairStructuredOutputCompatibility,
      executionRequest.canonicalBundle.stablePropScopeRepairStructuredOutputCompatibility,
    ],
    [
      freshReadiness.canonicalAuthorities.b0.requestPolicy,
      executionRequest.canonicalBundle.requestPolicy,
    ],
  ] as const;
  if (
    freshReadiness.status !== 'ready_for_spend_gate' ||
    liveReadiness.mode !== 'live' ||
    liveReadiness.status !== 'ready' ||
    liveReadiness.requestDigest !== executionRequest.digest ||
    liveReadiness.reasonCodes.length !== 0 ||
    liveReadiness.b0.status !== 'verified' ||
    liveReadiness.b0.manifestDigest !== materializationManifest.digest ||
    liveReadiness.b0.reasonCodes.length !== 0 ||
    b0AuthorityPairs.some(
      ([observed, expected]) =>
        observed === null ||
        canonicalJsonDigest(observed) !== canonicalJsonDigest(expected),
    ) ||
    freshB0AuthorityPairs.some(
      ([observed, expected]) =>
        canonicalJsonDigest(observed) !== canonicalJsonDigest(expected),
    ) ||
    liveReadiness.git.status !== 'verified' ||
    liveReadiness.git.commandCount !==
      4 +
        executionRequest.repository.refs.length +
        executionRequest.repository.divergence.length ||
    liveReadiness.git.refCount !== executionRequest.repository.refs.length ||
    liveReadiness.git.divergenceCount !==
      executionRequest.repository.divergence.length ||
    liveReadiness.git.branchMatched !== true ||
    liveReadiness.git.headMatched !== true ||
    liveReadiness.git.trackedChanges !== 0 ||
    liveReadiness.git.untrackedChanges !== 0 ||
    liveReadiness.preservation.status !== 'verified' ||
    liveReadiness.preservation.checkedFileCount !==
      executionRequest.preservationFences.length ||
    liveReadiness.expectedAbsence.status !== 'verified' ||
    liveReadiness.expectedAbsence.checkedPathCount !==
      executionRequest.expectedAbsentPaths.length ||
    liveReadiness.credentialIsolation.policy !==
      executionRequest.credentialIsolation.childEnvironmentPolicy ||
    liveReadiness.credentialIsolation.sourcePathDigest !==
      sha256Utf8(executionRequest.credentialIsolation.sourcePath) ||
    liveReadiness.credentialIsolation.sourceRead !== false ||
    liveReadiness.credentialIsolation.ambientCredentialInherited !== false ||
    liveReadiness.futureLiveCommand.status !== 'verified' ||
    liveReadiness.futureLiveCommand.identitySha256 !==
      executionRequest.futureLiveCommand.identitySha256 ||
    Object.values(liveReadiness.externalBoundaryEvidence).some(
      (value) => value !== 0,
    )
  ) {
    throw new Error(
      'canonical Supervisor live readiness is incomplete or does not match the execution request',
    );
  }

  const repositoryRealPath = fs.realpathSync(args.repoRoot);
  const branchRef = runGit(repositoryRealPath, [
    'symbolic-ref',
    '--quiet',
    'HEAD',
  ]);
  const head = runGit(repositoryRealPath, ['rev-parse', 'HEAD']);
  const upstreamRef = runGit(repositoryRealPath, [
    'rev-parse',
    '--symbolic-full-name',
    '@{upstream}',
  ]);
  const upstreamHead = runGit(repositoryRealPath, [
    'rev-parse',
    upstreamRef,
  ]);
  const divergence = runGit(repositoryRealPath, [
    'rev-list',
    '--left-right',
    '--count',
    'HEAD...@{upstream}',
  ]).split(/\s+/).map(Number);
  const status = runGit(repositoryRealPath, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]);
  const repository = freshReadiness.repositoryAuthority;
  const expectedRefs = new Map(
    executionRequest.repository.refs.map((entry) => [entry.name, entry.expectedCommit]),
  );
  if (
    normalizedAbsolute(repository.repositoryRealPath) !==
      normalizedAbsolute(repositoryRealPath) ||
    normalizedAbsolute(executionRequest.repository.realPath) !==
      normalizedAbsolute(repositoryRealPath) ||
    repository.branchRef !== branchRef ||
    repository.head !== head ||
    repository.upstreamRef !== upstreamRef ||
    repository.upstreamHead !== upstreamHead ||
    repository.ahead !== 0 ||
    repository.behind !== 0 ||
    divergence[0] !== 0 ||
    divergence[1] !== 0 ||
    status !== '' ||
    executionRequest.repository.expectedBranch !== branchRef ||
    executionRequest.repository.expectedHead !== head ||
    executionRequest.repository.expectedTrackedChanges !== 0 ||
    executionRequest.repository.expectedUntrackedChanges !== 0 ||
    expectedRefs.get(branchRef) !== head ||
    expectedRefs.get(upstreamRef) !== upstreamHead ||
    executionRequest.repository.divergence.length !== 1 ||
    executionRequest.repository.divergence[0]?.localRef !== branchRef ||
    executionRequest.repository.divergence[0]?.upstreamRef !== upstreamRef ||
    executionRequest.repository.divergence[0]?.expectedAhead !== 0 ||
    executionRequest.repository.divergence[0]?.expectedBehind !== 0
  ) {
    throw new Error('canonical Supervisor repository authority is stale or dirty');
  }

  return {
    freshReadiness,
    executionRequest,
    executionResult,
    executionResultDigest,
    materializationManifest,
  };
}

function bridgeOutputDirFromManifestPath(manifestPath: string): string {
  return path.posix.dirname(path.posix.dirname(manifestPath));
}

function assertSameBridgeOutputDir(args: {
  repoRoot: string;
  manifestPath: string;
  outputDir: string;
}): string {
  const expected = bridgeOutputDirFromManifestPath(args.manifestPath);
  const observed = repoRelativePath(
    args.repoRoot,
    path.resolve(args.repoRoot, args.outputDir),
  );
  if (observed !== expected) {
    throw new Error('QA Wizard bridge output root does not match the pending manifest');
  }
  return expected;
}

function forbiddenEvidenceKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = forbiddenEvidenceKey(item);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    if (
      /^(?:rawPrompt|prompt|systemPrompt|userPrompt|rawResponse|response|responseBody|providerMessage|stack|secret|credential|apiKey)$/i.test(
        key,
      )
    ) {
      return key;
    }
    const found = forbiddenEvidenceKey(child);
    if (found) return found;
  }
  return null;
}

function computeManifestDigest(payload: BridgeManifestPayload): string {
  return canonicalJsonDigest(payload);
}

function buildManifest(payload: BridgeManifestPayload): QaWizardCandidateBridgeManifest {
  const forbiddenKey = forbiddenEvidenceKey(payload);
  if (forbiddenKey) {
    throw new Error(
      `QA Wizard bridge evidence contains forbidden raw field ${forbiddenKey}`,
    );
  }
  return {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: computeManifestDigest(payload),
  };
}

export function qaWizardCandidateBridgeManifestIsValid(
  raw: unknown,
): raw is QaWizardCandidateBridgeManifest {
  if (
    !isObject(raw) ||
    !exactKeys(raw, [
      'version',
      'stage',
      'source',
      'supervisor',
      'visualContract',
      'reconciliation',
      'productionContext',
      'blueprint',
      'visualPackage',
      'wizard',
      'doesNotAuthorize',
      'digestAlgorithm',
      'digest',
    ]) ||
    (raw.version !== QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION &&
      raw.version !==
        QA_WIZARD_CANDIDATE_BRIDGE_LEGACY_MANIFEST_VERSION) ||
    (raw.stage !== 'reconciliation_pending' &&
      raw.stage !== 'reconciliation_approved') ||
    !isObject(raw.source) ||
    !exactKeys(raw.source, [
      'storyKey',
      'storyPath',
      'sourceDigest',
      'snapshotVersion',
      'snapshotDigest',
      'snapshotPath',
    ]) ||
    !nonEmpty(raw.source.storyKey) ||
    !nonEmpty(raw.source.storyPath) ||
    !isDigest(raw.source.sourceDigest) ||
    raw.source.snapshotVersion !== STORY_SOURCE_AUTHORITY_SNAPSHOT_VERSION ||
    !isDigest(raw.source.snapshotDigest) ||
    !nonEmpty(raw.source.snapshotPath) ||
    !isObject(raw.supervisor) ||
    !exactKeys(raw.supervisor, [
      'freshReadinessVersion',
      'freshReadinessDigest',
      'freshReadinessPath',
      'executionRequestVersion',
      'executionRequestDigest',
      'executionRequestPath',
      'executionResultVersion',
      'executionResultDigest',
      'executionResultPath',
      'childOutputAuthorityVersion',
      'childOutputAuthorityDigest',
      'repositoryBranch',
      'repositoryHead',
    ]) ||
    raw.supervisor.freshReadinessVersion !==
      CANONICAL_PRE_LIVE_READINESS_EVIDENCE_VERSION ||
    !isDigest(raw.supervisor.freshReadinessDigest) ||
    !nonEmpty(raw.supervisor.freshReadinessPath) ||
    raw.supervisor.executionRequestVersion !==
      CANONICAL_LIVE_EXECUTION_REQUEST_VERSION ||
    !isDigest(raw.supervisor.executionRequestDigest) ||
    !nonEmpty(raw.supervisor.executionRequestPath) ||
    raw.supervisor.executionResultVersion !==
      CANONICAL_LIVE_EXECUTION_RESULT_VERSION ||
    !isDigest(raw.supervisor.executionResultDigest) ||
    !nonEmpty(raw.supervisor.executionResultPath) ||
    raw.supervisor.childOutputAuthorityVersion !==
      CANONICAL_LIVE_EXECUTION_CHILD_OUTPUT_AUTHORITY_VERSION ||
    !isDigest(raw.supervisor.childOutputAuthorityDigest) ||
    !nonEmpty(raw.supervisor.repositoryBranch) ||
    !/^[a-f0-9]{40}$/.test(String(raw.supervisor.repositoryHead)) ||
    !isObject(raw.visualContract) ||
    !exactKeys(raw.visualContract, [
      'requestVersion',
      'requestDigest',
      'requestPath',
      'candidateVersion',
      'candidateDigest',
      'candidatePath',
      'templateSchemaVersion',
      'templateDigest',
      'templatePath',
      'receiptVersion',
      'receiptDigest',
      'receiptPath',
      'readinessVersion',
      'readinessDigest',
      'readinessPath',
      'actionSemanticCoverageDigest',
      'sourceEvidenceCatalogDigest',
    ]) ||
    raw.visualContract.requestVersion !==
      VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION ||
    !isDigest(raw.visualContract.requestDigest) ||
    !nonEmpty(raw.visualContract.requestPath) ||
    raw.visualContract.candidateVersion !==
      VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION ||
    !isDigest(raw.visualContract.candidateDigest) ||
    !nonEmpty(raw.visualContract.candidatePath) ||
    !nonEmpty(raw.visualContract.templateSchemaVersion) ||
    !isDigest(raw.visualContract.templateDigest) ||
    !nonEmpty(raw.visualContract.templatePath) ||
    raw.visualContract.receiptVersion !==
      VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION ||
    !isDigest(raw.visualContract.receiptDigest) ||
    !nonEmpty(raw.visualContract.receiptPath) ||
    raw.visualContract.readinessVersion !==
      VISUAL_CONTRACT_AUTHORING_READINESS_VERSION ||
    !isDigest(raw.visualContract.readinessDigest) ||
    !nonEmpty(raw.visualContract.readinessPath) ||
    !isDigest(raw.visualContract.actionSemanticCoverageDigest) ||
    !isDigest(raw.visualContract.sourceEvidenceCatalogDigest) ||
    !isObject(raw.reconciliation) ||
    !exactKeys(raw.reconciliation, [
      'version',
      'digest',
      'path',
      'reviewBundleVersion',
      'reviewBundleDigest',
      'reviewBundlePath',
      'reviewMarkdownPath',
      'status',
      'reviewedBy',
      'reviewedAt',
      'approvalAttestationVersion',
      'approvalAttestationDigest',
      'approvalAttestationPath',
      'pendingManifestDigest',
    ]) ||
    raw.reconciliation.version !== SOURCE_PROMPT_RECONCILIATION_VERSION ||
    !isDigest(raw.reconciliation.digest) ||
    !nonEmpty(raw.reconciliation.path) ||
    raw.reconciliation.reviewBundleVersion !==
      RECONCILIATION_REVIEW_BUNDLE_VERSION ||
    !isDigest(raw.reconciliation.reviewBundleDigest) ||
    !nonEmpty(raw.reconciliation.reviewBundlePath) ||
    !nonEmpty(raw.reconciliation.reviewMarkdownPath) ||
    !Array.isArray(raw.doesNotAuthorize) ||
    !raw.doesNotAuthorize.every(nonEmpty) ||
    canonicalJsonDigest(raw.doesNotAuthorize) !==
      canonicalJsonDigest(QA_WIZARD_CANDIDATE_BRIDGE_DOES_NOT_AUTHORIZE) ||
    raw.blueprint !== null ||
    raw.visualPackage !== null ||
    raw.wizard !== null ||
    raw.digestAlgorithm !== 'canonical-json-sha256' ||
    !isDigest(raw.digest) ||
    forbiddenEvidenceKey(raw) !== null
  ) {
    return false;
  }

  if (raw.stage === 'reconciliation_pending') {
    if (
      raw.reconciliation.status !== 'pending' ||
      raw.reconciliation.reviewedBy !== null ||
      raw.reconciliation.reviewedAt !== null ||
      raw.reconciliation.approvalAttestationVersion !== null ||
      raw.reconciliation.approvalAttestationDigest !== null ||
      raw.reconciliation.approvalAttestationPath !== null ||
      raw.reconciliation.pendingManifestDigest !== null ||
      raw.productionContext !== null
    ) {
      return false;
    }
  } else {
    if (
      raw.reconciliation.status !== 'approved' ||
      raw.reconciliation.reviewedBy !== 'Guy' ||
      !isoTimestampIsValid(raw.reconciliation.reviewedAt) ||
      raw.reconciliation.approvalAttestationVersion !==
        QA_WIZARD_RECONCILIATION_APPROVAL_ATTESTATION_VERSION ||
      !isDigest(raw.reconciliation.approvalAttestationDigest) ||
      !nonEmpty(raw.reconciliation.approvalAttestationPath) ||
      !isDigest(raw.reconciliation.pendingManifestDigest) ||
      !isObject(raw.productionContext) ||
      !exactKeys(raw.productionContext, [
        'version',
        'digest',
        'styleId',
        'styleAuthorityPath',
        'styleAuthorityDigest',
      ]) ||
      raw.productionContext.version !==
        PRODUCTION_AUTHORING_CONTEXT_VERSION ||
      !isDigest(raw.productionContext.digest) ||
      !nonEmpty(raw.productionContext.styleId) ||
      !nonEmpty(raw.productionContext.styleAuthorityPath) ||
      !isDigest(raw.productionContext.styleAuthorityDigest)
    ) {
      return false;
    }
  }

  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = raw;
  return raw.digest === computeManifestDigest(payload as BridgeManifestPayload);
}

export function persistQaWizardCandidateBridgeManifest(args: {
  repoRoot: string;
  outputDir: string;
  manifest: QaWizardCandidateBridgeManifest;
  write?: boolean;
}): QaWizardCandidateBridgeArtifactWrite {
  if (
    args.manifest.version !==
      QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION ||
    !qaWizardCandidateBridgeManifestIsValid(args.manifest)
  ) {
    throw new Error('QA Wizard candidate bridge manifest is invalid');
  }
  const outputRoot = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, outputRoot);
  const destinationPath = path.join(outputRoot, 'bridge-manifests', `${args.manifest.digest}.json`);
  let result = { created: false };
  if (args.write === true) {
    const store = createContainedContentAddressedJsonArtifactStore({
      repoRoot: args.repoRoot,
      repositoryRealPath: fs.realpathSync(args.repoRoot),
      outputDir: args.outputDir,
      categories: ['bridge-manifests'] as const,
      rejectSymlinkAliases: true,
      errorPrefix: 'QA Wizard candidate bridge',
    });
    store.prepare();
    result = store.persist({
      category: 'bridge-manifests',
      digest: args.manifest.digest,
      value: args.manifest,
    });
  }
  return {
    path: repoRelativePath(args.repoRoot, destinationPath),
    digest: args.manifest.digest,
    created: result.created,
  };
}

export function persistQaWizardCanonicalSupervisorResultEvidence(args: {
  repoRoot: string;
  outputDir: string;
  result: unknown;
  write?: boolean;
}): QaWizardCandidateBridgeArtifactWrite {
  if (!canonicalSupervisorResultIsValid(args.result)) {
    throw new Error('canonical Supervisor execution result is invalid');
  }
  const digest = canonicalJsonDigest(args.result);
  const outputRoot = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, outputRoot);
  const destinationPath = path.join(
    outputRoot,
    'canonical-live-execution-results',
    `${digest}.json`,
  );
  let result = { created: false };
  if (args.write === true) {
    const store = createContainedContentAddressedJsonArtifactStore({
      repoRoot: args.repoRoot,
      repositoryRealPath: fs.realpathSync(args.repoRoot),
      outputDir: args.outputDir,
      categories: ['canonical-live-execution-results'] as const,
      rejectSymlinkAliases: true,
      errorPrefix: 'canonical Supervisor result capture',
    });
    store.prepare();
    result = store.persist({
      category: 'canonical-live-execution-results',
      digest,
      value: args.result,
    });
  }
  return {
    path: repoRelativePath(args.repoRoot, destinationPath),
    digest,
    created: result.created,
  };
}

export function captureQaWizardCanonicalSupervisorResultEvidence(
  args: CaptureQaWizardCanonicalSupervisorResultRequest,
): QaWizardCandidateBridgeArtifactWrite {
  const sourceAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.supervisorResultSourcePath,
    label: 'canonical Supervisor result capture source',
  });
  const result = readJsonObject(
    sourceAbsolute,
    'canonical Supervisor result capture source',
  );
  return persistQaWizardCanonicalSupervisorResultEvidence({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    result,
    write: args.write === true,
  });
}

export function qaWizardReconciliationApprovalAttestationIsValid(
  value: unknown,
): value is QaWizardReconciliationApprovalAttestation {
  if (
    !isObject(value) ||
    !exactKeys(value, [
      'version',
      'pendingManifestDigest',
      'reconciliationVersion',
      'reconciliationDigest',
      'reviewBundleVersion',
      'reviewBundleDigest',
      'reviewMarkdownSha256',
      'decision',
      'approvedBy',
      'approvedAt',
      'authorityScope',
      'doesNotAuthorize',
      'digestAlgorithm',
      'digest',
    ]) ||
    value.version !==
      QA_WIZARD_RECONCILIATION_APPROVAL_ATTESTATION_VERSION ||
    !isDigest(value.pendingManifestDigest) ||
    value.reconciliationVersion !== SOURCE_PROMPT_RECONCILIATION_VERSION ||
    !isDigest(value.reconciliationDigest) ||
    value.reviewBundleVersion !== RECONCILIATION_REVIEW_BUNDLE_VERSION ||
    !isDigest(value.reviewBundleDigest) ||
    !isDigest(value.reviewMarkdownSha256) ||
    value.decision !== 'approved' ||
    value.approvedBy !== 'Guy' ||
    !isoTimestampIsValid(value.approvedAt) ||
    value.authorityScope !==
      'reconciliation_exact_content_approval_only' ||
    !Array.isArray(value.doesNotAuthorize) ||
    canonicalJsonDigest(value.doesNotAuthorize) !==
      canonicalJsonDigest(
        QA_WIZARD_RECONCILIATION_APPROVAL_DOES_NOT_AUTHORIZE,
      ) ||
    value.digestAlgorithm !== 'canonical-json-sha256' ||
    !isDigest(value.digest) ||
    forbiddenEvidenceKey(value) !== null
  ) {
    return false;
  }
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = value;
  return value.digest === canonicalJsonDigest(payload);
}

function loadQaWizardReconciliationApprovalAttestation(args: {
  repoRoot: string;
  approvalAttestationPath: string;
}): QaWizardReconciliationApprovalAttestation {
  const absolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.approvalAttestationPath,
    label: 'reconciliation approval attestation',
  });
  const value = readJsonObject(
    absolute,
    'reconciliation approval attestation',
  );
  if (!qaWizardReconciliationApprovalAttestationIsValid(value)) {
    throw new Error('reconciliation approval attestation is invalid or tampered');
  }
  assertCanonicalJsonArtifact({
    absolutePath: absolute,
    value,
    digest: value.digest,
    category: 'reconciliation-approvals',
    label: 'reconciliation approval attestation',
  });
  return value;
}

export function recordQaWizardReconciliationApproval(
  args: RecordQaWizardReconciliationApprovalRequest,
): {
  attestation: QaWizardReconciliationApprovalAttestation;
  artifact: QaWizardCandidateBridgeArtifactWrite;
  approvedReconciliationArtifacts: ReturnType<
    typeof persistReconciliationDraftBundle
  >;
} {
  const pending = loadQaWizardCandidateBridgeManifest({
    repoRoot: args.repoRoot,
    manifestPath: args.pendingManifestPath,
  });
  if (
    pending.version !== QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION
  ) {
    throw new Error(
      'legacy QA Wizard bridge manifests are read-only and cannot be mutated',
    );
  }
  if (pending.stage !== 'reconciliation_pending') {
    throw new Error('reconciliation approval requires a pending bridge manifest');
  }
  assertSameBridgeOutputDir({
    repoRoot: args.repoRoot,
    manifestPath: args.pendingManifestPath,
    outputDir: args.outputDir,
  });
  if (args.approvedBy !== 'Guy' || !isoTimestampIsValid(args.approvedAt)) {
    throw new Error('reconciliation approval identity or timestamp is invalid');
  }
  const reconciliationAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.approvedReconciliationPath,
    label: 'approved reconciliation',
  });
  const reviewAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.approvedReviewBundlePath,
    label: 'approved reconciliation review bundle',
  });
  const markdownAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.approvedReviewMarkdownPath,
    label: 'approved reconciliation review markdown',
  });
  const reconciliation = readJsonObject(
    reconciliationAbsolute,
    'approved reconciliation',
  ) as unknown as SourcePromptReconciliation;
  if (
    reconciliation.version !== SOURCE_PROMPT_RECONCILIATION_VERSION ||
    reconciliation.review.status !== 'approved' ||
    reconciliation.review.reviewedBy !== 'Guy' ||
    reconciliation.review.reviewedAt !== args.approvedAt
  ) {
    throw new Error('reconciliation content does not carry the approved Guy review');
  }
  const snapshot = buildStorySourceAuthoritySnapshot({
    repoRoot: args.repoRoot,
    storyKey: pending.source.storyKey,
    storyPath: pending.source.storyPath,
  });
  const candidate = loadVisualContractCandidateForReconciliation({
    repoRoot: args.repoRoot,
    candidatePath: pending.visualContract.candidatePath,
    snapshot,
    expectedTemplateDigest: pending.visualContract.templateDigest,
  });
  const expectedReviewBundle = buildReconciliationReviewBundle({
    reconciliation,
    sourceIdentity: snapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: snapshot.digest,
    rawStorySource: snapshot.content.normalizedRawStorySource,
    template: candidate.template,
    ...(snapshot.content.authoredCoverAuthority
      ? { authoredCoverAuthority: snapshot.content.authoredCoverAuthority }
      : {}),
    actionSemanticCoverage:
      reconciliation.actionSemanticCoverageAuthority.records,
  });
  const persistedReview = readJsonObject(
    reviewAbsolute,
    'approved reconciliation review bundle',
  );
  const expectedMarkdown = renderReconciliationReviewMarkdown(
    expectedReviewBundle,
  );
  if (
    !expectedReviewBundle.readyForApproval ||
    expectedReviewBundle.blockingIssues.length !== 0 ||
    canonicalContentAddressedJsonBytes(persistedReview) !==
      canonicalContentAddressedJsonBytes(expectedReviewBundle) ||
    fs.readFileSync(markdownAbsolute, 'utf8') !== expectedMarkdown
  ) {
    throw new Error('reconciliation approval packet is stale or incomplete');
  }
  const payload = {
    version: QA_WIZARD_RECONCILIATION_APPROVAL_ATTESTATION_VERSION,
    pendingManifestDigest: pending.digest,
    reconciliationVersion: reconciliation.version,
    reconciliationDigest: canonicalJsonDigest(reconciliation),
    reviewBundleVersion: expectedReviewBundle.version,
    reviewBundleDigest: expectedReviewBundle.digest,
    reviewMarkdownSha256: sha256Utf8(expectedMarkdown),
    decision: 'approved' as const,
    approvedBy: 'Guy' as const,
    approvedAt: args.approvedAt,
    authorityScope: 'reconciliation_exact_content_approval_only' as const,
    doesNotAuthorize: [
      ...QA_WIZARD_RECONCILIATION_APPROVAL_DOES_NOT_AUTHORIZE,
    ],
  };
  const attestation: QaWizardReconciliationApprovalAttestation = {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(payload),
  };
  if (!qaWizardReconciliationApprovalAttestationIsValid(attestation)) {
    throw new Error('reconciliation approval attestation construction failed');
  }
  if (args.write === true) {
    prepareBridgeOutputRoot({
      repoRoot: args.repoRoot,
      outputDir: args.outputDir,
    });
  }
  const approvedReconciliationArtifacts = persistReconciliationDraftBundle({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    reconciliation,
    reviewBundle: expectedReviewBundle,
    markdown: expectedMarkdown,
    write: args.write === true,
  });
  const outputRoot = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, outputRoot);
  const destinationPath = path.join(
    outputRoot,
    'reconciliation-approvals',
    `${attestation.digest}.json`,
  );
  let persistence = { created: false };
  if (args.write === true) {
    const store = createContainedContentAddressedJsonArtifactStore({
      repoRoot: args.repoRoot,
      repositoryRealPath: fs.realpathSync(args.repoRoot),
      outputDir: args.outputDir,
      categories: ['reconciliation-approvals'] as const,
      rejectSymlinkAliases: true,
      errorPrefix: 'reconciliation approval attestation',
    });
    store.prepare();
    persistence = store.persist({
      category: 'reconciliation-approvals',
      digest: attestation.digest,
      value: attestation,
    });
  }
  return {
    attestation,
    artifact: {
      path: repoRelativePath(args.repoRoot, destinationPath),
      digest: attestation.digest,
      created: persistence.created,
    },
    approvedReconciliationArtifacts,
  };
}

function loadCanonicalRequest(args: {
  repoRoot: string;
  requestPath: string;
}): VisualContractAuthoringRequest {
  return readJsonObject(
    resolveExistingContainedArtifact({
      repoRoot: args.repoRoot,
      relativePath: args.requestPath,
      label: 'Visual Contract authoring request',
    }),
    'Visual Contract authoring request',
  ) as unknown as VisualContractAuthoringRequest;
}

export function loadQaWizardCandidateBridgeManifest(args: {
  repoRoot: string;
  manifestPath: string;
}): QaWizardCandidateBridgeManifest {
  const absolutePath = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.manifestPath,
    label: 'QA Wizard bridge manifest',
  });
  const raw = readJsonObject(absolutePath, 'QA Wizard bridge manifest');
  if (!qaWizardCandidateBridgeManifestIsValid(raw)) {
    throw new Error('QA Wizard candidate bridge manifest is invalid or tampered');
  }
  const bridgeOutputDir = bridgeOutputDirFromManifestPath(args.manifestPath);
  if (
    path.basename(absolutePath) !== `${raw.digest}.json` ||
    path.basename(path.dirname(absolutePath)) !== 'bridge-manifests' ||
    fs.readFileSync(absolutePath, 'utf8') !==
      canonicalContentAddressedJsonBytes(raw)
  ) {
    throw new Error(
      'QA Wizard candidate bridge manifest path or bytes are not canonical',
    );
  }
  for (const [label, artifactPath] of [
    ['Story Source', raw.source.storyPath],
    ['source snapshot', raw.source.snapshotPath],
    ['Fresh Readiness evidence', raw.supervisor.freshReadinessPath],
    ['Supervisor execution request', raw.supervisor.executionRequestPath],
    ['Supervisor execution result', raw.supervisor.executionResultPath],
    ['Visual Contract request', raw.visualContract.requestPath],
    ['Visual Contract receipt', raw.visualContract.receiptPath],
    ['Visual Contract readiness', raw.visualContract.readinessPath],
    ['Visual Contract candidate', raw.visualContract.candidatePath],
    ['Visual Contract template', raw.visualContract.templatePath],
    ['reconciliation', raw.reconciliation.path],
    ['reconciliation review bundle', raw.reconciliation.reviewBundlePath],
    ['reconciliation review markdown', raw.reconciliation.reviewMarkdownPath],
  ] as const) {
    resolveExistingContainedArtifact({
      repoRoot: args.repoRoot,
      relativePath: artifactPath,
      label,
    });
  }
  const supervisor = loadCanonicalSupervisorAuthority({
    repoRoot: args.repoRoot,
    freshReadinessPath: raw.supervisor.freshReadinessPath,
    executionRequestPath: raw.supervisor.executionRequestPath,
    executionResultPath: raw.supervisor.executionResultPath,
    authoringRequestPath: raw.visualContract.requestPath,
    authoringReceiptPath: raw.visualContract.receiptPath,
    authoringReadinessPath: raw.visualContract.readinessPath,
    candidatePath: raw.visualContract.candidatePath,
  });
  if (
    supervisor.freshReadiness.digest !==
      raw.supervisor.freshReadinessDigest ||
    supervisor.executionRequest.digest !==
      raw.supervisor.executionRequestDigest ||
    supervisor.executionResultDigest !==
      raw.supervisor.executionResultDigest ||
    supervisor.executionResult.outputAuthority?.digest !==
      raw.supervisor.childOutputAuthorityDigest
  ) {
    throw new Error('QA Wizard bridge Supervisor authority is stale or tampered');
  }
  if (
    raw.version === QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION
  ) {
    loadAndValidateCandidateTemplateProjection({
      repoRoot: args.repoRoot,
      bridgeOutputDir,
      storyKey: raw.source.storyKey,
      storyPath: raw.source.storyPath,
      candidatePath: raw.visualContract.candidatePath,
      templatePath: raw.visualContract.templatePath,
      expectedCandidateDigest: raw.visualContract.candidateDigest,
      expectedTemplateDigest: raw.visualContract.templateDigest,
      expectedTemplateSchemaVersion:
        raw.visualContract.templateSchemaVersion,
    });
  }
  if (raw.stage === 'reconciliation_pending') {
    const reconstructedCurrent = prepareQaWizardCandidateReconciliation({
      repoRoot: args.repoRoot,
      outputDir: bridgeOutputDir,
      storyKey: raw.source.storyKey,
      storyPath: raw.source.storyPath,
      candidatePath: raw.visualContract.candidatePath,
      authoringRequestPath: raw.visualContract.requestPath,
      authoringReceiptPath: raw.visualContract.receiptPath,
      authoringReadinessPath: raw.visualContract.readinessPath,
      freshReadinessPath: raw.supervisor.freshReadinessPath,
      supervisorExecutionRequestPath:
        raw.supervisor.executionRequestPath,
      supervisorExecutionResultPath:
        raw.supervisor.executionResultPath,
      write: false,
    });
    let reconstructedManifest = reconstructedCurrent.manifest;
    if (
      raw.version ===
      QA_WIZARD_CANDIDATE_BRIDGE_LEGACY_MANIFEST_VERSION
    ) {
      const {
        digestAlgorithm: _digestAlgorithm,
        digest: _digest,
        ...currentPayload
      } = reconstructedCurrent.manifest;
      reconstructedManifest = buildManifest({
        ...currentPayload,
        version:
          QA_WIZARD_CANDIDATE_BRIDGE_LEGACY_MANIFEST_VERSION,
        visualContract: {
          ...currentPayload.visualContract,
          templatePath: raw.visualContract.templatePath,
        },
      });
    }
    if (
      canonicalContentAddressedJsonBytes(reconstructedManifest) !==
      canonicalContentAddressedJsonBytes(raw)
    ) {
      throw new Error(
        'QA Wizard candidate bridge manifest no longer matches its upstream authority',
      );
    }
    const snapshot = buildStorySourceAuthoritySnapshot({
      repoRoot: args.repoRoot,
      storyKey: raw.source.storyKey,
      storyPath: raw.source.storyPath,
    });
    const rebuiltBundle =
      raw.version ===
      QA_WIZARD_CANDIDATE_BRIDGE_LEGACY_MANIFEST_VERSION
        ? buildProductionReconciliationDraftFromFiles({
            repoRoot: args.repoRoot,
            storyKey: raw.source.storyKey,
            storyPath: raw.source.storyPath,
            templatePath: raw.visualContract.templatePath,
            candidatePath: raw.visualContract.candidatePath,
          })
        : buildProductionReconciliationDraftFromVisualContractCandidate({
            snapshot,
            candidate: loadVisualContractCandidateForReconciliation({
              repoRoot: args.repoRoot,
              candidatePath: raw.visualContract.candidatePath,
              snapshot,
              expectedTemplateDigest:
                raw.visualContract.templateDigest,
            }),
          });
    const persistedSnapshot = readJsonObject(
      resolveExistingContainedArtifact({
        repoRoot: args.repoRoot,
        relativePath: raw.source.snapshotPath,
        label: 'source snapshot',
      }),
      'source snapshot',
    );
    const persistedReconciliation = readJsonObject(
      resolveExistingContainedArtifact({
        repoRoot: args.repoRoot,
        relativePath: raw.reconciliation.path,
        label: 'reconciliation',
      }),
      'reconciliation',
    );
    const persistedReview = readJsonObject(
      resolveExistingContainedArtifact({
        repoRoot: args.repoRoot,
        relativePath: raw.reconciliation.reviewBundlePath,
        label: 'reconciliation review bundle',
      }),
      'reconciliation review bundle',
    );
    const persistedMarkdownPath = resolveExistingContainedArtifact({
      repoRoot: args.repoRoot,
      relativePath: raw.reconciliation.reviewMarkdownPath,
      label: 'reconciliation review markdown',
    });
    if (
      canonicalContentAddressedJsonBytes(persistedSnapshot) !==
        canonicalContentAddressedJsonBytes(snapshot) ||
      canonicalContentAddressedJsonBytes(persistedReconciliation) !==
        canonicalContentAddressedJsonBytes(rebuiltBundle.reconciliation) ||
      canonicalContentAddressedJsonBytes(persistedReview) !==
        canonicalContentAddressedJsonBytes(rebuiltBundle.reviewBundle) ||
      fs.readFileSync(persistedMarkdownPath, 'utf8') !== rebuiltBundle.markdown
    ) {
      throw new Error(
        'QA Wizard candidate bridge referenced artifacts are stale or tampered',
      );
    }
  } else {
    const pendingManifest = loadQaWizardCandidateBridgeManifest({
      repoRoot: args.repoRoot,
      manifestPath: `${bridgeOutputDir}/bridge-manifests/${raw.reconciliation.pendingManifestDigest}.json`,
    });
    const approval = loadQaWizardReconciliationApprovalAttestation({
      repoRoot: args.repoRoot,
      approvalAttestationPath:
        raw.reconciliation.approvalAttestationPath!,
    });
    if (
      approval.version !== raw.reconciliation.approvalAttestationVersion ||
      approval.digest !== raw.reconciliation.approvalAttestationDigest ||
      approval.pendingManifestDigest !==
        raw.reconciliation.pendingManifestDigest ||
      approval.reconciliationDigest !== raw.reconciliation.digest ||
      approval.reviewBundleDigest !== raw.reconciliation.reviewBundleDigest ||
      approval.approvedAt !== raw.reconciliation.reviewedAt ||
      !relativePathIsWithin(
        bridgeOutputDir,
        raw.reconciliation.approvalAttestationPath!,
      ) ||
      pendingManifest.stage !== 'reconciliation_pending' ||
      pendingManifest.version !== raw.version ||
      pendingManifest.digest !== approval.pendingManifestDigest ||
      canonicalJsonDigest(pendingManifest.source) !==
        canonicalJsonDigest(raw.source) ||
      canonicalJsonDigest(pendingManifest.supervisor) !==
        canonicalJsonDigest(raw.supervisor) ||
      canonicalJsonDigest(pendingManifest.visualContract) !==
        canonicalJsonDigest(raw.visualContract)
    ) {
      throw new Error(
        'QA Wizard bridge reconciliation approval is stale or tampered',
      );
    }
    const approvedMarkdown = fs.readFileSync(
      resolveExistingContainedArtifact({
        repoRoot: args.repoRoot,
        relativePath: raw.reconciliation.reviewMarkdownPath,
        label: 'approved reconciliation review markdown',
      }),
      'utf8',
    );
    if (approval.reviewMarkdownSha256 !== sha256Utf8(approvedMarkdown)) {
      throw new Error(
        'QA Wizard bridge approved review markdown no longer matches its attestation',
      );
    }
    const context = buildProductionAuthoringContext({
      repoRoot: args.repoRoot,
      storyKey: raw.source.storyKey,
      storyPath: raw.source.storyPath,
      templatePath: raw.visualContract.templatePath,
      reconciliationPath: raw.reconciliation.path,
      candidatePath: raw.visualContract.candidatePath,
      styleId: raw.productionContext!.styleId,
      styleAuthorityPath: raw.productionContext!.styleAuthorityPath,
      expectedStyleAuthorityDigest:
        raw.productionContext!.styleAuthorityDigest,
    });
    const expectedReviewBundle = buildReconciliationReviewBundle({
      reconciliation: context.reconciliation.content,
      sourceIdentity: context.sourceSnapshot.identity,
      sourceAuthoritySnapshotDigest: raw.source.snapshotDigest,
      rawStorySource: context.sourceSnapshot.content,
      template: context.template.content,
      ...(context.authoredCoverAuthority
        ? { authoredCoverAuthority: context.authoredCoverAuthority }
        : {}),
      actionSemanticCoverage:
        context.reconciliation.content.actionSemanticCoverageAuthority.records,
    });
    const persistedReviewBundle = readJsonObject(
      resolveExistingContainedArtifact({
        repoRoot: args.repoRoot,
        relativePath: raw.reconciliation.reviewBundlePath,
        label: 'approved reconciliation review bundle',
      }),
      'approved reconciliation review bundle',
    );
    const expectedMarkdown = renderReconciliationReviewMarkdown(
      expectedReviewBundle,
    );
    if (
      context.digest !== raw.productionContext!.digest ||
      approval.reconciliationDigest !== raw.reconciliation.digest ||
      approval.reviewBundleDigest !== raw.reconciliation.reviewBundleDigest ||
      approval.reviewBundleDigest !== expectedReviewBundle.digest ||
      canonicalContentAddressedJsonBytes(persistedReviewBundle) !==
        canonicalContentAddressedJsonBytes(expectedReviewBundle) ||
      approvedMarkdown !== expectedMarkdown
    ) {
      throw new Error(
        'QA Wizard bridge approved context no longer matches its exact approval',
      );
    }
  }
  return raw;
}

function loadCanonicalReceipt(args: {
  repoRoot: string;
  receiptPath: string;
}): VisualContractAuthoringReceipt {
  const receiptAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.receiptPath,
    label: 'Visual Contract authoring receipt',
  });
  return readJsonObject(
    receiptAbsolute,
    'Visual Contract authoring receipt',
  ) as unknown as VisualContractAuthoringReceipt;
}

function loadCanonicalReadiness(args: {
  repoRoot: string;
  readinessPath: string;
}): VisualContractAuthoringReadinessEvidence {
  return readJsonObject(
    resolveExistingContainedArtifact({
      repoRoot: args.repoRoot,
      relativePath: args.readinessPath,
      label: 'Visual Contract authoring readiness',
    }),
    'Visual Contract authoring readiness',
  ) as unknown as VisualContractAuthoringReadinessEvidence;
}

export function prepareQaWizardCandidateReconciliation(
  args: PrepareQaWizardCandidateReconciliationRequest,
): {
  manifest: QaWizardCandidateBridgeManifest;
  manifestArtifact: QaWizardCandidateBridgeArtifactWrite;
  sourceSnapshotArtifact: ReturnType<
    typeof persistStorySourceAuthoritySnapshot
  >;
  templateProjectionArtifact: QaWizardCandidateBridgeArtifactWrite;
  reconciliationArtifacts: ReturnType<
    typeof persistReconciliationDraftBundle
  >;
} {
  for (const [label, artifactPath] of [
    ['Story Source', args.storyPath],
    ['Visual Contract candidate', args.candidatePath],
    ['Visual Contract request', args.authoringRequestPath],
    ['Visual Contract receipt', args.authoringReceiptPath],
    ['Visual Contract readiness', args.authoringReadinessPath],
    ['canonical Fresh Readiness evidence', args.freshReadinessPath],
    ['canonical Supervisor execution request', args.supervisorExecutionRequestPath],
    ['canonical Supervisor execution result', args.supervisorExecutionResultPath],
  ] as const) {
    resolveExistingContainedArtifact({
      repoRoot: args.repoRoot,
      relativePath: artifactPath,
      label,
    });
  }
  const supervisor = loadCanonicalSupervisorAuthority({
    repoRoot: args.repoRoot,
    freshReadinessPath: args.freshReadinessPath,
    executionRequestPath: args.supervisorExecutionRequestPath,
    executionResultPath: args.supervisorExecutionResultPath,
    authoringRequestPath: args.authoringRequestPath,
    authoringReceiptPath: args.authoringReceiptPath,
    authoringReadinessPath: args.authoringReadinessPath,
    candidatePath: args.candidatePath,
  });
  const snapshot = buildStorySourceAuthoritySnapshot({
    repoRoot: args.repoRoot,
    storyKey: args.storyKey,
    storyPath: args.storyPath,
  });
  assertValidStorySourceAuthoritySnapshot(snapshot);
  const candidateAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.candidatePath,
    label: 'Visual Contract candidate',
  });
  const candidate = readJsonObject(
    candidateAbsolute,
    'Visual Contract candidate',
  ) as unknown as VisualContractCandidateArtifact;
  assertVisualContractCandidateForReconciliation({ snapshot, candidate });
  const bundle =
    buildProductionReconciliationDraftFromVisualContractCandidate({
      snapshot,
      candidate,
    });
  const request = loadCanonicalRequest({
    repoRoot: args.repoRoot,
    requestPath: args.authoringRequestPath,
  });
  const rebuiltRequest = buildVisualContractAuthoringRequest({
    snapshot,
    mode: request.mode,
    requestId: request.requestId,
    requestedAt: request.requestedAt,
  });
  if (
    canonicalContentAddressedJsonBytes(rebuiltRequest) !==
    canonicalContentAddressedJsonBytes(request)
  ) {
    throw new Error(
      'Visual Contract authoring request is stale or violates the current canonical policy',
    );
  }
  assertCanonicalJsonArtifact({
    absolutePath: resolveRepoPath(args.repoRoot, args.authoringRequestPath),
    value: request,
    digest: request.digest,
    category: 'authoring-requests',
    label: 'Visual Contract authoring request',
  });
  const receipt = loadCanonicalReceipt({
    repoRoot: args.repoRoot,
    receiptPath: args.authoringReceiptPath,
  });
  assertCanonicalJsonArtifact({
    absolutePath: resolveRepoPath(args.repoRoot, args.authoringReceiptPath),
    value: receipt,
    digest: receipt.digest,
    category: 'authoring-receipts',
    label: 'Visual Contract authoring receipt',
  });
  const receiptBoundCandidate = buildVisualContractCandidateArtifact({
    request,
    receipt,
    compileResult: {
      template: candidate.template,
      actionSemanticCoverage: candidate.actionSemanticCoverage,
    },
  });
  if (
    receiptBoundCandidate.digest !== candidate.digest ||
    canonicalContentAddressedJsonBytes(receiptBoundCandidate) !==
      canonicalContentAddressedJsonBytes(candidate)
  ) {
    throw new Error(
      'Visual Contract candidate does not match the exact canonical authoring receipt',
    );
  }
  const readiness = loadCanonicalReadiness({
    repoRoot: args.repoRoot,
    readinessPath: args.authoringReadinessPath,
  });
  assertCanonicalJsonArtifact({
    absolutePath: resolveRepoPath(args.repoRoot, args.authoringReadinessPath),
    value: readiness,
    digest: readiness.digest,
    category: 'readiness-evidence',
    label: 'Visual Contract authoring readiness',
  });
  assertCanonicalJsonArtifact({
    absolutePath: candidateAbsolute,
    value: candidate,
    digest: candidate.digest,
    category: 'contract-candidates',
    label: 'Visual Contract candidate',
  });
  persistVisualContractAuthoringReadiness({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    request,
    evidence: readiness,
    receipt,
    write: false,
  });
  if (
    readiness.sourceSnapshotDigest !== snapshot.digest ||
    readiness.authoringRequestDigest !== request.digest ||
    readiness.authoringReceiptDigest !== receipt.digest ||
    readiness.visualContractCandidate.status !== 'candidate' ||
    readiness.visualContractCandidate.digest !== candidate.templateDigest ||
    supervisor.freshReadiness.canonicalAuthorities.b0.sourceSnapshotDigest !==
      snapshot.digest ||
    supervisor.freshReadiness.canonicalAuthorities.b0.liveAuthoringRequestDigest !==
      request.digest ||
    request.mode !== 'live' ||
    receipt.status !== 'completed' ||
    receipt.executionAttestation.evidenceKind !==
      'canonical_adapter_observed' ||
    receipt.executionAttestation.logicalProviderCalls !== receipt.callCount ||
    receipt.executionAttestation.transportDispatchCount !== receipt.callCount ||
    receipt.executionAttestation.transportRetryCount !== 0 ||
    receipt.executionAttestation.fallbackUsed !== false ||
    receipt.executionAttestation.canonicalRouteConfirmed !== true ||
    receipt.executionAttestation.canonicalModelConfirmed !== true ||
    candidate.authoringRequestDigest !== request.digest ||
    candidate.authoringReceiptDigest !== receipt.digest ||
    receipt.requestDigest !== request.digest ||
    receipt.sourceSnapshotDigest !== snapshot.digest ||
    supervisor.freshReadiness.request.storySourceKey !== args.storyKey ||
    supervisor.freshReadiness.request.storySourcePath !==
      snapshot.content.sourceIdentity.path ||
    supervisor.materializationManifest.sourceRevision.storyKey !== args.storyKey ||
    supervisor.materializationManifest.sourceRevision.storyPath !==
      snapshot.content.sourceIdentity.path ||
    supervisor.materializationManifest.sourceRevision.normalizedSourceDigest !==
      snapshot.content.sourceIdentity.digest ||
    supervisor.materializationManifest.sourceRevision.sourceSnapshotDigest !==
      snapshot.digest ||
    supervisor.materializationManifest.artifacts.sourceSnapshot.path !==
      commandFlag(supervisor.executionRequest, '--snapshot') ||
    supervisor.materializationManifest.artifacts.sourceAuthorityRequest.path !==
      commandFlag(supervisor.executionRequest, '--source-authority-request') ||
    supervisor.freshReadiness.canonicalAuthorities.b0.normalizedSourceDigest !==
      snapshot.content.sourceIdentity.digest ||
    supervisor.freshReadiness.canonicalAuthorities.b0.sourceAuthorityRequestDigest !==
      supervisor.materializationManifest.artifacts.sourceAuthorityRequest.digest ||
    supervisor.freshReadiness.request.credentialSourcePathSha256 !==
      sha256Utf8(supervisor.executionRequest.credentialIsolation.sourcePath)
  ) {
    throw new Error(
      'Visual Contract request, receipt, readiness, candidate, and source authority are not exactly cross-bound',
    );
  }

  if (args.write === true) {
    prepareBridgeOutputRoot({
      repoRoot: args.repoRoot,
      outputDir: args.outputDir,
    });
  }

  const templateProjectionArtifact = persistCandidateTemplateProjection({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    candidate,
    write: args.write === true,
  });
  if (args.write === true) {
    loadAndValidateCandidateTemplateProjection({
      repoRoot: args.repoRoot,
      bridgeOutputDir: repoRelativePath(
        args.repoRoot,
        path.resolve(args.repoRoot, args.outputDir),
      ),
      storyKey: args.storyKey,
      storyPath: args.storyPath,
      candidatePath: args.candidatePath,
      templatePath: templateProjectionArtifact.path,
      expectedCandidateDigest: candidate.digest,
      expectedTemplateDigest: candidate.templateDigest,
      expectedTemplateSchemaVersion: candidate.template.schemaVersion,
    });
  }

  const sourceSnapshotArtifact = persistStorySourceAuthoritySnapshot({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    snapshot,
    write: args.write === true,
  });
  const reconciliationArtifacts = persistReconciliationDraftBundle({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    reconciliation: bundle.reconciliation,
    reviewBundle: bundle.reviewBundle,
    markdown: bundle.markdown,
    write: args.write === true,
  });
  const manifest = buildManifest({
    version: QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION,
    stage: 'reconciliation_pending',
    source: {
      storyKey: args.storyKey,
      storyPath: repoRelativePath(
        args.repoRoot,
        resolveRepoPath(args.repoRoot, args.storyPath),
      ),
      sourceDigest: snapshot.content.sourceIdentity.digest,
      snapshotVersion: snapshot.version,
      snapshotDigest: snapshot.digest,
      snapshotPath: sourceSnapshotArtifact.path,
    },
    supervisor: {
      freshReadinessVersion: supervisor.freshReadiness.version,
      freshReadinessDigest: supervisor.freshReadiness.digest,
      freshReadinessPath: repoRelativePath(
        args.repoRoot,
        resolveRepoPath(args.repoRoot, args.freshReadinessPath),
      ),
      executionRequestVersion: supervisor.executionRequest.version,
      executionRequestDigest: supervisor.executionRequest.digest,
      executionRequestPath: repoRelativePath(
        args.repoRoot,
        resolveRepoPath(args.repoRoot, args.supervisorExecutionRequestPath),
      ),
      executionResultVersion: supervisor.executionResult.version,
      executionResultDigest: supervisor.executionResultDigest,
      executionResultPath: repoRelativePath(
        args.repoRoot,
        resolveRepoPath(args.repoRoot, args.supervisorExecutionResultPath),
      ),
      childOutputAuthorityVersion:
        supervisor.executionResult.outputAuthority!.version,
      childOutputAuthorityDigest:
        supervisor.executionResult.outputAuthority!.digest,
      repositoryBranch:
        supervisor.freshReadiness.repositoryAuthority.branchRef,
      repositoryHead:
        supervisor.freshReadiness.repositoryAuthority.head,
    },
    visualContract: {
      requestVersion: request.version,
      requestDigest: request.digest,
      requestPath: repoRelativePath(
        args.repoRoot,
        resolveRepoPath(args.repoRoot, args.authoringRequestPath),
      ),
      candidateVersion: candidate.version,
      candidateDigest: candidate.digest,
      candidatePath: repoRelativePath(
        args.repoRoot,
        resolveRepoPath(args.repoRoot, args.candidatePath),
      ),
      templateSchemaVersion: candidate.template.schemaVersion,
      templateDigest: candidate.templateDigest,
      templatePath: templateProjectionArtifact.path,
      receiptVersion: receipt.version,
      receiptDigest: receipt.digest,
      receiptPath: repoRelativePath(
        args.repoRoot,
        resolveRepoPath(args.repoRoot, args.authoringReceiptPath),
      ),
      readinessVersion: readiness.version,
      readinessDigest: readiness.digest,
      readinessPath: repoRelativePath(
        args.repoRoot,
        resolveRepoPath(args.repoRoot, args.authoringReadinessPath),
      ),
      actionSemanticCoverageDigest:
        candidate.actionSemanticCoverageDigest,
      sourceEvidenceCatalogDigest:
        candidate.sourceEvidenceCatalogDigest,
    },
    reconciliation: {
      version: bundle.reconciliation.version,
      digest: bundle.reviewBundle.reconciliationDigest,
      path: reconciliationArtifacts.reconciliationPath,
      reviewBundleVersion: bundle.reviewBundle.version,
      reviewBundleDigest: bundle.reviewBundle.digest,
      reviewBundlePath: reconciliationArtifacts.reviewBundlePath,
      reviewMarkdownPath: reconciliationArtifacts.markdownPath,
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      approvalAttestationVersion: null,
      approvalAttestationDigest: null,
      approvalAttestationPath: null,
      pendingManifestDigest: null,
    },
    productionContext: null,
    blueprint: null,
    visualPackage: null,
    wizard: null,
    doesNotAuthorize: [
      ...QA_WIZARD_CANDIDATE_BRIDGE_DOES_NOT_AUTHORIZE,
    ],
  });
  const manifestArtifact = persistQaWizardCandidateBridgeManifest({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    manifest,
    write: args.write === true,
  });
  return {
    manifest,
    manifestArtifact,
    sourceSnapshotArtifact,
    templateProjectionArtifact,
    reconciliationArtifacts,
  };
}

export function advanceQaWizardApprovedReconciliation(
  args: AdvanceQaWizardApprovedReconciliationRequest,
): {
  manifest: QaWizardCandidateBridgeManifest;
  manifestArtifact: QaWizardCandidateBridgeArtifactWrite;
  context: ProductionAuthoringContext;
} {
  const previous = loadQaWizardCandidateBridgeManifest({
    repoRoot: args.repoRoot,
    manifestPath: args.bridgeManifestPath,
  });
  if (
    previous.version !== QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION
  ) {
    throw new Error(
      'legacy QA Wizard bridge manifests are read-only and cannot be mutated',
    );
  }
  if (previous.stage !== 'reconciliation_pending') {
    throw new Error(
      'QA Wizard bridge can advance reconciliation only from reconciliation_pending',
    );
  }
  const bridgeOutputDir = assertSameBridgeOutputDir({
    repoRoot: args.repoRoot,
    manifestPath: args.bridgeManifestPath,
    outputDir: args.outputDir,
  });
  for (const [label, artifactPath] of [
    ['approved reconciliation', args.approvedReconciliationPath],
    ['approved reconciliation review bundle', args.approvedReviewBundlePath],
    ['approved reconciliation review markdown', args.approvedReviewMarkdownPath],
    ['reconciliation approval attestation', args.approvalAttestationPath],
    ['production style authority', args.styleAuthorityPath],
  ] as const) {
    resolveExistingContainedArtifact({
      repoRoot: args.repoRoot,
      relativePath: artifactPath,
      label,
    });
  }
  const context = buildProductionAuthoringContext({
    repoRoot: args.repoRoot,
    storyKey: previous.source.storyKey,
    storyPath: previous.source.storyPath,
    templatePath: previous.visualContract.templatePath,
    reconciliationPath: args.approvedReconciliationPath,
    candidatePath: previous.visualContract.candidatePath,
    styleId: args.styleId,
    styleAuthorityPath: args.styleAuthorityPath,
    ...(args.expectedStyleAuthorityDigest
      ? {
          expectedStyleAuthorityDigest:
            args.expectedStyleAuthorityDigest,
        }
      : {}),
  });
  if (
    context.reconciliation.content.review.status !== 'approved' ||
    context.reconciliation.content.review.reviewedBy !== 'Guy' ||
    !isoTimestampIsValid(
      context.reconciliation.content.review.reviewedAt,
    )
  ) {
    throw new Error(
      'approved reconciliation must carry exact Guy review authority',
    );
  }
  if (
    context.sourceSnapshot.identity.digest !== previous.source.sourceDigest ||
    context.template.identity.digest !== previous.visualContract.templateDigest
  ) {
    throw new Error('approved reconciliation context is stale');
  }

  const expectedReviewBundle = buildReconciliationReviewBundle({
    reconciliation: context.reconciliation.content,
    sourceIdentity: context.sourceSnapshot.identity,
    sourceAuthoritySnapshotDigest: previous.source.snapshotDigest,
    rawStorySource: context.sourceSnapshot.content,
    template: context.template.content,
    ...(context.authoredCoverAuthority
      ? { authoredCoverAuthority: context.authoredCoverAuthority }
      : {}),
    actionSemanticCoverage:
      context.reconciliation.content.actionSemanticCoverageAuthority.records,
  });
  if (!expectedReviewBundle.readyForApproval) {
    throw new Error(
      'approved reconciliation still has blocking semantic review issues',
    );
  }
  const reviewBundleAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.approvedReviewBundlePath,
    label: 'approved reconciliation review bundle',
  });
  const persistedReviewBundle = readJsonObject(
    reviewBundleAbsolute,
    'approved reconciliation review bundle',
  );
  if (
    canonicalContentAddressedJsonBytes(persistedReviewBundle) !==
    canonicalContentAddressedJsonBytes(expectedReviewBundle)
  ) {
    throw new Error(
      'approved reconciliation review bundle is stale or does not bind the exact reviewed content',
    );
  }
  const markdownAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.approvedReviewMarkdownPath,
    label: 'approved reconciliation review markdown',
  });
  const expectedMarkdown = renderReconciliationReviewMarkdown(
    expectedReviewBundle,
  );
  if (
    !fs.existsSync(markdownAbsolute) ||
    fs.readFileSync(markdownAbsolute, 'utf8') !== expectedMarkdown
  ) {
    throw new Error(
      'approved reconciliation review markdown is stale or missing',
    );
  }
  const approvalAttestation =
    loadQaWizardReconciliationApprovalAttestation({
      repoRoot: args.repoRoot,
      approvalAttestationPath: args.approvalAttestationPath,
    });
  const expectedApprovedReconciliationPath =
    `${bridgeOutputDir}/reconciliations/${context.reconciliation.digest}.json`;
  const expectedApprovedReviewBundlePath =
    `${bridgeOutputDir}/reviews/${expectedReviewBundle.digest}.json`;
  const expectedApprovedReviewMarkdownPath =
    `${bridgeOutputDir}/reviews/${expectedReviewBundle.digest}.md`;
  const expectedApprovalAttestationPath =
    `${bridgeOutputDir}/reconciliation-approvals/${approvalAttestation.digest}.json`;
  if (
    args.approvedReconciliationPath !== expectedApprovedReconciliationPath ||
    args.approvedReviewBundlePath !== expectedApprovedReviewBundlePath ||
    args.approvedReviewMarkdownPath !== expectedApprovedReviewMarkdownPath ||
    args.approvalAttestationPath !== expectedApprovalAttestationPath ||
    approvalAttestation.pendingManifestDigest !== previous.digest ||
    approvalAttestation.reconciliationDigest !==
      context.reconciliation.digest ||
    approvalAttestation.reviewBundleDigest !==
      expectedReviewBundle.digest ||
    approvalAttestation.reviewMarkdownSha256 !==
      sha256Utf8(expectedMarkdown) ||
    approvalAttestation.approvedAt !==
      context.reconciliation.content.review.reviewedAt ||
    !relativePathIsWithin(
      bridgeOutputDir,
      args.approvalAttestationPath,
    )
  ) {
    throw new Error(
      'reconciliation approval attestation does not bind the exact approved content',
    );
  }

  const {
    digestAlgorithm: _previousDigestAlgorithm,
    digest: _previousDigest,
    ...previousPayload
  } = previous;
  const manifest = buildManifest({
    ...previousPayload,
    stage: 'reconciliation_approved',
    reconciliation: {
      version: context.reconciliation.content.version,
      digest: context.reconciliation.digest,
      path: context.reconciliation.artifactPath,
      reviewBundleVersion: expectedReviewBundle.version,
      reviewBundleDigest: expectedReviewBundle.digest,
      reviewBundlePath: repoRelativePath(
        args.repoRoot,
        reviewBundleAbsolute,
      ),
      reviewMarkdownPath: repoRelativePath(
        args.repoRoot,
        markdownAbsolute,
      ),
      status: 'approved',
      reviewedBy: 'Guy',
      reviewedAt:
        context.reconciliation.content.review.reviewedAt,
      approvalAttestationVersion: approvalAttestation.version,
      approvalAttestationDigest: approvalAttestation.digest,
      approvalAttestationPath: repoRelativePath(
        args.repoRoot,
        resolveRepoPath(args.repoRoot, args.approvalAttestationPath),
      ),
      pendingManifestDigest: previous.digest,
    },
    productionContext: {
      version: context.version,
      digest: context.digest,
      styleId: context.styleId,
      styleAuthorityPath:
        context.styleAuthority.identity.artifactPath,
      styleAuthorityDigest:
        context.styleAuthority.identity.digest,
    },
  });
  const manifestArtifact = persistQaWizardCandidateBridgeManifest({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    manifest,
    write: args.write === true,
  });
  return { manifest, manifestArtifact, context };
}
