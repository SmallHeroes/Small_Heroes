import { NextResponse, type NextRequest } from 'next/server';

/**
 * Prod safety gate (Goal A / 0083 Phase 3): dev & debug surfaces must never be reachable on the
 * public production site. This is a single general gate over ALL `/dev`, `/api/debug`, and `/api/dev`
 * routes (defense-in-depth on top of any per-route NODE_ENV checks, and covering routes that lack one).
 * Vercel preview deployments run with NODE_ENV=production, so these 404 on preview + prod alike.
 *
 * Narrow exceptions:
 * - fake-payment surface: Preview/staging only, with fake-payment flags.
 * - QA/dev console: Preview/staging only, with ALLOW_STAGING_QA=true and the site-password cookie.
 *
 * Read process.env DIRECTLY here — middleware is edge and must not import the server-only env module.
 */
export function middleware(req: NextRequest): NextResponse {
  if (process.env.NODE_ENV === 'production') {
    const { pathname } = req.nextUrl;
    const isDevPageRoute = pathname === '/dev' || pathname.startsWith('/dev/');
    const isDevApiRoute = pathname === '/api/dev' || pathname.startsWith('/api/dev/');
    const isDebugApiRoute = pathname === '/api/debug' || pathname.startsWith('/api/debug/');
    const isFakePaymentSurface =
      pathname === '/dev/fake-payment' ||
      pathname.startsWith('/dev/fake-payment/') ||
      pathname === '/api/dev/fake-payment/confirm';
    const fakeAllowed =
      process.env.VERCEL_ENV !== 'production' &&
      process.env.PAYMENT_PROVIDER === 'fake' &&
      process.env.ALLOW_FAKE_PAYMENTS === 'true' &&
      process.env.ENABLE_FAKE_PAYMENT === 'true';
    if (isFakePaymentSurface && fakeAllowed) return NextResponse.next();
    const vercelEnv = (process.env.VERCEL_ENV || '').toLowerCase();
    const stagingQaAllowed =
      (vercelEnv === 'preview' || vercelEnv === 'development') &&
      process.env.ALLOW_STAGING_QA === 'true';
    if (stagingQaAllowed && (isDevPageRoute || isDevApiRoute)) {
      const sitePassword = process.env.SITE_PASSWORD || '';
      const hasQaAccessCookie =
        sitePassword.length > 0 && req.cookies.get('sh_access')?.value === sitePassword;
      if (hasQaAccessCookie) return NextResponse.next();
      if (isDevPageRoute) {
        const gateUrl = req.nextUrl.clone();
        gateUrl.pathname = '/HTML/gate.html';
        gateUrl.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
        return NextResponse.redirect(gateUrl);
      }
      return NextResponse.json({ error: 'QA gate required' }, { status: 401 });
    }
    if (isDevPageRoute || isDebugApiRoute || isDevApiRoute) {
      return new NextResponse('Not Found', { status: 404 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dev/:path*', '/api/debug/:path*', '/api/dev/:path*'],
};
