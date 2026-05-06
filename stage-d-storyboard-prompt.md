# Stage D — Storyboard Layer Implementation

## Principle
Image generation is execution, not creation. Creative decisions (shot, composition, action, text zone, mood) must be made in a structured storyboard layer BEFORE any image prompt is built.

## Scope

### In scope
- Storyboard schema + types
- Storyboard generation (single batch LLM call per book)
- Persistence on Page records
- Image prompt construction from storyboard fields
- Reduce active styles from 3 to 2 (deprecate, don't delete)
- Feature flag + fallback path
- One snapshot test
- Debug visibility via stored JSON

### Out of scope — do NOT touch
- LoRA / IP-Adapter / ControlNet
- Visual QA / verification loop
- Reader/UI rendering (read-v2 must keep working unchanged)
- Checkout, payment, order locking
- Any refactor not directly required

## Schema

Inspect repo type conventions first, then create:

```ts
export const PAGE_COMPOSITION_MODES = [
  'full_bleed', 'vignette', 'spot', 'asymmetric', 'edge_bleed'
] as const
export type PageCompositionMode = typeof PAGE_COMPOSITION_MODES[number]

export const PAGE_SHOT_TYPES = [
  'wide', 'medium', 'close', 'over_shoulder', 'silhouette', 'detail'
] as const
export type PageShotType = typeof PAGE_SHOT_TYPES[number]

export const PAGE_TEXT_ZONES = [
  'top', 'bottom', 'left', 'right', 'sky', 'wall', 'floor', 'quiet_margin'
] as const
export type PageTextZone = typeof PAGE_TEXT_ZONES[number]

export const CAMERA_ANGLES = [
  'eye_level', 'low', 'high', 'overhead', 'dutch', 'pov'
] as const
export type CameraAngle = typeof CAMERA_ANGLES[number]

export const LIGHTING_KEYS = [
  'soft_daylight','warm_window','overcast','golden_hour',
  'moonlight','candlelight','indoor_lamp','dappled','dramatic_backlight'
] as const
export type LightingKey = typeof LIGHTING_KEYS[number]

export const EMOTIONAL_REGISTERS = [
  'calm','warm','curious','tense','sad','joyful','playful','triumphant','intimate'
] as const
export type EmotionalRegister = typeof EMOTIONAL_REGISTERS[number]

export const NARRATIVE_BEATS = [
  'setup','rising','turn','climax','rest','resolution'
] as const
export type NarrativeBeat = typeof NARRATIVE_BEATS[number]

export const PAGE_POSITIONS = ['left', 'right', 'single'] as const
export type PagePosition = typeof PAGE_POSITIONS[number]

export const STORYBOARD_SCHEMA_VERSION = 1

export type PageVisualStoryboard = {
  schemaVersion: typeof STORYBOARD_SCHEMA_VERSION

  pageNumber: number
  spreadId: number          // pages on the same spread share spreadId
  pagePosition: PagePosition

  // Story
  narrativeBeat: NarrativeBeat
  emotionalTone: EmotionalRegister

  // Action — three distinct sub-fields, never one prose blob
  actionVerb: string        // e.g. "reaches for"
  actionObject: string      // e.g. "the floating lantern"
  setting: string           // e.g. "in his moonlit bedroom"

  // Cast & place
  charactersPresent: string[]
  location: string

  // Visual direction
  shotType: PageShotType
  cameraAngle: CameraAngle
  compositionMode: PageCompositionMode
  lighting: LightingKey

  // Text reservation
  textZone: PageTextZone           // VISUAL position (not RTL-flipped)
  textZoneSize: 'small' | 'medium' | 'large'

  // Single art-director sentence consumed directly by the prompt builder
  imagePromptIntent: string

  // Optional enrichment
  environmentDetails: string

  // Per-page negatives (style-level negatives are appended separately)
  negativePromptHints: string[]
}
```

Mirror this with a Zod schema for runtime validation.

## Persistence

Add to Prisma schema:

```prisma
model Page {
  // ... existing fields
  visualStoryboard  Json?
}

model Book {
  // ... existing fields
  storyboardVersion Int @default(1)
}
```

Generate the migration. Do NOT backfill existing books.

## Pipeline behavior

Inspect existing pipeline first (likely candidates: `backend/providers/pipeline.ts`, `backend/providers/image.ts`, `backend/providers/story-directions.ts`, `lib/visualDirector.ts` — verify before editing).

Then:

1. After story + page breakdown completes, call `generateStoryboard(book)` ONCE per book.
2. `generateStoryboard` makes a SINGLE batch LLM call passing:
   - full story
   - all page texts, numbered
   - child profile
   - chosen direction
   - selected illustration style (1 of 2)
   - the schema (as TS types or JSON schema in the system prompt)
   - rhythm rules (below)
3. The LLM returns an array of `PageVisualStoryboard`, one per page.
4. Validate with Zod. On parse failure: retry once, including the validation error in the prompt. On second failure: log `[storyboard:fallback]` warn and use the legacy page-text→prompt path. Do NOT block the order.
5. Persist each storyboard to `Page.visualStoryboard`.
6. Image prompts are built from the storyboard, NOT from page text.

### Rhythm rules
Enforce in the LLM system prompt AND validate after parsing:

- No two consecutive pages share the same `shotType`.
- No two consecutive pages share the same `compositionMode`.
- No two consecutive pages share the same `lighting`.
- At least one page uses `wide`.
- At least one page uses `close` or `detail`.
- At least one page has 2+ characters AND an interaction `actionVerb`.
- Every page has non-empty `actionVerb`, `actionObject`, `setting`, `location`.

If validation fails after retry → fallback (do not block).

## Image prompt construction

Replace the current page-text→prompt builder. New order:

1. **Style lock** (full block — see Style System)
2. **Storyboard intent**: `imagePromptIntent`
3. **Composition**: `compositionMode` + `shotType` + `cameraAngle`
4. **Environment**: `setting` + `location` + `environmentDetails`
5. **Characters & action**: `charactersPresent` + `actionVerb` + `actionObject`
6. **Mood & light**: `emotionalTone` + `lighting`
7. **Text reservation**: explicit instruction derived from `textZone` + `textZoneSize`, e.g.
   *"Leave the upper-left wall area visually quiet and uncluttered (medium space) for later Hebrew typesetting. Do not draw any text or letters in the image."*
8. **Negatives**: style-level negatives + `negativePromptHints`

The final prompt should read like an art-director brief, not a sentence pulled from page text.

## Style system

Reduce active styles from 3 to 2. Style 3 must be **deprecated, not deleted**:
- Mark style 3 with `deprecated: true` in the styles config.
- Hide it from any user-facing picker/UI.
- Keep its code path so existing books generated with style 3 still render.
- Do NOT migrate existing books.

### Style 1 — Soft Hand-Drawn Emotional
Style block prepended to image prompt:
> Soft hand-drawn children's book illustration, pencil linework, gentle watercolor and colored-pencil texture, visible paper grain, natural emotionally warm scene lighting, intimate storytelling, hand-crafted feel.

Negatives:
> 3D render, CGI, plastic, octane, vray, glossy, smooth airbrush, digital painting, photo, hyperreal.

### Style 2 — Expressive Painted Comedic
Style block:
> Expressive painted children's book illustration, gouache and oil-pastel feel, exaggerated proportions and comic shape language, painterly brush texture, visible imperfect edges, cinematic energetic composition, sculptural volume but hand-painted (NOT 3D), funny and characterful.

Negatives:
> 3D render, CGI, plastic, octane, vray, polished digital, smooth airbrush, photoreal, blender.

Style block + negatives must be applied automatically per page — never rely on the LLM to remember them.

## Feature flag

Gate everything behind env var `FEATURE_STORYBOARD` (boolean, default `false`).

- `false` → legacy page-text→prompt path runs unchanged.
- `true` → storyboard pipeline runs; on any failure, falls back to legacy with `[storyboard:fallback]` warn log.
- Add the flag to the example `.env` and document it in the PR description.

## Debug

`Page.visualStoryboard` JSON is the debug surface — no separate endpoint.
Logging:
- INFO once per book: `[storyboard] book=<id> pages=<n> style=<style>`
- DEBUG once per page: `page=<n> shot=<x> comp=<y> zone=<z>`

## Tests

Add ONE snapshot test (e.g. `tests/storyboard.test.ts`, follow repo convention):
- Use a fixture story (3–5 pages of fixed text).
- Mock the LLM client to return a fixed storyboard JSON fixture.
- Assert: parsed storyboard validates, rhythm rules pass, image prompts contain style block + intent + textZone instruction.
- Assert: no Flux / image client is invoked.

No external API calls in tests. Mock all providers.

## Safety

Do NOT:
- Trigger external image generation during dev/tests.
- Touch checkout / payment / order locking.
- Modify reader UI or the read-v2 path.
- Backfill existing books.
- Refactor unrelated code.
- Delete style 3 code.

## Acceptance criteria

- Storyboard generated before image prompts when flag is on.
- Image prompts use storyboard fields (verifiable in logs and snapshot test).
- Consecutive pages vary in `shotType`, `compositionMode`, and `lighting`.
- Style 3 hidden from picker but its code path is intact.
- read-v2 unchanged and working.
- `npm run build` passes.
- `tsc --noEmit` passes (or repo equivalent).
- No new ESLint errors.
- Snapshot test passes.
- No external image API calls in tests.

## Return format

Reply with:
- **GO / NO-GO** decision
- **Files changed** — full list, one line per file describing what changed
- **Where storyboard is generated** — function + file
- **How image prompts changed** — before/after example, 5–10 lines each
- **Where style 3 was deprecated** — file + line refs
- **Feature flag location** — file + var name
- **Risks / open questions** — anything you want confirmed before merge
