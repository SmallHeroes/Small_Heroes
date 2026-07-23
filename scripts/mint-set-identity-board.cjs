'use strict';

// Ordering is the launcher contract. Preload the repository shim in this process first, then launch the exact
// local tsx CLI with the same shim as a child preload before it evaluates the internal TypeScript entrypoint.
require('./shims/register-server-only.cjs');

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tsxCli = require.resolve('tsx/cli');
const shim = path.join(__dirname, 'shims', 'register-server-only.cjs');
const entrypoint = path.join(__dirname, 'mint-set-identity-board-entry.ts');
const result = spawnSync(
  process.execPath,
  [tsxCli, '--require', shim, entrypoint, ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  }
);

if (result.error) {
  console.error(result.error instanceof Error ? result.error.message : String(result.error));
  process.exitCode = 1;
} else if (result.signal) {
  console.error(`mint-set-identity-board child terminated by signal ${result.signal}`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
