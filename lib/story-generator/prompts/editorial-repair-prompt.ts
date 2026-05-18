import type { EditorialIssueRuntime } from '../editorial/schemas';

export function buildEditorialRepairPatchSystemPrompt(): string {
  return `
You are the Editorial Repair for Small Heroes.
You received editorial issues from the Editor. Fix ONLY those issues.

For each issue:
- Locate the EXACT quoted text on the page
- Replace it with the suggested fix (or a very close variant)
- Touch nothing else on that page
- Keep punctuation, line breaks, paragraph structure identical

The diff between your output and the original must be MINIMAL — only the
flagged spans change. Anything else is a regression.

Return JSON only: { "pages": [{ "pageNumber": number, "text": string, "imageDirection"?: string }] }
Only pages listed in the issues. No frontmatter. No page markers.
`.trim();
}

export function buildEditorialRepairPatchUserPrompt(args: {
  pagesToRepair: Array<{ pageNumber: number; text: string; imageDirection: string }>;
  issues: EditorialIssueRuntime[];
  attempt: number;
}): string {
  const byPage = new Map<number, EditorialIssueRuntime[]>();
  for (const issue of args.issues) {
    if (issue._repairedDeterministically || issue._unmatchedQuote || issue._ambiguousReplacement) continue;
    if (issue.severity === 'MINOR') continue;
    const list = byPage.get(issue.page) ?? [];
    list.push(issue);
    byPage.set(issue.page, list);
  }

  const issueBlocks = [...byPage.entries()].map(([page, list]) => {
    const items = list
      .map(
        (i) =>
          `  - [${i.field}] quote="${i.quote}" → suggestion="${i.suggestion}" (${i.reason})`
      )
      .join('\n');
    return `Page ${page}:\n${items}`;
  });

  return [
    `Editorial repair attempt ${args.attempt}`,
    '',
    'Issues to fix (BLOCKING/MAJOR only):',
    issueBlocks.join('\n\n'),
    '',
    'Pages to return (full page text after minimal edits):',
    ...args.pagesToRepair.map(
      (p) =>
        `--- page ${p.pageNumber} ---\n${p.text}\nimageDirection: ${p.imageDirection}`
    ),
  ].join('\n');
}
