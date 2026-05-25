# Cursor Brief — Phase 2: Wire Style 02 (gpt-image-2) into the Book Pipeline

**Owner:** CTO · **Date:** 2026-05-25 · **Status:** ready for Cursor · **v2** (numeric cost gate, reference-budget probe, identity/wardrobe locks, manifest metadata, explicit out-of-scope)
This is a **gated TEST phase**, not a ship. CTO QA approves before anything reaches live customer generation.

---

## Context

Style 02 is locked: **gpt-image-2**, `images.edit`, scene-typed style references. The lock was proven **in isolation** (style-only auditions) — never in the book pipeline. Phase 2 connects it to the real book generator (`generateAllPageImages`) and tests it end-to-end. It is fundamentally a **reference-budget test**: can Style + child + companion all be carried within one generation call.

**Reference implementation:** `scripts/run-style-audition-style02-gptimage2.ts` is the canonical working Style 02 config — exact brief text, API mode, reference handling. Lift from it; do not re-derive. Locked spec also in `docs/STYLE_DEFINITIONS.md` (Style 02) and `style-references/style-02-locked-samples/manifest.json`.

---

## OUT OF SCOPE — do not touch

- No Style 01 work of any kind.
- No reader / PDF / video changes.
- No story-engine / story-bank / recipe-pipeline changes.
- No production rollout; no wiring into live customer generation.
- The legacy Flux path stays fully intact behind existing flags.

Phase 2 = the Style 02 gpt-image-2 path + a gated test. Nothing else.

---

## The reference-budget problem (the core of Phase 2)

gpt-image `images.edit` had a **4-reference cap** on gpt-image-1 (`GPT_IMAGE_EDIT_MAX_REFERENCES`). The audition used **all 4 for STYLE**. A book page also needs **CHARACTER identity** — the child and the companion. Style and character share the budget.

- **Step 0:** check gpt-image-2's actual reference-image limit. If it is **higher than 4**, the tension mostly dissolves (4 style refs + child + companion). If still **4**, the probe in Step 4 decides the split.
- **Do NOT assume** "2 style + child + companion" holds. It is one candidate, tested in Step 4 — not a given.

---

## Step 1 — gpt-image-2 cost gate (NUMERIC; do first)

Produce a numeric table — no qualitative answers:

| Metric | Value |
|---|---|
| Cost per image (1024×1536, high quality) | $… |
| Projected raw image cost — 10 / 15 / 20 pages | $… / $… / $… |
| Retry multiplier assumed (reroll / failure overhead, e.g. 1.2–1.5×) | …× |
| Projected real image cost per book incl. retries — 10 / 15 / 20 | $… / $… / $… |
| GO / NO-GO vs ₪59 / ₪79 / ₪99 price points | … |

If real per-book image cost is prohibitive against the price points → **STOP, report, do not wire.**

---

## Step 2 — Wire provider + Style 02 into `generateAllPageImages`

- Route **Style 02 books** to gpt-image-2 `images.edit` (`GPT_IMAGE_MODEL=gpt-image-2` + the gpt-image provider path).
- **Scene-typed style-reference selection:** classify each page's scene → `night/bedroom` · `daytime-interior` · `forest/outdoor-environment` · default(nearest). Map to the reference subsets in the audition script / `manifest.json`.
- Use the **locked Style 02 brief** (from the audition script) as the style block.
- Keep the legacy Flux path fully intact. Style 02 → new path; Style 01 + all current behavior → unchanged.

---

## Step 3 — Character identity + locks

- Character reference slots = **child photo** + **1 canonical companion image** (same companion image, every page).
- **childVisualLock:** build ONE stable child-description string (face, hair, coloring, age, gender). Use it **verbatim — identical bytes — on every page.**
- **wardrobeLock:** ONE outfit description, used **verbatim on every page. Same outfit across all 5 pages.** This is a deliberate test control — it isolates identity consistency from wardrobe drift. (Real books may vary outfits later; not in this test.)
- The **child photo is IDENTITY ONLY** — face structure, hair, coloring, age, gender. The child must render **fully in Style 02 — hand-illustrated, semi-realistic, NEVER photoreal, never a pasted photo cutout.** State this explicitly in the prompt.

---

## Step 4 — Reference-budget probe (CTO CHECKPOINT — before the 5-page book)

Only if gpt-image-2 is capped at 4 refs. On **1–2 representative pages** (child + companion both present), render these 3 configs:

- **A:** 2 style refs + child photo + companion ref
- **B:** 3 style refs + child photo + companion **prompt-only** (text lock, no companion image)
- **C:** 3 style refs + companion ref + child via **text visual lock only** (no child photo)

Output all 3 configs (× scenes), with full manifests. **STOP and report — the CTO picks the config for Step 5.** Do NOT self-select and proceed.

---

## Step 5 — 5-page book test (CTO-chosen config)

Render a **5-page book** on the new path using the config the CTO selected. Use **Adventure or a mixed-scene set** — deliberately varied environments (stresses composition variety + scene-typed subsets). Real child photo + real companion. childVisualLock + wardrobeLock verbatim on all 5 pages.

---

## Manifest metadata — REQUIRED for every generation (probe + book)

Persist a full manifest per run: model, API endpoint + mode, quality + size, the exact prompt per page, every reference image used per page, token/usage + cost, latency, retry count, and any generation ID / seed the API returns.

---

## Step 6 — Report — do NOT ship

CTO QA gate. Report against:

- Style 02 look holds across all pages (on the chosen reference budget)
- Composition varies page-to-page — not one framing repeated
- Each image matches its page's text/scene
- Companion consistent across all pages
- **CHILD — evaluate as THREE separate axes, reported separately:**
  1. **Cross-page consistency** — is it the same child p1→p5
  2. **Likeness** — resemblance to the uploaded child photo
  3. **Style integration** — fully Style-02 illustrated; no photoreal / CGI drift
- No text artifacts; no reference-content bleed

Report honestly; flag every gap. **Do NOT wire into live customer generation. Do NOT touch Style 01. CTO approves before Phase 3.**
