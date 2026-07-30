'use strict';

const path = require('node:path');
const {
  canonicalLiveExecutionSupervisorLauncherDisposition,
  runCanonicalLiveExecutionSupervisorLauncher,
} = require('./lib/canonical-live-execution-supervisor-launcher.cjs');

const result = runCanonicalLiveExecutionSupervisorLauncher({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  env: process.env,
  execPath: process.execPath,
  tsxCli: require.resolve('tsx/cli'),
  shim: path.join(
    __dirname,
    'shims',
    'register-server-only.cjs',
  ),
  entrypoint: path.join(
    __dirname,
    'canonical-live-execution-supervisor-entry.ts',
  ),
});
const disposition =
  canonicalLiveExecutionSupervisorLauncherDisposition(result);
if (disposition.kind === 'signal') {
  process.kill(process.pid, disposition.signal);
} else {
  process.exitCode = disposition.exitCode;
}
