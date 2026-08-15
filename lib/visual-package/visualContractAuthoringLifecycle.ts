import path from 'path';

import {
  VISUAL_CONTRACT_AUTHORING_ENDPOINT,
  VISUAL_CONTRACT_AUTHORING_HARD_COST_CEILING_USD,
  VISUAL_CONTRACT_AUTHORING_MAX_CALLS,
  VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
  VISUAL_CONTRACT_AUTHORING_MAX_PAGES_CURRENT_POLICY,
  VISUAL_CONTRACT_AUTHORING_MAX_REPAIRS,
  VISUAL_CONTRACT_AUTHORING_MODEL,
  VISUAL_CONTRACT_AUTHORING_NO_FALLBACK,
  VISUAL_CONTRACT_AUTHORING_POLICY_VERSION,
  VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS,
  VISUAL_CONTRACT_AUTHORING_PROVIDER,
  VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT,
  VISUAL_CONTRACT_AUTHORING_SERVICE_TIER,
  VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS,
  VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_REPAIRS,
  VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_CALLS,
  VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_ELIGIBLE_PRECEDING_REPAIR_MODES,
  VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_INPUT_TOKENS,
  VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_OUTPUT_TOKENS,
  VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_REPAIRS,
  VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS,
  VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED,
  VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES,
  terminalReferenceCleanupPredecessorIsEligible,
} from '@/lib/visual-contract-compiler/authoringPolicy';
import {
  authoringMaxOutputTokens,
  buildTemplateRepairSystemPrompt,
  buildTemplateCompileSystemPrompt,
  buildTemplateCompileUserPrompt,
  compileBookVisualContractTemplate,
  REPAIR_PROMPT_VERSION,
  REPAIR_USER_PROMPT_VERSION,
  DraftAuthorityReferenceDomainError,
  TEMPLATE_PROMPT_VERSION,
  TEMPLATE_USER_PROMPT_VERSION,
  TemplateRepairExhaustedError,
  TemplateRepairOutputInvalidError,
  type TemplateCompileResult,
} from '@/lib/visual-contract-compiler/compileBookVisualContractTemplate';
import type {
  DraftAuthorityReferenceIssue,
} from '@/lib/visual-contract-compiler/draftAuthorityReferenceDiagnostics';
import {
  draftValidationDiagnosticCodesForIssues,
  draftValidationAttemptDiagnosticsIsValid,
  draftValidationDiagnosticTrailIsValid,
  type DraftValidationAttemptDiagnostics,
  type DraftValidationIssue,
} from '@/lib/visual-contract-compiler/draftValidationDiagnostics';
import {
  ACTION_SEMANTIC_CATALOG,
  ACTION_SEMANTIC_CATALOG_VERSION,
} from '@/lib/visual-contract-compiler/actionSemanticCatalog';
import {
  ACTION_SEMANTIC_COVERAGE_VERSION,
  ActionSemanticCapabilityGapError,
  actionSemanticCoverageIssues,
  assertCompleteActionSemanticCoverage,
  type ActionSemanticCoverageRecord,
} from '@/lib/visual-contract-compiler/actionSemanticCoverage';
import {
  SOURCE_EVIDENCE_CATALOG_VERSION,
} from '@/lib/visual-contract-compiler/sourceEvidenceCatalog';
import {
  SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
  SOURCE_EVIDENCE_ID_REPAIR_PROMPT_VERSION,
  SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME,
  SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_VERSION,
  SOURCE_EVIDENCE_ID_REPAIR_USER_PROMPT_VERSION,
  buildSourceEvidenceIdRepairSystemPrompt,
} from '@/lib/visual-contract-compiler/sourceEvidenceIdRepair';
import {
  PAGE_CONTRACT_REPAIR_JSON_SCHEMA,
  PAGE_CONTRACT_REPAIR_PROMPT_VERSION,
  PAGE_CONTRACT_REPAIR_SCHEMA_NAME,
  PAGE_CONTRACT_REPAIR_SCHEMA_VERSION,
  PAGE_CONTRACT_REPAIR_USER_PROMPT_VERSION,
  PAGE_SPATIAL_REFERENCE_REPAIR_JSON_SCHEMA,
  PAGE_SPATIAL_REFERENCE_REPAIR_PROMPT_VERSION,
  PAGE_SPATIAL_REFERENCE_REPAIR_SCHEMA_NAME,
  PAGE_SPATIAL_REFERENCE_REPAIR_SCHEMA_VERSION,
  PAGE_SPATIAL_REFERENCE_REPAIR_USER_PROMPT_VERSION,
  buildPageContractRepairSystemPrompt,
  buildPageSpatialReferenceRepairSystemPrompt,
} from '@/lib/visual-contract-compiler/pageContractRepair';
import {
  STRUCTURAL_BUNDLE_REPAIR_JSON_SCHEMA,
  STRUCTURAL_BUNDLE_REPAIR_PROMPT_VERSION,
  STRUCTURAL_BUNDLE_REPAIR_SCHEMA_NAME,
  STRUCTURAL_BUNDLE_REPAIR_SCHEMA_VERSION,
  STRUCTURAL_BUNDLE_REPAIR_USER_PROMPT_VERSION,
  buildStructuralBundleRepairSystemPrompt,
} from '@/lib/visual-contract-compiler/structuralBundleRepair';
import {
  BOOK_SURFACE_REPAIR_JSON_SCHEMA,
  BOOK_SURFACE_REPAIR_PROMPT_VERSION,
  BOOK_SURFACE_REPAIR_SCHEMA_NAME,
  BOOK_SURFACE_REPAIR_SCHEMA_VERSION,
  BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION,
  buildBookSurfaceRepairSystemPrompt,
} from '@/lib/visual-contract-compiler/bookSurfaceRepair';
import {
  PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA,
  PRESENTATION_REQUIREMENT_REPAIR_PROMPT_VERSION,
  PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_NAME,
  PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_VERSION,
  PRESENTATION_REQUIREMENT_REPAIR_USER_PROMPT_VERSION,
  buildPresentationRequirementRepairSystemPrompt,
} from '@/lib/visual-contract-compiler/presentationRequirementRepair';
import {
  STABLE_PROP_SCOPE_REPAIR_JSON_SCHEMA,
  STABLE_PROP_SCOPE_REPAIR_PROMPT_VERSION,
  STABLE_PROP_SCOPE_REPAIR_SCHEMA_NAME,
  STABLE_PROP_SCOPE_REPAIR_SCHEMA_VERSION,
  STABLE_PROP_SCOPE_REPAIR_USER_PROMPT_VERSION,
  buildStablePropScopeRepairSystemPrompt,
} from '@/lib/visual-contract-compiler/stablePropScopeRepair';
import type {
  ContractLlmCallOptions,
  ContractLlmPromptAuthority,
} from '@/lib/visual-contract-compiler/compileBookVisualContract';
import {
  InvalidVisualContractError,
} from '@/lib/visual-contract-compiler/validateBookVisualContract';
import {
  extractDeterministicFacts,
} from '@/lib/visual-contract-compiler/extractDeterministicFacts';
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  TEMPLATE_DRAFT_SCHEMA_NAME,
  TEMPLATE_DRAFT_SCHEMA_VERSION,
} from '@/lib/visual-contract-compiler/templateDraftSchema';
import type {
  BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler/contractTemplateTypes';

import {
  canonicalJsonDigest,
  isoTimestampIsValid,
  nonEmpty,
  repoRelativePath,
} from './integrity';
import {
  writeCanonicalContentAddressedJsonArtifact,
} from './canonicalContentAddressedJson';
import {
  ProviderCallFailureDiagnosticError,
  buildProviderCallFailureEvidence,
  unclassifiedAdapterFailureDiagnostic,
  type ProviderCallFailureEvidence,
  type SanitizedProviderFailureDiagnostic,
} from './providerFailureDiagnostics';
import {
  aggregateAuthoringExecutionAttestations,
  authoringBudgetExhaustionBindingIsValid,
  authoringExecutionAttestationIsValid,
  buildAuthoringTerminalFailure,
  canonicalCompletedExecutionAttestationIsValid,
  injectedAuthoringExecutionAttestation,
  notRunAuthoringExecutionAttestation,
  sanitizedAuthoringDiagnostics,
  type AuthoringExecutionAttestation,
  type AuthoringDiagnosticCode,
  type AuthoringTerminalFailureCode,
} from './authoringTerminalDiagnostics';
import {
  buildVisualContractAuthoringTerminalFailure,
  visualContractAuthoringTerminalFailureIsValid,
  type VisualContractAuthoringTerminalFailure,
} from './visualContractAuthoringTerminalDiagnostics';
import {
  assertValidStorySourceAuthoritySnapshot,
  storySourceSnapshotToTemplateInput,
  type StorySourceAuthoritySnapshot,
} from './storySourceAuthority';
import {
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
  assertOpenAIResponsesStructuredOutputSchemaCompatible,
  compatibilityAuthorityFromEvidence,
} from './openaiResponsesStructuredOutputSchemaCompatibility';

export const VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION =
  'visual-contract-authoring-request/v23' as const;
export const VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION =
  'visual-contract-authoring-receipt/v26' as const;
export const VISUAL_CONTRACT_AUTHORING_READINESS_VERSION =
  'visual-contract-authoring-readiness/v24' as const;
export const VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION =
  'visual-contract-candidate-artifact/v9' as const;
export const CANONICAL_IMPORT_PREFLIGHT_ATTESTATION_VERSION =
  'canonical-import-preflight-attestation/v1' as const;

function repairOutputDiagnosticCodeFor(
  error: TemplateRepairOutputInvalidError,
): AuthoringDiagnosticCode {
  switch (error.failureCode) {
    case 'json_invalid':
      return 'repair_output_json_invalid';
    case 'shape_invalid':
      return 'repair_output_shape_invalid';
    case 'target_identity_invalid':
      return 'repair_output_target_identity_invalid';
    case 'reference_authority_invalid':
      return 'repair_output_reference_authority_invalid';
    case 'non_target_drift':
      return 'repair_output_non_target_drift';
    case 'application_rejected':
      return 'repair_output_application_rejected';
  }
}
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION =
  'visual-contract-authoring-request/v3' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V4 =
  'visual-contract-authoring-request/v4' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V5 =
  'visual-contract-authoring-request/v5' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V6 =
  'visual-contract-authoring-request/v6' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V7 =
  'visual-contract-authoring-request/v7' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V8 =
  'visual-contract-authoring-request/v8' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V9 =
  'visual-contract-authoring-request/v9' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V10 =
  'visual-contract-authoring-request/v10' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V11 =
  'visual-contract-authoring-request/v11' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V12 =
  'visual-contract-authoring-request/v12' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V13 =
  'visual-contract-authoring-request/v13' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V14 =
  'visual-contract-authoring-request/v14' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V15 =
  'visual-contract-authoring-request/v15' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V16 =
  'visual-contract-authoring-request/v16' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V17 =
  'visual-contract-authoring-request/v17' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V18 =
  'visual-contract-authoring-request/v18' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V19 =
  'visual-contract-authoring-request/v19' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V20 =
  'visual-contract-authoring-request/v20' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V21 =
  'visual-contract-authoring-request/v21' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V22 =
  'visual-contract-authoring-request/v22' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION =
  'visual-contract-authoring-receipt/v4' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V3 =
  'visual-contract-authoring-receipt/v3' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V5 =
  'visual-contract-authoring-receipt/v5' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V6 =
  'visual-contract-authoring-receipt/v6' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V7 =
  'visual-contract-authoring-receipt/v7' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V8 =
  'visual-contract-authoring-receipt/v8' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V9 =
  'visual-contract-authoring-receipt/v9' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V10 =
  'visual-contract-authoring-receipt/v10' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V11 =
  'visual-contract-authoring-receipt/v11' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V12 =
  'visual-contract-authoring-receipt/v12' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V13 =
  'visual-contract-authoring-receipt/v13' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V14 =
  'visual-contract-authoring-receipt/v14' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V15 =
  'visual-contract-authoring-receipt/v15' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V16 =
  'visual-contract-authoring-receipt/v16' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V17 =
  'visual-contract-authoring-receipt/v17' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V18 =
  'visual-contract-authoring-receipt/v18' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V19 =
  'visual-contract-authoring-receipt/v19' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V20 =
  'visual-contract-authoring-receipt/v20' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V21 =
  'visual-contract-authoring-receipt/v21' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V22 =
  'visual-contract-authoring-receipt/v22' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V23 =
  'visual-contract-authoring-receipt/v23' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V24 =
  'visual-contract-authoring-receipt/v24' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V25 =
  'visual-contract-authoring-receipt/v25' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION =
  'visual-contract-authoring-readiness/v2' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V1 =
  'visual-contract-authoring-readiness/v1' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V3 =
  'visual-contract-authoring-readiness/v3' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V4 =
  'visual-contract-authoring-readiness/v4' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V5 =
  'visual-contract-authoring-readiness/v5' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V6 =
  'visual-contract-authoring-readiness/v6' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V7 =
  'visual-contract-authoring-readiness/v7' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V8 =
  'visual-contract-authoring-readiness/v8' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V9 =
  'visual-contract-authoring-readiness/v9' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V10 =
  'visual-contract-authoring-readiness/v10' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V11 =
  'visual-contract-authoring-readiness/v11' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V12 =
  'visual-contract-authoring-readiness/v12' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V13 =
  'visual-contract-authoring-readiness/v13' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V14 =
  'visual-contract-authoring-readiness/v14' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V15 =
  'visual-contract-authoring-readiness/v15' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V16 =
  'visual-contract-authoring-readiness/v16' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V17 =
  'visual-contract-authoring-readiness/v17' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V18 =
  'visual-contract-authoring-readiness/v18' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V19 =
  'visual-contract-authoring-readiness/v19' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V20 =
  'visual-contract-authoring-readiness/v20' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V21 =
  'visual-contract-authoring-readiness/v21' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V22 =
  'visual-contract-authoring-readiness/v22' as const;
export const LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V23 =
  'visual-contract-authoring-readiness/v23' as const;
export const LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION =
  'visual-contract-candidate-artifact/v2' as const;
export const LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V1 =
  'visual-contract-candidate-artifact/v1' as const;
export const LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V3 =
  'visual-contract-candidate-artifact/v3' as const;
export const LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V4 =
  'visual-contract-candidate-artifact/v4' as const;
export const LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V5 =
  'visual-contract-candidate-artifact/v5' as const;
export const LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V6 =
  'visual-contract-candidate-artifact/v6' as const;
export const LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V7 =
  'visual-contract-candidate-artifact/v7' as const;
export const LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V8 =
  'visual-contract-candidate-artifact/v8' as const;
export const OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION =
  'openai-responses-authoring-evidence/v5' as const;
export const LEGACY_OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION =
  'openai-responses-authoring-evidence/v2' as const;
export const LEGACY_OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION_V3 =
  'openai-responses-authoring-evidence/v3' as const;
export const LEGACY_OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION_V4 =
  'openai-responses-authoring-evidence/v4' as const;
export const ACTION_SEMANTIC_CATALOG_DIGEST =
  canonicalJsonDigest(ACTION_SEMANTIC_CATALOG);

export function openAIResponsesAuthoringEvidenceVersionStatus(
  version: unknown,
): 'current' | 'legacy_immutable' | 'unsupported' {
  if (version === OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION) {
    return 'current';
  }
  return version ===
      LEGACY_OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION ||
    version ===
      LEGACY_OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION_V3 ||
    version ===
      LEGACY_OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION_V4
    ? 'legacy_immutable'
    : 'unsupported';
}

const PROMPT_PROTOCOL_TOKEN_ALLOWANCE = 4_096;
const MAX_RECEIPT_ERRORS = 128;
const MAX_RECEIPT_ERROR_LENGTH = 2_000;

export interface VisualContractAuthoringRequest {
  version: typeof VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION;
  policyVersion:
    typeof VISUAL_CONTRACT_AUTHORING_POLICY_VERSION;
  mode: 'preflight' | 'live';
  requestId: string;
  requestedAt: string;
  sourceSnapshotDigest: string;
  provider: typeof VISUAL_CONTRACT_AUTHORING_PROVIDER;
  endpoint: typeof VISUAL_CONTRACT_AUTHORING_ENDPOINT;
  model: typeof VISUAL_CONTRACT_AUTHORING_MODEL;
  serviceTier:
    typeof VISUAL_CONTRACT_AUTHORING_SERVICE_TIER;
  reasoningEffort:
    typeof VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT;
  structuredOutput: {
    strict: true;
    schemaName: typeof TEMPLATE_DRAFT_SCHEMA_NAME;
    schemaVersion: typeof TEMPLATE_DRAFT_SCHEMA_VERSION;
    schemaDigest: string;
    compatibilityProfileVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION;
    compatibilityProfileDigest: string;
    compatibilityEvidenceVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION;
    compatibilityEvidenceDigest: string;
    compatibilityStatus: 'compatible';
    serializedSchemaDigest: string;
  };
  compactRepairStructuredOutput: {
    strict: true;
    schemaName: typeof SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME;
    schemaVersion: typeof SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_VERSION;
    schemaDigest: string;
    compatibilityProfileVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION;
    compatibilityProfileDigest: string;
    compatibilityEvidenceVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION;
    compatibilityEvidenceDigest: string;
    compatibilityStatus: 'compatible';
    serializedSchemaDigest: string;
  };
  pageContractRepairStructuredOutput: {
    strict: true;
    schemaName: typeof PAGE_CONTRACT_REPAIR_SCHEMA_NAME;
    schemaVersion: typeof PAGE_CONTRACT_REPAIR_SCHEMA_VERSION;
    schemaDigest: string;
    compatibilityProfileVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION;
    compatibilityProfileDigest: string;
    compatibilityEvidenceVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION;
    compatibilityEvidenceDigest: string;
    compatibilityStatus: 'compatible';
    serializedSchemaDigest: string;
  };
  pageSpatialReferenceRepairStructuredOutput: {
    strict: true;
    schemaName: typeof PAGE_SPATIAL_REFERENCE_REPAIR_SCHEMA_NAME;
    schemaVersion: typeof PAGE_SPATIAL_REFERENCE_REPAIR_SCHEMA_VERSION;
    schemaDigest: string;
    compatibilityProfileVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION;
    compatibilityProfileDigest: string;
    compatibilityEvidenceVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION;
    compatibilityEvidenceDigest: string;
    compatibilityStatus: 'compatible';
    serializedSchemaDigest: string;
  };
  structuralBundleRepairStructuredOutput: {
    strict: true;
    schemaName: typeof STRUCTURAL_BUNDLE_REPAIR_SCHEMA_NAME;
    schemaVersion: typeof STRUCTURAL_BUNDLE_REPAIR_SCHEMA_VERSION;
    schemaDigest: string;
    compatibilityProfileVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION;
    compatibilityProfileDigest: string;
    compatibilityEvidenceVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION;
    compatibilityEvidenceDigest: string;
    compatibilityStatus: 'compatible';
    serializedSchemaDigest: string;
  };
  bookSurfaceRepairStructuredOutput: {
    strict: true;
    schemaName: typeof BOOK_SURFACE_REPAIR_SCHEMA_NAME;
    schemaVersion: typeof BOOK_SURFACE_REPAIR_SCHEMA_VERSION;
    schemaDigest: string;
    compatibilityProfileVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION;
    compatibilityProfileDigest: string;
    compatibilityEvidenceVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION;
    compatibilityEvidenceDigest: string;
    compatibilityStatus: 'compatible';
    serializedSchemaDigest: string;
  };
  presentationRequirementRepairStructuredOutput: {
    strict: true;
    schemaName: typeof PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_NAME;
    schemaVersion: typeof PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_VERSION;
    schemaDigest: string;
    compatibilityProfileVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION;
    compatibilityProfileDigest: string;
    compatibilityEvidenceVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION;
    compatibilityEvidenceDigest: string;
    compatibilityStatus: 'compatible';
    serializedSchemaDigest: string;
  };
  stablePropScopeRepairStructuredOutput: {
    strict: true;
    schemaName: typeof STABLE_PROP_SCOPE_REPAIR_SCHEMA_NAME;
    schemaVersion: typeof STABLE_PROP_SCOPE_REPAIR_SCHEMA_VERSION;
    schemaDigest: string;
    compatibilityProfileVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION;
    compatibilityProfileDigest: string;
    compatibilityEvidenceVersion:
      typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION;
    compatibilityEvidenceDigest: string;
    compatibilityStatus: 'compatible';
    serializedSchemaDigest: string;
  };
  toolsDisabled:
    typeof VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED;
  noFallback: typeof VISUAL_CONTRACT_AUTHORING_NO_FALLBACK;
  transportRetries:
    typeof VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES;
  timeoutMs: number;
  tokenBudget: {
    maxInputTokens: number;
    promptAndSchemaTokenUpperBound: number;
    maxOutputTokens: number;
    outputIncludesReasoning: true;
  };
  callBudget: {
    maxCalls: number;
    maxRepairCount: number;
    standardMaxCalls: number;
    standardMaxRepairCount: number;
    terminalReferenceCleanup: {
      budgetClass: 'terminal_reference_cleanup';
      maxCalls: number;
      maxRepairCount: number;
      maxInputTokens: number;
      maxOutputTokens: number;
      eligiblePrecedingRepairModes:
        typeof VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_ELIGIBLE_PRECEDING_REPAIR_MODES;
      repairMode: 'page_spatial_reference_patch';
      residualFamily: 'draft_contract';
      residualCode: 'out_of_scope_reference';
    };
  };
  pricing: typeof VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS;
  pricingDigest: string;
  costBudget: {
    projectedMaxUsd: number;
    hardCeilingUsd: number;
  };
  promptDigests: {
    system: string;
    user: string;
  };
  promptAuthority: {
    initial: {
      systemPromptVersion: typeof TEMPLATE_PROMPT_VERSION;
      userPromptVersion: typeof TEMPLATE_USER_PROMPT_VERSION;
      systemPromptDigest: string;
      userPromptDigest: string;
    };
    repair: {
      systemPromptVersion: typeof REPAIR_PROMPT_VERSION;
      userPromptVersion: typeof REPAIR_USER_PROMPT_VERSION;
      systemPromptDigest: string;
    };
    sourceEvidenceIdRepair: {
      systemPromptVersion:
        typeof SOURCE_EVIDENCE_ID_REPAIR_PROMPT_VERSION;
      userPromptVersion:
        typeof SOURCE_EVIDENCE_ID_REPAIR_USER_PROMPT_VERSION;
      systemPromptDigest: string;
    };
    pageContractRepair: {
      systemPromptVersion:
        typeof PAGE_CONTRACT_REPAIR_PROMPT_VERSION;
      userPromptVersion:
        typeof PAGE_CONTRACT_REPAIR_USER_PROMPT_VERSION;
      systemPromptDigest: string;
    };
    pageSpatialReferenceRepair: {
      systemPromptVersion:
        typeof PAGE_SPATIAL_REFERENCE_REPAIR_PROMPT_VERSION;
      userPromptVersion:
        typeof PAGE_SPATIAL_REFERENCE_REPAIR_USER_PROMPT_VERSION;
      systemPromptDigest: string;
    };
    structuralBundleRepair: {
      systemPromptVersion:
        typeof STRUCTURAL_BUNDLE_REPAIR_PROMPT_VERSION;
      userPromptVersion:
        typeof STRUCTURAL_BUNDLE_REPAIR_USER_PROMPT_VERSION;
      systemPromptDigest: string;
    };
    bookSurfaceRepair: {
      systemPromptVersion:
        typeof BOOK_SURFACE_REPAIR_PROMPT_VERSION;
      userPromptVersion:
        typeof BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION;
      systemPromptDigest: string;
    };
    presentationRequirementRepair: {
      systemPromptVersion:
        typeof PRESENTATION_REQUIREMENT_REPAIR_PROMPT_VERSION;
      userPromptVersion:
        typeof PRESENTATION_REQUIREMENT_REPAIR_USER_PROMPT_VERSION;
      systemPromptDigest: string;
    };
    stablePropScopeRepair: {
      systemPromptVersion:
        typeof STABLE_PROP_SCOPE_REPAIR_PROMPT_VERSION;
      userPromptVersion:
        typeof STABLE_PROP_SCOPE_REPAIR_USER_PROMPT_VERSION;
      systemPromptDigest: string;
    };
  };
  actionSemanticAuthority: {
    catalogVersion: typeof ACTION_SEMANTIC_CATALOG_VERSION;
    catalogDigest: string;
    coverageVersion: typeof ACTION_SEMANTIC_COVERAGE_VERSION;
    sourceEvidenceCatalogVersion:
      typeof SOURCE_EVIDENCE_CATALOG_VERSION;
    sourceEvidenceCatalogDigest: string;
  };
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface VisualContractAuthoringUsage {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

export interface VisualContractAuthoringProviderResponse {
  output: string;
  receipt: {
    provider: string;
    model: string;
    responseId?: string;
    usage?: Record<string, unknown> | null;
    /**
     * Present only on the canonical D1A Responses adapter. Older injected test
     * adapters remain compatible, while this brand activates complete live
     * response-ID/completion/output evidence validation.
     */
    evidenceVersion?: string;
    completionStatus?: string;
    usageEvidenceComplete?: boolean;
    executionAttestation?: AuthoringExecutionAttestation;
  };
}

export interface VisualContractAuthoringProvider {
  call(args: {
    attempt: number;
    kind: 'initial' | 'repair';
    systemPrompt: string;
    userPrompt: string;
    options: ContractLlmCallOptions;
  }): Promise<VisualContractAuthoringProviderResponse>;
}

export interface VisualContractAuthoringAttemptReceipt {
  attempt: number;
  kind: 'initial' | 'repair';
  budgetClass: 'standard' | 'terminal_reference_cleanup';
  repairMode:
    | 'full_draft'
    | 'source_evidence_id_patch'
    | 'page_contract_patch'
    | 'page_spatial_reference_patch'
    | 'stable_prop_scope_patch'
    | 'presentation_requirement_patch'
    | 'structural_bundle_patch'
    | 'book_surface_patch'
    | null;
  providerReached: boolean;
  status:
    | 'response_received'
    | 'provider_failed'
    | 'policy_mismatch'
    | 'input_ceiling_exceeded'
    | 'spend_reservation_exceeded'
    | 'usage_invalid'
    | 'provider_evidence_invalid'
    | 'completion_status_invalid'
    | 'cost_ceiling_exceeded';
  provider: string;
  model: string;
  responseId: string | null;
  systemPromptDigest: string;
  userPromptDigest: string;
  responseDigest: string | null;
  usage: VisualContractAuthoringUsage | null;
  providerEvidenceVersion?: string;
  usageEvidenceKind:
    | 'canonical_provider_reported'
    | 'legacy_injected_compatibility'
    | null;
  completionStatus?: string;
  usageEvidenceComplete?: boolean;
  executionAttestation: AuthoringExecutionAttestation;
  reservedExposureBeforeCallUsd: number;
  nominalEstimatedCostUsd: number | null;
  conservativeAccountedCostUsd: number | null;
  validationDiagnostics: {
    count: number;
    codes: string[];
  };
  draftValidationDiagnostics: DraftValidationAttemptDiagnostics | null;
}

export type VisualContractDraftValidationStatus =
  | 'not_evaluated'
  | 'completed'
  | 'interrupted'
  | 'repair_exhausted';

export interface VisualContractDraftValidationEvidence {
  status: VisualContractDraftValidationStatus;
  attempts: Array<DraftValidationAttemptDiagnostics | null>;
}

export interface VisualContractAuthoringReceipt {
  version: typeof VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION;
  requestDigest: string;
  sourceSnapshotDigest: string;
  mode: 'preflight' | 'live';
  provider: string;
  endpoint: string;
  model: string;
  serviceTier: string;
  status: 'preflight_passed' | 'completed' | 'failed';
  callCount: number;
  repairCount: number;
  executionAttestation: AuthoringExecutionAttestation;
  pricing: typeof VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS;
  pricingDigest: string;
  projectedMaxCostUsd: number;
  nominalEstimatedCostUsd: number;
  conservativeAccountedCostUsd: number;
  aggregateUsage: VisualContractAuthoringUsage;
  attempts: VisualContractAuthoringAttemptReceipt[];
  draftValidationStatus: VisualContractDraftValidationStatus;
  candidateDigest: string | null;
  reconciliationDigest: null;
  actionSemanticCoverage: {
    version: typeof ACTION_SEMANTIC_COVERAGE_VERSION;
    catalogVersion: typeof ACTION_SEMANTIC_CATALOG_VERSION;
    catalogDigest: string;
    status:
      | 'not_evaluated'
      | 'complete_review_required'
      | 'capability_gap'
      | 'incomplete';
    recordCount: number;
    gapCount: number;
    coverageDigest: string | null;
    sourceEvidenceCatalogVersion:
      typeof SOURCE_EVIDENCE_CATALOG_VERSION;
    sourceEvidenceCatalogDigest: string;
  };
  failure: VisualContractAuthoringTerminalFailure | null;
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface VisualContractAuthoringRunResult {
  receipt: VisualContractAuthoringReceipt;
  compileResult: TemplateCompileResult | null;
  providerFailureEvidence: ProviderCallFailureEvidence | null;
}

export interface VisualContractAuthoringReadinessEvidence {
  version: typeof VISUAL_CONTRACT_AUTHORING_READINESS_VERSION;
  sourceSnapshotDigest: string;
  authoringRequestDigest: string;
  authoringReceiptDigest: string;
  canonicalImportPreflight: {
    status: 'passed' | 'failed' | 'not_attested' | 'unknown';
    attestationVersion: string | null;
    attestationDigest: string | null;
  };
  authoringOutcome: {
    status: VisualContractAuthoringReceipt['status'];
    failureCode:
      | NonNullable<VisualContractAuthoringReceipt['failure']>['code']
      | null;
    terminalClassification: VisualContractAuthoringReceipt['failure'];
  };
  executionAttestation: AuthoringExecutionAttestation;
  draftValidation: VisualContractDraftValidationEvidence;
  actionSemanticCoverage: VisualContractAuthoringReceipt['actionSemanticCoverage'];
  visualContractCandidate: {
    status: 'absent' | 'candidate';
    digest: string | null;
  };
  semanticReconciliation: {
    status: 'absent';
    digest: null;
  };
  humanSourceApproval: {
    status: 'absent';
    digest: null;
  };
  blueprintAuthoringReady: false;
  d1a1Authorized: false;
  blockers: string[];
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface VisualContractAuthoringArtifactWrite {
  path: string;
  digest: string;
  created: boolean;
}

export interface VisualContractCandidateArtifact {
  version: typeof VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION;
  sourceSnapshotDigest: string;
  authoringRequestDigest: string;
  authoringReceiptDigest: string;
  templateDigest: string;
  actionSemanticCatalogVersion:
    typeof ACTION_SEMANTIC_CATALOG_VERSION;
  actionSemanticCatalogDigest: string;
  actionSemanticCoverageVersion:
    typeof ACTION_SEMANTIC_COVERAGE_VERSION;
  actionSemanticCoverageDigest: string;
  sourceEvidenceCatalogVersion:
    typeof SOURCE_EVIDENCE_CATALOG_VERSION;
  sourceEvidenceCatalogDigest: string;
  template: BookVisualContractTemplate;
  /** Complete compiler-checked review evidence; never approval authority. */
  actionSemanticCoverage: ActionSemanticCoverageRecord[];
  status: 'candidate';
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface CanonicalImportPreflightAttestation {
  version: typeof CANONICAL_IMPORT_PREFLIGHT_ATTESTATION_VERSION;
  sourceSnapshotDigest: string;
  authoringRequestDigest: string;
  status: 'passed' | 'failed';
  issues: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export type VisualContractAuthoringArtifactKind =
  | 'request'
  | 'receipt'
  | 'readiness'
  | 'candidate';

export function visualContractAuthoringArtifactVersionStatus(
  kind: VisualContractAuthoringArtifactKind,
  version: unknown,
): 'current' | 'legacy_immutable' | 'unsupported' {
  const current = {
    request: VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION,
    receipt: VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION,
    readiness: VISUAL_CONTRACT_AUTHORING_READINESS_VERSION,
    candidate: VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION,
  } as const;
  if (version === current[kind]) return 'current';
  if (kind === 'request') {
    return version ===
        LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION ||
      version ===
        LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V4 ||
      version ===
        LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V5 ||
      version ===
        LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V6 ||
      version ===
        LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V7 ||
      version ===
        LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V8 ||
      version ===
        LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V9 ||
      version ===
        LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V10 ||
      version ===
        LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V11 ||
      version ===
        LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V12 ||
        version ===
        LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V13 ||
        version ===
        LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V14 ||
        version === LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V15 ||
        version === LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V16 ||
        version === LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V17 ||
        version === LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V18 ||
        version === LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V19 ||
        version === LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V20 ||
        version === LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V21 ||
        version === LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V22
      ? 'legacy_immutable'
      : 'unsupported';
  }
  const legacy = {
    receipt: [
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V3,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V5,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V6,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V7,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V8,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V9,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V10,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V11,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V12,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V13,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V14,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V15,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V16,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V17,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V18,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V19,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V20,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V21,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V22,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V23,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V24,
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V25,
    ],
    readiness: [
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V1,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V3,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V4,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V5,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V6,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V7,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V8,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V9,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V10,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V11,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V12,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V13,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V14,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V15,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V16,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V17,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V18,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V19,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V20,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V21,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V22,
      LEGACY_VISUAL_CONTRACT_AUTHORING_READINESS_VERSION_V23,
    ],
    candidate: [
      LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION,
      LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V1,
      LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V3,
      LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V4,
      LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V5,
      LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V6,
      LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V7,
      LEGACY_VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION_V8,
    ],
  } as const;
  return (legacy[kind] as readonly unknown[]).includes(version)
    ? 'legacy_immutable'
    : 'unsupported';
}

const DOES_NOT_AUTHORIZE = [
  'D1A1 live provider/model calls',
  'Story Source or Semantic Reconciliation approval',
  'Blueprint authoring or approval',
  'Board mint, import, or approval',
  'package assembly, publication, promotion, or activation',
  'render, product, visual, release, deployment, or launch acceptance',
] as const;

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function ceilUsd(value: number): number {
  return (
    Math.ceil((value - Number.EPSILON) * 1_000_000) /
    1_000_000
  );
}

function requestWithoutDigest(
  request: Omit<
    VisualContractAuthoringRequest,
    'digestAlgorithm' | 'digest'
  >,
): unknown {
  return request;
}

function receiptWithoutDigest(
  receipt: Omit<
    VisualContractAuthoringReceipt,
    'digestAlgorithm' | 'digest'
  >,
): unknown {
  return receipt;
}

function readinessWithoutDigest(
  evidence: Omit<
    VisualContractAuthoringReadinessEvidence,
    'digestAlgorithm' | 'digest'
  >,
): unknown {
  return evidence;
}

function promptInputs(snapshot: StorySourceAuthoritySnapshot): {
  systemPrompt: string;
  userPrompt: string;
  promptAndSchemaTokenUpperBound: number;
} {
  const input = storySourceSnapshotToTemplateInput(snapshot);
  const facts = extractDeterministicFacts(input);
  const systemPrompt = buildTemplateCompileSystemPrompt();
  const userPrompt = buildTemplateCompileUserPrompt(
    input,
    facts,
  );
  return {
    systemPrompt,
    userPrompt,
    // A UTF-8 byte count is a conservative token upper bound. The explicit
    // allowance covers Responses framing and schema protocol fields.
    promptAndSchemaTokenUpperBound: callInputTokenUpperBound(
      systemPrompt,
      userPrompt,
      TEMPLATE_DRAFT_JSON_SCHEMA,
    ),
  };
}

function callInputTokenUpperBound(
  systemPrompt: string,
  userPrompt: string,
  schema: Record<string, unknown>,
): number {
  return (
    Buffer.byteLength(
      [
        systemPrompt,
        userPrompt,
        JSON.stringify(schema),
      ].join('\n'),
      'utf8',
    ) + PROMPT_PROTOCOL_TOKEN_ALLOWANCE
  );
}

export function nominalAuthoringUsageCostUsd(
  usage: VisualContractAuthoringUsage,
): number {
  if (!usageIsInternallyConsistent(usage)) {
    throw new Error(
      'cannot calculate nominal authoring cost from invalid usage evidence',
    );
  }
  const prices = VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS;
  const uncached =
    usage.inputTokens -
    usage.cachedInputTokens -
    usage.cacheWriteInputTokens;
  return roundUsd(
    (uncached * prices.uncachedInputUsdPerUnit +
      usage.cachedInputTokens *
        prices.cachedInputUsdPerUnit +
      usage.cacheWriteInputTokens *
        prices.cacheWriteInputUsdPerUnit +
      usage.outputTokens * prices.outputUsdPerUnit) /
      prices.unitTokens,
  );
}

export function conservativeAuthoringCostUsd(args: {
  inputTokens: number;
  outputTokens: number;
}): number {
  const prices = VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS;
  return ceilUsd(
    ((args.inputTokens * prices.cacheWriteInputUsdPerUnit +
      args.outputTokens * prices.outputUsdPerUnit) /
      prices.unitTokens) *
      prices.regionalUpliftMultiplier,
  );
}

export function projectedMaximumAuthoringCostUsd(args: {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCalls: number;
}): number {
  return ceilUsd(
    conservativeAuthoringCostUsd({
      inputTokens: args.maxInputTokens,
      outputTokens: args.maxOutputTokens,
    }) * args.maxCalls,
  );
}

export function projectedMaximumAuthoringCostWithTerminalReferenceCleanupUsd(args: {
  standardMaxInputTokens: number;
  standardMaxOutputTokens: number;
  standardMaxCalls: number;
  cleanupMaxInputTokens: number;
  cleanupMaxOutputTokens: number;
  cleanupMaxCalls: number;
}): number {
  return ceilUsd(
    conservativeAuthoringCostUsd({
      inputTokens: args.standardMaxInputTokens,
      outputTokens: args.standardMaxOutputTokens,
    }) * args.standardMaxCalls +
      conservativeAuthoringCostUsd({
        inputTokens: args.cleanupMaxInputTokens,
        outputTokens: args.cleanupMaxOutputTokens,
      }) * args.cleanupMaxCalls,
  );
}

export function authoringSpendIsWithinCeiling(
  exposureUsd: number,
  hardCeilingUsd: number,
): boolean {
  return (
    Number.isFinite(exposureUsd) &&
    Number.isFinite(hardCeilingUsd) &&
    exposureUsd >= 0 &&
    hardCeilingUsd >= 0 &&
    exposureUsd <= hardCeilingUsd
  );
}

export function buildVisualContractAuthoringRequest(args: {
  snapshot: StorySourceAuthoritySnapshot;
  mode: 'preflight' | 'live';
  requestId: string;
  requestedAt: string;
}): VisualContractAuthoringRequest {
  assertValidStorySourceAuthoritySnapshot(args.snapshot);
  const prompts = promptInputs(args.snapshot);
  const maxOutputTokens = authoringMaxOutputTokens(
    args.snapshot.content.pages.length,
  );
  const schemaCompatibilityEvidence =
    assertOpenAIResponsesStructuredOutputSchemaCompatible(
      TEMPLATE_DRAFT_JSON_SCHEMA,
    );
  const compatibilityAuthority =
    compatibilityAuthorityFromEvidence(
      schemaCompatibilityEvidence,
    );
  const compactRepairCompatibilityEvidence =
    assertOpenAIResponsesStructuredOutputSchemaCompatible(
      SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
    );
  const compactRepairCompatibilityAuthority =
    compatibilityAuthorityFromEvidence(
      compactRepairCompatibilityEvidence,
    );
  const pageContractRepairCompatibilityEvidence =
    assertOpenAIResponsesStructuredOutputSchemaCompatible(
      PAGE_CONTRACT_REPAIR_JSON_SCHEMA,
    );
  const pageContractRepairCompatibilityAuthority =
    compatibilityAuthorityFromEvidence(
      pageContractRepairCompatibilityEvidence,
    );
  const pageSpatialReferenceRepairCompatibilityEvidence =
    assertOpenAIResponsesStructuredOutputSchemaCompatible(
      PAGE_SPATIAL_REFERENCE_REPAIR_JSON_SCHEMA,
    );
  const pageSpatialReferenceRepairCompatibilityAuthority =
    compatibilityAuthorityFromEvidence(
      pageSpatialReferenceRepairCompatibilityEvidence,
    );
  const structuralBundleRepairCompatibilityEvidence =
    assertOpenAIResponsesStructuredOutputSchemaCompatible(
      STRUCTURAL_BUNDLE_REPAIR_JSON_SCHEMA,
    );
  const structuralBundleRepairCompatibilityAuthority =
    compatibilityAuthorityFromEvidence(
      structuralBundleRepairCompatibilityEvidence,
    );
  const bookSurfaceRepairCompatibilityEvidence =
    assertOpenAIResponsesStructuredOutputSchemaCompatible(
      BOOK_SURFACE_REPAIR_JSON_SCHEMA,
    );
  const bookSurfaceRepairCompatibilityAuthority =
    compatibilityAuthorityFromEvidence(
      bookSurfaceRepairCompatibilityEvidence,
    );
  const presentationRequirementRepairCompatibilityEvidence =
    assertOpenAIResponsesStructuredOutputSchemaCompatible(
      PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA,
    );
  const presentationRequirementRepairCompatibilityAuthority =
    compatibilityAuthorityFromEvidence(
      presentationRequirementRepairCompatibilityEvidence,
    );
  const stablePropScopeRepairCompatibilityEvidence =
    assertOpenAIResponsesStructuredOutputSchemaCompatible(
      STABLE_PROP_SCOPE_REPAIR_JSON_SCHEMA,
    );
  const stablePropScopeRepairCompatibilityAuthority =
    compatibilityAuthorityFromEvidence(
      stablePropScopeRepairCompatibilityEvidence,
    );
  const withoutDigest = {
    version: VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION,
    policyVersion:
      VISUAL_CONTRACT_AUTHORING_POLICY_VERSION,
    mode: args.mode,
    requestId: args.requestId,
    requestedAt: args.requestedAt,
    sourceSnapshotDigest: args.snapshot.digest,
    provider: VISUAL_CONTRACT_AUTHORING_PROVIDER,
    endpoint: VISUAL_CONTRACT_AUTHORING_ENDPOINT,
    model: VISUAL_CONTRACT_AUTHORING_MODEL,
    serviceTier:
      VISUAL_CONTRACT_AUTHORING_SERVICE_TIER,
    reasoningEffort:
      VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT,
    structuredOutput: {
      strict: true as const,
      schemaName: TEMPLATE_DRAFT_SCHEMA_NAME,
      schemaVersion: TEMPLATE_DRAFT_SCHEMA_VERSION,
      schemaDigest: canonicalJsonDigest(
        TEMPLATE_DRAFT_JSON_SCHEMA,
      ),
      compatibilityProfileVersion:
        compatibilityAuthority.profileVersion,
      compatibilityProfileDigest:
        compatibilityAuthority.profileDigest,
      compatibilityEvidenceVersion:
        compatibilityAuthority.evidenceVersion,
      compatibilityEvidenceDigest:
        compatibilityAuthority.evidenceDigest,
      compatibilityStatus:
        compatibilityAuthority.status,
      serializedSchemaDigest:
        compatibilityAuthority.serializedSchemaDigest,
    },
    compactRepairStructuredOutput: {
      strict: true as const,
      schemaName: SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME,
      schemaVersion: SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_VERSION,
      schemaDigest: canonicalJsonDigest(
        SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
      ),
      compatibilityProfileVersion:
        compactRepairCompatibilityAuthority.profileVersion,
      compatibilityProfileDigest:
        compactRepairCompatibilityAuthority.profileDigest,
      compatibilityEvidenceVersion:
        compactRepairCompatibilityAuthority.evidenceVersion,
      compatibilityEvidenceDigest:
        compactRepairCompatibilityAuthority.evidenceDigest,
      compatibilityStatus:
        compactRepairCompatibilityAuthority.status,
      serializedSchemaDigest:
        compactRepairCompatibilityAuthority.serializedSchemaDigest,
    },
    pageContractRepairStructuredOutput: {
      strict: true as const,
      schemaName: PAGE_CONTRACT_REPAIR_SCHEMA_NAME,
      schemaVersion: PAGE_CONTRACT_REPAIR_SCHEMA_VERSION,
      schemaDigest: canonicalJsonDigest(
        PAGE_CONTRACT_REPAIR_JSON_SCHEMA,
      ),
      compatibilityProfileVersion:
        pageContractRepairCompatibilityAuthority.profileVersion,
      compatibilityProfileDigest:
        pageContractRepairCompatibilityAuthority.profileDigest,
      compatibilityEvidenceVersion:
        pageContractRepairCompatibilityAuthority.evidenceVersion,
      compatibilityEvidenceDigest:
        pageContractRepairCompatibilityAuthority.evidenceDigest,
      compatibilityStatus:
        pageContractRepairCompatibilityAuthority.status,
      serializedSchemaDigest:
        pageContractRepairCompatibilityAuthority.serializedSchemaDigest,
    },
    pageSpatialReferenceRepairStructuredOutput: {
      strict: true as const,
      schemaName: PAGE_SPATIAL_REFERENCE_REPAIR_SCHEMA_NAME,
      schemaVersion: PAGE_SPATIAL_REFERENCE_REPAIR_SCHEMA_VERSION,
      schemaDigest: canonicalJsonDigest(
        PAGE_SPATIAL_REFERENCE_REPAIR_JSON_SCHEMA,
      ),
      compatibilityProfileVersion:
        pageSpatialReferenceRepairCompatibilityAuthority.profileVersion,
      compatibilityProfileDigest:
        pageSpatialReferenceRepairCompatibilityAuthority.profileDigest,
      compatibilityEvidenceVersion:
        pageSpatialReferenceRepairCompatibilityAuthority.evidenceVersion,
      compatibilityEvidenceDigest:
        pageSpatialReferenceRepairCompatibilityAuthority.evidenceDigest,
      compatibilityStatus:
        pageSpatialReferenceRepairCompatibilityAuthority.status,
      serializedSchemaDigest:
        pageSpatialReferenceRepairCompatibilityAuthority.serializedSchemaDigest,
    },
    structuralBundleRepairStructuredOutput: {
      strict: true as const,
      schemaName: STRUCTURAL_BUNDLE_REPAIR_SCHEMA_NAME,
      schemaVersion: STRUCTURAL_BUNDLE_REPAIR_SCHEMA_VERSION,
      schemaDigest: canonicalJsonDigest(
        STRUCTURAL_BUNDLE_REPAIR_JSON_SCHEMA,
      ),
      compatibilityProfileVersion:
        structuralBundleRepairCompatibilityAuthority.profileVersion,
      compatibilityProfileDigest:
        structuralBundleRepairCompatibilityAuthority.profileDigest,
      compatibilityEvidenceVersion:
        structuralBundleRepairCompatibilityAuthority.evidenceVersion,
      compatibilityEvidenceDigest:
        structuralBundleRepairCompatibilityAuthority.evidenceDigest,
      compatibilityStatus:
        structuralBundleRepairCompatibilityAuthority.status,
      serializedSchemaDigest:
        structuralBundleRepairCompatibilityAuthority.serializedSchemaDigest,
    },
    bookSurfaceRepairStructuredOutput: {
      strict: true as const,
      schemaName: BOOK_SURFACE_REPAIR_SCHEMA_NAME,
      schemaVersion: BOOK_SURFACE_REPAIR_SCHEMA_VERSION,
      schemaDigest: canonicalJsonDigest(
        BOOK_SURFACE_REPAIR_JSON_SCHEMA,
      ),
      compatibilityProfileVersion:
        bookSurfaceRepairCompatibilityAuthority.profileVersion,
      compatibilityProfileDigest:
        bookSurfaceRepairCompatibilityAuthority.profileDigest,
      compatibilityEvidenceVersion:
        bookSurfaceRepairCompatibilityAuthority.evidenceVersion,
      compatibilityEvidenceDigest:
        bookSurfaceRepairCompatibilityAuthority.evidenceDigest,
      compatibilityStatus:
        bookSurfaceRepairCompatibilityAuthority.status,
      serializedSchemaDigest:
        bookSurfaceRepairCompatibilityAuthority.serializedSchemaDigest,
    },
    presentationRequirementRepairStructuredOutput: {
      strict: true as const,
      schemaName: PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_NAME,
      schemaVersion: PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_VERSION,
      schemaDigest: canonicalJsonDigest(
        PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA,
      ),
      compatibilityProfileVersion:
        presentationRequirementRepairCompatibilityAuthority.profileVersion,
      compatibilityProfileDigest:
        presentationRequirementRepairCompatibilityAuthority.profileDigest,
      compatibilityEvidenceVersion:
        presentationRequirementRepairCompatibilityAuthority.evidenceVersion,
      compatibilityEvidenceDigest:
        presentationRequirementRepairCompatibilityAuthority.evidenceDigest,
      compatibilityStatus:
        presentationRequirementRepairCompatibilityAuthority.status,
      serializedSchemaDigest:
        presentationRequirementRepairCompatibilityAuthority.serializedSchemaDigest,
    },
    stablePropScopeRepairStructuredOutput: {
      strict: true as const,
      schemaName: STABLE_PROP_SCOPE_REPAIR_SCHEMA_NAME,
      schemaVersion: STABLE_PROP_SCOPE_REPAIR_SCHEMA_VERSION,
      schemaDigest: canonicalJsonDigest(
        STABLE_PROP_SCOPE_REPAIR_JSON_SCHEMA,
      ),
      compatibilityProfileVersion:
        stablePropScopeRepairCompatibilityAuthority.profileVersion,
      compatibilityProfileDigest:
        stablePropScopeRepairCompatibilityAuthority.profileDigest,
      compatibilityEvidenceVersion:
        stablePropScopeRepairCompatibilityAuthority.evidenceVersion,
      compatibilityEvidenceDigest:
        stablePropScopeRepairCompatibilityAuthority.evidenceDigest,
      compatibilityStatus:
        stablePropScopeRepairCompatibilityAuthority.status,
      serializedSchemaDigest:
        stablePropScopeRepairCompatibilityAuthority.serializedSchemaDigest,
    },
    toolsDisabled:
      VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED,
    noFallback: VISUAL_CONTRACT_AUTHORING_NO_FALLBACK,
    transportRetries:
      VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES,
    timeoutMs: VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS,
    tokenBudget: {
      maxInputTokens:
        VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
      promptAndSchemaTokenUpperBound:
        prompts.promptAndSchemaTokenUpperBound,
      maxOutputTokens,
      outputIncludesReasoning: true as const,
    },
    callBudget: {
      maxCalls: VISUAL_CONTRACT_AUTHORING_MAX_CALLS,
      maxRepairCount:
        VISUAL_CONTRACT_AUTHORING_MAX_REPAIRS,
      standardMaxCalls:
        VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS,
      standardMaxRepairCount:
        VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_REPAIRS,
      terminalReferenceCleanup: {
        budgetClass: 'terminal_reference_cleanup' as const,
        maxCalls:
          VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_CALLS,
        maxRepairCount:
          VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_REPAIRS,
        maxInputTokens:
          VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_INPUT_TOKENS,
        maxOutputTokens:
          VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_OUTPUT_TOKENS,
        eligiblePrecedingRepairModes:
          VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_ELIGIBLE_PRECEDING_REPAIR_MODES,
        repairMode: 'page_spatial_reference_patch' as const,
        residualFamily: 'draft_contract' as const,
        residualCode: 'out_of_scope_reference' as const,
      },
    },
    pricing: VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS,
    pricingDigest: canonicalJsonDigest(
      VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS,
    ),
    costBudget: {
      projectedMaxUsd:
        projectedMaximumAuthoringCostWithTerminalReferenceCleanupUsd({
          standardMaxInputTokens:
            VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
          standardMaxOutputTokens: maxOutputTokens,
          standardMaxCalls:
            VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS,
          cleanupMaxInputTokens:
            VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_INPUT_TOKENS,
          cleanupMaxOutputTokens:
            VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_OUTPUT_TOKENS,
          cleanupMaxCalls:
            VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_CALLS,
        }),
      hardCeilingUsd:
        VISUAL_CONTRACT_AUTHORING_HARD_COST_CEILING_USD,
    },
    promptDigests: {
      system: canonicalJsonDigest(prompts.systemPrompt),
      user: canonicalJsonDigest(prompts.userPrompt),
    },
    promptAuthority: {
      initial: {
        systemPromptVersion: TEMPLATE_PROMPT_VERSION,
        userPromptVersion: TEMPLATE_USER_PROMPT_VERSION,
        systemPromptDigest:
          canonicalJsonDigest(prompts.systemPrompt),
        userPromptDigest:
          canonicalJsonDigest(prompts.userPrompt),
      },
      repair: {
        systemPromptVersion: REPAIR_PROMPT_VERSION,
        userPromptVersion: REPAIR_USER_PROMPT_VERSION,
        systemPromptDigest: canonicalJsonDigest(
          buildTemplateRepairSystemPrompt(),
        ),
      },
      sourceEvidenceIdRepair: {
        systemPromptVersion:
          SOURCE_EVIDENCE_ID_REPAIR_PROMPT_VERSION,
        userPromptVersion:
          SOURCE_EVIDENCE_ID_REPAIR_USER_PROMPT_VERSION,
        systemPromptDigest: canonicalJsonDigest(
          buildSourceEvidenceIdRepairSystemPrompt(),
        ),
      },
      pageContractRepair: {
        systemPromptVersion:
          PAGE_CONTRACT_REPAIR_PROMPT_VERSION,
        userPromptVersion:
          PAGE_CONTRACT_REPAIR_USER_PROMPT_VERSION,
        systemPromptDigest: canonicalJsonDigest(
          buildPageContractRepairSystemPrompt(),
        ),
      },
      pageSpatialReferenceRepair: {
        systemPromptVersion:
          PAGE_SPATIAL_REFERENCE_REPAIR_PROMPT_VERSION,
        userPromptVersion:
          PAGE_SPATIAL_REFERENCE_REPAIR_USER_PROMPT_VERSION,
        systemPromptDigest: canonicalJsonDigest(
          buildPageSpatialReferenceRepairSystemPrompt(),
        ),
      },
      structuralBundleRepair: {
        systemPromptVersion:
          STRUCTURAL_BUNDLE_REPAIR_PROMPT_VERSION,
        userPromptVersion:
          STRUCTURAL_BUNDLE_REPAIR_USER_PROMPT_VERSION,
        systemPromptDigest: canonicalJsonDigest(
          buildStructuralBundleRepairSystemPrompt(),
        ),
      },
      bookSurfaceRepair: {
        systemPromptVersion: BOOK_SURFACE_REPAIR_PROMPT_VERSION,
        userPromptVersion:
          BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION,
        systemPromptDigest: canonicalJsonDigest(
          buildBookSurfaceRepairSystemPrompt(),
        ),
      },
      presentationRequirementRepair: {
        systemPromptVersion:
          PRESENTATION_REQUIREMENT_REPAIR_PROMPT_VERSION,
        userPromptVersion:
          PRESENTATION_REQUIREMENT_REPAIR_USER_PROMPT_VERSION,
        systemPromptDigest: canonicalJsonDigest(
          buildPresentationRequirementRepairSystemPrompt(),
        ),
      },
      stablePropScopeRepair: {
        systemPromptVersion:
          STABLE_PROP_SCOPE_REPAIR_PROMPT_VERSION,
        userPromptVersion:
          STABLE_PROP_SCOPE_REPAIR_USER_PROMPT_VERSION,
        systemPromptDigest: canonicalJsonDigest(
          buildStablePropScopeRepairSystemPrompt(),
        ),
      },
    },
    actionSemanticAuthority: {
      catalogVersion: ACTION_SEMANTIC_CATALOG_VERSION,
      catalogDigest: ACTION_SEMANTIC_CATALOG_DIGEST,
      coverageVersion: ACTION_SEMANTIC_COVERAGE_VERSION,
      sourceEvidenceCatalogVersion:
        SOURCE_EVIDENCE_CATALOG_VERSION,
      sourceEvidenceCatalogDigest:
        args.snapshot.content.sourceEvidenceCatalog.digest,
    },
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(
      requestWithoutDigest(withoutDigest),
    ),
  };
}

function exactJson(left: unknown, right: unknown): boolean {
  try {
    return canonicalJsonDigest(left) === canonicalJsonDigest(right);
  } catch {
    return false;
  }
}

export function visualContractAuthoringRequestIssues(args: {
  request: VisualContractAuthoringRequest;
  snapshot: StorySourceAuthoritySnapshot;
}): string[] {
  const { request, snapshot } = args;
  const issues: string[] = [];
  let snapshotValid = true;
  try {
    assertValidStorySourceAuthoritySnapshot(snapshot);
  } catch {
    issues.push('source_snapshot_invalid');
    snapshotValid = false;
  }
  if (!snapshotValid) return issues;
  if (request.version !== VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION) {
    issues.push('request_version_mismatch');
  }
  if (
    request.policyVersion !==
    VISUAL_CONTRACT_AUTHORING_POLICY_VERSION
  ) {
    issues.push('authoring_policy_version_mismatch');
  }
  if (!['preflight', 'live'].includes(request.mode)) {
    issues.push('request_mode_invalid');
  }
  if (
    !nonEmpty(request.requestId) ||
    request.requestId.length > 160
  ) {
    issues.push('request_id_invalid');
  }
  if (!isoTimestampIsValid(request.requestedAt)) {
    issues.push('requested_at_invalid');
  }
  if (request.sourceSnapshotDigest !== snapshot.digest) {
    issues.push('source_snapshot_digest_mismatch');
  }
  const exact = buildVisualContractAuthoringRequest({
    snapshot,
    mode: request.mode,
    requestId: request.requestId,
    requestedAt: request.requestedAt,
  });
  const exactFields: Array<
    [string, unknown, unknown]
  > = [
    ['provider_mismatch', request.provider, exact.provider],
    ['endpoint_mismatch', request.endpoint, exact.endpoint],
    ['model_mismatch', request.model, exact.model],
    [
      'service_tier_mismatch',
      request.serviceTier,
      exact.serviceTier,
    ],
    [
      'reasoning_effort_mismatch',
      request.reasoningEffort,
      exact.reasoningEffort,
    ],
    [
      'structured_output_mismatch',
      request.structuredOutput,
      exact.structuredOutput,
    ],
    [
      'compact_repair_structured_output_mismatch',
      request.compactRepairStructuredOutput,
      exact.compactRepairStructuredOutput,
    ],
    [
      'page_contract_repair_structured_output_mismatch',
      request.pageContractRepairStructuredOutput,
      exact.pageContractRepairStructuredOutput,
    ],
    [
      'page_spatial_reference_repair_structured_output_mismatch',
      request.pageSpatialReferenceRepairStructuredOutput,
      exact.pageSpatialReferenceRepairStructuredOutput,
    ],
    [
      'structural_bundle_repair_structured_output_mismatch',
      request.structuralBundleRepairStructuredOutput,
      exact.structuralBundleRepairStructuredOutput,
    ],
    [
      'book_surface_repair_structured_output_mismatch',
      request.bookSurfaceRepairStructuredOutput,
      exact.bookSurfaceRepairStructuredOutput,
    ],
    [
      'presentation_requirement_repair_structured_output_mismatch',
      request.presentationRequirementRepairStructuredOutput,
      exact.presentationRequirementRepairStructuredOutput,
    ],
    [
      'stable_prop_scope_repair_structured_output_mismatch',
      request.stablePropScopeRepairStructuredOutput,
      exact.stablePropScopeRepairStructuredOutput,
    ],
    [
      'tools_policy_mismatch',
      request.toolsDisabled,
      exact.toolsDisabled,
    ],
    [
      'fallback_policy_mismatch',
      request.noFallback,
      exact.noFallback,
    ],
    [
      'transport_retries_mismatch',
      request.transportRetries,
      exact.transportRetries,
    ],
    [
      'timeout_mismatch',
      request.timeoutMs,
      exact.timeoutMs,
    ],
    [
      'token_budget_mismatch',
      request.tokenBudget,
      exact.tokenBudget,
    ],
    [
      'call_budget_mismatch',
      request.callBudget,
      exact.callBudget,
    ],
    [
      'price_assumptions_mismatch',
      request.pricing,
      exact.pricing,
    ],
    [
      'pricing_digest_mismatch',
      request.pricingDigest,
      exact.pricingDigest,
    ],
    [
      'cost_budget_mismatch',
      request.costBudget,
      exact.costBudget,
    ],
    [
      'prompt_digest_mismatch',
      request.promptDigests,
      exact.promptDigests,
    ],
    [
      'prompt_authority_mismatch',
      request.promptAuthority,
      exact.promptAuthority,
    ],
    [
      'action_semantic_authority_mismatch',
      request.actionSemanticAuthority,
      exact.actionSemanticAuthority,
    ],
  ];
  for (const [code, actual, expected] of exactFields) {
    if (!exactJson(actual, expected)) issues.push(code);
  }
  if (
    request.tokenBudget?.promptAndSchemaTokenUpperBound >
    request.tokenBudget?.maxInputTokens
  ) {
    issues.push('input_token_ceiling_exceeded');
  }
  if (
    snapshot.content.pages.length >
    VISUAL_CONTRACT_AUTHORING_MAX_PAGES_CURRENT_POLICY
  ) {
    issues.push(
      'page_budget_partition_decision_required',
    );
  }
  if (
    !authoringSpendIsWithinCeiling(
      request.costBudget.projectedMaxUsd,
      request.costBudget.hardCeilingUsd,
    )
  ) {
    issues.push('projected_cost_ceiling_exceeded');
  }
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = request;
  if (
    request.digestAlgorithm !== 'canonical-json-sha256' ||
    request.digest !== canonicalJsonDigest(payload)
  ) {
    issues.push('request_digest_stale');
  }
  return [...new Set(issues)];
}

function zeroUsage(): VisualContractAuthoringUsage {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  };
}

function finalizeReceipt(
  receipt: Omit<
    VisualContractAuthoringReceipt,
    'digestAlgorithm' | 'digest'
  >,
): VisualContractAuthoringReceipt {
  return {
    ...receipt,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(
      receiptWithoutDigest(receipt),
    ),
  };
}

function receiptActionSemanticCoverage(
  request: VisualContractAuthoringRequest,
  status: VisualContractAuthoringReceipt['actionSemanticCoverage']['status'],
  recordCount = 0,
  gapCount = 0,
  coverageDigest: string | null = null,
): VisualContractAuthoringReceipt['actionSemanticCoverage'] {
  return {
    version: ACTION_SEMANTIC_COVERAGE_VERSION,
    catalogVersion: ACTION_SEMANTIC_CATALOG_VERSION,
    catalogDigest: ACTION_SEMANTIC_CATALOG_DIGEST,
    status,
    recordCount,
    gapCount,
    coverageDigest,
    sourceEvidenceCatalogVersion:
      SOURCE_EVIDENCE_CATALOG_VERSION,
    sourceEvidenceCatalogDigest:
      request.actionSemanticAuthority.sourceEvidenceCatalogDigest,
  };
}

function failureReceipt(args: {
  request: VisualContractAuthoringRequest;
  attempts: VisualContractAuthoringAttemptReceipt[];
  code: AuthoringTerminalFailureCode;
  draftValidationStatus?: VisualContractDraftValidationStatus;
  diagnosticInputs?: readonly unknown[];
  diagnosticCountOverride?: number;
  diagnosticCodeOverride?: AuthoringDiagnosticCode;
  issueCodes?: readonly unknown[];
  authorityReferenceIssues?: readonly DraftAuthorityReferenceIssue[];
  actionSemanticCoverage?:
    VisualContractAuthoringReceipt['actionSemanticCoverage'];
}): VisualContractAuthoringReceipt {
  const usage = aggregateUsage(args.attempts);
  return finalizeReceipt({
    version: VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION,
    requestDigest: args.request.digest,
    sourceSnapshotDigest:
      args.request.sourceSnapshotDigest,
    mode: args.request.mode,
    provider: args.request.provider,
    endpoint: args.request.endpoint,
    model: args.request.model,
    serviceTier: args.request.serviceTier,
    status: 'failed',
    callCount: providerCallCount(args.attempts),
    repairCount: providerRepairCallCount(args.attempts),
    executionAttestation:
      aggregateAuthoringExecutionAttestations(
        args.attempts.map(
          (attempt) => attempt.executionAttestation,
        ),
      ),
    pricing: VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS,
    pricingDigest: canonicalJsonDigest(
      VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS,
    ),
    projectedMaxCostUsd:
      args.request.costBudget.projectedMaxUsd,
    nominalEstimatedCostUsd:
      aggregateNominalEstimatedCost(args.attempts),
    conservativeAccountedCostUsd:
      aggregateConservativeAccountedCost(args.attempts),
    aggregateUsage: usage,
    attempts: args.attempts,
    draftValidationStatus:
      args.draftValidationStatus ?? 'not_evaluated',
    candidateDigest: null,
    reconciliationDigest: null,
    actionSemanticCoverage:
      args.actionSemanticCoverage ??
      receiptActionSemanticCoverage(
        args.request,
        'not_evaluated',
      ),
    failure: buildVisualContractAuthoringTerminalFailure({
      code: args.code,
      diagnosticInputs: args.diagnosticInputs,
      diagnosticCountOverride:
        args.diagnosticCountOverride,
      diagnosticCodeOverride:
        args.diagnosticCodeOverride,
      issueCodes: args.issueCodes,
      authorityReferenceIssues:
        args.authorityReferenceIssues,
    }),
    doesNotAuthorize: [...DOES_NOT_AUTHORIZE],
  });
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : undefined;
}

function usageIsInternallyConsistent(
  usage: VisualContractAuthoringUsage,
): boolean {
  const values = Object.values(usage);
  if (values.some((value) => numeric(value) === undefined)) {
    return false;
  }
  if (
    usage.cachedInputTokens > usage.inputTokens ||
    usage.cacheWriteInputTokens >
      usage.inputTokens - usage.cachedInputTokens ||
    usage.reasoningTokens > usage.outputTokens
  ) {
    return false;
  }
  const expectedTotal =
    usage.inputTokens + usage.outputTokens;
  return (
    Number.isSafeInteger(expectedTotal) &&
    usage.totalTokens === expectedTotal
  );
}

function nestedRecord(
  value: unknown,
): Record<string, unknown> {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function ownValue(
  record: Record<string, unknown>,
  key: string,
): { present: boolean; value: unknown } {
  return {
    present: Object.prototype.hasOwnProperty.call(record, key),
    value: record[key],
  };
}

function preferredOptionalCount(args: {
  primary: { present: boolean; value: unknown };
  secondary: { present: boolean; value: unknown };
  defaultValue: number;
}): number | undefined {
  if (args.primary.present) {
    return numeric(args.primary.value);
  }
  if (args.secondary.present) {
    return numeric(args.secondary.value);
  }
  return args.defaultValue;
}

function safeCanonicalUsage(
  raw: Record<string, unknown> | null | undefined,
): VisualContractAuthoringUsage | null {
  if (!raw) return null;
  const usage = {
    inputTokens: numeric(raw.input_tokens),
    cachedInputTokens: numeric(raw.cached_input_tokens),
    cacheWriteInputTokens: numeric(
      raw.cache_write_input_tokens,
    ),
    outputTokens: numeric(raw.output_tokens),
    reasoningTokens: numeric(raw.reasoning_tokens),
    totalTokens: numeric(raw.total_tokens),
  };
  if (
    Object.values(usage).some(
      (value) => value === undefined,
    )
  ) {
    return null;
  }
  const complete =
    usage as VisualContractAuthoringUsage;
  return usageIsInternallyConsistent(complete)
    ? complete
    : null;
}

function safeLegacyInjectedUsage(
  raw: Record<string, unknown> | null | undefined,
): VisualContractAuthoringUsage | null {
  if (!raw) return null;
  const inputDetails = nestedRecord(
    raw.input_tokens_details,
  );
  const outputDetails = nestedRecord(
    raw.output_tokens_details,
  );
  const inputTokens =
    numeric(raw.input_tokens) ??
    numeric(raw.prompt_tokens);
  const outputTokens =
    numeric(raw.output_tokens) ??
    numeric(raw.completion_tokens);
  if (inputTokens === undefined || outputTokens === undefined) {
    return null;
  }
  const cachedInputTokens = preferredOptionalCount({
    primary: ownValue(raw, 'cached_input_tokens'),
    secondary: ownValue(inputDetails, 'cached_tokens'),
    defaultValue: 0,
  });
  const cacheWriteInputTokens = preferredOptionalCount({
    primary: ownValue(raw, 'cache_write_input_tokens'),
    secondary: ownValue(
      inputDetails,
      'cache_write_tokens',
    ),
    defaultValue: 0,
  });
  const reasoningTokens = preferredOptionalCount({
    primary: ownValue(raw, 'reasoning_tokens'),
    secondary: ownValue(
      outputDetails,
      'reasoning_tokens',
    ),
    defaultValue: 0,
  });
  const explicitTotal = ownValue(raw, 'total_tokens');
  const totalTokens = explicitTotal.present
    ? numeric(explicitTotal.value)
    : inputTokens + outputTokens;
  if (
    cachedInputTokens === undefined ||
    cacheWriteInputTokens === undefined ||
    reasoningTokens === undefined ||
    totalTokens === undefined ||
    !Number.isSafeInteger(totalTokens)
  ) {
    return null;
  }
  const usage = {
    inputTokens,
    cachedInputTokens,
    cacheWriteInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
  };
  return usageIsInternallyConsistent(usage)
    ? usage
    : null;
}

function aggregateUsage(
  attempts: VisualContractAuthoringAttemptReceipt[],
): VisualContractAuthoringUsage {
  return attempts.reduce(
    (total, attempt) => {
      const usage = attempt.usage;
      if (!usage) return total;
      return {
        inputTokens: total.inputTokens + usage.inputTokens,
        cachedInputTokens:
          total.cachedInputTokens + usage.cachedInputTokens,
        cacheWriteInputTokens:
          total.cacheWriteInputTokens +
          usage.cacheWriteInputTokens,
        outputTokens:
          total.outputTokens + usage.outputTokens,
        reasoningTokens:
          total.reasoningTokens + usage.reasoningTokens,
        totalTokens: total.totalTokens + usage.totalTokens,
      };
    },
    zeroUsage(),
  );
}

function aggregateNominalEstimatedCost(
  attempts: VisualContractAuthoringAttemptReceipt[],
): number {
  return roundUsd(
    attempts.reduce(
      (sum, attempt) =>
        sum + (attempt.nominalEstimatedCostUsd ?? 0),
      0,
    ),
  );
}

function aggregateConservativeAccountedCost(
  attempts: VisualContractAuthoringAttemptReceipt[],
): number {
  return ceilUsd(
    attempts.reduce(
      (sum, attempt) =>
        sum +
        (attempt.conservativeAccountedCostUsd ?? 0),
      0,
    ),
  );
}

export function authoringReservedExposureUsd(args: {
  request: VisualContractAuthoringRequest;
  conservativeAccountedCostUsd: number;
  providerCallsCompleted: number;
  terminalReferenceCleanupCallsCompleted?: number;
}): number {
  const inferredCleanupCallsCompleted = Math.max(
    0,
    args.providerCallsCompleted -
      args.request.callBudget.standardMaxCalls,
  );
  const cleanupCallsCompleted = Math.max(
    0,
    args.terminalReferenceCleanupCallsCompleted ??
      inferredCleanupCallsCompleted,
  );
  const standardCallsCompleted = Math.max(
    0,
    args.providerCallsCompleted - cleanupCallsCompleted,
  );
  const remainingStandardCalls = Math.max(
    0,
    args.request.callBudget.standardMaxCalls -
      standardCallsCompleted,
  );
  const remainingCleanupCalls = Math.max(
    0,
    args.request.callBudget.terminalReferenceCleanup.maxCalls -
      cleanupCallsCompleted,
  );
  const standardPerCallReserve = conservativeAuthoringCostUsd({
    inputTokens: args.request.tokenBudget.maxInputTokens,
    outputTokens: args.request.tokenBudget.maxOutputTokens,
  });
  const cleanupPerCallReserve = conservativeAuthoringCostUsd({
    inputTokens:
      args.request.callBudget.terminalReferenceCleanup
        .maxInputTokens,
    outputTokens:
      args.request.callBudget.terminalReferenceCleanup
        .maxOutputTokens,
  });
  return ceilUsd(
    args.conservativeAccountedCostUsd +
      remainingStandardCalls * standardPerCallReserve +
      remainingCleanupCalls * cleanupPerCallReserve,
  );
}

function reservedExposureBeforeNextCall(
  request: VisualContractAuthoringRequest,
  attempts: VisualContractAuthoringAttemptReceipt[],
): number {
  return authoringReservedExposureUsd({
    request,
    conservativeAccountedCostUsd:
      aggregateConservativeAccountedCost(attempts),
    providerCallsCompleted: providerCallCount(attempts),
    terminalReferenceCleanupCallsCompleted: attempts.filter(
      (attempt) =>
        attempt.providerReached &&
        attempt.budgetClass === 'terminal_reference_cleanup',
    ).length,
  });
}

function providerCallCount(
  attempts: readonly VisualContractAuthoringAttemptReceipt[],
): number {
  return attempts.filter((attempt) => attempt.providerReached)
    .length;
}

function providerRepairCallCount(
  attempts: readonly VisualContractAuthoringAttemptReceipt[],
): number {
  return attempts.filter(
    (attempt) =>
      attempt.providerReached && attempt.kind === 'repair',
  ).length;
}

function terminalReferenceCleanupResidualIsProven(
  attempt: VisualContractAuthoringAttemptReceipt | undefined,
): boolean {
  const diagnostics = attempt?.draftValidationDiagnostics;
  if (!diagnostics || diagnostics.currentUniqueCount < 1) {
    return false;
  }
  const currentItems = diagnostics.items.filter(
    (item) => item.state !== 'resolved',
  );
  return (
    currentItems.length === diagnostics.currentUniqueCount &&
    currentItems.every(
      ({ issue }) =>
        issue.family === 'draft_contract' &&
        issue.code === 'out_of_scope_reference' &&
        issue.locator.kind === 'page_item' &&
        issue.locator.collectionRole === 'page_actions' &&
        issue.locator.fieldRole === 'reference',
    )
  );
}

export function visualContractAuthoringAttemptBudgetSequenceIsValid(
  attempts: readonly VisualContractAuthoringAttemptReceipt[],
): boolean {
  if (
    attempts.length > VISUAL_CONTRACT_AUTHORING_MAX_CALLS ||
    attempts.some(
      (attempt, index) =>
        attempt.attempt !== index + 1 ||
        (index === 0
          ? attempt.kind !== 'initial' ||
            attempt.repairMode !== null ||
            attempt.budgetClass !== 'standard'
          : attempt.kind !== 'repair'),
    )
  ) {
    return false;
  }
  const standardAttempts = attempts.slice(
    0,
    VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS,
  );
  if (
    standardAttempts.some(
      (attempt) => attempt.budgetClass !== 'standard',
    )
  ) {
    return false;
  }
  const cleanupAttempts = attempts.slice(
    VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS,
  );
  if (cleanupAttempts.length === 0) return true;
  if (
    cleanupAttempts.length !==
      VISUAL_CONTRACT_AUTHORING_TERMINAL_REFERENCE_CLEANUP_MAX_CALLS ||
    attempts.length !== VISUAL_CONTRACT_AUTHORING_MAX_CALLS
  ) {
    return false;
  }
  const preceding =
    attempts[
      VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS - 1
    ];
  const cleanup = cleanupAttempts[0];
  return (
    terminalReferenceCleanupPredecessorIsEligible(
      preceding?.repairMode,
    ) &&
    terminalReferenceCleanupResidualIsProven(preceding) &&
    cleanup?.kind === 'repair' &&
    cleanup.budgetClass === 'terminal_reference_cleanup' &&
    cleanup.repairMode === 'page_spatial_reference_patch'
  );
}

function cloneDraftValidationAttemptDiagnostics(
  diagnostics: DraftValidationAttemptDiagnostics,
): DraftValidationAttemptDiagnostics {
  return {
    ...diagnostics,
    items: diagnostics.items.map((item) => ({
      state: item.state,
      issue: {
        family: item.issue.family,
        code: item.issue.code,
        locator: { ...item.issue.locator },
      } as DraftValidationIssue,
    })),
  };
}

function setAttemptValidationDiagnostics(
  attempt: VisualContractAuthoringAttemptReceipt,
  diagnostics: DraftValidationAttemptDiagnostics,
  issues: readonly DraftValidationIssue[],
): void {
  if (
    !draftValidationAttemptDiagnosticsIsValid(diagnostics) ||
    diagnostics.emittedCount !== issues.length
  ) {
    throw new Error(
      'compiler draft-validation diagnostics do not match typed emissions',
    );
  }
  attempt.validationDiagnostics = {
    count: Math.min(issues.length, MAX_RECEIPT_ERRORS),
    codes: draftValidationDiagnosticCodesForIssues(issues),
  };
  attempt.draftValidationDiagnostics =
    cloneDraftValidationAttemptDiagnostics(diagnostics);
}

function applyDraftValidationDiagnosticTrail(args: {
  attempts: VisualContractAuthoringAttemptReceipt[];
  trail: readonly DraftValidationAttemptDiagnostics[];
  emissionsByAttempt: readonly (readonly DraftValidationIssue[])[];
}): void {
  if (
    !draftValidationDiagnosticTrailIsValid(args.trail) ||
    args.trail.length !== args.emissionsByAttempt.length ||
    args.trail.length > args.attempts.length
  ) {
    throw new Error(
      'compiler draft-validation diagnostic trail is inconsistent',
    );
  }
  args.trail.forEach((diagnostics, index) => {
    const attempt = args.attempts[index];
    if (!attempt || attempt.status !== 'response_received') {
      throw new Error(
        'draft-validation diagnostics require a matching completed provider attempt',
      );
    }
    setAttemptValidationDiagnostics(
      attempt,
      diagnostics,
      args.emissionsByAttempt[index] ?? [],
    );
  });
}

const DRAFT_VALIDATION_EVIDENCE_KEYS = [
  'attempts',
  'status',
].sort();

export function visualContractDraftValidationEvidenceIsValid(
  value: unknown,
): value is VisualContractDraftValidationEvidence {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return false;
  }
  const evidence = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(evidence).sort()) !==
      JSON.stringify(DRAFT_VALIDATION_EVIDENCE_KEYS) ||
    ![
      'not_evaluated',
      'completed',
      'interrupted',
      'repair_exhausted',
    ].includes(evidence.status as string) ||
    !Array.isArray(evidence.attempts)
  ) {
    return false;
  }
  const attempts = evidence.attempts;
  if (
    attempts.some(
      (attempt) =>
        attempt !== null &&
        !draftValidationAttemptDiagnosticsIsValid(attempt),
    )
  ) {
    return false;
  }
  const firstNull = attempts.findIndex((attempt) => attempt === null);
  if (
    firstNull >= 0 &&
    attempts.slice(firstNull).some((attempt) => attempt !== null)
  ) {
    return false;
  }
  const trail = attempts.filter(
    (attempt): attempt is DraftValidationAttemptDiagnostics =>
      attempt !== null,
  );
  const status = evidence.status as VisualContractDraftValidationStatus;
  if (trail.length === 0) {
    return status === 'not_evaluated' || status === 'interrupted';
  }
  if (!draftValidationDiagnosticTrailIsValid(trail)) return false;
  if (status === 'not_evaluated') return false;
  if (status === 'completed') {
    return (
      attempts[attempts.length - 1] !== null &&
      trail[trail.length - 1]?.currentUniqueCount === 0
    );
  }
  if (status === 'repair_exhausted') {
    return (
      attempts.every((attempt) => attempt !== null) &&
      (trail[trail.length - 1]?.currentUniqueCount ?? 0) > 0
    );
  }
  return true;
}

function draftValidationEvidenceForReceipt(
  receipt: VisualContractAuthoringReceipt,
): VisualContractDraftValidationEvidence {
  return {
    status: receipt.draftValidationStatus,
    attempts: receipt.attempts.map(
      (attempt) => attempt.draftValidationDiagnostics,
    ),
  };
}

export function visualContractAuthoringReceiptDraftValidationIsValid(
  receipt: VisualContractAuthoringReceipt,
): boolean {
  const evidence = draftValidationEvidenceForReceipt(receipt);
  if (!visualContractDraftValidationEvidenceIsValid(evidence)) return false;
  for (const attempt of receipt.attempts) {
    const diagnostics = attempt.draftValidationDiagnostics;
    if (diagnostics === null) continue;
    if (
      attempt.validationDiagnostics.count !==
      Math.min(diagnostics.emittedCount, MAX_RECEIPT_ERRORS)
    ) {
      return false;
    }
    const currentPersistedIssues = diagnostics.items
      .filter((item) => item.state !== 'resolved')
      .map((item) => item.issue);
    const persistedCodes =
      draftValidationDiagnosticCodesForIssues(currentPersistedIssues);
    const allowedCodes = [
      'action_semantic_validation_failed',
      'draft_contract_validation_failed',
      'draft_schema_validation_failed',
      'source_evidence_validation_failed',
    ];
    const actualCodes = attempt.validationDiagnostics.codes;
    if (
      actualCodes.some((code) => !allowedCodes.includes(code)) ||
      !exactJson(actualCodes, [...new Set(actualCodes)].sort()) ||
      (diagnostics.currentUniqueCount === 0
        ? actualCodes.length !== 0
        : actualCodes.length === 0)
    ) {
      return false;
    }
    if (
      diagnostics.truncated
        ? persistedCodes.some((code) => !actualCodes.includes(code))
        : !exactJson(actualCodes, persistedCodes)
    ) {
      return false;
    }
  }
  if (receipt.draftValidationStatus === 'completed') {
    return (
      receipt.status === 'completed' ||
      (receipt.status === 'failed' &&
        receipt.failure?.code ===
          'post_compile_authority_incomplete')
    );
  }
  if (receipt.draftValidationStatus === 'repair_exhausted') {
    return (
      receipt.status === 'failed' &&
      receipt.failure?.code === 'draft_validation_repair_exhausted'
    );
  }
  if (receipt.draftValidationStatus === 'not_evaluated') {
    return receipt.status !== 'completed' && receipt.attempts.length === 0;
  }
  return receipt.status === 'failed';
}

function templateRepairExhaustionIsProven(args: {
  error: TemplateRepairExhaustedError;
  request: VisualContractAuthoringRequest;
  attempts: readonly VisualContractAuthoringAttemptReceipt[];
}): boolean {
  const terminalCleanupWasUsed = args.attempts.some(
    (attempt) =>
      attempt.budgetClass === 'terminal_reference_cleanup',
  );
  const expectedCalls = terminalCleanupWasUsed
    ? args.request.callBudget.maxCalls
    : args.request.callBudget.standardMaxCalls;
  const expectedRepairs = terminalCleanupWasUsed
    ? args.request.callBudget.maxRepairCount
    : args.request.callBudget.standardMaxRepairCount;
  return (
    expectedCalls === expectedRepairs + 1 &&
    visualContractAuthoringAttemptBudgetSequenceIsValid(
      args.attempts,
    ) &&
    args.error.attempts.length === expectedCalls &&
    args.attempts.length === expectedCalls &&
    providerCallCount(args.attempts) === expectedCalls &&
    providerRepairCallCount(args.attempts) === expectedRepairs &&
    args.attempts.every(
      (attempt, index) =>
        attempt.attempt === index + 1 &&
        attempt.status === 'response_received',
    ) &&
    args.error.attempts.every(
      (attempt, index) =>
        attempt.attempt === index + 1 &&
        attempt.diagnosticIssues.length > 0,
    )
  );
}

function safeLabel(value: unknown, fallback: string): string {
  return nonEmpty(value)
    ? value
        .slice(0, 160)
        .replace(/[\r\n\t\u0000-\u001F\u007F]/g, ' ')
    : fallback;
}

function boundedErrors(errors: readonly unknown[]): string[] {
  return errors
    .filter(
      (candidate): candidate is string =>
        typeof candidate === 'string',
    )
    .slice(0, MAX_RECEIPT_ERRORS)
    .map((candidate) =>
      candidate
        .slice(0, MAX_RECEIPT_ERROR_LENGTH)
        .replace(
          /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
          '',
        ),
    );
}

function expectedCallOptions(
  request: VisualContractAuthoringRequest,
  promptAuthority: ContractLlmPromptAuthority | undefined,
): ContractLlmCallOptions {
  const terminalReferenceCleanup =
    promptAuthority?.kind === 'repair' &&
    promptAuthority.budgetClass ===
      'terminal_reference_cleanup';
  const compactRepair =
    promptAuthority?.kind === 'repair' &&
    promptAuthority.repairMode ===
      'source_evidence_id_patch';
  const pageContractRepair =
    promptAuthority?.kind === 'repair' &&
    promptAuthority.repairMode === 'page_contract_patch';
  const pageSpatialReferenceRepair =
    promptAuthority?.kind === 'repair' &&
    promptAuthority.repairMode ===
      'page_spatial_reference_patch';
  const structuralBundleRepair =
    promptAuthority?.kind === 'repair' &&
    promptAuthority.repairMode ===
      'structural_bundle_patch';
  const bookSurfaceRepair =
    promptAuthority?.kind === 'repair' &&
    promptAuthority.repairMode === 'book_surface_patch';
  const presentationRequirementRepair =
    promptAuthority?.kind === 'repair' &&
    promptAuthority.repairMode ===
      'presentation_requirement_patch';
  const stablePropScopeRepair =
    promptAuthority?.kind === 'repair' &&
    promptAuthority.repairMode ===
      'stable_prop_scope_patch';
  return {
    maxOutputTokens: terminalReferenceCleanup
      ? request.callBudget.terminalReferenceCleanup
          .maxOutputTokens
      : request.tokenBudget.maxOutputTokens,
    model: request.model,
    reasoningEffort: request.reasoningEffort,
    jsonSchema: {
      name: compactRepair
        ? request.compactRepairStructuredOutput.schemaName
        : pageContractRepair
          ? request.pageContractRepairStructuredOutput.schemaName
          : pageSpatialReferenceRepair
            ? request.pageSpatialReferenceRepairStructuredOutput
                .schemaName
            : structuralBundleRepair
              ? request.structuralBundleRepairStructuredOutput
                  .schemaName
              : bookSurfaceRepair
                ? request.bookSurfaceRepairStructuredOutput
                    .schemaName
              : presentationRequirementRepair
                ? request.presentationRequirementRepairStructuredOutput
                    .schemaName
                : stablePropScopeRepair
                  ? request.stablePropScopeRepairStructuredOutput
                      .schemaName
                  : request.structuredOutput.schemaName,
      schema: compactRepair
        ? SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA
        : pageContractRepair
          ? PAGE_CONTRACT_REPAIR_JSON_SCHEMA
          : pageSpatialReferenceRepair
            ? PAGE_SPATIAL_REFERENCE_REPAIR_JSON_SCHEMA
            : structuralBundleRepair
              ? STRUCTURAL_BUNDLE_REPAIR_JSON_SCHEMA
              : bookSurfaceRepair
                ? BOOK_SURFACE_REPAIR_JSON_SCHEMA
              : presentationRequirementRepair
                ? PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA
                : stablePropScopeRepair
                  ? STABLE_PROP_SCOPE_REPAIR_JSON_SCHEMA
                  : TEMPLATE_DRAFT_JSON_SCHEMA,
    },
    noFallback: true,
    provider: 'openai',
    endpoint: 'responses',
    serviceTier: 'default',
    toolsDisabled: true,
    transportRetries: 0,
    timeoutMs: request.timeoutMs,
    maxInputTokens: terminalReferenceCleanup
      ? request.callBudget.terminalReferenceCleanup
          .maxInputTokens
      : request.tokenBudget.maxInputTokens,
  };
}

function actionAuthorityIssues(
  template: BookVisualContractTemplate,
  coverage: readonly ActionSemanticCoverageRecord[],
): string[] {
  return actionSemanticCoverageIssues({
    template,
    coverage,
  });
}

export function visualContractAuthoringCallPromptAuthorityIssues(
  args: {
    request: VisualContractAuthoringRequest;
    kind: 'initial' | 'repair';
    systemPrompt: string;
    userPrompt: string;
    promptAuthority:
      | ContractLlmPromptAuthority
      | undefined;
  },
): string[] {
  const issues: string[] = [];
  const actualSystemDigest = canonicalJsonDigest(
    args.systemPrompt,
  );
  const actualUserDigest = canonicalJsonDigest(
    args.userPrompt,
  );
  if (args.promptAuthority?.kind !== args.kind) {
    issues.push('prompt_kind_mismatch');
  }
  if (args.kind === 'initial') {
    const expected = args.request.promptAuthority?.initial;
    if (
      args.promptAuthority?.budgetClass !== 'standard' ||
      args.promptAuthority?.systemPromptVersion !==
        expected?.systemPromptVersion ||
      args.promptAuthority?.userPromptVersion !==
        expected?.userPromptVersion ||
      actualSystemDigest !== expected?.systemPromptDigest ||
      actualUserDigest !== expected?.userPromptDigest ||
      actualSystemDigest !== args.request.promptDigests?.system ||
      actualUserDigest !== args.request.promptDigests?.user
    ) {
      issues.push('initial_prompt_authority_mismatch');
    }
  } else {
    const repairPromptAuthority =
      args.promptAuthority?.kind === 'repair'
        ? args.promptAuthority
        : undefined;
    const expected =
      repairPromptAuthority?.repairMode ===
      'source_evidence_id_patch'
        ? args.request.promptAuthority?.sourceEvidenceIdRepair
        : repairPromptAuthority?.repairMode ===
            'page_contract_patch'
          ? args.request.promptAuthority?.pageContractRepair
          : repairPromptAuthority?.repairMode ===
              'page_spatial_reference_patch'
            ? args.request.promptAuthority
                ?.pageSpatialReferenceRepair
            : repairPromptAuthority?.repairMode ===
                'structural_bundle_patch'
              ? args.request.promptAuthority
                  ?.structuralBundleRepair
              : repairPromptAuthority?.repairMode ===
                  'book_surface_patch'
                ? args.request.promptAuthority
                    ?.bookSurfaceRepair
              : repairPromptAuthority?.repairMode ===
                  'presentation_requirement_patch'
                ? args.request.promptAuthority
                    ?.presentationRequirementRepair
                : repairPromptAuthority?.repairMode ===
                    'stable_prop_scope_patch'
                  ? args.request.promptAuthority
                      ?.stablePropScopeRepair
                  : args.request.promptAuthority?.repair;
    const budgetClassValid =
      repairPromptAuthority?.budgetClass === 'standard' ||
      (repairPromptAuthority?.budgetClass ===
        'terminal_reference_cleanup' &&
        repairPromptAuthority.repairMode ===
          args.request.callBudget.terminalReferenceCleanup.repairMode);
    if (
      !repairPromptAuthority?.repairMode ||
      !budgetClassValid ||
      args.promptAuthority?.systemPromptVersion !==
        expected?.systemPromptVersion ||
      args.promptAuthority?.userPromptVersion !==
        expected?.userPromptVersion ||
      actualSystemDigest !== expected?.systemPromptDigest
    ) {
      issues.push('repair_prompt_authority_mismatch');
    }
  }
  return [...new Set(issues)];
}

function authoringBudgetClassSequenceIssues(args: {
  attempts: readonly VisualContractAuthoringAttemptReceipt[];
  promptAuthority: ContractLlmPromptAuthority | undefined;
}): string[] {
  if (args.promptAuthority?.kind === 'initial') {
    return args.attempts.length === 0 &&
      args.promptAuthority.budgetClass === 'standard'
      ? []
      : ['initial_budget_class_sequence_invalid'];
  }
  if (args.promptAuthority?.kind !== 'repair') {
    return ['repair_budget_class_missing'];
  }
  if (args.promptAuthority.budgetClass === 'standard') {
    return args.attempts.length <
        VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS &&
      args.attempts.every(
        (attempt) => attempt.budgetClass === 'standard',
      )
      ? []
      : ['standard_budget_class_sequence_invalid'];
  }
  const lastStandardAttempt =
    args.attempts[
      VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS - 1
    ];
  return args.attempts.length ===
      VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS &&
    args.attempts.every(
      (attempt) =>
        attempt.budgetClass === 'standard' &&
        attempt.status === 'response_received' &&
        attempt.providerReached,
    ) &&
    terminalReferenceCleanupPredecessorIsEligible(
      lastStandardAttempt?.repairMode,
    ) &&
    args.promptAuthority.repairMode ===
      'page_spatial_reference_patch'
    ? []
    : ['terminal_reference_cleanup_sequence_invalid'];
}

export async function runVisualContractAuthoring(args: {
  request: VisualContractAuthoringRequest;
  snapshot: StorySourceAuthoritySnapshot;
  provider?: VisualContractAuthoringProvider;
  /** Additive executable-boundary issues checked before provider reachability. */
  additionalRequestIssues?: readonly string[];
  /** Used by the canonical live command so a preflight request cannot be promoted in place. */
  requiredMode?: 'preflight' | 'live';
  /**
   * Optional at the injected-provider seam for D1A0 compatibility. The
   * canonical live executable always requires the exact Responses brand.
   */
  requiredProviderEvidenceVersion?:
    typeof OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION;
}): Promise<VisualContractAuthoringRunResult> {
  let requestIssues: string[];
  try {
    requestIssues = [
      ...new Set([
        ...visualContractAuthoringRequestIssues({
          request: args.request,
          snapshot: args.snapshot,
        }),
        ...(args.requiredMode &&
        args.request.mode !== args.requiredMode
          ? [`request_mode_must_be_${args.requiredMode}`]
          : []),
        ...(args.additionalRequestIssues ?? []),
      ]),
    ];
  } catch {
    return {
      receipt: failureReceipt({
        request: args.request,
        attempts: [],
        code: 'local_processing_failed',
        diagnosticCountOverride: 1,
        issueCodes: ['local_processing_failed'],
      }),
      compileResult: null,
      providerFailureEvidence: null,
    };
  }
  if (requestIssues.length > 0) {
    return {
      receipt: failureReceipt({
        request: args.request,
        attempts: [],
        code: 'request_invalid',
        diagnosticInputs: requestIssues,
        issueCodes: requestIssues,
      }),
      compileResult: null,
      providerFailureEvidence: null,
    };
  }
  if (args.request.mode === 'preflight') {
    return {
      receipt: finalizeReceipt({
        version:
          VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION,
        requestDigest: args.request.digest,
        sourceSnapshotDigest: args.snapshot.digest,
        mode: 'preflight',
        provider: args.request.provider,
        endpoint: args.request.endpoint,
        model: args.request.model,
        serviceTier: args.request.serviceTier,
        status: 'preflight_passed',
        callCount: 0,
        repairCount: 0,
        executionAttestation:
          notRunAuthoringExecutionAttestation(),
        pricing: VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS,
        pricingDigest: canonicalJsonDigest(
          VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS,
        ),
        projectedMaxCostUsd:
          args.request.costBudget.projectedMaxUsd,
        nominalEstimatedCostUsd: 0,
        conservativeAccountedCostUsd: 0,
        aggregateUsage: zeroUsage(),
        attempts: [],
        draftValidationStatus: 'not_evaluated',
        candidateDigest: null,
        reconciliationDigest: null,
        actionSemanticCoverage:
          receiptActionSemanticCoverage(
            args.request,
            'not_evaluated',
          ),
        failure: null,
        doesNotAuthorize: [...DOES_NOT_AUTHORIZE],
      }),
      compileResult: null,
      providerFailureEvidence: null,
    };
  }
  if (!args.provider) {
    return {
      receipt: failureReceipt({
        request: args.request,
        attempts: [],
        code: 'provider_required',
      }),
      compileResult: null,
      providerFailureEvidence: null,
    };
  }

  const attempts: VisualContractAuthoringAttemptReceipt[] =
    [];
  let completedUnrecordedProviderAttempt:
    | Omit<VisualContractAuthoringAttemptReceipt, 'status'>
    | null = null;
  let providerFailureDiagnostic:
    | SanitizedProviderFailureDiagnostic
    | null = null;
  const terminal: {
    code:
      | NonNullable<
          VisualContractAuthoringReceipt['failure']
        >['code']
      | null;
    diagnosticCodeOverride?: AuthoringDiagnosticCode;
  } = { code: null };
  try {
    const compileResult =
      await compileBookVisualContractTemplate(
        storySourceSnapshotToTemplateInput(args.snapshot),
        {
          callLLM: async (
            systemPrompt,
            userPrompt,
            options,
            promptAuthority,
          ) => {
            const attempt = attempts.length + 1;
            const kind =
              attempt === 1 ? 'initial' : 'repair';
            const repairMode =
              promptAuthority?.kind === 'repair'
                ? promptAuthority.repairMode
                : null;
            const budgetClass =
              promptAuthority?.budgetClass ?? 'standard';
            const reservedExposureBeforeCallUsd =
              reservedExposureBeforeNextCall(
                args.request,
                attempts,
              );
            const base = {
              attempt,
              kind,
              budgetClass,
              repairMode,
              providerReached: false,
              provider: args.request.provider,
              model: args.request.model,
              responseId: null,
              systemPromptDigest:
                canonicalJsonDigest(systemPrompt),
              userPromptDigest:
                canonicalJsonDigest(userPrompt),
              responseDigest: null,
              usage: null,
              usageEvidenceKind: null,
              executionAttestation:
                notRunAuthoringExecutionAttestation(),
              reservedExposureBeforeCallUsd,
              nominalEstimatedCostUsd: null,
              conservativeAccountedCostUsd: null,
              validationDiagnostics: {
                count: 0,
                codes: [],
              },
              draftValidationDiagnostics: null,
            } satisfies Omit<
              VisualContractAuthoringAttemptReceipt,
              'status'
            >;
            if (
              attempt >
              args.request.callBudget.maxCalls
            ) {
              terminal.code = 'local_processing_failed';
              terminal.diagnosticCodeOverride =
                'call_budget_invariant_failed';
              throw new Error(
                'application call budget exhausted',
              );
            }
            const promptAuthorityIssues = [
              ...authoringBudgetClassSequenceIssues({
                attempts,
                promptAuthority,
              }),
              ...visualContractAuthoringCallPromptAuthorityIssues({
                request: args.request,
                kind,
                systemPrompt,
                userPrompt,
                promptAuthority,
              }),
            ];
            if (promptAuthorityIssues.length > 0) {
              terminal.code = 'provider_policy_mismatch';
              attempts.push({
                ...base,
                status: 'policy_mismatch',
                validationDiagnostics:
                  sanitizedAuthoringDiagnostics({
                    inputs: promptAuthorityIssues,
                    fallbackCode:
                      'provider_policy_mismatch',
                  }),
              });
              throw new Error(
                'compiler prompts differ from approved request authority',
              );
            }
            if (
              !authoringSpendIsWithinCeiling(
                reservedExposureBeforeCallUsd,
                args.request.costBudget.hardCeilingUsd,
              )
            ) {
              terminal.code = 'cost_ceiling_exceeded';
              attempts.push({
                ...base,
                status: 'spend_reservation_exceeded',
              });
              throw new Error(
                'maximum reserved authoring exposure exceeds the approved hard cost ceiling',
              );
            }
            const expected = expectedCallOptions(
              args.request,
              promptAuthority,
            );
            if (
              callInputTokenUpperBound(
                systemPrompt,
                userPrompt,
                options?.jsonSchema?.schema ??
                  TEMPLATE_DRAFT_JSON_SCHEMA,
              ) >
              expected.maxInputTokens!
            ) {
              terminal.code =
                'input_token_ceiling_exceeded';
              attempts.push({
                ...base,
                status: 'input_ceiling_exceeded',
              });
              throw new Error(
                'application input token ceiling exceeded',
              );
            }
            if (!exactJson(options, expected)) {
              terminal.code = 'provider_policy_mismatch';
              attempts.push({
                ...base,
                status: 'policy_mismatch',
              });
              throw new Error(
                'compiler call options differ from approved request',
              );
            }
            let response: VisualContractAuthoringProviderResponse;
            try {
              response = await args.provider!.call({
                attempt,
                kind,
                systemPrompt,
                userPrompt,
                options: expected,
              });
              completedUnrecordedProviderAttempt = {
                ...base,
                providerReached: true,
                executionAttestation:
                  injectedAuthoringExecutionAttestation(1),
              };
            } catch (error) {
              terminal.code = 'provider_call_failed';
              providerFailureDiagnostic =
                error instanceof
                ProviderCallFailureDiagnosticError
                  ? error.diagnostic
                  : unclassifiedAdapterFailureDiagnostic({
                      requestOptionsDigest:
                        canonicalJsonDigest(expected),
                    });
              attempts.push({
                ...base,
                providerReached: true,
                executionAttestation:
                  providerFailureDiagnostic
                    .executionAttestation,
                status: 'provider_failed',
              });
              throw new Error(
                'injected provider adapter failed',
              );
            }
            const provider = safeLabel(
              response.receipt.provider,
              'unknown-provider',
            );
            const model = safeLabel(
              response.receipt.model,
              'unknown-model',
            );
            const responseId = nonEmpty(
              response.receipt.responseId,
            )
              ? safeLabel(
                  response.receipt.responseId,
                  'unknown-response-id',
                )
              : null;
            const observedProviderEvidenceVersion = nonEmpty(
              response.receipt.evidenceVersion,
            )
              ? safeLabel(
                  response.receipt.evidenceVersion,
                  'unknown-provider-evidence',
                )
              : undefined;
            const canonicalProviderEvidence =
              observedProviderEvidenceVersion ===
              OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION;
            const canonicalExecutionEvidence =
              canonicalProviderEvidence &&
              canonicalCompletedExecutionAttestationIsValid(
                response.receipt.executionAttestation,
              );
            const completionStatus =
              canonicalProviderEvidence
                ? safeLabel(
                    response.receipt.completionStatus,
                    'unknown-status',
                  )
                : undefined;
            const responseOutput =
              typeof response.output === 'string'
                ? response.output
                : '';
            const usage = canonicalProviderEvidence
              ? safeCanonicalUsage(response.receipt.usage)
              : observedProviderEvidenceVersion === undefined
                ? safeLegacyInjectedUsage(
                    response.receipt.usage,
                  )
                : null;
            const usageEvidenceKind = canonicalProviderEvidence
              ? ('canonical_provider_reported' as const)
              : observedProviderEvidenceVersion === undefined
                ? ('legacy_injected_compatibility' as const)
                : null;
            const nominalEstimatedCostUsd = usage
              ? nominalAuthoringUsageCostUsd(usage)
              : null;
            const conservativeAccountedCostUsd = usage
              ? conservativeAuthoringCostUsd({
                  inputTokens: usage.inputTokens,
                  outputTokens: usage.outputTokens,
                })
              : null;
            const receivedBase = {
              ...base,
              providerReached: true,
              provider,
              model,
              responseId,
              responseDigest:
                canonicalJsonDigest(responseOutput),
              usage,
              usageEvidenceKind,
              executionAttestation:
                canonicalExecutionEvidence
                  ? response.receipt.executionAttestation!
                  : injectedAuthoringExecutionAttestation(),
              nominalEstimatedCostUsd,
              conservativeAccountedCostUsd,
              ...(observedProviderEvidenceVersion
                ? {
                    providerEvidenceVersion:
                      observedProviderEvidenceVersion,
                  }
                : {}),
              ...(canonicalProviderEvidence
                ? {
                    completionStatus,
                    usageEvidenceComplete:
                      response.receipt
                        .usageEvidenceComplete === true,
                  }
                : {}),
            } satisfies Omit<
              VisualContractAuthoringAttemptReceipt,
              'status'
            >;
            // Preserve the D1A0 redaction behavior for older injected
            // adapters on provider-mismatch failure paths. Only the branded
            // canonical Responses adapter gains complete evidence capture.
            const providerMismatchEvidenceBase =
              canonicalProviderEvidence
                ? receivedBase
                : {
                    ...base,
                    providerReached: true,
                    provider,
                    model,
                    responseId,
                    responseDigest:
                      canonicalJsonDigest(responseOutput),
                  };
            const usageFailureEvidenceBase =
              canonicalProviderEvidence
                ? receivedBase
                : {
                    ...providerMismatchEvidenceBase,
                    usage,
                  };
            if (
              (observedProviderEvidenceVersion !== undefined &&
                !canonicalProviderEvidence) ||
              (args.requiredProviderEvidenceVersion &&
                (!canonicalProviderEvidence ||
                  !canonicalExecutionEvidence))
            ) {
              terminal.code = 'provider_evidence_invalid';
              attempts.push({
                ...receivedBase,
                status: 'provider_evidence_invalid',
                validationDiagnostics: {
                  count: 1,
                  codes: [
                    'provider_execution_evidence_invalid',
                  ],
                },
              });
              throw new Error(
                'provider response did not supply the required evidence contract',
              );
            }
            if (
              provider !== args.request.provider ||
              model !== args.request.model
            ) {
              terminal.code = 'provider_policy_mismatch';
              attempts.push({
                ...providerMismatchEvidenceBase,
                status: 'policy_mismatch',
              });
              throw new Error(
                'provider response labels differ from approved request',
              );
            }
            if (
              canonicalProviderEvidence &&
              (!responseId || !responseOutput.trim())
            ) {
              terminal.code = 'provider_evidence_invalid';
              attempts.push({
                ...receivedBase,
                status: 'provider_evidence_invalid',
              });
              throw new Error(
                'canonical provider response identity or output evidence is incomplete',
              );
            }
            if (
              canonicalProviderEvidence &&
              completionStatus !== 'completed'
            ) {
              terminal.code = 'completion_status_invalid';
              attempts.push({
                ...receivedBase,
                status: 'completion_status_invalid',
              });
              throw new Error(
                'canonical provider response did not complete',
              );
            }
            if (
              canonicalProviderEvidence &&
              response.receipt.usageEvidenceComplete !==
                true
            ) {
              terminal.code = 'usage_invalid';
              attempts.push({
                ...usageFailureEvidenceBase,
                status: 'usage_invalid',
              });
              throw new Error(
                'canonical provider usage evidence is incomplete',
              );
            }
            if (
              !usage ||
              usage.inputTokens > expected.maxInputTokens! ||
              usage.outputTokens > expected.maxOutputTokens!
            ) {
              terminal.code = 'usage_invalid';
              attempts.push({
                ...receivedBase,
                status: 'usage_invalid',
              });
              throw new Error(
                'provider usage is missing or outside approved token bounds',
              );
            }
            const receipt: VisualContractAuthoringAttemptReceipt =
              {
                ...receivedBase,
                status: 'response_received',
              };
            attempts.push(receipt);
            if (
              !authoringSpendIsWithinCeiling(
                aggregateConservativeAccountedCost(attempts),
                args.request.costBudget.hardCeilingUsd,
              )
            ) {
              receipt.status = 'cost_ceiling_exceeded';
              terminal.code = 'cost_ceiling_exceeded';
              throw new Error(
                'conservative accounted authoring cost exceeded approved ceiling',
              );
            }
            return responseOutput;
          },
        },
      );
    applyDraftValidationDiagnosticTrail({
      attempts,
      trail: compileResult.draftValidationDiagnostics,
      emissionsByAttempt: [
        ...compileResult.repairAttempts.map(
          (repair) => repair.diagnosticIssues,
        ),
        [],
      ],
    });
    const actionIssues = actionAuthorityIssues(
      compileResult.template,
      compileResult.actionSemanticCoverage,
    );
    if (actionIssues.length > 0) {
      return {
        receipt: failureReceipt({
          request: args.request,
          attempts,
          code: 'post_compile_authority_incomplete',
          draftValidationStatus: 'completed',
          diagnosticInputs: actionIssues,
          diagnosticCountOverride: actionIssues.length,
          issueCodes: [
            'post_compile_authority_incomplete',
          ],
          actionSemanticCoverage:
            receiptActionSemanticCoverage(
              args.request,
              'incomplete',
              compileResult.actionSemanticCoverage.length,
              0,
              canonicalJsonDigest(
                compileResult.actionSemanticCoverage,
              ),
            ),
        }),
        compileResult: null,
        providerFailureEvidence: null,
      };
    }
    const candidateDigest = canonicalJsonDigest(
      compileResult.template,
    );
    return {
      receipt: finalizeReceipt({
        version:
          VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION,
        requestDigest: args.request.digest,
        sourceSnapshotDigest: args.snapshot.digest,
        mode: 'live',
        provider: args.request.provider,
        endpoint: args.request.endpoint,
        model: args.request.model,
        serviceTier: args.request.serviceTier,
        status: 'completed',
        callCount: providerCallCount(attempts),
        repairCount: providerRepairCallCount(attempts),
        executionAttestation:
          aggregateAuthoringExecutionAttestations(
            attempts.map(
              (attempt) => attempt.executionAttestation,
            ),
          ),
        pricing: VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS,
        pricingDigest: canonicalJsonDigest(
          VISUAL_CONTRACT_AUTHORING_PRICE_ASSUMPTIONS,
        ),
        projectedMaxCostUsd:
          args.request.costBudget.projectedMaxUsd,
        nominalEstimatedCostUsd:
          aggregateNominalEstimatedCost(attempts),
        conservativeAccountedCostUsd:
          aggregateConservativeAccountedCost(attempts),
        aggregateUsage: aggregateUsage(attempts),
        attempts,
        draftValidationStatus: 'completed',
        candidateDigest,
        reconciliationDigest: null,
        actionSemanticCoverage:
          receiptActionSemanticCoverage(
            args.request,
            'complete_review_required',
            compileResult.actionSemanticCoverage.length,
            0,
            canonicalJsonDigest(
              compileResult.actionSemanticCoverage,
            ),
          ),
        failure: null,
        doesNotAuthorize: [...DOES_NOT_AUTHORIZE],
      }),
      compileResult,
      providerFailureEvidence: null,
    };
  } catch (error) {
    const unrecordedProviderAttempt =
      completedUnrecordedProviderAttempt as
        | Omit<VisualContractAuthoringAttemptReceipt, 'status'>
        | null;
    if (
      unrecordedProviderAttempt !== null &&
      !attempts.some(
        (attempt) =>
          attempt.attempt ===
          unrecordedProviderAttempt.attempt,
      )
    ) {
      const localFailure = buildAuthoringTerminalFailure({
        code: 'local_processing_failed',
        diagnosticInputs: [
          'unexpected_local_processing_failure',
        ],
      });
      attempts.push({
        ...unrecordedProviderAttempt,
        status: 'provider_evidence_invalid',
        validationDiagnostics: {
          count: localFailure.diagnosticCount,
          codes: localFailure.diagnosticCodes,
        },
      });
    }

    if (
      error instanceof TemplateRepairExhaustedError ||
      error instanceof TemplateRepairOutputInvalidError
    ) {
      applyDraftValidationDiagnosticTrail({
        attempts,
        trail: error.draftValidationDiagnostics,
        emissionsByAttempt: error.attempts.map(
          (repair) => repair.diagnosticIssues,
        ),
      });
    }
    if (
      error instanceof ActionSemanticCapabilityGapError &&
      attempts.length > 0
    ) {
      applyDraftValidationDiagnosticTrail({
        attempts,
        trail: error.draftValidationDiagnostics,
        emissionsByAttempt:
          error.diagnosticIssuesByAttempt,
      });
    }
    const capabilityGapCount =
      error instanceof ActionSemanticCapabilityGapError
        ? error.gaps.length
        : 0;
    let code: AuthoringTerminalFailureCode;
    let diagnosticInputs: readonly unknown[] = [];
    let diagnosticCountOverride: number | undefined;
    let diagnosticCodeOverride:
      | AuthoringDiagnosticCode
      | undefined;
    let authorityReferenceIssues:
      | readonly DraftAuthorityReferenceIssue[]
      | undefined;
    if (terminal.code) {
      code = terminal.code;
      diagnosticCodeOverride =
        terminal.diagnosticCodeOverride;
    } else if (error instanceof InvalidVisualContractError) {
      code = 'provider_output_decode_failed';
      diagnosticCountOverride = 1;
    } else if (
      error instanceof TemplateRepairExhaustedError &&
      templateRepairExhaustionIsProven({
        error,
        request: args.request,
        attempts,
      })
    ) {
      code = 'draft_validation_repair_exhausted';
      diagnosticCountOverride = error.attempts.reduce(
        (count, attempt) =>
          count + attempt.diagnosticIssues.length,
        0,
      );
    } else if (
      error instanceof TemplateRepairOutputInvalidError
    ) {
      code = 'repair_output_invalid';
      diagnosticCodeOverride =
        repairOutputDiagnosticCodeFor(error);
      diagnosticCountOverride =
        error.attempts.reduce(
          (count, attempt) =>
            count + attempt.diagnosticIssues.length,
          0,
        ) + 1;
    } else if (
      error instanceof DraftAuthorityReferenceDomainError
    ) {
      code = 'draft_authority_reference_domain_invalid';
      diagnosticCountOverride = error.issues.length;
      authorityReferenceIssues = error.issues;
    } else if (
      error instanceof ActionSemanticCapabilityGapError
    ) {
      code = 'action_semantic_capability_gap';
      diagnosticCountOverride = capabilityGapCount;
    } else {
      code = 'local_processing_failed';
      diagnosticCountOverride = 1;
    }
    const lastAttempt = attempts[attempts.length - 1];
    if (
      lastAttempt &&
      lastAttempt.validationDiagnostics.count === 0 &&
      [
        'provider_output_decode_failed',
        'repair_output_invalid',
        'draft_authority_reference_domain_invalid',
        'action_semantic_capability_gap',
        'local_processing_failed',
      ].includes(code)
    ) {
      const projected = buildVisualContractAuthoringTerminalFailure({
        code,
        diagnosticInputs,
        diagnosticCountOverride,
        diagnosticCodeOverride,
        issueCodes: [code],
        authorityReferenceIssues,
      });
      lastAttempt.validationDiagnostics = {
        count: projected.diagnosticCount,
        codes: projected.diagnosticCodes,
      };
    }
    const receipt = failureReceipt({
      request: args.request,
      attempts,
      code,
      draftValidationStatus:
        code === 'draft_validation_repair_exhausted'
          ? 'repair_exhausted'
          : 'interrupted',
      diagnosticInputs,
      diagnosticCountOverride,
      diagnosticCodeOverride,
      issueCodes: [code],
      authorityReferenceIssues,
      ...(code === 'action_semantic_capability_gap'
        ? {
            actionSemanticCoverage:
              receiptActionSemanticCoverage(
                args.request,
                'capability_gap',
                0,
                capabilityGapCount,
              ),
          }
        : {}),
    });
    const failedAttempt =
      attempts.length > 0
        ? attempts[attempts.length - 1]
        : undefined;
    const providerFailureEvidence =
      code === 'provider_call_failed' &&
      providerFailureDiagnostic &&
      failedAttempt
        ? buildProviderCallFailureEvidence({
            authoringRequestDigest: args.request.digest,
            sourceSnapshotDigest: args.snapshot.digest,
            authoringReceiptDigest: receipt.digest,
            attemptIndex: failedAttempt.attempt,
            attemptKind: failedAttempt.kind,
            provider: args.request.provider,
            endpoint: args.request.endpoint,
            model: args.request.model,
            diagnostic: providerFailureDiagnostic,
          })
        : null;
    return {
      receipt,
      compileResult: null,
      providerFailureEvidence,
    };
  }
}

export function buildCanonicalImportPreflightAttestation(args: {
  snapshot: StorySourceAuthoritySnapshot;
  request: VisualContractAuthoringRequest;
  issues?: readonly string[];
}): CanonicalImportPreflightAttestation {
  const withoutDigest = {
    version: CANONICAL_IMPORT_PREFLIGHT_ATTESTATION_VERSION,
    sourceSnapshotDigest: args.snapshot.digest,
    authoringRequestDigest: args.request.digest,
    status:
      (args.issues?.length ?? 0) === 0
        ? ('passed' as const)
        : ('failed' as const),
    issues: boundedErrors(args.issues ?? []),
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(withoutDigest),
  };
}

function canonicalImportPreflightState(args: {
  snapshot: StorySourceAuthoritySnapshot;
  request: VisualContractAuthoringRequest;
  attestation?: CanonicalImportPreflightAttestation;
}): VisualContractAuthoringReadinessEvidence['canonicalImportPreflight'] {
  if (!args.attestation) {
    return {
      status: 'not_attested',
      attestationVersion: null,
      attestationDigest: null,
    };
  }
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = args.attestation;
  const valid =
    args.attestation.version ===
      CANONICAL_IMPORT_PREFLIGHT_ATTESTATION_VERSION &&
    args.attestation.sourceSnapshotDigest ===
      args.snapshot.digest &&
    args.attestation.authoringRequestDigest ===
      args.request.digest &&
    args.attestation.digestAlgorithm ===
      'canonical-json-sha256' &&
    args.attestation.digest === canonicalJsonDigest(payload);
  return {
    status: valid ? args.attestation.status : 'unknown',
    attestationVersion: args.attestation.version,
    attestationDigest: args.attestation.digest,
  };
}

function visualContractAuthoringReceiptExhaustionBindingIsValid(
  receipt: VisualContractAuthoringReceipt,
): boolean {
  const terminalCleanupWasUsed = receipt.attempts.some(
    (attempt) =>
      attempt.budgetClass === 'terminal_reference_cleanup',
  );
  return authoringBudgetExhaustionBindingIsValid({
    failure: receipt.failure,
    logicalProviderCalls:
      receipt.executionAttestation.logicalProviderCalls,
    repairCount: receipt.repairCount,
    expectedLogicalProviderCalls:
      terminalCleanupWasUsed
        ? VISUAL_CONTRACT_AUTHORING_MAX_CALLS
        : VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_CALLS,
    expectedRepairCount:
      terminalCleanupWasUsed
        ? VISUAL_CONTRACT_AUTHORING_MAX_REPAIRS
        : VISUAL_CONTRACT_AUTHORING_STANDARD_MAX_REPAIRS,
  });
}

export function buildVisualContractAuthoringReadinessEvidence(args: {
  snapshot: StorySourceAuthoritySnapshot;
  request: VisualContractAuthoringRequest;
  receipt: VisualContractAuthoringReceipt;
  canonicalImportPreflightAttestation?:
    CanonicalImportPreflightAttestation;
}): VisualContractAuthoringReadinessEvidence {
  const {
    digestAlgorithm: _receiptDigestAlgorithm,
    digest: _receiptDigest,
    ...receiptPayload
  } = args.receipt;
  const receiptFailureIsValid =
    args.receipt.status === 'failed'
      ? visualContractAuthoringTerminalFailureIsValid(
          args.receipt.failure,
        )
      : args.receipt.failure === null;
  const attemptsHaveValidExecution =
    args.receipt.attempts.every((attempt) =>
      authoringExecutionAttestationIsValid(
        attempt.executionAttestation,
      ),
    );
  const aggregateExecution =
    attemptsHaveValidExecution
      ? aggregateAuthoringExecutionAttestations(
          args.receipt.attempts.map(
            (attempt) => attempt.executionAttestation,
          ),
        )
      : null;
  const receiptDraftValidationIsValid =
    visualContractAuthoringReceiptDraftValidationIsValid(
      args.receipt,
    );
  if (
    args.request.version !==
      VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION ||
    args.receipt.version !==
      VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION ||
    (args.receipt.status !== 'failed' &&
      args.receipt.sourceSnapshotDigest !==
        args.snapshot.digest) ||
    args.receipt.requestDigest !== args.request.digest ||
    !receiptFailureIsValid ||
    !authoringExecutionAttestationIsValid(
      args.receipt.executionAttestation,
    ) ||
    !attemptsHaveValidExecution ||
    aggregateExecution === null ||
    !exactJson(
      args.receipt.executionAttestation,
      aggregateExecution,
    ) ||
    args.receipt.callCount !==
      providerCallCount(args.receipt.attempts) ||
    args.receipt.repairCount !==
      providerRepairCallCount(args.receipt.attempts) ||
    args.receipt.executionAttestation.logicalProviderCalls !==
      args.receipt.callCount ||
    !visualContractAuthoringAttemptBudgetSequenceIsValid(
      args.receipt.attempts,
    ) ||
    !visualContractAuthoringReceiptExhaustionBindingIsValid(
      args.receipt,
    ) ||
    !receiptDraftValidationIsValid ||
    args.receipt.digestAlgorithm !==
      'canonical-json-sha256' ||
    args.receipt.digest !==
      canonicalJsonDigest(receiptPayload)
  ) {
    throw new Error(
      'readiness v24 requires current, digest-bound request and receipt evidence; legacy artifacts remain immutable',
    );
  }
  const canonicalImportPreflight =
    canonicalImportPreflightState({
      snapshot: args.snapshot,
      request: args.request,
      attestation:
        args.canonicalImportPreflightAttestation,
    });
  const candidate =
    args.receipt.status === 'completed' &&
    args.receipt.candidateDigest &&
    args.receipt.actionSemanticCoverage.status ===
      'complete_review_required'
      ? {
          status: 'candidate' as const,
          digest: args.receipt.candidateDigest,
        }
      : { status: 'absent' as const, digest: null };
  const blockers = [
    ...(canonicalImportPreflight.status === 'passed'
      ? []
      : [
          `canonical_import_preflight_${canonicalImportPreflight.status}`,
        ]),
    ...(args.receipt.status === 'failed'
      ? ['authoring_outcome_failed']
      : []),
    ...(args.receipt.actionSemanticCoverage.status ===
    'complete_review_required'
      ? []
      : [
          `action_semantic_coverage_${args.receipt.actionSemanticCoverage.status}`,
        ]),
    ...(candidate.status === 'absent'
      ? ['visual_contract_candidate_absent']
      : []),
    'semantic_reconciliation_absent',
    'human_source_approval_absent',
  ];
  const receiptDraftValidation =
    draftValidationEvidenceForReceipt(args.receipt);
  const draftValidation: VisualContractDraftValidationEvidence = {
    status: receiptDraftValidation.status,
    attempts: receiptDraftValidation.attempts.map((attempt) =>
      attempt === null
        ? null
        : cloneDraftValidationAttemptDiagnostics(attempt),
    ),
  };
  const withoutDigest = {
    version: VISUAL_CONTRACT_AUTHORING_READINESS_VERSION,
    sourceSnapshotDigest: args.snapshot.digest,
    authoringRequestDigest: args.request.digest,
    authoringReceiptDigest: args.receipt.digest,
    canonicalImportPreflight,
    authoringOutcome: {
      status: args.receipt.status,
      failureCode: args.receipt.failure?.code ?? null,
      terminalClassification: args.receipt.failure,
    },
    executionAttestation:
      args.receipt.executionAttestation,
    draftValidation,
    actionSemanticCoverage:
      args.receipt.actionSemanticCoverage,
    visualContractCandidate: candidate,
    semanticReconciliation: {
      status: 'absent' as const,
      digest: null,
    },
    humanSourceApproval: {
      status: 'absent' as const,
      digest: null,
    },
    blueprintAuthoringReady: false as const,
    d1a1Authorized: false as const,
    blockers,
    doesNotAuthorize: [...DOES_NOT_AUTHORIZE],
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(
      readinessWithoutDigest(withoutDigest),
    ),
  };
}

function persistJsonArtifact(args: {
  repoRoot: string;
  outputDir: string;
  category: string;
  digest: string;
  value: unknown;
  write?: boolean;
}): VisualContractAuthoringArtifactWrite {
  const root = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, root);
  const destinationPath = path.join(
    root,
    args.category,
    `${args.digest}.json`,
  );
  const result =
    args.write === true
      ? writeCanonicalContentAddressedJsonArtifact({
          destinationPath,
          value: args.value,
        })
      : { created: false };
  return {
    path: repoRelativePath(args.repoRoot, destinationPath),
    digest: args.digest,
    created: result.created,
  };
}

export function persistVisualContractAuthoringRequest(args: {
  repoRoot: string;
  outputDir: string;
  request: VisualContractAuthoringRequest;
  write?: boolean;
}): VisualContractAuthoringArtifactWrite {
  return persistJsonArtifact({
    ...args,
    category: 'authoring-requests',
    digest: args.request.digest,
    value: args.request,
  });
}

export function persistVisualContractAuthoringReceipt(args: {
  repoRoot: string;
  outputDir: string;
  receipt: VisualContractAuthoringReceipt;
  write?: boolean;
}): VisualContractAuthoringArtifactWrite {
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...receiptPayload
  } = args.receipt;
  if (
    args.receipt.version !==
      VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION ||
    (args.receipt.status === 'failed'
      ? !visualContractAuthoringTerminalFailureIsValid(
          args.receipt.failure,
        )
      : args.receipt.failure !== null) ||
    !visualContractAuthoringAttemptBudgetSequenceIsValid(
      args.receipt.attempts,
    ) ||
    !visualContractAuthoringReceiptExhaustionBindingIsValid(
      args.receipt,
    ) ||
    !visualContractAuthoringReceiptDraftValidationIsValid(
      args.receipt,
    ) ||
    args.receipt.digestAlgorithm !==
      'canonical-json-sha256' ||
    args.receipt.digest !==
      canonicalJsonDigest(receiptPayload)
  ) {
    throw new Error(
      'receipt v26 requires exact typed draft-validation evidence, an exact Visual Contract terminal, and valid bindings',
    );
  }
  return persistJsonArtifact({
    ...args,
    category: 'authoring-receipts',
    digest: args.receipt.digest,
    value: args.receipt,
  });
}

export function buildVisualContractCandidateArtifact(args: {
  receipt: VisualContractAuthoringReceipt;
  compileResult: Pick<
    TemplateCompileResult,
    'template' | 'actionSemanticCoverage'
  >;
}): VisualContractCandidateArtifact {
  const templateDigest = canonicalJsonDigest(
    args.compileResult.template,
  );
  const {
    digestAlgorithm: _receiptDigestAlgorithm,
    digest: _receiptDigest,
    ...receiptPayload
  } = args.receipt;
  if (
    args.receipt.version !==
      VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION ||
    args.receipt.status !== 'completed' ||
    !visualContractAuthoringAttemptBudgetSequenceIsValid(
      args.receipt.attempts,
    ) ||
    args.receipt.candidateDigest !== templateDigest ||
    args.receipt.digestAlgorithm !==
      'canonical-json-sha256' ||
    args.receipt.digest !==
      canonicalJsonDigest(receiptPayload)
  ) {
    throw new Error(
      'refusing to persist an uncompleted or receipt-unbound Visual Contract candidate',
    );
  }
  const actionSemanticCoverageDigest = canonicalJsonDigest(
    args.compileResult.actionSemanticCoverage,
  );
  assertCompleteActionSemanticCoverage({
    template: args.compileResult.template,
    coverage: args.compileResult.actionSemanticCoverage,
  });
  if (
    args.receipt.actionSemanticCoverage.status !==
      'complete_review_required' ||
    args.receipt.actionSemanticCoverage.catalogVersion !==
      ACTION_SEMANTIC_CATALOG_VERSION ||
    args.receipt.actionSemanticCoverage.catalogDigest !==
      ACTION_SEMANTIC_CATALOG_DIGEST ||
    args.receipt.actionSemanticCoverage.version !==
      ACTION_SEMANTIC_COVERAGE_VERSION ||
    args.receipt.actionSemanticCoverage.sourceEvidenceCatalogVersion !==
      SOURCE_EVIDENCE_CATALOG_VERSION ||
    !/^[a-f0-9]{64}$/.test(
      args.receipt.actionSemanticCoverage.sourceEvidenceCatalogDigest,
    ) ||
    args.receipt.actionSemanticCoverage.coverageDigest !==
      actionSemanticCoverageDigest
  ) {
    throw new Error(
      'refusing to persist a candidate without current Action Semantic Coverage authority',
    );
  }
  const artifactWithoutDigest = {
    version: VISUAL_CONTRACT_CANDIDATE_ARTIFACT_VERSION,
    sourceSnapshotDigest:
      args.receipt.sourceSnapshotDigest,
    authoringRequestDigest: args.receipt.requestDigest,
    authoringReceiptDigest: args.receipt.digest,
    templateDigest,
    actionSemanticCatalogVersion:
      ACTION_SEMANTIC_CATALOG_VERSION,
    actionSemanticCatalogDigest:
      ACTION_SEMANTIC_CATALOG_DIGEST,
    actionSemanticCoverageVersion:
      ACTION_SEMANTIC_COVERAGE_VERSION,
    actionSemanticCoverageDigest,
    sourceEvidenceCatalogVersion:
      SOURCE_EVIDENCE_CATALOG_VERSION,
    sourceEvidenceCatalogDigest:
      args.receipt.actionSemanticCoverage.sourceEvidenceCatalogDigest,
    template: args.compileResult.template,
    actionSemanticCoverage:
      args.compileResult.actionSemanticCoverage,
    status: 'candidate' as const,
    doesNotAuthorize: [...DOES_NOT_AUTHORIZE],
  };
  const artifact: VisualContractCandidateArtifact = {
    ...artifactWithoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(artifactWithoutDigest),
  };
  return artifact;
}

export function persistVisualContractCandidate(args: {
  repoRoot: string;
  outputDir: string;
  receipt: VisualContractAuthoringReceipt;
  compileResult: Pick<
    TemplateCompileResult,
    'template' | 'actionSemanticCoverage'
  >;
  write?: boolean;
}): VisualContractAuthoringArtifactWrite {
  const artifact = buildVisualContractCandidateArtifact(
    args,
  );
  return persistJsonArtifact({
    ...args,
    category: 'contract-candidates',
    digest: artifact.digest,
    value: artifact,
  });
}

export function persistVisualContractAuthoringReadiness(args: {
  repoRoot: string;
  outputDir: string;
  evidence: VisualContractAuthoringReadinessEvidence;
  receipt: VisualContractAuthoringReceipt;
  write?: boolean;
}): VisualContractAuthoringArtifactWrite {
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...readinessPayload
  } = args.evidence;
  if (
    args.evidence.version !==
      VISUAL_CONTRACT_AUTHORING_READINESS_VERSION ||
    !visualContractAuthoringReceiptDraftValidationIsValid(
      args.receipt,
    ) ||
    args.evidence.authoringReceiptDigest !== args.receipt.digest ||
    !visualContractDraftValidationEvidenceIsValid(
      args.evidence.draftValidation,
    ) ||
    !exactJson(
      args.evidence.draftValidation,
      draftValidationEvidenceForReceipt(args.receipt),
    ) ||
    args.evidence.digestAlgorithm !==
      'canonical-json-sha256' ||
    args.evidence.digest !==
      canonicalJsonDigest(readinessPayload)
  ) {
    throw new Error(
      'readiness v24 requires exact typed draft-validation evidence and a valid current digest',
    );
  }
  return persistJsonArtifact({
    ...args,
    category: 'readiness-evidence',
    digest: args.evidence.digest,
    value: args.evidence,
  });
}
