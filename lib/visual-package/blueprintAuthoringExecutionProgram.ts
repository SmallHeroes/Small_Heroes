import {
  BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION,
} from './blueprintAuthoringAdmissionLedger';
import {
  BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY_DIGEST,
} from './blueprintAuthoringCountAwareCost';
import {
  BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
  BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT,
  BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION,
  BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS,
  BLUEPRINT_AUTHORING_TOKEN_RELEVANT_REQUEST_STATIC_AUTHORITY,
} from './blueprintAuthoringInputTokenAdmission';
import {
  BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
  BLUEPRINT_AUTHORING_MAX_CALLS,
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_REPAIRS,
  BLUEPRINT_AUTHORING_MODEL,
  BLUEPRINT_AUTHORING_NO_FALLBACK,
  BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS,
  BLUEPRINT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE,
  BLUEPRINT_AUTHORING_PROVIDER,
  BLUEPRINT_AUTHORING_REASONING_EFFORT,
  BLUEPRINT_AUTHORING_REPAIR_ORDINALS,
  BLUEPRINT_AUTHORING_SERVICE_TIER,
  BLUEPRINT_AUTHORING_STORE,
  BLUEPRINT_AUTHORING_STREAM,
  BLUEPRINT_AUTHORING_TIMEOUT_MS,
  BLUEPRINT_AUTHORING_TRANSPORT_RETRIES,
  OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
} from './blueprintAuthoringPolicy';
import { canonicalJsonDigest } from './integrity';
import {
  buildPreRenderBlueprintAuthoringSystemPrompt,
  buildPreRenderBlueprintRepairSystemPrompt,
} from './preRenderBlueprintAuthoring';
import {
  PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION,
  PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION,
  PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION,
} from './preRenderBlueprintAuthoringContract';
import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION,
} from './preRenderBlueprintDraftSchema';
import {
  PRE_RENDER_BLUEPRINT_AUTHORING_AUTHORITY_VERSION,
  PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION,
  PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION,
} from './preRenderBlueprintTypes';
import {
  PRE_RENDER_BLUEPRINT_LAYOUT_POLICY,
  PRE_RENDER_BLUEPRINT_LAYOUT_POLICY_VERSION,
} from './preRenderBlueprintLayoutPolicy';
import {
  PRE_RENDER_BLUEPRINT_PROVIDER_WIRE_VERSION,
  PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION,
} from './preRenderBlueprintProviderWire';
import {
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
} from './openaiResponsesStructuredOutputSchemaCompatibility';
import {
  OPENAI_RESPONSES_TRANSPORT_AUTHORITY_DIGEST,
} from './openAIResponsesTransportAuthority';

export const BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_VERSION =
  'blueprint-authoring-execution-program/v1' as const;
export const BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_ALGORITHM =
  'canonical-json-sha256' as const;

const HEX_SHA256 = /^[a-f0-9]{64}$/;

export const BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_KEYS = [
  'admissionLedgerVersion',
  'authoringAuthorityVersion',
  'authoringPolicyDigest',
  'authoringProvenanceVersion',
  'authoringSystemPromptDigest',
  'blueprintVersion',
  'compositionPolicyVersion',
  'countAwareCostPolicyDigest',
  'countEvidenceVersion',
  'digest',
  'digestAlgorithm',
  'draftSchemaDigest',
  'draftSchemaName',
  'draftSchemaVersion',
  'exactInputTokenResponseObject',
  'generationEvidenceVersion',
  'initialPromptVersion',
  'inputAdmissionPolicyVersion',
  'inputTokenBoundBasis',
  'layoutPolicyDigest',
  'layoutPolicyVersion',
  'repairPromptVersion',
  'repairSystemPromptDigest',
  'repairWireVersion',
  'structuredOutputCompatibilityProfileDigest',
  'structuredOutputCompatibilityProfileVersion',
  'providerWireVersion',
  'tokenRelevantRequestStaticAuthorityDigest',
  'transportAuthorityDigest',
  'version',
] as const;

export interface BlueprintAuthoringExecutionProgram {
  version: typeof BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_VERSION;
  blueprintVersion: typeof PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION;
  authoringAuthorityVersion:
    typeof PRE_RENDER_BLUEPRINT_AUTHORING_AUTHORITY_VERSION;
  authoringProvenanceVersion:
    typeof PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION;
  initialPromptVersion: typeof PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION;
  authoringSystemPromptDigest: string;
  repairPromptVersion: typeof PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION;
  repairSystemPromptDigest: string;
  providerWireVersion: typeof PRE_RENDER_BLUEPRINT_PROVIDER_WIRE_VERSION;
  repairWireVersion: typeof PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION;
  structuredOutputCompatibilityProfileVersion:
    typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION;
  structuredOutputCompatibilityProfileDigest: string;
  draftSchemaVersion: typeof PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION;
  draftSchemaName: typeof PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME;
  draftSchemaDigest: string;
  tokenRelevantRequestStaticAuthorityDigest: string;
  exactInputTokenResponseObject:
    typeof BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT;
  compositionPolicyVersion: typeof PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION;
  authoringPolicyDigest: string;
  inputAdmissionPolicyVersion:
    typeof BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION;
  inputTokenBoundBasis: typeof BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS;
  layoutPolicyVersion: typeof PRE_RENDER_BLUEPRINT_LAYOUT_POLICY_VERSION;
  layoutPolicyDigest: string;
  countEvidenceVersion: typeof BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION;
  countAwareCostPolicyDigest: string;
  admissionLedgerVersion: typeof BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION;
  generationEvidenceVersion:
    typeof OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION;
  transportAuthorityDigest: string;
  digestAlgorithm: typeof BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_ALGORITHM;
  digest: string;
}

function exactKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...keys].sort())
  );
}

export function blueprintAuthoringEffectivePolicyProjection() {
  return {
    provider: BLUEPRINT_AUTHORING_PROVIDER,
    model: BLUEPRINT_AUTHORING_MODEL,
    serviceTier: BLUEPRINT_AUTHORING_SERVICE_TIER,
    reasoningEffort: BLUEPRINT_AUTHORING_REASONING_EFFORT,
    store: BLUEPRINT_AUTHORING_STORE,
    stream: BLUEPRINT_AUTHORING_STREAM,
    noFallback: BLUEPRINT_AUTHORING_NO_FALLBACK,
    transportRetries: BLUEPRINT_AUTHORING_TRANSPORT_RETRIES,
    timeoutMs: BLUEPRINT_AUTHORING_TIMEOUT_MS,
    maxInputTokens: BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
    maxOutputTokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
    maxCalls: BLUEPRINT_AUTHORING_MAX_CALLS,
    maxRepairs: BLUEPRINT_AUTHORING_MAX_REPAIRS,
    repairOrdinals: BLUEPRINT_AUTHORING_REPAIR_ORDINALS,
    hardCostCeilingUsd: BLUEPRINT_AUTHORING_HARD_COST_CEILING_USD,
    promptProtocolAllowance: BLUEPRINT_AUTHORING_PROMPT_PROTOCOL_ALLOWANCE,
    priceAssumptions: BLUEPRINT_AUTHORING_PRICE_ASSUMPTIONS,
  } as const;
}

export function buildBlueprintAuthoringExecutionProgram(): BlueprintAuthoringExecutionProgram {
  const payload = {
    version: BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_VERSION,
    blueprintVersion: PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION,
    authoringAuthorityVersion:
      PRE_RENDER_BLUEPRINT_AUTHORING_AUTHORITY_VERSION,
    authoringProvenanceVersion:
      PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION,
    initialPromptVersion: PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION,
    authoringSystemPromptDigest: canonicalJsonDigest(
      buildPreRenderBlueprintAuthoringSystemPrompt(),
    ),
    repairPromptVersion: PRE_RENDER_BLUEPRINT_REPAIR_PROMPT_VERSION,
    repairSystemPromptDigest: canonicalJsonDigest(
      buildPreRenderBlueprintRepairSystemPrompt(),
    ),
    providerWireVersion: PRE_RENDER_BLUEPRINT_PROVIDER_WIRE_VERSION,
    repairWireVersion: PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION,
    structuredOutputCompatibilityProfileVersion:
      OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
    structuredOutputCompatibilityProfileDigest: canonicalJsonDigest(
      OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE,
    ),
    draftSchemaVersion: PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION,
    draftSchemaName: PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME,
    draftSchemaDigest: canonicalJsonDigest(PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA),
    tokenRelevantRequestStaticAuthorityDigest: canonicalJsonDigest(
      BLUEPRINT_AUTHORING_TOKEN_RELEVANT_REQUEST_STATIC_AUTHORITY,
    ),
    exactInputTokenResponseObject:
      BLUEPRINT_AUTHORING_EXACT_INPUT_TOKEN_RESPONSE_OBJECT,
    compositionPolicyVersion: PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION,
    authoringPolicyDigest: canonicalJsonDigest(
      blueprintAuthoringEffectivePolicyProjection(),
    ),
    inputAdmissionPolicyVersion:
      BLUEPRINT_AUTHORING_INPUT_TOKEN_ADMISSION_POLICY_VERSION,
    inputTokenBoundBasis: BLUEPRINT_AUTHORING_INPUT_TOKEN_BOUND_BASIS,
    layoutPolicyVersion: PRE_RENDER_BLUEPRINT_LAYOUT_POLICY_VERSION,
    layoutPolicyDigest: canonicalJsonDigest(PRE_RENDER_BLUEPRINT_LAYOUT_POLICY),
    countEvidenceVersion: BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
    countAwareCostPolicyDigest:
      BLUEPRINT_AUTHORING_COUNT_AWARE_COST_AUTHORITY_DIGEST,
    admissionLedgerVersion: BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION,
    generationEvidenceVersion:
      OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
    transportAuthorityDigest: OPENAI_RESPONSES_TRANSPORT_AUTHORITY_DIGEST,
    digestAlgorithm: BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_ALGORITHM,
  } as const;
  return {
    ...payload,
    digest: canonicalJsonDigest(payload),
  };
}

export function blueprintAuthoringExecutionProgramIsCurrent(
  value: unknown,
): value is BlueprintAuthoringExecutionProgram {
  if (!exactKeys(value, BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_KEYS)) {
    return false;
  }
  const candidate = value as unknown as BlueprintAuthoringExecutionProgram;
  if (
    candidate.digestAlgorithm !==
      BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_DIGEST_ALGORITHM ||
    typeof candidate.digest !== 'string' ||
    !HEX_SHA256.test(candidate.digest)
  ) {
    return false;
  }
  const { digest, ...payload } = candidate;
  if (digest !== canonicalJsonDigest(payload)) return false;
  return (
    canonicalJsonDigest(candidate) ===
    canonicalJsonDigest(buildBlueprintAuthoringExecutionProgram())
  );
}
