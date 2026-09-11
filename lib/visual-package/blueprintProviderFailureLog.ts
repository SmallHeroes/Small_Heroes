import {
  classifyProviderFailure,
  localProviderFailureDiagnostic,
  projectProviderErrorLogDetail,
  type ProviderFailureBoundaryObservations,
} from './providerFailureDiagnostics';

// Supplemental operator log only: never receipt/approval/retry authority. The
// classifier's typed error can still be constructed by an injected transport,
// so project an explicit allowlist instead of serializing the diagnostic/error.
const PHASES = ['request_body_validation', 'credential_read', 'sdk_client_construction',
  'sdk_request_build', 'transport_guard_rejection', 'transport_dispatch', 'http_response',
  'response_parse', 'unknown_adapter'] as const;
const CLASSES = ['local_request_validation', 'credential_unavailable', 'sdk_client_construction_failure',
  'sdk_request_build_failure', 'transport_guard_rejection', 'request_aborted', 'connection_timeout',
  'connection_failure', 'provider_bad_request', 'provider_authentication', 'provider_permission_denied',
  'provider_resource_not_found', 'provider_quota_exhausted', 'provider_rate_limited', 'provider_conflict',
  'provider_unprocessable', 'provider_server_error', 'provider_response_parse_failure',
  'provider_rejection_unknown', 'unclassified_adapter_failure'] as const;
const CODES = ['invalid_request', 'invalid_api_key', 'permission_denied', 'model_not_found',
  'insufficient_quota', 'rate_limit_exceeded', 'server_error', 'unknown'] as const;
const PARAMETERS = ['structured_output_schema', 'model', 'service_tier', 'max_tokens', 'tools', 'input', 'unknown'] as const;
const SDK_KINDS = ['api_user_abort_error', 'api_connection_timeout_error', 'api_connection_error',
  'bad_request_error', 'authentication_error', 'permission_denied_error', 'not_found_error',
  'conflict_error', 'unprocessable_entity_error', 'rate_limit_error', 'internal_server_error',
  'api_error', 'openai_error', 'unknown'] as const;

function field(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  // Do not invoke accessors, toJSON, toString, or enumerate extra fields.
  try { return Object.getOwnPropertyDescriptor(value, key)?.value; }
  catch { return undefined; }
}
function member<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}
function digest(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

/** Best-effort logging must never replace the existing terminal error or retry. */
export function reportBlueprintProviderFailure(args: {
  error: unknown;
  observations: ProviderFailureBoundaryObservations;
  credentialReadFailed?: boolean;
}): void {
  let diagnostic: unknown;
  try {
    diagnostic = args.credentialReadFailed
      ? localProviderFailureDiagnostic({ phase: 'credential_read', failureClass: 'credential_unavailable', observations: args.observations })
      : classifyProviderFailure(args.error, args.observations);
  } catch { diagnostic = null; }
  const status = field(diagnostic, 'httpStatus');
  const event = {
    event: 'blueprint_provider_failure',
    version: 'blueprint-provider-failure-log/v2',
    authorityScope: 'diagnostic_log_only',
    phase: member(field(diagnostic, 'phase'), PHASES, 'unknown_adapter'),
    failureClass: member(field(diagnostic, 'failureClass'), CLASSES, 'unclassified_adapter_failure'),
    providerCodeClass: member(field(diagnostic, 'providerCodeClass'), CODES, 'unknown'),
    parameterClass: member(field(diagnostic, 'parameterClass'), PARAMETERS, 'unknown'),
    sdkErrorKind: member(field(diagnostic, 'sdkErrorKind'), SDK_KINDS, 'unknown'),
    detail: projectProviderErrorLogDetail(field(args.error, 'operatorDetail')),
    httpStatus: typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    httpResponseReceived: field(diagnostic, 'httpResponseReceived') === true,
    transportDispatchStarted: field(diagnostic, 'transportDispatchStarted') === true,
    requestBodyDigest: digest(field(diagnostic, 'requestBodyDigest')),
    requestOptionsDigest: digest(field(diagnostic, 'requestOptionsDigest')),
    providerRequestIdDigest: digest(field(diagnostic, 'providerRequestIdDigest')),
    billingState: 'unknown_no_usage',
  };
  try {
    const line = JSON.stringify(event);
    console.error(Buffer.byteLength(line, 'utf8') <= 2048 ? line : JSON.stringify({ ...event, detail: null }));
  }
  catch { /* No logging failure may alter terminal behavior or authorize work. */ }
}
