/**
 * detect-repetitions.mjs — Cross-story repetition detector.
 *
 * Reads all stories in story-bank/v5/, strips nikud, and finds n-grams
 * (phrases of 3-5 Hebrew words) that appear across multiple stories.
 *
 * The goal: catch AI-tells like "הוא נושם חזק", "פנים-לב-פנים-לב",
 * "סש שנופל", "כנפיים זוהבות" that repeat too often.
 *
 * Usage:
 *   node scripts/detect-repetitions.mjs
 *   node scripts/detect-repetitions.mjs --input=v5 --min-stories=3 --min-words=3 --max-words=5
 *
 * Output: detect-repetitions-v5.md with sorted repetition report.
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ─── Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let INPUT = 'v5';
let MIN_STORIES = 3;   // a phrase must appear in at least this many stories
let MIN_WORDS = 3;     // shortest n-gram to consider
let MAX_WORDS = 5;     // longest n-gram to consider
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--input=')) INPUT = args[i].split('=')[1];
  if (args[i].startsWith('--min-stories=')) MIN_STORIES = +args[i].split('=')[1];
  if (args[i].startsWith('--min-words=')) MIN_WORDS = +args[i].split('=')[1];
  if (args[i].startsWith('--max-words=')) MAX_WORDS = +args[i].split('=')[1];
}

const INPUT_DIR = join(ROOT, 'story-bank', INPUT);
const OUTPUT_FILE = join(ROOT, `detect-repetitions-${INPUT}.md`);

// ─── Helpers ─────────────────────────────────────────────────────────────
const NIKUD_RE = /[֑-ׇ]/g;
const HEBREW_WORD_RE = /[א-ת]+/g;

function stripNikud(text) {
  return text.replace(NIKUD_RE, '');
}

/** Extract only the prose body — drop frontmatter, imageDirection lines, page markers. */
function extractProse(raw) {
  const lines = raw.split('\n');
  const out = [];
  let inFrontmatter = false;
  let frontmatterCount = 0;

  for (const line of lines) {
    // Skip YAML frontmatter
    if (line.trim() === '---') {
      frontmatterCount++;
      if (frontmatterCount <= 2) {
        inFrontmatter = !inFrontmatter;
        continue;
      }
    }
    if (inFrontmatter) continue;

    // Skip page markers
    if (/^---\s*Page\s+\d+\s*---/i.test(line)) continue;

    // Skip imageDirection lines (English direction)
    if (/^imageDirection:/i.test(line)) continue;

    // Skip metadata lines (storyStyle, metaphor, etc.)
    if (/^(storyStyle|metaphor|stakes|emotionalArc|quietPage|heartLine|emotionalMistake|uncomfortableTruth|worldRule|title|companionId|direction|category|gender|pages|endingType):/i.test(line)) continue;

    // Skip WORD_COUNT footer
    if (/^WORD_COUNT:/i.test(line)) continue;

    // Skip markdown header lines
    if (/^#\s/.test(line)) continue;

    // Skip "Generated:" line and similar
    if (/^(Generated|Skeleton model|Prose model|Total time|Prompt-version):/i.test(line)) continue;

    out.push(line);
  }
  return out.join(' ');
}

/** Tokenize a Hebrew text into words (after stripping nikud and punctuation). */
function tokenize(text) {
  const stripped = stripNikud(text);
  const words = stripped.match(HEBREW_WORD_RE) || [];
  return words;
}

/** Generate n-grams from a word array. */
function ngrams(words, n) {
  const out = [];
  for (let i = 0; i <= words.length - n; i++) {
    out.push(words.slice(i, i + n).join(' '));
  }
  return out;
}

/** Should we ignore this n-gram? (boring function-word phrases) */
function isBoring(phrase) {
  const words = phrase.split(' ');
  // If ALL words are very short function words, it's boring
  const STOP = new Set(['של', 'את', 'על', 'אל', 'עם', 'מן', 'כי', 'אם', 'או', 'גם', 'כל', 'יש', 'אין', 'זה', 'זו', 'הוא', 'היא', 'אני', 'אתה', 'אנחנו', 'הם', 'הן', 'לא', 'כן', 'מה', 'מי', 'איך', 'איפה', 'למה', 'יותר', 'פחות', 'אבל', 'רק', 'עד', 'אז', 'שם', 'פה', 'כאן', 'עכשיו']);
  const stopCount = words.filter(w => STOP.has(w)).length;
  if (stopCount >= words.length - 1) return true;
  // Also skip extremely short words only
  if (words.every(w => w.length <= 2)) return true;
  return false;
}

// ─── Main ────────────────────────────────────────────────────────────────
console.log(`📖 Reading stories from ${INPUT_DIR}`);
const files = readdirSync(INPUT_DIR).filter(f => f.endsWith('.md')).sort();
console.log(`   ${files.length} stories found.`);

// phraseMap: ngram → Map<filename, count>
const phraseMap = new Map();

for (const file of files) {
  const raw = readFileSync(join(INPUT_DIR, file), 'utf8');
  const prose = extractProse(raw);
  const words = tokenize(prose);

  const seenInThisFile = new Map(); // phrase → count in this file
  for (let n = MIN_WORDS; n <= MAX_WORDS; n++) {
    for (const gram of ngrams(words, n)) {
      seenInThisFile.set(gram, (seenInThisFile.get(gram) || 0) + 1);
    }
  }
  for (const [phrase, count] of seenInThisFile) {
    if (!phraseMap.has(phrase)) phraseMap.set(phrase, new Map());
    phraseMap.get(phrase).set(file, count);
  }
}

console.log(`   ${phraseMap.size} unique n-grams considered.`);

// Filter: keep phrases that appear in MIN_STORIES+ stories
const repeated = [];
for (const [phrase, fileMap] of phraseMap) {
  if (fileMap.size >= MIN_STORIES && !isBoring(phrase)) {
    const totalCount = [...fileMap.values()].reduce((a, b) => a + b, 0);
    repeated.push({
      phrase,
      storyCount: fileMap.size,
      totalCount,
      files: [...fileMap.keys()],
      wordCount: phrase.split(' ').length,
    });
  }
}

// Sort: longer phrases first (more interesting), then by story count
repeated.sort((a, b) => {
  if (b.wordCount !== a.wordCount) return b.wordCount - a.wordCount;
  return b.storyCount - a.storyCount;
});

console.log(`   ${repeated.length} repeated phrases found (in ${MIN_STORIES}+ stories).`);

// ─── Report ──────────────────────────────────────────────────────────────
const lines = [];
lines.push(`# Cross-Story Repetition Report — ${INPUT}`);
lines.push(``);
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Stories analyzed: ${files.length}`);
lines.push(`Min stories threshold: ${MIN_STORIES}`);
lines.push(`N-gram size: ${MIN_WORDS}-${MAX_WORDS} words`);
lines.push(``);
lines.push(`---`);
lines.push(``);

// Group by phrase length
for (let n = MAX_WORDS; n >= MIN_WORDS; n--) {
  const group = repeated.filter(r => r.wordCount === n);
  if (group.length === 0) continue;
  lines.push(`## ${n}-word phrases (${group.length})`);
  lines.push(``);
  lines.push(`| Phrase | Stories | Total uses |`);
  lines.push(`|---|---|---|`);
  for (const r of group.slice(0, 50)) {
    lines.push(`| \`${r.phrase}\` | ${r.storyCount} | ${r.totalCount} |`);
  }
  lines.push(``);

  // Detail section for top 10
  lines.push(`### Top ${n}-word repetitions — which stories`);
  lines.push(``);
  for (const r of group.slice(0, 10)) {
    lines.push(`**\`${r.phrase}\`** — ${r.storyCount} stories:`);
    lines.push(``);
    for (const f of r.files) {
      lines.push(`- ${f}`);
    }
    lines.push(``);
  }
  lines.push(`---`);
  lines.push(``);
}

writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8');
console.log(`✅ Report written: ${OUTPUT_FILE}`);
console.log(``);
console.log(`Top 10 worst offenders:`);
for (const r of repeated.slice(0, 10)) {
  console.log(`  [${r.wordCount}w × ${r.storyCount} stories] ${r.phrase}`);
}
