'use strict';

const path = require('node:path');
const {
  runVisualContractAuthoringLauncher,
} = require('./lib/visual-contract-authoring-launcher-runner.cjs');

const tsxCli = require.resolve('tsx/cli');
const shim = path.join(__dirname, 'shims', 'register-server-only.cjs');
const entrypoint = path.join(__dirname, 'visual-contract-authoring-entry.ts');

// The child `--require` is the ordering guarantee: the repository shim loads in the actual tsx process before the
// guarded TypeScript entrypoint or any transitive live-authoring dependency can evaluate.
process.exitCode = runVisualContractAuthoringLauncher({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  env: process.env,
  execPath: process.execPath,
  tsxCli,
  shim,
  entrypoint,
});
