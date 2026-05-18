/**
 * Markdown serialization helpers for story-generator.
 * Inverse of the validators' parseStoryMarkdown — used to rebuild a story
 * from parsed structure after patch-merging a repair.
 */
import type { ParsedStory } from '@/lib/story-validators';

export interface SerializablePage {
  pageNumber: number;
  text: string;
  imageDirection: string;
}

/**
 * Rebuilds a markdown story from frontmatter + pages.
 * Used by patch-merge repair to combine original (non-changed) pages
 * with LLM-repaired pages, guaranteeing byte-for-byte preservation
 * of pages NOT in changeOnly.
 */
export function rebuildStoryMarkdown(
  frontmatter: Record<string, unknown>,
  pages: SerializablePage[]
): string {
  const fmLines = Object.entries(frontmatter)
    .map(([k, v]) => {
      if (typeof v === 'string') return `${k}: "${v}"`;
      if (typeof v === 'number' || typeof v === 'boolean') return `${k}: ${v}`;
      return `${k}: ${JSON.stringify(v)}`;
    })
    .join('\n');

  const body = pages
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map(
      (p) =>
        `--- Page ${p.pageNumber} ---\n${p.text.trim()}\n\nimageDirection: ${p.imageDirection.trim()}`
    )
    .join('\n\n');

  return `---\n${fmLines}\n---\n\n${body}\n`;
}

/** Convert ParsedStory into SerializablePage[] for rebuild. */
export function pagesFromParsed(parsed: ParsedStory): SerializablePage[] {
  return parsed.pages.map((p) => ({
    pageNumber: p.pageNumber,
    text: p.text,
    imageDirection: p.imageDirection,
  }));
}
