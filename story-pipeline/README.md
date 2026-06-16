# Story Pipeline — Small Heroes

A parallel track for writing story slots **with ChatGPT**, independent of the image-engine work. You drive the drafting with ChatGPT; Claude provides the prompts + QA; Cursor imports approved drafts to the bank.

## The flow

```
Claude (companion sheet + prompts)
      → you + ChatGPT  Mode A: Premise Lab — generate + score 6–10 ideas → pick 1   ⭐ the quality lever
      → you + ChatGPT  Mode B: draft the full Hebrew story from the chosen premise
      → Claude         gender-chip QA + validators + canon/swap check + read-aloud
      → you            approve
      → Cursor         import to story-bank, wire to matrix
```

> **Why two modes:** if you hand the model a one-line premise it commits to its first (generic) idea. The Premise Lab forces options and a brutal score first. Skipping it is the #1 cause of "correct but forgettable" stories.

## What's here

| File / folder | What it is |
|---|---|
| `00b_PREMISE_LAB.md` | **Mode A — start here.** Generate + score 6–10 premise candidates, pick one. |
| `00_MASTER_STORY_PROMPT_TEMPLATE.md` | **Mode B** — write the full story from the chosen premise. |
| `01_companions/` | One sheet per MVP companion: characterization (paste-block) + visual character-sheet spec + missing slots + ⭐ per-companion slot requirement + do-not-write list. |
| `02_prompts/` | Fully-written, ready-to-paste worked prompts for specific slots (run the lab first, then these). |
| `02_prompts/drafts/` | Put ChatGPT's returned drafts here, then ask Claude to QA. |

## Companion sheets

| Companion | Category | Gender | Profile source |
|---|---|---|---|
| אוּרי השועל (`fox_uri`) | NIGHT_FEAR | male | code deep-profile |
| עֲנָת הפנדה (`panda_anat`) | SOCIAL | female | code deep-profile |
| בּוּני הארנבון (`bunny_ometz`) | MEDICAL_PROCEDURE | male | **authored here** (verify) |
| דיני הדרקונית (`dragon_dini`) | NEW_SIBLING | female | code deep-profile |
| קים הזיקית (`chameleon_koko`) | TRANSITION | female | code deep-profile |
| ליאו האריה (`lion_shaket`) | ANGER_FRUSTRATION | male | **authored here** (verify) |

## Slot tracker — 10 missing (the work)

Status: ⬜ not started · ✏️ drafting · 🔍 QA · ✅ approved (sellable)

| # | Companion | Direction | Beats | Worked prompt ready? | Status |
|---|---|---|---|---|---|
| 1 | `fox_uri` | fantasy | 16 | ✅ `02_prompts/fox_uri__fantasy.md` | ⬜ |
| 2 | `panda_anat` | bedtime | 8 | ✅ `02_prompts/panda_anat__bedtime.md` | ⬜ |
| 3 | `panda_anat` | fantasy | 16 | template | ⬜ |
| 4 | `bunny_ometz` | fantasy | 16 | template | ⬜ |
| 5 | `dragon_dini` | bedtime | 8 | template | ⬜ |
| 6 | `dragon_dini` | adventure | 12 | ✅ `02_prompts/dragon_dini__adventure.md` | ⬜ |
| 7 | `chameleon_koko` | bedtime | 8 | template | ⬜ |
| 8 | `chameleon_koko` | fantasy | 16 | template | ⬜ |
| 9 | `lion_shaket` | bedtime | 8 | golden draft exists (v5) — verify/import | ⬜ |
| 10 | `lion_shaket` | fantasy | 16 | template | ⬜ |

> The 8 already-sellable slots (fox bedtime/adventure, panda adventure, bunny bedtime/adventure, dragon fantasy, koko adventure, lion adventure) are NOT in this tracker — they're done. This track fills the remaining 10 to reach the full 18.

## Priority order (creative, not just operational)

1. **`panda_anat` bedtime** — her best direction; proves the system can produce *non-generic gentleness* (the hardest thing). Needs the social-residue object.
2. **`fox_uri` fantasy** — אוּרי is the strongest, most ready companion; closes NIGHT_FEAR to 3/3. Needs the one central mystery with accumulating clues.
3. **`dragon_dini` adventure** — guarded weak-direction; do it once you have energy (easy to drift to "generic guardian dragon"). Show the boundary, don't explain it.
4. **`bunny_ometz` fantasy** — bunny is now strengthened (ear-meter signature engine); run only with that engine front-and-center.
5. **`chameleon_koko` bedtime / fantasy** — after you've chosen a strong concrete home-token.
6. **lion bedtime (#9)** — a strong golden draft already exists in `story-bank/v5-fixed-v2/lion_shaket_bedtime.md`; likely verify + import, not fresh writing. `lion` fantasy needs a *new* thunder vessel (not the bedroom).

> For every **new bank slot: Premise Lab is required**, not optional — the "default premise" in the worked prompts is for debug/demo only, never for a banked story.
> **Mandatory story-spine step** (premise → spine + page-beats → eyeball arc → only then prose) for the five fragile slots: **fox·fantasy, dragon·adventure, bunny·fantasy, chameleon·fantasy, lion·fantasy**. These are exactly where a good idea breaks in the structure.

## Rules that keep drafts shippable (why the QA pass exists)

- **Bank format is enforced in code.** Frontmatter keys, `--- Page N ---` blocks, page count = beats. A malformed draft fails import.
- **Gender chips** `{זכר|נקבה}` on every child-word + `{{childName}}` everywhere. The Hebrew `\b` word-boundary bug means a missed chip can silently no-op — Claude checks every one.
- **Companion canon** (gender lock, canonical accessory, do-not-write) is asserted; a fox written as cunning, or dini painted green, gets bounced.
- **One complete brief to Cursor** — when a batch of slots is approved, Claude consolidates them into a single import brief, not piecemeal.
