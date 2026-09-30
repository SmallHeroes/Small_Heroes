import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { resolveUserFromRequest } from '@/lib/auth-session';
import { isDevEnvironment } from '@/lib/dev-only-guard';
import { enforceRateLimit } from '@/lib/request-security';
import { resolveStorySettings, type StorySettings } from './story-config';

export const STORY_NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
export const storyResponse = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: STORY_NO_STORE });

/** Local single-process pilot only; enabling this on multi-instance hosting is NOT supported. */
export async function personalOperatorAccess<Settings extends StorySettings>(req: NextRequest,
  resolveSettings: () => Settings | null, namespace: 'personal-story-pilot' | 'personal-book-pilot',
): Promise<{ ok: true; userId: string; operatorEmail: string; settings: Settings } | { ok: false; response: NextResponse }> {
  const settings = resolveSettings();
  if (!isDevEnvironment() || !settings || !['127.0.0.1', 'localhost', '[::1]'].includes(req.nextUrl.hostname)) {
    return { ok: false, response: storyResponse({ error: 'not_found' }, 404) };
  }
  // NextURL may normalise 127.0.0.1 to localhost. The real Host header preserves the browser origin.
  // Do not accept NEXT_PUBLIC_APP_URL as an alternate origin for this local paid endpoint.
  let actualOrigin: string;
  try {
    const actual = new URL(`${req.nextUrl.protocol}//${req.headers.get('host') ?? req.nextUrl.host}`);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(actual.hostname)) throw new Error('nonlocal');
    actualOrigin = actual.origin;
  } catch { return { ok: false, response: storyResponse({ error: 'invalid_host' }, 403) }; }
  if (req.method === 'POST' && req.headers.get('origin') !== actualOrigin) return { ok: false, response: storyResponse({ error: 'invalid_origin' }, 403) };
  const limit = enforceRateLimit(req, { namespace, limit: 8, windowMs: 60_000 });
  if (limit) {
    Object.entries(STORY_NO_STORE).forEach(([key, value]) => limit.headers.set(key, value));
    return { ok: false, response: limit };
  }
  let session;
  try { session = await resolveUserFromRequest(req); }
  catch { return { ok: false, response: storyResponse({ error: 'session_unavailable' }, 503) }; }
  if (!session) return { ok: false, response: storyResponse({ error: 'not_signed_in' }, 401) };
  if (!settings.operators.has(session.user.email.trim().toLowerCase())) return { ok: false, response: storyResponse({ error: 'not_operator' }, 403) };
  return { ok: true, userId: session.user.id, operatorEmail: session.user.email.trim().toLowerCase(), settings };
}

/** Preserve the existing manuscript endpoint's flags, allowlist and rate namespace. */
export const storyAccess = (req: NextRequest) => personalOperatorAccess(req, resolveStorySettings, 'personal-story-pilot');
