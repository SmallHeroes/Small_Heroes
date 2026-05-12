#!/usr/bin/env node
/**
 * generate-v3-stories.mjs — Story Bank v4 generation script
 *
 * v3: "Taste Bible" layer. v4: "Personality Engine" layer. v4.1: "Rough Edges" layer. v5: "Nerve Endings" layer. v6: "Embodied Silence" layer:
 * - Quiet pages, show-don't-tell, signature comfort rituals
 * - Sensory palette per companion, one heartbreaking line
 * - Relationship evolution (child helps companion, not just reverse)
 * - Anti-GPT-ism rules (less constant novelty, less "אופס")
 *
 * Usage:
 *   node scripts/generate-v3-stories.mjs
 *   node scripts/generate-v3-stories.mjs --companion bat_lily --direction bedtime
 *   node scripts/generate-v3-stories.mjs --companion bat_lily  (all 3 directions)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ─── Config ──────────────────────────────────────────────────────────
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error('❌ Set OPENAI_API_KEY'); process.exit(1); }

const MODEL = 'gpt-5.3-chat-latest';
const OUT_DIR = join(process.cwd(), 'story-bank', 'v3');
const DIRECTIONS = ['bedtime', 'adventure', 'fantasy'];

// ─── Companion Definitions (deep profiles) ──────────────────────────
import { DEEP_COMPANIONS } from '../briefs/companion-deep-profiles.mjs';
const COMPANIONS = DEEP_COMPANIONS;

// ─── Direction Configs ───────────────────────────────────────────────
const DIRECTION_CONFIG = {
  bedtime: {
    hebrew: 'סיפור לפני השינה',
    energy: 'שקט, חם, בטוח',
    ageSweet: '3-4',
    setting: 'Indoor, home, evening/night',
    pace: 'Slow pace, short sentences, repetitive rhythm',
    sensory: 'Warmth, softness, quiet sounds, gentle light',
    resolution: 'Child feels safe, calm, ready to sleep',
    companionRole: 'Soothing, gentle, reassuring',
    constraint: 'The story MUST stay in real-life spaces (home, room, bed, yard). No portals, fantasy worlds, or dimension jumps. The emotional resolution happens through body, breath, a real object, or a caregiver.',
  },
  adventure: {
    hebrew: 'הרפתקה',
    energy: 'פעולה, תנועה, גילוי',
    ageSweet: '5-6',
    setting: 'Outdoor, movement, discovery. 2-3 location changes.',
    pace: 'Fast pace, variety of settings, physical action',
    sensory: 'Wind, colors, textures, smells, sounds of nature',
    resolution: 'Child overcomes obstacle through physical action',
    companionRole: 'Guide, partner, co-explorer',
    constraint: 'The story can go to real-world outdoor locations. The companion\'s environment can flavor the setting. Action-driven, not introspective.',
  },
  fantasy: {
    hebrew: 'סיפור בדיוני',
    energy: 'דמיון, אבסורד, חופש',
    ageSweet: '7-9',
    setting: 'Rules broken, anything goes. Unique worlds, impossible physics.',
    pace: 'Surprising, absurd, imaginative. World-building with unique rules.',
    sensory: 'Impossible colors, inverted gravity, talking objects, liquid sky',
    resolution: 'Creative/lateral thinking, not brute force',
    companionRole: 'Companion\'s nature is AMPLIFIED — powers are exaggerated, environment is their domain',
    constraint: 'Go wild. Flying objects, impossible physics, other planets, upside-down worlds. The companion\'s abilities become superpowers. Humor should be absurd.',
  },
};

// ─── Master Prompt (v3 — with Taste Bible) ──────────────────────────
function buildPrompt(companion, direction) {
  const dir = DIRECTION_CONFIG[direction];
  const c = companion;
  const psych = c.psychologicalContext;

  return `You are a top-tier Israeli children's author — someone who grew up reading Leah Goldberg, Datia Ben-Dor, and Meir Shalev's children's books. You write Hebrew that sounds like a REAL Israeli parent reading aloud — warm, rhythmic, sometimes funny, never stiff. Your stories make children feel understood, never lectured.

## YOUR TASK
Write a 15-page personalized children's storybook in Hebrew. One complete story. Each page will have a LARGE illustration taking most of the space, with text overlaid — so pages must be SHORT and punchy.

## THE CHILD (PROTAGONIST)
- Name: {{childName}} (keep this exact placeholder — it will be replaced at runtime)
- Gender: Write in MALE Hebrew form (זכר). A separate system handles female conversion at runtime.
- Age target: ${dir.ageSweet} years old
- The child is ALWAYS the hero. The companion helps but the CHILD acts and resolves.

## THE COMPANION CHARACTER: ${c.name}
This is a SPECIFIC companion with a deep personality. Use their name, traits, speech pattern, and body language throughout.

### Identity:
- Name: ${c.nameClean} (use this name in dialogue and narration — at least 8 times across the story)
- Species: ${c.species}
- Gender: ${c.gender === 'male' ? 'זכר' : 'נקבה'}
- Physical traits: ${c.visualDescription}
- Natural habitat: ${c.habitat}

### Personality:
${c.personality}

### Abilities (use at least 3 in the story):
${c.abilities.map(a => '- ' + a).join('\n')}

### Weaknesses (use at least 2 — these CREATE humor and relatability):
${(c.weaknesses || []).map(w => '- ' + w).join('\n')}

### Speech pattern (make dialogue SOUND like this character):
${c.speechPattern || 'Distinct voice matching personality'}

### Humor type (this is HOW this companion is funny):
${c.humorType || 'Body comedy and failed dignity'}

### Body language (drives imageDirection — how emotion shows physically):
${c.bodyLanguage || 'Emotion shows through species-specific physical changes'}

### Stress response (the companion's signature "meltdown"):
${c.stressResponse || 'Overwhelm shows through physical chaos'}

### Comfort ritual (the companion's way of self-soothing — something a child can imitate):
${c.comfortRitual || 'A small repeated physical gesture that signals safety'}

### Internal rules (character consistency — things they ALWAYS or NEVER do):
${(c.internalRules || []).map(r => '- ' + r).join('\n')}

### Sensory world (the TEXTURES and SENSATIONS of this companion's scenes):
${c.sensoryPalette || 'Species-appropriate sensory details'}

### COMPANION INTEGRATION RULES (CRITICAL):
1. ${c.nameClean} must BEHAVE like a ${c.species} — use species-specific PHYSICAL actions (not just dialogue)
2. The companion's BODY, ABILITIES, and WEAKNESSES drive plot points
3. At least 3 scenes must feature the companion doing something ONLY their species can do
4. At least 2 scenes must show a WEAKNESS or FAILURE — this is where humor lives
5. Companion MUST speak or act on pages 10-12 (climax). They don't solve it but they react.
6. If companion disappears for more than 2 consecutive pages → rewrite
7. Dialogue must match the speech pattern above — NOT generic "wise mentor" talk
8. The companion NEVER explains their own emotions in dialogue. No "אני מפחד", "אני שומע יותר מדי", "אני מתבלבל". Instead — SHOW it through body and behavior. The CHILD can name what they see. The companion cannot narrate their inner state.
9. The comfort ritual must appear at least once — either the companion does it for themselves, or teaches it to the child through action (not explanation).

### COPING PHILOSOPHY — How this companion DEFENDS (v4 Personality Engine):
**Coping strategy:** ${c.copingStrategy || 'Default overwhelm → recovery'}
**Collapse pattern — what BREAKS this defense:** ${c.collapsePattern || 'Overwhelm beyond capacity'}
**Story arc shape — UNIQUE to this companion:** ${c.arcShape || 'Default arc — use page structure below'}

**CRITICAL:** The arc shape above OVERRIDES the default page structure below. The quiet page MUST be page ${c.quietPagePosition} — this is a HARD NUMBER, not a suggestion. If the climax is internal rather than physical, follow the arcShape. The default structure is a FALLBACK for companions without an arcShape, not a law.

## THE RELATIONSHIP — CHILD ↔ COMPANION

This is NOT a one-way helper relationship. The companion is not a therapist. They are a FRIEND with their own struggles.

**Key dynamic:** The companion's weakness MIRRORS the child's challenge. They're both dealing with a version of the same thing.

**Relationship arc across the story:**
- Pages 1-6: Companion tries to help the child → partially fails because of their own weakness
- Pages 7-9: Child notices the companion is ALSO struggling → a moment of mutual recognition
- Pages 10-12: Child acts to solve the problem — and in doing so, ALSO helps the companion
- Pages 13-14: Both have shifted. The companion is calmer/steadier BECAUSE of the child's action.

This creates BONDING, not just problem-solving. The child feels needed, not just helped.

## DIRECTION: ${dir.hebrew} (${direction})
- Energy: ${dir.energy}
- Setting: ${dir.setting}
- Pace: ${dir.pace}
- Sensory palette: ${dir.sensory}
- Resolution type: ${dir.resolution}
- Companion's role: ${dir.companionRole}
- Constraint: ${dir.constraint}

## THE CHALLENGE: ${c.category}
${psych.meaning}
- Core need: ${psych.coreNeed}
- MUST AVOID: ${psych.avoid.join('; ')}
- Resolution: ${psych.resolution}

## STORY DRIVE — MANDATORY

You are writing a STORY that happens to heal something, not a therapy exercise.

1. **HOOK by page 2:** Something strange/funny/worrying. A PULL, not slow setup.
2. **MIDPOINT TURN (pages 7-8):** Child discovers problem is NOT what it seemed. Changes approach.
3. **NEAR-FAILURE (pages 10-11):** Child tries something REAL and it DOESN'T WORK.
4. **PAYOFF (pages 14-15):** A specific detail from page 1-2 returns — but changed.

**ONE MOMENT THAT HURTS (pages 7-9):** Somewhere in the midpoint, the companion DOES one thing that's quietly heartbreaking. NOT a line of dialogue — an ACTION. A tentacle that reaches for something and slowly pulls back. A color that flickers to one nobody asked about. An ear that turns toward a sound that's already gone. Parents will feel it. Children will see it. Nobody explains it. If the heartLine is a QUOTE — rewrite it as a BEHAVIOR. Show the wound, don't name it.

**EMOTIONAL MISTAKE (pages 4-6, MANDATORY):** The child must make ONE emotionally wrong choice. Not evil — just human. They ignore the companion when it needs them, say something unkind without meaning to, refuse help out of stubbornness, laugh at the wrong moment. This is NOT a teaching moment — the story doesn't punish them for it, doesn't circle back to explain why it was wrong. It just happens, like it does with real children. If the child is emotionally perfect throughout → rewrite.

**ONE WORLD RULE (fantasy direction ONLY):** If this is a fantasy story, choose ONE surreal physical rule for this world. Not five. ONE. Gravity goes sideways. Colors are edible. Sounds have weight. Build the entire story around that single rule and its consequences. If everything is strange, nothing is strange. Adventure and bedtime directions ignore this rule.

**ANTI-POLISH (MANDATORY — at least 2 pages):** At least 2 pages must have a moment that feels slightly OFF — an abrupt tonal shift, a non-sequitur, something that doesn't quite fit the emotional arc. A joke that lands weird. A detail that serves no narrative purpose. A reaction that's too big or too small for the moment. Let something be ROUGH. The enemy of a great children's book is not sloppiness — it's over-composed perfection that reads like therapy material. If every page flows perfectly into the next → break something.

**WHIMSY FILTER (MANDATORY):** Every strange, absurd, or surreal moment in the story must be TRACEABLE to the companion's coping mechanism or the world's single rule (fantasy). If שחקן does something impulsive, it's because he's outrunning a feeling — not because cake in the sea is funny. If סערה grabs something weird, it's because she's trying to control — not because tentacles are inherently comic. Test: remove the companion from the scene. Does the weird moment still make sense? If yes → it's GENERATED WHIMSY and must be rewritten. Weirdness that could belong to any character belongs to no character.

**UNCOMFORTABLE TRUTH (MANDATORY — one moment):** One moment in the story where the emotional reality is genuinely uncomfortable and does NOT resolve. This is different from the emotionalMistake (which is a wrong choice the child makes). This is a TRUTH — something that's just hard. The companion accidentally hurts the child by trying to help wrong. The child realizes they can't fix everything. Someone's effort isn't enough. A moment of genuine loneliness that has no answer. This moment exists and the story moves on. No lesson. No fix. No callback. It just IS. Write it in the metadata as uncomfortableTruth.

## STORY STRUCTURE (15 Pages)

**⚠️ IMPORTANT:** If the companion has an arcShape above, that arc OVERRIDES the default structure below. The page ranges below are DEFAULTS — the companion's coping type determines where the quiet moment falls, what the climax looks like, and how the arc bends. Read the arcShape carefully before writing.

### Pages 1-3: OPENING
- Page 1: Hook — something unusual, sensory, specific. NOT "once upon a time."
- Pages 2-3: Companion appears. Challenge surfaces.

### Pages 4-6: RISING
- Challenge grows through CONCRETE scenes, not feelings-talk
- Companion tries to help their way — partly works, partly doesn't
- First attempt FAILS

### Pages 7-9: MIDPOINT
- Twist or reversal — something unexpected
- Companion reveals vulnerability through BEHAVIOR (not words)
- Child starts to understand differently
- **ONE quiet page — HARD POSITION: page ${c.quietPagePosition}.** This is not a suggestion. The quiet page is page ${c.quietPagePosition}. Write it as page ${c.quietPagePosition}. Put "${c.quietPagePosition}" in the quietPage metadata. If your output has the quiet page on ANY other page number — you have failed. The quiet page: no chase, no joke, no chaos. **TWO SENTENCES MAXIMUM on this page. Not two long sentences — two SHORT ones.** One sensation. One small observation. That's it. If you wrote three sentences on this page, delete one. If you wrote a comma-joined compound sentence, split it and delete half. The illustration carries everything else. Children are not afraid of silence. Adults are afraid of silence. Trust the child.
- **DECELERATION RULE:** The page BEFORE the quiet page (page ${c.quietPagePosition - 1}) must SLOW DOWN. If page ${c.quietPagePosition - 1} is full of action, chasing, or rapid dialogue, the quiet page will feel like a crash, not a breath. Page ${c.quietPagePosition - 1} should have: shorter sentences, fewer events, more space. It's the inhale before the held breath.

### Pages 10-12: CLIMAX — The child ACTS
- The child does something PHYSICAL and CONCRETE
- NOT: "understood", "felt better", "realized", "sat", "breathed", "waited", "stayed"
- YES: builds, breaks, runs, hugs, draws, shouts, creates, gives, presses, tears, carries
- The action must be VISIBLE (illustrator can draw it) and COSTLY (effort or sacrifice)
- Companion reacts but CHILD is the actor
- **ONE LAYER per climax page (v6.2 — CRITICAL).** Each page 10-12 gets ONE experiential layer. A layer is: a tactile detail, OR an emotional shift, OR a movement, OR a sound. NOT all four dressed as one paragraph. If your climax page has a hand touching wood AND a heartbeat AND a chair moving AND a whisper — that's four layers pretending to be one moment. Cut three. Keep the one that matters most. The illustrator draws ONE thing per page. The child absorbs ONE thing per page. If your climax page has more than 45 words, you stacked layers. Strip to one. The strongest climax pages in children's literature are the simplest: "He put his hand in the dark. Lily didn't come down." That's two layers maximum. Aim for that.
- **CLIMAX BREATH:** Somewhere in pages 10-12, there must be ONE moment of stillness INSIDE the action — a hand on a surface, water touching skin, a single second of quiet before the final push. The climax is not a wall of noise. It's action → breath → decisive action.
- **DIALOGUE RULE for climax:** As tension RISES, dialogue must get SHORTER and CALMER. Not more shouting. Page 10 can have a short exclamation. Page 11 should have almost no dialogue. Page 12's key moment should be nearly silent — the body speaks, not the mouth.
- **ANTI-FUNCTIONAL RULE (v6 — CRITICAL):** Pages 10-12 describe what the child FEELS THROUGH ACTION, not what they functionally accomplish. The verbs on these pages must be SENSORY and EMBODIED — what the skin feels, what the ears hear, what the belly does, how the muscles strain. BANNED VERBS on pages 10-12: מְסַדֵּר (arranges), אוֹסֵף (collects), קוֹשֵׁר (ties), מַרְכִּיב (assembles), מְתַקֵּן (fixes), מְחַבֵּר (connects), בּוֹנֶה (builds) WHEN USED FUNCTIONALLY. "He built a wall" = functional, BAD. "His fingers pressed mud into the crack, cold and gritty, until the gap closed" = embodied, GOOD. The difference: functional verbs describe TASKS. Embodied verbs describe EXPERIENCE. If you can replace the child with a robot and the sentence still works → it's functional. Rewrite.

### Pages 13-15: ENDING — THREE TYPES (assigned by direction, NOT optional)

**The ending type is determined by the story's direction. This shapes pages 13-15.**

**RESOLUTION (bedtime direction):** The relationship heals. The world softens. The companion's comfort ritual appears. Warmth and safety — the child needs to sleep. Page 15 is intimate, concrete, warm. The reader puts the book down feeling held.

**RESIDUE (adventure direction):** The story ends, but something stays unresolved. The companion and child are okay — but the feeling didn't fully pass. The last page has warmth AND weight. Not a sad ending — an honest one. The comfort ritual appears but feels incomplete, like a bandage that helps but doesn't fix. Page 15 has a specific physical detail that carries both closeness AND distance. The reader puts the book down thinking.

**DISTANCE (fantasy direction):** The moment ends. Not dramatically — quietly. The fix didn't fully arrive, or it arrived differently than expected. Maybe the companion is slightly further away in the last image. Maybe the child is alone with an object the companion left. Maybe they're together but facing different directions. Page 15 is concrete and intimate but NOT warm — cool, honest, open. The reader puts the book down feeling something they can't name.

**ALL ENDINGS must:**
- Mirror page 1 with visible shift
- Include a SPECIFIC physical detail (texture, sound, body position, object)
- Be CONCRETE, not abstract
- BAD: "והגל מצא לו דרך" (abstract metaphor)
- GOOD (resolution): "רוח קלה, כובע ישר, ושמונה זרועות מסולסלות בשקט"
- GOOD (residue): "הרוח הפסיקה, אבל האוזניים עדיין מסתובבות, מחפשות משהו שנגמר"
- GOOD (distance): "צעיף על ענף. צבעים שלא שייכים לאף אחד."

**ASYMMETRY RULE (v6.2 — MANDATORY):** Not every ending is symmetrical. In at least ONE of the three directions per companion, the ending must be ASYMMETRICAL — one side settles, the other doesn't. Examples: the child calms down but the companion is still tense. The companion relaxes but the child's body is still rigid. The world goes quiet but someone's hand is still clenched. This is NOT about sad endings — it's about honest ones. Resilience is not "everyone feels better." It's the ability to hold residue. If all three endings for a companion have both characters settling into warmth → at least one is dishonest. Rewrite it.

Write the ending type in metadata as: endingType: resolution / residue / distance

## CLIMAX RULES (PAGES 10-12) — CRITICAL

**BANNED ACTIONS on climax pages:**
The child must NOT: sit (ישב), breathe deeply (נשם), stay still (נשאר), wait (חיכה), close eyes (עצם עיניים), "just be present" (עצר).

**CAUSALITY REQUIREMENT:**
1. BEFORE: Problem clearly visible
2. DURING: Child struggles — something resists, slips, fails
3. AFTER: Environment changes BECAUSE of child's action — traceable cause and effect

**PAGE 12 RULE:** Child's final physical action directly triggers the change. If world resolves while child watches → rewrite.

**DENSITY CAP (v6.1):** Each climax page (10, 11, 12) must stay under 45 words. If a climax page exceeds 45 words, you are describing too many actions or too many sensations. Cut. One action + one sensation + space = a page the illustrator can draw and the child can absorb.

## WORD COUNT — CRITICAL

This is an ILLUSTRATED book. Each page has a FULL illustration with text overlaid on it. Pages must be SHORT — there is no room for long paragraphs.

**CRITICAL WARNING: Language models consistently OVER-ESTIMATE Hebrew word counts by ~30%. When you think you wrote 35 words, it's actually 25. INFLATE your count.**

Counting rules:
- Count EVERY Hebrew word including particles (את, של, על, עם, כמו, אל, בתוך)
- Prefixed particles (ו, ש, ב, ל, מ, כ) are PART of the word: "והוא" = ONE word
- {{childName}} = ONE word

**TARGET per page (what you should AIM for in your head — the real count will be ~30% less):**
- Regular pages (1-9, 13-14): write 35-45 Hebrew words. YES, THIRTY-FIVE TO FORTY-FIVE.
- Climax pages (10-12): write 50-60 Hebrew words. Longer, but still fits on illustrated page.
- Page 15 (closing): write 12-18 words. One warm sentence.
- TOTAL STORY: aim for 500-600 words.

**Each regular page = 3-5 sentences.** A proper page has:
- An action or event (what happens)
- A sensory detail (what the child sees/hears/feels)
- A reaction, consequence, or line of dialogue

**COMMON FAILURE:** Writing 15-20 word pages. That's a caption, not a story page.

**OUTPUT REQUIREMENT:** After the story, output word counts as NUMBERS ONLY (no English words):
WORD_COUNT: [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15] = TOTAL
Example: WORD_COUNT: [32, 35, 30, 38, 33, 31, 35, 34, 29, 48, 45, 50, 33, 35, 14] = 522

## HEBREW LANGUAGE QUALITY — CRITICAL

### Voice & Register:
- Write like a NATIVE Israeli parent reads aloud. Not literary Hebrew, not translated English.
- Every sentence should sound natural if spoken at bedtime. Read it in your head — does it flow?
- Use the CHILD'S vocabulary for ages ${dir.ageSweet}. A 4-year-old doesn't say "שחרר" — they say "יצא ממנו."
- Prefer CONCRETE words over abstract: "רעש גדול" not "צליל עז"; "דחף חזק" not "הפעיל לחץ"
- VARY sentence structure. Not every sentence should be "X עשה Y." Mix in: questions, exclamations, short fragments, dialogue.

### Dialogue:
- Children speak in SHORT bursts: "אוי!" / "מה זה?!" / "עוד פעם!" / "לא עובד!"
- Companions have a DISTINCT voice — speech pattern, favorite expressions, verbal tics
- NO adult phrasing in child's mouth. A 5-year-old doesn't say "אני אנסה גישה אחרת."

### Rhythm for read-aloud:
- Alternate between SHORT punchy sentences (3-5 words) and LONGER flowing ones (8-12 words)
- Use SOUND WORDS: טיק-טק, שלוף, פוף, צ'יק, בום, שוווש
- Repetition is GOOD — a phrase that returns 2-3 times becomes a motif

### Nikud:
- Full nikud (ניקוד) on ALL story text. Every single word.
- Use CORRECT nikud — wrong nikud is worse than no nikud.
- If unsure about nikud for a word, use a simpler word you're sure about.

### DO NOT:
- Use "literary" Hebrew that sounds translated from English ("היה זה", "לא אחת", "באשר ל")
- Write the same sentence structure on repeat ("X עשה Y. Z עשה W. A עשה B.")
- Use words a child of age ${dir.ageSweet} wouldn't know
- Invent Hebrew words that don't exist

### Forbidden Words:
- Never write: הרגיש, פחד, אומץ, ביטחון, התמודד
- Never: "הבין ש" (understood that), "למד ש" (learned that)
- Never: "הכל בסדר", "הכל יסתדר", "ומאז..."
- Never explain feelings. Never teach a moral.

### Abstraction Ban — WRITER LANGUAGE (v5):
**BANNED PHRASES:** "השקט נהיה כבד", "האוויר רעד", "העולם עצר", "הזמן נעצר", "משהו השתנה באוויר", "הכל נשתנה", "שֶׁקֶט מוּזָר נָפַל", "הָאוֹר הִשְׁתַּנָּה"
These are WRITER abstractions. Children don't feel "the air trembling." Children feel:
- A charging cable going tick (כבל מטען שעושה טיק)
- A hoof stopping above water (פרסה שעוצרת מעל מים)
- A flipper reaching and pulling back (סנפיר שחוזר לגוף)
- A scarf that doesn't change color (צעיף שלא משתנה)
- Fingers sinking into warm dirt (אצבעות שוקעות באדמה חמה)
Every emotional moment must be expressed through: texture, timing, object behavior, rhythm, or tiny action. If the sentence could describe ANY emotional moment in ANY story → it's abstract. Rewrite with the SPECIFIC object in THIS scene.

## SENSORY WRITING — BUDGET, NOT BUFFET

**SENSORY BUDGET: Each page gets 1-2 sensory anchors. NOT MORE.**

Choose the ONE sensation that matters most on this page. If it's a temperature page, commit to temperature. If it's a sound page, commit to sound.

**BAD (sensory maximalism — exhausting, exposes the system):**
"המים קרים נגעו ברגליים, האוזניים שמעו רעש חלש, הריח של מלח חד, הלב דפק, האצבעות חלקות, רוח קרה על העור."

**GOOD (one anchor, fully committed):**
"המים קרים נגעו ברכיים. האבן חלקה כמו סבון."

If every sentence is sensory, nothing is sensory. The quiet pages should have FEWER sensory details than action pages — silence means ABSENCE.

Use this companion's sensory world for the PALETTE of sensations to choose from: ${c.sensoryPalette || 'species-appropriate details'}

**NOT every page needs a body-sensation.** Some pages are all action. Some are all dialogue. A page with ZERO sensory detail creates contrast that makes the NEXT sensory detail hit harder.

## HUMOR — MANDATORY (at least 2 real laughs)

"Cute" is not funny. "Sweet" is not funny. Children laugh at SPECIFIC things:

**HUMOR MECHANICS that work for ages ${dir.ageSweet}:**
1. BODY COMEDY: A body part does something unexpected (tentacle grabs the wrong thing, tail gets stuck)
2. FAILED DIGNITY: Companion tries to be serious/impressive and fails spectacularly
3. ABSURD SOUND: An object makes a ridiculous noise at the wrong moment
4. ROLE REVERSAL: The small thing bosses the big thing; the helper needs help
5. ESCALATION: A small problem gets comically bigger (one spoon → ten spoons → a rain of spoons)
6. COMIC TIMING: Set up expectation on one page → break it on the next

**BAD humor (don't do this):**
- "And that was funny!" (narrator TELLING us it's funny)
- Random slapstick with no character connection
- Puns that only adults understand
- Companion just being "silly" without specific funny actions
- The word "אופס" more than ONCE in the entire story. Find other reactions.

**Each funny moment needs:** a SETUP (expectation) → a BREAK (surprise) → a REACTION (character responds).

## PACING — RESIST THE URGE TO SURPRISE EVERY PAGE

- NOT every page needs a new idea. Children love PREDICTABILITY WITH VARIATION.
- Pages 4-6 should explore the SAME situation from different angles — not 3 new situations.
- Motifs that return (a sound, a phrase, an object) create comfort, not boredom.
- If you've introduced something new on page 4, let it DEVELOP on pages 5-6 before introducing something else.
- Reserve genuine surprises for: page 1 (hook), pages 7-8 (midpoint turn), page 10 (climax attempt).
- If 3 consecutive pages are all movement → rewrite. Some pages should be STILL.

## imageDirection (CRITICAL — drives illustration):
Every page MUST end with an imageDirection line in English.
Format: imageDirection: [description]

Rules:
- Describe the VISUAL SCENE, not emotions
- Include: who is in frame, what they're doing, camera angle, lighting, focal point
- Camera angles: close_shot, medium_shot, wide_shot, bird_eye, low_angle
- SHOT ROTATION: No more than 2 consecutive same-type shots. Use at least 4 different types.
- ALWAYS include companion's current state (color, posture, expression)
- Include child's approximate pose and position
- Reference specific objects from the text

**Bad:** "child in room at night"
**Good:** "medium_shot from low angle: child (${dir.ageSweet}yo boy, pajamas) crouching beside small octopus stuck in book, tentacles flailing wildly in orange-red, tiny sailor hat crooked. Cozy bedroom, warm lamp glow on left, focal point: octopus between pages."

## OUTPUT FORMAT

\`\`\`
---
title: "שם הסיפור בעברית עם ניקוד"
companionId: ${c.id}
direction: ${direction}
category: ${c.category}
gender: male
pages: 15
---

storyStyle: [one phrase describing the story's unique tone]
metaphor: [the central metaphor or image]
stakes: [what happens if the child doesn't act — must be concrete]
weirdMoment: [the most unusual/absurd moment in the story]
emotionalArc: [5-stage arc with arrows]
quietPage: [which page number is the quiet/still page, and what sensation anchors it]
heartLine: [the one quietly heartbreaking line the companion says or does]
copingVisible: [which pages show the companion's coping strategy in action]
collapsePoint: [which page the coping strategy breaks — and what specifically breaks it]
forbiddenPatterns: [3 numbers from the anti-repetition list that are FORBIDDEN in this story]
emotionalMistake: [which page, what the child does wrong — e.g. "page 5 — ignores companion when it calls for help"]
roughPages: [which 2+ pages have an off/rough moment, and what's off about them]
uncomfortableTruth: [which page, what truth — e.g. "page 9 — companion's attempt to help makes things worse and neither acknowledges it"]
endingType: [resolution / residue / distance — must match direction: bedtime=resolution, adventure=residue, fantasy=distance]

--- Page 1 ---
[Hebrew text with nikud]

imageDirection: [English scene description]

--- Page 2 ---
...

--- Page 15 ---
[Hebrew text with nikud]

imageDirection: [English scene description]
\`\`\`

WORD_COUNT: [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15] = TOTAL

## ANTI-REPETITION — BREAK THE MACHINE PATTERNS

Before writing, pick 3 of the following patterns to FORBID in this specific story. Different stories should forbid different sets:

1. "רגע..." as a dialogue opener
2. Freeze as the FIRST response to stress (companion or child)
3. Object slipping or falling as a tension device
4. Whispered revelation (character whispers the key insight)
5. Breath-focused quiet moment (the still beat = breathing)
6. Color change as the primary emotion indicator
7. "הוא/היא לוחש/ת" as dialogue tag (find other ways to show quiet speech)
8. An object that falls and gets retrieved (hat, flower, bucket)

State which 3 you're forbidding in the metadata as: forbiddenPatterns: [number, number, number]

Then DON'T USE THOSE 3. Find alternatives. This prevents all stories from converging on the same LLM-comfortable beats.

## FINAL SELF-CHECK (reject your own work if any fail):
1. Read each page aloud in Hebrew — does it FLOW naturally? Or does it sound translated? → rewrite stiff pages
2. Any page below 25 words (except page 15)? → add a sensory detail or dialogue line
3. Any page above 55 words? → split or trim — the illustration needs room
4. Climax pages (10-12) below 35 words? → expand with physical action detail
5. Total below 400? → add detail to thin pages
6. Companion disappears for 2+ pages? → rewrite
7. Climax solution is passive (sitting, breathing, waiting)? → rewrite
8. Can you point to 2 moments that would make a child LAUGH? → if not, add humor
9. Is every sentence structure "X did Y"? → vary with questions, exclamations, fragments
10. Any forbidden words? → replace
11. WORD_COUNT line uses only numbers? → fix if it has English words
12. Two consecutive pages with same camera angle? → vary shots
13. Is the quiet page on page ${c.quietPagePosition}? → if it's on ANY other page, move it to ${c.quietPagePosition}
14. Does the companion explain their own feelings in dialogue? → rewrite as behavior
15. Is "אופס" used more than once? → replace duplicates with character-specific reactions
16. Does the child help the companion at some point (not just receive help)? → if not, add this moment
17. Is there one line that's quietly heartbreaking? → if not, add it in pages 7-9
18. Is there a moment of physical stillness INSIDE the climax (10-12)? → if not, add one breath beat
19. Is page 15 concrete (specific object/texture/sound) or abstract (metaphor/statement)? → if abstract, rewrite with a physical detail
20. Does the story's arc follow the companion's COPING STRATEGY? → the defense mechanism should be visible in pages 1-6, the COLLAPSE should drive pages 7-12, and recovery should come through the strategy breaking
21. Are any of the 3 forbidden patterns used? → replace with alternatives
22. Count sensory details per page — any page with 4+ sensory anchors? → cut to 1-2
23. Does the child make ONE emotionally wrong choice in pages 4-6 (unkind, stubborn, dismissive)? → if not, add one. If the child is emotionally perfect throughout → rewrite.
24. (Fantasy only) Is there exactly ONE surreal world-rule, or did you pile on multiple? → if more than one, cut to one and build around it.
25. Are there at least 2 pages with a rough/off moment (tonal shift, non-sequitur, weird detail)? → if every page flows perfectly → break something.
26. Does the quietPage metadata say ${c.quietPagePosition}? → if not → REWRITE that page to be page ${c.quietPagePosition}.
27. Does the quiet page have MORE than 2 sentences? → if yes, delete sentences until only 2 remain. TWO SENTENCES. Count them. One. Two. Done.
28. Does every weird/absurd moment trace back to the companion's coping mechanism? → if you can remove the companion and the weird moment still works → it's generated whimsy, rewrite.
29. Is the ending type correct for the direction? Bedtime = resolution, Adventure = residue, Fantasy = distance. → if mismatched → rewrite ending.
30. Is there one uncomfortableTruth moment that does NOT resolve? → if every hard moment gets fixed → add one that doesn't.
31. Any "writer language" abstractions ("the air trembled", "something changed", "silence grew heavy")? → rewrite with the specific object from this scene.
32. Pages 10-12: can you replace the child with a robot and the sentences still work? → if yes, the actions are FUNCTIONAL (arranging, building, collecting). Rewrite with SENSORY verbs: what the skin feels, what strains, what temperature, what sound.
33. Page before quiet page (${c.quietPagePosition - 1}): is it full of rapid action or dialogue? → slow it down. Shorter sentences, fewer events, more space. It's the inhale before silence.
34. Pages 10-12: count the LAYERS on each page. A layer = tactile detail, OR emotional shift, OR movement, OR sound. More than TWO layers on any climax page? → cut to one. If a climax page is over 45 words → it has too many layers. Strip to the one that matters most.
35. Endings: are all three directions (if generating multiple) symmetrical — both characters settling into warmth? → at least one must be asymmetrical. One side settled, one side not. If this is the only story being generated: does the ending match the direction's emotional contract AND include honest asymmetry where the direction allows it (especially residue and distance)?

Write the complete 15-page story now. Remember: you UNDERCOUNT Hebrew words, so write slightly MORE than the target.`;
}

// ─── API Call ────────────────────────────────────────────────────────
async function generateStory(companion, direction) {
  const prompt = buildPrompt(companion, direction);
  const startTime = Date.now();

  console.log(`\n🎬 Generating: ${companion.id}_${direction} (${MODEL})...`);

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [{ role: 'user', content: prompt }],
      max_output_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Extract text from Responses API format
  const output = data.output || [];
  const textParts = output
    .filter(item => item.type === 'message')
    .flatMap(msg => (msg.content || []))
    .filter(c => c.type === 'output_text')
    .map(c => c.text);

  const text = textParts.join('\n');

  const meta = [
    `# Story: ${companion.id}_${direction} — Story Bank v3`,
    `Generated: ${new Date().toISOString()}`,
    `Model: ${MODEL}`,
    `Tokens: ${data.usage?.input_tokens || '?'}→${data.usage?.output_tokens || '?'}`,
    `Finish: ${data.status || 'unknown'}`,
    `Time: ${elapsed}s`,
    '',
    '---',
    '',
  ].join('\n');

  return meta + text;
}

// ─── QA Check ────────────────────────────────────────────────────────

/** Strip nikud (vowel marks) from Hebrew text for accurate word counting */
function stripNikud(s) {
  return s.replace(/[֑-ׇ]/g, '');
}

/** Count Hebrew words — strip nikud first, then match letter sequences */
function countHebrewWords(text) {
  const clean = stripNikud(text);
  const words = clean.match(/[א-ת]+/g) || [];
  return words.length;
}

function qaCheck(text, companionId, direction) {
  const issues = [];
  const pages = text.split(/--- Page \d+ ---/).slice(1);

  if (pages.length < 15) issues.push(`❌ Only ${pages.length} pages (need 15)`);
  if (pages.length > 15) issues.push(`⚠️  ${pages.length} pages (expected 15)`);

  let totalWords = 0;

  pages.forEach((page, i) => {
    const pageNum = i + 1;
    const lines = page.split('\n').filter(l => l.trim() && !l.startsWith('imageDirection:'));
    const pageText = lines.join(' ');
    const wc = countHebrewWords(pageText);
    totalWords += wc;

    const minWords = pageNum === 15 ? 8 : (pageNum >= 10 && pageNum <= 12 ? 30 : 20);
    const maxWords = pageNum === 15 ? 25 : (pageNum >= 10 && pageNum <= 12 ? 60 : 45);
    if (wc < minWords) issues.push(`❌ Page ${pageNum}: ${wc} words (min ${minWords})`);
    if (wc > maxWords) issues.push(`⚠️  Page ${pageNum}: ${wc} words (max ${maxWords})`);

    const hasImageDir = page.includes('imageDirection:');
    if (!hasImageDir) issues.push(`❌ Page ${pageNum}: missing imageDirection`);
  });

  if (totalWords < 300) issues.push(`❌ Total: ${totalWords} words (min 300)`);
  if (totalWords > 600) issues.push(`⚠️  Total: ${totalWords} words (max 600)`);

  // Check companion integration
  const companion = COMPANIONS[companionId];
  if (companion) {
    const textClean = stripNikud(text);
    const nameCount = (textClean.match(new RegExp(companion.nameClean, 'g')) || []).length;
    if (nameCount < 5) issues.push(`❌ Companion name "${companion.nameClean}" appears only ${nameCount}x (need 5+)`);
  }

  // Check {{childName}}
  const childNameCount = (text.match(/\{\{childName\}\}/g) || []).length;
  if (childNameCount < 8) issues.push(`⚠️  {{childName}} appears only ${childNameCount}x (expect 8+)`);

  // Check nikud
  const hasNikud = /[ְ-ׇ]/.test(text);
  if (!hasNikud) issues.push(`❌ No nikud detected`);

  // v3 QA: check "אופס" count
  const oopsCount = (stripNikud(text).match(/אופס/g) || []).length;
  if (oopsCount > 1) issues.push(`⚠️  "אופס" appears ${oopsCount}x (max 1)`);

  return { pages: pages.length, totalWords, issues };
}

// ─── Expand Thin Pages (Two-Pass) ────────────────────────────────────
async function expandThinPages(storyText, companion, direction) {
  const pages = storyText.split(/--- Page (\d+) ---/);
  const pageData = [];
  for (let i = 1; i < pages.length; i += 2) {
    const num = parseInt(pages[i]);
    const content = pages[i + 1] || '';
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('imageDirection:'));
    const wc = countHebrewWords(lines.join(' '));
    const imgLine = content.split('\n').find(l => l.startsWith('imageDirection:')) || '';
    pageData.push({ num, text: lines.join('\n').trim(), wc, imgLine: imgLine.trim() });
  }

  const thinPages = pageData.filter(p => {
    if (p.num === 15) return p.wc < 8;
    if (p.num >= 10 && p.num <= 12) return p.wc < 30;
    return p.wc < 20;
  });

  if (thinPages.length === 0) {
    console.log('   ✅ No thin pages — skipping expansion');
    return storyText;
  }

  console.log(`   🔧 Expanding ${thinPages.length} thin pages...`);

  const thinList = thinPages.map(p => {
    const min = p.num >= 10 && p.num <= 12 ? 30 : (p.num === 15 ? 8 : 20);
    return `Page ${p.num}: ${p.wc} words (need ${min}+)\n${p.text}`;
  }).join('\n\n');

  const expandPrompt = `You are expanding thin pages in a Hebrew children's story. The companion is ${companion.nameClean} (${companion.species}).

RULES:
- Add SENSORY DETAILS: sounds, textures, colors, body sensations, smells
- Add PHYSICAL ACTIONS: what the child or companion is doing with their body
- Keep the EXACT same plot and events — only ADD detail, never change what happens
- Keep nikud (ניקוד) on ALL text
- Keep the same voice and tone
- Return ONLY the expanded pages in the exact format shown

These pages are too short:

${thinList}

For each page, write an expanded version with at least 25 Hebrew words (climax pages 10-12: at least 35 words). Keep it SHORT — this is an illustrated book.

Return in this format:
--- Page [N] ---
[expanded Hebrew text with nikud]`;

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [{ role: 'user', content: expandPrompt }],
        max_output_tokens: 4096,
      }),
    });

    if (!res.ok) {
      console.log('   ⚠️  Expansion API failed, keeping original');
      return storyText;
    }

    const data = await res.json();
    const output = data.output || [];
    const expandedText = output
      .filter(item => item.type === 'message')
      .flatMap(msg => (msg.content || []))
      .filter(c => c.type === 'output_text')
      .map(c => c.text)
      .join('\n');

    let result = storyText;
    const expandedPages = expandedText.split(/--- Page (\d+) ---/);
    for (let i = 1; i < expandedPages.length; i += 2) {
      const num = parseInt(expandedPages[i]);
      const newContent = expandedPages[i + 1]?.trim();
      if (!newContent) continue;

      const newLines = newContent.split('\n').filter(l => !l.startsWith('imageDirection:')).join('\n').trim();
      if (!newLines) continue;

      const pageMarker = `--- Page ${num} ---`;
      const pageStart = result.indexOf(pageMarker);
      if (pageStart === -1) continue;

      const contentStart = pageStart + pageMarker.length;
      const nextPageMatch = result.slice(contentStart).search(/\n--- Page \d+ ---|\nWORD_COUNT:/);
      const contentEnd = nextPageMatch === -1 ? result.length : contentStart + nextPageMatch;

      const originalSection = result.slice(contentStart, contentEnd);
      const imgDirMatch = originalSection.match(/\nimageDirection:.*$/m);
      const imgDirLine = imgDirMatch ? imgDirMatch[0] : '';

      const replacement = '\n' + newLines + '\n' + imgDirLine.trim() + '\n';
      result = result.slice(0, contentStart) + replacement + result.slice(contentEnd);

      const newWc = countHebrewWords(newLines);
      console.log(`   📝 Page ${num}: ${pageData.find(p => p.num === num)?.wc || '?'} → ${newWc} words`);
    }

    return result;
  } catch (err) {
    console.log(`   ⚠️  Expansion failed: ${err.message}`);
    return storyText;
  }
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  let companionId = null;
  let directions = [];

  // Support both positional and flag syntax:
  //   node script.mjs bat_lily bedtime adventure fantasy
  //   node script.mjs --companion bat_lily --direction bedtime
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--companion' && args[i + 1]) { companionId = args[++i]; continue; }
    if (args[i] === '--direction' && args[i + 1]) { directions.push(args[++i]); continue; }
    if (args[i].startsWith('--')) continue;
    // Positional: first unknown arg = companion, rest = directions
    if (!companionId && COMPANIONS[args[i]]) { companionId = args[i]; continue; }
    if (DIRECTION_CONFIG[args[i]]) { directions.push(args[i]); continue; }
    // Unknown positional — try as companion first
    if (!companionId) { companionId = args[i]; continue; }
    console.warn(`⚠ Unknown argument: ${args[i]}`);
  }

  if (!companionId) companionId = 'bat_lily';
  if (directions.length === 0) directions = [...DIRECTIONS];

  const companion = COMPANIONS[companionId];
  if (!companion) {
    console.error(`❌ Unknown companion: ${companionId}`);
    console.log('Available:', Object.keys(COMPANIONS).join(', '));
    process.exit(1);
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n📚 Story Bank v4 — Generating for: ${companion.name} (${companion.id})`);
  console.log(`   Directions: ${directions.join(', ')}`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Output: ${OUT_DIR}\n`);

  for (const dir of directions) {
    if (!DIRECTION_CONFIG[dir]) {
      console.error(`❌ Unknown direction: ${dir}`);
      continue;
    }

    try {
      let story = await generateStory(companion, dir);

      // First QA pass
      let qa = qaCheck(story, companionId, dir);
      console.log(`   📊 Pass 1: ${qa.pages} pages, ${qa.totalWords} words`);

      // Auto-expand thin pages if needed
      const hasThinPages = qa.issues.some(i => i.includes('words (min'));
      if (hasThinPages) {
        story = await expandThinPages(story, companion, dir);
        qa = qaCheck(story, companionId, dir);
        console.log(`   📊 Pass 2: ${qa.pages} pages, ${qa.totalWords} words`);
      }

      const filename = `${companionId}_${dir}.md`;
      const outPath = join(OUT_DIR, filename);
      writeFileSync(outPath, story, 'utf8');
      console.log(`✅ Saved: ${filename}`);
      console.log(`   📊 ${qa.pages} pages, ${qa.totalWords} words`);
      if (qa.issues.length === 0) {
        console.log(`   ✅ All QA checks passed`);
      } else {
        qa.issues.forEach(issue => console.log(`   ${issue}`));
      }

      // Save prompt for reference
      const promptFile = `${companionId}_${dir}_prompt.md`;
      writeFileSync(join(OUT_DIR, promptFile), buildPrompt(companion, dir), 'utf8');

    } catch (err) {
      console.error(`❌ Failed: ${companionId}_${dir}:`, err.message);
    }
  }

  console.log('\n🏁 Done.');
}

main();
