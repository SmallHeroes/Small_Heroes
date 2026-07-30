'use strict';

require('../../../set-identity-board/__tests__/fixtures/deny-network.cjs');

const childProcess = require('node:child_process');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');

const PREFIX =
  'TEST_CANONICAL_MATERIALIZATION_INPUT_SENTINEL';
const credentialPath =
  process.env.CANONICAL_INPUT_DENIED_CREDENTIAL_PATH;
const allowedOutputRoot =
  process.env.CANONICAL_INPUT_ALLOWED_OUTPUT_ROOT;

if (
  typeof credentialPath !== 'string' ||
  !path.isAbsolute(credentialPath) ||
  typeof allowedOutputRoot !== 'string' ||
  !path.isAbsolute(allowedOutputRoot)
) {
  throw new Error(`${PREFIX}:configuration`);
}

const originals = {
  existsSync: fs.existsSync,
  lstatSync: fs.lstatSync,
  statSync: fs.statSync,
  realpathSync: fs.realpathSync,
  openSync: fs.openSync,
  readFileSync: fs.readFileSync,
  writeFileSync: fs.writeFileSync,
  mkdirSync: fs.mkdirSync,
  linkSync: fs.linkSync,
  unlinkSync: fs.unlinkSync,
  spawn: childProcess.spawn,
  spawnSync: childProcess.spawnSync,
  load: Module._load,
};
const writableDescriptors = new Set();

function normalized(value) {
  return path.resolve(value.toString()).toLowerCase();
}

function isCredential(value) {
  return (
    (typeof value === 'string' || Buffer.isBuffer(value)) &&
    normalized(value) === normalized(credentialPath)
  );
}

function denyCredential(method) {
  return function deniedCredentialOperation(value) {
    if (isCredential(value)) {
      throw new Error(`${PREFIX}:credential:${method}`);
    }
    return originals[method].apply(this, arguments);
  };
}

function isAllowedOutput(value) {
  if (typeof value !== 'string' && !Buffer.isBuffer(value)) {
    return false;
  }
  const candidate = normalized(value);
  const root = normalized(allowedOutputRoot);
  return (
    candidate === root ||
    candidate.startsWith(root + path.sep.toLowerCase())
  );
}

fs.existsSync = denyCredential('existsSync');
fs.lstatSync = denyCredential('lstatSync');
fs.statSync = denyCredential('statSync');
fs.realpathSync = denyCredential('realpathSync');
fs.readFileSync = denyCredential('readFileSync');
fs.openSync = function boundedOpen(value, flags) {
  if (isCredential(value)) {
    throw new Error(`${PREFIX}:credential:openSync`);
  }
  const writeRequested =
    typeof flags === 'string' && /[awx+]/.test(flags);
  if (writeRequested && !isAllowedOutput(value)) {
    throw new Error(`${PREFIX}:write:openSync`);
  }
  const descriptor = originals.openSync.apply(this, arguments);
  if (writeRequested) writableDescriptors.add(descriptor);
  return descriptor;
};
fs.writeFileSync = function boundedWrite(value) {
  if (
    typeof value === 'number'
      ? !writableDescriptors.has(value)
      : !isAllowedOutput(value)
  ) {
    throw new Error(`${PREFIX}:write:writeFileSync`);
  }
  return originals.writeFileSync.apply(this, arguments);
};
fs.mkdirSync = function boundedMkdir(value) {
  const candidate = normalized(value);
  const root = normalized(allowedOutputRoot);
  const existingAncestor =
    root.startsWith(candidate + path.sep.toLowerCase()) &&
    originals.existsSync(value);
  if (!isAllowedOutput(value) && !existingAncestor) {
    throw new Error(`${PREFIX}:write:mkdirSync`);
  }
  return originals.mkdirSync.apply(this, arguments);
};
fs.linkSync = function boundedLink(source, destination) {
  if (
    !isAllowedOutput(source) ||
    !isAllowedOutput(destination)
  ) {
    throw new Error(`${PREFIX}:write:linkSync`);
  }
  return originals.linkSync.apply(this, arguments);
};
fs.unlinkSync = function boundedUnlink(value) {
  if (!isAllowedOutput(value)) {
    throw new Error(`${PREFIX}:write:unlinkSync`);
  }
  return originals.unlinkSync.apply(this, arguments);
};
childProcess.spawn = function denySpawn() {
  throw new Error(`${PREFIX}:child_spawn`);
};
childProcess.spawnSync = function denySpawnSync() {
  throw new Error(`${PREFIX}:child_spawn_sync`);
};
Module._load = function denyExternalModule(
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
  return originals.load.call(this, request, parent, isMain);
};

const control =
  process.env.CANONICAL_INPUT_SENTINEL_POSITIVE_CONTROL;
if (control === 'credential_exists') fs.existsSync(credentialPath);
if (control === 'credential_stat') fs.statSync(credentialPath);
if (control === 'credential_lstat') fs.lstatSync(credentialPath);
if (control === 'credential_realpath') fs.realpathSync(credentialPath);
if (control === 'credential_open') fs.openSync(credentialPath, 'r');
if (control === 'credential_read') fs.readFileSync(credentialPath);
if (control === 'provider') require('openai');
if (control === 'database') require('@prisma/client');
if (control === 'storage') require('@supabase/supabase-js');
if (control === 'network') globalThis.fetch('https://example.invalid');
if (control === 'child') childProcess.spawn(process.execPath);
if (control === 'child_sync') childProcess.spawnSync(process.execPath);
if (control === 'write') {
  fs.writeFileSync(
    path.join(path.dirname(allowedOutputRoot), 'forbidden'),
    'x',
  );
}

process.once('exit', () => {
  Object.assign(fs, {
    existsSync: originals.existsSync,
    lstatSync: originals.lstatSync,
    statSync: originals.statSync,
    realpathSync: originals.realpathSync,
    openSync: originals.openSync,
    readFileSync: originals.readFileSync,
    writeFileSync: originals.writeFileSync,
    mkdirSync: originals.mkdirSync,
    linkSync: originals.linkSync,
    unlinkSync: originals.unlinkSync,
  });
  childProcess.spawn = originals.spawn;
  childProcess.spawnSync = originals.spawnSync;
  Module._load = originals.load;
});
