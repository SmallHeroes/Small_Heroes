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
 *  - a safe structural field-path token (schema key or `[index]`),
 *  - or one of a handful of fixed literal enum/version strings.
 * The diagnostic `message`, `expected`, and `actual` values (which can carry prose
 * or names) are NEVER retained — only their presence flags and a content digest of
 * the full grouped identity survive. The validator additionally runs a recursive
 * structural scan that rejects any string containing spaces, quotes, or non-ASCII,
 * so a leaked name/phrase cannot validate. Leak-freedom is therefore structural and
 * testable, not merely a convention.
 *
 * ## What it does not do
 *
 * The historical failed attempt cannot be retroactively upgraded: its concrete 86
 * identities were never persisted and remain unknowable. This artifact prevents
 * future blindness; it does not reconstruct the past.
 */
export const BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION =
  'blueprint-authoring-sanitized-failure-capture/v1' as const;

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

const MAX_SANITIZED_CENSUS_IDENTITIES = 256;
const MAX_SANITIZED_ROUTES = 8;
const MAX_FIELD_PATH_DEPTH = 32;
const MAX_SANITIZED_STRING_LENGTH = 128;

const HEX_SHA256 = /^[a-f0-9]{64}$/;
const SAFE_SNAKE = /^[a-z][a-z0-9_]{0,63}$/;
const SAFE_PATH_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const SAFE_PATH_INDEX = /^\[\d+\]$/;
/** Structural superset used by the recursive leak scan. Excludes spaces, quotes, non-ASCII. */
const SAFE_STRUCTURAL_STRING = /^[\w:/.#\[\]-]{1,128}$/;

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
  /** Content digest of the full grouped identity (code+field+message+expected+actual). */
  detailDigest: string;
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

/**
 * Deterministically sanitize a diagnostic `field` into safe structural path tokens.
 * Returns { path: null, redacted: false } when no field was present, { path: null,
 * redacted: true } when a field was present but could not be tokenized to keys /
 * indices (so no prose can leak), or the safe token array otherwise.
 */
export function sanitizeBlueprintDiagnosticFieldPath(
  field: string | null | undefined,
): { present: boolean; path: string[] | null; redacted: boolean } {
  if (typeof field !== 'string' || field.length === 0) {
    return { present: false, path: null, redacted: false };
  }
  const tokens: string[] = [];
  let rest = field;
  const tokenRe = /^(?:\.?([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\])/;
  while (rest.length > 0) {
    const match = tokenRe.exec(rest);
    if (!match) {
      return { present: true, path: null, redacted: true };
    }
    if (match[1] !== undefined) {
      tokens.push(match[1]);
    } else if (match[2] !== undefined) {
      tokens.push(`[${match[2]}]`);
    } else {
      return { present: true, path: null, redacted: true };
    }
    rest = rest.slice(match[0].length);
  }
  if (
    tokens.length === 0 ||
    tokens.length > MAX_FIELD_PATH_DEPTH ||
    !tokens.every(
      (token) => SAFE_PATH_KEY.test(token) || SAFE_PATH_INDEX.test(token),
    )
  ) {
    return { present: true, path: null, redacted: true };
  }
  return { present: true, path: tokens, redacted: false };
}

function sanitizedCensusIdentity(
  grouped: readonly [
    code: PreRenderBlueprintRepairDiagnostic['code'],
    field: string | null,
    message: string,
    expected: readonly [present: 0 | 1, value: unknown],
    actual: readonly [present: 0 | 1, value: unknown],
    count: number,
  ],
): BlueprintAuthoringSanitizedCensusIdentity {
  const [code, field, message, expected, actual, count] = grouped;
  const path = sanitizeBlueprintDiagnosticFieldPath(field);
  // Detail digest over the full identity WITHOUT the repetition count, so identical
  // identities share a digest and distinct defects get distinct digests.
  const detailDigest = canonicalJsonDigest([
    code,
    field ?? null,
    message,
    expected,
    actual,
  ]);
  return {
    code,
    fieldPresent: path.present,
    fieldPath: path.path,
    fieldPathDepth: path.path?.length ?? 0,
    fieldRedacted: path.redacted,
    expectedPresent: expected[0] === 1,
    actualPresent: actual[0] === 1,
    detailDigest,
    repetitionCount: count,
  };
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

  const grouped = groupPreRenderBlueprintRepairDiagnostics(args.diagnostics);
  const allIdentities = grouped
    .map(sanitizedCensusIdentity)
    .sort((left, right) =>
      left.detailDigest < right.detailDigest
        ? -1
        : left.detailDigest > right.detailDigest
          ? 1
          : 0,
    );
  const totalEmitted = allIdentities.reduce(
    (sum, identity) => sum + identity.repetitionCount,
    0,
  );
  const distinctIdentities = allIdentities.length;
  const fullCensusDigest = canonicalJsonDigest(allIdentities);
  const identities = allIdentities.slice(0, MAX_SANITIZED_CENSUS_IDENTITIES);
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
  'detailDigest',
  'expectedPresent',
  'fieldPath',
  'fieldPathDepth',
  'fieldPresent',
  'fieldRedacted',
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
  if (typeof value.detailDigest !== 'string' || !HEX_SHA256.test(value.detailDigest)) {
    return false;
  }
  if (!nonNegativeSafeInteger(value.repetitionCount) || value.repetitionCount < 1) {
    return false;
  }
  const path = value.fieldPath;
  if (path !== null) {
    if (
      !Array.isArray(path) ||
      path.length === 0 ||
      path.length > MAX_FIELD_PATH_DEPTH ||
      !path.every(
        (token) =>
          typeof token === 'string' &&
          (SAFE_PATH_KEY.test(token) || SAFE_PATH_INDEX.test(token)),
      )
    ) {
      return false;
    }
  }
  const expectedDepth = path === null ? 0 : path.length;
  if (value.fieldPathDepth !== expectedDepth) return false;
  // Presence / redaction consistency.
  if (!value.fieldPresent && (path !== null || value.fieldRedacted)) return false;
  if (value.fieldRedacted && (path !== null || !value.fieldPresent)) return false;
  return true;
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
  if (value.distinctIdentities > value.totalEmitted) return false;
  if ((value.totalEmitted === 0) !== (value.distinctIdentities === 0)) return false;
  const retainedEmissions = (identities as BlueprintAuthoringSanitizedCensusIdentity[]).reduce(
    (sum, identity) => sum + identity.repetitionCount,
    0,
  );
  if (retainedEmissions > value.totalEmitted) return false;
  if (!value.truncated && retainedEmissions !== value.totalEmitted) return false;
  // No duplicated identities, and canonical (detailDigest-ascending) order.
  const digests = (identities as BlueprintAuthoringSanitizedCensusIdentity[]).map(
    (identity) => identity.detailDigest,
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
