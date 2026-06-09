/**
 * Generator-v3 Scenario 2 — Koko / TRANSITION / adventure
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-story-gen-v3-scenario2.ts
 *   npx tsx ... scripts/run-story-gen-v3-scenario2.ts --stop=1
 *   npx tsx ... scripts/run-story-gen-v3-scenario2.ts --stop=2 --source=<stop1-run-dir>
 *   npx tsx ... scripts/run-story-gen-v3-scenario2.ts --stop=3 --source=<stop2-run-dir>
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { normalizePartialGenderChips } from '../lib/story-gen/chip-normalize';
import { scanChipSafety } from '../lib/story-gen/chip-safety';
import { pageProseOnly, parseStoryPages } from '../lib/story-gen/story-page-utils';
import { applyTtsAmbiguityNiqqudPass } from '../lib/story-gen-v2/tts-ambiguity-niqqud';
import { applyV3ChipArtifactFixes } from '../lib/story-gen-v3/chip-artifact-fix';
import { KOKO_SCENARIO_2 } from '../lib/story-gen-v3/experiment-spec';
import { extractAllGoldenPremises } from '../lib/story-gen-v3/golden-premise-extract';
import { runHebrewReadAloudEditor } from '../lib/story-gen-v3/hebrew-read-aloud-editor';
import { runMomentumGateBeforeProse } from '../lib/story-gen-v3/momentum-gate';
import { analyzePremiseDiversity } from '../lib/story-gen-v3/premise-collapse-check';
import { generateProseV3 } from '../lib/story-gen-v3/prose-gen-v3';
import { runPremiseTournament } from '../lib/story-gen-v3/premise-tournament';
import { buildHardenedPremiseKokoP04 } from '../lib/story-gen-v3/hardened-premise-koko-p04';
import { runPhase2SpineAndBeats } from '../lib/story-gen-v3/spine-beats-gen';
import {
  renderStoryMdFromFiles,
  syncStoryPagesFromMarkdown,
} from '../lib/story-gen-v3/story-md-renderer';
import { validateStoryMdReadBack } from '../lib/story-gen-v3/story-read-back-validation';
import { runStoryAliveGate } from '../lib/story-gen-v3/story-alive-gate';
import type { GoldenPremiseRecord, PageBeatV3, StoryPremiseCandidate, StorySpineV3 } from '../lib/story-gen-v3/types';

const MODEL_ID = 'gpt-5-chat-latest';
const SPEC = KOKO_SCENARIO_2;

const KOKO_GOLDEN_META: Array<{
  id: string;
  companionId: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
}> = [
  { id: 'chameleon_koko_adventure', companionId: 'chameleon_koko', direction: 'adventure' },
  { id: 'chameleon_koko_bedtime', companionId: 'chameleon_koko', direction: 'bedtime' },
  { id: 'panda_anat_adventure', companionId: 'panda_anat', direction: 'adventure' },
  { id: 'fox_uri_adventure', companionId: 'fox_uri', direction: 'adventure' },
];

function parseStop(): 1 | 2 | 3 {
  const arg = process.argv.find((a) => a.startsWith('--stop='))?.split('=')[1];
  const n = arg ? Number(arg) : 1;
  if (n === 2 || n === 3) return n;
  return 1;
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

async function runStop1(runDir: string): Promise<string> {
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'experiment-spec.json'), JSON.stringify(SPEC, null, 2));

  const goldenIds = KOKO_GOLDEN_META.filter((g) => SPEC.calibrationGoldenIds.includes(g.id));
  const goldenPremises: GoldenPremiseRecord[] = await extractAllGoldenPremises({
    goldenIds,
    modelId: MODEL_ID,
  });
  fs.writeFileSync(path.join(runDir, 'golden-premise.json'), JSON.stringify(goldenPremises, null, 2));

  console.log('[scenario2] STOP 1 — premise tournament...');
  const tournament = await runPremiseTournament({ spec: SPEC, goldenPremises, modelId: MODEL_ID });

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
        topThree: tournament.topThree.map((t) => ({
          id: t.candidate.id,
          titleSeed: t.candidate.titleSeed,
          weightedTotal: t.weightedTotal,
          scores: t.scores,
          judgeNotes: t.judgeNotes,
          criticAttacks: t.criticAttacks,
          premiseFamily: t.candidate.premiseFamily,
        })),
        selected: tournament.selected,
        selectionReason: tournament.selectionReason,
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(runDir, 'selected-premise.json'),
    JSON.stringify({ selected: tournament.selected }, null, 2)
  );

  const diversity = analyzePremiseDiversity(tournament.candidates.map((c) => c.candidate));
  fs.writeFileSync(path.join(runDir, 'premise-diversity-report.json'), JSON.stringify(diversity, null, 2));

  const report = `# Scenario 2 STOP 1 — Premise Tournament

## Spec
- companion: chameleon_koko
- theme: TRANSITION
- direction: adventure

## Diversity analysis
${diversity.summary}

- distinct families: ${diversity.distinctCount}
- collapsed ids: ${diversity.collapsedIds.join(', ') || 'none'}
- viable non-collapsed: ${diversity.viableNonCollapsed.join(', ')}

## Selected
- **${tournament.selected.id}**: ${tournament.selected.titleSeed}
- reason: ${tournament.selectionReason}

## Top 3
${tournament.topThree
  .map(
    (t) =>
      `### ${t.candidate.id} (${t.weightedTotal})\n- hook: ${t.candidate.oneLineHook}\n- family: ${t.candidate.premiseFamily}\n- notes: ${t.judgeNotes ?? ''}`
  )
  .join('\n\n')}

## STOP 1 verdict
${diversity.passStop1 ? '**PASS** — human read candidates before STOP 2' : '**FAIL/RISK** — premise collapse detected; do not continue to prose without repair'}

Run dir: \`${runDir}\`
`;
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');

  console.log(`[scenario2] STOP 1 → ${runDir}`);
  console.log(`[scenario2] ${diversity.summary}`);
  console.log('[scenario2] HARD STOP — human read premise candidates.');

  if (!diversity.passStop1) process.exitCode = 2;
  return runDir;
}

async function runStop2(runDir: string, premise: StoryPremiseCandidate): Promise<void> {
  console.log('[scenario2] STOP 2 — spine + beats + momentum gate...');

  const { spine, beats, spineHardFails, beatHardFails } = await runPhase2SpineAndBeats({
    premise,
    spec: SPEC,
    runDir,
    modelId: MODEL_ID,
    pageCount: 12,
  });

  const momentum = runMomentumGateBeforeProse({ spine, beats, premise });
  fs.writeFileSync(
    path.join(runDir, 'momentum-report-before-prose.json'),
    JSON.stringify(momentum, null, 2)
  );

  const report = `# Scenario 2 STOP 2 — Spine + Beats

## Premise
${premise.id}: ${premise.titleSeed}

## Structure validation
- spine hard fails: ${spineHardFails.length}
- beat hard fails: ${beatHardFails.length}

## Momentum gate
- pass: ${momentum.pass}
- failures: ${momentum.failures.join('; ') || 'none'}
- warnings: ${momentum.warnings.join('; ') || 'none'}

## STOP 2 verdict
${momentum.pass && spineHardFails.length === 0 && beatHardFails.length === 0 ? '**PASS** — human read beats before prose' : '**FAIL** — repair beats before prose'}

Run dir: \`${runDir}\`
`;
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');

  console.log(`[scenario2] momentum: ${momentum.pass ? 'PASS' : 'FAIL'}`);
  console.log('[scenario2] HARD STOP — human read spine/beats.');

  if (!momentum.pass || spineHardFails.length || beatHardFails.length) process.exitCode = 2;
}

async function runStop3(runDir: string): Promise<void> {
  const spine = readJson<StorySpineV3>(path.join(runDir, 'story-spine.json'));
  const beats = readJson<PageBeatV3[]>(path.join(runDir, 'page-beats.json'));
  const premise = readJson<StoryPremiseCandidate>(path.join(runDir, 'hardened-premise.json'));

  const generatedAt = new Date().toISOString();
  console.log('[scenario2] STOP 3 — prose + gates...');

  const { storyMarkdown: rawMd, inputTokens, outputTokens } = await generateProseV3({
    spec: SPEC,
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

  const chipSafety = scanChipSafety(md);
  const alive = runStoryAliveGate({
    storyMarkdown: md,
    beats,
    chipSafety,
    chipNormalizeFailed: chipNorm.report.advisoryFail,
    companionId: SPEC.companionId,
    premise,
    endingProfile: 'koko_transition',
  });

  fs.writeFileSync(path.join(runDir, 'story.md'), md, 'utf8');

  const storyPagesPath = path.join(runDir, 'story-pages.json');
  syncStoryPagesFromMarkdown(md, storyPagesPath);
  renderStoryMdFromFiles({
    storyMarkdownPath: path.join(runDir, 'story.md'),
    storyPagesPath,
  });
  md = fs.readFileSync(path.join(runDir, 'story.md'), 'utf8');
  const readBack = validateStoryMdReadBack({
    storyMarkdownPath: path.join(runDir, 'story.md'),
    expectedPageCount: 12,
    endingProfile: 'koko_transition',
    storyPagesPath,
  });

  const storyMdPath = path.join(runDir, 'story.md');
  const hebrew = await runHebrewReadAloudEditor({
    storyMarkdownPath: storyMdPath,
    storyPagesPath,
    pageBeatsPath: path.join(runDir, 'page-beats.json'),
    storySpinePath: path.join(runDir, 'story-spine.json'),
    companionId: SPEC.companionId,
    targetReadAloudAge: '5–8',
    childAgeMin: 5,
    childAgeMax: 8,
    mode: 'apply_high_confidence_fixes',
    modelId: MODEL_ID,
    outputDir: runDir,
    goldenReferenceIds: SPEC.calibrationGoldenIds,
  });

  md = fs.readFileSync(storyMdPath, 'utf8');
  fs.writeFileSync(
    path.join(runDir, 'hebrew-read-aloud-report.json'),
    JSON.stringify(hebrew, null, 2)
  );
  if (fs.existsSync(path.join(runDir, 'hebrew-read-aloud-report.md'))) {
    // written by editor
  } else {
    fs.writeFileSync(
      path.join(runDir, 'hebrew-read-aloud-report.md'),
      `# Hebrew Read-Aloud\n\nverdict: ${hebrew.verdict}\n\n${hebrew.summary}\n`,
      'utf8'
    );
  }

  const readBackFinal = validateStoryMdReadBack({
    storyMarkdownPath: path.join(runDir, 'story.md'),
    expectedPageCount: 12,
    endingProfile: 'koko_transition',
    storyPagesPath,
  });

  fs.writeFileSync(path.join(runDir, 'story-alive-report.json'), JSON.stringify(alive, null, 2));
  fs.writeFileSync(path.join(runDir, 'chip-safety-report.json'), JSON.stringify(chipSafety, null, 2));
  fs.writeFileSync(path.join(runDir, 'chip-normalize-report.json'), JSON.stringify(chipNorm.report, null, 2));
  fs.writeFileSync(path.join(runDir, 'read-back-validation.json'), JSON.stringify(readBackFinal, null, 2));

  const selfCheck = {
    storyAliveVerdict: alive.verdict,
    hebrewVerdict: hebrew.verdict,
    readBackPass: readBackFinal.failures.length === 0,
    readFromDisk: readBackFinal.readFromDisk,
    fileByteLength: readBackFinal.fileByteLength,
    chipSafetyPass: !chipSafety.advisoryFail,
    hardFails: alive.hardFails,
  };
  fs.writeFileSync(path.join(runDir, 'self-check.json'), JSON.stringify(selfCheck, null, 2));

  if (ttsApplied.length) {
    fs.writeFileSync(
      path.join(runDir, 'tts-niqqud-applied.json'),
      JSON.stringify({ applied: ttsApplied }, null, 2)
    );
  }

  const report = `# Scenario 2 STOP 3 — Prose + Gates

## Tokens
in: ${inputTokens} / out: ${outputTokens}

## Gates
- StoryAlive: ${alive.verdict}
- chip-safety: ${chipSafety.advisoryFail ? 'FAIL' : 'PASS'}
- HebrewReadAloud: ${hebrew.verdict}
- read-back: ${readBackFinal.failures.length ? 'FAIL' : 'PASS'} (bytes: ${readBackFinal.fileByteLength})

## Self-check
${JSON.stringify(selfCheck, null, 2)}

Run dir: \`${runDir}\`
`;
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');

  console.log(`[scenario2] StoryAlive: ${alive.verdict}`);
  console.log(`[scenario2] Hebrew: ${hebrew.verdict}`);
  console.log(`[scenario2] read-back: ${readBackFinal.failures.length ? 'FAIL' : 'PASS'}`);

  if (
    alive.verdict === 'FAIL' ||
    chipSafety.advisoryFail ||
    hebrew.verdict !== 'AUTHOR_PASS_HEBREW' ||
    readBackFinal.failures.length
  ) {
    process.exitCode = 2;
  }
}

async function main(): Promise<void> {
  const stop = parseStop();
  const sourceArg = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (stop === 1) {
    const runDir = path.join(
      process.cwd(),
      'outputs',
      'story-gen-v3-runs',
      `${SPEC.id}-stop1-${timestamp}`
    );
    await runStop1(runDir);
    return;
  }

  const sourceDir = sourceArg
    ? path.resolve(sourceArg)
    : (() => {
        const runsRoot = path.join(process.cwd(), 'outputs', 'story-gen-v3-runs');
        const dirs = fs
          .readdirSync(runsRoot)
          .filter((d) => d.startsWith(SPEC.id))
          .sort()
          .reverse();
        return path.join(runsRoot, dirs[0] ?? '');
      })();

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing source run dir: ${sourceDir}`);
  }

  if (stop === 2) {
    const runDir = path.join(
      process.cwd(),
      'outputs',
      'story-gen-v3-runs',
      `${SPEC.id}-stop2-${timestamp}`
    );
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'experiment-spec.json'), JSON.stringify(SPEC, null, 2));
    fs.writeFileSync(path.join(runDir, 'source-stop1.json'), JSON.stringify({ stop1Dir: sourceDir }, null, 2));

    const useHardened = process.argv.includes('--hardened-p04');
    const premise = useHardened
      ? buildHardenedPremiseKokoP04()
      : readJson<{ selected: StoryPremiseCandidate }>(path.join(sourceDir, 'selected-premise.json'))
          .selected;
    await runStop2(runDir, premise);
    return;
  }

  const runDir = path.join(
    process.cwd(),
    'outputs',
    'story-gen-v3-runs',
    `${SPEC.id}-stop3-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });
  for (const f of ['story-spine.json', 'page-beats.json', 'hardened-premise.json', 'experiment-spec.json']) {
    fs.copyFileSync(path.join(sourceDir, f), path.join(runDir, f));
  }
  fs.writeFileSync(path.join(runDir, 'source-stop2.json'), JSON.stringify({ stop2Dir: sourceDir }, null, 2));
  await runStop3(runDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
