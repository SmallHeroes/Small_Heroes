/**
 * OpenAI image model cost estimates for Phase 2 manifests.
 * Override via env; if unset, estimators return null and log a warning.
 */

export const GPT_IMAGE_2_PRICING = {
  lastUpdated: '2026-05-25',
  source: 'https://openai.com/api/pricing/ (override with GPT_IMAGE_2_COST_PER_1K_* env)',
} as const;

export function estimateGptImage2CostUsd(usage?: Record<string, unknown>): {
  estimatedCostUsd: number | null;
  costRateSource: string;
} {
  const inRaw = process.env.GPT_IMAGE_2_COST_PER_1K_INPUT?.trim();
  const outRaw = process.env.GPT_IMAGE_2_COST_PER_1K_OUTPUT?.trim();
  const inPer1k = inRaw ? Number(inRaw) : NaN;
  const outPer1k = outRaw ? Number(outRaw) : NaN;

  if (!Number.isFinite(inPer1k) || !Number.isFinite(outPer1k)) {
    return {
      estimatedCostUsd: null,
      costRateSource: `${GPT_IMAGE_2_PRICING.source} — set GPT_IMAGE_2_COST_PER_1K_INPUT and GPT_IMAGE_2_COST_PER_1K_OUTPUT`,
    };
  }

  const inputTokens = Number(usage?.input_tokens ?? 0);
  const outputTokens = Number(usage?.output_tokens ?? 0);
  const estimatedCostUsd =
    (inputTokens / 1000) * inPer1k + (outputTokens / 1000) * outPer1k;

  return {
    estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
    costRateSource: `env GPT_IMAGE_2_COST_PER_1K_* (${GPT_IMAGE_2_PRICING.lastUpdated})`,
  };
}
