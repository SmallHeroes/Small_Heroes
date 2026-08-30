#!/usr/bin/env node
/**
 * Hermetic operator entry for the QA Wizard Blueprint orphan-claim replacement
 * lane. This module chain imports `server-only`, so it MUST run under the
 * server-only shim; the canonical, copy-ready operator command is the npm
 * script that wires the shim in for you:
 *   npm run qa-wizard-blueprint-replacement -- <command> [flags]
 * which expands to the sibling operator-CLI form
 *   tsx --require ./scripts/shims/register-server-only.cjs \
 *     scripts/qa-wizard-blueprint-replacement-cli.ts <command> [flags]
 * Running without the shim (e.g. `node --import tsx <this-file>`) fails inside
 * `server-only` before the parser is ever reached.
 *
 * All argument parsing, validation and output sanitization live in
 * `lib/visual-package/qaWizardBlueprintReplacementCli`. This entry only wires
 * argv to that module and maps the returned exit code to the process.
 */

import { runBlueprintReplacementCliAsync } from '../lib/visual-package/qaWizardBlueprintReplacementCli';

void runBlueprintReplacementCliAsync({ argv: process.argv.slice(2) }).then(
  (code) => {
    process.exitCode = code;
  },
);
