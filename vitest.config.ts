import { availableParallelism } from 'node:os';
import path from 'path';
import { defineConfig } from 'vitest/config';

import {
  createVitestExecutionPolicy,
} from './test-infrastructure/vitest-execution-policy';

export default defineConfig({
  test: {
    include: ['lib/**/*.spec.ts', 'lib/**/__tests__/**/*.spec.ts'],
    // Vitest otherwise uses availableParallelism() - 1 isolated forks.
    // Bound CPU/I/O contention while retaining file-level parallelism.
    ...createVitestExecutionPolicy(availableParallelism()),
  },
  resolve: {
    alias: {
      'server-only': path.resolve(__dirname, 'scripts/shims/server-only.cjs'),
      '@': path.resolve(__dirname, '.'),
    },
  },
});
