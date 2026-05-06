# Phase 5c — Static Direction Cards

## Goal
Replace the dynamic AI-generated direction preview cards with instant static cards.
Currently the system generates 3 AI images per order (~$0.15, ~5 min, frequent timeouts).
After this change: instant card display, zero cost, zero failure rate.

## Archetype Rename

The existing archetype `courage` is being renamed to `magic` in meaning (already decided in design_decisions.md).
The three archetypes map to:

| Archetype ID | Hebrew Label | Parent-Facing Summary | Resilience Strategy |
|---|---|---|---|
| `connection` | סיפור לפני שינה | סיפור רגוע ומחבק שמלווה את הילד לשינה מתוקה | Connection & security |
| `adventure` | סיפור הרפתקאות | סיפור מרגש על גילוי, אומץ ומסע מיוחד | Mastery & courage |
| `courage` | סיפור קסום | סיפור מלא דמיון עם עולמות קסומים ויצורים מופלאים | Imagination & wonder |

**IMPORTANT**: The DB enum stays `courage` — do NOT change the DB/Prisma enum. Only the user-facing labels change.

## Static Card Images

6 images total — 3 per illustration style:

```
public/direction-cards/
  connection_style01.jpg    (bedtime — Style 01 realistic)
  adventure_style01.jpg     (adventure — Style 01 realistic)
  courage_style01.jpg       (magical — Style 01 realistic)
  connection_style02.jpg    (bedtime — Style 02 pencil)
  adventure_style02.jpg     (adventure — Style 02 pencil)
  courage_style02.jpg       (magical — Style 02 pencil)
```

The frontend picks the 3 images matching the user's selected illustration style.

---

## Part A — Backend Changes

### A1. Remove dynamic image generation from direction flow

**File: `backend/providers/story-directions.ts`**

The current `generateStoryDirections()` function:
1. Calls LLM to generate personalized direction drafts
2. Generates 3 AI images (the slow, expensive part)
3. Saves everything to DB

**Change**: Skip step 2 entirely. The `previewImageUrl` field should be set to the static card path instead.

In the function that builds and saves directions, after building the drafts:

```typescript
// Instead of generating images, use static card paths
const styleKey = normalizeStyleId(input.illustrationStyle);
const styleNum = styleKey === 'expressive_painterly_storybook' ? 'style02' : 'style01';

for (const draft of drafts) {
  draft.previewImageUrl = `/direction-cards/${draft.archetype}_${styleNum}.jpg`;
  draft.previewImageRawUrl = draft.previewImageUrl;
}
```

Remove or skip the entire image generation loop (`for (const draft of drafts) { ... generateImage(...) ... }`).

The LLM call to generate personalized title/summary/premise STAYS — that's cheap, fast, and valuable. Only the image generation is removed.

### A2. Speed up the direction API

**File: `app/api/story-directions/route.ts`**

Since we're no longer generating images, the direction flow should be much faster (just one LLM call ~5-10s). Consider:
- Remove the polling mechanism complexity if directions complete synchronously
- OR keep polling but it will resolve almost instantly

**Recommended**: Keep the existing polling pattern but it will just resolve in one poll cycle. Don't refactor the polling — it's not worth the risk. The user experience improvement from instant images is enough.

### A3. Update `parentFacingCardSummary` labels

**File: `backend/providers/story-directions.ts` — function `parentFacingCardSummary`**

```typescript
function parentFacingCardSummary(
  archetype: StoryDirectionArchetype,
  hero: string,
  companion: { name: string } | null
): string {
  const companionBit = companion ? ` יחד עם ${companion.name}` : '';
  switch (archetype) {
    case 'connection':
      return `סיפור רגוע ומחבק שמלווה את ${hero} לשינה מתוקה${companionBit}. חום, ביטחון וחיבוק לפני שינה.`;
    case 'adventure':
      return `${hero} יוצא/ת להרפתקה מלאת הפתעות וגילויים${companionBit}. סיפור עם תנועה, סקרנות ואומץ.`;
    case 'courage':
      return `${hero} נכנס/ת לעולם קסום מלא דמיון${companionBit}. יצורים מופלאים, מקומות מדהימים וקסם אמיתי.`;
  }
}
```

### A4. Update direction labels in `DIR_DEFAULTS`

**File: `public/JS/directions.js`**

```javascript
labels: {
  connection: 'סיפור לפני שינה',
  adventure: 'סיפור הרפתקאות',
  courage: 'סיפור קסום',
},
```

### A5. Update `buildPersonalizedCopy` titles and premises

**File: `backend/providers/story-directions.ts` — function `buildPersonalizedCopy`**

Update the base drafts:

```typescript
const baseDrafts: StoryDirectionDraft[] = [
  {
    archetype: 'connection',
    title: `לילה טוב, ${hero}`,
    summary: parentFacingCardSummary('connection', hero, input.companion),
    emotionalLabel: 'חיבור וביטחון',
    storyPremise: `Calm bedtime arc for ${hero} tied to topic "${topic}"; emphasize co-regulation, warmth, humor, and a recognizable home anchor. The story should feel like a warm hug before sleep. Include gentle funny moments. ${premiseContext}`,
    openingScenePrompt: `Home evening scene for ${hero}: soft lamp, tactile comfort, a parent or trusted figure nearby, topic "${topic}" implied through props not text.`,
    previewImagePrompt: '',
  },
  {
    archetype: 'adventure',
    title: `ההרפתקה של ${hero}`,
    summary: parentFacingCardSummary('adventure', hero, input.companion),
    emotionalLabel: 'הרפתקה וגילוי',
    storyPremise: `Exciting adventure for ${hero} tied to "${topic}"; movement, wonder, playful discovery, and humor. The child discovers courage through action. Include funny surprising moments. ${premiseContext}`,
    openingScenePrompt: `A clear transition beat: ${hero} steps toward a whimsical outdoor or hybrid space, bright and inviting, tied to "${topic}".`,
    previewImagePrompt: '',
  },
  {
    archetype: 'courage',
    title: `${hero} והעולם הקסום`,
    summary: parentFacingCardSummary('courage', hero, input.companion),
    emotionalLabel: 'קסם ודמיון',
    storyPremise: `Magical imagination-driven story for ${hero} about "${topic}"; fantastical creatures, enchanted places, flying elephants, singing objects, impossible but wonderful things happen. Humor is essential — funny magical mishaps and surprises. The child discovers inner power through wonder and creativity. ${premiseContext}`,
    openingScenePrompt: `A magical portal or transformation scene: ${hero} discovers an enchanted space, fantastical creatures appear, tied to "${topic}".`,
    previewImagePrompt: '',
  },
];
```

### A6. Story premise — ensure humor in ALL directions

Add to ALL three `storyPremise` strings (already done above, but as a rule):
- Every story should include at least 2-3 genuinely funny moments
- Humor should be warm and situational, not slapstick
- Funny moments relieve tension and build trust with the child

---

## Part B — Frontend Changes

### B1. Card image display — use static path based on style

**File: `public/JS/directions.js`**

When rendering cards, instead of waiting for `direction.previewImageUrl` from the API (which may be empty during transition), construct the image path:

```javascript
function getCardImageUrl(archetype, illustrationStyle) {
  const styleNum = illustrationStyle === 'expressive_painterly_storybook' ? 'style02' : 'style01';
  return `/direction-cards/${archetype}_${styleNum}.jpg`;
}
```

Use this in the card rendering function. If the API returns a `previewImageUrl`, use it; otherwise fallback to the static path. This makes it backward-compatible with old orders.

### B2. Remove loading/polling UI for images

The loading state (`data-state="loading"`) can be shown briefly while the LLM generates the personalized text (~5-10s), but:
- Remove the progress bar (there's no image generation to track)
- Show a simpler spinner: "מכינים את האפשרויות שלכם..."
- The cards should appear with images immediately once the text is ready

### B3. Reduce timeouts

**File: `public/JS/directions.js`**

```javascript
const MAX_PENDING_MS = 60000;      // was 360000 — no image gen, just LLM
const MAX_NO_PROGRESS_MS = 30000;  // was 240000
```

---

## Part C — Image Generation Script

Create a one-time script to generate the 6 static card images.

**File: `scripts/generate-direction-cards.ts`**

```typescript
/**
 * Generate static direction card images — 6 total (3 archetypes × 2 styles).
 * Run once, save to public/direction-cards/.
 *
 * Usage: npx tsx scripts/generate-direction-cards.ts
 */

import 'dotenv/config';
import OpenAI from 'openai';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import Replicate from 'replicate';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const OUT_DIR = 'public/direction-cards';

// Style 01 — GPT Image (cartoon-realistic Pixar-like)
const STYLE_01_PREFIX = `Children's storybook illustration — cartoon-realistic style:
- Warm, inviting illustrated style — like a modern Pixar concept art painting
- Characters have realistic human proportions with gentle softness
- Smooth, clean rendering — no heavy brushstrokes
- Soft natural lighting, cheerful and clear
- Background dissolves into very light watercolor washes — nearly white with hint of cream
- Natural color palette — soft greens, warm blues, earth tones
- Modern and light, not vintage
- Square composition, cozy intimate framing
- No text, no letters, no UI elements`;

// Style 02 — Flux+LoRA (pencil on cream)
const STYLE_02_PREFIX = `PENCILSTYLE02 pencil illustration on cream paper, soft watercolor touches, hand-drawn storybook, clear character focus,`;

const SCENES = {
  connection: {
    description: 'Bedtime story — warmth and security',
    style01: `${STYLE_01_PREFIX}

Scene: A young child in soft pajamas sitting on a cozy bed, holding a plush toy close to their chest. A warm bedside lamp glows softly. A parent figure sits on the edge of the bed, reading a book together. The room feels safe and warm. Gentle, sleepy, peaceful mood.`,
    style02: `${STYLE_02_PREFIX} A young child in pajamas cuddled up in bed with a plush toy, a warm lamp glowing nearby, parent sitting on bed edge reading together, cozy bedroom, peaceful sleepy mood, warm cream paper background`,
  },
  adventure: {
    description: 'Adventure story — discovery and courage',
    style01: `${STYLE_01_PREFIX}

Scene: A young child with a small backpack standing at the edge of a magical forest trail. Sunlight streams through tall trees. A friendly small fox peeks from behind a tree. The child looks excited and curious, one foot forward on the path. Bright, adventurous, wonder-filled mood.`,
    style02: `${STYLE_02_PREFIX} A young child with backpack at the edge of a magical forest trail, sunlight through trees, friendly fox peeking from behind tree, child looks excited and curious stepping forward, bright adventurous mood, warm cream paper background`,
  },
  courage: {
    description: 'Magical story — imagination and wonder',
    style01: `${STYLE_01_PREFIX}

Scene: A young child floating gently among soft colorful clouds in a magical sky. Friendly fantastical creatures surround them — a tiny flying elephant with butterfly wings, a glowing singing bird, floating lanterns. The child has wide eyes full of wonder, arms spread with joy. Dreamlike, magical, full of wonder and delight.`,
    style02: `${STYLE_02_PREFIX} A young child floating among soft colorful clouds in magical sky, tiny flying elephant with butterfly wings, glowing singing bird, floating lanterns, child with wide eyes of wonder arms spread with joy, dreamlike magical mood, warm cream paper background`,
  },
};

async function generateStyle01(archetype: string, prompt: string): Promise<Buffer> {
  console.log(`[GPT Image] Generating ${archetype}_style01...`);
  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1024',
    quality: 'high',
    n: 1,
  });
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('No b64 data');
  return Buffer.from(b64, 'base64');
}

async function generateStyle02(archetype: string, prompt: string): Promise<Buffer> {
  console.log(`[Flux+LoRA] Generating ${archetype}_style02...`);
  const loraModel = process.env.LORA_MODEL_STYLE_02;
  if (!loraModel) throw new Error('LORA_MODEL_STYLE_02 not set in .env');

  const output = await replicate.run(loraModel as `${string}/${string}`, {
    input: {
      prompt,
      num_outputs: 1,
      aspect_ratio: '1:1',
      output_format: 'jpg',
      output_quality: 90,
      num_inference_steps: 28,
      guidance_scale: 3.5,
    },
  });

  const url = Array.isArray(output) ? output[0] : output;
  const urlStr = typeof url === 'object' && url !== null && 'url' in url
    ? (url as { url: () => { href: string } }).url().href
    : String(url);

  const res = await fetch(urlStr);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  console.log('═══ Generating 6 static direction card images ═══\n');
  await mkdir(OUT_DIR, { recursive: true });

  for (const [archetype, scenes] of Object.entries(SCENES)) {
    console.log(`\n── ${archetype}: ${scenes.description} ──`);

    // Style 01 — GPT Image
    const buf1 = await generateStyle01(archetype, scenes.style01);
    const path1 = join(OUT_DIR, `${archetype}_style01.jpg`);
    await writeFile(path1, buf1);
    console.log(`  ✓ ${path1} (${Math.round(buf1.length / 1024)} KB)`);

    // Brief pause
    await new Promise(r => setTimeout(r, 2000));

    // Style 02 — Flux+LoRA
    const buf2 = await generateStyle02(archetype, scenes.style02);
    const path2 = join(OUT_DIR, `${archetype}_style02.jpg`);
    await writeFile(path2, buf2);
    console.log(`  ✓ ${path2} (${Math.round(buf2.length / 1024)} KB)`);

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n═══ Done! 6 images saved to public/direction-cards/ ═══');
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
```

---

## Part D — DB Schema

**No schema changes needed.** The `StoryDirection` model keeps `previewImageUrl` — it just gets a static path instead of a Supabase URL. The enum `StoryDirectionArchetype` stays `connection | adventure | courage`.

---

## Execution Order

1. **Run the image generation script** → creates 6 images in `public/direction-cards/`
2. **Backend changes** (A1–A6) → skip image generation, use static paths, update labels
3. **Frontend changes** (B1–B3) → use static image paths, simplify loading
4. **Test** → create a new order, verify cards appear instantly with correct images per style

## Files to Change

| File | Change |
|---|---|
| `scripts/generate-direction-cards.ts` | NEW — one-time image generation script |
| `backend/providers/story-directions.ts` | Skip image gen, update labels/premises, set static image paths |
| `public/JS/directions.js` | Update labels, add static image fallback, reduce timeouts |
| `public/direction-cards/*.jpg` | NEW — 6 static card images |

## What NOT to Change

- DB schema / Prisma enum — `courage` stays as the enum value
- `app/api/story-directions/route.ts` — polling pattern stays (just resolves faster)
- `app/api/story-directions/select/route.ts` — selection logic unchanged
- The LLM call for personalized text — this stays, it's the valuable part

## Cost Impact

- **Before**: ~$0.15/order for 3 direction preview images + ~5 min wait
- **After**: $0.00 for images + ~10s wait (just LLM text)
- Saves ~$0.15 × every order + eliminates timeout failures entirely
