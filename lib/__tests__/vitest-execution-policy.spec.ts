import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createVitestExecutionPolicy,
  resolveVitestMaxWorkers,
  VITEST_WORKER_CEILING,
} from '../../test-infrastructure/vitest-execution-policy';

describe('Vitest execution policy', () => {
  it.each([
    { available: 1, expected: 1 },
    { available: 2, expected: 1 },
    { available: 3, expected: 2 },
    { available: 4, expected: 3 },
    { available: 5, expected: 4 },
    { available: 24, expected: 4 },
    { available: Number.NaN, expected: 1 },
    { available: Number.POSITIVE_INFINITY, expected: 1 },
  ])(
    'resolves $available available slot(s) to $expected worker(s)',
    ({ available, expected }) => {
      expect(resolveVitestMaxWorkers(available)).toBe(
        expected,
      );
    },
  );

  it('keeps file parallelism while enforcing the portable worker ceiling', () => {
    expect(VITEST_WORKER_CEILING).toBe(4);
    expect(
      createVitestExecutionPolicy(availableParallelism()),
    ).toEqual({
      fileParallelism: true,
      maxWorkers: Math.min(
        VITEST_WORKER_CEILING,
        Math.max(1, availableParallelism() - 1),
      ),
    });
  });

  it('wires the neutral policy into the active config without importing the config', () => {
    const configSource = readFileSync(
      path.join(process.cwd(), 'vitest.config.ts'),
      'utf8',
    );

    expect(configSource).toContain(
      "from './test-infrastructure/vitest-execution-policy'",
    );
    expect(configSource).toContain(
      '...createVitestExecutionPolicy(availableParallelism())',
    );
  });
});
