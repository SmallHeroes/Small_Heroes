# CODEX CONSULT — production DB has never been migrated; design the cutover baseline before 2026-08-01

## 1. ROUTING + TARGET
- **Reviewer:** Codex. **Mode:** design consult + risk ruling. No code to review yet — this is a "how do we do this safely" question on a **live production database with real customer data**.
- **Systems:** Supabase prod `ozxjmnzybzetqudivlbw` vs staging `qvksgpzzosotubcbizay`; Prisma migrations in the repo; branch `feat/chunked-generation` (299 ahead of `main`).
- **Why Codex:** this is irreversible work on live money/customer data. Cowork does not self-certify anything in this class.

## 2. THE FINDING (verified via the Supabase API, 2026-07-18)
**Production has no `_prisma_migrations` table at all** — `list_migrations` returns empty. Prisma migrate has never run against prod; the schema was created some other way (`db push` or hand-rolled). Staging has `_prisma_migrations` with **40** rows.

**Table counts:** prod **17** tables, staging **29**.

**Missing in production** (present in staging, required by `feat/chunked-generation`): `BookReadiness`, `BookReadinessManifest`, `DeliveryOutbox`, `ExceptionCase`, `ExceptionCaseAudit`, `RefundAttempt`, `ReissueBudget`, `QualityEvidence`, `AtomicOperationReceipt`, `Coupon`, `CouponRedemption`.

**Missing in BOTH** (Slice-1 migration not yet applied anywhere): `HumanQaReviewCase`, `OperatorNotificationOutbox`.

**Live data at risk in prod:** `Order` 244 rows, `GeneratedBook` 190, `BookPage` 1540, `ImageAsset` 1187, `PaymentRecord` 3, `Customer` 0, `OtpCode` 4.

## 3. WHY THIS IS THE LAUNCH BLOCKER
1. `prisma migrate deploy` against prod will attempt all 40 migrations onto a database that **already contains** many of those objects → conflicts/failures. There is no baseline recording what is already applied.
2. Until those tables exist, **the entire `feat/chunked-generation` codebase cannot run in production** — it references `ExceptionCase`, `Coupon`, `AtomicOperationReceipt`, `QualityEvidence` and more. The FF of `main` → `feat/chunked-generation` is therefore **not** a deploy; it is a schema cutover.
3. `READINESS_MANIFEST_ENABLED` is `true` on **Preview only**. Setting it on Production today would crash instantly (no `BookReadiness`/`DeliveryOutbox`) — the same class as the `coverSafetyVerified` crash that hit QA. **Do not set it until the schema lands.**
4. Consequently **every QA proof to date has validated the readiness-ON path, which production cannot currently run at all.**

## 4. QUESTIONS TO RULE ON
1. **Baseline strategy.** Is `prisma migrate resolve --applied <name>` for each already-present migration (then `migrate deploy` for the remainder) the correct approach here, or should prod be baselined from a fresh `migrate diff` squash? What is the safe ordering, and how do we verify the prod schema actually matches the expected post-migration state rather than merely being marked applied?
2. **Drift detection.** How do we prove prod's existing 17 tables are structurally identical to staging's equivalents (columns, defaults, indexes, FKs) before marking anything applied? A mismatch marked "applied" is a silent landmine.
3. **Rollback.** What is the rollback plan for a failed cutover on a DB with 244 live orders? Point-in-time restore, or forward-fix only?
4. **Sequencing vs the code deploy.** The standing rule is migration-before-code. With this many migrations, do we cut over in one window, or land the schema in stages ahead of the FF?
5. **Flag parity.** After the schema lands, should Production run `READINESS_MANIFEST_ENABLED=true` (matching what QA has proven, and gaining Outbox effectively-once delivery + staleness re-eval), or ship the legacy OFF path? Cowork's view is ON — but that path has never executed in production, so rule on what proof is required first.
6. **Timeline honesty.** Given a 2026-08-01 soft launch: is this cutover realistically completable and provable in the remaining window, or should the date move?

## 5. SECURITY ITEM (separate, please rule on severity)
Supabase reports **Row Level Security DISABLED on every table in both environments**, including prod `Order` (244), `PaymentRecord`, `Customer`, `OtpCode`, `UserSession`. Supabase's warning is that anyone holding the **anon key** can read or modify every row. Severity depends on whether the anon key is shipped to the browser (e.g. `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the client bundle) or whether the app only ever uses the service-role key server-side. **Please rule:** is this a launch blocker for a product taking real payments and storing children's names/photos, and what is the minimal correct fix (enable RLS + policies, or rotate/withhold the anon key)? Note: enabling RLS without policies would block all access — it must not be applied blindly.

## 6. OUTPUT
A recommended cutover plan with explicit ordering and verification gates, a rollback position, a ruling on §4.5 (flag parity) and §4.6 (date), and a severity ruling + minimal fix for §5.
