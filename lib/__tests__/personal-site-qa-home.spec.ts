import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { config, middleware } from '../../middleware';

function request(path = '/', hostname = 'qa.smallheroes.co.il', init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`https://${hostname}${path}`, init);
}

function expectUnchanged(req: NextRequest) {
  const response = middleware(req);
  expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  expect(response.headers.get('x-middleware-next')).toBe('1');
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('ALLOW_STAGING_QA', 'true');
  vi.stubEnv('PERSONAL_WIZARD_PREVIEW', 'true');
  vi.stubEnv('PERSONAL_PRODUCT_QA_HOME', 'true');
  vi.stubEnv('PAYMENT_PROVIDER', 'fake');
  vi.stubEnv('ALLOW_FAKE_PAYMENTS', 'true');
  vi.stubEnv('ENABLE_FAKE_PAYMENT', 'true');
  vi.stubEnv('SITE_PASSWORD', 'synthetic-qa-password');
});
afterEach(() => vi.unstubAllEnvs());

describe('personal homepage — named QA only, real middleware', () => {
  it.each(['GET', 'HEAD'])('rewrites %s to the guarded preview, preserving query and noindex', (method) => {
    const response = middleware(request('/?qa=layout', undefined, { method }));
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://qa.smallheroes.co.il/dev/personal-product?qa=layout');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it.each(['production', '', 'staging', 'unknown'])('never rewrites VERCEL_ENV=%s, even with every switch on', (value) => {
    vi.stubEnv('VERCEL_ENV', value);
    expectUnchanged(request());
  });

  it.each(['ALLOW_STAGING_QA', 'PERSONAL_WIZARD_PREVIEW', 'PERSONAL_PRODUCT_QA_HOME'])('requires exact true for %s', (flag) => {
    for (const value of [undefined, '', 'false', '1', 'TRUE', 'true ']) {
      vi.stubEnv(flag, value);
      expectUnchanged(request());
    }
  });

  it.each(['smallheroes.co.il', 'www.smallheroes.co.il', 'preview.vercel.app', 'qa.smallheroes.co.il.evil.test', '127.0.0.1'])('leaves %s untouched; forwarded hostname is not authority', (hostname) => {
    expectUnchanged(request('/', hostname, { headers: { 'x-forwarded-host': 'qa.smallheroes.co.il' } }));
  });

  it.each(['/start', '/pricing', '/dev/personal-wizard', '/dev/personal-product', '/api/dev/personal-wizard/request'])('does not rewrite %s', (path) => {
    expectUnchanged(request(path));
  });

  it('does not intercept root POST', () => expectUnchanged(request('/', undefined, { method: 'POST' })));

  it('supports recognized Vercel development only with the same switches', () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    expect(middleware(request()).headers.get('x-middleware-rewrite')).not.toBeNull();
  });

  it('keeps root matching statically declared alongside all existing guarded routes', () => {
    expect(config.matcher).toEqual(['/', '/dev/:path*', '/api/debug/:path*', '/api/dev/:path*', '/release/v1/fake-payment', '/api/release/v1/fake-payment/confirm']);
  });

  it.each(['/dev/personal-product', '/dev/personal-wizard', '/api/dev/personal-wizard/story', '/api/dev/personal-wizard/intake', '/api/debug/status', '/release/v1/fake-payment', '/api/release/v1/fake-payment/confirm'])('keeps production %s closed regardless of preview switches/cookie', (path) => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(middleware(request(path, undefined, { headers: { cookie: 'sh_access=synthetic-qa-password' } })).status).toBe(404);
  });

  it('keeps debug closed and fake payment independently password/flag gated on QA', () => {
    expect(middleware(request('/api/debug/status')).status).toBe(404);
    for (const path of ['/api/dev/fake-payment/confirm', '/api/release/v1/fake-payment/confirm']) {
      expect(middleware(request(path)).status).toBe(401);
      const authorized = request(path, undefined, { headers: { cookie: 'sh_access=synthetic-qa-password' } });
      expectUnchanged(authorized);
      vi.stubEnv('ALLOW_FAKE_PAYMENTS', 'false');
      expect(middleware(authorized).status).toBe(401);
      vi.stubEnv('ALLOW_FAKE_PAYMENTS', 'true');
    }
  });

  it('leaves ordinary localhost development unchanged by default', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL_ENV', undefined);
    expectUnchanged(request('/', '127.0.0.1'));
    expectUnchanged(request('/dev/personal-product', '127.0.0.1'));
  });
});
