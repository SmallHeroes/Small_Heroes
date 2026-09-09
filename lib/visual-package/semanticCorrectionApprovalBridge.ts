/** Offline semantic/reconciliation review and exact operator approval. Never production context authority. */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalHash } from '@/lib/canonical-json';
import { canonicalContentAddressedJsonBytes } from './canonicalContentAddressedJson';
import { createContainedContentAddressedJsonArtifactStore } from './canonicalLiveAuthoringArtifacts';
import { resolveExistingContainedArtifact, readCurrentQaWizardConsumerRepositoryAuthority } from './qaWizardCandidateBridge';
import { validateSemanticCorrectionForCurrentConsumer, type SemanticCorrectionConsumerValidationRequest } from './semanticCorrectionConsumerValidation';
import { buildProductionReconciliationDraftFromSourceSnapshot, approvePendingSourcePromptReconciliation,
  buildReconciliationReviewBundle } from './reconciliationLifecycle';
import { buildReviewedReconciliationContent, type ReconciliationAuthoringBasis } from './reconciliationAuthoringLifecycle';
import { sourcePromptReconciliationIssues } from './sourcePromptReconciliation';
import { QA_WIZARD_RECONCILIATION_PROSPECTIVE_VALIDATION_TIMESTAMP } from './qaWizardCandidateBridge';

export const SEMANTIC_CORRECTION_APPROVAL_VERSION = 'visual-contract-semantic-correction-approval/v1' as const;
export const QA_WIZARD_SEMANTIC_BRIDGE_MANIFEST_VERSION = 'qa-wizard-candidate-bridge-manifest/v6' as const;
const EXCLUSIONS = ['candidate_mutation', 'reconciliation_approval', 'blueprint_authoring',
  'blueprint_approval', 'package_approval', 'image_render', 'provider_call', 'credential_load',
  'publication', 'deployment'] as const;
type Validated = Awaited<ReturnType<typeof validateSemanticCorrectionForCurrentConsumer>>;
type ApprovalCategory = 'semantic-correction-approvals' | 'bridge-manifests' |
  'semantic-reconciliation-reviews' | 'semantic-reconciliation-approvals';

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function argumentsCopy<T>(value: T, keys: readonly string[], optional: readonly string[] = []): T {
  if (!object(value) || keys.some(k => !Object.prototype.hasOwnProperty.call(value, k)) ||
      Object.keys(value).some(k => !keys.includes(k) && !optional.includes(k))) {
    throw new Error('semantic_bridge_arguments_invalid');
  }
  // Pin caller inputs before any await. There is no injected proof/validator hook.
  return JSON.parse(JSON.stringify(value)) as T;
}
function digest(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error('semantic_bridge_digest_invalid');
}
function reviewer(approvedBy: unknown, approvedAt: unknown) {
  if (approvedBy !== 'Guy' || typeof approvedAt !== 'string' || !Number.isFinite(Date.parse(approvedAt)) ||
      new Date(approvedAt).toISOString() !== approvedAt) throw new Error('semantic_bridge_reviewer_invalid');
}
function sealed<T extends object>(payload: T) {
  return { ...payload, digestAlgorithm: 'canonical-json-sha256' as const, digest: canonicalHash(payload) };
}
function equal(a: unknown, b: unknown) { return canonicalHash(a) === canonicalHash(b); }
function writeFlag(value: unknown) {
  if (value !== undefined && value !== true && value !== false) throw new Error('semantic_bridge_write_flag_invalid');
  return value === true;
}
function readCanonical<T>(repoRoot: string, relativePath: string, category: ApprovalCategory, expectedDigest: string) {
  digest(expectedDigest);
  const file = resolveExistingContainedArtifact({ repoRoot, relativePath, label: 'semantic bridge artifact' });
  if (fs.statSync(file).size > 4_000_000) throw new Error('semantic_bridge_artifact_too_large');
  const bytes = fs.readFileSync(file, 'utf8');
  const value: unknown = JSON.parse(bytes);
  if (!object(value)) throw new Error('semantic_bridge_artifact_invalid');
  const { digest: stored, digestAlgorithm, ...payload } = value;
  if (stored !== expectedDigest || digestAlgorithm !== 'canonical-json-sha256' || canonicalHash(payload) !== stored ||
      bytes !== canonicalContentAddressedJsonBytes(value) || path.posix.basename(relativePath) !== `${stored}.json` ||
      path.posix.basename(path.posix.dirname(relativePath)) !== category) throw new Error('semantic_bridge_artifact_not_canonical');
  return { value: value as T, bytes };
}
function publish(args: { repoRoot: string; outputDir: string; category: ApprovalCategory; value: { digest: string };
  write?: boolean; validated: Validated }) {
  const write = writeFlag(args.write);
  if (Buffer.byteLength(canonicalContentAddressedJsonBytes(args.value), 'utf8') > 4_000_000) {
    throw new Error('semantic_bridge_artifact_too_large');
  }
  if (typeof args.outputDir !== 'string' || !args.outputDir.startsWith('outputs/') ||
      args.outputDir.split('/').some(p => !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(p)) ||
      path.posix.normalize(args.outputDir) !== args.outputDir) throw new Error('semantic_bridge_output_invalid');
  const repoRoot = fs.realpathSync(args.repoRoot);
  const store = createContainedContentAddressedJsonArtifactStore({ repoRoot, outputDir: args.outputDir,
    categories: [args.category], rejectSymlinkAliases: true, errorPrefix: 'semantic bridge' });
  const categoryDir = path.join(repoRoot, args.outputDir, args.category);
  try {
    const info = fs.lstatSync(categoryDir);
    if (!info.isDirectory() || info.isSymbolicLink() || fs.realpathSync(categoryDir) !== categoryDir) {
      throw new Error('semantic_bridge_category_alias');
    }
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const relativePath = `${args.outputDir}/${args.category}/${args.value.digest}.json`;
  try {
    fs.lstatSync(path.join(repoRoot, relativePath));
    const existing = readCanonical(repoRoot, relativePath, args.category, args.value.digest);
    if (existing.bytes !== canonicalContentAddressedJsonBytes(args.value)) throw new Error('semantic_bridge_collision');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (!equal(readCurrentQaWizardConsumerRepositoryAuthority(repoRoot), args.validated.proof.currentConsumer)) {
    throw new Error('semantic_bridge_consumer_changed_before_publish');
  }
  if (write) {
    store.prepare();
    const artifact = store.persist({ category: args.category, digest: args.value.digest, value: args.value });
    // The shared legacy-compatible store can accept alternate historical JSON
    // formatting. readCanonical pins the expected digest AND exact canonical
    // bytes on return; a second byte comparison cannot add an integrity check.
    readCanonical(repoRoot, relativePath, args.category, args.value.digest);
    return artifact;
  }
  return { path: relativePath, digest: args.value.digest, created: false };
}

function approvalFor(args: { validation: SemanticCorrectionConsumerValidationRequest; approvedBy: 'Guy'; approvedAt: string },
  validated: Validated) {
  reviewer(args.approvedBy, args.approvedAt);
  const { packet, historical } = validated;
  return sealed({ version: SEMANTIC_CORRECTION_APPROVAL_VERSION,
    validationRequest: args.validation,
    subject: { storyKey: historical.snapshot.content.storyKey, sourceSnapshotDigest: historical.snapshot.digest,
      candidateDigest: historical.candidate.digest, reviewPacketDigest: packet.digest,
      planDigest: packet.plan.digest, correctionDigest: packet.correction.digest,
      original: packet.correction.original,
      effective: { templateDigest: packet.correction.effective.templateDigest,
        coverageDigest: packet.correction.effective.coverageDigest,
        catalogVersion: packet.correction.effective.catalogVersion, catalogDigest: packet.correction.effective.catalogDigest } },
    decision: 'approved' as const, approvedBy: args.approvedBy, approvedAt: args.approvedAt,
    authorityScope: 'exact_semantic_correction_approval_only' as const, doesNotAuthorize: [...EXCLUSIONS] });
}
export type SemanticCorrectionApproval = ReturnType<typeof approvalFor>;
export interface RecordSemanticCorrectionApprovalRequest {
  validation: SemanticCorrectionConsumerValidationRequest;
  expectedReviewPacketDigest: string;
  approvedBy: 'Guy'; approvedAt: string; outputDir: string; write?: boolean;
}
/** Operator-mediated Guy decision, not authentication or automatic acceptance. */
export async function recordSemanticCorrectionApproval(input: RecordSemanticCorrectionApprovalRequest) {
  const args = argumentsCopy(input, ['validation', 'expectedReviewPacketDigest', 'approvedBy', 'approvedAt', 'outputDir'], ['write']);
  reviewer(args.approvedBy, args.approvedAt); digest(args.expectedReviewPacketDigest); writeFlag(args.write);
  const validated = await validateSemanticCorrectionForCurrentConsumer(args.validation);
  if (validated.packet.digest !== args.expectedReviewPacketDigest) throw new Error('semantic_bridge_expected_packet_mismatch');
  const approval = approvalFor(args, validated);
  const artifact = publish({ repoRoot: args.validation.consumerRepoRoot, outputDir: args.outputDir,
    category: 'semantic-correction-approvals', value: approval, write: args.write, validated });
  return { approval, artifact, validated, providerCalls: 0 as const };
}
export interface LoadSemanticCorrectionApprovalRequest {
  consumerRepoRoot: string; approvalPath: string; expectedApprovalDigest: string;
}
/** Every use revalidates current code/source AND the real historical chain. */
export async function loadApprovedSemanticCorrection(input: LoadSemanticCorrectionApprovalRequest) {
  const args = argumentsCopy(input, ['consumerRepoRoot', 'approvalPath', 'expectedApprovalDigest']);
  const original = readCanonical<SemanticCorrectionApproval>(args.consumerRepoRoot, args.approvalPath,
    'semantic-correction-approvals', args.expectedApprovalDigest);
  const raw = original.value;
  if (!object(raw.validationRequest) || fs.realpathSync(raw.validationRequest.consumerRepoRoot) !== fs.realpathSync(args.consumerRepoRoot)) {
    throw new Error('semantic_bridge_approval_consumer_mismatch');
  }
  const validated = await validateSemanticCorrectionForCurrentConsumer(raw.validationRequest);
  const approval = approvalFor({ validation: raw.validationRequest, approvedBy: raw.approvedBy, approvedAt: raw.approvedAt }, validated);
  if (canonicalContentAddressedJsonBytes(approval) !== original.bytes ||
      readCanonical(args.consumerRepoRoot, args.approvalPath, 'semantic-correction-approvals', args.expectedApprovalDigest).bytes !== original.bytes) {
    throw new Error('semantic_bridge_approval_reconstruction_mismatch');
  }
  return { approval, validated };
}
function manifestFor(args: LoadSemanticCorrectionApprovalRequest, loaded: Awaited<ReturnType<typeof loadApprovedSemanticCorrection>>) {
  const { approval, validated } = loaded;
  const effective = validated.packet.correction.effective;
  const draft = buildProductionReconciliationDraftFromSourceSnapshot({ snapshot: validated.historical.snapshot,
    template: effective.template, actionSemanticCoverage: effective.coverage });
  return sealed({ version: QA_WIZARD_SEMANTIC_BRIDGE_MANIFEST_VERSION,
    stage: 'reconciliation_pending' as const, authorityScope: 'effective_semantic_reconciliation_draft_only' as const,
    approval: { path: args.approvalPath, digest: approval.digest },
    currentValidation: { digest: validated.proof.digest, currentConsumer: validated.proof.currentConsumer,
      historicalProofDigest: validated.proof.historicalProofDigest },
    subject: approval.subject, effective, reconciliation: draft,
    productionContext: null, providerCalls: 0 as const, doesNotAuthorize: [...EXCLUSIONS] });
}
export type SemanticCorrectionBridgeManifest = ReturnType<typeof manifestFor>;
export interface PrepareSemanticCorrectionBridgeRequest extends LoadSemanticCorrectionApprovalRequest { outputDir: string; write?: boolean }
/** Reuses the real reconciliation projection with effective, not paid, coverage. */
export async function prepareSemanticCorrectionBridge(input: PrepareSemanticCorrectionBridgeRequest) {
  const args = argumentsCopy(input, ['consumerRepoRoot', 'approvalPath', 'expectedApprovalDigest', 'outputDir'], ['write']);
  writeFlag(args.write);
  const identity = { consumerRepoRoot: args.consumerRepoRoot, approvalPath: args.approvalPath, expectedApprovalDigest: args.expectedApprovalDigest };
  const loaded = await loadApprovedSemanticCorrection(identity);
  const manifest = manifestFor(identity, loaded);
  const artifact = publish({ repoRoot: args.consumerRepoRoot, outputDir: args.outputDir,
    category: 'bridge-manifests', value: manifest, write: args.write, validated: loaded.validated });
  return { manifest, artifact, validated: loaded.validated, providerCalls: 0 as const };
}
/** Serialized manifests/proofs are never sufficient; rebuild everything now. */
export async function loadSemanticCorrectionBridge(input: { consumerRepoRoot: string; manifestPath: string; expectedManifestDigest: string }) {
  const args = argumentsCopy(input, ['consumerRepoRoot', 'manifestPath', 'expectedManifestDigest']);
  const original = readCanonical<SemanticCorrectionBridgeManifest>(args.consumerRepoRoot, args.manifestPath,
    'bridge-manifests', args.expectedManifestDigest);
  const identity = { consumerRepoRoot: args.consumerRepoRoot, approvalPath: original.value.approval.path,
    expectedApprovalDigest: original.value.approval.digest };
  const loaded = await loadApprovedSemanticCorrection(identity);
  const manifest = manifestFor(identity, loaded);
  if (canonicalContentAddressedJsonBytes(manifest) !== original.bytes ||
      readCanonical(args.consumerRepoRoot, args.manifestPath, 'bridge-manifests', args.expectedManifestDigest).bytes !== original.bytes) {
    throw new Error('semantic_bridge_manifest_reconstruction_mismatch');
  }
  return { manifest, validated: loaded.validated, providerCalls: 0 as const };
}

export const SEMANTIC_RECONCILIATION_REVIEW_VERSION = 'semantic-reconciliation-review/v1' as const;
export const SEMANTIC_RECONCILIATION_APPROVAL_VERSION = 'semantic-reconciliation-approval/v1' as const;
type BridgeIdentity = Parameters<typeof loadSemanticCorrectionBridge>[0];
type LoadedBridge = Awaited<ReturnType<typeof loadSemanticCorrectionBridge>>;

function reviewBasis(loaded: LoadedBridge): ReconciliationAuthoringBasis {
  const { manifest, validated } = loaded;
  return {
    bridgeManifestDigest: manifest.digest,
    snapshot: validated.historical.snapshot,
    candidateDigest: manifest.subject.candidateDigest,
    authority: { template: manifest.effective.template, templateDigest: manifest.effective.templateDigest,
      actionSemanticCoverage: manifest.effective.coverage, actionSemanticCoverageDigest: manifest.effective.coverageDigest },
    baseReconciliation: manifest.reconciliation.reconciliation,
  };
}

function reconciliationReviewFor(bridge: BridgeIdentity, decisions: unknown, loaded: LoadedBridge) {
  const content = buildReviewedReconciliationContent({ base: reviewBasis(loaded), decisions });
  return sealed({ version: SEMANTIC_RECONCILIATION_REVIEW_VERSION,
    stage: 'reconciliation_review_pending' as const, authorityScope: 'exact_reconciliation_content_review_only' as const,
    bridge, semanticApproval: loaded.manifest.approval, subject: loaded.manifest.subject,
    decisions, content, productionContext: null, providerCalls: 0 as const, doesNotAuthorize: [...EXCLUSIONS] });
}
export type SemanticReconciliationReview = ReturnType<typeof reconciliationReviewFor>;
export interface PrepareSemanticReconciliationReviewRequest extends BridgeIdentity {
  decisions: unknown; outputDir: string; write?: boolean;
}
/** Exact reviewer decisions only: no automatic preservation, rebind or supersession. */
export async function prepareSemanticReconciliationReview(input: PrepareSemanticReconciliationReviewRequest) {
  const args = argumentsCopy(input, ['consumerRepoRoot', 'manifestPath', 'expectedManifestDigest', 'decisions', 'outputDir'], ['write']);
  writeFlag(args.write);
  const bridge = { consumerRepoRoot: args.consumerRepoRoot, manifestPath: args.manifestPath, expectedManifestDigest: args.expectedManifestDigest };
  const loaded = await loadSemanticCorrectionBridge(bridge);
  const review = reconciliationReviewFor(bridge, args.decisions, loaded);
  const artifact = publish({ repoRoot: args.consumerRepoRoot, outputDir: args.outputDir,
    category: 'semantic-reconciliation-reviews', value: review, write: args.write, validated: loaded.validated });
  return { review, artifact, validated: loaded.validated, providerCalls: 0 as const };
}
export interface LoadSemanticReconciliationReviewRequest {
  consumerRepoRoot: string; reviewPath: string; expectedReviewDigest: string;
}
/** A rehashed plan, review summary or prospective result is not trusted evidence. */
export async function loadSemanticReconciliationReview(input: LoadSemanticReconciliationReviewRequest) {
  const args = argumentsCopy(input, ['consumerRepoRoot', 'reviewPath', 'expectedReviewDigest']);
  const original = readCanonical<SemanticReconciliationReview>(args.consumerRepoRoot, args.reviewPath,
    'semantic-reconciliation-reviews', args.expectedReviewDigest);
  if (!object(original.value.bridge) ||
      fs.realpathSync(original.value.bridge.consumerRepoRoot) !== fs.realpathSync(args.consumerRepoRoot)) {
    throw new Error('semantic_reconciliation_review_consumer_mismatch');
  }
  const loaded = await loadSemanticCorrectionBridge(original.value.bridge);
  const review = reconciliationReviewFor(original.value.bridge, original.value.decisions, loaded);
  if (canonicalContentAddressedJsonBytes(review) !== original.bytes ||
      readCanonical(args.consumerRepoRoot, args.reviewPath, 'semantic-reconciliation-reviews', args.expectedReviewDigest).bytes !== original.bytes) {
    throw new Error('semantic_reconciliation_review_reconstruction_mismatch');
  }
  return { review, loaded, providerCalls: 0 as const };
}

function reconciliationApprovalFor(args: LoadSemanticReconciliationReviewRequest & { approvedBy: 'Guy'; approvedAt: string },
  reviewed: Awaited<ReturnType<typeof loadSemanticReconciliationReview>>) {
  reviewer(args.approvedBy, args.approvedAt);
  if (args.approvedAt === QA_WIZARD_RECONCILIATION_PROSPECTIVE_VALIDATION_TIMESTAMP) {
    throw new Error('semantic_reconciliation_prospective_timestamp_reserved');
  }
  const base = reviewBasis(reviewed.loaded);
  const reconciliation = approvePendingSourcePromptReconciliation({ pending: reviewed.review.content.pendingReconciliation,
    approvedBy: args.approvedBy, approvedAt: args.approvedAt });
  const validation = { storyKey: base.snapshot.content.storyKey,
    sourceIdentity: base.snapshot.content.sourceIdentity, sourceAuthoritySnapshotDigest: base.snapshot.digest,
    rawStorySource: base.snapshot.content.normalizedRawStorySource, template: base.authority.template,
    templateDigest: base.authority.templateDigest, actionSemanticCoverage: base.authority.actionSemanticCoverage,
    ...(base.snapshot.content.authoredCoverAuthority ? { authoredCoverAuthority: base.snapshot.content.authoredCoverAuthority } : {}) };
  const issues = sourcePromptReconciliationIssues({ ...validation, raw: reconciliation, requireComplete: true });
  if (issues.length) throw new Error('semantic_reconciliation_approval_incomplete');
  const reviewBundle = buildReconciliationReviewBundle({ ...validation, reconciliation });
  return sealed({ version: SEMANTIC_RECONCILIATION_APPROVAL_VERSION,
    stage: 'reconciliation_approved' as const, authorityScope: 'exact_reconciliation_approval_only' as const,
    review: { path: args.reviewPath, digest: args.expectedReviewDigest },
    semanticApproval: reviewed.review.semanticApproval, subject: reviewed.review.subject,
    approvedBy: args.approvedBy, approvedAt: args.approvedAt,
    reconciliation, reconciliationDigest: canonicalHash(reconciliation), reviewBundle,
    productionContext: null, providerCalls: 0 as const,
    doesNotAuthorize: EXCLUSIONS.filter(value => value !== 'reconciliation_approval') });
}
export type SemanticReconciliationApproval = ReturnType<typeof reconciliationApprovalFor>;
export interface RecordSemanticReconciliationApprovalRequest extends LoadSemanticReconciliationReviewRequest {
  approvedBy: 'Guy'; approvedAt: string; outputDir: string; write?: boolean;
}
/** Records an operator-supplied exact Guy decision; neither authentication nor product acceptance by code. */
export async function recordSemanticReconciliationApproval(input: RecordSemanticReconciliationApprovalRequest) {
  const args = argumentsCopy(input, ['consumerRepoRoot', 'reviewPath', 'expectedReviewDigest', 'approvedBy', 'approvedAt', 'outputDir'], ['write']);
  reviewer(args.approvedBy, args.approvedAt); writeFlag(args.write);
  const reviewed = await loadSemanticReconciliationReview({ consumerRepoRoot: args.consumerRepoRoot,
    reviewPath: args.reviewPath, expectedReviewDigest: args.expectedReviewDigest });
  const approval = reconciliationApprovalFor(args, reviewed);
  const artifact = publish({ repoRoot: args.consumerRepoRoot, outputDir: args.outputDir,
    category: 'semantic-reconciliation-approvals', value: approval, write: args.write, validated: reviewed.loaded.validated });
  return { approval, artifact, validated: reviewed.loaded.validated, providerCalls: 0 as const };
}
export interface LoadSemanticReconciliationApprovalRequest {
  consumerRepoRoot: string; approvalPath: string; expectedApprovalDigest: string;
}
/** Replays the full v6 chain and exact review. Still not a Blueprint/package context. */
export async function loadApprovedSemanticReconciliation(input: LoadSemanticReconciliationApprovalRequest) {
  const args = argumentsCopy(input, ['consumerRepoRoot', 'approvalPath', 'expectedApprovalDigest']);
  const original = readCanonical<SemanticReconciliationApproval>(args.consumerRepoRoot, args.approvalPath,
    'semantic-reconciliation-approvals', args.expectedApprovalDigest);
  const reviewed = await loadSemanticReconciliationReview({ consumerRepoRoot: args.consumerRepoRoot,
    reviewPath: original.value.review.path, expectedReviewDigest: original.value.review.digest });
  const approval = reconciliationApprovalFor({ consumerRepoRoot: args.consumerRepoRoot,
    reviewPath: original.value.review.path, expectedReviewDigest: original.value.review.digest,
    approvedBy: original.value.approvedBy, approvedAt: original.value.approvedAt }, reviewed);
  if (canonicalContentAddressedJsonBytes(approval) !== original.bytes ||
      readCanonical(args.consumerRepoRoot, args.approvalPath, 'semantic-reconciliation-approvals', args.expectedApprovalDigest).bytes !== original.bytes) {
    throw new Error('semantic_reconciliation_approval_reconstruction_mismatch');
  }
  return { approval, reviewed, providerCalls: 0 as const };
}
