'use strict';

const path = require('node:path');
const {
  canonicalLiveExecutionRequestMaterializerLauncherDisposition,
  runCanonicalLiveExecutionRequestMaterializerLauncher,
} = require('./lib/canonical-live-execution-request-materialize-launcher.cjs');

const result =
  runCanonicalLiveExecutionRequestMaterializerLauncher({
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
      'canonical-live-execution-request-materialize-entry.ts',
    ),
  });
const disposition =
  canonicalLiveExecutionRequestMaterializerLauncherDisposition(
    result,
  );
if (disposition.kind === 'signal') {
  process.kill(process.pid, disposition.signal);
} else {
  process.exitCode = disposition.exitCode;
}
