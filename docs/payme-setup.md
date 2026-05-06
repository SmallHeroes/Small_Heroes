# PayMe Setup Guide

This guide covers the current payment plumbing for Small Heroes without UI changes.

## Required Environment Variables

Use these values in `.env.local` / staging env:

```env
PAYMENT_PROVIDER=payme
PAYME_API_BASE_URL=https://sandbox.payme.io/api/
PAYME_API_KEY=<your-payme-merchant-key>
PAYME_CHECKOUT_PATH=/checkout
PAYME_VERIFY_PATH=
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Notes:

- `PAYME_API_KEY` is sent as `PayMe-Merchant-Key`.
- `APP_URL` is accepted as runtime alias; `NEXT_PUBLIC_APP_URL` remains primary.
- `PAYME_VERIFY_PATH` can stay empty. In that case redirect flow never marks paid and waits for webhook.

## Sandbox / Production Base URLs

- Sandbox example: `https://sandbox.payme.io/api/`
- Production base URL: use the PayMe production URL from your merchant account documentation.

## Checkout Endpoint Configuration

`PAYME_CHECKOUT_PATH` is configurable.

- Current default in code: `/checkout`
- This default is **not guaranteed** for every merchant setup.
- If PayMe responds with `404/405` or non-JSON body, set:

```env
PAYME_CHECKOUT_PATH=/actual/path/from-payme
```

## Verify Endpoint Configuration (Optional)

`PAYME_VERIFY_PATH` controls server-to-server payment verification on redirect route.

- Empty (default): verification unavailable -> redirect remains `payment=checking` until webhook.
- Configured: redirect route may verify status with PayMe API before marking paid.

## Webhook URL

Configure PayMe webhook callback URL:

```txt
https://<public-host>/api/webhooks/payme
```

For local tests use a tunnel/staging host, e.g.:

```txt
https://<public-url>/api/webhooks/payme
```

## Redirect Trust Mode (Dev-Only)

Optional local testing mode:

```env
PAYME_REDIRECT_TRUST_MODE=true
```

Rules:

- Allowed only in non-production.
- If enabled in production, env validation fails fast.
- Logs explicit unsafe warning when used.
- Default must remain `false`.

## Manual QA Checklist

1. Complete wizard and create order.
2. Call `/api/checkout` through normal flow.
3. Verify response returns absolute PayMe checkout URL.
4. Complete payment on PayMe.
5. Redirect lands on `/api/payme/return?...` then `/generating?...`.
6. Webhook marks order `paid` and generation starts.
7. Book reaches `ready`, then reader opens.
8. Test redirect before webhook -> remains `/generating?...&payment=checking`.
9. Test forged redirect URL -> no paid marking, no generation trigger.
10. Replay duplicate webhook -> no double-generation side effects.
11. Simulate PayMe API failure -> frontend gets safe error, server logs detail.
12. Confirm production rejects unsafe redirect trust mode.

## Common Errors

- **Missing merchant key**
  - Symptom: checkout returns `503` / provider misconfiguration.
  - Fix: set `PAYME_API_KEY`.

- **Wrong checkout path**
  - Symptom: checkout returns `500`; logs show PayMe non-JSON/404/405 response.
  - Fix: set correct `PAYME_CHECKOUT_PATH` from PayMe docs/account.

- **Webhook not received**
  - Symptom: redirect reaches generating with `payment=checking` and order stays pending.
  - Fix: expose public webhook URL and verify signature/IP policy.

- **Redirect stuck on checking**
  - Symptom: no paid transition from redirect.
  - Expected when webhook pending and `PAYME_VERIFY_PATH` is empty/unavailable.

- **Relative checkout URL**
  - Symptom: provider returns path-only URL.
  - Handling: system absolutizes URL using `PAYME_CHECKOUT_PAGE_ORIGIN` or API base URL.

