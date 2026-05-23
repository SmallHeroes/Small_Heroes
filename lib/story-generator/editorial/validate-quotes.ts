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

/**
 * Collapse every whitespace run (spaces, tabs, newlines) to a single space.
 *
 * The story stores a page's sentences newline-separated. The LLM reviewer
 * quotes story text but re-joins multi-sentence spans with ". " — so a
 * literal `includes()` fails on text the reviewer quoted FAITHFULLY, only
 * differing in line breaks. That false `_unmatchedQuote` then trips
 * REVIEW_REQUIRED (see y-lite-qa.ts -> orchestrate-recipe.ts).
 *
 * Normalizing whitespace on BOTH sides keeps the check honest: a genuine
 * hallucination (text not in the story at all) still fails the match; a
 * real quote that only differs in whitespace now matches.
 */
function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
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
    const matched =
      target !== undefined &&
      normalizeWhitespace(target).includes(normalizeWhitespace(issue.quote));
    if (!matched) {
      if (issue.severity !== 'MINOR') {
        issue._unmatchedQuote = true;
        reviewRequired = true;
      }
    }
  }

  return { issues, reviewRequired };
}
