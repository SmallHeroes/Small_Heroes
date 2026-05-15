#!/usr/bin/env node
/**
 * generate-v5-stories.mjs — Hybrid Two-Stage Pipeline
 *
 * Per consultant brief feedback, v5 abandons the one-shot architecture in favor of
 * separation-of-concerns:
 *
 *   STAGE 1 (GPT-5)  — Story skeleton (structure only, no Hebrew prose)
 *   STAGE 2 (Claude) — Hebrew-native prose from skeleton
 *
 * Why this works (vs v4.3 one-shot):
 *   - Each LLM has ONE job — no overload
 *   - Claude is more "literary native" for Hebrew prose
 *   - GPT-5 handles structured planning better
 *   - English-thinking-then-translating contamination removed:
 *     skeleton is in JSON (language-neutral), prose is generated fresh in Hebrew
 *
 * v5 deliberately:
 *   - DROPS the 5,500-token v4 master prompt
 *   - DROPS the polish pass (papers over real issues)
 *   - DROPS the negation blacklist style (LLMs bad at "don't")
 *   - ADDS hard templates instead of negation rules
 *   - ADDS "exhausted parent" read-aloud framing
 *
 * Output: story-bank/v5/<companion>_<direction>.md
 *
 * Usage:
 *   OPENAI_API_KEY=... ANTHROPIC_API_KEY=... node scripts/generate-v5-stories.mjs --calibration-set
 *   node scripts/generate-v5-stories.mjs --companion chameleon_koko --direction bedtime
 *   node scripts/generate-v5-stories.mjs --all
 *
 * Required env:
 *   OPENAI_API_KEY      — for Stage 1 (GPT-5 skeleton)
 *   ANTHROPIC_API_KEY   — for Stage 2 (Claude prose)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!OPENAI_KEY) { console.error('❌ Set OPENAI_API_KEY (Stage 1)'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('❌ Set ANTHROPIC_API_KEY (Stage 2)'); process.exit(1); }

// Stage 1: Use a fast non-reasoning model for skeleton planning.
//   gpt-5.3-chat-latest — capable, fast, and (per user's prod experience) more advanced
//   than gpt-5-chat-latest despite the version naming. Same API surface as 5-chat.
//   Override via SKELETON_MODEL=... if you want a different one.
const SKELETON_MODEL = process.env.SKELETON_MODEL || 'gpt-5.3-chat-latest';
const SKELETON_MAX_TOKENS = parseInt(process.env.SKELETON_MAX_TOKENS || '8192', 10);
const PROSE_MODEL = process.env.PROSE_MODEL || 'claude-sonnet-4-5-20250929';
// Hebrew with nikud tokenizes heavily (~5-10 tokens/word). Fantasy 20 pages × 50w avg = 8-10K tokens.
// Set generous default to avoid truncation. Override via env if needed.
const PROSE_MAX_TOKENS = parseInt(process.env.PROSE_MAX_TOKENS || '16384', 10);
const OUT_DIR = join(process.cwd(), 'story-bank', 'v5');
const SKELETON_DIR = join(process.cwd(), 'story-bank', 'v5-skeletons');
const DIRECTIONS = ['bedtime', 'adventure', 'fantasy'];
const CALIBRATION_SET = ['chameleon_koko', 'owl_chacham', 'dragon_dini'];

import { DEEP_COMPANIONS } from '../briefs/companion-deep-profiles.mjs';
const COMPANIONS = DEEP_COMPANIONS;

// ─── Direction Configs (aligned with editor's recommendation: 15-35/25-55/35-70 per page) ──
const DIRECTION_CONFIG = {
  bedtime: {
    hebrew: 'סיפור לפני השינה',
    ageSweet: '3-4',
    pages: 10,
    pageRanges: { opening: [1, 2], rising: [3, 4], midpoint: [5, 6], climax: [7, 8], ending: [9, 10] },
    quietPageDefault: 7,
    quietPageRange: [6, 8],
    // v5.2.1: Lowered totalMin from 150 to 130. dragon_dini_bedtime came out at 147w with strong quality.
    wordsPerPage: '13-32',
    totalMin: 130, totalMax: 350,
    endingType: 'resolution',
    endingRule: 'הקומפניון והילד פיזית קרובים. הטקס הנחמה של הקומפניון מופיע. תמונה אינטימית, חמה, גוף נוגע גוף, מנומנם.',
  },
  adventure: {
    hebrew: 'הרפתקה',
    ageSweet: '5-6',
    pages: 15,
    pageRanges: { opening: [1, 3], rising: [4, 6], midpoint: [7, 9], climax: [10, 12], ending: [13, 15] },
    quietPageDefault: 11,
    quietPageRange: [10, 12],
    // v5.2.1: Lowered totalMin from 375 to 280. v5.2 produced 281-336w adventures with strong quality.
    // Restraint > word inflation. If the model wants tight, let it.
    wordsPerPage: '20-50',
    totalMin: 280, totalMax: 825,
    endingType: 'residue',
    endingRule: 'היצור הפגיע עף/השתחרר — לא מוחזק. חלק קטן מהקומפניון נשאר בנוף (נוצה, קשקש, סימן). הקומפניון והילד קרובים אבל לא מחובקים. תמונה כנה — חם וכובד יחד.',
  },
  fantasy: {
    hebrew: 'סיפור פנטזיה',
    ageSweet: '7-9',
    pages: 20,
    pageRanges: { opening: [1, 4], rising: [5, 8], midpoint: [9, 12], climax: [14, 16], ending: [17, 20] },
    quietPageDefault: 13,
    quietPageRange: [12, 15],
    // v5.2 reduction per consultant feedback: fantasy was 35-70/page = 700-1400 total → too philosophical.
    // True child fantasy (Miyazaki-style) is concrete, physical, visual — shorter is better.
    // v5.2.1: Lowered totalMin from 500 to 400. Calibration showed 430w stories are tight & complete.
    // Consultant recommended 450-650; Claude consistently produces ~430-570. 400 is a safe floor.
    wordsPerPage: '22-40',
    totalMin: 400, totalMax: 700,
    endingType: 'distance',
    endingRule: 'חוק העולם לא מתבטל לחלוטין. עקבה נשארת. הקומפניון מעט רחוק יותר. הילד לבד עם חפץ. תמונה צוננת, פתוחה — לא חמה.',
  },
};

function resolveQuietPage(companion, dir) {
  const profilePos = parseInt(companion.quietPagePosition || dir.quietPageDefault, 10);
  const scaled = Math.round(profilePos * (dir.pages / 15));
  const [min, max] = dir.quietPageRange;
  return Math.max(min, Math.min(max, scaled));
}

function extractWorldRule(companion) {
  const rules = companion.internalRules || [];
  const fantasyRule = rules.find(r => /^FANTASY:/i.test(r));
  return fantasyRule ? fantasyRule.replace(/^FANTASY:\s*/i, '').trim() : null;
}

function extractAdventureRule(companion) {
  const rules = companion.internalRules || [];
  const advRule = rules.find(r => /^ADVENTURE:/i.test(r));
  return advRule ? advRule.replace(/^ADVENTURE:\s*/i, '').trim() : null;
}

// Retry wrapper for transient network failures (timeouts, ECONNRESET, etc.)
// Reasoning models can take 4+ minutes, sometimes connections drop.
async function fetchWithRetry(url, options, label, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Use AbortController to give the call a long but bounded timeout (8 min)
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort('timeout'), 8 * 60 * 1000);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        return res;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastErr = err;
      const isLast = attempt === maxAttempts;
      const msg = err.message || String(err);
      if (isLast) {
        throw new Error(`${label} failed after ${maxAttempts} attempts: ${msg}`);
      }
      const delaySec = attempt * 5;
      console.log(`   ⚠️  ${label} attempt ${attempt} failed (${msg}). Retry in ${delaySec}s...`);
      await new Promise(r => setTimeout(r, delaySec * 1000));
    }
  }
  throw lastErr;
}

// ─── STAGE 1: SKELETON (GPT-5) ─────────────────────────────────────────
function buildSkeletonPrompt(companion, direction) {
  const dir = DIRECTION_CONFIG[direction];
  const c = companion;
  const psych = c.psychologicalContext;
  const PAGES = dir.pages;
  const QUIET = resolveQuietPage(c, dir);
  const PR = dir.pageRanges;
  const worldRule = extractWorldRule(c);
  const advRule = extractAdventureRule(c);

  return `You are a children's story architect. NOT a writer. Your job is to design the SKELETON of the story — beats, structure, emotional movements. NOT prose.

Output: JSON only. No Hebrew prose inside the beats. Beats are in English, brief (one sentence per page).

# COMPANION
ID: ${c.id}
Name (Hebrew): ${c.nameClean}
Species: ${c.species}
Gender: ${c.gender}
Personality: ${c.personality}
Speech pattern: ${c.speechPattern}
Body language: ${c.bodyLanguage || 'expressive species-appropriate body language'}
Stress response: ${c.stressResponse || 'physical signs of overwhelm'}
Comfort ritual: ${c.comfortRitual || 'small repeated physical gesture'}

Coping strategy: ${c.copingStrategy || 'default overwhelm-then-recovery'}
Collapse pattern: ${c.collapsePattern || 'overwhelm beyond capacity'}
Arc shape: ${c.arcShape || 'follow default page structure'}

Internal rules (must respect): ${(c.internalRules || []).filter(r => !/^(FANTASY|ADVENTURE|BEDTIME):/i.test(r)).join(' | ')}

# DIRECTION
Direction: ${direction}
Pages: ${PAGES} (exactly)
Age target: ${dir.ageSweet}
Ending type: ${dir.endingType}
Ending rule: ${dir.endingRule}
Quiet page MUST be page: ${QUIET}

# PSYCHOLOGICAL CHALLENGE
Category: ${c.category}
Core need: ${psych.coreNeed}
Avoid: ${psych.avoid.join(' | ')}
Resolution direction: ${psych.resolution}

${direction === 'fantasy' && worldRule ? `# FANTASY WORLD RULE (REQUIRED — use exactly this, no other rule)
worldRule: ${worldRule}

This is the SINGLE surreal rule of this story. NOT "sky goes sideways" — THIS specific rule.
The child encounters this rule 3+ times across the story.
The world-rule does NOT fully reverse at the end (it's "distance" ending).
` : ''}${direction === 'adventure' && advRule ? `# ADVENTURE ENDING HINT
${advRule}
` : ''}

# REQUIRED STRUCTURE
Page ranges:
- Opening (${PR.opening[0]}-${PR.opening[1]}): Hook + companion appears + challenge surfaces
- Rising (${PR.rising[0]}-${PR.rising[1]}): Challenge grows, first attempt fails, child makes emotional mistake
- Midpoint (${PR.midpoint[0]}-${PR.midpoint[1]}): Twist + companion reveals vulnerability + heart line
- Climax (${PR.climax[0]}-${PR.climax[1]}): Child acts physically (NOT sit/breathe/wait)
- Ending (${PR.ending[0]}-${PR.ending[1]}): Resolution per direction type

Required elements (place in specific pages):
- heartLine: page in midpoint range — companion does ONE quietly heartbreaking ACTION (not dialogue)
- emotionalMistake: page in rising range — child does ONE unkind/dismissive thing (not punished by story)
- uncomfortableTruth: one page — a moment of emotional reality that does NOT resolve
- quietPage: EXACTLY page ${QUIET} — minimal action, no dialogue

# OUTPUT (JSON only — no prose, no comments)

{
  "title": "<Hebrew title (with nikud OK or without — final story will have full nikud)>",
  "storyStyle": "<one-phrase style description>",
  "metaphor": "<the central metaphor>",
  "stakes": "<what happens if child doesn't act — concrete>",
  "worldRule": ${worldRule ? `"${worldRule}"` : 'null'},
  "emotionalArc": "<5-stage arc with arrows>",
  "endingType": "${dir.endingType}",
  "quietPage": ${QUIET},
  "heartLine": { "page": <num>, "action": "<English description of the heartbreaking action>" },
  "emotionalMistake": { "page": <num>, "action": "<English description of child's wrong choice>" },
  "uncomfortableTruth": { "page": <num>, "truth": "<English description of unresolved moment>" },
  "pages": [
    {
      "page": 1,
      "beat": "<English: what happens on this page in 1-2 sentences>",
      "location": "<where>",
      "imageDirection": "<English visual scene for illustrator>"
    },
    ...
    {
      "page": ${PAGES},
      "beat": "...",
      "location": "...",
      "imageDirection": "..."
    }
  ]
}

CRITICAL:
- Output exactly ${PAGES} pages in the "pages" array.
- For page ${QUIET}: beat must be a SINGLE small action only. No dialogue. No multi-event beat.
- Each beat is brief — the prose writer will expand.
- Use the companion's coping strategy as the dramatic engine.
- Return ONLY JSON. No markdown fences, no explanations.`;
}

async function generateSkeleton(companion, direction) {
  const tag = `${companion.id}_${direction}`;
  const prompt = buildSkeletonPrompt(companion, direction);
  const t0 = Date.now();
  console.log(`   🏗  [${tag}] Stage 1 (skeleton, ${SKELETON_MODEL})...`);

  const res = await fetchWithRetry('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: SKELETON_MODEL,
      input: [{ role: 'user', content: prompt }],
      max_output_tokens: SKELETON_MAX_TOKENS,
    }),
  }, 'Stage 1');

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stage 1 API ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const output = data.output || [];
  let text = output
    .filter((i) => i.type === 'message')
    .flatMap((m) => m.content || [])
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  // Strip code fences if model added them
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  let skeleton;
  if (!text) {
    // Empty response — likely reasoning model burned all tokens on reasoning
    const statusInfo = data.status || 'no status';
    const usage = data.usage || {};
    const reasoningTok = usage.output_tokens_details?.reasoning_tokens || 0;
    const outputTok = usage.output_tokens || 0;
    const types = output.map(o => o.type).join(', ') || 'no output items';
    let hint = '';
    if (reasoningTok > 0 && outputTok <= reasoningTok) {
      hint = `\n   💡 Hint: reasoning model used ${reasoningTok} reasoning tokens. Raise SKELETON_MAX_TOKENS env var.`;
    }
    throw new Error(`Stage 1 returned EMPTY text. status=${statusInfo}, output_types=[${types}], in=${usage.input_tokens || '?'}, out=${outputTok}, reasoning=${reasoningTok}.${hint}`);
  }
  try {
    skeleton = JSON.parse(text);
  } catch (err) {
    throw new Error(`Stage 1 returned invalid JSON. First 400 chars: ${text.slice(0, 400)}`);
  }

  // Sanity checks
  const expectedPages = DIRECTION_CONFIG[direction].pages;
  if (!skeleton.pages || skeleton.pages.length !== expectedPages) {
    throw new Error(`Stage 1 skeleton has ${skeleton.pages?.length || 0} pages, expected ${expectedPages}`);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const reasoningTok = data.usage?.output_tokens_details?.reasoning_tokens || 0;
  const outputTok = data.usage?.output_tokens || 0;
  console.log(`   ✓ [${tag}] Skeleton ready (${expectedPages} pages, ${elapsed}s, reasoning=${reasoningTok}, output=${outputTok})`);
  return skeleton;
}

// ─── STAGE 2: HEBREW PROSE (CLAUDE) ────────────────────────────────────
function buildProsePrompt(companion, direction, skeleton) {
  const dir = DIRECTION_CONFIG[direction];
  const c = companion;
  const PAGES = dir.pages;
  const QUIET = skeleton.quietPage;
  const PR = dir.pageRanges;

  // Build the page-by-page beats string
  const beatsText = skeleton.pages.map(p => {
    const flags = [];
    if (p.page === QUIET) flags.push('QUIET PAGE');
    if (p.page === skeleton.heartLine?.page) flags.push('HEART LINE');
    if (p.page === skeleton.emotionalMistake?.page) flags.push('EMOTIONAL MISTAKE');
    if (p.page === skeleton.uncomfortableTruth?.page) flags.push('UNCOMFORTABLE TRUTH');
    const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
    return `### עמוד ${p.page}${flagStr}\nbeat: ${p.beat}\nlocation: ${p.location}\nimage: ${p.imageDirection}`;
  }).join('\n\n');

  // Special instructions per flagged page
  const heartLineHint = skeleton.heartLine ? `\n**שורת לב (עמוד ${skeleton.heartLine.page})**: ${skeleton.heartLine.action}\nכתוב פעולה — לא דיאלוג. הקומפניון עושה משהו שקט-שובר-לב. ההורה ירגיש. הילד יראה. אף אחד לא מסביר.` : '';
  const mistakeHint = skeleton.emotionalMistake ? `\n**טעות רגשית (עמוד ${skeleton.emotionalMistake.page})**: ${skeleton.emotionalMistake.action}\nהילד עושה משהו לא נחמד. הסיפור לא חוזר להסביר. זה פשוט קורה.` : '';
  const truthHint = skeleton.uncomfortableTruth ? `\n**אמת לא נוחה (עמוד ${skeleton.uncomfortableTruth.page})**: ${skeleton.uncomfortableTruth.truth}\nרגע שלא נפתר. הסיפור ממשיך. בלי שיעור. בלי תיקון.` : '';

  return `אתה סופר ילדים ישראלי עטור פרסים. אתה כותב בעברית טבעית, **בניקוד עזר חלקי** (לא מלא), לילדים בגיל ${dir.ageSweet}.

אתה **לא** מתרגם מאנגלית. אתה חושב בעברית. אתה כותב בעברית.

קיבלת סקלטון של סיפור — תכנון מבני, בלי פרוזה. תפקידך: לכתוב את הסיפור המלא בעברית טבעית.

# 🚨 הוראה חשובה לפני הכל — ניקוד חלקי בלבד

**שים לב**: בהמשך הפרומפט יש דוגמאות עברית עם **ניקוד מלא** (לצורך הבהרה דקדוקית בלבד).
**אסור לחקות את סגנון הניקוד שלהן.** הפלט שלך חייב להיות ב**ניקוד עזר חלקי** — לפי הכללים בסעיף "כתיב וניקוד".

**Default = ללא ניקוד.** ניקוד מתווסף רק במקומות ספציפיים:

${direction === 'bedtime' ? `
⚠️ **שים לב במיוחד — סיפור bedtime:**
המודל נוטה להגזים בניקוד דווקא בסיפורי ערש כי הם "רגשיים יותר".
**אסור**. הכלל זהה ל-adventure ול-fantasy: ניקוד עזר חלקי בלבד.
ילד שמקשיב לסיפור ערש לא צריך ניקוד מלא — הוא צריך שטף וחום, לא רעש סימנים.

` : ''}
1. שמות פרטיים (פעם ראשונה): דינִי, בּוּבּוּ, קוֹקוֹ
2. ו' תנועה: רוּחַ, אוֹר, כּוֹכָב — נקודה על ו' עצמה
3. דגש על ב/כ/פ (ולא על אותיות אחרות): בָּננה, כִּתָּה, פִּיל
4. נקודת שׁ/שׂ — תמיד
5. מילים עם הומוגרפים: סֵפֶר, אֵשׁ — שני סימנים מותרים

**ללא ניקוד מוחלט**: ילד, אמא, אבא, בית, יד, ראש, הולך, רואה, שומע, עומד, אומר, על, אל, עם, של, את, כי, אם.

אם אתה כותב פסקה ויש בה יותר מ-3-4 סימני ניקוד — **בדוק אם זה באמת חיוני**. ברירת מחדל: פחות ניקוד.

## 🧬 DNA רגשי של הכיוון

לכל כיוון יש "מנוע רגשי" שונה לחלוטין. **אסור לבלבל ביניהם.**

- **bedtime** = שקט רגשי. מתח קטן → ראייה → קרבה. סצנה אחת, חדר אחד.
- **adventure** = תנועה רגשית. מסע פיזי + מכשול → גוף פעיל.
- **fantasy** = **פלא וגילוי**. ילד חי בתוך עולם פלאי. **לא** "פילוסופיה לילדים".

**הכיוון של סיפור זה: ${direction}.**

${direction === 'fantasy' ? `## 🌟 חוק הפלא הפיזי (פנטזיה) — קריטי

עולם הפנטזיה הוא **חוויה ויזואלית מיידית**, לא רעיון מופשט.

הילד צריך להבין את העולם **אחרי עמוד אחד**. אם הוא צריך הסבר → נכשלת.

**חובה בכל עמוד פנטזיה** — לפחות אחד מאלה:
- תנועה חדשה / שינוי ויזואלי
- גילוי / סכנה / טרנספורמציה / שינוי מרחבי
- פעולה פיזית עם תוצאה גלויה

**אסור בפנטזיה:**
- הצהרות פילוסופיות מופשטות ("X הוא סוג של Y", "תנועה היא זמן")
- הסבר חוק העולם — אסור שדמות תסביר *למה* העולם עובד ככה
- תיאורי contemplation, פסקאות "חושב על המשמעות"
- אם הדמות מבוסס על חוק אבסטרקטי (כמו "שאלות-צבעים"): **הילד חי בתוכו דרך פעולה ויזואלית. הקומפניון לא מסביר אותו.**

**דוגמה לפנטזיה טובה (פיזית, מיידית):**
- מדרגות שצומחות באוויר
- צללים שמתנתקים מהאדם
- אבנים ששרות כשנוגעים בהן
- ירח שנופל נמוך מספיק לגעת בו
- שאלות-צבעים שאפשר **לתפוס ביד** (לא לדבר עליהן)

**דוגמה לפנטזיה רעה (אבסטרקטית, מסבירה):**
- "השאלות הן צבעים כי..."
- "החוק של העולם הוא שבכל פעם ש..."
- "זה תלוי במשמעות של..."

**שאל את עצמך לפני כל עמוד:** האם ילד בן ${dir.ageSweet} יכול להיכנס לעולם הזה ולשחק בו? אם לא — תכתוב מחדש.

` : ''}## הקומפניון: ${c.nameClean}

## הקומפניון: ${c.nameClean}
מין: ${c.species}, מגדר: ${c.gender === 'male' ? 'זכר' : 'נקבה'}
אישיות: ${c.personality}
דפוס דיבור: ${c.speechPattern}
שפת גוף: ${c.bodyLanguage || 'מובע פיזית'}
טקס נחמה: ${c.comfortRitual || 'תנועה חוזרת קטנה'}

הקומפניון **אסור לו** להסביר את רגשותיו במילים. רגש = תנועה, עצירה, חפץ, מבט. לא הצהרה.

## 🎭 CHARACTER VOICE MANDATE — קריטי

הסיפור הזה **חייב** שלא יעבוד אותו דבר עם קומפניון אחר. אם תוכל להחליף את ${c.nameClean} בכל חיה אחרת והעלילה תהיה זהה — **כשלת**.

**שלוש דרישות מחייבות:**

1. **ההצלה/הפתרון בעמוד השיא מגיע דרך יכולת/תכונה ייחודית לקומפניון הזה.**
   ${c.species === 'תמנון' ? '— תמנון: דרך 8 זרועות, סלסול, אחיזה' : ''}
   ${c.species === 'זיקית' ? '— זיקית: דרך שינוי צבע, השתקפות סביבה' : ''}
   ${c.species === 'פרפר' ? '— פרפר: דרך נחיתה רכה, סגירת/פתיחת כנפיים, מעבר מצב (זחל→פרפר)' : ''}
   ${c.species === 'פנדה' ? '— פנדה: דרך איטיות, יציבה רחבה, יכולת להישאר ללא תזוזה' : ''}
   ${c.species === 'ינשוף' ? '— ינשוף: דרך תצפית, סיבוב ראש 360°, וידוי "אני לא יודע"' : ''}
   ${c.species === 'כלבלב' ? '— כלבלב: דרך הצמדת ראש לרגל, נשימה משותפת, נוכחות שקטה' : ''}
   ${c.species === 'דרקון' ? '— דרקון: דרך כנפיים פרושות כשמיכה, נשיפת חום (לא להבה)' : ''}

2. **בכל עמוד — תופעה גופנית/פיזית ייחודית למין הקומפניון.**
   לא כותרות רגשיות, רק פעולות שרק החיה הזו עושה.

3. **טקס הנחמה הספציפי שלו מופיע פעם אחת לפחות בסיפור.**
   טקס: ${c.comfortRitual || 'תנועה חוזרת קטנה'}
   הילד יכול לחקות אותו בסוף.

**אם הסיפור מסתיים והקומפניון לא תרם משהו שרק הוא יודע — תכתוב מחדש.**

## הסקלטון של הסיפור
כותרת: ${skeleton.title}
סגנון: ${skeleton.storyStyle}
מטאפורה מרכזית: ${skeleton.metaphor}
סיכון: ${skeleton.stakes}
${skeleton.worldRule ? `חוק העולם (פנטזיה): ${skeleton.worldRule}` : ''}
קשת רגשית: ${skeleton.emotionalArc}

${beatsText}
${heartLineHint}${mistakeHint}${truthHint}

## ⚡ חוק האיפוק (הכי חשוב — תקרא בעיון)

אתה מודל שיודע לכתוב יפה. הבעיה: אתה **נהנה מזה** ולא יודע מתי לעצור.

**ספר ילדים טוב הוא ספר ילדים שלא מתאמץ להיות יפה.** אם משפט נשמע כאילו אתה נהנה ממנו יותר מהילד — מחק אותו.

### תקרת איפוק לכל עמוד (קשיחה)

לכל עמוד **מקסימום**:
- **1** דימוי ויזואלי או רגשי (לא שניים, לא שלושה)
- **1** מטאפורה (לא שתיים)
- **1** תיאור חושי (לא רשימה של תחושות)

אם כתבת עמוד עם 3 דימויים — **מחק 2**. אם 2 מטאפורות — **מחק 1**.

### דוגמאות לאיפוק

| יפה מדי (❌) | ילדי-נכון (✅) |
|---|---|
| "הקיר משתנה בלי רעש, אבל אני שומע רשרוש" | "הקיר זז." |
| "העיר שלפני נמצאת במקום אחר" | "אני לא יודע איפה אני." |
| "כל צבע היה מדויק" | "הצבעים נכונים." |
| "שתי העיניים הביטו קדימה" | (פשוט מחק — זה fingerprint) |
| "האוויר רעד כשהסש נח" | "הסש נח." |

### Tics שיהפכו לחתימת-AI אם תחזור עליהם

- **"וְאָז!"** כפתיחת משפט — **מקסימום 2 פעמים בסיפור**, לא יותר
- **"שתי העיניים הביטו"** — אסור לחלוטין, סופר-fingerprint
- **3+ שינויי צבע בעמוד** (אם זה chameleon) — אסור
- **"רק ה-X נשאר/ה"** — מותר פעם אחת, לא יותר
- **"קוֹלוֹ הָיָה כָּמוֹ X"** — אסור (over-poetic)

### חתימות מערכת חדשות (מקסימום פעם אחת בכל הסיפור)

- **"הוּא לֹא עָנָה"** — מקסימום פעם
- **"הוּא לֹא זָז"** — מקסימום פעם
- **"שֶׁקֶט"** ככותרת רגש — מקסימום פעם
- **"הָאוֹר"** ככותרת רגש — מקסימום פעם
- **"מָהֵר מָהֵר מָהֵר"** או דומה — מקסימום פעם
- **"הָעֵינַיִם הִבִּיטוּ קָדִימָה"** או "שְׁתֵּי הָעֵינַיִם..." — אסור

### מבחן ה-20%

אחרי שכתבת עמוד, **קרא שוב ומחק 20%** ממנו. מה שנשאר — זה הסיפור.

אם אתה לא יכול למחוק 20% בלי לאבד משמעות — כתבת קצר מספיק.
אם כן — תמיד יש שומן לחתוך.

### השאלה לפני שמסיימים עמוד

> "האם יש פה משהו שילד בן ${dir.ageSweet} לא יזכור?"
> אם כן — מחק.

ילד זוכר:
- **המפתח לא פתח את הדלת**
- **הצעיף נשאר על העץ**
- **הצבעים לא התערבבו**

ילד לא זוכר:
- "האור התפזר במדויק על הסש"
- "הקול היה כמו רחש של מחשבות"
- "העיר הופיעה במקום שונה"

## ✍️ כתיב וניקוד — חוקי מפתח

### כתיב מלא — תמיד
כתוב את הסיפור **בכתיב מלא** (כמו בספרי ילדים מודרניים):
- ✅ "ילד" (לא "ילד" בלי י)
- ✅ "כובע" (לא "כבע")
- ✅ "אומר" (לא "אמר" כשהכוונה לבינוני)
- ✅ "פוחד" (לא "פחד" כשהכוונה לבינוני)
- ✅ "אורות" (לא "ארות")

**אסור** למחוק ו או י רק כי אפשר להחליף אותם בניקוד. **תכתוב כאילו אין ניקוד.** הניקוד מתווסף בנוסף, לא במקום.

### ניקוד עזר — כן יהיה ניקוד, פשוט לא מוגזם

**הגישה: ניקוד עזר (Helping Niqqud)** — כמו בספרי ילדים ישראליים מודרניים.
**שים ניקוד — אבל רק את הסימנים שעוזרים. לא את אלה שמכבידים.**

**כלל 1: ו' תמיד עם ניקוד צמוד אליה כשיש ספק.**
- ✅ "רוּחַ" — שורוק (נקודה בתוך ה-ו') — חובה
- ✅ "אוֹר" — חולם (נקודה מעל ה-ו') — חובה
- ✅ "כּוֹכָב" — חולם על ו' (אבל לא חייב ניקוד על כ' ב' — אופציונלי)
- ❌ "רוּחַ" עם פתח גם על ח' — מיותר, ילד יודע להגות ח' בסוף מילה
- **הכלל**: על ו' תמיד שים את הסימן (שורוק/חולם). שאר המילה — רק אם צריך.

**כלל 2: דגש (נקודה בתוך אות) — רק על ב, כ, פ.**
האותיות האלה נהגות שונה לגמרי עם דגש או בלי. שאר האותיות — בלי דגש.
- ✅ "בָּננה" — דגש בב' (אחרת זה "ואננה")
- ✅ "כִּתָּה" — דגש בכ' (אחרת זה "חיתה")
- ✅ "פִּיל" — דגש בפ' (אחרת זה "פיל" עם f)
- ❌ "דִּינִי" — **לא** דגש בד' (אין הבדל בהגייה). פשוט "דינִי" עם חיריק.
- ❌ דגש בת', ג', ד', ל', נ' — לא משנה הגייה במודרני, לא רושמים.

**כלל 3: נקודת שׁ/שׂ — תמיד.**
האות ש' היא הכי מבלבלת בעברית — בלי הנקודה אי אפשר לדעת אם זה "ש" או "ס".
- ✅ "שָׁמַיִם" (שׁ ימני = sh)
- ✅ "שָׂרָה" (שׂ שמאלי = s)
- ✅ "שִׂיא" — שׂ עם חיריק
- **תמיד שים את הנקודה המתאימה על כל ש' בסיפור.**

**כלל 4: למילים דו-הברתיות שיש להן הומוגרפים — שני סימנים מותרים.**
- ✅ "סֵפֶר" — גם צירה וגם סגול (אחרת זה "סָפַר")
- ✅ "אֵשׁ" — צירה (אחרת זה "אִישׁ")
- ✅ "אוּלָם" — שורוק + קמץ — בסדר, מילה רגילה
- ✅ "כַּדּוּרְסַל" — פתח+שורוק+שווא+פתח — בסדר אם המילה באמת זרה/נדירה
- **הכלל**: מספר סימנים מותר אם הם **באמת עוזרים**. הבעיה היא לא הכמות — הבעיה היא סימנים מיותרים.

**כלל 5: אסור הגזמות אקדמיות.**
- ❌ פתח genuvah על ח'/ע'/ה' בסוף מילה — אוטומטי, ילד יודע
- ❌ שווא נע על כל אות פתיחה (לְ-, בְּ-, מְ-) — מיותר ברוב המקרים
- ❌ קמץ קטן/חטף-קמץ — ניקוד אקדמי, לא לילדים
- ❌ דגש על אותיות שלא בכ"פ — מיותר
- ❌ ניקוד על מילות יחס פשוטות (עַל, אֶל, עִם) — די ב"על", "אל", "עם"

**איפה אין צורך בכלום:**
- מילים שכיחות לחלוטין: "ילד", "אמא", "אבא", "בית", "יד", "ראש", "הולך", "רואה", "שומע", "עומד", "אומר"
- מילות יחס וקישור: "על", "אל", "עם", "של", "את", "כי", "אם"

**רעיון מפתח**: יש ניקוד! פשוט לא בכל אות. **רק הסימנים שיעזרו להורה להקריא נכון — לא כל סימן שאפשר.**

### דוגמה לפסקה נכונה (ניקוד עזר מאוזן)
---
דינִי עומד על אבן גבוהה. רוּחַ קלה מנשבת מהאוֹר של הבוקר.
הוא רואה אפרוֹחַ קטן רועד על האדמה.
"הַשׁוֹמֵר דינִי כאן!" הוא קורא.
---
**מה יש**:
- "דינִי" — חיריק על נ' (לזיהוי "ди-ני"), **בלי דגש על ד'**
- "רוּחַ" — שורוק על ו' בלבד
- "אוֹר", "אפרוֹחַ" — חולם על ו'
- "הַשׁוֹמֵר" — נקודת שׁ ימני (לא ס'), פתח על ה' + חולם על ו'
- "הוא", "הוא" — בלי ניקוד (מילה שכיחה לחלוטין)

**מה אין**: אין ניקוד על "עומד", "אבן", "גבוהה", "קלה", "קטן", "רועד", "האדמה", "כאן", "קורא" — מילים פשוטות שילד מזהה.

### דוגמה לפסקה לא נכונה (מוגזם)
---
דִּינִי עוֹמֵד עַל אֶבֶן גְּבוֹהָה. רוּחַ קַלָּה מְנַשֶּׁבֶת מֵהָאוֹר שֶׁל הַבּוֹקֶר.
הוּא רוֹאֶה אֶפְרוֹחַ קָטָן רוֹעֵד עַל הָאֲדָמָה.
---
ניקוד מלא על כל מילה = רעש. מכביד על העין ועל הקריאה.

## כללי עברית — קריטיים

הורה ישראלי עייף יקריא את הסיפור הזה בקול ב-22:00. **אסור שיהיה מילה אחת שתשבור את שצף הקריאה.**

**במקום פעלים גבוהים — תמיד הפשוטים:**
- מַסִּיעַ → מְקָרֵב
- מְשַׁחֵל → מֵשִׂים / מַעֲבִיר
- מַעֲגֵן → קוֹשֵׁר
- מִשְׁתַּמֵּט → נֶחְבָּא / מַחְלִיק
- מַזְדַּקֵּף → יוֹשֵׁב גָּבוֹהַ
- מַרְעִים → צוֹעֵק
- אֲזַי → אָז
- "לְמַעֲשֶׂה, יָדוּעַ כִּי..." → "בְּעֶצֶם..."

**את לפני מושא ישיר — תמיד:**
- ❌ "שָׁמַעְתִּי זֶה" → ✅ "שָׁמַעְתִּי אֶת זֶה"
- ❌ "מַסְדִּיר סַשׁ" → ✅ "מְסַדֵּר אֶת הַסַּשׁ"

**טרנסליטרציה אסורה:**
- ❌ "קוויל" → ✅ "נוצה לכתיבה"
- ❌ "סנטימטר" → ✅ "קצת"
- ❌ "פלזמה" → ✅ "גז זוהר"
- ❌ "סש" / "Sash" → ✅ "סרט" / "שרשרת"
- ❌ "קולר" / "Collar" → ✅ "צווארון" / "קוצים" (לקיפוד)
- ❌ "מנדיבוליות" → ✅ "לסתות קטנות"

**🚨 מילים מומצאות — אסורות בהחלט.** אסור להמציא מילים שלא קיימות בעברית, גם אם הן נשמעות כמו פעלים. תמיד תשתמש במילה אמיתית. דוגמאות שכבר נתפסו בסיפורים שנכשלו:
- ❌ "זוטה" / "זוטות" → ✅ "זזה" / "זזות"
- ❌ "מפרכם" / "פרכום" → ✅ "מגרגר" / "גרגור" (לחתול)
- ❌ "שולייה" (אם הכוונה לבגד) → ✅ "שָׁל" / "סודר"
- ❌ "מדל" → ✅ "מדליה"
- ❌ "באמא" → ✅ "בבית"
- ❌ "מקיף את הזנב סביב X" → ✅ "מלפף את הזנב סביב X"

**אם אתה לא בטוח שמילה קיימת בעברית — אל תשתמש בה.** בחר מילה פשוטה ובטוחה שכל ילד מכיר.

**מילים אסורות לחלוטין (אוצר מילים רגשי AI):**
הרגיש, פחד, אומץ, ביטחון, התמודד, "הבין ש...", "למד ש..."

## ⚠️ התאמת זכר/נקבה — אזהרה קריטית

זו השגיאה הכי שכיחה של מודלים. בדוק בכל משפט שהפועל והשם תואמים במין.

**מילים שתמיד מבלבלות מודלים:**

| מילה | מין | פועל נכון |
|---|---|---|
| **גפן** | נקבה | "הגפן יורדת", "הגפן נופלת" |
| **שדה** | זכר | "השדה מלא", "השדה נמתח" |
| **קיפוד** | זכר | "הקיפוד מסתובב", "הוא מסתכל" |
| **קונכייה** | נקבה | "הקונכייה זזה", "היא נסגרת" |
| **כנף** | נקבה | "הכנף נופלת" |
| **רגל** | נקבה | "הרגל קטנה" |
| **דרך** | נקבה | "הדרך ארוכה" |

**אם הקומפניון הוא זכר** — כינויי הגוף שלו וכל הפעלים בזכר. **אם נקבה** — בנקבה. עקביות לאורך כל הסיפור.

**אסור מעבר במין באמצע סיפור.** למשל: אם בעמוד 2 קיפוד "מסתכל" (זכר) — בעמוד 5 הוא לא יכול להיות "היא נעלמת".

## ✏️ שגיאות כתיב נפוצות שצריך להימנע מהן

- ❌ "אזניים" → ✅ "אוזניים"
- ❌ "אחוֹריו" / "מאחוֹריו" → ✅ "אחוריו" / "מאחוריו" (ללא חולם)
- ❌ "סוביב" → ✅ "סביב"
- ❌ "ביננו" → ✅ "בינינו"
- ❌ "פשׁוט" (השׁ מיותר, מבלבל) → ✅ "פשוט"
- ❌ "ידן" כקצור של "ליד" → ✅ "ליד"

**ביטויים אסורים (היו "AI tells" בסיפורים קודמים):**
- "מַרְגִּישׁ אֶת [תחושה]" כתיאור
- "כְּמוֹ לְחִישָׁה" / "לְחִישָׁה רַכָּה"
- "הָעוֹר מִצְטַמֵּר" / "הַחֲסַפְסוּת" / "מְחֻסְפָּס"
- "רַעַד קָטָן" / "רַעַד דַּק"
- "הַדְּמָמָה" / "הַשֶּׁקֶט מִתְפַּשֵּׁט"
- "הָאֲוִיר מִתְמַלֵּא" / "הָאֲוִיר רוֹעֵד"
- "כְּמוֹ גַּל" כמטאפורה

## 🚫 מטאפורות גנריות שצריך להימנע מהן (FINGERPRINT_CLEAN — קריטי)

הסיפורים הקודמים נכשלו כי המודל גלש למטאפורות גנריות שנשמעות "פיוטיות-AI". **אסור:**

**אור / זוהר / מתפזר / מהבהב — מותר רק אם הקומפניון הוא גחלילית/כוכב/דבר זוהר בעצמו.**
- ❌ "האור בפנים שלי" / "משהו זז בפנים"
- ❌ "השאלה זוהרת" / "מילה זוהרת"
- ❌ "האור מתפזר" / "אור מתחלק" / "אורות נעלמים"
- ❌ "צבע מהבהב" כמטאפורה רגשית
- ❌ "כל פינה מאירה אחרת"

**דואליות גנרית — אסורה:**
- ❌ "כן ולא" / "פתוח וסגור" כקונספט מרכזי
- ❌ "אור וצל" / "פנים וחוץ"
- ❌ "קרוב ורחוק" כמילון של רגש

**ביטויים פיוטיים-שבלוניים:**
- ❌ "הוא נושם / נושף בעדינות"
- ❌ "משהו רך הזיז בו"
- ❌ "הזמן עצר"
- ❌ "הכל היה אחר"
- ❌ "פתאום הוא הבין"

**שאל את עצמך לפני כל עמוד:** האם זה ביטוי שכל סופר AI היה יכול לכתוב על כל חיה, או שזה ספציפי ל**${c.nameClean}** ול**${c.species}**?

אם זה גנרי — תכתוב מחדש עם:
- **פעולה פיזית** של ${c.species} (לא תיאור רגש)
- **חפץ קונקרטי** מהעולם של ${c.species}
- **תופעה גופנית ייחודית** של ${c.species}

## ✅ בדיקה עצמית לפני שליחה — 5 שאלות

לפני שאתה מסיים, ענה לעצמך ב-5 שאלות. אם אחת מהן "לא" — תכתוב מחדש:

1. **האם הילד עושה משהו** (לא רק מסתכל) בעמוד 4-6 שמראה את הבעיה הרגשית?
2. **האם ${c.nameClean} עושה לפחות פעולה גופנית אחת ספציפית-למין** בכל עמוד?
3. **האם הפתרון בעמוד השיא** דורש את היכולת הייחודית של ${c.species} — או שאפשר להחליף ב**כל** חיה אחרת ולקבל את אותה תוצאה?
4. **האם השתמשתי במילה "אור" / "זוהר" / "מהבהב"** במקום שאפשר היה לתאר חפץ אמיתי או פעולה גופנית?
5. **האם יש פסקה שיכולה להופיע גם בסיפור אחר** (לא קשורה לקומפניון הזה)?

${direction === 'fantasy' ? `## 🌟 עמוד הפלא (עמוד ${QUIET}) — פנטזיה

**לא** שקט רגשי — **רגע של גילוי ויזואלי.**

המבנה: פעולה + תוצאה ויזואלית פלאית.
- מקסימום 12 מילים
- אין הסבר
- אין מטאפורה
- כל המשפט = משהו פלאי שקורה לעין

דוגמה טובה: "הוּא נוֹגֵעַ בָּאֶבֶן. הָאֶבֶן זוֹהֶרֶת רֶגַע, וְשׁוּב חוֹזֶרֶת לַחֹשֶׁךְ."
או: "צֵל אֶחָד מִתְנַתֵּק וְהוֹלֵךְ לוֹ."

הילד רואה משהו שלא ראה. **השתאות, לא שקט.**

` : `## עמוד שקט (עמוד ${QUIET}) — תבנית קשיחה בלבד

המבנה היחיד המותר:
\`\`\`
[הקומפניון] [פעולה גופנית קטנה אחת].
[חפץ] [מיקום].
\`\`\`

- מקסימום 12 מילים.
- אין דיאלוג.
- אין תיאור חושי.
- אין מטאפורה.
- אין "מַרְגִּישׁ", "כְּמוֹ", "רַעַד", "שֶׁקֶט".

דוגמה טובה (אם הקומפניון הוא דרקון):
"דִּינִי שׁוֹכֵב עַל הַצַּד. הַסַּשׁ נָח לְיַד הָרֶגֶל."

האיור עושה את שאר העבודה. **תאמין לאיור.**`}

## אורך עמודים

| חלק | אורך |
|---|---|
| עמודים רגילים | ${dir.wordsPerPage} מילים |
| עמוד שקט (${QUIET}) | **8-12 מילים בלבד** |
| עמוד סיום (${PAGES}) | קצר |

סה"כ סיפור: ${dir.totalMin}-${dir.totalMax} מילים.

**כלל זהב לקצב**: אם הורה קורא את העמוד בקול בלי לעצור אפילו פעם אחת לנשימה טבעית — העמוד ארוך מדי. 2-3 הפסקות-נשימה זה האורך הנכון.

## אם זה נשמע כמו AI מתאמץ להיות יפה — פשט.

המבחן: קרא כל משפט בקול בראש. אם נתקעת על מילה — החלף. אם נשמע מתורגם — כתוב מחדש בעברית הטבעית.

## פורמט פלט

החזר בדיוק את הפורמט הזה (markdown):

\`\`\`
---
title: "${skeleton.title}"
companionId: ${c.id}
direction: ${direction}
category: ${c.category}
gender: male
pages: ${PAGES}
endingType: ${skeleton.endingType}
${skeleton.worldRule ? `worldRule: ${skeleton.worldRule}` : ''}
---

storyStyle: ${skeleton.storyStyle}
metaphor: ${skeleton.metaphor}
stakes: ${skeleton.stakes}
emotionalArc: ${skeleton.emotionalArc}
quietPage: ${QUIET}
heartLine: ${skeleton.heartLine ? `עמוד ${skeleton.heartLine.page} — ${skeleton.heartLine.action}` : ''}
emotionalMistake: ${skeleton.emotionalMistake ? `עמוד ${skeleton.emotionalMistake.page} — ${skeleton.emotionalMistake.action}` : ''}
uncomfortableTruth: ${skeleton.uncomfortableTruth ? `עמוד ${skeleton.uncomfortableTruth.page} — ${skeleton.uncomfortableTruth.truth}` : ''}

--- Page 1 ---
[טקסט עברית מנוקד]

imageDirection: [English from skeleton]

--- Page 2 ---
[טקסט עברית מנוקד]

imageDirection: [...]

[... continue for all ${PAGES} pages ...]

WORD_COUNT: [p1, p2, ..., p${PAGES}] = TOTAL
\`\`\`

החזר רק את הסיפור בפורמט הזה. בלי הסברים. בלי code fences. הילד מחכה לסיפור.`;
}

async function generateProse(companion, direction, skeleton) {
  const tag = `${companion.id}_${direction}`;
  const prompt = buildProsePrompt(companion, direction, skeleton);
  const t0 = Date.now();
  console.log(`   ✍️  [${tag}] Stage 2 (Hebrew prose, ${PROSE_MODEL})...`);

  const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: PROSE_MODEL,
      max_tokens: PROSE_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  }, 'Stage 2');

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stage 2 API ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n')
    .trim();

  // Strip code fences if Claude added them
  let cleaned = text;
  const fenceMatch = text.match(/```(?:\w+)?\s*([\s\S]*?)\s*```\s*$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const inputTokens = data.usage?.input_tokens || '?';
  const outputTokens = data.usage?.output_tokens || '?';
  console.log(`   ✓ [${tag}] Prose ready (${inputTokens}→${outputTokens} tokens, ${elapsed}s)`);

  return cleaned;
}

// ─── QA (similar to v4 but tighter) ────────────────────────────────────
function stripNikud(s) { return s.replace(/[֑-ׇ]/g, ''); }
function countHebrewWords(text) {
  const clean = stripNikud(text);
  return (clean.match(/[א-ת]+/g) || []).length;
}

const FINGERPRINT_PATTERNS = [
  { name: 'מַרְגִּישׁ אֶת', regex: /מַרְגִּישׁ\s+אֶת/g },
  { name: 'כְּמוֹ לְחִישָׁה', regex: /כְּמוֹ\s+לְחִישָׁה/g },
  { name: 'הָעוֹר מִצְטַמֵּר', regex: /הָעוֹר\s+(מִצְטַמֵּר|נוֹגֵעַ|חָש)/g },
  { name: 'הַחֲסַפְסוּת', regex: /(הַחֲסַפְסוּת|מְחֻסְפָּס)/g },
  { name: 'רַעַד קָטָן/דַּק', regex: /רַעַד\s+(קָטָן|דַּק)/g },
  { name: 'הַדְּמָמָה', regex: /(הַדְּמָמָה|הַשֶּׁקֶט\s+מִתְפַּשֵּׁט)/g },
  { name: 'הָאֲוִיר מִתְמַלֵּא', regex: /הָאֲוִיר\s+(מִתְמַלֵּא|רוֹעֵד|נוֹשֵׁף)/g },
  { name: 'כְּמוֹ גַּל', regex: /כְּמוֹ\s+(גַּל|נְשִׁימָה)/g },
];

function checkFingerprints(text) {
  const hits = [];
  for (const p of FINGERPRINT_PATTERNS) {
    const matches = (text.match(p.regex) || []).length;
    if (matches > 0) hits.push({ pattern: p.name, count: matches });
  }
  return hits;
}

function qaCheck(text, companionId, direction) {
  const issues = [];
  const dir = DIRECTION_CONFIG[direction];
  const expectedPages = dir.pages;
  const pages = text.split(/--- Page \d+ ---/).slice(1);

  if (pages.length !== expectedPages) {
    issues.push(`❌ ${pages.length} pages (required: ${expectedPages})`);
  }

  let totalWords = 0;
  pages.forEach((page, i) => {
    const pageNum = i + 1;
    const lines = page.split('\n').filter(l => l.trim() && !l.startsWith('imageDirection:'));
    const wc = countHebrewWords(lines.join(' '));
    totalWords += wc;
    if (!page.includes('imageDirection:')) issues.push(`❌ Page ${pageNum}: missing imageDirection`);
  });

  if (totalWords < dir.totalMin) issues.push(`⚠️  Total: ${totalWords} (min ${dir.totalMin})`);
  if (totalWords > dir.totalMax) issues.push(`⚠️  Total: ${totalWords} (max ${dir.totalMax})`);

  const fingerprints = checkFingerprints(text);
  if (fingerprints.length > 0) {
    const total = fingerprints.reduce((s, h) => s + h.count, 0);
    issues.push(`🟠 Fingerprint phrases: ${total} (${fingerprints.map(h => `${h.pattern}×${h.count}`).join(', ')})`);
  }

  const endingMatch = text.match(/endingType:\s*(\w+)/);
  if (endingMatch && endingMatch[1].trim() !== dir.endingType) {
    issues.push(`❌ endingType: "${endingMatch[1]}" (expected "${dir.endingType}")`);
  }

  return { pages: pages.length, totalWords, issues, fingerprints };
}

// ─── Pipeline orchestration ────────────────────────────────────────────
async function generateStory(companion, direction) {
  const tag = `${companion.id}_${direction}`;
  console.log(`\n🎬 [${tag}] v5 Generating (expected pages: ${DIRECTION_CONFIG[direction].pages})`);

  const startTime = Date.now();

  // Stage 1 — skeleton
  let skeleton;
  try {
    skeleton = await generateSkeleton(companion, direction);
    // Save skeleton for debugging
    if (!existsSync(SKELETON_DIR)) mkdirSync(SKELETON_DIR, { recursive: true });
    writeFileSync(
      join(SKELETON_DIR, `${companion.id}_${direction}.json`),
      JSON.stringify(skeleton, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error(`   ❌ Stage 1 failed: ${err.message}`);
    throw err;
  }

  // Stage 2 — Hebrew prose
  let prose;
  try {
    prose = await generateProse(companion, direction, skeleton);
  } catch (err) {
    console.error(`   ❌ Stage 2 failed: ${err.message}`);
    throw err;
  }

  // Build final output with meta header
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const meta = [
    `# Story: ${companion.id}_${direction} — Story Bank v5 (Hybrid: GPT-5 skeleton + Claude prose)`,
    `Generated: ${new Date().toISOString()}`,
    `Skeleton model: ${SKELETON_MODEL}`,
    `Prose model: ${PROSE_MODEL}`,
    `Total time: ${elapsed}s`,
    `Prompt-version: v5`,
    '',
    '---',
    '',
  ].join('\n');

  return meta + prose;
}

async function runWithConcurrency(items, worker, concurrency) {
  const results = [];
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const myIdx = idx++;
      try { results[myIdx] = await worker(items[myIdx], myIdx); }
      catch (err) { results[myIdx] = { error: err.message }; }
    }
  });
  await Promise.all(workers);
  return results;
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  let companionIds = [];
  let directions = [];
  const useCalibration = args.includes('--calibration-set');
  const useAll = args.includes('--all');
  const skipExisting = args.includes('--skip-existing');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--companion' && args[i + 1]) { companionIds.push(args[++i]); continue; }
    if (args[i] === '--direction' && args[i + 1]) { directions.push(args[++i]); continue; }
    if (args[i].startsWith('--')) continue;
    if (COMPANIONS[args[i]]) { companionIds.push(args[i]); continue; }
    if (DIRECTION_CONFIG[args[i]]) { directions.push(args[i]); continue; }
  }

  if (useCalibration) companionIds = [...CALIBRATION_SET];
  if (useAll) companionIds = Object.keys(COMPANIONS);
  if (companionIds.length === 0) {
    console.error('❌ Specify --companion <id>, --calibration-set, or --all');
    process.exit(1);
  }
  if (directions.length === 0) directions = [...DIRECTIONS];

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n📚 Story Bank v5 — Hybrid Two-Stage Pipeline`);
  console.log(`   Stage 1: ${SKELETON_MODEL} (skeleton)`);
  console.log(`   Stage 2: ${PROSE_MODEL} (Hebrew prose)`);
  console.log(`   Companions: ${companionIds.join(', ')}`);
  console.log(`   Directions: ${directions.join(', ')}`);
  console.log(`   Output: ${OUT_DIR}\n`);

  const jobs = [];
  let skipped = 0;
  for (const id of companionIds) {
    for (const d of directions) {
      if (skipExisting) {
        const existingPath = join(OUT_DIR, `${id}_${d}.md`);
        if (existsSync(existingPath)) { skipped++; continue; }
      }
      jobs.push({ id, d });
    }
  }
  if (skipped > 0) console.log(`⏭  Skipping ${skipped} existing stories\n`);

  await runWithConcurrency(jobs, async ({ id, d }) => {
    const companion = COMPANIONS[id];
    if (!companion) { console.error(`❌ Unknown: ${id}`); return; }
    if (!DIRECTION_CONFIG[d]) { console.error(`❌ Unknown direction: ${d}`); return; }

    try {
      const story = await generateStory(companion, d);
      const qa = qaCheck(story, id, d);
      const filename = `${id}_${d}.md`;
      writeFileSync(join(OUT_DIR, filename), story, 'utf8');
      const fpStatus = qa.fingerprints.length === 0 ? '✨ CLEAN' : `🟠 ${qa.fingerprints.reduce((s, h) => s + h.count, 0)} hits`;
      console.log(`✅ ${filename} — ${qa.pages}p, ${qa.totalWords}w, fingerprints: ${fpStatus}`);
      qa.issues.forEach(i => console.log(`   ${i}`));
    } catch (err) {
      console.error(`❌ ${id}_${d}: ${err.message}`);
    }
  }, 2);  // concurrency 2 — keep API costs manageable, both APIs in play

  console.log(`\n🏁 v5 generation complete.`);
  console.log(`\nNext:`);
  console.log(`  node scripts/audit-hebrew-quality.mjs --input=v5 --force`);
  console.log(`  node scripts/score-stories.mjs --input=v5 --force`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
