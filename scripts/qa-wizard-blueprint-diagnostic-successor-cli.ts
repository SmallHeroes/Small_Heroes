#!/usr/bin/env node
/** Operator entry for the one-shot Blueprint diagnostic successor lane. */

import { runBlueprintDiagnosticSuccessorCliAsync } from '../lib/visual-package/qaWizardBlueprintDiagnosticSuccessorCli';

void runBlueprintDiagnosticSuccessorCliAsync({
  argv: process.argv.slice(2),
}).then((code) => {
  process.exitCode = code;
});
