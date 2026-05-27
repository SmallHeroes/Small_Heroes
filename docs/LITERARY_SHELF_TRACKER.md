# Literary Shelf Tracker

**Purpose.** Single visible counter for the C-first strategy: ship 5 hand-tuned literary-tier rewrites into `story-bank/v5-fixed-v2/` before touching the recipe pipeline.

**Don't expand this file.** It is not a workflow tracker, a kanban, a methodology doc, or a brief template. It's a 5-row checklist. If it starts to look like anything else, delete the new section.

---

## Strategy in one breath

1. Recipe pipeline produces *competent compliant* prose, not literary. Empirically demonstrated (chameleon_koko A/B, 2026-05-26).
2. C-first: hand/AI-edit 5 golden examples, drop them into the production bank.
3. Only after 5 golden examples ship do we revisit the recipe pipeline — and then only as a **few-shot generator** trained on those examples. No refactor until then.

---

## The 5 slots

| # | Story | Status | Commit | Notes |
|---|---|---|---|---|
| 1 | `fox_uri_adventure.md` (אוּרִי וּמַפַּת הַצְּלָלִים) | **SHIPPED** | `f96fbb9d` 2026-05-27 | Manual rewrite + ChatGPT QA. Gate passes for boy/girl + substring fix verified. |
| 2 | `chameleon_koko_fantasy.md` | DRAFT — awaiting ChatGPT editor pass on Gemini draft | — | Tasks #14–16 in queue. |
| 3 | TBD — pick by commercial priority | empty | — | |
| 4 | `octopus_seara_adventure.md` (יובל וסיארה במרפאת השיניים של הים) | QUEUED — raw draft received 2026-05-27, adapt-pass deferred | — | Golden-tier quality. Keep `octopus_seara` companion (story proves she fits medical/anxiety regulation, even though her current bank category is ANGER_FRUSTRATION). Direction = adventure (journey/visit/return arc, not bedtime). Main blocker: 16 → 15 pages — preferred compression is **merge p6+p7**, NOT p14+p15 (ending needs breathing room). Adapt-pass must include: `{{childName}}`, gender chips (~50), YAML frontmatter, imageDirection per page, WORD_COUNT footer, gate pass for boy + girl. |
| 5 | TBD — pick by commercial priority | empty | — | |

---

## Picking slots 3–5

Choose by **launch-shelf traffic potential**, not by personal taste. Order of selection criteria:

1. **Direction × category combo** likely to hit highest order volume on launch.
2. **Companions already in the launch shelf** (bolly_armadillo, bat_lily, chameleon_koko, octopus_seara, dolphin_shahkan, fawn_tzvi — see `deep_companion_schema.md`).
3. **Avoid one-direction monoculture**: aim for at least one bedtime, one adventure, one fantasy across all 5 slots.

Current direction spread: 2 adventure (Uri-fox shipped, Yuval-Seara queued slot 4), 1 fantasy slated (chameleon_koko slot 2), 0 bedtime. Slot 3 should still be **bedtime** unless commercial data overrides.

---

## Definition of "SHIPPED"

A slot moves to **SHIPPED** only when ALL of:
- `.md` file replaces existing in `story-bank/v5-fixed-v2/`
- All 8 light-validation checks pass (15 pages,