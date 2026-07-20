/**
 * (Human-QA release, mechanism c-ii) The SINGLE sanctioned writer of an asset's readiness-independent safety signal,
 * plus the structural override predicate the two gates share.
 *
 * WHY a single writer: Gate 2 (resolveSafetyDeliveryGate) is readiness-INDEPENDENT — it reads only ImageAsset /
 * GeneratedBook columns, so it cannot compare an operator override to the LIVE bytes the way Gate 1 can. Its
 * structural binding therefore relies on `safetyContentSha256` being written ATOMICALLY with `safetyHazards` (they
 * are one QA result), and on any prior override being RESET whenever the bytes change. Routing every safety-signal
 * write through these field-builders — enforced by asset-safety-writer-coverage.spec.ts — makes "forgot to co-write
 * the SHA / reset the override" a BUILD FAILURE, not a silent fail-open on the last line of defense.
 *
 * The detector's finding (`safetyHazards`) is NEVER deleted; the override is a SEPARATE signal.
 */

export interface AssetSafetySignal {
  /** isSafetyVerified(status): the safety check reached a positive determination (safe|hazard). */
  verified: boolean;
  /** The detector's confirmed hazards for these bytes (empty when safe). */
  hazards: string[];
  /** SHA-256 of the delivered bytes this signal describes. null when unknown → Gate 2 fails CLOSED for an override. */
  contentSha256: string | null;
}

/** The page ImageAsset safety fields — spread into the asset write. Co-writes the SHA and RESETS any prior override. */
export function imageAssetSafetyFields(s: AssetSafetySignal): {
  safetyVerified: boolean;
  safetyHazards: string[];
  safetyContentSha256: string | null;
  safetyOverriddenHazards: string[];
  safetyOverrideSha256: string | null;
} {
  return {
    safetyVerified: s.verified,
    safetyHazards: s.hazards,
    safetyContentSha256: s.contentSha256,
    safetyOverriddenHazards: [], // reset — a prior override bound to old bytes must never survive new bytes
    safetyOverrideSha256: null,
  };
}

/** The cover (GeneratedBook) twins of the page fields. */
export function coverSafetyFields(s: AssetSafetySignal): {
  coverSafetyVerified: boolean;
  coverSafetyHazards: string[];
  coverSafetyContentSha256: string | null;
  coverSafetyOverriddenHazards: string[];
  coverSafetyOverrideSha256: string | null;
} {
  return {
    coverSafetyVerified: s.verified,
    coverSafetyHazards: s.hazards,
    coverSafetyContentSha256: s.contentSha256,
    coverSafetyOverriddenHazards: [],
    coverSafetyOverrideSha256: null,
  };
}

/** A delivered-bytes SHA is a lowercase 64-hex string — exactly what `createHash('sha256').digest('hex')` emits. */
export const SAFETY_SHA256_RE = /^[0-9a-f]{64}$/;

/**
 * The STRUCTURAL override predicate for Gate 2 — a confirmed hazard is cleared ONLY by an operator override that is
 * bound to the CURRENT bytes. Order matters, and every guard is a deliberate fail-closed:
 *   1. NO found hazards → nothing to override. `.every` over `[]` is vacuously `true`, which would HONOR an override
 *      that clears no real hazard. This is the exported shared primitive; Gate 1 is not wired yet, so it must hold
 *      for callers that do not exist — return false rather than lean on today's call sites never reaching here.
 *   2. SHAPE, not just non-nullness. `null`/`undefined`/''/wrong-length/uppercase/any non-hex string fail HERE:
 *      `'' === ''` must NOT pass, and a malformed SHA can never legitimately bind to real bytes. (`null === null` is
 *      `true`, so a raw equality check would wrongly honor an un-QA'd asset — the regex closes that, INTENTIONALLY.)
 *   3. Byte binding — equal, well-formed SHAs.
 *   4. Coverage — every found hazard was explicitly overridden.
 */
export function isSafetyHazardOverridden(args: {
  hazards: string[];
  overriddenHazards: string[];
  contentSha256: string | null;
  overrideSha256: string | null;
}): boolean {
  if (args.hazards.length === 0) return false; // (1) nothing found → nothing to override; never vacuously true
  if (!SAFETY_SHA256_RE.test(args.overrideSha256 ?? '') || !SAFETY_SHA256_RE.test(args.contentSha256 ?? '')) {
    return false; // (2) malformed / empty / null SHA on EITHER side → fail closed, INTENTIONALLY
  }
  if (args.overrideSha256 !== args.contentSha256) return false; // (3) bound to THESE bytes only
  return args.hazards.every((h) => args.overriddenHazards.includes(h)); // (4) a hazard outside the overridden set holds
}
