/**
 * Phase A2 — craft rubric blind calibration (goldens + decoys).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-craft-calibration.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import {
  compareDecoyToExpectations,
  extractGoldenStoryBody,
  formatCalibrationTableMarkdown,
  parseDecoySpecs,
  reportToCalibrationRow,
  runCraftRubricTest,
  type CalibrationRow,
  type CraftRubricReport,
  type DecoyCalibrationMatch,
} from '../lib/story-gen/craft-rubric-test';
import { DEFAULT_STORY_GEN_MODELS } from '../lib/story-gen/story-generation-types';

const STORY_BANK_DIR = path.join(
  process.cwd(),
  'story-bank',
  (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
);

/** Editorial golden bank files (v5-literary-golden tag). Read-only. */
const GOLDEN_BANK_FILES = [
  'fox_uri_bedtime.md',
  'fawn_tzvi_bedtime.md',
  'song_whale_bedtime.md',
  'panda_anat_adventure.md',
  'chameleon_koko_adventure.md',
  'lion_shaket_adventure.md',
  'dragon_dini_fantasy.md',
  'dolphin_shahkan_fantasy.md',
  'bolly_armadillo_fantasy.md',
] as const;

const DECOYS_PATH = path.join(process.cwd(), 'outputs', 'craft-decoys', 'craft-judge-decoys.md');

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(process.cwd(), 'outputs', 'story-gen-runs', timestamp);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`[craft-calibration] run → ${runDir}`);
  console.log(`[craft-calibration] judgeModel=${DEFAULT_STORY_GEN_MODELS.judgeModel}`);

  const rows: CalibrationRow[] = [];
  const fullReports: Record<string, CraftRubricReport> = {};
  const decoyMatches: DecoyCalibrationMatch[] = [];

  for (const filename of GOLDEN_BANK_FILES) {
    const filePath = path.join(STORY_BANK_DIR, filename);
    const markdown = fs.readFileSync(filePath, 'utf8');
    const storyBody = extractGoldenStoryBody(markdown);
    const id = filename.replace(/\.md$/, '');
    const label = id;

    console.log(`[craft-calibration] judging golden: ${label}`);
    const report = await runCraftRubricTest({ storyBody });
    fullReports[id] = report;
    rows.push(reportToCalibrationRow(id, label, 'golden', report));
  }

  const decoysMarkdown = fs.readFileSync(DECOYS_PATH, 'utf8');
  const decoySpecs = parseDecoySpecs(decoysMarkdown);

  for (const spec of decoySpecs) {
    console.log(`[craft-calibration] judging decoy (blind): ${spec.label}`);
    const report = await runCraftRubricTest({ storyBody: spec.storyBody });
    fullReports[spec.id] = report;
    rows.push(reportToCalibrationRow(spec.id, spec.label, 'decoy', report));
    decoyMatches.push(compareDecoyToExpectations(spec, report));
  }

  const goldenRows = rows.filter((r) => r.kind === 'golden');
  const decoyRows = rows.filter((r) => r.kind === 'decoy');
  const goldenMin = Math.min(...goldenRows.map((r) => r.overall));
  const goldenMax = Math.max(...goldenRows.map((r) => r.overall));
  const goldenAvg = goldenRows.reduce((s, r) => s + r.overall, 0) / goldenRows.length;
  const decoyMax = Math.max(...decoyRows.map((r) => r.overall));

  const separationGap = goldenMin - decoyMax;
  const allDecoysBelowGoldens = decoyMax < goldenMin;
  const allDecoyDimensionMatch = decoyMatches.every((m) => m.dimensionMatchRate >= 0.67);
  const allDecoyHardFailMatch = decoyMatches.every((m) => m.hardFailMatchRate >= 0.67);

  const summary = {
    promptVersion: fullReports[Object.keys(fullReports)[0] ?? '']?.promptVersion,
    judgeModel: DEFAULT_STORY_GEN_MODELS.judgeModel,
    goldenCount: goldenRows.length,
    decoyCount: decoyRows.length,
    goldenOverall: { min: goldenMin, max: goldenMax, avg: Math.round(goldenAvg * 10) / 10 },
    decoyOverall: { max: decoyMax, scores: decoyRows.map((r) => ({ label: r.label, overall: r.overall })) },
    separationGap,
    allDecoysBelowGoldens,
    allDecoyDimensionMatch,
    allDecoyHardFailMatch,
    decoyMatches,
    calibrationPass: allDecoysBelowGoldens && allDecoyDimensionMatch && allDecoyHardFailMatch,
  };

  const tableMd = formatCalibrationTableMarkdown(rows);
  const decoyAnalysisMd = decoyMatches
    .map((m) => {
      return `### ${m.label}
- Overall separation: ${rows.find((r) => r.id === m.decoyId)?.overall}
- Expected low dims: ${m.expectedLowDimensions.join(', ') || '—'}
- Flagged dims: ${m.flaggedDimensions.join(', ') || '—'}
- Dim hits: ${m.dimensionHits.join(', ') || '—'} | misses: ${m.dimensionMisses.join(', ') || '—'} (${Math.round(m.dimensionMatchRate * 100)}%)
- Expected hard-fails: ${m.expectedHardFails.join(', ') || '—'}
- Triggered hard-fails: ${m.triggeredHardFails.join(', ') || '—'}
- Hard-fail hits: ${m.hardFailHits.join(', ') || '—'} | misses: ${m.hardFailMisses.join(', ') || '—'} (${Math.round(m.hardFailMatchRate * 100)}%)
- Decoy calibration pass: ${m.pass ? 'YES' : 'NO'}`;
    })
    .join('\n\n');

  const reportMd = `# Craft Rubric Calibration — Phase A2

**Run:** ${runDir}  
**Judge model:** ${DEFAULT_STORY_GEN_MODELS.judgeModel}  
**Prompt version:** craft-rubric-v1  
**Goldens:** ${goldenRows.length} (v5-literary-golden bank files)  
**Decoys:** ${decoyRows.length} (blind — story body only)

## Separation summary

| Metric | Value |
| --- | --- |
| Golden overall (min / max / avg) | ${goldenMin} / ${goldenMax} / ${summary.goldenOverall.avg} |
| Decoy overall (max) | ${decoyMax} |
| Gap (golden min − decoy max) | ${separationGap} |
| All decoys below all goldens? | ${allDecoysBelowGoldens ? 'YES' : 'NO'} |
| Decoy dimension match ≥67% each? | ${allDecoyDimensionMatch ? 'YES' : 'NO'} |
| Decoy hard-fail match ≥67% each? | ${allDecoyHardFailMatch ? 'YES' : 'NO'} |
| **Calibration pass** | **${summary.calibrationPass ? 'YES' : 'NO'}** |

## Calibration table

${tableMd}

## Decoy failure-mode analysis

${decoyAnalysisMd}
`;

  fs.writeFileSync(path.join(runDir, 'craft-calibration.json'), JSON.stringify({ summary, rows, fullReports }, null, 2), 'utf8');
  fs.writeFileSync(path.join(runDir, 'craft-calibration.md'), reportMd, 'utf8');

  console.log('\n' + tableMd);
  console.log('\n[craft-calibration] calibrationPass=' + summary.calibrationPass);
  console.log(`[craft-calibration] wrote ${runDir}/craft-calibration.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
