/**
 * Corpus loader for freshnessTest — goldens + canaries + prior generated.
 */

import fs from 'fs';
import path from 'path';

import { extractStoryBodyFromMarkdown } from './craft-rubric-v2.1';
import { maskCompanionEngine } from './engine-vocabulary';
import type { StoryDirection } from './story-generation-types';

export interface FreshnessCorpusEntry {
  id: string;
  label: string;
  companionId: string;
  direction: StoryDirection;
  source: 'golden' | 'canary' | 'generated';
  filePath: string;
  storyMarkdown: string;
  storyBody: string;
  shapeMaskedBody: string;
}

export const GOLDEN_BANK_FILES = [
  'fox_uri_bedtime.md',
  'fawn_tzvi_bedtime.md',
  'song_whale_bedtime.md',
  'panda_anat_adventure.md',
  'chameleon_koko_adventure.md',
  'lion_shaket_adventure.md',
  'dragon_dini_fantasy.md',
  'dolphin_shahkan_fantasy.md',
  'bolly_armadillo_fantasy.md',
  'bunny_ometz_adventure.md',
] as const;

export const CANARY_RUNS = [
  {
    id: 'tubi_s5_ha_zikukim_adv',
    companionId: 'baby_elephant',
    direction: 'adventure' as const,
    folder: '2026-06-07T17-48-35-373Z',
    label: 'Tubi S5',
  },
  {
    id: 'bolly_b1_lahitraf_adv',
    companionId: 'bolly_armadillo',
    direction: 'adventure' as const,
    folder: '2026-06-07T18-49-32-189Z',
    label: 'Bolly B1',
  },
  {
    id: 'tubi_s2_ha_bayit_bed',
    companionId: 'baby_elephant',
    direction: 'bedtime' as const,
    folder: '2026-06-07T18-59-38-961Z',
    label: 'Tubi S2',
  },
  {
    id: 'bolly_b4_hacheder_bed',
    companionId: 'bolly_armadillo',
    direction: 'bedtime' as const,
    folder: '2026-06-07T19-11-50-756Z',
    label: 'Bolly B4',
  },
] as const;

function storyBankDir(): string {
  return path.join(
    process.cwd(),
    'story-bank',
    (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
  );
}

function companionFromGoldenFilename(filename: string): string {
  const base = filename.replace(/\.md$/, '');
  const parts = base.split('_');
  if (parts.length >= 3) return `${parts[0]}_${parts[1]}`;
  return base;
}

function directionFromGoldenFilename(filename: string): StoryDirection {
  if (filename.includes('_bedtime')) return 'bedtime';
  if (filename.includes('_fantasy')) return 'fantasy';
  return 'adventure';
}

function readStoryFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function toEntry(args: {
  id: string;
  label: string;
  companionId: string;
  direction: StoryDirection;
  source: FreshnessCorpusEntry['source'];
  filePath: string;
  markdown: string;
}): FreshnessCorpusEntry {
  const storyBody = extractStoryBodyFromMarkdown(args.markdown);
  return {
    id: args.id,
    label: args.label,
    companionId: args.companionId,
    direction: args.direction,
    source: args.source,
    filePath: args.filePath,
    storyMarkdown: args.markdown,
    storyBody,
    shapeMaskedBody: maskCompanionEngine(storyBody, args.companionId),
  };
}

export function loadGoldenCorpusEntries(): FreshnessCorpusEntry[] {
  const dir = storyBankDir();
  return GOLDEN_BANK_FILES.map((file) => {
    const filePath = path.join(dir, file);
    const markdown = readStoryFile(filePath);
    const companionId = companionFromGoldenFilename(file);
    return toEntry({
      id: file.replace(/\.md$/, ''),
      label: file.replace(/\.md$/, ''),
      companionId,
      direction: directionFromGoldenFilename(file),
      source: 'golden',
      filePath,
      markdown,
    });
  });
}

export function loadCanaryCorpusEntries(): FreshnessCorpusEntry[] {
  return CANARY_RUNS.map((c) => {
    const filePath = path.join(process.cwd(), 'outputs', 'story-gen-runs', c.folder, 'story.md');
    const markdown = readStoryFile(filePath);
    return toEntry({
      id: c.id,
      label: c.label,
      companionId: c.companionId,
      direction: c.direction,
      source: 'canary',
      filePath,
      markdown,
    });
  });
}

export function loadFreshnessCorpus(options?: {
  includeGoldens?: boolean;
  includeCanaries?: boolean;
  excludeId?: string;
}): FreshnessCorpusEntry[] {
  const entries: FreshnessCorpusEntry[] = [];
  if (options?.includeGoldens !== false) entries.push(...loadGoldenCorpusEntries());
  if (options?.includeCanaries !== false) entries.push(...loadCanaryCorpusEntries());
  if (options?.excludeId) {
    return entries.filter((e) => e.id !== options.excludeId);
  }
  return entries;
}

export function corpusIndexForPrompt(entries: FreshnessCorpusEntry[], maxChars = 400): string {
  return entries
    .map(
      (e) =>
        `- ${e.id} (${e.companionId}, ${e.direction}, ${e.source}): ${e.shapeMaskedBody.slice(0, maxChars).replace(/\s+/g, ' ')}…`
    )
    .join('\n');
}
