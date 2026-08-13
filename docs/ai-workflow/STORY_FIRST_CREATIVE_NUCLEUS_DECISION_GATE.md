# Story-First Creative Nucleus — Decision Gate

**Status:** approved by Guy on 2026-08-13 through direct product instruction: “יאללה תתקן”.

**Milestone:** prove, with one isolated Dini A/B pilot, that separating story architecture from prose authoring removes residual screenplay pressure while retaining the curated story identity and quality standard.

**Branch/worktree:** `codex/story-bank-next-generation-briefs-qa-integration` at `C:\Users\guyna\.codex\worktrees\storyqa1\Small_Heroes`, exact base `99c1e9ede6507b153c4df37b388864fdf3afd4ed`.

## Observed behavior

The v2 freedom projection removed sample dialogue and internal editorial fields, but the returned Dini draft still reproduced the supplied plot almost page for page. The writer received an exact opening, physical rule, six ordered movements, companion complication, discovery, climax action, payoff, ending and recurring-object list. The same wing/tail/build/remove pattern was repeated by the companion card. The output format also required the writer to declare a world rule, recurring gag, child action, visual set and per-page image directions before or alongside the prose.

The prompt was shorter but retained low narrative entropy: it granted sentence-level freedom while pre-authoring the story's actions, solution and ending.

## Expected behavior

The Story Architect receives only a small premise nucleus, the future page contract and the companion's inner psychology. It does not receive the source brief's working title, product-category label, exact child deadline or hidden thematic sentence. It returns exactly three genuinely different story shapes and stops for Guy's selection. Only the selected shape proceeds to a separate Writer stage, where the writer invents the opening, escalating incidents, comic construction, physical manifestations, discovery, solution, climax, ending, dialogue, objects and page allocation.

Quality standards remain strict, but they are applied after drafting through a separate editorial QA contract. Structured story metadata and image directions are also derived later, so neither QA nor production schemas make the author write like a specification compiler.

## Root cause

`projectBriefForWriter` copied `lockedCausalMovement` verbatim and separately repeated its components through `openingHook`, `physicalProblem`, `playRule`, `companionWrongHelp`, `childDiscovery`, `childClimaxAction`, `visiblePayoff`, `endingEnergy`, recurring objects and model-freedom fields. The v1 companion card described not only inner character but recurring actions and body-part mechanics. Redundant authority made the most literal completion the safest completion.

## Nine decisions

1. Preserve the existing 18-brief v2 materializer, all full creative briefs and all companion bibles unchanged; do not migrate the catalog before product evidence exists.
2. Create exactly one staging-only pilot nucleus for `dragon_dini_adventure_wobble_cake_convoy_brief_v1`; it preserves the premise and page direction, not the source working title, category label, exact deadline, theme sentence or former plot solution.
3. Describe Dini for the pilot only through inner psychology, relationship capacity and changeability. Do not supply recurring choreography, body-part mechanics, materials, catchphrases or required sequences.
4. Add a distinct Story Architect stage that returns exactly three genuinely different shapes and stops with `WAITING_FOR_GUY_SELECTION`; it must not write prose or silently choose a winner.
5. Require meaningful differences across comic engine, obstacles and visual movement, Dini's behavioral manifestation, child discovery, climax principle, payoff and surprise.
6. After Guy chooses A, B or C, the Writer receives the chosen direction as a premise rather than a screenplay. Rejected options are not blended back in.
7. Keep quality constraints in a separate post-draft editorial QA contract. Child agency, escalation, humor, read-aloud Hebrew, companion indispensability, payoff and category fit are evaluated after creation, not used to pre-author the plot.
8. Materialize a new content-addressed Story Architect pilot artifact and manifest without calling a model. Prior v2/v4 outputs and all 18 source briefs remain historical and immutable.
9. Do not expand to the other 17 slots unless the Dini pilot produces product-level evidence that the new structure materially improves originality, story pleasure and visual variety without losing coherence.

## Rejected alternatives

- Adding “be more imaginative” while retaining the exact beat sheet: contradictory and untestable.
- Removing only the Dini wing/tail/props: story-specific and leaves the same failure for every companion.
- Asking for image directions in the same pass: continues to split attention between prose and production metadata.
- Deleting all identity and emotional authority: produces generic stories and makes the companion swappable.
- Migrating all 18 briefs before comparing a pilot: creates broad churn without proving that story quality improved.
- Asking one model call to pitch, select, write and audit alternatives: hides the creative decision and encourages summary-like prose.

## Acceptance criteria

- The pilot prompt contains no source `lockedCausalMovement`, exact opening, physical rule, wrong-help action, discovery, climax, payoff, ending, recurring object list or previous Dini choreography.
- Stage 1 requests exactly three shapes, no prose or page spine, no recommendation, and an exact waiting marker.
- Stage 2 is explicitly unavailable until Guy selects one shape; rejected shapes cannot contaminate the selected story.
- The post-draft QA contract exists as a separate authority and is provably absent from the Architect prompt.
- The existing v2 18-commission materializer retains its version, output shape and tests unchanged.
- The pilot is content-addressed, fail-closed, staging-only and limited to one Dini brief.
- Runtime, Wizard, Reader, approved banks, provider/model/image pipeline, Production and the other 17 briefs remain unchanged.

## Rollback

Revert the focused pilot commit and continue using the unchanged v2 materializer. No approved, runtime or catalog artifact requires migration.

## Cost and exclusions

External cost is `$0`. No story generation, credential, network/provider/model call, bank import, image/audio/Vision render, database/storage action, QA deployment, Production action or push is authorized by this implementation milestone.
