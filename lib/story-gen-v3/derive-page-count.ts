/**
 * Derive expected page count from story markdown (no hardcoded 12).
 */

import { parseStoryPages } from '../story-gen/story-page-utils';

export function derivePageCountFromStoryMarkdown(markdown: string): number {
  const yamlPages = markdown.match(/^pages:\s*(\d+)\s*$/m);
  if (yamlPages) {
    const n = Number(yamlPages[1]);
    if (n >= 1 && n <= 30) return n;
  }
  const parsed = parseStoryPages(markdown);
  if (parsed.length) {
    return Math.max(...parsed.map((p) => p.page));
  }
  return 12;
}
