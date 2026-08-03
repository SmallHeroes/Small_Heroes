import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createVitestPhaseDiagnosticEvidence,
  VITEST_DIAGNOSTIC_CLASS_IDS,
  VITEST_DIAGNOSTIC_SCHEMA,
} from './vitest-diagnostics.mjs';
import {
  classifyVitestWorkloads,
  discoverCanonicalVitestSpecs,
  loadVitestWorkloadPolicy,
  VitestWorkloadClassificationError,
} from './vitest-workload-classifier.mjs';

const REPOSITORY_ROOT = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
);
const REPORTER_SCHEMA = 'small-heroes-vitest-reporter-diagnostic/v1';
const SUMMARY_SCHEMA = 'small-heroes-vitest-check-summary/v1';
const CLASSIFICATION_FAILURE_SCHEMA =
  'small-heroes-vitest-classification-failure/v1';
const MAX_DIAGNOSTIC_CHANNEL_BYTES = 64 * 1024;
const MAX_DIAGNOSTIC_RECORDS = 8;
const REPORTER_KEYS = Object.freeze([
  'classes',
  'event',
  'phase',
  'processTimeout',
  'runReason',
  'schemaVersion',
  'taskUpdateCalls',
  'taxonomyVersion',
]);
const REPORTER_CLASS_IDS = new Set(VITEST_DIAGNOSTIC_CLASS_IDS);

function writeJsonLine(stream, prefix, value) {
  stream.write(`${prefix}${JSON.stringify(value)}\n`);
}

function validateReporterRecord(record, phase) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return false;
  }
  const keys = Object.keys(record).sort();
  if (
    keys.length !== REPORTER_KEYS.length ||
    keys.some((key, index) => key !== REPORTER_KEYS[index]) ||
    record.schemaVersion !== REPORTER_SCHEMA ||
    record.taxonomyVersion !== VITEST_DIAGNOSTIC_SCHEMA ||
    record.phase !== phase ||
    (record.event !== 'run_end' && record.event !== 'process_timeout') ||
    !['passed', 'failed', 'interrupted', 'unknown'].includes(
      record.runReason,
    ) ||
    !Number.isSafeInteger(record.taskUpdateCalls) ||
    record.taskUpdateCalls < 0 ||
    typeof record.processTimeout !== 'boolean' ||
    !Array.isArray(record.classes) ||
    record.classes.length > VITEST_DIAGNOSTIC_CLASS_IDS.length ||
    new Set(record.classes).size !== record.classes.length ||
    record.classes.some((classId) => !REPORTER_CLASS_IDS.has(classId))
  ) {
    return false;
  }
  return true;
}

export function parseVitestDiagnosticChannel(
  diagnosticText,
  phase,
  overflowed = false,
) {
  const classes = new Set();
  let protocolOk = !overflowed;
  let records = 0;
  let runEndRecords = 0;
  const lines = diagnosticText.split(/\r?\n/).filter(Boolean);

  if (lines.length > MAX_DIAGNOSTIC_RECORDS) {
    protocolOk = false;
  }

  for (const line of lines.slice(0, MAX_DIAGNOSTIC_RECORDS)) {
    try {
      const record = JSON.parse(line);
      if (!validateReporterRecord(record, phase)) {
        protocolOk = false;
        continue;
      }
      records += 1;
      if (record.event === 'run_end') {
        runEndRecords += 1;
      }
      for (const classId of record.classes) {
        classes.add(classId);
      }
    } catch {
      protocolOk = false;
    }
  }

  if (runEndRecords !== 1) {
    protocolOk = false;
  }

  return Object.freeze({
    classes: Object.freeze([...classes]),
    protocolOk,
    records,
  });
}

function launchErrorCode(error) {
  if (error && typeof error === 'object' && typeof error.code === 'string') {
    return error.code;
  }
  return 'OTHER';
}

/**
 * @param {{
 *   diagnostics: boolean;
 *   environment?: NodeJS.ProcessEnv;
 *   files: string[];
 *   nodeExecutable?: string;
 *   phase: 'ordinary' | 'resource_intensive';
 *   reporterPath?: string;
 *   spawnImplementation?: typeof spawn;
 *   stderr?: { write(value: string): unknown };
 *   vitestEntrypoint?: string;
 *   workerLimit: number;
 * }} options
 */
export async function runVitestPhase({
  diagnostics,
  environment = process.env,
  files,
  nodeExecutable = process.execPath,
  phase,
  reporterPath = path.join(
    REPOSITORY_ROOT,
    'test-infrastructure',
    'vitest-diagnostic-reporter.mjs',
  ),
  spawnImplementation = spawn,
  stderr = process.stderr,
  vitestEntrypoint = path.join(
    REPOSITORY_ROOT,
    'node_modules',
    'vitest',
    'vitest.mjs',
  ),
  workerLimit,
}) {
  const startedAt = performance.now();
  const args = [
    vitestEntrypoint,
    'run',
    '--pool=forks',
    '--isolate',
    '--fileParallelism',
    `--maxWorkers=${workerLimit}`,
    '--reporter=default',
  ];
  if (diagnostics) {
    args.push(`--reporter=${reporterPath}`);
  }
  args.push(...files);

  let diagnosticBytes = 0;
  let diagnosticText = '';
  let diagnosticOverflowed = false;
  let observedExitCode = null;
  let observedLaunchErrorCode = null;
  let observedSignal = null;

  await new Promise((resolve) => {
    let child;
    try {
      child = spawnImplementation(nodeExecutable, args, {
        cwd: REPOSITORY_ROOT,
        env: {
          ...environment,
          ...(diagnostics
            ? {
                SMALL_HEROES_VITEST_DIAGNOSTIC_FD: '3',
                SMALL_HEROES_VITEST_PHASE: phase,
              }
            : {}),
        },
        shell: false,
        stdio: diagnostics
          ? ['inherit', 'inherit', 'inherit', 'pipe']
          : 'inherit',
        windowsHide: true,
      });
    } catch (error) {
      observedLaunchErrorCode = launchErrorCode(error);
      resolve();
      return;
    }

    if (diagnostics && child.stdio[3]) {
      child.stdio[3].on('data', (chunk) => {
        diagnosticBytes += chunk.length;
        if (
          diagnosticBytes <= MAX_DIAGNOSTIC_CHANNEL_BYTES &&
          !diagnosticOverflowed
        ) {
          diagnosticText += chunk.toString('utf8');
        } else {
          diagnosticOverflowed = true;
          diagnosticText = '';
        }
      });
    }
    child.once('error', (error) => {
      observedLaunchErrorCode = launchErrorCode(error);
    });
    child.once('close', (exitCode, signal) => {
      observedExitCode = exitCode;
      observedSignal = signal;
      resolve();
    });
  });

  let diagnosticResult = {
    classes: [],
    protocolOk: true,
    records: 0,
  };
  if (diagnostics && observedLaunchErrorCode === null) {
    diagnosticResult = parseVitestDiagnosticChannel(
      diagnosticText,
      phase,
      diagnosticOverflowed,
    );
  }

  const evidence = createVitestPhaseDiagnosticEvidence({
    diagnosticBytes: Math.min(
      diagnosticBytes,
      MAX_DIAGNOSTIC_CHANNEL_BYTES + 1,
    ),
    diagnosticClasses: diagnosticResult.classes,
    diagnosticProtocolOk: diagnosticResult.protocolOk,
    diagnosticRecords: diagnosticResult.records,
    elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
    exitCode:
      observedLaunchErrorCode === null ? observedExitCode : null,
    fileCount: files.length,
    launchErrorCode: observedLaunchErrorCode,
    phase,
    signal: observedLaunchErrorCode === null ? observedSignal : null,
    workerLimit,
  });
  writeJsonLine(stderr, '[small-heroes-vitest] ', evidence);
  return evidence;
}

/**
 * @param {{
 *   diagnostics: boolean;
 *   environment?: NodeJS.ProcessEnv;
 *   nodeExecutable?: string;
 *   ordinaryFiles: string[];
 *   ordinaryWorkers: number;
 *   reporterPath?: string;
 *   resourceIntensiveFiles: string[];
 *   resourceIntensiveWorkers: number;
 *   spawnImplementation?: typeof spawn;
 *   stderr?: { write(value: string): unknown };
 *   vitestEntrypoint?: string;
 * }} options
 */
export async function runVitestPhases({
  diagnostics,
  environment = process.env,
  nodeExecutable = process.execPath,
  ordinaryFiles,
  ordinaryWorkers,
  reporterPath,
  resourceIntensiveFiles,
  resourceIntensiveWorkers,
  spawnImplementation = spawn,
  stderr = process.stderr,
  vitestEntrypoint,
}) {
  const ordinary = await runVitestPhase({
    diagnostics,
    environment,
    files: ordinaryFiles,
    nodeExecutable,
    phase: 'ordinary',
    reporterPath,
    spawnImplementation,
    stderr,
    vitestEntrypoint,
    workerLimit: ordinaryWorkers,
  });
  const resourceIntensive = await runVitestPhase({
    diagnostics,
    environment,
    files: resourceIntensiveFiles,
    nodeExecutable,
    phase: 'resource_intensive',
    reporterPath,
    spawnImplementation,
    stderr,
    vitestEntrypoint,
    workerLimit: resourceIntensiveWorkers,
  });

  return Object.freeze({
    ordinary,
    resourceIntensive,
    gateStatus:
      ordinary.gateStatus === 'passed' &&
      resourceIntensive.gateStatus === 'passed'
        ? 'passed'
        : 'failed',
  });
}

/**
 * @param {{
 *   diagnostics?: boolean;
 *   repositoryRoot?: string;
 *   stderr?: { write(value: string): unknown };
 * }} [options]
 */
export async function runRepositoryVitestCheck({
  diagnostics,
  repositoryRoot = REPOSITORY_ROOT,
  stderr = process.stderr,
} = {}) {
  let policy;
  let partition;
  try {
    policy = loadVitestWorkloadPolicy(repositoryRoot);
    const inventory = discoverCanonicalVitestSpecs(
      repositoryRoot,
      policy.canonicalIncludes,
    );
    partition = classifyVitestWorkloads(inventory, policy);
    if (
      partition.ordinary.length === 0 ||
      partition.resourceIntensive.length === 0
    ) {
      throw new VitestWorkloadClassificationError('inventory_omission');
    }
  } catch (error) {
    const code =
      error instanceof VitestWorkloadClassificationError
        ? error.code
        : 'policy_invalid';
    const evidence = Object.freeze({
      schemaVersion: CLASSIFICATION_FAILURE_SCHEMA,
      gateStatus: 'failed',
      class: 'workload_classification_failure',
      code,
      vitestLaunches: 0,
    });
    writeJsonLine(stderr, '[small-heroes-vitest] ', evidence);
    return Object.freeze({ exitCode: 1, evidence });
  }

  const ordinaryWorkers = Math.min(
    policy.ordinaryMaxWorkers,
    Math.max(1, availableParallelism() - 1),
  );
  const resourceIntensiveWorkers = Math.min(
    policy.resourceIntensiveMaxWorkers,
    ordinaryWorkers,
  );
  const phases = await runVitestPhases({
    diagnostics: Boolean(diagnostics),
    ordinaryFiles: partition.ordinary,
    ordinaryWorkers,
    resourceIntensiveFiles: partition.resourceIntensive,
    resourceIntensiveWorkers,
    stderr,
  });
  const evidence = Object.freeze({
    schemaVersion: SUMMARY_SCHEMA,
    canonicalFileCount: partition.inventory.length,
    ordinaryFileCount: partition.ordinary.length,
    resourceIntensiveFileCount: partition.resourceIntensive.length,
    phases,
    gateStatus: phases.gateStatus,
  });
  writeJsonLine(stderr, '[small-heroes-vitest] ', evidence);
  return Object.freeze({
    exitCode: phases.gateStatus === 'passed' ? 0 : 1,
    evidence,
  });
}

export function repositoryRoot() {
  return REPOSITORY_ROOT;
}
