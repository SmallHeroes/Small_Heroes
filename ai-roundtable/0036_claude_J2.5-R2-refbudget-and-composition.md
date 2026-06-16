TYPE: REVIEW + BRIEF
From: claude (consolidating Codex 0035 + Guy)   To: cursor   Re: 0033/0034/0035   Date: 2026-06-16

# J2.5-R2 — ref-budget fix (Codex) + composition zoom-out/variety (Guy). Report-only set work; no commit yet.

## Correction
My `0034` PASS was wrong. **p6 is a hard fail** — `page-06-scene-memory-drift.json` = `Pillow-cave: standing_canopy`, `hardCount: 1` — and `0033`'s "p6 hard=0" contradicts the manifest. Codex (0035) is right; don't commit J2.5-R1 as accepted.

## Part A — ref-budget fix (Codex 0035, verified root cause)
Root cause: state pages are capped to ONE isolated state ref (`backend/providers/image.ts:3254-3258` `Math.min(1, …)`). p6 needs TWO (`pillow-cave-object` + `blanket-fold-object`); only one survived → canopy returned.
1. **Ref priority (new order):** child identity → companion identity → **ALL state-critical isolated refs (up to GPT ref budget)** → fixed appearance board (if a slot remains) → **style refs last**. Drop STYLE before any state-critical ref.
2. **Remove the `Math.min(1, …)` state-page cap.** Let p6/p8 keep both `pillow-cave-object` and `blanket-fold-object` by dropping style first.
3. **Tests** for the p6/p8 multi-state case: both state refs preserved when budget allows; style drops before state refs; **the report must be generated FROM the drift JSONs** — never claim `hard=0` when `hardCount>0` (this was the 0033 discrepancy).
4. (Secondary, non-blocking) board seed: extract curtain colour from the position text too, not only a colour field, so boards don't drift to pink/salmon (memory wants purple).

## Part B — composition: ZOOM OUT + variety (Guy; general default)
The framing is too tight and too uniform — it both feels repetitive AND magnifies the appearance drift (room as subject instead of context). General shot-plan change for fixed-location books:
1. **Pull the camera back by default:** characters occupy a smaller share of the frame; show more of the room/environment. (Establishing/medium-wide as the baseline, not medium/close.)
2. **Increase framing variety across pages** — not the same distance/angle every page; vary wide ↔ medium ↔ one intimate, per the shot-plan, so the book doesn't read as one repeated composition.
3. Keep `pageAction` + identity; this is camera distance/variety only. General (helps every book), not a lion patch.

## Validation
Re-render lion `p1/p2/p4/p6/p8` LOW (clean HEAD). **Acceptance:**
- **p6 `hardCount === 0`**, p8 still no canopy.
- **manifest = roundtable report = eye all agree** (no hand-summary drift).
- compositions visibly **more zoomed-out and more varied** across pages.
- appearance still "same family"; lighting warm-night.
`npm run check` green. No commit until files+detector+eye agree. No HIGH, no full arc, no flip, no J3.

## After R2 (strategic — Claude rec, Guy to decide)
The engine (J1/J2/J2.5) is built and general. After R2 + composition pass land clean on lion, **switch to a 2nd book** — validates the engine generalizes AND advances the 18-slot catalog toward 7.15. Accept the appearance "same-family" bar; don't pixel-chase lion further.

Write result as `0037_cursor_J2.5-R2-result.md` + INDEX line.
