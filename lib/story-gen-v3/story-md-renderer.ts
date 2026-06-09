/**
 * Render story.md from canonical story-pages.json + YAML prefix.
 */

import fs from 'fs';

import { pageProseOnly, parseStoryPages } from '../story-gen/story-page-utils';

export interface StoryPageRecord {
  page: number;
  imageDirection: string;
  prose: string;
}

export function extractFrontmatterPrefix(markdown: string): string {
  const idx = markdown.search(/\r?\n--- Page 1 ---/);
  if (idx < 0) return markdown.trim();
  return markdown.slice(0, idx).trimEnd();
}

export function renderStoryMdFromPages(prefix: string, pages: StoryPageRecord[]): string {
  const sorted = [...pages].sort((a, b) => a.page - b.page);
  const body = sorted
    .map((p) => {
      const img = p.imageDirection.trim();
      const prose = p.prose.trim();
      return `--- Page ${p.page} ---\nimageDirection: ${img.replace(/^imageDirection:\s*/i, '')}\n\n${prose}`;
    })
    .join('\n\n');
  return `${prefix.trim()}\n${body}\n`;
}

export function loadStoryPagesJson(storyPagesPath: string): StoryPageRecord[] {
  const raw = JSON.parse(fs.readFileSync(storyPagesPath, 'utf8')) as StoryPageRecord[];
  if (!Array.isArray(raw)) throw new Error(`Invalid story-pages.json: ${storyPagesPath}`);
  return raw;
}

export function writeStoryPagesJson(storyPagesPath: string, pages: StoryPageRecord[]): void {
  fs.writeFileSync(storyPagesPath, JSON.stringify(pages, null, 2), 'utf8');
}

/** Re-render story.md on disk from story-pages.json (canonical prose source). */
export function renderStoryMdFromFiles(args: {
  storyMarkdownPath: string;
  storyPagesPath: string;
}): string {
  const prefix = extractFrontmatterPrefix(fs.readFileSync(args.storyMarkdownPath, 'utf8'));
  const pages = loadStoryPagesJson(args.storyPagesPath);
  const md = renderStoryMdFromPages(prefix, pages);
  fs.writeFileSync(args.storyMarkdownPath, md, 'utf8');
  return md;
}

export function storyPagesFromMarkdown(markdown: string): StoryPageRecord[] {
  return parseStoryPages(markdown).map(({ page, body }) => {
    const imgMatch = body.match(/imageDirection\s*:\s*(.+)/i);
    const imageDirection = imgMatch?.[1]?.trim() ?? '';
    const prose = pageProseOnly(body);
    return { page, imageDirection, prose };
  });
}

export function syncStoryPagesFromMarkdown(
  markdown: string,
  storyPagesPath: string
): StoryPageRecord[] {
  const pages = storyPagesFromMarkdown(markdown);
  writeStoryPagesJson(storyPagesPath, pages);
  return pages;
}
