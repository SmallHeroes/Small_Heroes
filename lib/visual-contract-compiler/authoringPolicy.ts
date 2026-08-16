export const VISUAL_CONTRACT_AUTHORING_POLICY_VERSION =
  'visual-contract-authoring-policy/v9' as const;

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
export const VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS = 3;
export const VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_REPAIRS = 2;
export const VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_CALLS = 1;
export const VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_REPAIRS = 1;
export const VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_INPUT_TOKENS =
  6_000;
export const VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_OUTPUT_TOKENS =
  2_000;
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
 * Temporary D1A live-authoring ceiling under the current standard three-call
 * budget plus one closed compact terminal-reference cleanup / $5 fence.
 * Larger books require a separately approved budget or partition Decision
 * Gate before any provider can be reached.
 */
export const VISUAL_CONTRACT_AUTHORING_MAX_PAGES_CURRENT_POLICY =
  12;
export const VISUAL_CONTRACT_AUTHORING_HARD_COST_CEILING_USD =
  5;

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
