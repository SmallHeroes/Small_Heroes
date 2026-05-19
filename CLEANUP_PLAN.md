# Project Cleanup Plan — 2026-05-19

## Approach

**Reversible.** Stale files get **moved** to `_archive_2026-05-19/`, not deleted. You can review the archive, then delete it manually after a week of confidence.

**Safe during live runs.** The batch you're running uses `story-qa-logs/2026-05-19_*/`. The cleanup script protects everything from today.

**Conservative.** I only target files I verified are NOT imported by active code or referenced by `package.json` scripts.

---

## Buckets to archive

### 1. Old story-qa-logs (huge — biggest win)

**Pattern:** `story-qa-logs/2026-05-18_*` (yesterday and earlier)
**Count:** ~30 directories with 8-15 files each (~300-400 files total)
**Why safe:** these are debug logs from old iteration batches. None are referenced by code. Today's runs (2026-05-19) are preserved.

### 2. Archived docs

**Path:** `docs/archive/*`
**Count:** 12 files
**Files:**
- `story-bank-v2-architecture.md` (superseded by current architecture)
- `phase-9a-cleanup-brief.md`
- `v3-story-prompt.md` (we're on v5+ now)
- `phase-10a-direction-equals-length.md`
- `CURSOR_BRIEF_PHASE_11.md`
- `CURSOR_BRIEF_PHASE_12.md`
- `CURSOR_BRIEF_PHASE_13.md`
- `CURSOR_BRIEF_PHASE_13_HOTFIX.md`
- `CURSOR_BRIEF_PHASE_14.md`
- `PIPELINE_PROMPT_REFERENCE.md`
- `prompt-rewrite-diagnosis.md`
- `prompt-consultant-brief.md`

**Why safe:** the `archive/` subdir is explicit "we already moved past this".

### 3. Old one-off scripts (no longer used)

**Path:** `scripts/`
**Verified:** no production code imports these. No `package.json` script reference. Each was a one-time migration / audit.

Candidates to archive:
- `add-companion-letter.mjs` — letter feature shipped
- `apply-audit-suggestions.mjs` — audit applied
- `audit-hebrew-quality.mjs` — audit done
- `audit-prose-quality.mjs` — audit done
- `audit-stories-content.mjs` — audit done
- `cleanup-hebrew.mjs` — cleanup applied
- `compare-styles.mjs` — comparison done
- `detect-artifacts.mjs` — superseded by validators
- `detect-repetitions.mjs` — superseded by validators
- `fingerprint-analyzer.mjs` — one-off analysis
- `fix-stories.mjs` — fixes applied
- `fix-wordcount-metadata.mjs` — applied
- `generate-companions.mjs` — companions generated
- `generate-gallery.mjs` + `.ts` — gallery generated
- `generate-hero.mjs` + `.ts` — heroes generated
- `generate-style-previews.ts` — previews generated
- `generate-v5-stories.mjs` — v5 generation done (story bank exists)
- `probe-openai-models.mjs` — probe done
- `rename-companions.mjs` — renamed
- `score-stories.mjs` — scoring done
- `test-layout-pipeline.mjs` — layout shipped
- `validate-stories.mjs` — superseded by validateStory in lib
- `layout-preview.html` — preview shipped

**Keep (active):**
- `dev-safe.js` — used by `npm run dev`
- `ignore-server-only.cjs` — used by build
- `generate-test-batch.mjs` + `generate-test-batch-runner.ts` — **THE CURRENT MAIN TEST RUNNER** ⚠ DO NOT TOUCH

### 4. Debug file

- `backend/debug/test-audio.ts` — debug file (gitignored)

---

## Buckets explicitly NOT touched

- **All `lib/`** — active source code.
- **All `app/`** — active Next.js routes.
- **All `components/`** — active UI.
- **All `backend/`** except `backend/debug/`.
- **`story-bank/v5-fixed-v2/`** — active story bank (108 stories).
- **`story-bank/*.xlsx`** — review spreadsheets, possibly still referenced.
- **All `docs/*.md` outside `docs/archive/`** — current briefs and rules.
- **`story-qa-logs/2026-05-19_*`** — TODAY'S RUNS, including the live batch.
- **`public/`, `prisma/`, `tests/`** — runtime + tests.
- **`.next/`, `node_modules/`** — managed by tooling.
- **`Refs/`** — design references.

---

## Recovery

If you regret archiving:
```powershell
Move-Item -Path "_archive_2026-05-19\*" -Destination "." -Force
```

After 1+ week and a successful batch, you can delete the archive:
```powershell
Remove-Item -Path "_archive_2026-05-19" -Recurse -Force
```

---

## See `cleanup.ps1` (next to this file) for the actual archive script.
