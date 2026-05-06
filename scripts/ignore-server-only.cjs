/** Stubs the `server-only` package for non-Next tools (e.g. tsx validation scripts). */
const Module = require('module');
const orig = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') {
    return {};
  }
  return orig.apply(this, arguments);
};
