# Cursor Brief — STYLE RESET (phased, reference-driven)

**Owner:** CTO · **Date:** 2026-05-25 · **Status:** ready for Cursor
Do NOT run full books until the style is locked.

---

## Context

Current Flux base / Style 01 / Style 02 / LoRA outputs are **NOT** the target. They are too thin — character + companion on a near-blank background. Guy's reference images show the real target: rich cinematic children's-book illustration — dense environmental storytelling, full detailed scenes (rooms, classrooms, gardens, forests, objects, plants, lights), layered depth, painterly watercolor/gouache texture, warm/cool lighting, magical / cozy / premium. NOT photorealistic. NOT flat cartoon. NOT generic cute watercolor. NOT blank cream paper. NOT sticker-like characters on an empty background.

**FREEZE:** no more full-book renders on the current styles. Old LoRAs + old Style 01/02 = legacy/frozen. Base Flux cute-watercolor is NOT Style 01.

---

## PHASE 1 — STYLE AUDITION

Do this first. Cheap. No book pipeline.

**Provider:** gpt-image-1, as a style lab only.

**Mode — STRICT:** text-to-image generation only. Do NOT use reference photos. Do NOT use image-edit mode. Do NOT use a child photo. Do NOT use a Bolly reference. Do NOT use any previous generated image as an anchor. Do NOT use consistency machinery. Do NOT use the book pipeline.

Create a small standalone script that generates **6 isolated single-scene images**, portrait 2:3. Use the same child archetype across all prompts (a young child) but do **NOT** enforce strict identity consistency — Phase 1 tests style, richness, environment, lighting and composition, not book-level identity.

**SHARED STYLE BRIEF (v2 — 2026-05-25; v1 was the right direction but too hazy/muddy/loose-watercolor) — prepend to every prompt:**

> A polished, premium children's picture-book illustration — rich, cinematic, but crisp and controlled. Clean confident linework defines every form; gouache-style painting with clear edges and defined shapes — NOT a loose, hazy, or muddy watercolor wash. A complete, fully-realized world fills the frame: a detailed environment with foreground, midground and background — furniture, plants, props, light sources, small objects to discover — every element clearly painted and readable, never smeared. Warm and cozy with a touch of magic; motivated, gently dramatic lighting — warm glow from lamps, lanterns or windows against cooler shadow; grounded, believable space and depth, still clearly illustrated. The child is a cute, appealing, carefully designed character — clear expressive eyes, defined charming features, real personality and charm. The quality of a beloved modern premium picture book. NOT photorealistic. NOT flat vector cartoon. NOT a hazy or muddy watercolor wash. NOT generic soft watercolor. NOT a character on blank paper. Bright, clean, true color — clear whites, no yellow/sepia/muddy wash, never dim.

**The 6 scenes** (shared style brief + one scene line each):

1. A child's cozy bedroom at night — a bed, a window showing the moon and stars, shelves with toys and books, a small lamp glowing softly. The child is on the bed.
2. A warm, lived-in classroom — wooden desks, a chalkboard, posters and children's art on the walls, plants on the windowsill. The child stands among the desks.
3. A friendly children's clinic room — an examination bed, a shelf of jars and supplies, a curtained window, gentle posters on the wall. The child sits in the room.
4. A lush forest in dappled afternoon light — tall trees, ferns, mushrooms, soft light falling through the leaves, a winding path. The child walks the path.
5. A magical night outdoors — a deep starry sky, a crescent moon, fireflies, a glowing lantern, hills in the distance. The child stands outside, looking up in wonder.
6. A cottage and its garden in warm afternoon light — flowers, a winding stone path, a low fence, a leafy tree, a watering can. The child is in the garden.

**Output:** the 6 images · the exact shared style brief used · the exact per-scene prompt for each image.

**CTO judges the 6 against these criteria:** rich full environment · dense visual detail · cinematic composition · layered depth · warm/cool lighting contrast · premium illustrated storybook feel · not photorealistic · not flat cartoon · not generic cute watercolor · not blank / sticker-like · no heavy yellow/sepia cast · no text artifacts · readable child emotion.

Iterate the shared style brief 2–3× if needed. **Do NOT proceed to Phase 2 until the style is CTO-approved.**

---

## PHASE 2 — BOOK TEST

Only after Phase 1 is approved.

Use **gpt-image-2 IF it is available** in the project/API. If gpt-image-2 is not available, **report it as a blocker — do NOT silently fall back to gpt-image-1.**

Render a 5-page book test with the locked Phase-1 style. Prefer **Adventure or mixed pages** (they stress varied environments and composition). If Bedtime is used for convenience, choose pages with visibly different scene demands.

Test: composition variety · child consistency · Bolly consistency · page-text match · breathing room · full environments · neutral warm white balance.

---

## PHASE 3 — NEW LoRA

Not a planned step. Last resort only — if Phase 2 proves gpt-image cannot deliver varied composition + consistency together.

Do NOT patch Bolly / environment / framing inside the old style. **Style first, then book. Only if forced, a new LoRA — later.**
