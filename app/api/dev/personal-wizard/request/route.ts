/**
 * POST /api/dev/personal-wizard/request — validates a reviewed personal-book request for the
 * prototype and returns its server-derived identity. No provider, no database, no order, no
 * persistence, no logging of request content. The personal writer is not connected.
 *
 * Gates: middleware 404s /api/dev on real production; `isDevEnvironment()`; the explicit
 * PERSONAL_WIZARD_PREVIEW flag; same-origin; per-IP rate limit; body byte ceiling.
 */
import { NextRequest, NextResponse } from 'next/server';

import { isDevEnvironment } from '@/lib/dev-only-guard';
import { isPersonalWizardPreviewEnabled } from '@/lib/personal-wizard/flags';
import { resolvePersonalWizardOptions } from '@/lib/personal-wizard/options';
import { acceptPersonalBookRequest } from '@/lib/personal-wizard/request-acceptance';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 32 * 1024;
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(req: NextRequest) {
  if (!isDevEnvironment() || !isPersonalWizardPreviewEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const rateLimitError = enforceRateLimit(req, {
    namespace: 'dev-personal-wizard-request',
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimitError) return rateLimitError;

  const declaredLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413, headers: NO_STORE });
  }
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413, headers: NO_STORE });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: NO_STORE });
  }

  const result = acceptPersonalBookRequest(body, resolvePersonalWizardOptions());
  if (!result.ok) {
    return NextResponse.json({ status: 'rejected', issues: result.issues }, { status: 422, headers: NO_STORE });
  }
  return NextResponse.json(
    {
      status: 'accepted_preview',
      requestId: result.requestId,
      optionsFingerprint: result.optionsFingerprint,
      containsFixtureData: result.containsFixtureData,
      writer: result.writer,
      canonical: result.canonical,
    },
    { headers: NO_STORE },
  );
}
