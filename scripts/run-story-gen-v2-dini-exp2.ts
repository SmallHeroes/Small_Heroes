/**
 * Generator-v2 Dini Exp2 — FINAL fantasy spike. One run, then human read.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-story-gen-v2-dini-exp2.ts
 *
 * Isolated R&D. No production / bank / customer flow.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { DRAGON_DINI_V2_EXP2 } from '../lib/story-gen-v2/experiment-spec';
import { runStoryGenV2Exp2 } from '../lib/story-gen-v2/pipeline-exp2';

async function main(): Promise<void> {
  const result = await runStoryGenV2Exp2({
    spec: DRAGON_DINI_V2_EXP2,
    modelId: 'gpt-5-chat-latest',
  });

  console.log(
    JSON.stringify(
      {
        runDir: result.runDir,
        stoppedAt: result.stoppedAt,
        momentumVerdict: result.momentumBeforeProse.verdict,
        hasStory: Boolean(result.storyMarkdown),
        selfCheck: result.selfCheckPath,
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
