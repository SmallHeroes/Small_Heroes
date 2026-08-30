import { describe, expect, it, vi } from 'vitest';

import {
  BLUEPRINT_AUTHORING_MODEL,
  BLUEPRINT_AUTHORING_REASONING_EFFORT,
} from '@/lib/visual-package/blueprintAuthoringPolicy';
import {
  BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
  BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT,
  blueprintAuthoringTokenRelevantRequestProjection,
  type BlueprintAuthoringInputTokenCountRequest,
} from '@/lib/visual-package/blueprintAuthoringInputTokenAdmission';
import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
} from '@/lib/visual-package/preRenderBlueprintDraftSchema';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import { ProviderTransportGuardRejectionError } from '@/lib/visual-package/providerFailureDiagnostics';
import {
  OPENAI_RESPONSES_INPUT_TOKENS_ENDPOINT_URL,
  createGuardedOpenAIResponsesInputTokensFetch,
  createOpenAIResponsesBlueprintAuthoringCountAdapter,
  type OpenAIResponsesInputTokensCountTransport,
} from '@/lib/visual-package/openaiResponsesBlueprintAuthoringCountAdapter';

const GENERATION_ENDPOINT = 'https://api.openai.com/v1/responses';

function repairRequest(
  overrides: Partial<BlueprintAuthoringInputTokenCountRequest> = {},
): BlueprintAuthoringInputTokenCountRequest {
  return {
    routeKind: 'repair',
    systemPrompt: 'SYSTEM',
    userPrompt: 'USER',
    schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    model: BLUEPRINT_AUTHORING_MODEL,
    ...overrides,
  };
}

// A fake transport that stands in for the guarded network path: on a "successful" dispatch it
// records the exact body it received and simulates the guarded fetch's observation updates
// (dispatch count + route confirmation), then returns the given raw result.
function fakeTransport(
  raw: unknown,
  capture?: { body?: unknown },
): OpenAIResponsesInputTokensCountTransport {
  return {
    count: async (req) => {
      if (capture) capture.body = req.body;
      req.observations.transportDispatchStarted = true;
      req.observations.transportDispatchCount += 1;
      req.observations.canonicalRouteConfirmed = true;
      return raw;
    },
  };
}

const readTestKey = () => 'test-key-must-never-persist';

describe('exact input-token count adapter — happy path + evidence separation', () => {
  it('counts an exact value, binds the token-relevant projection digest, and attests separately', async () => {
    const capture: { body?: unknown } = {};
    const counter = createOpenAIResponsesBlueprintAuthoringCountAdapter({
      transport: fakeTransport(
        {
          object: BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT,
          input_tokens: 12_345,
        },
        capture,
      ),
      readCredential: readTestKey,
    });
    const request = repairRequest();
    const result = await counter(request);

    expect(result.outcome).toBe('counted');
    expect(result.inputTokens).toBe(12_345);
    expect(result.routeKind).toBe('repair');

    // The count body is EXACTLY the shared token-relevant projection (no service_tier /
    // max_output_tokens / store / stream), and the digest binds the count to that body.
    const projection = blueprintAuthoringTokenRelevantRequestProjection({
      model: BLUEPRINT_AUTHORING_MODEL,
      systemPrompt: 'SYSTEM',
      userPrompt: 'USER',
      reasoningEffort: BLUEPRINT_AUTHORING_REASONING_EFFORT,
      schemaName: PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
      schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    });
    expect(result.countRequestDigest).toBe(canonicalJsonDigest(projection));
    expect(capture.body).toEqual(projection);
    for (const excluded of ['service_tier', 'max_output_tokens', 'store', 'stream']) {
      expect(excluded in (capture.body as Record<string, unknown>)).toBe(false);
    }

    // Separate count attestation: dedicated route + count evidence version + exactly one
    // dispatch, zero retries. This is NOT a generation attestation.
    expect(result.attestation).toEqual({
      provider: 'openai',
      model: BLUEPRINT_AUTHORING_MODEL,
      route: 'responses_input_tokens',
      evidenceVersion: BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
      transportDispatchCount: 1,
      transportRetryCount: 0,
      canonicalRouteConfirmed: true,
      canonicalModelConfirmed: true,
    });
  });
});

describe('exact input-token count adapter — fail-closed cases', () => {
  const badResponses: Array<[string, unknown]> = [
    ['extra key', { object: BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT, input_tokens: 1, extra: 1 }],
    ['missing input_tokens', { object: BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT }],
    ['wrong object', { object: 'response', input_tokens: 1 }],
    ['float count', { object: BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT, input_tokens: 1.5 }],
    ['negative count', { object: BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT, input_tokens: -1 }],
    ['non-object', 42],
  ];
  for (const [label, raw] of badResponses) {
    it(`returns count_response_invalid on a malformed result: ${label}`, async () => {
      const counter = createOpenAIResponsesBlueprintAuthoringCountAdapter({
        transport: fakeTransport(raw),
        readCredential: readTestKey,
      });
      const result = await counter(repairRequest());
      expect(result.outcome).toBe('unavailable');
      expect(result.unavailableReason).toBe('count_response_invalid');
      expect(result.inputTokens).toBeNull();
      expect(result.attestation?.canonicalRouteConfirmed).toBe(true);
    });
  }

  it('returns count_transport_failed when the transport throws (no retry, attestation preserved)', async () => {
    const transport: OpenAIResponsesInputTokensCountTransport = {
      count: async (req) => {
        req.observations.transportDispatchStarted = true;
        req.observations.transportDispatchCount += 1;
        req.observations.canonicalRouteConfirmed = true;
        throw new Error('boom-secret-must-not-surface');
      },
    };
    const counter = createOpenAIResponsesBlueprintAuthoringCountAdapter({
      transport,
      readCredential: readTestKey,
    });
    const result = await counter(repairRequest());
    expect(result.outcome).toBe('unavailable');
    expect(result.unavailableReason).toBe('count_transport_failed');
    expect(result.attestation?.transportDispatchCount).toBe(1);
    expect(JSON.stringify(result)).not.toMatch(/boom-secret|test-key/i);
  });

  it('returns count_transport_failed when the credential read fails (no dispatch, no attestation)', async () => {
    const transport = fakeTransport({
      object: BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT,
      input_tokens: 1,
    });
    const dispatch = vi.spyOn(transport, 'count');
    const counter = createOpenAIResponsesBlueprintAuthoringCountAdapter({
      transport,
      readCredential: () => {
        throw new Error('no credential');
      },
    });
    const result = await counter(repairRequest());
    expect(result.outcome).toBe('unavailable');
    expect(result.unavailableReason).toBe('count_transport_failed');
    expect(result.attestation).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns count_model_unconfirmed for a non-canonical model BEFORE any dispatch', async () => {
    const transport = fakeTransport({
      object: BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT,
      input_tokens: 1,
    });
    const dispatch = vi.spyOn(transport, 'count');
    const counter = createOpenAIResponsesBlueprintAuthoringCountAdapter({
      transport,
      readCredential: readTestKey,
    });
    const result = await counter(repairRequest({ model: 'gpt-4o' }));
    expect(result.outcome).toBe('unavailable');
    expect(result.unavailableReason).toBe('count_model_unconfirmed');
    expect(result.attestation).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('input-tokens route guard is route-specific (does not broaden the generation guard)', () => {
  async function guard(url: string, init?: RequestInit) {
    const delegated = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            object: BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT,
            input_tokens: 1,
          }),
          { status: 200, headers: { 'x-request-id': 'req_1' } },
        ),
    );
    const guarded = createGuardedOpenAIResponsesInputTokensFetch(delegated);
    const response = await guarded(url, { method: 'POST', ...init });
    return { delegated, response };
  }

  it('accepts exactly the input_tokens endpoint POST and forwards with redirect:error', async () => {
    const { delegated, response } = await guard(OPENAI_RESPONSES_INPUT_TOKENS_ENDPOINT_URL);
    expect(delegated).toHaveBeenCalledTimes(1);
    expect(delegated.mock.calls[0]![1]).toMatchObject({ redirect: 'error' });
    expect(response.status).toBe(200);
  });

  it('rejects the GENERATION /v1/responses endpoint (route-specific, not broadened)', async () => {
    await expect(guard(GENERATION_ENDPOINT)).rejects.toBeInstanceOf(
      ProviderTransportGuardRejectionError,
    );
  });

  it('rejects a wrong host, a query/hash, and http', async () => {
    for (const url of [
      'https://evil.example.com/v1/responses/input_tokens',
      `${OPENAI_RESPONSES_INPUT_TOKENS_ENDPOINT_URL}?x=1`,
      `${OPENAI_RESPONSES_INPUT_TOKENS_ENDPOINT_URL}#frag`,
      'http://api.openai.com/v1/responses/input_tokens',
    ]) {
      await expect(guard(url)).rejects.toBeInstanceOf(
        ProviderTransportGuardRejectionError,
      );
    }
  });

  it('rejects a non-POST method', async () => {
    await expect(
      guard(OPENAI_RESPONSES_INPUT_TOKENS_ENDPOINT_URL, { method: 'GET' }),
    ).rejects.toBeInstanceOf(ProviderTransportGuardRejectionError);
  });

  it('rejects SDK-injected organization/project/webhook identity headers', async () => {
    for (const header of ['openai-organization', 'openai-project', 'openai-webhook-secret']) {
      await expect(
        guard(OPENAI_RESPONSES_INPUT_TOKENS_ENDPOINT_URL, {
          headers: { [header]: 'x' },
        }),
      ).rejects.toBeInstanceOf(ProviderTransportGuardRejectionError);
    }
  });
});
