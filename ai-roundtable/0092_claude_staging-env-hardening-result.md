TYPE: RESULT
AUTHOR: Claude Code
DATE: 2026-06-18
RELATED: 0089 (brief — staging/QA env hardening, P0), 0091 (staging Supabase migrate), 0085 (consult — prod render architecture + environments), 0088 (style-refs fix awaiting cloud render)

# 0092 · 0089 P0 DONE — minutes-cron + env-separation guard; cleanup; check green (executes 0089)

Executor = Claude Code. `npm run check` **green (563/563)**. Three commits on
`feat/chunked-generation`. **NOT merged to main; prod/domain/password untouched.**

## P0a — cron cadence (commit `f2dc653d`)
`vercel.json` cron `/api/generate/cron/sweep`: `0 3 * * *` → **`*/3 * * * *`**. On Pro this means a
stalled chunked job (self-chain dropped + customer off the status page) resumes within ~3 minutes
instead of waiting until 3am.

## P0b — env-separation guard (commit `f2dc653d`)
New `lib/generation-chunked/env-separation-guard.ts` → `assertEnvSeparation()`, called first thing in
`chainGenerationWorker` (chain-worker.ts) — the fan-out path that POSTs the next worker via
`NEXT_PUBLIC_APP_URL`/`APP_URL` and whose pipeline writes to `SUPABASE_URL`.
- **Throws / refuses to run** when a **non-production** runtime is pointed at a **prod resource**:
  - app URL host = `smallheroes.co.il` / `www.smallheroes.co.il`, OR
  - `SUPABASE_URL` host contains the prod project ref `ozxjmnzybzetqudivlbw`.
- "Production" = `VERCEL_ENV === 'production'` only; Preview, local, and tests are non-prod. **No-op on
  Vercel Production** (prod may use prod). **No override env** — failing loud is the point.
- Prod identifiers are **literals** (not env-configurable) so a leaked prod value can't be allow-listed away.
- Note on "bucket": the bucket name is identical across envs (`book-images`), so the project is
  identified by `SUPABASE_URL`, not the bucket string — checking the URL ref is the correct discriminator.
- Both callers (`process-worker.ts`, `start.ts`) treat the fan-out as fire-and-forget, so the synchronous
  throw surfaces to the route = the run refuses to continue into prod. +6 unit tests
  (`__tests__/env-separation-guard.spec.ts`): prod-domain → throw, prod-Supabase → throw, staging → ok,
  Vercel Production → ok, APP_URL fallback, clean local → ok.

## Bucket note (per Guy)
`book-images` is **already created in staging via API** — did **not** attempt to recreate (this closes
the one open item from 0091).

## Cleanup (worktree triage)
- **Red baseline fixed + committed separately** (commit `77cc517e`, `fix(power-cards)`): HEAD was **red**
  on 2 power-card tests — the v5 koko bedtime/fantasy files were renamed to `*.superseded.md` and the
  canon moved to `v3-approved` (that rename IS committed), but the matching golden-shelf test + bank-index
  fix was uncommitted WIP. Since Cursor is out and a red baseline blocks the green-check gate, I landed the
  minimal, coherent supersession fix: `goldenShelfStoryRelPath` + `GOLDEN_SHELF_FILENAME_OVERRIDES`
  (koko fantasy → superseded copy, powerCard dev parse only) in shelf.ts; `V5_SUPERSEDED_STORY_FILENAMES`
  + `isSupersededV5StoryFilename` in story-bank-index.ts; specs updated to use `goldenShelfStoryRelPath`;
  +tests (flag-off → null, flag-on → v3-approved served). Files: `backend/providers/story-bank-index.ts`,
  `lib/power-cards/{index,shelf}.ts`, `lib/power-cards/__tests__/power-card-parse.spec.ts`,
  `lib/__tests__/{power-card-gender-slash,production-qa-escape-hatches,v3-approved-bank}.spec.ts`.
- **story-pipeline content drafts → stashed out of the way** (Cursor WIP, do not ride along in merge):
  `git stash` entry **"story-pipeline content drafts (Cursor WIP; stashed by 0089 cleanup)"** holds the
  modified `story-pipeline/02_prompts/drafts/chameleon_koko__fantasy.bank.md` + untracked drafts
  (`bunny_ometz__bedtime.bank.md`, `*_REANGLE.premises.md`, `chameleon_koko__adventure.bank.md`,
  `fox_uri__adventure.bank.md`, `04_ALL_18_STORIES_FOR_REVIEW.md`, `04_bank_review/`,
  `05_GOLDEN_QA_ACTION_PLAN.md`, `06_PROD_READINESS.md`). Recover with
  `git stash pop` (or `git stash list` to find it). These are pure content `.md` — not imported, no effect
  on check/build/deploy.
- **Left untouched:** `ai-roundtable/0059_*.md` (a doc append by another author — not mine to alter; no
  effect on check).

## Verification
- `npm run check` → **563/563 green**, tsc clean (with the supersession fix + P0 in tree; story-pipeline
  drafts stashed don't affect it).
- Acceptance (0089): cron is minutes-frequency on Pro ✅; the guard refuses staging-against-prod ✅;
  check green ✅.

## Status / next (gated)
P0 done. Remaining 0089 items are **P1** (pre-`BUY_MODE=live`, not blocking the QA env): observability
on `generationJob.status=failed`/lease-expiry, `PAGE_IMAGES_PER_CHUNK` configurable (default 1 for HIGH),
and the child-photo **private bucket + signed URLs** prod hardening (also flagged in 0091).
Sequence now: Guy sets Vercel **Preview** env vars (staging `DATABASE_URL`/`SUPABASE_*`/
`SUPABASE_STORAGE_BUCKET=book-images`/`NEXT_PUBLIC_APP_URL`=Preview domain) → **cloud render smoke**
(proves the 0088 Style01/companion ref-load fix) → Q5 dress rehearsal. Not done here.
