/**
 * ONE fresh scenario through the full Writer's Room bounded loop.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-fresh-writers-room-single.ts \
 *     --scenario-id tubi_s1_ha_yarid_adv
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { generateStoryFromScenario } from '../lib/story-gen/generate-story';
import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import { describeTasteDelta } from '../lib/story-gen/probe-loop-fixtures';
import {
  DEFAULT_STORY_GEN_MODELS,
  type StoryGenModelConfig,
} from '../lib/story-gen/story-generation-types';
import {
  runWritersRoomBoundedLoop,
  type WritersRoomBoundedLoopReport,
} from '../lib/story-gen/writers-room-bounded-loop';

function parseArgs(): { scenarioId: string; model: string } {
  const argv = process.argv.slice(2);
  let scenarioId = 'tubi_s1_ha_yarid_adv';
  let model = 'gpt-5-chat-latest';
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--scenario-id' || argv[i] === '--scenario') && argv[i + 1]) {
      scenarioId = argv[++i];
    }
    if (argv[i] === '--model' && argv[i + 1]) {
      model = argv[++i];
    }
  }
  return { scenarioId, model };
}

function freshnessHighlights(report: WritersRoomBoundedLoopReport): string[] {
  const dims = report.freshnessTest.dimensions ?? [];
  const watchIds = [
    'tubi_s5_ha_zikukim_adv',
    'tubi_s2_ha_bayit_bed',
    'song_whale_bedtime',
  ];
  const lines: string[] = [];
  for (const id of watchIds) {
    const hits = dims.filter((d) => d.nearestMatchId.includes(id) || d.nearestMatchId === id);
    if (hits.length) {
      lines.push(
        `**${id}**: ${hits.map((h) => `${h.dimensionId}=${h.overlapScore} (effective ${h.effectiveScore}, ${h.recommendation})`).join('; ')}`
      );
    } else {
      const byCompanion = dims
        .filter((d) => d.nearestMatchCompanionId === 'baby_elephant' || d.nearestMatchId.includes('tubi'))
        .sort((a, b) => b.effectiveScore - a.effectiveScore)
        .slice(0, 2);
      if (id.startsWith('tubi') && byCompanion.length) {
        lines.push(
          `**${id}** (nearest Tubi dims): ${byCompanion.map((h) => `${h.dimensionId}→${h.nearestMatchId} score=${h.overlapScore}`).join('; ')}`
        );
      }
    }
  }
  if (!lines.length) {
    return dims
      .sort((a, b) => b.effectiveScore - a.effectiveScore)
      .slice(0, 6)
      .map(
        (d) =>
          `- ${d.dimensionId}: nearest=${d.nearestMatchId} overlap=${d.overlapScore} effective=${d.effectiveScore}`
      );
  }
  return lines.map((l) => `- ${l}`);
}

async function main(): Promise<void> {
  const { scenarioId, model } = parseArgs();
  const scenario = resolveScenarioById(scenarioId);
  const modelConfig: StoryGenModelConfig = {
    draftModel: model,
    judgeModel: model,
    revisionModel: model,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(process.cwd(), 'outputs', 'story-gen-runs', timestamp);
  fs.mkdirSync(runDir, { recursive: true });

  const command = `npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-fresh-writers-room-single.ts --scenario-id ${scenarioId} --model ${model}`;

  console.log(`[fresh-wr] → ${runDir}`);
  console.log(`[fresh-wr] scenario=${scenarioId} companion=${scenario.companionId} direction=${scenario.direction}`);
  console.log(`[fresh-wr] model=${model}`);

  console.log('[fresh-wr] Step 1: draft generation (outline + prose + pre-loop enrich/normalize)...');
  const draft = await generateStoryFromScenario({ scenario, modelConfig });

  fs.writeFileSync(path.join(runDir, 'outline.json'), JSON.stringify(draft.outline, null, 2), 'utf8');
  fs.writeFileSync(path.join(runDir, 'story.draft.md'), draft.storyMarkdown, 'utf8');
  fs.writeFileSync(path.join(runDir, 'story.md'), draft.storyMarkdown, 'utf8');
  fs.writeFileSync(path.join(runDir, 'scenario.json'), JSON.stringify(draft.scenario, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(runDir, 'model-versions.json'),
    JSON.stringify(draft.modelVersions, null, 2),
    'utf8'
  );
  if (draft.advisoryReport) {
    fs.writeFileSync(
      path.join(runDir, 'draft-advisory-report.json'),
      JSON.stringify(draft.advisoryReport, null, 2),
      'utf8'
    );
  }

  console.log('[fresh-wr] Step 2: full bounded Writer\'s Room loop (all gates ON)...');
  const loopReport = await runWritersRoomBoundedLoop({
    storyMarkdown: draft.storyMarkdown,
    scenario,
    outline: draft.outline,
    reportId: scenarioId,
    runLabel: `fresh-wr-${scenarioId}`,
    judgeModel: model,
    draftModel: model,
  });

  fs.writeFileSync(
    path.join(runDir, 'bounded-loop-report.json'),
    JSON.stringify(loopReport, null, 2),
    'utf8'
  );

  if (loopReport.authorRewriteUsed) {
    fs.writeFileSync(path.join(runDir, 'story.before-rewrite.md'), draft.storyMarkdown, 'utf8');
    fs.writeFileSync(
      path.join(runDir, 'story.after-rewrite.md'),
      loopReport.finalStoryMarkdown,
      'utf8'
    );
  }

  fs.writeFileSync(path.join(runDir, 'story.final.md'), loopReport.finalStoryMarkdown, 'utf8');
  fs.writeFileSync(path.join(runDir, 'story.md'), loopReport.finalStoryMarkdown, 'utf8');

  const taste = loopReport.finalTaste;
  const reportLines = [
    '# Fresh Writer\'s Room — Single Scenario Run',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Command: \`${command}\``,
    `Run folder: \`${runDir}\``,
    '',
    '## Routing',
    '',
    `- **Terminal:** ${loopReport.terminal}`,
    `- **Author rewrite:** ${loopReport.authorRewriteUsed ? 'yes' : 'no'}`,
    `- **Technical gates:** ${loopReport.technicalPass ? 'PASS' : 'FAIL'}`,
    `- **Pass label:** ${loopReport.passLabel}`,
    '',
    '## Taste Judge (final)',
    '',
    `- **Verdict:** ${taste.verdict}`,
    `- **Confidence:** ${taste.confidence}`,
  ];

  if (taste.quotableLines?.length) {
    reportLines.push(`- **Quotable lines:** ${taste.quotableLines.map((q) => `"${q}"`).join(' · ')}`);
  }
  reportLines.push(
    `- **Weakest page:** p${taste.weakestPage.page} — ${taste.weakestPage.reason}`,
    `- **Weakest line:** "${taste.weakestLine}"`,
    `- **Strongest line:** "${taste.strongestLine}"`,
    '- **Reasons:**',
    ...taste.reasons.map((r) => `  - ${r}`),
    '',
    '## Craft / Swap / Freshness',
    '',
    `- **Craft v2.1:** overall=${loopReport.craftV21.overall} ladder=${loopReport.craftV21.ladderPlacement} verdict=${loopReport.craftV21.verdict}`,
    `- **Swap:** ${loopReport.swapTest.verdict} binding=${loopReport.swapTest.bindingScore}`,
    `- **Required signals:** ${loopReport.swapTest.requiredCompanionSignals.join('; ')}`,
    `- **Freshness:** ${loopReport.freshnessTest.recommendation} shapeMax=${loopReport.freshnessTest.shapeOverlapMax}`,
    '',
    '### Freshness nearest (Tubi S5 / S2 / whale)',
    '',
    ...freshnessHighlights(loopReport),
    '',
    '## Gate stages',
    '',
    ...loopReport.stages.map((s) => `- **${s.stage}**: ${s.pass ? 'PASS' : 'FAIL'} — ${s.summary}`),
  );

  if (!loopReport.technicalPass) {
    reportLines.push('', '## Deterministic failures', '');
    for (const f of loopReport.technicalFailures) reportLines.push(`- ${f}`);
  }

  if (loopReport.authorRewriteUsed && loopReport.tasteBefore && loopReport.tasteAfter) {
    const delta = describeTasteDelta(loopReport.tasteBefore, loopReport.tasteAfter);
    reportLines.push(
      '',
      '## Rewrite',
      '',
      `- **Taste:** ${loopReport.tasteBefore.verdict} → ${loopReport.tasteAfter.verdict} (${delta})`,
      `- **Preservation:** ${loopReport.preservation?.verdict ?? 'n/a'}`,
      `- **Preservation codes:** ${loopReport.preservation?.failureCodes.join(', ') || 'none'}`,
    );
    if (loopReport.preservation?.reasons.length) {
      reportLines.push('- **Preservation reasons:**');
      for (const r of loopReport.preservation.reasons) reportLines.push(`  - ${r}`);
    }
  }

  reportLines.push('', '**HARD STOP** — one story only.', '');

  fs.writeFileSync(path.join(runDir, 'writers-room-report.md'), reportLines.join('\n'), 'utf8');

  console.log(`[fresh-wr] terminal=${loopReport.terminal} taste=${taste.verdict} rewrite=${loopReport.authorRewriteUsed}`);
  console.log(`[fresh-wr] Wrote ${runDir}/writers-room-report.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
