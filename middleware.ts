import { NextResponse, type NextRequest } from 'next/server';

/**
 * Prod safety gate: dev & debug surfaces must never be reachable on the public production site.
 * A single general gate over ALL `/dev`, `/api/dev`, and `/api/debug` routes (defense-in-depth on
 * top of any per-route NODE_ENV checks). Vercel preview deployments run NODE_ENV=production.
 *
 * INVARIANT: real production (VERCEL_ENV=production) → 404 for ALL /dev, /api/dev, /api/debug.
 *
 * Preview/staging QA access (VERCEL_ENV in {preview,development} AND ALLOW_STAGING_QA=true):
 * BROWSING is open — no password prompt on /dev pages, and READ (GET/HEAD) /api/dev requests load
 * freely (so the creator/viewer/console refresh without re-prompting). Only the BOOK-CREATION step
 * is gated: any MUTATING (POST/PUT/PATCH/DELETE) /api/dev request — the point that triggers a
 * render/order (fake-payment/confirm, generation/resume, story-bank, qa-console/run, …) — requires
 * the site-password cookie (sh_access === SITE_PASSWORD). A visitor can browse but cannot generate.
 * `/api/debug` stays fully closed even on staging.
 *
 * Read process.env DIRECTLY here — middleware is edge and must not import the server-only env module.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function middleware(req: NextRequest): NextResponse {
  if (process.env.NODE_ENV !== 'production') return NextResponse.next();

  const { pathname } = req.nextUrl;
  const isDevPageRoute = pathname === '/dev' || pathname.startsWith('/dev/');
  const isDevApiRoute = pathname === '/api/dev' || pathname.startsWith('/api/dev/');
  const isDebugApiRoute = pathname === '/api/debug' || pathname.startsWith('/api/debug/');

  const vercelEnv = (process.env.VERCEL_ENV || '').toLowerCase();
  const stagingQaAllowed =
    (vercelEnv === 'preview' || vercelEnv === 'development') &&
    process.env.ALLOW_STAGING_QA === 'true';

  if (stagingQaAllowed) {
    // Browse freely — dev PAGE routes never prompt or redirect.
    if (isDevPageRoute) return NextResponse.next();

    // Dev APIs: reads open (creator/viewer/console data loads); mutations are the book-creation /
    // render triggers and stay password-protected.
    if (isDevApiRoute) {
      if (SAFE_METHODS.has(req.method)) return NextResponse.next();
      const sitePassword = process.env.SITE_PASSWORD || '';
      const hasQaAccessCookie =
        sitePassword.length > 0 && req.cookies.get('sh_access')?.value === sitePassword;
      if (hasQaAccessCookie) return NextResponse.next();
      return NextResponse.json(
        { error: 'QA gate: creating a book requires the site password.' },
        { status: 401 }
      );
    }
    // /api/debug is never opened — falls through to the 404 below.
  }

  if (isDevPageRoute || isDebugApiRoute || isDevApiRoute) {
    return new NextResponse('Not Found', { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dev/:path*', '/api/debug/:path*', '/api/dev/:path*'],
};
