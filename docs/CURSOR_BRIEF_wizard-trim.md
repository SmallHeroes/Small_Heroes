# Cursor Brief — Wizard Trim (15 → 10 steps)

**Owner:** CTO · **Date:** 2026-05-25 · **Status:** ready for Cursor
Background + rationale: `docs/WIZARD_TRIM_PROPOSAL.md`. **Decision made** — this brief is the final spec (a modified Path A: cut 4 clinical steps, merge 2 positive ones into one warm step).

**Priority note:** the home-page Pass 1 commit/redeploy and Phase 2 take precedence. This wizard trim runs in **parallel** — but it must NOT delay the Phase 2 reference probe.

---

## Why

A code trace confirmed the live story-bank pipeline ignores most of the wizard's emotional intake. The wizard asks a parent ~6 emotional questions that don't change the book. We're cutting the clinical ones and keeping two *positive* questions (reworded) as one warm "getting to know your hero" moment.

---

## Step 1 — CUT four steps + one field

Remove these wizard steps entirely (by function — map to the actual step ids in `wizard.js` / `content.js`):

- The **category deep follow-up** step (the 3-card sub-questions screen).
- The **"what's a bit hard lately" / challenges** step.
- The **"what helps day-to-day" / helpers** step.
- The **"what to keep out" / avoid** step.

And remove the **`traits`** field/chips from the child-details step (it's dead — never read).

Renumber the wizard, the progress bar total (**"מתוך 15" → "מתוך 10"**), the progress dashes, and the inter-step microcopy in `content.js` `wizard.microcopy` so the warm transition lines still match the new sequence.

---

## Step 2 — MERGE superpowers + goals into ONE warm step

Replace the two separate steps (superpowers, goals) with a **single new step**, placed **right after child-details**:

- **Step title:** `כמה מילים על [שם הילד]` — interpolate the child's name from the previous step; fallback `כמה מילים על הגיבור/ה שלכם` if empty.
- **Framing sub-line (honest, warm):** something like `לא חובה — זה עוזר לנו להכיר אותו/ה.` Do NOT claim it shapes the story.
- **Question 1:** `מה הכוח הכי גדול שלו/ה?` — chip-select, reuse the existing `superpowers` chip array.
- **Question 2:** `איזו תחושה הכי הייתם רוצים שתישאר איתו/ה?` — chip-select, reuse the existing `goals` chip array.
- Both questions optional / skippable.

**The entire step is fully optional.** The Continue CTA stays enabled at all times; an empty step produces NO validation error and NO blocking — a parent can skip straight through.

This is one screen with two question blocks — not two steps.

---

## Step 3 — Resulting 10-step flow

`1 Welcome → 2 Topic → 3 Companion → 4 Child details (no traits) → 5 "כמה מילים על [child]" → 6 Direction → 7 Style → 8 Addons → 9 Book name + dedication → 10 Summary + payment`

---

## Summary screen — hide empty optionals

The merged hero-notes (strength / feeling) are optional. On the **Summary screen (step 10)**, do NOT render empty optional fields — show the hero-notes line ONLY if the parent actually selected something. No blank rows, no empty labels, no "—" placeholders for skipped optional fields.

## Step 4 — Fix the Style 02 broken image

The style step shows **"עולם קסום" with a broken image** — Style 02 has no preview asset. This is a **blocker — it must not ship broken**. **Fix:** use `style-references/style-02-locked-samples/scene-04-forest-magical.png` as the Style 02 wizard preview — this sample is CTO-confirmed clean (no CGI / identity drift) from the gpt-image-2 audition QA. Copy it to wherever the wizard style previews live and wire it. It's a real, representative Style 02 image; the full gallery render replaces it later.

---

## Step 5 — Layout polish

Several wizard steps render content in the top third with a large empty band below. Tighten the vertical rhythm — vertically center the step content (or reduce the wasted min-height) so each step feels composed, not sparse.

---

## Data note — do NOT break the data layer

Cutting the steps means `categoryAnswers`, `difficulties`, `helpers`, `avoid`, and `traits` stop being collected — they go empty. The live pipeline already ignores them, so this is safe, BUT:

- **Do NOT delete the `Order` columns / schema fields.** The future recipe pipeline + the `{{patch:}}` layer reference them. Leave the DB schema untouched — just stop the wizard from collecting them.
- Confirm the order-creation route and `generate/route.ts` handle these fields being absent/empty **without error** (they should already — they're optional). Report if anything hard-requires them.

---

## Out of scope

- No story-engine / story-bank / recipe-pipeline logic changes.
- No `Order` schema / DB column changes — do NOT delete the DB fields for the cut steps.
- No payment-provider logic changes.
- Nothing that touches Phase 2 image wiring.

Report after the trim with an updated screenshot of the new flow (especially the new merged step and the fixed Style step).
