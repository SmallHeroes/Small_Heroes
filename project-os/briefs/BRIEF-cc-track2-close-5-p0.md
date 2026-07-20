# BRIEF (CC) — Track 2: close the five P0s (baseline migration · checker soundness · hard allowlist · data-migration proof · role preflight)

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). Branch pre-check first; HEAD `bb04f7c1`. ONE agent in this worktree.
- **FORWARD FIX ONLY** — no amend, no rebase, **no force-push**.
- **Gate: [CODEX-GATE].** Produces the SQL applied to a production database with 244 orders and 70 payment records. Commit per unit; STOP for the re-gate. **Nothing runs against production.**
- **Blocks:** rehearsal #1 (24/07). Treat as the critical path.

## 2. SCOPE (what + why now)
Codex NO-GO on Track 2 with five P0s. The architecture is accepted; the implementation can declare `EQUAL` on non-equivalent databases, and the runbook's reference target cannot be built at all.

**⚠️ P0-1 originates in Cowork's brief, not in your work.** I instructed you to build the reference as "a fresh database with the full canonical chain applied by `prisma migrate deploy` from empty". **That is impossible:** the chain has no initial migration creating `Order` and the core tables — the first only ALTERs an existing enum (`20260420_align_illustration_style_enum/migration.sql:3`) and the second runs `UPDATE "Order"` (`20260420_correct_historical_style_mapping/migration.sql:4`), which fails on an empty database. My instinct (do not trust hand-baselined staging as the definition of truth) was right; the alternative I prescribed was unbuildable.
**Fix:** author an **initial baseline migration** representing the pre-chain database state, per Prisma's baselining workflow, so the canonical chain *can* be deployed from empty. That baseline migration is then the first entry in the chain and the reference target becomes buildable. It must reproduce the pre-chain state exactly — derive it from the actual structure, not from the current schema.

**P0-2 — the checker can return a false `EQUAL`.** Close every gap Codex named:
- `columns` compares only `udt_name`, nullability and default — add **varchar length, numeric precision/scale, identity/generated, collation** (`schema-equality.ts:97`).
- **Sequences are not checked at all**, yet the bridge emits `CREATE SEQUENCE` (`bridge-build.ts:71`).
- FK and CHECK are keyed by `conname` alone; constraint names repeat across tables — **key by table + name** (`schema-equality.ts:101`).
- Add **PK/UNIQUE/EXCLUDE semantics, deferrability, validation, ownership**.
- Policies must compare **`permissive`**; RLS must compare **table ownership** (`schema-equality.ts:103`).
- **`role_table_grants` omits privileges held via `PUBLIC`** (`schema-equality.ts:105`) — so the checker **cannot verify the `REVOKE ... FROM PUBLIC` the bridge itself performs.** Query the ACLs directly (e.g. `pg_class.relacl` / `information_schema` alternatives) so PUBLIC-derived grants are visible.
**Extend the nine-dimension self-test to cover every new sub-dimension** — each must be proven detectable by injection, as before.

**P0-3 — make "additive only" an enforced invariant.** Unknown statements are currently returned unchanged (`bridge-build.ts:60`), so a `DROP`, type change or rename from `migrate diff` can enter the bridge; the dry-run only counts statements (`build-bridge.ts:47`). **Implement a hard allowlist: any statement not matching an approved `CREATE`/`ADD` form fails the build.** Also: the runbook applies via `psql -f` with **no `ON_ERROR_STOP` and no transaction boundary** (`BRIDGE-RUNBOOK.md:38`) — a mid-failure leaves a partial bridge. Wrap the apply in a single transaction with `ON_ERROR_STOP=1`, and **delete the atomic-rollback claim** where it is not actually true.

**P0-4 — the baseline does not prove data migrations ran.** The checker compares three fields of `FIRST100` (`assert-schema-equality.ts:16`), then the runbook marks the whole chain applied (`BRIDGE-RUNBOOK.md:41`) — so data migrations can be skipped without proof, notably the historical style mapping (`20260420_correct_historical_style_mapping`) and the Outbox fence reconcile (`20260720_outbox_fence_reconcile`). **Enumerate every data-effecting migration in the chain and prove its effect is present in the data before baselining it as applied.** Note `migrate status` checks migration *history*, not schema drift — do not treat it as a drift check.

**P0-5 — the runtime-role check becomes a hard precondition.** The bridge enables RLS with no policies on 13 tables (`bridge-build.ts:17`) and the app connects directly via `DATABASE_URL` (`schema.prisma:8`). Without owner membership, `BYPASSRLS` or superuser the result is **default-deny**. Implement a preflight that, **using production's exact runtime `DATABASE_URL`**, asserts `current_user`, `rolsuper`, `rolbypassrls`, and ownership/role-membership for all 13 tables — **followed by a read+write canary inside a transaction that is rolled back.** Fail closed.

**Also required:**
- **Round-trip proof is insufficient** — it uses hand-written DDL and a manual appendix, not real `migrate diff` output through the full `assembleBridge()` (`bridge-roundtrip.pg.spec.ts:26`). Rebuild it end-to-end on the real path.
- **Drift test is not a completeness proof** — it checks limited regexes and substrings (`bridge-build.spec.ts:72`). Strengthen it, or state precisely what it does and does not prove.
- **No-backfill test uses mock DDL** (`bridge-build.spec.ts:56`) — assert against the real diff.
- **Storage gates (both rehearsals):** (1) a full bucket/key/size/hash manifest; (2) zero-missing reconciliation against every URL in `Order`, `GeneratedBook`, `BookPage`, `ImageAsset`, `AudioAsset`; (3) isolated Storage restore/copy with count, bytes and hash comparison; (4) real GETs of public and signed assets plus an upload/download/delete canary **in the rehearsal environment only**.

## 3. FILES / AREAS
`backend/migrations/` (the new baseline migration only — no existing migration may be edited) · `lib/cutover/schema-equality.ts` + its self-test · `lib/cutover/bridge-build.ts` + tests · `scripts/build-bridge.ts` · `scripts/assert-schema-equality.ts` · a new role-preflight script · `backend/cutover/BRIDGE-RUNBOOK.md`.

## 4. ACCEPTANCE CRITERIA
- The canonical chain deploys **from an empty database** and produces the reference target.
- The checker detects an injected difference in **every** dimension and sub-dimension, including sequences, varchar length, numeric precision, identity/generated, collation, table-qualified constraint identity, deferrability/validation, ownership, policy permissiveness, and **PUBLIC-derived grants** — proven by self-test.
- Any non-allowlisted statement **fails the build**; the apply is transactional with `ON_ERROR_STOP=1`.
- Every data-effecting migration's effect is verified in data before it is marked applied.
- The role preflight fails closed and includes a rolled-back read+write canary.
- The round-trip test runs the real `migrate diff` → `assembleBridge()` path.
- `npm run check` green.

## 5. TESTS
Injection tests for every new checker sub-dimension · an allowlist test proving a `DROP`/rename/type-change is rejected · a transactional-apply test proving a mid-failure leaves nothing applied · a data-migration verification test · a role-preflight test for each failure mode (non-owner, no bypass, missing membership) · the end-to-end round-trip on the real diff path.

## 6. WHAT NOT TO TOUCH
Existing migrations (especially `20260707_add_coupon_code`, restored to its as-applied bytes in Track 1.2) · application code · the frozen legacy path · the delivery-fence primitives · the quarantine script.

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`**; no force-push; commit per P0 unit on `feat/chunked-generation`; commit locally, **Guy pushes**. **Execute nothing against production.**

## 8. FINAL VERIFICATION
`npm run check` green. Report: how the baseline migration was derived and proof the chain deploys from empty; the full checker dimension list with self-test results per sub-dimension; the allowlist's rejected forms; the transactional apply; the data-migration verification method; the role-preflight output shape; and the rebuilt round-trip. **Then STOP for the Codex re-gate.**
