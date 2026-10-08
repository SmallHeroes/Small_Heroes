require('./shims/register-server-only.cjs');
require('tsx/cjs');
const { simpleBookVisualContinuationCLI } = require('./personal-simple-book-visual-continuation.ts');
simpleBookVisualContinuationCLI(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => {
  console.error(JSON.stringify({ error: error && typeof error.code === 'string' && /^[a-z0-9_]{1,80}$/.test(error.code) ? error.code : 'visual_setup_failed', runtimeEligible: false }));
  process.exitCode = 1;
});
