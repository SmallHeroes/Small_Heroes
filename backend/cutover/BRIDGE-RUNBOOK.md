# Production Reconciliation Bridge — rehearsal runbook (cutover Track 2)

**Owner:** CC (procedure) · Guy (execution + clone provisioning) · **Gate:** [CODEX-GATE] · **Rehearsals:** #1 by 24/07, #2 by 27/07.
**Nothing here runs against production. The CLONE is the only execution target.**

## Why a bridge (not `migrate deploy`)
Production has **no `_prisma_migrations` table** — Prisma migrate never ran there; the schema was created some other way. So `migrate deploy` is **forbidden** (it does not detect drift and would try to apply 40+ migrations onto objects that already exist), and `migrate resolve` on "what looks present" is forbidden (it records metadata without proving the SQL exists). Instead: build additive SQL from prod's *actual* state to the target, **prove equality on a real clone with `assert-schema-equality`**, and only then write the baseline metadata.

**Verified delta (2026-07-19):** prod 17 tables → target 30. Missing: 13 tables + 19 columns (readiness, Outbox, safety, Human-QA, coupon, refund, delivery fence). No prod-only tables/columns; shared columns identical → the delta is **additive**, which is what makes a bridge feasible.

## Deliverables (this track)
1. `scripts/build-bridge.ts` (+ `lib/cutover/bridge-build.ts`) — generates the **idempotent** bridge SQL from `migrate diff` raw material + an explicit RLS/grants/seed appendix. **No auto-backfill.**
2. `scripts/assert-schema-equality.ts` (+ `lib/cutover/schema-equality.ts`) — machine-checked equality over nine dimensions; **exits non-zero on any difference**. Self-test proves it detects a deliberate difference in each dimension.
3. This runbook.

## RLS/grants sequencing — DECISION: the bridge targets the schema **BEFORE** the Track-4 RLS/grants migration
The Track-4 security work will add an RLS/grants migration. The bridge targets the **current canonical chain (through `20260721`), which does NOT include it.** Reasoning:
1. **The Track-1.1 freeze forbids** adding Track-4's migration to the canonical chain now, so it is not part of "target."
2. **The "`migrate deploy` is a no-op" acceptance criterion** requires the bridge target to match the baselined chain exactly. If the bridge applied Track-4's RLS ahead of the chain, `migrate deploy` would still see Track-4 as pending (not a no-op), or the baseline would falsely mark an unapplied migration.
3. After baseline, **Track-4's RLS/grants migration lands post-cutover as a normal PENDING migration** via `migrate deploy` — the clean, auditable path.
4. The bridge's appendix therefore replays **only the RLS/grants already in the current chain**: `ENABLE ROW LEVEL SECURITY` on the 13 new tables (no policy — deny non-bypass roles) + `REVOKE ALL ON "AtomicOperationReceipt" FROM PUBLIC/anon/authenticated`. A drift test keeps that appendix in sync with the migrations.

**Equality reference = a FRESH database with the current canonical chain applied by `prisma migrate deploy` from empty — NEVER staging** (staging's `_prisma_migrations` was hand-seeded on 2026-07-18 and asserts migrations that Prisma never executed).

## What the bridge CANNOT cover (flagged)
- **Supabase Storage is not in the DB backup.** A clone has the database but **no image objects** — covers/pages live in Storage, not Postgres. The bridge is schema+RLS+seed only; it neither needs nor touches Storage. Consequence: a full **restore test must separately verify Storage** (bucket + object availability); a clone alone cannot prove customers' books are re-servable. Note this in the restore-test plan.
- **User data / historical rows.** The bridge inserts **zero** `BookReadiness`/`DeliveryOutbox` rows for the 244 historical orders (the Track-1.3 quarantine owns the backlog, AFTER the bridge). Seed-row equality compares only the one seeded config row (`Coupon` FIRST100); it never compares the 244 orders.
- **Grants beyond the canonical REVOKEs.** If the checker flags a grant/RLS difference on a *shared* (pre-existing) table — i.e. prod's own RLS state differs from target — that is prod-specific and must be reconciled by an explicit, reviewed addition to the appendix. The checker exists to surface exactly this; do not hand-wave it.

---

## Rehearsal procedure (run identically for #1 and #2, each on a FRESH clone)
Let `CLONE` = a fresh restore of the prod database (Guy provisions). Let `TARGET` = a fresh empty DB with `prisma migrate deploy` of the canonical chain applied.

1. **Provision.** Restore `CLONE` from the latest prod backup. Build `TARGET` from empty: `DATABASE_URL=<target> npx prisma migrate deploy` (canonical chain through `20260721`). Confirm `TARGET` has 30 tables.
2. **Dry-run the bridge.** `npx tsx --require ./scripts/shims/register-server-only.cjs scripts/build-bridge.ts --from-url=<CLONE> --to-url=<TARGET> --dry-run`. Review the printed statement counts + the appendix preview. Expect ≈13 CREATE TABLE + the ADD COLUMNs + enums + indexes + FKs; the appendix = 13 RLS + 3 REVOKE + 2 seed.
3. **Generate.** `… scripts/build-bridge.ts --from-url=<CLONE> --to-url=<TARGET> --out=backend/cutover/bridge.generated.sql`. Commit the generated SQL as a rehearsal artifact (it is derived from the clone's actual state, reproducible).
4. **Apply to the CLONE.** `psql <CLONE> -f backend/cutover/bridge.generated.sql`. (Never `TARGET`, never prod.)
5. **PROVE equality.** `… scripts/assert-schema-equality.ts --reference-url=<TARGET> --candidate-url=<CLONE>`. **Must exit 0 (EQUAL).** Any non-zero → STOP, read the diff, extend the appendix or fix the bridge, re-run from step 3. Do NOT proceed on a non-empty diff.
6. **PROVE idempotency.** Apply `bridge.generated.sql` to `CLONE` a **second** time; re-run assert-schema-equality → **must still exit 0**. (This is what the two rehearsals certify; the round-trip test `bridge-roundtrip.pg.spec.ts` proves the mechanism in CI.)
7. **Baseline metadata — ONLY after steps 5 & 6 pass.** `DATABASE_URL=<CLONE> npx prisma migrate resolve --applied <name>` for **every** migration in the canonical chain, in order (this creates `_prisma_migrations` and records each as applied, with the local checksum).
8. **Assert clean state.** `DATABASE_URL=<CLONE> npx prisma migrate status` → **no pending, no drift**. `DATABASE_URL=<CLONE> npx prisma migrate deploy` → **"No pending migrations" (a no-op)**. Both must hold; either failing aborts the rehearsal.
9. **Record.** Note the bridge line count, the equality result, the idempotency result, and the migrate status/deploy output in the rehearsal log.

## Abort / rollback
- A clone is disposable — any failure at steps 4–8 → discard the clone, fix the bridge/appendix on `feat/chunked-generation`, re-provision, re-run. Never mutate prod. Never edit an existing migration (the Track-1.1 freeze + Track-1.2 checksum match are still in force).
- Go/no-go for the real cutover requires **both** rehearsals (#1 and #2) green through step 8, on independently-restored clones.

## After the bridge (out of scope here, for sequencing awareness)
Quarantine (Track 1.3) runs **after** the bridge lands (its schema preflight already refuses to run until these tables/columns exist). Track-4's RLS/grants migration deploys later as a normal pending migration.
