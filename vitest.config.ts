import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['lib/**/*.spec.ts', 'lib/**/__tests__/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      'server-only': path.resolve(__dirname, 'scripts/shims/server-only.cjs'),
      '@': path.resolve(__dirname, '.'),
    },
  },
});
