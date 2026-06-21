import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ProdGenerationDisabledError,
  assertProdGenerationAllowed,
  isProdGenerationDisabled,
} from '../env-separation-guard';

const KEYS = ['VERCEL_ENV', 'ENABLE_PROD_GENERATION'] as const;

describe('prod-generation hard-disable guard (P0 cutover)', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of KEYS) saved[k] = process.env[k];
    for (const k of KEYS) delete process.env[k];
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('BLOCKS on Production when ENABLE_PROD_GENERATION is unset', () => {
    process.env.VERCEL_ENV = 'production';
    expect(isProdGenerationDisabled()).toBe(true);
    expect(() => assertProdGenerationAllowed()).toThrow(ProdGenerationDisabledError);
  });

  it('BLOCKS on Production when ENABLE_PROD_GENERATION is anything but "true"', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.ENABLE_PROD_GENERATION = 'false';
    expect(isProdGenerationDisabled()).toBe(true);
    expect(() => assertProdGenerationAllowed()).toThrow(/hard-disabled/);
  });

  it('ALLOWS on Production when ENABLE_PROD_GENERATION="true"', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.ENABLE_PROD_GENERATION = 'true';
    expect(isProdGenerationDisabled()).toBe(false);
    expect(() => assertProdGenerationAllowed()).not.toThrow();
  });

  it('ALLOWS on Preview — QA must keep rendering (never gated)', () => {
    process.env.VERCEL_ENV = 'preview';
    expect(isProdGenerationDisabled()).toBe(false);
    expect(() => assertProdGenerationAllowed()).not.toThrow();
    // even with the flag unset, and even if someone set it false on preview:
    process.env.ENABLE_PROD_GENERATION = 'false';
    expect(isProdGenerationDisabled()).toBe(false);
  });

  it('ALLOWS on local dev (no VERCEL_ENV)', () => {
    expect(isProdGenerationDisabled()).toBe(false);
    expect(() => assertProdGenerationAllowed()).not.toThrow();
  });

  it('the thrown error carries the route-level code generation_disabled_on_prod', () => {
    process.env.VERCEL_ENV = 'production';
    try {
      assertProdGenerationAllowed();
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProdGenerationDisabledError);
      expect((err as ProdGenerationDisabledError).code).toBe('generation_disabled_on_prod');
    }
  });
});
