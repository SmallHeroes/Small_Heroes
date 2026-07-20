# CODEX RE-GATE — quarantine hardening (closes the NO-GO on `fcb33412`)

## 1. ROUTING + TARGET
- **Reviewer:** Codex. **Mode:** read-only; cite `files:lines`.
- **Branch:** `feat/chunked-generation`. Commits **`ce0da06e`** (terminal marker, production paths) + **`73933846`** (script hardening). Local; not pushed.
- **Gate: [CODEX-GATE].** Touches the production ship CAS and resume paths, plus a script that writes production data. This is cutover Track 1.3. **Nothing has been executed against production.**

## 2. ORIGIN / CONTEXT
Your NO-GO listed 4 P0 + 2 P1 + 2. All are addressed. **Your factual correction is confirmed independently by Cowork against the live database:** the quarantine set contains **no externally-paid order** — the `paid`-status order has neither `paymentId` nor a `PaymentRecord` row, and the only `PaymentRecord.paid = true` is provider `fake`. So there is no customer-remediation path; detection must still be correct, and now reads `PaymentRecord`/`paymentId`, never `Order.status`. CC's `Order.status='failed'` → auto-refund finding is preserved untouched.

**Cowork verified independently:** `markerRank` and `CURRENT_RANK_SQL` are **untouched** (§6 compliance — the only diff hits are explanatory comments); the ship CAS carries the new fragment at `order-authority.ts:128`; `package-delivery.ts` (frozen legacy) is **byte-unchanged**.

**What changed:**
- **P0-3 terminal marker** — a shared TS predicate `isDeliveryTerminalHold()` plus a SQL twin `TERMINAL_HOLD_NOT_LIKE_SQL` (`order-authority.ts:35`, `:40`), enforced at three points: `start.ts` recovery refusal, the ship CAS, and single-page regen (which also covers `/api/debug/regen-page`, P1-5a). `markerRank` deliberately unchanged so a real `safety_hold:` still escalates over a quarantine park.
- **P0-1 atomicity** — `parkOneOrderAtomic` runs job-park → case-neutralisation → order-hold in one `prisma.$transaction`; a resolver `false` or a hold write ≠ `'applied'` throws → rollback → the order is left untouched.
- **P0-2/7** — hard-stops with non-zero exit on: schema preflight, `PAYMENT_PROVIDER ≠ payme`, count mismatch, **any** active `refund_pending`/`customer_action` case in **any** scope, a per-order abort, or a post-verify mismatch.
- **P0-4 sequencing** — `assertSchemaPreflight` verifies the bridge schema, so quarantine can only run after the Track-2 bridge.
- **P1-5b Stripe** — rather than status-gating the webhook, preflight **asserts `PAYMENT_PROVIDER=payme`**; the Stripe handler already early-returns for a non-Stripe provider, so its three status writes are inert with zero payment-path code change.
- **P1-6 / P0-8** — `classifyPayment` from `PaymentRecord`/real ids; the register carries identifiers only, **no emails or payment ids**.
Refactored into `lib/cutover/quarantine-park.ts` with 12 unit tests. Suite: 2088 passed / 46 skipped / 0 failed; tsc clean.

## 3. ✅ THE SHIP-CAS CHANGE IS NOW PROVEN AT A REAL DATABASE
`ce0da06e` adds a `NOT LIKE 'quarantine_cutover:%'` conjunct to the production delivery CAS (`order-authority.ts:128`). CC could not execute the real-PG test in its session (Docker was down; the harness is `describe.skipIf`, so it silently skipped). **Cowork required the run before this re-gate, and it has now been executed: 21/21 passed** against a throwaway `postgres:16`, up from 20 — the new case is `(cutover 1.3) a quarantine_cutover marker present → 0 rows, NOT shipped`.

Crucially the **positive controls still pass**, so the new conjunct discriminates rather than blanket-blocking: `a clean order → SHIPS (1 row, status→ready)`, `an active ANCHOR case does NOT block → SHIPS`, and `executeAnchorReleaseCas: releases a still-anchor-held order (1 row → ready, fence bumped)`. The `writeOrderHoldFenced` precedence cases (weak-over-safety superseded; safety-over-weak applied) and both Unit A/D Outbox cases also remain green.

## 4. ⚠️ SECOND ITEM COWORK IS ADDING — the TS/SQL twin is a duplication hazard
`isDeliveryTerminalHold()` (TS) and `TERMINAL_HOLD_NOT_LIKE_SQL` (SQL) encode **the same prefix list in two places**, with a code comment instructing future authors to keep them in lock-step. A comment is not an enforcement mechanism: adding a fourth terminal prefix to one and not the other silently opens exactly the hole this change closes. **Is a test required that asserts the two lists agree** (or a single source generating both)? Given the repo already mandates a structural guard for the authority funnel, the same standard seems to apply here.

## 5. VERIFY (cite files:lines)
1. **Terminal enforcement is complete** — no resume or ship vector reaches a `quarantine_cutover:` order. You previously listed six vectors plus the two unmapped ones; confirm all eight are now closed, and that no ninth exists.
2. **Atomicity is real** — the three writes are genuinely in one transaction, and every failure mode (resolver `false`, hold not `'applied'`, mid-tx throw) leaves the order fully unparked.
3. **The hard-stop set is exhaustive** — particularly that `scanActiveCases` covers every scope, so no `refund_pending`/`customer_action` case can survive the park.
4. **The Stripe approach is sufficient.** Asserting `PAYMENT_PROVIDER=payme` at preflight is a point-in-time check. Rule on whether that is adequate given the provider could change, or a Stripe webhook could arrive from an earlier session, after the assertion passes.
5. **`executeAnchorReleaseCas`** — CC left it unchanged, arguing it binds `deliveryHoldReason = expectedHoldReason` exactly and its only caller rejects any non-`anchor_low_confidence:` marker. **Rule on whether the terminal guard should be added there too for defence in depth.**
6. **Payment classification** — `classifyPayment` correctly separates status-paid-without-record, record-paid-with-`fake`, and record-paid-external.
7. **No regression** — `markerRank`/`CURRENT_RANK_SQL` untouched; legacy byte-unchanged; hold DECISION functions and money math unchanged.

## 6. MIGRATION / DATA
No schema change (§1.1 freeze respected). Quarantine **executes only after** the Track-2 bridge — enforced by the preflight, not merely documented.

## 7. PROOF BOUNDARY
Real-PG: the ship CAS (incl. the new `quarantine_cutover:` refusal), `writeOrderHoldFenced` precedence, `executeAnchorReleaseCas`, `casClaimSendSlot`, and the Unit-D reconcile — **21/21 executed**. Mock tests cover the `start.ts`/regen terminal refusals, atomicity, payment classification and post-verify. **Not proven at a real DB:** the `start.ts` and single-page-regen refusals (mock-only), and the atomic transaction's rollback behaviour under a genuine mid-transaction abort. **The script has never been run in any environment.**

## 8. OUTPUT
Verdict **GO / NO-GO for cutover gate 1.3**, P0/P1/P2 as `files:lines`, plus explicit rulings on §4 (must the TS/SQL twin be test-enforced), §5.4 (is the Stripe assertion sufficient) and §5.5 (anchor-release defence in depth). Note also §7: the atomic rollback and the two non-ship refusals are still mock-only — rule on whether either needs DB-level proof before the script may run against production.
