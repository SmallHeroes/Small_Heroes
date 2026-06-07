/**
 * Targeted LLM enrich pass for adventure pages below the word floor.
 */

import { OpenAIResponsesLLM } from '../story-generator/llm';
import { formatScenarioPromptBlock } from './scenario-prompt-block';
import {
  computePageWordCounts,
  countPageWords,
  pageProseOnly,
  parseStoryPages,
} from './story-page-utils';
import { finalizePhaseBMarkdownFromPages } from './story-markdown-normalize';
import type { PromptSnapshot, Scenario, StoryOutline } from './story-generation-types';
import { ADVENTURE_WORD_MIN } from './word-bands';

const FORBIDDEN_ENRICH_PHRASES = [
  'נשאר בלב',
  'שפת ',
  'חלון באור',
  'חלון קטן באור',
  'סימן קטן בחול',
  'נקודה רכה',
  'הגוף מספר',
];

export interface ThinPageEnrichReport {
  enabled: true;
  floorWords: number;
  beforeCounts: number[];
  afterCounts: number[];
  pagesEnriched: number[];
  perPage: Array<{ page: number; before: number; after: number; enriched: boolean }>;
}

function buildEnrichSystemPrompt(): string {
  return `You enrich ONE thin Hebrew picture-book adventure page to at least ${ADVENTURE_WORD_MIN} words.
Add concrete visible detail only — never moral lectures or adult-poetic abstraction.
Preserve gender chips {male|female}, {{childName}}, and the locked beat event.
Return ONLY enriched Hebrew prose lines (no page header, no imageDirection, no YAML, no fences).`.trim();
}

function buildEnrichUserPrompt(args: {
  page: number;
  wordCount: number;
  beat: StoryOutline['beats'][0];
  prose: string;
  imageDirection: string;
  scenario: Scenario;
  companionBlock: string;
  neighborContext?: string;
}): string {
  const scenarioBlock = formatScenarioPromptBlock(args.scenario, args.scenario.companionId);
  return `
Companion profile:
${args.companionBlock}

${scenarioBlock}

Page ${args.page} is THIN (${args.wordCount} words; floor ${ADVENTURE_WORD_MIN}).

LOCKED BEAT (do not change the event):
- beatSummary: ${args.beat.beatSummary}
- emotionalTurn: ${args.beat.emotionalTurn}
${args.beat.companionBeat ? `- companionBeat: ${args.beat.companionBeat}` : ''}

CURRENT PROSE:
${args.prose}

imageDirection (keep unchanged — do not output):
${args.imageDirection}

${args.neighborContext ? `NEARBY CONTEXT:\n${args.neighborContext}` : ''}

ENRICH RULES:
- Preserve page number beat, story event, child agency, scenario arc, companion engine.
- Add if missing: one visible action, one concrete object/scene detail, one child body/emotion cue, one companion physical/comic cue when companion is on-page.
- Target ${ADVENTURE_WORD_MIN}–50 Hebrew words total after enrichment.
- Do NOT add: moral explanation, therapy language, adult-poetic abstraction.
- FORBIDDEN phrases: ${FORBIDDEN_ENRICH_PHRASES.map((p) => `"${p}"`).join(', ')}

Return ONLY the enriched Hebrew prose.`.trim();
}

function extractImageDirection(body: string): string {
  const m = body.match(/imageDirection\s*:\s*(.+)/i);
  return m?.[0]?.trim() ?? '';
}

function splitPrefixAndPages(markdown: string): { prefix: string; pages: Array<{ page: number; body: string }> } {
  const idx = markdown.search(/\r?\n--- Page 1 ---/);
  const prefix = idx >= 0 ? markdown.slice(0, idx).trimEnd() : markdown;
  const pageMd = idx >= 0 ? markdown.slice(idx) : '';
  return { prefix, pages: parseStoryPages(pageMd || markdown) };
}

function rebuildMarkdown(
  scenario: Scenario,
  outline: StoryOutline,
  pages: Array<{ page: number; body: string }>
): string {
  const pageSection = pages
    .map(({ page, body }) => `--- Page ${page} ---\n${body.trim()}`)
    .join('\n\n');
  return finalizePhaseBMarkdownFromPages({ scenario, outline, pageSection });
}

export async function runThinPageEnrichPass(args: {
  storyMarkdown: string;
  scenario: Scenario;
  outline: StoryOutline;
  companionBlock: string;
  modelId: string;
}): Promise<{
  markdown: string;
  report: ThinPageEnrichReport;
  prompts: PromptSnapshot[];
}> {
  const beforeCounts = computePageWordCounts(args.storyMarkdown);
  const { pages } = splitPrefixAndPages(args.storyMarkdown);
  const prompts: PromptSnapshot[] = [];
  const pagesEnriched: number[] = [];
  const llm = new OpenAIResponsesLLM(args.modelId);

  const updatedPages = [...pages];

  for (let i = 0; i < updatedPages.length; i++) {
    const { page, body } = updatedPages[i];
    const prose = pageProseOnly(body);
    const wc = countPageWords(prose);
    if (wc >= ADVENTURE_WORD_MIN) continue;

    const beat = args.outline.beats.find((b) => b.page === page);
    if (!beat) continue;

    const imageDirection = extractImageDirection(body);
    const prev = i > 0 ? pageProseOnly(updatedPages[i - 1].body).slice(0, 200) : '';
    const next =
      i < updatedPages.length - 1 ? pageProseOnly(updatedPages[i + 1].body).slice(0, 200) : '';
    const neighborContext = [prev && `Previous page end: …${prev}`, next && `Next page start: ${next}…`]
      .filter(Boolean)
      .join('\n');

    const systemPrompt = buildEnrichSystemPrompt();
    const userPrompt = buildEnrichUserPrompt({
      page,
      wordCount: wc,
      beat,
      prose,
      imageDirection,
      scenario: args.scenario,
      companionBlock: args.companionBlock,
      neighborContext: neighborContext || undefined,
    });

    const result = await llm.call({
      stage: `enrich-page-${page}`,
      systemPrompt,
      userPrompt,
      maxOutputTokens: 1024,
      temperature: 0.55,
    });

    prompts.push({
      stage: `enrich-page-${page}`,
      systemPrompt,
      userPrompt,
      modelId: args.modelId,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    let enrichedProse = result.text.trim();
    for (const phrase of FORBIDDEN_ENRICH_PHRASES) {
      if (enrichedProse.includes(phrase)) {
        enrichedProse = enrichedProse.replace(new RegExp(phrase, 'g'), '');
      }
    }

    const newBody = imageDirection
      ? `${enrichedProse}\n\n${imageDirection}`
      : enrichedProse;
    updatedPages[i] = { page, body: newBody };
    pagesEnriched.push(page);
  }

  const markdown = rebuildMarkdown(args.scenario, args.outline, updatedPages);
  const afterCounts = computePageWordCounts(markdown);

  const perPage = beforeCounts.map((before, idx) => {
    const pageNum = idx + 1;
    const after = afterCounts[idx] ?? before;
    return {
      page: pageNum,
      before,
      after,
      enriched: pagesEnriched.includes(pageNum),
    };
  });

  return {
    markdown,
    report: {
      enabled: true,
      floorWords: ADVENTURE_WORD_MIN,
      beforeCounts,
      afterCounts,
      pagesEnriched,
      perPage,
    },
    prompts,
  };
}
