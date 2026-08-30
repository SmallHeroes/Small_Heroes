import type { ResponseCreateParamsStreaming } from 'openai/resources/responses/responses';

import {
  BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
  BLUEPRINT_AUTHORING_MAX_CALLS,
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
  BLUEPRINT_AUTHORING_MODEL,
  BLUEPRINT_AUTHORING_NO_FALLBACK,
  BLUEPRINT_AUTHORING_PROVIDER,
  BLUEPRINT_AUTHORING_REASONING_EFFORT,
  BLUEPRINT_AUTHORING_SERVICE_TIER,
  BLUEPRINT_AUTHORING_STORE,
  BLUEPRINT_AUTHORING_STREAM,
  BLUEPRINT_AUTHORING_TIMEOUT_MS,
  BLUEPRINT_AUTHORING_TOOLS_DISABLED,
  BLUEPRINT_AUTHORING_TRANSPORT_RETRIES,
  OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
  blueprintAuthoringInputAccounting,
  blueprintAuthoringReservedExposureUsd,
  blueprintAuthoringSpendIsWithinCeiling,
  blueprintAuthoringUsageIsInternallyConsistent,
  conservativeBlueprintAuthoringCostUsd,
  nominalBlueprintAuthoringUsageCostUsd,
  type BlueprintAuthoringUsage,
} from './blueprintAuthoringPolicy';
import {
  blueprintAuthoringInputTokensExceedCeiling,
  blueprintAuthoringTokenRelevantRequestProjection,
} from './blueprintAuthoringInputTokenAdmission';
import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
} from './preRenderBlueprintDraftSchema';
import type {
  PreRenderBlueprintAuthoringCallOptions,
} from './preRenderBlueprintAuthoring';
import {
  ProductionAuthoringProviderBoundaryError,
  type ProductionAuthoringAttemptFailureCode,
  type ProductionAuthoringAttemptFailureEvidenceReason,
  type ProductionAuthoringProvider,
  type ProductionAuthoringProviderBoundaryEvidence,
  type ProductionAuthoringProviderResponse,
} from './productionAuthoringRunner';
import {
  canonicalAuthoringExecutionAttestation,
  canonicalCompletedExecutionAttestationIsValid,
  notRunAuthoringExecutionAttestation,
} from './authoringTerminalDiagnostics';
import { canonicalJsonDigest, nonEmpty } from './integrity';
import { assertOpenAIResponsesStructuredOutputSchemaCompatible } from './openaiResponsesStructuredOutputSchemaCompatibility';
import {
  createProviderFailureBoundaryObservations,
} from './providerFailureDiagnostics';
import {
  openAIResponsesAuthoringTransport,
  readOpenAIResponsesAuthoringCredential,
  type OpenAIResponsesAuthoringCredentialReader,
  type OpenAIResponsesAuthoringTransport,
} from './openaiResponsesVisualContractAuthoringAdapter';

export type BlueprintAuthoringAdapterBoundaryCode =
  | 'adapter_terminal'
  | 'attempt_sequence_invalid'
  | 'call_budget_exhausted'
  | 'policy_mismatch'
  | 'input_ceiling_exceeded'
  | 'spend_reservation_exceeded'
  | 'provider_call_failed'
  | 'provider_identity_invalid'
  | 'provider_completion_invalid'
  | 'provider_evidence_invalid'
  | 'usage_invalid'
  | 'cost_ceiling_exceeded';

function productionFailureCode(
  code: BlueprintAuthoringAdapterBoundaryCode,
): ProductionAuthoringAttemptFailureCode {
  switch (code) {
    case 'call_budget_exhausted':
      return 'call_budget_exhausted';
    case 'provider_call_failed':
      return 'provider_call_failed';
    case 'provider_completion_invalid':
      return 'completion_status_invalid';
    case 'provider_evidence_invalid':
      return 'provider_evidence_invalid';
    case 'usage_invalid':
      return 'usage_invalid';
    case 'spend_reservation_exceeded':
    case 'cost_ceiling_exceeded':
      return 'cost_ceiling_exceeded';
    case 'adapter_terminal':
    case 'attempt_sequence_invalid':
    case 'policy_mismatch':
    case 'provider_identity_invalid':
      return 'provider_policy_mismatch';
    case 'input_ceiling_exceeded':
      return 'input_token_ceiling_exceeded';
  }
}

function adapterFailureEvidenceReason(
  code: BlueprintAuthoringAdapterBoundaryCode,
): ProductionAuthoringAttemptFailureEvidenceReason {
  switch (code) {
    case 'provider_call_failed':
      return 'provider_call_failed';
    case 'provider_identity_invalid':
      return 'provider_identity_mismatch';
    case 'provider_completion_invalid':
      return 'completion_status_invalid';
    case 'usage_invalid':
      return 'usage_invalid';
    case 'input_ceiling_exceeded':
      return 'input_ceiling_exceeded';
    case 'spend_reservation_exceeded':
      return 'spend_reservation_exceeded';
    case 'cost_ceiling_exceeded':
      return 'cost_ceiling_exceeded';
    case 'provider_evidence_invalid':
      return 'boundary_reason_invalid';
    case 'adapter_terminal':
    case 'attempt_sequence_invalid':
    case 'call_budget_exhausted':
    case 'policy_mismatch':
      return 'adapter_policy_mismatch';
  }
}

export class BlueprintAuthoringAdapterBoundaryError extends ProductionAuthoringProviderBoundaryError {
  constructor(
    readonly code: BlueprintAuthoringAdapterBoundaryCode,
    evidence: ProductionAuthoringProviderBoundaryEvidence = {},
    failureEvidenceReason: ProductionAuthoringAttemptFailureEvidenceReason =
      adapterFailureEvidenceReason(code),
  ) {
    super(productionFailureCode(code), evidence, failureEvidenceReason);
    this.message = `blueprint_authoring_${code}`;
    this.name = 'BlueprintAuthoringAdapterBoundaryError';
  }
}

export interface OpenAIResponsesBlueprintAuthoringAdapterDeps {
  transport?: OpenAIResponsesAuthoringTransport;
  readCredential?: OpenAIResponsesAuthoringCredentialReader;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function exactJson(left: unknown, right: unknown): boolean {
  return canonicalJsonDigest(left) === canonicalJsonDigest(right);
}

function expectedCallOptions(): PreRenderBlueprintAuthoringCallOptions {
  return {
    model: BLUEPRINT_AUTHORING_MODEL,
    reasoningEffort: BLUEPRINT_AUTHORING_REASONING_EFFORT,
    maxOutputTokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
    jsonSchema: {
      name: PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
      schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
      strict: true,
    },
    noFallback: BLUEPRINT_AUTHORING_NO_FALLBACK,
  };
}

function callPolicyIssues(args: {
  attempt: number;
  kind: 'initial' | 'repair';
  systemPrompt: string;
  userPrompt: string;
  options: PreRenderBlueprintAuthoringCallOptions;
  callsCompleted: number;
}): string[] {
  const issues: string[] = [];
  const expectedAttempt = args.callsCompleted + 1;
  if (
    !Number.isSafeInteger(args.attempt) ||
    args.attempt !== expectedAttempt
  ) {
    issues.push('attempt_sequence');
  }
  if (args.attempt > BLUEPRINT_AUTHORING_MAX_CALLS) {
    issues.push('call_budget');
  }
  const expectedKind = expectedAttempt === 1 ? 'initial' : 'repair';
  if (args.kind !== expectedKind) {
    issues.push('kind');
  }
  if (!nonEmpty(args.systemPrompt) || !nonEmpty(args.userPrompt)) {
    issues.push('prompts');
  }
  if (!exactJson(args.options, expectedCallOptions())) {
    issues.push('call_options');
  }
  return issues;
}

export function buildOpenAIResponsesBlueprintAuthoringBody(args: {
  systemPrompt: string;
  userPrompt: string;
  options: PreRenderBlueprintAuthoringCallOptions;
}): ResponseCreateParamsStreaming {
  if (
    callPolicyIssues({
      ...args,
      attempt: 1,
      kind: 'initial',
      callsCompleted: 0,
    }).length > 0
  ) {
    throw new BlueprintAuthoringAdapterBoundaryError('policy_mismatch');
  }
  const tokenProjection = blueprintAuthoringTokenRelevantRequestProjection({
    model: BLUEPRINT_AUTHORING_MODEL,
    systemPrompt: args.systemPrompt,
    userPrompt: args.userPrompt,
    reasoningEffort: args.options.reasoningEffort,
    schemaName: args.options.jsonSchema.name,
    schema: args.options.jsonSchema.schema,
  });
  const body: ResponseCreateParamsStreaming = {
    ...tokenProjection,
    reasoning: {
      effort: tokenProjection.reasoning
        .effort as typeof BLUEPRINT_AUTHORING_REASONING_EFFORT,
    },
    service_tier: BLUEPRINT_AUTHORING_SERVICE_TIER,
    max_output_tokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
    store: BLUEPRINT_AUTHORING_STORE,
    stream: BLUEPRINT_AUTHORING_STREAM,
  };
  const format = body.text?.format;
  assertOpenAIResponsesStructuredOutputSchemaCompatible(
    format?.type === 'json_schema' ? format.schema : null,
  );
  return body;
}

function responseOutputText(response: Record<string, unknown> | null): string {
  if (typeof response?.output_text === 'string') {
    return response.output_text;
  }
  if (!Array.isArray(response?.output)) return '';
  const texts: string[] = [];
  for (const rawItem of response.output) {
    const item = record(rawItem);
    if (item?.type !== 'message') continue;
    if (!Array.isArray(item.content)) return '';
    for (const rawContent of item.content) {
      const content = record(rawContent);
      if (content?.type !== 'output_text') continue;
      if (typeof content.text !== 'string') return '';
      texts.push(content.text);
    }
  }
  return texts.join('');
}

function responseUsage(rawUsage: unknown): BlueprintAuthoringUsage | null {
  const usage = record(rawUsage);
  const inputDetails = record(usage?.input_tokens_details);
  const outputDetails = record(usage?.output_tokens_details);
  const mapped = {
    inputTokens: usage?.input_tokens,
    cachedInputTokens: inputDetails?.cached_tokens,
    cacheWriteInputTokens: inputDetails?.cache_write_tokens,
    outputTokens: usage?.output_tokens,
    reasoningTokens: outputDetails?.reasoning_tokens,
    totalTokens: usage?.total_tokens,
  };
  if (!Object.values(mapped).every(nonNegativeSafeInteger)) return null;
  const complete = mapped as BlueprintAuthoringUsage;
  return blueprintAuthoringUsageIsInternallyConsistent(complete)
    ? complete
    : null;
}

function adapterReceiptUsage(
  usage: BlueprintAuthoringUsage,
): Record<string, unknown> {
  return {
    input_tokens: usage.inputTokens,
    cached_input_tokens: usage.cachedInputTokens,
    cache_write_input_tokens: usage.cacheWriteInputTokens,
    output_tokens: usage.outputTokens,
    reasoning_tokens: usage.reasoningTokens,
    total_tokens: usage.totalTokens,
  };
}

/**
 * Canonical Blueprint Responses boundary. Construction is pure. Each call is
 * admitted and reserved before the credential reader is invoked, and any
 * failure terminally closes this adapter instance so compiler repair cannot
 * turn a boundary failure into another paid dispatch.
 */
export function createOpenAIResponsesBlueprintAuthoringAdapter(
  deps: OpenAIResponsesBlueprintAuthoringAdapterDeps = {},
): ProductionAuthoringProvider {
  const transport = deps.transport ?? openAIResponsesAuthoringTransport;
  const readCredential =
    deps.readCredential ?? readOpenAIResponsesAuthoringCredential;
  let callsCompleted = 0;
  let conservativeAccountedCostUsd = 0;
  let terminal = false;

  return {
    call: async (args): Promise<ProductionAuthoringProviderResponse> => {
      if (terminal) {
        throw new BlueprintAuthoringAdapterBoundaryError('adapter_terminal');
      }
      const closeAndThrow = (
        code: BlueprintAuthoringAdapterBoundaryCode,
        evidence: ProductionAuthoringProviderBoundaryEvidence = {},
        failureEvidenceReason: ProductionAuthoringAttemptFailureEvidenceReason =
          adapterFailureEvidenceReason(code),
      ): never => {
        terminal = true;
        throw new BlueprintAuthoringAdapterBoundaryError(
          code,
          evidence,
          failureEvidenceReason,
        );
      };
      const policyIssues = callPolicyIssues({
        ...args,
        callsCompleted,
      });
      if (policyIssues.includes('call_budget')) {
        closeAndThrow('call_budget_exhausted');
      }
      if (policyIssues.includes('attempt_sequence')) {
        closeAndThrow('attempt_sequence_invalid');
      }
      if (policyIssues.length > 0) {
        closeAndThrow('policy_mismatch');
      }

      const inputAccounting = blueprintAuthoringInputAccounting({
        systemPrompt: args.systemPrompt,
        userPrompt: args.userPrompt,
        schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
      });
      const reservedExposureBeforeCallUsd =
        blueprintAuthoringReservedExposureUsd({
          conservativeAccountedCostUsd,
          callsCompleted,
        });
      const preDispatchEvidence = {
        provider: BLUEPRINT_AUTHORING_PROVIDER,
        model: BLUEPRINT_AUTHORING_MODEL,
        providerEvidenceVersion:
          OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
        inputAccounting,
        reservedExposureBeforeCallUsd,
        executionAttestation:
          notRunAuthoringExecutionAttestation(),
      } satisfies ProductionAuthoringProviderBoundaryEvidence;
      if (blueprintAuthoringInputTokensExceedCeiling(inputAccounting)) {
        closeAndThrow(
          'input_ceiling_exceeded',
          preDispatchEvidence,
        );
      }
      if (
        !blueprintAuthoringSpendIsWithinCeiling(
          reservedExposureBeforeCallUsd,
        )
      ) {
        closeAndThrow(
          'spend_reservation_exceeded',
          preDispatchEvidence,
        );
      }

      const requestOptions = {
        maxRetries: BLUEPRINT_AUTHORING_TRANSPORT_RETRIES,
        timeout: BLUEPRINT_AUTHORING_TIMEOUT_MS,
      } as const;
      const observations = createProviderFailureBoundaryObservations({
        adapterInvoked: true,
        requestOptionsDigest: canonicalJsonDigest(requestOptions),
      });
      const body: ResponseCreateParamsStreaming = (() => {
        try {
          const built = buildOpenAIResponsesBlueprintAuthoringBody(args);
          observations.requestBodyDigest = canonicalJsonDigest(built);
          observations.canonicalModelConfirmed =
            built.model === BLUEPRINT_AUTHORING_MODEL;
          return built;
        } catch {
          return closeAndThrow('policy_mismatch', preDispatchEvidence);
        }
      })();

      const apiKey: string = (() => {
        try {
          const credential = readCredential();
          observations.credentialReadSucceeded = true;
          return credential;
        } catch {
          return closeAndThrow(
            'provider_call_failed',
            preDispatchEvidence,
          );
        }
      })();

      let rawResponse: unknown;
      try {
        rawResponse = await transport.create({
          apiKey,
          body,
          requestOptions,
          observations,
        });
      } catch {
        const executionAttestation =
          canonicalAuthoringExecutionAttestation({
            transportDispatchCount:
              observations.transportDispatchCount,
            fallbackUsed: false,
            canonicalRouteConfirmed:
              observations.canonicalRouteConfirmed,
            canonicalModelConfirmed:
              observations.canonicalModelConfirmed,
          });
        closeAndThrow(
          'provider_call_failed',
          {
            ...preDispatchEvidence,
            executionAttestation,
          },
        );
      }

      const response = record(rawResponse);
      const output = responseOutputText(response);
      const responseId = response?.id;
      const usage = responseUsage(response?.usage);
      const executionAttestation = canonicalAuthoringExecutionAttestation({
        transportDispatchCount: observations.transportDispatchCount,
        fallbackUsed: false,
        canonicalRouteConfirmed: observations.canonicalRouteConfirmed,
        canonicalModelConfirmed: observations.canonicalModelConfirmed,
      });
      const nominalEstimatedCostUsd = usage
        ? nominalBlueprintAuthoringUsageCostUsd(usage)
        : null;
      const conservativeCallCostUsd = usage
        ? conservativeBlueprintAuthoringCostUsd({
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          })
        : null;
      const nextConservativeAccountedCostUsd =
        conservativeCallCostUsd === null
          ? null
          : conservativeAccountedCostUsd +
            conservativeCallCostUsd;
      const responseBoundaryEvidence = {
        ...preDispatchEvidence,
        model: response?.model,
        responseId,
        responseDigest: canonicalJsonDigest(output),
        usage: usage ? adapterReceiptUsage(usage) : null,
        completionStatus: response?.status,
        usageEvidenceComplete: usage !== null,
        nominalEstimatedCostUsd,
        conservativeCallCostUsd,
        cumulativeConservativeCostUsd:
          nextConservativeAccountedCostUsd,
        executionAttestation,
      } satisfies ProductionAuthoringProviderBoundaryEvidence;
      if (response?.model !== BLUEPRINT_AUTHORING_MODEL) {
        closeAndThrow(
          'provider_identity_invalid',
          responseBoundaryEvidence,
        );
      }
      if (
        typeof responseId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,200}$/.test(responseId)
      ) {
        closeAndThrow(
          'provider_evidence_invalid',
          responseBoundaryEvidence,
          'response_id_invalid',
        );
      }
      if (!output.trim()) {
        closeAndThrow(
          'provider_evidence_invalid',
          responseBoundaryEvidence,
          'response_output_empty',
        );
      }
      if (!canonicalCompletedExecutionAttestationIsValid(executionAttestation)) {
        closeAndThrow(
          'provider_evidence_invalid',
          responseBoundaryEvidence,
          'execution_attestation_invalid',
        );
      }
      if (response?.status !== 'completed') {
        closeAndThrow(
          'provider_completion_invalid',
          responseBoundaryEvidence,
        );
      }
      if (
        !usage ||
        usage.inputTokens > BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS ||
        usage.outputTokens > BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS
      ) {
        closeAndThrow(
          'usage_invalid',
          responseBoundaryEvidence,
        );
      }
      const acceptedUsage = usage as BlueprintAuthoringUsage;
      const acceptedResponseId = responseId as string;
      const acceptedConservativeAccountedCostUsd =
        nextConservativeAccountedCostUsd ??
        closeAndThrow(
          'cost_ceiling_exceeded',
          responseBoundaryEvidence,
        );
      if (
        acceptedConservativeAccountedCostUsd >
        BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD
      ) {
        closeAndThrow(
          'cost_ceiling_exceeded',
          responseBoundaryEvidence,
        );
      }

      callsCompleted += 1;
      conservativeAccountedCostUsd =
        acceptedConservativeAccountedCostUsd;
      return {
        output,
        receipt: {
          provider: BLUEPRINT_AUTHORING_PROVIDER,
          model: BLUEPRINT_AUTHORING_MODEL,
          responseId: acceptedResponseId,
          usage: adapterReceiptUsage(acceptedUsage),
          evidenceVersion:
            OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
          completionStatus: 'completed',
          usageEvidenceComplete: true,
          executionAttestation,
          inputAccounting,
          reservedExposureBeforeCallUsd,
          nominalEstimatedCostUsd:
            nominalEstimatedCostUsd!,
          conservativeCallCostUsd:
            conservativeCallCostUsd!,
        },
      };
    },
  };
}
