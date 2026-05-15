#!/usr/bin/env node
/**
 * cleanup-hebrew.mjs — Aggressive Hebrew quality rewrite for v3 stories.
 *
 * Goes beyond word substitution: REWRITES sentences that sound translated
 * from English. Targets native Hebrew children's-book voice (Datia Ben-Dor,
 * Leah Goldberg, Miri Yalan-Stekelis register).
 *
 * Preserves strictly:
 *   - Frontmatter (title, companionId, direction, category, gender, pages)
 *   - companionLetter block (if present)
 *   - Page count
 *   - --- Page N --- markers in order
 *   - imageDirection lines (English, untouched)
 *   - Plot, characters, ending type
 *
 * Rewrites freely:
 *   - Sentence structure
 *   - Word choices
 *   - Rhythm and dialogue phrasing
 *   - Nikud (preserves full nikud throughout)
 *
 * Output strategy:
 *   - Writes to `story-bank/v3-cleaned/` (NOT overwriting originals)
 *   - Allows side-by-side comparison before promoting
 *   - Separate "promote" step copies v3-cleaned → v3
 *
 * Usage:
 *   node scripts/cleanup-hebrew.mjs                # all stories
 *   node scripts/cleanup-hebrew.mjs --limit=3      # test on first 3
 *   node scripts/cleanup-hebrew.mjs --force        # re-clean already-done
 *   node scripts/cleanup-hebrew.mjs --concurrency=2
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error('❌ Set OPENAI_API_KEY'); process.exit(1); }

const MODEL = 'gpt-5.3-chat-latest';
const STORY_DIR = join(process.cwd(), 'story-bank', 'v3');
const CLEAN_DIR = join(process.cwd(), 'story-bank', 'v3-cleaned');
const AUDIT_DIR = join(process.cwd(), 'audits');

const FORCE = process.argv.includes('--force');
const LIMIT = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0', 10);
const CONCURRENCY = parseInt(process.argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] || '3', 10);

if (!existsSync(CLEAN_DIR)) mkdirSync(CLEAN_DIR, { recursive: true });

// ─── Cleanup Prompt ──────────────────────────────────────────────────
function buildPrompt(storyText, auditFindings, filename) {
  const auditBlock = auditFindings && auditFindings.issues && auditFindings.issues.length > 0
    ? `\n\n## בעיות שזוהו ב-audit\n\n${auditFindings.issues.map((iss, i) => `${i + 1}. עמוד ${iss.page}: "${iss.quote}" — ${iss.problem}\n   הצעה: ${iss.suggestion || ''}`).join('\n')}\n\nאלה הבעיות שדווחו אבל אתה לא מוגבל אליהן — חפש גם בעיות נוספות.`
    : '';

  return `אתה עורך בכיר של ספרי ילדים בעברית. גדלת על דתיה בן-דור, לאה גולדברג, מירי ילן-שטקליס. אתה מכיר את הצליל של עברית-לילדים-אמיתית כשאתה שומע אותה.

הסיפור שלפניך נכתב על-ידי AI ויש בו שתי בעיות עיקריות:

1. **מילים לא מתאימות לגיל 5-9** — מונחים אקדמיים, אנטומיה, גיאומטריה, מילים מומצאות.
2. **משפטים שנשמעים מתורגמים מאנגלית** — סדר מילים לא טבעי, ניסוח עקום, "במונחים של", "באופן ש", "ידוע כי" כניסיון לגבריות.

המשימה: **כתוב את הסיפור מחדש בעברית טבעית-לילדים.**

## עברית טבעית-לילדים (טוב)

- משפטים קצרים, חדים, עם קצב.
- פעלים בהתחלה, תיאורים תמציתיים.
- דיאלוגים שנשמעים כמו ילד או הורה אמיתי.
- חוש שמיעה: "טִיק-טַק", "פְּלוֹף", "שׁוווּשׁ".
- חוש מישוש: "רַךְ", "קַר עַל הַעוֹר", "דָּבוּק לַאֶצְבָּעוֹת".
- חזרה על מילים זה טוב — יוצר קצב.
- "אָז", "וְאָז", "פִּתְאוֹם" כמילות מעבר בריאות.

## עברית מתורגמת (רע — תחליף)

- "יָדוּעַ כִּי..." → תחליף בתיאור ישיר ("הַכַּף קְצָת כְּפוּפָה. כְּמוֹ צַלַּחַת קְטַנָּה")
- "בְּמוּנָחִים שֶׁל..." → השמט
- "בְּאֹפֶן שֶׁ..." → "כָּכָה" או "אָז"
- "מִבְנֵה X" → תיאור ישיר ("X נִרְאֶה כָּכָה: ...")
- "תְּשׁוּבָה שְׁכוּנָתִית" וכדומה → השמט/החלף
- "לְמַעֲשֶׂה" → השמט או "בְּעֶצֶם"
- "בְּעֶצֶם" יותר מפעמיים → לצמצם
- "אֲנִי אֲדַבֵּר עִם..." (מנסה לתרגם "I will speak with") → "אֲנִי הוֹלֵךְ לְדַבֵּר עִם..."
- משפט פסיבי → פעיל

## כללי השימור (חובה לשמור בלי שינוי)

1. כל ה-frontmatter בראש (כל מה שבתוך \`---\` הראשונים)
2. \`companionLetter:\` block אם קיים
3. שורות \`storyStyle: / metaphor: / stakes: /\` וכו' — שמור או רענן בלי לשנות עובדות
4. **מספר העמודים זהה לחלוטין**
5. כל שורה \`--- Page N ---\` באותו סדר
6. כל \`imageDirection:\` — באנגלית, ללא שינוי בכלל
7. ניקוד מלא בכל הטקסט העברי — שמור על כל הנקודות והקווים
8. שמות הדמויות (לול, חכם, סערה...) — בדיוק כמו במקור
9. עלילה: מה קורה בכל עמוד נשאר זהה. אם בעמוד 5 הילד מתרגז — הוא ימשיך להתרגז בגרסה החדשה. רק הניסוח משתפר.
10. סוג הסיום: resolution/residue/distance — נשאר זהה
11. שורת \`WORD_COUNT: [...]\` בסוף — אפשר להתעלם או להעתיק כמו שהיא

## חופש מלא לשנות

- מבנה משפט
- אוצר מילים
- קצב, חזרות, פיסוק
- ניסוח דיאלוג
- סדר משפטים בתוך עמוד (אם זה משפר את הזרימה)

## אסור

- להוסיף או להוריד עמודים
- לשנות שמות דמויות
- לשנות עלילה
- לפגוע ב-imageDirection לפניות
- להוריד את הניקוד
- לשנות את סוג הסיום

## הסיפור הנוכחי (קובץ: ${filename})

\`\`\`
${storyText}
\`\`\`
${auditBlock}

## תפוקה

החזר את הסיפור המלא ב-format המקורי. **רק את הסיפור** — בלי הסברים, בלי הקדמה, בלי "הנה הסיפור המתוקן". פשוט את הקובץ המתוקן, מוכן להחליף את המקור.

הסיפור חייב להתחיל ב-\`# Story:\` או ב-\`---\` של ה-frontmatter, כמו במקור.`;
}

// ─── API Call ────────────────────────────────────────────────────────
async function cleanupStory(filename, storyText, auditFindings) {
  const prompt = buildPrompt(storyText, auditFindings, filename);

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [{ role: 'user', content: prompt }],
      max_output_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const output = data.output || [];
  const text = output
    .filter((i) => i.type === 'message')
    .flatMap((m) => m.content || [])
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text)
    .join('\n');

  return text.trim();
}

// ─── Structural Validation ───────────────────────────────────────────
function validateCleanedOutput(original, cleaned, filename) {
  const errors = [];

  // Extract page counts
  const origPages = (original.match(/^--- Page \d+ ---$/gm) || []).length;
  const cleanedPages = (cleaned.match(/^--- Page \d+ ---$/gm) || []).length;
  if (origPages !== cleanedPages) {
    errors.push(`page count mismatch: original=${origPages}, cleaned=${cleanedPages}`);
  }

  // Check pages: N in frontmatter
  const origPagesField = original.match(/^pages:\s*(\d+)/m)?.[1];
  const cleanedPagesField = cleaned.match(/^pages:\s*(\d+)/m)?.[1];
  if (origPagesField !== cleanedPagesField) {
    errors.push(`pages field: original=${origPagesField}, cleaned=${cleanedPagesField}`);
  }

  // Check endingType
  const origEnding = original.match(/^endingType:\s*(\w+)/m)?.[1];
  const cleanedEnding = cleaned.match(/^endingType:\s*(\w+)/m)?.[1];
  if (origEnding !== cleanedEnding) {
    errors.push(`endingType: original=${origEnding}, cleaned=${cleanedEnding}`);
  }

  // Check companionLetter presence
  const origHasLetter = /companionLetter\s*:/.test(original);
  const cleanedHasLetter = /companionLetter\s*:/.test(cleaned);
  if (origHasLetter !== cleanedHasLetter) {
    errors.push(`companionLetter mismatch: original=${origHasLetter}, cleaned=${cleanedHasLetter}`);
  }

  // Check imageDirection count
  const origImgDirs = (original.match(/^imageDirection:/gm) || []).length;
  const cleanedImgDirs = (cleaned.match(/^imageDirection:/gm) || []).length;
  if (origImgDirs !== cleanedImgDirs) {
    errors.push(`imageDirection lines: original=${origImgDirs}, cleaned=${cleanedImgDirs}`);
  }

  // Check nikud presence (basic — should have nikud characters)
  const cleanedHasNikud = /[ְ-ׇ]/.test(cleaned);
  if (!cleanedHasNikud) {
    errors.push(`no nikud detected in cleaned output`);
  }

  // Reasonable length check (cleaned should be within 50% of original)
  const ratio = cleaned.length / original.length;
  if (ratio < 0.5 || ratio > 1.6) {
    errors.push(`length ratio out of range: ${ratio.toFixed(2)}`);
  }

  return errors;
}

// ─── Concurrency Helper ──────────────────────────────────────────────
async function runWithConcurrency(items, worker, concurrency) {
  const results = [];
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const myIdx = idx++;
      try {
        const r = await worker(items[myIdx], myIdx);
        results[myIdx] = r;
      } catch (err) {
        results[myIdx] = { error: err.message };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  let files = readdirSync(STORY_DIR)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !f.endsWith('_prompt.md'))
    .filter((f) => !f.endsWith('_DEEP_PROFILE.md'))
    .sort();

  if (LIMIT > 0) {
    files = files.slice(0, LIMIT);
    console.log(`📌 Limited to first ${LIMIT} files`);
  }

  console.log(`🧼 Hebrew Cleanup Pass`);
  console.log(`   Files: ${files.length}`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  console.log(`   Reading from: ${STORY_DIR}`);
  console.log(`   Writing to: ${CLEAN_DIR}\n`);

  let processed = 0;
  let skipped = 0;
  let errored = 0;
  let validationFailed = 0;

  const startTime = Date.now();

  await runWithConcurrency(
    files,
    async (filename, idx) => {
      const cleanedPath = join(CLEAN_DIR, filename);
      if (existsSync(cleanedPath) && !FORCE) {
        skipped++;
        console.log(`⏭  [${idx + 1}/${files.length}] ${filename} (cached)`);
        return;
      }

      const storyPath = join(STORY_DIR, filename);
      const storyText = readFileSync(storyPath, 'utf8');

      // Try to read corresponding audit findings
      let auditFindings = null;
      const auditPath = join(AUDIT_DIR, filename.replace('.md', '.json'));
      if (existsSync(auditPath)) {
        try {
          auditFindings = JSON.parse(readFileSync(auditPath, 'utf8'));
        } catch {}
      }

      const t0 = Date.now();
      try {
        const cleaned = await cleanupStory(filename, storyText, auditFindings);

        // Validate structure
        const errors = validateCleanedOutput(storyText, cleaned, filename);
        if (errors.length > 0) {
          validationFailed++;
          console.log(`⚠️  [${idx + 1}/${files.length}] ${filename}: validation issues: ${errors.join('; ')}`);
          // Save with .invalid suffix for manual review
          writeFileSync(cleanedPath + '.invalid', cleaned, 'utf8');
          return;
        }

        writeFileSync(cleanedPath, cleaned, 'utf8');
        processed++;
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`✅ [${idx + 1}/${files.length}] ${filename} (${elapsed}s)`);
      } catch (err) {
        errored++;
        console.error(`❌ [${idx + 1}/${files.length}] ${filename}: ${err.message}`);
      }
    },
    CONCURRENCY
  );

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);

  console.log(`\n📊 Summary:`);
  console.log(`   Processed:    ${processed}`);
  console.log(`   Skipped:      ${skipped}`);
  console.log(`   Validation ⚠: ${validationFailed} (saved as .invalid for manual review)`);
  console.log(`   Errored:      ${errored}`);
  console.log(`   Total time:   ${totalElapsed}s`);
  console.log(`\n📂 Cleaned stories in: ${CLEAN_DIR}`);
  console.log(`\nNext steps:`);
  console.log(`   1. Read 5-10 random files in v3-cleaned/ to verify quality`);
  console.log(`   2. If good — promote: copy v3-cleaned/* → v3/`);
  console.log(`   3. If bad — adjust prompt and re-run with --force`);
}

main().catch((err) => {
  console.error(`❌ Fatal: ${err.message}`);
  process.exit(1);
});
