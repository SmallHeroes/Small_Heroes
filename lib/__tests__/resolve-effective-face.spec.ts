/**
 * Shared dominant-face rule (upload analyzer + checkout gate):
 * one clearly dominant child face passes even with small background faces;
 * several comparable faces have no dominant and must block.
 */
import { describe, expect, it } from 'vitest';
import { resolveEffectiveFace } from '../resemblance-core';

describe('resolveEffectiveFace', () => {
  it('single face → dominant', () => {
    const face = resolveEffectiveFace([0.15]);
    expect(face.faceCount).toBe(1);
    expect(face.hasDominant).toBe(true);
    expect(face.dominantFaceRatio).toBe(0.15);
  });

  it('ACCEPTANCE: dominant child + small background faces → passes the face rule', () => {
    // background faces below the comparable threshold (0.02) are invisible
    const face = resolveEffectiveFace([0.14, 0.018, 0.013]);
    expect(face.faceCount).toBe(3);
    expect(face.secondaryComparableRatio).toBe(0);
    expect(face.hasDominant).toBe(true);
  });

  it('ACCEPTANCE: dominant child + comparable-but-much-smaller face → still dominant (ratio ≥ 1.45)', () => {
    const face = resolveEffectiveFace([0.14, 0.05]);
    expect(face.hasDominant).toBe(true); // 0.14 / 0.05 = 2.8 ≥ 1.45, dominant ≥ 0.04
  });

  it('ACCEPTANCE: two comparable faces → no dominant, must block', () => {
    const face = resolveEffectiveFace([0.09, 0.08]);
    expect(face.faceCount).toBe(2);
    expect(face.hasDominant).toBe(false); // 0.09 / 0.08 ≈ 1.13 < 1.45
  });

  it('dominant face too small (< 0.04) with comparable secondary → not dominant', () => {
    const face = resolveEffectiveFace([0.035, 0.025]);
    expect(face.hasDominant).toBe(false);
  });

  it('tiny blobs below counted threshold (0.012) are ignored entirely', () => {
    const face = resolveEffectiveFace([0.011, 0.005]);
    expect(face.faceCount).toBe(0);
    expect(face.dominantFaceRatio).toBe(0);
  });

  it('zero faces → counts zero, hasDominant trivially true (callers check faceCount first)', () => {
    const face = resolveEffectiveFace([]);
    expect(face.faceCount).toBe(0);
    expect(face.hasDominant).toBe(true);
  });

  it('unsorted input is handled (sorts internally)', () => {
    const face = resolveEffectiveFace([0.02, 0.14]);
    expect(face.dominantFaceRatio).toBe(0.14);
    expect(face.hasDominant).toBe(true); // 0.14 / 0.02 = 7
  });
});
