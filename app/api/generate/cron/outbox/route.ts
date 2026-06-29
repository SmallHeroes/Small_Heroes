import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { drainOutbox } from '@/lib/generation-chunked/delivery-outbox';
import { recheckBaseBookDelivery, markBaseBookStale, isReadinessManifestEnabled } from '@/lib/generation-pipeline/readiness-manifest';
import { sendBookReadyEmail } from '@/backend/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Drain the delivery Outbox (Phase-1 base_book_integrity). Hit by the Vercel cron (prod; injects
 * `Authorization: Bearer $CRON_SECRET`) AND an external scheduler on preview/staging (see the sweep route).
 * The PASS transaction only ENQUEUED a row — THIS worker is the single place a base-book ready email is
 * actually sent, with a pre-send recheck (suppress on drift) + idempotency-key = dedupeKey (effectively-once).
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
    { limit: 5 },
    {
      recheck: async (orderId, scope) => {
        const d = await recheckBaseBookDelivery(prisma, orderId, scope);
        // B3: real drift at send time => mark readiness stale + take the order off `ready` (book no longer visible).
        if (d.outcome === 'suppress' && d.reason === 'inputs_changed_since_manifest') {
          await markBaseBookStale(prisma, orderId, scope);
        }
        return d;
      },
      send: (payload, idempotencyKey) => sendBookReadyEmail({ ...payload, idempotencyKey }),
    },
  );
  return NextResponse.json(summary);
}
