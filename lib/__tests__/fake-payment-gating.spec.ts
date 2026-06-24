import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { isVercelProductionRuntime } from '@/lib/runtime-env';

/**
 * 0093 — fake-payment gating must key on VERCEL_ENV (real prod), never NODE_ENV (which is also
 * 'production' on Vercel Preview). SAFETY: there is NO path where VERCEL_ENV='production' allows fake.
 */

// Mocks for the checkout-route integration cases. (Harmless for the env/middleware unit cases —
// those modules don't import these.)
vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock('@/lib/payme', () => ({ createPaymeCheckout: vi.fn() }));
vi.mock('@/lib/request-security', () => ({
  enforceSameOrigin: vi.fn(() => null),
  enforceRateLimit: vi.fn(() => null),
}));
vi.mock('@/lib/resemblance-core', () => ({
  evaluatePhotoGate: vi.fn(async () => ({
    warnings: [],
    faceCount: 0,
    faceAreaRatio: 0,
    brightness: 0,
    sharpness: 0,
    inputStrength: 'none',
  })),
}));

// Base env so validateEnv() succeeds (image gen disabled → no provider key needed; live buy mode so
// checkout proceeds past the waitlist guard).
const BASE_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  GENERATION_SECRET: 'test-secret',
  NEXT_PUBLIC_APP_URL: 'https://preview.example.com',
  SUPABASE_URL: 'https://qvksgpzzosotubcbizay.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'role-key',
  OPENAI_API_KEY: 'openai-key',
  DISABLE_IMAGE_GENERATION: 'true',
  NEXT_PUBLIC_BUY_MODE: 'live',
  SITE_PASSWORD: 'site-secret',
};

const MANAGED = [
  'PAYMENT_PROVIDER',
  'ENABLE_FAKE_PAYMENT',
  'ALLOW_FAKE_PAYMENTS',
  'ALLOW_STAGING_QA',
  'SITE_PASSWORD',
  'VERCEL_ENV',
  'NODE_ENV',
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

describe('isVercelProductionRuntime', () => {
  it('true only for VERCEL_ENV=production (case-insensitive)', () => {
    process.env.VERCEL_ENV = 'production';
    expect(isVercelProductionRuntime()).toBe(true);
    process.env.VERCEL_ENV = 'PRODUCTION';
    expect(isVercelProductionRuntime()).toBe(true);
  });
  it('false for preview / unset', () => {
    process.env.VERCEL_ENV = 'preview';
    expect(isVercelProductionRuntime()).toBe(false);
    delete process.env.VERCEL_ENV;
    expect(isVercelProductionRuntime()).toBe(false);
  });
});

describe('staging QA runtime access', () => {
  it('allows dev environment checks on Preview only when ALLOW_STAGING_QA=true', async () => {
    setEnv({ NODE_ENV: 'production', VERCEL_ENV: 'preview', ALLOW_STAGING_QA: 'true' });
    vi.resetModules();
    const { isDevEnvironment } = await import('@/lib/dev-only-guard');
    expect(isDevEnvironment()).toBe(true);
  });

  it('keeps dev environment checks closed on Preview without the flag', async () => {
    setEnv({ NODE_ENV: 'production', VERCEL_ENV: 'preview', ALLOW_STAGING_QA: undefined });
    vi.resetModules();
    const { isDevEnvironment } = await import('@/lib/dev-only-guard');
    expect(isDevEnvironment()).toBe(false);
  });

  it('keeps dev environment checks closed on real prod even with the flag', async () => {
    setEnv({ NODE_ENV: 'production', VERCEL_ENV: 'production', ALLOW_STAGING_QA: 'true' });
    vi.resetModules();
    const { isDevEnvironment } = await import('@/lib/dev-only-guard');
    expect(isDevEnvironment()).toBe(false);
  });

  it('keeps dev environment checks closed in generic production without VERCEL_ENV', async () => {
    setEnv({ NODE_ENV: 'production', VERCEL_ENV: undefined, ALLOW_STAGING_QA: 'true' });
    vi.resetModules();
    const { isDevEnvironment } = await import('@/lib/dev-only-guard');
    expect(isDevEnvironment()).toBe(false);
  });
});

describe('canUseFakePayments (single source of truth)', () => {
  it('preview + fake + both flags → true', async () => {
    setEnv({ PAYMENT_PROVIDER: 'fake', ENABLE_FAKE_PAYMENT: 'true', ALLOW_FAKE_PAYMENTS: 'true', VERCEL_ENV: 'preview' });
    vi.resetModules();
    const m = await import('@/lib/env');
    expect(m.canUseFakePayments()).toBe(true);
    expect(m.isFakePaymentEnabled()).toBe(true); // thin alias → same impl
  });

  it('SAFETY: real prod at runtime → false even with both flags', async () => {
    setEnv({ PAYMENT_PROVIDER: 'fake', ENABLE_FAKE_PAYMENT: 'true', ALLOW_FAKE_PAYMENTS: 'true', VERCEL_ENV: 'preview' });
    vi.resetModules();
    const m = await import('@/lib/env');
    process.env.VERCEL_ENV = 'production'; // flips at runtime; helper reads live VERCEL_ENV
    expect(m.canUseFakePayments()).toBe(false);
  });

  it('preview + fake but ALLOW_FAKE_PAYMENTS missing → false', async () => {
    setEnv({ PAYMENT_PROVIDER: 'fake', ENABLE_FAKE_PAYMENT: 'true', ALLOW_FAKE_PAYMENTS: undefined, VERCEL_ENV: 'preview' });
    vi.resetModules();
    const m = await import('@/lib/env');
    expect(m.canUseFakePayments()).toBe(false);
  });

  it('provider not fake → false', async () => {
    setEnv({ PAYMENT_PROVIDER: 'payme', ENABLE_FAKE_PAYMENT: 'true', ALLOW_FAKE_PAYMENTS: 'true', VERCEL_ENV: 'preview', PAYME_API_BASE_URL: 'https://x', PAYME_API_KEY: 'k', PAYME_WEBHOOK_SECRET: 's' });
    vi.resetModules();
    const m = await import('@/lib/env');
    expect(m.canUseFakePayments()).toBe(false);
  });
});

describe('validateEnv fake-payment guards', () => {
  it('SAFETY: fake on real prod (VERCEL_ENV=production) throws at boot', async () => {
    setEnv({ PAYMENT_PROVIDER: 'fake', ENABLE_FAKE_PAYMENT: 'true', ALLOW_FAKE_PAYMENTS: 'true', VERCEL_ENV: 'production' });
    vi.resetModules();
    await expect(import('@/lib/env')).rejects.toThrow(/forbidden on real production/);
  });

  it('fake without ENABLE_FAKE_PAYMENT throws', async () => {
    setEnv({ PAYMENT_PROVIDER: 'fake', ENABLE_FAKE_PAYMENT: undefined, ALLOW_FAKE_PAYMENTS: 'true', VERCEL_ENV: 'preview' });
    vi.resetModules();
    await expect(import('@/lib/env')).rejects.toThrow(/ENABLE_FAKE_PAYMENT/);
  });

  it('fake on preview + ENABLE_FAKE_PAYMENT boots fine', async () => {
    setEnv({ PAYMENT_PROVIDER: 'fake', ENABLE_FAKE_PAYMENT: 'true', ALLOW_FAKE_PAYMENTS: 'true', VERCEL_ENV: 'preview' });
    vi.resetModules();
    await expect(import('@/lib/env')).resolves.toBeTruthy();
  });
});

describe('checkout route fake gate', () => {
  function makeReq() {
    return new NextRequest('https://preview.example.com/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ orderId: 'o1' }),
      headers: { 'content-type': 'application/json' },
    });
  }

  it('SAFETY: returns 503 when fake not permitted (real prod)', async () => {
    setEnv({ PAYMENT_PROVIDER: 'fake', ENABLE_FAKE_PAYMENT: 'true', ALLOW_FAKE_PAYMENTS: 'true', VERCEL_ENV: 'preview' });
    vi.resetModules();
    const { POST } = await import('@/app/api/checkout/route');
    process.env.VERCEL_ENV = 'production';
    const res = await POST(makeReq());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('Payment provider misconfigured');
  });

  it('returns the fake redirect on preview + both flags', async () => {
    setEnv({ PAYMENT_PROVIDER: 'fake', ENABLE_FAKE_PAYMENT: 'true', ALLOW_FAKE_PAYMENTS: 'true', VERCEL_ENV: 'preview' });
    vi.resetModules();
    const { POST } = await import('@/app/api/checkout/route');
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: 'o1',
      status: 'draft',
      storyLength: 'medium',
      storyDirection: null,
      audioEnabled: false,
      pdfEnabled: false,
      bundleEnabled: false,
      videoEnabled: false,
      childImageUrl: null,
      childName: 'דנה',
    } as never);
    vi.mocked(prisma.order.update).mockResolvedValue({} as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.paymentProvider).toBe('fake');
    expect(json.url).toContain('fake-payment');
  });

  it('returns 503 on preview when a flag is missing', async () => {
    setEnv({ PAYMENT_PROVIDER: 'fake', ENABLE_FAKE_PAYMENT: 'true', ALLOW_FAKE_PAYMENTS: undefined, VERCEL_ENV: 'preview' });
    vi.resetModules();
    const { POST } = await import('@/app/api/checkout/route');
    const res = await POST(makeReq());
    expect(res.status).toBe(503);
  });
});

describe('middleware staging QA gate (open browsing, gated book-creation trigger)', () => {
  async function run(pathname: string, env: Record<string, string | undefined>, cookie?: string) {
    setEnv({ NODE_ENV: 'production', ...env });
    vi.resetModules();
    const { middleware } = await import('@/middleware');
    return middleware(
      new NextRequest(`https://example.com${pathname}`, {
        headers: cookie ? { cookie } : undefined,
      })
    );
  }

  // Staging QA open: ALLOW_STAGING_QA is the master switch for /dev visibility on preview.
  const QA_ON = { VERCEL_ENV: 'preview', ALLOW_STAGING_QA: 'true' };
  // The book-creation trigger additionally needs the fake-payment flags.
  const QA_FAKE_ON = {
    ...QA_ON,
    PAYMENT_PROVIDER: 'fake',
    ALLOW_FAKE_PAYMENTS: 'true',
    ENABLE_FAKE_PAYMENT: 'true',
  };

  // --- Open browsing: /dev pages + /api/dev, NO cookie, NO password prompt on refresh ---

  it('opens a /dev page on staging without any cookie (no gate redirect)', async () => {
    const res = await run('/dev/creator', QA_ON);
    expect(res.status).toBe(200);
  });

  it('opens the /dev/fake-payment page on staging without a cookie', async () => {
    const res = await run('/dev/fake-payment', QA_ON);
    expect(res.status).toBe(200);
  });

  it('opens an /api/dev route on staging without a cookie', async () => {
    const res = await run('/api/dev/creator/meta', QA_ON);
    expect(res.status).toBe(200);
  });

  // --- Book-creation trigger stays password-gated ---

  it('book-creation trigger returns 401 on staging WITHOUT the site-password cookie', async () => {
    const res = await run('/api/dev/fake-payment/confirm', QA_FAKE_ON);
    expect(res.status).toBe(401);
  });

  it('book-creation trigger passes on staging WITH fake flags + the site-password cookie', async () => {
    const res = await run('/api/dev/fake-payment/confirm', QA_FAKE_ON, 'sh_access=site-secret');
    expect(res.status).toBe(200);
  });

  it('book-creation trigger 401s with the cookie but WITHOUT the fake-payment flags', async () => {
    const res = await run('/api/dev/fake-payment/confirm', QA_ON, 'sh_access=site-secret');
    expect(res.status).toBe(401);
  });

  it('book-creation trigger 401s with the wrong cookie value', async () => {
    const res = await run('/api/dev/fake-payment/confirm', QA_FAKE_ON, 'sh_access=wrong');
    expect(res.status).toBe(401);
  });

  // --- INVARIANT: real prod 404s everything; preview without the flag 404s ---

  it('SAFETY: /dev pages 404 on real prod even with ALLOW_STAGING_QA + cookie', async () => {
    const res = await run('/dev/creator', { ...QA_ON, VERCEL_ENV: 'production' }, 'sh_access=site-secret');
    expect(res.status).toBe(404);
  });

  it('SAFETY: /api/dev 404s on real prod even with ALLOW_STAGING_QA + cookie', async () => {
    const res = await run('/api/dev/creator/meta', { ...QA_ON, VERCEL_ENV: 'production' }, 'sh_access=site-secret');
    expect(res.status).toBe(404);
  });

  it('SAFETY: book-creation trigger 404s on real prod even with flags + cookie', async () => {
    const res = await run(
      '/api/dev/fake-payment/confirm',
      { ...QA_FAKE_ON, VERCEL_ENV: 'production' },
      'sh_access=site-secret'
    );
    expect(res.status).toBe(404);
  });

  it('SAFETY: /dev 404s on preview WITHOUT ALLOW_STAGING_QA', async () => {
    const res = await run('/dev/creator', { VERCEL_ENV: 'preview' });
    expect(res.status).toBe(404);
  });

  it('SAFETY: /dev 404s in generic production without VERCEL_ENV', async () => {
    const res = await run('/dev/creator', { VERCEL_ENV: undefined, ALLOW_STAGING_QA: 'true' });
    expect(res.status).toBe(404);
  });

  it('SAFETY: /api/debug stays 404 even when staging QA is open', async () => {
    const res = await run('/api/debug/minimal-e2e', QA_ON);
    expect(res.status).toBe(404);
  });
});
