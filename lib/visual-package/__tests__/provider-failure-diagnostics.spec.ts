import fs from 'node:fs';
import path from 'node:path';

import {
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
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  VISUAL_CONTRACT_AUTHORING_ENDPOINT,
  VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
  VISUAL_CONTRACT_AUTHORING_MODEL,
  VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT,
  VISUAL_CONTRACT_AUTHORING_SERVICE_TIER,
  VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS,
} from '@/lib/visual-contract-compiler/authoringPolicy';
import type {
  ContractLlmCallOptions,
} from '@/lib/visual-contract-compiler/compileBookVisualContract';
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  TEMPLATE_DRAFT_SCHEMA_NAME,
} from '@/lib/visual-contract-compiler/templateDraftSchema';
import {
  createOpenAIResponsesVisualContractAuthoringAdapter,
} from '@/lib/visual-package/openaiResponsesVisualContractAuthoringAdapter';
import {
  ProviderCallFailureDiagnosticError,
  ProviderTransportGuardRejectionError,
  buildProviderCallFailureEvidence,
  classifyProviderFailure,
  classifyProviderParameter,
  createProviderFailureBoundaryObservations,
  localProviderFailureDiagnostic,
  unclassifiedAdapterFailureDiagnostic,
  type ProviderFailureBoundaryObservations,
  type ProviderSdkErrorClasses,
  type SanitizedProviderFailureDiagnostic,
} from '@/lib/visual-package/providerFailureDiagnostics';
import {
  canonicalJsonDigest,
} from '@/lib/visual-package/integrity';

const FAKE_CREDENTIAL =
  'RAW_FAKE_CREDENTIAL_MUST_NEVER_SERIALIZE';
const RAW_MESSAGE =
  'RAW_PROVIDER_MESSAGE_MUST_NEVER_SERIALIZE';
const RAW_CAUSE =
  'RAW_PROVIDER_CAUSE_MUST_NEVER_SERIALIZE';
const RAW_HEADER =
  'RAW_PROVIDER_HEADER_MUST_NEVER_SERIALIZE';
const RAW_PARAM =
  'RAW_PROVIDER_PARAM_MUST_NEVER_SERIALIZE';
const RAW_CODE =
  'RAW_UNKNOWN_PROVIDER_CODE_MUST_NEVER_SERIALIZE';
const RAW_REQUEST_ID =
  'req_RAW_PROVIDER_REQUEST_ID_MUST_NEVER_SERIALIZE';
const RAW_PROMPT =
  'RAW_PROMPT_AND_BODY_MUST_NEVER_SERIALIZE';

const originalFetch = globalThis.fetch;

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

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function classifyOpenAIProviderFailure(
  error: unknown,
  observations: ProviderFailureBoundaryObservations,
): SanitizedProviderFailureDiagnostic {
  return classifyProviderFailure(
    error,
    observations,
    OPENAI_SDK_ERROR_CLASSES,
  );
}

function exactOptions(): ContractLlmCallOptions {
  return {
    maxOutputTokens: 32_000,
    model: VISUAL_CONTRACT_AUTHORING_MODEL,
    reasoningEffort:
      VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT,
    jsonSchema: {
      name: TEMPLATE_DRAFT_SCHEMA_NAME,
      schema: TEMPLATE_DRAFT_JSON_SCHEMA,
    },
    noFallback: true,
    provider: 'openai',
    endpoint: VISUAL_CONTRACT_AUTHORING_ENDPOINT,
    serviceTier:
      VISUAL_CONTRACT_AUTHORING_SERVICE_TIER,
    toolsDisabled: true,
    transportRetries: 0,
    timeoutMs: VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS,
    maxInputTokens:
      VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
  };
}

async function diagnosticFromRealSdkFetch(
  fetchImpl: typeof globalThis.fetch,
): Promise<{
  diagnostic: SanitizedProviderFailureDiagnostic;
  fetchSpy: ReturnType<typeof vi.fn>;
}> {
  const fetchSpy = vi.fn(fetchImpl);
  const before = globalThis.fetch;
  globalThis.fetch =
    fetchSpy as unknown as typeof globalThis.fetch;
  const provider =
    createOpenAIResponsesVisualContractAuthoringAdapter({
      readCredential: () => FAKE_CREDENTIAL,
    });
  let thrown: unknown;
  try {
    await provider.call({
      attempt: 1,
      kind: 'initial',
      systemPrompt: RAW_PROMPT,
      userPrompt: RAW_PROMPT,
      options: exactOptions(),
    });
  } catch (error) {
    thrown = error;
  } finally {
    globalThis.fetch = before;
  }
  expect(thrown).toBeInstanceOf(
    ProviderCallFailureDiagnosticError,
  );
  return {
    diagnostic: (
      thrown as ProviderCallFailureDiagnosticError
    ).diagnostic,
    fetchSpy,
  };
}

function sdkErrorHeaders(): Headers {
  return new Headers({
    'x-request-id': RAW_REQUEST_ID,
    'x-raw-secret': RAW_HEADER,
  });
}

describe('provider failure pure classifier', () => {
  it('classifies direct local boundaries without inspecting raw error text', () => {
    const base = createProviderFailureBoundaryObservations({
      requestOptionsDigest:
        canonicalJsonDigest({ maxRetries: 0 }),
    });
    expect(
      localProviderFailureDiagnostic({
        phase: 'request_body_validation',
        failureClass: 'local_request_validation',
        observations: base,
      }),
    ).toMatchObject({
      phase: 'request_body_validation',
      failureClass: 'local_request_validation',
      adapterInvoked: true,
      credentialReadSucceeded: false,
      transportDispatchStarted: false,
      httpResponseReceived: false,
    });
    expect(
      localProviderFailureDiagnostic({
        phase: 'credential_read',
        failureClass: 'credential_unavailable',
        observations: base,
      }),
    ).toMatchObject({
      phase: 'credential_read',
      failureClass: 'credential_unavailable',
    });
    expect(
      localProviderFailureDiagnostic({
        phase: 'sdk_client_construction',
        failureClass: 'sdk_client_construction_failure',
        observations: base,
      }),
    ).toMatchObject({
      phase: 'sdk_client_construction',
      failureClass: 'sdk_client_construction_failure',
    });
    expect(
      classifyOpenAIProviderFailure(
        new Error(RAW_MESSAGE),
        createProviderFailureBoundaryObservations({
          credentialReadSucceeded: true,
          sdkClientConstructionStarted: true,
          sdkClientConstructionSucceeded: true,
          sdkRequestBuildStarted: true,
        }),
      ),
    ).toMatchObject({
      phase: 'sdk_request_build',
      failureClass: 'sdk_request_build_failure',
    });
  });

  it.each([
    [
      'abort',
      new APIUserAbortError({ message: RAW_MESSAGE }),
      'request_aborted',
      'api_user_abort_error',
    ],
    [
      'connection timeout',
      new APIConnectionTimeoutError({
        message: RAW_MESSAGE,
      }),
      'connection_timeout',
      'api_connection_timeout_error',
    ],
    [
      'connection failure',
      new APIConnectionError({
        message: RAW_MESSAGE,
        cause: new Error(RAW_CAUSE),
      }),
      'connection_failure',
      'api_connection_error',
    ],
  ] as const)(
    'classifies the real SDK %s class',
    (_label, error, failureClass, sdkErrorKind) => {
      expect(
        classifyOpenAIProviderFailure(
          error,
          createProviderFailureBoundaryObservations({
            credentialReadSucceeded: true,
            sdkClientConstructionStarted: true,
            sdkClientConstructionSucceeded: true,
            sdkRequestBuildStarted: true,
            transportDispatchStarted: true,
          }),
        ),
      ).toMatchObject({
        phase: 'transport_dispatch',
        failureClass,
        sdkErrorKind,
        httpResponseReceived: false,
      });
    },
  );

  it.each([
    [
      '400',
      new BadRequestError(
        400,
        {
          code: 'invalid_request_error',
          param: 'text.format.schema',
          message: RAW_MESSAGE,
        },
        RAW_MESSAGE,
        sdkErrorHeaders(),
      ),
      'provider_bad_request',
    ],
    [
      '401',
      new AuthenticationError(
        401,
        { code: 'invalid_api_key', message: RAW_MESSAGE },
        RAW_MESSAGE,
        sdkErrorHeaders(),
      ),
      'provider_authentication',
    ],
    [
      '403',
      new PermissionDeniedError(
        403,
        { code: 'permission_denied', message: RAW_MESSAGE },
        RAW_MESSAGE,
        sdkErrorHeaders(),
      ),
      'provider_permission_denied',
    ],
    [
      '404',
      new NotFoundError(
        404,
        { code: 'model_not_found', message: RAW_MESSAGE },
        RAW_MESSAGE,
        sdkErrorHeaders(),
      ),
      'provider_resource_not_found',
    ],
    [
      '409',
      new ConflictError(
        409,
        { code: null, message: RAW_MESSAGE },
        RAW_MESSAGE,
        sdkErrorHeaders(),
      ),
      'provider_conflict',
    ],
    [
      '422',
      new UnprocessableEntityError(
        422,
        { code: null, message: RAW_MESSAGE },
        RAW_MESSAGE,
        sdkErrorHeaders(),
      ),
      'provider_unprocessable',
    ],
    [
      '429 quota',
      new RateLimitError(
        429,
        { code: 'insufficient_quota', message: RAW_MESSAGE },
        RAW_MESSAGE,
        sdkErrorHeaders(),
      ),
      'provider_quota_exhausted',
    ],
    [
      '429 rate',
      new RateLimitError(
        429,
        {
          code: 'rate_limit_exceeded',
          message: RAW_MESSAGE,
        },
        RAW_MESSAGE,
        sdkErrorHeaders(),
      ),
      'provider_rate_limited',
    ],
    [
      '500',
      new InternalServerError(
        500,
        { code: 'server_error', message: RAW_MESSAGE },
        RAW_MESSAGE,
        sdkErrorHeaders(),
      ),
      'provider_server_error',
    ],
  ] as const)(
    'classifies the real SDK HTTP %s rejection',
    (_label, error, failureClass) => {
      const diagnostic = classifyOpenAIProviderFailure(
        error,
        createProviderFailureBoundaryObservations({
          credentialReadSucceeded: true,
          sdkClientConstructionStarted: true,
          sdkClientConstructionSucceeded: true,
          sdkRequestBuildStarted: true,
          transportDispatchStarted: true,
          httpResponseReceived: true,
        }),
      );
      expect(diagnostic).toMatchObject({
        phase: 'http_response',
        failureClass,
        transportDispatchStarted: true,
        httpResponseReceived: true,
      });
      expect(diagnostic.providerRequestIdDigest).toBe(
        canonicalJsonDigest(RAW_REQUEST_ID),
      );
    },
  );

  it('distinguishes guard rejection, response parsing, and unknown adapters', () => {
    expect(
      classifyOpenAIProviderFailure(
        new ProviderTransportGuardRejectionError(
          'unauthorized_destination',
        ),
        createProviderFailureBoundaryObservations({
          credentialReadSucceeded: true,
          sdkClientConstructionStarted: true,
          sdkClientConstructionSucceeded: true,
          sdkRequestBuildStarted: true,
        }),
      ),
    ).toMatchObject({
      phase: 'transport_guard_rejection',
      failureClass: 'transport_guard_rejection',
      transportDispatchStarted: false,
      httpResponseReceived: false,
    });
    expect(
      classifyOpenAIProviderFailure(
        new SyntaxError(RAW_MESSAGE),
        createProviderFailureBoundaryObservations({
          credentialReadSucceeded: true,
          transportDispatchStarted: true,
          httpResponseReceived: true,
          httpStatus: 200,
        }),
      ),
    ).toMatchObject({
      phase: 'response_parse',
      failureClass: 'provider_response_parse_failure',
      httpStatus: 200,
    });
    expect(
      unclassifiedAdapterFailureDiagnostic(),
    ).toMatchObject({
      phase: 'unknown_adapter',
      failureClass: 'unclassified_adapter_failure',
      credentialReadSucceeded: false,
      transportDispatchStarted: false,
      httpResponseReceived: false,
    });
  });

  it.each([
    ['text.format.schema.properties.x', 'structured_output_schema'],
    ['response_format.json_schema.schema', 'structured_output_schema'],
    ['model', 'model'],
    ['service_tier', 'service_tier'],
    ['max_output_tokens', 'max_tokens'],
    ['tools.0', 'tools'],
    ['input.0.content', 'input'],
    [RAW_PARAM, 'unknown'],
  ] as const)(
    'maps only allowlisted structured param %s',
    (param, expected) => {
      expect(classifyProviderParameter(param)).toBe(expected);
    },
  );
});

describe('installed OpenAI SDK 6.35.0 behind fake fetch', () => {
  it('pins the installed SDK version used by this diagnostic proof', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          'node_modules',
          'openai',
          'package.json',
        ),
        'utf8',
      ),
    ) as { version: string };
    expect(packageJson.version).toBe('6.35.0');
  });

  it.each([
    [400, 'invalid_request_error', 'provider_bad_request'],
    [401, 'invalid_api_key', 'provider_authentication'],
    [403, 'permission_denied', 'provider_permission_denied'],
    [404, 'model_not_found', 'provider_resource_not_found'],
    [409, null, 'provider_conflict'],
    [422, null, 'provider_unprocessable'],
    [429, 'insufficient_quota', 'provider_quota_exhausted'],
    [429, 'rate_limit_exceeded', 'provider_rate_limited'],
    [429, RAW_CODE, 'provider_rejection_unknown'],
    [500, 'server_error', 'provider_server_error'],
  ] as const)(
    'observes exact POST/endpoint, one dispatch, and structured HTTP %s classification',
    async (status, code, failureClass) => {
      const { diagnostic, fetchSpy } =
        await diagnosticFromRealSdkFetch(
          async (input, init) => {
            expect(String(input)).toBe(
              'https://api.openai.com/v1/responses',
            );
            expect(init?.method).toBe('POST');
            expect(init?.redirect).toBe('error');
            return new Response(
              JSON.stringify({
                error: {
                  message: RAW_MESSAGE,
                  code,
                  param: 'text.format.schema',
                },
              }),
              {
                status,
                headers: {
                  'content-type': 'application/json',
                  'x-request-id': RAW_REQUEST_ID,
                  'x-raw-secret': RAW_HEADER,
                },
              },
            );
          },
        );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(diagnostic).toMatchObject({
        phase: 'http_response',
        failureClass,
        adapterInvoked: true,
        credentialReadSucceeded: true,
        transportDispatchStarted: true,
        httpResponseReceived: true,
        httpStatus: status,
        parameterClass: 'structured_output_schema',
      });
    },
  );

  it('distinguishes connection, timeout, and response parse failures through real SDK behavior', async () => {
    const connection = await diagnosticFromRealSdkFetch(
      async () => {
        throw new TypeError(RAW_MESSAGE);
      },
    );
    expect(connection.fetchSpy).toHaveBeenCalledTimes(1);
    expect(connection.diagnostic).toMatchObject({
      failureClass: 'connection_failure',
      sdkErrorKind: 'api_connection_error',
      transportDispatchStarted: true,
      httpResponseReceived: false,
    });

    const timeout = await diagnosticFromRealSdkFetch(
      async () => {
        throw new DOMException(RAW_MESSAGE, 'AbortError');
      },
    );
    expect(timeout.fetchSpy).toHaveBeenCalledTimes(1);
    expect(timeout.diagnostic).toMatchObject({
      failureClass: 'connection_timeout',
      sdkErrorKind: 'api_connection_timeout_error',
      transportDispatchStarted: true,
      httpResponseReceived: false,
    });

    const parse = await diagnosticFromRealSdkFetch(
      async () =>
        new Response('not-json', {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-request-id': RAW_REQUEST_ID,
          },
        }),
    );
    expect(parse.fetchSpy).toHaveBeenCalledTimes(1);
    expect(parse.diagnostic).toMatchObject({
      phase: 'response_parse',
      failureClass: 'provider_response_parse_failure',
      transportDispatchStarted: true,
      httpResponseReceived: true,
      httpStatus: 200,
    });
  });

  it('cannot bypass the installed global fetch sentinel and restores it after the call', async () => {
    const before = globalThis.fetch;
    const sentinel = vi.fn(async () => {
      throw new TypeError(RAW_MESSAGE);
    });
    const result = await diagnosticFromRealSdkFetch(
      sentinel as unknown as typeof globalThis.fetch,
    );
    expect(sentinel).toHaveBeenCalledTimes(1);
    expect(result.fetchSpy).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toBe(before);
  });

  it('classifies body validation, credential failure, and missing-fetch client construction without leaking values', async () => {
    const invalidProvider =
      createOpenAIResponsesVisualContractAuthoringAdapter({
        readCredential: () => FAKE_CREDENTIAL,
        transport: {
          create: vi.fn(),
        },
      });
    let bodyFailure: unknown;
    try {
      await invalidProvider.call({
        attempt: 1,
        kind: 'initial',
        systemPrompt: RAW_PROMPT,
        userPrompt: RAW_PROMPT,
        options: {
          ...exactOptions(),
          model: 'not-approved',
        },
      });
    } catch (error) {
      bodyFailure = error;
    }
    expect(
      (
        bodyFailure as ProviderCallFailureDiagnosticError
      ).diagnostic,
    ).toMatchObject({
      phase: 'request_body_validation',
      failureClass: 'local_request_validation',
      credentialReadSucceeded: false,
    });

    const credentialProvider =
      createOpenAIResponsesVisualContractAuthoringAdapter({
        readCredential: () => {
          throw new Error(`${RAW_MESSAGE} ${FAKE_CREDENTIAL}`);
        },
        transport: {
          create: vi.fn(),
        },
      });
    let credentialFailure: unknown;
    try {
      await credentialProvider.call({
        attempt: 1,
        kind: 'initial',
        systemPrompt: RAW_PROMPT,
        userPrompt: RAW_PROMPT,
        options: exactOptions(),
      });
    } catch (error) {
      credentialFailure = error;
    }
    expect(
      (
        credentialFailure as ProviderCallFailureDiagnosticError
      ).diagnostic,
    ).toMatchObject({
      phase: 'credential_read',
      failureClass: 'credential_unavailable',
      credentialReadSucceeded: false,
    });

    const fetchBefore = globalThis.fetch;
    globalThis.fetch =
      undefined as unknown as typeof globalThis.fetch;
    const clientProvider =
      createOpenAIResponsesVisualContractAuthoringAdapter({
        readCredential: () => FAKE_CREDENTIAL,
      });
    let clientFailure: unknown;
    try {
      await clientProvider.call({
        attempt: 1,
        kind: 'initial',
        systemPrompt: RAW_PROMPT,
        userPrompt: RAW_PROMPT,
        options: exactOptions(),
      });
    } catch (error) {
      clientFailure = error;
    } finally {
      globalThis.fetch = fetchBefore;
    }
    expect(
      (
        clientFailure as ProviderCallFailureDiagnosticError
      ).diagnostic,
    ).toMatchObject({
      phase: 'sdk_client_construction',
      failureClass: 'sdk_client_construction_failure',
      credentialReadSucceeded: true,
      transportDispatchStarted: false,
    });
  });
});

describe('provider call failure evidence sanitization', () => {
  it('is deterministic, content-addressed, linked, and serializes only allowlisted values and digests', () => {
    const error = new BadRequestError(
      400,
      {
        message: `${RAW_MESSAGE} ${RAW_PROMPT}`,
        code: RAW_CODE,
        param: RAW_PARAM,
      },
      `${RAW_MESSAGE} ${FAKE_CREDENTIAL}`,
      sdkErrorHeaders(),
    );
    const diagnostic = classifyOpenAIProviderFailure(
      error,
      createProviderFailureBoundaryObservations({
        credentialReadSucceeded: true,
        transportDispatchStarted: true,
        httpResponseReceived: true,
        httpStatus: 400,
        requestBodyDigest:
          canonicalJsonDigest(RAW_PROMPT),
        requestOptionsDigest:
          canonicalJsonDigest({ maxRetries: 0 }),
      }),
    );
    const args = {
      authoringRequestDigest: '1'.repeat(64),
      sourceSnapshotDigest: '2'.repeat(64),
      authoringReceiptDigest: '3'.repeat(64),
      attemptIndex: 1,
      attemptKind: 'initial' as const,
      provider: 'openai',
      endpoint: 'responses',
      model: VISUAL_CONTRACT_AUTHORING_MODEL,
      diagnostic,
    };
    const first = buildProviderCallFailureEvidence(args);
    const second = buildProviderCallFailureEvidence(args);
    expect(first).toEqual(second);
    const {
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...payload
    } = first;
    expect(first.digest).toBe(
      canonicalJsonDigest(payload),
    );
    expect(first).toMatchObject({
      version: 'provider-call-failure-evidence/v1',
      authoringRequestDigest: '1'.repeat(64),
      sourceSnapshotDigest: '2'.repeat(64),
      authoringReceiptDigest: '3'.repeat(64),
      attempt: { index: 1, kind: 'initial' },
      billingState: 'unknown_no_usage',
      providerCodeClass: 'unknown',
      parameterClass: 'unknown',
      providerRequestIdDigest:
        canonicalJsonDigest(RAW_REQUEST_ID),
    });
    const serialized = JSON.stringify(first);
    for (const forbidden of [
      FAKE_CREDENTIAL,
      RAW_MESSAGE,
      RAW_CAUSE,
      RAW_HEADER,
      RAW_PARAM,
      RAW_CODE,
      RAW_REQUEST_ID,
      RAW_PROMPT,
      'stack',
      'cause',
      'headers',
      'message',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
