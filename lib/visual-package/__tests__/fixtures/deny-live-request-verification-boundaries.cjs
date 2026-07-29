'use strict';

require('./deny-live-request-materialization-external-boundaries.cjs');

const fs = require('node:fs');

const deniedWriteMethods = [
  'appendFile',
  'appendFileSync',
  'chmod',
  'chmodSync',
  'chown',
  'chownSync',
  'copyFile',
  'copyFileSync',
  'cp',
  'cpSync',
  'createWriteStream',
  'link',
  'linkSync',
  'mkdir',
  'mkdirSync',
  'mkdtemp',
  'mkdtempSync',
  'rename',
  'renameSync',
  'rm',
  'rmSync',
  'symlink',
  'symlinkSync',
  'truncate',
  'truncateSync',
  'unlink',
  'unlinkSync',
  'utimes',
  'utimesSync',
  'writeFile',
  'writeFileSync',
];

for (const method of deniedWriteMethods) {
  if (typeof fs[method] !== 'function') continue;
  const original = fs[method];
  fs[method] = function denyVerificationWriteBoundary() {
    const stack = new Error().stack || '';
    if (
      stack.includes('node_modules/tsx/') ||
      stack.includes('node_modules\\tsx\\')
    ) {
      return original.apply(this, arguments);
    }
    throw new Error(
      `TEST_VERIFICATION_WRITE_SENTINEL:${method}`,
    );
  };
}
