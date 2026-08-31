import { canonicalHash } from '@/lib/canonical-json';

export const OPENAI_RESPONSES_TRANSPORT_AUTHORITY_VERSION =
  'openai-responses-transport-authority/v1' as const;

/**
 * Pure, credential-free transport authority consumed by both guarded SDK
 * boundaries. Keeping the two header lists and dispatch policies separate means
 * one route cannot silently widen the other while the complete projection still
 * receives one canonical program digest.
 */
const GENERATION_FORBIDDEN_IDENTITY_HEADERS = Object.freeze([
  'openai-organization',
  'openai-project',
  'openai-webhook-secret',
] as const);

const INPUT_TOKEN_COUNT_FORBIDDEN_IDENTITY_HEADERS = Object.freeze([
  'openai-organization',
  'openai-project',
  'openai-webhook-secret',
] as const);

export const OPENAI_RESPONSES_TRANSPORT_AUTHORITY = Object.freeze({
  version: OPENAI_RESPONSES_TRANSPORT_AUTHORITY_VERSION,
  generation: Object.freeze({
    baseUrl: 'https://api.openai.com/v1',
    endpointUrl: 'https://api.openai.com/v1/responses',
    method: 'POST',
    redirect: 'error',
    maxDispatches: 1,
    sdkIdentity: Object.freeze({
      organization: null,
      project: null,
    }),
    forbiddenIdentityHeaders: GENERATION_FORBIDDEN_IDENTITY_HEADERS,
  }),
  inputTokenCount: Object.freeze({
    baseUrl: 'https://api.openai.com/v1',
    endpointUrl: 'https://api.openai.com/v1/responses/input_tokens',
    method: 'POST',
    redirect: 'error',
    maxDispatches: 1,
    sdkIdentity: Object.freeze({
      organization: null,
      project: null,
    }),
    forbiddenIdentityHeaders: INPUT_TOKEN_COUNT_FORBIDDEN_IDENTITY_HEADERS,
  }),
} as const);

function canonicalHeaderSet(headers: readonly string[]): string[] {
  return [...new Set(headers.map((value) => value.toLowerCase()))].sort();
}

/**
 * Exact transport semantics used for the paid-program digest. The descriptive schema version
 * and order/case of a header set do not change fetch behaviour, so they are intentionally absent
 * or normalized; destination, method, redirect, and dispatch limits remain byte-significant.
 */
export function openAIResponsesTransportSemanticsProjection() {
  return {
    generation: {
      ...OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation,
      forbiddenIdentityHeaders: canonicalHeaderSet(
        OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation
          .forbiddenIdentityHeaders,
      ),
    },
    inputTokenCount: {
      ...OPENAI_RESPONSES_TRANSPORT_AUTHORITY.inputTokenCount,
      forbiddenIdentityHeaders: canonicalHeaderSet(
        OPENAI_RESPONSES_TRANSPORT_AUTHORITY.inputTokenCount
          .forbiddenIdentityHeaders,
      ),
    },
  } as const;
}

export const OPENAI_RESPONSES_TRANSPORT_AUTHORITY_DIGEST = canonicalHash(
  openAIResponsesTransportSemanticsProjection(),
);

// Compatibility exports retain the established adapter/test API while making
// their values aliases of the one runtime-consumed authority above.
export const OPENAI_RESPONSES_AUTHORING_BASE_URL =
  OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation.baseUrl;
export const OPENAI_RESPONSES_AUTHORING_ENDPOINT_URL =
  OPENAI_RESPONSES_TRANSPORT_AUTHORITY.generation.endpointUrl;
export const OPENAI_RESPONSES_INPUT_TOKENS_BASE_URL =
  OPENAI_RESPONSES_TRANSPORT_AUTHORITY.inputTokenCount.baseUrl;
export const OPENAI_RESPONSES_INPUT_TOKENS_ENDPOINT_URL =
  OPENAI_RESPONSES_TRANSPORT_AUTHORITY.inputTokenCount.endpointUrl;
