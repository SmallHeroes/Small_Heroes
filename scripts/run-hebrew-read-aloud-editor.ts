/**
 * HebrewReadAloudEditor v0 runner.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-hebrew-read-aloud-editor.ts \\
 *     --story=outputs/story-gen-v3-runs/.../story.md \\
 *     --mode=diagnose_only|apply_safe_fixes|apply_high_confidence_fixes
 *
 * Flags:
 *   --skip-llm          deterministic + precedents only
 *   --companion=dragon_dini
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import path from 'path';

import { runHebrewReadAloudEditor } from '../lib/story-gen-v3/hebrew-read-aloud-editor';
import type { HebrewReadAloudMode } from '../lib/story-gen-v3/hebrew-read-aloud-types';

const MODES: HebrewReadAloudMode[] = [
  'diagnose_only',
  'apply_safe_fixes',
  'apply_high_confidence_fixes',
];

async function main(): Promise<void> {
  const storyArg = process.argv.find((a) => a.startsWith('--story='))?.split('=')[1];
  if (!storyArg) {
    throw new Error(
      'Usage: run-hebrew-read-aloud-editor.ts --story=<story.md> [--mode=diagnose_only]'
    );
  }

  const modeArg = (process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1] ??
    'diagnose_only') as HebrewReadAloudMode;
  if (!MODES.includes(modeArg)) {
    throw new Error(`Invalid mode: ${modeArg}`);
  }

  const storyPath = path.resolve(storyArg);
  const runDir = path.dirname(storyPath);

  const report = await runHebrewReadAloudEditor({
    storyMarkdownPath: storyPath,
    pageBeatsPath: path.join(runDir, 'page-beats.json'),
    storySpinePath: path.join(runDir, 'story-spine.json'),
    companionId: process.argv.find((a) => a.startsWith('--companion='))?.split('=')[1] ?? 'dragon_dini',
    targetReadAloudAge: '5–8',
    childAgeMin: 5,
    childAgeMax: 8,
    mode: modeArg,
    skipLlm: process.argv.includes('--skip-llm'),
    outputDir: runDir,
    goldenReferenceIds: [
      'panda_anat_adventure',
      'fox_uri_adventure',
      'dragon_dini_fantasy',
    ],
  });

  console.log(`[hebrew-read-aloud] verdict: ${report.verdict}`);
  console.log(`[hebrew-read-aloud] issues: ${report.issues.length}`);
  console.log(`[hebrew-read-aloud] applied: ${report.appliedFixes.length}`);
  console.log(`[hebrew-read-aloud] human decisions: ${report.remainingHumanDecisions.length}`);
  console.log(`[hebrew-read-aloud] → ${runDir}/hebrew-read-aloud-report.md`);
  console.log('[hebrew-read-aloud] HARD STOP — read aloud required.');

  if (report.verdict === 'FAIL' || report.verdict === 'STRUCTURAL_CONCERN') {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
