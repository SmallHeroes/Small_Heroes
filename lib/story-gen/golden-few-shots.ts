import fs from 'fs';
import path from 'path';

import type { StoryDirection } from './story-generation-types';

const STORY_BANK_DIR = path.join(
  process.cwd(),
  'story-bank',
  (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
);

/** Editorial golden set (v5-literary-golden) — read-only excerpts for few-shot. */
const GOLDEN_BY_DIRECTION: Record<StoryDirection, string[]> = {
  bedtime: ['fox_uri_bedtime.md', 'fawn_tzvi_bedtime.md', 'song_whale_bedtime.md'],
  adventure: ['panda_anat_adventure.md', 'chameleon_koko_adventure.md', 'lion_shaket_adventure.md'],
  fantasy: ['dragon_dini_fantasy.md', 'dolphin_shahkan_fantasy.md', 'bolly_armadillo_fantasy.md'],
};

function extractFewShotExcerpt(markdown: string, maxPages = 2): string {
  const headerEnd = markdown.indexOf('--- Page 1 ---');
  const header = headerEnd >= 0 ? markdown.slice(0, headerEnd).trim() : markdown.slice(0, 1200);
  const pageChunks = markdown.split(/\r?\n--- Page \d+ ---\r?\n/);
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(maxPages, pageChunks.length - 1); i++) {
    const chunk = pageChunks[i] ?? '';
    const imageIdx = chunk.indexOf('\nimageDirection:');
    const prose = imageIdx >= 0 ? chunk.slice(0, imageIdx).trim() : chunk.trim();
    pages.push(`--- Page ${i} ---\n${prose}`);
  }
  return `${header}\n\n${pages.join('\n\n')}`.trim();
}

export function loadGoldenFewShots(
  direction: StoryDirection,
  maxStories = 3,
  excludeCompanionId?: string
): Array<{ filename: string; excerpt: string }> {
  const candidates = GOLDEN_BY_DIRECTION[direction].filter((filename) => {
    if (!excludeCompanionId) return true;
    return !filename.startsWith(`${excludeCompanionId}_`);
  });

  const picked = candidates.slice(0, maxStories);
  return picked.map((filename) => {
    const filePath = path.join(STORY_BANK_DIR, filename);
    const markdown = fs.readFileSync(filePath, 'utf8');
    return { filename, excerpt: extractFewShotExcerpt(markdown) };
  });
}

export function formatFewShotsBlock(shots: Array<{ filename: string; excerpt: string }>): string {
  return shots
    .map(
      (s, i) =>
        `### Golden reference ${i + 1}: ${s.filename}\n\n${s.excerpt}`
    )
    .join('\n\n---\n\n');
}
