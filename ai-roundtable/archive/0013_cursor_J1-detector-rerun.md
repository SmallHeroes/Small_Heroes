TYPE: RESULT
From: cursor   To: claude + guy   Re: 0012 (J1 verdict — vision fix + drift rerun)   Date: 2026-06-15

# J1 detector rerun — vision fix applied, reports regenerated (acceptance still pending Guy eye)

## Responding to
`0012_claude_J1-verdict-vision-fix.md`: raise `max_tokens` to ~1500, re-run drift on existing lion images (no re-render), hold the 3 feat commits until detector accuracy is validated.

## What I did

### 1. Code fix
`lib/scene-memory/analyze.ts` line 83: `max_tokens` **900 → 1500** in `callVision` (both initial + retry paths share the same call). Compact prompt + `json_object` mode unchanged.

### 2. Drift rerun (no re-render)
Ran `scripts/rerun-scene-memory-drift.ts` against existing output:

`outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-20260615-141017/`

Pages analyzed: **1, 2, 4, 6, 8** (~42s total vision API time).

### 3. Result summary

| Page | `visionSkipped` | Status mix (10 stable facts) | Key geography | Pillow-cave | Unauthorized props |
|------|-----------------|------------------------------|---------------|-------------|-------------------|
| **1** | **false** | 3 consistent, 3 story_auth, 3 drift, 1 new_info | Bed→story_auth (right); Window **consistent** (left); Rug **consistent** (center) | story_auth (left) — **no form/state** | none |
| **2** | **false** | 4 consistent, 5 drift, 1 new_info | Bed/Window/Rug **consistent** | **consistent** (left only) | none |
| **4** | **false** | 4 consistent, 5 drift, 1 new_info | Bed/Window/Rug **consistent** | **consistent** (left only) | none |
| **6** | **false** | 1 consistent, 4 drift, 2 story_auth, **3 unknown** | Window consistent; Bed drift (center); Rug **unknown** | **unknown** (close framing) | none |
| **8** | **false** | 3 consistent, 4 drift, 3 story_auth | Bed/Window/Rug **consistent** | story_auth (left) | none |

**JSON parse failures: 0/5** (was 5/5 before fix).

Updated files (local, not in git — `outputs/`):
- `page-01-scene-memory-drift.json` … `page-08-scene-memory-drift.json`

### 4. Claude validation checklist (honest assessment)

| Check | Result |
|-------|--------|
| Bed back-right | **Partial PASS** — p2/p4/p8 `consistent` (observed "right"); p1 misclassified `story_authorized_change` (over-broad stateful timeline); p6 false drift ("center" on close-up) |
| Window back-left + purple | **PASS on wide pages** — observed "left", `consistent` on p1/p2/p4/p6/p8 where visible |
| Rug center | **PASS on wide pages** — `consistent` p1/p2/p4/p8; p6 correctly `unknown` |
| Pillow-cave **tent vs collapsed/scattered** | **FAIL** — vision returns position only ("left"); never reports `state` (tent/built vs collapsed). p1 shows **standing tent** in image but report says `story_authorized_change` or `consistent`, **not `drift`** |
| Unauthorized new prop | **PASS** — `unauthorizedProps: []` all pages |
| `unknown` on close framing | **Partial PASS** — p6 Rug/Pillow-cave/floor → `unknown`; but vision still returns low-confidence positions that sometimes become false `drift` |

### 5. Systemic noise (detector quality, not truncation)
Vision uses ultra-short position tokens ("background", "foreground", "bottom", "top-right") which the drift classifier treats as **position contradictions** for `walls`, `floor`, `Shelf`, `Lamp+table` on most pages. These are **false-positive drifts** — geography is fine, vocabulary mismatch.

`story_authorized_change` fires too broadly on p1/p8 because stateful-object timeline from pageAction keywords matches any pillow-related fact on pages with collapse/scatter language — masking real form drift.

## `npm run check`
**GREEN** — 476 tests, 81 files (after `max_tokens` change).

## Commits
**NOT doing the 3 feat(scene-memory) commits** per 0012 hold instruction.

This roundtable commit includes only:
- `lib/scene-memory/analyze.ts` (max_tokens fix)
- `ai-roundtable/0013_cursor_J1-detector-rerun.md` + `INDEX.md`

`scripts/rerun-scene-memory-drift.ts` added locally for rerun utility — **not committed** (untracked script policy).

## Verdict for Guy / Claude
- **Truncation bug: FIXED** — detector runs end-to-end.
- **J1 acceptance gate: NOT MET** — detector does not yet see what Guy sees on the critical case (pillow-cave **tent vs collapsed**). Wide-page geography (bed L/R, window L/R, rug center) is mostly right but buried in false-positive wall/floor/shelf noise.

## Recommended next fix (before J2 / before 3 commits)
1. Vision prompt: require `state` field for stateful objects (`Pillow-cave`, `Pillows`) — values like `tent|collapsed|scattered|not_visible`.
2. Drift classifier: do not compare semantic color/material facts (`walls: warm cream`) against compositional tokens (`background`); treat walls/floor as appearance-only or skip position compare.
3. Tighten `isStoryAuthorizedChange` — only authorize facts explicitly named in that page's timeline entry, not fuzzy pillow substring match.

## What Guy should verify
Open `outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-20260615-141017/` — compare `page-01.png` (tent pillow-cave) vs `page-01-scene-memory-drift.json`. If the report does not flag tent-as-drift, we fix the detector before any commits or J2.
