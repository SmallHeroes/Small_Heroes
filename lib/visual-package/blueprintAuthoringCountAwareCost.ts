import { canonicalHash } from '@/lib/canonical-json';

import {
  BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
  BLUEPRINT_AUTHORING_MAX_CALLS,
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_REPAIRS,
  BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS,
} from './blueprintAuthoringPolicy';

/**
 * F1 count-aware conservative spend authority, in EXACT integer micro-USD arithmetic
 * ($1 = 1_000_000 micro-USD), versioned as its own explicit cutover so legacy v6 generation
 * cost evidence is never reinterpreted. It models the exact-count PROBE (POST
 * /responses/input_tokens) as a real, non-free, worst-case-reserved call — including OpenAI's
 * current gpt-5.6-sol >272K-input "2x input for the entire request" rule.
 *
 * Rates (micro-USD per input token): cache-write input $5/1M = 5, times the 1.1 regional uplift
 * = 5.5; the >272K rule doubles input for the whole request → 11. So the conservative input-only
 * micro-USD cost of a request whose input is U tokens is:
 *   Q(U) = ceil(5.5 * U) = ceil(11*U/2)   for U <= 272000,
 *   Q(U) = ceil(11 * U)  = 11 * U          for U >  272000.
 *
 * Fixed reference points under the unchanged constants:
 *   H = 5_000_000 (the $5 hard ceiling),
 *   G = 1_408_000 (max generation call: 64K input + 48K output, uplifted),
 *   S =   352_000 (max SUCCESSFUL probe: a <=64K input-only count = Q(64000)).
 */
export const BLUEPRINT_AUTHORING_F1_COST_POLICY_VERSION =
  'blueprint-authoring-f1-count-aware-cost/v1' as const;

/**
 * One exact, canonical authority for every concrete value that changes count-probe debit or
 * admission. Runtime cost functions below consume this object directly; the paid execution
 * program binds its digest. That prevents a threshold/rate/budget change from silently reusing
 * an already consumed program identity.
 */
const BLUEPRINT_AUTHORING_COUNT_AWARE_COST_INPUTS = {
  pricingAssumptionsDigest: canonicalHash(BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS),
  hardCeilingMicroUsd: Math.round(
    BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD * 1_000_000,
  ),
  conservativePricing: {
    inputRateNumeratorTenthsMicroUsd: 55,
    outputRateNumeratorTenthsMicroUsd: 220,
    rateDivisor: 10,
  },
  generation: {
    maxInputTokens: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
    maxOutputTokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
    maxCalls: BLUEPRINT_AUTHORING_MAX_CALLS,
  },
  inputTokenProbe: {
    maxRoutes: BLUEPRINT_AUTHORING_MAX_REPAIRS,
    maxSuccessfulInputTokens: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
    largePromptInputTokenThreshold: 272_000,
    largePromptThresholdComparison: 'strictly_above',
    largePromptInputMultiplier: 2,
  },
} as const;

const MAX_GENERATION_MICRO_USD = Math.ceil(
  safeIntegerSum([
    safeIntegerProduct(
      BLUEPRINT_AUTHORING_COUNT_AWARE_COST_INPUTS.conservativePricing
        .inputRateNumeratorTenthsMicroUsd,
      BLUEPRINT_AUTHORING_COUNT_AWARE_COST_INPUTS.generation.maxInputTokens,
    ),
    safeIntegerProduct(
      BLUEPRINT_AUTHORING_COUNT_AWARE_COST_INPUTS.conservativePricing
        .outputRateNumeratorTenthsMicroUsd,
      BLUEPRINT_AUTHORING_COUNT_AWARE_COST_INPUTS.generation.maxOutputTokens,
    ),
  ]) /
    BLUEPRINT_AUTHORING_COUNT_AWARE_COST_INPUTS.conservativePricing.rateDivisor,
);

const MAX_SUCCESSFUL_PROBE_MICRO_USD = Math.ceil(
  safeIntegerProduct(
    BLUEPRINT_AUTHORING_COUNT_AWARE_COST_INPUTS.conservativePricing
      .inputRateNumeratorTenthsMicroUsd,
    BLUEPRINT_AUTHORING_COUNT_AWARE_COST_INPUTS.inputTokenProbe
      .maxSuccessfulInputTokens,
  ) /
    BLUEPRINT_AUTHORING_COUNT_AWARE_COST_INPUTS.conservativePricing.rateDivisor,
);

export const BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY = Object.freeze({
  ...BLUEPRINT_AUTHORING_COUNT_AWARE_COST_INPUTS,
  conservativePricing: Object.freeze({
    ...BLUEPRINT_AUTHORING_COUNT_AWARE_COST_INPUTS.conservativePricing,
  }),
  generation: Object.freeze({
    ...BLUEPRINT_AUTHORING_COUNT_AWARE_COST_INPUTS.generation,
    maxCallMicroUsd: MAX_GENERATION_MICRO_USD,
  }),
  inputTokenProbe: Object.freeze({
    ...BLUEPRINT_AUTHORING_COUNT_AWARE_COST_INPUTS.inputTokenProbe,
    maxSuccessfulProbeMicroUsd: MAX_SUCCESSFUL_PROBE_MICRO_USD,
  }),
} as const);

export const BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY_DIGEST =
  canonicalHash(BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY);

export const BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD =
  BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.hardCeilingMicroUsd;
export const BLUEPRINT_AUTHORING_MAX_GENERATION_MICRO_USD =
  BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.generation.maxCallMicroUsd;
export const BLUEPRINT_AUTHORING_MAX_SUCCESSFUL_PROBE_MICRO_USD =
  BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.inputTokenProbe
    .maxSuccessfulProbeMicroUsd;
/** OpenAI large-prompt threshold: inputs strictly ABOVE this bill 2x input for the whole request. */
export const BLUEPRINT_AUTHORING_LARGE_PROMPT_INPUT_TOKEN_THRESHOLD =
  BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.inputTokenProbe
    .largePromptInputTokenThreshold;
export const BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_GENERATION_CALLS =
  BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.generation.maxCalls;
export const BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_PROBE_ROUTES =
  BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.inputTokenProbe.maxRoutes;

function nonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function safeIntegerSum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    if (!nonNegativeSafeInteger(value) || total > Number.MAX_SAFE_INTEGER - value) {
      throw new Error('blueprint authoring micro-USD arithmetic overflow');
    }
    total += value;
  }
  return total;
}

function safeIntegerProduct(left: number, right: number): number {
  if (
    !nonNegativeSafeInteger(left) ||
    !nonNegativeSafeInteger(right) ||
    (left !== 0 && right > Math.floor(Number.MAX_SAFE_INTEGER / left))
  ) {
    throw new Error('blueprint authoring micro-USD arithmetic overflow');
  }
  return left * right;
}

function blueprintAuthoringLargePromptInputMultiplier(
  inputTokens: number,
): number {
  const authority =
    BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.inputTokenProbe;
  if (authority.largePromptThresholdComparison !== 'strictly_above') {
    throw new Error('blueprint authoring large-prompt comparison is invalid');
  }
  return inputTokens > authority.largePromptInputTokenThreshold
    ? authority.largePromptInputMultiplier
    : 1;
}

/**
 * Q(U): conservative input-only micro-USD cost of a request whose input is `inputTokens` tokens.
 * Fail-closed: throws on an invalid token count so a malformed value can never under-reserve.
 */
export function blueprintAuthoringInputMicroUsd(inputTokens: number): number {
  if (!nonNegativeSafeInteger(inputTokens)) {
    throw new Error('blueprint authoring input token count is invalid');
  }
  const pricing =
    BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.conservativePricing;
  const multiplier = blueprintAuthoringLargePromptInputMultiplier(inputTokens);
  return Math.ceil(
    safeIntegerProduct(
      safeIntegerProduct(
        pricing.inputRateNumeratorTenthsMicroUsd,
        multiplier,
      ),
      inputTokens,
    ) / pricing.rateDivisor,
  );
}

/**
 * Conservative generation cost in integer micro-USD. This is the exact integer twin of
 * `conservativeBlueprintAuthoringCostUsd` under the current price authority, but it never
 * round-trips through a floating-point USD value:
 *
 *   ceil((5 * input + 20 * output) * 1.1)
 *   = ceil((55 * input + 220 * output) / 10) micro-USD.
 */
export function blueprintAuthoringGenerationMicroUsd(args: {
  inputTokens: number;
  outputTokens: number;
}): number {
  if (
    !nonNegativeSafeInteger(args.inputTokens) ||
    !nonNegativeSafeInteger(args.outputTokens)
  ) {
    throw new Error('blueprint authoring generation token counts are invalid');
  }
  const pricing =
    BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY.conservativePricing;
  const numerator = safeIntegerSum([
    safeIntegerProduct(
      pricing.inputRateNumeratorTenthsMicroUsd,
      args.inputTokens,
    ),
    safeIntegerProduct(
      pricing.outputRateNumeratorTenthsMicroUsd,
      args.outputTokens,
    ),
  ]);
  return Math.ceil(numerator / pricing.rateDivisor);
}

export interface BlueprintAuthoringProbeReservation {
  /** A — conservative micro-USD already accounted (completed generations + prior probes). */
  accountedMicroUsd: number;
  /** U — the proven conservative input-token upper bound of the repair wire being probed. */
  provenUpperBoundTokens: number;
  /** g — remaining generation calls INCLUDING the current repair's generation. */
  remainingGenerationCalls: number;
  /** pAfter — later repair routes that could still each need a successful probe. */
  laterProbeRoutes: number;
}

/**
 * Worst-case reservation for the two MUTUALLY-EXCLUSIVE branches of dispatching one probe:
 *  - terminal-failure branch: the probe is billed at worst Q(U) and the run terminates;
 *  - admitted-continuation branch: the probe is billed at worst S (a successful <=64K count),
 *    then g remaining generation calls (each <= G) plus pAfter later probes (each <= S) run.
 * The probe may be dispatched only if
 *   A + max(Q(U), S + g*G + pAfter*S) <= H.
 * Fail-closed on any invalid/out-of-range field.
 */
export function blueprintAuthoringProbeReservationMicroUsd(
  input: BlueprintAuthoringProbeReservation,
): number {
  if (
    !nonNegativeSafeInteger(input.accountedMicroUsd) ||
    !nonNegativeSafeInteger(input.provenUpperBoundTokens) ||
    !Number.isSafeInteger(input.remainingGenerationCalls) ||
    input.remainingGenerationCalls < 0 ||
    input.remainingGenerationCalls > BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_GENERATION_CALLS ||
    !Number.isSafeInteger(input.laterProbeRoutes) ||
    input.laterProbeRoutes < 0 ||
    input.laterProbeRoutes > BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_PROBE_ROUTES
  ) {
    throw new Error('blueprint authoring probe reservation inputs are invalid');
  }
  const failureBranch = blueprintAuthoringInputMicroUsd(input.provenUpperBoundTokens);
  const continuationBranch = safeIntegerSum([
    BLUEPRINT_AUTHORING_MAX_SUCCESSFUL_PROBE_MICRO_USD,
    safeIntegerProduct(
      input.remainingGenerationCalls,
      BLUEPRINT_AUTHORING_MAX_GENERATION_MICRO_USD,
    ),
    safeIntegerProduct(
      input.laterProbeRoutes,
      BLUEPRINT_AUTHORING_MAX_SUCCESSFUL_PROBE_MICRO_USD,
    ),
  ]);
  return safeIntegerSum([
    input.accountedMicroUsd,
    Math.max(failureBranch, continuationBranch),
  ]);
}

export function blueprintAuthoringProbeReservationIsWithinCeiling(
  input: BlueprintAuthoringProbeReservation,
): boolean {
  if (
    !nonNegativeSafeInteger(input.accountedMicroUsd) ||
    !nonNegativeSafeInteger(input.provenUpperBoundTokens) ||
    !Number.isSafeInteger(input.remainingGenerationCalls) ||
    input.remainingGenerationCalls < 0 ||
    input.remainingGenerationCalls > BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_GENERATION_CALLS ||
    !Number.isSafeInteger(input.laterProbeRoutes) ||
    input.laterProbeRoutes < 0 ||
    input.laterProbeRoutes > BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_PROBE_ROUTES
  ) {
    return false;
  }
  try {
    return (
      blueprintAuthoringProbeReservationMicroUsd(input) <=
      BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD
    );
  } catch {
    return false;
  }
}

export function blueprintAuthoringContinuationReservationMicroUsd(args: {
  accountedMicroUsd: number;
  remainingGenerationCalls: number;
  laterProbeRoutes: number;
}): number {
  if (
    !nonNegativeSafeInteger(args.accountedMicroUsd) ||
    !Number.isSafeInteger(args.remainingGenerationCalls) ||
    args.remainingGenerationCalls < 0 ||
    args.remainingGenerationCalls > BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_GENERATION_CALLS ||
    !Number.isSafeInteger(args.laterProbeRoutes) ||
    args.laterProbeRoutes < 0 ||
    args.laterProbeRoutes > BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_PROBE_ROUTES
  ) {
    throw new Error('blueprint authoring continuation reservation inputs are invalid');
  }
  return safeIntegerSum([
    args.accountedMicroUsd,
    safeIntegerProduct(
      args.remainingGenerationCalls,
      BLUEPRINT_AUTHORING_MAX_GENERATION_MICRO_USD,
    ),
    safeIntegerProduct(
      args.laterProbeRoutes,
      BLUEPRINT_AUTHORING_MAX_SUCCESSFUL_PROBE_MICRO_USD,
    ),
  ]);
}

export type BlueprintAuthoringProbeDebitOutcome =
  | 'counted'
  | 'malformed_after_dispatch'
  | 'failed_before_dispatch';

/**
 * The micro-USD to DEBIT for a probe by outcome:
 *  - counted (exact `n`): Q(n) — the probe's real input-only cost;
 *  - malformed/failure AFTER dispatch: Q(U) — worst case, the exact count is unknown;
 *  - failure BEFORE dispatch: 0 — no bytes crossed the wire.
 */
export function blueprintAuthoringProbeDebitMicroUsd(args: {
  outcome: BlueprintAuthoringProbeDebitOutcome;
  exactInputTokens?: number;
  provenUpperBoundTokens: number;
}): number {
  if (args.outcome === 'failed_before_dispatch') return 0;
  if (args.outcome === 'counted') {
    if (!nonNegativeSafeInteger(args.exactInputTokens)) {
      throw new Error('counted probe requires an exact input token count');
    }
    return blueprintAuthoringInputMicroUsd(args.exactInputTokens);
  }
  return blueprintAuthoringInputMicroUsd(args.provenUpperBoundTokens);
}

/**
 * Sanity anchors bound to the existing constants so a future price/budget drift trips a test:
 * G and S must equal the derived generation/probe maxima, and the fully-admitted worst case
 * (3 generations + 2 successful probes) must equal $4.928, $0.072 under the $5 ceiling.
 */
export function blueprintAuthoringFullyAdmittedWorstCaseMicroUsd(): number {
  return safeIntegerSum([
    safeIntegerProduct(
      BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_GENERATION_CALLS,
      BLUEPRINT_AUTHORING_MAX_GENERATION_MICRO_USD,
    ),
    safeIntegerProduct(
      BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_PROBE_ROUTES,
      BLUEPRINT_AUTHORING_MAX_SUCCESSFUL_PROBE_MICRO_USD,
    ),
  ]);
}
