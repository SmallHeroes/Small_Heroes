/**
 * Phase B story markdown normalization — metadata, Hebrew drift, deterministic WORD_COUNT.
 */

import {
  computePageWordCounts,
  fixHebrewLatinDrift,
  formatWordCountLine,
  PHASE_B_DEFAULT_CHILD_GENDER,
  PHASE_B_PROMPT_VERSION,
} from './story-page-utils';
import type { Scenario, StoryOutline } from './story-generation-types';

function stripLlmWordCountLine(md: string): string {
  return md.replace(/\r?\nWORD_COUNT:[^\n]*(\r?\n\*\*[^\n]*\*\*)?[\s\S]*$/i, '').trim();
}

function extractPageSection(md: string): string {
  const idx = md.search(/\r?\n--- Page 1 ---/);
  if (idx >= 0) return md.slice(idx).trim();
  const h3 = md.search(/\r?\n### Page 1 /);
  if (h3 >= 0) return md.slice(h3).trim();
  return md;
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
  return pageSection.replace(/\r?\n### Page (\d+)\r?\n/g, '\n--- Page $1 ---\n');
}

export function normalizePhaseBStoryMarkdown(args: {
  rawMarkdown: string;
  scenario: Scenario;
  outline: StoryOutline;
}): string {
  let md = fixHebrewLatinDrift(args.rawMarkdown);
  md = stripLlmWordCountLine(md);

  const pageSection = normalizePageHeaders(extractPageSection(md));
  const inlineMeta = buildMetadataBlock(args.outline);

  const header = buildHeaderBlock(args.scenario);
  const yaml = buildYamlBlock(args.scenario, args.outline);
  const pages = fixHebrewLatinDrift(pageSection);

  const assembled = [header, '', yaml, '', inlineMeta, '', pages].join('\n').trim();
  const counts = computePageWordCounts(assembled);
  return `${assembled}\n\n${formatWordCountLine(counts)}`;
}
