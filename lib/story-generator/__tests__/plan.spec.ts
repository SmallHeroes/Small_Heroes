import { describe, expect, it } from 'vitest';
import { validatePlan } from '../stages/validatePlan';
import { buildMockPlan, MVP_MATRIX } from './fixtures';

describe('validatePlan', () => {
  it('accepts mock plans for all 9 MVP inputs', () => {
    for (const input of MVP_MATRIX) {
      const plan = buildMockPlan(input);
      const result = validatePlan(plan, input);
      expect(result.ok, result.reason).toBe(true);
    }
  });

  it('rejects moment outside window', () => {
    const input = MVP_MATRIX[0];
    const plan = buildMockPlan(input);
    plan.momentContract.page = 2;
    const result = validatePlan(plan, input);
    expect(result.ok).toBe(false);
  });
});
