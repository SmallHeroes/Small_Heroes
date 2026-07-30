'use strict';

const { spawnSync } = require('node:child_process');

const PLATFORM_ENVIRONMENT_NAMES =
  process.platform === 'win32'
    ? [
        'ComSpec',
        'PATH',
        'PATHEXT',
        'SystemRoot',
        'TEMP',
        'TMP',
        'WINDIR',
      ]
    : ['LANG', 'LC_ALL', 'PATH', 'TMPDIR', 'TZ'];

function environmentValue(environment, name) {
  if (process.platform !== 'win32') return environment[name];
  const key = Object.keys(environment).find(
    (candidate) =>
      candidate.toLowerCase() === name.toLowerCase(),
  );
  return key === undefined ? undefined : environment[key];
}

function supervisorEnvironment(environment) {
  const result = Object.create(null);
  for (const name of PLATFORM_ENVIRONMENT_NAMES) {
    const value = environmentValue(environment, name);
    if (value !== undefined) result[name] = value;
  }
  result.TSX_DISABLE_CACHE = '1';
  return result;
}

function runCanonicalLiveExecutionSupervisorLauncher(options) {
  return (options.spawnSyncImpl ?? spawnSync)(
    options.execPath,
    [
      options.tsxCli,
      '--require',
      options.shim,
      options.entrypoint,
      ...options.argv,
    ],
    {
      cwd: options.cwd,
      env: supervisorEnvironment(options.env),
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
    },
  );
}

function canonicalLiveExecutionSupervisorLauncherDisposition(result) {
  if (result.error) return { kind: 'exit', exitCode: 1 };
  if (result.signal) {
    return { kind: 'signal', signal: result.signal };
  }
  if (Number.isInteger(result.status)) {
    return { kind: 'exit', exitCode: result.status };
  }
  return { kind: 'exit', exitCode: 1 };
}

module.exports = {
  PLATFORM_ENVIRONMENT_NAMES,
  canonicalLiveExecutionSupervisorLauncherDisposition,
  runCanonicalLiveExecutionSupervisorLauncher,
  supervisorEnvironment,
};
