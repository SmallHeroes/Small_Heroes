import { buildRepairSystemPrompt, buildRepairUserPrompt } from '../prompts/repair-prompt';
import type { Plan } from '../types';
import type { ValidationReport } from '@/lib/story-validators';
import { getDefaultLLM, type StoryGeneratorLLM } from '../llm';

export function buildPreserveList(plan: Plan): string[] {
  const hook = plan.hookContract;
  return [
    `Moment on page ${plan.momentContract.page}: ${plan.momentContract.physicalAction}`,
    ...hook.appearsOnPages.map(
      (p) =>
        `Hook on page ${p}: ${hook.sound ?? hook.phrase ?? hook.microAction ?? hook.object ?? 'hook'}`
    ),
    plan.momentContract.residue ? `Residue: ${plan.momentContract.residue}` : '',
    plan.momentContract.companionSignature
      ? `Companion signature: ${plan.momentContract.companionSignature}`
      : '',
    ...plan.preserveListSeeds,
  ].filter(Boolean);
}

export function buildChangeOnly(report: ValidationReport): number[] {
  const pages = new Set<number>();
  for (const f of report.findings) {
    if (f.severity === 'BLOCKING' && typeof f.page === 'number') pages.add(f.page);
  }
  if (pages.size === 0) {
    // structural issues without page — allow page 1 edit for frontmatter
    const structural = report.findings.some((f) =>
      ['pageCount', 'pageSequence'].includes(f.validator)
    );
    if (structural) return [1];
  }
  return [...pages].sort((a, b) => a - b);
}

/** Stage E: REPAIR mode LLM call. */
export async function runRepair(
  previousStory: string,
  report: ValidationReport,
  plan: Plan,
  attempt: number,
  llm: StoryGeneratorLLM = getDefaultLLM()
): Promise<{
  storyMarkdown: string;
  preserveList: string[];
  changeOnly: number[];
  llmCostUsd: number;
  modelVersion: string;
}> {
  const preserveList = buildPreserveList(plan);
  const changeOnly = buildChangeOnly(report);

  const result = await llm.call({
    stage: `repair-${attempt}`,
    systemPrompt: buildRepairSystemPrompt(),
    userPrompt: buildRepairUserPrompt({
      previousStory,
      plan,
      report,
      preserveList,
      changeOnly,
      attempt,
    }),
    maxOutputTokens: 12000,
    jsonMode: false,
  });

  return {
    storyMarkdown: result.text.trim(),
    preserveList,
    changeOnly,
    llmCostUsd: result.costUsd,
    modelVersion: result.modelVersion,
  };
}
