import { OpenAIResponsesLLM, parseJsonFromLLM, type StoryGeneratorLLM } from '../llm';
import { buildEditorialQASystemPrompt, buildEditorialQAUserPrompt } from '../prompts/editorial-qa-prompt';
import type { GenerateInput, Plan } from '../types';
import { deriveVerdict } from '../editorial/derive-verdict';
import { mergeEditorialIssues } from '../editorial/merge-issues';
import { runEditorialPrescan } from '../editorial/prescan';
import {
  EditorialReportSchema,
  type EditorialIssueRuntime,
  type EditorialReportRuntime,
} from '../editorial/schemas';
import { validateIssueQuotes } from '../editorial/validate-quotes';
import { getEditorialQaModel, isEditorialQaEnabled } from '../editorial/config';

const DEFAULT_SCORES: EditorialReportRuntime['scores'] = {
  naturalHebrew: 5,
  directionFit: 5,
  motifConsistency: 5,
  continuity: 5,
  readAloud: 5,
  ageFit: 5,
};

export interface EditorialQAResult {
  report: EditorialReportRuntime;
  prescanIssues: EditorialIssueRuntime[];
  llmCostUsd: number;
  model: string;
  modelVersion: string;
  zodParseFailed: boolean;
  reviewRequired: boolean;
  llmSkipped: boolean;
}

function buildReportFromPrescan(
  prescanIssues: EditorialIssueRuntime[],
  reviewRequired: boolean
): EditorialReportRuntime {
  const verdict = deriveVerdict(DEFAULT_SCORES, prescanIssues);
  return {
    scores: DEFAULT_SCORES,
    issues: prescanIssues,
    verdict: reviewRequired && verdict === 'READY' ? 'NEEDS_REPAIR' : verdict,
  };
}

/** Post-repair check: prescan + quote validation + deriveVerdict (no LLM). */
export function runEditorialRevalidate(
  storyMarkdown: string,
  companionId: GenerateInput['companionId'],
  scores: EditorialReportRuntime['scores']
): { report: EditorialReportRuntime; reviewRequired: boolean } {
  const prescanIssues = runEditorialPrescan(storyMarkdown, companionId).map((i) => ({
    ...i,
    _source: 'scanner' as const,
  }));
  const { issues, reviewRequired } = validateIssueQuotes(storyMarkdown, prescanIssues);
  return {
    report: {
      scores,
      issues,
      verdict: deriveVerdict(scores, issues),
    },
    reviewRequired,
  };
}

export async function runEditorialQA(
  storyMarkdown: string,
  plan: Plan,
  input: GenerateInput,
  llm?: StoryGeneratorLLM
): Promise<EditorialQAResult> {
  const prescanIssues = runEditorialPrescan(storyMarkdown, input.companionId).map((i) => ({
    ...i,
    _source: 'scanner' as const,
  }));

  if (!isEditorialQaEnabled()) {
    const { issues, reviewRequired } = validateIssueQuotes(storyMarkdown, prescanIssues);
    const report: EditorialReportRuntime = {
      scores: DEFAULT_SCORES,
      issues,
      verdict: deriveVerdict(DEFAULT_SCORES, issues),
    };
    return {
      report,
      prescanIssues,
      llmCostUsd: 0,
      model: 'disabled',
      modelVersion: '',
      zodParseFailed: false,
      reviewRequired,
      llmSkipped: true,
    };
  }

  const model = getEditorialQaModel();
  const client = llm ?? new OpenAIResponsesLLM(model);

  const result = await client.call({
    stage: 'editorial-qa',
    systemPrompt: buildEditorialQASystemPrompt(),
    userPrompt: buildEditorialQAUserPrompt({
      storyMarkdown,
      plan,
      input,
      prescanIssueCount: prescanIssues.length,
    }),
    maxOutputTokens: 3000,
    jsonMode: true,
  });

  let zodParseFailed = false;
  let llmReport: EditorialReportRuntime | null = null;

  try {
    const raw = parseJsonFromLLM<unknown>(result.text, 'editorial-qa');
    const parsed = EditorialReportSchema.safeParse(raw);
    if (!parsed.success) {
      zodParseFailed = true;
    } else {
      llmReport = {
        ...parsed.data,
        issues: parsed.data.issues.map((i) => ({ ...i, _source: 'llm' as const })),
      };
    }
  } catch {
    zodParseFailed = true;
  }

  if (!llmReport) {
    const { issues, reviewRequired } = validateIssueQuotes(storyMarkdown, prescanIssues);
    return {
      report: buildReportFromPrescan(issues, true),
      prescanIssues,
      llmCostUsd: result.costUsd,
      model,
      modelVersion: result.modelVersion,
      zodParseFailed: true,
      reviewRequired: true || reviewRequired,
      llmSkipped: false,
    };
  }

  const merged = mergeEditorialIssues(prescanIssues, llmReport.issues);
  const { issues, reviewRequired: quoteReview } = validateIssueQuotes(storyMarkdown, merged);
  const verdict = deriveVerdict(llmReport.scores, issues);
  const reviewRequired = zodParseFailed || quoteReview;

  const report: EditorialReportRuntime = {
    scores: llmReport.scores,
    issues,
    verdict: reviewRequired && verdict === 'READY' ? 'NEEDS_REPAIR' : verdict,
  };

  return {
    report,
    prescanIssues,
    llmCostUsd: result.costUsd,
    model,
    modelVersion: result.modelVersion,
    zodParseFailed,
    reviewRequired,
    llmSkipped: false,
  };
}
