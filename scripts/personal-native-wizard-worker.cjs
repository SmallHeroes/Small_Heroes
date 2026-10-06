require('./shims/register-server-only.cjs');
require('tsx/cjs');
require('./personal-native-wizard-worker.ts').nativeWizardWorkerCLI(process.argv.slice(2))
  .then(code => { process.exitCode = code; }).catch(error => {
    const code = typeof error?.code === 'string' && /^[a-z0-9_]+$/.test(error.code) ? error.code : 'native_worker_failed';
    process.stderr.write(JSON.stringify({ status: 'failed', code, runtimeEligible: false }) + '\n'); process.exitCode = 1;
  });
