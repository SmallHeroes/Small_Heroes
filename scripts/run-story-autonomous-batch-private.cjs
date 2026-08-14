#!/usr/bin/env node

const path = require('node:path');
const {
  ACCEPTED_DINI_BRIEF_ID,
  runAutonomousStoryWave,
} = require('./story-autonomous-batch-core.cjs');
const { createOpenAiStoryProvider } = require('./story-autonomous-openai-provider.cjs');
const { loadStoryArchitectAuthority } = require('./materialize-story-commission-briefs.cjs');

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined || key in values) throw new Error('story_batch_arguments_invalid');
    values[key.slice(2)] = value;
  }
  return values;
}

async function main() {
  const values = parseArgs(process.argv.slice(2));
  if (!values['output-root'] || !values['max-cost-usd'] || !process.env.OPENAI_API_KEY) {
    throw new Error('story_batch_arguments_invalid');
  }
  const authority = loadStoryArchitectAuthority();
  const briefIds = values['brief-id']
    ? [values['brief-id']]
    : authority.commissions
        .map(({ briefId }) => briefId)
        .filter((briefId) => briefId !== ACCEPTED_DINI_BRIEF_ID);
  const manifest = await runAutonomousStoryWave({
    repoRoot: path.resolve(__dirname, '..'),
    outputRoot: path.resolve(values['output-root']),
    briefIds,
    provider: createOpenAiStoryProvider({ apiKey: process.env.OPENAI_API_KEY }),
    maxCostUsd: Number(values['max-cost-usd']),
  });
  process.stdout.write(`${JSON.stringify({
    version: manifest.version,
    status: manifest.status,
    storyCount: manifest.briefIds.length,
    machineQualified: Object.values(manifest.stories).filter(({ status }) => status === 'machine_qualified').length,
    holds: Object.values(manifest.stories).filter(({ status }) => status === 'hold').length,
    logicalProviderCalls: manifest.logicalProviderCalls,
    actualCostUsd: manifest.actualCostUsd,
    transportRetries: manifest.transportRetries,
    fallbackUsed: manifest.fallbackUsed,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message.split(':')[0] : 'story_batch_unknown_failure'}\n`);
  process.exitCode = 1;
});
