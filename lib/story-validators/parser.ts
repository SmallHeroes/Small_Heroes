import type { ParsedStory } from './types';
import { parseSimpleYaml } from './utils';

const PAGE_MARKER_RE = /^---\s*Page\s+(\d+)\s*---\s*$/im;
const IMAGE_DIRECTION_RE = /^imageDirection:\s*(.*)$/im;

/**
 * Parses markdown story files into typed zones.
 * Frontmatter and imageDirection stay separate from Hebrew prose.
 */
export function parseStoryMarkdown(markdown: string): ParsedStory {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  let body = normalized;
  let frontmatter: Record<string, unknown> = {};

  if (normalized.startsWith('---')) {
    const endIdx = normalized.indexOf('\n---', 3);
    if (endIdx !== -1) {
      frontmatter = parseSimpleYaml(normalized.slice(3, endIdx).trim());
      body = normalized.slice(endIdx + 4).trimStart();
    }
  }

  const pages: ParsedStory['pages'] = [];
  const parts = body.split(PAGE_MARKER_RE);
  // split with capturing group: [preamble, pageNum, content, pageNum, content, ...]
  if (parts.length <= 1) {
    return { frontmatter, pages };
  }

  for (let i = 1; i < parts.length; i += 2) {
    const pageNumber = Number(parts[i]);
    const chunk = (parts[i + 1] ?? '').trim();
    if (!Number.isFinite(pageNumber) || !chunk) continue;

    const directionMatch = chunk.match(IMAGE_DIRECTION_RE);
    let imageDirection = '';
    let text = chunk;

    if (directionMatch) {
      imageDirection = directionMatch[1]?.trim() ?? '';
      const dirIndex = chunk.search(IMAGE_DIRECTION_RE);
      text = chunk.slice(0, dirIndex).trim();
    }

    pages.push({ pageNumber, imageDirection, text });
  }

  pages.sort((a, b) => a.pageNumber - b.pageNumber);
  return { frontmatter, pages };
}
