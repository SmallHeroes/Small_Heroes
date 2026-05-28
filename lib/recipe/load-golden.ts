import { readFile } from 'fs/promises';
import path from 'path';

export interface LoadedGoldenExample {
  slug: string;
  /** Raw markdown content (frontmatter + pages + footer). */
  raw: string;
  /** Parsed YAML frontmatter as key-value. */
  frontmatter: Record<string, string>;
  /** Extracted page bodies in order, without imageDirection. */
  pages: Array<{ pageNumber: number; text: string; imageDirection: string }>;
  /** Metadata block lines (storyStyle, metaphor, stakes, heartLine, etc.) between frontmatter and Page 1. */
  metadataBlock: string;
}

/**
 * Load a golden story .md from story-bank/v5-fixed-v2/ and parse it into
 * its structural components for use in a few-shot prompt.
 */
export async function loadGoldenExample(slug: string, bankDir?: string): Promise<LoadedGoldenExample> {
  const dir = bankDir ?? path.join(process.cwd(), 'story-bank', 'v5-fixed-v2');
  const filePath = path.join(dir, `${slug}.md`);
  const raw = await readFile(filePath, 'utf8');

  // Frontmatter is the YAML block between the first '---' pair after the header
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/m);
  const frontmatter: Record<string, string> = {};
  if (fmMatch) {
    for (const line of fmMatch[1].split('\n')) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) frontmatter[m[1]] = m[2].trim().replace(/^"|"$/g, '');
    }
  }

  // The metadata block is everything between the frontmatter closing --- and "--- Page 1 ---"
  let metadataBlock = '';
  const afterFm = raw.split(/^---\s*$/m).slice(2).join('---');
  const beforeP1 = afterFm.split(/^--- Page 1 ---$/m)[0] ?? '';
  metadataBlock = beforeP1.trim();

  // Pages
  const pageParts = raw.split(/---\s*Page\s*(\d+)\s*---/).slice(1);
  const pages: LoadedGoldenExample['pages'] = [];
  for (let i = 0; i < pageParts.length; i += 2) {
    const pageNumber = parseInt(pageParts[i]!, 10);
    const block = pageParts[i + 1] ?? '';
    const text = block.replace(/imageDirection:.*/g, '').trim();
    const imageDirection = (block.match(/imageDirection:\s*(.+)/)?.[1] ?? '').trim();
    pages.push({ pageNumber, text, imageDirection });
  }

  return { slug, raw, frontmatter, pages, metadataBlock };
}
