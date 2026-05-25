# Wizard Audit & Trim Proposal

*CTO review, 2026-05-25. Based on a code-level trace of how wizard inputs flow into the LIVE generation pipeline.*

---

## The finding

The wizard is 15 steps. I traced what the **live product** actually does with each input. The live path selects a pre-written story by **companion + direction** and personalizes it with **name / gender / photo / style**. Against that:

**6 full wizard steps collect data the live product discards.** A parent answers six emotional questions about their struggling child — and the book that comes out is the same companion×direction bank story regardless.

---

## Per-field — what the live book actually uses

| Wizard input | Live book uses it? |
|---|---|
| Topic / category | ✅ — filters which companions are offered |
| Companion | ✅ — **primary story selector** (`companion_direction.md`) |
| Direction (bedtime/adventure/fantasy) | ✅ — story selector + price |
| Child name / gender / photo | ✅ — personalization (name pass, gender swap, illustrated likeness) |
| Child age | ✅ minor (cover + image prompt) |
| Illustration style | ✅ — image generation |
| Book name / dedication | ✅ — title + final page |
| **Category deep follow-up (step 3)** | ❌ dead on live path |
| **Superpowers (step 6)** | ❌ dead (~106 of 108 stories) |
| **Challenges / difficulties (step 7)** | ❌ dead (~106 of 108) |
| **Goals (step 8)** | ❌ dead (~106 of 108) |
| **Helpers (step 9)** | ❌ dead (~106 of 108) |
| **Avoid (step 10)** | ❌ dead on live path |
| **Traits (inside step 5)** | ❌ dead — persisted, never read |

## Why "dead" — the nuance

The personalization machinery (`{{patch:}}` slots) **is fully wired** — it *would* consume difficulties / helpers / goals / avoid / superpowers / the deep follow-up. It's inert only because the live story-bank files (`v5-fixed-v2`) contain **zero patch slots**. Those six steps were built for the **future recipe pipeline**, which isn't on the live path. Today they collect data that goes nowhere.

## This is an integrity issue, not just length

Asking a parent six emotional questions about their child's struggle — "what's hardest", "what helps them feel whole", "what should we keep out" — and then producing a book that ignores every one of those answers is **worse than not asking**. The wizard over-promises a depth of personalization the live product doesn't deliver. Trimming it is honesty, not just speed.

---

## Decision fork

**Path A — trim now (recommended).** Cut the 6 dead steps. The live wizard collects only what shapes the book: 15 → 9 steps. Faster, honest, better conversion. When the recipe pipeline (the future generative engine) ships, the emotional inputs come back — and then they're *real*. Re-adding wizard steps later is cheap.

**Path B — activate instead of cut.** Keep the emotional steps, but commit to adding `{{patch:}}` slots to the bank stories so those answers genuinely personalize the book. This makes the wizard's length earned — but it's a real content project across ~108 stories.

**My recommendation: Path A now.** Ship a short, honest wizard for launch. Path B (true per-answer personalization) arrives naturally with the recipe pipeline — don't block the wizard on it.

---

## Recommended trimmed flow (Path A): 15 → 9

| # | Step | Action |
|---|---|---|
| 1 | Welcome | Keep (or merge into step 2 — optional, → 8) |
| 2 | Topic | **Keep** |
| 3 | Category deep follow-up | **CUT** |
| 4 | Companion | **Keep** |
| 5 | Child details | **Keep** — remove the dead `traits` field |
| 6 | Superpowers | **CUT** |
| 7 | Challenges / difficulties | **CUT** |
| 8 | Goals | **CUT** |
| 9 | Helpers | **CUT** |
| 10 | Avoid | **CUT** |
| 11 | Direction | **Keep** |
| 12 | Style | **Keep** |
| 13 | Addons | **Keep** (revenue) |
| 14 | Book name + dedication | **Keep** |
| 15 | Summary + payment | **Keep** |

Result: **9 steps** (Welcome → Topic → Companion → Child details → Direction → Style → Addons → Book name → Summary). Optional further trim to 8 by folding Welcome into Topic, or merging Topic+Companion into one screen (topic filters, companions appear below).

Cutting these steps leaves the corresponding `Order` fields simply empty — they're nullable, no DB migration needed.

---

## Other fixes spotted in the wizard

- **Style 02 broken image** — the Style step shows "עולם קסום" with a broken-image placeholder. Style 02 has no preview asset. Needs a real preview (ties to the gallery render).
- **2-style realignment** — the style step already shows 2 styles with the new names (רך וחמים / עולם קסום) ✓.
- **Vertical layout** — several steps have a large empty band below the content (chips at top, dead space beneath). Tighten the vertical rhythm so steps feel composed, not sparse.

---

## When the recipe pipeline ships

The emotional inputs (difficulty detail, goals, helpers, avoid) are the **fuel of the future generative engine**. Cutting them from the wizard now does not lose anything permanently — when the recipe pipeline goes live (or when `{{patch:}}` slots are added to the bank), those steps return as **real** inputs that genuinely shape the book. Short honest wizard now; rich wizard when the engine can use it.
