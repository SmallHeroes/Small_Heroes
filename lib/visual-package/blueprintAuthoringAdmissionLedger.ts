import {
  BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
  BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING,
  blueprintAuthoringCountRequestProjection,
  blueprintAuthoringCountResultConsumptionReason,
  blueprintAuthoringTokenRelevantRequestProjection,
  type BlueprintAuthoringExactInputTokenCountResult,
  type BlueprintAuthoringInputTokenAdmissionBasis,
  type BlueprintAuthoringInputTokenCountRequest,
} from './blueprintAuthoringInputTokenAdmission';
import {
  BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_GENERATION_CALLS,
  BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_PROBE_ROUTES,
  BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD,
  blueprintAuthoringContinuationReservationMicroUsd,
  blueprintAuthoringInputMicroUsd,
  blueprintAuthoringProbeReservationMicroUsd,
} from './blueprintAuthoringCountAwareCost';
import {
  BLUEPRINT_AUTHORING_MODEL,
  blueprintAuthoringInputAccounting,
  blueprintAuthoringInputAccountingIsValid,
  type BlueprintAuthoringInputAccounting,
} from './blueprintAuthoringPolicy';
import { canonicalJsonDigest } from './integrity';

export const BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION =
  'blueprint-authoring-admission-ledger/v1' as const;

/**
 * Frozen validation inputs for admission-ledger/v1 as emitted by receipt v7 and
 * capture v3. Current runtime policy may only move by cutting a new evidence
 * version; immutable v7/v3 bytes must never be reinterpreted through future
 * model, ceiling, pricing, or count-attestation constants.
 */
export const LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY = Object.freeze({
  model: 'gpt-5.6-sol',
  countEvidenceVersion: 'openai-responses-input-tokens-count-evidence/v1',
  inputTokenCeiling: 64_000,
  inputAccountingProtocolAllowance: 4_096,
  maxGenerationCalls: 3,
  maxProbeRoutes: 2,
  hardCeilingMicroUsd: 5_000_000,
  inputRateNumeratorTenthsMicroUsd: 55,
  outputRateNumeratorTenthsMicroUsd: 220,
  rateDivisor: 10,
  largePromptInputTokenThreshold: 272_000,
  largePromptInputMultiplier: 2,
  maxGenerationMicroUsd: 1_408_000,
  maxSuccessfulProbeMicroUsd: 352_000,
} as const);

interface AdmissionLedgerValidationPolicy {
  model: string;
  countEvidenceVersion: string;
  inputTokenCeiling: number;
  maxGenerationCalls: number;
  maxProbeRoutes: number;
  hardCeilingMicroUsd: number;
  inputAccountingIsValid(value: unknown): value is BlueprintAuthoringInputAccounting;
  inputMicroUsd(inputTokens: number): number;
  probeReservationMicroUsd(args: {
    accountedMicroUsd: number;
    provenUpperBoundTokens: number;
    remainingGenerationCalls: number;
    laterProbeRoutes: number;
  }): number;
  continuationReservationMicroUsd(args: {
    accountedMicroUsd: number;
    remainingGenerationCalls: number;
    laterProbeRoutes: number;
  }): number;
}

export type BlueprintAuthoringAdmissionFailureReason =
  | 'input_token_ceiling_exceeded'
  | 'exact_count_unavailable'
  | 'cost_ceiling_exceeded';

export type BlueprintAuthoringCountProbeStatus =
  | 'not_required'
  | 'not_wired'
  | 'reservation_rejected'
  | 'cache_miss'
  | 'cache_hit';

export type BlueprintAuthoringCountTransportDisposition =
  | 'not_dispatched'
  | 'dispatched'
  | 'assumed_dispatched';

/**
 * One count consultation as observed by the runner. `assumed_dispatched` is intentionally
 * conservative: once an injected source was invoked, missing/hostile transport evidence may
 * never be interpreted as a free pre-dispatch failure.
 */
export interface BlueprintAuthoringProbeCostEvidence {
  status: BlueprintAuthoringCountProbeStatus;
  reservationBeforeDispatchMicroUsd: number | null;
  debitMicroUsd: number;
  cumulativeDebitMicroUsd: number;
  transportDisposition: BlueprintAuthoringCountTransportDisposition;
}

interface BlueprintAuthoringAdmissionDecisionRecordBase {
  version: typeof BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION;
  routeKind: 'initial' | 'repair';
  /** Initial is ordinal 0; repairs are exactly 1 and 2. */
  ordinal: 0 | 1 | 2;
  /** The generation attempt that this route would authorize: initial=1, repair N=N+1. */
  generationAttempt: 1 | 2 | 3;
  tokenRelevantRequestDigest: string;
  inputAccounting: BlueprintAuthoringInputAccounting;
  inputAccountingDigest: string;
  basis: Exclude<BlueprintAuthoringInputTokenAdmissionBasis, 'invalid_accounting'>;
  ceilingTokens: number;
  conservativeUpperBoundTokens: number;
  exactInputTokens: number | null;
  countResult: BlueprintAuthoringExactInputTokenCountResult | null;
  probe: BlueprintAuthoringProbeCostEvidence;
  /** Completed generation cost only, before this route. */
  generationAccountedMicroUsdBeforeRoute: number;
  /** Completed generation cost + cumulative count-probe debit, before generation dispatch. */
  totalAccountedMicroUsdBeforeGeneration: number;
}

export type BlueprintAuthoringAdmissionDecisionRecord =
  | (BlueprintAuthoringAdmissionDecisionRecordBase & {
      admitted: true;
      continuationReservationMicroUsd: number;
      failureReason: null;
    })
  | (BlueprintAuthoringAdmissionDecisionRecordBase & {
      admitted: false;
      continuationReservationMicroUsd: number | null;
      failureReason: BlueprintAuthoringAdmissionFailureReason;
    });

export interface BlueprintAuthoringAdmissionDecisionExpectation {
  attempt: 1 | 2 | 3;
  kind: 'initial' | 'repair';
  systemPrompt: string;
  userPrompt: string;
  model: string;
  reasoningEffort: string;
  schemaName: string;
  schema: Record<string, unknown>;
  generationAccountedMicroUsdBeforeRoute: number;
  priorProbeCumulativeDebitMicroUsd: number;
  remainingGenerationCalls: number;
  laterProbeRoutes: number;
  requireAdmitted?: boolean;
}

const ADMISSION_DECISION_KEYS = [
  'admitted',
  'basis',
  'ceilingTokens',
  'conservativeUpperBoundTokens',
  'continuationReservationMicroUsd',
  'countResult',
  'exactInputTokens',
  'failureReason',
  'generationAccountedMicroUsdBeforeRoute',
  'generationAttempt',
  'inputAccounting',
  'inputAccountingDigest',
  'ordinal',
  'probe',
  'routeKind',
  'tokenRelevantRequestDigest',
  'totalAccountedMicroUsdBeforeGeneration',
  'version',
] as const;

const PROBE_EVIDENCE_KEYS = [
  'cumulativeDebitMicroUsd',
  'debitMicroUsd',
  'reservationBeforeDispatchMicroUsd',
  'status',
  'transportDisposition',
] as const;

function exactObjectKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
  );
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function legacyAdmissionInputAccountingIsValid(
  value: unknown,
): value is BlueprintAuthoringInputAccounting {
  if (!exactObjectKeys(value, [
    'estimatedBytes',
    'protocolAllowance',
    'schemaBytes',
    'separatorBytes',
    'systemBytes',
    'userBytes',
  ])) return false;
  const fields = [
    value.systemBytes,
    value.userBytes,
    value.schemaBytes,
    value.separatorBytes,
    value.estimatedBytes,
  ];
  if (!fields.every(nonNegativeSafeInteger)) return false;
  if (
    value.protocolAllowance !==
    LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY
      .inputAccountingProtocolAllowance
  ) return false;
  const systemAndUser = safeSum(
    value.systemBytes as number,
    value.userBytes as number,
  );
  if (systemAndUser === null) return false;
  const withSchema = safeSum(systemAndUser, value.schemaBytes as number);
  if (withSchema === null) return false;
  const expected = safeSum(withSchema, value.separatorBytes as number);
  const withAllowance =
    expected === null
      ? null
      : safeSum(
          expected,
          LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY
            .inputAccountingProtocolAllowance,
        );
  return withAllowance !== null && value.estimatedBytes === withAllowance;
}

function legacyAdmissionInputMicroUsd(inputTokens: number): number {
  if (!nonNegativeSafeInteger(inputTokens)) {
    throw new Error('legacy admission input token count is invalid');
  }
  const policy = LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY;
  const multiplier =
    inputTokens > policy.largePromptInputTokenThreshold
      ? policy.largePromptInputMultiplier
      : 1;
  const numerator = safeProduct(
    safeProduct(policy.inputRateNumeratorTenthsMicroUsd, multiplier),
    inputTokens,
  );
  return Math.ceil(numerator / policy.rateDivisor);
}

export function legacyBlueprintAuthoringAdmissionLedgerGenerationMicroUsd(args: {
  inputTokens: number;
  outputTokens: number;
}): number {
  if (
    !nonNegativeSafeInteger(args.inputTokens) ||
    !nonNegativeSafeInteger(args.outputTokens)
  ) {
    throw new Error('legacy admission generation token counts are invalid');
  }
  const policy = LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY;
  const input = safeProduct(
    policy.inputRateNumeratorTenthsMicroUsd,
    args.inputTokens,
  );
  const output = safeProduct(
    policy.outputRateNumeratorTenthsMicroUsd,
    args.outputTokens,
  );
  const numerator = safeSum(input, output);
  if (numerator === null) {
    throw new Error('legacy admission generation cost overflow');
  }
  return Math.ceil(numerator / policy.rateDivisor);
}

function legacyAdmissionProbeReservationMicroUsd(args: {
  accountedMicroUsd: number;
  provenUpperBoundTokens: number;
  remainingGenerationCalls: number;
  laterProbeRoutes: number;
}): number {
  const policy = LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY;
  if (
    !nonNegativeSafeInteger(args.accountedMicroUsd) ||
    !nonNegativeSafeInteger(args.provenUpperBoundTokens) ||
    !Number.isSafeInteger(args.remainingGenerationCalls) ||
    args.remainingGenerationCalls < 0 ||
    args.remainingGenerationCalls > policy.maxGenerationCalls ||
    !Number.isSafeInteger(args.laterProbeRoutes) ||
    args.laterProbeRoutes < 0 ||
    args.laterProbeRoutes > policy.maxProbeRoutes
  ) {
    throw new Error('legacy admission probe reservation inputs are invalid');
  }
  const failureBranch = legacyAdmissionInputMicroUsd(
    args.provenUpperBoundTokens,
  );
  const futureGenerations = safeProduct(
    args.remainingGenerationCalls,
    policy.maxGenerationMicroUsd,
  );
  const futureProbes = safeProduct(
    args.laterProbeRoutes,
    policy.maxSuccessfulProbeMicroUsd,
  );
  const continuationTail = safeSum(
    safeSum(policy.maxSuccessfulProbeMicroUsd, futureGenerations) ?? -1,
    futureProbes,
  );
  if (continuationTail === null) {
    throw new Error('legacy admission probe reservation overflow');
  }
  const total = safeSum(
    args.accountedMicroUsd,
    Math.max(failureBranch, continuationTail),
  );
  if (total === null) {
    throw new Error('legacy admission probe reservation overflow');
  }
  return total;
}

function legacyAdmissionContinuationReservationMicroUsd(args: {
  accountedMicroUsd: number;
  remainingGenerationCalls: number;
  laterProbeRoutes: number;
}): number {
  const policy = LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY;
  if (
    !nonNegativeSafeInteger(args.accountedMicroUsd) ||
    !Number.isSafeInteger(args.remainingGenerationCalls) ||
    args.remainingGenerationCalls < 0 ||
    args.remainingGenerationCalls > policy.maxGenerationCalls ||
    !Number.isSafeInteger(args.laterProbeRoutes) ||
    args.laterProbeRoutes < 0 ||
    args.laterProbeRoutes > policy.maxProbeRoutes
  ) {
    throw new Error('legacy admission continuation inputs are invalid');
  }
  const futureGenerations = safeProduct(
    args.remainingGenerationCalls,
    policy.maxGenerationMicroUsd,
  );
  const futureProbes = safeProduct(
    args.laterProbeRoutes,
    policy.maxSuccessfulProbeMicroUsd,
  );
  const withGenerations = safeSum(args.accountedMicroUsd, futureGenerations);
  const total =
    withGenerations === null ? null : safeSum(withGenerations, futureProbes);
  if (total === null) {
    throw new Error('legacy admission continuation overflow');
  }
  return total;
}

const CURRENT_ADMISSION_LEDGER_VALIDATION_POLICY: AdmissionLedgerValidationPolicy = {
  model: BLUEPRINT_AUTHORING_MODEL,
  countEvidenceVersion: BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
  inputTokenCeiling: BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING,
  maxGenerationCalls: BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_GENERATION_CALLS,
  maxProbeRoutes: BLUEPRINT_AUTHORING_COUNT_AWARE_MAX_PROBE_ROUTES,
  hardCeilingMicroUsd: BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD,
  inputAccountingIsValid: blueprintAuthoringInputAccountingIsValid,
  inputMicroUsd: blueprintAuthoringInputMicroUsd,
  probeReservationMicroUsd: blueprintAuthoringProbeReservationMicroUsd,
  continuationReservationMicroUsd:
    blueprintAuthoringContinuationReservationMicroUsd,
};

const LEGACY_ADMISSION_LEDGER_V1_VALIDATION_POLICY: AdmissionLedgerValidationPolicy = {
  model: LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY.model,
  countEvidenceVersion:
    LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY.countEvidenceVersion,
  inputTokenCeiling:
    LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY.inputTokenCeiling,
  maxGenerationCalls:
    LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY.maxGenerationCalls,
  maxProbeRoutes:
    LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY.maxProbeRoutes,
  hardCeilingMicroUsd:
    LEGACY_BLUEPRINT_AUTHORING_ADMISSION_LEDGER_V1_POLICY.hardCeilingMicroUsd,
  inputAccountingIsValid: legacyAdmissionInputAccountingIsValid,
  inputMicroUsd: legacyAdmissionInputMicroUsd,
  probeReservationMicroUsd: legacyAdmissionProbeReservationMicroUsd,
  continuationReservationMicroUsd:
    legacyAdmissionContinuationReservationMicroUsd,
};

const HEX_SHA256 = /^[a-f0-9]{64}$/;

const COUNT_RESULT_KEYS = [
  'attestation',
  'countRequestDigest',
  'inputTokens',
  'outcome',
  'repairOrdinal',
  'routeKind',
  'unavailableReason',
] as const;

const COUNT_ATTESTATION_KEYS = [
  'canonicalModelConfirmed',
  'canonicalRouteConfirmed',
  'evidenceVersion',
  'model',
  'provider',
  'route',
  'transportDispatchCount',
  'transportRetryCount',
] as const;

const COUNT_UNAVAILABLE_REASONS = new Set([
  'not_wired',
  'count_model_unconfirmed',
  'count_transport_failed',
  'count_route_unconfirmed',
  'count_response_invalid',
  'count_evidence_invalid',
  'count_cost_reservation_exceeded',
]);

function countResultStructuralReason(args: {
  value: unknown;
  ordinal: 1 | 2;
  upperBound: number;
  tokenRelevantRequestDigest: string;
  policy: AdmissionLedgerValidationPolicy;
}): string | null {
  if (!exactObjectKeys(args.value, COUNT_RESULT_KEYS)) {
    return 'admission_count_shape_invalid';
  }
  const value = args.value;
  if (
    value.routeKind !== 'repair' ||
    value.repairOrdinal !== args.ordinal ||
    value.countRequestDigest !== args.tokenRelevantRequestDigest
  ) {
    return 'admission_count_identity_invalid';
  }
  const attestation = value.attestation;
  if (attestation !== null) {
    if (
      !exactObjectKeys(attestation, COUNT_ATTESTATION_KEYS) ||
      attestation.provider !== 'openai' ||
      attestation.model !== args.policy.model ||
      attestation.route !== 'responses_input_tokens' ||
      attestation.evidenceVersion !== args.policy.countEvidenceVersion ||
      (attestation.transportDispatchCount !== 0 &&
        attestation.transportDispatchCount !== 1) ||
      attestation.transportRetryCount !== 0 ||
      typeof attestation.canonicalRouteConfirmed !== 'boolean' ||
      typeof attestation.canonicalModelConfirmed !== 'boolean'
    ) {
      return 'admission_count_attestation_invalid';
    }
  }
  if (value.outcome === 'counted') {
    if (
      !nonNegativeSafeInteger(value.inputTokens) ||
      value.inputTokens > args.upperBound ||
      value.unavailableReason !== null ||
      !exactObjectKeys(attestation, COUNT_ATTESTATION_KEYS) ||
      attestation.transportDispatchCount !== 1 ||
      attestation.transportRetryCount !== 0 ||
      attestation.canonicalRouteConfirmed !== true ||
      attestation.canonicalModelConfirmed !== true
    ) {
      return 'admission_count_disposition_invalid';
    }
    return null;
  }
  if (
    value.outcome !== 'unavailable' ||
    value.inputTokens !== null ||
    typeof value.unavailableReason !== 'string' ||
    !COUNT_UNAVAILABLE_REASONS.has(value.unavailableReason)
  ) {
    return 'admission_count_disposition_invalid';
  }
  if (
    (value.unavailableReason === 'count_response_invalid' ||
      value.unavailableReason === 'count_route_unconfirmed') &&
    attestation === null
  ) {
    return 'admission_count_attestation_invalid';
  }
  return null;
}

function blueprintAuthoringAdmissionLedgerStructuralReasonWithPolicy(
  value: unknown,
  policy: AdmissionLedgerValidationPolicy,
): string | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length > policy.maxGenerationCalls
    ) {
      return 'admission_ledger_shape_invalid';
    }
    let priorProbeCumulative = 0;
    let rejected = false;
    for (let index = 0; index < value.length; index += 1) {
      const raw = value[index];
      if (
        !exactObjectKeys(raw, ADMISSION_DECISION_KEYS) ||
        !exactObjectKeys(raw.probe, PROBE_EVIDENCE_KEYS)
      ) {
        return 'admission_shape_invalid';
      }
      const decision = raw as unknown as BlueprintAuthoringAdmissionDecisionRecord;
      const ordinal = index as 0 | 1 | 2;
      if (
        decision.version !== BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION ||
        decision.ordinal !== ordinal ||
        decision.generationAttempt !== ordinal + 1 ||
        decision.routeKind !== (ordinal === 0 ? 'initial' : 'repair') ||
        decision.ceilingTokens !== policy.inputTokenCeiling ||
        typeof decision.tokenRelevantRequestDigest !== 'string' ||
        !HEX_SHA256.test(decision.tokenRelevantRequestDigest) ||
        !policy.inputAccountingIsValid(decision.inputAccounting) ||
        decision.inputAccountingDigest !==
          canonicalJsonDigest(decision.inputAccounting) ||
        decision.conservativeUpperBoundTokens !==
          decision.inputAccounting.estimatedBytes ||
        !nonNegativeSafeInteger(decision.generationAccountedMicroUsdBeforeRoute) ||
        !nonNegativeSafeInteger(decision.probe.debitMicroUsd) ||
        !nonNegativeSafeInteger(decision.probe.cumulativeDebitMicroUsd)
      ) {
        return 'admission_identity_invalid';
      }
      if (rejected) return 'admission_after_rejection_invalid';
      const upperBound = decision.conservativeUpperBoundTokens;
      let tokenAdmitted = false;
      let tokenFailure: BlueprintAuthoringAdmissionFailureReason | null = null;
      let expectedDebit = 0;
      let expectedTransport: BlueprintAuthoringCountTransportDisposition =
        'not_dispatched';
      const accountedBeforeProbe = safeSum(
        decision.generationAccountedMicroUsdBeforeRoute,
        priorProbeCumulative,
      );
      if (accountedBeforeProbe === null) return 'admission_cost_state_invalid';
      const remainingGenerationCalls = policy.maxGenerationCalls - ordinal;
      const laterProbeRoutes = policy.maxProbeRoutes - ordinal;
      const expectedProbeReservation =
        upperBound > policy.inputTokenCeiling
          ? policy.probeReservationMicroUsd({
              accountedMicroUsd: accountedBeforeProbe,
              provenUpperBoundTokens: upperBound,
              remainingGenerationCalls,
              laterProbeRoutes,
            })
          : null;

      if (upperBound <= policy.inputTokenCeiling) {
        if (
          decision.basis !== 'conservative_upper_bound' ||
          decision.exactInputTokens !== null ||
          decision.countResult !== null ||
          decision.probe.status !== 'not_required' ||
          decision.probe.reservationBeforeDispatchMicroUsd !== null
        ) {
          return 'admission_basis_invalid';
        }
        tokenAdmitted = true;
      } else {
        if (ordinal === 0) return 'admission_initial_exact_count_invalid';
        if (decision.countResult !== null) {
          const countReason = countResultStructuralReason({
            value: decision.countResult,
            ordinal: ordinal as 1 | 2,
            upperBound,
            tokenRelevantRequestDigest: decision.tokenRelevantRequestDigest,
            policy,
          });
          if (countReason !== null) return countReason;
        }
        if (
          decision.basis === 'exact_provider_count' &&
          decision.countResult?.outcome === 'counted' &&
          decision.exactInputTokens === decision.countResult.inputTokens &&
          nonNegativeSafeInteger(decision.exactInputTokens)
        ) {
          tokenAdmitted =
            decision.exactInputTokens <= policy.inputTokenCeiling;
          if (!tokenAdmitted) tokenFailure = 'input_token_ceiling_exceeded';
        } else if (
          decision.basis === 'exact_count_unavailable' &&
          decision.exactInputTokens === null &&
          decision.countResult?.outcome === 'unavailable'
        ) {
          tokenFailure =
            decision.countResult.unavailableReason ===
            'count_cost_reservation_exceeded'
              ? 'cost_ceiling_exceeded'
              : 'exact_count_unavailable';
        } else {
          return 'admission_basis_invalid';
        }

        if (decision.probe.status === 'not_wired') {
          if (
            decision.countResult?.unavailableReason !== 'not_wired' ||
            decision.probe.reservationBeforeDispatchMicroUsd !== null
          ) return 'admission_probe_invalid';
        } else if (decision.probe.status === 'reservation_rejected') {
          if (
            expectedProbeReservation === null ||
            expectedProbeReservation <= policy.hardCeilingMicroUsd ||
            decision.probe.reservationBeforeDispatchMicroUsd !==
              expectedProbeReservation ||
            decision.countResult?.unavailableReason !==
              'count_cost_reservation_exceeded'
          ) return 'admission_probe_invalid';
        } else if (decision.probe.status === 'cache_miss') {
          if (
            expectedProbeReservation === null ||
            expectedProbeReservation > policy.hardCeilingMicroUsd ||
            decision.probe.reservationBeforeDispatchMicroUsd !==
              expectedProbeReservation ||
            decision.countResult === null
          ) return 'admission_probe_invalid';
          expectedDebit =
            decision.countResult.outcome === 'counted'
              ? policy.inputMicroUsd(
                  decision.countResult.inputTokens as number,
                )
              : policy.inputMicroUsd(upperBound);
          expectedTransport = blueprintAuthoringCountResultTransportWasDispatched(
            decision.countResult,
          )
            ? 'dispatched'
            : 'assumed_dispatched';
        } else {
          return 'admission_probe_invalid';
        }
      }

      const expectedCumulative = safeSum(priorProbeCumulative, expectedDebit);
      if (
        expectedCumulative === null ||
        decision.probe.debitMicroUsd !== expectedDebit ||
        decision.probe.cumulativeDebitMicroUsd !== expectedCumulative ||
        decision.probe.transportDisposition !== expectedTransport
      ) {
        return 'admission_probe_cost_invalid';
      }
      const expectedTotal = safeSum(
        decision.generationAccountedMicroUsdBeforeRoute,
        expectedCumulative,
      );
      if (
        expectedTotal === null ||
        decision.totalAccountedMicroUsdBeforeGeneration !== expectedTotal
      ) return 'admission_total_cost_invalid';
      let expectedContinuation: number | null = null;
      let expectedFailure = tokenFailure;
      if (tokenAdmitted) {
        expectedContinuation = policy.continuationReservationMicroUsd({
          accountedMicroUsd: expectedTotal,
          remainingGenerationCalls,
          laterProbeRoutes,
        });
        if (expectedContinuation > policy.hardCeilingMicroUsd) {
          expectedFailure = 'cost_ceiling_exceeded';
        }
      }
      const expectedAdmitted = tokenAdmitted && expectedFailure === null;
      if (
        decision.admitted !== expectedAdmitted ||
        decision.failureReason !== expectedFailure ||
        decision.continuationReservationMicroUsd !== expectedContinuation
      ) return 'admission_disposition_invalid';
      rejected = !decision.admitted;
      priorProbeCumulative = expectedCumulative;
    }
    return null;
  } catch {
    return 'admission_ledger_validation_failed';
  }
}

/**
 * Durable, prompt-free validation for the exact admission ledger stored in current receipt
 * v8/capture v4. Runtime consumption still uses the stronger prompt-aware validator below;
 * this validator proves the persisted exact-key shapes, route topology, count evidence,
 * rolling probe debit, and every integer-cost/disposition equation without persisting prompts.
 */
export function blueprintAuthoringAdmissionLedgerStructuralReason(
  value: unknown,
): string | null {
  return blueprintAuthoringAdmissionLedgerStructuralReasonWithPolicy(
    value,
    CURRENT_ADMISSION_LEDGER_VALIDATION_POLICY,
  );
}

/** Frozen receipt-v7/capture-v3 admission-ledger/v1 interpretation. */
export function legacyBlueprintAuthoringAdmissionLedgerV1StructuralReason(
  value: unknown,
): string | null {
  return blueprintAuthoringAdmissionLedgerStructuralReasonWithPolicy(
    value,
    LEGACY_ADMISSION_LEDGER_V1_VALIDATION_POLICY,
  );
}

function safeSum(left: number, right: number): number | null {
  return nonNegativeSafeInteger(left) &&
    nonNegativeSafeInteger(right) &&
    left <= Number.MAX_SAFE_INTEGER - right
    ? left + right
    : null;
}

function safeProduct(left: number, right: number): number {
  if (
    !nonNegativeSafeInteger(left) ||
    !nonNegativeSafeInteger(right) ||
    (right !== 0 && left > Math.floor(Number.MAX_SAFE_INTEGER / right))
  ) {
    throw new Error('admission cost multiplication overflow');
  }
  return left * right;
}

export function blueprintAuthoringCountCacheKey(
  request: BlueprintAuthoringInputTokenCountRequest,
): string {
  return `${request.routeKind}:${request.repairOrdinal}:${canonicalJsonDigest(
    blueprintAuthoringCountRequestProjection(request),
  )}`;
}

export function blueprintAuthoringCountResultTransportWasDispatched(
  result: unknown,
): boolean {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  const attestation = (result as { attestation?: unknown }).attestation;
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) {
    return false;
  }
  return (
    (attestation as { transportDispatchCount?: unknown }).transportDispatchCount === 1 &&
    (attestation as { transportRetryCount?: unknown }).transportRetryCount === 0
  );
}

export function blueprintAuthoringTokenRelevantRequestDigest(args: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  reasoningEffort: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): string {
  return canonicalJsonDigest(
    blueprintAuthoringTokenRelevantRequestProjection(args),
  );
}

/**
 * One exact fail-closed validator shared by the runner and canonical generation adapter.
 * It recomputes every identity/cost equation; the proof object is never trusted because it is
 * structurally typed. Returns null only for a fully coherent decision.
 */
export function blueprintAuthoringAdmissionDecisionConsumptionReason(
  value: unknown,
  expected: BlueprintAuthoringAdmissionDecisionExpectation,
): string | null {
  try {
    if (
      !exactObjectKeys(value, ADMISSION_DECISION_KEYS) ||
      !exactObjectKeys(value.probe, PROBE_EVIDENCE_KEYS)
    ) {
      return 'admission_shape_invalid';
    }
    const decision = value as unknown as BlueprintAuthoringAdmissionDecisionRecord;
    const ordinal = expected.kind === 'initial' ? 0 : expected.attempt - 1;
    if (
      decision.version !== BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION ||
      decision.routeKind !== expected.kind ||
      decision.ordinal !== ordinal ||
      decision.generationAttempt !== expected.attempt ||
      decision.ceilingTokens !== BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING
    ) {
      return 'admission_identity_invalid';
    }
    const accounting = blueprintAuthoringInputAccounting({
      systemPrompt: expected.systemPrompt,
      userPrompt: expected.userPrompt,
      schema: expected.schema,
    });
    if (
      !blueprintAuthoringInputAccountingIsValid(decision.inputAccounting) ||
      canonicalJsonDigest(decision.inputAccounting) !== canonicalJsonDigest(accounting) ||
      decision.inputAccountingDigest !== canonicalJsonDigest(accounting) ||
      decision.conservativeUpperBoundTokens !== accounting.estimatedBytes ||
      decision.tokenRelevantRequestDigest !==
        blueprintAuthoringTokenRelevantRequestDigest(expected)
    ) {
      return 'admission_request_binding_invalid';
    }
    if (
      !nonNegativeSafeInteger(expected.generationAccountedMicroUsdBeforeRoute) ||
      !nonNegativeSafeInteger(expected.priorProbeCumulativeDebitMicroUsd) ||
      decision.generationAccountedMicroUsdBeforeRoute !==
        expected.generationAccountedMicroUsdBeforeRoute ||
      !nonNegativeSafeInteger(decision.probe.debitMicroUsd) ||
      !nonNegativeSafeInteger(decision.probe.cumulativeDebitMicroUsd)
    ) {
      return 'admission_cost_state_invalid';
    }

    const upperBound = accounting.estimatedBytes;
    const countRequest: BlueprintAuthoringInputTokenCountRequest | null =
      expected.kind === 'repair'
        ? {
            routeKind: 'repair',
            repairOrdinal: ordinal as 1 | 2,
            systemPrompt: expected.systemPrompt,
            userPrompt: expected.userPrompt,
            schema: expected.schema,
            model: expected.model,
            reasoningEffort: expected.reasoningEffort,
            schemaName: expected.schemaName,
          }
        : null;
    let tokenAdmitted = false;
    let tokenFailure: BlueprintAuthoringAdmissionFailureReason | null = null;
    if (upperBound <= BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING) {
      if (
        decision.basis !== 'conservative_upper_bound' ||
        decision.exactInputTokens !== null ||
        decision.countResult !== null ||
        decision.probe.status !== 'not_required'
      ) {
        return 'admission_basis_invalid';
      }
      tokenAdmitted = true;
    } else if (!countRequest || decision.countResult === null) {
      if (
        decision.basis !== 'exact_count_unavailable' ||
        decision.exactInputTokens !== null
      ) {
        return 'admission_basis_invalid';
      }
      tokenFailure = 'exact_count_unavailable';
    } else {
      const countReason = blueprintAuthoringCountResultConsumptionReason(
        decision.countResult,
        countRequest,
        upperBound,
      );
      if (countReason === 'count_binding_mismatch') {
        return 'admission_count_binding_invalid';
      }
      if (countReason === null) {
        if (
          decision.basis !== 'exact_provider_count' ||
          decision.exactInputTokens !== decision.countResult.inputTokens ||
          !nonNegativeSafeInteger(decision.exactInputTokens)
        ) {
          return 'admission_basis_invalid';
        }
        tokenAdmitted =
          decision.exactInputTokens <= BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING;
        if (!tokenAdmitted) tokenFailure = 'input_token_ceiling_exceeded';
      } else {
        if (
          decision.basis !== 'exact_count_unavailable' ||
          decision.exactInputTokens !== null
        ) {
          return 'admission_basis_invalid';
        }
        tokenFailure =
          decision.countResult.unavailableReason === 'count_cost_reservation_exceeded'
            ? 'cost_ceiling_exceeded'
            : 'exact_count_unavailable';
      }
    }

    const probe = decision.probe;
    const priorProbe = expected.priorProbeCumulativeDebitMicroUsd;
    const accountedBeforeProbe = safeSum(
      expected.generationAccountedMicroUsdBeforeRoute,
      priorProbe,
    );
    if (accountedBeforeProbe === null) return 'admission_cost_state_invalid';
    const expectedProbeReservation =
      upperBound > BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING
        ? blueprintAuthoringProbeReservationMicroUsd({
            accountedMicroUsd: accountedBeforeProbe,
            provenUpperBoundTokens: upperBound,
            remainingGenerationCalls: expected.remainingGenerationCalls,
            laterProbeRoutes: expected.laterProbeRoutes,
          })
        : null;

    let expectedDebit = 0;
    let expectedTransport: BlueprintAuthoringCountTransportDisposition =
      'not_dispatched';
    if (probe.status === 'not_required') {
      if (
        upperBound > BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING ||
        probe.reservationBeforeDispatchMicroUsd !== null
      ) return 'admission_probe_invalid';
    } else if (probe.status === 'not_wired') {
      if (
        upperBound <= BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING ||
        decision.countResult?.outcome !== 'unavailable' ||
        decision.countResult.unavailableReason !== 'not_wired' ||
        probe.reservationBeforeDispatchMicroUsd !== null
      ) return 'admission_probe_invalid';
    } else if (probe.status === 'reservation_rejected') {
      if (
        expectedProbeReservation === null ||
        expectedProbeReservation <= BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD ||
        probe.reservationBeforeDispatchMicroUsd !== expectedProbeReservation ||
        decision.countResult?.outcome !== 'unavailable' ||
        decision.countResult.unavailableReason !== 'count_cost_reservation_exceeded'
      ) return 'admission_probe_invalid';
    } else if (probe.status === 'cache_miss') {
      if (
        expectedProbeReservation === null ||
        expectedProbeReservation > BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD ||
        probe.reservationBeforeDispatchMicroUsd !== expectedProbeReservation ||
        decision.countResult === null
      ) return 'admission_probe_invalid';
      expectedDebit =
        decision.countResult.outcome === 'counted'
          ? blueprintAuthoringInputMicroUsd(decision.countResult.inputTokens as number)
          : blueprintAuthoringInputMicroUsd(upperBound);
      expectedTransport = blueprintAuthoringCountResultTransportWasDispatched(
        decision.countResult,
      )
        ? 'dispatched'
        : 'assumed_dispatched';
    } else if (probe.status === 'cache_hit') {
      // A cache hit proves only that the run-scoped controller suppressed another dispatch.
      // It does NOT independently carry the original miss's debit/content chain, so it can
      // never authorize generation. The compiler evaluates each repair route once and must
      // consume the original miss/not-wired/reservation event; a duplicate hit fails closed.
      return 'admission_cache_hit_cannot_authorize_generation';
    } else {
      return 'admission_probe_invalid';
    }
    const expectedCumulativeProbe = safeSum(priorProbe, expectedDebit);
    if (
      expectedCumulativeProbe === null ||
      probe.debitMicroUsd !== expectedDebit ||
      probe.cumulativeDebitMicroUsd !== expectedCumulativeProbe ||
      probe.transportDisposition !== expectedTransport
    ) {
      return 'admission_probe_cost_invalid';
    }
    const expectedTotal = safeSum(
      expected.generationAccountedMicroUsdBeforeRoute,
      expectedCumulativeProbe,
    );
    if (
      expectedTotal === null ||
      decision.totalAccountedMicroUsdBeforeGeneration !== expectedTotal
    ) {
      return 'admission_total_cost_invalid';
    }

    let expectedContinuation: number | null = null;
    let expectedFailure = tokenFailure;
    if (tokenAdmitted) {
      expectedContinuation = blueprintAuthoringContinuationReservationMicroUsd({
        accountedMicroUsd: expectedTotal,
        remainingGenerationCalls: expected.remainingGenerationCalls,
        laterProbeRoutes: expected.laterProbeRoutes,
      });
      if (expectedContinuation > BLUEPRINT_AUTHORING_HARD_CEILING_MICRO_USD) {
        expectedFailure = 'cost_ceiling_exceeded';
      }
    }
    const expectedAdmitted = tokenAdmitted && expectedFailure === null;
    if (
      decision.admitted !== expectedAdmitted ||
      decision.failureReason !== expectedFailure ||
      decision.continuationReservationMicroUsd !== expectedContinuation ||
      (expected.requireAdmitted === true && !decision.admitted)
    ) {
      return 'admission_disposition_invalid';
    }
    return null;
  } catch {
    return 'admission_validation_failed';
  }
}
