#!/usr/bin/env node
/**
 * Hermetic operator entry for the QA Wizard Blueprint orphan-claim replacement
 * lane. Run with a TypeScript loader, e.g.:
 *   node --import tsx scripts/qa-wizard-blueprint-replacement-cli.ts <command> [flags]
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
