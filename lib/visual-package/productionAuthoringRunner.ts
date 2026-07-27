import path from 'path';

import {
  PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS,
  PreRenderBlueprintAuthoringRepairExhaustedError,
  compilePreRenderBookVisualBlueprint,
  preRenderBlueprintAuthoringInputErrors,
  type PreRenderBlueprintAuthoringCallOptions,
  type PreRenderBlueprintAuthoringConfig,
  type PreRenderBlueprintAuthoringResult,
} from './preRenderBlueprintAuthoring';
import { writeImmutableLocalArtifact } from './preRenderBlueprintLifecycle';
import {
  canonicalJsonDigest,
  isoTimestampIsValid,
  nonEmpty,
  repoRelativePath,
} from './integrity';
import {
  computeProductionAuthoringContextDigest,
  type ProductionAuthoringContext,
} from './productionAuthoringContext';

export const PRODUCTION_AUTHORING_RUN_REQUEST_VERSION =
  'production-blueprint-authoring-request/v1' as const;
export const PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION =
  'production-blueprint-authoring-receipt/v1' as const;

export interface ProductionAuthoringCallBudget {
  maxCalls: number;
  maxRepairCount: number;
}

export interface ProductionAuthoringRunRequest {
  version: typeof PRODUCTION_AUTHORING_RUN_REQUEST_VERSION;
  mode: 'preflight' | 'live';
  requestId: string;
  requestedAt: string;
  contextDigest: string;
  model: string;
  reasoningEffort: string;
  maxOutputTokens: number;
  noFallback: true;
  callBudget: ProductionAuthoringCallBudget;
}

export interface ProductionAuthoringProviderReceipt {
  provider: string;
  model: string;
  responseId?: string;
  usage?: Record<string, unknown> | null;
}

export interface ProductionAuthoringProviderResponse {
  output: unknown;
  receipt: ProductionAuthoringProviderReceipt;
}

export interface ProductionAuthoringProvider {
  call(args: {
    attempt: number;
    kind: 'initial' | 'repair';
    systemPrompt: string;
    userPrompt: string;
    options: PreRenderBlueprintAuthoringCallOptions;
  }): Promise<ProductionAuthoringProviderResponse>;
}

export interface SafeAuthoringUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
}

export interface ProductionAuthoringAttemptReceipt {
  attempt: number;
  kind: 'initial' | 'repair';
  provider: string;
  model: string;
  responseId: string | null;
  systemPromptDigest: string;
  userPromptDigest: string;
  responseDigest: string | null;
  usage: SafeAuthoringUsage | null;
  validationErrors: string[];
  failureCode: 'provider_call_failed' | 'call_budget_exhausted' | null;
}

export interface ProductionAuthoringRunReceipt {
  version: typeof PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION;
  requestDigest: string;
  requestId: string;
  requestedAt: string;
  mode: 'preflight' | 'live';
  contextDigest: string;
  model: string;
  reasoningEffort: string;
  maxOutputTokens: number;
  noFallback: true;
  callBudget: ProductionAuthoringCallBudget;
  status: 'preflight_passed' | 'completed' | 'failed';
  callCount: number;
  repairCount: number;
  attempts: ProductionAuthoringAttemptReceipt[];
  blueprintDigest: string | null;
  authoringProvenanceDigest: string | null;
  failure: {
    code:
      | 'request_invalid'
      | 'context_invalid'
      | 'provider_call_failed'
      | 'validation_exhausted'
      | 'call_budget_exhausted';
    message: string;
  } | null;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface ProductionAuthoringRunResult {
  receipt: ProductionAuthoringRunReceipt;
  authoringResult: PreRenderBlueprintAuthoringResult | null;
}

export class InvalidProductionAuthoringRunRequestError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid production authoring request:\n- ${issues.join('\n- ')}`);
    this.name = 'InvalidProductionAuthoringRunRequestError';
  }
}

class AuthoringCallBudgetError extends Error {
  constructor() {
    super('authoring call budget exhausted');
    this.name = 'AuthoringCallBudgetError';
  }
}

function requestIssues(
  request: ProductionAuthoringRunRequest,
  context: ProductionAuthoringContext,
): string[] {
  const issues: string[] = [];
  if (request.version !== PRODUCTION_AUTHORING_RUN_REQUEST_VERSION) {
    issues.push('request version is unsupported');
  }
  if (!['preflight', 'live'].includes(request.mode)) {
    issues.push('request mode must be preflight|live');
  }
  if (!nonEmpty(request.requestId) || request.requestId.length > 160) {
    issues.push('requestId must be a non-empty bounded identifier');
  }
  if (!isoTimestampIsValid(request.requestedAt)) {
    issues.push('requestedAt must be an ISO timestamp');
  }
  if (request.contextDigest !== context.digest) {
    issues.push('request contextDigest does not bind the supplied context');
  }
  const { validationContext, digestAlgorithm: _algorithm, digest: _digest, ...contextPayload } =
    context;
  void validationContext;
  if (
    context.digestAlgorithm !== 'canonical-json-sha256' ||
    context.digest !== computeProductionAuthoringContextDigest(contextPayload)
  ) {
    issues.push('production authoring context digest is stale');
  }
  if (!nonEmpty(request.model) || !nonEmpty(request.reasoningEffort)) {
    issues.push('exact model and reasoningEffort are required');
  }
  if (
    !Number.isSafeInteger(request.maxOutputTokens) ||
    request.maxOutputTokens < 1
  ) {
    issues.push('maxOutputTokens must be a positive safe integer');
  }
  if (request.noFallback !== true) {
    issues.push('noFallback must be true');
  }
  if (
    !Number.isSafeInteger(request.callBudget?.maxCalls) ||
    request.callBudget.maxCalls < 1 ||
    request.callBudget.maxCalls >
      PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS + 1
  ) {
    issues.push(
      `maxCalls must be between 1 and ${PRE_RENDER_BLUEPRINT_MAX_REPAIR_ATTEMPTS + 1}`,
    );
  }
  if (
    !Number.isSafeInteger(request.callBudget?.maxRepairCount) ||
    request.callBudget.maxRepairCount !== request.callBudget.maxCalls - 1
  ) {
    issues.push('maxRepairCount must equal maxCalls - 1');
  }
  return issues;
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function safeUsage(raw: Record<string, unknown> | null | undefined): SafeAuthoringUsage | null {
  if (!raw) return null;
  const usage: SafeAuthoringUsage = {
    inputTokens:
      numeric(raw.input_tokens) ?? numeric(raw.prompt_tokens),
    outputTokens:
      numeric(raw.output_tokens) ?? numeric(raw.completion_tokens),
    totalTokens: numeric(raw.total_tokens),
    cachedInputTokens:
      numeric(raw.cached_input_tokens) ??
      numeric(
        (raw.input_tokens_details as Record<string, unknown> | undefined)
          ?.cached_tokens,
      ),
    reasoningTokens:
      numeric(raw.reasoning_tokens) ??
      numeric(
        (raw.output_tokens_details as Record<string, unknown> | undefined)
          ?.reasoning_tokens,
      ),
  };
  return Object.values(usage).some((value) => value !== undefined)
    ? usage
    : null;
}

function safeProviderLabel(value: unknown, fallback: string): string {
  if (!nonEmpty(value)) return fallback;
  return value.slice(0, 160).replace(/[\r\n\t]/g, ' ');
}

function receiptPayload(
  receipt: Omit<ProductionAuthoringRunReceipt, 'digestAlgorithm' | 'digest'>,
): unknown {
  return receipt;
}

function finalizeReceipt(
  receipt: Omit<ProductionAuthoringRunReceipt, 'digestAlgorithm' | 'digest'>,
): ProductionAuthoringRunReceipt {
  return {
    ...receipt,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(receiptPayload(receipt)),
  };
}

function failureReceipt(args: {
  request: ProductionAuthoringRunRequest;
  attempts: ProductionAuthoringAttemptReceipt[];
  code: NonNullable<ProductionAuthoringRunReceipt['failure']>['code'];
  message: string;
}): ProductionAuthoringRunReceipt {
  return finalizeReceipt({
    version: PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
    requestDigest: canonicalJsonDigest(args.request),
    requestId: args.request.requestId,
    requestedAt: args.request.requestedAt,
    mode: args.request.mode,
    contextDigest: args.request.contextDigest,
    model: args.request.model,
    reasoningEffort: args.request.reasoningEffort,
    maxOutputTokens: args.request.maxOutputTokens,
    noFallback: true,
    callBudget: args.request.callBudget,
    status: 'failed',
    callCount: args.attempts.length,
    repairCount: Math.max(0, args.attempts.length - 1),
    attempts: args.attempts,
    blueprintDigest: null,
    authoringProvenanceDigest: null,
    failure: { code: args.code, message: args.message },
  });
}

const MAX_PERSISTED_VALIDATION_ERRORS_PER_ATTEMPT = 128;
const MAX_PERSISTED_VALIDATION_ERROR_LENGTH = 2_000;

function boundedValidationErrors(errors: readonly unknown[]): string[] {
  return errors
    .filter((error): error is string => typeof error === 'string')
    .slice(0, MAX_PERSISTED_VALIDATION_ERRORS_PER_ATTEMPT)
    .map((error) =>
      error
        .slice(0, MAX_PERSISTED_VALIDATION_ERROR_LENGTH)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''),
    );
}

function copyValidationExhaustionEvidence(args: {
  error: PreRenderBlueprintAuthoringRepairExhaustedError;
  receipts: ProductionAuthoringAttemptReceipt[];
}): void {
  for (const repairAttempt of args.error.attempts) {
    if (
      !Number.isSafeInteger(repairAttempt.attempt) ||
      repairAttempt.attempt < 1 ||
      repairAttempt.attempt > args.receipts.length
    ) {
      continue;
    }
    const receipt = args.receipts[repairAttempt.attempt - 1];
    if (!receipt || receipt.failureCode !== null) continue;
    receipt.validationErrors = boundedValidationErrors(
      repairAttempt.errors,
    );
  }
}

export async function runProductionBlueprintAuthoring(args: {
  request: ProductionAuthoringRunRequest;
  context: ProductionAuthoringContext;
  provider?: ProductionAuthoringProvider;
}): Promise<ProductionAuthoringRunResult> {
  const invalidRequest = requestIssues(args.request, args.context);
  if (invalidRequest.length > 0) {
    throw new InvalidProductionAuthoringRunRequestError(invalidRequest);
  }
  const config: PreRenderBlueprintAuthoringConfig = {
    model: args.request.model,
    reasoningEffort: args.request.reasoningEffort,
    maxOutputTokens: args.request.maxOutputTokens,
  };
  const contextIssues = preRenderBlueprintAuthoringInputErrors(
    args.context.validationContext,
    config,
  );
  if (contextIssues.length > 0) {
    return {
      receipt: failureReceipt({
        request: args.request,
        attempts: [],
        code: 'context_invalid',
        message: 'authoring context failed deterministic validation',
      }),
      authoringResult: null,
    };
  }
  if (args.request.mode === 'preflight') {
    return {
      receipt: finalizeReceipt({
        version: PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
        requestDigest: canonicalJsonDigest(args.request),
        requestId: args.request.requestId,
        requestedAt: args.request.requestedAt,
        mode: 'preflight',
        contextDigest: args.request.contextDigest,
        model: args.request.model,
        reasoningEffort: args.request.reasoningEffort,
        maxOutputTokens: args.request.maxOutputTokens,
        noFallback: true,
        callBudget: args.request.callBudget,
        status: 'preflight_passed',
        callCount: 0,
        repairCount: 0,
        attempts: [],
        blueprintDigest: null,
        authoringProvenanceDigest: null,
        failure: null,
      }),
      authoringResult: null,
    };
  }
  if (!args.provider) {
    throw new InvalidProductionAuthoringRunRequestError([
      'live mode requires an explicitly injected provider adapter',
    ]);
  }

  const attempts: ProductionAuthoringAttemptReceipt[] = [];
  let callBudgetExhausted = false;
  try {
    const authoringResult = await compilePreRenderBookVisualBlueprint(
      args.context.validationContext,
      config,
      {
        callAuthor: async (systemPrompt, userPrompt, options) => {
          const attempt = attempts.length + 1;
          if (attempt > args.request.callBudget.maxCalls) {
            callBudgetExhausted = true;
            throw new AuthoringCallBudgetError();
          }
          const kind = attempt === 1 ? 'initial' : 'repair';
          const base = {
            attempt,
            kind,
            provider: 'injected-provider',
            model: args.request.model,
            responseId: null,
            systemPromptDigest: canonicalJsonDigest(systemPrompt),
            userPromptDigest: canonicalJsonDigest(userPrompt),
            responseDigest: null,
            usage: null,
            validationErrors: [],
            failureCode: null,
          } satisfies ProductionAuthoringAttemptReceipt;
          try {
            const response = await args.provider!.call({
              attempt,
              kind,
              systemPrompt,
              userPrompt,
              options,
            });
            attempts.push({
              ...base,
              provider: safeProviderLabel(
                response.receipt.provider,
                'injected-provider',
              ),
              model: safeProviderLabel(
                response.receipt.model,
                args.request.model,
              ),
              responseId: nonEmpty(response.receipt.responseId)
                ? response.receipt.responseId.slice(0, 200)
                : null,
              responseDigest: canonicalJsonDigest(response.output),
              usage: safeUsage(response.receipt.usage),
            });
            return response.output;
          } catch (error) {
            const code =
              error instanceof AuthoringCallBudgetError
                ? 'call_budget_exhausted'
                : 'provider_call_failed';
            attempts.push({ ...base, failureCode: code });
            throw error;
          }
        },
      },
    );
    for (const repair of authoringResult.repairAttempts) {
      const receipt = attempts[repair.attempt - 1];
      if (receipt) receipt.validationErrors = [...repair.errors];
    }
    const receipt = finalizeReceipt({
      version: PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
      requestDigest: canonicalJsonDigest(args.request),
      requestId: args.request.requestId,
      requestedAt: args.request.requestedAt,
      mode: 'live',
      contextDigest: args.request.contextDigest,
      model: args.request.model,
      reasoningEffort: args.request.reasoningEffort,
      maxOutputTokens: args.request.maxOutputTokens,
      noFallback: true,
      callBudget: args.request.callBudget,
      status: 'completed',
      callCount: attempts.length,
      repairCount: Math.max(0, attempts.length - 1),
      attempts,
      blueprintDigest: authoringResult.blueprint.digest,
      authoringProvenanceDigest: canonicalJsonDigest(
        authoringResult.provenance,
      ),
      failure: null,
    });
    return { receipt, authoringResult };
  } catch (error) {
    const budgetFailure =
      callBudgetExhausted ||
      error instanceof AuthoringCallBudgetError ||
      attempts.some(
        (attempt) => attempt.failureCode === 'call_budget_exhausted',
      );
    const providerFailure = attempts.some(
      (attempt) => attempt.failureCode === 'provider_call_failed',
    );
    const failureCode = budgetFailure
      ? 'call_budget_exhausted'
      : providerFailure
        ? 'provider_call_failed'
        : 'validation_exhausted';
    if (
      failureCode === 'validation_exhausted' &&
      error instanceof PreRenderBlueprintAuthoringRepairExhaustedError
    ) {
      copyValidationExhaustionEvidence({
        error,
        receipts: attempts,
      });
    }
    return {
      receipt: failureReceipt({
        request: args.request,
        attempts,
        code: failureCode,
        message: budgetFailure
          ? 'authoring stopped at the exact call budget'
          : providerFailure
            ? 'injected provider adapter failed; raw provider errors are not persisted'
            : 'all bounded whole-book validation attempts failed',
      }),
      authoringResult: null,
    };
  }
}

export function persistProductionAuthoringReceipt(args: {
  repoRoot: string;
  outputDir: string;
  receipt: ProductionAuthoringRunReceipt;
  write?: boolean;
}): { receiptPath: string; wrote: boolean } {
  const root = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, root);
  const absolute = path.join(
    root,
    'authoring-receipts',
    `${args.receipt.digest}.json`,
  );
  if (args.write === true) {
    writeImmutableLocalArtifact({
      destinationPath: absolute,
      bytes: `${JSON.stringify(args.receipt, null, 2)}\n`,
    });
  }
  return {
    receiptPath: repoRelativePath(args.repoRoot, absolute),
    wrote: args.write === true,
  };
}
