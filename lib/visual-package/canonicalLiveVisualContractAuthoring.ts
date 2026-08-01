import fs from 'node:fs';
import path from 'node:path';

import {
  canonicalJsonDigest,
  resolveRepoPath,
} from './integrity';
import {
  createCanonicalLiveAuthoringArtifactStore,
  type CanonicalLiveAuthoringArtifactStore,
} from './canonicalLiveAuthoringArtifacts';
import {
  CanonicalJsonDomainError,
  canonicalContentAddressedJsonBytes,
} from './canonicalContentAddressedJson';
import {
  createOpenAIResponsesVisualContractAuthoringAdapter,
} from './openaiResponsesVisualContractAuthoringAdapter';
import {
  assertValidStorySourceAuthoritySnapshot,
  buildStorySourceAuthoritySnapshot,
  type StorySourceAuthorityRequest,
  type StorySourceAuthoritySnapshot,
} from './storySourceAuthority';
import {
  OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
  VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION,
  buildVisualContractCandidateArtifact,
  buildVisualContractAuthoringReadinessEvidence,
  buildVisualContractAuthoringRequest,
  runVisualContractAuthoring,
  visualContractAuthoringRequestIssues,
  type VisualContractAuthoringArtifactWrite,
  type VisualContractAuthoringProvider,
  type VisualContractAuthoringRequest,
} from './visualContractAuthoringLifecycle';

export const CANONICAL_LIVE_AUTHORING_INTERRUPTION_LIMITATION =
  'The exact source snapshot and approved live request are durable before provider reachability, but forced process termination or disk failure during or immediately after a provider request can still occur before the in-memory sanitized receipt is durable; no automatic rerun or resume authority exists, and any later action must reconcile provider-side evidence first.';
export const CANONICAL_LIVE_REJECTED_REQUEST_EVIDENCE_VERSION =
  'canonical-live-rejected-request-evidence/v1' as const;

export interface CanonicalLiveVisualContractAuthoringInput {
  repoRoot: string;
  sourceAuthorityRequestPath: string;
  snapshotPath: string;
  requestPath: string;
  outputDir: string;
}

export interface CanonicalLiveVisualContractAuthoringDeps {
  provider?: VisualContractAuthoringProvider;
  providerFactory?: () => VisualContractAuthoringProvider;
  artifactStoreFactory?: (args: {
    repoRoot: string;
    repositoryRealPath: string;
    outputDir: string;
  }) => CanonicalLiveAuthoringArtifactStore;
}

export interface CanonicalLiveVisualContractAuthoringResult {
  mode: 'canonical_visual_contract_live_authoring';
  status: 'completed' | 'failed';
  receipt: Awaited<
    ReturnType<typeof runVisualContractAuthoring>
  >['receipt'];
  readiness: ReturnType<
    typeof buildVisualContractAuthoringReadinessEvidence
  >;
  persistence: {
    sourceSnapshot: VisualContractAuthoringArtifactWrite | null;
    authoringRequest: VisualContractAuthoringArtifactWrite;
    authoringRequestKind:
      | 'approved_live_request'
      | 'rejected_request_evidence';
    authoringReceipt: VisualContractAuthoringArtifactWrite;
    providerFailureEvidence:
      | VisualContractAuthoringArtifactWrite
      | null;
    readiness: VisualContractAuthoringArtifactWrite;
    candidate: VisualContractAuthoringArtifactWrite | null;
  };
  processInterruptionLimitation: string;
}

function objectValue(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function readJsonArtifact(
  repoRoot: string,
  relativePath: string,
  label: string,
): unknown {
  const absolute = resolveRepoPath(repoRoot, relativePath);
  try {
    return JSON.parse(
      fs.readFileSync(absolute, 'utf8'),
    ) as unknown;
  } catch {
    throw new Error(`${label} is missing or invalid JSON`);
  }
}

function sourceAuthorityRequestValue(
  value: unknown,
): StorySourceAuthorityRequest {
  const object = objectValue(
    value,
    'source authority request',
  );
  for (const field of [
    'repoRoot',
    'storyKey',
    'storyPath',
  ] as const) {
    if (
      typeof object[field] !== 'string' ||
      !object[field].trim()
    ) {
      throw new Error(
        `source authority request ${field} must be a non-empty string`,
      );
    }
  }
  return {
    repoRoot: object.repoRoot as string,
    storyKey: object.storyKey as string,
    storyPath: object.storyPath as string,
  };
}

function snapshotValue(
  value: unknown,
): StorySourceAuthoritySnapshot {
  const object = objectValue(
    value,
    'source authority snapshot',
  );
  objectValue(
    object.content,
    'source authority snapshot content',
  );
  if (
    typeof object.version !== 'string' ||
    typeof object.digestAlgorithm !== 'string' ||
    typeof object.digest !== 'string'
  ) {
    throw new Error(
      'source authority snapshot has an incomplete envelope',
    );
  }
  return value as StorySourceAuthoritySnapshot;
}

function authoringRequestValue(
  value: Record<string, unknown>,
): VisualContractAuthoringRequest {
  const object = value;
  const structuredOutput = objectValue(
    object.structuredOutput,
    'visual contract authoring request structuredOutput',
  );
  const compactRepairStructuredOutput = objectValue(
    object.compactRepairStructuredOutput,
    'visual contract authoring request compactRepairStructuredOutput',
  );
  const tokenBudget = objectValue(
    object.tokenBudget,
    'visual contract authoring request tokenBudget',
  );
  const callBudget = objectValue(
    object.callBudget,
    'visual contract authoring request callBudget',
  );
  const pricing = objectValue(
    object.pricing,
    'visual contract authoring request pricing',
  );
  const costBudget = objectValue(
    object.costBudget,
    'visual contract authoring request costBudget',
  );
  const promptDigests = objectValue(
    object.promptDigests,
    'visual contract authoring request promptDigests',
  );
  const promptAuthority = objectValue(
    object.promptAuthority,
    'visual contract authoring request promptAuthority',
  );
  const initialPromptAuthority = objectValue(
    promptAuthority.initial,
    'visual contract authoring request initial promptAuthority',
  );
  const repairPromptAuthority = objectValue(
    promptAuthority.repair,
    'visual contract authoring request repair promptAuthority',
  );
  const sourceEvidenceIdRepairPromptAuthority = objectValue(
    promptAuthority.sourceEvidenceIdRepair,
    'visual contract authoring request sourceEvidenceIdRepair promptAuthority',
  );
  const actionSemanticAuthority = objectValue(
    object.actionSemanticAuthority,
    'visual contract authoring request actionSemanticAuthority',
  );
  for (const field of [
    'version',
    'mode',
    'requestId',
    'requestedAt',
    'sourceSnapshotDigest',
    'provider',
    'endpoint',
    'model',
    'serviceTier',
    'digestAlgorithm',
    'digest',
  ]) {
    if (typeof object[field] !== 'string') {
      throw new Error(
        `visual contract authoring request ${field} must be a string`,
      );
    }
  }
  // Reconstruct only the schema-owned fields. Unknown caller input remains a
  // deterministic rejection reason and can never enter persisted evidence.
  return {
    version: object.version,
    policyVersion: object.policyVersion,
    mode: object.mode,
    requestId: object.requestId,
    requestedAt: object.requestedAt,
    sourceSnapshotDigest: object.sourceSnapshotDigest,
    provider: object.provider,
    endpoint: object.endpoint,
    model: object.model,
    serviceTier: object.serviceTier,
    reasoningEffort: object.reasoningEffort,
    structuredOutput: {
      strict: structuredOutput.strict,
      schemaName: structuredOutput.schemaName,
      schemaVersion: structuredOutput.schemaVersion,
      schemaDigest: structuredOutput.schemaDigest,
      compatibilityProfileVersion:
        structuredOutput.compatibilityProfileVersion,
      compatibilityProfileDigest:
        structuredOutput.compatibilityProfileDigest,
      compatibilityEvidenceVersion:
        structuredOutput.compatibilityEvidenceVersion,
      compatibilityEvidenceDigest:
        structuredOutput.compatibilityEvidenceDigest,
      compatibilityStatus:
        structuredOutput.compatibilityStatus,
      serializedSchemaDigest:
        structuredOutput.serializedSchemaDigest,
    },
    compactRepairStructuredOutput: {
      strict: compactRepairStructuredOutput.strict,
      schemaName: compactRepairStructuredOutput.schemaName,
      schemaVersion:
        compactRepairStructuredOutput.schemaVersion,
      schemaDigest: compactRepairStructuredOutput.schemaDigest,
      compatibilityProfileVersion:
        compactRepairStructuredOutput.compatibilityProfileVersion,
      compatibilityProfileDigest:
        compactRepairStructuredOutput.compatibilityProfileDigest,
      compatibilityEvidenceVersion:
        compactRepairStructuredOutput.compatibilityEvidenceVersion,
      compatibilityEvidenceDigest:
        compactRepairStructuredOutput.compatibilityEvidenceDigest,
      compatibilityStatus:
        compactRepairStructuredOutput.compatibilityStatus,
      serializedSchemaDigest:
        compactRepairStructuredOutput.serializedSchemaDigest,
    },
    toolsDisabled: object.toolsDisabled,
    noFallback: object.noFallback,
    transportRetries: object.transportRetries,
    timeoutMs: object.timeoutMs,
    tokenBudget: {
      maxInputTokens: tokenBudget.maxInputTokens,
      promptAndSchemaTokenUpperBound:
        tokenBudget.promptAndSchemaTokenUpperBound,
      maxOutputTokens: tokenBudget.maxOutputTokens,
      outputIncludesReasoning:
        tokenBudget.outputIncludesReasoning,
    },
    callBudget: {
      maxCalls: callBudget.maxCalls,
      maxRepairCount: callBudget.maxRepairCount,
    },
    pricing: {
      version: pricing.version,
      currency: pricing.currency,
      unitTokens: pricing.unitTokens,
      uncachedInputUsdPerUnit:
        pricing.uncachedInputUsdPerUnit,
      cacheWriteInputUsdPerUnit:
        pricing.cacheWriteInputUsdPerUnit,
      cachedInputUsdPerUnit:
        pricing.cachedInputUsdPerUnit,
      outputUsdPerUnit: pricing.outputUsdPerUnit,
      regionalUpliftMultiplier:
        pricing.regionalUpliftMultiplier,
      source: pricing.source,
    },
    pricingDigest: object.pricingDigest,
    costBudget: {
      projectedMaxUsd: costBudget.projectedMaxUsd,
      hardCeilingUsd: costBudget.hardCeilingUsd,
    },
    promptDigests: {
      system: promptDigests.system,
      user: promptDigests.user,
    },
    promptAuthority: {
      initial: {
        systemPromptVersion:
          initialPromptAuthority.systemPromptVersion,
        userPromptVersion:
          initialPromptAuthority.userPromptVersion,
        systemPromptDigest:
          initialPromptAuthority.systemPromptDigest,
        userPromptDigest:
          initialPromptAuthority.userPromptDigest,
      },
      repair: {
        systemPromptVersion:
          repairPromptAuthority.systemPromptVersion,
        userPromptVersion:
          repairPromptAuthority.userPromptVersion,
        systemPromptDigest:
          repairPromptAuthority.systemPromptDigest,
      },
      sourceEvidenceIdRepair: {
        systemPromptVersion:
          sourceEvidenceIdRepairPromptAuthority.systemPromptVersion,
        userPromptVersion:
          sourceEvidenceIdRepairPromptAuthority.userPromptVersion,
        systemPromptDigest:
          sourceEvidenceIdRepairPromptAuthority.systemPromptDigest,
      },
    },
    actionSemanticAuthority: {
      catalogVersion:
        actionSemanticAuthority.catalogVersion,
      catalogDigest:
        actionSemanticAuthority.catalogDigest,
      coverageVersion:
        actionSemanticAuthority.coverageVersion,
      sourceEvidenceCatalogVersion:
        actionSemanticAuthority.sourceEvidenceCatalogVersion,
      sourceEvidenceCatalogDigest:
        actionSemanticAuthority.sourceEvidenceCatalogDigest,
    },
    digestAlgorithm: object.digestAlgorithm,
    digest: object.digest,
  } as VisualContractAuthoringRequest;
}

const REQUEST_KEYS = new Set([
  'version',
  'policyVersion',
  'mode',
  'requestId',
  'requestedAt',
  'sourceSnapshotDigest',
  'provider',
  'endpoint',
  'model',
  'serviceTier',
  'reasoningEffort',
  'structuredOutput',
  'compactRepairStructuredOutput',
  'toolsDisabled',
  'noFallback',
  'transportRetries',
  'timeoutMs',
  'tokenBudget',
  'callBudget',
  'pricing',
  'pricingDigest',
  'costBudget',
  'promptDigests',
  'promptAuthority',
  'actionSemanticAuthority',
  'digestAlgorithm',
  'digest',
]);

const REQUEST_NESTED_KEYS: Record<string, Set<string>> = {
  structuredOutput: new Set([
    'strict',
    'schemaName',
    'schemaVersion',
    'schemaDigest',
    'compatibilityProfileVersion',
    'compatibilityProfileDigest',
    'compatibilityEvidenceVersion',
    'compatibilityEvidenceDigest',
    'compatibilityStatus',
    'serializedSchemaDigest',
  ]),
  compactRepairStructuredOutput: new Set([
    'strict',
    'schemaName',
    'schemaVersion',
    'schemaDigest',
    'compatibilityProfileVersion',
    'compatibilityProfileDigest',
    'compatibilityEvidenceVersion',
    'compatibilityEvidenceDigest',
    'compatibilityStatus',
    'serializedSchemaDigest',
  ]),
  tokenBudget: new Set([
    'maxInputTokens',
    'promptAndSchemaTokenUpperBound',
    'maxOutputTokens',
    'outputIncludesReasoning',
  ]),
  callBudget: new Set(['maxCalls', 'maxRepairCount']),
  pricing: new Set([
    'version',
    'currency',
    'unitTokens',
    'uncachedInputUsdPerUnit',
    'cacheWriteInputUsdPerUnit',
    'cachedInputUsdPerUnit',
    'outputUsdPerUnit',
    'regionalUpliftMultiplier',
    'source',
  ]),
  costBudget: new Set([
    'projectedMaxUsd',
    'hardCeilingUsd',
  ]),
  promptDigests: new Set(['system', 'user']),
  promptAuthority: new Set([
    'initial',
    'repair',
    'sourceEvidenceIdRepair',
  ]),
  actionSemanticAuthority: new Set([
    'catalogVersion',
    'catalogDigest',
    'coverageVersion',
    'sourceEvidenceCatalogVersion',
    'sourceEvidenceCatalogDigest',
  ]),
};

const REQUEST_TOP_LEVEL_FIELDS = {
  version: 'string',
  policyVersion: 'string',
  mode: 'string',
  requestId: 'string',
  requestedAt: 'string',
  sourceSnapshotDigest: 'string',
  provider: 'string',
  endpoint: 'string',
  model: 'string',
  serviceTier: 'string',
  reasoningEffort: 'string',
  toolsDisabled: 'boolean',
  noFallback: 'boolean',
  transportRetries: 'number',
  timeoutMs: 'number',
  pricingDigest: 'string',
  digestAlgorithm: 'string',
  digest: 'string',
} as const;

const REQUEST_OBJECT_FIELDS = {
  structuredOutput: {
    strict: 'boolean',
    schemaName: 'string',
    schemaVersion: 'string',
    schemaDigest: 'string',
    compatibilityProfileVersion: 'string',
    compatibilityProfileDigest: 'string',
    compatibilityEvidenceVersion: 'string',
    compatibilityEvidenceDigest: 'string',
    compatibilityStatus: 'string',
    serializedSchemaDigest: 'string',
  },
  compactRepairStructuredOutput: {
    strict: 'boolean',
    schemaName: 'string',
    schemaVersion: 'string',
    schemaDigest: 'string',
    compatibilityProfileVersion: 'string',
    compatibilityProfileDigest: 'string',
    compatibilityEvidenceVersion: 'string',
    compatibilityEvidenceDigest: 'string',
    compatibilityStatus: 'string',
    serializedSchemaDigest: 'string',
  },
  tokenBudget: {
    maxInputTokens: 'number',
    promptAndSchemaTokenUpperBound: 'number',
    maxOutputTokens: 'number',
    outputIncludesReasoning: 'boolean',
  },
  callBudget: {
    maxCalls: 'number',
    maxRepairCount: 'number',
  },
  pricing: {
    version: 'string',
    currency: 'string',
    unitTokens: 'number',
    uncachedInputUsdPerUnit: 'number',
    cacheWriteInputUsdPerUnit: 'number',
    cachedInputUsdPerUnit: 'number',
    outputUsdPerUnit: 'number',
    regionalUpliftMultiplier: 'number',
    source: 'string',
  },
  costBudget: {
    projectedMaxUsd: 'number',
    hardCeilingUsd: 'number',
  },
  promptDigests: {
    system: 'string',
    user: 'string',
  },
  actionSemanticAuthority: {
    catalogVersion: 'string',
    catalogDigest: 'string',
    coverageVersion: 'string',
    sourceEvidenceCatalogVersion: 'string',
    sourceEvidenceCatalogDigest: 'string',
  },
} as const;

const PROMPT_AUTHORITY_FIELDS = {
  initial: {
    systemPromptVersion: 'string',
    userPromptVersion: 'string',
    systemPromptDigest: 'string',
    userPromptDigest: 'string',
  },
  repair: {
    systemPromptVersion: 'string',
    userPromptVersion: 'string',
    systemPromptDigest: 'string',
  },
  sourceEvidenceIdRepair: {
    systemPromptVersion: 'string',
    userPromptVersion: 'string',
    systemPromptDigest: 'string',
  },
} as const;

type RequestScalarKind = 'string' | 'boolean' | 'number';

function recordValue(
  value: unknown,
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validateRequestScalar(args: {
  object: Record<string, unknown>;
  field: string;
  kind: RequestScalarKind;
  scope?: string;
  issues: string[];
  structuralIssues: string[];
}): void {
  const codeSuffix = args.scope
    ? `${args.scope}:${args.field}`
    : args.field;
  const value = args.object[args.field];
  if (typeof value !== args.kind) {
    const code = `request_field_invalid:${codeSuffix}`;
    args.issues.push(code);
    args.structuralIssues.push(code);
    return;
  }
  if (
    args.kind === 'number' &&
    !Number.isFinite(value)
  ) {
    const code =
      `request_field_non_finite:${codeSuffix}`;
    args.issues.push(code);
    args.structuralIssues.push(code);
  }
}

function validateRequestObject(args: {
  parent: Record<string, unknown>;
  field: string;
  schema: Record<string, RequestScalarKind>;
  issues: string[];
  structuralIssues: string[];
}): Record<string, unknown> | null {
  const nested = recordValue(args.parent[args.field]);
  if (!nested) {
    const code = `request_field_invalid:${args.field}`;
    args.issues.push(code);
    args.structuralIssues.push(code);
    return null;
  }
  const allowed = REQUEST_NESTED_KEYS[args.field];
  args.issues.push(
    ...Object.keys(nested)
      .filter((key) => !allowed?.has(key))
      .map(
        () => `unexpected_request_field:${args.field}`,
      ),
  );
  for (const [field, kind] of Object.entries(
    args.schema,
  )) {
    validateRequestScalar({
      object: nested,
      field,
      kind,
      scope: args.field,
      issues: args.issues,
      structuralIssues: args.structuralIssues,
    });
  }
  return nested;
}

interface DecodedAuthoringRequest {
  request: VisualContractAuthoringRequest | null;
  issues: string[];
  observedRequestDigest: string | null;
  claimedRequestDigest: string | null;
}

function decodeAuthoringRequest(
  value: unknown,
): DecodedAuthoringRequest {
  const object = recordValue(value);
  const issues: string[] = [];
  const structuralIssues: string[] = [];
  let observedRequestDigest: string | null = null;
  try {
    canonicalContentAddressedJsonBytes(value);
    observedRequestDigest = canonicalJsonDigest(value);
  } catch (error) {
    issues.push(
      error instanceof CanonicalJsonDomainError
        ? `request_json_${error.code}`
        : 'request_json_domain_invalid',
    );
  }
  if (!object) {
    issues.push('request_object_required');
    return {
      request: null,
      issues: [...new Set(issues)].sort(),
      observedRequestDigest,
      claimedRequestDigest: null,
    };
  }

  issues.push(
    ...Object.keys(object)
    .filter((key) => !REQUEST_KEYS.has(key))
      .map(() => 'unexpected_request_field'),
  );
  for (const [field, kind] of Object.entries(
    REQUEST_TOP_LEVEL_FIELDS,
  )) {
    validateRequestScalar({
      object,
      field,
      kind,
      issues,
      structuralIssues,
    });
  }
  for (const [field, schema] of Object.entries(
    REQUEST_OBJECT_FIELDS,
  )) {
    validateRequestObject({
      parent: object,
      field,
      schema,
      issues,
      structuralIssues,
    });
  }

  const promptAuthority = recordValue(
    object.promptAuthority,
  );
  if (!promptAuthority) {
    const code =
      'request_field_invalid:promptAuthority';
    issues.push(code);
    structuralIssues.push(code);
  } else {
    issues.push(
      ...Object.keys(promptAuthority)
        .filter(
          (key) =>
            !REQUEST_NESTED_KEYS.promptAuthority?.has(key),
        )
        .map(
          () => 'unexpected_request_field:promptAuthority',
        ),
    );
    for (const [field, schema] of Object.entries(
      PROMPT_AUTHORITY_FIELDS,
    )) {
      const nested = recordValue(promptAuthority[field]);
      if (!nested) {
        const code =
          `request_field_invalid:promptAuthority:${field}`;
        issues.push(code);
        structuralIssues.push(code);
        continue;
      }
      const allowed = new Set(Object.keys(schema));
      issues.push(
        ...Object.keys(nested)
          .filter((key) => !allowed.has(key))
          .map(
            () =>
              'unexpected_request_field:promptAuthority',
          ),
      );
      for (const [nestedField, kind] of Object.entries(
        schema,
      )) {
        validateRequestScalar({
          object: nested,
          field: nestedField,
          kind,
          scope: `promptAuthority:${field}`,
          issues,
          structuralIssues,
        });
      }
    }
  }

  if (
    typeof object.version === 'string' &&
    object.version !==
      VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION
  ) {
    issues.push('request_version_mismatch');
  }

  return {
    request:
      structuralIssues.length === 0
        ? authoringRequestValue(object)
        : null,
    issues: [...new Set(issues)].sort(),
    observedRequestDigest,
    claimedRequestDigest:
      typeof object.digest === 'string' &&
      /^[a-f0-9]{64}$/.test(object.digest)
        ? object.digest
        : null,
  };
}

interface RejectedRequestEvidence {
  version: typeof CANONICAL_LIVE_REJECTED_REQUEST_EVIDENCE_VERSION;
  observedRequestDigest: string | null;
  claimedRequestDigest: string | null;
  status: 'rejected';
  issues: string[];
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

function stableRejectedReasonCodes(
  issues: readonly string[],
): string[] {
  const stable = [
    ...new Set(
      issues.map((issue) =>
        /^[A-Za-z0-9_:-]{1,128}$/.test(issue)
          ? issue
          : 'request_rejected',
      ),
    ),
  ]
    .sort()
    .slice(0, 128);
  return stable.length > 0 ? stable : ['request_rejected'];
}

function buildRejectedRequestEvidence(args: {
  observedRequestDigest: string | null;
  claimedRequestDigest: string | null;
  issues: readonly string[];
}): RejectedRequestEvidence {
  const withoutDigest = {
    version:
      CANONICAL_LIVE_REJECTED_REQUEST_EVIDENCE_VERSION,
    observedRequestDigest: args.observedRequestDigest,
    claimedRequestDigest: args.claimedRequestDigest,
    status: 'rejected' as const,
    issues: stableRejectedReasonCodes(args.issues),
    doesNotAuthorize: [
      'provider or model calls',
      'Visual Contract candidate status',
      'Semantic Reconciliation or human approval',
      'Blueprint, Board, package, render, publication, activation, or deployment',
    ],
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(withoutDigest),
  };
}

function normalizedAbsolute(value: string): string {
  const absolute = path.resolve(value);
  let resolved = absolute;
  try {
    resolved = fs.realpathSync(absolute);
  } catch {
    // A stale/missing source-authority root is a deterministic mismatch, not
    // a reason to bypass durable request rejection.
  }
  return process.platform === 'win32'
    ? resolved.toLowerCase()
    : resolved;
}

export async function runCanonicalLiveVisualContractAuthoring(
  input: CanonicalLiveVisualContractAuthoringInput,
  deps: CanonicalLiveVisualContractAuthoringDeps = {},
): Promise<CanonicalLiveVisualContractAuthoringResult> {
  if (!path.isAbsolute(input.repoRoot)) {
    throw new Error('--repo-root must be an absolute path');
  }
  // All containment decisions, reads, writes, and repository-relative labels
  // share this one canonical basis even when the supplied root is a junction
  // or symlink alias.
  const repositoryRealPath = fs.realpathSync(
    path.resolve(input.repoRoot),
  );
  const repoRoot = repositoryRealPath;
  const sourceRequest = sourceAuthorityRequestValue(
    readJsonArtifact(
      repoRoot,
      input.sourceAuthorityRequestPath,
      'source authority request',
    ),
  );
  const suppliedSnapshot = snapshotValue(
    readJsonArtifact(
      repoRoot,
      input.snapshotPath,
      'source authority snapshot',
    ),
  );
  const suppliedRequestRaw = readJsonArtifact(
    repoRoot,
    input.requestPath,
    'visual contract authoring request',
  );
  const decodedRequest = decodeAuthoringRequest(
    suppliedRequestRaw,
  );

  const boundaryIssues: string[] = [
    ...decodedRequest.issues,
  ];
  if (
    normalizedAbsolute(sourceRequest.repoRoot) !==
    normalizedAbsolute(repoRoot)
  ) {
    boundaryIssues.push(
      'source_authority_request_repo_root_mismatch',
    );
  }
  const rebuiltSnapshot =
    buildStorySourceAuthoritySnapshot({
      ...sourceRequest,
      repoRoot,
    });
  try {
    assertValidStorySourceAuthoritySnapshot(
      suppliedSnapshot,
    );
  } catch {
    boundaryIssues.push('supplied_source_snapshot_invalid');
  }
  const snapshotExact =
    canonicalJsonDigest(suppliedSnapshot) ===
    canonicalJsonDigest(rebuiltSnapshot);
  if (!snapshotExact) {
    boundaryIssues.push(
      'supplied_source_snapshot_content_mismatch',
    );
  }

  const rawRequestObject = recordValue(
    suppliedRequestRaw,
  );
  const safeMode =
    rawRequestObject?.mode === 'live'
      ? 'live'
      : 'preflight';
  const safeRequestId =
    typeof rawRequestObject?.requestId === 'string' &&
    rawRequestObject.requestId.trim().length > 0 &&
    rawRequestObject.requestId.length <= 160
      ? rawRequestObject.requestId
      : `rejected-${rebuiltSnapshot.digest.slice(0, 24)}`;
  const safeRequestedAt =
    typeof rawRequestObject?.requestedAt === 'string' &&
    rawRequestObject.requestedAt.trim().length > 0 &&
    !Number.isNaN(
      Date.parse(rawRequestObject.requestedAt),
    )
      ? rawRequestObject.requestedAt
      : '1970-01-01T00:00:00.000Z';
  const rebuiltRequest =
    buildVisualContractAuthoringRequest({
      snapshot: rebuiltSnapshot,
      mode: safeMode,
      requestId: safeRequestId,
      requestedAt: safeRequestedAt,
    });
  const requestForLifecycle =
    decodedRequest.request ?? rebuiltRequest;
  const requestExact =
    decodedRequest.request !== null &&
    decodedRequest.issues.length === 0 &&
    canonicalJsonDigest(decodedRequest.request) ===
      canonicalJsonDigest(rebuiltRequest);
  if (!requestExact) {
    boundaryIssues.push(
      'supplied_live_request_content_mismatch',
    );
  }

  const requestIssues =
    visualContractAuthoringRequestIssues({
      request: requestForLifecycle,
      snapshot: rebuiltSnapshot,
    });
  const lifecycleRequestIssues = [
    ...boundaryIssues,
    ...requestIssues,
    ...(rawRequestObject?.mode === 'live'
      ? []
      : ['request_mode_must_be_live']),
  ];
  const approvedAuthoringRequest =
    requestExact &&
    requestIssues.length === 0 &&
    decodedRequest.request?.mode === 'live' &&
    snapshotExact &&
    boundaryIssues.length === 0;

  const artifactStore = (
    deps.artifactStoreFactory ??
    createCanonicalLiveAuthoringArtifactStore
  )({
    repoRoot,
    repositoryRealPath,
    outputDir: input.outputDir,
  });
  // Every category is containment-checked, created, and writable-probed
  // before any credential or provider boundary can be reached.
  artifactStore.prepare();

  let sourceSnapshotWrite:
    | VisualContractAuthoringArtifactWrite
    | null = null;
  let authoringRequestWrite: VisualContractAuthoringArtifactWrite;
  if (approvedAuthoringRequest) {
    sourceSnapshotWrite = artifactStore.persist({
      category: 'source-snapshots',
      digest: rebuiltSnapshot.digest,
      value: rebuiltSnapshot,
    });
    authoringRequestWrite = artifactStore.persist({
      category: 'authoring-requests',
      digest: requestForLifecycle.digest,
      value: requestForLifecycle,
    });
  } else {
    const rejectedRequestEvidence =
      buildRejectedRequestEvidence({
        observedRequestDigest:
          decodedRequest.observedRequestDigest,
        claimedRequestDigest:
          decodedRequest.claimedRequestDigest,
        issues: lifecycleRequestIssues,
      });
    authoringRequestWrite = artifactStore.persist({
      category: 'rejected-authoring-requests',
      digest: rejectedRequestEvidence.digest,
      value: rejectedRequestEvidence,
    });
  }

  const provider = approvedAuthoringRequest
    ? deps.provider ??
      (
        deps.providerFactory ??
        createOpenAIResponsesVisualContractAuthoringAdapter
      )()
    : undefined;
  const authored = await runVisualContractAuthoring({
    request: requestForLifecycle,
    snapshot: rebuiltSnapshot,
    provider,
    requiredMode: 'live',
    additionalRequestIssues: boundaryIssues,
    requiredProviderEvidenceVersion:
      OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
  });
  // Receipt is always the first post-call write. A provider-call failure then
  // writes its additive sanitized sidecar before readiness. If either write
  // cannot become durable, no readiness or candidate artifact is attempted.
  const authoringReceiptWrite = artifactStore.persist({
    category: 'authoring-receipts',
    digest: authored.receipt.digest,
    value: authored.receipt,
  });
  const providerFailureEvidenceWrite =
    authored.providerFailureEvidence
      ? artifactStore.persist({
          category: 'provider-call-failure-evidence',
          digest:
            authored.providerFailureEvidence.digest,
          value: authored.providerFailureEvidence,
        })
      : null;
  const readiness =
    buildVisualContractAuthoringReadinessEvidence({
      snapshot: rebuiltSnapshot,
      request: requestForLifecycle,
      receipt: authored.receipt,
    });
  const readinessWrite = artifactStore.persist({
    category: 'readiness-evidence',
    digest: readiness.digest,
    value: readiness,
  });
  let candidateWrite:
    | VisualContractAuthoringArtifactWrite
    | null = null;
  if (authored.compileResult) {
    const candidate = buildVisualContractCandidateArtifact({
      receipt: authored.receipt,
      compileResult: authored.compileResult,
    });
    candidateWrite = artifactStore.persist({
      category: 'contract-candidates',
      digest: candidate.digest,
      value: candidate,
    });
  }

  return {
    mode: 'canonical_visual_contract_live_authoring',
    status:
      authored.receipt.status === 'completed'
        ? 'completed'
        : 'failed',
    receipt: authored.receipt,
    readiness,
    persistence: {
      sourceSnapshot: sourceSnapshotWrite,
      authoringRequest: authoringRequestWrite,
      authoringRequestKind: approvedAuthoringRequest
        ? 'approved_live_request'
        : 'rejected_request_evidence',
      authoringReceipt: authoringReceiptWrite,
      providerFailureEvidence:
        providerFailureEvidenceWrite,
      readiness: readinessWrite,
      candidate: candidateWrite,
    },
    processInterruptionLimitation:
      CANONICAL_LIVE_AUTHORING_INTERRUPTION_LIMITATION,
  };
}
