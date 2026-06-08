/**
 * Step 4 — stability batch: 4 untouched scenarios through full Writer's Room loop.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-stability-batch-step4.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { scanBareChildGender } from '../lib/story-gen/bare-child-gender';
import { normalizePartialGenderChips } from '../lib/story-gen/chip-normalize';
import { scanChipSafety } from '../lib/story-gen/chip-safety';
import { describeTasteDelta } from '../lib/story-gen/probe-loop-fixtures';
import { generateStoryFromScenario } from '../lib/story-gen/generate-story';
import { scanHebrewSanity } from '../lib/story-gen/hebrew-sanity';
import { sanitizePowerCardMetadata } from '../lib/story-gen/powercard-metadata-sanitizer';
import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import { parseWordCountLine } from '../lib/story-gen/story-page-utils';
import type { StoryGenModelConfig } from '../lib/story-gen/story-generation-types';
import {
  runWritersRoomBoundedLoop,
  type WritersRoomBoundedLoopReport,
} from '../lib/story-gen/writers-room-bounded-loop';

const MODEL = 'gpt-5-chat-latest';
const BATCH_ROOT = path.join(
  process.cwd(),
  'outputs',
  'writers-room-canary',
  `stability-batch-step4-${new Date().toISOString().replace(/[:.]/g, '-')}`
);

const SCENARIOS = [
  {
    id: 'tubi_s4_ha_raam_bed',
    companion: 'baby_elephant',
    direction: 'bedtime',
    purpose: 'whale-proximity / thunder — no noise→song drift',
  },
  {
    id: 'tubi_s6_ha_sheket_bed',
    companion: 'baby_elephant',
    direction: 'bedtime',
    purpose: 'quiet broken by one sound — inversion test',
  },
  {
    id: 'bolly_b2_hamila_adv',
    companion: 'bolly_armadillo',
    direction: 'adventure',
    purpose: 'public voice exposure — no generic courage',
  },
  {
    id: 'bolly_b5_hamishpat_bed',
    companion: 'bolly_armadillo',
    direction: 'bedtime',
    purpose: 'private honest sentence — not B4 room shape',
  },
] as const;

interface StoryRunResult {
  scenarioId: string;
  runDir: string;
  loop: WritersRoomBoundedLoopReport;
  chipNorm: ReturnType<typeof normalizePartialGenderChips>['report'];
  chipSafety: ReturnType<typeof scanChipSafety>;
  bareChildGender: ReturnType<typeof scanBareChildGender>;
  hebrewSanity: ReturnType<typeof scanHebrewSanity>;
  powerCardSanitizer: ReturnType<typeof sanitizePowerCardMetadata>['report'];
  wordCounts: number[] | null;
  chipGenderFailed: boolean;
}

function freshnessWatchlist(scenarioId: string): string[] {
  if (scenarioId.startsWith('tubi_')) {
    return [
      'tubi_s1_ha_yarid_adv',
      'tubi_s2_ha_bayit_bed',
      'tubi_s5_ha_zikukim_adv',
      'song_whale_bedtime',
    ];
  }
  return ['bolly_b1_lahitraf_adv', 'bolly_b4_hacheder_bed', 'bunny_ometz_adventure'];
}

function freshnessLines(report: WritersRoomBoundedLoopReport, watch: string[]): string[] {
  const dims = report.freshnessTest.dimensions ?? [];
  const lines: string[] = [];
  for (const id of watch) {
    const hits = dims.filter(
      (d) => d.nearestMatchId === id || d.nearestMatchId.includes(id)
    );
    if (hits.length) {
      lines.push(
        `- **${id}**: ${hits.map((h) => `${h.dimensionId}=${h.overlapScore} (${h.recommendation})`).join('; ')}`
      );
    }
  }
  const top = dims
    .filter((d) => watch.some((w) => d.nearestMatchId.includes(w.split('_')[0])))
    .sort((a, b) => b.effectiveScore - a.effectiveScore)
    .slice(0, 4);
  if (!lines.length && top.length) {
    for (const d of top) {
      lines.push(
        `- ${d.dimensionId}: nearest=${d.nearestMatchId} overlap=${d.overlapScore} effective=${d.effectiveScore}`
      );
    }
  }
  return lines.length ? lines : ['- (no strong nearest matches in watchlist)'];
}

function chipGenderFailed(
  loop: WritersRoomBoundedLoopReport,
  chipNorm: StoryRunResult['chipNorm'],
  chipSafety: StoryRunResult['chipSafety'],
  bare: StoryRunResult['bareChildGender']
): boolean {
  if (chipNorm.advisoryFail || chipSafety.advisoryFail || bare.advisoryFail) return true;
  return loop.technicalFailures.some(
    (f) =>
      f.startsWith('CHIP_') ||
      f.startsWith('BARE_CHILD_GENDER') ||
      f.includes('slash_gender') ||
      f.includes('remaining_slash_gender')
  );
}

async function runOne(spec: (typeof SCENARIOS)[number]): Promise<StoryRunResult> {
  const scenario = resolveScenarioById(spec.id);
  const modelConfig: StoryGenModelConfig = {
    draftModel: MODEL,
    judgeModel: MODEL,
    revisionModel: MODEL,
  };
  const runDir = path.join(BATCH_ROOT, spec.id);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`[step4] generating ${spec.id}...`);
  const draft = await generateStoryFromScenario({ scenario, modelConfig });
  fs.writeFileSync(path.join(runDir, 'outline.json'), JSON.stringify(draft.outline, null, 2));
  fs.writeFileSync(path.join(runDir, 'story.draft.md'), draft.storyMarkdown, 'utf8');

  console.log(`[step4] bounded loop ${spec.id}...`);
  const loop = await runWritersRoomBoundedLoop({
    storyMarkdown: draft.storyMarkdown,
    scenario,
    outline: draft.outline,
    reportId: spec.id,
    runLabel: `step4-${spec.id}`,
    judgeModel: MODEL,
    draftModel: MODEL,
  });

  fs.writeFileSync(path.join(runDir, 'story.final.md'), loop.finalStoryMarkdown, 'utf8');
  fs.writeFileSync(path.join(runDir, 'story.md'), loop.finalStoryMarkdown, 'utf8');
  fs.writeFileSync(path.join(runDir, 'bounded-loop-report.json'), JSON.stringify(loop, null, 2));

  if (loop.authorRewriteUsed) {
    fs.writeFileSync(path.join(runDir, 'story.before-rewrite.md'), draft.storyMarkdown, 'utf8');
    fs.writeFileSync(path.join(runDir, 'story.after-rewrite.md'), loop.finalStoryMarkdown, 'utf8');
  }

  const chipNormResult = normalizePartialGenderChips(loop.finalStoryMarkdown);
  const chipSafety = scanChipSafety(chipNormResult.markdown);
  const bareChildGender = scanBareChildGender(chipNormResult.markdown);
  const hebrewSanity = scanHebrewSanity(chipNormResult.markdown);
  const powerCard = sanitizePowerCardMetadata({
    storyMarkdown: chipNormResult.markdown,
    companionId: scenario.companionId,
  });

  fs.writeFileSync(
    path.join(runDir, 'chip-normalize-report.json'),
    JSON.stringify(chipNormResult.report, null, 2)
  );
  fs.writeFileSync(path.join(runDir, 'chip-safety-report.json'), JSON.stringify(chipSafety, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'bare-child-gender-report.json'),
    JSON.stringify(bareChildGender, null, 2)
  );
  fs.writeFileSync(
    path.join(runDir, 'hebrew-sanity-report.json'),
    JSON.stringify(hebrewSanity, null, 2)
  );
  fs.writeFileSync(
    path.join(runDir, 'powercard-sanitizer-report.json'),
    JSON.stringify(powerCard.report, null, 2)
  );

  const wordCounts = parseWordCountLine(loop.finalStoryMarkdown);

  const failed = chipGenderFailed(loop, chipNormResult.report, chipSafety, bareChildGender);

  console.log(
    `[step4] ${spec.id} → terminal=${loop.terminal} taste=${loop.finalTaste.verdict} tech=${loop.technicalPass} chipGenderFail=${failed}`
  );

  return {
    scenarioId: spec.id,
    runDir,
    loop,
    chipNorm: chipNormResult.report,
    chipSafety,
    bareChildGender,
    hebrewSanity,
    powerCardSanitizer: powerCard.report,
    wordCounts,
    chipGenderFailed: failed,
  };
}

function storySection(r: StoryRunResult, spec: (typeof SCENARIOS)[number]): string[] {
  const t = r.loop.finalTaste;
  const lines = [
    `## ${r.scenarioId}`,
    '',
    `**Purpose:** ${spec.purpose}`,
    `**Run folder:** \`${r.runDir}\``,
    `**Final story:** \`${path.join(r.runDir, 'story.md')}\``,
    '',
    `- **Terminal:** ${r.loop.terminal}`,
    `- **Author rewrite:** ${r.loop.authorRewriteUsed ? 'yes' : 'no'}`,
    `- **Technical:** ${r.loop.technicalPass ? 'PASS' : 'FAIL'}`,
    `- **Word counts:** ${r.wordCounts ? `${r.wordCounts.join(', ')} (total ${r.wordCounts.reduce((a, b) => a + b, 0)})` : 'n/a'}`,
    '',
    '### Gates',
    `- chip-normalize: fixes=${r.chipNorm.fixCount} regular=${r.chipNorm.convertedRegularCount} exception=${r.chipNorm.convertedExceptionCount} unrepaired=${r.chipNorm.unrepaired.length}`,
    `- chip-safety: ${r.chipSafety.advisoryFail ? 'FAIL' : 'PASS'} (${r.chipSafety.hitCount} hits)`,
    `- bare-child-gender: ${r.bareChildGender.advisoryFail ? 'FAIL' : 'PASS'} (${r.bareChildGender.failHits.length} fail)`,
    `- hebrew-sanity: ${r.hebrewSanity.advisoryFail ? 'FAIL' : 'PASS'} (${r.hebrewSanity.hitCount} hits)`,
    `- powerCard sanitizer: ${r.powerCardSanitizer.advisoryFail ? 'FAIL' : 'PASS'}`,
    `- swap: ${r.loop.swapTest.verdict} (${r.loop.swapTest.bindingScore}) — ${r.loop.swapTest.requiredCompanionSignals.join(' · ')}`,
    `- freshness: ${r.loop.freshnessTest.recommendation} shapeMax=${r.loop.freshnessTest.shapeOverlapMax}`,
    `- craft: ${r.loop.craftV21.overall} ${r.loop.craftV21.ladderPlacement} ${r.loop.craftV21.verdict}`,
    '',
    '### Freshness watchlist',
    ...freshnessLines(r.loop, freshnessWatchlist(r.scenarioId)),
    '',
    '### Taste',
    `- **Verdict:** ${t.verdict} (${t.confidence})`,
    t.quotableLines?.length
      ? `- **Quotable:** ${t.quotableLines.map((q) => `"${q}"`).join(' · ')}`
      : '- **Quotable:** —',
    `- **Weakest:** p${t.weakestPage.page} — "${t.weakestLine}"`,
  ];

  if (!r.loop.technicalPass) {
    lines.push('', '### Technical failures', ...r.loop.technicalFailures.map((f) => `- ${f}`));
  }
  if (r.chipNorm.unrepaired.length) {
    lines.push('', '### Unrepaired chips', ...r.chipNorm.unrepaired.map((u) => `- p${u.page}: ${u.token}`));
  }

  if (r.loop.authorRewriteUsed && r.loop.tasteBefore && r.loop.tasteAfter) {
    const delta = describeTasteDelta(r.loop.tasteBefore, r.loop.tasteAfter);
    lines.push(
      '',
      '### Rewrite',
      `- taste: ${r.loop.tasteBefore.verdict} → ${r.loop.tasteAfter.verdict} (${delta})`,
      `- preservation: ${r.loop.preservation?.verdict ?? 'n/a'}`,
      `- codes: ${r.loop.preservation?.failureCodes.join(', ') || 'none'}`,
    );
    if (r.loop.preservation?.reasons.length) {
      lines.push(...r.loop.preservation.reasons.slice(0, 3).map((x) => `  - ${x}`));
    }
  }

  lines.push('', '<details><summary>Full story.md</summary>', '', '```markdown');
  lines.push(fs.readFileSync(path.join(r.runDir, 'story.md'), 'utf8'));
  lines.push('```', '', '</details>', '');
  return lines;
}

async function main(): Promise<void> {
  fs.mkdirSync(BATCH_ROOT, { recursive: true });
  console.log(`[step4] batch root → ${BATCH_ROOT}`);

  const results: StoryRunResult[] = [];
  let chipGenderFailCount = 0;
  let aborted = false;

  for (const spec of SCENARIOS) {
    const result = await runOne(spec);
    results.push(result);
    if (result.chipGenderFailed) {
      chipGenderFailCount++;
      if (chipGenderFailCount > 1) {
        aborted = true;
        console.error('[step4] ABORT: more than one chip/gender failure — stopping batch.');
        break;
      }
    }
  }

  const terminals = {
    bank_ready_candidate: 0,
    strong_draft_needs_light_human_polish: 0,
    post_rewrite_bank_ready_candidate_needs_human_review: 0,
    needs_human_review: 0,
    needs_human_review_or_reroll: 0,
  };
  for (const r of results) {
    const t = r.loop.terminal;
    if (t in terminals) terminals[t as keyof typeof terminals]++;
  }

  const anyRewrite = results.some((r) => r.loop.authorRewriteUsed);
  const tableHeader =
    '| story | direction | terminal | taste | swap | freshness | tech | rewrite? | preservation |';
  const tableSep =
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |';
  const tableRows = results.map((r) => {
    const pres = r.loop.authorRewriteUsed
      ? (r.loop.preservation?.verdict ?? 'n/a')
      : '—';
    return `| ${r.scenarioId} | ${r.loop.direction} | ${r.loop.terminal} | ${r.loop.finalTaste.verdict} | ${r.loop.swapTest.verdict} | ${r.loop.freshnessTest.recommendation} | ${r.loop.technicalPass ? 'PASS' : 'FAIL'} | ${r.loop.authorRewriteUsed ? 'yes' : 'no'} | ${pres} |`;
  });

  const report = [
    '# Step 4 — Stability Batch (4 scenarios)',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Model: ${MODEL}`,
    `Batch root: \`${BATCH_ROOT}\``,
    `Abort rule triggered: **${aborted ? 'YES' : 'NO'}** (chip/gender failures: ${chipGenderFailCount})`,
    '',
    '## Summary table',
    '',
    tableHeader,
    tableSep,
    ...tableRows,
    '',
    '## Terminal counts',
    `- bank_ready_candidate: ${terminals.bank_ready_candidate}`,
    `- strong_draft_needs_light_human_polish: ${terminals.strong_draft_needs_light_human_polish}`,
    `- post_rewrite_bank_ready_candidate_needs_human_review: ${terminals.post_rewrite_bank_ready_candidate_needs_human_review}`,
    `- needs_human_review: ${terminals.needs_human_review}`,
    `- needs_human_review_or_reroll: ${terminals.needs_human_review_or_reroll}`,
    `- chip/gender failures: ${chipGenderFailCount}`,
    '',
    anyRewrite
      ? '## Rewrite utility'
      : '## Rewrite utility',
    anyRewrite
      ? results
          .filter((r) => r.loop.authorRewriteUsed)
          .map(
            (r) =>
              `- ${r.scenarioId}: ${r.loop.tasteBefore?.verdict}→${r.loop.finalTaste.verdict}, preservation=${r.loop.preservation?.verdict}`
          )
          .join('\n')
      : 'Rewrite utility still untested on matched fresh generation.',
    '',
    ...results.flatMap((r) => {
      const spec = SCENARIOS.find((s) => s.id === r.scenarioId)!;
      return storySection(r, spec);
    }),
    '**HARD STOP** — Step 4 complete.',
  ];

  fs.writeFileSync(path.join(BATCH_ROOT, 'summary.md'), report.join('\n'), 'utf8');
  fs.writeFileSync(
    path.join(BATCH_ROOT, 'all-results.json'),
    JSON.stringify(
      results.map((r) => ({
        scenarioId: r.scenarioId,
        runDir: r.runDir,
        terminal: r.loop.terminal,
        taste: r.loop.finalTaste.verdict,
        chipGenderFailed: r.chipGenderFailed,
        loop: r.loop,
        chipNorm: r.chipNorm,
      })),
      null,
      2
    ),
    'utf8'
  );

  console.log('\n' + tableHeader);
  console.log(tableSep);
  for (const row of tableRows) console.log(row);
  console.log(`\n[step4] Wrote ${BATCH_ROOT}/summary.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
