import { canonicalJsonDigest } from './integrity';

/**
 * Minimal one-shot authority for a new attributable sample after a frozen v7/v3
 * failed terminal. It is not a retry policy and it does not promise to reproduce
 * the predecessor's nondeterministic provider draft.
 */
export const QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_CANDIDATE_VERSION =
  'qa-wizard-blueprint-diagnostic-successor-candidate/v1' as const;
export const QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_AUTHORIZATION_VERSION =
  'qa-wizard-blueprint-diagnostic-successor-authorization/v1' as const;
export const QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_EXECUTION_CLAIM_VERSION =
  'qa-wizard-blueprint-diagnostic-successor-execution-claim/v1' as const;
export const QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_APPROVER = 'Guy' as const;
export const QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_REASON =
  'legacy_v7_v3_missing_per_attempt_attribution' as const;
export const QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_MAX_EXECUTIONS = 1 as const;

// Frozen v1 wire identities. Pure validation of persisted v1 candidate and
// authorization bytes does not follow mutable producer aliases. First dispatch
// separately proves that the live producers still emit these exact versions;
// operational terminal replay remains governed by the shared legacy registry.
export const QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_REQUEST_VERSION =
  'production-blueprint-authoring-request/v5' as const;
export const QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_RECEIPT_VERSION =
  'production-blueprint-authoring-receipt/v7' as const;
export const QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_CAPTURE_VERSION =
  'blueprint-authoring-sanitized-failure-capture/v3' as const;
export const QA_WIZARD_BLUEPRINT_DIAGNOSTIC_TARGET_RECEIPT_VERSION =
  'production-blueprint-authoring-receipt/v8' as const;
export const QA_WIZARD_BLUEPRINT_DIAGNOSTIC_TARGET_CAPTURE_VERSION =
  'blueprint-authoring-sanitized-failure-capture/v4' as const;
export const QA_WIZARD_BLUEPRINT_DIAGNOSTIC_TARGET_CENSUS_VERSION =
  'blueprint-authoring-diagnostic-census-commitment/v1' as const;

const ORDINARY_EXECUTION_CLAIM_VERSION =
  'qa-wizard-blueprint-execution-claim/v2' as const;
const EXECUTION_RECORD_VERSION = 'qa-wizard-blueprint-execution-record/v1' as const;
const TERMINAL_BINDING_VERSION = 'qa-wizard-blueprint-terminal-binding/v1' as const;
const AUTHORING_MANIFEST_VERSION = 'qa-wizard-blueprint-authoring-manifest/v1' as const;
const EVIDENCE_TARGET_VERSION =
  'qa-wizard-blueprint-diagnostic-evidence-target/v1' as const;
const SUCCESSOR_IDENTITY_MARKER =
  'qa-wizard-blueprint-diagnostic-successor-execution-identity/v1' as const;
const DIGEST_ALGORITHM = 'canonical-json-sha256' as const;
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const CANONICAL_UTC_MILLISECONDS =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const QA_WIZARD_BLUEPRINT_DIAGNOSTIC_EVIDENCE_TARGET_DIGEST =
  canonicalJsonDigest({
    version: EVIDENCE_TARGET_VERSION,
    receiptVersion: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_TARGET_RECEIPT_VERSION,
    captureVersion: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_TARGET_CAPTURE_VERSION,
    censusCommitmentVersion: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_TARGET_CENSUS_VERSION,
    attribution: 'ordered_complete_per_attempt',
  });

export interface QaWizardBlueprintDiagnosticSuccessorLineage {
  executionIdentityDigest: string;
  authoringAuthorityDigest: string;
  executionProgramDigest: string;
  requestVersion: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_REQUEST_VERSION;
  requestDigest: string;
  requestPath: string;
  requestId: string;
  requestedAt: string;
  preflightManifestVersion: typeof AUTHORING_MANIFEST_VERSION;
  preflightManifestDigest: string;
  preflightManifestPath: string;
  outputDir: string;
  claimVersion: typeof ORDINARY_EXECUTION_CLAIM_VERSION;
  claimDigest: string;
  claimPath: string;
  terminalLookupVersion: typeof EXECUTION_RECORD_VERSION;
  terminalLookupDigest: string;
  terminalLookupPath: string;
  terminalBindingVersion: typeof TERMINAL_BINDING_VERSION;
  terminalBindingDigest: string;
  terminalBindingPath: string;
  terminalManifestVersion: typeof AUTHORING_MANIFEST_VERSION;
  terminalManifestDigest: string;
  terminalManifestPath: string;
  receiptVersion: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_RECEIPT_VERSION;
  receiptDigest: string;
  receiptPath: string;
  captureVersion: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_CAPTURE_VERSION;
  captureDigest: string;
  capturePath: string;
  terminalFailureCode: 'draft_validation_repair_exhausted';
  callCount: 3;
  repairCount: 2;
}

export interface QaWizardBlueprintDiagnosticSuccessorCandidate
  extends QaWizardBlueprintDiagnosticSuccessorLineage {
  version: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_CANDIDATE_VERSION;
  reason: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_REASON;
  evidenceTargetDigest: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_EVIDENCE_TARGET_DIGEST;
  maxSuccessorExecutions: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_MAX_EXECUTIONS;
  preparedBy: string;
  preparedAt: string;
  scope: 'single_use_paid_blueprint_diagnostic_successor_candidate';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface QaWizardBlueprintDiagnosticSuccessorAuthorization {
  version: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_AUTHORIZATION_VERSION;
  candidateDigest: string;
  candidatePath: string;
  predecessorExecutionIdentityDigest: string;
  predecessorTerminalManifestDigest: string;
  authoringAuthorityDigest: string;
  executionProgramDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  preflightManifestPath: string;
  outputDir: string;
  requestId: string;
  requestedAt: string;
  evidenceTargetDigest: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_EVIDENCE_TARGET_DIGEST;
  successorExecutionDigest: string;
  maxSuccessorExecutions: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_MAX_EXECUTIONS;
  approvedBy: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_APPROVER;
  approvedAt: string;
  scope: 'single_use_paid_blueprint_diagnostic_successor_authorization';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface QaWizardBlueprintDiagnosticSuccessorExecutionClaim {
  version: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_EXECUTION_CLAIM_VERSION;
  authoringAuthorityDigest: string;
  executionProgramDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  preflightManifestPath: string;
  requestedAt: string;
  executionIdentityDigest: string;
  diagnosticSuccessor: {
    authorizationDigest: string;
    authorizationPath: string;
    candidateDigest: string;
    predecessorExecutionIdentityDigest: string;
    predecessorTerminalManifestDigest: string;
    evidenceTargetDigest: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_EVIDENCE_TARGET_DIGEST;
  };
  scope: 'single_use_paid_diagnostic_successor_blueprint_authoring';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

const LINEAGE_KEYS = [
  'authoringAuthorityDigest', 'callCount', 'captureDigest', 'capturePath',
  'captureVersion', 'claimDigest', 'claimPath', 'claimVersion',
  'executionIdentityDigest', 'executionProgramDigest', 'outputDir',
  'preflightManifestDigest', 'preflightManifestPath', 'preflightManifestVersion',
  'receiptDigest', 'receiptPath', 'receiptVersion', 'repairCount', 'requestDigest',
  'requestId', 'requestPath', 'requestVersion', 'requestedAt',
  'terminalBindingDigest', 'terminalBindingPath', 'terminalBindingVersion',
  'terminalFailureCode', 'terminalLookupDigest', 'terminalLookupPath',
  'terminalLookupVersion', 'terminalManifestDigest', 'terminalManifestPath',
  'terminalManifestVersion',
] as const;
const CANDIDATE_KEYS = [
  ...LINEAGE_KEYS, 'digest', 'digestAlgorithm', 'evidenceTargetDigest',
  'maxSuccessorExecutions', 'preparedAt', 'preparedBy', 'reason', 'scope',
  'version',
] as const;
const AUTHORIZATION_KEYS = [
  'approvedAt', 'approvedBy', 'authoringAuthorityDigest', 'candidateDigest',
  'candidatePath', 'digest', 'digestAlgorithm', 'evidenceTargetDigest',
  'executionProgramDigest', 'maxSuccessorExecutions', 'outputDir',
  'predecessorExecutionIdentityDigest', 'predecessorTerminalManifestDigest',
  'preflightManifestDigest', 'preflightManifestPath', 'requestDigest', 'requestId',
  'requestedAt', 'scope', 'successorExecutionDigest', 'version',
] as const;
const CLAIM_KEYS = [
  'authoringAuthorityDigest', 'diagnosticSuccessor', 'digest', 'digestAlgorithm',
  'executionIdentityDigest', 'executionProgramDigest', 'preflightManifestDigest',
  'preflightManifestPath', 'requestDigest', 'requestedAt', 'scope', 'version',
] as const;
const CLAIM_LINEAGE_KEYS = [
  'authorizationDigest', 'authorizationPath', 'candidateDigest',
  'evidenceTargetDigest', 'predecessorExecutionIdentityDigest',
  'predecessorTerminalManifestDigest',
] as const;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  return record(value) && JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort());
}

function hex(value: unknown): value is string {
  return typeof value === 'string' && HEX_SHA256.test(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function canonicalUtc(value: unknown): value is string {
  if (typeof value !== 'string' || !CANONICAL_UTC_MILLISECONDS.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function payloadWithoutDigest(value: Record<string, unknown>): Record<string, unknown> {
  const { digestAlgorithm: _algorithm, digest: _digest, ...payload } = value;
  return payload;
}

function digestPayload<T extends object>(payload: T): T & {
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
} {
  return { ...payload, digestAlgorithm: DIGEST_ALGORITHM, digest: canonicalJsonDigest(payload) };
}

export function blueprintDiagnosticSuccessorLineageIsValid(
  value: unknown,
): value is QaWizardBlueprintDiagnosticSuccessorLineage {
  if (!exactKeys(value, LINEAGE_KEYS)) return false;
  return (
    [
      value.executionIdentityDigest, value.authoringAuthorityDigest,
      value.executionProgramDigest, value.requestDigest, value.preflightManifestDigest,
      value.claimDigest, value.terminalLookupDigest, value.terminalBindingDigest,
      value.terminalManifestDigest, value.receiptDigest, value.captureDigest,
    ].every(hex) &&
    [
      value.requestPath, value.requestId, value.preflightManifestPath, value.outputDir,
      value.claimPath, value.terminalLookupPath, value.terminalBindingPath,
      value.terminalManifestPath, value.receiptPath, value.capturePath,
    ].every(nonEmpty) &&
    canonicalUtc(value.requestedAt) &&
    value.requestVersion ===
      QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_REQUEST_VERSION &&
    value.preflightManifestVersion === AUTHORING_MANIFEST_VERSION &&
    value.claimVersion === ORDINARY_EXECUTION_CLAIM_VERSION &&
    value.terminalLookupVersion === EXECUTION_RECORD_VERSION &&
    value.terminalBindingVersion === TERMINAL_BINDING_VERSION &&
    value.terminalManifestVersion === AUTHORING_MANIFEST_VERSION &&
    value.receiptVersion ===
      QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_RECEIPT_VERSION &&
    value.captureVersion ===
      QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_CAPTURE_VERSION &&
    value.terminalFailureCode === 'draft_validation_repair_exhausted' &&
    value.callCount === 3 && value.repairCount === 2
  );
}

export function buildBlueprintDiagnosticSuccessorCandidate(args: {
  lineage: QaWizardBlueprintDiagnosticSuccessorLineage;
  preparedBy: string;
  preparedAt: string;
}): QaWizardBlueprintDiagnosticSuccessorCandidate {
  if (!blueprintDiagnosticSuccessorLineageIsValid(args.lineage)) {
    throw new Error('diagnostic successor lineage is invalid');
  }
  if (
    !nonEmpty(args.preparedBy) ||
    !canonicalUtc(args.preparedAt) ||
    args.preparedAt < args.lineage.requestedAt
  ) {
    throw new Error('diagnostic successor preparation identity is invalid');
  }
  const candidate = digestPayload({
    version: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_CANDIDATE_VERSION,
    reason: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_REASON,
    ...args.lineage,
    evidenceTargetDigest: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_EVIDENCE_TARGET_DIGEST,
    maxSuccessorExecutions: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_MAX_EXECUTIONS,
    preparedBy: args.preparedBy,
    preparedAt: args.preparedAt,
    scope: 'single_use_paid_blueprint_diagnostic_successor_candidate' as const,
  });
  if (!blueprintDiagnosticSuccessorCandidateIsValid(candidate)) {
    throw new Error('diagnostic successor candidate construction is invalid');
  }
  return candidate;
}

export function blueprintDiagnosticSuccessorCandidateIsValid(
  value: unknown,
): value is QaWizardBlueprintDiagnosticSuccessorCandidate {
  if (!exactKeys(value, CANDIDATE_KEYS)) return false;
  const lineage = Object.fromEntries(
    LINEAGE_KEYS.map((key) => [key, value[key]]),
  );
  return (
    value.version === QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_CANDIDATE_VERSION &&
    value.reason === QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_REASON &&
    blueprintDiagnosticSuccessorLineageIsValid(lineage) &&
    value.evidenceTargetDigest === QA_WIZARD_BLUEPRINT_DIAGNOSTIC_EVIDENCE_TARGET_DIGEST &&
    value.maxSuccessorExecutions ===
      QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_MAX_EXECUTIONS &&
    nonEmpty(value.preparedBy) && canonicalUtc(value.preparedAt) &&
    typeof value.requestedAt === 'string' &&
    value.preparedAt >= value.requestedAt &&
    value.scope === 'single_use_paid_blueprint_diagnostic_successor_candidate' &&
    value.digestAlgorithm === DIGEST_ALGORITHM && hex(value.digest) &&
    value.digest === canonicalJsonDigest(payloadWithoutDigest(value))
  );
}

export function blueprintDiagnosticSuccessorExecutionDigest(args: {
  candidate: QaWizardBlueprintDiagnosticSuccessorCandidate;
  approvedBy: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_APPROVER;
  approvedAt: string;
}): string {
  if (
    !blueprintDiagnosticSuccessorCandidateIsValid(args.candidate) ||
    args.approvedBy !== QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_APPROVER ||
    !canonicalUtc(args.approvedAt)
  ) throw new Error('diagnostic successor execution identity inputs are invalid');
  return canonicalJsonDigest({
    marker: SUCCESSOR_IDENTITY_MARKER,
    candidateDigest: args.candidate.digest,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
    predecessorExecutionIdentityDigest: args.candidate.executionIdentityDigest,
    predecessorTerminalManifestDigest: args.candidate.terminalManifestDigest,
    evidenceTargetDigest: args.candidate.evidenceTargetDigest,
  });
}

export function buildBlueprintDiagnosticSuccessorAuthorization(args: {
  candidate: QaWizardBlueprintDiagnosticSuccessorCandidate;
  candidatePath: string;
  approvedBy: typeof QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_APPROVER;
  approvedAt: string;
}): QaWizardBlueprintDiagnosticSuccessorAuthorization {
  if (!blueprintDiagnosticSuccessorCandidateIsValid(args.candidate) || !nonEmpty(args.candidatePath)) {
    throw new Error('diagnostic successor authorization candidate is invalid');
  }
  if (
    args.approvedBy !== QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_APPROVER ||
    !canonicalUtc(args.approvedAt) || args.approvedAt < args.candidate.preparedAt
  ) throw new Error('diagnostic successor authorization approval is invalid');
  const successorExecutionDigest = blueprintDiagnosticSuccessorExecutionDigest({
    candidate: args.candidate, approvedBy: args.approvedBy, approvedAt: args.approvedAt,
  });
  const authorization = digestPayload({
    version: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_AUTHORIZATION_VERSION,
    candidateDigest: args.candidate.digest,
    candidatePath: args.candidatePath,
    predecessorExecutionIdentityDigest: args.candidate.executionIdentityDigest,
    predecessorTerminalManifestDigest: args.candidate.terminalManifestDigest,
    authoringAuthorityDigest: args.candidate.authoringAuthorityDigest,
    executionProgramDigest: args.candidate.executionProgramDigest,
    requestDigest: args.candidate.requestDigest,
    preflightManifestDigest: args.candidate.preflightManifestDigest,
    preflightManifestPath: args.candidate.preflightManifestPath,
    outputDir: args.candidate.outputDir,
    requestId: args.candidate.requestId,
    requestedAt: args.candidate.requestedAt,
    evidenceTargetDigest: args.candidate.evidenceTargetDigest,
    successorExecutionDigest,
    maxSuccessorExecutions: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_MAX_EXECUTIONS,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
    scope: 'single_use_paid_blueprint_diagnostic_successor_authorization' as const,
  });
  if (!blueprintDiagnosticSuccessorAuthorizationIsValid(authorization)) {
    throw new Error('diagnostic successor authorization construction is invalid');
  }
  return authorization;
}

export function blueprintDiagnosticSuccessorAuthorizationIsValid(
  value: unknown,
): value is QaWizardBlueprintDiagnosticSuccessorAuthorization {
  return exactKeys(value, AUTHORIZATION_KEYS) &&
    value.version === QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_AUTHORIZATION_VERSION &&
    [
      value.candidateDigest, value.predecessorExecutionIdentityDigest,
      value.predecessorTerminalManifestDigest, value.authoringAuthorityDigest,
      value.executionProgramDigest, value.requestDigest, value.preflightManifestDigest,
      value.successorExecutionDigest, value.digest,
    ].every(hex) &&
    [value.candidatePath, value.preflightManifestPath, value.outputDir, value.requestId].every(nonEmpty) &&
    canonicalUtc(value.requestedAt) &&
    value.evidenceTargetDigest === QA_WIZARD_BLUEPRINT_DIAGNOSTIC_EVIDENCE_TARGET_DIGEST &&
    value.successorExecutionDigest !== value.predecessorExecutionIdentityDigest &&
    value.maxSuccessorExecutions ===
      QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_MAX_EXECUTIONS &&
    value.approvedBy === QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_APPROVER &&
    canonicalUtc(value.approvedAt) &&
    value.scope === 'single_use_paid_blueprint_diagnostic_successor_authorization' &&
    value.digestAlgorithm === DIGEST_ALGORITHM &&
    value.digest === canonicalJsonDigest(payloadWithoutDigest(value));
}

export function buildBlueprintDiagnosticSuccessorExecutionClaim(args: {
  authorization: QaWizardBlueprintDiagnosticSuccessorAuthorization;
  authorizationPath: string;
}): QaWizardBlueprintDiagnosticSuccessorExecutionClaim {
  if (!blueprintDiagnosticSuccessorAuthorizationIsValid(args.authorization) ||
      !nonEmpty(args.authorizationPath)) {
    throw new Error('diagnostic successor execution claim authority is invalid');
  }
  const claim = digestPayload({
    version: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_EXECUTION_CLAIM_VERSION,
    authoringAuthorityDigest: args.authorization.authoringAuthorityDigest,
    executionProgramDigest: args.authorization.executionProgramDigest,
    requestDigest: args.authorization.requestDigest,
    preflightManifestDigest: args.authorization.preflightManifestDigest,
    preflightManifestPath: args.authorization.preflightManifestPath,
    requestedAt: args.authorization.requestedAt,
    executionIdentityDigest: args.authorization.successorExecutionDigest,
    diagnosticSuccessor: {
      authorizationDigest: args.authorization.digest,
      authorizationPath: args.authorizationPath,
      candidateDigest: args.authorization.candidateDigest,
      predecessorExecutionIdentityDigest:
        args.authorization.predecessorExecutionIdentityDigest,
      predecessorTerminalManifestDigest:
        args.authorization.predecessorTerminalManifestDigest,
      evidenceTargetDigest: args.authorization.evidenceTargetDigest,
    },
    scope: 'single_use_paid_diagnostic_successor_blueprint_authoring' as const,
  });
  if (!blueprintDiagnosticSuccessorExecutionClaimIsValid(claim)) {
    throw new Error('diagnostic successor execution claim construction is invalid');
  }
  return claim;
}

export function blueprintDiagnosticSuccessorExecutionClaimIsValid(
  value: unknown,
): value is QaWizardBlueprintDiagnosticSuccessorExecutionClaim {
  return exactKeys(value, CLAIM_KEYS) &&
    value.version === QA_WIZARD_BLUEPRINT_DIAGNOSTIC_SUCCESSOR_EXECUTION_CLAIM_VERSION &&
    [
      value.authoringAuthorityDigest, value.executionProgramDigest, value.requestDigest,
      value.preflightManifestDigest, value.executionIdentityDigest, value.digest,
    ].every(hex) &&
    nonEmpty(value.preflightManifestPath) && canonicalUtc(value.requestedAt) &&
    exactKeys(value.diagnosticSuccessor, CLAIM_LINEAGE_KEYS) &&
    [
      value.diagnosticSuccessor.authorizationDigest,
      value.diagnosticSuccessor.candidateDigest,
      value.diagnosticSuccessor.predecessorExecutionIdentityDigest,
      value.diagnosticSuccessor.predecessorTerminalManifestDigest,
    ].every(hex) &&
    nonEmpty(value.diagnosticSuccessor.authorizationPath) &&
    value.diagnosticSuccessor.evidenceTargetDigest ===
      QA_WIZARD_BLUEPRINT_DIAGNOSTIC_EVIDENCE_TARGET_DIGEST &&
    value.scope === 'single_use_paid_diagnostic_successor_blueprint_authoring' &&
    value.digestAlgorithm === DIGEST_ALGORITHM &&
    value.digest === canonicalJsonDigest(payloadWithoutDigest(value));
}
