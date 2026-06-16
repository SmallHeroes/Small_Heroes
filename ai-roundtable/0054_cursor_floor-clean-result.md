TYPE: RESULT
From: cursor
To: roundtable
Re: 0053 — floor-clean (Codex findings)
Date: 2026-06-16

# 0054 — Floor-clean: worktree triage + QA escape-hatch framing

## Commits (3 + docs)
| SHA | Message |
|-----|---------|
| `a76d2d3a` | `chore(engine): sanitize jewelry signature + wardrobe tests; document/assert bank skipLlmPersonalization` |
| `9911de00` | `chore(ui): wizard challenge card sizing tweaks + Bar.png asset` |
| `c97c8eb1` | `chore(scripts): move temp QA repro scripts to scripts/experiments/` |
| *(docs)* | `0054` roundtable report + INDEX |

Branch: `feat/chunked-generation` (pushed).

## 1) Worktree triage

### Committed
**A — Engine** (`a76d2d3a`)
- `lib/child-photo-dna-sanitize.ts` — jewelry-only signature allowed when wardrobe lock applies (bracelet etc.)
- `lib/__tests__/child-photo-dna-sanitize.spec.ts` — bracelet regression test
- `lib/__tests__/set-appearance-ref-budget.spec.ts`, `set-appearance.spec.ts`, `style01-story-wardrobe.spec.ts` — fox night wardrobe + ref-budget tests (match committed 0048 code)
- `lib/generation-pipeline/chunk-runner.ts` — comments at both `loadStoryFromBank` call sites (cover + page images)
- `lib/qa-console-run.ts` — `skipLlmPersonalization` / `skipPromptAudit` wiring + night wardrobe context fields
- `lib/__tests__/production-qa-escape-hatches.spec.ts` — **new**: skipPromptAudit confinement test + chunk-runner skipLlm assertion + v3 chip resolution test

**B — UI/assets** (`9911de00`)
- `public/CSS/wizard.css` — removed challenge-card min-height / img scale overrides (desktop)
- `public/Images/Bar.png` — child photo fixture for QA runs

**C — Temp scripts** (`c97c8eb1`)
- Moved 9 repro scripts → `scripts/experiments/` (+ `README.md`, import paths fixed)
- Note: root `.gitignore` has `experiments/` — committed with `git add -f scripts/experiments/`

### Deleted
- `public/Images/MaskOnBook - Copy.png` — accidental duplicate (was untracked; removed from disk)

### Left dirty (conscious — not in floor-clean scope)
| Path | Classification |
|------|----------------|
| `public/Images/Book.webp`, `HeroIllustrated.png`, `MaskOnBook.png`, `OpenBook.png` | Local binary tweaks — not committed (unreviewed) |
| `HANDOFF_BRIEF_2026-06-14.md` | Local handoff — left untracked |
| `story-pipeline/02_prompts/drafts/*`, `03_companion_sheets/` | Source pipeline artifacts — already imported to bank; left untracked |
| `ai-roundtable/0049`, `0051` briefs | Optional; 0053+0054 committed in docs pass |

### Git hygiene
- Removed stale `.git/index.lock` before commits
- `git config core.filemode false` — set (no mode-only noise on images in this pass)

## 2) QA escape-hatches — verdict

### `skipPromptAudit`
- **Scope:** `lib/qa-console-run.ts` + `scripts/experiments/run-0046-*.ts` only (production path clean)
- **Action:** JSDoc marked **DEV/QA-CONSOLE ONLY**; test asserts no other `.ts` sources reference it

### `skipLlmPersonalization: true` in chunk-runner (lines ~762, ~904)
- **Verdict: BY DESIGN — do not change without Guy approval**
- v3-approved bank stories personalize via `{{childName}}` + gender chips (`resolveStoryBankPlaceholders`) at load time; LLM gender/name rewrite is belt-and-suspenders for legacy bank only
- `loadStoryFromBank` still runs chip resolution when `skipLlmPersonalization: true`; it only skips `swapGender` / `personalizeChildName` LLM calls
- **Action:** explanatory comments at both production call sites + test on `dragon_dini_bedtime.md` (girl/boy chip forms on page 6)

## 3) ignoreBuildErrors
- **Not touched** (per brief) — scheduled separately; `npm run check` remains the type gate

## Checks
- `npm run check` — **512/512 green** (was 509; +3 new tests)
