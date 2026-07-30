'use strict';

const originalWrite = process.stdout.write;
let armed = true;

process.stdout.write = function throwFirstEntryOutput() {
  if (armed) {
    armed = false;
    process.stdout.write = originalWrite;
    throw new Error(
      'ENTRY_UNEXPECTED_RAW_SECRET ' +
        'OPENAI_API_KEY=fake-never-leak ' +
        'C:\\sensitive\\credential.env',
    );
  }
  return originalWrite.apply(this, arguments);
};

process.once('exit', () => {
  process.stdout.write = originalWrite;
});
