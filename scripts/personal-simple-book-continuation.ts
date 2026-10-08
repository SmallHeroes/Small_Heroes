/** Explicit local one-use same-book continuation. No work or credential read on import. */
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { prepareSimpleBookContinuation } from '../lib/personal-wizard/simple-book-continuation';
import { runSimpleBookWorkerPipeline } from './personal-simple-wizard-worker';
import { readAuditionApproval } from './personal-simple-book-illustrator';
import { realDirectory } from './personal-causal-trial-journal';

export async function simpleBookContinuationCLI(argv: string[]) {
  if (argv.length < 2 || argv.length > 3 || argv[0] !== '--config' || !path.isAbsolute(argv[1]) ||
      argv.length === 3 && argv[2] !== '--execute') throw Error('continuation_arguments');
  const ready = prepareSimpleBookContinuation(argv[1]);
  if (createHash('sha256').update(readFileSync(ready.original.executable)).digest('hex') !== ready.original.executableSha256) throw Error('continuation_executable');
  readAuditionApproval(ready.original);
  const cliWorkspace = path.join(ready.original.outputParent, 'simple-book-cli-workspace'); realDirectory(cliWorkspace);
  if (argv.length === 2) {
    console.log(JSON.stringify({ status: 'controlled_continuation_preview', requestId: ready.job.queued.requestId,
      inherited: ready.inherited, extraEngineeringMicroUsd: ready.extra, totalBeforeMicroUsd: ready.externalMicroUsd,
      maximumMicroUsd: 12000000, newWriterCalls: 0, providerCalls: 0, keyReads: 0, runtimeEligible: false })); return 0;
  }
  if (ready.original.illustratedAudition && process.env.GPT_IMAGE_EDIT_MAX_REFERENCES !== '4') throw Error('continuation_reference_limit');
  const claimed = ready.claim();
  return runSimpleBookWorkerPipeline({ config: ready.original, configFile: argv[1], cliWorkspace, worker: claimed.worker,
    continuation: { budget: claimed.budget, inheritedAttempts: ready.inherited.logicalAttempts,
      assertCurrent: ready.verify, reuseWriting: ready.reuseWriting } });
}
