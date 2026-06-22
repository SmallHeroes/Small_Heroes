import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * P0 prod-boot fix — the "none" payment provider.
 *
 * Real prod (main) was 500ing at boot because validateEnv forbids PAYMENT_PROVIDER=fake on
 * VERCEL_ENV=production and prod was set to fake. A gated + waitlist prod has no real PayMe/Stripe
 * creds, so it needs a first-class "no payment backend" provider that boots cleanly.
 *
 * Rules under test (validateEnv):
 *   - none allowed ONLY when BUY_MODE !== 'live'; none + live → boot error.
 *   - fake still forbidden on VERCEL_ENV=production, even in waitlist.
 *   - payme/stripe still require real creds.
 *   - missing provider: → none in waitlist, → boot error in live (no silent stripe default).
 *   - unknown provider value → boot error (no fallback to stripe).
 *   - render creds (OPENAI / image token) required ONLY when generation runs on this runtime.
 * And (checkout route): provider===none past the waitlist short-circuit → 503 payment_disabled,
 * with no order created/fulfilled.
 */

// Base env so validateEnv() succeeds. Image generation disabled + OpenAI key present so the default
// STORY_PROVIDER=openai is satisfied on runtimes where generation is enabled. BUY_MODE defaults to
// waitlist (unset). Provider is set per-test.
const BASE_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  GENERATION_SECRET: 'test-secret',
  NEXT_PUBLIC_APP_URL: 'https://app.example.com',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'role-key',
  OPENAI_API_KEY: 'openai-key',
  DISABLE_IMAGE_GENERATION: 'true',
};

const MANAGED = [
  'PAYMENT_PROVIDER',
  'NEXT_PUBLIC_BUY_MODE',
  'VERCEL_ENV',
  'ENABLE_PROD_GENERATION',
  'ENABLE_FAKE_PAYMENT',
  'ALLOW_FAKE_PAYMENTS',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'REPLICATE_API_TOKEN',
  'DISABLE_IMAGE_GENERATION',
  'IMAGE_PROVIDER',
  'STORY_PROVIDER',
  'PAYME_API_BASE_URL',
  'PAYME_API_KEY',
  'PAYME_WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

function setEnv(overrides: Record<string, string | undefined>) {
  for (const k of MANAGED) delete process.env[k];
  Object.assign(process.env, BASE_ENV);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

let envSnapshot: NodeJS.ProcessEnv;
beforeEach(() => {
  envSnapshot = { ...process.env };
});
afterEach(() => {
  for (const k of Object.keys(process.env)) {
    if (!(k in envSnapshot)) delete process.env[k];
  }
  Object.assign(process.env, envSnapshot);
  vi.resetModules();
});

describe('validateEnv — PAYMENT_PROVIDER=none', () => {
  it('prod + none + waitlist → boots, provider resolves to none', async () => {
    setEnv({ VERCEL_ENV: 'production', PAYMENT_PROVIDER: 'none' });
    vi.resetModules();
    const m = await import('@/lib/env');
    expect(m.env.PAYMENT_PROVIDER).toBe('none');
    expect(m.env.NEXT_PUBLIC_BUY_MODE).toBe('waitlist');
  });

  it('prod + none + live → throws at boot', async () => {
    setEnv({ VERCEL_ENV: 'production', PAYMENT_PROVIDER: 'none', NEXT_PUBLIC_BUY_MODE: 'live' });
    vi.resetModules();
    await expect(import('@/lib/env')).rejects.toThrow(/none is not allowed when BUY_MODE=live/);
  });
});

describe('validateEnv — existing payment guards still hold', () => {
  it('SAFETY: prod + fake → throws even in waitlist', async () => {
    setEnv({ VERCEL_ENV: 'production', PAYMENT_PROVIDER: 'fake', ENABLE_FAKE_PAYMENT: 'true' });
    vi.resetModules();
    await expect(import('@/lib/env')).rejects.toThrow(/forbidden on real production/);
  });

  it('prod + payme + creds → boots', async () => {
    setEnv({
      VERCEL_ENV: 'production',
      PAYMENT_PROVIDER: 'payme',
      PAYME_API_BASE_URL: 'https://payme.example',
      PAYME_API_KEY: 'k',
      PAYME_WEBHOOK_SECRET: 's',
    });
    vi.resetModules();
    const m = await import('@/lib/env');
    expect(m.env.PAYMENT_PROVIDER).toBe('payme');
  });

  it('preview + fake + flag → boots', async () => {
    setEnv({ VERCEL_ENV: 'preview', PAYMENT_PROVIDER: 'fake', ENABLE_FAKE_PAYMENT: 'true' });
    vi.resetModules();
    const m = await import('@/lib/env');
    expect(m.env.PAYMENT_PROVIDER).toBe('fake');
  });
});

describe('normalizePaymentProvider — no silent stripe default', () => {
  it('prod + missing + waitlist → none, boots', async () => {
    setEnv({ VERCEL_ENV: 'production', PAYMENT_PROVIDER: undefined });
    vi.resetModules();
    const m = await import('@/lib/env');
    expect(m.env.PAYMENT_PROVIDER).toBe('none');
  });

  it('prod + missing + live → throws (required, no stripe fallback)', async () => {
    setEnv({ VERCEL_ENV: 'production', PAYMENT_PROVIDER: undefined, NEXT_PUBLIC_BUY_MODE: 'live' });
    vi.resetModules();
    await expect(import('@/lib/env')).rejects.toThrow(/PAYMENT_PROVIDER is required when BUY_MODE=live/);
  });

  it('prod + unknown value → throws (no fallback to stripe)', async () => {
    setEnv({ VERCEL_ENV: 'production', PAYMENT_PROVIDER: 'bogus' });
    vi.resetModules();
    await expect(import('@/lib/env')).rejects.toThrow(/not a recognized provider/);
  });
});

describe('validateEnv — conditional render creds', () => {
  it('prod + generation disabled + missing OPENAI/image token → boots', async () => {
    setEnv({
      VERCEL_ENV: 'production',
      PAYMENT_PROVIDER: 'none',
      OPENAI_API_KEY: undefined,
      DISABLE_IMAGE_GENERATION: undefined,
      IMAGE_PROVIDER: 'replicate',
      REPLICATE_API_TOKEN: undefined,
      // ENABLE_PROD_GENERATION unset → generation hard-disabled on prod → no render creds required.
    });
    vi.resetModules();
    const m = await import('@/lib/env');
    expect(m.env.PAYMENT_PROVIDER).toBe('none');
  });

  it('prod + generation ENABLED + missing OPENAI → throws (creds enforced once gen runs)', async () => {
    setEnv({
      VERCEL_ENV: 'production',
      PAYMENT_PROVIDER: 'none',
      ENABLE_PROD_GENERATION: 'true',
      OPENAI_API_KEY: undefined,
    });
    vi.resetModules();
    await expect(import('@/lib/env')).rejects.toThrow(/OPENAI_API_KEY is required/);
  });

  it('preview + missing OPENAI → throws (generation always on outside prod)', async () => {
    setEnv({ VERCEL_ENV: 'preview', PAYMENT_PROVIDER: 'none', OPENAI_API_KEY: undefined });
    vi.resetModules();
    await expect(import('@/lib/env')).rejects.toThrow(/OPENAI_API_KEY is required/);
  });
});

describe('checkout route — none provider past the waitlist short-circuit', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@/lib/env');
  });

  it('provider===none → 503 payment_disabled, no order created/fulfilled', async () => {
    const update = vi.fn();
    vi.doMock('@/lib/prisma', () => ({
      prisma: { order: { findUnique: vi.fn(), update: update } },
    }));
    vi.doMock('@/lib/payme', () => ({ createPaymeCheckout: vi.fn() }));
    vi.doMock('@/lib/request-security', () => ({
      enforceSameOrigin: vi.fn(() => null),
      enforceRateLimit: vi.fn(() => null),
    }));
    vi.doMock('@/lib/resemblance-core', () => ({
      evaluatePhotoGate: vi.fn(),
    }));
    // Force past the waitlist short-circuit (isWaitlistMode → false) with provider none. validateEnv
    // would never produce none+live live-boot, so we mock env directly to exercise the route guard.
    vi.doMock('@/lib/env', () => ({
      env: { PAYMENT_PROVIDER: 'none', NEXT_PUBLIC_BUY_MODE: 'live' },
      isWaitlistMode: () => false,
      isFakePaymentEnabled: () => false,
      canUseFakePayments: () => false,
    }));
    vi.resetModules();

    const { POST } = await import('@/app/api/checkout/route');
    const { NextRequest } = await import('next/server');
    const res = await POST(
      new NextRequest('https://app.example.com/api/checkout', {
        method: 'POST',
        body: JSON.stringify({ orderId: 'o1' }),
        headers: { 'content-type': 'application/json' },
      })
    );

    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('payment_disabled');
    expect(update).not.toHaveBeenCalled();
  });
});
