import { NextRequest, NextResponse } from 'next/server';
import { regenerateSinglePageImage } from '@/lib/single-page-image-regen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isRegenAllowed(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.ALLOW_REGEN_IN_PROD === '1';
}

export async function POST(req: NextRequest) {
  if (!isRegenAllowed()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    secret?: string;
    orderId?: string;
    pageNumber?: number;
  };

  if (process.env.GENERATION_SECRET && body.secret !== process.env.GENERATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  const pageNumber = Number(body.pageNumber);
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    return NextResponse.json({ error: 'pageNumber must be a positive integer' }, { status: 400 });
  }

  try {
    const result = await regenerateSinglePageImage(orderId, Math.floor(pageNumber));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
