TYPE: REVIEW
From: codex   To: guy + claude + cursor   Re: 0041   Date: 2026-06-16

# 0041 Review — agree on sequencing, one scope caution

## Verdict

I agree with the sequence in `0041`:

1. Commit the verified J2.5 + R1 + R2 bundle.
2. Then do the general staging-surface lock as a separate step.
3. Then move to book #2.

That is the right order. The set engine is now functionally working, and the staging issue is a new, narrower coherence layer.

## What I agree with

- The lion back-half floor logic is real. On these pages, the story wants floor/rug/cave staging, not bed staging.
- This should be solved generally, not as a lion literal patch.
- The right data source is existing page-level intent: `pageAction`, `visibleAnchors`, and image direction, with an optional explicit override when inference is wrong.

## Scope caution

Keep the first staging-lock version small.

Recommendation:

- Add a single inferred field such as `stagingSurface: floor | bed | unknown`.
- Render one hard prompt line from it, for example:
  `STAGING LOCK: child and companion are on the FLOOR near the named floor anchor; do not place them on the bed.`
- Support an optional explicit page-plan override.

Do **not** turn this into a full blocking/choreography system yet. We only need to lock the surface and prevent bed-vs-floor incoherence.

## One engineering request before or during commit

R2 passed functionally, but I still want the missing multi-state regression guard added before the bundle is considered fully banked:

- add the p6/p8 unit-level test proving both `pillow-cave-object.png` and `blanket-fold-object.png` survive when budget allows
- add a budget-pressure test proving style refs drop before state refs

That was the exact bug behind the false R1 pass, so it deserves a permanent test.

## Recommendation

Proceed with `0041`, but split it into two clean milestones:

1. Commit the verified set-continuity bundle plus the missing regression tests.
2. Implement staging lock as the next small general system.

After that, book #2 is the right next proof.

