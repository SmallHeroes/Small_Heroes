# Story Batch — 2026-05-28

**Goal.** 20 candidate stories for the AI-write → ChatGPT-edit → adapt-pass pipeline. 5 are golden-tier targets (Literary Shelf). 15 are bank expansion (lower acceptance bar, same pipeline).

**Workflow.**
1. **Guy** — runs each row through the AI story-writing site (English), using the prompt template (see `docs/LITERARY_SHELF_TRACKER.md` strategy section, or paste the structured prompt I gave on 2026-05-27).
2. **ChatGPT** — tightens to SmallHeroes voice (no magic cure, fear stays small but real, residue object, shared vulnerability).
3. **Me** — final adapt-pass: frontmatter port, gender chips, imageDirection coverage, WORD_COUNT, gate-pass for boy + girl. Then commit to `story-bank/v5-fixed-v2/`.

**Don't fight the writer.** No page-count rule, no nikud rule, no "must use {{childName}}" rule at AI-write time. Those get added later in the adapt-pass. The writer is free; the pipeline normalizes.

---

## TIER 1 — Golden literary (Shelf slots 1–5)

| # | Slot | Companion | Direction | Category | Status |
|---|---|---|---|---|---|
| 1 | 1 | `fox_uri` | adventure | NIGHT_FEAR | **SHIPPED** (`f96fbb9d`) |
| 2 | 2 | `chameleon_koko` | fantasy | TRANSITION | DRAFT — Gemini → ChatGPT editor in queue |
| 3 | 3 | `bolly_armadillo` | bedtime | NIGHT_FEAR | NEXT — bedtime gap on the shelf |
| 4 | 4 | `octopus_seara` | adventure | MEDICAL_PROCEDURE | QUEUED (Yuval-Seara dental, raw draft on hand) |
| 5 | 5 | `dolphin_shahkan` | adventure | FOCUS_LEARNING | NEW |

---

## TIER 2 — Bank expansion (15 stories)

Higher-volume categories first. Mix of directions to avoid one-direction monoculture in the bank.

| # | Companion | Direction | Category | Companion mechanic | Hint |
|---|---|---|---|---|---|
| 6 | `owl_chacham` | bedtime | NIGHT_FEAR | Wise owl with body that knows stillness in deep dark. | Owl whose hoot lowers, not vanishes, when child is scared. |
| 7 | `bat_lily` | bedtime | NIGHT_FEAR | Bat who navigates by listening, not seeing. | Echo as a way to know the dark instead of fearing it. |
| 8 | `firefly_namit` | adventure | GENERAL_FEARS | Firefly carrying small inner light through outer dark. | Light that doesn't conquer the dark — just sits inside it. |
| 9 | `gecko_rifa` | adventure | MEDICAL_PROCEDURE | Gecko whose skin changes color to match a hard surface. | "I held still on the wall while the cleaner came." |
| 10 | `seahorse_yam` | bedtime | MEDICAL_PROCEDURE | Seahorse anchored to seagrass with a curled tail. | Anchor when the current wants to pull you sideways. |
| 11 | `dragon_dini` | fantasy | NEW_SIBLING | Dragon whose fire doesn't burn — it warms. | Sharing the warm cave with a new dragon hatchling. |
| 12 | `bee_ima` | bedtime | NEW_SIBLING | Bee mother who carries pollen home to many. | The mother bee doesn't divide love — she duplicates it. |
| 13 | `squirrel_navad` | adventure | TRANSITION | Squirrel that buries acorns in remembered places. | Carrying small things from old place to new place. |
| 14 | `turtle_beiti` | bedtime | TRANSITION | Turtle that takes shell-home along on every journey. | Home moves with you — it doesn't stay behind. |
| 15 | `bear_cub_gahal` | adventure | ANGER_FRUSTRATION | Bear cub whose growl is loud but paws are soft. | Anger as a warm cave to enter, not a weapon. |
| 16 | `salamander_lahav` | bedtime | ANGER_FRUSTRATION | Salamander whose body knows how to cool from ember to coal. | Fire that calms without being put out. |
| 17 | `bear_mati` | adventure | SOCIAL | Slow gentle bear who introduces himself by listening. | Meeting new friends without being loud. |
| 18 | `panda_anat` | fantasy | SOCIAL | Panda who plays alone well and plays with others well. | Going to a group without losing yourself. |
| 19 | `song_whale` | bedtime | NOISE_FEAR | Whale whose deep low notes calm other creatures. | Big sound that is gentle, not scary. |
| 20 | `fawn_tzvi` | bedtime | SENSITIVITY_OVERWHELM | Fawn whose body wants to flee, but learns to stay. | "I stayed still when I wanted to run." |

---

## Per-story brief inputs (for the AI writer)

For each row above, fill the prompt template's 4 angle-bracket variables:

```
- שם מלווה: <Companion col + species in Hebrew>
- תפיסת המלווה: <Companion mechanic col>
- אתגר הילד: <Translate the Hint col into a specific child situation>
- כיוון: <Direction col>
```

Optional 5th (recommended for golden tier 1–5):
```
- worldRule: <One-sentence cause-effect: when child does X, world does Y>
- parallel fear: <The companion's own vulnerability that mirrors the child's challenge>
```

For tier 2 (rows 6–20), the 4 required variables are enough. ChatGPT's edit pass will add the missing details.

---

## Acceptance bar

**Golden tier (1–5)**: must pass all 8 validation checks (15 pages, imageDirection per page, WORD_COUNT footer, no Mustache leakage, no denylist hits, well-formed gender chips, `{{childName}}` on ≥5 pages, no English drift) + gate-pass for boy/בר + girl/נטע before commit.

**Bank expansion (6–20)**: same automated gates must pass, but read-aloud QA is **lighter**. Acceptable to ship at "competent compliant" level if literary tier doesn't land in the first edit pass. Goal is breadth, not perfection.

---

## What we don't do tomorrow

- ❌ Don't refactor the recipe pipeline. C-first.
- ❌ Don't add new companions. Use what's already in the bank.
- ❌ Don't expand this doc into a process tracker. It's a one-pager — when the 20 ship, archive it.
- ❌ Don't promise tier 2 will be golden-tier. Some will, some won't. That's the point.

---

## Memory references

- Strategy: `literary_first_story_direction.md` (C-first, parked)
- Empirical proof: `literary_gap_empirical_evidence.md` (chameleon A/B, 4 craft gaps)
- Shipped quality bar: `f96fbb9d` (Uri-fox commit) is the literary reference
- Tracker: `docs/LITERARY_SHELF_TRACKER.md` (5 slots — do not exceed)
