'use strict';

const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV =
  'SMALL_HEROES_VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY';
const VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ARG_PREFIX =
  '--__visual-contract-authoring-launch-capability=';
const OPENAI_RESPONSES_AUTHORING_SCRUBBED_ENV_NAMES = Object.freeze([
  'OPENAI_BASE_URL',
  'OPENAI_ORG_ID',
  'OPENAI_ORGANIZATION',
  'OPENAI_PROJECT_ID',
  'OPENAI_PROJECT',
  'OPENAI_WEBHOOK_SECRET',
  'OPENAI_LOG',
]);
const scrubbedOpenAIEnvironmentNames = new Set(
  OPENAI_RESPONSES_AUTHORING_SCRUBBED_ENV_NAMES
);

function isScrubbedOpenAIEnvironmentName(property) {
  return (
    typeof property === 'string' &&
    scrubbedOpenAIEnvironmentNames.has(property.toUpperCase())
  );
}

function childEnvironmentWithoutOpenAIRoutingAuthority(environment) {
  if (
    !Reflect.ownKeys(environment).some(
      isScrubbedOpenAIEnvironmentName
    )
  ) {
    return environment;
  }
  return new Proxy(environment, {
    ownKeys(target) {
      return Reflect.ownKeys(target).filter(
        (key) => !isScrubbedOpenAIEnvironmentName(key)
      );
    },
    getOwnPropertyDescriptor(target, property) {
      if (isScrubbedOpenAIEnvironmentName(property)) return undefined;
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
    get(target, property, receiver) {
      if (isScrubbedOpenAIEnvironmentName(property)) return undefined;
      return Reflect.get(target, property, receiver);
    },
    has(target, property) {
      if (isScrubbedOpenAIEnvironmentName(property)) return false;
      return Reflect.has(target, property);
    },
  });
}

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
        // Filter only the named SDK routing/identity defaults through a
        // non-copying view. OPENAI_API_KEY and unrelated caller environment
        // remain available to the child without printing their values.
        env: childEnvironmentWithoutOpenAIRoutingAuthority(environment),
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
  OPENAI_RESPONSES_AUTHORING_SCRUBBED_ENV_NAMES,
  VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ARG_PREFIX,
  VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV,
  resolveVisualContractAuthoringChildExitCode,
  runVisualContractAuthoringLauncher,
};
