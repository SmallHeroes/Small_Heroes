import { NextRequest, NextResponse } from 'next/server';
import { runGenerationWorkerInvocation } from '@/lib/generation-chunked/process-worker';
import { isProdGenerationDisabled } from '@/lib/generation-chunked/env-separation-guard';
import {
  RELEASE_V1_PROTOCOL,
  ReleaseV1ContinuityError,
} from '@/lib/generation-pipeline/release-v1-continuity';

/** Internal auth: `Authorization: Bearer <secret>` (primary), `x-generation-secret`, or body.secret. */
function extractWorkerSecret(req: NextRequest, body: { secret?: unknown }): string | null {
  const auth = req.headers.get('authorization') ?? '';
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim();
  if (bearer) return bearer;
  const header = req.headers.get('x-generation-secret')?.trim();
  if (header) return header;
  if (typeof body.secret === 'string' && body.secret.trim()) return body.secret.trim();
  return null;
}

export async function handleGenerationWorkerPost(
  req: NextRequest,
  options: { routeProtocol: 'legacy-route' | typeof RELEASE_V1_PROTOCOL },
) {
  // P0 prod-cutover: hard-disable on real Production BEFORE reading body/auth/secret.
  if (isProdGenerationDisabled()) {
    return NextResponse.json({ error: 'generation_disabled_on_prod' }, { status: 503 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { orderId?: string; secret?: string };
    const { orderId } = body;

    const expectedSecret = process.env.GENERATION_SECRET?.trim();
    if (!expectedSecret) {
      return NextResponse.json({ error: 'GENERATION_SECRET not configured' }, { status: 503 });
    }
    // Internal worker auth — no browser cookies / SITE_PASSWORD. Accept Bearer / header / body.
    const secret = extractWorkerSecret(req, body);
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const routeProtocol = options.routeProtocol;
    const result = await runGenerationWorkerInvocation(orderId, {
      routeProtocol,
    });
    return NextResponse.json({ ok: result.ok, stage: result.stage, error: result.error });
  } catch (error) {
    if (error instanceof ReleaseV1ContinuityError) {
      return NextResponse.json(
        { error: error.code, reasons: error.reasons },
        { status: 409 },
      );
    }
    console.error('[POST /api/generate/worker]', error);
    // Always JSON (never an HTML error page) so the self-chain can parse the response.
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
