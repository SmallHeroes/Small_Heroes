/**
 * Step 4.1 — revalidate existing stability-batch artifacts (no regeneration).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/revalidate-step4-batch.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { normalizePartialGenderChips } from '../lib/story-gen/chip-normalize';
import { scanImageDirectionFormat } from '../lib/story-gen/image-direction-validator';
import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import { parseWordCountLine } from '../lib/story-gen/story-page-utils';
import type { StoryOutline } from '../lib/story-gen/story-generation-types';
import {
  runWritersRoomBoundedLoop,
  type WritersRoomBoundedLoopReport,
} from '../lib/story-gen/writers-room-bounded-loop';

const SOURCE_BATCH = path.join(
  process.cwd(),
  'outputs',
  'writers-room-canary',
  'stability-batch-step4-2026-06-08T13-23-36-455Z'
);

const MODEL = 'gpt-5-chat-latest';

const SCENARIOS = [
  'tubi_s4_ha_raam_bed',
  'tubi_s6_ha_sheket_bed',
  'bolly_b2_hamila_adv',
  'bolly_b5_hamishpat_bed',
] as const;

interface RevalRow {
  scenarioId: string;
  beforeTerminal: string;
  afterTerminal: string;
  taste: string;
  technicalPass: boolean;
  wordCounts: number[] | null;
  chipNormalizePass: boolean;
  chipSafetyPass: boolean;
  bareChildGenderPass: boolean;
  powerCardPass: boolean;
  hebrewSanityPass: boolean;
  swap: string;
  freshness: string;
  craft: string;
  imageDirectionWarnPages: number[];
  loop: WritersRoomBoundedLoopReport;
}

function gatePass(loop: WritersRoomBoundedLoopReport, stage: string): boolean {
  const s = loop.stages.find((x) => x.stage === stage);
  return s?.pass ?? false;
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outRoot = path.join(SOURCE_BATCH, `revalidate-step4-1-${timestamp}`);
  fs.mkdirSync(outRoot, { recursive: true });

  const rows: RevalRow[] = [];

  for (const scenarioId of SCENARIOS) {
    const srcDir = path.join(SOURCE_BATCH, scenarioId);
    const outDir = path.join(outRoot, scenarioId);
    fs.mkdirSync(outDir, { recursive: true });

    const beforeReport = JSON.parse(
      fs.readFileSync(path.join(srcDir, 'bounded-loop-report.json'), 'utf8')
    ) as WritersRoomBoundedLoopReport;
    const beforeTerminal = beforeReport.terminal;

    let storyMarkdown = fs.readFileSync(path.join(srcDir, 'story.md'), 'utf8');
    fs.writeFileSync(path.join(outDir, 'story.before-reval.md'), storyMarkdown, 'utf8');

    if (scenarioId === 'tubi_s6_ha_sheket_bed') {
      const chipBefore = normalizePartialGenderChips(storyMarkdown);
      fs.writeFileSync(
        path.join(outDir, 'chip-normalize-preview.json'),
        JSON.stringify(chipBefore.report, null, 2),
        'utf8'
      );
      const motsafFix = chipBefore.report.fixes.find((f) => f.before.includes('מוצף/ת'));
      if (motsafFix) {
        fs.writeFileSync(
          path.join(outDir, 's6-chip-diff.txt'),
          `${motsafFix.before} → ${motsafFix.after} (${motsafFix.reason})\n`,
          'utf8'
        );
      }
    }

    if (scenarioId === 'bolly_b5_hamishpat_bed') {
      const oldStep = 'אם קשה — {חוזר|חוזרת} לקליפה, וההצצה נשארת';
      const newStep = 'אם קשה — {{childName}} {יכול|יכולה} לעצור ולנסות שוב';
      fs.writeFileSync(
        path.join(outDir, 'b5-powercard-diff.txt'),
        `OLD: ${oldStep}\nNEW: ${newStep}\n`,
        'utf8'
      );
    }

    const outline = JSON.parse(
      fs.readFileSync(path.join(srcDir, 'outline.json'), 'utf8')
    ) as StoryOutline;
    const scenario = resolveScenarioById(scenarioId);

    console.log(`[step4.1-reval] ${scenarioId} (before=${beforeTerminal})...`);
    const loop = await runWritersRoomBoundedLoop({
      storyMarkdown,
      scenario,
      outline,
      reportId: scenarioId,
      runLabel: `step4-1-reval-${scenarioId}`,
      judgeModel: MODEL,
      draftModel: MODEL,
      skipProofread: true,
      skipAdventureEnrich: true,
    });

    const imgFmt = scanImageDirectionFormat(loop.finalStoryMarkdown);

    fs.writeFileSync(path.join(outDir, 'story.final.md'), loop.finalStoryMarkdown, 'utf8');
    fs.writeFileSync(path.join(outDir, 'bounded-loop-report.json'), JSON.stringify(loop, null, 2));
    fs.writeFileSync(
      path.join(outDir, 'image-direction-format-report.json'),
      JSON.stringify(imgFmt, null, 2),
      'utf8'
    );

    rows.push({
      scenarioId,
      beforeTerminal,
      afterTerminal: loop.terminal,
      taste: loop.finalTaste.verdict,
      technicalPass: loop.technicalPass,
      wordCounts: parseWordCountLine(loop.finalStoryMarkdown),
      chipNormalizePass: gatePass(loop, 'chip-normalize'),
      chipSafetyPass: gatePass(loop, 'chip-safety'),
      bareChildGenderPass: gatePass(loop, 'bare-child-gender'),
      powerCardPass: gatePass(loop, 'powercard-sanitizer'),
      hebrewSanityPass: gatePass(loop, 'hebrew-sanity'),
      swap: `${loop.swapTest.verdict} (binding=${loop.swapTest.bindingScore})`,
      freshness: `${loop.freshnessTest.recommendation} (shapeMax=${loop.freshnessTest.shapeOverlapMax})`,
      craft: `overall=${loop.craftV21.overall} verdict=${loop.craftV21.verdict}`,
      imageDirectionWarnPages: imgFmt.malformedPages,
      loop,
    });

    console.log(
      `[step4.1-reval] ${scenarioId} → ${loop.terminal} taste=${loop.finalTaste.verdict} tech=${loop.technicalPass}`
    );
  }

  const summaryLines = [
    '# Step 4.1 Revalidation — surgical fixes, no regeneration',
    '',
    `Source batch: \`${SOURCE_BATCH}\``,
    `Revalidation root: \`${outRoot}\``,
    '',
    '## Before / after terminal',
    '',
    '| Story | Before | After | Taste | Technical |',
    '|-------|--------|-------|-------|-----------|',
    ...rows.map(
      (r) =>
        `| ${r.scenarioId} | ${r.beforeTerminal} | ${r.afterTerminal} | ${r.taste} | ${r.technicalPass ? 'PASS' : 'FAIL'} |`
    ),
    '',
    '## Gates (after)',
    '',
    '| Story | chip-norm | chip-safety | bare-gender | powerCard | hebrew | swap | freshness | craft |',
    '|-------|-----------|-------------|-------------|-----------|--------|------|-----------|-------|',
    ...rows.map(
      (r) =>
        `| ${r.scenarioId} | ${r.chipNormalizePass ? 'PASS' : 'FAIL'} | ${r.chipSafetyPass ? 'PASS' : 'FAIL'} | ${r.bareChildGenderPass ? 'PASS' : 'FAIL'} | ${r.powerCardPass ? 'PASS' : 'FAIL'} | ${r.hebrewSanityPass ? 'PASS' : 'FAIL'} | ${r.swap} | ${r.freshness} | ${r.craft} |`
    ),
    '',
    '## imageDirection WARN pages',
    ...rows.map((r) =>
      r.imageDirectionWarnPages.length
        ? `- **${r.scenarioId}**: pages ${r.imageDirectionWarnPages.join(', ')}`
        : `- **${r.scenarioId}**: (none)`
    ),
  ];

  fs.writeFileSync(path.join(outRoot, 'summary.md'), summaryLines.join('\n'), 'utf8');
  fs.writeFileSync(path.join(outRoot, 'all-results.json'), JSON.stringify(rows, null, 2), 'utf8');

  console.log(`[step4.1-reval] done → ${outRoot}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
