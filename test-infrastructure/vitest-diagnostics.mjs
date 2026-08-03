const MAX_DIAGNOSTIC_TEXT_LENGTH = 4_096;
const MAX_DIAGNOSTIC_VALUES = 64;

export const VITEST_DIAGNOSTIC_SCHEMA =
  'small-heroes-vitest-phase-diagnostic/v1';

export const VITEST_DIAGNOSTIC_CLASS_IDS = Object.freeze([
  'on_task_update_rpc_timeout',
  'test_timeout',
  'reporter_or_ipc_failure',
  'launch_failure',
  'signal_or_exit_failure',
  'teardown_or_termination_failure',
  'diagnostic_protocol_failure',
]);

const DIAGNOSTIC_CLASS_ORDER = new Map(
  VITEST_DIAGNOSTIC_CLASS_IDS.map((classId, index) => [
    classId,
    index,
  ]),
);

const ON_TASK_UPDATE_RPC_TIMEOUT =
  '[vitest-worker]: Timeout calling "onTaskUpdate"';

const TEST_TIMEOUT_PATTERNS = [
  /\b(?:Test|Hook) timed out in \d+ms\b/i,
  /\bExceeded timeout of \d+ms\b/i,
];

const REPORTER_OR_IPC_PATTERNS = [
  /\bERR_IPC_CHANNEL_CLOSED\b/,
  /\bIPC channel is already disconnected\b/i,
  /\bchannel closed\b/i,
  /\bwrite EPIPE\b/i,
  /\bUnhandled Reporter Error\b/,
  /\[vitest-pool\]: Timeout calling /,
  /\[birpc\] rpc is closed(?:,| )/,
  /\[birpc\] timeout on calling /,
  /Unexpected call to process\.send\(\)/,
];

const TEARDOWN_OR_TERMINATION_PATTERNS = [
  /\bFailed to terminate worker\b/,
  /\bclose timed out after \d+ms\b/i,
  /\bTests closed successfully but .* prevents .* exiting\b/i,
];

function boundedText(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  return value.slice(0, MAX_DIAGNOSTIC_TEXT_LENGTH);
}

function collectDiagnosticTexts(value) {
  const texts = [];
  const add = (candidate) => {
    const text = boundedText(candidate);
    if (text !== undefined && texts.length < MAX_DIAGNOSTIC_VALUES) {
      texts.push(text);
    }
  };

  if (typeof value === 'string') {
    add(value);
    return texts;
  }
  if (!value || typeof value !== 'object') {
    return texts;
  }

  add(value.name);
  add(value.message);
  add(value.code);

  if (value.cause && typeof value.cause === 'object') {
    add(value.cause.name);
    add(value.cause.message);
    add(value.cause.code);
  }

  return texts;
}

function sortDiagnosticClasses(classIds) {
  return [...new Set(classIds)].sort(
    (left, right) =>
      (DIAGNOSTIC_CLASS_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (DIAGNOSTIC_CLASS_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function classifyVitestDiagnostic(value) {
  const classes = new Set();

  for (const text of collectDiagnosticTexts(value)) {
    if (text.includes(ON_TASK_UPDATE_RPC_TIMEOUT)) {
      classes.add('on_task_update_rpc_timeout');
      continue;
    }
    if (TEST_TIMEOUT_PATTERNS.some((pattern) => pattern.test(text))) {
      classes.add('test_timeout');
    }
    if (
      REPORTER_OR_IPC_PATTERNS.some((pattern) => pattern.test(text))
    ) {
      classes.add('reporter_or_ipc_failure');
    }
    if (
      TEARDOWN_OR_TERMINATION_PATTERNS.some((pattern) =>
        pattern.test(text),
      )
    ) {
      classes.add('teardown_or_termination_failure');
    }
  }

  return sortDiagnosticClasses(classes);
}

/**
 * @param {{
 *   diagnosticClasses?: string[];
 *   diagnosticProtocolOk?: boolean;
 *   exitCode?: number | null;
 *   launchErrorCode?: string | null;
 *   signal?: string | null;
 * }} outcome
 */
export function classifyVitestProcessOutcome({
  diagnosticClasses = [],
  diagnosticProtocolOk = true,
  exitCode = null,
  launchErrorCode = null,
  signal = null,
}) {
  const classes = new Set(diagnosticClasses);
  const hasLaunchError =
    launchErrorCode !== undefined && launchErrorCode !== null;

  if (hasLaunchError) {
    classes.add('launch_failure');
  }
  if (
    signal ||
    (exitCode !== null && exitCode !== 0) ||
    (exitCode === null && signal === null && !hasLaunchError)
  ) {
    classes.add('signal_or_exit_failure');
  }
  if (!diagnosticProtocolOk) {
    classes.add('diagnostic_protocol_failure');
  }

  return sortDiagnosticClasses(classes);
}

function requireNonNegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }
  return value;
}

function sanitizeLaunchErrorCode(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (value === 'ENOENT' || value === 'EACCES' || value === 'EPERM') {
    return value;
  }
  return 'OTHER';
}

function sanitizeSignal(value) {
  if (value === undefined || value === null) {
    return null;
  }
  return /^SIG[A-Z0-9]{1,12}$/.test(value) ? value : 'OTHER';
}

export function createVitestPhaseDiagnosticEvidence({
  diagnosticBytes,
  diagnosticClasses,
  diagnosticProtocolOk,
  diagnosticRecords,
  elapsedMs,
  exitCode,
  fileCount,
  launchErrorCode,
  phase,
  signal,
  workerLimit,
}) {
  if (phase !== 'ordinary' && phase !== 'resource_intensive') {
    throw new TypeError('phase must be an approved Vitest phase');
  }

  const classes = classifyVitestProcessOutcome({
    diagnosticClasses,
    diagnosticProtocolOk,
    exitCode,
    launchErrorCode,
    signal,
  });

  return Object.freeze({
    schemaVersion: VITEST_DIAGNOSTIC_SCHEMA,
    phase,
    workerLimit: requireNonNegativeInteger(workerLimit, 'workerLimit'),
    fileCount: requireNonNegativeInteger(fileCount, 'fileCount'),
    elapsedMs: requireNonNegativeInteger(elapsedMs, 'elapsedMs'),
    exitCode:
      exitCode === null
        ? null
        : requireNonNegativeInteger(exitCode, 'exitCode'),
    signal: sanitizeSignal(signal),
    launchErrorCode: sanitizeLaunchErrorCode(launchErrorCode),
    diagnosticProtocolOk: Boolean(diagnosticProtocolOk),
    diagnosticRecords: requireNonNegativeInteger(
      diagnosticRecords,
      'diagnosticRecords',
    ),
    diagnosticBytes: requireNonNegativeInteger(
      diagnosticBytes,
      'diagnosticBytes',
    ),
    classes,
    gateStatus: classes.length === 0 ? 'passed' : 'failed',
  });
}
