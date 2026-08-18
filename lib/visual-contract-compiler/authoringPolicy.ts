export const VISUAL_CONTRACT_AUTHORING_POLICY_VERSION =
  'visual-contract-authoring-policy/v16' as const;

export const VISUAL_CONTRACT_AUTHORING_STANDARD_ATTEMPT_OUTPUT_BUDGET_VERSION =
  'visual-contract-authoring-standard-attempt-output-budget/v5' as const;

export const VISUAL_CONTRACT_AUTHORING_PROVIDER = 'openai' as const;
export const VISUAL_CONTRACT_AUTHORING_ENDPOINT = 'responses' as const;
export const VISUAL_CONTRACT_AUTHORING_MODEL = 'gpt-5.6-sol' as const;
export const VISUAL_CONTRACT_AUTHORING_SERVICE_TIER =
  'default' as const;
export const VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT =
  'medium' as const;
export const VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED =
  true as const;
export const VISUAL_CONTRACT_AUTHORING_NO_FALLBACK = true as const;
export const VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES =
  0 as const;
export const VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS =
  20 * 60 * 1_000;
export const VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS =
  64_000;
export const VISUAL_CONTRACT_AUTHORING_STANDARD_OUTPUT_BASE_MIN_TOKENS =
  32_000;
export const VISUAL_CONTRACT_AUTHORING_PROVIDER_MAX_OUTPUT_TOKENS =
  64_000;
export const VISUAL_CONTRACT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE =
  4_096;
export const VISUAL_CONTRACT_AUTHORING_ROUTE_SAFETY_MARGIN =
  4_096;
export const VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS = 6;
export const VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_REPAIRS = 5;
export const VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_CALLS = 1;
export const VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_REPAIRS = 1;
export const VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_INPUT_TOKENS =
  12_000;
export const VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_OUTPUT_TOKENS =
  1_000;
export const VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_ELIGIBLE_PRECEDING_REPAIR_MODES =
  ['book_surface_patch', 'full_draft'] as const;

export function terminalReferenceCleanupPredecessorIsEligible(
  repairMode: unknown,
): repairMode is
  (typeof VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_ELIGIBLE_PRECEDING_REPAIR_MODES)[number] {
  return VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_ELIGIBLE_PRECEDING_REPAIR_MODES.some(
    (eligibleMode) => repairMode === eligibleMode,
  );
}
export const VISUAL_CONTRACT_AUTHORING_MAX_CALLS =
  VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS +
  VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_CALLS;
export const VISUAL_CONTRACT_AUTHORING_MAX_REPAIRS =
  VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_REPAIRS +
  VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_REPAIRS;
/**
 * Temporary D1A live-authoring ceiling under the current standard six-call
 * budget plus one closed compact terminal-reference cleanup / $10 fence.
 * Larger books require a separately approved budget or partition Decision
 * Gate before any provider can be reached.
 */
export const VISUAL_CONTRACT_AUTHORING_MAX_PAGES_CURRENT_POLICY =
  12;
export const VISUAL_CONTRACT_AUTHORING_HARD_COST_CEILING_USD =
  10;

/**
 * Rejected-request evidence must always carry a schedule that is valid under
 * the current admission policy. This normalization is evidence-only: request
 * construction and admission continue to use the actual snapshot page count.
 */
export function authoringRejectedEvidencePageCount(
  pageCount: number,
): number {
  const positivePageCount =
    Number.isSafeInteger(pageCount) && pageCount > 0
      ? pageCount
      : VISUAL_CONTRACT_AUTHORING_MAX_PAGES_CURRENT_POLICY;
  return Math.min(
    positivePageCount,
    VISUAL_CONTRACT_AUTHORING_MAX_PAGES_CURRENT_POLICY,
  );
}

export type VisualContractAuthoringStandardAttemptOutputLimits = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * Existing page-derived per-call base. The current admission gate remains the
 * authority that prevents 13+ page live authoring; this pure calculation is
 * intentionally backward-compatible for offline callers and diagnostics.
 */
export function authoringMaxOutputTokens(pageCount: number): number {
  const pages =
    Number.isFinite(pageCount) && pageCount > 0
      ? pageCount
      : 12;
  return Math.min(
    VISUAL_CONTRACT_AUTHORING_PROVIDER_MAX_OUTPUT_TOKENS,
    Math.max(
      VISUAL_CONTRACT_AUTHORING_STANDARD_OUTPUT_BASE_MIN_TOKENS,
      Math.round(pages * 3_000),
    ),
  );
}

/**
 * Canonical ordered limits for initial and repairs 1 through 5. The initial
 * call retains headroom above the legacy base, repair 1 funds the compact
 * correction path, and repairs 2 through 5 each recover the full legacy base.
 * Complementary rounding keeps the standard output pool equal to six legacy
 * per-call bases for every admitted page count.
 */
export function authoringStandardAttemptOutputLimits(
  pageCount: number,
): VisualContractAuthoringStandardAttemptOutputLimits {
  return authoringStandardAttemptOutputLimitsForBase(
    authoringMaxOutputTokens(pageCount),
  );
}

/**
 * Canonical schedule calculation for validators that receive a persisted
 * output pool rather than the originating page count.
 */
export function authoringStandardAttemptOutputLimitsForBase(
  base: number,
): VisualContractAuthoringStandardAttemptOutputLimits {
  const initial = Math.ceil((10 * base) / 9);
  const firstRepair = Math.floor((8 * base) / 9);
  const secondRepair = 3 * base - initial - firstRepair;
  return [initial, firstRepair, secondRepair, base, base, base];
}

export interface VisualContractAuthoringInputAccounting {
  systemBytes: number;
  userBytes: number;
  schemaBytes: number;
  separatorBytes: number;
  protocolAllowance: number;
  estimatedBytes: number;
}

export function visualContractAuthoringInputAccounting(
  systemPrompt: string,
  userPrompt: string,
  schema: Record<string, unknown>,
): VisualContractAuthoringInputAccounting {
  const systemBytes = Buffer.byteLength(systemPrompt, 'utf8');
  const userBytes = Buffer.byteLength(userPrompt, 'utf8');
  const schemaBytes = Buffer.byteLength(
    JSON.stringify(schema),
    'utf8',
  );
  const separatorBytes = Buffer.byteLength('\n\n', 'utf8');
  const estimatedBytes =
    systemBytes +
    userBytes +
    schemaBytes +
    separatorBytes +
    VISUAL_CONTRACT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE;
  return {
    systemBytes,
    userBytes,
    schemaBytes,
    separatorBytes,
    protocolAllowance:
      VISUAL_CONTRACT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE,
    estimatedBytes,
  };
}

export function visualContractAuthoringRouteIsAdmissible(args: {
  systemPrompt: string;
  userPrompt: string;
  schema: Record<string, unknown>;
  maxInputTokens?: number;
  safetyMargin?: number;
}): boolean {
  const maxInputTokens =
    args.maxInputTokens ??
    VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS;
  const safetyMargin =
    args.safetyMargin ??
    VISUAL_CONTRACT_AUTHORING_ROUTE_SAFETY_MARGIN;
  if (
    !Number.isInteger(maxInputTokens) ||
    !Number.isInteger(safetyMargin) ||
    maxInputTokens < 1 ||
    safetyMargin < 0 ||
    safetyMargin >= maxInputTokens
  ) {
    return false;
  }
  return (
    visualContractAuthoringInputAccounting(
      args.systemPrompt,
      args.userPrompt,
      args.schema,
    ).estimatedBytes <=
    maxInputTokens - safetyMargin
  );
}

/**
 * Standard-tier prices published for `gpt-5.6-sol`, plus the published
 * regional-processing uplift. Spend authorization uses the cache-write rate
 * and uplift for every possible input token so the conservative reservation
 * remains independent of the provider-reported input partition.
 */
export const VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS = {
  version: 'openai-standard-pricing/2026-07-27-v2',
  currency: 'USD',
  unitTokens: 1_000_000,
  uncachedInputUsdPerUnit: 5,
  cacheWriteInputUsdPerUnit: 6.25,
  cachedInputUsdPerUnit: 0.5,
  outputUsdPerUnit: 30,
  regionalUpliftMultiplier: 1.1,
  source:
    'https://developers.openai.com/api/docs/pricing',
} as const;
