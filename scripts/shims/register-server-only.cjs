const Module = require('module');
const path = require('path');

const shimPath = path.join(__dirname, 'server-only.cjs');
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'server-only') {
    return shimPath;
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
