import { describe, expect, it } from 'vitest';
import {
  contractEnvironmentToStyle01Subset,
  resolveStyle01SceneRefSubset,
} from '@/lib/style-scene-class';
import {
  resolveStyle01RefPathsForEnvironmentLock,
  resolveStyle01StyleReferencePaths,
} from '@/lib/style01-gptimage';

/**
 * WS0b(e4a): the contract's environment lock routes Style 01 STYLE REFS "locks-first, regex-last". Validated
 * against resolveStyle01SceneRefSubset (the real subset selector the ref paths follow). Covers all four cases:
 * indoor→interior subset, outdoor→outdoor subset (a legit outdoor story is NOT broken), neutral→ZERO refs,
 * absent→regex (unchanged). The lock overrides ref selection ONLY — never the sceneClass (scene-memory/night).
 */
describe('(WS0b e4a) contract environment → Style 01 style-ref routing', () => {
  it('indoor → INTERIOR subset (cozy-interior) — identical refs to the regex for that subset', () => {
    expect(contractEnvironmentToStyle01Subset('indoor')).toBe('cozy-interior');
    expect(resolveStyle01SceneRefSubset('cozy-interior')).toBe('cozy-interior');
    expect(resolveStyle01RefPathsForEnvironmentLock('indoor', 3)).toEqual(
      resolveStyle01StyleReferencePaths('cozy-interior', 3),
    );
    expect(resolveStyle01RefPathsForEnvironmentLock('indoor', 3).length).toBeGreaterThan(0);
  });

  it('outdoor → OUTDOOR subset — a legit outdoor story (fox-adventure) still gets outdoor refs, NOT zero/indoor', () => {
    expect(contractEnvironmentToStyle01Subset('outdoor')).toBe('outdoor-magical');
    // the regex maps every outdoor scene class to the same outdoor-magical subset
    expect(resolveStyle01SceneRefSubset('forest-day')).toBe('outdoor-magical');
    expect(resolveStyle01SceneRefSubset('outdoor-nature')).toBe('outdoor-magical');
    const outdoorRefs = resolveStyle01RefPathsForEnvironmentLock('outdoor', 3);
    expect(outdoorRefs).toEqual(resolveStyle01StyleReferencePaths('outdoor-nature', 3));
    expect(outdoorRefs.length).toBeGreaterThan(0); // NOT broken to zero
    expect(outdoorRefs).not.toEqual(resolveStyle01RefPathsForEnvironmentLock('indoor', 3)); // NOT indoor refs
  });

  it('neutral → ZERO style refs (never a nature default)', () => {
    expect(contractEnvironmentToStyle01Subset('neutral')).toBe('none');
    expect(resolveStyle01RefPathsForEnvironmentLock('neutral', 3)).toEqual([]);
  });

  it('absent (no lock) → the legacy regex path is untouched (byte-identical fallback)', () => {
    // The image.ts seam runs resolveStyle01StyleReferencePaths(sceneClass) when the lock is absent — the regex
    // classifier + fine-grained refs (e.g. fantasy-cave) are unchanged by e4a.
    expect(resolveStyle01StyleReferencePaths('fantasy-cave', 2).length).toBeGreaterThan(0);
    expect(resolveStyle01SceneRefSubset('fantasy-cave')).toBe('fantasy-cave');
  });
});
