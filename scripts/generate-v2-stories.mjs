#!/usr/bin/env node
/**
 * generate-v2-stories.mjs — Story Bank v2 generation script
 *
 * Generates companion-specific stories using GPT-5.3 Pro via OpenAI Responses API.
 * Each story is written FOR a specific companion with their identity hardcoded.
 *
 * Usage:
 *   node scripts/generate-v2-stories.mjs
 *   node scripts/generate-v2-stories.mjs --companion octopus_seara --direction bedtime
 *   node scripts/generate-v2-stories.mjs --companion octopus_seara  (all 3 directions)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ─── Config ──────────────────────────────────────────────────────────
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error('❌ Set OPENAI_API_KEY'); process.exit(1); }

const MODEL = 'gpt-5.3-chat-latest';
const OUT_DIR = join(process.cwd(), 'story-bank', 'v2');
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

// ─── Master Prompt ───────────────────────────────────────────────────
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

### Stress response (the companion\'s signature "meltdown"):
${c.stressResponse || 'Overwhelm shows through physical chaos'}

### Internal rules (character consistency — things they ALWAYS or NEVER do):
${(c.internalRules || []).map(r => '- ' + r).join('\n')}

### COMPANION INTEGRATION RULES (CRITICAL):
1. ${c.nameClean} must BEHAVE like a ${c.species} — use species-specific PHYSICAL actions (not just dialogue)
2. The companion's BODY, ABILITIES, and WEAKNESSES drive plot points
3. At least 3 scenes must feature the companion doing something ONLY their species can do
4. At least 2 scenes must show a WEAKNESS or FAILURE — this is where humor lives
5. Companion MUST speak or act on pages 10-12 (climax). They don't solve it but they react.
6. If companion disappears for more than 2 consecutive pages → rewrite
7. Dialogue must match the speech pattern above — NOT generic "wise mentor" talk

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

**INTEREST RULE:** Every 2-3 pages, introduce ONE new element (discovery, complication, funny reversal, world rule, small failure). If 3 pages pass with no new element → rewrite.

## STORY STRUCTURE (15 Pages)

### Pages 1-3: OPENING
- Page 1: Hook — something unusual, sensory, specific. NOT "once upon a time."
- Pages 2-3: Companion appears. Challenge surfaces.

### Pages 4-6: RISING
- Challenge grows through CONCRETE scenes, not feelings-talk
- Companion tries to help their way — partly works, partly doesn't
- First attempt FAILS

### Pages 7-9: MIDPOINT
- Twist or reversal — something unexpected
- Companion reveals vulnerability or similar struggle
- Child starts to understand differently

### Pages 10-12: CLIMAX — The child ACTS
- The child does something PHYSICAL and CONCRETE
- NOT: "understood", "felt better", "realized", "sat", "breathed", "waited", "stayed"
- YES: builds, breaks, runs, hugs, draws, shouts, creates, gives, presses, tears, carries
- The action must be VISIBLE (illustrator can draw it) and COSTLY (effort or sacrifice)
- Companion reacts but CHILD is the actor

### Pages 13-14: RESOLUTION
- Emotional shift SHOWN through behavior, not stated
- Small humor beat or callback to page 1
- NO moralizing. No "and he learned that..."

### Page 15: CLOSING
- Single warm sentence. Sensory. Child is at peace. Mirrors page 1 with visible shift.

## CLIMAX RULES (PAGES 10-12) — CRITICAL

**BANNED ACTIONS on climax pages:**
The child must NOT: sit (ישב), breathe deeply (נשם), stay still (נשאר), wait (חיכה), close eyes (עצם עיניים), "just be present" (עצר).

**CAUSALITY REQUIREMENT:**
1. BEFORE: Problem clearly visible
2. DURING: Child struggles — something resists, slips, fails
3. AFTER: Environment changes BECAUSE of child's action — traceable cause and effect

**PAGE 12 RULE:** Child's final physical action directly triggers the change. If world resolves while child watches → rewrite.

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

**Each funny moment needs:** a SETUP (expectation) → a BREAK (surprise) → a REACTION (character responds).

## PACING
- NOT every page increases motion — some increase MEANING
- Story needs breathing: action → pause → understanding → new action
- If 3 consecutive pages are all movement → rewrite

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
    `# Story: ${companion.id}_${direction} — Story Bank v2`,
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
  // Remove all Hebrew combining marks (nikud, cantillation, etc.)
  return s.replace(/[\u0591-\u05C7]/g, '');
}

/** Count Hebrew words — strip nikud first, then match letter sequences */
function countHebrewWords(text) {
  const clean = stripNikud(text);
  const words = clean.match(/[\u05D0-\u05EA]+/g) || [];
  return words.length;
}

function qaCheck(text, companionId, direction) {
  const issues = [];
  const pages = text.split(/--- Page \d+ ---/).slice(1);

  if (pages.length < 15) issues.push(`\u274C Only ${pages.length} pages (need 15)`);
  if (pages.length > 15) issues.push(`\u26A0\uFE0F  ${pages.length} pages (expected 15)`);

  let totalWords = 0;

  pages.forEach((page, i) => {
    const pageNum = i + 1;
    const lines = page.split('\n').filter(l => l.trim() && !l.startsWith('imageDirection:'));
    const pageText = lines.join(' ');
    const wc = countHebrewWords(pageText);
    totalWords += wc;

    // Word count thresholds \u2014 calibrated for illustrated pages
    const minWords = pageNum === 15 ? 8 : (pageNum >= 10 && pageNum <= 12 ? 30 : 20);
    const maxWords = pageNum === 15 ? 25 : (pageNum >= 10 && pageNum <= 12 ? 60 : 45);
    if (wc < minWords) issues.push(`\u274C Page ${pageNum}: ${wc} words (min ${minWords})`);
    if (wc > maxWords) issues.push(`\u26A0\uFE0F  Page ${pageNum}: ${wc} words (max ${maxWords})`);


    const hasImageDir = page.includes('imageDirection:');
    if (!hasImageDir) issues.push(`\u274C Page ${pageNum}: missing imageDirection`);
  });

  if (totalWords < 300) issues.push(`\u274C Total: ${totalWords} words (min 300)`);
  if (totalWords > 600) issues.push(`\u26A0\uFE0F  Total: ${totalWords} words (max 600)`);

  // Check companion integration — nikud-aware
  const companion = COMPANIONS[companionId];
  if (companion) {
    const textClean = stripNikud(text);
    const nameCount = (textClean.match(new RegExp(companion.nameClean, 'g')) || []).length;
    if (nameCount < 5) issues.push(`\u274C Companion name "${companion.nameClean}" appears only ${nameCount}x (need 5+)`);
  }

  // Check {{childName}}
  const childNameCount = (text.match(/\{\{childName\}\}/g) || []).length;
  if (childNameCount < 8) issues.push(`\u26A0\uFE0F  {{childName}} appears only ${childNameCount}x (expect 8+)`);

  // Check nikud
  const hasNikud = /[\u05B0-\u05C7]/.test(text);
  if (!hasNikud) issues.push(`\u274C No nikud detected`);

  return { pages: pages.length, totalWords, issues };
}

// ─── Expand Thin Pages (Two-Pass) ────────────────────────────────────
async function expandThinPages(storyText, companion, direction) {
  // Parse pages and find thin ones
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

    // Parse expanded pages and splice back using page markers (robust)
    let result = storyText;
    const expandedPages = expandedText.split(/--- Page (\d+) ---/);
    for (let i = 1; i < expandedPages.length; i += 2) {
      const num = parseInt(expandedPages[i]);
      const newContent = expandedPages[i + 1]?.trim();
      if (!newContent) continue;

      // Remove imageDirection from expanded content (we keep the original)
      const newLines = newContent.split('\n').filter(l => !l.startsWith('imageDirection:')).join('\n').trim();
      if (!newLines) continue;

      // Find page boundaries in the result using markers
      const pageMarker = `--- Page ${num} ---`;
      const pageStart = result.indexOf(pageMarker);
      if (pageStart === -1) continue;

      const contentStart = pageStart + pageMarker.length;
      // Find next page marker or WORD_COUNT or end of string
      const nextPageMatch = result.slice(contentStart).search(/\n--- Page \d+ ---|\nWORD_COUNT:/);
      const contentEnd = nextPageMatch === -1 ? result.length : contentStart + nextPageMatch;

      // Extract original section and preserve imageDirection line
      const originalSection = result.slice(contentStart, contentEnd);
      const imgDirMatch = originalSection.match(/\nimageDirection:.*$/m);
      const imgDirLine = imgDirMatch ? imgDirMatch[0] : '';

      // Replace: newline + new text + imageDirection
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
  let companionId = 'octopus_seara';
  let directions = [...DIRECTIONS];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--companion' && args[i + 1]) companionId = args[++i];
    if (args[i] === '--direction' && args[i + 1]) directions = [args[++i]];
  }

  const companion = COMPANIONS[companionId];
  if (!companion) {
    console.error(`❌ Unknown companion: ${companionId}`);
    console.log('Available:', Object.keys(COMPANIONS).join(', '));
    process.exit(1);
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n📚 Story Bank v2 — Generating for: ${companion.name} (${companion.id})`);
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
