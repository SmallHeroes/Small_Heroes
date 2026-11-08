import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { canonicalHash } from '@/lib/canonical-json';
import { standardEngineResponseSchema, ENGINE_RESPONSE_SCHEMA_POLICY } from '../response-schema';
import { engineOrderAuthoritySchema } from '../contract';
import { prepareEngineResponse } from '../provider-plans';
import { LocalEngineTrialRuntime } from '../local-trial-runtime';
import { authority } from './fixtures';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== path.resolve(tmpdir()) || !path.basename(root).startsWith('sh_schema_test_')) throw Error('owned_test_only');
    rmSync(root, { recursive: true, force: true });
  }
});
const schema = z.object({ quote: z.string().nullable() }).strict();
const payload = () => ({ model: 'gpt-6.1-sol', service_tier: 'default', store: false, reasoning: { effort: 'medium' },
  instructions: 'Synthetic schema test only', input: 'Synthetic text', max_output_tokens: 1200,
  text: { format: zodTextFormat(schema, 'synthetic_null_quote') } });
const auth = (selected = true) => ({ ...authority(), purpose: 'test' as const,
  budget: { ...authority().budget, maximumMicroUsd: 100_000, steps: authority().budget.steps.map(step => ({ ...step, maximumMicroUsd: 10_000 })) },
  ...(selected ? { responseSchemaPolicy: ENGINE_RESPONSE_SCHEMA_POLICY } : {}) });
const raw = (quote: string | null = null) => ({ id: 'resp_synthetic_null', status: 'completed', model: 'gpt-6.1-sol',
  service_tier: 'default', usage: { input_tokens: 100, output_tokens: 100 }, output_text: JSON.stringify({ quote }) });
const ports = (answer = raw()) => ({ fetch: vi.fn(async (_url: Parameters<typeof fetch>[0], _init?: RequestInit) => new Response(JSON.stringify(answer))),
  openAIKey: vi.fn(() => 'SYNTHETIC_ONLY'), anthropicKey: vi.fn(() => { throw Error('unused'); }) });

describe('standard-null schema dialect without rewriting model data', () => {
  it.each(['string', 'number', 'integer', 'boolean', 'null'])('represents nullable %s without moving its address or metadata', type => {
    const before = { type, nullable: true, description: 'תיאור סינתטי', default: { nullable: true, type: 'string' } };
    const frozen = JSON.stringify(before), result = standardEngineResponseSchema(before);
    expect(result).toEqual({ type: type === 'null' ? 'null' : [type, 'null'], description: before.description, default: before.default });
    expect(JSON.stringify(before)).toBe(frozen);
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(Buffer.byteLength(frozen));
  });
  it('fixes the actual installed SDK scalar shape while preserving required/additionalProperties', () => {
    const before = zodTextFormat(schema, 'synthetic_null_quote').schema;
    expect((before.properties as any).quote).toEqual({ type: 'string', nullable: true });
    expect(standardEngineResponseSchema(before)).toMatchObject({ type: 'object', properties: { quote: { type: ['string', 'null'] } },
      required: ['quote'], additionalProperties: false });
  });
  it('preserves already-standard constrained scalar, enum, object, array and reference null unions', () => {
    const sdk = zodTextFormat(z.object({ constrained: z.string().min(2).nullable(), number: z.number().min(1).nullable(),
      enum: z.enum(['a', 'b']).nullable(), object: z.object({ value: z.string() }).strict().nullable(),
      array: z.array(z.string()).nullable() }).strict(), 'synthetic_standard_unions').schema;
    expect(standardEngineResponseSchema(sdk)).toEqual(sdk);
  });
  it('keeps definition and nested-property JSON Pointers stable instead of inserting wrappers', () => {
    const before = { type: 'object', definitions: { shared: { type: 'object', properties: { quote: { type: 'string', nullable: true } } } },
      properties: { first: { $ref: '#/definitions/shared' }, second: { $ref: '#/definitions/shared/properties/quote' },
        nullable: { type: 'boolean' } }, required: ['first', 'second', 'nullable'], additionalProperties: false };
    const result = standardEngineResponseSchema(before);
    expect(result).toMatchObject({ definitions: { shared: { properties: { quote: { type: ['string', 'null'] } } } },
      properties: before.properties, required: before.required, additionalProperties: false });
    expect(result).not.toHaveProperty('anyOf');
  });
  it('never treats enum/const/default/examples or field names as schemas', () => {
    const data = { type: 'string', nullable: true };
    const before = { type: 'object', properties: { nullable: { const: data }, type: { default: data, examples: [data], enum: [data] },
      optional: { type: 'string', nullable: true, examples: [data] } }, examples: [data] };
    const result = standardEngineResponseSchema(before);
    expect((result.properties as any).nullable).toEqual({ const: data });
    expect((result.properties as any).type).toEqual(before.properties.type);
    expect((result.properties as any).optional.examples).toEqual([data]);
    expect(result.examples).toEqual([data]);
  });
  it.each(['allOf', 'anyOf', 'oneOf', 'prefixItems'])('visits %s schema arrays', keyword => {
    expect(standardEngineResponseSchema({ [keyword]: [{ type: 'string', nullable: true }, false] }))
      .toEqual({ [keyword]: [{ type: ['string', 'null'] }, false] });
  });
  it.each(['additionalProperties', 'additionalItems', 'contains', 'not', 'if', 'then', 'else', 'propertyNames',
    'unevaluatedProperties', 'unevaluatedItems', 'contentSchema'])('visits %s schema children', keyword => {
    expect(standardEngineResponseSchema({ [keyword]: { type: 'number', nullable: true } }))
      .toEqual({ [keyword]: { type: ['number', 'null'] } });
  });
  it('handles tuple/items/dependencies and shared objects without changing data dependency arrays', () => {
    const child = { type: 'string', nullable: true };
    expect(standardEngineResponseSchema({ items: [child, false], dependencies: { property: ['nullable', 'type'], schema: child },
      $defs: { a: child, b: child }, patternProperties: { '.*': child } })).toEqual({ items: [{ type: ['string', 'null'] }, false],
      dependencies: { property: ['nullable', 'type'], schema: { type: ['string', 'null'] } },
      $defs: { a: { type: ['string', 'null'] }, b: { type: ['string', 'null'] } }, patternProperties: { '.*': { type: ['string', 'null'] } } });
    expect(standardEngineResponseSchema({ items: child })).toEqual({ items: { type: ['string', 'null'] } });
  });
  it.each([{ type: 'string', nullable: false }, { type: 'string', nullable: 'true' }, { nullable: true },
    { type: 'string', nullable: true, minLength: 1 }, { type: 'string', nullable: true, enum: ['a'] },
    { type: 'string', nullable: true, const: 'a' }, { type: 'object', nullable: true },
    { $ref: '#/definitions/a', nullable: true }, { type: ['string', 'null'], nullable: true }])
  ('refuses unfamiliar extension shapes instead of silently widening constraints: %j', value => {
    expect(() => standardEngineResponseSchema(value)).toThrow('engine_response_schema_nullable_shape');
  });
  it('refuses malformed schema positions before a provider can be dispatched', () => {
    for (const value of [{ properties: [] }, { items: 'bad' }, { anyOf: {} }, { definitions: { a: null } }])
      expect(() => standardEngineResponseSchema(value)).toThrow('engine_response_schema_nullable_shape');
  });
});

describe('explicit authority, wire and raw replay binding', () => {
  it('leaves legacy authority and exact response wire unchanged when the policy is absent', () => {
    const a = auth(false), body = payload(), plan = prepareEngineResponse(a, 'page_0_0_qa', body, x => x, ports());
    expect(engineOrderAuthoritySchema.parse(a)).toEqual(a);
    expect(plan.wire).toEqual({ version: 'engine-site-responses/v1', authoritySha256: canonicalHash(a), step: 'page_0_0_qa',
      body: structuredClone({ ...body, background: true, store: false }), endpoint: 'https://api.openai.com/v1/responses', maxRetries: 0 });
    expect((plan.wire as any).body.text.format.schema.properties.quote).toEqual({ type: 'string', nullable: true });
  });
  it('binds an explicit test-only policy and v2 wire, keeping the full source, byte ceiling and reserve', () => {
    const legacy = prepareEngineResponse(auth(false), 'page_0_0_qa', payload(), x => x, ports());
    const input = payload(), saved = JSON.stringify(input), fixed = prepareEngineResponse(auth(), 'page_0_0_qa', input, x => x, ports());
    expect(fixed.wire).toMatchObject({ version: 'engine-site-responses/v2', responseSchemaPolicy: ENGINE_RESPONSE_SCHEMA_POLICY });
    expect((fixed.wire as any).body.text.format.schema.properties.quote).toEqual({ type: ['string', 'null'] });
    expect(fixed.call.wireSha256).not.toBe(legacy.call.wireSha256);
    expect(fixed.call.maximumMicroUsd).toBe(legacy.call.maximumMicroUsd);
    expect((fixed.wire as any).body.input).toBe(input.input);
    expect((fixed.wire as any).body.instructions).toBe(input.instructions);
    expect(Buffer.byteLength(JSON.stringify((fixed.wire as any).body))).toBeLessThanOrEqual(Buffer.byteLength(JSON.stringify((legacy.wire as any).body)));
    expect(JSON.stringify(input)).toBe(saved);
    expect(() => engineOrderAuthoritySchema.parse({ ...auth(), purpose: 'customer' })).toThrow();
    expect(() => engineOrderAuthoritySchema.parse({ ...auth(), responseSchemaPolicy: 'other-version' })).toThrow();
  });
  it('rejects missing/loose formats and unsupported schemas before fetch or key access', () => {
    const p = ports();
    for (const text of [{ format: { type: 'json_object' } }, { format: { ...payload().text.format, strict: false } },
      { format: { ...payload().text.format, schema: { type: 'string', nullable: true, enum: ['a'] } } }])
      expect(() => prepareEngineResponse(auth(), 'page_0_0_qa', { ...payload(), text }, x => x, p)).toThrow(/engine_response_schema/);
    expect(p.fetch).not.toHaveBeenCalled(); expect(p.openAIKey).not.toHaveBeenCalled();
  });
  it.each([104_000, 104_001])('keeps the existing native text-input boundary without truncation: %s', bytes => {
    const p = ports(), body = { ...payload(), instructions: 'x', input: 'y'.repeat(bytes - 1) };
    if (bytes === 104_000) expect((prepareEngineResponse(auth(), 'page_0_0_qa', body, x => x, p).wire as any).body.input).toBe(body.input);
    else expect(() => prepareEngineResponse(auth(), 'page_0_0_qa', body, x => x, p)).toThrow('engine_responses_input_limit');
    expect(p.fetch).not.toHaveBeenCalled(); expect(p.openAIKey).not.toHaveBeenCalled();
  });
  it.each([null, 'null'])('preserves raw returned %j and its known usage without coercing evidence', async quote => {
    const answer = raw(quote), p = ports(answer), plan = prepareEngineResponse(auth(), 'page_0_0_qa', payload(), x => schema.parse(x), p);
    const completed = await plan.execute(undefined, new AbortController().signal, async () => {});
    expect(completed).toMatchObject({ kind: 'completed', result: { usable: true, output: { quote }, raw: answer, estimatedMicroUsd: 1200 } });
    if (completed.kind !== 'completed') throw Error('synthetic');
    expect(() => plan.admitSaved!(completed.result)).not.toThrow();
    expect(JSON.parse(p.fetch.mock.calls[0][1]!.body as string).text.format.schema.properties.quote).toEqual({ type: ['string', 'null'] });
    expect(() => plan.admitSaved!({ ...completed.result, output: { quote: 3 } })).toThrow('engine_saved_response_invalid');
  });
  it('refuses a changed new wire after the awaited dispatch guard and before fetching or reading a key', async () => {
    const p = ports(), plan = prepareEngineResponse(auth(), 'page_0_0_qa', payload(), x => x, p);
    await expect(plan.execute(undefined, new AbortController().signal, async () => {
      await Promise.resolve(); (plan.wire as any).body.text.format.schema.properties.quote.type = 'string';
    })).rejects.toThrow('engine_provider_plan_changed');
    expect(p.fetch).not.toHaveBeenCalled(); expect(p.openAIKey).not.toHaveBeenCalled();
  });
  it('rechecks the complete new wire before admitting an old saved result', async () => {
    const p = ports(), plan = prepareEngineResponse(auth(), 'page_0_0_qa', payload(), x => schema.parse(x), p);
    const completed = await plan.execute(undefined, new AbortController().signal, async () => {});
    if (completed.kind !== 'completed') throw Error('synthetic');
    (plan.wire as any).responseSchemaPolicy = 'forged';
    expect(() => plan.admitSaved!(completed.result)).toThrow('engine_provider_plan_changed');
  });
  it('durably resumes the same v2 result without a second dispatch, preserving the cumulative meter', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'sh_schema_test_')); roots.push(root);
    const a = auth(), options = { root, authority: a, ownerId: 'synthetic_owner', draftId: 'd_synthetic', snapshotSha256: a.requestSha256, assertCurrent: () => {} };
    const p = ports(), runtime = new LocalEngineTrialRuntime(options), plan = () => prepareEngineResponse(a, 'page_0_0_qa', payload(), x => schema.parse(x), p);
    expect((await runtime.call(plan())).output).toEqual({ quote: null });
    expect((await new LocalEngineTrialRuntime(options).call(plan())).output).toEqual({ quote: null });
    expect(p.fetch).toHaveBeenCalledTimes(1);
    expect(await runtime.meter()).toMatchObject({ knownEstimateMicroUsd: 1200, logicalCalls: 1, pendingCalls: 0, unknownCalls: 0 });
    expect(() => new LocalEngineTrialRuntime({ ...options, authority: auth(false) })).toThrow('local_trial_checkpoint_binding');
  });
  it('retains the entire UNKNOWN reserve and refuses another POST after a lost new-wire dispatch', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'sh_schema_test_')); roots.push(root);
    const a = auth(), options = { root, authority: a, ownerId: 'synthetic_owner', draftId: 'd_synthetic', snapshotSha256: a.requestSha256, assertCurrent: () => {} };
    const p = ports(); p.fetch.mockRejectedValue(Error('synthetic_lost_post'));
    const plan = () => prepareEngineResponse(a, 'page_0_0_qa', payload(), x => schema.parse(x), p);
    const runtime = new LocalEngineTrialRuntime(options);
    await expect(runtime.call(plan())).rejects.toThrow('synthetic_lost_post');
    expect(await runtime.meter()).toMatchObject({ accountedMicroUsd: 10_000, knownEstimateMicroUsd: 0, logicalCalls: 1, pendingCalls: 1 });
    await expect(new LocalEngineTrialRuntime(options).call(plan())).rejects.toThrow('local_trial_unknown_dispatch');
    expect(p.fetch).toHaveBeenCalledTimes(1);
  });
});
