# Phase 3g — Story Quality, Companion Logic, Character Consistency

## Context
Generated a test book ("הספר של יובל") — quality review revealed systemic issues across story, companion integration, and image generation. This brief addresses the pipeline-level problems that CSS alone can't fix.

## Problems (ordered by severity)

### P1. Character consistency is catastrophically broken
**Symptom:** The child looks completely different on nearly every page — hair color/style, clothing, body proportions, and even gender presentation change. On one page the child disappeared entirely and was replaced by two pandas.

**Root cause:** The anchor image system isn't constraining Flux enough. `translateSceneForImage` (GPT-4o-mini) rewrites the scene description and may drop or alter character details. The Flux model then interprets each page independently.

**Fix required:** Strengthen the character visual lock in every image prompt. In `image.ts`, the `heroVisualLock` and companion visual description need to be **prepended as hard constraints** to every Flux prompt, not just mentioned in context.

**Files:** `backend/providers/image.ts`

**Changes:**
1. In `buildPromptParts()` (around line 330-370), ensure the hero visual lock is emitted as the FIRST lines of the prompt, with explicit "MUST MATCH" framing:
   ```
   CHARACTER_LOCK (do NOT deviate): [age] [gender] child, [hair], [skin tone], [clothing]. Must be visually identical on every page.
   ```
2. In `translateSceneForImage()` system prompt (line 443-461), add a hard rule:
   ```
   - NEVER change the child's appearance: hair color, hair style, clothing, skin tone, and age must remain EXACTLY as described in the character lock
   - NEVER omit the main character from the scene — the child MUST appear on every story page
   ```
3. When the companion is described, add similar lock:
   ```
   COMPANION_LOCK (do NOT deviate): [species], [color], [outfit]. Same design every page.
   ```

---

### P2. Companion forced on every page (even when not in text)
**Symptom:** The panda companion appears in every single illustration even on pages where the text doesn't mention her. Makes pages feel repetitive and formulaic.

**Root cause:** `pipeline.ts` line 682: "Every story beat must feature this companion meaningfully." + line 683: "Require the companion to appear by name in multiple spreads, not only the opening."

**Fix required:**

**File:** `backend/providers/pipeline.ts` (around line 675-685)

Replace the companion block text:
```
FROM:
Every story beat must feature this companion meaningfully. The companion helps the child discover their superpower. The companion is not a sidekick — they are the catalyst of the transformation. The JSON "entity" in your output should align with this companion (personality, role, catalytic function) while the Hebrew story text uses the Hebrew name above. Close the final narrative with a moment where the companion acknowledges the child's newfound power by name.
Require the companion to appear by name in multiple spreads, not only the opening.

TO:
The companion is the story catalyst — present in key emotional moments, NOT on every page.
Rules for companion presence:
- The companion MUST appear in the opening (scenes 1-2), the emotional turning point (scenes 5-6), and the resolution (scenes 9-10).
- The companion MAY appear in 1-2 other scenes where they add humor, comfort, or surprise.
- Scenes 3-4 and 7-8 should have moments WITHOUT the companion — let the child act independently.
- When the companion appears, give them personality: clumsy attempts to help, exaggerated reactions, physical comedy, surprised expressions.
- The companion is NOT a silent sidekick following the child — they have opinions, make mistakes, and add humor.
- The JSON "entity" in your output should align with this companion.
- Close the final narrative with a moment where the companion acknowledges the child's growth.
```

**File:** `backend/providers/image.ts`

In `generateAllPageImages` or wherever image prompts are assembled: only include the companion visual description in the image prompt if the companion's name appears in the page's Hebrew text. Add a simple check:
```typescript
const companionInText = companion?.name && pageText.includes(companion.name);
// Only add companion to image prompt if mentioned in text
```

---

### P3. All compositions look identical
**Symptom:** Every page has the same camera angle (medium shot), same character positions (two figures standing center), same empty background.

**Root cause:** Phase 3f composition injection was implemented but may not be reaching Flux effectively. The `COMPOSITION_ROTATION` in `image.ts` defines varied compositions, but `translateSceneForImage` may be stripping them.

**Fix required:**

**File:** `backend/providers/image.ts`

1. In `translateSceneForImage()` system prompt, add:
   ```
   - PRESERVE the exact camera angle and composition type from the existing scene description (wide shot, close-up, low angle, etc.)
   - If the existing description says "wide shot" do NOT rewrite it as a medium shot
   - If it says "low angle" do NOT change to eye level
   ```

2. In `translateSceneForImage()` user prompt, make the composition directive more prominent:
   ```
   COMPOSITION (DO NOT CHANGE): [composition directive from stage 4B]
   ```

3. Verify that `buildCompositionDirectiveFromStage4Plan()` output is actually present in the prompt that reaches `translateSceneForImage`. Add a console.log to confirm.

---

### P4. Story lacks drama, humor, and variety
**Symptom:** Story is flat — same "try → fail → try again" loop. No escalation, no surprise, no humor. The companion adds no personality.

**Root cause:** The prose system prompt (`buildProse3ASystem`) says "humor must be physical" and "every 2-3 scenes must contain a fun/silly/surprising moment" but this isn't specific enough. The LLM defaults to safe, repetitive structure.

**Fix required:**

**File:** `backend/providers/pipeline.ts` — in `buildProse3ASystem()` (line 1054)

Add these rules to the system prompt (after the "Mandatory style" section):

```
DRAMATIC ARC (mandatory — do NOT write a flat sequence):
- Scenes 1-2: SETUP — establish the world, introduce the problem, meet the companion. Tone: curious, slightly mysterious.
- Scenes 3-4: FIRST ATTEMPTS — the child tries something, it goes amusingly wrong. The companion may make things worse by "helping." Tone: playful chaos.
- Scenes 5-6: ESCALATION — the stakes get higher. Something unexpected happens. A new element enters. The child feels doubt or frustration (briefly, age-appropriate).
- Scene 7: TURNING POINT — a moment of insight, courage, or connection that changes everything. This is the emotional peak.
- Scenes 8-9: RESOLUTION — the child applies what they learned. The world responds. The companion reacts with visible pride/joy.
- Scene 10: WARM CLOSE — a satisfying final beat that feels like a hug. Call back to scene 1.

HUMOR RULES (companion-driven):
- The companion must have at least 2 genuinely funny moments: physical comedy (tripping, getting stuck, misunderstanding something), exaggerated reactions ("!הפנדה קפצה מפחד ונחבאה מאחורי עלה קטנטן"), or absurd "help" that backfires.
- At least 1 scene should have the child laugh out loud at something the companion does.
- Humor should come from CHARACTER, not from narration. Show funny things happening, don't describe them as "funny."

ANTI-REPETITION (critical):
- NEVER repeat the same action pattern in consecutive scenes. If scene 3 has "tried X and it didn't work," scene 4 MUST NOT have "tried Y and it didn't work."
- Each scene must introduce at least ONE new element: a new character, a new place, a new object, a new ability, a new emotion, or a new problem.
- Vary sentence structure. If one scene starts with action, the next should start with dialogue or environment.
```

---

### P5. Cover style doesn't match interior
**Symptom:** Cover illustration has a different art style (more realistic/polished) than interior pages (more cartoon/sketch).

**Root cause:** Cover may use different generation parameters or the STYLE_LOCK isn't applied identically.

**Fix required:**

**File:** `backend/providers/image.ts`

Verify that the cover image generation uses the **exact same** `STYLE_LOCK` block as interior pages. Search for where the cover image is generated — it may have a separate code path. Ensure the style contract is identical.

---

### P6. Images don't match the text content
**Symptom:** Text says "הכדור נבעט חזק" (ball kicked hard) but image shows calm characters. Text says "יובל קפאה במקום כמו פסל" (froze like a statue) but image shows normal standing. Page 8 shows a basketball instead of a soccer ball.

**Root cause:** `translateSceneForImage` (GPT-4o-mini) isn't extracting the specific dramatic moment from the Hebrew text. It produces generic descriptions.

**Fix required:**

**File:** `backend/providers/image.ts` — `translateSceneForImage()` system prompt

Add:
```
- FOCUS on the single most dramatic/emotional MOMENT in the Hebrew text — not the overall scene summary
- If the text describes a specific object (soccer ball, book, lamp), that EXACT object must appear in the scene description
- If the text describes an emotion (frozen, scared, laughing), the character's BODY LANGUAGE and FACIAL EXPRESSION must show it vividly
- Do NOT generalize: "children playing" is WRONG if the text says "the ball flew toward Yuval who froze in place"
```

---

## Implementation Order
1. **P2** (companion logic) — fastest, biggest visual impact
2. **P4** (story quality prompts) — fast, improves story quality
3. **P1** (character lock) — medium effort, critical for book feel
4. **P3** (composition variety) — verify existing 3f fix, small tweaks
5. **P6** (text-image matching) — small prompt change
6. **P5** (cover style) — investigate and fix

## Testing
After implementing, generate a new book with:
- Style: the same style used in the "יובל" book
- Companion: any panda or similar
- Topic: something with clear dramatic potential (e.g., social/playground scenario)
- Check: character consistent, companion not on every page, composition varies, story has humor and arc
