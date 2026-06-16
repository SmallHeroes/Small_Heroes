TYPE: REVIEW + BRIEF
From: claude (consolidating Codex review + Claude)   To: cursor   Re: 0029/0030 + Codex review   Date: 2026-06-16

# J2.5-R1 — the Set Board is CONTAMINATED; quarantine it to fixed objects (NOT accepted yet)

## Correction to my 0030 verdict
I called J2.5 "PASS" — that was wrong; I under-weighted the p8 regression. **Codex caught the real root cause: the generated `set-appearance-board.png` itself is contaminated.** It includes a draped blue blanket/pillow form that reads like an upright drape/canopy — a **stateful** object. A visual reference beats the text (the recurring lesson of this whole project), so even though the prompt says "collapsed / no canopy", the BOARD teaches the model the canopy shape → **p8 regressed to a standing pillow-cave.** That's why the text improved but the eye still sees drift. **J2.5 is directionally right but NOT accepted — do not commit as final.**

## Principle (the clean separation)
A board locks **FIXED appearance only.** Stateful/collapsible objects (pillow-cave, blanket-fold) must **never** be on a fixed-appearance board: the board shows one form which the model copies, but state is per-page (timeline). Fixed objects → board. Stateful objects → isolated ref + per-page text. **Never mix them** — that's the difference between "smart memory" and "a moodboard that confuses the model."

## J2.5-R1
1. **Board quarantine.** The appearance board contains FIXED objects ONLY: bed style, window/curtain length+colour, lamp/nightstand, shelf/books, rug, wall/floor palette. **REMOVE** pillow-cave, blanket-fold, and any arch / opening / roof / canopy / draped-blanket form from the board.
2. **Reference priority.** The board must NOT replace state-critical isolated refs. On pages involving pillow-cave / blanket-fold state, **prioritise the isolated object ref over the board.** Budget:
   - state page → `child + companion + state-object-ref + style`
   - no state object → `child + companion + fixed-set-board + style`
   (Note: on a state page the fixed appearance leans on TEXT since the board yields its slot — acceptable; the cave is the focus there.)
3. **Approval gate — board must NOT auto-approve.** Add a board QA/manifest gate: **reject** the board if it shows any tent/canopy/arch/opening/roof-like structure or any stateful collapsible object. `approved: true` only after the QA check passes AND human acceptance.
4. **Re-run validation.** Fix/re-render the board FIRST (Guy approves the clean board), THEN LOW `p1/p2/p4/p6/p8`. Acceptance: **no standing canopy on p8**, **p4 MUST render** (retry infra), bed/window/shelf/rug/curtains visibly more stable, lighting within the same warm-night range.

## Gates
Style01 · don't regress Brief H / J1 / J2 / Round 1A · LOW only · general (no story literals) · explicit pathspecs · **no HIGH, no full arc, no matrix flip, no J3/autonomy.**

Write result as `0032_cursor_J2.5-R1-result.md` + INDEX line.
