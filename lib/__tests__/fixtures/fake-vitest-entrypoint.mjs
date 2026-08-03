import { appendFileSync, writeSync } from 'node:fs';

const phase = process.env.SMALL_HEROES_VITEST_PHASE;
const logPath = process.env.SMALL_HEROES_FAKE_VITEST_LOG;
const behavior =
  phase === 'ordinary'
    ? process.env.SMALL_HEROES_FAKE_ORDINARY_BEHAVIOR
    : process.env.SMALL_HEROES_FAKE_RESOURCE_BEHAVIOR;

if (logPath) {
  appendFileSync(
    logPath,
    `${JSON.stringify({ phase, argv: process.argv.slice(2) })}\n`,
  );
}

if (behavior !== 'missing_diagnostic') {
  const record =
    behavior === 'malformed_diagnostic'
      ? { unsafe: 'raw-body-must-not-be-accepted' }
      : {
          schemaVersion: 'small-heroes-vitest-reporter-diagnostic/v1',
          taxonomyVersion: 'small-heroes-vitest-phase-diagnostic/v1',
          event: 'run_end',
          phase,
          runReason: behavior === 'exit_1' ? 'failed' : 'passed',
          taskUpdateCalls: 1,
          processTimeout: false,
          classes: [],
        };
  writeSync(3, `${JSON.stringify(record)}\n`);
}

if (behavior === 'signal') {
  process.kill(process.pid, 'SIGTERM');
} else if (behavior === 'exit_1') {
  process.exitCode = 1;
}
