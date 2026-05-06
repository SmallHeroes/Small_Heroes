#!/usr/bin/env node
/**
 * test-pipeline-story.mjs
 *
 * Runs ONLY the story generation part of the pipeline (no images, no DB).
 * Uses the SAME prompts as the live pipeline (system + user), so you can test
 * story quality without burning image credits or waiting 3 minutes.
 *
 * Usage:
 *   node test-pipeline-story.mjs
 *   node test-pipeline-story.mjs --case 1       # run specific test case
 *   node test-pipeline-story.mjs --pages 8      # override page count
 *   node test-pipeline-story.mjs --model gpt-4o # override model
 *
 * Requires: OPENAI_API_KEY in .env
 */

import 'dotenv/config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) { console.error('❌ Need OPENAI_API_KEY in .env'); process.exit(1); }

// ═══════════════════════════════════════════════════════════
// EXAMPLE STORY (same as pipeline.ts EXAMPLE_STORY)
// ═══════════════════════════════════════════════════════════

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
הבגדים זחלו החוצה. האוריגמי שהיא עשתה אתמול פרש כנפיים ועף. המיטה רעדה—
לא מפחד.
מהתרגשות.

"אוקיי," יובל נשמה. "זה הולך… לכיוון מעניין."

היצור חייך. "ביואת! הגיע הזמן לתקן."
"לתקן?"
"כמובן."
הוא הוציא מהכיס… כלים.
כלים זעירים.
ברגים. ברגים צבעוניים. ומפתח שנראה כמו כוכב.

"אוקיי…" יובל אמרה. "אבל — את החדר? עם ברגים?"
"כמובן."
"ברגים לא מתקנים חדר!"
"ברגים מתקנים הכל."
(הוא אמר את זה עם כזו ביטחון. כאילו פעם תיקן יקום עם בורג של שש.)

יובל הביטה בו.
ואז הביטה בחדר.
ואז חזרה אליו.
"…תן לי את המפתח-כוכב."

הם ניסו.
הוא הבריג. היא סידרה.
אבל כל פעם שהם תיקנו משהו—
משהו אחר התפרק.
"זה לא עוזר!" יובל אמרה.
"עוד בורג?" הוא הציע.
"לא!"

יובל עצרה.
הסתכלה סביב.
כל הדברים שהתפזרו— לא נראו שבורים.
הם נראו… מבולבלים.
בדיוק כמוה.

"רגע," היא אמרה. "אני לא חושבת שצריך לתקן אותם."
היצור הטה את הראש.
"אני חושבת שצריך לשים אותם… במקומות אחרים."

יובל לקחה את האוריגמי שעף— ושמה אותו ליד המנורה.
את השמיכה שנפלה— קיפלה בצורה חדשה.
את המגירות— סגרה, אבל לא כמו קודם.
לאט.
בזמן שלה.

היצור ישב על השטיח, ברגל על רגל, וחייך.
(כאילו הוא תמיד ידע שהיא תגיע לזה לבד.)

הכל הרגיש… יציב.
לא מושלם. לא תמיד מסודר.
אבל שלה.

ולפני שנרדמה—
היא לחשה לעצמה:
"אני יודעת לסדר דברים."
גם אם לפעמים—
הם מתפרקים קצת קודם.`;

// ═══════════════════════════════════════════════════════════
// SYSTEM PROMPT (matches buildProse3ASystem in pipeline.ts)
// ═══════════════════════════════════════════════════════════

function buildSystemPrompt(childAge, pageCount) {
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

אורך: כל סצנה חייבת להיות 60-90 מילים בעברית. פחות מ-60 = נכשלת. סה"כ ${pageCount} סצנות.

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

// ═══════════════════════════════════════════════════════════
// USER PROMPT (matches the FIXED buildRawStoryPrompt)
// ═══════════════════════════════════════════════════════════

function buildUserPrompt({ childName, childAge, gender, topic, companion, superpower, pageCount }) {
  const genderHe = gender === 'girl' ? 'בת' : 'בן';
  const companionName = companion.name;
  const companionDesc = `${companion.name} — ${companion.tagline}. ${companion.narrativeHook}`;

  return `כתוב סיפור חדש עבור ${childName}, ${genderHe} ${childAge}.
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

// ═══════════════════════════════════════════════════════════
// API CALL
// ═══════════════════════════════════════════════════════════

async function callOpenAI(system, user, model = 'gpt-5.3-chat-latest') {
  console.log(`\n🤖 Calling ${model}...`);
  console.log(`   System: ${system.length} chars | User: ${user.length} chars\n`);

  const start = Date.now();
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    max_completion_tokens: 6000,
    response_format: { type: 'json_object' },
  };
  if (!model.includes('5.')) {
    body.temperature = 0.95;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${model} error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const usage = data.usage || {};
  console.log(`   Done in ${elapsed}s | Tokens: ${usage.total_tokens} (in:${usage.prompt_tokens} out:${usage.completion_tokens})`);

  if (model.includes('5.3')) {
    const cost = (usage.prompt_tokens * 1.75 + usage.completion_tokens * 14.0) / 1_000_000;
    console.log(`   Cost: $${cost.toFixed(4)}`);
  }

  return data.choices[0].message.content;
}

// ═══════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════

const TEST_CASES = [
  {
    name: 'NIGHT_FEAR — Girl 5, fear of dark',
    childName: 'מאיה',
    childAge: 5,
    gender: 'girl',
    topic: 'פחד מהחושך — בלילה כשנכבה האור הכל נראה מפחיד ושונה',
    companion: {
      name: 'פוף',
      tagline: 'עטלף קטן וביישן עם כנפיים גדולות מדי',
      narrativeHook: 'מראה שהצללים הם אור שמנוח',
    },
    superpower: 'אור רך שיוצא מהידיים כשהיא מדמיינת דברים יפים',
  },
  {
    name: 'NOISE_FEAR — Boy 4, loud noises',
    childName: 'איתי',
    childAge: 4,
    gender: 'boy',
    topic: 'פחד מרעשים חזקים — רעמים, זיקוקים, צפירות',
    companion: {
      name: 'הענק תום',
      tagline: 'ענק עדין שצעדיו מרעידים את האדמה — וליבו שקט',
      narrativeHook: 'מלמד את הגיבור שבתוך כל קול גדול יש חדר פנימי שקט',
    },
    superpower: 'שירה שקטה שהופכת רעשים מפחידים למוזיקה',
  },
  {
    name: 'NEW_SIBLING — Girl 6, jealousy of new baby',
    childName: 'נועה',
    childAge: 6,
    gender: 'girl',
    topic: 'קנאה באח/ות חדשה — כולם עסוקים בתינוק ושכחו אותי',
    companion: {
      name: 'כוכבון',
      tagline: 'כוכב אחד שהתחלק לשניים — והאור שלו רק גדל',
      narrativeHook: 'אהבה מתרבה, לא מתחלקת',
    },
    superpower: 'חיבוק שמאיר בחושך',
  },
];

// ═══════════════════════════════════════════════════════════
// DISPLAY
// ═══════════════════════════════════════════════════════════

function displayStory(jsonText) {
  try {
    const parsed = JSON.parse(jsonText);
    const scenes = parsed.scenes || [];

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📖 ${parsed.title || '(no title)'}`);
    console.log(`${'═'.repeat(60)}\n`);

    for (const scene of scenes) {
      const words = scene.text.trim().split(/\s+/).filter(Boolean).length;
      console.log(`--- עמוד ${scene.page} (${words} מילים) ---`);
      console.log(scene.text);
      console.log();
    }

    const totalWords = scenes.reduce((sum, s) => sum + s.text.trim().split(/\s+/).filter(Boolean).length, 0);
    console.log(`${'─'.repeat(40)}`);
    console.log(`📊 ${scenes.length} scenes | ${totalWords} total words | avg ${Math.round(totalWords / scenes.length)} words/scene`);

    // Quality checks
    const issues = [];
    for (const s of scenes) {
      const w = s.text.trim().split(/\s+/).filter(Boolean).length;
      if (w < 50) issues.push(`⚠️  Page ${s.page}: only ${w} words (target: 60-90)`);
      if (w > 100) issues.push(`⚠️  Page ${s.page}: ${w} words — too long (target: 60-90)`);
    }

    // Check for banned words
    const banned = ['הרגישה', 'הרגיש', 'חשה', 'חש', 'ידעה', 'ידע', 'פחד', 'אומץ', 'ביטחון',
                    'נרגעה', 'נשמה עמוק', 'הכל בסדר', 'הכל יסתדר', 'למדה ש', 'הבינה ש'];
    const fullText = scenes.map(s => s.text).join(' ');
    for (const word of banned) {
      if (fullText.includes(word)) {
        issues.push(`🚫 Banned word found: "${word}"`);
      }
    }

    if (issues.length > 0) {
      console.log(`\n⚠️  Quality issues:`);
      issues.forEach(i => console.log(`   ${i}`));
    } else {
      console.log(`\n✅ No quality issues detected`);
    }
  } catch (e) {
    console.log('\n⚠️  Could not parse JSON response:');
    console.log(jsonText.substring(0, 500));
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const caseIndex = args.includes('--case') ? parseInt(args[args.indexOf('--case') + 1]) - 1 : 0;
const pageCount = args.includes('--pages') ? parseInt(args[args.indexOf('--pages') + 1]) : 8;
const model = args.includes('--model') ? args[args.indexOf('--model') + 1] : 'gpt-5.3-chat-latest';

const testCase = TEST_CASES[caseIndex] || TEST_CASES[0];

console.log(`\n${'═'.repeat(60)}`);
console.log(`🧪 Pipeline Story Test (story-only, no images)`);
console.log(`${'═'.repeat(60)}`);
console.log(`Case: ${testCase.name}`);
console.log(`Pages: ${pageCount} | Model: ${model}`);
console.log(`Child: ${testCase.childName} (${testCase.gender}, ${testCase.childAge})`);
console.log(`Companion: ${testCase.companion.name}`);
console.log(`${'═'.repeat(60)}`);

const system = buildSystemPrompt(testCase.childAge, pageCount);
const user = buildUserPrompt({ ...testCase, pageCount });

console.log('\n📝 User prompt:');
console.log('─'.repeat(40));
console.log(user);
console.log('─'.repeat(40));

const result = await callOpenAI(system, user, model);
displayStory(result);
