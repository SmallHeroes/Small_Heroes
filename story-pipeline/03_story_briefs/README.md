# Next-Generation Story Briefs

**Status:** staging only; no runtime, bank, render, or approval authority.

This directory contains the creative authorities between the six companion bibles and full-story drafting.

## Existing 18-slot dispatch

The v2 materializer remains byte-contract compatible. It can still list and
materialize the 18 curated slots, but its writer-facing rails have now been
shown to over-prescribe plot in the Dini cake example. Existing v2 outputs are
historical staging evidence, not preferred creative proof and not bank or
render authority.

The v2 dispatch continues to use:

1. `STORY_WRITER_FREEDOM_CHARTER.md`;
2. one selected card from `companion-authoring-cards.json`;
3. one closed writer-facing projection of the selected structured brief; and
4. commission identity and page/personalization metadata.

Do not change or migrate all 18 records merely because a new prompt is shorter.
Product evidence must establish that story quality actually improved.

## Story Architect pilot

The current experiment deliberately covers only
`dragon_dini_adventure_wobble_cake_convoy_brief_v1`.

Its creative workflow is:

```text
small creative nucleus + Dini's inner psychology
  → Story Architect proposes exactly three genuinely different shapes
  → STOP: Guy selects A, B or C
  → Writer receives only the selected direction and writes the story freely
  → separate post-draft editorial QA
  → only then derive structured metadata and image directions
```

The Architect does not receive the previous opening, beat sequence, companion
choreography, discovery, solution, climax, payoff or ending. The companion
portrait describes why Dini acts, not which wing, tail, object or maneuver she
must use. The three options must differ in their comic engine, journey,
obstacles, discovery, climax principle, payoff and surprise.

`STORY_DRAFT_EDITORIAL_QA_CONTRACT.md` retains the strict Small Heroes quality
standard after drafting. It is intentionally not dispatched to the Architect
or first-draft Writer, so quality checks do not prewrite the plot.

## Materialize the pilot

The command below writes a self-contained, content-addressed prompt and a
manifest. It does not call a model, use credentials or modify the story bank.

```powershell
node scripts/materialize-story-commission-briefs.cjs materialize-architect-pilot `
  --brief-id dragon_dini_adventure_wobble_cake_convoy_brief_v1 `
  --output-dir outputs/story-architect-pilot-dini-cake-v1
```

Paste the complete Markdown prompt into a new ChatGPT conversation. The first
response must contain three shapes and end with `WAITING_FOR_GUY_SELECTION`.
Do not ask it to write the story yet. Guy chooses one option first.

Only if this A/B pilot demonstrates materially better originality, story
pleasure and visual variety without losing coherence should the pattern be
generalized to the other 17 slots.

## Existing v2 commands

```powershell
node scripts/materialize-story-commission-briefs.cjs list

node scripts/materialize-story-commission-briefs.cjs materialize `
  --brief-id dragon_dini_adventure_wobble_cake_convoy_brief_v1 `
  --output-dir outputs/story-commissions/dini-adventure

node scripts/materialize-story-commission-briefs.cjs materialize-all `
  --output-dir outputs/story-commissions/all-18
```

Every generated file remains staging-only. Brief acceptance does not approve prose.
Draft acceptance does not approve bank integration or rendering.
Do not supply any V3/V5 story, rejected spine or provider output as positive
authoring context.

## Catalog guarantees

- exactly 18 records: six MVP companions × three directions;
- page counts remain bedtime 8, adventure 12 and fantasy 16 text pages;
- every full editorial brief remains available for post-draft review;
- child references use `{{childName}}` plus distinct `{boy-form|girl-form}` chips only where Hebrew grammar differs;
- every companion remains causally indispensable;
- old-bank material remains anti-copy evidence, never positive authoring input;
- all records remain `draft_for_guy_review` until Guy explicitly accepts them.
