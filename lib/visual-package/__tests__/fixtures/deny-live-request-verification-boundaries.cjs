'use strict';

require('./deny-live-request-materialization-external-boundaries.cjs');

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

const SENTINEL_PREFIX =
  'TEST_VERIFICATION_WRITE_SENTINEL';
const TRACE_PREFIX =
  'TEST_VERIFICATION_TSX_WRITE_TRACE:';
const CACHE_FILE_PATTERN = /^\d{1,12}-[a-f0-9]{40}$/;
const TOP_LEVEL_WRITE_METHODS = [
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
const PROMISE_WRITE_METHODS = [
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

function failConfiguration() {
  throw new Error(`${SENTINEL_PREFIX}:configuration`);
}

function pathValue(value) {
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString();
  if (value instanceof URL && value.protocol === 'file:') {
    return fileURLToPath(value);
  }
  return null;
}

function normalizedPath(value) {
  const decoded = pathValue(value);
  if (decoded === null || decoded.length === 0) {
    return null;
  }
  const resolved = path.resolve(decoded);
  return process.platform === 'win32'
    ? resolved.toLowerCase()
    : resolved;
}

function pathsEqual(left, right) {
  return normalizedPath(left) === normalizedPath(right);
}

function configuredAbsolutePath(name) {
  const value = process.env[name];
  if (
    typeof value !== 'string' ||
    !path.isAbsolute(value)
  ) {
    failConfiguration();
  }
  return path.resolve(value);
}

const runtimeTempRoot = configuredAbsolutePath(
  'LIVE_REQUEST_VERIFICATION_SENTINEL_TEMP_ROOT',
);
const cacheRoot = configuredAbsolutePath(
  'LIVE_REQUEST_VERIFICATION_SENTINEL_TSX_CACHE_ROOT',
);
const tsxIdentity =
  typeof process.geteuid === 'function'
    ? String(process.geteuid())
    : os.userInfo().username;
const expectedCacheName = `tsx-${tsxIdentity}`;

let runtimeTempRealPath;
try {
  runtimeTempRealPath = fs.realpathSync(runtimeTempRoot);
} catch {
  failConfiguration();
}
if (
  !pathsEqual(runtimeTempRoot, runtimeTempRealPath) ||
  !pathsEqual(os.tmpdir(), runtimeTempRoot) ||
  !pathsEqual(path.dirname(cacheRoot), runtimeTempRoot) ||
  path.basename(cacheRoot) !== expectedCacheName
) {
  failConfiguration();
}

function cacheRootIsSafe() {
  try {
    if (!fs.existsSync(cacheRoot)) {
      return pathsEqual(
        fs.realpathSync(path.dirname(cacheRoot)),
        runtimeTempRealPath,
      );
    }
    const stat = fs.lstatSync(cacheRoot);
    return (
      stat.isDirectory() &&
      !stat.isSymbolicLink() &&
      pathsEqual(fs.realpathSync(cacheRoot), cacheRoot)
    );
  } catch {
    return false;
  }
}

function cacheFileIsSafe(value) {
  const candidate = normalizedPath(value);
  if (candidate === null || !cacheRootIsSafe()) {
    return false;
  }
  if (
    !pathsEqual(path.dirname(candidate), cacheRoot) ||
    !CACHE_FILE_PATTERN.test(path.basename(candidate))
  ) {
    return false;
  }
  try {
    if (!fs.existsSync(candidate)) return true;
    const stat = fs.lstatSync(candidate);
    return (
      stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.nlink === 1 &&
      pathsEqual(fs.realpathSync(candidate), candidate)
    );
  } catch {
    return false;
  }
}

function mkdirSignatureIsExact(args) {
  const options = args[1];
  return (
    pathsEqual(args[0], cacheRoot) &&
    options !== null &&
    typeof options === 'object' &&
    options.recursive === true &&
    cacheRootIsSafe()
  );
}

function tsxWriteIsAllowed(scope, method, args) {
  if (scope === 'fs' && method === 'mkdirSync') {
    return mkdirSignatureIsExact(args);
  }
  if (
    scope === 'promises' &&
    (method === 'writeFile' || method === 'unlink')
  ) {
    return cacheFileIsSafe(args[0]);
  }
  return false;
}

const allowedEvents = [];

function recordAllowedEvent(scope, method, args) {
  const candidate = normalizedPath(args[0]);
  allowedEvents.push({
    scope,
    method,
    target:
      candidate === null
        ? 'invalid'
        : path
            .relative(runtimeTempRoot, candidate)
            .replace(/\\/g, '/'),
  });
}

function installBoundary(target, scope, methods) {
  const installed = [];
  for (const method of methods) {
    if (typeof target[method] !== 'function') continue;
    const original = target[method];
    target[method] = function denyVerificationWriteBoundary() {
      const args = Array.from(arguments);
      if (tsxWriteIsAllowed(scope, method, args)) {
        recordAllowedEvent(scope, method, args);
        return original.apply(this, args);
      }
      throw new Error(`${SENTINEL_PREFIX}:${scope}:${method}`);
    };
    installed.push(method);
  }
  return installed;
}

const installedTopLevel = installBoundary(
  fs,
  'fs',
  TOP_LEVEL_WRITE_METHODS,
);
const installedPromises = installBoundary(
  fs.promises,
  'promises',
  PROMISE_WRITE_METHODS,
);

Object.defineProperty(
  globalThis,
  '__LIVE_REQUEST_VERIFICATION_WRITE_SENTINEL__',
  {
    value: Object.freeze({
      fs: Object.freeze(installedTopLevel.slice()),
      promises: Object.freeze(installedPromises.slice()),
    }),
    enumerable: false,
    configurable: false,
    writable: false,
  },
);

if (
  process.env
    .LIVE_REQUEST_VERIFICATION_SENTINEL_TRACE === '1'
) {
  process.once('exit', () => {
    process.stderr.write(
      `${TRACE_PREFIX}${JSON.stringify(allowedEvents)}\n`,
    );
  });
}
