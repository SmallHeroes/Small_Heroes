# P1-e2 checkpoint — Codex's 6 deeper blockers + retry-exhaustion + 2 simplifications

**Branch:** `feat/chunked-generation` · **Status:** 4 commits, green per-commit (`npm run check`: 838 pass, 2 skipped = the staging-DB specs). Flag `READINESS_MANIFEST_ENABLED` default-OFF · **zero renders · zero chunk-runner wiring** (verified: chunk-runner.ts untouched).

| Commit | Blocker(s) |
|---|---|
| `bdef2f67` | **B5** readUrl |
| `c64d95fd` | **B1** + **B2** + **B3**(allowlist + retry-cap) + **Simplification A** |
| `f6703c6a` | **B4** + **Simplification B** (inputVersion) |
| `39027fcf` | **B6** + the 2 real-DB tests |

## What each fix does
- **B1 (lost-lease can still send).** `processDelivery` now renews the lease + RE-CONFIRMS ownership with a fenced write (`status='processing' AND attempts===token`) **immediately before `send`**. Lost lease → matches 0 rows → STOP; `send` is never called. Test asserts the real call-order (`send` not invoked), not a post-hoc check.
- **B2 (`markBaseBookStale` could stomp a new manifest; `integrity_now_*` only suppressed).** recheck returns `{invalidateReadiness, expectedManifestId}`. `markBaseBookStale` is conditional on `currentManifestId===expectedManifestId` (never overwrites a newer manifest) and only un-readies the order when that applied **AND** no Outbox row is `sent`. A now-corrupt/deleted asset (`integrity_now_*`) now invalidates readiness + drops the order from `ready`.
- **B3 (blacklist not fail-closed; unbounded retry).** recheck is an **allowlist — only `status==='ready'` may send** (generating/paid/draft now suppress). A recheck stuck on `retry` is capped by `OUTBOX_MAX_ATTEMPTS` → terminal `failed`.
- **B4 (TOCTOU not closed; payload not bound).** **Simplification B:** monotonic `Order.inputVersion` (recorded on the manifest). The `Order→ready` commit is a conditional `updateMany WHERE inputVersion=evaluated` → a concurrent bump aborts the tx (TOCTOU) and re-evaluates; the pre-send recheck suppresses+invalidates when `inputVersion` moved. **Payload binding:** the commit-time fingerprint now covers ALL payload fields (email/name/child/readUrl/pdf/firstAudio), and the worker passes the enqueued `payloadHash` into the recheck, which rebuilds the live payload with the same builder and suppresses (`payload_changed_since_enqueue`) on drift. Writer-side `inputVersion` bumps are **P1-f** (until then it stays 0 → guard inert, never falsely suppresses). No chunk-runner wiring.
- **B5 (readUrl substring match).** `isCanonicalReadUrl`: exact `origin===app origin`, `pathname===ROUTES.ready`, `?orderId===orderId` (fail-closed if no app origin). `https://evil.example/steal?x=<orderId>` now rejected.
- **B6 (Supavisor proof skipped/weak).** Hardened the SKIP-LOCKED staging test: `assertEnvSeparation()` first; claim **scoped to seed rows** (unique marker, mirrors `claimDueDeliveries`); asserts the two claimers' seed-claims **union==4 AND intersection==∅**. Added a **2-connection** `inputVersion` proof (two separate `PrismaClient`s: A reads → B bumps+commits mid-eval → A's conditional commit matches 0 rows → abort).
- **Simplification A:** worker claims **one row per tick** (`drainOutbox`/cron `limit:1`).

## Live B6 run — DONE ✅ (2026-06-29, staging `qvksgpzzosotubcbizay`, Supavisor :6543 pgbouncer=true)
Both gated specs ran against the real staging DB and PASSED + self-cleaned (0 leftover rows):
- `readiness-inputversion.staging.spec.ts` — 2-connection inputVersion abort proof (7.5s).
- `delivery-outbox-skiplocked.staging.spec.ts` — Supavisor SKIP-LOCKED, union==4 ∧ intersection==∅ (10.9s).

**Migration note (action for Guy/Codex):** staging had **no `_prisma_migrations` table** (it was bootstrapped via `db push`) and was missing the 3 readiness tables — so `prisma migrate deploy` was NOT usable (it would replay all 21 migrations and fail on already-existing objects). Instead the two migrations' SQL was applied directly via `prisma db execute` against the staging DIRECT_URL: `20260629_base_book_integrity` (fully idempotent — `CREATE … IF NOT EXISTS`, `CREATE TYPE … EXCEPTION`) then `20260629_add_input_version` (made idempotent in `2da7294b`). New tables are inert (flag OFF). **Recommend**: baseline staging's migration history (`prisma migrate resolve --applied …` for the already-present migrations) so future `migrate deploy` works — separate from this work.

## Next: P1-f
Writer-side `inputVersion` bumps wired into the producers. Now unblocked.

## Approved / untouched (per brief): B4/B6/B7/B2-taxonomy from P1-e — not modified.
