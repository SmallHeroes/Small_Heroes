export const VISUAL_CONTRACT_AUTHORING_POLICY_VERSION =
  'visual-contract-authoring-policy/v1' as const;

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
export const VISUAL_CONTRACT_AUTHORING_MAX_CALLS = 3;
export const VISUAL_CONTRACT_AUTHORING_MAX_REPAIRS = 2;
export const VISUAL_CONTRACT_AUTHORING_HARD_COST_CEILING_USD =
  5;

/**
 * Standard-tier prices published for `gpt-5.6-sol`.
 * The preflight projects input at the uncached rate, so caching can only
 * lower actual cost.
 */
export const VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS = {
  version: 'openai-standard-pricing/2026-07-27',
  currency: 'USD',
  unitTokens: 1_000_000,
  inputUsdPerUnit: 5,
  cachedInputUsdPerUnit: 0.5,
  outputUsdPerUnit: 30,
  source:
    'https://developers.openai.com/api/docs/models/gpt-5.6-sol',
} as const;
