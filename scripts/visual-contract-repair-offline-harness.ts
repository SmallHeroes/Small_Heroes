import fs from 'node:fs';
import path from 'node:path';

import {
  runOfflineRepairHarness,
  type OfflineRepairHarnessScenario,
} from '@/lib/visual-contract-compiler/offlineRepairHarness';

function usage(): string {
  return [
    'Offline Visual Contract repair harness ($0, no provider):',
    '  npm run visual-contract-repair-harness -- --scenario <json>',
    '',
    'The scenario JSON contains input, initialDraft, optional repairResponses,',
    'and optional completeDiagnosticIssuesByAttempt. The command writes no files.',
  ].join('\n');
}

function scenarioPath(argv: readonly string[]): string {
  if (
    argv.length !== 2 ||
    argv[0] !== '--scenario' ||
    !argv[1] ||
    argv[1].startsWith('--')
  ) {
    throw new Error('invalid_arguments');
  }
  return path.resolve(process.cwd(), argv[1]);
}

async function main(): Promise<void> {
  let filePath: string;
  try {
    filePath = scenarioPath(process.argv.slice(2));
  } catch {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 2;
    return;
  }
  const scenario = JSON.parse(
    fs.readFileSync(filePath, 'utf8'),
  ) as OfflineRepairHarnessScenario;
  const result = await runOfflineRepairHarness(scenario);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.monotonicCompleteIssueDelta === false) {
    process.exitCode = 1;
  }
}

void main();
