import { describe, expect, it } from 'vitest';

import { resolvePhotoGuidanceFromMetrics } from '../resemblance-core';

describe('PhotoGuidance fairness (resolvePhotoGuidanceFromMetrics)', () => {
  it('no_face_detected is warning-only — canContinue true, passed true, never weak inputStrength', () => {
    const guidance = resolvePhotoGuidanceFromMetrics({
      faceRatios: [],
      sharpness: 40,
      brightness: 35,
      normalizedSharpness: 0.2,
    });
    expect(guidance.canContinue).toBe(true);
    expect(guidance.passed).toBe(true);
    expect(guidance.warnings).toContain('no_face_detected');
    expect(guidance.inputStrength).not.toBe('weak');
  });

  it('dark low-brightness photo does not downgrade inputStrength to weak', () => {
    const guidance = resolvePhotoGuidanceFromMetrics({
      faceRatios: [0.14],
      sharpness: 25,
      brightness: 28,
      normalizedSharpness: 0.19,
    });
    expect(guidance.canContinue).toBe(true);
    expect(guidance.inputStrength).toBe('adequate');
    expect(guidance.warnings).not.toContain('no_face_detected');
  });

  it('clear face photo → adequate tier (same generation path as all uploads)', () => {
    const guidance = resolvePhotoGuidanceFromMetrics({
      faceRatios: [0.16],
      sharpness: 80,
      brightness: 90,
      normalizedSharpness: 0.3,
    });
    expect(guidance.inputStrength).toBe('adequate');
    expect(guidance.warnings).toHaveLength(0);
  });

  it('olive/yellow low red-channel heuristic (no skin blob) still continues with advisory', () => {
    const guidance = resolvePhotoGuidanceFromMetrics({
      faceRatios: [],
      sharpness: 55,
      brightness: 72,
      normalizedSharpness: 0.24,
    });
    expect(guidance.canContinue).toBe(true);
    expect(guidance.passed).toBe(true);
    expect(guidance.inputStrength).toBe('adequate');
  });

  it('blur and darkness produce warnings only — never block', () => {
    const guidance = resolvePhotoGuidanceFromMetrics({
      faceRatios: [0.08],
      sharpness: 8,
      brightness: 12,
      normalizedSharpness: 0.05,
    });
    expect(guidance.canContinue).toBe(true);
    expect(guidance.passed).toBe(true);
    expect(guidance.warnings.length).toBeGreaterThan(0);
    expect(guidance.inputStrength).toBe('adequate');
  });
});
