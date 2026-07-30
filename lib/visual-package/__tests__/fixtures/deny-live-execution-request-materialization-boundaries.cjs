'use strict';

require('../../../set-identity-board/__tests__/fixtures/deny-network.cjs');

const childProcess = require('node:child_process');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');

const PREFIX =
  'TEST_LIVE_EXECUTION_REQUEST_MATERIALIZATION_SENTINEL';
const deniedCredentialPath =
  process.env.LIVE_EXECUTION_MATERIALIZATION_DENIED_CREDENTIAL_PATH;
const allowedOutputRoot =
  process.env.LIVE_EXECUTION_MATERIALIZATION_ALLOWED_OUTPUT_ROOT;

if (
  typeof deniedCredentialPath !== 'string' ||
  !path.isAbsolute(deniedCredentialPath) ||
  typeof allowedOutputRoot !== 'string' ||
  !path.isAbsolute(allowedOutputRoot)
) {
  throw new Error(`${PREFIX}:configuration`);
}

const originalLoad = Module._load;
const originalReadFileSync = fs.readFileSync;
const originalSpawn = childProcess.spawn;
const originalSpawnSync = childProcess.spawnSync;
const originalOpenSync = fs.openSync;
const originalWriteFileSync = fs.writeFileSync;
const originalMkdirSync = fs.mkdirSync;
const originalLinkSync = fs.linkSync;
const originalUnlinkSync = fs.unlinkSync;
const writableDescriptors = new Set();

function normalized(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32'
    ? resolved.toLowerCase()
    : resolved;
}

function isAllowedPath(value) {
  if (typeof value !== 'string' && !Buffer.isBuffer(value)) {
    return false;
  }
  const candidate = normalized(value.toString());
  const root = normalized(allowedOutputRoot);
  return (
    candidate === root ||
    candidate.startsWith(
      root + path.sep,
    )
  );
}

fs.readFileSync = function denyCredentialRead(value) {
  if (
    (typeof value === 'string' || Buffer.isBuffer(value)) &&
    normalized(value.toString()) ===
      normalized(deniedCredentialPath)
  ) {
    throw new Error(`${PREFIX}:credential_read`);
  }
  return originalReadFileSync.apply(this, arguments);
};

fs.openSync = function boundedOpen(value, flags) {
  const writeRequested =
    typeof flags === 'string' &&
    /[awx+]/.test(flags);
  if (writeRequested && !isAllowedPath(value)) {
    throw new Error(`${PREFIX}:write:openSync`);
  }
  const descriptor = originalOpenSync.apply(this, arguments);
  if (writeRequested) writableDescriptors.add(descriptor);
  return descriptor;
};

fs.writeFileSync = function boundedWrite(value) {
  if (
    typeof value === 'number'
      ? !writableDescriptors.has(value)
      : !isAllowedPath(value)
  ) {
    throw new Error(`${PREFIX}:write:writeFileSync`);
  }
  return originalWriteFileSync.apply(this, arguments);
};

fs.mkdirSync = function boundedMkdir(value) {
  const candidate = normalized(value);
  const root = normalized(allowedOutputRoot);
  const existingAncestor =
    root.startsWith(candidate + path.sep) &&
    fs.existsSync(value);
  if (!isAllowedPath(value) && !existingAncestor) {
    throw new Error(`${PREFIX}:write:mkdirSync`);
  }
  return originalMkdirSync.apply(this, arguments);
};

fs.linkSync = function boundedLink(source, destination) {
  if (!isAllowedPath(source) || !isAllowedPath(destination)) {
    throw new Error(`${PREFIX}:write:linkSync`);
  }
  return originalLinkSync.apply(this, arguments);
};

fs.unlinkSync = function boundedUnlink(value) {
  if (!isAllowedPath(value)) {
    throw new Error(`${PREFIX}:write:unlinkSync`);
  }
  return originalUnlinkSync.apply(this, arguments);
};

childProcess.spawn = function denyLiveSpawn() {
  throw new Error(`${PREFIX}:live_spawn`);
};

childProcess.spawnSync = function allowOnlyGit(executable) {
  const basename =
    typeof executable === 'string'
      ? path.basename(executable).toLowerCase()
      : '';
  if (
    basename !== 'git' &&
    basename !== 'git.exe'
  ) {
    throw new Error(`${PREFIX}:non_git_spawn`);
  }
  return originalSpawnSync.apply(this, arguments);
};

Module._load = function denyExternalModules(
  request,
  parent,
  isMain,
) {
  if (
    request === 'openai' ||
    request === '@prisma/client' ||
    request === '@supabase/supabase-js'
  ) {
    throw new Error(`${PREFIX}:external_module:${request}`);
  }
  return originalLoad.call(this, request, parent, isMain);
};

const control =
  process.env
    .LIVE_EXECUTION_MATERIALIZATION_SENTINEL_POSITIVE_CONTROL;
if (control === 'credential') {
  fs.readFileSync(deniedCredentialPath);
}
if (control === 'provider') {
  require('openai');
}
if (control === 'database') {
  require('@prisma/client');
}
if (control === 'storage') {
  require('@supabase/supabase-js');
}
if (control === 'network') {
  globalThis.fetch('https://example.invalid');
}
if (control === 'write') {
  fs.writeFileSync(
    path.join(path.dirname(allowedOutputRoot), 'forbidden-write'),
    'x',
  );
}
if (control === 'preflight') {
  childProcess.spawnSync(process.execPath, [
    'scripts/visual-contract-authoring.cjs',
    'preflight',
  ]);
}
if (control === 'live_spawn') {
  childProcess.spawn(process.execPath, ['-e', 'void 0']);
}

process.once('exit', () => {
  fs.readFileSync = originalReadFileSync;
  fs.openSync = originalOpenSync;
  fs.writeFileSync = originalWriteFileSync;
  fs.mkdirSync = originalMkdirSync;
  fs.linkSync = originalLinkSync;
  fs.unlinkSync = originalUnlinkSync;
  childProcess.spawn = originalSpawn;
  childProcess.spawnSync = originalSpawnSync;
  Module._load = originalLoad;
});
