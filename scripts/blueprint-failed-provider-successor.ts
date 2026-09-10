import { runFailedProviderBlueprintCli } from '../lib/visual-package/qaWizardBlueprintFailedProviderCli';

void runFailedProviderBlueprintCli({ argv: process.argv.slice(2), repoRoot: process.cwd(),
  stdout: line => process.stdout.write(`${line}\n`), stderr: line => process.stderr.write(`${line}\n`) })
  .then(code => { process.exitCode = code; });
