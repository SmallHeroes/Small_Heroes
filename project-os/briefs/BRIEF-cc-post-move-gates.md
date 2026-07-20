# BRIEF (CC) — the new gates after the production move (Codex ruling, 2026-07-20)

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). ONE agent in this worktree.
- **FORWARD FIX ONLY** — no amend, no rebase, no force-push.
- **Gate: [CODEX-GATE]** for Unit 1 (a safety guard pointing at the wrong project).

## 2. SCOPE (what + why now)
Codex approved the clean-build path and confirmed the bridge/quarantine gave no runtime safety a clean build lacks. But it identified **bootstrap safety** items that the bridge plan implicitly covered and the clean path does not — plus one live defect created by the move itself.

**Unit 1 — ⚠️ URGENT: the environment-separation guard protects a deleted project.**
`lib/generation-chunked/env-separation-guard.ts:21` still hardcodes `ozxjmnzybzetqudivlbw` as production. That project **has been deleted**. So every guard that refuses to touch production is now guarding nothing, and treats the real new production (`yevwpjxqusyyaxalbvyn`) as a safe write target. **This inverts a safety mechanism.** Update the reference, and audit for any other hardcoded project ref (`ozxjmn…`) anywhere in the codebase, scripts and docs.

**Unit 2 — `vercel.json` has no `regions`.** Functions run in Vercel's default (Virginia) while the database is now Frankfurt. Pin `"regions": ["fra1"]`.

**Unit 3 — commit the baseline.** `00000000000000_init/migration.sql` and `migration_lock.toml` are currently **untracked**. Codex: until they are committed and actually executed against an empty Supabase project, this is a direction, not a gate pass. Commit them.

**Unit 4 — the deploy proof.** Codex will not accept `migrate deploy` alone (Prisma itself documents that it does not detect drift). The full proof set, all against the new empty project:
1. `prisma migrate deploy` completes from empty.
2. `migrate status` clean; a second `migrate deploy` is a no-op.
3. Schema diff against `backend/schema.prisma`.
4. Table and enum counts.
5. RLS + grants query.
6. **A read/write canary executed as the actual connecting role** — not metadata inspection. Codex's reason: `service_role` bypasses RLS, so metadata can look correct while the runtime role behaves differently. Prove the role the application actually uses can read and write every RLS-enabled table.

**Unit 5 — rebuild staging clean.** Codex ruled **rebuild, not narrow repair**. `qvksgpzzosotubcbizay`'s `_prisma_migrations` was hand-seeded by Cowork on 2026-07-18, so it is no longer a trustworthy parity source; and `init` emits unguarded `CREATE TABLE`, so `migrate deploy` against it would fail. For "prod = staging = canonical chain" it must be built from the same clean chain. *Sequence after the production proof passes — staging currently holds the test state in use.*

**Unit 6 — Storage bootstrap is its own gate.** Supabase backups do not include Storage objects, so buckets, policies and files are separate from the database proof. Define and verify: the `book-images` bucket exists with the intended public/private policy, and the application can upload, read and delete through it.

## 3. FILES / AREAS
`lib/generation-chunked/env-separation-guard.ts` (+ any other hardcoded project ref) · `vercel.json` · `backend/migrations/00000000000000_init/` + `migration_lock.toml` · a deploy-proof script or documented command set · a storage bootstrap check.

## 4. ACCEPTANCE CRITERIA
- No hardcoded reference to the deleted project remains anywhere; the guard identifies `yevwpjxqusyyaxalbvyn` as production and refuses accordingly.
- `vercel.json` pins `fra1`.
- The baseline migration and lock file are committed.
- All six proof steps in Unit 4 pass and are reported with output, including the runtime-role canary.
- Staging rebuild plan stated (execute after the production proof).
- Storage bootstrap verified independently of the database.
- `npm run check` green.

## 5. TESTS
- The guard rejects the new production ref and accepts staging — a test that would fail if the ref were stale again.
- Ordering spec still green with `init` first.
- The runtime-role canary is a real transaction, rolled back.

## 6. WHAT NOT TO TOUCH
The delivery fence and its funnel · Human-QA Slice 1 · the structural guard · the child-photo work · the held RLS migration · existing migrations. Do not revive the bridge or the quarantine — Codex ruled both **void for the launch path**, not merely superseded.

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`**; no force-push; commit per unit; **Guy pushes**.

## 8. FINAL VERIFICATION
`npm run check` green. Report each unit, with the full Unit-4 proof output. **Then STOP for the Codex re-gate.**

---
**Record (Codex ruling):** Track 1.3 quarantine and Track 2 bridge are **void for the launch path**. Track 1.2's production-repair rationale is void, **but the `FIRST100` → 50% product fix stays live** — `20260721` updates the row after `20260707` creates it. The delivery fence, Human-QA, the child-photo deletion fix and the RLS hardening are **not void**: they found real defects on the future paying-customer path.
