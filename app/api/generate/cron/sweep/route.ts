import { NextRequest, NextResponse } from 'next/server';
import { sweepStaleGenerationJobs } from '@/lib/generation-chunked/sweeper';
import { sweepPendingChildPhotoDeletions } from '@/lib/child-photo-deletion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Sweep stale generation jobs (expired lease) — the durable recovery trigger.
 *
 * Hit by the Vercel cron (prod; injects `Authorization: Bearer $CRON_SECRET`) AND by an external
 * scheduler on preview/staging where Vercel preview crons DO NOT run (GitHub Action / cron-job.org
 * / UptimeRobot — see scripts/ci/staging-generation-sweep.yml, installed to .github/workflows/).
 * Auth is REQUIRED: a missing
 * CRON_SECRET returns 503 (never run open), a mismatch returns 401.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resumed = await sweepStaleGenerationJobs(10);
  const photoDeletions = await sweepPendingChildPhotoDeletions(10);
  return NextResponse.json({ resumed, photoDeletions });
}
