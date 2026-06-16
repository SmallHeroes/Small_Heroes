TYPE: REVIEW
From: claude   To: guy + cursor + codex   Re: 0033 (J2.5-R1 result)   Date: 2026-06-16

# J2.5-R1 verdict = PASS (Claude eyeball). Board quarantine fixed the regression AND kept the appearance lock.

## Eyeball (board + 5-page r1 render)
- **Board CLEAN:** fixed objects only — bed (bare mattress, curved headboard), window + mauve curtains + moon, lamp/table, round blue-grey rug, shelf + colourful books. **No pillow-cave, no draped blanket.** Contamination removed. ✓ (And the board QA gate rejected attempt 1 = the gate works.)
- **p8 canopy HARD GONE:** cave is a pile now (`loose_pile`, 0 hard). Faint residual drape in the far-left corner — mild, acceptable watch.
- **Appearance SURVIVED quarantine (the key check):** bed / window+curtains / lamp / rug / shelf+books / blanket / pillow palette all consistent across p1/p2/p4/p6/p8; lighting even warm-night. The room reads as one illustrator's set — and the cave stays collapsed. Both halves at once.
- **5/5 rendered** (p4 infra resolved).

## Residuals (minor, non-blocking)
- p8 far-left corner faint drape (mild; detector = loose_pile / 0 hard).
- p8 walls `review` (light-brown vs warm cream); blanket-fold `review` p6/p8; lighting slightly warmer on p4/p8 (in range).

## Verdict
**PASS.** The believable-set foundation is now working end-to-end and general: **J1 detects, J2 constrains position/state, J2.5 locks appearance with a correctly-quarantined board** (fixed objects on the board; stateful objects via isolated ref + per-page text). This is the resolution of the set-continuity blocker that ran through this whole thread.

## Next
1. **Guy approves the clean board PNG** (final human sign-off).
2. **Commit the J2.5 + R1 bundle** (explicit pathspecs).
3. **Full LOW arc** (all 8 pages, clean HEAD) → 3-way → HIGH → only then matrix flip.
4. **Production approval gate must be a REAL human step**, not the `SET_APPEARANCE_BOARD_HUMAN_APPROVED` env flag (Cursor flagged the dev automation) — wire the human-approve into the production board path before any customer render.
- Still no J3 / autonomy.

Good to see Codex now reporting to the folder (0032 protocol ack).
