'use strict';

const fs = require('node:fs');

const originalReadFileSync = fs.readFileSync;
const originalReadFile = fs.promises.readFile;
const coreSuffix =
  '/scripts/visual-contract-authoring.ts';

function isCoreRead(value) {
  return String(value)
    .replaceAll('\\', '/')
    .endsWith(coreSuffix);
}

fs.readFileSync = function failIfCoreImports(file, ...args) {
  if (isCoreRead(file)) {
    throw new Error(
      'TEST_LIVE_AUTHORING_CORE_IMPORT_TRIPWIRE',
    );
  }
  return originalReadFileSync.call(this, file, ...args);
};

fs.promises.readFile =
  async function failIfCoreImports(file, ...args) {
    if (isCoreRead(file)) {
      throw new Error(
        'TEST_LIVE_AUTHORING_CORE_IMPORT_TRIPWIRE',
      );
    }
    return originalReadFile.call(this, file, ...args);
  };

// Deliberately do not set the required arming marker.
process.once('exit', () => {
  fs.readFileSync = originalReadFileSync;
  fs.promises.readFile = originalReadFile;
});
