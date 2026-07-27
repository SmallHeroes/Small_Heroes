import path from 'path';

import {
  VISUAL_CONTRACT_AUTHORING_ENDPOINT,
  VISUAL_CONTRACT_AUTHORING_HARD_COST_CEILING_USD,
  VISUAL_CONTRACT_AUTHORING_MAX_CALLS,
  VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
  VISUAL_CONTRACT_AUTHORING_MAX_REPAIRS,
  VISUAL_CONTRACT_AUTHORING_MODEL,
  VISUAL_CONTRACT_AUTHORING_NO_FALLBACK,
  VISUAL_CONTRACT_AUTHORING_POLICY_VERSION,
  VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS,
  VISUAL_CONTRACT_AUTHORING_PROVIDER,
  VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT,
  VISUAL_CONTRACT_AUTHORING_SERVICE_TIER,
  VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS,
  VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED,
  VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES,
} from '@/lib/visual-contract-compiler/authoringPolicy';
import {
  authoringMaxOutputTokens,
  buildTemplateCompileSystemPrompt,
  buildTemplateCompileUserPrompt,
  compileBookVisualContractTemplate,
  TemplateRepairExhaustedError,
  type TemplateActionSourceEvidence,
  type TemplateCompileResult,
} from '@/lib/visual-contract-compiler/compileBookVisualContractTemplate';
import type {
  ContractLlmCallOptions,
} from '@/lib/visual-contract-compiler/compileBookVisualContract';
import {
  extractDeterministicFacts,
} from '@/lib/visual-contract-compiler/extractDeterministicFacts';
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  TEMPLATE_DRAFT_SCHEMA_NAME,
  TEMPLATE_DRAFT_SCHEMA_VERSION,
} from '@/lib/visual-contract-compiler/templateDraftSchema';
import type {
  BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler/contractTemplateTypes';

import {
  canonicalJsonDigest,
  isoTimestampIsValid,
  nonEmpty,
  repoRelativePath,
} from './integrity';
import { writeImmutableLocalArtifact } from './preRenderBlueprintLifecycle';
import {
  assertValidStorySourceAuthoritySnapshot,
  storySourceSnapshotToTemplateInput,
  type StorySourceAuthoritySnapshot,
} from './storySourceAuthority';

export const VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION =
  'visual-contract-authoring-request/v1' as const;
export const VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION =
  'visual-contract-authoring-receipt/v1' as const;
export const VISUAL_CONTRACT_AUTHORING_READINESS_VERSION =
  'visual-contract-authoring-readiness/v1' as const;
export const VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION =
  'visual-contract-candidate-artifact/v1' as const;

const PROMPT_PROTOCOL_TOKEN_ALLOWANCE = 4_096;
const MAX_RECEIPT_ERRORS = 128;
const MAX_RECEIPT_ERROR_LENGTH = 2_000;

export interface VisualContractAuthoringRequest {
  version: typeof VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION;
  policyVersion:
    typeof VISUAL_CONTRACT_AUTHORING_POLICY_VERSION;
  mode: 'preflight' | 'live';
  requestId: string;
  requestedAt: string;
  sourceSnapshotDigest: string;
  provider: typeof VISUAL_CONTRACT_AUTHORING_PROVIDER;
  endpoint: typeof VISUAL_CONTRACT_AUTHORING_ENDPOINT;
  model: typeof VISUAL_CONTRACT_AUTHORING_MODEL;
  serviceTier:
    typeof VISUAL_CONTRACT_AUTHORING_SERVICE_TIER;
  reasoningEffort:
    typeof VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT;
  structuredOutput: {
    strict: true;
    schemaName: typeof TEMPLATE_DRAFT_SCHEMA_NAME;
    schemaVersion: typeof TEMPLATE_DRAFT_SCHEMA_VERSION;
    schemaDigest: string;
  };
  toolsDisabled:
    typeof VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED;
  noFallback: typeof VISUAL_CONTRACT_AUTHORING_NO_FALLBACK;
  transportRetries:
    typeof VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES;
  timeoutMs: number;
  tokenBudget: {
    maxInputTokens: number;
    promptAndSchemaTokenUpperBound: number;
    maxOutputTokens: number;
    outputIncludesReasoning: true;
  };
  callBudget: {
    maxCalls: number;
    maxRepairCount: number;
  };
  pricing: typeof VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS;
  costBudget: {
    projectedMaxUsd: number;
    hardCeilingUsd: number;
  };
  promptDigests: {
    system: string;
    user: string;
  };
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface VisualContractAuthoringUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

export interface VisualContractAuthoringProviderResponse {
  output: string;
  receipt: {
    provider: string;
    model: string;
    responseId?: string;
    usage?: Record<string, unknown> | null;
  };
}

export interface VisualContractAuthoringProvider {
  call(args: {
    attempt: number;
    kind: 'initial' | 'repair';
    systemPrompt: string;
    userPrompt: string;
    options: ContractLlmCallOptions;
  }): Promise<VisualContractAuthoringProviderResponse>;
}

export interface VisualContractAuthoringAttemptReceipt {
  attempt: number;
  kind: 'initial' | 'repair';
  providerReached: boolean;
  status:
    | 'response_received'
    | 'provider_failed'
    | 'policy_mismatch'
    | 'input_ceiling_exceeded'
    | 'usage_invalid'
    | 'cost_ceiling_exceeded';
  provider: string;
  model: string;
  responseId: string | null;
  systemPromptDigest: string;
  userPromptDigest: string;
  responseDigest: string | null;
  usage: VisualContractAuthoringUsage | null;
  actualCostUsd: number | null;
  validationErrors: string[];
}

export interface VisualContractAuthoringReceipt {
  version: typeof VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION;
  requestDigest: string;
  sourceSnapshotDigest: string;
  mode: 'preflight' | 'live';
  provider: string;
  endpoint: string;
  model: string;
  serviceTier: string;
  status: 'preflight_passed' | 'completed' | 'failed';
  callCount: number;
  repairCount: number;
  projectedMaxCostUsd: number;
  actualCostUsd: number;
  aggregateUsage: VisualContractAuthoringUsage;
  attempts: VisualContractAuthoringAttemptReceipt[];
  candidateDigest: string | null;
  reconciliationDigest: null;
  failure: {
    code:
      | 'request_invalid'
      | 'provider_required'
      | 'provider_call_failed'
      | 'provider_policy_mismatch'
      | 'input_token_ceiling_exceeded'
      | 'usage_invalid'
      | 'cost_ceiling_exceeded'
      | 'validation_exhausted'
      | 'action_authority_incomplete';
    message: string;
    issues: string[];
  } | null;
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface VisualContractAuthoringRunResult {
  receipt: VisualContractAuthoringReceipt;
  compileResult: TemplateCompileResult | null;
}

export interface VisualContractAuthoringReadinessEvidence {
  version: typeof VISUAL_CONTRACT_AUTHORING_READINESS_VERSION;
  sourceSnapshotDigest: string;
  authoringRequestDigest: string;
  authoringReceiptDigest: string;
  preflightPassed: boolean;
  visualContractCandidate: {
    status: 'absent' | 'candidate';
    digest: string | null;
  };
  semanticReconciliation: {
    status: 'absent';
    digest: null;
  };
  humanSourceApproval: {
    status: 'absent';
    digest: null;
  };
  blueprintAuthoringReady: false;
  d1a1Authorized: false;
  blockers: string[];
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface VisualContractAuthoringArtifactWrite {
  path: string;
  digest: string;
  created: boolean;
}

export interface VisualContractCandidateArtifact {
  version: typeof VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION;
  sourceSnapshotDigest: string;
  authoringRequestDigest: string;
  authoringReceiptDigest: string;
  templateDigest: string;
  actionSourceEvidenceDigest: string;
  template: BookVisualContractTemplate;
  /** Review evidence only; never contract or approval authority. */
  actionSourceEvidence: TemplateActionSourceEvidence[];
  status: 'candidate';
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

const DOES_NOT_AUTHORIZE = [
  'D1A1 live provider/model calls',
  'Story Source or Semantic Reconciliation approval',
  'Blueprint authoring or approval',
  'Board mint, import, or approval',
  'package assembly, publication, promotion, or activation',
  'render, product, visual, release, deployment, or launch acceptance',
] as const;

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function requestWithoutDigest(
  request: Omit<
    VisualContractAuthoringRequest,
    'digestAlgorithm' | 'digest'
  >,
): unknown {
  return request;
}

function receiptWithoutDigest(
  receipt: Omit<
    VisualContractAuthoringReceipt,
    'digestAlgorithm' | 'digest'
  >,
): unknown {
  return receipt;
}

function readinessWithoutDigest(
  evidence: Omit<
    VisualContractAuthoringReadinessEvidence,
    'digestAlgorithm' | 'digest'
  >,
): unknown {
  return evidence;
}

function promptInputs(snapshot: StorySourceAuthoritySnapshot): {
  systemPrompt: string;
  userPrompt: string;
  promptAndSchemaTokenUpperBound: number;
} {
  const input = storySourceSnapshotToTemplateInput(snapshot);
  const facts = extractDeterministicFacts(input);
  const systemPrompt = buildTemplateCompileSystemPrompt();
  const userPrompt = buildTemplateCompileUserPrompt(
    input,
    facts,
  );
  return {
    systemPrompt,
    userPrompt,
    // A UTF-8 byte count is a conservative token upper bound. The explicit
    // allowance covers Responses framing and schema protocol fields.
    promptAndSchemaTokenUpperBound: callInputTokenUpperBound(
      systemPrompt,
      userPrompt,
    ),
  };
}

function callInputTokenUpperBound(
  systemPrompt: string,
  userPrompt: string,
): number {
  return (
    Buffer.byteLength(
      [
        systemPrompt,
        userPrompt,
        JSON.stringify(TEMPLATE_DRAFT_JSON_SCHEMA),
      ].join('\n'),
      'utf8',
    ) + PROMPT_PROTOCOL_TOKEN_ALLOWANCE
  );
}

function projectedMaximumCostUsd(maxOutputTokens: number): number {
  const prices = VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS;
  const perCall =
    (VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS *
      prices.inputUsdPerUnit +
      maxOutputTokens * prices.outputUsdPerUnit) /
    prices.unitTokens;
  return roundUsd(
    perCall * VISUAL_CONTRACT_AUTHORING_MAX_CALLS,
  );
}

export function buildVisualContractAuthoringRequest(args: {
  snapshot: StorySourceAuthoritySnapshot;
  mode: 'preflight' | 'live';
  requestId: string;
  requestedAt: string;
}): VisualContractAuthoringRequest {
  assertValidStorySourceAuthoritySnapshot(args.snapshot);
  const prompts = promptInputs(args.snapshot);
  const maxOutputTokens = authoringMaxOutputTokens(
    args.snapshot.content.pages.length,
  );
  const withoutDigest = {
    version: VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION,
    policyVersion:
      VISUAL_CONTRACT_AUTHORING_POLICY_VERSION,
    mode: args.mode,
    requestId: args.requestId,
    requestedAt: args.requestedAt,
    sourceSnapshotDigest: args.snapshot.digest,
    provider: VISUAL_CONTRACT_AUTHORING_PROVIDER,
    endpoint: VISUAL_CONTRACT_AUTHORING_ENDPOINT,
    model: VISUAL_CONTRACT_AUTHORING_MODEL,
    serviceTier:
      VISUAL_CONTRACT_AUTHORING_SERVICE_TIER,
    reasoningEffort:
      VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT,
    structuredOutput: {
      strict: true as const,
      schemaName: TEMPLATE_DRAFT_SCHEMA_NAME,
      schemaVersion: TEMPLATE_DRAFT_SCHEMA_VERSION,
      schemaDigest: canonicalJsonDigest(
        TEMPLATE_DRAFT_JSON_SCHEMA,
      ),
    },
    toolsDisabled:
      VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED,
    noFallback: VISUAL_CONTRACT_AUTHORING_NO_FALLBACK,
    transportRetries:
      VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES,
    timeoutMs: VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS,
    tokenBudget: {
      maxInputTokens:
        VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
      promptAndSchemaTokenUpperBound:
        prompts.promptAndSchemaTokenUpperBound,
      maxOutputTokens,
      outputIncludesReasoning: true as const,
    },
    callBudget: {
      maxCalls: VISUAL_CONTRACT_AUTHORING_MAX_CALLS,
      maxRepairCount:
        VISUAL_CONTRACT_AUTHORING_MAX_REPAIRS,
    },
    pricing: VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS,
    costBudget: {
      projectedMaxUsd:
        projectedMaximumCostUsd(maxOutputTokens),
      hardCeilingUsd:
        VISUAL_CONTRACT_AUTHORING_HARD_COST_CEILING_USD,
    },
    promptDigests: {
      system: canonicalJsonDigest(prompts.systemPrompt),
      user: canonicalJsonDigest(prompts.userPrompt),
    },
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(
      requestWithoutDigest(withoutDigest),
    ),
  };
}

function exactJson(left: unknown, right: unknown): boolean {
  return canonicalJsonDigest(left) === canonicalJsonDigest(right);
}

export function visualContractAuthoringRequestIssues(args: {
  request: VisualContractAuthoringRequest;
  snapshot: StorySourceAuthoritySnapshot;
}): string[] {
  const { request, snapshot } = args;
  const issues: string[] = [];
  let snapshotValid = true;
  try {
    assertValidStorySourceAuthoritySnapshot(snapshot);
  } catch {
    issues.push('source_snapshot_invalid');
    snapshotValid = false;
  }
  if (!snapshotValid) return issues;
  if (request.version !== VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION) {
    issues.push('request_version_mismatch');
  }
  if (
    request.policyVersion !==
    VISUAL_CONTRACT_AUTHORING_POLICY_VERSION
  ) {
    issues.push('authoring_policy_version_mismatch');
  }
  if (!['preflight', 'live'].includes(request.mode)) {
    issues.push('request_mode_invalid');
  }
  if (
    !nonEmpty(request.requestId) ||
    request.requestId.length > 160
  ) {
    issues.push('request_id_invalid');
  }
  if (!isoTimestampIsValid(request.requestedAt)) {
    issues.push('requested_at_invalid');
  }
  if (request.sourceSnapshotDigest !== snapshot.digest) {
    issues.push('source_snapshot_digest_mismatch');
  }
  const exact = buildVisualContractAuthoringRequest({
    snapshot,
    mode: request.mode,
    requestId: request.requestId,
    requestedAt: request.requestedAt,
  });
  const exactFields: Array<
    [string, unknown, unknown]
  > = [
    ['provider_mismatch', request.provider, exact.provider],
    ['endpoint_mismatch', request.endpoint, exact.endpoint],
    ['model_mismatch', request.model, exact.model],
    [
      'service_tier_mismatch',
      request.serviceTier,
      exact.serviceTier,
    ],
    [
      'reasoning_effort_mismatch',
      request.reasoningEffort,
      exact.reasoningEffort,
    ],
    [
      'structured_output_mismatch',
      request.structuredOutput,
      exact.structuredOutput,
    ],
    [
      'tools_policy_mismatch',
      request.toolsDisabled,
      exact.toolsDisabled,
    ],
    [
      'fallback_policy_mismatch',
      request.noFallback,
      exact.noFallback,
    ],
    [
      'transport_retries_mismatch',
      request.transportRetries,
      exact.transportRetries,
    ],
    [
      'timeout_mismatch',
      request.timeoutMs,
      exact.timeoutMs,
    ],
    [
      'token_budget_mismatch',
      request.tokenBudget,
      exact.tokenBudget,
    ],
    [
      'call_budget_mismatch',
      request.callBudget,
      exact.callBudget,
    ],
    [
      'price_assumptions_mismatch',
      request.pricing,
      exact.pricing,
    ],
    [
      'cost_budget_mismatch',
      request.costBudget,
      exact.costBudget,
    ],
    [
      'prompt_digest_mismatch',
      request.promptDigests,
      exact.promptDigests,
    ],
  ];
  for (const [code, actual, expected] of exactFields) {
    if (!exactJson(actual, expected)) issues.push(code);
  }
  if (
    request.tokenBudget?.promptAndSchemaTokenUpperBound >
    request.tokenBudget?.maxInputTokens
  ) {
    issues.push('input_token_ceiling_exceeded');
  }
  if (
    request.costBudget?.projectedMaxUsd >
    request.costBudget?.hardCeilingUsd
  ) {
    issues.push('projected_cost_ceiling_exceeded');
  }
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = request;
  if (
    request.digestAlgorithm !== 'canonical-json-sha256' ||
    request.digest !== canonicalJsonDigest(payload)
  ) {
    issues.push('request_digest_stale');
  }
  return [...new Set(issues)];
}

function zeroUsage(): VisualContractAuthoringUsage {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  };
}

function finalizeReceipt(
  receipt: Omit<
    VisualContractAuthoringReceipt,
    'digestAlgorithm' | 'digest'
  >,
): VisualContractAuthoringReceipt {
  return {
    ...receipt,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(
      receiptWithoutDigest(receipt),
    ),
  };
}

function failureReceipt(args: {
  request: VisualContractAuthoringRequest;
  attempts: VisualContractAuthoringAttemptReceipt[];
  code: NonNullable<
    VisualContractAuthoringReceipt['failure']
  >['code'];
  message: string;
  issues?: string[];
}): VisualContractAuthoringReceipt {
  const usage = aggregateUsage(args.attempts);
  return finalizeReceipt({
    version: VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION,
    requestDigest: args.request.digest,
    sourceSnapshotDigest:
      args.request.sourceSnapshotDigest,
    mode: args.request.mode,
    provider: args.request.provider,
    endpoint: args.request.endpoint,
    model: args.request.model,
    serviceTier: args.request.serviceTier,
    status: 'failed',
    callCount: providerCallCount(args.attempts),
    repairCount: providerRepairCallCount(args.attempts),
    projectedMaxCostUsd:
      args.request.costBudget.projectedMaxUsd,
    actualCostUsd: aggregateCost(args.attempts),
    aggregateUsage: usage,
    attempts: args.attempts,
    candidateDigest: null,
    reconciliationDigest: null,
    failure: {
      code: args.code,
      message: args.message,
      issues: boundedErrors(args.issues ?? []),
    },
    doesNotAuthorize: [...DOES_NOT_AUTHORIZE],
  });
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : undefined;
}

function safeUsage(
  raw: Record<string, unknown> | null | undefined,
): VisualContractAuthoringUsage | null {
  if (!raw) return null;
  const details =
    raw.input_tokens_details &&
    typeof raw.input_tokens_details === 'object'
      ? (raw.input_tokens_details as Record<string, unknown>)
      : {};
  const outputDetails =
    raw.output_tokens_details &&
    typeof raw.output_tokens_details === 'object'
      ? (raw.output_tokens_details as Record<string, unknown>)
      : {};
  const inputTokens =
    numeric(raw.input_tokens) ??
    numeric(raw.prompt_tokens);
  const outputTokens =
    numeric(raw.output_tokens) ??
    numeric(raw.completion_tokens);
  if (inputTokens === undefined || outputTokens === undefined) {
    return null;
  }
  const cachedInputTokens =
    numeric(raw.cached_input_tokens) ??
    numeric(details.cached_tokens) ??
    0;
  const reasoningTokens =
    numeric(raw.reasoning_tokens) ??
    numeric(outputDetails.reasoning_tokens) ??
    0;
  const totalTokens =
    numeric(raw.total_tokens) ??
    inputTokens + outputTokens;
  if (
    cachedInputTokens > inputTokens ||
    reasoningTokens > outputTokens ||
    totalTokens < inputTokens + outputTokens
  ) {
    return null;
  }
  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
  };
}

function usageCost(
  usage: VisualContractAuthoringUsage,
): number {
  const prices = VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS;
  const uncached =
    usage.inputTokens - usage.cachedInputTokens;
  return roundUsd(
    (uncached * prices.inputUsdPerUnit +
      usage.cachedInputTokens *
        prices.cachedInputUsdPerUnit +
      usage.outputTokens * prices.outputUsdPerUnit) /
      prices.unitTokens,
  );
}

function aggregateUsage(
  attempts: VisualContractAuthoringAttemptReceipt[],
): VisualContractAuthoringUsage {
  return attempts.reduce(
    (total, attempt) => {
      const usage = attempt.usage;
      if (!usage) return total;
      return {
        inputTokens: total.inputTokens + usage.inputTokens,
        cachedInputTokens:
          total.cachedInputTokens + usage.cachedInputTokens,
        outputTokens:
          total.outputTokens + usage.outputTokens,
        reasoningTokens:
          total.reasoningTokens + usage.reasoningTokens,
        totalTokens: total.totalTokens + usage.totalTokens,
      };
    },
    zeroUsage(),
  );
}

function aggregateCost(
  attempts: VisualContractAuthoringAttemptReceipt[],
): number {
  return roundUsd(
    attempts.reduce(
      (sum, attempt) =>
        sum + (attempt.actualCostUsd ?? 0),
      0,
    ),
  );
}

function providerCallCount(
  attempts: readonly VisualContractAuthoringAttemptReceipt[],
): number {
  return attempts.filter((attempt) => attempt.providerReached)
    .length;
}

function providerRepairCallCount(
  attempts: readonly VisualContractAuthoringAttemptReceipt[],
): number {
  return attempts.filter(
    (attempt) =>
      attempt.providerReached && attempt.kind === 'repair',
  ).length;
}

function safeLabel(value: unknown, fallback: string): string {
  return nonEmpty(value)
    ? value
        .slice(0, 160)
        .replace(/[\r\n\t\u0000-\u001F\u007F]/g, ' ')
    : fallback;
}

function boundedErrors(errors: readonly unknown[]): string[] {
  return errors
    .filter(
      (candidate): candidate is string =>
        typeof candidate === 'string',
    )
    .slice(0, MAX_RECEIPT_ERRORS)
    .map((candidate) =>
      candidate
        .slice(0, MAX_RECEIPT_ERROR_LENGTH)
        .replace(
          /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
          '',
        ),
    );
}

function expectedCallOptions(
  request: VisualContractAuthoringRequest,
): ContractLlmCallOptions {
  return {
    maxOutputTokens: request.tokenBudget.maxOutputTokens,
    model: request.model,
    reasoningEffort: request.reasoningEffort,
    jsonSchema: {
      name: request.structuredOutput.schemaName,
      schema: TEMPLATE_DRAFT_JSON_SCHEMA,
    },
    noFallback: true,
    provider: 'openai',
    endpoint: 'responses',
    serviceTier: 'default',
    toolsDisabled: true,
    transportRetries: 0,
    timeoutMs: request.timeoutMs,
    maxInputTokens: request.tokenBudget.maxInputTokens,
  };
}

function actionAuthorityIssues(
  template: BookVisualContractTemplate,
): string[] {
  const issues: string[] = [];
  for (const page of template.pageContracts) {
    if (
      !Array.isArray(page.actionRequirements) ||
      page.actionRequirements.length === 0
    ) {
      issues.push(
        `page ${page.pageNumber}: action_authority_missing`,
      );
    }
  }
  return issues;
}

export async function runVisualContractAuthoring(args: {
  request: VisualContractAuthoringRequest;
  snapshot: StorySourceAuthoritySnapshot;
  provider?: VisualContractAuthoringProvider;
}): Promise<VisualContractAuthoringRunResult> {
  const requestIssues = visualContractAuthoringRequestIssues({
    request: args.request,
    snapshot: args.snapshot,
  });
  if (requestIssues.length > 0) {
    return {
      receipt: failureReceipt({
        request: args.request,
        attempts: [],
        code: 'request_invalid',
        message:
          'authoring request failed deterministic preflight',
        issues: requestIssues,
      }),
      compileResult: null,
    };
  }
  if (args.request.mode === 'preflight') {
    return {
      receipt: finalizeReceipt({
        version:
          VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION,
        requestDigest: args.request.digest,
        sourceSnapshotDigest: args.snapshot.digest,
        mode: 'preflight',
        provider: args.request.provider,
        endpoint: args.request.endpoint,
        model: args.request.model,
        serviceTier: args.request.serviceTier,
        status: 'preflight_passed',
        callCount: 0,
        repairCount: 0,
        projectedMaxCostUsd:
          args.request.costBudget.projectedMaxUsd,
        actualCostUsd: 0,
        aggregateUsage: zeroUsage(),
        attempts: [],
        candidateDigest: null,
        reconciliationDigest: null,
        failure: null,
        doesNotAuthorize: [...DOES_NOT_AUTHORIZE],
      }),
      compileResult: null,
    };
  }
  if (!args.provider) {
    return {
      receipt: failureReceipt({
        request: args.request,
        attempts: [],
        code: 'provider_required',
        message:
          'live mode requires one explicitly injected provider adapter',
      }),
      compileResult: null,
    };
  }

  const attempts: VisualContractAuthoringAttemptReceipt[] =
    [];
  const terminal: {
    code:
      | NonNullable<
          VisualContractAuthoringReceipt['failure']
        >['code']
      | null;
  } = { code: null };
  try {
    const compileResult =
      await compileBookVisualContractTemplate(
        storySourceSnapshotToTemplateInput(args.snapshot),
        {
          callLLM: async (
            systemPrompt,
            userPrompt,
            options,
          ) => {
            const attempt = attempts.length + 1;
            const kind =
              attempt === 1 ? 'initial' : 'repair';
            const base = {
              attempt,
              kind,
              providerReached: false,
              provider: args.request.provider,
              model: args.request.model,
              responseId: null,
              systemPromptDigest:
                canonicalJsonDigest(systemPrompt),
              userPromptDigest:
                canonicalJsonDigest(userPrompt),
              responseDigest: null,
              usage: null,
              actualCostUsd: null,
              validationErrors: [],
            } satisfies Omit<
              VisualContractAuthoringAttemptReceipt,
              'status'
            >;
            if (
              attempt >
              args.request.callBudget.maxCalls
            ) {
              terminal.code = 'validation_exhausted';
              throw new Error(
                'application call budget exhausted',
              );
            }
            if (
              callInputTokenUpperBound(
                systemPrompt,
                userPrompt,
              ) >
              args.request.tokenBudget.maxInputTokens
            ) {
              terminal.code =
                'input_token_ceiling_exceeded';
              attempts.push({
                ...base,
                status: 'input_ceiling_exceeded',
              });
              throw new Error(
                'application input token ceiling exceeded',
              );
            }
            const expected = expectedCallOptions(args.request);
            if (!exactJson(options, expected)) {
              terminal.code = 'provider_policy_mismatch';
              attempts.push({
                ...base,
                status: 'policy_mismatch',
              });
              throw new Error(
                'compiler call options differ from approved request',
              );
            }
            let response: VisualContractAuthoringProviderResponse;
            try {
              response = await args.provider!.call({
                attempt,
                kind,
                systemPrompt,
                userPrompt,
                options: expected,
              });
            } catch {
              terminal.code = 'provider_call_failed';
              attempts.push({
                ...base,
                providerReached: true,
                status: 'provider_failed',
              });
              throw new Error(
                'injected provider adapter failed',
              );
            }
            const provider = safeLabel(
              response.receipt.provider,
              'unknown-provider',
            );
            const model = safeLabel(
              response.receipt.model,
              'unknown-model',
            );
            const responseId = nonEmpty(
              response.receipt.responseId,
            )
              ? response.receipt.responseId.slice(0, 200)
              : null;
            if (
              provider !== args.request.provider ||
              model !== args.request.model
            ) {
              terminal.code = 'provider_policy_mismatch';
              attempts.push({
                ...base,
                providerReached: true,
                status: 'policy_mismatch',
                provider,
                model,
                responseId,
                responseDigest: canonicalJsonDigest(
                  response.output,
                ),
              });
              throw new Error(
                'provider response labels differ from approved request',
              );
            }
            const usage = safeUsage(
              response.receipt.usage,
            );
            if (
              !usage ||
              usage.inputTokens >
                args.request.tokenBudget.maxInputTokens ||
              usage.outputTokens >
                args.request.tokenBudget.maxOutputTokens
            ) {
              terminal.code = 'usage_invalid';
              attempts.push({
                ...base,
                providerReached: true,
                status: 'usage_invalid',
                provider,
                model,
                responseId,
                responseDigest: canonicalJsonDigest(
                  response.output,
                ),
                usage,
              });
              throw new Error(
                'provider usage is missing or outside approved token bounds',
              );
            }
            const actualCostUsd = usageCost(usage);
            const receipt: VisualContractAuthoringAttemptReceipt =
              {
                ...base,
                providerReached: true,
                status: 'response_received',
                provider,
                model,
                responseId,
                responseDigest: canonicalJsonDigest(
                  response.output,
                ),
                usage,
                actualCostUsd,
              };
            attempts.push(receipt);
            if (
              aggregateCost(attempts) >
              args.request.costBudget.hardCeilingUsd
            ) {
              receipt.status = 'cost_ceiling_exceeded';
              terminal.code = 'cost_ceiling_exceeded';
              throw new Error(
                'actual authoring cost exceeded approved ceiling',
              );
            }
            return response.output;
          },
        },
      );
    for (const repair of compileResult.repairAttempts) {
      const receipt = attempts[repair.attempt - 1];
      if (receipt) {
        receipt.validationErrors = boundedErrors(
          repair.errors,
        );
      }
    }
    const actionIssues = actionAuthorityIssues(
      compileResult.template,
    );
    if (actionIssues.length > 0) {
      return {
        receipt: failureReceipt({
          request: args.request,
          attempts,
          code: 'action_authority_incomplete',
          message:
            'candidate lacks explicit structured action authority on every page',
          issues: actionIssues,
        }),
        compileResult: null,
      };
    }
    const candidateDigest = canonicalJsonDigest(
      compileResult.template,
    );
    return {
      receipt: finalizeReceipt({
        version:
          VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION,
        requestDigest: args.request.digest,
        sourceSnapshotDigest: args.snapshot.digest,
        mode: 'live',
        provider: args.request.provider,
        endpoint: args.request.endpoint,
        model: args.request.model,
        serviceTier: args.request.serviceTier,
        status: 'completed',
        callCount: providerCallCount(attempts),
        repairCount: providerRepairCallCount(attempts),
        projectedMaxCostUsd:
          args.request.costBudget.projectedMaxUsd,
        actualCostUsd: aggregateCost(attempts),
        aggregateUsage: aggregateUsage(attempts),
        attempts,
        candidateDigest,
        reconciliationDigest: null,
        failure: null,
        doesNotAuthorize: [...DOES_NOT_AUTHORIZE],
      }),
      compileResult,
    };
  } catch (error) {
    if (error instanceof TemplateRepairExhaustedError) {
      for (const repair of error.attempts) {
        const receipt = attempts[repair.attempt - 1];
        if (receipt) {
          receipt.validationErrors = boundedErrors(
            repair.errors,
          );
        }
      }
    }
    const code = terminal.code ?? 'validation_exhausted';
    return {
      receipt: failureReceipt({
        request: args.request,
        attempts,
        code,
        message:
          code === 'provider_call_failed'
            ? 'injected provider adapter failed; raw provider errors were discarded'
            : code === 'provider_policy_mismatch'
              ? 'provider execution differed from the exact approved request'
              : code === 'input_token_ceiling_exceeded'
                ? 'authoring stopped before provider reachability at the approved input-token ceiling'
              : code === 'usage_invalid'
                ? 'provider usage was missing or outside approved token bounds'
                : code === 'cost_ceiling_exceeded'
                  ? 'authoring stopped at the approved hard cost ceiling'
                  : 'all bounded whole-book validation attempts failed',
      }),
      compileResult: null,
    };
  }
}

export function buildVisualContractAuthoringReadinessEvidence(args: {
  snapshot: StorySourceAuthoritySnapshot;
  request: VisualContractAuthoringRequest;
  receipt: VisualContractAuthoringReceipt;
}): VisualContractAuthoringReadinessEvidence {
  const candidate =
    args.receipt.status === 'completed' &&
    args.receipt.candidateDigest
      ? {
          status: 'candidate' as const,
          digest: args.receipt.candidateDigest,
        }
      : { status: 'absent' as const, digest: null };
  const preflightPassed =
    args.receipt.status !== 'failed';
  const blockers = [
    ...(preflightPassed
      ? []
      : ['authoring_preflight_not_passed']),
    ...(candidate.status === 'absent'
      ? ['visual_contract_candidate_absent']
      : []),
    'semantic_reconciliation_absent',
    'human_source_approval_absent',
  ];
  const withoutDigest = {
    version: VISUAL_CONTRACT_AUTHORING_READINESS_VERSION,
    sourceSnapshotDigest: args.snapshot.digest,
    authoringRequestDigest: args.request.digest,
    authoringReceiptDigest: args.receipt.digest,
    preflightPassed,
    visualContractCandidate: candidate,
    semanticReconciliation: {
      status: 'absent' as const,
      digest: null,
    },
    humanSourceApproval: {
      status: 'absent' as const,
      digest: null,
    },
    blueprintAuthoringReady: false as const,
    d1a1Authorized: false as const,
    blockers,
    doesNotAuthorize: [...DOES_NOT_AUTHORIZE],
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(
      readinessWithoutDigest(withoutDigest),
    ),
  };
}

function persistJsonArtifact(args: {
  repoRoot: string;
  outputDir: string;
  category: string;
  digest: string;
  value: unknown;
  write?: boolean;
}): VisualContractAuthoringArtifactWrite {
  const root = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, root);
  const destinationPath = path.join(
    root,
    args.category,
    `${args.digest}.json`,
  );
  const result =
    args.write === true
      ? writeImmutableLocalArtifact({
          destinationPath,
          bytes: `${JSON.stringify(args.value, null, 2)}\n`,
        })
      : { created: false };
  return {
    path: repoRelativePath(args.repoRoot, destinationPath),
    digest: args.digest,
    created: result.created,
  };
}

export function persistVisualContractAuthoringRequest(args: {
  repoRoot: string;
  outputDir: string;
  request: VisualContractAuthoringRequest;
  write?: boolean;
}): VisualContractAuthoringArtifactWrite {
  return persistJsonArtifact({
    ...args,
    category: 'authoring-requests',
    digest: args.request.digest,
    value: args.request,
  });
}

export function persistVisualContractAuthoringReceipt(args: {
  repoRoot: string;
  outputDir: string;
  receipt: VisualContractAuthoringReceipt;
  write?: boolean;
}): VisualContractAuthoringArtifactWrite {
  return persistJsonArtifact({
    ...args,
    category: 'authoring-receipts',
    digest: args.receipt.digest,
    value: args.receipt,
  });
}

export function persistVisualContractCandidate(args: {
  repoRoot: string;
  outputDir: string;
  receipt: VisualContractAuthoringReceipt;
  compileResult: Pick<
    TemplateCompileResult,
    'template' | 'actionSourceEvidence'
  >;
  write?: boolean;
}): VisualContractAuthoringArtifactWrite {
  const templateDigest = canonicalJsonDigest(
    args.compileResult.template,
  );
  if (
    args.receipt.status !== 'completed' ||
    args.receipt.candidateDigest !== templateDigest
  ) {
    throw new Error(
      'refusing to persist an uncompleted or receipt-unbound Visual Contract candidate',
    );
  }
  const actionSourceEvidenceDigest = canonicalJsonDigest(
    args.compileResult.actionSourceEvidence,
  );
  const artifactWithoutDigest = {
    version: VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION,
    sourceSnapshotDigest:
      args.receipt.sourceSnapshotDigest,
    authoringRequestDigest: args.receipt.requestDigest,
    authoringReceiptDigest: args.receipt.digest,
    templateDigest,
    actionSourceEvidenceDigest,
    template: args.compileResult.template,
    actionSourceEvidence:
      args.compileResult.actionSourceEvidence,
    status: 'candidate' as const,
    doesNotAuthorize: [...DOES_NOT_AUTHORIZE],
  };
  const artifact: VisualContractCandidateArtifact = {
    ...artifactWithoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(artifactWithoutDigest),
  };
  return persistJsonArtifact({
    ...args,
    category: 'contract-candidates',
    digest: artifact.digest,
    value: artifact,
  });
}

export function persistVisualContractAuthoringReadiness(args: {
  repoRoot: string;
  outputDir: string;
  evidence: VisualContractAuthoringReadinessEvidence;
  write?: boolean;
}): VisualContractAuthoringArtifactWrite {
  return persistJsonArtifact({
    ...args,
    category: 'readiness-evidence',
    digest: args.evidence.digest,
    value: args.evidence,
  });
}
