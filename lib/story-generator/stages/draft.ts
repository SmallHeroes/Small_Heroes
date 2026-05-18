import { buildDraftSystemPrompt, buildDraftUserPrompt } from '../prompts/draft-prompt';
import type { GenerateInput, Plan } from '../types';
import { getDefaultLLM, type StoryGeneratorLLM } from '../llm';

/** Stage C: LLM → story markdown from plan. */
export async function runDraft(
  plan: Plan,
  input: GenerateInput,
  llm: StoryGeneratorLLM = getDefaultLLM()
): Promise<{ storyMarkdown: string; llmCostUsd: number; modelVersion: string }> {
  const result = await llm.call({
    stage: 'draft',
    systemPrompt: buildDraftSystemPrompt(),
    userPrompt: buildDraftUserPrompt(plan, input),
    maxOutputTokens: 12000,
    jsonMode: false,
  });

  const storyMarkdown = result.text.trim();
  if (!storyMarkdown.includes('--- Page 1 ---')) {
    throw new Error('[draft] Response missing --- Page 1 --- marker');
  }
  return { storyMarkdown, llmCostUsd: result.costUsd, modelVersion: result.modelVersion };
}
