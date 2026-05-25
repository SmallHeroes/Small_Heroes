# Style Definitions — Small Heroes (Authoritative)

**Date:** 2026-05-25 · **Owner:** CTO · **Status:** source of truth for the two product illustration styles.
This doc supersedes the scattered, drifted style definitions. Diagnose → prompt → pin, so we stop re-deriving this.

---

## 0. Why it felt like "going backwards"

The style system drifted. Three concrete causes:

1. **`lib/styles.ts` holds THREE styles, the product has TWO.** `SOFT_HAND_DRAWN_STORYBOOK`, `EXPRESSIVE_PAINTERLY_STORYBOOK`, and `DETAILED_WHIMSICAL_WORLD`. The user thinks in Style 01 / Style 02. The third never got retired cleanly — and `DETAILED_WHIMSICAL_WORLD` (the entry closest to "Style 02 detailed fantasy") was dropped from the wizard and has **no LoRA**.

2. **The clean-prompt path is Style-01-only.** `lib/flux-clean-prompt.ts` hardcodes `FLUX_CLEAN_TRIGGER = 'REALISTART01'` and a single style tag. Style 02 was never wired into the clean path — so it has no live implementation.

3. **The clean style tag is 7 words:** `"fine watercolor children's-book illustration on cream paper"`. Too thin to hold the look — which is exactly why the child/style drift showed up in the A/B renders. The LoRA alone is not carrying it.

This doc re-pins both styles and lists what must be decided to wire Style 02.

---

## Style 01 — Soft Watercolor (the "cute" style)

- **Internal id:** `soft_hand_drawn_storybook`
- **LoRA:** `smallheroes/sh-realistic-artistic` · trigger `REALISTART01`
- **Status:** LIVE. Every companion character on the site renders in this style. This is the default.

### Diagnosis (from the reference set)

A traditional **soft watercolor** look on warm cream, textured paper. Gentle hand-painted washes, soft edges, visible but quiet paper grain. Linework, where present, is a light pencil/ink under-drawing — never sharp or vector.

The defining trait is the **cute character design**: rounded faces, oversized sparkling eyes with light catches, rosy blushed cheeks, small button noses, soft small bodies with slightly large heads. Childlike, huggable proportions. Faces carry emotion clearly and gently.

Palette is **warm, gentle, cozy** — cream/peach base, soft golden warmth, earthy greens and dusty blues as accents. Luminous but never garish or neon; slightly muted and comfortable. Lighting is a **soft even warm glow**, like cozy lamplight — no harsh contrast, no drama.

Detail level is **moderate**: backgrounds are real and pleasant (rooms, gardens, forests) rendered with watercolor warmth, but softer and less dense than Style 02. Edges often dissolve into cream. The focus is the emotional moment, not world-density.

Mood in one line: **tender, warm, safe, emotional, childlike — the "hug" style.**

### The prompt

Style tag for the clean-prompt builder (replaces the current 7-word `FLUX_CLEAN_STYLE_TAG`):

```
REALISTART01 style, soft watercolor children's-book illustration on warm cream paper, rounded cute characters with large sparkling eyes and rosy cheeks, gentle cozy palette
```

(~23 words. Names the load-bearing elements that drift in renders — cute rounded character, big eyes, rosy cheeks, the medium, the palette. The LoRA carries the rest. Note: the scene-translate output must also be trimmed so total prompt stays in the 70–110-word budget.)

Negative: `3d render, cgi, photorealistic, anime, manga, vector art, glossy ai look, flat minimal, dark moody desaturated palette, neon glow, text`

---

## Style 02 — Detailed Painterly Fantasy (the "epic" style)

- **Internal id:** none clean today. Closest is `detailed_whimsical_world`, but its definition (ink-and-gouache, muted vintage ochres) does **not** match these references.
- **LoRA:** **NONE confirmed.** `REALISTART02` exists but is bound to a different style (realistic watercolor). See Open Decisions.
- **Status:** NOT implemented in the clean path.

### Diagnosis (from the reference set)

A **rich, dense, painterly illustration** look — far more rendered and elaborate than Style 01. Heavy fine micro-texture (stippled, granular) across the whole image. Painterly more than line-led.

Characters are still appealing and expressive-eyed, but rendered with **more detail and a touch more realism** — less "round-cute," more "finely illustrated." They sit inside elaborate worlds rather than being the soft sole focus.

Palette is **deep and jewel-toned** — higher saturation and contrast, moodier, many night/dusk scenes. Warm glowing pools of light against deep blue/green shadow. Lighting is **dramatic and motivated** — lanterns, candles, windows, magical glow — strong light/dark interplay, cinematic.

Detail level is **very high**: ornate intricate environments, fairy houses, hanging lanterns, layered depth, hundreds of micro-details. "Every page is a world."

Mood in one line: **magical, immersive, epic, wondrous — the "adventure / wow" style.**

### ⚠ Reference-set inconsistency — needs a call

The 12 Style-02 references are **not one coherent look**. About 9 are 2D detailed painterly illustration; about 3 (the fairy village, the tortoise-with-tea, the lantern fairy) read as **3D-rendered / photoreal CGI fantasy** — a different production pipeline entirely.

**Recommendation: pin Style 02 to the 2D detailed painterly illustration look, NOT the 3D render.** Reasons: (a) it stays a true sibling of Style 01 — both 2D illustration, just different density — so a book reads as one coherent product line; (b) 3D photoreal fantasy makes a *specific child* far harder to keep consistent across pages, and consistency is our current launch blocker; (c) `lib/styles.ts`' own global rule already forbids 3D/CGI.

### The prompt

Style tag (trigger word pending — see Open Decisions):

```
<STYLE-02 TRIGGER> style, detailed painterly fantasy children's-book illustration, richly textured and intricate, ornate atmospheric environments, deep jewel-tone palette, dramatic glowing lantern light, a magical immersive mood
```

If run on base Flux with no LoRA, append for grip: `layered depth, hundreds of fine narrative micro-details, warm light pooling against deep cool shadow, finely-rendered appealing characters`.

Negative: `3d render, cgi, photoreal, octane render, flat minimal, sparse background, washed-out muted palette, anime, manga, glossy plastic, text`

---

## Open decisions for CTO (block Style 02 going live)

1. **Style 02 LoRA.** It has none. `REALISTART02` is trained for the *realistic watercolor* style, not detailed fantasy — using it would be wrong. Options: (a) train a new LoRA on the 2D detailed-fantasy references; (b) run Style 02 on base Flux + the fuller prompt block, no LoRA, as an interim; (c) re-scope. Until decided, Style 02 cannot be wired with a trigger word.

2. **Clean-path Style 02 support.** `lib/flux-clean-prompt.ts` is single-style. Wiring Style 02 means making the trigger + style tag style-aware (a small, contained change) — do this once decision #1 lands.

3. **Registry cleanup, 3 → 2.** Retire/realign the third style in `lib/styles.ts` so code matches the two-style product reality and the labels stop colliding. Separate contained task; flagged so it doesn't drift again.

---

## Quick reference

| | Style 01 | Style 02 |
|---|---|---|
| Name | Soft Watercolor (cute) | Detailed Painterly Fantasy (epic) |
| Medium | Soft watercolor, cream paper | Dense painterly illustration |
| Character | Round, big sparkling eyes, rosy cheeks | Finely-rendered, more realism |
| Palette | Warm, gentle, cozy | Deep jewel tones, moody |
| Light | Soft even warm glow | Dramatic glowing sources |
| Detail | Moderate, dissolves to cream | Very high, edge-to-edge |
| Mood | Tender, safe — "hug" | Magical, epic — "wow" |
| LoRA | `sh-realistic-artistic` / `REALISTART01` | none — open decision |
| Status | LIVE | not implemented |
