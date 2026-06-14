#!/usr/bin/env node
/**
 * rename-companions.mjs — Replaces companion names across the entire codebase.
 *
 * What it does:
 *   1. Fixes the owl_chacham_fantasy blocker ("או לחלופין..." LLM leak)
 *   2. For each of 24 renamed companions, replaces ALL occurrences in 108 stories
 *      (regex matches the Hebrew letters regardless of nikud variation)
 *   3. Updates lib/companions.ts (name field)
 *   4. Updates briefs/companion-deep-profiles.mjs (name + nameClean fields)
 *
 * Preserves:
 *   - Companion IDs (e.g., 'octopus_seara' stays — only display names change)
 *   - File names in story-bank (octopus_seara_bedtime.md stays)
 *   - All structural elements (frontmatter, page markers, imageDirection)
 *   - Nikud throughout
 *
 * Input:  story-bank/v3-conservative/
 * Output: story-bank/v3-renamed/
 *
 * Usage:
 *   node scripts/rename-companions.mjs              # dry-run printed, actual write
 *   node scripts/rename-companions.mjs --dry-run    # preview only
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';
import { DEEP_COMPANIONS } from '../briefs/companion-deep-profiles.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const CWD = process.cwd();
const STORY_DIR = join(CWD, 'story-bank', 'v3-conservative');
const OUT_DIR = join(CWD, 'story-bank', 'v3-renamed');
const COMPANIONS_TS = join(CWD, 'lib', 'companions.ts');
const PROFILES_MJS = join(CWD, 'briefs', 'companion-deep-profiles.mjs');

// ─── Nikud stripper (used to derive search letters from nameClean) ───
function stripNikud(s) {
  return s.replace(/[֑-ׇ]/g, '');
}

if (!existsSync(STORY_DIR)) {
  console.error(`❌ Story dir not found: ${STORY_DIR}`);
  process.exit(1);
}
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ─── Rename Map (NEW names only — oldLetters auto-derived from profile) ─
// We auto-discover oldLetters from DEEP_COMPANIONS[id].nameClean (stripping nikud).
// newName: new name with full nikud (replacement in story body).
// newFullDisplay: built from DEEP_COMPANIONS[id].species + new name.
const NEW_NAMES = [
  // ANGER_FRUSTRATION
  { id: 'octopus_seara',    newName: 'זוּזִי' },
  { id: 'bear_cub_gahal',   newName: 'דּוֹבִּי' },
  { id: 'salamander_lahav', newName: 'רוּמִי' },
  // NIGHT_FEAR
  { id: 'owl_chacham',      newName: 'בּוּבּוּ' },
  // TRANSITION
  { id: 'squirrel_navad',   newName: 'נוּטִי' },
  { id: 'turtle_beiti',     newName: 'טוֹלִי' },
  // FOCUS_LEARNING
  { id: 'hawk_had',         newName: 'רוּפִי' },
  { id: 'dolphin_shahkan',  newName: 'דּוּדִי' },
  { id: 'captain_navat',    newName: 'רוֹלִי' },
  // NEW_SIBLING
  { id: 'pelican_kis',      newName: 'פֵּלִי' },
  { id: 'bee_ima',          newName: 'דְּבוֹרִי' },
  // SELF_CONFIDENCE
  { id: 'lion_shaket',      newName: 'ליאו' },
  { id: 'ant_harutza',      newName: 'טִיטִי' },
  // NOISE_FEAR
  { id: 'footstep_giant',   newName: 'בּוּמִי' },
  { id: 'song_whale',       newName: 'לוּלִי' },
  { id: 'mole_sheket',      newName: 'חוֹפִי' },
  // GENERAL_FEARS
  { id: 'bunny_ometz',      newName: 'בּוּנִי' },
  { id: 'mongoose_zariz',   newName: 'זוּמִי' },
  // MEDICAL_PROCEDURE
  { id: 'starfish_kokhavi', newName: 'דּוּרִי' },
  { id: 'seahorse_yam',     newName: 'גְּלִי' },
  { id: 'gecko_rifa',       newName: 'גֵּקִי' },
  // OTHER
  { id: 'puppy_neeman',     newName: 'רוֹקִי' },
  { id: 'parrot_tzivon',    newName: 'תּוּתִי' },
  { id: 'wolf_pup_siyar',   newName: 'לוּלוּ' },
];

// Build full RENAME_MAP by reading actual nameClean from deep profile.
// We do NOT construct a full new display name — we just substitute the OLD
// name letters within whatever string exists in companions.ts / profile.
// This preserves the species/article prefix exactly as it appears.
const RENAME_MAP = NEW_NAMES.map((entry) => {
  const profile = DEEP_COMPANIONS[entry.id];
  if (!profile) {
    console.error(`❌ Profile not found for ${entry.id}`);
    process.exit(1);
  }
  const oldNameWithNikud = profile.nameClean;
  const oldLetters = stripNikud(oldNameWithNikud);
  return {
    id: entry.id,
    oldLetters,                  // unniqudd, for regex matching
    oldNameWithNikud,            // for reference/logging
    newName: entry.newName,      // niqqudd, for replacement
  };
});

const RENAME_BY_ID = new Map(RENAME_MAP.map((r) => [r.id, r]));

// ─── Helpers ─────────────────────────────────────────────────────────
function buildNameRegex(oldLetters) {
  // Build pattern matching letters with optional nikud between them
  // and Hebrew word boundaries (no Hebrew letter before/after)
  const lettersWithNikud = oldLetters
    .split('')
    .map((ch) => `${ch}[֑-ׇ]*`)
    .join('');
  return new RegExp(`(?<![א-ת])${lettersWithNikud}(?![א-ת])`, 'g');
}

function extractCompanionId(filename) {
  // octopus_seara_bedtime.md → octopus_seara
  // bear_cub_gahal_bedtime.md → bear_cub_gahal
  // Strip _bedtime.md / _adventure.md / _fantasy.md
  return filename.replace(/_(bedtime|adventure|fantasy)\.md$/, '');
}

function fixOwlChachamBlocker(text) {
  // Remove the "או לחלופין לפשט את כל המשפט לשפה אחידה" leak
  return text.replace(/\s*או לחלופין לפשט את כל המשפט לשפה אחידה\.?/g, '');
}

// ─── Process one story file ──────────────────────────────────────────
function processStory(filename) {
  const path = join(STORY_DIR, filename);
  const outPath = join(OUT_DIR, filename);
  const original = readFileSync(path, 'utf8');

  const companionId = extractCompanionId(filename);
  const rename = RENAME_BY_ID.get(companionId);

  let text = original;
  let nameReplacements = 0;
  let blockerFixed = 0;

  // Special blocker fix
  if (filename === 'owl_chacham_fantasy.md') {
    const before = text;
    text = fixOwlChachamBlocker(text);
    if (text !== before) blockerFixed = 1;
  }

  // Name replacement
  if (rename) {
    const regex = buildNameRegex(rename.oldLetters);
    const matches = text.match(regex);
    nameReplacements = matches ? matches.length : 0;
    text = text.replace(regex, rename.newName);
  }

  if (!DRY_RUN) {
    writeFileSync(outPath, text, 'utf8');
  }

  return {
    filename,
    companionId,
    renamed: rename ? `${rename.oldLetters} → ${rename.newName}` : 'no_rename',
    replacements: nameReplacements,
    blockerFixed,
  };
}

// ─── Update companions.ts ────────────────────────────────────────────
function updateCompanionsTs() {
  if (!existsSync(COMPANIONS_TS)) {
    console.warn(`⚠ companions.ts not found at ${COMPANIONS_TS}`);
    return { updated: 0, errors: [] };
  }

  let text = readFileSync(COMPANIONS_TS, 'utf8');
  let updatedCount = 0;
  const errors = [];

  // Regex to match the LAST Hebrew word (with optional nikud) at end of string
  // This is the companion's specific name (e.g. "תום" in "הענק תום")
  const LAST_HEBREW_WORD = /[א-ת][א-ת֑-ׇ]*$/u;

  for (const r of RENAME_MAP) {
    const idPattern = new RegExp(
      `(id:\\s*['"]${r.id}['"][\\s\\S]{0,500}?name:\\s*['"])([^'"]+)(['"])`,
      'g'
    );
    const before = text;
    text = text.replace(idPattern, (match, prefix, oldVal, suffix) => {
      // Replace the LAST Hebrew word (the name) with newName
      const newVal = oldVal.replace(LAST_HEBREW_WORD, r.newName);
      if (newVal === oldVal) {
        errors.push(`${r.id}: couldn't find last Hebrew word in "${oldVal}"`);
        return match;
      }
      return prefix + newVal + suffix;
    });
    if (text !== before) updatedCount++;
  }

  if (!DRY_RUN) {
    writeFileSync(COMPANIONS_TS, text, 'utf8');
  }
  return { updated: updatedCount, errors };
}

// ─── Update companion-deep-profiles.mjs ──────────────────────────────
function updateProfilesMjs() {
  if (!existsSync(PROFILES_MJS)) {
    console.warn(`⚠ profiles file not found at ${PROFILES_MJS}`);
    return { updated: 0, errors: [] };
  }

  let text = readFileSync(PROFILES_MJS, 'utf8');
  let updatedNames = 0;
  let updatedNameCleans = 0;
  const errors = [];

  for (const r of RENAME_MAP) {
    const nameRegex = buildNameRegex(r.oldLetters);
    const blockStartRe = new RegExp(`(^|\\n)\\s*${r.id}:\\s*\\{`, 'g');
    const blockMatch = blockStartRe.exec(text);
    if (!blockMatch) {
      errors.push(`${r.id}: block not found in profiles`);
      continue;
    }
    const blockStart = blockMatch.index;
    const afterStart = text.slice(blockStart);
    const blockEndRel = afterStart.search(/\n  \},/);
    const blockEnd = blockEndRel === -1 ? blockStart + 3000 : blockStart + blockEndRel + 4;
    let block = text.slice(blockStart, blockEnd);

    // Update `name: '...'` — sub-replace within string
    const nameRe = /name:\s*['"]([^'"]+)['"]/;
    const nameMatch = block.match(nameRe);
    if (nameMatch) {
      const newNameField = nameMatch[1].replace(nameRegex, r.newName);
      if (newNameField !== nameMatch[1]) {
        block = block.replace(nameRe, `name: '${newNameField}'`);
        updatedNames++;
      }
    }

    // Update `nameClean: '...'` — full replace (single name only)
    const nameCleanRe = /nameClean:\s*['"]([^'"]+)['"]/;
    const cleanMatch = block.match(nameCleanRe);
    if (cleanMatch && cleanMatch[1] !== r.newName) {
      block = block.replace(nameCleanRe, `nameClean: '${r.newName}'`);
      updatedNameCleans++;
    }

    text = text.slice(0, blockStart) + block + text.slice(blockEnd);
  }

  if (!DRY_RUN) {
    writeFileSync(PROFILES_MJS, text, 'utf8');
  }
  return { updatedNames, updatedNameCleans, errors };
}

// ─── Main ────────────────────────────────────────────────────────────
function main() {
  console.log(`\n🔄 Companion Rename Pipeline ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`   Source:  ${STORY_DIR}`);
  console.log(`   Target:  ${OUT_DIR}`);
  console.log(`   Renames: ${RENAME_MAP.length}\n`);

  // ─── Process stories ─────────────────────────────────────────────
  const files = readdirSync(STORY_DIR)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !f.endsWith('_prompt.md'))
    .filter((f) => !f.endsWith('_DEEP_PROFILE.md'))
    .filter((f) => !f.startsWith('_'))
    .sort();

  let totalReplacements = 0;
  let totalBlockersFixed = 0;
  const byCompanion = {};

  for (const file of files) {
    const r = processStory(file);
    totalReplacements += r.replacements;
    totalBlockersFixed += r.blockerFixed;
    if (!byCompanion[r.companionId]) {
      byCompanion[r.companionId] = { renamed: r.renamed, count: 0, files: [] };
    }
    byCompanion[r.companionId].count += r.replacements;
    byCompanion[r.companionId].files.push({ file, replacements: r.replacements, blocker: r.blockerFixed });
  }

  // Print per-companion summary
  console.log(`📝 Per-companion replacements in story bodies:\n`);
  for (const id of Object.keys(byCompanion).sort()) {
    const c = byCompanion[id];
    if (c.count > 0 || c.renamed.includes('→')) {
      console.log(`   ${id.padEnd(22)} ${c.renamed.padEnd(20)} = ${c.count} total replacements`);
    }
  }

  // ─── Update companions.ts ────────────────────────────────────────
  console.log(`\n📂 Updating lib/companions.ts...`);
  const ts = updateCompanionsTs();
  console.log(`   Updated entries: ${ts.updated}`);
  if (ts.errors.length > 0) {
    console.log(`   ⚠ Warnings:`);
    ts.errors.forEach((e) => console.log(`     - ${e}`));
  }

  // ─── Update profiles ─────────────────────────────────────────────
  console.log(`\n📂 Updating briefs/companion-deep-profiles.mjs...`);
  const pr = updateProfilesMjs();
  console.log(`   Updated 'name':      ${pr.updatedNames}`);
  console.log(`   Updated 'nameClean': ${pr.updatedNameCleans}`);
  if (pr.errors.length > 0) {
    console.log(`   ⚠ Warnings:`);
    pr.errors.forEach((e) => console.log(`     - ${e}`));
  }

  // ─── Write summary report ────────────────────────────────────────
  const reportPath = join(OUT_DIR, '_rename-report.md');
  let report = `# Companion Rename Report — ${new Date().toISOString().split('T')[0]}\n\n`;
  report += `**Dry run**: ${DRY_RUN ? 'YES (no files written)' : 'NO'}\n`;
  report += `**Total story files**: ${files.length}\n`;
  report += `**Total name replacements in stories**: ${totalReplacements}\n`;
  report += `**Blockers fixed**: ${totalBlockersFixed}\n`;
  report += `**companions.ts updates**: ${ts.updated}\n`;
  report += `**profiles 'name' updates**: ${pr.updatedNames}\n`;
  report += `**profiles 'nameClean' updates**: ${pr.updatedNameCleans}\n\n`;

  report += `## Rename Map Applied\n\n| ID | Old | New | Replacements in stories |\n|---|---|---|---|\n`;
  for (const r of RENAME_MAP) {
    const count = byCompanion[r.id]?.count ?? 0;
    report += `| ${r.id} | ${r.oldLetters} | ${r.newName} | ${count} |\n`;
  }

  if (!DRY_RUN) writeFileSync(reportPath, report, 'utf8');

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ Done`);
  console.log(`   Story name replacements: ${totalReplacements}`);
  console.log(`   Blockers fixed:          ${totalBlockersFixed}`);
  console.log(`   companions.ts updated:   ${ts.updated}`);
  console.log(`   profiles updated:        names=${pr.updatedNames}, nameClean=${pr.updatedNameCleans}`);
  if (!DRY_RUN) console.log(`   Report: ${reportPath}`);
  console.log(`${'═'.repeat(60)}\n`);
}

main();
