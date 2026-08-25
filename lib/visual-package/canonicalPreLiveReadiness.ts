import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import {
  canonicalLiveAuthoringJsonBytes,
} from './canonicalLiveAuthoringArtifacts';
import {
  CanonicalMaterializationInputReadError,
  canonicalMaterializationRelativePathIssues,
  canonicalMaterializationRepositoryRealPath,
  readCanonicalMaterializationInputArtifact,
} from './canonicalMaterializationInput';
import {
  canonicalMaterializationInputWriteRejection,
  writeCanonicalMaterializationInput,
  type CanonicalMaterializationInputWriteSuccess,
} from './canonicalMaterializationInputWriter';
import {
  CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION,
  assertValidCanonicalLiveExecutionRequestMaterializationInput,
  canonicalLiveExecutionRequestMaterializationRejection,
  materializeCanonicalLiveExecutionRequest,
  type CanonicalLiveExecutionRequestMaterializationInput,
  type CanonicalLiveExecutionRequestMaterializationSuccess,
} from './liveExecutionRequestMaterialization';
import {
  CANONICAL_LIVE_EXECUTION_EXPECTED_ABSENCE_CATEGORIES,
  CANONICAL_LIVE_EXECUTION_READINESS_VERSION,
  verifyCanonicalLiveExecution,
  type CanonicalLiveExecutionReadiness,
} from './liveExecutionSupervisor';
import {
  CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
  LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
  assertValidLiveRequestMaterializationInput,
  assertValidLiveRequestMaterializationManifest,
  liveRequestPolicyAuthorityIssues,
  liveRequestStructuredOutputCompatibilityAuthorityIssues,
  materializeCanonicalLiveRequestBundle,
  verifyCanonicalLiveRequestBundle,
  type CanonicalLiveRequestVerifiedResult,
  type CanonicalLiveRequestPolicyAuthority,
  type LiveRequestMaterializationInput,
  type LiveRequestMaterializationManifest,
  type LiveRequestMaterializationResult,
  type LiveRequestStructuredOutputCompatibilityAuthority,
} from './liveRequestMaterialization';
import {
  canonicalJsonDigest,
  repoRelativePath,
} from './integrity';
import {
  writeImmutableLocalArtifact,
} from './preRenderBlueprintLifecycle';

export const CANONICAL_PRE_LIVE_READINESS_EVIDENCE_VERSION =
  'canonical-pre-live-readiness-evidence/v46' as const;
export const CANONICAL_PRE_LIVE_READINESS_FAILURE_VERSION =
  'canonical-pre-live-readiness-failure/v3' as const;
export const CANONICAL_PRE_LIVE_READINESS_HISTORICAL_FAILURE_VERSION =
  'canonical-pre-live-readiness-failure/v2' as const;
export const CANONICAL_PRE_LIVE_DEPENDENCY_AUTHORITY_VERSION =
  'canonical-pre-live-dependency-authority/v1' as const;
export const CANONICAL_PRE_LIVE_READINESS_EVIDENCE_CATEGORY =
  'canonical-pre-live-readiness-evidence' as const;
export const CANONICAL_PRE_LIVE_READINESS_FAILURE_CATEGORY =
  'canonical-pre-live-readiness-failures' as const;

const IDENTIFIER_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const STORY_KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const REASON_CODE_PATTERN = /^[a-z0-9_:-]{1,128}$/;
const MAX_EVIDENCE_BYTES = 1024 * 1024;
const MAX_EVIDENCE_FILES = 64;

const EXPECTED_ABSENCE_CATEGORIES =
  CANONICAL_LIVE_EXECUTION_EXPECTED_ABSENCE_CATEGORIES;

const DEPENDENCY_FILES = {
  tsx: {
    lockKey: 'node_modules/tsx',
    packagePath: 'node_modules/tsx/package.json',
    authorityPath: 'node_modules/tsx/dist/cli.mjs',
  },
  typescript: {
    lockKey: 'node_modules/typescript',
    packagePath: 'node_modules/typescript/package.json',
    authorityPath: 'node_modules/typescript/lib/tsc.js',
  },
  prisma: {
    lockKey: 'node_modules/prisma',
    packagePath: 'node_modules/prisma/package.json',
    authorityPath: 'node_modules/prisma/build/index.js',
  },
  prismaClient: {
    lockKey: 'node_modules/@prisma/client',
    packagePath: 'node_modules/@prisma/client/package.json',
    authorityPath: 'node_modules/@prisma/client/default.js',
  },
  generatedPrismaClient: {
    authorityPath: 'node_modules/.prisma/client/schema.prisma',
  },
} as const;

export type CanonicalPreLiveReadinessMode =
  | 'prepare'
  | 'verify';

export interface CanonicalPreLiveReadinessInput {
  repoRoot: string;
  outputRoot: string;
  storySourceKey: string;
  storySourcePath: string;
  requestId: string;
  requestedAt: string;
  credentialSourcePath: string;
}

export interface CanonicalPreLiveReadinessLaunchAuthority {
  npmCliSha256: string;
  offlineInstallCompleted: boolean;
  prismaGenerationCompleted: boolean;
}

export interface CanonicalPreLiveDependencyPackageAuthority {
  version: string;
  packageJsonSha256: string;
  authorityFileSha256: string;
}

export interface CanonicalPreLiveDependencyAuthority {
  version: typeof CANONICAL_PRE_LIVE_DEPENDENCY_AUTHORITY_VERSION;
  nodeVersion: string;
  packageJsonSha256: string;
  packageLockSha256: string;
  npmCliSha256: string;
  offlineInstallCompleted: true;
  prismaGenerationCompleted: true;
  packages: {
    tsx: CanonicalPreLiveDependencyPackageAuthority;
    typescript: CanonicalPreLiveDependencyPackageAuthority;
    prisma: CanonicalPreLiveDependencyPackageAuthority;
    prismaClient: CanonicalPreLiveDependencyPackageAuthority;
  };
  generatedPrismaClientSchemaSha256: string;
}

export interface CanonicalPreLiveRepositoryAuthority {
  repositoryRealPath: string;
  branchRef: string;
  head: string;
  upstreamRef: string;
  upstreamHead: string;
  ahead: 0;
  behind: 0;
}

export interface CanonicalPreLiveReadinessEvidence {
  version: typeof CANONICAL_PRE_LIVE_READINESS_EVIDENCE_VERSION;
  status: 'ready_for_spend_gate';
  request: {
    requestId: string;
    requestedAt: string;
    storySourceKey: string;
    storySourcePath: string;
    outputRoot: string;
    credentialSourcePathSha256: string;
    childRequestIds: {
      b0: string;
      execution: string;
    };
  };
  dependencyAuthority: CanonicalPreLiveDependencyAuthority;
  repositoryAuthority: CanonicalPreLiveRepositoryAuthority;
  canonicalAuthorities: {
    materializationInputs: {
      source: {
        path: string;
        digest: string;
      };
      execution: {
        path: string;
        digest: string;
      };
    };
    b0: {
      manifestPath: string;
      manifestDigest: string;
      verificationVersion:
        typeof CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION;
      sourceAuthorityRequestDigest: string;
      sourceSnapshotDigest: string;
      normalizedSourceDigest: string;
      liveAuthoringRequestDigest: string;
      structuredOutputCompatibility:
        LiveRequestStructuredOutputCompatibilityAuthority;
      compactRepairStructuredOutputCompatibility:
        LiveRequestStructuredOutputCompatibilityAuthority;
      pageContractRepairStructuredOutputCompatibility:
        LiveRequestStructuredOutputCompatibilityAuthority;
      representedElsewhereRepairStructuredOutputCompatibility:
        LiveRequestStructuredOutputCompatibilityAuthority;
      pageSpatialReferenceRepairStructuredOutputCompatibility:
        LiveRequestStructuredOutputCompatibilityAuthority;
      structuralBundleRepairStructuredOutputCompatibility:
        LiveRequestStructuredOutputCompatibilityAuthority;
      bookSurfaceRepairStructuredOutputCompatibility:
        LiveRequestStructuredOutputCompatibilityAuthority;
      presentationRequirementRepairStructuredOutputCompatibility:
        LiveRequestStructuredOutputCompatibilityAuthority;
      stablePropScopeRepairStructuredOutputCompatibility:
        LiveRequestStructuredOutputCompatibilityAuthority;
      requestPolicy: CanonicalLiveRequestPolicyAuthority;
    };
    executionRequest: {
      path: string;
      digest: string;
    };
    supervisorVerification: {
      version:
        typeof CANONICAL_LIVE_EXECUTION_READINESS_VERSION;
      readinessDigest: string;
    };
  };
  pricingAuthority: 'not_checked';
  canonicalPreflight: 'not_run';
  credentialAccess: 'none';
  providerCalls: 0;
  liveAuthority: 'none';
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export type CanonicalPreLiveReadinessPhase =
  | 'launcher'
  | 'input'
  | 'dependency'
  | 'topology'
  | 'source_input'
  | 'b0_materialization'
  | 'b0_verification'
  | 'execution_input'
  | 'execution_materialization'
  | 'supervisor_verification'
  | 'evidence';

export type CanonicalPreLiveGitProfile =
  | 'bootstrap_launcher'
  | 'private_entry';
export type CanonicalPreLiveGitCommandId =
  | 'repository_top_level'
  | 'symbolic_branch'
  | 'upstream_ref'
  | 'head_commit'
  | 'upstream_head_commit'
  | 'divergence'
  | 'worktree_status'
  | 'output_root_ignore';
export type CanonicalPreLiveGitFailureClass =
  | 'spawn_error'
  | 'timeout'
  | 'signal'
  | 'output_ceiling'
  | 'malformed_result'
  | 'nonzero_exit';

export interface CanonicalPreLiveGitDiagnostic {
  profile: CanonicalPreLiveGitProfile;
  commandId: CanonicalPreLiveGitCommandId;
  failureClass: CanonicalPreLiveGitFailureClass | null;
  exitStatus: number | null;
  signalClass:
    | 'none'
    | 'termination'
    | 'interrupt'
    | 'kill'
    | 'abort'
    | 'hangup'
    | 'unknown';
  errorClass:
    | 'none'
    | 'timeout'
    | 'output_limit'
    | 'not_found'
    | 'permission_denied'
    | 'unknown';
  stderrClass:
    | 'none'
    | 'safe_directory'
    | 'not_a_git_repository'
    | 'ref_not_found'
    | 'permission_denied'
    | 'unclassified';
  stdoutBytes: number;
  stderrBytes: number;
}

export interface CanonicalPreLiveReadinessFailure {
  version: typeof CANONICAL_PRE_LIVE_READINESS_FAILURE_VERSION;
  status: 'rejected';
  mode: CanonicalPreLiveReadinessMode;
  phase: CanonicalPreLiveReadinessPhase;
  reasonCodes: string[];
  authorityReasonCodes: string[];
  gitDiagnostic: CanonicalPreLiveGitDiagnostic | null;
  requestIdentityDigest: string | null;
  pricingAuthority: 'not_checked';
  canonicalPreflight: 'not_run';
  credentialAccess: 'none';
  providerCalls: 0;
  liveAuthority: 'none';
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export type CanonicalPreLiveReadinessResult =
  | CanonicalPreLiveReadinessEvidence
  | CanonicalPreLiveReadinessFailure;

export interface HistoricalCanonicalPreLiveReadinessFailureV2 {
  version:
    typeof CANONICAL_PRE_LIVE_READINESS_HISTORICAL_FAILURE_VERSION;
  status: 'rejected';
  mode: CanonicalPreLiveReadinessMode;
  phase: CanonicalPreLiveReadinessPhase;
  reasonCodes: string[];
  authorityReasonCodes: string[];
  requestIdentityDigest: string | null;
  pricingAuthority: 'not_checked';
  canonicalPreflight: 'not_run';
  credentialAccess: 'none';
  providerCalls: 0;
  liveAuthority: 'none';
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

interface GitProviderResult {
  status: number | null;
  signal: NodeJS.Signals | string | null;
  error?: Error | { code?: unknown };
  stdout?: string;
  stderr?: string;
}

type GitResultProvider = (options: {
  profile: 'private_entry';
  commandId: CanonicalPreLiveGitCommandId;
}) => GitProviderResult;

export interface CanonicalPreLiveReadinessDependencies {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  gitResultProvider?: GitResultProvider;
  inspectDependencies: (args: {
    repositoryRealPath: string;
    launchAuthority: CanonicalPreLiveReadinessLaunchAuthority;
  }) => CanonicalPreLiveDependencyAuthority;
  writeMaterializationInput: typeof writeCanonicalMaterializationInput;
  materializeB0: typeof materializeCanonicalLiveRequestBundle;
  verifyB0: typeof verifyCanonicalLiveRequestBundle;
  materializeExecutionRequest:
    typeof materializeCanonicalLiveExecutionRequest;
  verifyExecution: typeof verifyCanonicalLiveExecution;
}

interface SharedGitTopologyAuthority {
  repositoryRealPath: string;
  branchRef: string;
  head: string;
  upstreamRef: string;
}

type SharedGitTopologyError = Error & {
  reasonCode: string;
  diagnostic: CanonicalPreLiveGitDiagnostic | null;
};

const require = createRequire(import.meta.url);
const canonicalPreLiveGitBoundary = require(
  '../../scripts/lib/canonical-pre-live-git-invocation.cjs',
) as {
  CanonicalPreLiveGitTopologyError: new (
    reasonCode: string,
    diagnostic?: CanonicalPreLiveGitDiagnostic | null,
  ) => SharedGitTopologyError;
  isCanonicalPreLiveGitDiagnostic: (
    value: unknown,
  ) => value is CanonicalPreLiveGitDiagnostic;
  verifyCanonicalPreLiveGitTopology: (options: {
    profile: CanonicalPreLiveGitProfile;
    repositoryRealPath: string;
    outputRoot: string;
    environment: NodeJS.ProcessEnv;
    platform: NodeJS.Platform;
    resultProvider?: (options: {
      profile: CanonicalPreLiveGitProfile;
      commandId: CanonicalPreLiveGitCommandId;
    }) => GitProviderResult;
  }) => SharedGitTopologyAuthority;
};

const PRIVATE_TOPOLOGY_REASON_CODES = new Map<string, string>([
  [
    'bootstrap_git_rejected',
    'pre_live_topology_git_rejected',
  ],
  [
    'bootstrap_repository_mismatch',
    'pre_live_topology_repository_mismatch',
  ],
  [
    'bootstrap_dedicated_branch_required',
    'pre_live_topology_dedicated_branch_required',
  ],
  [
    'bootstrap_same_name_upstream_required',
    'pre_live_topology_same_name_origin_required',
  ],
  [
    'bootstrap_head_mismatch',
    'pre_live_topology_head_mismatch',
  ],
  [
    'bootstrap_divergence_rejected',
    'pre_live_topology_divergence_rejected',
  ],
  [
    'bootstrap_dirty_rejected',
    'pre_live_topology_dirty_rejected',
  ],
  [
    'bootstrap_output_not_ignored',
    'pre_live_output_root_must_be_ignored',
  ],
]);

interface CanonicalPreLiveLayout {
  inputRoot: string;
  b0Root: string;
  executionRoot: string;
  expectedAbsentPaths: string[];
}

class CanonicalPreLiveReadinessError extends Error {
  constructor(
    readonly phase: CanonicalPreLiveReadinessPhase,
    readonly reasonCode: string,
    readonly authorityReasonCodes: readonly string[] = [],
    readonly gitDiagnostic: CanonicalPreLiveGitDiagnostic | null = null,
  ) {
    super(reasonCode);
    this.name = 'CanonicalPreLiveReadinessError';
  }
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

function sha256(value: Buffer | string): string {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
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
  candidatePath: string,
): void {
  const relative = path.relative(
    repositoryRealPath,
    candidatePath,
  );
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    throw new Error('path_outside_repository');
  }
}

function stableReasonCodes(
  values: readonly string[],
  fallback: string,
): string[] {
  const result = [
    ...new Set(
      values.map((value) =>
        REASON_CODE_PATTERN.test(value) ? value : fallback,
      ),
    ),
  ]
    .sort()
    .slice(0, 64);
  return result.length > 0 ? result : [fallback];
}

function requestIdentityDigest(
  input: Partial<CanonicalPreLiveReadinessInput>,
): string | null {
  if (
    typeof input.requestId !== 'string' ||
    typeof input.requestedAt !== 'string'
  ) {
    return null;
  }
  try {
    return canonicalJsonDigest({
      requestId: input.requestId,
      requestedAt: input.requestedAt,
    });
  } catch {
    return null;
  }
}

function failureWithoutDigest(
  value: Omit<
    CanonicalPreLiveReadinessFailure,
    'digestAlgorithm' | 'digest'
  >,
): unknown {
  return value;
}

export function buildCanonicalPreLiveReadinessFailure(args: {
  mode: CanonicalPreLiveReadinessMode;
  phase: CanonicalPreLiveReadinessPhase;
  reasonCodes: readonly string[];
  authorityReasonCodes?: readonly string[];
  gitDiagnostic?: CanonicalPreLiveGitDiagnostic | null;
  input?: Partial<CanonicalPreLiveReadinessInput>;
}): CanonicalPreLiveReadinessFailure {
  const gitDiagnostic = args.gitDiagnostic ?? null;
  if (
    gitDiagnostic !== null &&
    (!canonicalPreLiveGitBoundary.isCanonicalPreLiveGitDiagnostic(
      gitDiagnostic,
    ) ||
      gitDiagnostic.failureClass === null)
  ) {
    throw new Error('pre_live_git_diagnostic_invalid');
  }
  const withoutDigest = {
    version: CANONICAL_PRE_LIVE_READINESS_FAILURE_VERSION,
    status: 'rejected' as const,
    mode: args.mode,
    phase: args.phase,
    reasonCodes: stableReasonCodes(
      args.reasonCodes,
      'pre_live_readiness_failed',
    ),
    authorityReasonCodes: stableReasonCodes(
      args.authorityReasonCodes ?? [],
      'authority_rejected',
    ).filter(
      (value) =>
        (args.authorityReasonCodes?.length ?? 0) > 0 ||
        value !== 'authority_rejected',
    ),
    gitDiagnostic,
    requestIdentityDigest: requestIdentityDigest(
      args.input ?? {},
    ),
    pricingAuthority: 'not_checked' as const,
    canonicalPreflight: 'not_run' as const,
    credentialAccess: 'none' as const,
    providerCalls: 0 as const,
    liveAuthority: 'none' as const,
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(
      failureWithoutDigest(withoutDigest),
    ),
  };
}

function validFailureReasonCodes(
  value: unknown,
  allowEmpty: boolean,
): boolean {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0)
  ) {
    return false;
  }
  const values = value.filter(
    (entry): entry is string =>
      typeof entry === 'string' &&
      REASON_CODE_PATTERN.test(entry),
  );
  return (
    values.length === value.length &&
    values.every(
      (entry, index) =>
        index === 0 || values[index - 1]! < entry,
    )
  );
}

export function canonicalPreLiveReadinessFailureIssues(
  value: unknown,
  options: { allowHistorical?: boolean } = {},
): string[] {
  const failure = recordValue(value);
  if (!failure) return ['pre_live_failure_not_object'];
  const current =
    failure.version ===
    CANONICAL_PRE_LIVE_READINESS_FAILURE_VERSION;
  const historical =
    failure.version ===
    CANONICAL_PRE_LIVE_READINESS_HISTORICAL_FAILURE_VERSION;
  const issues: string[] = [];
  if (!current && !(historical && options.allowHistorical)) {
    issues.push('pre_live_failure_version_not_current');
  }
  const expectedKeys = [
    'version',
    'status',
    'mode',
    'phase',
    'reasonCodes',
    'authorityReasonCodes',
    ...(current ? ['gitDiagnostic'] : []),
    'requestIdentityDigest',
    'pricingAuthority',
    'canonicalPreflight',
    'credentialAccess',
    'providerCalls',
    'liveAuthority',
    'digestAlgorithm',
    'digest',
  ];
  if (!exactKeys(failure, expectedKeys)) {
    issues.push('pre_live_failure_fields_invalid');
  }
  if (
    failure.status !== 'rejected' ||
    !['prepare', 'verify'].includes(String(failure.mode)) ||
    ![
      'launcher',
      'input',
      'dependency',
      'topology',
      'source_input',
      'b0_materialization',
      'b0_verification',
      'execution_input',
      'execution_materialization',
      'supervisor_verification',
      'evidence',
    ].includes(String(failure.phase)) ||
    !validFailureReasonCodes(failure.reasonCodes, false) ||
    !validFailureReasonCodes(
      failure.authorityReasonCodes,
      true,
    ) ||
    !(
      failure.requestIdentityDigest === null ||
      (typeof failure.requestIdentityDigest === 'string' &&
        DIGEST_PATTERN.test(failure.requestIdentityDigest))
    ) ||
    failure.pricingAuthority !== 'not_checked' ||
    failure.canonicalPreflight !== 'not_run' ||
    failure.credentialAccess !== 'none' ||
    failure.providerCalls !== 0 ||
    failure.liveAuthority !== 'none' ||
    failure.digestAlgorithm !== 'canonical-json-sha256' ||
    typeof failure.digest !== 'string' ||
    !DIGEST_PATTERN.test(failure.digest)
  ) {
    issues.push('pre_live_failure_contract_invalid');
  }
  if (
    current &&
    failure.gitDiagnostic !== null &&
    (!canonicalPreLiveGitBoundary.isCanonicalPreLiveGitDiagnostic(
      failure.gitDiagnostic,
    ) ||
      failure.gitDiagnostic.failureClass === null)
  ) {
    issues.push('pre_live_failure_git_diagnostic_invalid');
  }
  if (
    typeof failure.digest === 'string' &&
    DIGEST_PATTERN.test(failure.digest)
  ) {
    const {
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...withoutDigest
    } = failure;
    try {
      if (canonicalJsonDigest(withoutDigest) !== failure.digest) {
        issues.push('pre_live_failure_digest_invalid');
      }
    } catch {
      issues.push('pre_live_failure_digest_invalid');
    }
  }
  return [...new Set(issues)].sort();
}

export function inspectCanonicalPreLiveReadinessFailure(
  value: unknown,
):
  | {
      authority: 'current';
      failure: CanonicalPreLiveReadinessFailure;
    }
  | {
      authority: 'historical_evidence';
      failure: HistoricalCanonicalPreLiveReadinessFailureV2;
    } {
  const issues = canonicalPreLiveReadinessFailureIssues(
    value,
    { allowHistorical: true },
  );
  if (issues.length > 0) {
    throw new Error('pre_live_failure_rejected');
  }
  const failure = value as
    | CanonicalPreLiveReadinessFailure
    | HistoricalCanonicalPreLiveReadinessFailureV2;
  return failure.version ===
    CANONICAL_PRE_LIVE_READINESS_FAILURE_VERSION
    ? { authority: 'current', failure }
    : { authority: 'historical_evidence', failure };
}

function evidenceWithoutDigest(
  value: Omit<
    CanonicalPreLiveReadinessEvidence,
    'digestAlgorithm' | 'digest'
  >,
): unknown {
  return value;
}

function buildEvidence(
  value: Omit<
    CanonicalPreLiveReadinessEvidence,
    'digestAlgorithm' | 'digest'
  >,
): CanonicalPreLiveReadinessEvidence {
  return {
    ...value,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(
      evidenceWithoutDigest(value),
    ),
  };
}

export function canonicalPreLiveReadinessInputIssues(
  value: unknown,
): string[] {
  const input = recordValue(value);
  if (!input) return ['pre_live_input_not_object'];
  const issues: string[] = [];
  if (
    !exactKeys(input, [
      'repoRoot',
      'outputRoot',
      'storySourceKey',
      'storySourcePath',
      'requestId',
      'requestedAt',
      'credentialSourcePath',
    ])
  ) {
    issues.push('pre_live_input_fields_invalid');
  }
  if (
    typeof input.repoRoot !== 'string' ||
    !path.isAbsolute(input.repoRoot)
  ) {
    issues.push('pre_live_repo_root_invalid');
  }
  if (
    canonicalMaterializationRelativePathIssues(
      input.outputRoot,
    ).length > 0
  ) {
    issues.push('pre_live_output_root_invalid');
  }
  if (
    typeof input.storySourceKey !== 'string' ||
    !STORY_KEY_PATTERN.test(input.storySourceKey)
  ) {
    issues.push('pre_live_story_source_key_invalid');
  }
  if (
    canonicalMaterializationRelativePathIssues(
      input.storySourcePath,
    ).length > 0 ||
    typeof input.storySourcePath !== 'string' ||
    !input.storySourcePath.toLowerCase().endsWith('.md')
  ) {
    issues.push('pre_live_story_source_path_invalid');
  }
  if (
    typeof input.requestId !== 'string' ||
    !IDENTIFIER_PATTERN.test(input.requestId)
  ) {
    issues.push('pre_live_request_id_invalid');
  }
  if (!isCanonicalTimestamp(input.requestedAt)) {
    issues.push('pre_live_requested_at_invalid');
  }
  if (
    typeof input.credentialSourcePath !== 'string' ||
    input.credentialSourcePath.length === 0 ||
    input.credentialSourcePath.length > 4096 ||
    input.credentialSourcePath.includes('\0') ||
    !path.isAbsolute(input.credentialSourcePath)
  ) {
    issues.push('pre_live_credential_source_path_invalid');
  }
  return [...new Set(issues)].sort();
}

export function assertValidCanonicalPreLiveReadinessInput(
  value: unknown,
): asserts value is CanonicalPreLiveReadinessInput {
  if (
    canonicalPreLiveReadinessInputIssues(value).length > 0
  ) {
    throw new CanonicalPreLiveReadinessError(
      'input',
      'pre_live_input_rejected',
    );
  }
}

function layout(
  input: CanonicalPreLiveReadinessInput,
): CanonicalPreLiveLayout {
  const inputRoot = `${input.outputRoot}/materialization-inputs`;
  const b0Root = `${input.outputRoot}/b0`;
  const executionRoot = `${input.outputRoot}/execution`;
  return {
    inputRoot,
    b0Root,
    executionRoot,
    expectedAbsentPaths: EXPECTED_ABSENCE_CATEGORIES.map(
      (category) => `${b0Root}/${category}`,
    ).sort(),
  };
}

function childRequestIds(
  input: CanonicalPreLiveReadinessInput,
): { b0: string; execution: string } {
  return {
    b0: `${input.requestId}:b0`,
    execution: `${input.requestId}:execution`,
  };
}

function verifyDedicatedTopology(args: {
  repositoryRealPath: string;
  outputRoot: string;
  dependencies: CanonicalPreLiveReadinessDependencies;
}): CanonicalPreLiveRepositoryAuthority {
  try {
    const authority =
      canonicalPreLiveGitBoundary.verifyCanonicalPreLiveGitTopology(
        {
          profile: 'private_entry',
          repositoryRealPath: args.repositoryRealPath,
          outputRoot: args.outputRoot,
          environment: args.dependencies.env,
          platform: args.dependencies.platform,
          resultProvider: args.dependencies.gitResultProvider
            ? ({ profile, commandId }) => {
                if (profile !== 'private_entry') {
                  throw new Error('git_profile_invalid');
                }
                return args.dependencies.gitResultProvider!({
                  profile,
                  commandId,
                });
              }
            : undefined,
        },
      );
    return {
      repositoryRealPath: authority.repositoryRealPath,
      branchRef: authority.branchRef,
      head: authority.head,
      upstreamRef: authority.upstreamRef,
      upstreamHead: authority.head,
      ahead: 0,
      behind: 0,
    };
  } catch (error) {
    if (
      error instanceof
      canonicalPreLiveGitBoundary.CanonicalPreLiveGitTopologyError
    ) {
      throw new CanonicalPreLiveReadinessError(
        'topology',
        PRIVATE_TOPOLOGY_REASON_CODES.get(error.reasonCode) ??
          'pre_live_topology_git_rejected',
        [],
        canonicalPreLiveGitBoundary.isCanonicalPreLiveGitDiagnostic(
          error.diagnostic,
        )
          ? error.diagnostic
          : null,
      );
    }
    throw new CanonicalPreLiveReadinessError(
      'topology',
      'pre_live_topology_git_rejected',
    );
  }
}

function readUniqueFile(args: {
  repositoryRealPath: string;
  relativePath: string;
  maximumBytes?: number;
}): { absolutePath: string; bytes: Buffer } {
  if (
    canonicalMaterializationRelativePathIssues(
      args.relativePath,
    ).length > 0
  ) {
    throw new Error('file_path_invalid');
  }
  const absolutePath = path.resolve(
    args.repositoryRealPath,
    args.relativePath,
  );
  assertContained(args.repositoryRealPath, absolutePath);
  let descriptor: number | null = null;
  try {
    const real = fs.realpathSync(absolutePath);
    const lstat = fs.lstatSync(absolutePath);
    if (
      !pathsEqual(real, absolutePath) ||
      lstat.isSymbolicLink() ||
      !lstat.isFile()
    ) {
      throw new Error('file_alias_rejected');
    }
    descriptor = fs.openSync(absolutePath, 'r');
    const before = fs.fstatSync(descriptor);
    if (
      !before.isFile() ||
      before.nlink !== 1 ||
      before.size < 0 ||
      before.size >
        (args.maximumBytes ?? MAX_EVIDENCE_BYTES)
    ) {
      throw new Error('file_identity_rejected');
    }
    const bytes = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor);
    const currentReal = fs.realpathSync(absolutePath);
    const current = fs.statSync(currentReal);
    if (
      bytes.length !== before.size ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.nlink !== 1 ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs ||
      !pathsEqual(currentReal, absolutePath) ||
      current.dev !== before.dev ||
      current.ino !== before.ino ||
      current.size !== before.size ||
      current.nlink !== 1 ||
      current.mtimeMs !== before.mtimeMs ||
      current.ctimeMs !== before.ctimeMs ||
      !fs.readFileSync(currentReal).equals(bytes)
    ) {
      throw new Error('file_changed');
    }
    return { absolutePath, bytes };
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

function dependencyPackageAuthority(args: {
  repositoryRealPath: string;
  lockPackages: Record<string, unknown>;
  lockKey: string;
  packagePath: string;
  authorityPath: string;
}): CanonicalPreLiveDependencyPackageAuthority {
  const lockEntry = recordValue(
    args.lockPackages[args.lockKey],
  );
  if (
    !lockEntry ||
    typeof lockEntry.version !== 'string' ||
    lockEntry.version.length === 0
  ) {
    throw new Error('dependency_lock_entry_invalid');
  }
  const packageFile = readUniqueFile({
    repositoryRealPath: args.repositoryRealPath,
    relativePath: args.packagePath,
  });
  let packageJson: unknown;
  try {
    packageJson = JSON.parse(
      packageFile.bytes.toString('utf8'),
    ) as unknown;
  } catch {
    throw new Error('dependency_package_json_invalid');
  }
  const packageObject = recordValue(packageJson);
  if (
    !packageObject ||
    packageObject.version !== lockEntry.version
  ) {
    throw new Error('dependency_version_mismatch');
  }
  const authorityFile = readUniqueFile({
    repositoryRealPath: args.repositoryRealPath,
    relativePath: args.authorityPath,
    maximumBytes: 64 * 1024 * 1024,
  });
  return {
    version: lockEntry.version,
    packageJsonSha256: sha256(packageFile.bytes),
    authorityFileSha256: sha256(authorityFile.bytes),
  };
}

export function inspectCanonicalPreLiveDependencyAuthority(
  args: {
    repositoryRealPath: string;
    launchAuthority: CanonicalPreLiveReadinessLaunchAuthority;
  },
): CanonicalPreLiveDependencyAuthority {
  if (
    !DIGEST_PATTERN.test(args.launchAuthority.npmCliSha256) ||
    !args.launchAuthority.offlineInstallCompleted ||
    !args.launchAuthority.prismaGenerationCompleted
  ) {
    throw new CanonicalPreLiveReadinessError(
      'dependency',
      'pre_live_dependency_bootstrap_required',
    );
  }
  try {
    const nodeModulesPath = path.join(
      args.repositoryRealPath,
      'node_modules',
    );
    const nodeModulesReal = fs.realpathSync(nodeModulesPath);
    const nodeModulesLstat = fs.lstatSync(nodeModulesPath);
    if (
      !pathsEqual(nodeModulesPath, nodeModulesReal) ||
      nodeModulesLstat.isSymbolicLink() ||
      !nodeModulesLstat.isDirectory()
    ) {
      throw new Error('node_modules_alias_rejected');
    }
    const packageFile = readUniqueFile({
      repositoryRealPath: args.repositoryRealPath,
      relativePath: 'package.json',
    });
    const lockFile = readUniqueFile({
      repositoryRealPath: args.repositoryRealPath,
      relativePath: 'package-lock.json',
      maximumBytes: 16 * 1024 * 1024,
    });
    let lock: unknown;
    try {
      lock = JSON.parse(
        lockFile.bytes.toString('utf8'),
      ) as unknown;
    } catch {
      throw new Error('package_lock_invalid');
    }
    const lockObject = recordValue(lock);
    const lockPackages = recordValue(lockObject?.packages);
    if (
      !lockObject ||
      lockObject.lockfileVersion !== 3 ||
      lockObject.requires !== true ||
      !lockPackages
    ) {
      throw new Error('package_lock_invalid');
    }
    const packages = {
      tsx: dependencyPackageAuthority({
        repositoryRealPath: args.repositoryRealPath,
        lockPackages,
        ...DEPENDENCY_FILES.tsx,
      }),
      typescript: dependencyPackageAuthority({
        repositoryRealPath: args.repositoryRealPath,
        lockPackages,
        ...DEPENDENCY_FILES.typescript,
      }),
      prisma: dependencyPackageAuthority({
        repositoryRealPath: args.repositoryRealPath,
        lockPackages,
        ...DEPENDENCY_FILES.prisma,
      }),
      prismaClient: dependencyPackageAuthority({
        repositoryRealPath: args.repositoryRealPath,
        lockPackages,
        ...DEPENDENCY_FILES.prismaClient,
      }),
    };
    const generatedSchema = readUniqueFile({
      repositoryRealPath: args.repositoryRealPath,
      relativePath:
        DEPENDENCY_FILES.generatedPrismaClient.authorityPath,
      maximumBytes: 16 * 1024 * 1024,
    });
    return {
      version:
        CANONICAL_PRE_LIVE_DEPENDENCY_AUTHORITY_VERSION,
      nodeVersion: process.versions.node,
      packageJsonSha256: sha256(packageFile.bytes),
      packageLockSha256: sha256(lockFile.bytes),
      npmCliSha256: args.launchAuthority.npmCliSha256,
      offlineInstallCompleted: true,
      prismaGenerationCompleted: true,
      packages,
      generatedPrismaClientSchemaSha256: sha256(
        generatedSchema.bytes,
      ),
    };
  } catch (error) {
    if (error instanceof CanonicalPreLiveReadinessError) {
      throw error;
    }
    throw new CanonicalPreLiveReadinessError(
      'dependency',
      'pre_live_dependency_authority_rejected',
    );
  }
}

function defaultDependencies(): CanonicalPreLiveReadinessDependencies {
  return {
    env: process.env,
    platform: process.platform,
    inspectDependencies:
      inspectCanonicalPreLiveDependencyAuthority,
    writeMaterializationInput:
      writeCanonicalMaterializationInput,
    materializeB0: materializeCanonicalLiveRequestBundle,
    verifyB0: verifyCanonicalLiveRequestBundle,
    materializeExecutionRequest:
      materializeCanonicalLiveExecutionRequest,
    verifyExecution: verifyCanonicalLiveExecution,
  };
}

function resolvedDependencies(
  overrides:
    | Partial<CanonicalPreLiveReadinessDependencies>
    | undefined,
): CanonicalPreLiveReadinessDependencies {
  return {
    ...defaultDependencies(),
    ...overrides,
  };
}

function ensureContainedDirectory(args: {
  repositoryRealPath: string;
  relativePath: string;
}): string {
  if (
    canonicalMaterializationRelativePathIssues(
      args.relativePath,
    ).length > 0
  ) {
    throw new Error('directory_path_invalid');
  }
  let current = args.repositoryRealPath;
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
      throw new Error('directory_alias_rejected');
    }
    current = candidate;
  }
  return current;
}

function persistCanonicalArtifact(args: {
  repositoryRealPath: string;
  outputRoot: string;
  category:
    | typeof CANONICAL_PRE_LIVE_READINESS_EVIDENCE_CATEGORY
    | typeof CANONICAL_PRE_LIVE_READINESS_FAILURE_CATEGORY;
  digest: string;
  value: unknown;
}): { path: string; created: boolean } {
  if (!DIGEST_PATTERN.test(args.digest)) {
    throw new Error('artifact_digest_invalid');
  }
  const category = ensureContainedDirectory({
    repositoryRealPath: args.repositoryRealPath,
    relativePath: `${args.outputRoot}/${args.category}`,
  });
  const destinationPath = path.join(
    category,
    `${args.digest}.json`,
  );
  const bytes = canonicalLiveAuthoringJsonBytes(args.value);
  const persistence = writeImmutableLocalArtifact({
    destinationPath,
    bytes,
  });
  const observed = readUniqueFile({
    repositoryRealPath: args.repositoryRealPath,
    relativePath: repoRelativePath(
      args.repositoryRealPath,
      destinationPath,
    ),
  });
  if (!observed.bytes.equals(Buffer.from(bytes, 'utf8'))) {
    throw new Error('artifact_post_write_mismatch');
  }
  return {
    path: repoRelativePath(
      args.repositoryRealPath,
      destinationPath,
    ),
    created: persistence.created,
  };
}

function evidenceIssues(value: unknown): string[] {
  const evidence = recordValue(value);
  if (!evidence) return ['pre_live_evidence_not_object'];
  const issues: string[] = [];
  if (
    !exactKeys(evidence, [
      'version',
      'status',
      'request',
      'dependencyAuthority',
      'repositoryAuthority',
      'canonicalAuthorities',
      'pricingAuthority',
      'canonicalPreflight',
      'credentialAccess',
      'providerCalls',
      'liveAuthority',
      'digestAlgorithm',
      'digest',
    ])
  ) {
    issues.push('pre_live_evidence_fields_invalid');
  }
  if (
    evidence.version !==
      CANONICAL_PRE_LIVE_READINESS_EVIDENCE_VERSION ||
    evidence.status !== 'ready_for_spend_gate' ||
    evidence.pricingAuthority !== 'not_checked' ||
    evidence.canonicalPreflight !== 'not_run' ||
    evidence.credentialAccess !== 'none' ||
    evidence.providerCalls !== 0 ||
    evidence.liveAuthority !== 'none' ||
    evidence.digestAlgorithm !== 'canonical-json-sha256' ||
    typeof evidence.digest !== 'string' ||
    !DIGEST_PATTERN.test(evidence.digest)
  ) {
    issues.push('pre_live_evidence_contract_invalid');
  }
  const request = recordValue(evidence.request);
  if (
    !request ||
    !exactKeys(request, [
      'requestId',
      'requestedAt',
      'storySourceKey',
      'storySourcePath',
      'outputRoot',
      'credentialSourcePathSha256',
      'childRequestIds',
    ])
  ) {
    issues.push('pre_live_evidence_request_invalid');
  } else {
    const requestIds = recordValue(request.childRequestIds);
    if (
      typeof request.requestId !== 'string' ||
      !IDENTIFIER_PATTERN.test(request.requestId) ||
      !isCanonicalTimestamp(request.requestedAt) ||
      typeof request.storySourceKey !== 'string' ||
      !STORY_KEY_PATTERN.test(request.storySourceKey) ||
      canonicalMaterializationRelativePathIssues(
        request.storySourcePath,
      ).length > 0 ||
      canonicalMaterializationRelativePathIssues(
        request.outputRoot,
      ).length > 0 ||
      typeof request.credentialSourcePathSha256 !==
        'string' ||
      !DIGEST_PATTERN.test(
        request.credentialSourcePathSha256,
      ) ||
      !requestIds ||
      !exactKeys(requestIds, ['b0', 'execution']) ||
      typeof requestIds.b0 !== 'string' ||
      typeof requestIds.execution !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(
        requestIds.b0,
      ) ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(
        requestIds.execution,
      )
    ) {
      issues.push('pre_live_evidence_request_invalid');
    }
  }
  const dependency = recordValue(
    evidence.dependencyAuthority,
  );
  const repository = recordValue(
    evidence.repositoryAuthority,
  );
  const authorities = recordValue(
    evidence.canonicalAuthorities,
  );
  if (!dependency) {
    issues.push('pre_live_evidence_dependency_invalid');
  } else {
    const packages = recordValue(dependency.packages);
    if (
      !exactKeys(dependency, [
        'version',
        'nodeVersion',
        'packageJsonSha256',
        'packageLockSha256',
        'npmCliSha256',
        'offlineInstallCompleted',
        'prismaGenerationCompleted',
        'packages',
        'generatedPrismaClientSchemaSha256',
      ]) ||
      dependency.version !==
        CANONICAL_PRE_LIVE_DEPENDENCY_AUTHORITY_VERSION ||
      typeof dependency.nodeVersion !== 'string' ||
      dependency.nodeVersion.length === 0 ||
      ![
        dependency.packageJsonSha256,
        dependency.packageLockSha256,
        dependency.npmCliSha256,
        dependency.generatedPrismaClientSchemaSha256,
      ].every(
        (entry) =>
          typeof entry === 'string' &&
          DIGEST_PATTERN.test(entry),
      ) ||
      dependency.offlineInstallCompleted !== true ||
      dependency.prismaGenerationCompleted !== true ||
      !packages ||
      !exactKeys(packages, [
        'tsx',
        'typescript',
        'prisma',
        'prismaClient',
      ])
    ) {
      issues.push('pre_live_evidence_dependency_invalid');
    } else {
      for (const packageName of [
        'tsx',
        'typescript',
        'prisma',
        'prismaClient',
      ]) {
        const packageAuthority = recordValue(
          packages[packageName],
        );
        if (
          !packageAuthority ||
          !exactKeys(packageAuthority, [
            'version',
            'packageJsonSha256',
            'authorityFileSha256',
          ]) ||
          typeof packageAuthority.version !== 'string' ||
          packageAuthority.version.length === 0 ||
          typeof packageAuthority.packageJsonSha256 !==
            'string' ||
          !DIGEST_PATTERN.test(
            packageAuthority.packageJsonSha256,
          ) ||
          typeof packageAuthority.authorityFileSha256 !==
            'string' ||
          !DIGEST_PATTERN.test(
            packageAuthority.authorityFileSha256,
          )
        ) {
          issues.push(
            'pre_live_evidence_dependency_invalid',
          );
        }
      }
    }
  }
  if (!repository) {
    issues.push('pre_live_evidence_repository_invalid');
  } else if (
    !exactKeys(repository, [
      'repositoryRealPath',
      'branchRef',
      'head',
      'upstreamRef',
      'upstreamHead',
      'ahead',
      'behind',
    ]) ||
    typeof repository.repositoryRealPath !== 'string' ||
    !path.isAbsolute(repository.repositoryRealPath) ||
    typeof repository.branchRef !== 'string' ||
    !repository.branchRef.startsWith('refs/heads/') ||
    typeof repository.upstreamRef !== 'string' ||
    !repository.upstreamRef.startsWith(
      'refs/remotes/origin/',
    ) ||
    typeof repository.head !== 'string' ||
    !COMMIT_PATTERN.test(repository.head) ||
    typeof repository.upstreamHead !== 'string' ||
    !COMMIT_PATTERN.test(repository.upstreamHead) ||
    repository.ahead !== 0 ||
    repository.behind !== 0
  ) {
    issues.push('pre_live_evidence_repository_invalid');
  }
  if (!authorities) {
    issues.push('pre_live_evidence_authorities_invalid');
  } else {
    const inputs = recordValue(
      authorities.materializationInputs,
    );
    const b0 = recordValue(authorities.b0);
    const executionRequest = recordValue(
      authorities.executionRequest,
    );
    const supervisor = recordValue(
      authorities.supervisorVerification,
    );
    const validDescriptor = (candidate: unknown): boolean => {
      const descriptor = recordValue(candidate);
      return Boolean(
        descriptor &&
          exactKeys(descriptor, ['path', 'digest']) &&
          typeof descriptor.path === 'string' &&
          canonicalMaterializationRelativePathIssues(
            descriptor.path,
          ).length === 0 &&
          typeof descriptor.digest === 'string' &&
          DIGEST_PATTERN.test(descriptor.digest),
      );
    };
    if (
      !exactKeys(authorities, [
        'materializationInputs',
        'b0',
        'executionRequest',
        'supervisorVerification',
      ]) ||
      !inputs ||
      !exactKeys(inputs, ['source', 'execution']) ||
      !validDescriptor(inputs.source) ||
      !validDescriptor(inputs.execution) ||
      !b0 ||
      !exactKeys(b0, [
        'manifestPath',
        'manifestDigest',
        'verificationVersion',
        'sourceAuthorityRequestDigest',
        'sourceSnapshotDigest',
        'normalizedSourceDigest',
        'liveAuthoringRequestDigest',
        'structuredOutputCompatibility',
        'compactRepairStructuredOutputCompatibility',
        'pageContractRepairStructuredOutputCompatibility',
        'representedElsewhereRepairStructuredOutputCompatibility',
        'pageSpatialReferenceRepairStructuredOutputCompatibility',
        'structuralBundleRepairStructuredOutputCompatibility',
        'bookSurfaceRepairStructuredOutputCompatibility',
        'presentationRequirementRepairStructuredOutputCompatibility',
        'stablePropScopeRepairStructuredOutputCompatibility',
        'requestPolicy',
      ]) ||
      typeof b0.manifestPath !== 'string' ||
      canonicalMaterializationRelativePathIssues(
        b0.manifestPath,
      ).length > 0 ||
      b0.verificationVersion !==
        CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION ||
      ![
        b0.manifestDigest,
        b0.sourceAuthorityRequestDigest,
        b0.sourceSnapshotDigest,
        b0.normalizedSourceDigest,
        b0.liveAuthoringRequestDigest,
      ].every(
        (entry) =>
          typeof entry === 'string' &&
          DIGEST_PATTERN.test(entry),
      ) ||
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.structuredOutputCompatibility,
        'pre_live_evidence_b0_structured_output_compatibility',
      ).length > 0 ||
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.compactRepairStructuredOutputCompatibility,
        'pre_live_evidence_b0_compact_repair_structured_output_compatibility',
      ).length > 0 ||
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.pageContractRepairStructuredOutputCompatibility,
        'pre_live_evidence_b0_page_contract_repair_structured_output_compatibility',
      ).length > 0 ||
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.representedElsewhereRepairStructuredOutputCompatibility,
        'pre_live_evidence_b0_represented_elsewhere_repair_structured_output_compatibility',
      ).length > 0 ||
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.pageSpatialReferenceRepairStructuredOutputCompatibility,
        'pre_live_evidence_b0_page_spatial_reference_repair_structured_output_compatibility',
      ).length > 0 ||
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.structuralBundleRepairStructuredOutputCompatibility,
        'pre_live_evidence_b0_structural_bundle_repair_structured_output_compatibility',
      ).length > 0 ||
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.bookSurfaceRepairStructuredOutputCompatibility,
        'pre_live_evidence_b0_book_surface_repair_structured_output_compatibility',
      ).length > 0 ||
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.presentationRequirementRepairStructuredOutputCompatibility,
        'pre_live_evidence_b0_presentation_requirement_repair_structured_output_compatibility',
      ).length > 0 ||
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.stablePropScopeRepairStructuredOutputCompatibility,
        'pre_live_evidence_b0_stable_prop_scope_repair_structured_output_compatibility',
      ).length > 0 ||
      liveRequestPolicyAuthorityIssues(
        b0.requestPolicy,
        'pre_live_evidence_b0_request_policy',
      ).length > 0 ||
      !validDescriptor(executionRequest) ||
      !supervisor ||
      !exactKeys(supervisor, [
        'version',
        'readinessDigest',
      ]) ||
      supervisor.version !==
        CANONICAL_LIVE_EXECUTION_READINESS_VERSION ||
      typeof supervisor.readinessDigest !== 'string' ||
      !DIGEST_PATTERN.test(supervisor.readinessDigest)
    ) {
      issues.push('pre_live_evidence_authorities_invalid');
    }
  }
  if (
    typeof evidence.digest === 'string' &&
    DIGEST_PATTERN.test(evidence.digest)
  ) {
    const {
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...withoutDigest
    } = evidence;
    try {
      if (
        canonicalJsonDigest(withoutDigest) !== evidence.digest
      ) {
        issues.push('pre_live_evidence_digest_invalid');
      }
    } catch {
      issues.push('pre_live_evidence_digest_invalid');
    }
  }
  return [...new Set(issues)].sort();
}

export function assertValidCanonicalPreLiveReadinessEvidence(
  value: unknown,
): asserts value is CanonicalPreLiveReadinessEvidence {
  const issues = evidenceIssues(value);
  if (issues.length > 0) {
    throw new CanonicalPreLiveReadinessError(
      'evidence',
      'pre_live_evidence_rejected',
      issues,
    );
  }
}

function readCanonicalEvidenceFile(args: {
  repositoryRealPath: string;
  relativePath: string;
}): CanonicalPreLiveReadinessEvidence {
  let source: ReturnType<typeof readUniqueFile>;
  try {
    source = readUniqueFile(args);
  } catch {
    throw new CanonicalPreLiveReadinessError(
      'evidence',
      'pre_live_evidence_filesystem_rejected',
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(
      source.bytes.toString('utf8'),
    ) as unknown;
    if (
      !source.bytes.equals(
        Buffer.from(
          canonicalLiveAuthoringJsonBytes(value),
          'utf8',
        ),
      )
    ) {
      throw new Error('bytes_noncanonical');
    }
    assertValidCanonicalPreLiveReadinessEvidence(value);
  } catch (error) {
    if (error instanceof CanonicalPreLiveReadinessError) {
      throw error;
    }
    throw new CanonicalPreLiveReadinessError(
      'evidence',
      'pre_live_evidence_rejected',
    );
  }
  if (
    path.posix.basename(args.relativePath) !==
    `${value.digest}.json`
  ) {
    throw new CanonicalPreLiveReadinessError(
      'evidence',
      'pre_live_evidence_content_address_rejected',
    );
  }
  return value;
}

function evidenceMatchesInput(args: {
  evidence: CanonicalPreLiveReadinessEvidence;
  input: CanonicalPreLiveReadinessInput;
}): boolean {
  const ids = childRequestIds(args.input);
  return (
    args.evidence.request.requestId === args.input.requestId &&
    args.evidence.request.requestedAt ===
      args.input.requestedAt &&
    args.evidence.request.storySourceKey ===
      args.input.storySourceKey &&
    args.evidence.request.storySourcePath ===
      args.input.storySourcePath &&
    args.evidence.request.outputRoot ===
      args.input.outputRoot &&
    args.evidence.request.credentialSourcePathSha256 ===
      sha256(args.input.credentialSourcePath) &&
    args.evidence.request.childRequestIds.b0 === ids.b0 &&
    args.evidence.request.childRequestIds.execution ===
      ids.execution
  );
}

function findEvidence(args: {
  repositoryRealPath: string;
  input: CanonicalPreLiveReadinessInput;
}): CanonicalPreLiveReadinessEvidence {
  const relativeDirectory =
    `${args.input.outputRoot}/${CANONICAL_PRE_LIVE_READINESS_EVIDENCE_CATEGORY}`;
  const directory = path.resolve(
    args.repositoryRealPath,
    relativeDirectory,
  );
  let names: string[];
  try {
    const real = fs.realpathSync(directory);
    const lstat = fs.lstatSync(directory);
    if (
      !pathsEqual(directory, real) ||
      lstat.isSymbolicLink() ||
      !lstat.isDirectory()
    ) {
      throw new Error('evidence_directory_alias');
    }
    names = fs.readdirSync(directory).sort();
  } catch {
    throw new CanonicalPreLiveReadinessError(
      'evidence',
      'pre_live_evidence_missing',
    );
  }
  if (
    names.length === 0 ||
    names.length > MAX_EVIDENCE_FILES ||
    names.some(
      (name) => !/^[a-f0-9]{64}\.json$/.test(name),
    )
  ) {
    throw new CanonicalPreLiveReadinessError(
      'evidence',
      'pre_live_evidence_directory_rejected',
    );
  }
  const matches: CanonicalPreLiveReadinessEvidence[] = [];
  for (const name of names) {
    const evidence = readCanonicalEvidenceFile({
      repositoryRealPath: args.repositoryRealPath,
      relativePath: `${relativeDirectory}/${name}`,
    });
    if (evidenceMatchesInput({ evidence, input: args.input })) {
      matches.push(evidence);
    }
  }
  if (matches.length !== 1) {
    throw new CanonicalPreLiveReadinessError(
      'evidence',
      matches.length === 0
        ? 'pre_live_evidence_missing'
        : 'pre_live_evidence_ambiguous',
    );
  }
  return matches[0]!;
}

function readManifest(args: {
  repositoryRealPath: string;
  manifestPath: string;
}): LiveRequestMaterializationManifest {
  let source: ReturnType<typeof readUniqueFile>;
  try {
    source = readUniqueFile({
      repositoryRealPath: args.repositoryRealPath,
      relativePath: args.manifestPath,
    });
    const value = JSON.parse(
      source.bytes.toString('utf8'),
    ) as unknown;
    if (
      !source.bytes.equals(
        Buffer.from(
          canonicalLiveAuthoringJsonBytes(value),
          'utf8',
        ),
      )
    ) {
      throw new Error('manifest_bytes_noncanonical');
    }
    assertValidLiveRequestMaterializationManifest(value);
    return value;
  } catch {
    throw new CanonicalPreLiveReadinessError(
      'b0_verification',
      'pre_live_b0_manifest_rejected',
    );
  }
}

function preservationPaths(args: {
  sourceInputPath: string;
  manifestPath: string;
  manifest: LiveRequestMaterializationManifest;
}): string[] {
  return [
    args.sourceInputPath,
    args.manifestPath,
    args.manifest.artifacts.sourceAuthorityRequest.path,
    args.manifest.artifacts.sourceSnapshot.path,
    args.manifest.artifacts.liveAuthoringRequest.path,
  ]
    .sort();
}

function expectedSourcePayload(args: {
  repositoryRealPath: string;
  input: CanonicalPreLiveReadinessInput;
}): LiveRequestMaterializationInput {
  return {
    version: LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
    repoRoot: args.repositoryRealPath,
    storyKey: args.input.storySourceKey,
    storyPath: args.input.storySourcePath,
    requestId: childRequestIds(args.input).b0,
    requestedAt: args.input.requestedAt,
  };
}

function exactCanonicalValue(
  actual: unknown,
  expected: unknown,
  phase: CanonicalPreLiveReadinessPhase,
  reasonCode: string,
): void {
  try {
    if (
      canonicalLiveAuthoringJsonBytes(actual) !==
      canonicalLiveAuthoringJsonBytes(expected)
    ) {
      throw new Error('canonical_value_mismatch');
    }
  } catch {
    throw new CanonicalPreLiveReadinessError(
      phase,
      reasonCode,
    );
  }
}

function readSourceInput(args: {
  repositoryRealPath: string;
  inputPath: string;
  input: CanonicalPreLiveReadinessInput;
}): void {
  try {
    const envelope =
      readCanonicalMaterializationInputArtifact({
        repoRoot: args.repositoryRealPath,
        inputPath: args.inputPath,
        expectedKind: 'source-authoring-live-request',
        expectedPayloadSchemaVersion:
          LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
        validatePayload:
          assertValidLiveRequestMaterializationInput,
      });
    exactCanonicalValue(
      envelope.payload,
      expectedSourcePayload(args),
      'source_input',
      'pre_live_source_input_drift',
    );
  } catch (error) {
    if (error instanceof CanonicalPreLiveReadinessError) {
      throw error;
    }
    throw new CanonicalPreLiveReadinessError(
      'source_input',
      error instanceof CanonicalMaterializationInputReadError
        ? error.reasonCode
        : 'pre_live_source_input_rejected',
    );
  }
}

function expectedExecutionPayload(args: {
  input: CanonicalPreLiveReadinessInput;
  manifestPath: string;
  derivedPreservationPaths: string[];
  derivedLayout: CanonicalPreLiveLayout;
}): CanonicalLiveExecutionRequestMaterializationInput {
  return {
    version:
      CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION,
    requestId: childRequestIds(args.input).execution,
    requestedAt: args.input.requestedAt,
    manifestPath: args.manifestPath,
    outputDir: args.derivedLayout.executionRoot,
    preservationPaths:
      args.derivedPreservationPaths.slice().sort(),
    expectedAbsentPaths:
      args.derivedLayout.expectedAbsentPaths.slice(),
    credentialSourcePath:
      args.input.credentialSourcePath,
  };
}

function readExecutionInput(args: {
  repositoryRealPath: string;
  inputPath: string;
  expected: CanonicalLiveExecutionRequestMaterializationInput;
}): void {
  try {
    const envelope =
      readCanonicalMaterializationInputArtifact({
        repoRoot: args.repositoryRealPath,
        inputPath: args.inputPath,
        expectedKind:
          'canonical-live-execution-request',
        expectedPayloadSchemaVersion:
          CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION,
        validatePayload: (value: unknown): asserts value is CanonicalLiveExecutionRequestMaterializationInput => {
          assertValidCanonicalLiveExecutionRequestMaterializationInput(
            value,
          );
          exactCanonicalValue(
            value,
            args.expected,
            'execution_input',
            'pre_live_execution_input_drift',
          );
        },
      });
    exactCanonicalValue(
      envelope.payload,
      args.expected,
      'execution_input',
      'pre_live_execution_input_drift',
    );
  } catch (error) {
    if (error instanceof CanonicalPreLiveReadinessError) {
      throw error;
    }
    throw new CanonicalPreLiveReadinessError(
      'execution_input',
      error instanceof CanonicalMaterializationInputReadError
        ? error.reasonCode
        : 'pre_live_execution_input_rejected',
    );
  }
}

function verifyB0Authority(args: {
  repositoryRealPath: string;
  manifestPath: string;
  dependencies: CanonicalPreLiveReadinessDependencies;
}): CanonicalLiveRequestVerifiedResult {
  const result = args.dependencies.verifyB0({
    repoRoot: args.repositoryRealPath,
    manifestPath: args.manifestPath,
  });
  if (
    result.version !==
      CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION ||
    result.status !== 'verified'
  ) {
    throw new CanonicalPreLiveReadinessError(
      'b0_verification',
      'pre_live_b0_verification_rejected',
      result.status === 'verified' ? [] : result.reasonCodes,
    );
  }
  return result;
}

function verifySupervisorAuthority(args: {
  repositoryRealPath: string;
  requestPath: string;
  dependencies: CanonicalPreLiveReadinessDependencies;
}): CanonicalLiveExecutionReadiness {
  const readiness = args.dependencies.verifyExecution({
    repoRoot: args.repositoryRealPath,
    requestPath: args.requestPath,
  });
  if (
    readiness.version !==
      CANONICAL_LIVE_EXECUTION_READINESS_VERSION ||
    readiness.status !== 'ready'
  ) {
    throw new CanonicalPreLiveReadinessError(
      'supervisor_verification',
      'pre_live_supervisor_verification_rejected',
      readiness.status === 'ready' ? [] : readiness.reasonCodes,
    );
  }
  return readiness;
}

function evidenceValue(args: {
  input: CanonicalPreLiveReadinessInput;
  dependencies: CanonicalPreLiveDependencyAuthority;
  repository: CanonicalPreLiveRepositoryAuthority;
  sourceInput: {
    path: string;
    digest: string;
  };
  executionInput: {
    path: string;
    digest: string;
  };
  b0: CanonicalLiveRequestVerifiedResult;
  manifestPath: string;
  executionRequest: {
    path: string;
    digest: string;
  };
  supervisor: CanonicalLiveExecutionReadiness;
}): CanonicalPreLiveReadinessEvidence {
  const ids = childRequestIds(args.input);
  return buildEvidence({
    version: CANONICAL_PRE_LIVE_READINESS_EVIDENCE_VERSION,
    status: 'ready_for_spend_gate',
    request: {
      requestId: args.input.requestId,
      requestedAt: args.input.requestedAt,
      storySourceKey: args.input.storySourceKey,
      storySourcePath: args.input.storySourcePath,
      outputRoot: args.input.outputRoot,
      credentialSourcePathSha256: sha256(
        args.input.credentialSourcePath,
      ),
      childRequestIds: ids,
    },
    dependencyAuthority: args.dependencies,
    repositoryAuthority: args.repository,
    canonicalAuthorities: {
      materializationInputs: {
        source: args.sourceInput,
        execution: args.executionInput,
      },
      b0: {
        manifestPath: args.manifestPath,
        manifestDigest:
          args.b0.identities.manifestDigest,
        verificationVersion: args.b0.version,
        sourceAuthorityRequestDigest:
          args.b0.identities
            .sourceAuthorityRequestDigest,
        sourceSnapshotDigest:
          args.b0.identities.sourceSnapshotDigest,
        normalizedSourceDigest:
          args.b0.identities.normalizedSourceDigest,
        liveAuthoringRequestDigest:
          args.b0.identities
            .liveAuthoringRequestDigest,
        structuredOutputCompatibility:
          args.b0.structuredOutputCompatibility,
        compactRepairStructuredOutputCompatibility:
          args.b0.compactRepairStructuredOutputCompatibility,
        pageContractRepairStructuredOutputCompatibility:
          args.b0.pageContractRepairStructuredOutputCompatibility,
        representedElsewhereRepairStructuredOutputCompatibility:
          args.b0.representedElsewhereRepairStructuredOutputCompatibility,
        pageSpatialReferenceRepairStructuredOutputCompatibility:
          args.b0.pageSpatialReferenceRepairStructuredOutputCompatibility,
        structuralBundleRepairStructuredOutputCompatibility:
          args.b0.structuralBundleRepairStructuredOutputCompatibility,
        bookSurfaceRepairStructuredOutputCompatibility:
          args.b0.bookSurfaceRepairStructuredOutputCompatibility,
        presentationRequirementRepairStructuredOutputCompatibility:
          args.b0.presentationRequirementRepairStructuredOutputCompatibility,
        stablePropScopeRepairStructuredOutputCompatibility:
          args.b0.stablePropScopeRepairStructuredOutputCompatibility,
        requestPolicy: args.b0.requestPolicy,
      },
      executionRequest: args.executionRequest,
      supervisorVerification: {
        version: args.supervisor.version,
        readinessDigest: args.supervisor.digest,
      },
    },
    pricingAuthority: 'not_checked',
    canonicalPreflight: 'not_run',
    credentialAccess: 'none',
    providerCalls: 0,
    liveAuthority: 'none',
  });
}

function prepareUnsafe(args: {
  input: CanonicalPreLiveReadinessInput;
  launchAuthority: CanonicalPreLiveReadinessLaunchAuthority;
  dependencies: CanonicalPreLiveReadinessDependencies;
}): CanonicalPreLiveReadinessEvidence {
  assertValidCanonicalPreLiveReadinessInput(args.input);
  let repositoryRealPath: string;
  try {
    repositoryRealPath =
      canonicalMaterializationRepositoryRealPath(
        args.input.repoRoot,
      );
  } catch {
    throw new CanonicalPreLiveReadinessError(
      'input',
      'pre_live_repo_root_rejected',
    );
  }
  const dependencyAuthority =
    args.dependencies.inspectDependencies({
      repositoryRealPath,
      launchAuthority: args.launchAuthority,
    });
  const repositoryAuthority = verifyDedicatedTopology({
    repositoryRealPath,
    outputRoot: args.input.outputRoot,
    dependencies: args.dependencies,
  });
  const derivedLayout = layout(args.input);
  const ids = childRequestIds(args.input);

  let sourceWrite: CanonicalMaterializationInputWriteSuccess;
  try {
    sourceWrite =
      args.dependencies.writeMaterializationInput({
        mode: 'source-authoring-live-request',
        repoRoot: repositoryRealPath,
        outputDir: derivedLayout.inputRoot,
        storyKey: args.input.storySourceKey,
        storyPath: args.input.storySourcePath,
        requestId: ids.b0,
        requestedAt: args.input.requestedAt,
      });
  } catch (error) {
    const rejection =
      canonicalMaterializationInputWriteRejection(error);
    throw new CanonicalPreLiveReadinessError(
      'source_input',
      'pre_live_source_input_write_rejected',
      rejection.reasonCodes,
    );
  }

  let b0Materialization: LiveRequestMaterializationResult;
  try {
    b0Materialization = args.dependencies.materializeB0({
      repoRoot: repositoryRealPath,
      requestPath: sourceWrite.artifact.path,
      outputDir: derivedLayout.b0Root,
    });
  } catch {
    throw new CanonicalPreLiveReadinessError(
      'b0_materialization',
      'pre_live_b0_materialization_rejected',
    );
  }
  const b0 = verifyB0Authority({
    repositoryRealPath,
    manifestPath:
      b0Materialization.persistence.manifest.path,
    dependencies: args.dependencies,
  });
  const manifest = readManifest({
    repositoryRealPath,
    manifestPath:
      b0Materialization.persistence.manifest.path,
  });
  const derivedPreservationPaths = preservationPaths({
    sourceInputPath: sourceWrite.artifact.path,
    manifestPath:
      b0Materialization.persistence.manifest.path,
    manifest,
  });

  let executionWrite: CanonicalMaterializationInputWriteSuccess;
  try {
    executionWrite =
      args.dependencies.writeMaterializationInput({
        mode: 'canonical-live-execution-request',
        repoRoot: repositoryRealPath,
        outputDir: derivedLayout.inputRoot,
        requestId: ids.execution,
        requestedAt: args.input.requestedAt,
        manifestPath:
          b0Materialization.persistence.manifest.path,
        materializationOutputDir:
          derivedLayout.executionRoot,
        preservationPaths: derivedPreservationPaths,
        expectedAbsentPaths:
          derivedLayout.expectedAbsentPaths,
        credentialSourcePath:
          args.input.credentialSourcePath,
      });
  } catch (error) {
    const rejection =
      canonicalMaterializationInputWriteRejection(error);
    throw new CanonicalPreLiveReadinessError(
      'execution_input',
      'pre_live_execution_input_write_rejected',
      rejection.reasonCodes,
    );
  }

  let executionMaterialization:
    CanonicalLiveExecutionRequestMaterializationSuccess;
  try {
    executionMaterialization =
      args.dependencies.materializeExecutionRequest({
        repoRoot: repositoryRealPath,
        inputPath: executionWrite.artifact.path,
      });
  } catch (error) {
    const rejection =
      canonicalLiveExecutionRequestMaterializationRejection(
        error,
      );
    throw new CanonicalPreLiveReadinessError(
      'execution_materialization',
      'pre_live_execution_materialization_rejected',
      rejection.reasonCodes,
    );
  }
  const supervisor = verifySupervisorAuthority({
    repositoryRealPath,
    requestPath:
      executionMaterialization.request.path,
    dependencies: args.dependencies,
  });
  const evidence = evidenceValue({
    input: args.input,
    dependencies: dependencyAuthority,
    repository: repositoryAuthority,
    sourceInput: {
      path: sourceWrite.artifact.path,
      digest: sourceWrite.artifact.digest,
    },
    executionInput: {
      path: executionWrite.artifact.path,
      digest: executionWrite.artifact.digest,
    },
    b0,
    manifestPath:
      b0Materialization.persistence.manifest.path,
    executionRequest: {
      path: executionMaterialization.request.path,
      digest: executionMaterialization.request.digest,
    },
    supervisor,
  });
  assertValidCanonicalPreLiveReadinessEvidence(evidence);
  try {
    persistCanonicalArtifact({
      repositoryRealPath,
      outputRoot: args.input.outputRoot,
      category:
        CANONICAL_PRE_LIVE_READINESS_EVIDENCE_CATEGORY,
      digest: evidence.digest,
      value: evidence,
    });
  } catch {
    throw new CanonicalPreLiveReadinessError(
      'evidence',
      'pre_live_evidence_persistence_rejected',
    );
  }
  return readCanonicalEvidenceFile({
    repositoryRealPath,
    relativePath:
      `${args.input.outputRoot}/${CANONICAL_PRE_LIVE_READINESS_EVIDENCE_CATEGORY}/${evidence.digest}.json`,
  });
}

function verifyUnsafe(args: {
  input: CanonicalPreLiveReadinessInput;
  launchAuthority: CanonicalPreLiveReadinessLaunchAuthority;
  dependencies: CanonicalPreLiveReadinessDependencies;
}): CanonicalPreLiveReadinessEvidence {
  assertValidCanonicalPreLiveReadinessInput(args.input);
  let repositoryRealPath: string;
  try {
    repositoryRealPath =
      canonicalMaterializationRepositoryRealPath(
        args.input.repoRoot,
      );
  } catch {
    throw new CanonicalPreLiveReadinessError(
      'input',
      'pre_live_repo_root_rejected',
    );
  }
  const dependencyAuthority =
    args.dependencies.inspectDependencies({
      repositoryRealPath,
      launchAuthority: args.launchAuthority,
    });
  const repositoryAuthority = verifyDedicatedTopology({
    repositoryRealPath,
    outputRoot: args.input.outputRoot,
    dependencies: args.dependencies,
  });
  const evidence = findEvidence({
    repositoryRealPath,
    input: args.input,
  });
  exactCanonicalValue(
    evidence.dependencyAuthority,
    dependencyAuthority,
    'dependency',
    'pre_live_dependency_drift',
  );
  exactCanonicalValue(
    evidence.repositoryAuthority,
    repositoryAuthority,
    'topology',
    'pre_live_topology_drift',
  );
  readSourceInput({
    repositoryRealPath,
    inputPath:
      evidence.canonicalAuthorities.materializationInputs
        .source.path,
    input: args.input,
  });
  const sourceInputDigest =
    path.posix.basename(
      evidence.canonicalAuthorities.materializationInputs
        .source.path,
      '.json',
    );
  if (
    sourceInputDigest !==
    evidence.canonicalAuthorities.materializationInputs
      .source.digest
  ) {
    throw new CanonicalPreLiveReadinessError(
      'source_input',
      'pre_live_source_input_content_address_rejected',
    );
  }
  const b0 = verifyB0Authority({
    repositoryRealPath,
    manifestPath:
      evidence.canonicalAuthorities.b0.manifestPath,
    dependencies: args.dependencies,
  });
  const manifest = readManifest({
    repositoryRealPath,
    manifestPath:
      evidence.canonicalAuthorities.b0.manifestPath,
  });
  const derivedLayout = layout(args.input);
  const derivedPreservationPaths = preservationPaths({
    sourceInputPath:
      evidence.canonicalAuthorities.materializationInputs
        .source.path,
    manifestPath:
      evidence.canonicalAuthorities.b0.manifestPath,
    manifest,
  });
  const expectedExecution = expectedExecutionPayload({
    input: args.input,
    manifestPath:
      evidence.canonicalAuthorities.b0.manifestPath,
    derivedPreservationPaths,
    derivedLayout,
  });
  readExecutionInput({
    repositoryRealPath,
    inputPath:
      evidence.canonicalAuthorities.materializationInputs
        .execution.path,
    expected: expectedExecution,
  });
  const executionInputDigest =
    path.posix.basename(
      evidence.canonicalAuthorities.materializationInputs
        .execution.path,
      '.json',
    );
  if (
    executionInputDigest !==
    evidence.canonicalAuthorities.materializationInputs
      .execution.digest
  ) {
    throw new CanonicalPreLiveReadinessError(
      'execution_input',
      'pre_live_execution_input_content_address_rejected',
    );
  }
  const supervisor = verifySupervisorAuthority({
    repositoryRealPath,
    requestPath:
      evidence.canonicalAuthorities.executionRequest.path,
    dependencies: args.dependencies,
  });
  if (
    supervisor.requestDigest !==
    evidence.canonicalAuthorities.executionRequest.digest
  ) {
    throw new CanonicalPreLiveReadinessError(
      'supervisor_verification',
      'pre_live_execution_request_drift',
    );
  }
  const expected = evidenceValue({
    input: args.input,
    dependencies: dependencyAuthority,
    repository: repositoryAuthority,
    sourceInput:
      evidence.canonicalAuthorities.materializationInputs
        .source,
    executionInput:
      evidence.canonicalAuthorities.materializationInputs
        .execution,
    b0,
    manifestPath:
      evidence.canonicalAuthorities.b0.manifestPath,
    executionRequest:
      evidence.canonicalAuthorities.executionRequest,
    supervisor,
  });
  exactCanonicalValue(
    evidence,
    expected,
    'evidence',
    'pre_live_evidence_drift',
  );
  return evidence;
}

function caughtFailure(args: {
  mode: CanonicalPreLiveReadinessMode;
  input: Partial<CanonicalPreLiveReadinessInput>;
  error: unknown;
}): CanonicalPreLiveReadinessFailure {
  if (args.error instanceof CanonicalPreLiveReadinessError) {
    return buildCanonicalPreLiveReadinessFailure({
      mode: args.mode,
      phase: args.error.phase,
      reasonCodes: [args.error.reasonCode],
      authorityReasonCodes:
        args.error.authorityReasonCodes,
      gitDiagnostic: args.error.gitDiagnostic,
      input: args.input,
    });
  }
  return buildCanonicalPreLiveReadinessFailure({
    mode: args.mode,
    phase: 'evidence',
    reasonCodes: ['pre_live_readiness_failed'],
    input: args.input,
  });
}

export function prepareCanonicalPreLiveReadiness(args: {
  input: CanonicalPreLiveReadinessInput;
  launchAuthority: CanonicalPreLiveReadinessLaunchAuthority;
  dependencies?: Partial<CanonicalPreLiveReadinessDependencies>;
}): CanonicalPreLiveReadinessResult {
  const dependencies = resolvedDependencies(args.dependencies);
  try {
    return prepareUnsafe({
      input: args.input,
      launchAuthority: args.launchAuthority,
      dependencies,
    });
  } catch (error) {
    const failure = caughtFailure({
      mode: 'prepare',
      input: args.input,
      error,
    });
    if (
      error instanceof CanonicalPreLiveReadinessError &&
      !['launcher', 'input', 'dependency', 'topology'].includes(
        error.phase,
      )
    ) {
      try {
        const repositoryRealPath =
          canonicalMaterializationRepositoryRealPath(
            args.input.repoRoot,
          );
        persistCanonicalArtifact({
          repositoryRealPath,
          outputRoot: args.input.outputRoot,
          category:
            CANONICAL_PRE_LIVE_READINESS_FAILURE_CATEGORY,
          digest: failure.digest,
          value: failure,
        });
      } catch {
        // The sanitized in-memory failure remains authoritative for this call.
      }
    }
    return failure;
  }
}

export function verifyCanonicalPreLiveReadiness(args: {
  input: CanonicalPreLiveReadinessInput;
  launchAuthority: CanonicalPreLiveReadinessLaunchAuthority;
  dependencies?: Partial<CanonicalPreLiveReadinessDependencies>;
}): CanonicalPreLiveReadinessResult {
  const dependencies = resolvedDependencies(args.dependencies);
  try {
    return verifyUnsafe({
      input: args.input,
      launchAuthority: args.launchAuthority,
      dependencies,
    });
  } catch (error) {
    return caughtFailure({
      mode: 'verify',
      input: args.input,
      error,
    });
  }
}

export function canonicalPreLiveReadinessArtifactPath(args: {
  outputRoot: string;
  result: CanonicalPreLiveReadinessResult;
}): string {
  return path.posix.join(
    args.outputRoot,
    args.result.version ===
      CANONICAL_PRE_LIVE_READINESS_EVIDENCE_VERSION
      ? CANONICAL_PRE_LIVE_READINESS_EVIDENCE_CATEGORY
      : CANONICAL_PRE_LIVE_READINESS_FAILURE_CATEGORY,
    `${args.result.digest}.json`,
  );
}

export const CANONICAL_PRE_LIVE_READINESS_PRIVATE_TESTING = {
  EXPECTED_ABSENCE_CATEGORIES,
  DEPENDENCY_FILES,
  layout,
  childRequestIds,
  verifyDedicatedTopology,
};
