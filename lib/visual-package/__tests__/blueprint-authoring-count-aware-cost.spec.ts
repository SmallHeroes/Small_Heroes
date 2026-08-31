import { describe, expect, it } from 'vitest';

import {
  BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY,
  BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY_DIGEST,
  BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD,
  BLUEPRINT_AUTHORING_MAX_GENERATION_MICRO_USD,
  BLUEPRINT_AUTHORING_MAX_SUCCESSFUL_PROBE_MICRO_USD,
  blueprintAuthoringFullyAdmittedWorstCaseMicroUsd,
  blueprintAuthoringGenerationMicroUsd,
  blueprintAuthoringInputMicroUsd,
  blueprintAuthoringProbeDebitMicroUsd,
  blueprintAuthoringProbeReservationIsWithinCeiling,
  blueprintAuthoringProbeReservationMicroUsd,
} from '@/lib/visual-package/blueprintAuthoringCountAwareCost';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import {
  BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
  BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS,
  blueprintAuthoringCountProbeReserveUsd,
  conservativeBlueprintAuthoringCostUsd,
} from '@/lib/visual-package/blueprintAuthoringPolicy';

describe('Q(U): count-aware conservative input micro-USD (integer arithmetic)', () => {
  it('publishes one digest-bound authority for the runtime-consumed threshold, multiplier, rates, and budgets', () => {
    expect(BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY_DIGEST).toBe(
      canonicalJsonDigest(BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY),
    );
    expect(Object.isFrozen(BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS)).toBe(true);
    expect(Object.keys(BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS).sort()).toEqual(
      [
        'cacheWriteInputUsdPerUnit',
        'cachedInputUsdPerUnit',
        'outputUsdPerUnit',
        'regionalUpliftMultiplier',
        'uncachedInputUsdPerUnit',
        'unitTokens',
      ].sort(),
    );
    expect(
      Object.keys(BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY).sort(),
    ).toEqual(
      [
        'conservativePricing',
        'generation',
        'hardCeilingMicroUsd',
        'inputTokenProbe',
        'pricingAssumptionsDigest',
      ].sort(),
    );
    expect(BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY).toMatchObject({
      hardCeilingMicroUsd: 5_000_000,
      conservativePricing: {
        inputRateNumeratorTenthsMicroUsd: 55,
        outputRateNumeratorTenthsMicroUsd: 220,
        rateDivisor: 10,
      },
      generation: {
        maxInputTokens: 64_000,
        maxOutputTokens: 48_000,
        maxCalls: 3,
        maxCallMicroUsd: 1_408_000,
      },
      inputTokenProbe: {
        maxRoutes: 2,
        maxSuccessfulInputTokens: 64_000,
        maxSuccessfulProbeMicroUsd: 352_000,
        largePromptInputTokenThreshold: 272_000,
        largePromptThresholdComparison: 'strictly_above',
        largePromptInputMultiplier: 2,
      },
    });
    expect(
      Object.isFrozen(
        BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.conservativePricing,
      ),
    ).toBe(true);
    expect(
      Object.isFrozen(BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.generation),
    ).toBe(true);
  });

  it('matches the exact boundary anchors', () => {
    expect(blueprintAuthoringInputMicroUsd(64_000)).toBe(352_000); // $0.352
    expect(blueprintAuthoringInputMicroUsd(272_000)).toBe(1_496_000); // $1.496
    expect(blueprintAuthoringInputMicroUsd(272_001)).toBe(2_992_011); // $2.992011 (2x rule kicks in)
    expect(blueprintAuthoringInputMicroUsd(0)).toBe(0);
    expect(blueprintAuthoringInputMicroUsd(1)).toBe(6); // ceil(5.5)
  });

  it('the >272K doubling is discontinuous at the exact threshold', () => {
    expect(blueprintAuthoringInputMicroUsd(272_000)).toBe(1_496_000);
    // one token more → 11*U, not 5.5*U
    expect(blueprintAuthoringInputMicroUsd(272_001)).toBeGreaterThan(
      2 * 1_496_000 - 12,
    );
  });

  it('fails closed on an invalid token count', () => {
    expect(() => blueprintAuthoringInputMicroUsd(-1)).toThrow();
    expect(() => blueprintAuthoringInputMicroUsd(1.5)).toThrow();
  });
});

describe('constants agree with the existing generation/probe cost helpers', () => {
  it('G, S, H are consistent with blueprintAuthoringPolicy', () => {
    expect(BLUEPRINT_AUTHORING_MAX_GENERATION_MICRO_USD).toBe(
      Math.round(
        conservativeBlueprintAuthoringCostUsd({
          inputTokens: 64_000,
          outputTokens: 48_000,
        }) * 1_000_000,
      ),
    );
    expect(BLUEPRINT_AUTHORING_MAX_SUCCESSFUL_PROBE_MICRO_USD).toBe(
      Math.round(blueprintAuthoringCountProbeReserveUsd() * 1_000_000),
    );
    expect(BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD).toBe(
      BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD * 1_000_000,
    );
  });

  it('derives generation cost directly in integer micro-USD without a float round-trip', () => {
    const cells = [
      [0, 0],
      [1, 1],
      [1_000, 2_000],
      [64_000, 48_000],
      [63_999, 47_999],
    ] as const;
    for (const [inputTokens, outputTokens] of cells) {
      expect(
        blueprintAuthoringGenerationMicroUsd({ inputTokens, outputTokens }),
      ).toBe(
        Math.max(
          0,
          Math.round(
            conservativeBlueprintAuthoringCostUsd({ inputTokens, outputTokens }) *
              1_000_000,
          ),
        ),
      );
    }
    expect(() =>
      blueprintAuthoringGenerationMicroUsd({ inputTokens: -1, outputTokens: 0 }),
    ).toThrow();
    expect(() =>
      blueprintAuthoringGenerationMicroUsd({
        inputTokens: Number.MAX_SAFE_INTEGER,
        outputTokens: 1,
      }),
    ).toThrow();
  });
});

describe('probe reservation boundary cells (mutually-exclusive fail/continue branches)', () => {
  it('first repair: A=1.408, g=2, pAfter=1 — U=326545 reaches $4.999995, U=326546 rejects', () => {
    const base = { accountedMicroUsd: 1_408_000, remainingGenerationCalls: 2, laterProbeRoutes: 1 };
    expect(
      blueprintAuthoringProbeReservationMicroUsd({ ...base, provenUpperBoundTokens: 326_545 }),
    ).toBe(4_999_995);
    expect(
      blueprintAuthoringProbeReservationIsWithinCeiling({ ...base, provenUpperBoundTokens: 326_545 }),
    ).toBe(true);
    expect(
      blueprintAuthoringProbeReservationIsWithinCeiling({ ...base, provenUpperBoundTokens: 326_546 }),
    ).toBe(false);
  });

  it('second repair worst: A=3.168, g=1, pAfter=0 — U=272000 admits at $4.928, U=272001 rejects', () => {
    const base = { accountedMicroUsd: 3_168_000, remainingGenerationCalls: 1, laterProbeRoutes: 0 };
    expect(
      blueprintAuthoringProbeReservationMicroUsd({ ...base, provenUpperBoundTokens: 272_000 }),
    ).toBe(4_928_000);
    expect(
      blueprintAuthoringProbeReservationIsWithinCeiling({ ...base, provenUpperBoundTokens: 272_000 }),
    ).toBe(true);
    expect(
      blueprintAuthoringProbeReservationIsWithinCeiling({ ...base, provenUpperBoundTokens: 272_001 }),
    ).toBe(false);
  });

  it('the fully-admitted worst case is exactly $4.928, $0.072 under the $5 ceiling', () => {
    expect(blueprintAuthoringFullyAdmittedWorstCaseMicroUsd()).toBe(4_928_000);
    expect(
      BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD -
        blueprintAuthoringFullyAdmittedWorstCaseMicroUsd(),
    ).toBe(72_000);
  });

  it('treats the exact $5 ceiling as inclusive and rejects one micro-USD above it', () => {
    const exactFence = {
      accountedMicroUsd: 1_408_005,
      provenUpperBoundTokens: 326_545,
      remainingGenerationCalls: 0,
      laterProbeRoutes: 0,
    };
    expect(blueprintAuthoringProbeReservationMicroUsd(exactFence)).toBe(
      5_000_000,
    );
    expect(blueprintAuthoringProbeReservationIsWithinCeiling(exactFence)).toBe(
      true,
    );
    expect(
      blueprintAuthoringProbeReservationIsWithinCeiling({
        ...exactFence,
        accountedMicroUsd: exactFence.accountedMicroUsd + 1,
      }),
    ).toBe(false);
  });

  it('fails closed on out-of-range g/pAfter', () => {
    const base = { accountedMicroUsd: 0, provenUpperBoundTokens: 1 };
    expect(
      blueprintAuthoringProbeReservationIsWithinCeiling({ ...base, remainingGenerationCalls: 4, laterProbeRoutes: 0 }),
    ).toBe(false);
    expect(
      blueprintAuthoringProbeReservationIsWithinCeiling({ ...base, remainingGenerationCalls: 1, laterProbeRoutes: 3 }),
    ).toBe(false);
  });
});

describe('post-dispatch debits', () => {
  it('counted debits Q(n); malformed-after-dispatch debits Q(U); before-dispatch debits 0', () => {
    expect(
      blueprintAuthoringProbeDebitMicroUsd({
        outcome: 'counted',
        exactInputTokens: 50_000,
        provenUpperBoundTokens: 300_000,
      }),
    ).toBe(blueprintAuthoringInputMicroUsd(50_000));
    expect(
      blueprintAuthoringProbeDebitMicroUsd({
        outcome: 'malformed_after_dispatch',
        provenUpperBoundTokens: 300_000,
      }),
    ).toBe(blueprintAuthoringInputMicroUsd(300_000));
    expect(
      blueprintAuthoringProbeDebitMicroUsd({
        outcome: 'failed_before_dispatch',
        provenUpperBoundTokens: 300_000,
      }),
    ).toBe(0);
  });
});

describe('property: no admitted branch can exceed the $5 ceiling', () => {
  it('every reservation that admits, plus its worst realized debits + remaining maxima, stays <= H', () => {
    // Enumerate the real F1 shape: initial generation done (A0 = G), then repair 1 (g=2,pAfter=1),
    // then repair 2 (g=1,pAfter=0). For a swept set of upper bounds, whenever a probe is admitted,
    // the worst-case realized total (probe debit + remaining generation maxima + remaining probe
    // maxima) must never exceed H.
    const G = BLUEPRINT_AUTHORING_MAX_GENERATION_MICRO_USD;
    const S = BLUEPRINT_AUTHORING_MAX_SUCCESSFUL_PROBE_MICRO_USD;
    const H = BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD;
    const sweep = [64_001, 100_000, 200_000, 272_000, 272_001, 300_000, 326_545, 326_546, 400_000];
    // Repair 1: A=G (initial), g=2, pAfter=1.
    for (const u of sweep) {
      const admit1 = blueprintAuthoringProbeReservationIsWithinCeiling({
        accountedMicroUsd: G,
        provenUpperBoundTokens: u,
        remainingGenerationCalls: 2,
        laterProbeRoutes: 1,
      });
      if (!admit1) continue;
      // Worst realized after admitting probe 1: probe1 succeeds at <=S, then A = G + S.
      // Repair 2 with A = G + G + S (both generations at max) = 2G + S, g=1, pAfter=0.
      const a2 = 2 * G + S;
      for (const u2 of sweep) {
        const admit2 = blueprintAuthoringProbeReservationIsWithinCeiling({
          accountedMicroUsd: a2,
          provenUpperBoundTokens: u2,
          remainingGenerationCalls: 1,
          laterProbeRoutes: 0,
        });
        if (!admit2) continue;
        // Worst realized: probe2 succeeds at <=S, then the final (3rd) generation at <=G.
        const worst = a2 + S + G; // = 3G + 2S
        expect(worst).toBeLessThanOrEqual(H);
      }
      // Terminal-failure branch of probe 1 (malformed after dispatch) debits <= Q(U); admitted
      // means A + Q(U) <= H already (reservation covers the failure branch).
      expect(G + blueprintAuthoringInputMicroUsd(u)).toBeLessThanOrEqual(H);
    }
  });
});
