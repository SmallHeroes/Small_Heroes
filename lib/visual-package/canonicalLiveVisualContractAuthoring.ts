import fs from 'node:fs';
import path from 'node:path';

import {
  canonicalJsonDigest,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  createOpenAIResponsesVisualContractAuthoringAdapter,
} from './openaiResponsesVisualContractAuthoringAdapter';
import {
  writeImmutableLocalArtifact,
} from './preRenderBlueprintLifecycle';
import {
  assertValidStorySourceAuthoritySnapshot,
  buildStorySourceAuthoritySnapshot,
  persistStorySourceAuthoritySnapshot,
  type StorySourceAuthorityRequest,
  type StorySourceAuthoritySnapshot,
} from './storySourceAuthority';
import {
  buildVisualContractAuthoringReadinessEvidence,
  buildVisualContractAuthoringRequest,
  persistVisualContractAuthoringReadiness,
  persistVisualContractAuthoringReceipt,
  persistVisualContractAuthoringRequest,
  persistVisualContractCandidate,
  runVisualContractAuthoring,
  visualContractAuthoringRequestIssues,
  type VisualContractAuthoringArtifactWrite,
  type VisualContractAuthoringProvider,
  type VisualContractAuthoringRequest,
} from './visualContractAuthoringLifecycle';

export const CANONICAL_LIVE_AUTHORING_INTERRUPTION_LIMITATION =
  'A forced process termination during or immediately after a provider request can occur before the in-memory sanitized receipt is durably persisted; rerun authority must be reconciled from provider-side evidence and is never implied.';
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
  return issues;
}

interface RejectedRequestEvidence {
  version: typeof CANONICAL_LIVE_REJECTED_REQUEST_EVIDENCE_VERSION;
  observedRequestDigest: string;
  claimedRequestDigest: string;
  status: 'rejected';
  request: VisualContractAuthoringRequest;
  issues: string[];
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

function buildRejectedRequestEvidence(args: {
  request: VisualContractAuthoringRequest;
  issues: readonly string[];
}): RejectedRequestEvidence {
  const withoutDigest = {
    version:
      CANONICAL_LIVE_REJECTED_REQUEST_EVIDENCE_VERSION,
    observedRequestDigest: canonicalJsonDigest(args.request),
    claimedRequestDigest: args.request.digest,
    status: 'rejected' as const,
    request: args.request,
    issues: [...new Set(args.issues)].sort(),
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

function persistRejectedRequestEvidence(args: {
  repoRoot: string;
  outputDir: string;
  evidence: RejectedRequestEvidence;
}): VisualContractAuthoringArtifactWrite {
  const root = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, root);
  const destinationPath = path.join(
    root,
    'rejected-authoring-requests',
    `${args.evidence.digest}.json`,
  );
  const result = writeImmutableLocalArtifact({
    destinationPath,
    bytes: `${JSON.stringify(args.evidence, null, 2)}\n`,
  });
  return {
    path: repoRelativePath(args.repoRoot, destinationPath),
    digest: args.evidence.digest,
    created: result.created,
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
  const provider =
    deps.provider ??
    createOpenAIResponsesVisualContractAuthoringAdapter();
  const authored = await runVisualContractAuthoring({
    request: suppliedRequest,
    snapshot: rebuiltSnapshot,
    provider,
    requiredMode: 'live',
    additionalRequestIssues: boundaryIssues,
  });
  const readiness =
    buildVisualContractAuthoringReadinessEvidence({
      snapshot: rebuiltSnapshot,
      request: suppliedRequest,
      receipt: authored.receipt,
    });

  const sourceSnapshotWrite =
    snapshotExact && boundaryIssues.length === 0
      ? persistStorySourceAuthoritySnapshot({
          repoRoot,
          outputDir: input.outputDir,
          snapshot: rebuiltSnapshot,
          write: true,
        })
      : null;
  const approvedAuthoringRequest =
    requestExact &&
    requestIssues.length === 0 &&
    suppliedRequest.mode === 'live' &&
    snapshotExact &&
    boundaryIssues.length === 0;
  const authoringRequestWrite =
    approvedAuthoringRequest
      ? persistVisualContractAuthoringRequest({
          repoRoot,
          outputDir: input.outputDir,
          request: suppliedRequest,
          write: true,
        })
      : persistRejectedRequestEvidence({
          repoRoot,
          outputDir: input.outputDir,
          evidence: buildRejectedRequestEvidence({
            request: suppliedRequest,
            issues: [
              ...boundaryIssues,
              ...requestIssues,
            ],
          }),
        });
  const authoringReceiptWrite =
    persistVisualContractAuthoringReceipt({
      repoRoot,
      outputDir: input.outputDir,
      receipt: authored.receipt,
      write: true,
    });
  const readinessWrite =
    persistVisualContractAuthoringReadiness({
      repoRoot,
      outputDir: input.outputDir,
      evidence: readiness,
      write: true,
    });
  const candidateWrite = authored.compileResult
    ? persistVisualContractCandidate({
        repoRoot,
        outputDir: input.outputDir,
        receipt: authored.receipt,
        compileResult: authored.compileResult,
        write: true,
      })
    : null;

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
