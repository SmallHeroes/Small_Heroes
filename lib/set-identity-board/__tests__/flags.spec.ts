import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isSetIdentityBoardEnabled } from '../flags';

/**
 * The env matrix for the ONE gate that lets an order onto the board path. The single most important row is the
 * first: on real Vercel Production the flag is false even when the var says true — a leaked env var must never
 * put a paying customer's book onto an un-cut-over path.
 */
describe('isSetIdentityBoardEnabled — env matrix', () => {
  const KEYS = ['VERCEL_ENV', 'SET_IDENTITY_BOARD'] as const;
  let snapshot: Record<string, string | undefined>;

  beforeEach(() => {
    snapshot = {};
    for (const k of KEYS) snapshot[k] = process.env[k];
    for (const k of KEYS) delete process.env[k];
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
  });

  it('is ALWAYS false on Vercel Production — even with SET_IDENTITY_BOARD=true', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.SET_IDENTITY_BOARD = 'true';
    expect(isSetIdentityBoardEnabled()).toBe(false);
  });

  it('is false on Vercel Production regardless of casing of the env value', () => {
    process.env.VERCEL_ENV = 'PRODUCTION';
    process.env.SET_IDENTITY_BOARD = 'true';
    expect(isSetIdentityBoardEnabled()).toBe(false);
  });

  it('requires the explicit flag on preview', () => {
    process.env.VERCEL_ENV = 'preview';
    expect(isSetIdentityBoardEnabled()).toBe(false);
    process.env.SET_IDENTITY_BOARD = 'true';
    expect(isSetIdentityBoardEnabled()).toBe(true);
  });

  it('requires the explicit flag on a local/staging runtime (VERCEL_ENV unset)', () => {
    expect(isSetIdentityBoardEnabled()).toBe(false);
    process.env.SET_IDENTITY_BOARD = 'true';
    expect(isSetIdentityBoardEnabled()).toBe(true);
  });

  it('is false for any value other than the exact string "true"', () => {
    process.env.VERCEL_ENV = 'preview';
    for (const v of ['1', 'yes', 'TRUE', 'on', '']) {
      process.env.SET_IDENTITY_BOARD = v;
      expect(isSetIdentityBoardEnabled()).toBe(false);
    }
  });

  it('is unset → false (the default posture)', () => {
    expect(isSetIdentityBoardEnabled()).toBe(false);
  });

  it('reads the env at CALL time, not at module load', () => {
    expect(isSetIdentityBoardEnabled()).toBe(false);
    process.env.SET_IDENTITY_BOARD = 'true';
    expect(isSetIdentityBoardEnabled()).toBe(true); // same module instance, flipped mid-process
    process.env.VERCEL_ENV = 'production';
    expect(isSetIdentityBoardEnabled()).toBe(false);
  });
});
