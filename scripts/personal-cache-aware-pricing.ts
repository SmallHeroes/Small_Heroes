/**
 * Cache-aware estimate for OpenAI Responses text calls (Astra planner, Sol reviewer). Not an invoice.
 *
 * Official short-context Standard rates (verified by Codex QA on 2026-10-12 against the OpenAI pricing and prompt-caching docs).
 * Kept in TENTHS of a micro-USD per token so every rate is an exact integer (12.5 µUSD = 125). A cache WRITE replaces the ordinary
 * input rate for those tokens (it is not added on top); a cache READ is billed at the cached rate. Implicit caching is on by default,
 * so the provider-reported split is required: a usage record without both counts, or with inconsistent counts, has NO known cost.
 *
 * Policy (option A of the corrected re-plan brief): keep the existing request format and implicit caching; reserve the worst case,
 * every input token at the cache-write rate (the highest input rate), plus the existing 10% buffer.
 */
export const CACHE_AWARE_PRICING_VERSION = 'openai-short-context-standard-cache-aware/2026-10-12' as const;
export const CACHE_POLICY = 'implicit-cache-worst-case-write/v1' as const;
export const CACHE_AWARE_RATES = Object.freeze({
  'gpt-6-astra': Object.freeze({ ordinary: 100, cacheRead: 10, cacheWrite: 125, output: 500 }),
  'gpt-6.1-sol': Object.freeze({ ordinary: 20, cacheRead: 1, cacheWrite: 25, output: 100 }),
});
export type CacheAwareModel = keyof typeof CACHE_AWARE_RATES;
/** Above this many input tokens a different (long-context) rate applies; these rates are then not the price, so the cost is unknown. */
export const SHORT_CONTEXT_INPUT_TOKENS = 272_000;
export const RESERVATION_BUFFER_PERCENT = 10;

export type CacheAwareUsage = { inputTokens: number; ordinaryInputTokens: number; cacheReadTokens: number; cacheWriteTokens: number;
  outputTokens: number; reasoningTokens: number; totalTokens: number };

// Integer ceiling division (no floating-point rounding at a whole micro-USD).
const ceilDiv = (n: number, d: number) => Math.floor((n + d - 1) / d);
const count = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;
const isModel = (model: string): model is CacheAwareModel => Object.prototype.hasOwnProperty.call(CACHE_AWARE_RATES, model);

/** Strict reading of a Responses `usage` record. Missing, non-integer, negative or inconsistent counts give null (unknown cost). */
export function cacheAwareUsage(raw: unknown): CacheAwareUsage | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>, input = u.input_tokens_details, output = u.output_tokens_details;
  if (!input || typeof input !== 'object' || !output || typeof output !== 'object') return null;
  const inputTokens = count(u.input_tokens), outputTokens = count(u.output_tokens), totalTokens = count(u.total_tokens);
  const cacheReadTokens = count((input as Record<string, unknown>).cached_tokens), cacheWriteTokens = count((input as Record<string, unknown>).cache_write_tokens);
  const reasoningTokens = count((output as Record<string, unknown>).reasoning_tokens);
  if (inputTokens === null || outputTokens === null || totalTokens === null || cacheReadTokens === null || cacheWriteTokens === null ||
      reasoningTokens === null || cacheReadTokens + cacheWriteTokens > inputTokens || reasoningTokens > outputTokens ||
      totalTokens !== inputTokens + outputTokens || inputTokens > SHORT_CONTEXT_INPUT_TOKENS) return null;
  return { inputTokens, ordinaryInputTokens: inputTokens - cacheReadTokens - cacheWriteTokens, cacheReadTokens, cacheWriteTokens,
    outputTokens, reasoningTokens, totalTokens };
}

/** Rounded up to a whole micro-USD. Unknown model or usage: null. */
export function cacheAwareCostMicroUsd(model: string, usage: CacheAwareUsage | null): number | null {
  if (!usage || !isModel(model)) return null;
  const r = CACHE_AWARE_RATES[model];
  const tenths = usage.ordinaryInputTokens * r.ordinary + usage.cacheReadTokens * r.cacheRead + usage.cacheWriteTokens * r.cacheWrite + usage.outputTokens * r.output;
  return ceilDiv(tenths, 10);
}

/** Worst case: every input token (bounded by the UTF-8 payload bytes) at the cache-write rate, the full output cap, plus 10%. Exact integers. */
export function cacheAwareReservationMicroUsd(model: string, maxInputTokens: number, maxOutputTokens: number) {
  if (!isModel(model) || ![maxInputTokens, maxOutputTokens].every(n => Number.isSafeInteger(n) && n > 0) || maxInputTokens > SHORT_CONTEXT_INPUT_TOKENS)
    throw Error('cache_aware_pricing_policy');
  const r = CACHE_AWARE_RATES[model];
  const tenths = maxInputTokens * r.cacheWrite + maxOutputTokens * r.output;
  return ceilDiv(tenths * (100 + RESERVATION_BUFFER_PERCENT), 1000);
}
