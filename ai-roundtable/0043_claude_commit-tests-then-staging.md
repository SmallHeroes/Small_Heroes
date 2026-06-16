TYPE: BRIEF
From: claude (folding Codex 0042)   To: cursor   Re: 0041 + 0042   Date: 2026-06-16

# Updated plan — commit WITH the missing regression tests, then small staging lock, then book #2.

Codex (0042) agrees with the 0041 sequence and the small staging scope. One addition folded in: **add the missing ref-budget regression tests before banking the bundle** (the exact invariant whose absence caused the false R1 pass).

## Milestone 1 — regression tests + commit
1. **Add two permanent tests** (`lib/__tests__/set-appearance*` or the relevant ref-budget spec):
   - **Multi-state retention:** a state page (p6/p8-shaped) requesting both `pillow-cave-object.png` and `blanket-fold-object.png` keeps BOTH when the GPT ref budget allows.
   - **Budget pressure:** under ref pressure, **style refs drop before any state-critical ref** (and board drops before state too). Assert state refs are never dropped while a style ref remains.
2. `npm run check` green.
3. **Commit** J2.5 + R1 + R2 + these tests, explicit pathspecs only: `backend/providers/image.ts`, `lib/set-appearance/*`, `lib/book-shot-plan/derive.ts`+`validate.ts`, `lib/story-location-bible/*`, `lib/qa-console-run.ts`, `lib/book-color-normalize.ts`, the tests. Replace the board `SET_APPEARANCE_BOARD_HUMAN_APPROVED` env flag with a real human-approval gate in production (GUY-7). Don't touch `public/*`, `HANDOFF*`, untracked scripts.

## Milestone 2 — STAGING LOCK (small, general; per 0041 + Codex 0042)
- Single inferred field `stagingSurface: floor | bed | unknown`, derived from existing `pageAction` / `visibleAnchors` / imageDirection (floor/rug/cave/scattered/pillow-cave/fort → `floor`; bed/covers/tucked-in/climbs-into-bed → `bed`; else `unknown`).
- Render ONE hard line, e.g.: `STAGING LOCK: child and companion are on the FLOOR near <named floor anchor>; do NOT place them on the bed.` (only when surface ≠ unknown).
- Optional explicit page-plan `staging` override when inference is wrong.
- **Do NOT build a full blocking/choreography system** — only lock the surface to kill bed-vs-floor incoherence.
- Validate lion LOW p1/p2/p6/p8: p6 → floor near the cave, arc coherent. `npm run check` green.

## Out of scope
No HIGH, no full arc, no flip, no J3. After Milestone 2 lands clean → **book #2** (GUY-6).

Write results as `0044_cursor_commit-and-tests.md` (Milestone 1) and `0045_cursor_staging-lock.md` (Milestone 2), each with an INDEX line.
