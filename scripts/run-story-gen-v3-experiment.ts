/**
 * Generator-v3 Sprint A — Story Premise Engine (premises only).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-story-gen-v3-experiment.ts
 *
 * Optional (only after human premise gate):
 *   --spine-after-gate   Generate story-spine + page-beats from selected premise (still no prose)
 *
 * Isolated R&D. No production / bank / customer flow.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { DINI_PREMISE_SPRINT_A } from '../lib/story-gen-v3/experiment-spec';
import { extractAllGoldenPremises } from '../lib/story-gen-v3/golden-premise-extract';
import { runPremiseTournament } from '../lib/story-gen-v3/premise-tournament';
import { buildSprintAReport } from '../lib/story-gen-v3/report';
import type { GoldenPremiseRecord } from '../lib/story-gen-v3/types';

const MODEL_ID = 'gpt-5-chat-latest';

const GOLDEN_META: Array<{
  id: string;
  companionId: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
}> = [
  { id: 'panda_anat_adventure', companionId: 'panda_anat', direction: 'adventure' },
  { id: 'dragon_dini_fantasy', companionId: 'dragon_dini', direction: 'fantasy' },
  { id: 'fox_uri_adventure', companionId: 'fox_uri', direction: 'adventure' },
  { id: 'dragon_dini_bedtime', companionId: 'dragon_dini', direction: 'bedtime' },
  { id: 'octopus_seara_adventure', companionId: 'octopus_seara', direction: 'adventure' },
];

async function main(): Promise<void> {
  const spineAfterGate = process.argv.includes('--spine-after-gate');
  const spec = DINI_PREMISE_SPRINT_A;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'story-gen-v3-runs',
    `${spec.id}-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });

  fs.writeFileSync(path.join(runDir, 'experiment-spec.json'), JSON.stringify(spec, null, 2));

  console.log(`[v3] Sprint A → ${runDir}`);

  const goldenIds = GOLDEN_META.filter((g) => spec.calibrationGoldenIds.includes(g.id));
  const goldenPremises: GoldenPremiseRecord[] = await extractAllGoldenPremises({
    goldenIds,
    modelId: MODEL_ID,
  });
  fs.writeFileSync(
    path.join(runDir, 'golden-premise.json'),
    JSON.stringify(goldenPremises, null, 2)
  );

  console.log('[v3] Step 2–3: generate 12 candidates + tournament...');
  const tournament = await runPremiseTournament({
    spec,
    goldenPremises,
    modelId: MODEL_ID,
  });

  fs.writeFileSync(
    path.join(runDir, 'premise-candidates.json'),
    JSON.stringify(
      tournament.candidates.map((s) => ({
        ...s.candidate,
        _meta: {
          disqualified: s.disqualified,
          hardFails: s.hardFails,
          scores: s.scores,
          weightedTotal: s.weightedTotal,
          judgeNotes: s.judgeNotes,
          criticAttacks: s.criticAttacks,
          diversityCluster: s.diversityCluster,
        },
      })),
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(runDir, 'premise-score-report.json'),
    JSON.stringify(
      {
        weights: {
          hookStrength: '20%',
          comicEngineStrength: '15%',
          physicalPlayPotential: '15%',
          childAgencyPotential: '15%',
          tryFailPotential: '10%',
          payoffReleasePotential: '10%',
          companionSpecificity: '5%',
          visualPageVariety: '5%',
          lowMoralizingRisk: '5%',
          emotionalAlignment: 'threshold ≥6',
        },
        candidates: tournament.candidates,
        topThree: tournament.topThree.map((t) => t.candidate.id),
        selectedId: tournament.selected.id,
        selectionReason: tournament.selectionReason,
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(runDir, 'selected-premise.json'),
    JSON.stringify(
      {
        selected: tournament.selected,
        selectionReason: tournament.selectionReason,
        topThree: tournament.topThree.map((t) => ({
          id: t.candidate.id,
          score: t.weightedTotal,
          disqualified: t.disqualified,
          oneLineHook: t.candidate.oneLineHook,
        })),
      },
      null,
      2
    )
  );

  const report = buildSprintAReport({ spec, runDir, goldenPremises, tournament });
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');

  if (spineAfterGate) {
    console.log('[v3] --spine-after-gate: generating spine + beats (no prose)...');
    const { generateSpineAndBeatsFromPremise } = await import(
      '../lib/story-gen-v3/premise-to-structure'
    );
    await generateSpineAndBeatsFromPremise({
      premise: tournament.selected,
      spec,
      runDir,
      modelId: MODEL_ID,
    });
  } else {
    console.log('[v3] HARD STOP — human read premise gate before spine/beats.');
    console.log('[v3] If gate passes, re-run with --spine-after-gate');
  }

  const passed = tournament.candidates.filter((c) => !c.disqualified).length;
  console.log(
    JSON.stringify(
      {
        runDir,
        goldenCount: goldenPremises.length,
        candidates: tournament.candidates.length,
        passedGate: passed,
        selected: tournament.selected.id,
        selectedHook: tournament.selected.oneLineHook,
        spineGenerated: spineAfterGate,
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
