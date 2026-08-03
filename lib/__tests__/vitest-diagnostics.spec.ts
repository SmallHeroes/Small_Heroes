import { describe, expect, it } from 'vitest';

import {
  classifyVitestDiagnostic,
  classifyVitestProcessOutcome,
  createVitestPhaseDiagnosticEvidence,
  VITEST_DIAGNOSTIC_SCHEMA,
} from '../../test-infrastructure/vitest-diagnostics.mjs';
import { SanitizedVitestDiagnosticReporter } from '../../test-infrastructure/vitest-diagnostic-reporter.mjs';

describe('Vitest diagnostic taxonomy', () => {
  it('keeps onTaskUpdate worker RPC timeouts distinct', () => {
    expect(
      classifyVitestDiagnostic(
        new Error('[vitest-worker]: Timeout calling "onTaskUpdate"'),
      ),
    ).toEqual(['on_task_update_rpc_timeout']);

    expect(
      classifyVitestDiagnostic(
        new Error('[vitest-pool]: Timeout calling "fetch"'),
      ),
    ).toEqual(['reporter_or_ipc_failure']);
  });

  it.each([
    'Test timed out in 5000ms.',
    'Hook timed out in 5000ms.',
    'Exceeded timeout of 5000ms for a test.',
  ])('classifies test timeouts without changing them: %s', (message) => {
    expect(classifyVitestDiagnostic({ message })).toEqual([
      'test_timeout',
    ]);
  });

  it.each([
    'ERR_IPC_CHANNEL_CLOSED',
    'Unhandled Reporter Error',
    'write EPIPE',
    '[birpc] rpc is closed, cannot call "fetch"',
    'Unexpected call to process.send()',
  ])('classifies reporter and IPC failures: %s', (message) => {
    expect(classifyVitestDiagnostic({ message })).toEqual([
      'reporter_or_ipc_failure',
    ]);
  });

  it.each([
    'Failed to terminate worker',
    'close timed out after 10000ms',
    'Tests closed successfully but something prevents the main process exiting',
  ])('classifies teardown and termination failures: %s', (message) => {
    expect(classifyVitestDiagnostic({ message })).toEqual([
      'teardown_or_termination_failure',
    ]);
  });

  it('fails closed when the process outcome is indeterminate', () => {
    expect(
      classifyVitestProcessOutcome({
        diagnosticProtocolOk: true,
        exitCode: null,
        launchErrorCode: null,
        signal: null,
      }),
    ).toEqual(['signal_or_exit_failure']);

    const secret = 'OPENAI_API_KEY=raw-secret-value';
    const evidence = createVitestPhaseDiagnosticEvidence({
      diagnosticBytes: 0,
      diagnosticClasses: classifyVitestDiagnostic({ message: secret }),
      diagnosticProtocolOk: true,
      diagnosticRecords: 0,
      elapsedMs: 25,
      exitCode: null,
      fileCount: 1,
      launchErrorCode: null,
      phase: 'ordinary',
      signal: null,
      workerLimit: 4,
    });

    expect(evidence).toMatchObject({
      classes: ['signal_or_exit_failure'],
      exitCode: null,
      gateStatus: 'failed',
      launchErrorCode: null,
      signal: null,
    });
    expect(JSON.stringify(evidence)).not.toContain(secret);
    expect(JSON.stringify(evidence)).not.toContain('OPENAI_API_KEY');
  });

  it('keeps a normal exit zero passing', () => {
    expect(
      classifyVitestProcessOutcome({
        diagnosticProtocolOk: true,
        exitCode: 0,
        launchErrorCode: null,
        signal: null,
      }),
    ).toEqual([]);
  });

  it.each([
    {
      expected: ['signal_or_exit_failure'],
      label: 'a signal',
      outcome: { exitCode: null, launchErrorCode: null, signal: 'SIGTERM' },
    },
    {
      expected: ['signal_or_exit_failure'],
      label: 'a nonzero exit',
      outcome: { exitCode: 1, launchErrorCode: null, signal: null },
    },
    {
      expected: ['launch_failure'],
      label: 'a launch failure',
      outcome: { exitCode: null, launchErrorCode: 'ENOENT', signal: null },
    },
  ])('keeps $label gate-failing', ({ expected, outcome }) => {
    expect(
      classifyVitestProcessOutcome({
        diagnosticProtocolOk: true,
        ...outcome,
      }),
    ).toEqual(expected);
  });

  it('keeps diagnostic protocol failures gate-failing', () => {
    expect(
      classifyVitestProcessOutcome({
        diagnosticProtocolOk: false,
        exitCode: 0,
        launchErrorCode: null,
        signal: null,
      }),
    ).toEqual(['diagnostic_protocol_failure']);
  });

  it('emits bounded phase evidence without raw diagnostic text', () => {
    const secret = 'OPENAI_API_KEY=raw-secret-value';
    const evidence = createVitestPhaseDiagnosticEvidence({
      diagnosticBytes: 312,
      diagnosticClasses: classifyVitestDiagnostic({ message: secret }),
      diagnosticProtocolOk: true,
      diagnosticRecords: 1,
      elapsedMs: 1200,
      exitCode: 0,
      fileCount: 12,
      launchErrorCode: undefined,
      phase: 'ordinary',
      signal: null,
      workerLimit: 4,
    });

    expect(evidence.schemaVersion).toBe(VITEST_DIAGNOSTIC_SCHEMA);
    expect(evidence.gateStatus).toBe('passed');
    expect(JSON.stringify(evidence)).not.toContain(secret);
    expect(JSON.stringify(evidence)).not.toContain('OPENAI_API_KEY');
  });
});

describe('sanitized Vitest diagnostic reporter', () => {
  it('writes only a closed summary for task and unhandled errors', () => {
    const lines: string[] = [];
    const reporter = new SanitizedVitestDiagnosticReporter({
      phase: 'resource_intensive',
      write: (line: string) => lines.push(line),
    });
    const secret = 'raw-provider-prompt-and-credential';

    reporter.onTaskUpdate([
      [
        'task-id',
        {
          errors: [
            { message: 'Test timed out in 5000ms.' },
            { message: secret },
          ],
        },
      ],
    ]);
    reporter.onTestRunEnd(
      [],
      [
        {
          message: '[vitest-worker]: Timeout calling "onTaskUpdate"',
        },
      ],
      'failed',
    );

    expect(lines).toHaveLength(1);
    const evidence = JSON.parse(lines[0]);
    expect(evidence).toEqual({
      schemaVersion: 'small-heroes-vitest-reporter-diagnostic/v1',
      taxonomyVersion: VITEST_DIAGNOSTIC_SCHEMA,
      event: 'run_end',
      phase: 'resource_intensive',
      runReason: 'failed',
      taskUpdateCalls: 1,
      processTimeout: false,
      classes: ['on_task_update_rpc_timeout', 'test_timeout'],
    });
    expect(lines[0]).not.toContain(secret);
    expect(lines[0]).not.toContain('task-id');
  });

  it('emits a teardown class when Vitest reports process timeout', () => {
    const lines: string[] = [];
    const reporter = new SanitizedVitestDiagnosticReporter({
      phase: 'ordinary',
      write: (line: string) => lines.push(line),
    });

    reporter.onProcessTimeout();

    expect(JSON.parse(lines[0])).toMatchObject({
      event: 'process_timeout',
      processTimeout: true,
      classes: ['teardown_or_termination_failure'],
    });
  });
});
