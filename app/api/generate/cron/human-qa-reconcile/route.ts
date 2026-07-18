import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { reconcileHumanQaHolds } from '@/lib/human-qa/reconcile-core';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const log = createLogger({ subsystem: 'human-qa-reconcile-cron', route: '/api/generate/cron/human-qa-reconcile' });

/**
 * (Human-QA Slice 1, re-gate P0-B) The SCHEDULED reconciler — the guaranteed production repair net for a review case
 * whose POST-COMMIT write failed at a seam. Case creation deliberately lives OUTSIDE every hold/money transaction
 * (sync-hold-case.ts); a crash in that post-commit window leaves a silent hold. Round-2 was NO-GO because the only
 * repair was a MANUAL staging-only script (assertEnvSeparation) — never a prod repair. This cron closes that gap.
 *
 * - CRON_SECRET-gated, same as the other four crons (Vercel injects `Authorization: Bearer $CRON_SECRET`).
 * - FLAG-INDEPENDENT: it does NOT read `HUMAN_QA_NOTIFY_ENABLED`. The SENDER (operator-notifications cron) may be
 *   off, but the case MUST still be created — otherwise the sender has nothing to send.
 * - Uses the shared `reconcileHumanQaHolds` core (no `assertEnvSeparation` staging guard → prod-capable).
 *
 * SLA ≤ 5 min from hold to case. Emits a structured metric (reconciler-created count + oldest-missing-case age);
 * a breach (created>0 AND oldest age past the SLA) is logged at ERROR so it is alertable. A healthy system creates
 * ZERO here — the post-commit hook already opened the case — so any nonzero `created` is itself the signal.
 */
const SLA_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const summary = await reconcileHumanQaHolds(prisma);

  const slaBreached = summary.created > 0 && summary.oldestMissingCaseAgeMs > SLA_MS;
  const metric = {
    metric: 'human_qa.reconciler',
    event: 'human_qa_reconcile_tick',
    scanned: summary.scanned,
    created: summary.created,
    idempotent: summary.idempotent,
    errors: summary.errors.length,
    oldestMissingCaseAgeMs: summary.oldestMissingCaseAgeMs,
    reconcilerLagMs: summary.oldestMissingCaseAgeMs, // lag = how late the oldest missing case was repaired
    slaMs: SLA_MS,
    slaBreached,
    legacyUnknown: summary.legacyUnknown.length,
  };

  if (slaBreached || summary.errors.length > 0) {
    // Alertable: either the post-commit hook is failing and cases are landing past the SLA, or a per-order repair
    // errored. Both mean a hold may sit without a case longer than the contract allows.
    log.error('reconciler SLA breach or errors — holds missing a case', undefined, metric);
  } else if (summary.created > 0) {
    // Cases were created here → the post-commit hook missed them (within SLA). Worth noticing, not yet an alert.
    log.warn('reconciler created cases the post-commit hook missed (within SLA)', metric);
  } else {
    log.info('reconciler tick — nothing to repair', metric);
  }

  return NextResponse.json({ ok: true, ...summary });
}
