/**
 * Few-Shot Story Generation Test
 * Tests the new approach: one excellent example story + short focused prompt
 * Compares GPT-4o output quality vs the current 3000-word constraint approach
 */

import 'dotenv/config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!OPENAI_API_KEY && !ANTHROPIC_API_KEY) { console.error('Need OPENAI_API_KEY or ANTHROPIC_API_KEY'); process.exit(1); }

// ═══════════════════════════════════════════════════════════
// THE EXAMPLE STORY (Guy's reference — target quality level)
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

// ═══════════════════════════════════════════════════════════
// FEW-SHOT PROMPT — short and focused
// ═══════════════════════════════════════════════════════════

function buildFewShotPrompt({ childName, childAge, gender, topic, companion, superpower }) {
  const genderHe = gender === 'girl' ? 'בת' : 'בן';
  const pronounHe = gender === 'girl' ? 'היא' : 'הוא';

  return {
    system: `אתה סופר ילדים ישראלי. הנה דוגמה לסיפור ברמה שאתה חייב לכתוב:

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

פורמט: JSON בלבד: { "title": "...", "scenes": [{ "page": 1, "text": "..." }, ...] }`,

    user: `כתוב סיפור חדש עבור ${childName}, ${genderHe} ${childAge}.
הנושא: ${topic}.
היצור: ${companion.name} — ${companion.description}.
הכוח של ${childName}: ${superpower}.

דגשים:
- מטאפורה מרכזית: דבר אחד מוזר שקורה בחדר שמשקף את האתגר הפנימי של ${childName}. לא ליטרלי.
- ${companion.name} מנסה לתקן את זה בדרך מצחיקה ולא נכונה.
- ${childName} פועל/ת ופותר/ת — הפתרון בא מפעולה של ${childName}, לא מהיצור.
- טוויסט שמפתיע. רגע WOW אחד. 2 רגעים מצחיקים אמיתיים.
- כל סצנה = רגע ויזואלי אחד שאפשר לצייר. 60-90 מילים.`
  };
}

// ═══════════════════════════════════════════════════════════
// API CALL
// ═══════════════════════════════════════════════════════════

async function callOpenAI(system, user, model = 'gpt-5.3-chat-latest') {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  console.log(`\n--- Calling ${model} ---`);
  console.log(`System: ${system.length} chars | User: ${user.length} chars | Total: ${system.length + user.length} chars\n`);

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
  // GPT-5.3 only supports temperature=1, older models accept custom values
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
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const totalTokens = data.usage?.total_tokens || 0;

  // Cost calculation
  let costPerInputM, costPerOutputM;
  if (model.includes('5.3')) {
    costPerInputM = 1.75; costPerOutputM = 14.00;
  } else if (model.includes('4o')) {
    costPerInputM = 2.50; costPerOutputM = 10.00;
  } else {
    costPerInputM = 2.50; costPerOutputM = 10.00;
  }
  const cost = (inputTokens * costPerInputM + outputTokens * costPerOutputM) / 1_000_000;

  console.log(`Done in ${elapsed}s | Tokens: ${totalTokens} (in:${inputTokens} out:${outputTokens}) | Cost: $${cost.toFixed(4)}`);
  return data.choices[0].message.content;
}

async function callClaude(system, user) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set — skipping Claude');
  console.log('\n--- Calling Claude Sonnet 4 ---');
  console.log(`System: ${system.length} chars | User: ${user.length} chars | Total: ${system.length + user.length} chars\n`);

  const start = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_completion_tokens: 6000,
      temperature: 0.95,
      system: system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s | Tokens: ${data.usage?.output_tokens}`);
  return data.content[0].text;
}

// ═══════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════

const TEST_CASES = [
  {
    name: 'NIGHT_FEAR — Girl, age 5, fear of dark',
    childName: 'מאיה',
    childAge: 5,
    gender: 'girl',
    topic: 'פחד מהחושך — בלילה כשנכבה האור הכל נראה מפחיד ושונה',
    companion: { name: 'פוף', description: 'עטלף קטן וביישן עם כנפיים גדולות מדי, שתמיד מתנגש בדברים ומתנצל' },
    superpower: 'אור רך שיוצא מהידיים כשהיא מדמיינת דברים יפים',
  },
  {
    name: 'LOUD_NOISES — Boy, age 4, fear of loud noises',
    childName: 'איתי',
    childAge: 4,
    gender: 'boy',
    topic: 'פחד מרעשים חזקים — רעמים, זיקוקים, צפירות, כל רעש חזק גורם לו לקפוא',
    companion: { name: 'טופי', description: 'חתול פסים שמן שחושב שהוא נמר, אבל מפחד מצלילים יותר מכולם' },
    superpower: 'שירה שקטה שהופכת רעשים מפחידים למוזיקה',
  },
];

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

function printStory(raw, modelName) {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to find JSON in the response
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error('Could not parse JSON from response');
  }

  console.log(`\n[${modelName}] Title: ${parsed.title}`);
  console.log(`Scenes: ${parsed.scenes?.length || 0}`);
  console.log('\n--- FULL STORY ---\n');

  for (const scene of (parsed.scenes || [])) {
    const wordCount = scene.text.split(/\s+/).length;
    console.log(`[Page ${scene.page}] (${wordCount} words)`);
    console.log(scene.text);
    console.log();
  }

  const totalWords = (parsed.scenes || []).reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);
  console.log(`--- STATS [${modelName}] ---`);
  console.log(`Total words: ${totalWords}`);
  console.log(`Scenes: ${parsed.scenes?.length}`);
  console.log(`Avg words/scene: ${(totalWords / (parsed.scenes?.length || 1)).toFixed(0)}`);

  const fullText = (parsed.scenes || []).map(s => s.text).join(' ');
  const forbidden = ['הרגישה', 'הרגיש', 'ידעה שהכל', 'נרגעה', 'פחד', 'אומץ', 'ביטחון', 'הכל יסתדר', 'החליטה להיות אמיצה', 'למדה ש', 'הבינה ש', 'התגברה על'];
  const found = forbidden.filter(w => fullText.includes(w));
  console.log(`Forbidden words: ${found.length > 0 ? found.join(', ') : 'NONE ✓'}`);

  // Check rhythm — count lines with ≤3 words (short punchy lines)
  const allLines = (parsed.scenes || []).flatMap(s => s.text.split('\n'));
  const shortLines = allLines.filter(l => l.trim() && l.trim().split(/\s+/).length <= 3);
  console.log(`Short punchy lines (≤3 words): ${shortLines.length} / ${allLines.filter(l => l.trim()).length} total lines`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Few-Shot Story Generation Test — Iteration 3   ║');
  console.log('║   Example + rhythm guidance + forbidden words     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Only test first case to save time/money — the NIGHT_FEAR girl
  const test = TEST_CASES[0];
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`TEST: ${test.name}`);
  console.log(`${'═'.repeat(60)}`);

  const { system, user } = buildFewShotPrompt(test);

  // Test GPT-5.3
  if (OPENAI_API_KEY) {
    try {
      const raw = await callOpenAI(system, user, 'gpt-5.3-chat-latest');
      printStory(raw, 'GPT-5.3');
    } catch (err) {
      console.error(`GPT-5.3 ERROR: ${err.message}`);
      // Fallback to GPT-4o if 5.3 not available
      console.log('\nFalling back to GPT-4o...');
      try {
        const raw = await callOpenAI(system, user, 'gpt-4o');
        printStory(raw, 'GPT-4o');
      } catch (err2) {
        console.error(`GPT-4o ERROR: ${err2.message}`);
      }
    }
  }

  // Test Claude if key exists
  if (ANTHROPIC_API_KEY) {
    try {
      const raw = await callClaude(system, user);
      printStory(raw, 'Claude Sonnet 4');
    } catch (err) {
      console.error(`Claude ERROR: ${err.message}`);
    }
  }

  if (!OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
    console.error('No API keys set. Add OPENAI_API_KEY and/or ANTHROPIC_API_KEY to .env');
  }
}

main().catch(console.error);
