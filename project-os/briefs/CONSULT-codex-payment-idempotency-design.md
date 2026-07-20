# CODEX CONSULT — payment-attempt idempotency design (bless the primitive BEFORE CC builds)

## 1. ROUTING + TARGET
- **Reviewer:** Codex (design consult, not a commit re-gate). **Mode:** read-only reasoning over `feat/chunked-generation` @ `4edae134` + `lib/payme.ts`; cite `files:lines`.
- **Gate type:** **[CODEX-GATE]** — money + concurrency, core payment path. This consult decides the PRIMITIVE before CC spends an implementation round (we are 0/2 on prior concurrency attempts — do not build blind).

## 2. ORIGIN / CONTEXT
Your 2nd re-gate (`4edae134`) = NO-GO. The TTL lease permits a 2nd valid PayMe sale for one order (P0 #1: CAS admits a stale-lease order without requiring `paymentId:null`, `checkout/route.ts:199,:386` → 2nd `createPaymeCheckout` at `:316`; if both paid, the 2nd webhook skips coupon confirm and just retriggers, `webhooks/payme:159,:178` = uncounted 2nd discounted payment). You also REJECTED both prior judgment calls (order-wide failed-payment release; reuse-path token transfer). PayMe capability (confirmed from code): **no idempotency-key** (`payme.ts:433`), but `queryPaymeSale` exists (`:392`) and `transaction_id = orderId` (`:258`) → a deterministic reference to query by.

## 3. PROPOSED DESIGN (confirm the primitive, or name the hole)
Replace "time is the gate" with **"the persisted PayMe sale is the gate"**:
1. **CAS requires `paymentId: null`.** An order that already has a sale can NEVER be re-claimed for a new sale-creation — closes P0 #1 directly. Time (TTL) may only reclaim an attempt that has NOT yet produced a sale.
2. **Reconcile, never recreate.** `/api/checkout` for an order that already has a `paymentId` returns/reconciles the EXISTING sale (its `sale_url` if unpaid, or the paid status) — it does NOT call `createPaymeCheckout` again.
3. **Crash-window reconcile via query-by-reference.** Because PayMe has no idempotency key and a crash can land between `createPaymeCheckout` (sale exists at PayMe) and persisting `paymentId`, reclaiming a pre-`paymentId` attempt must FIRST `queryPaymeSale(transaction_id = orderId)`: if a sale already exists at PayMe → adopt it (persist its id), never create a second; only a definitive "no sale" permits create.
4. **Failed-payment release bound to the exact persisted payment attempt** (not order-wide, not "current hold") — closes P1 #2.
5. **Coupon-rejection releases the lease before returning** — restores the immediate full-price retry, closes P1 #4.
6. **Reuse-path token transfer only when no external sale exists** (guaranteed by #1/#3) — closes P1 #3.

## 4. OPEN QUESTIONS FOR CODEX (rule on each)
- Is **`paymentId`-as-gate + query-by-reference reconcile** the correct primitive, or is a heavier explicit checkout-attempt **state machine** (unclaimed → creating → sale_created → paid/failed, with no time-based reclaim once `sale_created`) warranted?
- The residual race: two attempts both pass `paymentId:null`, both reach step 3's query, both see "no sale", both create. Does the atomic CAS claim (single owner before create) fully close this, or is a unique DB constraint on the sale-creation record also required?
- **PayMe query semantics** (`queryPaymeSale`): can a query by `transaction_id=orderId` return a definitive exists/not-exists, or can it be ambiguous (not-found while a sale is mid-creation)? If ambiguous, the reconcile in #3 has a hole — how should it fail (closed)?

## 5. MIGRATION / DATA
Likely needs an additive nullable column or a status on the attempt state; no backfill; must be fail-safe for legacy rows (NULL = unclaimed → falls to normal path). Confirm the shape once the primitive is chosen.

## 6. NO-REGRESSION (must remain true)
Pricing ₪59/79/99 `addonsPrice:0`; the shared `couponConfirmFenceReason` in all 3 seams; site-password gate; zero edits to the Stage-1 safety track and visual-contract compiler.

## 7. PROOF BOUNDARY
Real-DB (staging) cases the design must make provable via `/api/checkout` (not copied CAS queries): stale retry AFTER a successful sale; a provider call crossing the TTL; an old failure racing a replacement attempt; couponed `noop` persisting `needs_human_qa`.

## 8. OUTPUT
Bless the primitive (design #1-6) OR name the specific hole + the minimal correct primitive. Rule on the 3 §4 questions and the required migration shape. This becomes the spec CC implements → then a full re-gate.
