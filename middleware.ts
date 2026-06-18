import { NextResponse, type NextRequest } from 'next/server';

/**
 * Prod safety gate (Goal A / 0083 Phase 3): dev & debug surfaces must never be reachable on the
 * public production site. This is a single general gate over ALL `/dev`, `/api/debug`, and `/api/dev`
 * routes (defense-in-depth on top of any per-route NODE_ENV checks, and covering routes that lack one).
 * Vercel preview deployments run with NODE_ENV=production, so these 404 on preview + prod alike.
 */
export function middleware(req: NextRequest): NextResponse {
  if (process.env.NODE_ENV === 'production') {
    const { pathname } = req.nextUrl;
    if (
      pathname === '/dev' ||
      pathname.startsWith('/dev/') ||
      pathname.startsWith('/api/debug') ||
      pathname.startsWith('/api/dev')
    ) {
      return new NextResponse('Not Found', { status: 404 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dev/:path*', '/api/debug/:path*', '/api/dev/:path*'],
};
