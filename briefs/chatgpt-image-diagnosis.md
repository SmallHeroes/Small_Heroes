# Full Image Generation Pipeline — Diagnosis Request

## Problem Summary

We're generating children's book illustrations via `gpt-image-1` (Images API). We have 3 styles but are experiencing two persistent problems:

1. **Golden/amber color bias** — all styles come out excessively warm/golden, even when the prompt doesn't ask for it
2. **Style 03 doesn't work** — we want dense ink-and-gouache illustration, but the API always produces colored-pencil/crayon texture regardless of prompt wording

We've tested with isolated scripts (bypassing our pipeline entirely) and the problems persist, which means they're at least partially API-level biases. But our pipeline may be making them worse.

---

## Architecture

```
Story text (Hebrew) 
  → Visual Director (LLM generates structured JSON per page)
  → buildGPTImagePrompt() assembles final prompt
  → generateGPTImage() calls openai.images.generate({ model: 'gpt-image-1' })
  → Raw PNG stored to Supabase Storage
  → Reader displays image (no postprocessing — postprocessing is disabled)
```

---

## How the Prompt Is Assembled

Function: `buildGPTImagePrompt()` — assembles in this order:

### 1. Scene Description (from Visual Director JSON)
```
Location: child's bedroom.
Action: building a tower of wooden blocks.
Pose: sitting cross-legged on floor.
Visible objects: wooden blocks, orange fox, bookshelf, rug.
Expression: focused and happy.
Lighting: warm lamp light mixed with blue twilight from window.
Detail: overflowing shelves, drawings on walls, fairy lights.
```

### 2. Text Reference
```
Scene based on text: "הילדה בנתה מגדל גבוה מקוביות..."
```

### 3. Character Identity Lock
```
CHARACTER IDENTITY LOCK (same on EVERY page):
- Face: round face, big hazel eyes, rosy cheeks, small nose
- Hair: curly shoulder-length brown hair
- Body: average build for 5-year-old
- Clothing (LOCKED — do NOT change): yellow sweater with small star patch, dark blue leggings
- Signature detail: star patch on sweater
```

### 4. Companion Lock
```
COMPANION LOCK (MUST appear in this scene):
- Species: fox
- Size: small, about knee-height to the child
- Coloring: orange-red fur with white chest
- Feature: bright curious eyes
```

### 5. Prop DNA (when relevant objects appear)
```
RECURRING OBJECTS (must look identical on every page):
- wooden blocks: colorful wooden building blocks, various sizes, primary colors
```

### 6. MANDATORY RULES (applied to ALL styles — this may be a problem)
```
MANDATORY RULES:
- Illustrate EXACTLY what is described above. Nothing more, nothing less.
- MUST INCLUDE in this illustration: fox, wooden blocks.
- The child's expression MUST match the scene emotion and the Expression field. Do NOT default to smiling if the scene is tense, sad, or scary.
- Warm, cheerful, humorous children's book. NEVER dark, scary, or threatening.
- Every page: safe, warm, inviting — a beloved bedtime story.
- ZERO text, letters, numbers, symbols, or words anywhere in the image — not on clothing, not on walls, not on signs, not on any surface. This is absolute.
- CHARACTER CONSISTENCY: The child MUST look identical on every page. Same face shape, same hair, same clothing, same skin tone. Never vary these.
- The character's clothing described in the CHARACTER IDENTITY LOCK is FINAL — do not add, remove, modify, or accessorize any garment.
- COMPANION CONSISTENCY: The companion MUST look identical on every page. Same species, same coloring, same size relative to child.
```

**⚠️ Lines 1932-1933 are suspicious:**
- `"Warm, cheerful, humorous children's book. NEVER dark, scary, or threatening."`
- `"Every page: safe, warm, inviting — a beloved bedtime story."`

These are applied to ALL 3 styles. The words "warm", "cheerful", "inviting", "beloved bedtime story" may be triggering the golden/crayon bias.

### 7. Composition Block
```
[Camera angle from Visual Director or rotation table]
Page 3 of 15 — visually distinct from other pages.
CRITICAL COMPOSITION: The top 30% of the image MUST gradually fade to a light, calm, low-detail area (soft cream or light wash). No faces, hands, or important objects in the top third. This zone is reserved for text overlay and must be clearly readable.
```

### 8. Style Block (LAST in prompt — this is also suspicious)
The style description comes from the style contract's `renderingDescription` + `imageNudge`. Here's what each style sends:

**Style 01 (Realistic Artistic):**
```
Cinematic painterly realistic portrait — characters look like real children rendered as fine-art oil paintings with warm watercolor background dissolution. Rich warm lighting, visible brushstrokes, natural skin texture. Background dissolves into soft warm watercolor washes. NOT a cartoon, NOT Pixar, NOT flat illustration. Realistic artistic portrait: characters look like REAL children painted as fine-art oil portraits with warm watercolor background dissolution. Painterly brushstrokes, natural skin texture, cinematic warm lighting. Background dissolves into soft warm washes. Top 20-30% open warm space for text. NOT a cartoon, NOT Pixar, NOT flat illustration. No hard edges or picture frame borders. No text, no letters, no UI.
```
→ **Note: "warm" appears 5 times, "golden" implied by "cinematic". Character size instruction says 60-70% but the actual images come out even larger.**

**Style 02 (Watercolor):**
```
Warm realistic watercolor painting of a real child — NOT a cartoon, NOT dark or moody. Render as a light, airy watercolor with real human proportions, real skin, natural colors. Soft warm cream and peach background that gently fades and dissolves at the edges. Bright and pleasant — this is a children's book, it must feel safe, warm, and inviting. This MUST look like a warm realistic watercolor — NOT a cartoon, NOT dark oil painting. Real child proportions but LIGHT and AIRY mood. Soft cream/peach background dissolving at edges. Bright pleasant children's book feeling. Watercolor paper texture visible. Top 20-30% should fade to soft warm cream for text. No text, no letters, no UI.
```
→ **"warm" appears 4 times. "children's book" appears twice — a trigger word.**

**Style 03 (Detailed Whimsical World):**
```
Dense hand-drawn illustrated world, cozy indie comic feeling, imperfect ink outlines, visible sketchy contour lines, tiny crosshatching, warm gouache/watercolor shading, rich layered textures. Halfway between realistic and cartoon: believable child proportions, stylized expressive face, charming imperfect objects. Warm cinematic lighting, emotional cozy atmosphere, dense cozy clutter, many small hidden visual moments. No glossy AI realism, no clean vector, no flat cartoon, no minimalist empty spaces. Dense hand-drawn illustrated world: visible black/brown ink outlines, sketchy crosshatching, imperfect contour lines, warm gouache/watercolor shading. Dense cozy clutter with many small hidden visual moments. Warm amber lighting mixed with cool blue shadows. Upper area has softer lower-contrast detail but still illustrated and atmospheric. No glossy AI realism, no clean vector, no flat cartoon. No text, no letters, no UI.
```
→ **"warm" appears 4 times, "cozy" 3 times, "warm amber" explicitly mentioned. "children's book" is NOT in this block but IS in the mandatory rules above it.**

---

## Final Prompt Assembly Order
```
[Scene] → [Text Reference] → [Character Lock] → [Props] → [MANDATORY RULES] → [Composition] → [Style Block]
```

**Total prompt length:** typically 1200-2000 characters.

---

## API Call Details
```javascript
openai.images.generate({
  model: 'gpt-image-1',
  prompt: fullPrompt,    // assembled above
  size: '1024x1536',     // portrait orientation
  quality: 'high',
  n: 1,
});
```

No `style` parameter. No `negative_prompt` parameter (we append "No text or letters" to the prompt text). No reference images. No system prompt. Just the raw prompt.

---

## What We've Tried (Style 03 specifically)

1. **Same prompt in ChatGPT** → perfect ink-and-gouache result
2. **Same prompt via Images API** → colored pencil/crayon
3. **Same prompt via Responses API (gpt-5.3-chat-latest)** → colored pencil/crayon
4. **Medium-first prompt rewrite** ("ink-and-gouache mixed media" instead of "children's book illustration") → slightly better but still colored pencil
5. **Reference image via Responses API input_image** → colored pencil, reference ignored
6. **Checked revised_prompt** → nearly identical to input, not the issue

---

## Questions for Diagnosis

1. **Is the word "warm" appearing 8-10+ times across the full prompt pushing the model into a golden/amber bias?** Should we drastically reduce warm/gold language?

2. **Are the MANDATORY RULES (lines 1932-1933) — "Warm, cheerful... beloved bedtime story" — the main trigger for the crayon/colored-pencil default?** Should these be rewritten or made style-conditional?

3. **Does the Style Block being LAST in the prompt hurt it?** The model has already processed 1000+ chars of scene, character, and rules before it sees the style instruction. Should style come FIRST?

4. **Is the prompt too long?** At 1200-2000 chars, does the model lose track of style instructions that come at the end?

5. **For Style 03 specifically**: given the API's persistent colored-pencil bias, is there a specific set of trigger words or negative instructions that can break through? Or is this a fundamental limitation of gpt-image-1 via API?

6. **For Style 01**: the character is too large in the output (fills 80%+ despite asking for 60-70%). The golden tone is too heavy. What prompt changes would reduce character size and cool down the palette?

7. **Any other structural issues you see in this prompt assembly that could be causing the style to be ignored or overridden?**
