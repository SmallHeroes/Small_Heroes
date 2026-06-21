import { NextRequest, NextResponse } from 'next/server';
import { runGenerationWorkerInvocation } from '@/lib/generation-chunked/process-worker';
import { isProdGenerationDisabled } from '@/lib/generation-chunked/env-separation-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // P0 prod-cutover: hard-disable on real Production BEFORE reading body/auth/secret.
  if (isProdGenerationDisabled()) {
    return NextResponse.json({ error: 'generation_disabled_on_prod' }, { status: 503 });
  }
  try {
    const body = await req.json();
    const { orderId, secret } = body as { orderId?: string; secret?: string };

    const expectedSecret = process.env.GENERATION_SECRET?.trim();
    if (!expectedSecret) {
      return NextResponse.json({ error: 'GENERATION_SECRET not configured' }, { status: 503 });
    }
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const result = await runGenerationWorkerInvocation(orderId);
    return NextResponse.json({ ok: result.ok, stage: result.stage, error: result.error });
  } catch (error) {
    console.error('[POST /api/generate/worker]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
