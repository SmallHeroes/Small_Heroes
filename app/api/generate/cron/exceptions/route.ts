import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { drainExceptionCases } from '@/lib/generation-chunked/exception-processor';
import { isReadinessManifestEnabled } from '@/lib/generation-pipeline/readiness-manifest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Autonomous Phase-1 recovery worker. One claimed case per tick keeps provider effects bounded and
 * makes the four-minute fenced lease comfortably exceed this function's execution budget.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isReadinessManifestEnabled()) {
    return NextResponse.json({ skipped: 'readiness_manifest_disabled' });
  }

  const summary = await drainExceptionCases(prisma, { limit: 1 });
  return NextResponse.json(summary);
}
