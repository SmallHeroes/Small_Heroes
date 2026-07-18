# Migration checksum drift — cutover Track 1.2

**Owner:** CC · **Gate:** [CODEX-GATE] · **Context:** `project-os/CUTOVER-PLAN.md` §1.2

A `prisma migrate status` run against **production** reported **18 migrations whose local checksum no longer
matches the checksum recorded in `_prisma_migrations`** at apply time. They split into two kinds. Prisma's checksum
is the SHA-256 of the `migration.sql` file bytes, recorded when the migration was applied — so ANY byte difference
(including a lone `\r`) changes it.

> **Iron rule (both kinds): never rewrite a migration that has already been applied.** A rewrite does not "fix" the
> recorded checksum — it just produces yet another checksum that still won't match what production ran, and it
> destroys the audit trail of what was actually applied. Corrections go in a NEW migration.

---

## 1. The coupon landmine — a REAL content change (fixed here)

`20260707_add_coupon_code` was applied in production seeding `FIRST100` at **`discountPercent = 25`**. Its
`migration.sql:72/83` was later **edited in place to `50`** (commit `02074a23`) — a rewrite of an applied migration.
That is the one mismatch that is NOT a line-ending artifact: the SQL genuinely differs.

**Fix applied (this change):**
1. **Restored** `backend/migrations/20260707_add_coupon_code/migration.sql` to its exact **as-applied (25%) bytes**
   (the `dcd14c67` blob — verified byte-identical, LF). Production's recorded checksum for `20260707` now matches
   the file again, so it is no longer reported as modified.
2. **Added** a new, never-before-applied corrective migration
   `backend/migrations/20260721_coupon_first100_50pct/migration.sql`:
   `UPDATE "Coupon" SET "discountPercent" = 50 WHERE "code" = 'FIRST100';` — idempotent, environment-agnostic, and
   ordered after `20260707` (guarded by `lib/__tests__/migration-ordering.spec.ts`). Production applies it as a
   pending migration and `FIRST100` becomes 50%. The 50% "product truth" already present in app code/copy (commit
   `02074a23`) is unchanged and now agrees with the DB.

**End state:** prod checksum for `20260707` matches (25%) · one pending migration `20260721` moves it to 50%.

---

## 2. The other 17 — historical line-ending drift (DOCUMENT, do not edit)

The remaining **17** mismatches are **line-ending differences only** — the SQL is byte-identical apart from `CRLF`
vs `LF`. They come from the repo's EOL churn (**no `.gitattributes`, `core.autocrlf` unset** — see `CLAUDE.md`
"Repo landmines"): early migrations were applied from a checkout whose working tree rendered `CRLF`, so production
recorded a `CRLF`-based checksum, while the blobs on `feat/chunked-generation` are `LF` today (all 44 `migration.sql`
files in this branch are currently `LF` — verified).

**These are benign and must be LEFT ALONE:**
- The applied SQL is semantically and byte-for-byte identical except for `\r`; production already ran the correct
  statements. There is nothing to correct in the database.
- **Do NOT** "normalize" them by editing the applied `migration.sql` files. Editing an applied migration is the exact
  mistake §1 exists to undo — it changes the local checksum again without ever matching the prod-recorded one, and a
  future normalization would re-drift them.
- `prisma migrate deploy` applies only PENDING migrations; a checksum difference on an ALREADY-APPLIED migration is
  surfaced by `migrate status` but is not something `deploy` re-checks or re-runs. The drift is an audit-noise item,
  not a schema risk.

**Accepted resolution at cutover:** leave the 17 as-is. If a future ops step wants the status report perfectly clean,
the only correct mechanism is to re-point production's recorded checksum to the current file (an ops action on
`_prisma_migrations`, performed by Guy, out of scope for a code change) — NOT a file edit.

**Long-term fix (prevents recurrence, post-freeze):** add a `.gitattributes` pinning `*.sql` (and ideally the repo)
to `text eol=lf`, then renormalize once. Until then, the freeze (§1.1) keeps the set stable.

### Reproducing the authoritative list of 17

The exact names live in production's `_prisma_migrations`, not in this branch (the drift is against prod's recorded
checksums, and this branch's blobs are all LF). To regenerate the precise set at gate time:

```bash
# 1) production side — the recorded checksums:
#    SELECT migration_name, checksum FROM "_prisma_migrations" ORDER BY migration_name;
# 2) local side — Prisma's checksum is sha256(migration.sql bytes). For each migration:
for d in backend/migrations/*/; do
  printf '%s  %s\n' "$(sha256sum "$d/migration.sql" | cut -d' ' -f1)" "$(basename "$d")"
done
# 3) diff (1) vs (2): 20260707 should now MATCH (restored); the 17 EOL-drift names are the rest that differ.
#    To confirm a diff is EOL-only, compare after stripping CR:  tr -d '\r' < file | sha256sum
```

Anything the diff surfaces beyond the 17 EOL cases + the (now-fixed) coupon is a NEW finding — escalate, do not edit.
