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
  artifactStoreFactory?: (args: {
    repoRoot: string;
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
  value: unknown,
): VisualContractAuthoringRequest {
  const object = objectValue(
    value,
    'visual contract authoring request',
  );
  const structuredOutput = objectValue(
    object.structuredOutput,
    'visual contract authoring request structuredOutput',
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
  'digestAlgorithm',
  'digest',
]);

const REQUEST_NESTED_KEYS: Record<string, Set<string>> = {
  structuredOutput: new Set([
    'strict',
    'schemaName',
    'schemaVersion',
    'schemaDigest',
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
  promptAuthority: new Set(['initial', 'repair']),
};

function unexpectedRequestFieldIssues(
  value: unknown,
): string[] {
  const object = objectValue(
    value,
    'visual contract authoring request',
  );
  const issues = Object.keys(object)
    .filter((key) => !REQUEST_KEYS.has(key))
    .map(() => 'unexpected_request_field');
  for (const [field, allowed] of Object.entries(
    REQUEST_NESTED_KEYS,
  )) {
    const nested = objectValue(
      object[field],
      `visual contract authoring request ${field}`,
    );
    issues.push(
      ...Object.keys(nested)
        .filter((key) => !allowed.has(key))
        .map(() => `unexpected_request_field:${field}`),
    );
  }
  const promptAuthority = objectValue(
    object.promptAuthority,
    'visual contract authoring request promptAuthority',
  );
  for (const [field, allowed] of [
    [
      'initial',
      new Set([
        'systemPromptVersion',
        'userPromptVersion',
        'systemPromptDigest',
        'userPromptDigest',
      ]),
    ],
    [
      'repair',
      new Set([
        'systemPromptVersion',
        'userPromptVersion',
        'systemPromptDigest',
      ]),
    ],
  ] as const) {
    const nested = objectValue(
      promptAuthority[field],
      `visual contract authoring request promptAuthority ${field}`,
    );
    issues.push(
      ...Object.keys(nested)
        .filter((key) => !allowed.has(key))
        .map(
          () =>
            'unexpected_request_field:promptAuthority',
        ),
    );
  }
  return issues;
}

interface RejectedRequestEvidence {
  version: typeof CANONICAL_LIVE_REJECTED_REQUEST_EVIDENCE_VERSION;
  observedRequestDigest: string;
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
        /^[a-z0-9_:-]{1,128}$/.test(issue)
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
  request: VisualContractAuthoringRequest;
  issues: readonly string[];
}): RejectedRequestEvidence {
  const withoutDigest = {
    version:
      CANONICAL_LIVE_REJECTED_REQUEST_EVIDENCE_VERSION,
    observedRequestDigest: canonicalJsonDigest(args.request),
    claimedRequestDigest: /^[a-f0-9]{64}$/.test(
      args.request.digest,
    )
      ? args.request.digest
      : null,
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
  const resolved = path.resolve(value);
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
  const repoRoot = path.resolve(input.repoRoot);
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
  const requestShapeIssues =
    unexpectedRequestFieldIssues(suppliedRequestRaw);
  const suppliedRequest = authoringRequestValue(
    suppliedRequestRaw,
  );

  const boundaryIssues: string[] = [
    ...requestShapeIssues,
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

  const rebuiltRequest =
    buildVisualContractAuthoringRequest({
      snapshot: rebuiltSnapshot,
      mode:
        suppliedRequest.mode === 'live'
          ? 'live'
          : 'preflight',
      requestId: suppliedRequest.requestId,
      requestedAt: suppliedRequest.requestedAt,
    });
  const requestExact =
    requestShapeIssues.length === 0 &&
    canonicalJsonDigest(suppliedRequest) ===
    canonicalJsonDigest(rebuiltRequest);
  if (!requestExact) {
    boundaryIssues.push(
      'supplied_live_request_content_mismatch',
    );
  }

  const requestIssues =
    visualContractAuthoringRequestIssues({
      request: suppliedRequest,
      snapshot: rebuiltSnapshot,
    });
  const lifecycleRequestIssues = [
    ...boundaryIssues,
    ...requestIssues,
    ...(suppliedRequest.mode === 'live'
      ? []
      : ['request_mode_must_be_live']),
  ];
  const approvedAuthoringRequest =
    requestExact &&
    requestIssues.length === 0 &&
    suppliedRequest.mode === 'live' &&
    snapshotExact &&
    boundaryIssues.length === 0;

  const artifactStore = (
    deps.artifactStoreFactory ??
    createCanonicalLiveAuthoringArtifactStore
  )({
    repoRoot,
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
      digest: suppliedRequest.digest,
      value: suppliedRequest,
    });
  } else {
    const rejectedRequestEvidence =
      buildRejectedRequestEvidence({
        request: suppliedRequest,
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
      createOpenAIResponsesVisualContractAuthoringAdapter()
    : deps.provider;
  const authored = await runVisualContractAuthoring({
    request: suppliedRequest,
    snapshot: rebuiltSnapshot,
    provider,
    requiredMode: 'live',
    additionalRequestIssues: boundaryIssues,
    requiredProviderEvidenceVersion:
      OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
  });
  // Receipt is always the first post-call write. If it cannot become durable,
  // no readiness or candidate artifact is attempted.
  const authoringReceiptWrite = artifactStore.persist({
    category: 'authoring-receipts',
    digest: authored.receipt.digest,
    value: authored.receipt,
  });
  const readiness =
    buildVisualContractAuthoringReadinessEvidence({
      snapshot: rebuiltSnapshot,
      request: suppliedRequest,
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
      readiness: readinessWrite,
      candidate: candidateWrite,
    },
    processInterruptionLimitation:
      CANONICAL_LIVE_AUTHORING_INTERRUPTION_LIMITATION,
  };
}
