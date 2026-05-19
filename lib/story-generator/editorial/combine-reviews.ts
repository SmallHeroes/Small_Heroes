/**
 * Y-lite — combine two reviewer reports into a single EditorialReportRuntime.
 *
 * Decision matrix:
 *   PASS + PASS                  → READY        (0 BLOCKING required)
 *   PASS + WEAK / WEAK + PASS    → NEEDS_REPAIR
 *   WEAK + WEAK                  → NEEDS_REPAIR
 *   FAIL + anything              → REJECT
 *
 * Both reviewers' issues are merged. The issue schema is mapped to the existing
 * EditorialIssue schema by translating dimensions to legacy reason codes:
 *   Book Editor dimensions → broken_hebrew / read_aloud_stumble / etc.
 *   Resilience dimensions  → companion_drift / direction_drift / etc.
 *
 * The merged `scores` field uses the existing 6-key shape (legacy field names)
 * mapped from book-editor dimensions (which are the closest fit for the legacy
 * naturalHebrew/readAloud/etc. — resilience has its own dimensions that don't
 * map cleanly, so we put motifConsistency/continuity from resilience signals).
 */
import type {
  EditorialIssueRuntime,
  EditorialReportRuntime,
} from './schemas';
import type {
  BookEditorReport,
  ResilienceReport,
  ReviewerVerdictT,
} from './y-lite-schemas';

/** Map book-editor dimension → legacy editorial reason. */
function bookEditorDimensionToReason(
  dimension: string
): EditorialIssueRuntime['reason'] {
  switch (dimension) {
    case 'naturalHebrew':
      return 'broken_hebrew';
    case 'pageRhythm':
      return 'semantic_nonsense';
    case 'readAloud':
      return 'read_aloud_stumble';
    case 'wordDensity':
      return 'too_abstract_for_age';
    case 'endingFit':
      return 'wrong_ending';
    case 'childWouldAskAgain':
      return 'semantic_nonsense';
    default:
      return 'broken_hebrew';
  }
}

/** Map resilience dimension → legacy editorial reason. */
function resilienceDimensionToReason(
  dimension: string
): EditorialIssueRuntime['reason'] {
  switch (dimension) {
    case 'categoryFit':
      return 'direction_drift';
    case 'childFacedDifficulty':
      return 'direction_drift';
    case 'companionMechanicVisible':
      return 'companion_drift';
    case 'companionIrreplaceable':
      return 'companion_drift';
    case 'mirrorMomentExists':
      return 'companion_drift';
    case 'residueResilient':
      return 'wrong_ending';
    default:
      return 'direction_drift';
  }
}

function mapBookEditorIssues(report: BookEditorReport): EditorialIssueRuntime[] {
  return report.issues.map((i) => ({
    page: i.page,
    field: 'body' as const,
    severity: i.severity,
    reason: bookEditorDimensionToReason(i.dimension),
    quote: i.quote,
    suggestion: i.suggestion,
    explanation: i.explanation,
    _source: 'llm' as const,
  }));
}

function mapResilienceIssues(report: ResilienceReport): EditorialIssueRuntime[] {
  return report.issues.map((i) => ({
    page: i.page,
    field: 'body' as const,
    severity: i.severity,
    reason: resilienceDimensionToReason(i.dimension),
    quote: i.quote,
    suggestion: i.suggestion,
    explanation: i.explanation,
    _source: 'llm' as const,
  }));
}

/**
 * Convert two reviewer verdicts into a final editorial verdict.
 *
 * Conservative — any FAIL bubbles to REJECT, any WEAK forces NEEDS_REPAIR
 * even if the other side passed. We never silently downgrade a WEAK to PASS.
 */
function combineVerdicts(
  bookEditorVerdict: ReviewerVerdictT,
  resilienceVerdict: ReviewerVerdictT
): EditorialReportRuntime['verdict'] {
  if (bookEditorVerdict === 'FAIL' || resilienceVerdict === 'FAIL') {
    return 'REJECT';
  }
  if (bookEditorVerdict === 'WEAK' || resilienceVerdict === 'WEAK') {
    return 'NEEDS_REPAIR';
  }
  return 'READY';
}

/**
 * Combine the 6-dim scores of both reviewers into the legacy 6-key shape
 * for downstream compatibility (summary.json, derive-verdict, etc.).
 *
 * Mapping rationale:
 *   naturalHebrew     ← book.naturalHebrew
 *   readAloud         ← book.readAloud
 *   ageFit            ← book.wordDensity
 *   directionFit      ← resilience.categoryFit
 *   motifConsistency  ← resilience.companionMechanicVisible
 *   continuity        ← min(resilience.childFacedDifficulty, resilience.residueResilient)
 *
 * These mappings are approximate — they exist for legacy display, not for
 * verdict logic. The verdict is computed directly from reviewer verdicts.
 */
function combineScores(
  book: BookEditorReport,
  res: ResilienceReport
): EditorialReportRuntime['scores'] {
  return {
    naturalHebrew: book.scores.naturalHebrew,
    readAloud: book.scores.readAloud,
    ageFit: book.scores.wordDensity,
    directionFit: res.scores.categoryFit,
    motifConsistency: res.scores.companionMechanicVisible,
    continuity: Math.min(
      res.scores.childFacedDifficulty,
      res.scores.residueResilient
    ),
  };
}

export interface CombinedReviewResult {
  report: EditorialReportRuntime;
  bookEditorVerdict: ReviewerVerdictT;
  resilienceVerdict: ReviewerVerdictT;
  bookEditorAvg: number;
  resilienceAvg: number;
  rawIssueCount: number;
}

export function combineReviews(
  bookReport: BookEditorReport,
  resilienceReport: ResilienceReport
): CombinedReviewResult {
  const issues = [
    ...mapBookEditorIssues(bookReport),
    ...mapResilienceIssues(resilienceReport),
  ];
  const verdict = combineVerdicts(bookReport.verdict, resilienceReport.verdict);
  const scores = combineScores(bookReport, resilienceReport);

  const bookValues = Object.values(bookReport.scores);
  const resValues = Object.values(resilienceReport.scores);
  const bookEditorAvg =
    bookValues.reduce((a, b) => a + b, 0) / bookValues.length;
  const resilienceAvg = resValues.reduce((a, b) => a + b, 0) / resValues.length;

  return {
    report: { scores, issues, verdict },
    bookEditorVerdict: bookReport.verdict,
    resilienceVerdict: resilienceReport.verdict,
    bookEditorAvg,
    resilienceAvg,
    rawIssueCount: issues.length,
  };
}
