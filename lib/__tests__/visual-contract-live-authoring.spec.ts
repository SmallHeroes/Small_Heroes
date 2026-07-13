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

describe('Stage 1 — authoring token budget scales by page count', () => {
  it('~1000/page, floor 12000, cap 20000', () => {
    expect(authoringMaxOutputTokens(12)).toBe(12000);
    expect(authoringMaxOutputTokens(16)).toBe(16000);
    expect(authoringMaxOutputTokens(25)).toBe(20000); // cap
    expect(authoringMaxOutputTokens(8)).toBe(12000); // floor
    expect(authoringMaxOutputTokens(0)).toBe(12000); // invalid → default
  });
});

describe('Stage 1 — compiler requests the dedicated authoring call + records provenance', () => {
  it('requests gpt-5.3-pro + medium + json_schema + a 12000-token budget (12 pages), no fallback', async () => {
    let captured: ContractLlmCallOptions | undefined;
    const spy: ContractLlmCaller = async (_s, _u, opts) => {
      captured = opts;
      return JSON.stringify(bunnyTemplate());
    };
    const { provenance } = await compileBookVisualContractTemplate(bunnySource(), { callLLM: spy });
    expect(captured?.model).toBe('gpt-5.3-pro');
    expect(captured?.reasoningEffort).toBe('medium');
    expect(captured?.noFallback).toBe(true);
    expect(captured?.jsonSchema?.name).toBe(TEMPLATE_DRAFT_SCHEMA_NAME);
    expect(captured?.maxOutputTokens).toBe(12000);
    // Provenance recorded on the result.
    expect(provenance.authoringModel).toBe('gpt-5.3-pro');
    expect(provenance.reasoningEffort).toBe('medium');
    expect(provenance.maxOutputTokens).toBe(12000);
    expect(provenance.schemaVersion).toBe('vc-draft-schema/v1');
    expect(provenance.attempt).toBe(1);
  });
});

describe('Stage 1 — pipeline json_schema + no silent fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends json_schema (strict) + model override + reasoning on the Responses path', async () => {
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
    await callLLM('sys', 'usr', 12000, 0.4, 'VisualContractTemplate', true, {
      modelOverride: 'gpt-5.3-pro',
      reasoningEffort: 'medium',
      jsonSchema: { name: 'X', schema: { type: 'object', additionalProperties: false, properties: {}, required: [] } },
      noFallback: true,
    });
    const body = calls[0].body as Record<string, any>;
    expect(body.model).toBe('gpt-5.3-pro');
    expect(body.reasoning).toEqual({ effort: 'medium' });
    expect(body.max_output_tokens).toBe(12000);
    expect(body.text.format.type).toBe('json_schema');
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.name).toBe('X');
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
      callLLM('s', 'u', 100, 0.4, 'VisualContractTemplate', true, { modelOverride: 'gpt-5.3-pro', noFallback: true }),
    ).rejects.toThrow(/not available/i);
  });
});
