/** Explicit one-use same-book editor repair. No credentials, provider calls or book mutation on import. */
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { prepareSimpleBookRepair } from '../lib/personal-wizard/simple-book-repair';
import { runSimpleBookWorkerPipeline } from './personal-simple-wizard-worker';
import { readAuditionApproval } from './personal-simple-book-illustrator';
import { realDirectory } from './personal-causal-trial-journal';

export async function simpleBookRepairCLI(argv: string[]) {
  if (argv.length < 2 || argv.length > 3 || argv[0] !== '--config' || !path.isAbsolute(argv[1]) ||
      argv.length === 3 && argv[2] !== '--execute') throw Error('repair_arguments');
  const ready = await prepareSimpleBookRepair(argv[1]);
  if (createHash('sha256').update(readFileSync(ready.parent.original.executable)).digest('hex') !== ready.parent.original.executableSha256) throw Error('repair_executable');
  readAuditionApproval(ready.parent.original);
  const cliWorkspace = path.join(ready.parent.original.outputParent, 'simple-book-cli-workspace'); realDirectory(cliWorkspace);
  if (argv.length === 2) {
    console.log(JSON.stringify({ status: 'controlled_editor_repair_preview', requestId: ready.parent.job.queued.requestId,
      inherited: ready.inherited, extraEngineeringMicroUsd: ready.extra, totalBeforeMicroUsd: ready.externalMicroUsd,
      maximumMicroUsd: 12000000, permittedNewEditorCalls: 1, providerCalls: 0, keyReads: 0, runtimeEligible: false })); return 0;
  }
  if (ready.parent.original.illustratedAudition && process.env.GPT_IMAGE_EDIT_MAX_REFERENCES !== '4') throw Error('repair_reference_limit');
  const claimed = ready.claim();
  return runSimpleBookWorkerPipeline({ config: ready.parent.original, configFile: argv[1], cliWorkspace, worker: claimed.worker,
    repair: { budget: claimed.budget, inheritedAttempts: ready.parent.inherited.logicalAttempts + ready.inherited.logicalAttempts,
      assertCurrent: ready.verify, prior: ready.repair.prior, readings: ready.repair.readings } });
}
