#!/usr/bin/env node

const path = require('node:path');
const { createOpenAiStoryProvider } = require('./story-autonomous-openai-provider.cjs');
const { runVisualDirectionWave } = require('./story-visual-direction-batch-core.cjs');

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined || key in values) {
      throw new Error('story_visual_direction_arguments_invalid');
    }
    values[key.slice(2)] = value;
  }
  return values;
}

async function main() {
  const values = parseArgs(process.argv.slice(2));
  if (
    !values['output-root'] || !values['max-cost-usd'] || !process.env.OPENAI_API_KEY ||
    Object.keys(values).some((key) => !['output-root', 'max-cost-usd'].includes(key))
  ) {
    throw new Error('story_visual_direction_arguments_invalid');
  }
  const repoRoot = path.resolve(__dirname, '..');
  const manifest = await runVisualDirectionWave({
    repoRoot,
    outputRoot: path.resolve(values['output-root']),
    provider: createOpenAiStoryProvider({ apiKey: process.env.OPENAI_API_KEY }),
    maxCostUsd: Number(values['max-cost-usd']),
  });
  process.stdout.write(`${JSON.stringify({
    version: manifest.version,
    status: manifest.status,
    storyCount: Object.keys(manifest.records).length,
    logicalProviderCalls: manifest.logicalProviderCalls,
    actualCostUsd: manifest.actualCostUsd,
    transportRetries: manifest.transportRetries,
    fallbackUsed: manifest.fallbackUsed,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message.split(':')[0] : 'story_visual_direction_unknown_failure'}\n`);
  process.exitCode = 1;
});
