import { describe, it, expect } from 'vitest';

import {
  isSafetyHazardOverridden,
  imageAssetSafetyFields,
  coverSafetyFields,
} from '@/lib/generation-pipeline/asset-safety-signal';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

describe('isSafetyHazardOverridden — the structural, byte-bound override predicate (Gate 2)', () => {
  it('FAIL-CLOSED on an un-QA\'d asset (both SHAs null) — null === null is TRUE, guarded EXPLICITLY not by accident', () => {
    // This is the exact case the earlier phrasing (overrideSha === contentSha, no null guard) would WRONGLY honor.
    expect(isSafetyHazardOverridden({ hazards: ['railing'], overriddenHazards: ['railing'], contentSha256: null, overrideSha256: null })).toBe(false);
    // an all-null asset with NO hazards is still not "overridden" (there is nothing to override)
    expect(isSafetyHazardOverridden({ hazards: [], overriddenHazards: [], contentSha256: null, overrideSha256: null })).toBe(false);
  });

  it('FAIL-CLOSED when either SHA is null (a half-written / never-released signal)', () => {
    expect(isSafetyHazardOverridden({ hazards: ['railing'], overriddenHazards: ['railing'], contentSha256: SHA_A, overrideSha256: null })).toBe(false);
    expect(isSafetyHazardOverridden({ hazards: ['railing'], overriddenHazards: ['railing'], contentSha256: null, overrideSha256: SHA_A })).toBe(false);
  });

  it('FAIL-CLOSED when the override was made for DIFFERENT bytes (the widened hole: different image, same hazard string)', () => {
    // The operator released "railing" on bytes A; the asset now carries bytes B (also flagged "railing"). A hazard
    // STRING match must NOT ship B — the SHA binding closes it.
    expect(isSafetyHazardOverridden({ hazards: ['railing'], overriddenHazards: ['railing'], contentSha256: SHA_B, overrideSha256: SHA_A })).toBe(false);
  });

  it('FAIL-CLOSED when a found hazard is OUTSIDE the overridden set (you cannot override what you did not see)', () => {
    expect(isSafetyHazardOverridden({ hazards: ['railing', 'height'], overriddenHazards: ['railing'], contentSha256: SHA_A, overrideSha256: SHA_A })).toBe(false);
  });

  it('HONORED only when both SHAs are non-null AND equal AND every found hazard was overridden', () => {
    expect(isSafetyHazardOverridden({ hazards: ['railing'], overriddenHazards: ['railing'], contentSha256: SHA_A, overrideSha256: SHA_A })).toBe(true);
    expect(isSafetyHazardOverridden({ hazards: ['railing', 'height'], overriddenHazards: ['height', 'railing', 'extra'], contentSha256: SHA_A, overrideSha256: SHA_A })).toBe(true);
  });
});

describe('isSafetyHazardOverridden — P1a: an EMPTY found-hazard set is never vacuously honored', () => {
  it('FAIL-CLOSED with NO hazards even when the SHAs are valid and equal (`.every` over [] would return true)', () => {
    // The disqualifying case the guard must catch: a well-formed, byte-matched override that clears NOTHING real.
    // For Gate 2 today this is unreachable (the branch only runs when hazards.length > 0), but this is the exported
    // shared primitive and Gate 1 is not wired yet — it must hold for callers that do not exist.
    expect(isSafetyHazardOverridden({ hazards: [], overriddenHazards: [], contentSha256: SHA_A, overrideSha256: SHA_A })).toBe(false);
    expect(isSafetyHazardOverridden({ hazards: [], overriddenHazards: ['railing'], contentSha256: SHA_A, overrideSha256: SHA_A })).toBe(false);
  });
});

describe('isSafetyHazardOverridden — P0: SHA SHAPE is validated, not just non-nullness', () => {
  const HAZ = { hazards: ['railing'], overriddenHazards: ['railing'] };
  // Each malformed SHA must fail closed — an empty string is the headline defect: `'' === ''` is true, so a bare
  // equality check would HONOR two empty SHAs. Also wrong-length, uppercase, and non-hex can never bind to real bytes.
  const bad: Array<[string, string]> = [
    ['empty string', ''],
    ['too short (63 hex)', 'a'.repeat(63)],
    ['too long (65 hex)', 'a'.repeat(65)],
    ['uppercase hex', 'A'.repeat(64)],
    ['non-hex letters', 'g'.repeat(64)],
    ['64 spaces', ' '.repeat(64)],
  ];

  for (const [label, malformed] of bad) {
    it(`FAIL-CLOSED when the OVERRIDE SHA is ${label} (content valid)`, () => {
      expect(isSafetyHazardOverridden({ ...HAZ, contentSha256: SHA_A, overrideSha256: malformed })).toBe(false);
    });
    it(`FAIL-CLOSED when the CONTENT SHA is ${label} (override valid)`, () => {
      expect(isSafetyHazardOverridden({ ...HAZ, contentSha256: malformed, overrideSha256: SHA_A })).toBe(false);
    });
    it(`FAIL-CLOSED when BOTH SHAs are ${label} (identical-but-malformed must NOT pass equality)`, () => {
      expect(isSafetyHazardOverridden({ ...HAZ, contentSha256: malformed, overrideSha256: malformed })).toBe(false);
    });
  }

  it('FAIL-CLOSED when a SHA is undefined at runtime (outside the string|null type, but callers can still pass it)', () => {
    const undef = undefined as unknown as null;
    expect(isSafetyHazardOverridden({ ...HAZ, contentSha256: SHA_A, overrideSha256: undef })).toBe(false);
    expect(isSafetyHazardOverridden({ ...HAZ, contentSha256: undef, overrideSha256: SHA_A })).toBe(false);
  });
});

describe('the single writer resets the override + co-writes the content SHA (so a stale override cannot survive new bytes)', () => {
  it('imageAssetSafetyFields always resets safetyOverriddenHazards + safetyOverrideSha256 and co-writes the SHA', () => {
    expect(imageAssetSafetyFields({ verified: true, hazards: ['railing'], contentSha256: SHA_A })).toEqual({
      safetyVerified: true, safetyHazards: ['railing'], safetyContentSha256: SHA_A,
      safetyOverriddenHazards: [], safetyOverrideSha256: null,
    });
  });

  it('coverSafetyFields does the same for the cover', () => {
    expect(coverSafetyFields({ verified: false, hazards: [], contentSha256: null })).toEqual({
      coverSafetyVerified: false, coverSafetyHazards: [], coverSafetyContentSha256: null,
      coverSafetyOverriddenHazards: [], coverSafetyOverrideSha256: null,
    });
  });
});
