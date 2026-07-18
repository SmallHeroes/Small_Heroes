# CODEX RE-GATE (round 2) — Human-QA Slice 1 NO-GO fixes

## 1. ROUTING + TARGET
- **Reviewer:** Codex. **Mode:** read-only static audit + tx/concurrency reasoning; cite `files:lines`.
- **Commits on `feat/chunked-generation`:** `cfe5d53b` (P0-1), `2383be5c` (P0-2), `547b62ce` (P1-3), `c3e5b66d` (P1-4/P2-1), `5d9b4068` (P2-2/P2-3). **Diff range `e0f808eb..5d9b4068`.** Not pushed.
- **Gate: [CODEX-GATE]** — money-transaction isolation + hold-release authorization. Verdict decides whether Slice 1 may deploy to staging.

## 2. ORIGIN / CONTEXT
Your re-gate of `e0f808eb` = NO-GO (2 P0 + 2 P1 + 3 P2). This round closes them via a **design reversal you sanctioned**: the review-case lifecycle moves OUT of every hold/money transaction (commit hold+marker → write the case post-commit in its own tx → the reconciler repairs failures). Cowork structurally verified: **zero** `recordHumanQaHoldInTx` calls remain inside any of the 7 seam files (the single remaining mention is a comment at `readiness-manifest.ts:819`), and `syncHumanQaHoldCasePostCommit` is wired in all of them.

## 3. VERIFY (cite files:lines)
1. **[P0-1] No hold/money tx can be aborted by case logic.** New shared core `lib/human-qa/sync-hold-case.ts`: pure `classifyHoldForCase` + own-tx `syncHumanQaHoldCase` + `syncHumanQaHoldCasePostCommit` (must NEVER throw into the seam). Confirm: (a) no case/outbox write remains inside ANY seam or money transaction; (b) the post-commit hook cannot propagate a rejection into the caller; (c) every money write is byte-identical (paid transition, `PaymentRecord` upsert, coupon confirm, the coupon-fence `order.update`) and the legacy park/readiness writes are unchanged.
2. **[P0-2] Anchor-release cannot ship past a stronger hold.** Under `FOR UPDATE`: re-reads status+marker, requires the marker unchanged, rejects any active non-anchor base case OR active payment case with **409**, releases via a status+marker `updateMany` CAS; a concurrent `ready` seen under lock is an idempotent no-op. Confirm NO path can release a `safety`/`contract_world`/`payment_integrity` hold, including the `skip_weaker` divergence you found (safety case active while the marker reads anchor).
3. **[P1-3] Reconciler.** Delegates to the SAME `classifyHoldForCase` the seams use → skips `base_book_integrity`, recovery-owned orders, and unknown/null markers unless `--include-unknown`; `reconcile-plan.ts` removed. Confirm it creates no case for recoverable holds AND reliably repairs missing cases for terminal manual holds.
4. **[P1-4/P2-1]** `/api/generate/status` accepts UUID as well as CUID; auth runs BEFORE `sweepStaleGenerationJobs`.
5. **[P2-2/P2-3]** A missing `HUMAN_QA_OPERATOR_EMAIL` reschedules (non-terminal, the 23h window is NOT consumed, and it sends after the env is fixed); the send CAS compares `activeKey = orderId:scope` so a superseded case's stale outbox is suppressed.
6. **No regression:** all hold-DECISION outputs and money math byte-unchanged; tsc 0; 2029 passed (baseline 2008).

## 4. ⚠️ NEW ARCHITECTURAL QUESTION (Cowork raises — please rule)
The sanctioned design shift **creates a window**: between the hold/money COMMIT and the post-commit case write. If the process dies in that window (or the post-commit write fails), the order is HELD WITH NO CASE and NO notification — **a silent hold, which is exactly what this slice exists to eliminate.** The reconciler is now the load-bearing repair net.
**Rule on:** is the repair net actually guaranteed? Specifically — is the reconciler **scheduled** (cron, bounded lag) or **manual-only script**? If manual-only, a crash in the window can leave a silent hold indefinitely, and Slice 1 would not deliver its core promise. Should a scheduled reconciler cron be REQUIRED before staging/launch, and what is an acceptable maximum repair lag?

## 5. DEPLOY NOTE (carried from your round-1 ruling)
`HUMAN_QA_NOTIFY_ENABLED=off` disables only the SENDER — case/outbox writes and the new status behavior are active regardless → **the migration must be deployed BEFORE the code**, and run `prisma migrate status` on staging first (the back-dated coupon migration).

## 6. OUTPUT
Verdict **GO / NO-GO to deploy Slice 1 to staging**, P0/P1/P2 as `files:lines`, plus an explicit ruling on §4 (is the reconciler's repair net sufficient, and must it be scheduled before this ships). Focus scrutiny on §3.1 (no tx can be aborted / money byte-identical), §3.2 (release authorization under race), and §4 (the new silent-hold window).
