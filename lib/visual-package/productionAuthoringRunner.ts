import path from 'path';

import { canonicalize } from '@/lib/canonical-json';

import {
  PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION,
} from './preRenderBlueprintTypes';
import {
  PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS,
  PreRenderBlueprintAuthoringRepairExhaustedError,
  PreRenderBlueprintRepairInputNotAdmissibleError,
  buildPreRenderBlueprintAuthoringSystemPrompt,
  buildPreRenderBlueprintAuthoringUserPrompt,
  compilePreRenderBookVisualBlueprint,
  preRenderBlueprintAuthoringInputErrors,
  preRenderBlueprintRepairDiagnosticErrorText,
  type PreRenderBlueprintAuthoringCallOptions,
  type PreRenderBlueprintAuthoringConfig,
  type PreRenderBlueprintAuthoringResult,
  type PreRenderBlueprintRepairDiagnostic,
} from './preRenderBlueprintAuthoring';
import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
} from './preRenderBlueprintDraftSchema';
import {
  writeImmutableLocalArtifact,
  type ImmutableWriteHooks,
} from './preRenderBlueprintLifecycle';
import {
  canonicalJsonDigest,
  isoTimestampIsValid,
  nonEmpty,
  repoRelativePath,
} from './integrity';
import {
  computeProductionAuthoringContextDigest,
  type ProductionAuthoringContext,
} from './productionAuthoringContext';
import {
  aggregateAuthoringExecutionAttestations,
  authoringValidationDiagnosticsAreValid,
  authoringExecutionAttestationIsValid,
  buildAuthoringTerminalFailure,
  canonicalCompletedExecutionAttestationIsValid,
  injectedAuthoringExecutionAttestation,
  notRunAuthoringExecutionAttestation,
  emptyAuthoringValidationDiagnostics,
  sanitizedAuthoringAttemptDiagnostics,
  sanitizedAuthoringDiagnostics,
  type AuthoringDiagnosticCode,
  type AuthoringExecutionAttestation,
  type AuthoringTerminalFailure,
  type AuthoringTerminalFailureCode,
  type AuthoringValidationDiagnostics,
} from './authoringTerminalDiagnostics';
import {
  BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
  BLUEPRINT_AUTHORING_MAX_CALLS,
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_REPAIRS,
  BLUEPRINT_AUTHORING_MODEL,
  BLUEPRINT_AUTHORING_NO_FALLBACK,
  BLUEPRINT_AUTHORING_REASONING_EFFORT,
  OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
  blueprintAuthoringInputAccounting,
  blueprintAuthoringInputAccountingIsValid,
  blueprintAuthoringReservedExposureUsd,
  blueprintAuthoringSpendIsWithinCeiling,
  blueprintAuthoringUsageIsInternallyConsistent,
  conservativeBlueprintAuthoringCostUsd,
  nominalBlueprintAuthoringUsageCostUsd,
  projectedMaximumBlueprintAuthoringCostUsd,
  type BlueprintAuthoringInputAccounting,
  type BlueprintAuthoringUsage,
} from './blueprintAuthoringPolicy';
import {
  blueprintAuthoringCountRequestProjection,
  blueprintAuthoringCountResultConsumptionReason,
  decideBlueprintAuthoringInputTokenAdmission,
  type BlueprintAuthoringExactInputTokenCountResult,
  type BlueprintAuthoringInputTokenAdmissionDecision,
  type BlueprintAuthoringInputTokenCountRequest,
  type BlueprintAuthoringInputTokenCounter,
} from './blueprintAuthoringInputTokenAdmission';
import {
  BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD,
  blueprintAuthoringContinuationReservationMicroUsd,
  blueprintAuthoringGenerationMicroUsd,
  blueprintAuthoringProbeDebitMicroUsd,
  blueprintAuthoringProbeReservationMicroUsd,
} from './blueprintAuthoringCountAwareCost';
import {
  BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION,
  blueprintAuthoringAdmissionDecisionConsumptionReason,
  blueprintAuthoringAdmissionLedgerStructuralReason,
  blueprintAuthoringCountCacheKey,
  blueprintAuthoringCountResultTransportWasDispatched,
  blueprintAuthoringTokenRelevantRequestDigest,
  legacyBlueprintAuthoringAdmissionLedgerGenerationMicroUsd,
  legacyBlueprintAuthoringAdmissionLedgerV1StructuralReason,
  type BlueprintAuthoringAdmissionDecisionRecord,
  type BlueprintAuthoringAdmissionFailureReason,
  type BlueprintAuthoringProbeCostEvidence,
} from './blueprintAuthoringAdmissionLedger';
import {
  blueprintAuthoringExecutionProgramIsCurrent,
  buildBlueprintAuthoringExecutionProgram,
  type BlueprintAuthoringExecutionProgram,
} from './blueprintAuthoringExecutionProgram';
import {
  blueprintAuthoringDiagnosticCensusCommitment,
  blueprintAuthoringDiagnosticCensusCommitmentIsValid,
  blueprintAuthoringFailureRequiresSanitizedCapture,
  buildBlueprintAuthoringSanitizedCensus,
  buildBlueprintAuthoringSanitizedFailureCapture,
  mergeBlueprintAuthoringSanitizedCensuses,
  blueprintAuthoringSanitizedFailureCaptureBytes,
  blueprintAuthoringSanitizedFailureCaptureIsValid,
  blueprintAuthoringReceiptRequiresSanitizedCapture,
  type BlueprintAuthoringSanitizedFailureCapture,
  type BlueprintAuthoringDiagnosticCensusCommitment,
  type BlueprintAuthoringSanitizedCensus,
  type BlueprintAuthoringSanitizedAttemptCensus,
} from './blueprintAuthoringSanitizedFailureCapture';

export const PRODUCTION_AUTHORING_RUN_REQUEST_VERSION =
  'production-blueprint-authoring-request/v5' as const;
export const LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4 =
  'production-blueprint-authoring-request/v4' as const;
export const LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION =
  'production-blueprint-authoring-request/v3' as const;
export const PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION =
  'production-blueprint-authoring-receipt/v8' as const;
export const LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7 =
  'production-blueprint-authoring-receipt/v7' as const;
export const LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V6 =
  'production-blueprint-authoring-receipt/v6' as const;
export const LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION =
  'production-blueprint-authoring-receipt/v5' as const;
export const LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V4 =
  'production-blueprint-authoring-receipt/v4' as const;
export const LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V3 =
  'production-blueprint-authoring-receipt/v3' as const;

// Frozen request-v4 execution policy. These literals deliberately do not point
// at the mutable current-policy constants: immutable v4 artifacts must remain
// replay-readable after a future model, budget, or output-ceiling cutover.
const LEGACY_PRODUCTION_AUTHORING_V4_POLICY = {
  model: 'gpt-5.6-sol',
  reasoningEffort: 'medium',
  maxOutputTokens: 48_000,
  maxCalls: 3,
  maxRepairCount: 2,
} as const;
const LEGACY_PRODUCTION_AUTHORING_V3_MAX_CALLS = 3 as const;

/**
 * Complete closed set of terminal failure codes this runner can emit.
 *
 * Lifecycle replay imports this value directly so a newly emitted terminal
 * cannot be rejected by a stale duplicate allowlist after a paid call.
 */
export const PRODUCTION_BLUEPRINT_RUNNER_TERMINAL_FAILURE_CODES = [
  'call_budget_exhausted',
  'completion_status_invalid',
  'context_invalid',
  'cost_ceiling_exceeded',
  'draft_validation_repair_exhausted',
  'input_token_ceiling_exceeded',
  'local_processing_failed',
  'provider_call_failed',
  'provider_evidence_invalid',
  'provider_policy_mismatch',
  'repair_route_input_not_admissible',
  'usage_invalid',
] as const satisfies readonly AuthoringTerminalFailureCode[];

export type ProductionBlueprintRunnerTerminalFailureCode =
  (typeof PRODUCTION_BLUEPRINT_RUNNER_TERMINAL_FAILURE_CODES)[number];

export function productionAuthoringRequestVersionStatus(
  version: unknown,
): 'current' | 'legacy_immutable' | 'unsupported' {
  if (version === PRODUCTION_AUTHORING_RUN_REQUEST_VERSION) {
    return 'current';
  }
  return version === LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION ||
    version === LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4
    ? 'legacy_immutable'
    : 'unsupported';
}

export function productionAuthoringReceiptVersionStatus(
  version: unknown,
): 'current' | 'legacy_immutable' | 'unsupported' {
  if (version === PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION) {
    return 'current';
  }
  return version === LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION ||
    version === LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7 ||
    version === LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V6 ||
    version === LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V4 ||
    version === LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V3
    ? 'legacy_immutable'
    : 'unsupported';
}

/**
 * Closed request/receipt contract pairings accepted by the QA-Wizard lifecycle.
 * Request v5 accepts current receipt v8 or immutable historical v7 evidence. The
 * only durable Lifecycle terminals under request v4 may carry receipt v6 or v7
 * introduced while request v4 was still current. Request v3 never entered this
 * lifecycle and has no accepted pairing here.
 */
export function productionAuthoringRequestReceiptVersionPairIsSupported(args: {
  requestVersion: unknown;
  receiptVersion: unknown;
}): boolean {
  return (
    (args.requestVersion === PRODUCTION_AUTHORING_RUN_REQUEST_VERSION &&
      (args.receiptVersion === PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION ||
        args.receiptVersion === LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7)) ||
    (args.requestVersion === LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4 &&
      (args.receiptVersion === LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V6 ||
        args.receiptVersion === LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7))
  );
}

export interface ProductionAuthoringCallBudget {
  maxCalls: number;
  maxRepairCount: number;
}

export interface ProductionAuthoringRunRequest {
  version: typeof PRODUCTION_AUTHORING_RUN_REQUEST_VERSION;
  mode: 'preflight' | 'live';
  requestId: string;
  requestedAt: string;
  contextDigest: string;
  model: typeof BLUEPRINT_AUTHORING_MODEL;
  reasoningEffort: typeof BLUEPRINT_AUTHORING_REASONING_EFFORT;
  maxOutputTokens: typeof BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS;
  noFallback: true;
  callBudget: ProductionAuthoringCallBudget;
  program: BlueprintAuthoringExecutionProgram;
}

export interface LegacyProductionAuthoringRunRequest {
  version:
    | typeof LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4
    | typeof LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION;
  mode: 'preflight' | 'live';
  requestId: string;
  requestedAt: string;
  contextDigest: string;
  model: string;
  reasoningEffort: string;
  maxOutputTokens: number;
  noFallback: true;
  callBudget: ProductionAuthoringCallBudget;
}

export type ReplayableProductionAuthoringRunRequest =
  | ProductionAuthoringRunRequest
  | LegacyProductionAuthoringRunRequest;

const PRODUCTION_AUTHORING_RUN_REQUEST_KEYS = [
  'callBudget',
  'contextDigest',
  'maxOutputTokens',
  'mode',
  'model',
  'noFallback',
  'program',
  'reasoningEffort',
  'requestId',
  'requestedAt',
  'version',
] as const;

const LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_KEYS = [
  'callBudget',
  'contextDigest',
  'maxOutputTokens',
  'mode',
  'model',
  'noFallback',
  'reasoningEffort',
  'requestId',
  'requestedAt',
  'version',
] as const;

export function buildProductionAuthoringRunRequest(args: {
  context: ProductionAuthoringContext;
  mode: 'preflight' | 'live';
  requestId: string;
  requestedAt: string;
}): ProductionAuthoringRunRequest {
  return {
    version: PRODUCTION_AUTHORING_RUN_REQUEST_VERSION,
    mode: args.mode,
    requestId: args.requestId,
    requestedAt: args.requestedAt,
    contextDigest: args.context.digest,
    model: BLUEPRINT_AUTHORING_MODEL,
    reasoningEffort: BLUEPRINT_AUTHORING_REASONING_EFFORT,
    maxOutputTokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
    noFallback: BLUEPRINT_AUTHORING_NO_FALLBACK,
    callBudget: {
      maxCalls: BLUEPRINT_AUTHORING_MAX_CALLS,
      maxRepairCount: BLUEPRINT_AUTHORING_MAX_REPAIRS,
    },
    program: buildBlueprintAuthoringExecutionProgram(),
  };
}

export interface ProductionAuthoringProviderReceipt {
  provider: string;
  model: string;
  responseId?: string;
  usage?: Record<string, unknown> | null;
  evidenceVersion?: string;
  completionStatus?: string;
  usageEvidenceComplete?: boolean;
  executionAttestation?: AuthoringExecutionAttestation;
  inputAccounting?: BlueprintAuthoringInputAccounting;
  reservedExposureBeforeCallUsd?: number;
  nominalEstimatedCostUsd?: number;
  conservativeCallCostUsd?: number;
}

export interface ProductionAuthoringProviderResponse {
  output: unknown;
  receipt: ProductionAuthoringProviderReceipt;
}

export interface ProductionAuthoringProvider {
  call(args: {
    attempt: number;
    kind: 'initial' | 'repair';
    systemPrompt: string;
    userPrompt: string;
    options: PreRenderBlueprintAuthoringCallOptions;
    /** Runner-owned, count-aware proof for this exact generation wire. */
    inputAdmission: BlueprintAuthoringAdmissionDecisionRecord;
  }): Promise<ProductionAuthoringProviderResponse>;
}

export interface SafeAuthoringUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  cacheWriteInputTokens?: number;
  reasoningTokens?: number;
}

export type ProductionAuthoringAttemptFailureCode =
  | 'provider_call_failed'
  | 'call_budget_exhausted'
  | 'provider_policy_mismatch'
  | 'provider_evidence_invalid'
  | 'completion_status_invalid'
  | 'usage_invalid'
  | 'input_token_ceiling_exceeded'
  | 'cost_ceiling_exceeded';

export type ProductionAuthoringAttemptFailureEvidenceKind =
  | 'compiler_pre_dispatch'
  | 'compiler_response_boundary'
  | 'provider_adapter_boundary'
  | 'raw_provider_exception';

export type ProductionAuthoringAttemptFailureEvidenceReason =
  | 'adapter_policy_mismatch'
  | 'boundary_reason_invalid'
  | 'completion_status_invalid'
  | 'cost_evidence_mismatch'
  | 'cost_ceiling_exceeded'
  | 'execution_attestation_invalid'
  | 'input_ceiling_exceeded'
  | 'provider_call_failed'
  | 'provider_evidence_version_invalid'
  | 'provider_identity_mismatch'
  | 'raw_provider_exception'
  | 'response_id_invalid'
  | 'response_output_empty'
  | 'spend_reservation_exceeded'
  | 'usage_invalid';

export const PRODUCTION_AUTHORING_ATTEMPT_FAILURE_EVIDENCE_REASONS = [
  'adapter_policy_mismatch',
  'boundary_reason_invalid',
  'completion_status_invalid',
  'cost_evidence_mismatch',
  'cost_ceiling_exceeded',
  'execution_attestation_invalid',
  'input_ceiling_exceeded',
  'provider_call_failed',
  'provider_evidence_version_invalid',
  'provider_identity_mismatch',
  'raw_provider_exception',
  'response_id_invalid',
  'response_output_empty',
  'spend_reservation_exceeded',
  'usage_invalid',
] as const satisfies readonly ProductionAuthoringAttemptFailureEvidenceReason[];

export interface LegacyProductionAuthoringAttemptReceiptV6 {
  attempt: number;
  kind: 'initial' | 'repair';
  provider: string;
  model: string;
  responseId: string | null;
  systemPromptDigest: string;
  userPromptDigest: string;
  responseDigest: string | null;
  usage: SafeAuthoringUsage | null;
  providerEvidenceVersion: string | null;
  completionStatus: string | null;
  usageEvidenceComplete: boolean;
  inputAccounting: BlueprintAuthoringInputAccounting | null;
  reservedExposureBeforeCallUsd: number | null;
  nominalEstimatedCostUsd: number | null;
  conservativeCallCostUsd: number | null;
  cumulativeConservativeCostUsd: number | null;
  executionAttestation: AuthoringExecutionAttestation;
  validationDiagnostics: {
    count: number;
    codes: AuthoringDiagnosticCode[];
  };
  failureCode: ProductionAuthoringAttemptFailureCode | null;
  failureEvidenceKind: ProductionAuthoringAttemptFailureEvidenceKind | null;
  failureEvidenceReason: ProductionAuthoringAttemptFailureEvidenceReason | null;
}

export interface LegacyProductionAuthoringAttemptReceiptV7
  extends LegacyProductionAuthoringAttemptReceiptV6 {
  /** Exact full decision binding and its canonical token-relevant generation wire. */
  inputAdmissionDigest: string;
  tokenRelevantRequestDigest: string;
}

export interface ProductionAuthoringAttemptReceipt
  extends LegacyProductionAuthoringAttemptReceiptV7 {
  validationDiagnostics: AuthoringValidationDiagnostics;
  /** Exact sanitized structural census for this attempt, or null when it emitted none. */
  diagnosticCensusCommitment: BlueprintAuthoringDiagnosticCensusCommitment | null;
}

export interface ProductionAuthoringProviderBoundaryEvidence {
  provider?: unknown;
  model?: unknown;
  responseId?: unknown;
  responseDigest?: unknown;
  usage?: Record<string, unknown> | null;
  providerEvidenceVersion?: unknown;
  completionStatus?: unknown;
  usageEvidenceComplete?: unknown;
  inputAccounting?: unknown;
  reservedExposureBeforeCallUsd?: unknown;
  nominalEstimatedCostUsd?: unknown;
  conservativeCallCostUsd?: unknown;
  cumulativeConservativeCostUsd?: unknown;
  executionAttestation?: unknown;
}

interface ProductionAuthoringRunReceiptBase {
  version: string;
  requestDigest: string;
  requestId: string;
  requestedAt: string;
  mode: 'preflight' | 'live';
  contextDigest: string;
  model: string;
  reasoningEffort: string;
  maxOutputTokens: number;
  noFallback: true;
  callBudget: ProductionAuthoringCallBudget;
  status: 'preflight_passed' | 'completed' | 'failed';
  callCount: number;
  repairCount: number;
  executionAttestation: AuthoringExecutionAttestation;
  attempts: LegacyProductionAuthoringAttemptReceiptV6[];
  blueprintDigest: string | null;
  authoringProvenanceDigest: string | null;
  failure: AuthoringTerminalFailure | null;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface ProductionAuthoringRunReceipt
  extends ProductionAuthoringRunReceiptBase {
  version: typeof PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION;
  attempts: ProductionAuthoringAttemptReceipt[];
  admissionDecisions: BlueprintAuthoringAdmissionDecisionRecord[];
  diagnosticCensusCommitment: BlueprintAuthoringDiagnosticCensusCommitment | null;
}

export interface LegacyProductionAuthoringRunReceiptV7
  extends ProductionAuthoringRunReceiptBase {
  version: typeof LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7;
  attempts: LegacyProductionAuthoringAttemptReceiptV7[];
  admissionDecisions: BlueprintAuthoringAdmissionDecisionRecord[];
  diagnosticCensusCommitment: BlueprintAuthoringDiagnosticCensusCommitment | null;
}

export interface LegacyProductionAuthoringRunReceiptV6
  extends ProductionAuthoringRunReceiptBase {
  version: typeof LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V6;
  attempts: LegacyProductionAuthoringAttemptReceiptV6[];
}

export type ReplayableProductionAuthoringRunReceipt =
  | ProductionAuthoringRunReceipt
  | LegacyProductionAuthoringRunReceiptV7
  | LegacyProductionAuthoringRunReceiptV6;

/**
 * Typed disposition of the sanitized failure capture on a failed run. It replaces a
 * catch-all `capture | null` so a caller can distinguish an allowed diagnostic-less
 * absence (publish an ordinary terminal, bind no capture) from a capture derivation
 * failure / census overflow (which must be treated as torn state and driven into the
 * incident path, never published as an ordinary replayable terminal).
 */
export type BlueprintAuthoringSanitizedFailureCaptureDisposition =
  | { kind: 'captured'; capture: BlueprintAuthoringSanitizedFailureCapture }
  | { kind: 'diagnostic_less_absence' }
  | { kind: 'derivation_failed'; reasonCode: string };

/**
 * Total, constructor-validated discriminated result of one authoring run, keyed on the
 * receipt status so the three arms cannot contradict receipt.status / authoringResult /
 * disposition:
 *  - `preflight_passed` — no authoring result, no failure disposition.
 *  - `completed` — an authoring result is present, no failure disposition.
 *  - `failed` — no authoring result, and an EXPLICIT sanitized-failure-capture
 *    disposition is mandatory (there is no permissive default). A caller therefore
 *    cannot reach terminal publication for a failed run without a proven disposition.
 * Build only via `preflightRunResult` / `completedRunResult` / `failedRunResult`, which
 * assert the arm invariants at runtime, so even an untyped caller cannot mint a
 * contradictory result.
 */
export interface ProductionAuthoringPreflightRunResult {
  receipt: ProductionAuthoringRunReceipt & { status: 'preflight_passed' };
  authoringResult: null;
}

export interface ProductionAuthoringCompletedRunResult {
  receipt: ProductionAuthoringRunReceipt & { status: 'completed' };
  authoringResult: PreRenderBlueprintAuthoringResult;
}

export interface ProductionAuthoringFailedRunResult {
  receipt: ProductionAuthoringRunReceipt & { status: 'failed' };
  authoringResult: null;
  /**
   * Sanitized structural failure observability capture disposition. MANDATORY on every
   * failed run — explicit `captured`, `diagnostic_less_absence`, or `derivation_failed`.
   * Pure observability — see the capture's `doesNotAuthorize` semantics. Never carries
   * prose or PII.
   */
  sanitizedFailureCaptureDisposition: BlueprintAuthoringSanitizedFailureCaptureDisposition;
}

export type ProductionAuthoringRunResult =
  | ProductionAuthoringPreflightRunResult
  | ProductionAuthoringCompletedRunResult
  | ProductionAuthoringFailedRunResult;

export function productionAuthoringRunResultIsCompleted(
  result: ProductionAuthoringRunResult,
): result is ProductionAuthoringCompletedRunResult {
  return result.receipt.status === 'completed';
}

export function productionAuthoringRunResultIsFailed(
  result: ProductionAuthoringRunResult,
): result is ProductionAuthoringFailedRunResult {
  return result.receipt.status === 'failed';
}

/** Total runtime check that a disposition is one of the three well-formed shapes. */
function sanitizedFailureCaptureDispositionIsWellFormed(
  disposition: unknown,
): disposition is BlueprintAuthoringSanitizedFailureCaptureDisposition {
  if (!disposition || typeof disposition !== 'object') return false;
  const kind = (disposition as { kind?: unknown }).kind;
  if (kind === 'captured') {
    return (
      typeof (disposition as { capture?: unknown }).capture === 'object' &&
      (disposition as { capture?: unknown }).capture !== null
    );
  }
  if (kind === 'diagnostic_less_absence') return true;
  if (kind === 'derivation_failed') {
    return typeof (disposition as { reasonCode?: unknown }).reasonCode === 'string';
  }
  return false;
}

function preflightRunResult(
  receipt: ProductionAuthoringRunReceipt,
): ProductionAuthoringPreflightRunResult {
  if (receipt.status !== 'preflight_passed') {
    throw new Error('preflight run result requires a preflight_passed receipt');
  }
  return {
    receipt: receipt as ProductionAuthoringRunReceipt & {
      status: 'preflight_passed';
    },
    authoringResult: null,
  };
}

function completedRunResult(
  receipt: ProductionAuthoringRunReceipt,
  authoringResult: PreRenderBlueprintAuthoringResult,
): ProductionAuthoringCompletedRunResult {
  if (receipt.status !== 'completed') {
    throw new Error('completed run result requires a completed receipt');
  }
  if (!authoringResult) {
    throw new Error('completed run result requires an authoring result');
  }
  return {
    receipt: receipt as ProductionAuthoringRunReceipt & { status: 'completed' },
    authoringResult,
  };
}

function failedRunResult(
  receipt: ProductionAuthoringRunReceipt,
  disposition: BlueprintAuthoringSanitizedFailureCaptureDisposition,
): ProductionAuthoringFailedRunResult {
  if (receipt.status !== 'failed') {
    throw new Error('failed run result requires a failed receipt');
  }
  if (!sanitizedFailureCaptureDispositionIsWellFormed(disposition)) {
    throw new Error('failed run result requires an explicit capture disposition');
  }
  return {
    receipt: receipt as ProductionAuthoringRunReceipt & { status: 'failed' },
    authoringResult: null,
    sanitizedFailureCaptureDisposition: disposition,
  };
}

export function productionAuthoringReceiptBytes(
  receipt: ReplayableProductionAuthoringRunReceipt,
): string {
  return `${JSON.stringify(canonicalize(receipt), null, 2)}\n`;
}

function productionAuthoringReceiptAdmissionEvidenceReason(
  value: unknown,
  expectedVersion:
    | typeof PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION
    | typeof LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7,
): string | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return 'receipt_admission_shape_invalid';
    }
    const receipt = value as
      | ProductionAuthoringRunReceipt
      | LegacyProductionAuthoringRunReceiptV7;
    if (receipt.version !== expectedVersion) {
      return 'receipt_admission_version_invalid';
    }
    const legacyV7 =
      expectedVersion === LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7;
    const ledgerReason = legacyV7
      ? legacyBlueprintAuthoringAdmissionLedgerV1StructuralReason(
          receipt.admissionDecisions,
        )
      : blueprintAuthoringAdmissionLedgerStructuralReason(
          receipt.admissionDecisions,
        );
    if (ledgerReason !== null) return ledgerReason;
    if (!Array.isArray(receipt.attempts)) return 'receipt_attempts_invalid';
    const decisions = receipt.admissionDecisions;
    if (
      decisions.length < receipt.attempts.length ||
      decisions.length > receipt.attempts.length + 1
    ) return 'receipt_admission_topology_invalid';
    let generationAccountedMicroUsd = 0;
    for (let index = 0; index < receipt.attempts.length; index += 1) {
      const attempt = receipt.attempts[index]!;
      const decision = decisions[index];
      if (
        !decision ||
        !decision.admitted ||
        decision.generationAttempt !== attempt.attempt ||
        decision.routeKind !== attempt.kind ||
        decision.generationAccountedMicroUsdBeforeRoute !==
          generationAccountedMicroUsd ||
        attempt.inputAdmissionDigest !== canonicalJsonDigest(decision) ||
        attempt.tokenRelevantRequestDigest !==
          decision.tokenRelevantRequestDigest ||
        (attempt.inputAccounting !== null &&
          canonicalJsonDigest(attempt.inputAccounting) !==
            decision.inputAccountingDigest) ||
        (decision.exactInputTokens !== null &&
          attempt.usage !== null &&
          attempt.usage.inputTokens !== decision.exactInputTokens)
      ) return 'receipt_attempt_admission_binding_invalid';
      if (attempt.failureCode === null) {
        const inputTokens = attempt.usage?.inputTokens;
        const outputTokens = attempt.usage?.outputTokens;
        if (
          typeof inputTokens !== 'number' ||
          !Number.isSafeInteger(inputTokens) ||
          inputTokens < 0 ||
          typeof outputTokens !== 'number' ||
          !Number.isSafeInteger(outputTokens) ||
          outputTokens < 0
        ) return 'receipt_generation_cost_evidence_invalid';
        const debit = legacyV7
          ? legacyBlueprintAuthoringAdmissionLedgerGenerationMicroUsd({
              inputTokens,
              outputTokens,
            })
          : blueprintAuthoringGenerationMicroUsd({
              inputTokens,
              outputTokens,
            });
        if (generationAccountedMicroUsd > Number.MAX_SAFE_INTEGER - debit) {
          return 'receipt_generation_cost_overflow';
        }
        generationAccountedMicroUsd += debit;
      }
    }
    const extra = decisions[receipt.attempts.length];
    if (extra) {
      if (
        extra.admitted ||
        receipt.status !== 'failed' ||
        receipt.failure?.code !== 'repair_route_input_not_admissible' ||
        extra.generationAttempt !== receipt.attempts.length + 1 ||
        extra.generationAccountedMicroUsdBeforeRoute !==
          generationAccountedMicroUsd
      ) return 'receipt_rejected_admission_topology_invalid';
    }
    if (
      receipt.status === 'completed' &&
      decisions.length !== receipt.attempts.length
    ) return 'receipt_completed_admission_topology_invalid';
    if (
      receipt.attempts.length === 0 &&
      decisions.length !== 0
    ) return 'receipt_zero_attempt_admission_invalid';

    const diagnosticsPresent = receipt.attempts.some(
      (attempt) =>
        attempt.validationDiagnostics.count > 0 ||
        attempt.validationDiagnostics.codes.length > 0,
    );
    const commitmentRequired =
      diagnosticsPresent ||
      (receipt.status === 'failed' &&
        blueprintAuthoringFailureRequiresSanitizedCapture(
          receipt.failure?.code,
        ));
    if (commitmentRequired) {
      if (
        !blueprintAuthoringDiagnosticCensusCommitmentIsValid(
          receipt.diagnosticCensusCommitment,
        )
      ) return 'receipt_diagnostic_census_commitment_missing';
    } else if (receipt.diagnosticCensusCommitment !== null) {
      return 'receipt_diagnostic_census_commitment_unexpected';
    }
    return null;
  } catch {
    return 'receipt_admission_evidence_validation_failed';
  }
}

/** Prompt-free immutable admission/count-evidence validator for legacy receipt v7. */
export function productionAuthoringReceiptV7EvidenceReason(
  value: unknown,
): string | null {
  return productionAuthoringReceiptAdmissionEvidenceReason(
    value,
    LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7,
  );
}

/** Prompt-free durable evidence validator for current receipt v8. */
export function productionAuthoringReceiptV8EvidenceReason(
  value: unknown,
): string | null {
  const commonReason = productionAuthoringReceiptAdmissionEvidenceReason(
    value,
    PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
  );
  if (commonReason !== null) return commonReason;
  const receipt = value as ProductionAuthoringRunReceipt;
  let totalEmitted = 0;
  for (const attempt of receipt.attempts) {
    if (!authoringValidationDiagnosticsAreValid(attempt.validationDiagnostics)) {
      return 'receipt_attempt_diagnostic_summary_invalid';
    }
    const diagnosticsPresent = attempt.validationDiagnostics.totalCount > 0;
    if (diagnosticsPresent) {
      if (
        !blueprintAuthoringDiagnosticCensusCommitmentIsValid(
          attempt.diagnosticCensusCommitment,
        ) ||
        attempt.diagnosticCensusCommitment.totalEmitted !==
          attempt.validationDiagnostics.totalCount
      ) {
        return 'receipt_attempt_diagnostic_census_commitment_invalid';
      }
      if (
        totalEmitted >
        Number.MAX_SAFE_INTEGER - attempt.validationDiagnostics.totalCount
      ) {
        return 'receipt_attempt_diagnostic_count_overflow';
      }
      totalEmitted += attempt.validationDiagnostics.totalCount;
    } else if (attempt.diagnosticCensusCommitment !== null) {
      return 'receipt_attempt_diagnostic_census_commitment_unexpected';
    }
  }
  if (
    totalEmitted > 0 &&
    receipt.diagnosticCensusCommitment?.totalEmitted !== totalEmitted
  ) {
    return 'receipt_aggregate_diagnostic_count_mismatch';
  }
  return null;
}

export class InvalidProductionAuthoringRunRequestError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid production authoring request:\n- ${issues.join('\n- ')}`);
    this.name = 'InvalidProductionAuthoringRunRequestError';
  }
}

class AuthoringCallBudgetError extends Error {
  constructor() {
    super('authoring call budget exhausted');
    this.name = 'AuthoringCallBudgetError';
  }
}

export class ProductionAuthoringProviderBoundaryError extends Error {
  constructor(
    readonly failureCode: ProductionAuthoringAttemptFailureCode,
    readonly evidence: ProductionAuthoringProviderBoundaryEvidence,
    readonly failureEvidenceReason: ProductionAuthoringAttemptFailureEvidenceReason,
  ) {
    super(`blueprint authoring boundary rejected ${failureCode}`);
    this.name = 'ProductionAuthoringProviderBoundaryError';
  }
}

function requestIssues(
  request: ProductionAuthoringRunRequest,
  context: ProductionAuthoringContext,
): string[] {
  const issues: string[] = [];
  if (
    !request ||
    typeof request !== 'object' ||
    Array.isArray(request) ||
    JSON.stringify(Object.keys(request).sort()) !==
      JSON.stringify([...PRODUCTION_AUTHORING_RUN_REQUEST_KEYS].sort())
  ) {
    return ['request keys are invalid'];
  }
  if (
    !request.callBudget ||
    typeof request.callBudget !== 'object' ||
    Array.isArray(request.callBudget) ||
    JSON.stringify(Object.keys(request.callBudget).sort()) !==
      JSON.stringify(['maxCalls', 'maxRepairCount'])
  ) {
    issues.push('callBudget keys are invalid');
  }
  if (request.version !== PRODUCTION_AUTHORING_RUN_REQUEST_VERSION) {
    issues.push('request version is unsupported');
  }
  if (!['preflight', 'live'].includes(request.mode)) {
    issues.push('request mode must be preflight|live');
  }
  if (!nonEmpty(request.requestId) || request.requestId.length > 160) {
    issues.push('requestId must be a non-empty bounded identifier');
  }
  if (!isoTimestampIsValid(request.requestedAt)) {
    issues.push('requestedAt must be an ISO timestamp');
  }
  if (request.contextDigest !== context.digest) {
    issues.push('request contextDigest does not bind the supplied context');
  }
  const { validationContext, digestAlgorithm: _algorithm, digest: _digest, ...contextPayload } =
    context;
  void validationContext;
  if (
    context.digestAlgorithm !== 'canonical-json-sha256' ||
    context.digest !== computeProductionAuthoringContextDigest(contextPayload)
  ) {
    issues.push('production authoring context digest is stale');
  }
  if (
    context.reconciliation.digest !==
      canonicalJsonDigest(context.reconciliation.content) ||
    canonicalJsonDigest(context.validationContext.reconciliation) !==
      canonicalJsonDigest(context.reconciliation.content)
  ) {
    issues.push('production authoring reconciliation content is stale');
  }
  if (request.model !== BLUEPRINT_AUTHORING_MODEL) {
    issues.push('model differs from canonical Blueprint policy');
  }
  if (
    request.reasoningEffort !==
    BLUEPRINT_AUTHORING_REASONING_EFFORT
  ) {
    issues.push('reasoningEffort differs from canonical Blueprint policy');
  }
  if (
    !Number.isSafeInteger(request.maxOutputTokens) ||
    request.maxOutputTokens !==
      BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS
  ) {
    issues.push('maxOutputTokens differs from canonical Blueprint policy');
  }
  if (request.noFallback !== BLUEPRINT_AUTHORING_NO_FALLBACK) {
    issues.push('noFallback must be true');
  }
  if (!blueprintAuthoringExecutionProgramIsCurrent(request.program)) {
    issues.push('authoring execution program is stale or invalid');
  }
  if (
    !Number.isSafeInteger(request.callBudget?.maxCalls) ||
    request.callBudget.maxCalls !== BLUEPRINT_AUTHORING_MAX_CALLS
  ) {
    issues.push('maxCalls differs from canonical Blueprint policy');
  }
  if (
    !Number.isSafeInteger(request.callBudget?.maxRepairCount) ||
    request.callBudget.maxRepairCount !== BLUEPRINT_AUTHORING_MAX_REPAIRS
  ) {
    issues.push('maxRepairCount differs from canonical Blueprint policy');
  }
  if (
    PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS !==
      BLUEPRINT_AUTHORING_MAX_REPAIRS ||
    projectedMaximumBlueprintAuthoringCostUsd() >
      BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD
  ) {
    issues.push('canonical Blueprint policy invariants are invalid');
  }
  return issues;
}

export function productionAuthoringRunRequestIssues(args: {
  request: ProductionAuthoringRunRequest;
  context: ProductionAuthoringContext;
}): string[] {
  try {
    return requestIssues(args.request, args.context);
  } catch {
    return ['request or production context cannot be validated'];
  }
}

function legacyProductionAuthoringRunRequestIssues(args: {
  request: LegacyProductionAuthoringRunRequest;
  context: ProductionAuthoringContext;
}): string[] {
  const { request, context } = args;
  const issues: string[] = [];
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return ['legacy request is invalid'];
  }
  if (
    request.version === LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4 &&
    JSON.stringify(Object.keys(request).sort()) !==
      JSON.stringify([...LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_KEYS].sort())
  ) {
    return ['legacy v4 request keys are invalid'];
  }
  if (
    !request.callBudget ||
    typeof request.callBudget !== 'object' ||
    Array.isArray(request.callBudget)
  ) {
    issues.push('legacy callBudget is invalid');
  } else if (
    request.version === LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4 &&
    JSON.stringify(Object.keys(request.callBudget).sort()) !==
      JSON.stringify(['maxCalls', 'maxRepairCount'])
  ) {
    issues.push('legacy v4 callBudget keys are invalid');
  }
  if (!['preflight', 'live'].includes(request.mode)) {
    issues.push('request mode must be preflight|live');
  }
  if (!nonEmpty(request.requestId) || request.requestId.length > 160) {
    issues.push('requestId must be a non-empty bounded identifier');
  }
  if (!isoTimestampIsValid(request.requestedAt)) {
    issues.push('requestedAt must be an ISO timestamp');
  }
  if (request.contextDigest !== context.digest) {
    issues.push('request contextDigest does not bind the supplied context');
  }
  const {
    validationContext,
    digestAlgorithm: _algorithm,
    digest: _digest,
    ...contextPayload
  } = context;
  void validationContext;
  if (
    context.digestAlgorithm !== 'canonical-json-sha256' ||
    context.digest !== computeProductionAuthoringContextDigest(contextPayload)
  ) {
    issues.push('production authoring context digest is stale');
  }
  if (
    context.reconciliation.digest !==
      canonicalJsonDigest(context.reconciliation.content) ||
    canonicalJsonDigest(context.validationContext.reconciliation) !==
      canonicalJsonDigest(context.reconciliation.content)
  ) {
    issues.push('production authoring reconciliation content is stale');
  }
  if (request.noFallback !== true) {
    issues.push('noFallback must be true');
  }

  if (request.version === LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4) {
    if (request.model !== LEGACY_PRODUCTION_AUTHORING_V4_POLICY.model) {
      issues.push('legacy v4 model is invalid');
    }
    if (
      request.reasoningEffort !==
      LEGACY_PRODUCTION_AUTHORING_V4_POLICY.reasoningEffort
    ) {
      issues.push('legacy v4 reasoningEffort is invalid');
    }
    if (
      request.maxOutputTokens !==
      LEGACY_PRODUCTION_AUTHORING_V4_POLICY.maxOutputTokens
    ) {
      issues.push('legacy v4 maxOutputTokens is invalid');
    }
    if (
      request.callBudget?.maxCalls !==
      LEGACY_PRODUCTION_AUTHORING_V4_POLICY.maxCalls
    ) {
      issues.push('legacy v4 maxCalls is invalid');
    }
    if (
      request.callBudget?.maxRepairCount !==
      LEGACY_PRODUCTION_AUTHORING_V4_POLICY.maxRepairCount
    ) {
      issues.push('legacy v4 maxRepairCount is invalid');
    }
    return issues;
  }

  // Frozen request-v3 semantics from its original validator. Request v3 did
  // not require exact object keys; replay therefore preserves that historical
  // acceptance while granting no fresh lifecycle dispatch authority.
  if (!nonEmpty(request.model) || !nonEmpty(request.reasoningEffort)) {
    issues.push('exact model and reasoningEffort are required');
  }
  if (
    !Number.isSafeInteger(request.maxOutputTokens) ||
    request.maxOutputTokens < 1
  ) {
    issues.push('maxOutputTokens must be a positive safe integer');
  }
  if (
    !Number.isSafeInteger(request.callBudget?.maxCalls) ||
    request.callBudget.maxCalls < 1 ||
    request.callBudget.maxCalls > LEGACY_PRODUCTION_AUTHORING_V3_MAX_CALLS
  ) {
    issues.push(
      `maxCalls must be between 1 and ${LEGACY_PRODUCTION_AUTHORING_V3_MAX_CALLS}`,
    );
  }
  if (
    !Number.isSafeInteger(request.callBudget?.maxRepairCount) ||
    request.callBudget.maxRepairCount !== request.callBudget.maxCalls - 1
  ) {
    issues.push('maxRepairCount must equal maxCalls - 1');
  }
  return issues;
}

/**
 * Structural replay validation for immutable request artifacts. Current requests
 * must carry the exact compiler-owned execution program. Legacy v3/v4 requests
 * are checked against frozen per-version semantics and can be reloaded for
 * terminal replay, recovery, or orphan classification, but this function does
 * not grant them fresh dispatch authority.
 */
export function productionAuthoringRunRequestReplayIssues(args: {
  request: ReplayableProductionAuthoringRunRequest;
  context: ProductionAuthoringContext;
}): string[] {
  try {
    const status = productionAuthoringRequestVersionStatus(args.request.version);
    if (status === 'unsupported') return ['request version is unsupported'];
    if (status === 'current') {
      return productionAuthoringRunRequestIssues({
        request: args.request as ProductionAuthoringRunRequest,
        context: args.context,
      });
    }
    return legacyProductionAuthoringRunRequestIssues({
      request: args.request as LegacyProductionAuthoringRunRequest,
      context: args.context,
    });
  } catch {
    return ['request or production context cannot be replay-validated'];
  }
}

export function productionBlueprintInitialInputAccounting(
  context: ProductionAuthoringContext,
): BlueprintAuthoringInputAccounting {
  return blueprintAuthoringInputAccounting({
    systemPrompt: buildPreRenderBlueprintAuthoringSystemPrompt(),
    userPrompt: buildPreRenderBlueprintAuthoringUserPrompt(
      context.validationContext,
    ),
    schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  });
}

function productionBlueprintInitialPromptIssues(
  context: ProductionAuthoringContext,
): string[] {
  const accounting = productionBlueprintInitialInputAccounting(context);
  // The single shared admission authority. No exact provider count is supplied in
  // the paid runner path (live counting is deferred), so this is the proven
  // conservative bound — numerically identical to the prior gate.
  const admission = decideBlueprintAuthoringInputTokenAdmission({ accounting });
  return admission.admitted
    ? []
    : [
        `initial Blueprint prompt exceeds canonical input-token ceiling: conservative upper bound ${accounting.estimatedBytes} > ${BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS}`,
      ];
}

export function productionBlueprintAuthoringPreflightIssues(args: {
  request: ProductionAuthoringRunRequest;
  context: ProductionAuthoringContext;
}): string[] {
  const issues = productionAuthoringRunRequestIssues(args);
  if (issues.length > 0) return issues;
  try {
    const inputIssues = preRenderBlueprintAuthoringInputErrors(
      args.context.validationContext,
      {
        model: args.request.model,
        reasoningEffort: args.request.reasoningEffort,
        maxOutputTokens: args.request.maxOutputTokens,
        compositionPolicyVersion:
          PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION,
        },
      );
    return inputIssues.length > 0
      ? inputIssues
      : productionBlueprintInitialPromptIssues(args.context);
  } catch {
    return ['production Blueprint authoring input cannot be validated'];
  }
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function safeUsage(raw: Record<string, unknown> | null | undefined): SafeAuthoringUsage | null {
  if (!raw) return null;
  const usage: SafeAuthoringUsage = {
    inputTokens:
      numeric(raw.input_tokens) ?? numeric(raw.prompt_tokens),
    outputTokens:
      numeric(raw.output_tokens) ?? numeric(raw.completion_tokens),
    totalTokens: numeric(raw.total_tokens),
    cachedInputTokens:
      numeric(raw.cached_input_tokens) ??
      numeric(
        (raw.input_tokens_details as Record<string, unknown> | undefined)
          ?.cached_tokens,
      ),
    cacheWriteInputTokens:
      numeric(raw.cache_write_input_tokens) ??
      numeric(
        (raw.input_tokens_details as Record<string, unknown> | undefined)
          ?.cache_write_tokens,
      ),
    reasoningTokens:
      numeric(raw.reasoning_tokens) ??
      numeric(
        (raw.output_tokens_details as Record<string, unknown> | undefined)
          ?.reasoning_tokens,
      ),
  };
  return Object.values(usage).some((value) => value !== undefined)
    ? usage
    : null;
}

function canonicalUsage(
  raw: Record<string, unknown> | null | undefined,
): BlueprintAuthoringUsage | null {
  const safe = safeUsage(raw);
  if (
    safe?.inputTokens === undefined ||
    safe.cachedInputTokens === undefined ||
    safe.cacheWriteInputTokens === undefined ||
    safe.outputTokens === undefined ||
    safe.reasoningTokens === undefined ||
    safe.totalTokens === undefined
  ) {
    return null;
  }
  const usage: BlueprintAuthoringUsage = {
    inputTokens: safe.inputTokens,
    cachedInputTokens: safe.cachedInputTokens,
    cacheWriteInputTokens: safe.cacheWriteInputTokens,
    outputTokens: safe.outputTokens,
    reasoningTokens: safe.reasoningTokens,
    totalTokens: safe.totalTokens,
  };
  return blueprintAuthoringUsageIsInternallyConsistent(usage)
    ? usage
    : null;
}

function safeUsageFromCanonical(
  usage: BlueprintAuthoringUsage,
): SafeAuthoringUsage {
  return { ...usage };
}

function receiptPayload(
  receipt: Omit<ProductionAuthoringRunReceipt, 'digestAlgorithm' | 'digest'>,
): unknown {
  return receipt;
}

function finalizeReceipt(
  receipt: Omit<ProductionAuthoringRunReceipt, 'digestAlgorithm' | 'digest'>,
): ProductionAuthoringRunReceipt {
  return {
    ...receipt,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(receiptPayload(receipt)),
  };
}

function failureReceipt(args: {
  request: ProductionAuthoringRunRequest;
  attempts: ProductionAuthoringAttemptReceipt[];
  admissionDecisions?: BlueprintAuthoringAdmissionDecisionRecord[];
  diagnosticCensusCommitment?: BlueprintAuthoringDiagnosticCensusCommitment | null;
  code: ProductionBlueprintRunnerTerminalFailureCode;
  diagnosticInputs?: readonly unknown[];
  diagnosticCountOverride?: number;
  issueCodes?: readonly unknown[];
  requestDigestOverride?: string;
}): ProductionAuthoringRunReceipt {
  return finalizeReceipt({
    version: PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
    requestDigest:
      args.requestDigestOverride ??
      canonicalJsonDigest(args.request),
    requestId: args.request.requestId,
    requestedAt: args.request.requestedAt,
    mode: args.request.mode,
    contextDigest: args.request.contextDigest,
    model: args.request.model,
    reasoningEffort: args.request.reasoningEffort,
    maxOutputTokens: args.request.maxOutputTokens,
    noFallback: true,
    callBudget: args.request.callBudget,
    status: 'failed',
    callCount: args.attempts.length,
    repairCount: Math.max(0, args.attempts.length - 1),
    executionAttestation:
      aggregateProductionAuthoringExecutionAttestations(
        args.attempts.map(
          (attempt) => attempt.executionAttestation,
        ),
      ),
    attempts: args.attempts,
    admissionDecisions: structuredClone(args.admissionDecisions ?? []),
    diagnosticCensusCommitment:
      args.diagnosticCensusCommitment
        ? structuredClone(args.diagnosticCensusCommitment)
        : null,
    blueprintDigest: null,
    authoringProvenanceDigest: null,
    failure: buildAuthoringTerminalFailure({
      code: args.code,
      diagnosticInputs: args.diagnosticInputs,
      diagnosticCountOverride:
        args.diagnosticCountOverride,
      issueCodes: args.issueCodes,
    }),
  });
}

export function aggregateProductionAuthoringExecutionAttestations(
  values: readonly AuthoringExecutionAttestation[],
): AuthoringExecutionAttestation {
  const providerReached = values.filter(
    (value) => value.evidenceKind !== 'not_run',
  );
  return providerReached.length === 0
    ? notRunAuthoringExecutionAttestation()
    : aggregateAuthoringExecutionAttestations(providerReached);
}

function copyValidationAttemptEvidence(args: {
  sourceAttempts: ReadonlyArray<{
    attempt: number;
    errors: string[];
    diagnostics?: PreRenderBlueprintRepairDiagnostic[];
  }>;
  receipts: ProductionAuthoringAttemptReceipt[];
}): void {
  for (const repairAttempt of args.sourceAttempts) {
    if (
      !Number.isSafeInteger(repairAttempt.attempt) ||
      repairAttempt.attempt < 1 ||
      repairAttempt.attempt > args.receipts.length
    ) {
      continue;
    }
    const receipt = args.receipts[repairAttempt.attempt - 1];
    if (!receipt || receipt.failureCode !== null) continue;
    receipt.validationDiagnostics = sanitizedAuthoringAttemptDiagnostics({
      inputs: repairAttempt.errors,
      fallbackCode: 'draft_contract_validation_failed',
    });
    try {
      receipt.diagnosticCensusCommitment = repairAttempt.diagnostics?.length
        ? blueprintAuthoringDiagnosticCensusCommitment(
            buildBlueprintAuthoringSanitizedCensus(repairAttempt.diagnostics),
          )
        : null;
    } catch {
      receipt.diagnosticCensusCommitment = null;
    }
  }
}

function productionRepairExhaustionIsProven(args: {
  error: PreRenderBlueprintAuthoringRepairExhaustedError;
  request: ProductionAuthoringRunRequest;
  attempts: readonly ProductionAuthoringAttemptReceipt[];
}): boolean {
  const expectedCalls = args.request.callBudget.maxCalls;
  const expectedRepairs =
    args.request.callBudget.maxRepairCount;
  return (
    expectedCalls ===
      PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS + 1 &&
    expectedRepairs === PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS &&
    expectedCalls === expectedRepairs + 1 &&
    args.error.attempts.length === expectedCalls &&
    args.attempts.length === expectedCalls &&
    args.attempts.every(
      (attempt, index) =>
        attempt.attempt === index + 1 &&
        attempt.failureCode === null,
    ) &&
    args.error.attempts.every(
      (attempt, index) =>
        attempt.attempt === index + 1 &&
        attempt.errors.length > 0,
    )
  );
}

/**
 * Build a failed run result for a deterministic pre-provider failure (no attempts).
 * The disposition is still derived through the single canonical derivation authority so
 * every failed arm — deterministic or provider-reached — carries an explicit, proven
 * disposition. With no attempts and a non-mandatory code this is an explicit
 * diagnostic-less absence; the derivation stays the single source of truth.
 */
function deterministicFailedRunResult(args: {
  request: ProductionAuthoringRunRequest;
  context: ProductionAuthoringContext;
  receipt: ProductionAuthoringRunReceipt;
  failureCode: ProductionBlueprintRunnerTerminalFailureCode;
}): ProductionAuthoringFailedRunResult {
  return failedRunResult(
    args.receipt,
    deriveBlueprintAuthoringSanitizedFailureCaptureDisposition({
      request: args.request,
      context: args.context,
      attempts: [],
      error: undefined,
      failureReceipt: args.receipt,
      failureCode: args.failureCode,
    }),
  );
}

interface RunnerCountProbeEvent {
  requestKey: string;
  probe: BlueprintAuthoringProbeCostEvidence;
}

function boundedCountUnavailableResult(args: {
  request: BlueprintAuthoringInputTokenCountRequest;
  reason:
    | 'not_wired'
    | 'count_transport_failed'
    | 'count_evidence_invalid'
    | 'count_cost_reservation_exceeded';
}): BlueprintAuthoringExactInputTokenCountResult {
  return {
    routeKind: 'repair',
    repairOrdinal: args.request.repairOrdinal,
    countRequestDigest: canonicalJsonDigest(
      blueprintAuthoringCountRequestProjection(args.request),
    ),
    outcome: 'unavailable',
    inputTokens: null,
    unavailableReason: args.reason,
    attestation: null,
  };
}

interface RunnerCountCacheEntry {
  result: BlueprintAuthoringExactInputTokenCountResult;
  firstProbe: BlueprintAuthoringProbeCostEvidence;
}

export interface BlueprintAuthoringRunnerCountAuthority {
  counter: BlueprintAuthoringInputTokenCounter;
  consumeProbeEvent(
    request: BlueprintAuthoringInputTokenCountRequest,
  ): RunnerCountProbeEvent | null;
  cumulativeProbeDebitMicroUsd(): number;
}

/**
 * Run-scoped exact-count authority. The cache stores the in-flight Promise before awaiting it,
 * so concurrent/serial duplicate consultations of one route+ordinal+wire can never dispatch or
 * debit twice. Any invoked source with absent/hostile transport evidence is charged at Q(U),
 * never zero; only runner-owned `not_wired`/reservation rejection are proven pre-dispatch.
 */
export function createBlueprintAuthoringRunnerCountAuthority(args: {
  source?: BlueprintAuthoringInputTokenCounter;
  generationAccountedMicroUsd: () => number;
}): BlueprintAuthoringRunnerCountAuthority {
  const cache = new Map<string, Promise<RunnerCountCacheEntry>>();
  const pendingEvents = new Map<string, RunnerCountProbeEvent[]>();
  let cumulativeProbeDebitMicroUsd = 0;

  const enqueue = (
    requestKey: string,
    probe: BlueprintAuthoringProbeCostEvidence,
  ): void => {
    const queue = pendingEvents.get(requestKey) ?? [];
    queue.push({ requestKey, probe });
    pendingEvents.set(requestKey, queue);
  };

  const counter: BlueprintAuthoringInputTokenCounter = async (request) => {
    const requestKey = blueprintAuthoringCountCacheKey(request);
    const cached = cache.get(requestKey);
    if (cached) {
      const entry = await cached;
      enqueue(requestKey, {
        status: 'cache_hit',
        reservationBeforeDispatchMicroUsd: null,
        debitMicroUsd: 0,
        cumulativeDebitMicroUsd: cumulativeProbeDebitMicroUsd,
        transportDisposition: 'not_dispatched',
      });
      return structuredClone(entry.result);
    }

    const accounting = blueprintAuthoringInputAccounting({
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      schema: request.schema,
    });
    const upperBound = accounting.estimatedBytes;
    const generationAccounted = args.generationAccountedMicroUsd();
    if (
      !Number.isSafeInteger(generationAccounted) ||
      generationAccounted < 0 ||
      generationAccounted >
        Number.MAX_SAFE_INTEGER - cumulativeProbeDebitMicroUsd
    ) {
      throw new Error('blueprint authoring count ledger state is invalid');
    }
    const accountedBeforeProbe =
      generationAccounted + cumulativeProbeDebitMicroUsd;
    const laterProbeRoutes =
      BLUEPRINT_AUTHORING_MAX_REPAIRS - request.repairOrdinal;
    // repair 1 authorizes generation attempt 2: two generations remain; repair 2: one.
    const canonicalRemainingGenerationCalls =
      BLUEPRINT_AUTHORING_MAX_CALLS - request.repairOrdinal;
    if (laterProbeRoutes < 0) {
      throw new Error('blueprint authoring count route budget is invalid');
    }
    const reservationBeforeDispatchMicroUsd =
      blueprintAuthoringProbeReservationMicroUsd({
        accountedMicroUsd: accountedBeforeProbe,
        provenUpperBoundTokens: upperBound,
        remainingGenerationCalls: canonicalRemainingGenerationCalls,
        laterProbeRoutes,
      });

    const entryPromise = (async (): Promise<RunnerCountCacheEntry> => {
      let result: BlueprintAuthoringExactInputTokenCountResult;
      let status: BlueprintAuthoringProbeCostEvidence['status'];
      let debitMicroUsd = 0;
      let transportDisposition: BlueprintAuthoringProbeCostEvidence['transportDisposition'] =
        'not_dispatched';
      let recordedReservation: number | null = null;

      if (!args.source) {
        status = 'not_wired';
        result = boundedCountUnavailableResult({ request, reason: 'not_wired' });
      } else if (
        reservationBeforeDispatchMicroUsd >
        BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD
      ) {
        status = 'reservation_rejected';
        recordedReservation = reservationBeforeDispatchMicroUsd;
        result = boundedCountUnavailableResult({
          request,
          reason: 'count_cost_reservation_exceeded',
        });
      } else {
        status = 'cache_miss';
        recordedReservation = reservationBeforeDispatchMicroUsd;
        let raw: unknown;
        try {
          raw = await args.source(request);
        } catch {
          raw = boundedCountUnavailableResult({
            request,
            reason: 'count_transport_failed',
          });
        }
        const consumptionReason = blueprintAuthoringCountResultConsumptionReason(
          raw,
          request,
          upperBound,
        );
        result =
          consumptionReason === null || consumptionReason !== 'count_binding_mismatch'
            ? structuredClone(raw as BlueprintAuthoringExactInputTokenCountResult)
            : boundedCountUnavailableResult({
                request,
                reason: 'count_evidence_invalid',
              });
        const counted =
          consumptionReason === null && result.outcome === 'counted';
        debitMicroUsd = blueprintAuthoringProbeDebitMicroUsd({
          outcome: counted ? 'counted' : 'malformed_after_dispatch',
          ...(counted ? { exactInputTokens: result.inputTokens as number } : {}),
          provenUpperBoundTokens: upperBound,
        });
        transportDisposition = blueprintAuthoringCountResultTransportWasDispatched(raw)
          ? 'dispatched'
          : 'assumed_dispatched';
      }

      if (
        cumulativeProbeDebitMicroUsd >
        Number.MAX_SAFE_INTEGER - debitMicroUsd
      ) {
        throw new Error('blueprint authoring probe debit overflow');
      }
      cumulativeProbeDebitMicroUsd += debitMicroUsd;
      return {
        result,
        firstProbe: {
          status,
          reservationBeforeDispatchMicroUsd: recordedReservation,
          debitMicroUsd,
          cumulativeDebitMicroUsd: cumulativeProbeDebitMicroUsd,
          transportDisposition,
        },
      };
    })();
    cache.set(requestKey, entryPromise);
    const entry = await entryPromise;
    enqueue(requestKey, entry.firstProbe);
    return structuredClone(entry.result);
  };

  return {
    counter,
    consumeProbeEvent(request) {
      const requestKey = blueprintAuthoringCountCacheKey(request);
      const queue = pendingEvents.get(requestKey);
      const event = queue?.shift() ?? null;
      if (queue?.length === 0) pendingEvents.delete(requestKey);
      return event;
    },
    cumulativeProbeDebitMicroUsd: () => cumulativeProbeDebitMicroUsd,
  };
}

function buildRunnerAdmissionDecision(args: {
  kind: 'initial' | 'repair';
  ordinal: 0 | 1 | 2;
  systemPrompt: string;
  userPrompt: string;
  options: PreRenderBlueprintAuthoringCallOptions;
  inputAccounting: BlueprintAuthoringInputAccounting;
  decision: BlueprintAuthoringInputTokenAdmissionDecision;
  probe: BlueprintAuthoringProbeCostEvidence;
  generationAccountedMicroUsdBeforeRoute: number;
}): BlueprintAuthoringAdmissionDecisionRecord {
  if (
    args.decision.basis === 'invalid_accounting' ||
    args.decision.conservativeUpperBoundTokens === null ||
    args.ordinal !== (args.kind === 'initial' ? 0 : args.ordinal) ||
    (args.kind === 'repair' && args.ordinal === 0)
  ) {
    throw new Error('blueprint authoring admission decision cannot be recorded');
  }
  const generationAttempt = (args.ordinal + 1) as 1 | 2 | 3;
  const totalAccountedMicroUsdBeforeGeneration =
    args.generationAccountedMicroUsdBeforeRoute +
    args.probe.cumulativeDebitMicroUsd;
  if (
    !Number.isSafeInteger(totalAccountedMicroUsdBeforeGeneration) ||
    totalAccountedMicroUsdBeforeGeneration < 0
  ) {
    throw new Error('blueprint authoring admission total cost is invalid');
  }
  const remainingGenerationCalls =
    BLUEPRINT_AUTHORING_MAX_CALLS - args.ordinal;
  const laterProbeRoutes =
    BLUEPRINT_AUTHORING_MAX_REPAIRS - args.ordinal;
  let continuationReservationMicroUsd: number | null = null;
  let failureReason: BlueprintAuthoringAdmissionFailureReason | null = null;
  if (!args.decision.admitted) {
    failureReason =
      args.decision.countResult?.unavailableReason ===
      'count_cost_reservation_exceeded'
        ? 'cost_ceiling_exceeded'
        : args.decision.basis === 'exact_count_unavailable'
          ? 'exact_count_unavailable'
          : 'input_token_ceiling_exceeded';
  } else {
    continuationReservationMicroUsd =
      blueprintAuthoringContinuationReservationMicroUsd({
        accountedMicroUsd: totalAccountedMicroUsdBeforeGeneration,
        remainingGenerationCalls,
        laterProbeRoutes,
      });
    if (
      continuationReservationMicroUsd >
      BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD
    ) {
      failureReason = 'cost_ceiling_exceeded';
    }
  }
  const admitted = args.decision.admitted && failureReason === null;
  const base = {
    version: BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION,
    routeKind: args.kind,
    ordinal: args.ordinal,
    generationAttempt,
    tokenRelevantRequestDigest:
      blueprintAuthoringTokenRelevantRequestDigest({
        model: args.options.model,
        systemPrompt: args.systemPrompt,
        userPrompt: args.userPrompt,
        reasoningEffort: args.options.reasoningEffort,
        schemaName: args.options.jsonSchema.name,
        schema: args.options.jsonSchema.schema,
      }),
    inputAccounting: args.inputAccounting,
    inputAccountingDigest: canonicalJsonDigest(args.inputAccounting),
    basis: args.decision.basis,
    ceilingTokens: args.decision.ceilingTokens,
    conservativeUpperBoundTokens:
      args.decision.conservativeUpperBoundTokens,
    exactInputTokens: args.decision.exactInputTokens,
    countResult: args.decision.countResult
      ? structuredClone(args.decision.countResult)
      : null,
    probe: structuredClone(args.probe),
    generationAccountedMicroUsdBeforeRoute:
      args.generationAccountedMicroUsdBeforeRoute,
    totalAccountedMicroUsdBeforeGeneration,
  } satisfies Omit<
    BlueprintAuthoringAdmissionDecisionRecord,
    'admitted' | 'continuationReservationMicroUsd' | 'failureReason'
  >;
  const record: BlueprintAuthoringAdmissionDecisionRecord = admitted
    ? {
        ...base,
        admitted: true,
        continuationReservationMicroUsd:
          continuationReservationMicroUsd as number,
        failureReason: null,
      }
    : {
        ...base,
        admitted: false,
        continuationReservationMicroUsd,
        failureReason: failureReason as BlueprintAuthoringAdmissionFailureReason,
      };
  const priorProbeCumulativeDebitMicroUsd =
    record.probe.cumulativeDebitMicroUsd - record.probe.debitMicroUsd;
  const reason = blueprintAuthoringAdmissionDecisionConsumptionReason(record, {
    attempt: generationAttempt,
    kind: args.kind,
    systemPrompt: args.systemPrompt,
    userPrompt: args.userPrompt,
    model: args.options.model,
    reasoningEffort: args.options.reasoningEffort,
    schemaName: args.options.jsonSchema.name,
    schema: args.options.jsonSchema.schema,
    generationAccountedMicroUsdBeforeRoute:
      args.generationAccountedMicroUsdBeforeRoute,
    priorProbeCumulativeDebitMicroUsd,
    remainingGenerationCalls,
    laterProbeRoutes,
  });
  if (reason !== null) {
    throw new Error(`blueprint authoring admission record is invalid: ${reason}`);
  }
  return record;
}

export async function runProductionBlueprintAuthoring(args: {
  request: ProductionAuthoringRunRequest;
  context: ProductionAuthoringContext;
  provider?: ProductionAuthoringProvider;
  inputTokenCounter?: BlueprintAuthoringInputTokenCounter;
}): Promise<ProductionAuthoringRunResult> {
  let invalidRequest: string[];
  try {
    invalidRequest = requestIssues(args.request, args.context);
  } catch {
    return deterministicFailedRunResult({
      request: args.request,
      context: args.context,
      failureCode: 'local_processing_failed',
      receipt: failureReceipt({
        request: args.request,
        attempts: [],
        code: 'local_processing_failed',
        diagnosticCountOverride: 1,
        issueCodes: ['local_processing_failed'],
        requestDigestOverride: canonicalJsonDigest({
          state: 'request_digest_unavailable',
        }),
      }),
    });
  }
  if (invalidRequest.length > 0) {
    throw new InvalidProductionAuthoringRunRequestError(invalidRequest);
  }
  const config: PreRenderBlueprintAuthoringConfig = {
    model: args.request.model,
    reasoningEffort: args.request.reasoningEffort,
    maxOutputTokens: args.request.maxOutputTokens,
    compositionPolicyVersion:
      PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION,
  };
  let contextIssues: string[];
  try {
    contextIssues = preRenderBlueprintAuthoringInputErrors(
      args.context.validationContext,
      config,
    );
  } catch {
    return deterministicFailedRunResult({
      request: args.request,
      context: args.context,
      failureCode: 'local_processing_failed',
      receipt: failureReceipt({
        request: args.request,
        attempts: [],
        code: 'local_processing_failed',
        diagnosticCountOverride: 1,
        issueCodes: ['local_processing_failed'],
      }),
    });
  }
  if (contextIssues.length > 0) {
    return deterministicFailedRunResult({
      request: args.request,
      context: args.context,
      failureCode: 'context_invalid',
      receipt: failureReceipt({
        request: args.request,
        attempts: [],
        code: 'context_invalid',
        diagnosticInputs: contextIssues,
        issueCodes: ['context_invalid'],
      }),
    });
  }
  let promptIssues: string[];
  try {
    promptIssues = productionBlueprintInitialPromptIssues(args.context);
  } catch {
    return deterministicFailedRunResult({
      request: args.request,
      context: args.context,
      failureCode: 'context_invalid',
      receipt: failureReceipt({
        request: args.request,
        attempts: [],
        code: 'context_invalid',
        diagnosticCountOverride: 1,
        issueCodes: ['context_validation_failed'],
      }),
    });
  }
  if (promptIssues.length > 0) {
    return deterministicFailedRunResult({
      request: args.request,
      context: args.context,
      failureCode: 'input_token_ceiling_exceeded',
      receipt: failureReceipt({
        request: args.request,
        attempts: [],
        code: 'input_token_ceiling_exceeded',
        diagnosticInputs: promptIssues,
        issueCodes: ['input_token_ceiling_exceeded'],
      }),
    });
  }
  if (args.request.mode === 'preflight') {
    return preflightRunResult(
      finalizeReceipt({
        version: PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
        requestDigest: canonicalJsonDigest(args.request),
        requestId: args.request.requestId,
        requestedAt: args.request.requestedAt,
        mode: 'preflight',
        contextDigest: args.request.contextDigest,
        model: args.request.model,
        reasoningEffort: args.request.reasoningEffort,
        maxOutputTokens: args.request.maxOutputTokens,
        noFallback: true,
        callBudget: args.request.callBudget,
        status: 'preflight_passed',
        callCount: 0,
        repairCount: 0,
        executionAttestation:
          notRunAuthoringExecutionAttestation(),
        attempts: [],
        admissionDecisions: [],
        diagnosticCensusCommitment: null,
        blueprintDigest: null,
        authoringProvenanceDigest: null,
        failure: null,
      }),
    );
  }
  if (!args.provider) {
    throw new InvalidProductionAuthoringRunRequestError([
      'live mode requires an explicitly injected provider adapter',
    ]);
  }

  const attempts: ProductionAuthoringAttemptReceipt[] = [];
  const admissionDecisions: BlueprintAuthoringAdmissionDecisionRecord[] = [];
  const pendingAdmissionByAttempt = new Map<
    2 | 3,
    BlueprintAuthoringAdmissionDecisionRecord
  >();
  let callBudgetExhausted = false;
  let cumulativeConservativeCostUsd = 0;
  let generationAccountedMicroUsd = 0;
  const countAuthority = createBlueprintAuthoringRunnerCountAuthority({
    source: args.inputTokenCounter,
    generationAccountedMicroUsd: () => generationAccountedMicroUsd,
  });
  try {
    const authoringResult = await compilePreRenderBookVisualBlueprint(
      args.context.validationContext,
      config,
      {
        callAuthor: async (systemPrompt, userPrompt, options) => {
          const attempt = attempts.length + 1;
          if (attempt > args.request.callBudget.maxCalls) {
            callBudgetExhausted = true;
            throw new AuthoringCallBudgetError();
          }
          const kind = attempt === 1 ? 'initial' : 'repair';
          const expectedInputAccounting =
            blueprintAuthoringInputAccounting({
              systemPrompt,
              userPrompt,
              schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
            });
          const expectedReservedExposureBeforeCallUsd =
            blueprintAuthoringReservedExposureUsd({
              conservativeAccountedCostUsd:
                cumulativeConservativeCostUsd,
              callsCompleted: attempt - 1,
            });
          // The initial route uses the shared conservative admission authority here.
          // Repair routes receive their compiler/count-authority decision through
          // `pendingAdmissionByAttempt` below, including exact provider-count evidence
          // when the conservative byte bound alone cannot admit the route.
          const inputAdmission = decideBlueprintAuthoringInputTokenAdmission({
            accounting: expectedInputAccounting,
          });
          let admissionRecord: BlueprintAuthoringAdmissionDecisionRecord;
          if (attempt === 1) {
            admissionRecord = buildRunnerAdmissionDecision({
              kind: 'initial',
              ordinal: 0,
              systemPrompt,
              userPrompt,
              options,
              inputAccounting: expectedInputAccounting,
              decision: inputAdmission,
              probe: {
                status: 'not_required',
                reservationBeforeDispatchMicroUsd: null,
                debitMicroUsd: 0,
                cumulativeDebitMicroUsd:
                  countAuthority.cumulativeProbeDebitMicroUsd(),
                transportDisposition: 'not_dispatched',
              },
              generationAccountedMicroUsdBeforeRoute:
                generationAccountedMicroUsd,
            });
            admissionDecisions.push(admissionRecord);
          } else {
            const repairAttempt = attempt as 2 | 3;
            const pending = pendingAdmissionByAttempt.get(repairAttempt);
            pendingAdmissionByAttempt.delete(repairAttempt);
            if (!pending) {
              throw new ProductionAuthoringProviderBoundaryError(
                'provider_evidence_invalid',
                {},
                'boundary_reason_invalid',
              );
            }
            admissionRecord = pending;
          }
          const admissionReason =
            blueprintAuthoringAdmissionDecisionConsumptionReason(
              admissionRecord,
              {
                attempt: attempt as 1 | 2 | 3,
                kind,
                systemPrompt,
                userPrompt,
                model: options.model,
                reasoningEffort: options.reasoningEffort,
                schemaName: options.jsonSchema.name,
                schema: options.jsonSchema.schema,
                generationAccountedMicroUsdBeforeRoute:
                  generationAccountedMicroUsd,
                priorProbeCumulativeDebitMicroUsd:
                  admissionRecord.probe.cumulativeDebitMicroUsd -
                  admissionRecord.probe.debitMicroUsd,
                remainingGenerationCalls:
                  BLUEPRINT_AUTHORING_MAX_CALLS -
                  admissionRecord.ordinal,
                laterProbeRoutes:
                  BLUEPRINT_AUTHORING_MAX_REPAIRS -
                  admissionRecord.ordinal,
              },
            );
          if (admissionReason !== null) {
            throw new ProductionAuthoringProviderBoundaryError(
              'provider_evidence_invalid',
              {},
              'boundary_reason_invalid',
            );
          }
          const base = {
            attempt,
            kind,
            provider: 'openai',
            model: args.request.model,
            responseId: null,
            systemPromptDigest: canonicalJsonDigest(systemPrompt),
            userPromptDigest: canonicalJsonDigest(userPrompt),
            responseDigest: null,
            usage: null,
            providerEvidenceVersion: null,
            completionStatus: null,
            usageEvidenceComplete: false,
            inputAccounting: null,
            reservedExposureBeforeCallUsd: null,
            nominalEstimatedCostUsd: null,
            conservativeCallCostUsd: null,
            cumulativeConservativeCostUsd: null,
            executionAttestation:
              notRunAuthoringExecutionAttestation(),
            validationDiagnostics: emptyAuthoringValidationDiagnostics(),
            diagnosticCensusCommitment: null,
            failureCode: null,
            failureEvidenceKind: null,
            failureEvidenceReason: null,
            inputAdmissionDigest: canonicalJsonDigest(admissionRecord),
            tokenRelevantRequestDigest:
              admissionRecord.tokenRelevantRequestDigest,
          } satisfies ProductionAuthoringAttemptReceipt;
          try {
            if (
              !admissionRecord.admitted ||
              !blueprintAuthoringSpendIsWithinCeiling(
                expectedReservedExposureBeforeCallUsd,
              )
            ) {
              const failureCode: ProductionAuthoringAttemptFailureCode =
                !admissionRecord.admitted
                  ? admissionRecord.failureReason === 'cost_ceiling_exceeded'
                    ? 'cost_ceiling_exceeded'
                    : 'input_token_ceiling_exceeded'
                  : 'cost_ceiling_exceeded';
              attempts.push({
                ...base,
                inputAccounting: expectedInputAccounting,
                reservedExposureBeforeCallUsd:
                  expectedReservedExposureBeforeCallUsd,
                cumulativeConservativeCostUsd,
                failureCode,
                failureEvidenceKind: 'compiler_pre_dispatch',
                failureEvidenceReason:
                  failureCode === 'input_token_ceiling_exceeded'
                    ? 'input_ceiling_exceeded'
                    : 'spend_reservation_exceeded',
              });
              throw new ProductionAuthoringProviderBoundaryError(
                failureCode,
                {},
                failureCode === 'input_token_ceiling_exceeded'
                  ? 'input_ceiling_exceeded'
                  : 'spend_reservation_exceeded',
              );
            }
            const response = await args.provider!.call({
              attempt,
              kind,
              systemPrompt,
              userPrompt,
              options,
              inputAdmission: structuredClone(admissionRecord),
            });
            const providerMatches =
              response.receipt.provider === 'openai';
            const modelMatches =
              response.receipt.model === BLUEPRINT_AUTHORING_MODEL;
            const provider = providerMatches
              ? 'openai'
              : 'unknown-provider';
            const model = modelMatches
              ? BLUEPRINT_AUTHORING_MODEL
              : 'unknown-model';
            const responseId =
              typeof response.receipt.responseId === 'string' &&
              /^[A-Za-z0-9_-]{1,200}$/.test(
                response.receipt.responseId,
              )
                ? response.receipt.responseId
                : null;
            const output =
              typeof response.output === 'string'
                ? response.output
                : '';
            const usage = canonicalUsage(response.receipt.usage);
            const nominalEstimatedCostUsd = usage
              ? nominalBlueprintAuthoringUsageCostUsd(usage)
              : null;
            const conservativeCallCostUsd = usage
              ? conservativeBlueprintAuthoringCostUsd({
                  inputTokens: usage.inputTokens,
                  outputTokens: usage.outputTokens,
                })
              : null;
            const nextCumulativeConservativeCostUsd =
              conservativeCallCostUsd === null
                ? null
                : cumulativeConservativeCostUsd +
                  conservativeCallCostUsd;
            const executionAttestation =
              canonicalCompletedExecutionAttestationIsValid(
                response.receipt.executionAttestation,
              )
                ? response.receipt.executionAttestation
                : injectedAuthoringExecutionAttestation();
            const received = {
              ...base,
              provider,
              model,
              responseId,
              responseDigest: canonicalJsonDigest(output),
              usage: usage ? safeUsageFromCanonical(usage) : null,
              providerEvidenceVersion:
                response.receipt.evidenceVersion ===
                OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION
                ? OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION
                : null,
              completionStatus:
                response.receipt.completionStatus === 'completed'
                ? 'completed'
                : null,
              usageEvidenceComplete:
                response.receipt.usageEvidenceComplete === true,
              inputAccounting: expectedInputAccounting,
              reservedExposureBeforeCallUsd:
                expectedReservedExposureBeforeCallUsd,
              nominalEstimatedCostUsd,
              conservativeCallCostUsd,
              cumulativeConservativeCostUsd:
                nextCumulativeConservativeCostUsd,
              executionAttestation,
            } satisfies ProductionAuthoringAttemptReceipt;
            const recordBoundaryFailure = (
              failureCode: ProductionAuthoringAttemptFailureCode,
              failureEvidenceReason: ProductionAuthoringAttemptFailureEvidenceReason,
            ): never => {
              attempts.push({
                ...received,
                failureCode,
                failureEvidenceKind: 'compiler_response_boundary',
                failureEvidenceReason,
              });
              throw new ProductionAuthoringProviderBoundaryError(
                failureCode,
                {},
                failureEvidenceReason,
              );
            };
            if (
              !providerMatches ||
              !modelMatches
            ) {
              recordBoundaryFailure(
                'provider_policy_mismatch',
                'provider_identity_mismatch',
              );
            }
            if (
              received.providerEvidenceVersion !==
              OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION
            ) {
              recordBoundaryFailure(
                'provider_evidence_invalid',
                'provider_evidence_version_invalid',
              );
            }
            if (!responseId) {
              recordBoundaryFailure(
                'provider_evidence_invalid',
                'response_id_invalid',
              );
            }
            if (!output.trim()) {
              recordBoundaryFailure(
                'provider_evidence_invalid',
                'response_output_empty',
              );
            }
            if (
              !canonicalCompletedExecutionAttestationIsValid(
                response.receipt.executionAttestation,
              )
            ) {
              recordBoundaryFailure(
                'provider_evidence_invalid',
                'execution_attestation_invalid',
              );
            }
            if (received.completionStatus !== 'completed') {
              recordBoundaryFailure(
                'completion_status_invalid',
                'completion_status_invalid',
              );
            }
            if (
              !received.usageEvidenceComplete ||
              !usage ||
              usage.inputTokens > BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS ||
              usage.outputTokens > BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS ||
              (admissionRecord.exactInputTokens !== null &&
                usage.inputTokens !== admissionRecord.exactInputTokens)
            ) {
              recordBoundaryFailure('usage_invalid', 'usage_invalid');
            }
            const costEvidenceMatches =
              blueprintAuthoringInputAccountingIsValid(
                response.receipt.inputAccounting,
              ) &&
              canonicalJsonDigest(response.receipt.inputAccounting) ===
                canonicalJsonDigest(expectedInputAccounting) &&
              response.receipt.reservedExposureBeforeCallUsd ===
                expectedReservedExposureBeforeCallUsd &&
              response.receipt.nominalEstimatedCostUsd ===
                nominalEstimatedCostUsd &&
              response.receipt.conservativeCallCostUsd ===
                conservativeCallCostUsd;
            if (!costEvidenceMatches) {
              recordBoundaryFailure(
                'provider_evidence_invalid',
                'cost_evidence_mismatch',
              );
            }
            const acceptedCumulativeConservativeCostUsd =
              nextCumulativeConservativeCostUsd ??
              recordBoundaryFailure(
                'cost_ceiling_exceeded',
                'cost_evidence_mismatch',
              );
            if (
              !blueprintAuthoringSpendIsWithinCeiling(
                acceptedCumulativeConservativeCostUsd,
              )
            ) {
              recordBoundaryFailure(
                'cost_ceiling_exceeded',
                'cost_ceiling_exceeded',
              );
            }
            cumulativeConservativeCostUsd =
              acceptedCumulativeConservativeCostUsd;
            const acceptedGenerationMicroUsd =
              blueprintAuthoringGenerationMicroUsd({
                inputTokens: usage!.inputTokens,
                outputTokens: usage!.outputTokens,
              });
            if (
              generationAccountedMicroUsd >
              Number.MAX_SAFE_INTEGER - acceptedGenerationMicroUsd
            ) {
              recordBoundaryFailure(
                'cost_ceiling_exceeded',
                'cost_evidence_mismatch',
              );
            }
            generationAccountedMicroUsd += acceptedGenerationMicroUsd;
            const countAwareAccountedMicroUsd =
              generationAccountedMicroUsd +
              countAuthority.cumulativeProbeDebitMicroUsd();
            if (
              !Number.isSafeInteger(countAwareAccountedMicroUsd) ||
              countAwareAccountedMicroUsd >
                BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD
            ) {
              recordBoundaryFailure(
                'cost_ceiling_exceeded',
                'cost_ceiling_exceeded',
              );
            }
            attempts.push(received);
            return output;
          } catch (error) {
            if (
              !attempts.some((entry) => entry.attempt === attempt)
            ) {
              const boundaryError =
                error instanceof
                ProductionAuthoringProviderBoundaryError
                  ? error
                  : null;
              let failureCode: ProductionAuthoringAttemptFailureCode =
                error instanceof AuthoringCallBudgetError
                  ? 'call_budget_exhausted'
                  : boundaryError
                    ? boundaryError.failureCode
                    : 'provider_call_failed';
              let failureEvidenceReason: ProductionAuthoringAttemptFailureEvidenceReason =
                boundaryError &&
                PRODUCTION_AUTHORING_ATTEMPT_FAILURE_EVIDENCE_REASONS.includes(
                  boundaryError.failureEvidenceReason,
                )
                  ? boundaryError.failureEvidenceReason
                  : boundaryError
                    ? 'boundary_reason_invalid'
                    : 'raw_provider_exception';
              const evidence = boundaryError?.evidence;
              const evidenceUsage = canonicalUsage(
                evidence?.usage,
              );
              const evidenceNominalEstimatedCostUsd = evidenceUsage
                ? nominalBlueprintAuthoringUsageCostUsd(evidenceUsage)
                : null;
              const evidenceConservativeCallCostUsd = evidenceUsage
                ? conservativeBlueprintAuthoringCostUsd({
                    inputTokens: evidenceUsage.inputTokens,
                    outputTokens: evidenceUsage.outputTokens,
                  })
                : null;
              const evidenceCumulativeConservativeCostUsd =
                evidenceConservativeCallCostUsd === null
                  ? cumulativeConservativeCostUsd
                  : cumulativeConservativeCostUsd +
                    evidenceConservativeCallCostUsd;
              const accountingEvidenceMatches =
                blueprintAuthoringInputAccountingIsValid(
                  evidence?.inputAccounting,
                ) &&
                canonicalJsonDigest(evidence.inputAccounting) ===
                  canonicalJsonDigest(expectedInputAccounting) &&
                evidence?.reservedExposureBeforeCallUsd ===
                  expectedReservedExposureBeforeCallUsd;
              const usageCostEvidenceMatches = evidenceUsage
                ? evidence?.usageEvidenceComplete === true &&
                  evidence.nominalEstimatedCostUsd ===
                    evidenceNominalEstimatedCostUsd &&
                  evidence.conservativeCallCostUsd ===
                    evidenceConservativeCallCostUsd &&
                  evidence.cumulativeConservativeCostUsd ===
                    evidenceCumulativeConservativeCostUsd
                : (evidence?.usage === null ||
                    evidence?.usage === undefined) &&
                  (evidence?.nominalEstimatedCostUsd === null ||
                    evidence?.nominalEstimatedCostUsd === undefined) &&
                  (evidence?.conservativeCallCostUsd === null ||
                    evidence?.conservativeCallCostUsd === undefined) &&
                  (evidence?.cumulativeConservativeCostUsd === null ||
                    evidence?.cumulativeConservativeCostUsd === undefined);
              let evidenceExecutionAttestation =
                notRunAuthoringExecutionAttestation();
              const rawEvidenceExecutionAttestation =
                evidence?.executionAttestation;
              const evidenceExecutionAttestationIsValid =
                authoringExecutionAttestationIsValid(
                  rawEvidenceExecutionAttestation,
                );
              if (evidenceExecutionAttestationIsValid) {
                evidenceExecutionAttestation =
                  rawEvidenceExecutionAttestation;
              }
              const identityEvidenceKeysPresent =
                evidence !== undefined &&
                Object.prototype.hasOwnProperty.call(
                  evidence,
                  'provider',
                ) &&
                Object.prototype.hasOwnProperty.call(
                  evidence,
                  'model',
                );
              if (
                boundaryError &&
                (evidence?.providerEvidenceVersion !==
                  OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION ||
                  !accountingEvidenceMatches ||
                  !usageCostEvidenceMatches ||
                  !evidenceExecutionAttestationIsValid ||
                  !identityEvidenceKeysPresent)
              ) {
                failureCode = 'provider_evidence_invalid';
                failureEvidenceReason = 'boundary_reason_invalid';
              }
              attempts.push({
                ...base,
                provider:
                  evidence?.provider === 'openai'
                    ? 'openai'
                    : boundaryError
                      ? 'unknown-provider'
                      : base.provider,
                model:
                  evidence?.model === BLUEPRINT_AUTHORING_MODEL
                    ? BLUEPRINT_AUTHORING_MODEL
                    : boundaryError
                      ? 'unknown-model'
                      : base.model,
                responseId:
                  typeof evidence?.responseId === 'string' &&
                  /^[A-Za-z0-9_-]{1,200}$/.test(evidence.responseId)
                    ? evidence.responseId
                    : null,
                responseDigest:
                  typeof evidence?.responseDigest === 'string' &&
                  /^[a-f0-9]{64}$/.test(evidence.responseDigest)
                    ? evidence.responseDigest
                    : null,
                usage: evidenceUsage
                  ? safeUsageFromCanonical(evidenceUsage)
                  : null,
                providerEvidenceVersion:
                  evidence?.providerEvidenceVersion ===
                  OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION
                    ? OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION
                    : null,
                completionStatus:
                  evidence?.completionStatus === 'completed'
                    ? 'completed'
                    : null,
                usageEvidenceComplete:
                  evidence?.usageEvidenceComplete === true,
                inputAccounting: boundaryError
                  ? expectedInputAccounting
                  : null,
                reservedExposureBeforeCallUsd: boundaryError
                  ? expectedReservedExposureBeforeCallUsd
                  : null,
                nominalEstimatedCostUsd:
                  evidenceNominalEstimatedCostUsd,
                conservativeCallCostUsd:
                  evidenceConservativeCallCostUsd,
                cumulativeConservativeCostUsd:
                  boundaryError
                    ? evidenceCumulativeConservativeCostUsd
                    : null,
                executionAttestation:
                  boundaryError
                    ? evidenceExecutionAttestation
                    : injectedAuthoringExecutionAttestation(),
                failureCode,
                failureEvidenceKind: boundaryError
                  ? 'provider_adapter_boundary'
                  : 'raw_provider_exception',
                failureEvidenceReason: boundaryError
                  ? failureEvidenceReason
                  : 'raw_provider_exception',
              });
            }
            throw error;
          }
        },
        inputTokenCounter: countAuthority.counter,
        onInputAdmissionDecision: (event) => {
          const ordinal = event.request.repairOrdinal;
          const generationAttempt = (ordinal + 1) as 2 | 3;
          if (pendingAdmissionByAttempt.has(generationAttempt)) {
            throw new Error(
              'duplicate Blueprint repair admission decision',
            );
          }
          const probeEvent = countAuthority.consumeProbeEvent(event.request);
          const probe = probeEvent?.probe ??
            (event.inputAccounting.estimatedBytes <=
            BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS
              ? {
                  status: 'not_required' as const,
                  reservationBeforeDispatchMicroUsd: null,
                  debitMicroUsd: 0,
                  cumulativeDebitMicroUsd:
                    countAuthority.cumulativeProbeDebitMicroUsd(),
                  transportDisposition: 'not_dispatched' as const,
                }
              : null);
          if (!probe) {
            throw new Error(
              'Blueprint repair admission is missing count-probe evidence',
            );
          }
          const record = buildRunnerAdmissionDecision({
            kind: 'repair',
            ordinal,
            systemPrompt: event.request.systemPrompt,
            userPrompt: event.request.userPrompt,
            options: {
              model: event.request.model as typeof config.model,
              reasoningEffort:
                event.request.reasoningEffort as typeof config.reasoningEffort,
              maxOutputTokens: config.maxOutputTokens,
              jsonSchema: {
                name: event.request.schemaName as typeof PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
                schema: event.request.schema as typeof PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
                strict: true,
              },
              noFallback: true,
            },
            inputAccounting: event.inputAccounting,
            decision: event.decision,
            probe,
            generationAccountedMicroUsdBeforeRoute:
              generationAccountedMicroUsd,
          });
          admissionDecisions.push(record);
          pendingAdmissionByAttempt.set(generationAttempt, record);
        },
      },
    );
    for (const repair of authoringResult.repairAttempts) {
      const receipt = attempts[repair.attempt - 1];
      if (receipt) {
        receipt.validationDiagnostics = sanitizedAuthoringAttemptDiagnostics({
          inputs: repair.errors,
          fallbackCode: 'draft_contract_validation_failed',
        });
        receipt.diagnosticCensusCommitment = repair.diagnostics?.length
          ? blueprintAuthoringDiagnosticCensusCommitment(
              buildBlueprintAuthoringSanitizedCensus(repair.diagnostics),
            )
          : null;
      }
    }
    const receipt = finalizeReceipt({
      version: PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
      requestDigest: canonicalJsonDigest(args.request),
      requestId: args.request.requestId,
      requestedAt: args.request.requestedAt,
      mode: 'live',
      contextDigest: args.request.contextDigest,
      model: args.request.model,
      reasoningEffort: args.request.reasoningEffort,
      maxOutputTokens: args.request.maxOutputTokens,
      noFallback: true,
      callBudget: args.request.callBudget,
      status: 'completed',
      callCount: attempts.length,
      repairCount: Math.max(0, attempts.length - 1),
      executionAttestation:
        aggregateProductionAuthoringExecutionAttestations(
          attempts.map(
            (attempt) => attempt.executionAttestation,
          ),
        ),
      attempts,
      admissionDecisions: structuredClone(admissionDecisions),
      diagnosticCensusCommitment:
        authoringResult.repairAttempts.some(
          (attempt) => (attempt.diagnostics?.length ?? 0) > 0,
        )
          ? blueprintAuthoringDiagnosticCensusCommitment(
              buildBlueprintAuthoringSanitizedCensus(
                authoringResult.repairAttempts.flatMap(
                  (attempt) => attempt.diagnostics ?? [],
                ),
              ),
            )
          : null,
      blueprintDigest: authoringResult.blueprint.digest,
      authoringProvenanceDigest: canonicalJsonDigest(
        authoringResult.provenance,
      ),
      failure: null,
    });
    return completedRunResult(receipt, authoringResult);
  } catch (error) {
    if (
      error instanceof PreRenderBlueprintAuthoringRepairExhaustedError ||
      error instanceof PreRenderBlueprintRepairInputNotAdmissibleError
    ) {
      copyValidationAttemptEvidence({
        sourceAttempts: error.attempts,
        receipts: attempts,
      });
    }
    const budgetFailure =
      callBudgetExhausted ||
      error instanceof AuthoringCallBudgetError ||
      attempts.some(
        (attempt) => attempt.failureCode === 'call_budget_exhausted',
      );
    const providerFailure = attempts.some(
      (attempt) => attempt.failureCode === 'provider_call_failed',
    );
    const terminalAttemptFailure = [...attempts]
      .reverse()
      .find((attempt) => attempt.failureCode !== null)
      ?.failureCode;
    const exactBoundaryFailure: AuthoringTerminalFailureCode | null =
      terminalAttemptFailure === 'provider_policy_mismatch'
        ? 'provider_policy_mismatch'
        : terminalAttemptFailure === 'provider_evidence_invalid'
            ? 'provider_evidence_invalid'
            : terminalAttemptFailure === 'completion_status_invalid'
              ? 'completion_status_invalid'
              : terminalAttemptFailure === 'usage_invalid'
                ? 'usage_invalid'
                : terminalAttemptFailure ===
                    'input_token_ceiling_exceeded'
                  ? 'input_token_ceiling_exceeded'
                : terminalAttemptFailure === 'cost_ceiling_exceeded'
                  ? 'cost_ceiling_exceeded'
                : null;
    const failureCode: ProductionBlueprintRunnerTerminalFailureCode = budgetFailure
      ? 'call_budget_exhausted'
      : providerFailure
        ? 'provider_call_failed'
        : error instanceof PreRenderBlueprintRepairInputNotAdmissibleError
          ? 'repair_route_input_not_admissible'
          : exactBoundaryFailure ??
          (error instanceof
              PreRenderBlueprintAuthoringRepairExhaustedError &&
            productionRepairExhaustionIsProven({
              error,
              request: args.request,
              attempts,
            })
          ? 'draft_validation_repair_exhausted'
          : 'local_processing_failed');
    let failureCensus: BlueprintAuthoringSanitizedCensus | null = null;
    let failureAttemptCensuses: BlueprintAuthoringSanitizedAttemptCensus[] = [];
    if (
      error instanceof PreRenderBlueprintAuthoringRepairExhaustedError ||
      error instanceof PreRenderBlueprintRepairInputNotAdmissibleError
    ) {
      try {
        failureAttemptCensuses = error.attempts.flatMap((attempt, index) => {
          if (attempt.attempt !== index + 1) {
            throw new Error('per-attempt diagnostic census source is noncanonical');
          }
          if (!attempt.diagnostics || attempt.diagnostics.length === 0) {
            return [];
          }
          return [{
            attempt: attempt.attempt,
            census: buildBlueprintAuthoringSanitizedCensus(attempt.diagnostics),
          }];
        });
        failureCensus = mergeBlueprintAuthoringSanitizedCensuses(
          failureAttemptCensuses.map((entry) => entry.census),
        );
      } catch {
        failureAttemptCensuses = [];
        failureCensus = null;
      }
      if (failureAttemptCensuses.length === 0) {
        try {
          const diagnostics = error.attempts.flatMap(
            (attempt) => attempt.diagnostics ?? [],
          );
          if (diagnostics.length > 0) {
            failureCensus = buildBlueprintAuthoringSanitizedCensus(diagnostics);
          }
        } catch {
          failureCensus = null;
        }
      }
    }
    const failed = failureReceipt({
      request: args.request,
      attempts,
      admissionDecisions,
      diagnosticCensusCommitment: failureCensus
        ? blueprintAuthoringDiagnosticCensusCommitment(failureCensus)
        : null,
      code: failureCode,
      diagnosticInputs:
        error instanceof
          PreRenderBlueprintAuthoringRepairExhaustedError ||
        error instanceof PreRenderBlueprintRepairInputNotAdmissibleError
          ? error.attempts.flatMap(
              (attempt) => attempt.errors,
            )
          : [],
      diagnosticCountOverride:
        error instanceof
          PreRenderBlueprintAuthoringRepairExhaustedError ||
        error instanceof PreRenderBlueprintRepairInputNotAdmissibleError
          ? error.attempts.reduce(
              (sum, attempt) =>
                sum + attempt.errors.length,
              0,
            )
          : 1,
      issueCodes: [failureCode],
    });
    return failedRunResult(
      failed,
      deriveBlueprintAuthoringSanitizedFailureCaptureDisposition({
        request: args.request,
        context: args.context,
        attempts,
        error,
        failureReceipt: failed,
        failureCode,
        census: failureCensus,
        attemptCensuses: failureAttemptCensuses,
        admissionDecisions,
      }),
    );
  }
}

/**
 * A NARROW request-linkage + digest-self-consistency + topology-consistency check on a
 * failed receipt. It is deliberately NOT the full runtime receipt-schema validator — that
 * authority is `productionBlueprintAuthoringReceiptReplayIsValid`, which the lifecycle runs
 * on this exact receipt at first publication (`receipt_replay_validation`) and again at
 * replay/recovery. This check is the runner-internal precondition the census derivation
 * needs: before trusting `failureReceipt.attempts`, prove the receipt's OWN digest is
 * self-consistent and its request/context linkage + failure code + call topology bind THIS
 * request, so a forged receipt (a self-consistent digest over unrelated request/context
 * data, or a stale digest) cannot smuggle an attempt list into the census. It re-uses the
 * same canonical digest logic (`canonicalJsonDigest` over the digest-free payload) the
 * receipt was minted with — it does not re-implement the full replay validator.
 */
function failedReceiptRequestLinkageIsConsistent(args: {
  receipt: ProductionAuthoringRunReceipt;
  request: ProductionAuthoringRunRequest;
  failureCode: ProductionBlueprintRunnerTerminalFailureCode;
}): boolean {
  const { receipt, request } = args;
  if (receipt.status !== 'failed') return false;
  if (receipt.digestAlgorithm !== 'canonical-json-sha256') return false;
  const { digest, digestAlgorithm: _algorithm, ...payload } = receipt;
  void _algorithm;
  if (canonicalJsonDigest(receiptPayload(payload)) !== digest) return false;
  if (receipt.failure?.code !== args.failureCode) return false;
  if (receipt.requestDigest !== canonicalJsonDigest(request)) return false;
  if (receipt.contextDigest !== request.contextDigest) return false;
  if (
    receipt.requestId !== request.requestId ||
    receipt.requestedAt !== request.requestedAt ||
    receipt.mode !== request.mode ||
    receipt.model !== request.model ||
    receipt.reasoningEffort !== request.reasoningEffort ||
    receipt.maxOutputTokens !== request.maxOutputTokens ||
    receipt.noFallback !== request.noFallback ||
    canonicalJsonDigest(receipt.callBudget) !==
      canonicalJsonDigest(request.callBudget)
  ) {
    return false;
  }
  if (
    receipt.callCount !== receipt.attempts.length ||
    receipt.repairCount !== Math.max(0, receipt.attempts.length - 1)
  ) {
    return false;
  }
  return true;
}

/**
 * Runner-private MINT AUTHORIZATION for sanitized failure captures, bound to the EXACT
 * IMMUTABLE mint-time CONTENT (not merely a mutable object identity). ONLY the same-stack
 * private derivation registers the captures it mints here, snapshotting the exact canonical
 * bytes at mint time. The dedicated capture-specific production persister
 * (`persistBlueprintAuthoringSanitizedFailureCapture`) refuses any capture that is not
 * registered OR whose current serialization does not byte-equal its mint-time snapshot, and
 * then writes the SNAPSHOT bytes (never bytes re-derived from the caller-visible object).
 *
 * This is the STRUCTURAL boundary on the capture-specific production PERSISTENCE API. It is
 * NOT a claim that arbitrary code cannot write bytes (generic immutable writers exist); it
 * stops an exported composition
 * (`blueprintAuthoringFailedCensusCorrelationDiagnostics` + `buildBlueprintAuthoringSanitizedFailureCapture`
 * + `persistBlueprintAuthoringSanitizedFailureCapture`) — which CAN build a validator-valid
 * in-memory contradictory capture — from PERSISTING it through this dedicated API, including
 * the harder attack of taking a legitimately registered capture returned by
 * `runProductionBlueprintAuthoring` and MUTATING it in place (`Object.assign`/nested
 * field/digest rewrite) while preserving its object reference: captures are mutable and
 * unfrozen, so identity alone is insufficient; the content snapshot detects any post-mint
 * mutation and the write uses the immutable snapshot bytes, closing the TOCTOU/getter gap. The
 * map is module-private (never exported), so no external code can register a forgery.
 */
const runnerMintedFailureCaptureBytes = new WeakMap<
  BlueprintAuthoringSanitizedFailureCapture,
  string
>();

/**
 * PURE, NON-AUTHORITY census correlation checker. Returns the ORDERED census diagnostics
 * when the failed receipt's request linkage, attempt TOPOLOGY, and per-attempt category
 * summary ({count,codes}) are internally consistent with the compiler-owned structured
 * diagnostics, else `null`. It NEVER builds, mints, links, or publishes a capture or a
 * disposition — it only returns already-supplied diagnostics or `null`, so it cannot
 * produce authority. It is exported solely so these receipt-consistency invariants can be
 * unit-tested directly.
 *
 * ## Scope — this is NOT the census-identity security boundary
 *
 * A pure check over an externally supplied (errors, diagnostics) pair CANNOT prove which
 * structural identity produced a delimiter-colliding error string: two diagnostics with
 * different sanitized census identities can share one byte-identical error string, and a
 * caller could supply a receipt attempt whose one error string was produced from identity A
 * while passing the structurally-distinct diagnostic B. No pairwise text/digest map over the
 * supplied pair can resolve that. So identity honesty is provided STRUCTURALLY, not here:
 * the disposition-minting `deriveBlueprintAuthoringSanitizedFailureCaptureDisposition` is
 * runner-PRIVATE (not exported); its capture-minting path is fed the compiler's OWN
 * error/diagnostics in the same synchronous stack (its deterministic-failure caller passes
 * `error: undefined` and cannot mint), whose per-position error strings ARE the canonical
 * projections of those diagnostics. The minted capture is then content-addressed, atomically
 * linked to the receipt by the lifecycle, and content-bound at the dedicated persister;
 * replay/recovery re-read that capture and NEVER re-derive. The checks here are the
 * receipt-consistency gate over that sealed input — defense in depth, not the boundary.
 */
export function blueprintAuthoringFailedCensusCorrelationDiagnostics(args: {
  request: ProductionAuthoringRunRequest;
  attempts: readonly ProductionAuthoringAttemptReceipt[];
  error: unknown;
  failureReceipt: ProductionAuthoringRunReceipt;
  failureCode: ProductionBlueprintRunnerTerminalFailureCode;
}): PreRenderBlueprintRepairDiagnostic[] | null {
  // Prove the receipt's OWN digest is self-consistent and its request/context linkage +
  // failure code + call topology bind THIS request, so a forged receipt (a self-consistent
  // digest over unrelated data, or a stale digest) cannot smuggle an attempt list into the
  // census. NOTE: this is a NARROW linkage check, not the full runtime receipt-schema
  // validator — the lifecycle runs `productionBlueprintAuthoringReceiptReplayIsValid` on this
  // exact receipt at first publication and at replay/recovery.
  if (
    !failedReceiptRequestLinkageIsConsistent({
      receipt: args.failureReceipt,
      request: args.request,
      failureCode: args.failureCode,
    })
  ) {
    return null;
  }
  // The receipt commits (via its digest) to the attempt TOPOLOGY and each attempt's persisted
  // `validationDiagnostics` CATEGORY SUMMARY ({count,codes}) — NOT to the census structural
  // identities. Require the separately-passed `args.attempts` to be canonically identical to
  // the receipt's attempts first, so the census can never be correlated against a different
  // attempt list than the one the receipt digest binds.
  if (
    canonicalJsonDigest(args.attempts) !==
    canonicalJsonDigest(args.failureReceipt.attempts)
  ) {
    return null;
  }
  const receiptAttempts = args.failureReceipt.attempts;
  // Receipt attempts MUST be a clean 1..N sequence — no duplicate, missing, or non-sequential
  // attempt number (a duplicate would otherwise let one source be counted twice).
  for (let index = 0; index < receiptAttempts.length; index += 1) {
    if (receiptAttempts[index]!.attempt !== index + 1) {
      return null;
    }
  }
  // Index the compiler-owned structured source by attempt number, retaining BOTH the raw
  // error strings (the exact source the receipt's `validationDiagnostics` summary was derived
  // from) and the structured diagnostics (the census source). A non-safe, out-of-range
  // (outside 1..N), or duplicated source attempt number is REJECTED — never silently skipped.
  const evidenceByAttempt = new Map<
    number,
    { errors: string[]; diagnostics: PreRenderBlueprintRepairDiagnostic[] }
  >();
  if (
    args.error instanceof PreRenderBlueprintAuthoringRepairExhaustedError ||
    args.error instanceof PreRenderBlueprintRepairInputNotAdmissibleError
  ) {
    for (const attempt of args.error.attempts) {
      if (
        !Number.isSafeInteger(attempt.attempt) ||
        attempt.attempt < 1 ||
        attempt.attempt > receiptAttempts.length ||
        evidenceByAttempt.has(attempt.attempt)
      ) {
        return null;
      }
      evidenceByAttempt.set(attempt.attempt, {
        errors: Array.isArray(attempt.errors) ? [...attempt.errors] : [],
        diagnostics: attempt.diagnostics ? [...attempt.diagnostics] : [],
      });
    }
  }
  // For every diagnostic-bearing receipt attempt require a matching source whose raw errors
  // RE-DERIVE (via the exact canonical logic used to persist them) to the EXACT persisted
  // {count,codes}, and whose structured diagnostics PROJECT (via the single canonical
  // projection the compiler uses) to the source error array position-for-position. Every
  // source carrying structured diagnostics must map to a matched attempt.
  const censusDiagnostics: PreRenderBlueprintRepairDiagnostic[] = [];
  const matchedAttempts = new Set<number>();
  for (const receiptAttempt of receiptAttempts) {
    const persisted = receiptAttempt.validationDiagnostics;
    const attemptIsDiagnosticBearing =
      persisted.totalCount > 0 || persisted.codes.length > 0;
    if (!attemptIsDiagnosticBearing) {
      if (receiptAttempt.diagnosticCensusCommitment !== null) return null;
      continue;
    }
    const evidence = evidenceByAttempt.get(receiptAttempt.attempt);
    if (!evidence) {
      return null;
    }
    const rederived = sanitizedAuthoringAttemptDiagnostics({
      inputs: evidence.errors,
      fallbackCode: 'draft_contract_validation_failed',
    });
    if (
      canonicalJsonDigest(rederived) !== canonicalJsonDigest(persisted)
    ) {
      return null;
    }
    if (evidence.diagnostics.length === 0) {
      return null;
    }
    let attemptCensus: BlueprintAuthoringSanitizedCensus;
    try {
      attemptCensus = buildBlueprintAuthoringSanitizedCensus(evidence.diagnostics);
    } catch {
      return null;
    }
    if (
      receiptAttempt.diagnosticCensusCommitment === null ||
      canonicalJsonDigest(
        blueprintAuthoringDiagnosticCensusCommitment(attemptCensus),
      ) !== canonicalJsonDigest(receiptAttempt.diagnosticCensusCommitment)
    ) {
      return null;
    }
    const projected = evidence.diagnostics.map(
      preRenderBlueprintRepairDiagnosticErrorText,
    );
    if (
      projected.length !== evidence.errors.length ||
      projected.some((text, position) => text !== evidence.errors[position])
    ) {
      return null;
    }
    matchedAttempts.add(receiptAttempt.attempt);
    censusDiagnostics.push(...evidence.diagnostics);
  }
  for (const [attemptNumber, evidence] of evidenceByAttempt) {
    if (
      evidence.diagnostics.length > 0 &&
      !matchedAttempts.has(attemptNumber)
    ) {
      return null;
    }
  }
  // A required capture with an empty census would be a binding satisfied by nothing.
  if (censusDiagnostics.length === 0) {
    return null;
  }
  return censusDiagnostics;
}

/**
 * Mint the typed sanitized-failure-capture DISPOSITION for a failed run. This is the census
 * disposition authority, and it is deliberately runner-PRIVATE (not exported). It has two
 * runner-owned callers: the main `runProductionBlueprintAuthoring` failed path — which feeds
 * it the compiler's OWN error/diagnostics in the same synchronous stack (per-position error
 * strings ARE the canonical projections of those diagnostics) — and the deterministic-failure
 * path, which passes `error: undefined` with no attempts and therefore cannot mint a capture
 * (diagnostic-less absence).
 *
 * Boundary — stated precisely (NOT "no external caller can create a capture"): the exported
 * checker (`blueprintAuthoringFailedCensusCorrelationDiagnostics`) and builder
 * (`buildBlueprintAuthoringSanitizedFailureCapture`) CAN be composed to create a
 * validator-valid, IN-MEMORY contradictory capture over delimiter-colliding evidence (an
 * A-text receipt string with the distinct diagnostic B). What that composition CANNOT do is:
 * become a runner-authorized disposition here; be registered in the mint-authorization
 * content snapshot; persist through the dedicated capture-specific production persister
 * (`persistBlueprintAuthoringSanitizedFailureCapture`, content-bound to the mint-time
 * snapshot); or be adopted into authoritative terminal publication (the lifecycle publishes
 * only this disposition and re-verifies linkage). A contradictory in-memory capture is
 * therefore inert. The minted capture is content-addressed and, by the lifecycle, atomically
 * linked to this receipt; replay/recovery re-read that capture and never re-derive.
 *
 * Current receipt v8 binds the complete admission ledger and per-attempt diagnostic censuses
 * commitment. The linkage-bound capture repeats those authorities and replay verifies their
 * parity. Legacy receipt v6 remains immutable and therefore carries only attempt topology plus
 * each attempt's category summary ({count,codes}); it is never retrofitted with v7 evidence.
 *
 * The requirement is derived from the ACTUAL failed receipt EVIDENCE via the single canonical
 * `blueprintAuthoringReceiptRequiresSanitizedCapture` predicate (mandatory code OR any attempt
 * with grouped validation diagnostics); a diagnostic-LESS boundary failure is an explicit
 * allowed absence and binds no capture. When required, the census is minted from the
 * diagnostics returned by the pure consistency checker
 * (`blueprintAuthoringFailedCensusCorrelationDiagnostics`); an un-correlatable receipt/source
 * or an overflowing census is `derivation_failed` with a bounded sanitized reason — never a
 * silent null — so the lifecycle drives it into the incident/execution_state_uncertain path.
 * Never reads raw draft/provider output — only structured diagnostics and byte accountings.
 */
function deriveBlueprintAuthoringSanitizedFailureCaptureDisposition(args: {
  request: ProductionAuthoringRunRequest;
  context: ProductionAuthoringContext;
  attempts: readonly ProductionAuthoringAttemptReceipt[];
  error: unknown;
  failureReceipt: ProductionAuthoringRunReceipt;
  failureCode: ProductionBlueprintRunnerTerminalFailureCode;
  census?: BlueprintAuthoringSanitizedCensus | null;
  attemptCensuses?: readonly BlueprintAuthoringSanitizedAttemptCensus[];
  admissionDecisions?: readonly BlueprintAuthoringAdmissionDecisionRecord[];
}): BlueprintAuthoringSanitizedFailureCaptureDisposition {
  if (!blueprintAuthoringReceiptRequiresSanitizedCapture(args.failureReceipt)) {
    // Diagnostic-less boundary failure: allowed to bind no capture.
    return { kind: 'diagnostic_less_absence' };
  }
  const censusDiagnostics = blueprintAuthoringFailedCensusCorrelationDiagnostics({
    request: args.request,
    attempts: args.attempts,
    error: args.error,
    failureReceipt: args.failureReceipt,
    failureCode: args.failureCode,
  });
  if (censusDiagnostics === null) {
    return {
      kind: 'derivation_failed',
      reasonCode: 'sanitized_census_correlation_unproven',
    };
  }
  try {
    const census = args.census ?? null;
    const attemptCensuses = args.attemptCensuses ?? [];
    const admissionDecisions = args.admissionDecisions ?? [];
    if (
      census === null ||
      attemptCensuses.length === 0 ||
      args.failureReceipt.diagnosticCensusCommitment === null ||
      canonicalJsonDigest(
        blueprintAuthoringDiagnosticCensusCommitment(census),
      ) !== canonicalJsonDigest(args.failureReceipt.diagnosticCensusCommitment) ||
      canonicalJsonDigest(admissionDecisions) !==
        canonicalJsonDigest(args.failureReceipt.admissionDecisions) ||
      attemptCensuses.some((entry) => {
        const receiptAttempt = args.failureReceipt.attempts[entry.attempt - 1];
        return (
          !receiptAttempt ||
          receiptAttempt.attempt !== entry.attempt ||
          receiptAttempt.diagnosticCensusCommitment === null ||
          canonicalJsonDigest(
            blueprintAuthoringDiagnosticCensusCommitment(entry.census),
          ) !== canonicalJsonDigest(receiptAttempt.diagnosticCensusCommitment)
        );
      })
    ) {
      return {
        kind: 'derivation_failed',
        reasonCode: 'sanitized_census_commitment_unproven',
      };
    }
    const capture = buildBlueprintAuthoringSanitizedFailureCapture({
      terminalFailureCode: args.failureCode,
      terminalReceiptDigest: args.failureReceipt.digest,
      requestDigest: args.failureReceipt.requestDigest,
      contextDigest: args.request.contextDigest,
      admissionDecisions,
      census,
      attemptCensuses,
    });
    // Register this same-stack minted capture by its EXACT mint-time canonical bytes, so the
    // dedicated capture-specific persister will accept it AND reject any post-mint mutation.
    // Only captures produced HERE — from the compiler's own error/diagnostics in this
    // synchronous stack — are ever registered; an externally-built (or mutated) capture is not.
    runnerMintedFailureCaptureBytes.set(
      capture,
      blueprintAuthoringSanitizedFailureCaptureBytes(capture),
    );
    return { kind: 'captured', capture };
  } catch (error) {
    // A diagnostic-bearing failure whose capture cannot be derived (including a
    // census that overflows the fail-closed hard bound) is torn state, not an
    // ordinary terminal. Surface a bounded, sanitized reason so the caller can drive
    // it into the incident path with no silent null.
    const reasonCode =
      error instanceof Error &&
      /refusing to mint an incomplete census/.test(error.message)
        ? 'sanitized_census_overflow'
        : 'sanitized_capture_derivation_failed';
    return { kind: 'derivation_failed', reasonCode };
  }
}

export function persistBlueprintAuthoringSanitizedFailureCapture(args: {
  repoRoot: string;
  outputDir: string;
  capture: BlueprintAuthoringSanitizedFailureCapture;
  write?: boolean;
  hooks?: ImmutableWriteHooks;
}): { capturePath: string; wrote: boolean } {
  // STRUCTURAL SEAL (content-bound). All of this runs BEFORE any path resolution or write, so
  // an exported composition — including MUTATING a legitimately registered capture in place
  // (same object reference, rewritten fields/digest) — fails closed here and leaves no
  // artifact:
  //  1) the capture must be registered by the same-stack private derivation, and
  //  2) its CURRENT serialization must byte-equal the immutable mint-time snapshot (any
  //     post-mint `Object.assign`/nested/digest mutation changes the bytes and is rejected).
  // The write then uses the SNAPSHOT bytes and a path derived from the snapshot's own digest,
  // never bytes/fields re-read from the caller-visible object — closing the TOCTOU/getter gap.
  const snapshotBytes = runnerMintedFailureCaptureBytes.get(args.capture);
  if (snapshotBytes === undefined) {
    throw new Error(
      'refusing to persist a sanitized failure capture not minted by the sealed runner authority',
    );
  }
  if (
    blueprintAuthoringSanitizedFailureCaptureBytes(args.capture) !== snapshotBytes
  ) {
    throw new Error(
      'refusing to persist a sanitized failure capture mutated after minting',
    );
  }
  // Belt-and-suspenders: the immutable snapshot must itself be a fully valid capture, and the
  // canonical digest/path come from the snapshot alone.
  const snapshotValue = JSON.parse(snapshotBytes) as { digest: string };
  if (!blueprintAuthoringSanitizedFailureCaptureIsValid(snapshotValue)) {
    throw new Error(
      'refusing to persist an invalid sanitized failure capture',
    );
  }
  const root = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, root);
  const absolute = path.join(
    root,
    'sanitized-failure-captures',
    `${snapshotValue.digest}.json`,
  );
  if (args.write === true) {
    writeImmutableLocalArtifact({
      destinationPath: absolute,
      bytes: snapshotBytes,
      hooks: args.hooks,
    });
  }
  return {
    capturePath: repoRelativePath(args.repoRoot, absolute),
    wrote: args.write === true,
  };
}

export function persistProductionAuthoringReceipt(args: {
  repoRoot: string;
  outputDir: string;
  receipt: ProductionAuthoringRunReceipt;
  write?: boolean;
  hooks?: ImmutableWriteHooks;
}): { receiptPath: string; wrote: boolean } {
  const root = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, root);
  const absolute = path.join(
    root,
    'authoring-receipts',
    `${args.receipt.digest}.json`,
  );
  if (args.write === true) {
    writeImmutableLocalArtifact({
      destinationPath: absolute,
      bytes: productionAuthoringReceiptBytes(args.receipt),
      hooks: args.hooks,
    });
  }
  return {
    receiptPath: repoRelativePath(args.repoRoot, absolute),
    wrote: args.write === true,
  };
}
