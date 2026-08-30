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
import { PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA } from './preRenderBlueprintDraftSchema';
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
  authoringExecutionAttestationIsValid,
  buildAuthoringTerminalFailure,
  canonicalCompletedExecutionAttestationIsValid,
  injectedAuthoringExecutionAttestation,
  notRunAuthoringExecutionAttestation,
  sanitizedAuthoringDiagnostics,
  type AuthoringDiagnosticCode,
  type AuthoringExecutionAttestation,
  type AuthoringTerminalFailure,
  type AuthoringTerminalFailureCode,
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
  decideBlueprintAuthoringInputTokenAdmission,
} from './blueprintAuthoringInputTokenAdmission';
import {
  buildBlueprintAuthoringSanitizedFailureCapture,
  blueprintAuthoringSanitizedFailureCaptureBytes,
  blueprintAuthoringReceiptRequiresSanitizedCapture,
  type BlueprintAuthoringSanitizedFailureCapture,
  type BlueprintAuthoringSanitizedRoute,
} from './blueprintAuthoringSanitizedFailureCapture';

export const PRODUCTION_AUTHORING_RUN_REQUEST_VERSION =
  'production-blueprint-authoring-request/v4' as const;
export const LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION =
  'production-blueprint-authoring-request/v3' as const;
export const PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION =
  'production-blueprint-authoring-receipt/v6' as const;
export const LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION =
  'production-blueprint-authoring-receipt/v5' as const;
export const LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V4 =
  'production-blueprint-authoring-receipt/v4' as const;
export const LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V3 =
  'production-blueprint-authoring-receipt/v3' as const;

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
  return version === LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION
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
    version === LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V4 ||
    version === LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V3
    ? 'legacy_immutable'
    : 'unsupported';
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
}

const PRODUCTION_AUTHORING_RUN_REQUEST_KEYS = [
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

export interface ProductionAuthoringAttemptReceipt {
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

export interface ProductionAuthoringRunReceipt {
  version: typeof PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION;
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
  attempts: ProductionAuthoringAttemptReceipt[];
  blueprintDigest: string | null;
  authoringProvenanceDigest: string | null;
  failure: AuthoringTerminalFailure | null;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

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
  receipt: ProductionAuthoringRunReceipt,
): string {
  return `${JSON.stringify(canonicalize(receipt), null, 2)}\n`;
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
    receipt.validationDiagnostics =
      sanitizedAuthoringDiagnostics({
        inputs: repairAttempt.errors,
        fallbackCode: 'draft_contract_validation_failed',
      });
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

export async function runProductionBlueprintAuthoring(args: {
  request: ProductionAuthoringRunRequest;
  context: ProductionAuthoringContext;
  provider?: ProductionAuthoringProvider;
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
  let callBudgetExhausted = false;
  let cumulativeConservativeCostUsd = 0;
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
          // The single shared admission authority. The paid runner path supplies
          // no exact provider count (live counting deferred), so this is the proven
          // conservative bound — numerically identical to the prior gate.
          const inputAdmission = decideBlueprintAuthoringInputTokenAdmission({
            accounting: expectedInputAccounting,
          });
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
            validationDiagnostics: {
              count: 0,
              codes: [],
            },
            failureCode: null,
            failureEvidenceKind: null,
            failureEvidenceReason: null,
          } satisfies ProductionAuthoringAttemptReceipt;
          try {
            if (
              !inputAdmission.admitted ||
              !blueprintAuthoringSpendIsWithinCeiling(
                expectedReservedExposureBeforeCallUsd,
              )
            ) {
              const failureCode: ProductionAuthoringAttemptFailureCode =
                !inputAdmission.admitted
                  ? 'input_token_ceiling_exceeded'
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
              usage.outputTokens > BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS
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
      },
    );
    for (const repair of authoringResult.repairAttempts) {
      const receipt = attempts[repair.attempt - 1];
      if (receipt) {
        receipt.validationDiagnostics =
          sanitizedAuthoringDiagnostics({
            inputs: repair.errors,
            fallbackCode:
              'draft_contract_validation_failed',
          });
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
    const failed = failureReceipt({
      request: args.request,
      attempts,
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
      }),
    );
  }
}

/**
 * Derive the typed sanitized-failure-capture disposition for an in-memory failed run.
 *
 * The capture requirement is derived from the ACTUAL failed receipt EVIDENCE — via the
 * single canonical `blueprintAuthoringReceiptRequiresSanitizedCapture` predicate — not
 * the terminal code alone: a failure is diagnostic-BEARING when its code is in the
 * closed mandatory set OR any attempt carried a non-empty grouped validation-diagnostic
 * set (e.g. an initial invalid draft that produced validation diagnostics followed by a
 * repair-time `provider_call_failed`, or a `local_processing_failed` fallback that still
 * carries structured diagnostics). A diagnostic-bearing failure MUST yield a complete
 * sanitized capture, and downstream the lifecycle refuses to publish an ordinary
 * replayable terminal for it without one.
 *
 * The census is derived only from the in-memory structured diagnostic sources that are
 * proven to correspond, as a COMPLETE and IDENTITY-EXACT bijection, to the failed
 * receipt's diagnostic-bearing attempts. The receipt-side source of truth is the
 * content-addressed `failureReceipt.attempts` (the separately-passed `attempts` must be
 * canonically identical first); those attempts must form a clean 1..N sequence; and every
 * in-memory source attempt number must be a safe integer in 1..N and unique. For every
 * diagnostic-bearing receipt attempt there must be a matching source whose raw errors
 * re-derive to the EXACT persisted {count,codes} (rejecting a fabricated or drifted
 * summary) AND whose structured diagnostics PROJECT, via the single canonical authority
 * the compiler uses to build the error strings, to the source error array
 * position-for-position (proving the structured census and the errors are the SAME
 * identities, not merely the same count). Every source carrying structured diagnostics
 * must map to a matched attempt (rejecting extra/unmatched evidence). If that bijection
 * cannot be proven — a mismatched attempt list, non-sequential/duplicate receipt attempt,
 * invalid/out-of-range/duplicate source attempt, missing, partial, count/code-mismatched,
 * identity-mismatched, or extra source, or a derived census that would be empty — the
 * result is `sanitized_census_correlation_unproven` `derivation_failed` (NOT an
 * empty/partial census minted merely to satisfy the binding). A census that overflows the
 * fail-closed hard bound is likewise `derivation_failed`. Every `derivation_failed`
 * carries a sanitized reason code — never a silent null — so the caller can drive it into
 * the incident/execution_state_uncertain path.
 *
 * A diagnostic-LESS boundary failure (no mandatory code, no attempt diagnostics) is an
 * explicit allowed absence: it binds no capture. Never reads raw draft/provider output —
 * only structured diagnostics and byte accountings.
 */
export function deriveBlueprintAuthoringSanitizedFailureCaptureDisposition(args: {
  request: ProductionAuthoringRunRequest;
  context: ProductionAuthoringContext;
  attempts: readonly ProductionAuthoringAttemptReceipt[];
  error: unknown;
  failureReceipt: ProductionAuthoringRunReceipt;
  failureCode: ProductionBlueprintRunnerTerminalFailureCode;
}): BlueprintAuthoringSanitizedFailureCaptureDisposition {
  if (!blueprintAuthoringReceiptRequiresSanitizedCapture(args.failureReceipt)) {
    // Diagnostic-less boundary failure: allowed to bind no capture.
    return { kind: 'diagnostic_less_absence' };
  }
  try {
    const initialAccounting = productionBlueprintInitialInputAccounting(
      args.context,
    );
    const initialAttempt = args.attempts[0];
    const observedInputTokens =
      initialAttempt &&
      initialAttempt.kind === 'initial' &&
      initialAttempt.completionStatus === 'completed' &&
      typeof initialAttempt.usage?.inputTokens === 'number'
        ? initialAttempt.usage.inputTokens
        : null;
    const routes: Array<{
      routeKind: BlueprintAuthoringSanitizedRoute['routeKind'];
      ordinal: number;
      byteAccounting: BlueprintAuthoringInputAccounting;
      observedInputTokens?: number | null;
      rejectionReasonCode?: string | null;
    }> = [
      {
        routeKind: 'initial',
        ordinal: 0,
        byteAccounting: initialAccounting,
        observedInputTokens,
      },
    ];
    if (args.error instanceof PreRenderBlueprintRepairInputNotAdmissibleError) {
      routes.push({
        routeKind: 'repair',
        ordinal: 1,
        byteAccounting: args.error.inputAccounting,
        rejectionReasonCode: 'repair_route_input_not_admissible',
      });
    }
    const correlationUnproven = {
      kind: 'derivation_failed' as const,
      reasonCode: 'sanitized_census_correlation_unproven' as const,
    };
    // Receipt-side source of truth is the CONTENT-ADDRESSED failed receipt's own attempts
    // (the capture links to `failureReceipt`, whose digest commits to `attempts`). Require
    // the separately-passed `args.attempts` to be canonically identical first, so the
    // census can never be correlated against a different attempt list than the one the
    // receipt digest actually binds.
    if (
      canonicalJsonDigest(args.attempts) !==
      canonicalJsonDigest(args.failureReceipt.attempts)
    ) {
      return correlationUnproven;
    }
    const receiptAttempts = args.failureReceipt.attempts;
    // Receipt attempts MUST be a clean 1..N sequence — no duplicate, missing, or
    // non-sequential attempt number. A duplicate number would otherwise let one evidence
    // source be counted into the census twice.
    for (let index = 0; index < receiptAttempts.length; index += 1) {
      if (receiptAttempts[index]!.attempt !== index + 1) {
        return correlationUnproven;
      }
    }
    // Index the in-memory structured source by attempt number, retaining BOTH the raw
    // error strings (the exact source the receipt's `validationDiagnostics` summary was
    // derived from) and the structured diagnostics (the census source). A non-safe,
    // out-of-range (outside 1..N), or duplicated source attempt number is REJECTED — never
    // silently skipped — so extra or malformed evidence cannot ride alongside a valid
    // source.
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
          return correlationUnproven;
        }
        evidenceByAttempt.set(attempt.attempt, {
          errors: Array.isArray(attempt.errors) ? [...attempt.errors] : [],
          diagnostics: attempt.diagnostics ? [...attempt.diagnostics] : [],
        });
      }
    }
    // Prove a COMPLETE, IDENTITY-EXACT bijection between every diagnostic-bearing receipt
    // attempt and its in-memory structured source BEFORE minting any census:
    //  - forward: every receipt attempt that persisted a non-empty validation-diagnostic
    //    summary MUST have a matching source whose raw errors RE-DERIVE, under the exact
    //    canonical logic used to persist them, to the EXACT {count,codes} the receipt
    //    carries (rejects a fabricated/drifted summary), AND whose structured diagnostics
    //    PROJECT — via the single canonical authority the compiler uses to build the error
    //    strings — to the source error array position-for-position (proves the structured
    //    census and the errors are the SAME evidence identities, not merely equal in
    //    count);
    //  - reverse: every source that carries structured diagnostics MUST map to a matched
    //    diagnostic-bearing receipt attempt (rejects extra/unmatched evidence).
    // Any violation is `sanitized_census_correlation_unproven`.
    const censusDiagnostics: PreRenderBlueprintRepairDiagnostic[] = [];
    const matchedAttempts = new Set<number>();
    for (const receiptAttempt of receiptAttempts) {
      const persisted = receiptAttempt.validationDiagnostics;
      const attemptIsDiagnosticBearing =
        persisted.count > 0 || persisted.codes.length > 0;
      if (!attemptIsDiagnosticBearing) continue;
      const evidence = evidenceByAttempt.get(receiptAttempt.attempt);
      if (!evidence) {
        return correlationUnproven;
      }
      const rederived = sanitizedAuthoringDiagnostics({
        inputs: evidence.errors,
        fallbackCode: 'draft_contract_validation_failed',
      });
      if (
        rederived.count !== persisted.count ||
        JSON.stringify(rederived.codes) !== JSON.stringify(persisted.codes)
      ) {
        return correlationUnproven;
      }
      if (evidence.diagnostics.length === 0) {
        return correlationUnproven;
      }
      const projected = evidence.diagnostics.map(
        preRenderBlueprintRepairDiagnosticErrorText,
      );
      if (
        projected.length !== evidence.errors.length ||
        projected.some((text, position) => text !== evidence.errors[position])
      ) {
        return correlationUnproven;
      }
      matchedAttempts.add(receiptAttempt.attempt);
      censusDiagnostics.push(...evidence.diagnostics);
    }
    for (const [attemptNumber, evidence] of evidenceByAttempt) {
      if (
        evidence.diagnostics.length > 0 &&
        !matchedAttempts.has(attemptNumber)
      ) {
        return correlationUnproven;
      }
    }
    // A required capture with an empty census would be a binding satisfied by nothing.
    // Never mint it; fail closed so the caller drives it into the incident path.
    if (censusDiagnostics.length === 0) {
      return correlationUnproven;
    }
    return {
      kind: 'captured',
      capture: buildBlueprintAuthoringSanitizedFailureCapture({
        terminalFailureCode: args.failureCode,
        terminalReceiptDigest: args.failureReceipt.digest,
        requestDigest: args.failureReceipt.requestDigest,
        contextDigest: args.request.contextDigest,
        routes,
        diagnostics: censusDiagnostics,
      }),
    };
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
  const root = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, root);
  const absolute = path.join(
    root,
    'sanitized-failure-captures',
    `${args.capture.digest}.json`,
  );
  if (args.write === true) {
    writeImmutableLocalArtifact({
      destinationPath: absolute,
      bytes: blueprintAuthoringSanitizedFailureCaptureBytes(args.capture),
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
