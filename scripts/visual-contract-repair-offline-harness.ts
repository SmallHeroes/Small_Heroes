import fs from 'node:fs';
import path from 'node:path';

import {
  runOfflineRepairHarness,
  type OfflineRepairHarnessScenario,
} from '@/lib/visual-contract-compiler/offlineRepairHarness';
import { replayVisualContractAuthoringEvidence } from '@/lib/visual-package/visualContractAuthoringReplayRunner';
import type { StorySourceAuthoritySnapshot } from '@/lib/visual-package/storySourceAuthority';
import type {
  VisualContractAuthoringReceipt,
  VisualContractAuthoringRequest,
} from '@/lib/visual-package/visualContractAuthoringLifecycle';
import type { VisualContractAuthoringReplayEvidence } from '@/lib/visual-package/visualContractAuthoringReplayEvidence';

const MAX_REPLAY_ARTIFACT_BYTES = 16 * 1024 * 1024;

function usage(): string {
  return [
    'Offline Visual Contract repair harness ($0, no provider):',
    '  npm run visual-contract-repair-harness -- --scenario <json>',
    '  npm run visual-contract-repair-harness -- --capture <json> --snapshot <json> --request <json> --receipt <json>',
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

function capturePaths(argv: readonly string[]): {
  capture: string;
  snapshot: string;
  request: string;
  receipt: string;
} | null {
  if (argv.length !== 8) return null;
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      return null;
    }
    values.set(key, path.resolve(process.cwd(), value));
  }
  if (
    values.size !== 4 ||
    !values.has('--capture') ||
    !values.has('--snapshot') ||
    !values.has('--request') ||
    !values.has('--receipt')
  ) {
    return null;
  }
  return {
    capture: values.get('--capture')!,
    snapshot: values.get('--snapshot')!,
    request: values.get('--request')!,
    receipt: values.get('--receipt')!,
  };
}

function readContentAddressedJson(filePath: string): unknown {
  const repoRealPath = fs.realpathSync(process.cwd());
  const suppliedStat = fs.lstatSync(filePath);
  const fileRealPath = fs.realpathSync(filePath);
  const relative = path.relative(repoRealPath, fileRealPath);
  const stat = fs.statSync(fileRealPath);
  if (
    suppliedStat.isSymbolicLink() ||
    !stat.isFile() ||
    stat.size > MAX_REPLAY_ARTIFACT_BYTES ||
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    throw new Error('replay_artifact_file_invalid');
  }
  const value = JSON.parse(
    fs.readFileSync(fileRealPath, 'utf8'),
  ) as unknown;
  const digest =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>).digest
      : null;
  if (
    typeof digest !== 'string' ||
    path.basename(fileRealPath) !== `${digest}.json`
  ) {
    throw new Error('replay_artifact_path_digest_mismatch');
  }
  return value;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const captured = capturePaths(argv);
  if (captured) {
    const captureRealPath = fs.realpathSync(captured.capture);
    const captureRelativePath = path
      .relative(fs.realpathSync(process.cwd()), captureRealPath)
      .split(path.sep)
      .join('/');
    const result = await replayVisualContractAuthoringEvidence({
      repoRoot: process.cwd(),
      snapshot: readContentAddressedJson(
        captured.snapshot,
      ) as StorySourceAuthoritySnapshot,
      request: readContentAddressedJson(
        captured.request,
      ) as VisualContractAuthoringRequest,
      receipt: readContentAddressedJson(
        captured.receipt,
      ) as VisualContractAuthoringReceipt,
      evidence: readContentAddressedJson(
        captured.capture,
      ) as VisualContractAuthoringReplayEvidence,
      evidencePath: captureRelativePath,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (
      !result.exactCapturedCallSequence ||
      !result.receiptOutcomeCongruent
    ) {
      process.exitCode = 1;
    }
    return;
  }
  let filePath: string;
  try {
    filePath = scenarioPath(argv);
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
