#!/usr/bin/env node
/**
 * fix-wordcount-metadata.mjs — Replaces English number words with digits
 *                              in the WORD_COUNT: footer of v3 story files.
 *
 * Background:
 *   The story-generation LLM sometimes writes "Thirty" instead of 30 in the
 *   WORD_COUNT array on the last line of a story. This is a debug/QA metadata
 *   line — it has NO effect on the rendered book — but it's noisy in audits.
 *
 * This script ONLY touches the WORD_COUNT line. The story body, nikud, and
 * frontmatter are left untouched.
 *
 * Idempotent: re-runnable safely.
 *
 * Usage:
 *   node scripts/fix-wordcount-metadata.mjs           # write
 *   node scripts/fix-wordcount-metadata.mjs --dry-run # preview
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const STORY_DIR = join(process.cwd(), 'story-bank', 'v3');
const DRY_RUN = process.argv.includes('--dry-run');

// English number words → numeric digits.
// Order matters: compound words (thirty-eight) BEFORE single words (thirty),
// so a regex on "thirty" doesn't fire before "thirty-eight" is caught.
const REPLACEMENTS = [
  // 30-something (compound first)
  [/\bthirty[-\s]+one\b/gi,    '31'],
  [/\bthirty[-\s]+two\b/gi,    '32'],
  [/\bthirty[-\s]+three\b/gi,  '33'],
  [/\bthirty[-\s]+four\b/gi,   '34'],
  [/\bthirty[-\s]+five\b/gi,   '35'],
  [/\bthirty[-\s]+six\b/gi,    '36'],
  [/\bthirty[-\s]+seven\b/gi,  '37'],
  [/\bthirty[-\s]+eight\b/gi,  '38'],
  [/\bthirty[-\s]+nine\b/gi,   '39'],
  // 40-something
  [/\bforty[-\s]+one\b/gi,     '41'],
  [/\bforty[-\s]+two\b/gi,     '42'],
  [/\bforty[-\s]+three\b/gi,   '43'],
  [/\bforty[-\s]+four\b/gi,    '44'],
  [/\bforty[-\s]+five\b/gi,    '45'],
  [/\bforty[-\s]+six\b/gi,     '46'],
  [/\bforty[-\s]+seven\b/gi,   '47'],
  [/\bforty[-\s]+eight\b/gi,   '48'],
  [/\bforty[-\s]+nine\b/gi,    '49'],
  // 50-something
  [/\bfifty[-\s]+one\b/gi,     '51'],
  [/\bfifty[-\s]+two\b/gi,     '52'],
  [/\bfifty[-\s]+three\b/gi,   '53'],
  [/\bfifty[-\s]+four\b/gi,    '54'],
  [/\bfifty[-\s]+five\b/gi,    '55'],
  [/\bfifty[-\s]+six\b/gi,     '56'],
  [/\bfifty[-\s]+seven\b/gi,   '57'],
  [/\bfifty[-\s]+eight\b/gi,   '58'],
  [/\bfifty[-\s]+nine\b/gi,    '59'],
  // Tens (after compounds)
  [/\bten\b/gi,                '10'],
  [/\beleven\b/gi,             '11'],
  [/\btwelve\b/gi,             '12'],
  [/\bthirteen\b/gi,           '13'],
  [/\bfourteen\b/gi,           '14'],
  [/\bfifteen\b/gi,            '15'],
  [/\bsixteen\b/gi,            '16'],
  [/\bseventeen\b/gi,          '17'],
  [/\beighteen\b/gi,           '18'],
  [/\bnineteen\b/gi,           '19'],
  [/\btwenty\b/gi,             '20'],
  [/\bthirty\b/gi,             '30'],
  [/\bforty\b/gi,              '40'],
  [/\bfifty\b/gi,              '50'],
  [/\bsixty\b/gi,              '60'],
  // Cleanup: question marks, weird placeholders
  [/\[\s*[A-Za-z]+\?\s*\]/g,   '[?]'], // e.g. "[Thirty?]" → "[?]" (still broken, just less weird)
];

function fixWordCountLine(line) {
  let fixed = line;
  for (const [re, val] of REPLACEMENTS) {
    fixed = fixed.replace(re, val);
  }
  // Collapse multiple spaces and odd whitespace inside the brackets
  fixed = fixed.replace(/\[\s*/, '[').replace(/\s*\]/, ']');
  fixed = fixed.replace(/,\s+/g, ',').replace(/,/g, ', ');
  return fixed;
}

function recomputeTotal(line) {
  // Extract the array of numbers between [ and ]
  const arrMatch = line.match(/\[([^\]]+)\]/);
  if (!arrMatch) return line;
  const numbers = arrMatch[1]
    .split(',')
    .map((s) => s.trim())
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
  if (numbers.length === 0) return line;
  const total = numbers.reduce((a, b) => a + b, 0);
  // Replace existing "= NNN" with the recomputed sum
  return line.replace(/=\s*\d+\s*$/, `= ${total}`);
}

function processFile(filename) {
  const filepath = join(STORY_DIR, filename);
  let content;
  try {
    content = readFileSync(filepath, 'utf8');
  } catch (err) {
    return { filename, status: 'read_error', error: err.message };
  }

  const lines = content.split('\n');
  let touched = false;
  let lineIdx = -1;
  let originalLine = '';
  let newLine = '';

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('WORD_COUNT:')) {
      const hasEnglish = /[A-Za-z]/.test(lines[i].replace(/^WORD_COUNT:/, ''));
      if (!hasEnglish) {
        return { filename, status: 'already_clean' };
      }
      originalLine = lines[i];
      newLine = recomputeTotal(fixWordCountLine(lines[i]));
      lines[i] = newLine;
      touched = true;
      lineIdx = i;
      break; // only first WORD_COUNT: line per file
    }
  }

  if (!touched) {
    return { filename, status: 'no_wordcount_line' };
  }

  if (!DRY_RUN) {
    try {
      writeFileSync(filepath, lines.join('\n'), 'utf8');
    } catch (err) {
      return { filename, status: 'write_error', error: err.message };
    }
  }

  return {
    filename,
    status: DRY_RUN ? 'would_fix' : 'fixed',
    lineNumber: lineIdx + 1,
    before: originalLine.trim(),
    after: newLine.trim(),
  };
}

// ─── Main ────────────────────────────────────────────────────────────
function main() {
  let files;
  try {
    files = readdirSync(STORY_DIR);
  } catch (err) {
    console.error(`❌ Cannot read ${STORY_DIR}: ${err.message}`);
    process.exit(1);
  }

  files = files
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !f.endsWith('_prompt.md'))
    .filter((f) => !f.endsWith('_DEEP_PROFILE.md'))
    .sort();

  console.log(
    `🔧 Scanning ${files.length} story files for English number words in WORD_COUNT line${DRY_RUN ? ' (DRY RUN)' : ''}\n`
  );

  const fixed = [];
  const clean = [];
  const errors = [];

  for (const file of files) {
    const result = processFile(file);
    if (result.status === 'fixed' || result.status === 'would_fix') {
      fixed.push(result);
      console.log(`✅ ${file}`);
      console.log(`   BEFORE: ${result.before}`);
      console.log(`   AFTER:  ${result.after}\n`);
    } else if (result.status === 'already_clean') {
      clean.push(result);
    } else {
      errors.push(result);
      console.log(`❌ ${file}: ${result.status}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ${DRY_RUN ? 'Would fix' : 'Fixed'}: ${fixed.length}`);
  console.log(`   Already clean: ${clean.length}`);
  console.log(`   Errors: ${errors.length}`);

  if (errors.length > 0) process.exit(1);
}

main();
