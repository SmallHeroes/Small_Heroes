/**
 * Minimal deterministic post-prose fixes for Generator-v2 artifacts (not generic rewrite).
 */

const BROKEN_CHIP_FIXES: Array<[RegExp, string]> = [
  [/\{הרימו\|הרימה\}/g, '{הרים|הרימה}'],
  [/\{הרים\|הריםה\}/g, '{הרים|הרימה}'],
  [/\{הרים\|הרימהה\}/g, '{הרים|הרימה}'],
];

export function applyProseV2ArtifactFixes(args: {
  storyMarkdown: string;
  pageCount: number;
  storyId?: string;
  promptVersion?: string;
  generatedAt?: string;
}): { markdown: string; fixes: string[] } {
  const fixes: string[] = [];
  let md = args.storyMarkdown;

  for (const [re, replacement] of BROKEN_CHIP_FIXES) {
    if (re.source && md.match(re)) {
      md = md.replace(re, replacement);
      fixes.push(`chip: ${re.source} → ${replacement}`);
    }
  }

  const generatedAt = args.generatedAt ?? new Date().toISOString();
  if (!/^Generated:\s*\d{4}-\d{2}-\d{2}T/.test(md) || /Generated: 2024/.test(md)) {
    md = md.replace(/^Generated:.*$/m, `Generated: ${generatedAt}`);
    if (!/^Generated:/m.test(md)) {
      const headerEnd = md.indexOf('\n---');
      if (headerEnd > 0) {
        md = md.slice(0, headerEnd) + `\nGenerated: ${generatedAt}` + md.slice(headerEnd);
      }
    }
    fixes.push('header: Generated timestamp');
  }

  if (args.pageCount > 0 && !/^pages:\s*\d+/m.test(md)) {
    const genderMatch = md.match(/^gender:\s*.+$/m);
    if (genderMatch) {
      md = md.replace(genderMatch[0], `${genderMatch[0]}\npages: ${args.pageCount}`);
      fixes.push(`yaml: added pages: ${args.pageCount}`);
    }
  }

  if (args.storyId && !/^# Story:/m.test(md)) {
    md = `# Story: ${args.storyId} — Generator-v2\n${md}`;
    fixes.push('header: Story title line');
  }

  return { markdown: md, fixes };
}
