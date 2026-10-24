/** Pure shared raw-Responses settlement, extracted unchanged to keep source admission off the runner import graph. */
import type { Rates } from './personal-causal-trial-adapters';
import { safeUsage } from './personal-story-trial-guard';
export const RESPONSE_RATES = { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 10, outputMicroUsdPerToken: 50 },
  sol: { inputMicroUsdPerToken: 2, outputMicroUsdPerToken: 10 } };
export function answerSettlement(rate: Rates, outputCap: number, model: string, response: unknown) {
  const r = (response && typeof response === 'object' ? response : {}) as { model?: unknown; service_tier?: unknown; status?: unknown;
    output_text?: unknown; usage?: { input_tokens?: unknown; output_tokens?: unknown } | null };
  const usage = safeUsage(r.usage ? { inputTokens: r.usage.input_tokens, outputTokens: r.usage.output_tokens } : null);
  const estimatedMicroUsd = usage && r.model === model && r.service_tier === 'default'
    ? Math.ceil(usage.inputTokens * rate.inputMicroUsdPerToken + usage.outputTokens * rate.outputMicroUsdPerToken) : null;
  const valid = r.model === model && r.service_tier === 'default' && r.status === 'completed' && !!r.output_text && !!usage &&
    usage.outputTokens <= outputCap;
  return { usage, estimatedMicroUsd, valid };
}
export const replaySettlement = { answer: answerSettlement, rates: RESPONSE_RATES };
