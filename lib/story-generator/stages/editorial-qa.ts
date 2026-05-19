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
import { getEditorialMode, getEditorialQaModel, isEditorialQaEnabled } from '../editorial/config';
import { runYLiteQA } from './y-lite-qa';

/**
 * v0.2.4 — Normalize known LLM-invented reason aliases to schema-valid values.
 * The LLM sometimes returns camelCase variants or made-up reasons. Translate them
 * before Zod parse so we don't lose valid editorial signal.
 */
const REASON_ALIASES: Record<string, string> = {
  forbiddenAnatomy: 'companion_drift',
  forbidden_anatomy: 'companion_drift',
  forbiddenObjects: 'companion_drift',
  forbidden_objects: 'companion_drift',
  forbiddenTone: 'companion_drift',
  invalid_companion_trait: 'companion_drift',
  forbidden_trait: 'companion_drift',
  companionNameRepeat: 'companion_name_repeat',
  hebrewBroken: 'broken_hebrew',
  hebrew_broken: 'broken_hebrew',
  semanticNonsense: 'semantic_nonsense',
  readAloud: 'read_aloud_stumble',
  read_aloud: 'read_aloud_stumble',
  directionDrift: 'direction_drift',
  objectDrift: 'object_drift',
  metadataInconsistency: 'metadata_inconsistency',
  imageDirectionMismatch: 'image_direction_mismatch',
  wrongEnding: 'wrong_ending',
  tooAbstract: 'too_abstract_for_age',
  too_abstract: 'too_abstract_for_age',
};

function normalizeEditorialJSON(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.issues)) return raw;
  data.issues = data.issues.map((issue: unknown) => {
    if (!issue || typeof issue !== 'object') return issue;
    const i = issue as Record<string, unknown>;
    if (typeof i.reason === 'string' && REASON_ALIASES[i.reason]) {
      i.reason = REASON_ALIASES[i.reason];
    }
    return i;
  });
  return data;
}

/**
 * DEFAULT_SCORES — used when editorial QA is DISABLED (no LLM call at all).
 * Stories that skip editorial entirely are trusted to have passed technical validation;
 * default to neutral 4s so they don't auto-trigger NEEDS_REPAIR.
 */
const DEFAULT_SCORES: EditorialReportRuntime['scores'] = {
  naturalHebrew: 4,
  directionFit: 4,
  motifConsistency: 4,
  continuity: 4,
  readAloud: 4,
  ageFit: 4,
};

/**
 * v0.2.3 — PARSE_FAILURE_SCORES used when LLM returned JSON we couldn't parse.
 * We must NOT default to 5/5 here — that synthesizes a "READY" verdict without
 * any actual editorial review. Default to 3/6 → triggers avg<4 → NEEDS_REPAIR.
 * This forces the orchestrator to either retry or surface REVIEW_REQUIRED.
 */
const PARSE_FAILURE_SCORES: EditorialReportRuntime['scores'] = {
  naturalHebrew: 3,
  directionFit: 3,
  motifConsistency: 3,
  continuity: 3,
  readAloud: 3,
  ageFit: 3,
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
  reviewRequired: boolean,
  parseFailureFallback = false
): EditorialReportRuntime {
  // v0.2.3: When the LLM call exists but failed Zod, use PARSE_FAILURE_SCORES (3s, not 5s).
  // This forces NEEDS_REPAIR via the avg<4 gate — exactly the behavior we want when
  // editorial silently failed. DEFAULT_SCORES (4s) only when editorial was disabled.
  const scores = parseFailureFallback ? PARSE_FAILURE_SCORES : DEFAULT_SCORES;
  const verdict = deriveVerdict(scores, prescanIssues);
  return {
    scores,
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
  const prescanIssues = runEditorialPrescan(storyMarkdown, companionId, undefined).map((i) => ({
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
  const prescanIssues = runEditorialPrescan(storyMarkdown, input.companionId, input.direction).map((i) => ({
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

  // Y-lite dispatch: two parallel reviewers (Book Editor + Resilience).
  // The single-editor mode rubber-stamped 5/5 on stories with niqqud-mix,
  // anatomy bleed, and meta-instructions. Splitting concerns is the fix.
  if (getEditorialMode() === 'y-lite') {
    const yLite = await runYLiteQA(storyMarkdown, plan, input, llm);
    // Adapter — drop the y-lite-specific telemetry fields to match
    // EditorialQAResult exactly. They're logged inside runYLiteQA.
    return {
      report: yLite.report,
      prescanIssues: yLite.prescanIssues,
      llmCostUsd: yLite.llmCostUsd,
      model: yLite.model,
      modelVersion: yLite.modelVersion,
      zodParseFailed: yLite.zodParseFailed,
      reviewRequired: yLite.reviewRequired,
      llmSkipped: yLite.llmSkipped,
    };
  }

  const model = getEditorialQaModel();
  const client = llm ?? new OpenAIResponsesLLM(model);

  async function callEditor(retryNote?: string) {
    return client.call({
      stage: 'editorial-qa',
      systemPrompt: buildEditorialQASystemPrompt(),
      userPrompt:
        buildEditorialQAUserPrompt({
          storyMarkdown,
          plan,
          input,
          prescanIssueCount: prescanIssues.length,
        }) + (retryNote ? `\n\nRETRY NOTE: ${retryNote}` : ''),
      maxOutputTokens: 3000,
      jsonMode: true,
    });
  }

  function tryParse(text: string): EditorialReportRuntime | null {
    try {
      const raw = parseJsonFromLLM<unknown>(text, 'editorial-qa');
      const normalized = normalizeEditorialJSON(raw);
      const parsed = EditorialReportSchema.safeParse(normalized);
      if (parsed.success) {
        return {
          ...parsed.data,
          issues: parsed.data.issues.map((i) => ({ ...i, _source: 'llm' as const })),
        };
      }
    } catch {
      // fall through to null
    }
    return null;
  }

  let result = await callEditor();
  let llmReport = tryParse(result.text);
  let zodParseFailed = !llmReport;
  let totalCost = result.costUsd;

  if (!llmReport) {
    // v0.3.5 — retry ONCE with stricter formatting note before giving up.
    console.warn('[editorial-qa] Zod parse failed on first attempt — retrying with strict JSON note');
    const retry = await callEditor(
      'The previous response was not valid JSON or violated the schema. Return STRICT JSON ONLY. Keep quote <= 180 chars, suggestion <= 220 chars, explanation <= 160 chars. No multiline strings. No unescaped newlines inside string values.'
    );
    totalCost += retry.costUsd;
    llmReport = tryParse(retry.text);
    if (llmReport) {
      zodParseFailed = false;
      console.log('[editorial-qa] Retry succeeded.');
      result = retry;
    } else {
      // v0.3.5 — Parse still failed after retry. Per CTO decision:
      //   - The STORY is not the problem; QA infrastructure is.
      //   - Don't reject the story; mark REVIEW_REQUIRED with reason=editorial_parse_failed.
      //   - Use the prescan + neutral scores so the orchestrator routes to review, not auto-publish.
      console.error(
        `[editorial-qa] Zod parse FAILED on retry. Routing to REVIEW_REQUIRED.\nRaw retry text (first 800):\n${retry.text.slice(0, 800)}\n---`
      );
      const { issues } = validateIssueQuotes(storyMarkdown, prescanIssues);
      return {
        report: {
          scores: PARSE_FAILURE_SCORES,
          issues,
          // NEEDS_REPAIR (not REJECT) so the orchestrator can still try a repair pass.
          // The downstream reviewReason will record this as 'editorial_parse_failed'.
          verdict: 'NEEDS_REPAIR',
        },
        prescanIssues,
        llmCostUsd: totalCost,
        model,
        modelVersion: result.modelVersion,
        zodParseFailed: true,
        reviewRequired: true,
        llmSkipped: false,
      };
    }
  }

  const merged = mergeEditorialIssues(prescanIssues, llmReport.issues);
  const { issues, reviewRequired: quoteReview } = validateIssueQuotes(storyMarkdown, merged);

  // v0.2.4: CODE-DERIVED VERDICT IS AUTHORITATIVE.
  // LLM's self-declared verdict is advisory only. Use scores + issues to derive truth.
  // This prevents the "NEEDS_REPAIR with 0 issues, avg 4.17" inconsistency where the
  // LLM says NEEDS_REPAIR but math says READY.
  const derivedVerdict = deriveVerdict(llmReport.scores, issues);
  const llmVerdict = llmReport.verdict;
  if (derivedVerdict !== llmVerdict) {
    console.warn(
      `[editorial-qa] LLM verdict ${llmVerdict} disagrees with derived ${derivedVerdict} — using derived (code is authoritative)`
    );
  }
  const reviewRequired = zodParseFailed || quoteReview;

  const report: EditorialReportRuntime = {
    scores: llmReport.scores,
    issues,
    verdict: reviewRequired && derivedVerdict === 'READY' ? 'NEEDS_REPAIR' : derivedVerdict,
  };

  return {
    report,
    prescanIssues,
    llmCostUsd: totalCost,
    model,
    modelVersion: result.modelVersion,
    zodParseFailed,
    reviewRequired,
    llmSkipped: false,
  };
}
