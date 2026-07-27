'use strict';

require('../../../set-identity-board/__tests__/fixtures/deny-network.cjs');

const Module = require('node:module');

const originalEnvironment = process.env;
const originalLoad = Module._load;

process.env = new Proxy(originalEnvironment, {
  get(target, property, receiver) {
    if (property === 'OPENAI_API_KEY') {
      throw new Error(
        'TEST_MATERIALIZATION_SENTINEL: credential boundary was invoked',
      );
    }
    return Reflect.get(target, property, receiver);
  },
  has(target, property) {
    if (property === 'OPENAI_API_KEY') {
      throw new Error(
        'TEST_MATERIALIZATION_SENTINEL: credential existence boundary was invoked',
      );
    }
    return Reflect.has(target, property);
  },
  getOwnPropertyDescriptor(target, property) {
    if (property === 'OPENAI_API_KEY') {
      throw new Error(
        'TEST_MATERIALIZATION_SENTINEL: credential existence boundary was invoked',
      );
    }
    return Reflect.getOwnPropertyDescriptor(target, property);
  },
});

Module._load = function denyProviderModule(
  request,
  parent,
  isMain,
) {
  if (request === 'openai') {
    throw new Error(
      'TEST_MATERIALIZATION_SENTINEL: provider module was imported',
    );
  }
  return originalLoad.call(this, request, parent, isMain);
};

process.once('exit', () => {
  Module._load = originalLoad;
  process.env = originalEnvironment;
});
