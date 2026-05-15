#!/usr/bin/env node
/**
 * apply-audit-suggestions.mjs — Programmatically apply audit suggestions.
 *
 * Reads each story file + its corresponding audit JSON, then performs
 * surgical find-and-replace for every flagged quote → suggestion pair.
 *
 * Zero LLM calls — pure text manipulation based on audit findings.
 *
 * Strategy:
 *   1. For each issue: try EXACT match of quote → replace with suggestion
 *   2. If exact fails: try whitespace-normalized match
 *   3. If still fails: try nikud-stripped match (replace stripped version)
 *   4. If still fails: log as "skipped" — needs manual or LLM intervention
 *
 * Output:
 *   story-bank/v3-applied/<filename>.md — story with suggestions applied
 *   story-bank/v3-applied/_report.md   — per-file stats
 *
 * Usage:
 *   node scripts/apply-audit-suggestions.mjs              # all stories
 *   node scripts/apply-audit-suggestions.mjs --limit=5    # test on first 5
 *   node scripts/apply-audit-suggestions.mjs --force      # re-apply
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ─── CLI flags ───────────────────────────────────────────────────────
// --input=v3-applied        (default: v3)
// --audits=audits-prose     (default: audits)
// --output=v3-final         (default: v3-applied)
// --skip-categories=A,B,C   (default: none)
// --force                   (re-process even cached files)
// --limit=N                 (only first N files)
const INPUT_FOLDER = process.argv.find((a) => a.startsWith('--input='))?.split('=')[1] || 'v3';
const AUDIT_FOLDER = process.argv.find((a) => a.startsWith('--audits='))?.split('=')[1] || 'audits';
const OUTPUT_FOLDER = process.argv.find((a) => a.startsWith('--output='))?.split('=')[1] || 'v3-applied';
const SKIP_CATEGORIES = new Set(
  (process.argv.find((a) => a.startsWith('--skip-categories='))?.split('=')[1] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

const STORY_DIR = join(process.cwd(), 'story-bank', INPUT_FOLDER);
const AUDIT_DIR = join(process.cwd(), AUDIT_FOLDER);
const OUT_DIR = join(process.cwd(), 'story-bank', OUTPUT_FOLDER);

const FORCE = process.argv.includes('--force');
const LIMIT = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0', 10);

if (!existsSync(STORY_DIR)) {
  console.error(`❌ Story directory not found: ${STORY_DIR}`);
  process.exit(1);
}
if (!existsSync(AUDIT_DIR)) {
  console.error(`❌ Audit directory not found: ${AUDIT_DIR}`);
  process.exit(1);
}
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ─── Nikud helpers ───────────────────────────────────────────────────
function stripNikud(s) {
  return s.replace(/[֑-ׇ]/g, '');
}

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

// ─── Quote → Suggestion replacement ──────────────────────────────────
function applyOneIssue(text, quote, suggestion) {
  if (!quote || !suggestion) {
    return { text, status: 'invalid' };
  }

  // 1. Try exact match
  if (text.includes(quote)) {
    return { text: text.replace(quote, suggestion), status: 'exact' };
  }

  // 2. Try whitespace-normalized match (build map from normalized → original)
  const normalizedQuote = normalizeWhitespace(quote);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const normalizedLine = normalizeWhitespace(lines[i]);
    if (normalizedLine.includes(normalizedQuote)) {
      const idx = normalizedLine.indexOf(normalizedQuote);
      // Reconstruct: find approximate match in original line
      // Walk through chars of original line, ignore extra whitespace
      let origStart = -1;
      let normCount = 0;
      let lastWasSpace = false;
      for (let j = 0; j < lines[i].length; j++) {
        const ch = lines[i][j];
        const isSpace = /\s/.test(ch);
        if (isSpace) {
          if (!lastWasSpace) {
            if (normCount === idx) { origStart = j; break; }
            normCount++;
          }
          lastWasSpace = true;
        } else {
          if (normCount === idx) { origStart = j; break; }
          normCount++;
          lastWasSpace = false;
        }
      }
      if (origStart >= 0) {
        // Find end by length of normalized quote
        let origEnd = origStart;
        let copied = 0;
        while (origEnd < lines[i].length && copied < normalizedQuote.length) {
          const ch = lines[i][origEnd];
          const isSpace = /\s/.test(ch);
          if (isSpace) {
            if (origEnd > origStart && !/\s/.test(lines[i][origEnd - 1])) copied++;
          } else {
            copied++;
          }
          origEnd++;
        }
        const before = lines[i].slice(0, origStart);
        const after = lines[i].slice(origEnd);
        lines[i] = before + suggestion + after;
        return { text: lines.join('\n'), status: 'whitespace_normalized' };
      }
    }
  }

  // 3. Try nikud-stripped match
  const strippedQuote = stripNikud(quote);
  if (strippedQuote && strippedQuote.length > 5) {
    const strippedText = stripNikud(text);
    if (strippedText.includes(strippedQuote)) {
      // Find approximate position in original text
      // This is harder; just log for manual review
      return { text, status: 'nikud_match_only', strippedQuote };
    }
  }

  return { text, status: 'not_found' };
}

// ─── Process one story ───────────────────────────────────────────────
function processStory(filename) {
  const storyPath = join(STORY_DIR, filename);
  const auditPath = join(AUDIT_DIR, filename.replace('.md', '.json'));
  const outPath = join(OUT_DIR, filename);

  if (existsSync(outPath) && !FORCE) {
    return { filename, status: 'cached' };
  }

  if (!existsSync(auditPath)) {
    return { filename, status: 'no_audit' };
  }

  let storyText, audit;
  try {
    storyText = readFileSync(storyPath, 'utf8');
    audit = JSON.parse(readFileSync(auditPath, 'utf8'));
  } catch (err) {
    return { filename, status: 'read_error', error: err.message };
  }

  if (audit.error || !audit.issues || audit.issues.length === 0) {
    // No issues — just copy file as-is
    writeFileSync(outPath, storyText, 'utf8');
    return { filename, status: 'no_issues', applied: 0, total: 0 };
  }

  let workingText = storyText;
  const stats = { exact: 0, whitespace: 0, nikud_only: 0, not_found: 0, invalid: 0, skipped_category: 0 };
  const skippedIssues = [];

  for (const issue of audit.issues) {
    // Skip by category filter
    if (issue.category && SKIP_CATEGORIES.has(issue.category)) {
      stats.skipped_category++;
      continue;
    }

    const result = applyOneIssue(workingText, issue.quote, issue.suggestion);
    workingText = result.text;
    switch (result.status) {
      case 'exact': stats.exact++; break;
      case 'whitespace_normalized': stats.whitespace++; break;
      case 'nikud_match_only':
        stats.nikud_only++;
        skippedIssues.push({ page: issue.page, category: issue.category, quote: issue.quote, reason: 'nikud_mismatch' });
        break;
      case 'not_found':
        stats.not_found++;
        skippedIssues.push({ page: issue.page, category: issue.category, quote: issue.quote, reason: 'quote_not_in_story' });
        break;
      case 'invalid':
        stats.invalid++;
        break;
    }
  }

  writeFileSync(outPath, workingText, 'utf8');

  return {
    filename,
    status: 'processed',
    verdict: audit.verdict,
    score: audit.score,
    totalIssues: audit.issues.length,
    applied: stats.exact + stats.whitespace,
    stats,
    skippedIssues,
  };
}

// ─── Main ────────────────────────────────────────────────────────────
function main() {
  let files = readdirSync(STORY_DIR)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !f.endsWith('_prompt.md'))
    .filter((f) => !f.endsWith('_DEEP_PROFILE.md'))
    .filter((f) => !f.startsWith('_'))  // skip _report.md, _summary.md etc
    .sort();

  if (LIMIT > 0) {
    files = files.slice(0, LIMIT);
    console.log(`📌 Limited to first ${LIMIT} files`);
  }

  console.log(`🔧 Apply Audit Suggestions`);
  console.log(`   Files: ${files.length}`);
  console.log(`   Story dir: ${STORY_DIR}`);
  console.log(`   Audit dir: ${AUDIT_DIR}`);
  console.log(`   Output:    ${OUT_DIR}`);
  if (SKIP_CATEGORIES.size > 0) {
    console.log(`   Skip cats: ${[...SKIP_CATEGORIES].join(', ')}`);
  }
  console.log('');

  const totals = { exact: 0, whitespace: 0, nikud_only: 0, not_found: 0, invalid: 0, skipped_category: 0 };
  let totalIssues = 0;
  let totalApplied = 0;
  let processed = 0;
  let cached = 0;
  let noAudit = 0;
  const perFileStats = [];

  for (const file of files) {
    const result = processStory(file);
    if (result.status === 'cached') {
      cached++;
      continue;
    }
    if (result.status === 'no_audit') {
      noAudit++;
      console.log(`⚠️  ${file}: no audit found`);
      continue;
    }
    if (result.status === 'read_error') {
      console.log(`❌ ${file}: ${result.error}`);
      continue;
    }
    if (result.status === 'no_issues') {
      console.log(`✅ ${file}: no issues to apply`);
      continue;
    }

    processed++;
    totalIssues += result.totalIssues;
    totalApplied += result.applied;
    for (const k of Object.keys(totals)) totals[k] += result.stats[k] || 0;
    perFileStats.push(result);

    const pct = result.totalIssues > 0 ? Math.round((result.applied / result.totalIssues) * 100) : 0;
    const icon = pct === 100 ? '✅' : pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : '🟠';
    console.log(`${icon} ${file}: ${result.applied}/${result.totalIssues} applied (${pct}%) [${result.verdict}]`);
  }

  // Build report
  let report = `# Apply Audit Suggestions Report — ${new Date().toISOString().split('T')[0]}\n\n`;
  report += `**Files processed**: ${processed}\n`;
  report += `**Files cached**: ${cached}\n`;
  report += `**Files without audit**: ${noAudit}\n\n`;
  report += `**Total issues**: ${totalIssues}\n`;
  report += `**Applied (exact)**: ${totals.exact}\n`;
  report += `**Applied (whitespace-normalized)**: ${totals.whitespace}\n`;
  report += `**Skipped by category filter**: ${totals.skipped_category}\n`;
  report += `**Skipped (nikud-only match)**: ${totals.nikud_only}\n`;
  report += `**Skipped (not found)**: ${totals.not_found}\n`;
  report += `**Invalid**: ${totals.invalid}\n\n`;
  const applyRate = totalIssues > 0 ? Math.round((totalApplied / totalIssues) * 100) : 0;
  report += `**Apply rate**: ${applyRate}%\n\n---\n\n`;

  // List skipped issues per file
  const filesWithSkips = perFileStats.filter((s) => s.skippedIssues && s.skippedIssues.length > 0);
  if (filesWithSkips.length > 0) {
    report += `## Skipped issues (need manual or LLM fix)\n\n`;
    for (const f of filesWithSkips) {
      report += `### ${f.filename}\n\n`;
      for (const si of f.skippedIssues) {
        const cat = si.category ? ` [${si.category}]` : '';
        report += `- Page ${si.page}${cat} (${si.reason}): \`${si.quote}\`\n`;
      }
      report += `\n`;
    }
  }

  writeFileSync(join(OUT_DIR, '_report.md'), report, 'utf8');

  console.log(`\nSummary:`);
  console.log(`   Issues total:              ${totalIssues}`);
  console.log(`   Applied (exact):           ${totals.exact}`);
  console.log(`   Applied (normalized):      ${totals.whitespace}`);
  console.log(`   Skipped by category:       ${totals.skipped_category}`);
  console.log(`   Skipped (nikud only):      ${totals.nikud_only}`);
  console.log(`   Skipped (not found):       ${totals.not_found}`);
  console.log(`   Invalid:                   ${totals.invalid}`);
  console.log(`   APPLY RATE (of applicable): ${applyRate}%`);
  console.log(`\nOutput: ${OUT_DIR}`);
  console.log(`Report: ${join(OUT_DIR, '_report.md')}`);
}

main();
