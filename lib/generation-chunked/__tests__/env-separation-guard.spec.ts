import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertEnvSeparation,
  findProdResourceLeak,
  isProductionRuntime,
} from '../env-separation-guard';

const KEYS = [
  'VERCEL_ENV',
  'NEXT_PUBLIC_APP_URL',
  'APP_URL',
  'SUPABASE_URL',
  'DATABASE_URL',
  'GENERATION_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PAYMENT_PROVIDER',
  'ENABLE_FAKE_PAYMENT',
  'ALLOW_FAKE_PAYMENTS',
  'IMAGE_PROVIDER',
  'OPENAI_API_KEY',
] as const;

describe('env-separation guard (0089 P0)', () => {
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

  it('throws when a Preview runtime points NEXT_PUBLIC_APP_URL at the prod domain', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.NEXT_PUBLIC_APP_URL = 'https://smallheroes.co.il';
    process.env.SUPABASE_URL = 'https://qvksgpzzosotubcbizay.supabase.co';
    expect(() => assertEnvSeparation()).toThrow(/PRODUCTION domain/);
  });

  it('throws when a non-prod runtime points SUPABASE_URL at the prod project', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.NEXT_PUBLIC_APP_URL = 'https://preview.vercel.app';
    process.env.SUPABASE_URL = 'https://ozxjmnzybzetqudivlbw.supabase.co';
    expect(() => assertEnvSeparation()).toThrow(/PRODUCTION Supabase project/);
  });

  it('guards the shared worker entrypoint before lease/DB work', async () => {
    vi.resetModules();
    process.env.VERCEL_ENV = 'preview';
    process.env.NEXT_PUBLIC_APP_URL = 'https://preview.vercel.app';
    process.env.SUPABASE_URL = 'https://ozxjmnzybzetqudivlbw.supabase.co';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
    process.env.GENERATION_SECRET = 'test-secret';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
    process.env.PAYMENT_PROVIDER = 'fake';
    process.env.ENABLE_FAKE_PAYMENT = 'true';
    process.env.ALLOW_FAKE_PAYMENTS = 'true';
    process.env.IMAGE_PROVIDER = 'gpt-image';
    process.env.OPENAI_API_KEY = 'sk-test';
    const { runGenerationWorkerInvocation } = await import('../process-worker');
    await expect(runGenerationWorkerInvocation('ord_env_guard')).rejects.toThrow(
      /PRODUCTION Supabase project/
    );
  });

  it('guards chunked start before order/job DB writes', async () => {
    vi.resetModules();
    process.env.VERCEL_ENV = 'preview';
    process.env.NEXT_PUBLIC_APP_URL = 'https://preview.vercel.app';
    process.env.SUPABASE_URL = 'https://ozxjmnzybzetqudivlbw.supabase.co';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
    process.env.GENERATION_SECRET = 'test-secret';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
    process.env.PAYMENT_PROVIDER = 'fake';
    process.env.ENABLE_FAKE_PAYMENT = 'true';
    process.env.ALLOW_FAKE_PAYMENTS = 'true';
    process.env.IMAGE_PROVIDER = 'gpt-image';
    process.env.OPENAI_API_KEY = 'sk-test';
    const { startChunkedGeneration } = await import('../start');
    await expect(startChunkedGeneration('ord_env_guard', 'test')).rejects.toThrow(
      /PRODUCTION Supabase project/
    );
  });

  it('does NOT throw when Preview uses staging resources', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.NEXT_PUBLIC_APP_URL = 'https://small-heroes-git-feat-x.vercel.app';
    process.env.SUPABASE_URL = 'https://qvksgpzzosotubcbizay.supabase.co';
    expect(() => assertEnvSeparation()).not.toThrow();
    expect(findProdResourceLeak()).toBeNull();
  });

  it('does NOT throw on Vercel Production even with prod resources', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://smallheroes.co.il';
    process.env.SUPABASE_URL = 'https://ozxjmnzybzetqudivlbw.supabase.co';
    expect(isProductionRuntime()).toBe(true);
    expect(() => assertEnvSeparation()).not.toThrow();
  });

  it('falls back to APP_URL when NEXT_PUBLIC_APP_URL is unset', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.APP_URL = 'https://www.smallheroes.co.il';
    expect(() => assertEnvSeparation()).toThrow(/PRODUCTION domain/);
  });

  it('does not throw on a clean local runtime (no prod values)', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.SUPABASE_URL = 'https://qvksgpzzosotubcbizay.supabase.co';
    expect(() => assertEnvSeparation()).not.toThrow();
  });
});
