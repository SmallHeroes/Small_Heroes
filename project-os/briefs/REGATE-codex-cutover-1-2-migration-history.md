# CODEX RE-GATE — cutover Track 1.2: migration-history fix (the coupon landmine + the 17 EOL mismatches)

## 1. ROUTING + TARGET
- **Reviewer:** Codex. **Mode:** read-only; cite `files:lines`.
- **Branch:** `feat/chunked-generation`, commit **`cd499559`** (4 files, local — not pushed).
- **Gate: [CODEX-GATE].** This is cutover gate **1.2**, due **22/07**. It determines whether the production baseline can proceed, so a wrong call here invalidates rehearsals 24/07 and 27/07.

## 2. ORIGIN / CONTEXT
Your cutover verdict identified 18 checksum mismatches between the repo and prod's recorded migrations: **17 historical line-ending differences** and **1 substantive** — `20260707_add_coupon_code` was applied in production seeding `FIRST100` at **25%**, then its `migration.sql` was edited in place to **50%** (`02074a23`). Your instruction: restore the original file and add a corrective migration; never rewrite an applied migration.

**What CC did:**
1. **Restored** `backend/migrations/20260707_add_coupon_code/migration.sql` to its exact as-applied bytes (the `dcd14c67` blob). **Cowork verified independently by blob hash: restored = `c535d38cc4153470e263c1935daf0a29c694930d` = the as-applied blob, and distinct from the edited `58c5071e837361648726dd8acadc37c896e169e2`. Byte-identity confirmed.** The reverted edit had been an 8-line comment block plus the literal `25`→`50`.
2. **Added** a new, never-applied corrective migration `20260721_coupon_first100_50pct`: `UPDATE "Coupon" SET "discountPercent" = 50, "updatedAt" = CURRENT_TIMESTAMP WHERE "code" = 'FIRST100';` — idempotent, touching only `discountPercent`/`updatedAt`, leaving `active`/`maxRedemptions`/`confirmedCount` owner-controlled. Guarded by a new assertion in `lib/__tests__/migration-ordering.spec.ts` so it cannot run before the `Coupon` table exists.
3. **Documented** the 17 EOL mismatches in `backend/MIGRATION-CHECKSUM-DRIFT.md` and left the files untouched, with a reproducible `sha256sum`-vs-`_prisma_migrations` procedure to enumerate the exact set at gate time (the authoritative list lives in prod, not in the repo).

## 3. ⚠️ THE LOAD-BEARING QUESTION — please rule first
CC's "leave the 17 alone" policy rests on the claim that **`prisma migrate deploy` does not re-verify checksums of already-applied migrations.** Cowork does not consider this established, and it is decisive:
- If the claim is **true**, the 17 are benign audit noise and the policy is correct.
- If **false** — i.e. `migrate deploy` (or `migrate status`) fails on a modified applied migration — then those 17 will **block the cutover**, and your gate 2.4 requirement (`migrate status` clean and `migrate deploy` a no-op) is unreachable without an explicit remediation for them.
**Rule on the actual Prisma behaviour**, and if remediation is needed, specify the checksum-safe method (given that editing an applied migration is forbidden and re-recording checksums in `_prisma_migrations` is metadata-only).

## 4. VERIFY (cite files:lines)
1. **The restore is the right restore** — the `dcd14c67` blob is genuinely what production ran, and no other applied migration was altered in `cd499559` (CC reports `02074a23` touched only this file; confirm).
2. **The corrective migration is environment-agnostic** — on prod the row exists at 25 → moves to 50; on a fresh database `20260707` seeds 25 and this then sets 50. Confirm it cannot mis-fire on a database where `FIRST100` was manually adjusted, and that re-running it is a genuine no-op.
3. **Scope** — it touches only `discountPercent`/`updatedAt`; the launch's **first-100 global atomic cap** and the redemption/confirmation counters are unaffected. This is money-adjacent: confirm no coupon accounting invariant is disturbed.
4. **Ordering** — `20260721` sorts after `20260707` and after the round-6 migrations; the new ordering assertion actually enforces the dependency rather than merely asserting name order. Note the migration is **forward-dated** relative to today (19/07) — confirm that is acceptable in this repo's convention given its existing back-dating problems.
5. **No regression** — app code and copy already state 50%; end state agrees. tsc clean; 2073 passed / 45 skipped / 0 failed; migration-ordering 4/4.

## 5. MIGRATION / DATA
Production remains un-baselined (no `_prisma_migrations`). This commit only makes the repo's migration set *safe to baseline against*; the bridge itself is Track 2 (rehearsals 24/07 and 27/07). Staging already carries all prior migrations.

## 6. OUTPUT
Verdict **GO / NO-GO for cutover gate 1.2**, with an explicit ruling on **§3** first (the `migrate deploy` checksum behaviour), then §4. If §3 requires remediation of the 17, name the method and whether gate 22/07 is still achievable.
