# Phase: PayMe Real API Integration

## Context

We're switching from Stripe to PayMe as the payment provider (Stripe doesn't support Israeli merchants).
The PayMe integration skeleton already exists but uses a **speculative API format** that doesn't match the real PayMe API.
This brief rewrites the API calls to match the actual PayMe `generate-sale` endpoint documented at https://docs.payme.io.

## What Already Works (DO NOT CHANGE structure)

- `app/api/checkout/route.ts` — calls `createPaymeCheckout()`, validates order, returns URL. **Keep as-is.**
- `app/api/payme/return/route.ts` — handles redirect back from PayMe. **Keep as-is.**
- `app/api/webhooks/payme/route.ts` — handles webhooks, deduplicates, triggers generation. **Keep structure, fix body parsing.**
- `lib/env.ts` — validates PayMe env vars. **Keep as-is** (PAYME_API_KEY will hold the seller_payme_id).
- DB schema — `paymeTransactionId`, `paymeMetadata`, `paymeWebhookEvent` all exist. **Keep as-is.**

## Changes Required

### 1. `lib/payme.ts` → `createPaymeCheckout()` (lines 190-251)

**Current (WRONG):**
```typescript
const body = {
  amount: Number((request.amountAgorot / 100).toFixed(2)),
  amountAgorot: request.amountAgorot,
  currency: request.currency,
  description: request.description,
  orderId: request.orderId,
  metadata: request.metadata || {},
  customer: { email, name },
  returnUrl: request.successUrl,
  successUrl: request.successUrl,
  cancelUrl: request.cancelUrl,
};
// Header: 'PayMe-Merchant-Key': cfg.apiKey
```

**Replace with (CORRECT — real PayMe generate-sale API):**
```typescript
const body = {
  seller_payme_id: cfg.apiKey, // This IS the seller_payme_id (MPL...)
  sale_price: request.amountAgorot, // Already in agorot, PayMe expects agorot
  currency: request.currency, // "ILS"
  product_name: request.description.slice(0, 500),
  transaction_id: request.orderId.slice(0, 50), // max 50 chars
  installments: "1",
  sale_callback_url: request.callbackUrl, // NEW field — see below
  sale_return_url: request.successUrl,
  sale_type: "sale",
  sale_payment_method: "credit-card",
  language: "he",
  // Optional buyer info:
  ...(request.customerEmail ? { buyer_email: request.customerEmail, sale_email: request.customerEmail } : {}),
  ...(request.customerName ? { buyer_name: request.customerName, sale_name: request.customerName } : {}),
};
```

**Request format:**
```typescript
const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // NO PayMe-Merchant-Key header. Auth is via seller_payme_id in body.
  body: JSON.stringify(body),
});
```

**Response parsing — replace the `pickFirstString(root.checkoutUrl, ...)` block:**
```typescript
// PayMe response: { status_code: 0, sale_url: "https://...", payme_sale_id: "...", ... }
if (root.status_code !== 0) {
  throw new Error(`PayMe generate-sale failed: status_code=${root.status_code} ${JSON.stringify(raw)}`);
}
const rawCheckoutUrl = pickString(root.sale_url);
// ... rest of absolutize logic stays the same
const checkoutId = pickString(root.payme_sale_id);
```

**Endpoint:** Hardcode path to `/generate-sale` instead of using `PAYME_CHECKOUT_PATH`:
```typescript
const endpoint = `${cfg.apiBaseUrl}/generate-sale`;
```

### 2. `PaymeCheckoutRequest` type — add `callbackUrl`

```typescript
export type PaymeCheckoutRequest = {
  orderId: string;
  amountAgorot: number;
  currency: string;
  description: string;
  customerEmail?: string | null;
  customerName?: string | null;
  successUrl: string;
  callbackUrl: string; // NEW — webhook URL for PayMe to POST to
  cancelUrl: string;
  metadata?: Record<string, string>;
};
```

### 3. `app/api/checkout/route.ts` — pass callbackUrl

In the `createPaymeCheckout()` call (~line 187), add the `callbackUrl`:

```typescript
paymeCheckout = await createPaymeCheckout({
  orderId: order.id,
  amountAgorot: totalPriceAgorot,
  currency: 'ILS',
  description: descriptionParts.join(' | '),
  customerEmail: order.customerEmail,
  customerName: order.customerName,
  successUrl: `${appUrl}/api/payme/return?orderId=${encodeURIComponent(order.id)}`,
  callbackUrl: `${appUrl}/api/webhooks/payme`, // NEW
  cancelUrl: `${appUrl}${ROUTES.wizard}`,
  metadata: { ... },
});
```

### 4. `app/api/webhooks/payme/route.ts` — parse x-www-form-urlencoded

PayMe sends callbacks as `application/x-www-form-urlencoded`, NOT JSON.

**Replace lines 33-40** (the JSON parsing block):

```typescript
// PayMe sends x-www-form-urlencoded, but may also send JSON.
// Handle both gracefully.
let parsedBody: Record<string, unknown>;
const contentType = req.headers.get('content-type') || '';

if (contentType.includes('application/x-www-form-urlencoded')) {
  const params = new URLSearchParams(rawBody);
  parsedBody = Object.fromEntries(params.entries());
} else {
  // Fallback: try JSON
  try {
    parsedBody = JSON.parse(rawBody || '{}');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn('[PayMeWebhook] Invalid body', { reason, contentType });
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
```

### 5. `lib/payme.ts` → `parsePaymeWebhookPayload()` — handle PayMe field names

PayMe callback fields use snake_case. Add these as primary lookup paths (BEFORE the existing fallback logic):

```typescript
// PayMe native callback fields (x-www-form-urlencoded):
const paymeNativeOrderId = pickString(root.transaction_id); // We sent orderId as transaction_id
const paymeNativeTransactionId = pickString(root.payme_sale_id) ?? pickString(root.sale_payme_id);
const paymeNativeStatus = pickString(root.sale_status);

// Use PayMe-native fields first, then fall back to existing canonical/compatibility fields
const orderId = paymeNativeOrderId ?? canonicalOrderId ?? pickFirstString(root.orderId, payment.orderId, transaction.orderId);
const transactionId = paymeNativeTransactionId ?? canonicalTransactionId
  ?? pickFirstString(root.paymentId, payment.id, payment.transactionId, transaction.id);
const paymentStatus = (paymeNativeStatus ?? canonicalStatus ?? pickFirstString(root.paymentStatus, payment.status, transaction.status))
  ?.toLowerCase() || null;
```

Also update `isPaymeStatusPaid()` to include PayMe's native status value:
```typescript
export function isPaymeStatusPaid(status: string | null): boolean {
  if (!status) return false;
  return ['paid', 'success', 'succeeded', 'completed', 'approved'].includes(status.toLowerCase());
  // PayMe uses "approved" for successful payments
}
```

### 6. `lib/payme.ts` → `verifyPaymePayment()` — update to use PayMe get-sales API

PayMe has a `get-sales` endpoint for verification. Update:

```typescript
export async function verifyPaymePayment(params: { ... }): Promise<...> {
  const cfg = resolvePaymeConfig();
  if (!cfg.apiBaseUrl || !cfg.apiKey) {
    return { verified: false, status: 'unknown', raw: null };
  }

  const identifier = params.transactionId || params.paymentId;
  if (!identifier) {
    return { verified: false, status: 'unknown', raw: null };
  }

  // PayMe get-sales endpoint
  const endpoint = `${cfg.apiBaseUrl}/get-sales`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      seller_payme_id: cfg.apiKey,
      payme_sale_id: identifier,
    }),
  });
  // ... rest of verification logic
}
```

**NOTE:** If get-sales doesn't work or isn't available in sandbox, the verify function should gracefully return `{ verified: false, status: 'unknown', raw: null }`. The webhook + return handler combo is the primary payment confirmation path.

### 7. `resolvePaymeConfig()` — simplify

Remove `checkoutPath` (now hardcoded). Keep the rest. The `apiKey` field holds the `seller_payme_id` (MPL... string).

```typescript
export function resolvePaymeConfig() {
  return {
    apiBaseUrl: (process.env.PAYME_API_BASE_URL || '').trim().replace(/\/$/, ''),
    checkoutPageOrigin: (process.env.PAYME_CHECKOUT_PAGE_ORIGIN || '').trim().replace(/\/$/, ''),
    // checkoutPath removed — hardcoded to /generate-sale
    apiKey: (process.env.PAYME_API_KEY || '').trim(), // This is seller_payme_id
    webhookSecret: (process.env.PAYME_WEBHOOK_SECRET || '').trim(),
    allowedWebhookIps: (process.env.PAYME_WEBHOOK_ALLOWED_IPS || '')
      .split(',').map(p => p.trim()).filter(Boolean),
  };
}
```

## ENV Variables

Set in `.env.local` (and later in Vercel):

```env
PAYMENT_PROVIDER=payme
PAYME_API_BASE_URL=https://sandbox.payme.io/api
PAYME_API_KEY=<seller_payme_id from PayMe dashboard — starts with MPL>
PAYME_WEBHOOK_SECRET=<optional, from PayMe settings>
PAYME_WEBHOOK_ALLOWED_IPS=<optional, PayMe's server IPs>
```

Production values:
```env
PAYME_API_BASE_URL=https://live.payme.io/api
```

## PayMe API Reference Summary

### Generate Sale
- **POST** `{base}/generate-sale`
- **Body (JSON):** `seller_payme_id`, `sale_price` (agorot), `currency`, `product_name`, `transaction_id`, `installments`, `sale_callback_url`, `sale_return_url`, `sale_type`, `sale_payment_method`, `language`
- **Response:** `{ status_code: 0, sale_url, payme_sale_id, payme_sale_code, price, transaction_id, currency }`

### Callback (webhook)
- **POST** to `sale_callback_url` with `Content-Type: application/x-www-form-urlencoded`
- **Fields:** `sale_status` ("approved"/"declined"), `transaction_id` (our orderId), `payme_sale_id`, `sale_payme_id`, `sale_price`, `currency`, etc.

### Return URL
- Buyer is redirected to `sale_return_url` after payment
- Our return handler at `/api/payme/return` already handles this

## Testing

1. Use sandbox credentials: `PAYME_API_BASE_URL=https://sandbox.payme.io/api`
2. PayMe sandbox test card: `4580-0000-0000-0000`, any future expiry, any CVV
3. Create an order through wizard, click pay, verify redirect to PayMe page
4. Complete payment, verify redirect back to generating page
5. Check webhook received and order marked as paid

## Files to Change

| File | Change |
|------|--------|
| `lib/payme.ts` | Rewrite `createPaymeCheckout()` body + response parsing, update `parsePaymeWebhookPayload()` for PayMe fields, update `verifyPaymePayment()`, simplify `resolvePaymeConfig()` |
| `app/api/checkout/route.ts` | Add `callbackUrl` to `createPaymeCheckout()` call |
| `app/api/webhooks/payme/route.ts` | Parse `x-www-form-urlencoded` body (not just JSON) |
| `.env.local` | Set `PAYMENT_PROVIDER=payme`, `PAYME_API_BASE_URL`, `PAYME_API_KEY` |

## DO NOT CHANGE

- `app/api/payme/return/route.ts` — already correct
- `app/api/checkout/route.ts` overall structure — just add callbackUrl
- DB schema — all PayMe columns already exist
- `lib/env.ts` — validation is already correct
- `app/api/webhooks/stripe/route.ts` — keep for legacy/fallback, guarded by PAYMENT_PROVIDER check
