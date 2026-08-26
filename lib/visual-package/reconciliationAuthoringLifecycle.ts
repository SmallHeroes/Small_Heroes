import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { ActionSemanticCoverageRecord } from '@/lib/visual-contract-compiler/actionSemanticCoverage';

import {
  buildQaWizardReconciliationApprovalAttestation,
  loadQaWizardCandidateBridgeManifest,
  QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION,
  QA_WIZARD_RECONCILIATION_PROSPECTIVE_VALIDATION_TIMESTAMP as PROSPECTIVE_VALIDATION_TIMESTAMP,
  resolveExistingContainedArtifact,
  type QaWizardCandidateBridgeArtifactWrite,
  type QaWizardCandidateBridgeManifest,
  type QaWizardReconciliationApprovalAttestation,
} from './qaWizardCandidateBridge';
import {
  approvePendingSourcePromptReconciliation,
  buildProductionReconciliationDraftFromVisualContractCandidate,
  buildReconciliationReviewBundle,
  loadVisualContractCandidateForReconciliation,
  persistReconciliationDraftBundle,
  reconciliationDraftBundleJsonBytes,
  renderReconciliationReviewMarkdown,
  type ReconciliationReviewBundle,
} from './reconciliationLifecycle';
import {
  buildStorySourceAuthoritySnapshot,
  type StorySourceAuthoritySnapshot,
} from './storySourceAuthority';
import {
  canonicalJsonDigest,
  nonEmpty,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  resolveJsonPointer,
  sourcePromptReconciliationIssues,
  type ReconciledVisualBeat,
  type ReconciliationAspect,
  type ReconciliationSourceKind,
  type ReviewerPresentationRequirementDisposition,
  type SourcePromptReconciliation,
} from './sourcePromptReconciliation';
import {
  canonicalContentAddressedJsonBytes,
} from './canonicalContentAddressedJson';
import {
  createContainedContentAddressedJsonArtifactStore,
} from './canonicalLiveAuthoringArtifacts';
import {
  writeImmutableLocalArtifact,
} from './preRenderBlueprintLifecycle';
import type { VisualContractCandidateArtifact } from './visualContractAuthoringLifecycle';

export const QA_WIZARD_RECONCILIATION_REVIEWER_DECISIONS_VERSION =
  'qa-wizard-reconciliation-reviewer-decisions/v1' as const;
export const QA_WIZARD_RECONCILIATION_REVIEWER_PLAN_VERSION =
  'qa-wizard-reconciliation-reviewer-plan/v1' as const;
export const QA_WIZARD_RECONCILIATION_CONTENT_REVIEW_VERSION =
  'qa-wizard-reconciliation-content-review/v1' as const;
export const QA_WIZARD_RECONCILIATION_AUTHORING_MANIFEST_VERSION =
  'qa-wizard-reconciliation-authoring-manifest/v1' as const;

const PENDING_REVIEW = {
  status: 'pending' as const,
  reviewedBy: null,
  reviewedAt: null,
};

function canonicalUtcTimestampIsValid(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

const AUTHORING_DOES_NOT_AUTHORIZE = [
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

export interface QaWizardReconciliationSourceDecision {
  frameKind: 'cover' | 'page';
  pageNumber: number;
  sourceKind: ReconciliationSourceKind;
  sourceTextSha256: string;
  visualBeats: ReconciledVisualBeat[];
}

export interface QaWizardPresentationRequirementDecision {
  pageNumber: number;
  beatId: string;
  sourceEvidenceId: string;
  kind: 'preserved' | 'rebound' | 'superseded';
  reboundPointer: string | null;
  reboundValue: string | null;
  justification: string | null;
}

export interface QaWizardReconciliationReviewerDecisions {
  version: typeof QA_WIZARD_RECONCILIATION_REVIEWER_DECISIONS_VERSION;
  sourceRequirements: QaWizardReconciliationSourceDecision[];
  presentationRequirements: QaWizardPresentationRequirementDecision[];
}

export interface QaWizardReconciliationReviewerPlan
  extends QaWizardReconciliationReviewerDecisions {
  planVersion: typeof QA_WIZARD_RECONCILIATION_REVIEWER_PLAN_VERSION;
  bridgeManifestDigest: string;
  baseReconciliationDigest: string;
  sourceSnapshotDigest: string;
  candidateDigest: string;
  templateDigest: string;
  actionSemanticCoverageDigest: string;
  reviewerDecisionsDigest: string;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface QaWizardReconciliationContentReview {
  version: typeof QA_WIZARD_RECONCILIATION_CONTENT_REVIEW_VERSION;
  storyKey: string;
  bridgeManifestDigest: string;
  reviewerPlanDigest: string;
  sourceSnapshotDigest: string;
  candidateDigest: string;
  templateDigest: string;
  actionSemanticCoverageDigest: string;
  pendingReconciliationDigest: string;
  prospectiveApprovedReconciliationDigest: string;
  contentReadyForGuyReview: boolean;
  coverageCensus: {
    total: number;
    actionRequirement: number;
    representedElsewhere: number;
    presentationRequirement: number;
    nonVisual: number;
  };
  sourceRequirements: Array<{
    frameKind: 'cover' | 'page';
    pageNumber: number;
    sourceKind: ReconciliationSourceKind;
    sourceText: string;
    visualBeats: ReconciledVisualBeat[];
  }>;
  nonVisualCoverage: Array<{
    pageNumber: number;
    beatId: string;
    sourceEvidenceId: string;
    sourcePhrase: string;
    rationale: Extract<
      ActionSemanticCoverageRecord['disposition'],
      { kind: 'non_visual' }
    >['rationale'];
    reviewState: ActionSemanticCoverageRecord['reviewState'];
  }>;
  presentationDecisions: QaWizardPresentationRequirementDecision[];
  pendingBlockingIssues: ReturnType<typeof sourcePromptReconciliationIssues>;
  prospectiveBlockingIssues: ReturnType<typeof sourcePromptReconciliationIssues>;
  prospectiveValidationTimestamp: typeof PROSPECTIVE_VALIDATION_TIMESTAMP;
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface QaWizardReconciliationAuthoringManifest {
  version: typeof QA_WIZARD_RECONCILIATION_AUTHORING_MANIFEST_VERSION;
  stage: 'reconciliation_content_pending_guy_review';
  bridge: {
    version: typeof QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION;
    digest: string;
    path: string;
  };
  source: {
    snapshotDigest: string;
  };
  candidate: {
    digest: string;
    templateDigest: string;
    actionSemanticCoverageDigest: string;
  };
  reviewerPlan: {
    version: typeof QA_WIZARD_RECONCILIATION_REVIEWER_PLAN_VERSION;
    digest: string;
    path: string;
  };
  reconciliation: {
    version: SourcePromptReconciliation['version'];
    digest: string;
    path: string;
    reviewBundleVersion: ReconciliationReviewBundle['version'];
    reviewBundleDigest: string;
    reviewBundlePath: string;
    reviewMarkdownPath: string;
  };
  contentReview: {
    version: typeof QA_WIZARD_RECONCILIATION_CONTENT_REVIEW_VERSION;
    digest: string;
    path: string;
    markdownPath: string;
    markdownSha256: string;
    contentReadyForGuyReview: true;
  };
  prospectiveValidation: {
    approvedReconciliationDigest: string;
    issueCount: 0;
    validationTimestamp: typeof PROSPECTIVE_VALIDATION_TIMESTAMP;
  };
  boundaryEvidence: {
    credentialAccess: 'none';
    providerCalls: 0;
    imageCalls: 0;
    networkCalls: 0;
    databaseWrites: 0;
    productionWrites: 0;
  };
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface PrepareQaWizardReviewedReconciliationRequest {
  repoRoot: string;
  outputDir: string;
  bridgeManifestPath: string;
  reviewerDecisionsPath: string;
  write?: boolean;
}

export interface RecordQaWizardReviewedReconciliationApprovalRequest {
  repoRoot: string;
  outputDir: string;
  authoringManifestPath: string;
  approvedBy: 'Guy';
  approvedAt: string;
  write?: boolean;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort());
}

function objectValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function digestValue(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function sha256Utf8(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizedRepoRelative(value: string): string {
  return path.posix.normalize(value.replace(/\\/g, '/'));
}

function outputDirFromArtifactPath(artifactPath: string, category: string): string {
  const normalized = normalizedRepoRelative(artifactPath);
  if (path.posix.basename(path.posix.dirname(normalized)) !== category) {
    throw new Error(`artifact path is not under ${category}`);
  }
  return path.posix.dirname(path.posix.dirname(normalized));
}

function assertSameOutputDir(args: {
  outputDir: string;
  artifactPath: string;
  category: string;
}): string {
  const observed = outputDirFromArtifactPath(args.artifactPath, args.category);
  if (observed !== normalizedRepoRelative(args.outputDir)) {
    throw new Error('reconciliation authoring output root mismatch');
  }
  return observed;
}

function readJson(repoRoot: string, relativePath: string, label: string): unknown {
  const absolute = resolveExistingContainedArtifact({
    repoRoot,
    relativePath,
    label,
  });
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(absolute, 'utf8')) as unknown;
  } catch {
    throw new Error(`${label} JSON is invalid`);
  }
  return value;
}

function sourceDecisionIdentity(value: {
  frameKind: 'cover' | 'page';
  pageNumber: number;
  sourceKind: ReconciliationSourceKind;
}): string {
  return `${value.frameKind}:${value.pageNumber}:${value.sourceKind}`;
}

function presentationDecisionIdentity(value: {
  pageNumber: number;
  beatId: string;
  sourceEvidenceId: string;
}): string {
  return `${value.pageNumber}:${value.beatId}:${value.sourceEvidenceId}`;
}

function pendingReviewIsExact(value: unknown): boolean {
  return objectValue(value) &&
    exactKeys(value, ['status', 'reviewedBy', 'reviewedAt']) &&
    value.status === 'pending' &&
    value.reviewedBy === null &&
    value.reviewedAt === null;
}

function validateEvidenceShape(value: unknown): boolean {
  return objectValue(value) &&
    exactKeys(value, ['path', 'value']) &&
    nonEmpty(value.path);
}

function validateVisualBeatShape(value: unknown): value is ReconciledVisualBeat {
  if (
    !objectValue(value) ||
    !exactKeys(value, [
      'id',
      'description',
      'aspects',
      'disposition',
      'contractEvidence',
      'justification',
      'supersessionReview',
    ]) ||
    !nonEmpty(value.id) ||
    !nonEmpty(value.description) ||
    !Array.isArray(value.aspects) ||
    value.aspects.length === 0 ||
    !Array.isArray(value.contractEvidence) ||
    !value.contractEvidence.every(validateEvidenceShape)
  ) {
    return false;
  }
  if (value.disposition === 'preserved') {
    return value.contractEvidence.length > 0 &&
      value.justification === null &&
      value.supersessionReview === null;
  }
  if (value.disposition === 'intentionally_superseded') {
    return value.contractEvidence.length === 0 &&
      nonEmpty(value.justification) &&
      pendingReviewIsExact(value.supersessionReview);
  }
  return false;
}

function validateReviewerDecisions(value: unknown): QaWizardReconciliationReviewerDecisions {
  if (
    !objectValue(value) ||
    !exactKeys(value, ['version', 'sourceRequirements', 'presentationRequirements']) ||
    value.version !== QA_WIZARD_RECONCILIATION_REVIEWER_DECISIONS_VERSION ||
    !Array.isArray(value.sourceRequirements) ||
    !Array.isArray(value.presentationRequirements)
  ) {
    throw new Error('reconciliation reviewer decisions shape is invalid');
  }
  for (const decision of value.sourceRequirements) {
    if (
      !objectValue(decision) ||
      !exactKeys(decision, [
        'frameKind',
        'pageNumber',
        'sourceKind',
        'sourceTextSha256',
        'visualBeats',
      ]) ||
      (decision.frameKind !== 'cover' && decision.frameKind !== 'page') ||
      !Number.isSafeInteger(decision.pageNumber) ||
      !['story_prose', 'historical_image_direction', 'authored_cover_authority']
        .includes(String(decision.sourceKind)) ||
      !digestValue(decision.sourceTextSha256) ||
      !Array.isArray(decision.visualBeats) ||
      decision.visualBeats.length === 0 ||
      !decision.visualBeats.every(validateVisualBeatShape)
    ) {
      throw new Error('reconciliation source decision is invalid');
    }
  }
  for (const decision of value.presentationRequirements) {
    if (
      !objectValue(decision) ||
      !exactKeys(decision, [
        'pageNumber',
        'beatId',
        'sourceEvidenceId',
        'kind',
        'reboundPointer',
        'reboundValue',
        'justification',
      ]) ||
      !Number.isSafeInteger(decision.pageNumber) ||
      Number(decision.pageNumber) <= 0 ||
      !nonEmpty(decision.beatId) ||
      !nonEmpty(decision.sourceEvidenceId) ||
      !['preserved', 'rebound', 'superseded'].includes(String(decision.kind))
    ) {
      throw new Error('Presentation Requirement decision is invalid');
    }
    if (
      (decision.kind === 'preserved' &&
        (decision.reboundPointer !== null ||
          decision.reboundValue !== null ||
          decision.justification !== null)) ||
      (decision.kind === 'rebound' &&
        (!nonEmpty(decision.reboundPointer) ||
          !nonEmpty(decision.reboundValue) ||
          decision.justification !== null)) ||
      (decision.kind === 'superseded' &&
        (decision.reboundPointer !== null ||
          decision.reboundValue !== null ||
          !nonEmpty(decision.justification)))
    ) {
      throw new Error('Presentation Requirement decision payload is invalid');
    }
  }
  return structuredClone(value) as unknown as QaWizardReconciliationReviewerDecisions;
}

function pageIndexForRecord(
  candidate: VisualContractCandidateArtifact,
  record: ActionSemanticCoverageRecord,
): number {
  const pageIndex = candidate.template.pageContracts.findIndex(
    (page) => page.pageNumber === record.pageNumber,
  );
  if (pageIndex < 0) {
    throw new Error('coverage record has no exact Candidate page');
  }
  return pageIndex;
}

function presentationAspects(record: ActionSemanticCoverageRecord): ReconciliationAspect[] {
  if (record.disposition.kind !== 'presentation_requirement') {
    throw new Error('presentation aspects require presentation coverage');
  }
  const aspect: ReconciliationAspect =
    record.disposition.presentationClass === 'composition_focus' ||
    record.disposition.presentationClass === 'lighting_state' ||
    record.disposition.presentationClass === 'graphic_sound_cue'
      ? 'composition'
      : 'staging';
  return ['narrative_meaning', aspect];
}

function evidenceForActionRecord(args: {
  candidate: VisualContractCandidateArtifact;
  record: ActionSemanticCoverageRecord;
}): ReconciledVisualBeat['contractEvidence'] {
  if (args.record.disposition.kind !== 'action_requirement') {
    throw new Error('action evidence requires action coverage');
  }
  const pageIndex = pageIndexForRecord(args.candidate, args.record);
  const checkId = args.record.disposition.checkId;
  const requirements = args.candidate.template.pageContracts[pageIndex]!
    .actionRequirements ?? [];
  const matches = requirements
    .map((requirement, index) => ({ requirement, index }))
    .filter(({ requirement }) =>
      requirement.checkId === checkId,
    );
  if (matches.length !== 1) {
    throw new Error('action coverage does not select one unique Candidate requirement');
  }
  const match = matches[0]!;
  return [{
    path: `/pageContracts/${pageIndex}/actionRequirements/${match.index}`,
    value: structuredClone(match.requirement),
  }];
}

function evidenceForRepresentedElsewhereRecord(args: {
  candidate: VisualContractCandidateArtifact;
  record: ActionSemanticCoverageRecord;
}): ReconciledVisualBeat['contractEvidence'] {
  if (args.record.disposition.kind !== 'represented_elsewhere') {
    throw new Error('represented evidence requires represented coverage');
  }
  const pageIndex = pageIndexForRecord(args.candidate, args.record);
  const prefix = `/pageContracts/${pageIndex}/`;
  const resolved = resolveJsonPointer(
    args.candidate.template,
    args.record.disposition.contractPointer,
  );
  if (
    !args.record.disposition.contractPointer.startsWith(prefix) ||
    !resolved.found ||
    canonicalJsonDigest(resolved.value) !==
      canonicalJsonDigest(args.record.disposition.contractValue)
  ) {
    throw new Error('represented-elsewhere coverage is stale or cross-page');
  }
  return [{
    path: args.record.disposition.contractPointer,
    value: structuredClone(args.record.disposition.contractValue),
  }];
}

function dispositionEntry(args: {
  record: ActionSemanticCoverageRecord;
  decision: QaWizardPresentationRequirementDecision;
}): ReviewerPresentationRequirementDisposition | null {
  if (args.decision.kind === 'preserved') return null;
  return {
    pageNumber: args.record.pageNumber,
    beatId: args.record.beatId,
    sourceEvidenceId: args.record.sourceEvidenceId,
    kind: args.decision.kind,
    reboundPointer: args.decision.reboundPointer,
    reboundValue: args.decision.reboundValue,
    justification: args.decision.justification,
    review: { ...PENDING_REVIEW },
  };
}

function beatForCoverageRecord(args: {
  candidate: VisualContractCandidateArtifact;
  record: ActionSemanticCoverageRecord;
  presentationDecision?: QaWizardPresentationRequirementDecision;
}): ReconciledVisualBeat | null {
  const { record } = args;
  if (record.disposition.kind === 'non_visual') return null;
  if (record.disposition.kind === 'action_requirement') {
    return {
      id: record.beatId,
      description: record.sourcePhrase,
      aspects: ['narrative_meaning', 'action'],
      disposition: 'preserved',
      contractEvidence: evidenceForActionRecord(args),
      justification: null,
      supersessionReview: null,
    };
  }
  if (record.disposition.kind === 'represented_elsewhere') {
    return {
      id: record.beatId,
      description: record.sourcePhrase,
      aspects: [
        'narrative_meaning',
        record.disposition.contractPointer.includes('/companionStateOverride/')
          ? 'expression'
          : 'staging',
      ],
      disposition: 'preserved',
      contractEvidence: evidenceForRepresentedElsewhereRecord(args),
      justification: null,
      supersessionReview: null,
    };
  }
  const decision = args.presentationDecision;
  if (!decision) {
    throw new Error('Presentation Requirement lacks one reviewer decision');
  }
  if (decision.kind === 'superseded') {
    return {
      id: record.beatId,
      description: record.sourcePhrase,
      aspects: presentationAspects(record),
      disposition: 'intentionally_superseded',
      contractEvidence: [],
      justification: decision.justification,
      supersessionReview: { ...PENDING_REVIEW },
    };
  }
  const pointer = decision.kind === 'preserved'
    ? record.disposition.contractPointer
    : decision.reboundPointer!;
  const value = decision.kind === 'preserved'
    ? record.disposition.contractValue
    : decision.reboundValue!;
  return {
    id: record.beatId,
    description: record.sourcePhrase,
    aspects: presentationAspects(record),
    disposition: 'preserved',
    contractEvidence: [{ path: pointer, value }],
    justification: null,
    supersessionReview: null,
  };
}

interface LoadedAuthoringBase {
  manifest: QaWizardCandidateBridgeManifest;
  snapshot: StorySourceAuthoritySnapshot;
  candidate: VisualContractCandidateArtifact;
  baseReconciliation: SourcePromptReconciliation;
}

function loadAuthoringBase(args: {
  repoRoot: string;
  outputDir: string;
  bridgeManifestPath: string;
}): LoadedAuthoringBase {
  assertSameOutputDir({
    outputDir: args.outputDir,
    artifactPath: args.bridgeManifestPath,
    category: 'bridge-manifests',
  });
  const manifest = loadQaWizardCandidateBridgeManifest({
    repoRoot: args.repoRoot,
    manifestPath: args.bridgeManifestPath,
  });
  if (
    manifest.version !== QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION ||
    manifest.stage !== 'reconciliation_pending' ||
    manifest.reconciliation.status !== 'pending' ||
    manifest.reconciliation.reviewedBy !== null ||
    manifest.reconciliation.reviewedAt !== null
  ) {
    throw new Error('reviewer authoring requires one current pending bridge');
  }
  const snapshot = buildStorySourceAuthoritySnapshot({
    repoRoot: args.repoRoot,
    storyKey: manifest.source.storyKey,
    storyPath: manifest.source.storyPath,
  });
  if (snapshot.digest !== manifest.source.snapshotDigest) {
    throw new Error('reconciliation authoring source snapshot is stale');
  }
  const candidate = loadVisualContractCandidateForReconciliation({
    repoRoot: args.repoRoot,
    candidatePath: manifest.visualContract.candidatePath,
    snapshot,
    expectedTemplateDigest: manifest.visualContract.templateDigest,
  });
  if (
    candidate.digest !== manifest.visualContract.candidateDigest ||
    candidate.actionSemanticCoverageDigest !==
      manifest.visualContract.actionSemanticCoverageDigest
  ) {
    throw new Error('reconciliation authoring Candidate is stale');
  }
  const base = buildProductionReconciliationDraftFromVisualContractCandidate({
    snapshot,
    candidate,
  });
  if (
    canonicalJsonDigest(base.reconciliation) !== manifest.reconciliation.digest ||
    base.reviewBundle.digest !== manifest.reconciliation.reviewBundleDigest
  ) {
    throw new Error('pending bridge no longer binds its canonical empty reconciliation');
  }
  return {
    manifest,
    snapshot,
    candidate,
    baseReconciliation: base.reconciliation,
  };
}

function buildReviewerPlan(args: {
  base: LoadedAuthoringBase;
  decisions: QaWizardReconciliationReviewerDecisions;
}): QaWizardReconciliationReviewerPlan {
  const payload = {
    version: args.decisions.version,
    planVersion: QA_WIZARD_RECONCILIATION_REVIEWER_PLAN_VERSION,
    bridgeManifestDigest: args.base.manifest.digest,
    baseReconciliationDigest: canonicalJsonDigest(args.base.baseReconciliation),
    sourceSnapshotDigest: args.base.snapshot.digest,
    candidateDigest: args.base.candidate.digest,
    templateDigest: args.base.candidate.templateDigest,
    actionSemanticCoverageDigest:
      args.base.candidate.actionSemanticCoverageDigest,
    reviewerDecisionsDigest: canonicalJsonDigest(args.decisions),
    sourceRequirements: structuredClone(args.decisions.sourceRequirements),
    presentationRequirements:
      structuredClone(args.decisions.presentationRequirements),
  };
  const plan: QaWizardReconciliationReviewerPlan = {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(payload),
  };
  return JSON.parse(
    canonicalContentAddressedJsonBytes(plan),
  ) as QaWizardReconciliationReviewerPlan;
}

function validatedPlan(args: {
  plan: unknown;
  base: LoadedAuthoringBase;
}): QaWizardReconciliationReviewerPlan | null {
  if (
    !objectValue(args.plan) ||
    !exactKeys(args.plan, [
      'version',
      'planVersion',
      'bridgeManifestDigest',
      'baseReconciliationDigest',
      'sourceSnapshotDigest',
      'candidateDigest',
      'templateDigest',
      'actionSemanticCoverageDigest',
      'reviewerDecisionsDigest',
      'sourceRequirements',
      'presentationRequirements',
      'digestAlgorithm',
      'digest',
    ]) ||
    args.plan.planVersion !== QA_WIZARD_RECONCILIATION_REVIEWER_PLAN_VERSION ||
    args.plan.digestAlgorithm !== 'canonical-json-sha256' ||
    !digestValue(args.plan.digest)
  ) {
    return null;
  }
  let decisions: QaWizardReconciliationReviewerDecisions;
  try {
    decisions = validateReviewerDecisions({
      version: args.plan.version,
      sourceRequirements: args.plan.sourceRequirements,
      presentationRequirements: args.plan.presentationRequirements,
    });
  } catch {
    return null;
  }
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = args.plan;
  const valid = (
    args.plan.bridgeManifestDigest === args.base.manifest.digest &&
    args.plan.baseReconciliationDigest ===
      canonicalJsonDigest(args.base.baseReconciliation) &&
    args.plan.sourceSnapshotDigest === args.base.snapshot.digest &&
    args.plan.candidateDigest === args.base.candidate.digest &&
    args.plan.templateDigest === args.base.candidate.templateDigest &&
    args.plan.actionSemanticCoverageDigest ===
      args.base.candidate.actionSemanticCoverageDigest &&
    args.plan.reviewerDecisionsDigest === canonicalJsonDigest(decisions) &&
    args.plan.digest === canonicalJsonDigest(payload)
  );
  return valid
    ? args.plan as unknown as QaWizardReconciliationReviewerPlan
    : null;
}

function applyReviewerPlan(args: {
  base: LoadedAuthoringBase;
  plan: QaWizardReconciliationReviewerPlan;
}): SourcePromptReconciliation {
  const reconciliation = structuredClone(args.base.baseReconciliation);
  if (!pendingReviewIsExact(reconciliation.review)) {
    throw new Error('base reconciliation review is not exact pending');
  }
  const coverage = args.base.candidate.actionSemanticCoverage;
  const visiblePages = new Set(
    coverage
      .filter((record) => record.disposition.kind !== 'non_visual')
      .map((record) => record.pageNumber),
  );
  const explicitRequirements = reconciliation.frames.flatMap((frame) =>
    frame.sourceRequirements
      .filter((requirement) =>
        !(
          frame.frameKind === 'page' &&
          requirement.sourceKind === 'story_prose' &&
          visiblePages.has(frame.pageNumber)
        ),
      )
      .map((requirement) => ({ frame, requirement })),
  );
  const sourceDecisions = new Map<string, QaWizardReconciliationSourceDecision>();
  for (const decision of args.plan.sourceRequirements) {
    const identity = sourceDecisionIdentity(decision);
    if (sourceDecisions.has(identity)) {
      throw new Error('duplicate reconciliation source decision');
    }
    sourceDecisions.set(identity, decision);
  }
  if (
    sourceDecisions.size !== explicitRequirements.length ||
    explicitRequirements.some(({ frame, requirement }) => {
      const decision = sourceDecisions.get(sourceDecisionIdentity({
        frameKind: frame.frameKind,
        pageNumber: frame.pageNumber,
        sourceKind: requirement.sourceKind,
      }));
      return !decision ||
        decision.sourceTextSha256 !== sha256Utf8(requirement.sourceText);
    })
  ) {
    throw new Error('reviewer plan does not exactly cover unsupported source requirements');
  }

  const presentationCoverage = coverage.filter(
    (record) => record.disposition.kind === 'presentation_requirement',
  );
  const presentationDecisions = new Map<
    string,
    QaWizardPresentationRequirementDecision
  >();
  for (const decision of args.plan.presentationRequirements) {
    const identity = presentationDecisionIdentity(decision);
    if (presentationDecisions.has(identity)) {
      throw new Error('duplicate Presentation Requirement decision');
    }
    presentationDecisions.set(identity, decision);
  }
  if (
    presentationDecisions.size !== presentationCoverage.length ||
    presentationCoverage.some(
      (record) => !presentationDecisions.has(presentationDecisionIdentity(record)),
    )
  ) {
    throw new Error('reviewer plan does not decide every exact Presentation Requirement');
  }

  const dispositionEntries: ReviewerPresentationRequirementDisposition[] = [];
  for (const frame of reconciliation.frames) {
    for (const requirement of frame.sourceRequirements) {
      const explicit = sourceDecisions.get(sourceDecisionIdentity({
        frameKind: frame.frameKind,
        pageNumber: frame.pageNumber,
        sourceKind: requirement.sourceKind,
      }));
      if (explicit) {
        requirement.visualBeats = structuredClone(explicit.visualBeats);
        continue;
      }
      if (frame.frameKind !== 'page' || requirement.sourceKind !== 'story_prose') {
        throw new Error('reviewer plan left one source requirement unowned');
      }
      const pageCoverage = coverage.filter(
        (record) =>
          record.pageNumber === frame.pageNumber &&
          record.disposition.kind !== 'non_visual',
      );
      const beatIds = new Set<string>();
      requirement.visualBeats = pageCoverage.map((record) => {
        if (beatIds.has(record.beatId)) {
          throw new Error('visible page coverage contains a duplicate beat id');
        }
        beatIds.add(record.beatId);
        const decision = record.disposition.kind === 'presentation_requirement'
          ? presentationDecisions.get(presentationDecisionIdentity(record))
          : undefined;
        const beat = beatForCoverageRecord({
          candidate: args.base.candidate,
          record,
          ...(decision ? { presentationDecision: decision } : {}),
        });
        if (!beat) {
          throw new Error('visible coverage unexpectedly produced no beat');
        }
        if (decision) {
          const entry = dispositionEntry({ record, decision });
          if (entry) dispositionEntries.push(entry);
        }
        return beat;
      });
      if (requirement.visualBeats.length === 0) {
        throw new Error('mechanical story-prose coverage is empty');
      }
    }
  }
  reconciliation.presentationRequirementDispositions.entries =
    dispositionEntries;
  return reconciliation;
}

function validationArgs(args: {
  reconciliation: SourcePromptReconciliation;
  base: LoadedAuthoringBase;
}) {
  return {
    raw: args.reconciliation,
    storyKey: args.base.snapshot.content.storyKey,
    sourceIdentity: args.base.snapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: args.base.snapshot.digest,
    rawStorySource: args.base.snapshot.content.normalizedRawStorySource,
    template: args.base.candidate.template,
    templateDigest: args.base.candidate.templateDigest,
    ...(args.base.snapshot.content.authoredCoverAuthority
      ? { authoredCoverAuthority: args.base.snapshot.content.authoredCoverAuthority }
      : {}),
    actionSemanticCoverage: args.base.candidate.actionSemanticCoverage,
    requireComplete: true,
  };
}

function coverageCensus(coverage: readonly ActionSemanticCoverageRecord[]) {
  return {
    total: coverage.length,
    actionRequirement: coverage.filter(
      (record) => record.disposition.kind === 'action_requirement',
    ).length,
    representedElsewhere: coverage.filter(
      (record) => record.disposition.kind === 'represented_elsewhere',
    ).length,
    presentationRequirement: coverage.filter(
      (record) => record.disposition.kind === 'presentation_requirement',
    ).length,
    nonVisual: coverage.filter(
      (record) => record.disposition.kind === 'non_visual',
    ).length,
  };
}

function buildContentReview(args: {
  base: LoadedAuthoringBase;
  plan: QaWizardReconciliationReviewerPlan;
  pending: SourcePromptReconciliation;
  prospectiveApproved: SourcePromptReconciliation;
  pendingIssues: ReturnType<typeof sourcePromptReconciliationIssues>;
  prospectiveIssues: ReturnType<typeof sourcePromptReconciliationIssues>;
}): QaWizardReconciliationContentReview {
  const payload = {
    version: QA_WIZARD_RECONCILIATION_CONTENT_REVIEW_VERSION,
    storyKey: args.base.snapshot.content.storyKey,
    bridgeManifestDigest: args.base.manifest.digest,
    reviewerPlanDigest: args.plan.digest,
    sourceSnapshotDigest: args.base.snapshot.digest,
    candidateDigest: args.base.candidate.digest,
    templateDigest: args.base.candidate.templateDigest,
    actionSemanticCoverageDigest:
      args.base.candidate.actionSemanticCoverageDigest,
    pendingReconciliationDigest: canonicalJsonDigest(args.pending),
    prospectiveApprovedReconciliationDigest:
      canonicalJsonDigest(args.prospectiveApproved),
    contentReadyForGuyReview: args.prospectiveIssues.length === 0,
    coverageCensus: coverageCensus(args.base.candidate.actionSemanticCoverage),
    sourceRequirements: args.pending.frames.flatMap((frame) =>
      frame.sourceRequirements.map((requirement) => ({
        frameKind: frame.frameKind,
        pageNumber: frame.pageNumber,
        sourceKind: requirement.sourceKind,
        sourceText: requirement.sourceText,
        visualBeats: structuredClone(requirement.visualBeats),
      }))),
    nonVisualCoverage: args.base.candidate.actionSemanticCoverage
      .filter(
        (record): record is ActionSemanticCoverageRecord & {
          disposition: Extract<
            ActionSemanticCoverageRecord['disposition'],
            { kind: 'non_visual' }
          >;
        } => record.disposition.kind === 'non_visual',
      )
      .map((record) => ({
        pageNumber: record.pageNumber,
        beatId: record.beatId,
        sourceEvidenceId: record.sourceEvidenceId,
        sourcePhrase: record.sourcePhrase,
        rationale: record.disposition.rationale,
        reviewState: record.reviewState,
      })),
    presentationDecisions: structuredClone(args.plan.presentationRequirements),
    pendingBlockingIssues: structuredClone(args.pendingIssues),
    prospectiveBlockingIssues: structuredClone(args.prospectiveIssues),
    prospectiveValidationTimestamp: PROSPECTIVE_VALIDATION_TIMESTAMP,
    doesNotAuthorize: [...AUTHORING_DOES_NOT_AUTHORIZE],
  };
  return {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(payload),
  };
}

function renderContentReviewMarkdown(
  review: QaWizardReconciliationContentReview,
): string {
  const fenced = (value: string, language = 'text'): string[] => {
    const longestRun = Math.max(
      0,
      ...(value.match(/`+/g) ?? []).map((match) => match.length),
    );
    const fence = '`'.repeat(Math.max(3, longestRun + 1));
    return [`${fence}${language}`, value, fence];
  };
  const pushFencedField = (
    lines: string[],
    label: string,
    value: string,
    language = 'text',
  ): void => {
    lines.push(`- ${label}:`, '', ...fenced(value, language), '');
  };
  const lines = [
    '# QA Wizard Reconciliation — Full Content Review',
    '',
    '- Story key:',
    '',
    ...fenced(review.storyKey),
    '',
    `- Bridge manifest: \`${review.bridgeManifestDigest}\``,
    `- Reviewer plan: \`${review.reviewerPlanDigest}\``,
    `- Candidate: \`${review.candidateDigest}\``,
    `- Template: \`${review.templateDigest}\``,
    `- Pending reconciliation: \`${review.pendingReconciliationDigest}\``,
    `- Prospective approved reconciliation: \`${review.prospectiveApprovedReconciliationDigest}\``,
    `- Content ready for Guy review: **${review.contentReadyForGuyReview ? 'YES' : 'NO'}**`,
    '- This packet records proposed content only. It is not approval and grants no downstream authority.',
    '',
    '## Exact source requirements and reviewer beats',
    '',
  ];
  for (const requirement of review.sourceRequirements) {
    lines.push(
      `### ${requirement.frameKind} ${requirement.pageNumber} — ${requirement.sourceKind}`,
      '',
      ...fenced(requirement.sourceText),
      '',
    );
    for (const beat of requirement.visualBeats) {
      lines.push(
        `#### Reviewer beat — ${beat.disposition}`,
        '',
        `- Aspects: ${beat.aspects.map((aspect) => `\`${aspect}\``).join(', ')}`,
        '',
      );
      pushFencedField(lines, 'Beat ID', beat.id);
      pushFencedField(lines, 'Description', beat.description);
      if (beat.justification === null) {
        lines.push('- Justification: none', '');
      } else {
        pushFencedField(lines, 'Justification', beat.justification);
      }
      lines.push('- Exact contract evidence:', '');
      if (beat.contractEvidence.length === 0) {
        lines.push('  - None (explicit supersession).', '');
      } else {
        for (const [index, evidence] of beat.contractEvidence.entries()) {
          lines.push(`##### Contract evidence ${index + 1}`, '');
          pushFencedField(lines, 'JSON pointer', evidence.path);
          pushFencedField(
            lines,
            'Exact value',
            JSON.stringify(evidence.value, null, 2) ?? 'null',
            'json',
          );
        }
      }
    }
  }
  lines.push('## Non-visual coverage decisions', '');
  if (review.nonVisualCoverage.length === 0) {
    lines.push('- None.', '');
  } else {
    for (const record of review.nonVisualCoverage) {
      lines.push(`### Page ${record.pageNumber} — NON_VISUAL`, '');
      pushFencedField(lines, 'Beat ID', record.beatId);
      pushFencedField(lines, 'Source evidence ID', record.sourceEvidenceId);
      pushFencedField(lines, 'Exact source phrase', record.sourcePhrase);
      pushFencedField(lines, 'Rationale', record.rationale);
      pushFencedField(lines, 'Review state', record.reviewState);
    }
  }
  lines.push('## Presentation Requirement decisions', '');
  for (const decision of review.presentationDecisions) {
    lines.push(
      `### Page ${decision.pageNumber} — ${decision.kind.toUpperCase()}`,
      '',
    );
    pushFencedField(lines, 'Beat ID', decision.beatId);
    pushFencedField(lines, 'Source evidence ID', decision.sourceEvidenceId);
    if (decision.reboundPointer !== null) {
      pushFencedField(lines, 'Rebound JSON pointer', decision.reboundPointer);
      pushFencedField(
        lines,
        'Rebound exact value',
        JSON.stringify(decision.reboundValue, null, 2) ?? 'null',
        'json',
      );
    }
    if (decision.justification === null) {
      lines.push('- Justification: none', '');
    } else {
      pushFencedField(lines, 'Justification', decision.justification);
    }
  }
  lines.push('', '## Prospective complete-validation issues', '');
  if (review.prospectiveBlockingIssues.length === 0) {
    lines.push('- None.', '');
  } else {
    for (const [index, issue] of review.prospectiveBlockingIssues.entries()) {
      lines.push(`### Issue ${index + 1}`, '');
      pushFencedField(lines, 'Code', issue.code);
      if (issue.field) pushFencedField(lines, 'Field', issue.field);
      pushFencedField(lines, 'Message', issue.message);
    }
  }
  return `${lines.join('\n')}\n`;
}

function assertTargetCompatible(args: {
  repoRoot: string;
  relativePath: string;
  bytes: string;
}): void {
  const absolute = resolveRepoPath(args.repoRoot, args.relativePath);
  if (!fs.existsSync(absolute)) return;
  const securedAbsolute = resolveExistingContainedArtifact({
    repoRoot: args.repoRoot,
    relativePath: args.relativePath,
    label: 'immutable reconciliation target',
  });
  if (fs.readFileSync(securedAbsolute, 'utf8') !== args.bytes) {
    throw new Error(`immutable reconciliation artifact conflicts at ${args.relativePath}`);
  }
}

function jsonArtifactPath(outputDir: string, category: string, digest: string): string {
  return `${normalizedRepoRelative(outputDir)}/${category}/${digest}.json`;
}

function markdownArtifactPath(outputDir: string, category: string, digest: string): string {
  return `${normalizedRepoRelative(outputDir)}/${category}/${digest}.md`;
}

function persistAuthoringArtifacts(args: {
  repoRoot: string;
  outputDir: string;
  plan: QaWizardReconciliationReviewerPlan;
  pending: SourcePromptReconciliation;
  reviewBundle: ReconciliationReviewBundle;
  reviewMarkdown: string;
  contentReview: QaWizardReconciliationContentReview;
  contentReviewMarkdown: string;
  manifest: QaWizardReconciliationAuthoringManifest;
  write: boolean;
}): {
  reviewerPlan: QaWizardCandidateBridgeArtifactWrite;
  reconciliation: ReturnType<typeof persistReconciliationDraftBundle>;
  contentReview: QaWizardCandidateBridgeArtifactWrite;
  contentReviewMarkdownPath: string;
  manifest: QaWizardCandidateBridgeArtifactWrite;
} {
  const planPath = jsonArtifactPath(
    args.outputDir,
    'reconciliation-reviewer-plans',
    args.plan.digest,
  );
  const contentReviewPath = jsonArtifactPath(
    args.outputDir,
    'reconciliation-content-reviews',
    args.contentReview.digest,
  );
  const contentReviewMarkdownPath = markdownArtifactPath(
    args.outputDir,
    'reconciliation-content-reviews',
    args.contentReview.digest,
  );
  const manifestPath = jsonArtifactPath(
    args.outputDir,
    'reconciliation-authoring-manifests',
    args.manifest.digest,
  );
  const reconciliationPlan = persistReconciliationDraftBundle({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    reconciliation: args.pending,
    reviewBundle: args.reviewBundle,
    markdown: args.reviewMarkdown,
    write: false,
  });
  for (const target of [
    { path: planPath, bytes: canonicalContentAddressedJsonBytes(args.plan) },
    {
      path: reconciliationPlan.reconciliationPath,
      bytes: reconciliationDraftBundleJsonBytes(args.pending),
    },
    {
      path: reconciliationPlan.reviewBundlePath,
      bytes: reconciliationDraftBundleJsonBytes(args.reviewBundle),
    },
    { path: reconciliationPlan.markdownPath, bytes: args.reviewMarkdown },
    {
      path: contentReviewPath,
      bytes: canonicalContentAddressedJsonBytes(args.contentReview),
    },
    { path: contentReviewMarkdownPath, bytes: args.contentReviewMarkdown },
    { path: manifestPath, bytes: canonicalContentAddressedJsonBytes(args.manifest) },
  ]) {
    assertTargetCompatible({
      repoRoot: args.repoRoot,
      relativePath: target.path,
      bytes: target.bytes,
    });
  }
  let planCreated = false;
  let contentReviewCreated = false;
  let manifestCreated = false;
  if (args.write) {
    const store = createContainedContentAddressedJsonArtifactStore({
      repoRoot: args.repoRoot,
      repositoryRealPath: fs.realpathSync(args.repoRoot),
      outputDir: args.outputDir,
      categories: [
        'reconciliation-reviewer-plans',
        'reconciliation-content-reviews',
        'reconciliation-authoring-manifests',
        'reconciliations',
        'reviews',
        'reconciliation-approvals',
      ] as const,
      rejectSymlinkAliases: true,
      errorPrefix: 'reconciliation reviewer authoring',
    });
    store.prepare();
    planCreated = store.persist({
      category: 'reconciliation-reviewer-plans',
      digest: args.plan.digest,
      value: args.plan,
    }).created;
    contentReviewCreated = store.persist({
      category: 'reconciliation-content-reviews',
      digest: args.contentReview.digest,
      value: args.contentReview,
    }).created;
    writeImmutableLocalArtifact({
      destinationPath: resolveRepoPath(args.repoRoot, contentReviewMarkdownPath),
      bytes: args.contentReviewMarkdown,
    });
    persistReconciliationDraftBundle({
      repoRoot: args.repoRoot,
      outputDir: args.outputDir,
      reconciliation: args.pending,
      reviewBundle: args.reviewBundle,
      markdown: args.reviewMarkdown,
      write: true,
    });
    manifestCreated = store.persist({
      category: 'reconciliation-authoring-manifests',
      digest: args.manifest.digest,
      value: args.manifest,
    }).created;
  }
  return {
    reviewerPlan: { path: planPath, digest: args.plan.digest, created: planCreated },
    reconciliation: {
      ...reconciliationPlan,
      wrote: args.write,
    },
    contentReview: {
      path: contentReviewPath,
      digest: args.contentReview.digest,
      created: contentReviewCreated,
    },
    contentReviewMarkdownPath,
    manifest: {
      path: manifestPath,
      digest: args.manifest.digest,
      created: manifestCreated,
    },
  };
}

function buildAuthoringManifest(args: {
  base: LoadedAuthoringBase;
  bridgeManifestPath: string;
  outputDir: string;
  plan: QaWizardReconciliationReviewerPlan;
  pending: SourcePromptReconciliation;
  reviewBundle: ReconciliationReviewBundle;
  contentReview: QaWizardReconciliationContentReview;
  contentReviewMarkdown: string;
}): QaWizardReconciliationAuthoringManifest {
  const reconciliationPath = jsonArtifactPath(
    args.outputDir,
    'reconciliations',
    canonicalJsonDigest(args.pending),
  );
  const reviewBundlePath = jsonArtifactPath(
    args.outputDir,
    'reviews',
    args.reviewBundle.digest,
  );
  const reviewMarkdownPath = markdownArtifactPath(
    args.outputDir,
    'reviews',
    args.reviewBundle.digest,
  );
  const payload = {
    version: QA_WIZARD_RECONCILIATION_AUTHORING_MANIFEST_VERSION,
    stage: 'reconciliation_content_pending_guy_review' as const,
    bridge: {
      version: QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION,
      digest: args.base.manifest.digest,
      path: normalizedRepoRelative(args.bridgeManifestPath),
    },
    source: { snapshotDigest: args.base.snapshot.digest },
    candidate: {
      digest: args.base.candidate.digest,
      templateDigest: args.base.candidate.templateDigest,
      actionSemanticCoverageDigest:
        args.base.candidate.actionSemanticCoverageDigest,
    },
    reviewerPlan: {
      version: QA_WIZARD_RECONCILIATION_REVIEWER_PLAN_VERSION,
      digest: args.plan.digest,
      path: jsonArtifactPath(
        args.outputDir,
        'reconciliation-reviewer-plans',
        args.plan.digest,
      ),
    },
    reconciliation: {
      version: args.pending.version,
      digest: canonicalJsonDigest(args.pending),
      path: reconciliationPath,
      reviewBundleVersion: args.reviewBundle.version,
      reviewBundleDigest: args.reviewBundle.digest,
      reviewBundlePath,
      reviewMarkdownPath,
    },
    contentReview: {
      version: QA_WIZARD_RECONCILIATION_CONTENT_REVIEW_VERSION,
      digest: args.contentReview.digest,
      path: jsonArtifactPath(
        args.outputDir,
        'reconciliation-content-reviews',
        args.contentReview.digest,
      ),
      markdownPath: markdownArtifactPath(
        args.outputDir,
        'reconciliation-content-reviews',
        args.contentReview.digest,
      ),
      markdownSha256: sha256Utf8(args.contentReviewMarkdown),
      contentReadyForGuyReview: true as const,
    },
    prospectiveValidation: {
      approvedReconciliationDigest:
        args.contentReview.prospectiveApprovedReconciliationDigest,
      issueCount: 0 as const,
      validationTimestamp: PROSPECTIVE_VALIDATION_TIMESTAMP,
    },
    boundaryEvidence: {
      credentialAccess: 'none' as const,
      providerCalls: 0 as const,
      imageCalls: 0 as const,
      networkCalls: 0 as const,
      databaseWrites: 0 as const,
      productionWrites: 0 as const,
    },
    doesNotAuthorize: [...AUTHORING_DOES_NOT_AUTHORIZE],
  };
  return {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(payload),
  };
}

export function prepareQaWizardReviewedReconciliation(
  args: PrepareQaWizardReviewedReconciliationRequest,
): {
  reviewerPlan: QaWizardReconciliationReviewerPlan;
  pendingReconciliation: SourcePromptReconciliation;
  reviewBundle: ReconciliationReviewBundle;
  contentReview: QaWizardReconciliationContentReview;
  contentReviewMarkdown: string;
  manifest: QaWizardReconciliationAuthoringManifest;
  artifacts: ReturnType<typeof persistAuthoringArtifacts>;
} {
  const base = loadAuthoringBase(args);
  const decisions = validateReviewerDecisions(
    readJson(args.repoRoot, args.reviewerDecisionsPath, 'reviewer decisions'),
  );
  const plan = buildReviewerPlan({ base, decisions });
  const pendingReconciliation = applyReviewerPlan({ base, plan });
  const pendingIssues = sourcePromptReconciliationIssues(
    validationArgs({ reconciliation: pendingReconciliation, base }),
  );
  const prospectiveApproved = approvePendingSourcePromptReconciliation({
    pending: pendingReconciliation,
    approvedBy: 'Guy',
    approvedAt: PROSPECTIVE_VALIDATION_TIMESTAMP,
  });
  const prospectiveIssues = sourcePromptReconciliationIssues(
    validationArgs({ reconciliation: prospectiveApproved, base }),
  );
  if (prospectiveIssues.length > 0) {
    throw new Error(
      `reconciliation reviewer content is incomplete: ${prospectiveIssues
        .map((issue) => `${issue.code}:${issue.field ?? issue.message}`)
        .join(',')}`,
    );
  }
  const reviewBundle = buildReconciliationReviewBundle({
    reconciliation: pendingReconciliation,
    sourceIdentity: base.snapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: base.snapshot.digest,
    rawStorySource: base.snapshot.content.normalizedRawStorySource,
    template: base.candidate.template,
    ...(base.snapshot.content.authoredCoverAuthority
      ? { authoredCoverAuthority: base.snapshot.content.authoredCoverAuthority }
      : {}),
    actionSemanticCoverage: base.candidate.actionSemanticCoverage,
  });
  const reviewMarkdown = renderReconciliationReviewMarkdown(reviewBundle);
  const contentReview = buildContentReview({
    base,
    plan,
    pending: pendingReconciliation,
    prospectiveApproved,
    pendingIssues,
    prospectiveIssues,
  });
  if (!contentReview.contentReadyForGuyReview) {
    throw new Error('reconciliation content is not ready for Guy review');
  }
  const contentReviewMarkdown = renderContentReviewMarkdown(contentReview);
  const manifest = buildAuthoringManifest({
    base,
    bridgeManifestPath: args.bridgeManifestPath,
    outputDir: args.outputDir,
    plan,
    pending: pendingReconciliation,
    reviewBundle,
    contentReview,
    contentReviewMarkdown,
  });
  const artifacts = persistAuthoringArtifacts({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    plan,
    pending: pendingReconciliation,
    reviewBundle,
    reviewMarkdown,
    contentReview,
    contentReviewMarkdown,
    manifest,
    write: args.write === true,
  });
  return {
    reviewerPlan: plan,
    pendingReconciliation,
    reviewBundle,
    contentReview,
    contentReviewMarkdown,
    manifest,
    artifacts,
  };
}

function loadAuthoringManifest(args: {
  repoRoot: string;
  outputDir: string;
  authoringManifestPath: string;
}): QaWizardReconciliationAuthoringManifest {
  assertSameOutputDir({
    outputDir: args.outputDir,
    artifactPath: args.authoringManifestPath,
    category: 'reconciliation-authoring-manifests',
  });
  const raw = readJson(
    args.repoRoot,
    args.authoringManifestPath,
    'reconciliation authoring manifest',
  );
  if (
    !objectValue(raw) ||
    raw.version !== QA_WIZARD_RECONCILIATION_AUTHORING_MANIFEST_VERSION ||
    raw.stage !== 'reconciliation_content_pending_guy_review' ||
    raw.digestAlgorithm !== 'canonical-json-sha256' ||
    !digestValue(raw.digest)
  ) {
    throw new Error('reconciliation authoring manifest is invalid');
  }
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = raw;
  if (
    raw.digest !== canonicalJsonDigest(payload) ||
    path.posix.basename(normalizedRepoRelative(args.authoringManifestPath)) !==
      `${raw.digest}.json` ||
    fs.readFileSync(
      resolveExistingContainedArtifact({
        repoRoot: args.repoRoot,
        relativePath: args.authoringManifestPath,
        label: 'reconciliation authoring manifest',
      }),
      'utf8',
    ) !== canonicalContentAddressedJsonBytes(raw)
  ) {
    throw new Error('reconciliation authoring manifest is stale or tampered');
  }
  return raw as unknown as QaWizardReconciliationAuthoringManifest;
}

function replayAuthoredContent(args: {
  repoRoot: string;
  outputDir: string;
  manifest: QaWizardReconciliationAuthoringManifest;
}): ReturnType<typeof prepareQaWizardReviewedReconciliation> {
  const base = loadAuthoringBase({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    bridgeManifestPath: args.manifest.bridge.path,
  });
  const planRaw = readJson(
    args.repoRoot,
    args.manifest.reviewerPlan.path,
    'reconciliation reviewer plan',
  );
  const plan = validatedPlan({ plan: planRaw, base });
  if (!plan) {
    throw new Error('reconciliation reviewer plan is stale or tampered');
  }
  if (
    path.posix.basename(normalizedRepoRelative(args.manifest.reviewerPlan.path)) !==
      `${plan.digest}.json` ||
    outputDirFromArtifactPath(
      args.manifest.reviewerPlan.path,
      'reconciliation-reviewer-plans',
    ) !== normalizedRepoRelative(args.outputDir) ||
    fs.readFileSync(
      resolveExistingContainedArtifact({
        repoRoot: args.repoRoot,
        relativePath: args.manifest.reviewerPlan.path,
        label: 'reconciliation reviewer plan',
      }),
      'utf8',
    ) !== canonicalContentAddressedJsonBytes(plan)
  ) {
    throw new Error('reconciliation reviewer plan path or bytes are not canonical');
  }
  const pending = applyReviewerPlan({ base, plan });
  const prospective = approvePendingSourcePromptReconciliation({
    pending,
    approvedBy: 'Guy',
    approvedAt: PROSPECTIVE_VALIDATION_TIMESTAMP,
  });
  const pendingIssues = sourcePromptReconciliationIssues(
    validationArgs({ reconciliation: pending, base }),
  );
  const prospectiveIssues = sourcePromptReconciliationIssues(
    validationArgs({ reconciliation: prospective, base }),
  );
  const reviewBundle = buildReconciliationReviewBundle({
    reconciliation: pending,
    sourceIdentity: base.snapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: base.snapshot.digest,
    rawStorySource: base.snapshot.content.normalizedRawStorySource,
    template: base.candidate.template,
    ...(base.snapshot.content.authoredCoverAuthority
      ? { authoredCoverAuthority: base.snapshot.content.authoredCoverAuthority }
      : {}),
    actionSemanticCoverage: base.candidate.actionSemanticCoverage,
  });
  const contentReview = buildContentReview({
    base,
    plan,
    pending,
    prospectiveApproved: prospective,
    pendingIssues,
    prospectiveIssues,
  });
  const contentReviewMarkdown = renderContentReviewMarkdown(contentReview);
  const reviewMarkdown = renderReconciliationReviewMarkdown(reviewBundle);
  const rebuiltManifest = buildAuthoringManifest({
    base,
    bridgeManifestPath: args.manifest.bridge.path,
    outputDir: args.outputDir,
    plan,
    pending,
    reviewBundle,
    contentReview,
    contentReviewMarkdown,
  });
  if (
    prospectiveIssues.length !== 0 ||
    canonicalContentAddressedJsonBytes(rebuiltManifest) !==
      canonicalContentAddressedJsonBytes(args.manifest) ||
    canonicalJsonDigest(pending) !== args.manifest.reconciliation.digest ||
    reviewBundle.digest !== args.manifest.reconciliation.reviewBundleDigest ||
    contentReview.digest !== args.manifest.contentReview.digest ||
    sha256Utf8(contentReviewMarkdown) !==
      args.manifest.contentReview.markdownSha256
  ) {
    throw new Error('reconciliation authored content cannot be exactly replayed');
  }
  const expectedFiles = [
    {
      path: args.manifest.reconciliation.path,
      bytes: reconciliationDraftBundleJsonBytes(pending),
    },
    {
      path: args.manifest.reconciliation.reviewBundlePath,
      bytes: reconciliationDraftBundleJsonBytes(reviewBundle),
    },
    {
      path: args.manifest.reconciliation.reviewMarkdownPath,
      bytes: reviewMarkdown,
    },
    {
      path: args.manifest.contentReview.path,
      bytes: canonicalContentAddressedJsonBytes(contentReview),
    },
    {
      path: args.manifest.contentReview.markdownPath,
      bytes: contentReviewMarkdown,
    },
  ];
  for (const file of expectedFiles) {
    const absolute = resolveExistingContainedArtifact({
      repoRoot: args.repoRoot,
      relativePath: file.path,
      label: 'persisted reconciliation authoring packet',
    });
    if (fs.readFileSync(absolute, 'utf8') !== file.bytes) {
      throw new Error(
        `persisted reconciliation authoring packet is missing or tampered: ${file.path}`,
      );
    }
  }
  return {
    reviewerPlan: plan,
    pendingReconciliation: pending,
    reviewBundle,
    contentReview,
    contentReviewMarkdown,
    manifest: rebuiltManifest,
    artifacts: {
      reviewerPlan: {
        path: args.manifest.reviewerPlan.path,
        digest: plan.digest,
        created: false,
      },
      reconciliation: {
        reconciliationPath: args.manifest.reconciliation.path,
        reviewBundlePath: args.manifest.reconciliation.reviewBundlePath,
        markdownPath: args.manifest.reconciliation.reviewMarkdownPath,
        wrote: false,
      },
      contentReview: {
        path: args.manifest.contentReview.path,
        digest: contentReview.digest,
        created: false,
      },
      contentReviewMarkdownPath: args.manifest.contentReview.markdownPath,
      manifest: {
        path: jsonArtifactPath(
          args.outputDir,
          'reconciliation-authoring-manifests',
          rebuiltManifest.digest,
        ),
        digest: rebuiltManifest.digest,
        created: false,
      },
    },
  };
}

export function recordQaWizardReviewedReconciliationApproval(
  args: RecordQaWizardReviewedReconciliationApprovalRequest,
): {
  approvedReconciliation: SourcePromptReconciliation;
  approvedReviewBundle: ReconciliationReviewBundle;
  approvalAttestation: QaWizardReconciliationApprovalAttestation;
  approvalArtifact: QaWizardCandidateBridgeArtifactWrite;
  approvedReconciliationArtifacts: ReturnType<typeof persistReconciliationDraftBundle>;
} {
  if (
    args.approvedBy !== 'Guy' ||
    !canonicalUtcTimestampIsValid(args.approvedAt) ||
    args.approvedAt === PROSPECTIVE_VALIDATION_TIMESTAMP
  ) {
    throw new Error('reconciliation approval identity or timestamp is invalid');
  }
  const manifest = loadAuthoringManifest(args);
  const replay = replayAuthoredContent({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    manifest,
  });
  const base = loadAuthoringBase({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    bridgeManifestPath: manifest.bridge.path,
  });
  const approvedReconciliation = approvePendingSourcePromptReconciliation({
    pending: replay.pendingReconciliation,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
  });
  const approvedIssues = sourcePromptReconciliationIssues(
    validationArgs({ reconciliation: approvedReconciliation, base }),
  );
  if (approvedIssues.length > 0) {
    throw new Error('approved reconciliation has blocking semantic issues');
  }
  const approvedReviewBundle = buildReconciliationReviewBundle({
    reconciliation: approvedReconciliation,
    sourceIdentity: base.snapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: base.snapshot.digest,
    rawStorySource: base.snapshot.content.normalizedRawStorySource,
    template: base.candidate.template,
    ...(base.snapshot.content.authoredCoverAuthority
      ? { authoredCoverAuthority: base.snapshot.content.authoredCoverAuthority }
      : {}),
    actionSemanticCoverage: base.candidate.actionSemanticCoverage,
  });
  const approvedReviewMarkdown = renderReconciliationReviewMarkdown(
    approvedReviewBundle,
  );
  const approvalAttestation = buildQaWizardReconciliationApprovalAttestation({
    pendingManifestDigest: base.manifest.digest,
    reconciliation: approvedReconciliation,
    reviewBundle: approvedReviewBundle,
    reviewMarkdown: approvedReviewMarkdown,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
  });
  const approvedPlan = persistReconciliationDraftBundle({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    reconciliation: approvedReconciliation,
    reviewBundle: approvedReviewBundle,
    markdown: approvedReviewMarkdown,
    write: false,
  });
  const approvalPath = jsonArtifactPath(
    args.outputDir,
    'reconciliation-approvals',
    approvalAttestation.digest,
  );
  for (const target of [
    {
      path: approvedPlan.reconciliationPath,
      bytes: reconciliationDraftBundleJsonBytes(approvedReconciliation),
    },
    {
      path: approvedPlan.reviewBundlePath,
      bytes: reconciliationDraftBundleJsonBytes(approvedReviewBundle),
    },
    { path: approvedPlan.markdownPath, bytes: approvedReviewMarkdown },
    {
      path: approvalPath,
      bytes: canonicalContentAddressedJsonBytes(approvalAttestation),
    },
  ]) {
    assertTargetCompatible({
      repoRoot: args.repoRoot,
      relativePath: target.path,
      bytes: target.bytes,
    });
  }
  let approvedReconciliationArtifacts = approvedPlan;
  let approvalCreated = false;
  if (args.write === true) {
    const store = createContainedContentAddressedJsonArtifactStore({
      repoRoot: args.repoRoot,
      repositoryRealPath: fs.realpathSync(args.repoRoot),
      outputDir: args.outputDir,
      categories: [
        'reconciliations',
        'reviews',
        'reconciliation-approvals',
      ] as const,
      rejectSymlinkAliases: true,
      errorPrefix: 'reconciliation reviewer approval',
    });
    store.prepare();
    approvedReconciliationArtifacts = persistReconciliationDraftBundle({
      repoRoot: args.repoRoot,
      outputDir: args.outputDir,
      reconciliation: approvedReconciliation,
      reviewBundle: approvedReviewBundle,
      markdown: approvedReviewMarkdown,
      write: true,
    });
    approvalCreated = store.persist({
      category: 'reconciliation-approvals',
      digest: approvalAttestation.digest,
      value: approvalAttestation,
    }).created;
  }
  const approvalArtifact: QaWizardCandidateBridgeArtifactWrite = {
    path: approvalPath,
    digest: approvalAttestation.digest,
    created: approvalCreated,
  };
  return {
    approvedReconciliation,
    approvedReviewBundle,
    approvalAttestation,
    approvalArtifact,
    approvedReconciliationArtifacts,
  };
}
