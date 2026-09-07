import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { setImmediate } from 'node:timers/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CooperativeVitestRunner from '../../test-infrastructure/cooperative-vitest-runner.mjs';

const base = vi.hoisted(() => ({
  beforeFiles: vi.fn(), beforeTry: vi.fn(), afterTask: vi.fn(), cancel: vi.fn(),
}));
vi.mock('vitest/runners', () => ({
  VitestTestRunner: class {
    onBeforeRunFiles(...args: unknown[]) { return base.beforeFiles(...args); }
    onBeforeTryTask(...args: unknown[]) { return base.beforeTry(...args); }
    onAfterRunTask(...args: unknown[]) { return base.afterTask(...args); }
    cancel(...args: unknown[]) { return base.cancel(...args); }
  },
}));

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(delegate: (...args: unknown[]) => Promise<void>) {
  const runner = new CooperativeVitestRunner({} as never);
  Object.assign(runner, { onTaskUpdate: delegate });
  runner.onBeforeRunFiles([]);
  return runner;
}

describe('actual task-update promise barrier', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards exact receiver, arguments and promise once across repeated file hooks', async () => {
    const ack = deferred();
    const delegate = vi.fn(function (this: unknown) { expect(this).toBe(receiver); return ack.promise; });
    const runner = harness(delegate);
    const receiver = { receiver: true };
    const installed = runner.onTaskUpdate!;
    runner.onBeforeRunFiles(['second']);
    expect(runner.onTaskUpdate).toBe(installed);
    const packs = [{ opaque: true }];
    const events = [{ opaque: 'event' }];
    expect(Reflect.apply(installed, receiver, [packs, events])).toBe(ack.promise);
    expect(delegate).toHaveBeenCalledExactlyOnceWith(packs, events);
    expect(base.beforeFiles).toHaveBeenNthCalledWith(1, []);
    expect(base.beforeFiles).toHaveBeenNthCalledWith(2, ['second']);
    ack.resolve();
    await ack.promise;
  });

  it('waits for delayed ACK before resetting the base attempt state', async () => {
    const ack = deferred();
    const runner = harness(() => ack.promise);
    runner.onTaskUpdate!([], []);
    const task = {};
    const attempt = { retry: 0, repeats: 0 };
    const waiting = runner.onBeforeTryTask(task, attempt);
    await setImmediate();
    expect(base.beforeTry).not.toHaveBeenCalled();
    ack.resolve();
    await waiting;
    expect(base.beforeTry).toHaveBeenCalledExactlyOnceWith(task, attempt);
  });

  it('also drains new updates that arrive during an existing wait', async () => {
    const first = deferred();
    const second = deferred();
    const delegate = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const runner = harness(delegate);
    runner.onTaskUpdate!([], []);
    const waiting = runner.onBeforeTryTask({});
    await setImmediate();
    runner.onTaskUpdate!([], []);
    first.resolve();
    await setImmediate();
    expect(base.beforeTry).not.toHaveBeenCalled();
    second.resolve();
    await waiting;
    expect(base.beforeTry).toHaveBeenCalledTimes(1);
    expect(delegate).toHaveBeenCalledTimes(2);
  });

  it('preserves rejection identity and keeps failed ACKs fatal on subsequent attempts', async () => {
    const ack = deferred();
    const runner = harness(() => ack.promise);
    expect(runner.onTaskUpdate!([], [])).toBe(ack.promise);
    const error = new Error('intentional rejected acknowledgement');
    const waiting = expect(runner.onBeforeTryTask({})).rejects.toBe(error);
    ack.reject(error);
    await waiting;
    await expect(runner.onBeforeTryTask({})).rejects.toBe(error);
    expect(base.beforeTry).not.toHaveBeenCalled();
  });

  it('preserves synchronous delegate errors without sending another update', () => {
    const error = new Error('intentional synchronous delegate error');
    const delegate = vi.fn(() => { throw error; });
    const runner = harness(delegate);
    expect(() => runner.onTaskUpdate!([], [])).toThrow(error);
    expect(delegate).toHaveBeenCalledTimes(1);
  });

  it('preserves in-flight updates when reused for another file', async () => {
    const ack = deferred();
    const runner = harness(() => ack.promise);
    runner.onTaskUpdate!([], []);
    runner.onBeforeRunFiles(['second']);
    const waiting = runner.onBeforeTryTask({});
    await setImmediate();
    expect(base.beforeTry).not.toHaveBeenCalled();
    ack.resolve();
    await waiting;
    expect(base.beforeTry).toHaveBeenCalledTimes(1);
  });

  it('allows concurrent attempts to share an ACK without serializing their bodies', async () => {
    const ack = deferred();
    const runner = harness(() => ack.promise);
    runner.onTaskUpdate!([], []);
    const first = runner.onBeforeTryTask({ first: true });
    const second = runner.onBeforeTryTask({ second: true });
    await setImmediate();
    expect(base.beforeTry).not.toHaveBeenCalled();
    ack.resolve();
    await Promise.all([first, second]);
    expect(base.beforeTry).toHaveBeenCalledTimes(2);
  });

  it('honors cancellation received while waiting through the public skip mechanism', async () => {
    const ack = deferred();
    const runner = harness(() => ack.promise);
    runner.onTaskUpdate!([], []);
    const cancelled = new Error('public skip sentinel');
    const skip = vi.fn(() => { throw cancelled; });
    const waiting = expect(runner.onBeforeTryTask({ context: { skip } })).rejects.toBe(cancelled);
    await setImmediate();
    runner.cancel('test-failure');
    expect(base.cancel).toHaveBeenCalledExactlyOnceWith('test-failure');
    expect(skip).not.toHaveBeenCalled();
    ack.resolve();
    await waiting;
    expect(skip).toHaveBeenCalledExactlyOnceWith('Run cancelled while awaiting task updates');
    expect(base.beforeTry).not.toHaveBeenCalled();
  });

  it('does not forgive a rejected ACK after cancellation', async () => {
    const ack = deferred();
    const runner = harness(() => ack.promise);
    runner.onTaskUpdate!([], []);
    const error = new Error('failed ACK despite cancellation');
    const skip = vi.fn();
    const waiting = expect(runner.onBeforeTryTask({ context: { skip } })).rejects.toBe(error);
    await setImmediate();
    runner.cancel('test-failure');
    ack.reject(error);
    await waiting;
    expect(skip).not.toHaveBeenCalled();
    expect(base.beforeTry).not.toHaveBeenCalled();
  });

  it('fails closed if the public delegate is unavailable', () => {
    const runner = new CooperativeVitestRunner({} as never);
    expect(() => runner.onBeforeRunFiles([])).toThrow('Vitest task-update delegate is not installed');
  });
});

const run = promisify(execFile);
const repoRoot = process.cwd();

interface FixtureReport {
  success: boolean;
  numPassedTests: number;
  numFailedTests: number;
  testResults: Array<{
    assertionResults: Array<{ title: string; status: string }>;
  }>;
}

async function runFixture(mode: string) {
  const root = mkdtempSync(path.join(tmpdir(), 'sh-cooperative-runner-'));
  const reportPath = path.join(root, 'report.json');
  let code = 0;
  let output = '';
  try {
    try {
      const result = await run(process.execPath, [
        path.join(repoRoot, 'node_modules/vitest/vitest.mjs'),
        'run', '--config', 'test-infrastructure/cooperative-vitest-fixture.config.ts',
        '--reporter=default', '--reporter=json', `--outputFile=${reportPath}`,
        ...(mode === 'bail' ? ['--bail=1'] : []),
      ], {
        cwd: repoRoot,
        env: { ...process.env, SMALL_HEROES_COOPERATIVE_FIXTURE_MODE: mode },
        windowsHide: true,
        timeout: 25_000,
        maxBuffer: 2 * 1024 * 1024,
      });
      output = result.stdout + result.stderr;
    } catch (error) {
      const failure = error as { code?: number; stdout?: string; stderr?: string; killed?: boolean };
      // Do not count a killed, hung, or unlaunchable child as a successful control.
      if (failure.killed || typeof failure.code !== 'number') throw error;
      code = failure.code;
      output = (failure.stdout ?? '') + (failure.stderr ?? '');
    }
    return { code, output, report: JSON.parse(readFileSync(reportPath, 'utf8')) as FixtureReport };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('canonical cooperative Vitest runner', () => {
  // These new integration budgets include a fresh CLI process. The child keeps
  // Vitest's unchanged 5-second test deadline; no existing budget is raised.
  it('yields with fake clocks while preserving hooks, snapshots and concurrency', async () => {
    const result = await runFixture('positive');
    expect(result.code, result.output).toBe(0);
    expect(result.report.success).toBe(true);
    expect(result.report.numPassedTests).toBe(6);
    expect(result.report.numFailedTests).toBe(0);
  }, 30_000);

  it.each([
    ['assertion', 'intentional assertion failure'],
    ['timeout', 'intentional default deadline failure'],
    ['hook', 'cannot bypass failing hook'],
  ])('does not suppress a real %s failure', async (mode, title) => {
    const result = await runFixture(mode);
    expect(result.code).toBe(1);
    expect(result.report.success).toBe(false);
    expect(result.report.numFailedTests).toBe(1);
    expect(result.report.testResults.flatMap((file) => file.assertionResults))
      .toContainEqual(expect.objectContaining({ title, status: 'failed' }));
    if (mode === 'timeout') expect(result.output).toContain('Test timed out in 5000ms');
  }, 30_000);

  it('keeps unhandled errors fatal even when assertions pass', async () => {
    const result = await runFixture('unhandled');
    expect(result.code).toBe(1);
    expect(result.report.numPassedTests).toBe(1);
    expect(result.output).toContain('intentional unhandled failure');
  }, 30_000);

  it('preserves bail cancellation after a failure', async () => {
    const result = await runFixture('bail');
    expect(result.code).toBe(1);
    expect(result.report.numFailedTests).toBe(1);
    expect(result.report.numPassedTests).toBe(0);
    expect(result.report.testResults.flatMap((file) => file.assertionResults))
      .toContainEqual(expect.objectContaining({ title: 'sentinel after failure', status: 'pending' }));
  }, 30_000);
});
