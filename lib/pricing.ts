/**
 * OpenAI image model cost estimates for Phase 2 manifests.
 * Override via env; if unset, estimators return null and log a warning.
 */

export const GPT_IMAGE_2_PRICING = {
  lastUpdated: '2026-05-25',
  source: 'https://openai.com/api/pricing/ (override with GPT_IMAGE_2_COST_PER_1K_* env)',
  /** $8/1M image+text input blended per-1k fallback when env unset. */
  defaultInputPer1k: 0.008,
  /** $30/1M image output per-1k fallback when env unset. */
  defaultOutputPer1k: 0.03,
} as const;

export function estimateGptImage2CostUsd(usage?: Record<string, unknown>): {
  estimatedCostUsd: number | null;
  costRateSource: string;
} {
  const inRaw = process.env.GPT_IMAGE_2_COST_PER_1K_INPUT?.trim();
  const outRaw = process.env.GPT_IMAGE_2_COST_PER_1K_OUTPUT?.trim();
  const inPer1k = inRaw ? Number(inRaw) : GPT_IMAGE_2_PRICING.defaultInputPer1k;
  const outPer1k = outRaw ? Number(outRaw) : GPT_IMAGE_2_PRICING.defaultOutputPer1k;

  if (!Number.isFinite(inPer1k) || !Number.isFinite(outPer1k)) {
    return {
      estimatedCostUsd: null,
      costRateSource: `${GPT_IMAGE_2_PRICING.source} — set GPT_IMAGE_2_COST_PER_1K_INPUT and GPT_IMAGE_2_COST_PER_1K_OUTPUT`,
    };
  }

  const inputTokens = Number(
    usage?.input_tokens ?? usage?.prompt_tokens ?? usage?.input_image_tokens ?? 0
  );
  const outputTokens = Number(
    usage?.output_tokens ?? usage?.completion_tokens ?? usage?.output_image_tokens ?? 0
  );
  if (!usage || (inputTokens === 0 && outputTokens === 0)) {
    return {
      estimatedCostUsd: null,
      costRateSource: inRaw && outRaw
        ? `env GPT_IMAGE_2_COST_PER_1K_* (${GPT_IMAGE_2_PRICING.lastUpdated})`
        : `${GPT_IMAGE_2_PRICING.source} — no usage tokens on response`,
    };
  }

  const estimatedCostUsd =
    (inputTokens / 1000) * inPer1k + (outputTokens / 1000) * outPer1k;

  return {
    estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
    costRateSource: inRaw && outRaw
      ? `env GPT_IMAGE_2_COST_PER_1K_* (${GPT_IMAGE_2_PRICING.lastUpdated})`
      : `built-in gpt-image-2 defaults (${GPT_IMAGE_2_PRICING.lastUpdated})`,
  };
}
