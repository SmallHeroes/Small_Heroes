import { NextRequest, NextResponse } from 'next/server';

type RateLimitConfig = {
  namespace: string;
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitStore: Map<string, RateLimitBucket> =
  (globalThis as { __smallHeroesRateLimitStore?: Map<string, RateLimitBucket> }).__smallHeroesRateLimitStore ??
  new Map<string, RateLimitBucket>();

if (!(globalThis as { __smallHeroesRateLimitStore?: Map<string, RateLimitBucket> }).__smallHeroesRateLimitStore) {
  (globalThis as { __smallHeroesRateLimitStore?: Map<string, RateLimitBucket> }).__smallHeroesRateLimitStore = rateLimitStore;
}

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

function getAllowedOrigins(req: NextRequest): Set<string> {
  const allowed = new Set<string>();
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    try {
      allowed.add(new URL(envUrl).origin);
    } catch {
      // Ignore invalid env values; request origin check still applies.
    }
  }
  allowed.add(req.nextUrl.origin);
  return allowed;
}

export function enforceSameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  if (!origin) {
    return NextResponse.json({ error: 'Origin header required' }, { status: 403 });
  }
  const allowedOrigins = getAllowedOrigins(req);
  if (!allowedOrigins.has(origin)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  return null;
}

export function enforceRateLimit(req: NextRequest, config: RateLimitConfig): NextResponse | null {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${config.namespace}:${ip}`;
  const existing = rateLimitStore.get(key);

  if (!existing || now >= existing.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }

  if (existing.count >= config.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return NextResponse.json(
      { error: 'Too many requests', retryAfterSeconds },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      }
    );
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return null;
}
