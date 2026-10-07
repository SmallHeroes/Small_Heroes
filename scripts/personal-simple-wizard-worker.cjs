require('./shims/register-server-only.cjs');
require('tsx/cjs');
require('./personal-simple-wizard-worker.ts').simpleWizardWorkerCLI(process.argv.slice(2))
  .then(code => { process.exitCode = code; }).catch(() => {
    process.stderr.write(JSON.stringify({ status: 'failed', code: 'simple_worker_setup_failed', runtimeEligible: false }) + '\n'); process.exitCode = 1;
  });
