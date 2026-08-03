import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  parseVitestDiagnosticChannel,
  runVitestPhase,
  runVitestPhases,
} from '../../test-infrastructure/vitest-check-supervisor.mjs';

const temporaryDirectories: string[] = [];

function makeTemporaryDirectory() {
  const directory = mkdtempSync(
    path.join(tmpdir(), 'small-heroes-vitest-supervisor-'),
  );
  temporaryDirectories.push(directory);
  return directory;
}

function fakeEntrypoint() {
  return path.join(
    process.cwd(),
    'lib',
    '__tests__',
    'fixtures',
    'fake-vitest-entrypoint.mjs',
  );
}

function bufferedStream() {
  const lines: string[] = [];
  return {
    lines,
    stream: {
      write(value: string) {
        lines.push(value);
        return true;
      },
    },
  };
}

function fakeEnvironment(
  logPath: string,
  ordinaryBehavior = 'pass',
  resourceBehavior = 'pass',
) {
  return {
    ...process.env,
    SMALL_HEROES_FAKE_VITEST_LOG: logPath,
    SMALL_HEROES_FAKE_ORDINARY_BEHAVIOR: ordinaryBehavior,
    SMALL_HEROES_FAKE_RESOURCE_BEHAVIOR: resourceBehavior,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('exact-once Vitest check supervisor', () => {
  it('launches each phase once with fixed parallel policy and disjoint files', async () => {
    const directory = makeTemporaryDirectory();
    const logPath = path.join(directory, 'launches.jsonl');
    writeFileSync(logPath, '');
    const output = bufferedStream();

    const result = await runVitestPhases({
      diagnostics: true,
      environment: fakeEnvironment(logPath),
      ordinaryFiles: ['lib/ordinary.spec.ts'],
      ordinaryWorkers: 4,
      resourceIntensiveFiles: ['lib/resource.spec.ts'],
      resourceIntensiveWorkers: 2,
      stderr: output.stream,
      vitestEntrypoint: fakeEntrypoint(),
    });

    expect(result.gateStatus).toBe('passed');
    const launches = readFileSync(logPath, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));
    expect(launches).toHaveLength(2);
    expect(launches.map((launch) => launch.phase)).toEqual([
      'ordinary',
      'resource_intensive',
    ]);
    expect(launches[0].argv).toEqual(
      expect.arrayContaining([
        'run',
        '--pool=forks',
        '--isolate',
        '--fileParallelism',
        '--maxWorkers=4',
        '--reporter=default',
        'lib/ordinary.spec.ts',
      ]),
    );
    expect(launches[1].argv).toEqual(
      expect.arrayContaining([
        '--maxWorkers=2',
        'lib/resource.spec.ts',
      ]),
    );
    expect(launches[0].argv).not.toContain('lib/resource.spec.ts');
    expect(launches[1].argv).not.toContain('lib/ordinary.spec.ts');
  });

  it('runs the resource phase after an ordinary nonzero exit and aggregates failure', async () => {
    const directory = makeTemporaryDirectory();
    const logPath = path.join(directory, 'launches.jsonl');
    writeFileSync(logPath, '');
    const output = bufferedStream();

    const result = await runVitestPhases({
      diagnostics: true,
      environment: fakeEnvironment(logPath, 'exit_1', 'pass'),
      ordinaryFiles: ['lib/ordinary.spec.ts'],
      ordinaryWorkers: 4,
      resourceIntensiveFiles: ['lib/resource.spec.ts'],
      resourceIntensiveWorkers: 2,
      stderr: output.stream,
      vitestEntrypoint: fakeEntrypoint(),
    });

    expect(result.gateStatus).toBe('failed');
    expect(result.ordinary.classes).toContain(
      'signal_or_exit_failure',
    );
    expect(result.resourceIntensive.gateStatus).toBe('passed');
    expect(
      readFileSync(logPath, 'utf8').trim().split(/\r?\n/),
    ).toHaveLength(2);
  });

  it('fails closed on malformed or missing diagnostic reporter records', async () => {
    const directory = makeTemporaryDirectory();
    const logPath = path.join(directory, 'launches.jsonl');
    writeFileSync(logPath, '');
    const output = bufferedStream();

    const result = await runVitestPhases({
      diagnostics: true,
      environment: fakeEnvironment(
        logPath,
        'malformed_diagnostic',
        'missing_diagnostic',
      ),
      ordinaryFiles: ['lib/ordinary.spec.ts'],
      ordinaryWorkers: 4,
      resourceIntensiveFiles: ['lib/resource.spec.ts'],
      resourceIntensiveWorkers: 2,
      stderr: output.stream,
      vitestEntrypoint: fakeEntrypoint(),
    });

    expect(result.gateStatus).toBe('failed');
    expect(result.ordinary.classes).toContain(
      'diagnostic_protocol_failure',
    );
    expect(result.resourceIntensive.classes).toContain(
      'diagnostic_protocol_failure',
    );
    expect(output.lines.join('')).not.toContain(
      'raw-body-must-not-be-accepted',
    );
  });

  it('classifies launch failure without inventing a signal or exit', async () => {
    const directory = makeTemporaryDirectory();
    const output = bufferedStream();
    const result = await runVitestPhase({
      diagnostics: true,
      files: ['lib/ordinary.spec.ts'],
      nodeExecutable: path.join(directory, 'missing-node.exe'),
      phase: 'ordinary',
      stderr: output.stream,
      workerLimit: 4,
    });

    expect(result.gateStatus).toBe('failed');
    expect(result.classes).toEqual(['launch_failure']);
    expect(result.exitCode).toBeNull();
    expect(result.signal).toBeNull();
  });

  it('classifies a signalled subprocess and still launches the second phase', async () => {
    const directory = makeTemporaryDirectory();
    const logPath = path.join(directory, 'launches.jsonl');
    writeFileSync(logPath, '');
    const output = bufferedStream();

    const result = await runVitestPhases({
      diagnostics: true,
      environment: fakeEnvironment(logPath, 'signal', 'pass'),
      ordinaryFiles: ['lib/ordinary.spec.ts'],
      ordinaryWorkers: 4,
      resourceIntensiveFiles: ['lib/resource.spec.ts'],
      resourceIntensiveWorkers: 2,
      stderr: output.stream,
      vitestEntrypoint: fakeEntrypoint(),
    });

    expect(result.gateStatus).toBe('failed');
    expect(result.ordinary.classes).toContain(
      'signal_or_exit_failure',
    );
    expect(result.resourceIntensive.gateStatus).toBe('passed');
    expect(
      readFileSync(logPath, 'utf8').trim().split(/\r?\n/),
    ).toHaveLength(2);
  });

  it('rejects extra diagnostic fields rather than echoing them', () => {
    const parsed = parseVitestDiagnosticChannel(
      `${JSON.stringify({
        schemaVersion: 'small-heroes-vitest-reporter-diagnostic/v1',
        taxonomyVersion: 'small-heroes-vitest-phase-diagnostic/v1',
        event: 'run_end',
        phase: 'ordinary',
        runReason: 'passed',
        taskUpdateCalls: 1,
        processTimeout: false,
        classes: [],
        rawStdout: 'must-not-survive',
      })}\n`,
      'ordinary',
    );

    expect(parsed.protocolOk).toBe(false);
    expect(parsed.records).toBe(0);
    expect(JSON.stringify(parsed)).not.toContain('must-not-survive');
  });
});
