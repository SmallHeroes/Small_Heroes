import { describe, expect, it } from 'vitest';

import {
  BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
  BLUEPRINT_AUTHORING_MAX_COUNT_PROBES,
  BLUEPRINT_AUTHORING_MAX_REPAIRS,
  blueprintAuthoringCountProbeReserveUsd,
  projectedMaximumBlueprintAuthoringCostUsd,
  projectedMaximumBlueprintAuthoringCostWithCountProbesUsd,
} from '@/lib/visual-package/blueprintAuthoringPolicy';
import {
  BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT,
  blueprintAuthoringExactInputTokenCountFromResponse,
  blueprintAuthoringTokenRelevantRequestProjection,
} from '@/lib/visual-package/blueprintAuthoringInputTokenAdmission';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';

// F1 boundary-1 foundation: the pure, offline contracts A3 (exact-count response gate),
// B1 (canonical token-relevant request projection), and C1 (conservative $5 count-probe
// reserve). These change no existing runtime behavior; wiring is a later boundary.

describe('conservative $5 treatment reserves every count probe (C1)', () => {
  it('reserves one count probe as worst-case 64K input-only cost = $0.352', () => {
    expect(blueprintAuthoringCountProbeReserveUsd()).toBe(0.352);
    expect(BLUEPRINT_AUTHORING_MAX_COUNT_PROBES).toBe(BLUEPRINT_AUTHORING_MAX_REPAIRS);
  });

  it('projected maximum WITH probes is $4.928, exactly $0.072 under the unchanged $5 ceiling', () => {
    expect(projectedMaximumBlueprintAuthoringCostUsd()).toBe(4.224);
    const withProbes = projectedMaximumBlueprintAuthoringCostWithCountProbesUsd();
    expect(withProbes).toBe(4.928);
    expect(withProbes).toBeLessThanOrEqual(BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD);
    expect(BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD - withProbes).toBeCloseTo(0.072, 6);
  });
});

describe('exact input-token count response gate (A3)', () => {
  const ok = {
    object: BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT,
    input_tokens: 12007,
  };

  it('accepts the exact { object, input_tokens } shape and returns the count', () => {
    expect(blueprintAuthoringExactInputTokenCountFromResponse(ok)).toBe(12007);
    expect(blueprintAuthoringExactInputTokenCountFromResponse({ ...ok, input_tokens: 0 })).toBe(0);
  });

  it('fails closed (null) on extra/missing keys, wrong object, or a non-integer count', () => {
    expect(
      blueprintAuthoringExactInputTokenCountFromResponse({ ...ok, extra: 1 }),
    ).toBeNull();
    expect(
      blueprintAuthoringExactInputTokenCountFromResponse({
        object: BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT,
      }),
    ).toBeNull();
    expect(
      blueprintAuthoringExactInputTokenCountFromResponse({ ...ok, object: 'response' }),
    ).toBeNull();
    expect(
      blueprintAuthoringExactInputTokenCountFromResponse({ ...ok, input_tokens: 12007.5 }),
    ).toBeNull();
    expect(
      blueprintAuthoringExactInputTokenCountFromResponse({ ...ok, input_tokens: -1 }),
    ).toBeNull();
    expect(
      blueprintAuthoringExactInputTokenCountFromResponse({
        ...ok,
        input_tokens: Number.MAX_SAFE_INTEGER + 2,
      }),
    ).toBeNull();
    expect(blueprintAuthoringExactInputTokenCountFromResponse(null)).toBeNull();
    expect(blueprintAuthoringExactInputTokenCountFromResponse([ok])).toBeNull();
    expect(blueprintAuthoringExactInputTokenCountFromResponse('12007')).toBeNull();
  });
});

describe('canonical token-relevant request projection (B1)', () => {
  const base = {
    model: 'gpt-5.6-sol',
    systemPrompt: 'SYS',
    userPrompt: 'USER',
    reasoningEffort: 'medium',
    schemaName: 'draft',
    schema: { type: 'object' } as Record<string, unknown>,
  };

  it('projects exactly the input-token-relevant fields and excludes output/transport controls', () => {
    const projection = blueprintAuthoringTokenRelevantRequestProjection(base);
    expect(Object.keys(projection).sort()).toEqual([
      'input',
      'model',
      'reasoning',
      'text',
      'tool_choice',
      'tools',
      'truncation',
    ]);
    expect(projection.input).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'USER' },
    ]);
    expect(projection.text.format).toEqual({
      type: 'json_schema',
      name: 'draft',
      schema: { type: 'object' },
      strict: true,
    });
    expect(projection.tools).toEqual([]);
    expect(projection.tool_choice).toBe('none');
    expect(projection.truncation).toBe('disabled');
    // Output/transport controls are deliberately absent (they do not change input tokens and
    // the count endpoint does not accept them).
    const asRecord = projection as unknown as Record<string, unknown>;
    for (const excluded of ['service_tier', 'max_output_tokens', 'store', 'stream']) {
      expect(excluded in asRecord).toBe(false);
    }
  });

  it('is deterministic: identical inputs share a canonical digest, any token-relevant change differs', () => {
    const a = blueprintAuthoringTokenRelevantRequestProjection(base);
    const b = blueprintAuthoringTokenRelevantRequestProjection({ ...base });
    expect(canonicalJsonDigest(a)).toBe(canonicalJsonDigest(b));
    for (const mutated of [
      { ...base, userPrompt: 'USER2' },
      { ...base, reasoningEffort: 'high' },
      { ...base, schema: { type: 'object', extra: true } as Record<string, unknown> },
      { ...base, model: 'other' },
    ]) {
      expect(
        canonicalJsonDigest(blueprintAuthoringTokenRelevantRequestProjection(mutated)),
      ).not.toBe(canonicalJsonDigest(a));
    }
  });
});
