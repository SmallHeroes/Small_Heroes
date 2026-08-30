import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
} from '@/lib/visual-package';
import {
  BLUEPRINT_AUTHORING_ENDPOINT,
  BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
  BLUEPRINT_AUTHORING_MAX_CALLS,
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_REPAIRS,
  BLUEPRINT_AUTHORING_MODEL,
  BLUEPRINT_AUTHORING_NO_FALLBACK,
  BLUEPRINT_AUTHORING_POLICY_VERSION,
  BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS,
  BLUEPRINT_AUTHORING_PROVIDER,
  BLUEPRINT_AUTHORING_REASONING_EFFORT,
  BLUEPRINT_AUTHORING_SERVICE_TIER,
  BLUEPRINT_AUTHORING_STORE,
  BLUEPRINT_AUTHORING_STREAM,
  BLUEPRINT_AUTHORING_TIMEOUT_MS,
  BLUEPRINT_AUTHORING_TOOLS_DISABLED,
  BLUEPRINT_AUTHORING_TRANSPORT_RETRIES,
  blueprintAuthoringInputAccounting,
  blueprintAuthoringInputAccountingIsValid,
  blueprintAuthoringSpendIsWithinCeiling,
  projectedMaximumBlueprintAuthoringCostUsd,
} from '@/lib/visual-package/blueprintAuthoringPolicy';
import {
  BlueprintAuthoringAdapterBoundaryError,
  buildOpenAIResponsesBlueprintAuthoringBody,
  createOpenAIResponsesBlueprintAuthoringAdapter,
} from '@/lib/visual-package/openaiResponsesBlueprintAuthoringAdapter';
import type {
  PreRenderBlueprintAuthoringCallOptions,
} from '@/lib/visual-package/preRenderBlueprintAuthoring';
import type {
  OpenAIResponsesAuthoringTransport,
} from '@/lib/visual-package/openaiResponsesVisualContractAuthoringAdapter';

function options(): PreRenderBlueprintAuthoringCallOptions {
  return {
    model: BLUEPRINT_AUTHORING_MODEL,
    reasoningEffort: BLUEPRINT_AUTHORING_REASONING_EFFORT,
    maxOutputTokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
    jsonSchema: {
      name: PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
      schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
      strict: true,
    },
    noFallback: true,
  };
}

function rawResponse(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: 'resp-blueprint-1',
    model: BLUEPRINT_AUTHORING_MODEL,
    status: 'completed',
    output_text: '{"worldPlan":{},"frames":[]}',
    usage: {
      input_tokens: 1_000,
      input_tokens_details: {
        cached_tokens: 100,
        cache_write_tokens: 200,
      },
      output_tokens: 2_000,
      output_tokens_details: { reasoning_tokens: 500 },
      total_tokens: 3_000,
    },
    ...overrides,
  };
}

function canonicalTransport(
  responseFactory: (call: number) => unknown = () => rawResponse(),
): OpenAIResponsesAuthoringTransport & { create: ReturnType<typeof vi.fn> } {
  let call = 0;
  return {
    create: vi.fn(async (request) => {
      call += 1;
      request.observations.transportDispatchStarted = true;
      request.observations.transportDispatchCount += 1;
      request.observations.canonicalRouteConfirmed = true;
      request.observations.canonicalModelConfirmed =
        request.body.model === BLUEPRINT_AUTHORING_MODEL;
      request.observations.httpResponseReceived = true;
      request.observations.httpStatus = 200;
      return responseFactory(call);
    }),
  };
}

function callArgs(
  attempt = 1,
  callOptions = options(),
  userPrompt = 'authoritative user prompt',
) {
  return {
    attempt,
    kind: attempt === 1 ? ('initial' as const) : ('repair' as const),
    systemPrompt: 'authoritative system prompt',
    userPrompt,
    options: callOptions,
  };
}

describe('canonical OpenAI Responses Blueprint authoring policy', () => {
  it('locks the exact body and conservative three-call cost below the $5 fence', () => {
    expect({
      policyVersion: BLUEPRINT_AUTHORING_POLICY_VERSION,
      provider: BLUEPRINT_AUTHORING_PROVIDER,
      endpoint: BLUEPRINT_AUTHORING_ENDPOINT,
      model: BLUEPRINT_AUTHORING_MODEL,
      serviceTier: BLUEPRINT_AUTHORING_SERVICE_TIER,
      reasoningEffort: BLUEPRINT_AUTHORING_REASONING_EFFORT,
      toolsDisabled: BLUEPRINT_AUTHORING_TOOLS_DISABLED,
      store: BLUEPRINT_AUTHORING_STORE,
      stream: BLUEPRINT_AUTHORING_STREAM,
      noFallback: BLUEPRINT_AUTHORING_NO_FALLBACK,
      transportRetries: BLUEPRINT_AUTHORING_TRANSPORT_RETRIES,
      timeoutMs: BLUEPRINT_AUTHORING_TIMEOUT_MS,
      maxInputTokens: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
      maxOutputTokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
      maxCalls: BLUEPRINT_AUTHORING_MAX_CALLS,
      maxRepairs: BLUEPRINT_AUTHORING_MAX_REPAIRS,
      hardCostCeilingUsd: BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
    }).toEqual({
      policyVersion: 'pre-render-blueprint-authoring-policy/v1',
      provider: 'openai',
      endpoint: 'responses',
      model: 'gpt-5.6-sol',
      serviceTier: 'default',
      reasoningEffort: 'medium',
      toolsDisabled: true,
      store: false,
      stream: true,
      noFallback: true,
      transportRetries: 0,
      timeoutMs: 1_200_000,
      maxInputTokens: 64_000,
      maxOutputTokens: 48_000,
      maxCalls: 3,
      maxRepairs: 2,
      hardCostCeilingUsd: 5,
    });
    expect(BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS).toEqual({
      version: 'openai-standard-pricing/2026-08-25-v3',
      currency: 'USD',
      unitTokens: 1_000_000,
      uncachedInputUsdPerUnit: 4,
      cacheWriteInputUsdPerUnit: 5,
      cachedInputUsdPerUnit: 0.4,
      outputUsdPerUnit: 20,
      regionalUpliftMultiplier: 1.1,
      source: 'https://developers.openai.com/api/docs/pricing',
    });
    expect(projectedMaximumBlueprintAuthoringCostUsd()).toBe(4.224);
    expect(projectedMaximumBlueprintAuthoringCostUsd()).toBeLessThanOrEqual(
      BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
    );
    expect(blueprintAuthoringSpendIsWithinCeiling(5)).toBe(true);
    expect(blueprintAuthoringSpendIsWithinCeiling(5.000001)).toBe(false);
    expect(blueprintAuthoringSpendIsWithinCeiling(Number.NaN)).toBe(false);
    expect(blueprintAuthoringSpendIsWithinCeiling(Number.POSITIVE_INFINITY)).toBe(false);
    const body = buildOpenAIResponsesBlueprintAuthoringBody({
      systemPrompt: 'system',
      userPrompt: 'user',
      options: options(),
    });
    expect(body).toEqual({
      model: 'gpt-5.6-sol',
      service_tier: 'default',
      max_output_tokens: 48_000,
      input: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'user' },
      ],
      reasoning: { effort: 'medium' },
      text: {
        format: {
          type: 'json_schema',
          name: PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
          schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
          strict: true,
        },
      },
      tools: [],
      tool_choice: 'none',
      truncation: 'disabled',
      store: false,
      stream: true,
    });

    const accounting = blueprintAuthoringInputAccounting({
      systemPrompt: 'system',
      userPrompt: 'user',
      schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    });
    expect(blueprintAuthoringInputAccountingIsValid(accounting)).toBe(true);
    expect(
      blueprintAuthoringInputAccountingIsValid({
        userBytes: accounting.userBytes,
        estimatedBytes: accounting.estimatedBytes,
        protocolAllowance: accounting.protocolAllowance,
        separatorBytes: accounting.separatorBytes,
        schemaBytes: accounting.schemaBytes,
        systemBytes: accounting.systemBytes,
      }),
    ).toBe(true);
    expect(
      blueprintAuthoringInputAccountingIsValid({
        ...accounting,
        hostileExtraKey: true,
      }),
    ).toBe(false);
    expect(
      blueprintAuthoringInputAccountingIsValid({
        ...accounting,
        estimatedBytes: accounting.estimatedBytes + 1,
      }),
    ).toBe(false);
  });

  it.each([
    ['model', (value: PreRenderBlueprintAuthoringCallOptions) => ({ ...value, model: 'other' })],
    ['reasoning', (value: PreRenderBlueprintAuthoringCallOptions) => ({ ...value, reasoningEffort: 'high' })],
    ['output', (value: PreRenderBlueprintAuthoringCallOptions) => ({ ...value, maxOutputTokens: 47_999 })],
    ['fallback', (value: PreRenderBlueprintAuthoringCallOptions) => ({ ...value, noFallback: false as true })],
    ['schema name', (value: PreRenderBlueprintAuthoringCallOptions) => ({
      ...value,
      jsonSchema: { ...value.jsonSchema, name: 'HostileSchema' as typeof PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME },
    })],
    ['schema bytes', (value: PreRenderBlueprintAuthoringCallOptions) => ({
      ...value,
      jsonSchema: {
        ...value.jsonSchema,
        schema: { ...value.jsonSchema.schema, title: 'hostile' } as typeof PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
      },
    })],
    ['extra option', (value: PreRenderBlueprintAuthoringCallOptions) => ({ ...value, temperature: 1 })],
  ])('rejects %s mutation before credential or transport', async (_label, mutate) => {
    const readCredential = vi.fn(() => 'not-a-real-key');
    const transport = canonicalTransport();
    const adapter = createOpenAIResponsesBlueprintAuthoringAdapter({
      readCredential,
      transport,
    });
    await expect(
      adapter.call(callArgs(1, mutate(options()))),
    ).rejects.toMatchObject({
      code: 'policy_mismatch',
    });
    expect(readCredential).not.toHaveBeenCalled();
    expect(transport.create).not.toHaveBeenCalled();
  });

  it('applies the input ceiling to repair calls before credential access', async () => {
    const readCredential = vi.fn(() => 'not-a-real-key');
    const transport = canonicalTransport();
    const adapter = createOpenAIResponsesBlueprintAuthoringAdapter({
      readCredential,
      transport,
    });
    await adapter.call(callArgs());
    const schemaAndSystem = blueprintAuthoringInputAccounting({
      systemPrompt: 'authoritative system prompt',
      userPrompt: '',
      schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    }).estimatedBytes;
    const oversizedRepair = 'x'.repeat(
      BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS - schemaAndSystem + 1,
    );
    await expect(
      adapter.call(callArgs(2, options(), oversizedRepair)),
    ).rejects.toMatchObject({
      code: 'input_ceiling_exceeded',
    });
    expect(readCredential).toHaveBeenCalledTimes(1);
    expect(transport.create).toHaveBeenCalledTimes(1);
  });

  it('accepts exactly 64K initial input and rejects one byte more before credential access', async () => {
    const baseBytes = blueprintAuthoringInputAccounting({
      systemPrompt: 'authoritative system prompt',
      userPrompt: '',
      schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    }).estimatedBytes;
    const exactPrompt = 'x'.repeat(
      BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS - baseBytes,
    );
    expect(
      blueprintAuthoringInputAccounting({
        systemPrompt: 'authoritative system prompt',
        userPrompt: exactPrompt,
        schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
      }).estimatedBytes,
    ).toBe(BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS);

    const acceptedCredential = vi.fn(() => 'not-a-real-key');
    const acceptedTransport = canonicalTransport();
    const accepted = createOpenAIResponsesBlueprintAuthoringAdapter({
      readCredential: acceptedCredential,
      transport: acceptedTransport,
    });
    await expect(
      accepted.call(callArgs(1, options(), exactPrompt)),
    ).resolves.toMatchObject({
      receipt: {
        inputAccounting: {
          estimatedBytes: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
        },
      },
    });
    expect(acceptedCredential).toHaveBeenCalledTimes(1);
    expect(acceptedTransport.create).toHaveBeenCalledTimes(1);

    const rejectedCredential = vi.fn(() => 'not-a-real-key');
    const rejectedTransport = canonicalTransport();
    const rejected = createOpenAIResponsesBlueprintAuthoringAdapter({
      readCredential: rejectedCredential,
      transport: rejectedTransport,
    });
    await expect(
      rejected.call(callArgs(1, options(), `${exactPrompt}x`)),
    ).rejects.toMatchObject({
      code: 'input_ceiling_exceeded',
      evidence: {
        inputAccounting: {
          estimatedBytes: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS + 1,
        },
      },
    });
    expect(rejectedCredential).not.toHaveBeenCalled();
    expect(rejectedTransport.create).not.toHaveBeenCalled();
  });

  it('uses zero retries, reserves all remaining calls, and closes at three calls', async () => {
    const readCredential = vi.fn(() => 'not-a-real-key');
    const transport = canonicalTransport((call) =>
      rawResponse({
        id: `resp-blueprint-${call}`,
        usage: {
          input_tokens: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
          input_tokens_details: {
            cached_tokens: 0,
            cache_write_tokens: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
          },
          output_tokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
          output_tokens_details: {
            reasoning_tokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
          },
          total_tokens:
            BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS +
            BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
        },
      }),
    );
    const adapter = createOpenAIResponsesBlueprintAuthoringAdapter({
      readCredential,
      transport,
    });
    expect(readCredential).not.toHaveBeenCalled();
    const receipts = [];
    for (let attempt = 1; attempt <= BLUEPRINT_AUTHORING_MAX_CALLS; attempt += 1) {
      const response = await adapter.call(callArgs(attempt));
      receipts.push(response.receipt);
    }
    expect(transport.create).toHaveBeenCalledTimes(3);
    for (const [index, invocation] of transport.create.mock.calls.entries()) {
      expect(invocation[0].requestOptions).toEqual({
        maxRetries: BLUEPRINT_AUTHORING_TRANSPORT_RETRIES,
        timeout: BLUEPRINT_AUTHORING_TIMEOUT_MS,
      });
      expect(receipts[index]?.reservedExposureBeforeCallUsd).toBeLessThanOrEqual(
        BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
      );
      expect(receipts[index]?.reservedExposureBeforeCallUsd).toBe(4.224);
    }
    expect(
      receipts.reduce(
        (sum, receipt) =>
          sum + (receipt.conservativeCallCostUsd ?? 0),
        0,
      ),
    ).toBe(4.224);
    await expect(adapter.call(callArgs(4))).rejects.toMatchObject({
      code: 'call_budget_exhausted',
    });
    expect(readCredential).toHaveBeenCalledTimes(3);
    expect(transport.create).toHaveBeenCalledTimes(3);
  });

  it('does not retry a transport failure and terminally closes the adapter', async () => {
    const readCredential = vi.fn(() => 'not-a-real-key');
    const transport: OpenAIResponsesAuthoringTransport & {
      create: ReturnType<typeof vi.fn>;
    } = {
      create: vi.fn(async () => {
        throw new Error('raw transport material');
      }),
    };
    const adapter = createOpenAIResponsesBlueprintAuthoringAdapter({
      readCredential,
      transport,
    });
    await expect(adapter.call(callArgs())).rejects.toMatchObject({
      code: 'provider_call_failed',
    });
    await expect(adapter.call(callArgs(2))).rejects.toMatchObject({
      code: 'adapter_terminal',
    });
    expect(readCredential).toHaveBeenCalledTimes(1);
    expect(transport.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['model', rawResponse({ model: 'other-model' }), 'provider_identity_invalid'],
    ['completion', rawResponse({ status: 'incomplete' }), 'provider_completion_invalid'],
    ['response id', rawResponse({ id: '' }), 'provider_evidence_invalid'],
    ['output', rawResponse({ output_text: '   ' }), 'provider_evidence_invalid'],
    [
      'usage completeness',
      rawResponse({
        usage: {
          input_tokens: 1_000,
          input_tokens_details: { cached_tokens: 100 },
          output_tokens: 2_000,
          output_tokens_details: { reasoning_tokens: 500 },
          total_tokens: 3_000,
        },
      }),
      'usage_invalid',
    ],
    [
      'usage input ceiling',
      rawResponse({
        usage: {
          input_tokens: 64_001,
          input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
          output_tokens: 1,
          output_tokens_details: { reasoning_tokens: 0 },
          total_tokens: 64_002,
        },
      }),
      'usage_invalid',
    ],
  ])('rejects invalid %s evidence and prevents a compiler repair dispatch', async (_label, response, code) => {
    const readCredential = vi.fn(() => 'not-a-real-key');
    const transport = canonicalTransport(() => response);
    const adapter = createOpenAIResponsesBlueprintAuthoringAdapter({
      readCredential,
      transport,
    });
    await expect(adapter.call(callArgs())).rejects.toMatchObject({ code });
    await expect(adapter.call(callArgs(2))).rejects.toBeInstanceOf(
      BlueprintAuthoringAdapterBoundaryError,
    );
    expect(readCredential).toHaveBeenCalledTimes(1);
    expect(transport.create).toHaveBeenCalledTimes(1);
  });

  it('keeps provider modules out of the offline barrel and runner import graph', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'blueprint-import-sentinel-'),
    );
    try {
      const sentinelPath = path.join(root, 'deny-provider-imports.cjs');
      fs.writeFileSync(
        sentinelPath,
        [
          "const Module = require('node:module');",
          'const originalLoad = Module._load;',
          'Module._load = function(request, parent, isMain) {',
          "  const id = String(request).replaceAll('\\\\', '/');",
          "  if (id === 'openai' || id.startsWith('openai/') || id.includes('/openaiResponsesVisualContractAuthoringAdapter') || id.includes('/openaiResponsesBlueprintAuthoringAdapter')) {",
          "    throw new Error('forbidden_blueprint_provider_import:' + id);",
          '  }',
          '  return originalLoad.call(this, request, parent, isMain);',
          '};',
          '',
        ].join('\n'),
        'utf8',
      );
      const runImport = (modulePath: string) =>
        spawnSync(
          process.execPath,
          [
            '--require',
            sentinelPath,
            '--require',
            './node_modules/tsx/dist/cjs/index.cjs',
            '--require',
            './scripts/shims/register-server-only.cjs',
            '-e',
            `require(${JSON.stringify(modulePath)})`,
          ],
          {
            cwd: process.cwd(),
            encoding: 'utf8',
            env: { ...process.env, OPENAI_API_KEY: '' },
          },
        );

      const barrel = runImport('./lib/visual-package/index.ts');
      expect(barrel.status, barrel.stderr).toBe(0);
      const runner = runImport(
        './lib/visual-package/productionAuthoringRunner.ts',
      );
      expect(runner.status, runner.stderr).toBe(0);

      const positiveControl = runImport(
        './lib/visual-package/openaiResponsesBlueprintAuthoringAdapter.ts',
      );
      expect(positiveControl.status).not.toBe(0);
      expect(positiveControl.stderr).toContain(
        'forbidden_blueprint_provider_import:',
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps the canonical adapter behind the claimed operator and the legacy runner callsite preflight-only', () => {
    const excludedDirectories = new Set([
      '.git',
      '.next',
      '__tests__',
      'coverage',
      'node_modules',
      'outputs',
    ]);
    const sourceFiles = (root: string): string[] =>
      fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
        const absolute = path.join(root, entry.name);
        if (entry.isDirectory()) {
          return excludedDirectories.has(entry.name) ? [] : sourceFiles(absolute);
        }
        return entry.isFile() &&
          /\.(?:[cm]?js|tsx?)$/.test(entry.name) &&
          !/\.(?:spec|test)\.(?:[cm]?js|tsx?)$/.test(entry.name)
          ? [absolute]
          : [];
      });
    const roots = [process.cwd()];
    const occurrences = (needle: string) =>
      roots
        .flatMap(sourceFiles)
        .map((absolute) => ({
          path: path.relative(process.cwd(), absolute).replace(/\\/g, '/'),
          count: fs.readFileSync(absolute, 'utf8').split(needle).length - 1,
        }))
        .filter((entry) => entry.count > 0)
        .sort((left, right) => left.path.localeCompare(right.path));

    expect(occurrences('runProductionBlueprintAuthoring(')).toEqual([
      {
        path: 'lib/visual-package/productionAuthoringRunner.ts',
        count: 1,
      },
      {
        path: 'lib/visual-package/qaWizardBlueprintAuthoringLifecycle.ts',
        count: 1,
      },
      { path: 'scripts/production-visual-lifecycle.ts', count: 1 },
    ]);
    expect(
      occurrences('createOpenAIResponsesBlueprintAuthoringAdapter('),
    ).toEqual([
      {
        path:
          'lib/visual-package/openaiResponsesBlueprintAuthoringAdapter.ts',
        count: 1,
      },
      {
        path: 'lib/visual-package/qaWizardBlueprintAuthoringLifecycle.ts',
        count: 1,
      },
      { path: 'scripts/qa-wizard-blueprint-authoring.ts', count: 1 },
    ]);
    const legacyCli = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'production-visual-lifecycle.ts'),
      'utf8',
    );
    expect(legacyCli).toContain("request.authoringRequest.mode !== 'preflight'");
    expect(legacyCli).toContain('provider_unreachable_authoring_preflight');
  });
});
