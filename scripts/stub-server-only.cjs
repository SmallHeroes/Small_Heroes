/**
 * stub-server-only.cjs — node `--require` hook.
 *
 * When Next.js bundles, it swaps the `server-only` package for an empty
 * module via the `react-server` export condition. `tsx` running scripts
 * directly has no bundler, so `server-only/index.js` throws as designed.
 * This hook resolves `server-only` to a local no-op file (absolute path,
 * which bypasses the package's `exports` gate that blocks subpath imports).
 *
 * Use:
 *   npx tsx --require ./scripts/stub-server-only.cjs ./scripts/<your-script>.ts
 *
 * Safe: only intercepts the exact specifier `server-only`; nothing else.
 */
const path = require('node:path');
const Module = require('node:module');

const EMPTY = path.join(__dirname, 'server-only-empty.cjs');
const origResolveFilename = Module._resolveFilename.bind(Module);

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'server-only') {
    return EMPTY;
  }
  return origResolveFilename(request, parent, isMain, options);
};
