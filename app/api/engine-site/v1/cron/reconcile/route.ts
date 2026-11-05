import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { engineFulfillmentEnabled, reconcileEngineBook, recoverEnginePaidJob, engineSiteOrigin,failEngineOrder } from '@/lib/engine-site/fulfillment';
import { productionEnginePrivateStorage } from '@/lib/engine-site/private-storage';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  if (!engineFulfillmentEnabled()) return NextResponse.json({ skipped: 'personal_fulfillment_disabled' });
  const secret = process.env.CRON_SECRET, supplied = req.headers.get('authorization') ?? '', expected = `Bearer ${secret ?? ''}`;
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // Finish a committed operator fail intent even if its response/process died before failEngineOrder.
  const terminal=await prisma.order.findFirst({where:{frozenProductVersion:'engine-site/v1',deliveryHoldReason:'engine_site_hold:worker_failed',lastError:'engine_operator_failed_infrastructure'},select:{id:true}});
  if(terminal)return NextResponse.json({processed:1,results:[await failEngineOrder(prisma,terminal.id,'engine_operator_failed_infrastructure')]});
  const paidRows=await prisma.$queryRaw<Array<{id:string}>>`SELECT o.id FROM "Order" o
    WHERE o."frozenProductVersion"='engine-site/v1' AND o.status::text='paid' AND o."deliveryHoldReason" IS NULL AND NOT o."manualReviewRequired"
      AND NOT EXISTS(SELECT 1 FROM "GenerationJob" j WHERE j."orderId"=o.id)
      AND NOT EXISTS(SELECT 1 FROM "WizardSession" w WHERE w."sessionId"='engine-site-recovery/v1/'||o.id||'/paid_job'
        AND (COALESCE((w.data->>'attempts')::int,0)>=3 OR COALESCE((w.data->>'nextAt')::numeric,0)>extract(epoch FROM now())*1000))
    ORDER BY o."createdAt" ASC LIMIT 1`;
  const paid=paidRows[0];
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
      AND (o."deliveryHoldReason" IS NULL OR o."deliveryHoldReason" IN ('engine_site_hold:operator_review','engine_site_hold:worker_failed'))
      AND (j."lockedBy" IS NULL OR j."leaseExpiresAt" < now())
      AND NOT EXISTS (SELECT 1 FROM "DeliveryOutbox" d WHERE d."orderId"=o.id AND d.scope='engine_site_book' AND d.status='sent')
    ORDER BY j."updatedAt" ASC LIMIT 5`;
  const results = [];
  const started=Date.now();
  for (const job of jobs) {
    if(Date.now()-started>240_000)break;
    try {const result=await reconcileEngineBook(prisma, job.orderId, { storage: productionEnginePrivateStorage(), origin: engineSiteOrigin() });results.push(result);
      if(!['retry_scheduled','preparing','external_hold','operator_reconciliation_required','delivery_in_progress'].includes(result.status))break;}
    catch { results.push({ status: 'operator_reconciliation_required' }); }
  }
  return NextResponse.json({ processed: results.length, results });
}
