import {
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  blueprintAuthoringInputAccountingIsValid,
  type BlueprintAuthoringInputAccounting,
} from './blueprintAuthoringPolicy';

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
