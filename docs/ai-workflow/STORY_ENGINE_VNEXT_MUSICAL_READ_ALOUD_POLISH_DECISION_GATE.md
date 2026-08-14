# Story Engine vNext Musical Read-Aloud Polish — Decision Gate

**Status:** Guy-authorized implementation on 2026-08-14
**Base:** `9ebc648f6cbbfaf32e8b16a1148e8237f60eaa4f`
**Scope:** general staging story-authoring system plus one Dini pilot; no bank/runtime/render activation

## Proposed change

Add a bounded musical read-aloud polish stage after an editorially passed story.
The stage may improve rhythm, sound-play, selective rhyme, sentence cadence,
onomatopoeia and page-turn energy, but may not alter plot, causal order, child
agency, companion behavior, locations, objects, payoff, ending or metadata.

The already-passed Dini candidate remains immutable. A polished variant is a
new staging draft and must pass the versioned Editor authority again before it
can become a replacement candidate.

## Why now

Guy and the external story writer independently reached the same product
judgment: the Dini story's physical movement and comedy can become more
memorable in oral reading through selective musicality, while full end-rhyme
would risk forced Hebrew and a regression to mechanical writing. The current
QA contract mentions rhythm but does not define this distinction, and the
pipeline has no safe post-pass polish route.

## Scope and root cause

This is a general system change. Musicality is currently an implicit taste
criterion, so a writer may either underuse it or overcorrect into a rhyming
scheme that serves sound instead of story. The solution is a separate closed
charter and a post-pass staging commission, not a Dini-specific rewrite and not
a global `must rhyme` instruction.

## Nine architectural decisions

1. Preserve every existing editorial-pass candidate byte-for-byte; musical
   polish always creates a new staging variant.
2. Permit selective end rhyme, internal rhyme, sound-play, onomatopoeia,
   rhythmic repetition and sentence/page-ending cadence only where they
   naturally amplify comedy, motion, tension or page-turn energy.
3. Prohibit full-story rhyme requirements, rhyme quotas, repeated slogans,
   filler, inverted syntax, unnatural vocabulary and any sacrifice of Hebrew
   clarity or story causality for sound.
4. Lock the story's title/identity, page count, event order, causal mechanism,
   child agency, companion actions, locations, recurring objects, climax,
   payoff and ending during polish. This is language polish, not a rewrite.
5. Keep gender-chip forms complete and do not make rhyme depend on one gender
   branch. A polished result must pass the existing canonical intake.
6. Create a versioned `small-heroes-musical-read-aloud-polish/v1` charter and a
   content-addressed staging-only polish commission bound to the exact passed
   draft and exact pass review.
7. Use a new Editor v3 authority for subsequent reviews. It treats musicality
   as an optional amplifier, never a mandatory quota, and diagnoses rhyme only
   when it makes Hebrew forced, unclear, sing-song or causally weaker.
8. A polished draft cannot supersede the existing candidate without a fresh
   closed Editor `pass` and Guy's product acceptance. Failure leaves the current
   passed candidate untouched.
9. General rollout to other stories reuses the same charter and gates; no
   story-, child-, companion-, page- or phrase-specific production logic is
   allowed.

## Files likely affected

- `story-pipeline/03_story_briefs/STORY_MUSICAL_READ_ALOUD_POLISH_CHARTER.md`
- `story-pipeline/03_story_briefs/STORY_DRAFT_EDITORIAL_QA_CONTRACT_V3.md`
- `scripts/materialize-story-commission-briefs.cjs`
- `lib/__tests__/story-commission-materializer.spec.ts`
- `CURRENT.md`
- implementation evidence for this milestone

## Validation and acceptance

- A valid pass-bound canonical story produces one content-addressed polish
  prompt and manifest.
- `revise`/`reject`, malformed/non-canonical drafts, unsafe inputs and reused
  roots fail closed without a prompt.
- The prompt contains the exact draft and charter but no Architect prompt,
  rejected option, full Editor contract, image direction or downstream
  authority.
- Tests prove all locked story surfaces and the no-forced-rhyme boundary are
  explicit.
- The Dini polish prompt is materialized at zero external cost. Its returned
  prose requires canonical intake and a new Editor review.

## Cost, rollback and exclusions

Implementation and materialization cost `$0`. No provider, credential, image,
audio, Vision, database, storage or deployment action is authorized. Rollback
reverts the implementation commit and ignores the new staging outputs; the
existing editorial-pass candidate remains the safe baseline.
Do not import a polished story, mutate the current candidate, change page
counts, generate images, touch Wizard/runtime, deploy QA/Production or push in
this milestone.
