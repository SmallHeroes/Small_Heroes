import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Canonical PayMe webhook payload contract used by this integration.
 *
 * Preferred fields (integration contract):
 * {
 *   "eventType": "payment.updated",        // optional, defaults to "payment"
 *   "status": "paid",                      // required
 *   "transactionId": "txn_...",            // required
 *   "metadata": {
 *     "orderId": "ord_..."                 // required
 *   }
 * }
 *
 * Compatibility fallback fields are still supported by parsePaymeWebhookPayload(),
 * but are considered legacy/interoperability paths only.
 */
export type CanonicalPaymeWebhookPayload = {
  eventType?: string;
  status: string;
  transactionId: string;
  metadata: {
    orderId: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type PaymeCheckoutRequest = {
  orderId: string;
  amountAgorot: number;
  currency: string;
  description: string;
  customerEmail?: string | null;
  customerName?: string | null;
  successUrl: string;
  /** Webhook URL PayMe POSTs to (sale_callback_url). */
  callbackUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
};

export type PaymeCheckoutResponse = {
  checkoutUrl: string;
  checkoutId: string | null;
  raw: unknown;
};

export type ParsedPaymeWebhook = {
  paymentStatus: string | null;
  orderId: string | null;
  transactionId: string | null;
  eventType: string;
  usedFallbackFields: boolean;
  raw: unknown;
};

export function resolvePaymeConfig() {
  return {
    apiBaseUrl: (process.env.PAYME_API_BASE_URL || '').trim().replace(/\/$/, ''),
    /** Optional: host used to turn path-only checkout URLs into absolute PayMe links (when API returns `/pay/...`). */
    checkoutPageOrigin: (process.env.PAYME_CHECKOUT_PAGE_ORIGIN || '').trim().replace(/\/$/, ''),
    /** Stored in PAYME_API_KEY — PayMe seller_payme_id (e.g. MPL…). */
    apiKey: (process.env.PAYME_API_KEY || '').trim(),
    webhookSecret: (process.env.PAYME_WEBHOOK_SECRET || '').trim(),
    allowedWebhookIps: (process.env.PAYME_WEBHOOK_ALLOWED_IPS || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  };
}

/**
 * PayMe sometimes returns a path-only URL. The browser would otherwise resolve it against the app
 * origin (e.g. /checkout/xyz → same-site 404). Always return an absolute https URL for redirect.
 */
export function absolutizePaymeCheckoutUrl(
  raw: string,
  apiBaseUrl: string,
  checkoutPageOrigin?: string | null
): string {
  const t = raw.trim();
  if (!t) throw new Error('PayMe checkout response missing checkout URL');
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith('//')) return `https:${t}`;
  const baseRaw = (checkoutPageOrigin || apiBaseUrl).trim();
  if (!baseRaw) throw new Error('PayMe checkout URL is relative but no base URL is configured');
  const base = baseRaw.replace(/\/$/, '');
  const path = t.startsWith('/') ? t : `/${t}`;
  let resolved: URL;
  try {
    resolved = new URL(path, `${base}/`);
  } catch {
    throw new Error('PayMe checkout URL could not be resolved to an absolute URL');
  }
  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    throw new Error('PayMe checkout URL must use http(s)');
  }
  return resolved.href;
}

export function extractWebhookClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get('x-real-ip');
  return realIp?.trim() || null;
}

export function verifyPaymeSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string
): boolean {
  if (!webhookSecret || !signatureHeader) return false;
  const expectedHex = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const normalizedProvided = signatureHeader.replace(/^sha256=/i, '').trim();
  if (!normalizedProvided) return false;
  const expected = Buffer.from(expectedHex, 'utf8');
  const provided = Buffer.from(normalizedProvided, 'utf8');
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

function pickString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    const resolved = pickString(value);
    if (resolved) return resolved;
  }
  return null;
}

export function parsePaymeWebhookPayload(payload: unknown): ParsedPaymeWebhook {
  const root = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
  const payment = (root.payment && typeof root.payment === 'object')
    ? (root.payment as Record<string, unknown>)
    : {};
  const transaction = (root.transaction && typeof root.transaction === 'object')
    ? (root.transaction as Record<string, unknown>)
    : {};
  const metadata = (root.metadata && typeof root.metadata === 'object')
    ? (root.metadata as Record<string, unknown>)
    : {};

  // PayMe native callback fields (x-www-form-urlencoded): prioritize these.
  const paymeNativeOrderId = pickString(root.transaction_id);
  const paymeNativeTransactionId = pickString(root.payme_sale_id) ?? pickString(root.sale_payme_id);
  const paymeNativeStatus = pickString(root.sale_status);

  // Canonical (integration contract) fields.
  const canonicalOrderId = pickString(metadata.orderId);
  const canonicalTransactionId = pickString(root.transactionId);
  const canonicalStatus = pickString(root.status);
  const canonicalEventType = pickString(root.eventType);

  const orderId =
    paymeNativeOrderId
    ?? canonicalOrderId
    ?? pickFirstString(root.orderId, payment.orderId, transaction.orderId);
  const transactionId =
    paymeNativeTransactionId
    ?? canonicalTransactionId
    ?? pickFirstString(root.paymentId, payment.id, payment.transactionId, transaction.id);
  const paymentStatus = (
    paymeNativeStatus
    ?? canonicalStatus
    ?? pickFirstString(root.paymentStatus, payment.status, transaction.status)
  )
    ?.toLowerCase() || null;

  const eventType =
    (canonicalEventType
      ?? pickString(root.event_type)
      ?? pickFirstString(root.type, root.event, 'payme_sale')) || 'payme_sale';

  const gotOrderFromPreferred = Boolean(paymeNativeOrderId || canonicalOrderId);
  const gotTxnFromPreferred = Boolean(paymeNativeTransactionId || canonicalTransactionId);
  const gotStatusFromPreferred = Boolean(paymeNativeStatus || canonicalStatus);
  const usedFallbackFields = Boolean(
    (!gotOrderFromPreferred && Boolean(orderId))
    || (!gotTxnFromPreferred && Boolean(transactionId))
    || (!gotStatusFromPreferred && Boolean(paymentStatus))
    || (!canonicalEventType && Boolean(pickFirstString(root.type, root.event)))
  );

  return {
    paymentStatus,
    orderId,
    transactionId,
    eventType,
    usedFallbackFields,
    raw: payload,
  };
}

export function isPaymeStatusPaid(status: string | null): boolean {
  if (!status) return false;
  // PayMe sale_status uses "approved" for successful card payments.
  return ['paid', 'success', 'succeeded', 'completed', 'approved'].includes(status.toLowerCase());
}

export async function createPaymeCheckout(request: PaymeCheckoutRequest): Promise<PaymeCheckoutResponse> {
  const cfg = resolvePaymeConfig();
  if (!cfg.apiBaseUrl || !cfg.apiKey) {
    throw new Error('PayMe checkout configuration is missing');
  }
  const endpoint = `${cfg.apiBaseUrl}/generate-sale`;
  const body: Record<string, unknown> = {
    seller_payme_id: cfg.apiKey,
    sale_price: request.amountAgorot,
    currency: request.currency,
    product_name: request.description.slice(0, 500),
    transaction_id: request.orderId.slice(0, 50),
    installments: '1',
    sale_callback_url: request.callbackUrl,
    sale_return_url: request.successUrl,
    sale_type: 'sale',
    sale_payment_method: 'credit-card',
    language: 'he',
  };
  if (request.customerEmail) {
    body.buyer_email = request.customerEmail;
    body.sale_email = request.customerEmail;
  }
  if (request.customerName) {
    body.buyer_name = request.customerName;
    body.sale_name = request.customerName;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const responseText = await res.text();
  let raw: unknown = null;
  if (responseText) {
    try {
      raw = JSON.parse(responseText);
    } catch {
      raw = { nonJsonBody: responseText.slice(0, 1500) };
    }
  }
  if (!res.ok) {
    const contentType = res.headers.get('content-type') || 'unknown';
    const excerpt =
      typeof raw === 'object' && raw && 'nonJsonBody' in (raw as Record<string, unknown>)
        ? String((raw as Record<string, unknown>).nonJsonBody || '')
        : JSON.stringify(raw);
    throw new Error(
      `PayMe checkout request failed (${res.status}) [content-type=${contentType}] body_excerpt=${(excerpt || '').slice(0, 240)}`
    );
  }
  const root = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const statusCode = root.status_code;
  if (statusCode !== undefined && statusCode !== null && Number(statusCode) !== 0) {
    throw new Error(`PayMe generate-sale failed: status_code=${statusCode} ${JSON.stringify(raw)}`);
  }
  const rawCheckoutUrl = pickString(root.sale_url);
  if (!rawCheckoutUrl) {
    throw new Error(`PayMe generate-sale failed: no sale_url in response ${JSON.stringify(raw)}`);
  }
  const checkoutUrl = absolutizePaymeCheckoutUrl(
    rawCheckoutUrl,
    cfg.apiBaseUrl,
    cfg.checkoutPageOrigin || null
  );
  const checkoutId = pickString(root.payme_sale_id);
  return { checkoutUrl, checkoutId, raw };
}

export async function verifyPaymePayment(params: {
  paymentId?: string;
  transactionId?: string;
  orderId: string;
}): Promise<{
  verified: boolean;
  status: 'paid' | 'failed' | 'pending' | 'unknown';
  raw: unknown;
}> {
  const cfg = resolvePaymeConfig();
  if (!cfg.apiBaseUrl || !cfg.apiKey) {
    return { verified: false, status: 'unknown', raw: null };
  }
  const identifier = params.transactionId || params.paymentId;
  if (!identifier) {
    return { verified: false, status: 'unknown', raw: null };
  }

  try {
    const endpoint = `${cfg.apiBaseUrl}/get-sales`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        seller_payme_id: cfg.apiKey,
        payme_sale_id: identifier,
      }),
    });

    const raw = await res.json().catch(() => null);
    if (!res.ok || raw === null || typeof raw !== 'object') {
      return { verified: false, status: 'unknown', raw: null };
    }

    const root = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
    const items = Array.isArray(root.items) ? root.items : [];
    const sale = (items.length > 0 && typeof items[0] === 'object') ? (items[0] as Record<string, unknown>) : root;
    const rawStatus = (
      typeof sale.sale_status === 'string' ? sale.sale_status :
      typeof sale.status === 'string' ? sale.status : ''
    ).toLowerCase();

    if (['completed', 'approved', 'success', 'paid'].includes(rawStatus)) {
      return { verified: true, status: 'paid', raw };
    }
    if (['failed', 'declined', 'canceled', 'cancelled', 'error', 'rejected'].includes(rawStatus)) {
      return { verified: true, status: 'failed', raw };
    }
    if (['pending', 'processing', 'in_progress', 'created', 'authorized'].includes(rawStatus)) {
      return { verified: true, status: 'pending', raw };
    }
    return { verified: false, status: 'unknown', raw };
  } catch (err) {
    console.error('[PayMe] verifyPaymePayment error:', err);
    return { verified: false, status: 'unknown', raw: null };
  }
}
