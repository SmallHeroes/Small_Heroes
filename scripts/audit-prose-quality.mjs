#!/usr/bin/env node
/**
 * audit-prose-quality.mjs — Second-pass prose audit for v3 stories.
 *
 * Targets the "AI literary prose" layer that survives basic grammar/vocab fixes:
 *   • Over-personification (walls that listen, trees that watch)
 *   • Sensory overload (3+ anchors stacked per sentence)
 *   • Literary fat (pretty but abstract)
 *   • Emotional density (feeling+body+movement crammed in one breath)
 *   • Awkward translated-from-English structure
 *   • Over-elaboration (10 words where 3 suffice)
 *   • Missing breathing room (every sentence loaded)
 *   • Mid-level unnatural register (not academic — just unnatural for ages 5-9)
 *   • Off-sound (doesn't read aloud well)
 *
 * Output:
 *   audits-prose/<filename>.json  — per-story JSON
 *   audits-prose/_summary.md      — sorted master report
 *   audits-prose/_all-issues.csv  — flat CSV for sorting/filtering
 *
 * READ-ONLY: never modifies story files.
 *
 * Usage:
 *   node scripts/audit-prose-quality.mjs              # all stories
 *   node scripts/audit-prose-quality.mjs --limit=5    # test on first 5
 *   node scripts/audit-prose-quality.mjs --force      # re-audit
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error('❌ Set OPENAI_API_KEY'); process.exit(1); }

const MODEL = 'gpt-5.3-chat-latest';

// --input flag: which subfolder of story-bank/ to audit. Default: v3 (originals).
// Use --input=v3-applied to audit the post-surgical-fix stories.
const INPUT_FOLDER = process.argv.find((a) => a.startsWith('--input='))?.split('=')[1] || 'v3';
const STORY_DIR = join(process.cwd(), 'story-bank', INPUT_FOLDER);
const AUDIT_DIR = join(process.cwd(), 'audits-prose');

const FORCE = process.argv.includes('--force');
const LIMIT = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0', 10);
const CONCURRENCY = parseInt(process.argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] || '3', 10);

if (!existsSync(STORY_DIR)) {
  console.error(`❌ Story directory not found: ${STORY_DIR}`);
  console.error(`   Hint: use --input=v3 or --input=v3-applied`);
  process.exit(1);
}

if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });

// ─── Prose Audit Prompt ──────────────────────────────────────────────
function buildPrompt(storyText, filename) {
  return `אתה עורכת בכירה של ספרי ילדים בעברית (גיל 5-9). למדת אצל יהונתן גפן ודתיה בן-דור. את שומעת מיד כשמשפט "מתחזה" להיות טבעי אבל לא ממש.

הסיפור שלפניך **כבר עבר תיקוני אוצר-מילים וכתיב**. עכשיו את מחפשת את השכבה הבאה — **בעיות פרוזה** שמסגירות כתיבת AI: ניסוחים יפים-מדי, שומן ספרותי, צפיפות חושית, האנשה מיותרת, מבנה משפטים לא טבעי.

## הקטגוריות לאיתור

1. **SENSORY_OVERLOAD** — משפט עם 3+ פרטים חושיים גדושים יחד (ריח+מרקם+קול+נשימה+תנועה). ספר ילדים טוב משאיר 1-2 עוגנים חושיים פר עמוד.

2. **OVER_PERSONIFICATION** — דברים דוממים שעושים פעולות אנושיות בלי הצדקה (קירות שמקשיבים, עצים שמסתכלים, אדמה שנושמת). בfantasy זה לפעמים בסדר אם זה ה-world-rule, אבל בbedtime/adventure בדרך כלל מיותר.

3. **LITERARY_FAT** — ביטוי יפה אבל מופשט שלא בונה תמונה קונקרטית בראש של ילד. דוגמה: "הקול יוצא לאט, ונהיה אבן קטנה."

4. **EMOTIONAL_DENSITY** — משפט שדוחס רגש + גוף + תנועה + תחושה בנשימה אחת. עייף. צריך לחלק.

5. **AWKWARD_STRUCTURE** — משפט שנשמע מתורגם מאנגלית. סדר מילים לא טבעי. תחביר עקום.

6. **OVER_ELABORATION** — אפשר לומר את זה בפחות מילים. תיאור מנופח שהילד יישכח באמצע.

7. **MISSING_AIR** — עמוד או פסקה שכל משפט שלה עמוס. צריך משפט "נשימה" — קצר, פשוט, רגוע.

8. **UNNATURAL_REGISTER** — מילה או צירוף עדיין במרשם גבוה מדי לגיל 5-9 (לא אקדמי כמו "קער קמור" — אלא מיתוג נמוך יותר, כמו "דומיה" במקום "שקט").

9. **SOUND_OFF** — קוראת בקול ולא מתחבר. הקצב נשבר. הצליל לא טבעי בעברית מדוברת.

## פורמט תגובה

החזר אך ורק JSON תקין, בלי טקסט נוסף:

\`\`\`json
{
  "verdict": "EXCELLENT" | "GOOD" | "NEEDS_POLISH" | "NEEDS_REWRITE",
  "score": 1-5,
  "summary": "משפט אחד מסכם: איך הסיפור נשמע בקריאה בקול",
  "strengths": ["דבר אחד שעובד טוב", "עוד דבר"],
  "issues": [
    {
      "page": 5,
      "category": "SENSORY_OVERLOAD",
      "quote": "הציטוט המדויק",
      "problem": "מה לא עובד פה",
      "suggestion": "ניסוח חלופי שעובד יותר טוב"
    }
  ]
}
\`\`\`

## כללי ניקוד

- **EXCELLENT (5)** — נקרא כמו ספר ילדים נטיב. בלי "AI prose feel."
- **GOOD (4)** — בעיקר טבעי. 1-3 רגעים ספרותיים שלא קריטיים.
- **NEEDS_POLISH (3)** — בסיס טוב, אבל יש 4-7 רגעים שמסגירים AI. כדאי לשפר.
- **NEEDS_REWRITE (2)** — הרבה רגעים של "ספרות AI". נשמע ספרותי במקום ילדי.
- **(1)** — לא מתאים. צריך שכתוב משמעותי.

## כללים חשובים

- **אל תפסול ביטויים שעובדים** רק כי הם פיוטיים — שמור על משחקי-קצב כמו "טִיק-טַק", "אַחַת, שְׁתַּיִם", "שָׁקֵט שָׁקֵט". אלה זהב.
- **כן תפסול** ביטויים פיוטיים שלא קונקריטיים: "השקט מתפשט", "האוויר מתמלא ב..."
- **שיהיה ילד בראש שלך** — בן 5, 7, 9. האם הילד מבין? האם הוא מרגיש שמישהו מספר לו סיפור, או שמישהו כותב סביבו?
- **אל תפסול את כל הסיפור** — מותר ויפה שיש 2-3 issues. הרעיון לא לרוקן מה-character.
- **strengths** — חשוב למלא. ציין 1-3 דברים שעובדים — קצב טוב, דיאלוג חי, רגעים אינטימיים.
- שמור על כל הציטוטים **מילולית מהסיפור**.

## הסיפור (קובץ: ${filename})

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
      max_output_tokens: 4096,
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

  let jsonText = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();

  try {
    return JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Failed to parse JSON. Raw: ${text.slice(0, 300)}`);
  }
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
        results[myIdx] = { error: err.message, filename: items[myIdx] };
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

  console.log(`🔍 Prose Quality Audit (Layer 2 — AI-prose detection)`);
  console.log(`   Files: ${files.length}`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  console.log(`   Input:  ${STORY_DIR}`);
  console.log(`   Output: ${AUDIT_DIR}\n`);

  const startTime = Date.now();
  let processed = 0;
  let cached = 0;

  const results = await runWithConcurrency(
    files,
    async (filename, idx) => {
      const auditPath = join(AUDIT_DIR, filename.replace('.md', '.json'));
      if (existsSync(auditPath) && !FORCE) {
        cached++;
        const r = JSON.parse(readFileSync(auditPath, 'utf8'));
        return { filename, ...r, cached: true };
      }

      const storyPath = join(STORY_DIR, filename);
      const storyText = readFileSync(storyPath, 'utf8');

      const t0 = Date.now();
      try {
        const audit = await auditStory(filename, storyText);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        writeFileSync(auditPath, JSON.stringify(audit, null, 2), 'utf8');
        processed++;
        const icon =
          audit.verdict === 'EXCELLENT' ? '✨' :
          audit.verdict === 'GOOD' ? '✅' :
          audit.verdict === 'NEEDS_POLISH' ? '🟡' :
          audit.verdict === 'NEEDS_REWRITE' ? '🟠' : '🔴';
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
  console.log(`\n⏱  Total: ${totalElapsed}s (processed ${processed}, cached ${cached})\n`);

  // ─── Build Summary ─────────────────────────────────────────────────
  const buckets = {
    EXCELLENT: [], GOOD: [], NEEDS_POLISH: [], NEEDS_REWRITE: [], CRITICAL: [], ERROR: []
  };
  for (const r of results) {
    if (r.error) buckets.ERROR.push(r);
    else if (r.verdict && r.verdict in buckets) buckets[r.verdict].push(r);
    else if (r.score === 1) buckets.CRITICAL.push(r);
  }
  Object.values(buckets).forEach((arr) =>
    arr.sort((a, b) => (a.score ?? 99) - (b.score ?? 99))
  );

  // Aggregate issue categories
  const categoryCounts = {};
  for (const r of results) {
    if (!r.issues) continue;
    for (const iss of r.issues) {
      const cat = iss.category || 'UNCATEGORIZED';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  }
  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  // Markdown summary
  let md = `# Prose Quality Audit (Layer 2) — ${new Date().toISOString().split('T')[0]}\n\n`;
  md += `**Total stories**: ${files.length}\n\n`;
  md += `## Verdict Distribution\n\n`;
  md += `| Verdict | Count | %  |\n|---|---|---|\n`;
  for (const v of ['EXCELLENT', 'GOOD', 'NEEDS_POLISH', 'NEEDS_REWRITE', 'CRITICAL', 'ERROR']) {
    md += `| ${v} | ${buckets[v].length} | ${((buckets[v].length / files.length) * 100).toFixed(0)}% |\n`;
  }
  md += `\n## Issue Categories (Frequency)\n\n`;
  md += `| Category | Count |\n|---|---|\n`;
  for (const [cat, count] of sortedCategories) {
    md += `| ${cat} | ${count} |\n`;
  }
  md += `\n---\n\n`;

  for (const v of ['CRITICAL', 'NEEDS_REWRITE', 'NEEDS_POLISH', 'GOOD', 'EXCELLENT', 'ERROR']) {
    if (buckets[v].length === 0) continue;
    md += `## ${v} (${buckets[v].length})\n\n`;
    for (const r of buckets[v]) {
      md += `### ${r.filename} — score ${r.score}\n\n`;
      md += `${r.summary || r.error || ''}\n\n`;
      if (r.strengths && r.strengths.length > 0) {
        md += `**מה עובד:** ${r.strengths.join(' · ')}\n\n`;
      }
      if (r.issues && r.issues.length > 0) {
        md += `| Page | Category | Quote | Problem | Suggestion |\n|---|---|---|---|---|\n`;
        for (const iss of r.issues) {
          const q = (iss.quote || '').replace(/\|/g, '\\|').slice(0, 80);
          const p = (iss.problem || '').replace(/\|/g, '\\|');
          const s = (iss.suggestion || '').replace(/\|/g, '\\|');
          md += `| ${iss.page} | ${iss.category || '-'} | ${q} | ${p} | ${s} |\n`;
        }
        md += `\n`;
      }
    }
    md += `---\n\n`;
  }

  writeFileSync(join(AUDIT_DIR, '_summary.md'), md, 'utf8');

  // CSV of all issues
  let csv = 'filename,verdict,score,page,category,quote,problem,suggestion\n';
  for (const r of results) {
    if (!r.issues || r.issues.length === 0) continue;
    for (const iss of r.issues) {
      const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
      csv += `${esc(r.filename)},${esc(r.verdict)},${esc(r.score)},${esc(iss.page)},${esc(iss.category)},${esc(iss.quote)},${esc(iss.problem)},${esc(iss.suggestion)}\n`;
    }
  }
  writeFileSync(join(AUDIT_DIR, '_all-issues.csv'), csv, 'utf8');

  console.log(`📊 Verdicts:`);
  for (const v of ['EXCELLENT', 'GOOD', 'NEEDS_POLISH', 'NEEDS_REWRITE', 'CRITICAL', 'ERROR']) {
    console.log(`   ${v}: ${buckets[v].length}`);
  }
  console.log(`\n📊 Top categories:`);
  for (const [cat, count] of sortedCategories.slice(0, 9)) {
    console.log(`   ${cat}: ${count}`);
  }
  console.log(`\n📄 Reports:`);
  console.log(`   ${join(AUDIT_DIR, '_summary.md')}`);
  console.log(`   ${join(AUDIT_DIR, '_all-issues.csv')}`);
  console.log(`   ${AUDIT_DIR}/*.json (per-story)`);
  console.log(`\n💡 READ-ONLY: no story files were modified.`);
}

main().catch((err) => {
  console.error(`❌ Fatal: ${err.message}`);
  process.exit(1);
});
