/**
 * Truncate story-bank markdown to the first `maxPages` page blocks.
 * Frontmatter and file-level powerCard metadata before page 1 are preserved.
 */
export function truncateStoryMarkdownToPages(raw: string, maxPages: number): string {
  if (!Number.isFinite(maxPages) || maxPages <= 0) return raw;

  const markers: Array<{ pageNum: number; start: number }> = [];
  const re = /^---\s*Page\s*(\d+)\s*---\s*$/gm;
  for (const match of raw.matchAll(re)) {
    const pageNum = parseInt(match[1], 10);
    if (!Number.isFinite(pageNum)) continue;
    markers.push({ pageNum, start: match.index ?? 0 });
  }

  if (markers.length <= maxPages) return raw;

  const cutAt = markers[maxPages]?.start;
  if (cutAt == null) return raw;

  return `${raw.slice(0, cutAt).trimEnd()}\n`;
}
