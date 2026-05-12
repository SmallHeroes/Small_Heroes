# Small Heroes — Story Generation Pipeline Reference

## Overview

Two paths exist for story generation. **Story-bank** (production) uses pre-written stories and only calls LLM for gender-swap + character DNA. **Dynamic pipeline** runs 9 LLM stages end-to-end. Both paths converge at image generation.

### Path Selection (generate/route.ts)
1. Try `selectCompanionStory(companionId, direction)` → v3 story-bank (`story-bank/v3/`)
2. Fallback: `selectStoryFromBank(category, length)` → v1 story-bank (`story-bank/raw/`)
3. If no match: `runStoryPipeline()` → dynamic pipeline

---

## STORY-BANK PATH (Current Production)

### S1: Gender Swap (Conditional)
**File:** `backend/providers/story-bank-loader.ts` (line 272-376)
**When:** Only if story's written gender ≠ child's gender
**Model:** `PIPELINE_SUPPORT_MODEL` env var → default `gpt-4o-mini` (OpenAI) / `claude-sonnet-4-20250514` (Anthropic)
**Temperature:** 0.1 | **Max tokens:** 4000

**System prompt:**
```
You are a professional gender translator for literary Hebrew for children.
Your role is to convert all linguistic forms from [source gender] to [target gender],
while absolutely preserving the writing style, rhythm, imagery, and atmosphere.
```

**User prompt:** Numbered story pages with rules:
- Convert verbs, adjectives, pronouns
- Don't change content, plot, metaphors
- Preserve nikud
- Return JSON `{"pages": ["text page 1", "text page 2", ...]}`

**Variables:** `fromLabel`, `toLabel` (gender labels in Hebrew), `childName`, all page texts

---

### S2: Character DNA ("Visual Bible")
**File:** `backend/providers/story-bank-loader.ts` (line 437-660)
**When:** Always, for every generation
**Model:** `STORY_GENERATION_MODEL` env var → default `gpt-4o`
**Temperature:** 0.2 | **Max tokens:** 1500
**Format:** `response_format: { type: 'json_object' }`

**System prompt:**
```
You are a children's book character designer.
Create structured, locked visual DNA for consistent illustrations across every page of a book.
```

**User prompt includes:**
- Full story text (all pages joined)
- Child name/gender/age
- Companion name
- Illustration style

**Expected output fields:**
- `childStructured` (face/hair/body/clothing/signature)
- `companionStructured` (species/size/coloring/feature)
- `childDNA`, `companionDNA` (flat text locks)
- `worldDNA`, `propDNA` (recurring objects)
- `negativeRules`

---

## DYNAMIC PIPELINE PATH (When No Story-Bank Match)

All calls use `callLLM()` in `backend/providers/pipeline.ts` with retry logic (3 retries, 2s/4s/8s delays).

**Model routing:**
- Story stages (Brain, Outline, Prose): `STORY_MODEL` → default `gpt-5.3-pro`
- Support stages (VisualBible, Composition, Shots): `PIPELINE_SUPPORT_MODEL` → default `gpt-5.3-chat-latest`

### P1: Brain — Emotional Core + Locked Visuals
**Line:** 1107 | **Max tokens:** 2500 | **Temperature:** 0.85

**System prompt (line 993-1062):** Master Hebrew children's story author. 14 hard rules:
1. Child is the hero (not companion)
2. Superpowers must be visible/active
3. Central metaphor — concrete/visual, not literal
4. Humor required
5. Entity has personality (not generic villain)
6. Real failure before success
7. Final climax must be a choice
8. Plus category-specific narrative constraint overrides

**User prompt (line 762-987) variables:**
- Emotional category + psychological frame
- Treatment strategy (from solution taxonomy)
- Companion block (name, species, personality)
- Child details (name/gender/age/traits/superpower)
- Family context
- Challenge/outcome/helper/avoid items
- Story direction guidance
- Direction-specific narrative constraints

**Output:** Nested JSON — `emotionalCore`, `hero` (with superpower arc), `entity` (with rules/limitations), `world`, `narrativeCore` (centralMetaphor), `visuals` (locked English descriptions for hero/entity/world/cast)

---

### P2: Page Outline
**Line:** 1236 | **Max tokens:** 2500 | **Temperature:** 0.8

**System prompt:** "You are NOT writing a story yet. You are creating a structured page-by-page outline from a given StoryBrain. Return JSON only."

**User prompt (line 1131-1224):**
- Full StoryBrain JSON
- Scaled structural zones (20%/50%/70%/90% breakpoints based on page count)
- Per-page output: purpose, beat, emotional_state, focus, characters_present, humor

**Rules:** Entity not present in early pages, focus variety, 2+ locations, explicit transition beat, first failed attempt, 2 playful superpower attempts, climax with physical action.

---

### P3: Stage 3A — Free Story Writing (Hebrew Prose)
**Line:** 1697 | **Max tokens:** 6000 | **Temperature:** 1.0

**System prompt (line 1502-1584):**
- Hebrew children's story writer
- Full reference story example (~150 lines of Hebrew prose)
- Explains why the example works (rhythm, narrator voice, metaphor, humor, ending)
- Hard rules: 25-40 words per scene, live page (physical action + reaction + change), banned emotion words, visual-first writing

**User prompt (line 1588-1668):**
- Story for [childName], [age], topic, companion description, superpower
- 4-act structure with scaled page ranges
- Environment directives, escalation rules, humor rules
- Exactly N scenes as JSON

**Output:** `{ "title": "...", "scenes": [{ page: N, text: "..." }] }`
Up to 2 attempts if word count is below minimum.

---

### P4: Stage 3B — Page Structuring (legacy path only, skipped in few-shot mode)
**Line:** 1882 | **Max tokens:** 6000 | **Temperature:** 0.3

Rewrites story into book pages. 20-45 Hebrew words per page. Adds `imageSubject` per page.

### P5: Stage 3C — Hebrew Polish (legacy path only)
**Line:** 1977 | **Max tokens:** 6000 | **Temperature:** 0.2

Fixes broken/awkward/AI-like Hebrew. Preserves page count, events, imageSubject. Stays within 20-45 words.

### P6: Stage 3D — Page Length Repair (conditional — short pages only)
**Line:** 2122 | **Max tokens:** 800 | **Temperature:** 0.7

Expands single short page to 20-45 words. Up to 5 iterations per page.

---

### P7: Stage 4A — Visual Bible
**Line:** 2478 | **Max tokens:** 3200 | **Temperature:** 0.6

**System prompt (line 2246-2292):** Children's book art director. Defines complete visual signature.
- Banned words: "vibrant/stunning/magical/cozy"
- Requires: hero body proportions/posture/clothing texture/visual quirks
- Entity shape logic + state transforms
- Style as physical media (pigment/paper/brush behavior)
- Three style categories: pencil_watercolor, realistic_illustrated, whimsical_comic_fantasy

**User prompt (line 2294-2468):**
- Style key/token/profile
- Uploaded child image URL
- Story tone
- Hero/entity base visuals + expansion directives
- World, supporting cast
- Story sample (opening/middle/ending)
- Page count

**Output:** Massive JSON — `style` (13 fields), `layoutRules` (7 fields), `hero` (14 fields), `entity` (12 fields), `world` (6 fields), `illustrationRules`, `heroVisualLock`, `styleLock`, `entityVisualLock`

---

### P8: Stage 4B — Page Composition Plan
**Line:** 2703 | **Max tokens:** 3000 | **Temperature:** 0.5

**System prompt (line 2516-2589):** Layout director for printed children's book. Camera distance/angle/composition rules with visual rhythm layer.

**Output per page:** compositionType, cameraDistance, cameraAngle, heroPlacement, entityPlacement, topTextAreaPlan, backgroundComplexity, visualRhythmRole, heroPresence, pageIntent

---

### P9: Stage 4C — Illustration Shot Plan
**Line:** 3333 | **Max tokens:** 4000 | **Temperature:** 0.75

**System prompt (line 3308-3331):** Strict scene extractor. Structured JSON, not prose poetry. Physical objects/positions/lighting only. Different locationZone/characterPose/mainAction every page.

**User prompt (line 3047-3213):**
- All locked visuals (hero/entity/world)
- Style prefix
- Outline + prose reference
- Composition plan

**Output per page:** imageSubject, shotType, action, mustExclude, imagePrompt (max 350 chars), visualDirection (locationZone, mainAction, visibleObjects, characterPose, emotionVisual, etc.)

---

## IMAGE GENERATION (Both Paths Converge)

### I1: Scene Translation (per page)
**File:** `backend/providers/image.ts` (line 451-598)
**Model:** `SCENE_TRANSLATE_MODEL` → default `gpt-4o-mini`
**Temperature:** 0.3 | **Max tokens:** 300 | **Timeout:** 8 seconds

**System prompt:** Illustration director for magical children's picture book.
- Focus on single dramatic moment
- Preserve exact camera angle from existing direction
- Name characters
- Be concrete and cinematic
- Preserve character lock cues

**Input:** Page number, composition directive, companion presence rule, Hebrew story text, existing illustration direction, character locks.
**Output:** 80-120 word English scene description

---

### I2: Storyboard Planning (per book)
**File:** `backend/providers/image.ts` (line 830-895)
**Model:** `STORYBOARD_MODEL` → default `gpt-4o-mini`
**Temperature:** 0.4

**Output per page:** shotType, compositionMode, textZone (always `top_clear`), cameraAngle, lighting, emotionalTone, mainCharacterVisibility, protagonistDominance

---

### I3: Image Generation — GPT Image (per page + cover)
**File:** `lib/generate-image.ts` (line 248-288)
**Model:** `gpt-image-1`
**Quality:** `GPT_IMAGE_QUALITY` env var → default `high`

**Sizes:**
- Pages: 1024x1536
- Cover: 1024x1536 (or 1536x1536 for print PDF)
- Previews: 1024x1024

**Prompt assembly (`buildGPTImagePrompt`, line 1702-1948):**
1. Style block FIRST (medium lock from style contract)
2. Scene (from visualDirection or fallbacks)
3. Text reference (English translation)
4. Character DNA block (structured or flat)
5. Prop DNA
6. Fidelity rules (mustInclude/mustNotInclude)
7. Composition block (camera, text zone)

**Fallback provider:** DALL-E 3 (`dall-e-3`, 1024x1792 pages, 1024x1024 previews)

---

## ENV VARS CONTROLLING THE PIPELINE

| Variable | Default | Controls |
|----------|---------|----------|
| `STORY_PROVIDER` | `openai` | API provider (`openai` or `anthropic`) |
| `STORY_MODEL` | `gpt-5.3-pro` | Brain, Outline, Prose stages |
| `PIPELINE_SUPPORT_MODEL` | `gpt-5.3-chat-latest` | VisualBible, Composition, Shots, Gender Swap |
| `FALLBACK_STORY_MODEL` | — | Fallback if primary unavailable |
| `STORY_GENERATION_MODEL` | `gpt-4o` | Character DNA generation |
| `SCENE_TRANSLATE_MODEL` | `gpt-4o-mini` | Hebrew→English scene translation |
| `STORYBOARD_MODEL` | `gpt-4o-mini` | Storyboard planning |
| `STORY_REASONING_EFFORT` | — | Reasoning effort for Responses API |
| `STORY_VERBOSITY` | — | Verbosity for Responses API |
| `GPT_IMAGE_QUALITY` | `high` | GPT Image quality (low/medium/high) |
| `IMAGE_PROVIDER` | — | Image backend selection |
| `USE_VISUAL_DIRECTOR` | — | Enable VisualDirector for DALL-E path |

---

## KEY FILES

| File | Role |
|------|------|
| `app/api/generate/route.ts` | Main orchestrator — story selection, character anchors, image coordination |
| `backend/providers/pipeline.ts` | Dynamic pipeline — all 9 LLM stages |
| `backend/providers/story-bank-loader.ts` | Story-bank loader — gender swap + character DNA |
| `backend/providers/story-bank-index.ts` | Story selection logic (companion-based v3 or category-based v1) |
| `backend/providers/image.ts` | Image generation — scene translation, storyboard, prompt assembly |
| `lib/generate-image.ts` | GPT Image API wrapper (gpt-image-1) |
| `backend/config/visual-system.ts` | Style profiles and contracts |

---

## PRODUCTION FLOW SUMMARY (Story-Bank Path)

```
User fills wizard → Order created in Supabase
  ↓
selectCompanionStory(companionId, direction) → v3 file?
  ↓ (fallback)
selectStoryFromBank(category, length) → v1 file?
  ↓
loadStoryFromBank(filename) → raw Hebrew pages
  ↓
Gender swap if needed (LLM call S1)
  ↓
Character DNA generation (LLM call S2)
  ↓
For each page:
  Scene Translation (LLM call I1) → English scene
  Storyboard entry (LLM call I2, once for whole book)
  buildGPTImagePrompt() → assembled prompt
  GPT Image generation → 1024x1536 image
  ↓
Cover generation (same flow, special framing)
  ↓
Audio generation (optional, via TTS)
  ↓
Book ready in reader
```
