#!/usr/bin/env node
/**
 * fix-stories.mjs — Orchestrator for the story cleanup pipeline.
 *
 * Runs 3 steps in sequence:
 *   1. apply-audit-suggestions: creates story-bank/v3-conservative/
 *      Applies SAFE prose-audit suggestions only:
 *      - SENSORY_OVERLOAD (splits)
 *      - EMOTIONAL_DENSITY (splits)
 *      - OVER_ELABORATION (cuts)
 *      - AWKWARD_STRUCTURE (grammar fixes)
 *      - SOUND_OFF (cadence fixes)
 *      Skips RISKY categories (preserve character voice):
 *      - LITERARY_FAT (subjective)
 *      - UNNATURAL_REGISTER (may flatten unique words)
 *      - OVER_PERSONIFICATION (may remove character voice)
 *      - MISSING_AIR (structural — not desired)
 *
 *   2. detect-artifacts: scans v3-conservative for production blockers
 *      - Editorial leakage ("או לחלופין", "להחליף ב")
 *      - Word/phrase duplications
 *      - Stray markdown, broken placeholders
 *
 *   3. fingerprint-analyzer: ranks stories by AI-prose word density
 *      - Counts core fingerprint words (רטט, עור, לחישה, חום, קור, נשימה, אוויר)
 *      - Plus extended atmosphere words
 *
 * Outputs to:
 *   story-bank/v3-conservative/   (the cleaned stories)
 *   artifacts/                    (blocker detection)
 *   fingerprint/                  (density analysis)
 *
 * Usage:
 *   node scripts/fix-stories.mjs              # full pipeline
 *   node scripts/fix-stories.mjs --skip-apply # if v3-conservative exists, skip step 1
 */

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const SKIP_APPLY = process.argv.includes('--skip-apply');
const CWD = process.cwd();

const SAFE_SKIP_CATEGORIES = [
  'MISSING_AIR',
  'LITERARY_FAT',
  'UNNATURAL_REGISTER',
  'OVER_PERSONIFICATION',
].join(',');

function runStep(name, args) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`▶ ${name}`);
  console.log(`${'═'.repeat(70)}\n`);
  const result = spawnSync('node', args, {
    cwd: CWD,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`\n❌ ${name} FAILED (exit code ${result.status})`);
    process.exit(result.status || 1);
  }
}

console.log(`\n🛠  Story Cleanup Pipeline`);
console.log(`   CWD: ${CWD}`);
console.log(`   Steps: 1) apply selective prose-audit  2) detect artifacts  3) fingerprint`);
console.log(`   Safe skips: ${SAFE_SKIP_CATEGORIES}`);

const startTime = Date.now();

// ─── Step 1: Apply selective prose-audit suggestions ─────────────────
const v3ConservativeDir = join(CWD, 'story-bank', 'v3-conservative');
if (SKIP_APPLY && existsSync(v3ConservativeDir)) {
  console.log(`\n⏭  Skipping apply step (v3-conservative exists, --skip-apply set)`);
} else {
  runStep('STEP 1/3 — Apply selective prose-audit suggestions', [
    'scripts/apply-audit-suggestions.mjs',
    '--input=v3-applied',
    '--audits=audits-prose',
    '--output=v3-conservative',
    `--skip-categories=${SAFE_SKIP_CATEGORIES}`,
    '--force',
  ]);
}

// ─── Step 2: Detect artifacts in v3-conservative ─────────────────────
runStep('STEP 2/3 — Detect production-blocking artifacts', [
  'scripts/detect-artifacts.mjs',
  '--input=v3-conservative',
]);

// ─── Step 3: Fingerprint analysis ────────────────────────────────────
runStep('STEP 3/3 — Fingerprint (AI-prose density) analysis', [
  'scripts/fingerprint-analyzer.mjs',
  '--input=v3-conservative',
]);

// ─── Final Summary ──────────────────────────────────────────────────
const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
console.log(`\n${'═'.repeat(70)}`);
console.log(`✅ Pipeline complete in ${elapsed}s`);
console.log(`${'═'.repeat(70)}\n`);
console.log(`📂 Outputs:`);
console.log(`   story-bank/v3-conservative/   ← 108 cleaned stories`);
console.log(`   artifacts/_summary.md         ← all detected artifacts`);
console.log(`   artifacts/_blockers.md        ← production blockers (focus here)`);
console.log(`   fingerprint/_summary.md       ← top 20 stories by AI-prose density`);
console.log(`   fingerprint/_per-word.csv     ← wide table for filtering`);
console.log(`\n📋 Next actions:`);
console.log(`   1. Read artifacts/_blockers.md — fix or regenerate flagged stories`);
console.log(`   2. Read fingerprint/_summary.md — identify stories with overuse`);
console.log(`   3. Spot-read 3-4 stories from v3-conservative to verify quality`);
console.log(`   4. If approved → promote v3-conservative to v3, commit, push`);
