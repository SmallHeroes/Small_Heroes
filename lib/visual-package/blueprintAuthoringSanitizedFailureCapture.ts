import { canonicalJsonDigest } from './integrity';
import {
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  blueprintAuthoringInputAccountingIsValid,
  type BlueprintAuthoringInputAccounting,
} from './blueprintAuthoringPolicy';
import {
  BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION,
  BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS,
  blueprintAuthoringConservativeInputTokenUpperBound,
  blueprintAuthoringInputTokensAreAdmissible,
} from './blueprintAuthoringInputTokenAdmission';
import {
  groupPreRenderBlueprintRepairDiagnostics,
  type PreRenderBlueprintRepairDiagnostic,
} from './preRenderBlueprintAuthoring';
import type { AuthoringTerminalFailureCode } from './authoringTerminalDiagnostics';

/**
 * Sanitized Blueprint authoring failure observability capture.
 *
 * ## Purpose
 *
 * The real R1D lantern receipt collapsed 86 diagnostic symptoms into three
 * category codes with no structural identities, and recorded the failed repair
 * route only as `estimatedBytes` bytes against a token ceiling. A future failing
 * run must instead be able to emit a *structural* projection that lets an operator
 * distinguish repeated symptoms from distinct defects and audit the admission
 * decision for both the admitted and the rejected route — WITHOUT persisting any
 * narrative prose, source phrase, label/name, prompt, raw provider output, or PII.
 *
 * ## Safety by construction (no prose / no PII)
 *
 * Every retained string in a capture is constrained to a closed alphabet:
 *  - a lowercase snake_case code/reason (`SAFE_SNAKE`),
 *  - a 64-char lowercase hex content digest (`HEX_SHA256`),
 *  - a structural field-path token drawn from a CLOSED vocabulary of known
 *    Blueprint keys, an `[index]`, or the non-reversible redaction sentinel
 *    (`#redacted`); any other identifier — including a name used as a key — is
 *    redacted, not retained, and the same closed rule is re-enforced on reload,
 *  - or one of a handful of fixed literal enum/version strings.
 * The diagnostic `message`, `expected`, and `actual` values (which can carry prose
 * or names) are NEVER retained — and are never digested either. Only their presence
 * flags survive, alongside an `identityDigest` computed over the SANITIZED
 * structural projection ONLY (code + closed-vocabulary/redacted field path +
 * presence/redaction flags; see `sanitizedCensusIdentityDigest`), so no persisted
 * value is a function of raw diagnostic content. The validator additionally runs a
 * recursive
 * structural scan that rejects any string containing spaces, quotes, or non-ASCII,
 * so a leaked name/phrase cannot validate. Leak-freedom is therefore structural and
 * testable, not merely a convention.
 *
 * ## Complete census (never silently truncated)
 *
 * A valid capture always carries a COMPLETE census: every distinct structural
 * identity is retained (`retained == distinct`, `omitted == 0`, `truncated ==
 * false`). A run whose distinct-identity count would exceed the fail-closed hard
 * bound mints NO capture at all rather than a truncated one; the validator rejects
 * any artifact that claims omission. There is no valid incomplete census.
 *
 * ## What it does not do
 *
 * The historical failed attempt cannot be retroactively upgraded: its concrete 86
 * identities were never persisted and remain unknowable. This artifact prevents
 * future blindness; it does not reconstruct the past.
 */
export const BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION =
  'blueprint-authoring-sanitized-failure-capture/v2' as const;

export const BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_SCOPE =
  'blueprint_authoring_failure_observability_only' as const;

/**
 * Explicit fail-closed no-authority semantics. A capture is pure observability and
 * confers none of these authorities.
 */
export const BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_DOES_NOT_AUTHORIZE = [
  'blueprint_approval',
  'candidate_approval',
  'deployment',
  'provider_dispatch',
  'render',
  'replacement_authorization',
] as const;

export const BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_DIGEST_ALGORITHM =
  'canonical-json-sha256' as const;

/**
 * Closed set of terminal failure codes that ALONE mandate a complete sanitized capture.
 * This is the code-only MANDATORY subset, NOT the whole classification: it is NOT true
 * that every code outside this set is diagnostic-less, and the code set alone does NOT
 * govern the runner/replay/recovery binding requirement. A failure outside this set can
 * still be diagnostic-BEARING through receipt EVIDENCE — e.g. an initial invalid draft
 * that produced grouped validation diagnostics followed by a repair-time
 * `provider_call_failed`, or a `local_processing_failed` fallback that still carries
 * structured diagnostics. The single TOTAL capture requirement shared by capture
 * derivation (the runner), first materialization, replay, and recovery is therefore
 * `blueprintAuthoringReceiptRequiresSanitizedCapture` (this mandatory code OR any attempt
 * with grouped validation diagnostics) — never this code set alone. Because that predicate
 * reads the content-addressed receipt (code + persisted attempt diagnostics), the binding
 * cannot be sidestepped by stripping the capture from a hostile/legacy authoring_failed
 * terminal without also changing the receipt it is derived from.
 */
export const BLUEPRINT_AUTHORING_CAPTURE_REQUIRED_FAILURE_CODES: ReadonlySet<string> =
  new Set(['repair_route_input_not_admissible', 'draft_validation_repair_exhausted']);

/**
 * True iff a terminal failure CODE alone mandates a complete sanitized capture (its
 * code is in the closed mandatory set above). This is the code-only component; the
 * total requirement is derived from receipt EVIDENCE by
 * `blueprintAuthoringReceiptRequiresSanitizedCapture`, because a diagnostic-bearing
 * failure can surface under a non-mandatory terminal code (e.g. an initial invalid
 * draft that produced grouped validation diagnostics, followed by a repair-time
 * `provider_call_failed`, or a `local_processing_failed` fallback that still carries
 * structured diagnostics). Do not use this predicate alone to gate capture binding.
 */
export function blueprintAuthoringFailureRequiresSanitizedCapture(
  failureCode: string | null | undefined,
): boolean {
  return (
    typeof failureCode === 'string' &&
    BLUEPRINT_AUTHORING_CAPTURE_REQUIRED_FAILURE_CODES.has(failureCode)
  );
}

/**
 * Minimal structural view of a failed authoring receipt needed to decide the capture
 * requirement. Deliberately structural (not the concrete runner type) so this module
 * stays free of a runner import cycle, and so the SAME predicate answers for an
 * in-memory result, a replay-loaded terminal receipt, and a recovery-scanned receipt.
 */
export interface BlueprintAuthoringFailedReceiptAttemptEvidence {
  validationDiagnostics?: {
    count?: number | null;
    codes?: readonly unknown[] | null;
  } | null;
}

export interface BlueprintAuthoringFailedReceiptEvidence {
  failure?: { code?: string | null } | null;
  attempts?: readonly (BlueprintAuthoringFailedReceiptAttemptEvidence | null)[] | null;
}

/**
 * True iff an attempt persisted a non-empty grouped validation-diagnostic set. Read
 * from the receipt's sanitized `{count, codes}` projection, so it is stable across
 * durable/reloaded receipts (raw structured diagnostics are never persisted). Positive
 * count OR non-empty codes counts as diagnostic-bearing, so the requirement fails
 * closed if either signal is present.
 */
function attemptCarriesGroupedValidationDiagnostics(
  attempt: BlueprintAuthoringFailedReceiptAttemptEvidence | null,
): boolean {
  if (!attempt || typeof attempt !== 'object') return false;
  const diagnostics = attempt.validationDiagnostics;
  if (!diagnostics || typeof diagnostics !== 'object') return false;
  const countIsPositive =
    typeof diagnostics.count === 'number' &&
    Number.isSafeInteger(diagnostics.count) &&
    diagnostics.count > 0;
  const codesArePresent =
    Array.isArray(diagnostics.codes) && diagnostics.codes.length > 0;
  return countIsPositive || codesArePresent;
}

/**
 * The single canonical capture-requirement predicate, derived from the ACTUAL failed
 * receipt evidence rather than the terminal code alone. A capture is required iff the
 * terminal failure code is in the closed mandatory set OR any attempt carried a
 * non-empty grouped validation-diagnostic set. Shared by the runner's capture
 * derivation, first terminal materialization, replay (`loadExecutionRecord`), and
 * recovery (`recoverTerminalLookup`) so those four sites can never disagree about
 * whether a terminal must carry a bound capture. A genuinely first-call diagnostic-less
 * provider/boundary failure (no mandatory code, no attempt diagnostics) is NOT required
 * and may bind no capture.
 */
export function blueprintAuthoringReceiptRequiresSanitizedCapture(
  receipt: BlueprintAuthoringFailedReceiptEvidence | null | undefined,
): boolean {
  if (!receipt || typeof receipt !== 'object') return false;
  if (blueprintAuthoringFailureRequiresSanitizedCapture(receipt.failure?.code)) {
    return true;
  }
  const attempts = Array.isArray(receipt.attempts) ? receipt.attempts : [];
  return attempts.some(attemptCarriesGroupedValidationDiagnostics);
}

/**
 * Hard, fail-closed upper bound on distinct census identities. This is NOT a
 * truncation limit: a run that would exceed it mints NO capture (build throws; the
 * runner's typed capture derivation then yields a `derivation_failed` disposition,
 * which the lifecycle drives into the incident / execution_state_uncertain path — never
 * a null that a caller could silently treat as an allowed absence). It is set far above
 * any
 * realistic incident (the real R1D incident had 86) so a genuine failed run is
 * never rejected, while still bounding the artifact size. A valid capture always
 * carries a COMPLETE census (see the census invariants below).
 */
const MAX_SANITIZED_CENSUS_IDENTITIES = 4_096;
const MAX_SANITIZED_ROUTES = 8;
const MAX_FIELD_PATH_DEPTH = 32;
const MAX_SANITIZED_STRING_LENGTH = 128;

const HEX_SHA256 = /^[a-f0-9]{64}$/;
const SAFE_SNAKE = /^[a-z][a-z0-9_]{0,63}$/;
const SAFE_PATH_INDEX = /^\[\d+\]$/;
/**
 * Non-reversible redaction sentinel for an unknown (non-vocabulary) key segment.
 * A constant marker — never a digest of the raw token — so it cannot leak the
 * original identifier and cannot seed a dictionary/rainbow recovery.
 */
const REDACTED_PATH_SEGMENT = '#redacted';
/** Structural superset used by the recursive leak scan. Excludes spaces, quotes, non-ASCII. */
const SAFE_STRUCTURAL_STRING = /^[\w:/.#\[\]-]{1,128}$/;

/**
 * Closed structural field-path vocabulary. A retained key segment MUST be one of
 * these known Blueprint structural keys (or an `[index]`, or the redaction
 * sentinel). Any other identifier-shaped token — including a child/family/pet
 * name that happens to be a valid identifier — is redacted, so an arbitrary token
 * can never survive merely because it "looks identifier-shaped". The same closed
 * rule is re-enforced on reload by the validator, so a hand-crafted capture with
 * an out-of-vocabulary key segment fails validation.
 *
 * Sources: the whole-book draft JSON schema property names and the field tokens
 * emitted by `validatePreRenderBookVisualBlueprint` / the visual-contract
 * compiler validators (all structural key names; never values, labels, or names).
 */
const SAFE_PATH_KEY_VOCABULARY: ReadonlySet<string> = new Set([
  // Top-level & identity.
  'version', 'digest', 'digestAlgorithm', 'compositionPolicyVersion',
  'schemaVersion', 'storyKey', 'identity', 'authoringAuthority', 'source',
  'style', 'reconciliation', 'visualContract', 'template', 'templateIdentity',
  // World plan.
  'worldPlan', 'connections', 'affordances', 'revealSafeSupportingGeometry',
  'from', 'to', 'node', 'zone', 'bidirectional', 'traversalIds', 'openingIds',
  'safeBoundaryIds', 'cue', 'fromZone', 'toZone', 'footprint', 'consumers',
  'support', 'target', 'supportedEntities', 'supportedRefs', 'supportRef',
  'maximumOccupants', 'maximumActors', 'minimumClearance', 'maximumClearance',
  'clearanceRegion', 'permittedRegion', 'visibleRegion', 'openingNode',
  'spatialNodeId', 'openingSpatialNodeId', 'supportsPropIds',
  'traversalAffordanceIds', 'openingClearanceAffordanceIds',
  'openingClearanceAffordanceId', 'safeBoundaryAffordanceIds',
  'predicates', 'subjectKinds', 'entities', 'directions', 'relations',
  'constraintRelations', 'targetRegions', 'boundRef', 'nodesOrLegacyGeometry',
  'nodes', 'anchors', 'topology', 'geometry',
  // Frames.
  'frames', 'narrative', 'purpose', 'summary', 'placements', 'subject',
  'region', 'depth', 'importance', 'camera', 'shot', 'angle', 'affordanceId',
  'affordanceIds', 'continuity', 'previousFrameId', 'transitionKind',
  'connectionId', 'carryoverRefs', 'kind', 'pageNumber', 'id', 'name',
  'description', 'locationId', 'zoneId', 'castIds', 'propLifecycle',
  'requiredPropIds', 'forbiddenPropIds', 'textSafeRegion', 'aspectRatio',
  'coordinateSpace',
  // Geometry primitives.
  'x', 'y', 'w', 'h', 'width', 'height',
  // Cover / page contracts.
  'coverContract', 'mustShow', 'mustNotShow', 'pageContracts', 'recurringProps',
  'firstRevealPage', 'transition', 'actions', 'safety', 'castState',
  'castStates', 'childWardrobe', 'companionState', 'state', 'stateId',
  'anchorId', 'visibility', 'polarity', 'side', 'evidenceId', 'phrase',
  'checkId', 'scale', 'role', 'label', 'wardrobe', 'forbidden',
  'stateAuthority', 'relation', 'targetRef', 'subjectId', 'bodyState',
  'injectionArm', 'bandageArm', 'freeHand', 'laterality',
  // Continuity / presence bibles.
  'pagesPresent', 'pagePlans', 'visibleAnchors', 'locationBible', 'humanCast',
  'reconciliationArtifactPath', 'actionSemanticCoverage',
  'authoredCoverAuthority',
]);

export type BlueprintAuthoringSanitizedRouteKind = 'initial' | 'repair';

export interface BlueprintAuthoringSanitizedRoute {
  routeKind: BlueprintAuthoringSanitizedRouteKind;
  ordinal: number;
  /** Exact byte accounting, preserved verbatim as observability. */
  byteAccounting: BlueprintAuthoringInputAccounting;
  /** Conservative input-token upper bound (== estimatedBytes) under the named policy. */
  conservativeInputTokenUpperBound: number;
  admitted: boolean;
  /** Real provider input tokens for an admitted+completed route, else null. */
  observedInputTokens: number | null;
  /** Bounded snake_case rejection reason for a non-admitted route, else null. */
  rejectionReasonCode: string | null;
}

export interface BlueprintAuthoringSanitizedCensusIdentity {
  /** Structural diagnostic code (closed vocabulary). */
  code: string;
  fieldPresent: boolean;
  /** Safe structural path tokens (schema keys / `[index]`), or null when absent or redacted. */
  fieldPath: string[] | null;
  fieldPathDepth: number;
  /** True when a field was present but could not be safely tokenized (redacted). */
  fieldRedacted: boolean;
  expectedPresent: boolean;
  actualPresent: boolean;
  /**
   * One-way digest over the SANITIZED structural projection ONLY (code + sanitized
   * field path + presence/redaction flags). Never a function of the raw
   * message/field-value/expected/actual, so it cannot fingerprint PII. Distinguishes
   * and canonically orders distinct sanitized identities.
   */
  identityDigest: string;
  repetitionCount: number;
}

export interface BlueprintAuthoringSanitizedCensus {
  /** Total emitted symptoms across all distinct identities (untruncated). */
  totalEmitted: number;
  /** Count of distinct structural identities (untruncated). */
  distinctIdentities: number;
  /** Count of identities retained in `identities` (== identities.length). */
  retainedIdentities: number;
  truncated: boolean;
  omittedDistinctIdentities: number;
  /** Digest over the complete (untruncated) normalized identity list; makes truncation auditable. */
  fullCensusDigest: string;
  identities: BlueprintAuthoringSanitizedCensusIdentity[];
}

export interface BlueprintAuthoringSanitizedFailureCapture {
  version: typeof BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION;
  scope: typeof BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_SCOPE;
  doesNotAuthorize: string[];
  terminalFailureCode: string;
  linkage: {
    terminalReceiptDigest: string;
    requestDigest: string;
    contextDigest: string;
  };
  admission: {
    policyVersion: typeof BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION;
    boundBasis: typeof BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS;
    ceilingTokens: number;
    routes: BlueprintAuthoringSanitizedRoute[];
  };
  census: BlueprintAuthoringSanitizedCensus;
  digestAlgorithm: typeof BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_DIGEST_ALGORITHM;
  digest: string;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function safeStringWithin(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_SANITIZED_STRING_LENGTH &&
    SAFE_STRUCTURAL_STRING.test(value)
  );
}

/** A persisted path token is structurally valid iff it is an array index, the
 * non-reversible redaction sentinel, or a key in the closed vocabulary. */
function safePathTokenIsValid(token: unknown): token is string {
  return (
    typeof token === 'string' &&
    (SAFE_PATH_INDEX.test(token) ||
      token === REDACTED_PATH_SEGMENT ||
      SAFE_PATH_KEY_VOCABULARY.has(token))
  );
}

/**
 * Deterministically sanitize a diagnostic `field` into safe structural path tokens
 * constrained by the CLOSED vocabulary.
 *
 * Returns { path: null, redacted: false } when no field was present;
 * { path: null, redacted: true } when a field was present but could not be
 * tokenized into key/index segments at all (e.g. it carries prose, quotes, or a
 * `:`/`-` id), so nothing can leak; otherwise the token array, where every
 * IDENTIFIER segment is kept only if it is a known structural key and is
 * otherwise replaced with the redaction sentinel. Index segments are always
 * structural and kept verbatim. `redacted` is true whenever any segment was
 * replaced. An arbitrary identifier-shaped token (e.g. a name used as a key) can
 * therefore never survive: it is redacted, not retained.
 */
export function sanitizeBlueprintDiagnosticFieldPath(
  field: string | null | undefined,
): { present: boolean; path: string[] | null; redacted: boolean } {
  if (typeof field !== 'string' || field.length === 0) {
    return { present: false, path: null, redacted: false };
  }
  const tokens: string[] = [];
  let redacted = false;
  let rest = field;
  const tokenRe = /^(?:\.?([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\])/;
  while (rest.length > 0) {
    const match = tokenRe.exec(rest);
    if (!match) {
      return { present: true, path: null, redacted: true };
    }
    if (match[1] !== undefined) {
      if (SAFE_PATH_KEY_VOCABULARY.has(match[1])) {
        tokens.push(match[1]);
      } else {
        tokens.push(REDACTED_PATH_SEGMENT);
        redacted = true;
      }
    } else if (match[2] !== undefined) {
      tokens.push(`[${match[2]}]`);
    } else {
      return { present: true, path: null, redacted: true };
    }
    rest = rest.slice(match[0].length);
  }
  if (tokens.length === 0 || tokens.length > MAX_FIELD_PATH_DEPTH) {
    return { present: true, path: null, redacted: true };
  }
  return { present: true, path: tokens, redacted };
}

/**
 * The sanitized structural projection of one diagnostic identity: the ONLY fields
 * persisted per census identity. Derived purely from the closed diagnostic code, the
 * closed-vocabulary/redacted field path, and boolean presence/redaction flags. It
 * consumes NO raw message, field value, expected value, or actual value, so it can
 * neither carry nor fingerprint PII.
 */
type SanitizedCensusIdentityProjection = {
  code: string;
  fieldPresent: boolean;
  fieldPath: string[] | null;
  fieldPathDepth: number;
  fieldRedacted: boolean;
  expectedPresent: boolean;
  actualPresent: boolean;
};

function sanitizedCensusIdentityProjection(
  code: PreRenderBlueprintRepairDiagnostic['code'],
  field: string | null,
  expectedPresent: boolean,
  actualPresent: boolean,
): SanitizedCensusIdentityProjection {
  const path = sanitizeBlueprintDiagnosticFieldPath(field);
  return {
    code,
    fieldPresent: path.present,
    fieldPath: path.path,
    fieldPathDepth: path.path?.length ?? 0,
    fieldRedacted: path.redacted,
    expectedPresent,
    actualPresent,
  };
}

/**
 * The persisted identity digest is a one-way SHA-256 over the SANITIZED structural
 * projection ONLY. It never consumes the raw message, field value, expected, or
 * actual, so it cannot be a name/phrase fingerprint and cannot seed a
 * dictionary/rainbow recovery of a redacted token (the token is already gone — it was
 * replaced by `#redacted` before it reached this digest). It is unsalted only so the
 * capture stays content-addressable and deterministically reproducible on
 * recovery/replay; it is used solely to distinguish and canonically order distinct
 * sanitized identities.
 */
function sanitizedCensusIdentityDigest(
  projection: SanitizedCensusIdentityProjection,
): string {
  return canonicalJsonDigest(projection);
}

function sanitizedRoute(input: {
  routeKind: BlueprintAuthoringSanitizedRouteKind;
  ordinal: number;
  byteAccounting: BlueprintAuthoringInputAccounting;
  observedInputTokens?: number | null;
  rejectionReasonCode?: string | null;
}): BlueprintAuthoringSanitizedRoute {
  if (!blueprintAuthoringInputAccountingIsValid(input.byteAccounting)) {
    throw new Error(
      'sanitized capture route byte accounting is structurally invalid',
    );
  }
  const bound = blueprintAuthoringConservativeInputTokenUpperBound(
    input.byteAccounting,
  );
  const admitted = blueprintAuthoringInputTokensAreAdmissible(
    input.byteAccounting,
  );
  const observedInputTokens =
    admitted &&
    typeof input.observedInputTokens === 'number' &&
    nonNegativeSafeInteger(input.observedInputTokens)
      ? input.observedInputTokens
      : null;
  if (observedInputTokens !== null && observedInputTokens > bound) {
    // Fail closed: a real token count above the conservative upper bound would
    // mean the bound was mis-derived. Never emit a self-contradicting capture.
    throw new Error(
      'observed input tokens exceed the conservative upper bound; capture would be unsound',
    );
  }
  const rejectionReasonCode = admitted
    ? null
    : typeof input.rejectionReasonCode === 'string' &&
        SAFE_SNAKE.test(input.rejectionReasonCode)
      ? input.rejectionReasonCode
      : 'repair_route_input_not_admissible';
  return {
    routeKind: input.routeKind,
    ordinal: input.ordinal,
    byteAccounting: { ...input.byteAccounting },
    conservativeInputTokenUpperBound: bound,
    admitted,
    observedInputTokens,
    rejectionReasonCode,
  };
}

/**
 * Build a versioned, content-addressed, fail-closed sanitized failure capture from
 * the in-memory structured diagnostics and per-route admission accountings. The
 * builder never reads raw draft/provider output; it consumes only structured
 * diagnostic identities and byte accountings.
 */
export function buildBlueprintAuthoringSanitizedFailureCapture(args: {
  terminalFailureCode: AuthoringTerminalFailureCode | string;
  terminalReceiptDigest: string;
  requestDigest: string;
  contextDigest: string;
  routes: ReadonlyArray<{
    routeKind: BlueprintAuthoringSanitizedRouteKind;
    ordinal: number;
    byteAccounting: BlueprintAuthoringInputAccounting;
    observedInputTokens?: number | null;
    rejectionReasonCode?: string | null;
  }>;
  diagnostics: readonly PreRenderBlueprintRepairDiagnostic[];
}): BlueprintAuthoringSanitizedFailureCapture {
  if (
    typeof args.terminalFailureCode !== 'string' ||
    !SAFE_SNAKE.test(args.terminalFailureCode)
  ) {
    throw new Error('terminal failure code is not a bounded snake_case identifier');
  }
  for (const digest of [
    args.terminalReceiptDigest,
    args.requestDigest,
    args.contextDigest,
  ]) {
    if (typeof digest !== 'string' || !HEX_SHA256.test(digest)) {
      throw new Error('capture linkage digest is not a canonical sha256 hex digest');
    }
  }
  if (args.routes.length === 0 || args.routes.length > MAX_SANITIZED_ROUTES) {
    throw new Error('sanitized capture must carry 1..N bounded admission routes');
  }
  const routes = args.routes.map(sanitizedRoute);
  if (routes.filter((route) => route.routeKind === 'initial').length !== 1) {
    throw new Error('sanitized capture must carry exactly one initial route');
  }
  const seenOrdinals = new Set<number>();
  for (const route of routes) {
    if (!nonNegativeSafeInteger(route.ordinal) || seenOrdinals.has(route.ordinal)) {
      throw new Error('sanitized capture route ordinals must be unique non-negative integers');
    }
    seenOrdinals.add(route.ordinal);
  }

  // Group and COUNT by the SANITIZED identity: two raw diagnostics that project to
  // the same sanitized structural identity (e.g. they differ only in a redacted name
  // or in prose that is never retained) are the same census identity, so distinct-vs-
  // repeated is truthful over the definition that is actually persisted. The raw
  // grouping is lossless per byte-identical tuple; this merge then collapses raw
  // groups that share a sanitized identity, summing their repetition counts.
  const grouped = groupPreRenderBlueprintRepairDiagnostics(args.diagnostics);
  const mergedById = new Map<string, BlueprintAuthoringSanitizedCensusIdentity>();
  for (const [code, field, , expected, actual, count] of grouped) {
    const projection = sanitizedCensusIdentityProjection(
      code,
      field,
      expected[0] === 1,
      actual[0] === 1,
    );
    const identityDigest = sanitizedCensusIdentityDigest(projection);
    const existing = mergedById.get(identityDigest);
    if (existing) {
      existing.repetitionCount += count;
    } else {
      mergedById.set(identityDigest, {
        ...projection,
        identityDigest,
        repetitionCount: count,
      });
    }
  }
  const allIdentities = [...mergedById.values()].sort((left, right) =>
    left.identityDigest < right.identityDigest
      ? -1
      : left.identityDigest > right.identityDigest
        ? 1
        : 0,
  );
  const distinctIdentities = allIdentities.length;
  if (distinctIdentities > MAX_SANITIZED_CENSUS_IDENTITIES) {
    // Fail closed: a complete census cannot omit distinct identities. Rather than
    // truncate-and-mislabel, refuse to mint any capture. The runner's typed capture
    // derivation turns this throw into a `derivation_failed` disposition (never a null
    // "no capture" a caller could mistake for an allowed absence), which the lifecycle
    // drives into the incident path — so a terminal never claims a complete census it
    // does not actually have.
    throw new Error(
      `sanitized census would omit distinct identities (${distinctIdentities} > ${MAX_SANITIZED_CENSUS_IDENTITIES}); refusing to mint an incomplete census`,
    );
  }
  const totalEmitted = allIdentities.reduce(
    (sum, identity) => sum + identity.repetitionCount,
    0,
  );
  // The census is always COMPLETE: every distinct identity is retained.
  const fullCensusDigest = canonicalJsonDigest(allIdentities);
  const identities = allIdentities;
  const retainedIdentities = identities.length;

  const withoutDigest: Omit<
    BlueprintAuthoringSanitizedFailureCapture,
    'digest'
  > = {
    version: BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION,
    scope: BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_SCOPE,
    doesNotAuthorize: [
      ...BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_DOES_NOT_AUTHORIZE,
    ],
    terminalFailureCode: args.terminalFailureCode,
    linkage: {
      terminalReceiptDigest: args.terminalReceiptDigest,
      requestDigest: args.requestDigest,
      contextDigest: args.contextDigest,
    },
    admission: {
      policyVersion: BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION,
      boundBasis: BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS,
      ceilingTokens: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
      routes,
    },
    census: {
      totalEmitted,
      distinctIdentities,
      retainedIdentities,
      truncated: retainedIdentities < distinctIdentities,
      omittedDistinctIdentities: distinctIdentities - retainedIdentities,
      fullCensusDigest,
      identities,
    },
    digestAlgorithm: BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_DIGEST_ALGORITHM,
  };
  return {
    ...withoutDigest,
    digest: canonicalJsonDigest(withoutDigest),
  };
}

export function blueprintAuthoringSanitizedFailureCaptureBytes(
  capture: BlueprintAuthoringSanitizedFailureCapture,
): string {
  return `${JSON.stringify(capture, null, 2)}\n`;
}

const CAPTURE_KEYS = [
  'admission',
  'census',
  'digest',
  'digestAlgorithm',
  'doesNotAuthorize',
  'linkage',
  'scope',
  'terminalFailureCode',
  'version',
].sort();
const LINKAGE_KEYS = ['contextDigest', 'requestDigest', 'terminalReceiptDigest'].sort();
const ADMISSION_KEYS = ['boundBasis', 'ceilingTokens', 'policyVersion', 'routes'].sort();
const ROUTE_KEYS = [
  'admitted',
  'byteAccounting',
  'conservativeInputTokenUpperBound',
  'observedInputTokens',
  'ordinal',
  'rejectionReasonCode',
  'routeKind',
].sort();
const CENSUS_KEYS = [
  'distinctIdentities',
  'fullCensusDigest',
  'identities',
  'omittedDistinctIdentities',
  'retainedIdentities',
  'totalEmitted',
  'truncated',
].sort();
const IDENTITY_KEYS = [
  'actualPresent',
  'code',
  'expectedPresent',
  'fieldPath',
  'fieldPathDepth',
  'fieldPresent',
  'fieldRedacted',
  'identityDigest',
  'repetitionCount',
].sort();

function keysAre(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Recursive structural leak scan: every string anywhere in the capture must be a
 * bounded structural token (no spaces, quotes, or non-ASCII). This makes leaked
 * prose / names / phrases structurally impossible to validate.
 */
function noProseLeak(value: unknown, depth = 0): boolean {
  if (depth > 12) return false;
  if (typeof value === 'string') return safeStringWithin(value);
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean' || value === null) return true;
  if (Array.isArray(value)) return value.every((entry) => noProseLeak(entry, depth + 1));
  if (record(value)) {
    return Object.values(value).every((entry) => noProseLeak(entry, depth + 1));
  }
  return false;
}

function routeIsValid(value: unknown): value is BlueprintAuthoringSanitizedRoute {
  if (!record(value) || !keysAre(value, ROUTE_KEYS)) return false;
  if (value.routeKind !== 'initial' && value.routeKind !== 'repair') return false;
  if (!nonNegativeSafeInteger(value.ordinal)) return false;
  if (!blueprintAuthoringInputAccountingIsValid(value.byteAccounting)) return false;
  const bound = value.byteAccounting.estimatedBytes;
  if (value.conservativeInputTokenUpperBound !== bound) return false;
  const admitted = blueprintAuthoringInputTokensAreAdmissible(value.byteAccounting);
  if (value.admitted !== admitted) return false;
  if (value.observedInputTokens !== null) {
    if (
      !admitted ||
      !nonNegativeSafeInteger(value.observedInputTokens) ||
      value.observedInputTokens > bound
    ) {
      return false;
    }
  }
  if (admitted) {
    if (value.rejectionReasonCode !== null) return false;
  } else {
    if (
      typeof value.rejectionReasonCode !== 'string' ||
      !SAFE_SNAKE.test(value.rejectionReasonCode)
    ) {
      return false;
    }
  }
  return true;
}

function identityIsValid(
  value: unknown,
): value is BlueprintAuthoringSanitizedCensusIdentity {
  if (!record(value) || !keysAre(value, IDENTITY_KEYS)) return false;
  if (typeof value.code !== 'string' || !SAFE_SNAKE.test(value.code)) return false;
  if (typeof value.fieldPresent !== 'boolean') return false;
  if (typeof value.fieldRedacted !== 'boolean') return false;
  if (typeof value.expectedPresent !== 'boolean') return false;
  if (typeof value.actualPresent !== 'boolean') return false;
  if (!nonNegativeSafeInteger(value.repetitionCount) || value.repetitionCount < 1) {
    return false;
  }
  const path = value.fieldPath;
  if (path !== null) {
    if (
      !Array.isArray(path) ||
      path.length === 0 ||
      path.length > MAX_FIELD_PATH_DEPTH ||
      // Re-enforce the closed vocabulary on reload: every token must be an index,
      // the redaction sentinel, or a known structural key. An out-of-vocabulary
      // identifier can never validate.
      !path.every(safePathTokenIsValid)
    ) {
      return false;
    }
  }
  const expectedDepth = path === null ? 0 : path.length;
  if (value.fieldPathDepth !== expectedDepth) return false;
  // Presence / redaction consistency.
  const presenceConsistent = !value.fieldPresent
    ? // Absent field: nothing retained, not redacted.
      path === null && value.fieldRedacted === false
    : path === null
      ? // Present but untokenizable -> must be flagged redacted, nothing retained.
        value.fieldRedacted === true
      : // Present & tokenized -> redacted iff a segment was replaced by the sentinel.
        value.fieldRedacted === (path as string[]).includes(REDACTED_PATH_SEGMENT);
  if (!presenceConsistent) return false;
  // Re-derive the identity digest over the SANITIZED structural projection ONLY and
  // require an exact match. This both pins the digest to non-forgeable content and
  // proves — structurally, on reload — that it is a function of non-PII fields only,
  // never of any raw diagnostic message/field-value/expected/actual.
  const projection: SanitizedCensusIdentityProjection = {
    code: value.code as string,
    fieldPresent: value.fieldPresent as boolean,
    fieldPath: value.fieldPath as string[] | null,
    fieldPathDepth: value.fieldPathDepth as number,
    fieldRedacted: value.fieldRedacted as boolean,
    expectedPresent: value.expectedPresent as boolean,
    actualPresent: value.actualPresent as boolean,
  };
  return (
    typeof value.identityDigest === 'string' &&
    HEX_SHA256.test(value.identityDigest) &&
    sanitizedCensusIdentityDigest(projection) === value.identityDigest
  );
}

function censusIsValid(value: unknown): value is BlueprintAuthoringSanitizedCensus {
  if (!record(value) || !keysAre(value, CENSUS_KEYS)) return false;
  if (
    !nonNegativeSafeInteger(value.totalEmitted) ||
    !nonNegativeSafeInteger(value.distinctIdentities) ||
    !nonNegativeSafeInteger(value.retainedIdentities) ||
    !nonNegativeSafeInteger(value.omittedDistinctIdentities)
  ) {
    return false;
  }
  if (typeof value.fullCensusDigest !== 'string' || !HEX_SHA256.test(value.fullCensusDigest)) {
    return false;
  }
  if (typeof value.truncated !== 'boolean') return false;
  const identities = value.identities;
  if (
    !Array.isArray(identities) ||
    identities.length > MAX_SANITIZED_CENSUS_IDENTITIES ||
    identities.length !== value.retainedIdentities ||
    !identities.every(identityIsValid)
  ) {
    return false;
  }
  // Structural accounting invariants.
  if (value.retainedIdentities > value.distinctIdentities) return false;
  if (value.omittedDistinctIdentities !== value.distinctIdentities - value.retainedIdentities) {
    return false;
  }
  if (value.truncated !== value.retainedIdentities < value.distinctIdentities) return false;
  // Completeness: a valid capture NEVER omits distinct identities. An artifact
  // claiming truncation / omission is invalid; there is no valid incomplete
  // census. (Overflow fails closed at build time, minting no capture at all.)
  if (value.truncated !== false) return false;
  if (value.omittedDistinctIdentities !== 0) return false;
  if (value.retainedIdentities !== value.distinctIdentities) return false;
  if (value.distinctIdentities > value.totalEmitted) return false;
  if ((value.totalEmitted === 0) !== (value.distinctIdentities === 0)) return false;
  const retainedEmissions = (identities as BlueprintAuthoringSanitizedCensusIdentity[]).reduce(
    (sum, identity) => sum + identity.repetitionCount,
    0,
  );
  if (retainedEmissions > value.totalEmitted) return false;
  if (!value.truncated && retainedEmissions !== value.totalEmitted) return false;
  // No duplicated identities, and canonical (identityDigest-ascending) order.
  const digests = (identities as BlueprintAuthoringSanitizedCensusIdentity[]).map(
    (identity) => identity.identityDigest,
  );
  if (new Set(digests).size !== digests.length) return false;
  const sorted = [...digests].sort();
  if (JSON.stringify(digests) !== JSON.stringify(sorted)) return false;
  return true;
}

/**
 * Fail-closed validator for a persisted sanitized failure capture. Verifies exact
 * key sets, fixed literals, no-authority semantics, per-route admission soundness,
 * census completeness/order, a recomputed content digest, and — structurally — the
 * absence of any prose / name / phrase / PII.
 */
export function blueprintAuthoringSanitizedFailureCaptureIsValid(
  value: unknown,
): value is BlueprintAuthoringSanitizedFailureCapture {
  if (!record(value) || !keysAre(value, CAPTURE_KEYS)) return false;
  if (value.version !== BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION) return false;
  if (value.scope !== BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_SCOPE) return false;
  if (
    value.digestAlgorithm !==
    BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_DIGEST_ALGORITHM
  ) {
    return false;
  }
  if (
    !Array.isArray(value.doesNotAuthorize) ||
    JSON.stringify(value.doesNotAuthorize) !==
      JSON.stringify([
        ...BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_DOES_NOT_AUTHORIZE,
      ])
  ) {
    return false;
  }
  if (
    typeof value.terminalFailureCode !== 'string' ||
    !SAFE_SNAKE.test(value.terminalFailureCode)
  ) {
    return false;
  }
  if (!record(value.linkage) || !keysAre(value.linkage, LINKAGE_KEYS)) return false;
  for (const digest of Object.values(value.linkage)) {
    if (typeof digest !== 'string' || !HEX_SHA256.test(digest)) return false;
  }
  const admission = value.admission;
  if (!record(admission) || !keysAre(admission, ADMISSION_KEYS)) return false;
  if (admission.policyVersion !== BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION) {
    return false;
  }
  if (admission.boundBasis !== BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS) return false;
  if (admission.ceilingTokens !== BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS) return false;
  const routes = admission.routes;
  if (
    !Array.isArray(routes) ||
    routes.length === 0 ||
    routes.length > MAX_SANITIZED_ROUTES ||
    !routes.every(routeIsValid)
  ) {
    return false;
  }
  const typedRoutes = routes as BlueprintAuthoringSanitizedRoute[];
  if (typedRoutes.filter((route) => route.routeKind === 'initial').length !== 1) return false;
  const ordinals = typedRoutes.map((route) => route.ordinal);
  if (new Set(ordinals).size !== ordinals.length) return false;
  if (!censusIsValid(value.census)) return false;
  // Recompute the content digest over everything but the digest field.
  const { digest, ...withoutDigest } = value;
  if (typeof digest !== 'string' || !HEX_SHA256.test(digest)) return false;
  if (canonicalJsonDigest(withoutDigest) !== digest) return false;
  // Belt-and-suspenders structural leak scan.
  if (!noProseLeak(withoutDigest)) return false;
  return true;
}
