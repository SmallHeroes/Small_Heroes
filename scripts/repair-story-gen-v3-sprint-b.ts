/**
 * Re-apply chip fixes + StoryAlive gate to an existing Sprint B run dir.
 *
 *   npx tsx scripts/repair-story-gen-v3-sprint-b.ts <run-dir>
 */
import fs from 'fs';
import path from 'path';

import { normalizePartialGenderChips } from '../lib/story-gen/chip-normalize';
import { scanChipSafety } from '../lib/story-gen/chip-safety';
import { pageProseOnly, parseStoryPages } from '../lib/story-gen/story-page-utils';
import { applyV3ChipArtifactFixes } from '../lib/story-gen-v3/chip-artifact-fix';
import {
  renderStoryMdFromFiles,
  syncStoryPagesFromMarkdown,
} from '../lib/story-gen-v3/story-md-renderer';
import { validateStoryMdReadBack } from '../lib/story-gen-v3/story-read-back-validation';
import { buildSprintBReport } from '../lib/story-gen-v3/sprint-b-report';
import { runStoryAliveGate } from '../lib/story-gen-v3/story-alive-gate';
import type { PageBeatV3 } from '../lib/story-gen-v3/types';

async function main(): Promise<void> {
  const runDir = path.resolve(process.argv[2] ?? '');
  if (!runDir || !fs.existsSync(path.join(runDir, 'story.md'))) {
    throw new Error('Usage: repair-story-gen-v3-sprint-b.ts <run-dir>');
  }

  const beats = JSON.parse(
    fs.readFileSync(path.join(runDir, 'page-beats.json'), 'utf8')
  ) as PageBeatV3[];

  const storyMdPath = path.join(runDir, 'story.md');
  const storyPagesPath = path.join(runDir, 'story-pages.json');
  if (fs.existsSync(storyPagesPath)) {
    const pages = JSON.parse(fs.readFileSync(storyPagesPath, 'utf8')) as Array<{ prose?: string }>;
    if (pages.some((p) => (p.prose ?? '').trim().length > 0)) {
      renderStoryMdFromFiles({ storyMarkdownPath: storyMdPath, storyPagesPath });
    }
  }

  let md = fs.readFileSync(storyMdPath, 'utf8');
  md = applyV3ChipArtifactFixes(md).markdown;
  const chipNorm = normalizePartialGenderChips(md);
  md = chipNorm.markdown.replace(/\r?\nWORD_COUNT:[\s\S]*$/i, '').trim();
  md = applyV3ChipArtifactFixes(md).markdown;

  syncStoryPagesFromMarkdown(md, storyPagesPath);
  renderStoryMdFromFiles({ storyMarkdownPath: storyMdPath, storyPagesPath });
  md = fs.readFileSync(storyMdPath, 'utf8');

  const readBack = validateStoryMdReadBack({
    storyMarkdownPath: storyMdPath,
    expectedPageCount: 12,
  });

  const chipSafety = scanChipSafety(md);
  const alive = runStoryAliveGate({
    storyMarkdown: md,
    beats,
    chipSafety,
    chipNormalizeFailed: chipNorm.report.advisoryFail,
  });

  fs.writeFileSync(path.join(runDir, 'story.md'), md, 'utf8');
  fs.writeFileSync(
    path.join(runDir, 'read-back-validation.json'),
    JSON.stringify(readBack, null, 2)
  );
  fs.writeFileSync(path.join(runDir, 'chip-safety-report.json'), JSON.stringify(chipSafety, null, 2));
  fs.writeFileSync(path.join(runDir, 'chip-normalize-report.json'), JSON.stringify(chipNorm.report, null, 2));
  fs.writeFileSync(path.join(runDir, 'story-alive-report.json'), JSON.stringify(alive, null, 2));

  const storyPages = parseStoryPages(md).map(({ page, body }) => ({
    page,
    imageDirection: (body.match(/imageDirection\s*:\s*(.+)/i)?.[1] ?? '').trim(),
    prose: pageProseOnly(body),
  }));
  fs.writeFileSync(path.join(runDir, 'story-pages.json'), JSON.stringify(storyPages, null, 2));

  const prosePoseCheck = alive.checks.find((c) => c.id === 'prose_not_image_prompt');
  const selfCheck = {
    storyAliveVerdict: alive.verdict,
    completedP12: alive.completedP12,
    proseNotImagePrompt: prosePoseCheck?.pass ? 'pass' : 'warnings',
    proseNotImagePromptHits: alive.proseNotImagePromptHits,
    humorMoments: alive.humorMoments,
    therapyWordHits: alive.therapyWordHits,
    anchorHits: alive.anchorHits,
    chipSafetyPass: !chipSafety.advisoryFail,
    chipNormalizePass: !chipNorm.report.advisoryFail,
    hardFails: alive.hardFails,
    softWarnings: alive.softWarnings,
  };
  fs.writeFileSync(path.join(runDir, 'self-check.json'), JSON.stringify(selfCheck, null, 2));

  const poseRepairedArg = process.argv.find((a) => a.startsWith('--pose-repaired='));
  const poseLinesRepaired = poseRepairedArg
    ? poseRepairedArg.split('=')[1]?.split('|').filter(Boolean)
    : undefined;

  const report = buildSprintBReport({
    runDir,
    tokens: { in: 0, out: 0 },
    alive,
    chipSafety,
    chipNormalize: chipNorm.report,
    repairPass: process.argv.includes('--pass-2')
      ? 'REPAIR_PROSE pass-2 (p12 + prose_not_image_prompt)'
      : undefined,
    poseLinesRepaired,
  });
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');

  console.log(`[repair] StoryAlive: ${alive.verdict}`);
  console.log(`[repair] chip-safety: ${chipSafety.advisoryFail ? 'FAIL' : 'PASS'}`);
  console.log(`[repair] read-back completedEnding: ${readBack.completedEnding}`);
  if (readBack.failures.length) console.log('[repair] read-back failures:', readBack.failures);
  if (alive.hardFails.length) console.log('[repair] hardFails:', alive.hardFails);
  if (!readBack.completedEnding) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
