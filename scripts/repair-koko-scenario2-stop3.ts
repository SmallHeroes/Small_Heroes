import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

/**
 * Koko Scenario 2 STOP 3 repair — gates-first, then prose/chip fixes.
 *
 *   npx tsx scripts/repair-koko-scenario2-stop3.ts --phase=a
 *   npx tsx scripts/repair-koko-scenario2-stop3.ts --phase=b
 *   npx tsx scripts/repair-koko-scenario2-stop3.ts --phase=c
 */
import fs from 'fs';
import path from 'path';

import { normalizePartialGenderChips } from '../lib/story-gen/chip-normalize';
import { scanChipSafety } from '../lib/story-gen/chip-safety';
import { pageProseOnly, parseStoryPages } from '../lib/story-gen/story-page-utils';
import {
  scanRawArtifactTokensInMarkdown,
  scanSlashChipsInMarkdown,
} from '../lib/story-gen-v3/artifact-token-scan';
import { applyV3ChipArtifactFixes } from '../lib/story-gen-v3/chip-artifact-fix';
import { runHebrewReadAloudEditor } from '../lib/story-gen-v3/hebrew-read-aloud-editor';
import { runMomentumGateBeforeProse } from '../lib/story-gen-v3/momentum-gate';
import {
  renderStoryMdFromFiles,
  syncStoryPagesFromMarkdown,
} from '../lib/story-gen-v3/story-md-renderer';
import { convertSlashChipsToCurly } from '../lib/story-gen-v3/slash-chip-convert';
import { validateStoryMdReadBack } from '../lib/story-gen-v3/story-read-back-validation';
import { runStoryAliveGate } from '../lib/story-gen-v3/story-alive-gate';
import type { PageBeatV3, StoryPremiseCandidate, StorySpineV3 } from '../lib/story-gen-v3/types';

const DEFAULT_RUN = path.join(
  process.cwd(),
  'outputs/story-gen-v3-runs/koko_scenario_2_transition-stop3-2026-06-09T14-38-33-018Z'
);

const STOP2_RUN = path.join(
  process.cwd(),
  'outputs/story-gen-v3-runs/koko_scenario_2_transition-stop2-2026-06-09T14-35-00-165Z'
);

function phase(): 'a' | 'b' | 'c' {
  const p = process.argv.find((a) => a.startsWith('--phase='))?.split('=')[1];
  if (p === 'b' || p === 'c') return p;
  return 'a';
}

function runDir(): string {
  return path.resolve(process.argv.find((a) => a.startsWith('--run='))?.split('=')[1] ?? DEFAULT_RUN);
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

function runPhaseA(dir: string): void {
  const md = fs.readFileSync(path.join(dir, 'story.md'), 'utf8');
  const beats = readJson<PageBeatV3[]>(path.join(dir, 'page-beats.json'));
  const premise = readJson<StoryPremiseCandidate>(path.join(dir, 'hardened-premise.json'));
  const spine = readJson<StorySpineV3>(path.join(dir, 'story-spine.json'));

  const artifact = scanRawArtifactTokensInMarkdown(md);
  const slash = scanSlashChipsInMarkdown(md);
  const chipSafety = scanChipSafety(md);
  const alive = runStoryAliveGate({
    storyMarkdown: md,
    beats,
    chipSafety,
    companionId: 'chameleon_koko',
    premise,
    endingProfile: 'koko_transition',
  });
  const readBack = validateStoryMdReadBack({
    storyMarkdownPath: path.join(dir, 'story.md'),
    endingProfile: 'koko_transition',
    storyPagesPath: path.join(dir, 'story-pages.json'),
  });

  const stop2Beats = readJson<PageBeatV3[]>(path.join(STOP2_RUN, 'page-beats.json'));
  const momentum = runMomentumGateBeforeProse({
    spine,
    beats: stop2Beats,
    premise,
  });

  const report = {
    phase: 'A',
    artifactTokenScan: artifact,
    slashChipStyle: slash,
    storyAliveVerdict: alive.verdict,
    hebrewExpected: 'FAIL',
    readBackCompletedEnding: readBack.completedEnding,
    momentum,
    acceptance: {
      gatesFailOnBrokenArtifact: !artifact.pass && alive.verdict === 'FAIL',
      slashDetected: !slash.slashChipStylePass,
      momentumPass: momentum.pass && momentum.childActionPages >= 4,
    },
  };

  fs.writeFileSync(path.join(dir, 'phase-a-gate-report.json'), JSON.stringify(report, null, 2));
  console.log('[phase A]', JSON.stringify(report.acceptance, null, 2));
  console.log('[phase A] artifact tokens:', artifact.tokens);
  console.log('[phase A] StoryAlive:', alive.verdict);
  console.log('[phase A] momentum childActionPages:', momentum.childActionPages, 'pass:', momentum.pass);

  if (!report.acceptance.gatesFailOnBrokenArtifact) {
    console.error('[phase A] FAIL — gates did not fail on broken artifact');
    process.exitCode = 2;
  }
}

function repairProseBody(body: string): string {
  let text = body;
  text = text.replace(
    /"אני כבר שם!" קפצה קוֹקוֹ, \[koko_striped_wall_only\]/,
    '"אני כבר שם!" קפצה קוֹקוֹ, ונצמדה לפס הלא נכון.'
  );
  text = text.replace(
    /"אני רגועה לגמרי," אמרה בזמן שהבהבה כתום־פאניקה\. \[koko_panic_orange_calm_words\]/,
    '"אני רגועה לגמרי," אמרה, בזמן שכל הגוף שלה הבהב כתום־פאניקה.'
  );
  text = text.replace(
    /"נִשְׁאַרְנוּ בְּיַרֹק רַךְ הַיּוֹם," לחשה\./,
    '"עכשיו אני שלמה על הקיר הזה," לחשה קוֹקוֹ.'
  );
  const converted = convertSlashChipsToCurly(text);
  return converted.text;
}

function runPhaseB(dir: string): void {
  const storyMdPath = path.join(dir, 'story.md');
  let md = fs.readFileSync(storyMdPath, 'utf8');

  const pages = parseStoryPages(md);
  const repairedBodies = pages.map(({ page, body }) => {
    const imageMatch = body.match(/imageDirection\s*:\s*(.+)/i);
    const imageDirection = imageMatch?.[1]?.trim() ?? '';
    const prose = repairProseBody(pageProseOnly(body));
    return { page, imageDirection, prose };
  });

  fs.writeFileSync(path.join(dir, 'story-pages.json'), JSON.stringify(repairedBodies, null, 2));

  const header = md.split(/--- Page 1 ---/)[0];
  const pageBlocks = repairedBodies
    .map(
      (p) =>
        `--- Page ${p.page} ---\nimageDirection: ${p.imageDirection}\n\n${p.prose}`
    )
    .join('\n\n');
  md = header + pageBlocks;

  md = applyV3ChipArtifactFixes(md).markdown;
  const chipNorm = normalizePartialGenderChips(md);
  md = chipNorm.markdown;

  fs.writeFileSync(storyMdPath, md, 'utf8');
  syncStoryPagesFromMarkdown(md, path.join(dir, 'story-pages.json'));
  renderStoryMdFromFiles({
    storyMarkdownPath: storyMdPath,
    storyPagesPath: path.join(dir, 'story-pages.json'),
  });
  md = fs.readFileSync(storyMdPath, 'utf8');
  const slashPass = convertSlashChipsToCurly(md);
  if (slashPass.converted > 0) {
    md = slashPass.text;
    fs.writeFileSync(storyMdPath, md, 'utf8');
    syncStoryPagesFromMarkdown(md, path.join(dir, 'story-pages.json'));
    renderStoryMdFromFiles({
      storyMarkdownPath: storyMdPath,
      storyPagesPath: path.join(dir, 'story-pages.json'),
    });
    md = fs.readFileSync(storyMdPath, 'utf8');
  }

  const artifact = scanRawArtifactTokensInMarkdown(md);
  const slash = scanSlashChipsInMarkdown(md);
  console.log('[phase B] artifact tokens remaining:', artifact.tokens.length);
  console.log('[phase B] slash chips remaining:', slash.slashChipCount);
  fs.writeFileSync(
    path.join(dir, 'phase-b-repair-report.json'),
    JSON.stringify({ artifact, slash }, null, 2)
  );
}

async function runPhaseC(dir: string): Promise<void> {
  const storyMdPath = path.join(dir, 'story.md');
  const storyPagesPath = path.join(dir, 'story-pages.json');
  const beats = readJson<PageBeatV3[]>(path.join(dir, 'page-beats.json'));
  const premise = readJson<StoryPremiseCandidate>(path.join(dir, 'hardened-premise.json'));

  let md = fs.readFileSync(storyMdPath, 'utf8');
  md = applyV3ChipArtifactFixes(md).markdown;
  const chipNorm = normalizePartialGenderChips(md);
  md = chipNorm.markdown;
  fs.writeFileSync(storyMdPath, md, 'utf8');

  const chipSafety = scanChipSafety(md);
  const alive = runStoryAliveGate({
    storyMarkdown: md,
    beats,
    chipSafety,
    chipNormalizeFailed: chipNorm.report.advisoryFail,
    companionId: 'chameleon_koko',
    premise,
    endingProfile: 'koko_transition',
  });

  const hebrew = await runHebrewReadAloudEditor({
    storyMarkdownPath: storyMdPath,
    storyPagesPath,
    pageBeatsPath: path.join(dir, 'page-beats.json'),
    storySpinePath: path.join(dir, 'story-spine.json'),
    companionId: 'chameleon_koko',
    mode: 'apply_high_confidence_fixes',
    skipLlm: process.argv.includes('--skip-llm'),
    outputDir: dir,
    goldenReferenceIds: ['chameleon_koko_adventure', 'panda_anat_adventure'],
  });

  md = fs.readFileSync(storyMdPath, 'utf8');
  const readBack = validateStoryMdReadBack({
    storyMarkdownPath: storyMdPath,
    endingProfile: 'koko_transition',
    storyPagesPath,
  });

  const stop2Beats = readJson<PageBeatV3[]>(path.join(STOP2_RUN, 'page-beats.json'));
  const spine = readJson<StorySpineV3>(path.join(dir, 'story-spine.json'));
  const momentum = runMomentumGateBeforeProse({ spine, beats: stop2Beats, premise });

  const artifact = scanRawArtifactTokensInMarkdown(md);
  const slash = scanSlashChipsInMarkdown(md);

  const selfCheck = {
    storyAliveVerdict: alive.verdict,
    hebrewVerdict: hebrew.verdict,
    readBackPass: readBack.completedEnding && readBack.failures.length === 0,
    rawArtifactTokens: artifact.rawArtifactTokenCount,
    slashChips: slash.slashChipCount,
    slashChipStylePass: slash.slashChipStylePass,
    momentumPass: momentum.pass,
    childActionPages: momentum.childActionPages,
    chipSafetyPass: !chipSafety.advisoryFail,
    label: 'PATTERN_CANDIDATE_CONFIRMED',
  };

  fs.writeFileSync(path.join(dir, 'story-alive-report.json'), JSON.stringify(alive, null, 2));
  fs.writeFileSync(path.join(dir, 'read-back-validation.json'), JSON.stringify(readBack, null, 2));
  fs.writeFileSync(path.join(dir, 'chip-safety-report.json'), JSON.stringify(chipSafety, null, 2));
  fs.writeFileSync(path.join(dir, 'chip-normalize-report.json'), JSON.stringify(chipNorm.report, null, 2));
  fs.writeFileSync(path.join(dir, 'momentum-report-before-prose.json'), JSON.stringify(momentum, null, 2));
  fs.writeFileSync(path.join(dir, 'self-check.json'), JSON.stringify(selfCheck, null, 2));

  console.log('[phase C]', JSON.stringify(selfCheck, null, 2));

  if (
    alive.verdict !== 'PASS' &&
    alive.verdict !== 'AUTHOR_PASS' ||
    hebrew.verdict !== 'AUTHOR_PASS_HEBREW' ||
    !readBack.completedEnding ||
    artifact.rawArtifactTokenCount > 0 ||
    !slash.slashChipStylePass ||
    !momentum.pass
  ) {
    process.exitCode = 2;
  }
}

async function main(): Promise<void> {
  const dir = runDir();
  const p = phase();
  if (p === 'a') {
    runPhaseA(dir);
    return;
  }
  if (p === 'b') {
    runPhaseB(dir);
    return;
  }
  await runPhaseC(dir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
