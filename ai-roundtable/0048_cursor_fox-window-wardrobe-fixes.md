TYPE: RESULT
From: cursor
To: roundtable
Re: fox_uri_adventure general fixes (board quarantine + generic NIGHT_FEAR night wardrobe lock)
Date: 2026-06-16

# 0048 — Board quarantine (window-without-drape) + Fox NIGHT wardrobe lock

## A) Board quarantine — “fixed window without drape/curtain fabric”

### Failure mode (what broke)
- `fixed_interior_bedroom_window_unspecified` set-appearance board was auto-rejected during QA as:
  - `window is shown with an opening, indicating possible fabric or soft elements`

### What we changed (general system behavior)
- `lib/set-appearance/quarantine.ts`
  - Updated the fixed-objects quarantine contract so **any soft fabric on/around windows is forbidden**.
- `lib/set-appearance/board.ts`
  - Added an explicit **WINDOW STUDY RULE** to the board prompt: **bare window frame + glass only** (no curtains/valances/drapes/tiebacks/swags).
- `lib/set-appearance/seed.ts`
  - Updated the window fact signature used by the board (`same_window`) to describe **frame + glass only** and explicitly exclude fabric.
- `lib/set-appearance/board-qa.ts`
  - Updated the vision QA prompt/reject terms to treat curtain/drape/valance/tieback/swag as contamination on this board.

### Regenerated board (QA confirmation)
- Scene: `fixed_interior_bedroom_window_unspecified`
- Output: `outputs/set-appearance-boards/fixed_interior_bedroom_window_unspecified/set-appearance-board.png`
- QA result: `qaPassed=true`, `qaFlags=[]` (approved-able board)

### Attachment expectation
When this board is approved, non-state pages should use it as the visual set board reference (instead of TEXT fallback).

## B) Fox NIGHT wardrobe lock — remove prompt-audit workaround

### Failure mode (what broke previously)
- Fox NIGHT slots inherited day-clothes default, so dev runs needed `skipPromptAudit` to get through.

### What we changed (generic wardrobe routing, no fox literals)
- `lib/style01-story-wardrobe.ts`
  - Added `GENERIC_NIGHT_STORY_WARDROBE_LOCK` for NIGHT_FEAR / night-time stories.
- `lib/style01-gptimage.ts`, `lib/style01-prompt-assembly.ts`
  - Ensured wardrobe resolution uses **storyTimeOfDay** + **challengeCategory** (NIGHT_FEAR) so the prompt contains explicit pajamas wording.
- `lib/qa-console-book-lock-context.ts`, `lib/generation-pipeline/chunk-runner.ts`
  - Ensured the wardrobe parity gate evaluates against the same resolved lock.

Result: the assembled prompts include `two-piece pajamas` and do not rely on `skipPromptAudit`.

## Validation — re-run fox p1/p5/p6/p8 LOW

### Command
`npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs scripts/run-0048-fox-fix-validation.ts`

### Run output
- Dir: `outputs/style01-auditions/qa-console-fox_uri-0048-20260616-120437`
- Rendered pages: `1, 5, 6, 8`
- Failed pages: `none`

### Board + wardrobe audit signals
- Board QA: `qaPassed=true`, `approved=true`
- Board attachment (manifest): board attached on `p1`, `p5`, `p6`, `p8`
- Prompts contain the BOOK WARDROBE LOCK pajamas wording (`two-piece pajamas`).
- Run completed with `failed=none` and no prompt-audit abort.

### Images (LOW)
- `outputs/style01-auditions/qa-console-fox_uri-0048-20260616-120437/page-01.png`
- `outputs/style01-auditions/qa-console-fox_uri-0048-20260616-120437/page-05.png`
- `outputs/style01-auditions/qa-console-fox_uri-0048-20260616-120437/page-06.png`
- `outputs/style01-auditions/qa-console-fox_uri-0048-20260616-120437/page-08.png`

## Notes for Guy
- These are GENERAL fixes:
  - window quarantine applies to any fixed-objects window board using the same module.
  - NIGHT wardrobe lock applies to future NIGHT_FEAR/night-time stories via `challengeCategory` + time-of-day.
- No HIGH renders and no flips were performed.

