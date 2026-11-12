import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { engineQaScope, isEngineQaOrder } from './qa-order-policy';

const TERMINAL = new Set(['done', 'failed', 'engine_site_accept', 'engine_site_review', 'engine_site_operator', 'engine_site_terminal']);
const STALE_MS = 90_000;

/**
 * QA Preview stand-in for the production crons (Vercel runs crons on Production only). When the QA parent's own
 * status page polls, a QA order whose self-chain went quiet (no live lease, no update for 90 s) gets one more worker
 * dispatch. The worker re-checks every admission, lease and meter rule itself; this only wakes it.
 */
export async function kickEngineQaOrder(db: PrismaClient, orderId: string, userId: string, wake: (orderId: string) => void, now = Date.now()) {
  const qa = engineQaScope();
  if (!qa || userId !== qa.parentId) return 'not_qa' as const;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { userId: true, selectedVoice: true, status: true,
    deliveryHoldReason: true, manualReviewRequired: true, wizardSession: { select: { sessionId: true } }, generationJob: true } });
  if (!order || !isEngineQaOrder(qa, order, order.wizardSession?.sessionId)) return 'not_qa' as const;
  const job = order.generationJob;
  if (!job || !['paid', 'generating'].includes(order.status) || order.deliveryHoldReason !== null || order.manualReviewRequired ||
      !['pending', 'running'].includes(job.status) || TERMINAL.has(job.currentStage ?? '')) return 'idle' as const;
  const leased = job.lockedBy !== null && job.leaseExpiresAt !== null && job.leaseExpiresAt.getTime() > now;
  if (leased || now - job.updatedAt.getTime() < STALE_MS) return 'running' as const;
  wake(orderId);
  return 'woken' as const;
}
