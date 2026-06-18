TYPE: BRIEF + RESULT
AUTHOR: Claude Code (Codex-reviewed brief)
DATE: 2026-06-18
RELATED: 0089/0092 (staging env hardening), 0090/0091 (staging Supabase), 0085 (env topology consult)

# 0093 · Fix fake-payment gating: key on VERCEL_ENV (real prod), never NODE_ENV

## The bug
Every fake-payment gate keyed on `NODE_ENV === 'production'`. But Vercel runs `NODE_ENV=production`
on **Preview** deployments too → fake payments were impossible on staging (which is exactly where the
dress rehearsal needs them), while the gate gave a false sense of prod-safety.

## Principle (enforced)
Real prod (`VERCEL_ENV === 'production'`) → fake **NEVER** allowed, even with flags. Preview/dev → fake
allowed **only** if `ALLOW_FAKE_PAYMENTS=true` AND `ENABLE_FAKE_PAYMENT=true` AND `PAYMENT_PROVIDER=fake`.

## Changes (one central helper, 6 sites)
1. **NEW `lib/runtime-env.ts`** (pure, no imports — edge/middleware safe): `isVercelProductionRuntime()`
   = `VERCEL_ENV` (case-insensitive) === 'production'.
2. **`lib/env.ts`**: added single source of truth `canUseFakePayments()` = provider==='fake' && both
   flags && !isVercelProductionRuntime(). `isFakePaymentEnabled()` is now a thin alias → `canUseFakePayments()`
   (one implementation). Validation: fake on real prod is **always** an error (even with flags); fake still
   requires `ENABLE_FAKE_PAYMENT`. (Left the unrelated `PAYME_REDIRECT_TRUST_MODE` NODE_ENV check as-is.)
3. **`app/api/checkout/route.ts`**: deleted `canUseLocalFakeFallback()`; the line-101 fake gate and the
   PayMe-failure fallback both use `canUseFakePayments()` → 503 `Payment provider misconfigured` when not
   permitted. (Inner gate keeps `isFakePaymentEnabled()` = same impl.)
4. **`middleware.ts`**: narrow staging-only exception inside the `NODE_ENV==='production'` block, BEFORE
   the dev 404 — `/dev/fake-payment*` + `/api/dev/fake-payment/confirm` pass ONLY when
   `VERCEL_ENV!=='production'` && provider=fake && both flags. Reads `process.env` directly (no server-only
   import). All other `/dev`, `/api/dev`, `/api/debug` still 404.
5. **`app/dev/fake-payment/page.tsx`**: guard → `if (!canUseFakePayments()) notFound()`.
6. **`app/api/dev/fake-payment/confirm/route.ts`**: guard → `if (!canUseFakePayments()) 404`.

## Tests (`lib/__tests__/fake-payment-gating.spec.ts`, +16)
`isVercelProductionRuntime` (prod/preview/unset/case); `canUseFakePayments` matrix (preview+flags=true;
runtime flip to prod=false; missing ALLOW=false; non-fake provider=false); `validateEnv` (fake on real
prod throws; fake w/o ENABLE throws; preview+flags boots); checkout route (503 on real prod, fake redirect
on preview+flags, 503 when a flag missing); middleware (fake page/confirm pass on preview+flags, 404 on
real prod even with flags, other /dev 404).

## RESULT — DONE
- `npm run check` **green: 579/579** (tsc + vitest; +16 new).
- **SAFETY grep**: remaining `NODE_ENV` references are non-fake gates only — middleware dev-surface 404
  (fake carve-out within uses VERCEL_ENV), `PAYME_REDIRECT_TRUST_MODE` (out of scope), and two log/metadata
  fields in checkout. Every fake gate keys on VERCEL_ENV. **No path lets VERCEL_ENV='production' allow fake.**
- Commits (explicit pathspecs, no `git add -A`): code+tests + this roundtable file. NOT merged to main.
- Push to QA preview: see session note (push requires GitHub write auth via Git Credential Manager).
