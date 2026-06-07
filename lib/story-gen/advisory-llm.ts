/**
 * Shared LLM JSON helper for advisory modules (freshness, swap, proofread).
 */

import { OpenAIResponsesLLM } from '../story-generator/llm';
import { DEFAULT_STORY_GEN_MODELS } from './story-generation-types';

export async function callAdvisoryLlmJson(args: {
  stage: string;
  systemPrompt: string;
  userPrompt: string;
  modelId?: string;
  maxOutputTokens?: number;
}): Promise<{ text: string; inputTokens: number; outputTokens: number; modelId: string }> {
  const modelId = args.modelId ?? DEFAULT_STORY_GEN_MODELS.judgeModel;
  const llm = new OpenAIResponsesLLM(modelId);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await llm.call({
        stage: args.stage,
        systemPrompt: args.systemPrompt,
        userPrompt: args.userPrompt,
        jsonMode: true,
        maxOutputTokens: args.maxOutputTokens ?? 8192,
        temperature: 0,
      });
      return {
        text: result.text,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        modelId,
      };
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}
