/**
 * Internal tsx entrypoint for `mint-set-identity-board.cjs`.
 *
 * Direct execution is refused. The CJS launcher supplies a one-time child capability and preloads the repository's
 * server-only shim before this module or its transitive graph is evaluated.
 */
import { timingSafeEqual } from 'node:crypto';

import {
  BOARD_MINT_LAUNCH_CAPABILITY_ARG_PREFIX,
  BOARD_MINT_LAUNCH_CAPABILITY_ENV,
} from './lib/set-identity-board-launcher-runner.cjs';

const PRIVATE_ENTRYPOINT_ERROR =
  'Direct invocation of scripts/mint-set-identity-board-entry.ts is unsupported. ' +
  'Use: node scripts/mint-set-identity-board.cjs';

function capabilityMatches(argToken: string | undefined, envToken: string | undefined): boolean {
  if (!argToken || !envToken || !/^[a-f0-9]{64}$/.test(argToken) || !/^[a-f0-9]{64}$/.test(envToken)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(argToken, 'utf8'), Buffer.from(envToken, 'utf8'));
}

const internalArg = process.argv[2];
const argToken = internalArg?.startsWith(BOARD_MINT_LAUNCH_CAPABILITY_ARG_PREFIX)
  ? internalArg.slice(BOARD_MINT_LAUNCH_CAPABILITY_ARG_PREFIX.length)
  : undefined;
const envToken = process.env[BOARD_MINT_LAUNCH_CAPABILITY_ENV];

// Consume launcher authority before the CLI core loads. Neither descendants nor runCli receive the sentinel.
delete process.env[BOARD_MINT_LAUNCH_CAPABILITY_ENV];
if (internalArg?.startsWith(BOARD_MINT_LAUNCH_CAPABILITY_ARG_PREFIX)) {
  process.argv.splice(2, 1);
}

if (!capabilityMatches(argToken, envToken)) {
  // eslint-disable-next-line no-console
  console.error(PRIVATE_ENTRYPOINT_ERROR);
  process.exitCode = 1;
} else {
  void import('./mint-set-identity-board')
    .then(({ runCli }) => runCli(process.argv.slice(2)))
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
