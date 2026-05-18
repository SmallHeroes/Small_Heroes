import type { EditorialIssueRuntime } from './schemas';

const SEVERITY_RANK: Record<string, number> = { BLOCKING: 3, MAJOR: 2, MINOR: 1 };

function issueKey(issue: EditorialIssueRuntime): string {
  return `${issue.page}|${issue.quote}|${issue.reason}`;
}

function higherSeverity(
  a: EditorialIssueRuntime['severity'],
  b: EditorialIssueRuntime['severity']
): EditorialIssueRuntime['severity'] {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/** Merge scanner + LLM issues; dedupe by (page, quote, reason), keep higher severity. */
export function mergeEditorialIssues(
  scannerIssues: EditorialIssueRuntime[],
  llmIssues: EditorialIssueRuntime[]
): EditorialIssueRuntime[] {
  const map = new Map<string, EditorialIssueRuntime>();

  for (const issue of [...scannerIssues, ...llmIssues]) {
    const key = issueKey(issue);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...issue,
        _source: issue._source === 'scanner' ? 'scanner' : issue._source === 'llm' ? 'llm' : 'merged',
      });
      continue;
    }
    const severity = higherSeverity(existing.severity, issue.severity);
    map.set(key, {
      ...existing,
      ...issue,
      severity,
      _source: 'merged',
    });
  }

  return [...map.values()].sort((a, b) => a.page - b.page || a.severity.localeCompare(b.severity));
}
