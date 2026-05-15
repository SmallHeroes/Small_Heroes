#!/usr/bin/env node
/**
 * audit-hebrew-quality.mjs — Audits Hebrew quality of all v3 stories.
 *
 * For each story file, sends it to GPT with a strict children's-book editor
 * prompt and collects:
 *   - Verdict (PASS / MINOR_ISSUES / MAJOR_ISSUES / REGENERATE)
 *   - Score (1-5)
 *   - Per-issue: page, exact quote, problem, suggested fix
 *
 * Outputs:
 *   audits/_summary.md         — human-readable summary, sorted by severity
 *   audits/_all-issues.csv     — flat CSV of every flagged issue
 *   audits/<filename>.json     — per-story full audit data
 *
 * Idempotent: skips already-audited files unless --force.
 *
 * Usage:
 *   node scripts/audit-hebrew-quality.mjs              # audit all unprocessed
 *   node scripts/audit-hebrew-quality.mjs --force      # re-audit everything
 *   node scripts/audit-hebrew-quality.mjs --concurrency=3  # parallelism
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('❌ Set OPENAI_API_KEY');
  process.exit(1);
}

const MODEL = 'gpt-5.3-chat-latest';
// --input flag — which subfolder of story-bank/ to audit. Default: v3-renamed (current canonical).
const INPUT_FOLDER = process.argv.find((a) => a.startsWith('--input='))?.split('=')[1] || 'v3-renamed';
const STORY_DIR = join(process.cwd(), 'story-bank', INPUT_FOLDER);
const AUDIT_DIR = join(process.cwd(), 'audits-' + INPUT_FOLDER);
const FORCE = process.argv.includes('--force');
const LIMIT = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0', 10);
const CONCURRENCY = parseInt(
  process.argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] || '3',
  10
);

if (!existsSync(STORY_DIR)) {
  console.error(`❌ Story directory not found: ${STORY_DIR}`);
  console.error(`   Hint: use --input=v4 or --input=v3-renamed`);
  process.exit(1);
}

if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });

console.log(`🔍 Hebrew Quality Audit (Layer 1)`);
console.log(`   Input:  ${STORY_DIR}`);
console.log(`   Output: ${AUDIT_DIR}`);

// ─── Audit Prompt ────────────────────────────────────────────────────
function buildPrompt(storyText, filename) {
  return `אתה עורך ספרי ילדים בעברית עם ניסיון של 20 שנה. אתה מומחה לעברית פשוטה, חמה ונכונה לגיל 5-9.

המשימה: בדוק את הסיפור הבא ואתר בעיות איכות שפה. תהיה קפדן אבל הוגן.

## בעיות שצריך לאתר

1. **מילים מורכבות מדי לגיל**: מילים אקדמיות, מונחי אנטומיה, גיאומטריה, פיזיקה שילד בן 5-9 לא יבין.
   דוגמאות לפסילה: "קער קמור", "מבנה", "אנכי", "מובהק", "מבולגן" (לפעמים), מונחים טכניים.

2. **מילים מומצאות או שגויות**: צירופי מילים שאינם עברית תקינה. הLLM לפעמים ממציא צירופים שנשמעים אבל לא קיימים.
   דוגמה: "תשובה שכונתית" — אינו ביטוי קיים.

3. **משפטים מבולגנים**: סדר מילים לא טבעי, ניסוח עקום, משפטים שלא ברורים בקריאה ראשונה.

4. **תרגום מאנגלית**: ניסוחים שמרגישים מתורגמים ולא נכתבו במקור בעברית.
   דוגמה: "במונחים של..." או "באופן ש..." או שימוש ב-"זה" כפועל.

5. **טון לא מתאים**: ציניות, סרקזם, הומור מבוגרים, הערות מטא-נרטיביות.

6. **דקדוק שגוי**: כל-שגיאות-עם-מקף-מיותר, רבים-יחיד לא תואם, זכר-נקבה לא תואם.

## פורמט תגובה

החזר אך ורק JSON תקין בפורמט הזה — בלי שום טקסט נוסף לפני או אחרי:

\`\`\`json
{
  "verdict": "PASS" | "MINOR_ISSUES" | "MAJOR_ISSUES" | "REGENERATE",
  "score": 1-5,
  "summary": "משפט אחד תמציתי על מצב הסיפור",
  "issues": [
    {
      "page": 5,
      "quote": "המשפט המדויק מהסיפור",
      "problem": "תיאור קצר של הבעיה",
      "suggestion": "ניסוח חלופי בעברית תקינה לילדים"
    }
  ]
}
\`\`\`

## כלל החלטה

- **PASS** (score 5): אין בעיות. הסיפור זורם, ילד יבין כל מילה.
- **MINOR_ISSUES** (score 4): 1-2 מילים/משפטים גבוליים, אבל הסיפור עומד.
- **MAJOR_ISSUES** (score 3): 3-5 בעיות, ילד יתבלבל ביותר ממקום אחד.
- **REGENERATE** (score 1-2): 6+ בעיות, מילים מומצאות מרובות, סיפור לא קריא — צריך לכתוב מחדש.

## כללי דיווח

- ציטוטים חייבים להיות מדויקים מילולית מהסיפור
- ל"suggestion" — תן ניסוח שיכול להחליף ישירות (אותו אורך, אותו טון)
- אל תהיה pickyy עם בחירות סגנון לגיטימיות (משפטים קצרים, חזרות בכוונה, פיסוק יצירתי)
- אל תפסול מילים בעברית גבוהה אם הן ניתנות להבנה מההקשר ("נְחָה", "בָּטוּחָה" וכו')

## הסיפור לבדיקה

קובץ: ${filename}

\`\`\`
${storyText}
\`\`\`

החזר JSON ורק JSON.`;
}

// ─── API Call ────────────────────────────────────────────────────────
async function auditStory(filename, storyText) {
  const prompt = buildPrompt(storyText, filename);
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [{ role: 'user', content: prompt }],
      max_output_tokens: 3000,
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
    .join('\n')
    .trim();

  // Extract JSON — may be wrapped in ```json fences
  let jsonText = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();

  try {
    return JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Failed to parse JSON. Raw: ${text.slice(0, 300)}`);
  }
}

// ─── Concurrency helper ──────────────────────────────────────────────
async function runWithConcurrency(items, worker, concurrency) {
  const results = [];
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const myIdx = idx++;
      try {
        const result = await worker(items[myIdx], myIdx);
        results[myIdx] = result;
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
    .filter((f) => !f.startsWith('_'))
    .sort();

  if (LIMIT > 0) files = files.slice(0, LIMIT);

  console.log(`   Files: ${files.length}${LIMIT > 0 ? ` (limited from --limit=${LIMIT})` : ''}`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Concurrency: ${CONCURRENCY}\n`);

  let startTime = Date.now();
  let processedCount = 0;
  let skippedCount = 0;

  const results = await runWithConcurrency(
    files,
    async (filename, idx) => {
      const auditPath = join(AUDIT_DIR, filename.replace('.md', '.json'));
      if (existsSync(auditPath) && !FORCE) {
        skippedCount++;
        const cached = JSON.parse(readFileSync(auditPath, 'utf8'));
        return { filename, ...cached, cached: true };
      }

      const storyPath = join(STORY_DIR, filename);
      const storyText = readFileSync(storyPath, 'utf8');

      const t0 = Date.now();
      try {
        const audit = await auditStory(filename, storyText);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        writeFileSync(auditPath, JSON.stringify(audit, null, 2), 'utf8');
        processedCount++;
        const icon =
          audit.verdict === 'PASS'
            ? '✅'
            : audit.verdict === 'MINOR_ISSUES'
            ? '🟡'
            : audit.verdict === 'MAJOR_ISSUES'
            ? '🟠'
            : '🔴';
        console.log(
          `${icon} [${idx + 1}/${files.length}] ${filename} → ${audit.verdict} (score ${audit.score}, ${audit.issues?.length || 0} issues, ${elapsed}s)`
        );
        return { filename, ...audit };
      } catch (err) {
        console.error(`❌ [${idx + 1}/${files.length}] ${filename}: ${err.message}`);
        return { filename, error: err.message };
      }
    },
    CONCURRENCY
  );

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n⏱  Total: ${totalElapsed}s (processed ${processedCount}, cached ${skippedCount})\n`);

  // ─── Build Summary Report ──────────────────────────────────────────
  const buckets = { PASS: [], MINOR_ISSUES: [], MAJOR_ISSUES: [], REGENERATE: [], ERROR: [] };
  for (const r of results) {
    if (r.error) buckets.ERROR.push(r);
    else if (r.verdict in buckets) buckets[r.verdict].push(r);
  }

  // Sort by score within each bucket (lower first = worse)
  Object.values(buckets).forEach((arr) =>
    arr.sort((a, b) => (a.score ?? 99) - (b.score ?? 99))
  );

  // Markdown summary
  let md = `# Hebrew Quality Audit — ${new Date().toISOString().split('T')[0]}\n\n`;
  md += `**Total stories**: ${files.length}\n\n`;
  md += `| Verdict | Count | %  |\n|---|---|---|\n`;
  for (const v of ['PASS', 'MINOR_ISSUES', 'MAJOR_ISSUES', 'REGENERATE', 'ERROR']) {
    md += `| ${v} | ${buckets[v].length} | ${((buckets[v].length / files.length) * 100).toFixed(0)}% |\n`;
  }
  md += `\n---\n\n`;

  for (const v of ['REGENERATE', 'MAJOR_ISSUES', 'MINOR_ISSUES', 'PASS', 'ERROR']) {
    if (buckets[v].length === 0) continue;
    md += `## ${v} (${buckets[v].length})\n\n`;
    for (const r of buckets[v]) {
      md += `### ${r.filename} — score ${r.score}\n\n`;
      md += `${r.summary || r.error || ''}\n\n`;
      if (r.issues && r.issues.length > 0) {
        md += `| Page | Quote | Problem | Suggestion |\n|---|---|---|---|\n`;
        for (const iss of r.issues) {
          const q = (iss.quote || '').replace(/\|/g, '\\|').slice(0, 80);
          const p = (iss.problem || '').replace(/\|/g, '\\|');
          const s = (iss.suggestion || '').replace(/\|/g, '\\|');
          md += `| ${iss.page} | ${q} | ${p} | ${s} |\n`;
        }
        md += `\n`;
      }
    }
    md += `---\n\n`;
  }

  writeFileSync(join(AUDIT_DIR, '_summary.md'), md, 'utf8');

  // CSV of all issues
  let csv = 'filename,verdict,score,page,quote,problem,suggestion\n';
  for (const r of results) {
    if (!r.issues || r.issues.length === 0) continue;
    for (const iss of r.issues) {
      const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
      csv += `${esc(r.filename)},${esc(r.verdict)},${esc(r.score)},${esc(iss.page)},${esc(iss.quote)},${esc(iss.problem)},${esc(iss.suggestion)}\n`;
    }
  }
  writeFileSync(join(AUDIT_DIR, '_all-issues.csv'), csv, 'utf8');

  console.log(`📊 Verdicts:`);
  for (const v of ['PASS', 'MINOR_ISSUES', 'MAJOR_ISSUES', 'REGENERATE', 'ERROR']) {
    console.log(`   ${v}: ${buckets[v].length}`);
  }
  console.log(`\n📄 Reports:`);
  console.log(`   ${join(AUDIT_DIR, '_summary.md')}`);
  console.log(`   ${join(AUDIT_DIR, '_all-issues.csv')}`);
  console.log(`   ${AUDIT_DIR}/*.json (per-story details)`);
}

main().catch((err) => {
  console.error(`❌ Fatal: ${err.message}`);
  process.exit(1);
});
