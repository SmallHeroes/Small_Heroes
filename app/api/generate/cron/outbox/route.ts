import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { drainOutbox } from '@/lib/generation-chunked/delivery-outbox';
import { casClaimSendSlot, isReadinessManifestEnabled } from '@/lib/generation-pipeline/readiness-manifest';
import { sendBookReadyEmail } from '@/backend/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Drain the delivery Outbox (Phase-1 base_book_integrity). Hit by the Vercel cron (prod; injects
 * `Authorization: Bearer $CRON_SECRET`) AND an external scheduler on preview/staging (see the sweep route).
 * The PASS transaction only ENQUEUED a row — THIS worker is the single place a base-book ready email is
 * actually sent, gated by ONE atomic send-time CAS (P1-f) + idempotency-key = dedupeKey (effectively-once).
 * No-op when READINESS_MANIFEST_ENABLED is off, so it is inert until the flag is turned on for staging.
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

  const summary = await drainOutbox(
    prisma,
    { limit: 1 }, // simplification A: single-claim per tick
    {
      // (P1-f) the single atomic send-time CAS: renew lease + set sendAttempted/firstSendAttemptAt IFF the row's binding still holds.
      cas: (row, token, leaseExpiresAt, now) => casClaimSendSlot(prisma, row, token, leaseExpiresAt, now),
      send: (payload, idempotencyKey) => sendBookReadyEmail({ ...payload, idempotencyKey }),
    },
  );
  return NextResponse.json(summary);
}
