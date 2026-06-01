import { NextRequest, NextResponse } from 'next/server';
import { startChunkedGeneration } from '@/lib/generation-chunked/start';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, secret, reason } = body as {
      orderId?: string;
      secret?: string;
      reason?: string;
    };

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

    const triggerReason =
      typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : 'api_start';

    const result = await startChunkedGeneration(orderId, triggerReason);
    if (!result.started) {
      return NextResponse.json({ error: result.message ?? 'Could not start' }, { status: 409 });
    }

    return NextResponse.json({ started: true, orderId, mode: 'chunked' });
  } catch (error) {
    console.error('[POST /api/generate/start]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
