'use strict';

const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const BOARD_MINT_LAUNCH_CAPABILITY_ENV = 'SMALL_HEROES_BOARD_MINT_LAUNCH_CAPABILITY';
const BOARD_MINT_LAUNCH_CAPABILITY_ARG_PREFIX = '--__board-mint-launch-capability=';

function resolveChildExitCode(result, logError = console.error) {
  if (result.error) {
    logError(result.error instanceof Error ? result.error.message : String(result.error));
    return 1;
  }
  if (result.signal) {
    logError(`mint-set-identity-board child terminated by signal ${result.signal}`);
    return 1;
  }
  if (Number.isInteger(result.status)) {
    return result.status;
  }
  logError('mint-set-identity-board child exited without a status');
  return 1;
}

function runSetIdentityBoardLauncher(options) {
  const capability = (options.createCapability ?? (() => randomBytes(32).toString('hex')))();
  if (!/^[a-f0-9]{64}$/.test(capability)) {
    throw new Error('mint-set-identity-board launcher produced an invalid child capability');
  }

  const childEnv = {
    ...options.env,
    [BOARD_MINT_LAUNCH_CAPABILITY_ENV]: capability,
  };
  const result = (options.spawnSyncImpl ?? spawnSync)(
    options.execPath,
    [
      options.tsxCli,
      '--require',
      options.shim,
      options.entrypoint,
      `${BOARD_MINT_LAUNCH_CAPABILITY_ARG_PREFIX}${capability}`,
      ...options.argv,
    ],
    {
      cwd: options.cwd,
      env: childEnv,
      stdio: 'inherit',
      windowsHide: true,
    }
  );

  return resolveChildExitCode(result, options.logError);
}

module.exports = {
  BOARD_MINT_LAUNCH_CAPABILITY_ARG_PREFIX,
  BOARD_MINT_LAUNCH_CAPABILITY_ENV,
  resolveChildExitCode,
  runSetIdentityBoardLauncher,
};
