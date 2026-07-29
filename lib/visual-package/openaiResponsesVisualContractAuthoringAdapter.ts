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
  ResponseCreateParamsNonStreaming,
} from 'openai/resources/responses/responses';

import {
  VISUAL_CONTRACT_AUTHORING_ENDPOINT,
  VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
  VISUAL_CONTRACT_AUTHORING_MODEL,
  VISUAL_CONTRACT_AUTHORING_NO_FALLBACK,
  VISUAL_CONTRACT_AUTHORING_PROVIDER,
  VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT,
  VISUAL_CONTRACT_AUTHORING_SERVICE_TIER,
  VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS,
  VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED,
  VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES,
} from '@/lib/visual-contract-compiler/authoringPolicy';
import type {
  ContractLlmCallOptions,
} from '@/lib/visual-contract-compiler/compileBookVisualContract';
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  TEMPLATE_DRAFT_SCHEMA_NAME,
} from '@/lib/visual-contract-compiler/templateDraftSchema';

import { canonicalJsonDigest } from './integrity';
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
  OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
  type VisualContractAuthoringProvider,
  type VisualContractAuthoringProviderResponse,
} from './visualContractAuthoringLifecycle';

export {
  OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
};

export const OPENAI_RESPONSES_AUTHORING_CREDENTIAL_ENV =
  'OPENAI_API_KEY' as const;
export const OPENAI_RESPONSES_AUTHORING_BASE_URL =
  'https://api.openai.com/v1' as const;
export const OPENAI_RESPONSES_AUTHORING_ENDPOINT_URL =
  'https://api.openai.com/v1/responses' as const;

const FORBIDDEN_OPENAI_IDENTITY_HEADERS = [
  'openai-organization',
  'openai-project',
  'openai-webhook-secret',
] as const;

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
  body: ResponseCreateParamsNonStreaming;
  requestOptions: {
    maxRetries: 0;
    timeout: typeof VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS;
  };
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
  if (
    options.maxInputTokens !==
    VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS
  ) {
    issues.push('max_input_tokens');
  }
  if (
    !Number.isSafeInteger(options.maxOutputTokens) ||
    (options.maxOutputTokens ?? 0) < 32_000 ||
    (options.maxOutputTokens ?? 0) > 64_000
  ) {
    issues.push('max_output_tokens');
  }
  if (
    options.jsonSchema?.name !==
      TEMPLATE_DRAFT_SCHEMA_NAME ||
    canonicalJsonDigest(options.jsonSchema?.schema) !==
      canonicalJsonDigest(TEMPLATE_DRAFT_JSON_SCHEMA)
  ) {
    issues.push('structured_output');
  }
  return issues;
}

export function buildOpenAIResponsesVisualContractAuthoringBody(
  args: {
    systemPrompt: string;
    userPrompt: string;
    options: ContractLlmCallOptions;
  },
): ResponseCreateParamsNonStreaming {
  const issues = exactCallOptionsIssues(args.options);
  if (issues.length > 0) {
    throw new Error(
      `visual_contract_authoring_adapter_policy_mismatch: ${issues.join(',')}`,
    );
  }
  return {
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
        name: TEMPLATE_DRAFT_SCHEMA_NAME,
        schema: TEMPLATE_DRAFT_JSON_SCHEMA,
        strict: true,
      },
    },
    tools: [],
    tool_choice: 'none',
    store: false,
  };
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
    if (method !== 'POST') {
      throw new ProviderTransportGuardRejectionError(
        'non_post_request',
      );
    }
    const headers = combinedHeaders(input, init);
    if (
      FORBIDDEN_OPENAI_IDENTITY_HEADERS.some((name) =>
        headers.has(name),
      )
    ) {
      throw new ProviderTransportGuardRejectionError(
        'unauthorized_identity_headers',
      );
    }
    if (observations) {
      observations.transportDispatchStarted = true;
    }
    const response = await delegatedFetch(input, {
      ...init,
      redirect: 'error',
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
    create: async ({ apiKey, body, requestOptions }) => {
      const observations =
        createProviderFailureBoundaryObservations({
          adapterInvoked: true,
          credentialReadSucceeded: true,
          requestBodyDigest: canonicalJsonDigest(body),
          requestOptionsDigest:
            canonicalJsonDigest(requestOptions),
        });
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
          organization: null,
          project: null,
          webhookSecret: null,
          maxRetries: requestOptions.maxRetries,
          timeout: requestOptions.timeout,
          fetch: createGuardedOpenAIResponsesAuthoringFetch(
            globalThis.fetch,
            observations,
          ),
          fetchOptions: {
            redirect: 'error',
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
        return await client.responses.create(
          body,
          requestOptions,
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

export function mapOpenAIResponsesAuthoringResponse(
  rawResponse: unknown,
): VisualContractAuthoringProviderResponse {
  const response = record(rawResponse);
  const mappedUsage = mapUsage(response?.usage);
  return {
    output:
      typeof response?.output_text === 'string'
        ? response.output_text
        : '',
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
      usageEvidenceComplete: mappedUsage.complete,
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
      let body: ResponseCreateParamsNonStreaming;
      try {
        body =
          buildOpenAIResponsesVisualContractAuthoringBody({
            systemPrompt,
            userPrompt,
            options,
          });
        observations.requestBodyDigest =
          canonicalJsonDigest(body);
      } catch {
        throw new ProviderCallFailureDiagnosticError(
          localProviderFailureDiagnostic({
            phase: 'request_body_validation',
            failureClass: 'local_request_validation',
            observations,
          }),
          'visual_contract_authoring_adapter_policy_mismatch',
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
