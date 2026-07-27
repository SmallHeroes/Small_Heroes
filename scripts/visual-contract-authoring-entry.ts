/**
 * Private tsx entrypoint for the canonical Visual Contract authoring launcher.
 *
 * Direct execution is refused. The public CJS launcher supplies a one-time child
 * capability and preloads the repository server-only shim before this module or
 * the live authoring graph is evaluated.
 */
import { timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';

import {
  VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ARG_PREFIX,
  VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV,
} from './lib/visual-contract-authoring-launcher-runner.cjs';

const PRIVATE_ENTRYPOINT_ERROR =
  'Direct invocation of scripts/visual-contract-authoring-entry.ts is unsupported. ' +
  'Use: node scripts/visual-contract-authoring.cjs';
const TEST_BOUNDARY_SENTINEL_ENV =
  'SMALL_HEROES_TEST_LIVE_AUTHORING_BOUNDARY_SENTINEL';

function capabilityMatches(
  argToken: string | undefined,
  envToken: string | undefined,
): boolean {
  if (
    !argToken ||
    !envToken ||
    !/^[a-f0-9]{64}$/.test(argToken) ||
    !/^[a-f0-9]{64}$/.test(envToken)
  ) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(argToken, 'utf8'),
    Buffer.from(envToken, 'utf8'),
  );
}

const internalArg = process.argv[2];
const argToken = internalArg?.startsWith(
  VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ARG_PREFIX,
)
  ? internalArg.slice(
      VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ARG_PREFIX.length,
    )
  : undefined;
const envToken =
  process.env[VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV];

delete process.env[
  VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ENV
];
if (
  internalArg?.startsWith(
    VISUAL_CONTRACT_AUTHORING_LAUNCH_CAPABILITY_ARG_PREFIX,
  )
) {
  process.argv.splice(2, 1);
}

if (!capabilityMatches(argToken, envToken)) {
  // eslint-disable-next-line no-console
  console.error(PRIVATE_ENTRYPOINT_ERROR);
  process.exitCode = 1;
} else {
  // Tests may inject throwing credential/write sentinels here: after the
  // exact local tsx runtime is established, but before the CLI core or its
  // future live adapter graph can evaluate. Network coverage remains an
  // independent process preload. The hook is unavailable outside test mode.
  const testBoundarySentinel =
    process.env.NODE_ENV === 'test'
      ? process.env[TEST_BOUNDARY_SENTINEL_ENV]
      : undefined;
  delete process.env[TEST_BOUNDARY_SENTINEL_ENV];
  if (testBoundarySentinel) {
    createRequire(import.meta.url)(testBoundarySentinel);
  }
  void import('./visual-contract-authoring')
    .then(({ runVisualContractAuthoringCli }) =>
      runVisualContractAuthoringCli(process.argv.slice(2)),
    )
    .catch((error) => {
      // Never emit a stack or a raw nested provider payload from the executable.
      // eslint-disable-next-line no-console
      console.error(
        error instanceof Error ? error.message : String(error),
      );
      process.exitCode = 1;
    });
}
