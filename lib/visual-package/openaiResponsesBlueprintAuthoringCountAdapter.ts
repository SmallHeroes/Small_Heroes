import OpenAI from 'openai';
import type { InputTokenCountParams } from 'openai/resources/responses/input-tokens';

import {
  BLUEPRINT_AUTHORING_MODEL,
  BLUEPRINT_AUTHORING_REASONING_EFFORT,
  BLUEPRINT_AUTHORING_TIMEOUT_MS,
  BLUEPRINT_AUTHORING_TRANSPORT_RETRIES,
} from './blueprintAuthoringPolicy';
import {
  BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
  blueprintAuthoringExactInputTokenCountFromResponse,
  blueprintAuthoringCountRequestProjection,
  blueprintAuthoringRepairOrdinalIsWithinBudget,
  type BlueprintAuthoringCountTransportAttestation,
  type BlueprintAuthoringExactInputTokenCountResult,
  type BlueprintAuthoringInputTokenCountRequest,
  type BlueprintAuthoringInputTokenCounter,
} from './blueprintAuthoringInputTokenAdmission';
import { canonicalJsonDigest } from './integrity';
import {
  OPENAI_RESPONSES_INPUT_TOKENS_BASE_URL,
  OPENAI_RESPONSES_INPUT_TOKENS_ENDPOINT_URL,
  OPENAI_RESPONSES_TRANSPORT_AUTHORITY,
} from './openAIResponsesTransportAuthority';
import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
} from './preRenderBlueprintDraftSchema';
import {
  ProviderTransportGuardRejectionError,
  createProviderFailureBoundaryObservations,
  type ProviderFailureBoundaryObservations,
} from './providerFailureDiagnostics';
import {
  readOpenAIResponsesAuthoringCredential,
  type OpenAIResponsesAuthoringCredentialReader,
  type OpenAIResponsesAuthoringFetch,
} from './openaiResponsesVisualContractAuthoringAdapter';

export {
  OPENAI_RESPONSES_INPUT_TOKENS_BASE_URL,
  OPENAI_RESPONSES_INPUT_TOKENS_ENDPOINT_URL,
};

/**
 * Exact input-token COUNT boundary — a route-specific, guarded, offline-testable transport for
 * `POST /v1/responses/input_tokens` (`client.responses.inputTokens.count`). It is deliberately
 * SEPARATE from the generation adapter:
 *  - a distinct URL guard for the input_tokens route (it does NOT broaden the generation
 *    `/v1/responses` guard);
 *  - the token-relevant request projection ONLY (model/input/reasoning/text.format/tools/
 *    tool_choice/truncation) — the count endpoint does not accept service_tier/max_output_tokens/
 *    store/stream;
 *  - its OWN attestation/observations; a count NEVER increments generation
 *    callCount/repairCount/logicalProviderCalls or generation transport attestation;
 *  - maxRetries:0, no fallback, bounded timeout, exact destination/method/redirect/identity guard;
 *  - a fail-closed response gate; any transport/response failure yields an `unavailable` result
 *    (admission then fails closed above the ceiling) with no count retry.
 */
export interface OpenAIResponsesInputTokensCountTransportRequest {
  apiKey: string;
  body: InputTokenCountParams;
  requestOptions: {
    maxRetries: 0;
    timeout: typeof BLUEPRINT_AUTHORING_TIMEOUT_MS;
  };
  observations: ProviderFailureBoundaryObservations;
}

export interface OpenAIResponsesInputTokensCountTransport {
  count(
    request: OpenAIResponsesInputTokensCountTransportRequest,
  ): Promise<unknown>;
}

export interface OpenAIResponsesBlueprintAuthoringCountAdapterDeps {
  transport?: OpenAIResponsesInputTokensCountTransport;
  readCredential?: OpenAIResponsesAuthoringCredentialReader;
}

function requestUrl(input: string | URL | Request): URL {
  return new URL(input instanceof Request ? input.url : input);
}

function combinedHeaders(
  input: string | URL | Request,
  init: RequestInit | undefined,
): Headers {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => {
    headers.set(key, value);
  });
  return headers;
}

/**
 * The credential-bearing count transport may send only ONE POST to the EXACT
 * `/v1/responses/input_tokens` endpoint. Any other destination, a redirect, a non-POST method,
 * or an SDK-injected organization/project/webhook identity header is rejected before the
 * delegated fetch can observe credentials or the request body.
 */
export function createGuardedOpenAIResponsesInputTokensFetch(
  delegatedFetch: OpenAIResponsesAuthoringFetch,
  observations?: ProviderFailureBoundaryObservations,
): OpenAIResponsesAuthoringFetch {
  let dispatchCount = 0;
  return async (input, init) => {
    const url = requestUrl(input);
    if (
      url.href !== OPENAI_RESPONSES_INPUT_TOKENS_ENDPOINT_URL ||
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new ProviderTransportGuardRejectionError('unauthorized_destination');
    }
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    if (method !== OPENAI_RESPONSES_TRANSPORT_AUTHORITY.inputTokenCount.method) {
      throw new ProviderTransportGuardRejectionError('non_post_request');
    }
    const headers = combinedHeaders(input, init);
    if (
      OPENAI_RESPONSES_TRANSPORT_AUTHORITY.inputTokenCount.forbiddenIdentityHeaders.some(
        (name) => headers.has(name),
      )
    ) {
      throw new ProviderTransportGuardRejectionError('unauthorized_identity_headers');
    }
    if (
      dispatchCount >=
      OPENAI_RESPONSES_TRANSPORT_AUTHORITY.inputTokenCount.maxDispatches
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
      redirect: OPENAI_RESPONSES_TRANSPORT_AUTHORITY.inputTokenCount.redirect,
    });
    if (observations && response instanceof Response) {
      observations.httpResponseReceived = true;
      observations.httpStatus = response.status;
      const requestId = response.headers.get('x-request-id');
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

/** Canonical count transport: builds a guarded SDK client and calls inputTokens.count once. */
export const openAIResponsesInputTokensCountTransport: OpenAIResponsesInputTokensCountTransport =
  {
    count: async ({ apiKey, body, requestOptions, observations }) => {
      observations.sdkClientConstructionStarted = true;
      if (typeof globalThis.fetch !== 'function') {
        throw new Error(
          'canonical OpenAI input-tokens count transport requires global fetch',
        );
      }
      const client = new OpenAI({
        apiKey,
        baseURL: OPENAI_RESPONSES_INPUT_TOKENS_BASE_URL,
        ...OPENAI_RESPONSES_TRANSPORT_AUTHORITY.inputTokenCount.sdkIdentity,
        maxRetries: requestOptions.maxRetries,
        timeout: requestOptions.timeout,
        fetch: createGuardedOpenAIResponsesInputTokensFetch(
          globalThis.fetch,
          observations,
        ),
        fetchOptions: {
          redirect: OPENAI_RESPONSES_TRANSPORT_AUTHORITY.inputTokenCount.redirect,
        },
        logLevel: 'error',
      });
      observations.sdkClientConstructionSucceeded = true;
      observations.sdkRequestBuildStarted = true;
      return client.responses.inputTokens.count(body, requestOptions);
    },
  };

function countAttestation(
  observations: ProviderFailureBoundaryObservations,
): BlueprintAuthoringCountTransportAttestation {
  return {
    provider: 'openai',
    model: BLUEPRINT_AUTHORING_MODEL,
    route: 'responses_input_tokens',
    evidenceVersion: BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
    transportDispatchCount: observations.transportDispatchCount,
    transportRetryCount: Math.max(0, observations.transportDispatchCount - 1),
    canonicalRouteConfirmed: observations.canonicalRouteConfirmed,
    canonicalModelConfirmed: observations.canonicalModelConfirmed,
  };
}

/**
 * The canonical exact input-token counter. It builds the SHARED token-relevant request
 * projection, digests it (binding the count to its exact body/route), dispatches at most one
 * guarded count call, and gates the result to EXACTLY
 * `{ object: 'response.input_tokens', input_tokens: <non-negative safe integer> }`. Every
 * failure surfaces as an `unavailable` result with a bounded reason and (once a dispatch
 * occurred) the separate count attestation — never a throw and never a count retry.
 */
export function createOpenAIResponsesBlueprintAuthoringCountAdapter(
  deps: OpenAIResponsesBlueprintAuthoringCountAdapterDeps = {},
): BlueprintAuthoringInputTokenCounter {
  const transport = deps.transport ?? openAIResponsesInputTokensCountTransport;
  const readCredential =
    deps.readCredential ?? readOpenAIResponsesAuthoringCredential;
  return async (
    request: BlueprintAuthoringInputTokenCountRequest,
  ): Promise<BlueprintAuthoringExactInputTokenCountResult> => {
    const projection = blueprintAuthoringCountRequestProjection(request);
    const countRequestDigest = canonicalJsonDigest(projection);
    const unavailable = (
      unavailableReason: BlueprintAuthoringExactInputTokenCountResult['unavailableReason'],
      attestation: BlueprintAuthoringCountTransportAttestation | null,
    ): BlueprintAuthoringExactInputTokenCountResult => ({
      routeKind: request.routeKind,
      repairOrdinal: request.repairOrdinal,
      countRequestDigest,
      outcome: 'unavailable',
      inputTokens: null,
      unavailableReason,
      attestation,
    });

    // Pre-dispatch policy: only the canonical model is counted; anything else fails closed
    // without a dispatch.
    if (request.model !== BLUEPRINT_AUTHORING_MODEL) {
      return unavailable('count_model_unconfirmed', null);
    }
    if (
      request.routeKind !== 'repair' ||
      !blueprintAuthoringRepairOrdinalIsWithinBudget(request.repairOrdinal) ||
      request.reasoningEffort !== BLUEPRINT_AUTHORING_REASONING_EFFORT ||
      request.schemaName !== PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME ||
      canonicalJsonDigest(request.schema) !==
        canonicalJsonDigest(PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA)
    ) {
      return unavailable('count_evidence_invalid', null);
    }

    const requestOptions = {
      maxRetries: BLUEPRINT_AUTHORING_TRANSPORT_RETRIES,
      timeout: BLUEPRINT_AUTHORING_TIMEOUT_MS,
    } as const;
    const observations = createProviderFailureBoundaryObservations({
      adapterInvoked: true,
      requestOptionsDigest: canonicalJsonDigest(requestOptions),
    });
    observations.requestBodyDigest = countRequestDigest;
    observations.canonicalModelConfirmed = projection.model === BLUEPRINT_AUTHORING_MODEL;

    let apiKey: string;
    try {
      apiKey = readCredential();
      observations.credentialReadSucceeded = true;
    } catch {
      return unavailable('count_transport_failed', null);
    }

    let raw: unknown;
    try {
      raw = await transport.count({
        apiKey,
        body: projection as unknown as InputTokenCountParams,
        requestOptions,
        observations,
      });
    } catch {
      return unavailable('count_transport_failed', countAttestation(observations));
    }

    const attestation = countAttestation(observations);
    if (
      attestation.transportDispatchCount !== 1 ||
      attestation.transportRetryCount !== 0 ||
      !attestation.canonicalRouteConfirmed ||
      !attestation.canonicalModelConfirmed
    ) {
      return unavailable('count_route_unconfirmed', attestation);
    }
    const inputTokens = blueprintAuthoringExactInputTokenCountFromResponse(raw);
    if (inputTokens === null) {
      return unavailable('count_response_invalid', attestation);
    }
    return {
      routeKind: request.routeKind,
      repairOrdinal: request.repairOrdinal,
      countRequestDigest,
      outcome: 'counted',
      inputTokens,
      unavailableReason: null,
      attestation,
    };
  };
}
