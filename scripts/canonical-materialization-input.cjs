'use strict';

const path = require('node:path');
const {
  canonicalMaterializationInputLauncherDisposition,
  runCanonicalMaterializationInputLauncher,
} = require('./lib/canonical-materialization-input-launcher.cjs');

const result = runCanonicalMaterializationInputLauncher({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  env: process.env,
  platform: process.platform,
  execPath: process.execPath,
  tsxCli: require.resolve('tsx/cli'),
  shim: path.join(
    __dirname,
    'shims',
    'register-server-only.cjs',
  ),
  entrypoint: path.join(
    __dirname,
    'canonical-materialization-input-entry.ts',
  ),
});
const disposition =
  canonicalMaterializationInputLauncherDisposition(result);
if (disposition.kind === 'signal') {
  process.kill(process.pid, disposition.signal);
} else {
  process.exitCode = disposition.exitCode;
}
