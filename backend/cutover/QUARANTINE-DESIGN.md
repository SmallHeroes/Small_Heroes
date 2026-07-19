# Cutover Track 1.3 — explicit quarantine of pre-cutover in-flight work

**Owner:** CC · **Depends on:** §1.2 (migration history) · **Blocks:** enabling generation (§Track 3) · **Status:** DESIGN for review — **execute only after Guy/Codex sign-off** (touches production data).

## Objective
Production holds work that predates the readiness-only schema: **19 Orders at `generating`, 1 Order at `paid`, and 3 GenerationJob rows at `running`**. The moment generation is enabled (`ENABLE_PROD_GENERATION=true`), autonomous crons would try to **resume** them against a schema they never knew — burning spend and risking incorrect delivery. We must put them into an **explicit terminal park** and record them in a **manual register** so a human resolves each one. **Never auto-resume, never auto-refund.**

The counts are a **fail-closed invariant**: the parking script asserts exactly `20` orders + `3` running jobs (or an explicit id allowlist) and refuses to run on any other count.

## Factual correction (verified against production)
**There is NO externally-paid order in the quarantine set** — so there is **no refund-or-fulfil decision** to make:
- the `paid`-status order has **no `paymentId` and no `PaymentRecord`** (zero payment evidence — the `status_paid_only` class);
- the only `PaymentRecord.paid=true` is provider **`fake`** (a test payment), on a `generating` order;
- the other 18 carry a checkout-intent `paymentId` with **no `PaymentRecord`** (intent ≠ payment).

The script must still **detect** payment correctly — from `PaymentRecord`/real payment ids, **never** from `Order.status` — and report the class, but no customer-remediation path exists. The `Order.status='failed'`→auto-refund finding is unchanged and preserved.

## Hardening applied (Codex re-gate — commits on `feat/chunked-generation`)
1. **Terminal marker (P0-3).** `quarantine_cutover:` is now refused by `start.ts` recovery redrive, the ship CAS (`executeReadinessShipCas` via the shared `TERMINAL_HOLD_NOT_LIKE_SQL`), and single-page regen — so a surviving case or a stray render can never resurrect a parked order. `markerRank` is unchanged (quarantine stays rank 1; a real `safety_hold:` still escalates).
2. **Atomicity (P0-1).** All per-order writes (job park → case neutralization → order hold) run in **one `prisma.$transaction`** (`lib/cutover/quarantine-park.ts` `parkOneOrderAtomic`); any step failure throws → Prisma rolls back → the order is left **untouched**.
3. **Fail-closed case scan (P0-2).** Before any write, the script scans **all** active `ExceptionCase` rows in **every scope** for the target orders and **hard-stops (non-zero exit)** on any `refund_pending`/`customer_action`. A resolver that returns `false` aborts that order.
4. **Schema preflight + sequencing (P0-4).** The script verifies the bridge schema exists (`ExceptionCase`/`HumanQaReviewCase` tables, `Order.deliveryFenceVersion`/`manualReviewRequired`, the `needs_human_qa` enum) and exits non-zero if not. **Quarantine EXECUTES only after the Track-2 bridge lands.**
5. **Stripe vector (P1-5b).** Locked via a preflight assertion `PAYMENT_PROVIDER=payme` — the Stripe webhook handler already early-returns for a non-Stripe provider, so all three status-write sites are inert with **zero payment-path code change** (lower-risk; legacy byte-unchanged).
6. **Payment detection (P1-6)** reads `PaymentRecord`/real ids (`classifyPayment`), never `Order.status`. **Post-verification (P0-7)** re-reads every order and exits non-zero on any mismatch. **Register (P0-8)** emits identifiers + payment *class* only — **no emails, no payment ids**.

---

## Why "never auto-resume": the six resume vectors
Once `ENABLE_PROD_GENERATION=true`, six paths reach the same claim logic. Two fire **autonomously on a cron** with no external input; the rest need an inbound trigger but reach the same code. Note the sweep cron route and `sweeper.ts` have **no** prod kill-switch — only the worker they dispatch is guarded — so the flag flip makes every vector live at once. **Quarantine must be fully in place before the flip.**

| # | Vector | Fires | Hits | Excluded by |
|---|--------|-------|------|-------------|
| 1 | **Sweep cron** `*/3` → `sweepStaleGenerationJobs` → worker | autonomous | the 3 `running` jobs (`status IN (pending,running) AND currentStage NOT IN (done,failed) AND lease free`) | Job → `status='failed'` **and** `currentStage='failed'` |
| 2 | **Worker route + self-chain** → `acquireGenerationLease` | on dispatch | same predicate as #1 | same Job park |
| 3 | **`start.ts`** creates a fresh job + re-claims the Order | on any trigger | **`generating` is ALWAYS eligible; `paid` is claimable** → a still-`generating`/`paid` order gets a NEW `pending` job that re-arms #1/#2 | **Order** → a `start.ts`-refused terminal (see park) |
| 4 | **Exceptions cron** `*/2` (gated by `READINESS_MANIFEST_ENABLED`) → `exception-processor` → `redriveGeneration` | autonomous | an OPEN/`retry_scheduled`/`refund_pending` ExceptionCase can redrive a `generating`/`paid` order **even after its job is parked**, and `refund_pending` **auto-refunds real money** | close/neutralize the case **and** park the Order; keep `READINESS_MANIFEST_ENABLED≠'true'` during the window |
| 5 | **Payment webhook / redirect** — `/api/payme/return` fires `triggerGeneration` on ANY GET for a `paid` order (no signature needed); PayMe/Stripe webhook replays | on inbound hit | the 1 `paid` order | move the Order off `paid` to a refused terminal |
| 6 | **Manual/dev** — `/api/generate`, `/api/generate/start` (secret-gated), `/api/dev/generation/resume` | explicit call | any | don't call them during the window; the Order park refuses anyway |

**Consequence:** parking *only* the job is **insufficient** (vector 3 re-creates a job for a still-`generating`/`paid` order). We must park **both** the job **and** the order, **and** neutralize existing cases.

---

## The verified-safe terminal park

### ⚠️ The trap: do NOT set `Order.status='failed'`
`syncTerminalExceptionCases` scans `where: { status:'failed', order:{ status:'failed' } }` and, for a `retryable=false` job, opens a `refund_pending` case → `handleRefund` → `refundOrderPayment` issues a **real Stripe/PayMe refund + customer email** for every matched order (`exception-processor.ts:817-881`, `payment-refunds.ts:93-208`). With `retryable=true` it instead **auto-redrives**. This reactor is gated **only on `READINESS_MANIFEST_ENABLED`**, not the generation kill-switch — so `Order→failed` triggers a refund/notification storm independent of `ENABLE_PROD_GENERATION`. **`failed` is never a terminal park here.**

### The park (three writes per order)
1. **GenerationJob → terminal.** `status='failed'`, `currentStage='failed'`, `retryable=false`, `lastError='cutover_quarantine'`, `failedAt=now`.
   - Excludes it from the sweeper (#1) and `acquireGenerationLease` (#2) — both the `status` and `currentStage` clauses fail. `retryable=false` is defense-in-depth. It does **not** trip `syncTerminalExceptionCases` because that JOIN also requires `order.status='failed'`, which we deliberately avoid.
2. **Order → `needs_human_qa` via the funnel**, marker `quarantine_cutover:<priorStatus>` (e.g. `quarantine_cutover:generating` / `quarantine_cutover:paid`):
   - `writeOrderHoldFenced(db, { orderId, newStatus:'needs_human_qa', newHoldReason:'quarantine_cutover:'+prior, requireNotDelivered:true })` — the **enforced authority writer** (binds+bumps the delivery fence, respects marker precedence; `requireNotDelivered` guarantees a delivered book is never retracted).
   - `needs_human_qa` holds delivery (the ship CAS requires `ready`; these orders have no `DeliveryOutbox` row → nothing ships).
   - The `quarantine_cutover:` marker is **deliberately NOT** `safety_hold:`/`contract_world_hold:`/`anchor_low_confidence:`: `classifyHoldForCase` recognizes only those, so an unknown marker opens **no** HumanQaReviewCase and sends **no** operator notification (`reconcileHumanQaHolds` `includeUnknown=false` — counted only in `legacyUnknown` for observability). Quiet park, no notification storm, no QA-namespace pollution.
3. **Neutralize existing ExceptionCases** (closes vector 4):
   - Cases in `open`/`retry_scheduled` with no external action → resolve via `resolveActiveRecoveryCaseInTx` (writes an audit; drops them out of the claim set) so no recovery redrive can fire.
   - Cases in `refund_pending`/`customer_action` (a real payment obligation already crossed) → **do NOT silently cancel**. Flag them **RED** in the register for a human decision, and resolve them **before** `READINESS_MANIFEST_ENABLED` is turned on (else the exceptions cron auto-processes them). Pre-cutover that cron is disabled, so there is no auto-refund during the window.

### Why this is correct for BOTH cohorts
- The **19 unpaid `generating`** orders are held silently — no delivery, no case, no notification, no spend.
- The **`paid`-status** order (no payment evidence — `status_paid_only`) lands in `needs_human_qa` — **held, undelivered** — for manual disposition (discard / re-order). No external money moved, so **no refund is owed**; the register's `paymentClass` column records this explicitly.

### `start.ts` residual note
`start.ts` unconditionally refuses `needs_human_qa` only for the `safety_hold:`/`contract_world_hold:` prefixes; a `quarantine_cutover:` order *would* be claimable under a **recovery redrive** (vector 4) — which is exactly why step 3 (neutralize cases) is **mandatory**, not optional. With no open case + the exceptions cron disabled pre-cutover, vector 4 has nothing to act on.

---

## The manual register (no schema change — respects the §1.1 freeze)
A durable, human-curated record — **a committed file, not a DB table** (a new table or reusing `ExceptionCase`/`HumanQaReviewCase` would need a migration during the freeze, and `ExceptionCase` is an *autonomous auto-refund queue*, the opposite of a manual register).

The parking script **snapshots each row before mutating** and writes `backend/cutover/QUARANTINE-REGISTER.csv` (+ a readable `.md`). Columns:

`orderId, priorOrderStatus, paymentClass, jobStatus, jobStage, activeCaseCount, activeCaseScopes, quarantinedAt, marker, resolution, resolvedBy, resolvedAt`

**No PII (P0-8):** identifiers + the derived `paymentClass` (`record_paid_external` / `record_paid_fake` / `status_paid_only` / `unpaid`) only — **no emails, no payment ids** in the committed file. `resolution`/`resolvedBy`/`resolvedAt` are blank at park time — the operator fills them per order (discard / re-order). Any `refund_pending`/`customer_action` case would have already **hard-stopped** the run (P0-2), so none reach the register.

---

## Runbook — strict ordering (each step gated on the previous)
0. **Land the Track-2 bridge first** — the script's schema preflight refuses to run until `ExceptionCase`/`HumanQaReviewCase`, `Order.deliveryFenceVersion`/`manualReviewRequired`, and the `needs_human_qa` enum exist. **Lock `PAYMENT_PROVIDER=payme`** for the window (Stripe inert).
1. **Confirm the freeze (§1.1)** is in effect — no new orders/jobs are being created (so the count invariant is stable).
2. **Dry-run** `scripts/cutover-quarantine.ts` (default). Preflight (schema + PayMe) → select the target set (`Order.status IN ('generating','paid')` before the cutoff, **or** an explicit allowlist) → assert `count == 20 orders + 3 running jobs` → **hard-stop** on any active `refund_pending`/`customer_action` case → write the PII-free register. **Any failure exits non-zero.**
3. **Review** the printed register with Guy/Codex. Resolve any `refund_pending`/`customer_action` case decisions.
4. **Execute** the script (`--commit`), which parks each order in **one atomic transaction** (job → cases → order hold); a failure aborts that order untouched. Then it **post-verifies** every order and **exits non-zero** if even one did not park exactly. Idempotent (re-running is a no-op on already-parked rows).
5. **Verify**: re-query and assert every target job is `failed/failed`, every target order is `needs_human_qa` with a `quarantine_cutover:` marker, and no target order has an active case in the claim set. Commit the filled register.
6. **Only then** proceed to Track 3 (turn on `READINESS_MANIFEST_ENABLED`, then `ENABLE_PROD_GENERATION=true`).

**Never** flip either flag before step 5 verifies.

---

## Defense-in-depth backstop (not a substitute)
All 19 `generating` + 1 `paid` orders' assets predate `20260715_safety_hold_signal`, so every `ImageAsset.safetyVerified` and `GeneratedBook.coverSafetyVerified` is `false` (NOT NULL DEFAULT false backfill; nothing flips legacy rows to true). If one were *accidentally* resumed and reached the delivery boundary, `resolveSafetyDeliveryGate` returns `held:true` and `finalizePackageDelivery` parks it at `needs_human_qa` `safety_hold:unverified` and **withholds the email — unconditionally, even with readiness OFF** (`package-delivery.ts:57-159`). This guarantees an unverified legacy asset **can never deliver as safe** — but it does **not** stop the sweeper from burning generation spend. The park above remains the primary, required control.

---

## Two implementation options
- **Option A — zero schema change (RECOMMENDED for the freeze).** The park above (Job→failed/failed + Order→`needs_human_qa`+`quarantine_cutover:` + case neutralization) uses only existing mechanisms proven inert for the custom marker, plus a file register. No migration → respects §1.1.
- **Option B — dedicated `quarantined` OrderStatus (cleanest, post-freeze or with explicit approval).** `ALTER TYPE "OrderStatus" ADD VALUE 'quarantined'` (Postgres non-blocking add). Nothing branches on it: the sweeper excludes it, `syncTerminalExceptionCases` (`status='failed'`) excludes it, `classifyHoldForCase` returns not-held, and `start.ts` refuses it (not in `claimableStatuses`, not `generating`) **without** needing a marker. Truly inert. Cost: a schema edit during the freeze + audit the `/api/generate/status` label mapping and any status switch. Recommend only if Guy accepts one additive migration into the bridge rehearsals.

**Recommendation: ship Option A now** (freeze-safe); consider Option B as the durable model once the freeze lifts.

## What NOT to do (the traps, restated)
- ❌ `Order.status='failed'` → auto-refund + email storm (`syncTerminalExceptionCases`).
- ❌ Open a fresh `ExceptionCase` (any kind) as the "register" → the exceptions cron auto-refunds the paid order (`refund_pending` → real provider refund), **not** gated by the generation switch.
- ❌ Park only the job → vector 3 re-creates a job for the still-`generating`/`paid` order.
- ❌ Flip `ENABLE_PROD_GENERATION` or `READINESS_MANIFEST_ENABLED` before the park is verified.
