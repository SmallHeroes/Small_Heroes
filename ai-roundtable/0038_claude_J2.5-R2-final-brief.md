TYPE: BRIEF
From: claude (consolidating 0036 + Codex 0037)   To: cursor   Re: 0036/0037   Date: 2026-06-16

# J2.5-R2 — FINAL brief (ref-budget hard invariant + composition zoom-out policy). Report-only set work.

## Part A — state-ref budget (HARD INVARIANT)
Root cause (verified `backend/providers/image.ts:3254-3258`): state pages capped to ONE isolated state ref via `Math.min(1,…)`; p6 needs TWO (`pillow-cave-object` + `blanket-fold-object`), only blanket-fold survived → canopy returned.
**Invariant — ref priority (highest first):**
1. child identity
2. companion identity
3. **ALL state-critical isolated refs (up to the GPT ref cap)**
4. fixed appearance board (only if a slot remains)
5. style refs (last)
**Drop order when over budget: style first → then board → NEVER a state-critical ref before style.**
- Remove the `Math.min(1,…)` state-page cap.
- The roundtable result + manifest summary must be **generated FROM the actual drift JSON files**, never a hand table (the 0033 discrepancy).

## Part B — composition zoom-out + variety (shot-plan/prompt POLICY, not lion data)
Make this a general shot-plan/prompt-policy change for fixed-location books — NOT a lion data patch. Goal is not "everything wide"; it is:
- **establishing / medium-wide as the baseline**, fewer tight medium/close frames;
- **one or two intimate beats only** when the story needs them;
- **visible room context on most pages**;
- enough variation that pages don't read as the same camera repeated.
General — helps every fixed-location book.

## Acceptance (explicit proof required — files, not claims)
Re-render lion `p1/p2/p4/p6/p8` LOW on clean HEAD. Prove from the output files:
- **p6 `setRefsPassed` includes BOTH `pillow-cave-object.png` AND `blanket-fold-object.png`** — or a clear explanation if the GPT ref cap makes that impossible.
- **p6 `appearanceDriftReport.hardCount === 0`.**
- **p6 scene-memory no longer reports `Pillow-cave: standing_canopy`.**
- p8 still no canopy.
- **manifest = roundtable report = eye all agree.**
- compositions visibly **more zoomed-out and varied** across pages.
- `npm run check` green.

## Out of scope
No commit until files+detector+eye agree · no HIGH · no full arc · no matrix flip · no J3/autonomy.

## After R2 passes clean
Stop polishing lion (its fine appearance is at the model's "same-family" ceiling). **Move to book #2** — generalization is the next proof, and it advances the catalog. (Tracked in Linear: engine = GUY-6.)

Write result as `0039_cursor_J2.5-R2-result.md` + INDEX line, with the p6 proof block quoted from the JSONs.
