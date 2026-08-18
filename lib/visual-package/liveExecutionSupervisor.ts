import crypto from 'node:crypto';
import {
  spawn,
  spawnSync,
  type SpawnOptions,
} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';

import {
  canonicalLiveAuthoringJsonBytes,
} from './canonicalLiveAuthoringArtifacts';
import {
  canonicalJsonDigest,
  repoRelativePath,
} from './integrity';
import {
  CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
  assertValidLiveRequestMaterializationManifest,
  liveRequestPolicyAuthorityIssues,
  liveRequestStructuredOutputCompatibilityAuthorityIssues,
  verifyCanonicalLiveRequestBundle,
  type CanonicalLiveRequestVerificationResult,
  type CanonicalLiveRequestPolicyAuthority,
  type LiveRequestMaterializationManifest,
  type LiveRequestStructuredOutputCompatibilityAuthority,
} from './liveRequestMaterialization';
import {
  VISUAL_CONTRACT_AUTHORING_READINESS_VERSION,
  VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION,
  VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION,
  VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION,
  buildVisualContractCandidateArtifact,
  persistVisualContractAuthoringReadiness,
  persistVisualContractAuthoringReceipt,
  type VisualContractAuthoringRequest,
  type VisualContractAuthoringReadinessEvidence,
  type VisualContractAuthoringReceipt,
  type VisualContractCandidateArtifact,
} from './visualContractAuthoringLifecycle';

export const CANONICAL_LIVE_EXECUTION_REQUEST_VERSION =
  'canonical-live-execution-request/v33' as const;
export const CANONICAL_LIVE_EXECUTION_READINESS_VERSION =
  'canonical-live-execution-readiness/v33' as const;
export const CANONICAL_LIVE_EXECUTION_PROBE_VERSION =
  'canonical-live-execution-probe/v1' as const;
export const CANONICAL_LIVE_EXECUTION_RESULT_VERSION =
  'canonical-live-execution-result/v26' as const;
export const CANONICAL_LIVE_EXECUTION_CHILD_OUTPUT_AUTHORITY_VERSION =
  'canonical-live-execution-child-output-authority/v1' as const;

export const CANONICAL_LIVE_EXECUTION_EXPECTED_ABSENCE_CATEGORIES = [
  'authoring-receipts',
  'contract-candidates',
  'provider-call-failure-evidence',
  'readiness-evidence',
  'rejected-authoring-requests',
] as const;

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const IDENTIFIER_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const REASON_CODE_PATTERN = /^[a-z0-9_:-]{1,128}$/;
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const GIT_REF_PATTERN =
  /^refs\/(?:heads|remotes)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$/;
const MAX_GIT_OUTPUT_BYTES = 64 * 1024;
const MAX_CHILD_OUTPUT_BYTES = 64 * 1024;
const MAX_PRESERVATION_FILE_BYTES = 64 * 1024 * 1024;
const MAX_CREDENTIAL_SOURCE_BYTES = 64 * 1024;
const MAX_COLLECTION_ITEMS = 64;

export interface CanonicalLiveExecutionGitRef {
  name: string;
  expectedCommit: string;
}

export interface CanonicalLiveExecutionGitDivergence {
  localRef: string;
  upstreamRef: string;
  expectedAhead: number;
  expectedBehind: number;
}

export interface CanonicalLiveExecutionPreservationFence {
  path: string;
  byteLength: number;
  sha256: string;
}

export interface CanonicalLiveExecutionCommand {
  executable: 'node';
  arguments: string[];
  identitySha256: string;
}

export interface CanonicalLiveExecutionRequest {
  version: typeof CANONICAL_LIVE_EXECUTION_REQUEST_VERSION;
  requestId: string;
  requestedAt: string;
  repository: {
    realPath: string;
    expectedBranch: string;
    expectedHead: string;
    expectedTrackedChanges: 0;
    expectedUntrackedChanges: 0;
    refs: CanonicalLiveExecutionGitRef[];
    divergence: CanonicalLiveExecutionGitDivergence[];
  };
  canonicalBundle: {
    manifestPath: string;
    manifestDigest: string;
    verificationVersion:
      typeof CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION;
    structuredOutputCompatibility:
      LiveRequestStructuredOutputCompatibilityAuthority;
    compactRepairStructuredOutputCompatibility:
      LiveRequestStructuredOutputCompatibilityAuthority;
    pageContractRepairStructuredOutputCompatibility:
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
  preservationFences:
    CanonicalLiveExecutionPreservationFence[];
  expectedAbsentPaths: string[];
  credentialIsolation: {
    sourcePath: string;
    variableName: 'OPENAI_API_KEY';
    assignmentPolicy: 'single-line-start-assignment/v1';
    rejectAmbientCredential: true;
    childEnvironmentPolicy: 'minimal-platform-allowlist/v1';
    inheritedEnvironmentNames: string[];
  };
  futureLiveCommand: CanonicalLiveExecutionCommand;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export type CanonicalLiveExecutionPhaseStatus =
  | 'not_evaluated'
  | 'rejected'
  | 'verified';

export interface CanonicalLiveExecutionReadiness {
  version: typeof CANONICAL_LIVE_EXECUTION_READINESS_VERSION;
  mode: 'live' | 'verify';
  status: 'ready' | 'rejected';
  zeroWrite: true;
  requestDigest: string | null;
  reasonCodes: string[];
  b0: {
    status: CanonicalLiveExecutionPhaseStatus;
    verificationVersion:
      typeof CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION;
    manifestDigest: string | null;
    structuredOutputCompatibility:
      | LiveRequestStructuredOutputCompatibilityAuthority
      | null;
    compactRepairStructuredOutputCompatibility:
      | LiveRequestStructuredOutputCompatibilityAuthority
      | null;
    pageContractRepairStructuredOutputCompatibility:
      | LiveRequestStructuredOutputCompatibilityAuthority
      | null;
    pageSpatialReferenceRepairStructuredOutputCompatibility:
      | LiveRequestStructuredOutputCompatibilityAuthority
      | null;
    structuralBundleRepairStructuredOutputCompatibility:
      | LiveRequestStructuredOutputCompatibilityAuthority
      | null;
    bookSurfaceRepairStructuredOutputCompatibility:
      | LiveRequestStructuredOutputCompatibilityAuthority
      | null;
    presentationRequirementRepairStructuredOutputCompatibility:
      | LiveRequestStructuredOutputCompatibilityAuthority
      | null;
    stablePropScopeRepairStructuredOutputCompatibility:
      | LiveRequestStructuredOutputCompatibilityAuthority
      | null;
    requestPolicy:
      | CanonicalLiveRequestPolicyAuthority
      | null;
    reasonCodes: string[];
  };
  git: {
    status: CanonicalLiveExecutionPhaseStatus;
    commandCount: number;
    refCount: number;
    divergenceCount: number;
    branchMatched: boolean;
    headMatched: boolean;
    trackedChanges: number | null;
    untrackedChanges: number | null;
  };
  preservation: {
    status: CanonicalLiveExecutionPhaseStatus;
    checkedFileCount: number;
  };
  expectedAbsence: {
    status: CanonicalLiveExecutionPhaseStatus;
    checkedPathCount: number;
  };
  credentialIsolation: {
    policy: 'minimal-platform-allowlist/v1';
    sourcePathDigest: string | null;
    sourceRead: false;
    ambientCredentialInherited: false;
  };
  futureLiveCommand: {
    status: CanonicalLiveExecutionPhaseStatus;
    identitySha256: string | null;
  };
  externalBoundaryEvidence: {
    canonicalPreflightRuns: 0;
    credentialReads: 0;
    providerCalls: 0;
    networkCalls: 0;
    storageWrites: 0;
    databaseWrites: 0;
  };
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface CanonicalLiveExecutionChildOutputArtifactAuthority {
  version: string;
  path: string;
  digest: string;
}

export interface CanonicalLiveExecutionChildOutputAuthority {
  version:
    typeof CANONICAL_LIVE_EXECUTION_CHILD_OUTPUT_AUTHORITY_VERSION;
  outputRoot: string;
  authoringRequest:
    CanonicalLiveExecutionChildOutputArtifactAuthority;
  authoringReceipt:
    CanonicalLiveExecutionChildOutputArtifactAuthority;
  authoringReadiness:
    CanonicalLiveExecutionChildOutputArtifactAuthority;
  visualContractCandidate:
    CanonicalLiveExecutionChildOutputArtifactAuthority;
  observation: {
    phase: 'synchronous_after_child_close';
    termination: { kind: 'exit'; exitCode: 0 };
  };
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface CanonicalLiveExecutionLiveResult {
  version: typeof CANONICAL_LIVE_EXECUTION_RESULT_VERSION;
  mode: 'live';
  status:
    | 'readiness_rejected'
    | 'credential_rejected'
    | 'child_completed'
    | 'child_failed';
  readiness: CanonicalLiveExecutionReadiness;
  reasonCodes: string[];
  credential: {
    sourceAccessAttempted: boolean;
    sourceReadSucceeded: boolean;
    authorityCleared: boolean;
  };
  child:
    | null
    | {
        termination:
          | { kind: 'exit'; exitCode: number }
          | { kind: 'signal'; signal: NodeJS.Signals }
          | { kind: 'spawn_error' }
          | { kind: 'output_limit' };
        stdout: 'suppressed';
        stderr: 'suppressed';
      };
  outputAuthority:
    | CanonicalLiveExecutionChildOutputAuthority
    | null;
}

export interface CanonicalLiveExecutionProbeResult {
  version: typeof CANONICAL_LIVE_EXECUTION_PROBE_VERSION;
  status: 'completed' | 'failed';
  reasonCodes: string[];
  termination:
    | { kind: 'exit'; exitCode: number }
    | { kind: 'signal'; signal: NodeJS.Signals }
    | { kind: 'spawn_error' }
    | { kind: 'output_limit' };
  evidence: {
    argvCount: number;
    probePathUtf8Bytes: number;
    probePathSha256: string;
    environmentNames: string[];
    credentialPresent: false;
  } | null;
}

interface GitCommandResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  error: boolean;
  stdout: string;
}

type GitCommandRunner = (
  args: readonly string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  },
) => GitCommandResult;

interface SpawnedChild {
  stdout: Readable | null;
  stderr: Readable | null;
  once(
    event: 'close',
    listener: (
      code: number | null,
      signal: NodeJS.Signals | null,
    ) => void,
  ): this;
  once(
    event: 'error',
    listener: (error: Error) => void,
  ): this;
  kill(signal?: NodeJS.Signals): boolean;
}

type TrustedSpawn = (
  executable: string,
  args: readonly string[],
  options: SpawnOptions,
) => SpawnedChild;

interface LoadedCredential {
  value: string;
  clear(): void;
}

type CredentialReader = (
  sourcePath: string,
  variableName: 'OPENAI_API_KEY',
) => LoadedCredential;

export interface CanonicalLiveExecutionDependencies {
  env: NodeJS.ProcessEnv;
  execPath: string;
  platform: NodeJS.Platform;
  runGit: GitCommandRunner;
  spawnTrusted: TrustedSpawn;
  readCredential: CredentialReader;
  verifyBundle: (args: {
    repoRoot: string;
    manifestPath: string;
  }) => CanonicalLiveRequestVerificationResult;
}

interface ReadinessEvaluation {
  request: CanonicalLiveExecutionRequest | null;
  repositoryRealPath: string | null;
  command: LiveRequestMaterializationManifest['futureLiveCommand'] | null;
  readiness: CanonicalLiveExecutionReadiness;
}

interface TrustedProcessResult {
  termination:
    | { kind: 'exit'; exitCode: number }
    | { kind: 'signal'; signal: NodeJS.Signals }
    | { kind: 'spawn_error' }
    | { kind: 'output_limit' };
  stdout: Buffer;
  stderr: Buffer;
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
  label: string,
): string[] {
  const actual = Object.keys(value).sort();
  const sortedExpected = expected.slice().sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some(
      (field, index) => field !== sortedExpected[index],
    )
  ) {
    return [`${label}_fields_invalid`];
  }
  return [];
}

function canonicalTimestamp(value: unknown): value is string {
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

function canonicalRelativePathIssues(
  value: unknown,
  label: string,
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
    return [`${label}_invalid`];
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
    return [`${label}_invalid`];
  }
  return [];
}

function sortedUnique(
  values: readonly string[],
): boolean {
  return (
    new Set(values).size === values.length &&
    values.every(
      (value, index) =>
        index === 0 || values[index - 1]! < value,
    )
  );
}

function childOutputAuthorityPayload(
  authority: Omit<
    CanonicalLiveExecutionChildOutputAuthority,
    'digest' | 'digestAlgorithm'
  >,
): Omit<
  CanonicalLiveExecutionChildOutputAuthority,
  'digest' | 'digestAlgorithm'
> {
  return authority;
}

export function canonicalLiveExecutionChildOutputAuthorityIssues(
  value: unknown,
): string[] {
  const authority = recordValue(value);
  if (!authority) {
    return ['child_output_authority_not_object'];
  }
  const issues = exactKeys(
    authority,
    [
      'version',
      'outputRoot',
      'authoringRequest',
      'authoringReceipt',
      'authoringReadiness',
      'visualContractCandidate',
      'observation',
      'digestAlgorithm',
      'digest',
    ],
    'child_output_authority',
  );
  if (
    authority.version !==
    CANONICAL_LIVE_EXECUTION_CHILD_OUTPUT_AUTHORITY_VERSION
  ) {
    issues.push('child_output_authority_version_invalid');
  }
  if (
    canonicalRelativePathIssues(
      authority.outputRoot,
      'child_output_authority_output_root',
    ).length > 0
  ) {
    issues.push('child_output_authority_output_root_invalid');
  }

  const artifactDefinitions = [
    {
      field: 'authoringRequest',
      category: 'authoring-requests',
      version: VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION,
    },
    {
      field: 'authoringReceipt',
      category: 'authoring-receipts',
      version: VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION,
    },
    {
      field: 'authoringReadiness',
      category: 'readiness-evidence',
      version: VISUAL_CONTRACT_AUTHORING_READINESS_VERSION,
    },
    {
      field: 'visualContractCandidate',
      category: 'contract-candidates',
      version: VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION,
    },
  ] as const;
  for (const definition of artifactDefinitions) {
    const artifact = recordValue(authority[definition.field]);
    if (
      !artifact ||
      exactKeys(
        artifact,
        ['version', 'path', 'digest'],
        `child_output_authority_${definition.field}`,
      ).length > 0 ||
      artifact.version !== definition.version ||
      typeof artifact.digest !== 'string' ||
      !DIGEST_PATTERN.test(artifact.digest) ||
      canonicalRelativePathIssues(
        artifact.path,
        `child_output_authority_${definition.field}_path`,
      ).length > 0 ||
      typeof authority.outputRoot !== 'string' ||
      artifact.path !==
        path.posix.join(
          authority.outputRoot,
          definition.category,
          `${artifact.digest}.json`,
        )
    ) {
      issues.push(
        `child_output_authority_${definition.field}_invalid`,
      );
    }
  }

  const observation = recordValue(authority.observation);
  const termination = recordValue(observation?.termination);
  if (
    !observation ||
    exactKeys(
      observation,
      ['phase', 'termination'],
      'child_output_authority_observation',
    ).length > 0 ||
    observation.phase !== 'synchronous_after_child_close' ||
    !termination ||
    exactKeys(
      termination,
      ['kind', 'exitCode'],
      'child_output_authority_termination',
    ).length > 0 ||
    termination.kind !== 'exit' ||
    termination.exitCode !== 0
  ) {
    issues.push('child_output_authority_observation_invalid');
  }
  if (
    authority.digestAlgorithm !== 'canonical-json-sha256' ||
    typeof authority.digest !== 'string' ||
    !DIGEST_PATTERN.test(authority.digest)
  ) {
    issues.push('child_output_authority_digest_invalid');
  } else {
    const {
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...payload
    } = authority;
    if (
      authority.digest !==
      canonicalJsonDigest(
        payload as Omit<
          CanonicalLiveExecutionChildOutputAuthority,
          'digest' | 'digestAlgorithm'
        >,
      )
    ) {
      issues.push('child_output_authority_digest_invalid');
    }
  }
  return [...new Set(issues)].sort();
}

export function assertValidCanonicalLiveExecutionChildOutputAuthority(
  value: unknown,
): asserts value is CanonicalLiveExecutionChildOutputAuthority {
  const issues =
    canonicalLiveExecutionChildOutputAuthorityIssues(value);
  if (issues.length > 0) {
    throw new Error(issues.join(','));
  }
}

export function minimalPlatformInheritedEnvironmentNames(
  platform: NodeJS.Platform = process.platform,
): string[] {
  return platform === 'win32'
    ? ['ComSpec', 'SystemRoot', 'TEMP', 'TMP', 'WINDIR']
    : ['LANG', 'LC_ALL', 'TMPDIR', 'TZ'];
}

function futureCommandIdentity(
  command: Pick<
    CanonicalLiveExecutionCommand,
    'arguments' | 'executable'
  >,
): string {
  return canonicalJsonDigest({
    executable: command.executable,
    arguments: command.arguments,
  });
}

function uniqueCommandArgumentValue(
  argv: readonly string[],
  flag: '--out' | '--request',
): string | null {
  const indexes = argv
    .map((argument, index) =>
      argument === flag ? index : -1,
    )
    .filter((index) => index >= 0);
  if (indexes.length !== 1) return null;
  const value = argv[indexes[0]! + 1];
  return typeof value === 'string' && value.length > 0
    ? value
    : null;
}

export function canonicalLiveExecutionExpectedAbsentPaths(
  outputRoot: string,
): string[] {
  if (
    canonicalRelativePathIssues(
      outputRoot,
      'execution_output_root',
    ).length > 0
  ) {
    throw new Error('execution_output_root_invalid');
  }
  return CANONICAL_LIVE_EXECUTION_EXPECTED_ABSENCE_CATEGORIES.map(
    (category) => path.posix.join(outputRoot, category),
  ).sort();
}

function requestPayload(
  request: Omit<
    CanonicalLiveExecutionRequest,
    'digest' | 'digestAlgorithm'
  >,
): Omit<
  CanonicalLiveExecutionRequest,
  'digest' | 'digestAlgorithm'
> {
  return request;
}

export function canonicalLiveExecutionRequestIssues(
  value: unknown,
  platform: NodeJS.Platform = process.platform,
): string[] {
  const request = recordValue(value);
  if (!request) return ['execution_request_not_object'];
  const issues = exactKeys(
    request,
    [
      'version',
      'requestId',
      'requestedAt',
      'repository',
      'canonicalBundle',
      'preservationFences',
      'expectedAbsentPaths',
      'credentialIsolation',
      'futureLiveCommand',
      'digestAlgorithm',
      'digest',
    ],
    'execution_request',
  );
  if (
    request.version !==
    CANONICAL_LIVE_EXECUTION_REQUEST_VERSION
  ) {
    issues.push('execution_request_version_invalid');
  }
  if (
    typeof request.requestId !== 'string' ||
    !IDENTIFIER_PATTERN.test(request.requestId)
  ) {
    issues.push('execution_request_id_invalid');
  }
  if (!canonicalTimestamp(request.requestedAt)) {
    issues.push('execution_request_timestamp_invalid');
  }

  const repository = recordValue(request.repository);
  if (
    !repository ||
    exactKeys(
      repository,
      [
        'realPath',
        'expectedBranch',
        'expectedHead',
        'expectedTrackedChanges',
        'expectedUntrackedChanges',
        'refs',
        'divergence',
      ],
      'execution_repository',
    ).length > 0
  ) {
    issues.push('execution_repository_schema_invalid');
  } else {
    if (
      typeof repository.realPath !== 'string' ||
      !path.isAbsolute(repository.realPath)
    ) {
      issues.push('execution_repository_path_invalid');
    }
    if (
      !isCanonicalGitRef(repository.expectedBranch) ||
      !repository.expectedBranch.startsWith('refs/heads/')
    ) {
      issues.push('execution_repository_branch_invalid');
    }
    if (
      typeof repository.expectedHead !== 'string' ||
      !COMMIT_PATTERN.test(repository.expectedHead)
    ) {
      issues.push('execution_repository_head_invalid');
    }
    if (
      repository.expectedTrackedChanges !== 0 ||
      repository.expectedUntrackedChanges !== 0
    ) {
      issues.push('execution_repository_cleanliness_invalid');
    }
    if (
      !Array.isArray(repository.refs) ||
      repository.refs.length === 0 ||
      repository.refs.length > MAX_COLLECTION_ITEMS
    ) {
      issues.push('execution_repository_refs_invalid');
    } else {
      const names: string[] = [];
      for (const entry of repository.refs) {
        const ref = recordValue(entry);
        if (
          !ref ||
          exactKeys(
            ref,
            ['name', 'expectedCommit'],
            'execution_repository_ref',
          ).length > 0 ||
          !isCanonicalGitRef(ref.name) ||
          typeof ref.expectedCommit !== 'string' ||
          !COMMIT_PATTERN.test(ref.expectedCommit)
        ) {
          issues.push('execution_repository_refs_invalid');
          continue;
        }
        names.push(ref.name);
      }
      if (!sortedUnique(names)) {
        issues.push('execution_repository_refs_invalid');
      }
      if (
        typeof repository.expectedBranch === 'string' &&
        typeof repository.expectedHead === 'string' &&
        !repository.refs.some((entry) => {
          const ref = recordValue(entry);
          return (
            ref !== null &&
            ref.name === repository.expectedBranch &&
            ref.expectedCommit === repository.expectedHead
          );
        })
      ) {
        issues.push('execution_repository_branch_ref_missing');
      }
    }
    if (
      !Array.isArray(repository.divergence) ||
      repository.divergence.length === 0 ||
      repository.divergence.length > MAX_COLLECTION_ITEMS
    ) {
      issues.push('execution_repository_divergence_invalid');
    } else {
      const refNames = new Set(
        Array.isArray(repository.refs)
          ? repository.refs
              .map((entry) => recordValue(entry)?.name)
              .filter(
                (entry): entry is string =>
                  typeof entry === 'string',
              )
          : [],
      );
      const identities: string[] = [];
      for (const entry of repository.divergence) {
        const divergence = recordValue(entry);
        if (
          !divergence ||
          exactKeys(
            divergence,
            [
              'localRef',
              'upstreamRef',
              'expectedAhead',
              'expectedBehind',
            ],
            'execution_repository_divergence',
          ).length > 0 ||
          !isCanonicalGitRef(divergence.localRef) ||
          !isCanonicalGitRef(divergence.upstreamRef) ||
          !Number.isSafeInteger(divergence.expectedAhead) ||
          (divergence.expectedAhead as number) < 0 ||
          !Number.isSafeInteger(divergence.expectedBehind) ||
          (divergence.expectedBehind as number) < 0 ||
          !refNames.has(divergence.localRef as string) ||
          !refNames.has(divergence.upstreamRef as string)
        ) {
          issues.push(
            'execution_repository_divergence_invalid',
          );
          continue;
        }
        identities.push(
          `${divergence.localRef}\0${divergence.upstreamRef}`,
        );
      }
      if (!sortedUnique(identities)) {
        issues.push('execution_repository_divergence_invalid');
      }
    }
  }

  const canonicalBundle = recordValue(request.canonicalBundle);
  if (
    !canonicalBundle ||
    exactKeys(
      canonicalBundle,
      [
        'manifestPath',
        'manifestDigest',
        'verificationVersion',
        'structuredOutputCompatibility',
        'compactRepairStructuredOutputCompatibility',
        'pageContractRepairStructuredOutputCompatibility',
        'pageSpatialReferenceRepairStructuredOutputCompatibility',
        'structuralBundleRepairStructuredOutputCompatibility',
        'bookSurfaceRepairStructuredOutputCompatibility',
        'presentationRequirementRepairStructuredOutputCompatibility',
        'stablePropScopeRepairStructuredOutputCompatibility',
        'requestPolicy',
      ],
      'execution_canonical_bundle',
    ).length > 0 ||
    canonicalRelativePathIssues(
      canonicalBundle?.manifestPath,
      'execution_manifest_path',
    ).length > 0 ||
    typeof canonicalBundle?.manifestDigest !== 'string' ||
    !DIGEST_PATTERN.test(
      canonicalBundle.manifestDigest as string,
    ) ||
    canonicalBundle.verificationVersion !==
      CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION ||
    liveRequestStructuredOutputCompatibilityAuthorityIssues(
      canonicalBundle.structuredOutputCompatibility,
      'execution_canonical_bundle_structured_output_compatibility',
    ).length > 0 ||
    liveRequestStructuredOutputCompatibilityAuthorityIssues(
      canonicalBundle.compactRepairStructuredOutputCompatibility,
      'execution_canonical_bundle_compact_repair_structured_output_compatibility',
    ).length > 0 ||
    liveRequestStructuredOutputCompatibilityAuthorityIssues(
      canonicalBundle.pageContractRepairStructuredOutputCompatibility,
      'execution_canonical_bundle_page_contract_repair_structured_output_compatibility',
    ).length > 0 ||
    liveRequestStructuredOutputCompatibilityAuthorityIssues(
      canonicalBundle.pageSpatialReferenceRepairStructuredOutputCompatibility,
      'execution_canonical_bundle_page_spatial_reference_repair_structured_output_compatibility',
    ).length > 0 ||
    liveRequestStructuredOutputCompatibilityAuthorityIssues(
      canonicalBundle.structuralBundleRepairStructuredOutputCompatibility,
      'execution_canonical_bundle_structural_bundle_repair_structured_output_compatibility',
    ).length > 0 ||
    liveRequestStructuredOutputCompatibilityAuthorityIssues(
      canonicalBundle.bookSurfaceRepairStructuredOutputCompatibility,
      'execution_canonical_bundle_book_surface_repair_structured_output_compatibility',
    ).length > 0 ||
    liveRequestStructuredOutputCompatibilityAuthorityIssues(
      canonicalBundle.presentationRequirementRepairStructuredOutputCompatibility,
      'execution_canonical_bundle_presentation_requirement_repair_structured_output_compatibility',
    ).length > 0 ||
    liveRequestStructuredOutputCompatibilityAuthorityIssues(
      canonicalBundle.stablePropScopeRepairStructuredOutputCompatibility,
      'execution_canonical_bundle_stable_prop_scope_repair_structured_output_compatibility',
    ).length > 0 ||
    liveRequestPolicyAuthorityIssues(
      canonicalBundle.requestPolicy,
      'execution_canonical_bundle_request_policy',
    ).length > 0
  ) {
    issues.push('execution_canonical_bundle_invalid');
  }

  if (
    !Array.isArray(request.preservationFences) ||
    request.preservationFences.length === 0 ||
    request.preservationFences.length > MAX_COLLECTION_ITEMS
  ) {
    issues.push('execution_preservation_fences_invalid');
  } else {
    const paths: string[] = [];
    for (const entry of request.preservationFences) {
      const fence = recordValue(entry);
      if (
        !fence ||
        exactKeys(
          fence,
          ['path', 'byteLength', 'sha256'],
          'execution_preservation_fence',
        ).length > 0 ||
        canonicalRelativePathIssues(
          fence.path,
          'execution_preservation_path',
        ).length > 0 ||
        !Number.isSafeInteger(fence.byteLength) ||
        (fence.byteLength as number) < 0 ||
        (fence.byteLength as number) >
          MAX_PRESERVATION_FILE_BYTES ||
        typeof fence.sha256 !== 'string' ||
        !DIGEST_PATTERN.test(fence.sha256)
      ) {
        issues.push('execution_preservation_fences_invalid');
        continue;
      }
      paths.push(fence.path as string);
    }
    if (!sortedUnique(paths)) {
      issues.push('execution_preservation_fences_invalid');
    }
  }

  if (
    !Array.isArray(request.expectedAbsentPaths) ||
    request.expectedAbsentPaths.length === 0 ||
    request.expectedAbsentPaths.length > MAX_COLLECTION_ITEMS ||
    request.expectedAbsentPaths.some(
      (entry) =>
        canonicalRelativePathIssues(
          entry,
          'execution_expected_absent_path',
        ).length > 0,
    ) ||
    !sortedUnique(request.expectedAbsentPaths as string[])
  ) {
    issues.push('execution_expected_absence_invalid');
  }

  const credential = recordValue(request.credentialIsolation);
  const expectedInherited =
    minimalPlatformInheritedEnvironmentNames(platform);
  if (
    !credential ||
    exactKeys(
      credential,
      [
        'sourcePath',
        'variableName',
        'assignmentPolicy',
        'rejectAmbientCredential',
        'childEnvironmentPolicy',
        'inheritedEnvironmentNames',
      ],
      'execution_credential_isolation',
    ).length > 0 ||
    typeof credential.sourcePath !== 'string' ||
    !path.isAbsolute(credential.sourcePath) ||
    credential.variableName !== 'OPENAI_API_KEY' ||
    credential.assignmentPolicy !==
      'single-line-start-assignment/v1' ||
    credential.rejectAmbientCredential !== true ||
    credential.childEnvironmentPolicy !==
      'minimal-platform-allowlist/v1' ||
    !Array.isArray(credential.inheritedEnvironmentNames) ||
    JSON.stringify(credential.inheritedEnvironmentNames) !==
      JSON.stringify(expectedInherited)
  ) {
    issues.push('execution_credential_isolation_invalid');
  }

  const command = recordValue(request.futureLiveCommand);
  if (
    !command ||
    exactKeys(
      command,
      ['executable', 'arguments', 'identitySha256'],
      'execution_future_command',
    ).length > 0 ||
    command.executable !== 'node' ||
    !Array.isArray(command.arguments) ||
    command.arguments.length === 0 ||
    command.arguments.length > 64 ||
    command.arguments.some(
      (argument) =>
        typeof argument !== 'string' ||
        argument.length === 0 ||
        argument.length > 4096 ||
        argument.includes('\0'),
    ) ||
    typeof command.identitySha256 !== 'string' ||
    !DIGEST_PATTERN.test(command.identitySha256)
  ) {
    issues.push('execution_future_command_invalid');
  } else if (
    command.identitySha256 !==
    futureCommandIdentity({
      executable: 'node',
      arguments: command.arguments as string[],
    })
  ) {
    issues.push('execution_future_command_identity_invalid');
  }
  if (
    command &&
    Array.isArray(command.arguments) &&
    Array.isArray(request.expectedAbsentPaths)
  ) {
    const outputRoot = uniqueCommandArgumentValue(
      command.arguments as string[],
      '--out',
    );
    try {
      if (
        outputRoot === null ||
        JSON.stringify(request.expectedAbsentPaths) !==
          JSON.stringify(
            canonicalLiveExecutionExpectedAbsentPaths(outputRoot),
          )
      ) {
        issues.push('execution_expected_absence_invalid');
      }
    } catch {
      issues.push('execution_expected_absence_invalid');
    }
  }

  if (request.digestAlgorithm !== 'canonical-json-sha256') {
    issues.push('execution_request_digest_algorithm_invalid');
  }
  if (
    typeof request.digest !== 'string' ||
    !DIGEST_PATTERN.test(request.digest)
  ) {
    issues.push('execution_request_digest_invalid');
  } else {
    const {
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...payload
    } = request;
    try {
      if (canonicalJsonDigest(payload) !== request.digest) {
        issues.push('execution_request_digest_invalid');
      }
    } catch {
      issues.push('execution_request_json_domain_invalid');
    }
  }
  return [...new Set(issues)].sort();
}

export function assertValidCanonicalLiveExecutionRequest(
  value: unknown,
  platform: NodeJS.Platform = process.platform,
): asserts value is CanonicalLiveExecutionRequest {
  const issues = canonicalLiveExecutionRequestIssues(
    value,
    platform,
  );
  if (issues.length > 0) {
    throw new Error('canonical_live_execution_request_invalid');
  }
}

export function buildCanonicalLiveExecutionRequest(
  value: Omit<
    CanonicalLiveExecutionRequest,
    'digest' | 'digestAlgorithm'
  >,
  platform: NodeJS.Platform = process.platform,
): CanonicalLiveExecutionRequest {
  const payload = requestPayload(value);
  const request: CanonicalLiveExecutionRequest = {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(payload),
  };
  assertValidCanonicalLiveExecutionRequest(request, platform);
  return request;
}

function stableReasonCodes(
  reasonCodes: readonly string[],
): string[] {
  const stable = [
    ...new Set(
      reasonCodes.map((reasonCode) =>
        REASON_CODE_PATTERN.test(reasonCode)
          ? reasonCode
          : 'execution_internal_failure',
      ),
    ),
  ]
    .sort()
    .slice(0, MAX_COLLECTION_ITEMS);
  return stable.length > 0
    ? stable
    : ['execution_internal_failure'];
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
    throw new Error('contained_path_escape');
  }
}

function canonicalRepositoryRealPath(
  value: string,
): string {
  if (!path.isAbsolute(value)) {
    throw new Error('repository_root_invalid');
  }
  const lexical = path.resolve(value);
  const real = fs.realpathSync(lexical);
  if (!pathsEqual(lexical, real)) {
    throw new Error('repository_root_alias_rejected');
  }
  if (!fs.statSync(real).isDirectory()) {
    throw new Error('repository_root_invalid');
  }
  return real;
}

function resolveContainedRegularFile(args: {
  repositoryRealPath: string;
  relativePath: string;
  rejectHardLinks: boolean;
}): string {
  if (
    canonicalRelativePathIssues(
      args.relativePath,
      'contained_path',
    ).length > 0
  ) {
    throw new Error('contained_path_invalid');
  }
  const lexical = path.resolve(
    args.repositoryRealPath,
    args.relativePath,
  );
  repoRelativePath(args.repositoryRealPath, lexical);
  let real: string;
  try {
    real = fs.realpathSync(lexical);
  } catch {
    throw new Error('contained_path_missing_or_unreadable');
  }
  assertContained(args.repositoryRealPath, real);
  if (!pathsEqual(lexical, real)) {
    throw new Error('contained_path_alias_rejected');
  }
  let lstat: fs.Stats;
  let stat: fs.Stats;
  try {
    lstat = fs.lstatSync(lexical);
    stat = fs.statSync(real);
  } catch {
    throw new Error('contained_path_missing_or_unreadable');
  }
  if (
    lstat.isSymbolicLink() ||
    !stat.isFile() ||
    (args.rejectHardLinks && stat.nlink !== 1)
  ) {
    throw new Error('contained_path_not_unique_regular_file');
  }
  if (
    repoRelativePath(args.repositoryRealPath, real) !==
    args.relativePath
  ) {
    throw new Error('contained_path_not_canonical');
  }
  return real;
}

function resolveContainedDirectory(args: {
  repositoryRealPath: string;
  relativePath: string;
}): string {
  if (
    canonicalRelativePathIssues(
      args.relativePath,
      'contained_directory',
    ).length > 0
  ) {
    throw new Error('contained_directory_invalid');
  }
  const lexical = path.resolve(
    args.repositoryRealPath,
    args.relativePath,
  );
  repoRelativePath(args.repositoryRealPath, lexical);
  let real: string;
  let lstat: fs.Stats;
  let stat: fs.Stats;
  try {
    real = fs.realpathSync(lexical);
    lstat = fs.lstatSync(lexical);
    stat = fs.statSync(real);
  } catch {
    throw new Error('contained_directory_missing_or_unreadable');
  }
  assertContained(args.repositoryRealPath, real);
  if (
    !pathsEqual(lexical, real) ||
    lstat.isSymbolicLink() ||
    !stat.isDirectory() ||
    repoRelativePath(args.repositoryRealPath, real) !==
      args.relativePath
  ) {
    throw new Error('contained_directory_alias_or_type_rejected');
  }
  return real;
}

interface LoadedCanonicalChildOutputArtifact {
  descriptor: CanonicalLiveExecutionChildOutputArtifactAuthority;
  value: Record<string, unknown>;
}

function readCanonicalChildOutputArtifact(args: {
  repositoryRealPath: string;
  relativePath: string;
  expectedVersion: string;
}): LoadedCanonicalChildOutputArtifact {
  const absolute = resolveContainedRegularFile({
    repositoryRealPath: args.repositoryRealPath,
    relativePath: args.relativePath,
    rejectHardLinks: true,
  });
  const stat = fs.statSync(absolute);
  if (stat.size <= 0 || stat.size > MAX_PRESERVATION_FILE_BYTES) {
    throw new Error('child_output_artifact_size_invalid');
  }
  const raw = fs.readFileSync(absolute);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString('utf8')) as unknown;
  } catch {
    throw new Error('child_output_artifact_json_invalid');
  }
  const artifact = recordValue(parsed);
  if (!artifact) {
    throw new Error('child_output_artifact_not_object');
  }
  let canonicalBytes: string;
  try {
    canonicalBytes = canonicalLiveAuthoringJsonBytes(artifact);
  } catch {
    throw new Error('child_output_artifact_domain_invalid');
  }
  if (!raw.equals(Buffer.from(canonicalBytes, 'utf8'))) {
    throw new Error('child_output_artifact_bytes_noncanonical');
  }
  if (
    artifact.version !== args.expectedVersion ||
    artifact.digestAlgorithm !== 'canonical-json-sha256' ||
    typeof artifact.digest !== 'string' ||
    !DIGEST_PATTERN.test(artifact.digest)
  ) {
    throw new Error('child_output_artifact_identity_invalid');
  }
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = artifact;
  if (canonicalJsonDigest(payload) !== artifact.digest) {
    throw new Error('child_output_artifact_digest_invalid');
  }
  if (
    path.posix.basename(args.relativePath) !==
    `${artifact.digest}.json`
  ) {
    throw new Error('child_output_artifact_filename_invalid');
  }
  return {
    descriptor: {
      version: args.expectedVersion,
      path: args.relativePath,
      digest: artifact.digest,
    },
    value: artifact,
  };
}

function soleCanonicalChildOutputArtifact(args: {
  repositoryRealPath: string;
  outputRoot: string;
  category: string;
  expectedVersion: string;
}): LoadedCanonicalChildOutputArtifact {
  const relativeDirectory = path.posix.join(
    args.outputRoot,
    args.category,
  );
  const absoluteDirectory = resolveContainedDirectory({
    repositoryRealPath: args.repositoryRealPath,
    relativePath: relativeDirectory,
  });
  const entries = fs
    .readdirSync(absoluteDirectory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  if (
    entries.length !== 1 ||
    !entries[0]!.isFile() ||
    !/^[a-f0-9]{64}\.json$/.test(entries[0]!.name)
  ) {
    throw new Error('child_output_artifact_count_invalid');
  }
  return readCanonicalChildOutputArtifact({
    repositoryRealPath: args.repositoryRealPath,
    relativePath: path.posix.join(
      relativeDirectory,
      entries[0]!.name,
    ),
    expectedVersion: args.expectedVersion,
  });
}

function assertCanonicalChildOutputCategoryEmpty(args: {
  repositoryRealPath: string;
  outputRoot: string;
  category: string;
}): void {
  const absolute = resolveContainedDirectory({
    repositoryRealPath: args.repositoryRealPath,
    relativePath: path.posix.join(
      args.outputRoot,
      args.category,
    ),
  });
  if (fs.readdirSync(absolute).length !== 0) {
    throw new Error('child_output_failure_category_not_empty');
  }
}

function assertExpectedPathAbsent(args: {
  repositoryRealPath: string;
  relativePath: string;
}): void {
  if (
    canonicalRelativePathIssues(
      args.relativePath,
      'expected_absent_path',
    ).length > 0
  ) {
    throw new Error('expected_absent_path_invalid');
  }
  let current = args.repositoryRealPath;
  for (const segment of args.relativePath.split('/')) {
    const candidate = path.join(current, segment);
    let lstat: fs.Stats;
    try {
      lstat = fs.lstatSync(candidate);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return;
      throw new Error('expected_absent_path_unreadable');
    }
    if (lstat.isSymbolicLink()) {
      throw new Error('expected_absent_path_alias_rejected');
    }
    const real = fs.realpathSync(candidate);
    assertContained(args.repositoryRealPath, real);
    if (!pathsEqual(candidate, real)) {
      throw new Error('expected_absent_path_alias_rejected');
    }
    current = candidate;
  }
  throw new Error('expected_absent_path_present');
}

function verifyPreservationFile(
  absolutePath: string,
  expectedByteLength: number,
  expectedSha256: string,
): void {
  const descriptor = fs.openSync(absolutePath, 'r');
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  let total = 0;
  let openedStat: fs.Stats;
  try {
    openedStat = fs.fstatSync(descriptor);
    if (
      !openedStat.isFile() ||
      openedStat.nlink !== 1 ||
      openedStat.size !== expectedByteLength
    ) {
      throw new Error('preservation_byte_length_mismatch');
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
      if (
        total > expectedByteLength ||
        total > MAX_PRESERVATION_FILE_BYTES
      ) {
        throw new Error('preservation_byte_length_mismatch');
      }
      hash.update(buffer.subarray(0, read));
    }
    const finalDescriptorStat = fs.fstatSync(descriptor);
    if (
      finalDescriptorStat.dev !== openedStat.dev ||
      finalDescriptorStat.ino !== openedStat.ino ||
      finalDescriptorStat.size !== openedStat.size ||
      finalDescriptorStat.nlink !== 1
    ) {
      throw new Error('preservation_file_changed_during_read');
    }
  } finally {
    buffer.fill(0);
    fs.closeSync(descriptor);
  }
  if (total !== expectedByteLength) {
    throw new Error('preservation_byte_length_mismatch');
  }
  if (hash.digest('hex') !== expectedSha256) {
    throw new Error('preservation_sha256_mismatch');
  }
  const currentReal = fs.realpathSync(absolutePath);
  const currentStat = fs.statSync(currentReal);
  if (
    !pathsEqual(currentReal, absolutePath) ||
    currentStat.dev !== openedStat.dev ||
    currentStat.ino !== openedStat.ino ||
    currentStat.size !== openedStat.size ||
    currentStat.nlink !== 1
  ) {
    throw new Error('preservation_file_changed_during_read');
  }
}

function ambientEnvironmentValue(
  env: NodeJS.ProcessEnv,
  name: string,
  platform: NodeJS.Platform,
): string | undefined {
  if (platform !== 'win32') return env[name];
  const matching = Object.keys(env).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  );
  return matching ? env[matching] : undefined;
}

function minimalEnvironment(
  env: NodeJS.ProcessEnv,
  names: readonly string[],
  platform: NodeJS.Platform,
): NodeJS.ProcessEnv {
  const result = {} as NodeJS.ProcessEnv;
  for (const name of names) {
    const value = ambientEnvironmentValue(
      env,
      name,
      platform,
    );
    if (value !== undefined) result[name] = value;
  }
  return result;
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
  return {
    ...minimalEnvironment(env, names, platform),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL:
      platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_OPTIONAL_LOCKS: '0',
    LANG: 'C',
    LC_ALL: 'C',
  };
}

function defaultGitCommandRunner(
  args: readonly string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  },
): GitCommandResult {
  const result = spawnSync('git', Array.from(args), {
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

function defaultTrustedSpawn(
  executable: string,
  args: readonly string[],
  options: SpawnOptions,
): SpawnedChild {
  return spawn(executable, Array.from(args), options) as SpawnedChild;
}

function defaultCredentialReader(
  sourcePath: string,
  variableName: 'OPENAI_API_KEY',
): LoadedCredential {
  if (!path.isAbsolute(sourcePath)) {
    throw new Error('credential_source_invalid');
  }
  const lexical = path.resolve(sourcePath);
  const real = fs.realpathSync(lexical);
  if (!pathsEqual(lexical, real)) {
    throw new Error('credential_source_alias_rejected');
  }
  const lstat = fs.lstatSync(lexical);
  const stat = fs.statSync(real);
  if (
    lstat.isSymbolicLink() ||
    !stat.isFile() ||
    stat.nlink !== 1 ||
    stat.size <= 0 ||
    stat.size > MAX_CREDENTIAL_SOURCE_BYTES
  ) {
    throw new Error('credential_source_invalid');
  }
  const source = fs.readFileSync(real);
  const marker = Buffer.from(`${variableName}=`, 'ascii');
  const values: Buffer[] = [];
  try {
    let lineStart = 0;
    for (
      let index = 0;
      index <= source.length;
      index += 1
    ) {
      if (
        index !== source.length &&
        source[index] !== 0x0a
      ) {
        continue;
      }
      let lineEnd = index;
      if (
        lineEnd > lineStart &&
        source[lineEnd - 1] === 0x0d
      ) {
        lineEnd -= 1;
      }
      const line = source.subarray(lineStart, lineEnd);
      if (
        line.length >= marker.length &&
        line.subarray(0, marker.length).equals(marker)
      ) {
        values.push(
          Buffer.from(line.subarray(marker.length)),
        );
      }
      lineStart = index + 1;
    }
  } finally {
    source.fill(0);
  }
  if (values.length !== 1) {
    for (const value of values) value.fill(0);
    throw new Error('credential_assignment_count_invalid');
  }
  const valueBytes = values[0]!;
  if (
    valueBytes.length < 8 ||
    valueBytes.length > 4096 ||
    valueBytes.some(
      (byte) => byte <= 0x20 || byte >= 0x7f,
    )
  ) {
    valueBytes.fill(0);
    throw new Error('credential_value_shape_invalid');
  }
  const loaded: LoadedCredential = {
    value: valueBytes.toString('ascii'),
    clear() {
      valueBytes.fill(0);
      loaded.value = '';
    },
  };
  return loaded;
}

function defaultDependencies(): CanonicalLiveExecutionDependencies {
  return {
    env: process.env,
    execPath: process.execPath,
    platform: process.platform,
    runGit: defaultGitCommandRunner,
    spawnTrusted: defaultTrustedSpawn,
    readCredential: defaultCredentialReader,
    verifyBundle: verifyCanonicalLiveRequestBundle,
  };
}

function resolvedDependencies(
  overrides: Partial<CanonicalLiveExecutionDependencies> = {},
): CanonicalLiveExecutionDependencies {
  return { ...defaultDependencies(), ...overrides };
}

function runRequiredGitCommand(args: {
  repositoryRealPath: string;
  argv: readonly string[];
  dependencies: CanonicalLiveExecutionDependencies;
  commandCount: { value: number };
}): string {
  args.commandCount.value += 1;
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
    throw new Error('git_command_failed');
  }
  return result.stdout.trim();
}

function verifyGitAuthority(args: {
  request: CanonicalLiveExecutionRequest;
  repositoryRealPath: string;
  dependencies: CanonicalLiveExecutionDependencies;
}): {
  commandCount: number;
  trackedChanges: number;
  untrackedChanges: number;
} {
  const commandCount = { value: 0 };
  const base = [
    '--no-optional-locks',
    '-C',
    args.repositoryRealPath,
  ] as const;
  const topLevel = runRequiredGitCommand({
    repositoryRealPath: args.repositoryRealPath,
    argv: [...base, 'rev-parse', '--show-toplevel'],
    dependencies: args.dependencies,
    commandCount,
  });
  if (
    !pathsEqual(
      canonicalRepositoryRealPath(topLevel),
      args.repositoryRealPath,
    )
  ) {
    throw new Error('git_repository_root_mismatch');
  }
  const branch = runRequiredGitCommand({
    repositoryRealPath: args.repositoryRealPath,
    argv: [...base, 'symbolic-ref', '--quiet', 'HEAD'],
    dependencies: args.dependencies,
    commandCount,
  });
  if (branch !== args.request.repository.expectedBranch) {
    throw new Error('git_branch_mismatch');
  }
  const head = runRequiredGitCommand({
    repositoryRealPath: args.repositoryRealPath,
    argv: [...base, 'rev-parse', '--verify', 'HEAD^{commit}'],
    dependencies: args.dependencies,
    commandCount,
  });
  if (head !== args.request.repository.expectedHead) {
    throw new Error('git_head_mismatch');
  }
  const status = runRequiredGitCommand({
    repositoryRealPath: args.repositoryRealPath,
    argv: [
      ...base,
      'status',
      '--porcelain=v2',
      '--untracked-files=all',
    ],
    dependencies: args.dependencies,
    commandCount,
  });
  const statusLines =
    status.length === 0 ? [] : status.split(/\r?\n/);
  const untrackedChanges = statusLines.filter((line) =>
    line.startsWith('? '),
  ).length;
  const trackedChanges = statusLines.filter(
    (line) =>
      line.length > 0 &&
      !line.startsWith('? ') &&
      !line.startsWith('! '),
  ).length;
  if (
    trackedChanges !==
      args.request.repository.expectedTrackedChanges ||
    untrackedChanges !==
      args.request.repository.expectedUntrackedChanges
  ) {
    throw new Error('git_cleanliness_mismatch');
  }

  for (const ref of args.request.repository.refs) {
    const observed = runRequiredGitCommand({
      repositoryRealPath: args.repositoryRealPath,
      argv: [
        ...base,
        'rev-parse',
        '--verify',
        '--end-of-options',
        `${ref.name}^{commit}`,
      ],
      dependencies: args.dependencies,
      commandCount,
    });
    if (observed !== ref.expectedCommit) {
      throw new Error('git_ref_mismatch');
    }
  }
  for (const divergence of args.request.repository.divergence) {
    const observed = runRequiredGitCommand({
      repositoryRealPath: args.repositoryRealPath,
      argv: [
        ...base,
        'rev-list',
        '--left-right',
        '--count',
        '--end-of-options',
        `${divergence.localRef}...${divergence.upstreamRef}`,
      ],
      dependencies: args.dependencies,
      commandCount,
    });
    const match = /^(\d+)\s+(\d+)$/.exec(observed);
    if (
      !match ||
      Number(match[1]) !== divergence.expectedAhead ||
      Number(match[2]) !== divergence.expectedBehind
    ) {
      throw new Error('git_divergence_mismatch');
    }
  }
  return {
    commandCount: commandCount.value,
    trackedChanges,
    untrackedChanges,
  };
}

function readCanonicalExecutionRequest(args: {
  repoRoot: string;
  requestPath: string;
  platform: NodeJS.Platform;
}): {
  repositoryRealPath: string;
  request: CanonicalLiveExecutionRequest;
} {
  const repositoryRealPath = canonicalRepositoryRealPath(
    args.repoRoot,
  );
  const requestAbsolute = resolveContainedRegularFile({
    repositoryRealPath,
    relativePath: args.requestPath,
    rejectHardLinks: true,
  });
  const raw = fs.readFileSync(requestAbsolute);
  let value: unknown;
  try {
    value = JSON.parse(raw.toString('utf8')) as unknown;
  } catch {
    throw new Error('execution_request_json_invalid');
  }
  let canonicalBytes: string;
  try {
    canonicalBytes = canonicalLiveAuthoringJsonBytes(value);
  } catch {
    throw new Error('execution_request_json_domain_invalid');
  }
  if (!raw.equals(Buffer.from(canonicalBytes, 'utf8'))) {
    throw new Error('execution_request_bytes_noncanonical');
  }
  assertValidCanonicalLiveExecutionRequest(
    value,
    args.platform,
  );
  if (
    !pathsEqual(value.repository.realPath, repositoryRealPath)
  ) {
    throw new Error('execution_request_repository_mismatch');
  }
  return { repositoryRealPath, request: value };
}

function readinessPayload(
  value: Omit<
    CanonicalLiveExecutionReadiness,
    'digest' | 'digestAlgorithm'
  >,
): Omit<
  CanonicalLiveExecutionReadiness,
  'digest' | 'digestAlgorithm'
> {
  return value;
}

function buildReadiness(
  value: Omit<
    CanonicalLiveExecutionReadiness,
    'digest' | 'digestAlgorithm'
  >,
): CanonicalLiveExecutionReadiness {
  const payload = readinessPayload(value);
  const readiness: CanonicalLiveExecutionReadiness = {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(payload),
  };
  assertValidCanonicalLiveExecutionReadiness(readiness);
  return readiness;
}

function initialReadinessState(args: {
  mode: 'live' | 'verify';
  request: CanonicalLiveExecutionRequest | null;
}): Omit<
  CanonicalLiveExecutionReadiness,
  'digest' | 'digestAlgorithm'
> {
  return {
    version: CANONICAL_LIVE_EXECUTION_READINESS_VERSION,
    mode: args.mode,
    status: 'rejected',
    zeroWrite: true,
    requestDigest: args.request?.digest ?? null,
    reasonCodes: [],
    b0: {
      status: 'not_evaluated',
      verificationVersion:
        CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
      manifestDigest: null,
      structuredOutputCompatibility: null,
      compactRepairStructuredOutputCompatibility: null,
      pageContractRepairStructuredOutputCompatibility: null,
      pageSpatialReferenceRepairStructuredOutputCompatibility: null,
      structuralBundleRepairStructuredOutputCompatibility: null,
      bookSurfaceRepairStructuredOutputCompatibility: null,
      presentationRequirementRepairStructuredOutputCompatibility: null,
      stablePropScopeRepairStructuredOutputCompatibility: null,
      requestPolicy: null,
      reasonCodes: [],
    },
    git: {
      status: 'not_evaluated',
      commandCount: 0,
      refCount: args.request?.repository.refs.length ?? 0,
      divergenceCount:
        args.request?.repository.divergence.length ?? 0,
      branchMatched: false,
      headMatched: false,
      trackedChanges: null,
      untrackedChanges: null,
    },
    preservation: {
      status: 'not_evaluated',
      checkedFileCount: 0,
    },
    expectedAbsence: {
      status: 'not_evaluated',
      checkedPathCount: 0,
    },
    credentialIsolation: {
      policy: 'minimal-platform-allowlist/v1',
      sourcePathDigest: args.request
        ? crypto
            .createHash('sha256')
            .update(
              Buffer.from(
                args.request.credentialIsolation.sourcePath,
                'utf8',
              ),
            )
            .digest('hex')
        : null,
      sourceRead: false,
      ambientCredentialInherited: false,
    },
    futureLiveCommand: {
      status: 'not_evaluated',
      identitySha256: null,
    },
    externalBoundaryEvidence: {
      canonicalPreflightRuns: 0,
      credentialReads: 0,
      providerCalls: 0,
      networkCalls: 0,
      storageWrites: 0,
      databaseWrites: 0,
    },
  };
}

function rejectedEvaluation(args: {
  mode: 'live' | 'verify';
  reasonCodes: readonly string[];
  request?: CanonicalLiveExecutionRequest | null;
  repositoryRealPath?: string | null;
}): ReadinessEvaluation {
  const state = initialReadinessState({
    mode: args.mode,
    request: args.request ?? null,
  });
  state.reasonCodes = stableReasonCodes(args.reasonCodes);
  return {
    request: args.request ?? null,
    repositoryRealPath: args.repositoryRealPath ?? null,
    command: null,
    readiness: buildReadiness(state),
  };
}

function readVerifiedManifest(args: {
  repositoryRealPath: string;
  request: CanonicalLiveExecutionRequest;
}): LiveRequestMaterializationManifest {
  let absolute: string;
  try {
    absolute = resolveContainedRegularFile({
      repositoryRealPath: args.repositoryRealPath,
      relativePath: args.request.canonicalBundle.manifestPath,
      rejectHardLinks: true,
    });
  } catch {
    throw new Error('execution_manifest_path_rejected');
  }
  let raw: Buffer;
  let value: unknown;
  try {
    raw = fs.readFileSync(absolute);
    value = JSON.parse(raw.toString('utf8')) as unknown;
  } catch {
    throw new Error('execution_manifest_json_rejected');
  }
  try {
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
  } catch {
    throw new Error('execution_manifest_bytes_rejected');
  }
  try {
    assertValidLiveRequestMaterializationManifest(value);
  } catch {
    throw new Error('execution_manifest_schema_rejected');
  }
  if (
    value.digest !==
    args.request.canonicalBundle.manifestDigest
  ) {
    throw new Error('manifest_identity_mismatch');
  }
  return value;
}

function buildCanonicalLiveExecutionChildOutputAuthority(args: {
  repositoryRealPath: string;
  request: CanonicalLiveExecutionRequest;
  command: LiveRequestMaterializationManifest['futureLiveCommand'];
}): CanonicalLiveExecutionChildOutputAuthority {
  const outputRoot = uniqueCommandArgumentValue(
    args.command.arguments,
    '--out',
  );
  const authoringRequestPath = uniqueCommandArgumentValue(
    args.command.arguments,
    '--request',
  );
  if (
    outputRoot === null ||
    authoringRequestPath === null ||
    canonicalRelativePathIssues(
      outputRoot,
      'child_output_root',
    ).length > 0 ||
    canonicalRelativePathIssues(
      authoringRequestPath,
      'child_output_authoring_request_path',
    ).length > 0 ||
    JSON.stringify(args.request.expectedAbsentPaths) !==
      JSON.stringify(
        canonicalLiveExecutionExpectedAbsentPaths(outputRoot),
      )
  ) {
    throw new Error('child_output_command_binding_invalid');
  }
  const manifest = readVerifiedManifest({
    repositoryRealPath: args.repositoryRealPath,
    request: args.request,
  });
  if (
    authoringRequestPath !==
      manifest.artifacts.liveAuthoringRequest.path ||
    path.posix.dirname(path.posix.dirname(authoringRequestPath)) !==
      outputRoot
  ) {
    throw new Error('child_output_request_binding_invalid');
  }
  const authoringRequest = soleCanonicalChildOutputArtifact({
    repositoryRealPath: args.repositoryRealPath,
    outputRoot,
    category: 'authoring-requests',
    expectedVersion: VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION,
  });
  if (
    authoringRequest.descriptor.path !== authoringRequestPath ||
    authoringRequest.descriptor.digest !==
      manifest.artifacts.liveAuthoringRequest.digest
  ) {
    throw new Error('child_output_request_identity_invalid');
  }
  const authoringReceipt = soleCanonicalChildOutputArtifact({
    repositoryRealPath: args.repositoryRealPath,
    outputRoot,
    category: 'authoring-receipts',
    expectedVersion: VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION,
  });
  const authoringReadiness = soleCanonicalChildOutputArtifact({
    repositoryRealPath: args.repositoryRealPath,
    outputRoot,
    category: 'readiness-evidence',
    expectedVersion: VISUAL_CONTRACT_AUTHORING_READINESS_VERSION,
  });
  const visualContractCandidate =
    soleCanonicalChildOutputArtifact({
      repositoryRealPath: args.repositoryRealPath,
      outputRoot,
      category: 'contract-candidates',
      expectedVersion:
        VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION,
    });
  assertCanonicalChildOutputCategoryEmpty({
    repositoryRealPath: args.repositoryRealPath,
    outputRoot,
    category: 'provider-call-failure-evidence',
  });
  assertCanonicalChildOutputCategoryEmpty({
    repositoryRealPath: args.repositoryRealPath,
    outputRoot,
    category: 'rejected-authoring-requests',
  });

  const receipt = authoringReceipt.value;
  const readiness = authoringReadiness.value;
  const candidate = visualContractCandidate.value;
  const readinessOutcome = recordValue(
    readiness.authoringOutcome,
  );
  const readinessCandidate = recordValue(
    readiness.visualContractCandidate,
  );
  if (
    receipt.requestDigest !== authoringRequest.descriptor.digest ||
    receipt.status !== 'completed' ||
    receipt.failure !== null ||
    typeof receipt.candidateDigest !== 'string' ||
    !DIGEST_PATTERN.test(receipt.candidateDigest) ||
    readiness.authoringRequestDigest !==
      authoringRequest.descriptor.digest ||
    readiness.authoringReceiptDigest !==
      authoringReceipt.descriptor.digest ||
    !readinessOutcome ||
    readinessOutcome.status !== 'completed' ||
    readinessOutcome.failureCode !== null ||
    readinessOutcome.terminalClassification !== null ||
    !readinessCandidate ||
    readinessCandidate.status !== 'candidate' ||
    readinessCandidate.digest !== receipt.candidateDigest ||
    candidate.status !== 'candidate' ||
    candidate.authoringRequestDigest !==
      authoringRequest.descriptor.digest ||
    candidate.authoringReceiptDigest !==
      authoringReceipt.descriptor.digest ||
    candidate.templateDigest !== receipt.candidateDigest ||
    receipt.sourceSnapshotDigest !==
      readiness.sourceSnapshotDigest ||
    receipt.sourceSnapshotDigest !==
      candidate.sourceSnapshotDigest
  ) {
    throw new Error('child_output_cross_binding_invalid');
  }
  const typedReceipt =
    receipt as unknown as VisualContractAuthoringReceipt;
  const typedAuthoringRequest =
    authoringRequest.value as unknown as VisualContractAuthoringRequest;
  const typedReadiness =
    readiness as unknown as VisualContractAuthoringReadinessEvidence;
  const typedCandidate =
    candidate as unknown as VisualContractCandidateArtifact;
  try {
    persistVisualContractAuthoringReceipt({
      repoRoot: args.repositoryRealPath,
      outputDir: outputRoot,
      request: typedAuthoringRequest,
      receipt: typedReceipt,
      write: false,
    });
    persistVisualContractAuthoringReadiness({
      repoRoot: args.repositoryRealPath,
      outputDir: outputRoot,
      request: typedAuthoringRequest,
      evidence: typedReadiness,
      receipt: typedReceipt,
      write: false,
    });
    const rebuiltCandidate =
      buildVisualContractCandidateArtifact({
        request: typedAuthoringRequest,
        receipt: typedReceipt,
        compileResult: {
          template: typedCandidate.template,
          actionSemanticCoverage:
            typedCandidate.actionSemanticCoverage,
        },
      });
    if (
      canonicalLiveAuthoringJsonBytes(rebuiltCandidate) !==
      canonicalLiveAuthoringJsonBytes(typedCandidate)
    ) {
      throw new Error('candidate_rebuild_mismatch');
    }
  } catch {
    throw new Error('child_output_current_schema_invalid');
  }

  const payload = childOutputAuthorityPayload({
    version:
      CANONICAL_LIVE_EXECUTION_CHILD_OUTPUT_AUTHORITY_VERSION,
    outputRoot,
    authoringRequest: authoringRequest.descriptor,
    authoringReceipt: authoringReceipt.descriptor,
    authoringReadiness: authoringReadiness.descriptor,
    visualContractCandidate:
      visualContractCandidate.descriptor,
    observation: {
      phase: 'synchronous_after_child_close',
      termination: { kind: 'exit', exitCode: 0 },
    },
  });
  const authority: CanonicalLiveExecutionChildOutputAuthority = {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(payload),
  };
  assertValidCanonicalLiveExecutionChildOutputAuthority(authority);
  return authority;
}

function evaluateReadinessCore(args: {
  mode: 'live' | 'verify';
  repoRoot: string;
  requestPath: string;
  dependencies: CanonicalLiveExecutionDependencies;
}): ReadinessEvaluation {
  let loaded: ReturnType<
    typeof readCanonicalExecutionRequest
  >;
  try {
    loaded = readCanonicalExecutionRequest({
      repoRoot: args.repoRoot,
      requestPath: args.requestPath,
      platform: args.dependencies.platform,
    });
  } catch {
    return rejectedEvaluation({
      mode: args.mode,
      reasonCodes: ['execution_request_rejected'],
    });
  }
  const { request, repositoryRealPath } = loaded;
  const state = initialReadinessState({
    mode: args.mode,
    request,
  });

  try {
    const git = verifyGitAuthority({
      request,
      repositoryRealPath,
      dependencies: args.dependencies,
    });
    state.git = {
      ...state.git,
      status: 'verified',
      commandCount: git.commandCount,
      branchMatched: true,
      headMatched: true,
      trackedChanges: git.trackedChanges,
      untrackedChanges: git.untrackedChanges,
    };
  } catch (error) {
    state.git.status = 'rejected';
    state.reasonCodes = stableReasonCodes([
      error instanceof Error &&
      REASON_CODE_PATTERN.test(error.message)
        ? error.message
        : 'git_verification_failed',
    ]);
    return {
      request,
      repositoryRealPath,
      command: null,
      readiness: buildReadiness(state),
    };
  }

  let b0: CanonicalLiveRequestVerificationResult;
  try {
    b0 = args.dependencies.verifyBundle({
      repoRoot: repositoryRealPath,
      manifestPath: request.canonicalBundle.manifestPath,
    });
  } catch {
    state.b0.status = 'rejected';
    state.reasonCodes = ['b0_verification_failed'];
    return {
      request,
      repositoryRealPath,
      command: null,
      readiness: buildReadiness(state),
    };
  }
  if (b0.status === 'rejected') {
    state.b0.status = 'rejected';
    state.b0.reasonCodes = b0.reasonCodes;
    state.reasonCodes = ['b0_verification_rejected'];
    return {
      request,
      repositoryRealPath,
      command: null,
      readiness: buildReadiness(state),
    };
  }
  state.b0.status = 'verified';
  state.b0.manifestDigest = b0.identities.manifestDigest;
  state.b0.structuredOutputCompatibility =
    b0.structuredOutputCompatibility;
  state.b0.compactRepairStructuredOutputCompatibility =
    b0.compactRepairStructuredOutputCompatibility;
  state.b0.pageContractRepairStructuredOutputCompatibility =
    b0.pageContractRepairStructuredOutputCompatibility;
  state.b0.pageSpatialReferenceRepairStructuredOutputCompatibility =
    b0.pageSpatialReferenceRepairStructuredOutputCompatibility;
  state.b0.structuralBundleRepairStructuredOutputCompatibility =
    b0.structuralBundleRepairStructuredOutputCompatibility;
  state.b0.bookSurfaceRepairStructuredOutputCompatibility =
    b0.bookSurfaceRepairStructuredOutputCompatibility;
  state.b0.presentationRequirementRepairStructuredOutputCompatibility =
    b0.presentationRequirementRepairStructuredOutputCompatibility;
  state.b0.stablePropScopeRepairStructuredOutputCompatibility =
    b0.stablePropScopeRepairStructuredOutputCompatibility;
  state.b0.requestPolicy = b0.requestPolicy;
  if (
    b0.identities.manifestDigest !==
      request.canonicalBundle.manifestDigest ||
    canonicalJsonDigest(b0.structuredOutputCompatibility) !==
      canonicalJsonDigest(
        request.canonicalBundle
          .structuredOutputCompatibility,
      ) ||
    canonicalJsonDigest(
      b0.compactRepairStructuredOutputCompatibility,
    ) !==
      canonicalJsonDigest(
        request.canonicalBundle
          .compactRepairStructuredOutputCompatibility,
      ) ||
    canonicalJsonDigest(
      b0.pageContractRepairStructuredOutputCompatibility,
    ) !==
      canonicalJsonDigest(
        request.canonicalBundle
          .pageContractRepairStructuredOutputCompatibility,
      ) ||
    canonicalJsonDigest(
      b0.pageSpatialReferenceRepairStructuredOutputCompatibility,
    ) !==
      canonicalJsonDigest(
        request.canonicalBundle
          .pageSpatialReferenceRepairStructuredOutputCompatibility,
      ) ||
    canonicalJsonDigest(
      b0.structuralBundleRepairStructuredOutputCompatibility,
    ) !==
      canonicalJsonDigest(
        request.canonicalBundle
          .structuralBundleRepairStructuredOutputCompatibility,
      ) ||
    canonicalJsonDigest(
      b0.bookSurfaceRepairStructuredOutputCompatibility,
    ) !==
      canonicalJsonDigest(
        request.canonicalBundle
          .bookSurfaceRepairStructuredOutputCompatibility,
      ) ||
    canonicalJsonDigest(
      b0.presentationRequirementRepairStructuredOutputCompatibility,
    ) !==
      canonicalJsonDigest(
        request.canonicalBundle
          .presentationRequirementRepairStructuredOutputCompatibility,
      ) ||
    canonicalJsonDigest(
      b0.stablePropScopeRepairStructuredOutputCompatibility,
    ) !==
      canonicalJsonDigest(
        request.canonicalBundle
          .stablePropScopeRepairStructuredOutputCompatibility,
      ) ||
    canonicalJsonDigest(b0.requestPolicy) !==
      canonicalJsonDigest(
        request.canonicalBundle.requestPolicy,
      )
  ) {
    state.b0.status = 'rejected';
    state.b0.structuredOutputCompatibility = null;
    state.b0.compactRepairStructuredOutputCompatibility = null;
    state.b0.pageContractRepairStructuredOutputCompatibility = null;
    state.b0.pageSpatialReferenceRepairStructuredOutputCompatibility = null;
    state.b0.structuralBundleRepairStructuredOutputCompatibility = null;
    state.b0.bookSurfaceRepairStructuredOutputCompatibility = null;
    state.b0.presentationRequirementRepairStructuredOutputCompatibility = null;
    state.b0.stablePropScopeRepairStructuredOutputCompatibility = null;
    state.b0.requestPolicy = null;
    state.reasonCodes = [
      b0.identities.manifestDigest !==
      request.canonicalBundle.manifestDigest
        ? 'b0_manifest_identity_mismatch'
        : canonicalJsonDigest(b0.requestPolicy) !==
            canonicalJsonDigest(
              request.canonicalBundle.requestPolicy,
            )
          ? 'b0_request_policy_mismatch'
          : 'b0_structured_output_compatibility_mismatch',
    ];
    return {
      request,
      repositoryRealPath,
      command: null,
      readiness: buildReadiness(state),
    };
  }

  let manifest: LiveRequestMaterializationManifest;
  try {
    manifest = readVerifiedManifest({
      repositoryRealPath,
      request,
    });
    const identity = futureCommandIdentity({
      executable: manifest.futureLiveCommand.executable,
      arguments: manifest.futureLiveCommand.arguments,
    });
    if (
      identity !== request.futureLiveCommand.identitySha256 ||
      manifest.futureLiveCommand.executable !==
        request.futureLiveCommand.executable ||
      JSON.stringify(manifest.futureLiveCommand.arguments) !==
        JSON.stringify(request.futureLiveCommand.arguments)
    ) {
      throw new Error('future_live_command_mismatch');
    }
    state.futureLiveCommand = {
      status: 'verified',
      identitySha256: identity,
    };
  } catch (error) {
    state.futureLiveCommand.status = 'rejected';
    state.reasonCodes = stableReasonCodes([
      error instanceof Error &&
      REASON_CODE_PATTERN.test(error.message)
        ? error.message
        : 'future_live_command_mismatch',
    ]);
    return {
      request,
      repositoryRealPath,
      command: null,
      readiness: buildReadiness(state),
    };
  }

  try {
    for (const fence of request.preservationFences) {
      const absolute = resolveContainedRegularFile({
        repositoryRealPath,
        relativePath: fence.path,
        rejectHardLinks: true,
      });
      verifyPreservationFile(
        absolute,
        fence.byteLength,
        fence.sha256,
      );
      state.preservation.checkedFileCount += 1;
    }
    state.preservation.status = 'verified';
  } catch (error) {
    state.preservation.status = 'rejected';
    state.reasonCodes = stableReasonCodes([
      error instanceof Error &&
      REASON_CODE_PATTERN.test(error.message)
        ? error.message
        : 'preservation_verification_failed',
    ]);
    return {
      request,
      repositoryRealPath,
      command: null,
      readiness: buildReadiness(state),
    };
  }

  try {
    for (const relativePath of request.expectedAbsentPaths) {
      assertExpectedPathAbsent({
        repositoryRealPath,
        relativePath,
      });
      state.expectedAbsence.checkedPathCount += 1;
    }
    state.expectedAbsence.status = 'verified';
  } catch (error) {
    state.expectedAbsence.status = 'rejected';
    state.reasonCodes = stableReasonCodes([
      error instanceof Error &&
      REASON_CODE_PATTERN.test(error.message)
        ? error.message
        : 'expected_absence_verification_failed',
    ]);
    return {
      request,
      repositoryRealPath,
      command: null,
      readiness: buildReadiness(state),
    };
  }

  state.status = 'ready';
  state.reasonCodes = [];
  return {
    request,
    repositoryRealPath,
    command: manifest.futureLiveCommand,
    readiness: buildReadiness(state),
  };
}

export function canonicalLiveExecutionReadinessIssues(
  value: unknown,
): string[] {
  const readiness = recordValue(value);
  if (!readiness) return ['execution_readiness_not_object'];
  const issues = exactKeys(
    readiness,
    [
      'version',
      'mode',
      'status',
      'zeroWrite',
      'requestDigest',
      'reasonCodes',
      'b0',
      'git',
      'preservation',
      'expectedAbsence',
      'credentialIsolation',
      'futureLiveCommand',
      'externalBoundaryEvidence',
      'digestAlgorithm',
      'digest',
    ],
    'execution_readiness',
  );
  if (
    readiness.version !==
      CANONICAL_LIVE_EXECUTION_READINESS_VERSION ||
    (readiness.mode !== 'verify' && readiness.mode !== 'live') ||
    (readiness.status !== 'ready' &&
      readiness.status !== 'rejected') ||
    readiness.zeroWrite !== true ||
    !Array.isArray(readiness.reasonCodes) ||
    readiness.reasonCodes.some(
      (code) =>
        typeof code !== 'string' ||
        !REASON_CODE_PATTERN.test(code),
    ) ||
    !sortedUnique(readiness.reasonCodes as string[]) ||
    (readiness.status === 'ready' &&
      readiness.reasonCodes.length !== 0) ||
    (readiness.status === 'rejected' &&
      readiness.reasonCodes.length === 0) ||
    (readiness.requestDigest !== null &&
      (typeof readiness.requestDigest !== 'string' ||
        !DIGEST_PATTERN.test(readiness.requestDigest)))
  ) {
    issues.push('execution_readiness_header_invalid');
  }
  const b0 = recordValue(readiness.b0);
  if (
    !b0 ||
    exactKeys(
      b0,
      [
        'status',
        'verificationVersion',
        'manifestDigest',
        'structuredOutputCompatibility',
        'compactRepairStructuredOutputCompatibility',
        'pageContractRepairStructuredOutputCompatibility',
        'pageSpatialReferenceRepairStructuredOutputCompatibility',
        'structuralBundleRepairStructuredOutputCompatibility',
        'bookSurfaceRepairStructuredOutputCompatibility',
        'presentationRequirementRepairStructuredOutputCompatibility',
        'stablePropScopeRepairStructuredOutputCompatibility',
        'requestPolicy',
        'reasonCodes',
      ],
      'execution_readiness_b0',
    ).length > 0 ||
    !['not_evaluated', 'rejected', 'verified'].includes(
      String(b0.status),
    ) ||
    b0.verificationVersion !==
      CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION ||
    (b0.manifestDigest !== null &&
      (typeof b0.manifestDigest !== 'string' ||
        !DIGEST_PATTERN.test(b0.manifestDigest))) ||
    (b0.structuredOutputCompatibility !== null &&
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.structuredOutputCompatibility,
        'execution_readiness_b0_structured_output_compatibility',
      ).length > 0) ||
    (b0.compactRepairStructuredOutputCompatibility !== null &&
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.compactRepairStructuredOutputCompatibility,
        'execution_readiness_b0_compact_repair_structured_output_compatibility',
      ).length > 0) ||
    (b0.pageContractRepairStructuredOutputCompatibility !== null &&
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.pageContractRepairStructuredOutputCompatibility,
        'execution_readiness_b0_page_contract_repair_structured_output_compatibility',
      ).length > 0) ||
    (b0.pageSpatialReferenceRepairStructuredOutputCompatibility !== null &&
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.pageSpatialReferenceRepairStructuredOutputCompatibility,
        'execution_readiness_b0_page_spatial_reference_repair_structured_output_compatibility',
      ).length > 0) ||
    (b0.structuralBundleRepairStructuredOutputCompatibility !== null &&
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.structuralBundleRepairStructuredOutputCompatibility,
        'execution_readiness_b0_structural_bundle_repair_structured_output_compatibility',
      ).length > 0) ||
    (b0.bookSurfaceRepairStructuredOutputCompatibility !== null &&
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.bookSurfaceRepairStructuredOutputCompatibility,
        'execution_readiness_b0_book_surface_repair_structured_output_compatibility',
      ).length > 0) ||
    (b0.presentationRequirementRepairStructuredOutputCompatibility !== null &&
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.presentationRequirementRepairStructuredOutputCompatibility,
        'execution_readiness_b0_presentation_requirement_repair_structured_output_compatibility',
      ).length > 0) ||
    (b0.stablePropScopeRepairStructuredOutputCompatibility !== null &&
      liveRequestStructuredOutputCompatibilityAuthorityIssues(
        b0.stablePropScopeRepairStructuredOutputCompatibility,
        'execution_readiness_b0_stable_prop_scope_repair_structured_output_compatibility',
      ).length > 0) ||
    (b0.requestPolicy !== null &&
      liveRequestPolicyAuthorityIssues(
        b0.requestPolicy,
        'execution_readiness_b0_request_policy',
      ).length > 0) ||
    (b0.status === 'verified' &&
      (b0.structuredOutputCompatibility === null ||
        b0.compactRepairStructuredOutputCompatibility === null ||
        b0.pageContractRepairStructuredOutputCompatibility === null ||
        b0.pageSpatialReferenceRepairStructuredOutputCompatibility === null ||
        b0.structuralBundleRepairStructuredOutputCompatibility === null ||
        b0.bookSurfaceRepairStructuredOutputCompatibility === null ||
        b0.presentationRequirementRepairStructuredOutputCompatibility === null ||
        b0.stablePropScopeRepairStructuredOutputCompatibility === null ||
        b0.requestPolicy === null)) ||
    (b0.status !== 'verified' &&
      (b0.structuredOutputCompatibility !== null ||
        b0.compactRepairStructuredOutputCompatibility !== null ||
        b0.pageContractRepairStructuredOutputCompatibility !== null ||
        b0.pageSpatialReferenceRepairStructuredOutputCompatibility !== null ||
        b0.structuralBundleRepairStructuredOutputCompatibility !== null ||
        b0.bookSurfaceRepairStructuredOutputCompatibility !== null ||
        b0.presentationRequirementRepairStructuredOutputCompatibility !== null ||
        b0.stablePropScopeRepairStructuredOutputCompatibility !== null ||
        b0.requestPolicy !== null)) ||
    !Array.isArray(b0.reasonCodes) ||
    b0.reasonCodes.some(
      (code) =>
        typeof code !== 'string' ||
        !REASON_CODE_PATTERN.test(code),
    )
  ) {
    issues.push('execution_readiness_b0_invalid');
  }
  const git = recordValue(readiness.git);
  if (
    !git ||
    exactKeys(
      git,
      [
        'status',
        'commandCount',
        'refCount',
        'divergenceCount',
        'branchMatched',
        'headMatched',
        'trackedChanges',
        'untrackedChanges',
      ],
      'execution_readiness_git',
    ).length > 0 ||
    !['not_evaluated', 'rejected', 'verified'].includes(
      String(git.status),
    ) ||
    !Number.isSafeInteger(git.commandCount) ||
    (git.commandCount as number) < 0 ||
    !Number.isSafeInteger(git.refCount) ||
    (git.refCount as number) < 0 ||
    !Number.isSafeInteger(git.divergenceCount) ||
    (git.divergenceCount as number) < 0 ||
    typeof git.branchMatched !== 'boolean' ||
    typeof git.headMatched !== 'boolean' ||
    (git.trackedChanges !== null &&
      (!Number.isSafeInteger(git.trackedChanges) ||
        (git.trackedChanges as number) < 0)) ||
    (git.untrackedChanges !== null &&
      (!Number.isSafeInteger(git.untrackedChanges) ||
        (git.untrackedChanges as number) < 0))
  ) {
    issues.push('execution_readiness_git_invalid');
  }
  for (const [label, fields] of [
    [
      'preservation',
      ['status', 'checkedFileCount'],
    ],
    [
      'expectedAbsence',
      ['status', 'checkedPathCount'],
    ],
  ] as const) {
    const phase = recordValue(readiness[label]);
    const countField = fields[1];
    if (
      !phase ||
      exactKeys(
        phase,
        fields,
        `execution_readiness_${label}`,
      ).length > 0 ||
      !['not_evaluated', 'rejected', 'verified'].includes(
        String(phase.status),
      ) ||
      !Number.isSafeInteger(phase[countField]) ||
      (phase[countField] as number) < 0
    ) {
      issues.push(`execution_readiness_${label}_invalid`);
    }
  }
  const credential = recordValue(
    readiness.credentialIsolation,
  );
  if (
    !credential ||
    exactKeys(
      credential,
      [
        'policy',
        'sourcePathDigest',
        'sourceRead',
        'ambientCredentialInherited',
      ],
      'execution_readiness_credential',
    ).length > 0 ||
    credential.policy !==
      'minimal-platform-allowlist/v1' ||
    (credential.sourcePathDigest !== null &&
      (typeof credential.sourcePathDigest !== 'string' ||
        !DIGEST_PATTERN.test(credential.sourcePathDigest))) ||
    credential.sourceRead !== false ||
    credential.ambientCredentialInherited !== false
  ) {
    issues.push('execution_readiness_credential_invalid');
  }
  const command = recordValue(readiness.futureLiveCommand);
  if (
    !command ||
    exactKeys(
      command,
      ['status', 'identitySha256'],
      'execution_readiness_future_command',
    ).length > 0 ||
    !['not_evaluated', 'rejected', 'verified'].includes(
      String(command.status),
    ) ||
    (command.identitySha256 !== null &&
      (typeof command.identitySha256 !== 'string' ||
        !DIGEST_PATTERN.test(command.identitySha256)))
  ) {
    issues.push('execution_readiness_future_command_invalid');
  }
  const boundary = recordValue(
    readiness.externalBoundaryEvidence,
  );
  if (
    !boundary ||
    exactKeys(
      boundary,
      [
        'canonicalPreflightRuns',
        'credentialReads',
        'providerCalls',
        'networkCalls',
        'storageWrites',
        'databaseWrites',
      ],
      'execution_readiness_boundaries',
    ).length > 0 ||
    Object.values(boundary).some((entry) => entry !== 0)
  ) {
    issues.push('execution_readiness_boundaries_invalid');
  }
  if (readiness.digestAlgorithm !== 'canonical-json-sha256') {
    issues.push('execution_readiness_digest_algorithm_invalid');
  }
  if (
    typeof readiness.digest !== 'string' ||
    !DIGEST_PATTERN.test(readiness.digest)
  ) {
    issues.push('execution_readiness_digest_invalid');
  } else {
    const {
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...payload
    } = readiness;
    try {
      if (canonicalJsonDigest(payload) !== readiness.digest) {
        issues.push('execution_readiness_digest_invalid');
      }
    } catch {
      issues.push('execution_readiness_json_domain_invalid');
    }
  }
  return [...new Set(issues)].sort();
}

export function assertValidCanonicalLiveExecutionReadiness(
  value: unknown,
): asserts value is CanonicalLiveExecutionReadiness {
  if (canonicalLiveExecutionReadinessIssues(value).length > 0) {
    throw new Error('canonical_live_execution_readiness_invalid');
  }
}

export function verifyCanonicalLiveExecution(args: {
  repoRoot: string;
  requestPath: string;
  dependencies?: Partial<CanonicalLiveExecutionDependencies>;
}): CanonicalLiveExecutionReadiness {
  return evaluateReadinessCore({
    mode: 'verify',
    repoRoot: args.repoRoot,
    requestPath: args.requestPath,
    dependencies: resolvedDependencies(args.dependencies),
  }).readiness;
}

export function canonicalLiveExecutionCliRejection(
  mode: 'live' | 'verify',
): CanonicalLiveExecutionReadiness {
  return rejectedEvaluation({
    mode,
    reasonCodes: ['execution_cli_arguments_invalid'],
  }).readiness;
}

async function runTrustedProcess(args: {
  executable: string;
  argv: readonly string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  spawnTrusted: TrustedSpawn;
}): Promise<TrustedProcessResult> {
  return new Promise((resolve) => {
    let child: SpawnedChild;
    try {
      child = args.spawnTrusted(args.executable, args.argv, {
        cwd: args.cwd,
        env: args.env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      resolve({
        termination: { kind: 'spawn_error' },
        stdout: Buffer.alloc(0),
        stderr: Buffer.alloc(0),
      });
      return;
    }
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let outputLimitExceeded = false;
    let settled = false;
    const consume = (
      chunks: Buffer[],
      chunk: Buffer | string,
      stream: 'stderr' | 'stdout',
    ): void => {
      const bytes = Buffer.isBuffer(chunk)
        ? Buffer.from(chunk)
        : Buffer.from(chunk, 'utf8');
      if (stream === 'stdout') stdoutBytes += bytes.length;
      else stderrBytes += bytes.length;
      if (
        stdoutBytes + stderrBytes > MAX_CHILD_OUTPUT_BYTES
      ) {
        outputLimitExceeded = true;
        child.kill('SIGTERM');
        return;
      }
      chunks.push(bytes);
    };
    child.stdout?.on('data', (chunk: Buffer | string) =>
      consume(stdout, chunk, 'stdout'),
    );
    child.stderr?.on('data', (chunk: Buffer | string) =>
      consume(stderr, chunk, 'stderr'),
    );
    child.once('error', () => {
      if (settled) return;
      settled = true;
      resolve({
        termination: { kind: 'spawn_error' },
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      });
    });
    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true;
      const termination: TrustedProcessResult['termination'] =
        outputLimitExceeded
          ? { kind: 'output_limit' }
          : signal
            ? { kind: 'signal', signal }
            : Number.isInteger(code)
              ? { kind: 'exit', exitCode: code as number }
              : { kind: 'spawn_error' };
      resolve({
        termination,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      });
    });
  });
}

function liveFailure(args: {
  readiness: CanonicalLiveExecutionReadiness;
  status:
    | 'readiness_rejected'
    | 'credential_rejected'
    | 'child_failed';
  reasonCodes: readonly string[];
  sourceAccessAttempted: boolean;
  sourceReadSucceeded: boolean;
  authorityCleared: boolean;
  child?: CanonicalLiveExecutionLiveResult['child'];
}): CanonicalLiveExecutionLiveResult {
  return {
    version: CANONICAL_LIVE_EXECUTION_RESULT_VERSION,
    mode: 'live',
    status: args.status,
    readiness: args.readiness,
    reasonCodes: stableReasonCodes(args.reasonCodes),
    credential: {
      sourceAccessAttempted: args.sourceAccessAttempted,
      sourceReadSucceeded: args.sourceReadSucceeded,
      authorityCleared: args.authorityCleared,
    },
    child: args.child ?? null,
    outputAuthority: null,
  };
}

export async function runCanonicalLiveExecution(args: {
  repoRoot: string;
  requestPath: string;
  dependencies?: Partial<CanonicalLiveExecutionDependencies>;
}): Promise<CanonicalLiveExecutionLiveResult> {
  const dependencies = resolvedDependencies(args.dependencies);
  const evaluation = evaluateReadinessCore({
    mode: 'live',
    repoRoot: args.repoRoot,
    requestPath: args.requestPath,
    dependencies,
  });
  if (
    evaluation.readiness.status !== 'ready' ||
    !evaluation.request ||
    !evaluation.repositoryRealPath ||
    !evaluation.command
  ) {
    return liveFailure({
      readiness: evaluation.readiness,
      status: 'readiness_rejected',
      reasonCodes: evaluation.readiness.reasonCodes,
      sourceAccessAttempted: false,
      sourceReadSucceeded: false,
      authorityCleared: true,
    });
  }
  const ambientCredential = ambientEnvironmentValue(
    dependencies.env,
    'OPENAI_API_KEY',
    dependencies.platform,
  );
  if (ambientCredential !== undefined) {
    return liveFailure({
      readiness: evaluation.readiness,
      status: 'credential_rejected',
      reasonCodes: ['ambient_credential_authority_present'],
      sourceAccessAttempted: false,
      sourceReadSucceeded: false,
      authorityCleared: true,
    });
  }

  let credential: LoadedCredential;
  try {
    credential = dependencies.readCredential(
      evaluation.request.credentialIsolation.sourcePath,
      'OPENAI_API_KEY',
    );
  } catch {
    return liveFailure({
      readiness: evaluation.readiness,
      status: 'credential_rejected',
      reasonCodes: ['credential_source_rejected'],
      sourceAccessAttempted: true,
      sourceReadSucceeded: false,
      authorityCleared: true,
    });
  }

  const childEnvironment = minimalEnvironment(
    dependencies.env,
    evaluation.request.credentialIsolation
      .inheritedEnvironmentNames,
    dependencies.platform,
  );
  childEnvironment.OPENAI_API_KEY = credential.value;
  let processPromise: Promise<TrustedProcessResult>;
  try {
    processPromise = runTrustedProcess({
      executable: dependencies.execPath,
      argv: evaluation.command.arguments,
      cwd: evaluation.repositoryRealPath,
      env: childEnvironment,
      spawnTrusted: dependencies.spawnTrusted,
    });
  } finally {
    delete childEnvironment.OPENAI_API_KEY;
    credential.clear();
  }
  const processResult = await processPromise;
  processResult.stdout.fill(0);
  processResult.stderr.fill(0);
  const child = {
    termination: processResult.termination,
    stdout: 'suppressed' as const,
    stderr: 'suppressed' as const,
  };
  if (
    processResult.termination.kind === 'exit' &&
    processResult.termination.exitCode === 0
  ) {
    let outputAuthority: CanonicalLiveExecutionChildOutputAuthority;
    try {
      outputAuthority =
        buildCanonicalLiveExecutionChildOutputAuthority({
          repositoryRealPath: evaluation.repositoryRealPath,
          request: evaluation.request,
          command: evaluation.command,
        });
    } catch {
      return liveFailure({
        readiness: evaluation.readiness,
        status: 'child_failed',
        reasonCodes: ['child_output_authority_rejected'],
        sourceAccessAttempted: true,
        sourceReadSucceeded: true,
        authorityCleared: true,
        child,
      });
    }
    return {
      version: CANONICAL_LIVE_EXECUTION_RESULT_VERSION,
      mode: 'live',
      status: 'child_completed',
      readiness: evaluation.readiness,
      reasonCodes: [],
      credential: {
        sourceAccessAttempted: true,
        sourceReadSucceeded: true,
        authorityCleared: true,
      },
      child,
      outputAuthority,
    };
  }
  const reasonCode =
    processResult.termination.kind === 'signal'
      ? 'child_signal'
      : processResult.termination.kind === 'exit'
        ? 'child_nonzero_exit'
        : processResult.termination.kind === 'output_limit'
          ? 'child_output_limit_exceeded'
          : 'child_spawn_error';
  return liveFailure({
    readiness: evaluation.readiness,
    status: 'child_failed',
    reasonCodes: [reasonCode],
    sourceAccessAttempted: true,
    sourceReadSucceeded: true,
    authorityCleared: true,
    child,
  });
}

export function canonicalLiveExecutionExitDisposition(
  result: CanonicalLiveExecutionLiveResult,
):
  | { kind: 'exit'; exitCode: number }
  | { kind: 'signal'; signal: NodeJS.Signals } {
  if (
    result.child?.termination.kind === 'signal'
  ) {
    return {
      kind: 'signal',
      signal: result.child.termination.signal,
    };
  }
  if (result.child?.termination.kind === 'exit') {
    return {
      kind: 'exit',
      exitCode:
        result.status !== 'child_completed' &&
        result.child.termination.exitCode === 0
          ? 1
          : result.child.termination.exitCode,
    };
  }
  return {
    kind: 'exit',
    exitCode: result.status === 'child_completed' ? 0 : 1,
  };
}

export async function runCanonicalLiveExecutionProbe(args: {
  repoRoot: string;
  probePath: string;
  scenario: 'nonzero' | 'signal' | 'success';
  dependencies?: Partial<CanonicalLiveExecutionDependencies>;
}): Promise<CanonicalLiveExecutionProbeResult> {
  const dependencies = resolvedDependencies(args.dependencies);
  let repositoryRealPath: string;
  try {
    repositoryRealPath = canonicalRepositoryRealPath(
      args.repoRoot,
    );
  } catch {
    return {
      version: CANONICAL_LIVE_EXECUTION_PROBE_VERSION,
      status: 'failed',
      reasonCodes: ['probe_repository_rejected'],
      termination: { kind: 'spawn_error' },
      evidence: null,
    };
  }
  const probeScript = path.join(
    repositoryRealPath,
    'scripts',
    'fixtures',
    'canonical-live-execution-probe-child.cjs',
  );
  try {
    const realProbe = fs.realpathSync(probeScript);
    if (
      !pathsEqual(realProbe, probeScript) ||
      !fs.statSync(realProbe).isFile()
    ) {
      throw new Error('probe_script_invalid');
    }
  } catch {
    return {
      version: CANONICAL_LIVE_EXECUTION_PROBE_VERSION,
      status: 'failed',
      reasonCodes: ['probe_script_rejected'],
      termination: { kind: 'spawn_error' },
      evidence: null,
    };
  }
  const environment = minimalEnvironment(
    dependencies.env,
    minimalPlatformInheritedEnvironmentNames(
      dependencies.platform,
    ),
    dependencies.platform,
  );
  const result = await runTrustedProcess({
    executable: dependencies.execPath,
    argv: [
      probeScript,
      '--probe-protocol',
      CANONICAL_LIVE_EXECUTION_PROBE_VERSION,
      '--probe-path',
      args.probePath,
      '--scenario',
      args.scenario,
    ],
    cwd: repositoryRealPath,
    env: environment,
    spawnTrusted: dependencies.spawnTrusted,
  });
  if (
    result.termination.kind === 'exit' &&
    result.termination.exitCode === 0
  ) {
    let value: unknown;
    try {
      value = JSON.parse(result.stdout.toString('utf8')) as unknown;
    } catch {
      value = null;
    }
    const evidence = recordValue(value);
    const environmentNames = evidence?.environmentNames;
    if (
      evidence?.version !==
        CANONICAL_LIVE_EXECUTION_PROBE_VERSION ||
      evidence.status !== 'ok' ||
      evidence.argvCount !== 6 ||
      evidence.probePathUtf8Bytes !==
        Buffer.byteLength(args.probePath, 'utf8') ||
      evidence.probePathSha256 !==
        crypto
          .createHash('sha256')
          .update(Buffer.from(args.probePath, 'utf8'))
          .digest('hex') ||
      !Array.isArray(environmentNames) ||
      environmentNames.some(
        (name) => typeof name !== 'string',
      ) ||
      evidence.credentialPresent !== false
    ) {
      return {
        version: CANONICAL_LIVE_EXECUTION_PROBE_VERSION,
        status: 'failed',
        reasonCodes: ['probe_output_rejected'],
        termination: result.termination,
        evidence: null,
      };
    }
    return {
      version: CANONICAL_LIVE_EXECUTION_PROBE_VERSION,
      status: 'completed',
      reasonCodes: [],
      termination: result.termination,
      evidence: {
        argvCount: evidence.argvCount,
        probePathUtf8Bytes: evidence.probePathUtf8Bytes,
        probePathSha256: evidence.probePathSha256,
        environmentNames: environmentNames as string[],
        credentialPresent: false,
      },
    };
  }
  const reasonCode =
    result.termination.kind === 'signal'
      ? 'probe_signal'
      : result.termination.kind === 'exit'
        ? 'probe_nonzero_exit'
        : result.termination.kind === 'output_limit'
          ? 'probe_output_limit_exceeded'
          : 'probe_spawn_error';
  return {
    version: CANONICAL_LIVE_EXECUTION_PROBE_VERSION,
    status: 'failed',
    reasonCodes: [reasonCode],
    termination: result.termination,
    evidence: null,
  };
}
