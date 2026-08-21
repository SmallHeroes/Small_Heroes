/**
 * Stage 1 (live-authoring fix) — the dedicated authoring call: json_schema plumbing, the strict draft schema,
 * the token budget, the compiler's request + provenance, and no-silent-fallback.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

import { extractSourceFromMarkdown } from '../../scripts/extract-visual-contract-sources';
import {
  compileBookVisualContractTemplate,
  authoringMaxOutputTokens,
  authoringStandardAttemptOutputLimits,
  COMPLETE_STORY_SOURCE_PROMPT_COLUMNS,
  resolveAuthoringModel,
  type TemplateCompileInput,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  TEMPLATE_DRAFT_SCHEMA_NAME,
} from '../visual-contract-compiler/templateDraftSchema';
import type {
  ContractLlmCaller,
  ContractLlmCallOptions,
} from '../visual-contract-compiler/compileBookVisualContract';
import { withCurrentActionSemanticCoverage } from './visual-contract-authoring-draft-fixtures';
import { OpenAIResponsesStructuredOutputSchemaCompatibilityError } from '../visual-package/openaiResponsesStructuredOutputSchemaCompatibility';

const BUNNY_KEY = 'bunny_ometz_adventure';
const BANK = path.join(process.cwd(), 'story-bank/v3-approved');
function bunnySource(): TemplateCompileInput {
  return extractSourceFromMarkdown(BUNNY_KEY, fs.readFileSync(path.join(BANK, `${BUNNY_KEY}.md`), 'utf8')) as TemplateCompileInput;
}
function bunnyTemplate(): unknown {
  return withCurrentActionSemanticCoverage({
    draft: JSON.parse(fs.readFileSync(path.join(BANK, `${BUNNY_KEY}.visual-contract-template.json`), 'utf8')),
    pages: bunnySource().pages,
    sourceEvidenceCatalog: bunnySource().sourceEvidenceCatalog,
  });
}

function findConstNode(
  value: unknown,
  literal: unknown,
): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findConstNode(child, literal);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const node = value as Record<string, unknown>;
  if (node.const === literal) return node;
  for (const child of Object.values(node)) {
    const found = findConstNode(child, literal);
    if (found) return found;
  }
  return null;
}

/** Recursively assert OpenAI strict-mode compliance: every object sets additionalProperties:false + required=all keys. */
function collectStrictProblems(node: unknown, at: string, problems: string[]): void {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  const o = node as Record<string, unknown>;
  if (o.type === 'object') {
    if (o.additionalProperties !== false) problems.push(`${at}: additionalProperties must be false`);
    const props = (o.properties ?? {}) as Record<string, unknown>;
    const required = ((o.required ?? []) as string[]).slice().sort();
    const keys = Object.keys(props).sort();
    if (JSON.stringify(required) !== JSON.stringify(keys)) {
      problems.push(`${at}: required [${required}] must equal all properties [${keys}]`);
    }
    for (const k of Object.keys(props)) collectStrictProblems(props[k], `${at}.${k}`, problems);
  }
  if (o.items) collectStrictProblems(o.items, `${at}[]`, problems);
  if (Array.isArray(o.anyOf)) o.anyOf.forEach((s, i) => collectStrictProblems(s, `${at}|${i}`, problems));
}

describe('Stage 1 — draft json_schema is strict-mode compliant', () => {
  it('every object node: additionalProperties:false + required == all properties', () => {
    const problems: string[] = [];
    collectStrictProblems(TEMPLATE_DRAFT_JSON_SCHEMA, 'root', problems);
    expect(problems).toEqual([]);
  });
  it('has the top-level descriptive keys the compiler consumes', () => {
    const props = (TEMPLATE_DRAFT_JSON_SCHEMA as { properties: Record<string, unknown> }).properties;
    for (const k of ['worldType', 'locations', 'zones', 'setBoardAuthorities', 'cast', 'humanCast', 'recurringProps', 'forbiddenGlobalElements', 'coverContract', 'pageContracts']) {
      expect(Object.keys(props)).toContain(k);
    }
  });

  it('carries structured prop lifecycle and per-page visibility through strict authoring', () => {
    const root = TEMPLATE_DRAFT_JSON_SCHEMA as {
      properties: Record<string, { items?: { properties?: Record<string, unknown> } }>;
    };
    expect(root.properties.recurringProps.items?.properties).toHaveProperty('firstRevealPage');
    expect(root.properties.pageContracts.items?.properties).toHaveProperty('propConstraints');
    expect(root.properties.pageContracts.items?.properties).toHaveProperty('actionRequirements');
    expect(root.properties.pageContracts.items?.properties).toHaveProperty('actionSemanticCoverage');
    expect(
      root.properties.pageContracts.items?.properties
        ?.actionRequirements,
    ).toMatchObject({
      type: 'array',
    });
    const pageProperties = root.properties.pageContracts.items
      ?.properties as Record<
      string,
      { items?: { properties?: Record<string, unknown> } }
    >;
    expect(
      pageProperties.actionRequirements.items?.properties,
    ).not.toHaveProperty('sourcePhrase');
    expect(
      pageProperties.actionRequirements.items?.properties,
    ).not.toHaveProperty('sourceEvidenceId');
    expect(
      pageProperties.actionSemanticCoverage.items?.properties,
    ).toHaveProperty('sourceEvidenceId');
    expect(
      pageProperties.actionSemanticCoverage.items?.properties,
    ).not.toHaveProperty('sourcePhrase');
  });

  it('exposes only nullable spatialNodes.stablePropId in the provider-facing Set Board node schema', () => {
    const root = TEMPLATE_DRAFT_JSON_SCHEMA as unknown as {
      properties: {
        setBoardAuthorities: {
          items: {
            properties: {
              areas: {
                items: {
                  properties: {
                    spatialNodes: {
                      items: {
                        properties: Record<string, unknown>;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    const properties = root.properties.setBoardAuthorities.items.properties
      .areas.items.properties.spatialNodes.items.properties;

    expect(properties).toHaveProperty('stablePropId');
    expect(properties).not.toHaveProperty('propId');
    expect(properties.stablePropId).toEqual({
      type: ['string', 'null'],
    });
  });

  it('authors exact zone projection and stable architecture separately from compiler-owned fixed objects', () => {
    const root = TEMPLATE_DRAFT_JSON_SCHEMA as {
      properties: Record<string, {
        items?: { properties?: Record<string, { items?: { properties?: Record<string, unknown> } }> };
      }>;
    };
    const authority = root.properties.setBoardAuthorities.items?.properties;
    expect(authority).toHaveProperty('setIdentityId');
    expect(authority).toHaveProperty('locations');
    expect(authority).toHaveProperty('areas');
    expect(authority).not.toHaveProperty('fixedObjects');
    expect(authority?.areas.items?.properties).toHaveProperty('zoneProjection');
    expect(authority?.areas.items?.properties).toHaveProperty('spatialNodes');
    expect(authority?.areas.items?.properties).toHaveProperty('spatialRelations');
    expect(root.properties.zones.items?.properties).toHaveProperty('spatialNodes');
    expect(root.properties.zones.items?.properties).toHaveProperty('spatialRelations');
  });
});

describe('Stage 1 — authoring token budget scales by page count (Responses budget INCLUDES reasoning)', () => {
  it('~3000/page, floor 32000, cap 64000', () => {
    expect(authoringMaxOutputTokens(12)).toBe(36000);
    expect(authoringMaxOutputTokens(16)).toBe(48000);
    expect(authoringMaxOutputTokens(25)).toBe(64000); // cap (75000)
    expect(authoringMaxOutputTokens(8)).toBe(32000); // floor (24000)
    expect(authoringMaxOutputTokens(0)).toBe(36000); // invalid → default 12 pages
  });

  it('derives the canonical seven-attempt allocation under the USD 10 fence', () => {
    expect(authoringStandardAttemptOutputLimits(12)).toEqual([
      40_000,
      32_000,
      36_000,
      24_000,
      24_000,
      24_000,
      24_000,
    ]);
    expect(authoringStandardAttemptOutputLimits(8)).toEqual([
      35_556,
      28_444,
      32_000,
      21_333,
      21_333,
      21_333,
      21_333,
    ]);
    for (const pageCount of [8, 12]) {
      const base = authoringMaxOutputTokens(pageCount);
      const limits = authoringStandardAttemptOutputLimits(pageCount);
      expect(limits).toHaveLength(7);
      expect(limits[0]).toBe(Math.ceil((10 * base) / 9));
      expect(limits[1]).toBe(Math.floor((8 * base) / 9));
      expect(limits[2]).toBe(3 * base - limits[0] - limits[1]);
      expect(limits.slice(3)).toEqual(
        Array.from({ length: 4 }, () => Math.floor((2 * base) / 3)),
      );
    }
  });
});

describe('Stage 1 — compiler requests the dedicated authoring call + records provenance', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('requests the exact gpt-5.6-sol authoring policy, strict schema, bounded output, and zero transport retries', async () => {
    let captured: ContractLlmCallOptions | undefined;
    let capturedUser = '';
    const spy: ContractLlmCaller = async (_s, user, opts) => {
      captured = opts;
      capturedUser = user;
      return JSON.stringify(bunnyTemplate());
    };
    const { provenance } = await compileBookVisualContractTemplate(bunnySource(), { callLLM: spy });
    expect(captured?.model).toBe('gpt-5.6-sol');
    expect(captured?.reasoningEffort).toBe('medium');
    expect(captured?.noFallback).toBe(true);
    expect(captured?.provider).toBe('openai');
    expect(captured?.endpoint).toBe('responses');
    expect(captured?.serviceTier).toBe('default');
    expect(captured?.toolsDisabled).toBe(true);
    expect(captured?.transportRetries).toBe(0);
    expect(captured?.timeoutMs).toBe(1_200_000);
    expect(captured?.maxInputTokens).toBe(64_000);
    expect(captured?.jsonSchema?.name).toBe(TEMPLATE_DRAFT_SCHEMA_NAME);
    expect(captured?.maxOutputTokens).toBe(40_000);
    const firstEvidence =
      bunnySource().sourceEvidenceCatalog.entries[0]!;
    expect(capturedUser).toContain(
      JSON.stringify(COMPLETE_STORY_SOURCE_PROMPT_COLUMNS),
    );
    expect(capturedUser).toContain(
      JSON.stringify([
        firstEvidence.pageNumber,
        firstEvidence.sourceEvidenceId,
        firstEvidence.excerpt,
      ]),
    );
    // Provenance records the resolved model.
    expect(provenance.authoringModel).toBe('gpt-5.6-sol');
    expect(provenance.reasoningEffort).toBe('medium');
    expect(provenance.maxOutputTokens).toBe(40_000);
    expect(provenance.schemaVersion).toBe('vc-draft-schema/v16');
    expect(provenance.attempt).toBe(1);
  });

  it('does not permit VISUAL_CONTRACT_AUTHOR_MODEL substitution', async () => {
    vi.stubEnv('VISUAL_CONTRACT_AUTHOR_MODEL', 'gpt-custom-authoring');
    let captured: ContractLlmCallOptions | undefined;
    const spy: ContractLlmCaller = async (_s, _u, opts) => {
      captured = opts;
      return JSON.stringify(bunnyTemplate());
    };
    const { provenance } = await compileBookVisualContractTemplate(bunnySource(), { callLLM: spy });
    expect(captured?.model).toBe('gpt-5.6-sol');
    expect(provenance.authoringModel).toBe('gpt-5.6-sol');
  });

  it('rejects an incompatible serialized schema before the legacy injected caller can run', async () => {
    const constNode = findConstNode(
      TEMPLATE_DRAFT_JSON_SCHEMA,
      'action_requirement',
    );
    expect(constNode).not.toBeNull();
    const originalType = constNode!.type;
    const callLLM = vi.fn<ContractLlmCaller>();
    let caught: unknown;
    delete constNode!.type;
    try {
      await compileBookVisualContractTemplate(bunnySource(), {
        callLLM,
      });
    } catch (error) {
      caught = error;
    } finally {
      constNode!.type = originalType;
    }
    expect(caught).toBeInstanceOf(
      OpenAIResponsesStructuredOutputSchemaCompatibilityError,
    );
    expect(callLLM).not.toHaveBeenCalled();
  });
});

describe('Stage 1 — pipeline json_schema + no silent fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends json_schema (strict) + the resolved authoring model + reasoning on the Responses path', async () => {
    const { callLLM } = await import('@/backend/providers/pipeline');
    const calls: Array<{ body: Record<string, unknown> }> = [];
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        calls.push({ body: JSON.parse(init.body) });
        return { ok: true, json: async () => ({ output_text: '{}', usage: { total_tokens: 5 } }) };
      }),
    );
    expect(resolveAuthoringModel()).toBe('gpt-5.6-sol');
    await callLLM('sys', 'usr', 12000, 0.4, 'VisualContractTemplate', true, {
      modelOverride: resolveAuthoringModel(),
      reasoningEffort: 'medium',
      jsonSchema: { name: 'X', schema: { type: 'object', additionalProperties: false, properties: {}, required: [] } },
      noFallback: true,
      providerOverride: 'openai',
      endpointOverride: 'responses',
      serviceTier: 'default',
      toolsDisabled: true,
      transportRetries: 0,
      timeoutMs: 1_200_000,
    });
    const body = calls[0].body as Record<string, any>;
    expect(body.model).toBe('gpt-5.6-sol');
    expect(body.reasoning).toEqual({ effort: 'medium' });
    expect(body.max_output_tokens).toBe(12000);
    expect(body.text.format.type).toBe('json_schema');
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.name).toBe('X');
    expect(body.service_tier).toBe('default');
    expect(body.tools).toEqual([]);
    expect(body.tool_choice).toBe('none');
  });

  it('VISUAL_CONTRACT_AUTHOR_MODEL cannot override the resolved authoring model', () => {
    vi.stubEnv('VISUAL_CONTRACT_AUTHOR_MODEL', 'gpt-5.5-pro-alt');
    expect(resolveAuthoringModel()).toBe('gpt-5.6-sol');
  });

  it('captures Responses usage (output / reasoning / total tokens) + finish status', async () => {
    const { callLLM } = await import('@/backend/providers/pipeline');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: 'completed',
          output_text: '{}',
          usage: { output_tokens: 6300, total_tokens: 16300, output_tokens_details: { reasoning_tokens: 10000 } },
        }),
      })),
    );
    const res = await callLLM('s', 'u', 36000, 0.4, 'VisualContractTemplate', true, { modelOverride: 'gpt-5.5-pro' });
    expect(res.usage).toEqual({ outputTokens: 6300, reasoningTokens: 10000, totalTokens: 16300 });
    expect(res.finishReason).toBe('completed');
  });

  it('throws EXPLICITLY on a truncated (incomplete) Responses output — with reason + usage (never a mystery)', async () => {
    const { callLLM } = await import('@/backend/providers/pipeline');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens' },
          output_text: '{"worldType":"cli',
          usage: { output_tokens: 1900, total_tokens: 12000, output_tokens_details: { reasoning_tokens: 10000 } },
        }),
      })),
    );
    await expect(
      callLLM('s', 'u', 12000, 0.4, 'VisualContractTemplate', true, { modelOverride: 'gpt-5.5-pro' }),
    ).rejects.toThrow(/INCOMPLETE.*max_output_tokens.*reasoning=10000/s);
  });

  it('noFallback → throws (never silently falls back) when the model is unavailable', async () => {
    const { callLLM } = await import('@/backend/providers/pipeline');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('FALLBACK_STORY_MODEL', 'gpt-4o'); // a fallback IS configured — noFallback must still throw
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, text: async () => 'model_not_found' })),
    );
    await expect(
      callLLM('s', 'u', 100, 0.4, 'VisualContractTemplate', true, { modelOverride: resolveAuthoringModel(), noFallback: true }),
    ).rejects.toThrow(/not available/i);
  });

  it('providerOverride=openai bypasses STORY_PROVIDER and transportRetries=0 performs exactly one fetch', async () => {
    const { callLLM } = await import('@/backend/providers/pipeline');
    vi.stubEnv('STORY_PROVIDER', 'anthropic');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_API_KEY', 'must-not-be-used');
    const fetchSpy = vi.fn(async (_url: string) => ({
      ok: false,
      status: 503,
      text: async () => 'temporary outage',
    }));
    vi.stubGlobal('fetch', fetchSpy);
    await expect(
      callLLM('s', 'u', 100, 0.4, 'VisualContractTemplate', true, {
        modelOverride: 'gpt-5.6-sol',
        providerOverride: 'openai',
        endpointOverride: 'responses',
        noFallback: true,
        transportRetries: 0,
      }),
    ).rejects.toThrow(/503/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
      'api.openai.com/v1/responses',
    );
  });

  it('enforces maxInputTokens before provider reachability', async () => {
    const { callLLM } = await import('@/backend/providers/pipeline');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(
      callLLM(
        'oversized '.repeat(1_000),
        'user',
        100,
        0.4,
        'VisualContractTemplate',
        true,
        {
          modelOverride: 'gpt-5.6-sol',
          providerOverride: 'openai',
          endpointOverride: 'responses',
          transportRetries: 0,
          maxInputTokens: 100,
        },
      ),
    ).rejects.toThrow(/input_token_ceiling_exceeded/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('unrelated callers retain the existing three-retry default', async () => {
    const { callLLM } = await import('@/backend/providers/pipeline');
    vi.stubEnv('STORY_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls < 4) {
          return {
            ok: false,
            status: 503,
            text: async () => 'temporary outage',
          };
        }
        return {
          ok: true,
          json: async () => ({
            status: 'completed',
            output_text: '{}',
            usage: {
              input_tokens: 1,
              output_tokens: 1,
              total_tokens: 2,
            },
          }),
        };
      }),
    );
    vi.useFakeTimers();
    try {
      const pending = callLLM(
        's',
        'u',
        100,
        0.4,
        'VisualContractTemplate',
        true,
        { modelOverride: 'gpt-5.6-sol', noFallback: true },
      );
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toMatchObject({ text: '{}' });
      expect(calls).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
