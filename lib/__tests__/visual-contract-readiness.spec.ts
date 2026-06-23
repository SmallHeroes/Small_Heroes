import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  assessStoryRenderReadiness,
  deriveStoryKey,
  isVisualContractGateEnabled,
  CALIBRATION_TRUSTED_STORY_KEYS,
} from '../visual-contract/render-readiness';

const ENV = 'VISUAL_CONTRACT_GATE_ENABLED';
let prev: string | undefined;
beforeEach(() => {
  prev = process.env[ENV];
});
afterEach(() => {
  if (prev === undefined) delete process.env[ENV];
  else process.env[ENV] = prev;
});

describe('deriveStoryKey', () => {
  it('builds companionId_direction (lowercased)', () => {
    expect(deriveStoryKey('lion_shaket', 'Adventure')).toBe('lion_shaket_adventure');
  });
  it('returns null when either part is missing', () => {
    expect(deriveStoryKey(null, 'adventure')).toBeNull();
    expect(deriveStoryKey('lion_shaket', null)).toBeNull();
  });
});

describe('assessStoryRenderReadiness — fail-closed precondition (amendment #5)', () => {
  it('is a no-op when the gate flag is disabled (does not block existing slots)', () => {
    delete process.env[ENV];
    expect(isVisualContractGateEnabled()).toBe(false);
    expect(assessStoryRenderReadiness('anything_at_all').allowed).toBe(true);
    expect(assessStoryRenderReadiness(null).allowed).toBe(true);
  });

  it('ALLOWS a calibration-trusted, render-ready story when enabled', () => {
    process.env[ENV] = 'true';
    expect(CALIBRATION_TRUSTED_STORY_KEYS.has('lion_shaket_adventure')).toBe(true);
    const r = assessStoryRenderReadiness('lion_shaket_adventure');
    expect(r.allowed).toBe(true);
  });

  it('BLOCKS a not-yet-calibrated story when enabled (text-approved != render-ready)', () => {
    process.env[ENV] = 'true';
    const r = assessStoryRenderReadiness('fox_uri_adventure');
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/not calibration-trusted/);
  });

  it('BLOCKS when the story key cannot be derived', () => {
    process.env[ENV] = 'true';
    const r = assessStoryRenderReadiness(null);
    expect(r.allowed).toBe(false);
  });
});
