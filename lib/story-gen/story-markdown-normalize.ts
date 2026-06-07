/**
 * Phase B story markdown normalization — metadata, Hebrew drift, deterministic WORD_COUNT.
 */

import {
  computePageWordCounts,
  fixHebrewLatinDrift,
  fixUnicodeSpaces,
  formatWordCountLine,
  PHASE_B_DEFAULT_CHILD_GENDER,
  PHASE_B_PROMPT_VERSION,
} from './story-page-utils';
import type { Scenario, StoryOutline } from './story-generation-types';

function stripLlmWordCountLine(md: string): string {
  return md.replace(/\r?\nWORD_COUNT:[^\n]*(\r?\n\*\*[^\n]*\*\*)?[\s\S]*$/i, '').trim();
}

function extractPageSection(md: string): string {
  const normalized = fixUnicodeSpaces(md);
  const idx = normalized.search(/\r?\n--- Page 1 ---/);
  if (idx >= 0) return normalized.slice(idx).trim();
  const h3 = normalized.search(/\r?\n### Page 1\s/);
  if (h3 >= 0) return normalized.slice(h3).trim();
  return normalized;
}

function yamlQuote(value: string): string {
  if (/[:#\n"'{}|]/.test(value)) return `"${value.replace(/"/g, '\\"')}"`;
  return value;
}

function buildYamlBlock(scenario: Scenario, outline: StoryOutline): string {
  const pc = outline.powerCard;
  const stepsYaml = pc.steps.map((s) => `    - ${yamlQuote(s)}`).join('\n');
  const motifsYaml = pc.visualMotifs.map((m) => `    - ${m}`).join('\n');
  const timeOfDay =
    scenario.direction === 'bedtime' ? 'night' : scenario.direction === 'adventure' ? 'day' : 'day';

  return `---
title: ${yamlQuote(outline.title)}
companionId: ${scenario.companionId}
direction: ${scenario.direction}
category: ${scenario.category}
timeOfDay: ${timeOfDay}
gender: ${PHASE_B_DEFAULT_CHILD_GENDER}
pages: ${scenario.beatCount}
endingType: residue
worldRule: ${yamlQuote(outline.worldRule)}
powerCard:
  title: ${yamlQuote(pc.title)}
  subtitle: ${yamlQuote(pc.subtitle)}
  coreTool: ${yamlQuote(pc.coreTool)}
  steps:
${stepsYaml}
  companionReminder: ${yamlQuote(pc.companionReminder)}
  visualMotifs:
${motifsYaml}
---`;
}

function buildHeaderBlock(scenario: Scenario): string {
  const generated = new Date().toISOString();
  return `# Story: ${scenario.id} — Phase B advisory
Generated: ${generated}
Source: Locked outline + DeepProfile
Prompt-version: ${PHASE_B_PROMPT_VERSION}
Notes: partial nikqud for TTS; gender chips in prose; advisory run only.`;
}

function buildMetadataBlock(outline: StoryOutline): string {
  const m = outline.metadata;
  return [
    `storyStyle: ${m.storyStyle}`,
    `metaphor: ${m.metaphor}`,
    `stakes: ${m.stakes}`,
    `quietPagePosition: ${m.quietPagePosition}`,
    `heartLine: ${m.heartLine}`,
    `emotionalMistake: ${m.emotionalMistake}`,
    `uncomfortableTruth: ${m.uncomfortableTruth}`,
    `agencyTransfer: ${m.agencyTransfer}`,
  ].join('\n');
}

function normalizePageHeaders(pageSection: string): string {
  return fixUnicodeSpaces(pageSection).replace(
    /\r?\n### Page (\d+)\s*\r?\n/g,
    '\n--- Page $1 ---\n'
  );
}

/** Remove LLM-echoed duplicate header/YAML/fenced blocks between metadata and Page 1. */
function stripEchoedFrontmatterDuplicates(md: string): string {
  const normalized = fixUnicodeSpaces(md);
  const pageStart = normalized.search(/\r?\n(?:--- Page 1 ---|### Page 1\s)/);
  if (pageStart < 0) return normalized;

  const prefix = normalized.slice(0, pageStart);
  const suffix = normalized.slice(pageStart);

  const yamlBlock = prefix.match(/(?:^|\r?\n)---\r?\n[\s\S]*?\r?\n---/);
  if (!yamlBlock || yamlBlock.index == null) return normalized;

  const afterYamlIdx = yamlBlock.index + yamlBlock[0].length;
  const head = prefix.slice(0, afterYamlIdx);
  let meta = prefix.slice(afterYamlIdx);

  meta = meta
    .replace(
      /\r?\n# Story:[\s\S]*?(?=\r?\n(?:storyStyle:|--- Page 1 ---|### Page 1\s|$))/g,
      ''
    )
    .replace(/\r?\n```ya?ml[\s\S]*?```/g, '')
    .replace(/\r?\n---\r?\n[\s\S]*?\r?\n---/g, '')
    .replace(/\r?\n---\s*$/g, '');

  return `${head}${meta}`.trimEnd() + suffix;
}

function stripEchoedBlocksBeforeFirstPage(md: string): string {
  const normalized = fixUnicodeSpaces(md);
  const pageMatch = normalized.match(/\r?\n(?:--- Page 1 ---|### Page 1\s)/);
  if (!pageMatch || pageMatch.index == null) return normalized;
  const idx = pageMatch.index;
  let before = normalized.slice(0, idx);
  const after = normalized.slice(idx);
  before = before.replace(/\r?\n```ya?ml[\s\S]*?```/g, '');
  const storyMarkers = [...before.matchAll(/\r?\n# Story:/g)];
  if (storyMarkers.length > 1 && storyMarkers[1].index != null) {
    before = before.slice(0, storyMarkers[1].index);
  }
  return before + after;
}

export function normalizePhaseBStoryMarkdown(args: {
  rawMarkdown: string;
  scenario: Scenario;
  outline: StoryOutline;
}): string {
  let md = fixUnicodeSpaces(fixHebrewLatinDrift(args.rawMarkdown));
  md = stripLlmWordCountLine(md);
  md = stripEchoedBlocksBeforeFirstPage(md);

  const pageSection = normalizePageHeaders(extractPageSection(md));
  return finalizePhaseBMarkdownFromPages({
    scenario: args.scenario,
    outline: args.outline,
    pageSection,
  });
}

/** Rebuild normalized Phase B markdown from page section (post-enrich). */
export function finalizePhaseBMarkdownFromPages(args: {
  scenario: Scenario;
  outline: StoryOutline;
  pageSection: string;
}): string {
  const inlineMeta = buildMetadataBlock(args.outline);
  const header = buildHeaderBlock(args.scenario);
  const yaml = buildYamlBlock(args.scenario, args.outline);
  let pages = fixHebrewLatinDrift(normalizePageHeaders(args.pageSection));
  pages = pages.replace(/\r?\n---\r?\n(?=\r?\n--- Page \d+ ---)/g, '\n');

  const assembled = [header, '', yaml, '', inlineMeta, '', pages].join('\n').trim();
  let deduped = stripEchoedFrontmatterDuplicates(assembled);
  const pageIdx = deduped.search(/\r?\n(?:--- Page 1 ---|### Page 1\s)/);
  if (pageIdx >= 0) {
    deduped = deduped.slice(0, pageIdx) + normalizePageHeaders(deduped.slice(pageIdx));
  }
  const counts = computePageWordCounts(deduped);
  return `${deduped}\n\n${formatWordCountLine(counts)}`;
}
