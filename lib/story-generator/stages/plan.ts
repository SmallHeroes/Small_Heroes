import { buildPlanSystemPrompt, buildPlanUserPrompt } from '../prompts/plan-prompt';
import type { GenerateInput, Plan } from '../types';
import { getDefaultLLM, parseJsonFromLLM, type StoryGeneratorLLM } from '../llm';

/** Stage A: LLM → structured Plan JSON. */
export async function runPlan(
  input: GenerateInput,
  feedback?: string,
  llm: StoryGeneratorLLM = getDefaultLLM()
): Promise<{ plan: Plan; llmCostUsd: number; modelVersion: string }> {
  const result = await llm.call({
    stage: 'plan',
    systemPrompt: buildPlanSystemPrompt(),
    userPrompt: buildPlanUserPrompt(input, feedback),
    maxOutputTokens: 4096,
    jsonMode: true,
  });

  const plan = parseJsonFromLLM<Plan>(result.text, 'plan');
  return { plan, llmCostUsd: result.costUsd, modelVersion: result.modelVersion };
}
