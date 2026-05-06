# Phase 5d Results — Follow-up Consultation

## Context (Read First)

We're building **Small Heroes** — an AI children's storybook product. We previously consulted you about GPT Image API best practices and implemented your recommendations:

1. **Killed `images.edit` entirely** — always use `images.generate` now
2. **Shortened prompts** from ~5000 chars to ~1400 chars
3. **Scene-first prompt order**: Scene → Character → Composition → Style
4. **Removed reference photos** — character consistency via text only
5. **Added clothing anchor** to character description
6. **Stored `rawScenePrompt`** — clean LLM scene before Flux wrapping
7. **Compact 6-line style block** instead of 25-bullet style prompt

## Test Results

We generated a test book (8 pages, "night fears" theme, girl named לול with a fox companion).

**What improved:**
- Images ARE more diverse than before (different camera angles, different compositions)
- Prompt lengths are on target (~1424 chars for book pages)
- `images.edit` is gone — `hasReferencePhoto=false` on every page
- `rawScenePrompt` is reaching GPT Image for book pages (731-786 chars each)

**What's still wrong:**
- Images still feel too similar overall — all indoor/bedroom/warm-toned/girl-and-fox
- Cover shows a sad child (story topic is "night fears" and the cover scene describes child in bed with lamp off)
- Direction preview images (generated before the book) still use polluted legacy prompts (rawScene=0)

## The Actual Prompts That Went to GPT Image

### Direction Preview Prompts (rawScene=0 — falling through to legacy)

These are generated BEFORE the book, as preview cards for the parent to choose story direction.

```
Page 1 preview — rawScene=0 stage4=0 sceneUsed=594 final=1140
Scene: "PRIMARY SCENE: Warm cozy indoor room, soft evening lamp light, close intimate framing. Child לול in a safe home space — reading, hugging, or nestled with a loved one. Mood: calm, warm, safe. STYLE_LOC..."

Page 2 preview — rawScene=0 stage4=0 sceneUsed=597 final=1143
Scene: "PRIMARY SCENE: Wide outdoor landscape, golden hour sunlight, open trail or path stretching to horizon. Child לול small in vast colorful nature — walking, exploring, discovering. Mood: wonder, movement..."

Page 7 preview — rawScene=0 stage4=0 sceneUsed=598 final=1144
Scene: "PRIMARY SCENE: Two figures face-to-face in a gentle threshold moment. Child לול taking a brave small step — eye contact, held hands, quiet determination. Mood: courage, tenderness, hope. STYLE_LOCK: S..."
```

Note: These have `STYLE_LOCK:` fragments leaking into the scene description. These are generic archetype templates from the Flux era, not story-specific.

### Cover Prompt (rawScene=0 — uses separate cover builder)

```
Page 0 (cover) — rawScene=0 stage4=0 sceneUsed=593 final=1110
Scene: "Book cover scene: הספר של לול. Story hook: לול במיטה, מנורת השולחן כבויה, הספרון פתוח על הדף האחרון, בקבוק המים ליד הכרית. Topic: פחדים בלילה. Opening moment of the story. Warm, inviting, emotionally..."
```

**Problem:** The cover's "story hook" is in Hebrew and describes a dark scene (child in bed, lamp off). Cover always goes through a legacy `buildCoverPrompt` function, not through our new `buildGPTImagePrompt`.

### Book Page Prompts (rawScene=731-786 — WORKING)

These ARE using the clean rawScenePrompt:

```
Page 1 — rawScene=751 stage4=751 sceneUsed=597 final=1424
Scene: "A dim slice of hallway light spills across the floor and stops just short of the bed. Wide eye-level view with the bed placed slightly right of center in the lower half, the top third an open wash of..."

Page 2 — rawScene=732 stage4=732 sceneUsed=596 final=1423
Scene: "The door handle's shadow stretches long and thin, creeping into the room like a dark ribbon. Medium slightly-above angle with the girl in the lower right third, propped on one elbow, the upper wall le..."

Page 3 — rawScene=725 stage4=725 sceneUsed=589 final=1416
Scene: "A bare foot hovers just above the floor as faint glowing lines begin to open across the wall like hairline cracks. Close over-shoulder view from behind, her leg and arm entering from the lower left whi..."

Page 4 — rawScene=742 stage4=742 sceneUsed=599 final=1426
Scene: "Clusters of tiny glowing points scatter across the floor and wall, tangling into restless paths. Medium eye-level composition with the girl kneeling center-left, leaving the upper wall clear and quiet..."

Page 5 — rawScene=786 stage4=786 sceneUsed=598 final=1425
Scene: "From the shadow beneath the shelf, a small fox peeks out, its lantern-like eyes glowing steadily. Medium eye-level framing with the fox at center-right midground and the girl small in the lower corner..."

Page 6 — rawScene=768 stage4=768 sceneUsed=599 final=1426
Scene: "Two small glowing dots sit close together while a crooked line nearby fades into the page. Close over-shoulder composition with her hand entering from the lower left and the fox in the midground right..."

Page 7 — rawScene=772 stage4=772 sceneUsed=597 final=1424
Scene: "A single golden line snaps cleanly across the room the moment the lamp clicks on. Wide slightly-above view with the girl on the right near the wall and the fox just behind her in the lower midground..."

Page 8 — rawScene=666 stage4=666 sceneUsed=592 final=1419
Scene: "A lone glowing point rests quietly at the edge of the shelf, connected to a short, steady line. Close eye-level vignette with most of the frame empty and pale, the object placed low in the composition..."
```

### Full Prompt Structure (example — Page 5)

```
From the shadow beneath the shelf, a small fox peeks out, its lantern-like eyes glowing steadily. Medium eye-level framing with the fox at center-right midground and the girl small in the lower corner... [~600 chars of scene]

Main character: A girl named לול, approximately 5 years old, warm and friendly appearance; wearing [clothing description]
Companion: שועלון, [visual description]

Page 5 of 8. Use a unique composition, different camera angle, and different character pose. Top 40% must be open light space for text.

Soft Pixar-style watercolor illustration for a children's book.
Natural-looking child with realistic proportions, rendered softly — not photorealistic.
Light cream/white watercolor background — NOT golden, NOT amber.
Soft natural lighting, cheerful and clear.
Characters in lower 60%, background fades to near-white washes.
No text, no letters, no UI elements.
```

## What We Think Is Wrong

### Issue 1: Scene Descriptions Are Too Abstract/Poetic

The LLM is generating beautiful prose but NOT good image prompts. Look at the pattern:
- Page 4: "Clusters of tiny glowing points scatter across the floor"
- Page 6: "Two small glowing dots sit close together"
- Page 8: "A lone glowing point rests quietly at the edge of the shelf"

Every page features "glowing points/dots/lines" — the LLM is describing ABSTRACT ART, not concrete visual scenes. GPT Image needs concrete objects, actions, environments — not poetry.

### Issue 2: All Scenes Are in the Same Location

A "night fears" story inherently takes place in one bedroom. The LLM wrote 8 scenes that are all variations of "girl in bedroom with glowing things." There's no environment diversity because the STORY doesn't go anywhere.

**Question:** Should we instruct the storyboard LLM to deliberately vary environments even within a bedroom story? (e.g., "looking out the window at the garden", "the hallway between rooms", "a dreamscape/imagination scene", "the next morning at breakfast")

### Issue 3: No Emotional Arc in Prompts

The pages don't specify mood progression. A children's book about night fears should go:
1. Cozy bedtime → 2. Lights off, alone → 3. Fear creeps in → 4. Something magical appears → 5. Meet the companion → 6. Face the fear together → 7. Victory/courage → 8. Peaceful sleep

But the prompts don't tell GPT Image about emotion — it sees "glowing dots in a dark room" for pages 3-8.

### Issue 4: Cover Prompt Is Fundamentally Broken

The cover uses a separate code path (`buildCoverPrompt`) that builds a Flux-era prompt with Hebrew text embedded in the scene description. It says "לול במיטה, מנורת השולחן כבויה" (child in bed, lamp off) — of course the cover looks sad/dark.

## What We Need From You

1. **Scene description guidelines for GPT Image**: We generate scene descriptions with an LLM (Claude/GPT-4) and feed them to `gpt-image-1`. What makes a GOOD scene description for image generation? How specific should it be? Should it describe concrete objects or moods? Should it include camera/composition or leave that to GPT Image?

2. **Handling single-location stories**: When a story takes place mostly in one room, how do we get visual diversity? Specific prompt techniques? Should we inject environment changes at the storyboard level?

3. **Emotional arc in illustrations**: Should we include mood/emotion words in the prompt? Does GPT Image respond well to "the mood is fearful and tense" vs "cheerful and triumphant"? Or should emotion come through action/environment only?

4. **Cover strategy**: The cover should ALWAYS show a happy, inviting scene regardless of story topic. What's the best cover prompt structure for a children's book? Title + happy character + warm mood?

5. **Scene-vs-composition balance**: Our LLM is currently writing BOTH the scene content AND the camera/composition instructions in one block. Should we separate these? Should the storyboard LLM focus ONLY on "what happens" and we add camera/composition mechanically (e.g., cycling through: wide → medium → close → over-shoulder → wide)?

6. **Prompt phrasing for diversity**: Despite saying "Page 5 of 8. Use a unique composition, different camera angle, and different character pose" — the model still produces similar-feeling outputs. Is there a more effective way to push for diversity? Specific negative instructions? Different camera vocabulary?

7. **Optimal scene description length**: Our scenes are ~600-750 chars before trimming to 600. Is this still too long? Should the scene be shorter and more punchy (e.g., 200-300 chars)?

## Key Constraint

We can't change the STORY — it's already generated in Hebrew by the time we get to image generation. We CAN change:
- How the storyboard LLM translates story → scene descriptions (the intermediate step)
- How we build the final prompt from scene descriptions
- The cover prompt structure
- Any mechanical additions to the prompt (composition rules, mood words, etc.)
