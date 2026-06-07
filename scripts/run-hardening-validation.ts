/**
 * P0 hardening validation — swap + freshness on 4 canaries + 10 goldens + proofread diffs.
 * NO new story generation. Advisory validation only.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-hardening-validation.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import {
  CANARY_RUNS,
  GOLDEN_BANK_FILES,
  loadCanaryCorpusEntries,
  loadGoldenCorpusEntries,
} from '../lib/story-gen/freshness-corpus';
import {
  runFreshnessPairwiseTest,
  runFreshnessSelfTest,
  runFreshnessTest,
} from '../lib/story-gen/freshness-test';
import { runProofreadDeterministic } from '../lib/story-gen/proofread-pass';
import { runSwapTest, runSwapTestOnDecoy } from '../lib/story-gen/swap-test';
import { DEFAULT_STORY_GEN_MODELS } from '../lib/story-gen/story-generation-types';

const MODEL = DEFAULT_STORY_GEN_MODELS.judgeModel;

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'outputs', 'hardening-validation', timestamp);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`[hardening] validation → ${outDir}`);

  const goldens = loadGoldenCorpusEntries();
  const canaries = loadCanaryCorpusEntries();
  const allStories = [...goldens, ...canaries];

  const swapResults: Array<{
    id: string;
    source: string;
    companionId: string;
    verdict: string;
    bindingScore: number;
    pass: boolean;
  }> = [];

  for (const entry of allStories) {
    console.log(`[hardening] swap: ${entry.id}`);
    const report = await runSwapTest({
      storyMarkdown: entry.storyMarkdown,
      companionId: entry.companionId,
      modelId: MODEL,
    });
    swapResults.push({
      id: entry.id,
      source: entry.source,
      companionId: entry.companionId,
      verdict: report.verdict,
      bindingScore: report.bindingScore,
      pass: report.verdict === 'pass' || report.verdict === 'weak-pass',
    });
  }

  console.log('[hardening] swap: Soft Friend decoy (expect fail)');
  const decoySwap = await runSwapTestOnDecoy({ modelId: MODEL });

  const freshnessCorpus: Array<{
    id: string;
    recommendation: string;
    shapeOverlapMax: number;
    engineOverlapMax: number;
    pass: boolean;
  }> = [];

  for (const c of canaries) {
    console.log(`[hardening] freshness corpus: ${c.id}`);
    const report = await runFreshnessTest({
      storyMarkdown: c.storyMarkdown,
      candidateId: c.id,
      companionId: c.companionId,
      modelId: MODEL,
      excludeSelfFromCorpus: true,
    });
    freshnessCorpus.push({
      id: c.id,
      recommendation: report.recommendation,
      shapeOverlapMax: report.shapeOverlapMax,
      engineOverlapMax: report.engineOverlapMax,
      pass: report.recommendation === 'pass' || report.recommendation === 'caution',
    });
  }

  const tubiS5 = canaries.find((c) => c.id === 'tubi_s5_ha_zikukim_adv')!;
  const tubiS2 = canaries.find((c) => c.id === 'tubi_s2_ha_bayit_bed')!;
  const bollyB1 = canaries.find((c) => c.id === 'bolly_b1_lahitraf_adv')!;
  const bollyB4 = canaries.find((c) => c.id === 'bolly_b4_hacheder_bed')!;

  console.log('[hardening] freshness pairwise: Tubi S5 vs S2');
  const tubiPair = await runFreshnessPairwiseTest({
    storyMarkdownA: tubiS5.storyMarkdown,
    idA: tubiS5.id,
    companionIdA: tubiS5.companionId,
    storyMarkdownB: tubiS2.storyMarkdown,
    idB: tubiS2.id,
    companionIdB: tubiS2.companionId,
    modelId: MODEL,
  });

  console.log('[hardening] freshness pairwise: Bolly B1 vs B4');
  const bollyPair = await runFreshnessPairwiseTest({
    storyMarkdownA: bollyB1.storyMarkdown,
    idA: bollyB1.id,
    companionIdA: bollyB1.companionId,
    storyMarkdownB: bollyB4.storyMarkdown,
    idB: bollyB4.id,
    companionIdB: bollyB4.companionId,
    modelId: MODEL,
  });

  console.log('[hardening] freshness self-test: B1 duplicated');
  const selfTest = await runFreshnessSelfTest({
    storyMarkdown: bollyB1.storyMarkdown,
    candidateId: bollyB1.id,
    companionId: bollyB1.companionId,
    modelId: MODEL,
  });

  const proofreadDiffs: Array<{
    id: string;
    changeCount: number;
    changes: ReturnType<typeof runProofreadDeterministic>['report']['changes'];
    hebrewBefore: number;
    hebrewAfter: number;
  }> = [];

  for (const c of canaries) {
    console.log(`[hardening] proofread deterministic: ${c.id}`);
    const { report } = runProofreadDeterministic(c.storyMarkdown);
    proofreadDiffs.push({
      id: c.id,
      changeCount: report.changeCount,
      changes: report.changes,
      hebrewBefore: report.hebrewSanityBefore,
      hebrewAfter: report.hebrewSanityAfter,
    });
  }

  const expectations = {
    swapAllCanariesPass: swapResults.filter((r) => r.source === 'canary').every((r) => r.pass),
    swapAllGoldensPass: swapResults.filter((r) => r.source === 'golden').every((r) => r.pass),
    swapDecoyFail: decoySwap.verdict === 'fail',
    freshnessCanariesNotGoldenClone: freshnessCorpus.every((r) => r.pass),
    tubiSameEngineDifferentShape:
      tubiPair.sameEngineDifferentShape ||
      (tubiPair.recommendation === 'pass' || tubiPair.recommendation === 'caution') &&
        tubiPair.shapeOverlapMax <= 2,
    bollySameEngineDifferentShape:
      bollyPair.sameEngineDifferentShape ||
      (bollyPair.recommendation === 'pass' || bollyPair.recommendation === 'caution') &&
        bollyPair.shapeOverlapMax <= 2,
    selfTestDetectsDuplication: selfTest.shapeOverlapMax >= 3 || selfTest.recommendation === 'reroll',
    proofreadS2Fixes: proofreadDiffs.find((p) => p.id === 'tubi_s2_ha_bayit_bed')!.changeCount > 0,
    proofreadB1Fixes: proofreadDiffs.find((p) => p.id === 'bolly_b1_lahitraf_adv')!.changeCount > 0,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    model: MODEL,
    corpusCounts: { goldens: goldens.length, canaries: canaries.length },
    swapResults,
    decoySwap: {
      verdict: decoySwap.verdict,
      bindingScore: decoySwap.bindingScore,
      summary: decoySwap.summary,
    },
    freshnessCorpus,
    pairwise: {
      tubiS5vsS2: {
        recommendation: tubiPair.recommendation,
        shapeOverlapMax: tubiPair.shapeOverlapMax,
        engineOverlapMax: tubiPair.engineOverlapMax,
        sameEngineDifferentShape: tubiPair.sameEngineDifferentShape,
        summary: tubiPair.summary,
        dimensions: tubiPair.dimensions,
      },
      bollyB1vsB4: {
        recommendation: bollyPair.recommendation,
        shapeOverlapMax: bollyPair.shapeOverlapMax,
        engineOverlapMax: bollyPair.engineOverlapMax,
        sameEngineDifferentShape: bollyPair.sameEngineDifferentShape,
        summary: bollyPair.summary,
        dimensions: bollyPair.dimensions,
      },
    },
    selfTest: {
      recommendation: selfTest.recommendation,
      shapeOverlapMax: selfTest.shapeOverlapMax,
      summary: selfTest.summary,
    },
    proofreadDiffs,
    expectations,
    allExpectationsMet: Object.values(expectations).every(Boolean),
  };

  fs.writeFileSync(path.join(outDir, 'hardening-report.json'), JSON.stringify(report, null, 2), 'utf8');

  const md = [
    '# P0 Hardening Validation Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Model: ${MODEL}`,
    '',
    '## Expectations',
    ...Object.entries(expectations).map(
      ([k, v]) => `- ${k}: **${v ? 'PASS' : 'FAIL'}**`
    ),
    '',
    `**Overall:** ${report.allExpectationsMet ? 'PASS' : 'NEEDS REVIEW'}`,
    '',
    '## Tubi S5 vs S2 (same engine, different shape)',
    `- recommendation: ${tubiPair.recommendation}`,
    `- shapeOverlapMax: ${tubiPair.shapeOverlapMax} (effective)`,
    `- engineOverlapMax: ${tubiPair.engineOverlapMax} (raw)`,
    `- sameEngineDifferentShape flag: ${tubiPair.sameEngineDifferentShape}`,
    '',
    '## Bolly B1 vs B4',
    `- recommendation: ${bollyPair.recommendation}`,
    `- shapeOverlapMax: ${bollyPair.shapeOverlapMax}`,
    `- engineOverlapMax: ${bollyPair.engineOverlapMax}`,
    '',
    '## Proofread (deterministic) — canaries',
    ...proofreadDiffs.map(
      (p) =>
        `### ${p.id}\n- changes: ${p.changeCount}\n- hebrew sanity ${p.hebrewBefore}→${p.hebrewAfter}\n${p.changes.map((c) => `  - p${c.page} [${c.reason}]: \`${c.before.slice(0, 40)}…\` → \`${c.after.slice(0, 40)}…\``).join('\n')}`
    ),
    '',
    '## Swap decoy',
    `- Soft Friend verdict: **${decoySwap.verdict}** (${decoySwap.bindingScore})`,
  ].join('\n');

  fs.writeFileSync(path.join(outDir, 'hardening-report.md'), md, 'utf8');

  console.log(`[hardening] Overall: ${report.allExpectationsMet ? 'PASS' : 'NEEDS REVIEW'}`);
  console.log(`[hardening] Wrote ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
