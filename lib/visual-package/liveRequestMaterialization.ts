import fs from 'node:fs';
import path from 'node:path';

import {
  canonicalJsonDigest,
  repoRelativePath,
} from './integrity';
import {
  canonicalLiveAuthoringJsonBytes,
  createContainedContentAddressedJsonArtifactStore,
} from './canonicalLiveAuthoringArtifacts';
import {
  readCanonicalMaterializationInputArtifact,
} from './canonicalMaterializationInput';
import {
  assertValidStorySourceAuthoritySnapshot,
  buildStorySourceAuthoritySnapshot,
  STORY_SOURCE_AUTHORITY_SNAPSHOT_VERSION,
  type StorySourceAuthorityRequest,
  type StorySourceAuthoritySnapshot,
} from './storySourceAuthority';
import {
  buildVisualContractAuthoringRequest,
  projectedMaximumAuthoringCostWithTerminalReferenceCleanupUsd,
  VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION,
  visualContractAuthoringStandardAttemptOutputBudgetIsValid,
  visualContractAuthoringRequestIssues,
  type VisualContractAuthoringArtifactWrite,
  type VisualContractAuthoringRequest,
  type VisualContractAuthoringStandardAttemptOutputBudget,
} from './visualContractAuthoringLifecycle';
import {
  STORY_SOURCE_IDENTITY_VERSION,
} from './types';
import {
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_DIGEST,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
  type OpenAIResponsesStructuredOutputCompatibilityAuthority,
} from './openaiResponsesStructuredOutputSchemaCompatibility';

export const LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION =
  'canonical-live-request-materialization-input/v19' as const;
export const STORY_SOURCE_AUTHORITY_REQUEST_ARTIFACT_VERSION =
  'story-source-authority-request/v1' as const;
export const LIVE_REQUEST_MATERIALIZATION_MANIFEST_VERSION =
  'canonical-live-request-materialization/v28' as const;
export const CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION =
  'canonical-live-request-verification/v28' as const;

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const IDENTIFIER_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const STORY_KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;
const CANONICAL_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const MATERIALIZATION_CATEGORIES = [
  'source-authority-requests',
  'source-snapshots',
  'authoring-requests',
  'live-request-materializations',
] as const;

type MaterializationCategory =
  (typeof MATERIALIZATION_CATEGORIES)[number];

export interface LiveRequestMaterializationInput {
  version: typeof LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION;
  repoRoot: string;
  storyKey: string;
  storyPath: string;
  requestId: string;
  requestedAt: string;
}

export interface StorySourceAuthorityRequestArtifact
  extends StorySourceAuthorityRequest {
  version:
    typeof STORY_SOURCE_AUTHORITY_REQUEST_ARTIFACT_VERSION;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface LiveRequestMaterializationArtifactDescriptor {
  schemaVersion: string;
  path: string;
  digest: string;
}

export interface LiveRequestStructuredOutputCompatibilityAuthority {
  schemaName: string;
  schemaVersion: string;
  schemaDigest: string;
  compatibility:
    OpenAIResponsesStructuredOutputCompatibilityAuthority;
}

export interface CanonicalLiveRequestPolicyAuthority {
  provider: 'openai';
  endpoint: 'responses';
  model: 'gpt-5.6-sol';
  serviceTier: 'default';
  reasoningEffort: 'medium';
  maxCalls: 4;
  maxRepairCount: 3;
  standardMaxCalls: 3;
  standardMaxRepairCount: 2;
  standardAttemptOutputBudget:
    VisualContractAuthoringStandardAttemptOutputBudget;
  terminalReferenceCleanup: {
    budgetClass: 'terminal_reference_cleanup';
    maxCalls: 1;
    maxRepairCount: 1;
    maxInputTokens: 6000;
    maxOutputTokens: 2000;
    eligiblePrecedingRepairModes: [
      'book_surface_patch',
      'full_draft',
    ];
    repairMode: 'page_spatial_reference_patch';
    residualFamily: 'draft_contract';
    residualCode: 'out_of_scope_reference';
  };
  transportRetries: 0;
  noFallback: true;
  projectedMaxUsd: number;
  hardCeilingUsd: 5;
}

export interface LiveRequestMaterializationManifest {
  version:
    typeof LIVE_REQUEST_MATERIALIZATION_MANIFEST_VERSION;
  status: 'materialized_inputs_only';
  requestId: string;
  requestedAt: string;
  repositoryRealPath: string;
  sourceRevision: {
    storyKey: string;
    sourceIdentityVersion: string;
    storyPath: string;
    normalizedSourceDigest: string;
    pageCount: number;
    pageNumbers: number[];
    sourceSnapshotDigest: string;
    authoredCoverAuthorityPresent: boolean;
    sourceEvidenceCatalogVersion: string;
    sourceEvidenceCatalogDigest: string;
    sourceEvidenceCatalogEntryCount: number;
  };
  artifacts: {
    sourceAuthorityRequest:
      LiveRequestMaterializationArtifactDescriptor;
    sourceSnapshot:
      LiveRequestMaterializationArtifactDescriptor;
    liveAuthoringRequest:
      LiveRequestMaterializationArtifactDescriptor;
  };
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
  futureLiveCommand: {
    executable: 'node';
    arguments: string[];
  };
  externalBoundaryEvidence: {
    providerCalls: 0;
    modelCalls: 0;
    transportRetriesAuthorized: 0;
    credentialLoadingAuthorized: false;
    pricingLookupPerformed: false;
  };
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface LiveRequestMaterializationResult {
  mode: 'canonical_live_request_materialization';
  status: 'materialized_inputs_only';
  manifest: LiveRequestMaterializationManifest;
  persistence: {
    sourceAuthorityRequest:
      VisualContractAuthoringArtifactWrite;
    sourceSnapshot: VisualContractAuthoringArtifactWrite;
    liveAuthoringRequest:
      VisualContractAuthoringArtifactWrite;
    manifest: VisualContractAuthoringArtifactWrite;
  };
}

export interface CanonicalLiveRequestVerifiedResult {
  version: typeof CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION;
  status: 'verified';
  zeroWrite: true;
  identities: {
    manifestDigest: string;
    sourceAuthorityRequestDigest: string;
    sourceSnapshotDigest: string;
    normalizedSourceDigest: string;
    liveAuthoringRequestDigest: string;
    requestId: string;
    storyKey: string;
  };
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
  externalBoundaryEvidence: {
    credentialReadOrCheck: false;
    providerReachabilityCheck: false;
    pricingLookup: false;
    providerCalls: 0;
    modelCalls: 0;
  };
}

export interface CanonicalLiveRequestRejectedResult {
  version: typeof CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION;
  status: 'rejected';
  zeroWrite: true;
  reasonCodes: string[];
}

export type CanonicalLiveRequestVerificationResult =
  | CanonicalLiveRequestVerifiedResult
  | CanonicalLiveRequestRejectedResult;

function recordValue(
  value: unknown,
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactKeyIssues(
  value: Record<string, unknown>,
  expected: readonly string[],
  prefix: string,
): string[] {
  const actual = Object.keys(value).sort();
  const expectedSorted = expected.slice().sort();
  const issues: string[] = [];
  for (const field of expectedSorted) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      issues.push(`${prefix}_field_missing:${field}`);
    }
  }
  if (
    actual.some((field) => !expectedSorted.includes(field))
  ) {
    issues.push(`${prefix}_unknown_field`);
  }
  return issues;
}

function canonicalLiveRequestPolicyAuthority(
  request: VisualContractAuthoringRequest,
): CanonicalLiveRequestPolicyAuthority {
  return {
    provider: 'openai',
    endpoint: 'responses',
    model: 'gpt-5.6-sol',
    serviceTier: 'default',
    reasoningEffort: 'medium',
    maxCalls: 4,
    maxRepairCount: 3,
    standardMaxCalls: 3,
    standardMaxRepairCount: 2,
    standardAttemptOutputBudget:
      request.tokenBudget.standardAttempts,
    terminalReferenceCleanup: {
      budgetClass: 'terminal_reference_cleanup',
      maxCalls: 1,
      maxRepairCount: 1,
      maxInputTokens: 6000,
      maxOutputTokens: 2000,
      eligiblePrecedingRepairModes: [
        'book_surface_patch',
        'full_draft',
      ],
      repairMode: 'page_spatial_reference_patch',
      residualFamily: 'draft_contract',
      residualCode: 'out_of_scope_reference',
    },
    transportRetries: 0,
    noFallback: true,
    projectedMaxUsd: request.costBudget.projectedMaxUsd,
    hardCeilingUsd: 5,
  };
}

export function liveRequestPolicyAuthorityIssues(
  value: unknown,
  prefix = 'live_request_policy',
): string[] {
  const policy = recordValue(value);
  if (!policy) return [`${prefix}_not_object`];
  const issues = exactKeyIssues(
    policy,
    [
      'provider',
      'endpoint',
      'model',
      'serviceTier',
      'reasoningEffort',
      'maxCalls',
      'maxRepairCount',
      'standardMaxCalls',
      'standardMaxRepairCount',
      'standardAttemptOutputBudget',
      'terminalReferenceCleanup',
      'transportRetries',
      'noFallback',
      'projectedMaxUsd',
      'hardCeilingUsd',
    ],
    prefix,
  );
  const cleanup = recordValue(
    policy.terminalReferenceCleanup,
  );
  const outputBudget = policy.standardAttemptOutputBudget;
  if (
    policy.provider !== 'openai' ||
    policy.endpoint !== 'responses' ||
    policy.model !== 'gpt-5.6-sol' ||
    policy.serviceTier !== 'default' ||
    policy.reasoningEffort !== 'medium' ||
    policy.maxCalls !== 4 ||
    policy.maxRepairCount !== 3 ||
    policy.standardMaxCalls !== 3 ||
    policy.standardMaxRepairCount !== 2 ||
    !visualContractAuthoringStandardAttemptOutputBudgetIsValid(
      outputBudget,
    ) ||
    !cleanup ||
    exactKeyIssues(
      cleanup,
      [
        'budgetClass',
        'maxCalls',
        'maxRepairCount',
        'maxInputTokens',
        'maxOutputTokens',
        'eligiblePrecedingRepairModes',
        'repairMode',
        'residualFamily',
        'residualCode',
      ],
      `${prefix}_cleanup`,
    ).length > 0 ||
    cleanup.budgetClass !== 'terminal_reference_cleanup' ||
    cleanup.maxCalls !== 1 ||
    cleanup.maxRepairCount !== 1 ||
    cleanup.maxInputTokens !== 6000 ||
    cleanup.maxOutputTokens !== 2000 ||
    !Array.isArray(cleanup.eligiblePrecedingRepairModes) ||
    cleanup.eligiblePrecedingRepairModes.length !== 2 ||
    cleanup.eligiblePrecedingRepairModes[0] !==
      'book_surface_patch' ||
    cleanup.eligiblePrecedingRepairModes[1] !== 'full_draft' ||
    cleanup.repairMode !== 'page_spatial_reference_patch' ||
    cleanup.residualFamily !== 'draft_contract' ||
    cleanup.residualCode !== 'out_of_scope_reference' ||
    policy.transportRetries !== 0 ||
    policy.noFallback !== true ||
    policy.hardCeilingUsd !== 5
  ) {
    issues.push(`${prefix}_invalid`);
  }
  if (
    visualContractAuthoringStandardAttemptOutputBudgetIsValid(
      outputBudget,
    ) &&
    (typeof policy.projectedMaxUsd !== 'number' ||
      typeof policy.hardCeilingUsd !== 'number' ||
      policy.projectedMaxUsd > policy.hardCeilingUsd ||
      policy.projectedMaxUsd !==
        projectedMaximumAuthoringCostWithTerminalReferenceCleanupUsd({
          standardMaxInputTokens: 64_000,
          standardAttemptOutputLimits: outputBudget.limits,
          cleanupMaxInputTokens: 6_000,
          cleanupMaxOutputTokens: 2_000,
          cleanupMaxCalls: 1,
        }))
  ) {
    issues.push(`${prefix}_cost_invalid`);
  }
  return [...new Set(issues)];
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !CANONICAL_TIMESTAMP_PATTERN.test(value)
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
  label: string,
  options: { requireMarkdown?: boolean; allowDot?: boolean } = {},
): string[] {
  if (typeof value !== 'string' || value.length === 0) {
    return [`${label}_invalid`];
  }
  if (
    path.isAbsolute(value) ||
    value.includes('\\') ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.includes('\0')
  ) {
    return [`${label}_invalid`];
  }
  const normalized = path.posix.normalize(value);
  if (
    normalized !== value ||
    (!options.allowDot && normalized === '.') ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    return [`${label}_invalid`];
  }
  if (
    options.requireMarkdown &&
    !normalized.toLowerCase().endsWith('.md')
  ) {
    return [`${label}_must_be_markdown`];
  }
  return [];
}

export function liveRequestMaterializationInputIssues(
  value: unknown,
): string[] {
  const object = recordValue(value);
  if (!object) return ['materialization_input_not_object'];
  const issues = exactKeyIssues(
    object,
    [
      'version',
      'repoRoot',
      'storyKey',
      'storyPath',
      'requestId',
      'requestedAt',
    ],
    'materialization_input',
  );
  if (
    object.version !==
    LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION
  ) {
    issues.push('materialization_input_version_invalid');
  }
  if (
    typeof object.repoRoot !== 'string' ||
    !path.isAbsolute(object.repoRoot)
  ) {
    issues.push('materialization_repo_root_invalid');
  }
  if (
    typeof object.storyKey !== 'string' ||
    !STORY_KEY_PATTERN.test(object.storyKey)
  ) {
    issues.push('materialization_story_key_invalid');
  }
  issues.push(
    ...canonicalRelativePathIssues(
      object.storyPath,
      'materialization_story_path',
      { requireMarkdown: true },
    ),
  );
  if (
    typeof object.requestId !== 'string' ||
    !IDENTIFIER_PATTERN.test(object.requestId)
  ) {
    issues.push('materialization_request_id_invalid');
  }
  if (!isCanonicalTimestamp(object.requestedAt)) {
    issues.push('materialization_requested_at_invalid');
  }
  return [...new Set(issues)].sort();
}

export function assertValidLiveRequestMaterializationInput(
  value: unknown,
): asserts value is LiveRequestMaterializationInput {
  const issues = liveRequestMaterializationInputIssues(value);
  if (issues.length > 0) {
    throw new Error(
      `Invalid live request materialization input:\n- ${issues.join('\n- ')}`,
    );
  }
}

function sourceAuthorityRequestWithoutDigest(
  value: Omit<
    StorySourceAuthorityRequestArtifact,
    'digestAlgorithm' | 'digest'
  >,
): unknown {
  return value;
}

export function buildStorySourceAuthorityRequestArtifact(
  request: StorySourceAuthorityRequest,
): StorySourceAuthorityRequestArtifact {
  const withoutDigest = {
    version:
      STORY_SOURCE_AUTHORITY_REQUEST_ARTIFACT_VERSION,
    repoRoot: request.repoRoot,
    storyKey: request.storyKey,
    storyPath: request.storyPath,
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(
      sourceAuthorityRequestWithoutDigest(withoutDigest),
    ),
  };
}

export function storySourceAuthorityRequestArtifactIssues(
  value: unknown,
): string[] {
  const object = recordValue(value);
  if (!object) return ['source_authority_request_not_object'];
  const issues = exactKeyIssues(
    object,
    [
      'version',
      'repoRoot',
      'storyKey',
      'storyPath',
      'digestAlgorithm',
      'digest',
    ],
    'source_authority_request',
  );
  if (
    object.version !==
    STORY_SOURCE_AUTHORITY_REQUEST_ARTIFACT_VERSION
  ) {
    issues.push('source_authority_request_version_invalid');
  }
  if (
    typeof object.repoRoot !== 'string' ||
    !path.isAbsolute(object.repoRoot)
  ) {
    issues.push('source_authority_request_repo_root_invalid');
  }
  if (
    typeof object.storyKey !== 'string' ||
    !STORY_KEY_PATTERN.test(object.storyKey)
  ) {
    issues.push('source_authority_request_story_key_invalid');
  }
  issues.push(
    ...canonicalRelativePathIssues(
      object.storyPath,
      'source_authority_request_story_path',
      { requireMarkdown: true },
    ),
  );
  if (object.digestAlgorithm !== 'canonical-json-sha256') {
    issues.push('source_authority_request_digest_algorithm_invalid');
  }
  if (
    typeof object.digest !== 'string' ||
    !DIGEST_PATTERN.test(object.digest)
  ) {
    issues.push('source_authority_request_digest_invalid');
  } else {
    const expected = canonicalJsonDigest({
      version: object.version,
      repoRoot: object.repoRoot,
      storyKey: object.storyKey,
      storyPath: object.storyPath,
    });
    if (object.digest !== expected) {
      issues.push('source_authority_request_digest_stale');
    }
  }
  return [...new Set(issues)].sort();
}

export function assertValidStorySourceAuthorityRequestArtifact(
  value: unknown,
): asserts value is StorySourceAuthorityRequestArtifact {
  const issues =
    storySourceAuthorityRequestArtifactIssues(value);
  if (issues.length > 0) {
    throw new Error(
      `Invalid Story Source authority request artifact:\n- ${issues.join('\n- ')}`,
    );
  }
}

function normalizedPathForComparison(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32'
    ? resolved.toLowerCase()
    : resolved;
}

function pathsEqual(left: string, right: string): boolean {
  return (
    normalizedPathForComparison(left) ===
    normalizedPathForComparison(right)
  );
}

function assertRealPathContained(
  repositoryRealPath: string,
  candidateRealPath: string,
  label: string,
): void {
  const relative = path.relative(
    repositoryRealPath,
    candidateRealPath,
  );
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label}_resolves_outside_repository`);
  }
}

function canonicalRepositoryRealPath(value: string): string {
  if (!path.isAbsolute(value)) {
    throw new Error('materialization_repo_root_must_be_absolute');
  }
  const absolute = path.resolve(value);
  let real: string;
  try {
    real = fs.realpathSync(absolute);
  } catch {
    throw new Error(
      'materialization_repo_root_missing_or_unreadable',
    );
  }
  let isDirectory = false;
  try {
    isDirectory = fs.statSync(real).isDirectory();
  } catch {
    // The stable error below owns missing, unreadable, and non-directory roots.
  }
  if (!isDirectory) {
    throw new Error('materialization_repo_root_not_directory');
  }
  return real;
}

function resolveCanonicalExistingFile(args: {
  repositoryRealPath: string;
  relativePath: string;
  label: string;
}): string {
  const pathIssues = canonicalRelativePathIssues(
    args.relativePath,
    args.label,
  );
  if (pathIssues.length > 0) {
    throw new Error(pathIssues[0]);
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
    throw new Error(`${args.label}_missing_or_unreadable`);
  }
  assertRealPathContained(
    args.repositoryRealPath,
    real,
    args.label,
  );
  if (!pathsEqual(lexical, real)) {
    throw new Error(`${args.label}_symlink_alias_rejected`);
  }
  let isFile = false;
  try {
    isFile = fs.statSync(real).isFile();
  } catch {
    // The stable error below owns unreadable/non-file inputs.
  }
  if (!isFile) {
    throw new Error(`${args.label}_not_regular_file`);
  }
  return real;
}

function assertSnapshotMaterializationComplete(args: {
  snapshot: StorySourceAuthoritySnapshot;
  storyPath: string;
}): void {
  assertValidStorySourceAuthoritySnapshot(args.snapshot);
  const pages = args.snapshot.content.pages.map(
    (page) => page.pageNumber,
  );
  const expectedPages = Array.from(
    { length: pages.length },
    (_, index) => index + 1,
  );
  if (JSON.stringify(pages) !== JSON.stringify(expectedPages)) {
    throw new Error(
      'materialization_source_page_map_incomplete',
    );
  }
  const directionPages =
    args.snapshot.content.pageImageDirections.map(
      (direction) => direction.pageNumber,
    );
  if (
    new Set(directionPages).size !== directionPages.length ||
    directionPages.some((pageNumber) => !pages.includes(pageNumber))
  ) {
    throw new Error(
      'materialization_source_image_direction_map_invalid',
    );
  }
  if (
    args.snapshot.content.sourceIdentity.path !==
    args.storyPath
  ) {
    throw new Error(
      'materialization_source_identity_path_mismatch',
    );
  }
}

function assertAdjacentCoverPathSafe(args: {
  repositoryRealPath: string;
  storyPath: string;
}): void {
  const coverPath = args.storyPath.replace(
    /\.md$/i,
    '.location-bible.json',
  );
  if (coverPath === args.storyPath) return;
  const absolute = path.resolve(
    args.repositoryRealPath,
    coverPath,
  );
  if (!fs.existsSync(absolute)) return;
  resolveCanonicalExistingFile({
    repositoryRealPath: args.repositoryRealPath,
    relativePath: coverPath,
    label: 'materialization_cover_authority_path',
  });
}

function manifestWithoutDigest(
  value: Omit<
    LiveRequestMaterializationManifest,
    'digestAlgorithm' | 'digest'
  >,
): unknown {
  return value;
}

function artifactDescriptorIssues(
  value: unknown,
  label: string,
  expectedSchemaVersion: string,
  expectedCategory: MaterializationCategory,
): string[] {
  const object = recordValue(value);
  if (!object) return [`${label}_not_object`];
  const issues = exactKeyIssues(
    object,
    ['schemaVersion', 'path', 'digest'],
    label,
  );
  if (
    object.schemaVersion !== expectedSchemaVersion
  ) {
    issues.push(`${label}_schema_version_invalid`);
  }
  issues.push(
    ...canonicalRelativePathIssues(
      object.path,
      `${label}_path`,
    ),
  );
  if (
    typeof object.digest !== 'string' ||
    !DIGEST_PATTERN.test(object.digest)
  ) {
    issues.push(`${label}_digest_invalid`);
  } else if (
    typeof object.path === 'string' &&
    (path.posix.basename(object.path) !==
      `${object.digest}.json` ||
      path.posix.basename(
        path.posix.dirname(object.path),
      ) !== expectedCategory)
  ) {
    issues.push(`${label}_content_address_invalid`);
  }
  return issues;
}

export function liveRequestStructuredOutputCompatibilityAuthorityIssues(
  value: unknown,
  label: string,
): string[] {
  const authority = recordValue(value);
  if (!authority) return [`${label}_not_object`];
  const issues = exactKeyIssues(
    authority,
    ['schemaName', 'schemaVersion', 'schemaDigest', 'compatibility'],
    label,
  );
  if (
    typeof authority.schemaName !== 'string' ||
    authority.schemaName.length === 0 ||
    typeof authority.schemaVersion !== 'string' ||
    authority.schemaVersion.length === 0 ||
    typeof authority.schemaDigest !== 'string' ||
    !DIGEST_PATTERN.test(authority.schemaDigest)
  ) {
    issues.push(`${label}_schema_identity_invalid`);
  }
  const compatibility = recordValue(authority.compatibility);
  if (
    !compatibility ||
    exactKeyIssues(
      compatibility,
      [
        'profileVersion',
        'profileDigest',
        'evidenceVersion',
        'evidenceDigest',
        'status',
        'serializedSchemaDigest',
      ],
      `${label}_compatibility`,
    ).length > 0 ||
    compatibility.profileVersion !==
      OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION ||
    compatibility.profileDigest !==
      OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_DIGEST ||
    compatibility.evidenceVersion !==
      OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION ||
    typeof compatibility.evidenceDigest !== 'string' ||
    !DIGEST_PATTERN.test(compatibility.evidenceDigest) ||
    compatibility.status !== 'compatible' ||
    typeof compatibility.serializedSchemaDigest !== 'string' ||
    !DIGEST_PATTERN.test(compatibility.serializedSchemaDigest) ||
    compatibility.serializedSchemaDigest !== authority.schemaDigest
  ) {
    issues.push(`${label}_authority_invalid`);
  }
  return issues;
}

export function liveRequestMaterializationManifestIssues(
  value: unknown,
): string[] {
  const object = recordValue(value);
  if (!object) return ['materialization_manifest_not_object'];
  const issues = exactKeyIssues(
    object,
    [
      'version',
      'status',
      'requestId',
      'requestedAt',
      'repositoryRealPath',
      'sourceRevision',
      'artifacts',
      'structuredOutputCompatibility',
      'compactRepairStructuredOutputCompatibility',
      'pageContractRepairStructuredOutputCompatibility',
      'pageSpatialReferenceRepairStructuredOutputCompatibility',
      'structuralBundleRepairStructuredOutputCompatibility',
      'bookSurfaceRepairStructuredOutputCompatibility',
      'presentationRequirementRepairStructuredOutputCompatibility',
      'stablePropScopeRepairStructuredOutputCompatibility',
      'requestPolicy',
      'futureLiveCommand',
      'externalBoundaryEvidence',
      'doesNotAuthorize',
      'digestAlgorithm',
      'digest',
    ],
    'materialization_manifest',
  );
  if (
    object.version !==
    LIVE_REQUEST_MATERIALIZATION_MANIFEST_VERSION
  ) {
    issues.push('materialization_manifest_version_invalid');
  }
  if (object.status !== 'materialized_inputs_only') {
    issues.push('materialization_manifest_status_invalid');
  }
  if (
    typeof object.requestId !== 'string' ||
    !IDENTIFIER_PATTERN.test(object.requestId)
  ) {
    issues.push('materialization_manifest_request_id_invalid');
  }
  if (!isCanonicalTimestamp(object.requestedAt)) {
    issues.push('materialization_manifest_requested_at_invalid');
  }
  if (
    typeof object.repositoryRealPath !== 'string' ||
    !path.isAbsolute(object.repositoryRealPath)
  ) {
    issues.push(
      'materialization_manifest_repository_path_invalid',
    );
  }
  const sourceRevision = recordValue(object.sourceRevision);
  if (!sourceRevision) {
    issues.push('materialization_manifest_source_revision_invalid');
  } else {
    issues.push(
      ...exactKeyIssues(
        sourceRevision,
        [
          'storyKey',
          'sourceIdentityVersion',
          'storyPath',
          'normalizedSourceDigest',
          'pageCount',
          'pageNumbers',
          'sourceSnapshotDigest',
          'authoredCoverAuthorityPresent',
          'sourceEvidenceCatalogVersion',
          'sourceEvidenceCatalogDigest',
          'sourceEvidenceCatalogEntryCount',
        ],
        'materialization_manifest_source_revision',
      ),
    );
    if (
      typeof sourceRevision.storyKey !== 'string' ||
      !STORY_KEY_PATTERN.test(sourceRevision.storyKey)
    ) {
      issues.push(
        'materialization_manifest_source_story_key_invalid',
      );
    }
    if (
      sourceRevision.sourceIdentityVersion !==
      STORY_SOURCE_IDENTITY_VERSION
    ) {
      issues.push(
        'materialization_manifest_source_identity_version_invalid',
      );
    }
    issues.push(
      ...canonicalRelativePathIssues(
        sourceRevision.storyPath,
        'materialization_manifest_source_story_path',
        { requireMarkdown: true },
      ),
    );
    if (
      typeof sourceRevision.normalizedSourceDigest !==
        'string' ||
      !DIGEST_PATTERN.test(
        sourceRevision.normalizedSourceDigest,
      ) ||
      typeof sourceRevision.sourceSnapshotDigest !== 'string' ||
      !DIGEST_PATTERN.test(
        sourceRevision.sourceSnapshotDigest,
      )
    ) {
      issues.push(
        'materialization_manifest_source_digest_invalid',
      );
    }
    if (
      !Number.isSafeInteger(sourceRevision.pageCount) ||
      (sourceRevision.pageCount as number) < 1 ||
      !Array.isArray(sourceRevision.pageNumbers) ||
      sourceRevision.pageNumbers.length !==
        sourceRevision.pageCount
    ) {
      issues.push(
        'materialization_manifest_source_pages_invalid',
      );
    } else {
      const expectedPages = Array.from(
        {
          length: sourceRevision.pageCount as number,
        },
        (_, index) => index + 1,
      );
      if (
        sourceRevision.pageNumbers.some(
          (pageNumber) =>
            !Number.isSafeInteger(pageNumber) ||
            (pageNumber as number) < 1,
        ) ||
        JSON.stringify(sourceRevision.pageNumbers) !==
          JSON.stringify(expectedPages)
      ) {
        issues.push(
          'materialization_manifest_source_pages_invalid',
        );
      }
    }
    if (
      typeof sourceRevision.authoredCoverAuthorityPresent !==
      'boolean'
    ) {
      issues.push(
        'materialization_manifest_cover_authority_invalid',
      );
    }
    if (
      typeof sourceRevision.sourceEvidenceCatalogVersion !== 'string' ||
      sourceRevision.sourceEvidenceCatalogVersion.length === 0 ||
      typeof sourceRevision.sourceEvidenceCatalogDigest !== 'string' ||
      !DIGEST_PATTERN.test(
        sourceRevision.sourceEvidenceCatalogDigest,
      ) ||
      !Number.isSafeInteger(
        sourceRevision.sourceEvidenceCatalogEntryCount,
      ) ||
      (sourceRevision.sourceEvidenceCatalogEntryCount as number) < 1
    ) {
      issues.push(
        'materialization_manifest_source_evidence_catalog_invalid',
      );
    }
  }
  const artifacts = recordValue(object.artifacts);
  if (!artifacts) {
    issues.push('materialization_manifest_artifacts_invalid');
  } else {
    issues.push(
      ...exactKeyIssues(
        artifacts,
        [
          'sourceAuthorityRequest',
          'sourceSnapshot',
          'liveAuthoringRequest',
        ],
        'materialization_manifest_artifacts',
      ),
    );
    issues.push(
      ...artifactDescriptorIssues(
        artifacts.sourceAuthorityRequest,
        'materialization_manifest_source_request',
        STORY_SOURCE_AUTHORITY_REQUEST_ARTIFACT_VERSION,
        'source-authority-requests',
      ),
      ...artifactDescriptorIssues(
        artifacts.sourceSnapshot,
        'materialization_manifest_source_snapshot',
        STORY_SOURCE_AUTHORITY_SNAPSHOT_VERSION,
        'source-snapshots',
      ),
      ...artifactDescriptorIssues(
        artifacts.liveAuthoringRequest,
        'materialization_manifest_live_request',
        VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION,
        'authoring-requests',
      ),
    );
    const descriptors = [
      artifacts.sourceAuthorityRequest,
      artifacts.sourceSnapshot,
      artifacts.liveAuthoringRequest,
    ]
      .map(recordValue)
      .filter(
        (
          descriptor,
        ): descriptor is Record<string, unknown> =>
          descriptor !== null &&
          typeof descriptor.path === 'string',
      );
    const artifactRoots = descriptors.map((descriptor) =>
      path.posix.dirname(
        path.posix.dirname(descriptor.path as string),
      ),
    );
    if (
      artifactRoots.length !== 3 ||
      new Set(artifactRoots).size !== 1
    ) {
      issues.push(
        'materialization_manifest_artifact_root_mismatch',
      );
    }
    if (
      sourceRevision &&
      typeof sourceRevision.sourceSnapshotDigest === 'string' &&
      recordValue(artifacts.sourceSnapshot)?.digest !==
        sourceRevision.sourceSnapshotDigest
    ) {
      issues.push(
        'materialization_manifest_snapshot_binding_mismatch',
      );
    }
  }
  issues.push(
    ...liveRequestStructuredOutputCompatibilityAuthorityIssues(
      object.structuredOutputCompatibility,
      'materialization_manifest_structured_output_compatibility',
    ),
    ...liveRequestStructuredOutputCompatibilityAuthorityIssues(
      object.compactRepairStructuredOutputCompatibility,
      'materialization_manifest_compact_repair_structured_output_compatibility',
    ),
    ...liveRequestStructuredOutputCompatibilityAuthorityIssues(
      object.pageContractRepairStructuredOutputCompatibility,
      'materialization_manifest_page_contract_repair_structured_output_compatibility',
    ),
    ...liveRequestStructuredOutputCompatibilityAuthorityIssues(
      object.pageSpatialReferenceRepairStructuredOutputCompatibility,
      'materialization_manifest_page_spatial_reference_repair_structured_output_compatibility',
    ),
    ...liveRequestStructuredOutputCompatibilityAuthorityIssues(
      object.structuralBundleRepairStructuredOutputCompatibility,
      'materialization_manifest_structural_bundle_repair_structured_output_compatibility',
    ),
    ...liveRequestStructuredOutputCompatibilityAuthorityIssues(
      object.bookSurfaceRepairStructuredOutputCompatibility,
      'materialization_manifest_book_surface_repair_structured_output_compatibility',
    ),
    ...liveRequestStructuredOutputCompatibilityAuthorityIssues(
      object.presentationRequirementRepairStructuredOutputCompatibility,
      'materialization_manifest_presentation_requirement_repair_structured_output_compatibility',
    ),
    ...liveRequestStructuredOutputCompatibilityAuthorityIssues(
      object.stablePropScopeRepairStructuredOutputCompatibility,
      'materialization_manifest_stable_prop_scope_repair_structured_output_compatibility',
    ),
    ...liveRequestPolicyAuthorityIssues(
      object.requestPolicy,
      'materialization_manifest_request_policy',
    ),
  );
  const command = recordValue(object.futureLiveCommand);
  if (
    !command ||
    exactKeyIssues(
      command,
      ['executable', 'arguments'],
      'materialization_manifest_future_command',
    ).length > 0 ||
    command.executable !== 'node' ||
    !Array.isArray(command.arguments) ||
    command.arguments.some(
      (argument) => typeof argument !== 'string',
    )
  ) {
    issues.push('materialization_manifest_future_command_invalid');
  } else if (artifacts) {
    const sourceDescriptor = recordValue(
      artifacts.sourceAuthorityRequest,
    );
    const snapshotDescriptor = recordValue(
      artifacts.sourceSnapshot,
    );
    const requestDescriptor = recordValue(
      artifacts.liveAuthoringRequest,
    );
    const sourcePath = sourceDescriptor?.path;
    const snapshotPath = snapshotDescriptor?.path;
    const requestPath = requestDescriptor?.path;
    const outputDir =
      typeof sourcePath === 'string'
        ? path.posix.dirname(
            path.posix.dirname(sourcePath),
          )
        : null;
    const expectedArguments =
      typeof object.repositoryRealPath === 'string' &&
      typeof sourcePath === 'string' &&
      typeof snapshotPath === 'string' &&
      typeof requestPath === 'string' &&
      outputDir !== null
        ? [
            'scripts/visual-contract-authoring.cjs',
            'live',
            '--repo-root',
            object.repositoryRealPath,
            '--source-authority-request',
            sourcePath,
            '--snapshot',
            snapshotPath,
            '--request',
            requestPath,
            '--out',
            outputDir,
          ]
        : null;
    if (
      expectedArguments === null ||
      JSON.stringify(command.arguments) !==
        JSON.stringify(expectedArguments)
    ) {
      issues.push(
        'materialization_manifest_future_command_mismatch',
      );
    }
  }
  const externalBoundary = recordValue(
    object.externalBoundaryEvidence,
  );
  if (
    !externalBoundary ||
    exactKeyIssues(
      externalBoundary,
      [
        'providerCalls',
        'modelCalls',
        'transportRetriesAuthorized',
        'credentialLoadingAuthorized',
        'pricingLookupPerformed',
      ],
      'materialization_manifest_external_boundary',
    ).length > 0 ||
    externalBoundary.providerCalls !== 0 ||
    externalBoundary.modelCalls !== 0 ||
    externalBoundary.transportRetriesAuthorized !== 0 ||
    externalBoundary.credentialLoadingAuthorized !== false ||
    externalBoundary.pricingLookupPerformed !== false
  ) {
    issues.push(
      'materialization_manifest_external_boundary_invalid',
    );
  }
  if (
    !Array.isArray(object.doesNotAuthorize) ||
    object.doesNotAuthorize.length === 0 ||
    object.doesNotAuthorize.some(
      (item) => typeof item !== 'string' || item.length === 0,
    )
  ) {
    issues.push(
      'materialization_manifest_non_authority_invalid',
    );
  }
  if (object.digestAlgorithm !== 'canonical-json-sha256') {
    issues.push(
      'materialization_manifest_digest_algorithm_invalid',
    );
  }
  if (
    typeof object.digest !== 'string' ||
    !DIGEST_PATTERN.test(object.digest)
  ) {
    issues.push('materialization_manifest_digest_invalid');
  } else {
    const {
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...withoutDigest
    } = object;
    try {
      if (
        object.digest !==
        canonicalJsonDigest(withoutDigest)
      ) {
        issues.push('materialization_manifest_digest_stale');
      }
    } catch {
      issues.push(
        'materialization_manifest_digest_domain_invalid',
      );
    }
  }
  return [...new Set(issues)].sort();
}

export function assertValidLiveRequestMaterializationManifest(
  value: unknown,
): asserts value is LiveRequestMaterializationManifest {
  const issues =
    liveRequestMaterializationManifestIssues(value);
  if (issues.length > 0) {
    throw new Error(
      `Invalid live request materialization manifest:\n- ${issues.join('\n- ')}`,
    );
  }
}

function readMaterializationInput(args: {
  repositoryRealPath: string;
  requestPath: string;
}): LiveRequestMaterializationInput {
  return readCanonicalMaterializationInputArtifact({
    repoRoot: args.repositoryRealPath,
    inputPath: args.requestPath,
    expectedKind: 'source-authoring-live-request',
    expectedPayloadSchemaVersion:
      LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
    validatePayload: assertValidLiveRequestMaterializationInput,
  }).payload;
}

export function materializeCanonicalLiveRequestBundle(args: {
  repoRoot: string;
  requestPath: string;
  outputDir: string;
}): LiveRequestMaterializationResult {
  const repositoryRealPath =
    canonicalRepositoryRealPath(args.repoRoot);
  const input = readMaterializationInput({
    repositoryRealPath,
    requestPath: args.requestPath,
  });
  const inputRepositoryRealPath =
    canonicalRepositoryRealPath(input.repoRoot);
  if (
    !pathsEqual(
      repositoryRealPath,
      inputRepositoryRealPath,
    )
  ) {
    throw new Error(
      'materialization_input_repo_root_mismatch',
    );
  }
  const storyAbsolute = resolveCanonicalExistingFile({
    repositoryRealPath,
    relativePath: input.storyPath,
    label: 'materialization_story_path',
  });
  if (
    repoRelativePath(
      repositoryRealPath,
      storyAbsolute,
    ) !== input.storyPath
  ) {
    throw new Error(
      'materialization_story_path_not_canonical',
    );
  }
  assertAdjacentCoverPathSafe({
    repositoryRealPath,
    storyPath: input.storyPath,
  });

  const sourceAuthorityRequest =
    buildStorySourceAuthorityRequestArtifact({
      repoRoot: repositoryRealPath,
      storyKey: input.storyKey,
      storyPath: input.storyPath,
    });
  assertValidStorySourceAuthorityRequestArtifact(
    sourceAuthorityRequest,
  );
  const snapshot = buildStorySourceAuthoritySnapshot({
    repoRoot: sourceAuthorityRequest.repoRoot,
    storyKey: sourceAuthorityRequest.storyKey,
    storyPath: sourceAuthorityRequest.storyPath,
  });
  assertSnapshotMaterializationComplete({
    snapshot,
    storyPath: input.storyPath,
  });
  const liveAuthoringRequest =
    buildVisualContractAuthoringRequest({
      snapshot,
      mode: 'live',
      requestId: input.requestId,
      requestedAt: input.requestedAt,
    });
  const liveRequestIssues =
    visualContractAuthoringRequestIssues({
      request: liveAuthoringRequest,
      snapshot,
    });
  if (
    liveAuthoringRequest.mode !== 'live' ||
    liveRequestIssues.length > 0
  ) {
    throw new Error(
      `materialization_live_request_invalid:${
        liveRequestIssues.join(',') || 'mode'
      }`,
    );
  }

  const outputDirIssues = canonicalRelativePathIssues(
    args.outputDir,
    'materialization_output_dir',
  );
  if (outputDirIssues.length > 0) {
    throw new Error(outputDirIssues[0]);
  }
  const artifactStore =
    createContainedContentAddressedJsonArtifactStore<MaterializationCategory>({
      repoRoot: repositoryRealPath,
      repositoryRealPath,
      outputDir: args.outputDir,
      categories: MATERIALIZATION_CATEGORIES,
      rejectSymlinkAliases: true,
      errorPrefix: 'live request materialization',
    });
  artifactStore.prepare();
  const sourceAuthorityRequestWrite = artifactStore.persist({
    category: 'source-authority-requests',
    digest: sourceAuthorityRequest.digest,
    value: sourceAuthorityRequest,
  });
  const sourceSnapshotWrite = artifactStore.persist({
    category: 'source-snapshots',
    digest: snapshot.digest,
    value: snapshot,
  });
  const liveAuthoringRequestWrite = artifactStore.persist({
    category: 'authoring-requests',
    digest: liveAuthoringRequest.digest,
    value: liveAuthoringRequest,
  });

  const manifestWithoutDigestValue = {
    version: LIVE_REQUEST_MATERIALIZATION_MANIFEST_VERSION,
    status: 'materialized_inputs_only' as const,
    requestId: input.requestId,
    requestedAt: input.requestedAt,
    repositoryRealPath,
    sourceRevision: {
      storyKey: snapshot.content.storyKey,
      sourceIdentityVersion:
        snapshot.content.sourceIdentity.version,
      storyPath: snapshot.content.sourceIdentity.path,
      normalizedSourceDigest:
        snapshot.content.sourceIdentity.digest,
      pageCount: snapshot.content.sourceIdentity.pageCount,
      pageNumbers:
        snapshot.content.sourceIdentity.pageNumbers,
      sourceSnapshotDigest: snapshot.digest,
      authoredCoverAuthorityPresent:
        snapshot.content.authoredCoverAuthority !== null,
      sourceEvidenceCatalogVersion:
        snapshot.content.sourceEvidenceCatalog.version,
      sourceEvidenceCatalogDigest:
        snapshot.content.sourceEvidenceCatalog.digest,
      sourceEvidenceCatalogEntryCount:
        snapshot.content.sourceEvidenceCatalog.entries.length,
    },
    artifacts: {
      sourceAuthorityRequest: {
        schemaVersion:
          STORY_SOURCE_AUTHORITY_REQUEST_ARTIFACT_VERSION,
        path: sourceAuthorityRequestWrite.path,
        digest: sourceAuthorityRequestWrite.digest,
      },
      sourceSnapshot: {
        schemaVersion:
          STORY_SOURCE_AUTHORITY_SNAPSHOT_VERSION,
        path: sourceSnapshotWrite.path,
        digest: sourceSnapshotWrite.digest,
      },
      liveAuthoringRequest: {
        schemaVersion:
          VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION,
        path: liveAuthoringRequestWrite.path,
        digest: liveAuthoringRequestWrite.digest,
      },
    },
    structuredOutputCompatibility: {
      schemaName:
        liveAuthoringRequest.structuredOutput.schemaName,
      schemaVersion:
        liveAuthoringRequest.structuredOutput.schemaVersion,
      schemaDigest:
        liveAuthoringRequest.structuredOutput.schemaDigest,
      compatibility: {
        profileVersion:
          liveAuthoringRequest.structuredOutput
            .compatibilityProfileVersion,
        profileDigest:
          liveAuthoringRequest.structuredOutput
            .compatibilityProfileDigest,
        evidenceVersion:
          liveAuthoringRequest.structuredOutput
            .compatibilityEvidenceVersion,
        evidenceDigest:
          liveAuthoringRequest.structuredOutput
            .compatibilityEvidenceDigest,
        status:
          liveAuthoringRequest.structuredOutput
            .compatibilityStatus,
        serializedSchemaDigest:
          liveAuthoringRequest.structuredOutput
            .serializedSchemaDigest,
      },
    },
    compactRepairStructuredOutputCompatibility: {
      schemaName:
        liveAuthoringRequest.compactRepairStructuredOutput.schemaName,
      schemaVersion:
        liveAuthoringRequest.compactRepairStructuredOutput.schemaVersion,
      schemaDigest:
        liveAuthoringRequest.compactRepairStructuredOutput.schemaDigest,
      compatibility: {
        profileVersion:
          liveAuthoringRequest.compactRepairStructuredOutput
            .compatibilityProfileVersion,
        profileDigest:
          liveAuthoringRequest.compactRepairStructuredOutput
            .compatibilityProfileDigest,
        evidenceVersion:
          liveAuthoringRequest.compactRepairStructuredOutput
            .compatibilityEvidenceVersion,
        evidenceDigest:
          liveAuthoringRequest.compactRepairStructuredOutput
            .compatibilityEvidenceDigest,
        status:
          liveAuthoringRequest.compactRepairStructuredOutput
            .compatibilityStatus,
        serializedSchemaDigest:
          liveAuthoringRequest.compactRepairStructuredOutput
            .serializedSchemaDigest,
      },
    },
    pageContractRepairStructuredOutputCompatibility: {
      schemaName:
        liveAuthoringRequest.pageContractRepairStructuredOutput.schemaName,
      schemaVersion:
        liveAuthoringRequest.pageContractRepairStructuredOutput.schemaVersion,
      schemaDigest:
        liveAuthoringRequest.pageContractRepairStructuredOutput.schemaDigest,
      compatibility: {
        profileVersion:
          liveAuthoringRequest.pageContractRepairStructuredOutput
            .compatibilityProfileVersion,
        profileDigest:
          liveAuthoringRequest.pageContractRepairStructuredOutput
            .compatibilityProfileDigest,
        evidenceVersion:
          liveAuthoringRequest.pageContractRepairStructuredOutput
            .compatibilityEvidenceVersion,
        evidenceDigest:
          liveAuthoringRequest.pageContractRepairStructuredOutput
            .compatibilityEvidenceDigest,
        status:
          liveAuthoringRequest.pageContractRepairStructuredOutput
            .compatibilityStatus,
        serializedSchemaDigest:
          liveAuthoringRequest.pageContractRepairStructuredOutput
            .serializedSchemaDigest,
      },
    },
    pageSpatialReferenceRepairStructuredOutputCompatibility: {
      schemaName:
        liveAuthoringRequest.pageSpatialReferenceRepairStructuredOutput.schemaName,
      schemaVersion:
        liveAuthoringRequest.pageSpatialReferenceRepairStructuredOutput.schemaVersion,
      schemaDigest:
        liveAuthoringRequest.pageSpatialReferenceRepairStructuredOutput.schemaDigest,
      compatibility: {
        profileVersion:
          liveAuthoringRequest.pageSpatialReferenceRepairStructuredOutput
            .compatibilityProfileVersion,
        profileDigest:
          liveAuthoringRequest.pageSpatialReferenceRepairStructuredOutput
            .compatibilityProfileDigest,
        evidenceVersion:
          liveAuthoringRequest.pageSpatialReferenceRepairStructuredOutput
            .compatibilityEvidenceVersion,
        evidenceDigest:
          liveAuthoringRequest.pageSpatialReferenceRepairStructuredOutput
            .compatibilityEvidenceDigest,
        status:
          liveAuthoringRequest.pageSpatialReferenceRepairStructuredOutput
            .compatibilityStatus,
        serializedSchemaDigest:
          liveAuthoringRequest.pageSpatialReferenceRepairStructuredOutput
            .serializedSchemaDigest,
      },
    },
    structuralBundleRepairStructuredOutputCompatibility: {
      schemaName:
        liveAuthoringRequest.structuralBundleRepairStructuredOutput.schemaName,
      schemaVersion:
        liveAuthoringRequest.structuralBundleRepairStructuredOutput.schemaVersion,
      schemaDigest:
        liveAuthoringRequest.structuralBundleRepairStructuredOutput.schemaDigest,
      compatibility: {
        profileVersion:
          liveAuthoringRequest.structuralBundleRepairStructuredOutput
            .compatibilityProfileVersion,
        profileDigest:
          liveAuthoringRequest.structuralBundleRepairStructuredOutput
            .compatibilityProfileDigest,
        evidenceVersion:
          liveAuthoringRequest.structuralBundleRepairStructuredOutput
            .compatibilityEvidenceVersion,
        evidenceDigest:
          liveAuthoringRequest.structuralBundleRepairStructuredOutput
            .compatibilityEvidenceDigest,
        status:
          liveAuthoringRequest.structuralBundleRepairStructuredOutput
            .compatibilityStatus,
        serializedSchemaDigest:
          liveAuthoringRequest.structuralBundleRepairStructuredOutput
            .serializedSchemaDigest,
      },
    },
    bookSurfaceRepairStructuredOutputCompatibility: {
      schemaName:
        liveAuthoringRequest.bookSurfaceRepairStructuredOutput.schemaName,
      schemaVersion:
        liveAuthoringRequest.bookSurfaceRepairStructuredOutput.schemaVersion,
      schemaDigest:
        liveAuthoringRequest.bookSurfaceRepairStructuredOutput.schemaDigest,
      compatibility: {
        profileVersion:
          liveAuthoringRequest.bookSurfaceRepairStructuredOutput
            .compatibilityProfileVersion,
        profileDigest:
          liveAuthoringRequest.bookSurfaceRepairStructuredOutput
            .compatibilityProfileDigest,
        evidenceVersion:
          liveAuthoringRequest.bookSurfaceRepairStructuredOutput
            .compatibilityEvidenceVersion,
        evidenceDigest:
          liveAuthoringRequest.bookSurfaceRepairStructuredOutput
            .compatibilityEvidenceDigest,
        status:
          liveAuthoringRequest.bookSurfaceRepairStructuredOutput
            .compatibilityStatus,
        serializedSchemaDigest:
          liveAuthoringRequest.bookSurfaceRepairStructuredOutput
            .serializedSchemaDigest,
      },
    },
    presentationRequirementRepairStructuredOutputCompatibility: {
      schemaName:
        liveAuthoringRequest.presentationRequirementRepairStructuredOutput.schemaName,
      schemaVersion:
        liveAuthoringRequest.presentationRequirementRepairStructuredOutput.schemaVersion,
      schemaDigest:
        liveAuthoringRequest.presentationRequirementRepairStructuredOutput.schemaDigest,
      compatibility: {
        profileVersion:
          liveAuthoringRequest.presentationRequirementRepairStructuredOutput
            .compatibilityProfileVersion,
        profileDigest:
          liveAuthoringRequest.presentationRequirementRepairStructuredOutput
            .compatibilityProfileDigest,
        evidenceVersion:
          liveAuthoringRequest.presentationRequirementRepairStructuredOutput
            .compatibilityEvidenceVersion,
        evidenceDigest:
          liveAuthoringRequest.presentationRequirementRepairStructuredOutput
            .compatibilityEvidenceDigest,
        status:
          liveAuthoringRequest.presentationRequirementRepairStructuredOutput
            .compatibilityStatus,
        serializedSchemaDigest:
          liveAuthoringRequest.presentationRequirementRepairStructuredOutput
            .serializedSchemaDigest,
      },
    },
    stablePropScopeRepairStructuredOutputCompatibility: {
      schemaName:
        liveAuthoringRequest.stablePropScopeRepairStructuredOutput.schemaName,
      schemaVersion:
        liveAuthoringRequest.stablePropScopeRepairStructuredOutput.schemaVersion,
      schemaDigest:
        liveAuthoringRequest.stablePropScopeRepairStructuredOutput.schemaDigest,
      compatibility: {
        profileVersion:
          liveAuthoringRequest.stablePropScopeRepairStructuredOutput
            .compatibilityProfileVersion,
        profileDigest:
          liveAuthoringRequest.stablePropScopeRepairStructuredOutput
            .compatibilityProfileDigest,
        evidenceVersion:
          liveAuthoringRequest.stablePropScopeRepairStructuredOutput
            .compatibilityEvidenceVersion,
        evidenceDigest:
          liveAuthoringRequest.stablePropScopeRepairStructuredOutput
            .compatibilityEvidenceDigest,
        status:
          liveAuthoringRequest.stablePropScopeRepairStructuredOutput
            .compatibilityStatus,
        serializedSchemaDigest:
          liveAuthoringRequest.stablePropScopeRepairStructuredOutput
            .serializedSchemaDigest,
      },
    },
    requestPolicy:
      canonicalLiveRequestPolicyAuthority(
        liveAuthoringRequest,
      ),
    futureLiveCommand: {
      executable: 'node' as const,
      arguments: [
        'scripts/visual-contract-authoring.cjs',
        'live',
        '--repo-root',
        repositoryRealPath,
        '--source-authority-request',
        sourceAuthorityRequestWrite.path,
        '--snapshot',
        sourceSnapshotWrite.path,
        '--request',
        liveAuthoringRequestWrite.path,
        '--out',
        args.outputDir,
      ],
    },
    externalBoundaryEvidence: {
      providerCalls: 0 as const,
      modelCalls: 0 as const,
      transportRetriesAuthorized: 0 as const,
      credentialLoadingAuthorized: false as const,
      pricingLookupPerformed: false as const,
    },
    doesNotAuthorize: [
      'credential loading or credential existence checks',
      'pricing lookup or price reauthorization',
      'provider, model, network, or live authoring calls',
      'Visual Contract candidate creation or approval',
      'Semantic Reconciliation, Blueprint, Board, package, render, publication, promotion, production, deployment, or release',
    ],
  };
  const manifest: LiveRequestMaterializationManifest = {
    ...manifestWithoutDigestValue,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(
      manifestWithoutDigest(manifestWithoutDigestValue),
    ),
  };
  assertValidLiveRequestMaterializationManifest(manifest);
  const manifestWrite = artifactStore.persist({
    category: 'live-request-materializations',
    digest: manifest.digest,
    value: manifest,
  });
  return {
    mode: 'canonical_live_request_materialization',
    status: 'materialized_inputs_only',
    manifest,
    persistence: {
      sourceAuthorityRequest:
        sourceAuthorityRequestWrite,
      sourceSnapshot: sourceSnapshotWrite,
      liveAuthoringRequest: liveAuthoringRequestWrite,
      manifest: manifestWrite,
    },
  };
}

class CanonicalLiveRequestVerificationFailure extends Error {
  readonly reasonCodes: string[];

  constructor(reasonCodes: readonly string[]) {
    super('canonical_live_request_verification_rejected');
    this.name = 'CanonicalLiveRequestVerificationFailure';
    this.reasonCodes = stableVerificationReasonCodes(reasonCodes);
  }
}

function stableVerificationReasonCodes(
  reasonCodes: readonly string[],
): string[] {
  const stable = [
    ...new Set(
      reasonCodes.map((reasonCode) =>
        /^[a-z0-9_:-]{1,128}$/.test(reasonCode)
          ? reasonCode
          : 'verification_internal_failure',
      ),
    ),
  ]
    .sort()
    .slice(0, 64);
  return stable.length > 0
    ? stable
    : ['verification_internal_failure'];
}

function rejectVerification(
  ...reasonCodes: string[]
): never {
  throw new CanonicalLiveRequestVerificationFailure(
    reasonCodes,
  );
}

function rejectedVerificationResult(
  reasonCodes: readonly string[],
): CanonicalLiveRequestRejectedResult {
  return {
    version: CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
    status: 'rejected',
    zeroWrite: true,
    reasonCodes: stableVerificationReasonCodes(reasonCodes),
  };
}

function manifestVerificationReasonCodes(
  issues: readonly string[],
): string[] {
  const reasons: string[] = [];
  for (const issue of issues) {
    if (issue.includes('structured_output_compatibility')) {
      reasons.push('structured_output_compatibility_invalid');
    } else if (issue.includes('future_command')) {
      reasons.push('future_live_command_invalid');
    } else if (
      issue.includes('digest') &&
      !issue.includes('source_digest') &&
      !issue.includes('snapshot_binding')
    ) {
      reasons.push('manifest_digest_invalid');
    } else if (issue.includes('artifact_root')) {
      reasons.push('artifact_root_mismatch');
    } else if (
      issue.includes('binding') ||
      issue.includes('source_revision')
    ) {
      reasons.push('manifest_linkage_invalid');
    } else if (issue.includes('external_boundary')) {
      reasons.push('manifest_external_boundary_invalid');
    } else {
      reasons.push('manifest_schema_invalid');
    }
  }
  return stableVerificationReasonCodes(reasons);
}

interface CanonicalVerificationArtifact {
  absolutePath: string;
  relativePath: string;
  value: unknown;
  canonicalBytes: string;
}

function readCanonicalVerificationArtifact(args: {
  repositoryRealPath: string;
  relativePath: string;
  label:
    | 'manifest'
    | 'source_authority_request'
    | 'source_snapshot'
    | 'live_authoring_request';
}): CanonicalVerificationArtifact {
  if (
    canonicalRelativePathIssues(
      args.relativePath,
      `${args.label}_path`,
    ).length > 0
  ) {
    rejectVerification(`${args.label}_path_invalid`);
  }
  let absolutePath: string;
  try {
    absolutePath = resolveCanonicalExistingFile({
      repositoryRealPath: args.repositoryRealPath,
      relativePath: args.relativePath,
      label: `${args.label}_path`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '';
    if (message.includes('symlink_alias_rejected')) {
      rejectVerification(
        `${args.label}_symlink_alias_rejected`,
      );
    }
    if (message.includes('resolves_outside_repository')) {
      rejectVerification(`${args.label}_path_escape`);
    }
    rejectVerification(
      `${args.label}_missing_or_unreadable`,
    );
  }
  const canonicalRelative = repoRelativePath(
    args.repositoryRealPath,
    absolutePath,
  );
  if (canonicalRelative !== args.relativePath) {
    rejectVerification(`${args.label}_path_not_canonical`);
  }
  let rawBytes: Buffer;
  try {
    rawBytes = fs.readFileSync(absolutePath);
  } catch {
    rejectVerification(
      `${args.label}_missing_or_unreadable`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(rawBytes.toString('utf8')) as unknown;
  } catch {
    rejectVerification(`${args.label}_json_invalid`);
  }
  let canonicalBytes: string;
  try {
    canonicalBytes = canonicalLiveAuthoringJsonBytes(value);
  } catch {
    rejectVerification(`${args.label}_json_domain_invalid`);
  }
  if (
    !rawBytes.equals(Buffer.from(canonicalBytes, 'utf8'))
  ) {
    rejectVerification(`${args.label}_bytes_noncanonical`);
  }
  return {
    absolutePath,
    relativePath: canonicalRelative,
    value,
    canonicalBytes,
  };
}

function descriptorVerificationPath(args: {
  repositoryRealPath: string;
  descriptor: LiveRequestMaterializationArtifactDescriptor;
  label:
    | 'source_authority_request'
    | 'source_snapshot'
    | 'live_authoring_request';
}): CanonicalVerificationArtifact {
  const artifact = readCanonicalVerificationArtifact({
    repositoryRealPath: args.repositoryRealPath,
    relativePath: args.descriptor.path,
    label: args.label,
  });
  if (
    path.posix.basename(artifact.relativePath) !==
    `${args.descriptor.digest}.json`
  ) {
    rejectVerification(
      `${args.label}_content_address_mismatch`,
    );
  }
  return artifact;
}

function artifactDigestValue(
  value: unknown,
  label:
    | 'source_authority_request'
    | 'source_snapshot'
    | 'live_authoring_request',
): string {
  const object = recordValue(value);
  if (
    !object ||
    typeof object.digest !== 'string' ||
    !DIGEST_PATTERN.test(object.digest)
  ) {
    rejectVerification(`${label}_digest_invalid`);
  }
  return object.digest;
}

function exactCanonicalValue(
  actual: unknown,
  expected: unknown,
  reasonCode: string,
): void {
  let actualBytes: string;
  let expectedBytes: string;
  try {
    actualBytes = canonicalLiveAuthoringJsonBytes(actual);
    expectedBytes =
      canonicalLiveAuthoringJsonBytes(expected);
  } catch {
    rejectVerification('verification_json_domain_invalid');
  }
  if (actualBytes !== expectedBytes) {
    rejectVerification(reasonCode);
  }
}

function liveRequestPolicyReasonCodes(
  value: Record<string, unknown>,
): string[] {
  const reasons: string[] = [];
  const tokenBudget = recordValue(value.tokenBudget);
  const callBudget = recordValue(value.callBudget);
  const terminalReferenceCleanup = recordValue(
    callBudget?.terminalReferenceCleanup,
  );
  const costBudget = recordValue(value.costBudget);
  if (
    value.provider !== 'openai' ||
    value.endpoint !== 'responses' ||
    value.model !== 'gpt-5.6-sol' ||
    value.serviceTier !== 'default' ||
    value.reasoningEffort !== 'medium' ||
    value.noFallback !== true ||
    value.transportRetries !== 0 ||
    !tokenBudget ||
    !visualContractAuthoringStandardAttemptOutputBudgetIsValid(
      tokenBudget.standardAttempts,
    ) ||
    !callBudget ||
    callBudget.maxCalls !== 4 ||
    callBudget.maxRepairCount !== 3 ||
    callBudget.standardMaxCalls !== 3 ||
    callBudget.standardMaxRepairCount !== 2 ||
    !terminalReferenceCleanup ||
    terminalReferenceCleanup.budgetClass !==
      'terminal_reference_cleanup' ||
    terminalReferenceCleanup.maxCalls !== 1 ||
    terminalReferenceCleanup.maxRepairCount !== 1 ||
    terminalReferenceCleanup.maxInputTokens !== 6000 ||
    terminalReferenceCleanup.maxOutputTokens !== 2000 ||
    !Array.isArray(
      terminalReferenceCleanup.eligiblePrecedingRepairModes,
    ) ||
    terminalReferenceCleanup.eligiblePrecedingRepairModes.length !==
      2 ||
    terminalReferenceCleanup.eligiblePrecedingRepairModes[0] !==
      'book_surface_patch' ||
    terminalReferenceCleanup.eligiblePrecedingRepairModes[1] !==
      'full_draft' ||
    terminalReferenceCleanup.repairMode !==
      'page_spatial_reference_patch' ||
    terminalReferenceCleanup.residualFamily !==
      'draft_contract' ||
    terminalReferenceCleanup.residualCode !==
      'out_of_scope_reference'
  ) {
    reasons.push('live_authoring_request_policy_invalid');
  }
  if (
    !costBudget ||
    typeof costBudget.projectedMaxUsd !== 'number' ||
    !Number.isFinite(costBudget.projectedMaxUsd) ||
    costBudget.projectedMaxUsd < 0 ||
    costBudget.projectedMaxUsd > 4.99125 ||
    costBudget.hardCeilingUsd !== 5
  ) {
    reasons.push('live_authoring_request_cost_invalid');
  }
  return reasons;
}

function verifyCanonicalLiveRequestBundleUnsafe(args: {
  repoRoot: string;
  manifestPath: string;
}): CanonicalLiveRequestVerifiedResult {
  if (
    typeof args.repoRoot !== 'string' ||
    !path.isAbsolute(args.repoRoot)
  ) {
    rejectVerification('repository_root_invalid');
  }
  let repositoryRealPath: string;
  try {
    repositoryRealPath = canonicalRepositoryRealPath(
      args.repoRoot,
    );
  } catch {
    rejectVerification('repository_root_invalid');
  }
  if (
    !pathsEqual(path.resolve(args.repoRoot), repositoryRealPath)
  ) {
    rejectVerification('repository_root_alias_rejected');
  }

  const manifestArtifact =
    readCanonicalVerificationArtifact({
      repositoryRealPath,
      relativePath: args.manifestPath,
      label: 'manifest',
    });
  const manifestIssues =
    liveRequestMaterializationManifestIssues(
      manifestArtifact.value,
    );
  if (manifestIssues.length > 0) {
    rejectVerification(
      ...manifestVerificationReasonCodes(manifestIssues),
    );
  }
  const manifest =
    manifestArtifact.value as LiveRequestMaterializationManifest;
  if (
    manifest.repositoryRealPath !== repositoryRealPath
  ) {
    rejectVerification('manifest_repository_mismatch');
  }

  const outputRoots = [
    manifest.artifacts.sourceAuthorityRequest.path,
    manifest.artifacts.sourceSnapshot.path,
    manifest.artifacts.liveAuthoringRequest.path,
  ].map((artifactPath) =>
    path.posix.dirname(path.posix.dirname(artifactPath)),
  );
  if (
    new Set(outputRoots).size !== 1 ||
    outputRoots[0] === undefined
  ) {
    rejectVerification('artifact_root_mismatch');
  }
  const outputRoot = outputRoots[0];
  const expectedManifestPath = path.posix.join(
    outputRoot,
    'live-request-materializations',
    `${manifest.digest}.json`,
  );
  if (
    manifestArtifact.relativePath !== expectedManifestPath
  ) {
    rejectVerification('manifest_content_address_mismatch');
  }

  const sourceAuthorityArtifact =
    descriptorVerificationPath({
      repositoryRealPath,
      descriptor:
        manifest.artifacts.sourceAuthorityRequest,
      label: 'source_authority_request',
    });
  const snapshotArtifact = descriptorVerificationPath({
    repositoryRealPath,
    descriptor: manifest.artifacts.sourceSnapshot,
    label: 'source_snapshot',
  });
  const liveRequestArtifact =
    descriptorVerificationPath({
      repositoryRealPath,
      descriptor: manifest.artifacts.liveAuthoringRequest,
      label: 'live_authoring_request',
    });

  try {
    assertValidStorySourceAuthorityRequestArtifact(
      sourceAuthorityArtifact.value,
    );
  } catch {
    rejectVerification(
      'source_authority_request_schema_or_digest_invalid',
    );
  }
  const sourceAuthorityRequest =
    sourceAuthorityArtifact.value as StorySourceAuthorityRequestArtifact;
  if (
    sourceAuthorityRequest.digest !==
    manifest.artifacts.sourceAuthorityRequest.digest
  ) {
    rejectVerification(
      'source_authority_request_descriptor_mismatch',
    );
  }
  if (
    sourceAuthorityRequest.repoRoot !==
    repositoryRealPath
  ) {
    rejectVerification(
      'source_authority_request_repository_mismatch',
    );
  }
  exactCanonicalValue(
    sourceAuthorityRequest,
    buildStorySourceAuthorityRequestArtifact({
      repoRoot: repositoryRealPath,
      storyKey: sourceAuthorityRequest.storyKey,
      storyPath: sourceAuthorityRequest.storyPath,
    }),
    'source_authority_request_schema_or_digest_invalid',
  );

  let storyAbsolute: string;
  try {
    storyAbsolute = resolveCanonicalExistingFile({
      repositoryRealPath,
      relativePath: sourceAuthorityRequest.storyPath,
      label: 'verification_story_source_path',
    });
    assertAdjacentCoverPathSafe({
      repositoryRealPath,
      storyPath: sourceAuthorityRequest.storyPath,
    });
  } catch {
    rejectVerification(
      'story_source_missing_unsafe_or_unreadable',
    );
  }
  if (
    repoRelativePath(repositoryRealPath, storyAbsolute) !==
    sourceAuthorityRequest.storyPath
  ) {
    rejectVerification('story_source_path_not_canonical');
  }

  let snapshot: StorySourceAuthoritySnapshot;
  try {
    snapshot =
      snapshotArtifact.value as StorySourceAuthoritySnapshot;
    assertValidStorySourceAuthoritySnapshot(snapshot);
    assertSnapshotMaterializationComplete({
      snapshot,
      storyPath: sourceAuthorityRequest.storyPath,
    });
  } catch {
    rejectVerification(
      'source_snapshot_schema_or_digest_invalid',
    );
  }
  if (
    artifactDigestValue(
      snapshot,
      'source_snapshot',
    ) !== manifest.artifacts.sourceSnapshot.digest
  ) {
    rejectVerification('source_snapshot_descriptor_mismatch');
  }

  let rebuiltSnapshot: StorySourceAuthoritySnapshot;
  try {
    rebuiltSnapshot = buildStorySourceAuthoritySnapshot({
      repoRoot: repositoryRealPath,
      storyKey: sourceAuthorityRequest.storyKey,
      storyPath: sourceAuthorityRequest.storyPath,
    });
    assertSnapshotMaterializationComplete({
      snapshot: rebuiltSnapshot,
      storyPath: sourceAuthorityRequest.storyPath,
    });
  } catch {
    rejectVerification('story_source_rebuild_failed');
  }
  exactCanonicalValue(
    snapshot,
    rebuiltSnapshot,
    'source_snapshot_current_story_mismatch',
  );

  const liveRequestObject = recordValue(
    liveRequestArtifact.value,
  );
  if (!liveRequestObject) {
    rejectVerification(
      'live_authoring_request_schema_invalid',
    );
  }
  if (liveRequestObject.mode !== 'live') {
    rejectVerification('live_authoring_request_mode_invalid');
  }
  const policyReasons =
    liveRequestPolicyReasonCodes(liveRequestObject);
  if (policyReasons.length > 0) {
    rejectVerification(...policyReasons);
  }
  if (
    typeof liveRequestObject.requestId !== 'string' ||
    typeof liveRequestObject.requestedAt !== 'string'
  ) {
    rejectVerification(
      'live_authoring_request_schema_invalid',
    );
  }
  const {
    digestAlgorithm: _requestDigestAlgorithm,
    digest: claimedLiveRequestDigest,
    ...liveRequestPayload
  } = liveRequestObject;
  if (
    _requestDigestAlgorithm !== 'canonical-json-sha256' ||
    typeof claimedLiveRequestDigest !== 'string' ||
    !DIGEST_PATTERN.test(claimedLiveRequestDigest)
  ) {
    rejectVerification(
      'live_authoring_request_digest_invalid',
    );
  }
  let observedLiveRequestDigest: string;
  try {
    observedLiveRequestDigest = canonicalJsonDigest(
      liveRequestPayload,
    );
  } catch {
    rejectVerification(
      'live_authoring_request_json_domain_invalid',
    );
  }
  if (
    claimedLiveRequestDigest !== observedLiveRequestDigest
  ) {
    rejectVerification(
      'live_authoring_request_digest_invalid',
    );
  }
  if (
    claimedLiveRequestDigest !==
    manifest.artifacts.liveAuthoringRequest.digest
  ) {
    rejectVerification(
      'live_authoring_request_descriptor_mismatch',
    );
  }

  let rebuiltLiveRequest: VisualContractAuthoringRequest;
  try {
    rebuiltLiveRequest =
      buildVisualContractAuthoringRequest({
        snapshot: rebuiltSnapshot,
        mode: 'live',
        requestId: liveRequestObject.requestId,
        requestedAt: liveRequestObject.requestedAt,
      });
  } catch {
    rejectVerification(
      'live_authoring_request_schema_invalid',
    );
  }
  exactCanonicalValue(
    liveRequestArtifact.value,
    rebuiltLiveRequest,
    'live_authoring_request_not_canonical_current_policy',
  );
  let liveRequestIssues: string[];
  try {
    liveRequestIssues =
      visualContractAuthoringRequestIssues({
        request:
          liveRequestArtifact.value as VisualContractAuthoringRequest,
        snapshot: rebuiltSnapshot,
      });
  } catch {
    rejectVerification(
      'live_authoring_request_schema_invalid',
    );
  }
  if (liveRequestIssues.length > 0) {
    rejectVerification(
      'live_authoring_request_not_canonical_current_policy',
    );
  }

  const expectedStructuredOutputCompatibility = {
    schemaName:
      rebuiltLiveRequest.structuredOutput.schemaName,
    schemaVersion:
      rebuiltLiveRequest.structuredOutput.schemaVersion,
    schemaDigest:
      rebuiltLiveRequest.structuredOutput.schemaDigest,
    compatibility: {
      profileVersion:
        rebuiltLiveRequest.structuredOutput
          .compatibilityProfileVersion,
      profileDigest:
        rebuiltLiveRequest.structuredOutput
          .compatibilityProfileDigest,
      evidenceVersion:
        rebuiltLiveRequest.structuredOutput
          .compatibilityEvidenceVersion,
      evidenceDigest:
        rebuiltLiveRequest.structuredOutput
          .compatibilityEvidenceDigest,
      status:
        rebuiltLiveRequest.structuredOutput
          .compatibilityStatus,
      serializedSchemaDigest:
        rebuiltLiveRequest.structuredOutput
          .serializedSchemaDigest,
    },
  } satisfies LiveRequestStructuredOutputCompatibilityAuthority;
  exactCanonicalValue(
    manifest.structuredOutputCompatibility,
    expectedStructuredOutputCompatibility,
    'manifest_structured_output_compatibility_invalid',
  );
  const expectedCompactRepairStructuredOutputCompatibility = {
    schemaName:
      rebuiltLiveRequest.compactRepairStructuredOutput.schemaName,
    schemaVersion:
      rebuiltLiveRequest.compactRepairStructuredOutput.schemaVersion,
    schemaDigest:
      rebuiltLiveRequest.compactRepairStructuredOutput.schemaDigest,
    compatibility: {
      profileVersion:
        rebuiltLiveRequest.compactRepairStructuredOutput
          .compatibilityProfileVersion,
      profileDigest:
        rebuiltLiveRequest.compactRepairStructuredOutput
          .compatibilityProfileDigest,
      evidenceVersion:
        rebuiltLiveRequest.compactRepairStructuredOutput
          .compatibilityEvidenceVersion,
      evidenceDigest:
        rebuiltLiveRequest.compactRepairStructuredOutput
          .compatibilityEvidenceDigest,
      status:
        rebuiltLiveRequest.compactRepairStructuredOutput
          .compatibilityStatus,
      serializedSchemaDigest:
        rebuiltLiveRequest.compactRepairStructuredOutput
          .serializedSchemaDigest,
    },
  } satisfies LiveRequestStructuredOutputCompatibilityAuthority;
  exactCanonicalValue(
    manifest.compactRepairStructuredOutputCompatibility,
    expectedCompactRepairStructuredOutputCompatibility,
    'manifest_compact_repair_structured_output_compatibility_invalid',
  );
  const expectedPageContractRepairStructuredOutputCompatibility = {
    schemaName:
      rebuiltLiveRequest.pageContractRepairStructuredOutput.schemaName,
    schemaVersion:
      rebuiltLiveRequest.pageContractRepairStructuredOutput.schemaVersion,
    schemaDigest:
      rebuiltLiveRequest.pageContractRepairStructuredOutput.schemaDigest,
    compatibility: {
      profileVersion:
        rebuiltLiveRequest.pageContractRepairStructuredOutput
          .compatibilityProfileVersion,
      profileDigest:
        rebuiltLiveRequest.pageContractRepairStructuredOutput
          .compatibilityProfileDigest,
      evidenceVersion:
        rebuiltLiveRequest.pageContractRepairStructuredOutput
          .compatibilityEvidenceVersion,
      evidenceDigest:
        rebuiltLiveRequest.pageContractRepairStructuredOutput
          .compatibilityEvidenceDigest,
      status:
        rebuiltLiveRequest.pageContractRepairStructuredOutput
          .compatibilityStatus,
      serializedSchemaDigest:
        rebuiltLiveRequest.pageContractRepairStructuredOutput
          .serializedSchemaDigest,
    },
  } satisfies LiveRequestStructuredOutputCompatibilityAuthority;
  exactCanonicalValue(
    manifest.pageContractRepairStructuredOutputCompatibility,
    expectedPageContractRepairStructuredOutputCompatibility,
    'manifest_page_contract_repair_structured_output_compatibility_invalid',
  );
  const expectedPageSpatialReferenceRepairStructuredOutputCompatibility = {
    schemaName:
      rebuiltLiveRequest.pageSpatialReferenceRepairStructuredOutput.schemaName,
    schemaVersion:
      rebuiltLiveRequest.pageSpatialReferenceRepairStructuredOutput.schemaVersion,
    schemaDigest:
      rebuiltLiveRequest.pageSpatialReferenceRepairStructuredOutput.schemaDigest,
    compatibility: {
      profileVersion:
        rebuiltLiveRequest.pageSpatialReferenceRepairStructuredOutput
          .compatibilityProfileVersion,
      profileDigest:
        rebuiltLiveRequest.pageSpatialReferenceRepairStructuredOutput
          .compatibilityProfileDigest,
      evidenceVersion:
        rebuiltLiveRequest.pageSpatialReferenceRepairStructuredOutput
          .compatibilityEvidenceVersion,
      evidenceDigest:
        rebuiltLiveRequest.pageSpatialReferenceRepairStructuredOutput
          .compatibilityEvidenceDigest,
      status:
        rebuiltLiveRequest.pageSpatialReferenceRepairStructuredOutput
          .compatibilityStatus,
      serializedSchemaDigest:
        rebuiltLiveRequest.pageSpatialReferenceRepairStructuredOutput
          .serializedSchemaDigest,
    },
  } satisfies LiveRequestStructuredOutputCompatibilityAuthority;
  exactCanonicalValue(
    manifest.pageSpatialReferenceRepairStructuredOutputCompatibility,
    expectedPageSpatialReferenceRepairStructuredOutputCompatibility,
    'manifest_page_spatial_reference_repair_structured_output_compatibility_invalid',
  );
  const expectedStructuralBundleRepairStructuredOutputCompatibility = {
    schemaName:
      rebuiltLiveRequest.structuralBundleRepairStructuredOutput.schemaName,
    schemaVersion:
      rebuiltLiveRequest.structuralBundleRepairStructuredOutput.schemaVersion,
    schemaDigest:
      rebuiltLiveRequest.structuralBundleRepairStructuredOutput.schemaDigest,
    compatibility: {
      profileVersion:
        rebuiltLiveRequest.structuralBundleRepairStructuredOutput
          .compatibilityProfileVersion,
      profileDigest:
        rebuiltLiveRequest.structuralBundleRepairStructuredOutput
          .compatibilityProfileDigest,
      evidenceVersion:
        rebuiltLiveRequest.structuralBundleRepairStructuredOutput
          .compatibilityEvidenceVersion,
      evidenceDigest:
        rebuiltLiveRequest.structuralBundleRepairStructuredOutput
          .compatibilityEvidenceDigest,
      status:
        rebuiltLiveRequest.structuralBundleRepairStructuredOutput
          .compatibilityStatus,
      serializedSchemaDigest:
        rebuiltLiveRequest.structuralBundleRepairStructuredOutput
          .serializedSchemaDigest,
    },
  } satisfies LiveRequestStructuredOutputCompatibilityAuthority;
  exactCanonicalValue(
    manifest.structuralBundleRepairStructuredOutputCompatibility,
    expectedStructuralBundleRepairStructuredOutputCompatibility,
    'manifest_structural_bundle_repair_structured_output_compatibility_invalid',
  );
  const expectedBookSurfaceRepairStructuredOutputCompatibility = {
    schemaName:
      rebuiltLiveRequest.bookSurfaceRepairStructuredOutput.schemaName,
    schemaVersion:
      rebuiltLiveRequest.bookSurfaceRepairStructuredOutput.schemaVersion,
    schemaDigest:
      rebuiltLiveRequest.bookSurfaceRepairStructuredOutput.schemaDigest,
    compatibility: {
      profileVersion:
        rebuiltLiveRequest.bookSurfaceRepairStructuredOutput
          .compatibilityProfileVersion,
      profileDigest:
        rebuiltLiveRequest.bookSurfaceRepairStructuredOutput
          .compatibilityProfileDigest,
      evidenceVersion:
        rebuiltLiveRequest.bookSurfaceRepairStructuredOutput
          .compatibilityEvidenceVersion,
      evidenceDigest:
        rebuiltLiveRequest.bookSurfaceRepairStructuredOutput
          .compatibilityEvidenceDigest,
      status:
        rebuiltLiveRequest.bookSurfaceRepairStructuredOutput
          .compatibilityStatus,
      serializedSchemaDigest:
        rebuiltLiveRequest.bookSurfaceRepairStructuredOutput
          .serializedSchemaDigest,
    },
  } satisfies LiveRequestStructuredOutputCompatibilityAuthority;
  exactCanonicalValue(
    manifest.bookSurfaceRepairStructuredOutputCompatibility,
    expectedBookSurfaceRepairStructuredOutputCompatibility,
    'manifest_book_surface_repair_structured_output_compatibility_invalid',
  );
  const expectedPresentationRequirementRepairStructuredOutputCompatibility = {
    schemaName:
      rebuiltLiveRequest.presentationRequirementRepairStructuredOutput.schemaName,
    schemaVersion:
      rebuiltLiveRequest.presentationRequirementRepairStructuredOutput.schemaVersion,
    schemaDigest:
      rebuiltLiveRequest.presentationRequirementRepairStructuredOutput.schemaDigest,
    compatibility: {
      profileVersion:
        rebuiltLiveRequest.presentationRequirementRepairStructuredOutput
          .compatibilityProfileVersion,
      profileDigest:
        rebuiltLiveRequest.presentationRequirementRepairStructuredOutput
          .compatibilityProfileDigest,
      evidenceVersion:
        rebuiltLiveRequest.presentationRequirementRepairStructuredOutput
          .compatibilityEvidenceVersion,
      evidenceDigest:
        rebuiltLiveRequest.presentationRequirementRepairStructuredOutput
          .compatibilityEvidenceDigest,
      status:
        rebuiltLiveRequest.presentationRequirementRepairStructuredOutput
          .compatibilityStatus,
      serializedSchemaDigest:
        rebuiltLiveRequest.presentationRequirementRepairStructuredOutput
          .serializedSchemaDigest,
    },
  } satisfies LiveRequestStructuredOutputCompatibilityAuthority;
  exactCanonicalValue(
    manifest.presentationRequirementRepairStructuredOutputCompatibility,
    expectedPresentationRequirementRepairStructuredOutputCompatibility,
    'manifest_presentation_requirement_repair_structured_output_compatibility_invalid',
  );
  const expectedStablePropScopeRepairStructuredOutputCompatibility = {
    schemaName:
      rebuiltLiveRequest.stablePropScopeRepairStructuredOutput.schemaName,
    schemaVersion:
      rebuiltLiveRequest.stablePropScopeRepairStructuredOutput.schemaVersion,
    schemaDigest:
      rebuiltLiveRequest.stablePropScopeRepairStructuredOutput.schemaDigest,
    compatibility: {
      profileVersion:
        rebuiltLiveRequest.stablePropScopeRepairStructuredOutput
          .compatibilityProfileVersion,
      profileDigest:
        rebuiltLiveRequest.stablePropScopeRepairStructuredOutput
          .compatibilityProfileDigest,
      evidenceVersion:
        rebuiltLiveRequest.stablePropScopeRepairStructuredOutput
          .compatibilityEvidenceVersion,
      evidenceDigest:
        rebuiltLiveRequest.stablePropScopeRepairStructuredOutput
          .compatibilityEvidenceDigest,
      status:
        rebuiltLiveRequest.stablePropScopeRepairStructuredOutput
          .compatibilityStatus,
      serializedSchemaDigest:
        rebuiltLiveRequest.stablePropScopeRepairStructuredOutput
          .serializedSchemaDigest,
    },
  } satisfies LiveRequestStructuredOutputCompatibilityAuthority;
  exactCanonicalValue(
    manifest.stablePropScopeRepairStructuredOutputCompatibility,
    expectedStablePropScopeRepairStructuredOutputCompatibility,
    'manifest_stable_prop_scope_repair_structured_output_compatibility_invalid',
  );
  const expectedRequestPolicy =
    canonicalLiveRequestPolicyAuthority(
      rebuiltLiveRequest,
    );
  exactCanonicalValue(
    manifest.requestPolicy,
    expectedRequestPolicy,
    'manifest_request_policy_invalid',
  );
  if (
    liveRequestPolicyAuthorityIssues(
      manifest.requestPolicy,
      'manifest_request_policy',
    ).length > 0
  ) {
    rejectVerification('manifest_request_policy_invalid');
  }

  const expectedSourceRevision = {
    storyKey: rebuiltSnapshot.content.storyKey,
    sourceIdentityVersion:
      rebuiltSnapshot.content.sourceIdentity.version,
    storyPath:
      rebuiltSnapshot.content.sourceIdentity.path,
    normalizedSourceDigest:
      rebuiltSnapshot.content.sourceIdentity.digest,
    pageCount:
      rebuiltSnapshot.content.sourceIdentity.pageCount,
    pageNumbers:
      rebuiltSnapshot.content.sourceIdentity.pageNumbers,
    sourceSnapshotDigest: rebuiltSnapshot.digest,
    authoredCoverAuthorityPresent:
      rebuiltSnapshot.content.authoredCoverAuthority !== null,
    sourceEvidenceCatalogVersion:
      rebuiltSnapshot.content.sourceEvidenceCatalog.version,
    sourceEvidenceCatalogDigest:
      rebuiltSnapshot.content.sourceEvidenceCatalog.digest,
    sourceEvidenceCatalogEntryCount:
      rebuiltSnapshot.content.sourceEvidenceCatalog.entries.length,
  };
  exactCanonicalValue(
    manifest.sourceRevision,
    expectedSourceRevision,
    'manifest_source_revision_mismatch',
  );
  if (
    manifest.requestId !== rebuiltLiveRequest.requestId ||
    manifest.requestedAt !==
      rebuiltLiveRequest.requestedAt ||
    sourceAuthorityRequest.storyKey !==
      rebuiltSnapshot.content.storyKey ||
    sourceAuthorityRequest.storyPath !==
      rebuiltSnapshot.content.sourceIdentity.path
  ) {
    rejectVerification('manifest_linkage_invalid');
  }

  const expectedFutureLiveArguments = [
    'scripts/visual-contract-authoring.cjs',
    'live',
    '--repo-root',
    repositoryRealPath,
    '--source-authority-request',
    manifest.artifacts.sourceAuthorityRequest.path,
    '--snapshot',
    manifest.artifacts.sourceSnapshot.path,
    '--request',
    manifest.artifacts.liveAuthoringRequest.path,
    '--out',
    outputRoot,
  ];
  if (
    manifest.futureLiveCommand.executable !== 'node' ||
    JSON.stringify(
      manifest.futureLiveCommand.arguments,
    ) !== JSON.stringify(expectedFutureLiveArguments)
  ) {
    rejectVerification('future_live_command_invalid');
  }

  return {
    version: CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
    status: 'verified',
    zeroWrite: true,
    identities: {
      manifestDigest: manifest.digest,
      sourceAuthorityRequestDigest:
        sourceAuthorityRequest.digest,
      sourceSnapshotDigest: rebuiltSnapshot.digest,
      normalizedSourceDigest:
        rebuiltSnapshot.content.sourceIdentity.digest,
      liveAuthoringRequestDigest:
        rebuiltLiveRequest.digest,
      requestId: rebuiltLiveRequest.requestId,
      storyKey: rebuiltSnapshot.content.storyKey,
    },
    structuredOutputCompatibility:
      expectedStructuredOutputCompatibility,
    compactRepairStructuredOutputCompatibility:
      expectedCompactRepairStructuredOutputCompatibility,
    pageContractRepairStructuredOutputCompatibility:
      expectedPageContractRepairStructuredOutputCompatibility,
    pageSpatialReferenceRepairStructuredOutputCompatibility:
      expectedPageSpatialReferenceRepairStructuredOutputCompatibility,
    structuralBundleRepairStructuredOutputCompatibility:
      expectedStructuralBundleRepairStructuredOutputCompatibility,
    bookSurfaceRepairStructuredOutputCompatibility:
      expectedBookSurfaceRepairStructuredOutputCompatibility,
    presentationRequirementRepairStructuredOutputCompatibility:
      expectedPresentationRequirementRepairStructuredOutputCompatibility,
    stablePropScopeRepairStructuredOutputCompatibility:
      expectedStablePropScopeRepairStructuredOutputCompatibility,
    requestPolicy: expectedRequestPolicy,
    externalBoundaryEvidence: {
      credentialReadOrCheck: false,
      providerReachabilityCheck: false,
      pricingLookup: false,
      providerCalls: 0,
      modelCalls: 0,
    },
  };
}

export function verifyCanonicalLiveRequestBundle(args: {
  repoRoot: string;
  manifestPath: string;
}): CanonicalLiveRequestVerificationResult {
  try {
    return verifyCanonicalLiveRequestBundleUnsafe(args);
  } catch (error) {
    if (
      error instanceof
      CanonicalLiveRequestVerificationFailure
    ) {
      return rejectedVerificationResult(error.reasonCodes);
    }
    return rejectedVerificationResult([
      'verification_internal_failure',
    ]);
  }
}
