import { NextResponse, type NextRequest } from 'next/server';

/**
 * Prod safety gate (Goal A / 0083 Phase 3): dev & debug surfaces must never be reachable on the
 * public production site. This is a single general gate over ALL `/dev`, `/api/debug`, and `/api/dev`
 * routes (defense-in-depth on top of any per-route NODE_ENV checks, and covering routes that lack one).
 * Vercel preview deployments run with NODE_ENV=production, so these 404 on preview + prod alike.
 *
 * INVARIANT (never relax): real production (VERCEL_ENV=production) 404s ALL of `/dev`, `/api/dev`,
 * and `/api/debug`, regardless of any flag or cookie.
 *
 * Preview/staging (VERCEL_ENV=preview|development + ALLOW_STAGING_QA=true):
 * - `/dev` pages and `/api/dev` routes are OPEN for QA browsing — no password prompt, no cookie.
 * - The ONLY password-gated surface is the book-creation trigger `/api/dev/fake-payment/confirm`
 *   (it creates a fake-paid order and starts generation): requires the fake-payment flags AND the
 *   site-password cookie (`sh_access` === SITE_PASSWORD), else 401.
 * - `/api/debug` stays 404 everywhere (never part of the QA carve-out).
 *
 * Read process.env DIRECTLY here — middleware is edge and must not import the server-only env module.
 */
export function middleware(req: NextRequest): NextResponse {
  if (process.env.NODE_ENV !== 'production') return NextResponse.next();

  const { pathname } = req.nextUrl;
  const isDevPageRoute = pathname === '/dev' || pathname.startsWith('/dev/');
  const isDevApiRoute = pathname === '/api/dev' || pathname.startsWith('/api/dev/');
  const isDebugApiRoute = pathname === '/api/debug' || pathname.startsWith('/api/debug/');

  // The single mutating trigger that stays password-gated even on staging: it creates a
  // (fake-paid) order and starts generation. Everything else under /dev is open for QA.
  const isBookCreationTrigger = pathname === '/api/dev/fake-payment/confirm';

  const vercelEnv = (process.env.VERCEL_ENV || '').toLowerCase();
  const stagingQaAllowed =
    (vercelEnv === 'preview' || vercelEnv === 'development') &&
    process.env.ALLOW_STAGING_QA === 'true';

  if (stagingQaAllowed && (isDevPageRoute || isDevApiRoute)) {
    if (isBookCreationTrigger) {
      // Defense-in-depth: fake-payment flags must be on AND the caller must hold the site
      // password. (The route itself also enforces canUseFakePayments.) Missing either → 401.
      const fakeAllowed =
        process.env.PAYMENT_PROVIDER === 'fake' &&
        process.env.ALLOW_FAKE_PAYMENTS === 'true' &&
        process.env.ENABLE_FAKE_PAYMENT === 'true';
      const sitePassword = process.env.SITE_PASSWORD || '';
      const hasQaAccessCookie =
        sitePassword.length > 0 && req.cookies.get('sh_access')?.value === sitePassword;
      if (fakeAllowed && hasQaAccessCookie) return NextResponse.next();
      return NextResponse.json({ error: 'QA gate required' }, { status: 401 });
    }
    // Open browsing: all other /dev pages + /api/dev routes — no password, no prompt on refresh.
    return NextResponse.next();
  }

  if (isDevPageRoute || isDebugApiRoute || isDevApiRoute) {
    return new NextResponse('Not Found', { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dev/:path*', '/api/debug/:path*', '/api/dev/:path*'],
};
