# CODEX RE-GATE — Human-QA hold, Slice 1 (lifecycle foundation)

## 1. ROUTING + TARGET
- **Reviewer:** Codex. **Mode:** read-only static audit + tx/concurrency reasoning; cite `files:lines`.
- **Commits on `feat/chunked-generation`:** `45e2cad7` (Unit 1, pushed), `e5c3137b` (Unit 2 seams+release), `ab38ca9a` (Unit 3 send worker), `2fbfb204` (Unit 4 status auth), `e0f808eb` (Unit 5 reconciler). **Diff range `eff856a1..e0f808eb`.**
- **Gate type: [CODEX-GATE]** — touches safety parking, payment fences, public status auth, outbox delivery, the anchor-release endpoint. Verdict decides whether Slice 1 is safe to deploy to staging.

## 2. ORIGIN / CONTEXT
Slice 1 makes eligible holds VISIBLE (durable review case + operator notification + customer `under_review`) WITHOUT changing any hold decision. Built per the hardened brief. Cowork pre-verified: the 3 payment seams are additive-only (0 deletions), `recordHumanQaHoldInTx` inserted inside the existing money tx via `ON CONFLICT DO NOTHING`. CC self-verified 2008 tests pass, tsc 0.

## 3. VERIFY (cite files:lines)
1. **MONEY-SAFETY (the critical property) — payment seams 5/6/7** (`webhooks/payme`, `payme/return`, `fake-payment/confirm`): the case+outbox insert uses non-aborting `INSERT … ON CONFLICT DO NOTHING RETURNING id` and therefore can NEVER abort/roll back the surrounding money tx (paid transition + PaymentRecord + coupon confirmation). Confirm in real-Postgres terms: a unique conflict on the case/outbox insert cannot poison the money transaction, and no money `where`/`data` changed (byte-identical).
2. **DECISIONS BYTE-UNCHANGED (the proof):** the 3 tx-WRAPPED seams (quality-recovery park `exception-processor`, legacy anchor `package-delivery`, legacy anchor-release) change ONLY `prisma.`→`tx.` with identical `where`+`data`; the 4 in-existing-tx seams are pure additions. Confirm every hold-DECISION output (safety/readiness/anchor/payment) is unchanged — the decision specs (readiness 34, anchor 13, package-delivery, qa-soft-deliver, exception-processor) pass with their ORIGINAL status/reason assertions.
3. **ELIGIBILITY:** a `HumanQaReviewCase` is created ONLY for terminal manual holds (`safety|contract_world|anchor|payment_integrity`) — gated on the hold MARKER, not merely `needs_human_qa`. Confirm recoverable `base_book_integrity`/`qa_soft_deliver`/infra paths (governed by `ExceptionCase`) open NO case at the seams.
4. **DATA INVARIANTS:** `activeKey` nullable-UNIQUE + lifecycle CHECK (active⇒key set, terminal⇒key NULL); `@@unique(orderId,scope,revision)`; immutable evidence snapshot + `holdFingerprint`; same fingerprint idempotent; new fingerprint supersedes the prior active case atomically; `base_book` precedence `safety > contract_world > anchor` (weaker never replaces safety). Migration `20260718_human_qa_review_case` idempotent + safe.
5. **RELEASE HOOK:** `admin/anchor-hold-release` closes the active ANCHOR case + suppresses its unsent notification in the SAME tx that releases the Order (legacy path) / via `runReadinessTxn` ready-branch (readiness path); `kinds:['anchor']` can never release a safety/contract_world case; the endpoint's release SCOPE is unchanged (still refuses non-anchor holds).
6. **OPERATOR SEND:** send-time CAS proves case still active + Order still `needs_human_qa` + fingerprint matches; a released/superseded case → `suppressed`, never sent; ambiguous provider send never blind-retries; missing `HUMAN_QA_OPERATOR_EMAIL` fails CLOSED (notifies nothing, releases nothing); `HUMAN_QA_NOTIFY_ENABLED` default OFF; cron CRON_SECRET-gated.
7. **CUSTOMER STATUS (auth + no-leak):** `/api/generate/status` requires the derived key (`paymentId||paymeTransactionId||stripeSessionId`), 404 on mismatch; strips `lastError`; a held order returns ONLY `{status:'under_review', childName}` — no hazard/`deliveryHoldReason`/artifact/`readUrl` leak; all 3 pollers send the key + in-flight guard. Confirm no new bypass and no info leak.
8. **RECONCILER:** idempotent backfill of terminal `needs_human_qa` orders without an active case (incl. `cmrnuhsva`); unknown markers → `legacy_unknown`.

## 4. JUDGMENT CALLS (rule on — CC flagged)
1. **No deep link** in the operator email (orderId + reason only; the linkable console is Slice 2). Accept for Slice 1?
2. **Reconciler is a TOTAL classifier** (backfills EVERY terminal `needs_human_qa`, surfacing recoverable-marker strays as `legacy_unknown` for operator attention) vs the seams' MARKER-only classifier (null for recoverable). Is "conservative, no silent gap" correct, or could the reconciler wrongly create a case for an auto-recoverable order and interfere with `ExceptionCase` recovery? Rule before it runs against staging.

## 5. MIGRATION / NO-REGRESSION
`20260718_human_qa_review_case` — confirm idempotent + safe to `prisma migrate deploy` on staging (note prior back-dated coupon migration → run `migrate status`). No regression: zero hold-decision change; money/coupon math unchanged; board engine, Stage-1 safety semantics untouched (only additive case/notification). 2008 tests pass.

## 6. PROOF BOUNDARY
Flags default OFF (`HUMAN_QA_NOTIFY_ENABLED` off; cases only created when real holds fire at the seams). Static re-gate; the runtime proof is a staging order that holds → case created + email sent (after flag on) + `under_review` shown. Confirm the fail-closed behavior with the flag off is inert.

## 7. OUTPUT
Verdict **GO / NO-GO to deploy Slice 1 to staging**, P0/P1/P2 as `files:lines`, and explicit rulings on the two §4 judgment calls. Focus scrutiny on §3.1 (money-safety non-abort), §3.2 (decisions byte-unchanged), §3.3 (eligibility), §3.7 (auth/no-leak).
