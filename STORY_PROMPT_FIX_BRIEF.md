# Story Prompt Fix Brief — Root Cause & Solution

**Priority: CRITICAL — this is why all generated stories are flat**

---

## Root Cause Analysis

The standalone test script (`test-fewshot-story.mjs`) produces excellent stories.
The pipeline (`pipeline.ts`) uses the **same system prompt** and **same model** but produces garbage.

The difference is the **user prompt**.

### Test script user prompt (works great):
```
כתוב סיפור חדש עבור מאיה, בת 5.
הנושא: פחד מהחושך.
היצור: פוף — עטלף קטן וביישן עם כנפיים גדולות מדי, שתמיד מתנגש בדברים ומתנצל.
הכוח של מאיה: אור רך שיוצא מהידיים.

דגשים:
- מטאפורה מרכזית: דבר אחד מוזר שקורה בחדר. לא ליטרלי.
- פוף מנסה לתקן בדרך מצחיקה ולא נכונה.
- מאיה פועלת ופותרת.
- טוויסט שמפתיע. רגע WOW. 2 רגעים מצחיקים אמיתיים.
- כל סצנה = רגע ויזואלי אחד. 60-90 מילים.
```

That's it. 10 lines. Clean. The model reads the EXAMPLE_STORY in the system prompt and knows what to do.

### Pipeline user prompt (produces garbage):
The pipeline adds **three poison layers** on top:

1. **`constraintBlock`** — injects `narrativeConstraint` from categoryBranching:
   > "Story is anchored in the real home environment (bedroom, hallway, window)..."
   
   This is **redundant** — the system prompt already says "הסביבה: חדר הילד/ה בלילה. אינטימי." 
   AND the EXAMPLE_STORY takes place in a bedroom. The constraint just doubles down on confinement and kills creativity.

2. **`brainContext`** — injects `brain.narrativeCore.centralMetaphor.metaphor`:
   > "רמז (אל תשתמש ליטרלית): [whatever brain said]"
   
   Even as a "hint", this anchors the model to the brain's metaphor. The brain stage was designed for the OLD pipeline and often produces literal/weak metaphors (e.g., "shadows stretching" for night fear).

3. **"מבנה חובה" (mandatory structure)** — dictates exact scene-by-scene beats:
   > "סצנות 1-2: הילד לבד... סצנה 3: היצור מופיע... סצנות 4-N: מנסה לעזור..."
   
   This **fights the few-shot approach**. The EXAMPLE_STORY already teaches the model what a good structure looks like. When you also dictate "companion MUST appear in scene 3", the model follows the rigid rules instead of the natural storytelling rhythm demonstrated by the example.

### Why the test works and the pipeline doesn't:
The test lets the example story teach. The pipeline overrides the example with prescriptive rules, constraints, and brain-generated content that the model tries to satisfy — resulting in a constrained, formulaic, flat output.

---

## The Fix

Replace `buildRawStoryPrompt()` with a clean prompt that matches the test script's approach. Keep only what the test script keeps: child details, topic, companion, superpower, and minimal guidance.

### File: `backend/providers/pipeline.ts`

### Replace the ENTIRE function `buildRawStoryPrompt` (lines ~1329-1378):

**Delete everything from:**
```ts
// PROMPT_ONLY: Prose rules below are generation guidance...
function buildRawStoryPrompt(
```

**Through the closing `}`**

**Replace with:**
```ts
// PROMPT_ONLY: Prose rules below are generation guidance and should not be interpreted as code-enforced validation.
function buildRawStoryPrompt(
  brain:     StoryBrain,
  outline:   PageOutline[],
  input:     StoryInput,
  pageCount: number,
): string {
  const childName = input.childName || 'הילד';
  const age = input.childAge ?? 5;
  const genderHe = (input.childGender === 'girl' || input.childGender === 'female') ? 'בת' : 'בן';

  const companion = input.companionForStory;
  const companionDesc = companion
    ? `${companion.name} — ${companion.tagline}. ${companion.narrativeHook}`
    : (brain.entity?.name ? `${brain.entity.name} — ${brain.entity.personality}` : 'יצור קטן ומצחיק');

  const companionName = companion?.name || brain.entity?.name || 'היצור';

  const topic = input.topicLabel || input.topic || brain.emotionalCore?.challenge || 'אתגר לילי';
  const superpower = input.childSuperpower || 'כוח דמיוני מיוחד';

  return `כתוב סיפור חדש עבור ${childName}, ${genderHe} ${age}.
הנושא: ${topic}.
היצור: ${companionDesc}.
הכוח של ${childName}: ${superpower}.

דגשים:
- בדיוק ${pageCount} סצנות. כל סצנה = רגע ויזואלי אחד שאפשר לצייר. 60-90 מילים.
- מטאפורה מרכזית: דבר אחד מוזר שקורה בחדר שמשקף את האתגר הפנימי של ${childName}. לא ליטרלי.
- ${companionName} מנסה לתקן את זה בדרך מצחיקה ולא נכונה.
- ${childName} פועל/ת ופותר/ת — הפתרון בא מפעולה של ${childName}, לא מהיצור.
- טוויסט שמפתיע. רגע WOW אחד. 2 רגעים מצחיקים אמיתיים.`;
}
```

### What was removed and WHY:

| Removed | Why |
|---------|-----|
| `constraintBlock` (narrativeConstraint) | Redundant with system prompt + example. Kills creativity. |
| `brainContext` (centralMetaphor) | Anchors model to weak brain-generated metaphor. Example story teaches better. |
| "מבנה חובה" (mandatory scene structure) | Fights the few-shot. Example story already demonstrates good structure. |
| "חובה: היצור חייב להופיע מסצנה 3" | Over-prescriptive. The "דגשים" naturally guide companion usage. |

### What was KEPT:
- Child name, age, gender
- Topic (from user input, not brain)
- Companion description (name + tagline + narrativeHook — this is rich enough)
- Superpower
- pageCount in the "דגשים" section
- Core creative guidance: metaphor, companion humor, child agency, twist, wow moment

---

## Important: Do NOT change these

- `buildProse3ASystem()` — the system prompt is correct and matches the test script
- `EXAMPLE_STORY` — do not touch
- `generateRawStory()` — the function wrapper, retry logic, JSON parsing are all fine
- `callLLM()` / `callLLMOnce()` — model handling is correct
- Brain stage / Outline stage — these still feed into Visual Bible and image generation
- Legacy pipeline path (the `else` branch) — unchanged

---

## Verification

After making the change:

1. Restart dev server
2. Generate a new book (Night Fear, any companion, 8 pages)
3. Check terminal logs for:
   - `[Pipeline][Prose-3A] userPrompt length=` — should be ~300-400 chars (was ~900+)
   - Scene count matching pageCount
4. Read the story text — verify:
   - Short punchy lines with line breaks (not flat paragraphs)
   - Companion doing funny things (not just mentioned once)
   - A real metaphor (not literal shadows = fear)
   - Humor, rhythm, personality
   - A twist/surprise
   - No morals or "and he learned that..."

---

## Files changed
- `backend/providers/pipeline.ts` — only `buildRawStoryPrompt()` function
