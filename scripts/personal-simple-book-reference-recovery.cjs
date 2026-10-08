require('./shims/register-server-only.cjs');
require('tsx/cjs');
const { simpleBookReferenceRecoveryCLI } = require('./personal-simple-book-reference-recovery.ts');
simpleBookReferenceRecoveryCLI(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => {
  console.error(JSON.stringify({ error: error && typeof error.code === 'string' && /^[a-z0-9_]{1,80}$/.test(error.code) ? error.code : 'reference_recovery_setup_failed', runtimeEligible: false }));
  process.exitCode = 1;
});
