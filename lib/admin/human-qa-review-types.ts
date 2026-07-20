/**
 * DTOs for the Human-QA review console. Intentionally omit every customer access key
 * (`paymentId` / `paymeTransactionId` / `stripeSessionId`) — never select or serialize them.
 */

export type HumanQaHoldKindDto =
  | 'safety'
  | 'contract_world'
  | 'anchor'
  | 'payment_integrity'
  | 'legacy_unknown';

export type OpenReviewCaseSummary = {
  caseId: string;
  orderId: string;
  childName: string;
  kind: HumanQaHoldKindDto;
  humanReason: string;
  rawReason: string;
  heldAt: string; // ISO
  pageNumbers: number[];
  storyDirection: string | null;
  orderStatus: string;
};

export type PageEvidenceDto = {
  artifactKey: string;
  pageNumber: number | null; // null for cover
  verdict: string;
  reason: string | null;
  contractHash: string | null;
  /** Safety hazards from ImageAsset and/or QualityEvidence.reason parsing. */
  safetyHazards: string[];
  /** Compact readable notes from QualityEvidence.evidence JSON (no secrets). */
  notes: string[];
  /** Anchor / resemblance hints when present in evidence JSON. */
  anchorConfidence: number | null;
  flagged: boolean;
};

export type BookPageDto = {
  pageNumber: number;
  text: string;
  imageUrl: string | null;
  safetyVerified: boolean | null;
  safetyHazards: string[];
  flagged: boolean;
  evidence: PageEvidenceDto | null;
};

export type ReviewCaseDetail = {
  caseId: string;
  orderId: string;
  childName: string;
  kind: HumanQaHoldKindDto;
  status: string;
  humanReason: string;
  rawReason: string;
  holdFingerprint: string;
  inputVersion: number;
  contractHash: string | null;
  heldAt: string;
  storyDirection: string | null;
  orderStatus: string;
  deliveryHoldReason: string | null;
  flaggedPageNumbers: number[];
  coverImageUrl: string | null;
  coverSafetyHazards: string[];
  pages: BookPageDto[];
  evidence: PageEvidenceDto[];
};
