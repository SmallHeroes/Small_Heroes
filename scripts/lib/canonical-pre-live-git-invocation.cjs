'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const GIT_PROBE_EVIDENCE_VERSION =
  'canonical-pre-live-git-probe-evidence/v1';
const GIT_PROFILES = Object.freeze([
  'bootstrap_launcher',
  'private_entry',
]);
const GIT_COMMAND_IDS = Object.freeze([
  'repository_top_level',
  'symbolic_branch',
  'upstream_ref',
  'head_commit',
  'upstream_head_commit',
  'divergence',
  'worktree_status',
  'output_root_ignore',
]);
const GIT_FAILURE_CLASSES = Object.freeze([
  'spawn_error',
  'timeout',
  'signal',
  'output_ceiling',
  'malformed_result',
  'nonzero_exit',
]);
const MAX_GIT_OUTPUT_BYTES = 64 * 1024;
const MAX_GIT_PATH_LABEL_LENGTH = 4096;

const PROFILE_ENVIRONMENT_NAMES = Object.freeze({
  bootstrap_launcher: Object.freeze({
    win32: Object.freeze([
      'APPDATA',
      'ComSpec',
      'LOCALAPPDATA',
      'PATH',
      'PATHEXT',
      'SystemDrive',
      'SystemRoot',
      'TEMP',
      'TMP',
      'USERPROFILE',
      'WINDIR',
    ]),
    other: Object.freeze([
      'HOME',
      'LANG',
      'LC_ALL',
      'PATH',
      'TMPDIR',
      'TZ',
      'XDG_CACHE_HOME',
    ]),
  }),
  private_entry: Object.freeze({
    win32: Object.freeze([
      'ComSpec',
      'PATH',
      'PATHEXT',
      'SystemRoot',
      'TEMP',
      'TMP',
      'WINDIR',
    ]),
    other: Object.freeze([
      'HOME',
      'LANG',
      'LC_ALL',
      'PATH',
      'TMPDIR',
      'TZ',
    ]),
  }),
});

const FAILURE_REASON_CODES = Object.freeze({
  spawn_error: 'pre_live_git_invocation_spawn_error',
  timeout: 'pre_live_git_invocation_timeout',
  signal: 'pre_live_git_invocation_signal',
  output_ceiling: 'pre_live_git_invocation_output_ceiling',
  malformed_result: 'pre_live_git_invocation_malformed_result',
  nonzero_exit: 'pre_live_git_invocation_nonzero_exit',
});

const BRANCH_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const REMOTE_REF_PATTERN =
  /^refs\/remotes\/origin\/[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$/;

class CanonicalPreLiveGitTopologyError extends Error {
  constructor(reasonCode, diagnostic = null) {
    super(reasonCode);
    this.name = 'CanonicalPreLiveGitTopologyError';
    this.reasonCode = reasonCode;
    this.diagnostic = diagnostic;
  }
}

function profileEnvironmentNames(profile, platform = process.platform) {
  const profileNames = PROFILE_ENVIRONMENT_NAMES[profile];
  if (!profileNames) throw new Error('git_profile_invalid');
  return platform === 'win32'
    ? [...profileNames.win32]
    : [...profileNames.other];
}

function gitEnvironmentForProfile(options) {
  const result = Object.create(null);
  for (const name of profileEnvironmentNames(
    options.profile,
    options.platform,
  )) {
    const value = options.environment[name];
    if (value !== undefined) result[name] = value;
  }
  result.GIT_OPTIONAL_LOCKS = '0';
  if (options.profile === 'private_entry') {
    result.NODE_ENV = 'production';
  }
  return result;
}

function isGitCommandId(commandId) {
  return GIT_COMMAND_IDS.includes(commandId);
}

function safePathLabel(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_GIT_PATH_LABEL_LENGTH &&
    !value.includes('\0')
  );
}

function exactGitArgv(commandId, context) {
  switch (commandId) {
    case 'repository_top_level':
      return ['rev-parse', '--show-toplevel'];
    case 'symbolic_branch':
      return ['symbolic-ref', '--quiet', '--short', 'HEAD'];
    case 'upstream_ref':
      return [
        'rev-parse',
        '--symbolic-full-name',
        '@{upstream}',
      ];
    case 'head_commit':
      return ['rev-parse', '--verify', 'HEAD^{commit}'];
    case 'upstream_head_commit':
      if (!REMOTE_REF_PATTERN.test(context.upstreamRef ?? '')) {
        throw new Error('git_command_context_invalid');
      }
      return [
        'rev-parse',
        '--verify',
        `${context.upstreamRef}^{commit}`,
      ];
    case 'divergence':
      if (
        typeof context.branchRef !== 'string' ||
        !context.branchRef.startsWith('refs/heads/') ||
        !BRANCH_PATTERN.test(context.branchRef.slice(11)) ||
        !REMOTE_REF_PATTERN.test(context.upstreamRef ?? '')
      ) {
        throw new Error('git_command_context_invalid');
      }
      return [
        'rev-list',
        '--left-right',
        '--count',
        `${context.branchRef}...${context.upstreamRef}`,
      ];
    case 'worktree_status':
      return [
        'status',
        '--porcelain=v2',
        '--untracked-files=all',
      ];
    case 'output_root_ignore':
      if (!safePathLabel(context.outputRoot)) {
        throw new Error('git_command_context_invalid');
      }
      return [
        'check-ignore',
        '--quiet',
        '--no-index',
        '--',
        context.outputRoot,
      ];
    default:
      throw new Error('git_command_id_invalid');
  }
}

function boundedByteCount(value) {
  if (typeof value !== 'string') return 0;
  return Math.min(
    Buffer.byteLength(value, 'utf8'),
    MAX_GIT_OUTPUT_BYTES + 1,
  );
}

function errorCode(error) {
  try {
    return error && typeof error.code === 'string'
      ? error.code
      : null;
  } catch {
    return null;
  }
}

function errorClass(error) {
  const code = errorCode(error);
  if (code === null) return error ? 'unknown' : 'none';
  if (code === 'ETIMEDOUT') return 'timeout';
  if (code === 'ENOBUFS') return 'output_limit';
  if (code === 'ENOENT') return 'not_found';
  if (code === 'EACCES' || code === 'EPERM') {
    return 'permission_denied';
  }
  return 'unknown';
}

function signalClass(signal) {
  if (signal === null || signal === undefined) return 'none';
  if (signal === 'SIGTERM') return 'termination';
  if (signal === 'SIGINT') return 'interrupt';
  if (signal === 'SIGKILL') return 'kill';
  if (signal === 'SIGABRT') return 'abort';
  if (signal === 'SIGHUP') return 'hangup';
  return 'unknown';
}

function stderrClass(stderr) {
  if (typeof stderr !== 'string' || stderr.length === 0) {
    return 'none';
  }
  if (/detected dubious ownership|safe\.directory/i.test(stderr)) {
    return 'safe_directory';
  }
  if (/not a git repository/i.test(stderr)) {
    return 'not_a_git_repository';
  }
  if (
    /no upstream configured|unknown revision|ambiguous argument|needed a single revision|not a valid object name/i.test(
      stderr,
    )
  ) {
    return 'ref_not_found';
  }
  if (/permission denied|access is denied/i.test(stderr)) {
    return 'permission_denied';
  }
  return 'unclassified';
}

function diagnostic(options) {
  return Object.freeze({
    profile: options.profile,
    commandId: options.commandId,
    failureClass: options.failureClass,
    exitStatus: options.exitStatus,
    signalClass: options.signalClass,
    errorClass: options.errorClass,
    stderrClass: options.stderrClass,
    stdoutBytes: options.stdoutBytes,
    stderrBytes: options.stderrBytes,
  });
}

function failedDiagnostic(options, failureClass, result) {
  const stdout = result && result.stdout;
  const stderr = result && result.stderr;
  return diagnostic({
    profile: options.profile,
    commandId: options.commandId,
    failureClass,
    exitStatus:
      result && Number.isInteger(result.status)
        ? Math.min(255, Math.max(0, result.status))
        : null,
    signalClass: signalClass(result && result.signal),
    errorClass: errorClass(result && result.error),
    stderrClass: stderrClass(stderr),
    stdoutBytes: boundedByteCount(stdout),
    stderrBytes: boundedByteCount(stderr),
  });
}

function invokeCanonicalPreLiveGitCommand(options) {
  if (
    !GIT_PROFILES.includes(options.profile) ||
    !isGitCommandId(options.commandId) ||
    !safePathLabel(options.repositoryRealPath)
  ) {
    throw new Error('git_invocation_options_invalid');
  }
  const argv = exactGitArgv(
    options.commandId,
    options.context ?? {},
  );
  let result;
  try {
    result = (options.spawnSyncImpl ?? spawnSync)(
      'git',
      argv,
      {
        cwd: options.repositoryRealPath,
        env: gitEnvironmentForProfile({
          profile: options.profile,
          environment: options.environment,
          platform: options.platform,
        }),
        encoding: 'utf8',
        maxBuffer: MAX_GIT_OUTPUT_BYTES,
        shell: false,
        timeout: 20_000,
        windowsHide: true,
      },
    );
  } catch {
    const failure = failedDiagnostic(
      options,
      'spawn_error',
      null,
    );
    return { ok: false, diagnostic: failure };
  }
  const resultRecord =
    result && typeof result === 'object' ? result : null;
  const resultError = resultRecord && resultRecord.error;
  const resultErrorCode = errorCode(resultError);
  const stdoutBytes = boundedByteCount(
    resultRecord && resultRecord.stdout,
  );
  const stderrBytes = boundedByteCount(
    resultRecord && resultRecord.stderr,
  );
  let failureClass = null;
  if (
    resultErrorCode === 'ENOBUFS' ||
    stdoutBytes > MAX_GIT_OUTPUT_BYTES ||
    stderrBytes > MAX_GIT_OUTPUT_BYTES
  ) {
    failureClass = 'output_ceiling';
  } else if (resultErrorCode === 'ETIMEDOUT') {
    failureClass = 'timeout';
  } else if (resultError) {
    failureClass = 'spawn_error';
  } else if (resultRecord && resultRecord.signal) {
    failureClass = 'signal';
  } else if (
    !resultRecord ||
    typeof resultRecord.stdout !== 'string' ||
    typeof resultRecord.stderr !== 'string' ||
    !Number.isInteger(resultRecord.status) ||
    resultRecord.status < 0 ||
    resultRecord.status > 255
  ) {
    failureClass = 'malformed_result';
  } else if (
    resultRecord.status !== 0 &&
    !(
      options.allowOutputIgnoreStatusOne === true &&
      options.commandId === 'output_root_ignore' &&
      resultRecord.status === 1
    )
  ) {
    failureClass = 'nonzero_exit';
  }
  if (failureClass) {
    return {
      ok: false,
      diagnostic: failedDiagnostic(
        options,
        failureClass,
        resultRecord,
      ),
    };
  }
  const observation = diagnostic({
    profile: options.profile,
    commandId: options.commandId,
    failureClass: null,
    exitStatus: resultRecord.status,
    signalClass: 'none',
    errorClass: 'none',
    stderrClass: stderrClass(resultRecord.stderr),
    stdoutBytes,
    stderrBytes,
  });
  return {
    ok: true,
    stdout: resultRecord.stdout,
    status: resultRecord.status,
    diagnostic: observation,
  };
}

function malformedCommandResult(profile, commandId, observation) {
  return diagnostic({
    ...observation,
    profile,
    commandId,
    failureClass: 'malformed_result',
  });
}

function collectCanonicalPreLiveGitProfile(options) {
  const observations = [];
  const values = {};
  const context = { outputRoot: options.outputRoot };
  for (const commandId of GIT_COMMAND_IDS) {
    const result = invokeCanonicalPreLiveGitCommand({
      profile: options.profile,
      commandId,
      repositoryRealPath: options.repositoryRealPath,
      outputRoot: options.outputRoot,
      environment: options.environment,
      platform: options.platform,
      context,
      spawnSyncImpl: options.spawnSyncImpl,
      allowOutputIgnoreStatusOne:
        options.allowOutputIgnoreStatusOne,
    });
    observations.push(result.diagnostic);
    if (!result.ok) {
      return {
        ok: false,
        observations,
        diagnostic: result.diagnostic,
      };
    }
    const value = result.stdout.trim();
    values[commandId] = {
      value,
      status: result.status,
    };
    if (commandId === 'symbolic_branch') {
      if (!BRANCH_PATTERN.test(value)) {
        const failure = malformedCommandResult(
          options.profile,
          commandId,
          result.diagnostic,
        );
        observations[observations.length - 1] = failure;
        return {
          ok: false,
          observations,
          diagnostic: failure,
        };
      }
      context.branchRef = `refs/heads/${value}`;
    }
    if (commandId === 'upstream_ref') {
      if (!REMOTE_REF_PATTERN.test(value)) {
        const failure = malformedCommandResult(
          options.profile,
          commandId,
          result.diagnostic,
        );
        observations[observations.length - 1] = failure;
        return {
          ok: false,
          observations,
          diagnostic: failure,
        };
      }
      context.upstreamRef = value;
    }
    if (
      (commandId === 'head_commit' ||
        commandId === 'upstream_head_commit') &&
      !COMMIT_PATTERN.test(value)
    ) {
      const failure = malformedCommandResult(
        options.profile,
        commandId,
        result.diagnostic,
      );
      observations[observations.length - 1] = failure;
      return {
        ok: false,
        observations,
        diagnostic: failure,
      };
    }
  }
  return {
    ok: true,
    observations,
    values,
    branchRef: context.branchRef,
    upstreamRef: context.upstreamRef,
  };
}

function normalized(value, platform) {
  const resolved = path.resolve(value);
  return platform === 'win32'
    ? resolved.toLowerCase()
    : resolved;
}

function pathsEqual(left, right, platform) {
  return normalized(left, platform) === normalized(right, platform);
}

function verifyCanonicalPreLiveGitTopology(options) {
  const collected = collectCanonicalPreLiveGitProfile({
    ...options,
    allowOutputIgnoreStatusOne: true,
  });
  if (!collected.ok) {
    throw new CanonicalPreLiveGitTopologyError(
      'bootstrap_git_rejected',
      collected.diagnostic,
    );
  }
  const topLevel = collected.values.repository_top_level.value;
  if (
    !pathsEqual(
      topLevel,
      options.repositoryRealPath,
      options.platform,
    )
  ) {
    throw new CanonicalPreLiveGitTopologyError(
      'bootstrap_repository_mismatch',
    );
  }
  const branch = collected.values.symbolic_branch.value;
  if (
    branch.includes('..') ||
    branch.includes('//') ||
    branch.endsWith('/') ||
    branch.endsWith('.lock') ||
    branch === 'main' ||
    branch === 'master'
  ) {
    throw new CanonicalPreLiveGitTopologyError(
      'bootstrap_dedicated_branch_required',
    );
  }
  const expectedUpstream = `refs/remotes/origin/${branch}`;
  if (collected.upstreamRef !== expectedUpstream) {
    throw new CanonicalPreLiveGitTopologyError(
      'bootstrap_same_name_upstream_required',
    );
  }
  const head = collected.values.head_commit.value;
  if (
    head !== collected.values.upstream_head_commit.value
  ) {
    throw new CanonicalPreLiveGitTopologyError(
      'bootstrap_head_mismatch',
    );
  }
  if (
    !/^0\s+0$/.test(collected.values.divergence.value)
  ) {
    throw new CanonicalPreLiveGitTopologyError(
      'bootstrap_divergence_rejected',
    );
  }
  if (collected.values.worktree_status.value.length > 0) {
    throw new CanonicalPreLiveGitTopologyError(
      'bootstrap_dirty_rejected',
    );
  }
  if (collected.values.output_root_ignore.status !== 0) {
    throw new CanonicalPreLiveGitTopologyError(
      'bootstrap_output_not_ignored',
    );
  }
  return {
    repositoryRealPath: options.repositoryRealPath,
    branchRef: collected.branchRef,
    head,
    upstreamRef: collected.upstreamRef,
    observations: collected.observations,
  };
}

function runCanonicalPreLiveGitProbe(options) {
  const observations = [];
  for (const profile of GIT_PROFILES) {
    const result = collectCanonicalPreLiveGitProfile({
      profile,
      repositoryRealPath: options.repositoryRealPath,
      outputRoot: options.outputRoot,
      environment: options.environment,
      platform: options.platform,
      spawnSyncImpl: options.spawnSyncImpl,
      allowOutputIgnoreStatusOne: false,
    });
    observations.push(...result.observations);
    if (!result.ok) {
      return {
        status: 'rejected',
        observations,
      };
    }
  }
  return {
    status: 'ready_for_canonical_prepare',
    observations,
  };
}

module.exports = {
  CanonicalPreLiveGitTopologyError,
  FAILURE_REASON_CODES,
  GIT_COMMAND_IDS,
  GIT_FAILURE_CLASSES,
  GIT_PROBE_EVIDENCE_VERSION,
  GIT_PROFILES,
  MAX_GIT_OUTPUT_BYTES,
  collectCanonicalPreLiveGitProfile,
  exactGitArgv,
  gitEnvironmentForProfile,
  invokeCanonicalPreLiveGitCommand,
  profileEnvironmentNames,
  runCanonicalPreLiveGitProbe,
  verifyCanonicalPreLiveGitTopology,
};
