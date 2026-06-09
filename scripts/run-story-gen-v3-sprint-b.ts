/**
 * Generator-v3 Sprint B — prose + humor weaving + StoryAlive gate.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-story-gen-v3-sprint-b.ts
 *
 * Optional: --source=<phase2-run-dir>
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { normalizePartialGenderChips } from '../lib/story-gen/chip-normalize';
import { scanChipSafety } from '../lib/story-gen/chip-safety';
import { parseStoryPages, pageProseOnly } from '../lib/story-gen/story-page-utils';
import { applyTtsAmbiguityNiqqudPass } from '../lib/story-gen-v2/tts-ambiguity-niqqud';
import { buildHardenedPremiseP10 } from '../lib/story-gen-v3/hardened-premise-p10';
import { applyV3ChipArtifactFixes } from '../lib/story-gen-v3/chip-artifact-fix';
import { generateProseSprintB } from '../lib/story-gen-v3/prose-gen-sprint-b';
import { buildSprintBReport } from '../lib/story-gen-v3/sprint-b-report';
import { runStoryAliveGate } from '../lib/story-gen-v3/story-alive-gate';
import type { PageBeatV3, StoryPremiseCandidate, StorySpineV3 } from '../lib/story-gen-v3/types';

const DEFAULT_PHASE2 = path.join(
  process.cwd(),
  'outputs/story-gen-v3-runs/dini_premise_sprint_a-phase2-p10-2026-06-09T09-27-35-278Z'
);

const MODEL_ID = 'gpt-5-chat-latest';

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

async function main(): Promise<void> {
  const sourceArg = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1];
  const sourceDir = sourceArg ? path.resolve(sourceArg) : DEFAULT_PHASE2;

  const spinePath = path.join(sourceDir, 'story-spine.json');
  const beatsPath = path.join(sourceDir, 'page-beats.json');
  if (!fs.existsSync(spinePath) || !fs.existsSync(beatsPath)) {
    throw new Error(`Missing Phase 2 artifacts in ${sourceDir}`);
  }

  const spine = readJson<StorySpineV3>(spinePath);
  const beats = readJson<PageBeatV3[]>(beatsPath);
  const premise: StoryPremiseCandidate = fs.existsSync(
    path.join(sourceDir, 'hardened-premise.json')
  )
    ? readJson<StoryPremiseCandidate>(path.join(sourceDir, 'hardened-premise.json'))
    : buildHardenedPremiseP10();

  const generatedAt = new Date().toISOString();
  const timestamp = generatedAt.replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'story-gen-v3-runs',
    `dini_premise_sprint_b-p10-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });

  fs.copyFileSync(spinePath, path.join(runDir, 'story-spine.json'));
  fs.copyFileSync(beatsPath, path.join(runDir, 'page-beats.json'));
  fs.writeFileSync(path.join(runDir, 'hardened-premise.json'), JSON.stringify(premise, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'source-phase2.json'),
    JSON.stringify({ phase2Dir: sourceDir }, null, 2)
  );

  console.log(`[v3 sprint-b] Phase 2 source: ${sourceDir}`);
  console.log('[v3 sprint-b] generating prose...');

  const { storyMarkdown: rawMd, inputTokens, outputTokens } = await generateProseSprintB({
    spine,
    beats,
    premise,
    modelId: MODEL_ID,
    generatedAt,
  });

  let md = rawMd;
  const chipFixes = applyV3ChipArtifactFixes(md);
  md = chipFixes.markdown;

  const chipNorm = normalizePartialGenderChips(md);
  md = chipNorm.markdown.replace(/\r?\nWORD_COUNT:[\s\S]*$/i, '').trim();

  const chipFixes2 = applyV3ChipArtifactFixes(md);
  md = chipFixes2.markdown;

  const { markdown: withNiqqud, applied: ttsApplied } = applyTtsAmbiguityNiqqudPass(md);
  md = withNiqqud;

  const chipSafety = scanChipSafety(md);

  const alive = runStoryAliveGate({
    storyMarkdown: md,
    beats,
    chipSafety,
    chipNormalizeFailed: chipNorm.report.advisoryFail,
  });

  fs.writeFileSync(path.join(runDir, 'story.md'), md, 'utf8');

  const storyPages = parseStoryPages(md).map(({ page, body }) => ({
    page,
    imageDirection: (body.match(/imageDirection\s*:\s*(.+)/i)?.[1] ?? '').trim(),
    prose: pageProseOnly(body),
  }));
  fs.writeFileSync(path.join(runDir, 'story-pages.json'), JSON.stringify(storyPages, null, 2));

  fs.writeFileSync(path.join(runDir, 'story-alive-report.json'), JSON.stringify(alive, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'chip-safety-report.json'),
    JSON.stringify(chipSafety, null, 2)
  );
  fs.writeFileSync(
    path.join(runDir, 'chip-normalize-report.json'),
    JSON.stringify(chipNorm.report, null, 2)
  );
  fs.writeFileSync(
    path.join(runDir, 'chip-artifact-fixes.json'),
    JSON.stringify([...chipFixes.fixes, ...chipFixes2.fixes], null, 2)
  );
  if (ttsApplied.length) {
    fs.writeFileSync(
      path.join(runDir, 'tts-niqqud-applied.json'),
      JSON.stringify({ applied: ttsApplied }, null, 2)
    );
  }

  const selfCheck = {
    storyAliveVerdict: alive.verdict,
    humorMoments: alive.humorMoments,
    therapyWordHits: alive.therapyWordHits,
    anchorHits: alive.anchorHits,
    chipSafetyPass: !chipSafety.advisoryFail,
    chipNormalizePass: !chipNorm.report.advisoryFail,
    hardFails: alive.hardFails,
    softWarnings: alive.softWarnings,
  };
  fs.writeFileSync(path.join(runDir, 'self-check.json'), JSON.stringify(selfCheck, null, 2));

  const report = buildSprintBReport({
    runDir,
    tokens: { in: inputTokens, out: outputTokens },
    alive,
    chipSafety,
    chipNormalize: chipNorm.report,
  });
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');

  console.log(`[v3 sprint-b] → ${runDir}/story.md`);
  console.log(`[v3 sprint-b] StoryAlive: ${alive.verdict}`);
  console.log(`[v3 sprint-b] chip-safety: ${chipSafety.advisoryFail ? 'FAIL' : 'PASS'}`);
  console.log('[v3 sprint-b] HARD STOP — human read aloud required.');

  if (alive.verdict === 'FAIL' || chipSafety.advisoryFail) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
