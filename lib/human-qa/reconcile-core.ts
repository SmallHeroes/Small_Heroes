import 'server-only';

import type { PrismaClient } from '@prisma/client';
import { syncHumanQaHoldCase } from '@/lib/human-qa/sync-hold-case';

/**
 * (Human-QA Slice 1, re-gate P0-B) The SHARED reconcile core — the guaranteed repair net for a review-case whose
 * POST-COMMIT write failed at a seam (case creation deliberately lives outside every hold/money tx — see
 * sync-hold-case.ts). It walks orders in terminal `needs_human_qa` and delegates EVERY decision to
 * `syncHumanQaHoldCase` → `classifyHoldForCase`, the same classifier the live seams use, so the repair can never
 * diverge from the live path.
 *
 * This core is PROD-CAPABLE and flag-INDEPENDENT: it has NO `assertEnvSeparation()` guard (that stays in the manual
 * staging script) and does NOT read `HUMAN_QA_NOTIFY_ENABLED` (creating the case must happen even when the SENDER is
 * off). Both the scheduled cron (`app/api/generate/cron/human-qa-reconcile`) and the manual script call this.
 */

export interface ReconcileSummary {
  scanned: number;
  created: number;
  wouldCreate: number;
  idempotent: number;
  /** skip reason → count (recoverable / exception_case / unknown / not_held / no_anchor_case / …). */
  skipped: Record<string, number>;
  /** legacy_unknown orders that were (would be) backfilled — need explicit operator triage. */
  legacyUnknown: string[];
  errors: Array<{ orderId: string; message: string }>;
  /**
   * SLA signal — age (ms) of the OLDEST hold that was MISSING a case this pass (i.e. the reconciler had to create or
   * would create it). A healthy system creates ZERO here (the post-commit hook already did it); a nonzero
   * `created` with an age over the SLA means the post-commit path is failing and the reconciler caught it late.
   * Uses Order.updatedAt as the park-time proxy (there is no dedicated held-at column). 0 when nothing was missing.
   */
  oldestMissingCaseAgeMs: number;
  dryRun: boolean;
  includeUnknown: boolean;
}

export interface ReconcileOpts {
  includeUnknown?: boolean;
  dryRun?: boolean;
  onlyOrderId?: string | null;
  /** Injected clock for the age metric (tests). Defaults to the wall clock. */
  now?: Date;
  /** Optional per-order callback (the manual script prints; the cron stays quiet). */
  onResult?: (orderId: string, action: string, detail: Record<string, unknown>) => void;
}

/**
 * Reconcile every terminal `needs_human_qa` order (or a single `onlyOrderId`). Idempotent: a re-run creates nothing
 * new (`syncHumanQaHoldCase` is idempotent and each order runs in its own transaction). Never throws — a per-order
 * failure is captured in `errors` and the scan continues.
 */
export async function reconcileHumanQaHolds(prisma: PrismaClient, opts: ReconcileOpts = {}): Promise<ReconcileSummary> {
  const now = opts.now ?? new Date();
  const orders = await prisma.order.findMany({
    where: {
      status: 'needs_human_qa',
      ...(opts.onlyOrderId ? { id: opts.onlyOrderId } : {}),
    },
    select: { id: true, updatedAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const summary: ReconcileSummary = {
    scanned: orders.length,
    created: 0,
    wouldCreate: 0,
    idempotent: 0,
    skipped: {},
    legacyUnknown: [],
    errors: [],
    oldestMissingCaseAgeMs: 0,
    dryRun: Boolean(opts.dryRun),
    includeUnknown: Boolean(opts.includeUnknown),
  };

  for (const order of orders) {
    try {
      const res = await syncHumanQaHoldCase(prisma, order.id, {
        includeUnknown: opts.includeUnknown,
        dryRun: opts.dryRun,
      });
      opts.onResult?.(order.id, res.action, { kind: res.kind, scope: res.scope, reason: res.reason, caseId: res.caseId });

      const wasMissing = res.action === 'created' || res.action === 'would_create';
      if (wasMissing) {
        const ageMs = Math.max(0, now.getTime() - order.updatedAt.getTime());
        if (ageMs > summary.oldestMissingCaseAgeMs) summary.oldestMissingCaseAgeMs = ageMs;
      }
      if (res.kind === 'legacy_unknown' && wasMissing) summary.legacyUnknown.push(order.id);

      switch (res.action) {
        case 'created':
          summary.created++;
          break;
        case 'would_create':
          summary.wouldCreate++;
          break;
        case 'idempotent':
          summary.idempotent++;
          break;
        case 'skipped': {
          const reason = res.reason ?? 'unknown';
          summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
          break;
        }
        default:
          // 'resolved'/'error' cannot occur for a needs_human_qa order via this path; count defensively.
          summary.skipped[res.action] = (summary.skipped[res.action] ?? 0) + 1;
      }
    } catch (err) {
      summary.errors.push({ orderId: order.id, message: err instanceof Error ? err.message : String(err) });
      opts.onResult?.(order.id, 'error', { message: err instanceof Error ? err.message : String(err) });
    }
  }

  return summary;
}
