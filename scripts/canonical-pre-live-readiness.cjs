'use strict';

const path = require('node:path');
const {
  canonicalBytes,
  runCanonicalPreLiveReadinessLauncher,
} = require('./lib/canonical-pre-live-readiness-launcher.cjs');

const outcome = runCanonicalPreLiveReadinessLauncher({
  argv: process.argv.slice(2),
  environment: process.env,
  execPath: process.execPath,
  platform: process.platform,
  expectedRepoRoot: path.resolve(__dirname, '..'),
});

if (outcome.kind === 'failure') {
  process.stdout.write(canonicalBytes(outcome.failure));
}

if (outcome.kind === 'probe') {
  process.stdout.write(canonicalBytes(outcome.evidence));
}

if (outcome.disposition.kind === 'signal') {
  process.kill(process.pid, outcome.disposition.signal);
} else {
  process.exitCode = outcome.disposition.exitCode;
}
