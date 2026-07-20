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
