/**
 * Outline-first story generation CLI (Phase A kill-switch + Phase B by --scenario-id).
 * Advisory only — no live bank writes.
 *
 * Phase A:
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/gen-story.ts
 *
 * Phase B Run 1 example:
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/gen-story.ts \
 *     --companion baby_elephant --direction adventure --scenario-id tubi_s5_ha_zikukim_adv
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { generateStoryFromScenario } from '../lib/story-gen/generate-story';
import {
  buildRun1AdvisoryBundle,
  formatCraftV21Summary,
} from '../lib/story-gen/run1-advisory';
import { resolveScenario } from '../lib/story-gen/scenario-resolver';
import type { GenderChipRepairReport } from '../lib/story-gen/gender-chip-repair';
import type { HebrewSanityReport } from '../lib/story-gen/hebrew-sanity';
import type { ThinPageEnrichReport } from '../lib/story-gen/thin-page-enrich';
import {
  DEFAULT_STORY_GEN_MODELS,
  type StoryDirection,
} from '../lib/story-gen/story-generation-types';

function parseArgs(): {
  companionId: string;
  direction: StoryDirection;
  scenarioId?: string;
} {
  const argv = process.argv.slice(2);
  let companionId = 'bolly_armadillo';
  let direction: StoryDirection = 'adventure';
  let scenarioId: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--companion' && argv[i + 1]) companionId = argv[++i];
    if (argv[i] === '--direction' && argv[i + 1]) {
      const d = argv[++i] as StoryDirection;
      if (d === 'bedtime' || d === 'adventure' || d === 'fantasy') direction = d;
    }
    if ((argv[i] === '--scenario-id' || argv[i] === '--scenario') && argv[i + 1]) {
      scenarioId = argv[++i];
    }
  }
  return { companionId, direction, scenarioId };
}

async function main(): Promise<void> {
  const { companionId, direction, scenarioId } = parseArgs();
  const scenario = resolveScenario({ companionId, direction, scenarioId });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(process.cwd(), 'outputs', 'story-gen-runs', timestamp);
  fs.mkdirSync(runDir, { recursive: true });

  const phaseLabel = scenarioId ? 'Phase B' : 'Phase A';
  console.log(`[gen-story] ${phaseLabel} run → ${runDir}`);
  console.log(`[gen-story] companion=${companionId} direction=${direction} scenarioId=${scenario.id}`);
  console.log(`[gen-story] draftModel=${DEFAULT_STORY_GEN_MODELS.draftModel}`);

  const result = await generateStoryFromScenario({
    scenario,
    modelConfig: DEFAULT_STORY_GEN_MODELS,
  });

  fs.writeFileSync(
    path.join(runDir, 'outline.json'),
    JSON.stringify(result.outline, null, 2),
    'utf8'
  );
  fs.writeFileSync(path.join(runDir, 'story.md'), result.storyMarkdown, 'utf8');
  fs.writeFileSync(
    path.join(runDir, 'prompts.json'),
    JSON.stringify(result.prompts, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(runDir, 'model-versions.json'),
    JSON.stringify(result.modelVersions, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(runDir, 'scenario.json'),
    JSON.stringify(result.scenario, null, 2),
    'utf8'
  );

  const enrichReport = result.advisoryReport?.thinPageEnrich as ThinPageEnrichReport | undefined;
  const chipRepairReport = result.advisoryReport?.genderChipRepair as
    | GenderChipRepairReport
    | undefined;
  const hebrewSanityReport = result.advisoryReport?.hebrewSanity as HebrewSanityReport | undefined;

  if (enrichReport) {
    fs.writeFileSync(
      path.join(runDir, 'enrich-report.json'),
      JSON.stringify(enrichReport, null, 2),
      'utf8'
    );
    console.log(
      `[gen-story] thin-page enrich: ${enrichReport.pagesEnriched.length} pages; before total=${enrichReport.beforeCounts.reduce((a: number, b: number) => a + b, 0)} after total=${enrichReport.afterCounts.reduce((a: number, b: number) => a + b, 0)} overshoot=${enrichReport.enrichOvershoot.length}`
    );
  }
  if (chipRepairReport) {
    fs.writeFileSync(
      path.join(runDir, 'chip-repair-report.json'),
      JSON.stringify(chipRepairReport, null, 2),
      'utf8'
    );
    console.log(`[gen-story] chip repair: ${chipRepairReport.totalRepaired} identical chips collapsed`);
  }
  if (hebrewSanityReport) {
    fs.writeFileSync(
      path.join(runDir, 'hebrew-sanity-report.json'),
      JSON.stringify(hebrewSanityReport, null, 2),
      'utf8'
    );
    console.log(`[gen-story] hebrew sanity: ${hebrewSanityReport.hitCount} suspicious hit(s)`);
  }

  console.log('[gen-story] Running craft-v2.1 + deterministic validators (swap/freshness placeholders)...');
  const advisoryBundle = await buildRun1AdvisoryBundle({
    scenario,
    storyMarkdown: result.storyMarkdown,
    runLabel: scenarioId ? 'phase-b-run-1-canary' : 'phase-a-advisory',
    judgeModel: DEFAULT_STORY_GEN_MODELS.judgeModel,
    enrichReport,
    chipRepairReport,
    hebrewSanity: hebrewSanityReport,
  });

  const advisoryReport = {
    ...(result.advisoryReport ?? {}),
    run1Advisory: advisoryBundle,
    note: 'swapTest and freshnessTest are placeholders only — not real scores.',
  };

  fs.writeFileSync(
    path.join(runDir, 'advisory-report.json'),
    JSON.stringify(advisoryReport, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(runDir, 'craft-v2.1.json'),
    JSON.stringify(advisoryBundle.craftV21, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(runDir, 'validator-report.json'),
    JSON.stringify(advisoryBundle.validators, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(runDir, 'swap-test.json'),
    JSON.stringify(advisoryBundle.swapTest, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(runDir, 'freshness-test.json'),
    JSON.stringify(advisoryBundle.freshnessTest, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(runDir, 'craft-v2.1-summary.txt'),
    formatCraftV21Summary(advisoryBundle.craftV21),
    'utf8'
  );

  console.log(`[gen-story] craft-v2.1 overall=${advisoryBundle.craftV21.overall} placement=${advisoryBundle.craftV21.ladderPlacement}`);
  console.log(`[gen-story] validators advisoryResult=${advisoryBundle.validators.advisoryResult} pageCount=${advisoryBundle.validators.pageCount}/${advisoryBundle.validators.expectedPages} failures=${advisoryBundle.validators.failures.length} warnings=${advisoryBundle.validators.warnings.length}`);
  console.log(`[gen-story] Wrote artifacts to ${runDir}`);
  console.log('[gen-story] Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
