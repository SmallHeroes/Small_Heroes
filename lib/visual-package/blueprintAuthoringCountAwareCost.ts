import {
  BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
  BLUEPRINT_AUTHORING_MAX_CALLS,
  BLUEPRINT_AUTHORING_MAX_REPAIRS,
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
  blueprintAuthoringCountProbeReserveUsd,
  conservativeBlueprintAuthoringCostUsd,
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

export const BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD = Math.round(
  BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD * 1_000_000,
);
export const BLUEPRINT_AUTHORING_MAX_GENERATION_MICRO_USD = Math.round(
  conservativeBlueprintAuthoringCostUsd({
    inputTokens: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
    outputTokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
  }) * 1_000_000,
);
export const BLUEPRINT_AUTHORING_MAX_SUCCESSFUL_PROBE_MICRO_USD = Math.round(
  blueprintAuthoringCountProbeReserveUsd() * 1_000_000,
);
/** OpenAI large-prompt threshold: inputs strictly ABOVE this bill 2x input for the whole request. */
export const BLUEPRINT_AUTHORING_LARGE_PROMPT_INPUT_TOKEN_THRESHOLD = 272_000;

// 3 generation calls, 2 probe routes under the current budget (kept local so this cost cutover
// is isolated from the generation-policy constants and does not weaken legacy v6 evidence).
export const BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_GENERATION_CALLS =
  BLUEPRINT_AUTHORING_MAX_CALLS;
export const BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_PROBE_ROUTES =
  BLUEPRINT_AUTHORING_MAX_REPAIRS;

const CACHE_WRITE_INPUT_MICRO_USD_PER_TOKEN_X2_UPLIFT = 11; // 5 (cache-write) * 1.1 uplift * 2

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

/**
 * Q(U): conservative input-only micro-USD cost of a request whose input is `inputTokens` tokens.
 * Fail-closed: throws on an invalid token count so a malformed value can never under-reserve.
 */
export function blueprintAuthoringInputMicroUsd(inputTokens: number): number {
  if (!nonNegativeSafeInteger(inputTokens)) {
    throw new Error('blueprint authoring input token count is invalid');
  }
  if (inputTokens <= BLUEPRINT_AUTHORING_LARGE_PROMPT_INPUT_TOKEN_THRESHOLD) {
    // ceil(11*U/2) — integer arithmetic (no float 5.5).
    return Math.ceil(
      safeIntegerProduct(
        CACHE_WRITE_INPUT_MICRO_USD_PER_TOKEN_X2_UPLIFT,
        inputTokens,
      ) / 2,
    );
  }
  return safeIntegerProduct(
    CACHE_WRITE_INPUT_MICRO_USD_PER_TOKEN_X2_UPLIFT,
    inputTokens,
  );
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
