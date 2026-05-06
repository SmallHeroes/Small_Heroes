# Story Bank Plan — Pre-Generated Stories for Small Heroes

## Context for ChatGPT

You're helping build a **pre-generated story bank** for "Small Heroes" (גיבורים קטנים) — an AI-powered personalized children's book product.

**The shift:** Instead of generating stories dynamically with an LLM pipeline (which produces inconsistent quality), we're pre-writing high-quality Hebrew stories that get personalized with variable names/gender at delivery time.

**The product:** Parents fill a wizard (child's name, age, challenge, companion character), choose a story direction, and get a beautiful illustrated storybook about resilience.

---

## The Matrix

### Categories (6 emotional challenges)

| ID | Hebrew Label | Core Theme | Nature Metaphors to Use |
|----|-------------|------------|------------------------|
| NIGHT_FEAR | פחד לילה / חושך | Fear of dark, nighttime anxiety | Stars that fell, moon hiding, night garden, fireflies, shadows that are creatures |
| ANGER_FRUSTRATION | כעס / תסכול | Anger outbursts, frustration | Volcano that needs to learn to breathe, hurricane that discovers its eye is calm, fire dragon |
| SENSITIVITY_OVERWHELM | רגישות יתר / עומס | Sensory overload, overwhelm | Snowstorm that becomes gentle snow, ocean waves that find their rhythm, wind learning to whisper |
| SOCIAL | קשיים חברתיים | Loneliness, belonging, friendship | Forest where different trees grow together, orchestra of different instruments, river joining the sea |
| TRANSITION | שינוי / מעבר | Moving, new school, divorce, change | Seasons changing, caterpillar metamorphosis, river finding new path, seed in new soil |
| MEDICAL | טיפול רפואי / מחלה | Hospital, broken arm, illness, needles | Mountain to climb with rest stops, storm that passes, body as a castle with repair workers |

### Direction Cards (3 story archetypes)

| ID | Hebrew | Story Type | Tone |
|----|--------|-----------|------|
| connection | סיפור לפני שינה | Intimate, warm, relational. Stays in familiar space. Companion comes TO the child. | Soft, rhythmic, calming |
| adventure | סיפור הרפתקאות | Goes outside, multiple locations, physical challenges. Child goes OUT into the world. | Energetic, surprising, funny |
| courage | סיפור קסום | Small brave act in a magical-realist setting. Reality transforms around the child. | Wonder, quiet bravery, poetic |

### Stories Per Combination

**10 unique stories** per category × direction = **10 × 6 × 3 = 180 stories total**

Each story is written at **15 pages** (medium length). Shorter (10) and longer (20) versions are created by trimming/expanding.

---

## Variable Slots (What Gets Personalized)

Every story uses these placeholders:

| Placeholder | Example | Notes |
|-------------|---------|-------|
| `{{childName}}` | לול, יואב, מאיה | Child's name |
| `{{childGender}}` | f/m | Affects ALL verbs, adjectives, pronouns in Hebrew |
| `{{companionName}}` | אורי, לילי, חכם | The companion creature's name |
| `{{companionType}}` | שועל, ינשוף, עטלף | Species/type — affects description lines |
| `{{parentName}}` | אמא, אבא, סבתא | Supporting character |
| `{{additionalCharName}}` | (optional) | Sibling, friend, etc. |
| `{{childAge}}` | 4, 6, 8 | For vocabulary adaptation |

**CRITICAL:** Stories are written in **female form (נקבה)**. Male adaptation is mechanical (verb/adjective gender swap). This is a separate automated step.

---

## Available Companions (24 total)

The child picks ONE companion in the wizard. The story must work with any companion from the relevant category. Here are the companions grouped by category:

### NIGHT_FEAR
1. **העטלף לילי** — bat, sees in the dark, shows shadows are friendly
2. **השועל אורי** — copper fox with lantern eyes, teaches cleverness over fear
3. **הינשוף חכם** — wise owl, calm guardian presence at night

### NOISE_FEAR
4. **הענק תום** — gentle giant whose footsteps shake earth but heart is quiet
5. **הלוויתן ים** — blue whale whose song calms oceans
6. **התוף שלי** — sentient drum that transforms scary sounds into courage-rhythm

### TRANSITION
7. **הקמליון קוקו** — chameleon carrying colors from every place he's been
8. **הסנאי נווד** — squirrel who buried courage-treasures in every new tree
9. **הצב ביתי** — turtle whose shell IS home

### NEW_SIBLING (→ can merge into TRANSITION)
10. **הכוכב התאום** — star that split in two but light only grew
11. **הדרקון דיני** — baby dragon discovering guardian strength
12. **הדבורה אמא** — queen bee in growing hive

### SELF_CONFIDENCE
13. **האריה שקט** — shy lion cub discovering his roar was inside all along
14. **הפיה זוהרה** — tiny fairy whose small light changes a whole room
15. **הרובוט רובי** — robot who writes his own code, step by step

### SOCIAL
16. **הפנדה ענת** — soft panda who discovers friends love quiet too
17. **המנצח מתי** — conductor bear showing every voice has a place
18. **הקיפוד רכי** — hedgehog learning to soften quills for a hug

### FOCUS_LEARNING
19. **צייד פרפרון** — butterfly hunter, you don't catch everything — choose one
20. **הקוסם אבב** — wizard whose letters dance for those who dance with them
21. **הקפטן נווט** — otter captain steering a thought-ship

### GENERAL / OTHER (used for MEDICAL and new categories)
22. **המפה הקסומה** — living map that draws itself as you walk
23. **המראה שמיית** — warm mirror showing who you're becoming
24. **המפתח הזהב** — traveling key that knows every lock has a shape

---

## Story Quality Rules (CRITICAL)

Every story MUST follow these rules. This is what makes the product work:

### Narrative Structure (non-negotiable)
```
Pages 1-2:   SETUP — Child in familiar space. Something is off. Emotional seed planted.
Pages 3-4:   TRIGGER — Something unusual happens. Companion appears OR is discovered.
Pages 5-7:   JOURNEY — Movement, discovery, small challenges. Humor happens here.
Pages 8-10:  RISING — Challenge gets harder. Companion fails. Child must act alone.
Pages 11-13: CLIMAX — A real choice. Child does something brave/kind/creative.
Pages 14-15: RESOLUTION — Return or quiet moment. Something has changed inside.
```

### Writing Style Rules

1. **Hebrew must sound NATIVE** — like Meir Shalev or David Grossman write for children. Not translated English. Short sentences. Rhythm. Read-aloud quality.

2. **Show, don't tell** — NEVER write "she felt brave" or "he was scared." Show through ACTION what they feel. The reader understands.

3. **Forbidden words** (never use these):
   - הרגיש/ה, חש/ה, ידע/ה, פחד (as noun), אומץ, ביטחון, שמחה, עצב
   - נרגע/ה, "הכל בסדר", "הכל יסתדר"
   - "החליט/ה להיות אמיצ/ה", "התגבר/ה על", "למד/ה ש", "הבין/ה ש"

4. **Line breaks = breathing** — Use short lines. Single-word lines. Breaks create rhythm for reading aloud:
   ```
   ואז—
   מתחת למיטה—
   נשמע צחקוק.
   קטן.
   חשוד.
   ```

5. **Humor is REQUIRED** — At least 2 genuinely funny moments per story. Physical comedy > verbal jokes. Companion failing in funny ways. Unexpected reactions. NOT puns or wordplay.

6. **The child is the HERO** — The companion helps but CANNOT solve the problem. The child must make the decisive action/choice.

7. **No moral, no lesson** — NEVER end with "and she learned that..." or "from that day on..." End with a quiet moment, a small smile, one warm sentence.

8. **Nature metaphors** — The challenge should be embodied as something in nature or the physical world. Not abstract. The child's interaction with this metaphor IS the therapeutic mechanism.

9. **Every page must have:**
   - One physical ACTION (something moves, changes, happens)
   - One clear VISUAL (drawable as a single illustration)
   - Connection to the previous page (cause → effect chain)

10. **Word count:** 25-40 Hebrew words per page. 2-3 short lines maximum.

### What Makes a Story GREAT (aim for this)

- A central metaphor that's surprising and specific (NOT generic "darkness is scary")
- A companion who has personality, makes mistakes, has opinions
- At least one moment where the reader laughs
- At least one moment where the reader's heart squeezes
- A twist — something isn't what it seemed
- An ending that echoes the beginning but everything feels different

---

## Story Diversity System (CRITICAL)

Every story must be different not just in PLOT but in EXPERIENCE. Two stories with different plots but the same rhythm/energy/climax type will feel identical after a few books.

### Story Signature (mandatory per story)

```json
{
  "storyStyle": "chaotic_comedy | dreamy_poetic | absurd_surreal | high_energy | quiet_intimate | wild_physical"
}
```

**Rule:** No two stories in the same category × direction batch may share the same storyStyle.

### Experience Type (mandatory per story)

```json
{
  "experienceType": {
    "energy": "low | medium | high",
    "humor": "light | medium | heavy",
    "tension": "low | medium | high"
  }
}
```

**Rule:** No two stories in the same batch may have the same energy × humor × tension combination.

### Climax Type (mandatory — must vary across batch)

Each story must have a DIFFERENT type of climax:
- **physical_action** — jump, save, run, climb, build
- **emotional_decision** — choose to stay, offer help, extend trust
- **clever_solution** — figure out a puzzle, use something in an unexpected way
- **helping_someone** — the "scary" thing actually needs the child's help
- **creative_act** — sing, draw, imagine, create something that changes the situation

**Rule:** In every batch of 10 stories, at least 4 different climax types must appear.

### Adventure Subtypes (for adventure archetype)

Within the "adventure" direction, stories must vary in adventure TYPE:
- **exploration** — discovering unknown places, mapping, finding
- **rescue** — someone/something needs saving
- **chase** — being pursued or pursuing something
- **puzzle** — solving a mystery or riddle in the environment
- **journey** — getting somewhere specific against obstacles

**Rule:** In 10 adventure stories per category, at least 4 different subtypes must appear.

### Rhythm Pattern (mandatory — must vary across batch)

Each story must have a distinct internal pacing:
- **fast** — short lines, quick actions, many events per page, breathless energy
- **slow** — longer pauses, quiet moments, fewer actions, space between lines
- **mixed** — alternates fast bursts with slow contemplative moments

**Rule:** No two stories in the same batch may share the same rhythm pattern. In 10 stories, aim for ~3 fast, ~3 slow, ~4 mixed.

### Stakes Rule (mandatory per story)

Each story MUST include a clear "what if" tension: **what will be lost, missed, or remain unresolved if the child does NOT act?**

This must be visible through the situation, not explained. Examples:
- The stars will stay fallen forever (no one else can reach them)
- The companion is stuck and can't get free alone
- The path home is disappearing
- Something precious is breaking/fading

Without stakes → no real tension → no real climax → story feels flat.

### Companion Personality Rule (mandatory per story)

The companion must feel like a REAL CHARACTER inside each story, not a generic helper. Even though the companion name is a placeholder (`{{companionName}}`), within the story they must have:

- **A specific flaw** — clumsy, overconfident, forgetful, too serious, easily distracted, dramatic
- **A behavior pattern** — always tries the wrong solution first, talks to objects, counts everything, apologizes to things he bumps into
- **A voice** — a way of speaking that's distinct (short excited bursts, overly formal, asks questions constantly)

The companion personality should VARY across stories in the batch. Don't make every companion "clumsy and funny" — one can be dramatic and serious, another can be chaotic and excited, another can be shy and precise.

### Weirdness Rule

**Every story MUST have at least one moment that is genuinely strange, surprising, or absurd.** Something that doesn't follow the expected logic. Something that makes a child say "wait, WHAT?"

Examples:
- A tree that walks backward when you're not looking
- A door that only opens if you sing to it
- Stars that sneeze when they fall
- A shadow that's afraid of the dark
- A bridge made of sleeping fish

This is NOT optional. Stories without weirdness are rejected.

---

## Image Direction Spec (UPGRADED)

Every `imageDirection` field MUST include:

1. **Subject** — who is in the frame, doing what specific action
2. **Interaction** — between characters OR between character and environment
3. **Composition** — camera angle / framing:
   - `wide` = full environment visible, characters smaller
   - `medium` = character waist-up with some environment
   - `close` = face/hands, intimate detail
   - `low_angle` = looking up at subject (makes things feel big/dramatic)
   - `bird_eye` = looking down (shows layout/path)
4. **Focal point** — ONE thing the eye should go to first
5. **Lighting/mood** — warm/cool/dramatic/soft

### ❌ FORBIDDEN in imageDirection:
- "standing and looking"
- "walking through"
- Static poses with no interaction
- Empty scenes
- Generic descriptions ("a forest at night")

### ✅ GOOD imageDirection example:
```
"Child (4yo girl, curly dark hair) reaching up on tiptoes to touch a glowing fallen star caught in tree branches, while companion watches from below with mouth open in surprise. Night forest, soft blue-gold lighting, medium shot, focal point: the star between child's fingers."
```

---

## Output Format Per Story

```json
{
  "id": "night_fear_adventure_03",
  "category": "NIGHT_FEAR",
  "archetype": "adventure",
  "adventureSubtype": "exploration",
  "storyStyle": "dreamy_poetic",
  "rhythm": "slow",
  "experienceType": { "energy": "medium", "humor": "light", "tension": "medium" },
  "climaxType": "helping_someone",
  "stakes": "הכוכבים יישארו כבויים לנצח ואף אחד לא יראה אותם שוב",
  "companionPersonality": { "flaw": "dramatic", "pattern": "apologizes to everything he bumps into", "voice": "overly formal and polite" },
  "title": "{{childName}} ושביל הכוכבים",
  "theme": "הלילה מלא דברים שצריכים עזרה, לא דברים שמפחידים",
  "metaphor": "כוכבים קטנים שנפלו מהשמיים וצריכים ללמוד לזהור שוב",
  "emotionalArc": "חשש → סקרנות → עשייה → גאווה שקטה",
  "natureElement": "כוכבים, שביל אור, שמיים לילה",
  "weirdMoment": "הכוכבים מתעטשים כשהם נופלים ומשאירים אבקת זהב",
  "companionRole": "מדריך מצחיק שנכשל פיזית אבל לא מוותר",
  "pages": [
    {
      "page": 1,
      "text": "הלילה היה שקט בחדר של {{childName}}.\nשקט מדי.\nהשמיכה עשתה רעש קטן — פשששש.\nכאילו גם היא מתחביאה.",
      "imageDirection": "Child (4yo girl, curly dark hair, pajamas) lying in bed in dark room, clutching blanket edge with one hand while the other reaches toward faint light from window. Moonbeam cuts across floor. Close-medium shot from bed level, focal point: child's wide curious eyes catching the light. Soft blue-silver mood.",
      "corePage": true
    },
    {
      "page": 2,
      "text": "...",
      "imageDirection": "...",
      "corePage": true
    }
  ]
}
```

**Fields:**
- `storyStyle` = the overall tone/feel signature of this story
- `rhythm` = internal pacing (fast / slow / mixed)
- `experienceType` = energy × humor × tension levels
- `climaxType` = what TYPE of climactic moment
- `adventureSubtype` = (adventure archetype only) what kind of adventure
- `stakes` = what will be lost if the child doesn't act (Hebrew, one sentence)
- `companionPersonality` = flaw + behavior pattern + voice style for this story's companion
- `weirdMoment` = brief description of the strange/surprising moment
- `corePage: true` = kept in 10-page version (mark 10 pages as core)
- `corePage: false` = removed in 10-page version, expanded in 20-page version
- `imageDirection` = English description following the upgraded spec above

---

## How to Generate: Batch Instructions

### Phase 1: NIGHT_FEAR × 3 directions × 10 stories = 30 stories

Start with this category. For each story:

1. Pick a UNIQUE metaphor/world that hasn't been used yet in this batch
2. Write 15 pages following the structure
3. Use `{{childName}}`, `{{companionName}}`, etc. for all variable parts
4. Write in FEMALE form (נקבה) — male adaptation is automatic
5. Include `imageDirection` for each page
6. Mark which 10 pages are `corePage: true`

**Variety requirements within each category × direction combo (10 stories):**
- At least 5 different nature elements
- At least 5 different opening locations
- At least 4 different climax types (physical_action, emotional_decision, clever_solution, helping_someone, creative_act)
- At least 4 different adventure subtypes (if adventure archetype)
- At least 4 different storyStyles
- No two stories with the same experienceType combination
- No two stories with the same metaphor
- No two stories with the same weirdMoment type
- The 10 stories must collectively feel like 10 DIFFERENT BOOKS, not 10 chapters of the same book

### Phase 2: Remaining categories (same pattern)

### Phase 3: MEDICAL category (new — needs special care)
- Scenarios: broken arm, hospital visit, needle/injection, illness at home, surgery
- Metaphors: body as castle with repair workers, mountain with rest stops, river that needs a dam
- CRITICAL: Never minimize real pain. Acknowledge it's hard. Show coping, not "being brave."

---

## Companion Compatibility

Stories should be written so that ANY companion from the category works. How:

- Reference the companion by `{{companionName}}` and generic role descriptions
- Don't write species-specific actions (like "wagged his tail" which only works for fox)
- Use universal companion actions: laughed, jumped, tried, failed, said, whispered, nudged
- The `companionType` slot only affects 2-3 descriptive lines per story (appearance mentions)

**Template lines that get swapped by companion type:**
```
// Generic (in the template):
{{companionName}} צחק צחוק קטן ונשען קדימה.

// NOT in template — adaptation adds 1-2 lines like:
// Fox version: הזנב הכתום שלו כישכש שמאלה ימינה.
// Owl version: הנוצות שלו התנפחו קצת מגאווה.
// Bat version: הכנפיים הרכות שלו רפרפו בשקט.
```

These adaptation lines are added mechanically — not a full rewrite.

---

## Age Adaptation

Base stories are written for age 5 (middle of range).

**Age 3-4 adaptation:** Simpler vocabulary, shorter sentences, more repetition, more sound words
**Age 7-8 adaptation:** Slightly richer vocabulary, longer inner thoughts, more complex metaphor

This is a mechanical LLM task AFTER the base story is approved.

---

## Generation Order (Priority)

1. **NIGHT_FEAR** — our strongest category, most orders
2. **ANGER_FRUSTRATION** — high demand
3. **MEDICAL** — unique differentiator, nothing like this exists
4. **SENSITIVITY_OVERWHELM** — growing demand
5. **SOCIAL** — common need
6. **TRANSITION** — seasonal demand (back to school, moving)

---

## Quality Checklist (for reviewing generated stories)

### Narrative Quality
- [ ] Has clear beginning → middle → end arc
- [ ] Child makes an active choice (not passive)
- [ ] Companion is funny AND helpful (not just one)
- [ ] At least 2 laugh-moments
- [ ] At least 1 emotional squeeze moment
- [ ] No forbidden words used
- [ ] Every page has a physical action
- [ ] Pages connect causally (not random events)
- [ ] Metaphor is specific and surprising
- [ ] Ending is quiet, warm, no lesson
- [ ] Hebrew sounds native (not translated)
- [ ] Each page is 25-40 words
- [ ] Each page is one drawable visual moment
- [ ] Nature element is woven in (not decorative)
- [ ] Story works with any companion from the category

### Diversity Quality (check across the batch)
- [ ] This story FEELS different from the others (not just different plot)
- [ ] storyStyle is clearly distinct
- [ ] Energy/humor/tension combination is unique in this batch
- [ ] Climax type is different from at least 60% of the batch
- [ ] Has at least one genuinely weird/surprising moment
- [ ] Would a parent who read 3 other stories from this batch still be surprised?

### Image Direction Quality
- [ ] Every imageDirection has: subject + action + interaction + composition + focal point
- [ ] No static poses or "standing and looking"
- [ ] Composition varies across pages (not all medium shots)
- [ ] At least 2 dynamic/action shots per story
- [ ] At least 1 intimate close shot per story

---

## Example: One Complete Story

Here's a reference story at the quality level we need (NIGHT_FEAR × adventure):

```json
{
  "id": "night_fear_adventure_01",
  "category": "NIGHT_FEAR",
  "archetype": "adventure",
  "title": "{{childName}} ומסלול הכוכבים",
  "theme": "הלילה מלא במסלולים שמחכים למי שיעז לצאת",
  "metaphor": "כוכבים שנפלו ומחכים שמישהו יחזיר אותם לשמיים",
  "emotionalArc": "היסוס → סקרנות → תנועה → גאווה שקטה",
  "natureElement": "כוכבים, שבילי אור, שמיים, גבעה",
  "companionRole": "מדריך נלהב שנכשל פיזית בצורה מצחיקה"
}
```

Page 1:
```
היה לילה שקט בחדר של {{childName}}.
שקט מדי.

כי הגרביים שעל הכיסא—
עשו "פפפפ" קטן.
```

Page 2:
```
{{childName}} התיישבה.
"סליחה?"

מהחלון קפץ {{companionName}}.
נחת על השטיח.
החליק.
התגלגל לתוך סל הכביסה.
```

Page 3:
```
"אני בסדר!" הוא צעק מתוך חולצה.
"הכול מתוכנן."

{{childName}} צחקה.
"מי אתה?"
```

(Continue for 15 pages with the full adventure arc...)

---

## Summary for ChatGPT

**Your job:** Generate 10 unique stories for each category × direction combination. Start with NIGHT_FEAR. Each story must be:
- 15 pages
- In Hebrew (female form)
- Using {{placeholders}} for all personalized content
- Following ALL quality rules above
- With imageDirection per page
- With corePage marking (10 of 15 = core)
- With a unique metaphor/world not repeated in the batch

**Total end goal:** 180 stories (6 categories × 3 directions × 10 stories)

**Start with:** NIGHT_FEAR × adventure × first 3 stories. Each MUST have:
- A different storyStyle (e.g., story 1 = chaotic_comedy, story 2 = dreamy_poetic, story 3 = absurd_surreal)
- A different experienceType combination
- A different climaxType
- A different adventureSubtype
- A different nature metaphor

We'll review these 3 and adjust before continuing to the full batch.
