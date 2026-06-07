/**
 * Phase A2.1 — craft-rubric-v2 comparative ladder calibration.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-craft-calibration-v2.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { runCraftRubricTest } from '../lib/story-gen/craft-rubric-test';
import {
  evaluateV2CalibrationGate,
  extractStoryBodyFromMarkdown,
  formatV2LadderTable,
  parseMidTierAnchorSpecs,
  reportToV2CalibrationRow,
  runCraftRubricTestV2,
  type CraftRubricV2Report,
  type V2CalibrationRow,
} from '../lib/story-gen/craft-rubric-v2';
import { parseDecoySpecs } from '../lib/story-gen/craft-rubric-test';
import { DEFAULT_STORY_GEN_MODELS } from '../lib/story-gen/story-generation-types';

const STORY_BANK_DIR = path.join(
  process.cwd(),
  'story-bank',
  (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
);

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
  'bunny_ometz_adventure.md',
] as const;

const DECOYS_PATH = path.join(process.cwd(), 'outputs', 'craft-decoys', 'craft-judge-decoys.md');
const MIDTIER_PATH = path.join(process.cwd(), 'outputs', 'craft-decoys', 'craft-judge-midtier-anchors.md');
const BOLLY_PHASE_A_PATH = path.join(
  process.cwd(),
  'outputs',
  'story-gen-runs',
  '2026-06-07T10-21-49-454Z',
  'story.md'
);

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(process.cwd(), 'outputs', 'story-gen-runs', timestamp);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`[craft-v2] run → ${runDir}`);
  console.log(`[craft-v2] judgeModel=${DEFAULT_STORY_GEN_MODELS.judgeModel}`);
  console.log(`[craft-v2] anchorMode=cards (compact ladder reference, not full anchor bodies)`);

  const rows: V2CalibrationRow[] = [];
  const fullReports: Record<string, CraftRubricV2Report> = {};

  for (const filename of GOLDEN_BANK_FILES) {
    const filePath = path.join(STORY_BANK_DIR, filename);
    const markdown = fs.readFileSync(filePath, 'utf8');
    const storyBody = extractStoryBodyFromMarkdown(markdown);
    const id = filename.replace(/\.md$/, '');
    console.log(`[craft-v2] judging golden: ${id}`);
    const report = await runCraftRubricTestV2({ storyBody });
    fullReports[id] = report;
    rows.push(reportToV2CalibrationRow(id, id, 'golden', report));
  }

  const bollyMarkdown = fs.readFileSync(BOLLY_PHASE_A_PATH, 'utf8');
  const bollyBody = extractStoryBodyFromMarkdown(bollyMarkdown);
  console.log('[craft-v2] judging mid: Phase-A Bolly');
  const bollyReport = await runCraftRubricTestV2({ storyBody: bollyBody });
  fullReports['bolly_phase_a'] = bollyReport;
  rows.push(
    reportToV2CalibrationRow('bolly_phase_a', 'Phase-A Bolly adventure', 'mid', bollyReport, {
      softFailReason:
        'Good structure / quiet companion voice / adult-poetic drift / low humor / template rhythm',
    })
  );

  const midMarkdown = fs.readFileSync(MIDTIER_PATH, 'utf8');
  const midSpecs = parseMidTierAnchorSpecs(midMarkdown);
  for (const spec of midSpecs) {
    console.log(`[craft-v2] judging mid (blind): ${spec.label}`);
    const report = await runCraftRubricTestV2({ storyBody: spec.storyBody });
    fullReports[spec.id] = report;
    rows.push(
      reportToV2CalibrationRow(spec.id, spec.label, 'mid', report, {
        softFailReason: spec.expectedSoftFail,
      })
    );
  }

  const decoysMarkdown = fs.readFileSync(DECOYS_PATH, 'utf8');
  const decoySpecs = parseDecoySpecs(decoysMarkdown);
  for (const spec of decoySpecs) {
    console.log(`[craft-v2] judging decoy (blind): ${spec.label}`);
    const report = await runCraftRubricTestV2({ storyBody: spec.storyBody });
    fullReports[spec.id] = report;
    rows.push(reportToV2CalibrationRow(spec.id, spec.label, 'decoy', report));
  }

  const gate = evaluateV2CalibrationGate(rows);

  console.log('[craft-v2] v1 comparison on Phase-A Bolly...');
  const v1Bolly = await runCraftRubricTest({ storyBody: bollyBody });

  const tableMd = formatV2LadderTable(rows);

  const weakestMd = rows
    .map((r) => {
      const rep = fullReports[r.id];
      if (!rep) return '';
      const comps = rep.perDimensionComparisons
        .filter((c) => ['childDelight', 'humor', 'hebrewOrality', 'companionMemorability', 'commercialQuality'].includes(c.dimension))
        .map(
          (c) =>
            `- **${c.dimension}** (${c.score}): weakest "${c.weakestLineEvidence}" → nearest ${c.nearestAnchorBand}/${c.nearestAnchorId ?? '?'}${c.whyNotGolden ? ` — ${c.whyNotGolden}` : ''}`
        )
        .join('\n');
      return `### ${r.label}\n${comps}`;
    })
    .join('\n\n');

  const reportMd = `# Craft Rubric v2 — Comparative Ladder Calibration

**Run:** ${runDir}  
**Judge model:** ${DEFAULT_STORY_GEN_MODELS.judgeModel}  
**Prompt version:** craft-rubric-v2  
**Anchor mode:** **cards** (compact ladder — NOT full anchor bodies per judge call)  
**Goldens:** ${GOLDEN_BANK_FILES.length} · **Mid-tier:** ${1 + midSpecs.length} · **Decoys:** ${decoySpecs.length}

## Gate verdict: ${gate.pass ? 'PASS ✅' : 'FAIL ❌'}

${gate.failures.length ? gate.failures.map((f) => `- ${f}`).join('\n') : 'All pass criteria met.'}

| Metric | Value |
| --- | --- |
| Golden min overall | ${gate.goldenMin} |
| Mid max overall | ${gate.midMax} |
| Decoy max overall | ${gate.decoyMax} |
| Phase-A Bolly overall | ${gate.bollyOverall} (${gate.bollyPlacement}) |

## v1 vs v2 — Phase-A Bolly

| Version | Overall | Verdict | Placement |
| --- | ---: | --- | --- |
| v1 | ${v1Bolly.overall} | ${v1Bolly.verdict} | — |
| v2 | ${bollyReport.overall} | ${bollyReport.verdict} | ${bollyReport.ladderPlacement} |
| v2 raw (pre-cap) | ${bollyReport.rawOverall ?? bollyReport.overall} | | |

Caps applied: ${bollyReport.overallCapApplied ? JSON.stringify(bollyReport.overallCapApplied) : 'none'}

## Ladder table

${tableMd}

## Key dimension weakest-line evidence (sample)

${weakestMd}
`;

  fs.writeFileSync(
    path.join(runDir, 'craft-calibration-v2.json'),
    JSON.stringify({ gate, rows, fullReports, v1BollyComparison: v1Bolly, anchorMode: 'cards' }, null, 2),
    'utf8'
  );
  fs.writeFileSync(path.join(runDir, 'craft-calibration-v2.md'), reportMd, 'utf8');

  console.log('\n' + tableMd);
  console.log(`\n[craft-v2] gate.pass=${gate.pass}`);
  console.log(`[craft-v2] Bolly v1=${v1Bolly.overall} v2=${bollyReport.overall} placement=${bollyReport.ladderPlacement}`);
  console.log(`[craft-v2] wrote ${runDir}/craft-calibration-v2.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
