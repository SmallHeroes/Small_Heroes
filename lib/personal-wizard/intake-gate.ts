import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { resolveUserFromRequest } from '@/lib/auth-session';
import { isDevEnvironment } from '@/lib/dev-only-guard';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/request-security';

import {
  readIntakeApiKey,
  resolveLiveIntakeSettings,
  type LiveIntakeConfig,
  type LiveIntakeDisabledReason,
} from './intake-config';

/**
 * Authority for live intake: explicit server flags AND a signed-in session whose email is on the
 * operator allowlist. No query parameter, header or client flag grants access, and NODE_ENV alone
 * is not the boundary (middleware + isDevEnvironment + the flags all apply). A disabled or
 * unauthorised caller is refused before the body is read, and the provider credential is read only
 * after the operator session is confirmed.
 */
export const NO_STORE = { 'Cache-Control': 'no-store' } as const;

type Env = Readonly<Record<string, string | undefined>>;

export type LiveIntakeAccess =
  | { ok: true; userId: string; config: LiveIntakeConfig }
  | { ok: false; response: NextResponse };

type SessionResolver = (req: NextRequest) => Promise<{ user: { id: string; email: string } } | null>;

async function operatorFor(
  req: NextRequest,
  operators: ReadonlySet<string>,
  resolveSession: SessionResolver,
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  let session: Awaited<ReturnType<SessionResolver>>;
  try {
    session = await resolveSession(req);
  } catch {
    return { ok: false, status: 503, error: 'session_unavailable' };
  }
  if (!session) return { ok: false, status: 401, error: 'not_signed_in' };
  if (!operators.has(session.user.email.trim().toLowerCase())) return { ok: false, status: 403, error: 'not_operator' };
  return { ok: true, userId: session.user.id };
}

export async function gateLiveIntake(
  req: NextRequest,
  resolveSession: SessionResolver = resolveUserFromRequest,
  env: Env = process.env,
): Promise<LiveIntakeAccess> {
  const notFound = { ok: false as const, response: NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE }) };
  if (!isDevEnvironment()) return notFound;
  const resolution = resolveLiveIntakeSettings(env);
  if (!resolution.enabled) return notFound;
  const originError = enforceSameOrigin(req);
  if (originError) return { ok: false, response: originError };
  const rateLimitError = enforceRateLimit(req, { namespace: 'dev-personal-wizard-intake', limit: 12, windowMs: 60_000 });
  if (rateLimitError) return { ok: false, response: rateLimitError };
  const operator = await operatorFor(req, resolution.settings.operators, resolveSession);
  if (!operator.ok) {
    return { ok: false, response: NextResponse.json({ error: operator.error }, { status: operator.status, headers: NO_STORE }) };
  }
  const apiKey = readIntakeApiKey(env);
  if (!apiKey) {
    return { ok: false, response: NextResponse.json({ error: 'live_unavailable' }, { status: 503, headers: NO_STORE }) };
  }
  return { ok: true, userId: operator.userId, config: { ...resolution.settings, apiKey } };
}

/** Status for the page: tells the UI whether to offer live processing. It grants nothing. */
export async function liveIntakeStatus(
  req: NextRequest,
  resolveSession: SessionResolver = resolveUserFromRequest,
  env: Env = process.env,
): Promise<{ live: boolean; reason: LiveIntakeDisabledReason | 'not_signed_in' | 'not_operator' | 'session_unavailable' | null }> {
  const resolution = resolveLiveIntakeSettings(env);
  if (!resolution.enabled) return { live: false, reason: resolution.reason };
  const operator = await operatorFor(req, resolution.settings.operators, resolveSession);
  if (!operator.ok) return { live: false, reason: operator.error as 'not_signed_in' | 'not_operator' | 'session_unavailable' };
  if (!readIntakeApiKey(env)) return { live: false, reason: 'api_key_missing' };
  return { live: true, reason: null };
}

/** Reads at most `limit` bytes; returns null (and cancels the stream) as soon as it is exceeded. */
export async function readBodyWithLimit(req: Request, limit: number): Promise<Buffer | null> {
  if (!req.body) return Buffer.alloc(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
