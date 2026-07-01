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

  // Full env for the worker-entrypoint guard tests. The dynamic import below re-runs validateEnv()
  // (lib/env.ts) at module load, so every required var must be present BEFORE the import or the
  // import itself throws. Kept in one helper so the pre-import setup and the pre-call re-affirm
  // stay in sync. SUPABASE_URL is the prod ref (the leak under test); the app URL is a Preview
  // domain so findProdResourceLeak() fires on the Supabase branch, not the app-domain branch.
  const setWorkerGuardEnv = () => {
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
  };

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

  // These two guard tests do `vi.resetModules()` + `await import(...)` of the worker/start entrypoints,
  // which forces a full re-transform+eval of a HEAVY graph (process-worker → chunk-runner → the whole
  // generation pipeline). Under the full `npm run check` suite that re-import measures 3–4s, so the
  // default 5000ms test timeout leaves almost no margin and trips intermittently (the observed flake:
  // "fetch failed"/5s timeout). The guard itself is synchronous and fires in ~1ms — the cost is purely
  // the import — so a generous per-test timeout removes the flake without weakening anything.
  const WORKER_GUARD_TIMEOUT_MS = 20_000;

  it('guards the shared worker entrypoint before lease/DB work', { timeout: WORKER_GUARD_TIMEOUT_MS }, async () => {
    vi.resetModules();
    setWorkerGuardEnv();
    const { runGenerationWorkerInvocation } = await import('../process-worker');
    // Re-affirm env AFTER the import with no await before the call: a sibling test file sharing this
    // vitest worker process can overwrite SUPABASE_URL (to a valid non-prod project) during the long
    // dynamic-import await. That would let the synchronous guard read a non-prod URL, miss, and let
    // the worker hit real network. Re-setting here — with nothing async between this and the call —
    // guarantees the guard sees the prod value. This does NOT weaken the guard.
    setWorkerGuardEnv();
    await expect(runGenerationWorkerInvocation('ord_env_guard')).rejects.toThrow(
      /PRODUCTION Supabase project/
    );
  });

  it('guards chunked start before order/job DB writes', { timeout: WORKER_GUARD_TIMEOUT_MS }, async () => {
    vi.resetModules();
    setWorkerGuardEnv();
    const { startChunkedGeneration } = await import('../start');
    // See note above: re-affirm env with no await before the call so cross-file env mutation during
    // the import await cannot defeat the synchronous guard.
    setWorkerGuardEnv();
    await expect(startChunkedGeneration('ord_env_guard', 'test')).rejects.toThrow(
      /PRODUCTION Supabase project/
    );
  });

  it('throws when DATABASE_URL points at the prod project even if SUPABASE_URL is staging', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.NEXT_PUBLIC_APP_URL = 'https://preview.vercel.app';
    process.env.SUPABASE_URL = 'https://qvksgpzzosotubcbizay.supabase.co';
    process.env.DATABASE_URL =
      'postgresql://postgres:pass@db.ozxjmnzybzetqudivlbw.supabase.co:5432/postgres';
    expect(() => assertEnvSeparation()).toThrow(/DATABASE_URL\/DIRECT_URL/);
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
