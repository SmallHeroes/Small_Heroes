# Context Brief for GPT Image Consultation

## Who We Are

We're building **Small Heroes** — an AI-powered personalized children's storybook product. A parent uploads a photo of their child, fills a short wizard (child details, story theme), and we generate a complete illustrated book (8-10 pages) with the child as the main character.

## Our Tech Stack for Image Generation

- **Model**: `gpt-image-1` via OpenAI API
- **Two endpoints in use**:
  - `images.edit` — when we have a reference photo of the child (sends the photo + text prompt)
  - `images.generate` — text-only fallback
- **Image size**: `1024x1536` (portrait) for book pages, `1024x1024` for preview cards
- **Quality**: `high`
- **Per book**: 8-10 page illustrations + 1 cover = ~10 API calls

## What We Need From Each Image

Each book page illustration must:
1. **Match the child's appearance** from the uploaded reference photo (face, hair, skin tone)
2. **Depict a UNIQUE scene** — each page is a different story moment (different action, environment, composition, camera angle)
3. **Maintain character consistency** across all pages (same child, same companion animal)
4. **Follow a specific art style**: Pixar-meets-watercolor — soft realistic characters on light cream/white watercolor backgrounds
5. **Reserve the top 30-40%** as open space for text overlay
6. **Feel like a printed children's book page** — warm, safe, emotionally engaging

## Our Current Problem

**All 8 page images come out looking nearly identical** — same composition, same pose, same framing, same camera angle. Despite having completely different scene descriptions per page.

## What We Suspect Is Causing It

### Suspect 1: Reference photo via `images.edit` on every page

Currently, EVERY page (1-8) sends the parent's uploaded photo through `images.edit`. We believe the edit endpoint causes the model to "anchor" on the reference photo's composition and pose, overriding the scene prompt.

**Question**: Is this correct? Does `images.edit` with a reference photo cause GPT Image to replicate the reference's composition? Should we use `images.generate` (text-only) for most pages and only use `images.edit` for the first page where we establish the character?

### Suspect 2: Overly long prompts with repetitive character descriptions

Our current prompt per page is ~5,000 characters. Of that:
- ~30% is the actual unique scene description
- ~70% is identical across all pages (character locks, style rules, composition rules, visual render brief)

The character description appears 4 times in the prompt (from different pipeline stages that were designed for a previous image model).

**Question**: What is the optimal prompt length for `gpt-image-1`? Does it get "overwhelmed" by long prompts and default to generic output? Should we keep character descriptions minimal and scene descriptions dominant?

### Suspect 3: No anti-repeat instructions

We don't currently tell the model "this is page 3 of 8, make it look different from other pages." Each page prompt is independent.

**Question**: Does GPT Image benefit from explicit anti-repeat instructions? Or does it not have cross-call memory anyway?

## Our Current Style Prompt (for reference)

This is what we send as the style section of every prompt:

```
Children's storybook illustration — cartoon-realistic style:
- Warm, inviting illustrated style for a children's book — like a modern Pixar concept art painting
- Characters have realistic human proportions but with a gentle, approachable softness
- Natural-looking children — real hair, real skin tones, expressive faces — but rendered softly, not photorealistic
- Smooth, clean rendering — NOT heavy oil painting brushstrokes, NOT thick impasto texture
- The look should feel like a high-quality animated film still, painted with warmth
- Soft natural lighting on the characters — cheerful and clear, not dark or somber
- The mood should feel happy, safe, and magical — like a beautiful modern children's book
- Natural color palette with gentle variety — soft greens, warm blues, natural earth tones
- Colors should feel fresh and natural, not oversaturated or golden-tinted
- Background dissolves into very LIGHT watercolor washes — nearly white with just a hint of cream, NOT golden, NOT amber, NOT sepia
- The empty background areas should approach white — like clean watercolor paper with barely-there warm tints
- Only partial environmental details visible near the characters — the rest fades to near-white washes
- TOP 40% of the image MUST be open near-white watercolor space — reserved for text overlay, NO character heads or important details in this zone
- Characters positioned in the LOWER 60% of the image, filling about 40-50% of image height
- Characters should be slightly smaller and pushed toward the bottom — leave generous open space above
- Fresh palette — natural greens, soft blues, warm skin tones with healthy rosy cheeks, colorful clothing
- Shadows should be soft and neutral, not warm-tinted or golden
- The overall image should feel MODERN and LIGHT, not vintage or old-fashioned
- No golden/amber/sepia color cast on the image
- No dark somber mood, no cold shadows
- No heavy visible brushstrokes, no thick oil paint texture, no impasto
- No anime eyes, no chibi proportions, no flat cartoon style
- No hard borders, no picture frame, no fully detailed edge-to-edge backgrounds
- No text, no letters, no UI elements
```

## Our Current Code Flow

```
Parent uploads child photo
  ↓
Story pipeline generates 8 pages (Hebrew text + English scene descriptions)
  ↓
For each page:
  1. Scene description (~600 chars unique) gets wrapped with:
     - Character consistency locks (~500 chars, identical every page)
     - Visual render brief (~400 chars, mostly identical)
     - LLM was told to embed locks inside the scene too
  2. Total prompt = wrapped scene (~2600 chars) + character block + style prompt (~1500 chars) = ~5000 chars
  3. If reference photo exists → images.edit(photo, prompt)
     Else → images.generate(prompt)
  ↓
All 8 images look the same :(
```

## Our Proposed Fix

1. Send ONLY the clean scene description (~500-600 chars) — no locks, no render briefs
2. Character description ONCE (~150 chars) — not 4 times
3. Style prompt stays (~1500 chars)
4. Reference photo only on page 1 (anchor election), text-only for pages 2-8
5. Add per-page anti-repeat instruction
6. Total target: ~1200-1500 chars per prompt (down from ~5000)

## What We Want to Know

1. **Optimal prompt structure for gpt-image-1**: What order should the sections be in? Scene first? Style first? Character first? What does the model respond to best?

2. **images.edit vs images.generate**: For a multi-page illustrated book where character consistency matters but scene diversity is critical — what's the best strategy? Edit on every page? Edit on first only? Never edit?

3. **Prompt length**: Is there a sweet spot? Does gpt-image-1 degrade with prompts over a certain length?

4. **Character consistency WITHOUT reference photos**: If we stop sending the reference photo on pages 2-8, how detailed should the character description be to maintain visual consistency? What techniques work best?

5. **Scene diversity**: What prompt techniques make gpt-image-1 produce maximally different compositions across multiple calls? Specific camera angles? Action verbs? Environment details?

6. **Negative prompts**: We currently append `Avoid: text, letters, words, numbers, watermark, signature, frame, border`. Does gpt-image-1 respond well to negative prompts? Should we structure them differently?

7. **Style prompt optimization**: Our style prompt is ~1500 chars with many bullet points. Is there a more efficient way to communicate style to gpt-image-1? Does it respond better to natural prose vs bullet lists?

8. **Reference photo best practices**: When using `images.edit` with a child's photo as reference, what prompt techniques tell the model "use this face but NOT this composition/background/pose"?
