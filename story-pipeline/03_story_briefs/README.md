# Next-Generation Story Briefs

**Status:** staging only; no runtime, bank, render, or approval authority.

This directory contains the compact creative layer between the six companion bibles and full-story drafting.

## Editorial authorities and writer-facing dispatch

The full story contract, full companion bibles, writer contract and structured
briefs remain editorial source authorities. They are deliberately **not**
concatenated into the ChatGPT prompt: doing so made examples and review-only
fields behave like prescribed prose.

The deterministic dispatch projection uses only:

1. `STORY_WRITER_FREEDOM_CHARTER.md`;
2. one selected card from `companion-authoring-cards.json`;
3. one closed writer-facing projection of the selected structured brief;
4. commission identity and page/personalization metadata.

Do not supply any V3/V5 story, old prompt, rejected spine, provider output, or another slot's brief.

## What a brief owns

A brief locks the story's creative identity: premise, child want, physical play rule, set-piece chain, companion-caused trouble, five or six high-level causal movements, discovery, child-owned climax, payoff, energy shape, humor, reread hooks, and exclusions.

It does **not** prewrite page prose or a page-by-page spine. `lineTargets`,
sample dialogue, reread targets and anti-copy evidence are human-review data,
not writer input. ChatGPT decides exact dialogue, sentence rhythm, local
blocking and page allocation while obeying the causal movement and output
contract.

## Workflow

```text
Guy reviews one brief
  → approved source authority → compact freedom projection
  → ChatGPT produces one complete staging draft
  → deterministic format/personalization/story gates
  → Hebrew read-aloud edit and story critique
  → Guy content acceptance
  → separately approved versioned-bank migration
```

Brief acceptance does not approve prose. Draft acceptance does not approve bank integration or rendering.

## Create a copy-ready ChatGPT commission

The deterministic materializer projects the full editorial authorities into
the compact writer-facing dispatch described above. It records source paths
and digests in the manifest for provenance without copying the full source
documents into the prompt. It does not call a model or read credentials.

List the 18 available commissions:

```powershell
node scripts/materialize-story-commission-briefs.cjs list
```

Materialize one accepted brief into a new empty directory:

```powershell
node scripts/materialize-story-commission-briefs.cjs materialize `
  --brief-id dragon_dini_adventure_wobble_cake_convoy_brief_v1 `
  --output-dir outputs/story-commissions/dini-adventure
```

Materialize all 18 for editorial review or later dispatch:

```powershell
node scripts/materialize-story-commission-briefs.cjs materialize-all `
  --output-dir outputs/story-commissions/all-18
```

Every generated Markdown bundle is self-contained and content-addressed. The
output directory also contains a Hebrew `INDEX.md` with a direct link to every
copy-ready prompt. Its manifest records both the text-page count and the physical-page count:
bedtime 8/16, adventure 12/24, fantasy 16/32. Generated files remain staging
artifacts, not approved-bank or render authority.

## Catalog guarantees

- exactly 18 records: six MVP companions × three directions;
- page counts are locked to bedtime 8, adventure 12, fantasy 16;
- every story uses at least two meaningful set pieces for bedtime and three for adventure/fantasy;
- every brief contains five or six high-level causal movements, never a page-count-length spine;
- child references use `{{childName}}` plus distinct `{boy-form|girl-form}` chips only where Hebrew grammar differs; naturally gender-invariant Hebrew remains unchipped;
- deterministic guards reject malformed placeholder syntax and undeclared structure, while the linguistic correctness, order, and coverage of Hebrew chip variants remain an explicit human language-QA responsibility;
- every companion is causally indispensable;
- old-bank material appears only under `oldStoryAntiCopy`, never as a positive seed;
- all records remain `draft_for_guy_review` until Guy explicitly accepts them.
