#!/usr/bin/env node
/**
 * add-companion-letter.mjs — Post-process: add companionLetter frontmatter to v3 stories.
 *
 * For each story file in story-bank/v3/:
 *   1. Skip _prompt.md and _DEEP_PROFILE.md files
 *   2. Skip if already has companionLetter (idempotent — safe to re-run)
 *   3. Extract pages: N from frontmatter
 *   4. Compute insertAfterPage = N - 1 (letter sits before the closing page)
 *   5. Build imageDirection per direction (bedtime/adventure/fantasy)
 *   6. Insert companionLetter block right after pages: line in frontmatter
 *
 * The story-bank-loader picks up the new frontmatter at runtime and calls
 * generateCompanionLetter() to produce the personalized letter page.
 *
 * Cost: $0 — pure local file manipulation, no API calls.
 *
 * Usage:
 *   node scripts/add-companion-letter.mjs           # write changes
 *   node scripts/add-companion-letter.mjs --dry-run # preview without writing
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { DEEP_COMPANIONS } from '../briefs/companion-deep-profiles.mjs';

const STORY_DIR = join(process.cwd(), 'story-bank', 'v3');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Image Direction Templates per Direction ─────────────────────────
// Each template gets the English name of the companion (e.g. "owl chacham")
// and emits a close_shot intimate scene appropriate to the direction's mood.
const IMG_TEMPLATES = {
  bedtime: (en) =>
    `close_shot: ${en} in calm intimate pose beside child in bed, soft warm bedside lamp glow, peaceful nighttime composition, focus on companion's quiet face and gentle expression, blanket softly visible`,
  adventure: (en) =>
    `close_shot: ${en} at rest after the journey, soft late-afternoon light, gentle expression, slight visible trace of the day on the body (loose feather, ruffled fur, leaf), intimate framing, contemplative mood`,
  fantasy: (en) =>
    `close_shot: ${en} in contemplative pose, faint trace of the surreal world-rule still visible in the background, cool soft light, intimate framing, companion looking at child with quiet recognition`,
};

// ─── Process a single file ───────────────────────────────────────────
function processFile(filename) {
  const filepath = join(STORY_DIR, filename);
  let content;
  try {
    content = readFileSync(filepath, 'utf8');
  } catch (err) {
    return { filename, status: 'read_error', error: err.message };
  }

  // Idempotency check
  if (/companionLetter\s*:/.test(content)) {
    return { filename, status: 'already_has_letter' };
  }

  // Extract companion + direction from filename
  const match = filename.match(/^(.+)_(bedtime|adventure|fantasy)\.md$/);
  if (!match) {
    return { filename, status: 'invalid_filename' };
  }
  const [, companionId, direction] = match;

  // Find pages: N line in frontmatter
  const pagesLineRegex = /^pages:\s*(\d+)\s*$/m;
  const pagesMatch = content.match(pagesLineRegex);
  if (!pagesMatch) {
    return { filename, status: 'no_pages_field' };
  }
  const pages = parseInt(pagesMatch[1], 10);
  if (!Number.isFinite(pages) || pages < 2) {
    return { filename, status: 'invalid_pages_value', value: pagesMatch[1] };
  }
  const insertAfterPage = pages - 1; // letter sits before the final page

  // Look up companion in deep profiles
  const companion = DEEP_COMPANIONS[companionId];
  if (!companion) {
    return { filename, status: 'unknown_companion', companionId };
  }

  // Build English name for image prompt:
  //   octopus_seara → "octopus seara"
  //   bear_cub_gahal → "bear cub gahal"
  //   owl_chacham → "owl chacham"
  const englishName = companionId.replace(/_/g, ' ');
  const rawImg = IMG_TEMPLATES[direction](englishName);
  const imageDirection = rawImg.replace(/"/g, '\\"');

  // Build the YAML block
  const letterBlock =
    `companionLetter:\n` +
    `  insertAfterPage: ${insertAfterPage}\n` +
    `  imageDirection: "${imageDirection}"`;

  // Insert immediately after the `pages: N` line
  const newContent = content.replace(
    pagesLineRegex,
    (m) => `${m}\n${letterBlock}`
  );

  if (newContent === content) {
    return { filename, status: 'no_change_after_replace' };
  }

  if (!DRY_RUN) {
    try {
      writeFileSync(filepath, newContent, 'utf8');
    } catch (err) {
      return { filename, status: 'write_error', error: err.message };
    }
  }

  return {
    filename,
    status: DRY_RUN ? 'would_update' : 'updated',
    direction,
    pages,
    insertAfterPage,
    companionId,
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
    `📚 Processing ${files.length} story files${DRY_RUN ? ' (DRY RUN — no writes)' : ''}\n`
  );

  const updated = [];
  const skipped = [];
  const errors = [];

  for (const file of files) {
    const result = processFile(file);
    if (result.status === 'updated' || result.status === 'would_update') {
      updated.push(result);
      console.log(
        `✅ ${file} → insertAfterPage: ${result.insertAfterPage} (${result.direction})`
      );
    } else if (result.status === 'already_has_letter') {
      skipped.push(result);
      console.log(`⏭️  ${file} (already has letter)`);
    } else {
      errors.push(result);
      console.log(`❌ ${file}: ${result.status}${result.error ? ' — ' + result.error : ''}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ${DRY_RUN ? 'Would update' : 'Updated'}: ${updated.length}`);
  console.log(`   Skipped (already done): ${skipped.length}`);
  console.log(`   Errors: ${errors.length}`);

  // Coverage breakdown by direction
  const byDir = { bedtime: 0, adventure: 0, fantasy: 0 };
  for (const u of updated) byDir[u.direction] = (byDir[u.direction] || 0) + 1;
  console.log(`\n   By direction (this run):`);
  console.log(`     bedtime:   ${byDir.bedtime}`);
  console.log(`     adventure: ${byDir.adventure}`);
  console.log(`     fantasy:   ${byDir.fantasy}`);

  if (errors.length > 0) {
    console.log(`\n❌ Error details:`);
    errors.forEach((e) =>
      console.log(`   ${e.filename}: ${e.status}${e.error ? ' — ' + e.error : ''}`)
    );
    process.exit(1);
  }

  console.log('\n🏁 Done.');
}

main();
