/**
 * Validate Writer's Room bounded loop on 4 final canaries (existing artifacts only).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-writers-room-bounded-loop.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import type { StoryOutline } from '../lib/story-gen/story-generation-types';
import { DEFAULT_STORY_GEN_MODELS } from '../lib/story-gen/story-generation-types';
import { patchWritersRoomOutline } from '../lib/story-gen/writers-room-artifact-patches';
import {
  formatWritersRoomRoutingTable,
  runWritersRoomBoundedLoop,
  type WritersRoomBoundedLoopReport,
} from '../lib/story-gen/writers-room-bounded-loop';

const CANARY_POST_PATCH_ROOT = path.join(
  process.cwd(),
  'outputs',
  'writers-room-canary',
  '2026-06-08T07-38-12-119Z'
);

const TARGETS = [
  {
    scenarioId: 'bolly_b1_lahitraf_adv',
    outlineRunFolder: 'outputs/story-gen-runs/2026-06-07T18-49-32-189Z',
  },
  {
    scenarioId: 'bolly_b4_hacheder_bed',
    outlineRunFolder: 'outputs/story-gen-runs/2026-06-07T19-11-50-756Z',
  },
  {
    scenarioId: 'tubi_s2_ha_bayit_bed',
    outlineRunFolder: 'outputs/story-gen-runs/2026-06-07T18-59-38-961Z',
  },
  {
    scenarioId: 'tubi_s5_ha_zikukim_adv',
    outlineRunFolder: 'outputs/story-gen-runs/2026-06-07T17-48-35-373Z',
  },
] as const;

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function stageSummaryLines(report: WritersRoomBoundedLoopReport): string[] {
  return report.stages.map(
    (s) => `- **${s.stage}**: ${s.pass ? 'PASS' : 'FAIL'} — ${s.summary}`
  );
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rootOut = path.join(
    process.cwd(),
    'outputs',
    'writers-room-canary',
    `bounded-loop-${timestamp}`
  );
  fs.mkdirSync(rootOut, { recursive: true });

  console.log(`[bounded-loop] → ${rootOut}`);
  console.log(`[bounded-loop] judgeModel=${DEFAULT_STORY_GEN_MODELS.judgeModel}`);

  const reports: WritersRoomBoundedLoopReport[] = [];

  for (const target of TARGETS) {
    const scenario = resolveScenarioById(target.scenarioId);
    const storyPath = path.join(
      CANARY_POST_PATCH_ROOT,
      target.scenarioId,
      'story.after-patch.md'
    );
    if (!fs.existsSync(storyPath)) {
      throw new Error(`Missing artifact: ${storyPath}`);
    }

    const outlineRaw = readJson<StoryOutline>(
      path.join(process.cwd(), target.outlineRunFolder, 'outline.json')
    );
    if (!outlineRaw) throw new Error(`Missing outline for ${target.scenarioId}`);
    const outline = patchWritersRoomOutline(target.scenarioId, outlineRaw);

    const storyMarkdown = fs.readFileSync(storyPath, 'utf8');
    const outDir = path.join(rootOut, target.scenarioId);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'story.input.md'), storyMarkdown, 'utf8');

    console.log(`[bounded-loop] running ${target.scenarioId}...`);
    const report = await runWritersRoomBoundedLoop({
      storyMarkdown,
      scenario,
      outline,
      runLabel: `bounded-loop-${target.scenarioId}`,
      skipProofread: true,
      skipAdventureEnrich: true,
    });

    reports.push(report);

    fs.writeFileSync(
      path.join(outDir, 'bounded-loop-report.json'),
      JSON.stringify(report, null, 2),
      'utf8'
    );

    if (report.authorRewriteUsed && report.tasteBefore && report.tasteAfter) {
      fs.writeFileSync(
        path.join(outDir, 'taste-before.json'),
        JSON.stringify(report.tasteBefore, null, 2),
        'utf8'
      );
      fs.writeFileSync(
        path.join(outDir, 'taste-after.json'),
        JSON.stringify(report.tasteAfter, null, 2),
        'utf8'
      );
    }

    console.log(
      `[bounded-loop] ${target.scenarioId} → ${report.terminal} (taste=${report.finalTaste.verdict}, tech=${report.technicalPass ? 'PASS' : 'FAIL'})`
    );
  }

  const routingTable = formatWritersRoomRoutingTable(reports);
  const surprises: string[] = [];
  const deterministicFails: string[] = [];

  for (const r of reports) {
    if (!r.technicalPass) {
      deterministicFails.push(
        `${r.scenarioId}: ${r.technicalFailures.join('; ')}`
      );
    }
    if (r.authorRewriteUsed) {
      surprises.push(
        `${r.scenarioId}: Author Rewrite triggered (${r.tasteBefore?.verdict}→${r.finalTaste.verdict})`
      );
    }
    if (r.finalTaste.verdict === 'BANK_READY' && !r.technicalPass) {
      surprises.push(
        `${r.scenarioId}: taste BANK_READY but technical FAIL — capped to ${r.terminal}`
      );
    }
    if (r.scenarioId === 'tubi_s5_ha_zikukim_adv') {
      surprises.push(
        `S5 mechanical/enrich note: weakest p${r.finalTaste.weakestPage.page} — ${r.finalTaste.weakestPage.reason}`
      );
    }
  }

  const perStorySections = reports.map((r) => {
    const lines = [
      `## ${r.scenarioId}`,
      '',
      `- **Terminal:** ${r.terminal}`,
      `- **Final taste:** ${r.finalTaste.verdict} (${r.finalTaste.confidence})`,
      `- **Technical gates:** ${r.technicalPass ? 'PASS' : 'FAIL'}`,
      `- **Author rewrite:** ${r.authorRewriteUsed ? 'yes' : 'no'}`,
      `- **Craft v2.1:** overall=${r.craftV21.overall} ladder=${r.craftV21.ladderPlacement}`,
      `- **Swap:** ${r.swapTest.verdict} (${r.swapTest.bindingScore})`,
      `- **Freshness:** ${r.freshnessTest.recommendation} (shapeMax=${r.freshnessTest.shapeOverlapMax})`,
    ];

    if (r.finalTaste.verdict === 'BANK_READY' && r.finalTaste.quotableLines?.length) {
      lines.push(
        `- **Quotable lines:** ${r.finalTaste.quotableLines.map((q) => `"${q}"`).join(' · ')}`
      );
    }

    if (r.tasteBefore && r.tasteAfter) {
      lines.push(
        `- **Taste before→after:** ${r.tasteBefore.verdict} → ${r.tasteAfter.verdict}`,
        `- **Weakest before:** p${r.tasteBefore.weakestPage.page} "${r.tasteBefore.weakestLine}"`,
        `- **Weakest after:** p${r.tasteAfter.weakestPage.page} "${r.tasteAfter.weakestLine}"`
      );
    } else {
      lines.push(
        `- **Weakest:** p${r.finalTaste.weakestPage.page} "${r.finalTaste.weakestLine}"`,
        `- **Strongest:** "${r.finalTaste.strongestLine}"`
      );
    }

    if (!r.technicalPass) {
      lines.push('- **Deterministic failures:**');
      for (const f of r.technicalFailures) lines.push(`  - ${f}`);
    }

    lines.push('', '### Stage summary', '', ...stageSummaryLines(r), '');
    return lines.join('\n');
  });

  const recommendation =
    reports.every((r) => r.technicalPass) &&
    reports.every((r) =>
      ['bank_ready_candidate', 'strong_draft_needs_light_human_polish'].includes(r.terminal)
    )
      ? 'Bounded loop validated on 4 canaries. Safe to trial on newly generated stories with human spot-check on any STRONG_DRAFT terminal.'
      : 'Review failures/surprises before using loop on new generated stories.';

  const reportMd = [
    "# Writer's Room — Bounded Loop Validation",
    '',
    `Generated: ${new Date().toISOString()}`,
    `Prompt: taste-judge-v2`,
    `Source artifacts: \`${CANARY_POST_PATCH_ROOT}\``,
    '',
    '## Final routing table',
    '',
    routingTable,
    '',
    ...perStorySections,
    '## Deterministic gate failures',
    deterministicFails.length ? deterministicFails.map((d) => `- ${d}`).join('\n') : '(none)',
    '',
    '## Surprises',
    surprises.length ? surprises.map((s) => `- ${s}`).join('\n') : '(none)',
    '',
    '## Recommendation',
    recommendation,
    '',
    '**HARD STOP** — no new story generation in this run.',
  ].join('\n');

  fs.writeFileSync(path.join(rootOut, 'summary.md'), reportMd, 'utf8');
  fs.writeFileSync(
    path.join(rootOut, 'all-reports.json'),
    JSON.stringify(reports, null, 2),
    'utf8'
  );

  console.log('\n' + routingTable);
  console.log(`\n[bounded-loop] Wrote ${rootOut}/summary.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
