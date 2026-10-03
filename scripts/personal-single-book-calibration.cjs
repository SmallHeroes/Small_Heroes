// Explicit local launcher. The TypeScript module itself is inert on import.
require('./shims/register-server-only.cjs');
require('tsx/cjs');
const { singleBookCalibrationCLI } = require('./personal-single-book-calibration.ts');
singleBookCalibrationCLI(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => {
  const code = typeof error?.code === 'string' && /^[a-z0-9_]+$/.test(error.code) ? error.code : 'driver_failed';
  process.stderr.write(JSON.stringify({ status: 'failed', code, runtimeEligible: false }) + '\n');
  process.exitCode = 1;
});
