import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  drainOperatorNotifications,
  casClaimOperatorSendSlot,
  defaultOperatorSend,
} from '@/lib/human-qa/operator-notification-send';
import { isOperatorNotifyEnabled } from '@/lib/human-qa/flags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * (Human-QA Slice 1, Unit 3) Drain the operator-notification outbox. Hit by the Vercel cron (prod; injects
 * `Authorization: Bearer $CRON_SECRET`). Unit 1's hold tx only ENQUEUED a `scheduled` row — THIS worker is the
 * single place the internal operator-review email is actually sent, gated by ONE atomic send-time CAS (case still
 * ACTIVE + Order still needs_human_qa) + Idempotency-Key = dedupeKey (effectively-once).
 *
 * No-op unless HUMAN_QA_NOTIFY_ENABLED is on. The operator email is a purely internal notification and is safe in
 * prod, but the worker stays INERT until the flag is turned on so it never surprises a live environment.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isOperatorNotifyEnabled()) {
    return NextResponse.json({ skipped: 'human_qa_notify_disabled' });
  }

  const summary = await drainOperatorNotifications(
    prisma,
    { limit: 1 }, // single-claim per tick
    {
      // The single atomic send-time CAS: renew lease + set sendAttempted IFF the case is still active + Order held.
      cas: (row, token, leaseExpiresAt, now) => casClaimOperatorSendSlot(prisma, row, token, leaseExpiresAt, now),
      // Fail-closed on a missing HUMAN_QA_OPERATOR_EMAIL — never sends, never releases the hold.
      send: defaultOperatorSend(),
    },
  );
  return NextResponse.json(summary);
}
