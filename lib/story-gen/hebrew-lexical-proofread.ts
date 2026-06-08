/**
 * Hebrew lexical proofread — LLM-first native-Hebrew detector + deterministic backstop.
 * Report mode by default; blocking only after calibration.
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { pageProseOnly, parseStoryPages } from './story-page-utils';
import {
  dedupeLexicalHits,
  ONOMATOPOEIA_ALLOWLIST,
  runDeterministicLexicalBackstop,
  type HebrewLexicalHit,
} from './hebrew-lexical-backstop';
import { DEFAULT_STORY_GEN_MODELS } from './story-generation-types';

export { ONOMATOPOEIA_ALLOWLIST, runDeterministicLexicalBackstop } from './hebrew-lexical-backstop';
export type { HebrewLexicalHit, HebrewLexicalHitSource } from './hebrew-lexical-backstop';

export const HEBREW_LEXICAL_PROMPT_VERSION = 'hebrew-lexical-v1';

export interface HebrewLexicalProofreadReport {
  status: 'hebrew_lexical_proofread_v1';
  promptVersion: string;
  mode: 'report_only' | 'blocking';
  hits: HebrewLexicalHit[];
  deterministicHitCount: number;
  llmHitCount: number;
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
}): Promise<{ hits: HebrewLexicalHit[]; inputTokens: number; outputTokens: number }> {
  const pages = parseStoryPages(args.markdown).map(({ page, body }) => ({
    page,
    prose: pageProseOnly(body),
  }));

  const allowlist = ONOMATOPOEIA_ALLOWLIST.join(', ');

  const systemPrompt = `You are a native Hebrew proofreader for Israeli children's picture books (ages 3–6).
Mark every word or short phrase that is NOT valid Hebrew, is a broken/truncated verb form, or sounds invented/unnatural to a native parent reader.
Propose a MINIMAL correction only — do NOT polish style, rhythm, or literary voice.

PRESERVE EXACTLY (never flag or change):
- Gender chips {male|female}
- {{childName}} and other {{placeholders}}
- Partial nikud on words
- Proper names
- Intentional onomatopoeia: ${allowlist}

Return ONLY JSON:
{
  "findings": [
    {
      "page": 1,
      "original": "exact substring from prose",
      "issue": "why invalid/unnatural",
      "suggestedMinimalFix": "minimal fix"
    }
  ]
}
If prose is clean, return { "findings": [] }.`;

  const userPrompt = `Review Hebrew prose only. Flag non-words and invented Hebrew; ignore imageDirection.\n${JSON.stringify(pages, null, 2)}`;

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

  const deterministic = runDeterministicLexicalBackstop(args.storyMarkdown);
  let llmHits: HebrewLexicalHit[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  if (!args.skipLlm) {
    const llmResult = await runLexicalLlmPass({
      markdown: args.storyMarkdown,
      modelId,
    });
    llmHits = llmResult.hits;
    inputTokens = llmResult.inputTokens;
    outputTokens = llmResult.outputTokens;
  }

  const hits = dedupeLexicalHits([...deterministic, ...llmHits]);
  const advisoryWarn = hits.length > 0;

  return {
    status: 'hebrew_lexical_proofread_v1',
    promptVersion: HEBREW_LEXICAL_PROMPT_VERSION,
    mode,
    hits,
    deterministicHitCount: deterministic.length,
    llmHitCount: llmHits.length,
    advisoryWarn,
    advisoryFail: mode === 'blocking' && advisoryWarn,
    modelId: args.skipLlm ? undefined : modelId,
    inputTokens: args.skipLlm ? undefined : inputTokens,
    outputTokens: args.skipLlm ? undefined : outputTokens,
  };
}
