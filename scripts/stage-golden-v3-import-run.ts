/**
 * Stage a golden/v5 source into outputs/story-pipeline-import-runs/<run-id>/ for
 * scripts/import-v3-approved-story.ts. STAGING ONLY — never writes story-bank/v3-approved/.
 *
 * Guy must hand-write approval.json in the run dir before import:
 *   { "approvedBy": "Guy", "approvedAt": "<ISO>", "note": "optional" }
 *
 * Usage:
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/stage-golden-v3-import-run.ts \
 *     --source=story-bank/v5-fixed-v2/fox_uri_bedtime.md
 *
 *   npx tsx ... scripts/stage-golden-v3-import-run.ts --phase1
 *
 * Then (after approval.json exists):
 *   npx tsx ... scripts/import-v3-approved-story.ts --run=outputs/story-pipeline-import-runs/<run-id>
 */
import path from 'path';

import { stageGoldenImportRun } from '../lib/story-bank-v3-import';

const ROOT = process.cwd();
const RUNS_ROOT = path.join(ROOT, 'outputs', 'story-pipeline-import-runs');

const PHASE1_SOURCES: Record<
  string,
  { source: string; personalizationGate?: 'strict' | 'warn' }
> = {
  fox_uri_bedtime: { source: 'story-bank/v5-fixed-v2/fox_uri_bedtime.md' },
  lion_shaket_adventure: { source: 'story-bank/v5-fixed-v2/lion_shaket_adventure.md' },
  chameleon_koko_adventure: {
    source: 'story-bank/calibration-sources/chameleon_koko_adventure.md',
    personalizationGate: 'warn',
  },
  bunny_ometz_adventure: { source: 'story-bank/v5-fixed-v2/bunny_ometz_adventure.md' },
  dragon_dini_fantasy: { source: 'story-bank/v5-fixed-v2/dragon_dini_fantasy.md' },
  panda_anat_adventure: { source: 'story-bank/v5-fixed-v2/panda_anat_adventure.md' },
};

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

function fail(msg: string): never {
  console.error(`[stage-v3-import] FAIL: ${msg}`);
  process.exit(2);
}

function stageOne(
  sourceRel: string,
  runIdOverride?: string,
  personalizationGate: 'strict' | 'warn' = 'strict',
): void {
  try {
    const result = stageGoldenImportRun({
      repoRoot: ROOT,
      runsRoot: RUNS_ROOT,
      sourceRel,
      runIdOverride,
      personalizationGate,
    });
    if (result.validation.personalizationWarnings.length) {
      console.warn(
        `[stage-v3-import] personalization gate WARN (${result.validation.personalizationWarnings.length}):`
      );
      for (const w of result.validation.personalizationWarnings) console.warn(`  - ${w}`);
    }
    console.log(
      `[stage-v3-import] staged → ${result.relRunDir} (${result.validation.pageCount} pages)`
    );
    console.log(`[stage-v3-import] NEXT: Guy writes ${result.relRunDir}/approval.json, then:`);
    console.log(
      `  npx tsx --require ./scripts/shims/register-server-only.cjs scripts/import-v3-approved-story.ts --run=${result.relRunDir}`
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function main(): void {
  if (process.argv.includes('--phase1')) {
    for (const [base, spec] of Object.entries(PHASE1_SOURCES)) {
      console.log(`\n[stage-v3-import] --- ${base} ---`);
      stageOne(spec.source, undefined, spec.personalizationGate ?? 'strict');
    }
    return;
  }

  const sourceRel = arg('source');
  if (!sourceRel) {
    fail('--source=<repo-relative.md> is required (or use --phase1 for the 6 MVP promotes)');
  }
  const runId = arg('run-id');
  const gateArg = arg('personalization-gate');
  const personalizationGate = gateArg === 'warn' ? 'warn' : 'strict';
  stageOne(sourceRel, runId, personalizationGate);
}

main();
