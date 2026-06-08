/**
 * Revalidate Tubi S1 after chip normalization + literary edits (no regeneration).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/revalidate-s1-chip-fix.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { normalizePartialGenderChips } from '../lib/story-gen/chip-normalize';
import { scanChipSafety } from '../lib/story-gen/chip-safety';
import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import type { StoryOutline } from '../lib/story-gen/story-generation-types';
import { runWritersRoomBoundedLoop } from '../lib/story-gen/writers-room-bounded-loop';

const SOURCE_RUN = path.join(
  process.cwd(),
  'outputs',
  'story-gen-runs',
  '2026-06-08T12-24-41-119Z'
);

function applyLiteraryEdits(markdown: string): { markdown: string; edits: string[] } {
  const edits: string[] = [];
  let out = markdown;

  const p11Before = 'שניהם {מסתכלים|מסתכלות} על הפעמון ומחייכים בעיניים נוצצות.';
  const p11After = 'העיניים של שניהם נצצו אל הפעמון.';
  if (out.includes(p11Before)) {
    out = out.replace(p11Before, p11After);
    edits.push(`p11: "${p11Before}" → "${p11After}"`);
  }

  const p12Before = '"השאר מעבר לחלון,"';
  const p12After = '"השאר נשאר מסביב,"';
  if (out.includes(p12Before)) {
    out = out.replace(p12Before, p12After);
    edits.push(`p12: ${p12Before} → ${p12After}`);
  }

  return { markdown: out, edits };
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(SOURCE_RUN, `revalidate-chip-fix-${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const sourceStory = fs.readFileSync(path.join(SOURCE_RUN, 'story.md'), 'utf8');
  const outline = JSON.parse(
    fs.readFileSync(path.join(SOURCE_RUN, 'outline.json'), 'utf8')
  ) as StoryOutline;

  fs.writeFileSync(path.join(outDir, 'story.before-edits.md'), sourceStory, 'utf8');

  const { markdown: edited, edits: literaryEdits } = applyLiteraryEdits(sourceStory);
  fs.writeFileSync(path.join(outDir, 'story.after-literary-edits.md'), edited, 'utf8');

  const { markdown: normalized, report: chipReport } = normalizePartialGenderChips(edited);
  fs.writeFileSync(path.join(outDir, 'story.after-chip-normalize.md'), normalized, 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'chip-normalize-report.json'),
    JSON.stringify(chipReport, null, 2),
    'utf8'
  );

  const chipSafety = scanChipSafety(normalized);
  fs.writeFileSync(
    path.join(outDir, 'chip-safety-report.json'),
    JSON.stringify(chipSafety, null, 2),
    'utf8'
  );

  const scenario = resolveScenarioById('tubi_s1_ha_yarid_adv');
  const loopReport = await runWritersRoomBoundedLoop({
    storyMarkdown: normalized,
    scenario,
    outline,
    reportId: 'tubi_s1_ha_yarid_adv',
    runLabel: 's1-revalidate-chip-fix',
  });

  fs.writeFileSync(path.join(outDir, 'story.final.md'), loopReport.finalStoryMarkdown, 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'bounded-loop-report.json'),
    JSON.stringify(loopReport, null, 2),
    'utf8'
  );

  const summary = [
    '# S1 Revalidation — chip fix + literary edits',
    '',
    `Output: \`${outDir}\``,
    `Source: \`${SOURCE_RUN}/story.md\` (no regeneration)`,
    '',
    '## Literary edits',
    ...literaryEdits.map((e) => `- ${e}`),
    '',
    '## Chip normalization',
    `- convertedRegular: ${chipReport.convertedRegularCount}`,
    `- convertedException: ${chipReport.convertedExceptionCount}`,
    `- fixCount: ${chipReport.fixCount}`,
    `- unrepaired: ${chipReport.unrepaired.length}`,
    `- remaining slash (safety): ${chipSafety.hits.filter((h) => h.reason === 'remaining_slash_gender').length}`,
    '',
    '## Terminal',
    `- **${loopReport.terminal}**`,
    `- taste: ${loopReport.finalTaste.verdict}`,
    `- technical: ${loopReport.technicalPass ? 'PASS' : 'FAIL'}`,
    `- rewrite: ${loopReport.authorRewriteUsed ? 'yes' : 'no'}`,
  ];

  if (!loopReport.technicalPass) {
    summary.push('', '## Technical failures', ...loopReport.technicalFailures.map((f) => `- ${f}`));
  }

  fs.writeFileSync(path.join(outDir, 'summary.md'), summary.join('\n'), 'utf8');

  console.log(`[s1-revalidate] → ${outDir}`);
  console.log(`[s1-revalidate] terminal=${loopReport.terminal} taste=${loopReport.finalTaste.verdict} tech=${loopReport.technicalPass}`);
  console.log(`[s1-revalidate] chip fixes=${chipReport.fixCount} unrepaired=${chipReport.unrepaired.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
