# PRODUCTION CUTOVER — execution plan (Codex-approved, 2026-07-19)

**The decision this implements:** production moves to **readiness-only**. The legacy direct-send path is deleted, not hardened. **There is no launch via legacy and no fallback to it.**

**Codex's estimate:** 5–7 focused engineering days + 48h soak. **2026-08-01 is possible but RED and conditional.**

**Live production state (verified 2026-07-19):** 17 tables, **no `_prisma_migrations` at all**. 244 orders · 190 books · 1,540 pages · 1,187 assets · **70 payments** · 43 customers · 135 jobs. Non-terminal backlog: **19 orders `generating`, 1 `paid`, 3 jobs `running`.** Staging: 30 tables, 43 migrations. Delta = 13 tables + 19 columns missing in prod; **no prod-only objects**, all shared columns identical in type/nullability/default.

---

## GATES (miss one → the launch date moves)

| Date | Gate | Owner |
|---|---|---|
| **22/07** | Containment + migration freeze complete | Guy declares · CC executes |
| **24/07** | Rehearsal #1 green on a real prod clone | CC |
| **27/07** | Rehearsal #2 green + readiness-only code green on staging | CC · Codex re-gate |
| **29/07** | Production canary green | Guy · Cowork |
| +48h soak | Open checkout + generation to customers | Guy |

---

## TRACK 1 — CONTAINMENT & FREEZE (by 22/07)

**1.1 Freeze.** No new migrations, no schema edits on any branch until the bridge lands. Declare it explicitly — an unnoticed migration during the bridge invalidates the rehearsals. *Owner: Guy.*

**1.2 Fix the migration history — the coupon landmine.** `20260707_add_coupon_code` was applied at **25%** and later **edited** to 50% (`migration.sql:72`). **Never rewrite an applied migration.** Restore the original file to its as-applied content, then add a NEW corrective migration for the 50% value. The other 17 checksum mismatches are historical line-ending differences — document them; do not "fix" them by editing applied files. *Owner: CC. [CODEX-GATE].*

**1.3 Quarantine design.** 19 `generating` + 1 `paid` orders and 3 `running` jobs exist in prod. The sweeper collects any stale pending/running job the moment generation is enabled — meaning cutover would begin by trying to resume 19 stale orders against a schema they never knew. Design an **explicit quarantine** (terminal park + manual register), **never auto-resume**. Note `safetyVerified=false` (migration `20260715_safety_hold_signal`) would block old assets if reintroduced — that is the fail-closed behaviour we want, and the reason auto-resume is forbidden. *Owner: CC.*

---

## TRACK 2 — THE RECONCILIATION BRIDGE (rehearsals 24/07, 27/07)

**Forbidden:** `prisma migrate deploy` against prod (it does not detect schema drift) and `migrate resolve` on "what looks present" (it records metadata without proving the SQL exists). *Cowork used the metadata-insert approach on **staging** — acceptable there, **prohibited on production**.*

**2.1 Real clone.** Restore prod to a new project (verify `restore-to-new-project` capability in advance). **Supabase backups do NOT include Storage objects** — plan image/asset handling separately. *Owner: CC + Guy (Supabase console).*

**2.2 Build the SQL bridge** from prod's **actual** state to the target. `migrate diff` is raw material only — it does not cover seed data, RLS, grants, or backfill decisions. *Owner: CC.*

**2.3 Run the bridge TWICE on the clone** and prove full equality vs. target: tables, columns, defaults, enums, indexes, FKs, checks, RLS, grants, seed. Twice = proves idempotency. *Owner: CC. Verification: Cowork via the Supabase connector, independently of CC's own report.*

**2.4 Baseline metadata — only after the DB is proven identical.** `migrate resolve --applied` for the canonical chain, then `migrate status` must be clean and `migrate deploy` must be a **no-op**. *Owner: CC. [CODEX-GATE].*

**2.5 No automatic backfill** of `BookReadiness` / `DeliveryOutbox` for the 244 historical orders. Quarantine per 1.3. *Owner: CC.*

---

## TRACK 3 — READINESS-ONLY CODE (green on staging by 27/07)

**3.1 Delete the legacy direct-send path.** `package-delivery.ts` — remove the flag split and the direct `sendBookReadyEmail`. **`READINESS_MANIFEST_ENABLED=false` must STOP delivery, not fall back to legacy.** This also retires the round-6 legacy P0 by deletion. *Owner: CC. [CODEX-GATE].*

**3.2 Outbox cron must not be flag-gated off** in the readiness-only world (`app/api/generate/cron/outbox/route.ts:28` currently no-ops when the flag is off). *Owner: CC.*

**3.3 Close the open round-6 re-gate items** (Units A–D verdict, incl. whether Unit C needs a real-PG proof). *Owner: Codex.*

---

## TRACK 4 — SECURITY P0 (parallel, not blocking the bridge)

**4.1 Data API disabled** — both projects. ✅ *Done 2026-07-19.* Closes anon-key exposure of all prod tables. Verified beforehand: no `supabase-js` table access exists in the codebase; Storage is a separate service and is unaffected.

**4.2 Canonical RLS migration** — enable RLS, revoke `anon`/`authenticated` grants, revoke default privileges, then verify the Prisma runtime role still works. Never enable RLS without policies. *Owner: CC. [CODEX-GATE].*

**4.3 ⚠️ Child photos are in a PUBLIC bucket.** `book-images` is public in both environments; the child's photo is returned as a public URL and stored, and post-generation deletion is non-fatal (so a failed delete leaves it exposed). **Table RLS does not protect a public bucket.** Move the photo source to a **private bucket**, store a storage key instead of a URL, and generate a **signed URL at use time**. For a children's product taking payments this is the highest reputational exposure in the whole audit. *Owner: CC. Priority: immediately after 4.2.*

---

## TRACK 5 — CANARY & SOAK (29/07 →)

**5.1 Maintenance mode** — checkout and generation closed; `ENABLE_PROD_GENERATION=false`.
**5.2 Backup** — encrypted logical backup **plus a restore test**, and a verified clone/PITR. Storage handled separately (5.1 note in 2.1).
**5.3 Apply bridge + baseline** (Track 2).
**5.4 Quarantine** the historical backlog (Track 1.3).
**5.5 Deploy readiness-only code** (Track 3).
**5.6 Enable** `READINESS_MANIFEST_ENABLED=true`; verify `CRON_SECRET`, the Outbox cron, and the Human-QA crons (`vercel.json`).
**5.7 One internal canary order in production** — render → safety → readiness manifest → Outbox → CAS → Human-QA hold path → **exactly one email**.
**5.8 48h soak.** Only then open checkout and generation to customers.

**Rollback.** Before external traffic: PITR/clone restore, or temporarily run the old code over the expanded schema. **After payments or emails exist, blind restore is dangerous** (it can delete orders and duplicate external side effects) → default to **forward-fix with reconciliation** against PayMe, Resend and Storage.

---

## PARALLEL, NOT ON THE CRITICAL PATH
- Human-QA console (Slice 2) — Cursor, read-only, **not started**.
- Human-QA operator actions (Slices 3+4) — brief written; blocked on the console and on Codex's safety-release ruling.
- Set Identity Board proof — `SET_IDENTITY_BOARD=true` on Preview; run a fresh fox order on QA and verify the bind.
- `main` FF (314 behind) and remaining branch cleanup — post-launch hygiene.
