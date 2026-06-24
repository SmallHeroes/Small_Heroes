/**
 * Generation Orchestrator
 * POST /api/generate — Manual trigger (webhook fallback)
 * Also exports triggerGeneration() for use by the payment/webhook handlers.
 *
 * Chunked generation (lib/generation-pipeline/chunk-runner.ts) is the ONLY generation path.
 * The legacy single-invocation monolith was removed (0097): it set status ready/partial and
 * sent the book-ready email WITHOUT the anchor delivery gate, so a low-confidence anchor could
 * ship to a customer via any payment/dev trigger. Generation completion — including the
 * book-ready email and the needs_human_qa delivery hold — now lives solely in the chunked
 * package stage (resolveAnchorDeliveryGate).
 */

import { type OrderStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { createLogger } from '../../../lib/logger';
import { startChunkedGeneration } from '@/lib/generation-chunked/start';
import {
  assertEnvSeparation,
  assertProdGenerationAllowed,
  isProdGenerationDisabled,
} from '@/lib/generation-chunked/env-separation-guard';

const GENERATION_ELIGIBLE_STATUS = 'paid';
const RETRYABLE_STATUSES = [GENERATION_ELIGIBLE_STATUS, 'failed'] as const;
const RETRYABLE_STATUS_VALUES: OrderStatus[] = [...RETRYABLE_STATUSES];
const generationLogger = createLogger({ subsystem: 'generation', route: '/api/generate' });
const generateApiLogger = createLogger({ subsystem: 'generation-api', route: '/api/generate' });

// ─── Main Orchestrator (chunked — the only generation path) ───
export async function triggerGeneration(orderId: string, reason = 'unspecified'): Promise<void> {
  assertProdGenerationAllowed();
  assertEnvSeparation();
  // Chunked is the ONLY generation path. The legacy single-invocation monolith — which set
  // status ready/partial and sent the book-ready email WITHOUT the anchor delivery gate — has
  // been removed so no payment/dev route can bypass the low-confidence-anchor hold. The book-
  // ready email is reachable solely from the chunked package stage (chunk-runner.ts), which
  // applies resolveAnchorDeliveryGate. GENERATION_MONOLITH is no longer honored.
  const result = await startChunkedGeneration(orderId, reason);
  if (!result.started) {
    generationLogger.warn('Chunked start rejected', { orderId, reason, message: result.message });
  }
  return;
}

// ─── API Route Handler (manual trigger / webhook fallback) ───
export async function POST(req: Request) {
  // P0 prod-cutover: hard-disable on real Production BEFORE reading body/auth/secret.
  if (isProdGenerationDisabled()) {
    return Response.json({ error: 'generation_disabled_on_prod' }, { status: 503 });
  }
  try {
    const { orderId, secret, reason } = await req.json();
    const expectedSecret = process.env.GENERATION_SECRET;
    if (!expectedSecret) {
      generateApiLogger.error('GENERATION_SECRET missing; refusing trigger');
      return Response.json({ error: 'Generation trigger is disabled (server misconfigured)' }, { status: 503 });
    }
    if (typeof secret !== 'string' || secret !== expectedSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orderId) {
      return Response.json({ error: 'orderId required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    if (order.status === 'ready' || order.status === 'partial') {
      return Response.json({ error: 'Generation already completed for this order' }, { status: 409 });
    }
    if (order.status === 'generating') {
      return Response.json({ error: 'Generation is already in progress' }, { status: 409 });
    }
    if (!RETRYABLE_STATUS_VALUES.includes(order.status)) {
      return Response.json({ error: 'Order is not eligible for generation' }, { status: 409 });
    }
    const activeJob = await prisma.generationJob.findUnique({
      where: { orderId },
      select: { status: true },
    });
    if (activeJob?.status === 'running') {
      return Response.json({ error: 'Generation is already in progress' }, { status: 409 });
    }

    const triggerReason = typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : 'manual_api';
    generateApiLogger.info('Manual trigger accepted (chunked)', { orderId, reason: triggerReason });
    const result = await startChunkedGeneration(orderId, triggerReason);
    if (!result.started) {
      return Response.json({ error: result.message ?? 'Could not start generation' }, { status: 409 });
    }

    return Response.json({ started: true, orderId, mode: 'chunked' });
  } catch (error) {
    console.error('[generate] Unhandled error:', error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
