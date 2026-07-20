# BRIEF (CC) — the baseline migration: make the canonical chain deployable from empty

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). Branch pre-check first. ONE agent in this worktree.
- **FORWARD FIX ONLY** — no amend, no rebase, no force-push.
- **Gate: [CODEX-GATE].** This defines the schema every future environment is built from.
- **This is the critical path.** Nothing else in production setup can proceed until the chain deploys from empty.

## 2. SCOPE (what + why now)
**The plan changed. Read `project-os/CUTOVER-PLAN.md` first — it was rewritten today.**

The Reconciliation Bridge, the quarantine, and the migration-history archaeology are **cancelled**. The premise behind them was wrong: the `ozxjmnzybzetqudivlbw` project was never live, holds only development data (orders stop on 2026-06-18, the day staging was created), has **no real customer payment** (67 `fake`, 2 self-test Stripe records), and no book that needs to stay accessible. Confirmed by Guy. Production will therefore be **built clean in a new `eu-central-1` project**, not reconciled.

**What survives from Track 2 is exactly one thing: your P0-1 finding.** The canonical chain cannot deploy from an empty database — `20260420_align_illustration_style_enum/migration.sql:3` only ALTERs an existing enum, and `20260420_correct_historical_style_mapping/migration.sql:4` runs `UPDATE "Order"` against a table nothing created. That was correct and it is now the blocker for everything.

**Required:** an initial migration at the front of the chain that creates the pre-chain schema, so `prisma migrate deploy` succeeds from empty and produces the correct final schema.

**Simplification you now have that you did not have before:** the baseline no longer needs to reproduce some historical production state byte-for-byte — nothing is being reconciled against. It only needs to be *correct*: the chain, run from empty, must yield the target schema.

**Design choice to make and justify (do not decide silently):**
- **(A) Prepend an `init` migration** representing the pre-chain state, leaving the existing 43 migrations untouched. Preserves history; keeps staging's recorded chain coherent. **Cowork's preference.**
- **(B) Squash the whole chain into a single `init`.** Cleanest result, but discards history and diverges from staging, whose `_prisma_migrations` already records the full chain (hand-seeded by Cowork on 2026-07-18 — a further reason not to disturb it).
Pick one, state the reasoning, and flag anything it makes harder later.

## 3. FILES / AREAS
`backend/migrations/` — the new initial migration only. **Do not edit any existing migration.** `backend/schema.prisma` is the reference for the target shape. Reuse `lib/cutover/schema-equality.ts` (the checker survives) for the proof.

## 4. ACCEPTANCE CRITERIA
- `prisma migrate deploy` runs to completion against a **genuinely empty** database.
- The resulting schema is proven equal to the target by `assert-schema-equality` across all nine dimensions — not eyeballed.
- Running the chain twice (fresh DB, then again) behaves correctly; a second `migrate deploy` is a no-op.
- The data-effecting migrations in the chain (`20260420_correct_historical_style_mapping`, `20260720_outbox_fence_reconcile`) execute without error on an empty database — they must be no-ops there, not failures.
- No existing migration file is modified.
- `npm run check` green.

## 5. TESTS
- Deploy the chain from empty against a throwaway `postgres:16` (Docker is available on Guy's machine — request the run) and assert equality with the checker.
- Assert the second `migrate deploy` is a no-op and `migrate status` is clean.
- Assert each data migration is safe against zero rows.

## 6. WHAT NOT TO TOUCH
Existing migrations · the delivery fence and its funnel · Human-QA Slice 1 · the structural guard · the child-photo work · the held RLS migration · application code. Do **not** revive the bridge or the quarantine.

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`**; no force-push; commit locally; **Guy pushes**. Run nothing against any live project.

## 8. FINAL VERIFICATION
`npm run check` green. Report: the design choice (A or B) with reasoning, how the baseline was derived, the from-empty deploy output, the equality proof, and the no-op assertions. **Then STOP for the Codex re-gate.**
