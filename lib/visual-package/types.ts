export const VISUAL_PACKAGE_MANIFEST_VERSION = 'visual-package/v3' as const;
export const VISUAL_PACKAGE_PROMOTION_VERSION = 'visual-package-promotion/v3' as const;
export const STORY_SOURCE_IDENTITY_VERSION = 'story-source/v1' as const;
export const CANDIDATE_EVIDENCE_VERSION = 'visual-package-candidate/v1' as const;
export const PROP_REFERENCE_CATALOG_VERSION = 'prop-reference-catalog/v1' as const;
export const SOURCE_PROMPT_RECONCILIATION_VERSION = 'source-prompt-reconciliation/v1' as const;
export const SOURCE_PROMPT_PROJECTION_VERSION = 'style01-source-prompt-projection/v1' as const;
/** Read-only package locator shared by qualification and the offline promotion writer. */
export const VISUAL_PACKAGE_MANIFEST_SUFFIX = '.visual-package.json' as const;
export const SOURCE_PROMPT_RECONCILIATION_SUFFIX =
  '.visual-contract-reconciliation.json' as const;

export type VisualPackageState = 'candidate' | 'approved';

export type WorldRealityMode =
  | 'grounded'
  | 'grounded_with_visual_metaphor'
  | 'fantastical';

export interface StorySourceIdentity {
  version: typeof STORY_SOURCE_IDENTITY_VERSION;
  path: string;
  digestAlgorithm: 'sha256-normalized-utf8';
  digest: string;
  pageCount: number;
  pageNumbers: number[];
}

export interface VisualPackageTemplateIdentity {
  artifactPath: string;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
  schemaVersion: string;
}

export interface VisualPackageCoverageIdentity {
  coverDigest: string;
  pageContractsDigest: string;
  pageCount: number;
  pageNumbers: number[];
}

export interface VisualPackageCandidateEvidence {
  version: typeof CANDIDATE_EVIDENCE_VERSION;
  sourceInputDigest: string;
  reviewDigest: string;
  provenanceDigest: string;
}

export interface VisualPackageReconciliationIdentity {
  artifactPath: string;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
  version: typeof SOURCE_PROMPT_RECONCILIATION_VERSION;
  projectionVersion: typeof SOURCE_PROMPT_PROJECTION_VERSION;
}

export interface VisualPackageBoardArtifactIdentity {
  artifactPath: string;
  artifactDigest: string;
  registryVersion: string;
  boardVersion: string;
  storyKey: string;
  setIdentityId: string;
  styleId: string;
  setDefinitionHash: string;
  contentPolicyDigest: string;
  declaredPropIds: string[];
  storageKey: string;
  assetSha256: string;
  approvedBy: string;
  approvedAt: string;
}

export interface PropReferenceCatalogEntry {
  propId: string;
  artifactPath: string;
  assetSha256: string;
  approvedBy: string;
  approvedAt: string;
}

export interface PropReferenceCatalog {
  version: typeof PROP_REFERENCE_CATALOG_VERSION;
  storyKey: string;
  styleId: string;
  artifacts: PropReferenceCatalogEntry[];
}

export interface VisualPackagePropArtifactIdentity extends PropReferenceCatalogEntry {
  catalogPath: string;
  catalogDigest: string;
}

export interface VisualPackageReviewReality {
  authoredBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  worldMode: WorldRealityMode | null;
}

export interface VisualPackageApproval {
  approvedBy: string;
  approvedAt: string;
  note?: string;
}

export interface VisualPackagePromotionRecord {
  toolVersion: typeof VISUAL_PACKAGE_PROMOTION_VERSION;
  promotedAt: string;
  templateDestination: string;
  reconciliationDestination: string;
  manifestDestination: string;
}

/**
 * The single lifecycle manifest. The compiler/review flow prepares it in `candidate` state with no approval.
 * Guy fills the review + approval records without changing any digest. The promotion tool re-verifies every bound
 * artifact and emits the same versioned shape in `approved` state with a promotion record.
 */
export interface VisualPackageManifest {
  manifestVersion: typeof VISUAL_PACKAGE_MANIFEST_VERSION;
  state: VisualPackageState;
  storyKey: string;
  styleId: string;
  source: StorySourceIdentity;
  template: VisualPackageTemplateIdentity;
  reconciliation: VisualPackageReconciliationIdentity;
  coverage: VisualPackageCoverageIdentity;
  candidateEvidence: VisualPackageCandidateEvidence;
  review: VisualPackageReviewReality;
  approval: VisualPackageApproval | null;
  requiredBoards: VisualPackageBoardArtifactIdentity[];
  requiredPropReferences: VisualPackagePropArtifactIdentity[];
  promotion: VisualPackagePromotionRecord | null;
}

export type VisualPackageIssueCode =
  | 'manifest_invalid'
  | 'approved_package_missing'
  | 'approved_package_not_approved'
  | 'approval_missing'
  | 'approval_not_guy'
  | 'approval_invalid'
  | 'review_metadata_missing'
  | 'story_key_mismatch'
  | 'story_source_missing'
  | 'story_source_mismatch'
  | 'style_mismatch'
  | 'template_missing'
  | 'template_parse_error'
  | 'template_digest_mismatch'
  | 'template_schema_unsupported'
  | 'template_invalid'
  | 'cover_contract_missing'
  | 'page_coverage_incomplete'
  | 'page_coverage_duplicate'
  | 'page_coverage_out_of_range'
  | 'coverage_identity_mismatch'
  | 'candidate_review_disagreement'
  | 'candidate_provenance_disagreement'
  | 'candidate_evidence_digest_mismatch'
  | 'reconciliation_missing'
  | 'reconciliation_invalid'
  | 'reconciliation_incomplete'
  | 'reconciliation_identity_mismatch'
  | 'reconciliation_source_mismatch'
  | 'reconciliation_template_mismatch'
  | 'board_unresolved'
  | 'board_identity_mismatch'
  | 'board_artifact_mismatch'
  | 'prop_reference_catalog_invalid'
  | 'prop_reference_missing'
  | 'prop_reference_identity_mismatch'
  | 'prop_reference_artifact_mismatch'
  | 'reference_content_conflict'
  | 'world_authority_incomplete'
  | 'world_authority_contradictory'
  | 'cover_source_authority_invalid'
  | 'cover_source_zone_unmapped'
  | 'cover_source_zone_ambiguous'
  | 'cover_source_location_mismatch'
  | 'cover_source_zone_mismatch'
  | 'cover_source_cast_mismatch'
  | 'cover_source_must_show_mismatch'
  | 'cover_source_prohibition_missing'
  | 'cover_source_spoiler_contradiction'
  | 'frozen_authority_missing'
  | 'frozen_authority_mismatch'
  | 'board_binding_missing'
  | 'board_binding_mismatch'
  | 'legacy_contract_not_qualified';

export interface VisualPackageIssue {
  code: VisualPackageIssueCode;
  message: string;
  field?: string;
  expected?: unknown;
  actual?: unknown;
}

export class VisualPackageValidationError extends Error {
  readonly isVisualPackageValidationError = true as const;

  constructor(readonly issues: VisualPackageIssue[]) {
    super(`Visual package rejected: ${issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')}`);
    this.name = 'VisualPackageValidationError';
  }
}
