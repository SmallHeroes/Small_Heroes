/**
 * Fire-and-forget worker kick — MUST NOT await the next worker finishing.
 * Correctness is DB state + sweeper/resume, not this request.
 */
import { prisma } from '@/lib/prisma';
import { assertEnvSeparation } from './env-separation-guard';

async function failGenerationChain(orderId: string, message: string): Promise<void> {
  console.error(`[chunked-gen] ${message}`, { orderId });
  await prisma.generationJob.update({
    where: { orderId },
    data: {
      status: 'failed',
      lastError: message,
      failedAt: new Date(),
      retryable: true,
    },
  });
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'failed', lastError: message },
  });
}

export function chainGenerationWorker(orderId: string): void {
  // Env-separation guard (0089 P0): refuse to fan out if a non-production runtime is pointed at a
  // production resource (prod domain / prod Supabase). Throws loudly — staging must never drive prod.
  assertEnvSeparation();

  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');
  if (!base) {
    void failGenerationChain(
      orderId,
      'Generation chain aborted: NEXT_PUBLIC_APP_URL / APP_URL is not configured'
    );
    return;
  }

  const secret = process.env.GENERATION_SECRET?.trim();
  if (!secret) {
    void failGenerationChain(
      orderId,
      'Generation chain aborted: GENERATION_SECRET is not configured'
    );
    return;
  }

  const url = `${base}/api/generate/worker`;
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, secret }),
    keepalive: true,
  })
    .then((res) => {
      if (!res.ok) {
        console.warn('[chunked-gen] chain worker non-OK', orderId, res.status);
      }
    })
    .catch((err) => {
      console.warn('[chunked-gen] chain worker failed (non-fatal)', orderId, err);
    });
}
