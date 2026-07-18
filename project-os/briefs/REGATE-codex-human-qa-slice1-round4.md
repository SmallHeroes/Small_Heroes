# CODEX RE-GATE (round 4) — Human-QA Slice 1: the round-3 P0 close + the carried-forward golden-path question

## 1. ROUTING + TARGET
- **Reviewer:** Codex. **Mode:** read-only static audit + tx/concurrency reasoning; cite `files:lines`.
- **Branch:** `feat/chunked-generation`. **Diff range `5d9b4068..HEAD`** (adds `d52e0126` to the range you ruled on last round).
- **Gate: [CODEX-GATE] + DECISION GATE** — `d52e0126` modifies `commitBaseBookReadiness`, a shared production function on the golden delivery path. Verdict decides whether Slice 1 may deploy to staging.

## 2. ORIGIN / CONTEXT
Your round-3 verdict: §3.1–3.6 **PASS**, one blocker — the flag-ON cross-transaction window (a safety park landing between the authorization commit and the readiness commit is clobbered to `ready` + Outbox-enqueued → an unsafe book ships). `d52e0126` implements your prescribed close, and only that:
- `CommitArgs.requireHold?: { deliveryHoldReason }` — **opt-in**. When supplied, the final Order CAS additionally requires `status='needs_human_qa' AND deliveryHoldReason=<authorized marker> AND manualReviewRequired=false`.
- On a 0-row CAS with `requireHold`, a distinguishing read separates an `inputVersion` TOCTOU (→ retry, unchanged) from a precondition failure (→ new `ReleasePreconditionError`, **never retried**, distinct from `OutboxReconciliationError`).
- The flag-ON anchor-release route passes the marker validated under the authorization lock and maps the error to a typed **409** — no Outbox, nothing shipped.
- Per your ruling: **not** by holding the auth lock across readiness, **not** by flipping to `ready` in auth, **not** a broad status/reason CAS — it compares against the authorized anchor marker specifically.
Cowork independently verified the opt-in gating: with `requireHold` absent, `orderWhere` is byte-identical `{ id, inputVersion }` and the guarded block is skipped so `throw new Error(TOCTOU)` is unchanged (`readiness-manifest.ts:851-879`).

## 3. VERIFY (cite files:lines)
1. **The window is actually closed.** A safety hard-park (`exception-processor.ts:170,172`) or payment fence landing between the authorization commit and the readiness commit makes the `requireHold` CAS match 0 rows → `ReleasePreconditionError` → 409 → **no `ready`, no Outbox enqueue, nothing shipped**. Confirm no residual ordering in which readiness still wins.
2. **⚠️ The retry loop × precondition interaction.** On a 0-row CAS where `inputVersion` **also** changed, the code throws `TOCTOU` and retries; the retry reloads the Order (new `inputVersion`) and re-applies `requireHold`. Confirm this converges to `ReleasePreconditionError` and **cannot** loop into a state where the reloaded pass re-observes a stale marker and ships. This retry×precondition composition is the subtlest part of the change and is not covered by your round-3 reasoning.
3. **The distinguishing read is sound** — `cur === null` (row gone) and `cur.inputVersion !== order.inputVersion` both fall through to the unchanged TOCTOU path; only `inputVersion` unchanged ⇒ precondition failure. Confirm no case is misclassified in a way that either retries a stronger hold or aborts a legitimate release.
4. **Golden path byte-unchanged** — every caller that omits `requireHold` (notably the normal post-generation delivery commit) keeps the exact prior WHERE and throw. Confirm no behavioural drift and no new failure mode on that path.
5. **No regression to your round-3 PASSes** — authorization still flag-independent; flag-ON delivery still Outbox-only with `OutboxReconciliationError`→409 and no direct email; flag-OFF unchanged; the P0-B reconciler cron intact; `classifyHoldForCase` byte-unchanged; money/coupon/board/Stage-1 untouched. tsc 0; vitest 2059 passed / 25 skipped / 0 failed (baseline 2053).

## 4. ⚠️ CARRIED-FORWARD QUESTION — please rule explicitly
Your round-3 finding was that `commitBaseBookReadiness` CASes on `id + inputVersion` only, never re-reads `deliveryHoldReason`/`manualReviewRequired`, and that a safety park bumps neither. `d52e0126` fixes that **only for callers that opt in** — i.e. only the flag-ON anchor-release path.
**Question:** can the **normal post-generation caller** clobber a concurrent safety park the same way? If the exception processor can hard-park an order while the ordinary readiness commit is in flight, then this is a **general force-ship window on the golden delivery path**, not an anchor-release-specific one — and it would be materially more severe than the defect just closed, because it needs no admin action and every book traverses that path.
Rule on: is that window real on the normal path? If yes — severity, and the minimal correct close (make `requireHold` mandatory for held orders? a status/marker guard on every readiness flip? a different mechanism?). If no — state precisely what prevents it, so it can be relied on.

## 5. MIGRATION / DATA
No new migration in this range. The original Slice-1 migration `20260718_human_qa_review_case` still binds: **deploy the migration BEFORE the code** (`HUMAN_QA_NOTIFY_ENABLED=off` disables only the SENDER), and run `prisma migrate status` on staging first (back-dated coupon migration).

## 6. NO-REGRESSION
Hold DECISION functions, money/coupon math, the board engine, Stage-1 safety semantics, `DeliveryOutbox`, `ExceptionCase` — behaviourally unchanged.

## 7. PROOF BOUNDARY
Static re-gate. Not provable in CI: the scheduled reconciler firing in a deployed env (**Vercel Preview crons do not run** → external scheduler or a manual CRON_SECRET `curl`), and a real held order producing case → notification → `under_review`.

**⚠️ FLAG VALUE NOW CONFIRMED (changes the weighting of everything above): `READINESS_MANIFEST_ENABLED=true` on the Vercel PREVIEW environment** — which is what `qa.smallheroes.co.il` serves. So the flag-ON path is **the deployed QA path**, not a hypothetical. Retroactively: your round-2 P0-A (guard present only on the readiness-OFF path) was **fully open on QA**, and the `519b89f4` direct-send regression was **live on QA**. Please weigh the flag-ON findings as production-adjacent, not theoretical. Production's value is being confirmed separately; if Production is OFF then QA and Production run **different delivery paths**, which bears directly on §4.

## 8. OUTPUT
Verdict **GO / NO-GO to deploy Slice 1 to staging**, P0/P1/P2 as `files:lines`, plus an explicit ruling on §4. Focus scrutiny on §3.1 (window closed), §3.2 (retry × precondition), §3.4 (golden path unchanged), and §4 (is the golden path itself exposed).
