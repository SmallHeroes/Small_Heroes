/**
 * Phase A — outline-first story generation CLI (advisory only; no live bank writes).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/gen-story.ts
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/gen-story.ts --companion bolly_armadillo --direction adventure
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { generateStoryFromScenario } from '../lib/story-gen/generate-story';
import { BOLLY_ADVENTURE_KILL_SWITCH_SCENARIO } from '../lib/story-gen/scenarios-phase-a';
import {
  DEFAULT_STORY_GEN_MODELS,
  type Scenario,
  type StoryDirection,
} from '../lib/story-gen/story-generation-types';

function parseArgs(): { companionId: string; direction: StoryDirection } {
  const argv = process.argv.slice(2);
  let companionId = 'bolly_armadillo';
  let direction: StoryDirection = 'adventure';

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--companion' && argv[i + 1]) companionId = argv[++i];
    if (argv[i] === '--direction' && argv[i + 1]) {
      const d = argv[++i] as StoryDirection;
      if (d === 'bedtime' || d === 'adventure' || d === 'fantasy') direction = d;
    }
  }
  return { companionId, direction };
}

function resolveScenario(companionId: string, direction: StoryDirection): Scenario {
  if (companionId === 'bolly_armadillo' && direction === 'adventure') {
    return BOLLY_ADVENTURE_KILL_SWITCH_SCENARIO;
  }
  throw new Error(
    `No Phase A scenario for ${companionId}/${direction}. Add a hand-written scenario in lib/story-gen/scenarios-phase-a.ts`
  );
}

async function main(): Promise<void> {
  const { companionId, direction } = parseArgs();
  const scenario = resolveScenario(companionId, direction);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(process.cwd(), 'outputs', 'story-gen-runs', timestamp);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`[gen-story] Phase A run → ${runDir}`);
  console.log(`[gen-story] companion=${companionId} direction=${direction}`);
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
  if (result.advisoryReport) {
    fs.writeFileSync(
      path.join(runDir, 'advisory-report.json'),
      JSON.stringify(result.advisoryReport, null, 2),
      'utf8'
    );
  }

  console.log(`[gen-story] Wrote outline.json, story.md, prompts.json, model-versions.json`);
  console.log(`[gen-story] Done.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
