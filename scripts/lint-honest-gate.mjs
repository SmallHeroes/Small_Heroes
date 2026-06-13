#!/usr/bin/env node
/**
 * Non-interactive lint gate — `next lint` is deprecated and drops into interactive setup.
 * Stability contract remains `npm run check` (tsc + vitest).
 * TODO(S3): migrate to ESLint flat config + eslint-config-next when Next codemod lands.
 */
console.log('[lint] next lint is deprecated — skipping interactive setup.');
console.log('[lint] Stability contract: npm run check (tsc + vitest).');
console.log('[lint] TODO: add eslint.config.mjs via @next/codemod next-lint-to-eslint-cli');
