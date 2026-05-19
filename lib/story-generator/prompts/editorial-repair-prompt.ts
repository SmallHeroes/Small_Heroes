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

⚠ CRITICAL — REPAIR LEAKAGE FIREWALL (v0.4.5):
The "suggestion" field you receive is a HINT for what should be in the page.
You MUST NOT copy the suggestion text VERBATIM with its metadata.
Specifically:

  NEVER write any of these meta-words/labels into the final prose text:
    פשטי / פשט / פשטה / תפשטי / תפשט / פשטו
    כתיבה פשוטה יותר / גרסה פשוטה / נוסח פשוט / נוסח קצר
    אפשר לכתוב / עדיף / מוטב / החלף / תקן / שכתב
    suggestion / rewrite / replace / simplify / better / hint / note / quote
    "עמוד N:" / "Page N:" (page labels)

  NEVER write a label-with-colon followed by a quoted Hebrew string
    (e.g., "X: 'נועה...'") — that's a meta-instruction shape, not narrative.

  If a suggestion comes formatted as "פשטי: 'X'" — your output writes
  ONLY the clean Hebrew narrative ("X"), NOT the framing.

  The page is a child's storybook page. It contains ONLY Hebrew narrative
  sentences. No quoted suggestions. No editorial commentary.

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

  // v0.4.5 — reframe the issue layout so the model sees suggestions as
  // HINTS about direction, not literal replacement strings to copy.
  // The "→" arrow + suggestion-in-quotes format previously confused the model
  // into pasting the suggestion verbatim. Now we separate clearly.
  const issueBlocks = [...byPage.entries()].map(([page, list]) => {
    const items = list
      .map(
        (i) =>
          `  Issue (${i.reason}, ${i.field}):\n` +
          `    Problem text to fix: ${JSON.stringify(i.quote)}\n` +
          `    Hint for direction (REWRITE THIS IN YOUR OWN WORDS — DO NOT COPY): ${JSON.stringify(i.suggestion)}`
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
