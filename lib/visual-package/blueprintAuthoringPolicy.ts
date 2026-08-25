export const BLUEPRINT_AUTHORING_POLICY_VERSION =
  'pre-render-blueprint-authoring-policy/v1' as const;

export const BLUEPRINT_AUTHORING_PROVIDER = 'openai' as const;
export const BLUEPRINT_AUTHORING_ENDPOINT = 'responses' as const;
export const BLUEPRINT_AUTHORING_MODEL = 'gpt-5.6-sol' as const;
export const BLUEPRINT_AUTHORING_SERVICE_TIER = 'default' as const;
export const BLUEPRINT_AUTHORING_REASONING_EFFORT = 'medium' as const;
export const BLUEPRINT_AUTHORING_TOOLS_DISABLED = true as const;
export const BLUEPRINT_AUTHORING_STORE = false as const;
export const BLUEPRINT_AUTHORING_STREAM = true as const;
export const BLUEPRINT_AUTHORING_NO_FALLBACK = true as const;
export const BLUEPRINT_AUTHORING_TRANSPORT_RETRIES = 0 as const;
export const BLUEPRINT_AUTHORING_TIMEOUT_MS = 20 * 60 * 1_000;
export const BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS = 64_000;
export const BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS = 48_000;
export const BLUEPRINT_AUTHORING_MAX_CALLS = 3;
export const BLUEPRINT_AUTHORING_MAX_REPAIRS = 2;
export const BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD = 5;
export const BLUEPRINT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE = 4_096;

export const OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION =
  'openai-responses-blueprint-authoring-evidence/v1' as const;

/**
 * Independent Blueprint spend authority. It deliberately copies the current
 * public price facts instead of importing the Visual Contract policy: a later
 * change to either lifecycle must receive its own explicit version cutover.
 */
export const BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS = {
  version: 'openai-standard-pricing/2026-08-25-v3',
  currency: 'USD',
  unitTokens: 1_000_000,
  uncachedInputUsdPerUnit: 4,
  cacheWriteInputUsdPerUnit: 5,
  cachedInputUsdPerUnit: 0.4,
  outputUsdPerUnit: 20,
  regionalUpliftMultiplier: 1.1,
  source: 'https://developers.openai.com/api/docs/pricing',
} as const;

export interface BlueprintAuthoringInputAccounting {
  systemBytes: number;
  userBytes: number;
  schemaBytes: number;
  separatorBytes: number;
  protocolAllowance: number;
  estimatedBytes: number;
}

const BLUEPRINT_AUTHORING_INPUT_ACCOUNTING_KEYS = [
  'estimatedBytes',
  'protocolAllowance',
  'schemaBytes',
  'separatorBytes',
  'systemBytes',
  'userBytes',
] as const;

export interface BlueprintAuthoringUsage {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

function roundUsd(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function ceilUsd(value: number): number {
  return Math.ceil((value - Number.EPSILON) * 1_000_000) / 1_000_000;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

export function blueprintAuthoringInputAccounting(args: {
  systemPrompt: string;
  userPrompt: string;
  schema: Record<string, unknown>;
}): BlueprintAuthoringInputAccounting {
  const systemBytes = Buffer.byteLength(args.systemPrompt, 'utf8');
  const userBytes = Buffer.byteLength(args.userPrompt, 'utf8');
  const schemaBytes = Buffer.byteLength(JSON.stringify(args.schema), 'utf8');
  const separatorBytes = Buffer.byteLength('\n\n', 'utf8');
  const estimatedBytes =
    systemBytes +
    userBytes +
    schemaBytes +
    separatorBytes +
    BLUEPRINT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE;
  return {
    systemBytes,
    userBytes,
    schemaBytes,
    separatorBytes,
    protocolAllowance: BLUEPRINT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE,
    estimatedBytes,
  };
}

export function blueprintAuthoringInputAccountingIsValid(
  value: unknown,
): value is BlueprintAuthoringInputAccounting {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return false;
  }
  try {
    const candidate = value as Record<string, unknown>;
    if (
      JSON.stringify(Object.keys(candidate).sort()) !==
      JSON.stringify(
        [...BLUEPRINT_AUTHORING_INPUT_ACCOUNTING_KEYS].sort(),
      )
    ) {
      return false;
    }
    const systemBytes = candidate.systemBytes;
    const userBytes = candidate.userBytes;
    const schemaBytes = candidate.schemaBytes;
    const separatorBytes = candidate.separatorBytes;
    const protocolAllowance = candidate.protocolAllowance;
    const estimatedBytes = candidate.estimatedBytes;
    return (
      nonNegativeSafeInteger(systemBytes) &&
      nonNegativeSafeInteger(userBytes) &&
      nonNegativeSafeInteger(schemaBytes) &&
      nonNegativeSafeInteger(separatorBytes) &&
      protocolAllowance ===
        BLUEPRINT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE &&
      nonNegativeSafeInteger(estimatedBytes) &&
      Number.isSafeInteger(
        systemBytes +
          userBytes +
          schemaBytes +
          separatorBytes +
          protocolAllowance,
      ) &&
      estimatedBytes ===
        systemBytes +
          userBytes +
          schemaBytes +
          separatorBytes +
          protocolAllowance
    );
  } catch {
    return false;
  }
}

export function blueprintAuthoringUsageIsInternallyConsistent(
  usage: BlueprintAuthoringUsage,
): boolean {
  const values = Object.values(usage);
  return (
    values.every(nonNegativeSafeInteger) &&
    usage.cachedInputTokens <= usage.inputTokens &&
    usage.cacheWriteInputTokens <=
      usage.inputTokens - usage.cachedInputTokens &&
    usage.reasoningTokens <= usage.outputTokens &&
    Number.isSafeInteger(usage.inputTokens + usage.outputTokens) &&
    usage.totalTokens === usage.inputTokens + usage.outputTokens
  );
}

export function nominalBlueprintAuthoringUsageCostUsd(
  usage: BlueprintAuthoringUsage,
): number {
  if (!blueprintAuthoringUsageIsInternallyConsistent(usage)) {
    throw new Error('blueprint authoring usage is invalid');
  }
  const prices = BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS;
  const uncachedInputTokens =
    usage.inputTokens -
    usage.cachedInputTokens -
    usage.cacheWriteInputTokens;
  return roundUsd(
    (uncachedInputTokens * prices.uncachedInputUsdPerUnit +
      usage.cachedInputTokens * prices.cachedInputUsdPerUnit +
      usage.cacheWriteInputTokens * prices.cacheWriteInputUsdPerUnit +
      usage.outputTokens * prices.outputUsdPerUnit) /
      prices.unitTokens,
  );
}

export function conservativeBlueprintAuthoringCostUsd(args: {
  inputTokens: number;
  outputTokens: number;
}): number {
  if (
    !nonNegativeSafeInteger(args.inputTokens) ||
    !nonNegativeSafeInteger(args.outputTokens)
  ) {
    throw new Error('blueprint authoring token counts are invalid');
  }
  const prices = BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS;
  return ceilUsd(
    ((args.inputTokens * prices.cacheWriteInputUsdPerUnit +
      args.outputTokens * prices.outputUsdPerUnit) /
      prices.unitTokens) *
      prices.regionalUpliftMultiplier,
  );
}

export function projectedMaximumBlueprintAuthoringCostUsd(): number {
  return ceilUsd(
    BLUEPRINT_AUTHORING_MAX_CALLS *
      conservativeBlueprintAuthoringCostUsd({
        inputTokens: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
        outputTokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
      }),
  );
}

export function blueprintAuthoringReservedExposureUsd(args: {
  conservativeAccountedCostUsd: number;
  callsCompleted: number;
}): number {
  if (
    !Number.isFinite(args.conservativeAccountedCostUsd) ||
    args.conservativeAccountedCostUsd < 0 ||
    !Number.isSafeInteger(args.callsCompleted) ||
    args.callsCompleted < 0 ||
    args.callsCompleted > BLUEPRINT_AUTHORING_MAX_CALLS
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const remainingCalls =
    BLUEPRINT_AUTHORING_MAX_CALLS - args.callsCompleted;
  return ceilUsd(
    args.conservativeAccountedCostUsd +
      remainingCalls *
        conservativeBlueprintAuthoringCostUsd({
          inputTokens: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
          outputTokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
        }),
  );
}

export function blueprintAuthoringSpendIsWithinCeiling(
  exposureUsd: number,
): boolean {
  return (
    Number.isFinite(exposureUsd) &&
    exposureUsd >= 0 &&
    exposureUsd <= BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD
  );
}
