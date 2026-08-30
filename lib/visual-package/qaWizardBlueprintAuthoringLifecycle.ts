import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  canonicalContentAddressedJsonBytes,
} from './canonicalContentAddressedJson';
import {
  canonicalJsonDigest,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION,
  loadQaWizardApprovedProductionContext,
  type QaWizardCandidateBridgeManifest,
} from './qaWizardCandidateBridge';
import {
  PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
  PRODUCTION_AUTHORING_RUN_REQUEST_VERSION,
  PRODUCTION_BLUEPRINT_RUNNER_TERMINAL_FAILURE_CODES,
  buildProductionAuthoringRunRequest,
  aggregateProductionAuthoringExecutionAttestations,
  persistBlueprintAuthoringSanitizedFailureCapture,
  persistProductionAuthoringReceipt,
  productionAuthoringReceiptBytes,
  productionBlueprintAuthoringPreflightIssues,
  runProductionBlueprintAuthoring,
  type ProductionAuthoringProvider,
  type ProductionAuthoringAttemptFailureCode,
  type ProductionAuthoringRunReceipt,
  type ProductionAuthoringRunRequest,
} from './productionAuthoringRunner';
import {
  BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION,
  blueprintAuthoringSanitizedFailureCaptureBytes,
  blueprintAuthoringSanitizedFailureCaptureIsValid,
  type BlueprintAuthoringSanitizedFailureCapture,
} from './blueprintAuthoringSanitizedFailureCapture';
import type { ProductionAuthoringContext } from './productionAuthoringContext';
import {
  authoringBudgetExhaustionBindingIsValid,
  canonicalCompletedExecutionAttestationIsValid,
  authoringExecutionAttestationIsValid,
  authoringTerminalFailureIsValid,
  authoringValidationDiagnosticsAreValid,
} from './authoringTerminalDiagnostics';
import {
  BLUEPRINT_AUTHORING_MAX_CALLS,
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_REPAIRS,
  BLUEPRINT_AUTHORING_MODEL,
  OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
  blueprintAuthoringInputAccountingIsCanonicalForSchema,
  blueprintAuthoringReservedExposureUsd,
  blueprintAuthoringSpendIsWithinCeiling,
  blueprintAuthoringUsageIsInternallyConsistent,
  conservativeBlueprintAuthoringCostUsd,
  nominalBlueprintAuthoringUsageCostUsd,
} from './blueprintAuthoringPolicy';
import {
  blueprintAuthoringInputTokensAreAdmissible,
  blueprintAuthoringInputTokensExceedCeiling,
} from './blueprintAuthoringInputTokenAdmission';
import {
  PRE_RENDER_BLUEPRINT_APPROVAL_VERSION,
  PRE_RENDER_BLUEPRINT_APPROVER,
  computePreRenderBlueprintApprovalDigest,
  computePreRenderBlueprintReviewPacketDigest,
  buildPreRenderBlueprintReviewBundle,
  createPreRenderBlueprintValidationEvidence,
  planPreRenderBlueprintApprovalAttestation,
  preRenderBlueprintLifecycleJsonBytes,
  persistPreRenderBlueprintLifecycle,
  validatePreRenderBlueprintApprovalAttestation,
  writeImmutableLocalArtifact,
  type PreRenderBlueprintApprovalAttestation,
  type PreRenderBlueprintReviewPacket,
  type ImmutableWriteHooks,
} from './preRenderBlueprintLifecycle';
import {
  assertValidPreRenderBookVisualBlueprint,
  buildPreRenderBlueprintAuthoringAuthority,
  serializePreRenderBookVisualBlueprint,
} from './preRenderBlueprint';
import type { PreRenderBookVisualBlueprint } from './preRenderBlueprintTypes';
import {
  PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION,
  PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION,
  PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION,
  type PreRenderBlueprintAuthoringAttempt,
  type PreRenderBlueprintAuthoringProvenance,
} from './preRenderBlueprintAuthoringContract';
import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION,
} from './preRenderBlueprintDraftSchema';
import {
  QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER,
  buildBlueprintReplacementAuthorization,
  buildBlueprintReplacementExecutionClaim,
  buildBlueprintReplacementProposal,
  buildBlueprintReplacementReview,
  blueprintReplacementAuthorizationIsValid,
  blueprintReplacementExecutionClaimIsValid,
  blueprintReplacementProposalIsValid,
  blueprintReplacementReviewIsValid,
  blueprintReplacementSuccessorExecutionDigest,
  type QaWizardBlueprintReplacementAuthorization,
  type QaWizardBlueprintReplacementProposal,
  type QaWizardBlueprintReplacementReview,
} from './qaWizardBlueprintReplacementAuthority';

export const QA_WIZARD_BLUEPRINT_AUTHORING_MANIFEST_VERSION =
  'qa-wizard-blueprint-authoring-manifest/v1' as const;
export const QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION =
  'qa-wizard-blueprint-execution-claim/v1' as const;
export const QA_WIZARD_BLUEPRINT_EXECUTION_RECORD_VERSION =
  'qa-wizard-blueprint-execution-record/v1' as const;
export const QA_WIZARD_BLUEPRINT_EXECUTION_INCIDENT_VERSION =
  'qa-wizard-blueprint-execution-incident/v1' as const;
export const QA_WIZARD_BLUEPRINT_APPROVAL_DECISION_VERSION =
  'qa-wizard-blueprint-approval-decision/v1' as const;
export const QA_WIZARD_BLUEPRINT_TERMINAL_BINDING_VERSION =
  'qa-wizard-blueprint-terminal-binding/v1' as const;
export const QA_WIZARD_BLUEPRINT_REPLACEMENT_SLOT_VERSION =
  'qa-wizard-blueprint-replacement-authorization-slot/v1' as const;

export const QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT =
  'outputs/qa-wizard-blueprint-authoring-ledger-v1' as const;

const DIGEST_ALGORITHM = 'canonical-json-sha256' as const;
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const CANONICAL_UTC_MILLISECONDS =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const BEFORE_APPROVAL_EXCLUSIONS = [
  'blueprint_approval',
  'visual_package_authoring',
  'visual_package_approval',
  'wizard_qualification',
  'wizard_render',
  'image_render',
  'audio_render',
  'production_publication',
  'deployment',
] as const;

const AFTER_APPROVAL_EXCLUSIONS = [
  'visual_package_authoring',
  'visual_package_approval',
  'wizard_qualification',
  'wizard_render',
  'image_render',
  'audio_render',
  'production_publication',
  'deployment',
] as const;

export type QaWizardBlueprintAuthoringStage =
  | 'live_request_preflight_passed'
  | 'blueprint_candidate'
  | 'authoring_failed'
  | 'blueprint_approved';

interface ManifestPredecessor {
  version: typeof QA_WIZARD_BLUEPRINT_AUTHORING_MANIFEST_VERSION;
  digest: string;
  path: string;
}

interface ManifestBridgeAuthority {
  version: typeof QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION;
  digest: string;
  path: string;
}

interface ManifestContextAuthority {
  version: ProductionAuthoringContext['version'];
  digest: string;
}

interface ManifestRequestAuthority {
  version: typeof PRODUCTION_AUTHORING_RUN_REQUEST_VERSION;
  digest: string;
  path: string;
  requestId: string;
  requestedAt: string;
  mode: 'live';
}

interface ManifestReceiptAuthority {
  version: typeof PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION;
  digest: string;
  path: string;
  status: 'completed' | 'failed';
}

interface ManifestBlueprintAuthority {
  blueprintDigest: string;
  authoringAuthorityDigest: string;
  candidatePath: string;
  provenanceDigest: string;
  provenancePath: string;
  validationEvidenceDigest: string;
  validationEvidencePath: string;
  reviewPacketDigest: string;
  reviewPacketPath: string;
  reviewMarkdownDigest: string;
  reviewMarkdownPath: string;
  contactSheetDigest: string;
  contactSheetPath: string;
}

/**
 * Durable binding of a failed run's sanitized failure observability capture. It
 * lives ONLY on `authoring_failed` terminal manifests that actually have a capture
 * (an optional key: its absence leaves every other manifest's digest untouched).
 * The manifest is the terminal authority, so binding the capture here makes the
 * terminal materialization AND replay/recovery paths re-validate the exact capture
 * digest/path/bytes — never an unreferenced sibling.
 */
interface ManifestObservabilityCaptureAuthority {
  version: typeof BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION;
  digest: string;
  path: string;
}

interface ManifestApprovalAuthority {
  version: typeof PRE_RENDER_BLUEPRINT_APPROVAL_VERSION;
  digest: string;
  path: string;
  approvedBy: typeof PRE_RENDER_BLUEPRINT_APPROVER;
  approvedAt: string;
}

export interface QaWizardBlueprintAuthoringManifest {
  version: typeof QA_WIZARD_BLUEPRINT_AUTHORING_MANIFEST_VERSION;
  stage: QaWizardBlueprintAuthoringStage;
  predecessor: ManifestPredecessor | null;
  bridge: ManifestBridgeAuthority;
  context: ManifestContextAuthority;
  request: ManifestRequestAuthority;
  receipt: ManifestReceiptAuthority | null;
  blueprint: ManifestBlueprintAuthority | null;
  approval: ManifestApprovalAuthority | null;
  /**
   * Optional. Present only on `authoring_failed` terminals that carry a sanitized
   * failure observability capture. Omitted otherwise, so completed/approved/
   * preflight manifests and failed runs without a capture keep their exact prior
   * digest (backward compatible — no manifest version cutover).
   */
  observabilityCapture?: ManifestObservabilityCaptureAuthority;
  doesNotAuthorize: readonly string[];
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface QaWizardBlueprintExecutionClaim {
  version: typeof QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  preflightManifestPath: string;
  requestedAt: string;
  scope: 'single_use_paid_blueprint_authoring';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface QaWizardBlueprintExecutionRecord {
  version: typeof QA_WIZARD_BLUEPRINT_EXECUTION_RECORD_VERSION;
  authoringAuthorityDigest: string;
  requestDigest: string;
  claimDigest: string;
  claimPath: string;
  terminalManifestDigest: string;
  terminalManifestPath: string;
  receiptDigest: string;
  receiptPath: string;
  status: 'completed' | 'failed';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export type QaWizardBlueprintExecutionIncidentPhase =
  | 'claim_validation'
  | 'runner_execution'
  | 'receipt_replay_validation'
  | 'receipt_publication'
  | 'terminal_materialization'
  | 'terminal_manifest_publication'
  | 'terminal_lookup_publication';

export interface QaWizardBlueprintExecutionIncident {
  version: typeof QA_WIZARD_BLUEPRINT_EXECUTION_INCIDENT_VERSION;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  claimDigest: string;
  claimPath: string;
  phase: QaWizardBlueprintExecutionIncidentPhase;
  receiptAvailable: boolean;
  receiptDigest: string | null;
  receiptStatus: 'completed' | 'failed' | null;
  providerOutcome: 'unknown';
  resolution: 'operator_resolution_required_no_redispatch';
  scope: 'single_use_paid_blueprint_authoring_incident';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface QaWizardBlueprintApprovalDecision {
  version: typeof QA_WIZARD_BLUEPRINT_APPROVAL_DECISION_VERSION;
  candidateManifestDigest: string;
  candidateManifestPath: string;
  blueprintDigest: string;
  authoringAuthorityDigest: string;
  reviewPacketDigest: string;
  approvalDigest: string;
  approvalPath: string;
  approvedManifestDigest: string;
  approvedManifestPath: string;
  approvedBy: typeof PRE_RENDER_BLUEPRINT_APPROVER;
  approvedAt: string;
  note: string | null;
  scope: 'single_blueprint_approval_decision';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface PreparedQaWizardBlueprintLiveRequest {
  manifest: QaWizardBlueprintAuthoringManifest;
  manifestPath: string;
  request: ProductionAuthoringRunRequest;
  requestPath: string;
  wrote: boolean;
}

export interface QaWizardBlueprintExecutionResult {
  replayed: boolean;
  manifest: QaWizardBlueprintAuthoringManifest;
  manifestPath: string;
  receipt: ProductionAuthoringRunReceipt;
  receiptPath: string;
  claimPath: string;
  executionRecordPath: string;
}

export interface QaWizardBlueprintApprovalResult {
  manifest: QaWizardBlueprintAuthoringManifest;
  manifestPath: string;
  attestation: PreRenderBlueprintApprovalAttestation;
  approvalPath: string;
  wrote: boolean;
}

export interface QaWizardBlueprintExecutionDependencies {
  providerFactory?: () =>
    | ProductionAuthoringProvider
    | Promise<ProductionAuthoringProvider>;
  hooks?: {
    /** Test-only crash seam after the atomic process-restart claim and before provider access. */
    afterClaim?: () => void;
    /** Test-only crash seam after the atomic receipt and before terminal authority. */
    afterReceipt?: () => void;
    /**
     * Test-only crash seam in the true cross-lane exposure window: AFTER the
     * terminal ownership binding is durable but BEFORE the terminal manifest is
     * published. It proves ownership becomes durable before the manifest is
     * visible, so an abrupt crash here can never leave an unbound terminal for
     * the other execution identity to scan and adopt.
     */
    afterTerminalBinding?: () => void;
    /** Test-only crash seam after terminal manifest and before request-keyed lookup. */
    afterTerminalManifest?: () => void;
    /** Test-only crash seam after the candidate-keyed approval decision. */
    afterApprovalDecision?: () => void;
    /** Test-only race seam immediately before lifecycle containment is rechecked. */
    beforeLifecycleArtifactPublish?: (
      temporaryPath: string,
      destinationPath: string,
    ) => void;
    /** Test-only race seam immediately before receipt publication. */
    beforeReceiptArtifactPublish?: (
      temporaryPath: string,
      destinationPath: string,
    ) => void;
    /** Test-only race seam immediately before terminal-lookup publication. */
    beforeTerminalLookupPublish?: (
      temporaryPath: string,
      destinationPath: string,
    ) => void;
  };
}

const MANIFEST_KEYS = [
  'approval',
  'blueprint',
  'bridge',
  'context',
  'digest',
  'digestAlgorithm',
  'doesNotAuthorize',
  'predecessor',
  'receipt',
  'request',
  'stage',
  'version',
] as const;
// Exact key set for an `authoring_failed` manifest that additionally binds a
// sanitized failure observability capture. Every other manifest uses MANIFEST_KEYS.
const MANIFEST_KEYS_WITH_CAPTURE = [
  ...MANIFEST_KEYS,
  'observabilityCapture',
] as const;
const OBSERVABILITY_CAPTURE_KEYS = ['digest', 'path', 'version'] as const;
const PREDECESSOR_KEYS = ['digest', 'path', 'version'] as const;
const BRIDGE_KEYS = ['digest', 'path', 'version'] as const;
const CONTEXT_KEYS = ['digest', 'version'] as const;
const REQUEST_KEYS = [
  'digest',
  'mode',
  'path',
  'requestId',
  'requestedAt',
  'version',
] as const;
const RECEIPT_KEYS = ['digest', 'path', 'status', 'version'] as const;
const BLUEPRINT_KEYS = [
  'authoringAuthorityDigest',
  'blueprintDigest',
  'candidatePath',
  'contactSheetDigest',
  'contactSheetPath',
  'provenanceDigest',
  'provenancePath',
  'reviewMarkdownDigest',
  'reviewMarkdownPath',
  'reviewPacketDigest',
  'reviewPacketPath',
  'validationEvidenceDigest',
  'validationEvidencePath',
] as const;
const APPROVAL_KEYS = [
  'approvedAt',
  'approvedBy',
  'digest',
  'path',
  'version',
] as const;
const CLAIM_KEYS = [
  'authoringAuthorityDigest',
  'digest',
  'digestAlgorithm',
  'preflightManifestDigest',
  'preflightManifestPath',
  'requestDigest',
  'requestedAt',
  'scope',
  'version',
] as const;
const EXECUTION_RECORD_KEYS = [
  'authoringAuthorityDigest',
  'claimDigest',
  'claimPath',
  'digest',
  'digestAlgorithm',
  'receiptDigest',
  'receiptPath',
  'requestDigest',
  'status',
  'terminalManifestDigest',
  'terminalManifestPath',
  'version',
] as const;
const EXECUTION_INCIDENT_KEYS = [
  'authoringAuthorityDigest',
  'claimDigest',
  'claimPath',
  'digest',
  'digestAlgorithm',
  'phase',
  'preflightManifestDigest',
  'providerOutcome',
  'receiptAvailable',
  'receiptDigest',
  'receiptStatus',
  'requestDigest',
  'resolution',
  'scope',
  'version',
] as const;
const TERMINAL_BINDING_KEYS = [
  'authoringAuthorityDigest',
  'digest',
  'digestAlgorithm',
  'executionIdentityDigest',
  'preflightManifestDigest',
  'requestDigest',
  'scope',
  'terminalManifestDigest',
  'terminalManifestPath',
  'version',
] as const;
const REPLACEMENT_SLOT_KEYS = [
  'authoringAuthorityDigest',
  'digest',
  'digestAlgorithm',
  'predecessorClaimDigest',
  'predecessorClaimPath',
  'preflightManifestDigest',
  'requestDigest',
  'scope',
  'successorExecutionDigest',
  'version',
] as const;
const APPROVAL_DECISION_KEYS = [
  'approvalDigest',
  'approvalPath',
  'approvedAt',
  'approvedBy',
  'approvedManifestDigest',
  'approvedManifestPath',
  'authoringAuthorityDigest',
  'blueprintDigest',
  'candidateManifestDigest',
  'candidateManifestPath',
  'digest',
  'digestAlgorithm',
  'note',
  'reviewPacketDigest',
  'scope',
  'version',
] as const;
const RECEIPT_TOP_LEVEL_KEYS = [
  'attempts',
  'authoringProvenanceDigest',
  'blueprintDigest',
  'callBudget',
  'callCount',
  'contextDigest',
  'digest',
  'digestAlgorithm',
  'executionAttestation',
  'failure',
  'maxOutputTokens',
  'mode',
  'model',
  'noFallback',
  'reasoningEffort',
  'repairCount',
  'requestDigest',
  'requestId',
  'requestedAt',
  'status',
  'version',
] as const;
const ATTEMPT_KEYS = [
  'attempt',
  'completionStatus',
  'conservativeCallCostUsd',
  'cumulativeConservativeCostUsd',
  'executionAttestation',
  'failureCode',
  'failureEvidenceKind',
  'failureEvidenceReason',
  'inputAccounting',
  'kind',
  'model',
  'nominalEstimatedCostUsd',
  'provider',
  'providerEvidenceVersion',
  'reservedExposureBeforeCallUsd',
  'responseDigest',
  'responseId',
  'systemPromptDigest',
  'usage',
  'usageEvidenceComplete',
  'userPromptDigest',
  'validationDiagnostics',
] as const;
const SAFE_USAGE_KEYS = [
  'cacheWriteInputTokens',
  'cachedInputTokens',
  'inputTokens',
  'outputTokens',
  'reasoningTokens',
  'totalTokens',
] as const;
const ATTEMPT_FAILURE_CODES = [
  'provider_call_failed',
  'call_budget_exhausted',
  'provider_policy_mismatch',
  'provider_evidence_invalid',
  'completion_status_invalid',
  'usage_invalid',
  'input_token_ceiling_exceeded',
  'cost_ceiling_exceeded',
] as const satisfies readonly ProductionAuthoringAttemptFailureCode[];
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(
  value: unknown,
  expected: readonly string[],
): value is Record<string, unknown> {
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

function executionStateUncertain(
  cause?: unknown,
  incident?: {
    path: string;
    phase: QaWizardBlueprintExecutionIncidentPhase;
  },
): Error {
  const error = new Error('execution_state_uncertain');
  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
  }
  if (incident) {
    (
      error as Error & {
        incidentPath?: string;
        incidentPhase?: QaWizardBlueprintExecutionIncidentPhase;
      }
    ).incidentPath = incident.path;
    (
      error as Error & {
        incidentPath?: string;
        incidentPhase?: QaWizardBlueprintExecutionIncidentPhase;
      }
    ).incidentPhase = incident.phase;
  }
  return error;
}

function digestPayload<T extends object>(payload: T): T & {
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
} {
  return {
    ...payload,
    digestAlgorithm: DIGEST_ALGORITHM,
    digest: canonicalJsonDigest(payload),
  };
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

function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function manifestExclusions(
  stage: QaWizardBlueprintAuthoringStage,
): readonly string[] {
  return stage === 'blueprint_approved'
    ? AFTER_APPROVAL_EXCLUSIONS
    : BEFORE_APPROVAL_EXCLUSIONS;
}

function manifestPayload(
  value: Omit<
    QaWizardBlueprintAuthoringManifest,
    'digestAlgorithm' | 'digest'
  >,
): Omit<
  QaWizardBlueprintAuthoringManifest,
  'digestAlgorithm' | 'digest'
> {
  return value;
}

function buildManifest(
  value: Omit<
    QaWizardBlueprintAuthoringManifest,
    'digestAlgorithm' | 'digest'
  >,
): QaWizardBlueprintAuthoringManifest {
  return digestPayload(manifestPayload(value));
}

function outputDirFromManifestPath(manifestPath: string): string {
  const normalized = manifestPath.replace(/\\/g, '/');
  if (path.posix.basename(path.posix.dirname(normalized)) !== 'blueprint-authoring-manifests') {
    throw new Error('Blueprint authoring manifest path is outside its canonical category');
  }
  return path.posix.dirname(path.posix.dirname(normalized));
}

function relativeArtifactPath(args: {
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

function readUniqueContainedUtf8(args: {
  repoRoot: string;
  artifactPath: string;
  label: string;
}): { absolutePath: string; rawBytes: string } {
  const absolutePath = resolveRepoPath(args.repoRoot, args.artifactPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${args.label} is missing`);
  }
  const stat = fs.lstatSync(absolutePath);
  const repoRealPath = fs.realpathSync(path.resolve(args.repoRoot));
  const artifactRealPath = fs.realpathSync(absolutePath);
  assertContainedRealPath({ repoRealPath, candidateRealPath: artifactRealPath });
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    normalizedAbsolute(absolutePath) !== normalizedAbsolute(artifactRealPath)
  ) {
    throw new Error(`${args.label} must be one unique contained regular file`);
  }
  const rawBytes = fs.readFileSync(absolutePath, 'utf8');
  return { absolutePath, rawBytes };
}

function readJsonObject(args: {
  repoRoot: string;
  artifactPath: string;
  label: string;
}): { absolutePath: string; rawBytes: string; value: Record<string, unknown> } {
  const { absolutePath, rawBytes } = readUniqueContainedUtf8(args);
  let value: unknown;
  try {
    value = JSON.parse(rawBytes) as unknown;
  } catch {
    throw new Error(`${args.label} JSON is invalid`);
  }
  if (!record(value)) throw new Error(`${args.label} must be a JSON object`);
  return { absolutePath, rawBytes, value };
}

function assertCanonicalContentAddressedJson(args: {
  artifactPath: string;
  absolutePath: string;
  rawBytes: string;
  value: Record<string, unknown>;
  digest: string;
  category: string;
  label: string;
}): void {
  if (
    path.basename(args.absolutePath) !== `${args.digest}.json` ||
    path.basename(path.dirname(args.absolutePath)) !== args.category ||
    args.rawBytes !== canonicalContentAddressedJsonBytes(args.value)
  ) {
    throw new Error(`${args.label} path or bytes are not canonical`);
  }
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
    throw new Error('Blueprint authoring outputDir differs from the manifest authority root');
  }
  return requested;
}

function manifestShapeIsValid(
  value: unknown,
): value is QaWizardBlueprintAuthoringManifest {
  try {
    if (!record(value)) return false;
    // The observability-capture binding is an optional key allowed ONLY on a
    // failed terminal; every other manifest must match MANIFEST_KEYS exactly.
    const hasCaptureKey = Object.prototype.hasOwnProperty.call(
      value,
      'observabilityCapture',
    );
    if (
      hasCaptureKey
        ? !exactKeys(value, MANIFEST_KEYS_WITH_CAPTURE)
        : !exactKeys(value, MANIFEST_KEYS)
    ) {
      return false;
    }
    const manifest = value as unknown as QaWizardBlueprintAuthoringManifest;
    if (
    manifest.version !== QA_WIZARD_BLUEPRINT_AUTHORING_MANIFEST_VERSION ||
    ![
      'live_request_preflight_passed',
      'blueprint_candidate',
      'authoring_failed',
      'blueprint_approved',
    ].includes(manifest.stage) ||
    manifest.digestAlgorithm !== DIGEST_ALGORITHM ||
    typeof manifest.digest !== 'string' ||
    !HEX_SHA256.test(manifest.digest) ||
    manifest.digest !==
      canonicalJsonDigest(payloadWithoutDigest(value)) ||
    !sameStringArray(
      manifest.doesNotAuthorize,
      manifestExclusions(manifest.stage),
    ) ||
    !exactKeys(manifest.bridge, BRIDGE_KEYS) ||
    manifest.bridge.version !== QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION ||
    typeof manifest.bridge.digest !== 'string' ||
    !HEX_SHA256.test(manifest.bridge.digest) ||
    typeof manifest.bridge.path !== 'string' ||
    !exactKeys(manifest.context, CONTEXT_KEYS) ||
    typeof manifest.context.digest !== 'string' ||
    !HEX_SHA256.test(manifest.context.digest) ||
    !exactKeys(manifest.request, REQUEST_KEYS) ||
    manifest.request.version !== PRODUCTION_AUTHORING_RUN_REQUEST_VERSION ||
    manifest.request.mode !== 'live' ||
    typeof manifest.request.digest !== 'string' ||
    !HEX_SHA256.test(manifest.request.digest) ||
    typeof manifest.request.path !== 'string' ||
    typeof manifest.request.requestId !== 'string' ||
    !canonicalUtcTimestampIsValid(manifest.request.requestedAt)
    ) {
      return false;
    }
    const isPreflight = manifest.stage === 'live_request_preflight_passed';
  const isCandidate = manifest.stage === 'blueprint_candidate';
  const isFailure = manifest.stage === 'authoring_failed';
  const isApproved = manifest.stage === 'blueprint_approved';
  // The optional observability-capture binding is valid ONLY on a failed terminal,
  // and when present must be a well-formed capture authority. Any other stage
  // carrying it, or a malformed binding, is rejected.
  if (manifest.observabilityCapture !== undefined) {
    if (
      !isFailure ||
      !exactKeys(manifest.observabilityCapture, OBSERVABILITY_CAPTURE_KEYS) ||
      manifest.observabilityCapture.version !==
        BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION ||
      typeof manifest.observabilityCapture.digest !== 'string' ||
      !HEX_SHA256.test(manifest.observabilityCapture.digest) ||
      typeof manifest.observabilityCapture.path !== 'string'
    ) {
      return false;
    }
  }
  if (
    (isPreflight && manifest.predecessor !== null) ||
    (!isPreflight && !exactKeys(manifest.predecessor, PREDECESSOR_KEYS)) ||
    (manifest.predecessor !== null &&
      (manifest.predecessor.version !==
        QA_WIZARD_BLUEPRINT_AUTHORING_MANIFEST_VERSION ||
        typeof manifest.predecessor.digest !== 'string' ||
        !HEX_SHA256.test(manifest.predecessor.digest) ||
        typeof manifest.predecessor.path !== 'string'))
  ) {
    return false;
  }
  if (isPreflight) {
    return (
      manifest.receipt === null &&
      manifest.blueprint === null &&
      manifest.approval === null
    );
  }
  if (
    !exactKeys(manifest.receipt, RECEIPT_KEYS) ||
    manifest.receipt.version !== PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION ||
    typeof manifest.receipt.digest !== 'string' ||
    !HEX_SHA256.test(manifest.receipt.digest) ||
    typeof manifest.receipt.path !== 'string' ||
    manifest.receipt.status !== (isFailure ? 'failed' : 'completed')
  ) {
    return false;
  }
  if (isFailure) {
    return manifest.blueprint === null && manifest.approval === null;
  }
  if (
    !exactKeys(manifest.blueprint, BLUEPRINT_KEYS) ||
    Object.entries(manifest.blueprint).some(([key, entry]) =>
      key.endsWith('Path')
        ? typeof entry !== 'string'
        : typeof entry !== 'string' || !HEX_SHA256.test(entry),
    )
  ) {
    return false;
  }
  if (isCandidate) return manifest.approval === null;
  return (
    isApproved &&
    exactKeys(manifest.approval, APPROVAL_KEYS) &&
    manifest.approval.version === PRE_RENDER_BLUEPRINT_APPROVAL_VERSION &&
    typeof manifest.approval.digest === 'string' &&
    HEX_SHA256.test(manifest.approval.digest) &&
    typeof manifest.approval.path === 'string' &&
    manifest.approval.approvedBy === PRE_RENDER_BLUEPRINT_APPROVER &&
    canonicalUtcTimestampIsValid(manifest.approval.approvedAt)
    );
  } catch {
    return false;
  }
}

function requestAuthority(args: {
  request: ProductionAuthoringRunRequest;
  requestPath: string;
}): ManifestRequestAuthority {
  return {
    version: args.request.version,
    digest: canonicalJsonDigest(args.request),
    path: args.requestPath,
    requestId: args.request.requestId,
    requestedAt: args.request.requestedAt,
    mode: 'live',
  };
}

function bridgeAuthority(args: {
  bridge: QaWizardCandidateBridgeManifest;
  bridgeManifestPath: string;
}): ManifestBridgeAuthority {
  if (
    args.bridge.version !== QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION
  ) {
    throw new Error('legacy QA Wizard bridge cannot authorize Blueprint authoring');
  }
  return {
    version: args.bridge.version,
    digest: args.bridge.digest,
    path: args.bridgeManifestPath,
  };
}

function persistRequest(args: {
  repoRoot: string;
  outputDir: string;
  request: ProductionAuthoringRunRequest;
  write: boolean;
}): { path: string; created: boolean } {
  const digest = canonicalJsonDigest(args.request);
  const artifactPath = relativeArtifactPath({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'blueprint-authoring-requests',
    fileName: `${digest}.json`,
  });
  const created = args.write
    ? writeImmutableLocalArtifact({
        destinationPath: resolveRepoPath(args.repoRoot, artifactPath),
        bytes: canonicalContentAddressedJsonBytes(args.request),
        hooks: containedPublishHooks({ repoRoot: args.repoRoot }),
      }).created
    : false;
  return { path: artifactPath, created };
}

function persistManifest(args: {
  repoRoot: string;
  outputDir: string;
  manifest: QaWizardBlueprintAuthoringManifest;
  write: boolean;
}): { path: string; created: boolean } {
  if (!manifestShapeIsValid(args.manifest)) {
    throw new Error('Blueprint authoring manifest construction is invalid');
  }
  const artifactPath = relativeArtifactPath({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'blueprint-authoring-manifests',
    fileName: `${args.manifest.digest}.json`,
  });
  const created = args.write
    ? writeImmutableLocalArtifact({
        destinationPath: resolveRepoPath(args.repoRoot, artifactPath),
        bytes: canonicalContentAddressedJsonBytes(args.manifest),
        hooks: containedPublishHooks({ repoRoot: args.repoRoot }),
      }).created
    : false;
  return { path: artifactPath, created };
}

function loadProductionRequest(args: {
  repoRoot: string;
  outputDir: string;
  authority: ManifestRequestAuthority;
  context: ProductionAuthoringContext;
}): ProductionAuthoringRunRequest {
  const expectedPath = relativeArtifactPath({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'blueprint-authoring-requests',
    fileName: `${args.authority.digest}.json`,
  });
  if (args.authority.path !== expectedPath) {
    throw new Error('Blueprint authoring request path is noncanonical');
  }
  const loaded = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath: args.authority.path,
    label: 'Blueprint authoring request',
  });
  assertCanonicalContentAddressedJson({
    artifactPath: args.authority.path,
    ...loaded,
    digest: args.authority.digest,
    category: 'blueprint-authoring-requests',
    label: 'Blueprint authoring request',
  });
  const request = loaded.value as unknown as ProductionAuthoringRunRequest;
  const issues = productionBlueprintAuthoringPreflightIssues({
    request,
    context: args.context,
  });
  if (
    issues.length > 0 ||
    canonicalJsonDigest(request) !== args.authority.digest ||
    request.version !== args.authority.version ||
    request.mode !== 'live' ||
    request.requestId !== args.authority.requestId ||
    request.requestedAt !== args.authority.requestedAt
  ) {
    throw new Error(
      `Blueprint authoring request is stale or invalid${
        issues.length > 0 ? `: ${issues.join('; ')}` : ''
      }`,
    );
  }
  return request;
}

function finiteNonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function canonicalSafeUsage(
  value: unknown,
): Record<(typeof SAFE_USAGE_KEYS)[number], number> | null {
  if (!exactKeys(value, SAFE_USAGE_KEYS)) return null;
  if (
    !Object.values(value).every(
      (entry) => Number.isSafeInteger(entry) && Number(entry) >= 0,
    )
  ) {
    return null;
  }
  const usage = value as Record<(typeof SAFE_USAGE_KEYS)[number], number>;
  return blueprintAuthoringUsageIsInternallyConsistent(usage) ? usage : null;
}

function attemptReceiptIsValid(args: {
  attempt: unknown;
  index: number;
  priorCumulativeCostUsd: number;
}): { valid: boolean; cumulativeCostUsd: number } {
  if (!exactKeys(args.attempt, ATTEMPT_KEYS)) {
    return { valid: false, cumulativeCostUsd: args.priorCumulativeCostUsd };
  }
  const attempt = args.attempt as Record<string, unknown>;
  const usage = attempt.usage;
  const diagnostics = attempt.validationDiagnostics;
  const inputAccounting = attempt.inputAccounting;
  const expectedAttempt = args.index + 1;
  const expectedReservation = blueprintAuthoringReservedExposureUsd({
    conservativeAccountedCostUsd: args.priorCumulativeCostUsd,
    callsCompleted: args.index,
  });
  const completeUsage = canonicalSafeUsage(usage);
  const nominal = completeUsage
    ? nominalBlueprintAuthoringUsageCostUsd(completeUsage)
    : null;
  const conservative = completeUsage
    ? conservativeBlueprintAuthoringCostUsd({
        inputTokens: completeUsage.inputTokens,
        outputTokens: completeUsage.outputTokens,
      })
    : null;
  const nextCumulativeCostUsd =
    conservative === null
      ? args.priorCumulativeCostUsd
      : args.priorCumulativeCostUsd + conservative;
  const responseIdIsValid =
    typeof attempt.responseId === 'string' &&
    /^[A-Za-z0-9_-]{1,200}$/.test(attempt.responseId);
  const responseDigestIsValid =
    typeof attempt.responseDigest === 'string' &&
    HEX_SHA256.test(attempt.responseDigest);
  const providerEvidenceVersionIsCurrent =
    attempt.providerEvidenceVersion ===
    OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION;
  const canonicalResponseEnvelope =
    attempt.provider === 'openai' &&
    attempt.model === BLUEPRINT_AUTHORING_MODEL &&
    responseIdIsValid &&
    responseDigestIsValid &&
    providerEvidenceVersionIsCurrent;
  const fullAccounting =
    blueprintAuthoringInputAccountingIsCanonicalForSchema(
      inputAccounting,
      PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    ) &&
    blueprintAuthoringInputTokensAreAdmissible(inputAccounting) &&
    attempt.reservedExposureBeforeCallUsd === expectedReservation;
  const fullUsageCostEvidence =
    completeUsage !== null &&
    attempt.nominalEstimatedCostUsd === nominal &&
    attempt.conservativeCallCostUsd === conservative &&
    attempt.cumulativeConservativeCostUsd === nextCumulativeCostUsd;
  const canonicalCompletedEvidence =
    canonicalResponseEnvelope &&
    attempt.completionStatus === 'completed' &&
    attempt.usageEvidenceComplete === true &&
    fullAccounting &&
    fullUsageCostEvidence &&
    completeUsage.inputTokens <= BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS &&
    completeUsage.outputTokens <= BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS &&
    canonicalCompletedExecutionAttestationIsValid(
      attempt.executionAttestation,
    );
  const canonicalProviderResponseEvidence =
    canonicalResponseEnvelope &&
    canonicalCompletedExecutionAttestationIsValid(
      attempt.executionAttestation,
    );
  const noResponseEvidence =
    attempt.responseId === null &&
    attempt.responseDigest === null &&
    attempt.usage === null &&
    attempt.providerEvidenceVersion === null &&
    attempt.completionStatus === null &&
    attempt.usageEvidenceComplete === false &&
    attempt.nominalEstimatedCostUsd === null &&
    attempt.conservativeCallCostUsd === null;
  const preDispatchFailure =
    attempt.provider === 'openai' &&
    attempt.model === BLUEPRINT_AUTHORING_MODEL &&
    noResponseEvidence &&
    blueprintAuthoringInputAccountingIsCanonicalForSchema(
      inputAccounting,
      PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    ) &&
    attempt.reservedExposureBeforeCallUsd === expectedReservation &&
    attempt.cumulativeConservativeCostUsd === args.priorCumulativeCostUsd &&
    record(attempt.executionAttestation) &&
    attempt.executionAttestation.evidenceKind === 'not_run';
  const providerCallFailure =
    attempt.failureEvidenceKind === 'raw_provider_exception' &&
    attempt.provider === 'openai' &&
    attempt.model === BLUEPRINT_AUTHORING_MODEL &&
    noResponseEvidence &&
    attempt.inputAccounting === null &&
    attempt.reservedExposureBeforeCallUsd === null &&
    attempt.cumulativeConservativeCostUsd === null &&
    record(attempt.executionAttestation) &&
    attempt.executionAttestation.evidenceKind === 'injected_adapter_unattested' &&
    attempt.executionAttestation.logicalProviderCalls === 1;
  const exactInjectedAdapterAttestationIsValid =
    authoringExecutionAttestationIsValid(attempt.executionAttestation) &&
    attempt.executionAttestation.evidenceKind ===
      'injected_adapter_unattested' &&
    attempt.executionAttestation.logicalProviderCalls === 1;
  const canonicalAdapterObservedAttestationIsValid =
    authoringExecutionAttestationIsValid(attempt.executionAttestation) &&
    attempt.executionAttestation.evidenceKind ===
      'canonical_adapter_observed' &&
    attempt.executionAttestation.logicalProviderCalls === 1 &&
    attempt.executionAttestation.canonicalModelConfirmed === true &&
    ((attempt.executionAttestation.transportDispatchCount === 0 &&
      attempt.executionAttestation.canonicalRouteConfirmed === false) ||
      (attempt.executionAttestation.transportDispatchCount === 1 &&
        attempt.executionAttestation.canonicalRouteConfirmed === true)) &&
    attempt.executionAttestation.transportRetryCount === 0 &&
    attempt.executionAttestation.fallbackUsed === false;
  const canonicalAdapterFailureAttestationIsValid =
    (authoringExecutionAttestationIsValid(attempt.executionAttestation) &&
      attempt.executionAttestation.evidenceKind === 'not_run') ||
    canonicalAdapterObservedAttestationIsValid;
  const canonicalAdapterResponseBoundaryAttestationIsValid =
    canonicalAdapterObservedAttestationIsValid &&
    authoringExecutionAttestationIsValid(attempt.executionAttestation) &&
    attempt.executionAttestation.transportDispatchCount === 1;
  const invalidAdapterExecutionAttestationEvidenceIsValid =
    canonicalAdapterObservedAttestationIsValid &&
    !canonicalCompletedExecutionAttestationIsValid(
      attempt.executionAttestation,
    );
  const compilerResponseBoundaryEvidenceIsWriterShaped =
    attempt.failureEvidenceKind === 'compiler_response_boundary' &&
    responseDigestIsValid &&
    (canonicalCompletedExecutionAttestationIsValid(
      attempt.executionAttestation,
    ) || exactInjectedAdapterAttestationIsValid);
  const canonicalAdapterNoResponseFailure =
    attempt.failureEvidenceKind === 'provider_adapter_boundary' &&
    attempt.provider === 'openai' &&
    attempt.model === BLUEPRINT_AUTHORING_MODEL &&
    attempt.responseId === null &&
    attempt.responseDigest === null &&
    attempt.usage === null &&
    attempt.providerEvidenceVersion ===
      OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION &&
    attempt.completionStatus === null &&
    attempt.usageEvidenceComplete === false &&
    fullAccounting &&
    attempt.nominalEstimatedCostUsd === null &&
    attempt.conservativeCallCostUsd === null &&
    attempt.cumulativeConservativeCostUsd === args.priorCumulativeCostUsd &&
    canonicalAdapterFailureAttestationIsValid;
  const canonicalAdapterNoResponseWasNotRun =
    canonicalAdapterNoResponseFailure &&
    record(attempt.executionAttestation) &&
    attempt.executionAttestation.evidenceKind === 'not_run';
  const boundaryFailureEvidence =
    blueprintAuthoringInputAccountingIsCanonicalForSchema(
      inputAccounting,
      PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    ) &&
    blueprintAuthoringInputTokensAreAdmissible(inputAccounting) &&
    attempt.reservedExposureBeforeCallUsd === expectedReservation &&
    (attempt.failureEvidenceKind !== 'provider_adapter_boundary' ||
      attempt.failureEvidenceReason === 'boundary_reason_invalid' ||
      (attempt.failureEvidenceReason === 'execution_attestation_invalid'
        ? invalidAdapterExecutionAttestationEvidenceIsValid
        : canonicalAdapterResponseBoundaryAttestationIsValid)) &&
    (completeUsage === null
      ? attempt.usage === null &&
        attempt.nominalEstimatedCostUsd === null &&
        attempt.conservativeCallCostUsd === null &&
        (attempt.cumulativeConservativeCostUsd === null ||
          attempt.cumulativeConservativeCostUsd ===
            args.priorCumulativeCostUsd)
      : fullUsageCostEvidence);
  const failureCode = ATTEMPT_FAILURE_CODES.includes(
    attempt.failureCode as ProductionAuthoringAttemptFailureCode,
  )
    ? (attempt.failureCode as ProductionAuthoringAttemptFailureCode)
    : null;
  const responseBoundaryEvidenceIsWriterShaped =
    compilerResponseBoundaryEvidenceIsWriterShaped ||
    attempt.failureEvidenceKind === 'provider_adapter_boundary';
  const providerIdentityMismatchEvidenceIsValid =
    attempt.failureEvidenceKind === 'compiler_response_boundary'
      ? responseDigestIsValid &&
        (attempt.provider === 'unknown-provider' ||
          attempt.model === 'unknown-model')
      : attempt.failureEvidenceKind === 'provider_adapter_boundary'
        ? attempt.provider === 'openai' &&
          attempt.model === 'unknown-model' &&
          providerEvidenceVersionIsCurrent &&
          responseDigestIsValid
        : false;
  const failedEvidenceValid =
    failureCode === 'provider_call_failed'
      ? (providerCallFailure &&
          attempt.failureEvidenceReason === 'raw_provider_exception') ||
        (canonicalAdapterNoResponseFailure &&
          attempt.failureEvidenceReason === 'provider_call_failed')
      : failureCode === 'call_budget_exhausted'
        ? false
        : failureCode === 'input_token_ceiling_exceeded'
          ? attempt.failureEvidenceKind === 'compiler_pre_dispatch' &&
            attempt.failureEvidenceReason === 'input_ceiling_exceeded' &&
            preDispatchFailure &&
            blueprintAuthoringInputTokensExceedCeiling(inputAccounting)
          : failureCode === 'cost_ceiling_exceeded'
            ? (attempt.failureEvidenceKind === 'compiler_pre_dispatch' &&
                attempt.failureEvidenceReason ===
                  'spend_reservation_exceeded' &&
                preDispatchFailure &&
                blueprintAuthoringInputTokensAreAdmissible(
                  inputAccounting,
                ) &&
                !blueprintAuthoringSpendIsWithinCeiling(
                  expectedReservation,
                )) ||
              (responseBoundaryEvidenceIsWriterShaped &&
                attempt.failureEvidenceReason === 'cost_ceiling_exceeded' &&
                canonicalCompletedEvidence &&
                !blueprintAuthoringSpendIsWithinCeiling(nextCumulativeCostUsd))
            : failureCode === 'provider_policy_mismatch'
              ? (canonicalAdapterNoResponseWasNotRun &&
                  attempt.failureEvidenceReason ===
                    'adapter_policy_mismatch') ||
                (responseBoundaryEvidenceIsWriterShaped &&
                  attempt.failureEvidenceReason ===
                    'provider_identity_mismatch' &&
                  boundaryFailureEvidence &&
                  providerIdentityMismatchEvidenceIsValid)
              : failureCode === 'completion_status_invalid'
                ? responseBoundaryEvidenceIsWriterShaped &&
                  attempt.failureEvidenceReason ===
                    'completion_status_invalid' &&
                  boundaryFailureEvidence &&
                  canonicalProviderResponseEvidence &&
                  attempt.completionStatus === null
                : failureCode === 'usage_invalid'
                  ? responseBoundaryEvidenceIsWriterShaped &&
                    attempt.failureEvidenceReason === 'usage_invalid' &&
                    boundaryFailureEvidence &&
                    canonicalProviderResponseEvidence &&
                    attempt.completionStatus === 'completed' &&
                    (attempt.usageEvidenceComplete !== true ||
                      completeUsage === null ||
                      completeUsage.inputTokens >
                        BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS ||
                      completeUsage.outputTokens >
                        BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS)
                  : failureCode === 'provider_evidence_invalid'
                    ? responseBoundaryEvidenceIsWriterShaped &&
                      boundaryFailureEvidence &&
                      ((attempt.failureEvidenceReason ===
                        'response_output_empty' &&
                        canonicalResponseEnvelope) ||
                        (attempt.failureEvidenceReason ===
                          'cost_evidence_mismatch' &&
                          attempt.failureEvidenceKind ===
                            'compiler_response_boundary' &&
                          canonicalCompletedEvidence) ||
                        (attempt.failureEvidenceReason ===
                          'provider_evidence_version_invalid' &&
                          attempt.failureEvidenceKind ===
                            'compiler_response_boundary' &&
                          attempt.provider === 'openai' &&
                          attempt.model === BLUEPRINT_AUTHORING_MODEL &&
                          responseDigestIsValid &&
                          attempt.providerEvidenceVersion === null) ||
                        (attempt.failureEvidenceReason ===
                          'response_id_invalid' &&
                          attempt.provider === 'openai' &&
                          attempt.model === BLUEPRINT_AUTHORING_MODEL &&
                          providerEvidenceVersionIsCurrent &&
                          responseDigestIsValid &&
                          attempt.responseId === null) ||
                        (attempt.failureEvidenceReason ===
                          'execution_attestation_invalid' &&
                          canonicalResponseEnvelope &&
                          ((attempt.failureEvidenceKind ===
                            'compiler_response_boundary' &&
                            exactInjectedAdapterAttestationIsValid) ||
                            (attempt.failureEvidenceKind ===
                              'provider_adapter_boundary' &&
                              invalidAdapterExecutionAttestationEvidenceIsValid))) ||
                        (attempt.failureEvidenceReason ===
                          'boundary_reason_invalid' &&
                          attempt.failureEvidenceKind ===
                            'provider_adapter_boundary'))
                    : false;
  return {
    valid:
      expectedAttempt === attempt.attempt &&
      attempt.kind === (args.index === 0 ? 'initial' : 'repair') &&
      (attempt.provider === 'openai' ||
        attempt.provider === 'unknown-provider') &&
      (attempt.model === BLUEPRINT_AUTHORING_MODEL ||
        attempt.model === 'unknown-model') &&
      (attempt.responseId === null ||
        (typeof attempt.responseId === 'string' &&
          /^[A-Za-z0-9_-]{1,200}$/.test(attempt.responseId))) &&
      typeof attempt.systemPromptDigest === 'string' &&
      HEX_SHA256.test(attempt.systemPromptDigest) &&
      typeof attempt.userPromptDigest === 'string' &&
      HEX_SHA256.test(attempt.userPromptDigest) &&
      (attempt.responseDigest === null ||
        (typeof attempt.responseDigest === 'string' &&
          HEX_SHA256.test(attempt.responseDigest))) &&
      (attempt.providerEvidenceVersion === null ||
        attempt.providerEvidenceVersion ===
          OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION) &&
      (attempt.completionStatus === null ||
        attempt.completionStatus === 'completed') &&
      authoringExecutionAttestationIsValid(attempt.executionAttestation) &&
      authoringValidationDiagnosticsAreValid(diagnostics) &&
      (attempt.failureCode === null
        ? attempt.failureEvidenceKind === null &&
          attempt.failureEvidenceReason === null &&
          canonicalCompletedEvidence
        : failedEvidenceValid),
    cumulativeCostUsd:
      attempt.failureCode === null
        ? nextCumulativeCostUsd
        : args.priorCumulativeCostUsd,
  };
}

export function productionBlueprintAuthoringReceiptReplayIsValid(args: {
  receipt: Record<string, unknown>;
  request: ProductionAuthoringRunRequest;
  expectedStatus: 'completed' | 'failed';
  expectedDigest: string;
}): args is {
  receipt: ProductionAuthoringRunReceipt & Record<string, unknown>;
  request: ProductionAuthoringRunRequest;
  expectedStatus: 'completed' | 'failed';
  expectedDigest: string;
} {
  try {
    const receipt = args.receipt as unknown as ProductionAuthoringRunReceipt;
  const attempts = receipt.attempts;
  let cumulativeCostUsd = 0;
  let attemptsValid = Array.isArray(attempts);
  if (attemptsValid) {
    for (const [index, attempt] of attempts.entries()) {
      const result = attemptReceiptIsValid({
        attempt,
        index,
        priorCumulativeCostUsd: cumulativeCostUsd,
      });
      attemptsValid &&= result.valid;
      cumulativeCostUsd = result.cumulativeCostUsd;
    }
  }
  const replayAttempts = attemptsValid
    ? (attempts as ProductionAuthoringRunReceipt['attempts'])
    : [];
  const aggregateAttestation = attemptsValid
    ? aggregateProductionAuthoringExecutionAttestations(
        replayAttempts.map((attempt) => attempt.executionAttestation),
      )
    : null;
  const firstFailedAttemptIndex = attemptsValid
    ? replayAttempts.findIndex((attempt) => attempt.failureCode !== null)
    : -1;
  const failureAttemptOrderingIsValid =
    firstFailedAttemptIndex === -1 ||
    (firstFailedAttemptIndex === replayAttempts.length - 1 &&
      replayAttempts.filter((attempt) => attempt.failureCode !== null).length ===
        1);
  const finalAttempt = attemptsValid
    ? replayAttempts.length > 0
      ? replayAttempts[replayAttempts.length - 1]!
      : null
    : null;
  const terminalCodeForFinalAttempt =
    finalAttempt?.failureCode === 'provider_call_failed'
      ? 'provider_call_failed'
      : finalAttempt?.failureCode === 'provider_policy_mismatch'
        ? 'provider_policy_mismatch'
        : finalAttempt?.failureCode === 'provider_evidence_invalid'
          ? 'provider_evidence_invalid'
          : finalAttempt?.failureCode === 'completion_status_invalid'
            ? 'completion_status_invalid'
            : finalAttempt?.failureCode === 'usage_invalid'
              ? 'usage_invalid'
              : finalAttempt?.failureCode === 'input_token_ceiling_exceeded'
                ? 'input_token_ceiling_exceeded'
                : finalAttempt?.failureCode === 'cost_ceiling_exceeded'
                  ? 'cost_ceiling_exceeded'
                  : null;
  const attemptBoundTerminalCodes = [
    'provider_call_failed',
    'provider_policy_mismatch',
    'provider_evidence_invalid',
    'completion_status_invalid',
    'usage_invalid',
    'input_token_ceiling_exceeded',
    'cost_ceiling_exceeded',
  ] as const;
  const budgetStoppedAttemptShapeIsValid =
    replayAttempts.length === BLUEPRINT_AUTHORING_MAX_CALLS &&
    receipt.repairCount === BLUEPRINT_AUTHORING_MAX_REPAIRS &&
    replayAttempts.every(
      (attempt) =>
        attempt.failureCode === null &&
        attempt.failureEvidenceKind === null &&
        attempt.failureEvidenceReason === null,
    );
  const repairExhaustionEvidenceIsValid =
    receipt.failure?.code === 'call_budget_exhausted' ||
    receipt.failure?.code === 'draft_validation_repair_exhausted'
      ? budgetStoppedAttemptShapeIsValid &&
          replayAttempts.every(
            (attempt) =>
              attempt.validationDiagnostics.count > 0 &&
              attempt.validationDiagnostics.codes.length > 0,
          )
      : true;
  const attemptDiagnosticSequenceIsValid = replayAttempts.every(
    (attempt, index) => {
      const finalAttempt = index === replayAttempts.length - 1;
      if (!finalAttempt && attempt.failureCode === null) {
        return (
          attempt.validationDiagnostics.count > 0 &&
          attempt.validationDiagnostics.codes.length > 0
        );
      }
      if (receipt.status === 'completed' && finalAttempt) {
        return (
          attempt.failureCode === null &&
          attempt.validationDiagnostics.count === 0 &&
          attempt.validationDiagnostics.codes.length === 0
        );
      }
      return true;
    },
  );
  const zeroAttemptContextFailureIsValid =
    receipt.failure?.code !== 'context_invalid' ||
    (replayAttempts.length === 0 &&
      receipt.callCount === 0 &&
      receipt.repairCount === 0 &&
      receipt.executionAttestation.evidenceKind === 'not_run');
    return (
    exactKeys(args.receipt, RECEIPT_TOP_LEVEL_KEYS) &&
    receipt.version === PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION &&
    receipt.digestAlgorithm === DIGEST_ALGORITHM &&
    receipt.digest === args.expectedDigest &&
    receipt.digest === canonicalJsonDigest(payloadWithoutDigest(args.receipt)) &&
    receipt.requestDigest === canonicalJsonDigest(args.request) &&
    receipt.requestId === args.request.requestId &&
    receipt.requestedAt === args.request.requestedAt &&
    receipt.mode === 'live' &&
    receipt.contextDigest === args.request.contextDigest &&
    receipt.model === args.request.model &&
    receipt.reasoningEffort === args.request.reasoningEffort &&
    receipt.maxOutputTokens === args.request.maxOutputTokens &&
    receipt.noFallback === true &&
    canonicalJsonDigest(receipt.callBudget) ===
      canonicalJsonDigest(args.request.callBudget) &&
    receipt.status === args.expectedStatus &&
    attemptsValid &&
    failureAttemptOrderingIsValid &&
    replayAttempts.length <= BLUEPRINT_AUTHORING_MAX_CALLS &&
    receipt.callCount === replayAttempts.length &&
    receipt.repairCount === Math.max(0, replayAttempts.length - 1) &&
    receipt.repairCount <= BLUEPRINT_AUTHORING_MAX_REPAIRS &&
    authoringExecutionAttestationIsValid(receipt.executionAttestation) &&
    aggregateAttestation !== null &&
    canonicalJsonDigest(receipt.executionAttestation) ===
      canonicalJsonDigest(aggregateAttestation) &&
    authoringBudgetExhaustionBindingIsValid({
      failure: receipt.failure,
      logicalProviderCalls: receipt.executionAttestation.logicalProviderCalls,
      repairCount: receipt.repairCount,
      expectedLogicalProviderCalls: BLUEPRINT_AUTHORING_MAX_CALLS,
      expectedRepairCount: BLUEPRINT_AUTHORING_MAX_REPAIRS,
    }) &&
    repairExhaustionEvidenceIsValid &&
    attemptDiagnosticSequenceIsValid &&
    zeroAttemptContextFailureIsValid &&
    (receipt.status === 'completed'
      ? receipt.failure === null &&
        replayAttempts.length >= 1 &&
        replayAttempts.every((attempt) => attempt.failureCode === null) &&
        finalAttempt !== null &&
        finalAttempt.validationDiagnostics.count === 0 &&
        finalAttempt.validationDiagnostics.codes.length === 0 &&
        typeof receipt.blueprintDigest === 'string' &&
        HEX_SHA256.test(receipt.blueprintDigest) &&
        typeof receipt.authoringProvenanceDigest === 'string' &&
        HEX_SHA256.test(receipt.authoringProvenanceDigest)
      : authoringTerminalFailureIsValid(receipt.failure) &&
        PRODUCTION_BLUEPRINT_RUNNER_TERMINAL_FAILURE_CODES.includes(
          receipt.failure.code as (typeof PRODUCTION_BLUEPRINT_RUNNER_TERMINAL_FAILURE_CODES)[number],
        ) &&
        (terminalCodeForFinalAttempt === null
          ? !attemptBoundTerminalCodes.includes(
              receipt.failure.code as (typeof attemptBoundTerminalCodes)[number],
            )
          : receipt.failure.code === terminalCodeForFinalAttempt) &&
        receipt.blueprintDigest === null &&
        receipt.authoringProvenanceDigest === null)
    );
  } catch {
    return false;
  }
}

function loadProductionReceipt(args: {
  repoRoot: string;
  outputDir: string;
  authority: ManifestReceiptAuthority;
  request: ProductionAuthoringRunRequest;
}): ProductionAuthoringRunReceipt {
  const expectedPath = relativeArtifactPath({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    category: 'authoring-receipts',
    fileName: `${args.authority.digest}.json`,
  });
  if (args.authority.path !== expectedPath) {
    throw new Error('Blueprint authoring receipt path is noncanonical');
  }
  let loaded: ReturnType<typeof readJsonObject>;
  let canonicalReceiptBytes: string;
  try {
    loaded = readJsonObject({
      repoRoot: args.repoRoot,
      artifactPath: args.authority.path,
      label: 'Blueprint authoring receipt',
    });
    canonicalReceiptBytes = productionAuthoringReceiptBytes(
      loaded.value as unknown as ProductionAuthoringRunReceipt,
    );
  } catch {
    throw new Error('Blueprint authoring receipt is stale or invalid');
  }
  if (
    path.basename(loaded.absolutePath) !== `${args.authority.digest}.json` ||
    path.basename(path.dirname(loaded.absolutePath)) !== 'authoring-receipts' ||
    loaded.rawBytes !== canonicalReceiptBytes ||
    !productionBlueprintAuthoringReceiptReplayIsValid({
      receipt: loaded.value,
      request: args.request,
      expectedStatus: args.authority.status,
      expectedDigest: args.authority.digest,
    })
  ) {
    throw new Error('Blueprint authoring receipt is stale or invalid');
  }
  return loaded.value as unknown as ProductionAuthoringRunReceipt;
}

function safeRepairAttemptsFromReceipt(
  receipt: ProductionAuthoringRunReceipt,
): PreRenderBlueprintAuthoringAttempt[] {
  return receipt.attempts.slice(0, receipt.repairCount).map((attempt, index) => ({
    attempt: index + 1,
    errors:
      attempt.validationDiagnostics.codes.length > 0
        ? [...attempt.validationDiagnostics.codes]
        : ['draft_contract_validation_failed'],
    draft: null,
  }));
}

function expectedAuthoringProvenance(args: {
  blueprint: PreRenderBookVisualBlueprint;
  receipt: ProductionAuthoringRunReceipt;
}): PreRenderBlueprintAuthoringProvenance {
  const firstAttempt = args.receipt.attempts[0];
  if (!firstAttempt || args.receipt.status !== 'completed') {
    throw new Error('completed Blueprint evidence lacks its passing attempt');
  }
  return {
    version: PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION,
    blueprintDigest: args.blueprint.digest,
    authoringAuthorityDigest:
      args.blueprint.identity.authoringAuthority.digest,
    model: args.receipt.model,
    reasoningEffort: args.receipt.reasoningEffort,
    maxOutputTokens: args.receipt.maxOutputTokens,
    noFallback: true,
    draftSchemaVersion: PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION,
    promptVersion: PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION,
    ...(args.receipt.callCount > 1
      ? { repairPromptVersion: PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION }
      : {}),
    passingAttempt: args.receipt.callCount,
    callCount: args.receipt.callCount,
    systemPromptDigest: firstAttempt.systemPromptDigest,
    userPromptDigest: firstAttempt.userPromptDigest,
  };
}

function readBlueprintArtifacts(args: {
  repoRoot: string;
  outputDir: string;
  context: ProductionAuthoringContext;
  authority: ManifestBlueprintAuthority;
  receipt: ProductionAuthoringRunReceipt;
}): {
  blueprint: PreRenderBookVisualBlueprint;
  reviewPacket: PreRenderBlueprintReviewPacket;
} {
  const authorityRoot = path.posix.join(
    args.outputDir.replace(/\\/g, '/'),
    'blueprint-lifecycle',
    'authorities',
    args.authority.authoringAuthorityDigest,
  );
  const expectedPaths = {
    candidatePath: path.posix.join(
      authorityRoot,
      'candidates',
      args.authority.blueprintDigest,
      'blueprint.json',
    ),
    provenancePath: path.posix.join(
      authorityRoot,
      'provenance',
      `${args.authority.provenanceDigest}.json`,
    ),
    validationEvidencePath: path.posix.join(
      authorityRoot,
      'validation',
      `${args.authority.validationEvidenceDigest}.json`,
    ),
    reviewPacketPath: path.posix.join(
      authorityRoot,
      'reviews',
      args.authority.reviewPacketDigest,
      'review.json',
    ),
    reviewMarkdownPath: path.posix.join(
      authorityRoot,
      'reviews',
      args.authority.reviewPacketDigest,
      `review.${args.authority.reviewMarkdownDigest}.md`,
    ),
    contactSheetPath: path.posix.join(
      authorityRoot,
      'reviews',
      args.authority.reviewPacketDigest,
      `contact-sheet.${args.authority.contactSheetDigest}.html`,
    ),
  };
  if (
    Object.entries(expectedPaths).some(
      ([key, expected]) =>
        args.authority[key as keyof typeof expectedPaths] !== expected,
    )
  ) {
    throw new Error('Blueprint lifecycle artifact paths are noncanonical');
  }
  const candidate = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath: args.authority.candidatePath,
    label: 'Blueprint candidate',
  });
  const blueprint = candidate.value as unknown as PreRenderBookVisualBlueprint;
  assertValidPreRenderBookVisualBlueprint(
    blueprint,
    args.context.validationContext,
  );
  if (
    candidate.rawBytes !== serializePreRenderBookVisualBlueprint(blueprint) ||
    blueprint.digest !== args.authority.blueprintDigest ||
    blueprint.identity.authoringAuthority.digest !==
      args.authority.authoringAuthorityDigest ||
    args.receipt.blueprintDigest !== blueprint.digest
  ) {
    throw new Error('Blueprint candidate is stale or substituted');
  }

  const provenance = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath: args.authority.provenancePath,
    label: 'Blueprint provenance',
  });
  const validation = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath: args.authority.validationEvidencePath,
    label: 'Blueprint validation evidence',
  });
  const review = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath: args.authority.reviewPacketPath,
    label: 'Blueprint review packet',
  });
  const reviewPacket = review.value as unknown as PreRenderBlueprintReviewPacket;
  const safeRepairAttempts = safeRepairAttemptsFromReceipt(args.receipt);
  const expectedProvenance = expectedAuthoringProvenance({
    blueprint,
    receipt: args.receipt,
  });
  const expectedValidation = createPreRenderBlueprintValidationEvidence({
    blueprint,
    context: args.context.validationContext,
  });
  const expectedReview = buildPreRenderBlueprintReviewBundle({
    blueprint,
    context: args.context.validationContext,
    provenance: expectedProvenance,
    repairAttempts: safeRepairAttempts,
  });
  if (
    provenance.rawBytes !==
      preRenderBlueprintLifecycleJsonBytes(expectedProvenance) ||
    canonicalJsonDigest(expectedProvenance) !==
      args.authority.provenanceDigest ||
    args.receipt.authoringProvenanceDigest !== args.authority.provenanceDigest ||
    validation.rawBytes !==
      preRenderBlueprintLifecycleJsonBytes(expectedValidation) ||
    expectedValidation.digest !== args.authority.validationEvidenceDigest ||
    expectedValidation.valid !== true ||
    review.rawBytes !==
      preRenderBlueprintLifecycleJsonBytes(expectedReview.packet) ||
    computePreRenderBlueprintReviewPacketDigest(reviewPacket) !==
      args.authority.reviewPacketDigest ||
    reviewPacket.digest !== args.authority.reviewPacketDigest ||
    reviewPacket.blueprintDigest !== blueprint.digest ||
    reviewPacket.authoringAuthorityDigest !==
      blueprint.identity.authoringAuthority.digest ||
    reviewPacket.validationEvidenceDigest !==
      args.authority.validationEvidenceDigest ||
    reviewPacket.authoringProvenance.digest !==
      args.authority.provenanceDigest ||
    reviewPacket.readyForApproval !== true ||
    reviewPacket.blockers.length !== 0
  ) {
    throw new Error('Blueprint lifecycle evidence is stale or invalid');
  }
  for (const [label, artifactPath, digest] of [
    [
      'Blueprint review markdown',
      args.authority.reviewMarkdownPath,
      args.authority.reviewMarkdownDigest,
    ],
    [
      'Blueprint contact sheet',
      args.authority.contactSheetPath,
      args.authority.contactSheetDigest,
    ],
  ] as const) {
    const loaded = readUniqueContainedUtf8({
      repoRoot: args.repoRoot,
      artifactPath,
      label,
    });
    const expectedBytes = label === 'Blueprint review markdown'
      ? expectedReview.markdown
      : expectedReview.contactSheetHtml;
    if (
      loaded.rawBytes !== expectedBytes ||
      canonicalJsonDigest(loaded.rawBytes) !== digest
    ) {
      throw new Error(`${label} is stale or invalid`);
    }
  }
  return { blueprint, reviewPacket };
}

function predecessorAuthority(args: {
  manifest: QaWizardBlueprintAuthoringManifest;
  manifestPath: string;
}): ManifestPredecessor {
  return {
    version: args.manifest.version,
    digest: args.manifest.digest,
    path: args.manifestPath,
  };
}

export function prepareQaWizardBlueprintLiveRequest(args: {
  repoRoot: string;
  bridgeManifestPath: string;
  outputDir: string;
  requestId: string;
  requestedAt: string;
  write?: boolean;
}): PreparedQaWizardBlueprintLiveRequest {
  if (!canonicalUtcTimestampIsValid(args.requestedAt)) {
    throw new Error('requestedAt must be canonical UTC with millisecond precision');
  }
  const { manifest: bridge, context } =
    loadQaWizardApprovedProductionContext({
      repoRoot: args.repoRoot,
      bridgeManifestPath: args.bridgeManifestPath,
    });
  const request = buildProductionAuthoringRunRequest({
    context,
    mode: 'live',
    requestId: args.requestId,
    requestedAt: args.requestedAt,
  });
  const issues = productionBlueprintAuthoringPreflightIssues({
    request,
    context,
  });
  if (issues.length > 0) {
    throw new Error(`Blueprint live request preflight failed: ${issues.join('; ')}`);
  }
  if (args.write === true) {
    prepareBlueprintOperatorOutputRoot({
      repoRoot: args.repoRoot,
      outputDir: args.outputDir,
    });
  }
  const requestArtifact = persistRequest({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    request,
    write: args.write === true,
  });
  const manifest = buildManifest({
    version: QA_WIZARD_BLUEPRINT_AUTHORING_MANIFEST_VERSION,
    stage: 'live_request_preflight_passed',
    predecessor: null,
    bridge: bridgeAuthority({
      bridge,
      bridgeManifestPath: args.bridgeManifestPath,
    }),
    context: { version: context.version, digest: context.digest },
    request: requestAuthority({
      request,
      requestPath: requestArtifact.path,
    }),
    receipt: null,
    blueprint: null,
    approval: null,
    doesNotAuthorize: [...BEFORE_APPROVAL_EXCLUSIONS],
  });
  const manifestArtifact = persistManifest({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    manifest,
    write: args.write === true,
  });
  return {
    manifest,
    manifestPath: manifestArtifact.path,
    request,
    requestPath: requestArtifact.path,
    wrote: args.write === true,
  };
}

const OPERATOR_OUTPUT_CATEGORIES = [
  'authoring-receipts',
  'blueprint-authoring-manifests',
  'blueprint-authoring-requests',
  'blueprint-lifecycle',
] as const;

const COMPILER_LEDGER_CATEGORIES = [
  'approval-decisions',
  'execution-claims',
  'execution-incidents',
  'replacement-authorization-slots',
  'terminal-bindings',
  'terminal-lookups',
] as const;

let writableProbeCounter = 0;

function normalizedAbsolute(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function assertContainedRealPath(args: {
  repoRealPath: string;
  candidateRealPath: string;
}): void {
  const relative = path.relative(args.repoRealPath, args.candidateRealPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Blueprint authoring output resolves outside the repository');
  }
}

function writableProbe(directory: string): void {
  writableProbeCounter += 1;
  const probe = path.join(
    directory,
    `.blueprint-authoring-write-probe-${process.pid}-${writableProbeCounter}`,
  );
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(probe, 'wx');
    fs.writeFileSync(descriptor, 'probe', 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
  } catch {
    throw new Error('Blueprint authoring output is not writable');
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (fs.existsSync(probe)) fs.unlinkSync(probe);
  }
}

function ensureContainedDirectory(args: {
  repoRoot: string;
  directoryPath: string;
  writable?: boolean;
}): string {
  const suppliedRepoRoot = path.resolve(args.repoRoot);
  const repoRealPath = fs.realpathSync(suppliedRepoRoot);
  if (normalizedAbsolute(suppliedRepoRoot) !== normalizedAbsolute(repoRealPath)) {
    throw new Error('Blueprint authoring repository uses a symlink or junction alias');
  }
  const target = path.resolve(args.directoryPath);
  const relative = path.relative(repoRealPath, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Blueprint authoring output resolves outside the repository');
  }
  let current = repoRealPath;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) {
      try {
        fs.mkdirSync(current);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    }
    const stat = fs.lstatSync(current);
    const real = fs.realpathSync(current);
    assertContainedRealPath({ repoRealPath, candidateRealPath: real });
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      normalizedAbsolute(current) !== normalizedAbsolute(real)
    ) {
      throw new Error('Blueprint authoring output uses a symlink or junction alias');
    }
  }
  if (args.writable === true) writableProbe(target);
  return target;
}

function containedPublishHooks(args: {
  repoRoot: string;
  beforeCheck?: (temporaryPath: string, destinationPath: string) => void;
}): ImmutableWriteHooks {
  const validateExistingArtifact = (destinationPath: string): void => {
    const repoRealPath = fs.realpathSync(path.resolve(args.repoRoot));
    const destination = path.resolve(destinationPath);
    const destinationStat = fs.lstatSync(destination);
    const destinationRealPath = fs.realpathSync(destination);
    assertContainedRealPath({
      repoRealPath,
      candidateRealPath: destinationRealPath,
    });
    if (
      !destinationStat.isFile() ||
      destinationStat.isSymbolicLink() ||
      destinationStat.nlink !== 1 ||
      normalizedAbsolute(destination) !==
        normalizedAbsolute(destinationRealPath)
    ) {
      throw new Error(
        'Blueprint authoring existing artifact is not a unique contained regular file',
      );
    }
  };
  return {
    // Operator artifacts may publish into deeply nested authority directories
    // that another process can rename. Keeping the private temp at the stable
    // repository root lets `finally` remove it even if a destination parent is
    // swapped before the atomic link.
    temporaryDirectoryPath: path.resolve(args.repoRoot),
    flushPublishedArtifact: true,
    beforeExistingArtifactRead: validateExistingArtifact,
    beforePublish(temporaryPath, destinationPath) {
      args.beforeCheck?.(temporaryPath, destinationPath);
      const repoRealPath = fs.realpathSync(path.resolve(args.repoRoot));
      const parent = path.dirname(path.resolve(destinationPath));
      const parentRealPath = fs.realpathSync(parent);
      const temporaryStat = fs.lstatSync(temporaryPath);
      const temporaryRealPath = fs.realpathSync(temporaryPath);
      assertContainedRealPath({
        repoRealPath,
        candidateRealPath: parentRealPath,
      });
      assertContainedRealPath({
        repoRealPath,
        candidateRealPath: temporaryRealPath,
      });
      if (
        normalizedAbsolute(parent) !== normalizedAbsolute(parentRealPath) ||
        !temporaryStat.isFile() ||
        temporaryStat.isSymbolicLink() ||
        temporaryStat.nlink !== 1 ||
        normalizedAbsolute(temporaryPath) !==
          normalizedAbsolute(temporaryRealPath)
      ) {
        throw new Error(
          'Blueprint authoring publish path uses a symlink or junction alias',
        );
      }
    },
  };
}

function prepareBlueprintOperatorOutputRoot(args: {
  repoRoot: string;
  outputDir: string;
}): string {
  const outputRoot = ensureContainedDirectory({
    repoRoot: args.repoRoot,
    directoryPath: resolveRepoPath(args.repoRoot, args.outputDir),
  });
  for (const category of OPERATOR_OUTPUT_CATEGORIES) {
    ensureContainedDirectory({
      repoRoot: args.repoRoot,
      directoryPath: path.join(outputRoot, category),
      writable: true,
    });
  }
  return outputRoot;
}

function prepareCompilerOwnedLedger(args: { repoRoot: string }): string {
  const root = ensureContainedDirectory({
    repoRoot: args.repoRoot,
    directoryPath: resolveRepoPath(
      args.repoRoot,
      QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
    ),
  });
  for (const category of COMPILER_LEDGER_CATEGORIES) {
    ensureContainedDirectory({
      repoRoot: args.repoRoot,
      directoryPath: path.join(root, category),
      writable: true,
    });
  }
  return root;
}

function prepareBlueprintLifecycleAuthorityDirectories(args: {
  repoRoot: string;
  outputDir: string;
  authoringAuthorityDigest: string;
  blueprintDigest?: string;
  reviewPacketDigest?: string;
}): string {
  const lifecycleRoot = path.join(
    resolveRepoPath(args.repoRoot, args.outputDir),
    'blueprint-lifecycle',
  );
  const authorityRoot = path.join(
    lifecycleRoot,
    'authorities',
    args.authoringAuthorityDigest,
  );
  for (const directory of [
    authorityRoot,
    path.join(authorityRoot, 'approvals'),
    path.join(authorityRoot, 'candidates'),
    path.join(authorityRoot, 'provenance'),
    path.join(authorityRoot, 'reviews'),
    path.join(authorityRoot, 'validation'),
    ...(args.blueprintDigest
      ? [
          path.join(authorityRoot, 'candidates', args.blueprintDigest),
          path.join(authorityRoot, 'approvals', args.blueprintDigest),
        ]
      : []),
    ...(args.reviewPacketDigest
      ? [path.join(authorityRoot, 'reviews', args.reviewPacketDigest)]
      : []),
  ]) {
    ensureContainedDirectory({
      repoRoot: args.repoRoot,
      directoryPath: directory,
      writable: true,
    });
  }
  return lifecycleRoot;
}

interface LoadedQaWizardBlueprintManifest {
  manifest: QaWizardBlueprintAuthoringManifest;
  manifestPath: string;
  outputDir: string;
  bridge: QaWizardCandidateBridgeManifest;
  context: ProductionAuthoringContext;
  request: ProductionAuthoringRunRequest;
  receipt: ProductionAuthoringRunReceipt | null;
  blueprint: PreRenderBookVisualBlueprint | null;
  reviewPacket: PreRenderBlueprintReviewPacket | null;
}

/**
 * Re-read a persisted sanitized failure capture and re-validate it against the
 * exact bound digest / canonical path / on-disk bytes plus full structural
 * validity (including the no-prose/no-PII and complete-census invariants). Throws
 * on any mismatch so a missing/tampered capture can never be silently accepted.
 * Shared by first materialization and by replay/recovery.
 */
function loadSanitizedFailureCaptureAuthority(args: {
  repoRoot: string;
  capturePath: string;
  expectedDigest: string;
}): { digest: string } {
  const loaded = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath: args.capturePath,
    label: 'Blueprint sanitized failure capture',
  });
  const capture =
    loaded.value as unknown as BlueprintAuthoringSanitizedFailureCapture;
  if (
    repoRelativePath(args.repoRoot, loaded.absolutePath) !== args.capturePath ||
    path.basename(loaded.absolutePath) !== `${args.expectedDigest}.json` ||
    path.basename(path.dirname(loaded.absolutePath)) !==
      'sanitized-failure-captures' ||
    !blueprintAuthoringSanitizedFailureCaptureIsValid(loaded.value) ||
    capture.digest !== args.expectedDigest ||
    loaded.rawBytes !== blueprintAuthoringSanitizedFailureCaptureBytes(capture)
  ) {
    throw new Error(
      'Blueprint sanitized failure capture is invalid, tampered, or missing',
    );
  }
  return { digest: capture.digest };
}

/**
 * Durably publish a failed run's sanitized failure capture (when one was derived)
 * and return the manifest binding. Fail-closed: a capture that is structurally
 * invalid or not linkage-bound to THIS terminal receipt throws (surfaced as an
 * execution incident by the caller) rather than being published unverifiably. The
 * capture bytes are re-read and re-validated before the binding is returned, so the
 * terminal manifest can only ever reference a capture that is already durable.
 */
function publishAndBindSanitizedFailureCapture(args: {
  repoRoot: string;
  outputDir: string;
  capture: BlueprintAuthoringSanitizedFailureCapture | null;
  receipt: ProductionAuthoringRunReceipt;
}): ManifestObservabilityCaptureAuthority | undefined {
  const capture = args.capture;
  if (capture === null) return undefined;
  if (
    !blueprintAuthoringSanitizedFailureCaptureIsValid(capture) ||
    capture.linkage.terminalReceiptDigest !== args.receipt.digest ||
    capture.linkage.requestDigest !== args.receipt.requestDigest ||
    capture.linkage.contextDigest !== args.receipt.contextDigest ||
    capture.terminalFailureCode !== args.receipt.failure?.code
  ) {
    throw new Error(
      'sanitized failure capture is invalid or not bound to its terminal receipt',
    );
  }
  const persisted = persistBlueprintAuthoringSanitizedFailureCapture({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    capture,
    write: true,
    hooks: containedPublishHooks({ repoRoot: args.repoRoot }),
  });
  const reloaded = loadSanitizedFailureCaptureAuthority({
    repoRoot: args.repoRoot,
    capturePath: persisted.capturePath,
    expectedDigest: capture.digest,
  });
  return {
    version: capture.version,
    digest: reloaded.digest,
    path: persisted.capturePath,
  };
}

function loadQaWizardBlueprintManifestAuthority(args: {
  repoRoot: string;
  manifestPath: string;
}): LoadedQaWizardBlueprintManifest {
  const loaded = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath: args.manifestPath,
    label: 'Blueprint authoring manifest',
  });
  if (repoRelativePath(args.repoRoot, loaded.absolutePath) !== args.manifestPath) {
    throw new Error('Blueprint authoring manifest path is noncanonical');
  }
  if (!manifestShapeIsValid(loaded.value)) {
    throw new Error('Blueprint authoring manifest is invalid or tampered');
  }
  const manifest = loaded.value as unknown as QaWizardBlueprintAuthoringManifest;
  assertCanonicalContentAddressedJson({
    artifactPath: args.manifestPath,
    ...loaded,
    digest: manifest.digest,
    category: 'blueprint-authoring-manifests',
    label: 'Blueprint authoring manifest',
  });
  const outputDir = outputDirFromManifestPath(args.manifestPath);
  const { manifest: bridge, context } =
    loadQaWizardApprovedProductionContext({
      repoRoot: args.repoRoot,
      bridgeManifestPath: manifest.bridge.path,
    });
  if (
    bridge.version !== manifest.bridge.version ||
    bridge.digest !== manifest.bridge.digest ||
    context.version !== manifest.context.version ||
    context.digest !== manifest.context.digest
  ) {
    throw new Error('Blueprint authoring bridge or context authority is stale');
  }
  const request = loadProductionRequest({
    repoRoot: args.repoRoot,
    outputDir,
    authority: manifest.request,
    context,
  });

  let predecessor: LoadedQaWizardBlueprintManifest | null = null;
  if (manifest.predecessor !== null) {
    const expectedPath = relativeArtifactPath({
      repoRoot: args.repoRoot,
      outputDir,
      category: 'blueprint-authoring-manifests',
      fileName: `${manifest.predecessor.digest}.json`,
    });
    if (manifest.predecessor.path !== expectedPath) {
      throw new Error('Blueprint authoring predecessor path is noncanonical');
    }
    predecessor = loadQaWizardBlueprintManifestAuthority({
      repoRoot: args.repoRoot,
      manifestPath: manifest.predecessor.path,
    });
    const expectedPredecessorStage =
      manifest.stage === 'blueprint_approved'
        ? 'blueprint_candidate'
        : 'live_request_preflight_passed';
    if (
      predecessor.manifest.version !== manifest.predecessor.version ||
      predecessor.manifest.digest !== manifest.predecessor.digest ||
      predecessor.manifest.stage !== expectedPredecessorStage ||
      predecessor.outputDir !== outputDir ||
      canonicalJsonDigest(predecessor.manifest.bridge) !==
        canonicalJsonDigest(manifest.bridge) ||
      canonicalJsonDigest(predecessor.manifest.context) !==
        canonicalJsonDigest(manifest.context) ||
      canonicalJsonDigest(predecessor.manifest.request) !==
        canonicalJsonDigest(manifest.request)
    ) {
      throw new Error('Blueprint authoring predecessor authority is stale');
    }
    if (
      manifest.stage === 'blueprint_approved' &&
      (canonicalJsonDigest(predecessor.manifest.receipt) !==
        canonicalJsonDigest(manifest.receipt) ||
        canonicalJsonDigest(predecessor.manifest.blueprint) !==
          canonicalJsonDigest(manifest.blueprint))
    ) {
      throw new Error('Blueprint approval changed the candidate or receipt authority');
    }
  }

  const receipt = manifest.receipt
      ? loadProductionReceipt({
          repoRoot: args.repoRoot,
          outputDir,
          authority: manifest.receipt,
          request,
      })
    : null;
  const blueprintArtifacts =
    manifest.blueprint && receipt
        ? readBlueprintArtifacts({
            repoRoot: args.repoRoot,
            outputDir,
            context,
          authority: manifest.blueprint,
          receipt,
        })
      : null;

  if (manifest.stage === 'blueprint_approved') {
    const approval = readJsonObject({
      repoRoot: args.repoRoot,
      artifactPath: manifest.approval!.path,
      label: 'Blueprint approval attestation',
    });
    const attestation =
      approval.value as unknown as PreRenderBlueprintApprovalAttestation;
    const expectedApprovalKeys = attestation.note === undefined
      ? [
          'approvedAt',
          'approvedBy',
          'authoringAuthorityDigest',
          'blueprintDigest',
          'digest',
          'digestAlgorithm',
          'doesNotAuthorize',
          'reviewPacketDigest',
          'scope',
          'version',
        ]
      : [
          'approvedAt',
          'approvedBy',
          'authoringAuthorityDigest',
          'blueprintDigest',
          'digest',
          'digestAlgorithm',
          'doesNotAuthorize',
          'note',
          'reviewPacketDigest',
          'scope',
          'version',
        ];
    const validationIssues = validatePreRenderBlueprintApprovalAttestation({
      blueprint: blueprintArtifacts!.blueprint,
      context: context.validationContext,
      reviewPacket: blueprintArtifacts!.reviewPacket,
      attestation,
    });
    const planned = planPreRenderBlueprintApprovalAttestation({
      root: path.join(
        resolveRepoPath(args.repoRoot, outputDir),
        'blueprint-lifecycle',
      ),
      blueprint: blueprintArtifacts!.blueprint,
      context: context.validationContext,
      reviewPacket: blueprintArtifacts!.reviewPacket,
      approvedBy: attestation.approvedBy,
      approvedAt: attestation.approvedAt,
      ...(attestation.note ? { note: attestation.note } : {}),
    });
    if (
      !exactKeys(approval.value, expectedApprovalKeys) ||
      approval.rawBytes !== preRenderBlueprintLifecycleJsonBytes(approval.value) ||
      validationIssues.length > 0 ||
      computePreRenderBlueprintApprovalDigest(attestation) !==
        manifest.approval!.digest ||
      attestation.digest !== manifest.approval!.digest ||
      attestation.approvedBy !== manifest.approval!.approvedBy ||
      attestation.approvedAt !== manifest.approval!.approvedAt ||
      repoRelativePath(args.repoRoot, planned.approvalPath) !==
        manifest.approval!.path
    ) {
      throw new Error('Blueprint approval authority is stale or invalid');
    }
    if (!predecessor) {
      throw new Error('Blueprint approval lacks its candidate predecessor');
    }
    const expectedDecision = buildApprovalDecision({
      candidate: predecessor,
      approval: manifest.approval!,
      approvedManifest: manifest,
      approvedManifestPath: args.manifestPath,
      note: attestation.note ?? null,
    });
    const decisionPath = approvalDecisionPath({
      repoRoot: args.repoRoot,
      blueprintDigest: blueprintArtifacts!.blueprint.digest,
    });
    const decision = readJsonObject({
      repoRoot: args.repoRoot,
      artifactPath: decisionPath,
      label: 'Blueprint approval decision',
    });
    if (
      !approvalDecisionIsValid(decision.value) ||
      decision.rawBytes !== canonicalContentAddressedJsonBytes(expectedDecision) ||
      repoRelativePath(args.repoRoot, decision.absolutePath) !== decisionPath
    ) {
      throw new Error('Blueprint approval decision is stale or invalid');
    }
  }

  return {
    manifest,
    manifestPath: args.manifestPath,
    outputDir,
    bridge,
    context,
    request,
    receipt,
    blueprint: blueprintArtifacts?.blueprint ?? null,
    reviewPacket: blueprintArtifacts?.reviewPacket ?? null,
  };
}

export function loadQaWizardBlueprintAuthoringManifest(args: {
  repoRoot: string;
  manifestPath: string;
}): QaWizardBlueprintAuthoringManifest {
  return loadQaWizardBlueprintManifestAuthority(args).manifest;
}

function expectedAuthoringAuthorityDigest(
  context: ProductionAuthoringContext,
): string {
  const validation = context.validationContext;
  return buildPreRenderBlueprintAuthoringAuthority({
    storyKey: context.storyKey,
    source: validation.source,
    template: validation.templateIdentity,
    reconciliation: validation.reconciliation,
    reconciliationArtifactPath: validation.reconciliationArtifactPath,
    style: validation.style,
  }).digest;
}

function compilerLedgerArtifactPath(args: {
  repoRoot: string;
  category: (typeof COMPILER_LEDGER_CATEGORIES)[number];
  authorityDigest: string;
}): string {
  return relativeArtifactPath({
    repoRoot: args.repoRoot,
    outputDir: QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
    category: args.category,
    fileName: `${args.authorityDigest}.json`,
  });
}

// The compiler ledger keys claim/terminal/incident artifacts by an execution
// identity digest. For an ordinary first execution the execution identity is
// the content authoring-authority digest, so callers omit executionIdentityDigest
// and behavior is unchanged. A replacement successor passes a distinct
// executionIdentityDigest so its ledger addresses can never collide with or
// impersonate the preserved predecessor claim.
function ledgerKey(args: {
  authoringAuthorityDigest: string;
  executionIdentityDigest?: string;
}): string {
  return args.executionIdentityDigest ?? args.authoringAuthorityDigest;
}

function claimPath(args: {
  repoRoot: string;
  authoringAuthorityDigest: string;
  executionIdentityDigest?: string;
}): string {
  return compilerLedgerArtifactPath({
    repoRoot: args.repoRoot,
    category: 'execution-claims',
    authorityDigest: ledgerKey(args),
  });
}

function terminalLookupPath(args: {
  repoRoot: string;
  authoringAuthorityDigest: string;
  executionIdentityDigest?: string;
}): string {
  return compilerLedgerArtifactPath({
    repoRoot: args.repoRoot,
    category: 'terminal-lookups',
    authorityDigest: ledgerKey(args),
  });
}

function executionIncidentPath(args: {
  repoRoot: string;
  authoringAuthorityDigest: string;
  executionIdentityDigest?: string;
}): string {
  return compilerLedgerArtifactPath({
    repoRoot: args.repoRoot,
    category: 'execution-incidents',
    authorityDigest: ledgerKey(args),
  });
}

// A terminal binding records — durably and per exact execution identity — which
// terminal manifest one paid execution produced. It is written immediately
// after the terminal manifest and before any crash seam, so terminal recovery
// can bind a scanned manifest to the exact execution identity that authored it.
// Ordinary and successor terminal manifests are content-identical and share the
// manifest category, so without this binding a scan keyed only on
// request/predecessor digests could adopt the other lane's terminal.
interface QaWizardBlueprintTerminalBinding {
  version: typeof QA_WIZARD_BLUEPRINT_TERMINAL_BINDING_VERSION;
  executionIdentityDigest: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  terminalManifestDigest: string;
  terminalManifestPath: string;
  scope: 'single_blueprint_execution_terminal_binding';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

function terminalBindingPath(args: {
  repoRoot: string;
  authoringAuthorityDigest: string;
  executionIdentityDigest?: string;
}): string {
  return compilerLedgerArtifactPath({
    repoRoot: args.repoRoot,
    category: 'terminal-bindings',
    authorityDigest: ledgerKey(args),
  });
}

function buildTerminalBinding(args: {
  executionIdentityDigest: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  terminalManifestDigest: string;
  terminalManifestPath: string;
}): QaWizardBlueprintTerminalBinding {
  return digestPayload({
    version: QA_WIZARD_BLUEPRINT_TERMINAL_BINDING_VERSION,
    executionIdentityDigest: args.executionIdentityDigest,
    authoringAuthorityDigest: args.authoringAuthorityDigest,
    requestDigest: args.requestDigest,
    preflightManifestDigest: args.preflightManifestDigest,
    terminalManifestDigest: args.terminalManifestDigest,
    terminalManifestPath: args.terminalManifestPath,
    scope: 'single_blueprint_execution_terminal_binding' as const,
  });
}

function terminalBindingIsValid(
  value: unknown,
): value is QaWizardBlueprintTerminalBinding {
  return (
    exactKeys(value, TERMINAL_BINDING_KEYS) &&
    value.version === QA_WIZARD_BLUEPRINT_TERMINAL_BINDING_VERSION &&
    value.digestAlgorithm === DIGEST_ALGORITHM &&
    [
      value.executionIdentityDigest,
      value.authoringAuthorityDigest,
      value.requestDigest,
      value.preflightManifestDigest,
      value.terminalManifestDigest,
      value.digest,
    ].every((entry) => typeof entry === 'string' && HEX_SHA256.test(entry)) &&
    typeof value.terminalManifestPath === 'string' &&
    value.terminalManifestPath.length > 0 &&
    value.scope === 'single_blueprint_execution_terminal_binding' &&
    value.digest === canonicalJsonDigest(payloadWithoutDigest(value))
  );
}

function persistTerminalBinding(args: {
  repoRoot: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  terminalManifestDigest: string;
  terminalManifestPath: string;
  executionIdentityDigest?: string;
}): void {
  const binding = buildTerminalBinding({
    executionIdentityDigest: ledgerKey(args),
    authoringAuthorityDigest: args.authoringAuthorityDigest,
    requestDigest: args.requestDigest,
    preflightManifestDigest: args.preflightManifestDigest,
    terminalManifestDigest: args.terminalManifestDigest,
    terminalManifestPath: args.terminalManifestPath,
  });
  writeImmutableLocalArtifact({
    destinationPath: resolveRepoPath(args.repoRoot, terminalBindingPath(args)),
    bytes: canonicalContentAddressedJsonBytes(binding),
    hooks: containedPublishHooks({ repoRoot: args.repoRoot }),
  });
}

function loadTerminalBindingForIdentity(args: {
  repoRoot: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  executionIdentityDigest?: string;
}): QaWizardBlueprintTerminalBinding | null {
  const artifactPath = terminalBindingPath(args);
  const absolute = resolveRepoPath(args.repoRoot, artifactPath);
  if (!fs.existsSync(absolute)) return null;
  const key = ledgerKey(args);
  const loaded = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath,
    label: 'Blueprint authoring terminal binding',
  });
  if (
    !terminalBindingIsValid(loaded.value) ||
    loaded.value.executionIdentityDigest !== key ||
    loaded.value.authoringAuthorityDigest !== args.authoringAuthorityDigest ||
    loaded.value.requestDigest !== args.requestDigest ||
    loaded.value.preflightManifestDigest !== args.preflightManifestDigest ||
    path.basename(loaded.absolutePath) !== `${key}.json` ||
    path.basename(path.dirname(loaded.absolutePath)) !== 'terminal-bindings' ||
    repoRelativePath(args.repoRoot, loaded.absolutePath) !== artifactPath ||
    loaded.rawBytes !== canonicalContentAddressedJsonBytes(loaded.value)
  ) {
    throw new Error('Blueprint authoring terminal binding is invalid or tampered');
  }
  return loaded.value;
}

// Collects the terminal manifest digests that are already bound to a DIFFERENT
// execution identity. Terminal recovery never adopts such a manifest, so an
// ordinary re-entry can never consume a successor's terminal (and vice versa),
// even though the two manifests are byte-identical and share one category.
function foreignBoundTerminalManifestDigests(args: {
  repoRoot: string;
  executionIdentityKey: string;
}): Set<string> {
  const directory = resolveRepoPath(
    args.repoRoot,
    path.posix.join(
      QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
      'terminal-bindings',
    ),
  );
  const foreign = new Set<string>();
  if (!fs.existsSync(directory)) return foreign;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/.test(entry.name)) continue;
    const identity = entry.name.slice(0, -'.json'.length);
    if (identity === args.executionIdentityKey) continue;
    const loaded = readJsonObject({
      repoRoot: args.repoRoot,
      artifactPath: repoRelativePath(
        args.repoRoot,
        path.join(directory, entry.name),
      ),
      label: 'Blueprint authoring terminal binding',
    });
    if (
      !terminalBindingIsValid(loaded.value) ||
      loaded.value.executionIdentityDigest !== identity ||
      loaded.rawBytes !== canonicalContentAddressedJsonBytes(loaded.value)
    ) {
      throw new Error('Blueprint authoring terminal binding is invalid or tampered');
    }
    foreign.add(loaded.value.terminalManifestDigest);
  }
  return foreign;
}

function approvalDecisionPath(args: {
  repoRoot: string;
  blueprintDigest: string;
}): string {
  return compilerLedgerArtifactPath({
    repoRoot: args.repoRoot,
    category: 'approval-decisions',
    authorityDigest: args.blueprintDigest,
  });
}

function buildExecutionClaim(args: {
  request: ProductionAuthoringRunRequest;
  preflightManifest: QaWizardBlueprintAuthoringManifest;
  preflightManifestPath: string;
  authoringAuthorityDigest: string;
}): QaWizardBlueprintExecutionClaim {
  return digestPayload({
    version: QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION,
    authoringAuthorityDigest: args.authoringAuthorityDigest,
    requestDigest: canonicalJsonDigest(args.request),
    preflightManifestDigest: args.preflightManifest.digest,
    preflightManifestPath: args.preflightManifestPath,
    requestedAt: args.request.requestedAt,
    scope: 'single_use_paid_blueprint_authoring' as const,
  });
}

function executionClaimIsValid(
  value: unknown,
): value is QaWizardBlueprintExecutionClaim {
  return (
    exactKeys(value, CLAIM_KEYS) &&
    value.version === QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION &&
    value.digestAlgorithm === DIGEST_ALGORITHM &&
    typeof value.authoringAuthorityDigest === 'string' &&
    HEX_SHA256.test(value.authoringAuthorityDigest) &&
    typeof value.requestDigest === 'string' &&
    HEX_SHA256.test(value.requestDigest) &&
    typeof value.preflightManifestDigest === 'string' &&
    HEX_SHA256.test(value.preflightManifestDigest) &&
    typeof value.preflightManifestPath === 'string' &&
    canonicalUtcTimestampIsValid(value.requestedAt) &&
    value.scope === 'single_use_paid_blueprint_authoring' &&
    value.digest === canonicalJsonDigest(payloadWithoutDigest(value))
  );
}

function executionIncidentIsValid(
  value: unknown,
): value is QaWizardBlueprintExecutionIncident {
  if (!exactKeys(value, EXECUTION_INCIDENT_KEYS)) return false;
  const receiptAvailable = value.receiptAvailable === true;
  const receiptUnavailable = value.receiptAvailable === false;
  return (
    value.version === QA_WIZARD_BLUEPRINT_EXECUTION_INCIDENT_VERSION &&
    value.digestAlgorithm === DIGEST_ALGORITHM &&
    [
      value.authoringAuthorityDigest,
      value.requestDigest,
      value.preflightManifestDigest,
      value.claimDigest,
      value.digest,
    ].every((entry) => typeof entry === 'string' && HEX_SHA256.test(entry)) &&
    typeof value.claimPath === 'string' &&
    [
      'claim_validation',
      'runner_execution',
      'receipt_replay_validation',
      'receipt_publication',
      'terminal_materialization',
      'terminal_manifest_publication',
      'terminal_lookup_publication',
    ].includes(value.phase as QaWizardBlueprintExecutionIncidentPhase) &&
    ((receiptAvailable &&
      typeof value.receiptDigest === 'string' &&
      HEX_SHA256.test(value.receiptDigest) &&
      (value.receiptStatus === 'completed' || value.receiptStatus === 'failed')) ||
      (receiptUnavailable &&
        value.receiptDigest === null &&
        value.receiptStatus === null)) &&
    value.providerOutcome === 'unknown' &&
    value.resolution === 'operator_resolution_required_no_redispatch' &&
    value.scope === 'single_use_paid_blueprint_authoring_incident' &&
    value.digest === canonicalJsonDigest(payloadWithoutDigest(value))
  );
}

function buildExecutionIncident(args: {
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  claim: { digest: string };
  claimPath: string;
  phase: QaWizardBlueprintExecutionIncidentPhase;
  receipt: ProductionAuthoringRunReceipt | null;
}): QaWizardBlueprintExecutionIncident {
  const receiptStatus: 'completed' | 'failed' | null =
    args.receipt?.status === 'completed' || args.receipt?.status === 'failed'
      ? args.receipt.status
      : null;
  const receiptIsTerminal =
    args.receipt !== null &&
    receiptStatus !== null &&
    typeof args.receipt.digest === 'string' &&
    HEX_SHA256.test(args.receipt.digest);
  return digestPayload({
    version: QA_WIZARD_BLUEPRINT_EXECUTION_INCIDENT_VERSION,
    authoringAuthorityDigest: args.authoringAuthorityDigest,
    requestDigest: args.requestDigest,
    preflightManifestDigest: args.preflightManifestDigest,
    claimDigest: args.claim.digest,
    claimPath: args.claimPath,
    phase: args.phase,
    receiptAvailable: receiptIsTerminal,
    receiptDigest: receiptIsTerminal ? args.receipt!.digest : null,
    receiptStatus: receiptIsTerminal ? receiptStatus : null,
    providerOutcome: 'unknown' as const,
    resolution: 'operator_resolution_required_no_redispatch' as const,
    scope: 'single_use_paid_blueprint_authoring_incident' as const,
  });
}

function loadExecutionIncident(args: {
  repoRoot: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  claimDigest: string;
  claimPath: string;
  executionIdentityDigest?: string;
}): { incident: QaWizardBlueprintExecutionIncident; path: string } | null {
  const artifactPath = executionIncidentPath(args);
  const absolute = resolveRepoPath(args.repoRoot, artifactPath);
  if (!fs.existsSync(absolute)) return null;
  const loaded = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath,
    label: 'Blueprint authoring execution incident',
  });
  if (
    !executionIncidentIsValid(loaded.value) ||
    loaded.value.authoringAuthorityDigest !== args.authoringAuthorityDigest ||
    loaded.value.requestDigest !== args.requestDigest ||
    loaded.value.preflightManifestDigest !== args.preflightManifestDigest ||
    loaded.value.claimDigest !== args.claimDigest ||
    loaded.value.claimPath !== args.claimPath ||
    repoRelativePath(args.repoRoot, loaded.absolutePath) !== artifactPath ||
    loaded.rawBytes !== canonicalContentAddressedJsonBytes(loaded.value)
  ) {
    throw new Error('Blueprint authoring execution incident is invalid or tampered');
  }
  return { incident: loaded.value, path: artifactPath };
}

function persistExecutionIncident(args: {
  repoRoot: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  claim: { digest: string };
  claimPath: string;
  phase: QaWizardBlueprintExecutionIncidentPhase;
  receipt: ProductionAuthoringRunReceipt | null;
  executionIdentityDigest?: string;
}): { incident: QaWizardBlueprintExecutionIncident; path: string } {
  const incident = buildExecutionIncident(args);
  const artifactPath = executionIncidentPath(args);
  writeImmutableLocalArtifact({
    destinationPath: resolveRepoPath(args.repoRoot, artifactPath),
    bytes: canonicalContentAddressedJsonBytes(incident),
    hooks: containedPublishHooks({ repoRoot: args.repoRoot }),
  });
  const loaded = loadExecutionIncident({
    repoRoot: args.repoRoot,
    authoringAuthorityDigest: args.authoringAuthorityDigest,
    requestDigest: args.requestDigest,
    preflightManifestDigest: args.preflightManifestDigest,
    claimDigest: args.claim.digest,
    claimPath: args.claimPath,
    ...(args.executionIdentityDigest
      ? { executionIdentityDigest: args.executionIdentityDigest }
      : {}),
  });
  if (!loaded) {
    throw new Error('Blueprint authoring execution incident was not persisted');
  }
  return loaded;
}

function buildExecutionRecord(args: {
  authoringAuthorityDigest: string;
  requestDigest: string;
  claim: { digest: string };
  claimPath: string;
  manifest: QaWizardBlueprintAuthoringManifest;
  manifestPath: string;
  receipt: ProductionAuthoringRunReceipt;
  receiptPath: string;
}): QaWizardBlueprintExecutionRecord {
  return digestPayload({
    version: QA_WIZARD_BLUEPRINT_EXECUTION_RECORD_VERSION,
    authoringAuthorityDigest: args.authoringAuthorityDigest,
    requestDigest: args.requestDigest,
    claimDigest: args.claim.digest,
    claimPath: args.claimPath,
    terminalManifestDigest: args.manifest.digest,
    terminalManifestPath: args.manifestPath,
    receiptDigest: args.receipt.digest,
    receiptPath: args.receiptPath,
    status: args.receipt.status as 'completed' | 'failed',
  });
}

function executionRecordIsValid(
  value: unknown,
): value is QaWizardBlueprintExecutionRecord {
  return (
    exactKeys(value, EXECUTION_RECORD_KEYS) &&
    value.version === QA_WIZARD_BLUEPRINT_EXECUTION_RECORD_VERSION &&
    value.digestAlgorithm === DIGEST_ALGORITHM &&
    (value.status === 'completed' || value.status === 'failed') &&
    [
      value.requestDigest,
      value.authoringAuthorityDigest,
      value.claimDigest,
      value.terminalManifestDigest,
      value.receiptDigest,
      value.digest,
    ].every((entry) => typeof entry === 'string' && HEX_SHA256.test(entry)) &&
    typeof value.claimPath === 'string' &&
    typeof value.terminalManifestPath === 'string' &&
    typeof value.receiptPath === 'string' &&
    value.digest === canonicalJsonDigest(payloadWithoutDigest(value))
  );
}

function loadExecutionRecord(args: {
  repoRoot: string;
  outputDir: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  executionIdentityDigest?: string;
  claimIsValid?: (value: unknown) => boolean;
}): QaWizardBlueprintExecutionResult | null {
  const key = ledgerKey(args);
  const claimIsValid = args.claimIsValid ?? executionClaimIsValid;
  const lookupPath = terminalLookupPath(args);
  const absolute = resolveRepoPath(args.repoRoot, lookupPath);
  if (!fs.existsSync(absolute)) return null;
  const loaded = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath: lookupPath,
    label: 'Blueprint authoring terminal lookup',
  });
  if (
    !executionRecordIsValid(loaded.value) ||
    loaded.value.authoringAuthorityDigest !== args.authoringAuthorityDigest ||
    loaded.value.requestDigest !== args.requestDigest ||
    loaded.value.claimPath !== claimPath(args) ||
    path.basename(loaded.absolutePath) !== `${key}.json` ||
    path.basename(path.dirname(loaded.absolutePath)) !==
      'terminal-lookups' ||
    repoRelativePath(args.repoRoot, loaded.absolutePath) !== lookupPath ||
    loaded.rawBytes !== canonicalContentAddressedJsonBytes(loaded.value)
  ) {
    throw new Error('Blueprint authoring terminal lookup is invalid or tampered');
  }
  const claim = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath: loaded.value.claimPath,
    label: 'Blueprint authoring execution claim',
  });
  if (
    !claimIsValid(claim.value) ||
    claim.value.authoringAuthorityDigest !== args.authoringAuthorityDigest ||
    claim.value.requestDigest !== args.requestDigest ||
    claim.value.preflightManifestDigest !== args.preflightManifestDigest ||
    claim.value.digest !== loaded.value.claimDigest ||
    path.basename(claim.absolutePath) !== `${key}.json` ||
    path.basename(path.dirname(claim.absolutePath)) !==
      'execution-claims' ||
    repoRelativePath(args.repoRoot, claim.absolutePath) !== loaded.value.claimPath ||
    claim.rawBytes !== canonicalContentAddressedJsonBytes(claim.value)
  ) {
    throw new Error('Blueprint authoring execution claim is invalid or tampered');
  }
  const terminal = loadQaWizardBlueprintManifestAuthority({
    repoRoot: args.repoRoot,
    manifestPath: loaded.value.terminalManifestPath,
  });
  if (
    terminal.manifest.digest !== loaded.value.terminalManifestDigest ||
    terminal.outputDir !== args.outputDir ||
    terminal.manifest.predecessor?.digest !== args.preflightManifestDigest ||
    terminal.receipt === null ||
    terminal.receipt.digest !== loaded.value.receiptDigest ||
    terminal.manifest.receipt?.path !== loaded.value.receiptPath ||
    terminal.receipt.status !== loaded.value.status ||
    !['blueprint_candidate', 'authoring_failed'].includes(
      terminal.manifest.stage,
    )
  ) {
    throw new Error('Blueprint authoring terminal authority is stale');
  }
  // Replay must re-validate the exact bound sanitized capture (digest/path/bytes/
  // validity). A terminal that declares a capture whose file is missing or
  // tampered is a torn state, not a replayable terminal.
  if (terminal.manifest.observabilityCapture) {
    loadSanitizedFailureCaptureAuthority({
      repoRoot: args.repoRoot,
      capturePath: terminal.manifest.observabilityCapture.path,
      expectedDigest: terminal.manifest.observabilityCapture.digest,
    });
  }
  return {
    replayed: true,
    manifest: terminal.manifest,
    manifestPath: terminal.manifestPath,
    receipt: terminal.receipt,
    receiptPath: loaded.value.receiptPath,
    claimPath: loaded.value.claimPath,
    executionRecordPath: lookupPath,
  };
}

// Read-only scan of the terminal manifests that the given execution identity
// could recover, applying the exact same ownership rules as recovery: never a
// manifest bound to another identity, and — when this identity has its own
// durable binding — only that exact bound manifest. This is the single source
// of truth for both `recoverTerminalLookup` (which then materializes the
// lookup) and the replacement orphan-eligibility census (which must classify a
// predecessor without mutating disk). It writes nothing.
function scanRecoverableTerminalManifests(args: {
  repoRoot: string;
  outputDir: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  executionIdentityDigest?: string;
}): {
  ownBinding: QaWizardBlueprintTerminalBinding | null;
  terminals: LoadedQaWizardBlueprintManifest[];
} {
  const identityKey = ledgerKey(args);
  const ownBinding = loadTerminalBindingForIdentity(args);
  const foreignTerminals = foreignBoundTerminalManifestDigests({
    repoRoot: args.repoRoot,
    executionIdentityKey: identityKey,
  });
  const manifestDirectory = resolveRepoPath(
    args.repoRoot,
    path.posix.join(args.outputDir, 'blueprint-authoring-manifests'),
  );
  const terminals: LoadedQaWizardBlueprintManifest[] = [];
  if (!fs.existsSync(manifestDirectory)) {
    return { ownBinding, terminals };
  }
  for (const entry of fs.readdirSync(manifestDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/.test(entry.name)) continue;
    const manifestPath = repoRelativePath(
      args.repoRoot,
      path.join(manifestDirectory, entry.name),
    );
    const candidate = loadQaWizardBlueprintManifestAuthority({
      repoRoot: args.repoRoot,
      manifestPath,
    });
    if (
      !['blueprint_candidate', 'authoring_failed'].includes(
        candidate.manifest.stage,
      ) ||
      candidate.manifest.request.digest !== args.requestDigest ||
      candidate.manifest.predecessor?.digest !== args.preflightManifestDigest
    ) {
      continue;
    }
    // Never adopt a terminal owned by another execution identity.
    if (foreignTerminals.has(candidate.manifest.digest)) continue;
    // When this identity has a durable binding, only its exact terminal counts.
    if (ownBinding && candidate.manifest.digest !== ownBinding.terminalManifestDigest) {
      continue;
    }
    terminals.push(candidate);
  }
  return { ownBinding, terminals };
}

// Read-only classification of whether the predecessor's own (ordinary) execution
// identity has a terminal that ordinary recovery would adopt. This covers the
// legacy pre-Round-2 crash state: a terminal manifest published WITHOUT a
// terminal binding and WITHOUT a terminal lookup. Such a predecessor is
// recoverable through the ordinary lane and therefore must NOT be treated as a
// replacement-eligible orphan. Mutates nothing, so it is safe under a
// `write:false` preparation.
function classifyPredecessorRecoverableTerminal(args: {
  repoRoot: string;
  outputDir: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
}): 'none' | 'recoverable' | 'ambiguous' {
  const { ownBinding, terminals } = scanRecoverableTerminalManifests(args);
  if (terminals.length === 0) {
    // A binding that names a now-missing terminal is a torn state, not orphan.
    // (The caller also rejects an own binding directly; this is defense in depth.)
    return ownBinding ? 'ambiguous' : 'none';
  }
  if (terminals.length === 1 && terminals[0]!.receipt !== null) {
    return 'recoverable';
  }
  // Multiple matches, or a single match with no receipt: ordinary recovery would
  // fail closed as execution_state_uncertain, so replacement must fail closed too.
  return 'ambiguous';
}

function recoverTerminalLookup(args: {
  repoRoot: string;
  outputDir: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  executionIdentityDigest?: string;
  claimIsValid?: (value: unknown) => boolean;
}): QaWizardBlueprintExecutionResult | null {
  const claimIsValid = args.claimIsValid ?? executionClaimIsValid;
  const expectedClaimPath = claimPath(args);
  const claimArtifact = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath: expectedClaimPath,
    label: 'Blueprint authoring execution claim',
  });
  if (
    !claimIsValid(claimArtifact.value) ||
    claimArtifact.value.authoringAuthorityDigest !==
      args.authoringAuthorityDigest ||
    claimArtifact.value.requestDigest !== args.requestDigest ||
    claimArtifact.value.preflightManifestDigest !==
      args.preflightManifestDigest ||
    repoRelativePath(args.repoRoot, claimArtifact.absolutePath) !==
      expectedClaimPath ||
    claimArtifact.rawBytes !==
      canonicalContentAddressedJsonBytes(claimArtifact.value)
  ) {
    throw new Error('Blueprint authoring execution claim is invalid or tampered');
  }
  // Recovery is bound to the exact execution identity via the terminal binding
  // written before the terminal manifest is published. A manifest bound to a
  // different identity is never adoptable, so ordinary recovery can never
  // consume a successor terminal and successor recovery can never consume an
  // ordinary one. The scan below is the same read-only source of truth used by
  // the replacement orphan-eligibility census.
  const { ownBinding, terminals } = scanRecoverableTerminalManifests(args);
  if (terminals.length === 0) {
    // A binding that names a now-missing (or foreign) terminal is a torn state,
    // not a clean "nothing to recover".
    if (ownBinding) throw new Error('execution_state_uncertain');
    return null;
  }
  if (terminals.length !== 1 || terminals[0]!.receipt === null) {
    throw new Error('execution_state_uncertain');
  }
  const terminal = terminals[0]!;
  const receipt = terminal.receipt;
  if (receipt === null) throw new Error('execution_state_uncertain');
  const receiptPath = terminal.manifest.receipt!.path;
  const recordValue = buildExecutionRecord({
    authoringAuthorityDigest: args.authoringAuthorityDigest,
    requestDigest: args.requestDigest,
    claim: claimArtifact.value as { digest: string },
    claimPath: expectedClaimPath,
    manifest: terminal.manifest,
    manifestPath: terminal.manifestPath,
    receipt,
    receiptPath,
  });
  const lookupPath = terminalLookupPath(args);
  writeImmutableLocalArtifact({
    destinationPath: resolveRepoPath(args.repoRoot, lookupPath),
    bytes: canonicalContentAddressedJsonBytes(recordValue),
    hooks: containedPublishHooks({ repoRoot: args.repoRoot }),
  });
  return loadExecutionRecord(args);
}

function blueprintAuthorityFromPersistence(args: {
  repoRoot: string;
  persisted: ReturnType<typeof persistPreRenderBlueprintLifecycle>;
  blueprint: PreRenderBookVisualBlueprint;
}): ManifestBlueprintAuthority {
  return {
    blueprintDigest: args.blueprint.digest,
    authoringAuthorityDigest:
      args.blueprint.identity.authoringAuthority.digest,
    candidatePath: repoRelativePath(args.repoRoot, args.persisted.candidate.path),
    provenanceDigest: args.persisted.provenance.digest,
    provenancePath: repoRelativePath(args.repoRoot, args.persisted.provenance.path),
    validationEvidenceDigest: args.persisted.validationEvidence.digest,
    validationEvidencePath: repoRelativePath(
      args.repoRoot,
      args.persisted.validationEvidence.path,
    ),
    reviewPacketDigest: args.persisted.reviewPacket.digest,
    reviewPacketPath: repoRelativePath(
      args.repoRoot,
      args.persisted.reviewPacket.path,
    ),
    reviewMarkdownDigest: args.persisted.reviewMarkdown.digest,
    reviewMarkdownPath: repoRelativePath(
      args.repoRoot,
      args.persisted.reviewMarkdown.path,
    ),
    contactSheetDigest: args.persisted.contactSheet.digest,
    contactSheetPath: repoRelativePath(
      args.repoRoot,
      args.persisted.contactSheet.path,
    ),
  };
}

/**
 * Binds one blueprint execution to a compiler-owned ledger identity and claim
 * shape. The ordinary first execution binds to the content authoring-authority
 * digest with the ordinary claim; a human-approved replacement successor binds
 * to a distinct successor execution digest with the replacement claim, so the
 * two lanes share this identical execute core without their ledger addresses
 * ever colliding.
 */
interface BlueprintExecutionClaimBinding {
  executionIdentity: (ctx: { authoringAuthorityDigest: string }) => string;
  claimIsValid: (value: unknown) => boolean;
  buildClaim: (ctx: {
    preflight: LoadedQaWizardBlueprintManifest;
    authoringAuthorityDigest: string;
    requestDigest: string;
  }) => { digest: string };
  /**
   * Lane-specific gate run after the current preflight/authority are resolved
   * but before any ledger read or paid boundary. The replacement lane uses it
   * to require an unresolved exact predecessor orphan and an exact approved
   * authorization; the ordinary lane omits it.
   */
  precheck?: (ctx: {
    repoRoot: string;
    outputDir: string;
    preflight: LoadedQaWizardBlueprintManifest;
    authoringAuthorityDigest: string;
    requestDigest: string;
  }) => void;
}

async function runBlueprintExecutionUnderClaim(
  args: {
    repoRoot: string;
    preflightManifestPath: string;
    outputDir: string;
    write: true;
  },
  binding: BlueprintExecutionClaimBinding,
  deps: QaWizardBlueprintExecutionDependencies = {},
): Promise<QaWizardBlueprintExecutionResult> {
  if (args.write !== true) {
    throw new Error('execute-live requires write=true');
  }
  const preflight = loadQaWizardBlueprintManifestAuthority({
    repoRoot: args.repoRoot,
    manifestPath: args.preflightManifestPath,
  });
  if (preflight.manifest.stage !== 'live_request_preflight_passed') {
    throw new Error('execute-live requires a preflight-passed manifest');
  }
  const outputDir = sameOutputDir({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    manifestPath: args.preflightManifestPath,
  });
  prepareBlueprintOperatorOutputRoot({
    repoRoot: args.repoRoot,
    outputDir,
  });
  prepareCompilerOwnedLedger({ repoRoot: args.repoRoot });
  const authoringAuthorityDigest = expectedAuthoringAuthorityDigest(
    preflight.context,
  );
  const requestDigest = canonicalJsonDigest(preflight.request);
  const executionIdentityDigest = binding.executionIdentity({
    authoringAuthorityDigest,
  });
  const claimIsValid = binding.claimIsValid;
  const executionClaimPath = claimPath({
    repoRoot: args.repoRoot,
    authoringAuthorityDigest,
    executionIdentityDigest,
  });
  let existingTerminal: QaWizardBlueprintExecutionResult | null;
  try {
    existingTerminal = loadExecutionRecord({
      repoRoot: args.repoRoot,
      outputDir,
      authoringAuthorityDigest,
      requestDigest,
      preflightManifestDigest: preflight.manifest.digest,
      executionIdentityDigest,
      claimIsValid,
    });
  } catch (cause) {
    throw executionStateUncertain(cause);
  }
  if (existingTerminal) return existingTerminal;

  // A published claim owns this authority even if an adversarial path swap
  // makes its downstream lifecycle tree unreadable. Detect that ownership
  // before touching the mutable output tree so a retry cannot escape the
  // paid-call fence through a raw containment error.
  if (fs.existsSync(resolveRepoPath(args.repoRoot, executionClaimPath))) {
    try {
      const publishedClaim = readJsonObject({
        repoRoot: args.repoRoot,
        artifactPath: executionClaimPath,
        label: 'Blueprint authoring execution claim',
      });
      if (
        !claimIsValid(publishedClaim.value) ||
        publishedClaim.value.authoringAuthorityDigest !== authoringAuthorityDigest ||
        publishedClaim.value.requestDigest !== requestDigest ||
        publishedClaim.value.preflightManifestDigest !== preflight.manifest.digest ||
        publishedClaim.value.preflightManifestPath !== preflight.manifestPath ||
        publishedClaim.rawBytes !==
          canonicalContentAddressedJsonBytes(publishedClaim.value)
      ) {
        throw new Error('Blueprint authoring execution claim is invalid or tampered');
      }
      const recovered = recoverTerminalLookup({
        repoRoot: args.repoRoot,
        outputDir,
        authoringAuthorityDigest,
        requestDigest,
        preflightManifestDigest: preflight.manifest.digest,
        executionIdentityDigest,
        claimIsValid,
      });
      if (recovered) return recovered;
      const incident = loadExecutionIncident({
        repoRoot: args.repoRoot,
        authoringAuthorityDigest,
        requestDigest,
        preflightManifestDigest: preflight.manifest.digest,
        claimDigest: publishedClaim.value.digest as string,
        claimPath: executionClaimPath,
        executionIdentityDigest,
      });
      if (incident) {
        throw executionStateUncertain(undefined, {
          path: incident.path,
          phase: incident.incident.phase,
        });
      }
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'execution_state_uncertain') {
        throw cause;
      }
      throw executionStateUncertain(cause);
    }
    throw executionStateUncertain();
  }

  // The lane gate runs only on the genuine first execution — after replay and
  // the published-claim fence — so a successor's own terminal can never be
  // mistaken for an unresolved predecessor on replay or crash recovery.
  binding.precheck?.({
    repoRoot: args.repoRoot,
    outputDir,
    preflight,
    authoringAuthorityDigest,
    requestDigest,
  });

  prepareBlueprintLifecycleAuthorityDirectories({
    repoRoot: args.repoRoot,
    outputDir,
    authoringAuthorityDigest,
  });

  const claim = binding.buildClaim({
    preflight,
    authoringAuthorityDigest,
    requestDigest,
  });
  let claimWrite: { created: boolean };
  let executionPhase: QaWizardBlueprintExecutionIncidentPhase =
    'claim_validation';
  let terminalReceipt: ProductionAuthoringRunReceipt | null = null;
  try {
    claimWrite = writeImmutableLocalArtifact({
      destinationPath: resolveRepoPath(args.repoRoot, executionClaimPath),
      bytes: canonicalContentAddressedJsonBytes(claim),
      hooks: containedPublishHooks({ repoRoot: args.repoRoot }),
    });
  } catch (cause) {
    throw executionStateUncertain(cause);
  }
  if (!claimWrite.created) {
    try {
      const completedDuringClaimRace = loadExecutionRecord({
        repoRoot: args.repoRoot,
        outputDir,
        authoringAuthorityDigest,
        requestDigest,
        preflightManifestDigest: preflight.manifest.digest,
        executionIdentityDigest,
        claimIsValid,
      });
      if (completedDuringClaimRace) return completedDuringClaimRace;
      const recovered = recoverTerminalLookup({
        repoRoot: args.repoRoot,
        outputDir,
        authoringAuthorityDigest,
        requestDigest,
        preflightManifestDigest: preflight.manifest.digest,
        executionIdentityDigest,
        claimIsValid,
      });
      if (recovered) return recovered;
      throw executionStateUncertain();
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'execution_state_uncertain') {
        throw cause;
      }
      throw executionStateUncertain(cause);
    }
  }
  try {
    const publishedClaim = readJsonObject({
      repoRoot: args.repoRoot,
      artifactPath: executionClaimPath,
      label: 'Blueprint authoring execution claim',
    });
    if (
      !claimIsValid(publishedClaim.value) ||
      publishedClaim.value.digest !== claim.digest ||
      publishedClaim.rawBytes !== canonicalContentAddressedJsonBytes(claim) ||
      repoRelativePath(args.repoRoot, publishedClaim.absolutePath) !==
        executionClaimPath
    ) {
      throw new Error('published Blueprint authoring claim is invalid');
    }
    deps.hooks?.afterClaim?.();

  executionPhase = 'runner_execution';
  const providerFactory =
    deps.providerFactory ??
    (async (): Promise<ProductionAuthoringProvider> => {
      const adapter = await import('./openaiResponsesBlueprintAuthoringAdapter');
      return adapter.createOpenAIResponsesBlueprintAuthoringAdapter();
    });
  let providerPromise: Promise<ProductionAuthoringProvider> | null = null;
  const provider: ProductionAuthoringProvider = {
    call(callArgs) {
      providerPromise ??= Promise.resolve(providerFactory());
      return providerPromise.then((resolved) => resolved.call(callArgs));
    },
  };

  const result = await runProductionBlueprintAuthoring({
    request: preflight.request,
    context: preflight.context,
    provider,
  });
  terminalReceipt = result.receipt;
  executionPhase = 'receipt_replay_validation';
  if (
    result.receipt.status !== 'completed' &&
    result.receipt.status !== 'failed'
  ) {
    throw new Error('live Blueprint authoring returned a nonterminal receipt');
  }
  if (
    !productionBlueprintAuthoringReceiptReplayIsValid({
      receipt: result.receipt as unknown as Record<string, unknown>,
      request: preflight.request,
      expectedStatus: result.receipt.status,
      expectedDigest: result.receipt.digest,
    })
  ) {
    throw new Error('live Blueprint authoring returned an unreplayable receipt');
  }
  executionPhase = 'receipt_publication';
  const persistedReceipt = persistProductionAuthoringReceipt({
    repoRoot: args.repoRoot,
    outputDir,
    receipt: result.receipt,
    write: true,
    hooks: containedPublishHooks({
      repoRoot: args.repoRoot,
      beforeCheck: deps.hooks?.beforeReceiptArtifactPublish,
    }),
  });
  deps.hooks?.afterReceipt?.();
  executionPhase = 'terminal_materialization';
  let stage: 'blueprint_candidate' | 'authoring_failed';
  let blueprint: ManifestBlueprintAuthority | null = null;
  let observabilityCapture: ManifestObservabilityCaptureAuthority | undefined;
  if (result.receipt.status === 'completed') {
    if (
      !result.authoringResult ||
      result.receipt.blueprintDigest !== result.authoringResult.blueprint.digest ||
      result.receipt.authoringProvenanceDigest !==
        canonicalJsonDigest(result.authoringResult.provenance)
    ) {
      throw new Error('completed Blueprint receipt lacks its exact authoring result');
    }
    const safeRepairAttempts = safeRepairAttemptsFromReceipt(result.receipt);
    const expectedProvenance = expectedAuthoringProvenance({
      blueprint: result.authoringResult.blueprint,
      receipt: result.receipt,
    });
    if (
      canonicalJsonDigest(expectedProvenance) !==
      canonicalJsonDigest(result.authoringResult.provenance)
    ) {
      throw new Error('completed Blueprint provenance is not receipt-derived');
    }
    const review = buildPreRenderBlueprintReviewBundle({
      blueprint: result.authoringResult.blueprint,
      context: preflight.context.validationContext,
      provenance: expectedProvenance,
      repairAttempts: safeRepairAttempts,
    });
    const lifecycleRoot = prepareBlueprintLifecycleAuthorityDirectories({
      repoRoot: args.repoRoot,
      outputDir,
      authoringAuthorityDigest,
      blueprintDigest: result.authoringResult.blueprint.digest,
      reviewPacketDigest: review.packet.digest,
    });
    const persisted = persistPreRenderBlueprintLifecycle({
      root: lifecycleRoot,
      blueprint: result.authoringResult.blueprint,
      context: preflight.context.validationContext,
      provenance: expectedProvenance,
      repairAttempts: safeRepairAttempts,
      hooks: containedPublishHooks({
        repoRoot: args.repoRoot,
        beforeCheck: deps.hooks?.beforeLifecycleArtifactPublish,
      }),
    });
    blueprint = blueprintAuthorityFromPersistence({
      repoRoot: args.repoRoot,
      persisted,
      blueprint: result.authoringResult.blueprint,
    });
    stage = 'blueprint_candidate';
  } else {
    if (result.authoringResult !== null) {
      throw new Error('failed Blueprint receipt unexpectedly includes an authoring result');
    }
    stage = 'authoring_failed';
    // Durably publish the sanitized failure observability capture (when one was
    // derived) BEFORE the terminal manifest that binds it. Ordering matters: the
    // receipt (already published) never references the capture, and the terminal
    // manifest is only built/published after the capture bytes are durable and
    // re-validated — so no terminal ever claims a capture that is missing.
    observabilityCapture = publishAndBindSanitizedFailureCapture({
      repoRoot: args.repoRoot,
      outputDir,
      capture: result.sanitizedFailureCapture ?? null,
      receipt: result.receipt,
    });
  }
  const receiptAuthority: ManifestReceiptAuthority = {
    version: result.receipt.version,
    digest: result.receipt.digest,
    path: persistedReceipt.receiptPath,
    status: stage === 'blueprint_candidate' ? 'completed' : 'failed',
  };
  const terminalManifest = buildManifest({
    version: QA_WIZARD_BLUEPRINT_AUTHORING_MANIFEST_VERSION,
    stage,
    predecessor: predecessorAuthority({
      manifest: preflight.manifest,
      manifestPath: preflight.manifestPath,
    }),
    bridge: preflight.manifest.bridge,
    context: preflight.manifest.context,
    request: preflight.manifest.request,
    receipt: receiptAuthority,
    blueprint,
    approval: null,
    ...(observabilityCapture ? { observabilityCapture } : {}),
    doesNotAuthorize: [...BEFORE_APPROVAL_EXCLUSIONS],
  });
  executionPhase = 'terminal_manifest_publication';
  // Terminal identity ownership must become durable BEFORE the terminal manifest
  // becomes globally visible. The manifest path and digest are deterministic
  // from the already-built terminal manifest, so the ownership binding is
  // published FIRST (write:false only computes the canonical path) and the
  // manifest is published only after. If the process crashes in the interval,
  // the manifest never appears without its ownership binding already durable:
  // the other execution identity therefore cannot scan-and-adopt an unbound
  // terminal, and this lane's own re-entry fails closed as
  // execution_state_uncertain (recoverTerminalLookup sees a binding that names a
  // missing terminal) with no provider redispatch. A dangling binding is a torn
  // state, never an adoptable terminal.
  const terminalManifestPath = persistManifest({
    repoRoot: args.repoRoot,
    outputDir,
    manifest: terminalManifest,
    write: false,
  }).path;
  persistTerminalBinding({
    repoRoot: args.repoRoot,
    authoringAuthorityDigest,
    requestDigest,
    preflightManifestDigest: preflight.manifest.digest,
    terminalManifestDigest: terminalManifest.digest,
    terminalManifestPath,
    executionIdentityDigest,
  });
  deps.hooks?.afterTerminalBinding?.();
  const terminalManifestArtifact = persistManifest({
    repoRoot: args.repoRoot,
    outputDir,
    manifest: terminalManifest,
    write: true,
  });
  if (terminalManifestArtifact.path !== terminalManifestPath) {
    throw new Error('terminal manifest path diverged from its ownership binding');
  }
  const executionRecord = buildExecutionRecord({
    authoringAuthorityDigest,
    requestDigest,
    claim,
    claimPath: executionClaimPath,
    manifest: terminalManifest,
    manifestPath: terminalManifestArtifact.path,
    receipt: result.receipt,
    receiptPath: persistedReceipt.receiptPath,
  });
  deps.hooks?.afterTerminalManifest?.();
  executionPhase = 'terminal_lookup_publication';
  const executionRecordPath = terminalLookupPath({
    repoRoot: args.repoRoot,
    authoringAuthorityDigest,
    executionIdentityDigest,
  });
  writeImmutableLocalArtifact({
    destinationPath: resolveRepoPath(args.repoRoot, executionRecordPath),
    bytes: canonicalContentAddressedJsonBytes(executionRecord),
    hooks: containedPublishHooks({
      repoRoot: args.repoRoot,
      beforeCheck: deps.hooks?.beforeTerminalLookupPublish,
    }),
  });
    return {
      replayed: false,
      manifest: terminalManifest,
      manifestPath: terminalManifestArtifact.path,
      receipt: result.receipt,
      receiptPath: persistedReceipt.receiptPath,
      claimPath: executionClaimPath,
      executionRecordPath,
    };
  } catch (cause) {
    try {
      const incident = persistExecutionIncident({
        repoRoot: args.repoRoot,
        authoringAuthorityDigest,
        requestDigest,
        preflightManifestDigest: preflight.manifest.digest,
        claim,
        claimPath: executionClaimPath,
        phase: executionPhase,
        receipt: terminalReceipt,
        executionIdentityDigest,
      });
      throw executionStateUncertain(cause, {
        path: incident.path,
        phase: incident.incident.phase,
      });
    } catch (incidentCause) {
      if (
        incidentCause instanceof Error &&
        incidentCause.message === 'execution_state_uncertain'
      ) {
        throw incidentCause;
      }
      throw executionStateUncertain(cause);
    }
  }
}

const ordinaryExecutionClaimBinding: BlueprintExecutionClaimBinding = {
  executionIdentity: (ctx) => ctx.authoringAuthorityDigest,
  claimIsValid: executionClaimIsValid,
  buildClaim: (ctx) =>
    buildExecutionClaim({
      request: ctx.preflight.request,
      preflightManifest: ctx.preflight.manifest,
      preflightManifestPath: ctx.preflight.manifestPath,
      authoringAuthorityDigest: ctx.authoringAuthorityDigest,
    }),
};

export async function executeQaWizardBlueprintLiveRequest(
  args: {
    repoRoot: string;
    preflightManifestPath: string;
    outputDir: string;
    write: true;
  },
  deps: QaWizardBlueprintExecutionDependencies = {},
): Promise<QaWizardBlueprintExecutionResult> {
  return runBlueprintExecutionUnderClaim(
    args,
    ordinaryExecutionClaimBinding,
    deps,
  );
}

// ---------------------------------------------------------------------------
// Replacement (orphan-claim successor) authority lane.
//
// The predecessor claim is never mutated, retried or impersonated. A durable
// but unresolved orphan (a published claim with no recoverable terminal and no
// incident) can only advance through an explicit, versioned proposal -> review
// -> exact Guy approval, after which one — and only one — successor paid
// execution runs under a distinct compiler-owned execution identity while the
// resulting Blueprint keeps the unchanged canonical authoring authority.
// ---------------------------------------------------------------------------

const REPLACEMENT_LEDGER_CATEGORIES = [
  'replacement-proposals',
  'replacement-reviews',
  'replacement-authorizations',
] as const;

export interface QaWizardBlueprintReplacementProposalResult {
  proposal: QaWizardBlueprintReplacementProposal;
  proposalPath: string;
  wrote: boolean;
}

export interface QaWizardBlueprintReplacementReviewResult {
  review: QaWizardBlueprintReplacementReview;
  reviewPath: string;
  proposalPath: string;
  wrote: boolean;
}

export interface QaWizardBlueprintReplacementAuthorizationResult {
  authorization: QaWizardBlueprintReplacementAuthorization;
  authorizationPath: string;
  proposalPath: string;
  reviewPath: string;
  successorExecutionDigest: string;
  wrote: boolean;
}

function replacementLedgerArtifactPath(args: {
  repoRoot: string;
  category: (typeof REPLACEMENT_LEDGER_CATEGORIES)[number];
  digest: string;
}): string {
  return relativeArtifactPath({
    repoRoot: args.repoRoot,
    outputDir: QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
    category: args.category,
    fileName: `${args.digest}.json`,
  });
}

function prepareReplacementLedgerDirectories(args: { repoRoot: string }): void {
  const root = ensureContainedDirectory({
    repoRoot: args.repoRoot,
    directoryPath: resolveRepoPath(
      args.repoRoot,
      QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
    ),
  });
  for (const category of REPLACEMENT_LEDGER_CATEGORIES) {
    ensureContainedDirectory({
      repoRoot: args.repoRoot,
      directoryPath: path.join(root, category),
      writable: true,
    });
  }
}

function persistReplacementLedgerArtifact(args: {
  repoRoot: string;
  category: (typeof REPLACEMENT_LEDGER_CATEGORIES)[number];
  digest: string;
  value: object;
  write: boolean;
}): { path: string; created: boolean } {
  const artifactPath = replacementLedgerArtifactPath({
    repoRoot: args.repoRoot,
    category: args.category,
    digest: args.digest,
  });
  const created = args.write
    ? writeImmutableLocalArtifact({
        destinationPath: resolveRepoPath(args.repoRoot, artifactPath),
        bytes: canonicalContentAddressedJsonBytes(args.value),
        hooks: containedPublishHooks({ repoRoot: args.repoRoot }),
      }).created
    : false;
  return { path: artifactPath, created };
}

function loadReplacementLedgerArtifact(args: {
  repoRoot: string;
  category: (typeof REPLACEMENT_LEDGER_CATEGORIES)[number];
  digest: string;
  path: string;
  label: string;
  isValid: (value: unknown) => boolean;
}): Record<string, unknown> {
  const expectedPath = replacementLedgerArtifactPath({
    repoRoot: args.repoRoot,
    category: args.category,
    digest: args.digest,
  });
  if (args.path !== expectedPath) {
    throw new Error(`${args.label} path is noncanonical`);
  }
  const loaded = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath: args.path,
    label: args.label,
  });
  if (
    !args.isValid(loaded.value) ||
    (loaded.value as { digest?: unknown }).digest !== args.digest ||
    path.basename(loaded.absolutePath) !== `${args.digest}.json` ||
    path.basename(path.dirname(loaded.absolutePath)) !== args.category ||
    repoRelativePath(args.repoRoot, loaded.absolutePath) !== expectedPath ||
    loaded.rawBytes !== canonicalContentAddressedJsonBytes(loaded.value)
  ) {
    throw new Error(`${args.label} is stale or invalid`);
  }
  return loaded.value;
}

/**
 * A predecessor-keyed successor slot is the compiler-owned decision that a
 * single predecessor orphan claim authorizes exactly ONE successor execution
 * globally. It is keyed by the predecessor claim digest and records the one
 * canonical successor execution digest. Because it lives in the single global
 * ledger root (not any output tree) and is written immutably, a second approval
 * or execution whose lineage converges on a DIFFERENT successor identity —
 * whether via an alternate proposal, review, approval timestamp or note, or a
 * different output root — collides on the same slot bytes and fails before any
 * provider is reached. Do not rely on the declarative `maxSuccessorExecutions`
 * field or on honest callers.
 */
interface QaWizardBlueprintReplacementAuthorizationSlot {
  version: typeof QA_WIZARD_BLUEPRINT_REPLACEMENT_SLOT_VERSION;
  predecessorClaimDigest: string;
  predecessorClaimPath: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  successorExecutionDigest: string;
  scope: 'single_use_paid_replacement_successor_slot';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

function replacementSlotPath(args: {
  repoRoot: string;
  predecessorClaimDigest: string;
}): string {
  return compilerLedgerArtifactPath({
    repoRoot: args.repoRoot,
    category: 'replacement-authorization-slots',
    authorityDigest: args.predecessorClaimDigest,
  });
}

function replacementSlotIsValid(
  value: unknown,
): value is QaWizardBlueprintReplacementAuthorizationSlot {
  return (
    exactKeys(value, REPLACEMENT_SLOT_KEYS) &&
    value.version === QA_WIZARD_BLUEPRINT_REPLACEMENT_SLOT_VERSION &&
    value.digestAlgorithm === DIGEST_ALGORITHM &&
    [
      value.predecessorClaimDigest,
      value.authoringAuthorityDigest,
      value.requestDigest,
      value.preflightManifestDigest,
      value.successorExecutionDigest,
      value.digest,
    ].every((entry) => typeof entry === 'string' && HEX_SHA256.test(entry)) &&
    typeof value.predecessorClaimPath === 'string' &&
    value.predecessorClaimPath.length > 0 &&
    value.scope === 'single_use_paid_replacement_successor_slot' &&
    value.digest === canonicalJsonDigest(payloadWithoutDigest(value))
  );
}

/**
 * Create-or-verify the immutable predecessor-keyed successor slot. Succeeds
 * silently when the exact same successor is (re)bound; throws before any paid
 * boundary when the predecessor is already bound to a different successor.
 */
function bindReplacementSuccessorSlot(args: {
  repoRoot: string;
  authorization: QaWizardBlueprintReplacementAuthorization;
}): void {
  ensureContainedDirectory({
    repoRoot: args.repoRoot,
    directoryPath: path.join(
      resolveRepoPath(args.repoRoot, QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT),
      'replacement-authorization-slots',
    ),
    writable: true,
  });
  const slot = digestPayload({
    version: QA_WIZARD_BLUEPRINT_REPLACEMENT_SLOT_VERSION,
    predecessorClaimDigest: args.authorization.predecessorClaimDigest,
    predecessorClaimPath: args.authorization.predecessorClaimPath,
    authoringAuthorityDigest: args.authorization.authoringAuthorityDigest,
    requestDigest: args.authorization.requestDigest,
    preflightManifestDigest: args.authorization.preflightManifestDigest,
    successorExecutionDigest: args.authorization.successorExecutionDigest,
    scope: 'single_use_paid_replacement_successor_slot' as const,
  });
  if (!replacementSlotIsValid(slot)) {
    throw new Error('replacement successor slot construction is invalid');
  }
  const slotPath = replacementSlotPath({
    repoRoot: args.repoRoot,
    predecessorClaimDigest: args.authorization.predecessorClaimDigest,
  });
  try {
    writeImmutableLocalArtifact({
      destinationPath: resolveRepoPath(args.repoRoot, slotPath),
      bytes: canonicalContentAddressedJsonBytes(slot),
      hooks: containedPublishHooks({ repoRoot: args.repoRoot }),
    });
  } catch (cause) {
    if (
      cause instanceof Error &&
      /immutable artifact collision/.test(cause.message)
    ) {
      throw new Error(
        'replacement predecessor is already bound to a different successor',
      );
    }
    throw cause;
  }
}

/**
 * Loads and asserts that the predecessor claim named by
 * `authoringAuthorityDigest` is an exact, unresolved orphan: a valid ordinary
 * single-use claim on disk with the exact bytes, and no terminal lookup, no
 * recoverable terminal manifest and no incident. A replacement-shaped
 * predecessor (a successor claim) is rejected as a nested replacement. The
 * predecessor is only read, never mutated.
 */
function loadPredecessorOrphanClaim(args: {
  repoRoot: string;
  outputDir: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
}): {
  claim: QaWizardBlueprintExecutionClaim;
  claimPath: string;
  rawBytes: string;
} {
  const predecessorClaimPath = claimPath({
    repoRoot: args.repoRoot,
    authoringAuthorityDigest: args.authoringAuthorityDigest,
  });
  const absolute = resolveRepoPath(args.repoRoot, predecessorClaimPath);
  if (!fs.existsSync(absolute)) {
    throw new Error('replacement predecessor claim is missing');
  }
  const loaded = readJsonObject({
    repoRoot: args.repoRoot,
    artifactPath: predecessorClaimPath,
    label: 'Blueprint replacement predecessor claim',
  });
  if (blueprintReplacementExecutionClaimIsValid(loaded.value)) {
    throw new Error('replacement of a replacement is not permitted in this milestone');
  }
  if (
    !executionClaimIsValid(loaded.value) ||
    loaded.value.authoringAuthorityDigest !== args.authoringAuthorityDigest ||
    loaded.value.requestDigest !== args.requestDigest ||
    loaded.value.preflightManifestDigest !== args.preflightManifestDigest ||
    path.basename(loaded.absolutePath) !==
      `${args.authoringAuthorityDigest}.json` ||
    path.basename(path.dirname(loaded.absolutePath)) !== 'execution-claims' ||
    repoRelativePath(args.repoRoot, loaded.absolutePath) !==
      predecessorClaimPath ||
    loaded.rawBytes !== canonicalContentAddressedJsonBytes(loaded.value)
  ) {
    throw new Error('replacement predecessor claim is invalid or not the exact authority');
  }
  const gate = {
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    authoringAuthorityDigest: args.authoringAuthorityDigest,
    requestDigest: args.requestDigest,
    preflightManifestDigest: args.preflightManifestDigest,
  } as const;
  if (loadExecutionRecord(gate)) {
    throw new Error('replacement predecessor already has a terminal result');
  }
  // Non-mutating recoverability check: a terminal binding for the predecessor's
  // own identity proves the ordinary lane produced a terminal manifest, so the
  // orphan is recoverable and not eligible for replacement. Using the binding
  // (rather than the mutating recovery) guarantees a `write:false` preparation
  // never writes a recovery lookup as a side effect.
  if (
    loadTerminalBindingForIdentity({
      repoRoot: args.repoRoot,
      authoringAuthorityDigest: args.authoringAuthorityDigest,
      requestDigest: args.requestDigest,
      preflightManifestDigest: args.preflightManifestDigest,
    })
  ) {
    throw new Error('replacement predecessor has a recoverable terminal result');
  }
  // A terminal binding is a Round-2 artifact. A legacy pre-Round-2 crash could
  // publish a terminal manifest with NO binding and NO lookup; ordinary recovery
  // still adopts it, so replacement must reject it too. This read-only census
  // finds such a terminal without mutating disk (safe under write:false) — an
  // exact single recoverable terminal is rejected as recoverable; any ambiguous
  // or torn multi/none-receipt state fails closed rather than authorizing a
  // second paid execution.
  const recoverableTerminal = classifyPredecessorRecoverableTerminal({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    authoringAuthorityDigest: args.authoringAuthorityDigest,
    requestDigest: args.requestDigest,
    preflightManifestDigest: args.preflightManifestDigest,
  });
  if (recoverableTerminal === 'recoverable') {
    throw new Error('replacement predecessor has a recoverable terminal result');
  }
  if (recoverableTerminal === 'ambiguous') {
    throw new Error(
      'replacement predecessor terminal state is ambiguous; not replacement eligible',
    );
  }
  const incident = loadExecutionIncident({
    ...gate,
    claimDigest: loaded.value.digest as string,
    claimPath: predecessorClaimPath,
  });
  if (incident) {
    throw new Error(
      'replacement predecessor already has an incident; operator resolution differs',
    );
  }
  return {
    claim: loaded.value as unknown as QaWizardBlueprintExecutionClaim,
    claimPath: predecessorClaimPath,
    rawBytes: loaded.rawBytes,
  };
}

export function prepareBlueprintReplacementProposal(args: {
  repoRoot: string;
  preflightManifestPath: string;
  outputDir: string;
  reason: string;
  preparedBy: string;
  preparedAt: string;
  write?: boolean;
}): QaWizardBlueprintReplacementProposalResult {
  const preflight = loadQaWizardBlueprintManifestAuthority({
    repoRoot: args.repoRoot,
    manifestPath: args.preflightManifestPath,
  });
  if (preflight.manifest.stage !== 'live_request_preflight_passed') {
    throw new Error('replacement proposal requires a preflight-passed manifest');
  }
  const outputDir = sameOutputDir({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    manifestPath: args.preflightManifestPath,
  });
  const authoringAuthorityDigest = expectedAuthoringAuthorityDigest(
    preflight.context,
  );
  const requestDigest = canonicalJsonDigest(preflight.request);
  const predecessor = loadPredecessorOrphanClaim({
    repoRoot: args.repoRoot,
    outputDir,
    authoringAuthorityDigest,
    requestDigest,
    preflightManifestDigest: preflight.manifest.digest,
  });
  const proposal = buildBlueprintReplacementProposal({
    reason: args.reason,
    predecessor: {
      claimVersion: predecessor.claim.version,
      claimDigest: predecessor.claim.digest,
      claimPath: predecessor.claimPath,
      claimByteLength: Buffer.byteLength(predecessor.rawBytes, 'utf8'),
      claimSha256: createHash('sha256')
        .update(predecessor.rawBytes, 'utf8')
        .digest('hex'),
      authoringAuthorityDigest: predecessor.claim.authoringAuthorityDigest,
      requestDigest: predecessor.claim.requestDigest,
      preflightManifestDigest: predecessor.claim.preflightManifestDigest,
      preflightManifestPath: predecessor.claim.preflightManifestPath,
      requestedAt: predecessor.claim.requestedAt,
    },
    current: {
      authoringAuthorityDigest,
      requestDigest,
      preflightManifestDigest: preflight.manifest.digest,
      preflightManifestPath: preflight.manifestPath,
      outputDir,
      requestId: preflight.request.requestId,
      requestedAt: preflight.request.requestedAt,
    },
    preparedBy: args.preparedBy,
    preparedAt: args.preparedAt,
  });
  if (args.write === true) {
    prepareReplacementLedgerDirectories({ repoRoot: args.repoRoot });
  }
  const persisted = persistReplacementLedgerArtifact({
    repoRoot: args.repoRoot,
    category: 'replacement-proposals',
    digest: proposal.digest,
    value: proposal,
    write: args.write === true,
  });
  return {
    proposal,
    proposalPath: persisted.path,
    wrote: args.write === true,
  };
}

export function reviewBlueprintReplacementProposal(args: {
  repoRoot: string;
  proposalPath: string;
  proposalDigest: string;
  reviewedBy: string;
  reviewedAt: string;
  note?: string;
  write?: boolean;
}): QaWizardBlueprintReplacementReviewResult {
  const proposal = loadReplacementLedgerArtifact({
    repoRoot: args.repoRoot,
    category: 'replacement-proposals',
    digest: args.proposalDigest,
    path: args.proposalPath,
    label: 'Blueprint replacement proposal',
    isValid: blueprintReplacementProposalIsValid,
  }) as unknown as QaWizardBlueprintReplacementProposal;
  const review = buildBlueprintReplacementReview({
    proposal,
    proposalPath: args.proposalPath,
    reviewedBy: args.reviewedBy,
    reviewedAt: args.reviewedAt,
    ...(args.note ? { note: args.note } : {}),
  });
  if (args.write === true) {
    prepareReplacementLedgerDirectories({ repoRoot: args.repoRoot });
  }
  const persisted = persistReplacementLedgerArtifact({
    repoRoot: args.repoRoot,
    category: 'replacement-reviews',
    digest: review.digest,
    value: review,
    write: args.write === true,
  });
  return {
    review,
    reviewPath: persisted.path,
    proposalPath: args.proposalPath,
    wrote: args.write === true,
  };
}

export function approveBlueprintReplacementProposal(args: {
  repoRoot: string;
  proposalPath: string;
  proposalDigest: string;
  reviewPath: string;
  reviewDigest: string;
  approvedBy: typeof QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER;
  approvedAt: string;
  note?: string;
  write?: boolean;
}): QaWizardBlueprintReplacementAuthorizationResult {
  if (args.approvedBy !== QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER) {
    throw new Error('replacement authorization is restricted to exact approver "Guy"');
  }
  const proposal = loadReplacementLedgerArtifact({
    repoRoot: args.repoRoot,
    category: 'replacement-proposals',
    digest: args.proposalDigest,
    path: args.proposalPath,
    label: 'Blueprint replacement proposal',
    isValid: blueprintReplacementProposalIsValid,
  }) as unknown as QaWizardBlueprintReplacementProposal;
  const review = loadReplacementLedgerArtifact({
    repoRoot: args.repoRoot,
    category: 'replacement-reviews',
    digest: args.reviewDigest,
    path: args.reviewPath,
    label: 'Blueprint replacement review',
    isValid: blueprintReplacementReviewIsValid,
  }) as unknown as QaWizardBlueprintReplacementReview;
  if (
    review.proposalDigest !== proposal.digest ||
    review.proposalPath !== args.proposalPath
  ) {
    throw new Error('replacement review is not bound to this proposal');
  }
  const authorization = buildBlueprintReplacementAuthorization({
    proposal,
    proposalPath: args.proposalPath,
    review,
    reviewPath: args.reviewPath,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
    ...(args.note ? { note: args.note } : {}),
  });
  if (args.write === true) {
    prepareReplacementLedgerDirectories({ repoRoot: args.repoRoot });
    // Bind the single global successor slot at approval time — the earliest
    // fence. A conflicting second approval fails here before any competing
    // authorization is persisted.
    bindReplacementSuccessorSlot({ repoRoot: args.repoRoot, authorization });
  }
  const persisted = persistReplacementLedgerArtifact({
    repoRoot: args.repoRoot,
    category: 'replacement-authorizations',
    digest: authorization.digest,
    value: authorization,
    write: args.write === true,
  });
  return {
    authorization,
    authorizationPath: persisted.path,
    proposalPath: args.proposalPath,
    reviewPath: args.reviewPath,
    successorExecutionDigest: authorization.successorExecutionDigest,
    wrote: args.write === true,
  };
}

function loadValidatedReplacementAuthorization(args: {
  repoRoot: string;
  authorizationPath: string;
  authorizationDigest: string;
}): QaWizardBlueprintReplacementAuthorization {
  const authorization = loadReplacementLedgerArtifact({
    repoRoot: args.repoRoot,
    category: 'replacement-authorizations',
    digest: args.authorizationDigest,
    path: args.authorizationPath,
    label: 'Blueprint replacement authorization',
    isValid: blueprintReplacementAuthorizationIsValid,
  }) as unknown as QaWizardBlueprintReplacementAuthorization;
  const proposal = loadReplacementLedgerArtifact({
    repoRoot: args.repoRoot,
    category: 'replacement-proposals',
    digest: authorization.proposalDigest,
    path: authorization.proposalPath,
    label: 'Blueprint replacement proposal',
    isValid: blueprintReplacementProposalIsValid,
  }) as unknown as QaWizardBlueprintReplacementProposal;
  const review = loadReplacementLedgerArtifact({
    repoRoot: args.repoRoot,
    category: 'replacement-reviews',
    digest: authorization.reviewDigest,
    path: authorization.reviewPath,
    label: 'Blueprint replacement review',
    isValid: blueprintReplacementReviewIsValid,
  }) as unknown as QaWizardBlueprintReplacementReview;
  const recomputed = blueprintReplacementSuccessorExecutionDigest({
    proposalDigest: proposal.digest,
    reviewDigest: review.digest,
    approvedBy: authorization.approvedBy,
    approvedAt: authorization.approvedAt,
    predecessorClaimDigest: proposal.predecessor.claimDigest,
    authoringAuthorityDigest: proposal.current.authoringAuthorityDigest,
  });
  if (
    review.proposalDigest !== proposal.digest ||
    // The creation path binds review to the proposal PATH as well as its
    // digest; the reload must re-derive that same relation so a manually
    // written cross-lineage review whose digest matches but whose proposalPath
    // points elsewhere is rejected.
    review.proposalPath !== authorization.proposalPath ||
    proposal.digest !== authorization.proposalDigest ||
    review.digest !== authorization.reviewDigest ||
    authorization.authoringAuthorityDigest !==
      proposal.current.authoringAuthorityDigest ||
    authorization.requestDigest !== proposal.current.requestDigest ||
    authorization.preflightManifestDigest !==
      proposal.current.preflightManifestDigest ||
    authorization.predecessorClaimDigest !== proposal.predecessor.claimDigest ||
    authorization.predecessorClaimPath !== proposal.predecessor.claimPath ||
    authorization.successorExecutionDigest !== recomputed ||
    // Canonical time ordering is authority, not just a constructor courtesy.
    // The builders enforce reviewedAt >= preparedAt and approvedAt >= reviewedAt,
    // but individually self-valid content-addressed artifacts with hand-inverted
    // timestamps and recomputed digests would otherwise reach execution. Every
    // authority-bearing reload must re-derive both relations. Canonical UTC
    // millisecond timestamps compare lexically as chronologically, and each
    // field is validated as canonical UTC by the artifact validators above.
    review.reviewedAt < proposal.preparedAt ||
    authorization.approvedAt < review.reviewedAt
  ) {
    throw new Error('replacement authorization lineage is inconsistent or tampered');
  }
  return authorization;
}

export async function executeBlueprintReplacementLiveRequest(
  args: {
    repoRoot: string;
    authorizationPath: string;
    authorizationDigest: string;
    preflightManifestPath: string;
    outputDir: string;
    write: true;
  },
  deps: QaWizardBlueprintExecutionDependencies = {},
): Promise<QaWizardBlueprintExecutionResult> {
  if (args.write !== true) {
    throw new Error('execute-replacement requires write=true');
  }
  const authorization = loadValidatedReplacementAuthorization({
    repoRoot: args.repoRoot,
    authorizationPath: args.authorizationPath,
    authorizationDigest: args.authorizationDigest,
  });
  // Lane-exact claim matcher: a stored replacement claim is only valid when its
  // embedded authorization/proposal/review/predecessor lineage equals THIS
  // loaded authorization. A different self-consistent authorization that
  // converges on the same successor identity (e.g. note-only differences)
  // therefore cannot replay or cross-bind another authorization's terminal.
  const replacementClaimMatchesAuthorization = (value: unknown): boolean => {
    if (!blueprintReplacementExecutionClaimIsValid(value)) return false;
    return (
      value.executionIdentityDigest ===
        authorization.successorExecutionDigest &&
      value.authoringAuthorityDigest ===
        authorization.authoringAuthorityDigest &&
      value.requestDigest === authorization.requestDigest &&
      value.preflightManifestDigest ===
        authorization.preflightManifestDigest &&
      value.replacement.authorizationDigest === authorization.digest &&
      value.replacement.authorizationPath === args.authorizationPath &&
      value.replacement.proposalDigest === authorization.proposalDigest &&
      value.replacement.reviewDigest === authorization.reviewDigest &&
      value.replacement.predecessorClaimDigest ===
        authorization.predecessorClaimDigest &&
      value.replacement.predecessorClaimPath ===
        authorization.predecessorClaimPath
    );
  };
  const binding: BlueprintExecutionClaimBinding = {
    executionIdentity: () => authorization.successorExecutionDigest,
    claimIsValid: replacementClaimMatchesAuthorization,
    buildClaim: (ctx) =>
      buildBlueprintReplacementExecutionClaim({
        authorization,
        authorizationPath: args.authorizationPath,
        requestedAt: ctx.preflight.request.requestedAt,
        preflightManifestPath: ctx.preflight.manifestPath,
      }),
    precheck: (ctx) => {
      // The preflight manifest is content-addressed, so an exact digest match
      // binds this successor to the exact current preflight/request/story and
      // rejects any cross-preflight, cross-request or cross-story attempt.
      if (
        authorization.authoringAuthorityDigest !==
          ctx.authoringAuthorityDigest ||
        authorization.requestDigest !== ctx.requestDigest ||
        authorization.preflightManifestDigest !== ctx.preflight.manifest.digest
      ) {
        throw new Error('replacement authorization does not match the current preflight');
      }
      // The predecessor must remain an exact unresolved orphan at execute time,
      // so a concurrent resolution cannot be double-dispatched.
      loadPredecessorOrphanClaim({
        repoRoot: ctx.repoRoot,
        outputDir: ctx.outputDir,
        authoringAuthorityDigest: ctx.authoringAuthorityDigest,
        requestDigest: ctx.requestDigest,
        preflightManifestDigest: ctx.preflight.manifest.digest,
      });
      // Global single-successor fence, before the claim and any provider: one
      // predecessor claim digest authorizes exactly one successor identity.
      bindReplacementSuccessorSlot({
        repoRoot: ctx.repoRoot,
        authorization,
      });
    },
  };
  return runBlueprintExecutionUnderClaim(args, binding, deps);
}

function assertImmutableBytesCompatible(args: {
  repoRoot: string;
  destinationPath: string;
  bytes: string;
  label: string;
}): void {
  if (!fs.existsSync(args.destinationPath)) return;
  const loaded = readUniqueContainedUtf8({
    repoRoot: args.repoRoot,
    artifactPath: repoRelativePath(args.repoRoot, args.destinationPath),
    label: args.label,
  });
  if (loaded.rawBytes !== args.bytes) {
    throw new Error(`${args.label} conflicts with existing immutable bytes`);
  }
}

function assertSingleApprovalInventory(args: {
  repoRoot: string;
  approvalPath: string;
}): void {
  const directory = path.dirname(args.approvalPath);
  if (!fs.existsSync(directory)) return;
  ensureContainedDirectory({
    repoRoot: args.repoRoot,
    directoryPath: directory,
  });
  const entries = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.name.endsWith('.json'))
    .map((entry) => path.join(directory, entry.name));
  for (const entry of entries) {
    readUniqueContainedUtf8({
      repoRoot: args.repoRoot,
      artifactPath: repoRelativePath(args.repoRoot, entry),
      label: 'Blueprint approval inventory entry',
    });
  }
  if (
    entries.some(
      (entry) => normalizedAbsolute(entry) !== normalizedAbsolute(args.approvalPath),
    )
  ) {
    throw new Error('Blueprint candidate already has a different approval');
  }
}

function buildApprovalDecision(args: {
  candidate: LoadedQaWizardBlueprintManifest;
  approval: ManifestApprovalAuthority;
  approvedManifest: QaWizardBlueprintAuthoringManifest;
  approvedManifestPath: string;
  note: string | null;
}): QaWizardBlueprintApprovalDecision {
  return digestPayload({
    version: QA_WIZARD_BLUEPRINT_APPROVAL_DECISION_VERSION,
    candidateManifestDigest: args.candidate.manifest.digest,
    candidateManifestPath: args.candidate.manifestPath,
    blueprintDigest: args.candidate.manifest.blueprint!.blueprintDigest,
    authoringAuthorityDigest:
      args.candidate.manifest.blueprint!.authoringAuthorityDigest,
    reviewPacketDigest: args.candidate.manifest.blueprint!.reviewPacketDigest,
    approvalDigest: args.approval.digest,
    approvalPath: args.approval.path,
    approvedManifestDigest: args.approvedManifest.digest,
    approvedManifestPath: args.approvedManifestPath,
    approvedBy: args.approval.approvedBy,
    approvedAt: args.approval.approvedAt,
    note: args.note,
    scope: 'single_blueprint_approval_decision' as const,
  });
}

function approvalDecisionIsValid(
  value: unknown,
): value is QaWizardBlueprintApprovalDecision {
  return (
    exactKeys(value, APPROVAL_DECISION_KEYS) &&
    value.version === QA_WIZARD_BLUEPRINT_APPROVAL_DECISION_VERSION &&
    value.digestAlgorithm === DIGEST_ALGORITHM &&
    [
      value.candidateManifestDigest,
      value.blueprintDigest,
      value.authoringAuthorityDigest,
      value.reviewPacketDigest,
      value.approvalDigest,
      value.approvedManifestDigest,
      value.digest,
    ].every((entry) => typeof entry === 'string' && HEX_SHA256.test(entry)) &&
    [
      value.candidateManifestPath,
      value.approvalPath,
      value.approvedManifestPath,
    ].every((entry) => typeof entry === 'string' && entry.length > 0) &&
    value.approvedBy === PRE_RENDER_BLUEPRINT_APPROVER &&
    canonicalUtcTimestampIsValid(value.approvedAt) &&
    (value.note === null || typeof value.note === 'string') &&
    value.scope === 'single_blueprint_approval_decision' &&
    value.digest === canonicalJsonDigest(payloadWithoutDigest(value))
  );
}

export function recordQaWizardBlueprintApproval(
  args: {
    repoRoot: string;
    candidateManifestPath: string;
    outputDir: string;
    expectedBlueprintDigest: string;
    expectedAuthoringAuthorityDigest: string;
    expectedReviewPacketDigest: string;
    approvedBy: typeof PRE_RENDER_BLUEPRINT_APPROVER;
    approvedAt: string;
    note?: string;
    write?: boolean;
  },
  deps: Pick<QaWizardBlueprintExecutionDependencies, 'hooks'> = {},
): QaWizardBlueprintApprovalResult {
  if (args.approvedBy !== PRE_RENDER_BLUEPRINT_APPROVER) {
    throw new Error('Blueprint approval is restricted to exact approver "Guy"');
  }
  if (!canonicalUtcTimestampIsValid(args.approvedAt)) {
    throw new Error('approvedAt must be canonical UTC with millisecond precision');
  }
  const candidate = loadQaWizardBlueprintManifestAuthority({
    repoRoot: args.repoRoot,
    manifestPath: args.candidateManifestPath,
  });
  if (
    candidate.manifest.stage !== 'blueprint_candidate' ||
    !candidate.manifest.blueprint ||
    !candidate.blueprint ||
    !candidate.reviewPacket
  ) {
    throw new Error('Blueprint approval requires a complete candidate manifest');
  }
  const outputDir = sameOutputDir({
    repoRoot: args.repoRoot,
    outputDir: args.outputDir,
    manifestPath: args.candidateManifestPath,
  });
  if (
    args.expectedBlueprintDigest !==
      candidate.manifest.blueprint.blueprintDigest ||
    args.expectedAuthoringAuthorityDigest !==
      candidate.manifest.blueprint.authoringAuthorityDigest ||
    args.expectedReviewPacketDigest !==
      candidate.manifest.blueprint.reviewPacketDigest
  ) {
    throw new Error('Blueprint approval expected digests do not match the candidate');
  }
  const lifecycleRoot = path.join(
    resolveRepoPath(args.repoRoot, outputDir),
    'blueprint-lifecycle',
  );
  const planned = planPreRenderBlueprintApprovalAttestation({
    root: lifecycleRoot,
    blueprint: candidate.blueprint,
    context: candidate.context.validationContext,
    reviewPacket: candidate.reviewPacket,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
    ...(args.note ? { note: args.note } : {}),
  });
  const approvalPath = repoRelativePath(args.repoRoot, planned.approvalPath);
  const approvalAuthority: ManifestApprovalAuthority = {
    version: planned.attestation.version,
    digest: planned.attestation.digest,
    path: approvalPath,
    approvedBy: planned.attestation.approvedBy,
    approvedAt: planned.attestation.approvedAt,
  };
  const approvedManifest = buildManifest({
    version: QA_WIZARD_BLUEPRINT_AUTHORING_MANIFEST_VERSION,
    stage: 'blueprint_approved',
    predecessor: predecessorAuthority({
      manifest: candidate.manifest,
      manifestPath: candidate.manifestPath,
    }),
    bridge: candidate.manifest.bridge,
    context: candidate.manifest.context,
    request: candidate.manifest.request,
    receipt: candidate.manifest.receipt,
    blueprint: candidate.manifest.blueprint,
    approval: approvalAuthority,
    doesNotAuthorize: [...AFTER_APPROVAL_EXCLUSIONS],
  });
  const approvedManifestPath = relativeArtifactPath({
    repoRoot: args.repoRoot,
    outputDir,
    category: 'blueprint-authoring-manifests',
    fileName: `${approvedManifest.digest}.json`,
  });
  const decision = buildApprovalDecision({
    candidate,
    approval: approvalAuthority,
    approvedManifest,
    approvedManifestPath,
    note: planned.attestation.note ?? null,
  });
  if (!approvalDecisionIsValid(decision)) {
    throw new Error('Blueprint approval decision construction is invalid');
  }
  const decisionPath = approvalDecisionPath({
    repoRoot: args.repoRoot,
    blueprintDigest: candidate.blueprint.digest,
  });
  assertSingleApprovalInventory({
    repoRoot: args.repoRoot,
    approvalPath: planned.approvalPath,
  });
  assertImmutableBytesCompatible({
    repoRoot: args.repoRoot,
    destinationPath: planned.approvalPath,
    bytes: preRenderBlueprintLifecycleJsonBytes(planned.attestation),
    label: 'Blueprint approval',
  });
  assertImmutableBytesCompatible({
    repoRoot: args.repoRoot,
    destinationPath: resolveRepoPath(args.repoRoot, approvedManifestPath),
    bytes: canonicalContentAddressedJsonBytes(approvedManifest),
    label: 'approved Blueprint manifest',
  });
  assertImmutableBytesCompatible({
    repoRoot: args.repoRoot,
    destinationPath: resolveRepoPath(args.repoRoot, decisionPath),
    bytes: canonicalContentAddressedJsonBytes(decision),
    label: 'Blueprint approval decision',
  });
  if (args.write === true) {
    prepareBlueprintOperatorOutputRoot({
      repoRoot: args.repoRoot,
      outputDir,
    });
    prepareCompilerOwnedLedger({ repoRoot: args.repoRoot });
    prepareBlueprintLifecycleAuthorityDirectories({
      repoRoot: args.repoRoot,
      outputDir,
      authoringAuthorityDigest:
        candidate.blueprint.identity.authoringAuthority.digest,
      blueprintDigest: candidate.blueprint.digest,
      reviewPacketDigest: candidate.reviewPacket.digest,
    });
    try {
      writeImmutableLocalArtifact({
        destinationPath: resolveRepoPath(args.repoRoot, decisionPath),
        bytes: canonicalContentAddressedJsonBytes(decision),
        hooks: containedPublishHooks({ repoRoot: args.repoRoot }),
      });
    } catch (cause) {
      const error = new Error('Blueprint candidate already has a different approval decision');
      (error as Error & { cause?: unknown }).cause = cause;
      throw error;
    }
    deps.hooks?.afterApprovalDecision?.();
    writeImmutableLocalArtifact({
      destinationPath: planned.approvalPath,
      bytes: preRenderBlueprintLifecycleJsonBytes(planned.attestation),
      hooks: containedPublishHooks({ repoRoot: args.repoRoot }),
    });
    persistManifest({
      repoRoot: args.repoRoot,
      outputDir,
      manifest: approvedManifest,
      write: true,
    });
  }
  return {
    manifest: approvedManifest,
    manifestPath: approvedManifestPath,
    attestation: planned.attestation,
    approvalPath,
    wrote: args.write === true,
  };
}
