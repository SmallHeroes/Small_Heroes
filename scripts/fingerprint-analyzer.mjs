#!/usr/bin/env node
/**
 * fingerprint-analyzer.mjs — Detect AI-prose "fingerprint" words.
 *
 * Editor identified 7 sensory/atmosphere words that appear so often across
 * the bank that they become a recognizable signature of AI generation:
 *   רטט, עור, לחישה, חום, קור, נשימה, אוויר
 *
 * Plus a wider candidate list of "atmosphere words" that LLMs default to.
 *
 * For each story:
 *   - Count occurrences of each fingerprint word (nikud-stripped)
 *   - Compute density per page
 *   - Flag stories with disproportionate usage
 *
 * Output:
 *   fingerprint/_summary.md     — ranking + recommendations
 *   fingerprint/_per-word.csv   — wide table for filtering
 *   fingerprint/<file>.json     — per-story breakdown
 *
 * Usage:
 *   node scripts/fingerprint-analyzer.mjs                   # default: v3-final
 *   node scripts/fingerprint-analyzer.mjs --input=v3-conservative
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const INPUT_FOLDER = process.argv.find((a) => a.startsWith('--input='))?.split('=')[1] || 'v3-final';
const STORY_DIR = join(process.cwd(), 'story-bank', INPUT_FOLDER);
const OUT_DIR = join(process.cwd(), 'fingerprint');

if (!existsSync(STORY_DIR)) {
  console.error(`❌ Story directory not found: ${STORY_DIR}`);
  process.exit(1);
}
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ─── Fingerprint Words ───────────────────────────────────────────────
// Editor-identified core (highest priority to reduce):
const CORE_FINGERPRINT = ['רטט', 'עור', 'לחישה', 'חום', 'קור', 'נשימה', 'אוויר'];

// Wider atmosphere/sensory candidates — LLM defaults that may overuse:
const EXTENDED_FINGERPRINT = [
  'מרקם', 'מחוספס', 'חלק', 'רך', 'עדין', 'מגע', 'מצמרר', 'רעידה',
  'דגדוג', 'לחות', 'יבש', 'שקט', 'דממה', 'לוחש', 'נושף',
  'לוחשת', 'נושפת', 'מרחפת', 'נוגעת', 'נוגע', 'מתפשט', 'מתפשטת',
  'נושם', 'נושמת', 'נושמים', 'מצמצם', 'רוטט',
];

const ALL_WORDS = [...new Set([...CORE_FINGERPRINT, ...EXTENDED_FINGERPRINT])];

// ─── Helpers ─────────────────────────────────────────────────────────
function stripNikud(s) {
  return s.replace(/[֑-ׇ]/g, '');
}

function countWord(text, word) {
  // Word boundary in Hebrew: char before/after must be non-Hebrew-letter
  // Use stripped text for matching
  const stripped = stripNikud(text);
  // Simple boundary: non-Hebrew-letter on both sides
  const re = new RegExp(`(^|[^א-ת])${word}([^א-ת]|$)`, 'g');
  return (stripped.match(re) || []).length;
}

function getStoryBody(text) {
  // Find body — after second `---`
  const dashIdx1 = text.indexOf('\n---\n');
  if (dashIdx1 < 0) return text;
  const dashIdx2 = text.indexOf('\n---\n', dashIdx1 + 5);
  if (dashIdx2 < 0) return text;
  let body = text.slice(dashIdx2 + 5);
  // Remove imageDirection lines and WORD_COUNT line
  body = body.split('\n')
    .filter((l) => !l.startsWith('imageDirection:'))
    .filter((l) => !l.startsWith('WORD_COUNT:'))
    .filter((l) => !l.startsWith('storyStyle:'))
    .filter((l) => !l.startsWith('metaphor:'))
    .filter((l) => !l.startsWith('stakes:'))
    .filter((l) => !l.startsWith('weirdMoment:'))
    .filter((l) => !l.startsWith('emotionalArc:'))
    .filter((l) => !l.startsWith('quietPage:'))
    .filter((l) => !l.startsWith('heartLine:'))
    .filter((l) => !l.startsWith('copingVisible:'))
    .filter((l) => !l.startsWith('collapsePoint:'))
    .filter((l) => !l.startsWith('forbiddenPatterns:'))
    .filter((l) => !l.startsWith('emotionalMistake:'))
    .filter((l) => !l.startsWith('roughPages:'))
    .filter((l) => !l.startsWith('uncomfortableTruth:'))
    .filter((l) => !l.startsWith('endingType:'))
    .filter((l) => !l.startsWith('--- Page'))
    .join('\n');
  return body;
}

function countPages(text) {
  return (text.match(/^--- Page \d+ ---$/gm) || []).length;
}

// ─── Process one story ───────────────────────────────────────────────
function analyzeStory(filename) {
  const path = join(STORY_DIR, filename);
  const text = readFileSync(path, 'utf8');
  const body = getStoryBody(text);
  const pages = countPages(text);
  const wordCount = stripNikud(body).split(/\s+/).filter(Boolean).length;

  const counts = {};
  let coreTotal = 0;
  let extTotal = 0;

  for (const word of ALL_WORDS) {
    const c = countWord(body, word);
    counts[word] = c;
    if (CORE_FINGERPRINT.includes(word)) coreTotal += c;
    else extTotal += c;
  }

  return {
    filename,
    pages,
    wordCount,
    counts,
    coreTotal,
    extTotal,
    grandTotal: coreTotal + extTotal,
    corePerPage: pages > 0 ? +(coreTotal / pages).toFixed(2) : 0,
    densityPer100Words: wordCount > 0 ? +(((coreTotal + extTotal) / wordCount) * 100).toFixed(2) : 0,
  };
}

// ─── Main ────────────────────────────────────────────────────────────
function main() {
  const files = readdirSync(STORY_DIR)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !f.endsWith('_prompt.md'))
    .filter((f) => !f.endsWith('_DEEP_PROFILE.md'))
    .filter((f) => !f.startsWith('_'))
    .sort();

  console.log(`🔍 Fingerprint Analyzer`);
  console.log(`   Files: ${files.length}`);
  console.log(`   Input: ${STORY_DIR}`);
  console.log(`   Core words: ${CORE_FINGERPRINT.length}`);
  console.log(`   Extended:   ${EXTENDED_FINGERPRINT.length}`);
  console.log(`   Output: ${OUT_DIR}\n`);

  const results = [];
  for (const file of files) {
    const r = analyzeStory(file);
    results.push(r);
    writeFileSync(join(OUT_DIR, file.replace('.md', '.json')), JSON.stringify(r, null, 2), 'utf8');
  }

  // Aggregate counts across all stories
  const globalCounts = {};
  for (const word of ALL_WORDS) globalCounts[word] = 0;
  for (const r of results) {
    for (const word of ALL_WORDS) globalCounts[word] += r.counts[word];
  }

  // Sort results by density (highest first — most fingerprint-y)
  results.sort((a, b) => b.densityPer100Words - a.densityPer100Words);

  // ─── Build Reports ─────────────────────────────────────────────────
  let md = `# AI Fingerprint Analysis — ${new Date().toISOString().split('T')[0]}\n\n`;
  md += `**Input**: \`${INPUT_FOLDER}\`\n`;
  md += `**Files**: ${files.length}\n\n`;

  // Global stats
  const totalCore = results.reduce((s, r) => s + r.coreTotal, 0);
  const totalExt = results.reduce((s, r) => s + r.extTotal, 0);
  const totalWords = results.reduce((s, r) => s + r.wordCount, 0);
  md += `**Total core fingerprint occurrences**: ${totalCore}\n`;
  md += `**Total extended occurrences**: ${totalExt}\n`;
  md += `**Total body words**: ${totalWords}\n`;
  md += `**Global density**: ${((totalCore + totalExt) / totalWords * 100).toFixed(2)} per 100 words\n\n`;

  md += `## Core Fingerprint Word Frequency (Editor's 7)\n\n`;
  md += `| Word | Total | Per Story Avg |\n|---|---|---|\n`;
  for (const w of CORE_FINGERPRINT) {
    md += `| ${w} | ${globalCounts[w]} | ${(globalCounts[w] / files.length).toFixed(1)} |\n`;
  }
  md += `\n`;

  md += `## Extended Word Frequency\n\n`;
  md += `| Word | Total | Per Story Avg |\n|---|---|---|\n`;
  const extSorted = EXTENDED_FINGERPRINT.sort((a, b) => globalCounts[b] - globalCounts[a]);
  for (const w of extSorted) {
    if (globalCounts[w] === 0) continue;
    md += `| ${w} | ${globalCounts[w]} | ${(globalCounts[w] / files.length).toFixed(1)} |\n`;
  }
  md += `\n---\n\n`;

  // Top offenders
  md += `## Top 20 Stories by Fingerprint Density (per 100 words)\n\n`;
  md += `These stories overuse atmosphere/sensory words and would benefit most from a 15% cut:\n\n`;
  md += `| Rank | Story | Pages | Words | Core | Ext | Density |\n|---|---|---|---|---|---|---|\n`;
  for (let i = 0; i < Math.min(20, results.length); i++) {
    const r = results[i];
    md += `| ${i + 1} | ${r.filename} | ${r.pages} | ${r.wordCount} | ${r.coreTotal} | ${r.extTotal} | ${r.densityPer100Words}% |\n`;
  }
  md += `\n`;

  // Worst single-word offenders
  md += `## Stories with Highest Single-Word Repetition (core words only)\n\n`;
  md += `These have a specific word used 5+ times — likely needs trimming:\n\n`;
  const singleWordHighs = [];
  for (const r of results) {
    for (const w of CORE_FINGERPRINT) {
      if (r.counts[w] >= 5) {
        singleWordHighs.push({ file: r.filename, word: w, count: r.counts[w], pages: r.pages });
      }
    }
  }
  singleWordHighs.sort((a, b) => b.count - a.count);
  md += `| Story | Word | Count | Pages |\n|---|---|---|---|\n`;
  for (const x of singleWordHighs.slice(0, 30)) {
    md += `| ${x.file} | ${x.word} | ${x.count} | ${x.pages} |\n`;
  }
  md += `\n`;

  writeFileSync(join(OUT_DIR, '_summary.md'), md, 'utf8');

  // CSV: wide format with all words as columns
  let csv = 'filename,pages,words,density_per_100,' + ALL_WORDS.join(',') + '\n';
  for (const r of results) {
    const row = [r.filename, r.pages, r.wordCount, r.densityPer100Words]
      .concat(ALL_WORDS.map((w) => r.counts[w]));
    csv += row.join(',') + '\n';
  }
  writeFileSync(join(OUT_DIR, '_per-word.csv'), csv, 'utf8');

  // Console summary
  console.log(`📊 Top 10 fingerprint-density stories:`);
  for (let i = 0; i < Math.min(10, results.length); i++) {
    const r = results[i];
    console.log(`   ${i + 1}. ${r.filename}: density=${r.densityPer100Words}% (core=${r.coreTotal}, ext=${r.extTotal})`);
  }
  console.log(`\n📊 Core word totals:`);
  for (const w of CORE_FINGERPRINT) {
    console.log(`   ${w}: ${globalCounts[w]}`);
  }
  console.log(`\n📄 Reports:`);
  console.log(`   ${join(OUT_DIR, '_summary.md')}`);
  console.log(`   ${join(OUT_DIR, '_per-word.csv')}`);
}

main();
