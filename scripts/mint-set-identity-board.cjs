'use strict';

const path = require('node:path');
const { runSetIdentityBoardLauncher } = require('./lib/set-identity-board-launcher-runner.cjs');

const tsxCli = require.resolve('tsx/cli');
const shim = path.join(__dirname, 'shims', 'register-server-only.cjs');
const entrypoint = path.join(__dirname, 'mint-set-identity-board-entry.ts');

// The child `--require` is the ordering guarantee: the repository shim loads in the actual tsx process before the
// private entrypoint or any transitive TypeScript dependency can evaluate.
process.exitCode = runSetIdentityBoardLauncher({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  env: process.env,
  execPath: process.execPath,
  tsxCli,
  shim,
  entrypoint,
});
