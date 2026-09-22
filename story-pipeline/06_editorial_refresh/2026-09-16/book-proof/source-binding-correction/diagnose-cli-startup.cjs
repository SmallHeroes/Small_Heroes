'use strict';
// Bounded startup measurements. Help/conflicting/invalid modes only; NO fixtures,
// credentials, provider requests, writes, timeout-policy changes or test verdicts.
const path = require('node:path'), { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const repo = path.resolve(__dirname, '../../../../..');
const env = {};
for (const name of ['PATH', 'SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP']) {
  const key = Object.keys(process.env).find(k => k.toLowerCase() === name.toLowerCase());
  if (key !== undefined) env[name] = process.env[key];
}
Object.assign(env, { TSX_DISABLE_CACHE: '1', TSX_TSCONFIG_PATH: path.join(repo, 'tsconfig.json'), NODE_ENV: 'test' });
const tsx = require.resolve('tsx/cjs');
const shim = path.join(repo, 'scripts/shims/register-server-only.cjs');
const cases = [
  ['node_only', ['-e', ''], 0],
  ['tsx_only', ['--require', tsx, '-e', ''], 0],
  ['owner_conflicting_modes', ['--require', tsx, '--require', shim, path.join(repo, 'scripts/run-owner-book-draft.ts'),
    'nonexistent-config.json', '--sample', '--render'], 1],
  ['writer_invalid_mode', [path.join(repo, 'scripts/canonical-materialization-input.cjs'), '--invalid-probe-mode'], 1],
  ['lifecycle_help', ['--require', tsx, '--require', shim, path.join(repo, 'scripts/production-visual-lifecycle.ts'), '--help'], 0],
];
const rows = [];
for (let attempt = 1; attempt <= 3; attempt++) for (const [name, args, expectedExit] of cases) {
  const started = performance.now();
  const result = spawnSync(process.execPath, args, { cwd: repo, env, encoding: 'utf8', timeout: 15000, maxBuffer: 65536, windowsHide: true, shell: false });
  const row = { name, attempt, elapsedMs: Math.round(performance.now() - started), exit: result.status,
    errorCode: result.error?.code ?? null, expectedExit,
    ownerSanitized: name === 'owner_conflicting_modes' ? result.stderr.trim() === 'draft_conflicting_modes' : null };
  rows.push(row);
  if (result.status !== expectedExit || result.error) { console.log(JSON.stringify({ rows, status: 'probe_failed' })); process.exitCode = 1; return; }
}
console.log(JSON.stringify({ rows, providerCalls: 0, credentials: 'not passed',
  scope: 'startup control cases, not reproduction of fixture work or proof of machine-level causality' }, null, 2));
