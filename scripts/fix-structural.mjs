#!/usr/bin/env node
/**
 * Structural Story Fixer — custom prompts for content/message fixes
 *
 * Usage:
 *   node scripts/fix-structural.mjs           # fix all 3 stories
 *   node scripts/fix-structural.mjs --dry-run  # show what would be fixed
 *   node scripts/fix-structural.mjs --only 32b # fix only one story
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
  {
    file: 'batch-11_32b.md',
    id: '32b',
    description: 'Fix resilience message — child copes WITHIN the room, not escapes',
    pages: [11,12,13,14,15],
    buildPrompt(pages) {
      let prompt = `אתה עורך סיפורי ילדים בעברית (גיל 3-6). שכתב עמודים 11-15 בסיפור הבא.

## הבעיה:
בגרסה הנוכחית, הילדה מוצאת דלת נסתרת ובורחת מחדר המבחנים. המסר: כשקשה — תברחי.
זה ההיפך מחוסן. במוצר שלנו, הילד צריך להתמודד ולמצוא דרך לפעול בתוך הקושי, לא לברוח ממנו.

## מה צריך לקרות בעמודים 11-15:
- הילדה מבינה שהקירות מגיבים לא רק לתשובות שגויות — אלא ללחץ שלה. ככל שהיא לחוצה יותר, הם מתקרבים.
- היא מחליטה להפסיק לענות "נכון" ולענות בדרך שלה — כנה, לא מושלמת
- כשהיא כותבת תשובה אמיתית (לא "נכונה", אלא שלה) — הקירות עוצרים
- היא ממשיכה — תשובה שלה, ועוד אחת — והקירות נסוגים
- הסוף: החדר חוזר לגודל רגיל, הדף מלא בתשובות עקומות, והמחק אומר משהו מצחיק

## כללים:
- שמור על {{childName}} ו-{{companionName}} בדיוק כמו שהם
- {{companionName}} הוא מחק ורוד — חצוף, מוחק הכל, מצחיק
- שמור על הסגנון high_energy של הסיפור
- כל עמוד 25-32 מילים (טקסט בלבד, לא כולל imageDirection)
- כתוב גם imageDirection חדש לכל עמוד (באנגלית)
- שפה פשוטה, משפטים קצרים, ריגוש פיזי

## הסיפור המלא (הקשר):
`;
      for (const p of pages) {
        prompt += '\n--- Page ' + p.pageNum + ' --- [' + p.wordCount + ' מילים]\n' + p.text + '\n';
        if (p.imageDir) prompt += p.imageDir + '\n';
      }
      prompt += `\n\n## שכתב רק עמודים 11-15. פורמט תשובה — בדיוק ככה:

--- Page 11 ---
[טקסט מתוקן]

imageDirection: [תיאור באנגלית]

--- Page 12 ---
[טקסט מתוקן]

imageDirection: [תיאור באנגלית]

(וכו׳ עד עמוד 15)`;
      return prompt;
    }
  },
  {
    file: 'batch-10_28b.md',
    id: '28b',
    description: 'Rewrite — new companion, Hebrew screens, tighter middle',
    pages: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    buildPrompt(pages) {
      let prompt = `אתה כותב סיפורי ילדים בעברית (גיל 3-6). שכתב את הסיפור הבא מאפס, אותה עלילה, עם השינויים הבאים:

## העלילה (לשמור):
מכונת חיבוקים עם זרועות רכות. הייתה שייכת לילדה. אבל מאז שהגיע תינוק חדש — המכונה מחבקת רק אותו ולא עוצרת. הילדה מרגישה שנשכחה. היא מנסה דרכים שונות, נכשלת, ואז פותחת את המכונה מאחור ובונה מתג נוסף כדי שיהיו שני משתמשים. בסוף — שתי זרועות מחבקות, אחת לילדה ואחת לתינוק.

## שינויים נדרשים:
1. **דמות נלוות חדשה**: במקום "פיית מברגים" (שהיא חלשה), צור בורג קטן וחצוף שגר בתוך המכונה. הוא מכיר אותה מבפנים, מדבר כמו טכנאי ותיק שכבר ראה הכל, קצת דרמטי, קצת מתלונן. הוא {{companionName}}.
2. **כל הטקסט על מסכים — בעברית**: "משתמש חדש בלבד", "שני משתמשים", "סוללה נמוכה" — הכל בעברית. ילדים ישראליים קוראים עברית.
3. **אמצע חד**: כל ניסיון (עמודים 5-9) צריך להיות שונה מהותית ולהתקדם. לא אותה תבנית חוזרת של "ניסיון→כישלון". כל ניסיון מלמד אותה משהו חדש על המכונה.
4. **הומור**: הסגנון הוא chaotic_comedy. צריך להיות מצחיק!

## כללים:
- שמור על {{childName}} ו-{{companionName}} בדיוק כמו שהם
- 15 עמודים, כל עמוד 27-34 מילים עבריות (לא כולל imageDirection)
- כתוב imageDirection לכל עמוד (באנגלית)
- שפה פשוטה, משפטים קצרים, דיאלוג חי

## הסיפור המקורי (לרפרנס בלבד):
`;
      for (const p of pages) {
        prompt += '\n--- Page ' + p.pageNum + ' ---\n' + p.text + '\n';
      }
      prompt += `\n\n## כתוב את הסיפור המלא מחדש. פורמט:

--- Page 1 ---
[טקסט]

imageDirection: [תיאור באנגלית]

--- Page 2 ---
[וכו׳ עד עמוד 15]`;
      return prompt;
    }
  },
  {
    file: 'batch-09_25b.md',
    id: '25b',
    description: 'Sharpen climax pages 11-13 — less chaos, more focus',
    pages: [11,12,13],
    buildPrompt(pages) {
      let prompt = `אתה עורך סיפורי ילדים בעברית (גיל 3-6). שכתב עמודים 11-13 בסיפור הבא.

## הבעיה:
השיא (עמודים 11-13) מבולגן מדי. יותר מדי שלטים, יותר מדי פעולות, הקורא מאבד את החוט. עמוד 11 ב-50 מילים — מנפח ומאבד מיקוד.

## מה צריך:
- עמוד 11: הרגע שהיא מחליטה לכתוב — דף אחד, טוש אחד, משפט אחד. פשוט וחד. הפעולה הפיזית של ההדבקה צריכה להרגיש כמו מעשה אומץ. 28-35 מילים.
- עמוד 12: היא ממשיכה — עוד דפים, מהר יותר, מבולגן יותר, אבל כל דף אומר משהו אמיתי וקונקרטי. התוכי מתרגש. 28-35 מילים.
- עמוד 13: הרגע המכריע — היא מדביקה דף גדול מעל "רגילה", והשלט הישן מתרופף ויוצא. רגע של "פופ" או שחרור פיזי. 28-35 מילים.

## כללים:
- שמור על {{childName}} ו-{{companionName}} בדיוק כמו שהם
- {{companionName}} הוא תוכי נייר מקומט שצועק מה שכתוב עליו
- שמור על הסגנון chaotic_comedy
- כתוב גם imageDirection חדש (באנגלית)
- שפה פשוטה, משפטים קצרים

## הסיפור המלא (הקשר):
`;
      for (const p of pages) {
        prompt += '\n--- Page ' + p.pageNum + ' --- [' + p.wordCount + ' מילים]\n' + p.text + '\n';
        if (p.imageDir) prompt += p.imageDir + '\n';
      }
      prompt += `\n\n## שכתב רק עמודים 11, 12, 13. פורמט:

--- Page 11 ---
[טקסט מתוקן]

imageDirection: [תיאור באנגלית]

--- Page 12 ---
[טקסט מתוקן]

imageDirection: [תיאור באנגלית]

--- Page 13 ---
[טקסט מתוקן]

imageDirection: [תיאור באנגלית]`;
      return prompt;
    }
  }
];

// ====== MAIN ======
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlyIdx = args.indexOf('--only');
  const onlyId = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

  const toFix = onlyId ? fixes.filter(f => f.id === onlyId) : fixes;

  if (toFix.length === 0) {
    console.error('No fix found for id: ' + onlyId);
    process.exit(1);
  }

  for (const fix of toFix) {
    console.log('\n' + '='.repeat(50));
    console.log('  ' + fix.id + ': ' + fix.description);
    console.log('  Pages: ' + fix.pages.join(','));

    const filePath = path.join(RAW, fix.file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { header, pages } = parseStory(content);

    if (pages.length !== 15) {
      console.log('  ERROR: parsed ' + pages.length + ' pages');
      continue;
    }

    const oldTotal = pages.reduce((s, p) => s + p.wordCount, 0);
    const fullPrompt = fix.buildPrompt(pages);

    if (dryRun) {
      console.log('  [DRY RUN] Would fix pages ' + fix.pages.join(','));
      console.log('  Prompt length: ' + fullPrompt.length + ' chars');
      console.log('  Current total: ' + oldTotal + ' words');
      continue;
    }

    // Backup
    const backupPath = filePath.replace('.md', '_backup_structural.md');
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
      console.log('  Backup saved');
    }

    try {
      const reply = await callGPT(fullPrompt);
      const fixedPages = extractPages(reply);
      const fixedCount = Object.keys(fixedPages).length;

      console.log('  Got ' + fixedCount + ' pages back');

      if (fixedCount === 0) {
        console.log('  WARNING: 0 pages parsed from response');
        console.log('  Raw reply (first 500 chars):');
        console.log(reply.slice(0, 500));
        continue;
      }

      // Apply fixes
      for (const [pn, data] of Object.entries(fixedPages)) {
        const idx = pages.findIndex(p => p.pageNum === parseInt(pn));
        if (idx !== -1) {
          const oldWC = pages[idx].wordCount;
          pages[idx].text = data.text;
          pages[idx].wordCount = countHebrewWords(data.text);
          if (data.imageDir) pages[idx].imageDir = data.imageDir;
          console.log('  P' + pn + ': ' + oldWC + ' → ' + pages[idx].wordCount + ' words' + (data.imageDir ? ' (+img)' : ''));
        }
      }

      const rebuilt = rebuildStory(header, pages);
      fs.writeFileSync(filePath, rebuilt, 'utf-8');

      const newTotal = pages.reduce((s, p) => s + p.wordCount, 0);
      console.log('  SAVED (' + oldTotal + ' → ' + newTotal + ' total words)');

      // Rate limit between API calls
      console.log('  Waiting 3s...');
      await new Promise(r => setTimeout(r, 3000));

    } catch (err) {
      console.error('  ERROR: ' + err.message);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('  DONE');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
