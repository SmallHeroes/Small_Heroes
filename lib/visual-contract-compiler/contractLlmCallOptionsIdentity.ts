import { canonicalHash } from '@/lib/canonical-json';

import type {
  ContractLlmCallOptions,
} from './compileBookVisualContract';

export const CONTRACT_LLM_CALL_OPTIONS_IDENTITY_VERSION =
  'contract-llm-call-options-identity/v1' as const;

const CONTRACT_LLM_CALL_OPTION_KEY_AUTHORITY = {
  maxOutputTokens: true,
  model: true,
  reasoningEffort: true,
  jsonSchema: true,
  noFallback: true,
  provider: true,
  endpoint: true,
  serviceTier: true,
  toolsDisabled: true,
  transportRetries: true,
  timeoutMs: true,
  maxInputTokens: true,
} satisfies Record<keyof ContractLlmCallOptions, true>;

const CONTRACT_LLM_CALL_OPTION_KEYS = Object.keys(
  CONTRACT_LLM_CALL_OPTION_KEY_AUTHORITY,
) as Array<keyof ContractLlmCallOptions>;

export interface ContractLlmCallOptionsIdentity {
  version: typeof CONTRACT_LLM_CALL_OPTIONS_IDENTITY_VERSION;
  maxOutputTokens: number | null;
  model: string | null;
  reasoningEffort: string | null;
  schemaName: string | null;
  schemaDigest: string | null;
  noFallback: boolean | null;
  provider: 'openai' | null;
  endpoint: 'responses' | null;
  serviceTier: 'default' | null;
  toolsDisabled: true | null;
  transportRetries: number | null;
  timeoutMs: number | null;
  maxInputTokens: number | null;
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

function positiveSafeIntegerOrNull(
  value: unknown,
): number | null | undefined {
  if (value === undefined) return null;
  return Number.isSafeInteger(value) && (value as number) > 0
    ? (value as number)
    : undefined;
}

export function projectContractLlmCallOptionsIdentity(
  options: ContractLlmCallOptions | undefined,
): ContractLlmCallOptionsIdentity | null {
  const value = options ?? {};
  const keys = Object.keys(value);
  if (
    keys.some(
      (key) =>
        !CONTRACT_LLM_CALL_OPTION_KEYS.includes(
          key as keyof ContractLlmCallOptions,
        ),
    )
  ) {
    return null;
  }

  const schema = recordValue(value.jsonSchema);
  const schemaName = schema?.name;
  const schemaValue = schema?.schema;
  const maxOutputTokens = positiveSafeIntegerOrNull(
    value.maxOutputTokens,
  );
  const timeoutMs = positiveSafeIntegerOrNull(value.timeoutMs);
  const maxInputTokens = positiveSafeIntegerOrNull(
    value.maxInputTokens,
  );
  const transportRetries =
    value.transportRetries === undefined
      ? null
      : Number.isSafeInteger(value.transportRetries) &&
          value.transportRetries >= 0
        ? value.transportRetries
        : undefined;
  if (
    maxOutputTokens === undefined ||
    timeoutMs === undefined ||
    maxInputTokens === undefined ||
    transportRetries === undefined ||
    (value.model !== undefined && typeof value.model !== 'string') ||
    (value.reasoningEffort !== undefined &&
      typeof value.reasoningEffort !== 'string') ||
    (value.noFallback !== undefined &&
      typeof value.noFallback !== 'boolean') ||
    (value.provider !== undefined && value.provider !== 'openai') ||
    (value.endpoint !== undefined && value.endpoint !== 'responses') ||
    (value.serviceTier !== undefined &&
      value.serviceTier !== 'default') ||
    (value.toolsDisabled !== undefined &&
      value.toolsDisabled !== true) ||
    (value.jsonSchema !== undefined &&
      (schema === null ||
        typeof schemaName !== 'string' ||
        schemaName.length === 0 ||
        recordValue(schemaValue) === null))
  ) {
    return null;
  }

  return {
    version: CONTRACT_LLM_CALL_OPTIONS_IDENTITY_VERSION,
    maxOutputTokens,
    model: value.model ?? null,
    reasoningEffort: value.reasoningEffort ?? null,
    schemaName:
      typeof schemaName === 'string' ? schemaName : null,
    schemaDigest:
      schemaValue === undefined ? null : canonicalHash(schemaValue),
    noFallback: value.noFallback ?? null,
    provider: value.provider ?? null,
    endpoint: value.endpoint ?? null,
    serviceTier: value.serviceTier ?? null,
    toolsDisabled: value.toolsDisabled ?? null,
    transportRetries,
    timeoutMs,
    maxInputTokens,
  };
}

export function contractLlmCallOptionsIdentityDigest(
  identity: ContractLlmCallOptionsIdentity,
): string {
  return canonicalHash(identity);
}
