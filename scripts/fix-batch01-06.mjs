#!/usr/bin/env node
/**
 * Comprehensive Batch 01-06 Story Fixer
 *
 * Phase 1 (HIGH): Trim 5 bloated stories via GPT
 * Phase 2 (MEDIUM): Fix companion passivity in 2 Batch-05 stories via GPT
 * Phase 3 (LOW): Add WORD_COUNT metadata to 8 stories (no GPT)
 *
 * Usage:
 *   node scripts/fix-batch01-06.mjs                # run all
 *   node scripts/fix-batch01-06.mjs --dry-run      # show plan only
 *   node scripts/fix-batch01-06.mjs --only 11a     # run one fix
 *   node scripts/fix-batch01-06.mjs --phase high   # run only HIGH
 *   node scripts/fix-batch01-06.mjs --phase medium
 *   node scripts/fix-batch01-06.mjs --phase low
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv(path.join(ROOT, '.env.local'));
loadEnv(path.join(ROOT, '.env'));

const MODEL = process.env.STORY_MODEL || 'gpt-5.3-chat-latest';
const RAW = path.join(ROOT, 'story-bank', 'raw');

// ====== SHARED UTILS ======

function countHebrewWords(text) {
  const lines = text.split('\n').filter(l => !l.trim().startsWith('imageDirection:'));
  const joined = lines.join(' ').replace(/\{\{[^}]+\}\}/g, 'מילה').replace(/\s+/g, ' ').trim();
  if (!joined) return 0;
  return joined.split(' ').filter(t => /[֐-׿]/.test(t) || /[a-zA-Z0-9]/.test(t)).length;
}

function parseStory(content) {
  const firstPage = content.match(/--- Page 1 ---/);
  const header = firstPage ? content.substring(0, firstPage.index).trim() : '';
  const pages = [];
  const pageRegex = /--- Page (\d+) ---\s*\n([\s\S]*?)(?=--- Page \d+ ---|\nWORD_COUNT:|$)/g;
  let m;
  while ((m = pageRegex.exec(content)) !== null) {
    const pageNum = parseInt(m[1]);
    const body = m[2].trim();
    const imgMatch = body.match(/\nimageDirection:\s*/);
    let text, imageDir;
    if (imgMatch) {
      text = body.substring(0, imgMatch.index).trim();
      imageDir = body.substring(imgMatch.index).trim();
    } else if (body.startsWith('imageDirection:')) {
      text = ''; imageDir = body;
    } else {
      text = body; imageDir = '';
    }
    text = text.replace(/\n---\s*$/g, '').trim();
    imageDir = imageDir.replace(/\n---\s*$/g, '').trim();
    pages.push({ pageNum, text, imageDir, wordCount: countHebrewWords(text) });
  }
  return { header, pages };
}

function rebuildStory(header, pages) {
  let out = header + '\n\n';
  for (const p of pages) {
    out += '--- Page ' + p.pageNum + ' ---\n';
    out += p.text + '\n\n';
    if (p.imageDir) out += p.imageDir + '\n\n';
  }
  const counts = pages.map(p => p.wordCount);
  const total = counts.reduce((a, b) => a + b, 0);
  out += 'WORD_COUNT: [' + counts.join(', ') + '] = ' + total;
  return out;
}

async function callGPT(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
  };
  if (MODEL.startsWith('gpt-5.')) {
    body.max_completion_tokens = 6000;
  } else {
    body.max_tokens = 6000;
    body.temperature = 0.7;
  }
  console.log('  [API] Calling ' + MODEL + '...');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('OpenAI ' + res.status + ': ' + (await res.text()).slice(0, 300));
  const data = await res.json();
  console.log('  [API] tokens: ' + (data.usage?.total_tokens || 0));
  return data.choices[0].message.content;
}

function extractPages(reply) {
  const fixed = {};
  const fixRegex = /--- Page (\d+) ---\s*\n([\s\S]*?)(?=\n--- Page \d+ ---|$)/g;
  let fm;
  while ((fm = fixRegex.exec(reply)) !== null) {
    const body = fm[2].trim();
    const imgMatch = body.match(/\nimageDirection:\s*/);
    let text, imageDir;
    if (imgMatch) {
      text = body.substring(0, imgMatch.index).trim();
      imageDir = body.substring(imgMatch.index).trim();
    } else {
      text = body;
      imageDir = null;
    }
    fixed[parseInt(fm[1])] = { text, imageDir };
  }
  return fixed;
}

// ====== FIX DEFINITIONS ======

const fixes = [

  // ========================
  // PHASE 1: HIGH — TRIM
  // ========================

  {
    file: 'batch-04_11a.md',
    id: '11a',
    phase: 'high',
    description: 'Trim 730→~480 words + fix broken WORD_COUNT',
    pages: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    buildPrompt(pages) {
      let prompt = `אתה עורך סיפורי ילדים בעברית (גיל 3-6). קצר את הסיפור הבא.

## הבעיה:
הסיפור הנוכחי 730 מילים — כמעט כפול מהיעד. הרבה תיאורים מתפרשים על יותר מדי מילים. המטאפורה והאמוציה מצוינים — רק צריך להדק.

## מה לשמור:
- המבנה: גשר שמסרב להתחבר, הילדה פורקת את הגשר שלה כדי לגשר על הפער
- הדמות הנלווית: {{companionName}} — בונה חצופה עם סרט מדידה, דרמטית ומצחיקה
- הסגנון: high_energy
- ה-emotionalArc: סדר → בלבול → בחירה כואבת (לפרק את המושלם) → חיבור לא מושלם אבל עובד
- המטאפורה: ויתור על שלמות בשביל חיבור
- הקליימקס (P11-13): משיכת קרשים, בניית מעבר אלתורי, הקרבה פיזית

## כללים:
- 15 עמודים, כל עמוד 27-35 מילים (טקסט בלבד, לא imageDirection)
- יעד כולל: 430-480 מילים
- שמור על {{childName}}, {{companionName}}, {{parentName}} בדיוק ככה
- שמור על imageDirection קיים (שנה רק אם הטקסט השתנה מהותית)
- שפה פשוטה, משפטים קצרים, דיאלוג חי
- עמודי קליימקס (11-13): מינימום 28 מילים כל אחד

## הסיפור הנוכחי:
`;
      for (const p of pages) {
        prompt += '\n--- Page ' + p.pageNum + ' --- [' + p.wordCount + 'w]\n' + p.text + '\n';
        if (p.imageDir) prompt += p.imageDir + '\n';
      }
      prompt += `\n\n## כתוב את כל 15 העמודים מחדש — מקוצרים. פורמט:

--- Page 1 ---
[טקסט]

imageDirection: [תיאור באנגלית]

--- Page 2 ---
[וכו׳ עד עמוד 15]`;
      return prompt;
    }
  },

  {
    file: 'batch-03_7a.md',
    id: '7a',
    phase: 'high',
    description: 'Trim 605→~480 words — tighten middle, keep dreamy tone',
    pages: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    buildPrompt(pages) {
      let prompt = `אתה עורך סיפורי ילדים בעברית (גיל 3-6). קצר את הסיפור הבא.

## הבעיה:
הסיפור 605 מילים — צריך לרדת ל-~480. הסגנון שירי ויפה, אבל חלק מהעמודים מתפרסים. במיוחד עמודים 2-6 ו-11-13 — הרבה שורות קצרות שאפשר לדחוס.

## מה לשמור:
- המטאפורה: שלג שמגן אבל מקפיא, צריך לפתוח חלון ולהכניס קצת חדות
- הדמות: {{companionName}} — אישה קטנה עטופה צעיף, אוספת זיכרונות בצנצנת זכוכית
- הסגנון: dreamy_poetic — שורות קצרות וריתמיות, אבל לא 15 שורות בעמוד
- הקליימקס: פתיחת חלון, כניסת צליל, שלג נמס

## כללים:
- 15 עמודים, כל עמוד 27-35 מילים (שירי זה בסדר אם זה 30-35)
- יעד כולל: 430-480 מילים
- שמור על {{childName}}, {{companionName}} בדיוק ככה
- שמור על הסגנון השירי — שורות קצרות בסדר, אבל פחות מהן בעמוד
- שמור/עדכן imageDirection
- עמודי קליימקס (11-13): מינימום 28 מילים

## הסיפור הנוכחי:
`;
      for (const p of pages) {
        prompt += '\n--- Page ' + p.pageNum + ' --- [' + p.wordCount + 'w]\n' + p.text + '\n';
        if (p.imageDir) prompt += p.imageDir + '\n';
      }
      prompt += `\n\n## כתוב את כל 15 העמודים מחדש — מקוצרים. פורמט:

--- Page 1 ---
[טקסט]

imageDirection: [תיאור באנגלית]

--- Page 2 ---
[וכו׳ עד עמוד 15]`;
      return prompt;
    }
  },

  {
    file: 'batch-04_10a.md',
    id: '10a',
    phase: 'high',
    description: 'Trim 685→~480 words — remove repetitive push/pull descriptions',
    pages: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    buildPrompt(pages) {
      let prompt = `אתה עורך סיפורי ילדים בעברית (גיל 3-6). קצר את הסיפור הבא.

## הבעיה:
הסיפור 685 מילים — צריך לרדת ל-~480. יש חזרתיות: "ניסתה שוב", "עוד פעם", "יותר חזק" חוזרים בעמודים 5-9. גם התיאורים הפיזיים (משיכה, דחיפה, ענפים חוזרים למקום) חוזרים על עצמם.

## מה לשמור:
- המטאפורה: עץ עם ענפים מסובכים שחונקים אותו, צריך לגזום כדי לפתוח מקום
- הדמות: {{companionName}} — ציפור קטנה שגם היא מנסה להיכנס ולא מצליחה
- הסגנון: quiet_intimate
- הקליימקס (11-13): החלטה לחתוך ענף, מאמץ פיזי עם מספריים, ענפים נפתחים
- הרגע הרגשי: "לא... זה הענף הכי ארוך שלו. הוא ניסה להגיע איתו למישהו."

## כללים:
- 15 עמודים, כל עמוד 27-35 מילים
- יעד כולל: 430-480 מילים
- שמור על {{childName}}, {{companionName}} בדיוק ככה
- שמור/עדכן imageDirection
- עמודי קליימקס (11-13): מינימום 28 מילים

## הסיפור הנוכחי:
`;
      for (const p of pages) {
        prompt += '\n--- Page ' + p.pageNum + ' --- [' + p.wordCount + 'w]\n' + p.text + '\n';
        if (p.imageDir) prompt += p.imageDir + '\n';
      }
      prompt += `\n\n## כתוב את כל 15 העמודים — מקוצרים. פורמט:

--- Page 1 ---
[טקסט]

imageDirection: [תיאור באנגלית]

--- Page 2 ---
[וכו׳ עד עמוד 15]`;
      return prompt;
    }
  },

  {
    file: 'batch-04_10b.md',
    id: '10b',
    phase: 'high',
    description: 'Trim 692→~480 words — tighten verbose middle',
    pages: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    buildPrompt(pages) {
      let prompt = `אתה עורך סיפורי ילדים בעברית (גיל 3-6). קצר את הסיפור הבא.

## הבעיה:
הסיפור 692 מילים — צריך לרדת ל-~480. העמודים שמנים מדי (45-52 מילים כל אחד). יש הרבה תיאורים שאפשר לדחוס — "הקוביות רעדו, הביטו בה, ולחשו" אפשר לקצר ל"הקוביות רעדו ולחשו".

## מה לשמור:
- המטאפורה: צעצועים שצריכים שניים כדי לפעול, לא עובדים לבד
- הדמות: {{companionName}} — מפקד מסילה קטנטן עם כובע מצחייה ושריקה
- הסגנון: chaotic_comedy — מצחיק, אנרגטי, דיאלוגים חצופים
- הקליימקס (11-13): הילדה קוראת להורה, יחד מפעילים את החבל, המסילה, הקוביות
- {{parentName}} נכנס רק מעמוד 11 — זה הרגע המכריע

## כללים:
- 15 עמודים, כל עמוד 27-35 מילים
- יעד כולל: 430-480 מילים
- שמור על {{childName}}, {{companionName}}, {{parentName}} בדיוק ככה
- שמור/עדכן imageDirection
- עמודי קליימקס (11-13): מינימום 28 מילים

## הסיפור הנוכחי:
`;
      for (const p of pages) {
        prompt += '\n--- Page ' + p.pageNum + ' --- [' + p.wordCount + 'w]\n' + p.text + '\n';
        if (p.imageDir) prompt += p.imageDir + '\n';
      }
      prompt += `\n\n## כתוב את כל 15 העמודים — מקוצרים. פורמט:

--- Page 1 ---
[טקסט]

imageDirection: [תיאור באנגלית]

--- Page 2 ---
[וכו׳ עד עמוד 15]`;
      return prompt;
    }
  },

  {
    file: 'batch-06_18b.md',
    id: '18b',
    phase: 'high',
    description: 'Light trim 664→~520 words — tighten middle, strong content',
    pages: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    buildPrompt(pages) {
      let prompt = `אתה עורך סיפורי ילדים בעברית (גיל 3-6). קצר קלות את הסיפור הבא.

## הבעיה:
הסיפור 664 מילים — צריך לרדת ל-~520. התוכן מצוין אבל חלק מהעמודים מרחיבים יותר מדי. עמודים 3-6 ו-10-12 צריכים קיצור קל. לא צריך שכתוב, רק הידוק.

## מה לשמור (חשוב מאוד!):
- המטאפורה: שריון שנבנה מדברים מפחידים, כיסא רופא שיניים שהופך לכס מלכות
- הדמות: {{companionName}} — לטאה שמשנה צבעים לפי רגשות (ירוק=פחד, כתום=רוצה לברוח, אדום=כנות, כחול=גאווה)
- הסגנון: wild_physical
- הקליימקס (11-13): הילדה מטפסת לכיסא, פותחת פה, הדרקון עובד, השריון נדלק מבפנים
- המשפט המפתח של {{companionName}}: "זה באמת מפחיד. ואני נשארת פה בכל צבע."
- הסוף: הלטאה כחולה מגאווה, "גם אני לא אוהבת את הווווום. אבל עברנו אותו."

## כללים:
- 15 עמודים, כל עמוד 30-38 מילים (סיפור עשיר, מותר קצת יותר)
- יעד כולל: 490-530 מילים
- שמור על {{childName}}, {{companionName}} בדיוק ככה
- שמור/עדכן imageDirection
- עמודי קליימקס (11-13): מינימום 28 מילים
- קצר בעדינות — הסיפור הזה טוב, רק צריך הידוק

## הסיפור הנוכחי:
`;
      for (const p of pages) {
        prompt += '\n--- Page ' + p.pageNum + ' --- [' + p.wordCount + 'w]\n' + p.text + '\n';
        if (p.imageDir) prompt += p.imageDir + '\n';
      }
      prompt += `\n\n## כתוב את כל 15 העמודים — מהודקים. פורמט:

--- Page 1 ---
[טקסט]

imageDirection: [תיאור באנגלית]

--- Page 2 ---
[וכו׳ עד עמוד 15]`;
      return prompt;
    }
  },

  // ========================
  // PHASE 2: MEDIUM — COMPANION ACTIVATION
  // ========================

  {
    file: 'batch-05_13b.md',
    id: '13b',
    phase: 'medium',
    description: 'Activate companion — too passive, just comments',
    pages: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    buildPrompt(pages) {
      let prompt = `אתה עורך סיפורי ילדים בעברית (גיל 3-6). שפר את הדמות הנלווית בסיפור הבא.

## הבעיה:
{{companionName}} (הדמות הנלווית) פסיבי מדי. כל מה שהוא עושה זה להגיב: "אוי", "היא לא אוהבת את זה", "זו קופסה דעתנית". הוא צריך להיות שותף פעיל — לנסות דברים, להציע רעיונות (גם שגויים), ליצור אנרגיה.

## מה לשנות:
- עמוד 3: במקום רק להיבהל, שיגיב בצורה יותר אקטיבית (יקפוץ, ינסה לפתוח)
- עמוד 5: שינסה גם הוא — אולי ידחוף, ייפול, יתלונן בצורה מצחיקה
- עמוד 8: שיהיה חלק מהתצפית — אולי הוא שם לב למשהו ספציפי
- עמוד 10: במקום "קופסה דעתנית" — שיציע רעיון (אולי שגוי)
- עמוד 12: שיעשה משהו פיזי — יעודד, יעזור, ירקוד

## מה לא לשנות:
- את הפלוט בכלל — הקופסה גדלה מכוח ומתכווצת מעדינות
- את העלילה או הפתרון
- את ה-solutionType: TRICK
- את הסגנון: playful_clever
- imageDirection — שנה רק בעמודים שהטקסט השתנה מהותית

## כללים:
- שמור על {{childName}} ו-{{companionName}} בדיוק ככה
- כל עמוד 25-35 מילים
- שמור על הסגנון playful_clever

## הסיפור:
`;
      for (const p of pages) {
        prompt += '\n--- Page ' + p.pageNum + ' --- [' + p.wordCount + 'w]\n' + p.text + '\n';
        if (p.imageDir) prompt += p.imageDir + '\n';
      }
      prompt += `\n\n## כתוב את כל 15 העמודים (שינויים רק בדמות הנלווית). פורמט:

--- Page 1 ---
[טקסט]

imageDirection: [תיאור באנגלית]

--- Page 2 ---
[וכו׳ עד עמוד 15]`;
      return prompt;
    }
  },

  {
    file: 'batch-05_14b.md',
    id: '14b',
    phase: 'medium',
    description: 'Activate companion — mostly reactive observer',
    pages: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    buildPrompt(pages) {
      let prompt = `אתה עורך סיפורי ילדים בעברית (גיל 3-6). שפר את הדמות הנלווית בסיפור הבא.

## הבעיה:
{{companionName}} (הדמות הנלווית) כמעט רק מגיב — "שער עקשן", "זה מחיר". הוא צריך לנסות דברים בעצמו, לבלבל, להציע, להיכשל — ליצור אנרגיה. הוא יודע לשאול את השאלה הנכונה ברגע הנכון, אבל גם צריך לנסות דברים פיזיים.

## מה לשנות:
- עמוד 3: שינסה גם הוא — יקפוץ על השער, ידחוף, ייפול
- עמוד 6: שישתתף בגילוי — אולי ימצא את החוט, או יראה אותו ראשון
- עמוד 8: שיציע רעיון לא נכון לפני שהילדה מבינה — "אולי צריך להביא עוד עלים?"
- עמוד 11: שירגיש את הכאב של הילדה — ירגע, ישאל בקול רך
- עמוד 13: שיהיה חלק מהמתח — יעודד, ירעד, ידחוף

## מה לא לשנות:
- את הפלוט: שער שנפתח רק כשנותנים לו משהו אישי
- solutionType: TRADE
- הסגנון: emotional_clear
- הצמיד כסמל — זה חייב להישאר

## כללים:
- שמור על {{childName}} ו-{{companionName}} בדיוק ככה
- כל עמוד 25-35 מילים
- שמור על הסגנון emotional_clear

## הסיפור:
`;
      for (const p of pages) {
        prompt += '\n--- Page ' + p.pageNum + ' --- [' + p.wordCount + 'w]\n' + p.text + '\n';
        if (p.imageDir) prompt += p.imageDir + '\n';
      }
      prompt += `\n\n## כתוב את כל 15 העמודים (שינויים רק בדמות הנלווית). פורמט:

--- Page 1 ---
[טקסט]

imageDirection: [תיאור באנגלית]

--- Page 2 ---
[וכו׳ עד עמוד 15]`;
      return prompt;
    }
  },

  // ========================
  // PHASE 3: LOW — METADATA ONLY (no GPT)
  // ========================

  { file: 'batch-03_8b.md', id: '8b', phase: 'low', description: 'Add WORD_COUNT metadata', pages: [] },
  { file: 'batch-03_9b.md', id: '9b', phase: 'low', description: 'Add WORD_COUNT metadata', pages: [] },
  { file: 'batch-05_13a.md', id: '13a', phase: 'low', description: 'Add WORD_COUNT metadata', pages: [] },
  { file: 'batch-05_14a.md', id: '14a', phase: 'low', description: 'Add WORD_COUNT metadata', pages: [] },
  { file: 'batch-05_15a.md', id: '15a', phase: 'low', description: 'Add WORD_COUNT metadata', pages: [] },
  { file: 'batch-05_15b.md', id: '15b', phase: 'low', description: 'Add WORD_COUNT metadata', pages: [] },
];

// ====== MAIN ======

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlyIdx = args.indexOf('--only');
  const onlyId = onlyIdx !== -1 ? args[onlyIdx + 1] : null;
  const phaseIdx = args.indexOf('--phase');
  const phaseFilter = phaseIdx !== -1 ? args[phaseIdx + 1] : null;

  let toFix = fixes;
  if (onlyId) toFix = fixes.filter(f => f.id === onlyId);
  if (phaseFilter) toFix = toFix.filter(f => f.phase === phaseFilter);

  if (toFix.length === 0) {
    console.error('No fixes matched filters');
    process.exit(1);
  }

  const gptFixes = toFix.filter(f => f.phase !== 'low');
  const metaFixes = toFix.filter(f => f.phase === 'low');

  console.log('='.repeat(60));
  console.log('  BATCH 01-06 COMPREHENSIVE FIX');
  console.log('  GPT fixes: ' + gptFixes.length + ' | Metadata fixes: ' + metaFixes.length);
  console.log('  Mode: ' + (dryRun ? 'DRY RUN' : 'LIVE'));
  console.log('='.repeat(60));

  // ---- GPT fixes (HIGH + MEDIUM) ----
  for (const fix of gptFixes) {
    console.log('\n' + '-'.repeat(50));
    console.log('  [' + fix.phase.toUpperCase() + '] ' + fix.id + ': ' + fix.description);

    const filePath = path.join(RAW, fix.file);
    if (!fs.existsSync(filePath)) {
      console.log('  ERROR: file not found: ' + fix.file);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const { header, pages } = parseStory(content);

    if (pages.length !== 15) {
      console.log('  ERROR: parsed ' + pages.length + ' pages (expected 15)');
      continue;
    }

    const oldTotal = pages.reduce((s, p) => s + p.wordCount, 0);
    const fullPrompt = fix.buildPrompt(pages);

    if (dryRun) {
      console.log('  [DRY RUN] Prompt: ' + fullPrompt.length + ' chars');
      console.log('  Current: ' + oldTotal + ' words [' + pages.map(p => p.wordCount).join(', ') + ']');
      continue;
    }

    // Backup
    const backupPath = filePath.replace('.md', '_backup_v2.md');
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
      console.log('  Backup → ' + path.basename(backupPath));
    }

    try {
      const reply = await callGPT(fullPrompt);
      const fixedPages = extractPages(reply);
      const fixedCount = Object.keys(fixedPages).length;

      console.log('  Got ' + fixedCount + ' pages back');

      if (fixedCount === 0) {
        console.log('  WARNING: 0 pages parsed from response');
        console.log('  Raw (first 500):');
        console.log(reply.slice(0, 500));
        continue;
      }

      for (const [pn, data] of Object.entries(fixedPages)) {
        const idx = pages.findIndex(p => p.pageNum === parseInt(pn));
        if (idx !== -1) {
          pages[idx].text = data.text;
          pages[idx].wordCount = countHebrewWords(data.text);
          if (data.imageDir) pages[idx].imageDir = data.imageDir;
        }
      }

      const rebuilt = rebuildStory(header, pages);
      fs.writeFileSync(filePath, rebuilt, 'utf-8');

      const newTotal = pages.reduce((s, p) => s + p.wordCount, 0);
      console.log('  SAVED: ' + oldTotal + ' → ' + newTotal + ' words');
      console.log('  Pages: [' + pages.map(p => p.wordCount).join(', ') + ']');

      // Check for issues
      const thinClimax = pages.filter(p => [11,12,13].includes(p.pageNum) && p.wordCount < 28);
      if (thinClimax.length > 0) {
        console.log('  ⚠ THIN CLIMAX: ' + thinClimax.map(p => 'P' + p.pageNum + '=' + p.wordCount).join(', '));
        console.log('  → Run: node scripts/fix-stories.mjs --story ' + fix.id);
      }
      const floor = pages.filter(p => p.wordCount < 20);
      if (floor.length > 0) {
        console.log('  ⚠ FLOOR: ' + floor.map(p => 'P' + p.pageNum + '=' + p.wordCount).join(', '));
      }

      console.log('  Waiting 3s...');
      await new Promise(r => setTimeout(r, 3000));

    } catch (err) {
      console.error('  ERROR: ' + err.message);
    }
  }

  // ---- Metadata-only fixes (LOW) ----
  if (metaFixes.length > 0) {
    console.log('\n' + '-'.repeat(50));
    console.log('  [LOW] Adding WORD_COUNT metadata to ' + metaFixes.length + ' stories');
  }

  for (const fix of metaFixes) {
    const filePath = path.join(RAW, fix.file);
    if (!fs.existsSync(filePath)) {
      console.log('  ' + fix.id + ': file not found');
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Check if WORD_COUNT already exists
    if (content.includes('WORD_COUNT:')) {
      console.log('  ' + fix.id + ': already has WORD_COUNT — skipping');
      continue;
    }

    const { header, pages } = parseStory(content);
    if (pages.length !== 15) {
      console.log('  ' + fix.id + ': ERROR — ' + pages.length + ' pages');
      continue;
    }

    if (dryRun) {
      const total = pages.reduce((s, p) => s + p.wordCount, 0);
      console.log('  ' + fix.id + ': would add WORD_COUNT [' + pages.map(p => p.wordCount).join(', ') + '] = ' + total);
      continue;
    }

    const rebuilt = rebuildStory(header, pages);
    fs.writeFileSync(filePath, rebuilt, 'utf-8');

    const total = pages.reduce((s, p) => s + p.wordCount, 0);
    console.log('  ' + fix.id + ': WORD_COUNT added [' + pages.map(p => p.wordCount).join(', ') + '] = ' + total);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  ALL DONE');
  console.log('');
  console.log('  Next step: run fix-stories.mjs on any stories with ⚠ warnings above');
  console.log('  Example: node scripts/fix-stories.mjs --story 11a,7a,10a,10b,18b,13b,14b');
  console.log('='.repeat(60));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
