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

const BUNNY_KEY = 'bunny_ometz_adventure';
const BANK = path.join(process.cwd(), 'story-bank/v3-approved');
function bunnySource(): TemplateCompileInput {
  return extractSourceFromMarkdown(BUNNY_KEY, fs.readFileSync(path.join(BANK, `${BUNNY_KEY}.md`), 'utf8')) as TemplateCompileInput;
}
function bunnyTemplate(): unknown {
  return JSON.parse(fs.readFileSync(path.join(BANK, `${BUNNY_KEY}.visual-contract-template.json`), 'utf8'));
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
    for (const k of ['worldType', 'locations', 'zones', 'cast', 'humanCast', 'recurringProps', 'forbiddenGlobalElements', 'coverContract', 'pageContracts']) {
      expect(Object.keys(props)).toContain(k);
    }
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
});

describe('Stage 1 — compiler requests the dedicated authoring call + records provenance', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('requests the resolved authoring model (default gpt-5.5-pro) + medium + json_schema + 12000 budget, no fallback', async () => {
    let captured: ContractLlmCallOptions | undefined;
    const spy: ContractLlmCaller = async (_s, _u, opts) => {
      captured = opts;
      return JSON.stringify(bunnyTemplate());
    };
    const { provenance } = await compileBookVisualContractTemplate(bunnySource(), { callLLM: spy });
    expect(captured?.model).toBe('gpt-5.5-pro');
    expect(captured?.reasoningEffort).toBe('medium');
    expect(captured?.noFallback).toBe(true);
    expect(captured?.jsonSchema?.name).toBe(TEMPLATE_DRAFT_SCHEMA_NAME);
    expect(captured?.maxOutputTokens).toBe(36000);
    // Provenance records the resolved model.
    expect(provenance.authoringModel).toBe('gpt-5.5-pro');
    expect(provenance.reasoningEffort).toBe('medium');
    expect(provenance.maxOutputTokens).toBe(36000);
    expect(provenance.schemaVersion).toBe('vc-draft-schema/v1');
    expect(provenance.attempt).toBe(1);
  });

  it('the authoring model is overridable via VISUAL_CONTRACT_AUTHOR_MODEL', async () => {
    vi.stubEnv('VISUAL_CONTRACT_AUTHOR_MODEL', 'gpt-custom-authoring');
    let captured: ContractLlmCallOptions | undefined;
    const spy: ContractLlmCaller = async (_s, _u, opts) => {
      captured = opts;
      return JSON.stringify(bunnyTemplate());
    };
    const { provenance } = await compileBookVisualContractTemplate(bunnySource(), { callLLM: spy });
    expect(captured?.model).toBe('gpt-custom-authoring');
    expect(provenance.authoringModel).toBe('gpt-custom-authoring');
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
    expect(resolveAuthoringModel()).toBe('gpt-5.5-pro'); // default
    await callLLM('sys', 'usr', 12000, 0.4, 'VisualContractTemplate', true, {
      modelOverride: resolveAuthoringModel(),
      reasoningEffort: 'medium',
      jsonSchema: { name: 'X', schema: { type: 'object', additionalProperties: false, properties: {}, required: [] } },
      noFallback: true,
    });
    const body = calls[0].body as Record<string, any>;
    expect(body.model).toBe('gpt-5.5-pro');
    expect(body.reasoning).toEqual({ effort: 'medium' });
    expect(body.max_output_tokens).toBe(12000);
    expect(body.text.format.type).toBe('json_schema');
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.name).toBe('X');
  });

  it('VISUAL_CONTRACT_AUTHOR_MODEL overrides the resolved authoring model', () => {
    vi.stubEnv('VISUAL_CONTRACT_AUTHOR_MODEL', 'gpt-5.5-pro-alt');
    expect(resolveAuthoringModel()).toBe('gpt-5.5-pro-alt');
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
});
