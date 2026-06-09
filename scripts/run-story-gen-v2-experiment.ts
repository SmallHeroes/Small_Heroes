/**
 * Generator-v2 event-driven spike — ONE experiment, then human read.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-story-gen-v2-experiment.ts
 *
 * Isolated from Phase-B production. No bank / images / customer flow.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { PANDA_ANAT_V2_EXP1 } from '../lib/story-gen-v2/experiment-spec';
import { runStoryGenV2Experiment } from '../lib/story-gen-v2/pipeline';

async function main(): Promise<void> {
  const result = await runStoryGenV2Experiment({
    spec: PANDA_ANAT_V2_EXP1,
    modelId: 'gpt-5-chat-latest',
  });

  console.log(
    JSON.stringify(
      {
        runDir: result.runDir,
        stoppedAt: result.stoppedAt,
        momentumVerdict: result.momentumBeforeProse.verdict,
        hasStory: Boolean(result.storyMarkdown),
      },
      null,
      2
    )
  );

  if (result.stoppedAt === 'momentum_fail') {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
