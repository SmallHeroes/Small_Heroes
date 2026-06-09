/**
 * Read-aloud calibration excerpts from hand-authored goldens (taste anchor).
 */

import { loadGoldenStoryMarkdown, listV3CalibrationGoldens } from './golden-story-loader';
import { pageProseOnly, parseStoryPages } from '../story-gen/story-page-utils';

const DEFAULT_GOLDEN_IDS = [
  'panda_anat_adventure',
  'fox_uri_adventure',
  'dragon_dini_fantasy',
  'dragon_dini_bedtime',
  'octopus_seara_adventure',
];

const MAX_LINES_PER_STORY = 18;

export function extractReadAloudExcerpts(markdown: string, maxLines = MAX_LINES_PER_STORY): string[] {
  const lines: string[] = [];
  for (const { body } of parseStoryPages(markdown)) {
    const prose = pageProseOnly(body);
    for (const raw of prose.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('imageDirection')) continue;
      lines.push(line);
      if (lines.length >= maxLines) return lines;
    }
  }
  return lines;
}

export function buildHebrewReadAloudCalibrationBlock(ids?: string[]): string {
  const goldenIds = ids?.length ? ids : DEFAULT_GOLDEN_IDS;
  const blocks: string[] = [];

  for (const id of goldenIds) {
    try {
      const md = loadGoldenStoryMarkdown(id);
      const excerpts = extractReadAloudExcerpts(md, 12);
      if (!excerpts.length) continue;
      blocks.push(
        `### ${id}\n${excerpts.map((l) => `- ${l}`).join('\n')}`
      );
    } catch {
      // skip missing goldens in dev
    }
  }

  if (!blocks.length) {
    return '(Goldens unavailable — using precedents only.)';
  }

  return [
    'Hand-authored SmallHeroes goldens — natural read-aloud rhythm reference:',
    '',
    ...blocks,
    '',
    'Learn: short lines, child-native verbs, companion weirdness that reads well, emotion through action not explanation.',
  ].join('\n');
}

export function listCalibrationGoldenIds(): string[] {
  return listV3CalibrationGoldens();
}
