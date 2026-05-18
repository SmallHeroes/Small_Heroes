#!/usr/bin/env node
/**
 * CLI: generate 9 MVP test stories (3 companions × 3 directions).
 * Requires OPENAI_API_KEY and GENERATOR_LLM_MODEL (default gpt-5-chat-latest).
 *
 * Usage: node scripts/generate-test-batch.mjs
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required for live batch generation.');
    process.exit(1);
  }

  // Register tsx loader path via dynamic import of compiled approach:
  // Use npx tsx to run TypeScript entry.
  const { spawnSync } = await import('child_process');
  const result = spawnSync(
    'npx',
    ['tsx', 'scripts/generate-test-batch-runner.ts'],
    { stdio: 'inherit', shell: true, env: process.env }
  );
  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
