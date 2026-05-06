# Phase 4a — Few-Shot Story Generation with GPT-5.3

## Context

We tested 3 iterations of a radically simplified story generation approach:
- **Iteration 1** (GPT-4o, example + 100-word prompt): Flat, no rhythm, 292 words. Failed.
- **Iteration 2** (GPT-4o, example + forbidden words + guidance): Better (548 words) but no voice.
- **Iteration 3** (GPT-5.3, example + rhythm BAD/GOOD + forbidden words): **Breakthrough.** 
  Zero forbidden words, 77% short punchy lines, real metaphor, real humor, real ending.

GPT-5.3 with few-shot + focused guidance is the winning approach.

## What Changes

### 1. `callLLMOnce()` — Support GPT-5.3 API differences

**File:** `backend/providers/pipeline.ts` line ~524

GPT-5.3 requires two API changes:
- `max_completion_tokens` instead of `max_tokens`
- `temperature` must be omitted (only supports default value of 1)

**Change the OpenAI branch** to detect the model and adjust:

```typescript
const model = process.env.STORY_MODEL || 'gpt-5.3-chat-latest';
const body: Record<string, unknown> = {
  model,
  messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
};

// GPT-5.3+ uses max_completion_tokens, older models use max_tokens
if (model.startsWith('gpt-5.')) {
  body.max_completion_tokens = maxTokens;
  // GPT-5.3 only supports temperature=1 (default), so omit it
} else {
  body.max_tokens = maxTokens;
  body.temperature = temperature;
}

if (jsonMode) body.response_format = { type: 'json_object' };
```

**Also update the default model** from `'gpt-4o'` to `'gpt-5.3-chat-latest'`:
```typescript
const model = process.env.STORY_MODEL || 'gpt-5.3-chat-latest';
```

---

### 2. Replace `buildProse3ASystem()` — New few-shot system prompt

**File:** `backend/providers/pipeline.ts` line ~1107

**REPLACE the entire `buildProse3ASystem()` function** with the new few-shot approach.

The new function has three parts:
1. The example story (hardcoded constant)
2. Analysis of why the example works (rhythm, metaphor, humor, ending)
3. Hard rules (forbidden words, length, format)

```typescript
// ── Reference story for few-shot learning ──────────────────────────────────
const EXAMPLE_STORY = `היו היה פעם, בחדר שלא נראה מיוחד בכלל…
אבל אם היית מקשיב טוב בלילה— היית שומע אותו מתלונן.
לא בקול רם. לא "איי איי איי".
יותר כזה— קירקוש קטן, פיהוק של מגירה, ושמיכה שלוחשת:
"אוףףף… שוב אותו לילה…"

יובל שמעה את זה ראשונה.
היא הרימה גבה אחת. ואז את השנייה.
"אוקיי," היא לחשה לעצמה, "זה חדש."

המנורה הבהבה. לא כי היא התקלקלה—
כי היא ניסתה להגיד משהו.
השטיח התקפל קצת בפינה, כאילו הוא מתכווץ.
והכרית… נפלה מהמיטה.
לא "נפלה".
קפצה.

"מה קורה פה?" יובל לחשה.
ואז—
מתחת למיטה—
נשמע צחקוק.
קטן.
חשוד.

יובל ירדה מהמיטה לאט. לא כי היא פחדה—
כי היא רצתה לתפוס אותו על חם.
היא התכופפה…
והציצה.

ושם—
ישב יצור קטן, עגול, קצת פרוותי, עם אוזניים גדולות מדי—
ולובש פיג'מה.
הוא החזיק ביד… בורג.

"אהה!" הוא אמר בשמחה. "מצאתי אחד!"
יובל מצמצה.
"למה אתה לוקח בורג מהמיטה שלי?"

היצור עצר. חשב.
ואז אמר:
"כי היא מתפרקת."

יובל הביטה במיטה. המיטה הביטה בה בחזרה. (כן, זה היה לילה כזה.)

"מה זאת אומרת מתפרקת?"
היצור נאנח.
"החדר שלך מאבד צורה," הוא אמר, כאילו זה הדבר הכי רגיל בעולם.
"זה קורה לפעמים. כשדברים לא יושבים במקום."

"אבל הכל יושב במקום," יובל אמרה.
היצור הביט בה.
"בטוחה?"

יובל שתקה רגע.
היא חשבה על היום שלה. על כל הדברים שלא ממש הסתדרו. על מחשבות שקפצו לה בראש. על הרגשות שהתבלבלו לה קצת בבטן.
"…אולי לא בדיוק," היא הודתה.

היצור הנהן.
"כן. ככה זה מתחיל. קודם קצת בפנים… ואז גם בחוץ."

באותו רגע—
המגירה נפתחה לבד.
ואז עוד אחת.
ואז כולן.

"אה לא לא לא לא," היצור קם בבהלה. "זה נהיה בלגן אמיתי."
הוא התחיל לרוץ מצד לצד, אוסף ברגים, מסובב כפתורים, מנסה לעצור את החדר—
אבל כלום לא עבד.

השטיח התגלגל. הכיסא הסתובב. המנורה התחילה לשיר (שיר לא משהו).

"זה לא עובד!" הוא צעק. "זה אף פעם לא עובד לבד!"

יובל עמדה באמצע כל זה.
והלב שלה… התחיל לדפוק מהר.

אבל אז—
היא עצרה.
לקחה נשימה.
עוד אחת.
ושמה יד על הלב שלה.

"רגע," היא אמרה.

היצור עצר. גם המנורה הפסיקה לשיר (למזל כולם).

"מה את עושה?" הוא שאל.
יובל לא ענתה מיד.
היא פשוט נשמה.
לאט.
ועוד פעם.

משהו בתוכה התחיל להירגע. והמחשבות— שהיו מקופלות ומבולבלות— התחילו להסתדר קצת.

ואז היא פתחה עיניים.
"זה לא הבורג," היא אמרה. "זה אני."

היצור מצמץ.
"…מה?"

"אני צריכה לסדר את זה מבפנים," היא אמרה, כאילו זה ברור.
הוא גירד באוזן.
"אוקיי… לא ניסיתי את זה אף פעם."

יובל חייכה קצת.
"אז בוא ננסה."

היא לקחה עוד נשימה. דמיינה את המחשבות שלה מסתדרות. אחת ליד השנייה.

ואז—
המגירה נסגרה.
הכיסא עצר.
השטיח נפרש חזרה.
המנורה— הפכה להיות סתם מנורה.

היצור קפא.
"איך עשית את זה?!"
יובל משכה בכתפיים.
"נשמתי."

הוא הביט בה בהערצה.
"זה… הרבה יותר קל מברגים."
"וגם פחות מתגלגלים מתחת למיטה," היא הוסיפה.

היצור צחק.
צחוק אמיתי הפעם.

"טוב," הוא אמר, "אז נראה לי שאני יכול ללכת."
"לאן?" יובל שאלה.
"לעוד חדרים," הוא אמר. "יש הרבה מקומות שמתפרקים בלילה."

הוא התחיל לזחול חזרה מתחת למיטה, אבל אז עצר.
הוציא משהו קטן מהכיס.
בורג.
"למקרה שתצטרכי," הוא קרץ.
"ליתר ביטחון."

יובל לקחה אותו. "תודה."
הוא חייך. ונעלם.

החדר היה שוב שקט.
הכל במקום.

יובל נשכבה במיטה. הסתכלה בתקרה.
נשמה.
והפעם—
הכל הרגיש… יציב.
לא מושלם. לא תמיד מסודר.
אבל שלה.

ולפני שנרדמה—
היא לחשה לעצמה:
"אני יודעת לסדר דברים."
גם אם לפעמים—
הם מתפרקים קצת קודם.`;

function buildProse3ASystem(childAge: number | null | undefined): string {
  const age = childAge ?? 5;
  return `אתה סופר ילדים ישראלי. הנה דוגמה לסיפור ברמה שאתה חייב לכתוב:

${EXAMPLE_STORY}

═══ למה הסיפור הזה עובד — חייב לעשות אותו דבר ═══

קצב (הכי חשוב!):
רע: "מאיה ראתה צל גדול על הקיר וקצת נבהלה אך אז שמעה רעש מצחיק מתחת למיטה."
טוב:
"ואז—
מתחת למיטה—
נשמע צחקוק.
קטן.
חשוד."

הבדל קריטי: שורות קצרות. ואז קצרות יותר. ואז מילה אחת. שורה חדשה = פאוזה בקריאה בקול. כך כותבים סיפור ילדים שנשמע יפה בקריאה בקול.

עוד דוגמה לקצב:
"לא 'נפלה'.
קפצה."

"לא כי היא פחדה—
כי היא רצתה לתפוס אותו על חם."

קול מספר: המספר הוא חבר של הילד. יש לו הערות סוגריים מצחיקות "(כן, זה היה לילה כזה.)", שובר ציפיות, מדבר ישירות.

מטאפורה: האתגר הופך לדבר פיזי בחדר. לא ליטרלי (חושך=מפלצת) אלא מטאפורי (חדר מתפרק = ילדה שלא מסודרת מבפנים). הטוויסט: הפתרון הוא לא לתקן בחוץ אלא לגלות שזה משקף משהו פנימי.

הומור מאופיין: היצור מנסה לפתור בדרך לא נכונה ברצינות מלאה (ברגים!). הומור שנובע מהאישיות, לא בדיחות.

סיום: אין מוסר. אין "והוא למד ש...". אין "ומאז הכל השתנה". פשוט רגע שקט אחד, חם, ומשפט אחד שקט שהילד לוקח למיטה.

═══ חוקים קשיחים ═══

אורך: כל סצנה חייבת להיות 60-90 מילים בעברית. פחות מ-60 = נכשלת. סה"כ 10 סצנות.

עיצוב: השתמש בשורות קצרות ושבירות שורה כמו בדוגמה. לא פסקאות צפופות — שורות נפרדות ליצירת קצב. כל שורה = נשימה בקריאה בקול.

אסור בהחלט — המילים האלה לא יופיעו בסיפור בשום צורה:
"הרגישה/הרגיש", "חשה/חש", "ידעה/ידע", "פחד", "אומץ", "ביטחון", "שמחה", "עצב",
"נרגעה", "נשמה עמוק" (כתיאור רגשי), "הכל בסדר", "הכל יסתדר",
"החליטה להיות אמיצה", "התגברה על", "למדה ש", "הבינה ש"

במקום לכתוב מה הדמות מרגישה — תראה מה היא עושה. הקורא יבין לבד.

הסביבה: חדר הילד/ה בלילה. אינטימי. לא טיסות לעולמות אחרים.

הילד/ה פועל/ת: הילד/ה חייב/ת לעשות דברים — לא רק לצפות. הפתרון חייב לבוא מפעולה של הילד/ה, לא מהיצור ולא ממבוגר.

ויזואליות: כל סצנה = רגע ויזואלי אחד ברור שאפשר לצייר כאיור. לא שני אירועים באותו משפט. תחשוב: מה הילד רואה בתמונה הזו?

שפה: עברית מדוברת לילד בן ${age}. מילים פשוטות שילד שומע בבית.

פורמט: JSON בלבד: { "title": "...", "scenes": [{ "page": 1, "text": "..." }, ...] }`;
}
```

---

### 3. Replace `buildRawStoryPrompt()` — Short focused user prompt

**File:** `backend/providers/pipeline.ts` line ~1177

**REPLACE the entire `buildRawStoryPrompt()` function.** The current one is ~180 lines of rules. The new one is ~30 lines.

```typescript
function buildRawStoryPrompt(
  brain:     StoryBrain,
  outline:   PageOutline[],
  input:     StoryInput,
  pageCount: number,
): string {
  const childName = input.childName || 'הילד';
  const age = input.childAge ?? 5;
  const genderHe = (input.childGender === 'girl' || input.childGender === 'female') ? 'בת' : 'בן';
  const pronounHe = (input.childGender === 'girl' || input.childGender === 'female') ? 'היא' : 'הוא';

  // Companion info
  const companion = input.companionForStory;
  const companionDesc = companion
    ? `${companion.name} — ${companion.tagline}. ${companion.narrativeHook}`
    : (brain.entity?.name ? `${brain.entity.name} — ${brain.entity.personality}` : 'יצור קטן ומצחיק');

  // Topic / challenge
  const topic = input.topicLabel || input.topic || brain.emotionalCore?.challenge || 'אתגר לילי';

  // Superpower
  const superpower = input.childSuperpower || 'כוח דמיוני מיוחד';

  // Category narrative constraint (e.g. NIGHT_FEAR stays in the room)
  const narrativeConstraint = getCategoryBranching(input.challengeCategory ?? null)?.treatmentStrategy
    .narrativeConstraint;
  const constraintBlock = narrativeConstraint
    ? `\nהגבלה: ${narrativeConstraint}`
    : '';

  // Brain context (compact — just the emotional core and metaphor if available)
  const brainContext = brain.narrativeCore?.centralMetaphor
    ? `\nמטאפורה מרכזית מהתכנון: ${brain.narrativeCore.centralMetaphor.metaphor}`
    : '';

  return `כתוב סיפור חדש עבור ${childName}, ${genderHe} ${age}.
הנושא: ${topic}.
היצור: ${companionDesc}.
הכוח של ${childName}: ${superpower}.
${brainContext}${constraintBlock}

דגשים:
- מטאפורה מרכזית: דבר אחד מוזר שקורה בחדר שמשקף את האתגר הפנימי של ${childName}. לא ליטרלי.
- היצור מנסה לתקן את זה בדרך מצחיקה ולא נכונה.
- ${childName} פועל/ת ופותר/ת — הפתרון בא מפעולה של ${childName}, לא מהיצור.
- טוויסט שמפתיע. רגע WOW אחד. 2 רגעים מצחיקים אמיתיים.
- כל סצנה = רגע ויזואלי אחד שאפשר לצייר. 60-90 מילים.`;
}
```

---

### 4. Update `generateRawStory()` — Remove retry-for-length hack

**File:** `backend/providers/pipeline.ts` line ~1359

The current function has a retry loop that re-generates if the story is too short. With GPT-5.3 and the new prompt, this is less needed but keep a simplified version.

**Key changes:**
- Remove the temperature stepping (GPT-5.3 doesn't support custom temperature)
- Keep 1 retry for short stories but simplify the logic
- The system prompt no longer needs the narrative constraint appended separately (it's in the user prompt now)

```typescript
export async function generateRawStory(
  brain:     StoryBrain,
  outline:   PageOutline[],
  input:     StoryInput,
  pageCount: number,
): Promise<{ rawStory: string; tokens: number }> {
  const MIN_WORDS    = 400;  // lowered — GPT-5.3 with short lines has fewer words per scene
  const MAX_ATTEMPTS = 2;

  const userPrompt = buildRawStoryPrompt(brain, outline, input, pageCount);
  const systemPrompt = buildProse3ASystem(input.childAge);

  let bestText      = '';
  let bestWordCount = 0;
  let totalTokens   = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt = attempt === 1
      ? userPrompt
      : userPrompt + '\n\nהסיפור הקודם היה קצר מדי. כתוב סצנות ארוכות ומפורטות יותר — 70-90 מילים לכל סצנה.';

    const result = await callLLM(
      systemPrompt, prompt,
      6000, 1.0, `Prose-3A(${attempt})`,
      true,
    );

    totalTokens += result.tokens;

    let text = '';
    try {
      const parsed = parseJSON<{ scenes?: Array<{ page: number; text: string }> }>(result.text, `Prose-3A(${attempt})`);
      const scenes = parsed.scenes ?? (Array.isArray(parsed) ? parsed as Array<{ page: number; text: string }> : []);
      text = scenes.map(s => s.text ?? '').join('\n\n').trim();
      console.log(`[Pipeline][Prose-3A] Attempt ${attempt}: ${scenes.length} scenes parsed`);
    } catch {
      console.warn(`[Pipeline][Prose-3A] Attempt ${attempt}: JSON parse failed, skipping`);
      continue;
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    console.log(`[Pipeline][Prose-3A] Attempt ${attempt}: ${wordCount} words`);

    if (wordCount > bestWordCount) {
      bestText = text;
      bestWordCount = wordCount;
    }
    if (wordCount >= MIN_WORDS) break;
  }

  if (!bestText) throw new Error('[Pipeline][Prose-3A] All attempts failed');
  return { rawStory: bestText, tokens: totalTokens };
}
```

---

### 5. Remove Stage 3B/3C/3D — Simplify prose pipeline

**File:** `backend/providers/pipeline.ts` line ~1888

The current pipeline has 4 sub-stages:
- 3A: Write raw story
- 3B: Structure into pages
- 3C: Hebrew polish
- 3D: Enforce minimum length

With GPT-5.3 and the few-shot approach:
- **3A already outputs structured JSON** with page numbers → 3B is unnecessary
- **The few-shot example teaches voice/rhythm** → 3C polish is unnecessary (and risks destroying the rhythm)
- **3D minimum length** → keep as safety net but adjust threshold

**REPLACE `generateProse()`** with a simpler version:

```typescript
async function generateProse(
  brain:     StoryBrain,
  outline:   PageOutline[],
  input:     StoryInput,
  pageCount: number,
): Promise<{ prose: PageProse[]; rawStory: string; tokens: number }> {
  // 3A — few-shot story generation (outputs structured scenes)
  console.log('[Pipeline][Prose-3A] Few-shot story generation...');
  const { rawStory, tokens: t3a } = await generateRawStory(brain, outline, input, pageCount);

  // Parse scenes from raw story
  // rawStory is already the concatenated text, but we need PageProse[]
  // Re-parse from the raw story to get individual page texts
  // Since generateRawStory joins with \n\n, split back:
  const paragraphs = rawStory.split('\n\n').filter(p => p.trim());
  const prose: PageProse[] = paragraphs.map((text, i) => ({
    pageNumber: i + 1,
    text: text.trim(),
  }));

  // Pad or trim to match pageCount
  while (prose.length < pageCount) {
    prose.push({ pageNumber: prose.length + 1, text: prose[prose.length - 1]?.text || '' });
  }
  if (prose.length > pageCount) {
    prose.length = pageCount;
  }

  // 3D — code-level length repair (only patches pages below minimum)
  console.log('[Pipeline][Prose-3D] Enforcing minimum page length...');
  const { prose: finalProse, tokens: t3d } = await enforcePageMinimumLength(prose, pageCount);

  return { prose: finalProse, rawStory, tokens: t3a + t3d };
}
```

**IMPORTANT:** We still need the `PageProse` type and `enforcePageMinimumLength()`. Don't remove those. Just remove the calls to `structureStoryToPages()` and `polishStoryPages()`.

**ALTERNATIVE (safer):** Instead of removing 3B/3C entirely, you can keep them but add a feature flag:

```typescript
const USE_FEWSHOT = true; // TODO: move to env var

async function generateProse(...) {
  const { rawStory, tokens: t3a } = await generateRawStory(brain, outline, input, pageCount);

  if (USE_FEWSHOT) {
    // Parse directly from 3A output (already structured)
    const paragraphs = rawStory.split('\n\n').filter(p => p.trim());
    const prose = paragraphs.map((text, i) => ({
      pageNumber: i + 1,
      text: text.trim(),
    }));
    // ... pad/trim to pageCount ...
    const { prose: final, tokens: t3d } = await enforcePageMinimumLength(prose, pageCount);
    return { prose: final, rawStory, tokens: t3a + t3d };
  }

  // Legacy path (3B → 3C → 3D)
  const { prose: prose3b, tokens: t3b } = await structureStoryToPages(rawStory, outline, pageCount);
  const { prose: prose3c, tokens: t3c } = await polishStoryPages(prose3b, pageCount);
  const { prose, tokens: t3d } = await enforcePageMinimumLength(prose3c, pageCount);
  return { prose, rawStory, tokens: t3a + t3b + t3c + t3d };
}
```

Use the feature flag approach — safer for rollback.

---

### 6. Update `.env` — Default to GPT-5.3

**File:** `.env`

Change (or add):
```
STORY_MODEL="gpt-5.3-chat-latest"
```

---

## What NOT to Change

- **Brain stage** (Stage 1) — keep as is. It still generates heroVisual, entityVisual, narrativeCore, etc.
- **Outline stage** (Stage 2) — keep as is. It produces the page beats.
- **Visual Bible** (Stage 4A) — keep as is.
- **Composition/Shots/Image generation** (Stage 4+) — keep as is.
- **Character consistency lock in image prompts** — keep as is (from Phase 3i).
- **`enforcePageMinimumLength()`** — keep as safety net.

## Summary of Changes

| # | What | Where | Type |
|---|------|-------|------|
| 1 | Support GPT-5.3 API params | `callLLMOnce()` | Code change |
| 2 | New few-shot system prompt | `buildProse3ASystem()` | Full replacement |
| 3 | Short focused user prompt | `buildRawStoryPrompt()` | Full replacement |
| 4 | Simplified retry logic | `generateRawStory()` | Rewrite |
| 5 | Skip 3B/3C with feature flag | `generateProse()` | Add flag + new path |
| 6 | Default model to GPT-5.3 | `.env` | Config change |

## Testing

After implementation:
1. Set `STORY_MODEL="gpt-5.3-chat-latest"` in `.env`
2. Generate a NIGHT_FEAR story through the wizard
3. Check:
   - Does the story have the punchy rhythm? (short lines, pauses, one-word lines)
   - Zero forbidden emotion words?
   - Real metaphor (not literal)?
   - Humor from character personality?
   - No moral/lesson at the end?
   - Does the reader display it properly? (line breaks preserved)

## Cost Impact

| Model | Input $/1M | Output $/1M | Cost/story |
|-------|-----------|------------|------------|
| GPT-4o (current) | $2.50 | $10.00 | ~$0.02 |
| GPT-5.3 (new) | $1.75 | $14.00 | ~$0.03 |

Negligible cost difference. Massive quality improvement.

## Risk & Rollback

- Feature flag `USE_FEWSHOT` allows instant rollback to the old 3A→3B→3C→3D pipeline
- If GPT-5.3 is unavailable, change `STORY_MODEL` back to `gpt-4o` in `.env`
- The old prompt functions can be kept commented out for reference
