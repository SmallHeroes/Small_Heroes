'use strict';

// Reuse the already hardened raw TCP/TLS/HTTP/HTTPS/fetch sentinel proven by
// the Set Identity Board launcher. Loading it here patches network surfaces
// before the live-authoring graph or OpenAI SDK can evaluate.
require('../../../set-identity-board/__tests__/fixtures/deny-network.cjs');

const fs = require('node:fs');
const ARMED_ENV =
  'SMALL_HEROES_TEST_LIVE_AUTHORING_BOUNDARY_SENTINEL_ARMED';
const ARMED_VALUE = 'credential-write-sentinel/v1';

function deny(boundary) {
  return function deniedLiveAuthoringBoundary() {
    throw new Error(`TEST_LIVE_AUTHORING_SENTINEL: ${boundary} was invoked`);
  };
}

const originalEnvironment = process.env;
const originalSyncMethods = new Map();
const originalPromiseMethods = new Map();
process.env = new Proxy(originalEnvironment, {
  get(target, property, receiver) {
    if (property === 'OPENAI_API_KEY') {
      return deny('credential OPENAI_API_KEY')();
    }
    return Reflect.get(target, property, receiver);
  },
});
process.env[ARMED_ENV] = ARMED_VALUE;

for (const method of [
  'appendFileSync',
  'createWriteStream',
  'linkSync',
  'mkdirSync',
  'renameSync',
  'rmSync',
  'unlinkSync',
  'writeFileSync',
]) {
  if (typeof fs[method] === 'function') {
    originalSyncMethods.set(method, fs[method]);
    fs[method] = deny(`fs.${method}`);
  }
}

for (const method of [
  'appendFile',
  'link',
  'mkdir',
  'open',
  'rename',
  'rm',
  'unlink',
  'writeFile',
]) {
  if (typeof fs.promises[method] === 'function') {
    originalPromiseMethods.set(method, fs.promises[method]);
    fs.promises[method] = deny(`fs.promises.${method}`);
  }
}

process.once('exit', () => {
  for (const [method, implementation] of originalSyncMethods) {
    fs[method] = implementation;
  }
  for (const [method, implementation] of originalPromiseMethods) {
    fs.promises[method] = implementation;
  }
  process.env = originalEnvironment;
});
