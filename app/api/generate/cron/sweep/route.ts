import { NextRequest, NextResponse } from 'next/server';
import { sweepStaleGenerationJobs } from '@/lib/generation-chunked/sweeper';
import { sweepPendingChildPhotoDeletions } from '@/lib/child-photo-deletion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Vercel cron — resume stale generation jobs (lease expired). */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resumed = await sweepStaleGenerationJobs(10);
  const photoDeletions = await sweepPendingChildPhotoDeletions(10);
  return NextResponse.json({ resumed, photoDeletions });
}
