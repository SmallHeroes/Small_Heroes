#!/usr/bin/env node
/**
 * score-stories.mjs — Production-bar scorer for the v3-renamed bank.
 *
 * Grades each story on 6 dimensions (0-10 each):
 *   1. HEBREW_AUTHENTICITY     — feels native-Hebrew, not translated-from-English
 *   2. READABILITY_ALOUD       — flows when a parent reads it; rhythm intact
 *   3. EMBODIMENT              — concrete physical action over abstract description
 *   4. CHARACTER_VOICE         — companion's signature trait is FELT, not stated
 *   5. EMOTIONAL_TRUTH         — moment lands without sentimentality or shortcuts
 *   6. FINGERPRINT_CLEAN       — no overuse of רטט/לחישה/דממה/החספוס pattern
 *
 * Production bar: avg ≥ 8.5 AND every dimension ≥ 8.0.
 *   PASS → production
 *   BELOW → rewrite from scratch (not edit)
 *
 * Outputs:
 *   scoring/<file>.json         per-story breakdown
 *   scoring/_summary.md         full ranking + dimension averages
 *   scoring/_below-threshold.md the rewrite list with reasons
 *
 * READ-ONLY: never modifies story files.
 *
 * Usage:
 *   OPENAI_API_KEY=... node scripts/score-stories.mjs
 *   ... --input=v3-renamed                  # default
 *   ... --only=octopus_seara_fantasy.md,wolf_pup_siyar_adventure.md,owl_chacham_bedtime.md
 *   ... --limit=5
 *   ... --force                              # ignore cache
 *   ... --concurrency=3
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error('❌ Set OPENAI_API_KEY'); process.exit(1); }

const MODEL = 'gpt-5.3-chat-latest';

const INPUT_FOLDER = process.argv.find((a) => a.startsWith('--input='))?.split('=')[1] || 'v3-renamed';
const STORY_DIR = join(process.cwd(), 'story-bank', INPUT_FOLDER);
const SCORE_DIR = join(process.cwd(), 'scoring');

const FORCE = process.argv.includes('--force');
const LIMIT = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0', 10);
const CONCURRENCY = parseInt(process.argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] || '3', 10);
const ONLY = (process.argv.find((a) => a.startsWith('--only='))?.split('=')[1] || '').split(',').filter(Boolean);

// Production bar
const AVG_THRESHOLD = 8.5;
const MIN_DIM_THRESHOLD = 8.0;

const DIMENSIONS = [
  'HEBREW_AUTHENTICITY',
  'READABILITY_ALOUD',
  'EMBODIMENT',
  'CHARACTER_VOICE',
  'EMOTIONAL_TRUTH',
  'FINGERPRINT_CLEAN',
];

if (!existsSync(STORY_DIR)) {
  console.error(`❌ Story directory not found: ${STORY_DIR}`);
  process.exit(1);
}
if (!existsSync(SCORE_DIR)) mkdirSync(SCORE_DIR, { recursive: true });

// ─── Scoring Prompt (Hebrew) ─────────────────────────────────────────
function buildPrompt(storyText, filename) {
  return `אתה עורך/ת בכיר/ה של ספרי ילדים בעברית (גיל 5-9). אתה מציב רף פרודקשן מחמיר עבור Small Heroes — ספרים אישיים שייצרכו לפעמים אלפי פעמים. הסיפור צריך להיות ברמת ספר מודפס נטיב.

המטרה שלך: לתת ציון מדויק על 6 ממדים, להסביר קצר למה, ולעזור להחליט אם הסיפור עובר את רף הפרודקשן.

## 6 הממדים (כל אחד 0.0-10.0)

1. **HEBREW_AUTHENTICITY** — האם זה נשמע כתוב במקור בעברית? או "מתורגם מאנגלית"? מבחן: האם סדר המילים, הצירופים, והפעלים טבעיים?

2. **READABILITY_ALOUD** — האם זה זורם כשמקריאים בקול? קצב, הפסקות, צליל. מבחן: האם הורה שמקריא בלילה לא ייתקע?

3. **EMBODIMENT** — האם הסיפור קונקרטי-גופני, או מופשט-רגשי? ספרי ילדים טובים מציגים פעולות, חפצים, תנועות — לא רעיונות מופשטים. מבחן: כמה עמודים יש שאפשר להמחיש במשפט אחד פיזי?

4. **CHARACTER_VOICE** — האם הקומפניון נוכח כדמות עם חתימה משלה? לא רק שם — אופן הפעולה, תזמון, בחירות. מבחן: אם נחליף את הקומפניון בכלב/חתול גנרי, האם הסיפור משתנה? אם לא — ציון נמוך.

5. **EMOTIONAL_TRUTH** — האם הרגע הרגשי אמיתי או סנטימנטלי? האם זה "כותב על רגש" או "מראה רגש"? מבחן: האם הסוף מרגיש מורווח או דחוס? האם יש "שיעור מוסר" גלוי?

6. **FINGERPRINT_CLEAN** — האם הסיפור נקי מ-AI-prose fingerprint? ביטויים כמו: "הדממה התפשטה", "האוויר מתמלא", "החספוס העדין", "לחישה רכה", "רעד קטן", "שקט קטן עובר בעור". מבחן: ספור את הביטויים הללו. 0-1 = 10. 2-3 = 8. 4-5 = 6. 6+ = ≤4.

## חישוב הציון

- כל ממד בטווח **0.0 עד 10.0** עם דיוק של 0.1
- **רף פרודקשן**: ממוצע ≥ 8.5 **וגם** כל ממד ≥ 8.0
- אם ממוצע ≥ 8.5 אבל יש ממד < 8.0 → BELOW_THRESHOLD (יחייב שכתוב)
- שמור על דיוק — אל תפזר ציונים 7-9 לכל סיפור. הדגם:
  - סיפור פנטסטי שזורם, גופני, עם חתימת דמות → 9.0-9.5
  - סיפור טוב עם 1-2 רגעים פיוטיים מיותרים → 8.5-8.9
  - סיפור עם רעיון מופשט שלא מתרגם לפעולה → 7.0-7.8 (יחייב שכתוב)
  - סיפור עם fingerprint כבד או עברית מתורגמת → 6.0-7.5

## עוגני כיול (חשוב מאוד)

המעריך האנושי כבר נתן ציונים. ה-LLM שלך צריך להגיע לאותם ציונים בערך:

- **octopus_seara_fantasy.md (זוּזִי)** = 9.1 — embodied, מוחשי, חתימת תמנון נוכחת
- **wolf_pup_siyar_adventure.md (לוּלוּ)** = 8.5 — קצב טוב, embodiment חזק, יש כפל בעמוד אחד (כבר תוקן)
- **owl_chacham_bedtime.md (בּוּבּוּ)** = 7.1 — רעיון "חוכמה" מופשט, חתימת ינשוף חלשה, fingerprint נוכח

אם נקרא לך אחד מאלה, היו קרובים לציון הללו. בכל סיפור אחר — שפט עצמאית לפי הרובריקה.

## פורמט תגובה

JSON תקין בלבד, ללא טקסט נוסף:

\`\`\`json
{
  "scores": {
    "HEBREW_AUTHENTICITY": 8.7,
    "READABILITY_ALOUD": 9.0,
    "EMBODIMENT": 8.5,
    "CHARACTER_VOICE": 7.8,
    "EMOTIONAL_TRUTH": 8.2,
    "FINGERPRINT_CLEAN": 9.0
  },
  "verdict": "PASS" | "BELOW_THRESHOLD",
  "weakest_dimension": "CHARACTER_VOICE",
  "summary": "משפט אחד מסכם: למה הציון הזה",
  "strengths": ["מה עובד מעולה — 1-3 דברים קונקרטיים"],
  "weaknesses": ["מה חלש — 1-3 דברים קונקרטיים, עם דוגמאות מהטקסט"],
  "rewrite_focus": "אם BELOW_THRESHOLD — משפט אחד שמתאר על מה לעבוד בשכתוב (לא איך לתקן את הקיים — מה הסיפור החדש צריך לעשות אחרת)"
}
\`\`\`

## הסיפור (קובץ: ${filename})

\`\`\`
${storyText}
\`\`\`

החזר JSON ורק JSON.`;
}

// ─── API Call ────────────────────────────────────────────────────────
async function scoreStory(filename, storyText) {
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

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Failed to parse JSON. Raw: ${text.slice(0, 300)}`);
  }

  // Compute average + verdict ourselves (don't trust LLM math)
  const scores = parsed.scores || {};
  const values = DIMENSIONS.map((d) => Number(scores[d]) || 0);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const minDim = Math.min(...values);
  const passes = avg >= AVG_THRESHOLD && minDim >= MIN_DIM_THRESHOLD;

  return {
    ...parsed,
    avg: +avg.toFixed(2),
    minDim: +minDim.toFixed(2),
    verdict: passes ? 'PASS' : 'BELOW_THRESHOLD',
  };
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
    .filter((f) => !f.startsWith('_'))
    .sort();

  if (ONLY.length > 0) {
    files = files.filter((f) => ONLY.includes(f));
    console.log(`📌 Restricted to ${files.length} files via --only`);
  }
  if (LIMIT > 0) {
    files = files.slice(0, LIMIT);
    console.log(`📌 Limited to first ${LIMIT} files`);
  }

  console.log(`🎯 Production-Bar Scorer`);
  console.log(`   Bar:    avg ≥ ${AVG_THRESHOLD} AND every dim ≥ ${MIN_DIM_THRESHOLD}`);
  console.log(`   Files:  ${files.length}`);
  console.log(`   Model:  ${MODEL}`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  console.log(`   Input:  ${STORY_DIR}`);
  console.log(`   Output: ${SCORE_DIR}\n`);

  const startTime = Date.now();
  let processed = 0;
  let cached = 0;

  const results = await runWithConcurrency(
    files,
    async (filename, idx) => {
      const scorePath = join(SCORE_DIR, filename.replace('.md', '.json'));
      if (existsSync(scorePath) && !FORCE) {
        cached++;
        const r = JSON.parse(readFileSync(scorePath, 'utf8'));
        return { filename, ...r, cached: true };
      }

      const storyPath = join(STORY_DIR, filename);
      const storyText = readFileSync(storyPath, 'utf8');

      const t0 = Date.now();
      try {
        const score = await scoreStory(filename, storyText);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        writeFileSync(scorePath, JSON.stringify(score, null, 2), 'utf8');
        processed++;
        const icon = score.verdict === 'PASS' ? '✅' : '🟠';
        console.log(
          `${icon} [${idx + 1}/${files.length}] ${filename} → avg ${score.avg} (min ${score.minDim} @ ${score.weakest_dimension || '?'}) — ${score.verdict} (${elapsed}s)`
        );
        return { filename, ...score };
      } catch (err) {
        console.error(`❌ [${idx + 1}/${files.length}] ${filename}: ${err.message}`);
        return { filename, error: err.message };
      }
    },
    CONCURRENCY
  );

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n⏱  Total: ${totalElapsed}s (processed ${processed}, cached ${cached})\n`);

  // ─── Build Reports ────────────────────────────────────────────────
  const passing = results.filter((r) => r.verdict === 'PASS').sort((a, b) => b.avg - a.avg);
  const below = results.filter((r) => r.verdict === 'BELOW_THRESHOLD').sort((a, b) => a.avg - b.avg);
  const errors = results.filter((r) => r.error);

  // Dimension averages
  const dimAvg = {};
  for (const d of DIMENSIONS) {
    const vals = results.filter((r) => r.scores && r.scores[d] != null).map((r) => Number(r.scores[d]));
    dimAvg[d] = vals.length > 0 ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : 0;
  }

  // Main summary
  let md = `# Production-Bar Scoring — ${new Date().toISOString().split('T')[0]}\n\n`;
  md += `**Input**: \`${INPUT_FOLDER}\`\n`;
  md += `**Bar**: avg ≥ ${AVG_THRESHOLD} AND every dim ≥ ${MIN_DIM_THRESHOLD}\n\n`;
  md += `## Result Distribution\n\n`;
  md += `| Verdict | Count | %  |\n|---|---|---|\n`;
  md += `| PASS | ${passing.length} | ${((passing.length / files.length) * 100).toFixed(0)}% |\n`;
  md += `| BELOW_THRESHOLD | ${below.length} | ${((below.length / files.length) * 100).toFixed(0)}% |\n`;
  md += `| ERROR | ${errors.length} | ${((errors.length / files.length) * 100).toFixed(0)}% |\n\n`;

  md += `## Dimension Averages (whole bank)\n\n`;
  md += `| Dimension | Avg |\n|---|---|\n`;
  for (const d of DIMENSIONS) md += `| ${d} | ${dimAvg[d]} |\n`;
  md += `\n---\n\n`;

  md += `## PASS (${passing.length}) — ordered by avg\n\n`;
  md += `| Rank | Story | Avg | Min dim | Weakest |\n|---|---|---|---|---|\n`;
  passing.forEach((r, i) => {
    md += `| ${i + 1} | ${r.filename} | ${r.avg} | ${r.minDim} | ${r.weakest_dimension || '-'} |\n`;
  });
  md += `\n---\n\n`;

  md += `## BELOW_THRESHOLD (${below.length}) — ordered by avg ascending\n\n`;
  for (const r of below) {
    md += `### ${r.filename} — avg ${r.avg} (min ${r.minDim} @ ${r.weakest_dimension || '?'})\n\n`;
    md += `${r.summary || ''}\n\n`;
    if (r.scores) {
      md += `| Dim | Score |\n|---|---|\n`;
      for (const d of DIMENSIONS) md += `| ${d} | ${r.scores[d] ?? '-'} |\n`;
      md += `\n`;
    }
    if (r.weaknesses?.length) md += `**Weaknesses:** ${r.weaknesses.join(' · ')}\n\n`;
    if (r.rewrite_focus) md += `**Rewrite focus:** ${r.rewrite_focus}\n\n`;
    md += `---\n\n`;
  }

  writeFileSync(join(SCORE_DIR, '_summary.md'), md, 'utf8');

  // Below-threshold-only quick view (the rewrite worklist)
  let below_md = `# Rewrite Worklist — ${new Date().toISOString().split('T')[0]}\n\n`;
  below_md += `**Bar**: avg ≥ ${AVG_THRESHOLD} AND every dim ≥ ${MIN_DIM_THRESHOLD}\n`;
  below_md += `**To rewrite**: ${below.length} stories\n\n`;
  below_md += `| Story | Avg | Min | Weakest | Rewrite focus |\n|---|---|---|---|---|\n`;
  for (const r of below) {
    below_md += `| ${r.filename} | ${r.avg} | ${r.minDim} | ${r.weakest_dimension || '-'} | ${(r.rewrite_focus || '').replace(/\|/g, '\\|').slice(0, 120)} |\n`;
  }
  writeFileSync(join(SCORE_DIR, '_below-threshold.md'), below_md, 'utf8');

  // CSV with all dimension scores
  let csv = 'filename,avg,minDim,verdict,' + DIMENSIONS.join(',') + ',weakest,summary\n';
  for (const r of results) {
    if (r.error) continue;
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    csv += [esc(r.filename), r.avg, r.minDim, r.verdict, ...DIMENSIONS.map((d) => r.scores?.[d] ?? ''), esc(r.weakest_dimension || ''), esc(r.summary || '')].join(',') + '\n';
  }
  writeFileSync(join(SCORE_DIR, '_per-dim.csv'), csv, 'utf8');

  // Console summary
  console.log(`📊 Verdicts:`);
  console.log(`   ✅ PASS: ${passing.length}`);
  console.log(`   🟠 BELOW: ${below.length}`);
  console.log(`   ❌ ERROR: ${errors.length}`);
  console.log(`\n📊 Dimension averages:`);
  for (const d of DIMENSIONS) console.log(`   ${d}: ${dimAvg[d]}`);
  if (below.length > 0) {
    console.log(`\n🟠 Top 10 weakest (will be rewritten):`);
    below.slice(0, 10).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.filename} → avg ${r.avg} (min ${r.minDim} @ ${r.weakest_dimension || '?'})`);
    });
  }
  console.log(`\n📄 Reports:`);
  console.log(`   ${join(SCORE_DIR, '_summary.md')}`);
  console.log(`   ${join(SCORE_DIR, '_below-threshold.md')}`);
  console.log(`   ${join(SCORE_DIR, '_per-dim.csv')}`);
  console.log(`   ${SCORE_DIR}/*.json  (per-story)`);
  console.log(`\n💡 READ-ONLY: no story files were modified.`);
}

main().catch((err) => {
  console.error(`❌ Fatal: ${err.message}`);
  process.exit(1);
});
