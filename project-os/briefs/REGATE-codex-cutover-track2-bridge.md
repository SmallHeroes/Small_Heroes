# CODEX RE-GATE — cutover Track 2: the Reconciliation Bridge (checker + bridge + runbook)

## 1. ROUTING + TARGET
- **Reviewer:** Codex. **Mode:** read-only; cite `files:lines`.
- **Branch:** `feat/chunked-generation`. Commits **`b7211970`** (deliverable 2 — the equality checker) and **`bb04f7c1`** (deliverables 1 + 3 — the bridge and the runbook). Local; not pushed.
- **Gate: [CODEX-GATE].** This produces the SQL that will be applied to a production database holding 244 orders and 70 payment records. **Nothing has been run against production**; all PG work used throwaway containers.
- **Serves gates:** rehearsal #1 **24/07**, rehearsal #2 **27/07**.

## 2. ORIGIN / CONTEXT
Your cutover verdict forbade `prisma migrate deploy` against prod (no drift detection) and `migrate resolve` on "what looks present" (metadata only), and prescribed a one-time bridge proven on a real clone. Built in the order Cowork required — **checker first**, because a bridge cannot be proven by a checker that has never failed.

**Deliverable 2 — `assert-schema-equality`** (`lib/cutover/schema-equality.ts`, `scripts/assert-schema-equality.ts`): pure read-only catalog comparison over nine dimensions — tables, columns (type/nullability/default), enums and ordered values, indexes, foreign keys, check constraints, RLS state and policies, grants, seed rows. Exits non-zero on any difference. **Self-test: 11/11 against a throwaway `postgres:16`** — it proves EQUAL on identical schemas, then detects a deliberately injected difference in **each of the nine dimensions**.

**Deliverable 1 — `build-bridge`** (`lib/cutover/bridge-build.ts`, `scripts/build-bridge.ts`): `migrate diff` supplies only additive schema DDL (dims 1–6) and is treated as raw material; `makeIdempotent()` rewrites it (`CREATE TABLE/INDEX/SEQUENCE → IF NOT EXISTS`, `ADD COLUMN → IF NOT EXISTS`, `CREATE TYPE`/`ADD CONSTRAINT → guarded DO block`, `ADD VALUE → IF NOT EXISTS`). Dims 7–9, which `migrate diff` misses entirely, are a **curated appendix** with a drift test against the canonical chain: RLS `ENABLE` on the 13 new tables (no policies), the `AtomicOperationReceipt` REVOKEs, and the single `Coupon` FIRST100 seed. **Zero backfill** — a test asserts no historical-row write.

**Deliverable 3 — `BRIDGE-RUNBOOK.md`**: provision clone + fresh target → dry-run → generate → apply → prove equality → re-apply → prove idempotency → baseline only after equality → assert `migrate status` clean and `migrate deploy` a no-op.

**Round-trip proof:** a clone that is a genuine additive subset (6 dimensions differ) → apply the bridge → **equal across all nine** → re-apply → **still equal**. Idempotency proven, not asserted. Suite: 2101 passed / 60 skipped / 0 failed; tsc clean.

## 3. VERIFY (cite files:lines)
1. **The checker is adequate for what the bridge does** — nine dimensions is the right set, the self-test injections are representative, and nothing the bridge changes falls outside the checker's coverage.
2. **⚠️ Name-keyed idempotency guards.** `ADD CONSTRAINT → guarded DO block` and the `CREATE TYPE` guard key on **name**. If prod holds an object with the same name but a **different definition**, the guard silently skips it. Cowork's read is that the checker then catches it (the `check_constraints` and `columns` dimensions compare definitions, and the runbook always checks after applying) — **confirm that reasoning holds for every guarded construct**, or name the case where a divergent same-named object survives undetected.
3. **The curated appendix is faithful and complete** — the RLS/grants/seed inventory matches the canonical chain exactly, and the drift test would actually fail if the chain changed.
4. **No backfill** — the bridge writes no `BookReadiness`/`DeliveryOutbox` row for the 244 historical orders; the Track-1.3 quarantine (which runs **after** the bridge) owns the backlog.
5. **Baseline ordering** — `migrate resolve --applied` happens only after proven equality, and the post-conditions (`migrate status` clean, `migrate deploy` no-op) are actually asserted rather than described.

## 4. THE RLS DECISION — and the one thing Cowork could not verify
CC decided the bridge targets the schema **BEFORE** the Track-4 RLS/grants migration: the Track-1.1 freeze forbids adding Track-4 to the chain now, and targeting *after* would break the "`migrate deploy` no-op" criterion. Track-4 then lands post-cutover as a normal pending migration. **Cowork supports this** — the bridge should close the structural delta only; RLS is a behavioural security change deserving its own gate and rollback, and bundling it means a failure in either part rolls back both. **Please confirm or overrule.**

**The safety question it raises, and what Cowork verified:** the bridge enables RLS on 13 tables **with no policies**. If the application's runtime role does not bypass RLS, production instantly loses access to those tables. Verified directly:
- **Staging is empirical proof** — `AtomicOperationReceipt` has RLS on, **0 policies, 111 rows**, and the app writes to it; likewise `QualityEvidence` (47 rows) and `BookReadinessManifest` (5 rows).
- **Both environments:** every `public` table is owned by **`postgres`**, and **`FORCE ROW LEVEL SECURITY` is false everywhere** — so the owner bypasses RLS.

**⚠️ The gap Cowork cannot close:** whether **production's `DATABASE_URL` connects as the owner role (`postgres`)**. Environment variables are not readable from here. If prod connects as a non-owner role, applying the bridge locks the application out of 13 tables at cutover. **Rule on whether this must be a hard, verified precondition in the runbook** (Cowork's position: yes — it should be an explicit preflight assertion, not an assumption inherited from staging).

## 5. MIGRATION / DATA
No change to the canonical chain (Track-1.1 freeze respected); new files only. `20260707_add_coupon_code` remains at its exact as-applied bytes from Track 1.2 — untouched.

## 6. PROOF BOUNDARY
Proven at a real DB: the checker's nine dimensions (11/11) and the bridge round-trip including idempotency. **Not covered:** Supabase **Storage is not in a DB clone**, so a restored clone has no image objects — the restore test must verify buckets/objects separately, and the bridge cannot cover them. Neither the bridge nor the checker has been run against production or a production clone.

## 7. OUTPUT
Verdict **GO / NO-GO for cutover Track 2**, P0/P1/P2 as `files:lines`, plus explicit rulings on §3.2 (name-keyed guards vs divergent same-named objects), §4 (the pre-Track-4 RLS target, and whether the owner-role precondition must be a hard runbook assertion), and §6 (what Storage verification the rehearsals must include).
