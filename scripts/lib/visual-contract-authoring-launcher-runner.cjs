'use strict';

const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV =
  'SMALL_HEROES_VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY';
const VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ARG_PREFIX =
  '--__visual-contract-authoring-launch-capability=';

function resolveVisualContractAuthoringChildExitCode(result, logError = console.error) {
  if (result.error) {
    logError(result.error instanceof Error ? result.error.message : String(result.error));
    return 1;
  }
  if (result.signal) {
    logError(`visual-contract-authoring child terminated by signal ${result.signal}`);
    return 1;
  }
  if (Number.isInteger(result.status)) {
    return result.status;
  }
  logError('visual-contract-authoring child exited without a status');
  return 1;
}

function runVisualContractAuthoringLauncher(options) {
  const capability = (options.createCapability ?? (() => randomBytes(32).toString('hex')))();
  if (!/^[a-f0-9]{64}$/.test(capability)) {
    throw new Error('visual-contract-authoring launcher produced an invalid child capability');
  }

  const environment = options.env;
  const capabilityWasPresent = Object.prototype.hasOwnProperty.call(
    environment,
    VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV
  );
  const previousCapability =
    environment[VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV];
  environment[VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV] = capability;
  try {
    const result = (options.spawnSyncImpl ?? spawnSync)(
      options.execPath,
      [
        options.tsxCli,
        '--require',
        options.shim,
        options.entrypoint,
        `${VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ARG_PREFIX}${capability}`,
        ...options.argv,
      ],
      {
        cwd: options.cwd,
        // Pass the existing environment object through to the OS. Do not
        // enumerate or copy credential-bearing values in launcher code.
        env: environment,
        stdio: 'inherit',
        windowsHide: true,
      }
    );
    return resolveVisualContractAuthoringChildExitCode(result, options.logError);
  } finally {
    if (capabilityWasPresent) {
      environment[VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV] =
        previousCapability;
    } else {
      delete environment[VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV];
    }
  }
}

module.exports = {
  VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ARG_PREFIX,
  VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV,
  resolveVisualContractAuthoringChildExitCode,
  runVisualContractAuthoringLauncher,
};
