# Phase 3i — Story Quality Revolution

## Why This Phase Exists

The pipeline produces stories that read like **clinical descriptions of emotions with illustrations**.
Every page follows the same dead pattern: "Child feels X → thing happens → child feels Y."

A real children's book works completely differently. The founder wrote a reference story
("הענק שהלך לאיבוד") that demonstrates the target quality. This brief rewrites the prompt
architecture to produce stories at that level.

---

## The 5 Laws (derived from the reference story)

### Law 1: METAPHOR IS THE STORY
The challenge is NEVER addressed directly. The entire story IS a metaphor.
- Fear of loud noises → booms are footsteps of a lost giant who needs help
- Fear of dark → shadows are shy creatures who only come out when the light is off
- Anger → a volcano that powers the town but sometimes erupts too hard

The child never "overcomes fear." They encounter something that EMBODIES the challenge
in a transformed way, and their relationship with it changes.

### Law 2: SHOW THROUGH BODY, NEVER NAME EMOTIONS
Not a forbidden-word list. A completely different writing approach.
- WRONG: "יובלי הרגישה פחד" / "היא התמלאה אומץ" / "הוא חש חוסר ביטחון"
- WRONG (same thing with different words): "משהו בבטן שלה התהפך מפחד"
- RIGHT: "היא התקרבה צעד קטן. ואז עוד אחד." (the approach IS the courage)
- RIGHT: "הלב שלה דפק מהר. היא לחצה את השמיכה." (physical sensation, not label)
- RIGHT: "הוא עצם עיניים לשנייה. נשם. ואז המשיך, לאט יותר." (action sequence = processing)

The reader INFERS the emotion from what the character DOES. That's what makes it powerful.

### Law 3: RHYTHM AND BREATH
Hebrew children's prose needs musical rhythm. Short lines. Repetition. Pauses.
- "נשמע קול. בום... הם הסתכלו אחד על השני. ואז שוב— בום… בום…"
- "החלונות רעדו מעט."
- One-line paragraphs for impact.
- Dialogue broken into short exchanges, not speeches.
- Sound words woven naturally, not forced: "בום", "שששש", "טפ טפ טפ"

### Law 4: THE SCARY THING IS ACTUALLY SAD/LOST/CONFUSED
This is the therapeutic genius. The child doesn't defeat the scary thing.
They discover it's not what they thought. The giant isn't evil — he's lost.
The shadows aren't threatening — they're lonely. The loud noise isn't anger — it's calling for help.

This reframe is what actually helps children. Not "be brave" — but "what you fear
might need YOUR help."

### Law 5: FAMILY AS ECOSYSTEM (when present)
Each family member has a metaphorical role — not a job title.
- "אמא גל היא שומרת הלבבות — וכשהיא מחבקת, משהו בפנים נרגע, גם בלי מילים."
- "אבא גיא הוא קוסם הציורים — וכשקשה לראות פתרון, הוא מצייר אחד כזה… לאט."
They don't SOLVE the problem. They equip the child and believe in them.

---

## Implementation: What Changes in the Code

### File: `backend/providers/pipeline.ts`

---

### Change 1: Brain System Prompt — Add Metaphor Architecture

**Location:** `generateBrain()` system prompt (line ~839)

**Current problem:** The brain prompt asks for literal challenge → adventure mapping.
It produces: "fear of dark → child goes to dark place and learns dark isn't scary."

**New requirement:** The brain must produce a CENTRAL METAPHOR — an analogy that
embodies the challenge without naming it.

**ADD this new section** after the existing "CRITICAL REQUIREMENTS" block (before the
ADDITIONAL HARD RULES section), replacing rule 3 "WILD IMAGINATION IS MANDATORY":

```
3. CENTRAL METAPHOR (replaces "wild imagination")
   - Every story must be built around ONE central metaphor/analogy.
   - The metaphor embodies the child's challenge WITHOUT naming it directly.
   - The child encounters something that IS the challenge in transformed form.
   - Examples:
     * Fear of loud noises → booms that turn out to be a lost giant's footsteps. The giant is sad, not scary.
     * Fear of dark → shadows that are actually shy night-creatures who need a friend to come out.
     * Separation anxiety → a little cloud that got separated from its cloud-family and needs help floating back.
     * Anger/frustration → a friendly dragon whose fire keeps lighting things accidentally — it needs to learn to aim, not to stop.
     * Low confidence → a tiny seed that thinks it's too small to grow, but it just needs the right song.
   - The metaphor must be CONCRETE and VISUAL — a character, creature, or situation the child interacts with.
   - The resolution comes from the child's RELATIONSHIP with the metaphor changing — not from defeating anything.
   - The scary/hard thing turns out to need the child's help, understanding, or friendship.
   - NEVER write a story where the child "faces their fear directly" or "learns to be brave."
     Instead: the child helps something, befriends something, or discovers something isn't what it seemed.
```

**ADD to the JSON schema** a new required field in `narrativeCore`:

```json
"centralMetaphor": {
  "metaphor": "what the challenge becomes in story form (concrete, visual, character-based)",
  "why_it_works": "how this metaphor mirrors the real challenge without naming it",
  "reframe": "what the child discovers about the metaphor that changes their relationship to it"
}
```

**MODIFY** the existing `entity` description to align:

The entity should BE or be deeply connected to the central metaphor. Not a random magical helper —
the entity IS the transformed version of the challenge. The lost giant. The shy shadow-creature.
The separated cloud.

Add to entity JSON spec:
```json
"metaphor_connection": "how this entity embodies or connects to the central metaphor"
```

---

### Change 2: Brain System Prompt — Remove "Epic Adventure" Framing

**Location:** `generateBrain()` system prompt, line ~839-841

**REPLACE:**
```
You are a creator of epic, fun, imaginative children's adventures.
This is NOT a gentle therapeutic exercise.
If the result is calm, soft, passive, or "just emotional" — it fails.
```

**WITH:**
```
You are a master Hebrew children's story author.
Your stories work through metaphor, warmth, and surprise — never through direct lessons or forced bravery.
A great children's story makes the child FEEL something without ever naming the feeling.
If the result names emotions directly, explains feelings, or teaches a lesson — it fails.
If the result has no central metaphor that embodies the challenge — it fails.
```

**ALSO REMOVE** these rules that contradict the new approach:
- Rule 1 bullet "The child must save someone or something meaningful" → REPLACE with "The child must form a meaningful connection with something/someone that changes how they see the challenge"
- Rule 5 "ENTITY MUST DRIVE ACTION" → SOFTEN to "ENTITY MUST BE INTERESTING" — the entity should have personality, quirks, needs. It doesn't need to physically drag the child. It can be vulnerable, funny, lost, confused.
- Rule 6 "REAL FAILURE BEFORE SUCCESS" → KEEP but reframe: the failure isn't about power-mastery, it's about misunderstanding. The child first misreads the situation (thinks the giant is attacking, tries to fight) before understanding (realizes the giant is lost, decides to help).
- Rule 7 "FINAL CLIMAX MUST BE ACTION" → REPLACE with "FINAL CLIMAX MUST BE A CHOICE" — the child makes a decision that shows growth. It can be physical (approaching something scary) or relational (offering help, extending trust). But it must be SHOWN through action, not explained.

---

### Change 3: Prose 3A System Prompt — Hebrew Voice DNA

**Location:** `buildProse3ASystem()` (line ~1077)

**REPLACE the entire system prompt** with a new one that teaches the model HOW to write
great Hebrew children's prose:

```
You are writing a Hebrew children's story for read-aloud.
You write like the best Israeli children's book authors — warm, rhythmic, surprising.

═══ VOICE DNA ═══

RHYTHM:
- Short sentences. Then shorter ones. Then one word.
- Vary sentence length like music: long, short, short, medium, very short.
- One-line paragraphs for emotional beats.
- Repetition for buildup: "בום... ואז שוב— בום… בום…"
- Natural sound woven in: "בום", "שששש", "טפ טפ טפ", "פוף!", "וווש!"

SHOW, NEVER TELL:
- You must NEVER name an emotion. Not once. Not in any form.
- FORBIDDEN: "הרגיש/ה", "חש/ה", "ידע/ה", "נרגע/ה", "פחד", "אומץ", "ביטחון", "שמחה",
  "עצב", "כעס", "התרגש/ה", "חוסר ביטחון", "התמלא/ה", "נשמה עמוק", "הכל בסדר"
- FORBIDDEN: Any sentence that EXPLAINS what a character feels or understands.
- INSTEAD: Show through BODY — "הלב דפק מהר", "הידיים רעדו קצת", "הבטן התכווצה"
- INSTEAD: Show through ACTION — "התקרבה צעד קטן. ואז עוד אחד." (approach = courage)
- INSTEAD: Show through DIALOGUE — "אולי..." הוא אמר לאט. (hesitation in speech = uncertainty)
- INSTEAD: Show through ENVIRONMENT — "החלונות רעדו" (world mirrors inner state)
- The reader must INFER the emotion. That's what makes it powerful.

DIALOGUE:
- Children speak in short, real sentences: "מה זה היה?!", "ביחד?", "אולי..."
- Not speeches. Not explanations. Not therapy language.
- Dialogue should feel overheard, not written.
- Adults speak gently and metaphorically, never lecturing.

METAPHOR OVER LITERALISM:
- The story IS a metaphor. Never break the metaphor to explain the "real meaning."
- The scary thing is not defeated. It's understood, befriended, or helped.
- The ending is a NEW RELATIONSHIP with what was scary — shown through one small action.
- No moral. No lesson. No "and they learned that..." No "הכל יסתדר."
- The last image should feel like a warm exhale. A quiet moment of connection.

LANGUAGE (Hebrew-specific):
- Child-friendly spoken Hebrew. Words children hear at home.
- Short, warm sentences. Natural read-aloud rhythm.
- Prefer concrete physical words over abstract: "רץ", "קפץ", "לחש", "נגע", "הריח"
- Avoid formal/literary: "מגחך"→"צוחק", "כעת"→"עכשיו", "התבונן"→"הסתכל"
- 2-4 sound words per story, placed naturally
- Age-appropriate vocabulary for a {age}-year-old

PACING:
- Scenes 1-2: Slow, grounded, sensory. Build the world with small details.
- Scenes 3-5: Rising energy. New elements. Things go wrong in interesting ways.
- Scenes 6-7: Peak tension — but through SITUATION, not emotion-labeling.
- Scenes 8-9: The shift. The child makes a choice. The metaphor transforms.
- Scene 10: Quiet resolution. One image. One small action. Warmth.

WHAT MAKES IT FAIL:
- Naming any emotion → FAIL
- Explaining what happened or what it means → FAIL
- The child "decides to be brave" or "overcomes their fear" → FAIL
- Any adult lecturing or explaining → FAIL
- A moral or lesson at the end → FAIL
- Generic fantasy (random magic) without metaphor → FAIL
- Therapy language in any form → FAIL
```

---

### Change 4: Prose 3A User Prompt — Cut the Mechanical Rules

**Location:** `buildRawStoryPrompt()` (line ~1150)

The current user prompt has mechanical rules that fight the new voice:
- "1. One clear physical action by the child" per scene — too formulaic
- "Superpower must misbehave before mastery" — too literal for metaphor stories
- The entire DRAMATIC ARC block is too rigid

**REPLACE the DRAMATIC ARC block** (lines ~1115-1121) with:

```
STORY SHAPE (flexible — follow the feeling, not a formula):
- Begin grounded. Small sensory details. The child in their world.
- Something arrives or changes. Curiosity, not fear.
- The child engages with the new thing. Misunderstands it at first.
- Things get complicated. The companion adds humor/chaos.
- A moment of quiet — the child sees the situation differently.
- The child makes a choice based on this new understanding.
- The world shifts. Not because of power — because of connection.
- End with one small, warm image. No explanation needed.
```

**REPLACE the "For EACH scene you must include ALL of the following" checklist** with:

```
Each scene needs LIFE — but not a checklist. Vary what carries each scene:
- Some scenes live in action (running, jumping, reaching)
- Some scenes live in dialogue (a whispered conversation, a funny exchange)
- Some scenes live in sensory detail (what it smells like, what the light does)
- Some scenes live in silence (a pause, a look, a small gesture)
Never write two consecutive scenes with the same energy. Alternate.
```

**KEEP** the HUMOR RULES section but soften:
```
HUMOR (required but organic):
- The companion should be genuinely funny — clumsy, confused, dramatic, surprised.
- At least 2 moments should make a child laugh.
- Humor comes from CHARACTER, not narration. Show the funny thing happening.
- Funny moments can happen even in tense scenes — that's what makes great stories.
```

**MODIFY** the FORBIDDEN block (lines ~1297-1303):

Keep the forbidden words but ADD the deeper principle:

```
ABSOLUTE PROHIBITION — EMOTION NAMING:
These words/phrases may NEVER appear in the story in ANY form:
"הרגישה" / "הרגיש" / "ידעה" / "ידע" / "חשה" / "חש"
"נשמה עמוק" / "נרגעה" / "נרגע" / "ידעה שהכל בסדר"
"הכל יסתדר" / "העולם חזר" / "הכל יהיה בסדר"
"פחד" / "אומץ" / "ביטחון" / "שמחה" / "עצב" / "כעס" / "התרגשות"
"בחוסר ביטחון" / "חש תחושת" / "התמלא בתחושת" / "החליטה להיות אמיצה"

Also forbidden: ANY sentence whose purpose is to NAME, LABEL, or EXPLAIN an emotion.
This includes creative rewording like "משהו חם התפשט בחזה שלה" if followed by
"היא ידעה שזה אומץ." The rewording is fine. The explanation kills it.

THE RULE: If you can delete a sentence and the reader still knows how the character
feels from their ACTIONS and the SITUATION — delete it. That's always better.
```

---

### Change 5: Visual Bible — Fix Character Consistency

**Location:** This is NOT a prompt issue — it's a visual pipeline issue.

The character description in `heroVisual` and `entityVisual` from the brain JSON
gets diluted as it passes through composition → shots → image generation.

**Diagnosis from the book screenshots:**
- Yubli changes hair length, color, clothing, and face style every page
- The companion (bat Lili) changes size and proportions every page
- Page 2 has a second girl who shouldn't exist
- Page 4 has a dog that isn't the companion
- Page 8 breaks the NIGHT_FEAR room constraint

**Fix:** In `buildImagePrompt()` or the equivalent shot-to-prompt function,
the character visual description must be PREPENDED as a hard lock at the
start of every image prompt — not just mentioned in passing.

Add a CHARACTER CONSISTENCY LOCK at the top of every image prompt:
```
LOCKED CHARACTER — MUST MATCH EXACTLY ON EVERY PAGE:
[child]: {heroVisual from brain — full description}
[companion]: {entityVisual from brain — full description}
DO NOT add, remove, or change any character. Only these characters appear.
```

**Also:** The NIGHT_FEAR narrative constraint is being ignored in image generation.
Page 8 shows a forest. The constraint says "anchored in real home environment."
The narrative constraint must flow into the image prompts too, not just the story text.

---

## Summary of Changes

| # | What | Where | Type |
|---|------|-------|------|
| 1 | Add central metaphor to brain | generateBrain() system prompt | Prompt rewrite |
| 2 | Remove "epic adventure" framing, add metaphor-first framing | generateBrain() system prompt opening | Prompt rewrite |
| 3 | New Hebrew Voice DNA system prompt | buildProse3ASystem() | Full replacement |
| 4 | Soften mechanical rules, expand forbidden list | buildRawStoryPrompt() | Prompt edit |
| 5 | Character consistency lock in image prompts | buildImagePrompt() / shot functions | Prompt addition |

## What NOT to Change

- The pipeline stages themselves (Brain → Outline → Prose → Images) — keep the architecture
- The JSON schemas for Brain output — add fields, don't remove existing ones
- The categoryBranching system — it works, just needs the new metaphor layer on top
- The NIGHT_FEAR narrativeConstraint text — it's good, just needs to reach image prompts

## Testing

After implementation, generate a new NIGHT_FEAR story and check:
1. Does the story have a central metaphor? (not literal "scared of dark → goes to dark place")
2. Are emotions shown through action, never named?
3. Does the Hebrew have rhythm? Short sentences, pauses, repetition?
4. Is the companion consistent across all pages visually?
5. Does the child's appearance stay locked?
6. Does every page stay inside the home (NIGHT_FEAR constraint)?
7. Is there humor? Does it come from character, not narration?
8. Does the ending show change through one small action, no explanation?

## Priority

This is the single highest-impact change remaining. Without better stories,
nothing else matters. Ship this before any UX work.
