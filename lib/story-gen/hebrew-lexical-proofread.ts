/**
 * Hebrew lexical proofread — LLM-first + deterministic backstop + severity tiers.
 * Report mode by default; blocking only after calibration passes.
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { resolveCompanionNameMarkers } from './companion-gender';
import {
  classifyLexicalHits,
  summarizeLexicalFindings,
} from './hebrew-lexical-classify';
import {
  applyBlockerAuthorityPolicy,
  computeLexicalRoutingState,
  type LexicalRoutingState,
} from './hebrew-lexical-routing';
import {
  dedupeLexicalHits,
  ONOMATOPOEIA_ALLOWLIST,
  runDeterministicLexicalBackstop,
} from './hebrew-lexical-backstop';
import type { HebrewLexicalFinding, HebrewLexicalHit } from './hebrew-lexical-types';
import { pageProseOnly, parseStoryPages } from './story-page-utils';
import { DEFAULT_STORY_GEN_MODELS } from './story-generation-types';

export { ONOMATOPOEIA_ALLOWLIST, runDeterministicLexicalBackstop } from './hebrew-lexical-backstop';
export type {
  HebrewLexicalDomain,
  HebrewLexicalFinding,
  HebrewLexicalHit,
  HebrewLexicalHitSource,
  HebrewLexicalSeverity,
} from './hebrew-lexical-types';
export {
  buildLexicalAllowContext,
  classifyLexicalHit,
  classifyLexicalHits,
  summarizeLexicalFindings,
} from './hebrew-lexical-classify';
export {
  applyBlockerAuthorityPolicy,
  applyLexicalTerminalCap,
  computeLexicalRoutingState,
  isHighSeverityProseReview,
  isSlashFormFinding,
  type LexicalRoutingState,
} from './hebrew-lexical-routing';

export const HEBREW_LEXICAL_PROMPT_VERSION = 'hebrew-lexical-v2-severity';

export interface HebrewLexicalProofreadReport {
  status: 'hebrew_lexical_proofread_v2';
  promptVersion: string;
  mode: 'report_only' | 'blocking';
  /** All findings after severity classification. */
  findings: HebrewLexicalFinding[];
  hits: HebrewLexicalFinding[];
  blockerCount: number;
  reviewCount: number;
  allowCount: number;
  blockers: HebrewLexicalFinding[];
  reviews: HebrewLexicalFinding[];
  allows: HebrewLexicalFinding[];
  deterministicHitCount: number;
  llmHitCount: number;
  demotedLlmBlockerCount: number;
  highSeverityProseReviewCount: number;
  slashFormFindingCount: number;
  routing: LexicalRoutingState;
  advisoryWarn: boolean;
  advisoryFail: boolean;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface LlmLexicalRow {
  page: number;
  original: string;
  issue: string;
  suggestedMinimalFix: string;
}

async function runLexicalLlmPass(args: {
  markdown: string;
  modelId: string;
  companionId: string | null;
}): Promise<{ hits: HebrewLexicalHit[]; inputTokens: number; outputTokens: number }> {
  const pages = parseStoryPages(args.markdown).map(({ page, body }) => ({
    page,
    prose: pageProseOnly(body),
  }));

  const soundList = ONOMATOPOEIA_ALLOWLIST.join(', ');
  const companionNames = args.companionId
    ? resolveCompanionNameMarkers(args.companionId).join(', ')
    : '(none)';

  const systemPrompt = `You are a native Hebrew proofreader for Israeli children's picture books (ages 3–6).
Flag words/phrases that are NOT valid Hebrew, broken conjugations, or unnatural to a native parent reader.
Propose MINIMAL corrections only — do NOT polish style or literary voice.

NEVER flag (classify mentally as ALLOW — omit from findings):
- Companion names from this story: ${companionNames}
- Approved sound-words / onomatopoeia: ${soundList}
- {{childName}} and {{placeholders}}
- Gender chips {male|female} (unless a chip SIDE is a non-word)
- Valid nikud variants of real Hebrew words
- imageDirection lines

Severity guide (for your issue text):
- BLOCKER: non-word, broken verb, unreadable form
- REVIEW: valid Hebrew but jarring simile / forced phrase / unclear for age 4–8

Return ONLY JSON:
{
  "findings": [
    {
      "page": 1,
      "original": "exact substring",
      "issue": "why invalid/unnatural",
      "suggestedMinimalFix": "minimal fix"
    }
  ]
}
If prose is clean, return { "findings": [] }.`;

  const userPrompt = `Review Hebrew prose only.\n${JSON.stringify(pages, null, 2)}`;

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'hebrew-lexical-proofread',
    systemPrompt,
    userPrompt,
    jsonMode: true,
    maxOutputTokens: 4096,
    temperature: 0,
  });

  const parsed = parseJsonFromLLM<{ findings: LlmLexicalRow[] }>(result.text, 'hebrew-lexical');
  const hits: HebrewLexicalHit[] = (parsed.findings ?? []).map((f) => ({
    page: f.page,
    original: f.original,
    issue: f.issue,
    suggestedMinimalFix: f.suggestedMinimalFix,
    source: 'llm' as const,
  }));

  return {
    hits,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

export async function runHebrewLexicalProofread(args: {
  storyMarkdown: string;
  mode?: 'report_only' | 'blocking';
  modelId?: string;
  skipLlm?: boolean;
}): Promise<HebrewLexicalProofreadReport> {
  const mode = args.mode ?? 'report_only';
  const modelId = args.modelId ?? DEFAULT_STORY_GEN_MODELS.judgeModel;
  const companionId =
    args.storyMarkdown.match(/companionId:\s*(\S+)/)?.[1]?.trim() ?? null;

  const deterministic = runDeterministicLexicalBackstop(args.storyMarkdown);
  let llmHits: HebrewLexicalHit[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  if (!args.skipLlm) {
    const llmResult = await runLexicalLlmPass({
      markdown: args.storyMarkdown,
      modelId,
      companionId,
    });
    llmHits = llmResult.hits;
    inputTokens = llmResult.inputTokens;
    outputTokens = llmResult.outputTokens;
  }

  const merged = dedupeLexicalHits([...deterministic, ...llmHits]);
  const classified = classifyLexicalHits(merged, args.storyMarkdown);
  const { findings, demotedLlmBlockers } = applyBlockerAuthorityPolicy(
    classified,
    deterministic
  );
  const summary = summarizeLexicalFindings(findings);
  const routing = computeLexicalRoutingState(findings, demotedLlmBlockers);

  const advisoryWarn =
    routing.blockerCount + routing.highSeverityProseReviewCount > 0;
  const advisoryFail =
    mode === 'blocking' && routing.blockerCount > 0;

  return {
    status: 'hebrew_lexical_proofread_v2',
    promptVersion: HEBREW_LEXICAL_PROMPT_VERSION,
    mode,
    findings,
    hits: findings,
    blockerCount: summary.blockerCount,
    reviewCount: summary.reviewCount,
    allowCount: summary.allowCount,
    blockers: summary.blockers,
    reviews: summary.reviews,
    allows: summary.allows,
    deterministicHitCount: deterministic.length,
    llmHitCount: llmHits.length,
    demotedLlmBlockerCount: demotedLlmBlockers.length,
    highSeverityProseReviewCount: routing.highSeverityProseReviewCount,
    slashFormFindingCount: routing.slashFormFindings.length,
    routing,
    advisoryWarn,
    advisoryFail,
    modelId: args.skipLlm ? undefined : modelId,
    inputTokens: args.skipLlm ? undefined : inputTokens,
    outputTokens: args.skipLlm ? undefined : outputTokens,
  };
}
