import { describe, expect, it, vi } from 'vitest';
import { authority } from './fixtures';
import { authorityDigest, engineOrderAuthoritySchema } from '../contract';
import { ENGINE_RESPONSE_SCHEMA_POLICY } from '../response-schema';
import { ENGINE_SOURCE_CONCURRENCY_POLICY, enginePreparationContracts } from '../storyboard-concurrency-policy';
import { PREPARATION_CONTRACTS } from '@/lib/personal-wizard/source-preparation-contracts';
import { prepareEngineResponse } from '../provider-plans';

const prospective = () => ({ ...authority(), purpose: 'test' as const,
  responseSchemaPolicy: ENGINE_RESPONSE_SCHEMA_POLICY, storyboardConcurrencyPolicy: ENGINE_SOURCE_CONCURRENCY_POLICY });

describe('explicit prospective engine concurrency authority, no spending', () => {
  it('returns the exact historical preparation object without opt-in', () => {
    expect(enginePreparationContracts(authority())).toBe(PREPARATION_CONTRACTS);
    expect(engineOrderAuthoritySchema.parse(authority())).toEqual(authority());
    expect(enginePreparationContracts(authority()).engineContinuity).not.toHaveProperty('sourceConcurrency');
  });
  it('adds only the declared contract under test authority and binds it in the authority digest', () => {
    const a = prospective(), before = { ...a, storyboardConcurrencyPolicy: undefined };
    expect(engineOrderAuthoritySchema.parse(a)).toEqual(a);
    expect(enginePreparationContracts(a)).toEqual({ ...PREPARATION_CONTRACTS,
      engineContinuity: { ...PREPARATION_CONTRACTS.engineContinuity, sourceConcurrency: true } });
    expect(authorityDigest(a)).not.toBe(authorityDigest(before));
    expect(enginePreparationContracts(a).engineContinuity.materialFunction).toBe(true);
    expect(enginePreparationContracts(a).engineContinuity.companionScale).toBe(true);
  });
  it.each(['customer', 'absent_schema_policy', 'unknown_policy'])('refuses %s rather than upgrading an old grant', kind => {
    const a: any = prospective();
    if (kind === 'customer') a.purpose = 'customer';
    if (kind === 'absent_schema_policy') delete a.responseSchemaPolicy;
    if (kind === 'unknown_policy') a.storyboardConcurrencyPolicy = 'future-policy';
    expect(() => engineOrderAuthoritySchema.parse(a)).toThrow();
  });
  it('rejects a wire changed during the dispatch await, before key or supplied transport access', async () => {
    const a = prospective(), fetch = vi.fn(), openAIKey = vi.fn(() => 'SYNTHETIC_ONLY');
    const plan = prepareEngineResponse(a, 'page_0_0_qa', { model: 'gpt-6.1-sol', store: false, service_tier: 'default',
      reasoning: { effort: 'medium' }, instructions: 'Synthetic', input: 'Synthetic', max_output_tokens: 1,
      text: { format: { type: 'json_schema', strict: true, name: 'synthetic', schema: { type: 'object', properties: {}, additionalProperties: false, required: [] } } } },
      x => x, { fetch, openAIKey, anthropicKey: vi.fn() } as any);
    await expect(plan.execute(undefined, new AbortController().signal, async () => {
      (plan.wire as any).authoritySha256 = authorityDigest({ ...a, storyboardConcurrencyPolicy: undefined });
    })).rejects.toThrow('engine_provider_plan_changed');
    expect(fetch).not.toHaveBeenCalled(); expect(openAIKey).not.toHaveBeenCalled();
  });
});
