import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  OpenAIError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from 'openai';
import type {
  ResponseCreateParamsStreaming,
} from 'openai/resources/responses/responses';

import {
  VISUAL_CONTRACT_AUTHORING_ENDPOINT,
  VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
  VISUAL_CONTRACT_AUTHORING_MAX_PAGES_CURRENT_POLICY,
  VISUAL_CONTRACT_AUTHORING_MODEL,
  VISUAL_CONTRACT_AUTHORING_NO_FALLBACK,
  VISUAL_CONTRACT_AUTHORING_PROVIDER,
  VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT,
  VISUAL_CONTRACT_AUTHORING_SERVICE_TIER,
  VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS,
  VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED,
  VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES,
  VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_INPUT_TOKENS,
  VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_OUTPUT_TOKENS,
  authoringStandardAttemptOutputLimits,
} from '@/lib/visual-contract-compiler/authoringPolicy';
import type {
  ContractLlmCallOptions,
} from '@/lib/visual-contract-compiler/compileBookVisualContract';
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  TEMPLATE_DRAFT_SCHEMA_NAME,
} from '@/lib/visual-contract-compiler/templateDraftSchema';
import {
  SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
  SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME,
} from '@/lib/visual-contract-compiler/sourceEvidenceIdRepair';
import {
  PAGE_CONTRACT_REPAIR_JSON_SCHEMA,
  PAGE_CONTRACT_REPAIR_SCHEMA_NAME,
  PAGE_SPATIAL_REFERENCE_REPAIR_JSON_SCHEMA,
  PAGE_SPATIAL_REFERENCE_REPAIR_SCHEMA_NAME,
} from '@/lib/visual-contract-compiler/pageContractRepair';
import {
  REPRESENTED_ELSEWHERE_REPAIR_JSON_SCHEMA,
  REPRESENTED_ELSEWHERE_REPAIR_SCHEMA_NAME,
} from '@/lib/visual-contract-compiler/representedElsewhereRepair';
import {
  STRUCTURAL_BUNDLE_REPAIR_JSON_SCHEMA,
  STRUCTURAL_BUNDLE_REPAIR_SCHEMA_NAME,
} from '@/lib/visual-contract-compiler/structuralBundleRepair';
import {
  BOOK_SURFACE_REPAIR_JSON_SCHEMA,
  BOOK_SURFACE_REPAIR_SCHEMA_NAME,
} from '@/lib/visual-contract-compiler/bookSurfaceRepair';
import {
  PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA,
  PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_NAME,
} from '@/lib/visual-contract-compiler/presentationRequirementRepair';
import {
  STABLE_PROP_SCOPE_REPAIR_JSON_SCHEMA,
  STABLE_PROP_SCOPE_REPAIR_SCHEMA_NAME,
} from '@/lib/visual-contract-compiler/stablePropScopeRepair';

import { canonicalJsonDigest } from './integrity';
import {
  OPENAI_RESPONSES_AUTHORING_BASE_URL,
  OPENAI_RESPONSES_AUTHORING_ENDPOINT_URL,
  OPENAI_RESPONSES_TRANSPORT_AUTHORITY,
} from './openAIResponsesTransportAuthority';
import {
  canonicalAuthoringExecutionAttestation,
  type AuthoringExecutionAttestation,
} from './authoringTerminalDiagnostics';
import {
  ProviderCallFailureDiagnosticError,
  ProviderTransportGuardRejectionError,
  classifyProviderFailure,
  createProviderFailureBoundaryObservations,
  localProviderFailureDiagnostic,
  type ProviderFailureBoundaryObservations,
  type ProviderSdkErrorClasses,
} from './providerFailureDiagnostics';
import {
  OpenAIResponsesStructuredOutputSchemaCompatibilityError,
  assertOpenAIResponsesStructuredOutputSchemaCompatible,
} from './openaiResponsesStructuredOutputSchemaCompatibility';
import {
  OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
  type VisualContractAuthoringProvider,
  type VisualContractAuthoringProviderIncompleteReason,
  type VisualContractAuthoringProviderResponse,
} from './visualContractAuthoringLifecycle';

export {
  OPENAI_RESPONSES_AUTHORING_BASE_URL,
  OPENAI_RESPONSES_AUTHORING_ENDPOINT_URL,
  OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
};

export const OPENAI_RESPONSES_AUTHORING_CREDENTIAL_ENV =
  'OPENAI_API_KEY' as const;

const OPENAI_SDK_ERROR_CLASSES = {
  apiUserAbortError: APIUserAbortError,
  apiConnectionTimeoutError: APIConnectionTimeoutError,
  apiConnectionError: APIConnectionError,
  badRequestError: BadRequestError,
  authenticationError: AuthenticationError,
  permissionDeniedError: PermissionDeniedError,
  notFoundError: NotFoundError,
  conflictError: ConflictError,
  unprocessableEntityError: UnprocessableEntityError,
  rateLimitError: RateLimitError,
  internalServerError: InternalServerError,
  apiError: APIError,
  openAIError: OpenAIError,
} satisfies ProviderSdkErrorClasses;

export type OpenAIResponsesAuthoringFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface OpenAIResponsesAuthoringTransportRequest {
  apiKey: string;
  body: ResponseCreateParamsStreaming;
  requestOptions: {
    maxRetries: 0;
    timeout: typeof VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS;
  };
  observations: ProviderFailureBoundaryObservations;
}

export interface OpenAIResponsesAuthoringTransport {
  create(
    request: OpenAIResponsesAuthoringTransportRequest,
  ): Promise<unknown>;
}

export type OpenAIResponsesAuthoringCredentialReader =
  () => string;

export interface OpenAIResponsesVisualContractAuthoringAdapterDeps {
  transport?: OpenAIResponsesAuthoringTransport;
  readCredential?: OpenAIResponsesAuthoringCredentialReader;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonNegativeSafeInteger(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

const STANDARD_ATTEMPT_OUTPUT_LIMITS = new Set(
  Array.from(
    {
      length:
        VISUAL_CONTRACT_AUTHORING_MAX_PAGES_CURRENT_POLICY,
    },
    (_, index) =>
      authoringStandardAttemptOutputLimits(index + 1),
  ).flat(),
);

function exactCallOptionsIssues(
  options: ContractLlmCallOptions,
): string[] {
  const issues: string[] = [];
  if (options.model !== VISUAL_CONTRACT_AUTHORING_MODEL) {
    issues.push('model');
  }
  if (
    options.reasoningEffort !==
    VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT
  ) {
    issues.push('reasoning_effort');
  }
  if (
    options.provider !== VISUAL_CONTRACT_AUTHORING_PROVIDER
  ) {
    issues.push('provider');
  }
  if (
    options.endpoint !== VISUAL_CONTRACT_AUTHORING_ENDPOINT
  ) {
    issues.push('endpoint');
  }
  if (
    options.serviceTier !==
    VISUAL_CONTRACT_AUTHORING_SERVICE_TIER
  ) {
    issues.push('service_tier');
  }
  if (
    options.toolsDisabled !==
    VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED
  ) {
    issues.push('tools');
  }
  if (
    options.noFallback !==
    VISUAL_CONTRACT_AUTHORING_NO_FALLBACK
  ) {
    issues.push('fallback');
  }
  if (
    options.transportRetries !==
    VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES
  ) {
    issues.push('transport_retries');
  }
  if (
    options.timeoutMs !==
    VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS
  ) {
    issues.push('timeout');
  }
  const schemaName = options.jsonSchema?.name;
  const schemaDigest = canonicalJsonDigest(
    options.jsonSchema?.schema,
  );
  const structuredOutputMatches =
    (schemaName === TEMPLATE_DRAFT_SCHEMA_NAME &&
      schemaDigest === canonicalJsonDigest(TEMPLATE_DRAFT_JSON_SCHEMA)) ||
    (schemaName === SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME &&
      schemaDigest ===
        canonicalJsonDigest(SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA)) ||
    (schemaName === PAGE_CONTRACT_REPAIR_SCHEMA_NAME &&
      schemaDigest ===
        canonicalJsonDigest(PAGE_CONTRACT_REPAIR_JSON_SCHEMA)) ||
    (schemaName === REPRESENTED_ELSEWHERE_REPAIR_SCHEMA_NAME &&
      schemaDigest ===
        canonicalJsonDigest(REPRESENTED_ELSEWHERE_REPAIR_JSON_SCHEMA)) ||
    (schemaName === PAGE_SPATIAL_REFERENCE_REPAIR_SCHEMA_NAME &&
      schemaDigest ===
        canonicalJsonDigest(PAGE_SPATIAL_REFERENCE_REPAIR_JSON_SCHEMA)) ||
    (schemaName === STRUCTURAL_BUNDLE_REPAIR_SCHEMA_NAME &&
      schemaDigest ===
        canonicalJsonDigest(STRUCTURAL_BUNDLE_REPAIR_JSON_SCHEMA)) ||
    (schemaName === BOOK_SURFACE_REPAIR_SCHEMA_NAME &&
      schemaDigest ===
        canonicalJsonDigest(BOOK_SURFACE_REPAIR_JSON_SCHEMA)) ||
    (schemaName === PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_NAME &&
      schemaDigest ===
        canonicalJsonDigest(PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA)) ||
    (schemaName === STABLE_PROP_SCOPE_REPAIR_SCHEMA_NAME &&
      schemaDigest ===
        canonicalJsonDigest(STABLE_PROP_SCOPE_REPAIR_JSON_SCHEMA));
  if (!structuredOutputMatches) {
    issues.push('structured_output');
  }
  const standardAttemptBudget =
    options.maxInputTokens ===
      VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS &&
    Number.isSafeInteger(options.maxOutputTokens) &&
    STANDARD_ATTEMPT_OUTPUT_LIMITS.has(
      options.maxOutputTokens!,
    );
  if (!standardAttemptBudget) {
    if (
      options.maxInputTokens !==
        VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS &&
      options.maxInputTokens !==
        VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_INPUT_TOKENS
    ) {
      issues.push('max_input_tokens');
    }
    if (
      !Number.isSafeInteger(options.maxOutputTokens) ||
      (!STANDARD_ATTEMPT_OUTPUT_LIMITS.has(
        options.maxOutputTokens!,
      ) &&
        options.maxOutputTokens !==
          VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_OUTPUT_TOKENS)
    ) {
      issues.push('max_output_tokens');
    }
    if (
      !issues.includes('max_input_tokens') &&
      !issues.includes('max_output_tokens')
    ) {
      issues.push('output_budget_pair');
    }
  }
  return issues;
}

export function buildOpenAIResponsesVisualContractAuthoringBody(
  args: {
    systemPrompt: string;
    userPrompt: string;
    options: ContractLlmCallOptions;
  },
): ResponseCreateParamsStreaming {
  const issues = exactCallOptionsIssues(args.options);
  if (issues.length > 0) {
    throw new Error(
      `visual_contract_authoring_adapter_policy_mismatch: ${issues.join(',')}`,
    );
  }
  const body: ResponseCreateParamsStreaming = {
    model: VISUAL_CONTRACT_AUTHORING_MODEL,
    service_tier: VISUAL_CONTRACT_AUTHORING_SERVICE_TIER,
    max_output_tokens: args.options.maxOutputTokens!,
    input: [
      { role: 'system', content: args.systemPrompt },
      { role: 'user', content: args.userPrompt },
    ],
    reasoning: {
      effort: VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT,
    },
    text: {
      format: {
        type: 'json_schema',
        name: args.options.jsonSchema!.name,
        schema: args.options.jsonSchema!.schema,
        strict: true,
      },
    },
    tools: [],
    tool_choice: 'none',
    store: false,
    stream: true,
  };
  const format = body.text?.format;
  assertOpenAIResponsesStructuredOutputSchemaCompatible(
    format?.type === 'json_schema'
      ? format.schema
      : null,
  );
  return body;
}

const TERMINAL_RESPONSE_STREAM_EVENT_TYPES = new Set([
  'response.completed',
  'response.failed',
  'response.incomplete',
]);

/**
 * Reduces one Responses SSE stream to its sole terminal response without
 * retaining deltas. Raw provider error events are deliberately discarded;
 * callers receive only a stable local error that the existing sanitized
 * provider-failure boundary can classify.
 */
export async function collectOpenAIResponsesAuthoringStream(
  stream: AsyncIterable<unknown>,
): Promise<unknown> {
  let terminalResponse: unknown;
  let terminalSeen = false;
  for await (const rawEvent of stream) {
    const event = record(rawEvent);
    const eventType = event?.type;
    if (!event || typeof eventType !== 'string') {
      throw new Error('provider_stream_event_invalid');
    }
    if (terminalSeen) {
      throw new Error('provider_stream_event_after_terminal');
    }
    if (eventType === 'error') {
      throw new Error('provider_stream_error_event');
    }
    if (!TERMINAL_RESPONSE_STREAM_EVENT_TYPES.has(eventType)) {
      continue;
    }
    if (!record(event.response)) {
      throw new Error('provider_stream_terminal_response_invalid');
    }
    terminalResponse = event.response;
    terminalSeen = true;
  }
  if (!terminalSeen) {
    throw new Error('provider_stream_terminal_event_missing');
  }
  return terminalResponse;
}

function requestUrl(
  input: string | URL | Request,
): URL {
  return new URL(
    input instanceof Request ? input.url : input,
  );
}

function combinedHeaders(
  input: string | URL | Request,
  init: RequestInit | undefined,
): Headers {
  const headers = new Headers(
    input instanceof Request ? input.headers : undefined,
  );
  new Headers(init?.headers).forEach((value, key) => {
    headers.set(key, value);
  });
  return headers;
}

/**
 * The credential-bearing transport may send only one POST to the exact
 * OpenAI Responses endpoint. Redirect following and SDK-injected
 * organization/project/webhook authority are rejected before the delegated
 * fetch can observe credentials or prompts.
 */
export function createGuardedOpenAIResponsesAuthoringFetch(
  delegatedFetch: OpenAIResponsesAuthoringFetch,
  observations?: ProviderFailureBoundaryObservations,
): OpenAIResponsesAuthoringFetch {
  let dispatchCount = 0;
  return async (input, init) => {
    const url = requestUrl(input);
    if (
      url.href !== OPENAI_RESPONSES_AUTHORING_ENDPOINT_URL ||
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new ProviderTransportGuardRejectionError(
        'unauthorized_destination',
      );
    }
    const method = (
      init?.method ??
      (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    if (method !== OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation.method) {
      throw new ProviderTransportGuardRejectionError(
        'non_post_request',
      );
    }
    const headers = combinedHeaders(input, init);
    if (
      OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation.forbiddenIdentityHeaders.some((name) =>
        headers.has(name),
      )
    ) {
      throw new ProviderTransportGuardRejectionError(
        'unauthorized_identity_headers',
      );
    }
    if (
      dispatchCount >=
      OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation.maxDispatches
    ) {
      throw new ProviderTransportGuardRejectionError('duplicate_dispatch');
    }
    dispatchCount += 1;
    if (observations) {
      observations.transportDispatchStarted = true;
      observations.transportDispatchCount += 1;
      observations.canonicalRouteConfirmed = true;
    }
    const response = await delegatedFetch(input, {
      ...init,
      redirect: OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation.redirect,
    });
    if (observations && response instanceof Response) {
      observations.httpResponseReceived = true;
      observations.httpStatus = response.status;
      const requestId =
        response.headers.get('x-request-id');
      observations.providerRequestIdDigest =
        typeof requestId === 'string' &&
        requestId.length > 0 &&
        requestId.length <= 512
          ? canonicalJsonDigest(requestId)
          : null;
    }
    return response;
  };
}

export const openAIResponsesAuthoringTransport: OpenAIResponsesAuthoringTransport =
  {
    create: async ({
      apiKey,
      body,
      requestOptions,
      observations,
    }) => {
      observations.sdkClientConstructionStarted = true;
      let client: OpenAI;
      try {
        if (typeof globalThis.fetch !== 'function') {
          throw new Error(
            'canonical OpenAI Responses transport requires global fetch',
          );
        }
        client = new OpenAI({
          apiKey,
          baseURL: OPENAI_RESPONSES_AUTHORING_BASE_URL,
          ...OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation.sdkIdentity,
          maxRetries: requestOptions.maxRetries,
          timeout: requestOptions.timeout,
          fetch: createGuardedOpenAIResponsesAuthoringFetch(
            globalThis.fetch,
            observations,
          ),
          fetchOptions: {
            redirect: OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation.redirect,
          },
          logLevel: 'error',
        });
        observations.sdkClientConstructionSucceeded = true;
      } catch {
        throw new ProviderCallFailureDiagnosticError(
          localProviderFailureDiagnostic({
            phase: 'sdk_client_construction',
            failureClass:
              'sdk_client_construction_failure',
            observations,
          }),
        );
      }
      observations.sdkRequestBuildStarted = true;
      try {
        const stream = await client.responses.create(
          body,
          requestOptions,
        );
        return await collectOpenAIResponsesAuthoringStream(
          stream,
        );
      } catch (error) {
        throw new ProviderCallFailureDiagnosticError(
          classifyProviderFailure(
            error,
            observations,
            OPENAI_SDK_ERROR_CLASSES,
          ),
        );
      }
    },
  };

export const readOpenAIResponsesAuthoringCredential: OpenAIResponsesAuthoringCredentialReader =
  () => {
    const value =
      process.env[
        OPENAI_RESPONSES_AUTHORING_CREDENTIAL_ENV
      ];
    if (!value?.trim()) {
      throw new Error(
        `${OPENAI_RESPONSES_AUTHORING_CREDENTIAL_ENV} is required for canonical live authoring`,
      );
    }
    return value;
  };

function mapUsage(rawUsage: unknown): {
  usage: Record<string, unknown> | null;
  complete: boolean;
} {
  const usage = record(rawUsage);
  const inputDetails = record(
    usage?.input_tokens_details,
  );
  const outputDetails = record(
    usage?.output_tokens_details,
  );
  const values = {
    input_tokens: usage?.input_tokens,
    cached_input_tokens: inputDetails?.cached_tokens,
    cache_write_input_tokens:
      inputDetails?.cache_write_tokens,
    output_tokens: usage?.output_tokens,
    reasoning_tokens: outputDetails?.reasoning_tokens,
    total_tokens: usage?.total_tokens,
  };
  const individuallyValid = Object.values(values).every(
    nonNegativeSafeInteger,
  );
  const internallyConsistent =
    individuallyValid &&
    (values.cached_input_tokens as number) <=
      (values.input_tokens as number) &&
    (values.cache_write_input_tokens as number) <=
      (values.input_tokens as number) -
        (values.cached_input_tokens as number) &&
    (values.reasoning_tokens as number) <=
      (values.output_tokens as number) &&
    Number.isSafeInteger(
      (values.input_tokens as number) +
        (values.output_tokens as number),
    ) &&
    (values.total_tokens as number) ===
      (values.input_tokens as number) +
        (values.output_tokens as number);
  return {
    usage: usage ? values : null,
    complete: internallyConsistent,
  };
}

function mappedResponseOutputText(
  response: Record<string, unknown> | null,
): string {
  if (typeof response?.output_text === 'string') {
    return response.output_text;
  }
  if (!Array.isArray(response?.output)) return '';
  const texts: string[] = [];
  for (const rawItem of response.output) {
    const item = record(rawItem);
    if (item?.type !== 'message') continue;
    if (!Array.isArray(item.content)) return '';
    for (const rawContent of item.content) {
      const content = record(rawContent);
      if (content?.type !== 'output_text') continue;
      if (typeof content.text !== 'string') return '';
      texts.push(content.text);
    }
  }
  return texts.join('');
}

/**
 * Closed normalization of the Responses `incomplete_details.reason` field.
 * The installed SDK documents only these two provider spellings; every
 * absent, malformed, or future value collapses without retaining provider
 * material.
 */
export function normalizeOpenAIResponsesAuthoringIncompleteReason(
  rawResponse: unknown,
): VisualContractAuthoringProviderIncompleteReason {
  const response = record(rawResponse);
  const reason = record(response?.incomplete_details)?.reason;
  if (reason === 'max_output_tokens') {
    return 'max_output_tokens';
  }
  if (reason === 'content_filter') {
    return 'content_filter';
  }
  return 'other_or_absent';
}

export function mapOpenAIResponsesAuthoringResponse(
  rawResponse: unknown,
  executionAttestation: AuthoringExecutionAttestation =
    canonicalAuthoringExecutionAttestation({
      transportDispatchCount: 0,
      fallbackUsed: false,
      canonicalRouteConfirmed: false,
      canonicalModelConfirmed: false,
    }),
): VisualContractAuthoringProviderResponse {
  const response = record(rawResponse);
  const mappedUsage = mapUsage(response?.usage);
  return {
    output: mappedResponseOutputText(response),
    receipt: {
      provider: VISUAL_CONTRACT_AUTHORING_PROVIDER,
      model:
        typeof response?.model === 'string'
          ? response.model
          : '',
      ...(typeof response?.id === 'string'
        ? { responseId: response.id }
        : {}),
      usage: mappedUsage.usage,
      evidenceVersion:
        OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
      completionStatus:
        typeof response?.status === 'string'
          ? response.status
          : '',
      providerIncompleteReason:
        normalizeOpenAIResponsesAuthoringIncompleteReason(
          rawResponse,
        ),
      usageEvidenceComplete: mappedUsage.complete,
      executionAttestation,
    },
  };
}

/**
 * The sole D1A live adapter. Construction performs no credential read and no
 * provider work. The credential is read inside `call`, after the lifecycle has
 * passed its deterministic source/request/schema/price/spend/input/options
 * gates and this adapter has independently checked the locked call options.
 */
export function createOpenAIResponsesVisualContractAuthoringAdapter(
  deps: OpenAIResponsesVisualContractAuthoringAdapterDeps = {},
): VisualContractAuthoringProvider {
  const transport =
    deps.transport ?? openAIResponsesAuthoringTransport;
  const readCredential =
    deps.readCredential ??
    readOpenAIResponsesAuthoringCredential;
  return {
    call: async ({
      systemPrompt,
      userPrompt,
      options,
    }) => {
      const requestOptions = {
        maxRetries:
          VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES,
        timeout: VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS,
      } as const;
      const observations =
        createProviderFailureBoundaryObservations({
          adapterInvoked: true,
          requestOptionsDigest:
            canonicalJsonDigest(requestOptions),
        });
      let body: ResponseCreateParamsStreaming;
      try {
        body =
          buildOpenAIResponsesVisualContractAuthoringBody({
            systemPrompt,
            userPrompt,
            options,
          });
        observations.requestBodyDigest =
          canonicalJsonDigest(body);
        observations.canonicalModelConfirmed =
          body.model === VISUAL_CONTRACT_AUTHORING_MODEL;
      } catch (error) {
        throw new ProviderCallFailureDiagnosticError(
          localProviderFailureDiagnostic({
            phase: 'request_body_validation',
            failureClass: 'local_request_validation',
            observations,
          }),
          'visual_contract_authoring_adapter_policy_mismatch',
          error instanceof
            OpenAIResponsesStructuredOutputSchemaCompatibilityError
            ? error.evidence
            : null,
        );
      }
      let apiKey: string;
      try {
        apiKey = readCredential();
        observations.credentialReadSucceeded = true;
      } catch {
        throw new ProviderCallFailureDiagnosticError(
          localProviderFailureDiagnostic({
            phase: 'credential_read',
            failureClass: 'credential_unavailable',
            observations,
          }),
        );
      }
      let rawResponse: unknown;
      try {
        rawResponse = await transport.create({
          apiKey,
          body,
          requestOptions,
          observations,
        });
      } catch (error) {
        if (
          error instanceof
          ProviderCallFailureDiagnosticError
        ) {
          throw error;
        }
        throw new ProviderCallFailureDiagnosticError(
          classifyProviderFailure(
            error,
            observations,
            OPENAI_SDK_ERROR_CLASSES,
          ),
        );
      }
      try {
        return mapOpenAIResponsesAuthoringResponse(
          rawResponse,
          canonicalAuthoringExecutionAttestation({
            transportDispatchCount:
              observations.transportDispatchCount,
            fallbackUsed: false,
            canonicalRouteConfirmed:
              observations.canonicalRouteConfirmed,
            canonicalModelConfirmed:
              observations.canonicalModelConfirmed,
          }),
        );
      } catch (error) {
        throw new ProviderCallFailureDiagnosticError(
          classifyProviderFailure(
            error,
            observations,
            OPENAI_SDK_ERROR_CLASSES,
          ),
        );
      }
    },
  };
}
