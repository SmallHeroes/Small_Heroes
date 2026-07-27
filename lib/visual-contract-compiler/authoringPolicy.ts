export const VISUAL_CONTRACT_AUTHORING_POLICY_VERSION =
  'visual-contract-authoring-policy/v2' as const;

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
 * Standard-tier prices published for `gpt-5.6-sol`, plus the published
 * regional-processing uplift. Spend authorization uses the cache-write rate
 * and uplift for every possible input token because a provider response does
 * not prove that an otherwise invisible cache write was not billed.
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
