/**
 * Rerun STOP 3 gates on existing run dir (no prose regen).
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/rerun-stop3-gates.ts --run=<dir>
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import type { PremiseExperimentSpecV3 } from '../lib/story-gen-v3/types';
import { rerunStop3Gates } from '../lib/story-gen-v3/stop3-gates';
import type { PageBeatV3, StoryPremiseCandidate } from '../lib/story-gen-v3/types';

async function main(): Promise<void> {
  const runDir = path.resolve(
    process.argv.find((a) => a.startsWith('--run='))?.split('=')[1] ?? ''
  );
  if (!runDir || !fs.existsSync(runDir)) throw new Error('Missing --run=');

  const spec = JSON.parse(
    fs.readFileSync(path.join(runDir, 'experiment-spec.json'), 'utf8')
  ) as PremiseExperimentSpecV3;
  const premise = JSON.parse(
    fs.readFileSync(path.join(runDir, 'hardened-premise.json'), 'utf8')
  ) as StoryPremiseCandidate;
  const beats = JSON.parse(
    fs.readFileSync(path.join(runDir, 'page-beats.json'), 'utf8')
  ) as PageBeatV3[];

  const result = await rerunStop3Gates({ runDir, spec, premise, beats });
  console.log(JSON.stringify(result, null, 2));
  if (!result.gatePassAutomated) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
