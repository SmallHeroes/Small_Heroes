'use strict';

// Reuse the already hardened raw TCP/TLS/HTTP/HTTPS/fetch sentinel proven by
// the Set Identity Board launcher. Loading it here patches network surfaces
// before the live-authoring graph or OpenAI SDK can evaluate.
require('../../../set-identity-board/__tests__/fixtures/deny-network.cjs');

const fs = require('node:fs');

function deny(boundary) {
  return function deniedLiveAuthoringBoundary() {
    throw new Error(`TEST_LIVE_AUTHORING_SENTINEL: ${boundary} was invoked`);
  };
}

const originalEnvironment = process.env;
process.env = new Proxy(originalEnvironment, {
  get(target, property, receiver) {
    if (property === 'OPENAI_API_KEY') {
      return deny('credential OPENAI_API_KEY')();
    }
    return Reflect.get(target, property, receiver);
  },
});

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
    fs.promises[method] = deny(`fs.promises.${method}`);
  }
}
