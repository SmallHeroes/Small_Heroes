/**
 * Phase A2.2 — craft-rubric-v2.1 quality-anchored engine-blind calibration + 3 diagnostic tests.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-craft-calibration-v2.1.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { parseDecoySpecs } from '../lib/story-gen/craft-rubric-test';
import { V2_ANCHOR_CARDS, runCraftRubricTestV2 } from '../lib/story-gen/craft-rubric-v2';
import {
  auditAnchorCardsCompanionFree,
  evaluateV21Gate,
  extractStoryBodyFromMarkdown,
  formatV21LadderTable,
  parseMidTierAnchorSpecs,
  reportToV21Row,
  runCraftPairwiseComparison,
  runCraftRubricTestV21,
  type CraftRubricV21Report,
  type V21CalibrationRow,
} from '../lib/story-gen/craft-rubric-v2.1';
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

  console.log(`[craft-v2.1] run → ${runDir}`);
  console.log(`[craft-v2.1] judgeModel=${DEFAULT_STORY_GEN_MODELS.judgeModel}`);

  const cardAudit = auditAnchorCardsCompanionFree();
  console.log(`[craft-v2.1] anchor card audit: ${cardAudit.pass ? 'PASS (zero companion/device nouns)' : 'FAIL'}`);

  const rows: V21CalibrationRow[] = [];
  const fullReports: Record<string, CraftRubricV21Report> = {};

  for (const filename of GOLDEN_BANK_FILES) {
    const filePath = path.join(STORY_BANK_DIR, filename);
    const storyBody = extractStoryBodyFromMarkdown(fs.readFileSync(filePath, 'utf8'));
    const id = filename.replace(/\.md$/, '');
    console.log(`[craft-v2.1] judging golden: ${id}`);
    const report = await runCraftRubricTestV21({ storyBody });
    fullReports[id] = report;
    rows.push(reportToV21Row(id, id, 'golden', report));
  }

  const bollyPhaseABody = extractStoryBodyFromMarkdown(fs.readFileSync(BOLLY_PHASE_A_PATH, 'utf8'));
  const bollyGoldenBody = extractStoryBodyFromMarkdown(
    fs.readFileSync(path.join(STORY_BANK_DIR, 'bolly_armadillo_fantasy.md'), 'utf8')
  );

  console.log('[craft-v2.1] judging mid: Phase-A Bolly');
  const phaseAReport = await runCraftRubricTestV21({ storyBody: bollyPhaseABody });
  fullReports['bolly_phase_a'] = phaseAReport;
  rows.push(reportToV21Row('bolly_phase_a', 'Phase-A Bolly adventure', 'mid', phaseAReport));

  const midSpecs = parseMidTierAnchorSpecs(fs.readFileSync(MIDTIER_PATH, 'utf8'));
  for (const spec of midSpecs) {
    console.log(`[craft-v2.1] judging mid (blind): ${spec.label}`);
    const report = await runCraftRubricTestV21({ storyBody: spec.storyBody });
    fullReports[spec.id] = report;
    rows.push(reportToV21Row(spec.id, spec.label, 'mid', report));
  }

  for (const spec of parseDecoySpecs(fs.readFileSync(DECOYS_PATH, 'utf8'))) {
    console.log(`[craft-v2.1] judging decoy (blind): ${spec.label}`);
    const report = await runCraftRubricTestV21({ storyBody: spec.storyBody });
    fullReports[spec.id] = report;
    rows.push(reportToV21Row(spec.id, spec.label, 'decoy', report));
  }

  const bollyGoldenReport = fullReports['bolly_armadillo_fantasy']!;

  // --- Test A: v2 without mid_bolly_phase_a card ---
  console.log('[craft-v2.1] Test A — v2 without mid_bolly_phase_a card');
  const v2CardsNoBollyMid = V2_ANCHOR_CARDS.filter((c) => c.id !== 'mid_bolly_phase_a');
  const testA_v2_bollyGolden = await runCraftRubricTestV2({
    storyBody: bollyGoldenBody,
    anchorCards: v2CardsNoBollyMid,
  });
  const testA_v2_phaseA = await runCraftRubricTestV2({
    storyBody: bollyPhaseABody,
    anchorCards: v2CardsNoBollyMid,
  });

  // --- Test B: masked scoring + masked pairwise ---
  console.log('[craft-v2.1] Test B — masked scoring + masked pairwise');
  const testB_maskedGolden = await runCraftRubricTestV21({
    storyBody: bollyGoldenBody,
    maskEngine: true,
  });
  const testB_maskedPhaseA = await runCraftRubricTestV21({
    storyBody: bollyPhaseABody,
    maskEngine: true,
  });
  const testB_pairwise = await runCraftPairwiseComparison({
    storyA: bollyGoldenBody,
    storyB: bollyPhaseABody,
    labelA: 'bolly_armadillo_fantasy (golden)',
    labelB: 'Phase-A Bolly (mid)',
    masked: true,
  });

  // --- Test C: pairwise ignoring engine vocab ---
  console.log('[craft-v2.1] Test C — pairwise (engine ignored)');
  const testC_pairwise = await runCraftPairwiseComparison({
    storyA: bollyGoldenBody,
    storyB: bollyPhaseABody,
    labelA: 'bolly_armadillo_fantasy (golden)',
    labelB: 'Phase-A Bolly (mid)',
    ignoreEngineInstruction: true,
  });

  const gate = evaluateV21Gate({
    rows,
    bollyGoldenReport,
    phaseAReport,
    testBPairwise: testB_pairwise,
    testBMaskedGoldenOverall: testB_maskedGolden.overall,
    testBMaskedPhaseAOverall: testB_maskedPhaseA.overall,
    testCPairwise: testC_pairwise,
    v2BollyGoldenOverall: 7.6,
  });

  const tableMd = formatV21LadderTable(rows);

  const reportMd = `# Craft Rubric v2.1 — Quality-Anchored Engine-Blind Calibration

**Run:** ${runDir}  
**Judge model:** ${DEFAULT_STORY_GEN_MODELS.judgeModel}  
**Prompt version:** craft-rubric-v2.1  
**Anchor mode:** quality-only cards (NO companion/device nouns)  
**Card audit:** ${cardAudit.pass ? 'PASS ✅' : `FAIL ❌ ${cardAudit.violations.join('; ')}`}

## Gate verdict: ${gate.pass ? 'PASS ✅' : 'FAIL ❌'}

${gate.failures.length ? '### Failures\n' + gate.failures.map((f) => `- ${f}`).join('\n') : 'All gate criteria met.'}
${gate.warnings.length ? '\n### Warnings\n' + gate.warnings.map((w) => `- ${w}`).join('\n') : ''}
${gate.bollyContentLiftRequired ? '\n**Note:** Judge may be improved, but **Bolly content lift is still required before using Bolly as a scaling anchor**.' : ''}

| Metric | Value |
| --- | --- |
| Bolly golden overall | ${gate.bollyGoldenOverall} (${gate.bollyGoldenPlacement}) |
| Phase-A Bolly overall | ${gate.bollyPhaseAOverall} |
| Gap (golden − Phase-A) | ${gate.gap?.toFixed(1)} |
| Test B pass | ${gate.testBPass ? 'YES' : 'NO'} |
| Test C pass | ${gate.testCPass ? 'YES' : 'NO'} |

## v2 → v2.1 Bolly golden

| Version | Overall | Placement |
| --- | ---: | --- |
| v2 (prior run) | 7.6 | competent-not-golden |
| v2.1 | ${bollyGoldenReport.overall} | ${bollyGoldenReport.ladderPlacement} |

Positive evidence quotes (Bolly golden): ${bollyGoldenReport.positiveEvidenceQuotes.map((q) => `"${q}"`).join('; ') || 'none'}

## Test A — remove mid_bolly_phase_a card (v2 unchanged)

| Story | v2 with card (prior) | v2 WITHOUT mid_bolly card |
| --- | ---: | ---: |
| bolly_armadillo_fantasy | 7.6 | **${testA_v2_bollyGolden.overall}** (${testA_v2_bollyGolden.ladderPlacement}) |
| Phase-A Bolly | 7.1 | **${testA_v2_phaseA.overall}** (${testA_v2_phaseA.ladderPlacement}) |

**Interpretation:** ${
    testA_v2_bollyGolden.overall >= 8.7 && testA_v2_phaseA.overall <= 7.5
      ? 'Bolly golden jumps while Phase-A stays ~7 → confirms mid_bolly card contamination in v2.'
      : testA_v2_bollyGolden.overall >= 8.0 && testA_v2_phaseA.overall >= 8.0
        ? 'BOTH jump → v2 leaned on anchor, not quality.'
        : 'Bolly golden stays low → content may genuinely be weaker (or contamination was not the only issue).'
  }

## Test B — masked engine vocabulary (decisive)

| Story | Masked overall | Placement |
| --- | ---: | --- |
| bolly_armadillo_fantasy | ${testB_maskedGolden.overall} | ${testB_maskedGolden.ladderPlacement} |
| Phase-A Bolly | ${testB_maskedPhaseA.overall} | ${testB_maskedPhaseA.ladderPlacement} |
| Gap | ${(testB_maskedGolden.overall - testB_maskedPhaseA.overall).toFixed(1)} | |

**Masked pairwise winner:** ${testB_pairwise.winnerLabel}  
**Explanation:** ${testB_pairwise.explanation}  
**Prose craft reasons:** ${testB_pairwise.proseCraftReasons.join(', ')}  
**Engine mentioned in explanation:** ${testB_pairwise.engineMentioned ? 'YES ⚠️' : 'NO ✅'}

## Test C — pairwise (ignore shared engine vocab)

**Winner:** ${testC_pairwise.winnerLabel}  
**Explanation:** ${testC_pairwise.explanation}  
**Prose craft reasons:** ${testC_pairwise.proseCraftReasons.join(', ')}  
**Engine mentioned:** ${testC_pairwise.engineMentioned ? 'YES ⚠️' : 'NO ✅'}

## Full v2.1 ladder table

${tableMd}
`;

  fs.writeFileSync(
    path.join(runDir, 'craft-calibration-v2.1.json'),
    JSON.stringify(
      {
        gate,
        cardAudit,
        rows,
        fullReports,
        testA: {
          v2_bollyGolden: testA_v2_bollyGolden,
          v2_phaseA: testA_v2_phaseA,
          cardsUsed: 'v2 minus mid_bolly_phase_a',
        },
        testB: {
          maskedGolden: testB_maskedGolden,
          maskedPhaseA: testB_maskedPhaseA,
          pairwise: testB_pairwise,
        },
        testC: { pairwise: testC_pairwise },
      },
      null,
      2
    ),
    'utf8'
  );
  fs.writeFileSync(path.join(runDir, 'craft-calibration-v2.1.md'), reportMd, 'utf8');

  console.log('\n' + tableMd);
  console.log(`\n[craft-v2.1] gate.pass=${gate.pass}`);
  console.log(
    `[craft-v2.1] Bolly golden v2.1=${bollyGoldenReport.overall} (${bollyGoldenReport.ladderPlacement}) vs Phase-A=${phaseAReport.overall}`
  );
  console.log(`[craft-v2.1] wrote ${runDir}/craft-calibration-v2.1.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
