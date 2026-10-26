/**
 * /api/dev/personal-wizard/momentum-book — local, opt-in bridge from the Personal Wizard to the ONE momentum book slot.
 * POST records the Wizard's accepted request (once); GET reports that book's progress. No provider, key, claim, order or payment:
 * the paid run is the separately gated operator. Gates: dev only, PERSONAL_WIZARD_PREVIEW + PERSONAL_WIZARD_MOMENTUM_BOOK_RUNNER +
 * an absolute config, localhost Host, same-origin writes, per-IP rate limit, body ceiling.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isDevEnvironment } from '@/lib/dev-only-guard';
import { enforceRateLimit } from '@/lib/request-security';
import { resolveMomentumBookSettings, momentumBookConfig, momentumLocalGate, enqueueMomentumBook, readMomentumBookStatus,
  MomentumBridgeError, MOMENTUM_WIZARD_SLOT } from '@/lib/personal-wizard/momentum-book-bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// No session/database here (like the provider-free request-validation route): nothing on this route spends or authorizes spending.
const storyResponse = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
const MAX_BODY_BYTES = 32768;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const envelope = z.object({ request: z.unknown(), requestId: hash, consent: z.literal(MOMENTUM_WIZARD_SLOT.consent) }).strict().refine(v => v.request !== undefined);
const REFUSAL: Record<string, number> = { momentum_slot_consumed: 409, momentum_owner: 404, momentum_intake: 404 };
function failure(error: unknown) {
  const code = error instanceof MomentumBridgeError ? error.code : 'momentum_unavailable';
  return storyResponse({ error: code, runtimeEligible: false }, REFUSAL[code] ?? (code === 'momentum_config' || code === 'momentum_unavailable' ? 503 : 422));
}
function gate(req: NextRequest) {
  const settings = resolveMomentumBookSettings();
  if (!isDevEnvironment() || !settings) return { error: storyResponse({ error: 'not_found' }, 404) };
  const refused = momentumLocalGate({ hostname: req.nextUrl.hostname, host: req.headers.get('host'), protocol: req.nextUrl.protocol, method: req.method,
    origin: req.headers.get('origin') });
  if (refused) return { error: storyResponse({ error: refused }, refused === 'not_found' ? 404 : 403) };
  const limited = enforceRateLimit(req, { namespace: `dev-personal-wizard-momentum-book:${req.method}`, limit: req.method === 'GET' ? 30 : 8, windowMs: 60_000 });
  if (limited) return { error: limited };
  return { settings };
}
export async function GET(req: NextRequest) {
  const allowed = gate(req); if (allowed.error) return allowed.error;
  try {
    const config = momentumBookConfig(allowed.settings.configFile), values = req.nextUrl.searchParams.getAll('requestId');
    if (!values.length) return storyResponse({ configured: true, engine: 'momentum-v4-roles', voiceIds: MOMENTUM_WIZARD_SLOT.voiceIds,
      lengthId: 'short', operatorWorkerRequired: true, runtimeEligible: false, cycle: config.cycle });
    if (values.length !== 1 || !hash.safeParse(values[0]).success) return storyResponse({ error: 'momentum_request_binding' }, 422);
    return storyResponse(readMomentumBookStatus(config, values[0]));
  } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  const allowed = gate(req); if (allowed.error) return allowed.error;
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return storyResponse({ error: 'unsupported_type' }, 415);
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return storyResponse({ error: 'body_too_large' }, 413);
  const text = await req.text(); if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return storyResponse({ error: 'body_too_large' }, 413);
  let raw: unknown; try { raw = JSON.parse(text); } catch { return storyResponse({ error: 'invalid_json' }, 400); }
  const parsed = envelope.safeParse(raw); if (!parsed.success) return storyResponse({ error: 'invalid_envelope' }, 422);
  try { return storyResponse(enqueueMomentumBook(momentumBookConfig(allowed.settings.configFile), { request: parsed.data.request, requestId: parsed.data.requestId }), 202); }
  catch (error) { return failure(error); }
}
