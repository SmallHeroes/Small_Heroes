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
  → one structured creative brief per slot
  → Guy accepts or revises the premise
  → ChatGPT writes one complete staging draft from the shared contract
  → deterministic format/story review
  → Hebrew read-aloud edit
  → technical format validation
  → Guy content acceptance
  → separately approved versioned-bank integration
```

The brief gate replaces a hand-authored page spine. It locks the creative premise and causal movement without making humans prewrite every page. “Correct but forgettable” stories are usually already broken before drafting.

## Files

| Path | Role |
|---|---|
| `00_NEXT_GENERATION_STORY_CONTRACT.md` | Current creative and acceptance contract. Start here. |
| `00b_PREMISE_LAB.md` | Optional premise-tournament procedure; no longer a mandatory production gate. |
| `01_companions/*.md` | Staging story bibles for the six active MVP companions. |
| `02_prompts/drafts/chameleon_koko__bedtime.premises.md` | Historical pilot tournament; Guy selected B before replacing the manual-spine workflow. |
| `03_story_briefs/STORY_WRITER_CONTRACT.md` | Shared ChatGPT contract for complete staging drafts. |
| `03_story_briefs/story-brief-catalog.json` | Manifest for the 18 MVP creative briefs. |
| `03_story_briefs/briefs/*.json` | One premise brief for every companion × direction slot; awaiting Guy review. |
| `00_MASTER_STORY_PROMPT_TEMPLATE.md` | Legacy prose template. Do not use; the shared writer contract replaces it for next-generation staging. |
| Other `02_prompts/**` | Historical experiments; non-authoritative for new plots. |

## Current milestone

The catalog covers all 18 MVP slots. It writes briefs and a shared ChatGPT contract only. It does not generate prose, edit an approved bank, call a provider, or authorize a render. The earlier `chameleon_koko` × `bedtime` selection survives as one brief; its rejected manual page spine is not used.

## Non-negotiable checks

- Visible plot first; resilience remains the underlayer.
- The child wants, tries, fails, discovers, and owns the climax.
- The companion's flaw produces wrong help and comedy.
- Bedtime means a descending energy curve, not a bedroom requirement.
- Meaningful locations/set pieces change the action.
- Hebrew is later written for oral reading, not as translated therapy prose.
- Old stories remain immutable and cannot donate plot, scene order, catchphrases, or payoff objects.
- A generated draft is untrusted staging output until deterministic review, oral edit, Guy acceptance, and a separately approved bank migration.
