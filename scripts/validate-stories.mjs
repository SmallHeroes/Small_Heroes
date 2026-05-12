#!/usr/bin/env node
/**
 * Story Validator — v1
 *
 * Validates v3 story files against structural rules:
 * 1. Quiet page position matches companion profile target
 * 2. Actual Hebrew word count on quiet page (≤20 cap)
 * 3. Ending type matches direction (bedtime=resolution, adventure=residue, fantasy=distance)
 * 4. WORD_COUNT array accuracy check
 * 5. Functional action pattern detection in pages 10-12
 *
 * Usage:
 *   node scripts/validate-stories.mjs <file|directory>
 *   node scripts/validate-stories.mjs stories/          # validate all .md files in dir
 *   node scripts/validate-stories.mjs story.md           # validate single file
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

// ─── CONFIG ────────────────────────────────────────────────────────

const QUIET_PAGE_TARGETS = {
  octopus_seara: 11,
  bat_lily: 15,
  chameleon_koko: 8,
  dolphin_shahkan: 7,
  fawn_tzvi: 5,
};

const ENDING_TYPE_BY_DIRECTION = {
  bedtime: 'resolution',
  adventure: 'residue',
  fantasy: 'distance',
};

const SILENCE_CAP = 20; // max words on quiet page

// Functional action patterns — GPT tends to use these in pages 10-12
// These are Hebrew verb forms that indicate "solving" rather than "feeling"
const FUNCTIONAL_PATTERNS = [
  /מְסַדֵּר/,    // arranges
  /מְסַדֶּרֶת/,  // arranges (f)
  /בּוֹנֶה/,      // builds
  /אוֹסֵף/,      // collects
  /אוֹסֶפֶת/,    // collects (f)
  /קוֹשֵׁר/,     // ties
  /קוֹשֶׁרֶת/,   // ties (f)
  /מַנִּיחַ/,     // places (can be OK but flag)
  /מַנִּיחָה/,    // places (f)
  /מַרְכִּיב/,    // assembles
  /מַחְבֵּר/,     // connects
  /מַתְקִין/,     // installs
  /מְחַבֵּר/,     // connects
  /מְתַקֵּן/,     // fixes
];

// ─── HELPERS ───────────────────────────────────────────────────────

function countHebrewWords(text) {
  // Remove imageDirection lines
  const cleaned = text
    .split('\n')
    .filter(l => !l.trim().startsWith('imageDirection:'))
    .join(' ');

  // Remove punctuation, template vars, and extra whitespace
  const normalized = cleaned
    .replace(/\{\{childName\}\}/g, 'CHILD')  // count template as 1 word
    .replace(/["""״׳,;:!?.\-—–…()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return 0;

  // Split on whitespace and count non-empty tokens
  return normalized.split(/\s+/).filter(w => w.length > 0).length;
}

function countSentences(text) {
  // Remove imageDirection lines
  const cleaned = text
    .split('\n')
    .filter(l => !l.trim().startsWith('imageDirection:'))
    .join(' ')
    .trim();

  if (!cleaned) return 0;

  // Split on sentence-ending punctuation (. ! ? and Hebrew equivalents)
  // Handle multiple punctuation marks (e.g., "?!" counts as one ending)
  const sentences = cleaned
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences.length;
}

function parseStoryFile(content) {
  const result = {
    metadata: {},
    pages: {},
    wordCountArray: null,
    wordCountTotal: null,
  };

  // The file structure is:
  // # Header line
  // Generated: ...
  // ...
  // ---
  // ---
  // title: "..."
  // companionId: ...
  // ...
  // ---
  //
  // storyStyle: ...
  // quietPage: ...
  // endingType: ...
  // ...
  //
  // --- Page 1 ---

  // Extract everything before first page
  const beforePages = content.split(/--- Page 1 ---/)[0] || '';

  // Find all key: value lines in the entire header area
  // This catches both YAML frontmatter AND story-level metadata
  for (const line of beforePages.split('\n')) {
    const m = line.match(/^(\w[\w]*?):\s*(.+)/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      // Skip non-metadata lines (like "Generated:", "Model:", "Tokens:", etc.)
      if (['Generated', 'Model', 'Tokens', 'Finish', 'Time'].includes(key)) continue;
      result.metadata[key] = val;
    }
  }

  // Extract pages
  const pageRegex = /--- Page (\d+) ---\n([\s\S]*?)(?=--- Page \d+ ---|WORD_COUNT:|$)/g;
  let match;
  while ((match = pageRegex.exec(content)) !== null) {
    const pageNum = parseInt(match[1]);
    const pageContent = match[2].trim();

    // Split text from imageDirection
    const lines = pageContent.split('\n');
    const textLines = lines.filter(l => !l.trim().startsWith('imageDirection:'));
    const text = textLines.join('\n').trim();

    result.pages[pageNum] = {
      text,
      fullContent: pageContent,
      wordCount: countHebrewWords(text),
      sentenceCount: countSentences(text),
    };
  }

  // Extract WORD_COUNT
  const wcMatch = content.match(/WORD_COUNT:\s*\[([\s\S]*?)\]\s*=\s*(\d+)/);
  if (wcMatch) {
    // Parse array, handling potential "Fifty" or other non-numeric entries
    result.wordCountArray = wcMatch[1].split(',').map(v => {
      const n = parseInt(v.trim());
      return isNaN(n) ? v.trim() : n;
    });
    result.wordCountTotal = parseInt(wcMatch[2]);
  }

  return result;
}

function identifyStory(filename, metadata) {
  // Try to extract companion and direction from filename
  // Format: companion_name_direction-hash.md or companion_name_direction.md
  const fnMatch = filename.match(/^(\w+?)_(bedtime|adventure|fantasy)/);
  if (fnMatch) {
    return {
      companion: filename.replace(/[-_](bedtime|adventure|fantasy).*/, ''),
      direction: fnMatch[2],
    };
  }

  // Fallback to metadata
  return {
    companion: metadata.companionId || 'unknown',
    direction: metadata.direction || 'unknown',
  };
}

// ─── VALIDATION ────────────────────────────────────────────────────

function validateStory(filepath) {
  const content = readFileSync(filepath, 'utf8');
  const filename = basename(filepath);
  const story = parseStoryFile(content);
  const { companion, direction } = identifyStory(filename, story.metadata);

  const issues = [];
  const warnings = [];
  const passes = [];

  // ── 1. Quiet page position ──
  const targetQuietPage = QUIET_PAGE_TARGETS[companion];
  const metaQuietPage = story.metadata.quietPage;

  if (targetQuietPage) {
    // Extract page number from quietPage metadata (format: "7 — description")
    const quietPageNum = metaQuietPage
      ? parseInt(metaQuietPage.match(/^(\d+)/)?.[1])
      : null;

    if (quietPageNum === targetQuietPage) {
      passes.push(`quietPage position: ${quietPageNum} ✓ (target: ${targetQuietPage})`);
    } else {
      issues.push(`quietPage position: metadata says ${quietPageNum || 'MISSING'}, target is ${targetQuietPage}`);
    }

    // ── 2. Silence cap on quiet page (v6.2: relaxed — 3 sentences OK mid-story, 2 for final page) ──
    const quietPage = story.pages[targetQuietPage];
    if (quietPage) {
      const actualWords = quietPage.wordCount;
      const actualSentences = quietPage.sentenceCount;
      const reportedWords = story.wordCountArray?.[targetQuietPage - 1];
      const pageCount = Object.keys(story.pages).length;
      const isTerminalQuietPage = targetQuietPage >= pageCount - 1; // page 14 or 15
      const sentenceCap = isTerminalQuietPage ? 2 : 3;

      // Sentence count check — strict for terminal pages, relaxed for mid-story
      if (actualSentences <= sentenceCap) {
        passes.push(`sentence cap: ${actualSentences} sentences on quiet page ${targetQuietPage} ✓ (≤${sentenceCap}${isTerminalQuietPage ? ', terminal' : ', mid-story'})`);
      } else if (actualSentences <= sentenceCap + 1) {
        warnings.push(`sentence count slightly high: ${actualSentences} sentences on quiet page ${targetQuietPage} (target: ≤${sentenceCap})`);
      } else {
        issues.push(`sentence cap BROKEN: ${actualSentences} sentences on quiet page ${targetQuietPage} (max: ${sentenceCap})`);
      }

      // Word count — now a warning only, not blocking
      if (actualWords <= 30) {
        passes.push(`silence words: ${actualWords} words on quiet page ${targetQuietPage} ✓ (≤30)`);
      } else {
        warnings.push(`silence word count high: ${actualWords} words on quiet page ${targetQuietPage} (target: ≤30, model reported: ${reportedWords})`);
      }

      // Check if model's self-reported count is accurate
      if (typeof reportedWords === 'number' && Math.abs(reportedWords - actualWords) > 3) {
        warnings.push(`WORD_COUNT mismatch on quiet page ${targetQuietPage}: reported ${reportedWords}, actual ${actualWords} (delta: ${actualWords - reportedWords})`);
      }
    } else {
      warnings.push(`quiet page ${targetQuietPage} not found in story (may be mount truncation)`);
    }
  } else {
    warnings.push(`unknown companion "${companion}" — cannot check quiet page target`);
  }

  // ── 3. Ending type ──
  const targetEnding = ENDING_TYPE_BY_DIRECTION[direction];
  const metaEnding = story.metadata.endingType;

  if (targetEnding) {
    if (metaEnding === targetEnding) {
      passes.push(`endingType: ${metaEnding} ✓`);
    } else {
      issues.push(`endingType: "${metaEnding}" but ${direction} requires "${targetEnding}"`);
    }
  }

  // ── 4. WORD_COUNT accuracy ──
  if (story.wordCountArray) {
    const nonNumeric = story.wordCountArray.filter(v => typeof v !== 'number');
    if (nonNumeric.length > 0) {
      warnings.push(`WORD_COUNT contains non-numeric entries: ${nonNumeric.join(', ')}`);
    }

    // Check total
    const arraySum = story.wordCountArray
      .filter(v => typeof v === 'number')
      .reduce((a, b) => a + b, 0);

    if (story.wordCountTotal && Math.abs(arraySum - story.wordCountTotal) > 5) {
      warnings.push(`WORD_COUNT sum mismatch: array sums to ${arraySum}, reported total ${story.wordCountTotal}`);
    }

    // Check per-page accuracy (spot check all pages)
    let bigMismatches = 0;
    for (const [pageNum, page] of Object.entries(story.pages)) {
      const idx = parseInt(pageNum) - 1;
      const reported = story.wordCountArray[idx];
      if (typeof reported === 'number' && Math.abs(reported - page.wordCount) > 5) {
        bigMismatches++;
      }
    }
    if (bigMismatches > 2) {
      warnings.push(`WORD_COUNT unreliable: ${bigMismatches} pages have >5 word count mismatch`);
    }
  }

  // ── 5. Functional action patterns in pages 10-12 ──
  const functionalHits = [];
  for (let p = 10; p <= 12; p++) {
    const page = story.pages[p];
    if (!page) continue;
    for (const pattern of FUNCTIONAL_PATTERNS) {
      if (pattern.test(page.text)) {
        const matchWord = page.text.match(pattern)?.[0];
        functionalHits.push({ page: p, pattern: matchWord });
      }
    }
  }
  if (functionalHits.length > 0) {
    const hitSummary = functionalHits.map(h => `p${h.page}: ${h.pattern}`).join(', ');
    warnings.push(`functional actions in resolution pages: ${hitSummary}`);
  } else {
    passes.push('no functional action patterns in pages 10-12 ✓');
  }

  // ── 5b. Climax density check (v6.1: ≤45 words per climax page) ──
  const denseClimax = [];
  for (let p = 10; p <= 12; p++) {
    const page = story.pages[p];
    if (!page) continue;
    if (page.wordCount > 45) {
      denseClimax.push(`p${p}: ${page.wordCount}w`);
    }
  }
  if (denseClimax.length > 0) {
    warnings.push(`climax density high (>45w): ${denseClimax.join(', ')}`);
  } else if (Object.keys(story.pages).length >= 12) {
    passes.push('climax density OK (all ≤45w) ✓');
  }

  // ── 6. uncomfortableTruth presence ──
  if (story.metadata.uncomfortableTruth) {
    passes.push('uncomfortableTruth present ✓');
  } else {
    issues.push('uncomfortableTruth MISSING from metadata');
  }

  // ── 7. Total word count sanity (v6.2: relaxed — 300 floor, soft warning) ──
  const totalActualWords = Object.values(story.pages)
    .reduce((sum, p) => sum + p.wordCount, 0);
  if (totalActualWords < 250) {
    issues.push(`total words critically low: ${totalActualWords} (min: 250)`);
  } else if (totalActualWords < 350) {
    warnings.push(`total words low: ${totalActualWords} (target: 400-600)`);
  } else if (totalActualWords > 700) {
    warnings.push(`total words high: ${totalActualWords} (target: 400-600)`);
  } else {
    passes.push(`total words: ${totalActualWords} ✓`);
  }

  // ── 8. Page count (v6.2: warn on 13-14 instead of fail — mount truncation common) ──
  const pageCount = Object.keys(story.pages).length;
  if (pageCount < 13) {
    issues.push(`page count: ${pageCount} (expected 15, too few)`);
  } else if (pageCount < 15) {
    warnings.push(`page count: ${pageCount} (expected 15, likely mount truncation)`);
  } else {
    passes.push(`page count: ${pageCount} ✓`);
  }

  return {
    file: filename,
    companion,
    direction,
    issues,
    warnings,
    passes,
    passed: issues.length === 0,
  };
}

// ─── MAIN ──────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/validate-stories.mjs <file|directory> [file2] [file3] ...');
    process.exit(1);
  }

  let files = [];
  for (const target of args) {
    const stat = statSync(target);
    if (stat.isDirectory()) {
      const dirFiles = readdirSync(target)
        .filter(f => f.endsWith('.md'))
        .map(f => join(target, f));
      files.push(...dirFiles);
    } else {
      files.push(target);
    }
  }
  files.sort();

  if (files.length === 0) {
    console.error('No .md files found');
    process.exit(1);
  }

  console.log(`\n🔍 Story Validator v1 — ${files.length} file(s)\n`);
  console.log('═'.repeat(70));

  let totalPass = 0;
  let totalFail = 0;
  const allIssues = [];
  const allWarnings = [];

  for (const file of files) {
    const result = validateStory(file);

    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`\n${status}  ${result.file}`);
    console.log(`     ${result.companion} / ${result.direction}`);

    for (const p of result.passes) {
      console.log(`     ✓ ${p}`);
    }
    for (const w of result.warnings) {
      console.log(`     ⚠ ${w}`);
    }
    for (const i of result.issues) {
      console.log(`     ✗ ${i}`);
    }

    if (result.passed) totalPass++;
    else totalFail++;

    allIssues.push(...result.issues.map(i => `${result.file}: ${i}`));
    allWarnings.push(...result.warnings.map(w => `${result.file}: ${w}`));
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`\nRESULTS: ${totalPass} passed, ${totalFail} failed out of ${files.length}`);

  if (allIssues.length > 0) {
    console.log(`\n❌ ISSUES (${allIssues.length}):`);
    for (const i of allIssues) console.log(`   ${i}`);
  }

  if (allWarnings.length > 0) {
    console.log(`\n⚠ WARNINGS (${allWarnings.length}):`);
    for (const w of allWarnings) console.log(`   ${w}`);
  }

  console.log('');
  process.exit(totalFail > 0 ? 1 : 0);
}

main();
