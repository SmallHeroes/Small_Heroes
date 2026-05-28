# Literary Shelf Tracker

**Purpose.** Single visible counter for the C-first strategy: ship hand-tuned literary-tier rewrites into `story-bank/v5-fixed-v2/` before touching the recipe pipeline.

**Don't expand this file.** It is not a workflow tracker, a kanban, a methodology doc, or a brief template. It's a checklist. If it starts to look like anything else, delete the new section.

---

## Locked rules (do not violate)

**Page count is determined by direction. Single source of truth, no exceptions:**

| Direction | Pages | Age | Price |
|---|---|---|---|
| **bedtime** (לפני שינה) | **10** | 4–6 | ₪59 |
| **adventure** (הרפתקה) | **15** | 6–8 | ₪79 |
| **fantasy** (פנטזיה) | **20** | 6–8 | ₪99 |

Bank uses **one file per `<companion>_<direction>.md`** — no `ageBand` variants. Each direction targets one age range. A literary rewrite that doesn't match its direction's page count is DRAFT, not SHIPPED.

---

## Strategy in one breath

1. Recipe pipeline produces *competent compliant* prose, not literary. Empirically demonstrated (chameleon_koko A/B, 2026-05-26).
2. C-first: hand/AI-edit 5 golden examples, drop them into the production bank.
3. Only after 5 golden examples ship do we revisit the recipe pipeline — and then only as a **few-shot generator** trained on those examples. No refactor until then.

---

## The slots

| # | Story | Pages | Status | Commit | Notes |
|---|---|---|---|---|---|
| 1 | `fox_uri_adventure.md` (אוּרִי וּמַפַּת הַצְּלָלִים) | 15 ✓ | **SHIPPED** | `f96fbb9d` 2026-05-27 | Manual rewrite + ChatGPT QA. Gate passes for boy/girl + substring fix verified. |
| 2 | `chameleon_koko_fantasy.md` | 20 (target) | DRAFT — awaiting ChatGPT editor pass on Gemini draft | — | Tasks #14–16 in queue. |
| 3 | `bolly_armadillo_bedtime.md` (בולי שנפתח לאט) | **15 ✗** | **NEEDS CUT** | `ace52726` 2026-05-28 | Originally 15 pages; rule lock 2026-05-28 says bedtime=10. Needs literary cut to 10 (remove repetition, not compress) before counting as golden under new rule. |
| 4 | `octopus_seara_adventure.md` (יובל וסיארה במרפאת השיניים של הים) | 15 (target) | QUEUED — raw draft received 2026-05-27, adapt-pass deferred | — | Golden-tier quality. Keep `octopus_seara` companion. Direction = adventure. Main blocker: 16 → 15 pages — preferred compression is **merge p6+p7**, NOT p14+p15. Adapt-pass must include: `{{childName}}`, gender chips (~50), YAML frontmatter, imageDirection per page, WORD_COUNT footer, gate pass for boy + girl. |
| 5 | `dolphin_shahkan_adventure.md` ({{childName}} ודודי מחפשים את הצדף הקטן) | 15 ✓ | **SHIPPED** | `a09ce577` 2026-05-28 | Literary rewrite. FOCUS_LEARNING, residue = pink spiral shell with soft hum. Companion name corrected שחכן→דודי. Gate passes 3/3. |
| 6 | `owl_chacham_bedtime.md` ({{childName}} ובובו מקשיבים ללילה) | **10 ✓** | **SHIPPED** | `bd783105` 2026-05-28 | First story under new bedtime=10p rule. NIGHT_FEAR. Heart line p10 "וחושך עם שמות הוא חושך קטן יותר". Mechanic: naming sounds to shrink them, one at a time. Gate passes 4/4 (boy/בר, girl/נטע, boy/דניאל, girl/Mika). |

---

## Definition of "SHIPPED"

A slot moves to **SHIPPED** only when ALL of:
- `.md` file replaces existing in `story-bank/v5-fixed-v2/`
- **Page count matches direction rule** (bedtime=10, adventure=15, fantasy=20)
- All light-validation checks pass (imageDirection per page, WORD_COUNT footer, no Mustache leakage, no denylist hits, well-formed gender chips, `{{childName}}` on ≥5 pages, no English drift)
- `runStoryPersonalizationGate` passes for both `boy` + `girl` test names
- One focused commit `feat(story-bank): upgrade <slug>`

Anything in the table that doesn't meet all four is **DRAFT**, not SHIPPED.

---

## When this hits 5 SHIPPED golden

Currently SHIPPED under new rule: 3 (Uri-fox, Dudi, Bubu). Bolly needs page-count cut to count. When 5 SHIPPED under new rule, revisit recipe pipeline via few-shot generato