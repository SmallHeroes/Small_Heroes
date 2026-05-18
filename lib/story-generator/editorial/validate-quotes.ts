import { parseStoryMarkdown } from '@/lib/story-validators';
import type { EditorialIssueRuntime } from './schemas';

function frontmatterText(fm: Record<string, unknown>): string {
  return Object.entries(fm)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join('\n');
}

function targetText(
  parsed: ReturnType<typeof parseStoryMarkdown>,
  issue: EditorialIssueRuntime
): string | undefined {
  if (issue.field === 'frontmatter') return frontmatterText(parsed.frontmatter);
  const page = parsed.pages.find((p) => p.pageNumber === issue.page);
  if (!page) return undefined;
  if (issue.field === 'imageDirection') return page.imageDirection;
  return page.text;
}

/** Validate every issue.quote exists in the target field; mark _unmatchedQuote. */
export function validateIssueQuotes(
  storyMarkdown: string,
  issues: EditorialIssueRuntime[]
): { issues: EditorialIssueRuntime[]; reviewRequired: boolean } {
  const parsed = parseStoryMarkdown(storyMarkdown);
  let reviewRequired = false;

  for (const issue of issues) {
    const target = targetText(parsed, issue);
    if (!target || !target.includes(issue.quote)) {
      if (issue.severity !== 'MINOR') {
        issue._unmatchedQuote = true;
        reviewRequired = true;
      }
    }
  }

  return { issues, reviewRequired };
}
