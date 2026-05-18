import { parseStoryMarkdown } from '@/lib/story-validators';
import { parseJsonFromLLM, OpenAIResponsesLLM, type StoryGeneratorLLM } from '../llm';
import { rebuildStoryMarkdown, pagesFromParsed } from '../markdown';
import {
  buildEditorialRepairPatchSystemPrompt,
  buildEditorialRepairPatchUserPrompt,
} from '../prompts/editorial-repair-prompt';
import type { GenerateInput, Plan } from '../types';
import { countSubstring } from '../editorial/prescan';
import { exceedsEditorialDiffLimit } from '../editorial/diff-ratio';
import { getEditorialRepairModel } from '../editorial/config';
import type { EditorialIssueRuntime } from '../editorial/schemas';

interface RepairedPagePayload {
  pageNumber: number;
  text: string;
  imageDirection?: string;
}

interface RepairedPagesResponse {
  pages: RepairedPagePayload[];
}

export interface EditorialRepairResult {
  storyMarkdown: string;
  issues: EditorialIssueRuntime[];
  phase1Fixed: number;
  phase2Used: boolean;
  diffRatioExceeded: boolean;
  llmCostUsd: number;
  model: string;
  modelVersion: string;
}

function issuesNeedingRepair(issues: EditorialIssueRuntime[]): EditorialIssueRuntime[] {
  return issues.filter(
    (i) =>
      !i._repairedDeterministically &&
      !i._unmatchedQuote &&
      (i.severity === 'BLOCKING' || i.severity === 'MAJOR')
  );
}

function pagesForRepair(issues: EditorialIssueRuntime[]): number[] {
  return [...new Set(issues.map((i) => i.page))].sort((a, b) => a - b);
}

/** Phase 1: deterministic quote → suggestion on body only. */
export function runDeterministicEditorialRepair(
  storyMarkdown: string,
  issues: EditorialIssueRuntime[]
): { storyMarkdown: string; issues: EditorialIssueRuntime[]; fixedCount: number } {
  const parsed = parseStoryMarkdown(storyMarkdown);
  let fixedCount = 0;
  const updatedIssues = issues.map((i) => ({ ...i }));

  for (const issue of updatedIssues) {
    if (issue._repairedDeterministically || issue.field !== 'body') continue;
    if (issue.severity !== 'BLOCKING' && issue.severity !== 'MAJOR') continue;
    if (!issue.suggestion || issue._unmatchedQuote) continue;

    const page = parsed.pages.find((p) => p.pageNumber === issue.page);
    if (!page || !issue.quote) continue;

    const occurrences = countSubstring(page.text, issue.quote);
    if (occurrences === 0) continue;
    if (occurrences > 1) {
      issue._ambiguousReplacement = true;
      continue;
    }

    page.text = page.text.replace(issue.quote, issue.suggestion);
    issue._repairedDeterministically = true;
    fixedCount++;
  }

  if (fixedCount === 0) {
    return { storyMarkdown, issues: updatedIssues, fixedCount: 0 };
  }

  return {
    storyMarkdown: rebuildStoryMarkdown(parsed.frontmatter, pagesFromParsed(parsed)),
    issues: updatedIssues,
    fixedCount,
  };
}

export async function runEditorialRepair(
  storyMarkdown: string,
  issues: EditorialIssueRuntime[],
  _plan: Plan,
  _input: GenerateInput,
  attempt: number,
  llm?: StoryGeneratorLLM
): Promise<EditorialRepairResult> {
  const phase1 = runDeterministicEditorialRepair(storyMarkdown, issues);
  const remaining = issuesNeedingRepair(phase1.issues);

  if (remaining.length === 0) {
    return {
      storyMarkdown: phase1.storyMarkdown,
      issues: phase1.issues,
      phase1Fixed: phase1.fixedCount,
      phase2Used: false,
      diffRatioExceeded: false,
      llmCostUsd: 0,
      model: '',
      modelVersion: '',
    };
  }

  const changeOnly = pagesForRepair(remaining);
  const parsedPrev = parseStoryMarkdown(phase1.storyMarkdown);
  const pagesToRepair = parsedPrev.pages.filter((p) => changeOnly.includes(p.pageNumber));

  if (pagesToRepair.length === 0) {
    return {
      storyMarkdown: phase1.storyMarkdown,
      issues: phase1.issues,
      phase1Fixed: phase1.fixedCount,
      phase2Used: false,
      diffRatioExceeded: false,
      llmCostUsd: 0,
      model: '',
      modelVersion: '',
    };
  }

  const model = getEditorialRepairModel();
  const client = llm ?? new OpenAIResponsesLLM(model);

  const result = await client.call({
    stage: `editorial-repair-${attempt}`,
    systemPrompt: buildEditorialRepairPatchSystemPrompt(),
    userPrompt: buildEditorialRepairPatchUserPrompt({
      pagesToRepair,
      issues: remaining,
      attempt,
    }),
    maxOutputTokens: 4000,
    jsonMode: true,
  });

  const parsed = parseJsonFromLLM<RepairedPagesResponse>(result.text, `editorial-repair-${attempt}`);
  if (!parsed?.pages || !Array.isArray(parsed.pages)) {
    throw new Error(`[editorial-repair-${attempt}] LLM did not return {pages: [...]} JSON`);
  }

  const repairedByPage = new Map<number, RepairedPagePayload>();
  for (const repaired of parsed.pages) {
    if (typeof repaired.pageNumber !== 'number') continue;
    if (!changeOnly.includes(repaired.pageNumber)) continue;
    repairedByPage.set(repaired.pageNumber, repaired);
  }

  let diffRatioExceeded = false;
  const mergedPages = pagesFromParsed(parsedPrev).map((page) => {
    const repaired = repairedByPage.get(page.pageNumber);
    if (!repaired) return page;

    const newText =
      typeof repaired.text === 'string' && repaired.text.trim() ? repaired.text : page.text;
    const newDir =
      typeof repaired.imageDirection === 'string' && repaired.imageDirection.trim()
        ? repaired.imageDirection
        : page.imageDirection;

    const bodyIssue = remaining.some((i) => i.page === page.pageNumber && i.field === 'body');
    const dirIssue = remaining.some(
      (i) => i.page === page.pageNumber && i.field === 'imageDirection'
    );

    if (bodyIssue && exceedsEditorialDiffLimit(page.text, newText)) {
      diffRatioExceeded = true;
    }
    if (dirIssue && exceedsEditorialDiffLimit(page.imageDirection, newDir)) {
      diffRatioExceeded = true;
    }

    return {
      pageNumber: page.pageNumber,
      text: newText,
      imageDirection: newDir,
    };
  });

  return {
    storyMarkdown: rebuildStoryMarkdown(parsedPrev.frontmatter, mergedPages),
    issues: phase1.issues,
    phase1Fixed: phase1.fixedCount,
    phase2Used: true,
    diffRatioExceeded,
    llmCostUsd: result.costUsd,
    model,
    modelVersion: result.modelVersion,
  };
}
