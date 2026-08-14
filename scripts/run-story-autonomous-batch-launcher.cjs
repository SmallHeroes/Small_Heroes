#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined || key in values) throw new Error('story_batch_launcher_arguments_invalid');
    values[key.slice(2)] = value;
  }
  return values;
}

function readOnlyOpenAiKey(sourcePath) {
  const absolute = path.resolve(sourcePath);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 64 * 1024) {
    throw new Error('story_batch_credential_source_rejected');
  }
  const matches = fs.readFileSync(absolute, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.*?)\s*$/))
    .filter(Boolean);
  if (matches.length !== 1) throw new Error('story_batch_openai_key_not_unique');
  const raw = matches[0][1];
  const key = raw.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted);
  if (!key || /\s/.test(key)) throw new Error('story_batch_openai_key_invalid');
  return key;
}

function main() {
  const values = parseArgs(process.argv.slice(2));
  const allowed = new Set(['credential-source', 'output-root', 'brief-id', 'max-cost-usd']);
  if (!values['credential-source'] || !values['output-root'] || !values['max-cost-usd'] ||
      Object.keys(values).some((key) => !allowed.has(key))) {
    throw new Error('story_batch_launcher_arguments_invalid');
  }
  const apiKey = readOnlyOpenAiKey(values['credential-source']);
  const childArgs = [
    path.join(__dirname, 'run-story-autonomous-batch-private.cjs'),
    '--output-root', values['output-root'],
    '--max-cost-usd', values['max-cost-usd'],
  ];
  if (values['brief-id']) childArgs.push('--brief-id', values['brief-id']);
  const environment = {};
  for (const key of ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'ComSpec', 'COMSPEC', 'TEMP', 'TMP']) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  environment.OPENAI_API_KEY = apiKey;
  const result = spawnSync(process.execPath, childArgs, {
    cwd: path.resolve(__dirname, '..'),
    env: environment,
    stdio: 'inherit',
    windowsHide: true,
  });
  apiKey.length; // keep the value scoped to this process; never print or persist it.
  if (result.error) throw new Error('story_batch_child_launch_failed');
  if (result.signal) throw new Error('story_batch_child_signaled');
  if (result.status !== 0) throw new Error('story_batch_child_nonzero_exit');
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message.split(':')[0] : 'story_batch_launcher_failure'}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, readOnlyOpenAiKey };
