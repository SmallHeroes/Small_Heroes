# Consolidation Ledger

Records, per merged feature, the **replacement target SHA** on `feat/chunked-generation` (the render/golden
path). Nothing is deleted until its replacement SHA is recorded here (archive/delete is a later phase).

Source plan: `PLAN-consolidation-to-main.md` (Codex consolidation audit). CC performs merges locally; **Guy pushes**.

## Phase 1 — foundation (worktree `sh-wt-style01`, target `feat/chunked-generation`)

Pre-Phase-1 target tip: `7093f890` (narration niqqud coverage).

### Step 2 — reconcile `origin/main` → target

| feature (source) | replacement / representation on target |
|---|---|
| `origin/main@fdfd2469` — "Fix/otp email template (#20)" + prod DATABASE_URL rebuild (`78d4634f`) | **already fully represented on target.** Reconcile merge **`dbb1f9e8`** (2-parent, `--no-ff`); merged tree is **byte-identical to `7093f890`** (0 net content change). Records main as merged so future reconciles don't re-conflict. |

**Conflict resolutions (6 regions, rule = retain newer TARGET behavior — all obvious keep-target):**
- `app/landing/landing-page.tsx` — keep target's `data-reveal` scroll animations + staggered delays (main had plain cards = a regression).
- `backend/lib/email.ts` — keep target's `QaWarnings` (qa-soft-deliver) import (main lacked it).
- `app/api/generate/status/route.ts` — keep target's durable `runAfterResponse(sweepStaleGenerationJobs)` — main had the old `void sweep…` non-durable anti-pattern that caused the stall.
- `lib/generation-pipeline/runtime-artifact-store.ts` — keep target's fuller cross-OS committed-bundle path handling (defines `isCommittedBundleRead`, needed by the common code below the hunk); main had the `/var/task`-only version.
- `lib/story-location-bible/zone-sheets.ts` — keep target's Slice-B `protectedSetRefs` PROTECT tier (main lacked it).
- `app/book/[id]/read-v2/reader-v2.tsx` (3 hunks) — keep target's dedication placement (D2) + fuller narration effects; main was older/absent. (Reader/narration proper is Phase 2.)

`npm run check` after Step 2: **green** — tsc clean; 173 files / 1488 tests (identical to `7093f890`).

### Step 3 — merge the authoring engine `feat/live-authoring-fix` → target `--no-ff`

| feature (source) | replacement / representation on target |
|---|---|
| `feat/live-authoring-fix@37299b3c` — 8 engine commits: Stage 1 (dedicated authoring call + strict json_schema + budget + provenance, incl. `backend/providers/pipeline.ts`), Stage 2 (appearance injection + worldType/coverContract copies + topology graph ownership), Stage 3 (bounded repair loop), `assertSourceProse` empty-source guard + `templateDraftSchema`, the Generator-v3 `parser.ts` fix, companion-presence detection + cross-field fail-closed validator (`castPresenceContradiction`) | Merge **`592ea826`** (2-parent, `--no-ff`). 22 files landed. **This lands the engine on the render branch = the Contract v2 prerequisite.** |

**Conflict resolution (1 region):**
- `lib/visual-contract-compiler/contractTemplateTypes.ts` — **KEEP `parent` in `RELATIVE_ROLES`** (both branches had already added it; the array line was common). Took the engine's comment and dropped target's now-vestigial "kept in sync with the engine branch" note. All other engine changes accepted.

`npm run check` after Step 3: **green** — tsc clean; 179 files / 1548 tests (+60 from the engine specs), no regressions.

## Consolidated target tip after Phase 1: `592ea826`

Not pushed — **Guy pushes**. Phase 2 (reader/narration) + Contract v2 proceed on this consolidated target.
