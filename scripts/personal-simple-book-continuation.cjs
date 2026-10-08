require('./shims/register-server-only.cjs');
require('tsx/cjs');
const { simpleBookContinuationCLI } = require('./personal-simple-book-continuation.ts');
simpleBookContinuationCLI(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => {
  console.error(JSON.stringify({ error: error && typeof error.code === 'string' && /^[a-z0-9_]{1,80}$/.test(error.code) ? error.code : 'continuation_failed', runtimeEligible: false }));
  process.exitCode = 1;
});
