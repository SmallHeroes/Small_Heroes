# Phase 3e.3 — textZone persistence + character lock from wizard data

## Context
After 3e.1+3e.2, images now match story content (scene translation is working). Three issues remain:
1. Text overlay always renders at bottom — even when top has open space
2. Character (boy) looks different every page — protagonist lock is vague
3. Style inconsistency on some pages — deferred to LoRA (Phase 3b), not addressed here

## Tasks

### T1 — Persist textZone to DB + surface in orders API

The storyboard stage already generates `textZone` per page (image.ts line 684-687). The reader already supports all 5 zones (reader-v2.tsx line 100-108). But `BookPage` has no `textZone` column, so it's lost.

**Step 1: Add column to BookPage**

In `backend/schema.prisma`, add to `BookPage`:
```prisma
model BookPage {
  // ... existing fields ...
  textZone    String?   // 'top_clear' | 'bottom_clear' | 'left_clear' | 'right_clear' | 'center_clear'
}
```

Run:
```bash
npx prisma db push
```

**Step 2: Persist textZone during generation**

Find where BookPage rows are created during generation. Search for `prisma.bookPage.create` or `prisma.bookPage.createMany` in the codebase. At that point, the storyboard data (which has `textZone`) should be available. Add `textZone: pageStoryboard.textZone` to the create data.

Look in `app/api/generate/route.ts` and `backend/providers/image.ts` — the image generation loop has access to `pageStoryboard.textZone` (see image.ts lines 1927, 2063, 2185, 2267).

The BookPage is likely created before image generation starts. If so, search for where pages are inserted (probably after prose generation) and check if the storyboard data is available at that point. If not, update the BookPage row after storyboard generation.

**Step 3: Return textZone from orders API**

In `app/api/orders/[orderId]/route.ts`, add `textZone` to the page select (around line 128):
```typescript
pages: {
  orderBy: { pageNumber: 'asc' },
  select: {
    pageNumber: true,
    text: true,
    pageTemplate: true,
    textZone: true,          // ← ADD THIS
    imageAsset: {
      select: {
        url: true,
        presentationUrl: true,
      },
    },
  },
},
```

Also add `textZone` to the contentPages map (around line 184):
```typescript
const contentPages = pageRows.map((p, i) => {
  const resolvedTemplate = normalizePageTemplate(p.pageTemplate) ?? fallbackTemplates[i];
  return {
    pageNumber: p.pageNumber,
    text: p.text,
    imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null,
    pageTemplate: resolvedTemplate,
    textPlacement: textPlacementForTemplate(resolvedTemplate),
    textZone: p.textZone ?? null,  // ← ADD THIS
  };
});
```

**Step 4: Verify reader picks it up**

The reader already reads `page.textZone` (reader-v2.tsx line 86) and falls back to `'bottom_clear'` when null. With T1 wired up, it should get real values. No reader changes needed.

### T2 — Build character lock from wizard data (not LLM guesses)

In `backend/providers/image.ts`, the `buildCompactProtagonistLock` function (line 1006) only reads `heroVisualLock` fields (which the LLM generates and are often vague). The Order has real data:
- `childAge` (int) — e.g. 4
- `childGender` (string) — 'boy' or 'girl'
- `childName` (string)
- `childImageUrl` (optional photo URL)

**Step 1: Extend buildCompactProtagonistLock input**

Add wizard fields to the function signature:
```typescript
function buildCompactProtagonistLock(input: {
  childName?: string | null;
  childDescription?: string;
  heroVisualLock?: HeroVisualLock;
  orderId?: string;
  pageNumber?: number;
  // NEW — wizard data
  childAge?: number | null;
  childGender?: string | null;
}): string {
```

**Step 2: Use wizard data as primary source, heroVisualLock as supplement**

Replace the age/gender derivation at the top of the function:
```typescript
// Age: prefer wizard data (concrete number) over LLM guess
const ageFromWizard = input.childAge ? `${input.childAge}-year-old` : null;
const ageFromLock = extractVisualPhrase(source?.ageImpression ?? '', 'young child');
const age = ageFromWizard ?? (isVagueVisualPhrase(ageFromLock) ? 'young' : ageFromLock);

// Gender: prefer wizard data
const genderFromWizard = input.childGender === 'girl' ? 'girl' : input.childGender === 'boy' ? 'boy' : null;
const genderFromLock = inferGenderFromText(input.childDescription ?? source?.ageImpression ?? '');
const gender = genderFromWizard ?? genderFromLock;
```

The rest of the function (hair, skin, face, clothing, eyes from heroVisualLock) stays the same — those supplement the concrete age/gender base.

**Step 3: Pass wizard data from callers**

Find where `buildCompactProtagonistLock` is called (image.ts lines ~1193 and ~1276). These are inside `buildPromptParts`. The `input` at that level has `orderId` — from there, the wizard data needs to be threaded through.

Search for where `buildPromptParts` is called. The `ImageInput` type (image.ts line ~120) needs `childAge` and `childGender` added:
```typescript
export interface ImageInput {
  // ... existing fields ...
  childAge?: number | null;
  childGender?: string | null;
}
```

Then trace back to where `ImageInput` is constructed during generation (image.ts lines ~1927, 2063, 2185, 2267) and add `childAge` and `childGender` from the order/config data.

The generation config (the object passed around during image generation) likely already has access to the order data. Search for where `childName` is set on the image input — `childAge` and `childGender` should be passed from the same source.

**Step 4: Log the improved lock**

The existing log at line 1054 already shows the compact lock. After this change, it should show concrete age like "בר, a 4-year-old boy with short brown hair..." instead of "בר, a young child boy".

### T3 — Strengthen style anchor in prompt (minor)

In `lib/promptBuilder.ts` line 62, the style line is:
```
Style: ${styleSentence} Full-bleed illustration for a children's picture book page, portrait 2:3.
```

Add consistency anchor:
```
Style: ${styleSentence} Full-bleed illustration for a children's picture book page, portrait 2:3. Maintain exact same artistic style, color palette, and rendering technique across all pages.
```

This won't solve the fundamental problem (needs LoRA) but gives Flux a nudge.

## Safety
- `npx prisma db push` is needed for the new column — run before testing
- T1 is backward-compatible: existing pages will have `textZone=null`, reader falls back to `bottom_clear`
- T2 only changes prompt content, not pipeline flow
- T3 is a one-line string change
- `npm run build` must pass

## Acceptance criteria
- `npm run build` passes
- New BookPage rows have `textZone` populated (not null)
- Orders API returns `textZone` per page
- Reader renders text at correct zone (verify visually — if page image has clear top, text should be at top)
- `[protagonist_lock_compact]` logs show concrete age like "4-year-old" instead of "young child"
- `[character_lock_resolved]` still logs field presence

## Verification
1. Generate a new book (or re-trigger the failed order)
2. Check DB: `SELECT "pageNumber", "textZone" FROM "BookPage" WHERE "bookId" = '...'` — should see varied zones
3. Check API response: `curl localhost:3000/api/orders/{id}?accessKey=...` — pages should have textZone
4. Open reader — text should appear at different positions on different pages
5. Check logs for `[protagonist_lock_compact]` — verify concrete descriptions

## Return format
- **GO / NO-GO**
- **Files changed**
- **DB migration** — confirm `npx prisma db push` ran successfully
- **Sample textZone values** — paste DB query showing textZone per page for a generated book
- **Sample protagonist lock** — paste `[protagonist_lock_compact]` log line
- **Visual check** — does text appear at top on pages where image has clear top area?

## Git commit (after GO)
```
phase 3e.3: persist textZone + character lock from wizard data

T1: textZone column on BookPage, persisted during generation, returned by orders API
    Reader now renders text at the zone the storyboard chose (was always bottom_clear)
T2: buildCompactProtagonistLock uses wizard childAge/childGender as primary source
    "4-year-old boy" instead of "young child" — more consistent character rendering
T3: style consistency anchor added to prompt suffix
```

Stage:
```powershell
git add backend/schema.prisma app/api/orders/[orderId]/route.ts backend/providers/image.ts lib/promptBuilder.ts
git diff --cached --stat
```
(Add any additional files that were changed)
