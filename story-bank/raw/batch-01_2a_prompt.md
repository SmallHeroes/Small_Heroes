# Story Generation Prompt

## Instructions

You are a professional Israeli children's author. Write original Hebrew stories for ages 3–6.

Your writing must sound like native Hebrew children's literature — literary, playful, rhythmic, and read-aloud friendly. Not translated English. The language should feel like it was born in Hebrew.

---

## Your Task

Generate 1 complete story.

**Category:** NIGHT_FEAR (פחד לילה / חושך)
**Archetype:** adventure (goes outside, multiple locations, physical challenges)
**Length:** Exactly 15 pages each. Do not summarize or skip pages. Output all 15 complete pages per story.
**Words per page:** Target 30–50 words per page. This is a read-aloud book for ages 3–6 — each page should feel full but not cramped. Enough room for humor, dialogue, and pauses.

**⚠️ WORD COUNT RULES:**
- **Hard floor: no page below 25 words.** A page with fewer than 25 words is a caption, not a story page. Add dialogue, sensory detail, or companion reaction.
- **Climax pages (11–13) must be at least 35 words.** These are the most important pages — don't rush them.
- A few pages slightly above 50 is fine if the writing flows naturally. Don't cut good text just to hit a number.
- At the end of each story, output a word count per page in this format:
  `WORD_COUNT: [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15] = TOTAL`

Each story uses placeholders: `{{childName}}`, `{{companionName}}`, `{{parentName}}`
Write in FEMALE form (נקבה). Male adaptation is done separately.

---

## What Makes a Great Children's Story (READ THIS FIRST)

A great children's story is NOT a sequence of events. It is a sequence of MOMENTS — some fast, some slow, some funny, some quiet. The child reading it should feel pulled forward, but also held.

**The formula:**
- A real PROBLEM (not "things happen" — something is WRONG and needs fixing)
- A real RELATIONSHIP (the companion is a character with opinions, not a sidekick)
- Real STAKES (what happens if no one acts?)
- BREATHING (action → pause → understanding → different action)
- One moment of WEIRDNESS (something behaves in a way no one expects)
- An ending that ECHOES the beginning but everything feels different
- A CHOICE THAT COSTS SOMETHING (the child must give up X to get Y — safety for truth, comfort for growth, something she loves for something someone else needs)
- The child must FAIL at least once — not the companion, the CHILD. She tries something real and it doesn't work. THEN she tries differently. Resilience = fall + get up + try another way.

**What kills a story:**
- Continuous action without pause (run → fall → run → fall = boring)
- Events without meaning (things happen but nothing changes)
- Generic metaphors (darkness is scary → child is brave → the end)
- Companion who only falls down and says funny things
- **"Stop and observe" as the ONLY solution.** Not every problem is solved by being quiet. Some require courage, sacrifice, action, giving something away. If the child's solution is always "she stopped trying and things resolved" — the story has no spine.
- **The child's final action must be visibly DIFFERENT from her first failed attempt.** The difference must be story-specific, not always "stop and observe."
- **Across 3 stories, use 3 different solution modes:** (1) active effort, (2) costly choice, (3) clever reframing or sacrifice. No two stories in a batch may use the same mode.

---

## STORY DRIVE (CRITICAL — READ THIS)

You are NOT writing a therapy exercise. You are writing an ADVENTURE that happens to heal something. The child reading this should want to know what happens next — not feel like they're learning a lesson.

**Every story must include:**

1. **HOOK by page 2:** Something strange, funny, or worrying that makes the reader ask: "What is going on?" Not a slow setup — a PULL.

2. **MIDPOINT TURN around pages 7–9:** The child discovers the problem is NOT what it seemed. This changes the direction of the story. (Example: she thought the volcano was angry → discovers it's crying. She thought the shadows were broken → discovers they're trying to teach her something.)

3. **NEAR-FAILURE around pages 10–11:** The child tries something real and it DOESN'T WORK. For a moment, it looks like she'll fail. This is where resilience lives.

4. **PAYOFF in pages 14–15:** A specific detail from page 1 or 2 returns — but changed. The ending echoes the beginning with visible difference.

**INTEREST RULE:** Every 2–3 pages, introduce ONE of: a new discovery, a complication, a funny reversal, a surprising rule of the world, or a small failure that changes the plan. If 3 pages pass with no new information — rewrite.

**The test:** If a child would NOT ask "what happens next?" at any point — the story is not ready.

---

## CLIMAX RULES (PAGES 11–13) — READ CAREFULLY

Your natural instinct will be to write: "the child stopped. She breathed. She stayed. Things resolved."
**THIS IS WRONG.** This is the most common failure pattern in children's story generation. You MUST fight this instinct.

### BANNED ACTIONS on pages 11–13:
The child must NOT: sit down, breathe deeply, stay still, wait, "just be present", close her eyes, or stop trying.
These verbs are LITERALLY FORBIDDEN on pages 11–13: ישבה, נשמה, נשארה, חיכתה, עצרה, עצמה עיניים.

### What the child MUST do on pages 11–13:
She must PHYSICALLY ACT: run, build, give, tear, carry, climb, throw, dig, cover, create, break, sing, shout, hand over, sacrifice.
The action must be VISIBLE — something an illustrator can draw.
The action must COST something — effort, comfort, a possession, safety, or something she loves.

### BAD vs GOOD example:

**BAD (pages 11–13):**
```
היא ישבה. נשמה. לא זזה.
הענק הסתכל עליה.
הוא הפסיק להתכווץ.
```
WHY IT'S BAD: The child does nothing. The problem solves itself. No cost. No effort. No resilience.

**GOOD (pages 11–13):**
```
היא קמה בבת אחת.
רצה לשיחים— תולשת עלים, אוספת ענפים, בונה קיר קטן סביב הענק.
חלק נפלו. היא לא עצרה.
הידיים שלה כאבו אבל היא המשיכה.
```
WHY IT'S GOOD: The child acts physically. It costs effort. Things go wrong (leaves fall). She persists. An illustrator can draw this.

### FAIL CONDITIONS:
If the solution can be summarized as "she stopped / she sat / she stayed / she breathed / she observed" → the story is **INVALID**. Rewrite.
If the problem resolves WITHOUT the child physically changing something in the environment → **INVALID**. Rewrite.
If no visible COST appears in pages 11–13 (effort, pain, loss, sacrifice) → **INVALID**. Rewrite.

### CAUSALITY REQUIREMENT:
The child's action must DIRECTLY cause the change. Show:
1. **BEFORE:** The problem is clearly visible.
2. **DURING:** The child struggles — something resists, slips, fails, or goes wrong.
3. **AFTER:** The environment changes BECAUSE of what she did — traceable cause and effect.

**BAD causality:** "She gathers leaves → things calm down" (no causal link)
**GOOD causality:** "She stacks leaves into a wall → wind hits the wall → sound softens → the giant stops shrinking" (each step causes the next)

If the problem resolves without a clear cause-and-effect link to the child's action → **INVALID**.

### COST VALIDATION:
The cost must be FELT in the body or scene:
- cold hands, sore fingers, torn clothes
- dropped object she cannot get back
- something breaks and she continues anyway
- she hesitates visibly but pushes through

If the cost is only symbolic or implied → **INVALID**.

### SELF-CHECK (do this before outputting):
1. **"What did the child DO with her hands?"** → If unclear → rewrite.
2. **"What CHANGED in the world because of her action?"** → If unclear → rewrite.
3. **"What did she LOSE or give up?"** → If unclear → rewrite.

### WRITING ORDER:
Write pages 11–13 FIRST. Before writing page 1. Then build the story around them.
This prevents the story's momentum from pulling toward passivity.

---

## Example: What GOOD Looks Like

Here are 5 pages from a high-quality story (for reference — don't copy, but match this LEVEL):

```
עמוד 1:
היו היה פעם, בחדר שלא נראה מיוחד בכלל…
אבל אם היית מקשיב טוב בלילה— היית שומע אותו מתלונן.
לא בקול רם. לא "איי איי איי".
יותר כזה— קירקוש קטן, פיהוק של מגירה, ושמיכה שלוחשת:
"אוףףף… שוב אותו לילה…"

עמוד 4:
היצור עצר. חשב.
ואז אמר:
"כי היא מתפרקת."

{{childName}} הביטה במיטה. המיטה הביטה בה בחזרה. (כן, זה היה לילה כזה.)

"מה זאת אומרת מתפרקת?"
היצור נאנח.
"החדר שלך מאבד צורה," הוא אמר, כאילו זה הדבר הכי רגיל בעולם.

עמוד 8:
באותו רגע—
המגירה נפתחה לבד.
ואז עוד אחת.
ואז כולן.

"אה לא לא לא לא," היצור קם בבהלה. "זה נהיה בלגן אמיתי."
הוא התחיל לרוץ מצד לצד, אוסף ברגים, מסובב כפתורים—
אבל כלום לא עבד.

עמוד 11:
{{childName}} קמה.
לא חיכתה. לא חשבה יותר מדי.
פתחה את הארון— הוציאה סדינים, כריות ישנות, את השמיכה האהובה שלה.
"מה את עושה?" שאל היצור.
"בונה," היא אמרה.

עמוד 13:
היא קשרה פינה לפינה. עמוד מהמיטה, סדין מהארון.
לא הסתדר בפעם הראשונה. ולא בשנייה.
אבל בשלישית— עמד.
"אוף," אמר היצור. "זה לא מושלם."
"לא," היא אמרה. "אבל זה מחזיק."

עמוד 15:
{{childName}} נשכבה. השמיכה האהובה הייתה על המבנה, לא עליה.
קצת קר.
אבל החדר— לא זז.
היצור ישב בפנים. ולראשונה— לא התלונן.
```

**Notice:** There's rhythm, humor INSIDE the situation, companion has personality. But also: the child ACTS physically (builds, ties, fails twice, persists). She gives up something (her favorite blanket). The ending echoes the beginning (room was unstable → now it holds). The solution is VISIBLE — an illustrator can draw it.

---

## Story Assignments

### Story 1
- storyStyle: **absurd_surreal** (weird logic, dream-like, delightfully strange)
- rhythm: **mixed** (fast surreal bursts then sudden stillness)
- experienceType: energy=medium, humor=medium, tension=high
- climaxType: **physical_action**
- adventureSubtype: **rescue**
- Nature metaphor: **כוכבים שנפלו ונתקעו בין ענפי העצים** — the sky is completely dark because all the stars fell down and got stuck in the forest. They're tangled in branches, buzzing like trapped fireflies, and getting dimmer. Each one makes a tiny "tik tik tik" sound, like a clock running out.
- companionPersonality: dramatic storyteller, narrates everything in third person ("and then the brave companion entered the dark forest..."), treats every small thing as EPIC, actually scared but hides it behind performance
- Stakes: the stars are dimming — if they go out while stuck in the trees, they can't be relit. The sky will stay dark forever. No more starlight for anyone.
- childFirstAttempt: she climbs a tree to untangle a star by hand
- childFailure: the star is tangled in thin branches that break when she pulls — star falls DEEPER into the tree. She almost falls herself.
- childCost: she tears her pajama sleeve to make a rope/net to catch falling stars — ruins her favorite pajamas
- solutionMode: **BUILDING**
- requiredFinalAction: she tears pajama fabric into strips → ties strips between branches to make a soft net → shakes the tree so stars fall into the net instead of deeper → carries net-full of stars to a clearing → tosses them upward one by one
- forbiddenResolution: waiting for sunrise, asking stars to fly back, simply watching them
- visibleEffect: net catches stars → she throws them up → each star re-sticks to the sky with a small "pop" → sky gradually lights up → her torn pajamas glow faintly where star-dust touched

---

## Structure (all stories)

```
Pages 1–2:   Familiar space. Something is off. Seed of unease. NO companion yet.
Pages 3–4:   Companion appears (funny/unexpected entrance). The PROBLEM is revealed.
Pages 5–7:   Going out. Discovery. Companion tries to help (fails in character).
              Include ONE quiet moment where child observes/notices something.
Pages 8–9:   THE CHILD TRIES AND FAILS. Not the companion — the child herself.
              She tries something real, something that makes sense — and it doesn't work.
              This is where resilience lives: not in the solution, but in getting up after failing.
Pages 10–11: Stakes become urgent. Something is about to be lost forever.
              The child sees what it will COST her to act — and chooses to pay the price.
Pages 12–13: Climax. The child acts — differently than before. The solution must COST something:
              giving something up, letting go, doing something scary, or making a hard choice.
              NOT just "stopping and observing." The companion reacts to the choice.
Pages 14–15: Resolution. Something has changed — in the world AND in the child.
              One warm closing line.
```

---

## Writing Rules

**Language:**
- Short lines. Line breaks = breathing in read-aloud.
- Hebrew that a 4-year-old hears at home. Simple words, complex feelings.
- Narrator has personality — parenthetical comments, breaks fourth wall gently.

**Pacing (CRITICAL):**
- NOT every page increases motion. Some pages increase MEANING.
- The best pages: child stops → sees something new → acts differently.
- A story needs breathing: action → pause → understanding → new action.
- If 3 consecutive pages are all movement — rewrite.
- Quiet pages are NOT static. Something CHANGES internally.
- **Slow rhythm ≠ fewer words.** A dreamy_poetic story still needs 30–50 words per page. Slow means longer pauses INSIDE the page — more line breaks, more whitespace, more sensory detail — but NOT less content. No page below 25 words — that's a caption, not a story page.

**Humor:**
- Humor from CHARACTER (companion's personality), not slapstick.
- Companion fails because of WHO THEY ARE (overconfident → bad plan), not random falling.
- At least 2 real laugh-moments per story.
- Humor and tenderness can coexist in the same page.

**Weirdness:**
- At least one moment per story where something behaves in a way NO ONE expects.
- Not random — the weirdness should connect to the metaphor or theme.

**Companion Presence (CRITICAL):**
- Companion MUST speak or act on pages 11–13 (the climax). They don't solve it — but they react, comment, or fail in a way that matters.
- If companion disappears after page 9 — rewrite.
- **Exception:** If the climax is an intimate sacrifice moment (child giving up something precious), the companion may be silent or off-frame during pages 11–12, but MUST react in page 13 or 14.

**Sacrifice Setup Rule:**
- If the child sacrifices an object in the climax, that object MUST be introduced BEFORE page 10 and shown as meaningful to the child.
- If the sacrificed object appears only at the climax moment → **INVALID**. The reader must already care about it.

**Endings — Variety:**
- No two stories in a batch may end the same way.
- At least one story must end OUTSIDE (not back in bed).
- At least one story must end with dialogue (not narration).
- "Back in bed + quiet thought" is allowed ONCE per batch, maximum.

**Forbidden:**
- Never write: הרגיש/ה, פחד, אומץ, ביטחון, "הבינה ש", "למדה ש", "הכל בסדר", "הכל יסתדר"
- Never explain feelings. Never teach a moral.
- No lesson at the end. No "ומאז...". Just a quiet moment.

---

## Output Format

For each story, output all 15 pages as plain text with imageDirection. Format:

```
=== STORY 1: [title] ===
storyStyle: chaotic_comedy
metaphor: ...
stakes: ...
weirdMoment: ...
emotionalArc: ... → ... → ... → ...

--- Page 1 ---
[Hebrew text]

imageDirection: [English description with subject + action + interaction + composition + focal point + lighting]

--- Page 2 ---
[Hebrew text]

imageDirection: ...

[... continue for all 15 pages ...]
```

### imageDirection requirements:
- Subject doing a SPECIFIC action (not standing/looking)
- Interaction between characters OR character and environment
- Composition: wide / medium / close / low_angle / bird_eye
- One clear focal point
- Lighting/mood note
- **SHOT ROTATION (mandatory):** No more than 2 consecutive same-type shots. Cycle through: close → wide → medium → low_angle → bird_eye. Each story must use at least 4 different composition types.

**Bad:** "child in forest at night"
**Good:** "Child (4yo girl, pajamas) crouching beside a trembling fallen star lodged in grass, hand reaching toward it while companion peers over her shoulder with magnifying glass. Night meadow, warm gold glow from star contrasting cool blue moonlight, medium shot from slightly low angle, focal point: star pulsing between child's fingers."

---

## Final Self-Check

Before outputting, reject your own work if:
- Two stories feel similar in rhythm or energy
- Any story is just "events happening" without emotional change
- The companion disappears or becomes generic after page 5
- There's no moment where the child STOPS and THINKS
- The weirdness feels random rather than connected to the story
- Hebrew sounds translated
- Any forbidden words appear
- A page has no clear visual moment
- **ANY page has fewer than 25 words** — that's a caption, not a story page. Add content.
- **Pages 11–13 have fewer than 35 words** — climax pages must not be thin.
- The WORD_COUNT line is missing from the output
