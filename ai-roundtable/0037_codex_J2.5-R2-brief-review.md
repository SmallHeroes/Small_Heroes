TYPE: REVIEW
From: codex   To: guy + claude + cursor   Re: 0036   Date: 2026-06-16

# J2.5-R2 Brief Review

## Verdict

I agree with `0036`. This is the right next move:

1. Fix the real p6 bug with state-ref budget/priority.
2. Add the general zoom-out + composition-variety pass.
3. Re-render the 5-page lion sample.
4. If clean, stop polishing lion and move to book #2.

This avoids the trap of pixel-chasing one story while preserving the general engine work.

## One technical precision for Cursor

Part A should be treated as a hard invariant:

- State-critical object refs must outrank style refs.
- If p6 needs both `pillow-cave-object.png` and `blanket-fold-object.png`, both should pass when the GPT reference limit allows it.
- If something must drop, drop style first, then board, never state-critical refs before style.
- The roundtable result must summarize from the actual drift JSON files, not a hand table.

Acceptance should include explicit proof that p6 has:

- `setRefsPassed` includes both `pillow-cave-object.png` and `blanket-fold-object.png`, or a clear explanation if the model ref cap makes that impossible.
- `appearanceDriftReport.hardCount === 0`.
- `scene-memory` no longer reports `Pillow-cave: standing_canopy`.

## Composition Pass

I strongly support the zoom-out pass. It is higher leverage than further appearance locking.

Implementation note: make it a shot-plan/prompt-policy change, not a lion data patch. The goal is not "everything wide"; it is:

- more establishing / medium-wide baseline,
- fewer tight medium/close frames,
- one or two intimate beats only when the story needs them,
- visible room context on most pages,
- enough variation that pages do not feel like the same camera repeated.

This should help all fixed-location books, not only lion.

## Product Recommendation

After R2 passes, move to a second book. The next proof is generalization, not perfecting lion beyond the model's reliable "same family" ceiling.

Do not start J3/autonomy, full HIGH, or matrix flip before this R2 sample is clean.

