export type AuthoringTerminalFailureCode =
  | 'request_invalid'
  | 'context_invalid'
  | 'provider_required'
  | 'provider_call_failed'
  | 'provider_policy_mismatch'
  | 'input_token_ceiling_exceeded'
  | 'usage_invalid'
  | 'provider_evidence_invalid'
  | 'completion_status_invalid'
  | 'cost_ceiling_exceeded'
  | 'call_budget_exhausted'
  | 'provider_output_decode_failed'
  | 'draft_validation_repair_exhausted'
  | 'repair_output_invalid'
  | 'draft_authority_reference_domain_invalid'
  | 'action_semantic_capability_gap'
  | 'post_compile_authority_incomplete'
  | 'local_processing_failed';

export type AuthoringTerminalPhase =
  | 'request_validation'
  | 'context_validation'
  | 'provider_admission'
  | 'provider_call'
  | 'provider_response_validation'
  | 'provider_output_decode'
  | 'draft_validation'
  | 'repair_output_validation'
  | 'draft_authority_reference_domain'
  | 'action_semantic_capability'
  | 'post_compile_authority'
  | 'cost_accounting'
  | 'local_processing';

export type AuthoringTerminalErrorClass =
  | 'deterministic_request_failure'
  | 'deterministic_context_failure'
  | 'provider_adapter_missing'
  | 'provider_execution_failure'
  | 'provider_policy_violation'
  | 'input_limit_violation'
  | 'usage_evidence_failure'
  | 'provider_evidence_failure'
  | 'provider_completion_failure'
  | 'cost_limit_violation'
  | 'call_budget_violation'
  | 'provider_output_decode_failure'
  | 'draft_validation_budget_exhausted'
  | 'repair_output_failure'
  | 'authority_reference_domain_failure'
  | 'semantic_capability_failure'
  | 'post_compile_authority_failure'
  | 'unexpected_local_failure';

export type AuthoringRepairEligibility =
  | 'ineligible'
  | 'budget_exhausted';

export type AuthoringRepairReasonCode =
  | 'request_not_repairable'
  | 'context_not_repairable'
  | 'provider_adapter_required'
  | 'provider_execution_not_repairable'
  | 'provider_policy_not_repairable'
  | 'input_limit_not_repairable'
  | 'usage_evidence_not_repairable'
  | 'provider_evidence_not_repairable'
  | 'provider_completion_not_repairable'
  | 'cost_limit_not_repairable'
  | 'call_budget_not_repairable'
  | 'initial_output_not_decodable'
  | 'draft_validation_budget_consumed'
  | 'completed_repair_output_unusable'
  | 'authority_reference_domain_not_repairable'
  | 'semantic_capability_not_repairable'
  | 'post_compile_authority_not_repairable'
  | 'unexpected_local_failure_not_repairable';

export type AuthoringDiagnosticCode =
  | 'request_validation_failed'
  | 'context_validation_failed'
  | 'provider_adapter_missing'
  | 'provider_call_failed'
  | 'provider_policy_mismatch'
  | 'input_token_ceiling_exceeded'
  | 'usage_evidence_invalid'
  | 'provider_execution_evidence_invalid'
  | 'provider_completion_invalid'
  | 'cost_ceiling_exceeded'
  | 'call_budget_exhausted'
  | 'provider_output_json_invalid'
  | 'draft_schema_validation_failed'
  | 'draft_contract_validation_failed'
  | 'source_evidence_validation_failed'
  | 'action_semantic_validation_failed'
  | 'authority_reference_validation_failed'
  | 'repair_output_json_invalid'
  | 'repair_output_shape_invalid'
  | 'repair_output_target_identity_invalid'
  | 'repair_output_reference_authority_invalid'
  | 'repair_output_recurring_prop_invalid'
  | 'repair_output_non_target_drift'
  | 'repair_output_application_rejected'
  | 'draft_authority_reference_domain_invalid'
  | 'action_semantic_capability_gap'
  | 'post_compile_authority_incomplete'
  | 'call_budget_invariant_failed'
  | 'unexpected_local_error';

export interface AuthoringTerminalFailure {
  code: AuthoringTerminalFailureCode;
  message: string;
  phase: AuthoringTerminalPhase;
  errorClass: AuthoringTerminalErrorClass;
  repairEligibility: AuthoringRepairEligibility;
  repairReasonCode: AuthoringRepairReasonCode;
  diagnosticCount: number;
  diagnosticCodes: AuthoringDiagnosticCode[];
  /**
   * Optional deterministic request/boundary codes retained for operator
   * actionability. Only bounded snake-case identifiers are accepted here;
   * validator/provider/exception prose must use diagnosticInputs instead.
   */
  issues: string[];
}

interface AuthoringTerminalDefinition {
  phase: AuthoringTerminalPhase;
  errorClass: AuthoringTerminalErrorClass;
  repairEligibility: AuthoringRepairEligibility;
  repairReasonCode: AuthoringRepairReasonCode;
  diagnosticCode: AuthoringDiagnosticCode;
  message: string;
}

const TERMINAL_DEFINITIONS: Record<
  AuthoringTerminalFailureCode,
  AuthoringTerminalDefinition
> = {
  request_invalid: {
    phase: 'request_validation',
    errorClass: 'deterministic_request_failure',
    repairEligibility: 'ineligible',
    repairReasonCode: 'request_not_repairable',
    diagnosticCode: 'request_validation_failed',
    message: 'authoring request failed deterministic validation',
  },
  context_invalid: {
    phase: 'context_validation',
    errorClass: 'deterministic_context_failure',
    repairEligibility: 'ineligible',
    repairReasonCode: 'context_not_repairable',
    diagnosticCode: 'context_validation_failed',
    message: 'authoring context failed deterministic validation',
  },
  provider_required: {
    phase: 'provider_admission',
    errorClass: 'provider_adapter_missing',
    repairEligibility: 'ineligible',
    repairReasonCode: 'provider_adapter_required',
    diagnosticCode: 'provider_adapter_missing',
    message: 'live mode requires one explicitly injected provider adapter',
  },
  provider_call_failed: {
    phase: 'provider_call',
    errorClass: 'provider_execution_failure',
    repairEligibility: 'ineligible',
    repairReasonCode: 'provider_execution_not_repairable',
    diagnosticCode: 'provider_call_failed',
    message: 'provider adapter failed; raw provider errors were discarded',
  },
  provider_policy_mismatch: {
    phase: 'provider_response_validation',
    errorClass: 'provider_policy_violation',
    repairEligibility: 'ineligible',
    repairReasonCode: 'provider_policy_not_repairable',
    diagnosticCode: 'provider_policy_mismatch',
    message: 'provider execution differed from the exact approved request',
  },
  input_token_ceiling_exceeded: {
    phase: 'provider_admission',
    errorClass: 'input_limit_violation',
    repairEligibility: 'ineligible',
    repairReasonCode: 'input_limit_not_repairable',
    diagnosticCode: 'input_token_ceiling_exceeded',
    message: 'authoring stopped before provider reachability at the approved input-token ceiling',
  },
  usage_invalid: {
    phase: 'provider_response_validation',
    errorClass: 'usage_evidence_failure',
    repairEligibility: 'ineligible',
    repairReasonCode: 'usage_evidence_not_repairable',
    diagnosticCode: 'usage_evidence_invalid',
    message: 'provider usage was missing or outside approved token bounds',
  },
  provider_evidence_invalid: {
    phase: 'provider_response_validation',
    errorClass: 'provider_evidence_failure',
    repairEligibility: 'ineligible',
    repairReasonCode: 'provider_evidence_not_repairable',
    diagnosticCode: 'provider_execution_evidence_invalid',
    message: 'provider response identity, output, or execution evidence was incomplete',
  },
  completion_status_invalid: {
    phase: 'provider_response_validation',
    errorClass: 'provider_completion_failure',
    repairEligibility: 'ineligible',
    repairReasonCode: 'provider_completion_not_repairable',
    diagnosticCode: 'provider_completion_invalid',
    message: 'provider response did not report a completed result',
  },
  cost_ceiling_exceeded: {
    phase: 'cost_accounting',
    errorClass: 'cost_limit_violation',
    repairEligibility: 'ineligible',
    repairReasonCode: 'cost_limit_not_repairable',
    diagnosticCode: 'cost_ceiling_exceeded',
    message: 'authoring stopped at the approved hard cost ceiling',
  },
  call_budget_exhausted: {
    phase: 'provider_admission',
    errorClass: 'call_budget_violation',
    repairEligibility: 'ineligible',
    repairReasonCode: 'call_budget_not_repairable',
    diagnosticCode: 'call_budget_exhausted',
    message: 'authoring stopped at the exact call budget',
  },
  provider_output_decode_failed: {
    phase: 'provider_output_decode',
    errorClass: 'provider_output_decode_failure',
    repairEligibility: 'ineligible',
    repairReasonCode: 'initial_output_not_decodable',
    diagnosticCode: 'provider_output_json_invalid',
    message: 'completed initial provider output could not be decoded as the required draft',
  },
  draft_validation_repair_exhausted: {
    phase: 'draft_validation',
    errorClass: 'draft_validation_budget_exhausted',
    repairEligibility: 'budget_exhausted',
    repairReasonCode: 'draft_validation_budget_consumed',
    diagnosticCode: 'draft_contract_validation_failed',
    message: 'all bounded whole-book draft validation and repair attempts failed',
  },
  repair_output_invalid: {
    phase: 'repair_output_validation',
    errorClass: 'repair_output_failure',
    repairEligibility: 'ineligible',
    repairReasonCode: 'completed_repair_output_unusable',
    diagnosticCode: 'repair_output_json_invalid',
    message: 'a completed repair response could not be applied as a usable draft',
  },
  draft_authority_reference_domain_invalid: {
    phase: 'draft_authority_reference_domain',
    errorClass: 'authority_reference_domain_failure',
    repairEligibility: 'ineligible',
    repairReasonCode: 'authority_reference_domain_not_repairable',
    diagnosticCode: 'draft_authority_reference_domain_invalid',
    message: 'draft authority or reference-domain binding failed closed',
  },
  action_semantic_capability_gap: {
    phase: 'action_semantic_capability',
    errorClass: 'semantic_capability_failure',
    repairEligibility: 'ineligible',
    repairReasonCode: 'semantic_capability_not_repairable',
    diagnosticCode: 'action_semantic_capability_gap',
    message: 'authoring output exposed a closed-catalog Action Semantic capability gap',
  },
  post_compile_authority_incomplete: {
    phase: 'post_compile_authority',
    errorClass: 'post_compile_authority_failure',
    repairEligibility: 'ineligible',
    repairReasonCode: 'post_compile_authority_not_repairable',
    diagnosticCode: 'post_compile_authority_incomplete',
    message: 'candidate lacks complete compiler-checked post-compile authority',
  },
  local_processing_failed: {
    phase: 'local_processing',
    errorClass: 'unexpected_local_failure',
    repairEligibility: 'ineligible',
    repairReasonCode: 'unexpected_local_failure_not_repairable',
    diagnosticCode: 'unexpected_local_error',
    message: 'authoring stopped on an unexpected local processing failure; raw error material was discarded',
  },
};

export const MAX_PERSISTED_AUTHORING_DIAGNOSTIC_COUNT = 128;
export const MAX_PERSISTED_AUTHORING_DIAGNOSTIC_CODES = 16;
const MAX_PERSISTED_AUTHORING_ISSUE_CODES = 128;
const SAFE_ISSUE_CODE = /^[a-z][a-z0-9_]{0,95}$/;

function diagnosticCodeFor(value: unknown): AuthoringDiagnosticCode {
  if (typeof value !== 'string') return 'draft_contract_validation_failed';
  const normalized = value.toLowerCase();
  if (/json|parse|decode|truncat/.test(normalized)) {
    return 'draft_schema_validation_failed';
  }
  if (/source.?evidence/.test(normalized)) {
    return 'source_evidence_validation_failed';
  }
  if (/action.?semantic|actionrequirements?|beatid/.test(normalized)) {
    return 'action_semantic_validation_failed';
  }
  if (/authority|reference|spatial|zone|propid|checkid/.test(normalized)) {
    return 'authority_reference_validation_failed';
  }
  if (/schema|required|missing|invalid/.test(normalized)) {
    return 'draft_schema_validation_failed';
  }
  return 'draft_contract_validation_failed';
}

export function sanitizedAuthoringDiagnostics(args: {
  inputs?: readonly unknown[];
  fallbackCode: AuthoringDiagnosticCode;
  countOverride?: number;
}): { count: number; codes: AuthoringDiagnosticCode[] } {
  const inputs = args.inputs ?? [];
  const requestedCount = args.countOverride ?? inputs.length;
  const count = Math.max(
    1,
    Math.min(
      Number.isSafeInteger(requestedCount) && requestedCount >= 0
        ? requestedCount
        : inputs.length,
      MAX_PERSISTED_AUTHORING_DIAGNOSTIC_COUNT,
    ),
  );
  const codes = [
    ...new Set([
      args.fallbackCode,
      ...inputs.map(diagnosticCodeFor),
    ]),
  ]
    .sort()
    .slice(0, MAX_PERSISTED_AUTHORING_DIAGNOSTIC_CODES);
  return { count, codes };
}

function boundedIssueCodes(
  values: readonly unknown[],
  fallback: AuthoringDiagnosticCode,
): string[] {
  const codes = [
    ...new Set(
      values.filter(
        (value): value is string =>
          typeof value === 'string' && SAFE_ISSUE_CODE.test(value),
      ),
    ),
  ]
    .sort()
    .slice(0, MAX_PERSISTED_AUTHORING_ISSUE_CODES);
  return codes.length > 0 ? codes : [fallback];
}

export function buildAuthoringTerminalFailure(args: {
  code: AuthoringTerminalFailureCode;
  diagnosticInputs?: readonly unknown[];
  diagnosticCountOverride?: number;
  diagnosticCodeOverride?: AuthoringDiagnosticCode;
  issueCodes?: readonly unknown[];
}): AuthoringTerminalFailure {
  const definition = TERMINAL_DEFINITIONS[args.code];
  const repairOutputDiagnosticCodes: readonly AuthoringDiagnosticCode[] = [
    'repair_output_json_invalid',
    'repair_output_shape_invalid',
    'repair_output_target_identity_invalid',
    'repair_output_reference_authority_invalid',
    'repair_output_recurring_prop_invalid',
    'repair_output_non_target_drift',
    'repair_output_application_rejected',
  ];
  const primaryDiagnosticCode =
    args.code === 'local_processing_failed' &&
    args.diagnosticCodeOverride ===
      'call_budget_invariant_failed'
      ? args.diagnosticCodeOverride
      : args.code === 'repair_output_invalid' &&
          args.diagnosticCodeOverride !== undefined &&
          repairOutputDiagnosticCodes.includes(
            args.diagnosticCodeOverride,
          )
        ? args.diagnosticCodeOverride
      : definition.diagnosticCode;
  const diagnostics = sanitizedAuthoringDiagnostics({
    inputs: args.diagnosticInputs,
    fallbackCode: primaryDiagnosticCode,
    countOverride: args.diagnosticCountOverride,
  });
  return {
    code: args.code,
    message: definition.message,
    phase: definition.phase,
    errorClass: definition.errorClass,
    repairEligibility: definition.repairEligibility,
    repairReasonCode: definition.repairReasonCode,
    diagnosticCount: diagnostics.count,
    diagnosticCodes: diagnostics.codes,
    issues: boundedIssueCodes(
      args.issueCodes ?? [],
      definition.diagnosticCode,
    ),
  };
}

const AUTHORING_DIAGNOSTIC_CODES = new Set<AuthoringDiagnosticCode>([
  'request_validation_failed',
  'context_validation_failed',
  'provider_adapter_missing',
  'provider_call_failed',
  'provider_policy_mismatch',
  'input_token_ceiling_exceeded',
  'usage_evidence_invalid',
  'provider_execution_evidence_invalid',
  'provider_completion_invalid',
  'cost_ceiling_exceeded',
  'call_budget_exhausted',
  'provider_output_json_invalid',
  'draft_schema_validation_failed',
  'draft_contract_validation_failed',
  'source_evidence_validation_failed',
  'action_semantic_validation_failed',
  'authority_reference_validation_failed',
  'repair_output_json_invalid',
  'repair_output_shape_invalid',
  'repair_output_target_identity_invalid',
  'repair_output_reference_authority_invalid',
  'repair_output_recurring_prop_invalid',
  'repair_output_non_target_drift',
  'repair_output_application_rejected',
  'draft_authority_reference_domain_invalid',
  'action_semantic_capability_gap',
  'post_compile_authority_incomplete',
  'call_budget_invariant_failed',
  'unexpected_local_error',
]);

const TERMINAL_FAILURE_KEYS = [
  'code',
  'diagnosticCodes',
  'diagnosticCount',
  'errorClass',
  'issues',
  'message',
  'phase',
  'repairEligibility',
  'repairReasonCode',
].sort();

export function authoringTerminalFailureIsValid(
  value: unknown,
): value is AuthoringTerminalFailure {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const failure = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(failure).sort()) !==
    JSON.stringify(TERMINAL_FAILURE_KEYS) ||
    typeof failure.code !== 'string' ||
    !Object.prototype.hasOwnProperty.call(
      TERMINAL_DEFINITIONS,
      failure.code,
    )
  ) {
    return false;
  }
  const definition =
    TERMINAL_DEFINITIONS[
      failure.code as AuthoringTerminalFailureCode
    ];
  const permittedPrimaryDiagnosticCodes =
    failure.code === 'local_processing_failed'
      ? [
          definition.diagnosticCode,
          'call_budget_invariant_failed',
        ]
      : failure.code === 'repair_output_invalid'
        ? [
            definition.diagnosticCode,
            'repair_output_shape_invalid',
            'repair_output_target_identity_invalid',
            'repair_output_reference_authority_invalid',
            'repair_output_recurring_prop_invalid',
            'repair_output_non_target_drift',
            'repair_output_application_rejected',
          ]
        : [definition.diagnosticCode];
  const diagnosticCodes = failure.diagnosticCodes;
  const issues = failure.issues;
  return (
    failure.message === definition.message &&
    failure.phase === definition.phase &&
    failure.errorClass === definition.errorClass &&
    failure.repairEligibility === definition.repairEligibility &&
    failure.repairReasonCode === definition.repairReasonCode &&
    Number.isSafeInteger(failure.diagnosticCount) &&
    (failure.diagnosticCount as number) >= 1 &&
    (failure.diagnosticCount as number) <=
      MAX_PERSISTED_AUTHORING_DIAGNOSTIC_COUNT &&
    Array.isArray(diagnosticCodes) &&
    diagnosticCodes.length >= 1 &&
    diagnosticCodes.length <=
      MAX_PERSISTED_AUTHORING_DIAGNOSTIC_CODES &&
    diagnosticCodes.every(
      (code) =>
        typeof code === 'string' &&
        AUTHORING_DIAGNOSTIC_CODES.has(
          code as AuthoringDiagnosticCode,
        ),
    ) &&
    permittedPrimaryDiagnosticCodes.some((code) =>
      diagnosticCodes.includes(code),
    ) &&
    Array.isArray(issues) &&
    issues.length >= 1 &&
    issues.length <= MAX_PERSISTED_AUTHORING_ISSUE_CODES &&
    issues.every(
      (issue) =>
        typeof issue === 'string' && SAFE_ISSUE_CODE.test(issue),
    )
  );
}

export function authoringBudgetExhaustionBindingIsValid(args: {
  failure: AuthoringTerminalFailure | null;
  logicalProviderCalls: number;
  repairCount: number;
  expectedLogicalProviderCalls: number;
  expectedRepairCount: number;
}): boolean {
  const claimsExhaustionByCode =
    args.failure?.code ===
    'draft_validation_repair_exhausted';
  const claimsExhaustionByEligibility =
    args.failure?.repairEligibility === 'budget_exhausted';
  if (
    !claimsExhaustionByCode &&
    !claimsExhaustionByEligibility
  ) {
    return true;
  }
  return (
    claimsExhaustionByCode &&
    claimsExhaustionByEligibility &&
    args.logicalProviderCalls ===
      args.expectedLogicalProviderCalls &&
    args.repairCount === args.expectedRepairCount
  );
}

export type AuthoringExecutionEvidenceKind =
  | 'not_run'
  | 'canonical_adapter_observed'
  | 'injected_adapter_unattested';

export interface AuthoringExecutionAttestation {
  evidenceKind: AuthoringExecutionEvidenceKind;
  logicalProviderCalls: number;
  transportDispatchCount: number | null;
  transportRetryCount: number | null;
  fallbackUsed: boolean | null;
  canonicalRouteConfirmed: boolean | null;
  canonicalModelConfirmed: boolean | null;
}

export function notRunAuthoringExecutionAttestation(): AuthoringExecutionAttestation {
  return {
    evidenceKind: 'not_run',
    logicalProviderCalls: 0,
    transportDispatchCount: 0,
    transportRetryCount: 0,
    fallbackUsed: false,
    canonicalRouteConfirmed: false,
    canonicalModelConfirmed: false,
  };
}

export function injectedAuthoringExecutionAttestation(
  logicalProviderCalls = 1,
): AuthoringExecutionAttestation {
  return {
    evidenceKind: 'injected_adapter_unattested',
    logicalProviderCalls,
    transportDispatchCount: null,
    transportRetryCount: null,
    fallbackUsed: null,
    canonicalRouteConfirmed: null,
    canonicalModelConfirmed: null,
  };
}

export function canonicalAuthoringExecutionAttestation(args: {
  logicalProviderCalls?: number;
  transportDispatchCount: number;
  fallbackUsed: boolean;
  canonicalRouteConfirmed: boolean;
  canonicalModelConfirmed: boolean;
}): AuthoringExecutionAttestation {
  const logicalProviderCalls = args.logicalProviderCalls ?? 1;
  return {
    evidenceKind: 'canonical_adapter_observed',
    logicalProviderCalls,
    transportDispatchCount: args.transportDispatchCount,
    transportRetryCount: Math.max(
      0,
      args.transportDispatchCount - logicalProviderCalls,
    ),
    fallbackUsed: args.fallbackUsed,
    canonicalRouteConfirmed: args.canonicalRouteConfirmed,
    canonicalModelConfirmed: args.canonicalModelConfirmed,
  };
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

const EXECUTION_ATTESTATION_KEYS = [
  'canonicalModelConfirmed',
  'canonicalRouteConfirmed',
  'evidenceKind',
  'fallbackUsed',
  'logicalProviderCalls',
  'transportDispatchCount',
  'transportRetryCount',
].sort();

export function authoringExecutionAttestationIsValid(
  value: unknown,
): value is AuthoringExecutionAttestation {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const evidence = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(evidence).sort()) !==
      JSON.stringify(EXECUTION_ATTESTATION_KEYS) ||
    !nonNegativeSafeInteger(evidence.logicalProviderCalls)
  ) {
    return false;
  }
  if (evidence.evidenceKind === 'not_run') {
    return (
      evidence.logicalProviderCalls === 0 &&
      evidence.transportDispatchCount === 0 &&
      evidence.transportRetryCount === 0 &&
      evidence.fallbackUsed === false &&
      evidence.canonicalRouteConfirmed === false &&
      evidence.canonicalModelConfirmed === false
    );
  }
  if (evidence.evidenceKind === 'injected_adapter_unattested') {
    return (
      evidence.transportDispatchCount === null &&
      evidence.transportRetryCount === null &&
      evidence.fallbackUsed === null &&
      evidence.canonicalRouteConfirmed === null &&
      evidence.canonicalModelConfirmed === null
    );
  }
  if (evidence.evidenceKind !== 'canonical_adapter_observed') {
    return false;
  }
  return (
    nonNegativeSafeInteger(evidence.transportDispatchCount) &&
    nonNegativeSafeInteger(evidence.transportRetryCount) &&
    evidence.transportRetryCount ===
      Math.max(
        0,
        evidence.transportDispatchCount - evidence.logicalProviderCalls,
      ) &&
    evidence.fallbackUsed === false &&
    typeof evidence.canonicalRouteConfirmed === 'boolean' &&
    typeof evidence.canonicalModelConfirmed === 'boolean'
  );
}

export function canonicalExecutionAttestationIsValid(
  value: unknown,
): value is AuthoringExecutionAttestation {
  if (
    !authoringExecutionAttestationIsValid(value) ||
    value.evidenceKind !== 'canonical_adapter_observed' ||
    value.logicalProviderCalls !== 1
  ) {
    return false;
  }
  return true;
}

export function canonicalCompletedExecutionAttestationIsValid(
  value: unknown,
): value is AuthoringExecutionAttestation {
  return (
    canonicalExecutionAttestationIsValid(value) &&
    value.transportDispatchCount === 1 &&
    value.transportRetryCount === 0 &&
    value.fallbackUsed === false &&
    value.canonicalRouteConfirmed === true &&
    value.canonicalModelConfirmed === true
  );
}

export function aggregateAuthoringExecutionAttestations(
  values: readonly AuthoringExecutionAttestation[],
): AuthoringExecutionAttestation {
  if (values.length === 0) {
    return notRunAuthoringExecutionAttestation();
  }
  if (
    values.some(
      (value) => value.evidenceKind !== 'canonical_adapter_observed',
    )
  ) {
    return injectedAuthoringExecutionAttestation(
      values.reduce(
        (sum, value) => sum + value.logicalProviderCalls,
        0,
      ),
    );
  }
  const dispatches = values.reduce(
    (sum, value) => sum + (value.transportDispatchCount ?? 0),
    0,
  );
  const retries = values.reduce(
    (sum, value) => sum + (value.transportRetryCount ?? 0),
    0,
  );
  return {
    evidenceKind: 'canonical_adapter_observed',
    logicalProviderCalls: values.reduce(
      (sum, value) => sum + value.logicalProviderCalls,
      0,
    ),
    transportDispatchCount: dispatches,
    transportRetryCount: retries,
    fallbackUsed: values.some((value) => value.fallbackUsed === true),
    canonicalRouteConfirmed: values.every(
      (value) => value.canonicalRouteConfirmed === true,
    ),
    canonicalModelConfirmed: values.every(
      (value) => value.canonicalModelConfirmed === true,
    ),
  };
}
