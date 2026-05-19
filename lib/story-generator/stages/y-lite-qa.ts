/**
 * Y-lite — two parallel reviewer LLM calls + combine.
 *
 * Replaces the single `runEditorialQA` when EDITORIAL_MODE=y-lite.
 * Returns the SAME `EditorialQAResult` shape so the existing pipeline
 * (run-editorial-pipeline, summary, repair) works unchanged.
 */
import { OpenAIResponsesLLM, parseJsonFromLLM, type StoryGeneratorLLM } from '../llm';
import {
  buildBookEditorSystemPrompt,
  buildBookEditorUserPrompt,
} from '../prompts/book-editor-prompt';
import {
  buildResilienceReviewerSystemPrompt,
  buildResilienceReviewerUserPrompt,
} from '../prompts/resilience-reviewer-prompt';
import type { GenerateInput, Plan } from '../types';
import {
  BookEditorReportSchema,
  ResilienceReportSchema,
  type BookEditorReport,
  type ResilienceReport,
} from '../editorial/y-lite-schemas';
import { combineReviews } from '../editorial/combine-reviews';
import { runEditorialPrescan } from '../editorial/prescan';
import { validateIssueQuotes } from '../editorial/validate-quotes';
import { mergeEditorialIssues } from '../editorial/merge-issues';
import { deriveVerdict } from '../editorial/derive-verdict';
import type { EditorialReportRuntime } from '../editorial/schemas';
import { getEditorialQaModel } from '../editorial/config';

const PARSE_FAILURE_SCORES = {
  naturalHebrew: 3,
  directionFit: 3,
  motifConsistency: 3,
  continuity: 3,
  readAloud: 3,
  ageFit: 3,
} as const;

export interface YLiteQAResult {
  report: EditorialReportRuntime;
  prescanIssues: EditorialReportRuntime['issues'];
  llmCostUsd: number;
  model: string;
  modelVersion: string;
  zodParseFailed: boolean;
  reviewRequired: boolean;
  llmSkipped: boolean;
  /** Y-lite specific telemetry */
  bookEditorVerdict?: string;
  resilienceVerdict?: string;
  bookEditorAvg?: number;
  resilienceAvg?: number;
}

async function callReviewerWithRetry<T>(args: {
  llm: StoryGeneratorLLM;
  stage: string;
  systemPrompt: string;
  userPrompt: string;
  parse: (text: string) => T | null;
}): Promise<{ parsed: T | null; costUsd: number; modelVersion: string }> {
  const first = await args.llm.call({
    stage: args.stage,
    systemPrompt: args.systemPrompt,
    userPrompt: args.userPrompt,
    maxOutputTokens: 2500,
    jsonMode: true,
  });
  let parsed = args.parse(first.text);
  let totalCost = first.costUsd;
  let modelVersion = first.modelVersion;

  if (!parsed) {
    console.warn(`[${args.stage}] parse failed — retrying with strict note`);
    const retry = await args.llm.call({
      stage: args.stage,
      systemPrompt: args.systemPrompt,
      userPrompt:
        args.userPrompt +
        '\n\nRETRY NOTE: Previous response was not valid JSON or violated the schema. Return STRICT JSON ONLY. Truncate any quote > 180 chars. No multiline strings.',
      maxOutputTokens: 2500,
      jsonMode: true,
    });
    totalCost += retry.costUsd;
    modelVersion = retry.modelVersion;
    parsed = args.parse(retry.text);
    if (parsed) console.log(`[${args.stage}] retry succeeded.`);
  }

  return { parsed, costUsd: totalCost, modelVersion };
}

function tryParseBookEditor(text: string): BookEditorReport | null {
  try {
    const raw = parseJsonFromLLM<unknown>(text, 'book-editor');
    const parsed = BookEditorReportSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function tryParseResilience(text: string): ResilienceReport | null {
  try {
    const raw = parseJsonFromLLM<unknown>(text, 'resilience-reviewer');
    const parsed = ResilienceReportSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function runYLiteQA(
  storyMarkdown: string,
  plan: Plan,
  input: GenerateInput,
  llm?: StoryGeneratorLLM
): Promise<YLiteQAResult> {
  const prescanIssues = runEditorialPrescan(
    storyMarkdown,
    input.companionId,
    input.direction
  ).map((i) => ({ ...i, _source: 'scanner' as const }));

  const model = getEditorialQaModel();
  const client = llm ?? new OpenAIResponsesLLM(model);

  // Run both reviewers in parallel — independent perspectives.
  const [bookResult, resResult] = await Promise.all([
    callReviewerWithRetry({
      llm: client,
      stage: 'book-editor',
      systemPrompt: buildBookEditorSystemPrompt(),
      userPrompt: buildBookEditorUserPrompt({ storyMarkdown, plan, input }),
      parse: tryParseBookEditor,
    }),
    callReviewerWithRetry({
      llm: client,
      stage: 'resilience-reviewer',
      systemPrompt: buildResilienceReviewerSystemPrompt(),
      userPrompt: buildResilienceReviewerUserPrompt({ storyMarkdown, plan, input }),
      parse: tryParseResilience,
    }),
  ]);

  const totalCost = bookResult.costUsd + resResult.costUsd;
  const modelVersion = bookResult.modelVersion || resResult.modelVersion;

  // If either reviewer failed to parse even after retry → REVIEW_REQUIRED.
  // Story is not the problem — review infrastructure is.
  if (!bookResult.parsed || !resResult.parsed) {
    console.error(
      `[y-lite-qa] Reviewer parse failed: book=${!!bookResult.parsed}, resilience=${!!resResult.parsed}`
    );
    const { issues } = validateIssueQuotes(storyMarkdown, prescanIssues);
    return {
      report: {
        scores: PARSE_FAILURE_SCORES,
        issues,
        verdict: 'NEEDS_REPAIR', // not REJECT — story may be fine
      },
      prescanIssues,
      llmCostUsd: totalCost,
      model,
      modelVersion,
      zodParseFailed: true,
      reviewRequired: true,
      llmSkipped: false,
    };
  }

  // Both parsed. Combine.
  const combined = combineReviews(bookResult.parsed, resResult.parsed);

  // Merge prescan + LLM issues + validate quotes against story text.
  const merged = mergeEditorialIssues(prescanIssues, combined.report.issues);
  const { issues, reviewRequired: quoteReview } = validateIssueQuotes(
    storyMarkdown,
    merged
  );

  // v0.2.4 — code-derived verdict is authoritative.
  // Note: Y-lite has its own verdict from combineReviews; we run derive-verdict
  // on the synthesized legacy scores and KEEP THE STRICTER of the two.
  const derivedFromLegacy = deriveVerdict(combined.report.scores, issues);
  const yLiteVerdict = combined.report.verdict;
  const verdictRank = { READY: 0, NEEDS_REPAIR: 1, REJECT: 2 } as const;
  const finalVerdict =
    verdictRank[derivedFromLegacy] >= verdictRank[yLiteVerdict]
      ? derivedFromLegacy
      : yLiteVerdict;

  if (finalVerdict !== yLiteVerdict) {
    console.warn(
      `[y-lite-qa] Y-lite verdict ${yLiteVerdict} but legacy-derive is ${derivedFromLegacy} — using stricter (${finalVerdict})`
    );
  }

  const report: EditorialReportRuntime = {
    scores: combined.report.scores,
    issues,
    verdict: finalVerdict,
  };

  console.log(
    `[y-lite-qa] book=${combined.bookEditorVerdict} (avg ${combined.bookEditorAvg.toFixed(2)}), ` +
      `resilience=${combined.resilienceVerdict} (avg ${combined.resilienceAvg.toFixed(2)}), ` +
      `combined=${finalVerdict}, issues=${issues.length}, cost=$${totalCost.toFixed(4)}`
  );

  return {
    report,
    prescanIssues,
    llmCostUsd: totalCost,
    model,
    modelVersion,
    zodParseFailed: false,
    reviewRequired: quoteReview,
    llmSkipped: false,
    bookEditorVerdict: combined.bookEditorVerdict,
    resilienceVerdict: combined.resilienceVerdict,
    bookEditorAvg: combined.bookEditorAvg,
    resilienceAvg: combined.resilienceAvg,
  };
}
