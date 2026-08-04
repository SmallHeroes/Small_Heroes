import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  canonicalLiveAuthoringJsonBytes,
} from './canonicalLiveAuthoringArtifacts';
import {
  CanonicalMaterializationInputReadError,
  readCanonicalMaterializationInputArtifact,
} from './canonicalMaterializationInput';
import {
  canonicalJsonDigest,
  repoRelativePath,
} from './integrity';
import {
  CANONICAL_LIVE_EXECUTION_REQUEST_VERSION,
  buildCanonicalLiveExecutionRequest,
  minimalPlatformInheritedEnvironmentNames,
  verifyCanonicalLiveExecution,
  type CanonicalLiveExecutionPreservationFence,
  type CanonicalLiveExecutionReadiness,
  type CanonicalLiveExecutionRequest,
} from './liveExecutionSupervisor';
import {
  CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
  assertValidLiveRequestMaterializationManifest,
  verifyCanonicalLiveRequestBundle,
  type CanonicalLiveRequestVerificationResult,
  type LiveRequestMaterializationManifest,
} from './liveRequestMaterialization';
import {
  writeImmutableLocalArtifact,
} from './preRenderBlueprintLifecycle';

export const CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION =
  'canonical-live-execution-request-materialization-input/v4' as const;
export const CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_RESULT_VERSION =
  'canonical-live-execution-request-materialization-result/v4' as const;

const REQUEST_CATEGORY =
  'canonical-live-execution-requests' as const;
const STAGING_CATEGORY =
  '.canonical-live-execution-request-staging' as const;
const MAX_GIT_OUTPUT_BYTES = 64 * 1024;
const MAX_PRESERVATION_FILE_BYTES = 64 * 1024 * 1024;
const MAX_COLLECTION_ITEMS = 64;
const IDENTIFIER_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const GIT_REF_PATTERN =
  /^refs\/(?:heads|remotes)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$/;

export interface CanonicalLiveExecutionRequestMaterializationInput {
  version:
    typeof CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION;
  requestId: string;
  requestedAt: string;
  manifestPath: string;
  outputDir: string;
  preservationPaths: string[];
  expectedAbsentPaths: string[];
  credentialSourcePath: string;
}

export interface CanonicalLiveExecutionRequestMaterializationSuccess {
  version:
    typeof CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_RESULT_VERSION;
  status: 'materialized';
  request: {
    path: string;
    digest: string;
    created: boolean;
  };
  verification: {
    version: CanonicalLiveExecutionReadiness['version'];
    status: 'ready';
    readinessDigest: string;
  };
  externalBoundaryEvidence: {
    canonicalPreflightRuns: 0;
    credentialReadsOrChecks: 0;
    providerCalls: 0;
    networkCalls: 0;
    externalStorageWrites: 0;
    databaseWrites: 0;
  };
}

export interface CanonicalLiveExecutionRequestMaterializationRejection {
  version:
    typeof CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_RESULT_VERSION;
  status: 'rejected';
  reasonCodes: string[];
  request: null;
  externalBoundaryEvidence: {
    canonicalPreflightRuns: 0;
    credentialReadsOrChecks: 0;
    providerCalls: 0;
    networkCalls: 0;
    externalStorageWrites: 0;
    databaseWrites: 0;
  };
}

interface GitCommandResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  error: boolean;
  stdout: string;
}

type GitCommandRunner = (
  argv: readonly string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  },
) => GitCommandResult;

export interface CanonicalLiveExecutionRequestMaterializationDependencies {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  runGit: GitCommandRunner;
  verifyBundle: (args: {
    repoRoot: string;
    manifestPath: string;
  }) => CanonicalLiveRequestVerificationResult;
  verifyExecution: (args: {
    repoRoot: string;
    requestPath: string;
  }) => CanonicalLiveExecutionReadiness;
}

type MaterializationReasonCode =
  | 'execution_request_materialization_b0_rejected'
  | 'execution_request_materialization_cli_arguments_invalid'
  | 'execution_request_materialization_collision'
  | 'execution_request_materialization_failed'
  | 'execution_request_materialization_filesystem_rejected'
  | 'execution_request_materialization_git_rejected'
  | 'execution_request_materialization_input_rejected'
  | 'execution_request_materialization_output_rejected'
  | 'execution_request_materialization_verification_rejected';

const MATERIALIZATION_REASON_CODES =
  new Set<MaterializationReasonCode>([
    'execution_request_materialization_b0_rejected',
    'execution_request_materialization_cli_arguments_invalid',
    'execution_request_materialization_collision',
    'execution_request_materialization_failed',
    'execution_request_materialization_filesystem_rejected',
    'execution_request_materialization_git_rejected',
    'execution_request_materialization_input_rejected',
    'execution_request_materialization_output_rejected',
    'execution_request_materialization_verification_rejected',
  ]);

class CanonicalLiveExecutionRequestMaterializationFailure extends Error {
  constructor(readonly reasonCode: MaterializationReasonCode) {
    super(reasonCode);
  }
}

interface DerivedGitTopology {
  branchRef: string;
  head: string;
  refs: CanonicalLiveExecutionRequest['repository']['refs'];
  divergence:
    CanonicalLiveExecutionRequest['repository']['divergence'];
}

function recordValue(
  value: unknown,
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = expected.slice().sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every(
      (field, index) => field === sortedExpected[index],
    )
  );
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !TIMESTAMP_PATTERN.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString() === value
  );
}

function canonicalRelativePathIssues(
  value: unknown,
): string[] {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 1024 ||
    path.isAbsolute(value) ||
    value.includes('\\') ||
    value.includes('\0') ||
    /[*?[\]{}!]/.test(value)
  ) {
    return ['path_invalid'];
  }
  const segments = value.split('/');
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === '.' ||
        segment === '..',
    ) ||
    path.posix.normalize(value) !== value
  ) {
    return ['path_invalid'];
  }
  return [];
}

function sortedUnique(values: readonly string[]): boolean {
  return (
    new Set(values).size === values.length &&
    values.every(
      (value, index) =>
        index === 0 || values[index - 1]! < value,
    )
  );
}

function isCanonicalGitRef(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    GIT_REF_PATTERN.test(value) &&
    !value.includes('..') &&
    !value.includes('@{') &&
    !value.includes('//') &&
    !value.endsWith('/') &&
    !value.endsWith('.') &&
    !value.endsWith('.lock')
  );
}

export function canonicalLiveExecutionRequestMaterializationInputIssues(
  value: unknown,
): string[] {
  const input = recordValue(value);
  if (!input) {
    return ['execution_request_materialization_input_not_object'];
  }
  const issues: string[] = [];
  if (
    !exactKeys(input, [
      'version',
      'requestId',
      'requestedAt',
      'manifestPath',
      'outputDir',
      'preservationPaths',
      'expectedAbsentPaths',
      'credentialSourcePath',
    ])
  ) {
    issues.push(
      'execution_request_materialization_input_fields_invalid',
    );
  }
  if (
    input.version !==
    CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION
  ) {
    issues.push(
      'execution_request_materialization_input_version_invalid',
    );
  }
  if (
    typeof input.requestId !== 'string' ||
    !IDENTIFIER_PATTERN.test(input.requestId)
  ) {
    issues.push(
      'execution_request_materialization_request_id_invalid',
    );
  }
  if (!isCanonicalTimestamp(input.requestedAt)) {
    issues.push(
      'execution_request_materialization_timestamp_invalid',
    );
  }
  if (canonicalRelativePathIssues(input.manifestPath).length) {
    issues.push(
      'execution_request_materialization_manifest_path_invalid',
    );
  }
  if (canonicalRelativePathIssues(input.outputDir).length) {
    issues.push(
      'execution_request_materialization_output_path_invalid',
    );
  }
  if (
    !Array.isArray(input.preservationPaths) ||
    input.preservationPaths.length === 0 ||
    input.preservationPaths.length > MAX_COLLECTION_ITEMS ||
    input.preservationPaths.some(
      (entry) => canonicalRelativePathIssues(entry).length > 0,
    ) ||
    !sortedUnique(input.preservationPaths as string[])
  ) {
    issues.push(
      'execution_request_materialization_preservation_paths_invalid',
    );
  }
  if (
    !Array.isArray(input.expectedAbsentPaths) ||
    input.expectedAbsentPaths.length === 0 ||
    input.expectedAbsentPaths.length > MAX_COLLECTION_ITEMS ||
    input.expectedAbsentPaths.some(
      (entry) => canonicalRelativePathIssues(entry).length > 0,
    ) ||
    !sortedUnique(input.expectedAbsentPaths as string[])
  ) {
    issues.push(
      'execution_request_materialization_expected_absence_invalid',
    );
  }
  if (
    typeof input.credentialSourcePath !== 'string' ||
    input.credentialSourcePath.length === 0 ||
    input.credentialSourcePath.length > 4096 ||
    input.credentialSourcePath.includes('\0') ||
    !path.isAbsolute(input.credentialSourcePath)
  ) {
    issues.push(
      'execution_request_materialization_credential_source_invalid',
    );
  }
  return [...new Set(issues)].sort();
}

export function assertValidCanonicalLiveExecutionRequestMaterializationInput(
  value: unknown,
): asserts value is CanonicalLiveExecutionRequestMaterializationInput {
  if (
    canonicalLiveExecutionRequestMaterializationInputIssues(value)
      .length > 0
  ) {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_input_rejected',
    );
  }
}

function normalizedPath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32'
    ? resolved.toLowerCase()
    : resolved;
}

function pathsEqual(left: string, right: string): boolean {
  return normalizedPath(left) === normalizedPath(right);
}

function assertContained(
  repositoryRealPath: string,
  candidateRealPath: string,
): void {
  const relative = path.relative(
    repositoryRealPath,
    candidateRealPath,
  );
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_filesystem_rejected',
    );
  }
}

function canonicalRepositoryRealPath(value: string): string {
  try {
    if (!path.isAbsolute(value)) {
      throw new Error('not_absolute');
    }
    const lexical = path.resolve(value);
    const real = fs.realpathSync(lexical);
    if (
      !pathsEqual(lexical, real) ||
      !fs.statSync(real).isDirectory()
    ) {
      throw new Error('alias_or_not_directory');
    }
    return real;
  } catch {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_filesystem_rejected',
    );
  }
}

function resolveContainedRegularFile(args: {
  repositoryRealPath: string;
  relativePath: string;
  rejectHardLinks: boolean;
}): string {
  try {
    if (canonicalRelativePathIssues(args.relativePath).length) {
      throw new Error('path_invalid');
    }
    const lexical = path.resolve(
      args.repositoryRealPath,
      args.relativePath,
    );
    repoRelativePath(args.repositoryRealPath, lexical);
    const real = fs.realpathSync(lexical);
    assertContained(args.repositoryRealPath, real);
    const lstat = fs.lstatSync(lexical);
    const stat = fs.statSync(real);
    if (
      !pathsEqual(lexical, real) ||
      lstat.isSymbolicLink() ||
      !stat.isFile() ||
      (args.rejectHardLinks && stat.nlink !== 1) ||
      repoRelativePath(args.repositoryRealPath, real) !==
        args.relativePath
    ) {
      throw new Error('alias_or_not_unique');
    }
    return real;
  } catch (error) {
    if (
      error instanceof
      CanonicalLiveExecutionRequestMaterializationFailure
    ) {
      throw error;
    }
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_filesystem_rejected',
    );
  }
}

function readCanonicalInput(args: {
  repositoryRealPath: string;
  inputPath: string;
}): CanonicalLiveExecutionRequestMaterializationInput {
  try {
    return readCanonicalMaterializationInputArtifact({
      repoRoot: args.repositoryRealPath,
      inputPath: args.inputPath,
      expectedKind: 'canonical-live-execution-request',
      expectedPayloadSchemaVersion:
        CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION,
      validatePayload:
        assertValidCanonicalLiveExecutionRequestMaterializationInput,
    }).payload;
  } catch (error) {
    if (
      error instanceof CanonicalMaterializationInputReadError &&
      (error.reasonCode ===
        'canonical_materialization_input_filesystem_rejected' ||
        error.reasonCode ===
          'canonical_materialization_input_source_changed')
    ) {
      throw new CanonicalLiveExecutionRequestMaterializationFailure(
        'execution_request_materialization_filesystem_rejected',
      );
    }
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_input_rejected',
    );
  }
}

function ambientEnvironmentValue(
  env: NodeJS.ProcessEnv,
  name: string,
  platform: NodeJS.Platform,
): string | undefined {
  if (platform !== 'win32') return env[name];
  const key = Object.keys(env).find(
    (candidate) =>
      candidate.toLowerCase() === name.toLowerCase(),
  );
  return key === undefined ? undefined : env[key];
}

function gitEnvironment(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): NodeJS.ProcessEnv {
  const names =
    platform === 'win32'
      ? [
          'ComSpec',
          'PATH',
          'PATHEXT',
          'SystemRoot',
          'TEMP',
          'TMP',
          'WINDIR',
        ]
      : ['LANG', 'LC_ALL', 'PATH', 'TMPDIR', 'TZ'];
  const result = {} as NodeJS.ProcessEnv;
  for (const name of names) {
    const value = ambientEnvironmentValue(env, name, platform);
    if (value !== undefined) result[name] = value;
  }
  return {
    ...result,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL:
      platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_OPTIONAL_LOCKS: '0',
    LANG: 'C',
    LC_ALL: 'C',
  };
}

function defaultGitCommandRunner(
  argv: readonly string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  },
): GitCommandResult {
  const result = spawnSync('git', Array.from(argv), {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: 10_000,
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
  });
  return {
    status: result.status,
    signal: result.signal,
    error: result.error !== undefined,
    stdout:
      typeof result.stdout === 'string' ? result.stdout : '',
  };
}

function defaultDependencies(): CanonicalLiveExecutionRequestMaterializationDependencies {
  return {
    env: process.env,
    platform: process.platform,
    runGit: defaultGitCommandRunner,
    verifyBundle: verifyCanonicalLiveRequestBundle,
    verifyExecution: verifyCanonicalLiveExecution,
  };
}

function resolvedDependencies(
  overrides: Partial<CanonicalLiveExecutionRequestMaterializationDependencies> =
    {},
): CanonicalLiveExecutionRequestMaterializationDependencies {
  return { ...defaultDependencies(), ...overrides };
}

function runRequiredGitCommand(args: {
  repositoryRealPath: string;
  argv: readonly string[];
  dependencies:
    CanonicalLiveExecutionRequestMaterializationDependencies;
}): string {
  const result = args.dependencies.runGit(args.argv, {
    cwd: args.repositoryRealPath,
    env: gitEnvironment(
      args.dependencies.env,
      args.dependencies.platform,
    ),
  });
  if (
    result.error ||
    result.signal !== null ||
    result.status !== 0 ||
    Buffer.byteLength(result.stdout, 'utf8') >
      MAX_GIT_OUTPUT_BYTES
  ) {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_git_rejected',
    );
  }
  return result.stdout.trim();
}

function deriveGitTopology(args: {
  repositoryRealPath: string;
  dependencies:
    CanonicalLiveExecutionRequestMaterializationDependencies;
}): DerivedGitTopology {
  const base = [
    '--no-optional-locks',
    '-C',
    args.repositoryRealPath,
  ] as const;
  const topLevel = runRequiredGitCommand({
    ...args,
    argv: [...base, 'rev-parse', '--show-toplevel'],
  });
  if (
    !pathsEqual(
      canonicalRepositoryRealPath(topLevel),
      args.repositoryRealPath,
    )
  ) {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_git_rejected',
    );
  }
  const branchRef = runRequiredGitCommand({
    ...args,
    argv: [...base, 'symbolic-ref', '--quiet', 'HEAD'],
  });
  const head = runRequiredGitCommand({
    ...args,
    argv: [...base, 'rev-parse', '--verify', 'HEAD^{commit}'],
  });
  const status = runRequiredGitCommand({
    ...args,
    argv: [
      ...base,
      'status',
      '--porcelain=v2',
      '--untracked-files=all',
    ],
  });
  const upstreamRef = runRequiredGitCommand({
    ...args,
    argv: [
      ...base,
      'rev-parse',
      '--symbolic-full-name',
      '--verify',
      '@{upstream}',
    ],
  });
  if (
    status !== '' ||
    !isCanonicalGitRef(branchRef) ||
    !branchRef.startsWith('refs/heads/') ||
    !COMMIT_PATTERN.test(head) ||
    !isCanonicalGitRef(upstreamRef) ||
    !upstreamRef.startsWith('refs/remotes/') ||
    upstreamRef === branchRef
  ) {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_git_rejected',
    );
  }
  const upstreamCommit = runRequiredGitCommand({
    ...args,
    argv: [
      ...base,
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${upstreamRef}^{commit}`,
    ],
  });
  if (!COMMIT_PATTERN.test(upstreamCommit)) {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_git_rejected',
    );
  }
  const divergenceOutput = runRequiredGitCommand({
    ...args,
    argv: [
      ...base,
      'rev-list',
      '--left-right',
      '--count',
      '--end-of-options',
      `${branchRef}...${upstreamRef}`,
    ],
  });
  const divergenceMatch = /^(\d+)\s+(\d+)$/.exec(
    divergenceOutput,
  );
  if (!divergenceMatch) {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_git_rejected',
    );
  }
  const expectedAhead = Number(divergenceMatch[1]);
  const expectedBehind = Number(divergenceMatch[2]);
  if (
    !Number.isSafeInteger(expectedAhead) ||
    !Number.isSafeInteger(expectedBehind)
  ) {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_git_rejected',
    );
  }
  const refs = [
    { name: branchRef, expectedCommit: head },
    { name: upstreamRef, expectedCommit: upstreamCommit },
  ].sort((left, right) => left.name.localeCompare(right.name));
  return {
    branchRef,
    head,
    refs,
    divergence: [
      {
        localRef: branchRef,
        upstreamRef,
        expectedAhead,
        expectedBehind,
      },
    ],
  };
}

function readVerifiedManifest(args: {
  repositoryRealPath: string;
  manifestPath: string;
  verifiedDigest: string;
}): LiveRequestMaterializationManifest {
  const absolute = resolveContainedRegularFile({
    repositoryRealPath: args.repositoryRealPath,
    relativePath: args.manifestPath,
    rejectHardLinks: true,
  });
  try {
    const raw = fs.readFileSync(absolute);
    const value = JSON.parse(raw.toString('utf8')) as unknown;
    if (
      !raw.equals(
        Buffer.from(
          canonicalLiveAuthoringJsonBytes(value),
          'utf8',
        ),
      )
    ) {
      throw new Error('manifest_bytes_noncanonical');
    }
    assertValidLiveRequestMaterializationManifest(value);
    if (value.digest !== args.verifiedDigest) {
      throw new Error('manifest_identity_mismatch');
    }
    return value;
  } catch {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_b0_rejected',
    );
  }
}

function preservationFence(args: {
  repositoryRealPath: string;
  relativePath: string;
}): CanonicalLiveExecutionPreservationFence {
  const absolute = resolveContainedRegularFile({
    repositoryRealPath: args.repositoryRealPath,
    relativePath: args.relativePath,
    rejectHardLinks: true,
  });
  const descriptor = fs.openSync(absolute, 'r');
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  let openedStat: fs.Stats;
  let total = 0;
  try {
    openedStat = fs.fstatSync(descriptor);
    if (
      !openedStat.isFile() ||
      openedStat.nlink !== 1 ||
      openedStat.size < 0 ||
      openedStat.size > MAX_PRESERVATION_FILE_BYTES
    ) {
      throw new Error('preservation_file_invalid');
    }
    while (true) {
      const read = fs.readSync(
        descriptor,
        buffer,
        0,
        buffer.length,
        null,
      );
      if (read === 0) break;
      total += read;
      if (total > MAX_PRESERVATION_FILE_BYTES) {
        throw new Error('preservation_file_too_large');
      }
      hash.update(buffer.subarray(0, read));
    }
    const finalStat = fs.fstatSync(descriptor);
    if (
      finalStat.dev !== openedStat.dev ||
      finalStat.ino !== openedStat.ino ||
      finalStat.size !== openedStat.size ||
      finalStat.nlink !== 1
    ) {
      throw new Error('preservation_file_changed');
    }
  } catch {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_filesystem_rejected',
    );
  } finally {
    buffer.fill(0);
    fs.closeSync(descriptor);
  }
  try {
    const currentReal = fs.realpathSync(absolute);
    const currentStat = fs.statSync(currentReal);
    if (
      !pathsEqual(currentReal, absolute) ||
      currentStat.dev !== openedStat!.dev ||
      currentStat.ino !== openedStat!.ino ||
      currentStat.size !== openedStat!.size ||
      currentStat.nlink !== 1 ||
      total !== openedStat!.size
    ) {
      throw new Error('preservation_file_changed');
    }
  } catch {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_filesystem_rejected',
    );
  }
  return {
    path: args.relativePath,
    byteLength: total,
    sha256: hash.digest('hex'),
  };
}

function ensureContainedDirectory(args: {
  repositoryRealPath: string;
  relativePath: string;
}): string {
  if (canonicalRelativePathIssues(args.relativePath).length) {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_output_rejected',
    );
  }
  let current = args.repositoryRealPath;
  try {
    for (const segment of args.relativePath.split('/')) {
      const candidate = path.join(current, segment);
      try {
        fs.mkdirSync(candidate);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error;
        }
      }
      const lstat = fs.lstatSync(candidate);
      const real = fs.realpathSync(candidate);
      assertContained(args.repositoryRealPath, real);
      if (
        lstat.isSymbolicLink() ||
        !lstat.isDirectory() ||
        !pathsEqual(candidate, real)
      ) {
        throw new Error('output_alias_rejected');
      }
      current = candidate;
    }
    return current;
  } catch (error) {
    if (
      error instanceof
        CanonicalLiveExecutionRequestMaterializationFailure &&
      error.reasonCode ===
        'execution_request_materialization_output_rejected'
    ) {
      throw error;
    }
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_output_rejected',
    );
  }
}

let stagingCounter = 0;

function writeStagingRequest(args: {
  repositoryRealPath: string;
  stagingDirectory: string;
  requestDigest: string;
  bytes: string;
}): { absolutePath: string; relativePath: string } {
  stagingCounter += 1;
  const filename =
    `${args.requestDigest}.verify-${process.pid}-${stagingCounter}.json`;
  const absolutePath = path.join(
    args.stagingDirectory,
    filename,
  );
  const descriptor = fs.openSync(absolutePath, 'wx');
  let descriptorClosed = false;
  try {
    fs.writeFileSync(descriptor, args.bytes, 'utf8');
    fs.fsyncSync(descriptor);
  } catch (error) {
    fs.closeSync(descriptor);
    descriptorClosed = true;
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
    throw error;
  } finally {
    if (!descriptorClosed) {
      fs.closeSync(descriptor);
    }
  }
  return {
    absolutePath,
    relativePath: repoRelativePath(
      args.repositoryRealPath,
      absolutePath,
    ),
  };
}

function removeCreatedAuthorityIfUnchanged(args: {
  absolutePath: string;
  bytes: string;
}): void {
  const lstat = fs.lstatSync(args.absolutePath);
  const real = fs.realpathSync(args.absolutePath);
  if (
    lstat.isSymbolicLink() ||
    !lstat.isFile() ||
    lstat.nlink !== 1 ||
    !pathsEqual(real, args.absolutePath) ||
    !fs.readFileSync(real).equals(Buffer.from(args.bytes, 'utf8'))
  ) {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_output_rejected',
    );
  }
  fs.unlinkSync(real);
}

function externalBoundaryEvidence(): CanonicalLiveExecutionRequestMaterializationSuccess['externalBoundaryEvidence'] {
  return {
    canonicalPreflightRuns: 0,
    credentialReadsOrChecks: 0,
    providerCalls: 0,
    networkCalls: 0,
    externalStorageWrites: 0,
    databaseWrites: 0,
  };
}

export function canonicalLiveExecutionRequestMaterializationRejection(
  reason:
    | MaterializationReasonCode
    | unknown = 'execution_request_materialization_failed',
): CanonicalLiveExecutionRequestMaterializationRejection {
  const reasonCode =
    reason instanceof
    CanonicalLiveExecutionRequestMaterializationFailure
      ? reason.reasonCode
      : typeof reason === 'string' &&
          MATERIALIZATION_REASON_CODES.has(
            reason as MaterializationReasonCode,
          )
        ? (reason as MaterializationReasonCode)
        : 'execution_request_materialization_failed';
  return {
    version:
      CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_RESULT_VERSION,
    status: 'rejected',
    reasonCodes: [reasonCode],
    request: null,
    externalBoundaryEvidence: externalBoundaryEvidence(),
  };
}

export function materializeCanonicalLiveExecutionRequest(args: {
  repoRoot: string;
  inputPath: string;
  dependencies?: Partial<CanonicalLiveExecutionRequestMaterializationDependencies>;
}): CanonicalLiveExecutionRequestMaterializationSuccess {
  const dependencies = resolvedDependencies(args.dependencies);
  const repositoryRealPath = canonicalRepositoryRealPath(
    args.repoRoot,
  );
  const input = readCanonicalInput({
    repositoryRealPath,
    inputPath: args.inputPath,
  });
  const topology = deriveGitTopology({
    repositoryRealPath,
    dependencies,
  });
  const verifiedBundle = dependencies.verifyBundle({
    repoRoot: repositoryRealPath,
    manifestPath: input.manifestPath,
  });
  if (verifiedBundle.status !== 'verified') {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_b0_rejected',
    );
  }
  const manifest = readVerifiedManifest({
    repositoryRealPath,
    manifestPath: input.manifestPath,
    verifiedDigest: verifiedBundle.identities.manifestDigest,
  });
  const preservationFences = input.preservationPaths.map(
    (relativePath) =>
      preservationFence({
        repositoryRealPath,
        relativePath,
      }),
  );
  const request = buildCanonicalLiveExecutionRequest(
    {
      version: CANONICAL_LIVE_EXECUTION_REQUEST_VERSION,
      requestId: input.requestId,
      requestedAt: input.requestedAt,
      repository: {
        realPath: repositoryRealPath,
        expectedBranch: topology.branchRef,
        expectedHead: topology.head,
        expectedTrackedChanges: 0,
        expectedUntrackedChanges: 0,
        refs: topology.refs,
        divergence: topology.divergence,
      },
      canonicalBundle: {
        manifestPath: input.manifestPath,
        manifestDigest: verifiedBundle.identities.manifestDigest,
        verificationVersion:
          CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
        structuredOutputCompatibility:
          verifiedBundle.structuredOutputCompatibility,
        compactRepairStructuredOutputCompatibility:
          verifiedBundle.compactRepairStructuredOutputCompatibility,
      },
      preservationFences,
      expectedAbsentPaths: input.expectedAbsentPaths.slice(),
      credentialIsolation: {
        sourcePath: input.credentialSourcePath,
        variableName: 'OPENAI_API_KEY',
        assignmentPolicy: 'single-line-start-assignment/v1',
        rejectAmbientCredential: true,
        childEnvironmentPolicy:
          'minimal-platform-allowlist/v1',
        inheritedEnvironmentNames:
          minimalPlatformInheritedEnvironmentNames(
            dependencies.platform,
          ),
      },
      futureLiveCommand: {
        executable: 'node',
        arguments: manifest.futureLiveCommand.arguments.slice(),
        identitySha256: canonicalJsonDigest({
          executable: manifest.futureLiveCommand.executable,
          arguments: manifest.futureLiveCommand.arguments,
        }),
      },
    },
    dependencies.platform,
  );
  const bytes = canonicalLiveAuthoringJsonBytes(request);
  const outputRoot = ensureContainedDirectory({
    repositoryRealPath,
    relativePath: input.outputDir,
  });
  const stagingDirectory = ensureContainedDirectory({
    repositoryRealPath,
    relativePath: `${input.outputDir}/${STAGING_CATEGORY}`,
  });
  const requestDirectory = ensureContainedDirectory({
    repositoryRealPath,
    relativePath: `${input.outputDir}/${REQUEST_CATEGORY}`,
  });
  assertContained(repositoryRealPath, outputRoot);

  let staged:
    | { absolutePath: string; relativePath: string }
    | undefined;
  try {
    staged = writeStagingRequest({
      repositoryRealPath,
      stagingDirectory,
      requestDigest: request.digest,
      bytes,
    });
    let stagedReadiness: CanonicalLiveExecutionReadiness;
    try {
      stagedReadiness = dependencies.verifyExecution({
        repoRoot: repositoryRealPath,
        requestPath: staged.relativePath,
      });
    } catch {
      throw new CanonicalLiveExecutionRequestMaterializationFailure(
        'execution_request_materialization_verification_rejected',
      );
    }
    if (stagedReadiness.status !== 'ready') {
      throw new CanonicalLiveExecutionRequestMaterializationFailure(
        'execution_request_materialization_verification_rejected',
      );
    }
  } finally {
    if (staged && fs.existsSync(staged.absolutePath)) {
      fs.unlinkSync(staged.absolutePath);
    }
  }

  const destinationPath = path.join(
    requestDirectory,
    `${request.digest}.json`,
  );
  let persistence: { created: boolean };
  try {
    persistence = writeImmutableLocalArtifact({
      destinationPath,
      bytes,
    });
  } catch {
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_collision',
    );
  }
  const requestPath = repoRelativePath(
    repositoryRealPath,
    destinationPath,
  );
  let readiness: CanonicalLiveExecutionReadiness;
  try {
    readiness = dependencies.verifyExecution({
      repoRoot: repositoryRealPath,
      requestPath,
    });
  } catch {
    if (persistence.created) {
      removeCreatedAuthorityIfUnchanged({
        absolutePath: destinationPath,
        bytes,
      });
    }
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_verification_rejected',
    );
  }
  if (readiness.status !== 'ready') {
    if (persistence.created) {
      removeCreatedAuthorityIfUnchanged({
        absolutePath: destinationPath,
        bytes,
      });
    }
    throw new CanonicalLiveExecutionRequestMaterializationFailure(
      'execution_request_materialization_verification_rejected',
    );
  }
  return {
    version:
      CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_RESULT_VERSION,
    status: 'materialized',
    request: {
      path: requestPath,
      digest: request.digest,
      created: persistence.created,
    },
    verification: {
      version: readiness.version,
      status: 'ready',
      readinessDigest: readiness.digest,
    },
    externalBoundaryEvidence: externalBoundaryEvidence(),
  };
}
