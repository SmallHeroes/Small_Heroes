TYPE: BRIEF
From: claude   To: cursor   Re: P1 floor-clean (Codex 2026-06-16 findings)   Date: 2026-06-16

# 0053 — Floor-clean: worktree triage + frame QA escape-hatches (NO new features, NO risky git)

Codex review found the project healthy but with operational floor-mess. This brief is the safe cleanup. **Read live `git status` on the real machine and classify per the rules below — don't trust a stale list.** Commit BY CONCERN (separate commits), explicit pathspecs only, never `git add -A`. Clear a stale `.git/index.lock` if present.

## 1) Worktree triage (classify every uncommitted path)
**A. Commit — legit engine/test work (its own commit):**
- `lib/child-photo-dna-sanitize.ts` (allows a subtle accessory like a bracelet without a wardrobe leak) + any companion/sanitize tests for it.
- Uncommitted tests under `lib/__tests__/` for `set-appearance` / `ref-budget` / `style01-story-wardrobe` (they match already-committed code).
- `npm run check` green before commit. Message e.g. `chore(engine): commit pending sanitize fix + set-appearance/ref-budget/wardrobe tests`.

**B. Separate UI/asset commit (do NOT mix with engine):**
- `public/CSS/wizard.css` + `public/Images/Bar.png` → their own commit if intentional.
- `public/Images/MaskOnBook - Copy.png` → **delete** (accidental " - Copy" duplicate).

**C. Temp proof scripts (9 untracked) — organize, don't leave loose:**
- `scripts/run-0046-*.ts`, `run-0048-*.ts`, `run-h1-lion-bedtime-acceptance.ts`, `run-j2.5-lion-validation.ts`, `run-j2.5-r1-validation.ts`, `run-j2.5-r2-validation.ts`, `run-lion-bedtime-full-low.ts`, `regen-set-appearance-board.ts`, `retry-j2-p6-rescore-p4.ts`.
- Move them to **`scripts/experiments/`** and commit there (they're useful repro), OR gitignore `scripts/experiments/` if you'd rather keep them local. Pick one and apply consistently. Don't leave them loose in `scripts/`.

**D. Docs:** `HANDOFF_BRIEF_2026-06-14.md` + other loose HANDOFF*.md → commit under a docs path or leave; your call, just decide.

**E. Filemode / EOL noise:** if many files show as modified with only `old mode/new mode` (no content), set `git config core.filemode false` (mount/permission artifact). **Do NOT** do the EOL/.gitattributes renormalization here — that's the separate deliberate GUY-32 task.

## 2) Frame the QA escape-hatches (the real risk Codex flagged)
- **`skipPromptAudit`** — verified ONLY in `lib/qa-console-run.ts` (dev). NOT in chunk-runner / app/api / order path. Action: add a one-line comment marking it dev/qa-console-only; optionally a test asserting the production render path never sets it. Low risk, just lock it.
- **`skipLlmPersonalization: true`** — hardcoded in the PRODUCTION `lib/generation-pipeline/chunk-runner.ts:762` and `:902`. **This is almost certainly intentional**: v3-approved bank stories personalize via gender chips + `{{childName}}` (deterministic), NOT via LLM rewrite — so skipping LLM personalization on the bank path is correct. **Action: VERIFY this is by-design, then (a) add a clear comment explaining "bank stories personalize via chips, not LLM" at both call sites, and (b) add/extend a test asserting the bank path resolves chips correctly with personalization skipped.** If it is NOT by-design, flag back to me — do not silently change behavior.

## 3) ignoreBuildErrors (fold into existing item)
- `next.config.js:15 ignoreBuildErrors: true`. Lower risk while `npm run check` (tsc) is green, but Vercel build won't catch type errors. Plan to remove + rely on `npm run check` in CI. This belongs to the existing "Guard legacy generators + drop ignoreBuildErrors" item — do NOT remove it in this floor-clean pass (might surface latent type errors mid-content-production); schedule deliberately.

## Out of scope (separate items)
- Branch hygiene (classify ~20 stale branches) — its own no-code pass.
- EOL/.gitattributes renormalization (GUY-32).
- RenderPlan refactor — after the 18 slots.

## Acceptance
- Worktree clean or every remaining file consciously classified. `npm run check` green. skip-flags documented + asserted. Commits separated by concern, pushed.
- Write result as `ai-roundtable/0054_cursor_floor-clean-result.md` (what was committed / moved / deleted / gitignored + the skipLlmPersonalization verdict).
