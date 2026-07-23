import { stripGoldenSourceHeader } from '@/lib/story-bank-v3-import';
import { parseStoryMarkdown } from '@/lib/story-validators/parser';

export interface StorySourcePage {
  pageNumber: number;
  text: string;
}

export interface StorySourceImageDirection {
  pageNumber: number;
  imageDirection: string;
}

export interface ParsedStorySourceContent {
  frontmatterMarkdown: string;
  pages: StorySourcePage[];
  pageImageDirections: StorySourceImageDirection[];
  fullStoryText: string;
}

/**
 * Normalize a bank story to the exact document consumed by visual-contract extraction.
 * Extraction and source-prompt reconciliation share this seam so page prose and historical
 * imageDirection content cannot silently diverge.
 */
export function toVisualContractFrontmatterMarkdown(raw: string): string {
  const normalized = raw
    .replace(/^\uFEFF/, '')
    .replace(/^\u00EF\u00BB\u00BF/, '')
    .replace(/\r\n/g, '\n');
  const body = /^---\ntitle:/.test(normalized)
    ? normalized
    : stripGoldenSourceHeader(normalized);
  return body.replace(/\n+WORD_COUNT:[^\n]*\s*$/i, '\n');
}

/** Pure page-boundary extraction. No filesystem, model, provider, or runtime inference. */
export function parseStorySourceContent(raw: string): ParsedStorySourceContent {
  const frontmatterMarkdown = toVisualContractFrontmatterMarkdown(raw);
  const parsed = parseStoryMarkdown(frontmatterMarkdown);
  const orderedPages = parsed.pages
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber);
  const pages = orderedPages.map((page) => ({
    pageNumber: page.pageNumber,
    text: page.text.trim(),
  }));
  const pageImageDirections = orderedPages
    .filter((page) => page.imageDirection.trim().length > 0)
    .map((page) => ({
      pageNumber: page.pageNumber,
      imageDirection: page.imageDirection.trim(),
    }));
  return {
    frontmatterMarkdown,
    pages,
    pageImageDirections,
    fullStoryText: pages
      .map((page) => `--- Page ${page.pageNumber} ---\n${page.text}`)
      .join('\n\n'),
  };
}
