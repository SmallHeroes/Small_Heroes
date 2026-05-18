import type { EditorialIssueRuntime, EditorialReportRuntime } from './schemas';

export type EditorialVerdict = EditorialReportRuntime['verdict'];

export function deriveVerdict(
  scores: EditorialReportRuntime['scores'],
  issues: EditorialIssueRuntime[]
): EditorialVerdict {
  const blocking = issues.filter((i) => i.severity === 'BLOCKING' && !i._repairedDeterministically).length;
  const major = issues.filter((i) => i.severity === 'MAJOR' && !i._repairedDeterministically).length;
  const values = Object.values(scores);
  const minDimension = Math.min(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  if (minDimension <= 1) return 'REJECT';
  if (blocking >= 5) return 'REJECT';
  if (avg < 3.2 && major >= 2) return 'REJECT';

  if (blocking >= 1) return 'NEEDS_REPAIR';
  if (major >= 3) return 'NEEDS_REPAIR';
  if (minDimension <= 2) return 'NEEDS_REPAIR';
  if (avg < 4.0) return 'NEEDS_REPAIR';

  return 'READY';
}
