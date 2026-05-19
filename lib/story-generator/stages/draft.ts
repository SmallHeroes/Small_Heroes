import { buildDraftSystemPrompt, buildDraftUserPrompt } from '../prompts/draft-prompt';
import type { GenerateInput, Plan } from '../types';
import { getDefaultLLM, type StoryGeneratorLLM } from '../llm';
import { getDraftMode } from '../editorial/config';
import { runStructuredDraft, type AutoInjection } from './structured-draft';

export interface DraftResult {
  storyMarkdown: string;
  llmCostUsd: number;
  modelVersion: string;
  /** v0.4.6+ — only present in structured mode when code injected lines. */
  autoInjections?: AutoInjection[];
}

/**
 * Stage C: LLM → story markdown from plan.
 *
 * v0.4 — dispatches to runStructuredDraft when DRAFT_MODE=structured.
 * Free-form mode remains the default for safety.
 */
export async function runDraft(
  plan: Plan,
  input: GenerateInput,
  llm: StoryGeneratorLLM = getDefaultLLM()
): Promise<DraftResult> {
  // v0.4 structured mode — the Author returns JSON pages with hard caps.
  if (getDraftMode() === 'structured') {
    return runStructuredDraft(plan, input, llm);
  }

  // Free-form (legacy) — same as v0.3.x.
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
