# BRIEF (CC) — cutover Track 2: the Production Reconciliation Bridge

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). Branch pre-check first. ONE agent in this worktree.
- **FORWARD FIX ONLY** — no amend, no rebase, **no force-push**.
- **Gate: [CODEX-GATE].** This produces the SQL that will be applied to a production database holding 244 orders and 70 payment records. Commit locally; STOP for the re-gate. **Nothing runs against production; the clone is the only execution target.**
- **Gates it serves:** rehearsal #1 by **24/07**, rehearsal #2 by **27/07**. This is the largest and highest-risk piece of the cutover.

## 2. SCOPE (what + why now)
Production has **no `_prisma_migrations` table at all** — Prisma migrate has never run there. The schema was created some other way. So `prisma migrate deploy` is **forbidden** (it does not detect drift and would try to apply 40+ migrations onto objects that already exist), and `migrate resolve` on "what looks present" is **forbidden** (it records metadata without proving the SQL exists).

Codex's prescribed path is a **one-time Reconciliation Bridge**: build SQL from prod's *actual* state to the target, prove equality on a real clone, and only then write the baseline metadata.

**Verified delta (2026-07-19):** prod has **17 tables**, target has **30**. Missing in prod: 13 tables + 19 columns (readiness, Outbox, safety, Human-QA, coupon, refund, delivery fence). **No prod-only tables or columns**, and every shared column is identical in type, nullability and default — so the delta is additive. That is what makes a bridge feasible.

**⚠️ The reference database must NOT be staging.** Staging was baselined by inserting rows into `_prisma_migrations` by hand (Cowork did this on 2026-07-18). That is acceptable for staging but means **staging is not a trustworthy definition of "target"** — its metadata asserts migrations ran that were never executed by Prisma. **Build the target reference as a FRESH database with the full canonical migration chain applied by `prisma migrate deploy` from empty.** Compare prod-clone-after-bridge against *that*, never against staging.

**Deliverables:**
1. **`build-bridge`** — generates the bridge SQL from an actual prod-clone state to the target. `migrate diff` may be used as raw material only; it does **not** cover seed data, RLS, grants, or backfill decisions, all of which must be handled explicitly.
2. **`assert-schema-equality`** — a machine-checked comparison producing a diff report over: tables, columns (type, nullability, default), enums and their values, indexes, foreign keys, check constraints, RLS state, grants, and seed rows. **Equality must be proven by this script, not eyeballed** — 30 tables is far past what a human review can certify.
3. **A runbook** for the two rehearsals.

**Hard constraints:**
- The bridge must be **idempotent** — running it twice on the clone must produce the same end state and prove it (that is the point of the two rehearsals).
- **No automatic backfill** of `BookReadiness` / `DeliveryOutbox` for the 244 historical orders. Historical backlog is handled by the Track-1.3 quarantine, which runs **after** the bridge.
- Baseline metadata (`migrate resolve --applied` across the canonical chain) is written **only after** equality is proven. Afterwards `migrate status` must be clean and `migrate deploy` must be a **no-op** — assert both.
- **Storage is not covered by Supabase backups.** A clone has no image objects. Note where that matters for the restore test and flag anything the bridge cannot cover.

**Sequencing question to answer explicitly (do not guess):** the Track-4 security work adds an RLS/grants migration. Does the bridge target the schema **before** or **after** that migration? Both are defensible; pick one, state it, and make the equality reference match. If you cannot resolve it cleanly, STOP and report.

## 3. FILES / AREAS
`backend/cutover/` — bridge SQL, the equality-assertion script, and the rehearsal runbook. New files only. Do **not** modify any existing migration (Track 1.2 restored `20260707_add_coupon_code` to its exact as-applied bytes; changing it again breaks the checksum match). Do not touch application code.

## 4. ACCEPTANCE CRITERIA
- The bridge is generated from **prod's actual state**, not from an assumed one, and is reproducible.
- `assert-schema-equality` proves prod-clone-after-bridge ≡ a fresh target database, across all nine dimensions listed above, and **exits non-zero on any difference**.
- Running the bridge twice on the clone yields identical results (idempotency proven, not asserted).
- After baseline: `migrate status` clean, `migrate deploy` a no-op — both asserted by the runbook.
- Zero automatic backfill; no historical order or job is touched by the bridge.
- The RLS/grants sequencing decision is stated with its reasoning.
- `npm run check` green.

## 5. TESTS
- The equality script detects a deliberately introduced difference in each of the nine dimensions (a missing index, a changed default, a wrong enum value, a missing grant, etc.) — a checker that cannot fail is worthless.
- Idempotency: bridge → assert → bridge again → assert; identical.
- A dry-run mode that reports what the bridge would change without executing.

## 6. WHAT NOT TO TOUCH
Existing migrations (especially `20260707_add_coupon_code`); application code; the frozen legacy path; the delivery fence primitives; the quarantine script. No schema changes to the canonical chain — the freeze from Track 1.1 is still in force.

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`**; no force-push; commit per deliverable on `feat/chunked-generation`; commit locally, **Guy pushes**. **Execute nothing against production** — the clone is the only target, and Guy provisions it.

## 8. FINAL VERIFICATION
`npm run check` green. Report: how the bridge was derived, the equality script's nine dimensions and its self-test results, the idempotency proof, the RLS sequencing decision, and anything the bridge cannot cover (Storage, seed, grants). **Then STOP for the Codex re-gate.**
