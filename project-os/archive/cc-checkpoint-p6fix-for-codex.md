# #6-FIX checkpoint — 2×P1 + PayMe fence. For the panel re-verify + Codex re-confirm, BEFORE #7.

**Branch:** `feat/chunked-generation`. 4 commits, green per-commit (`npm run check`: 945 pass / 3 skip = staging, tsc clean), **chunk-runner.ts UNTOUCHED**, flag `READINESS_MANIFEST_ENABLED` OFF, zero renders.
- `915ee6be` FIX-1 · `73052ef1` FIX-2 · `011cf68f` FIX-3 · `ce8999a1` review-fix.

## FIX-1 (P1) — reconciliation-priority in `openExceptionCase`
The upsert `update` clause **no longer rewrites `kind`/`status`/`sourceRef`** — only clears `lastError` and (on `fenceExisting`) fences a stale claim. So a PROTECTED case (`status ∈ {refund_pending, customer_action}`, `kind ∈ {send_ambiguous, invalid_payload}`, or `actionAttemptedAt != null`) is never clobbered → no refund-before-reconciliation. The ONLY kind change is an explicit **UPGRADE** of a still-pre-external case (open/retry_scheduled, no send attempted) to a strictly higher-priority kind (`KIND_PRECEDENCE`), via a fenced guarded `updateMany` (count 0 → the concurrent change wins). A not-applied signal is logged `producer_recorded:` (vs `producer:`/`producer_upgraded:`).

## FIX-2 (P1) — durable order:scope reissue budget + global 48h window
New `ReissueBudget` row `@@unique([orderId, scope])` (migration `20260630_reissue_budget`). `count` caps total reissues (`REISSUE_BUDGET = 1`) **across cases + fulfillmentVersions**; `windowStartAt` anchors a **global 48h** window on the FIRST send attempt of the original delivery (not a per-case clock). `consumeReissueBudget` runs INSIDE the reissue tx (create-if-absent, else conditional `updateMany WHERE count < BUDGET`), so it can't be over-consumed by a concurrent reissue. The processor pre-checks `reissueBudgetAllows()` **before** the failed-path reissue (moved ahead of the former `:282`); exhausted/expired → `moveToRefund`. The in-tx consume is authoritative (`budget_exhausted` → refund). So an `ambiguous→failed→reissue→failed` chain refunds on the 2nd confirmed failure instead of reissuing forever.

## FIX-3 — PayMe exactly-once refund fence
New `RefundAttempt` row (`refundKey @unique`, migration `20260630_refund_attempt_fence`) — the effect-once fence (`actionAttemptedAt` was only a reservation marker). The PayMe path: a **prior fence record never re-calls** refund-sale (`confirmed`/`pending` → return as-is; `requested` response-lost → reconcile via a sale-state query: refunded → confirm, still-paid → stay `pending`, never re-issue). No prior → query sale (already-refunded short-circuit), `begin()` the fence atomically (create-if-absent; P2002 lost-race → reconcile, never double-issue), call refund-sale **exactly once**, `settle`. **Fails closed without a fence** (`payme_refund_fence_required`). Stripe unchanged (already idempotent via its key + list query). `prismaRefundFence(prisma)` is wired at the `handleRefund` call site (prisma isn't in scope in `defaultDeps`).
> **Residual window (documented):** a refund-sale that *genuinely failed* leaves the record stuck `requested`; future ticks return `pending` (never a 2nd issue) until the sale-state query — or #7 reconciliation — can prove it. Exactly-once is prioritized over closing-it-faster. **The PayMe crash/retry integration test (response-loss AFTER refund-sale + restart → NO 2nd refund) is #7's job.**

## Adversarial self-review (4 lenses, refute-by-default) — clean
**1 confirmed LOW (fixed in `ce8999a1`), 0 functional defects.** The reviewers found NO real bug in the exactly-once fence, the budget races (over/under-consume, window anchor, BUDGET=1 semantics, tx-rollback un-consume), or the reconciliation-priority logic. The LOW was audit-label-only: `openExceptionCase` derived "created" from `kind === args.kind`, mislabeling a same-kind replay against an existing case as `producer:` instead of `producer_recorded:` — fixed by an explicit existence check (a cheap `findUnique` before the upsert; cosmetic-only, never gates the atomic decision).

## Non-blocking (Codex-confirmed, no action taken)
Stripe `list:100` (single full refund — ok); cron isolation (ok pre-prod-flag-on; audit env-scoped secrets before prod).

## Status / next
Green; flag OFF; chunk-runner UNTOUCHED. Migrations are additive (staging-apply DEFERRED). **Push pending** — the FIX commits are local (my sandbox can't complete the GCM write-auth; `git push origin feat/chunked-generation` from your terminal). Per the locked order: **panel re-verify → Codex re-confirm → only then #7** (storage contract interim + the integration tests incl. the PayMe crash/retry test + flag-on).
