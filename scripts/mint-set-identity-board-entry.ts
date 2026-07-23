/**
 * Internal tsx entrypoint for `mint-set-identity-board.cjs`.
 *
 * Do not invoke this file directly. The CJS launcher is responsible for starting the exact local tsx CLI with the
 * repository's server-only shim preloaded before this module or its transitive graph is evaluated.
 */
import { runCli } from './mint-set-identity-board';

runCli(process.argv.slice(2)).catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
