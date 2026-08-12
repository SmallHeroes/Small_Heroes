# Next-Generation Story Briefs

**Status:** staging only; no runtime, bank, render, or approval authority.

This directory contains the compact creative layer between the six companion bibles and full-story drafting.

## Authoritative inputs for one drafting session

Use only:

1. `../00_NEXT_GENERATION_STORY_CONTRACT.md`;
2. `STORY_WRITER_CONTRACT.md`;
3. the selected `../01_companions/<companionId>.md`;
4. exactly one structured story brief record from the set listed in `story-brief-catalog.json`.

Do not supply any V3/V5 story, old prompt, rejected spine, provider output, or another slot's brief.

## What a brief owns

A brief locks the story's creative identity: premise, child want, physical play rule, set-piece chain, companion-caused trouble, five or six high-level causal movements, discovery, child-owned climax, payoff, energy shape, humor, reread hooks, and exclusions.

It does **not** prewrite page prose or a page-by-page spine. ChatGPT decides exact dialogue, sentence rhythm, local blocking, and page allocation while obeying the locked causal movement and output contract.

## Workflow

```text
Guy reviews one brief
  → approved brief + matching companion bible + shared writer contract
  → ChatGPT produces one complete staging draft
  → deterministic format/personalization/story gates
  → Hebrew read-aloud edit and story critique
  → Guy content acceptance
  → separately approved versioned-bank migration
```

Brief acceptance does not approve prose. Draft acceptance does not approve bank integration or rendering.

## Catalog guarantees

- exactly 18 records: six MVP companions × three directions;
- page counts are locked to bedtime 8, adventure 12, fantasy 16;
- every story uses at least two meaningful set pieces for bedtime and three for adventure/fantasy;
- every brief contains five or six high-level causal movements, never a page-count-length spine;
- child references use `{{childName}}` plus distinct `{boy-form|girl-form}` chips where Hebrew grammar differs; slash gender and the generic singular child alias are rejected;
- every companion is causally indispensable;
- old-bank material appears only under `oldStoryAntiCopy`, never as a positive seed;
- all records remain `draft_for_guy_review` until Guy explicitly accepts them.
