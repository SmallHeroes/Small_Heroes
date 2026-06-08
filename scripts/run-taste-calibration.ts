/**
 * Taste Judge v1 — blind calibration runner (product/editorial gate).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-taste-calibration.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { parseDecoySpecs } from '../lib/story-gen/craft-rubric-test';
import { parseMidTierAnchorSpecs } from '../lib/story-gen/craft-rubric-v2';
import { GOLDEN_BANK_FILES } from '../lib/story-gen/freshness-corpus';
import { DEFAULT_STORY_GEN_MODELS } from '../lib/story-gen/story-generation-types';
import type { StoryDirection } from '../lib/story-gen/story-generation-types';
import {
  buildTasteContext,
  evaluateTasteCalibrationGate,
  extractTasteProseFromMarkdown,
  formatTasteCalibrationTable,
  normalizeTasteProbeProse,
  parseTasteProbeSpecs,
  runTasteJudge,
  type TasteCalibrationItem,
} from '../lib/story-gen/taste-judge';

const STORY_BANK_DIR = path.join(
  process.cwd(),
  'story-bank',
  (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
);

const CANARY_POST_PATCH_ROOT = path.join(
  process.cwd(),
  'outputs',
  'writers-room-canary',
  '2026-06-08T07-38-12-119Z'
);

const CANARY_SCENARIOS: Array<{
  id: string;
  label: string;
  companionId: string;
  direction: StoryDirection;
}> = [
  {
    id: 'bolly_b1_lahitraf_adv',
    label: 'Bolly B1 (post-patch)',
    companionId: 'bolly_armadillo',
    direction: 'adventure',
  },
  {
    id: 'bolly_b4_hacheder_bed',
    label: 'Bolly B4 (post-patch)',
    companionId: 'bolly_armadillo',
    direction: 'bedtime',
  },
  {
    id: 'tubi_s2_ha_bayit_bed',
    label: 'Tubi S2 (post-patch)',
    companionId: 'baby_elephant',
    direction: 'bedtime',
  },
  {
    id: 'tubi_s5_ha_zikukim_adv',
    label: 'Tubi S5 (post-patch)',
    companionId: 'baby_elephant',
    direction: 'adventure',
  },
];

const BOLLY_PHASE_A_PATH = path.join(
  process.cwd(),
  'outputs',
  'story-gen-runs',
  '2026-06-07T10-21-49-454Z',
  'story.md'
);

const MIDTIER_PATH = path.join(
  process.cwd(),
  'outputs',
  'craft-decoys',
  'craft-judge-midtier-anchors.md'
);
const DECOYS_PATH = path.join(
  process.cwd(),
  'outputs',
  'craft-decoys',
  'craft-judge-decoys.md'
);
const TASTE_PROBES_PATH = path.join(
  process.cwd(),
  'outputs',
  'craft-decoys',
  'taste-boring-samples.md'
);

function companionFromGoldenFilename(filename: string): string {
  const base = filename.replace(/\.md$/, '');
  const parts = base.split('_');
  if (parts.length >= 3) return `${parts[0]}_${parts[1]}`;
  return base;
}

function directionFromGoldenFilename(filename: string): StoryDirection {
  if (filename.includes('_bedtime')) return 'bedtime';
  if (filename.includes('_fantasy')) return 'fantasy';
  return 'adventure';
}

function parseProbeMeta(rawBody: string): {
  companionId?: string;
  direction?: StoryDirection;
} {
  const companionMatch = rawBody.match(/^companionId:\s*(\S+)/m);
  const directionMatch = rawBody.match(/^direction:\s*(\S+)/m);
  const direction = directionMatch?.[1] as StoryDirection | undefined;
  return {
    companionId: companionMatch?.[1],
    direction:
      direction === 'bedtime' || direction === 'fantasy' || direction === 'adventure'
        ? direction
        : undefined,
  };
}

function proseForJudge(markdownOrBody: string, normalizeProbe = false): string {
  const prose = extractTasteProseFromMarkdown(markdownOrBody);
  return normalizeProbe ? normalizeTasteProbeProse(prose) : prose;
}

async function judgeItem(args: {
  id: string;
  label: string;
  category: TasteCalibrationItem['category'];
  markdown: string;
  normalizeProbe?: boolean;
  companionId?: string;
  direction?: StoryDirection;
}): Promise<TasteCalibrationItem> {
  console.log(`[taste-cal] judging ${args.category}: ${args.id}`);
  const prose = proseForJudge(args.markdown, args.normalizeProbe);
  const context = buildTasteContext({
    companionId: args.companionId,
    direction: args.direction,
    companionDisplayName: args.label,
  });
  const report = await runTasteJudge({ prose, context });
  return {
    id: args.id,
    label: args.label,
    category: args.category,
    report,
  };
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(process.cwd(), 'outputs', 'story-gen-runs', timestamp);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`[taste-cal] run → ${runDir}`);
  console.log(`[taste-cal] judgeModel=${DEFAULT_STORY_GEN_MODELS.judgeModel}`);

  const items: TasteCalibrationItem[] = [];

  for (const filename of GOLDEN_BANK_FILES) {
    const filePath = path.join(STORY_BANK_DIR, filename);
    const markdown = fs.readFileSync(filePath, 'utf8');
    const id = filename.replace(/\.md$/, '');
    items.push(
      await judgeItem({
        id,
        label: id,
        category: 'golden',
        markdown,
        companionId: companionFromGoldenFilename(filename),
        direction: directionFromGoldenFilename(filename),
      })
    );
  }

  for (const scenario of CANARY_SCENARIOS) {
    const filePath = path.join(CANARY_POST_PATCH_ROOT, scenario.id, 'story.after-patch.md');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Canary post-patch not found: ${filePath}`);
    }
    const markdown = fs.readFileSync(filePath, 'utf8');
    items.push(
      await judgeItem({
        id: scenario.id,
        label: scenario.label,
        category: 'canary',
        markdown,
        companionId: scenario.companionId,
        direction: scenario.direction,
      })
    );
  }

  items.push(
    await judgeItem({
      id: 'bolly_phase_a',
      label: 'Phase-A Bolly adventure',
      category: 'mid',
      markdown: fs.readFileSync(BOLLY_PHASE_A_PATH, 'utf8'),
      companionId: 'bolly_armadillo',
      direction: 'adventure',
    })
  );

  const midSpecs = parseMidTierAnchorSpecs(fs.readFileSync(MIDTIER_PATH, 'utf8'));
  for (const spec of midSpecs) {
    const meta = parseProbeMeta(spec.storyBody);
    items.push(
      await judgeItem({
        id: spec.id,
        label: spec.label,
        category: 'mid',
        markdown: spec.storyBody,
        normalizeProbe: true,
        companionId: meta.companionId,
        direction: meta.direction,
      })
    );
  }

  for (const spec of parseDecoySpecs(fs.readFileSync(DECOYS_PATH, 'utf8'))) {
    const meta = parseProbeMeta(spec.storyBody);
    items.push(
      await judgeItem({
        id: spec.id,
        label: spec.label,
        category: 'decoy',
        markdown: spec.storyBody,
        normalizeProbe: true,
        companionId: meta.companionId,
        direction: meta.direction,
      })
    );
  }

  for (const spec of parseTasteProbeSpecs(fs.readFileSync(TASTE_PROBES_PATH, 'utf8'))) {
    const meta = parseProbeMeta(spec.storyBody);
    items.push(
      await judgeItem({
        id: spec.id,
        label: spec.label,
        category: spec.category,
        markdown: spec.storyBody,
        normalizeProbe: true,
        companionId: meta.companionId,
        direction: meta.direction,
      })
    );
  }

  const gate = evaluateTasteCalibrationGate(items);
  const table = formatTasteCalibrationTable(items);

  const reportMd = [
    '# Taste Judge v1 — Calibration Report',
    '',
    `**Run:** ${timestamp}`,
    `**Model:** ${DEFAULT_STORY_GEN_MODELS.judgeModel}`,
    `**Gate:** ${gate.pass ? 'PASS' : 'FAIL'}`,
    '',
    '## Calibration table',
    '',
    table,
    '',
    '## Gate failures',
    gate.failures.length ? gate.failures.map((f) => `- ${f}`).join('\n') : '(none)',
    '',
    '## Warnings',
    gate.warnings.length ? gate.warnings.map((w) => `- ${w}`).join('\n') : '(none)',
    '',
    '## Invalid items (technical leak)',
    gate.invalidItems.length ? gate.invalidItems.map((i) => `- ${i}`).join('\n') : '(none)',
    '',
    '## Surprising verdicts',
    gate.surprisingVerdicts.length
      ? gate.surprisingVerdicts.map((s) => `- ${s}`).join('\n')
      : '(none)',
    '',
    '## Recommendation',
    gate.pass
      ? 'Calibration passed. Taste Judge is ready for bounded-loop wiring in a separate brief.'
      : 'Do NOT wire the bounded loop until gate failures and invalid technical reasoning are resolved.',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(runDir, 'taste-calibration-report.md'), reportMd, 'utf8');
  fs.writeFileSync(
    path.join(runDir, 'taste-calibration-full.json'),
    JSON.stringify({ gate, items }, null, 2),
    'utf8'
  );

  console.log('\n' + table);
  console.log(`\n[taste-cal] Gate: ${gate.pass ? 'PASS' : 'FAIL'}`);
  if (gate.failures.length) console.log('[taste-cal] Failures:', gate.failures.join('; '));
  if (gate.invalidItems.length) console.log('[taste-cal] Invalid:', gate.invalidItems.join('; '));
  console.log(`[taste-cal] Wrote ${runDir}/taste-calibration-report.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
