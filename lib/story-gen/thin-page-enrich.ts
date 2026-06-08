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
import { directionEnrichBand } from './word-bands';

const FORBIDDEN_ENRICH_PHRASES = [
  'נשאר בלב',
  'שפת ',
  'חלון באור',
  'חלון קטן באור',
  'סימן קטן בחול',
  'נקודה רכה',
  'הגוף מספר',
];

export interface EnrichOvershootEntry {
  page: number;
  wordCount: number;
  limit: number;
}

export interface ThinPageEnrichReport {
  enabled: true;
  floorWords: number;
  targetMin: number;
  targetMax: number;
  enrichHardMax: number;
  beforeCounts: number[];
  afterCounts: number[];
  pagesEnriched: number[];
  perPage: Array<{ page: number; before: number; after: number; enriched: boolean }>;
  enrichOvershoot: EnrichOvershootEntry[];
  underFloorAfterEnrich: number[];
  enrichOvershootFail: boolean;
  underFloorAfterEnrichFail: boolean;
}

function buildEnrichSystemPrompt(band: ReturnType<typeof directionEnrichBand>): string {
  return `You enrich ONE thin Hebrew picture-book page.
Target ${band.targetMin}–${band.targetMax} Hebrew words. Do NOT exceed ${band.enrichHardMax} unless unavoidable.
Use only real, common Hebrew words — do NOT invent or contort words to pad length.
Add concrete visible detail only — never moral lectures or adult-poetic abstraction.
Preserve distinct gender chips {male|female} (options MUST differ), {{childName}}, and the locked beat event.
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
  band: ReturnType<typeof directionEnrichBand>;
}): string {
  const scenarioBlock = formatScenarioPromptBlock(args.scenario, args.scenario.companionId);
  const fantasyPageRule =
    args.scenario.direction === 'fantasy'
      ? '- Fantasy page: add concrete world/setting detail (nest, cliff, wing, sky) plus visible action — not abstract summary.'
      : '';
  return `
Companion profile:
${args.companionBlock}

${scenarioBlock}

Page ${args.page} is THIN (${args.wordCount} words; floor ${args.band.floorWords}; target ${args.band.targetMin}–${args.band.targetMax}).

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
- Preserve page beat, story event, child agency, scenario arc, companion engine.
- Add if missing: one visible action, one concrete object/scene detail, one child body/emotion cue, one companion physical/comic cue when companion is on-page.
- Target ${args.band.targetMin}–${args.band.targetMax} Hebrew words. Hard cap ${args.band.enrichHardMax}.
${fantasyPageRule}
- Use only real, common Hebrew — no invented words, no garbled niqqud padding.
- Gender chips MUST use different male/female forms (never {word|word}).
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

function shouldEnrich(wordCount: number, floorWords: number): boolean {
  return wordCount < floorWords;
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
  const enrichBand = directionEnrichBand(args.scenario.direction);
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
    if (!shouldEnrich(wc, enrichBand.floorWords)) continue;

    const beat = args.outline.beats.find((b) => b.page === page);
    if (!beat) continue;

    const imageDirection = extractImageDirection(body);
    const prev = i > 0 ? pageProseOnly(updatedPages[i - 1].body).slice(0, 200) : '';
    const next =
      i < updatedPages.length - 1 ? pageProseOnly(updatedPages[i + 1].body).slice(0, 200) : '';
    const neighborContext = [prev && `Previous page end: …${prev}`, next && `Next page start: ${next}…`]
      .filter(Boolean)
      .join('\n');

    const systemPrompt = buildEnrichSystemPrompt(enrichBand);
    const userPrompt = buildEnrichUserPrompt({
      page,
      wordCount: wc,
      beat,
      prose,
      imageDirection,
      scenario: args.scenario,
      companionBlock: args.companionBlock,
      neighborContext: neighborContext || undefined,
      band: enrichBand,
    });

    let result;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await llm.call({
          stage: `enrich-page-${page}`,
          systemPrompt,
          userPrompt,
          maxOutputTokens: 1024,
          temperature: 0.5,
        });
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const retryable = /OpenAI Responses (429|502|503|504)/.test(msg);
        if (!retryable || attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
    if (!result) continue;

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

  const enrichOvershoot: EnrichOvershootEntry[] = [];
  const underFloorAfterEnrich: number[] = [];

  for (const pageNum of pagesEnriched) {
    const after = afterCounts[pageNum - 1] ?? 0;
    if (after > enrichBand.enrichHardMax) {
      enrichOvershoot.push({
        page: pageNum,
        wordCount: after,
        limit: enrichBand.enrichHardMax,
      });
    }
    if (after < enrichBand.floorWords) {
      underFloorAfterEnrich.push(pageNum);
    }
  }

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
      floorWords: enrichBand.floorWords,
      targetMin: enrichBand.targetMin,
      targetMax: enrichBand.targetMax,
      enrichHardMax: enrichBand.enrichHardMax,
      beforeCounts,
      afterCounts,
      pagesEnriched,
      perPage,
      enrichOvershoot,
      underFloorAfterEnrich,
      enrichOvershootFail: enrichOvershoot.length > 0,
      underFloorAfterEnrichFail: underFloorAfterEnrich.length > 0,
    },
    prompts,
  };
}
