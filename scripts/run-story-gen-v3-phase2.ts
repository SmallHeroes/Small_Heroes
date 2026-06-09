/**
 * Generator-v3 Sprint A Phase 2 — hardened p10 → StorySpineV3 + PageBeatV3 only.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-story-gen-v3-phase2.ts
 *
 * Optional: --source=<sprint-a-run-dir>
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { DINI_PREMISE_SPRINT_A } from '../lib/story-gen-v3/experiment-spec';
import { buildHardenedPremiseP10, HARDENED_P10_ID } from '../lib/story-gen-v3/hardened-premise-p10';
import { buildPhase2Report } from '../lib/story-gen-v3/phase2-report';
import { runPhase2SpineAndBeats } from '../lib/story-gen-v3/spine-beats-gen';

const DEFAULT_SOURCE = path.join(
  process.cwd(),
  'outputs/story-gen-v3-runs/dini_premise_sprint_a-2026-06-09T09-05-12-990Z'
);

const MODEL_ID = 'gpt-5-chat-latest';

async function main(): Promise<void> {
  const sourceArg = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1];
  const sourceDir = sourceArg ? path.resolve(sourceArg) : DEFAULT_SOURCE;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'story-gen-v3-runs',
    `dini_premise_sprint_a-phase2-p10-${timestamp}`
  );

  const premise = buildHardenedPremiseP10();
  if (premise.id !== HARDENED_P10_ID) {
    throw new Error('Expected hardened dini_premise_10');
  }

  console.log(`[v3 phase2] hardened premise: ${premise.id}`);
  console.log(`[v3 phase2] source run: ${sourceDir}`);
  console.log(`[v3 phase2] output → ${runDir}`);

  const { spine, beats, spineHardFails, beatHardFails } = await runPhase2SpineAndBeats({
    premise,
    spec: DINI_PREMISE_SPRINT_A,
    runDir,
    modelId: MODEL_ID,
    pageCount: 12,
    sourceRunDir: fs.existsSync(sourceDir) ? sourceDir : undefined,
  });

  const report = buildPhase2Report({
    runDir,
    premiseId: premise.id,
    spine,
    beats,
    spineHardFails,
    beatHardFails,
  });
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');

  fs.writeFileSync(
    path.join(runDir, 'experiment-spec.json'),
    JSON.stringify({ ...DINI_PREMISE_SPRINT_A, phase: '2', premiseId: HARDENED_P10_ID }, null, 2)
  );

  console.log('[v3 phase2] HARD STOP — human read spine/beats. No prose.');
  console.log(
    JSON.stringify(
      {
        runDir,
        pages: beats.length,
        spineHardFails: spineHardFails.length,
        beatHardFails: beatHardFails.length,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
