/**
 * Validate S1 bank_ready final artifact only (no regeneration/rewrite).
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import type { StoryOutline } from '../lib/story-gen/story-generation-types';
import { runWritersRoomBoundedLoop } from '../lib/story-gen/writers-room-bounded-loop';

const RUN = path.join(
  process.cwd(),
  'outputs',
  'story-gen-runs',
  '2026-06-08T12-24-41-119Z'
);
const FINAL = path.join(
  RUN,
  'revalidate-chip-fix-2026-06-08T12-49-08-844Z',
  'story.final.md'
);

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(RUN, `polish-validation-${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const storyMarkdown = fs.readFileSync(FINAL, 'utf8');
  const outline = JSON.parse(
    fs.readFileSync(path.join(RUN, 'outline.json'), 'utf8')
  ) as StoryOutline;
  const scenario = resolveScenarioById('tubi_s1_ha_yarid_adv');

  const report = await runWritersRoomBoundedLoop({
    storyMarkdown,
    scenario,
    outline,
    reportId: 'tubi_s1_ha_yarid_adv',
    runLabel: 's1-polish-validation',
  });

  fs.writeFileSync(path.join(outDir, 'bounded-loop-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(outDir, 'summary.md'),
    [
      '# S1 polish validation',
      '',
      `- terminal: **${report.terminal}**`,
      `- taste: ${report.finalTaste.verdict}`,
      `- technical: ${report.technicalPass ? 'PASS' : 'FAIL'}`,
      `- swap: ${report.swapTest.verdict} (${report.swapTest.bindingScore})`,
      `- freshness: ${report.freshnessTest.recommendation} shapeMax=${report.freshnessTest.shapeOverlapMax}`,
      `- craft: ${report.craftV21.overall} ${report.craftV21.verdict}`,
      report.technicalFailures.length
        ? `\nFailures:\n${report.technicalFailures.map((f) => `- ${f}`).join('\n')}`
        : '',
    ].join('\n'),
    'utf8'
  );

  console.log(`[s1-validate] → ${outDir}`);
  console.log(
    `[s1-validate] terminal=${report.terminal} taste=${report.finalTaste.verdict} tech=${report.technicalPass}`
  );
  if (!report.technicalPass) {
    console.error(report.technicalFailures.join('\n'));
    process.exit(1);
  }
  if (report.terminal !== 'bank_ready_candidate') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
