'use strict';

const { spawnSync } = require('node:child_process');

function platformEnvironmentNames(platform) {
  return platform === 'win32'
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
}

function environmentValue(environment, name, platform) {
  if (platform !== 'win32') return environment[name];
  const key = Object.keys(environment).find(
    (candidate) =>
      candidate.toLowerCase() === name.toLowerCase(),
  );
  return key === undefined ? undefined : environment[key];
}

function canonicalMaterializationInputEnvironment(
  environment,
  platform = process.platform,
) {
  const result = Object.create(null);
  for (const name of platformEnvironmentNames(platform)) {
    const value = environmentValue(
      environment,
      name,
      platform,
    );
    if (value !== undefined) result[name] = value;
  }
  result.TSX_DISABLE_CACHE = '1';
  return result;
}

function runCanonicalMaterializationInputLauncher(options) {
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
      env: canonicalMaterializationInputEnvironment(
        options.env,
        options.platform,
      ),
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
    },
  );
}

function canonicalMaterializationInputLauncherDisposition(
  result,
) {
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
  canonicalMaterializationInputEnvironment,
  canonicalMaterializationInputLauncherDisposition,
  platformEnvironmentNames,
  runCanonicalMaterializationInputLauncher,
};
