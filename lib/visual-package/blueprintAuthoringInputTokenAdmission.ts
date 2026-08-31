import {
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  BLUEPRINT_AUTHORING_REPAIR_ORDINALS,
  blueprintAuthoringInputAccountingIsValid,
  type BlueprintAuthoringInputAccounting,
  type BlueprintAuthoringRepairOrdinal,
} from './blueprintAuthoringPolicy';
import { canonicalJsonDigest } from './integrity';

/**
 * Honest, offline, dependency-free Blueprint input-token admission authority.
 *
 * ## Why this module exists
 *
 * The Blueprint admission gate historically compared
 * `BlueprintAuthoringInputAccounting.estimatedBytes` (a UTF-8 **byte** sum) to
 * `BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS` (a **token** ceiling). That is a
 * bytes-vs-tokens unit confusion: it reads as if bytes were tokens and invites
 * silent drift. This module makes the comparison *sound* by naming, versioning,
 * and proving the quantity that is compared against the token ceiling.
 *
 * ## The proven bound (no tokenizer, no dependency, no guessed ratio)
 *
 * The canonical Blueprint model tokenizes with a byte-level BPE tokenizer
 * (o200k_base family). For byte-level BPE:
 *   1. input text is UTF-8 encoded to a byte sequence;
 *   2. every one of those bytes is already an atomic token in the base vocab;
 *   3. BPE only ever *merges* two adjacent tokens into one — it never splits.
 * Therefore, for any admitted text `t`:  `tokenCount(t) <= utf8ByteLength(t)`.
 * Concatenating segments can only introduce additional cross-boundary merges, so
 * the sum of per-segment UTF-8 byte lengths is itself an upper bound on the whole
 * request's token count.
 *
 * `estimatedBytes` is exactly `systemBytes + userBytes + schemaBytes +
 * separatorBytes + protocolAllowance`. The first four are per-segment UTF-8 byte
 * lengths (each an upper bound on that segment's tokens). `protocolAllowance` is a
 * fixed, conservative allowance for message/tool/response-format framing tokens
 * (framing is a few dozen to a few hundred tokens in practice; the 4096 allowance
 * is deliberately generous). Hence `estimatedBytes` is a **conservative upper
 * bound on the provider input-token count**, and admitting only when
 * `estimatedBytes <= BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS` guarantees the real
 * token count is `<= ` the ceiling. The ceiling is therefore **not weakened**.
 *
 * ## Deliberately preserved and deliberately deferred
 *
 * - Byte accounting is preserved verbatim as **observability** (persisted v6
 *   receipts and their content digests are untouched). This module derives the
 *   token authority *from* that byte accounting; it does not replace it.
 * - The numeric admission outcome at the ceiling is unchanged; the correction is
 *   the *contract's* honesty (one unit, one authority, a proof) and the ability to
 *   cross-check the conservative bound against real observed usage.
 * - A tighter, exact-tokenizer-backed policy would require shipping/auditing a
 *   real offline tokenizer and is **deferred** to a future explicit version
 *   cutover. It is not guessed here, and no chars/bytes ratio is presented as
 *   exact tokens.
 */
export const BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION =
  'blueprint-authoring-conservative-input-token-admission/v1' as const;

/**
 * The proof reference for the conservative token bound. Persisted into the
 * sanitized capture so a reviewer can locate the exact safety argument.
 */
export const BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS =
  'utf8-byte-level-bpe-monotone-upper-bound' as const;

/**
 * The exact provider-authoritative input-token count surface this authority is
 * designed to consume when a live count is wired.
 *
 * The installed OpenAI SDK exposes the canonical count endpoint as
 * `client.responses.inputTokens.count(...)` (POST /responses/input_tokens),
 * returning `{ object: 'response.input_tokens', input_tokens: number }`. That is
 * the exact quantity the model would bill as input for the precise request shape
 * (instructions + input + model + structured-output schema + framing).
 *
 * This milestone MODELS that authority as an injectable counter and proves the
 * admission behaviour offline with injected fakes; it deliberately does NOT
 * invoke the endpoint (no network / no credential). Live wiring — counting as a
 * separate call from the paid generation call, with its own retry/cost evidence —
 * is a later, explicit step. Until then the counter is simply absent and the
 * admission falls back to the proven conservative upper bound, so the numeric
 * production behaviour at the ceiling is unchanged.
 */
export const BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_AUTHORITY =
  'openai-responses-input-tokens-count' as const;

/**
 * The token ceiling this authority admits against. Re-exported so admission call
 * sites bind to the token constant *through* the named authority rather than
 * comparing a byte field to it directly.
 */
export const BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING =
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS;

function nonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Conservative upper bound (in tokens) on the provider input-token count for the
 * given admitted input accounting. Fail-closed: throws on structurally invalid
 * accounting so a malformed record can never be silently admitted.
 *
 * By the module proof this equals `estimatedBytes` — a proven `>= ` the real
 * o200k_base token count for the admitted text domain.
 */
export function blueprintAuthoringConservativeInputTokenUpperBound(
  accounting: BlueprintAuthoringInputAccounting,
): number {
  if (!blueprintAuthoringInputAccountingIsValid(accounting)) {
    throw new Error(
      'blueprint authoring input accounting is invalid; cannot derive a conservative input-token upper bound',
    );
  }
  return accounting.estimatedBytes;
}

/**
 * True iff the conservative input-token upper bound is within the approved token
 * ceiling. This is the single admission authority for both the initial and repair
 * Blueprint routes. Fail-closed: invalid accounting is never admissible.
 */
export function blueprintAuthoringInputTokensAreAdmissible(
  accounting: BlueprintAuthoringInputAccounting | null | undefined,
): boolean {
  return (
    blueprintAuthoringInputAccountingIsValid(accounting) &&
    accounting.estimatedBytes <= BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING
  );
}

/**
 * True iff the conservative input-token upper bound exceeds the approved ceiling,
 * i.e. the route must be rejected before provider reachability. Fail-closed:
 * invalid accounting is treated as exceeding (never quietly admitted).
 */
export function blueprintAuthoringInputTokensExceedCeiling(
  accounting: BlueprintAuthoringInputAccounting | null | undefined,
): boolean {
  return !blueprintAuthoringInputTokensAreAdmissible(accounting);
}

/**
 * Observability cross-check proving the bound is conservative for a completed
 * attempt: the real provider input-token count must not exceed the conservative
 * upper bound derived from the same accounting. Returns false for invalid
 * accounting or a real count that violates the bound (which would indicate the
 * bound was mis-derived and must fail closed).
 */
export function blueprintAuthoringObservedInputTokensWithinBound(args: {
  accounting: BlueprintAuthoringInputAccounting;
  observedInputTokens: number;
}): boolean {
  if (
    !blueprintAuthoringInputAccountingIsValid(args.accounting) ||
    !nonNegativeSafeInteger(args.observedInputTokens)
  ) {
    return false;
  }
  return args.observedInputTokens <= args.accounting.estimatedBytes;
}

// ---------------------------------------------------------------------------
// Exact-count admission authority (one honest token quantity for both routes).
// ---------------------------------------------------------------------------

/**
 * Injectable exact provider input-token count authority. Models
 * `client.responses.inputTokens.count(...)` (see
 * BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_AUTHORITY) but is deliberately abstract
 * so it can be faked offline.
 *
 * Contract:
 *  - returns a non-negative safe integer = the exact input-token count for the
 *    supplied request shape, OR
 *  - returns `null` when an exact count is unavailable (not wired / count failed).
 * Anything else (throw, NaN, negative, non-integer) is treated as unavailable by
 * the admission decision, which then fails closed for any route the conservative
 * bound cannot already admit.
 *
 * It is intentionally distinct from the paid `callAuthor`/generation call: a count
 * is not a generation, carries no draft/output, and must never be conflated with
 * paid call/retry/cost evidence.
 */
export interface BlueprintAuthoringInputTokenCountRequest {
  routeKind: 'repair';
  /** The REAL repair ordinal (1 or 2 under the current budget) — not routeKind alone. */
  repairOrdinal: BlueprintAuthoringRepairOrdinal;
  systemPrompt: string;
  userPrompt: string;
  schema: Record<string, unknown>;
  model: string;
  /** The ACTUAL reasoning effort used for this route's generation (parity, not a hardcode). */
  reasoningEffort: string;
  /** The structured-output schema name used for this route's generation. */
  schemaName: string;
}

/**
 * The exact canonical token-relevant projection (and its digest) that BOTH the count request
 * body and the actual generation body must reduce to. Building it from the count request makes
 * the count evidence verifiable against the exact request without trusting the counter.
 */
export function blueprintAuthoringCountRequestProjection(
  request: BlueprintAuthoringInputTokenCountRequest,
): BlueprintAuthoringTokenRelevantRequestProjection {
  return blueprintAuthoringTokenRelevantRequestProjection({
    model: request.model,
    systemPrompt: request.systemPrompt,
    userPrompt: request.userPrompt,
    reasoningEffort: request.reasoningEffort,
    schemaName: request.schemaName,
    schema: request.schema,
  });
}

/**
 * The exact object literal the canonical count endpoint returns
 * (`{ object: 'response.input_tokens', input_tokens: number }`).
 */
export const BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT =
  'response.input_tokens' as const;

const BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_KEYS = [
  'input_tokens',
  'object',
] as const;

/**
 * Fail-closed gate for the exact provider input-token count result. Requires EXACTLY
 * `{ object: 'response.input_tokens', input_tokens: <non-negative safe integer> }` — no extra
 * or missing keys, the exact object literal, and an integer count. Returns the count, else
 * `null` (unavailable). Never throws; a float/negative/unsafe/missing/extra/wrong-object result
 * is `null` so the admission decision fails closed above the ceiling.
 */
export function blueprintAuthoringExactInputTokenCountFromResponse(
  value: unknown,
): number | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(candidate).sort()) !==
    JSON.stringify([...BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_KEYS])
  ) {
    return null;
  }
  if (
    candidate.object !== BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT
  ) {
    return null;
  }
  return nonNegativeSafeInteger(candidate.input_tokens)
    ? candidate.input_tokens
    : null;
}

/**
 * The CANONICAL token-relevant request projection — the single shape shared and proven between
 * the exact input-token count call and the generation call. It contains ONLY the fields that
 * affect the provider's input-token count: exact `model`; the system+user `input`; `reasoning`
 * effort; the structured-output `text.format` (type/name/schema/strict); `tools` []; `tool_choice`
 * none; and explicit `truncation` disabled. It deliberately EXCLUDES output/transport controls
 * (`service_tier`, `max_output_tokens`, `store`, `stream`) which do not change the input-token
 * count and which the count endpoint does not accept. Count and generation must not silently
 * differ on any field here; a canonical digest over this projection binds a count to its exact
 * request body/route.
 */
export interface BlueprintAuthoringTokenRelevantRequestProjection {
  model: string;
  input: Array<{ role: 'system' | 'user'; content: string }>;
  reasoning: { effort: string };
  text: {
    format: {
      type: 'json_schema';
      name: string;
      schema: Record<string, unknown>;
      strict: true;
    };
  };
  tools: [];
  tool_choice: 'none';
  truncation: 'disabled';
}

/**
 * Static values that the shared count/generation projection actually consumes. Dynamic model,
 * prompts, reasoning effort, schema name, and schema are bound elsewhere in the execution
 * program; this authority captures only the remaining wire values without digesting arbitrary
 * sentinel content that never crosses the provider boundary.
 */
export const BLUEPRINT_AUTHORING_TOKEN_RELEVANT_REQUEST_STATIC_AUTHORITY = Object.freeze({
  inputRoles: Object.freeze(['system', 'user'] as const),
  structuredOutputType: 'json_schema',
  structuredOutputStrict: true,
  tools: Object.freeze([] as const),
  toolChoice: 'none',
  truncation: 'disabled',
} as const);

export function blueprintAuthoringTokenRelevantRequestProjection(args: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  reasoningEffort: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): BlueprintAuthoringTokenRelevantRequestProjection {
  const authority =
    BLUEPRINT_AUTHORING_TOKEN_RELEVANT_REQUEST_STATIC_AUTHORITY;
  return {
    model: args.model,
    input: [
      { role: authority.inputRoles[0], content: args.systemPrompt },
      { role: authority.inputRoles[1], content: args.userPrompt },
    ],
    reasoning: { effort: args.reasoningEffort },
    text: {
      format: {
        type: authority.structuredOutputType,
        name: args.schemaName,
        schema: args.schema,
        strict: authority.structuredOutputStrict,
      },
    },
    tools: [...authority.tools],
    tool_choice: authority.toolChoice,
    truncation: authority.truncation,
  };
}

/**
 * Evidence version for the SEPARATE count transport (distinct from the generation evidence
 * version). A count dispatch carries its own attestation under this version.
 */
export const BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION =
  'openai-responses-input-tokens-count-evidence/v1' as const;

export type BlueprintAuthoringCountUnavailableReason =
  | 'not_wired'
  | 'count_model_unconfirmed'
  | 'count_transport_failed'
  | 'count_route_unconfirmed'
  | 'count_response_invalid'
  | 'count_evidence_invalid'
  | 'count_cost_reservation_exceeded';

const BLUEPRINT_AUTHORING_COUNT_UNAVAILABLE_REASONS = new Set<string>([
  'not_wired',
  'count_model_unconfirmed',
  'count_transport_failed',
  'count_route_unconfirmed',
  'count_response_invalid',
  'count_evidence_invalid',
  'count_cost_reservation_exceeded',
]);

/**
 * Attestation for one exact input-token COUNT dispatch. It is deliberately its own object,
 * separate from the generation `AuthoringExecutionAttestation`: a count is not a generation
 * and must never increment generation callCount/repairCount/logicalProviderCalls or generation
 * transport attestation.
 */
export interface BlueprintAuthoringCountTransportAttestation {
  provider: 'openai';
  model: string;
  route: 'responses_input_tokens';
  evidenceVersion: typeof BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION;
  transportDispatchCount: number;
  transportRetryCount: number;
  canonicalRouteConfirmed: boolean;
  canonicalModelConfirmed: boolean;
}

/**
 * The result of consulting the exact input-token count authority for one repair route. It
 * carries the canonical token-relevant request digest (binding the count to its exact body),
 * the outcome, the exact count (iff counted), a bounded sanitized unavailable reason, and the
 * separate count-transport attestation (present iff a dispatch occurred).
 */
export interface BlueprintAuthoringExactInputTokenCountResult {
  routeKind: 'repair';
  repairOrdinal: BlueprintAuthoringRepairOrdinal;
  countRequestDigest: string;
  outcome: 'counted' | 'unavailable';
  inputTokens: number | null;
  unavailableReason: BlueprintAuthoringCountUnavailableReason | null;
  attestation: BlueprintAuthoringCountTransportAttestation | null;
}

const BLUEPRINT_AUTHORING_COUNT_RESULT_KEYS = [
  'attestation',
  'countRequestDigest',
  'inputTokens',
  'outcome',
  'repairOrdinal',
  'routeKind',
  'unavailableReason',
] as const;

const BLUEPRINT_AUTHORING_COUNT_ATTESTATION_KEYS = [
  'canonicalModelConfirmed',
  'canonicalRouteConfirmed',
  'evidenceVersion',
  'model',
  'provider',
  'route',
  'transportDispatchCount',
  'transportRetryCount',
] as const;

function exactObjectKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys])
  );
}

export function blueprintAuthoringRepairOrdinalIsWithinBudget(
  value: unknown,
): value is BlueprintAuthoringRepairOrdinal {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    (BLUEPRINT_AUTHORING_REPAIR_ORDINALS as readonly number[]).includes(value)
  );
}

function boundedCountUnavailableReason(
  value: unknown,
): value is BlueprintAuthoringCountUnavailableReason {
  return (
    typeof value === 'string' &&
    BLUEPRINT_AUTHORING_COUNT_UNAVAILABLE_REASONS.has(value)
  );
}

function countAttestationShapeIsValid(
  value: unknown,
  request: BlueprintAuthoringInputTokenCountRequest,
): value is BlueprintAuthoringCountTransportAttestation {
  if (
    !exactObjectKeys(
      value,
      BLUEPRINT_AUTHORING_COUNT_ATTESTATION_KEYS,
    )
  ) {
    return false;
  }
  return (
    value.provider === 'openai' &&
    value.model === request.model &&
    value.route === 'responses_input_tokens' &&
    value.evidenceVersion === BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION &&
    (value.transportDispatchCount === 0 ||
      value.transportDispatchCount === 1) &&
    value.transportRetryCount === 0 &&
    typeof value.canonicalRouteConfirmed === 'boolean' &&
    typeof value.canonicalModelConfirmed === 'boolean'
  );
}

/**
 * Exact, fail-closed check that a count result actually BELONGS to the given request and is a
 * CONSUMABLE exact count. Used before admission trusts any count. It requires: the exact route
 * kind + real repair ordinal; the canonical token-relevant projection digest recomputed from
 * the request; the counted-vs-unavailable field invariants; and — for a consumable count — a
 * complete attestation with the canonical model, exact count route + evidence version, canonical
 * route/model confirmations, EXACTLY one transport dispatch, and zero retries. Any forged digest,
 * forged route/ordinal, contradictory reason, or missing/incomplete attestation is not
 * consumable. Returns `null` when consumable (with the exact token count also required to be a
 * non-negative safe integer), else a bounded reason string.
 */
export function blueprintAuthoringCountResultConsumptionReason(
  result: unknown,
  request: BlueprintAuthoringInputTokenCountRequest,
  conservativeUpperBoundTokens: number,
): BlueprintAuthoringCountUnavailableReason | 'count_binding_mismatch' | null {
  if (
    request.routeKind !== 'repair' ||
    !blueprintAuthoringRepairOrdinalIsWithinBudget(request.repairOrdinal) ||
    !nonNegativeSafeInteger(conservativeUpperBoundTokens) ||
    !exactObjectKeys(result, BLUEPRINT_AUTHORING_COUNT_RESULT_KEYS)
  ) {
    return 'count_binding_mismatch';
  }
  const expectedDigest = canonicalJsonDigest(
    blueprintAuthoringCountRequestProjection(request),
  );
  if (
    result.routeKind !== request.routeKind ||
    result.repairOrdinal !== request.repairOrdinal ||
    result.countRequestDigest !== expectedDigest
  ) {
    return 'count_binding_mismatch';
  }
  if (result.outcome === 'unavailable') {
    if (
      result.inputTokens !== null ||
      !boundedCountUnavailableReason(result.unavailableReason)
    ) {
      return 'count_binding_mismatch';
    }
    if (result.attestation !== null) {
      if (!countAttestationShapeIsValid(result.attestation, request)) {
        return 'count_binding_mismatch';
      }
      const attestation = result.attestation;
      if (
        result.unavailableReason === 'count_response_invalid' &&
        (attestation.transportDispatchCount !== 1 ||
          attestation.canonicalRouteConfirmed !== true ||
          attestation.canonicalModelConfirmed !== true)
      ) {
        return 'count_binding_mismatch';
      }
      if (
        result.unavailableReason === 'count_route_unconfirmed' &&
        attestation.canonicalRouteConfirmed === true &&
        attestation.canonicalModelConfirmed === true
      ) {
        return 'count_binding_mismatch';
      }
    } else if (
      result.unavailableReason === 'count_response_invalid' ||
      result.unavailableReason === 'count_route_unconfirmed'
    ) {
      return 'count_binding_mismatch';
    }
    // A validly-unavailable result is bound evidence but never opens the lane.
    return result.unavailableReason;
  }
  // Counted: require the exact-count field invariants and a complete canonical attestation.
  if (
    result.outcome !== 'counted' ||
    !nonNegativeSafeInteger(result.inputTokens) ||
    result.inputTokens > conservativeUpperBoundTokens ||
    result.unavailableReason !== null
  ) {
    return 'count_binding_mismatch';
  }
  const attestation = result.attestation;
  if (
    !countAttestationShapeIsValid(attestation, request) ||
    attestation.transportDispatchCount !== 1 ||
    attestation.transportRetryCount !== 0 ||
    attestation.canonicalRouteConfirmed !== true ||
    attestation.canonicalModelConfirmed !== true
  ) {
    return 'count_binding_mismatch';
  }
  return null;
}

/**
 * The exact input-token count authority, modelling `client.responses.inputTokens.count(...)`
 * (POST /responses/input_tokens). It is ASYNC (the real endpoint is a network call) and is
 * consulted by the compiler ONLY for a repair route whose conservative bound exceeds the
 * ceiling; `<= ceiling` routes are admitted without any count. It never throws to its caller:
 * a transport/response failure is surfaced as an `unavailable` result so admission fails closed.
 */
export type BlueprintAuthoringInputTokenCounter = (
  request: BlueprintAuthoringInputTokenCountRequest,
) => Promise<BlueprintAuthoringExactInputTokenCountResult>;

export type BlueprintAuthoringInputTokenAdmissionBasis =
  | 'invalid_accounting'
  | 'conservative_upper_bound'
  | 'exact_provider_count'
  | 'exact_count_unavailable';

export interface BlueprintAuthoringInputTokenAdmissionDecision {
  admitted: boolean;
  basis: BlueprintAuthoringInputTokenAdmissionBasis;
  ceilingTokens: number;
  /** Proven conservative upper bound (tokens) or null when accounting is invalid. */
  conservativeUpperBoundTokens: number | null;
  /** Exact provider count when it was consulted and valid, else null. */
  exactInputTokens: number | null;
  /** Full count evidence when the exact authority was consulted (over-ceiling route), else null. */
  countResult: BlueprintAuthoringExactInputTokenCountResult | null;
}

/**
 * The single Blueprint input-token admission authority, shared by the initial and
 * repair routes. It compares ONE honest quantity in tokens against the ceiling:
 *
 *  1. Invalid accounting            -> fail closed (never admit).
 *  2. Conservative bound <= ceiling -> admit (tokens are provably <= bound <= ceiling;
 *                                      no exact count needed).
 *  3. Conservative bound > ceiling  -> the proven bound is inconclusive, so consult
 *                                      the exact provider count:
 *        - exact count valid & <= ceiling -> admit (honest exact tokens),
 *        - exact count valid & > ceiling  -> reject (honest exact tokens),
 *        - exact count unavailable        -> fail closed (reject).
 *
 * The admitted quantity is therefore always a token quantity — a proven token
 * upper bound, or an exact provider token count — never a byte sum reinterpreted
 * as tokens. `exactInputTokens` is only consulted in the > ceiling region, so a
 * fully-conservative run never depends on a live counter.
 */
export function decideBlueprintAuthoringInputTokenAdmission(args: {
  accounting: BlueprintAuthoringInputAccounting | null | undefined;
  exactInputTokens?: number | null;
}): BlueprintAuthoringInputTokenAdmissionDecision {
  if (!blueprintAuthoringInputAccountingIsValid(args.accounting)) {
    return {
      admitted: false,
      basis: 'invalid_accounting',
      ceilingTokens: BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING,
      conservativeUpperBoundTokens: null,
      exactInputTokens: null,
      countResult: null,
    };
  }
  const conservativeUpperBoundTokens = args.accounting.estimatedBytes;
  if (conservativeUpperBoundTokens <= BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING) {
    return {
      admitted: true,
      basis: 'conservative_upper_bound',
      ceilingTokens: BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING,
      conservativeUpperBoundTokens,
      exactInputTokens: null,
      countResult: null,
    };
  }
  const exactInputTokens = nonNegativeSafeInteger(args.exactInputTokens)
    ? args.exactInputTokens
    : null;
  if (exactInputTokens === null) {
    return {
      admitted: false,
      basis: 'exact_count_unavailable',
      ceilingTokens: BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING,
      conservativeUpperBoundTokens,
      exactInputTokens: null,
      countResult: null,
    };
  }
  return {
    admitted: exactInputTokens <= BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING,
    basis: 'exact_provider_count',
    ceilingTokens: BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING,
    conservativeUpperBoundTokens,
    exactInputTokens,
    countResult: null,
  };
}

/**
 * ASYNC wrapper: consult the optional exact count authority (never throwing) ONLY for a valid
 * over-ceiling route, and return the admission decision carrying the full count evidence. A
 * counter that throws, or an `unavailable`/non-integer count, is treated as "exact count
 * unavailable" (fail closed above ceiling). The count evidence is returned on the decision so
 * the runner can carry the exact admission basis/count/request-digest/attestation into the v7
 * receipt and sanitized capture — including for a repair rejected before any generation call.
 */
export async function admitBlueprintAuthoringInputTokens(args: {
  accounting: BlueprintAuthoringInputAccounting | null | undefined;
  counter?: BlueprintAuthoringInputTokenCounter | null;
  request?: BlueprintAuthoringInputTokenCountRequest;
}): Promise<BlueprintAuthoringInputTokenAdmissionDecision> {
  let exactInputTokens: number | null = null;
  let countResult: BlueprintAuthoringExactInputTokenCountResult | null = null;
  if (
    args.counter &&
    args.request &&
    blueprintAuthoringInputAccountingIsValid(args.accounting) &&
    args.accounting.estimatedBytes > BLUEPRINT_AUTHORING_INPUT_TOKEN_CEILING
  ) {
    const request = args.request;
    const expectedDigest = canonicalJsonDigest(
      blueprintAuthoringCountRequestProjection(request),
    );
    try {
      const raw = await args.counter(request);
      // Only CONSUME a count that is exactly bound to this request and carries a complete
      // canonical single-dispatch attestation. A forged initial-route/forged-digest/
      // contradictory-reason/null-attestation result never opens the lane; it becomes a
      // durable, bounded unavailable decision — never a silently-dropped null.
      const reason = blueprintAuthoringCountResultConsumptionReason(
        raw,
        request,
        args.accounting.estimatedBytes,
      );
      if (reason === null) {
        countResult = raw as BlueprintAuthoringExactInputTokenCountResult;
        exactInputTokens = countResult.inputTokens;
      } else if (reason !== 'count_binding_mismatch') {
        countResult = raw as BlueprintAuthoringExactInputTokenCountResult;
        exactInputTokens = null;
      } else {
        countResult = {
          routeKind: request.routeKind,
          repairOrdinal: request.repairOrdinal,
          countRequestDigest: expectedDigest,
          outcome: 'unavailable',
          inputTokens: null,
          unavailableReason: 'count_evidence_invalid',
          attestation: null,
        };
        exactInputTokens = null;
      }
    } catch {
      // A counter throw is explicit bounded unavailable evidence, not a disappeared null.
      countResult = {
        routeKind: request.routeKind,
        repairOrdinal: request.repairOrdinal,
        countRequestDigest: expectedDigest,
        outcome: 'unavailable',
        inputTokens: null,
        unavailableReason: 'count_transport_failed',
        attestation: null,
      };
      exactInputTokens = null;
    }
  }
  return {
    ...decideBlueprintAuthoringInputTokenAdmission({
      accounting: args.accounting,
      exactInputTokens,
    }),
    countResult,
  };
}
