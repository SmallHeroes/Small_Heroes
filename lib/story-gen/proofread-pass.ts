/**
 * Surgical proofread pass — fix garbled Hebrew / English leaks only.
 * HARD CONTRACT: preserve chips, {{childName}}, nikud, pages, imageDirection, meaning.
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { scanHebrewSanity } from './hebrew-sanity';
import { parseStoryPages, pageProseOnly } from './story-page-utils';
import { DEFAULT_STORY_GEN_MODELS } from './story-generation-types';

export const PROOFREAD_PROMPT_VERSION = 'proofread-v1';

export interface ProofreadChange {
  page: number;
  before: string;
  after: string;
  reason: string;
}

export interface ProofreadReport {
  status: 'deterministic_and_llm';
  promptVersion: string;
  changes: ProofreadChange[];
  changeCount: number;
  pagesTouched: number[];
  hebrewSanityBefore: number;
  hebrewSanityAfter: number;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface DeterministicFix {
  pattern: RegExp;
  replacement: string;
  reason: string;
}

/** Canary-known + common garbled tokens — surgical only. */
const DETERMINISTIC_FIXES: DeterministicFix[] = [
  { pattern: /too[\s‑-]?SHUT/gi, replacement: 'סגור מדי', reason: 'english_fragment_leak' },
  { pattern: /נומבפנים/g, replacement: 'מבפנים', reason: 'garbled_hebrew' },
  { pattern: /לעף אחד/g, replacement: 'אף אחד', reason: 'typo_lamed_alef' },
  { pattern: /א([ָא])?סוּ?ג/g, replacement: 'סוגר', reason: 'nonexistent_verb' },
  { pattern: /קוֹל כּ?ָ?שׁ?ֵ?ר/g, replacement: 'קול טוב', reason: 'wrong_idiom_kosher' },
  { pattern: /קול כשר/g, replacement: 'קול טוב', reason: 'wrong_idiom_kosher' },
  { pattern: /בוחר\/ת קוֹל כּ?ָ?שׁ?ֵ?ר/g, replacement: 'בוחר/ת קול טוב', reason: 'wrong_idiom_kosher' },
  { pattern: /רַק נוֹעֵם/g, replacement: 'רק רוגע', reason: 'adult_poetic_thinness' },
  { pattern: /רק נועם/g, replacement: 'רק רוגע', reason: 'adult_poetic_thinness' },
];

function applyDeterministicToText(text: string, page: number, changes: ProofreadChange[]): string {
  let out = text;
  for (const fix of DETERMINISTIC_FIXES) {
    if (!fix.pattern.test(out)) {
      fix.pattern.lastIndex = 0;
      continue;
    }
    fix.pattern.lastIndex = 0;
    const before = out;
    out = out.replace(fix.pattern, fix.replacement);
    if (out !== before) {
      changes.push({
        page,
        before: before.slice(0, 120),
        after: out.slice(0, 120),
        reason: fix.reason,
      });
    }
  }
  return out;
}

function rebuildMarkdownFromPages(
  original: string,
  pages: Array<{ page: number; body: string }>
): string {
  const prefixMatch = original.match(/^[\s\S]*?(?=\r?\n--- Page 1 ---)/);
  const prefix = prefixMatch?.[0] ?? '';
  const wordCountMatch = original.match(/\r?\nWORD_COUNT:[^\n]*$/);
  const wordCountLine = wordCountMatch?.[0] ?? '';

  const pageBlocks = pages
    .sort((a, b) => a.page - b.page)
    .map(({ page, body }) => `--- Page ${page} ---\n${body.trim()}\n`)
    .join('\n');

  return `${prefix.trimEnd()}\n${pageBlocks.trimEnd()}${wordCountLine}\n`;
}

interface LlmProofreadRow {
  page: number;
  original: string;
  corrected: string;
  reason: string;
}

async function llmSurgicalPageFixes(args: {
  markdown: string;
  flaggedPages: number[];
  modelId: string;
}): Promise<{ rows: LlmProofreadRow[]; inputTokens: number; outputTokens: number }> {
  if (args.flaggedPages.length === 0) {
    return { rows: [], inputTokens: 0, outputTokens: 0 };
  }

  const pages = parseStoryPages(args.markdown).filter((p) =>
    args.flaggedPages.includes(p.page)
  );
  const blocks = pages.map(({ page, body }) => {
    const prose = pageProseOnly(body);
    const img = body.match(/imageDirection\s*:.+/i)?.[0] ?? '';
    return { page, prose, imageDirection: img };
  });

  const systemPrompt = `You are a surgical Hebrew proofreader for children's picture-book pages.
FIX ONLY: garbled/non-existent Hebrew, typos, English leaks, wrong words.
PRESERVE EXACTLY: gender chips {male|female}, {{childName}}, nikud, meaning, beats, companion voice.
DO NOT: rephrase for style, enrich, shorten, or "improve" correct text.
Return ONLY JSON:
{
  "pages": [
    { "page": 1, "original": "...", "corrected": "...", "reason": "typo" }
  ]
}
If a page needs no fix, omit it. corrected must differ from original only where broken.`;

  const userPrompt = `Fix ONLY broken Hebrew on these pages:\n${JSON.stringify(blocks, null, 2)}`;

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'proofread-surgical',
    systemPrompt,
    userPrompt,
    jsonMode: true,
    maxOutputTokens: 4096,
    temperature: 0,
  });

  const parsed = parseJsonFromLLM<{ pages: LlmProofreadRow[] }>(result.text, 'proofread');
  return {
    rows: parsed.pages ?? [],
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

function mergeLlmFixIntoBody(body: string, row: LlmProofreadRow): string {
  const prose = pageProseOnly(body);
  if (row.corrected === prose || !row.corrected.trim()) return body;
  const imgMatch = body.match(/(\r?\nimageDirection\s*:.+)/i);
  const img = imgMatch?.[1] ?? '';
  return `${row.corrected.trim()}${img ? `\n${img.trim()}` : ''}`;
}

export async function runProofreadPass(args: {
  storyMarkdown: string;
  modelId?: string;
  skipLlm?: boolean;
}): Promise<{ markdown: string; report: ProofreadReport }> {
  const modelId = args.modelId ?? DEFAULT_STORY_GEN_MODELS.draftModel;
  const sanityBefore = scanHebrewSanity(args.storyMarkdown);
  const changes: ProofreadChange[] = [];
  const parsed = parseStoryPages(args.storyMarkdown);

  const updatedPages = parsed.map(({ page, body }) => {
    const prose = pageProseOnly(body);
    const fixedProse = applyDeterministicToText(prose, page, changes);
    if (fixedProse === prose) return { page, body };
    const imgMatch = body.match(/(\r?\nimageDirection\s*:.+)/i);
    const img = imgMatch?.[1] ?? '';
    return { page, body: `${fixedProse.trim()}${img ? `\n${img.trim()}` : ''}` };
  });

  let markdown = rebuildMarkdownFromPages(args.storyMarkdown, updatedPages);
  let inputTokens = 0;
  let outputTokens = 0;

  const sanityMid = scanHebrewSanity(markdown);
  const flaggedPages = [...new Set(sanityMid.hits.map((h) => h.page).filter((p) => p > 0))];

  if (!args.skipLlm && flaggedPages.length > 0) {
    const llmResult = await llmSurgicalPageFixes({
      markdown,
      flaggedPages,
      modelId,
    });
    inputTokens = llmResult.inputTokens;
    outputTokens = llmResult.outputTokens;
    const byPage = new Map(parseStoryPages(markdown).map((p) => [p.page, p.body]));
    for (const row of llmResult.rows) {
      const prevBody = byPage.get(row.page);
      if (!prevBody) continue;
      const nextBody = mergeLlmFixIntoBody(prevBody, row);
      if (nextBody !== prevBody) {
        changes.push({
          page: row.page,
          before: pageProseOnly(prevBody).slice(0, 120),
          after: pageProseOnly(nextBody).slice(0, 120),
          reason: row.reason || 'llm_surgical',
        });
        byPage.set(row.page, nextBody);
      }
    }
    markdown = rebuildMarkdownFromPages(
      markdown,
      [...byPage.entries()].map(([page, body]) => ({ page, body }))
    );
  }

  const sanityAfter = scanHebrewSanity(markdown);
  const pagesTouched = [...new Set(changes.map((c) => c.page))];

  return {
    markdown,
    report: {
      status: 'deterministic_and_llm',
      promptVersion: PROOFREAD_PROMPT_VERSION,
      changes,
      changeCount: changes.length,
      pagesTouched,
      hebrewSanityBefore: sanityBefore.hitCount,
      hebrewSanityAfter: sanityAfter.hitCount,
      modelId: inputTokens > 0 ? modelId : undefined,
      inputTokens: inputTokens || undefined,
      outputTokens: outputTokens || undefined,
    },
  };
}

/** Proofread without LLM — for validation diffs on known deterministic fixes. */
export function runProofreadDeterministic(storyMarkdown: string): {
  markdown: string;
  report: ProofreadReport;
} {
  const sanityBefore = scanHebrewSanity(storyMarkdown);
  const changes: ProofreadChange[] = [];
  const parsed = parseStoryPages(storyMarkdown);
  const updatedPages = parsed.map(({ page, body }) => {
    const prose = pageProseOnly(body);
    const fixedProse = applyDeterministicToText(prose, page, changes);
    if (fixedProse === prose) return { page, body };
    const imgMatch = body.match(/(\r?\nimageDirection\s*:.+)/i);
    const img = imgMatch?.[1] ?? '';
    return { page, body: `${fixedProse.trim()}${img ? `\n${img.trim()}` : ''}` };
  });
  const markdown = rebuildMarkdownFromPages(storyMarkdown, updatedPages);
  const sanityAfter = scanHebrewSanity(markdown);
  return {
    markdown,
    report: {
      status: 'deterministic_and_llm',
      promptVersion: PROOFREAD_PROMPT_VERSION,
      changes,
      changeCount: changes.length,
      pagesTouched: [...new Set(changes.map((c) => c.page))],
      hebrewSanityBefore: sanityBefore.hitCount,
      hebrewSanityAfter: sanityAfter.hitCount,
    },
  };
}
