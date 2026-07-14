import type { ParsedStory } from './types';
import { parseSimpleYaml } from './utils';

const PAGE_MARKER_RE = /^---\s*Page\s+(\d+)\s*---\s*$/im;
// Capture the (first) imageDirection VALUE. `[^\S\n]*` = horizontal whitespace only, so an EMPTY value
// (`imageDirection:` then a line break) does NOT let `.*` swallow the next physical (prose) line.
const IMAGE_DIRECTION_RE = /^imageDirection:[^\S\n]*(.*)$/im;
// Strip EVERY imageDirection line out of a page block's prose (a block may carry more than one; the line may
// sit before or after the prose).
const IMAGE_DIRECTION_LINE_RE = /^imageDirection:.*$/gim;

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
      // The imageDirection line may sit AFTER the prose (v5/bank format) or BEFORE it (Generator-v3, e.g.
      // fox_uri_adventure), and a block may carry more than one. Strip EVERY imageDirection line and keep the
      // prose on either side. The old `slice(0, dirIndex)` silently dropped all prose when the direction came
      // first (→ an empty page); removing only the first line would leak a second directive into the prose.
      text = chunk.replace(IMAGE_DIRECTION_LINE_RE, '').trim();
    }

    pages.push({ pageNumber, imageDirection, text });
  }

  pages.sort((a, b) => a.pageNumber - b.pageNumber);
  return { frontmatter, pages };
}
