/**
 * v0.4.4 — Page-Level Repair.
 *
 * Context: by v0.4.3 the pipeline is structurally sound. The Author writes
 * clean structured pages. Y-lite catches issues. The remaining failure mode:
 * editorial repair occasionally dumps content onto ONE page (Adventure p12,
 * Fantasy p20) past the length cap.
 *
 * Old behavior: pageLengthSpike BLOCKING → story-level repair (heavy, can
 * affect other pages too) → if that fails → FAILED_TECHNICAL → user loses
 * the whole story.
 *
 * New behavior: pageLengthSpike BLOCKING → regenerate ONLY page N via a
 * tight LLM call → re-assemble markdown → re-validate. The other 19 pages
 * are kept verbatim because they are correct.
 *
 * This is surgical, not story-rewrite. Cost: ~$0.003/page-repair call.
 */
import { z } from 'zod';
import { OpenAIResponsesLLM, parseJsonFromLLM, type StoryGeneratorLLM } from '../llm';
import { parseStoryMarkdown } from '@/lib/story-validators';
import { getAgeTier } from '../prompts/draft-prompt';
import { assembleMarkdown } from './structured-draft';
import { getCompanionBible } from '@/lib/companion-bible';
import type { GenerateInput, Plan } from '../types';
import type { DraftPage } from '../editorial/draft-page-schema';

/** What the LLM returns for a single page repair. */
const PageRepairSchema = z.object({
  textSentences: z.array(z.string().min(1).max(160)).min(1).max(5),
  imageDirection: z.string().min(1).max(400),
});

function countHebrewWords(text: string): number {
  return text
    .split(/[\s,.;:!?\-]+/)
    .filter((w) => /[֐-׿]/.test(w))
    .length;
}

function parseRange(range: string): [number, number] {
  const m = range.match(/(\d+)\s*-\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [12, 24];
}

function parseSentenceMax(range: string): number {
  const m = range.match(/(\d+)\s*-\s*(\d+)/);
  return m ? Number(m[2]) : 3;
}

export interface PageLevelRepairResult {
  storyMarkdown: string;
  costUsd: number;
  modelVersion: string;
  /** Pages that were actually regenerated (subset of input request). */
  regeneratedPages: number[];
}

/**
 * Regenerate a single page within the assembled markdown.
 *
 * Strategy:
 *   1. Parse the markdown back to ParsedStory.
 *   2. Locate the target page.
 *   3. Call the LLM with prev/next pages for continuity + hard caps.
 *   4. Validate the returned page (word count, sentence count).
 *   5. Splice into the markdown via the existing assembler.
 *
 * If LLM fails or returns a too-long page, throws — caller decides whether
 * to retry, escalate, or accept the original.
 */
export async function regenerateSinglePage(args: {
  storyMarkdown: string;
  pageNumber: number;
  reason: string;
  plan: Plan;
  input: GenerateInput;
  llm: StoryGeneratorLLM;
}): Promise<{
  storyMarkdown: string;
  costUsd: number;
  modelVersion: string;
}> {
  const parsed = parseStoryMarkdown(args.storyMarkdown);
  const pageIdx = parsed.pages.findIndex((p) => p.pageNumber === args.pageNumber);
  if (pageIdx < 0) {
    throw new Error(`[page-repair] page ${args.pageNumber} not found in markdown`);
  }

  const tier = getAgeTier(args.input.childAge);
  const [, tierMaxWords] = parseRange(tier.wordsPerPage);
  const maxSentences = parseSentenceMax(tier.sentencesPerPage);
  const beat = args.plan.beatMap.find((b) => b.pageNumber === args.pageNumber);
  const bible = getCompanionBible(args.input.companionId);
  const companionName = bible?.nameClean ?? 'the companion';

  const prev = parsed.pages[pageIdx - 1];
  const next = parsed.pages[pageIdx + 1];
  const current = parsed.pages[pageIdx];

  const systemPrompt = `
You are repairing ONE page of a Hebrew children's book.
The other pages are correct and stay unchanged. Only page ${args.pageNumber} needs replacement.

Output STRICT JSON only, no markdown fences, no commentary:
{
  "textSentences": ["<Hebrew sentence>", "<Hebrew sentence>"],
  "imageDirection": "<English shot direction>"
}

⚠ HARD CAPS:
- MAX ${tierMaxWords} Hebrew words across all sentences combined.
- MAX ${maxSentences} short sentences total.
- One sentence per array entry (no multiple sentences crammed into one string).

⚠ NO adult-poetic Hebrew. NO meta-instructions. NO bracket labels.
⚠ The companion ${companionName} does NOT give speeches — only body actions.
⚠ Maintain narrative continuity with the previous and next pages.
⚠ This is a CHILDREN's book. Use simple, concrete Hebrew. No metaphors past one simple visible simile.
`.trim();

  const userPrompt = `
Repair page ${args.pageNumber}.

Reason this page failed validation:
${args.reason}

PREVIOUS page ${args.pageNumber - 1} (DO NOT CHANGE — for continuity only):
${prev ? prev.text : '(start of story)'}

CURRENT page ${args.pageNumber} (THIS is what failed — rewrite it):
${current.text}

NEXT page ${args.pageNumber + 1} (DO NOT CHANGE — for continuity only):
${next ? next.text : '(end of story)'}

${beat ? `Beat plan for this page:\n  childAction: ${beat.childAction}\n  companionAction: ${beat.companionAction}\n  target words: ${beat.wordCountTarget}` : ''}

Write a replacement page ${args.pageNumber} that:
  - Stays within ${tierMaxWords} Hebrew words total.
  - Uses at most ${maxSentences} sentences (one per array entry).
  - Flows naturally from the previous page to the next page.
  - Keeps the SAME narrative beat as the failed version, just shorter and cleaner.
  - Is the kind of page that ends without summary or moral.

Return JSON only.
`.trim();

  const result = await args.llm.call({
    stage: 'page-level-repair',
    systemPrompt,
    userPrompt,
    maxOutputTokens: 600,
    jsonMode: true,
  });

  let parsedRepair;
  try {
    const raw = parseJsonFromLLM<unknown>(result.text, 'page-level-repair');
    const validated = PageRepairSchema.safeParse(raw);
    if (!validated.success) {
      throw new Error(`Schema validation failed: ${JSON.stringify(validated.error.issues).slice(0, 200)}`);
    }
    parsedRepair = validated.data;
  } catch (err) {
    throw new Error(
      `[page-repair] LLM response invalid: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Hard cap check — refuse to splice if the repair still exceeds the cap.
  const combinedText = parsedRepair.textSentences.join(' ');
  const newWordCount = countHebrewWords(combinedText);
  if (newWordCount > tierMaxWords) {
    throw new Error(
      `[page-repair] LLM returned ${newWordCount} words, max is ${tierMaxWords}. Refusing splice.`
    );
  }

  // Convert ParsedStory pages → StructuredDraftOutput pages, splice in the
  // repaired page, then re-assemble via the canonical assembler.
  const sdPages: DraftPage[] = parsed.pages.map((p) => ({
    page: p.pageNumber,
    purpose: '',
    textSentences: p.text.split('\n').map((s) => s.trim()).filter(Boolean),
    imageDirection: p.imageDirection,
  }));

  sdPages[pageIdx] = {
    page: args.pageNumber,
    purpose: 'page-level-repair (v0.4.4)',
    textSentences: parsedRepair.textSentences,
    imageDirection: parsedRepair.imageDirection,
  };

  const title = String(parsed.frontmatter.title ?? '').trim() || 'סיפור';
  const storyMarkdown = assembleMarkdown(
    { frontmatter: { title }, pages: sdPages },
    args.input
  );

  console.log(
    `[page-repair] page ${args.pageNumber}: ${current.text.length} chars → ${combinedText.length} chars (${newWordCount} words, cap ${tierMaxWords})`
  );

  return {
    storyMarkdown,
    costUsd: result.costUsd,
    modelVersion: result.modelVersion,
  };
}

/**
 * Attempt page-level repairs for all BLOCKING pageLengthSpike findings.
 * Returns the new markdown after repairs (or original if all failed).
 */
export async function repairPageLengthSpikes(args: {
  storyMarkdown: string;
  spikeFindings: Array<{ page?: number; message: string }>;
  plan: Plan;
  input: GenerateInput;
  llm: StoryGeneratorLLM;
}): Promise<PageLevelRepairResult> {
  let storyMarkdown = args.storyMarkdown;
  let totalCost = 0;
  let modelVersion = '';
  const regeneratedPages: number[] = [];

  for (const finding of args.spikeFindings) {
    if (!finding.page) continue;
    try {
      const repair = await regenerateSinglePage({
        storyMarkdown,
        pageNumber: finding.page,
        reason: finding.message,
        plan: args.plan,
        input: args.input,
        llm: args.llm,
      });
      storyMarkdown = repair.storyMarkdown;
      totalCost += repair.costUsd;
      modelVersion = repair.modelVersion;
      regeneratedPages.push(finding.page);
    } catch (err) {
      console.warn(
        `[page-repair] page ${finding.page} repair failed: ${err instanceof Error ? err.message : err}`
      );
      // Continue with next page; partial success is better than total.
    }
  }

  return { storyMarkdown, costUsd: totalCost, modelVersion, regeneratedPages };
}

/**
 * Helper for callers without an LLM instance.
 * Same shape as the LLM client used by other stages.
 */
export function defaultLLMForPageRepair(): StoryGeneratorLLM {
  return new OpenAIResponsesLLM(process.env.PIPELINE_SUPPORT_MODEL || 'gpt-5-chat-latest');
}
