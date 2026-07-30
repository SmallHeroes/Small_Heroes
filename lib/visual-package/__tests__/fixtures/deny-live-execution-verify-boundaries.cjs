'use strict';

require('../../../set-identity-board/__tests__/fixtures/deny-network.cjs');

const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');

const PREFIX = 'TEST_LIVE_EXECUTION_VERIFY_SENTINEL';
const originalLoad = Module._load;
const originalReadFileSync = fs.readFileSync;
const deniedCredentialPath = process.env
  .LIVE_EXECUTION_DENIED_CREDENTIAL_PATH;

if (
  typeof deniedCredentialPath !== 'string' ||
  !path.isAbsolute(deniedCredentialPath)
) {
  throw new Error(`${PREFIX}:configuration`);
}

const deniedTopLevelWrites = [
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
  'rmdir',
  'rmdirSync',
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
const deniedPromiseWrites = [
  'appendFile',
  'chmod',
  'chown',
  'copyFile',
  'cp',
  'link',
  'mkdir',
  'mkdtemp',
  'rename',
  'rm',
  'rmdir',
  'symlink',
  'truncate',
  'unlink',
  'utimes',
  'writeFile',
];
const originalTopLevelWrites = new Map();
const originalPromiseWrites = new Map();

function normalized(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32'
    ? resolved.toLowerCase()
    : resolved;
}

fs.readFileSync = function denyCredentialRead(value) {
  if (
    (typeof value === 'string' || Buffer.isBuffer(value)) &&
    normalized(value.toString()) === normalized(deniedCredentialPath)
  ) {
    throw new Error(`${PREFIX}:credential_read`);
  }
  return originalReadFileSync.apply(this, arguments);
};

for (const method of deniedTopLevelWrites) {
  if (typeof fs[method] !== 'function') continue;
  const original = fs[method];
  originalTopLevelWrites.set(method, original);
  fs[method] = function denyWriteBoundary() {
    throw new Error(`${PREFIX}:write:${method}`);
  };
}
for (const method of deniedPromiseWrites) {
  if (typeof fs.promises[method] !== 'function') continue;
  const original = fs.promises[method];
  originalPromiseWrites.set(method, original);
  fs.promises[method] = async function denyPromiseWriteBoundary() {
    throw new Error(`${PREFIX}:promise_write:${method}`);
  };
}

Module._load = function denyProviderModule(request, parent, isMain) {
  if (request === 'openai') {
    throw new Error(`${PREFIX}:provider_import`);
  }
  return originalLoad.call(this, request, parent, isMain);
};

const control =
  process.env.LIVE_EXECUTION_SENTINEL_POSITIVE_CONTROL;
if (control === 'credential') {
  fs.readFileSync(deniedCredentialPath);
}
if (control === 'provider') {
  require('openai');
}
if (control === 'network') {
  globalThis.fetch('https://example.invalid');
}
if (control === 'write') {
  fs.writeFileSync(
    path.join(process.cwd(), 'forbidden-live-execution-write'),
    'x',
  );
}
if (control === 'promise_write') {
  void fs.promises.writeFile(
    path.join(
      process.cwd(),
      'forbidden-live-execution-promise-write',
    ),
    'x',
  );
}

process.once('exit', () => {
  fs.readFileSync = originalReadFileSync;
  for (const [method, original] of originalTopLevelWrites) {
    fs[method] = original;
  }
  for (const [method, original] of originalPromiseWrites) {
    fs.promises[method] = original;
  }
  Module._load = originalLoad;
});
