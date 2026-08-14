#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readOnlyOpenAiKey } = require('./run-story-autonomous-batch-launcher.cjs');

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined || key in values) {
      throw new Error('story_visual_direction_launcher_arguments_invalid');
    }
    values[key.slice(2)] = value;
  }
  return values;
}

function main() {
  const values = parseArgs(process.argv.slice(2));
  const allowed = new Set([
    'credential-source', 'output-root', 'max-cost-usd', 'seed-root', 'unaccounted-seed-calls',
  ]);
  if (
    !values['credential-source'] || !values['output-root'] || !values['max-cost-usd'] ||
    Object.keys(values).some((key) => !allowed.has(key))
  ) {
    throw new Error('story_visual_direction_launcher_arguments_invalid');
  }
  if (fs.existsSync(path.resolve(values['output-root']))) {
    throw new Error('story_visual_direction_output_root_not_fresh');
  }
  const apiKey = readOnlyOpenAiKey(values['credential-source']);
  const environment = {};
  for (const key of ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'ComSpec', 'COMSPEC', 'TEMP', 'TMP']) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  environment.OPENAI_API_KEY = apiKey;
  const childArgs = [
    path.join(__dirname, 'run-story-visual-directions-private.cjs'),
    '--output-root', values['output-root'],
    '--max-cost-usd', values['max-cost-usd'],
  ];
  if (values['seed-root']) childArgs.push('--seed-root', values['seed-root']);
  if (values['unaccounted-seed-calls']) {
    childArgs.push('--unaccounted-seed-calls', values['unaccounted-seed-calls']);
  }
  const result = spawnSync(process.execPath, childArgs, {
    cwd: path.resolve(__dirname, '..'),
    env: environment,
    stdio: 'inherit',
    windowsHide: true,
  });
  apiKey.length;
  if (result.error) throw new Error('story_visual_direction_child_launch_failed');
  if (result.signal) throw new Error('story_visual_direction_child_signaled');
  if (result.status !== 0) throw new Error('story_visual_direction_child_nonzero_exit');
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message.split(':')[0] : 'story_visual_direction_launcher_failure'}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs };
