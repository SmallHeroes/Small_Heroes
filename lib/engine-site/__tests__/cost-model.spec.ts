import { describe, expect, it } from 'vitest';
import { authorStepRuntime, engineSiteCostScenario, type CostAssumptions } from '../cost-model';

export const costAssumptions: CostAssumptions = { lowNativeUsd: 5.5, lowRenderShare: 0.5, mediumRenderMultiplier: 3,
  storyAndPreparationUsd: 1.75, narrationCharacters: 4000, finalPromptUtf8Bytes: 16000, referencesPerRender: 4,
  storyWireByteCeiling: 104000, childReferenceCeilingUsd: 1, ilsPerUsd: 3.157, vatRate: 0.18,
  paymentFeeRate: 0.029, paymentFixedIls: 1, infrastructureUsd: 0.35 };

describe('MEDIUM launch economics, explicit assumptions and declared reserves', () => {
  it('does not multiply review/identity costs when only image rendering becomes more expensive', () => {
    const result = engineSiteCostScenario(costAssumptions);
    expect(result.expectedNativeUsd).toBe(11);
    expect(result.expectedGenerationUsd).toBeCloseTo(13.15);
    expect(result.netRevenueUsd).toBeCloseTo(13.153, 2);
    expect(result.expectedContributionUsd).toBeLessThan(0);
    expect(result.reserve.nativeDeclaredReserveUsd).toBeCloseTo(40.119408);
    expect(result.reserve.fullDeclaredReserveUsd).toBeGreaterThan(55);
  });

  it('counts 27 render/review/identity attempt triplets and at most nine additional review re-asks', () => {
    const result = engineSiteCostScenario({ ...costAssumptions, mediumRenderMultiplier: 1 });
    expect(result.expectedNativeUsd).toBe(5.5);
    expect(result.reserve.narrationReserveUsd).toBe(0.8);
    expect(result.reserve.preparationDeclaredReserveUsd).toBe(5);
    expect(result.qualification).toContain('unmeasured');
  });

  it('exposes a failed/full-refund order as consumed cost, without claiming a per-order cap guarantees business profit', () => {
    const result = engineSiteCostScenario(costAssumptions);
    const proposedCapUsd = 8.5;
    expect(result.availableForGenerationUsd - proposedCapUsd).toBeGreaterThan(3);
    expect(result.expectedGenerationUsd).toBeGreaterThan(proposedCapUsd);
    expect(result.reserve.fullDeclaredReserveUsd).toBeGreaterThan(proposedCapUsd);
  });

  it('requires a long-step executor at the current 300s limit without reducing the author design caps', () => {
    expect(authorStepRuntime('plan')).toMatchObject({ outputTokens: 18000, providerDeadlineMs: 780000, fitsInvocation: false });
    expect(authorStepRuntime('author')).toMatchObject({ outputTokens: 8000, providerDeadlineMs: 380000, fitsInvocation: false });
    expect(authorStepRuntime('editor')).toMatchObject({ outputTokens: 20000, providerDeadlineMs: 860000, fitsInvocation: false });
    expect(authorStepRuntime('editor', 1_000_000).fitsInvocation).toBe(true);
  });
});
