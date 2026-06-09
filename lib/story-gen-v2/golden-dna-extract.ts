/**
 * Phase 1 — extract event engine from hand-authored golden (structural, not prose few-shot).
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import type { GoldenStoryDNA } from './types';

const EXTRACT_SYSTEM = `You extract the EVENT ENGINE of a Hebrew children's picture-book golden story.
You are NOT summarizing mood or atmosphere.
You identify cause/effect, physical events, child actions, try/fail, companion comic mistakes, and state changes.

BAD: "Page 3: child feels nervous and Anat supports gently."
GOOD: "Page 3: children call from the slide; child almost smiles but has not moved; barrier of fast group energy remains."

Return ONLY valid JSON matching GoldenStoryDNA schema.
Every pageEventMap entry MUST have distinct storyFactBefore vs storyFactAfter.
childAction must be a concrete verb (approaches, asks, takes, steps, notices, invents) — not only feels/watches unless that IS the event.`.trim();

export function formatGoldenDnaMarkdown(dna: GoldenStoryDNA): string {
  const lines = [
    `# Golden Story DNA — ${dna.sourceStoryId}`,
    '',
    `**Companion:** ${dna.companionId} · **Direction:** ${dna.direction}`,
    '',
    '## Event chain (macro)',
    '',
    `| Beat | Event |`,
    `|------|-------|`,
    `| Child desire | ${dna.childDesire} |`,
    `| Entry barrier | ${dna.entryBarrier} |`,
    `| First try | ${dna.firstTry} |`,
    `| Try fails because | ${dna.firstTryFailsBecause} |`,
    `| Companion comic mistake | ${dna.companionComicMistake} |`,
    `| Companion vulnerability | ${dna.companionVulnerability ?? '—'} |`,
    `| Child notices | ${dna.childNotices} |`,
    `| Child invents | ${dna.childInvents} |`,
    `| Brave action | ${dna.braveAction} |`,
    `| World response | ${dna.worldResponse} |`,
    `| Residue | ${dna.residue} |`,
    '',
    '## Page event map',
    '',
  ];

  for (const p of dna.pageEventMap) {
    lines.push(
      `### Page ${p.page}`,
      `- **Before:** ${p.storyFactBefore}`,
      `- **Event:** ${p.eventOnPage}`,
      `- **Child action:** ${p.childAction}`,
      `- **Change:** ${p.complicationOrChange}`,
      p.companionResponse ? `- **Companion:** ${p.companionResponse}` : '',
      `- **Emotional shift:** ${p.emotionalShift}`,
      `- **After:** ${p.storyFactAfter}`,
      p.pageTurnReason ? `- **Page-turn:** ${p.pageTurnReason}` : '',
      ''
    );
  }

  return lines.filter(Boolean).join('\n');
}

export async function extractGoldenStoryDNA(args: {
  goldenMarkdown: string;
  sourceStoryId: string;
  companionId: string;
  direction: GoldenStoryDNA['direction'];
  modelId: string;
}): Promise<{ dna: GoldenStoryDNA; inputTokens: number; outputTokens: number }> {
  const userPrompt = `
Source story id: ${args.sourceStoryId}
Companion: ${args.companionId}
Direction: ${args.direction}

Extract GoldenStoryDNA JSON with exactly one pageEventMap entry per page in the golden.
Fields: sourceStoryId, direction, companionId, childDesire, entryBarrier, firstTry, firstTryFailsBecause,
companionComicMistake, companionVulnerability, childNotices, childInvents, braveAction, worldResponse, residue, pageEventMap[].

Each pageEventMap item: page, storyFactBefore, eventOnPage, childAction, complicationOrChange,
companionResponse?, emotionalShift, storyFactAfter, pageTurnReason?.

GOLDEN STORY MARKDOWN:
${args.goldenMarkdown}`.trim();

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v2-golden-dna-extract',
    systemPrompt: EXTRACT_SYSTEM,
    userPrompt,
    jsonMode: true,
    maxOutputTokens: 8192,
    temperature: 0.3,
  });

  const dna = parseJsonFromLLM<GoldenStoryDNA>(result.text, 'v2-golden-dna-extract');
  dna.sourceStoryId = args.sourceStoryId;
  dna.companionId = args.companionId;
  dna.direction = args.direction;

  return { dna, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
}
