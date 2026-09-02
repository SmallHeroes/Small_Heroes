import { describe, expect, it } from 'vitest';

import {
  resolveEffectiveThreshold,
  resolveResemblanceThresholdConfig,
} from '@/lib/resemblance-core';
import { normalizeStyleId } from '@/lib/styles';

describe('Style-01 resemblance threshold aliases', () => {
  it('keeps the persisted and canonical Style-01 names at the protected 0.70 threshold', () => {
    const config = resolveResemblanceThresholdConfig({} as NodeJS.ProcessEnv);

    expect(resolveEffectiveThreshold('pencil_watercolor', config)).toBe(0.7);
    expect(resolveEffectiveThreshold('realistic_illustrated', config)).toBe(0.7);
    expect(
      resolveEffectiveThreshold(normalizeStyleId('pencil_watercolor'), config),
    ).toBe(0.7);
  });
});
