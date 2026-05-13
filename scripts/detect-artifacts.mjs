#!/usr/bin/env node
/**
 * detect-artifacts.mjs — Pure-data scan for production blockers in stories.
 *
 * Catches issues a human reader would notice:
 *   1. Editorial leakage — LLM commentary that ended up in the text
 *      ("או לחלופין", "להחליף ב", "הצעה:", etc.)
 *   2. Word/phrase duplication ("הכתיבה יצאה הכתיבה יצאה")
 *   3. Stray markdown ('```', '**' in story body)
 *   4. Placeholder leakage (broken {{childName}}, [INSERT], etc.)
 *   5. Suspicious editor-voice parentheses ("(הערה:", "(לציין:")
 *
 * Zero LLM calls. Pure regex + structural analysis.
 *
 * Output:
 *   artifacts/<filename>.json     — per-story findings
 *   artifacts/_summary.md         — ranked report (worst first)
 *   artifacts/_blockers.md        — production blockers only
 *
 * Usage:
 *   node scripts/detect-artifacts.mjs                       # default: v3-final
 *   node scripts/detect-artifacts.mjs --input=v3-conservative
 *   node scripts/detect-artifacts.mjs --input=v3-applied
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const INPUT_FOLDER = process.argv.find((a) => a.startsWith('--input='))?.split('=')[1] || 'v3-final';
const STORY_DIR = join(process.cwd(), 'story-bank', INPUT_FOLDER);
const OUT_DIR = join(process.cwd(), 'artifacts');

if (!existsSync(STORY_DIR)) {
  console.error(`❌ Story directory not found: ${STORY_DIR}`);
  process.exit(1);
}
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ─── Detection Patterns ──────────────────────────────────────────────
const PATTERNS = [
  {
    name: 'prompt_rewrite_arrow',
    severity: 'BLOCKER',
    description: 'Editorial arrow between alternate sentence versions',
    regex: /[א-ת][^.\n]{0,120}→[^.\n]{0,120}[א-ת]/g,
    bodyOnly: true,
    skipLinePrefix: /^(emotionalArc|Tokens|title|companionId|roughPages|collapsePoint|weirdMoment|stakes|metaphor|storyStyle|quietPage|heartLine|copingVisible|forbiddenPatterns|emotionalMistake|uncomfortableTruth|endingType|Generated|Model|Finish|Time|pages|category|gender|companionLetter):/,
  },
  {
    name: 'doubled_childname',
    severity: 'BLOCKER',
    description: 'Duplicate {{childName}} placeholder at sentence start',
    regex: /\{\{childName\}\}\s+\{\{childName\}\}/g,
    bodyOnly: true,
  },
  {
    name: 'editorial_leakage',
    severity: 'BLOCKER',
    description: 'LLM commentary leaked into story text',
    regex: /(או\s+לחלופין|להחליף\s+ב[^\s,.]+|הצעה\s*:|תיקון\s*:|לפשט\s+(את|כל)|להוסיף\s+ל|השמטה\s+מומלצת|לסלק\s+את|להעיף\s+את|חלופה\s*:)/g,
  },
  {
    name: 'parenthetical_editor_note',
    severity: 'BLOCKER',
    description: 'Editor-voice parenthetical comment',
    regex: /\((הערה|הסבר|לציין|הערת\s+עורך|לתיקון)\s*:[^)]*\)/g,
  },
  {
    name: 'markdown_in_body',
    severity: 'BLOCKER',
    description: 'Stray markdown formatting in story body',
    // Only flag if appears AFTER the second `---` (i.e., after frontmatter)
    regex: /(?:^|\n)(```|^\*\*[^*]+\*\*\s*$)/gm,
    bodyOnly: true,
  },
  {
    name: 'broken_placeholder',
    severity: 'BLOCKER',
    description: 'Broken or incomplete placeholder',
    regex: /\{\{[^}]*$|\{\{[^}]{0,2}\}\}|\[INSERT[^\]]*\]|\[TODO[^\]]*\]/g,
  },
  {
    name: 'word_duplication',
    severity: 'BLOCKER',
    description: 'Same word repeated immediately',
    // Word followed by 1-2 chars optional whitespace then same word
    // Skip common Hebrew duplications that ARE valid: "שלי. שלי. שלי.", "אחת אחת", etc.
    regex: /\b([א-ת]{4,})\s+\1\b/g,
    skipIfFollowedBy: /[.,!?:]/, // skip if it's "שלי. שלי." style rhythmic repetition
  },
  {
    name: 'phrase_duplication',
    severity: 'BLOCKER',
    description: 'Same 2-word phrase repeated immediately',
    regex: /\b([א-ת]{3,}\s+[א-ת]{3,})\s+\1\b/g,
  },
  {
    name: 'mid_sentence_ellipsis_LLM',
    severity: 'WARNING',
    description: 'Triple-dot ellipsis in middle of sentence (LLM tic)',
    // Skip "..." at end of sentence — those are dramatic pauses, fine
    // Flag "X... Y" patterns where Y starts with lowercase letter
    regex: /[א-ת]\.\.\.\s+[א-ת]{3,}/g,
    contextual: 'review',
  },
  {
    name: 'english_word_in_body',
    severity: 'WARNING',
    description: 'English word in Hebrew story body',
    // Skip imageDirection lines which are intentionally English
    regex: /(?<!imageDirection:.*)\b[A-Za-z]{4,}\b/g,
    skipImageDirection: true,
  },
  {
    name: 'unclosed_quote',
    severity: 'WARNING',
    description: 'Possibly unclosed quote mark',
    customCheck: (text) => {
      // Count " in story body (skip frontmatter + imageDirection)
      const lines = text.split('\n');
      const issues = [];
      let inFrontmatter = false;
      let dashCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
          dashCount++;
          if (dashCount === 1) inFrontmatter = true;
          else if (dashCount === 2) inFrontmatter = false;
          continue;
        }
        if (inFrontmatter) continue;
        if (lines[i].startsWith('imageDirection:')) continue;
        const quotes = (lines[i].match(/"/g) || []).length;
        if (quotes % 2 !== 0) {
          issues.push({ line: i + 1, snippet: lines[i].trim().slice(0, 100) });
        }
      }
      return issues;
    },
  },
];

// ─── Process one story ───────────────────────────────────────────────
function analyzeStory(filename) {
  const path = join(STORY_DIR, filename);
  const text = readFileSync(path, 'utf8');
  const findings = [];

  // Split text into frontmatter + body
  const dashIdx1 = text.indexOf('\n---\n');
  let bodyStart = 0;
  if (dashIdx1 >= 0) {
    const dashIdx2 = text.indexOf('\n---\n', dashIdx1 + 5);
    if (dashIdx2 >= 0) bodyStart = dashIdx2 + 5;
  }
  const body = text.slice(bodyStart);
  const lines = text.split('\n');

  for (const pattern of PATTERNS) {
    if (pattern.customCheck) {
      const issues = pattern.customCheck(text);
      for (const iss of issues) {
        findings.push({
          pattern: pattern.name,
          severity: pattern.severity,
          description: pattern.description,
          line: iss.line,
          snippet: iss.snippet,
        });
      }
      continue;
    }

    const searchText = pattern.bodyOnly ? body : text;
    const matches = [...searchText.matchAll(pattern.regex)];

    for (const match of matches) {
      // Skip imageDirection lines if requested
      if (pattern.skipImageDirection) {
        const pos = match.index;
        const lineStart = searchText.lastIndexOf('\n', pos) + 1;
        const lineEnd = searchText.indexOf('\n', pos);
        const line = searchText.slice(lineStart, lineEnd >= 0 ? lineEnd : undefined);
        if (line.startsWith('imageDirection:')) continue;
      }

      // Skip rhythmic repetition (word followed by punctuation)
      if (pattern.skipIfFollowedBy) {
        const matchEnd = match.index + match[0].length;
        const nextChar = searchText[matchEnd];
        if (pattern.skipIfFollowedBy.test(nextChar || '')) continue;
        // Also skip if the matched word is followed by punctuation INSIDE the duplication
        // e.g. "שלי. שלי" — the first word ends with period
        const firstWord = match[1];
        const wordEndInMatch = match[0].indexOf(firstWord) + firstWord.length;
        const charAfterFirstWord = match[0][wordEndInMatch];
        if (pattern.skipIfFollowedBy.test(charAfterFirstWord || '')) continue;
      }

      // Find line number
      const beforeMatch = searchText.slice(0, match.index);
      const offsetLines = beforeMatch.split('\n').length - 1;
      const fullTextOffset = pattern.bodyOnly ? bodyStart : 0;
      const fullTextBefore = text.slice(0, fullTextOffset) + beforeMatch;
      const line = fullTextBefore.split('\n').length;
      const lineText = text.split('\n')[line - 1] || '';

      if (pattern.skipLinePrefix && pattern.skipLinePrefix.test(lineText.trim())) {
        continue;
      }

      // Get snippet — 60 chars around match
      const start = Math.max(0, match.index - 30);
      const end = Math.min(searchText.length, match.index + match[0].length + 30);
      const snippet = searchText.slice(start, end).replace(/\n/g, ' ').trim();

      findings.push({
        pattern: pattern.name,
        severity: pattern.severity,
        description: pattern.description,
        line,
        match: match[0],
        snippet,
      });
    }
  }

  return findings;
}

// ─── Main ────────────────────────────────────────────────────────────
function main() {
  const files = readdirSync(STORY_DIR)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !f.endsWith('_prompt.md'))
    .filter((f) => !f.endsWith('_DEEP_PROFILE.md'))
    .filter((f) => !f.startsWith('_'))
    .sort();

  console.log(`🔍 Detecting Artifacts`);
  console.log(`   Files: ${files.length}`);
  console.log(`   Input: ${STORY_DIR}`);
  console.log(`   Output: ${OUT_DIR}\n`);

  const allFindings = [];
  let cleanCount = 0;
  let withBlockers = 0;
  let withWarnings = 0;

  for (const file of files) {
    const findings = analyzeStory(file);
    const blockers = findings.filter((f) => f.severity === 'BLOCKER');
    const warnings = findings.filter((f) => f.severity === 'WARNING');

    writeFileSync(
      join(OUT_DIR, file.replace('.md', '.json')),
      JSON.stringify({ filename: file, findings }, null, 2),
      'utf8'
    );

    allFindings.push({ filename: file, findings, blockers: blockers.length, warnings: warnings.length });

    if (findings.length === 0) cleanCount++;
    if (blockers.length > 0) withBlockers++;
    if (warnings.length > 0 && blockers.length === 0) withWarnings++;

    if (blockers.length > 0) {
      console.log(`🔴 ${file}: ${blockers.length} BLOCKERS, ${warnings.length} warnings`);
    } else if (warnings.length > 0) {
      console.log(`🟡 ${file}: ${warnings.length} warnings`);
    } else {
      console.log(`✅ ${file}: clean`);
    }
  }

  // Sort: blockers first, then by count
  allFindings.sort((a, b) => (b.blockers - a.blockers) || (b.warnings - a.warnings));

  // ─── Summary ─────────────────────────────────────────────────────
  let md = `# Artifact Detection Report — ${new Date().toISOString().split('T')[0]}\n\n`;
  md += `**Input**: \`${INPUT_FOLDER}\`\n`;
  md += `**Files**: ${files.length}\n`;
  md += `**Clean**: ${cleanCount}\n`;
  md += `**With BLOCKERS**: ${withBlockers}\n`;
  md += `**With warnings only**: ${withWarnings}\n\n`;

  // Pattern frequency
  const patternCounts = {};
  for (const f of allFindings) {
    for (const finding of f.findings) {
      patternCounts[finding.pattern] = (patternCounts[finding.pattern] || 0) + 1;
    }
  }
  md += `## Pattern Frequency\n\n| Pattern | Count |\n|---|---|\n`;
  for (const [p, c] of Object.entries(patternCounts).sort((a, b) => b[1] - a[1])) {
    md += `| ${p} | ${c} |\n`;
  }
  md += `\n---\n\n`;

  // Per-file details
  for (const f of allFindings) {
    if (f.findings.length === 0) continue;
    md += `## ${f.filename} (${f.blockers} blockers, ${f.warnings} warnings)\n\n`;
    md += `| Line | Severity | Pattern | Match | Snippet |\n|---|---|---|---|---|\n`;
    for (const finding of f.findings) {
      const m = (finding.match || '').replace(/\|/g, '\\|').slice(0, 40);
      const s = (finding.snippet || '').replace(/\|/g, '\\|').slice(0, 80);
      md += `| ${finding.line} | ${finding.severity} | ${finding.pattern} | \`${m}\` | ${s} |\n`;
    }
    md += `\n`;
  }
  writeFileSync(join(OUT_DIR, '_summary.md'), md, 'utf8');

  // Blockers-only report
  let blockerMd = `# BLOCKERS — ${new Date().toISOString().split('T')[0]}\n\n`;
  blockerMd += `Stories that CANNOT ship until these are fixed:\n\n`;
  for (const f of allFindings) {
    const blockers = f.findings.filter((x) => x.severity === 'BLOCKER');
    if (blockers.length === 0) continue;
    blockerMd += `## ${f.filename}\n\n`;
    for (const b of blockers) {
      blockerMd += `- **Line ${b.line}** [${b.pattern}]: \`${b.match}\`\n  Context: ${b.snippet}\n\n`;
    }
  }
  writeFileSync(join(OUT_DIR, '_blockers.md'), blockerMd, 'utf8');

  console.log(`\n📊 Summary:`);
  console.log(`   Clean files:        ${cleanCount}`);
  console.log(`   Files with BLOCKERS: ${withBlockers}`);
  console.log(`   Files with warnings: ${withWarnings}`);
  console.log(`\n📄 Reports:`);
  console.log(`   ${join(OUT_DIR, '_summary.md')}`);
  console.log(`   ${join(OUT_DIR, '_blockers.md')}`);
}

main();
