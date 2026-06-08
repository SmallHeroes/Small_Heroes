/**
 * Author Rewrite Pass — Writer's Room canary (experimental).
 * De-loaded prose input + children's-book editor rewrite while preserving structure.
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from './companion-context';
import { formatScenarioPromptBlock } from './scenario-prompt-block';
import {
  computePageWordCounts,
  countPageWords,
  fixUnicodeSpaces,
  pageProseOnly,
  parseStoryPages,
} from './story-page-utils';
import { finalizePhaseBMarkdownFromPages } from './story-markdown-normalize';
import type { Scenario, StoryDirection, StoryOutline } from './story-generation-types';

export const AUTHOR_REWRITE_PROMPT_VERSION = 'author-rewrite-v1';

export type AuthorRewriteInput = {
  storyMarkdown: string;
  companionId: string;
  direction: StoryDirection;
  scenarioId: string;
  scenario: Scenario;
  outline: StoryOutline;
  knownHumanNotes: string[];
  modelId?: string;
};

export type AuthorRewriteReport = {
  promptVersion: typeof AUTHOR_REWRITE_PROMPT_VERSION;
  changedPages: Array<{
    page: number;
    beforeWordCount: number;
    afterWordCount: number;
    changeSummary: string;
  }>;
  preserved: {
    pageCount: boolean;
    frontmatter: boolean;
    chips: boolean;
    imageDirections: boolean;
    companionEngine: boolean;
    scenarioShape: boolean;
  };
  risks: string[];
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
};

const WRITING_BIBLE = `
=== Writing Bible — oral Hebrew for ages 5–8 (learn the taste) ===

Bad: "הלילה נוגע בקירות."
Good: "בחדר היה חושך כחול, והצל של הכיסא זז קצת על הרצפה."

Bad: "ויש שם שקט שמקשיב."
Good: "השקט היה גדול מדי."

Bad: "שניהם נשארים במרחב שלהם."
Good: "היד נשארה מחוץ לשמיכה. אחר כך גם הנשימה נשארה."

Bad: "הילד הרגיש ביטחון פנימי."
Good: "הוא לא הכניס את היד בחזרה. רק בדק שהיא עדיין שם."

Bad: "הרעש הפך למשאב רגשי."
Good: "הבום עוד היה שם, אבל עכשיו הוא נשאר מעבר לחלון."

Bad: "הוא פעל מתוך תחושת מסוגלות."
Good: "הוא אמר את המילה. קטנה, אבל שלו."
=== end Writing Bible ===
`.trim();

interface RawRewritePage {
  page: number;
  prose: string;
  imageDirection?: string;
}

interface RawRewriteResponse {
  pages: RawRewritePage[];
  changeSummaries?: Array<{ page: number; summary: string }>;
  risks?: string[];
}

function extractPrefixBeforePages(markdown: string): string {
  const normalized = fixUnicodeSpaces(markdown);
  const idx = normalized.search(/\r?\n--- Page 1 ---/);
  return idx >= 0 ? normalized.slice(0, idx).trimEnd() : '';
}

function extractImageDirectionLine(body: string): string {
  const m = body.match(/(\r?\nimageDirection\s*:.+)/i);
  return m?.[1]?.trim() ?? '';
}

function countGenderChips(markdown: string): number {
  const withoutDouble = markdown.replace(/\{\{[^}]+\}\}/g, '');
  return (withoutDouble.match(/\{[^{}|]+\|[^{}|]+\}/g) ?? []).length;
}

function buildDeLoadedPagesPayload(markdown: string): string {
  const pages = parseStoryPages(markdown);
  return pages
    .map(({ page, body }) => {
      const prose = pageProseOnly(body);
      const img = extractImageDirectionLine(body);
      return `PAGE ${page}:\nPROSE:\n${prose}\n${img ? `IMAGE:\n${img.replace(/^imageDirection:\s*/i, '')}` : 'IMAGE: (preserve from original)'}`;
    })
    .join('\n\n---\n\n');
}

function buildSystemPrompt(): string {
  return `You are a Hebrew children's-book author/editor (ages 5–8, read aloud).
Your job is to rewrite a STRONG DRAFT into book-ready children's prose while preserving structure.
You are NOT a therapist, NOT a poet for adults, NOT a formatter.

PRESERVE (non-negotiable):
- Same page count and page order
- Same emotional arc, scenario beats, child agency moment, companion engine
- Gender chips {male|female} with DIFFERENT options — keep format; one verb per chip
- Every child verb/adjective: full {male|female} chip OR genuinely neutral Hebrew — never masculine-as-neutral (e.g. not "מוריד ראש" bare after {{childName}})
- {{childName}} placeholders
- Same psychological tool — do not change the coping mechanism
- Bedtime stays soft/quiet; no loud action or moral lecture

IMPROVE:
- Oral, concrete, child-native Hebrew
- Companion body comedy and distinct voice
- Sensory action you can see/hear
- Weak endings → concrete residue (blanket, door-light, half-open shell, one small choice)
- Remove adult-poetic abstractions, therapy language, garbles, English leaks

AVOID:
- Moral summaries, explaining the lesson, companion-as-lecturer
- New plot mechanics, fantasy additions, page bloat beyond direction range

Return ONLY JSON:
{
  "pages": [
    {
      "page": 1,
      "prose": "Hebrew prose lines only — no page header, no imageDirection prefix in prose",
      "imageDirection": "English scene note — keep or lightly adjust if action changed"
    }
  ],
  "changeSummaries": [{ "page": 1, "summary": "what improved" }],
  "risks": ["optional drift warnings"]
}`.trim();
}

function buildUserPrompt(args: AuthorRewriteInput): string {
  const companionBlock = buildCompanionContextBlock(args.companionId);
  const scenarioBlock = formatScenarioPromptBlock(args.scenario, args.companionId);
  const deLoaded = buildDeLoadedPagesPayload(args.storyMarkdown);
  const notes = args.knownHumanNotes.map((n) => `- ${n}`).join('\n');

  return `
Companion:
${companionBlock}

${scenarioBlock}

Direction: ${args.direction} · ${args.scenario.beatCount} pages · scenarioId=${args.scenarioId}

=== Human editorial notes (must address) ===
${notes}

${WRITING_BIBLE}

=== Current story (de-loaded — prose + image per page) ===
${deLoaded}

Rewrite all ${args.scenario.beatCount} pages. Output complete JSON with every page number 1–${args.scenario.beatCount}.
`.trim();
}

function assemblePageSection(
  pages: RawRewritePage[],
  originalMarkdown: string
): string {
  const originalPages = parseStoryPages(originalMarkdown);
  const origByPage = new Map(originalPages.map((p) => [p.page, p.body]));

  const blocks = pages
    .sort((a, b) => a.page - b.page)
    .map(({ page, prose, imageDirection }) => {
      const origBody = origByPage.get(page) ?? '';
      const origImg = extractImageDirectionLine(origBody);
      let imgLine = imageDirection?.trim() ?? '';
      if (imgLine && !/^imageDirection:/i.test(imgLine)) {
        imgLine = `imageDirection: ${imgLine}`;
      } else if (!imgLine && origImg) {
        imgLine = origImg.replace(/^\r?\n/, '');
      }
      return `--- Page ${page} ---\n${prose.trim()}${imgLine ? `\n\n${imgLine}` : ''}`;
    });

  return blocks.join('\n\n');
}

function detectChangedPages(
  beforeMd: string,
  afterMd: string,
  summaries: Map<number, string>
): AuthorRewriteReport['changedPages'] {
  const beforePages = parseStoryPages(beforeMd);
  const afterPages = parseStoryPages(afterMd);
  const afterByPage = new Map(afterPages.map((p) => [p.page, p]));

  return beforePages.map(({ page, body }) => {
    const beforeProse = pageProseOnly(body);
    const afterBody = afterByPage.get(page)?.body ?? '';
    const afterProse = afterBody ? pageProseOnly(afterBody) : '';
    const beforeWc = countPageWords(beforeProse);
    const afterWc = countPageWords(afterProse);
    const changed = beforeProse.trim() !== afterProse.trim();
    return {
      page,
      beforeWordCount: beforeWc,
      afterWordCount: afterWc,
      changeSummary:
        summaries.get(page) ??
        (changed ? 'prose rewritten' : 'unchanged'),
    };
  }).filter((r) => r.changeSummary !== 'unchanged' || r.beforeWordCount !== r.afterWordCount);
}

function assessPreservation(args: {
  beforeMd: string;
  afterMd: string;
  expectedPages: number;
  prefixBefore: string;
  prefixAfter: string;
}): AuthorRewriteReport['preserved'] {
  const beforePages = parseStoryPages(args.beforeMd);
  const afterPages = parseStoryPages(args.afterMd);
  const beforeChips = countGenderChips(args.beforeMd);
  const afterChips = countGenderChips(args.afterMd);

  const allImgBefore = beforePages.every((p) => /imageDirection\s*:/i.test(p.body));
  const allImgAfter = afterPages.every((p) => /imageDirection\s*:/i.test(p.body));

  return {
    pageCount: afterPages.length === args.expectedPages && afterPages.length === beforePages.length,
    frontmatter: args.prefixBefore.length > 0 && args.prefixAfter.includes('companionId:'),
    chips: afterChips >= beforeChips * 0.7,
    imageDirections: allImgBefore && allImgAfter,
    companionEngine: true,
    scenarioShape: true,
  };
}

export async function runAuthorRewritePass(
  args: AuthorRewriteInput
): Promise<{ markdown: string; report: AuthorRewriteReport }> {
  const modelId =
    args.modelId ??
    process.env.GENERATOR_LLM_MODEL?.trim() ??
    'gpt-5-chat-latest';

  const llm = new OpenAIResponsesLLM(modelId);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(args);

  const result = await llm.call({
    stage: 'author-rewrite-v1',
    systemPrompt,
    userPrompt,
    jsonMode: true,
    maxOutputTokens: 16384,
    temperature: 0.65,
  });

  const parsed = parseJsonFromLLM<RawRewriteResponse>(result.text, 'author-rewrite-v1');
  const expectedPages = args.scenario.beatCount;

  if (!parsed.pages?.length) {
    throw new Error('[author-rewrite] LLM returned no pages');
  }
  if (parsed.pages.length !== expectedPages) {
    throw new Error(
      `[author-rewrite] Expected ${expectedPages} pages, got ${parsed.pages.length}`
    );
  }

  const prefixBefore = extractPrefixBeforePages(args.storyMarkdown);
  const pageSection = assemblePageSection(parsed.pages, args.storyMarkdown);

  let markdown = finalizePhaseBMarkdownFromPages({
    scenario: args.scenario,
    outline: args.outline,
    pageSection,
  });

  if (prefixBefore && !markdown.includes('storyStyle:')) {
    const pageIdx = markdown.search(/\r?\n--- Page 1 ---/);
    if (pageIdx >= 0) {
      markdown = `${prefixBefore}\n${markdown.slice(pageIdx)}`;
    }
  }

  const summaryMap = new Map(
    (parsed.changeSummaries ?? []).map((s) => [s.page, s.summary])
  );
  const changedPages = detectChangedPages(args.storyMarkdown, markdown, summaryMap);
  const prefixAfter = extractPrefixBeforePages(markdown);
  const preserved = assessPreservation({
    beforeMd: args.storyMarkdown,
    afterMd: markdown,
    expectedPages,
    prefixBefore,
    prefixAfter,
  });

  const risks = [...(parsed.risks ?? [])];
  if (!preserved.pageCount) risks.push('page_count_mismatch');
  if (!preserved.chips) risks.push('gender_chips_reduced');
  if (!preserved.imageDirections) risks.push('image_direction_missing');

  return {
    markdown,
    report: {
      promptVersion: AUTHOR_REWRITE_PROMPT_VERSION,
      changedPages,
      preserved,
      risks,
      modelId,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    },
  };
}

export { computePageWordCounts, parseWordCountLine } from './story-page-utils';
