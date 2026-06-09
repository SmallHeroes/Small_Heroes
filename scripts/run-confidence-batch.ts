/**
 * Generator-v3 Confidence Batch — 3 stories (lion / bunny / turtle)
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-confidence-batch.ts --story=all --stop=1
 *   npx tsx ... scripts/run-confidence-batch.ts --story=lion --stop=1
 *   npx tsx ... scripts/run-confidence-batch.ts --story=bunny --stop=2 --source=<stop1-run-dir>
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import {
  CONFIDENCE_BATCH_SPECS,
  pageCountForSpec,
  LION_SHAKET_ANGER,
  BUNNY_OMETZ_MEDICAL,
  TURTLE_BEITI_HOMESICK,
} from '../lib/story-gen-v3/confidence-batch-specs';
import {
  analyzeBatchFamilyDiversity,
  buildStop1StoryReport,
  renderReskinControlQuestion,
} from '../lib/story-gen-v3/confidence-batch-stop1';
import { extractAllGoldenPremises } from '../lib/story-gen-v3/golden-premise-extract';
import { runLongFormDriftGate } from '../lib/story-gen-v3/long-form-drift-gate';
import { runMomentumGateBeforeProse } from '../lib/story-gen-v3/momentum-gate';
import { runPremiseTournament } from '../lib/story-gen-v3/premise-tournament';
import { normalizePartialGenderChips } from '../lib/story-gen/chip-normalize';
import { applyTtsAmbiguityNiqqudPass } from '../lib/story-gen-v2/tts-ambiguity-niqqud';
import { applyV3ChipArtifactFixes } from '../lib/story-gen-v3/chip-artifact-fix';
import { rerunStop3Gates } from '../lib/story-gen-v3/stop3-gates';
import { generateProseV3 } from '../lib/story-gen-v3/prose-gen-v3';
import { runPhase2SpineAndBeats } from '../lib/story-gen-v3/spine-beats-gen';
import type {
  GoldenPremiseRecord,
  PageBeatV3,
  PremiseExperimentSpecV3,
  StoryPremiseCandidate,
  StorySpineV3,
} from '../lib/story-gen-v3/types';

const MODEL_ID = 'gpt-5-chat-latest';

const STORY_ALIASES: Record<string, PremiseExperimentSpecV3> = {
  lion: LION_SHAKET_ANGER,
  bunny: BUNNY_OMETZ_MEDICAL,
  turtle: TURTLE_BEITI_HOMESICK,
};

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

function parseStory(): PremiseExperimentSpecV3[] {
  const arg = process.argv.find((a) => a.startsWith('--story='))?.split('=')[1] ?? 'all';
  if (arg === 'all') return CONFIDENCE_BATCH_SPECS;
  const spec = STORY_ALIASES[arg];
  if (!spec) throw new Error(`Unknown --story=${arg}; use lion|bunny|turtle|all`);
  return [spec];
}

function parseStop(): 1 | 2 | 3 {
  const arg = process.argv.find((a) => a.startsWith('--stop='))?.split('=')[1];
  const n = arg ? Number(arg) : 1;
  if (n === 2 || n === 3) return n;
  return 1;
}

function goldenMetaForSpec(spec: PremiseExperimentSpecV3): Array<{
  id: string;
  companionId: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
}> {
  const COMPANION_FROM_ID: Record<string, string> = {
    lion_shaket: 'lion_shaket',
    bunny_ometz: 'bunny_ometz',
    turtle_beiti: 'turtle_beiti',
    chameleon_koko: 'chameleon_koko',
    dragon_dini: 'dragon_dini',
    panda_anat: 'panda_anat',
    fox_uri: 'fox_uri',
  };

  return spec.calibrationGoldenIds.map((id) => {
    const prefix = id.replace(/_(bedtime|adventure|fantasy)$/, '');
    const companionId = COMPANION_FROM_ID[prefix] ?? prefix;
    const direction = id.includes('_bedtime')
      ? 'bedtime'
      : id.includes('_fantasy')
        ? 'fantasy'
        : 'adventure';
    return { id, companionId, direction };
  });
}

async function runStop1ForSpec(spec: PremiseExperimentSpecV3, batchDir: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'story-gen-v3-runs',
    `${spec.id}-stop1-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'experiment-spec.json'), JSON.stringify(spec, null, 2));

  const goldenIds = goldenMetaForSpec(spec);
  const goldenPremises: GoldenPremiseRecord[] = await extractAllGoldenPremises({
    goldenIds,
    modelId: MODEL_ID,
  });
  fs.writeFileSync(path.join(runDir, 'golden-premise.json'), JSON.stringify(goldenPremises, null, 2));

  console.log(`[confidence] STOP 1 — ${spec.companionId} / ${spec.category}...`);
  const tournament = await runPremiseTournament({ spec, goldenPremises, modelId: MODEL_ID });

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
          premiseFamily: s.candidate.premiseFamily,
        },
      })),
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(runDir, 'auto-selected-premise.json'),
    JSON.stringify({ autoSelected: tournament.selected }, null, 2)
  );

  const pageCount = pageCountForSpec(spec);
  const stop1Report = buildStop1StoryReport({
    spec,
    pageCount,
    candidates: tournament.candidates,
    selected: tournament.selected,
  });

  fs.writeFileSync(path.join(runDir, 'stop1-confidence-report.json'), JSON.stringify(stop1Report, null, 2));

  const report = `# Confidence Batch STOP 1 — ${spec.companionId}

## Spec
- companion: ${spec.companionId}
- category: ${spec.category}
- direction: ${spec.direction}
- pages (locked): ${pageCount}

## Auto-selected premise (engine)
- **${tournament.selected.id}**: ${tournament.selected.titleSeed}
- premiseFamily: ${tournament.selected.premiseFamily ?? 'unset'}
- hook: ${tournament.selected.oneLineHook}

## autoPremiseAutonomy
**${stop1Report.autoPremiseAutonomy}**
${stop1Report.autonomyReasons.length ? `- reasons: ${stop1Report.autonomyReasons.join(', ')}` : ''}

## Premise family diversity (within story)
- familyDiversityCount: ${stop1Report.familyDiversityCount}
- top3Families: ${stop1Report.top3Families.join(', ') || 'n/a'}
- diversity: ${stop1Report.diversity.summary}

## Top 3 tournament
${tournament.topThree
  .map(
    (t) =>
      `### ${t.candidate.id} (${t.weightedTotal})\n- family: ${t.candidate.premiseFamily}\n- hook: ${t.candidate.oneLineHook}`
  )
  .join('\n\n')}

## Reskin control (for STOP 2)
> ${renderReskinControlQuestion(spec)}

## Human action
Read candidates + auto-selected premise. If autoPremiseAutonomy is WOULD_FAIL or CONTAMINATED, hand-harden before STOP 2.
Record hand-hardened premise as \`hardened-premise.json\` when continuing.

## STOP 1 verdict
${stop1Report.diversity.passStop1 ? '**PASS** — human read before hardening/STOP 2' : '**FAIL/RISK** — repair premise pool'}

Run dir: \`${runDir}\`
`;
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');

  fs.writeFileSync(
    path.join(batchDir, `${spec.companionId}-stop1-path.json`),
    JSON.stringify({ runDir, specId: spec.id }, null, 2)
  );

  console.log(`[confidence] ${spec.companionId} autoPremiseAutonomy: ${stop1Report.autoPremiseAutonomy}`);
  console.log(`[confidence] STOP 1 → ${runDir}`);

  if (!stop1Report.diversity.passStop1) process.exitCode = 2;
  return runDir;
}

async function runStop2ForSpec(
  spec: PremiseExperimentSpecV3,
  sourceDir: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'story-gen-v3-runs',
    `${spec.id}-stop2-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'experiment-spec.json'), JSON.stringify(spec, null, 2));
  fs.writeFileSync(path.join(runDir, 'source-stop1.json'), JSON.stringify({ stop1Dir: sourceDir }, null, 2));

  const premisePath = path.join(runDir, 'hardened-premise.json');
  const hardenedSrc = path.join(sourceDir, 'hardened-premise.json');
  let premise: StoryPremiseCandidate;
  if (fs.existsSync(hardenedSrc)) {
    fs.copyFileSync(hardenedSrc, premisePath);
    premise = JSON.parse(fs.readFileSync(premisePath, 'utf8')) as StoryPremiseCandidate;
  } else {
    premise = JSON.parse(
      fs.readFileSync(path.join(sourceDir, 'auto-selected-premise.json'), 'utf8')
    ).autoSelected as StoryPremiseCandidate;
    fs.writeFileSync(premisePath, JSON.stringify(premise, null, 2));
  }

  const pageCount = pageCountForSpec(spec);
  console.log(`[confidence] STOP 2 — ${spec.companionId} (${pageCount} pages)...`);

  const { spine, beats, spineHardFails, beatHardFails } = await runPhase2SpineAndBeats({
    premise,
    spec,
    runDir,
    modelId: MODEL_ID,
    pageCount,
  });

  const momentum = runMomentumGateBeforeProse({ spine, beats, premise });
  fs.writeFileSync(
    path.join(runDir, 'momentum-report-before-prose.json'),
    JSON.stringify(momentum, null, 2)
  );

  let longFormBlock = '';
  if (pageCount >= 20) {
    const drift = runLongFormDriftGate(beats);
    fs.writeFileSync(path.join(runDir, 'long-form-drift-report.json'), JSON.stringify(drift, null, 2));
    longFormBlock = `
## Long-form drift (20-page)
- longFormDriftCheck: ${drift.longFormDriftCheck}
- midStoryTurnPage: ${drift.midStoryTurnPage ?? 'none'}
- repeatedBeatRuns: ${drift.repeatedBeatRuns.length ? JSON.stringify(drift.repeatedBeatRuns) : 'none'}
`;
  }

  const report = `# Confidence Batch STOP 2 — ${spec.companionId}

## Premise
${premise.id}: ${premise.titleSeed}

## Reskin control question
> ${renderReskinControlQuestion(spec)}
Answer in human read: same arc with different props? If yes → repair beats.

## Structure
- spine hard fails: ${spineHardFails.length}
- beat hard fails: ${beatHardFails.length}
- momentum: ${momentum.pass ? 'PASS' : 'FAIL'}
${longFormBlock}

Run dir: \`${runDir}\`
`;
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');
  console.log(`[confidence] STOP 2 → ${runDir}`);

  if (!momentum.pass || spineHardFails.length || beatHardFails.length) process.exitCode = 2;
  return runDir;
}

async function writeBatchStop1Summary(batchDir: string, specs: PremiseExperimentSpecV3[]): Promise<void> {
  const reports = specs.map((spec) => {
    const pathFile = path.join(batchDir, `${spec.companionId}-stop1-path.json`);
    const { runDir } = JSON.parse(fs.readFileSync(pathFile, 'utf8')) as { runDir: string };
    return JSON.parse(
      fs.readFileSync(path.join(runDir, 'stop1-confidence-report.json'), 'utf8')
    );
  });

  const batchDiv = analyzeBatchFamilyDiversity(reports);
  const autonomySummary = reports.map(
    (r: { companionId: string; autoPremiseAutonomy: string }) =>
      `${r.companionId}: ${r.autoPremiseAutonomy}`
  );

  const summary = {
    batchReskinRisk: batchDiv.batchReskinRisk,
    familyDiversityCount: batchDiv.familyDiversityCount,
    top3Families: batchDiv.top3Families,
    selectedFamilies: batchDiv.selectedFamilies,
    premiseAutonomySignal: autonomySummary,
    passBatchFamilyDiversity: batchDiv.pass,
  };

  fs.writeFileSync(path.join(batchDir, 'batch-stop1-summary.json'), JSON.stringify(summary, null, 2));

  const md = `# Confidence Batch STOP 1 — Summary

## Batch family diversity
- familyDiversityCount: ${batchDiv.familyDiversityCount}
- top3Families: ${batchDiv.top3Families.join(', ')}
- batchReskinRisk: ${batchDiv.batchReskinRisk}
- selected premise families: ${batchDiv.selectedFamilies.join(', ')}
- pass (3 distinct families): ${batchDiv.pass ? 'YES' : 'NO'}

## premiseAutonomySignal
${autonomySummary.map((s) => `- ${s}`).join('\n')}

## Human HARD STOP
Guy reads all 3 STOP 1 reports. Hand-harden premises where autoPremiseAutonomy ≠ PASS.

Batch dir: \`${batchDir}\`
`;
  fs.writeFileSync(path.join(batchDir, 'batch-stop1-report.md'), md, 'utf8');
  console.log('[confidence] batch STOP 1 summary written');
}

async function runStop3ForSpec(spec: PremiseExperimentSpecV3, sourceDir: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'story-gen-v3-runs',
    `${spec.id}-stop3-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });

  for (const f of ['story-spine.json', 'page-beats.json', 'hardened-premise.json', 'experiment-spec.json']) {
    fs.copyFileSync(path.join(sourceDir, f), path.join(runDir, f));
  }
  fs.writeFileSync(path.join(runDir, 'source-stop2.json'), JSON.stringify({ stop2Dir: sourceDir }, null, 2));

  const spine = readJson<StorySpineV3>(path.join(runDir, 'story-spine.json'));
  const beats = readJson<PageBeatV3[]>(path.join(runDir, 'page-beats.json'));
  const premise = readJson<StoryPremiseCandidate>(path.join(runDir, 'hardened-premise.json'));
  const pageCount = pageCountForSpec(spec);

  console.log(`[confidence] STOP 3 — ${spec.companionId} (${pageCount} pages)...`);
  const generatedAt = new Date().toISOString();

  const { storyMarkdown: rawMd, inputTokens, outputTokens } = await generateProseV3({
    spec,
    spine,
    beats,
    premise,
    modelId: MODEL_ID,
    generatedAt,
  });

  let md = applyV3ChipArtifactFixes(rawMd).markdown;
  const chipNorm = normalizePartialGenderChips(md);
  md = chipNorm.markdown.replace(/\r?\nWORD_COUNT:[\s\S]*$/i, '').trim();
  md = applyV3ChipArtifactFixes(md).markdown;
  const { markdown: withNiqqud, applied: ttsApplied } = applyTtsAmbiguityNiqqudPass(md);
  md = withNiqqud;

  fs.writeFileSync(path.join(runDir, 'story.md'), md, 'utf8');
  if (ttsApplied.length) {
    fs.writeFileSync(
      path.join(runDir, 'tts-niqqud-applied.json'),
      JSON.stringify({ applied: ttsApplied }, null, 2)
    );
  }

  const gateResult = await rerunStop3Gates({
    runDir,
    spec,
    premise,
    beats,
  });

  const report = `# Confidence Batch STOP 3 — ${spec.companionId}

## ⚠️ NOT human-approved
Automated gates only. Guy/ChatGPT/Claude must read prose aloud before any PASS label.

## Tokens
in: ${inputTokens} / out: ${outputTokens}

## Gates (automated)
- StoryAlive: ${gateResult.storyAliveVerdict}
- HebrewReadAloud: ${gateResult.hebrewVerdict}
- read-back: ${gateResult.readBackPass ? 'PASS' : 'FAIL'}
- medicalRisks: ${gateResult.medicalRisks}
- bodyPartLeaks: ${gateResult.bodyPartLeaks}
- gatePassAutomated: ${gateResult.gatePassAutomated}

Run dir: \`${runDir}\`
`;
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');

  console.log(`[confidence] StoryAlive: ${gateResult.storyAliveVerdict}`);
  console.log(`[confidence] Hebrew: ${gateResult.hebrewVerdict}`);
  console.log(`[confidence] gatePassAutomated: ${gateResult.gatePassAutomated}`);
  console.log('[confidence] humanAloudReadRequired: true — NOT human-approved');
  console.log(`[confidence] STOP 3 → ${runDir}`);

  if (!gateResult.gatePassAutomated) process.exitCode = 2;
  return runDir;
}

async function main(): Promise<void> {
  const specs = parseStory();
  const stop = parseStop();
  const sourceArg = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1];

  if (stop === 3) {
    const storyArg = process.argv.find((a) => a.startsWith('--story='))?.split('=')[1] ?? 'all';
    if (storyArg === 'all') {
      throw new Error('STOP 3 blocked for --story=all. Run one story at a time (bunny only for now).');
    }
    if (specs.length !== 1) {
      throw new Error('STOP 3 requires exactly one --story=lion|bunny|turtle');
    }
    const spec = specs[0]!;
    const sourceDir = sourceArg
      ? path.resolve(sourceArg)
      : (() => {
          const runsRoot = path.join(process.cwd(), 'outputs', 'story-gen-v3-runs');
          const dirs = fs
            .readdirSync(runsRoot)
            .filter((d) => d.startsWith(spec.id + '-stop2'))
            .sort()
            .reverse();
          return path.join(runsRoot, dirs[0] ?? '');
        })();
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Missing STOP 2 source: ${sourceDir}`);
    }
    await runStop3ForSpec(spec, sourceDir);
    return;
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const batchDir = path.join(
    process.cwd(),
    'outputs',
    'story-gen-v3-runs',
    `confidence-batch-stop${stop}-${timestamp}`
  );
  fs.mkdirSync(batchDir, { recursive: true });

  if (stop === 1) {
    for (const spec of specs) {
      await runStop1ForSpec(spec, batchDir);
    }
    if (specs.length > 1) {
      await writeBatchStop1Summary(batchDir, specs);
    }
    console.log('[confidence] HARD STOP — human read all STOP 1 reports.');
    return;
  }

  if (stop === 2) {
    for (const spec of specs) {
      const sourceDir = sourceArg
        ? path.resolve(sourceArg)
        : (() => {
            const pathFile = path.join(batchDir, `${spec.companionId}-stop1-path.json`);
            if (fs.existsSync(pathFile)) {
              return JSON.parse(fs.readFileSync(pathFile, 'utf8')).runDir as string;
            }
            const runsRoot = path.join(process.cwd(), 'outputs', 'story-gen-v3-runs');
            const dirs = fs
              .readdirSync(runsRoot)
              .filter((d) => d.startsWith(spec.id + '-stop1'))
              .sort()
              .reverse();
            return path.join(runsRoot, dirs[0] ?? '');
          })();
      await runStop2ForSpec(spec, sourceDir);
    }
    return;
  }

  throw new Error(`Unknown stop: ${stop}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
