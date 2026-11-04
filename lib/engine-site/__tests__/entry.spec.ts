import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, config } from '@/middleware';
afterEach(() => vi.unstubAllEnvs());
describe('existing site wizard entry cutover', () => {
  it('keeps the existing route when off, and rewrites to personal when explicitly on', () => {
    const req = new NextRequest('https://app.example.invalid/wizard?utm_source=synthetic');
    vi.stubEnv('NODE_ENV','production'); vi.stubEnv('ENGINE_SITE_CHECKOUT_ENABLED','false');
    expect(middleware(req).headers.get('x-middleware-rewrite')).toBeNull();
    vi.stubEnv('ENGINE_SITE_CHECKOUT_ENABLED','true');
    expect(middleware(req).headers.get('x-middleware-rewrite')).toBe('https://app.example.invalid/wizard/personal?utm_source=synthetic');
    expect(config.matcher).toContain('/wizard');
    expect(middleware(new NextRequest('https://app.example.invalid/start')).headers.get('x-middleware-rewrite')).toBe('https://app.example.invalid/wizard/personal');
  });
  it('does not reopen production debug/dev/fake-payment surfaces during cutover', () => {
    vi.stubEnv('NODE_ENV','production'); vi.stubEnv('VERCEL_ENV','production'); vi.stubEnv('ENGINE_SITE_CHECKOUT_ENABLED','true');
    for (const path of ['/dev/personal-wizard','/api/dev/fake-payment/confirm','/api/debug/regen-page','/release/v1/fake-payment'])
      expect(middleware(new NextRequest(`https://app.example.invalid${path}`)).status).toBe(404);
  });
});
