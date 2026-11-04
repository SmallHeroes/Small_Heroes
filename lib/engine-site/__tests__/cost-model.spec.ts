import { describe, expect, it } from 'vitest';
import { authorStepRuntime, engineSiteCostScenario, type CostAssumptions } from '../cost-model';

export const costAssumptions: CostAssumptions = {
  storyAndPreparationUsd: 1.75, narrationCharacters: 4000, finalPromptUtf8Bytes: 16000, referencesPerRender: 4,
  storyWireByteCeiling: 104000, childReferenceCeilingUsd: 1, ilsPerUsd: 3.157, vatRate: 0.18,
  paymentFeeRate: 0.029, paymentFixedIls: 1, infrastructureUsd: 0.35 };

describe('LOW launch economics at 59 ILS, explicit assumptions and declared reserves', () => {
  it('uses the reported full native anchor without inventing a quality multiplier or per-call split', () => {
    const result = engineSiteCostScenario(costAssumptions);
    expect(result.expectedNativeUsd).toBe(5.457428);
    expect(result.expectedGenerationUsd).toBeCloseTo(7.607428);
    expect(result.netRevenueUsd).toBeGreaterThan(15);
    expect(result.expectedContributionUsd).toBeGreaterThan(6);
    expect(result.reserve.nativeDeclaredReserveUsd).toBeCloseTo(40.119408);
    expect(result.reserve.fullDeclaredReserveUsd).toBeGreaterThan(55);
  });

  it('counts 27 render/review/identity attempt triplets and at most nine additional review re-asks', () => {
    const result = engineSiteCostScenario(costAssumptions);
    expect(result.expectedNativeUsd).toBe(5.457428);
    expect(result.reserve.narrationReserveUsd).toBe(0.8);
    expect(result.reserve.preparationDeclaredReserveUsd).toBe(5);
    expect(result.qualification).toContain('reported_low_anchor');
  });

  it('exposes a failed/full-refund order as consumed cost, without claiming a per-order cap guarantees business profit', () => {
    const result = engineSiteCostScenario(costAssumptions);
    const proposedCapUsd = result.proposedCapUsd;
    expect(proposedCapUsd).toBe(10);
    expect(result.availableForGenerationUsd - proposedCapUsd).toBeGreaterThan(4);
    expect(result.expectedGenerationUsd).toBeLessThan(proposedCapUsd);
    expect(result.reserve.fullDeclaredReserveUsd).toBeGreaterThan(proposedCapUsd);
  });

  it('requires a long-step executor at the current 300s limit without reducing the author design caps', () => {
    expect(authorStepRuntime('plan')).toMatchObject({ outputTokens: 18000, providerDeadlineMs: 780000, fitsInvocation: false });
    expect(authorStepRuntime('author')).toMatchObject({ outputTokens: 8000, providerDeadlineMs: 380000, fitsInvocation: false });
    expect(authorStepRuntime('editor')).toMatchObject({ outputTokens: 20000, providerDeadlineMs: 860000, fitsInvocation: false });
    expect(authorStepRuntime('editor', 1_000_000).fitsInvocation).toBe(true);
  });
});
