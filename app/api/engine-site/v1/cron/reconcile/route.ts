import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { engineFulfillmentEnabled, reconcileEngineBook, recoverEnginePaidJob, engineSiteOrigin } from '@/lib/engine-site/fulfillment';
import { productionEnginePrivateStorage } from '@/lib/engine-site/private-storage';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  if (!engineFulfillmentEnabled()) return NextResponse.json({ skipped: 'personal_fulfillment_disabled' });
  const secret = process.env.CRON_SECRET, supplied = req.headers.get('authorization') ?? '', expected = `Bearer ${secret ?? ''}`;
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const paid = await prisma.order.findFirst({ where: { frozenProductVersion: 'engine-site/v1', status: 'paid',
    generationJob: { is: null }, deliveryHoldReason: null, manualReviewRequired: false }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (paid) {
    try {
      const { startChunkedGeneration } = await import('@/lib/generation-chunked/start');
      const { chainGenerationWorker } = await import('@/lib/generation-chunked/chain-worker');
      return NextResponse.json({ processed: 1, results: [await recoverEnginePaidJob(prisma, paid.id,
        id => startChunkedGeneration(id, 'engine_paid_job_reconcile', { skipWorkerChain: true }), chainGenerationWorker)] });
    } catch { return NextResponse.json({ processed: 0, results: [{ status: 'operator_reconciliation_required' }] }); }
  }
  // Unsent done jobs must be revisited after a policy change; successful deliveries never re-enter the launch gate.
  const jobs = await prisma.$queryRaw<Array<{ orderId: string }>>`
    SELECT j."orderId" FROM "GenerationJob" j JOIN "Order" o ON o.id=j."orderId"
    WHERE o."frozenProductVersion"='engine-site/v1' AND o.status::text IN ('generating','needs_human_qa','failed','ready')
      AND j."currentStage" IN ('engine_site_accept','engine_site_review','failed','done')
      AND (j."lockedBy" IS NULL OR j."leaseExpiresAt" < now())
      AND NOT EXISTS (SELECT 1 FROM "DeliveryOutbox" d WHERE d."orderId"=o.id AND d.scope='engine_site_book' AND d.status='sent')
    ORDER BY j."updatedAt" ASC LIMIT 1`;
  const results = [];
  for (const job of jobs) {
    try { results.push(await reconcileEngineBook(prisma, job.orderId, { storage: productionEnginePrivateStorage(), origin: engineSiteOrigin() })); }
    catch { results.push({ status: 'operator_reconciliation_required' }); }
  }
  return NextResponse.json({ processed: results.length, results });
}
