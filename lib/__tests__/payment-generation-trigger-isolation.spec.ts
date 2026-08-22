import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * MONEY-PATH error isolation (Codex re-gate). The payment routes now AWAIT triggerGeneration so the
 * synchronous job-creation + the durable after() dispatch registration complete BEFORE the route
 * returns (an unawaited start could be dropped by a post-response serverless freeze). But a generation
 * START failure must still return a 2xx payment acknowledgement: a non-2xx would make PayMe/Stripe
 * RETRY the webhook -> double-processing / double-charge. This pins that contract on the active prod
 * provider (PayMe): triggerGeneration throwing must NOT change the 200 ack.
 */

// Hoisted so the vi.mock factories (also hoisted) can reference them without a TDZ error.
const { triggerGeneration, $transaction } = vi.hoisted(() => ({
  triggerGeneration: vi.fn(),
  $transaction: vi.fn(async () => true),
}));

// triggerGeneration is imported by the webhook via the relative '../../generate/trigger'; vitest resolves
// that and the '@/' alias to the same module id, so this mock intercepts the real call site.
vi.mock('@/app/api/generate/trigger', () => ({ triggerGeneration }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction }, Prisma: {} }));
vi.mock('@/lib/env', () => ({ env: { PAYMENT_PROVIDER: 'payme' } }));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/lib/payme', () => ({
  extractWebhookClientIp: vi.fn(() => null),
  isPaymeStatusPaid: vi.fn(() => true),
  resolvePaymeConfig: vi.fn(() => ({ webhookSecret: 'secret', allowedWebhookIps: [] })),
  verifyPaymeSignature: vi.fn(() => true),
  parsePaymeWebhookPayload: vi.fn(() => ({
    orderId: 'order_1',
    transactionId: 'txn_1',
    paymentStatus: 'paid',
    eventType: 'payment',
    raw: {},
    usedFallbackFields: false,
  })),
}));

function webhookRequest(): NextRequest {
  return new NextRequest('https://example.com/api/webhooks/payme', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-payme-signature': 'sig' },
    body: JSON.stringify({ orderId: 'order_1', transactionId: 'txn_1', paymentStatus: 'paid' }),
  });
}

describe('PayMe webhook — generation-start failure is isolated from the payment ack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $transaction.mockResolvedValue(true); // paid-transition happened -> generation should be triggered
  });

  it('returns 200 processed even when triggerGeneration THROWS (no non-2xx -> no PayMe retry)', async () => {
    triggerGeneration.mockRejectedValueOnce(new Error('startChunkedGeneration blew up'));
    const { POST } = await import('@/app/api/webhooks/payme/route');

    const res = await POST(webhookRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, processed: true });
    // The start was actually invoked (awaited) and its rejection caught locally, not propagated.
    expect(triggerGeneration).toHaveBeenCalledWith('order_1', 'payme_webhook_payment_paid');
  });

  it('returns 200 processed on a successful start (baseline)', async () => {
    triggerGeneration.mockResolvedValueOnce(undefined);
    const { POST } = await import('@/app/api/webhooks/payme/route');

    const res = await POST(webhookRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, processed: true });
    expect(triggerGeneration).toHaveBeenCalledTimes(1);
  });
});
