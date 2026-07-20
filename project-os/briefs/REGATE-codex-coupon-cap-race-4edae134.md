# CODEX RE-GATE — coupon same-order checkout race fix (`4edae134`)

## 1. ROUTING + TARGET
- **Reviewer:** Codex (forensic gate). **Mode:** read-only static audit + concurrency reasoning; cite `files:lines`.
- **Commit:** `4edae134` on `feat/chunked-generation`. **Diff range:** `02074a23..4edae134`.
- **Gate type:** **[CODEX-GATE]** — money + concurrency. Cowork does NOT self-certify; this verdict decides whether `FIRST100` may be activated.

## 2. ORIGIN / CONTEXT
Your re-gate of `02074a23` = **NO-GO to activate FIRST100** (port/pricing/refund-amount PASS, but a P0 same-order checkout race). This commit implements your five required-before-launch items. Root cause you found (verified): two concurrent `/api/checkout` on one order both read `draft`/`pending_payment` before either claims it (`checkout/route.ts:164,:276`); the 2nd reuses the 1st's order-level reservation (`coupon-service.ts:100`); a failed attempt releases the shared hold by `orderId` (`:310,:374`); the other's confirm then sees `released` → `noop` (`coupon-service:193`) → a paid discounted order never increments `confirmedCount`. Cowork pre-verified: scope touches ONLY the coupon/payment path + tests + migration; schema additive (3 nullable cols); zero edits to safety/compiler/pricing.

## 3. VERIFY (prove each; cite files:lines)
1. **CAS serializes.** `prisma.order.updateMany` (`checkout/route.ts`) re-checks status AND claims the order (`checkoutAttemptToken` + TTL) in ONE atomic statement, BEFORE the coupon reservation and BEFORE the PayMe sale. Two concurrent checkouts on one order → exactly one wins; the loser blocks under Postgres row-lock / READ COMMITTED, re-evaluates the winner's committed row, matches 0 → `409 checkout_in_progress`, having reserved nothing and charged nothing. Confirm NO window between the CAS claim and sale creation where a 2nd attempt slips in; confirm the 2-min TTL lease neither wedges a crashed order nor opens a claim window while the winner is mid-sale.
2. **Token-bound release closes the shared-release hole.** `releaseCouponForOrder` now REQUIRES `attemptToken` and matches on it; `if(!attemptToken) return` — no orderId-wide fallback. A non-owning token releases nothing (safe direction). Confirm a failed sibling can no longer free a live hold.
3. **Fail-closed noop fence in ALL payment-success seams.** `couponConfirmFenceReason` → `needs_human_qa` + `coupon_confirm_noop_uncounted` when a couponed order's confirm counted nothing — wired IDENTICALLY (shared helper) in `payme/return`, `webhooks/payme` (the prod async seam), AND `fake-payment/confirm`. Confirm no seam missed and that `needs_human_qa` is terminal (stops generation/ready/outbox/email per `start.ts`).
4. **Global invariant.** Confirm the combination (CAS + token-release + noop-fence) now guarantees BOTH "at most 100 discounted PAID sales" (not merely `confirmedCount ≤ 100`) AND "at most one PayMe sale per order" — no residual path where a paid discounted order slips the counter or double-sells.

## 4. JUDGMENT CALLS (accept / reject)
- **`releaseCouponForFailedPayment` is order-wide, NOT token-bound** (`confirm/route.ts:71`). CC's claim: a payment outcome belongs to the ORDER, and that sale has failed, so no sibling's live hold can be stolen. Rule on it.
- **Reuse-path token transfer** (CC's subtle call): on the reuse path the token transfers to the current attempt — sound only because the CAS guarantees single ownership. Confirm it cannot let a sibling steal/free a live hold.

## 5. MIGRATION / DATA
- `20260715_coupon_checkout_attempt_lease` = 3 additive nullable columns, no backfill; a NULL `attemptToken` on a pre-existing hold cannot be token-released early → falls back to TTL (fail-safe, never fail-open). Confirm safe to apply.
- Still open: `20260707_add_coupon_code` is back-dated before the applied `20260715_safety_hold_signal` → require `prisma migrate status` on staging before deploy.

## 6. NO-REGRESSION (must still hold)
- Pricing: `addonsPrice:0`; all 3 directions still ₪59/79/99 (charged==displayed) — the `02074a23` correction intact.
- The site-password payment gate still authoritative.
- Zero edits to the Stage-1 safety track and the visual-contract compiler (Cowork verified; confirm).

## 7. PROOF BOUNDARY (what CI cannot prove)
Tests **I** (two concurrent claims → one wins; loser's release doesn't free the winner; winner confirms not-noop; counter asserted vs reality) and **J** (couponed noop → fenced) + the 8 existing cap tests are staging-gated (`RUN_COUPON_CAP_PROOF=true`) and SKIPPED in CI. `npm run check` green (1702) does NOT prove the cap under race. Confirm the CAS's correctness rests on a real-DB serialization semantic that ONLY the staging run proves, and REQUIRE that run before `FIRST100` activation.

## 8. OUTPUT
Verdict **GO / NO-GO to activate FIRST100**, with any P0/P1/P2 findings as `files:lines`, and explicit rulings on the two §4 judgment calls.
