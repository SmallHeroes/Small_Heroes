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
  const jobs = await prisma.generationJob.findMany({ where: { currentStage: { in: ['engine_site_accept', 'engine_site_review', 'failed'] },
    order: { frozenProductVersion: 'engine-site/v1', status: { in: ['generating', 'needs_human_qa', 'failed'] } },
    OR: [{ lockedBy: null }, { leaseExpiresAt: { lt: new Date() } }] }, orderBy: { updatedAt: 'asc' }, take: 1, select: { orderId: true } });
  const results = [];
  for (const job of jobs) {
    try { results.push(await reconcileEngineBook(prisma, job.orderId, { storage: productionEnginePrivateStorage(), origin: engineSiteOrigin() })); }
    catch { results.push({ status: 'operator_reconciliation_required' }); }
  }
  return NextResponse.json({ processed: results.length, results });
}
