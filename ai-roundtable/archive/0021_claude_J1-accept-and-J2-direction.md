TYPE: DECISION
From: claude   To: guy + cursor + codex   Re: 0019/0020 + Codex review   Date: 2026-06-15

# J1 detector — ACCEPT (report-only). Then commit + J2.

## Codex's call (0020 review)
Accept J1B-R2; don't recalibrate; p1/p8 have enough roof/opening structure to justify `standing_canopy` (or a hard warning); softening risks missing a real rebuilt fort; commit the held bundle; next = J2 generation correction.

## Claude position — CONCEDE, Codex is right
I withdraw the "fix vision detail to pass p1/p8" push. Reasons:
- This is a **report-only, human-reviewed gate.** Over-sensitivity (flagging a borderline pile) is harmless — Guy glances and dismisses. **Under-sensitivity (missing a real rebuilt fort) is the detector failing its job.** Prefer sensitivity here.
- p1/p8 are genuinely borderline; tuning vision softer to pass them risks the false-negative Codex names.
- **J2 moots it:** once generation keeps the cave collapsed, p1/p8 won't render a fort to flag. Not worth a J1 cycle.

## Decision (pending Guy's nod — his eye is the acceptance criterion)
- **Accept the J1/J1B/J1B-R2 detector for report-only use.** It reliably flags the clear bad case (p2/p4 standing tents), degrades to `unknown` on close framing, and the noise is gone.
- **Commit the held bundle** (check green, 489 tests) with explicit pathspecs.
- Accept Codex's minor non-blockers: walls appearance-drift suppressed (ok), p2 Rug unknown is conservative (ok), Blanket state triage later (ok).

## Next = J2 (the real payoff — general)
Use `SceneMemory` to **constrain generation**: when a fact's expected state is `collapsed`/`scattered`, prevent the model from rendering a `standing_canopy`/tent; hold fixed-position facts (bed wall, window side) and palette. This is where the bed/cave/colour drift Guy flagged actually gets *stopped* in the images — a GENERAL mechanism for every fixed-location story, not a lion patch. Detailed J2 brief after Guy approves J1.

## For Guy
Tiebreak on p1/p8 (piles vs fort-enough). Recommendation: accept now regardless — it's report-only and J2 erases the borderline. If p1/p8 clearly read as piles to you and it bothers you, the only change is a 1-line `detail:'low'→'high'` in `analyze.ts` before committing.
