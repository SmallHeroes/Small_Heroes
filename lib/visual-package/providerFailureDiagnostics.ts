import { canonicalJsonDigest } from './integrity';
import type {
  OpenAIResponsesStructuredOutputCompatibilityEvidence,
} from './openaiResponsesStructuredOutputSchemaCompatibility';
import {
  canonicalAuthoringExecutionAttestation,
  injectedAuthoringExecutionAttestation,
  type AuthoringExecutionAttestation,
} from './authoringTerminalDiagnostics';

export const LEGACY_PROVIDER_CALL_FAILURE_EVIDENCE_VERSION =
  'provider-call-failure-evidence/v1' as const;
export const PROVIDER_CALL_FAILURE_EVIDENCE_VERSION =
  'provider-call-failure-evidence/v2' as const;

export function providerCallFailureEvidenceVersionStatus(
  version: unknown,
): 'current' | 'legacy_immutable' | 'unsupported' {
  if (version === PROVIDER_CALL_FAILURE_EVIDENCE_VERSION) {
    return 'current';
  }
  return version === LEGACY_PROVIDER_CALL_FAILURE_EVIDENCE_VERSION
    ? 'legacy_immutable'
    : 'unsupported';
}

export type ProviderFailurePhase =
  | 'request_body_validation'
  | 'credential_read'
  | 'sdk_client_construction'
  | 'sdk_request_build'
  | 'transport_guard_rejection'
  | 'transport_dispatch'
  | 'http_response'
  | 'response_parse'
  | 'unknown_adapter';

export type ProviderFailureClass =
  | 'local_request_validation'
  | 'credential_unavailable'
  | 'sdk_client_construction_failure'
  | 'sdk_request_build_failure'
  | 'transport_guard_rejection'
  | 'request_aborted'
  | 'connection_timeout'
  | 'connection_failure'
  | 'provider_bad_request'
  | 'provider_authentication'
  | 'provider_permission_denied'
  | 'provider_resource_not_found'
  | 'provider_quota_exhausted'
  | 'provider_rate_limited'
  | 'provider_conflict'
  | 'provider_unprocessable'
  | 'provider_server_error'
  | 'provider_response_parse_failure'
  | 'provider_rejection_unknown'
  | 'unclassified_adapter_failure';

export type ProviderSdkErrorKind =
  | 'api_user_abort_error'
  | 'api_connection_timeout_error'
  | 'api_connection_error'
  | 'bad_request_error'
  | 'authentication_error'
  | 'permission_denied_error'
  | 'not_found_error'
  | 'conflict_error'
  | 'unprocessable_entity_error'
  | 'rate_limit_error'
  | 'internal_server_error'
  | 'api_error'
  | 'openai_error'
  | 'unknown';

export type ProviderCodeClass =
  | 'invalid_request'
  | 'invalid_api_key'
  | 'permission_denied'
  | 'model_not_found'
  | 'insufficient_quota'
  | 'rate_limit_exceeded'
  | 'server_error'
  | 'unknown';

export type ProviderParameterClass =
  | 'structured_output_schema'
  | 'model'
  | 'service_tier'
  | 'max_tokens'
  | 'tools'
  | 'input'
  | 'unknown';

interface ProviderSdkErrorClass {
  [Symbol.hasInstance](value: unknown): boolean;
}

export interface ProviderSdkErrorClasses {
  apiUserAbortError: ProviderSdkErrorClass;
  apiConnectionTimeoutError: ProviderSdkErrorClass;
  apiConnectionError: ProviderSdkErrorClass;
  badRequestError: ProviderSdkErrorClass;
  authenticationError: ProviderSdkErrorClass;
  permissionDeniedError: ProviderSdkErrorClass;
  notFoundError: ProviderSdkErrorClass;
  conflictError: ProviderSdkErrorClass;
  unprocessableEntityError: ProviderSdkErrorClass;
  rateLimitError: ProviderSdkErrorClass;
  internalServerError: ProviderSdkErrorClass;
  apiError: ProviderSdkErrorClass;
  openAIError: ProviderSdkErrorClass;
}

export interface ProviderFailureBoundaryObservations {
  adapterInvoked: boolean;
  credentialReadSucceeded: boolean;
  sdkClientConstructionStarted: boolean;
  sdkClientConstructionSucceeded: boolean;
  sdkRequestBuildStarted: boolean;
  transportDispatchStarted: boolean;
  transportDispatchCount: number;
  canonicalRouteConfirmed: boolean;
  canonicalModelConfirmed: boolean;
  httpResponseReceived: boolean;
  httpStatus: number | null;
  requestBodyDigest: string | null;
  requestOptionsDigest: string | null;
  providerRequestIdDigest: string | null;
}

export interface SanitizedProviderFailureDiagnostic {
  phase: ProviderFailurePhase;
  failureClass: ProviderFailureClass;
  adapterInvoked: boolean;
  credentialReadSucceeded: boolean;
  transportDispatchStarted: boolean;
  httpResponseReceived: boolean;
  httpStatus: number | null;
  sdkErrorKind: ProviderSdkErrorKind;
  providerCodeClass: ProviderCodeClass;
  parameterClass: ProviderParameterClass;
  requestBodyDigest: string | null;
  requestOptionsDigest: string | null;
  providerRequestIdDigest: string | null;
  executionAttestation: AuthoringExecutionAttestation;
}

export interface ProviderCallFailureEvidence {
  version: typeof PROVIDER_CALL_FAILURE_EVIDENCE_VERSION;
  authoringRequestDigest: string;
  sourceSnapshotDigest: string;
  authoringReceiptDigest: string;
  attempt: {
    index: number;
    kind: 'initial' | 'repair';
  };
  provider: string;
  endpoint: string;
  model: string;
  phase: ProviderFailurePhase;
  failureClass: ProviderFailureClass;
  adapterInvoked: boolean;
  credentialReadSucceeded: boolean;
  transportDispatchStarted: boolean;
  httpResponseReceived: boolean;
  httpStatus: number | null;
  sdkErrorKind: ProviderSdkErrorKind;
  providerCodeClass: ProviderCodeClass;
  parameterClass: ProviderParameterClass;
  requestBodyDigest: string | null;
  requestOptionsDigest: string | null;
  providerRequestIdDigest: string | null;
  executionAttestation: AuthoringExecutionAttestation;
  billingState: 'unknown_no_usage';
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

const PROVIDER_FAILURE_DOES_NOT_AUTHORIZE = [
  'provider receipt, processing, usage, or billing claims',
  'retry, fallback, repair, or another provider/model call',
  'Visual Contract candidate status',
  'Semantic Reconciliation, human approval, or Blueprint readiness',
  'Board, package, render, publication, activation, deployment, or release',
] as const;

const PROVIDER_CODE_CLASS = new Map<
  string,
  Exclude<ProviderCodeClass, 'unknown'>
>([
  ['invalid_request_error', 'invalid_request'],
  ['invalid_value', 'invalid_request'],
  ['unsupported_value', 'invalid_request'],
  ['invalid_api_key', 'invalid_api_key'],
  ['permission_denied', 'permission_denied'],
  ['model_not_found', 'model_not_found'],
  ['insufficient_quota', 'insufficient_quota'],
  ['rate_limit_exceeded', 'rate_limit_exceeded'],
  ['server_error', 'server_error'],
]);

function safeHttpStatus(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 100 &&
    value <= 599
    ? value
    : null;
}

function safeProviderRequestIdDigest(
  value: unknown,
): string | null {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512
    ? canonicalJsonDigest(value)
    : null;
}

function isSdkError(
  error: unknown,
  errorClass: ProviderSdkErrorClass | undefined,
): boolean {
  try {
    return errorClass?.[Symbol.hasInstance](error) ?? false;
  } catch {
    return false;
  }
}

function sdkErrorKind(
  error: unknown,
  sdkErrorClasses: ProviderSdkErrorClasses | undefined,
): ProviderSdkErrorKind {
  if (
    isSdkError(error, sdkErrorClasses?.apiUserAbortError)
  ) {
    return 'api_user_abort_error';
  }
  if (
    isSdkError(
      error,
      sdkErrorClasses?.apiConnectionTimeoutError,
    )
  ) {
    return 'api_connection_timeout_error';
  }
  if (
    isSdkError(error, sdkErrorClasses?.apiConnectionError)
  ) {
    return 'api_connection_error';
  }
  if (isSdkError(error, sdkErrorClasses?.badRequestError)) {
    return 'bad_request_error';
  }
  if (
    isSdkError(error, sdkErrorClasses?.authenticationError)
  ) {
    return 'authentication_error';
  }
  if (
    isSdkError(error, sdkErrorClasses?.permissionDeniedError)
  ) {
    return 'permission_denied_error';
  }
  if (isSdkError(error, sdkErrorClasses?.notFoundError)) {
    return 'not_found_error';
  }
  if (isSdkError(error, sdkErrorClasses?.conflictError)) {
    return 'conflict_error';
  }
  if (
    isSdkError(
      error,
      sdkErrorClasses?.unprocessableEntityError,
    )
  ) {
    return 'unprocessable_entity_error';
  }
  if (isSdkError(error, sdkErrorClasses?.rateLimitError)) {
    return 'rate_limit_error';
  }
  if (
    isSdkError(error, sdkErrorClasses?.internalServerError)
  ) {
    return 'internal_server_error';
  }
  if (isSdkError(error, sdkErrorClasses?.apiError)) {
    return 'api_error';
  }
  if (isSdkError(error, sdkErrorClasses?.openAIError)) {
    return 'openai_error';
  }
  return 'unknown';
}

function structuredSdkFields(
  error: unknown,
  sdkErrorClasses: ProviderSdkErrorClasses | undefined,
): {
  status: number | null;
  codeClass: ProviderCodeClass;
  parameterClass: ProviderParameterClass;
  providerRequestIdDigest: string | null;
} {
  try {
    if (!isSdkError(error, sdkErrorClasses?.apiError)) {
      return {
        status: null,
        codeClass: 'unknown',
        parameterClass: 'unknown',
        providerRequestIdDigest: null,
      };
    }
    const structuredError = error as {
      status?: unknown;
      code?: unknown;
      param?: unknown;
      requestID?: unknown;
    };
    return {
      status: safeHttpStatus(structuredError.status),
      codeClass:
        typeof structuredError.code === 'string'
          ? PROVIDER_CODE_CLASS.get(structuredError.code) ??
            'unknown'
          : 'unknown',
      parameterClass: classifyProviderParameter(
        structuredError.param,
      ),
      providerRequestIdDigest:
        safeProviderRequestIdDigest(
          structuredError.requestID,
        ),
    };
  } catch {
    return {
      status: null,
      codeClass: 'unknown',
      parameterClass: 'unknown',
      providerRequestIdDigest: null,
    };
  }
}

export function classifyProviderParameter(
  value: unknown,
): ProviderParameterClass {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.trim();
  if (
    normalized === 'text.format' ||
    normalized === 'text.format.schema' ||
    normalized.startsWith('text.format.schema.') ||
    normalized === 'response_format' ||
    normalized === 'response_format.json_schema' ||
    normalized.startsWith(
      'response_format.json_schema.schema',
    )
  ) {
    return 'structured_output_schema';
  }
  if (normalized === 'model') return 'model';
  if (normalized === 'service_tier') return 'service_tier';
  if (
    normalized === 'max_tokens' ||
    normalized === 'max_output_tokens' ||
    normalized === 'max_completion_tokens'
  ) {
    return 'max_tokens';
  }
  if (
    normalized === 'tools' ||
    normalized === 'tool_choice' ||
    normalized.startsWith('tools.') ||
    normalized.startsWith('tools[')
  ) {
    return 'tools';
  }
  if (
    normalized === 'input' ||
    normalized.startsWith('input.') ||
    normalized.startsWith('input[')
  ) {
    return 'input';
  }
  return 'unknown';
}

function providerRejectionClass(args: {
  sdkErrorKind: ProviderSdkErrorKind;
  status: number | null;
  codeClass: ProviderCodeClass;
}): ProviderFailureClass {
  if (args.codeClass === 'insufficient_quota') {
    return 'provider_quota_exhausted';
  }
  if (args.codeClass === 'rate_limit_exceeded') {
    return 'provider_rate_limited';
  }
  if (args.codeClass === 'model_not_found') {
    return 'provider_resource_not_found';
  }
  if (args.codeClass === 'invalid_api_key') {
    return 'provider_authentication';
  }
  if (args.codeClass === 'permission_denied') {
    return 'provider_permission_denied';
  }
  if (args.codeClass === 'server_error') {
    return 'provider_server_error';
  }
  if (
    args.sdkErrorKind === 'bad_request_error' ||
    args.status === 400
  ) {
    return 'provider_bad_request';
  }
  if (
    args.sdkErrorKind === 'authentication_error' ||
    args.status === 401
  ) {
    return 'provider_authentication';
  }
  if (
    args.sdkErrorKind === 'permission_denied_error' ||
    args.status === 403
  ) {
    return 'provider_permission_denied';
  }
  if (
    args.sdkErrorKind === 'not_found_error' ||
    args.status === 404
  ) {
    return 'provider_resource_not_found';
  }
  if (
    args.sdkErrorKind === 'conflict_error' ||
    args.status === 409
  ) {
    return 'provider_conflict';
  }
  if (
    args.sdkErrorKind === 'unprocessable_entity_error' ||
    args.status === 422
  ) {
    return 'provider_unprocessable';
  }
  if (
    args.sdkErrorKind === 'rate_limit_error' ||
    args.status === 429
  ) {
    return 'provider_rejection_unknown';
  }
  if (
    args.sdkErrorKind === 'internal_server_error' ||
    (args.status !== null && args.status >= 500)
  ) {
    return 'provider_server_error';
  }
  return 'provider_rejection_unknown';
}

export function createProviderFailureBoundaryObservations(
  args: Partial<ProviderFailureBoundaryObservations> = {},
): ProviderFailureBoundaryObservations {
  return {
    adapterInvoked: args.adapterInvoked ?? true,
    credentialReadSucceeded:
      args.credentialReadSucceeded ?? false,
    sdkClientConstructionStarted:
      args.sdkClientConstructionStarted ?? false,
    sdkClientConstructionSucceeded:
      args.sdkClientConstructionSucceeded ?? false,
    sdkRequestBuildStarted:
      args.sdkRequestBuildStarted ?? false,
    transportDispatchStarted:
      args.transportDispatchStarted ?? false,
    transportDispatchCount:
      typeof args.transportDispatchCount === 'number' &&
      Number.isSafeInteger(args.transportDispatchCount) &&
      args.transportDispatchCount >= 0
        ? args.transportDispatchCount
        : 0,
    canonicalRouteConfirmed:
      args.canonicalRouteConfirmed ?? false,
    canonicalModelConfirmed:
      args.canonicalModelConfirmed ?? false,
    httpResponseReceived:
      args.httpResponseReceived ?? false,
    httpStatus: safeHttpStatus(args.httpStatus),
    requestBodyDigest: args.requestBodyDigest ?? null,
    requestOptionsDigest:
      args.requestOptionsDigest ?? null,
    providerRequestIdDigest:
      args.providerRequestIdDigest ?? null,
  };
}

function diagnosticBase(
  observations: ProviderFailureBoundaryObservations,
): Omit<
  SanitizedProviderFailureDiagnostic,
  | 'phase'
  | 'failureClass'
  | 'sdkErrorKind'
  | 'providerCodeClass'
  | 'parameterClass'
> {
  return {
    adapterInvoked: observations.adapterInvoked,
    credentialReadSucceeded:
      observations.credentialReadSucceeded,
    transportDispatchStarted:
      observations.transportDispatchStarted,
    httpResponseReceived:
      observations.httpResponseReceived,
    httpStatus: safeHttpStatus(observations.httpStatus),
    requestBodyDigest: observations.requestBodyDigest,
    requestOptionsDigest:
      observations.requestOptionsDigest,
    providerRequestIdDigest:
      observations.providerRequestIdDigest,
    executionAttestation:
      canonicalAuthoringExecutionAttestation({
        transportDispatchCount:
          observations.transportDispatchCount,
        fallbackUsed: false,
        canonicalRouteConfirmed:
          observations.canonicalRouteConfirmed,
        canonicalModelConfirmed:
          observations.canonicalModelConfirmed,
      }),
  };
}

export class ProviderTransportGuardRejectionError extends Error {
  constructor(
    readonly reason:
      | 'unauthorized_destination'
      | 'non_post_request'
      | 'unauthorized_identity_headers',
  ) {
    super(
      reason === 'unauthorized_destination'
        ? 'canonical OpenAI Responses transport rejected an unauthorized destination'
        : reason === 'non_post_request'
          ? 'canonical OpenAI Responses transport rejected a non-POST request'
          : 'canonical OpenAI Responses transport rejected unauthorized identity headers',
    );
    this.name = 'ProviderTransportGuardRejectionError';
  }
}

export class ProviderCallFailureDiagnosticError extends Error {
  constructor(
    readonly diagnostic: SanitizedProviderFailureDiagnostic,
    message = 'sanitized provider call failure',
    readonly structuredOutputCompatibilityEvidence:
      | OpenAIResponsesStructuredOutputCompatibilityEvidence
      | null = null,
  ) {
    super(message);
    this.name = 'ProviderCallFailureDiagnosticError';
  }
}

export function localProviderFailureDiagnostic(args: {
  phase:
    | 'request_body_validation'
    | 'credential_read'
    | 'sdk_client_construction';
  failureClass:
    | 'local_request_validation'
    | 'credential_unavailable'
    | 'sdk_client_construction_failure';
  observations: ProviderFailureBoundaryObservations;
}): SanitizedProviderFailureDiagnostic {
  return {
    ...diagnosticBase(args.observations),
    phase: args.phase,
    failureClass: args.failureClass,
    sdkErrorKind: 'unknown',
    providerCodeClass: 'unknown',
    parameterClass: 'unknown',
  };
}

export function classifyProviderFailure(
  error: unknown,
  observations: ProviderFailureBoundaryObservations,
  sdkErrorClasses?: ProviderSdkErrorClasses,
): SanitizedProviderFailureDiagnostic {
  if (error instanceof ProviderCallFailureDiagnosticError) {
    return error.diagnostic;
  }
  const fields = structuredSdkFields(
    error,
    sdkErrorClasses,
  );
  const errorKind = sdkErrorKind(error, sdkErrorClasses);
  const observedStatus =
    fields.status ?? safeHttpStatus(observations.httpStatus);
  const observedRequestIdDigest =
    fields.providerRequestIdDigest ??
    observations.providerRequestIdDigest;
  const base = {
    ...diagnosticBase({
      ...observations,
      httpStatus: observedStatus,
      providerRequestIdDigest: observedRequestIdDigest,
    }),
    sdkErrorKind: errorKind,
    providerCodeClass: fields.codeClass,
    parameterClass: fields.parameterClass,
  };
  if (error instanceof ProviderTransportGuardRejectionError) {
    return {
      ...base,
      phase: 'transport_guard_rejection',
      failureClass: 'transport_guard_rejection',
    };
  }
  if (errorKind === 'api_user_abort_error') {
    return {
      ...base,
      phase: 'transport_dispatch',
      failureClass: 'request_aborted',
    };
  }
  if (errorKind === 'api_connection_timeout_error') {
    return {
      ...base,
      phase: 'transport_dispatch',
      failureClass: 'connection_timeout',
    };
  }
  if (errorKind === 'api_connection_error') {
    return {
      ...base,
      phase: 'transport_dispatch',
      failureClass: 'connection_failure',
    };
  }
  if (
    observations.httpResponseReceived &&
    errorKind !== 'api_error' &&
    !isSdkError(error, sdkErrorClasses?.apiError)
  ) {
    return {
      ...base,
      phase: 'response_parse',
      failureClass: 'provider_response_parse_failure',
    };
  }
  if (
    observedStatus !== null ||
    isSdkError(error, sdkErrorClasses?.apiError)
  ) {
    return {
      ...base,
      phase: 'http_response',
      failureClass: providerRejectionClass({
        sdkErrorKind: errorKind,
        status: observedStatus,
        codeClass: fields.codeClass,
      }),
    };
  }
  if (
    observations.sdkRequestBuildStarted &&
    !observations.transportDispatchStarted
  ) {
    return {
      ...base,
      phase: 'sdk_request_build',
      failureClass: 'sdk_request_build_failure',
    };
  }
  return {
    ...base,
    phase: 'unknown_adapter',
    failureClass: 'unclassified_adapter_failure',
  };
}

export function unclassifiedAdapterFailureDiagnostic(args: {
  requestOptionsDigest?: string | null;
} = {}): SanitizedProviderFailureDiagnostic {
  return {
    phase: 'unknown_adapter',
    failureClass: 'unclassified_adapter_failure',
    adapterInvoked: true,
    credentialReadSucceeded: false,
    transportDispatchStarted: false,
    httpResponseReceived: false,
    httpStatus: null,
    sdkErrorKind: 'unknown',
    providerCodeClass: 'unknown',
    parameterClass: 'unknown',
    requestBodyDigest: null,
    requestOptionsDigest:
      args.requestOptionsDigest ?? null,
    providerRequestIdDigest: null,
    executionAttestation:
      injectedAuthoringExecutionAttestation(),
  };
}

export function buildProviderCallFailureEvidence(args: {
  authoringRequestDigest: string;
  sourceSnapshotDigest: string;
  authoringReceiptDigest: string;
  attemptIndex: number;
  attemptKind: 'initial' | 'repair';
  provider: string;
  endpoint: string;
  model: string;
  diagnostic: SanitizedProviderFailureDiagnostic;
}): ProviderCallFailureEvidence {
  const withoutDigest = {
    version: PROVIDER_CALL_FAILURE_EVIDENCE_VERSION,
    authoringRequestDigest: args.authoringRequestDigest,
    sourceSnapshotDigest: args.sourceSnapshotDigest,
    authoringReceiptDigest: args.authoringReceiptDigest,
    attempt: {
      index: args.attemptIndex,
      kind: args.attemptKind,
    },
    provider: args.provider,
    endpoint: args.endpoint,
    model: args.model,
    phase: args.diagnostic.phase,
    failureClass: args.diagnostic.failureClass,
    adapterInvoked: args.diagnostic.adapterInvoked,
    credentialReadSucceeded:
      args.diagnostic.credentialReadSucceeded,
    transportDispatchStarted:
      args.diagnostic.transportDispatchStarted,
    httpResponseReceived:
      args.diagnostic.httpResponseReceived,
    httpStatus: args.diagnostic.httpStatus,
    sdkErrorKind: args.diagnostic.sdkErrorKind,
    providerCodeClass:
      args.diagnostic.providerCodeClass,
    parameterClass: args.diagnostic.parameterClass,
    requestBodyDigest:
      args.diagnostic.requestBodyDigest,
    requestOptionsDigest:
      args.diagnostic.requestOptionsDigest,
    providerRequestIdDigest:
      args.diagnostic.providerRequestIdDigest,
    executionAttestation:
      args.diagnostic.executionAttestation,
    billingState: 'unknown_no_usage' as const,
    doesNotAuthorize: [
      ...PROVIDER_FAILURE_DOES_NOT_AUTHORIZE,
    ],
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(withoutDigest),
  };
}
