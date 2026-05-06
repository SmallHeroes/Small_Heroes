# Fake Payment Mode (Local/Staging Only)

This mode exists only to unblock end-to-end testing when real provider checkout is unavailable.

## Safety Rules

- Never use fake payments in production.
- Fake mode is enabled only when all are true:
  - `PAYMENT_PROVIDER=fake`
  - `ENABLE_FAKE_PAYMENT=true`
  - `NODE_ENV!==production`
- Production startup fails fast if `PAYMENT_PROVIDER=fake`.

## Required Env (Local)

```env
PAYMENT_PROVIDER=fake
ENABLE_FAKE_PAYMENT=true
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

You may keep existing PayMe values in `.env.local`; they are unused while fake mode is active.

## Flow

1. Wizard creates order (`draft`).
2. Checkout (`/api/checkout`) recalculates pricing server-side.
3. In fake mode, order is moved to `pending_payment` with:
   - `paymentProvider=fake`
   - `paymentId=fake_<orderId>_<timestamp>`
4. API returns fake payment URL:
   - `/dev/fake-payment?orderId=<...>&paymentId=<...>`
5. Confirm success:
   - `POST /api/dev/fake-payment/confirm`
   - order marked `paid` idempotently
   - `PaymentRecord` upserted
   - generation triggered via shared `triggerGeneration(...)`
6. Redirect to `/generating?orderId=<...>` then ready/reader.

## Endpoints

- Page: `GET /dev/fake-payment`
- Confirm: `POST /api/dev/fake-payment/confirm`

Both are blocked unless fake mode is enabled and environment is non-production.

## Manual QA Checklist

- `.env.local` has `PAYMENT_PROVIDER=fake`
- `.env.local` has `ENABLE_FAKE_PAYMENT=true`
- restart dev server
- complete wizard
- checkout redirects to `/dev/fake-payment`
- fake page shows `orderId` and `paymentId`
- simulate success
- order becomes `paid`
- generation starts
- generating page progresses
- ready opens
- reader opens
- simulate failed payment
- duplicate success confirm does not double-generate
- set `ENABLE_FAKE_PAYMENT=false` and confirm fake routes blocked
- production mode blocks fake provider entirely

## Important

PayMe integration code remains intact. Fake mode is a local/staging test fallback only.

