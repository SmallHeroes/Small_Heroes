# #6 FIX-4/5/6 checkpoint — PayMe refund exactly-once (3 review iterations). For Codex re-confirm, BEFORE deploy + #7.

**Branch:** `feat/chunked-generation`. Green per-commit (`npm run check`: 956 pass / 3 skip = staging, tsc clean), **chunk-runner UNTOUCHED**, flag `READINESS_MANIFEST_ENABLED` OFF, **migrations NOT deployed**. Commits: `62964d6f` FIX-4 (a/b/c) · `4894e752` FIX-5 · `ef41204c` FIX-6.

## The arc (why it took 3 iterations — the refund path is the hardest money invariant)
- **FIX-4** (your 2nd gate): 4a PayMe both-directions (re-attempt on `paid`), 4b lost_lease-no-budget-burn, 4c RLS. → **Re-verify (money=defect-until-proven) found 10 confirmed double-refund windows in 4a:** a `pending` fence already means PayMe ACCEPTED a refund, so re-issuing on a lagging `get-sales` `paid` read **double-refunds**; a `requested` fence was ambiguous (written before *or* after the POST); a lease-race 2nd processor re-issued; `partial_refund` blind-re-refunded.
- **FIX-5** (the redesign): a **pre-dispatch marker** — `RefundAttempt.status ∈ {requested, dispatched, pending, confirmed}`. `begin→requested` (refund-sale NEVER sent); an atomic `dispatch()` flips `requested→dispatched` (single-flight) **before** the POST; `settle` after. Reconcile by status: only `requested` (provably not-sent) may re-attempt (on a fully-paid sale); `dispatched`/`pending` NEVER re-issue (confirm-on-refunded else stay reconcilable); `partial_refund`→never blind full refund. **Exactly-once no longer depends on PayMe read consistency.** → **Verify: double-refund PASS**, but found **1 HIGH miss** — a *definitively-rejected* refund (HTTP 4xx / app rejection — not applied) was stuck `dispatched` forever (silent money-miss regression vs 4a).
- **FIX-6** (close the miss): an **error taxonomy**. `refundPaymeSale` throws `PaymeRefundError(definitive, httpStatus)` — DEFINITIVE (provably not applied) = HTTP-200 app rejection or 4xx; AMBIGUOUS = 5xx/network. `dispatchAndIssue` rolls the fence `dispatched→requested` (`undispatch`) **only on a definitive rejection** → a future tick re-attempts (restores 4a recovery, safe — no money moved); an ambiguous failure stays `dispatched` and is never re-issued (never double).

## Where it stands now — the invariant
**Never double-refund** (ambiguous/in-flight/lagging-paid never re-issues; single-flight `dispatch()`) **AND never silently strand a definitively-rejected refund** (it re-attempts). The guarantee does not rest on `get-sales` consistency or PayMe idempotency (PayMe has neither). Stripe path unchanged (already idempotent). 18 PayMe unit tests pin every branch.

## Residuals — explicitly surfaced for your re-confirm + #7 (NOT silent drops)
1. **Pre-send network failure** (ECONNREFUSED/DNS — provably never reached PayMe) is conservatively treated as *ambiguous* (stays `dispatched`), so it won't auto-re-attempt. #7 should add pre-send-vs-maybe-sent detection to roll those back too.
2. **A permanently-rejected sale** (e.g. too old) would loop `requested→dispatch→reject→requested` — double-refund-safe, but never resolves. #7 needs a **bounded-attempt / dead-letter / operator-alert** on long-stuck `refund_pending`.
3. **A refund-sale fetch timeout `< EXCEPTION_LEASE_MS`** (so a hung call can't outlive the lease) — recommended for #7.
None lose money silently: every residual leaves the case in `refund_pending`, reconcilable.

## Also in this arc
FIX-4b: budget consume now runs AFTER the claim — `lost_lease` never burns the single reissue; exhausted-at-consume THROWS → tx rolls back (case un-resolved). FIX-4c: `ENABLE ROW LEVEL SECURITY` on `ReissueBudget` + `RefundAttempt` (service-role only, mirrors `ExceptionCase`). Migrations: `20260630_reissue_budget`, `20260630_refund_attempt_fence` (RLS included; **undeployed**).

## Order
Per your gate: **Codex re-confirm (this) → THEN deploy migrations + #7** (storage contract interim + integration tests incl. the PayMe crash/retry test + the 3 residuals above + flag-on). Push pending Guy's terminal (my sandbox can't complete GCM write-auth).
