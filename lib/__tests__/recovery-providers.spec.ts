import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getBookReadyEmailDeliveryState,
  sendRefundNoticeEmail,
} from '@/backend/lib/email';
import { queryPaymeSale, refundPaymeSale } from '@/lib/payme';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('recovery provider contracts', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['delivered', 'delivered'],
    ['opened', 'delivered'],
    ['sent', 'pending'],
    ['delivery_delayed', 'pending'],
    ['bounced', 'failed'],
  ] as const)('maps Resend %s to %s', async (lastEvent, expected) => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', 're_test');
    const fetchImpl = vi.fn(async () => response({ last_event: lastEvent }));

    await expect(getBookReadyEmailDeliveryState('email_1', fetchImpl))
      .resolves.toEqual({ state: expected, event: lastEvent });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.resend.com/emails/email_1',
      { headers: { Authorization: 'Bearer re_test' } },
    );
  });

  it('sends a refund notice with the stable recovery idempotency key', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', 're_test');
    const fetchImpl = vi.fn(async () => response({ id: 'email_refund_1' }));

    await expect(sendRefundNoticeEmail({
      to: 'parent@example.com',
      customerName: 'הורה',
      childName: 'ילד',
      idempotencyKey: 'refund-notice/case_1',
    }, fetchImpl)).resolves.toEqual({ providerMessageId: 'email_refund_1' });

    const calls = fetchImpl.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const init = calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('refund-notice/case_1');
  });

  it('queries PayMe by sale_payme_id and recognizes a completed refund', async () => {
    vi.stubEnv('PAYME_API_BASE_URL', 'https://sandbox.payme.test');
    vi.stubEnv('PAYME_API_KEY', 'seller_1');
    const fetchImpl = vi.fn(async () => response({
      status_code: 0,
      items: [{ sale_status: 'refunded' }],
    }));

    await expect(queryPaymeSale('sale_1', fetchImpl))
      .resolves.toEqual({ state: 'refunded', rawStatus: 'refunded' });
    const calls = fetchImpl.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const body = JSON.parse(String(calls[0]?.[1]?.body));
    expect(body).toEqual({
      seller_payme_id: 'seller_1',
      sale_payme_id: 'sale_1',
    });
  });

  it('requests a PayMe full refund without sale_refund_amount', async () => {
    vi.stubEnv('PAYME_API_BASE_URL', 'https://sandbox.payme.test');
    vi.stubEnv('PAYME_API_KEY', 'seller_1');
    const fetchImpl = vi.fn(async () => response({
      status_code: 0,
      sale_status: 'refunded',
      payme_transaction_id: 'refund_tx_1',
    }));

    await expect(refundPaymeSale('sale_1', fetchImpl)).resolves.toEqual({
      state: 'refunded',
      providerActionId: 'refund_tx_1',
    });
    const calls = fetchImpl.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const body = JSON.parse(String(calls[0]?.[1]?.body));
    expect(body.payme_sale_id).toBe('sale_1');
    expect(body).not.toHaveProperty('sale_refund_amount');
  });
});
