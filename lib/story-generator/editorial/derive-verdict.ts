import type { EditorialIssueRuntime, EditorialReportRuntime } from './schemas';

export type EditorialVerdict = EditorialReportRuntime['verdict'];

/**
 * v0.2.4 — Ruthless verdict policy.
 *
 * The AI is the last gate before a paying customer receives the book.
 * If a story slips through with broken Hebrew, the child reads it.
 *
 * Tightened gates (vs v0.2.3):
 *   - min dimension must be ≥ 4 (was ≥ 3)
 *   - avg must be ≥ 4.5 (was ≥ 4.0)
 *   - any MAJOR triggers NEEDS_REPAIR (was: needed 3+)
 *
 * The goal is to err toward NEEDS_REPAIR. A REVIEW_REQUIRED/REJECT is cheap.
 * A bad book in customer's hand is expensive.
 */
export function deriveVerdict(
  scores: EditorialReportRuntime['scores'],
  issues: EditorialIssueRuntime[]
): EditorialVerdict {
  const blocking = issues.filter((i) => i.severity === 'BLOCKING' && !i._repairedDeterministically).length;
  const major = issues.filter((i) => i.severity === 'MAJOR' && !i._repairedDeterministically).length;
  const values = Object.values(scores);
  const minDimension = Math.min(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  // REJECT — irrecoverable
  if (minDimension <= 1) return 'REJECT';
  if (blocking >= 5) return 'REJECT';
  if (avg < 3.0 && major >= 2) return 'REJECT'; // was 3.2 — slightly stricter
  if (avg < 3.5) return 'REJECT';                // NEW: very low avg → reject, don't try to repair

  // NEEDS_REPAIR — fixable but not shippable yet
  if (blocking >= 1) return 'NEEDS_REPAIR';
  if (major >= 1) return 'NEEDS_REPAIR';         // was major >= 3 — any MAJOR is a stop
  if (minDimension < 4) return 'NEEDS_REPAIR';   // was minDimension <= 2
  if (avg < 4.5) return 'NEEDS_REPAIR';          // was avg < 4.0 — RAISED to 4.5

  // READY — truly publishable (avg ≥ 4.5, min ≥ 4, 0 BLOCKING, 0 MAJOR)
  return 'READY';
}
