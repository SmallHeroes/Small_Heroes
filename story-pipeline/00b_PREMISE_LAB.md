# Premise Lab — Next-Generation Tournament

**Status:** optional ideation tool. It is no longer a mandatory production gate and does not replace the structured brief catalog.

**Purpose:** find a story worth writing before spending effort on prose.

**Output:** twelve diverse candidates, deterministic hard-fail results, and three complete finalists.

**Forbidden output:** full story prose or page text.

Read first:

1. `00_NEXT_GENERATION_STORY_CONTRACT.md`
2. the selected `01_companions/<companionId>.md`
3. the direction and beat count only

Do **not** read old story prose, old premise files, or V3/V5 drafts before ideation. They are anti-copy constraints, not inspiration.

## Step 1 — Build twelve genuinely different candidates

Each candidate must fill the complete `StoryPremiseCandidate` shape used by `lib/story-gen-v3/types.ts`:

- `id`, `titleSeed`
- `resilienceTheme`, `hiddenResilienceTool`
- `oneLineHook`, `openingWeirdEvent`
- `childWant`, `whyItMattersToChild`
- `physicalProblem`, `playSystem`, `keyObjects`
- `companionComicEngineUsed`, `companionWrongHelp`
- `firstTry`, `whyFirstTryFails`, `funnyFailureImage`
- `escalation`, `childDiscovery`, `braveChildAction`
- `bigReleasePayoff`, `oneResilienceLineMax`
- `whyChildWillCare`, `whyParentWillCare`
- `whyNotTherapeuticFable`, `whyNotGoldenCopy`

The twelve candidates must occupy at least six premise families and may not be cosmetic variations of one object or setting.

Required diversity dimensions:

- at least three everyday-world ideas with one impossible intrusion;
- at least three object/creature absurdities;
- at least two moving-path or changing-map ideas;
- at least two ideas where the companion causes the mess;
- at least two quiet mysteries whose payoff is physical, not explanatory.

One candidate may satisfy more than one dimension, but no premise family may dominate more than three candidates.

## Step 2 — Hard-fail review

Reject a candidate when any next-generation story-contract premise gate fails. Also run the existing deterministic `validatePremiseHardFails` as supporting evidence, while recording false positives caused by its experimental story-specific heuristics.

Do not repair a rejected premise by adding a moral sentence, a magic emotion object, a new helper character, or a decorative location.

## Step 3 — Adversarial critique

For every survivor, answer:

1. Would the child still want this if the resilience category were removed from the brief?
2. Does the companion make the problem more alive, or merely accompany it?
3. Can the child own the climax without adult knowledge?
4. Are the failures causally different and funnier/harder each time?
5. Does every set piece change the game?
6. What will a child anticipate on reread?
7. What line, image, or timing might delight the adult reader?
8. What is the most likely route back to therapy-speak or template rhythm?
9. Does the direction's energy curve actually hold?
10. Does any old-bank plot residue remain?

## Step 4 — Score without surrendering judgment

Score 1–10 on:

- hook strength;
- comic engine;
- physical play;
- child agency;
- try/fail potential;
- payoff/release;
- companion specificity;
- visual/set-piece variety;
- low moralizing risk;
- emotional truth;
- parent reread value;
- oral-Hebrew potential.

Any score below 7 in child agency, companion specificity, or low moralizing risk disqualifies the candidate. Humor, oral-Hebrew potential, and parent reread value must each be at least 8 for a finalist.

Scores organize critique; they do not select a winner.

## Step 5 — Choose three finalists

The finalists must be meaningfully different in premise family, world shape, comic escalation, and payoff. Expand each finalist into a complete review card with:

- eight-beat/12-beat/16-beat event chain at sentence level only;
- named set pieces and transition purpose;
- three comic escalation beats;
- two try/fail mechanics;
- child-owned discovery and climax;
- bedtime/adventure/fantasy energy proof;
- continuity and illustration risks;
- explicit old-story non-copy statement.

Stop. If the tournament is used, Guy may choose a finalist and convert it into one complete `story-creative-brief/v1` record. Do not hand-author a page spine. Full drafting uses the accepted brief, matching companion bible, and `03_story_briefs/STORY_WRITER_CONTRACT.md`.
