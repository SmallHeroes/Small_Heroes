# Story Pipeline — Next-Generation Staging

This directory is the non-runtime writers' room for future Small Heroes stories. It does not authorize bank imports, runtime selection, renders, or customer orders.

## Authority boundary

- `story-bank/v3-approved/` remains the active approved bank and is immutable for this work.
- Existing files in `02_prompts/` and `02_prompts/drafts/` predate the next-generation contract. Unless a file explicitly says otherwise, treat it as **historical R&D**, not as a plot seed, quality reference, or approval artifact.
- `story-bank/v5-fixed-v2/` material must not be treated as runtime authority or a creative source for new stories.
- New work begins from the companion bible plus the next-generation contract, never from old story prose.

## Current flow

```text
approved creative contract
  → companion story bible
  → 12 premise candidates from blank
  → hard-fail + diversity review
  → 3 complete finalists
  → Guy selects 1
  → story spine + page beats
  → Guy approves prose work
  → Hebrew draft + read-aloud edit
  → technical format validation
  → Guy content acceptance
  → separately approved versioned-bank integration
```

Skipping the premise or spine gates is not allowed. “Correct but forgettable” stories are usually already broken before prose.

## Files

| Path | Role |
|---|---|
| `00_NEXT_GENERATION_STORY_CONTRACT.md` | Current creative and acceptance contract. Start here. |
| `00b_PREMISE_LAB.md` | Current premise-tournament procedure. |
| `01_companions/*.md` | Staging story bibles for the six active MVP companions. |
| `02_prompts/drafts/chameleon_koko__bedtime.premises.md` | First next-generation pilot tournament; three finalists only, no prose authority. |
| `00_MASTER_STORY_PROMPT_TEMPLATE.md` | Legacy prose template. Do not use for next-generation prose until a later milestone replaces it. |
| Other `02_prompts/**` | Historical experiments; non-authoritative for new plots. |

## Locked pilot scope

The first pilot is `chameleon_koko` × `bedtime` at 8 beats. This stage stops at three finalists. It does not select a winner, write page beats, or write prose.

## Non-negotiable checks

- Visible plot first; resilience remains the underlayer.
- The child wants, tries, fails, discovers, and owns the climax.
- The companion's flaw produces wrong help and comedy.
- Bedtime means a descending energy curve, not a bedroom requirement.
- Meaningful locations/set pieces change the action.
- Hebrew is later written for oral reading, not as translated therapy prose.
- Old stories remain immutable and cannot donate plot, scene order, catchphrases, or payoff objects.
