# BRIEF (CC) — quarantine hardening: close the Codex NO-GO on `fcb33412` (4 P0 + 2 P1 + 2)

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). Branch pre-check first; HEAD `fcb33412`. ONE agent in this worktree.
- **FORWARD FIX ONLY** — no amend, no rebase, **no force-push**.
- **Gate: [CODEX-GATE].** This script writes production data. Commit locally; STOP for the re-gate. **Do not execute anything against production.**

## 2. SCOPE (what + why now)
Codex NO-GO on running `fcb33412` in production. The chosen park primitive is right in principle; the implementation does not yet prove a terminal, atomic park against every resume vector. Your `Order.status='failed'` → auto-refund finding was correct and is preserved — do not revisit it.

**⚠️ FACTUAL CORRECTION that removes work from this brief.** The design and Cowork's earlier reading both treated the group as containing one genuinely paid order. **It does not.** Verified directly against production:
- the `paid`-status order (`cmob9sjtr…`) has **no `paymentId` and no `PaymentRecord` row** — zero payment evidence;
- the only row with `PaymentRecord.paid = true` is provider **`fake`** (a test payment), and its status is `generating`;
- the other 18 carry a `paymentId` with **no `PaymentRecord`** — that field is set at checkout intent, not at payment.
**There is no externally-paid order in the quarantine set.** So there is no refund-or-fulfil decision to make. The script must still *detect* payment correctly (§3.6) — it must never rely on `Order.status` — but no customer remediation path is needed.

**Required fixes (Codex):**
1. **[P0] Atomicity.** The doc promises one transaction per order (`QUARANTINE-DESIGN.md:68`); the code performs three separate writes (`cutover-quarantine.ts:115`, `:122`, `:124`). A mid-failure leaves a resumable partial state. **All DB writes per order must be one atomic transaction; any resolver/hold failure must abort the whole order's park.**
2. **[P0] Fail-closed on case neutralisation.** The script ignores the `false` returned by the guarded resolver (`exception-case.ts:558`) and merely warns on `refund_pending`/`customer_action` before continuing (`cutover-quarantine.ts:102`). Once readiness is on, the cron claims exactly those statuses (`exception-case.ts:616`) and can redrive or refund. **Scan ALL active ExceptionCases in every scope and HARD-STOP on `refund_pending`/`customer_action`; a failed resolve aborts.**
3. **[P0] `quarantine_cutover:` is not terminal for recovery.** `start.ts` refuses only `safety_hold:` and `contract_world_hold:` under recovery (`start.ts:58`, `:64`, `:80`) — any other `needs_human_qa` is claimable, so one surviving case reopens the pipeline. **Make `quarantine_cutover:` a shared terminal marker in `start.ts`, the ship CAS, and single-page regen.**
4. **[P0] Prod cannot run the script yet.** `ExceptionCase`, `HumanQaReviewCase`, `deliveryFenceVersion`, `manualReviewRequired` and the `needs_human_qa` enum value do not exist in production; the script dies at `cutover-quarantine.ts:83`. **This is a sequencing fact, not a code fix: quarantine EXECUTES only after the Track-2 bridge lands.** Make that dependency explicit in the script (a preflight that verifies the required schema and exits non-zero) and in the design doc.
5. **[P1] Two unmapped vectors.** `/api/debug/regen-page` runs in production when `ALLOW_REGEN_IN_PROD=1` with no quarantine check and then performs a readiness commit (`regen-page/route.ts:8`, `single-page-image-regen.ts:909`). And Stripe webhook updates are not status-gated (`stripe/route.ts:103`, `:198`, `:214`), so they can overwrite `needs_human_qa` → `paid`/`failed`. **Gate both**; for Stripe, either status-gate the updates or have the script assert and lock `PAYMENT_PROVIDER` to PayMe for the duration.
6. **[P1] Payment detection is unreliable.** The script infers `paid` from Stripe/PayMe fields or `Order.status` (`cutover-quarantine.ts:87`). **Read `PaymentRecord` and `Order.paymentId` and `manualReviewRequired`; distinguish status-paid from externally-paid explicitly** and report both in the register.
7. **Hard post-verification** — re-read every order after the park and **exit non-zero if even one did not park exactly**.
8. **No PII in a committed file** — the register currently writes emails/payment IDs (`cutover-quarantine.ts:80`). Emit identifiers only; keep any contact data out of git.

## 3. FILES / AREAS
`scripts/cutover-quarantine.ts` · `backend/cutover/QUARANTINE-DESIGN.md` · `lib/generation-chunked/start.ts` (terminal marker) · the ship CAS in `lib/generation-pipeline/order-authority.ts` · `lib/single-page-image-regen.ts` · `app/api/debug/regen-page/route.ts` · `app/api/webhooks/stripe/route.ts` (status gating).

## 4. ACCEPTANCE CRITERIA
- One atomic transaction per order; any failure leaves that order **untouched**, never partially parked.
- The script hard-stops (non-zero exit) on: a failed resolve, any active `refund_pending`/`customer_action` case in any scope, a schema preflight failure, or a post-verification mismatch.
- `quarantine_cutover:` is refused by `start.ts` recovery, the ship CAS, and single-page regen — proven by tests.
- `/api/debug/regen-page` cannot act on a quarantined order in production; Stripe cannot overwrite `needs_human_qa` (or PayMe-only is asserted and locked).
- Payment state is derived from `PaymentRecord`/`paymentId`, never from `Order.status` alone.
- The register contains no email addresses or payment identifiers.
- `npm run check` green; the legacy path stays byte-unchanged.

## 5. TESTS
- A forced failure at each of the three write steps → the order is fully unparked (atomicity).
- An order with an active `refund_pending` case → the script aborts before writing anything.
- A `quarantine_cutover:`-marked order → `start.ts` recovery refuses it; the ship CAS refuses it; regen refuses it.
- Payment classification: status-paid-without-record, record-paid-with-`fake`, and record-paid-external are each classified correctly.
- Post-verification detects a deliberately unparked order and exits non-zero.

## 6. WHAT NOT TO TOUCH
The `Order.status='failed'` → auto-refund finding (correct, keep the design decision); hold DECISION functions; money/coupon math; the frozen legacy path; the delivery fence primitives.

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`**; no force-push; commit per fix unit on `feat/chunked-generation`; commit locally, **Guy pushes**. **Execute nothing against production.**

## 8. FINAL VERIFICATION
`npm run check` green. Report: the atomic transaction shape, every hard-stop condition, the terminal-marker enforcement points with tests, the payment-classification logic, and the corrected register format. **Then STOP for the Codex re-gate.**
